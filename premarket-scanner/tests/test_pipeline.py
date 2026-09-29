"""End-to-end on the offline demo provider: scan -> files -> journal -> grade."""
from datetime import date

from scanner import journal, report
from scanner.config import load_criteria
from scanner.engine import run_scan
from scanner.market import parse_pt
from scanner.models import Bar
from scanner.providers.demo import DemoProvider

from helpers import et

CRIT = load_criteria()


def _scan(at="2026-09-28 05:45", session="premarket"):
    return run_scan(DemoProvider(), CRIT, parse_pt(at), session)


def test_demo_premarket_scan():
    res = _scan()
    assert [c.symbol for c in res.passed] == ["DMBIO", "DMAI", "DMEV", "DMFRT"]
    misses = {c.symbol: c.failures[0].split()[0] for c in res.near_misses}
    assert misses == {"DMRX": "price", "DMSHP": "no", "DMGLD": "float", "DMCHP": "RVOL", "DMSOL": "gap"}
    frt = res.passed[-1]
    assert "dilution headline" in frt.warnings
    assert res.universe > 30 and res.checked == 9


def test_demo_evening_scan_measures_from_todays_close():
    res = _scan("2026-09-28 17:00", "afterhours")
    assert [c.symbol for c in res.passed] == ["DMBIO", "DMAI", "DMEV", "DMFRT"]
    assert all(c.metrics.ref_close > 0 for c in res.passed)


def test_reports_and_journal_round_trip(tmp_path):
    res = _scan()
    paths = report.write_outputs(res, CRIT, tmp_path)
    md = paths[0].read_text()
    assert "| 1 | DMBIO |" in md and "DEMO DATA" in md and "Near misses" in md
    assert paths[1].read_text().count("\n") == 1 + len(res.passed)

    jpath = tmp_path / "journal.csv"
    assert journal.record(res, jpath) == 4
    assert journal.record(_scan("2026-09-28 06:05"), jpath) == 0      # no duplicates on rescans

    before_close = journal.grade(DemoProvider(), CRIT, parse_pt("2026-09-28 12:00"), jpath)
    assert before_close == (0, 4)
    graded, pending = journal.grade(DemoProvider(), CRIT, parse_pt("2026-09-28 14:00"), jpath)
    assert (graded, pending) == (4, 0)
    assert "4 graded picks" in journal.stats(CRIT, jpath)


def test_simulator_is_pessimistic_when_one_bar_hits_both():
    d = date(2026, 9, 29)
    bar = Bar(et(d, 9, 30), 10.0, 11.5, 9.0, 10.0, 1)
    assert journal.simulate([bar], 10, 5) == ("stop", -5)
    up = [Bar(et(d, 9, 30), 10.0, 10.4, 9.8, 10.3, 1), Bar(et(d, 9, 35), 10.3, 11.2, 10.2, 11.0, 1)]
    assert journal.simulate(up, 10, 5) == ("target", 10)
    flat = [Bar(et(d, 9, 30), 10.0, 10.2, 9.9, 10.1, 1)]
    assert journal.simulate(flat, 10, 5)[0] == "close"
