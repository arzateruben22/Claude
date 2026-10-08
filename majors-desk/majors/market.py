"""Hourly candles: from Coinbase's public market data (no account, no key), or an invented demo market.

Only finished candles are used. The hour that's still trading is dropped, so a decision never
sees a price that can still change.
"""
from __future__ import annotations

import gzip
import json
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

HOUR = timedelta(hours=1)


class MarketError(RuntimeError):
    pass


@dataclass(frozen=True)
class Candle:
    t: datetime          # when the hour started (UTC)
    o: float
    h: float
    l: float             # noqa: E741 (low)
    c: float
    v: float = 0.0

    @property
    def closed_at(self) -> datetime:
        return self.t + HOUR


def floor_hour(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Coinbase:
    """Coinbase Exchange public candles: GET /products/BTC-USD/candles?granularity=3600."""

    name = "coinbase"
    BASE = "https://api.exchange.coinbase.com"
    PER_CALL = 300

    def __init__(self, http=None, cache_dir: Optional[Path] = None):
        if http is None:
            import requests

            http = requests.Session()
        self.http, self.cache_dir = http, cache_dir

    def _get(self, coin: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        url = f"{self.BASE}/products/{coin}-{quote}/candles"
        try:
            resp = self.http.request("GET", url, params={"granularity": 3600, "start": _iso(start), "end": _iso(end)},
                                     headers={"User-Agent": "majors-desk/1.0", "Accept": "application/json"},
                                     timeout=20)
        except OSError as exc:
            raise MarketError(f"can't reach Coinbase ({type(exc).__name__})") from exc
        if resp.status_code == 404:
            raise MarketError(f"Coinbase doesn't list {coin}-{quote}")
        if resp.status_code != 200:
            raise MarketError(f"Coinbase answered {resp.status_code} for {coin}-{quote}")
        rows = resp.json()
        if not isinstance(rows, list):
            raise MarketError(f"unexpected answer from Coinbase for {coin}-{quote}")
        # each row: [time, low, high, open, close, volume], newest first
        out = [Candle(datetime.fromtimestamp(int(r[0]), timezone.utc), float(r[3]), float(r[2]), float(r[1]),
                      float(r[4]), float(r[5])) for r in rows]
        return sorted(out, key=lambda c: c.t)

    def recent(self, coin: str, quote: str, now: datetime, n: int) -> List[Candle]:
        """The last n finished hours before `now`."""
        end = floor_hour(now)
        got = self._get(coin, quote, end - min(n, self.PER_CALL) * HOUR, end)
        return [c for c in got if c.closed_at <= now][-n:]

    def history(self, coin: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        """Every finished hour from start to end, fetched 300 at a time (and kept on disk for next time)."""
        start, end = floor_hour(start), floor_hour(end)
        cached = self._load_cache(coin, quote)
        have = {c.t for c in cached}
        t = start
        while t < end:
            chunk_end = min(end, t + self.PER_CALL * HOUR)
            want = {t + i * HOUR for i in range(int((chunk_end - t) / HOUR))}
            if not want <= have:
                for c in self._get(coin, quote, t, chunk_end):
                    if c.t not in have:
                        cached.append(c)
                        have.add(c.t)
            t = chunk_end
        cached.sort(key=lambda c: c.t)
        self._save_cache(coin, quote, cached)
        return [c for c in cached if start <= c.t and c.closed_at <= end]

    def _cache_path(self, coin: str, quote: str) -> Optional[Path]:
        return self.cache_dir / f"{coin}-{quote}.json.gz" if self.cache_dir else None

    def _load_cache(self, coin: str, quote: str) -> List[Candle]:
        p = self._cache_path(coin, quote)
        if not p or not p.exists():
            return []
        rows = json.loads(gzip.decompress(p.read_bytes()))
        return [Candle(datetime.fromtimestamp(r[0], timezone.utc), *r[1:]) for r in rows]

    def _save_cache(self, coin: str, quote: str, candles: List[Candle]) -> None:
        p = self._cache_path(coin, quote)
        if not p:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        rows = [[int(c.t.timestamp()), c.o, c.h, c.l, c.c, c.v] for c in candles]
        p.write_bytes(gzip.compress(json.dumps(rows).encode()))


class DemoMarket:
    """An invented market for the demo and the tests: prices are made up, nothing here is real.

    All coins share a market mood (up, flat or down, which changes now and then) plus their own
    noise, so they move together the way real coins tend to. The same seed gives the same prices.
    """

    name = "demo"
    START = {"BTC": 60000.0, "ETH": 3000.0, "SOL": 150.0, "XRP": 0.60, "ADA": 0.45, "DOGE": 0.12}
    VOL = {"BTC": 0.006, "ETH": 0.008, "SOL": 0.011, "XRP": 0.010, "ADA": 0.011, "DOGE": 0.013}
    EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def __init__(self, seed: int = 7):
        self.seed = seed
        self.series: Dict[str, List[Candle]] = {}
        self.mood: List[float] = []
        self.mood_rng = random.Random(f"{seed}-mood")
        self.regime = 0.0

    def _extend_mood(self, n: int) -> None:
        while len(self.mood) < n:
            if self.mood_rng.random() < 0.012:          # the mood changes about every three days
                self.regime = self.mood_rng.choice((0.0009, 0.0, 0.0, -0.0008))
            self.mood.append(self.regime)

    def _extend(self, coin: str, until: datetime) -> List[Candle]:
        s = self.series.setdefault(coin, [])
        n = int((floor_hour(until) - self.EPOCH) / HOUR)
        if len(s) >= n:
            return s
        self._extend_mood(n)
        price = s[-1].c if s else self.START.get(coin, 10.0)
        vol = self.VOL.get(coin, 0.01)
        for i in range(len(s), n):
            rng = random.Random(f"{self.seed}-{coin}-{i}")   # per hour: same prices however it's fetched
            drift = self.mood[i] * (1.4 if coin not in ("BTC", "ETH") else 1.0)
            o = price
            c = o * math.exp(drift + vol * rng.gauss(0, 1))
            h = max(o, c) * math.exp(abs(rng.gauss(0, vol * 0.5)))
            low = min(o, c) * math.exp(-abs(rng.gauss(0, vol * 0.5)))
            s.append(Candle(self.EPOCH + i * HOUR, o, h, low, c, rng.uniform(100, 1000)))
            price = c
        return s

    def recent(self, coin: str, quote: str, now: datetime, n: int) -> List[Candle]:
        return [c for c in self._extend(coin, now) if c.closed_at <= now][-n:]

    def history(self, coin: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        return [c for c in self._extend(coin, end) if start <= c.t and c.closed_at <= end]
