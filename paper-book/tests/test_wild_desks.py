"""The wild desks (riskier copies of the memecoin and stock desks) in the book, the crawler and the galaxy."""
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import crawler  # noqa: E402
import galaxy  # noqa: E402
import paperbook as pb  # noqa: E402

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

NOW = datetime(2026, 10, 14, 20, 0, tzinfo=timezone.utc)
HERE = Path(__file__).resolve().parent.parent


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def coin_trades(folder, *pnls):
    write_csv(folder / "trades.csv", [
        {"opened": f"2026-10-1{i}T10:00:00+00:00", "closed": f"2026-10-1{i}T11:00:00+00:00", "symbol": f"C{i}",
         "pnl": f"{p:.2f}", "pnl_pct": f"{p:.1f}", "exit": "target" if p > 0 else "stop"} for i, p in enumerate(pnls)])


def picks(path, *pcts):
    write_csv(path, [{"scan_date": f"2026-10-0{i + 5}", "trade_date": f"2026-10-0{i + 5}", "symbol": f"S{i}",
                      "sim_pnl_pct": str(p), "sim_exit": "target" if p > 0 else "stop"} for i, p in enumerate(pcts)])


@pytest.fixture
def cfg(tmp_path):
    out = {"report": {"timezone": "America/Los_Angeles"}}
    for d, pnls in (("memecoins", (5.0,)), ("majors", (2.0,)), ("memecoins_wild", (40.0, -25.0, 30.0))):
        folder = tmp_path / d
        coin_trades(folder, *pnls)
        out[d] = {"folder": str(folder), "demo_folder": str(folder), "start_bank": 100.0}
    for d, pcts in (("stocks", (9.5,)), ("stocks_wild", (19.25, -8.75))):
        journal = tmp_path / d / "journal.csv"
        picks(journal, *pcts)
        out[d] = {"journal": str(journal), "demo_journal": str(journal), "start_bank": 100.0, "ticket_usd": 100.0,
                  "share_bank": True}
    return out


def test_all_five_desks_load_on_their_own_banks(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    assert book.desks == pb.DESKS and book.bank_total == 500.0
    assert [t.pnl for t in book.trades["memecoins_wild"]] == [40.0, -25.0, 30.0]
    assert {t.desk for t in book.trades["stocks_wild"]} == {"stocks_wild"}
    assert book.stock_rules["stocks_wild"] == (20.0, 8.0, 0.75)          # its own rules, read from criteria-wild.toml
    assert book.stock_rules["stocks"] == (10.0, 5.0, 0.5)
    text = pb.render_text(book)
    assert "wild memecoins" in text and "wild stocks" in text and "of $500" in text


def test_a_desk_without_a_section_is_left_out(cfg):
    del cfg["stocks_wild"], cfg["memecoins_wild"]
    book = pb.load(cfg, demo=False, now=NOW)
    assert book.desks == ("memecoins", "majors", "stocks") and book.bank_total == 300.0


def test_the_page_shows_the_wild_desks(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    page = pb.render_html(book)
    assert "Wild memecoins" in page and "Wild stocks" in page and 'class="k-memecoins_wild"' in page
    assert 'class="l-stocks_wild"' in page                              # its own line on the chart
    assert "+20% , −8%" not in page and "+20%, −8%" in page              # wild stocks' own exits in the notes
    assert 'style="--cols:4"' in page and "wide-first" in page           # 7 tiles fill two rows of four


def test_crawler_and_galaxy_get_a_cluster_each(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    d = crawler.data(book)
    assert [s["key"] for s in d["sections"]] == list(pb.DESKS) + ["open", "patterns"]
    assert all(s["color"].startswith("#") for s in d["sections"])
    g = galaxy.data(book)
    assert [x["key"] for x in g["desks"]] == list(pb.DESKS)
    shared = {p["id"] for p in g["patterns"] if p["desk"] == "*"}
    # each pair of markets, plus each wild desk against the desk it copies; not every pair of five
    assert shared == {"memecoins+majors", "memecoins+stocks", "majors+stocks",
                      "memecoins+memecoins_wild", "stocks+stocks_wild"}
    blob = json.dumps(d)
    assert "WMEM" in blob or "WSTK" in blob


def test_book_toml_lists_the_wild_desks_with_their_own_banks():
    with open(HERE / "book.toml", "rb") as fh:
        cfg = tomllib.load(fh)
    with open(HERE.parent / "night-desk" / "desk-wild.toml", "rb") as fh:
        assert cfg["memecoins_wild"]["start_bank"] == tomllib.load(fh)["desk"]["start_bank"]
    assert cfg["memecoins_wild"]["folder"].endswith("night-desk/output/wild/live")
    assert cfg["stocks_wild"]["journal"].endswith("premarket-scanner/output/wild/journal.csv")
    assert (HERE / cfg["stocks_wild"]["rules"]).resolve() == (HERE.parent / "premarket-scanner" / "criteria-wild.toml")
