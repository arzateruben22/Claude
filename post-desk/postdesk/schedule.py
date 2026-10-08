"""SCHEDULE: when today's posts go out.

Slots spread across your active hours with a minimum gap. Once the analyst knows which
hours do well, most slots move there; a share stays on untested hours so the desk keeps
learning. A little jitter keeps the account from posting at the same minute every day.
"""
from __future__ import annotations

import random
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from .config import ScheduleCfg, parse_hours

MIN_SAMPLES = 3      # posts an hour needs before its score counts


def plan_day(day: date, cfg: ScheduleCfg, tz: ZoneInfo, hour_scores: Optional[Dict[int, tuple]] = None,
             seed: int = 0) -> List[datetime]:
    """Posting times for one local day, as UTC datetimes, earliest first.

    hour_scores: {local hour: (average impressions, number of posts)} from the analyst.
    """
    n = cfg.posts_per_day
    if n <= 0:
        return []
    r = random.Random(day.toordinal() * 7919 + seed)
    a, b = parse_hours(cfg.active_hours)
    hours = [h for h in range(24) if a <= h * 60 < b]
    known = {h: s for h, s in (hour_scores or {}).items() if h in hours and s[1] >= MIN_SAMPLES}

    if len(known) >= 4:
        exploit = round(n * (1 - cfg.explore_share))
        best = sorted(known, key=lambda h: known[h][0], reverse=True)
        untested = [h for h in hours if h not in known]
        r.shuffle(untested)
        others = best[exploit:]
        r.shuffle(others)
        order = best[:exploit] + untested + others       # best hours, then a few to keep testing
        out: List[float] = []
        for h in order:
            lo, hi = max(a, h * 60), min(b - 1, h * 60 + 59)
            tries = [lo + r.randint(0, hi - lo)] + list(range(lo, hi + 1, 5))
            m = next((m for m in tries if all(abs(m - x) >= cfg.min_gap_minutes for x in out)), None)
            if m is not None:
                out.append(m)
            if len(out) == n:
                break
        out.sort()
    else:
        step = (b - a) / n
        minutes = sorted(a + step * (i + 0.5) + r.uniform(-cfg.jitter_minutes, cfg.jitter_minutes) for i in range(n))
        out = []
        for m in minutes:                   # keep the gap and stay inside the window
            m = max(m, a, (out[-1] + cfg.min_gap_minutes) if out else a)
            if m < b:
                out.append(m)
    start = datetime.combine(day, time(0), tzinfo=tz)
    return [(start + timedelta(minutes=m)).astimezone(timezone.utc).replace(microsecond=0) for m in out]


def local_day(now: datetime, tz: ZoneInfo) -> date:
    return now.astimezone(tz).date()
