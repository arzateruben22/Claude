"""BUDGET: every X API call and every Claude call is priced and written to the ledger first.

X's API is pay-per-use: about 1.5 cents a post, about 20 cents a post with a link, half a
cent per post read. The scout (reads) may only use part of the day's budget, so there is
always money left to post. Nothing runs once a daily or monthly limit is reached.
"""
from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Tuple
from zoneinfo import ZoneInfo

from .config import BudgetCfg
from .store import Store

READS = ("read_post", "read_user")


class BudgetExceeded(RuntimeError):
    pass


class Budget:
    def __init__(self, cfg: BudgetCfg, store: Store, tz: ZoneInfo, ai_daily_usd: float = 0.5):
        self.cfg, self.store, self.tz, self.ai_daily_usd = cfg, store, tz, ai_daily_usd

    def rate(self, kind: str) -> float:
        return float(getattr(self.cfg, kind))

    def day_start(self, now: datetime) -> datetime:
        local = now.astimezone(self.tz)
        return datetime.combine(local.date(), time(0), tzinfo=self.tz).astimezone(timezone.utc)

    def month_start(self, now: datetime) -> datetime:
        local = now.astimezone(self.tz)
        return datetime.combine(local.date().replace(day=1), time(0), tzinfo=self.tz).astimezone(timezone.utc)

    def today(self, now: datetime, kinds=()) -> float:
        return self.store.spent(self.day_start(now), kinds)

    def month(self, now: datetime, kinds=()) -> float:
        return self.store.spent(self.month_start(now), kinds)

    def x_today(self, now: datetime) -> float:
        return self.today(now) - self.today(now, ("ai",))

    def allow(self, now: datetime, kind: str, units: int = 1) -> Tuple[bool, str]:
        usd = self.rate(kind) * units if kind != "ai" else 0.0
        if kind == "ai":
            spent = self.today(now, ("ai",))
            return (spent < self.ai_daily_usd, "" if spent < self.ai_daily_usd else
                    f"Claude budget for today used (${spent:.2f} of ${self.ai_daily_usd:.2f})")
        day, month = self.x_today(now), self.month(now) - self.month(now, ("ai",))
        if day + usd > self.cfg.daily_usd:
            return False, f"daily X budget reached (${day:.2f} of ${self.cfg.daily_usd:.2f})"
        if month + usd > self.cfg.monthly_usd:
            return False, f"monthly X budget reached (${month:.2f} of ${self.cfg.monthly_usd:.2f})"
        if kind in READS:
            reads = self.today(now, READS)
            cap = self.cfg.daily_usd * self.cfg.reads_share
            if reads + usd > cap:
                return False, f"reading budget for today used (${reads:.2f} of ${cap:.2f}); the rest is kept for posting"
        return True, ""

    def charge(self, now: datetime, kind: str, units: int = 1, what: str = "", usd: float | None = None) -> float:
        usd = self.rate(kind) * units if usd is None else usd
        self.store.spend(now, kind, units, usd, what)
        return usd

    def require(self, now: datetime, kind: str, units: int = 1) -> None:
        ok, why = self.allow(now, kind, units)
        if not ok:
            raise BudgetExceeded(why)
