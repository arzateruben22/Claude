import copy
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from majors import __main__ as cli
from majors import config, rules
from majors.desk import Desk, buy_and_hold, replay
from majors.market import HOUR, Candle, Coinbase, DemoMarket, MarketError

T0 = datetime(2026, 9, 1, tzinfo=timezone.utc)
BASE = config.load()


def cfg(**changes):
    c = copy.deepcopy(BASE)
    for key, value in changes.items():
        section, name = key.split("__")
        setattr(getattr(c, section), name, value)
    config.validate(c)
    return c


def series(prices, start=T0, spread=0.002):
    return [Candle(start + i * HOUR, p, p * (1 + spread), p * (1 - spread), p) for i, p in enumerate(prices)]


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
