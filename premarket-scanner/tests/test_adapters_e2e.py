"""Replay the demo market through fake Alpaca / Massive APIs, so the real
adapters are exercised end to end: request shapes -> parsing -> engine."""
from datetime import timedelta

import pytest

from scanner.config import load_criteria
from scanner.engine import run_scan
from scanner.market import ET, parse_pt, session_window
from scanner.providers import alpaca, massive
from scanner.providers.base import iso, parse_ts
from scanner.providers.demo import DemoProvider

from helpers import FakeHttp

NOW = parse_pt("2026-09-28 05:45")
EXPECTED = ["DMBIO", "DMAI", "DMEV", "DMFRT"]
MISSES = {"DMRX", "DMSHP", "DMGLD", "DMCHP", "DMSOL", "DMHLT", "DMWID"}


def _bid_ask(demo, sym, price):
    half = price * demo.specs[sym].spread / 2
    return round(price - half, 4), round(price + half, 4)


@pytest.fixture
def market():
    demo = DemoProvider()
    demo.screen(NOW, "premarket")  # anchors the scripted day
    return demo


def _rows(bars):
    return [{"t": iso(b.start), "o": b.open, "h": b.high, "l": b.low, "c": b.close, "v": b.volume} for b in bars]


def _news(demo, sym):
    spec = demo.specs[sym]
    return [{"headline": spec.headline, "title": spec.headline, "created_at": iso(NOW - timedelta(hours=1)),
             "published_utc": iso(NOW - timedelta(hours=1)), "symbols": [sym], "tickers": [sym]}] if spec.headline else []


def test_alpaca_adapter(market, monkeypatch, tmp_path):
    monkeypatch.setattr(alpaca, "CACHE", tmp_path)
    d = NOW.astimezone(ET).date()
    s_start, _ = session_window("premarket", d)

    def assets(url, p):
        rows = [{"symbol": s, "name": sp.name, "tradable": True, "exchange": "NASDAQ"} for s, sp in market.specs.items()]
        return rows + [{"symbol": "OTCQ", "name": "Otc", "tradable": True, "exchange": "OTC"}]

    def snapshots(url, p):
        assert p["feed"] == "sip" and "OTCQ" not in p["symbols"]
        out = {}
        for s in p["symbols"].split(","):
            bars = market._bars(s, s_start, NOW)
            last = bars[-1]
            bid, ask = _bid_ask(market, s, last.close)
            out[s] = {"latestTrade": {"p": last.close, "t": iso(last.start)},
                      "latestQuote": {"bp": bid, "ap": ask},
                      "dailyBar": {"t": f"{d}T04:00:00Z", "c": last.close},
                      "prevDailyBar": {"c": market.specs[s].close}}
        return out

    def bars(url, p):
        start, end = parse_ts(p["start"]), parse_ts(p["end"])
        return {"bars": {s: _rows(market._bars(s, start, end)) for s in p["symbols"].split(",")}}

    def news(url, p):
        return {"news": [n for s in p["symbols"].split(",") for n in _news(market, s)]}

    http = FakeHttp({"/v2/assets": assets, "/v2/stocks/snapshots": snapshots,
                     "/v2/stocks/bars": bars, "/v1beta1/news": news})
    prov = alpaca.AlpacaProvider("k", "s", feed="sip", http=http)
    prov.floats, prov.halts = market.floats, market.halts
    res = run_scan(prov, load_criteria(), NOW, "premarket")
    assert [c.symbol for c in res.passed] == EXPECTED
    assert {c.symbol for c in res.near_misses} == MISSES


def test_massive_adapter(market):
    d = NOW.astimezone(ET).date()
    s_start, _ = session_window("premarket", d)

    def snapshot(url, p):
        tickers = []
        for s, spec in market.specs.items():
            last = market._bars(s, s_start, NOW)[-1]
            bid, ask = _bid_ask(market, s, last.close)
            tickers.append({"ticker": s, "lastTrade": {"p": last.close, "t": int(last.start.timestamp() * 1e9)},
                            "lastQuote": {"p": bid, "P": ask},
                            "day": {"c": 0}, "prevDay": {"c": spec.close}, "min": {}})
        return {"status": "OK", "tickers": tickers}

    def aggs(url, p):
        sym, frm, to = url.split("/ticker/")[1].split("/")[0], *map(int, url.rsplit("/", 2)[1:])
        assert p["adjusted"] == "true" and p["sort"] == "asc"
        bars = market._bars(sym, parse_ts(frm), parse_ts(to))
        return {"results": [dict(r, t=int(b.start.timestamp() * 1000)) for r, b in zip(_rows(bars), bars)]}

    http = FakeHttp({"/v2/snapshot/": snapshot, "/v2/aggs/ticker/": aggs,
                     "/v2/reference/news": lambda url, p: {"results": _news(market, p["ticker"])}})
    prov = massive.MassiveProvider("k", http=http, workers=4)
    prov.floats, prov.halts = market.floats, market.halts
    res = run_scan(prov, load_criteria(), NOW, "premarket")
    assert [c.symbol for c in res.passed] == EXPECTED
    assert {c.symbol for c in res.near_misses} == MISSES
