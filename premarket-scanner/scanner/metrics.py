"""Turns raw intraday bars into the numbers the rules are judged on.

Everything is computed from the same 5-minute bars (extended hours included),
so the math is identical whichever data provider supplied them.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Dict, List, Optional

from .market import ET, RTH_CLOSE, RTH_OPEN, session_window
from .models import Bar, Metrics

# "Normal" volume for a quiet window (e.g. pre-market on an ordinary day) can
# be ~0, which would make any activity look like infinite RVOL. Floor the
# expected volume at 0.5% of average daily volume, and never below 1,000 shares.
EXPECTED_FLOOR_ADV_SHARE = 0.005
EXPECTED_FLOOR_SHARES = 1_000


def by_day(bars: List[Bar]) -> Dict[date, List[Bar]]:
    days: Dict[date, List[Bar]] = defaultdict(list)
    for b in sorted(bars, key=lambda b: b.start):
        days[b.start.astimezone(ET).date()].append(b)
    return days


def is_rth(bar: Bar) -> bool:
    t = bar.start.astimezone(ET).time()
    return RTH_OPEN <= t < RTH_CLOSE


def rth_bars(day_bars: List[Bar]) -> List[Bar]:
    return [b for b in day_bars if is_rth(b)]


def compute(bars: List[Bar], session: str, asof: datetime, lookback_days: int) -> Optional[Metrics]:
    """Metrics for one symbol, or None if it hasn't traded this session."""
    days = by_day(bars)
    today = asof.astimezone(ET).date()
    s_start, s_end = session_window(session, today)
    cutoff = min(asof, s_end)

    session_bars = [b for b in days.get(today, []) if s_start <= b.start < cutoff]
    if not session_bars:
        return None

    prior = sorted((d for d, bs in days.items() if d < today and rth_bars(bs)), reverse=True)
    prior = prior[:lookback_days]

    if session == "afterhours":
        today_rth = rth_bars(days.get(today, []))
        if not today_rth:
            return None
        ref_close = today_rth[-1].close
    else:
        if not prior:
            return None
        ref_close = rth_bars(days[prior[0]])[-1].close
    if ref_close <= 0:
        return None

    price = session_bars[-1].close
    session_volume = sum(b.volume for b in session_bars)

    # Same clock window on each prior day: e.g. 4:00-8:45am ET vs 4:00-8:45am ET.
    elapsed = cutoff - s_start
    window_vols, day_vols = [], []
    for d in prior:
        d_start, _ = session_window(session, d)
        d_end = d_start + elapsed
        window_vols.append(sum(b.volume for b in days[d] if d_start <= b.start < d_end))
        day_vols.append(sum(b.volume for b in days[d]))
    adv = sum(day_vols) / len(day_vols) if day_vols else 0.0
    expected = sum(window_vols) / len(window_vols) if window_vols else 0.0
    floor = max(adv * EXPECTED_FLOOR_ADV_SHARE, EXPECTED_FLOOR_SHARES)

    return Metrics(
        price=price,
        ref_close=ref_close,
        gap_pct=(price / ref_close - 1) * 100,
        session_volume=session_volume,
        expected_volume=expected,
        rvol=session_volume / max(expected, floor),
        avg_daily_volume=adv,
        session_high=max(b.high for b in session_bars),
        days_used=len(prior),
    )
