"""Offline demo data — fake tickers (all start with DM), realistic shapes.

Lets you see the full pipeline (scan -> watchlist -> journal -> grade) with no
API keys. Each stock has a scripted "event" in the scanned session; every
other day is an ordinary day. Deterministic: same inputs, same output.
"""
from __future__ import annotations

import random
import zlib
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Sequence, Tuple

from ..market import ET, is_trading_day, next_trading_day, session_window
from ..models import Bar, NewsItem, Quote
from .base import Provider

STEP = timedelta(minutes=5)
DAY_START, DAY_END = time(4, 0), time(20, 0)
# Share of a normal day's volume traded in each session.
SESSION_SHARE = {"premarket": 0.03, "regular": 0.94, "afterhours": 0.03}


@dataclass
class Spec:
    symbol: str
    name: str
    close: float        # last regular close before the event
    adv: float          # normal daily volume
    float_shares: Optional[float]
    gap: float          # move during the event session, e.g. 0.62 = +62%
    rvol: float         # event-session volume vs normal
    headline: str = ""  # "" = no news
    day_move: float = 0.0  # open->close drift on the trade day (for grading)


SPECS = [
    Spec("DMBIO", "Demo Biotherapeutics", 3.10, 900_000, 8.5e6, 0.62, 25,
         "Demo Biotherapeutics Announces Positive Phase 2 Topline Results", 0.14),
    Spec("DMAI", "Demo AI Systems", 5.40, 1_400_000, 14e6, 0.34, 12,
         "Demo AI Systems Awarded $12M Contract With Federal Agency", -0.06),
    Spec("DMEV", "Demo Electric Vehicles", 7.80, 2_100_000, 11e6, 0.18, 6,
         "Demo EV Reports Record Quarterly Results, Raises Guidance", 0.05),
    Spec("DMFRT", "Demo Ocean Freight", 6.00, 800_000, 18e6, 0.16, 7,
         "Demo Ocean Freight Announces $10 Million Registered Direct Offering", -0.11),
    Spec("DMRX", "Demo Pharma", 1.20, 3_000_000, 9e6, 0.40, 10,
         "Demo Pharma Receives FDA Fast Track Designation", 0.02),
    Spec("DMGLD", "Demo Gold Mining", 12.00, 4_000_000, 85e6, 0.22, 5,
         "Demo Gold Mining To Be Acquired In All-Cash Deal", 0.01),
    Spec("DMSHP", "Demo Shipping", 4.50, 600_000, 6e6, 0.28, 9, "", -0.08),
    Spec("DMCHP", "Demo Chips", 9.00, 5_000_000, 9e6, 0.14, 1.6,
         "Demo Chips Unveils Next-Generation Edge Processor", 0.00),
    Spec("DMSOL", "Demo Solar", 15.00, 1_000_000, 12e6, 0.07, 4,
         "Demo Solar Signs Supply Agreement With Utility", 0.03),
    Spec("DMBIG", "Demo Big Industries", 48.00, 9_000_000, 900e6, 0.12, 3,
         "Demo Big Industries Beats Earnings Estimates", 0.01),
    Spec("DMTOY", "Demo Toys", 3.00, 700_000, 15e6, 0.02, 1, "", 0.0),
]
FILLER = [f"DMX{chr(65 + i // 26)}{chr(65 + i % 26)}" for i in range(30)]


def _rng(*parts) -> random.Random:
    return random.Random(zlib.crc32("|".join(map(str, parts)).encode()))


def _weights(n: int, session: str) -> List[float]:
    """Intraday volume shape: U-shaped in regular hours, front-loaded outside."""
    if session == "regular":
        w = [1 + 3 * ((i / (n - 1)) - 0.5) ** 2 * 4 for i in range(n)]
    else:
        w = [1 / (1 + i * 0.05) for i in range(n)]
    s = sum(w)
    return [x / s for x in w]


class DemoProvider(Provider):
    name = "demo"
    delay_minutes = 0

    def __init__(self):
        self.anchor: Optional[date] = None      # the scanned day
        self.now: Optional[datetime] = None
        self.event_session = "premarket"
        self.specs = {s.symbol: s for s in SPECS}
        for sym in FILLER:
            r = _rng(sym)
            self.specs[sym] = Spec(sym, f"Demo Filler {sym[-2:]}", round(r.uniform(2, 40), 2),
                                   r.uniform(3e5, 5e6), r.uniform(5e6, 2e8),
                                   r.uniform(-0.04, 0.04), r.uniform(0.6, 1.6), "", r.uniform(-0.03, 0.03))

    # -- scripted price path ------------------------------------------------
    def _event_day(self) -> date:
        return next_trading_day(self.anchor) if self.event_session == "afterhours" else self.anchor

    def _close_before(self, spec: Spec, d: date) -> float:
        """Regular close of trading day `d` (walks back from the event)."""
        price = spec.close
        cur = self.anchor if self.event_session == "afterhours" else self._prev(self.anchor)
        while cur > d:
            price /= 1 + _rng(spec.symbol, cur).uniform(-0.02, 0.02)
            cur = self._prev(cur)
        return price

    @staticmethod
    def _prev(d: date) -> date:
        d -= timedelta(days=1)
        while not is_trading_day(d):
            d -= timedelta(days=1)
        return d

    def _day_bars(self, spec: Spec, d: date) -> List[Bar]:
        r = _rng(spec.symbol, d, "bars")
        bars: List[Bar] = []
        # Sessions are generated in order, each ending at a known price.
        if d < self.anchor or (d == self.anchor and self.event_session == "afterhours"):
            close = self._close_before(spec, d)
            start = close / (1 + _rng(spec.symbol, d).uniform(-0.02, 0.02)) if d < self.anchor else close
            plan = [("premarket", start, start, 1), ("regular", start, close, 1), ("afterhours", close, close, 1)]
            if d == self.anchor:  # evening scan: the after-hours session is the event
                plan[2] = ("afterhours", close, close * (1 + spec.gap), spec.rvol)
        elif d == self._event_day():
            ref = spec.close
            gapped = ref * (1 + spec.gap)
            pre_rvol = spec.rvol if self.event_session == "premarket" else spec.rvol * 0.6
            plan = [
                ("premarket", ref if self.event_session == "premarket" else gapped, gapped, pre_rvol),
                ("regular", gapped, gapped * (1 + spec.day_move), max(1.5, spec.rvol / 3)),
                ("afterhours", gapped * (1 + spec.day_move), gapped * (1 + spec.day_move), 1),
            ]
        else:
            return []
        for session, p0, p1, mult in plan:
            s, e = session_window(session, d)
            n = int((e - s) / STEP)
            vols = _weights(n, session)
            ramp = max(1, n // 6) if abs(p1 / p0 - 1) > 0.05 else n
            prev = p0
            for i in range(n):
                frac = min(1.0, (i + 1) / ramp)
                target = p0 + (p1 - p0) * frac
                c = target * (1 + r.uniform(-0.006, 0.006)) if i < n - 1 else p1
                hi = max(prev, c) * (1 + r.uniform(0, 0.012))
                lo = min(prev, c) * (1 - r.uniform(0, 0.012))
                v = spec.adv * SESSION_SHARE[session] * mult * vols[i] * r.uniform(0.7, 1.3)
                bars.append(Bar(s + i * STEP, round(prev, 4), round(hi, 4), round(lo, 4), round(c, 4), round(v)))
                prev = c
        return bars

    def _bars(self, symbol: str, start: datetime, end: datetime) -> List[Bar]:
        spec = self.specs[symbol]
        out: List[Bar] = []
        d = start.astimezone(ET).date()
        while d <= end.astimezone(ET).date():
            if is_trading_day(d):
                out.extend(b for b in self._day_bars(spec, d) if start <= b.start < end)
            d += timedelta(days=1)
        return out

    # -- provider API ---------------------------------------------------------
    def screen(self, now: datetime, session: str) -> List[Quote]:
        local = now.astimezone(ET)
        self.anchor, self.event_session, self.now = local.date(), session, now
        s_start, _ = session_window(session, self.anchor)
        quotes = []
        for sym, spec in self.specs.items():
            today = [b for b in self._bars(sym, s_start, now)]
            if not today:
                continue
            ref = spec.close if session != "afterhours" else self._close_before(spec, self.anchor)
            quotes.append(Quote(sym, today[-1].close, ref, name=spec.name))
        return quotes

    def intraday_bars(self, symbols: Sequence[str], start: datetime, end: datetime) -> Dict[str, List[Bar]]:
        if self.anchor is None:  # grading without a prior scan: anchor on the requested day
            self.anchor = start.astimezone(ET).date()
        return {s: self._bars(s, start, end) for s in symbols if s in self.specs}

    def news(self, symbols: Sequence[str], since: datetime) -> Dict[str, List[NewsItem]]:
        out = {}
        for s in symbols:
            spec = self.specs.get(s)
            if spec and spec.headline:
                out[s] = [NewsItem(spec.headline, (self.now or since) - timedelta(minutes=95), "Demo Wire", "https://example.com/demo")]
        return out

    def floats(self, symbols: Sequence[str]) -> Dict[str, Optional[float]]:
        return {s: self.specs[s].float_shares for s in symbols if s in self.specs}


def anchor_for(session: str, now: datetime) -> Tuple[str, datetime]:
    """Sensible demo clock: latest trading day at 5:45am PT (or 5:00pm PT)."""
    from ..market import PT

    d = now.astimezone(PT).date()
    while not is_trading_day(d):
        d -= timedelta(days=1)
    t = time(17, 0) if session == "afterhours" else time(5, 45)
    return session, datetime.combine(d, t, tzinfo=PT)
