"""The proving ground: each running rulebook's history test, graded by one stated rule."""
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import paperbook as pb  # noqa: E402
import proving  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 22, 3, 0, tzinfo=timezone.utc)


def coin_test(folder, quarters, pnls, hold=-40.0, demo=False, age=0):
    folder.mkdir(parents=True)
    (folder / "periods.json").write_text(json.dumps({
        "first": "2022-10-22T00:00:00+00:00", "last": "2026-10-22T00:00:00+00:00", "hold_pct": hold, "demo": demo,
        "quarters": [{"period": q, "desk_pct": v, "hold_pct": -5.0} for q, v in quarters]}))
    with open(folder / "trades.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, ["pnl"])
        w.writeheader()
        w.writerows({"pnl": p} for p in pnls)
    (folder / "summary.md").write_text("done\n")
    if age:
        os.utime(folder / "summary.md", (time.time() - age, time.time() - age))


def stock_test(folder, months):
    folder.mkdir(parents=True)
    rows = []
    for month, pcts, untriggered in months:
        for i, p in enumerate(pcts):
            rows.append({"trade_date": f"{month}-{i % 28 + 1:02d}", "graded_at": "x", "sim_pnl_pct": str(p)})
        rows += [{"trade_date": f"{month}-01", "graded_at": "x", "sim_pnl_pct": ""}] * untriggered
    with open(folder / "journal.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, ["trade_date", "graded_at", "sim_pnl_pct"])
        w.writeheader()
        w.writerows(rows)
    (folder / "summary.md").write_text("done\n")


def book(tmp_path, desks):
    meta = {d: pb.desk_meta(d, {"label": d.replace("_", " "), "market": m, "kind": "stocks" if m == "stocks" else "coins"})
            for d, m in desks.items()}
    return pb.Book({d: [] for d in desks}, {d: [] for d in desks}, {d: 100.0 for d in desks}, {}, False, NOW, LA,
                   meta=meta, order=tuple(desks), results={d: tmp_path / d for d in desks})


def test_each_rulebook_is_graded_by_the_stated_rule(tmp_path):
    q = [f"{y} Q{n}" for y in (2023, 2024) for n in (1, 2, 3, 4)]
    coin_test(tmp_path / "majors_good" / "backtests" / "2022_2026", zip(q, [3, 2, -1, 4, 2, 1, 3, -2]), [5, 4, -2, 3] * 4)
    coin_test(tmp_path / "majors_wild" / "backtests" / "2022_2026", zip(q, [30, -28, 25, -20, 18, 9, 6, 5]), [40, -45, 30] * 5)
    coin_test(tmp_path / "majors_bad" / "backtests" / "2022_2026", zip(q, [-3, -2, 1, -4, -2, -1, 2, -2]), [-2, 1, -3] * 5)
    coin_test(tmp_path / "majors_idle" / "backtests" / "2022_2026", zip(q, [0] * 8), [])
    stock_test(tmp_path / "stocks_good" / "backtests" / "2026", [("2026-01", [2, -1, 3] * 12, 4), ("2026-02", [1, 1, -1] * 12, 0),
                                                              ("2026-03", [-1, -1, 1] * 12, 2)])
    stock_test(tmp_path / "stocks_few" / "backtests" / "2026", [("2026-01", [4, -1], 9), ("2026-02", [3], 7)])
    b = book(tmp_path, {"memecoins_x": "memecoins", "majors_good": "big coins", "majors_wild": "big coins",
                        "majors_bad": "big coins", "majors_idle": "big coins", "majors_none": "big coins",
                        "stocks_good": "stocks", "stocks_few": "stocks"})
    d = {x["key"]: x for x in proving.data(b)["desks"]}
    assert d["majors_good"]["status"] == "candidate" and d["majors_good"]["result"]["trades"] == 16
    assert d["majors_good"]["why"].startswith("+12.") and "up in 6 and down in 2 of 8 quarters" in d["majors_good"]["why"]
    assert d["majors_wild"]["status"] == "watch" and "fell more than 25%" in d["majors_wild"]["why"]   # made money, too rough
    assert d["majors_bad"]["status"] == "cut"
    assert d["majors_idle"]["status"] == "no trades"                       # sat in cash the whole test: nothing to judge
    assert d["majors_none"]["status"] == "not tested" and "prove.sh" in d["majors_none"]["why"]
    assert d["memecoins_x"]["status"] == "live only"
    s = d["stocks_good"]
    assert s["status"] == "candidate" and s["result"]["trades"] == 108 and s["result"]["untriggered"] == 6
    assert [p["period"] for p in s["result"]["periods"]] == ["2026-01", "2026-02", "2026-03"]
    assert d["stocks_few"]["status"] == "watch" and "too few trades" in d["stocks_few"]["why"]
    order = [x["key"] for x in proving.data(b)["desks"]]
    assert order.index("majors_good") < order.index("majors_wild") < order.index("majors_bad") < order.index("majors_idle")


def test_the_newest_finished_test_counts_and_demo_never_mixes_with_real(tmp_path):
    base = tmp_path / "backtests"
    coin_test(base / "old", [("2024 Q1", -5)], [-5], age=3600)
    coin_test(base / "new", [("2024 Q1", 5)], [5])
    coin_test(base / "demo-new", [("2024 Q1", 50)], [50], demo=True)
    (base / "unfinished").mkdir()
    (base / "unfinished" / "periods.json").write_text("{}")               # no summary yet: still running
    assert proving.newest(base, False, "periods.json").name == "new"
    assert proving.newest(base, True, "periods.json").name == "demo-new"
    assert proving.newest(tmp_path / "nowhere", False, "periods.json") is None


def test_the_page_states_the_rule_and_draws_a_heatmap(tmp_path):
    coin_test(tmp_path / "majors_good" / "backtests" / "x", [("2024 Q1", 6.0), ("2024 Q2", -3.0)], [6, -3] * 6)
    stock_test(tmp_path / "stocks_good" / "backtests" / "y", [("2026-01", [1.5] * 120, 0)])
    b = book(tmp_path, {"majors_good": "big coins", "stocks_good": "stocks", "memecoins_x": "memecoins"})
    payload = proving.write(b, tmp_path / "out")
    page = (tmp_path / "out" / "proving.html").read_text()
    assert "<title>Proving Ground</title>" in page and "two thirds of its periods" in page
    assert 'class="heat"' in page and "2024 Q1" in page and "held -5%" in page and "120 picks" in page
    assert 'class="c pos" style="--v:0.30"' in page and 'class="c neg" style="--v:0.15"' in page
    assert "can't be replayed" in page and "bash server/prove.sh" in page
    assert json.loads((tmp_path / "out" / "proving.json").read_text())["desks"][0]["key"] == payload["desks"][0]["key"]
    text = (tmp_path / "out" / "proving.txt").read_text()
    assert text.startswith("PROVING GROUND · history tests") and "memecoins x" not in text
    assert pb.SERVED["/proving"] == "proving.html" and pb.SERVED["/proving.json"] == "proving.json"


def test_untested_desks_get_a_plain_instruction_not_an_empty_page(tmp_path):
    b = book(tmp_path, {"majors_a": "big coins", "stocks_a": "stocks"})
    page = proving.render_html(proving.data(b))
    assert page.count("No history tests yet") == 2 and "not tested" in page


def test_stocks_held_for_days_are_graded_like_big_coins_in_their_own_section(tmp_path):
    q = [f"{y} Q{n}" for y in (2024, 2025) for n in (1, 2, 3, 4)]
    coin_test(tmp_path / "majors_index" / "backtests" / "x", zip(q, [4, 3, -1, 5, 2, 2, -2, 3]), [6, -2, 4] * 4, hold=30.0)
    stock_test(tmp_path / "stocks" / "backtests" / "y", [("2026-01", [1.0] * 120, 0)])
    meta = {"majors_index": pb.desk_meta("majors_index", {"label": "Index trend filter", "kind": "coins", "market": "stocks",
                                                          "of": "", "prefix": ""}),
            "stocks": pb.desk_meta("stocks", {})}
    b = pb.Book({d: [] for d in meta}, {d: [] for d in meta}, {d: 1000.0 for d in meta}, {}, False, NOW, LA, meta=meta,
                order=tuple(meta), results={d: tmp_path / d for d in meta})
    rows = {x["key"]: x for x in proving.data(b)["desks"]}
    assert rows["majors_index"]["group"] == "swings" and rows["stocks"]["group"] == "stocks"
    assert rows["majors_index"]["status"] == "candidate" and "quarters" in rows["majors_index"]["why"]
    page = proving.render_html(proving.data(b))
    assert "Stocks held for days or weeks, quarter by quarter" in page and "Stocks bought and sold the same day" in page
    assert "the same stocks held" in page
