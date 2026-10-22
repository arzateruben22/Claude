"""Hourly candles: from Coinbase's public market data (no account, no key), or an invented demo market.

Only finished candles are used. The hour that's still trading is dropped, so a decision never
sees a price that can still change. Longer candles (4-hour, 6-hour...) are built from the hourly
ones by `Bucketed`, aligned to midnight UTC, and a bucket counts as finished only once every hour
in it has finished.
"""
from __future__ import annotations

import gzip
import json
import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

HOUR = timedelta(hours=1)


class MarketError(RuntimeError):
    pass


class KeysRefused(MarketError):
    """The data service turned the keys down: worth saying loudly, never papered over with old prices."""


@dataclass(frozen=True)
class Candle:
    t: datetime          # when the candle started (UTC)
    o: float
    h: float
    l: float             # noqa: E741 (low)
    c: float
    v: float = 0.0
    hours: int = 1       # how long the candle spans

    @property
    def closed_at(self) -> datetime:
        return self.t + self.hours * HOUR


def floor_hour(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)


def floor_to(dt: datetime, hours: int) -> datetime:
    """The start of the `hours`-long bucket holding dt, counted from midnight UTC."""
    f = floor_hour(dt)
    return f - (f.hour % hours) * HOUR


def aggregate(candles: List[Candle], hours: int) -> List[Candle]:
    """Hourly candles -> `hours`-long candles. A bucket is kept only when every hour in it is present."""
    if hours == 1:
        return list(candles)
    buckets: Dict[datetime, List[Candle]] = {}
    for c in sorted(candles, key=lambda c: c.t):
        buckets.setdefault(floor_to(c.t, hours), []).append(c)
    out = []
    for t, cs in sorted(buckets.items()):
        if len(cs) != hours or {c.t for c in cs} != {t + i * HOUR for i in range(hours)}:
            continue
        out.append(Candle(t, cs[0].o, max(c.h for c in cs), min(c.l for c in cs), cs[-1].c, sum(c.v for c in cs), hours))
    return out


class Bucketed:
    """A market of longer candles, built from an hourly market's candles (kept on disk by that market).

    The exchange leaves out an hour with no trades (or one it was down for), and that drops the whole bucket. So
    `recent` asks for a few more buckets than it needs and returns the last n whole ones: a missing day is skipped,
    the way a backtest skips it, instead of leaving a 300-day rule one candle short every day for 300 days.
    """

    SLACK = 0.1

    def __init__(self, inner, hours: int):
        self.inner, self.hours, self.name = inner, hours, inner.name

    def recent(self, coin: str, quote: str, now: datetime, n: int) -> List[Candle]:
        end = floor_to(now, self.hours)
        extra = max(5, int(n * self.SLACK))
        got = self.inner.history(coin, quote, end - (n + extra) * self.hours * HOUR, end)
        return [c for c in aggregate(got, self.hours) if c.closed_at <= now][-n:]

    def history(self, coin: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        start, end = floor_to(start, self.hours), floor_to(end, self.hours)
        return [c for c in aggregate(self.inner.history(coin, quote, start, end), self.hours)
                if start <= c.t and c.closed_at <= end]


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class Coinbase:
    """Coinbase Exchange public candles: GET /products/BTC-USD/candles?granularity=3600."""

    name = "coinbase"
    BASE = "https://api.exchange.coinbase.com"
    PER_CALL = 300
    BACKOFF = (1, 3, 10, None)

    def __init__(self, http=None, cache_dir: Optional[Path] = None):
        if http is None:
            import requests

            http = requests.Session()
        self.http, self.cache_dir = http, cache_dir

    def _get(self, coin: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        url = f"{self.BASE}/products/{coin}-{quote}/candles"
        for wait in self.BACKOFF:                      # a long history test asks a lot: slow down when told to
            try:
                resp = self.http.request("GET", url, params={"granularity": 3600, "start": _iso(start),
                                                             "end": _iso(end)},
                                         headers={"User-Agent": "majors-desk/1.0", "Accept": "application/json"},
                                         timeout=20)
            except OSError as exc:
                raise MarketError(f"can't reach Coinbase ({type(exc).__name__})") from exc
            if resp.status_code != 429 or wait is None:
                break
            time.sleep(wait)
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
        cached = {c.t: c for c in self._load_cache(coin, quote)}
        finished = datetime.now(timezone.utc)
        t = start
        while t < end:
            chunk_end = min(end, t + self.PER_CALL * HOUR)
            want = {t + i * HOUR for i in range(int((chunk_end - t) / HOUR))}
            if not want <= cached.keys():
                for c in self._get(coin, quote, t, chunk_end):
                    if c.closed_at <= finished:          # never keep the hour that's still trading: it would stick
                        cached[c.t] = c
            t = chunk_end
        cached = sorted(cached.values(), key=lambda c: c.t)
        self._save_cache(coin, quote, cached)
        return [c for c in cached if start <= c.t and c.closed_at <= end]

    def _cache_path(self, coin: str, quote: str) -> Optional[Path]:
        return self.cache_dir / f"{coin}-{quote}.json.gz" if self.cache_dir else None

    HEAL_DAYS = 40

    def _load_cache(self, coin: str, quote: str) -> List[Candle]:
        p = self._cache_path(coin, quote)
        if not p or not p.exists():
            return []
        raw = json.loads(gzip.decompress(p.read_bytes()))
        rows = raw["rows"] if isinstance(raw, dict) else raw
        out = [Candle(datetime.fromtimestamp(r[0], timezone.utc), *r[1:]) for r in rows]
        if not isinstance(raw, dict):    # saved before 22 Oct 2026, when a half-made hour could stick: get the
            cut = datetime.now(timezone.utc) - timedelta(days=self.HEAL_DAYS)   # weeks the desks ran again
            out = [c for c in out if c.t < cut]
        return out

    def _save_cache(self, coin: str, quote: str, candles: List[Candle]) -> None:
        p = self._cache_path(coin, quote)
        if not p:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        rows = [[int(c.t.timestamp()), c.o, c.h, c.l, c.c, c.v] for c in candles]
        tmp = p.with_suffix(p.suffix + ".tmp")          # two desks may share this cache: never leave it half-written
        tmp.write_bytes(gzip.compress(json.dumps({"v": 2, "rows": rows}).encode()))
        tmp.replace(p)


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


DAY = timedelta(days=1)


def alpaca_keys(env_file: Optional[Path] = None) -> tuple:
    """(key id, secret) from the environment, else from the stock scanner's .env, where server/keys.sh puts them."""
    import os

    key, secret = os.getenv("ALPACA_API_KEY", ""), os.getenv("ALPACA_SECRET_KEY", "")
    env_file = env_file or Path(__file__).resolve().parent.parent.parent / "premarket-scanner" / ".env"
    if not (key and secret) and env_file.exists():
        vals = {}
        for line in env_file.read_text(encoding="utf-8").splitlines():
            k, sep, v = line.strip().partition("=")
            if sep and not k.startswith("#"):
                vals[k.strip()] = v.strip().strip('"').strip("'")
        key, secret = key or vals.get("ALPACA_API_KEY", ""), secret or vals.get("ALPACA_SECRET_KEY", "")
    return key, secret


class AlpacaDaily:
    """Daily stock and fund bars from Alpaca's market data (the free paper account's keys are enough).

    One candle per trading day, split- and dividend-adjusted, dated midnight UTC of its New York date, so it
    counts as finished at the following midnight UTC: hours after the 4pm close, never while it's trading.
    Weekends and holidays simply have no candle, so a 150-candle average is 150 trading days. The free plan
    may read the consolidated (SIP) feed up to 15 minutes ago, which is all a daily decision needs.
    """

    name = "alpaca"
    BASE = "https://data.alpaca.markets"
    hours = 24
    warmup = 1.5                 # calendar days per trading day, with room for holidays

    def __init__(self, key: str = "", secret: str = "", http=None, cache_dir: Optional[Path] = None):
        if not key or not secret:
            key, secret = alpaca_keys()
        if not key or not secret:
            raise MarketError("no Alpaca keys: run bash server/keys.sh (the free paper account's keys)")
        if http is None:
            import requests

            http = requests.Session()
        self.http, self.cache_dir = http, cache_dir
        self.headers = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret, "Accept": "application/json",
                        "User-Agent": "majors-desk/1.0"}

    def _get(self, symbol: str, start: datetime, end: datetime) -> List[Candle]:
        end = min(end, datetime.now(timezone.utc) - timedelta(minutes=16))
        out, token = [], None
        while True:
            params = {"symbols": symbol, "timeframe": "1Day", "start": _iso(start), "end": _iso(end),
                      "feed": "sip", "adjustment": "all", "limit": 10000}
            if token:
                params["page_token"] = token
            try:
                resp = self.http.request("GET", f"{self.BASE}/v2/stocks/bars", params=params, headers=self.headers,
                                         timeout=20)
            except OSError as exc:
                raise MarketError(f"can't reach Alpaca ({type(exc).__name__})") from exc
            if resp.status_code in (401, 403):
                raise KeysRefused(f"Alpaca refused the keys ({resp.status_code}): run bash server/keys.sh again")
            if resp.status_code != 200:
                raise MarketError(f"Alpaca answered {resp.status_code} for {symbol}")
            data = resp.json()
            for r in (data.get("bars") or {}).get(symbol, []):
                day = datetime.fromisoformat(r["t"].replace("Z", "+00:00")).astimezone(_NEW_YORK).date()
                out.append(Candle(datetime(day.year, day.month, day.day, tzinfo=timezone.utc), float(r["o"]),
                                  float(r["h"]), float(r["l"]), float(r["c"]), float(r.get("v", 0)), 24))
            token = data.get("next_page_token")
            if not token:
                return sorted(out, key=lambda c: c.t)

    def recent(self, symbol: str, quote: str, now: datetime, n: int) -> List[Candle]:
        """The last n finished trading days before `now`."""
        got = self.history(symbol, quote, now - timedelta(days=int(n * self.warmup) + 10), now)
        return got[-n:]

    def history(self, symbol: str, quote: str, start: datetime, end: datetime) -> List[Candle]:
        """Every finished trading day from start to end (kept on disk; only the newest days are fetched again)."""
        start = start.astimezone(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        cached, since = self._load_cache(symbol)
        if not cached or start < cached[0].t - 4 * DAY:
            fetch_from = start                                  # nothing usable on disk: the whole stretch
        else:
            fetch_from = max(cached[0].t, (since or cached[-1].t) - 4 * DAY)   # a few days back, for late fixes
        now = datetime.now(timezone.utc)
        if fetch_from < min(end, now) - timedelta(hours=1):
            try:
                fresh = {c.t: c for c in self._get(symbol, fetch_from, end)}
            except KeysRefused:
                raise
            except MarketError:
                if not cached or fetch_from == start:
                    raise
                fresh = {}                                      # a hiccup: decide on what's on disk, ask again tomorrow
            if not fresh and not cached:
                raise MarketError(f"Alpaca has no daily bars for {symbol}")
            merged = {c.t: c for c in cached}
            merged.update(fresh)
            cached = sorted(merged.values(), key=lambda c: c.t)
            if fresh:
                self._save_cache(symbol, cached, min(end, now))
        return [c for c in cached if start <= c.t and c.closed_at <= end]

    def _cache_path(self, symbol: str) -> Optional[Path]:
        return self.cache_dir / f"stock-{symbol}-1d.json.gz" if self.cache_dir else None

    def _load_cache(self, symbol: str) -> tuple:
        p = self._cache_path(symbol)
        if not p or not p.exists():
            return [], None
        raw = json.loads(gzip.decompress(p.read_bytes()))
        since = datetime.fromtimestamp(raw["through"], timezone.utc) if raw.get("through") else None
        return [Candle(datetime.fromtimestamp(r[0], timezone.utc), *r[1:], 24) for r in raw["bars"]], since

    def _save_cache(self, symbol: str, candles: List[Candle], through: datetime) -> None:
        p = self._cache_path(symbol)
        if not p:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        rows = [[int(c.t.timestamp()), c.o, c.h, c.l, c.c, c.v] for c in candles]
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_bytes(gzip.compress(json.dumps({"through": int(through.timestamp()), "bars": rows}).encode()))
        tmp.replace(p)


try:
    from zoneinfo import ZoneInfo

    _NEW_YORK = ZoneInfo("America/New_York")
except Exception:  # noqa: BLE001 - no time zone database: New York is UTC-4 or -5, and -4 never moves a bar's date
    _NEW_YORK = timezone(timedelta(hours=-4))
