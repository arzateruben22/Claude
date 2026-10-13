"""One market feed for several desks in the same process.

The main and wild rulebooks watch the same new coins, so they share every request: a sweep, a
price or a safety report fetched for one desk is reused by the next desk for a few seconds. The
free APIs see about the same traffic as a single desk, and both desks judge identical numbers.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from ..models import Coin, Safety
from .base import Source

KEEP = timedelta(minutes=10)     # forget cached answers older than this


class SharedSource(Source):
    def __init__(self, inner: Source, fresh_seconds: float = 10):
        self.inner = inner
        self.name = inner.name
        self.fresh = timedelta(seconds=fresh_seconds)
        self._sweep: Optional[Tuple[datetime, List[Coin]]] = None
        self._prices: Dict[str, Tuple[datetime, Optional[Coin]]] = {}
        self._safety: Dict[str, Tuple[datetime, Optional[Safety]]] = {}
        self._pruned: Optional[datetime] = None

    def _is_fresh(self, at: datetime, now: datetime) -> bool:
        return timedelta(0) <= now - at < self.fresh

    def discover(self, now: datetime) -> List[Coin]:
        if self._sweep and self._is_fresh(self._sweep[0], now):
            return list(self._sweep[1])
        coins = self.inner.discover(now)
        self._sweep = (now, coins)
        return list(coins)

    def snapshot(self, mints: Sequence[str], now: datetime) -> Dict[str, Coin]:
        out: Dict[str, Coin] = {}
        need: List[str] = []
        for mint in dict.fromkeys(mints):
            hit = self._prices.get(mint)
            if hit and self._is_fresh(hit[0], now):
                if hit[1] is not None:
                    out[mint] = hit[1]
            else:
                need.append(mint)
        if need:
            got = self.inner.snapshot(need, now)
            for mint in need:
                self._prices[mint] = (now, got.get(mint))     # a coin with no pool is remembered too
                if mint in got:
                    out[mint] = got[mint]
        self._prune(now)
        return out

    def safety(self, mint: str, now: datetime) -> Optional[Safety]:
        hit = self._safety.get(mint)
        if hit and self._is_fresh(hit[0], now):
            return hit[1]
        s = self.inner.safety(mint, now)
        self._safety[mint] = (now, s)
        return s

    def _prune(self, now: datetime) -> None:
        if self._pruned and now - self._pruned < KEEP:
            return
        self._pruned = now
        for cache in (self._prices, self._safety):
            for mint in [m for m, (at, _) in cache.items() if now - at > KEEP]:
                del cache[mint]
