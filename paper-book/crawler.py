"""Trade Crawler: the paper book, read trade by trade by a sixteen-legged crawler.

  cluster   one per desk (memecoins, big coins, stocks), then the open positions, then the patterns
  node      each closed paper trade, in the order it closed
  link      a winning trade
  flag      a trade worth a second look: a rug exit, or a loss of half the stake or more
  ship      the list of things to check before trusting any desk with real money

Flags describe what happened. They are not forecasts, and nothing here changes a desk.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Dict, List

import galaxy
import paperbook as pb

WEB = Path(__file__).resolve().parent / "web"
SHOWN = 240            # trades per desk the crawler walks; older ones are counted, not drawn
BIG_LOSS = -50.0       # % of the stake: a trade that lost half or more gets flagged
TRUST = 30             # trades before a desk's win rate means much
STREAK = 6             # losses in a row worth a flag
DRAWDOWN = 20.0        # % below the desk's high worth a flag
COLORS = {"memecoins": "#3cc3f2", "majors": "#f2bd4f", "stocks": "#a08cff", "open": "#5fe3a1", "patterns": "#e98bff"}
NAMES = {"memecoins": "memecoins", "majors": "big coins", "stocks": "stocks"}
ABBR = {"memecoins": "MEM", "majors": "BIG", "stocks": "STK", "open": "OPN", "patterns": "PAT"}


def is_flag(t: pb.Trade) -> bool:
    return "rug" in t.exit.lower() or t.pnl_pct <= BIG_LOSS


def _usd(v: float) -> str:
    return pb._usd(v)


def _pct(v: float) -> str:
    return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.1f}%"


def _rate(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".") + "%"


def _day(t: pb.Trade, tz) -> int:
    return t.closed.astimezone(tz).date().toordinal()


def _losing_streak(trades: List[pb.Trade]) -> int:
    run = worst = 0
    for t in trades:
        run = run + 1 if t.pnl <= 0 else 0
        worst = max(worst, run)
    return worst


# -- the things to check -------------------------------------------------------------------------

def flags(book: pb.Book) -> List[dict]:
    """What a careful person would ask about each desk before trusting it. level: flag, note or up."""
    found: List[dict] = []
    notes: List[dict] = []
    ups: List[dict] = []

    def add(into, desk, chip, text):
        into.append({"desk": desk, "chip": chip, "text": text})

    for d in pb.DESKS:
        ts = sorted(book.trades[d], key=lambda t: t.closed)
        label, n = pb.LABEL[d], len(ts)
        if not n:
            add(notes, d, "no trades", f"{label}: no closed paper trades yet.")
            continue
        s = pb.stats(ts, book.banks[d])
        pf = s["profit_factor"]
        if n >= 20 and pf is not None and pf < 1:
            add(found, d, f"PF {pf:.2f}", f"{label} loses more than it wins: profit factor {pf:.2f} over {n} trades "
                                          "(under 1 means the losses outweigh the wins).")
        rugs = [t for t in ts if "rug" in t.exit.lower()]
        if rugs:
            add(found, d, f"rug ×{len(rugs)}",
                f"{len(rugs)} rug exit{'s' if len(rugs) > 1 else ''} averaged {_pct(mean(t.pnl_pct for t in rugs))} "
                f"({_usd(sum(t.pnl for t in rugs))} in all). Check the rug filter before anything else.")
        big = [t for t in ts if t.pnl_pct <= BIG_LOSS and "rug" not in t.exit.lower()]
        if big:
            add(found, d, f"{BIG_LOSS:.0f}% ×{len(big)}",
                f"{len(big)} trade{'s' if len(big) > 1 else ''} lost half the stake or more without a rug exit: "
                "the stop did not hold.")
        worst = s["worst"]
        if worst and worst.pnl < 0 and not is_flag(worst) and s["avg_loss"] < 0 and worst.pnl <= 3 * s["avg_loss"]:
            add(found, d, "worst", f"Worst {label.lower()} trade: {worst.symbol} {_usd(worst.pnl)} ({_pct(worst.pnl_pct)}), "
                                   f"over three times the average loss of {_usd(s['avg_loss'])}.")
        if n >= 10 and s["net"] > 0:
            by_sym: Dict[str, float] = defaultdict(float)
            for t in ts:
                by_sym[t.symbol] += t.pnl
            sym, top = max(by_sym.items(), key=lambda kv: kv[1])
            if top > 0.5 * s["net"]:
                rest = s["net"] - top
                share = (f"{top / s['net']:.0%} of" if top <= s["net"] else
                         f"{pb._usd(top, sign=False)}, more than all of")
                add(found, d, "one symbol", f"{sym} made {share} {label.lower()}' net paper profit. "
                                            f"Without it the desk is {'up' if rest > 0 else 'down'} "
                                            f"{pb._usd(abs(rest), sign=False)}.")
        streak = _losing_streak(ts)
        if streak >= STREAK:
            add(found, d, f"{streak} in a row", f"{streak} {label.lower()} losses in a row at one point: "
                                                "make sure the bank can sit through that.")
        if s["max_drawdown_pct"] >= DRAWDOWN:
            add(found, d, f"DD {s['max_drawdown_pct']:.0f}%",
                f"{label} fell {s['max_drawdown_pct']:.0f}% below its high at one point.")
        if n < TRUST:
            add(notes, d, f"n={n}", f"{label} has {n} closed trade{'s' if n > 1 else ''}: too few to trust its "
                                    f"{_rate(s['win_rate'])} win rate yet ({TRUST - n} to go).")
        elif s["net"] > 0 and pf is not None and pf >= 1.3:
            pf_txt = "no losses" if pf == float("inf") else f"profit factor {pf:.2f}"
            add(ups, d, "holding up", f"{label}: {_rate(s['win_rate'])} wins, {pf_txt}, "
                                      f"{_usd(s['net'])} over {n} trades.")
    for d in pb.DESKS:
        for h in book.held[d]:
            if h.value is not None and h.cost > 0 and h.value < 0.8 * h.cost:
                add(found, d, "open", f"{h.symbol} is open at {_pct((h.value / h.cost - 1) * 100)} "
                                      f"({_usd(h.value - h.cost)} so far).")
    return [dict(x, level="flag") for x in found] + [dict(x, level="note") for x in notes] + \
        [dict(x, level="up") for x in ups]


# -- everything the page needs ---------------------------------------------------------------------

def _trade_section(book: pb.Book, d: str) -> dict:
    ts = sorted(book.trades[d], key=lambda t: t.closed)
    shown, earlier = ts[-SHOWN:], ts[:-SHOWN] if len(ts) > SHOWN else []
    s = pb.stats(ts, book.banks[d])
    days: Dict[int, float] = defaultdict(float)
    for t in earlier:
        days[_day(t, book.tz)] += t.pnl
    sub = f"{len(ts):,} paper trade{'s' if len(ts) != 1 else ''}"
    if ts:
        sub += f" · {_rate(s['win_rate'])} won · {_usd(s['net'])}"
    if earlier:
        sub += f" · walking the last {SHOWN}"
    return {
        "key": d, "name": NAMES[d], "abbr": ABBR[d], "color": COLORS[d], "kind": "trades", "sub": sub,
        "earlier": {"n": len(earlier), "pnl": round(sum(t.pnl for t in earlier), 2),
                    "wins": sum(t.pnl > 0 for t in earlier),
                    "losses": sum(t.pnl < 0 for t in earlier), "flags": sum(is_flag(t) for t in earlier),
                    "gain": round(sum(t.pnl for t in earlier if t.pnl > 0), 2),
                    "loss": round(-sum(t.pnl for t in earlier if t.pnl < 0), 2),
                    "days": {str(k): round(v, 2) for k, v in days.items()}},
        # symbol, paper $, %, exit, minutes held, closed (unix), local day, flagged
        "words": [[t.symbol, round(t.pnl, 2), round(t.pnl_pct, 2), t.exit,
                   int((t.closed - t.opened).total_seconds() // 60), int(t.closed.timestamp()),
                   _day(t, book.tz), int(is_flag(t))] for t in shown],
    }


def data(book: pb.Book) -> dict:
    sections = [_trade_section(book, d) for d in pb.DESKS]
    held = [h for d in pb.DESKS for h in book.held[d]]
    marked = [h for h in held if h.value is not None]
    open_sub = f"{len(held)} open position{'s' if len(held) != 1 else ''}"
    if marked:
        open_sub += f" · {_usd(sum(h.value - h.cost for h in marked))} not yet banked"
    sections.append({
        "key": "open", "name": "open", "abbr": ABBR["open"], "color": COLORS["open"], "kind": "open", "sub": open_sub,
        # symbol, desk, cost, value (None = waiting for the open), opened (unix)
        "words": [[h.symbol, h.desk, round(h.cost, 2), None if h.value is None else round(h.value, 2),
                   int(h.opened.timestamp())] for h in sorted(held, key=lambda h: h.opened)],
    })
    pats = [p for d in pb.DESKS for p in galaxy.desk_patterns(d, book.trades[d], book.tz)] + galaxy.shared_patterns(book)
    sections.append({
        "key": "patterns", "name": "patterns", "abbr": ABBR["patterns"], "color": COLORS["patterns"], "kind": "patterns",
        "sub": f"{sum(p['unlocked'] for p in pats)} of {len(pats)} patterns unlocked by enough trades",
        # title, desk (MEM, BIG, STK, or two joined by +), unlocked, detail
        "words": [[p["title"], ABBR[p["desk"]] if p["desk"] != "*" else "+".join(ABBR[x] for x in p["desks"]),
                   int(p["unlocked"]), p["detail"]] for p in pats],
    })
    desks = []
    for d in pb.DESKS:
        s = pb.stats(book.trades[d], book.banks[d])
        pf = s["profit_factor"]
        desks.append({"key": d, "label": pb.LABEL[d], "bank": book.banks[d], "trades": s["trades"], "net": s["net"],
                      "win_rate": s["win_rate"], "open": len(book.held[d]),
                      "pf": None if pf is None else (99.0 if pf == float("inf") else pf),
                      "dd": s["max_drawdown_pct"]})
    return {
        "meta": {"demo": book.demo, "updated": book.now.isoformat(), "tz": str(book.tz),
                 "updated_local": book.now.astimezone(book.tz).strftime("%a %d %b %Y, %H:%M"),
                 "bank": sum(book.banks.values()), "trades": sum(len(book.trades[d]) for d in pb.DESKS),
                 "big_loss": BIG_LOSS},
        "desks": desks, "sections": sections, "flags": flags(book),
    }


def _parts(payload: dict) -> tuple:
    page = (WEB / "crawler.html").read_text(encoding="utf-8")
    body = page.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    css = (WEB / "crawler.css").read_text(encoding="utf-8")
    js = (WEB / "crawler.js").read_text(encoding="utf-8")
    fonts = next(line for line in page.splitlines() if "fonts.googleapis.com/css2" in line)
    blob = json.dumps(payload, separators=(",", ":")).replace("</", "<\\/")
    head = ("<title>Trade Crawler</title>\n<meta name=\"color-scheme\" content=\"dark\">\n"
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
            f"{fonts.strip()}\n<style>{css}</style>\n")
    boot = f"<script>window.TRADE_CRAWLER={blob};</script>\n<script>{js}</script>\n"
    return head, body, boot


def fragment(payload: dict) -> str:
    head, body, boot = _parts(payload)
    return head + body + boot


def page(payload: dict) -> str:
    head, body, boot = _parts(payload)
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            f"{head}</head>\n<body>\n{body}{boot}</body>\n</html>\n")


def write(book: pb.Book, out: Path) -> dict:
    payload = data(book)
    out.mkdir(parents=True, exist_ok=True)
    (out / "crawler.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    (out / "crawler.html").write_text(page(payload), encoding="utf-8")
    (out / "crawler.fragment.html").write_text(fragment(payload), encoding="utf-8")
    return payload
