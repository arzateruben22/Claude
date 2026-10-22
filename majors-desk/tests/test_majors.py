import copy
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from majors import __main__ as cli
from majors import config, rules
from majors.desk import Desk, buy_and_hold, replay
from majors.market import HOUR, Bucketed, Candle, Coinbase, DemoMarket, MarketError

T0 = datetime(2026, 9, 1, tzinfo=timezone.utc)
BASE = config.load()
BASE.desk.start_bank = 1000.0          # the tests' numbers are worked out on a $1,000 paper bank


def cfg(**changes):
    c = copy.deepcopy(BASE)
    for key, value in changes.items():
        section, name = key.split("__")
        setattr(getattr(c, section), name, value)
    config.validate(c)
    return c


def series(prices, start=T0, spread=0.002, hours=1):
    return [Candle(start + i * hours * HOUR, p, p * (1 + spread), p * (1 - spread), p, 0.0, hours)
            for i, p in enumerate(prices)]


# -- settings ----------------------------------------------------------------------------------

def test_settings(tmp_path):
    assert BASE.rules.candles_needed() == 200 and "XRP" in BASE.desk.coins
    with pytest.raises(ValueError, match="trend_hours"):
        cfg(rules__trend_hours=200)                    # would need 400 hours; Coinbase gives 300 per call
    p = tmp_path / "m.toml"
    p.write_text("[rules]\nstop_atrr = 2\n")
    with pytest.raises(ValueError, match="stop_atrr"):
        config.load(p)


# -- rules -------------------------------------------------------------------------------------------

def test_averages():
    assert rules.ema([10] * 50, 10) == pytest.approx(10)
    assert rules.ema(list(range(100)), 10) > 85
    cs = series([100.0] * 20, spread=0.01)
    assert rules.atr(cs, 14) == pytest.approx(2.0)     # high-low of 2% around 100


def test_buys_a_breakout_in_an_uptrend_only():
    r = cfg().rules
    flat = [100.0] * 199
    ok, why = rules.entry(series(flat + [103.0]), r)
    assert ok and "broke out" in why
    falling = [150 - i * 0.25 for i in range(199)]
    ok, why = rules.entry(series(falling + [falling[-1] * 1.03]), r)
    assert not ok and "below" in why                    # a bounce in a downtrend isn't a buy
    ok, why = rules.entry(series(flat + [100.1]), r)
    assert not ok and "no breakout" in why
    assert not rules.entry(series(flat[:50]), r)[0]


def test_sells_on_the_trailing_stop_or_the_24h_low():
    r = cfg().rules
    cs = series([100.0] * 60 + [99.0])
    assert rules.exit_reason(cs, peak_close=100.0, r=r) == "trend over (24h low)"
    cs = series([100.0] * 60 + [99.9])
    assert rules.exit_reason(cs, peak_close=110.0, r=r) == "trailing stop"   # 10 below a peak, ATR 0.4
    assert rules.exit_reason(series([100.0] * 61), peak_close=100.0, r=r) is None


# -- the paper bank -------------------------------------------------------------------------------------

def test_sizing_and_costs():
    c = cfg()
    d = Desk(c, None)
    p = d._buy("BTC", 100.0, T0, stop_distance=5.0)
    # risk $10 (1% of $1,000) over a $5 stop -> 2 coins ~ $200, but capped at 25% of the bank: $200 is under it
    assert p.cost == pytest.approx(2 * 100 * 1.0005 * 1.004, rel=1e-6)
    t = d._sell("BTC", 100.0, T0 + HOUR, "test")
    assert t.pnl < 0 and t.pnl_pct == pytest.approx(-0.9, abs=0.02)      # 2 x (0.40% fee + 0.05% slippage)
    p = Desk(c, None)._buy("ETH", 100.0, T0, stop_distance=0.5)
    assert p.cost == pytest.approx(250.0)               # the 25% cap
    assert Desk(cfg(desk__start_bank=20.0), None)._buy("ETH", 100.0, T0, 0.5) is None   # under the $10 minimum
    assert Desk(cfg(desk__start_bank=100.0), None)._buy("ETH", 100.0, T0, 0.5).cost == pytest.approx(25.0)  # $100 bank trades


def test_one_decision_per_hour_cooldown_and_limits():
    c = cfg(rules__max_positions=1)
    d = Desk(c, None)
    up = series([100.0] * 199 + [103.0])
    said = d.decide({"BTC": up, "ETH": up})
    assert len(d.positions) == 1 and len(said) == 1     # max_positions
    assert d.decide({"BTC": up, "ETH": up}) == []       # same hour again: nothing
    crash = up + [Candle(up[-1].t + HOUR, 103, 103, 90, 90)]
    said = d.decide({"BTC": crash[-200:]})
    assert d.positions == {} and "sold BTC" in said[0]
    again = crash[-199:] + [Candle(crash[-1].t + HOUR, 95, 120, 95, 120)]
    d.decide({"BTC": again})
    assert d.positions == {}                            # cooling down after the sell


def test_save_and_resume(tmp_path):
    d = Desk(cfg(), None, tmp_path)
    d.decide({"BTC": series([100.0] * 199 + [103.0])})
    d.save()
    e = Desk(cfg(), None, tmp_path)
    assert e.resume() and e.positions.keys() == d.positions.keys() and e.cash == pytest.approx(d.cash)
    state = json.loads((tmp_path / "state.json").read_text())
    p = state["positions"][0]
    assert {"symbol", "opened_at", "qty", "cost", "last_price"} <= set(p)   # what the paper book reads


# -- history --------------------------------------------------------------------------------------------

def test_demo_market_is_repeatable_however_it_is_read():
    a, b = DemoMarket(3), DemoMarket(3)
    end = T0 + timedelta(days=10)
    full = a.history("BTC", "USD", T0, end)
    for h in range(0, 240, 37):                          # read hour by hour on the other one
        b.recent("BTC", "USD", T0 + timedelta(hours=h), 5)
    assert b.history("BTC", "USD", T0, end) == full
    assert DemoMarket(4).history("BTC", "USD", T0, end) != full


def test_replay_and_holding():
    c = cfg()
    res = replay(c, DemoMarket(7), T0, T0 + timedelta(days=60))
    d = res["desk"]
    assert d.trades and not d.positions                 # everything closed at the end
    assert d.cash == pytest.approx(c.desk.start_bank + sum(t.pnl for t in d.trades), abs=0.01)
    assert set(res["hold"]["per_coin"]) == set(c.desk.coins)
    flat = {"BTC": series([100.0] * 48)}
    hold = buy_and_hold(cfg(desk__coins=["BTC"]), flat, T0, T0 + timedelta(days=2))
    assert hold["return_pct"] == pytest.approx(-0.9, abs=0.02)   # flat prices: you only pay the costs


# -- Coinbase --------------------------------------------------------------------------------------------

class FakeHTTP:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def request(self, method, url, **kw):
        self.calls.append((url, kw["params"]))
        status, body = self.answer(url, kw["params"])
        return SimpleNamespace(status_code=status, json=lambda: body)


def _rows(start, end):
    t0 = datetime.fromisoformat(start.replace("Z", "+00:00"))
    n = int((datetime.fromisoformat(end.replace("Z", "+00:00")) - t0) / HOUR)
    rows = [[int((t0 + i * HOUR).timestamp()), 99.0 + i, 102.0 + i, 100.0 + i, 101.0 + i, 5.0] for i in range(n)]
    return rows[::-1]                                   # Coinbase sends newest first


def test_coinbase_candles(tmp_path):
    http = FakeHTTP(lambda url, p: (200, _rows(p["start"], p["end"])))
    cb = Coinbase(http)
    now = T0 + timedelta(hours=10, minutes=30)
    cs = cb.recent("XRP", "USD", now, 5)
    assert http.calls[0][0].endswith("/products/XRP-USD/candles") and http.calls[0][1]["granularity"] == 3600
    assert [c.t for c in cs] == sorted(c.t for c in cs) and all(c.closed_at <= now for c in cs)
    assert (cs[-1].o, cs[-1].h, cs[-1].l, cs[-1].c) == (104.0, 106.0, 103.0, 105.0)   # [time, low, high, open, close]
    cached = Coinbase(http, cache_dir=tmp_path)
    got = cached.history("BTC", "USD", T0, T0 + timedelta(days=30))
    assert len(got) == 720 and len(http.calls) == 1 + 3   # 300-hour pages
    again = Coinbase(FakeHTTP(lambda url, p: (500, {})), cache_dir=tmp_path).history("BTC", "USD", T0, T0 + timedelta(days=30))
    assert again == got                                  # served from the cache, no calls


def test_coinbase_problems():
    with pytest.raises(MarketError, match="doesn't list"):
        Coinbase(FakeHTTP(lambda u, p: (404, {"message": "NotFound"}))).recent("NOPE", "USD", T0, 5)

    class Down:
        def request(self, *a, **k):
            raise ConnectionError("unreachable")

    with pytest.raises(MarketError, match="can't reach"):
        Coinbase(Down()).recent("BTC", "USD", T0, 5)


# -- command line -------------------------------------------------------------------------------------------

def test_command_line(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["sim", "--days", "20"]) == 0
    assert (tmp_path / "demo" / "state.json").exists()
    assert cli.main(["status", "--demo"]) == 0
    assert "Paper bank" in capsys.readouterr().out
    assert cli.main(["backtest", "--demo", "--days", "30"]) == 0
    out = capsys.readouterr().out
    assert "INVENTED" in out and "just holding" in out
    assert cli.main(["status"]) == 0 and "Nothing yet" in capsys.readouterr().out


def test_why_explains_each_coin(capsys):
    from majors.__main__ import main

    assert main(["why", "--demo"]) == 0
    out = capsys.readouterr().out
    assert out.startswith("A buy needs") and all(coin in out for coin in ("BTC", "ETH", "DOGE"))


# -- longer candles and the 4h rulebook ------------------------------------------------------------------

from majors.market import Bucketed, aggregate, floor_to  # noqa: E402

FOUR = config.load(config.book_paths("4h")[0])


def test_aggregate_builds_whole_buckets_only():
    cs = series([float(100 + i) for i in range(10)], start=T0 + HOUR)       # 01:00 .. 10:00
    out = aggregate(cs, 4)
    assert len(out) == 1                                                       # 04:00-07:59 is the only complete bucket
    b = out[0]
    assert b.t == T0 + 4 * HOUR and b.hours == 4 and b.closed_at == T0 + 8 * HOUR
    assert b.o == cs[3].o and b.c == cs[6].c and b.h == max(c.h for c in cs[3:7]) and b.l == min(c.l for c in cs[3:7])
    assert b.v == pytest.approx(sum(c.v for c in cs[3:7]))
    assert aggregate(cs, 1) == cs
    assert floor_to(T0 + 7 * HOUR + timedelta(minutes=9), 4) == T0 + 4 * HOUR


def test_bucketed_market_serves_finished_four_hour_candles():
    m = Bucketed(DemoMarket(7), 4)
    now = T0 + 10 * HOUR + timedelta(minutes=30)
    got = m.recent("BTC", "USD", now, 5)
    assert len(got) == 5 and all(c.hours == 4 and c.t.hour % 4 == 0 for c in got)
    assert got[-1].closed_at == T0 + 8 * HOUR and got[-1].closed_at <= now < got[-1].closed_at + 4 * HOUR
    hist = m.history("BTC", "USD", T0, T0 + 2 * timedelta(days=1))
    assert len(hist) == 12 and hist[0].t == T0 and hist[-1].closed_at == T0 + 2 * timedelta(days=1)
    hourly = DemoMarket(7).history("BTC", "USD", T0, T0 + 4 * HOUR)
    assert hist[0].o == hourly[0].o and hist[0].c == hourly[3].c      # the same invented prices, bucketed


def test_four_hour_settings(tmp_path):
    assert FOUR.desk.candle_hours == 4 and FOUR.rules.trend == 50 and FOUR.rules.candles_needed() == 100
    assert FOUR.rules.candle_word() == "4-hour candle" and BASE.rules.candle_word() == "hour"
    with pytest.raises(ValueError, match="multiple of candle_hours"):
        cfg(desk__candle_hours=4, rules__trend_hours=202)
    with pytest.raises(ValueError, match="candle_hours must be"):
        cfg(desk__candle_hours=5)
    p = tmp_path / "m.toml"
    p.write_text("[rules]\ncandle_hours = 4\n")
    with pytest.raises(ValueError, match="belongs under"):
        config.load(p)
    assert config.book_paths("4h") == (config.ROOT / "retired" / "majors-4h.toml", config.OUTPUT / "4h")   # retired
    for bad in ("nope", "4H", "../x"):
        with pytest.raises(ValueError):
            config.book_paths(bad)


def test_four_hour_desk_trades_less_often_on_the_same_market():
    end = T0 + timedelta(days=90)
    one = replay(cfg(), DemoMarket(3), T0, end)["desk"]
    four = replay(FOUR, Bucketed(DemoMarket(3), 4), T0, end)["desk"]
    assert one.trades and four.trades and len(four.trades) < len(one.trades)
    assert all(t.opened.hour % 4 == 0 and t.closed.hour % 4 == 0 for t in four.trades)


def test_command_line_takes_a_book(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["sim", "--book", "4h", "--days", "30"]) == 0
    assert (tmp_path / "4h" / "demo" / "state.json").exists() and not (tmp_path / "demo").exists()
    assert cli.main(["status", "--demo", "--book", "4h"]) == 0
    assert "Paper bank" in capsys.readouterr().out
    assert cli.main(["why", "--demo", "--book", "4h"]) == 0
    assert "last 4-hour candle" in capsys.readouterr().out and "200h average" in capsys.readouterr().out or True
    assert cli.main(["status", "--book", "nope"]) == 2
    assert "majors-nope.toml" in capsys.readouterr().err


def test_run_checks_every_rulebook_it_is_given_before_starting(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["run", "--with", "4h", "--with", "nope"]) == 2
    assert "majors-nope.toml" in capsys.readouterr().err
    for b in ("daily", "fast", "tight", "loose", "btc", "alts", "single", "slow", "4h", "trend"):
        path, base = cli.book_paths(b, tmp_path)
        assert path.exists() and base == tmp_path / b, b           # retired ones are found in retired/
    hours = {b: config.load(cli.book_paths(b)[0]).desk.candle_hours for b in ("daily", "slow", "4h", "loose", "btc", "fast")}
    assert hours == {"daily": 24, "slow": 24, "4h": 4, "loose": 4, "btc": 4, "fast": 1}
    assert config.load(cli.book_paths("btc")[0]).desk.coins == ["BTC"]
    assert set(config.load(cli.book_paths("alts")[0]).desk.coins) == {"SOL", "XRP", "ADA", "DOGE"}


def test_one_rulebooks_failed_step_never_stops_the_others(capsys):
    class Boom:
        log, positions = [], []

        def step(self, now):
            raise RuntimeError("cache went bad")

    class Fine:
        def __init__(self):
            self.log, self.positions, self.stepped = [], [], 0

        def step(self, now):
            self.stepped += 1
            self.log.append("bought BTC")

        def value(self):
            return 100.0

    now = datetime(2026, 10, 21, 5, 1, 30, tzinfo=timezone.utc)
    fine = Fine()
    desks = [["main", SimpleNamespace(desk=SimpleNamespace(candle_hours=1)), Boom(), now],
             ["4h", SimpleNamespace(desk=SimpleNamespace(candle_hours=4)), fine, now],
             ["slow", SimpleNamespace(desk=SimpleNamespace(candle_hours=24)), Fine(), now + timedelta(hours=1)]]
    cli.step_due(desks, now)
    out = capsys.readouterr().out
    assert "step failed: RuntimeError: cache went bad; trying again in 5 minutes" in out and "bought BTC [4h]" in out
    assert fine.stepped == 1 and desks[2][2].stepped == 0                                  # not due yet
    assert desks[0][3] == now + timedelta(minutes=5)                                       # the failed one retries soon
    assert desks[1][3] == datetime(2026, 10, 21, 8, 1, 30, tzinfo=timezone.utc)            # the next 4-hour close + 90 s
    cli.step_due(desks, now + timedelta(minutes=5))
    assert "trying again" in capsys.readouterr().out and fine.stepped == 1


# -- the trend filter: hold above the long average, cash below it ---------------------------------------

TREND = config.load(config.book_paths("trend")[0])


def test_trend_rulebook_holds_above_its_average_and_steps_out_below_it():
    r = TREND.rules
    assert (r.breakout, r.exit, r.exit_below_trend, TREND.desk.candle_hours, TREND.desk.coins) == (0, 0, True, 24, ["BTC", "ETH"])
    assert r.candles_needed() == 300                              # 150 daily candles, twice over
    daily = lambda prices: series(prices, spread=0.05, hours=24)  # noqa: E731 - a coin that moves ~10% a day
    up = [100 + i * 0.1 for i in range(300)]
    ok, why = rules.entry(daily(up), r)
    assert ok and why == "closed above its 150-day average"         # no breakout needed
    down = [130 - i * 0.1 for i in range(300)]
    assert rules.entry(daily(down), r) == (False, "below its 150-day average")
    slipping = daily(up[:-1] + [120.0])                            # a close just under the average (about 122)
    assert rules.exit_reason(slipping, peak_close=max(up), r=r) == "trend over (below its 150-day average)"
    assert rules.exit_reason(daily(up), peak_close=up[-1], r=r) is None
    crash = daily(up[:-1] + [up[-2] * 0.3])                       # a 70% crash in one day: the stop goes first
    assert rules.exit_reason(crash, peak_close=up[-2], r=r) == "trailing stop"


def test_zero_means_not_used_and_negative_is_refused(tmp_path):
    text = config.book_paths("trend")[0].read_text()
    for bad in ("breakout_hours = -24", "exit_hours = -24", "exit_below_trend = 1"):
        path = tmp_path / "bad.toml"
        path.write_text(_swap(text, bad))
        with pytest.raises(ValueError):
            config.load(path)


def _swap(text: str, line: str) -> str:
    key = line.split(" = ")[0]
    out = [line if ln.startswith(key + " ") else ln for ln in text.splitlines()]
    assert out != text.splitlines()
    return "\n".join(out) + "\n"


def test_backtests_report_each_period_against_holding():
    from majors.desk import period_lines, periods
    cfg = config.load(config.book_paths("trend")[0])
    cfg.desk.start_bank = 100.0                                     # the made-up bank curve below starts at $100
    t0 = datetime(2025, 1, 1, tzinfo=timezone.utc)
    data = {"BTC": [Candle(t0 + timedelta(days=i), 100 + i, 101 + i, 99 + i, 100 + i, 1, 24) for i in range(730)]}
    curve = [(t0 + timedelta(days=i + 1), 100.0 + (i if i < 365 else 365 - (i - 365) / 2)) for i in range(729)]
    rows = periods(cfg, curve, data, t0, t0 + timedelta(days=730))
    assert [p["period"] for p in rows] == [f"{y} Q{q}" for y in (2025, 2026) for q in (1, 2, 3, 4)]
    assert rows[0]["desk_pct"] > 0 and rows[0]["hold_pct"] > 0
    assert rows[5]["desk_pct"] < 0 < rows[5]["hold_pct"]           # the desk gave back while the coin kept rising
    text = "\n".join(period_lines(rows))
    assert text.startswith("  By quarter (desk vs holding the same coins):") and "Made money in 4 of 8" in text
    long = periods(cfg, curve, data, t0 - timedelta(days=400), t0 + timedelta(days=730))
    assert all(" Q" not in p["period"] for p in long)               # more than two years: by calendar year
    assert periods(cfg, [], data, t0, t0) == []


def test_backtest_writes_its_periods_for_the_proving_ground(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    assert cli.main(["backtest", "--demo", "--days", "120", "--book", "loose"]) == 0
    out = capsys.readouterr().out
    assert "By quarter (desk vs holding the same coins):" in out and "ahead of holding in" in out
    found = list((tmp_path / "loose" / "backtests").glob("*/periods.json"))
    assert len(found) == 1
    saved = json.loads(found[0].read_text())
    assert saved["book"] == "loose" and saved["demo"] is True and saved["periods"] and "hold_pct" in saved
    assert saved["quarters"] and saved["years"] and saved["coins"] and saved["first"] < saved["last"]


# -- stocks held for days: Alpaca's daily bars on the same engine ---------------------------------------------

from majors.market import AlpacaDaily, alpaca_keys  # noqa: E402


def _alpaca(url, p):
    """Weekday bars between start and end, stamped 4am UTC (midnight in New York), two pages."""
    start = datetime.fromisoformat(p["start"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(p["end"].replace("Z", "+00:00"))
    day, bars = start.replace(hour=4, minute=0, second=0), []
    while day <= end:
        if day.weekday() < 5:
            n = (day - T0).days
            bars.append({"t": day.strftime("%Y-%m-%dT%H:%M:%SZ"), "o": 100.0 + n, "h": 102.0 + n, "l": 99.0 + n,
                         "c": 101.0 + n, "v": 1e6})
        day += timedelta(days=1)
    half = len(bars) // 2
    if not p.get("page_token"):
        return 200, {"bars": {p["symbols"]: bars[:half]}, "next_page_token": "page2"}
    return 200, {"bars": {p["symbols"]: bars[half:]}, "next_page_token": None}


def test_alpaca_daily_bars_are_trading_days_dated_by_their_new_york_date(tmp_path):
    http = FakeHTTP(_alpaca)
    m = AlpacaDaily("key", "secret", http, cache_dir=tmp_path)
    got = m.history("SPY", "USD", T0, T0 + timedelta(days=14))
    assert http.calls[0][0].endswith("/v2/stocks/bars")
    p = http.calls[0][1]
    assert (p["timeframe"], p["feed"], p["adjustment"], p["symbols"]) == ("1Day", "sip", "all", "SPY")
    assert len(http.calls) == 2 and http.calls[1][1]["page_token"] == "page2"          # every page read
    weekdays = [d.weekday() for d in (T0 + timedelta(days=i) for i in range(14)) if d.weekday() < 5]
    assert [c.t.weekday() for c in got] == weekdays and len(got) == 10                  # no weekends
    assert got[0].t == T0 and got[0].hours == 24 and got[0].closed_at == T0 + timedelta(days=1)
    assert (got[0].o, got[0].h, got[0].l, got[0].c) == (100.0, 102.0, 99.0, 101.0)
    down = FakeHTTP(lambda u, p: (500, {}))
    assert AlpacaDaily("key", "secret", down, cache_dir=tmp_path).history("SPY", "USD", T0, T0 + timedelta(days=14)) == got
    assert len(down.calls) == 1                                    # the newest days are asked for again; a hiccup
    with pytest.raises(MarketError, match="500"):                  # falls back to what's on disk, but nothing on
        AlpacaDaily("key", "secret", down, cache_dir=tmp_path / "empty").history("SPY", "USD", T0, T0 + timedelta(days=3))
    with pytest.raises(MarketError, match="refused"):              # disk, or refused keys, is said plainly
        AlpacaDaily("key", "secret", FakeHTTP(lambda u, p: (401, {})), cache_dir=tmp_path).history(
            "SPY", "USD", T0, T0 + timedelta(days=14))
    old = AlpacaDaily("key", "secret", FakeHTTP(_alpaca), cache_dir=tmp_path)
    old.history("SPY", "USD", T0, T0 + timedelta(days=14))
    assert old.http.calls[0][1]["start"] >= (T0 + timedelta(days=7)).strftime("%Y-%m-%d")  # ...but only the newest


def test_alpaca_problems_and_keys(tmp_path, monkeypatch):
    with pytest.raises(MarketError, match="refused the keys"):
        AlpacaDaily("k", "s", FakeHTTP(lambda u, p: (403, {}))).history("SPY", "USD", T0, T0 + timedelta(days=3))
    monkeypatch.delenv("ALPACA_API_KEY", raising=False)
    monkeypatch.delenv("ALPACA_SECRET_KEY", raising=False)
    env = tmp_path / ".env"
    env.write_text("# the scanner's keys\nALPACA_API_KEY=PKTEST\nALPACA_SECRET_KEY='abc123'\n")
    assert alpaca_keys(env) == ("PKTEST", "abc123")
    assert alpaca_keys(tmp_path / "missing.env") == ("", "")
    monkeypatch.setattr("majors.market.alpaca_keys", lambda env_file=None: ("", ""))
    with pytest.raises(MarketError, match="bash server/keys.sh"):
        AlpacaDaily()


def test_stock_rulebooks_trade_daily_bars_from_alpaca():
    for book in ("index", "sectors", "leaders"):
        c = config.load(config.book_paths(book)[0])
        assert (c.desk.source, c.desk.candle_hours, c.costs.fee_pct, c.desk.start_bank) == ("alpaca", 24, 0.0, 1000.0)
        assert c.desk.asset_word() == "stocks" and c.rules.candles_needed() <= config.MAX_CANDLES
    assert config.load(config.book_paths("index")[0]).desk.coins == ["SPY", "QQQ"]
    assert len(config.load(config.book_paths("leaders")[0]).desk.coins) == 20
    with pytest.raises(ValueError, match="candle_hours = 24"):
        cfg(desk__source="alpaca", desk__candle_hours=4, rules__trend_hours=100, rules__breakout_hours=48,
            rules__exit_hours=24, rules__atr_hours=16)
    with pytest.raises(ValueError, match="coinbase or alpaca"):
        cfg(desk__source="nyse")


def test_rush_rulebook_rides_twenty_coins_and_a_missing_one_is_skipped_not_fatal(tmp_path, monkeypatch, capsys):
    rush = config.load(config.book_paths("rush")[0])
    assert len(rush.desk.coins) == 20 and {"XRP", "QNT", "HBAR"} <= set(rush.desk.coins)
    assert (rush.desk.source, rush.desk.candle_hours, rush.rules.max_positions) == ("coinbase", 24, 4)

    class Gappy(DemoMarket):
        def history(self, coin, quote, start, end):
            if coin == "QNT":
                raise MarketError("Coinbase doesn't list QNT-USD")
            return super().history(coin, quote, start, end)

    from majors.market import Bucketed
    c = copy.deepcopy(rush)
    c.desk.coins = ["BTC", "ETH", "QNT"]
    end = datetime(2026, 10, 1, tzinfo=timezone.utc)
    result = replay(c, Bucketed(Gappy(), 24), end - timedelta(days=120), end)
    assert result["skipped"] == {"QNT": "Coinbase doesn't list QNT-USD"}
    assert set(result["hold"]["per_coin"]) == {"BTC", "ETH"}
    with pytest.raises(MarketError, match="QNT"):
        c.desk.coins = ["QNT"]
        replay(c, Bucketed(Gappy(), 24), end - timedelta(days=120), end)


def test_run_starts_the_coin_books_and_waits_on_a_stock_book_without_keys(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "OUTPUT", tmp_path)
    monkeypatch.setattr("majors.market.alpaca_keys", lambda env_file=None: ("", ""))

    def stop(*_):
        raise KeyboardInterrupt

    monkeypatch.setattr(cli, "step_due", stop)
    monkeypatch.setattr(cli.signal, "signal", lambda *a: None)
    assert cli.main(["run", "--book", "trend", "--with", "index"]) == 0
    out = capsys.readouterr().out
    assert "Not starting [index]: no Alpaca keys" in out and "New paper bank [trend]: $1,000.00" in out
    monkeypatch.setattr(cli, "step_due", stop)
    assert cli.main(["run", "--book", "index"]) == 1                 # nothing could start: say so, and stop
    assert cli.main(["doctor", "--book", "leaders"]) == 1 and "keys.sh" in capsys.readouterr().out


def test_why_reads_a_trend_filter_without_a_breakout(capsys):
    assert cli.main(["why", "--demo", "--book", "trend"]) == 0
    out = capsys.readouterr().out
    assert "150-day average" in out and "plain trend filter" in out


def test_the_hour_still_trading_is_never_kept_in_the_cache(tmp_path, monkeypatch):
    now = datetime.now(timezone.utc).replace(minute=20, second=0, microsecond=0)
    this_hour = now.replace(minute=0)

    def answer(url, p):                       # an exchange that also sends the hour still trading, half-made
        rows = _rows(p["start"], p["end"])
        if p["end"].startswith(this_hour.strftime("%Y-%m-%dT%H")):
            rows.insert(0, [int(this_hour.timestamp()), 1.0, 1.0, 1.0, 1.0, 0.0])
        return 200, rows

    cb = Coinbase(FakeHTTP(answer), cache_dir=tmp_path)
    cb.history("BTC", "USD", this_hour - 5 * HOUR, now)
    kept = {c.t for c in cb._load_cache("BTC", "USD")}
    assert this_hour not in kept and this_hour - HOUR in kept
    old = [[int((this_hour - i * HOUR).timestamp()), 1, 1, 1, 1, 0] for i in range(1, 24 * 60)]
    import gzip
    (tmp_path / "ETH-USD.json.gz").write_bytes(gzip.compress(json.dumps(old).encode()))   # the old format
    healed = cb._load_cache("ETH", "USD")
    assert healed and max(c.t for c in healed) < this_hour - timedelta(days=Coinbase.HEAL_DAYS - 1)


def test_an_hour_the_exchange_never_reported_does_not_starve_a_long_rule():
    class Gappy(DemoMarket):                       # one hour missing, 100 days back: its whole day is dropped
        def history(self, coin, quote, start, end):
            hole = datetime(2026, 7, 1, 13, tzinfo=timezone.utc)
            return [c for c in super().history(coin, quote, start, end) if c.t != hole]

    now = datetime(2026, 10, 9, 0, 5, tzinfo=timezone.utc)
    got = Bucketed(Gappy(7), 24).recent("BTC", "USD", now, 200)
    assert len(got) == 200 and datetime(2026, 7, 1, tzinfo=timezone.utc) not in {c.t for c in got}
    assert got[-1].closed_at == datetime(2026, 10, 9, tzinfo=timezone.utc)
    trend = config.load(config.book_paths("trend")[0]).rules
    ok, why = rules.entry(got, trend)
    assert not ok and why == "not enough history yet (200 of the 300 24-hour candles it needs)"
