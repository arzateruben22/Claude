"""Provider interface + the small HTTP client every real provider uses."""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, Iterator, List, Optional, Sequence
from urllib.parse import urlparse

from ..models import Bar, NewsItem, Quote

# Roundup articles ("12 stocks moving in pre-market") tag many tickers at once
# and aren't a real catalyst for any of them. Skip articles tagging more.
MAX_SYMBOLS_PER_ARTICLE = 4


class ProviderError(RuntimeError):
    pass


class Http:
    """requests.Session with timeouts and retry/backoff on 429 and 5xx."""

    def __init__(self, headers: Optional[dict] = None, timeout: float = 30, retries: int = 4):
        import requests  # imported lazily so the demo runs without it

        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "premarket-scanner/1.0", **(headers or {})})
        self.timeout = timeout
        self.retries = retries

    def get(self, url: str, params: Optional[dict] = None) -> dict:
        where = urlparse(url).netloc + urlparse(url).path
        for attempt in range(self.retries):
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
            return r.json()
        raise ProviderError(f"gave up on {where} after {self.retries} tries (rate limit or server error)")


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

    def news(self, symbols: Sequence[str], since: datetime) -> Dict[str, List[NewsItem]]:
        raise NotImplementedError

    def floats(self, symbols: Sequence[str]) -> Dict[str, Optional[float]]:
        from .floats import lookup

        return lookup(symbols)


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


def bars_from_rows(rows: Iterable[dict]) -> List[Bar]:
    """Both Alpaca and Massive use t/o/h/l/c/v keys."""
    out = []
    for r in rows:
        ts = parse_ts(r.get("t"))
        if ts is None or r.get("c") is None:
            continue
        out.append(Bar(ts, float(r["o"]), float(r["h"]), float(r["l"]), float(r["c"]), float(r.get("v") or 0)))
    return out
