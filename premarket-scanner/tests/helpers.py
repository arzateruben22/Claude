from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Callable, Dict, List

from scanner.market import ET
from scanner.models import Bar


def et(d: date, hh: int, mm: int = 0) -> datetime:
    return datetime.combine(d, time(hh, mm), tzinfo=ET)


def day_bars(d: date, price: float = 5.0, pre_vol: float = 1_000, rth_vol: float = 10_000,
             post_vol: float = 1_000, close: float | None = None) -> List[Bar]:
    """A flat 4am-8pm day of 5-minute bars; the last regular bar closes at `close`."""
    bars = []
    t = et(d, 4)
    while t < et(d, 20):
        if t < et(d, 9, 30):
            v = pre_vol
        elif t < et(d, 16):
            v = rth_vol
        else:
            v = post_vol
        c = close if (close is not None and t == et(d, 15, 55)) else price
        bars.append(Bar(t, price, max(price, c), min(price, c), c, v))
        t += timedelta(minutes=5)
    return bars


class FakeHttp:
    """Routes GETs to handlers by URL substring and records every call."""

    def __init__(self, routes: Dict[str, Callable[[str, dict], dict]]):
        self.routes = routes
        self.calls: List[tuple] = []

    def get(self, url: str, params=None):
        self.calls.append((url, dict(params or {})))
        for key, handler in self.routes.items():
            if key in url:
                return handler(url, params or {})
        raise AssertionError(f"unexpected URL {url}")
