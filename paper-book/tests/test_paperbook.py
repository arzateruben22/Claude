import csv
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import paperbook as pb  # noqa: E402

NOW = datetime(2026, 10, 8, 20, 0, tzinfo=timezone.utc)


def write_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, list(rows[0]))
        w.writeheader()
        w.writerows(rows)


@pytest.fixture
def desks(tmp_path):
    coins = tmp_path / "night-desk" / "output" / "live"
    write_csv(coins / "trades.csv", [
        {"opened": "2026-10-07T10:00:00+00:00", "closed": "2026-10-07T11:00:00+00:00", "symbol": "WIF2",
         "pnl": "30.00", "pnl_pct": "30.0", "exit": "target: +30%"},
        {"opened": "2026-10-07T12:00:00+00:00", "closed": "2026-10-07T12:30:00+00:00", "symbol": "<b>RUG</b>",
         "pnl": "-20.00", "pnl_pct": "-20.0", "exit": "stop: -20%"},
    ])
    (coins / "state.json").write_text(json.dumps({"positions": [
        {"mint": "m1", "symbol": "HOLD", "opened_at": "2026-10-08T18:00:00+00:00", "qty": 1000, "cost": 50.0,
         "last_price": 0.06}]}))
    journal = tmp_path / "premarket-scanner" / "output" / "journal.csv"
    write_csv(journal, [
        {"scan_date": "2026-10-06", "trade_date": "2026-10-06", "symbol": "ABCD", "sim_pnl_pct": "9.5", "sim_exit": "target"},
        {"scan_date": "2026-10-07", "trade_date": "2026-10-07", "symbol": "EFGH", "sim_pnl_pct": "-5.5", "sim_exit": "stop"},
        {"scan_date": "2026-10-08", "trade_date": "2026-10-09", "symbol": "IJKL", "sim_pnl_pct": "", "sim_exit": ""},
    ])
    cfg = {"coins": {"folder": str(coins), "demo_folder": str(coins), "start_bank": 1000.0},
           "stocks": {"journal": str(journal), "demo_journal": str(journal), "start_bank": 1000.0, "ticket_usd": 100.0},
           "report": {"timezone": "America/Los_Angeles"}}
    return cfg


def test_reads_both_desks(desks):
    book = pb.load(desks, demo=False, now=NOW)
    assert [t.pnl for t in book.trades["coins"]] == [30.0, -20.0]
    assert [t.pnl for t in book.trades["stocks"]] == [9.5, -5.5]          # $100 a pick
    assert book.trades["coins"][0].exit == "target"
    [coin] = book.held["coins"]
    assert coin.value == pytest.approx(60.0) and book.unrealized == pytest.approx(10.0)
    [pick] = book.held["stocks"]
    assert pick.symbol == "IJKL" and pick.value is None


def test_the_numbers():
    t = lambda pnl, h: pb.Trade("coins", "X", NOW, NOW + timedelta(hours=h), pnl, 0.0, "x")
    s = pb.stats([t(100, 1), t(-50, 2), t(-100, 3), t(30, 4)], 1000.0)
    assert s["net"] == -20 and s["trades"] == 4 and s["win_rate"] == 50.0
    assert s["profit_factor"] == pytest.approx(130 / 150, abs=0.01)
    assert s["max_drawdown_pct"] == pytest.approx(150 / 1100 * 100, abs=0.1)     # from $1,100 down to $950
    assert pb.stats([], 1000.0)["profit_factor"] is None


def test_days_follow_the_report_time_zone():
    late = datetime(2026, 10, 8, 5, 0, tzinfo=timezone.utc)                      # 10pm on the 7th in LA
    days = pb.daily([pb.Trade("coins", "X", late, late, 5.0, 0, "x")], ZoneInfo("America/Los_Angeles"))
    assert list(days) == [datetime(2026, 10, 7).date()]


def test_build_writes_the_ledger_and_a_safe_page(desks, tmp_path):
    out = tmp_path / "out"
    book = pb.build(desks, False, out, now=NOW)
    rows = list(csv.DictReader(open(out / "ledger.csv")))
    assert len(rows) == 4 and {r["desk"] for r in rows} == {"coins", "stocks"}
    page = (out / "paper-book.html").read_text()
    assert page.startswith("<!doctype html>") and "<title>Paper Book</title>" in page
    assert "<b>RUG</b>" not in page and "&lt;b&gt;RUG" in page                  # coin names are escaped
    assert "DEMO" not in page
    text = pb.render_text(book)
    assert "net" in text and "far too few" in text


def test_nothing_yet(tmp_path):
    cfg = {"coins": {"folder": str(tmp_path / "none"), "demo_folder": "", "start_bank": 1000.0},
           "stocks": {"journal": str(tmp_path / "none.csv"), "demo_journal": "", "start_bank": 1000.0, "ticket_usd": 100.0},
           "report": {"timezone": "America/Los_Angeles"}}
    book = pb.build(cfg, False, tmp_path / "out", now=NOW)
    assert "No closed paper trades yet" in pb.render_text(book)
    assert "No closed paper trades yet" in (tmp_path / "out" / "paper-book.html").read_text()


def test_demo_is_labelled(desks, tmp_path):
    pb.build(desks, True, tmp_path / "out", now=NOW)
    assert "DEMO MARKETS" in (tmp_path / "out" / "paper-book.html").read_text()
