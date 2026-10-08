"""Paper Galaxy: the paper book drawn as a universe that grows with every trade.

  galaxy          one per desk (memecoins, big coins, stocks; a new desk becomes a new galaxy)
  star            each coin or stock a desk has traded; bigger = traded more, color = made or lost money
  planet          each closed trade, orbiting its star
  constellation   a pattern in the trades. Each one stays locked until there are enough trades
                  to say anything, so the map fills in as information comes in.

Constellations describe what happened. They are not forecasts, and nothing here changes a desk.
"""
from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import mean
from typing import Dict, List, Optional, Sequence

import paperbook as pb

WEB = Path(__file__).resolve().parent / "web"
NEED = {"exits": 20, "sources": 20, "streaks": 20, "hold": 30, "hours": 40, "weekday": 40}
SHARED_DAYS = 15          # days with trades on two desks before comparing them
MIN_GROUP = 5             # trades a group needs before it's compared


def _pct(v: float) -> str:
    return f"{v:+.1f}%"


def _top_symbols(trades: Sequence[pb.Trade], k: int = 5) -> List[str]:
    return [s for s, _ in Counter(t.symbol for t in trades).most_common(k)]


def _hours(minutes: float) -> str:
    return f"{minutes:.0f} min" if minutes < 90 else f"{minutes / 60:.1f} h" if minutes < 72 * 60 else f"{minutes / 1440:.1f} days"


# -- constellations -------------------------------------------------------------------------------

def desk_patterns(desk: str, trades: List[pb.Trade], tz) -> List[dict]:
    label, n = pb.LABEL[desk], len(trades)
    out: List[dict] = []

    def add(pid: str, title: str, need: int, make) -> None:
        item = {"id": f"{desk}:{pid}", "desk": desk, "title": title, "n": n, "need": need,
                "unlocked": n >= need, "symbols": [], "detail": ""}
        if n >= need:
            made = make()
            if not made:
                return
            item["detail"], item["symbols"] = made
        else:
            item["detail"] = f"Unlocks after {need} {label.lower()} trades ({need - n} to go)."
        out.append(item)

    def exits():
        groups = defaultdict(list)
        for t in trades:
            groups[t.exit or "other"].append(t)
        big = {k: v for k, v in groups.items() if len(v) >= MIN_GROUP}
        if not big:
            return None
        ranked = sorted(big.items(), key=lambda kv: mean(t.pnl_pct for t in kv[1]), reverse=True)
        line = lambda k, v: (f"'{k}' exits: won {sum(t.pnl > 0 for t in v) / len(v):.0%}, "
                             f"{_pct(mean(t.pnl_pct for t in v))} average ({len(v)} trades)")
        detail = line(*ranked[0]) + ("." if len(ranked) == 1 else ". " + line(*ranked[-1]) + ".")
        return detail, _top_symbols(ranked[0][1])

    def hold():
        ordered = sorted(trades, key=lambda t: (t.closed - t.opened).total_seconds())
        third = len(ordered) // 3
        short, long_ = ordered[:third], ordered[-third:]
        cut_s = (short[-1].closed - short[-1].opened).total_seconds() / 60
        cut_l = (long_[0].closed - long_[0].opened).total_seconds() / 60
        ms, ml = mean(t.pnl_pct for t in short), mean(t.pnl_pct for t in long_)
        best = long_ if ml > ms else short
        return (f"Quickest third (under {_hours(cut_s)}): {_pct(ms)} average. "
                f"Longest third (over {_hours(cut_l)}): {_pct(ml)}.", _top_symbols(best))

    def hours():
        blocks = defaultdict(list)
        for t in trades:
            blocks[t.opened.astimezone(tz).hour // 4].append(t)
        big = {k: v for k, v in blocks.items() if len(v) >= MIN_GROUP}
        if len(big) < 2:
            return None
        ranked = sorted(big.items(), key=lambda kv: mean(t.pnl_pct for t in kv[1]), reverse=True)
        name = lambda b: f"{b * 4:02d}:00–{(b * 4 + 4) % 24:02d}:00"
        (bb, bv), (wb, wv) = ranked[0], ranked[-1]
        return (f"Bought {name(bb)}: {_pct(mean(t.pnl_pct for t in bv))} average ({len(bv)} trades). "
                f"Bought {name(wb)}: {_pct(mean(t.pnl_pct for t in wv))} ({len(wv)}).", _top_symbols(bv))

    def weekday():
        days = defaultdict(list)
        for t in trades:
            days[t.opened.astimezone(tz).strftime("%A")].append(t)
        big = {k: v for k, v in days.items() if len(v) >= MIN_GROUP}
        if len(big) < 2:
            return None
        ranked = sorted(big.items(), key=lambda kv: mean(t.pnl_pct for t in kv[1]), reverse=True)
        (bd, bv), (wd, wv) = ranked[0], ranked[-1]
        return (f"{bd}s: {_pct(mean(t.pnl_pct for t in bv))} average ({len(bv)} picks). "
                f"{wd}s: {_pct(mean(t.pnl_pct for t in wv))} ({len(wv)}).", _top_symbols(bv))

    def sources():
        gross = defaultdict(float)
        for t in trades:
            if t.pnl > 0:
                gross[t.symbol] += t.pnl
        total = sum(gross.values())
        if total <= 0:
            return ("No winning trades yet, so no profit to trace.", [])
        ranked = sorted(gross.items(), key=lambda kv: kv[1], reverse=True)
        top = ranked[0]
        three = sum(v for _, v in ranked[:3]) / total
        detail = f"{top[0]} made {top[1] / total:.0%} of the winnings"
        detail += f"; the top 3 made {three:.0%}." if len(ranked) > 3 else "."
        if top[1] / total > 0.5:
            detail += " One symbol is carrying this desk."
        return detail, [s for s, _ in ranked[:5]]

    def streaks():
        best = worst = run_w = run_l = 0
        lose_run: List[str] = []
        cur: List[str] = []
        for t in sorted(trades, key=lambda t: t.closed):
            if t.pnl > 0:
                run_w, run_l, cur = run_w + 1, 0, []
            else:
                run_l, run_w = run_l + 1, 0
                cur.append(t.symbol)
                if run_l > worst:
                    lose_run = list(cur)
            best, worst = max(best, run_w), max(worst, run_l)
        return (f"Longest winning streak: {best} in a row. Longest losing streak: {worst}.",
                list(dict.fromkeys(lose_run))[:6])

    add("exits", f"How {label.lower()} trades end", NEED["exits"], exits)
    add("sources", "Where the winnings came from", NEED["sources"], sources)
    add("streaks", "Streaks", NEED["streaks"], streaks)
    if desk == "stocks":
        add("weekday", "Day of the week", NEED["weekday"], weekday)
    else:
        add("hold", "Holding time", NEED["hold"], hold)
        add("hours", "Time of day", NEED["hours"], hours)
    return out


def shared_patterns(book: pb.Book) -> List[dict]:
    """Do two desks win and lose on the same days? That decides whether they spread the risk."""
    days = {d: pb.daily(book.trades[d], book.tz) for d in pb.DESKS}
    out = []
    for i, a in enumerate(pb.DESKS):
        for b in pb.DESKS[i + 1:]:
            common = sorted(set(days[a]) & set(days[b]))
            item = {"id": f"{a}+{b}", "desk": "*", "desks": [a, b], "symbols": [],
                    "title": f"{pb.LABEL[a]} and {pb.LABEL[b].lower()} together", "n": len(common),
                    "need": SHARED_DAYS, "unlocked": len(common) >= SHARED_DAYS}
            if not item["unlocked"]:
                item["detail"] = (f"Unlocks after {SHARED_DAYS} days with trades on both "
                                  f"({SHARED_DAYS - len(common)} to go).")
            else:
                x = [days[a][d] for d in common]
                y = [days[b][d] for d in common]
                mx, my = mean(x), mean(y)
                sx = math.sqrt(sum((v - mx) ** 2 for v in x))
                sy = math.sqrt(sum((v - my) ** 2 for v in y))
                r = sum((u - mx) * (v - my) for u, v in zip(x, y)) / (sx * sy) if sx and sy else 0.0
                how = ("tend to win and lose on the same days" if r > 0.3 else
                       "tend to move opposite ways" if r < -0.3 else "move mostly independently")
                item["detail"] = (f"They {how}: correlation {r:+.2f} over {len(common)} shared days "
                                  "(+1 = always together, 0 = unrelated).")
            out.append(item)
    return out


def milestones(book: pb.Book) -> List[dict]:
    trades = book.all_trades
    out = []

    def add(title: str, at: Optional[datetime], detail: str = "") -> None:
        out.append({"title": title, "at": at.isoformat() if at else None, "detail": detail})

    add("First light", trades[0].closed if trades else None, "the first paper trade closes")
    for n in (10, 100, 1000):
        add(f"{n:,} trades", trades[n - 1].closed if len(trades) >= n else None)
    firsts = [min((t.closed for t in book.trades[d]), default=None) for d in pb.DESKS]
    add("Every desk trading", max(firsts) if all(firsts) else None, "a galaxy for each desk")
    total, hit = 0.0, None
    for t in trades:
        total += t.pnl
        if total >= 100:
            hit = t.closed
            break
    add("$100 of paper profit", hit, "net, across every desk")
    green = None
    for day, v in sorted(pb.daily(trades, book.tz).items()):
        if v > 0:
            green = datetime.combine(day, datetime.min.time(), tzinfo=book.tz) + timedelta(hours=23, minutes=59)
            break
    add("First green day", green, "all desks together ended the day up")
    month = trades[0].closed + timedelta(days=30) if trades else None
    add("A month of data", month if month and month <= book.now else None, "enough to start trusting patterns")
    return out


# -- everything the page needs ---------------------------------------------------------------------

def data(book: pb.Book) -> dict:
    sym_index: Dict[tuple, int] = {}
    symbols: List[dict] = []

    def sym(desk: str, name: str, born: datetime) -> int:
        key = (desk, name)
        if key not in sym_index:
            sym_index[key] = len(symbols)
            symbols.append({"d": pb.DESKS.index(desk), "s": name, "born": int(born.timestamp())})
        return sym_index[key]

    exits: List[str] = []
    rows = []
    for t in book.all_trades:
        i = sym(t.desk, t.symbol, t.closed)
        if t.exit not in exits:
            exits.append(t.exit)
        rows.append([i, int(t.closed.timestamp()), round(t.pnl, 2), round(t.pnl_pct, 2), exits.index(t.exit),
                     int((t.closed - t.opened).total_seconds() // 60)])
    held = []
    for d in pb.DESKS:
        for h in book.held[d]:
            i = sym(d, h.symbol, h.opened)
            held.append([i, int(h.opened.timestamp()), round(h.cost, 2), None if h.value is None else round(h.value, 2)])
    desks = []
    for d in pb.DESKS:
        s = pb.stats(book.trades[d], book.banks[d])
        desks.append({"key": d, "label": pb.LABEL[d], "bank": book.banks[d], "trades": s["trades"],
                      "net": s["net"], "win_rate": s["win_rate"], "open": len(book.held[d])})
    pats = [p for d in pb.DESKS for p in desk_patterns(d, book.trades[d], book.tz)] + shared_patterns(book)
    return {
        "meta": {"demo": book.demo, "updated": book.now.isoformat(), "now": int(book.now.timestamp()),
                 "tz": str(book.tz), "updated_local": book.now.astimezone(book.tz).strftime("%a %d %b %Y, %H:%M")},
        "desks": desks, "symbols": symbols, "exits": exits, "trades": rows, "held": held,
        "patterns": pats, "milestones": milestones(book),
    }


def _parts(payload: dict) -> tuple:
    page = (WEB / "galaxy.html").read_text(encoding="utf-8")
    body = page.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    css = (WEB / "galaxy.css").read_text(encoding="utf-8")
    js = (WEB / "galaxy.js").read_text(encoding="utf-8")
    fonts = next(line for line in page.splitlines() if "fonts.googleapis.com/css2" in line)
    blob = json.dumps(payload, separators=(",", ":")).replace("</", "<\\/")
    head = ("<title>Paper Galaxy</title>\n<meta name=\"color-scheme\" content=\"dark\">\n"
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
            f"{fonts.strip()}\n<style>{css}</style>\n")
    boot = f"<script>window.PAPER_GALAXY={blob};</script>\n<script>{js}</script>\n"
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
    (out / "galaxy.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    (out / "galaxy.html").write_text(page(payload), encoding="utf-8")
    (out / "galaxy.fragment.html").write_text(fragment(payload), encoding="utf-8")
    return payload
