"""The bar every desk has to clear: what $100 of BTC, bought when the paper book started and simply held,
is worth now. Prices come from Coinbase's public API; no key needed.

The start is the moment the desks first started trading on this machine (the first point of their equity
records, or the first trade), saved in output/benchmark.json so it never moves. fresh-start.sh archives that
file, so a fresh start gets a fresh benchmark.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

import paperbook as pb

COINBASE = "https://api.exchange.coinbase.com"
FILE = "benchmark.json"
Fetch = Callable[[str], object]


def fetch_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "paper-book/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def btc_at(when: datetime, fetch: Fetch) -> Optional[float]:
    """BTC's price at a past moment: the open of the five-minute candle it falls in."""
    start = when.astimezone(timezone.utc).replace(second=0, microsecond=0)
    start -= timedelta(minutes=start.minute % 5)
    q = urllib.parse.urlencode({"granularity": 300, "start": start.isoformat(), "end": (start + timedelta(minutes=10)).isoformat()})
    rows = fetch(f"{COINBASE}/products/BTC-USD/candles?{q}")
    if not isinstance(rows, list) or not rows:
        return None
    first = min(rows, key=lambda r: r[0])                   # [time, low, high, open, close, volume]
    return float(first[3])


def btc_now(fetch: Fetch) -> Optional[float]:
    data = fetch(f"{COINBASE}/products/BTC-USD/ticker")
    return float(data["price"]) if isinstance(data, dict) and data.get("price") else None


def started(book: pb.Book) -> datetime:
    """When the desks started: the earliest equity point, trade or open position we can find."""
    times = [t.opened for d in pb.DESKS for t in book.trades[d]] + [h.opened for d in pb.DESKS for h in book.held[d]]
    for d in ("memecoins", "majors"):
        state = Path(book.sources.get(d, "")) / "state.json"
        try:
            points = json.loads(state.read_text()).get("equity") or []
            if points:
                t = datetime.fromisoformat(points[0][0])
                times.append(t if t.tzinfo else t.replace(tzinfo=timezone.utc))
        except (OSError, ValueError, KeyError, IndexError, TypeError):
            pass
    return min(times) if times else book.now


def load(out: Path, book: pb.Book, fetch: Optional[Fetch] = None) -> Optional[dict]:
    """{"since", "btc_start", "btc_now", "pct"}, or None in demo mode or when Coinbase can't be reached."""
    if book.demo:
        return None
    fetch = fetch or fetch_json
    path = out / FILE
    try:
        saved = json.loads(path.read_text())
    except (OSError, ValueError):
        saved = None
    try:
        if not saved:
            since = started(book)
            p0 = btc_at(since, fetch)
            if not p0:
                return None
            saved = {"since": since.isoformat(), "btc_start": p0}
            out.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(saved))
        p1 = btc_now(fetch)
    except Exception:  # offline, rate-limited, or Coinbase changed: the book works without it
        return None
    if not p1:
        return None
    return {**saved, "btc_now": p1, "pct": round((p1 / saved["btc_start"] - 1) * 100, 2)}


def desk_return(book: pb.Book, desk: str) -> float:
    """A desk's result since it started, open positions marked at the last price, as % of its bank."""
    net = sum(t.pnl for t in book.trades[desk])
    open_ = sum(h.value - h.cost for h in book.held[desk] if h.value is not None)
    bank = book.banks[desk]
    return round((net + open_) / bank * 100, 2) if bank else 0.0


def line(book: pb.Book) -> str:
    b = book.benchmark
    if not b:
        return ""
    since = datetime.fromisoformat(b["since"]).astimezone(book.tz)
    return (f"BTC bought {since:%a %d %b %H:%M} and held: {b['pct']:+.1f}% · "
            f"big coins desk: {desk_return(book, 'majors'):+.1f}%")
