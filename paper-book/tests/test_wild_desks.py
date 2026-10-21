"""The wild and fade desks (copies of the memecoin and stock desks) in the book, the crawler and the galaxy."""
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
    for d, pnls in (("memecoins", (5.0,)), ("majors", (2.0,)), ("memecoins_wild", (40.0, -25.0, 30.0)),
                    ("memecoins_strict", (6.0, -3.0)), ("majors_4h", (4.0,))):
        folder = tmp_path / d
        coin_trades(folder, *pnls)
        out[d] = {"folder": str(folder), "demo_folder": str(folder), "start_bank": 100.0}
    for d, pcts in (("stocks", (9.5,)), ("stocks_wild", (19.25, -8.75)), ("stocks_fade", (-11.0, 4.0)),
                    ("stocks_quick", (4.5, -3.5)), ("stocks_early", (2.0,))):
        journal = tmp_path / d / "journal.csv"
        picks(journal, *pcts)
        out[d] = {"journal": str(journal), "demo_journal": str(journal), "start_bank": 100.0, "ticket_usd": 100.0,
                  "share_bank": True}
    return out


def test_every_desk_loads_on_its_own_bank(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    assert book.desks == pb.DESKS and book.bank_total == 1000.0 and len(pb.DESKS) == 10
    assert [t.pnl for t in book.trades["memecoins_wild"]] == [40.0, -25.0, 30.0]
    assert {t.desk for t in book.trades["stocks_wild"]} == {"stocks_wild"}
    assert book.stock_rules["stocks_wild"] == (20.0, 8.0, 0.75)          # its own rules, read from criteria-wild.toml
    assert book.stock_rules["stocks"] == (10.0, 5.0, 0.5)
    assert book.stock_rules["stocks_fade"] == (10.0, 10.0, 1.0)          # the fade book's own rules too
    assert book.stock_rules["stocks_quick"] == (5.0, 3.0, 0.5) and book.stock_exit == {
        "stocks": "", "stocks_wild": "", "stocks_fade": "", "stocks_quick": "", "stocks_early": "10:30"}
    assert all(t.symbol.startswith("$") for t in book.trades["memecoins_strict"])
    assert not any(t.symbol.startswith("$") for t in book.trades["majors_4h"])     # big coins have no $ prefix
    text = pb.render_text(book)
    for word in ("wild memecoins", "strict memecoins", "big coins 4h", "fade stocks", "quick stocks", "early-out stocks"):
        assert word in text
    assert "of $1,000" in text


def test_a_desk_without_a_section_is_left_out(cfg):
    for d in pb.DESKS:
        if "_" in d:
            del cfg[d]
    book = pb.load(cfg, demo=False, now=NOW)
    assert book.desks == ("memecoins", "majors", "stocks") and book.bank_total == 300.0


def test_the_page_shows_the_wild_desks(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    page = pb.render_html(book)
    assert "Wild memecoins" in page and "Wild stocks" in page and 'class="k-memecoins_wild"' in page
    assert 'class="l-stocks_wild"' in page                              # its own line on the chart
    assert "+20% , −8%" not in page and "+20%, −8%" in page              # wild stocks' own exits in the notes
    assert "Fade stocks" in page and "sold short" in page and 'class="l-stocks_fade"' in page
    assert "Early-out stocks" in page and "by 10:30 ET" in page and 'class="l-stocks_early"' in page
    assert "Big coins 4h" in page and "4-hour candle" in page and "Strict memecoins" in page
    assert '<div class="tiles many fill-last" style="--cols:7">' in page   # 12 tiles: first and last take two cells
    del cfg["stocks_fade"]
    page = pb.render_html(pb.load(cfg, demo=False, now=NOW))
    assert '<div class="tiles many" style="--cols:6">' in page            # 11: the first tile takes two cells
    for d in ("stocks_early", "stocks_quick", "majors_4h", "memecoins_strict"):
        del cfg[d]
    page = pb.render_html(pb.load(cfg, demo=False, now=NOW))
    assert '<div class="tiles wide-first" style="--cols:4">' in page      # 7, as before


def test_crawler_and_galaxy_get_a_cluster_each(cfg):
    book = pb.load(cfg, demo=False, now=NOW)
    d = crawler.data(book)
    assert [s["key"] for s in d["sections"]] == list(pb.DESKS) + ["open", "patterns"]
    assert all(s["color"].startswith("#") for s in d["sections"])
    g = galaxy.data(book)
    assert [x["key"] for x in g["desks"]] == list(pb.DESKS)
    shared = {p["id"] for p in g["patterns"] if p["desk"] == "*"}
    # each pair of markets, plus each copy against the desk it copies; not every pair of ten
    assert shared == {"memecoins+majors", "memecoins+stocks", "majors+stocks",
                      "memecoins+memecoins_wild", "memecoins+memecoins_strict", "majors+majors_4h",
                      "stocks+stocks_wild", "stocks+stocks_fade", "stocks+stocks_quick", "stocks+stocks_early"}
    assert len({s["color"] for s in d["sections"]}) == len(d["sections"])    # every cluster its own colour
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
    assert cfg["stocks_fade"]["journal"].endswith("premarket-scanner/output/fade/journal.csv")
    assert (HERE / cfg["stocks_fade"]["rules"]).resolve() == (HERE.parent / "premarket-scanner" / "criteria-fade.toml")
    for d in pb.DESKS:
        assert d in cfg and cfg[d]["start_bank"] == 100.0, d
    assert cfg["memecoins_strict"]["folder"].endswith("night-desk/output/strict/live")
    assert cfg["majors_4h"]["folder"].endswith("majors-desk/output/4h/live")
    assert cfg["stocks_early"]["journal"].endswith("premarket-scanner/output/early/journal.csv")
