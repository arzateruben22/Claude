"""Paper money: sizing (SIZE), fills (FILLS) and exits (RISK).

No wallet, no keys, no real orders: this module only does arithmetic on
prices the market data reports.

Fills model a constant-product pool (how pump.fun / Raydium-style pools
price trades): spending `x` dollars into a pool holding `L` dollars of total
liquidity makes the average fill 2x/L worse than the quoted price. On top of that, every side pays a
fee (DEX fee + priority tip) and extra slippage. Exits fill at whatever the
price is when the desk next looks, so a fast crash gaps straight through a
stop, the way it does in real life.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from .config import Config
from .models import Coin, Position, Trade

PT = ZoneInfo("America/Los_Angeles")
MAX_IMPACT = 0.95


def impact(dollars: float, liquidity: float) -> float:
    if liquidity <= 0:
        return MAX_IMPACT
    return min(MAX_IMPACT, 2 * dollars / liquidity)


class PaperBroker:
    def __init__(self, cfg: Config, cash: float):
        self.cfg = cfg
        self.cash = cash
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.cooldown: Dict[str, datetime] = {}
        self.day: Optional[str] = None
        self.day_start_equity = cash

    # -- money ---------------------------------------------------------------
    def position_value(self, p: Position) -> float:
        """What selling right now would actually bring in."""
        gross = p.qty * p.last_price
        net = gross * (1 - impact(gross, p.last_liquidity) - self.cfg.size.slippage_pct / 100)
        return max(0.0, net * (1 - self.cfg.size.fee_pct / 100))

    def equity(self) -> float:
        return self.cash + sum(self.position_value(p) for p in self.positions.values())

    def roll_day(self, now: datetime) -> None:
        day = now.astimezone(PT).date().isoformat()
        if day != self.day:
            self.day, self.day_start_equity = day, self.equity()

    def day_pnl_pct(self) -> float:
        return (self.equity() / self.day_start_equity - 1) * 100 if self.day_start_equity else 0.0

    def halted(self) -> bool:
        return self.day_pnl_pct() <= -self.cfg.risk.daily_loss_limit_pct

    # -- SIZE ----------------------------------------------------------------
    def ticket(self, liquidity: float) -> float:
        s = self.cfg.size
        return max(0.0, min(self.equity() * s.ticket_pct / 100, liquidity * s.max_pct_of_liquidity / 100, self.cash))

    def can_buy(self, mint: str, now: datetime) -> Tuple[bool, str]:
        if mint in self.positions:
            return False, "already holding"
        if len(self.positions) >= self.cfg.size.max_open:
            return False, f"{self.cfg.size.max_open} positions already open"
        if self.halted():
            return False, f"daily loss limit hit ({self.day_pnl_pct():.1f}%)"
        until = self.cooldown.get(mint)
        if until and now < until:
            return False, "cooling down after a recent sell"
        return True, ""

    # -- FILLS ---------------------------------------------------------------
    def buy(self, coin: Coin, now: datetime, reason: str = "") -> Optional[Position]:
        dollars = self.ticket(coin.liquidity)
        if dollars < 1 or coin.price <= 0:
            return None
        s = self.cfg.size
        net = dollars * (1 - s.fee_pct / 100)
        price = coin.price * (1 + impact(net, coin.liquidity) + s.slippage_pct / 100)
        pos = Position(coin.mint, coin.symbol, now, net / price, price, dollars, coin.liquidity,
                       coin.price, coin.price, coin.liquidity, reason)
        self.cash -= dollars
        self.positions[coin.mint] = pos
        return pos

    def mark(self, coin: Coin) -> None:
        p = self.positions.get(coin.mint)
        if p:
            p.last_price, p.last_liquidity = coin.price, coin.liquidity
            p.peak_price = max(p.peak_price, coin.price)

    def sell(self, mint: str, now: datetime, reason: str) -> Trade:
        p = self.positions.pop(mint)
        proceeds = self.position_value(p)
        self.cash += proceeds
        self.cooldown[mint] = now + timedelta(minutes=self.cfg.risk.cooldown_minutes)
        exit_price = proceeds / p.qty if p.qty else 0.0
        trade = Trade(p.mint, p.symbol, p.opened_at, now, p.cost, proceeds, p.entry_price, exit_price, reason,
                      dict(p.entry), p.rulebook)
        self.trades.append(trade)
        return trade

    # -- RISK ----------------------------------------------------------------
    def exit_reason(self, p: Position, now: datetime) -> Optional[str]:
        r = self.cfg.risk
        gain = (p.last_price / p.entry_price - 1) * 100
        peak_gain = (p.peak_price / p.entry_price - 1) * 100
        if p.last_liquidity <= p.entry_liquidity * (1 - r.rug_liquidity_drop_pct / 100):
            return "rug exit: pool drained"
        if gain <= -r.stop_loss_pct:
            return "stop"
        if gain >= r.take_profit_pct:
            return "target"
        if peak_gain >= r.trail_arm_pct and p.last_price <= p.peak_price * (1 - r.trail_pct / 100):
            return "trailing stop"
        if now - p.opened_at >= timedelta(minutes=r.max_hold_minutes):
            return "time limit"
        return None

    def due_exits(self, now: datetime) -> List[Tuple[str, str]]:
        out = []
        for mint, p in self.positions.items():
            why = self.exit_reason(p, now)
            if why:
                out.append((mint, why))
        return out
