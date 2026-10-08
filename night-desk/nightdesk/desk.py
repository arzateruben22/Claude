"""CHIEF: runs the desk. Each tick, every agent does its one job.

  CRAWLER  sweeps for new pools               (every discover_seconds)
  VET      safety report -> kill list         (every poll)
  SCAN     readiness + momentum scores        (every poll)
  SOCIAL   website / X / Telegram presence    (part of SCAN)
  JUDGE    yes/no on coins that clear it all  (at most 2 per poll)
  SIZE     ticket from bank and pool depth
  FILLS    paper buys/sells with impact and fees
  RISK     target, stop, trailing stop, time limit, rug exit, daily limit
"""
from __future__ import annotations

import csv
import json
from collections import Counter, deque
from datetime import datetime, timedelta
from pathlib import Path
from typing import Deque, Dict, List, Optional

from . import gates, rules
from .config import Config
from .judge import describe as describe_judge
from .models import Coin, Position, Review, Trade
from .paper import PaperBroker, impact
from .sources.base import Source, SourceError

AGENTS = {
    "chief": "runs the desk",
    "crawler": "reads every new pool",
    "vet": "stomps the rugs",
    "scan": "is it really moving",
    "social": "is anyone home",
    "judge": "says yes or no",
    "size": "how much",
    "fills": "paper fills",
    "risk": "gets us out",
}
DONE = {"killed", "expired", "skipped", "declined", "sold"}
SAFETY_PER_POLL = 6
JUDGE_PER_POLL = 2
KEEP_DONE = timedelta(hours=2)


def _money(x: float) -> str:
    sign = "-" if x < 0 else ""
    x = abs(x)
    for size, suffix in ((1e9, "B"), (1e6, "M"), (1e3, "K")):
        if x >= size:
            return f"{sign}${x / size:.1f}{suffix}"
    return f"{sign}${x:,.2f}"


class Desk:
    def __init__(self, cfg: Config, source: Source, judge, now: datetime, out_dir: Optional[Path] = None,
                 mode: str = "demo"):
        self.cfg, self.source, self.judge, self.mode = cfg, source, judge, mode
        self.started = now
        self.broker = PaperBroker(cfg, cfg.desk.start_bank)
        self.reviews: Dict[str, Review] = {}
        self.gone: Dict[str, datetime] = {}          # mints the desk is done with
        self.kills: Deque[dict] = deque(maxlen=40)
        self.verdicts: Deque[dict] = deque(maxlen=30)
        self.feed: Deque[dict] = deque(maxlen=80)
        self.equity: List[List] = []                 # [iso time, equity]
        self.agents = {k: {"role": v, "status": "standing by", "count": 0, "meter": 0.0, "at": None}
                       for k, v in AGENTS.items()}
        self.counts = {"seen": 0, "killed": 0, "judged": 0, "yes": 0, "bought": 0, "sold": 0}
        self.kill_rules: Counter = Counter()       # which kill rule stomped each coin
        self.wait_rules: Counter = Counter()       # rules still failing when a coin's watch ran out
        self.near_miss: Counter = Counter()        # ...when that was the only rule it failed
        self.focus: Optional[str] = None
        self.focus_rank = 0
        self.focus_until: Optional[datetime] = None
        self.last_crawl: Optional[datetime] = None
        self.last_poll: Optional[datetime] = None
        self.last_save: Optional[datetime] = None
        self.notes: Deque[str] = deque(maxlen=5)
        self.out_dir = out_dir
        # Which version of the rules is trading: the scorecard only counts this version's trades.
        self.rulebook = gates.rulebook_id(cfg, getattr(judge, "name", "rules"))
        if out_dir:
            out_dir.mkdir(parents=True, exist_ok=True)
            gates.record_rulebook(out_dir, self.rulebook, getattr(judge, "name", "rules"), now)

    # -- helpers ----------------------------------------------------------------
    def say(self, agent: str, text: str, now: datetime, count: int = 0, meter: Optional[float] = None) -> None:
        a = self.agents[agent]
        a["status"], a["at"] = text, now.isoformat()
        a["count"] += count
        if meter is not None:
            a["meter"] = round(max(0.0, min(1.0, meter)), 3)
        self.feed.append({"t": now.isoformat(), "agent": agent, "text": text})

    def _due(self, last: Optional[datetime], seconds: float, now: datetime) -> bool:
        return last is None or (now - last).total_seconds() >= seconds

    def _append_csv(self, name: str, row: dict) -> None:
        if not self.out_dir:
            return
        path = self.out_dir / name
        if path.exists():
            with open(path, newline="", encoding="utf-8") as fh:
                header = next(csv.reader(fh), [])
            if header != list(row):          # columns were added since this file began: rewrite it once
                with open(path, newline="", encoding="utf-8") as fh:
                    old = list(csv.DictReader(fh))
                cols = list(row) + [c for c in header if c not in row]
                with open(path, "w", newline="", encoding="utf-8") as fh:
                    w = csv.DictWriter(fh, cols, restval="")
                    w.writeheader()
                    w.writerows(old)
                header = cols
        else:
            header = []
        with open(path, "a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, header or list(row), restval="")
            if not header:
                w.writeheader()
            w.writerow(row)

    def _set_focus(self, mint: str, now: datetime, rank: int, hold_s: float) -> None:
        """The coin on the rule sheet. Judge (3) beats kill (2) beats scan (1),
        and a coin stays up for a while so the sheet doesn't flicker."""
        if self.focus_until and now < self.focus_until and rank < self.focus_rank:
            return
        self.focus, self.focus_rank = mint, rank
        self.focus_until = now + timedelta(seconds=hold_s)

    def _done(self, r: Review, status: str, now: datetime) -> None:
        r.status, r.updated = status, now
        self.gone[r.coin.mint] = now

    # -- the tick -----------------------------------------------------------------
    def step(self, now: datetime) -> None:
        self.broker.roll_day(now)
        if self._due(self.last_crawl, self.cfg.desk.discover_seconds, now):
            self.last_crawl = now
            self.crawl(now)
        if self._due(self.last_poll, self.cfg.desk.poll_seconds, now):
            self.last_poll = now
            self.poll(now)
            self._record_equity(now)
        if self.out_dir and self._due(self.last_save, 60, now):
            self.last_save = now
            self.save()

    def crawl(self, now: datetime) -> None:
        try:
            coins = self.source.discover(now)
        except SourceError as exc:
            self.notes.append(f"crawler: {exc}")
            self.say("crawler", "source unreachable, retrying next sweep", now)
            return
        fresh = [c for c in coins if c.mint not in self.reviews and c.mint not in self.gone]
        for c in fresh:
            self.reviews[c.mint] = Review(c, first_seen=now, status="watching", updated=now)
        self.counts["seen"] += len(fresh)
        names = ", ".join(f"${c.symbol}" for c in fresh[:4]) + (" …" if len(fresh) > 4 else "")
        watching = sum(1 for r in self.reviews.values() if r.status == "watching")
        self.say("crawler", f"found {len(fresh)} new: {names}" if fresh else f"no new pools · {watching} on the watchlist",
                 now, count=len(fresh), meter=min(1.0, watching / 60))

    def poll(self, now: datetime) -> None:
        live = [m for m, r in self.reviews.items() if r.status == "watching"]
        held = list(self.broker.positions)
        try:
            snaps = self.source.snapshot(live + held, now)
        except SourceError as exc:
            self.notes.append(f"prices: {exc}")
            return
        for mint, coin in snaps.items():
            if mint in self.reviews:
                self.reviews[mint].coin = coin
            self.broker.mark(coin)

        self._vet(now, live)
        candidates = self._scan(now, live)
        self._judge(now, candidates)
        self._risk(now)
        self._tidy(now)
        self._chief(now)

    # -- VET --------------------------------------------------------------------
    def _vet(self, now: datetime, live: List[str]) -> None:
        need = [self.reviews[m] for m in live if self.reviews[m].safety is None]
        need.sort(key=lambda r: r.coin.liquidity, reverse=True)
        for r in need[:SAFETY_PER_POLL]:
            try:
                r.safety = self.source.safety(r.coin.mint, now)
            except SourceError as exc:
                self.notes.append(f"safety: {exc}")
                break

    # -- SCAN / SOCIAL (and VET's verdicts) -----------------------------------------
    def _scan(self, now: datetime, live: List[str]) -> List[Review]:
        desired = self.broker.equity() * self.cfg.size.ticket_pct / 100
        watch_for = timedelta(minutes=self.cfg.desk.watch_minutes)
        candidates = []
        for mint in live:
            r = self.reviews[mint]
            outcome = rules.evaluate(r, now, self.cfg, desired)
            r.updated = now
            if outcome == "killed":
                self._done(r, "killed", now)
                self.counts["killed"] += 1
                self.kill_rules[next((c.rule for c in r.checks if c.kind == "kill" and not c.ok), "other")] += 1
                self.kills.append({"t": now.isoformat(), "symbol": r.coin.symbol, "mint": mint, "reason": r.note})
                self._append_csv("kills.csv", {"time": now.isoformat(), "symbol": r.coin.symbol, "mint": mint,
                                               "reason": r.note})
                rate = self.counts["killed"] / max(1, self.counts["seen"])
                self.say("vet", f"stomped ${r.coin.symbol}: {r.note}", now, count=1, meter=rate)
                self._set_focus(mint, now, rank=2, hold_s=60)
            elif outcome == "expired" or (outcome == "waiting" and now - r.first_seen > watch_for):
                if outcome == "waiting":            # why it never qualified: a tally only, the rules don't change
                    failing = [c.rule for c in r.checks if not c.ok] or ["no price data"]
                    self.wait_rules.update(failing)
                    if len(failing) == 1:
                        self.near_miss[failing[0]] += 1
                else:
                    self.wait_rules["too old"] += 1
                self._done(r, "skipped" if outcome == "waiting" else "expired", now)
                r.note = f"never qualified ({r.note})" if outcome == "waiting" else r.note
            elif outcome == "candidate":
                candidates.append(r)
        scored = [self.reviews[m] for m in live if self.reviews[m].scores and self.reviews[m].status == "watching"]
        if scored:
            best = max(scored, key=lambda r: sum(c.ok for c in r.checks) / max(1, len(r.checks)))
            s = best.scores
            self.say("scan", f"${best.coin.symbol}: buy pressure {s['buy_pressure']:.2f} · "
                             f"heat {s['heat']:.2f} · spent {s['momentum_spent']:.2f}", now,
                     meter=s["buy_pressure"])
            kinds = [k for k in ("website", "twitter", "telegram") if k in best.coin.socials]
            self.say("social", f"${best.coin.symbol}: " + (" + ".join(kinds) if kinds else "no links at all"), now,
                     meter=s["social"])
            self._set_focus(best.coin.mint, now, rank=1, hold_s=60)
        return sorted(candidates, key=lambda r: r.scores["buy_pressure"] + r.scores["heat"], reverse=True)

    # -- JUDGE / SIZE / FILLS ----------------------------------------------------------
    def _judge(self, now: datetime, candidates: List[Review]) -> None:
        asked = 0
        for r in candidates:
            if asked >= JUDGE_PER_POLL:
                break
            ok, why = self.broker.can_buy(r.coin.mint, now)
            if not ok:
                r.note = f"clears every rule, but {why}"
                self.say("size", f"${r.coin.symbol} qualifies, but {why}", now)
                continue
            asked += 1
            self._set_focus(r.coin.mint, now, rank=3, hold_s=120)
            v = self.judge.decide(r)
            r.verdict = v
            self.counts["judged"] += 1
            self.counts["yes"] += int(v.buy)
            self.verdicts.append({"t": now.isoformat(), "symbol": r.coin.symbol, "buy": v.buy,
                                  "confidence": v.confidence, "reason": v.reason, "by": v.by})
            word = "YES" if v.buy else "no"
            self.say("judge", f"{word} ${r.coin.symbol} ({v.confidence:.2f}): {v.reason}", now,
                     count=1, meter=self.counts["yes"] / self.counts["judged"])
            if not v.buy:
                self._done(r, "declined", now)
                r.note = f"judge said no: {v.reason}"
                continue
            ticket = self.broker.ticket(r.coin.liquidity)
            pos = self.broker.buy(r.coin, now, v.reason)
            if pos is None:
                r.note = "judge said yes, but the ticket is too small"
                continue
            c = r.coin
            pos.rulebook = self.rulebook
            pos.entry = {"age_min": round(c.age_minutes(now), 1), "liquidity": round(c.liquidity),
                         "mcap": round(c.mcap), "volume_h1": round(c.volume_h1), "trades_h1": c.trades_h1,
                         **{k: round(x, 3) for k, x in r.scores.items()},
                         "judge_conf": v.confidence, "judge_by": v.by}
            r.status, r.updated, r.note = "bought", now, f"bought: {v.reason}"
            self.counts["bought"] += 1
            pool_pct = ticket / r.coin.liquidity * 100 if r.coin.liquidity else 0
            self.say("size", f"${r.coin.symbol}: {_money(ticket)} ticket ({pool_pct:.1f}% of the pool)", now,
                     meter=1 - self.broker.cash / max(1e-9, self.broker.equity()))
            slip = impact(ticket, r.coin.liquidity) * 100 + self.cfg.size.slippage_pct
            self.say("fills", f"bought ${r.coin.symbol} @ {pos.entry_price:.3g} (impact+slip {slip:.1f}%)", now,
                     count=1, meter=min(1.0, slip / 10))

    # -- RISK --------------------------------------------------------------------
    def _risk(self, now: datetime) -> None:
        for mint, why in self.broker.due_exits(now):
            t = self.broker.sell(mint, now, why)
            r = self.reviews.get(mint)
            if r:
                r.status, r.updated, r.note = "sold", now, f"sold {t.pnl_pct:+.1f}% ({why})"
                self.gone[mint] = now
            self.counts["sold"] += 1
            self._append_csv("trades.csv", {
                "opened": t.opened_at.isoformat(), "closed": t.closed_at.isoformat(), "symbol": t.symbol,
                "mint": t.mint, "cost": round(t.cost, 2), "proceeds": round(t.proceeds, 2),
                "pnl": round(t.pnl, 2), "pnl_pct": round(t.pnl_pct, 2), "exit": t.exit_reason,
                "held_min": round((t.closed_at - t.opened_at).total_seconds() / 60, 1),
                "rulebook": t.rulebook, "judge_by": t.entry.get("judge_by", ""),
                **{k: t.entry.get(k, "") for k in gates.ENTRY_KEYS},
            })
            self.say("risk", f"sold ${t.symbol} {t.pnl_pct:+.1f}% ({why})", now,
                     count=1, meter=0.5 + self.broker.day_pnl_pct() / (2 * self.cfg.risk.daily_loss_limit_pct))
            self.say("fills", f"sold ${t.symbol} for {_money(t.proceeds)} ({_money(t.pnl)})", now)
        if self.broker.positions and not self.broker.due_exits(now):
            worst = min(self.broker.positions.values(), key=lambda p: p.last_price / p.entry_price)
            self.say("risk", f"watching {len(self.broker.positions)} open · weakest ${worst.symbol} "
                             f"{(worst.last_price / worst.entry_price - 1) * 100:+.1f}%", now,
                     meter=0.5 + self.broker.day_pnl_pct() / (2 * self.cfg.risk.daily_loss_limit_pct))

    def _chief(self, now: datetime) -> None:
        b = self.broker
        eq = b.equity()
        if b.halted():
            text = f"daily loss limit hit ({b.day_pnl_pct():.1f}%): no new buys today"
        else:
            text = f"bank {_money(eq)} · day {b.day_pnl_pct():+.1f}% · {len(b.positions)} open"
        self.say("chief", text, now, meter=min(1.0, eq / (2 * self.cfg.desk.start_bank)))

    def _tidy(self, now: datetime) -> None:
        for mint in [m for m, r in self.reviews.items()
                     if r.status in DONE and m not in self.broker.positions and now - r.updated > KEEP_DONE]:
            del self.reviews[mint]
        if len(self.gone) > 5000:
            for mint in sorted(self.gone, key=self.gone.get)[:1000]:
                del self.gone[mint]

    def _record_equity(self, now: datetime) -> None:
        minute = now.replace(second=0, microsecond=0).isoformat()   # one point per minute
        point = [minute, round(self.broker.equity(), 2)]
        if self.equity and self.equity[-1][0] == minute:
            self.equity[-1] = point
        else:
            self.equity.append(point)
        if len(self.equity) > 4320:   # three days of minutes
            del self.equity[: len(self.equity) - 4320]

    # -- the dashboard's view ------------------------------------------------------
    def state(self, now: datetime) -> dict:
        b = self.broker
        # Coins being held always stay on the web; the rest is the 40 most recently touched.
        held = [self.reviews[m] for m in b.positions if m in self.reviews]
        others = sorted((r for r in self.reviews.values() if r.coin.mint not in b.positions),
                        key=lambda r: r.updated or r.first_seen, reverse=True)
        recent = held + others[: max(0, 40 - len(held))]
        focus = self.reviews.get(self.focus) if self.focus else None
        eq = b.equity()
        step = max(1, len(self.equity) // 300)
        trades = b.trades[-30:]
        return {
            "now": now.isoformat(), "mode": self.mode, "started": self.started.isoformat(),
            "judge": describe_judge(self.judge),
            "bank": {"equity": round(eq, 2), "cash": round(b.cash, 2), "start": self.cfg.desk.start_bank,
                     "day_pnl_pct": round(b.day_pnl_pct(), 2), "halted": b.halted(), "open": len(b.positions),
                     "pnl": round(eq - self.cfg.desk.start_bank, 2)},
            "counts": dict(self.counts),
            "agents": {k: dict(v) for k, v in self.agents.items()},   # a copy: snapshots must not share state
            "web": [self._node(r, now) for r in recent],
            "focus": self._sheet(focus) if focus else None,
            "kill_rules": self.kill_rules.most_common(8),
            "positions": [self._pos(p, now) for p in b.positions.values()],
            "trades": [self._trade(t) for t in reversed(trades)],
            "stats": self._stats(),
            "kills": list(reversed(self.kills))[:12],
            "verdicts": list(reversed(self.verdicts))[:10],
            "feed": list(reversed(self.feed))[:30],
            "equity": self.equity[::step] + ([self.equity[-1]] if self.equity and step > 1 else []),
            "notes": list(self.notes),
            "rules": {
                "top wallet": f"≤ {self.cfg.kill.max_top_wallet_pct:g}%",
                "top 10": f"≤ {self.cfg.kill.max_top10_pct:g}%",
                "pool": f"≥ {_money(self.cfg.ready.min_liquidity_usd)}",
                "age": f"≥ {self.cfg.ready.min_age_minutes:g}m",
                "target / stop": f"+{self.cfg.risk.take_profit_pct:g}% / -{self.cfg.risk.stop_loss_pct:g}%",
                "ticket": f"{self.cfg.size.ticket_pct:g}% of bank",
            },
        }

    def _node(self, r: Review, now: datetime) -> dict:
        pnl = None
        p = self.broker.positions.get(r.coin.mint)
        if p:
            pnl = round((p.last_price / p.entry_price - 1) * 100, 1)
        return {"id": r.coin.mint, "symbol": r.coin.symbol, "status": r.status, "note": r.note,
                "born": r.first_seen.isoformat(), "updated": (r.updated or r.first_seen).isoformat(),
                "mcap": round(r.coin.mcap), "pnl": pnl}

    def _sheet(self, r: Review) -> dict:
        sc = self.cfg.scan
        return {"symbol": r.coin.symbol, "name": r.coin.name, "mint": r.coin.mint, "status": r.status,
                "note": r.note, "mcap": round(r.coin.mcap), "liquidity": round(r.coin.liquidity),
                "checks": [c.__dict__ for c in r.checks],
                "scores": {k: round(v, 3) for k, v in r.scores.items()},
                # the line each score must clear (move_already_spent must stay under its line)
                "limits": {"buy_pressure": sc.min_buy_pressure, "buy_pressure_now": sc.min_buy_pressure_now,
                           "momentum_spent": sc.max_momentum_spent, "heat": sc.min_heat,
                           "liquidity_fit": sc.min_liquidity_fit, "social": sc.min_social},
                "verdict": r.verdict.__dict__ if r.verdict else None}

    @staticmethod
    def _pos(p: Position, now: datetime) -> dict:
        return {"symbol": p.symbol, "mint": p.mint, "cost": round(p.cost, 2),
                "pnl_pct": round((p.last_price / p.entry_price - 1) * 100, 1),
                "peak_pct": round((p.peak_price / p.entry_price - 1) * 100, 1),
                "held_min": round((now - p.opened_at).total_seconds() / 60), "why": p.reason}

    @staticmethod
    def _trade(t: Trade) -> dict:
        return {"symbol": t.symbol, "pnl": round(t.pnl, 2), "pnl_pct": round(t.pnl_pct, 1), "exit": t.exit_reason,
                "closed": t.closed_at.isoformat(),
                "held_min": round((t.closed_at - t.opened_at).total_seconds() / 60)}

    def _stats(self) -> dict:
        t = self.broker.trades
        wins = [x.pnl for x in t if x.pnl > 0]
        losses = [-x.pnl for x in t if x.pnl < 0]
        return {"trades": len(t), "wins": len(wins), "win_rate": round(len(wins) / len(t), 3) if t else None,
                "profit_factor": round(sum(wins) / sum(losses), 2) if losses else None,
                "best": round(max((x.pnl_pct for x in t), default=0), 1),
                "worst": round(min((x.pnl_pct for x in t), default=0), 1)}

    # -- saving and resuming (live paper mode) ---------------------------------------
    def save(self) -> None:
        if not self.out_dir:
            return
        b = self.broker
        data = {
            "cash": b.cash, "day": b.day, "day_start_equity": b.day_start_equity,
            "positions": [{**p.__dict__, "opened_at": p.opened_at.isoformat()} for p in b.positions.values()],
            "trades": [{**t.__dict__, "opened_at": t.opened_at.isoformat(), "closed_at": t.closed_at.isoformat()}
                       for t in b.trades[-500:]],
            "cooldown": {m: t.isoformat() for m, t in b.cooldown.items()},
            "equity": self.equity[-4320:], "counts": self.counts, "kill_rules": dict(self.kill_rules),
            "wait_rules": dict(self.wait_rules), "near_miss": dict(self.near_miss),
            "gone": sorted(self.gone, key=self.gone.get)[-3000:],
        }
        tmp = self.out_dir / "state.json.tmp"
        tmp.write_text(json.dumps(data))
        tmp.replace(self.out_dir / "state.json")

    def resume(self) -> bool:
        path = self.out_dir / "state.json" if self.out_dir else None
        if not path or not path.exists():
            return False
        data = json.loads(path.read_text())
        b = self.broker
        b.cash, b.day, b.day_start_equity = data["cash"], data["day"], data["day_start_equity"]
        for p in data["positions"]:
            p["opened_at"] = datetime.fromisoformat(p["opened_at"])
            b.positions[p["mint"]] = Position(**p)
        for t in data["trades"]:
            t["opened_at"], t["closed_at"] = datetime.fromisoformat(t["opened_at"]), datetime.fromisoformat(t["closed_at"])
            b.trades.append(Trade(**t))
        b.cooldown = {m: datetime.fromisoformat(t) for m, t in data["cooldown"].items()}
        self.equity, self.counts = data["equity"], {**self.counts, **data["counts"]}
        self.kill_rules = Counter(data.get("kill_rules", {}))
        self.wait_rules = Counter(data.get("wait_rules", {}))
        self.near_miss = Counter(data.get("near_miss", {}))
        now = datetime.fromisoformat(self.equity[-1][0]) if self.equity else self.started
        self.gone = {m: now for m in data["gone"]}
        # Held coins come back on the watchlist so they keep being priced.
        for p in b.positions.values():
            c = Coin(p.mint, p.symbol, "", "", "", p.opened_at, p.last_price, p.last_liquidity, 0.0)
            self.reviews[p.mint] = Review(c, first_seen=p.opened_at, status="bought", updated=now, note="resumed")
        return True

