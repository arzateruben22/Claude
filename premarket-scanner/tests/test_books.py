"""A second set of rules (criteria-wild.toml) graded on its own paper bank, next to the main ones."""
import csv
from dataclasses import asdict

import pytest

from scanner import __main__ as cli
from scanner import config, gates, journal

MAIN = config.load_criteria()
WILD = config.load_criteria(config.book_paths("wild")[0])


def test_book_paths():
    assert config.book_paths("main") == (config.ROOT / "criteria.toml", config.OUTPUT)
    assert config.book_paths("wild") == (config.ROOT / "criteria-wild.toml", config.OUTPUT / "wild")
    for bad in ("nope", "../criteria", "Wild", ""):
        with pytest.raises(ValueError):
            config.book_paths(bad)


def test_wild_rules_take_more_risk_but_pay_more_to_trade_and_face_the_same_bar():
    assert WILD.min_gap_pct < MAIN.min_gap_pct and not WILD.require_catalyst
    assert WILD.target_pct > MAIN.target_pct and WILD.stop_pct > MAIN.stop_pct
    assert WILD.cost_pct >= MAIN.cost_pct                     # looser picks never get cheaper fills
    assert WILD.catalysts == MAIN.catalysts and WILD.warn_tags == MAIN.warn_tags
    main_set = gates.load_settings(config.ROOT / "criteria.toml")
    wild_set = gates.load_settings(config.book_paths("wild")[0])
    assert asdict(wild_set.gates) == asdict(main_set.gates)
    assert gates.rules_id(WILD) != gates.rules_id(MAIN)


def _rows(path):
    with open(path, newline="") as fh:
        return list(csv.DictReader(fh))


def test_scan_and_grade_keep_each_book_apart(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    at = ["--at", "2026-10-06 05:45"]
    assert cli.main(["scan", "--demo", *at]) == 0
    assert cli.main(["scan", "--demo", "--book", "wild", *at]) == 0
    main_rows = _rows(tmp_path / "demo" / "journal.csv")
    wild_rows = _rows(tmp_path / "wild" / "demo" / "journal.csv")
    assert len(wild_rows) > len(main_rows) > 0
    assert {r["rules"] for r in main_rows} == {gates.rules_id(MAIN)}
    assert {r["rules"] for r in wild_rows} == {gates.rules_id(WILD)}
    assert "gap >= +5%" in capsys.readouterr().out

    assert cli.main(["grade", "--demo", "--book", "wild", "--at", "2026-10-07 14:00"]) == 0
    graded = [r for r in _rows(tmp_path / "wild" / "demo" / "journal.csv") if r["graded_at"]]
    assert graded and all(r["sim_exit"] in ("target", "stop", "close") for r in graded)
    assert not any(r["graded_at"] for r in _rows(tmp_path / "demo" / "journal.csv"))   # main untouched
    assert cli.main(["stats", "--demo", "--book", "wild"]) == 0
    out = capsys.readouterr().out
    assert "+20% target / -8% stop" in out and "Fade check:" in out
    assert cli.main(["stats", "--book", "nope"]) == 2


def test_fade_counts_picks_that_closed_below_the_open():
    rows = [{"graded_at": "x", "close_vs_open_pct": v} for v in ("-4", "-1", "3", "")] + [{"graded_at": "", "close_vs_open_pct": "-9"}]
    assert journal.fade(rows) == (2, 3, pytest.approx(-2 / 3))
    assert journal.fade([]) is None and journal.fade_lines([]) == []
    assert "2/3 picks (67%)" in journal.fade_lines(rows)[0]


# -- the fade book: the main book's picks, sold short ------------------------------------------------

import hashlib  # noqa: E402
import json  # noqa: E402
from datetime import datetime, timedelta, timezone  # noqa: E402

from scanner.models import Bar  # noqa: E402

FADE = config.load_criteria(config.book_paths("fade")[0])
QUICK = config.load_criteria(config.book_paths("quick")[0])
EARLY = config.load_criteria(config.book_paths("early")[0])


def test_fade_mirrors_the_main_picks_and_only_changes_the_side_stop_and_cost():
    a, b = asdict(MAIN), asdict(FADE)
    assert sorted(k for k in a if a[k] != b[k]) == ["cost_pct", "side", "stop_pct"]
    assert FADE.side == "short" and FADE.cost_pct > MAIN.cost_pct
    main_set = gates.load_settings(config.ROOT / "criteria.toml")
    assert asdict(gates.load_settings(config.book_paths("fade")[0]).gates) == asdict(main_set.gates)


def test_new_settings_never_restart_the_running_books():
    """Picks are counted by rules fingerprint. These are the ids the live books have been journaling under;
    a new setting at its "off" value must leave them exactly as they are."""
    assert gates.rules_id(MAIN) == "7f4288c6" and gates.rules_id(WILD) == "bc619cd8" and gates.rules_id(FADE) == "2c54912a"
    assert len({gates.rules_id(c) for c in (MAIN, WILD, FADE, QUICK, EARLY)}) == 5


T = datetime(2026, 10, 19, 13, 30, tzinfo=timezone.utc)


def bars(*ohlc):
    return [Bar(T + timedelta(minutes=5 * i), o, h, low, c, 1000) for i, (o, h, low, c) in enumerate(ohlc)]


def test_short_side_wins_when_it_falls_and_pays_for_a_jumped_stop():
    sim = journal.simulate
    assert sim(bars((10, 10.2, 9.5, 9.6), (9.6, 9.7, 8.9, 9.0)), 10, 10, "short") == ("target", 10)
    assert sim(bars((10, 10.5, 9.8, 10.4), (10.4, 11.2, 10.3, 11.0)), 10, 10, "short")[0] == "stop"
    exit_, pnl = sim(bars((10, 10.5, 9.8, 10.4), (13.0, 13.5, 12.8, 13.2)), 10, 10, "short")   # halted, reopened +30%
    assert exit_ == "stop" and pnl == pytest.approx(-30.0)
    assert sim(bars((10, 11.5, 8.5, 9.0)), 10, 10, "short")[0] == "stop"        # touched both: the stop, as for longs
    exit_, pnl = sim(bars((10, 10.3, 9.6, 9.7), (9.7, 9.8, 9.4, 9.5)), 10, 10, "short")
    assert exit_ == "close" and pnl == pytest.approx(5.0)
    assert sim(bars((10, 10.3, 9.6, 9.7), (9.7, 9.8, 9.4, 9.5)), 10, 10) == ("close", pytest.approx(-5.0))  # longs as before


def test_lookback_shorts_the_main_picks_and_says_its_hindsight(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    for d in ("2026-10-05", "2026-10-06"):
        assert cli.main(["scan", "--demo", "--at", f"{d} 05:45"]) == 0
    assert cli.main(["grade", "--demo", "--at", "2026-10-07 14:00"]) == 0
    capsys.readouterr()
    assert cli.main(["lookback", "--book", "fade", "--demo"]) == 0
    out = capsys.readouterr().out
    assert "LOOK-BACK · the fade rules on the main book's" in out and "Hindsight, not evidence" in out
    rows = [r for r in _rows(tmp_path / "demo" / "journal.csv") if r["graded_at"]]
    assert len(rows) >= 4 and f"{len(rows)} graded picks" in out
    assert not (tmp_path / "fade").exists()                              # it only reads: nothing written
    for r in rows:                                                         # a close exit is the long result, mirrored
        if r["sim_exit"] == "close":
            assert f"{-float(r['close_vs_open_pct']) - FADE.cost_pct:+6.1f}%" in out


def test_fade_scans_keep_their_own_journal(tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["scan", "--demo", "--book", "fade", "--at", "2026-10-06 05:45"]) == 0
    rows = _rows(tmp_path / "fade" / "demo" / "journal.csv")
    assert rows and {r["rules"] for r in rows} == {gates.rules_id(FADE)}
    assert cli.main(["grade", "--demo", "--book", "fade", "--at", "2026-10-07 14:00"]) == 0
    graded = [r for r in _rows(tmp_path / "fade" / "demo" / "journal.csv") if r["graded_at"]]
    for r in graded:
        if r["sim_exit"] == "close":
            assert float(r["sim_pnl_pct"]) == pytest.approx(-float(r["close_vs_open_pct"]) - FADE.cost_pct, abs=0.02)


# -- the quick and early books: the main picks, out sooner ------------------------------------------

from pathlib import Path  # noqa: E402

from scanner.market import ET  # noqa: E402


def test_quick_and_early_change_only_how_the_main_picks_are_sold():
    a = asdict(MAIN)
    assert sorted(k for k in a if a[k] != asdict(QUICK)[k]) == ["stop_pct", "target_pct"]
    assert sorted(k for k in a if a[k] != asdict(EARLY)[k]) == ["exit_by"]
    assert QUICK.target_pct < MAIN.target_pct and QUICK.stop_pct < MAIN.stop_pct
    assert EARLY.exit_by == "10:30" and "out by 10:30 ET" in EARLY.summary()
    for bad in ("10:32", "08:00", "noon", "16:05"):
        with pytest.raises(ValueError, match="exit_by"):
            config.load_criteria(_toml(f'[paper]\nexit_by = "{bad}"\n'))


def _toml(text):
    import tempfile
    f = tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False)
    f.write(text)
    f.close()
    return Path(f.name)


def day_bars(path):
    """A trading day of 5-minute bars following `path`: (ET hh:mm, open, high, low, close)."""
    return [Bar(datetime(2026, 10, 19, int(hm[:2]), int(hm[3:]), tzinfo=ET), o, h, low, c, 1000)
            for hm, o, h, low, c in path]


def test_exit_by_closes_whatever_is_still_open_at_that_time():
    sim = journal.simulate
    slow = day_bars([("09:30", 10, 10.2, 9.9, 10.1), ("10:00", 10.1, 10.3, 10.0, 10.2), ("10:25", 10.2, 10.4, 10.1, 10.3),
                     ("10:30", 10.3, 11.5, 10.2, 11.2), ("15:55", 11.2, 11.3, 11.0, 11.1)])
    assert sim(slow, 10, 5) == ("target", 10)                                   # the main book waits for +10%
    assert sim(slow, 10, 5, exit_by="10:30") == ("timed", pytest.approx(3.0))   # early: out at the 10:25 bar's close
    fast = day_bars([("09:30", 10, 10.2, 9.9, 10.1), ("09:45", 10.1, 11.2, 10.0, 11.1)])
    assert sim(fast, 10, 5, exit_by="10:30") == ("target", 10)                  # a quick winner is still a target
    assert sim(fast, 10, 5, exit_by="09:35") == ("timed", pytest.approx(1.0))   # nothing before 09:35: out at the first bar
    assert sim(slow, 10, 5, exit_by="16:00") == ("target", 10)                  # 16:00 is the normal close


def test_early_book_grades_with_the_timed_exit(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    for book in ("quick", "early"):
        assert cli.main(["scan", "--demo", "--book", book, "--at", "2026-10-06 05:45"]) == 0
        assert cli.main(["grade", "--demo", "--book", book, "--at", "2026-10-07 14:00"]) == 0
        rows = [r for r in _rows(tmp_path / book / "demo" / "journal.csv") if r["graded_at"]]
        assert rows and {r["rules"] for r in rows} == {gates.rules_id(QUICK if book == "quick" else EARLY)}
        assert all(r["sim_exit"] in ("target", "stop", "close", "timed") for r in rows)
    capsys.readouterr()
    assert cli.main(["stats", "--demo", "--book", "early"]) == 0
    assert "the 10:30 ET exit" in capsys.readouterr().out


# -- ten books on one market read -----------------------------------------------------------------------

from datetime import datetime as _dt  # noqa: E402
from zoneinfo import ZoneInfo  # noqa: E402

from scanner import engine  # noqa: E402
from scanner.providers import make_provider  # noqa: E402


def _picks(result):
    return [(c.symbol, tuple(c.failures), tuple(c.warnings), tuple(c.tags), c.float_shares, c.halted_now) for c in result.passed]


def test_all_books_lists_every_criteria_file_main_first():
    books = cli.all_books()
    assert books[0] == "main" and set(books) >= {"wild", "fade", "quick", "early", "bigcap", "tight", "hold", "cheap", "highvol"}
    assert len(books) == 10 and len({gates.rules_id(config.load_criteria(config.book_paths(b)[0])) for b in books}) == 10


def test_run_scans_gives_each_book_exactly_what_it_gets_on_its_own():
    provider = make_provider("demo")
    now = _dt(2026, 10, 6, 5, 45, tzinfo=ZoneInfo("America/Los_Angeles"))
    crits = {b: config.load_criteria(config.book_paths(b)[0]) for b in cli.all_books()}
    together = engine.run_scans(provider, crits, now, "premarket")
    assert set(together) == set(crits)
    for b, crit in crits.items():
        alone = engine.run_scan(provider, crit, now, "premarket")
        assert _picks(together[b]) == _picks(alone), b
        assert [c.symbol for c in together[b].near_misses] == [c.symbol for c in alone.near_misses], b
        assert together[b].checked == alone.checked and together[b].universe == alone.universe
    assert len(together["wild"].passed) > len(together["main"].passed)          # each book kept its own rules
    assert _picks(together["fade"]) == _picks(together["main"])                  # the same picks, the other side
    # a candidate object is never shared between books: one book's verdict can't leak into another's
    ids = [id(c) for r in together.values() for c in r.passed + r.near_misses]
    assert len(ids) == len(set(ids))


def test_scan_grade_and_nightly_take_every_book_at_once(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["scan", "--demo", "--books", "all", "--at", "2026-10-06 05:45"]) == 0
    out = capsys.readouterr().out
    assert "== wild rules ==" in out and "== highvol rules ==" in out
    for b in cli.all_books():
        rows = _rows(tmp_path / ("demo" if b == "main" else f"{b}/demo") / "journal.csv")
        assert rows and {r["rules"] for r in rows} == {gates.rules_id(config.load_criteria(config.book_paths(b)[0]))}, b
    assert cli.main(["grade", "--demo", "--books", "all", "--at", "2026-10-07 14:00"]) == 0
    for b in ("main", "cheap"):
        rows = _rows(tmp_path / ("demo" if b == "main" else f"{b}/demo") / "journal.csv")
        assert all(r["graded_at"] for r in rows), b
    assert cli.main(["scan", "--demo", "--books", "main,hold", "--at", "2026-10-07 05:45"]) == 0
    assert cli.main(["scan", "--demo", "--books", "main,nope", "--at", "2026-10-07 05:45"]) == 2


def test_one_books_bad_journal_never_stops_the_others(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["scan", "--demo", "--books", "main,wild,hold", "--at", "2026-10-06 05:45"]) == 0
    bad = tmp_path / "wild" / "demo" / "journal.csv"
    bad.write_text("not,a,journal\n1,2\n")                        # the wild journal is corrupt
    assert cli.main(["grade", "--demo", "--books", "main,wild,hold", "--at", "2026-10-07 14:00"]) == 1
    out, err = capsys.readouterr()
    assert "wild: couldn't grade" in err and "the other books carry on" in err
    assert "main: Graded" in out and "hold: Graded" in out           # graded before and after the broken one
    assert all(r["graded_at"] for r in _rows(tmp_path / "hold" / "demo" / "journal.csv"))
    # a book whose folder can't be written loses only its own picks
    (tmp_path / "hold" / "demo" / "watchlists").mkdir(parents=True, exist_ok=True)
    blocker = tmp_path / "hold" / "demo" / "journal.csv"
    blocker.unlink(); blocker.mkdir()                                 # a folder where the journal should be
    assert cli.main(["scan", "--demo", "--books", "main,hold", "--at", "2026-10-07 05:45"]) == 1
    out, err = capsys.readouterr()
    assert "hold: couldn't save" in err and "== main rules ==" in out
    assert len(_rows(tmp_path / "demo" / "journal.csv")) > 4           # main still journaled its new day
