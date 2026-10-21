"""Paper-trade journal: log every pick, grade it after the trade day, keep score.

Grading pretends you bought at the 9:30 ET open of the trade day (evening picks
trade the next morning) and exits at whichever comes first: the +target, the
-stop, or the 4pm close. If one 5-minute bar touches both, it counts as the
stop — pessimistic on purpose. Every trade is then charged `cost_pct` for the
spread and slippage you'd really pay.

A short book (side = "short") sells at the open instead: the target is below and
the stop above, and a bar that opens beyond the stop fills where it opened. A book
with exit_by = "10:30" closes whatever is still open at that time ("timed").
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
    "float_shares", "spread_pct", "tags", "warnings", "headline",
    "open", "high", "low", "close", "open_vs_scan_pct", "max_up_pct", "max_down_pct", "close_vs_open_pct",
    "sim_exit", "sim_pnl_pct", "graded_at", "rules",
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


def record(res: ScanResult, path: Path = JOURNAL, rules: str = "") -> int:
    """Log today's picks once each (first sighting keeps its scan price).

    `rules` is the fingerprint of criteria.toml that picked them, so the scorecard
    can count only picks made with the current rules."""
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
            "spread_pct": "" if c.spread_pct is None else round(c.spread_pct, 2),
            "tags": ";".join(c.tags), "warnings": ";".join(c.warnings), "headline": c.headline,
            "rules": rules,
        })
        added += 1
    if added:
        _write(path, rows)
    return added


def simulate(rth: List[Bar], target_pct: float, stop_pct: float, side: str = "long",
             exit_by: str = "") -> Tuple[str, float]:
    entry = rth[0].open
    done = "close"
    if exit_by:
        cutoff = time.fromisoformat(exit_by)
        early = [b for b in rth if b.start.astimezone(ET).time() < cutoff]
        if len(early) < len(rth):
            rth, done = early or rth[:1], "timed"      # whatever is still open goes at the last bar before exit_by
    if side == "short":
        # Sold short at the open: it makes money as the price falls. A stock that jumps the stop
        # (a gap or a halt) is bought back where it reopened, which can be far worse than the stop.
        target, stop = entry * (1 - target_pct / 100), entry * (1 + stop_pct / 100)
        for b in rth:
            if b.high >= stop:
                return "stop", -(max(stop, b.open) / entry - 1) * 100
            if b.low <= target:
                return "target", target_pct
        return done, (1 - rth[-1].close / entry) * 100
    target, stop = entry * (1 + target_pct / 100), entry * (1 - stop_pct / 100)
    for b in rth:
        if b.low <= stop:
            return "stop", -stop_pct
        if b.high >= target:
            return "target", target_pct
    return done, (rth[-1].close / entry - 1) * 100


def outcome(bars: List[Bar], day: date, scan_price: float, crit: Criteria) -> Optional[dict]:
    rth = rth_bars(by_day(bars).get(day, []))
    if not rth:
        return None
    o, hi, lo, cl = rth[0].open, max(b.high for b in rth), min(b.low for b in rth), rth[-1].close
    exit_, pnl = simulate(rth, crit.target_pct, crit.stop_pct, crit.side, crit.exit_by)
    r = lambda x: round(x, 2)  # noqa: E731
    return {
        "open": round(o, 4), "high": round(hi, 4), "low": round(lo, 4), "close": round(cl, 4),
        "open_vs_scan_pct": r((o / scan_price - 1) * 100), "max_up_pct": r((hi / o - 1) * 100),
        "max_down_pct": r((lo / o - 1) * 100), "close_vs_open_pct": r((cl / o - 1) * 100),
        "sim_exit": exit_, "sim_pnl_pct": r(pnl - crit.cost_pct),
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


# Buckets used to see which kinds of picks actually work: (column, [(low, high, label)])
BUCKETS = {
    "gap": ("gap_pct", [(0, 20, "+10-20%"), (20, 40, "+20-40%"), (40, 100, "+40-100%"), (100, 1e9, "+100%+")]),
    "RVOL": ("rvol", [(0, 5, "3-5x"), (5, 10, "5-10x"), (10, 25, "10-25x"), (25, 1e9, "25x+")]),
    "float": ("float_shares", [(0, 5e6, "under 5M"), (5e6, 10e6, "5-10M"), (10e6, 20e6, "10-20M"),
                               (20e6, 1e18, "over 20M")]),
    "price": ("scan_price", [(0, 5, "under $5"), (5, 10, "$5-10"), (10, 1e9, "$10+")]),
}
SMALL_SAMPLE = 20


def _risk_lines(pnl: List[float]) -> List[str]:
    wins = sum(p for p in pnl if p > 0)
    losses = -sum(p for p in pnl if p < 0)
    pf = f"{wins / losses:.2f}" if losses else "no losses"
    run = peak = worst = 0.0
    streak = longest = 0
    for p in pnl:
        run += p
        peak = max(peak, run)
        worst = min(worst, run - peak)
        streak = streak + 1 if p < 0 else 0
        longest = max(longest, streak)
    return [
        f"Profit factor {pf} (total won ÷ total lost; above ~1.5 is good, under 1.0 loses money)",
        f"Worst drawdown {worst:+.1f}% · longest losing streak {longest} trades "
        "(equal size per pick, returns added)",
    ]


def fade(rows: List[dict]) -> Optional[Tuple[int, int, float]]:
    """How often graded picks closed below their 9:30 open: (faded, graded, average close vs open %).
    The pros often bet against gap-ups; this only measures how often that side would have been right."""
    moves = [float(r["close_vs_open_pct"]) for r in rows if r.get("graded_at") and r.get("close_vs_open_pct") not in (None, "")]
    if not moves:
        return None
    return sum(m < 0 for m in moves), len(moves), mean(moves)


def fade_lines(rows: List[dict]) -> List[str]:
    f = fade(rows)
    if not f:
        return []
    down, n, avg = f
    return [f"Fade check: {down}/{n} picks ({down / n:.0%}) closed below their 9:30 open; average close vs open "
            f"{avg:+.1f}%. A measurement only: nothing here bets against them."]


def stats(crit: Criteria, path: Path = JOURNAL) -> str:
    rows = sorted((r for r in _read(path) if r.get("graded_at")), key=lambda r: (r["trade_date"], r["scan_time_pt"]))
    if not rows:
        return "No graded picks yet. Run scans for a few days, then `python -m scanner grade`."

    def block(label: str, rs: List[dict]) -> str:
        pnl = [float(r["sim_pnl_pct"]) for r in rs]
        wins = sum(p > 0 for p in pnl)
        held = sum(float(r["open_vs_scan_pct"]) >= 0 for r in rs)
        star = "*" if len(rs) < SMALL_SAMPLE else " "
        return (f"  {label:<13} {len(rs):>4}{star} picks · win {wins / len(rs):>4.0%} · avg {mean(pnl):+6.2f}% "
                f"· median {median(pnl):+6.2f}% · max-up avg {mean(float(r['max_up_pct']) for r in rs):+5.1f}% "
                f"· gap held to open {held / len(rs):.0%}")

    def grouped(title: str, key) -> List[str]:
        groups = defaultdict(list)
        for r in rows:
            for k in key(r):
                groups[k].append(r)
        return ["", title] + [block(k, rs) for k, rs in groups.items()]

    def bucket(col: str, edges) -> callable:
        def key(r):
            raw = r.get(col)
            if raw in (None, ""):
                return ["unknown"]
            v = float(raw)
            return [lbl for lo, hi, lbl in edges if lo <= v < hi][:1] or ["other"]
        return key

    days = sorted({r["trade_date"] for r in rows})
    pnl = [float(r["sim_pnl_pct"]) for r in rows]
    out = [f"Paper results: {len(rows)} graded picks over {len(days)} trade days ({days[0]} → {days[-1]})",
           (f"Sim: short the 9:30 ET open, cover at -{crit.target_pct:g}% (target) / +{crit.stop_pct:g}% (stop), "
            f"else at the close; {crit.cost_pct:g}% cost per trade" if crit.side == "short" else
            f"Sim: buy the 9:30 ET open, +{crit.target_pct:g}% target / -{crit.stop_pct:g}% stop, else sell at "
            f"{'the ' + crit.exit_by + ' ET exit' if crit.exit_by else 'close'}; {crit.cost_pct:g}% cost per trade"),
           "", block("All", rows)]
    out += [block(sess, rs) for sess in ("premarket", "afterhours", "regular")
            if (rs := [r for r in rows if r["session"] == sess]) and len(rs) != len(rows)]
    out += [""] + _risk_lines(pnl)
    out += fade_lines(rows)
    out += grouped("By catalyst:", lambda r: (r["tags"] or "untagged").split(";"))
    for name, (col, edges) in BUCKETS.items():
        g = grouped(f"By {name}:", bucket(col, edges))
        order = [lbl for *_, lbl in edges] + ["unknown", "other"]
        out += g[:2] + sorted(g[2:], key=lambda line: next(
            (i for i, lbl in enumerate(order) if line.startswith(f"  {lbl} ")), 99))
    out += grouped("By month:", lambda r: [r["trade_date"][:7]])
    out += ["", f"Sum of sim returns: {sum(pnl):+.1f}% (equal size per pick, after {crit.cost_pct:g}% cost each).",
            f"* fewer than {SMALL_SAMPLE} picks: noise, not a pattern."]
    if len(days) < 15:
        out.append(f"Only {len(days)} trade days so far: too few to trust. Aim for 15-20+.")
    return "\n".join(out)


def _paper_dollars(results: List[Tuple[dict, float]], bank: float = 100.0) -> float:
    """Paper dollars, the way the paper book counts them: each trade day's picks split `bank` equally."""
    per_day: Dict[str, int] = defaultdict(int)
    for r, _ in results:
        per_day[r["trade_date"]] += 1
    return sum(bank / per_day[r["trade_date"]] * pct / 100 for r, pct in results)


def lookback(provider: Provider, crit: Criteria, path: Path, book: str, against: str) -> str:
    """`crit` applied to another book's picks that were already graded: what those same picks would have
    done under these rules. In-sample by construction, so it explains, it never proves."""
    rows = [r for r in _read(path) if r.get("graded_at") and r.get("sim_pnl_pct") not in (None, "")]
    if not rows:
        return f"No graded picks in {path} yet, so there's nothing to look back on."
    mine: List[Tuple[dict, dict]] = []
    days = sorted({r["trade_date"] for r in rows})
    for day_s in days:
        day = date.fromisoformat(day_s)
        day_rows = [r for r in rows if r["trade_date"] == day_s]
        start = datetime.combine(day, time(4, 0), tzinfo=ET)
        bars = provider.intraday_bars(sorted({r["symbol"] for r in day_rows}), start, start + timedelta(hours=16))
        for r in day_rows:
            res = outcome(bars.get(r["symbol"], []), day, float(r["scan_price"]), crit)
            if res:
                mine.append((r, res))
    if not mine:
        return "No price bars came back for those days, so there's nothing to compare yet."
    verb = "sold short" if crit.side == "short" else "bought"
    out = [f"LOOK-BACK · the {book} rules on the {against} book's {len(mine)} graded picks "
           f"({days[0]} → {days[-1]})",
           f"Each pick {verb} at the 9:30 open: -{crit.target_pct:g}% target / +{crit.stop_pct:g}% stop "
           f"or the close, minus {crit.cost_pct:g}%." if crit.side == "short" else
           f"Each pick {verb} at the 9:30 open: +{crit.target_pct:g}% target / -{crit.stop_pct:g}% stop "
           f"or the close, minus {crit.cost_pct:g}%.", "",
           f"  {'day':<10} {'symbol':<6} {'gap':>7}   {against:<16} {book}"]
    for r, res in mine:
        out.append(f"  {r['trade_date']:<10} {r['symbol']:<6} {fmt.pct(float(r['gap_pct'] or 0)):>7}   "
                   f"{r['sim_exit']:<6} {float(r['sim_pnl_pct']):+6.1f}%   {res['sim_exit']:<6} {res['sim_pnl_pct']:+6.1f}%")

    def line(name: str, pcts: List[Tuple[dict, float]]) -> str:
        p = [x for _, x in pcts]
        won, lost = sum(x for x in p if x > 0), -sum(x for x in p if x < 0)
        pf = "no losses" if not lost else f"{won / lost:.2f}"
        return (f"  {name:<8} won {sum(x > 0 for x in p)}/{len(p)} · average {mean(p):+.2f}% · profit factor {pf} · "
                f"paper ${_paper_dollars(pcts):+,.2f} on $100")

    out += ["", line(against, [(r, float(r["sim_pnl_pct"])) for r, _ in mine]),
            line(book, [(r, res["sim_pnl_pct"]) for r, res in mine]), "",
            "Hindsight, not evidence: these are picks you have already seen, and what they did is the reason to",
            f"try the {book} rules at all. Only the {book} book's own picks, made from now on, count toward its scorecard."]
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
