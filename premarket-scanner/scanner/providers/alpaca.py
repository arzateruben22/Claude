"""Alpaca Markets — free account works.

Free ("Basic") plan: full-market SIP data on a 15-minute delay
(ALPACA_FEED=delayed_sip, the default). Paid plan: ALPACA_FEED=sip for
real time. News (Benzinga) is included free. No float data here — see floats.py.
"""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from ..config import CACHE
from ..market import ET, session_window
from ..models import Bar, NewsItem, Quote
from .base import MAX_SYMBOLS_PER_ARTICLE, Http, Provider, bars_from_rows, chunks, iso, parse_ts

DATA = "https://data.alpaca.markets"
EXCHANGES = {"NASDAQ", "NYSE", "AMEX", "ARCA", "BATS"}


def quote_from_snapshot(symbol: str, snap: dict, today: date, session: str) -> Optional[Quote]:
    """One /v2/stocks/snapshots entry -> Quote, or None if it hasn't traded this session."""
    s_start, _ = session_window(session, today)
    trade = snap.get("latestTrade") or {}
    traded_at = parse_ts(trade.get("t"))
    price = trade.get("p")
    if not price or traded_at is None or traded_at < s_start:
        return None
    daily = snap.get("dailyBar") or {}
    prev = snap.get("prevDailyBar") or {}
    daily_ts = parse_ts(daily.get("t"))
    daily_is_today = daily_ts is not None and daily_ts.astimezone(ET).date() == today
    if session == "afterhours":
        if not daily_is_today:
            return None
        # dailyBar.c should be today's close; prev close is the loose backup.
        ref, alt = daily.get("c"), prev.get("c")
    else:
        # Before today's first print, dailyBar is still yesterday's bar.
        ref, alt = (prev.get("c") if daily_is_today else daily.get("c")), None
    quote = snap.get("latestQuote") or {}
    return Quote(symbol, float(price), ref, alt, bid=quote.get("bp"), ask=quote.get("ap"))


class AlpacaProvider(Provider):
    name = "alpaca"

    def __init__(self, key: str, secret: str, feed: str = "delayed_sip", paper: bool = True, http: Optional[Http] = None):
        self.feed = feed
        self.delay_minutes = 15 if feed == "delayed_sip" else 0
        self.trading = "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"
        self.http = http or Http({"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret})

    # -- universe -----------------------------------------------------------
    def universe(self) -> List[Tuple[str, str]]:
        """(symbol, name) for active, tradable US-listed stocks; cached per day."""
        cache = CACHE / f"alpaca_assets_{date.today().isoformat()}.json"
        if cache.exists():
            return [tuple(x) for x in json.loads(cache.read_text())]
        rows = self.http.get(f"{self.trading}/v2/assets", {"status": "active", "asset_class": "us_equity"})
        assets = sorted(
            (a["symbol"], a.get("name") or "")
            for a in rows
            if a.get("tradable") and a.get("exchange") in EXCHANGES
        )
        CACHE.mkdir(parents=True, exist_ok=True)
        for old in CACHE.glob("alpaca_assets_*.json"):
            old.unlink()
        cache.write_text(json.dumps(assets))
        return assets

    # -- provider API ---------------------------------------------------------
    def screen(self, now: datetime, session: str) -> List[Quote]:
        today = now.astimezone(ET).date()
        names = dict(self.universe())
        quotes: List[Quote] = []
        for chunk in chunks(sorted(names), 500):
            data = self.http.get(f"{DATA}/v2/stocks/snapshots", {"symbols": ",".join(chunk), "feed": self.feed})
            data = data.get("snapshots", data)
            for sym, snap in data.items():
                q = quote_from_snapshot(sym, snap or {}, today, session)
                if q:
                    q.name = names.get(sym, "")
                    quotes.append(q)
        return quotes

    def intraday_bars(self, symbols: Sequence[str], start: datetime, end: datetime) -> Dict[str, List[Bar]]:
        feed = self.feed
        if feed == "delayed_sip":
            # Basic plan may query SIP history up to 15 minutes ago.
            feed = "sip"
            end = min(end, datetime.now(timezone.utc) - timedelta(minutes=16))
        out: Dict[str, List[Bar]] = defaultdict(list)
        for chunk in chunks(symbols, 100):
            token = None
            while True:
                params = {
                    "symbols": ",".join(chunk),
                    "timeframe": "5Min",
                    "start": iso(start),
                    "end": iso(end),
                    "feed": feed,
                    "adjustment": "split",
                    "limit": 10000,
                }
                if token:
                    params["page_token"] = token
                data = self.http.get(f"{DATA}/v2/stocks/bars", params)
                for sym, rows in (data.get("bars") or {}).items():
                    out[sym].extend(bars_from_rows(rows))
                token = data.get("next_page_token")
                if not token:
                    break
        return dict(out)

    def news(self, symbols: Sequence[str], since: datetime) -> Dict[str, List[NewsItem]]:
        out: Dict[str, List[NewsItem]] = defaultdict(list)
        for chunk in chunks(symbols, 50):
            wanted = set(chunk)
            token = None
            for _ in range(5):  # at most 250 articles per chunk
                params = {"symbols": ",".join(chunk), "start": iso(since), "limit": 50, "sort": "desc"}
                if token:
                    params["page_token"] = token
                data = self.http.get(f"{DATA}/v1beta1/news", params)
                for item in data.get("news") or []:
                    tagged = item.get("symbols") or []
                    if len(tagged) > MAX_SYMBOLS_PER_ARTICLE:
                        continue
                    n = NewsItem(
                        headline=item.get("headline") or "",
                        published=parse_ts(item.get("created_at")) or since,
                        source=item.get("source") or "",
                        url=item.get("url") or "",
                    )
                    for sym in tagged:
                        if sym in wanted:
                            out[sym].append(n)
                token = data.get("next_page_token")
                if not token:
                    break
        return dict(out)
