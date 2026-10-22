"""Market weather: the big trends against their 150-day lines, breadth, and the Fear & Greed mood."""
import gzip
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import weather  # noqa: E402

NOW = datetime(2026, 10, 22, 3, 0, tzinfo=timezone.utc)


def coin_cache(folder, symbol, daily_closes, end=NOW, legacy=False):
    """An hourly Coinbase cache whose 11pm closes are the given daily closes, the last one yesterday."""
    rows = []
    last = end.date() - timedelta(days=1)
    for i, c in enumerate(daily_closes):
        day = last - timedelta(days=len(daily_closes) - 1 - i)
        for h in (22, 23):
            t = datetime(day.year, day.month, day.day, h, tzinfo=timezone.utc)
            rows.append([int(t.timestamp()), c, c, c, c if h == 23 else c * 0.5, 1.0])
    folder.mkdir(parents=True, exist_ok=True)
    body = rows if legacy else {"v": 2, "rows": rows}
    (folder / f"{symbol}-USD.json.gz").write_bytes(gzip.compress(json.dumps(body).encode()))


def stock_cache(folder, symbol, daily_closes):
    bars, day = [], NOW.date() - timedelta(days=1)
    for c in reversed(daily_closes):
        while day.weekday() >= 5:
            day -= timedelta(days=1)
        t = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        bars.append([int(t.timestamp()), c, c, c, c, 1.0])
        day -= timedelta(days=1)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"stock-{symbol}-1d.json.gz").write_bytes(
        gzip.compress(json.dumps({"through": int(NOW.timestamp()), "bars": bars[::-1]}).encode()))


def test_a_trend_says_its_side_of_the_line_and_since_when(tmp_path):
    rising_then_falling = [100 + i for i in range(300)] + [399 - 6 * i for i in range(40)]
    coin_cache(tmp_path, "BTC", rising_then_falling, legacy=True)       # the cache's older shape still reads
    stock_cache(tmp_path, "SPY", [400 + i * 0.5 for i in range(320)])
    w = weather.load(tmp_path / "out", NOW, cache=tmp_path, fetch=lambda url: {"data": [
        {"value": "18", "value_classification": "<b>ignored</b>", "timestamp": str(int(NOW.timestamp()))}]})
    t = {x["symbol"]: x for x in w["trends"]}
    assert set(t) == {"BTC", "SPY"}                                     # no QQQ prices on this machine: left out
    assert t["BTC"]["above"] is False and t["BTC"]["pct"] < 0 and t["BTC"]["on"] == (NOW.date() - timedelta(days=1)).isoformat()
    assert date.fromisoformat(t["BTC"]["since"]) > NOW.date() - timedelta(days=40)   # crossed during the fall
    assert t["SPY"]["above"] is True and t["SPY"]["pct"] > 0
    assert w["mood"] == {"value": 18, "label": "Extreme fear", "date": NOW.date().isoformat()}   # the label is ours
    assert "Bitcoin is below its 150-day average" in w["read"] and "index desk may hold it" in w["read"]
    line = weather.line(w)
    assert line.startswith("weather: BTC −".replace("−", "-")) and "fear & greed 18 (extreme fear)" in line


def test_too_little_history_shows_nothing_rather_than_a_guess(tmp_path):
    coin_cache(tmp_path, "BTC", [100.0] * 120)                           # 120 days: a 150-day line needs 300
    w = weather.load(tmp_path / "out", NOW, cache=tmp_path, fetch=lambda url: (_ for _ in ()).throw(OSError("offline")))
    assert w["trends"] == [] and w["mood"] is None
    assert w["read"].startswith("Not enough price history") and weather.line(w) == ""
    assert "fills in once the desks" in weather.render_html(w)


def test_breadth_uses_each_rulebooks_own_average(tmp_path):
    coins = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "LINK", "AVAX", "LTC", "DOT"]
    for i, sym in enumerate(coins[:9]):
        coin_cache(tmp_path, sym, [100 + (j if i < 3 else -j) * 0.5 for j in range(120)])   # three up, six down
    assert weather.breadth("rush coins", "rush", tmp_path, NOW) is None          # 9 of 20: under half, no count
    coin_cache(tmp_path, "DOT", [100 + j * 0.5 for j in range(120)])
    b = weather.breadth("rush coins", "rush", tmp_path, NOW)
    assert (b["up"], b["of"], b["listed"], b["days"]) == (4, 10, 20, 50) and b["symbols"] == ["BTC", "ETH", "SOL", "DOT"]
    assert weather.breadth("leader companies", "leaders", tmp_path, NOW) is None    # no stock prices yet


def test_fear_and_greed_is_fetched_at_most_every_six_hours_and_kept_when_offline(tmp_path):
    calls = []

    def fetch(url):
        calls.append(url)
        return {"data": [{"value": "64", "timestamp": str(int(NOW.timestamp()))}]}

    assert weather.fear_greed(tmp_path, NOW, fetch)["label"] == "Greed"
    weather.fear_greed(tmp_path, NOW + timedelta(hours=5), fetch)
    assert len(calls) == 1 and calls[0].startswith("https://api.alternative.me/fng/")

    def down(url):
        raise OSError("offline")

    assert weather.fear_greed(tmp_path, NOW + timedelta(hours=7), down)["value"] == 64          # the last good one
    assert weather.fear_greed(tmp_path, NOW + timedelta(days=4), down) is None                  # too old to show
    bad = tmp_path / "bad"
    assert weather.fear_greed(bad, NOW, lambda url: {"data": [{"value": "250", "timestamp": "0"}]}) is None
    assert weather.fear_greed(bad, NOW, lambda url: {"data": [{"value": "x; rm", "timestamp": "0"}]}) is None


def test_demo_weather_is_invented_and_says_so():
    w = weather.load(Path("/nonexistent"), NOW, demo=True)
    assert w["demo"] is True and weather.line(w).startswith("weather (DEMO, invented):")
    page = weather.render_html(w)
    assert "DEMO, invented numbers." in page and "not a signal" in page and 'class="weather"' in page


def test_every_page_carries_the_weather(tmp_path):
    import paperbook as pb
    import tomllib

    cfg = tomllib.load(open(Path(__file__).resolve().parent.parent / "book.toml", "rb"))
    pb.build(cfg, True, tmp_path / "out", NOW)
    out = tmp_path / "out"
    assert "Market weather now" in (out / "paper-book.html").read_text()
    assert "Market weather now" in (out / "proving.html").read_text()
    assert "weather (DEMO, invented):" in (out / "standings.txt").read_text()
    deck = json.loads((out / "deck.json").read_text())
    assert deck["meta"]["weather"]["trends"][0]["symbol"] == "BTC" and deck["meta"]["weather"]["mood"]["value"] == 31
    assert json.loads((out / "weather.json").read_text())["demo"] is True and pb.SERVED["/weather.json"] == "weather.json"
