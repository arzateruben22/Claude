"""Home: both apps on one screen, the first thing on port 8790. Pick one and go.

  Trading     every paper desk together: the paper profit so far, today, the best desk, the market weather and
              the next date the book is read on, with the deck, standings, proving ground, crawler, galaxy
              and book one tap away
  Post Desk   the X account: on air or not, the drafts waiting for you (with the first two), today's posts,
              the next slot and the followers, and a button to open its dashboard on port 8788

The trading numbers come from each refresh of the book (home.json). The Post Desk numbers come from the small
summary the running desk saves every half minute (post-desk/output/live/status.json), read when the page is
asked for, so the count of drafts waiting is never more than a minute old. The page reloads itself every minute
while it's open. It's readable without JavaScript, and it can be added to a phone's home screen as an app.
Paper money only; nothing here changes a desk or posts anything.
"""
from __future__ import annotations

import html
import json
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import paperbook as pb

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"
POST = HERE.parent / "post-desk" / "output"
STALE = timedelta(minutes=3)            # Post Desk saves every 30 s; three minutes of silence means it isn't running
ICONS = ("icon-180.png", "icon-512.png")
MANIFEST = {"name": "Desks", "short_name": "Desks", "start_url": "/", "scope": "/", "display": "standalone",
            "background_color": "#05070d", "theme_color": "#05070d",
            "description": "Paper trading desks and the X Post Desk, on your own server.",
            "icons": [{"src": "/icon-180.png", "sizes": "180x180", "type": "image/png"},
                      {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"}]}


# -- the numbers -----------------------------------------------------------------------------------------------

def trading(book: pb.Book) -> dict:
    """Every desk together, in a few numbers, for the Trading card."""
    import deck

    tz, now = book.tz, book.now
    today = now.astimezone(tz).date()
    trades = book.all_trades
    net = sum(t.pnl for t in trades)
    open_ = book.unrealized
    bank = book.bank_total
    closed_today = [t for t in trades if t.closed.astimezone(tz).date() == today]

    def ret(d: str) -> float:
        value = sum(t.pnl for t in book.trades[d]) + sum(h.value - h.cost for h in book.held[d] if h.value is not None)
        return value / book.banks[d] * 100 if book.banks[d] else 0.0

    active = [d for d in book.desks if book.trades[d] or book.held[d]]
    ranked = sorted(active, key=lambda d: (-ret(d), book.desks.index(d)))
    green = [book.label(d) for d in book.desks if deck.week(book, d, today)["green_week"]]
    upcoming = sorted((deck._as_date(when), label) for label, when in (book.checkpoints or {}).items()
                      if deck._as_date(when) and deck._as_date(when) >= today)
    w = book.weather or {}
    trends = {t["symbol"]: {"pct": t["pct"], "above": t["above"]} for t in w.get("trends", [])}
    return {
        "demo": book.demo, "updated": now.isoformat(), "tz": str(tz),
        "desks": len(book.desks), "bank": round(bank, 2), "net": round(net, 2), "open": round(open_, 2),
        "pct": round((net + open_) / bank * 100, 2) if bank else 0.0, "trades": len(trades),
        "holding": sum(len(book.held[d]) for d in book.desks),
        "today": {"pnl": round(sum(t.pnl for t in closed_today), 2), "closed": len(closed_today)},
        "best": {"label": book.label(ranked[0]), "pct": round(ret(ranked[0]), 1)} if ranked else None,
        "worst": ({"label": book.label(ranked[-1]), "pct": round(ret(ranked[-1]), 1)}
                  if len(ranked) > 1 else None),
        "idle": len(book.desks) - len(active), "green": green,
        "next": {"label": upcoming[0][1], "date": upcoming[0][0].isoformat()} if upcoming else None,
        "weather": {"btc": trends.get("BTC"), "spy": trends.get("SPY"), "mood": w.get("mood"),
                    "demo": bool(w.get("demo"))} if w else None,
    }


def post_desk(now: datetime, demo: bool = False, folder: Optional[Path] = None) -> dict:
    """The Post Desk card: {"state": "not set up" | "stopped" | "running", ...the desk's own summary}."""
    path = (folder or POST) / ("demo" if demo else "live") / "status.json"
    try:
        s = json.loads(path.read_text(encoding="utf-8"))
        updated = datetime.fromisoformat(s["updated"])
    except (OSError, ValueError, KeyError, TypeError):
        return {"state": "not set up", "demo": demo}
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    s["seen"] = updated.isoformat()
    if demo:
        s["state"] = "running"                # a demo snapshot is shown as it was, and labelled demo
    elif s.get("stopped") or now - updated > STALE:
        s["state"] = "stopped"
    else:
        s["state"] = "running"
    s["demo"] = demo
    try:
        s["port"] = int(s.get("port") or 8788)
    except (TypeError, ValueError):
        s["port"] = 8788
    return s


# -- the page --------------------------------------------------------------------------------------------------

FONTS = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Michroma&family=IBM+Plex+Mono:wght@400;'
         '500;600&family=Big+Shoulders+Display:wght@800;900&display=swap">')

CSS = """
:root {
  --void: #05070d; --void-2: #0a0e18; --rail: #1b2230; --rail-2: #2a3550;
  --ink: #e6ecf5; --ink-2: #b4bdcd; --dim: #8a95a8;
  --win: #5fe3a1; --loss: #ff6b78; --gold: #f2bd4f; --red: #ff3b30; --paper: #f2efe6;
  --display: "Michroma", "Eurostile", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  --post: "Big Shoulders Display", "Arial Narrow", Impact, sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--void); color: var(--ink); font: 13px/1.5 var(--mono);
  -webkit-font-smoothing: antialiased; }
.home { max-width: 980px; margin: 0 auto; padding: max(18px, env(safe-area-inset-top, 0px)) 16px
  max(22px, env(safe-area-inset-bottom, 0px)); display: grid; gap: 16px; }
.home > header { display: flex; align-items: baseline; justify-content: space-between; gap: 6px 16px; flex-wrap: wrap; }
.home h1 { margin: 0; font: 400 17px/1 var(--display); letter-spacing: .24em; text-transform: uppercase; }
.stamp { margin: 0; color: var(--dim); font-size: 11.5px; }
.stamp b { color: var(--gold); font-weight: 600; letter-spacing: .06em; }
.apps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 720px) { .apps { grid-template-columns: minmax(0, 1fr); } }
.app { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 12px; padding: 18px 18px 16px;
  background: var(--void-2); border: 1px solid var(--rail); border-radius: 14px; overflow: hidden; }
.app::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px; }
.trading::before { background: linear-gradient(90deg, transparent, var(--gold) 30%, var(--win) 70%, transparent); }
.post::before { background: var(--red); }
.app > header { display: flex; align-items: center; gap: 11px; min-width: 0; }
.icon { flex: none; width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; }
.icon svg { width: 100%; height: 100%; display: block; }
.app h2 { margin: 0; flex: 1; min-width: 0; }
.trading h2 { font: 400 13px/1.2 var(--display); letter-spacing: .2em; text-transform: uppercase; }
.post h2 { font: 900 22px/1 var(--post); letter-spacing: .05em; }
.post h2 b { color: var(--red); }
.state { font: 600 10.5px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; padding: 5px 7px;
  border-radius: 4px; border: 1px solid var(--rail-2); color: var(--ink-2); white-space: nowrap; }
.state.on { color: #fff; background: var(--red); border-color: var(--red); }
.state.ok { color: var(--win); border-color: rgba(95, 227, 161, .45); }
.state.off { color: var(--dim); }
.state.warn { color: var(--gold); border-color: rgba(242, 189, 79, .5); }
.big { margin: 2px 0 0; font: 600 34px/1.05 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.big small { font-size: 14px; font-weight: 500; color: var(--ink-2); letter-spacing: 0; }
.sub { margin: -6px 0 0; color: var(--ink-2); font-size: 12.5px; }
.up { color: var(--win); } .down { color: var(--loss); }
.facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
.facts div { min-width: 0; }
.facts dt { font: 400 8.5px/1.3 var(--display); letter-spacing: .16em; text-transform: uppercase; color: var(--dim); }
.facts dd { margin: 3px 0 0; font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.facts dd span, .line span { white-space: nowrap; }
.line { margin: 0; color: var(--ink-2); font-size: 12px; border-top: 1px solid var(--rail); padding-top: 10px; }
.line b { color: var(--ink); font-weight: 500; }
.drafts { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.drafts li { padding: 9px 11px; border-left: 2px solid var(--red); background: rgba(255, 255, 255, .03);
  border-radius: 0 8px 8px 0; font-size: 12.5px; color: var(--ink); overflow-wrap: anywhere; white-space: pre-line; }
.drafts li small { display: block; color: var(--dim); font-size: 10.5px; letter-spacing: .06em;
  text-transform: uppercase; margin-bottom: 3px; white-space: normal; }
.steps { margin: 0; padding-left: 20px; color: var(--ink-2); font-size: 12.5px; display: grid; gap: 4px; }
.steps code, .line code { color: var(--ink); font-family: var(--mono); }
.go { display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; padding-top: 2px; }
.go a { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; min-height: 40px;
  padding: 0 13px; border-radius: 9px;
  border: 1px solid var(--rail-2); color: var(--ink-2); text-decoration: none; font: 500 12.5px var(--mono); }
.go a:hover { color: var(--ink); border-color: var(--ink-2); }
.go a.primary { flex: 1 1 100%; justify-content: center; min-height: 48px; font-size: 14px; font-weight: 600;
  color: var(--void); border: 0; }
.trading .go a.primary { background: var(--gold); }
.post .go a.primary { background: var(--red); color: #fff; }
.go a:focus-visible { outline: 2px solid var(--paper); outline-offset: 3px; }
.home > footer { color: var(--dim); font-size: 11.5px; display: grid; gap: 4px; }
.home > footer p { margin: 0; max-width: 72ch; }
@media (prefers-reduced-motion: no-preference) { .app { transition: border-color .2s; } .app:hover { border-color: var(--rail-2); } }
"""

TRADING_ICON = ('<svg viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" fill="#0d1322"/>'
                '<path d="M6 24 L13 19 L18 21 L28 10" fill="none" stroke="#f2bd4f" stroke-width="2.6" '
                'stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="10" r="2.6" fill="#5fe3a1"/></svg>')
POST_ICON = ('<svg viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" fill="#15171c"/>'
             '<circle cx="17" cy="17" r="9" fill="none" stroke="#f2efe6" stroke-width="2.6"/>'
             '<circle cx="17" cy="17" r="4.6" fill="#ff3b30"/></svg>')


def _usd(v: float) -> str:
    return ("+" if v > 0 else "−" if v < 0 else "") + f"${abs(v):,.2f}"


def _pct(v: float) -> str:
    return ("+" if v > 0 else "−" if v < 0 else "") + f"{abs(v):.1f}%"


def _cls(v: float) -> str:
    return "up" if v > 0 else "down" if v < 0 else ""


def _when(iso: str, tz: ZoneInfo, now: datetime) -> str:
    t = datetime.fromisoformat(iso).astimezone(tz)
    return f"{t:%H:%M}" if t.date() == now.astimezone(tz).date() else f"{t:%a %d %b %H:%M}"


def _trading_card(t: Optional[dict], tz: ZoneInfo, now: datetime) -> str:
    e = html.escape
    links = ('<nav class="go" aria-label="Trading views"><a class="primary" href="/deck">Open the Trading Deck</a>'
             '<a href="/standings">standings</a><a href="/proving">proving</a><a href="/crawler">crawler</a>'
             '<a href="/galaxy">galaxy</a><a href="/book">book</a></nav>')
    head = (f'<header><span class="icon">{TRADING_ICON}</span><h2 id="h-trading">Trading</h2>'
            f'<span class="state {"warn" if t and t["demo"] else "ok"}">'
            f'{"demo prices" if t and t["demo"] else (str(t["desks"]) + " desks") if t else "starting"}</span></header>')
    if not t:
        return (f'<article class="app trading" aria-labelledby="h-trading">{head}<p class="sub">The book hasn\'t been '
                f'built yet. It refreshes every 15 minutes.</p>{links}</article>')
    total = t["net"] + t["open"]
    best = t["best"]
    facts = [("today", f'<span class="{_cls(t["today"]["pnl"])}">{e(_usd(t["today"]["pnl"]))}</span> · '
                       f'{t["today"]["closed"]} closed'),
             ("open now", f'{t["holding"]} position{"s" if t["holding"] != 1 else ""} · '
                          f'<span class="{_cls(t["open"])}">{e(_usd(t["open"]))}</span>'),
             ("best so far", f'{e(best["label"])} <span class="{_cls(best["pct"])}">{e(_pct(best["pct"]))}</span>'
              if best else "no trades yet"),
             ("green week", e(", ".join(t["green"][:2]) + (f" +{len(t['green']) - 2}" if len(t["green"]) > 2 else ""))
              if t["green"] else "none yet")]
    dl = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts)
    bits = []
    w = t.get("weather") or {}
    for key, name in (("btc", "BTC"), ("spy", "SPY")):
        x = w.get(key)
        if x:
            bits.append(f'<b>{name}</b> {"above" if x["above"] else "below"} its 150-day line '
                        f'<span class="{_cls(x["pct"])}">{e(_pct(x["pct"]))}</span>')
    if w.get("mood"):
        bits.append(f'<b>fear &amp; greed</b> {int(w["mood"]["value"])} ({e(str(w["mood"]["label"]).lower())})')
    weather = f'<p class="line">{" · ".join(bits)}</p>' if bits else ""
    nxt = ""
    if t.get("next"):
        day = date.fromisoformat(t["next"]["date"])
        left = (day - now.astimezone(tz).date()).days
        when = "today" if left == 0 else "tomorrow" if left == 1 else f"in {left} days"
        nxt = f'<p class="line"><b>{e(t["next"]["label"])}</b> {day:%a %d %b} · {when}</p>'
    return (f'<article class="app trading" aria-labelledby="h-trading">{head}'
            f'<p class="big {_cls(total)}">{e(_usd(total))}</p>'
            f'<p class="sub">{e(_pct(t["pct"]))} of ${t["bank"]:,.0f} paper · {t["trades"]:,} trades · '
            f'{t["desks"]} desks{" · " + str(t["idle"]) + " yet to trade" if t["idle"] else ""}</p>'
            f'<dl class="facts">{dl}</dl>{weather}{nxt}{links}</article>')


def _post_card(p: dict, host: str, tz: ZoneInfo, now: datetime) -> str:
    e = html.escape
    url = f"http://{host}:{p.get('port', 8788)}/"
    state = p["state"]
    pill = {"running": (p.get("pill") or "RUNNING"), "stopped": "STOPPED", "not set up": "NOT CONNECTED"}[state]
    cls = "on" if pill == "ON AIR" else "warn" if state != "running" or pill in ("PAUSED", "HOLD") else "off"
    if p.get("demo"):
        pill, cls = "DEMO", "warn"
    head = (f'<header><span class="icon">{POST_ICON}</span><h2 id="h-post">POST<b>DESK</b></h2>'
            f'<span class="state {cls}">{e(pill)}</span></header>')
    button = f'<nav class="go" aria-label="Post Desk"><a class="primary" href="{e(url)}">Open Post Desk</a></nav>'
    if state == "not set up":
        return (f'<article class="app post" aria-labelledby="h-post">{head}'
                '<p class="big">Not connected</p><p class="sub">Your X account isn\'t connected yet. Three steps on '
                'the server:</p><ol class="steps"><li><code>bash server/keys.sh</code>: the X and Claude keys, and '
                'your handle</li><li><code>bash server/connect-x.sh</code>: approve the desk on X</li>'
                '<li><code>sudo bash server/setup.sh</code>: it starts, and this card fills in</li></ol>'
                '<p class="line">Nothing posts until you approve it.</p></article>')
    waiting = int(p.get("waiting") or 0)
    f7 = int(p.get("followers_7d") or 0)
    facts = [("account", f'@{e(p.get("handle") or "—")}'),
             ("posted today", f'{int(p.get("posts_today") or 0)} of {int(p.get("slots_today") or 0)}'),
             ("next post", e(p.get("next_at") or "—") + (" · ready" if p.get("ready") else "")),
             ("followers", f'{int(p.get("followers") or 0):,}' +
              (f' <span class="{_cls(f7)}">{"+" if f7 > 0 else ""}{f7:,} this week</span>' if f7 else "")),
             ("views, 7 days", f'{int(p.get("views_7d") or 0):,}'),
             ("approved", f'{int(p.get("ready") or 0)} ready to post')]
    dl = "".join(f"<div><dt>{k}</dt><dd>{v}</dd></div>" for k, v in facts)
    drafts = ""
    if p.get("preview"):
        items = "".join(f'<li><small>{e(str(x.get("format", "")).replace("_", " "))}</small>{e(x.get("text", ""))}</li>'
                        for x in p["preview"][:2])
        drafts = f'<ul class="drafts" aria-label="The first drafts waiting for you">{items}</ul>'
    note = ""
    if state == "stopped":
        note = (f'<p class="line"><b>Not running</b> since {e(_when(p["seen"], tz, now))}. On the server: '
                '<code>sudo systemctl restart postdesk</code></p>')
    elif p.get("writer_error"):
        note = f'<p class="line"><b>Writer:</b> {e(str(p["writer_error"])[:160])}</p>'
    return (f'<article class="app post" aria-labelledby="h-post">{head}'
            f'<p class="big">{waiting}<small> draft{"s" if waiting != 1 else ""} waiting for you</small></p>'
            f'<p class="sub">{"approve them to post" if waiting else "nothing to approve right now"} · '
            f'{e(str(p.get("approval", "review")).replace("_", " "))} mode</p>'
            f'<dl class="facts">{dl}</dl>{drafts}{note}{button}</article>')


def render(t: Optional[dict], p: dict, host: str = "127.0.0.1", now: Optional[datetime] = None) -> str:
    """The page body (title, styles and both cards), without the document skeleton."""
    now = now or datetime.now(timezone.utc)
    tz = ZoneInfo(t["tz"]) if t else ZoneInfo("America/Los_Angeles")
    demo = '<b>DEMO</b> · ' if (t and t["demo"]) or p.get("demo") else ""
    return f"""<title>Desks</title>
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#05070d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Desks">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="icon" href="/icon-180.png">
{FONTS}
<style>{CSS}</style>
<main class="home">
  <header>
    <h1>Desks</h1>
    <p class="stamp">{demo}paper money only · {now.astimezone(tz):%a %d %b, %H:%M}</p>
  </header>
  <section class="apps" aria-label="Your apps">
    {_trading_card(t, tz, now)}
    {_post_card(p, host, tz, now)}
  </section>
  <footer>
    <p>Both run on your own server. Only devices signed in to your Tailscale (or an ssh tunnel) can open them.</p>
    <p>On a phone, add this page to the home screen (Share, then Add to Home Screen) and it opens like an app.</p>
  </footer>
</main>
<script>setInterval(() => {{ if (!document.hidden) location.reload(); }}, 60000);</script>
"""


def page(fragment: str) -> str:
    return pb.page(fragment)


def serve(out: Path, host: str, now: Optional[datetime] = None) -> bytes:
    """The home page for one request: the book's last numbers and Post Desk's latest summary, linked on `host`."""
    now = now or datetime.now(timezone.utc)
    try:
        t = json.loads((out / "home.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        t = None
    p = post_desk(now, demo=bool(t and t["demo"]))
    return page(render(t, p, host, now)).encode("utf-8")


def write(book: pb.Book, out: Path) -> dict:
    t = trading(book)
    out.mkdir(parents=True, exist_ok=True)
    (out / "home.json").write_text(json.dumps(t, indent=1), encoding="utf-8")
    frag = render(t, post_desk(book.now, book.demo), now=book.now)
    (out / "home.fragment.html").write_text(frag, encoding="utf-8")
    (out / "home.html").write_text(page(frag), encoding="utf-8")
    (out / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=1), encoding="utf-8")
    for name in ICONS:                               # the app icon, for a phone's home screen
        src = WEB / name
        if src.exists() and (not (out / name).exists() or (out / name).stat().st_size != src.stat().st_size):
            shutil.copyfile(src, out / name)
    return t
