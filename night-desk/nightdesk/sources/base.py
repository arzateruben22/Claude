"""Source interface + a small rate-limited HTTP client."""
from __future__ import annotations

import re
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence
from urllib.parse import urlparse

from ..models import Coin, Safety


class SourceError(RuntimeError):
    pass


class Source:
    """Where coins come from. Live = real APIs, sim = the demo market."""

    name = "base"

    def discover(self, now: datetime) -> List[Coin]:
        """Newest pools on the chain (the CRAWLER's sweep)."""
        raise NotImplementedError

    def snapshot(self, mints: Sequence[str], now: datetime) -> Dict[str, Coin]:
        """Fresh market numbers for coins already on the desk."""
        raise NotImplementedError

    def safety(self, mint: str, now: datetime) -> Optional[Safety]:
        """Rug-risk report; None if not available yet."""
        raise NotImplementedError


class Http:
    """requests.Session with timeouts, retries on 429/5xx and a client-side rate limit."""

    def __init__(self, per_minute: int, headers: Optional[dict] = None, timeout: float = 20, retries: int = 3):
        import requests

        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "night-desk/1.0 (paper trading)", "Accept": "application/json",
                                     **(headers or {})})
        self.gap = 60 / per_minute
        self.timeout = timeout
        self.retries = retries
        self._lock = threading.Lock()
        self._next = 0.0

    def _throttle(self) -> None:
        with self._lock:
            wait = self._next - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._next = max(self._next, time.monotonic()) + self.gap

    def get(self, url: str, params: Optional[dict] = None):
        where = urlparse(url).netloc
        for attempt in range(self.retries):
            self._throttle()
            try:
                r = self.session.get(url, params=params, timeout=self.timeout)
            except Exception as exc:
                if attempt == self.retries - 1:
                    raise SourceError(f"can't reach {where}: {exc}") from exc
                time.sleep(2 ** attempt)
                continue
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(2 ** (attempt + 1))
                continue
            if r.status_code == 404:
                return None
            if r.status_code >= 400:
                raise SourceError(f"HTTP {r.status_code} from {where}: {r.text[:200]}")
            return r.json()
        raise SourceError(f"{where} kept failing (rate limit or server error)")


_FRACTION = re.compile(r"(\.\d{6})\d+")


def parse_ts(value) -> Optional[datetime]:
    """ISO-8601 string or epoch seconds/milliseconds -> aware UTC datetime."""
    if value in (None, "", 0):
        return None
    if isinstance(value, (int, float)):
        v = float(value)
        return datetime.fromtimestamp(v / 1000 if v > 1e11 else v, tz=timezone.utc)
    text = _FRACTION.sub(r"\1", str(value).replace("Z", "+00:00"))
    dt = datetime.fromisoformat(text)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def num(value, default: float = 0.0) -> float:
    """APIs send numbers as strings, null or missing; make them floats."""
    try:
        return float(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return default
