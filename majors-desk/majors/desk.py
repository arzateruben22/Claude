"""The desk: a paper bank, the open positions, and one decision per coin per finished hour.

Fills: at the hour's closing price, moved against you by the slippage, plus the exchange fee on
both the buy and the sell. Sizing: each trade risks risk_pct of the bank between the buy and the
trailing stop, capped at max_position_pct of the bank and at the cash on hand.
"""
from __future__ import annotations

import csv
import json
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from . import rules
from .config import Config
from .market import HOUR, Candle, MarketError

TRADE_FIELDS = ["opened", "closed", "symbol", "qty", "entry_price", "exit_price", "cost", "proceeds", "pnl",
                "pnl_pct", "exit", "held_min"]
MIN_TICKET = 10.0


@dataclass
class Position:
    symbol: str
    opened_at: datetime
    qty: float
    entry_price: float        # the fill, slippage included
    cost: float               # dollars spent, fee included
    peak: float               # best hourly close since buying
    last_price: float


@dataclass
class Trade:
    symbol: str
    opened: datetime
    closed: datetime
    qty: float
    entry_price: float
    exit_price: float
    cost: float
    proceeds: float
    exit: str

    @property
    def pnl(self) -> float:
        return self.proceeds - self.cost

    @property
    def pnl_pct(self) -> float:
        return self.pnl / self.cost * 100 if self.cost else 0.0

    def row(self) -> dict:
        return {"opened": self.opened.isoformat(), "closed": self.closed.isoformat(), "symbol": self.symbol,
                "qty": f"{self.qty:.8g}", "entry_price": f"{self.entry_price:.8g}", "exit_price": f"{self.exit_price:.8g}",
                "cost": f"{self.cost:.2f}", "proceeds": f"{self.proceeds:.2f}", "pnl": f"{self.pnl:.2f}",
                "pnl_pct": f"{self.pnl_pct:.2f}", "exit": self.exit,
                "held_min": f"{(self.closed - self.opened).total_seconds() / 60:.0f}"}


class Desk:
    def __init__(self, cfg: Config, market, folder: Optional[Path] = None):
        self.cfg, self.market, self.folder = cfg, market, folder
        self.cash = cfg.desk.start_bank
        self.positions: Dict[str, Position] = {}
        self.trades: List[Trade] = []
        self.cooldown: Dict[str, datetime] = {}
        self.last_hour: Dict[str, datetime] = {}       # the newest finished hour each coin was judged on
        self.equity: List[list] = []                   # [iso time, bank value], hourly
        self.log: deque = deque(maxlen=200)

    # -- money --------------------------------------------------------------------------------
    def value(self) -> float:
        return self.cash + sum(p.qty * p.last_price for p in self.positions.values())

    def _buy(self, coin: str, price: float, at: datetime, stop_distance: float) -> Optional[Position]:
        c, r = self.cfg.costs, self.cfg.rules
        fill = price * (1 + c.slippage_pct / 100)
        bank = self.value()
        qty = bank * r.risk_pct / 100 / max(stop_distance, price * 1e-6)
        spend = min(qty * fill * (1 + c.fee_pct / 100), bank * r.max_position_pct / 100, self.cash)
        if spend < MIN_TICKET:
            return None
        qty = spend / (fill * (1 + c.fee_pct / 100))
        self.cash -= spend
        pos = Position(coin, at, qty, fill, spend, price, price)
        self.positions[coin] = pos
        return pos

    def _sell(self, coin: str, price: float, at: datetime, why: str) -> Trade:
        c = self.cfg.costs
        p = self.positions.pop(coin)
        fill = price * (1 - c.slippage_pct / 100)
        proceeds = p.qty * fill * (1 - c.fee_pct / 100)
        self.cash += proceeds
        t = Trade(coin, p.opened_at, at, p.qty, p.entry_price, fill, p.cost, proceeds, why)
        self.trades.append(t)
        self.cooldown[coin] = at + timedelta(hours=self.cfg.rules.cooldown_hours)
        if self.folder:
            self._append(t)
        return t

    # -- one decision per coin per finished hour ------------------------------------------------
    def decide(self, history: Dict[str, List[Candle]]) -> List[str]:
        """history: each coin's latest finished candles. Sells first, then buys, so freed cash can be reused."""
        r, said = self.cfg.rules, []
        fresh = {k: cs for k, cs in history.items() if cs and self.last_hour.get(k) != cs[-1].t}
        for coin, cs in fresh.items():
            last = cs[-1]
            p = self.positions.get(coin)
            if p:
                p.last_price = last.c
                p.peak = max(p.peak, last.c)
                why = rules.exit_reason(cs, p.peak, r)
                if why:
                    t = self._sell(coin, last.c, last.closed_at, why)
                    said.append(f"sold {coin} {t.pnl_pct:+.1f}% (${t.pnl:+,.2f}): {why}")
        for coin, cs in fresh.items():
            last = cs[-1]
            self.last_hour[coin] = last.t
            if coin in self.positions or len(self.positions) >= r.max_positions:
                continue
            if self.cooldown.get(coin) and last.closed_at < self.cooldown[coin]:
                continue
            ok, why = rules.entry(cs, r)
            if ok:
                stop = r.stop_atr * rules.atr(cs, r.atr_hours)
                p = self._buy(coin, last.c, last.closed_at, stop)
                if p:
                    said.append(f"bought {coin} at ${p.entry_price:,.6g} (${p.cost:,.2f}): {why}")
        if fresh:
            newest = max(cs[-1].closed_at for cs in fresh.values())
            self.equity.append([newest.isoformat(), round(self.value(), 2)])
            self.equity = self.equity[-24 * 120:]
        return said

    def step(self, now: datetime) -> List[str]:
        """Live: fetch each coin's latest finished hours and decide on any new one."""
        need = self.cfg.rules.candles_needed()
        history = {}
        for coin in self.cfg.desk.coins:
            try:
                history[coin] = self.market.recent(coin, self.cfg.desk.quote, now, need)
            except MarketError as exc:
                self.say(now, f"{coin}: {exc}")
        said = self.decide(history)
        for s in said:
            self.say(now, s)
        if self.folder:
            self.save()
        return said

    def say(self, now: datetime, text: str) -> None:
        self.log.appendleft(f"{now:%Y-%m-%d %H:%M} {text}")

    # -- files -----------------------------------------------------------------------------------
    def _append(self, t: Trade) -> None:
        self.folder.mkdir(parents=True, exist_ok=True)
        path = self.folder / "trades.csv"
        new = not path.exists()
        with open(path, "a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, TRADE_FIELDS)
            if new:
                w.writeheader()
            w.writerow(t.row())

    def save(self) -> None:
        self.folder.mkdir(parents=True, exist_ok=True)
        data = {
            "cash": self.cash, "start_bank": self.cfg.desk.start_bank,
            "positions": [{**asdict(p), "opened_at": p.opened_at.isoformat()} for p in self.positions.values()],
            "cooldown": {k: v.isoformat() for k, v in self.cooldown.items()},
            "last_hour": {k: v.isoformat() for k, v in self.last_hour.items()},
            "equity": self.equity, "log": list(self.log)[:50],
        }
        tmp = self.folder / "state.json.tmp"
        tmp.write_text(json.dumps(data))
        tmp.replace(self.folder / "state.json")

    def resume(self) -> bool:
        path = self.folder / "state.json" if self.folder else None
        if not path or not path.exists():
            return False
        data = json.loads(path.read_text())
        self.cash = data["cash"]
        for p in data["positions"]:
            p["opened_at"] = datetime.fromisoformat(p["opened_at"])
            self.positions[p["symbol"]] = Position(**p)
        self.cooldown = {k: datetime.fromisoformat(v) for k, v in data["cooldown"].items()}
        self.last_hour = {k: datetime.fromisoformat(v) for k, v in data["last_hour"].items()}
        self.equity = data.get("equity", [])
        self.log.extend(reversed(data.get("log", [])))
        return True


# -- the same rules over history -------------------------------------------------------------------

def replay(cfg: Config, market, start: datetime, end: datetime, folder: Optional[Path] = None,
           close_at_end: bool = True) -> dict:
    """Run the desk hour by hour through history. Returns the desk and the buy-and-hold comparison."""
    need = cfg.rules.candles_needed()
    data = {c: market.history(c, cfg.desk.quote, start - need * HOUR, end) for c in cfg.desk.coins}
    desk = Desk(cfg, market, folder)
    index = {c: {x.t: i for i, x in enumerate(cs)} for c, cs in data.items()}
    t = start
    while t + HOUR <= end:
        history = {}
        for coin, cs in data.items():
            i = index[coin].get(t)
            if i is not None and i + 1 >= need:
                history[coin] = cs[i + 1 - need:i + 1]
        desk.decide(history)
        t += HOUR
    if close_at_end:                                   # close what's left at the last price, so the totals are real
        for coin in list(desk.positions):
            cs = data[coin]
            desk._sell(coin, cs[-1].c, cs[-1].closed_at, "end of test")
    return {"desk": desk, "hold": buy_and_hold(cfg, data, start, end)}


def buy_and_hold(cfg: Config, data: Dict[str, List[Candle]], start: datetime, end: datetime) -> dict:
    """The same bank split evenly across the coins at the start and held to the end, after costs."""
    c = cfg.costs
    each = cfg.desk.start_bank / len(data)
    total, per = 0.0, {}
    for coin, cs in data.items():
        inside = [x for x in cs if start <= x.t and x.closed_at <= end]
        if not inside:
            continue
        buy = inside[0].o * (1 + c.slippage_pct / 100)
        sell = inside[-1].c * (1 - c.slippage_pct / 100)
        value = each * (1 - c.fee_pct / 100) / buy * sell * (1 - c.fee_pct / 100)
        per[coin] = round((value / each - 1) * 100, 1)
        total += value
    return {"value": round(total, 2), "return_pct": round((total / cfg.desk.start_bank - 1) * 100, 2), "per_coin": per}


def summary(desk: Desk, hold: dict, days: float, label: str) -> str:
    tr = desk.trades
    wins = [t.pnl for t in tr if t.pnl > 0]
    losses = [-t.pnl for t in tr if t.pnl < 0]
    net = sum(t.pnl for t in tr)
    start = desk.cfg.desk.start_bank
    peak, dd, eq = start, 0.0, start
    for t in sorted(tr, key=lambda x: x.closed):
        eq += t.pnl
        peak = max(peak, eq)
        dd = max(dd, (peak - eq) / peak * 100)
    pf = f"{sum(wins) / sum(losses):.2f}" if losses else ("∞" if wins else "—")
    lines = [
        f"{label}: {days:g} days, {len(desk.cfg.desk.coins)} coins ({', '.join(desk.cfg.desk.coins)})",
        f"  {len(tr)} trades · won {len(wins)}/{len(tr) or 1} ({len(wins) / max(1, len(tr)):.0%}) · profit factor {pf}",
        f"  net {'+' if net >= 0 else '−'}${abs(net):,.2f} ({net / start * 100:+.1f}% of ${start:,.0f}) · worst drop {dd:.1f}%",
        f"  just holding all {len(hold['per_coin'])} coins instead: {hold['return_pct']:+.1f}%  "
        f"({', '.join(f'{k} {v:+.0f}%' for k, v in hold['per_coin'].items())})",
    ]
    if wins and losses:
        lines.append(f"  average win ${sum(wins) / len(wins):,.2f} · average loss ${sum(losses) / len(losses):,.2f}")
    verdict = ("beat" if net / start * 100 > hold["return_pct"] else "did NOT beat")
    lines.append(f"  The rules {verdict} simply holding over this stretch, after fees.")
    if len(tr) < 50:
        lines.append(f"  Only {len(tr)} trades: too few to trust either way.")
    return "\n".join(lines)
