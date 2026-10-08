"""The trading rules, as plain functions of the candles. The live desk and the backtest share them."""
from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

from .config import RulesCfg
from .market import Candle


def ema(values: Sequence[float], n: int) -> float:
    """Exponential average of the values, weighted toward the latest; started from the first value."""
    k = 2 / (n + 1)
    e = values[0]
    for v in values[1:]:
        e = v * k + e * (1 - k)
    return e


def atr(cs: Sequence[Candle], n: int) -> float:
    """Average true range over the last n hours: how far the coin normally moves in an hour, in dollars."""
    trs = [max(c.h - c.l, abs(c.h - p.c), abs(c.l - p.c)) for p, c in zip(cs[-n - 1:-1], cs[-n:])]
    return sum(trs) / len(trs) if trs else 0.0


def entry(cs: List[Candle], r: RulesCfg) -> Tuple[bool, str]:
    """Buy when the hour closes above the trend average AND above the previous breakout_hours' high."""
    if len(cs) < r.candles_needed():
        return False, "not enough history yet"
    last = cs[-1]
    trend = ema([c.c for c in cs], r.trend_hours)
    high = max(c.h for c in cs[-1 - r.breakout_hours:-1])
    if last.c <= trend:
        return False, f"below its {r.trend_hours}h average"
    if last.c <= high:
        return False, f"no breakout above the {r.breakout_hours}h high"
    return True, f"broke out above the {r.breakout_hours}h high (${high:,.4g}) in an uptrend"


def exit_reason(cs: List[Candle], peak_close: float, r: RulesCfg) -> Optional[str]:
    """Sell on the trailing stop, or when the hour closes below the previous exit_hours' low."""
    last = cs[-1]
    stop = peak_close - r.stop_atr * atr(cs, r.atr_hours)
    if last.c < stop:
        return "trailing stop"
    low = min(c.l for c in cs[-1 - r.exit_hours:-1])
    if last.c < low:
        return f"trend over ({r.exit_hours}h low)"
    return None
