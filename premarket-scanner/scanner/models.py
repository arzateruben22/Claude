"""Plain data containers shared by providers, the engine and reports."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional


@dataclass
class Bar:
    """One OHLCV bar. `start` is timezone-aware."""

    start: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class Quote:
    """Cheap full-market screen row: just enough to pick candidates.

    `ref_close` is the provider's idea of the last regular close; `alt_ref_close`
    is a second reference used only for the loose pre-filter (see providers).
    """

    symbol: str
    price: float
    ref_close: Optional[float]
    alt_ref_close: Optional[float] = None
    name: str = ""
    bid: Optional[float] = None
    ask: Optional[float] = None

    @property
    def spread_pct(self) -> Optional[float]:
        """Bid/ask spread as % of the midpoint; None if missing, locked or crossed."""
        if not self.bid or not self.ask or self.bid <= 0 or self.ask <= self.bid:
            return None
        return (self.ask - self.bid) / ((self.ask + self.bid) / 2) * 100


@dataclass
class NewsItem:
    headline: str
    published: datetime
    source: str = ""
    url: str = ""


@dataclass
class Halt:
    symbol: str
    code: str                     # e.g. T1 (news pending), LUDP (volatility pause)
    halted_at: datetime
    resumed_at: Optional[datetime] = None   # None = no resumption time published yet

    def active(self, at: datetime) -> bool:
        return self.halted_at <= at and (self.resumed_at is None or self.resumed_at > at)


@dataclass
class Metrics:
    """Everything computed from intraday bars for one symbol."""

    price: float
    ref_close: float
    gap_pct: float
    session_volume: float
    expected_volume: float
    rvol: float
    avg_daily_volume: float
    session_high: float
    days_used: int


@dataclass
class Candidate:
    symbol: str
    name: str
    metrics: Metrics
    float_shares: Optional[float] = None
    spread_pct: Optional[float] = None
    halts: List[Halt] = field(default_factory=list)
    halted_now: str = ""     # halt reason code if halted at scan time
    news: List[NewsItem] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    failures: List[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.failures

    @property
    def headline(self) -> str:
        return self.news[0].headline if self.news else ""


@dataclass
class ScanResult:
    session: str            # premarket | regular | afterhours
    now: datetime
    asof: datetime          # data cut-off (now minus provider delay)
    provider: str
    delay_minutes: int
    universe: int           # symbols the provider screened
    checked: int            # symbols that got the detailed check
    passed: List[Candidate]
    near_misses: List[Candidate]
    notes: List[str] = field(default_factory=list)
