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
