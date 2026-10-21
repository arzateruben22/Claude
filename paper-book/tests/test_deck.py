"""The Trading Deck: every desk as a lane on one time axis, built from the same book as everything else."""
import gzip
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import deck  # noqa: E402
import paperbook as pb  # noqa: E402

NOW = datetime(2026, 10, 21, 1, 0, tzinfo=timezone.utc)
LA = ZoneInfo("America/Los_Angeles")
THREE = ("memecoins", "majors", "stocks")


def trade(desk, pnl, pct, closed, symbol="X", exit="target", opened=None):
    return pb.Trade(desk, symbol, opened or closed - timedelta(hours=1), closed, pnl, pct, exit)


def book(tmp_path, trades=(), held=(), benchmark=None, equity_start=None):
    t = {d: [x for x in trades if x.desk == d] for d in THREE}
    h = {d: [x for x in held if x.desk == d] for d in THREE}
    src = {}
    if equity_start:
        folder = tmp_path / "memes"
        folder.mkdir()
        (folder / "state.json").write_text(json.dumps({"equity": [[equity_start.isoformat(), 100.0]], "positions": []}))
        src["memecoins"] = str(folder)
    b = pb.Book(t, h, {d: 100.0 for d in THREE}, src, False, NOW, LA)
    b.benchmark = benchmark
    return b


def test_lanes_carry_steps_marks_and_a_start(tmp_path):
    t1, t2, t3 = NOW - timedelta(days=3), NOW - timedelta(days=2), NOW - timedelta(days=1)
    b = book(tmp_path, [trade("stocks", 9.5, 9.5, t1, "ABCD"), trade("stocks", -5.5, -5.5, t2, "EFGH", "stop"),
                        trade("memecoins", -26.0, -94.0, t3, "<b>RUG</b>", "rug exit")],
             [pb.Holding("majors", "ETH", NOW - timedelta(hours=5), 25.0, 26.0, "")],
             equity_start=NOW - timedelta(days=4))
    d = deck.data(b)
    by = {x["key"]: x for x in d["desks"]}
    s = by["stocks"]
    assert s["steps"] == [[int(t1.timestamp()), 9.5], [int(t2.timestamp()), 4.0]]
    assert s["marks"][1][1:] == [-5.5, -5.5, 0] and s["start"] == int((t1 - timedelta(hours=1)).timestamp())
    assert s["day"] == 4 and s["verdict"] == "2 trades · too few to judge" and "gap-ups · +10 / −5" == s["idea"]
    m = by["memecoins"]
    assert m["start"] == int((NOW - timedelta(days=4)).timestamp())       # the saved equity point, before any trade
    assert m["marks"][0][3] == 1 and m["net"] == -26.0                      # a rug exit is flagged
    assert by["majors"]["open"] == {"n": 1, "value": 1.0} and by["majors"]["steps"] == []
    assert by["majors"]["start"] == int((NOW - timedelta(hours=5)).timestamp())
    assert d["meta"]["day_one"] == m["start"] and d["meta"]["net"] == -22.0 and d["meta"]["open"] == 1.0
    assert d["meta"]["bank"] == 300.0 and d["meta"]["trades"] == 3 and d["meta"]["btc"] is None
    assert [row[2] for row in d["tape"]] == ["<b>RUG</b>", "EFGH", "ABCD"]      # newest first, raw: the page escapes


def test_verdicts_are_plain_and_never_forecasts():
    s = lambda net, pf: {"net": net, "profit_factor": pf}   # noqa: E731
    assert deck.verdict(0, s(0, None)) == "no trades yet"
    assert deck.verdict(1, s(5, None)) == "1 trade · too few to judge"
    assert deck.verdict(40, s(-9, 0.6)) == "loses more than it wins"
    assert deck.verdict(12, s(9, 2.0)) == "ahead, so far" and deck.verdict(40, s(9, 2.0)) == "holding up"
    assert deck.verdict(40, s(1, 1.1)) == "about even"


def test_a_result_that_is_mostly_one_trade_says_so():
    big = [trade("stocks", 28.0, 28.0, NOW - timedelta(days=1), "LUCK")] + [trade("stocks", 1.0, 1.0, NOW - timedelta(days=i), f"S{i}") for i in range(2, 8)]
    s = pb.stats(big, 100.0)
    assert deck.one_trade_share(s) == 0.82 and deck.verdict(len(big), s) == "7 trades · too few to judge · one trade is most of it"
    spread = [trade("stocks", 3.0, 3.0, NOW - timedelta(days=i), f"S{i}") for i in range(1, 13)] + [trade("stocks", -2.0, -2.0, NOW, "L", "stop")]
    s = pb.stats(spread, 100.0)
    assert deck.one_trade_share(s) == 0.08 and deck.verdict(len(spread), s) == "ahead, so far"
    assert deck.one_trade_share(pb.stats([trade("stocks", -4.0, -4.0, NOW, "L", "stop")], 100.0)) == 0.0
    assert deck.one_trade_share(pb.stats([], 100.0)) == 0.0


def test_btc_thread_comes_from_the_coin_desks_price_cache(tmp_path):
    since = NOW - timedelta(days=2)
    bench = {"since": since.isoformat(), "btc_start": 100000.0, "btc_now": 102500.0, "pct": 2.5}
    cache = tmp_path / "BTC-USD.json.gz"
    rows = [[int((since + timedelta(hours=i - 5)).timestamp()), 0, 0, 0, 100000.0 * (1 + i / 1000), 1] for i in range(60)]
    cache.write_bytes(gzip.compress(json.dumps(rows).encode()))
    b = book(tmp_path, benchmark=bench)
    series = deck.btc_series(b, cache)
    assert series and series[0][0] >= int(since.timestamp()) and series[-1] == [rows[-1][0], 5.9]
    assert len(series) == 55
    assert deck.btc_series(book(tmp_path), cache) is None                  # no benchmark, no thread
    assert deck.btc_series(b, tmp_path / "missing.json.gz") is None


def test_written_page_is_safe_and_served_at_the_root(tmp_path):
    b = book(tmp_path, [trade("memecoins", -9.0, -90.0, NOW - timedelta(hours=2), "<script>alert(1)</script>", "rug exit")])
    payload = deck.write(b, tmp_path / "out")
    page = (tmp_path / "out" / "deck.html").read_text()
    assert "<title>Trading Deck</title>" in page and "window.TRADING_DECK=" in page
    assert page.count("</script>") == 2 and "<\\/script>" in page           # the symbol can't break out of the JSON
    assert payload["meta"]["trades"] == 1
    for part in ('id="chips"', 'id="standings"', 'id="checks"', 'id="axis"', "renderStandings", "deck.market"):
        assert part in page, part                                       # the chips, the standings table, the dates
    assert pb.SERVED["/"] == "deck.html" and pb.SERVED["/crawler"] == "crawler.html" and pb.SERVED["/deck.json"] == "deck.json"


def test_idea_follows_each_stock_desks_own_rules(tmp_path):
    b = book(tmp_path)
    b.stock_rules = {"stocks": (10.0, 5.0, 0.5), "stocks_fade": (10.0, 10.0, 1.0), "stocks_early": (10.0, 5.0, 0.5)}
    b.stock_exit = {"stocks_early": "10:30"}
    assert deck.idea(b, "stocks_fade") == "gap-ups sold short · −10 / +10"
    assert deck.idea(b, "stocks_early") == "gap-ups · +10 / −5 · out by 10:30 ET"
    assert deck.idea(b, "majors_4h") == "4-hour breakouts"
