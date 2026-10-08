"""Provider interface + the small HTTP client every real provider uses."""
from __future__ import annotations

import re
import threading
import time
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, Iterator, List, Optional, Sequence
from urllib.parse import urlparse

from ..models import Bar, Halt, NewsItem, Quote

# Roundup articles ("12 stocks moving in pre-market") tag many tickers at once
# and aren't a real catalyst for any of them. Skip articles tagging more.
MAX_SYMBOLS_PER_ARTICLE = 4


class ProviderError(RuntimeError):
    pass


class Http:
    """requests.Session with timeouts, retry/backoff on 429 and 5xx, and an
    optional client-side rate limit (requests per minute)."""

    def __init__(self, headers: Optional[dict] = None, timeout: float = 30, retries: int = 4,
                 per_minute: Optional[int] = None):
        import requests  # imported lazily so the demo runs without it

        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "premarket-scanner/1.0", **(headers or {})})
        self.timeout = timeout
        self.retries = retries
        self.gap = 60 / per_minute if per_minute else 0.0
        self._lock = threading.Lock()
        self._next = 0.0

    def _throttle(self) -> None:
        if not self.gap:
            return
        with self._lock:
            wait = self._next - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._next = max(self._next, time.monotonic()) + self.gap

    def _request(self, url: str, params: Optional[dict] = None):
        where = urlparse(url).netloc + urlparse(url).path
        for attempt in range(self.retries):
            self._throttle()
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
            except Exception as exc:  # network blip
                if attempt == self.retries - 1:
                    raise ProviderError(f"network error calling {where}: {exc}") from exc
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 429 or r.status_code >= 500:
                if attempt == self.retries - 1:
                    break
                wait = r.headers.get("Retry-After", "")
                time.sleep(float(wait) if wait.replace(".", "", 1).isdigit() else 2 ** attempt)
                continue
            if r.status_code >= 400:
                raise ProviderError(f"HTTP {r.status_code} from {where}: {r.text[:300]}")
            return r
        raise ProviderError(f"gave up on {where} after {self.retries} tries (rate limit or server error)")

    def get(self, url: str, params: Optional[dict] = None) -> dict:
        return self._request(url, params).json()

    def get_text(self, url: str, params: Optional[dict] = None) -> str:
        return self._request(url, params).text


class Provider:
    """What the engine needs from a data source."""

    name = "base"
    delay_minutes = 0

    def screen(self, now: datetime, session: str) -> List[Quote]:
        """Every symbol that has traded this session, with a rough gap."""
        raise NotImplementedError

    def intraday_bars(self, symbols: Sequence[str], start: datetime, end: datetime) -> Dict[str, List[Bar]]:
        """5-minute bars incl. extended hours, split-adjusted, oldest first."""
        raise NotImplementedError

    def bars(self, symbols: Sequence[str], start: datetime, end: datetime, timeframe: str) -> Dict[str, List[Bar]]:
        """Bars at 5Min, 15Min or 1Day. Default: built from 5-minute bars.
        Providers with a native multi-symbol endpoint override this."""
        five = self.intraday_bars(symbols, start, end)
        if timeframe == "5Min":
            return five
        return {s: aggregate(bs, timeframe) for s, bs in five.items()}

    def news(self, symbols: Sequence[str], since: datetime, until: Optional[datetime] = None) -> Dict[str, List[NewsItem]]:
        """Headlines published in [since, until]; until=None means up to now."""
        raise NotImplementedError

    def floats(self, symbols: Sequence[str]) -> Dict[str, Optional[float]]:
        from .floats import lookup

        return lookup(symbols)

    def halts(self, days: Sequence[date]) -> Dict[str, List[Halt]]:
        """Trading halts on these days, all US exchanges (Nasdaq's public feed)."""
        from .halts import fetch

        return fetch(days)


# --- helpers shared by providers -------------------------------------------

_FRACTION = re.compile(r"(\.\d{6})\d+")


def parse_ts(value) -> Optional[datetime]:
    """RFC 3339 string (any precision) or epoch s/ms/ns -> aware UTC datetime."""
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        if v > 1e17:
            v /= 1e9
        elif v > 1e14:
            v /= 1e6
        elif v > 1e11:
            v /= 1e3
        return datetime.fromtimestamp(v, tz=timezone.utc)
    text = _FRACTION.sub(r"\1", str(value).replace("Z", "+00:00"))
    dt = datetime.fromisoformat(text)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def chunks(items: Sequence[str], size: int) -> Iterator[List[str]]:
    items = list(items)
    for i in range(0, len(items), size):
        yield items[i : i + size]


def aggregate(bars: List[Bar], timeframe: str) -> List[Bar]:
    """5-minute bars -> 15Min bars, or 1Day bars (regular-hours OHLC, all-session volume)."""
    from ..market import ET, RTH_CLOSE, RTH_OPEN

    groups: Dict[datetime, List[Bar]] = defaultdict(list)
    for b in sorted(bars, key=lambda b: b.start):
        if timeframe == "15Min":
            key = b.start - timedelta(minutes=b.start.minute % 15, seconds=b.start.second)
        elif timeframe == "1Day":
            key = datetime.combine(b.start.astimezone(ET).date(), datetime.min.time(), tzinfo=ET)
        else:
            raise ValueError(f"unsupported timeframe {timeframe}")
        groups[key].append(b)
    out = []
    for key, bs in sorted(groups.items()):
        vol = sum(b.volume for b in bs)
        if timeframe == "1Day":
            bs_rth = [b for b in bs if RTH_OPEN <= b.start.astimezone(ET).time() < RTH_CLOSE]
            if not bs_rth:
                continue
            bs = bs_rth
        out.append(Bar(key, bs[0].open, max(b.high for b in bs), min(b.low for b in bs), bs[-1].close, vol))
    return out


def bars_from_rows(rows: Iterable[dict]) -> List[Bar]:
    """Both Alpaca and Massive use t/o/h/l/c/v keys."""
    out = []
    for r in rows:
        ts = parse_ts(r.get("t"))
        if ts is None or r.get("c") is None:
            continue
        out.append(Bar(ts, float(r["o"]), float(r["h"]), float(r["l"]), float(r["c"]), float(r.get("v") or 0)))
    return out
