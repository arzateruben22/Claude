"""The scan pipeline.

1. screen     — one cheap pass over the whole market (provider snapshot)
2. pre-filter — loose price/gap cut, keep the top `max_candidates` gappers
3. bars       — 5-minute bars (with extended hours) for those candidates
4. metrics    — exact gap, time-of-day RVOL, session volume (metrics.py)
5. enrich     — news + float, only for names within one rule of passing
6. judge      — apply criteria.toml, rank, collect near misses
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from . import metrics as metrics_mod
from .config import Criteria
from .criteria import evaluate, rank, symbol_allowed, tag_news
from .models import Candidate, ScanResult
from .providers.base import Provider

# The pre-filter is deliberately looser than the rules so near misses survive
# it (snapshot numbers are also a little rougher than the bar-based ones).
LOOSE_GAP = 0.6
LOOSE_PRICE_LOW, LOOSE_PRICE_HIGH = 0.75, 1.25
MAX_NEAR_MISSES = 10


def bar_failures(c: Candidate, crit: Criteria) -> int:
    """Rules that can be judged from bars alone (before news/float lookups)."""
    m = c.metrics
    return sum(
        [
            not (crit.min_price <= m.price <= crit.max_price),
            m.gap_pct < crit.min_gap_pct,
            m.rvol < crit.min_rvol,
            m.session_volume < crit.min_session_volume,
        ]
    )


def run_scan(provider: Provider, crit: Criteria, now: datetime, session: str) -> ScanResult:
    asof = now - timedelta(minutes=provider.delay_minutes)
    quotes = provider.screen(now, session)

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
    picked = [q for _, q in pool[: crit.max_candidates]]
    names = {q.symbol: q.name for q in picked}

    notes: List[str] = []
    if len(pool) > crit.max_candidates:
        notes.append(f"{len(pool)} loose gappers; checked the top {crit.max_candidates} (raise max_candidates to see more)")

    cands: List[Candidate] = []
    if picked:
        # ~1.4 calendar days per trading day, plus slack for holidays.
        start = asof - timedelta(days=int(crit.lookback_days * 1.4) + 5)
        bars = provider.intraday_bars(list(names), start, asof)
        for sym in names:
            m = metrics_mod.compute(bars.get(sym, []), session, asof, crit.lookback_days)
            if m is not None:
                cands.append(Candidate(sym, names[sym], m))

    enrich = [c for c in cands if bar_failures(c, crit) <= 1]
    if enrich:
        syms = [c.symbol for c in enrich]
        news = provider.news(syms, now - timedelta(hours=crit.news_lookback_hours))
        floats = provider.floats(syms)
        for c in enrich:
            c.news = sorted(news.get(c.symbol, []), key=lambda n: n.published, reverse=True)
            c.tags = tag_news(c.news, crit.catalysts)
            c.float_shares = floats.get(c.symbol)

    for c in cands:
        evaluate(c, crit)
    passed = rank([c for c in cands if c.passed], crit.sort_by)
    near = rank([c for c in cands if len(c.failures) == 1], crit.sort_by) if crit.show_near_misses else []

    return ScanResult(
        session=session,
        now=now,
        asof=asof,
        provider=provider.name,
        delay_minutes=provider.delay_minutes,
        universe=len(quotes),
        checked=len(cands),
        passed=passed,
        near_misses=near[:MAX_NEAR_MISSES],
        notes=notes,
    )
