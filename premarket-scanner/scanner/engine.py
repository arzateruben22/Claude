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

from datetime import datetime, timedelta
from typing import List

from . import metrics as metrics_mod
from .config import Criteria
from .criteria import evaluate, rank, symbol_allowed, tag_news
from .market import ET, previous_trading_day
from .models import Candidate, ScanResult
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
    picked = {q.symbol: q for _, q in pool[: crit.max_candidates]}

    notes: List[str] = []
    if len(pool) > crit.max_candidates:
        notes.append(f"{len(pool)} loose gappers; checked the top {crit.max_candidates} (raise max_candidates to see more)")

    cands: List[Candidate] = []
    if picked:
        # ~1.4 calendar days per trading day, plus slack for holidays.
        start = asof - timedelta(days=int(crit.lookback_days * 1.4) + 5)
        bars = provider.intraday_bars(list(picked), start, asof)
        for sym, q in picked.items():
            m = metrics_mod.compute(bars.get(sym, []), session, asof, crit.lookback_days)
            if m is not None:
                cands.append(Candidate(sym, q.name, m, spread_pct=q.spread_pct))

    if cands:
        today = now.astimezone(ET).date()
        try:
            halts = provider.halts([previous_trading_day(today), today])
        except Exception as exc:  # optional data: never sink the scan over it
            halts = {}
            notes.append(f"Halt check unavailable ({str(exc)[:80]}); halted stocks aren't filtered this run")
        for c in cands:
            hs = halts.get(c.symbol, [])
            active = [h for h in hs if h.active(now)]
            c.halted_now = active[-1].code if active else ""
            c.halts = [h for h in hs if not h.active(now)]

    enrich = [c for c in cands if quick_failures(c, crit) <= 1]
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
