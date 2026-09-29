from datetime import date, datetime, timezone

import pytest

from scanner.config import Criteria, load_criteria
from scanner.criteria import evaluate, symbol_allowed, tag_news
from scanner.models import Candidate, Metrics, NewsItem
from scanner.providers import alpaca, massive
from scanner.providers.base import parse_ts

from helpers import FakeHttp, et

TUE = date(2026, 9, 29)
NOW = datetime(2026, 9, 29, 12, 45, tzinfo=timezone.utc)  # 8:45 ET


def _cand(price=5.0, gap=25.0, rvol=6.0, vol=200_000, float_=8e6, news=True):
    m = Metrics(price, price / (1 + gap / 100), gap, vol, vol / rvol, rvol, 1e6, price, 10)
    c = Candidate("ABCD", "Abcd Inc", m, float_, spread_pct=0.5)
    if news:
        c.news = [NewsItem("Abcd wins contract", NOW)]
    return c


# --- rules ----------------------------------------------------------------------

def test_shipped_criteria_file_loads():
    c = load_criteria()
    assert (c.min_price, c.max_price, c.min_gap_pct, c.min_rvol, c.max_float_shares) == (2, 20, 10, 3, 20_000_000)
    assert "dilution" in c.warn_tags and "fda" in c.catalysts


def test_unknown_setting_is_an_error(tmp_path):
    p = tmp_path / "c.toml"
    p.write_text("[filters]\nmin_prise = 2\n")
    with pytest.raises(ValueError, match="min_prise"):
        load_criteria(p)


def test_passing_candidate():
    c = _cand()
    evaluate(c, Criteria())
    assert c.passed and c.warnings == []


@pytest.mark.parametrize("kwargs,message", [
    ({"price": 1.5}, "price $1.50 < $2"),
    ({"price": 24.0}, "price $24.00 > $20"),
    ({"gap": 7.0}, "gap +7.0% < +10%"),
    ({"rvol": 2.0}, "RVOL 2.0x < 3x"),
    ({"vol": 20_000}, "volume 20.0k < 50.0k"),
    ({"float_": 45e6}, "float 45.0M > 20.0M"),
    ({"news": False}, "no news"),
])
def test_each_rule_reports_why(kwargs, message):
    c = _cand(**kwargs)
    evaluate(c, Criteria())
    assert c.failures == [message]


def test_unknown_float_is_a_warning_unless_strict():
    c = _cand(float_=None)
    evaluate(c, Criteria())
    assert c.passed and c.warnings == ["float unknown"]
    c = _cand(float_=None)
    evaluate(c, Criteria(allow_unknown_float=False))
    assert c.failures == ["float unknown"]


def test_symbol_filter():
    assert symbol_allowed("ABCD", "Abcd Inc", True)
    assert not symbol_allowed("ABCDW", "Abcd Inc", True)           # warrant
    assert not symbol_allowed("ABCD", "Abcd Acquisition Corp Units", True)
    assert not symbol_allowed("BRK.B", "Berkshire", True)
    assert symbol_allowed("ABCDW", "", False)


def test_catalyst_tags_match_whole_words():
    cats = {"crypto_ai": ["ai"], "dilution": ["offering"], "fda": ["fda"]}
    tags = tag_news([NewsItem("Company said it priced an offering", NOW)], cats)
    assert tags == ["dilution"]  # "said" must not match "ai"
    assert tag_news([NewsItem("FDA clears AI device", NOW)], cats) == ["crypto_ai", "fda"]


# --- timestamps -------------------------------------------------------------------

def test_parse_ts_formats():
    expect = datetime(2026, 9, 29, 12, 30, tzinfo=timezone.utc)
    assert parse_ts("2026-09-29T12:30:00Z") == expect
    assert parse_ts("2026-09-29T12:30:00.123456789Z").replace(microsecond=0) == expect
    ts = int(expect.timestamp())
    for scaled in (ts, ts * 1000, ts * 1_000_000_000):
        assert parse_ts(scaled) == expect


# --- Alpaca ---------------------------------------------------------------------------

def test_alpaca_snapshot_premarket():
    snap = {
        "latestTrade": {"p": 6.25, "t": "2026-09-29T12:40:00.5Z"},
        "dailyBar": {"t": "2026-09-29T04:00:00Z", "c": 6.2},
        "prevDailyBar": {"t": "2026-09-28T04:00:00Z", "c": 5.0},
    }
    q = alpaca.quote_from_snapshot("ABCD", snap, TUE, "premarket")
    assert (q.price, q.ref_close) == (6.25, 5.0)
    # before today's first daily bar exists, dailyBar is yesterday
    snap["dailyBar"], snap["prevDailyBar"] = {"t": "2026-09-28T04:00:00Z", "c": 5.0}, {"c": 4.0}
    assert alpaca.quote_from_snapshot("ABCD", snap, TUE, "premarket").ref_close == 5.0


def test_alpaca_snapshot_skips_stale_trades():
    snap = {"latestTrade": {"p": 6.0, "t": "2026-09-28T19:59:00Z"}, "dailyBar": {}, "prevDailyBar": {}}
    assert alpaca.quote_from_snapshot("ABCD", snap, TUE, "premarket") is None


def test_alpaca_snapshot_afterhours_has_backup_ref():
    snap = {
        "latestTrade": {"p": 7.0, "t": "2026-09-29T21:00:00Z"},
        "dailyBar": {"t": "2026-09-29T04:00:00Z", "c": 6.0},
        "prevDailyBar": {"c": 5.5},
    }
    q = alpaca.quote_from_snapshot("ABCD", snap, TUE, "afterhours")
    assert (q.ref_close, q.alt_ref_close) == (6.0, 5.5)


def test_alpaca_bars_paginate_and_news_skips_roundups():
    pages = {
        None: {"bars": {"ABCD": [{"t": "2026-09-29T12:00:00Z", "o": 1, "h": 2, "l": 1, "c": 2, "v": 10}]},
               "next_page_token": "p2"},
        "p2": {"bars": {"ABCD": [{"t": "2026-09-29T12:05:00Z", "o": 2, "h": 3, "l": 2, "c": 3, "v": 20}],
                        "WXYZ": [{"t": "2026-09-29T12:05:00Z", "o": 9, "h": 9, "l": 9, "c": 9, "v": 5}]},
               "next_page_token": None},
    }
    news = {"news": [
        {"headline": "Abcd wins deal", "created_at": "2026-09-29T11:00:00Z", "symbols": ["ABCD"], "source": "benzinga"},
        {"headline": "12 stocks moving", "created_at": "2026-09-29T11:30:00Z", "symbols": list("ABCDEFG")},
    ]}
    http = FakeHttp({
        "/v2/stocks/bars": lambda url, p: pages[p.get("page_token")],
        "/v1beta1/news": lambda url, p: news,
    })
    prov = alpaca.AlpacaProvider("k", "s", feed="sip", http=http)
    bars = prov.intraday_bars(["ABCD", "WXYZ"], et(TUE, 4), et(TUE, 8))
    assert [b.close for b in bars["ABCD"]] == [2, 3] and len(bars["WXYZ"]) == 1
    assert http.calls[0][1]["timeframe"] == "5Min" and http.calls[0][1]["feed"] == "sip"
    got = prov.news(["ABCD"], et(TUE, 0))
    assert [n.headline for n in got["ABCD"]] == ["Abcd wins deal"]


def test_alpaca_free_feed_uses_delayed_history():
    http = FakeHttp({"/v2/stocks/bars": lambda url, p: {"bars": {}}})
    prov = alpaca.AlpacaProvider("k", "s", feed="delayed_sip", http=http)
    assert prov.delay_minutes == 15
    now = datetime.now(timezone.utc)
    prov.intraday_bars(["ABCD"], now.replace(year=now.year - 1), now)
    params = http.calls[0][1]
    assert params["feed"] == "sip"
    assert parse_ts(params["end"]) <= now.replace(microsecond=0) - __import__("datetime").timedelta(minutes=15)


# --- Massive ------------------------------------------------------------------------------

def test_massive_snapshot_uses_nanosecond_trades():
    ns = int(datetime(2026, 9, 29, 12, 40, tzinfo=timezone.utc).timestamp() * 1e9)
    t = {"ticker": "ABCD", "lastTrade": {"p": 6.0, "t": ns}, "day": {"c": 0}, "prevDay": {"c": 4.8}, "min": {}}
    q = massive.quote_from_snapshot(t, TUE, "premarket")
    assert (q.price, q.ref_close) == (6.0, 4.8)
    t["lastTrade"]["t"] = int(datetime(2026, 9, 28, 20, tzinfo=timezone.utc).timestamp() * 1e9)
    assert massive.quote_from_snapshot(t, TUE, "premarket") is None


def test_massive_bars_follow_next_url_and_news_filters():
    first = {"results": [{"t": 1790000000000, "o": 1, "h": 1, "l": 1, "c": 1, "v": 1}], "next_url": "https://api.massive.com/next"}
    http = FakeHttp({
        "/range/5/minute/": lambda url, p: first,
        "/next": lambda url, p: {"results": [{"t": 1790000300000, "o": 2, "h": 2, "l": 2, "c": 2, "v": 2}]},
        "/v2/reference/news": lambda url, p: {"results": [
            {"title": "Abcd FDA approval", "published_utc": "2026-09-29T11:00:00Z", "tickers": ["ABCD"],
             "publisher": {"name": "GlobeNewswire"}, "article_url": "https://x"},
            {"title": "Movers", "published_utc": "2026-09-29T11:00:00Z", "tickers": list("ABCDEF")},
        ]},
    })
    prov = massive.MassiveProvider("k", http=http, workers=1)
    bars = prov.intraday_bars(["ABCD"], et(TUE, 4), et(TUE, 8))
    assert [b.close for b in bars["ABCD"]] == [1, 2]
    assert http.calls[1] == ("https://api.massive.com/next", {})
    news = prov.news(["ABCD"], et(TUE, 0))
    assert [(n.headline, n.source) for n in news["ABCD"]] == [("Abcd FDA approval", "GlobeNewswire")]


def test_env_file_parsing(tmp_path, monkeypatch):
    from scanner.config import load_env

    env = tmp_path / ".env"
    env.write_text('# comment\nT_FEED=delayed_sip   # free plan\nT_QUOTED="a # b"\nT_EMPTY=\nT_KEEP=from-file\n')
    monkeypatch.setenv("T_KEEP", "from-env")
    for k in ("T_FEED", "T_QUOTED", "T_EMPTY"):
        monkeypatch.delenv(k, raising=False)
    load_env(env)
    import os

    assert os.environ["T_FEED"] == "delayed_sip"
    assert os.environ["T_QUOTED"] == "a # b"
    assert os.environ["T_EMPTY"] == ""
    assert os.environ["T_KEEP"] == "from-env"
