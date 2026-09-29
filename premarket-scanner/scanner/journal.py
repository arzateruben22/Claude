"""Paper-trade journal: log every pick, grade it after the trade day, keep score.

Grading pretends you bought at the 9:30 ET open of the trade day (evening picks
trade the next morning) and exits at whichever comes first: the +target, the
-stop, or the 4pm close. If one 5-minute bar touches both, it counts as the
stop — pessimistic on purpose.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from pathlib import Path
from statistics import mean, median
from typing import Dict, List, Optional, Tuple

from . import fmt
from .config import OUTPUT, Criteria
from .market import ET, PT, trade_date_for
from .metrics import by_day, rth_bars
from .models import Bar, ScanResult
from .providers.base import Provider

JOURNAL = OUTPUT / "journal.csv"
FIELDS = [
    "scan_date", "session", "scan_time_pt", "trade_date", "symbol", "scan_price", "gap_pct", "rvol",
    "float_shares", "tags", "warnings", "headline",
    "open", "high", "low", "close", "open_vs_scan_pct", "max_up_pct", "max_down_pct", "close_vs_open_pct",
    "sim_exit", "sim_pnl_pct", "graded_at",
]
GRADE_AFTER = time(16, 30)  # ET, gives delayed feeds time to catch up


def _read(path: Path) -> List[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _write(path: Path, rows: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, FIELDS)
        w.writeheader()
        w.writerows(rows)


def record(res: ScanResult, path: Path = JOURNAL) -> int:
    """Log today's picks once each (first sighting keeps its scan price)."""
    rows = _read(path)
    scan_date = res.now.astimezone(ET).date()
    seen = {(r["scan_date"], r["session"], r["symbol"]) for r in rows}
    added = 0
    for c in res.passed:
        key = (scan_date.isoformat(), res.session, c.symbol)
        if key in seen:
            continue
        m = c.metrics
        rows.append({
            "scan_date": key[0], "session": res.session,
            "scan_time_pt": res.now.astimezone(PT).strftime("%H:%M"),
            "trade_date": trade_date_for(res.session, scan_date).isoformat(),
            "symbol": c.symbol, "scan_price": round(m.price, 4), "gap_pct": round(m.gap_pct, 2),
            "rvol": round(m.rvol, 2), "float_shares": int(c.float_shares) if c.float_shares else "",
            "tags": ";".join(c.tags), "warnings": ";".join(c.warnings), "headline": c.headline,
        })
        added += 1
    if added:
        _write(path, rows)
    return added


def simulate(rth: List[Bar], target_pct: float, stop_pct: float) -> Tuple[str, float]:
    entry = rth[0].open
    target, stop = entry * (1 + target_pct / 100), entry * (1 - stop_pct / 100)
    for b in rth:
        if b.low <= stop:
            return "stop", -stop_pct
        if b.high >= target:
            return "target", target_pct
    return "close", (rth[-1].close / entry - 1) * 100


def outcome(bars: List[Bar], day: date, scan_price: float, crit: Criteria) -> Optional[dict]:
    rth = rth_bars(by_day(bars).get(day, []))
    if not rth:
        return None
    o, hi, lo, cl = rth[0].open, max(b.high for b in rth), min(b.low for b in rth), rth[-1].close
    exit_, pnl = simulate(rth, crit.target_pct, crit.stop_pct)
    r = lambda x: round(x, 2)  # noqa: E731
    return {
        "open": round(o, 4), "high": round(hi, 4), "low": round(lo, 4), "close": round(cl, 4),
        "open_vs_scan_pct": r((o / scan_price - 1) * 100), "max_up_pct": r((hi / o - 1) * 100),
        "max_down_pct": r((lo / o - 1) * 100), "close_vs_open_pct": r((cl / o - 1) * 100),
        "sim_exit": exit_, "sim_pnl_pct": r(pnl),
    }


def grade(provider: Provider, crit: Criteria, now: datetime, path: Path = JOURNAL) -> Tuple[int, int]:
    """Fill in outcomes for finished trade days. Returns (graded, still_pending)."""
    rows = _read(path)
    now_et = now.astimezone(ET)
    todo: Dict[str, List[dict]] = defaultdict(list)
    pending = 0
    for r in rows:
        if r.get("graded_at"):
            continue
        day = date.fromisoformat(r["trade_date"])
        if datetime.combine(day, GRADE_AFTER, tzinfo=ET) <= now_et:
            todo[r["trade_date"]].append(r)
        else:
            pending += 1
    graded = 0
    for day_s, day_rows in todo.items():
        day = date.fromisoformat(day_s)
        start = datetime.combine(day, time(4, 0), tzinfo=ET)
        bars = provider.intraday_bars(sorted({r["symbol"] for r in day_rows}), start, start + timedelta(hours=16))
        for r in day_rows:
            res = outcome(bars.get(r["symbol"], []), day, float(r["scan_price"]), crit)
            if res is None:
                pending += 1  # no data yet (or halted all day); try again later
                continue
            r.update(res, graded_at=now_et.strftime("%Y-%m-%d %H:%M"))
            graded += 1
    if graded:
        _write(path, rows)
    return graded, pending


def stats(crit: Criteria, path: Path = JOURNAL) -> str:
    rows = [r for r in _read(path) if r.get("graded_at")]
    if not rows:
        return "No graded picks yet. Run scans for a few days, then `python -m scanner grade`."

    def block(label: str, rs: List[dict]) -> str:
        pnl = [float(r["sim_pnl_pct"]) for r in rs]
        wins = sum(p > 0 for p in pnl)
        held = sum(float(r["open_vs_scan_pct"]) >= 0 for r in rs)
        return (f"{label:<14} {len(rs):>4} picks · win {wins / len(rs):>4.0%} · avg {mean(pnl):+.2f}% "
                f"· median {median(pnl):+.2f}% · max-up avg {mean(float(r['max_up_pct']) for r in rs):+.1f}% "
                f"· gap held to open {held / len(rs):.0%}")

    days = sorted({r["trade_date"] for r in rows})
    out = [f"Paper results: {len(rows)} graded picks over {len(days)} trade days ({days[0]} → {days[-1]})",
           f"Sim: buy the 9:30 ET open, +{crit.target_pct:g}% target / -{crit.stop_pct:g}% stop, else sell at close",
           "", block("All", rows)]
    for session in ("premarket", "afterhours", "regular"):
        rs = [r for r in rows if r["session"] == session]
        if rs:
            out.append(block(session, rs))
    tags = defaultdict(list)
    for r in rows:
        for t in (r["tags"] or "untagged").split(";"):
            tags[t].append(r)
    out += ["", "By catalyst:"] + [block(t, rs) for t, rs in sorted(tags.items(), key=lambda kv: -len(kv[1]))]
    total = sum(float(r["sim_pnl_pct"]) for r in rows)
    out += ["", f"Sum of sim returns: {total:+.1f}% (equal size per pick, no fees/slippage — real fills are worse)."]
    if len(days) < 15:
        out.append(f"Only {len(days)} trade days so far: too few to trust. Aim for 15-20+.")
    return "\n".join(out)


def recent(path: Path = JOURNAL, limit: int = 15) -> str:
    rows = _read(path)[-limit:]
    if not rows:
        return "Journal is empty."
    lines = []
    for r in rows:
        result = f"{r['sim_exit']:<6} {float(r['sim_pnl_pct']):+6.2f}%" if r.get("graded_at") else "pending"
        lines.append(f"{r['trade_date']}  {r['symbol']:<6} {fmt.pct(float(r['gap_pct'])):>7}  {result}")
    return "\n".join(lines)
