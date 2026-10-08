"""The watchlist as a web page: one self-contained HTML file per scan.

Open output/latest.html in any browser. It also works as a phone attachment
(see notify.py). Everything is inline except two Google Fonts, which fall
back to system fonts when offline. All text from outside sources (headlines,
names) is escaped; only http(s) links are kept.
"""
from __future__ import annotations

from html import escape

from . import fmt
from .config import Criteria
from .market import fmt_pt
from .models import Candidate, ScanResult

TITLES = {"premarket": "Pre-market Watchlist", "regular": "Market-hours Watchlist",
          "afterhours": "After-hours Watchlist"}
EYEBROW = {"premarket": "Pre-market scan", "regular": "Market-hours scan", "afterhours": "Night-before scan"}
HIGH_LABEL = {"premarket": "PM high", "regular": "Day high", "afterhours": "AH high"}
TAG_LABEL = {"fda": "FDA", "crypto_ai": "AI / crypto"}

FONTS = ("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600"
         "&family=Martian+Mono:wght@400;600&display=swap")

CSS = """
/* Layout: a quote board. Header and rules up top, picks as tickets in a
   two-column grid, near misses as a plain table, notes at the foot. */
:root {
  --ground: #f4f5fa; --surface: #ffffff; --ink: #151a2d; --ink-soft: #565d75;
  --line: #dcdfea; --accent: #4447c2; --chip: #ecedf6;
  --up: #0c7442; --up-bg: #e2f3e9; --down: #b1202e; --warn: #7f5200; --warn-bg: #fff1cf;
  --f-data: "Martian Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --f-text: "Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --ground: #0d1120; --surface: #161b2e; --ink: #e8eaf4; --ink-soft: #9da4bf;
  --line: #29304f; --accent: #a4a8ff; --chip: #232a4a;
  --up: #52e09d; --up-bg: #11321f; --down: #ff808b; --warn: #f4c552; --warn-bg: #372b0e;
  color-scheme: dark; } }
:root[data-theme="dark"] {
  --ground: #0d1120; --surface: #161b2e; --ink: #e8eaf4; --ink-soft: #9da4bf;
  --line: #29304f; --accent: #a4a8ff; --chip: #232a4a;
  --up: #52e09d; --up-bg: #11321f; --down: #ff808b; --warn: #f4c552; --warn-bg: #372b0e;
  color-scheme: dark; }

* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 15px/1.5 var(--f-text); }
.wrap { max-width: 1040px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 48px;
        display: grid; gap: 28px; }
.wrap > * { min-width: 0; }
a { color: var(--accent); text-underline-offset: 2px; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }
.num { font-family: var(--f-data); font-variant-numeric: tabular-nums; }

.top { display: grid; gap: 6px; }
.eyebrow { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
           font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); }
.badge { background: var(--warn-bg); color: var(--warn); border-radius: 4px; padding: 1px 6px; letter-spacing: .04em; }
h1 { margin: 0; font: 600 clamp(22px, 4vw, 30px)/1.2 var(--f-text); text-wrap: balance; }
.meta { margin: 0; color: var(--ink-soft); font-size: 14px; }

.summary { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 0; padding: 0; list-style: none; }
.summary li { display: flex; align-items: baseline; gap: 8px; color: var(--ink-soft); font-size: 14px; }
.summary b { font: 600 20px/1 var(--f-data); color: var(--ink); }
.rules { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.rules li { background: var(--chip); border-radius: 999px; padding: 2px 10px; font-size: 13px; }

h2 { margin: 0 0 12px; font-size: 13px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
     color: var(--ink-soft); }
.picks { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); }
.pick { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px;
        display: grid; gap: 14px; min-width: 0; align-content: start; }
.pick-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.who { display: grid; gap: 2px; min-width: 0; }
.sym-row { display: flex; align-items: baseline; gap: 10px; }
.rank { font: 600 12px/1 var(--f-data); color: var(--ink-soft); }
.sym { margin: 0; font: 600 22px/1.1 var(--f-data); letter-spacing: .02em; }
.name { color: var(--ink-soft); font-size: 13px; overflow-wrap: anywhere; }
.move { text-align: right; display: grid; gap: 2px; flex-shrink: 0; }
.gap { font: 600 22px/1.1 var(--f-data); }
.up { color: var(--up); } .down { color: var(--down); }
.px { font-size: 13px; color: var(--ink-soft); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 12px; margin: 0;
         padding-top: 12px; border-top: 1px solid var(--line); }
.stats div { display: grid; gap: 1px; min-width: 0; }
.stats dt { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); }
.stats dd { margin: 0; font: 400 15px/1.3 var(--f-data); font-variant-numeric: tabular-nums; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: var(--up-bg); color: var(--up); border-radius: 4px; padding: 1px 8px; font-size: 13px; font-weight: 500; }
.chip.warn { background: var(--warn-bg); color: var(--warn); }
.chip.none { background: var(--chip); color: var(--ink-soft); }
.news { margin: 0; display: grid; gap: 2px; overflow-wrap: anywhere; }
.news a { font-weight: 500; }
.src { font-size: 13px; color: var(--ink-soft); }
.warns { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.warns li { background: var(--warn-bg); color: var(--warn); border-radius: 6px; padding: 6px 10px; font-size: 13px; }

.empty { background: var(--surface); border: 1px dashed var(--line); border-radius: 10px; padding: 20px; margin: 0; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; min-width: 520px; font-size: 14px; }
th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
     color: var(--ink-soft); padding: 6px 12px 6px 0; border-bottom: 1px solid var(--line); }
td { padding: 8px 12px 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
td.num, th.num { text-align: right; }
td.miss { color: var(--ink-soft); }
td.sym-cell { font: 600 14px/1.5 var(--f-data); }

.foot { display: grid; gap: 6px; color: var(--ink-soft); font-size: 13px; }
.foot p { margin: 0; max-width: 70ch; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
"""

SCRIPT = """
(function () {
  var root = document.querySelector("[data-generated]"), out = document.querySelector("[data-age]");
  function age() {
    var m = Math.round((Date.now() - Date.parse(root.getAttribute("data-generated"))) / 60000);
    out.textContent = m < 1 ? "just now" : m < 90 ? m + " min ago" : m < 2880 ? Math.round(m / 60) + " h ago"
      : Math.round(m / 1440) + " days ago";
  }
  if (root && out) { age(); setInterval(age, 30000); }
  // Opened from your computer: pick up the next scan automatically.
  if (location.protocol === "file:") setTimeout(function () { location.reload(); }, 300000);
})();
"""


def _e(text) -> str:
    return escape(str(text), quote=True)


def _link(url: str, text: str) -> str:
    if url.startswith(("https://", "http://")):
        return f'<a href="{_e(url)}" target="_blank" rel="noopener noreferrer">{_e(text)}</a>'
    return _e(text)


def _tag(t: str, warned: bool) -> str:
    label = TAG_LABEL.get(t, t.replace("_", " "))
    return f'<span class="chip warn">⚠ {_e(label)}</span>' if warned else f'<span class="chip">{_e(label)}</span>'


def _pick(i: int, c: Candidate, session: str) -> str:
    m = c.metrics
    sid = f"p-{_e(c.symbol)}"
    direction = "up" if m.gap_pct >= 0 else "down"
    stats = [
        ("RVOL", f"{m.rvol:.1f}x"),
        ("Volume", fmt.shares(m.session_volume)),
        ("Float", fmt.shares(c.float_shares)),
        ("Spread", "?" if c.spread_pct is None else f"{c.spread_pct:.1f}%"),
        (HIGH_LABEL[session], fmt.money(m.session_high)),
        ("Avg vol", fmt.shares(m.avg_daily_volume)),
    ]
    tags = "".join(_tag(t, f"{t} headline" in c.warnings) for t in c.tags) or \
        ('<span class="chip">news</span>' if c.news else '<span class="chip none">no catalyst tag</span>')
    if c.news:
        n = c.news[0]
        news = (f'<p class="news">{_link(n.url, n.headline)}'
                f'<span class="src">{_e(n.source or "News")} · {_e(fmt_pt(n.published))}</span></p>')
    else:
        news = '<p class="news src">No headline found in the lookback window.</p>'
    warns = [w for w in c.warnings if not w.endswith(" headline")]
    warn_html = ("<ul class=\"warns\">" + "".join(f"<li>⚠ {_e(w)}</li>" for w in warns) + "</ul>") if warns else ""
    return f"""
<article class="pick" aria-labelledby="{sid}">
  <div class="pick-top">
    <div class="who">
      <div class="sym-row"><span class="rank">#{i}</span><h3 class="sym" id="{sid}">{_e(c.symbol)}</h3></div>
      <span class="name">{_e(c.name)}</span>
    </div>
    <div class="move">
      <span class="gap {direction}">{_e(fmt.pct(m.gap_pct))}</span>
      <span class="px"><span class="num">{_e(fmt.money(m.price))}</span> from {_e(fmt.money(m.ref_close))}</span>
    </div>
  </div>
  <dl class="stats">{"".join(f"<div><dt>{_e(k)}</dt><dd>{_e(v)}</dd></div>" for k, v in stats)}</dl>
  <div class="tags">{tags}</div>
  {news}
  {warn_html}
</article>"""


def _near(res: ScanResult) -> str:
    if not res.near_misses:
        return ""
    rows = "".join(
        f"<tr><td class=\"sym-cell\">{_e(c.symbol)}</td>"
        f"<td class=\"num\">{_e(fmt.money(c.metrics.price))}</td>"
        f"<td class=\"num {'up' if c.metrics.gap_pct >= 0 else 'down'}\">{_e(fmt.pct(c.metrics.gap_pct))}</td>"
        f"<td class=\"num\">{c.metrics.rvol:.1f}x</td><td class=\"miss\">✗ {_e(c.failures[0])}</td></tr>"
        for c in res.near_misses
    )
    return f"""
<section aria-labelledby="near">
  <h2 id="near">Near misses: one rule short</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Symbol</th><th class="num">Price</th><th class="num">Gap</th><th class="num">RVOL</th>
    <th>Missed on</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
</section>"""


def _head(res: ScanResult) -> str:
    return (f"<title>{_e(TITLES[res.session])}</title>\n"
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            f'<link rel="stylesheet" href="{FONTS}">\n<style>{CSS}</style>\n')


def _content(res: ScanResult, crit: Criteria) -> str:
    demo = '<span class="badge">Demo data · fake tickers</span>' if res.provider == "demo" else ""
    delay = f" · data delayed ~{res.delay_minutes} min" if res.delay_minutes else ""
    rules = [r.replace(">=", "≥").replace("<=", "≤").replace("-$", "–$") for r in crit.summary().split(" · ")]
    if res.passed:
        picks = '<div class="picks">' + "".join(_pick(i, c, res.session) for i, c in enumerate(res.passed, 1)) + "</div>"
    else:
        picks = ('<p class="empty">Nothing passes every rule right now. Check the near misses below, '
                 "or run the scan again closer to the open.</p>")
    notes = "".join(f"<p>{_e(n)}</p>" for n in res.notes)
    return f"""<main class="wrap" data-generated="{_e(res.now.isoformat())}">
  <header class="top">
    <p class="eyebrow">{_e(EYEBROW[res.session])} {demo}</p>
    <h1>{_e(fmt_pt(res.now))}</h1>
    <p class="meta">Source: {_e(res.provider)}{_e(delay)} · updated <span data-age>{_e(fmt_pt(res.now))}</span></p>
  </header>
  <ul class="summary" aria-label="Scan summary">
    <li><b>{len(res.passed)}</b> pick{"s" if len(res.passed) != 1 else ""}</li>
    <li><b>{len(res.near_misses)}</b> near miss{"es" if len(res.near_misses) != 1 else ""}</li>
    <li><b>{res.universe:,}</b> stocks screened</li>
    <li><b>{res.checked}</b> checked closely</li>
  </ul>
  <ul class="rules" aria-label="Rules">{"".join(f"<li>{_e(r)}</li>" for r in rules)}</ul>
  <section aria-labelledby="picks-h">
    <h2 id="picks-h">Picks, biggest {"gap" if crit.sort_by == "gap" else crit.sort_by} first</h2>
    {picks}
  </section>
  {_near(res)}
  <footer class="foot">
    {notes}
    <p>Watchlist, not advice. Small caps move fast both ways; paper trade first.</p>
    <p>Gap is measured from the last regular close. RVOL compares this session's volume with a normal day at the same time.</p>
  </footer>
</main>
<script>{SCRIPT}</script>
"""


def fragment(res: ScanResult, crit: Criteria) -> str:
    """Head bits + content, for hosts that supply their own html/head/body shell."""
    return _head(res) + _content(res, crit)


def page(res: ScanResult, crit: Criteria) -> str:
    """Complete HTML document for opening as a file."""
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f"{_head(res)}</head>\n<body>\n{_content(res, crit)}</body>\n</html>\n")
