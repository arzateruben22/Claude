"""Proving ground: every running rulebook's history test in one place, graded by one stated rule.

  big coins   the newest backtest in majors-desk/output/<book>/backtests/ (periods.json: quarter by quarter,
              next to holding the same coins), made with `python -m majors backtest --days 1460 --book <book>`
  swings      stocks and funds held for days or weeks by the same engine on Alpaca's daily bars (index,
              sectors, leaders): the same periods.json, graded the same way as big coins
  stocks      the newest backtest in premarket-scanner/output/<book>/backtests/ (journal.csv: every pick,
              graded month by month), made with `python -m scanner backtest --from 2026-01-02 --book <book>`
  memecoins   can't be replayed: nobody keeps a history of brand-new coins. They're judged live only.

`bash server/prove.sh` runs all of them one at a time in the background. This page only reads what they wrote.

The rule (RULE below, the same words on the page):
  candidate  made money over the whole test, made money in at least two thirds of its periods (quarters for
             coins and swings, months for day-trade stocks), with enough trades, and (coins and swings) a worst
             drop under 25%
  watch      made money over the whole test, or made money in at least half its periods
  cut        lost money over the whole test and made money in fewer than half its periods
Passing is necessary, not sufficient: a candidate still has to repeat it live, on paper, before anyone trusts it.
History flatters: exact fills, no missing data, no nerves. Paper money only; nothing here is a forecast.
"""
from __future__ import annotations

import csv
import html
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean
from typing import Dict, List, Optional

import paperbook as pb
import weather

# Each rulebook is graded with the others of its group: a desk's market, and for stocks how long it holds.
GROUPS = ("memecoins", "big coins", "swings", "stocks")
TITLES = {"big coins": "Big coins, quarter by quarter",
          "swings": "Stocks held for days or weeks, quarter by quarter",
          "stocks": "Stocks bought and sold the same day, month by month"}
MIN_TRADES = {"stocks": 100, "big coins": 10, "swings": 10}
MAX_DROP = 25.0                 # coins and swings: a candidate's worst fall from a high, in % of its bank
SCALE = {"stocks": 3.0, "big coins": 20.0, "swings": 10.0}   # the % that colours a heatmap cell fully
RULE = ("A rulebook is a <b>candidate</b> when it made money over the whole history test, made money in at least "
        "two thirds of its periods (quarters for big coins and stock swings, months for same-day stocks), had enough "
        f"trades (100 for same-day stocks, 10 for the others), and, unless it's a same-day stock desk, never fell more "
        f"than {MAX_DROP:g}% from a high. It's on <b>watch</b> when it made money overall or in at least half its "
        "periods, and it's a <b>cut</b> when it did neither.")


def group(book: pb.Book, d: str) -> str:
    """memecoins, big coins, swings (stocks on the coin engine's daily bars) or stocks (the same-day scanner)."""
    market = book.market(d)
    if market == "stocks" and book.kind(d) == "coins":
        return "swings"
    return market


def _read_csv(path: Path) -> List[dict]:
    try:
        with open(path, newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))
    except OSError:
        return []


def newest(folder: Path, demo: bool, need: str) -> Optional[Path]:
    """The newest finished backtest in a backtests folder (it has `need` and a summary), demo or real."""
    if not folder.is_dir():
        return None
    found = [p for p in folder.iterdir() if p.is_dir() and (p / need).exists() and (p / "summary.md").exists()
             and p.name.startswith("demo-") == demo]
    return max(found, key=lambda p: (p / "summary.md").stat().st_mtime) if found else None


def coin_result(folder: Path, bank: float) -> Optional[dict]:
    try:
        saved = json.loads((folder / "periods.json").read_text())
    except (OSError, ValueError):
        return None
    rows = saved.get("quarters") or saved.get("periods") or []
    trades = _read_csv(folder / "trades.csv")
    pnl = [float(t["pnl"]) for t in trades if t.get("pnl") not in (None, "")]
    eq, peak, drop = bank, bank, 0.0
    for p in pnl:
        eq += p
        peak = max(peak, eq)
        drop = max(drop, (peak - eq) / peak * 100 if peak > 0 else 0.0)
    total = 1.0
    for r in rows:
        total *= 1 + r["desk_pct"] / 100
    wins, losses = sum(p for p in pnl if p > 0), -sum(p for p in pnl if p < 0)
    return {
        "folder": str(folder), "first": saved.get("first", "")[:10], "last": saved.get("last", "")[:10],
        "trades": len(pnl), "net_pct": round((total - 1) * 100, 1), "hold_pct": saved.get("hold_pct"),
        "pf": None if not losses else round(wins / losses, 2), "drop": round(drop, 1),
        "periods": [{"period": r["period"], "value": r["desk_pct"], "hold": r["hold_pct"]} for r in rows],
    }


def stock_result(folder: Path) -> Optional[dict]:
    rows = _read_csv(folder / "journal.csv")
    graded = [r for r in rows if r.get("graded_at")]
    traded = [r for r in graded if r.get("sim_pnl_pct") not in (None, "")]
    if not graded:
        return None
    by_month: Dict[str, List[float]] = defaultdict(list)
    for r in traded:
        by_month[r["trade_date"][:7]].append(float(r["sim_pnl_pct"]))
    pnl = [float(r["sim_pnl_pct"]) for r in traded]
    wins, losses = sum(p for p in pnl if p > 0), -sum(p for p in pnl if p < 0)
    days = sorted(r["trade_date"] for r in graded)
    return {
        "folder": str(folder), "first": days[0], "last": days[-1], "trades": len(pnl),
        "untriggered": len(graded) - len(traded), "net_pct": round(mean(pnl), 2) if pnl else 0.0,
        "pf": None if not losses else round(wins / losses, 2), "drop": None, "hold_pct": None,
        "periods": [{"period": m, "value": round(mean(v), 2), "n": len(v)} for m, v in sorted(by_month.items())],
    }


FLAT = 0.05                     # a period that moved less than this (in %) was spent in cash: neither up nor down


def grade(market: str, r: Optional[dict]) -> tuple:
    """(status, why) by RULE, for a group (memecoins, big coins, swings, stocks). Periods spent flat in cash count
    as neither up nor down."""
    if market == "memecoins":
        return "live only", "brand-new coins can't be replayed; judged on live paper results"
    if not r:
        return "not tested", "no history test yet: run bash server/prove.sh"
    if not r["trades"]:
        return "no trades", "it never traded in this test, so there's nothing to judge yet"
    ps = r["periods"]
    up = sum(p["value"] > FLAT for p in ps)
    down = sum(p["value"] < -FLAT for p in ps)
    share = up / (up + down) if up + down else 0.0
    made = r["net_pct"] > 0
    enough = r["trades"] >= MIN_TRADES[market]
    calm = market == "stocks" or (r["drop"] or 0) < MAX_DROP
    unit = "months" if market == "stocks" else "quarters"
    what = "average a pick" if market == "stocks" else "over the test"
    why = f"{r['net_pct']:+g}% {what}, up in {up} and down in {down} of {len(ps)} {unit}"
    if made and share >= 2 / 3 and enough and calm:
        return "candidate", why
    if made or share >= 0.5:
        missing = [w for w, ok in (("too few trades", enough), ("not steady enough", share >= 2 / 3),
                                    (f"fell more than {MAX_DROP:g}%", calm), ("lost overall", made)) if not ok]
        return "watch", why + " · " + ", ".join(missing)
    return "cut", why


def data(book: pb.Book) -> dict:
    out = []
    for d in book.desks:
        g = group(book, d)
        r = None
        base = book.results.get(d)
        if base and g in ("big coins", "swings"):
            folder = newest(base / "backtests", book.demo, "periods.json")
            r = coin_result(folder, book.banks[d]) if folder else None
        elif base and g == "stocks":
            folder = newest(base / ("demo" if book.demo else "") / "backtests", False, "journal.csv")
            r = stock_result(folder) if folder else None
        status, why = grade(g, r)
        out.append({"key": d, "label": book.label(d), "market": book.market(d), "group": g, "color": book.color(d),
                    "status": status, "why": why, "result": r})
    order = {"candidate": 0, "watch": 1, "cut": 2, "no trades": 3, "not tested": 4, "live only": 5}
    out.sort(key=lambda x: (GROUPS.index(x["group"]), order[x["status"]],
                            -(x["result"] or {}).get("net_pct", -1e9)))
    return {"demo": book.demo, "updated": book.now.astimezone(book.tz).strftime("%a %d %b %Y, %H:%M %Z"), "desks": out,
            "weather": book.weather}


# -- the page ----------------------------------------------------------------------------------------------

CSS = """
.status { display: inline-block; padding: 1px 7px; border: 1px solid currentColor; border-radius: 3px;
  font: 700 10.5px/1.6 var(--display); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.s-candidate { color: var(--up); } .s-cut { color: var(--down); } .s-watch { color: var(--gold); }
.s-not-tested, .s-live-only, .s-no-trades { color: var(--muted); }
.heat td.c { text-align: right; min-width: 64px; font-weight: 500; }
.heat td.c small { display: block; color: var(--muted); font-weight: 400; font-size: 11px; }
.heat td.c.pos { background: color-mix(in srgb, var(--up) calc(var(--v) * 35%), var(--paper)); }
.heat td.c.neg { background: color-mix(in srgb, var(--down) calc(var(--v) * 35%), var(--paper)); }
.heat tbody tr { background: none !important; }
.heat tbody tr + tr td { border-top: 1px solid var(--rule); }
.heat th.desk, .heat td.desk { position: sticky; left: 0; background: var(--paper); z-index: 1; }
.heat td.desk i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: var(--c); margin-right: 7px; }
.rule { font-size: 14px; max-width: 72ch; margin: 14px 0 22px; }
.why { color: var(--muted); font-size: 12.5px; white-space: normal; min-width: 200px; }
.grades th[scope="row"] small { display: block; margin-top: 3px; font: 400 11px var(--mono); letter-spacing: 0;
  text-transform: none; color: var(--muted); white-space: nowrap; }
@media (max-width: 760px) { .tiles.even .tile:first-child { grid-column: auto; } }
"""


def _cell(p: Optional[dict], market: str) -> str:
    if p is None:
        return '<td class="c"></td>'
    v = p["value"]
    strength = min(1.0, abs(v) / SCALE[market])
    cls = "pos" if v > 0 else "neg" if v < 0 else ""
    sub = (f'<small>{p["n"]} picks</small>' if market == "stocks" else f'<small>held {p["hold"]:+.0f}%</small>')
    return f'<td class="c {cls}" style="--v:{strength:.2f}">{v:+.1f}%{sub}</td>'


def _heatmap(rows: List[dict], market: str) -> str:
    tested = [x for x in rows if x["result"]]
    if not tested:
        return ('<p class="empty">No history tests yet. On the server: <code>bash server/prove.sh</code>, then this '
                'page fills in on its next refresh.</p>')
    periods = sorted({p["period"] for x in tested for p in x["result"]["periods"]})
    e = html.escape
    head = "".join(f'<th class="n">{e(p)}</th>' for p in periods)
    body = []
    for x in tested:
        cells = {p["period"]: p for p in x["result"]["periods"]}
        body.append(f'<tr><td class="desk"><i style="--c:{x["color"]}"></i>{e(x["label"])}</td>'
                    + "".join(_cell(cells.get(p), market) for p in periods) + "</tr>")
    unit = "average result a pick, after costs" if market == "stocks" else "the desk's change in each quarter"
    held = {"big coins": "; below it, the same coins held", "swings": "; below it, the same stocks held"}.get(market, "")
    return (f'<p class="key">Each cell: {unit}{held}.</p>'
            f'<div class="scroll"><table class="heat"><thead><tr><th class="desk">Rulebook</th>{head}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


def _table(rows: List[dict], market: str) -> str:
    e = html.escape
    trs = []
    for x in rows:
        r = x["result"] or {}
        net = r.get("net_pct")
        net_txt = "—" if net is None else (f"{net:+.2f}% a pick" if market == "stocks" else f"{net:+.1f}%")
        extra = (f'{r.get("untriggered", 0)} untriggered' if market == "stocks" else
                 ("—" if r.get("hold_pct") is None else f'held {r["hold_pct"]:+.1f}%'))
        span = f'{r["first"]} → {r["last"]}' if r else "—"
        pf = "—" if not r or r.get("pf") is None else f'{r["pf"]:.2f}'
        status = x["status"]
        trs.append(f'<tr><th scope="row">{e(x["label"])}<small>{e(span)}</small></th><td><span class="status '
                   f's-{status.replace(" ", "-")}">{e(status)}</span></td><td class="n {pb._cls(net or 0)}">{net_txt}</td>'
                   f'<td class="n">{extra}</td><td class="n">{r.get("trades", "—") if r else "—"}</td><td class="n">{pf}</td>'
                   f'<td class="n">{"—" if not r or r.get("drop") is None else str(r["drop"]) + "%"}</td>'
                   f'<td class="why">{e(x["why"])}</td></tr>')
    return ('<div class="scroll"><table class="grades"><thead><tr><th>Rulebook</th><th>Status</th><th class="n">Result</th>'
            f'<th class="n">{"Never entered" if market == "stocks" else "Holding"}</th><th class="n">Trades</th>'
            '<th class="n">Profit factor</th><th class="n">Worst drop</th><th>Why</th></tr></thead>'
            f'<tbody>{"".join(trs)}</tbody></table></div>')


def render_html(payload: dict) -> str:
    e = html.escape
    by = defaultdict(list)
    for x in payload["desks"]:
        by[x.get("group", x["market"])].append(x)
    counts = defaultdict(int)
    for x in payload["desks"]:
        counts[x["status"]] += 1
    tiles = "".join(f'<div class="tile"><span>{e(s)}</span><b class="s-{s.replace(" ", "-")}">{counts[s]}</b></div>'
                    for s in ("candidate", "watch", "cut", "no trades", "not tested", "live only") if counts[s] or s != "no trades")
    demo = '<b>DEMO MARKETS · invented prices</b> · ' if payload["demo"] else ""
    sections = []
    for market, title in TITLES.items():
        if by[market]:
            sections.append(f'<section><h2>{title}</h2>{_table(by[market], market)}'
                            f'<div style="height:14px"></div>{_heatmap(by[market], market)}</section>')
    if by["memecoins"]:
        names = ", ".join(e(x["label"]) for x in by["memecoins"])
        sections.append(f'<section><h2>Memecoins</h2><p class="notes">{names}: brand-new coins can\'t be replayed, '
                        'because nobody keeps their history, so these are judged on their live paper results only. '
                        'See the deck\'s standings.</p></section>')
    w = payload.get("weather")
    weather_html = (f'<section><h2>Market weather now</h2>{weather.render_html(w)}<p class="notes">History tests say how a '
                    'rulebook did in each kind of market; the weather says which kind of market it is in today.</p>'
                    '</section>' if w else "")
    return f"""<title>Proving Ground</title>
{pb.FONTS}
<style>{pb.CSS}{CSS}{weather.CSS}</style>
<main class="sheet">
  <header class="top">
    <h1>Proving Ground</h1>
    <p class="stamp">{demo}paper money only · history tests · updated {e(payload["updated"])}</p>
  </header>
  <p class="rule">{RULE} Passing is necessary, not sufficient: a candidate still has to repeat it live, on paper,
  before anyone trusts it.</p>
  <div class="tiles{' even' if tiles.count('class="tile"') % 2 == 0 else ''}" style="--cols:{tiles.count('class="tile"')}">{tiles}</div>
  {weather_html}
  {"".join(sections)}
  <section class="notes">
    <h2>Read this before trusting any of it</h2>
    <p>History tests flatter: they fill at exact prices, miss some stocks that later delisted, and never get nervous.
    A rulebook that loses here will lose live. One that wins here has only earned a closer look.</p>
    <p>To refresh: on the server run <code>bash server/prove.sh</code>. It replays every running rulebook one at a time
    in the background (about an hour the first time, while it downloads history), and this page reads the results.</p>
  </section>
</main>
"""


def render_text(payload: dict) -> str:
    lines = [f"PROVING GROUND{' (DEMO markets)' if payload['demo'] else ''} · history tests · {payload['updated']}"]
    for x in payload["desks"]:
        if x["market"] == "memecoins":
            continue
        lines.append(f"  {x['status']:<10} {x['label'].lower():<26} {x['why']}")
    if weather.line(payload.get("weather")):
        lines.append("  " + weather.line(payload["weather"]))
    lines.append("  rule: made money overall, in 2/3 of its periods, with enough trades (and unless same-day: never fell 25%)")
    return "\n".join(lines)


def write(book: pb.Book, out: Path) -> dict:
    payload = data(book)
    out.mkdir(parents=True, exist_ok=True)
    (out / "proving.json").write_text(json.dumps(payload, indent=1), encoding="utf-8")
    frag = render_html(payload)
    (out / "proving.html").write_text(pb.page(frag), encoding="utf-8")
    (out / "proving.txt").write_text(render_text(payload) + "\n", encoding="utf-8")
    return payload
