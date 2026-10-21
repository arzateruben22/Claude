"""Trading Deck: every desk as a lane of light on one time axis, replayed from day one to now.

  lane      one per desk, sorted live by paper return; its ribbon is cumulative paper profit over time
  spark     each closed trade, up for a win, down for a loss, pink when flagged (a rug exit or a big loss)
  flag      the desk's own day 28, the end of its four-week test
  check     a date the book is read on (book.toml [report] checkpoints): the first look, the end of the month
  week      each desk's last seven days: net, days traded, green and red days, and whether that makes a green week
  tape      the latest closed trades across every desk

Paper money only. Nothing here changes a desk, and nothing here is a forecast.
"""
from __future__ import annotations

import gzip
import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import crawler
import paperbook as pb

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
MONTH_DAYS = 28            # the test each desk has to sit through before it's judged
MARKS = 400                # sparks drawn per lane; older trades still count in the ribbon
TAPE = 40                  # closed trades on the ticker
BTC_CACHE = HERE.parent / "majors-desk" / "output" / "cache" / "BTC-USD.json.gz"   # hourly candles the coin desks keep
WEEK_DAYS = 7              # a green week: traded on 3+ of the last 7 days, net up, no day's loss bigger than the week's gain
IDEA = {
    "memecoins": "new coins · +40 / −20", "memecoins_wild": "younger coins, 20% bets · +100 / −25",
    "memecoins_strict": "older coins, 5% bets · +25 / −12",
    "memecoins_sniper": "3–10 min old, 5% bets · +60 / −30, 30 min", "memecoins_momentum": "buy pressure · +80 trail",
    "memecoins_patient": "1h+ old, big pools · +30 / −15, 6h", "memecoins_scalper": "quick scalps · +12 / −8, 20 min",
    "memecoins_whale": "big pools, 15% bets · +20 / −10", "memecoins_runner": "trails a runner · +1000 cap, 4h",
    "memecoins_tiny": "2% bets, 8 open",
    "majors": "hourly breakouts", "majors_4h": "4-hour breakouts", "majors_daily": "daily breakouts",
    "majors_fast": "short windows, 2 ATR stop", "majors_tight": "hourly, 1.5 ATR stop", "majors_loose": "4-hour, 5 ATR stop",
    "majors_btc": "BTC only, 4-hour, 80% in", "majors_alts": "SOL XRP ADA DOGE, hourly", "majors_single": "one coin at a time, 80% in",
    "majors_slow": "daily, long windows",
}
STOCK_BASE = {"stocks": "gap-ups", "stocks_wild": "5% gaps, no news", "stocks_fade": "gap-ups sold short",
              "stocks_quick": "gap-ups", "stocks_early": "gap-ups", "stocks_bigcap": "$5–100 gap-ups",
              "stocks_tight": "gap-ups", "stocks_hold": "gap-ups", "stocks_cheap": "$1–5 gap-ups, 15%+",
              "stocks_highvol": "gap-ups, 8× volume"}


def _dt(s: str) -> datetime:
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def started(book: pb.Book, d: str) -> Optional[datetime]:
    """When a desk started: its first saved equity point (coins), or its first trade or open position."""
    times = [t.opened for t in book.trades[d]] + [h.opened for h in book.held[d]]
    if book.kind(d) == "coins":
        try:
            points = json.loads((Path(book.sources[d]) / "state.json").read_text()).get("equity") or []
            if points:
                times.append(_dt(points[0][0]))
        except (OSError, ValueError, KeyError, IndexError, TypeError):
            pass
    return min(times) if times else None


def idea(book: pb.Book, d: str) -> str:
    """One line on what the desk does, in the words of its own rules."""
    if d in IDEA:
        return IDEA[d]
    target, stop, _ = book.stock_rules.get(d, (10.0, 5.0, 0.5))
    base = STOCK_BASE.get(d, "stocks")
    exits = f"−{target:g} / +{stop:g}" if d == "stocks_fade" else f"+{target:g} / −{stop:g}"
    out = f"{base} · {exits}"
    if book.stock_exit.get(d):
        out += f" · out by {book.stock_exit[d]} ET"
    return out


def verdict(n: int, s: dict) -> str:
    """What the numbers say so far, in plain words. Never a forecast."""
    pf = s["profit_factor"]
    if n == 0:
        return "no trades yet"
    if n < 10:
        return f"{n} trade{'s' if n > 1 else ''} · too few to judge"
    if pf is not None and pf < 1:
        return "loses more than it wins"
    if s["net"] > 0 and pf is not None and pf >= 1.3:
        return "holding up" if n >= 30 else "ahead, so far"
    return "about even"


def week(book: pb.Book, d: str, today: date) -> dict:
    """The desk's last seven days (today included): net paper profit, days it traded, green and red days, the worst
    day, and whether that makes a green week: traded on three or more of the seven days, net up, and no single day's
    loss bigger than the week's gain. The bar one desk has to clear, a week at a time, after the month-end read."""
    first = today - timedelta(days=WEEK_DAYS - 1)
    by_day = pb.daily([t for t in book.trades[d] if first <= t.closed.astimezone(book.tz).date() <= today], book.tz)
    net = round(sum(by_day.values()), 2)
    worst = round(min(by_day.values()), 2) if by_day else 0.0
    green, red = sum(1 for v in by_day.values() if v > 0), sum(1 for v in by_day.values() if v < 0)
    return {"net": net, "traded": len(by_day), "green": green, "red": red, "worst_day": worst,
            "green_week": len(by_day) >= 3 and net > 0 and -worst < net}


def checkpoints(book: pb.Book) -> List[dict]:
    """The dates the book is read on, from book.toml: [report] checkpoints = { "first look" = 2026-10-23, ... }."""
    out = []
    for label, day in (book.checkpoints or {}).items():
        if isinstance(day, datetime):
            day = day.date()
        if not isinstance(day, date):
            continue
        at = datetime.combine(day, time(hour=23, minute=59), tzinfo=book.tz)
        out.append({"label": str(label), "date": day.isoformat(), "at": int(at.timestamp()),
                    "local": day.strftime("%a %d %b")})
    return out


def btc_series(book: pb.Book, cache: Path = BTC_CACHE, points: int = 1500) -> Optional[List[list]]:
    """BTC bought at the start and held, hour by hour, from the hourly candles the coin desks cache.
    None without the benchmark or the cache: the header still shows the single figure."""
    b = book.benchmark
    if not b or not cache.exists():
        return None
    try:
        rows = json.loads(gzip.decompress(cache.read_bytes()))
    except (OSError, ValueError):
        return None
    since, p0 = _dt(b["since"]).timestamp(), float(b["btc_start"])
    if not p0:
        return None
    mine = [[int(r[0]), round((float(r[4]) / p0 - 1) * 100, 2)] for r in rows if r[0] >= since]
    if len(mine) < 2:
        return None
    step = max(1, len(mine) // points)
    out = mine[::step]
    if out[-1] != mine[-1]:
        out.append(mine[-1])
    return out


def data(book: pb.Book) -> dict:
    desks = []
    today = book.now.astimezone(book.tz).date()
    for d in book.desks:
        ts = sorted(book.trades[d], key=lambda t: t.closed)
        s = pb.stats(ts, book.banks[d])
        start = started(book, d)
        cum, steps = 0.0, []
        for t in ts:
            cum += t.pnl
            steps.append([int(t.closed.timestamp()), round(cum, 2)])
        held = [h for h in book.held[d] if h.value is not None]
        pf = s["profit_factor"]
        desks.append({
            "key": d, "label": book.label(d), "color": book.color(d), "kind": book.kind(d), "market": book.market(d),
            "bank": book.banks[d], "idea": idea(book, d), "start": int(start.timestamp()) if start else None,
            "day": (min(MONTH_DAYS, (book.now - start).days + 1) if start else 0),
            "trades": len(ts), "net": s["net"], "win_rate": s["win_rate"],
            "pf": None if pf is None else (99.0 if pf == float("inf") else round(pf, 2)), "dd": s["max_drawdown_pct"],
            "open": {"n": len(book.held[d]), "value": round(sum(h.value - h.cost for h in held), 2)},
            "verdict": verdict(len(ts), s), "week": week(book, d, today),
            "steps": steps,
            # closed (unix), % move, paper $, flagged
            "marks": [[int(t.closed.timestamp()), round(t.pnl_pct, 1), round(t.pnl, 2), int(crawler.is_flag(t))]
                      for t in ts[-MARKS:]],
        })
    all_trades = book.all_trades
    total = sum(len(book.trades[d]) for d in book.desks)
    starts = [x["start"] for x in desks if x["start"]]
    b = book.benchmark
    tape = [[int(t.closed.timestamp()), t.desk, t.symbol, round(t.pnl_pct, 1), round(t.pnl, 2), t.exit]
            for t in all_trades[-TAPE:][::-1]]
    return {
        "meta": {"demo": book.demo, "updated": book.now.isoformat(), "now": int(book.now.timestamp()),
                 "tz": str(book.tz), "updated_local": book.now.astimezone(book.tz).strftime("%a %d %b %Y, %H:%M"),
                 "day_one": min(starts) if starts else None, "month_days": MONTH_DAYS,
                 "bank": book.bank_total, "net": round(sum(t.pnl for t in all_trades), 2),
                 "open": round(book.unrealized, 2), "trades": total,
                 "btc": {"pct": b["pct"], "since": int(_dt(b["since"]).timestamp())} if b else None,
                 "week_days": WEEK_DAYS, "checkpoints": checkpoints(book),
                 "markets": [m for m in pb.MARKETS if any(book.market(d) == m for d in book.desks)]},
        "desks": desks, "btc_series": btc_series(book), "tape": tape,
    }


def _parts(payload: dict) -> tuple:
    page = (WEB / "deck.html").read_text(encoding="utf-8")
    body = page.split("<!--BODY-->", 1)[1].split("<!--/BODY-->", 1)[0]
    css = (WEB / "deck.css").read_text(encoding="utf-8")
    js = (WEB / "deck.js").read_text(encoding="utf-8")
    fonts = next(line for line in page.splitlines() if "fonts.googleapis.com/css2" in line)
    blob = json.dumps(payload, separators=(",", ":")).replace("</", "<\\/")
    head = ("<title>Trading Deck</title>\n<meta name=\"color-scheme\" content=\"dark\">\n"
            "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n"
            f"{fonts.strip()}\n<style>{css}</style>\n")
    boot = f"<script>window.TRADING_DECK={blob};</script>\n<script>{js}</script>\n"
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
    (out / "deck.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    (out / "deck.html").write_text(page(payload), encoding="utf-8")
    (out / "deck.fragment.html").write_text(fragment(payload), encoding="utf-8")
    return payload
