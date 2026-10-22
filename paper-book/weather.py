"""Market weather: where the big trends stand right now, in a few plain numbers.

  trends    Bitcoin and the S&P 500 fund (SPY) against their 150-day averages, the line the trend desks use:
            above it they may hold, below it they wait in cash
  breadth   how many of the rush coins, the leader companies and the sector funds are above their own rulebook's
            average: a few means a narrow market where breakouts are rare and fail more often
  mood      the crypto Fear & Greed index (alternative.me, free, no key): a reading of the mood, not a signal

Prices come from the files the desks already keep (majors-desk/output/cache), so nothing extra is downloaded for
them. The Fear & Greed number is fetched at most every six hours and kept in output/feargreed.json; if it can't
be reached the rest still shows. In demo mode every number is invented and labelled so.
Paper money only. Nothing here is a forecast, and nothing here changes a desk.
"""
from __future__ import annotations

import gzip
import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10
    import tomli as tomllib  # type: ignore[no-redef]

HERE = Path(__file__).resolve().parent
MAJORS = HERE.parent / "majors-desk"
CACHE = MAJORS / "output" / "cache"
FNG_URL = "https://api.alternative.me/fng/?limit=1&format=json"
FNG_FILE = "feargreed.json"
FNG_EVERY = timedelta(hours=6)
FNG_STALE = timedelta(days=3)          # an older reading isn't shown
MOODS = ("Extreme fear", "Fear", "Neutral", "Greed", "Extreme greed")
TREND_DAYS = 150                       # the trend desks' line (majors-trend.toml, majors-index.toml)
TRENDS = (("Bitcoin", "BTC", "coin"), ("S&P 500 fund", "SPY", "stock"), ("Nasdaq-100 fund", "QQQ", "stock"))
BREADTH = (("rush coins", "rush"), ("leader companies", "leaders"), ("sector funds", "sectors"))
Fetch = Callable[[str], object]


def ema(values: List[float], n: int) -> float:
    """The desks' own average (majors/rules.py): exponential, weighted to the latest, started from the first."""
    k = 2 / (n + 1)
    e = values[0]
    for v in values[1:]:
        e = v * k + e * (1 - k)
    return e


def coin_closes(path: Path) -> List[tuple]:
    """(UTC date, close) for every finished day in an hourly Coinbase cache: the close of its 11pm hour."""
    try:
        rows = json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, ValueError, EOFError):
        return []
    if isinstance(rows, dict):                              # the cache's newer shape: {"v": 2, "rows": [...]}
        rows = rows.get("rows") or []
    out = {}
    for r in rows:
        t = datetime.fromtimestamp(r[0], timezone.utc)
        if t.hour == 23:
            out[t.date()] = float(r[4])
    return sorted(out.items())


def stock_closes(path: Path) -> List[tuple]:
    """(New York date, close) for every trading day in a daily Alpaca cache (majors/market.py AlpacaDaily)."""
    try:
        raw = json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, ValueError, EOFError):
        return []
    return [(datetime.fromtimestamp(r[0], timezone.utc).date(), float(r[4])) for r in raw.get("bars", [])]


def closes(symbol: str, kind: str, cache: Path, now: datetime) -> List[tuple]:
    got = coin_closes(cache / f"{symbol}-USD.json.gz") if kind == "coin" else stock_closes(cache / f"stock-{symbol}-1d.json.gz")
    today = now.astimezone(timezone.utc).date()
    return [(d, c) for d, c in got if d < today or kind == "coin" and d <= today]


def trend(series: List[tuple], days: int) -> Optional[dict]:
    """Where the last close sits against the `days` average, the desks' way (the last 2 × days closes), and
    since when it has been on that side."""
    if len(series) < 2 * days:
        return None
    values = [c for _, c in series]

    def side(i: int) -> bool:
        return values[i] > ema(values[i + 1 - 2 * days:i + 1], days)

    last = len(values) - 1
    avg = ema(values[last + 1 - 2 * days:], days)
    above = values[last] > avg
    i = last
    while i - 1 >= 2 * days - 1 and side(i - 1) == above and last - i < 400:
        i -= 1
    return {"last": values[last], "avg": round(avg, 6), "pct": round((values[last] / avg - 1) * 100, 1),
            "above": above, "since": series[i][0].isoformat(), "on": series[last][0].isoformat()}


def _rulebook(name: str) -> Optional[dict]:
    try:
        with open(MAJORS / f"majors-{name}.toml", "rb") as fh:
            return tomllib.load(fh)
    except (OSError, ValueError):
        return None


def breadth(name: str, book: str, cache: Path, now: datetime) -> Optional[dict]:
    """How many of a rulebook's symbols close above that rulebook's own trend average."""
    rb = _rulebook(book)
    if not rb:
        return None
    desk, rules = rb.get("desk", {}), rb.get("rules", {})
    kind = "stock" if desk.get("source") == "alpaca" else "coin"
    days = int(rules.get("trend_hours", 2400)) // 24
    up, seen = [], 0
    for sym in desk.get("coins", []):
        t = trend(closes(sym, kind, cache, now), days)
        if t:
            seen += 1
            if t["above"]:
                up.append(sym)
    if not seen or seen * 2 < len(desk.get("coins", [])):     # prices for under half the list: not a fair count
        return None
    return {"name": name, "book": book, "days": days, "up": len(up), "of": seen, "listed": len(desk.get("coins", [])),
            "symbols": up}


def fetch_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "paper-book/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read().decode())


def mood_word(value: int) -> str:
    return MOODS[0 if value <= 24 else 1 if value <= 44 else 2 if value <= 55 else 3 if value <= 75 else 4]


def fear_greed(out: Path, now: datetime, fetch: Optional[Fetch] = None) -> Optional[dict]:
    """{"value", "label", "date"}: the latest reading, fetched at most every six hours. Only a number from 0 to
    100 is kept from the answer; the label is worked out here from that number, never copied."""
    path = out / FNG_FILE
    try:
        saved = json.loads(path.read_text())
    except (OSError, ValueError):
        saved = None
    fetched = datetime.fromisoformat(saved["fetched"]) if saved and saved.get("fetched") else None
    if fetched is None or now - fetched >= FNG_EVERY:
        try:
            got = (fetch or fetch_json)(FNG_URL)
            row = got["data"][0]
            value = int(str(row["value"]).strip())
            if not 0 <= value <= 100:
                raise ValueError(value)
            day = datetime.fromtimestamp(int(row["timestamp"]), timezone.utc).date().isoformat()
            saved = {"value": value, "date": day, "fetched": now.isoformat()}
        except Exception:  # offline, rate-limited or a changed answer: keep the last good reading, try again later
            if saved:
                saved["fetched"] = now.isoformat()
        if saved:
            out.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(saved))
    if not saved or now.date() - date.fromisoformat(saved["date"]) > FNG_STALE:
        return None
    return {"value": saved["value"], "label": mood_word(saved["value"]), "date": saved["date"]}


def reading(w: dict) -> str:
    """One plain sentence on what the weather means for the desks. Never a forecast."""
    parts = []
    t = {x["symbol"]: x for x in w["trends"]}
    if "BTC" in t:
        parts.append("Bitcoin is above its 150-day average, so the coin trend desks may hold it" if t["BTC"]["above"]
                     else "Bitcoin is below its 150-day average, so the coin trend desks wait in cash")
    if "SPY" in t:
        parts.append("the S&P 500 fund is above its line, so the index desk may hold it" if t["SPY"]["above"]
                     else "the S&P 500 fund is below its line, so the index desk waits in cash")
    narrow = [b for b in w["breadth"] if b["of"] and b["up"] / b["of"] < 0.3]
    if narrow:
        parts.append("few " + " and ".join(b["name"] for b in narrow) + " are trending up, so breakouts are rare")
    if not parts:
        return "Not enough price history on this machine yet: it fills in as the desks run."
    s = "; ".join(parts)
    return s[0].upper() + s[1:] + "."


def load(out: Path, now: datetime, demo: bool = False, cache: Optional[Path] = None, fetch: Optional[Fetch] = None) -> dict:
    if demo:
        return invented(now)
    cache = cache or CACHE
    trends = []
    for name, sym, kind in TRENDS:
        t = trend(closes(sym, kind, cache, now), TREND_DAYS)
        if t:
            trends.append({"name": name, "symbol": sym, "days": TREND_DAYS, **t})
    w = {"demo": False, "trends": trends,
         "breadth": [b for b in (breadth(n, k, cache, now) for n, k in BREADTH) if b],
         "mood": fear_greed(out, now, fetch)}
    w["read"] = reading(w)
    return w


def invented(now: datetime) -> dict:
    """Demo weather: made-up numbers in the real shape, so the pages can be tried without any history."""
    on = now.date().isoformat()
    w = {"demo": True,
         "trends": [{"name": "Bitcoin", "symbol": "BTC", "days": TREND_DAYS, "last": 61200.0, "avg": 64950.0,
                     "pct": -5.8, "above": False, "since": (now.date() - timedelta(days=19)).isoformat(), "on": on},
                    {"name": "S&P 500 fund", "symbol": "SPY", "days": TREND_DAYS, "last": 512.4, "avg": 497.1,
                     "pct": 3.1, "above": True, "since": (now.date() - timedelta(days=64)).isoformat(), "on": on}],
         "breadth": [{"name": "rush coins", "book": "rush", "days": 50, "up": 4, "of": 20, "listed": 20, "symbols": []},
                     {"name": "leader companies", "book": "leaders", "days": 100, "up": 13, "of": 20, "listed": 20,
                      "symbols": []},
                     {"name": "sector funds", "book": "sectors", "days": 100, "up": 7, "of": 12, "listed": 12,
                      "symbols": []}],
         "mood": {"value": 31, "label": mood_word(31), "date": on}}
    w["read"] = reading(w)
    return w


def line(w: Optional[dict]) -> str:
    """The weather in one line, for the standings and the evening push."""
    if not w:
        return ""
    bits = [f"{t['symbol']} {t['pct']:+.1f}% vs its 150-day average ({'above' if t['above'] else 'below'} since "
            f"{date.fromisoformat(t['since']):%d %b})" for t in w["trends"]]
    if w["breadth"]:
        bits.append(", ".join(f"{b['up']}/{b['of']} {b['name']}" for b in w["breadth"]) + " trending up")
    if w.get("mood"):
        bits.append(f"fear & greed {w['mood']['value']} ({w['mood']['label'].lower()})")
    if not bits:
        return ""
    return ("weather (DEMO, invented): " if w["demo"] else "weather: ") + " · ".join(bits)


CSS = """
.weather { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 12px 0 6px; }
.weather .w { border: 1px solid var(--rule); border-radius: 4px; padding: 10px 12px; min-width: 0; }
.weather .w span { display: block; font: 600 10.5px/1.4 var(--display); letter-spacing: .08em; text-transform: uppercase;
  color: var(--muted); }
.weather .w b { display: block; font: 600 20px/1.3 var(--mono); font-variant-numeric: tabular-nums; margin-top: 3px; }
.weather .w small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
.weather .w .bar { height: 5px; border-radius: 3px; background: var(--rule); margin-top: 7px; overflow: hidden; }
.weather .w .bar i { display: block; height: 100%; background: var(--gold); }
.weather-read { font-size: 13.5px; max-width: 72ch; margin: 4px 0 0; }
"""


def render_html(w: Optional[dict]) -> str:
    """The weather as a row of small cards, for the proving page and the paper book."""
    import html

    if not w:
        return ""
    e = html.escape
    cards = []
    for t in w["trends"]:
        cls = "pos" if t["above"] else "neg"
        cards.append(f'<div class="w"><span>{e(t["name"])} vs 150-day</span><b class="{cls}">{t["pct"]:+.1f}%</b>'
                     f'<small>{"above" if t["above"] else "below"} since {date.fromisoformat(t["since"]):%d %b}</small></div>')
    for b in w["breadth"]:
        share = b["up"] / b["of"] if b["of"] else 0
        cards.append(f'<div class="w"><span>{e(b["name"])} trending up</span><b>{b["up"]}<small style="display:inline"> of '
                     f'{b["of"]}</small></b><small>above their {b["days"]}-day average</small>'
                     f'<div class="bar"><i style="width:{share * 100:.0f}%"></i></div></div>')
    m = w.get("mood")
    if m:
        cards.append(f'<div class="w"><span>Crypto fear &amp; greed</span><b>{m["value"]}</b><small>{e(m["label"])} · '
                     f'{date.fromisoformat(m["date"]):%d %b}</small><div class="bar"><i style="width:{m["value"]}%"></i>'
                     '</div></div>')
    if not cards:
        return ('<p class="weather-read">Market weather fills in once the desks have kept 300 days of prices on this '
                'machine (the trend desks fetch them on their first day).</p>')
    demo = "<b>DEMO, invented numbers.</b> " if w["demo"] else ""
    return (f'<div class="weather">{"".join(cards)}</div><p class="weather-read">{demo}{e(w["read"])} The fear &amp; greed '
            'number is a mood reading, not a signal: extreme fear has come before bounces and before further falls.</p>')
