"""Later entries: buy at 10:00 only if the gap held, or on a break of the opening range. Only bars that have
already happened decide an entry, and a pick that never triggers is no trade at all."""
from datetime import datetime, timedelta, timezone

import pytest

from scanner import __main__ as cli
from scanner import config, gates, journal
from scanner.models import Bar

T = datetime(2026, 10, 19, 13, 30, tzinfo=timezone.utc)          # 9:30 New York time
sim, NO = journal.simulate, journal.NO_ENTRY


def bars(*ohlc):
    return [Bar(T + timedelta(minutes=5 * i), o, h, low, c, 1000) for i, (o, h, low, c) in enumerate(ohlc)]


def flat(n, p=10.0):
    return [(p, p + 0.05, p - 0.05, p)] * n


def test_confirm_buys_at_ten_only_if_the_gap_held():
    # 9:30 opens at 10, dips 10% at 9:40 (which would have stopped a 9:30 buyer), is back above 10 at 10:00
    day = bars((10, 10.1, 9.9, 10), (10, 10, 9.5, 9.6), (9.6, 9.6, 9.0, 9.2), *flat(3, 9.8),
               (10.5, 10.6, 10.4, 10.5), (10.5, 11.6, 10.5, 11.5))
    assert sim(day, 10, 5) == ("stop", -5)                                       # the 9:30 buyer is shaken out
    assert sim(day, 10, 5, entry="confirm", entry_at="10:00") == ("target", 10)   # bought 10.5 at 10:00, +10%
    faded = bars((10, 10.1, 9.9, 10), *flat(5, 9.8), (9.8, 9.9, 9.7, 9.8), (9.8, 12, 9.7, 11))
    assert sim(faded, 10, 5, entry="confirm", entry_at="10:00") == (NO, None)    # below its open at 10:00: never bought
    assert sim(bars(*flat(4)), 10, 5, entry="confirm", entry_at="10:00") == (NO, None)   # halted, no 10:00 bar


def test_opening_range_breakout_uses_the_range_low_as_its_stop():
    rng = [(10, 10.4, 9.9, 10.2), (10.2, 10.3, 9.7, 9.8), (9.8, 10.1, 9.8, 10.0)]        # 9:30-9:45: high 10.4, low 9.7
    up = bars(*rng, (10.0, 10.3, 9.9, 10.2), (10.2, 10.6, 10.1, 10.5), (10.5, 11.5, 10.4, 11.4))
    assert sim(up, 10, 8, entry="orb", entry_at="11:00", range_minutes=15) == ("target", 10)   # in at 10.4, out 11.44
    stopped = bars(*rng, (10.2, 10.6, 10.1, 10.5), (10.5, 10.5, 9.6, 9.7))
    exit_, pnl = sim(stopped, 10, 8, entry="orb", entry_at="11:00", range_minutes=15)
    assert exit_ == "stop" and pnl == pytest.approx((9.7 / 10.4 - 1) * 100)               # the range low, not -8%
    gapped = bars(*rng, (10.2, 10.6, 10.1, 10.5), (9.0, 9.1, 8.8, 9.0))                    # reopens below the stop
    assert sim(gapped, 10, 8, entry="orb", range_minutes=15)[1] == pytest.approx((9.0 / 10.4 - 1) * 100)
    opens_above = bars(*rng, (10.8, 11.0, 10.7, 10.9), *flat(1, 10.9))                      # gaps over the range high
    assert sim(opens_above, 10, 8, entry="orb", range_minutes=15) == ("close", pytest.approx((10.9 / 10.8 - 1) * 100))
    wide = bars((10, 12, 9, 11), (11, 11.5, 10.5, 11), (11, 11.2, 10.8, 11), (11, 12.1, 11, 12), (12, 12, 10.9, 11))
    assert sim(wide, 10, 8, entry="orb", range_minutes=15)[1] == pytest.approx(-8)          # 8% is closer than the range low
    late = bars(*rng, *flat(16, 10.0), (10.2, 10.9, 10.2, 10.8))                           # breaks out at 11:05
    assert sim(late, 10, 8, entry="orb", entry_at="11:00", range_minutes=15) == (NO, None)


def test_a_short_waits_for_the_gap_to_fail():
    day = bars((10, 10.2, 9.9, 10), *flat(5, 9.7), (9.5, 9.5, 9.4, 9.4), (9.4, 9.4, 8.5, 8.6))
    assert sim(day, 10, 8, "short", entry="confirm", entry_at="10:00") == ("target", 10)    # short 9.5, cover 8.55
    running = bars((10, 10.2, 9.9, 10), *flat(5, 10.6), (10.8, 11, 10.7, 10.9))
    assert sim(running, 10, 8, "short", entry="confirm", entry_at="10:00") == (NO, None)    # still above the open


def test_a_long_stop_jumped_by_a_gap_fills_where_it_reopens():
    day = bars((10, 10.2, 9.8, 9.9), (9.0, 9.1, 8.8, 9.0))
    assert sim(day, 10, 5) == ("stop", pytest.approx(-10))                                  # not the -5 it hoped for
    assert sim(bars((10, 10.2, 9.4, 9.6)), 10, 5) == ("stop", -5)


def test_a_pick_that_never_triggers_is_graded_but_not_a_trade(tmp_path):
    crit = config.load_criteria(config.book_paths("confirm")[0])
    faded = bars((10, 10.1, 9.9, 10), *flat(5, 9.8), (9.8, 9.9, 9.7, 9.8))
    res = journal.outcome(faded, T.date(), 9.5, crit)
    assert res["sim_exit"] == NO and res["sim_pnl_pct"] == "" and res["close_vs_open_pct"] == -2.0
    assert not journal.traded({**res, "graded_at": "x"}) and journal.traded({"graded_at": "x", "sim_pnl_pct": "1.5"})
    path = tmp_path / "journal.csv"
    rows = [{**{k: "" for k in journal.FIELDS}, "trade_date": "2026-10-19", "scan_date": "2026-10-19",
             "scan_time_pt": "05:45", "session": "premarket", "symbol": s, "gap_pct": "12", "open_vs_scan_pct": "1",
             "max_up_pct": "3", "tags": "", "graded_at": "2026-10-19 16:30", **extra}
            for s, extra in (("AAA", {"sim_exit": "target", "sim_pnl_pct": "9.5"}),
                             ("BBB", {"sim_exit": NO, "sim_pnl_pct": ""}))]
    journal._write(path, rows)
    text = journal.stats(crit, path)
    assert "1 graded picks over 1 trade days" in text and "1 more never triggered an entry" in text
    assert "Sim: buy at the 10:00 ET, only if still above the 9:30 open" in text
    assert "no entry" in journal.recent(path)


def test_new_books_load_with_their_own_ids_and_leave_the_old_ones_alone():
    ids = {b: gates.rules_id(config.load_criteria(config.book_paths(b)[0])) for b in ("main", "confirm", "orb", "orb5", "failed")}
    assert ids["main"] == "7f4288c6" and len(set(ids.values())) == 5
    for bad in ({"entry": "later"}, {"entry_at": "10:03"}, {"entry_at": "09:30"}, {"range_minutes": 7},
                {"entry": "orb", "range_minutes": 30, "entry_at": "10:00"}, {"entry": "confirm", "exit_by": "09:55"}):
        with pytest.raises(ValueError):
            config.check(config.Criteria(**bad))
    assert config.check(config.Criteria(entry="orb", range_minutes=30, entry_at="10:05")).entry == "orb"


def test_each_new_book_backtests_on_the_demo(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    for b in ("confirm", "orb", "orb5", "failed"):
        assert cli.main(["backtest", "--demo", "--from", "2026-09-01", "--to", "2026-09-30", "--book", b]) == 0
        out = capsys.readouterr().out
        assert "Sum of sim returns" in out or "none of which triggered" in out, b
        assert (tmp_path / b / "demo" / "backtests").exists()
