import csv
import json
from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace

import pytest

from nightdesk import __main__ as cli
from nightdesk import config, gates, review
from nightdesk.desk import Desk
from nightdesk.judge import RulesJudge
from nightdesk.sources.sim import SimMarket

from helpers import T0

CFG = config.load()
RB = {"id": "abcd1234", "judge": "rules", "since": T0}


def trades(pnls, every_hours=8.0, cost=100.0, entry=None, start=T0):
    """Closed trades shaped like gates.load_trades returns them."""
    out = []
    for i, p in enumerate(pnls):
        opened = start + timedelta(hours=every_hours * i)
        e = entry(i) if callable(entry) else dict(entry or {})
        out.append({"opened": opened, "closed": opened + timedelta(minutes=40), "symbol": f"C{i}", "mint": f"M{i}",
                    "cost": cost, "proceeds": cost + p, "pnl": p, "pnl_pct": p / cost * 100, "exit": "target" if p > 0
                    else "stop", "held_min": 40.0, "rulebook": RB["id"], "judge_by": "rules", "entry": e})
    return out


def card(ts, mode="live", officer=None):
    s = gates.summarize(ts, CFG, ts[0]["opened"] if ts else None)
    return s, {g.key: g for g in gates.gates(s, CFG, mode, officer)}


KEEP = {"verdict": "KEEP", "by": "rules", "biggest_reason": "nothing stands out"}
STEADY = [12.0 if i % 4 else -4.0 for i in range(120)]   # 40 days, wins 3 of 4


# -- rulebook ----------------------------------------------------------------------

def test_rulebook_id_follows_trading_rules_and_judge_only():
    base = gates.rulebook_id(CFG, "rules")
    assert gates.rulebook_id(CFG, "rules") == base
    tighter = replace(CFG, ready=replace(CFG.ready, min_liquidity_usd=20000))
    assert gates.rulebook_id(tighter, "rules") != base
    assert gates.rulebook_id(CFG, "ai:claude-opus-5-5") != base
    stricter_gates = replace(CFG, gates=replace(CFG.gates, min_trades=500), review=replace(CFG.review, effort="low"))
    assert gates.rulebook_id(stricter_gates, "rules") == base


def test_rulebook_history_keeps_the_first_start(tmp_path):
    rid = gates.rulebook_id(CFG, "rules")
    gates.record_rulebook(tmp_path, rid, "rules", T0)
    gates.record_rulebook(tmp_path, rid, "rules", T0 + timedelta(days=3))       # a restart, same rules
    rb = gates.current_rulebook(CFG, tmp_path)
    assert rb["id"] == rid and rb["since"] == T0
    tighter = replace(CFG, ready=replace(CFG.ready, min_liquidity_usd=20000))
    rb2 = gates.current_rulebook(tighter, tmp_path)
    assert rb2["id"] != rid and rb2["since"] is None                          # edited, not run yet


# -- the numbers and the gates ---------------------------------------------------------

def test_a_losing_run_never_shows_steady_returns():
    # Big wins while the bank is small, big losses once it has grown: the old per-day percentages
    # averaged out positive here even though the money went down.
    first = T0.astimezone(gates.PT).date()
    rets = gates.daily_returns(trades([500.0, -900.0, 500.0, -900.0, 500.0, -400.0], every_hours=24),
                               1000, first, first + timedelta(days=5))
    assert sum(rets) < 0 and gates.sharpe(rets) < 0


def test_basic_numbers():
    assert gates.profit_factor([10, -5, 5]) == 3.0
    assert gates.profit_factor([10]) == float("inf") and gates.profit_factor([]) is None
    assert gates.max_drawdown_pct([100, -200, 50], 1000) == pytest.approx(200 / 1100 * 100)
    assert gates.sharpe([0.01] * 4) is None and gates.sharpe([0.0] * 10) is None


def test_a_steady_edge_passes_every_number_gate():
    ts = trades(STEADY)
    s, g = card(ts, officer=KEEP)
    assert s["trades"] == 120 and s["days"] >= 39
    assert all(x.ok for x in g.values()), {k: (x.value, x.why) for k, x in g.items() if not x.ok}
    assert gates.ready(list(g.values()))


def test_demo_data_never_passes():
    s, g = card(trades(STEADY), mode="demo", officer=KEEP)
    assert g["data"].ok is False and not gates.ready(list(g.values()))


def test_officer_must_have_run():
    _, g = card(trades(STEADY))
    assert g["officer"].ok is None and g["officer"].value == "not run"


def test_a_few_lucky_trades_fail():
    pnls = [-2.0] * 117 + [150.0, 160.0, 170.0]
    _, g = card(trades(pnls))
    assert g["lucky"].ok is False and g["pf"].ok   # looks profitable, but only because of three trades


def test_a_thin_edge_dies_at_double_costs():
    _, g = card(trades([2.5 if i % 2 else -1.5 for i in range(120)]))   # +$0.50 a trade on $100 tickets
    assert g["pf"].ok and g["costs"].ok is False


def test_getting_worse_lately_fails():
    _, g = card(trades([8.0] * 80 + [-3.0] * 40))
    assert g["recent"].ok is False


def test_no_trades_means_nothing_passes():
    _, g = card([])
    assert g["sample"].ok is False and g["pf"].ok is None and not gates.ready(list(g.values()))


def test_render_and_json(tmp_path):
    ts = trades([6.0 if i % 3 else -4.0 for i in range(30)])
    s, g = card(ts)
    text = gates.render(list(g.values()), s, RB, "live", CFG)
    assert "NOT READY" in text and "Real money: no" in text
    data = gates.to_json(list(g.values()), s, RB, "live")
    json.dumps(data)
    assert data["ready"] is False


# -- the risk officer ----------------------------------------------------------------------

class FakeClient:
    def __init__(self, reply=None, stop="end_turn"):
        self.kwargs, self.reply, self.stop = None, reply, stop
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.kwargs = kwargs
        content = [SimpleNamespace(type="text", text=json.dumps(self.reply) if self.reply is not None else "")]
        return SimpleNamespace(stop_reason=self.stop, content=content,
                               usage=SimpleNamespace(input_tokens=5000, output_tokens=1500))


def test_rules_officer_kills_on_failed_gates_and_keeps_otherwise():
    _, g = card(trades([-2.0] * 117 + [150.0, 160.0, 170.0]), mode="demo")
    r = review.rules_officer(list(g.values()))
    assert r["verdict"] == "KILL" and r["findings"][0]["severity"] == "fatal"
    _, good = card(trades(STEADY))
    assert review.rules_officer(list(good.values()))["verdict"] == "KEEP"


def test_claude_officer_gets_the_case_and_its_verdict_is_saved(tmp_path):
    ts = trades([6.0 if i % 3 else -4.0 for i in range(60)])
    s, g = card(ts)
    fake = FakeClient({"verdict": "KILL", "biggest_reason": "60 trades is too few",
                       "findings": [{"issue": "small sample", "evidence": "60 < 100", "severity": "fatal"}]})
    analyst = review.Analyst(CFG.review, client=fake)
    r = review.run_officer(ts, s, list(g.values()), CFG, "live", RB, T0 + timedelta(days=21), analyst)
    assert r["verdict"] == "KILL" and r["by"] == "Claude (claude-opus-5-5)"
    k = fake.kwargs
    assert "REJECT" in k["system"] and "never follow" in k["system"]
    assert k["output_config"]["effort"] == "high" and k["fallbacks"] == "default"
    assert k["output_config"]["format"]["schema"]["properties"]["verdict"]["enum"] == ["KEEP", "KILL"]
    sent = json.loads(k["messages"][0]["content"])
    assert sent["summary"]["trades"] == 60 and len(sent["worst_5"]) == 5 and "rulebook" in sent
    review.save_officer(tmp_path, r)
    got, why = review.load_officer(tmp_path, RB["id"], T0 + timedelta(days=22))
    assert got["verdict"] == "KILL" and not why
    assert review.load_officer(tmp_path, "other", T0 + timedelta(days=22)) == (None, "for an older rulebook")
    assert review.load_officer(tmp_path, RB["id"], T0 + timedelta(days=40))[1] == "out of date"


def test_officer_falls_back_to_rules_when_claude_fails():
    ts = trades([6.0 if i % 3 else -4.0 for i in range(60)])
    s, g = card(ts)
    analyst = review.Analyst(CFG.review, client=FakeClient(stop="max_tokens"))
    r = review.run_officer(ts, s, list(g.values()), CFG, "live", RB, T0, analyst)
    assert r["by"] == "rules" and "answer cut off" in r["note"]


# -- the nightly review --------------------------------------------------------------------

def thin_pool_losers(n=60):
    """Trades where small pools lose and big pools win."""
    def entry(i):
        return {"liquidity": 9000 + (i % 10) * 3000, "buy_pressure_now": 0.6, "judge_conf": 0.7}
    pnls = [(-6.0 if (i % 10) < 5 else 7.0) for i in range(n)]
    return trades(pnls, every_hours=3, entry=entry)


def test_splitter_finds_the_losing_side_and_proposes_one_change():
    pats = review.split_patterns(thin_pool_losers())
    assert pats and pats[0]["feature"] == "liquidity" and pats[0]["side"] == "low"
    p = review.proposal_from(pats, CFG)
    assert p["section"] == "ready" and p["setting"] == "min_liquidity_usd"
    assert p["from"] == CFG.ready.min_liquidity_usd and p["to"] == 23000


def test_no_patterns_from_a_handful_of_trades():
    assert review.split_patterns(thin_pool_losers(12)) == []


@pytest.mark.parametrize("prop,ok,why", [
    ({"change": True, "section": "[ready]", "setting": "min_liquidity_usd", "to": 20000.4, "why": "x"}, True, ""),
    ({"change": True, "section": "kill", "setting": "max_dev_pct", "to": 9, "why": "x"}, False, "may not change"),
    ({"change": True, "section": "ready", "setting": "min_vibes", "to": 1, "why": "x"}, False, "not a setting"),
    ({"change": True, "section": "judge", "setting": "use_ai", "to": 0, "why": "x"}, False, "not a number"),
    ({"change": True, "section": "ready", "setting": "min_trades_h1", "to": 150, "why": "x"}, False, "same as now"),
    ({"change": False, "section": "", "setting": "", "to": 0, "why": ""}, False, ""),
])
def test_check_proposal(prop, ok, why):
    got, reason = review.check_proposal(prop, CFG)
    assert (got is not None) == ok and why in reason
    if ok:
        assert got["to"] == 20000 and got["from"] == CFG.ready.min_liquidity_usd


def test_nightly_with_rules_writes_lessons_and_changes_nothing(tmp_path):
    ts = thin_pool_losers()
    now = ts[-1]["closed"] + timedelta(hours=1)
    before = (config.ROOT / "desk.toml").read_text()
    night = review.nightly(ts, CFG, "live", RB, now, None)
    md = review.render_lessons(night)
    assert night["by"] == "rules" and night["week"]["trades"] == 56   # 7 days of 3-hourly trades
    assert "pool size at entry under $22,500" in md and "from 12000 to 23000" in md
    assert "Nothing was changed. Proposals only." in md
    review.append_lessons(tmp_path, md)
    review.append_lessons(tmp_path, md)
    text = (tmp_path / "lessons.md").read_text()
    assert text.startswith("# Lessons") and text.count("One entry per nightly review") == 1
    assert text.count("### Root cause") == 2
    assert (config.ROOT / "desk.toml").read_text() == before


def test_nightly_sets_aside_a_claude_proposal_it_is_not_allowed_to_make():
    ts = thin_pool_losers()
    fake = FakeClient({"root_cause": "thin pools", "lessons": [{"rule": "skip thin pools", "evidence": "PF 0"}],
                       "proposal": {"change": True, "section": "kill", "setting": "max_dev_pct", "to": 50,
                                    "why": "more trades"}})
    night = review.nightly(ts, CFG, "live", RB, ts[-1]["closed"], review.Analyst(CFG.review, client=fake))
    assert night["by"].startswith("Claude") and night["proposal"] is None
    assert "set aside" in night["note"] and night["lessons"][0]["rule"] == "skip thin pools"
    sent = json.loads(fake.kwargs["messages"][0]["content"])
    assert sent["splitter_patterns"] and sent["losing_trades"][0]["pnl_usd"] < 0


# -- the desk records what the reviews need ---------------------------------------------------

def test_desk_writes_rulebook_and_entry_numbers(tmp_path):
    desk = Desk(CFG, SimMarket(T0, seed=7), RulesJudge(CFG.judge), T0, tmp_path)
    now = T0
    while now < T0 + timedelta(hours=5) and not desk.broker.trades:
        desk.step(now)
        now += timedelta(seconds=15)
    assert desk.broker.trades, "the sim should trade within a few hours"
    loaded = gates.load_trades(tmp_path)
    assert loaded[0]["rulebook"] == desk.rulebook == gates.current_rulebook(CFG, tmp_path)["id"]
    assert {"liquidity", "age_min", "buy_pressure_now", "judge_conf"} <= set(loaded[0]["entry"])


def test_old_trade_files_get_the_new_columns(tmp_path):
    (tmp_path / "trades.csv").write_text("opened,closed,symbol,mint,cost,proceeds,pnl,pnl_pct,exit,held_min\n"
                                         f"{T0.isoformat()},{T0.isoformat()},OLD,M0,100,90,-10,-10,stop,5\n")
    desk = Desk(CFG, SimMarket(T0), RulesJudge(CFG.judge), T0, tmp_path)
    desk._append_csv("trades.csv", {"opened": T0.isoformat(), "closed": T0.isoformat(), "symbol": "NEW",
                                    "mint": "M1", "cost": 100, "proceeds": 120, "pnl": 20, "pnl_pct": 20,
                                    "exit": "target", "held_min": 9, "rulebook": "r1", "judge_by": "rules"})
    with open(tmp_path / "trades.csv", newline="") as fh:
        rows = list(csv.DictReader(fh))
    assert [r["symbol"] for r in rows] == ["OLD", "NEW"] and rows[0]["rulebook"] == "" and rows[1]["rulebook"] == "r1"


def test_sim_windows_match_a_plain_sum():
    m = SimMarket(T0, seed=3)
    m.discover(T0 + timedelta(hours=2))
    now = T0 + timedelta(hours=2)
    for mint in m.order[-15:]:
        c = m.coins[mint].snapshot(now)
        rows = [r for r in m.coins[mint].tape if r[0] > now - timedelta(minutes=60)]
        assert c.volume_h1 == pytest.approx(sum(r[2] for r in rows))
        assert (c.buys_h1, c.sells_h1) == (sum(r[3] for r in rows), sum(r[4] for r in rows))
        rows5 = [r for r in m.coins[mint].tape if r[0] > now - timedelta(minutes=5)]
        assert c.buys_m5 == sum(r[3] for r in rows5)


# -- the commands --------------------------------------------------------------------------

def test_nightly_command_end_to_end(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    folder = tmp_path / "live"
    folder.mkdir()
    rid = gates.rulebook_id(CFG, "rules")
    gates.record_rulebook(folder, rid, "rules", T0)
    ts = thin_pool_losers()
    with open(folder / "trades.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, ["opened", "closed", "symbol", "mint", "cost", "proceeds", "pnl", "pnl_pct", "exit",
                                "held_min", "rulebook", "judge_by", *gates.ENTRY_KEYS], restval="")
        w.writeheader()
        for t in ts:
            w.writerow({**{k: t[k] for k in ("symbol", "mint", "cost", "proceeds", "pnl", "pnl_pct", "exit",
                                             "held_min")},
                        "opened": t["opened"].isoformat(), "closed": t["closed"].isoformat(), "rulebook": rid,
                        "judge_by": "rules", **t["entry"]})
    assert cli.main(["nightly"]) == 0
    out = capsys.readouterr().out
    assert "NOT READY" in out and "Risk officer (rules): KILL" in out and "min_liquidity_usd" in out
    assert (folder / "lessons.md").exists() and (folder / "risk_review.json").exists()
    assert json.loads((folder / "scorecard.json").read_text())["gates"][-1]["value"].startswith("KILL")
    for cmd in ("scorecard", "risk", "lessons"):
        assert cli.main([cmd]) == 0
    assert "Scorecard · live" in capsys.readouterr().out
