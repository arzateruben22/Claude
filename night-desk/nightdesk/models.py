"""What the desk passes around: coin snapshots, safety reports, reviews, trades."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class Coin:
    """One market snapshot of a token's main pool."""

    mint: str
    symbol: str
    name: str
    pool: str
    dex: str
    created_at: datetime
    price: float                 # USD per token
    liquidity: float             # USD in the pool
    mcap: float                  # market cap (FDV when cap isn't reported)
    volume_m5: float = 0.0
    volume_h1: float = 0.0
    volume_h24: float = 0.0
    buys_m5: int = 0
    sells_m5: int = 0
    buys_h1: int = 0
    sells_h1: int = 0
    change_m5: float = 0.0       # percent
    change_h1: float = 0.0       # percent
    socials: List[str] = field(default_factory=list)  # e.g. ["website", "twitter"]
    seen_at: Optional[datetime] = None

    def age_minutes(self, now: datetime) -> float:
        return max(0.0, (now - self.created_at).total_seconds() / 60)

    @property
    def trades_h1(self) -> int:
        return self.buys_h1 + self.sells_h1


@dataclass
class Safety:
    """Rug-risk report for a token. None means "not reported"."""

    mint_revoked: Optional[bool] = None
    freeze_revoked: Optional[bool] = None
    top_wallet_pct: Optional[float] = None   # pools excluded
    top10_pct: Optional[float] = None        # pools excluded
    dev_pct: Optional[float] = None
    lp_locked_pct: Optional[float] = None
    holders: Optional[int] = None
    danger: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    rugged: bool = False


@dataclass
class Check:
    """One line of the rulebook applied to one coin."""

    rule: str
    kind: str        # kill | ready | scan
    value: str
    limit: str
    ok: bool


@dataclass
class Verdict:
    buy: bool
    confidence: float
    reason: str
    by: str          # "ai:<model>" or "rules"


@dataclass
class Review:
    """A coin's file on the desk, from discovery to the end."""

    coin: Coin
    first_seen: datetime
    status: str = "new"   # new | watching | killed | skipped | approved | declined | bought | sold | expired
    safety: Optional[Safety] = None
    checks: List[Check] = field(default_factory=list)
    scores: Dict[str, float] = field(default_factory=dict)
    note: str = ""         # the one-line reason shown on the desk
    verdict: Optional[Verdict] = None
    updated: Optional[datetime] = None
    peak_pnl_pct: float = 0.0


@dataclass
class Position:
    mint: str
    symbol: str
    opened_at: datetime
    qty: float              # tokens held
    entry_price: float      # effective price paid per token, impact included
    cost: float             # dollars spent, fees included
    entry_liquidity: float
    peak_price: float
    last_price: float
    last_liquidity: float
    reason: str = ""
    entry: Dict[str, Any] = field(default_factory=dict)   # the coin's numbers when it was bought
    rulebook: str = ""                                     # which version of desk.toml bought it


@dataclass
class Trade:
    mint: str
    symbol: str
    opened_at: datetime
    closed_at: datetime
    cost: float
    proceeds: float
    entry_price: float
    exit_price: float
    exit_reason: str
    entry: Dict[str, Any] = field(default_factory=dict)
    rulebook: str = ""

    @property
    def pnl(self) -> float:
        return self.proceeds - self.cost

    @property
    def pnl_pct(self) -> float:
        return (self.proceeds / self.cost - 1) * 100 if self.cost else 0.0
