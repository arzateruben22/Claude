import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import benchmark  # noqa: E402
import crawler  # noqa: E402
import paperbook as pb  # noqa: E402

LA = ZoneInfo("America/Los_Angeles")
START = datetime(2026, 10, 8, 17, 51, tzinfo=timezone.utc)
NOW = START + timedelta(days=3)


def prices(start=60000.0, now=63000.0, calls=None):
    def fetch(url):
        if calls is not None:
            calls.append(url)
        if "/candles" in url:
            return [[int(START.timestamp()) + 300, 1, 1, start + 50, 1, 1], [int(START.timestamp()), 1, 1, start, 1, 1]]
        if "/ticker" in url:
            return {"price": str(now)}
        raise AssertionError(url)
    return fetch


def book(tmp_path, majors=(), held=()):
    folder = tmp_path / "majors-live"
    folder.mkdir(exist_ok=True)
    (folder / "state.json").write_text(json.dumps({"equity": [[START.isoformat(), 100.0], [NOW.isoformat(), 103.0]]}))
    trades = {"memecoins": [], "majors": list(majors), "stocks": []}
    hold = {"memecoins": [], "majors": list(held), "stocks": []}
    return pb.Book(trades, hold, {d: 100.0 for d in pb.DESKS}, {"majors": str(folder)}, False, NOW, LA)


def trade(pnl, i=0):
    t = START + timedelta(hours=5 + i)
    return pb.Trade("majors", "BTC", t, t + timedelta(hours=2), float(pnl), float(pnl), "trailing stop")


def test_btc_held_since_the_desks_started(tmp_path):
    b = book(tmp_path)
    out = tmp_path / "out"
    got = benchmark.load(out, b, prices())
    assert got["since"] == START.isoformat() and got["btc_start"] == 60000.0 and got["pct"] == 5.0
    calls = []                                          # the start price is kept: later only today's price is asked
    again = benchmark.load(out, b, prices(start=1.0, now=57000.0, calls=calls))
    assert again["btc_start"] == 60000.0 and again["pct"] == -5.0 and all("/ticker" in c for c in calls)


def test_no_network_no_benchmark_and_nothing_saved(tmp_path):
    def down(url):
        raise OSError("offline")

    assert benchmark.load(tmp_path / "out", book(tmp_path), down) is None
    assert not (tmp_path / "out" / benchmark.FILE).exists()
    demo = book(tmp_path)
    demo.demo = True
    assert benchmark.load(tmp_path / "out", demo, prices()) is None


def test_big_coins_compared_with_holding_btc(tmp_path):
    held = pb.Holding("majors", "ETH", NOW - timedelta(hours=1), 25.0, 27.0, "")
    b = book(tmp_path, majors=[trade(1.0, i) for i in range(4)], held=[held])
    assert benchmark.desk_return(b, "majors") == 6.0                     # $4 closed + $2 open, on $100
    b.benchmark = {"since": START.isoformat(), "btc_start": 60000.0, "btc_now": 63000.0, "pct": 5.0}
    assert "BTC bought Thu 08 Oct 10:51 and held: +5.0% · big coins desk: +6.0%" in pb.render_text(b)
    vs = [f for f in crawler.flags(b) if f["chip"] == "vs BTC"]
    assert len(vs) == 1 and vs[0]["level"] == "note" and "Ahead" in vs[0]["text"]          # few trades: a note
    b.trades["majors"] = [trade(-0.5, i) for i in range(25)]
    vs = [f for f in crawler.flags(b) if f["chip"] == "vs BTC"]
    assert vs[0]["level"] == "flag" and "holding BTC did better" in vs[0]["text"]          # 25 trades behind BTC
    assert crawler.data(b)["meta"]["btc"] == 5.0
