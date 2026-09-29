"""Massive (formerly Polygon.io) — paid, the real-time upgrade.

One full-market snapshot call covers every US stock. Snapshots need a paid
Stocks plan; lower tiers are 15-minute delayed (set MASSIVE_DELAY_MINUTES=15).
Also supplies float via its free-float endpoint (see floats.py).
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from typing import Dict, List, Optional, Sequence

from ..market import ET, session_window
from ..models import Bar, NewsItem, Quote
from .base import MAX_SYMBOLS_PER_ARTICLE, Http, Provider, bars_from_rows, iso, parse_ts

BASE = "https://api.massive.com"


def quote_from_snapshot(t: dict, today: date, session: str) -> Optional[Quote]:
    """One snapshot `tickers[]` entry -> Quote, or None if it hasn't traded this session."""
    s_start, _ = session_window(session, today)
    trade = t.get("lastTrade") or {}
    minute = t.get("min") or {}
    price, traded_at = trade.get("p"), parse_ts(trade.get("t"))
    if not price:
        price, traded_at = minute.get("c"), parse_ts(minute.get("t"))
    if not price or traded_at is None or traded_at < s_start:
        return None
    day = t.get("day") or {}
    prev = t.get("prevDay") or {}
    quote = t.get("lastQuote") or {}
    bid, ask = quote.get("p"), quote.get("P")  # lower-case p = bid, upper-case P = ask
    if session == "afterhours":
        return Quote(t["ticker"], float(price), day.get("c") or None, prev.get("c"), bid=bid, ask=ask)
    return Quote(t["ticker"], float(price), prev.get("c"), bid=bid, ask=ask)


class MassiveProvider(Provider):
    name = "massive"

    def __init__(self, key: str, delay_minutes: int = 0, http: Optional[Http] = None, workers: int = 8):
        self.key = key
        self.delay_minutes = delay_minutes
        self.http = http or Http({"Authorization": f"Bearer {key}"})
        self.workers = workers

    def screen(self, now: datetime, session: str) -> List[Quote]:
        today = now.astimezone(ET).date()
        data = self.http.get(f"{BASE}/v2/snapshot/locale/us/markets/stocks/tickers", {"include_otc": "false"})
        quotes = []
        for t in data.get("tickers") or []:
            if t.get("ticker"):
                q = quote_from_snapshot(t, today, session)
                if q:
                    quotes.append(q)
        return quotes

    def _paged(self, url: str, params: Optional[dict]) -> List[dict]:
        rows: List[dict] = []
        while url:
            data = self.http.get(url, params)
            rows.extend(data.get("results") or [])
            url, params = data.get("next_url"), None  # next_url carries its own query
        return rows

    def _bars_one(self, symbol: str, start: datetime, end: datetime) -> List[Bar]:
        ms = lambda dt: int(dt.timestamp() * 1000)  # noqa: E731
        url = f"{BASE}/v2/aggs/ticker/{symbol}/range/5/minute/{ms(start)}/{ms(end)}"
        return bars_from_rows(self._paged(url, {"adjusted": "true", "sort": "asc", "limit": 50000}))

    def intraday_bars(self, symbols: Sequence[str], start: datetime, end: datetime) -> Dict[str, List[Bar]]:
        with ThreadPoolExecutor(self.workers) as pool:
            results = pool.map(lambda s: (s, self._bars_one(s, start, end)), symbols)
            return dict(results)

    def _news_one(self, symbol: str, since: datetime, until: Optional[datetime]) -> List[NewsItem]:
        params = {"ticker": symbol, "published_utc.gte": iso(since), "order": "desc", "sort": "published_utc", "limit": 20}
        if until:
            params["published_utc.lte"] = iso(until)
        data = self.http.get(f"{BASE}/v2/reference/news", params)
        out = []
        for item in data.get("results") or []:
            if len(item.get("tickers") or []) > MAX_SYMBOLS_PER_ARTICLE:
                continue
            out.append(
                NewsItem(
                    headline=item.get("title") or "",
                    published=parse_ts(item.get("published_utc")) or since,
                    source=(item.get("publisher") or {}).get("name", ""),
                    url=item.get("article_url") or "",
                )
            )
        return out

    def news(self, symbols: Sequence[str], since: datetime, until: Optional[datetime] = None) -> Dict[str, List[NewsItem]]:
        with ThreadPoolExecutor(self.workers) as pool:
            return {s: n for s, n in pool.map(lambda s: (s, self._news_one(s, since, until)), symbols) if n}
