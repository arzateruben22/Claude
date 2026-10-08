"""The scorecard: every gate the rules must pass before real money is even a question.

It needs two kinds of evidence, both made with the CURRENT criteria.toml:
  history  a backtest  (python -m scanner backtest --from ...)
  forward  paper picks, scanned and graded since the rules last changed
Every pick and every backtest is stamped with a fingerprint of the rules, so
changing criteria.toml starts the scorecard over: new rules earn their way back.

Nothing in this module can trade. It only reads files and does arithmetic.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import defaultdict
from dataclasses import asdict, dataclass, field, fields
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean, pstdev
from typing import Dict, List, Optional, Tuple

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib  # type: ignore[no-redef]

from .config import ROOT, Criteria

DISPLAY_ONLY = ("sort_by", "show_near_misses")   # settings that change the report, not the picks


@dataclass
class GatesCfg:
    min_picks: int = 100
    min_profit_factor: float = 1.3
    min_sharpe: float = 1.0
    max_drawdown_pct: float = 25.0
    best_picks_share: float = 0.05
    cost_multiplier: float = 2.0
    recent_share: float = 0.33
    min_good_months: float = 0.6
    min_paper_days: int = 20
    paper_vs_backtest: float = 0.5


@dataclass
class ReviewCfg:
    use_ai: bool = True
    model: str = "claude-opus-5-5"
    effort: str = "high"
    lookback_days: float = 7


@dataclass
class Settings:
    gates: GatesCfg = field(default_factory=GatesCfg)
    review: ReviewCfg = field(default_factory=ReviewCfg)


def load_settings(path: Optional[Path] = None) -> Settings:
    """[gates] and [review] from criteria.toml; unknown keys are an error, like the rest."""
    path = path or ROOT / "criteria.toml"
    with open(path, "rb") as fh:
        raw = tomllib.load(fh)
    out = Settings()
    for name in ("gates", "review"):
        values = raw.get(name, {})
        target = getattr(out, name)
        unknown = sorted(set(values) - {f.name for f in fields(target)})
        if unknown:
            raise ValueError(f"Unknown setting(s) in [{name}] of {path.name}: {', '.join(unknown)}")
        for k, v in values.items():
            setattr(target, k, v)
    if out.review.effort not in ("low", "medium", "high", "xhigh", "max"):
        raise ValueError("[review] effort must be low, medium, high, xhigh or max")
    return out


def rules_id(crit: Criteria) -> str:
    """Short fingerprint of every setting that changes which stocks get picked, or how they're graded."""
    data = {k: v for k, v in asdict(crit).items() if k not in DISPLAY_ONLY}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:8]


# -- reading picks -------------------------------------------------------------------

def _num(x) -> Optional[float]:
    try:
        return float(x) if x not in (None, "") else None
    except ValueError:
        return None


def read_picks(path: Path) -> List[dict]:
    """Graded journal rows, oldest first, with numbers parsed."""
    if not path.exists():
        return []
    out = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if not r.get("graded_at") or _num(r.get("sim_pnl_pct")) is None:
                continue
            out.append({
                "trade_date": date.fromisoformat(r["trade_date"]), "scan_date": r["scan_date"],
                "session": r["session"], "symbol": r["symbol"], "pnl": float(r["sim_pnl_pct"]),
                "exit": r.get("sim_exit", ""), "rules": r.get("rules") or "",
                "tags": [t for t in (r.get("tags") or "").split(";") if t], "headline": r.get("headline", ""),
                "entry": {k: v for k, v in (("gap_pct", _num(r.get("gap_pct"))), ("rvol", _num(r.get("rvol"))),
                                            ("float_shares", _num(r.get("float_shares"))),
                                            ("scan_price", _num(r.get("scan_price"))),
                                            ("spread_pct", _num(r.get("spread_pct")))) if v is not None},
                "open_vs_scan_pct": _num(r.get("open_vs_scan_pct")),
            })
    return sorted(out, key=lambda p: (p["trade_date"], p["scan_date"]))


def find_backtest(root: Path, rid: str) -> Tuple[Optional[Path], dict]:
    """The newest backtest made with these rules, plus how many rule sets have been backtested."""
    best, meta, tried, older = None, {}, set(), False
    for f in sorted((root / "backtests").glob("*/rules.json")):
        m = json.loads(f.read_text())
        tried.add(m["id"])
        if m["id"] != rid:
            older = True
            continue
        if not meta or m["created"] > meta["created"]:
            best, meta = f.parent, m
    return best, {**meta, "rule_sets_tried": len(tried), "older_only": older and best is None}


# -- the numbers ----------------------------------------------------------------------

def profit_factor(pnls: List[float]) -> Optional[float]:
    won = sum(p for p in pnls if p > 0)
    lost = -sum(p for p in pnls if p < 0)
    if lost == 0:
        return math.inf if won > 0 else None
    return won / lost


def daily_returns(picks: List[dict], days: List[date]) -> List[float]:
    """One return per trading day: the day's picks split the account equally; no picks = cash."""
    by_day: Dict[date, List[float]] = defaultdict(list)
    for p in picks:
        by_day[p["trade_date"]].append(p["pnl"])
    return [mean(by_day[d]) / 100 if by_day.get(d) else 0.0 for d in days]


def sharpe(returns: List[float]) -> Optional[float]:
    if len(returns) < 5:
        return None
    sd = pstdev(returns)
    return None if sd == 0 else mean(returns) / sd * math.sqrt(252)


def max_drawdown_pct(returns: List[float]) -> float:
    eq = peak = 1.0
    worst = 0.0
    for r in returns:
        eq *= 1 + r
        peak = max(peak, eq)
        worst = max(worst, (peak - eq) / peak * 100)
    return worst


def summarize(picks: List[dict], crit: Criteria, g: GatesCfg, days: List[date]) -> dict:
    pnls = [p["pnl"] for p in picks]
    n = len(pnls)
    out = {"picks": n, "net": sum(pnls), "trade_days": len({p["trade_date"] for p in picks})}
    if not n:
        return out
    k = max(3, math.ceil(n * g.best_picks_share))
    recent = picks[-max(1, math.ceil(n * g.recent_share)):]
    rets = daily_returns(picks, days)
    months: Dict[str, List[float]] = defaultdict(list)
    for p in picks:
        months[p["trade_date"].strftime("%Y-%m")].append(p["pnl"])
    counted = {m: sum(v) for m, v in months.items() if len(v) >= 5}
    out.update({
        "avg": mean(pnls), "win_rate": sum(p > 0 for p in pnls) / n, "profit_factor": profit_factor(pnls),
        "sharpe": sharpe(rets), "return_days": len(rets), "max_drawdown_pct": max_drawdown_pct(rets),
        "best_k": k, "net_without_best": sum(sorted(pnls)[:-k]) if n > k else None,
        "net_more_costs": sum(p - crit.cost_pct * (g.cost_multiplier - 1) for p in pnls),
        "recent_picks": len(recent), "recent_net": sum(p["pnl"] for p in recent),
        "recent_pf": profit_factor([p["pnl"] for p in recent]),
        "months": {m: round(v, 2) for m, v in sorted(counted.items())},
        "good_months": (sum(v > 0 for v in counted.values()) / len(counted)) if counted else None,
    })
    return out


# -- the gates --------------------------------------------------------------------------

@dataclass
class Gate:
    key: str
    group: str        # history | forward | sign-off
    name: str
    keep_if: str
    value: str
    ok: Optional[bool]   # None: not enough data to tell, which also means not passed
    why: str = ""


def _pf(x: Optional[float]) -> str:
    return "—" if x is None else ("no losses" if math.isinf(x) else f"{x:.2f}")


def _pct(x: float) -> str:
    return f"{x:+.1f}%"


def gates(bt: Optional[dict], bt_meta: dict, paper: dict, g: GatesCfg, crit: Criteria, demo: bool,
          officer: Optional[dict], officer_note: str = "not run") -> List[Gate]:
    out: List[Gate] = []
    H, F = "history", "forward"
    real = not demo and bt_meta.get("provider", "") not in ("", "demo")
    out.append(Gate("data", H, "real market data", "a backtest on real history, not the demo",
                    bt_meta.get("provider", "none") if bt_meta.get("id") else "none", real if bt_meta.get("id") else False,
                    "" if real else ("the demo tickers are invented; they prove nothing" if demo or bt_meta.get("id")
                                     else "no backtest with these rules yet")))
    if bt is None:
        why = ("the backtests on file used older rules: re-run it" if bt_meta.get("older_only")
               else "run: python -m scanner backtest --from YYYY-MM-DD")
        out.append(Gate("backtest", H, "backtest with these rules", "one exists", "none", False, why))
        bt = {"picks": 0}
    n = bt["picks"]
    out.append(Gate("sample", H, "enough picks", f"{g.min_picks}+ graded picks", str(n), n >= g.min_picks,
                    "" if n >= g.min_picks else f"{g.min_picks - n} short: backtest a longer stretch"))
    if not n:
        for key, name, keep in (("pf", "profit factor", f"above {g.min_profit_factor:g}"),
                                ("sharpe", "steady returns", f"Sharpe above {g.min_sharpe:g}"),
                                ("drawdown", "pain you'd sit through", f"worst drop under {g.max_drawdown_pct:g}%"),
                                ("lucky", "not a few lucky picks", "profitable without the best picks"),
                                ("costs", "survives real costs", f"profitable at {g.cost_multiplier:g}x costs"),
                                ("recent", "still works lately", "the newest picks make money too"),
                                ("months", "most months", f"{g.min_good_months:.0%}+ of months profitable")):
            out.append(Gate(key, H, name, keep, "—", None, "no backtest picks"))
    else:
        pf, sh, dd = bt["profit_factor"], bt["sharpe"], bt["max_drawdown_pct"]
        out.append(Gate("pf", H, "profit factor", f"above {g.min_profit_factor:g}", _pf(pf),
                        None if pf is None else pf > g.min_profit_factor,
                        "won ÷ lost; under 1.0 loses money" if pf is not None and pf <= 1 else ""))
        out.append(Gate("sharpe", H, "steady returns", f"Sharpe above {g.min_sharpe:g}",
                        "—" if sh is None else f"{sh:.2f}", None if sh is None else sh > g.min_sharpe,
                        "" if sh is not None else ("needs 5+ trading days" if bt["return_days"] < 5
                                                   else "every day returned the same, so it can't be measured")))
        out.append(Gate("drawdown", H, "pain you'd sit through", f"worst drop under {g.max_drawdown_pct:g}%",
                        f"{dd:.1f}%", dd < g.max_drawdown_pct, "each day's picks share the account equally"))
        wb = bt["net_without_best"]
        out.append(Gate("lucky", H, "not a few lucky picks", f"profitable without the best {bt['best_k']}",
                        "—" if wb is None else _pct(wb), None if wb is None else wb > 0,
                        "the best few picks carry all of it" if wb is not None and wb <= 0 else ""))
        out.append(Gate("costs", H, "survives real costs", f"profitable at {g.cost_multiplier:g}x cost_pct",
                        _pct(bt["net_more_costs"]), bt["net_more_costs"] > 0,
                        "" if bt["net_more_costs"] > 0 else "worse fills would erase it"))
        out.append(Gate("recent", H, "still works lately", f"newest {bt['recent_picks']} picks make money",
                        f"{_pct(bt['recent_net'])} (PF {_pf(bt['recent_pf'])})", bt["recent_net"] > 0,
                        "" if bt["recent_net"] > 0 else "it is getting worse"))
        gm = bt["good_months"]
        out.append(Gate("months", H, "most months", f"{g.min_good_months:.0%}+ of months profitable",
                        "—" if gm is None else f"{gm:.0%} of {len(bt['months'])}", None if gm is None else
                        gm >= g.min_good_months, "needs months with 5+ picks" if gm is None else ""))

    days = paper["trade_days"]
    out.append(Gate("paper_days", F, "paper trading", f"{g.min_paper_days}+ graded trade days with these rules",
                    f"{days} days", days >= g.min_paper_days,
                    "" if days >= g.min_paper_days else f"{g.min_paper_days - days} more trade days (scan + grade)"))
    if paper["picks"] and n:
        need = g.paper_vs_backtest * bt["avg"]
        ok = paper["net"] > 0 and paper["avg"] >= need
        out.append(Gate("paper_tracks", F, "paper matches the backtest",
                        f"profitable, and at least {g.paper_vs_backtest:.0%} of the backtest's average",
                        f"{paper['avg']:+.2f}% vs {bt['avg']:+.2f}% a pick", ok,
                        "" if ok else "live picks are doing worse than history said"))
    else:
        out.append(Gate("paper_tracks", F, "paper matches the backtest", "paper profitable and close to history",
                        "—", None, "needs paper picks and a backtest"))
    if officer is None:
        out.append(Gate("officer", "sign-off", "risk officer", "says KEEP", officer_note, None,
                        "run: python -m scanner risk" + (" --demo" if demo else "")))
    else:
        out.append(Gate("officer", "sign-off", "risk officer", "says KEEP", f"{officer['verdict']} ({officer['by']})",
                        officer["verdict"] == "KEEP", officer.get("biggest_reason", "")))
    return out


def ready(gs: List[Gate]) -> bool:
    return all(x.ok for x in gs)


def render(gs: List[Gate], rid: str, bt_dir: Optional[Path], bt_meta: dict, paper: dict, demo: bool) -> str:
    passed = sum(bool(x.ok) for x in gs)
    lines = [f"Scorecard · {'demo' if demo else 'live'} · rules {rid}"]
    if bt_dir:
        lines.append(f"History: backtest {bt_meta.get('first')} → {bt_meta.get('last')} ({bt_dir.name})")
    lines.append(f"Forward: {paper['picks']} graded paper picks with these rules")
    w = max(len(x.name) for x in gs)
    group = None
    for x in gs:
        if x.group != group:
            group = x.group
            lines += ["", f"{group.upper()}"]
        mark = "✓" if x.ok else ("✗" if x.ok is False else "·")
        lines.append(f"  {mark} {x.name:<{w}}  {x.value:<24} keep if {x.keep_if}" + (f" · {x.why}" if x.why else ""))
    lines.append("")
    if ready(gs):
        lines.append(f"PASSES ALL {len(gs)} GATES. If you go further: tiny size, no margin, a hard daily loss "
                     "limit, and keep paper trading beside it.")
    else:
        lines.append(f"NOT READY · {passed} of {len(gs)} gates pass. Keep paper trading. Real money: no.")
    tried = bt_meta.get("rule_sets_tried", 0)
    if tried > 3:
        lines.append(f"You've backtested {tried} different rule sets. The more you try, the more likely one "
                     "passes by luck: trust the paper results most.")
    lines.append("✓ pass · ✗ fail · not enough data yet. Every line must pass.")
    return "\n".join(lines)


def to_json(gs: List[Gate], rid: str, bt: Optional[dict], paper: dict, demo: bool) -> dict:
    def clean(d):
        return {k: ("inf" if isinstance(v, float) and math.isinf(v) else v) for k, v in (d or {}).items()}
    return {"at": datetime.now(timezone.utc).isoformat(), "mode": "demo" if demo else "live", "rules": rid,
            "ready": ready(gs), "gates": [asdict(x) for x in gs], "backtest": clean(bt), "paper": clean(paper)}
