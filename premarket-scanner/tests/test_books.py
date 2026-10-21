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


def test_fade_mirrors_the_main_picks_and_only_changes_the_side_stop_and_cost():
    a, b = asdict(MAIN), asdict(FADE)
    assert sorted(k for k in a if a[k] != b[k]) == ["cost_pct", "side", "stop_pct"]
    assert FADE.side == "short" and FADE.cost_pct > MAIN.cost_pct
    main_set = gates.load_settings(config.ROOT / "criteria.toml")
    assert asdict(gates.load_settings(config.book_paths("fade")[0]).gates) == asdict(main_set.gates)


def test_adding_side_left_the_long_books_fingerprints_alone():
    """Picks are counted by rules fingerprint: a new setting must not quietly restart the main or wild tests."""
    def before(crit):     # rules_id as it was before `side` existed
        data = {k: v for k, v in asdict(crit).items() if k not in gates.DISPLAY_ONLY and k != "side"}
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8]
    assert gates.rules_id(MAIN) == before(MAIN) and gates.rules_id(WILD) == before(WILD)
    assert gates.rules_id(FADE) != gates.rules_id(MAIN)


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
