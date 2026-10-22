"""Paper Book: every paper trade from every desk in one ledger, with one running total.

  memecoins       Night Desk (../night-desk): brand-new Solana coins, live prices, paper money
  majors          Majors Desk (../majors-desk): BTC, ETH, XRP, ADA..., hourly trend following, paper money
  stocks          Premarket scanner (../premarket-scanner): gap-up picks, graded after the close
  memecoins_wild  Night Desk's wild rulebook (desk-wild.toml): the same coins, more risk, its own bank
  stocks_wild     the scanner's wild rules (criteria-wild.toml): more picks, wider exits, its own bank
  stocks_fade     the scanner's fade rules (criteria-fade.toml): the stock desk's picks, sold short
  memecoins_strict  Night Desk's strict rulebook (desk-strict.toml): older coins, smaller bets, quicker exits
  majors_4h       Majors Desk's 4-hour rulebook (majors-4h.toml): the same trend following, four times slower
  stocks_quick    the scanner's quick rules (criteria-quick.toml): the stock desk's picks, +5% / -3%
  stocks_early    the scanner's early rules (criteria-early.toml): the stock desk's picks, sold by 10:30 ET

A desk is in the book when book.toml has a section for it.

  python paperbook.py               update the ledger and the report once
  python paperbook.py --watch 15    ...every 15 minutes, while the desks run
  python paperbook.py --demo        the same, from the desks' demo markets
  python paperbook.py --standings   every desk ranked, with its last seven days; nothing written
  python paperbook.py --proving     each running rulebook's history-test grade (proving.py); nothing written

Writes output/ledger.csv (one row per closed paper trade), output/standings.txt (every desk ranked, with its
last seven days; also served at /standings) and output/paper-book.html, plus the Trading Deck (output/deck.html, the home page), the Trade Crawler (output/crawler.html) and the
Paper Galaxy (output/galaxy.html).
Paper money only. Nothing here can place a real order.

A desk is in the book when book.toml has a section for it: any section with a `folder` (a coin desk's results)
or a `journal` (a stock desk's). The ten desks above are known by name; any other section needs `label`,
`kind` ("coins" or "stocks") and `market` ("memecoins", "big coins" or "stocks"), and may set `of` (the desk it
is a variation of), `color` and `abbr`.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import sys
import time as _time
from collections import defaultdict
from dataclasses import dataclass, field
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
# The desks the book knows by name, in order: each market, then its variants. Any other desk is described by its
# own section in book.toml (see the top of this file).
DESKS = ("memecoins", "memecoins_wild", "memecoins_strict", "majors", "majors_4h",
         "stocks", "stocks_wild", "stocks_fade", "stocks_quick", "stocks_early")
LABEL = {"memecoins": "Memecoins", "memecoins_wild": "Wild memecoins", "memecoins_strict": "Strict memecoins",
         "majors": "Big coins", "majors_4h": "Big coins 4h",
         "stocks": "Stocks", "stocks_wild": "Wild stocks", "stocks_fade": "Fade stocks", "stocks_quick": "Quick stocks",
         "stocks_early": "Early-out stocks"}
KIND = {d: ("stocks" if d.startswith("stocks") else "coins") for d in DESKS}
MARKET = {d: ("stocks" if d.startswith("stocks") else "big coins" if d.startswith("majors") else "memecoins") for d in DESKS}
VARIANT_OF = {d: d.split("_")[0] for d in DESKS if "_" in d}         # copies of another desk, and which
STOCK_RULES = {"stocks": "../premarket-scanner/criteria.toml", "stocks_wild": "../premarket-scanner/criteria-wild.toml",
               "stocks_fade": "../premarket-scanner/criteria-fade.toml",
               "stocks_quick": "../premarket-scanner/criteria-quick.toml",
               "stocks_early": "../premarket-scanner/criteria-early.toml"}
COLORS = {"memecoins": "#3cc3f2", "memecoins_wild": "#ff9a4d", "memecoins_strict": "#6b7cff",
          "majors": "#f2bd4f", "majors_4h": "#ffe28a",
          "stocks": "#a08cff", "stocks_wild": "#d7f25f", "stocks_fade": "#3fd3c0", "stocks_quick": "#ff8c8c",
          "stocks_early": "#c48a5a"}
ABBR = {"memecoins": "MEM", "memecoins_wild": "WMEM", "memecoins_strict": "SMEM", "majors": "BIG", "majors_4h": "BIG4",
        "stocks": "STK", "stocks_wild": "WSTK", "stocks_fade": "FADE", "stocks_quick": "QSTK", "stocks_early": "ESTK"}
NOT_DESKS = ("report", "alerts")
MARKETS = ("memecoins", "big coins", "stocks")                        # the order the book lists them in


def _abbr(key: str) -> str:
    """A short tag for a desk the tables don't know: M, B or S for its market, then its rulebook (memecoins_sniper: MSNI)."""
    base, _, book = key.partition("_")
    if not book:
        return key[:4]
    return {"memecoins": "M", "majors": "B", "stocks": "S"}.get(base, base[0]) + book[:3]


def desk_meta(key: str, section: dict) -> dict:
    """What the book shows for a desk: the known ten from the tables above, anything else from its section."""
    kind = section.get("kind") or KIND.get(key) or ("stocks" if "journal" in section else "coins")
    if kind not in ("coins", "stocks"):
        raise ValueError(f"[{key}] kind must be coins or stocks, not {kind!r}")
    market = section.get("market") or MARKET.get(key) or ("stocks" if kind == "stocks" else "memecoins")
    if market not in ("memecoins", "big coins", "stocks"):
        raise ValueError(f"[{key}] market must be memecoins, big coins or stocks, not {market!r}")
    label = section.get("label") or LABEL.get(key)
    if not label:
        raise ValueError(f"[{key}] needs a label in book.toml")
    base = key.partition("_")[0]
    of = section.get("of", VARIANT_OF.get(key) or (base if "_" in key and base in DESKS else None))
    color = section.get("color") or COLORS.get(key) or "#9fb3c8"
    abbr = (section.get("abbr") or ABBR.get(key) or _abbr(key)).upper()
    prefix = section.get("prefix", "" if market == "big coins" else "$")
    return {"label": label, "kind": kind, "market": market, "of": of, "color": color, "abbr": abbr, "prefix": prefix}


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


SKIPPED: Dict[str, int] = {}          # file -> rows that couldn't be read (a line still being written, usually)


def _rows(path: Path, make) -> list:
    """Every row of a CSV that parses. A desk appends to its file while the book reads it, so the last line can be
    half there: that row is skipped (and counted in SKIPPED) rather than failing the whole book."""
    out, bad = [], 0
    for r in _read_csv(path):
        try:
            out.append(make(r))
        except (KeyError, ValueError, TypeError, AttributeError):
            bad += 1
    if bad:
        SKIPPED[str(path)] = bad
    else:
        SKIPPED.pop(str(path), None)
    return out


def load_coins(folder: Path, desk: str = "memecoins", prefix: str = "$") -> Tuple[List[Trade], List[Holding]]:
    """Night Desk and Majors Desk write the same files: trades.csv and state.json."""
    trades = _rows(folder / "trades.csv", lambda r: Trade(desk, prefix + r["symbol"], _dt(r["opened"]), _dt(r["closed"]),
                                                           float(r["pnl"]), float(r["pnl_pct"]), r["exit"].split(":")[0]))
    held: List[Holding] = []
    state = folder / "state.json"
    if state.exists():
        for p in json.loads(state.read_text()).get("positions", []):
            held.append(Holding(desk, prefix + p["symbol"], _dt(p["opened_at"]), float(p["cost"]),
                                float(p["qty"]) * float(p["last_price"]), "marked at the last price, before exit costs"))
    return trades, held


def load_stocks(journal: Path, ticket: float, share: Optional[float] = None,
                desk: str = "stocks") -> Tuple[List[Trade], List[Holding]]:
    """Each pick gets `ticket` paper dollars, or with `share` set, each day's picks split that much equally."""
    trades: List[Trade] = []
    held: List[Holding] = []
    rows = _rows(journal, lambda r: (date.fromisoformat(r["trade_date"]), r["symbol"] or "", r))   # a torn last line is skipped
    per_day: Dict[str, int] = defaultdict(int)
    for day, _, _ in rows:
        per_day[day] += 1
    for day, symbol, r in rows:
        if share is not None:
            ticket = share / per_day[day]       # split in the morning across every pick, triggered or not
        if r.get("graded_at") and (r.get("sim_pnl_pct") or "") == "":
            continue                            # its entry rule never triggered: no trade, the money sat in cash
        opened = datetime.combine(day, time(9, 30), tzinfo=ET)
        if (r.get("sim_pnl_pct") or "") != "":
            pct = float(r["sim_pnl_pct"])
            trades.append(Trade(desk, symbol, opened, datetime.combine(day, time(16, 0), tzinfo=ET),
                                round(ticket * pct / 100, 2), pct, r.get("sim_exit", "") or "close"))
        else:
            held.append(Holding(desk, symbol, opened, round(ticket, 2), None,
                                f"picked {r.get('scan_date') or '?'}; buys at the {day:%a %d %b} open, graded after the close"))
    return trades, held


def newest_demo_journal(output: Path) -> Path:
    """The newest demo backtest in a scanner results folder (output/, or output/wild/ for the wild rules)."""
    found = sorted((output / "demo" / "backtests").glob("*/journal.csv"), key=lambda p: p.stat().st_mtime)
    return found[-1] if found else output / "demo" / "journal.csv"


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
    share_bank: bool = False                                        # each day's stock picks split the stock bank
    benchmark: Optional[dict] = None                                # BTC bought at the start and held (benchmark.py)
    weather: Optional[dict] = None                                  # where the big trends stand now (weather.py)
    # target %, stop %, cost % from each stock desk's own rules, and the time it's out by ("" = the close)
    stock_rules: Dict[str, Tuple[float, float, float]] = field(default_factory=lambda: {"stocks": (10.0, 5.0, 0.5)})
    stock_exit: Dict[str, str] = field(default_factory=dict)
    stock_entry: Dict[str, dict] = field(default_factory=dict)      # side, entry, entry_at, range_minutes per stock desk
    results: Dict[str, Path] = field(default_factory=dict)         # each desk's results folder (its backtests live there)
    meta: Dict[str, dict] = field(default_factory=dict)             # per desk: label, kind, market, of, color, abbr
    order: Tuple[str, ...] = ()                                     # the desks in book.toml order
    checkpoints: Optional[dict] = None                              # [report] checkpoints: label -> date the book is read

    @property
    def desks(self) -> Tuple[str, ...]:
        """The desks in this book: market by market (memecoins, big coins, stocks), the known ten first in each,
        then the rest in book.toml order."""
        listed = list(self.order) + [d for d in self.trades if d not in self.order]

        def rank(d: str) -> Tuple[int, int, int]:
            m = self.market(d)
            return (MARKETS.index(m) if m in MARKETS else len(MARKETS),
                    DESKS.index(d) if d in DESKS else len(DESKS), listed.index(d))
        return tuple(sorted(self.trades, key=rank))

    def _meta(self, d: str) -> dict:
        if d not in self.meta:
            self.meta[d] = desk_meta(d, {})
        return self.meta[d]

    def label(self, d: str) -> str:
        return self._meta(d)["label"]

    def kind(self, d: str) -> str:
        return self._meta(d)["kind"]

    def market(self, d: str) -> str:
        return self._meta(d)["market"]

    def variant_of(self, d: str) -> Optional[str]:
        return self._meta(d)["of"]

    def color(self, d: str) -> str:
        return self._meta(d)["color"]

    def abbr(self, d: str) -> str:
        return self._meta(d)["abbr"]

    @property
    def bank_total(self) -> float:
        return sum(self.banks[d] for d in self.desks)

    @property
    def all_trades(self) -> List[Trade]:
        return sorted((t for d in self.desks for t in self.trades[d]), key=lambda t: t.closed)

    @property
    def unrealized(self) -> float:
        return sum(h.value - h.cost for d in self.desks for h in self.held[d] if h.value is not None)

    def of_kind(self, kind: str) -> List[str]:
        return [d for d in self.desks if self.kind(d) == kind]


def load(cfg: dict, demo: bool, now: Optional[datetime] = None) -> Book:
    trades: Dict[str, List[Trade]] = {}
    held: Dict[str, List[Holding]] = {}
    banks: Dict[str, float] = {}
    sources: Dict[str, str] = {}
    rules: Dict[str, Tuple[float, float, float]] = {}
    exits: Dict[str, str] = {}
    entries: Dict[str, dict] = {}
    results: Dict[str, Path] = {}
    meta: Dict[str, dict] = {}
    order = [d for d in cfg if d not in NOT_DESKS and isinstance(cfg[d], dict)]
    for d in order:
        meta[d] = desk_meta(d, cfg[d])
    first_stocks = next((cfg[d] for d in order if meta[d]["kind"] == "stocks"), {})
    for d in order:
        c = cfg[d]
        banks[d] = float(c["start_bank"])
        if meta[d]["kind"] == "coins":
            results[d] = (HERE / c["folder"]).resolve().parent
            folder = (HERE / (c["demo_folder"] if demo else c["folder"])).resolve()
            trades[d], held[d] = load_coins(folder, d, meta[d]["prefix"])
            sources[d] = str(folder)
            continue
        live = (HERE / c["journal"]).resolve()
        results[d] = live.parent
        journal = ((HERE / c["demo_journal"]) if c.get("demo_journal") else newest_demo_journal(live.parent)) if demo else live
        journal = journal.resolve()
        share = bool(c.get("share_bank", False))
        trades[d], held[d] = load_stocks(journal, float(c["ticket_usd"]), banks[d] if share else None, desk=d)
        sources[d] = str(journal)
        rules_path = HERE / c.get("rules", STOCK_RULES.get(d, "../premarket-scanner/criteria.toml"))
        if not rules_path.exists() and (rules_path.parent / "retired" / rules_path.name).exists():
            rules_path = rules_path.parent / "retired" / rules_path.name     # a retired rulebook, read for the record
        rules[d] = stock_rules(rules_path)
        exits[d] = stock_exit_by(rules_path)
        entries[d] = stock_entry(rules_path)
    return Book(trades, held, banks, sources, demo, now or datetime.now(timezone.utc),
                ZoneInfo(cfg["report"]["timezone"]), float(first_stocks.get("ticket_usd", 100.0)),
                bool(first_stocks.get("share_bank", False)), stock_rules=rules, stock_exit=exits, stock_entry=entries, results=results,
                meta=meta, order=tuple(order), checkpoints=cfg["report"].get("checkpoints"))


def stock_rules(path: Path) -> Tuple[float, float, float]:
    """The scanner's own paper-trade rules, so the report describes what it really did."""
    if not path.exists():
        return (10.0, 5.0, 0.5)
    with open(path, "rb") as fh:
        p = tomllib.load(fh).get("paper", {})
    return (float(p.get("target_pct", 10.0)), float(p.get("stop_pct", 5.0)), float(p.get("cost_pct", 0.5)))


def stock_exit_by(path: Path) -> str:
    """The New York time a stock desk is out by, or "" for the 4pm close."""
    if not path.exists():
        return ""
    with open(path, "rb") as fh:
        return str(tomllib.load(fh).get("paper", {}).get("exit_by", "") or "")


ENTRY_DEFAULTS = {"side": "long", "entry": "open", "entry_at": "10:00", "range_minutes": 15}


def stock_entry(path: Path) -> dict:
    """How a stock desk gets in: long or short, at the open, at a confirm time, or on an opening-range break."""
    if not path.exists():
        return dict(ENTRY_DEFAULTS)
    with open(path, "rb") as fh:
        p = tomllib.load(fh).get("paper", {})
    return {k: type(v)(p.get(k, v)) for k, v in ENTRY_DEFAULTS.items()}


def entry_words(e: dict) -> str:
    """'sold short at the 9:30 open', 'bought at 10:00 ET if still above the open'... for the notes."""
    short = e.get("side") == "short"
    verb = "sold short" if short else "bought"
    if e.get("entry") == "confirm":
        return f"{verb} at {e['entry_at']} ET, only if it's still {'below' if short else 'above'} its 9:30 open"
    if e.get("entry") == "orb":
        return (f"{verb} when it breaks {'below the low' if short else 'above the high'} of its first "
                f"{e['range_minutes']} minutes, by {e['entry_at']} ET, with the far side of that range as its stop")
    return f"{verb} at the 9:30 ET open"


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
    total_start = book.bank_total
    all_s = stats(book.all_trades, total_start)
    lines = [f"PAPER BOOK{' (DEMO markets)' if book.demo else ''} · paper money only · "
             f"{book.now.astimezone(book.tz):%a %d %b %H:%M %Z}", ""]
    for d in book.desks:
        s = stats(book.trades[d], book.banks[d])
        lines.append(f"  {book.label(d).lower():<19} {s['trades']:>4} trades  net {_usd(s['net']):>12}  ({s['return_pct']:+.1f}% of "
                     f"${book.banks[d]:,.0f})  won {s['win_rate']:.0f}%  profit factor {_pf(s['profit_factor'])}  "
                     f"worst drawdown {s['max_drawdown_pct']:.1f}%")
    lines.append(f"  {'total':<19} {all_s['trades']:>4} trades  net {_usd(all_s['net']):>12}  "
                 f"({all_s['return_pct']:+.1f}% of ${total_start:,.0f})")
    open_coins = [h for d in book.of_kind("coins") for h in book.held[d]]
    waiting = [h for d in book.of_kind("stocks") for h in book.held[d]]
    if open_coins:
        lines.append(f"  open coins: {len(open_coins)}, unrealized {_usd(book.unrealized)} (before exit costs)")
    if waiting:
        lines.append(f"  stock picks waiting for their trade day: {', '.join(h.symbol for h in waiting[:8])}")
    days = daily(book.all_trades, book.tz)
    if days:
        today = book.now.astimezone(book.tz).date()
        week = sum(v for k, v in days.items() if (today - k).days < 7)
        lines.append(f"  today {_usd(days.get(today, 0.0))} · last 7 days {_usd(week)}")
    import benchmark

    if book.benchmark:
        lines.append("  " + benchmark.line(book))
    if not all_s["trades"]:
        lines.append("  No closed paper trades yet. Each one shows up here as soon as a desk closes it.")
    elif all_s["trades"] < 50:
        lines.append(f"  Only {all_s['trades']} trades: far too few to judge anything yet.")
    return "\n".join(lines)


def render_standings(book: Book) -> str:
    """Every desk ranked by paper return, with its last seven days and whether that's a green week. The same
    numbers as the deck's standings table, for a terminal (server/status.sh)."""
    import benchmark
    import deck

    today = book.now.astimezone(book.tz).date()
    checks = " · ".join(f"{label} {deck._as_date(day):%a %d %b}" for label, day in (book.checkpoints or {}).items()
                        if deck._as_date(day))
    lines = [f"STANDINGS{' (DEMO markets)' if book.demo else ''} · paper money only · "
             f"{book.now.astimezone(book.tz):%a %d %b %H:%M %Z}" + (f" · {checks}" if checks else ""),
             f"  {'#':>2}  {'desk':<21} {'market':<9} {'day':>5}  {'since day one':>24}  {'last 7 days':>20}  "
             f"{'trades':>6}  so far"]
    rows = []
    for d in book.desks:
        s = stats(book.trades[d], book.banks[d])
        start = deck.started(book, d)
        day = min(deck.MONTH_DAYS, (book.now - start).days + 1) if start else 0
        rows.append((s["return_pct"], d, s, day, deck.week(book, d, today)))
    rows.sort(key=lambda r: (-r[0], book.desks.index(r[1])))
    for k, (ret, d, s, day, w) in enumerate(rows, 1):
        since = f"{_usd(s['net']):>11} {ret:+8.1f}%" if day else f"{'—':>20}"
        week = f"{_usd(w['net']):>10} {w['green']}g {w['red']}r" if w["traded"] else f"{'—':>16}"
        so_far = deck.verdict(s["trades"], s) + (" · GREEN WEEK" + (f" ×{w['streak']}" if w["streak"] > 1 else "") if w["green_week"] else "")
        lines.append(f"  {k:>2}  {book.label(d).lower():<21} {book.market(d):<9} {f'{day}/{deck.MONTH_DAYS}' if day else '—':>5}  "
                     f"{since:>24}  {week:>20}  {s['trades']:>6}  {so_far}")
    all_s = stats(book.all_trades, book.bank_total)
    lines.append(f"  {'':>2}  {'all desks':<21} {'':<9} {'':>5}  {_usd(all_s['net']):>11} {all_s['return_pct']:+8.1f}%  "
                 f"{'':>20}  {all_s['trades']:>6}")
    green = [book.label(d) + (f" ×{w['streak']}" if w["streak"] > 1 else "") for _, d, _, _, w in rows if w["green_week"]]
    lines.append("  green week: " + (", ".join(green) if green else "none yet") +
                 "  (traded 3+ of the last 7 days, net up, no day's loss bigger than the week's gain)")
    if book.benchmark:
        lines.append("  " + benchmark.line(book))
    import weather

    if weather.line(book.weather):
        lines.append("  " + weather.line(book.weather))
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
.tiles { display: grid; grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr)); gap: 1px; margin: 18px 0 26px;
  background: var(--rule); border: 1px solid var(--rule); }
.tiles.wide-first .tile:first-child, .tiles.many .tile:first-child, .tiles.fill-last .tile:last-child { grid-column: span 2; }
.tiles.many .tile { padding: 10px 11px; }
.tiles.many .tile b { font-size: clamp(17px, 1.9vw, 23px); }
.tiles.many .tile span { font-size: 10.5px; }
.tiles.crowd .tile { padding: 8px 9px; }
.tiles.crowd .tile b { font-size: clamp(15px, 1.4vw, 19px); }
.tiles.crowd .tile span { font-size: 9.5px; }
.tiles.crowd .tile small { font-size: 9.5px; }
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
.chart .l-memecoins_wild { stroke: var(--ribbon); stroke-width: 1.6; stroke-dasharray: 6 4; fill: none; }
.chart .l-stocks_wild { stroke: var(--plum); stroke-width: 1.6; stroke-dasharray: 6 4; fill: none; }
.chart .l-stocks_fade { stroke: var(--plum); stroke-width: 2; stroke-dasharray: 1.5 3.5; stroke-linecap: round; fill: none; }
.chart .l-memecoins_strict { stroke: var(--ribbon); stroke-width: 2; stroke-dasharray: 1.5 3.5; stroke-linecap: round; fill: none; }
.chart .l-majors_4h { stroke: var(--gold); stroke-width: 1.6; stroke-dasharray: 6 4; fill: none; }
.chart .l-stocks_quick { stroke: var(--plum); stroke-width: 1.6; stroke-dasharray: 10 3 2 3; fill: none; }
.chart .l-stocks_early { stroke: var(--plum); stroke-width: 2.6; stroke-dasharray: 14 6; fill: none; }
.chart .b-up { fill: var(--up); } .chart .b-down { fill: var(--down); }
.key .k-total { color: var(--ink); } .key .k-memecoins { color: var(--ribbon); } .key .k-majors { color: var(--gold); }
.key .k-stocks { color: var(--plum); }
.key .k-memecoins_wild { color: var(--ribbon); } .key .k-stocks_wild { color: var(--plum); }
.key .k-memecoins_wild i, .key .k-stocks_wild i { border-top-style: dashed; }
.key .k-stocks_fade { color: var(--plum); } .key .k-stocks_fade i { border-top-style: dotted; }
.key .k-memecoins_strict { color: var(--ribbon); } .key .k-memecoins_strict i { border-top-style: dotted; }
.key .k-majors_4h { color: var(--gold); } .key .k-majors_4h i { border-top-style: dashed; }
.key .k-stocks_quick { color: var(--plum); } .key .k-stocks_quick i { border-top-style: double; }
.key .k-stocks_early { color: var(--plum); } .key .k-stocks_early i { border-top-width: 5px; }
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
  .tile:first-child, .tiles.wide-first .tile:first-child, .tiles.many .tile:first-child { grid-column: 1 / -1; }
  .tiles.lone-last .tile:last-child, .tiles.fill-last .tile:last-child { grid-column: 1 / -1; }
  .tiles.many .tile b { font-size: clamp(19px, 5.5vw, 24px); }
  .two { grid-template-columns: minmax(0, 1fr); }
}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800'
         '&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">')


def _cls(v: float) -> str:
    return "up" if v > 0 else "down" if v < 0 else ""


def _equity_svg(book: Book) -> str:
    total = book.bank_total
    lines = {"total": equity_series(book.all_trades, total)}
    for d in book.desks:
        lines[d] = equity_series(book.trades[d], book.banks[d])
    pts = [p for s in lines.values() for p in s]
    if not pts:
        return '<p class="empty">The curve starts with the first closed paper trade.</p>'
    W, H, R, T, B = 720, 260, 12, 14, 28
    t0 = min(p[0] for p in pts)
    t1 = max(max(p[0] for p in pts), t0 + timedelta(hours=1))
    # each desk is drawn as change from its own start, so all three share one dollar scale
    rel = {k: [(t, v - (total if k == "total" else book.banks[k])) for t, v in s] for k, s in lines.items()}
    vals = [v for s in rel.values() for _, v in s] + [0.0]
    lo, hi = min(vals), max(vals)
    pad = max((hi - lo) * 0.08, 1.0)
    lo, hi = lo - pad, hi + pad
    ticks = (hi - pad, 0.0, lo + pad)
    L = _label_room(_usd(v) for v in ticks)
    x = lambda t: L + (t - t0).total_seconds() / (t1 - t0).total_seconds() * (W - L - R)
    y = lambda v: T + (hi - v) / (hi - lo) * (H - T - B)
    out = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Paper profit and loss over time">']
    shown: List[float] = []
    for v in ticks:
        out.append(f'<line class="grid{"" if v == 0 else " dash"}" x1="{L}" x2="{W - R}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>')
        if all(abs(y(v) - u) >= 13 for u in shown):           # never print two amounts on top of each other
            shown.append(y(v))
            out.append(f'<text x="{L - 6}" y="{y(v) + 4:.1f}" text-anchor="end">{html.escape(_usd(v))}</text>')
    for k in book.desks + ("total",):
        s = rel[k]
        if not s:
            continue
        d = f"M{x(t0):.1f} {y(0):.1f} " + " ".join(f"H{x(t):.1f} V{y(v):.1f}" for t, v in s)   # steps: P&L moves at each close
        d += f" H{x(t1):.1f}"
        cls = f"l-{k}" + ("" if k == "total" or k in COLORS else " l-any")
        out.append(f'<path class="{cls}" d="{d}" stroke-linejoin="round"/>')
    out.append(f'<text x="{L}" y="{H - 8}">{t0.astimezone(book.tz):%d %b}</text>')
    out.append(f'<text x="{W - R}" y="{H - 8}" text-anchor="end">{t1.astimezone(book.tz):%d %b}</text>')
    out.append("</svg>")
    return "".join(out)


def _label_room(labels) -> int:
    """Left margin for a chart's amounts: wide enough for the longest one (11px mono is about 6.7px a character)."""
    return max(64, 12 + round(6.7 * max(len(s) for s in labels)))


def _daily_svg(book: Book) -> str:
    days = daily(book.all_trades, book.tz)
    if not days:
        return '<p class="empty">Daily results appear after the first closed trade.</p>'
    today = book.now.astimezone(book.tz).date()
    first = max(min(days), today - timedelta(days=29))
    span = [first + timedelta(days=i) for i in range((today - first).days + 1)]
    W, H, T, B = 720, 170, 10, 24
    top = max(1.0, max(abs(days.get(d, 0.0)) for d in span))
    L = _label_room([_usd(top), _usd(-top)])
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
    total = book.bank_total
    all_s = stats(book.all_trades, total)
    per = {d: stats(book.trades[d], book.banks[d]) for d in book.desks}
    stamp = f"updated {book.now.astimezone(book.tz):%a %d %b %Y, %H:%M %Z}"
    demo = '<b>DEMO MARKETS · invented prices</b> · ' if book.demo else ""

    bench = book.benchmark
    if bench:
        import benchmark

        since = datetime.fromisoformat(bench["since"]).astimezone(book.tz)
        bench_tile = (f'<div class="tile"><span>BTC bought and held</span><b class="{_cls(bench["pct"])}">'
                      f'{bench["pct"]:+.1f}%</b><small>since {since:%d %b %H:%M} · big coins desk '
                      f'{benchmark.big_coin_words(book)}</small></div>')
    else:
        bench_tile = ""
    coins_held = sum(len(book.held[d]) for d in book.of_kind("coins"))
    picks_waiting = sum(len(book.held[d]) for d in book.of_kind("stocks"))
    tile_list = (
        [f'<div class="tile"><span>Net, all paper trades</span><b class="{_cls(all_s["net"])}">{e(_usd(all_s["net"]))}</b>'
         f'<small>{all_s["return_pct"]:+.1f}% of ${total:,.0f}</small></div>']
        + [f'<div class="tile"><span>{e(book.label(d))}</span><b class="{_cls(per[d]["net"])}">{e(_usd(per[d]["net"]))}</b>'
           f'<small>{per[d]["trades"]} trades · won {per[d]["win_rate"]:.0f}%</small></div>' for d in book.desks]
        + [f'<div class="tile"><span>Open right now</span><b class="{_cls(book.unrealized)}">{e(_usd(book.unrealized))}</b>'
           f'<small>{coins_held} coins held · {picks_waiting} stock picks waiting</small></div>']
        + ([bench_tile] if bench_tile else []))
    n = len(tile_list)
    # One or two full rows on a wide screen. Up to seven tiles: the first takes two cells when the count is odd.
    # Eight or more: the first (the total, with the biggest number) always takes two, and so does the last when
    # that's what fills the second row.
    if n <= 5:
        cols, tile_cls = n, "tiles"
    elif n <= 7:
        cols = (n + 1) // 2
        tile_cls = "tiles" + (" wide-first" if n % 2 else "") + (" lone-last" if n % 2 == 0 else "")
    elif n <= 16:
        cells = n + 1 + (n + 1) % 2
        cols = cells // 2
        tile_cls = "tiles many" + (" fill-last" if (n + 1) % 2 else "")
    else:                                   # a crowd (thirty desks): plain rows of eight, the total still two cells wide
        cols, tile_cls = 8, "tiles many crowd"
    tiles = f'<div class="{tile_cls}" style="--cols:{cols}">' + "".join(tile_list) + "</div>"

    import deck

    today = book.now.astimezone(book.tz).date()
    weeks = {d: deck.week(book, d, today) for d in book.desks}
    ranked = sorted(book.desks, key=lambda d: (-per[d]["return_pct"], book.desks.index(d)))

    def week_cell(w: dict) -> str:
        if not w["traded"]:
            return "<td class=n>—</td><td>—</td>"
        badge = (f' <b class="gw">green week{" ×" + str(w["streak"]) if w["streak"] > 1 else ""}</b>' if w["green_week"] else "")
        return (f"<td class=\"n {_cls(w['net'])}\">{e(_usd(w['net']))}</td>"
                f"<td>{w['green']} green · {w['red']} red{badge}</td>")

    rows = "".join(
        f"<tr><td class=n>{k}</td><th scope=\"row\">{e(book.label(d))}</th><td class=n>{per[d]['trades']}</td>"
        f"<td class=n>{per[d]['win_rate']:.0f}%</td>"
        f"<td class=n>{e(_usd(per[d]['avg_win']))}</td><td class=n>{e(_usd(per[d]['avg_loss']))}</td>"
        f"<td class=n>{_pf(per[d]['profit_factor'])}</td><td class=n>{per[d]['max_drawdown_pct']:.1f}%</td>"
        f"<td class=\"n {_cls(per[d]['net'])}\">{e(_usd(per[d]['net']))}</td>{week_cell(weeks[d])}</tr>"
        for k, d in enumerate(ranked, 1))
    desk_table = (f'<div class="scroll"><table><thead><tr><th class=n>#</th><th>Desk</th><th class=n>Trades</th>'
                  f'<th class=n>Won</th><th class=n>Avg win</th><th class=n>Avg loss</th><th class=n>Profit factor</th>'
                  f'<th class=n>Worst drop</th><th class=n>Net</th><th class=n>Last 7 days</th><th>Days</th></tr></thead>'
                  f'<tbody>{rows}</tbody></table></div>')

    held = [h for d in book.desks for h in book.held[d]]
    if held:
        hrows = "".join(
            f"<tr><td>{e(book.label(h.desk))}</td><td>{e(h.symbol)}</td><td>{h.opened.astimezone(book.tz):%d %b %H:%M}</td>"
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
            f"<tr><td>{t.closed.astimezone(book.tz):%d %b %H:%M}</td><td>{e(book.label(t.desk))}</td><td>{e(t.symbol[:14])}</td>"
            f"<td>{e(t.exit)}</td><td class=\"n {_cls(t.pnl_pct)}\">{t.pnl_pct:+.1f}%</td>"
            f"<td class=\"n {_cls(t.pnl)}\">{e(_usd(t.pnl))}</td></tr>" for t in recent)
        trades_html = (f'<div class="scroll"><table><thead><tr><th>Closed</th><th>Desk</th><th>Symbol</th><th>Exit</th>'
                       f'<th class=n>Move</th><th class=n>P&amp;L</th></tr></thead><tbody>{trows}</tbody></table></div>')
    else:
        trades_html = '<p class="empty">No closed paper trades yet. Each one appears here as soon as a desk closes it.</p>'

    few = ("" if all_s["trades"] >= 50 else
           f"<p><b>{all_s['trades']} trades is far too few to judge.</b> Let the desks run for weeks before reading "
           "anything into these numbers.</p>")
    notes = "\n    ".join(_note(book, d) for d in (list(NOTE_ORDER) + [d for d in book.desks if d not in NOTE_ORDER])
                          if d in book.desks)
    key = "".join(f'<span class="k-{d}" style="--c:{book.color(d)}"><i></i>{e(book.label(d).lower())}</span>' for d in book.desks)
    swatches = "".join(f".chart .l-{d} {{ stroke: {book.color(d)}; }}\n" for d in book.desks if d not in COLORS)
    import weather

    weather_html = (f'<section aria-labelledby="h-w"><h2 id="h-w">Market weather now</h2>{weather.render_html(book.weather)}'
                    '</section>' if book.weather else "")
    return f"""<title>Paper Book</title>
{FONTS}
<style>{CSS}{weather.CSS}
.chart .l-any {{ stroke-width: 1.4; fill: none; }}
.key span[style] {{ color: var(--c); }}
.gw {{ display: inline-block; padding: 0 5px; border: 1px solid var(--up); color: var(--up); border-radius: 3px;
  font: 700 10px/1.6 var(--display); letter-spacing: .06em; text-transform: uppercase; vertical-align: middle; }}
p.small {{ color: var(--muted); font-size: 13px; }}
{swatches}</style>
<main class="sheet">
  <header class="top">
    <h1>Paper Book</h1>
    <p class="stamp">{demo}paper money only · {e(stamp)}</p>
  </header>
  {tiles}
  {weather_html}
  <section aria-labelledby="h-eq">
    <h2 id="h-eq">Profit and loss since the start</h2>
    <p class="key"><span class="k-total"><i></i>all desks</span>{key}</p>
    <div class="chart">{_equity_svg(book)}</div>
  </section>
  <section aria-labelledby="h-day">
    <h2 id="h-day">Each day, last 30 days</h2>
    <div class="chart">{_daily_svg(book)}</div>
  </section>
  <section aria-labelledby="h-desk"><h2 id="h-desk">By desk, best first</h2>{desk_table}
  <p class="small">A <b class="gw">green week</b> is three or more trading days in the last seven, net up, and no single
  day's loss bigger than the week's gain; ×2 means two such weeks in a row.</p></section>
  <section aria-labelledby="h-open"><h2 id="h-open">Open and waiting</h2>{held_html}</section>
  <section aria-labelledby="h-tr"><h2 id="h-tr">Latest closed trades</h2>{trades_html}</section>
  <section class="notes" aria-labelledby="h-n">
    <h2 id="h-n">How these numbers are made</h2>
    {few}
    {notes}
    <p>Paper results flatter real trading: real fills, gaps and nerves are worse. Nothing here is a forecast or advice.</p>
  </section>
</main>
"""


NOTE_ORDER = ("majors", "majors_4h", "memecoins", "memecoins_wild", "memecoins_strict",
              "stocks", "stocks_wild", "stocks_fade", "stocks_quick", "stocks_early")


def _note(book: Book, d: str) -> str:
    """How one desk's numbers are made, for the notes at the foot of the page."""
    bank = f"${book.banks[d]:,.0f}"
    if d == "majors":
        return (f"<p><b>Big coins</b> (Majors Desk): {bank} of paper money, trading BTC, ETH, XRP, ADA and others on\n"
                "      Coinbase's hourly prices. Each buy and sell pays the exchange fee and a little slippage.</p>")
    if d == "memecoins":
        return (f"<p><b>Memecoins</b> (Night Desk): {bank} of paper money. Buys and sells are priced from the pool's\n"
                "      live price with fees and price impact included, so they're close to what a real swap would get, "
                "but no order\n      ever reaches the market.</p>")
    if d == "majors_4h":
        return (f"<p><b>Big coins 4h</b> (Majors Desk, 4-hour rules): its own {bank} of paper money on the same coins, "
                "prices and fees as Big coins,\n      but deciding once per finished 4-hour candle instead of every "
                "hour (majors-desk/majors-4h.toml). Fewer trades,\n      longer holds, less paid in fees.</p>")
    if d == "memecoins_strict":
        return (f"<p><b>Strict memecoins</b> (Night Desk, strict rules): its own {bank} of paper money on the same coins, "
                "prices, fees and\n      rug checks as Memecoins, but only coins past their first half hour with real money "
                "behind them, half-size bets,\n      at most two at once, and quicker exits (night-desk/desk-strict.toml).</p>")
    if d == "memecoins_wild":
        return (f"<p><b>Wild memecoins</b> (Night Desk, wild rules): its own {bank} of paper money on the same coins, "
                "prices, fees and\n      rug checks as Memecoins, with looser entry rules and bigger, longer bets "
                "(night-desk/desk-wild.toml).\n      It's there to find out faster whether taking more risk pays.</p>")
    if d not in NOTE_ORDER and book.kind(d) == "coins":          # a desk described only by book.toml
        name = d.split('_', 1)[-1]
        what = {"memecoins": "the same coins, prices, fees and rug checks as Memecoins, under its own rules "
                             f"(night-desk/desk-{name}.toml)",
                "big coins": "Coinbase's prices, with fees and slippage, under its own rules "
                             f"(majors-desk/majors-{name}.toml)",
                "stocks": "US stocks and funds on Alpaca's daily prices, held for days or weeks under its own rules "
                          f"(majors-desk/majors-{name}.toml). Bought and sold at a trading day's close, no "
                          "commission"}[book.market(d)]
        return f"<p><b>{html.escape(book.label(d))}</b>: its own {bank} of paper money on {what}.</p>"
    stake = (f"each weekday's picks split {bank} of paper money equally" if book.share_bank else
             f"${book.ticket:,.0f} of paper money per pick, out of {bank}")
    target, stop, cost = book.stock_rules.get(d, (10.0, 5.0, 0.5))
    if d == "stocks_fade":
        return (f"<p><b>Fade stocks</b> (premarket scanner, fade rules): {stake}. The same picks as Stocks, "
                "but sold short at the\n      9:30 ET open instead of bought, so it gains when the price falls. "
                f"Bought back at −{target:g}% (the target),\n      +{stop:g}% (the stop, or wherever the stock "
                f"reopens if it jumps the stop) or the close, minus {cost:g}% for spread,\n      slippage and "
                "borrowing the shares. Real shorting needs a margin account and shares a broker can lend.</p>")
    name = {"stocks": "<b>Stocks</b> (premarket scanner)",
            "stocks_wild": "<b>Wild stocks</b> (premarket scanner, wild rules: smaller gaps, no news needed)",
            "stocks_quick": "<b>Quick stocks</b> (premarket scanner, quick rules: the same picks, profit taken fast)",
            "stocks_early": "<b>Early-out stocks</b> (premarket scanner, early rules: the same picks, out of the "
                            "market early)"}.get(d) or (f"<b>{html.escape(book.label(d))}</b> (premarket scanner, "
                                                       f"premarket-scanner/criteria-{d.split('_', 1)[-1]}.toml)")
    end = f"by {book.stock_exit[d]} ET" if book.stock_exit.get(d) else "the\n      close"
    e = book.stock_entry.get(d, ENTRY_DEFAULTS)
    if e.get("side") == "short":
        how = (f"Each pick is {entry_words(e)} and bought back at −{target:g}% (the target), +{stop:g}% (the stop, or "
               f"wherever it reopens if it jumps the stop) or {end}, minus {cost:g}% for spread, slippage and borrowing.")
    else:
        how = (f"Each pick is {entry_words(e)} and sold at +{target:g}%, −{stop:g}% or {end}, whichever comes first, "
               f"minus {cost:g}% for spread and slippage.")
    untriggered = (" A pick whose entry never triggers isn't traded: its share of the day's money sits in cash."
                   if e.get("entry", "open") != "open" else "")
    return (f"<p>{name}: {stake}.\n      {how}{untriggered} When one five-minute bar touches both target and stop, it "
            "counts as the stop.</p>")


def page(fragment: str) -> str:
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + fragment.replace("<main", "</head>\n<body>\n<main", 1) + "</body>\n</html>\n")


# -- command line ---------------------------------------------------------------------------------------

def build(cfg: dict, demo: bool, out: Path, now: Optional[datetime] = None) -> Book:
    import benchmark                               # BTC bought at the start and held: the bar to clear
    import deck

    import weather                                 # where the big trends stand: context for every desk

    book = load(cfg, demo, now)
    out.mkdir(parents=True, exist_ok=True)
    book.benchmark = benchmark.load(out, book)
    book.weather = weather.load(out, book.now, demo)
    (out / "weather.json").write_text(json.dumps(book.weather, indent=1), encoding="utf-8")
    write_ledger(book, out / "ledger.csv")
    standings = render_standings(book) + "\n"
    (out / "standings.txt").write_text(standings, encoding="utf-8")
    for label, when in (book.checkpoints or {}).items():       # the first look and the month-end read, kept as files
        when = deck._as_date(when)
        if when == book.now.astimezone(book.tz).date():
            (out / f"standings-{when.isoformat()}.txt").write_text(f"{label.upper()} · {when:%a %d %b %Y}\n{standings}",
                                                                   encoding="utf-8")
    frag = render_html(book)
    (out / "paper-book.fragment.html").write_text(frag, encoding="utf-8")
    (out / "paper-book.html").write_text(page(frag), encoding="utf-8")
    import crawler                                 # the same numbers, crawled trade by trade
    import deck                                    # ...as lanes of light on one time axis (the home page)
    import galaxy                                  # ...and drawn as a universe

    import proving                                 # ...and every running rulebook's history test, graded

    crawler.write(book, out)
    galaxy.write(book, out)
    deck.write(book, out)
    proving.write(book, out)
    return book


SERVED = {"/": "deck.html", "/deck": "deck.html", "/deck.html": "deck.html", "/deck.json": "deck.json",
          "/crawler": "crawler.html", "/crawler.html": "crawler.html", "/crawler.json": "crawler.json",
          "/galaxy": "galaxy.html", "/galaxy.html": "galaxy.html", "/galaxy.json": "galaxy.json",
          "/book": "paper-book.html", "/paper-book.html": "paper-book.html", "/ledger.csv": "ledger.csv",
          "/standings": "standings.txt", "/standings.txt": "standings.txt",
          "/proving": "proving.html", "/proving.html": "proving.html", "/proving.json": "proving.json",
          "/weather.json": "weather.json"}
TYPES = {".html": "text/html; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8",
         ".txt": "text/plain; charset=utf-8"}


def serve(out: Path, host: str = "127.0.0.1", port: int = 8790):
    """Read-only: the deck, the crawler, the galaxy, the paper book and the ledger, nothing else. Answers only to its
    own address."""
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
    ap.add_argument("--standings", action="store_true", help="just print every desk ranked, with its last 7 days")
    ap.add_argument("--proving", action="store_true", help="just print each rulebook's history-test grade")
    ap.add_argument("--serve", type=int, metavar="PORT", help="also show the deck, crawler, galaxy and book at http://HOST:PORT")
    ap.add_argument("--host", default="127.0.0.1", help="with --serve: the address to answer on (default this machine only)")
    ap.add_argument("--config", default=str(HERE / "book.toml"))
    args = ap.parse_args(argv)
    with open(args.config, "rb") as fh:
        cfg = tomllib.load(fh)
    import weather

    here = HERE / "output" / ("demo" if args.demo else "")
    if args.proving:
        import proving

        book = load(cfg, args.demo)
        book.weather = weather.load(here, book.now, args.demo)
        print(proving.render_text(proving.data(book)))
        return 0
    if args.print_only or args.standings:
        import benchmark

        book = load(cfg, args.demo)
        book.benchmark = benchmark.load(here, book)
        book.weather = weather.load(here, book.now, args.demo)
        print(render_standings(book) if args.standings else render_text(book))
        return 0
    out = HERE / "output" / ("demo" if args.demo else "")
    server = None
    first = True
    while True:
        if first:
            book = build(cfg, args.demo, out)             # the first build says plainly what's wrong with the setup
        else:
            try:                                            # later ones keep the last good pages up and try again
                book = build(cfg, args.demo, out)
            except Exception as exc:  # noqa: BLE001 - a desk mid-write, a full disk: say so, keep going
                print(f"{datetime.now(timezone.utc):%Y-%m-%d %H:%M} couldn't rebuild the book ({type(exc).__name__}: {exc}); "
                      f"trying again in {args.watch:g} minutes.", file=sys.stderr)
                book = None
        first = False
        if book is not None:
            print(render_text(book))
            if SKIPPED:
                print("  skipped " + ", ".join(f"{n} row{'s' if n != 1 else ''} of {Path(f).parent.name}/{Path(f).name}"
                                              for f, n in SKIPPED.items()) + " (still being written)")
            print(f"\nLedger: {out / 'ledger.csv'}\nReport: {out / 'paper-book.html'}\n"
                  f"Deck: {out / 'deck.html'}\nCrawler: {out / 'crawler.html'}\nGalaxy: {out / 'galaxy.html'}\n"
                  f"Proving ground: {out / 'proving.html'}")
        if args.serve and server is None:
            server = serve(out, args.host, args.serve)
            print(f"Showing the deck at http://{args.host}:{args.serve}/  (crawler: /crawler, galaxy: /galaxy, book: /book)")
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
