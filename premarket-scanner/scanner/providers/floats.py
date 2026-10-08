"""Float (tradable shares) lookup with a 7-day on-disk cache.

Sources, in order:
  1. Massive's free-float endpoint, if MASSIVE_API_KEY is set
  2. yfinance's `floatShares`, if the optional yfinance package is installed
Anything still unknown comes back as None (the rules flag it as "float ?").
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
from typing import Dict, List, Optional, Sequence

from ..config import CACHE
from .base import Http, ProviderError, chunks

CACHE_FILE = CACHE / "floats.json"
TTL_DAYS = 7
MISS_TTL_DAYS = 1  # retry unknowns tomorrow


def _load() -> dict:
    try:
        return json.loads(CACHE_FILE.read_text())
    except (OSError, ValueError):
        return {}


def _save(cache: dict) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=0, sort_keys=True))


def _fresh(entry, today: date) -> bool:
    value, stamp = entry
    ttl = TTL_DAYS if value is not None else MISS_TTL_DAYS
    return date.fromisoformat(stamp) > today - timedelta(days=ttl)


def from_massive(symbols: Sequence[str], key: str, http: Optional[Http] = None) -> Dict[str, float]:
    http = http or Http({"Authorization": f"Bearer {key}"})
    out: Dict[str, float] = {}
    for chunk in chunks(symbols, 100):
        data = http.get(
            "https://api.massive.com/stocks/vX/float",
            {"ticker.any_of": ",".join(chunk), "limit": 1000},
        )
        for row in data.get("results") or []:
            if row.get("ticker") and row.get("free_float"):
                out[row["ticker"]] = float(row["free_float"])
    return out


def from_yfinance(symbols: Sequence[str]) -> Dict[str, float]:
    try:
        import yfinance as yf
    except ImportError:
        return {}
    out: Dict[str, float] = {}
    for s in symbols:
        try:
            value = yf.Ticker(s).info.get("floatShares")
        except Exception:  # yfinance raises many things on missing/blocked data
            continue
        if value:
            out[s] = float(value)
    return out


def lookup(symbols: Sequence[str], today: Optional[date] = None) -> Dict[str, Optional[float]]:
    today = today or date.today()
    cache = _load()
    result: Dict[str, Optional[float]] = {}
    missing: List[str] = []
    for s in symbols:
        if s in cache and _fresh(cache[s], today):
            result[s] = cache[s][0]
        else:
            missing.append(s)

    found: Dict[str, float] = {}
    key = os.getenv("MASSIVE_API_KEY") or os.getenv("POLYGON_API_KEY")
    if missing and key:
        try:
            found.update(from_massive(missing, key))
        except ProviderError:
            pass  # plan may not include floats; fall through to yfinance
    still = [s for s in missing if s not in found]
    if still:
        found.update(from_yfinance(still))

    for s in missing:
        result[s] = found.get(s)
        cache[s] = [found.get(s), today.isoformat()]
    if missing:
        _save(cache)
    return result
