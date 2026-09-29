"""Watchlist output: terminal table, Markdown + CSV files, push-notification text."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import List

from . import fmt, html_report
from .config import OUTPUT, Criteria
from .market import PT, fmt_pt
from .models import Candidate, ScanResult

SESSION_LABEL = {"premarket": "Pre-market", "regular": "Market hours", "afterhours": "After-hours / night before"}
DISCLAIMER = "Watchlist, not advice. Small caps move fast both ways: paper trade first."


def _catalyst(c: Candidate) -> str:
    bits = [("⚠ " if f"{t} headline" in c.warnings else "") + t for t in c.tags]
    return ", ".join(bits) or ("news" if c.news else "—")


def _row(i: int, c: Candidate) -> List[str]:
    m = c.metrics
    return [
        str(i),
        c.symbol,
        fmt.money(m.price),
        fmt.pct(m.gap_pct),
        f"{m.rvol:.1f}x",
        fmt.shares(m.session_volume),
        fmt.shares(c.float_shares),
        "?" if c.spread_pct is None else f"{c.spread_pct:.1f}%",
        fmt.money(m.session_high),
        _catalyst(c),
    ]


HEAD = ["#", "Symbol", "Price", "Gap", "RVOL", "Volume", "Float", "Spread", "Session high", "Catalyst"]


def _table(rows: List[List[str]]) -> str:
    widths = [max(len(r[i]) for r in [HEAD] + rows) for i in range(len(HEAD))]
    line = lambda r: "  ".join(v.ljust(w) for v, w in zip(r, widths)).rstrip()  # noqa: E731
    return "\n".join([line(HEAD), line(["-" * w for w in widths])] + [line(r) for r in rows])


def header(res: ScanResult) -> str:
    delay = f", data delayed ~{res.delay_minutes} min" if res.delay_minutes else ""
    demo = "  [DEMO DATA — fake tickers]" if res.provider == "demo" else ""
    return f"{SESSION_LABEL[res.session]} scan · {fmt_pt(res.now)} · {res.provider}{delay}{demo}"


def terminal(res: ScanResult, crit: Criteria) -> str:
    out = [header(res), f"Rules: {crit.summary()}", ""]
    if res.passed:
        out.append(_table([_row(i, c) for i, c in enumerate(res.passed, 1)]))
        out.append("")
        for c in res.passed:
            if c.news:
                out.append(f"  {c.symbol}: {c.headline}")
            for w in c.warnings:
                out.append(f"  {c.symbol}: ⚠ {w}")
    else:
        out.append("Nothing passes every rule right now.")
    if res.near_misses:
        out += ["", "Near misses (fail one rule):"]
        out += [f"  {c.symbol:<6} {fmt.money(c.metrics.price):>8}  {fmt.pct(c.metrics.gap_pct):>7}  ✗ {c.failures[0]}"
                for c in res.near_misses]
    out += ["", f"Screened {res.universe:,} symbols · checked {res.checked} in detail"] + res.notes
    return "\n".join(out)


def markdown(res: ScanResult, crit: Criteria) -> str:
    out = [f"# {SESSION_LABEL[res.session]} watchlist", "", f"_{header(res)}_", "", f"**Rules:** {crit.summary()}", ""]
    if res.passed:
        out += ["| " + " | ".join(HEAD) + " |", "|" + "---|" * len(HEAD)]
        out += ["| " + " | ".join(_row(i, c)) + " |" for i, c in enumerate(res.passed, 1)]
        out += ["", "## Catalysts", ""]
        for c in res.passed:
            warn = "".join(f" ⚠ _{w}_" for w in c.warnings)
            if c.news:
                n = c.news[0]
                link = f"[{n.headline}]({n.url})" if n.url else n.headline
                out.append(f"- **{c.symbol}** — {link} ({n.source}, {fmt_pt(n.published)}){warn}")
            else:
                out.append(f"- **{c.symbol}** — no headline found{warn}")
    else:
        out.append("Nothing passes every rule right now.")
    if res.near_misses:
        out += ["", "## Near misses", "", "| Symbol | Price | Gap | RVOL | Missed on |", "|---|---|---|---|---|"]
        out += [f"| {c.symbol} | {fmt.money(c.metrics.price)} | {fmt.pct(c.metrics.gap_pct)} | {c.metrics.rvol:.1f}x | {c.failures[0]} |"
                for c in res.near_misses]
    out += ["", f"Screened {res.universe:,} symbols · checked {res.checked} in detail."]
    out += [f"- {n}" for n in res.notes]
    out += ["", f"_{DISCLAIMER}_", ""]
    return "\n".join(out)


CSV_FIELDS = ["rank", "symbol", "name", "price", "ref_close", "gap_pct", "rvol", "session_volume",
              "avg_daily_volume", "float_shares", "spread_pct", "session_high", "tags", "warnings",
              "headline", "url"]


def write_outputs(res: ScanResult, crit: Criteria, out_dir: Path = OUTPUT) -> List[Path]:
    folder = out_dir / "watchlists"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = res.now.astimezone(PT).strftime("%Y-%m-%d_%H%M")
    base = folder / f"{stamp}_{res.session}"
    md = markdown(res, crit)
    base.with_suffix(".md").write_text(md, encoding="utf-8")
    (out_dir / "latest.md").write_text(md, encoding="utf-8")
    page = html_report.page(res, crit)
    base.with_suffix(".html").write_text(page, encoding="utf-8")
    (out_dir / "latest.html").write_text(page, encoding="utf-8")
    with open(base.with_suffix(".csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, CSV_FIELDS)
        w.writeheader()
        for i, c in enumerate(res.passed, 1):
            m = c.metrics
            w.writerow({
                "rank": i, "symbol": c.symbol, "name": c.name, "price": round(m.price, 4),
                "ref_close": round(m.ref_close, 4), "gap_pct": round(m.gap_pct, 2), "rvol": round(m.rvol, 2),
                "session_volume": int(m.session_volume), "avg_daily_volume": int(m.avg_daily_volume),
                "float_shares": int(c.float_shares) if c.float_shares else "",
                "spread_pct": "" if c.spread_pct is None else round(c.spread_pct, 2),
                "session_high": round(m.session_high, 4),
                "tags": ";".join(c.tags), "warnings": ";".join(c.warnings), "headline": c.headline,
                "url": c.news[0].url if c.news else "",
            })
    return [base.with_suffix(".html"), base.with_suffix(".md"), base.with_suffix(".csv"), out_dir / "latest.html"]


def one_line(res: ScanResult) -> str:
    """'3 picks: DMBIO +62%, DMAI +35%, DMEV +18%' (fits a notification line)."""
    if not res.passed:
        return "No picks this scan. Tap to see the near misses."
    names = ", ".join(f"{c.symbol} {c.metrics.gap_pct:+.0f}%" for c in res.passed[:6])
    more = f" +{len(res.passed) - 6} more" if len(res.passed) > 6 else ""
    return f"{len(res.passed)} pick{'s' if len(res.passed) != 1 else ''}: {names}{more}. Tap to open the list."


def push_text(res: ScanResult) -> str:
    """Short version for a phone notification."""
    if not res.passed:
        return "No stocks pass every rule right now."
    lines = []
    for c in res.passed[:8]:
        m = c.metrics
        warn = " ⚠" if any(not w.endswith("unknown") for w in c.warnings) else ""
        lines.append(f"{c.symbol} {fmt.money(m.price)} {fmt.pct(m.gap_pct)} RVOL {m.rvol:.0f}x "
                     f"float {fmt.shares(c.float_shares)}{warn}\n  {c.headline[:90]}")
    if len(res.passed) > 8:
        lines.append(f"+{len(res.passed) - 8} more")
    return "\n".join(lines)
