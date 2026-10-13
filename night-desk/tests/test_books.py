"""A second rulebook (desk-wild.toml) running next to the main desk on its own paper bank."""
import json
import threading
import urllib.request
from dataclasses import asdict
from datetime import timedelta

import pytest

from nightdesk import __main__ as cli
from nightdesk import config, gates
from nightdesk.__main__ import main
from nightdesk.desk import Desk
from nightdesk.judge import RulesJudge
from nightdesk.server import Runner, make_server
from nightdesk.sources.shared import SharedSource
from nightdesk.sources.sim import SimMarket

from helpers import T0

MAIN = config.load()
WILD = config.load(config.book_paths("wild")[0])


def test_book_paths():
    assert config.book_paths("main") == (config.ROOT / "desk.toml", config.OUTPUT)
    assert config.book_paths("wild") == (config.ROOT / "desk-wild.toml", config.OUTPUT / "wild")
    for bad in ("nope", "../desk", "Wild", "wild/x", ""):
        with pytest.raises(ValueError):
            config.book_paths(bad)


def test_wild_takes_more_risk_but_keeps_the_rug_checks_and_the_bar():
    assert asdict(WILD.kill) == asdict(MAIN.kill)          # rug checks: word for word the same
    assert asdict(WILD.gates) == asdict(MAIN.gates)        # the scorecard isn't lowered
    assert (WILD.size.fee_pct, WILD.size.slippage_pct) == (MAIN.size.fee_pct, MAIN.size.slippage_pct)
    assert WILD.ready.min_age_minutes < MAIN.ready.min_age_minutes
    assert WILD.ready.min_liquidity_usd < MAIN.ready.min_liquidity_usd
    assert WILD.size.ticket_pct > MAIN.size.ticket_pct and WILD.size.max_open > MAIN.size.max_open
    assert WILD.risk.take_profit_pct > MAIN.risk.take_profit_pct
    assert WILD.judge.use_ai is False                       # never costs anything to run
    assert gates.rulebook_id(WILD, "rules") != gates.rulebook_id(MAIN, "rules")


class Counting(SimMarket):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.calls = {"discover": 0, "snapshot": 0, "safety": 0}

    def discover(self, now):
        self.calls["discover"] += 1
        return super().discover(now)

    def snapshot(self, mints, now):
        self.calls["snapshot"] += len(mints)
        return super().snapshot(mints, now)

    def safety(self, mint, now):
        self.calls["safety"] += 1
        return super().safety(mint, now)


def _step(desks, hours):
    now = T0
    while now < T0 + timedelta(hours=hours):
        for d in desks:
            d.step(now)
        now += timedelta(seconds=5)


def test_two_desks_share_one_feed():
    alone = Counting(T0, seed=3)
    _step([Desk(MAIN, alone, RulesJudge(MAIN.judge), T0)], hours=2)

    market = Counting(T0, seed=3)
    shared = SharedSource(market)
    main_desk = Desk(MAIN, shared, RulesJudge(MAIN.judge), T0)
    wild_desk = Desk(WILD, shared, RulesJudge(WILD.judge), T0, book="wild")
    _step([main_desk, wild_desk], hours=2)

    # The wild desk rides along: one sweep per minute, and barely more lookups than one desk alone.
    assert market.calls["discover"] == alone.calls["discover"]
    assert market.calls["safety"] <= alone.calls["safety"] * 1.3
    assert market.calls["snapshot"] <= alone.calls["snapshot"] * 1.3
    # Same market, different rules: the wild desk trades more, on its own bank.
    assert wild_desk.counts["bought"] > main_desk.counts["bought"]
    assert wild_desk.broker is not main_desk.broker
    assert wild_desk.state(T0)["book"] == "wild" and main_desk.state(T0)["book"] == "main"


def test_a_shared_feed_gives_both_desks_the_same_numbers():
    market = SimMarket(T0, seed=5)
    shared = SharedSource(market)
    now = T0 + timedelta(minutes=40)
    coins = shared.discover(now)
    mints = [c.mint for c in coins[:5]]
    first = shared.snapshot(mints, now)
    again = shared.snapshot(mints, now + timedelta(seconds=3))
    assert {m: c.price for m, c in first.items()} == {m: c.price for m, c in again.items()}
    later = shared.snapshot(mints, now + timedelta(seconds=30))     # stale after a few seconds: fetched again
    assert all(later[m] is not first[m] for m in later)


def test_server_shows_each_book():
    market = SharedSource(SimMarket(T0))
    desks = [Desk(MAIN, market, RulesJudge(MAIN.judge), T0),
             Desk(WILD, market, RulesJudge(WILD.judge), T0, book="wild")]
    runner = Runner(desks, clock=lambda: T0)
    server = make_server(runner, port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        assert json.loads(urllib.request.urlopen(base + "/api/state").read())["book"] == "main"
        assert json.loads(urllib.request.urlopen(base + "/wild/api/state").read())["book"] == "wild"
        page = urllib.request.urlopen(base + "/wild").read().decode()          # redirects to /wild/
        assert "<title>Night Desk</title>" in page
        assert urllib.request.urlopen(base + "/wild/desk.js").status == 200
        for bad in ("/wild/../desk-wild.toml", "/wild/%2e%2e/desk.toml", "/main/api/state", "/other/"):
            with pytest.raises(urllib.error.HTTPError) as err:
                urllib.request.urlopen(base + bad)
            assert err.value.code == 404
    finally:
        server.shutdown()
        server.server_close()


def test_one_broken_desk_doesnt_stop_the_other():
    market = SimMarket(T0)
    good = Desk(MAIN, market, RulesJudge(MAIN.judge), T0)
    bad = Desk(WILD, market, RulesJudge(WILD.judge), T0, book="wild")
    bad.step = lambda now: (_ for _ in ()).throw(RuntimeError("boom"))
    ticks = iter([T0 + timedelta(seconds=15 * i) for i in range(3)] + [T0 + timedelta(minutes=1)] * 100)
    runner = Runner([bad, good], clock=lambda: next(ticks), tick=0.01)
    runner.start()
    runner.stopped.wait(0.2)
    runner.stopped.set()
    runner.join(2)
    assert "boom" in runner.error and any("boom" in n for n in bad.notes)
    assert good.last_poll is not None
    assert json.loads(runner.states["main"])["book"] == "main"


def test_commands_take_a_book(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert main(["report", "--book", "wild"]) == 0
    assert str(tmp_path / "wild" / "live") in capsys.readouterr().out
    assert main(["report", "--book", "nope"]) == 2
    assert "desk-nope.toml" in capsys.readouterr().err
