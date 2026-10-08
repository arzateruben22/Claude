"""Backtest: replay past days through the exact live pipeline, then grade them.

Each past day runs the same engine, rules and grading as a live scan. The only
difference is where the market-wide screen comes from (history instead of a
live snapshot).

No peeking at the future — each rule is enforced below or in the engine:
  1. The screen only sees 15-minute bars that had *finished* by scan time.
  2. Metrics only use 5-minute bars that started before scan time (metrics.py).
  3. News is cut off at scan time (engine passes until=now).
  4. Halts after scan time are ignored (engine).
  5. A day's picks are graded only after its scan is complete.
Biases this data can't remove (printed with every report):
  - float is today's float, not the float on that day
  - historical spreads aren't fetched; the sim charges cost_pct instead
  - delisted stocks are included where the provider still lists them, but
    some are missing, which flatters results
"""
from __future__ import annotations

import gzip
import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from . import gates, journal
from .config import CACHE, OUTPUT, Criteria
from .engine import run_scan
from .market import ET, PT, is_trading_day, previous_trading_day, session_window, trade_date_for
from .models import Bar, Halt, NewsItem, Quote
from .providers.base import Provider, ProviderError, iso, parse_ts

CACHE_DIR = CACHE / "backtest"
SCREEN_STEP = timedelta(minutes=15)
# Stocks priced outside this band the day before can't plausibly reach the
# rules' price range; skipping them keeps the history download small.
UNIVERSE_PRICE = (0.5, 100.0)


# --- on-disk cache ------------------------------------------------------------

def _read_gz(path: Path):
    try:
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _write_gz(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with gzip.open(tmp, "wt", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    tmp.replace(path)


def _enc(bars: List[Bar]) -> list:
    return [[int(b.start.timestamp()), b.open, b.high, b.low, b.close, b.volume] for b in bars]


def _dec(rows: list) -> List[Bar]:
    return [Bar(datetime.fromtimestamp(r[0], tz=timezone.utc), *r[1:]) for r in rows]


class CachedProvider:
    """Wraps a real provider: 5-minute bars, news and halts are fetched once
    and kept in .cache/backtest, so re-running with new rules takes minutes."""

    def __init__(self, provider: Provider, folder: Path = CACHE_DIR):
        self.p = provider
        self.folder = folder
        self._days: Dict[date, dict] = {}

    def __getattr__(self, name):  # everything not overridden goes straight through
        return getattr(self.p, name)

    # 5-minute bars, stored per trading day as {symbol: rows}
    def _day(self, d: date) -> dict:
        if d not in self._days:
            if len(self._days) > 40:  # keep memory flat on long runs
                self._days.pop(min(self._days))
            self._days[d] = _read_gz(self.folder / "bars" / f"{d}.json.gz") or {}
        return self._days[d]

    def intraday_bars(self, symbols: Sequence[str], start: datetime, end: datetime) -> Dict[str, List[Bar]]:
        days = []
        d = start.astimezone(ET).date()
        while d <= end.astimezone(ET).date():
            if is_trading_day(d):
                days.append(d)
            d += timedelta(days=1)
        missing = [(s, d) for d in days for s in symbols if s not in self._day(d)]
        if missing:
            syms = sorted({s for s, _ in missing})
            first = min(d for _, d in missing)
            # Always fetch whole days so the cache never holds a partial one;
            # the filter below still hides anything after `end`.
            got = self.p.intraday_bars(syms, datetime.combine(first, time(4), tzinfo=ET),
                                       datetime.combine(days[-1], time(20), tzinfo=ET))
            touched = set()
            today = datetime.now(ET).date()
            for s in syms:
                per_day: Dict[date, List[Bar]] = {}
                for b in got.get(s, []):
                    per_day.setdefault(b.start.astimezone(ET).date(), []).append(b)
                for d in days:
                    if d >= first and s not in self._day(d):
                        self._day(d)[s] = _enc(per_day.get(d, []))
                        touched.add(d)
            for d in touched:
                if d < today:  # an unfinished day stays in memory only, never on disk
                    _write_gz(self.folder / "bars" / f"{d}.json.gz", self._day(d))
        return {s: [b for d in days for b in _dec(self._day(d).get(s, [])) if start <= b.start < end]
                for s in symbols}

    def news(self, symbols: Sequence[str], since: datetime, until: Optional[datetime] = None) -> Dict[str, List[NewsItem]]:
        until = until or datetime.now(timezone.utc)
        path = self.folder / "news" / f"{until.astimezone(ET).date()}.json.gz"
        store = _read_gz(path) or {}
        key = lambda s: f"{s}|{iso(since)}|{iso(until)}"  # noqa: E731
        todo = [s for s in symbols if key(s) not in store]
        if todo:
            got = self.p.news(todo, since, until)
            for s in todo:
                store[key(s)] = [[n.headline, iso(n.published), n.source, n.url] for n in got.get(s, [])]
            _write_gz(path, store)
        return {s: [NewsItem(h, parse_ts(p), src, url) for h, p, src, url in store[key(s)]]
                for s in symbols if store.get(key(s))}

    def halts(self, days: Sequence[date]) -> Dict[str, List[Halt]]:
        out: Dict[str, List[Halt]] = {}
        for d in days:
            path = self.folder / "halts" / f"{d}.json.gz"
            rows = _read_gz(path)
            if rows is None:
                fetched = self.p.halts([d])
                rows = [[h.symbol, h.code, iso(h.halted_at), iso(h.resumed_at) if h.resumed_at else None]
                        for hs in fetched.values() for h in hs]
                _write_gz(path, rows)
            for sym, code, at, back in rows:
                out.setdefault(sym, []).append(Halt(sym, code, parse_ts(at), parse_ts(back)))
        return out


# --- the historical screen -------------------------------------------------------

def universe_of(provider) -> Dict[str, str]:
    if hasattr(provider, "universe"):
        return dict(provider.universe(include_inactive=True))
    if getattr(provider, "name", "") == "demo":
        return {s: sp.name for s, sp in provider.specs.items()}
    raise ProviderError(
        "Backtests need the Alpaca provider (free): it can pull the whole market's history in bulk. "
        "Massive's API would take one request per stock per day."
    )


def daily_closes(provider, symbols: Sequence[str], first: date, last: date) -> Dict[date, Dict[str, float]]:
    got = provider.bars(list(symbols), datetime.combine(first, time(0), tzinfo=ET),
                        datetime.combine(last + timedelta(days=1), time(0), tzinfo=ET), "1Day")
    out: Dict[date, Dict[str, float]] = {}
    for s, bars in got.items():
        for b in bars:
            out.setdefault(b.start.astimezone(ET).date(), {})[s] = b.close
    return out


def screen_cutoff(now: datetime, session: str) -> datetime:
    """Scan time rounded down to a 15-minute boundary, capped at session end."""
    _, s_end = session_window(session, now.astimezone(ET).date())
    t = min(now, s_end).astimezone(ET)
    return t.replace(minute=t.minute - t.minute % 15, second=0, microsecond=0)


def historical_screen(provider, names: Dict[str, str], closes: Dict[date, Dict[str, float]],
                      now: datetime, session: str) -> List[Quote]:
    """What a live snapshot would have shown at `now`, rebuilt from history."""
    today = now.astimezone(ET).date()
    prev = previous_trading_day(today)
    s_start, _ = session_window(session, today)
    cutoff = screen_cutoff(now, session)
    lo, hi = UNIVERSE_PRICE
    symbols = [s for s in names if lo <= closes.get(prev, {}).get(s, 0) <= hi]
    if cutoff <= s_start or not symbols:
        return []
    got = provider.bars(symbols, s_start, cutoff, "15Min")
    quotes = []
    for s, bars in got.items():
        done = [b for b in bars if b.start + SCREEN_STEP <= cutoff]  # rule 1: finished bars only
        if not done:
            continue
        if session == "afterhours":
            ref, alt = closes.get(today, {}).get(s), closes.get(prev, {}).get(s)
        else:
            ref, alt = closes.get(prev, {}).get(s), None
        quotes.append(Quote(s, done[-1].close, ref, alt, name=names.get(s, "")))
    return quotes


# --- runner ------------------------------------------------------------------------

def trading_days(first: date, last: date) -> List[date]:
    out, d = [], first
    while d <= last:
        if is_trading_day(d):
            out.append(d)
        d += timedelta(days=1)
    return out


def run_backtest(provider: Provider, crit: Criteria, first: date, last: date, session: str = "premarket",
                 at: time = time(5, 45), out_dir: Optional[Path] = None,
                 log: Callable[[str], None] = print) -> Tuple[Path, str]:
    """Returns (folder with journal.csv + summary.md, stats text)."""
    days = trading_days(first, last)
    if not days:
        raise ProviderError(f"No trading days between {first} and {last}.")
    demo = getattr(provider, "name", "") == "demo"
    source = provider if demo else CachedProvider(provider)
    names = universe_of(source)
    label = f"{first}_{last}_{session}_{at.strftime('%H%M')}"
    out_dir = out_dir or (OUTPUT / ("demo" if demo else "") / "backtests" / label)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "journal.csv"
    path.unlink(missing_ok=True)
    rid = gates.rules_id(crit)
    (out_dir / "rules.json").write_text(json.dumps({
        "id": rid, "created": datetime.now(timezone.utc).isoformat(), "first": first.isoformat(),
        "last": last.isoformat(), "session": session, "at": at.strftime("%H:%M"),
        "provider": getattr(provider, "name", "?"), "rules": crit.summary()}, indent=1))

    # On delayed (free) data, the live scan at 5:45 sees the market as of 5:30;
    # the backtest's screen does too.
    delay = timedelta(minutes=getattr(source, "delay_minutes", 0))
    month_closes: Dict[str, Dict[date, Dict[str, float]]] = {}
    for i, d in enumerate(days, 1):
        now = datetime.combine(d, at, tzinfo=PT)
        if hasattr(source, "prepare"):
            source.prepare(now, session)
        cache_file = CACHE_DIR / "screens" / f"{d}_{session}_{screen_cutoff(now - delay, session):%H%M}.json.gz"
        cached = None if demo else _read_gz(cache_file)
        if cached is not None:
            quotes = [Quote(s, p, r, a, name=names.get(s, "")) for s, p, r, a in cached]
        else:
            if demo:  # the demo re-scripts each day, so closes can't be reused
                closes = daily_closes(source, list(names), previous_trading_day(d), d)
            else:  # one bulk download per month, kept in memory while needed
                month = f"{d:%Y-%m}"
                if month not in month_closes:
                    month_closes.clear()
                    m_first = previous_trading_day(max(first, d.replace(day=1)))
                    m_last = min(last, (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1))
                    log(f"  downloading daily closes for {month} ({len(names):,} symbols)...")
                    month_closes[month] = daily_closes(source, list(names), m_first, m_last)
                closes = month_closes[month]
            quotes = historical_screen(source, names, closes, now - delay, session)
            if not demo:
                _write_gz(cache_file, [[q.symbol, q.price, q.ref_close, q.alt_ref_close] for q in quotes])

        res = run_scan(source, crit, now, session, quotes=quotes)
        journal.record(res, path, rules=rid)
        trade_day = trade_date_for(session, d)
        journal.grade(source, crit, datetime.combine(trade_day, time(20, 1), tzinfo=ET), path)
        graded = {r["symbol"]: r for r in journal._read(path) if r["scan_date"] == d.isoformat()}
        picks = ", ".join(
            f"{c.symbol} {c.metrics.gap_pct:+.0f}% → {graded[c.symbol]['sim_exit'] or 'n/a'}"
            f" {float(graded[c.symbol]['sim_pnl_pct'] or 0):+.1f}%"
            for c in res.passed if c.symbol in graded
        )
        log(f"[{i}/{len(days)}] {d}  {len(res.passed)} pick(s)" + (f": {picks}" if picks else ""))

    stats = journal.stats(crit, path)
    summary = "\n".join([
        f"# Backtest {first} → {last}", "",
        f"- Session: {session}, scan at {at:%H:%M} PT, provider: {getattr(provider, 'name', '?')}",
        f"- Rules: {crit.summary()}",
        f"- Trading days: {len(days)}", "",
        "```", stats, "```", "",
        "## Read this before trusting the numbers", "",
        "- Float is today's float, not the float on each past day.",
        "- Historical spreads aren't fetched; every trade is charged "
        f"{crit.cost_pct:g}% instead.",
        "- Some delisted stocks are missing from the data, which makes results look better.",
        "- The sim buys the exact open. Real fills on fast small caps are often worse.",
        "",
    ])
    (out_dir / "summary.md").write_text(summary, encoding="utf-8")
    return out_dir, stats
