"""A make-believe Solana launchpad for the demo and the tests.

Coins launch every ~45 seconds. Each one is secretly one of five fates:
  scam   obvious rug signs (mint still on, one wallet owns a big slice)
  rug    looks clean, pumps, then the creator pulls the pool
  pump   real move up, then a slow fade
  bleed  quick pop, long decline
  dud    nobody shows up
The desk never sees the fate, only prices, volume, trades and the safety
report, the same things it sees live. Everything is driven by a seeded
random generator in fixed 15-second steps, so the same seed always replays
the same night no matter how often the desk looks.
"""
from __future__ import annotations

import math
import random
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Deque, Dict, List, Optional, Sequence, Tuple

from ..models import Coin, Safety
from .base import Source

STEP = timedelta(seconds=15)
SUPPLY = 1e9
FATES = (("scam", 0.30), ("rug", 0.20), ("pump", 0.18), ("bleed", 0.17), ("dud", 0.15))
SYLLABLES = ["ZA", "MO", "KI", "RU", "BO", "PE", "LU", "XI", "GO", "NU", "FI", "TA", "SNO", "GLO",
             "WIF", "BON", "MEW", "DOR", "KAZ", "PIX", "QUO", "YEP", "ZUL", "VEX", "HOP", "JIB"]
CREATURES = ["Frog", "Cat", "Owl", "Crab", "Goblin", "Penguin", "Hamster", "Moth", "Toad", "Capybara"]
BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


@dataclass
class _SimCoin:
    mint: str
    symbol: str
    name: str
    fate: str
    born: datetime
    rng: random.Random
    m0: float               # launch market cap
    peak_mult: float
    peak_min: float         # minutes after launch the move peaks
    decay_min: float
    end_min: Optional[float]  # rug / dump time, minutes after launch
    liq_ratio: float
    trade_size: float
    activity: float
    safety: Safety
    socials: List[str]
    t: datetime = None      # time of the last simulated step
    noise: float = 0.0
    mcap: float = 0.0
    liquidity: float = 0.0
    vol_total: float = 0.0
    tape: Deque[Tuple[datetime, float, float, int, int]] = field(default_factory=lambda: deque(maxlen=250))

    # -- the hidden path --------------------------------------------------------
    def curve(self, minutes: float) -> float:
        """Log market cap the coin drifts around, before noise."""
        base, top = math.log(self.m0), math.log(self.m0 * self.peak_mult)
        if self.end_min is not None and minutes >= self.end_min:
            return math.log(self.m0 * self.peak_mult * 0.04)   # pulled / dumped
        if self.fate == "dud":
            return base - 0.15 * minutes / 60
        if minutes <= self.peak_min:
            return base + (top - base) * (minutes / self.peak_min) ** 0.9
        faded = top - (top - base) * 0.75 * (1 - math.exp(-(minutes - self.peak_min) / self.decay_min))
        return faded

    def advance(self, now: datetime) -> None:
        while self.t + STEP <= now:
            prev_curve = self.curve(self._minutes(self.t))
            self.t += STEP
            m = self._minutes(self.t)
            target = self.curve(m)
            slope = target - prev_curve
            self.noise = 0.9 * self.noise + self.rng.gauss(0, 0.03)
            jump = self.rng.random()
            if jump < 0.015:      # someone big sells into the pool
                self.noise += self.rng.gauss(-0.12, 0.08)
            elif jump < 0.023:    # a burst of buying
                self.noise += self.rng.gauss(0.08, 0.05)
            pulled = self.end_min is not None and m >= self.end_min
            new_mcap = math.exp(target + (0.0 if pulled else self.noise))
            move = abs(math.log(new_mcap / self.mcap)) if self.mcap else 0.0
            self.mcap = new_mcap
            # A pulled pool keeps a sliver of its money; otherwise liquidity tracks the cap.
            self.liquidity = self.mcap * self.liq_ratio * (0.1 if pulled else 1.0)
            heat = 0.02 if pulled else self.activity
            volume = self.mcap * heat * 0.25 * (0.006 + 2.5 * move) * self.rng.uniform(0.6, 1.4)
            trades = max(0, int(volume / self.trade_size))
            lean = 0.5 + 0.35 * math.tanh(slope * 60) + self.rng.gauss(0, 0.05)
            if self.fate == "scam" and not pulled:
                lean += 0.1   # wash buying to look busy
            lean = min(0.95, max(0.05, lean))
            buys = int(round(trades * lean))
            self.vol_total += volume
            self.tape.append((self.t, self.mcap / SUPPLY, volume, buys, trades - buys))

    def _minutes(self, t: datetime) -> float:
        return (t - self.born).total_seconds() / 60

    def snapshot(self, now: datetime) -> Coin:
        self.advance(now)
        price = self.mcap / SUPPLY

        def window(minutes: int):
            since = now - timedelta(minutes=minutes)
            rows = [r for r in self.tape if r[0] > since]
            return (sum(r[2] for r in rows), sum(r[3] for r in rows), sum(r[4] for r in rows))

        def change(minutes: int) -> float:
            since = now - timedelta(minutes=minutes)
            older = [r for r in self.tape if r[0] <= since]
            ref = older[-1][1] if older else (self.tape[0][1] if self.tape else price)
            return (price / ref - 1) * 100 if ref else 0.0

        v5, b5, s5 = window(5)
        v60, b60, s60 = window(60)
        return Coin(
            mint=self.mint, symbol=self.symbol, name=self.name, pool=f"pool-{self.mint[:8]}", dex="demo-swap",
            created_at=self.born, price=price, liquidity=self.liquidity, mcap=self.mcap,
            volume_m5=v5, volume_h1=v60, volume_h24=self.vol_total, buys_m5=b5, sells_m5=s5,
            buys_h1=b60, sells_h1=s60, change_m5=change(5), change_h1=change(60),
            socials=list(self.socials), seen_at=now,
        )


class SimMarket(Source):
    name = "demo"

    def __init__(self, start: datetime, seed: int = 7, launch_every_s: float = 45):
        self.rng = random.Random(seed)
        self.launch_every_s = launch_every_s
        self.coins: Dict[str, _SimCoin] = {}
        self.order: List[str] = []
        self.next_birth = start - timedelta(minutes=90)   # a market already in motion
        self.safety_delay = timedelta(seconds=30)

    # -- launches -----------------------------------------------------------
    def _spawn_until(self, now: datetime) -> None:
        while self.next_birth <= now:
            self._launch(self.next_birth)
            self.next_birth += timedelta(seconds=self.rng.expovariate(1 / self.launch_every_s))

    def _launch(self, born: datetime) -> None:
        r = random.Random(self.rng.getrandbits(64))
        roll, fate = r.random(), "dud"
        for name, p in FATES:
            if roll < p:
                fate = name
                break
            roll -= p
        symbol = "".join(r.choice(SYLLABLES) for _ in range(2))[:6]
        mint = "Dmo" + "".join(r.choice(BASE58) for _ in range(41))
        m0 = r.uniform(8e3, 25e3) if fate != "bleed" else r.uniform(20e3, 60e3)
        peak_mult = {"pump": math.exp(r.uniform(math.log(3), math.log(40))),
                     "rug": math.exp(r.uniform(math.log(5), math.log(30))),
                     "scam": math.exp(r.uniform(math.log(5), math.log(30))),
                     "bleed": r.uniform(1.5, 3), "dud": 1.0}[fate]
        peak_min = r.uniform(30, 150) if fate in ("pump", "rug", "scam") else r.uniform(4, 14)
        end_min = None
        if fate == "rug":
            end_min = r.uniform(18, max(20, peak_min * 1.1))
        elif fate == "scam":
            end_min = r.uniform(15, 90)
        coin = _SimCoin(
            mint=mint, symbol=symbol, name=f"{symbol.title()} {r.choice(CREATURES)}", fate=fate, born=born, rng=r,
            m0=m0, peak_mult=peak_mult, peak_min=peak_min, decay_min=r.uniform(60, 240) if fate != "bleed" else 120,
            end_min=end_min, liq_ratio=r.uniform(0.12, 0.2), trade_size=r.uniform(60, 200),
            activity=0.08 if fate == "dud" else r.uniform(0.6, 1.4),
            safety=self._safety_for(fate, r), socials=self._socials_for(fate, r),
        )
        coin.t, coin.mcap, coin.liquidity = born, m0, m0 * coin.liq_ratio
        self.coins[mint] = coin
        self.order.append(mint)

    @staticmethod
    def _safety_for(fate: str, r: random.Random) -> Safety:
        s = Safety(mint_revoked=True, freeze_revoked=True, top_wallet_pct=r.uniform(1.0, 4.5),
                   top10_pct=r.uniform(10, 30), dev_pct=r.uniform(0, 3), lp_locked_pct=100.0,
                   holders=r.randint(300, 3000))
        if fate == "scam":
            trick = r.choice(["mint", "freeze", "whale", "whale", "dev"])
            if trick == "mint":
                s.mint_revoked = False
                s.danger.append("Mint authority still enabled")
            elif trick == "freeze":
                s.freeze_revoked = False
                s.danger.append("Freeze authority still enabled")
            elif trick == "whale":
                s.top_wallet_pct = r.uniform(12, 45)
                s.top10_pct = s.top_wallet_pct + r.uniform(15, 30)
                s.danger.append("Single holder ownership")
            else:
                s.dev_pct = r.uniform(10, 30)
                s.warnings.append("Creator holds a large share")
        elif fate == "rug":
            if r.random() < 0.35:
                s.warnings.append("Low amount of pool providers")
        elif fate == "bleed" and r.random() < 0.4:
            s.top10_pct = r.uniform(36, 55)
            s.warnings.append("Top 10 holders high ownership")
        return s

    @staticmethod
    def _socials_for(fate: str, r: random.Random) -> List[str]:
        odds = {"pump": 0.75, "rug": 0.8, "scam": 0.4, "bleed": 0.5, "dud": 0.2}[fate]
        return [k for k in ("website", "twitter", "telegram") if r.random() < odds]

    # -- Source API ---------------------------------------------------------
    def discover(self, now: datetime) -> List[Coin]:
        self._spawn_until(now)
        fresh = [m for m in self.order[-40:] if now - self.coins[m].born <= timedelta(minutes=30)]
        return [self.coins[m].snapshot(now) for m in fresh[-20:]]

    def snapshot(self, mints: Sequence[str], now: datetime) -> Dict[str, Coin]:
        self._spawn_until(now)
        return {m: self.coins[m].snapshot(now) for m in mints if m in self.coins}

    def safety(self, mint: str, now: datetime) -> Optional[Safety]:
        c = self.coins.get(mint)
        if not c or now - c.born < self.safety_delay:
            return None
        if c.end_min is not None and (now - c.born).total_seconds() / 60 >= c.end_min:
            s = Safety(**{**c.safety.__dict__, "danger": c.safety.danger + ["Pool drained"], "rugged": True})
            return s
        return c.safety

    def fate(self, mint: str) -> str:
        """Test/debug helper: the hidden fate (the desk never calls this)."""
        return self.coins[mint].fate
