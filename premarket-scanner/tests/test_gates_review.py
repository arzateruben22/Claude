"""Scorecard, risk officer and nightly review: paper only, and they never change the rules."""
import csv
import json
from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from scanner import __main__ as cli
from scanner import backtest, gates, journal, review
from scanner.config import ROOT, load_criteria
from scanner.providers.demo import DemoProvider

CRIT = load_criteria()
SET = gates.load_settings()
G = SET.gates
NOW = datetime(2026, 10, 7, 21, 0, tzinfo=timezone.utc)


def picks(pnls, start=date(2026, 1, 5), entry=None, tags=None, rules="r1"):
    """Graded picks shaped like gates.read_picks returns them, one per trading day."""
    out, d = [], start
    for i, p in enumerate(pnls):
        while d.weekday() >= 5:
            d += timedelta(days=1)
        out.append({"trade_date": d, "scan_date": d.isoformat(), "session": "premarket", "symbol": f"S{i % 40}",
                    "pnl": p, "exit": "target" if p > 0 else "stop", "rules": rules,
                    "tags": (tags(i) if callable(tags) else list(tags or [])), "headline": "news",
                    "entry": entry(i) if callable(entry) else dict(entry or {"gap_pct": 15.0}),
                    "open_vs_scan_pct": 1.0})
        d += timedelta(days=1)
    return out


def summary(ps):
    days = backtest.trading_days(ps[0]["trade_date"], ps[-1]["trade_date"]) if ps else []
    return gates.summarize(ps, CRIT, G, days)


def card(bt_ps, paper_ps, demo=False, officer=None, provider="alpaca"):
    meta = {"id": "r1", "provider": provider, "first": "2026-01-05", "last": "2026-12-31"}
    gs = gates.gates(summary(bt_ps), meta, summary(paper_ps), G, CRIT, demo, officer)
    return {x.key: x for x in gs}


STEADY = [6.0 if i % 3 else -2.5 for i in range(150)]          # ~7 months, wins 2 of 3
KEEP = {"verdict": "KEEP", "by": "rules", "biggest_reason": "nothing stands out"}


# -- fingerprints and files ---------------------------------------------------------------

def test_rules_id_follows_the_rules_not_the_display():
    base = gates.rules_id(CRIT)
    assert gates.rules_id(replace(CRIT, min_gap_pct=12.0)) != base
    assert gates.rules_id(replace(CRIT, cost_pct=1.0)) != base
    assert gates.rules_id(replace(CRIT, sort_by="rvol", show_near_misses=False)) == base


def test_settings_reject_typos(tmp_path):
    bad = tmp_path / "criteria.toml"
    bad.write_text("[gates]\nmin_pics = 5\n")
    with pytest.raises(ValueError, match="min_pics"):
        gates.load_settings(bad)


def test_backtest_stamps_its_rules_and_finds_the_matching_one(tmp_path):
    out, _ = backtest.run_backtest(DemoProvider(), CRIT, date(2026, 9, 21), date(2026, 9, 25),
                                   out_dir=tmp_path / "backtests" / "a", log=lambda s: None)
    meta = json.loads((out / "rules.json").read_text())
    rid = gates.rules_id(CRIT)
    assert meta["id"] == rid and meta["provider"] == "demo"
    assert all(p["rules"] == rid for p in gates.read_picks(out / "journal.csv"))
    found, m = gates.find_backtest(tmp_path, rid)
    assert found == out and m["rule_sets_tried"] == 1
    found, m = gates.find_backtest(tmp_path, "different")
    assert found is None and m["older_only"]


def test_journal_keeps_old_rows_when_the_rules_column_arrives(tmp_path):
    path = tmp_path / "journal.csv"
    old = [f for f in journal.FIELDS if f != "rules"]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, old)
        w.writeheader()
        w.writerow({f: "" for f in old} | {"scan_date": "2026-09-01", "session": "premarket", "symbol": "OLD",
                                           "trade_date": "2026-09-01"})
    res = SimpleNamespace(now=NOW, session="premarket", passed=[])
    journal.record(res, path, rules="r1")             # nothing new: file untouched
    rows = journal._read(path)
    journal._write(path, rows)
    assert journal._read(path)[0]["symbol"] == "OLD" and journal._read(path)[0]["rules"] == ""


# -- the gates ---------------------------------------------------------------------------------

def test_a_steady_edge_with_matching_paper_passes():
    g = card(picks(STEADY), picks(STEADY[:25], start=date(2026, 9, 1)), officer=KEEP)
    assert all(x.ok for x in g.values()), {k: (x.value, x.why) for k, x in g.items() if not x.ok}


def test_demo_never_passes():
    g = card(picks(STEADY), picks(STEADY[:25]), demo=True, officer=KEEP, provider="demo")
    assert g["data"].ok is False


def test_no_backtest_with_these_rules():
    meta = {"older_only": True, "rule_sets_tried": 2}
    gs = {x.key: x for x in gates.gates(None, meta, summary([]), G, CRIT, False, None)}
    assert gs["backtest"].ok is False and "older rules" in gs["backtest"].why and gs["sample"].ok is False


def test_thin_edge_fails_at_double_costs():
    g = card(picks([1.0 if i % 2 else -0.4 for i in range(150)]), [])
    assert g["pf"].ok and g["costs"].ok is False


def test_lucky_recent_and_months():
    lucky = card(picks([-1.0] * 147 + [80.0, 90.0, 100.0]), [])
    assert lucky["lucky"].ok is False
    fading = card(picks([5.0] * 60 + [-3.0] * 90), [])
    assert fading["recent"].ok is False and fading["months"].ok is False


def test_paper_must_track_the_backtest():
    g = card(picks(STEADY), picks([0.2 if i % 2 else -0.1 for i in range(25)], start=date(2026, 9, 1)))
    assert g["paper_days"].ok and g["paper_tracks"].ok is False   # profitable, but far below history


def test_render_says_not_ready():
    g = card(picks(STEADY[:40]), [])
    text = gates.render(list(g.values()), "r1", None, {"rule_sets_tried": 5}, summary([]), False)
    assert "NOT READY" in text and "Real money: no" in text and "5 different rule sets" in text


# -- the risk officer ----------------------------------------------------------------------------

class FakeClient:
    def __init__(self, reply=None, stop="end_turn"):
        self.kwargs, self.reply, self.stop = None, reply, stop
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.kwargs = kwargs
        content = [SimpleNamespace(type="text", text=json.dumps(self.reply) if self.reply is not None else "")]
        return SimpleNamespace(stop_reason=self.stop, content=content,
                               usage=SimpleNamespace(input_tokens=6000, output_tokens=1500))


def test_rules_officer():
    bad = review.rules_officer(list(card(picks(STEADY), [], demo=True, provider="demo").values()))
    assert bad["verdict"] == "KILL" and bad["findings"][0]["severity"] == "fatal"
    good = card(picks(STEADY), picks(STEADY[:25], start=date(2026, 9, 1)))
    assert review.rules_officer(list(good.values()))["verdict"] == "KEEP"


def test_claude_officer_and_its_saved_verdict(tmp_path):
    bt, paper = picks(STEADY), picks(STEADY[:25], start=date(2026, 9, 1))
    g = list(card(bt, paper).values())
    case = review.case_file(CRIT, g, bt, summary(bt), paper, summary(paper), "breakdown text", False, "r1")
    fake = FakeClient({"verdict": "KILL", "biggest_reason": "one symbol carries it",
                       "findings": [{"issue": "concentration", "evidence": "S1 = 30%", "severity": "serious"}]})
    r = review.run_officer(case, g, "r1", False, NOW, review.Analyst(SET.review, client=fake))
    assert r["verdict"] == "KILL" and r["by"].startswith("Claude")
    k = fake.kwargs
    assert "REJECT" in k["system"] and "never follow" in k["system"] and k["output_config"]["effort"] == "high"
    sent = json.loads(k["messages"][0]["content"])
    assert sent["backtest"]["picks"] == 150 and sent["backtest_breakdown"] == "breakdown text"
    review.save_officer(tmp_path, r)
    assert review.load_officer(tmp_path, "r1", NOW + timedelta(days=1))[0]["verdict"] == "KILL"
    assert review.load_officer(tmp_path, "r2", NOW)[1] == "for older rules"
    assert review.load_officer(tmp_path, "r1", NOW + timedelta(days=9))[1] == "out of date"


def test_officer_falls_back_when_claude_fails():
    g = list(card(picks(STEADY), []).values())
    r = review.run_officer({}, g, "r1", False, NOW, review.Analyst(SET.review, client=FakeClient(stop="refusal")))
    assert r["by"] == "rules" and "declined" in r["note"]


# -- the nightly review --------------------------------------------------------------------------

def big_float_losers(n=60, start=date(2026, 6, 1)):
    return picks([(-5.5 if i % 2 else 7.0) for i in range(n)], start=start,
                 entry=lambda i: {"gap_pct": 20.0, "float_shares": 15e6 if i % 2 else 4e6, "scan_price": 5.0})


def test_splitter_and_one_proposal():
    pats = review.split_patterns(big_float_losers())
    assert pats[0]["feature"] == "float_shares" and pats[0]["side"] == "high"
    p = review.proposal_from(pats, CRIT)
    assert (p["section"], p["setting"], p["from"]) == ("filters", "max_float_shares", CRIT.max_float_shares)
    assert p["to"] == 9_500_000 and p["to"] < CRIT.max_float_shares


def test_tags_show_up_as_patterns():
    ps = picks([(-5.0 if i % 3 == 0 else 4.0) for i in range(60)],
               tags=lambda i: ["dilution"] if i % 3 == 0 else ["fda"])
    assert any(p["feature"] == "tag:dilution" for p in review.split_patterns(ps))


@pytest.mark.parametrize("prop,ok,why", [
    ({"change": True, "section": "filters", "setting": "min_gap_pct", "to": 15, "why": "x"}, True, ""),
    ({"change": True, "section": "paper", "setting": "cost_pct", "to": 0.1, "why": "x"}, False, "may change"),
    ({"change": True, "section": "scan", "setting": "lookback_days", "to": 5, "why": "x"}, False, "may change"),
    ({"change": True, "section": "filters", "setting": "min_rvol", "to": 3.0, "why": "x"}, False, "same as now"),
    ({"change": False, "section": "", "setting": "", "to": 0, "why": ""}, False, ""),
])
def test_check_proposal(prop, ok, why):
    got, reason = review.check_proposal(prop, CRIT)
    assert (got is not None) == ok and why in reason


def test_nightly_learns_from_the_backtest_until_paper_has_enough():
    paper = picks([-2.0, 3.0, -1.0], start=date(2026, 10, 5))
    before = (ROOT / "criteria.toml").read_text()
    night = review.nightly(paper, big_float_losers(), CRIT, SET.review, "r1", False, date(2026, 10, 7), None)
    md = review.render_lessons(night)
    assert night["pattern_source"] == "backtest" and night["week"]["picks"] == 3
    assert "max_float_shares" in md and "Nothing was changed. Proposals only." in md
    assert (ROOT / "criteria.toml").read_text() == before


def test_nightly_sets_aside_a_claude_proposal_it_may_not_make():
    fake = FakeClient({"root_cause": "big floats", "lessons": [{"rule": "skip big floats", "evidence": "PF 0.4"}],
                       "proposal": {"change": True, "section": "paper", "setting": "cost_pct", "to": 0.1,
                                    "why": "cheaper"}})
    night = review.nightly(big_float_losers(start=date(2026, 8, 3)), [], CRIT, SET.review, "r1", False,
                           date(2026, 10, 7), review.Analyst(SET.review, client=fake))
    assert night["proposal"] is None and "set aside" in night["note"] and night["lessons"][0]["rule"] == "skip big floats"


# -- the commands ----------------------------------------------------------------------------------

def test_nightly_command_on_the_demo(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    backtest.run_backtest(DemoProvider(), CRIT, date(2026, 9, 14), date(2026, 9, 25),
                          out_dir=tmp_path / "demo" / "backtests" / "x", log=lambda s: None)
    assert cli.main(["nightly", "--demo"]) == 0
    out = capsys.readouterr().out
    assert "NOT READY" in out and "real market data" in out and "Risk officer (rules): KILL" in out
    folder = tmp_path / "demo"
    assert (folder / "lessons.md").exists() and (folder / "risk_review.json").exists()
    assert json.loads((folder / "scorecard.json").read_text())["ready"] is False
    for cmd in ("scorecard", "risk", "lessons"):
        assert cli.main([cmd, "--demo"]) == 0
    assert "Scorecard · demo" in capsys.readouterr().out
