import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import crawler  # noqa: E402
import paperbook as pb  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
NOW = datetime(2026, 10, 8, 20, 0, tzinfo=timezone.utc)
T0 = datetime(2026, 9, 1, 17, tzinfo=timezone.utc)


def trades(desk, n, pnl=lambda i: 10 if i % 3 else -5, pct=None, exit_=lambda i: "target" if i % 3 else "stop",
           symbol=lambda i: f"S{i % 6}"):
    pct = pct or pnl
    return [pb.Trade(desk, symbol(i), T0 + i * timedelta(hours=7) - timedelta(minutes=40), T0 + i * timedelta(hours=7),
                     float(pnl(i)), float(pct(i)), exit_(i)) for i in range(n)]


def book(**per_desk):
    t = {d: per_desk.get(d, []) for d in pb.DESKS}
    return pb.Book(t, {d: [] for d in pb.DESKS}, {d: 1000.0 for d in pb.DESKS}, {}, False, NOW, LA)


def chips(b, desk=None, level=None):
    return [f["chip"] for f in crawler.flags(b) if (desk is None or f["desk"] == desk) and (level is None or f["level"] == level)]


def test_what_gets_flagged():
    rug = pb.Trade("memecoins", "$RUG", T0, T0, -90.0, -90.0, "rug exit")
    deep = pb.Trade("memecoins", "$DEEP", T0, T0, -55.0, -55.0, "stop")
    ok = pb.Trade("memecoins", "$OK", T0, T0, -20.0, -20.0, "stop")
    assert crawler.is_flag(rug) and crawler.is_flag(deep) and not crawler.is_flag(ok)


def test_flags_to_check():
    memes = trades("memecoins", 40, pnl=lambda i: -100 if i in (5, 9) else 10 if i % 3 else -5,
                   exit_=lambda i: "rug exit" if i in (5, 9) else "target")
    losing = trades("majors", 25, pnl=lambda i: 4 if i % 3 == 0 else -6)
    b = book(memecoins=memes, majors=losing, stocks=trades("stocks", 8))
    found = crawler.flags(b)
    assert "rug ×2" in chips(b, "memecoins", "flag")
    assert any(c.startswith("PF ") for c in chips(b, "majors", "flag"))          # loses more than it wins
    assert "n=8" in chips(b, "stocks", "note") and "n=25" in chips(b, "majors", "note")
    levels = [f["level"] for f in found]
    assert levels == sorted(levels, key=["flag", "note", "up"].index)           # flags first, good news last
    assert all(f["text"] and f["chip"] for f in found)


def test_a_steady_desk_is_called_out_as_holding_up():
    b = book(stocks=trades("stocks", 60, symbol=lambda i: f"S{i % 12}"))
    assert chips(b, "stocks") == ["holding up"]
    assert chips(book()) == ["no trades"] * 3


def test_one_symbol_carrying_a_desk_and_long_losing_streaks():
    b = book(stocks=trades("stocks", 30, pnl=lambda i: 200 if i == 0 else -1 if i < 9 else 1 if i % 2 else -1,
                           symbol=lambda i: "BIG" if i == 0 else f"S{i % 5}"))
    got = {f["chip"]: f["text"] for f in crawler.flags(b) if f["desk"] == "stocks"}
    assert "one symbol" in got and got["one symbol"].startswith("BIG made")
    assert "8 in a row" in got


def test_open_positions_down_a_fifth_are_flagged():
    b = book()
    b.held["majors"] = [pb.Holding("majors", "ETH", NOW, 100.0, 70.0, ""), pb.Holding("majors", "BTC", NOW, 100.0, 95.0, ""),
                        pb.Holding("stocks", "WAIT", NOW, 100.0, None, "")]
    assert [f["text"].split()[0] for f in crawler.flags(b) if f["chip"] == "open"] == ["ETH"]


def test_page_data():
    memes = trades("memecoins", crawler.SHOWN + 30, pnl=lambda i: -80 if i == 3 else 10 if i % 2 else -5,
                   exit_=lambda i: "rug exit" if i == 3 else "target")
    b = book(memecoins=memes, majors=trades("majors", 5))
    b.held["stocks"] = [pb.Holding("stocks", "AAPL", NOW, 100.0, None, "waiting for the open")]
    d = crawler.data(b)
    assert [s["key"] for s in d["sections"]] == ["memecoins", "majors", "stocks", "open", "patterns"]
    mem = d["sections"][0]
    assert len(mem["words"]) == crawler.SHOWN and mem["earlier"]["n"] == 30
    assert mem["earlier"]["flags"] == 1 and mem["earlier"]["wins"] + mem["earlier"]["losses"] == 30
    walked = sum(w[1] for w in mem["words"])
    assert abs(walked + mem["earlier"]["pnl"] - sum(t.pnl for t in memes)) < 0.01   # nothing lost by skipping
    assert [w[5] for w in mem["words"]] == sorted(w[5] for w in mem["words"])       # in the order they closed
    assert d["sections"][3]["words"] == [["AAPL", "stocks", 100.0, None, int(NOW.timestamp())]]
    assert d["sections"][4]["words"] and all(w[1] in ("MEM", "BIG", "STK") or "+" in w[1] for w in d["sections"][4]["words"])
    assert d["meta"]["trades"] == crawler.SHOWN + 35 and d["meta"]["bank"] == 3000.0
    json.dumps(d)                                                                  # it must travel as JSON


def test_written_page_is_safe(tmp_path):
    b = book(memecoins=trades("memecoins", 12, symbol=lambda i: "</script><b>" if i == 0 else "$OK"))
    crawler.write(b, tmp_path)
    page = (tmp_path / "crawler.html").read_text()
    blob = page.split("window.TRADE_CRAWLER=", 1)[1].split(";</script>", 1)[0]
    assert "</script" not in blob and json.loads(blob)["sections"][0]["words"][0][0] == "</script><b>"
    assert "<title>Trade Crawler</title>" in page and page.startswith("<!doctype html>")
    frag = (tmp_path / "crawler.fragment.html").read_text()
    assert not frag.startswith("<!doctype") and "window.TRADE_CRAWLER=" in frag
    assert json.loads((tmp_path / "crawler.json").read_text())["meta"]["demo"] is False
