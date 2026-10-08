"""The scorecard: every gate the desk must pass before real money is even a question.

It reads the paper trades the desk wrote (trades.csv), keeps only the ones made
under the current rulebook, and checks each gate. Change desk.toml (or switch
between the rules judge and Claude) and the rulebook gets a new id, so the
scorecard starts over: a changed desk has to earn its way back.

Nothing in this module can trade. It only reads files and does arithmetic.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass, fields
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import mean, pstdev
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from .config import Config

PT = ZoneInfo("America/Los_Angeles")
# Numbers saved with each trade: the coin as it looked when the desk bought it.
ENTRY_KEYS = ("age_min", "liquidity", "mcap", "volume_h1", "trades_h1", "buy_pressure", "buy_pressure_now",
              "momentum_spent", "heat", "liquidity_fit", "social", "judge_conf")
NOT_RULES = ("gates", "review")   # sections that judge the desk rather than run it


# -- which rulebook ----------------------------------------------------------------

def rulebook_id(cfg: Config, judge: str) -> str:
    """Short fingerprint of every setting that changes what the desk buys and sells."""
    data = {f.name: asdict(getattr(cfg, f.name)) for f in fields(cfg) if f.name not in NOT_RULES}
    data["judge"] = "ai" if judge.startswith("ai:") else "rules"
    if data["judge"] == "ai":
        data["judge_model"] = judge[3:]
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8]


def record_rulebook(folder: Path, rid: str, judge: str, now: datetime) -> None:
    """Note when each rulebook first ran, so the scorecard knows how long it has been tested."""
    path = folder / "rulebook.json"
    history = json.loads(path.read_text()) if path.exists() else []
    if not history or history[-1]["id"] != rid:
        history.append({"id": rid, "judge": judge, "since": now.isoformat()})
        path.write_text(json.dumps(history, indent=1))


def current_rulebook(cfg: Config, folder: Path) -> dict:
    """The rulebook desk.toml describes right now, and when it started (None if it hasn't run yet)."""
    path = folder / "rulebook.json"
    history = json.loads(path.read_text()) if path.exists() else []
    judge = history[-1]["judge"] if history else "rules"
    rid = rulebook_id(cfg, judge)
    since = next((h["since"] for h in reversed(history) if h["id"] == rid), None)
    return {"id": rid, "judge": judge, "since": datetime.fromisoformat(since) if since else None}


# -- trades ------------------------------------------------------------------------

def load_trades(folder: Path) -> List[dict]:
    path = folder / "trades.csv"
    if not path.exists():
        return []
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            entry = {}
            for k in ENTRY_KEYS:
                if row.get(k) not in (None, ""):
                    entry[k] = float(row[k])
            out.append({
                "opened": datetime.fromisoformat(row["opened"]), "closed": datetime.fromisoformat(row["closed"]),
                "symbol": row["symbol"], "mint": row["mint"], "cost": float(row["cost"]),
                "proceeds": float(row["proceeds"]), "pnl": float(row["pnl"]), "pnl_pct": float(row["pnl_pct"]),
                "exit": row["exit"], "held_min": float(row["held_min"]),
                "rulebook": row.get("rulebook") or "", "judge_by": row.get("judge_by") or "", "entry": entry,
            })
    return sorted(out, key=lambda t: t["closed"])


# -- the numbers ---------------------------------------------------------------------

def profit_factor(pnls: List[float]) -> Optional[float]:
    won = sum(p for p in pnls if p > 0)
    lost = -sum(p for p in pnls if p < 0)
    if lost == 0:
        return math.inf if won > 0 else None
    return won / lost


def max_drawdown_pct(pnls: List[float], start: float) -> float:
    eq = peak = start
    worst = 0.0
    for p in pnls:
        eq += p
        peak = max(peak, eq)
        worst = max(worst, (peak - eq) / peak * 100 if peak > 0 else 0.0)
    return worst


def daily_returns(trades: List[dict], start_bank: float, first: date, last: date) -> List[float]:
    """Each calendar day's realized P&L (Pacific) as a share of the starting bank, quiet days as 0.
    Measured against the start, not the running balance, so a losing run can't average out positive."""
    by_day: Dict[date, float] = defaultdict(float)
    for t in trades:
        by_day[t["closed"].astimezone(PT).date()] += t["pnl"]
    out, d = [], first
    while d <= last:
        out.append(by_day.get(d, 0.0) / start_bank if start_bank > 0 else 0.0)
        d += timedelta(days=1)
    return out


def sharpe(returns: List[float]) -> Optional[float]:
    if len(returns) < 5:
        return None
    sd = pstdev(returns)
    if sd == 0:
        return None
    return mean(returns) / sd * math.sqrt(365)


def summarize(trades: List[dict], cfg: Config, since: Optional[datetime] = None) -> dict:
    """Every number the scorecard and the risk officer look at."""
    g, bank = cfg.gates, cfg.desk.start_bank
    pnls = [t["pnl"] for t in trades]
    n = len(pnls)
    out = {"trades": n, "net": sum(pnls), "pnls": pnls}
    if not n:
        return out
    wins, losses = [t for t in trades if t["pnl"] > 0], [t for t in trades if t["pnl"] < 0]
    first = (since or trades[0]["opened"]).astimezone(PT).date()
    last = trades[-1]["closed"].astimezone(PT).date()
    k = max(3, math.ceil(n * g.best_trades_share))
    extra = (g.cost_multiplier - 1) * 2 * (cfg.size.fee_pct + cfg.size.slippage_pct) / 100
    recent = trades[-max(1, math.ceil(n * g.recent_share)):]
    out.update({
        "wins": len(wins), "win_rate": len(wins) / n,
        "avg_win_pct": mean(t["pnl_pct"] for t in wins) if wins else None,
        "avg_loss_pct": mean(t["pnl_pct"] for t in losses) if losses else None,
        "profit_factor": profit_factor(pnls),
        "days": (trades[-1]["closed"] - (since or trades[0]["opened"])).total_seconds() / 86400,
        "sharpe": sharpe(daily_returns(trades, bank, first, last)), "return_days": (last - first).days + 1,
        "max_drawdown_pct": max_drawdown_pct(pnls, bank),
        "best_k": k, "net_without_best": sum(sorted(pnls)[:-k]) if n > k else None,
        "net_more_costs": sum(t["pnl"] - t["cost"] * extra for t in trades),
        "recent_trades": len(recent), "recent_net": sum(t["pnl"] for t in recent),
        "recent_pf": profit_factor([t["pnl"] for t in recent]),
    })
    return out


# -- the gates -----------------------------------------------------------------------

@dataclass
class Gate:
    key: str
    name: str
    keep_if: str
    value: str
    ok: Optional[bool]   # None: not enough data to tell, which also means not passed
    why: str = ""


def _pf(x: Optional[float]) -> str:
    return "—" if x is None else ("no losses" if x == math.inf else f"{x:.2f}")


def _when(t: datetime) -> str:
    t = t.astimezone(PT)
    return f"{t:%b} {t.day} {t:%H:%M} PT"


def _money(x: float) -> str:
    return f"{'-' if x < 0 else '+'}${abs(x):,.2f}"


def gates(s: dict, cfg: Config, mode: str, officer: Optional[dict], officer_note: str = "not run") -> List[Gate]:
    g = cfg.gates
    n = s["trades"]
    out = [Gate("data", "real market", "live data, not the demo", mode,
                mode == "live", "" if mode == "live" else "the demo market is invented; it proves nothing")]
    out.append(Gate("sample", "enough trades", f"{g.min_trades}+ closed trades", str(n), n >= g.min_trades,
                    "" if n >= g.min_trades else f"{g.min_trades - n} more to go"))
    if not n:
        out += [Gate(k, name, keep, "—", None, "no trades under this rulebook yet") for k, name, keep in (
            ("time", "enough time", f"{g.min_days:g}+ days of paper trading"),
            ("pf", "profit factor", f"above {g.min_profit_factor:g}"),
            ("sharpe", "steady returns", f"Sharpe above {g.min_sharpe:g}"),
            ("drawdown", "pain you'd sit through", f"worst drop under {g.max_drawdown_pct:g}%"),
            ("lucky", "not a few lucky trades", "profitable without the best trades"),
            ("costs", "survives real costs", f"profitable at {g.cost_multiplier:g}x fees and slippage"),
            ("recent", "still works lately", "the newest trades make money too"))]
    else:
        days, pf, sh, dd = s["days"], s["profit_factor"], s["sharpe"], s["max_drawdown_pct"]
        out.append(Gate("time", "enough time", f"{g.min_days:g}+ days of paper trading", f"{days:.1f} days",
                        days >= g.min_days, "" if days >= g.min_days else f"{g.min_days - days:.0f} more days"))
        out.append(Gate("pf", "profit factor", f"above {g.min_profit_factor:g}", _pf(pf),
                        None if pf is None else pf > g.min_profit_factor,
                        "won ÷ lost; under 1.0 loses money" if pf is not None and pf <= 1 else ""))
        out.append(Gate("sharpe", "steady returns", f"Sharpe above {g.min_sharpe:g}",
                        "—" if sh is None else f"{sh:.2f}", None if sh is None else sh > g.min_sharpe,
                        "" if sh is not None else ("needs 5+ days of returns" if s["return_days"] < 5
                                                   else "every day returned the same, so it can't be measured")))
        out.append(Gate("drawdown", "pain you'd sit through", f"worst drop under {g.max_drawdown_pct:g}%",
                        f"{dd:.1f}%", dd < g.max_drawdown_pct))
        wb = s["net_without_best"]
        out.append(Gate("lucky", "not a few lucky trades", f"profitable without the best {s['best_k']}",
                        "—" if wb is None else _money(wb), None if wb is None else wb > 0,
                        "the best few trades carry all of it" if wb is not None and wb <= 0 else ""))
        nc = s["net_more_costs"]
        out.append(Gate("costs", "survives real costs", f"profitable at {g.cost_multiplier:g}x fees and slippage",
                        _money(nc), nc > 0, "" if nc > 0 else "real fills would erase it"))
        rn = s["recent_net"]
        out.append(Gate("recent", "still works lately", f"newest {s['recent_trades']} trades make money",
                        f"{_money(rn)} (PF {_pf(s['recent_pf'])})", rn > 0, "" if rn > 0 else "it is getting worse"))
    if officer is None:
        out.append(Gate("officer", "risk officer", "says KEEP", officer_note, None,
                        "run: python -m nightdesk risk" + (" --demo" if mode == "demo" else "")))
    else:
        out.append(Gate("officer", "risk officer", "says KEEP", f"{officer['verdict']} ({officer['by']})",
                        officer["verdict"] == "KEEP", officer.get("biggest_reason", "")))
    return out


def ready(gs: List[Gate]) -> bool:
    return all(g.ok for g in gs)


def render(gs: List[Gate], s: dict, rb: dict, mode: str, cfg: Config) -> str:
    passed = sum(bool(g.ok) for g in gs)
    lines = [f"Scorecard · {mode} · rulebook {rb['id']} ({'Claude' if rb['judge'].startswith('ai:') else 'rules'} judge)"
             + (f" since {_when(rb['since'])}" if rb.get("since") else ""), ""]
    w = max(len(g.name) for g in gs)
    for g in gs:
        mark = "✓" if g.ok else ("✗" if g.ok is False else "·")
        lines.append(f"  {mark} {g.name:<{w}}  {g.value:<22} keep if {g.keep_if}" + (f" · {g.why}" if g.why else ""))
    lines.append("")
    if ready(gs):
        lines.append(f"PASSES ALL {len(gs)} GATES. If you go further: tiny size, no leverage, hard daily limit, "
                     "and keep the paper desk running beside it.")
    else:
        lines.append(f"NOT READY · {passed} of {len(gs)} gates pass. Keep paper trading. Real money: no.")
    if s["trades"]:
        lines.append(f"\n{s['trades']} trades · net {_money(s['net'])} · won {s['win_rate']:.0%}"
                     + (f" · avg win {s['avg_win_pct']:+.1f}%" if s.get("avg_win_pct") is not None else "")
                     + (f" · avg loss {s['avg_loss_pct']:+.1f}%" if s.get("avg_loss_pct") is not None else ""))
    lines.append("✓ pass · ✗ fail · not enough data yet. Every line must pass.")
    return "\n".join(lines)


def to_json(gs: List[Gate], s: dict, rb: dict, mode: str) -> dict:
    keep = {k: v for k, v in s.items() if k != "pnls"}
    for k, v in keep.items():
        if isinstance(v, float) and math.isinf(v):
            keep[k] = "inf"
    return {"mode": mode, "rulebook": rb["id"], "judge": rb["judge"],
            "since": rb["since"].isoformat() if rb.get("since") else None,
            "ready": ready(gs), "gates": [asdict(g) for g in gs], "summary": keep}
