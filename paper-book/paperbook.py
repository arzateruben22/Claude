"""Paper Book: every paper trade from both desks in one ledger, with one running total.

  memecoins  Night Desk (../night-desk): brand-new Solana coins, live prices, paper money
  majors     Majors Desk (../majors-desk): BTC, ETH, XRP, ADA..., hourly trend following, paper money
  stocks     Premarket scanner (../premarket-scanner): gap-up picks, graded after the close

  python paperbook.py               update the ledger and the report once
  python paperbook.py --watch 15    ...every 15 minutes, while the desks run
  python paperbook.py --demo        the same, from the desks' demo markets

Writes output/ledger.csv (one row per closed paper trade) and output/paper-book.html.
Paper money only. Nothing here can place a real order.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import sys
import time as _time
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

HERE = Path(__file__).resolve().parent
ET = ZoneInfo("America/New_York")
DESKS = ("memecoins", "majors", "stocks")
LABEL = {"memecoins": "Memecoins", "majors": "Big coins", "stocks": "Stocks"}


@dataclass
class Trade:
    desk: str
    symbol: str
    opened: datetime
    closed: datetime
    pnl: float            # paper dollars, after fees and slippage
    pnl_pct: float
    exit: str


@dataclass
class Holding:
    desk: str
    symbol: str
    opened: datetime
    cost: float
    value: Optional[float]   # marked at the last price; None = not bought yet (a stock waiting for the open)
    note: str


# -- reading the desks ----------------------------------------------------------------------

def _read_csv(path: Path) -> List[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _dt(s: str) -> datetime:
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def load_coins(folder: Path, desk: str = "memecoins", prefix: str = "$") -> Tuple[List[Trade], List[Holding]]:
    """Night Desk and Majors Desk write the same files: trades.csv and state.json."""
    trades = [Trade(desk, prefix + r["symbol"], _dt(r["opened"]), _dt(r["closed"]), float(r["pnl"]),
                    float(r["pnl_pct"]), r["exit"].split(":")[0])
              for r in _read_csv(folder / "trades.csv")]
    held: List[Holding] = []
    state = folder / "state.json"
    if state.exists():
        for p in json.loads(state.read_text()).get("positions", []):
            held.append(Holding(desk, prefix + p["symbol"], _dt(p["opened_at"]), float(p["cost"]),
                                float(p["qty"]) * float(p["last_price"]), "marked at the last price, before exit costs"))
    return trades, held


def load_stocks(journal: Path, ticket: float) -> Tuple[List[Trade], List[Holding]]:
    trades: List[Trade] = []
    held: List[Holding] = []
    for r in _read_csv(journal):
        day = date.fromisoformat(r["trade_date"])
        opened = datetime.combine(day, time(9, 30), tzinfo=ET)
        if r.get("sim_pnl_pct", "") != "":
            pct = float(r["sim_pnl_pct"])
            trades.append(Trade("stocks", r["symbol"], opened, datetime.combine(day, time(16, 0), tzinfo=ET),
                                round(ticket * pct / 100, 2), pct, r.get("sim_exit", "") or "close"))
        else:
            held.append(Holding("stocks", r["symbol"], opened, ticket, None,
                                f"picked {r['scan_date']}; buys at the {day:%a %d %b} open, graded after the close"))
    return trades, held


def newest_demo_journal(scanner: Path) -> Path:
    found = sorted((scanner / "output" / "demo" / "backtests").glob("*/journal.csv"), key=lambda p: p.stat().st_mtime)
    return found[-1] if found else scanner / "output" / "demo" / "journal.csv"


# -- the numbers ------------------------------------------------------------------------------

def stats(trades: List[Trade], start: float) -> dict:
    trades = sorted(trades, key=lambda t: t.closed)
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [-t.pnl for t in trades if t.pnl < 0]
    equity, peak, max_dd = start, start, 0.0
    for t in trades:
        equity += t.pnl
        peak = max(peak, equity)
        max_dd = max(max_dd, (peak - equity) / peak * 100 if peak > 0 else 0.0)
    net = sum(t.pnl for t in trades)
    return {
        "trades": len(trades), "wins": len(wins), "net": round(net, 2), "start": start,
        "return_pct": round(net / start * 100, 2) if start else 0.0,
        "win_rate": round(len(wins) / len(trades) * 100, 1) if trades else 0.0,
        "avg_win": round(sum(wins) / len(wins), 2) if wins else 0.0,
        "avg_loss": round(-sum(losses) / len(losses), 2) if losses else 0.0,
        "profit_factor": round(sum(wins) / sum(losses), 2) if losses else (None if not wins else float("inf")),
        "best": max(trades, key=lambda t: t.pnl) if trades else None,
        "worst": min(trades, key=lambda t: t.pnl) if trades else None,
        "max_drawdown_pct": round(max_dd, 1),
    }


def daily(trades: List[Trade], tz: ZoneInfo) -> Dict[date, float]:
    out: Dict[date, float] = defaultdict(float)
    for t in trades:
        out[t.closed.astimezone(tz).date()] += t.pnl
    return dict(out)


def equity_series(trades: List[Trade], start: float) -> List[Tuple[datetime, float]]:
    eq, out = start, []
    for t in sorted(trades, key=lambda t: t.closed):
        eq += t.pnl
        out.append((t.closed, eq))
    return out


@dataclass
class Book:
    trades: Dict[str, List[Trade]]
    held: Dict[str, List[Holding]]
    banks: Dict[str, float]
    sources: Dict[str, str]
    demo: bool
    now: datetime
    tz: ZoneInfo
    ticket: float = 100.0
    stock_rules: Tuple[float, float, float] = (10.0, 5.0, 0.5)    # target %, stop %, cost % from the scanner

    @property
    def all_trades(self) -> List[Trade]:
        return sorted((t for d in DESKS for t in self.trades[d]), key=lambda t: t.closed)

    @property
    def unrealized(self) -> float:
        return sum(h.value - h.cost for d in DESKS for h in self.held[d] if h.value is not None)


def load(cfg: dict, demo: bool, now: Optional[datetime] = None) -> Book:
    c, m, s = cfg["memecoins"], cfg["majors"], cfg["stocks"]
    coins_folder = (HERE / (c["demo_folder"] if demo else c["folder"])).resolve()
    majors_folder = (HERE / (m["demo_folder"] if demo else m["folder"])).resolve()
    if demo:
        journal = HERE / s["demo_journal"] if s.get("demo_journal") else newest_demo_journal(HERE.parent / "premarket-scanner")
    else:
        journal = HERE / s["journal"]
    journal = journal.resolve()
    ct, ch = load_coins(coins_folder, "memecoins", "$")
    mt, mh = load_coins(majors_folder, "majors", "")
    st, sh = load_stocks(journal, float(s["ticket_usd"]))
    return Book({"memecoins": ct, "majors": mt, "stocks": st}, {"memecoins": ch, "majors": mh, "stocks": sh},
                {"memecoins": float(c["start_bank"]), "majors": float(m["start_bank"]), "stocks": float(s["start_bank"])},
                {"memecoins": str(coins_folder), "majors": str(majors_folder), "stocks": str(journal)}, demo,
                now or datetime.now(timezone.utc), ZoneInfo(cfg["report"]["timezone"]),
                float(s["ticket_usd"]), stock_rules(HERE.parent / "premarket-scanner" / "criteria.toml"))


def stock_rules(path: Path) -> Tuple[float, float, float]:
    """The scanner's own paper-trade rules, so the report describes what it really did."""
    if not path.exists():
        return (10.0, 5.0, 0.5)
    with open(path, "rb") as fh:
        p = tomllib.load(fh).get("paper", {})
    return (float(p.get("target_pct", 10.0)), float(p.get("stop_pct", 5.0)), float(p.get("cost_pct", 0.5)))


# -- outputs ----------------------------------------------------------------------------------------

def write_ledger(book: Book, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["desk", "symbol", "opened", "closed", "pnl_usd", "pnl_pct", "exit"])
        for t in book.all_trades:
            w.writerow([t.desk, t.symbol, t.opened.isoformat(), t.closed.isoformat(), f"{t.pnl:.2f}",
                        f"{t.pnl_pct:.2f}", t.exit])


def _usd(v: float, sign: bool = True) -> str:
    s = f"${abs(v):,.2f}"
    return (("+" if v > 0 else "−" if v < 0 else "") + s) if sign else s


def _pf(v) -> str:
    return "—" if v is None else "∞" if v == float("inf") else f"{v:.2f}"


def render_text(book: Book) -> str:
    total_start = sum(book.banks.values())
    all_s = stats(book.all_trades, total_start)
    lines = [f"PAPER BOOK{' (DEMO markets)' if book.demo else ''} · paper money only · "
             f"{book.now.astimezone(book.tz):%a %d %b %H:%M %Z}", ""]
    for d in DESKS:
        s = stats(book.trades[d], book.banks[d])
        lines.append(f"  {d:<9} {s['trades']:>4} trades  net {_usd(s['net']):>12}  ({s['return_pct']:+.1f}% of "
                     f"${book.banks[d]:,.0f})  won {s['win_rate']:.0f}%  profit factor {_pf(s['profit_factor'])}  "
                     f"worst drawdown {s['max_drawdown_pct']:.1f}%")
    lines.append(f"  {'total':<9} {all_s['trades']:>4} trades  net {_usd(all_s['net']):>12}  "
                 f"({all_s['return_pct']:+.1f}% of ${total_start:,.0f})")
    open_coins = book.held["memecoins"] + book.held["majors"]
    waiting = [h for h in book.held["stocks"]]
    if open_coins:
        lines.append(f"  open coins: {len(open_coins)}, unrealized {_usd(book.unrealized)} (before exit costs)")
    if waiting:
        lines.append(f"  stock picks waiting for their trade day: {', '.join(h.symbol for h in waiting[:8])}")
    days = daily(book.all_trades, book.tz)
    if days:
        today = book.now.astimezone(book.tz).date()
        week = sum(v for k, v in days.items() if (today - k).days < 7)
        lines.append(f"  today {_usd(days.get(today, 0.0))} · last 7 days {_usd(week)}")
    if not all_s["trades"]:
        lines.append("  No closed paper trades yet. Start the desks (see README) and they'll show up here.")
    elif all_s["trades"] < 50:
        lines.append(f"  Only {all_s['trades']} trades: far too few to judge anything yet.")
    return "\n".join(lines)


# -- the page --------------------------------------------------------------------------------------

CSS = """
/* Paper Book: an old green-bar printout, the kind ledgers came on. Rows band like fanfold paper. */
:root {
  --paper: #f8fbf7; --band: #e5f1e6; --ink: #1c2620; --muted: #4f5f55; --rule: #c4d5c8;
  --ribbon: #2a54b8; --gold: #8a5a00; --plum: #7a3a9a; --up: #12773a; --down: #b4261d; --hole: #dfe9e1;
  --display: "Archivo", "Arial Narrow", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #0e1411; --band: #15211a; --ink: #dde9e0; --muted: #a2b5a8; --rule: #2b3b31;
  --ribbon: #92b2ff; --gold: #f0c35a; --plum: #d4a6f2; --up: #4fd17f; --down: #ff7d70; --hole: #1a251f; color-scheme: dark; } }
:root[data-theme="dark"] {
  --paper: #0e1411; --band: #15211a; --ink: #dde9e0; --muted: #a2b5a8; --rule: #2b3b31;
  --ribbon: #92b2ff; --gold: #f0c35a; --plum: #d4a6f2; --up: #4fd17f; --down: #ff7d70; --hole: #1a251f; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.5 var(--display); }
.sheet { max-width: 1080px; margin: 0 auto; padding-inline: 44px; padding-block: 28px 40px; position: relative;
  background-image: radial-gradient(circle at 16px 50%, var(--hole) 0 5px, transparent 5.5px),
                    radial-gradient(circle at calc(100% - 16px) 50%, var(--hole) 0 5px, transparent 5.5px);
  background-size: 100% 26px; background-repeat: repeat-y; }
h1 { font: 800 clamp(30px, 6vw, 46px)/1 var(--display); letter-spacing: -.01em; margin: 0; text-wrap: balance; }
h2 { font: 700 13px/1.2 var(--display); letter-spacing: .14em; text-transform: uppercase; margin: 0 0 10px; color: var(--muted); }
.top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 20px; border-bottom: 2px solid var(--ink); padding-bottom: 12px; }
.stamp { font: 500 12.5px/1.4 var(--mono); color: var(--muted); }
.stamp b { color: var(--down); font-weight: 500; }
.tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; margin: 18px 0 26px;
  background: var(--rule); border: 1px solid var(--rule); }
.tile { padding: 12px 14px; min-width: 0; background: var(--paper); }
.tile span { display: block; font: 600 11.5px/1.3 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.tile b { display: block; font: 500 clamp(19px, 3.2vw, 27px)/1.2 var(--mono); font-variant-numeric: tabular-nums; margin-top: 4px; }
.tile small { font: 400 12px var(--mono); color: var(--muted); }
.up { color: var(--up); } .down { color: var(--down); }
section { margin-bottom: 28px; min-width: 0; }
.chart { border: 1px solid var(--rule); padding: 10px; }
.chart svg { display: block; width: 100%; height: auto; }
.chart text { fill: var(--muted); font: 11px var(--mono); }
.chart .grid { stroke: var(--rule); fill: none; }
.chart .grid.dash { stroke-dasharray: 3 4; }
.chart .l-total { stroke: var(--ink); stroke-width: 2.6; fill: none; }
.chart .l-memecoins { stroke: var(--ribbon); stroke-width: 1.6; fill: none; }
.chart .l-majors { stroke: var(--gold); stroke-width: 1.6; fill: none; }
.chart .l-stocks { stroke: var(--plum); stroke-width: 1.6; fill: none; }
.chart .b-up { fill: var(--up); } .chart .b-down { fill: var(--down); }
.key .k-total { color: var(--ink); } .key .k-memecoins { color: var(--ribbon); } .key .k-majors { color: var(--gold); }
.key .k-stocks { color: var(--plum); }
.key { display: flex; flex-wrap: wrap; gap: 4px 16px; font: 400 12.5px var(--mono); color: var(--muted); margin: 0 0 6px; }
.key i { display: inline-block; width: 18px; height: 0; border-top: 3px solid currentColor; vertical-align: middle; margin-right: 6px; }
.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
.scroll { overflow-x: auto; border: 1px solid var(--rule); }
table { width: 100%; border-collapse: collapse; font: 400 13.5px/1.35 var(--mono); font-variant-numeric: tabular-nums; }
th { text-align: left; font: 600 11.5px/1.2 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--rule); background: var(--paper); }
td { padding: 6px 10px; white-space: nowrap; }
tbody tr:nth-child(6n+1), tbody tr:nth-child(6n+2), tbody tr:nth-child(6n+3) { background: var(--band); }
td.n, th.n { text-align: right; }
.empty { padding: 18px; color: var(--muted); font-size: 14px; }
.notes { font-size: 13.5px; color: var(--muted); max-width: 68ch; }
.notes p { margin: 0 0 8px; }
@media (max-width: 760px) {
  .sheet { padding-inline: 16px; background-image: none; }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tile:first-child { grid-column: 1 / -1; }
  .two { grid-template-columns: minmax(0, 1fr); }
}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800'
         '&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">')


def _cls(v: float) -> str:
    return "up" if v > 0 else "down" if v < 0 else ""


def _equity_svg(book: Book) -> str:
    total = sum(book.banks.values())
    lines = {"total": equity_series(book.all_trades, total)}
    for d in DESKS:
        lines[d] = equity_series(book.trades[d], book.banks[d])
    pts = [p for s in lines.values() for p in s]
    if not pts:
        return '<p class="empty">The curve starts with the first closed paper trade.</p>'
    W, H, L, R, T, B = 720, 260, 64, 12, 14, 28
    t0 = min(p[0] for p in pts)
    t1 = max(max(p[0] for p in pts), t0 + timedelta(hours=1))
    # each desk is drawn as change from its own start, so all three share one dollar scale
    rel = {k: [(t, v - (total if k == "total" else book.banks[k])) for t, v in s] for k, s in lines.items()}
    vals = [v for s in rel.values() for _, v in s] + [0.0]
    lo, hi = min(vals), max(vals)
    pad = max((hi - lo) * 0.08, 1.0)
    lo, hi = lo - pad, hi + pad
    x = lambda t: L + (t - t0).total_seconds() / (t1 - t0).total_seconds() * (W - L - R)
    y = lambda v: T + (hi - v) / (hi - lo) * (H - T - B)
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Paper profit and loss over time">']
    for v in (hi - pad, 0.0, lo + pad):
        out.append(f'<line class="grid{"" if v == 0 else " dash"}" x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>')
        out.append(f'<text x="{L - 6}" y="{y(v) + 4:.1f}" text-anchor="end">{html.escape(_usd(v))}</text>')
    for k in DESKS + ("total",):
        s = rel[k]
        if not s:
            continue
        d = f"M{x(t0):.1f} {y(0):.1f} " + " ".join(f"H{x(t):.1f} V{y(v):.1f}" for t, v in s)   # steps: P&L moves at each close
        d += f" H{x(t1):.1f}"
        out.append(f'<path class="l-{k}" d="{d}" stroke-linejoin="round"/>')
    out.append(f'<text x="{L}" y="{H - 8}">{t0.astimezone(book.tz):%d %b}</text>')
    out.append(f'<text x="{W - R}" y="{H - 8}" text-anchor="end">{t1.astimezone(book.tz):%d %b}</text>')
    out.append("</svg>")
    return "".join(out)


def _daily_svg(book: Book) -> str:
    days = daily(book.all_trades, book.tz)
    if not days:
        return '<p class="empty">Daily results appear after the first closed trade.</p>'
    today = book.now.astimezone(book.tz).date()
    first = max(min(days), today - timedelta(days=29))
    span = [first + timedelta(days=i) for i in range((today - first).days + 1)]
    W, H, L, T, B = 720, 170, 64, 10, 24
    top = max(1.0, max(abs(days.get(d, 0.0)) for d in span))
    mid = T + (H - T - B) / 2
    bw = (W - L - 8) / max(1, len(span))
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Paper profit or loss per day">',
           f'<line class="grid" x1="{L}" x2="{W - 8}" y1="{mid:.1f}" y2="{mid:.1f}"/>',
           f'<text x="{L - 6}" y="{T + 8}" text-anchor="end">{html.escape(_usd(top))}</text>',
           f'<text x="{L - 6}" y="{H - B + 2}" text-anchor="end">{html.escape(_usd(-top))}</text>']
    for i, d in enumerate(span):
        v = days.get(d, 0.0)
        h = abs(v) / top * (H - T - B) / 2
        yy = mid - h if v >= 0 else mid
        out.append(f'<rect class="{"b-up" if v >= 0 else "b-down"}" x="{L + i * bw + 1:.1f}" y="{yy:.1f}" '
                   f'width="{max(1.0, bw - 2):.1f}" height="{max(0.5, h):.1f}"><title>{d:%a %d %b}: {html.escape(_usd(v))}</title></rect>')
    out.append(f'<text x="{L}" y="{H - 6}">{first:%d %b}</text>')
    out.append(f'<text x="{W - 8}" y="{H - 6}" text-anchor="end">today</text>')
    out.append("</svg>")
    return "".join(out)


def render_html(book: Book) -> str:
    e = html.escape
    total = sum(book.banks.values())
    all_s = stats(book.all_trades, total)
    per = {d: stats(book.trades[d], book.banks[d]) for d in DESKS}
    stamp = f"updated {book.now.astimezone(book.tz):%a %d %b %Y, %H:%M %Z}"
    demo = '<b>DEMO MARKETS · invented prices</b> · ' if book.demo else ""

    tiles = (
        f'<div class="tile"><span>Net, all paper trades</span><b class="{_cls(all_s["net"])}">{e(_usd(all_s["net"]))}</b>'
        f'<small>{all_s["return_pct"]:+.1f}% of ${total:,.0f}</small></div>'
        + "".join(f'<div class="tile"><span>{LABEL[d]}</span><b class="{_cls(per[d]["net"])}">{e(_usd(per[d]["net"]))}</b>'
                  f'<small>{per[d]["trades"]} trades · won {per[d]["win_rate"]:.0f}%</small></div>' for d in DESKS)
        + f'<div class="tile"><span>Open right now</span><b class="{_cls(book.unrealized)}">{e(_usd(book.unrealized))}</b>'
          f'<small>{len(book.held["memecoins"]) + len(book.held["majors"])} coins held · '
          f'{len(book.held["stocks"])} stock picks waiting</small></div>')

    rows = "".join(
        f"<tr><th scope=\"row\">{LABEL[d]}</th><td class=n>{per[d]['trades']}</td><td class=n>{per[d]['win_rate']:.0f}%</td>"
        f"<td class=n>{e(_usd(per[d]['avg_win']))}</td><td class=n>{e(_usd(per[d]['avg_loss']))}</td>"
        f"<td class=n>{_pf(per[d]['profit_factor'])}</td><td class=n>{per[d]['max_drawdown_pct']:.1f}%</td>"
        f"<td class=\"n {_cls(per[d]['net'])}\">{e(_usd(per[d]['net']))}</td></tr>" for d in DESKS)
    desk_table = (f'<div class="scroll"><table><thead><tr><th>Desk</th><th class=n>Trades</th><th class=n>Won</th>'
                  f'<th class=n>Avg win</th><th class=n>Avg loss</th><th class=n>Profit factor</th>'
                  f'<th class=n>Worst drop</th><th class=n>Net</th></tr></thead><tbody>{rows}</tbody></table></div>')

    held = book.held["memecoins"] + book.held["majors"] + book.held["stocks"]
    if held:
        hrows = "".join(
            f"<tr><td>{LABEL[h.desk]}</td><td>{e(h.symbol)}</td><td>{h.opened.astimezone(book.tz):%d %b %H:%M}</td>"
            f"<td class=n>{e(_usd(h.cost, False))}</td>"
            f"<td class=\"n {_cls((h.value or h.cost) - h.cost)}\">{'—' if h.value is None else e(_usd(h.value - h.cost))}</td>"
            f"<td>{e(h.note)}</td></tr>" for h in held)
        held_html = (f'<div class="scroll"><table><thead><tr><th>Desk</th><th>Symbol</th><th>Since</th><th class=n>Paper cost</th>'
                     f'<th class=n>Open P&amp;L</th><th>Note</th></tr></thead><tbody>{hrows}</tbody></table></div>')
    else:
        held_html = '<p class="empty">Nothing open.</p>'

    recent = book.all_trades[-40:][::-1]
    if recent:
        trows = "".join(
            f"<tr><td>{t.closed.astimezone(book.tz):%d %b %H:%M}</td><td>{LABEL[t.desk]}</td><td>{e(t.symbol[:14])}</td>"
            f"<td>{e(t.exit)}</td><td class=\"n {_cls(t.pnl_pct)}\">{t.pnl_pct:+.1f}%</td>"
            f"<td class=\"n {_cls(t.pnl)}\">{e(_usd(t.pnl))}</td></tr>" for t in recent)
        trades_html = (f'<div class="scroll"><table><thead><tr><th>Closed</th><th>Desk</th><th>Symbol</th><th>Exit</th>'
                       f'<th class=n>Move</th><th class=n>P&amp;L</th></tr></thead><tbody>{trows}</tbody></table></div>')
    else:
        trades_html = '<p class="empty">No closed paper trades yet. Start the desks and they appear here.</p>'

    few = ("" if all_s["trades"] >= 50 else
           f"<p><b>{all_s['trades']} trades is far too few to judge.</b> Let both desks run for weeks before reading "
           "anything into these numbers.</p>")
    return f"""<title>Paper Book</title>
{FONTS}
<style>{CSS}</style>
<main class="sheet">
  <header class="top">
    <h1>Paper Book</h1>
    <p class="stamp">{demo}paper money only · {e(stamp)}</p>
  </header>
  <div class="tiles">{tiles}</div>
  <section aria-labelledby="h-eq">
    <h2 id="h-eq">Profit and loss since the start</h2>
    <p class="key"><span class="k-total"><i></i>all desks</span><span class="k-memecoins"><i></i>memecoins</span>
      <span class="k-majors"><i></i>big coins</span><span class="k-stocks"><i></i>stocks</span></p>
    <div class="chart">{_equity_svg(book)}</div>
  </section>
  <section aria-labelledby="h-day">
    <h2 id="h-day">Each day, last 30 days</h2>
    <div class="chart">{_daily_svg(book)}</div>
  </section>
  <section aria-labelledby="h-desk"><h2 id="h-desk">By desk</h2>{desk_table}</section>
  <section aria-labelledby="h-open"><h2 id="h-open">Open and waiting</h2>{held_html}</section>
  <section aria-labelledby="h-tr"><h2 id="h-tr">Latest closed trades</h2>{trades_html}</section>
  <section class="notes" aria-labelledby="h-n">
    <h2 id="h-n">How these numbers are made</h2>
    {few}
    <p><b>Big coins</b> (Majors Desk): ${book.banks['majors']:,.0f} of paper money, trading BTC, ETH, XRP, ADA and others on
      Coinbase's hourly prices. Each buy and sell pays the exchange fee and a little slippage.</p>
    <p><b>Memecoins</b> (Night Desk): ${book.banks['memecoins']:,.0f} of paper money. Buys and sells are priced from the pool's
      live price with fees and price impact included, so they're close to what a real swap would get, but no order
      ever reaches the market.</p>
    <p><b>Stocks</b> (premarket scanner): ${book.ticket:,.0f} of paper money per pick, out of ${book.banks['stocks']:,.0f}.
      Each pick is bought at the 9:30 ET open and sold at +{book.stock_rules[0]:g}%, −{book.stock_rules[1]:g}% or the
      close, whichever comes first, minus {book.stock_rules[2]:g}% for spread and slippage. When one five-minute bar
      touches both, it counts as the stop.</p>
    <p>Paper results flatter real trading: real fills, gaps and nerves are worse. Nothing here is a forecast or advice.</p>
  </section>
</main>
"""


def page(fragment: str) -> str:
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + fragment.replace("<main", "</head>\n<body>\n<main", 1) + "</body>\n</html>\n")


# -- command line ---------------------------------------------------------------------------------------

def build(cfg: dict, demo: bool, out: Path, now: Optional[datetime] = None) -> Book:
    book = load(cfg, demo, now)
    out.mkdir(parents=True, exist_ok=True)
    write_ledger(book, out / "ledger.csv")
    frag = render_html(book)
    (out / "paper-book.fragment.html").write_text(frag, encoding="utf-8")
    (out / "paper-book.html").write_text(page(frag), encoding="utf-8")
    import galaxy                                  # the same numbers, drawn as a universe

    galaxy.write(book, out)
    return book


SERVED = {"/": "galaxy.html", "/galaxy.html": "galaxy.html", "/galaxy.json": "galaxy.json",
          "/book": "paper-book.html", "/paper-book.html": "paper-book.html", "/ledger.csv": "ledger.csv"}
TYPES = {".html": "text/html; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8"}


def serve(out: Path, host: str = "127.0.0.1", port: int = 8790):
    """Read-only: the galaxy, the paper book and the ledger, nothing else. Answers only to its own address."""
    import threading
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            name = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
            path = SERVED.get(self.path.split("?", 1)[0])
            file = out / path if path else None
            if name not in ("127.0.0.1", "localhost", "::1", host):
                code, body, ctype = 403, b"wrong host", "text/plain"
            elif not file or not file.is_file():
                code, body, ctype = 404, b"not found (nothing written yet?)", "text/plain"
            else:
                code, body, ctype = 200, file.read_bytes(), TYPES[file.suffix]
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    server = ThreadingHTTPServer((host, port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python paperbook.py", description="Every paper trade from both desks, in one ledger.")
    ap.add_argument("--demo", action="store_true", help="read the desks' demo results instead of live ones")
    ap.add_argument("--watch", type=float, metavar="MINUTES", help="keep updating every few minutes")
    ap.add_argument("--print", action="store_true", dest="print_only", help="just print the totals; write nothing")
    ap.add_argument("--serve", type=int, metavar="PORT", help="also show the galaxy and the book at http://HOST:PORT")
    ap.add_argument("--host", default="127.0.0.1", help="with --serve: the address to answer on (default this machine only)")
    ap.add_argument("--config", default=str(HERE / "book.toml"))
    args = ap.parse_args(argv)
    with open(args.config, "rb") as fh:
        cfg = tomllib.load(fh)
    if args.print_only:
        print(render_text(load(cfg, args.demo)))
        return 0
    out = HERE / "output" / ("demo" if args.demo else "")
    server = None
    while True:
        book = build(cfg, args.demo, out)
        print(render_text(book))
        print(f"\nLedger: {out / 'ledger.csv'}\nReport: {out / 'paper-book.html'}\nGalaxy: {out / 'galaxy.html'}")
        if args.serve and server is None:
            server = serve(out, args.host, args.serve)
            print(f"Showing the galaxy at http://{args.host}:{args.serve}/  (the book: /book)")
            if not args.watch:
                args.watch = 15                     # serving means staying up, so keep the numbers fresh
        if not args.watch:
            return 0
        try:
            _time.sleep(args.watch * 60)
        except KeyboardInterrupt:
            return 0
        print()


if __name__ == "__main__":
    sys.exit(main())
