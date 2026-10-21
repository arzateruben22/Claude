"""The scan pipeline.

1. screen     — one cheap pass over the whole market (provider snapshot)
2. pre-filter — loose price/gap cut, keep the top `max_candidates` gappers
3. bars       — 5-minute bars (with extended hours) for those candidates
4. metrics    — exact gap, time-of-day RVOL, session volume (metrics.py)
5. halts      — Nasdaq's halt feed; spread comes with the snapshot quote
6. enrich     — news + float, only for names within one rule of passing
7. judge      — apply criteria.toml, rank, collect near misses
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from . import metrics as metrics_mod
from .config import Criteria
from .criteria import evaluate, rank, symbol_allowed, tag_news
from .market import ET, previous_trading_day
from .models import Candidate, Quote, ScanResult
from .providers.base import Provider

# The pre-filter is deliberately looser than the rules so near misses survive
# it (snapshot numbers are also a little rougher than the bar-based ones).
LOOSE_GAP = 0.6
LOOSE_PRICE_LOW, LOOSE_PRICE_HIGH = 0.75, 1.25
MAX_NEAR_MISSES = 10


def quick_failures(c: Candidate, crit: Criteria) -> int:
    """Rules judged before the per-symbol news/float lookups."""
    m = c.metrics
    return sum(
        [
            not (crit.min_price <= m.price <= crit.max_price),
            m.gap_pct < crit.min_gap_pct,
            m.rvol < crit.min_rvol,
            m.session_volume < crit.min_session_volume,
            c.spread_pct is not None and c.spread_pct > crit.max_spread_pct,
            bool(c.halted_now) and crit.exclude_halted,
        ]
    )


def _prefilter(quotes: List[Quote], crit: Criteria):
    """The loose cut and the top gappers one rulebook would look at in detail."""
    pool = []
    for q in quotes:
        if not symbol_allowed(q.symbol, q.name, crit.exclude_warrants_units):
            continue
        if not (crit.min_price * LOOSE_PRICE_LOW <= q.price <= crit.max_price * LOOSE_PRICE_HIGH):
            continue
        gaps = [(q.price / r - 1) * 100 for r in (q.ref_close, q.alt_ref_close) if r]
        if gaps and max(gaps) >= crit.min_gap_pct * LOOSE_GAP:
            pool.append((max(gaps), q))
    pool.sort(key=lambda x: x[0], reverse=True)
    return pool, {q.symbol: q for _, q in pool[: crit.max_candidates]}


def run_scan(provider: Provider, crit: Criteria, now: datetime, session: str,
             quotes: Optional[List[Quote]] = None) -> ScanResult:
    """`quotes` replaces the live screen (backtests pass a historical one)."""
    return run_scans(provider, {"main": crit}, now, session, quotes)["main"]


def run_scans(provider: Provider, crits: Dict[str, Criteria], now: datetime, session: str,
              quotes: Optional[List[Quote]] = None) -> Dict[str, ScanResult]:
    """Several rulebooks over one market read. Each book picks its own candidates exactly as it would alone;
    the bars, halts, news and floats those picks need are fetched once and shared, so ten books cost the
    provider about what one does."""
    asof = now - timedelta(minutes=provider.delay_minutes)
    if quotes is None:
        quotes = provider.screen(now, session)

    picks = {}                                   # book -> its own top gappers
    notes: Dict[str, List[str]] = {}
    for name, crit in crits.items():
        pool, picked = _prefilter(quotes, crit)
        picks[name] = picked
        notes[name] = []
        if len(pool) > crit.max_candidates:
            notes[name].append(f"{len(pool)} loose gappers; checked the top {crit.max_candidates} "
                               "(raise max_candidates to see more)")

    every = {}                                   # symbol -> quote, across every book
    for picked in picks.values():
        every.update(picked)
    lookback = max(c.lookback_days for c in crits.values())
    metrics: Dict[str, Optional[object]] = {}
    if every:
        # ~1.4 calendar days per trading day, plus slack for holidays.
        start = asof - timedelta(days=int(lookback * 1.4) + 5)
        bars = provider.intraday_bars(list(every), start, asof)
        for sym in every:
            metrics[sym] = metrics_mod.compute(bars.get(sym, []), session, asof, lookback)

    halts, halt_note = {}, ""
    if any(m is not None for m in metrics.values()):
        today = now.astimezone(ET).date()
        try:
            halts = provider.halts([previous_trading_day(today), today])
        except Exception as exc:  # optional data: never sink the scan over it
            halt_note = f"Halt check unavailable ({str(exc)[:80]}); halted stocks aren't filtered this run"

    def candidate(sym: str) -> Optional[Candidate]:
        m = metrics.get(sym)
        if m is None:
            return None
        q = every[sym]
        c = Candidate(sym, q.name, copy.copy(m), spread_pct=q.spread_pct)
        hs = halts.get(sym, [])
        active = [h for h in hs if h.active(now)]
        c.halted_now = active[-1].code if active else ""
        c.halts = [h for h in hs if h.halted_at <= now and not h.active(now)]  # never the future
        return c

    cands = {name: [c for c in (candidate(s) for s in picks[name]) if c] for name in crits}
    enrich = {name: [c for c in cs if quick_failures(c, crits[name]) <= 1] for name, cs in cands.items()}
    syms = sorted({c.symbol for cs in enrich.values() for c in cs})
    news, floats = {}, {}
    if syms:
        hours = max(c.news_lookback_hours for c in crits.values())
        news = provider.news(syms, now - timedelta(hours=hours), until=now)
        floats = provider.floats(syms)

    out = {}
    for name, crit in crits.items():
        since = now - timedelta(hours=crit.news_lookback_hours)
        for c in enrich[name]:
            c.news = sorted((n for n in news.get(c.symbol, []) if n.published >= since),
                            key=lambda n: n.published, reverse=True)
            c.tags = tag_news(c.news, crit.catalysts)
            c.float_shares = floats.get(c.symbol)
        for c in cands[name]:
            evaluate(c, crit)
        passed = rank([c for c in cands[name] if c.passed], crit.sort_by)
        near = rank([c for c in cands[name] if len(c.failures) == 1], crit.sort_by) if crit.show_near_misses else []
        out[name] = ScanResult(
            session=session,
            now=now,
            asof=asof,
            provider=provider.name,
            delay_minutes=provider.delay_minutes,
            universe=len(quotes),
            checked=len(cands[name]),
            passed=passed,
            near_misses=near[:MAX_NEAR_MISSES],
            notes=notes[name] + ([halt_note] if halt_note else []),
        )
    return out
