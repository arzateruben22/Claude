"""Lumevina Growth Blueprint — dark, Apple-style edition.

Builds two files from one set of content:
  web.html   — scrolling page with live motion (network, phone, chart)
  print.html — five Letter pages, same design frozen, printed to PDF

Run:  python3 build.py            (writes both into OUT)
The screenshots in shots/ are real captures of the Lumevina site.
"""
import base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else HERE
FONT = os.path.join(HERE, "inter-var.woff2")


def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


SHOT = {n: "data:image/jpeg;base64," + b64(os.path.join(HERE, "shots", n + "-s.jpg"))
        for n in ("home", "book", "rewards", "dash")}

# ─────────────────────────── the numbers ───────────────────────────
# Added profit per month by month-from-now, for the three cases.
S1 = {"low": 1670, "likely": 3670, "high": 6250}        # your chair, once ramped
PILOT = {"low": 1420, "likely": 2840, "high": 4760}     # 2 artists, net
COLL = {"low": 1100, "likely": 4100, "high": 8140}     # 6–8 artists, net


def added(m, k):
    s1 = S1[k] * min(m / 9.0, 1.0)
    p, q = PILOT[k], COLL[k]
    dip = p - 3000                                       # lease starts before suites fill
    if m < 6:
        art = 0
    elif m <= 12:
        art = p * (m - 6) / 6.0
    elif m < 15:
        art = p
    elif m <= 16:
        art = p + (dip - p) * (m - 15)
    elif m <= 30:
        art = dip + (q - dip) * (m - 16) / 14.0
    else:
        art = q
    return s1 + art


def chart_svg():
    X0, X1, Y0, Y1, YMAX = 56, 784, 292, 24, 18000
    x = lambda m: X0 + (X1 - X0) * m / 36.0
    y = lambda v: Y0 - (Y0 - Y1) * max(v, 0) / YMAX
    ms = [i / 2.0 for i in range(73)]
    hi = " ".join("%.1f,%.1f" % (x(m), y(added(m, "high"))) for m in ms)
    lo = " ".join("%.1f,%.1f" % (x(m), y(added(m, "low"))) for m in reversed(ms))
    lk = "M" + " L".join("%.1f,%.1f" % (x(m), y(added(m, "likely"))) for m in ms)
    stages = [(0, 6, "Your chair"), (6, 15, "Pilot"), (15, 36, "Collective")]
    parts = ['<svg class="chart" viewBox="0 0 800 330" role="img" '
             'aria-label="Added profit per month over three years. Likely case rises to about $7,800 a month by year three; '
             'the range runs from about $2,800 to $14,400.">']
    for i, (a, b, name) in enumerate(stages):
        parts.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" class="st st%d"/>'
                     % (x(a), Y1 - 8, x(b) - x(a), Y0 - Y1 + 8, i))
        parts.append('<text x="%.1f" y="%d" class="stl">%s</text>' % (x(a) + 8, Y1 + 8, name))
    for v in (5000, 10000, 15000):
        parts.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" class="grid"/>' % (X0, X1, y(v), y(v)))
        parts.append('<text x="%d" y="%.1f" class="yl">$%dk</text>' % (X0 - 10, y(v) + 4, v // 1000))
    parts.append('<line x1="%d" x2="%d" y1="%d" y2="%d" class="base"/>' % (X0, X1, Y0, Y0))
    for m, lab in ((0, "Now"), (6, "6 mo"), (12, "Year 1"), (24, "Year 2"), (36, "Year 3")):
        anchor = "start" if m == 0 else ("end" if m == 36 else "middle")
        parts.append('<text x="%.1f" y="%d" class="xl" text-anchor="%s">%s</text>' % (x(m), Y0 + 22, anchor, lab))
    parts.append('<polygon class="band" points="%s %s"/>' % (hi, lo))
    parts.append('<path class="likely" pathLength="1" d="%s"/>' % lk)
    ex, ey = x(36), y(added(36, "likely"))
    parts.append('<circle class="endpt" cx="%.1f" cy="%.1f" r="5"/>' % (ex, ey))
    parts.append('<text class="endl" x="%.1f" y="%.1f" text-anchor="end">$7.8k a month</text>' % (ex - 12, ey - 14))
    parts.append('</svg>')
    return "".join(parts)


CHART = chart_svg()

# ─────────────────────────── shared content ───────────────────────────
STEPS = [
    ("1", "Grow your chair", "Months 0–6", "Membership, add-ons and filling empty hours. More from every hour you already work."),
    ("2", "Pilot two artists", "Months 6–12", "Two licensed lash or brow artists book through Lumevina. We measure one thing: do their clients book you?"),
    ("3", "The Collective", "Year 2–3", "Six to eight artists, one space, one app, one rewards program. Only if the pilot worked."),
]

FLOW = [
    ("A client books a lash fill", "in the Lumevina app."),
    ("The artist is paid directly.", "They run their own business."),
    ("Lumevina keeps 12%.", "Automatically, on every booking."),
    ("Glow points bring the client", "to Evelyn for a facial."),
]

BUILT = [
    (True, "Online booking with 50% deposits"),
    (True, "Glow Rewards, referrals, birthday perks"),
    (True, "Gift certificates"),
    (True, "Client accounts, intake and consent forms"),
    (True, "Owner dashboard, invoices, tax export"),
    (True, "Installs on any phone’s home screen"),
    (False, "Live payments and database · a few days"),
    (False, "Multi-artist booking and payouts · the Stage 2 build"),
]

CHAIR = [("Glow Membership", "$1,500", "$600–$3,000"),
         ("Add-ons at booking", "$800", "$500–$1,100"),
         ("Flash openings", "$960", "$480–$1,440"),
         ("Retail + auto-refill", "$700", "$300–$1,500"),
         ("Referrals", "$600", "$300–$900")]
CHAIR_TOTAL = ("Added revenue", "$4,560", "$2,180–$7,940")

COLLECTIVE = [("Platform fees · 7 artists", "$5,600", "$3,600–$8,640"),
              ("Their clients booking you", "$4,000", "$2,500–$6,000"),
              ("Space and running costs", "−$5,500", "−$5,000–$6,500")]
COLL_TOTAL = ("Net to Lumevina", "$4,100", "$1,100–$8,140")

GUARD = [
    ("Licensed only.", "Every artist holds a California license and works in a licensed space."),
    ("Their own business.", "Artists set their prices and are paid directly, which keeps California’s AB5 employee rules on our side. An attorney signs off first."),
    ("Pilot before lease.", "No new space until two artists prove their clients also book Evelyn."),
    ("Clear roles.", "Evelyn owns the brand and the standard of care. Ruben runs operations, the app and the numbers."),
]

COSTS = [("Live payments", "2.9% + 30¢ per payment"),
         ("Database and texts", "About $35 a month"),
         ("Attorney", "$300–$600 consult; agreements $1.5k–$5k"),
         ("App Store", "$99 a year, at Stage 2")]

DAYS = [("Week 1", "Write down today’s numbers from Acuity: bookings, repeat clients, no-shows, average ticket."),
        ("Weeks 2–3", "Switch on live payments. Move booking from Acuity to Lumevina."),
        ("Week 4", "Launch Glow Membership and add-ons."),
        ("Month 2", "One-hour attorney consult on how artists are set up."),
        ("Month 3", "Bring in one licensed lash or brow artist. Track how many of their clients book you.")]


def rows(items, total):
    h = ['<div class="rows">']
    for name, v, rng in items:
        h.append('<div class="row"><span class="rn">%s</span><span class="rv">%s</span><span class="rr">%s</span></div>' % (name, v, rng))
    h.append('<div class="row tot"><span class="rn">%s</span><span class="rv">%s</span><span class="rr">%s</span></div>' % total)
    h.append('</div>')
    return "".join(h)


def built_list():
    return "".join('<li class="%s"><span class="ck" aria-hidden="true"></span>%s</li>'
                   % ("done" if d else "todo", t) for d, t in BUILT)


def phone(src, cls=""):
    return ('<div class="phone %s"><div class="screen"><img src="%s" alt=""></div>'
            '<span class="island"></span></div>' % (cls, src))



# ─────────────────────────── the three steps, in depth ───────────────────────────
def js_ascii(src):
    """inline scripts pass through an ASCII-only HTML build, so write any
    non-ASCII character as a JS escape instead of an HTML entity"""
    return "".join(c if ord(c) < 128 else "\\u%04x" % ord(c) for c in src)


STEPS_JS = js_ascii(open(os.path.join(HERE, "steps.js")).read())

DEEP = [
    {"n": 1, "when": "Step 1 · Months 0–6", "h": "Grow your chair.", "dim": "Fill every hour.",
     "vb": "0 0 520 410", "aria": "Animation: a week of appointments fills up; add-ons and members appear; hours booked rise from 62% to 94%.",
     "plan": [("Launch", "Glow Membership at $159 a month, add-ons at booking, flash openings, and give $25 / get $25."),
              ("Measure", "Members, average visit, and how many hours are booked."),
              ("Target", "30 members, a $150+ average visit, 90% of hours booked."),
              ("Result", "About $4.5k more revenue a month, from the same chair.")]},
    {"n": 2, "when": "Step 2 · Months 6–12", "h": "Pilot two artists.", "dim": "Prove it small.",
     "vb": "0 0 520 400", "aria": "Animation: two artists' clients appear; some cross over to book Evelyn; the share climbs past the 15% go line.",
     "plan": [("Recruit", "Two licensed lash or brow artists who already have a following."),
              ("Set up", "Their own payouts, a 12% platform fee, shared Glow Rewards, attorney-approved terms."),
              ("Measure", "How many of their clients also book Evelyn."),
              ("Decide", "15% or more by month 12 means go. Under that, keep the pilot: it still nets about $2.8k a month.")]},
    {"n": 3, "when": "Step 3 · Year 2–3", "h": "The Collective.", "dim": "One house, one app.",
     "vb": "0 0 520 386", "aria": "Animation: a floor plan fills with artists; bookings ping; net profit climbs from the lease dip to about $4,100 a month.",
     "plan": [("Space", "Sign a 6–8 suite lease only after the pilot passes."),
              ("Fill", "One or two licensed artists a month, found through the pilot artists’ networks."),
              ("App", "Lumevina goes to the App Store with every artist bookable."),
              ("Target", "Seven artists, about $4.1k net a month: +$93k a year with Step 1.")]},
]


def plan_html(plan):
    return "".join('<div class="pl"><span class="pk">%s</span><span class="pv">%s</span></div>' % p for p in plan)


def deep_web(d):
    flip = " flip" if d["n"] == 2 else ""
    return ('<section class="deep%s"><div class="wrap deep-grid">'
            '<div class="deep-copy reveal"><p class="kicker">%s</p>'
            '<h2 class="h2" style="margin:14px 0 26px">%s <span class="dim">%s</span></h2>'
            '<div class="plan">%s</div></div>'
            '<div class="deep-art reveal"><svg class="scene" data-step="%d" viewBox="%s" role="img" aria-label="%s"></svg></div>'
            '</div></section>') % (flip, d["when"], d["h"], d["dim"], plan_html(d["plan"]), d["n"], d["vb"], d["aria"])


def deep_print(d, page, total):
    return ('<section class="page">'
            '<div><p class="kicker">%s</p><h2 class="h2" style="margin-top:10px">%s <span class="dim">%s</span></h2></div>'
            '<div class="deep-art"><svg class="scene" data-step="%d" viewBox="%s" role="img" aria-label="%s"></svg></div>'
            '<div class="plan">%s</div>%s</section>') % (d["when"], d["h"], d["dim"], d["n"], d["vb"], d["aria"],
                                                        plan_html(d["plan"]), foot_n(page, total))


def foot_n(n, total):
    return '<div class="pfoot"><span>Lumevina · Growth Blueprint</span><span>%d / %d</span></div>' % (n, total)

# ─────────────────────────── styles ───────────────────────────
BASE_CSS = r"""
@font-face { font-family: "InterV"; src: url(data:font/woff2;base64,__FONT__) format("woff2");
  font-weight: 100 900; font-style: normal; font-display: block; }
:root {
  --bg: #000; --card: #111113; --card-2: #1a1a1d; --hair: rgba(255,255,255,.1);
  --text: #f5f5f7; --text-2: #a1a1a6; --text-3: #6e6e73;
  --rose: #f4c9d6; --gold: #e3b48f; --green: #32d74b;
  --grad: linear-gradient(95deg, #f7d3de 0%, #eab9c8 45%, #e2b08c 100%);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body { font-family: "InterV", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  font-optical-sizing: auto; -webkit-font-smoothing: antialiased; font-feature-settings: "cv11", "ss01"; }
h1, h2, h3, p { margin: 0; }
h1, h2 { font-weight: 700; letter-spacing: -0.035em; line-height: 1.03; text-wrap: balance; }
h3 { font-weight: 650; letter-spacing: -0.015em; }
.dim { color: var(--text-3); }
.grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.kicker { font-size: 0.8rem; font-weight: 600; letter-spacing: 0.02em; color: var(--rose); }
.lead { color: var(--text-2); line-height: 1.45; letter-spacing: -0.01em; }
.num { font-variant-numeric: tabular-nums; }

/* network */
.net-wrap { position: relative; }
.net-wrap canvas { display: block; width: 100%; height: 100%; }
.net-cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 0.6rem; align-items: baseline;
  justify-content: center; font-size: 0.95rem; color: var(--text-2); transition: opacity .5s ease; }
.net-cap b { color: var(--text); font-weight: 600; }

/* steps */
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.step { background: var(--card); border-radius: 22px; padding: 26px 24px 26px; }
.step .n { font-size: 3.2rem; font-weight: 700; letter-spacing: -0.05em; line-height: 1; }
.step h3 { font-size: 1.3rem; margin-top: 18px; }
.step .when { font-size: 0.85rem; color: var(--text-3); margin-top: 4px; }
.step p { color: var(--text-2); font-size: 0.97rem; line-height: 1.45; margin-top: 12px; }

/* flow */
.flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; position: relative; }
.flow .fs { background: var(--card); border-radius: 22px; padding: 24px 22px; position: relative; }
.flow .fi { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
  font-weight: 700; font-size: 0.95rem; color: #000; background: var(--grad); }
.flow .fs b { display: block; font-weight: 600; font-size: 1.08rem; letter-spacing: -0.015em; margin-top: 18px; line-height: 1.3; }
.flow .fs span { display: block; color: var(--text-2); font-size: 0.95rem; margin-top: 4px; line-height: 1.4; }
.flow .fs:not(:last-child)::after { content: ""; position: absolute; top: 40px; right: -11px; width: 8px; height: 8px;
  border-top: 2px solid var(--text-3); border-right: 2px solid var(--text-3); transform: rotate(45deg); z-index: 1; }
.loop { margin-top: 16px; text-align: center; color: var(--text-3); font-size: 0.9rem; }

/* phone */
.phone { position: relative; aspect-ratio: 390 / 844; border-radius: 16% / 7.4%; background: #1d1d1f;
  padding: 3.2%; box-shadow: 0 0 0 1px #3a3a3c inset, 0 0 0 2px #0a0a0a, 0 30px 80px rgba(0,0,0,.6); }
.phone .screen { position: relative; width: 100%; height: 100%; border-radius: 13.6% / 6.3%; overflow: hidden; background: #fbf7f3; }
.phone .screen img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.phone .island { position: absolute; top: 4.6%; left: 50%; width: 29%; height: 3.3%; transform: translateX(-50%);
  border-radius: 999px; background: #000; }

/* built list */
.built { list-style: none; margin: 0; padding: 0; }
.built li { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid var(--hair);
  font-size: 1.02rem; letter-spacing: -0.01em; }
.built li:last-child { border-bottom: 0; }
.built .ck { flex: none; width: 22px; height: 22px; border-radius: 50%; position: relative; }
.built .done .ck { background: var(--green); }
.built .done .ck::after { content: ""; position: absolute; left: 7.5px; top: 4.5px; width: 5px; height: 10px;
  border: solid #000; border-width: 0 2.2px 2.2px 0; transform: rotate(45deg); }
.built .todo { color: var(--text-2); }
.built .todo .ck { border: 2px solid var(--text-3); }

/* big figures */
.figs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.fig { background: var(--card); border-radius: 22px; padding: 24px; }
.fig .k { font-size: 0.85rem; color: var(--text-2); font-weight: 500; }
.fig .v { font-size: 3.4rem; font-weight: 700; letter-spacing: -0.045em; line-height: 1; margin-top: 12px; }
.fig .d { font-size: 0.9rem; color: var(--text-3); margin-top: 10px; line-height: 1.4; }
.fig.hl { background: linear-gradient(160deg, #2a1d23 0%, #16110f 100%); box-shadow: inset 0 0 0 1px rgba(244,201,214,.25); }

/* chart */
.chart-card { background: var(--card); border-radius: 22px; padding: 24px 24px 14px; }
.chart-card h3 { font-size: 1.05rem; }
.chart-card .sub { color: var(--text-3); font-size: 0.88rem; margin-top: 4px; }
.chart { display: block; width: 100%; height: auto; margin-top: 10px; overflow: visible; }
.chart .st0 { fill: rgba(255,255,255,.025); } .chart .st1 { fill: rgba(255,255,255,.045); } .chart .st2 { fill: rgba(255,255,255,.02); }
.chart .stl { fill: var(--text-3); font-size: 12px; font-weight: 500; }
.chart .grid { stroke: rgba(255,255,255,.07); stroke-width: 1; }
.chart .base { stroke: rgba(255,255,255,.2); stroke-width: 1; }
.chart .yl { fill: var(--text-3); font-size: 11.5px; text-anchor: end; }
.chart .xl { fill: var(--text-3); font-size: 11.5px; }
.chart .band { fill: rgba(244,201,214,.14); }
.chart .likely { fill: none; stroke: #f0c2cf; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.chart .endpt { fill: #f4c9d6; stroke: #000; stroke-width: 3; }
.chart .endl { fill: var(--text); font-size: 14px; font-weight: 600; }

/* rows */
.rows { background: var(--card); border-radius: 22px; padding: 8px 22px; }
.row { display: grid; grid-template-columns: 1fr auto; column-gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--hair); }
.row:last-child { border-bottom: 0; }
.row .rn { font-size: 0.98rem; letter-spacing: -0.01em; }
.row .rv { font-size: 0.98rem; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.row .rr { grid-column: 1 / -1; font-size: 0.8rem; color: var(--text-3); font-variant-numeric: tabular-nums; margin-top: 2px; }
.row.tot .rn { font-weight: 600; }
.row.tot .rv { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 1.1rem; }
.cols-h { font-size: 1.05rem; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 4px; }
.cols-s { font-size: 0.85rem; color: var(--text-3); margin-bottom: 12px; }

/* guard + costs */
.guard { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.g { background: var(--card); border-radius: 22px; padding: 22px 24px; }
.g b { font-weight: 650; font-size: 1.1rem; letter-spacing: -0.015em; }
.g p { color: var(--text-2); font-size: 0.95rem; line-height: 1.45; margin-top: 6px; }
.costs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.c { border-top: 1px solid var(--hair); padding-top: 12px; }
.c b { display: block; font-weight: 600; font-size: 0.95rem; }
.c span { display: block; color: var(--text-2); font-size: 0.88rem; margin-top: 4px; line-height: 1.4; }

/* days */
.days { list-style: none; margin: 0; padding: 0; position: relative; }
.days::before { content: ""; position: absolute; left: 7px; top: 12px; bottom: 12px; width: 2px; background: linear-gradient(#f4c9d6, rgba(244,201,214,.08)); }
.days li { position: relative; padding: 0 0 22px 38px; }
.days li:last-child { padding-bottom: 0; }
.days li::before { content: ""; position: absolute; left: 0; top: 5px; width: 16px; height: 16px; border-radius: 50%;
  background: #000; box-shadow: inset 0 0 0 2px #f4c9d6; }
.days li:first-child::before { background: #f4c9d6; }
.days .w { font-size: 0.85rem; font-weight: 600; color: var(--rose); }
.days .t { font-size: 1.08rem; letter-spacing: -0.012em; line-height: 1.4; margin-top: 2px; }

.fine { font-size: 0.78rem; color: var(--text-3); line-height: 1.5; }

/* step scenes */
.deep-art { background: var(--card); border-radius: 22px; padding: 22px; }
.scene { display: block; width: 100%; height: auto; overflow: visible; }
.scene text { font-family: "InterV", -apple-system, system-ui, sans-serif; }
.scene .s-lbl { fill: var(--text-3); font-size: 11.5px; font-weight: 500; }
.scene .s-sub { fill: var(--text-3); font-size: 11px; }
.scene .s-h { fill: var(--text); font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
.scene .s-big { fill: var(--text); font-size: 26px; font-weight: 700; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.scene .s-go { fill: var(--green); font-size: 12px; font-weight: 600; }
.plan { display: grid; gap: 0; }
.pl { display: grid; grid-template-columns: 5.2rem 1fr; gap: 14px; padding: 14px 0; border-top: 1px solid var(--hair); }
.pl:first-child { border-top: 0; padding-top: 0; }
.pk { font-size: 0.9rem; font-weight: 600; color: var(--rose); padding-top: 1px; }
.pv { font-size: 1.02rem; line-height: 1.45; letter-spacing: -0.01em; color: var(--text); }
"""

WEB_CSS = r"""
body { font-size: 17px; }
.wrap { width: min(1040px, calc(100% - 40px)); margin: 0 auto; }
section { padding: 120px 0; }
section + section { border-top: 1px solid rgba(255,255,255,.06); }
.center { text-align: center; }
.h1 { font-size: clamp(3.2rem, 10vw, 7rem); }
.h2 { font-size: clamp(2.4rem, 6vw, 4.4rem); }
.hero { padding: 40px 0 56px; }
.hero-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 20px; align-items: center; min-height: min(88vh, 760px); }
.hero .h1 { font-size: clamp(3rem, 5.6vw, 5rem); }
.hero .kicker { margin-bottom: 18px; }
.hero .lead { font-size: clamp(1.15rem, 2vw, 1.45rem); max-width: 26rem; margin-top: 24px; }
.hero .net-wrap { height: 540px; }
.hero .net-cap { position: static; margin-top: 4px; }
.sec-head { margin-bottom: 48px; }
.sec-head .lead { font-size: 1.2rem; max-width: 36rem; margin-top: 18px; }
.center .lead { margin-left: auto; margin-right: auto; }
.ceiling { display: grid; grid-template-columns: 1.1fr 1fr; gap: 56px; align-items: center; }
.bigstat { font-size: clamp(5rem, 14vw, 10rem); font-weight: 700; letter-spacing: -0.06em; line-height: 0.9; }
.meter { margin-top: 26px; }
.meter .track { position: relative; height: 14px; border-radius: 999px; background: var(--card-2); overflow: hidden; }
.meter .fill { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 999px; background: var(--grad); transition: width 2.2s cubic-bezier(.2,.8,.2,1); }
.in .meter .fill { width: 100%; }
.meter .lab { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-3); margin-top: 10px; }
.meter .lab b { color: var(--text); font-weight: 600; }
.foot-note { margin-top: 22px; text-align: center; color: var(--text-3); font-size: 0.95rem; }
.built-grid { display: grid; grid-template-columns: 300px 1fr; gap: 64px; align-items: center; }
.live-phone { position: relative; }
.live-phone .screen img { opacity: 0; transition: opacity .8s ease; }
.live-phone .screen img.on { opacity: 1; }
.live-cap { margin-top: 20px; text-align: center; font-size: 0.95rem; color: var(--text-2); min-height: 1.4em; }
.live-dots { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.live-dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); transition: background .3s, width .3s; }
.live-dots i.on { background: var(--text); width: 20px; border-radius: 999px; }
.num-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
.num-grid > div { min-width: 0; }
.chart-card { margin-top: 14px; }
.chart .likely { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 2.6s cubic-bezier(.3,.7,.2,1); }
.in .chart .likely, .no-motion .chart .likely { stroke-dashoffset: 0; }
.chart .band, .chart .endpt, .chart .endl { opacity: 0; transition: opacity 1s ease 1.6s; }
.in .chart .band, .in .chart .endpt, .in .chart .endl, .no-motion .chart .band, .no-motion .chart .endpt, .no-motion .chart .endl { opacity: 1; }
.costs { margin-top: 40px; }
.days-wrap { max-width: 640px; margin: 0 auto; }
.close { padding: 150px 0 120px; }
.close .fine { margin-top: 60px; }

.deep-grid { display: grid; grid-template-columns: 1fr 1.08fr; gap: 56px; align-items: center; }
.deep .h2 { font-size: clamp(2.2rem, 4.2vw, 3.3rem); }
.deep.flip .deep-copy { order: 2; }
.deep + .deep { border-top: 0; padding-top: 40px; }


/* step cards open a panel */
button.step { display: block; width: 100%; text-align: left; font: inherit; color: inherit; border: 0; cursor: pointer;
  position: relative; padding-bottom: 76px; transition: background-color .3s ease, transform .4s cubic-bezier(.2,.8,.2,1); }
button.step:hover { background: var(--card-2); transform: translateY(-3px); }
button.step:focus-visible { outline: 2px solid var(--rose); outline-offset: 4px; }
button.step.is-origin { visibility: hidden; }
.step .plus { position: absolute; right: 20px; bottom: 20px; width: 38px; height: 38px; border-radius: 50%;
  background: #2c2c2f; color: var(--text); display: grid; place-items: center; transition: transform .45s cubic-bezier(.2,.8,.2,1), background-color .3s; }
.step .plus svg { width: 16px; height: 16px; }
button.step:hover .plus { background: var(--text); color: #000; transform: rotate(90deg); }

html.sd-lock { overflow: hidden; }
.sd-overlay { position: fixed; inset: 0; z-index: 100; }
.sd-overlay[hidden] { display: none; }
.sd-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.62);
  -webkit-backdrop-filter: blur(20px) saturate(140%); backdrop-filter: blur(20px) saturate(140%); }
.sd-panel { position: absolute; inset: 0; margin: auto; width: min(1100px, calc(100% - 48px)); height: min(780px, calc(100dvh - 48px));
  background: #161618; border-radius: 28px; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 40px 120px rgba(0,0,0,.6); clip-path: inset(0 round 28px); }
.sd-close { position: absolute; top: 18px; right: 18px; z-index: 2; width: 38px; height: 38px; border-radius: 50%; border: 0;
  background: #2c2c2f; color: var(--text); display: grid; place-items: center; cursor: pointer; transition: background-color .2s; }
.sd-close:hover { background: #3a3a3d; }
.sd-close svg { width: 16px; height: 16px; }
.sd-close:focus-visible, .sd-nav button:focus-visible { outline: 2px solid var(--rose); outline-offset: 3px; }
.sd-body { flex: 1; overflow: auto; padding: 64px 56px 32px; overscroll-behavior: contain; }
.sd-grid { display: grid; grid-template-columns: 1fr 1.1fr; grid-template-areas: "head art" "plan art";
  column-gap: 48px; align-content: center; min-height: 100%; }
.sd-head { grid-area: head; align-self: end; }
.sd-grid .deep-art { grid-area: art; align-self: center; }
.sd-grid .plan { grid-area: plan; align-self: start; }
.sd-h { font-size: clamp(2rem, 3.8vw, 3.1rem); font-weight: 700; letter-spacing: -0.038em; line-height: 1.05; margin: 14px 0 26px; text-wrap: balance; }
.sd-panel .deep-art { background: #0b0b0c; }
.sd-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px;
  border-top: 1px solid var(--hair); min-height: 66px; }
.sd-nav button { font: inherit; font-size: .92rem; font-weight: 500; color: var(--text); background: transparent;
  border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 9px 16px; cursor: pointer; transition: background-color .2s, border-color .2s; }
.sd-nav button:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.4); }
.sd-nav button[hidden] { display: inline-block; visibility: hidden; }
.sd-arrow { color: var(--rose); }
.sd-dots { display: flex; gap: 7px; }
.sd-dots i { width: 7px; height: 7px; border-radius: 999px; background: #48484a; transition: width .3s, background-color .3s; }
.sd-dots i.on { width: 20px; background: var(--text); }
@media (max-width: 860px) {
  .sd-panel { width: calc(100% - 16px); height: calc(100dvh - 16px); border-radius: 22px; }
  .sd-body { padding: 60px 18px 20px; }
  .sd-grid { grid-template-columns: 1fr; grid-template-areas: "head" "art" "plan"; row-gap: 22px; align-content: start; }
  .sd-h { margin-bottom: 0; }
  .sd-nav { padding: 10px 12px; }
  .sd-nav .sd-lbl { display: none; }
  .sd-nav button { padding: 9px 14px; }
}

.reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s ease, transform .9s cubic-bezier(.2,.8,.2,1); }
.reveal.in { opacity: 1; transform: none; }
.no-motion .reveal { opacity: 1; transform: none; transition: none; }
.no-motion .meter .fill { width: 100%; transition: none; }

@media (max-width: 860px) {
  section { padding: 84px 0; }
  .steps, .flow, .figs, .guard { grid-template-columns: 1fr; }
  .flow .fs:not(:last-child)::after { top: auto; bottom: -11px; right: 50%; transform: translateX(50%) rotate(135deg); }
  .ceiling, .built-grid, .num-grid, .deep-grid { grid-template-columns: 1fr; gap: 36px; }
  .deep.flip .deep-copy { order: 0; }
  .deep-art { padding: 14px; }
  /* the scenes scale down to phone width; lift their type so it stays readable */
  .scene .s-lbl { font-size: 14px; } .scene .s-sub { font-size: 13.5px; }
  .scene .s-h { font-size: 15.5px; } .scene .s-big { font-size: 30px; }
  .built-grid .live-phone { width: min(260px, 70%); margin: 0 auto; }
  .costs { grid-template-columns: 1fr 1fr; }
  .hero-grid { grid-template-columns: 1fr; min-height: 0; text-align: center; gap: 8px; padding-top: 48px; }
  .hero .lead { margin-left: auto; margin-right: auto; }
  .hero .net-wrap { height: 100vw; max-height: 520px; }
  .net-cap { flex-direction: column; align-items: center; gap: 2px; }
}
"""

PRINT_CSS = r"""
@page { size: letter; margin: 0; }
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-size: 10.5pt; }
.page { width: 8.5in; height: 11in; padding: 0.62in 0.66in 0.5in; position: relative; overflow: hidden;
  page-break-after: always; display: flex; flex-direction: column; gap: 0.3in; background: var(--bg); }
.page:last-child { page-break-after: auto; }
.pfoot { position: absolute; left: 0.66in; right: 0.66in; bottom: 0.3in; display: flex; justify-content: space-between;
  font-size: 7.5pt; color: var(--text-3); }
.h1 { font-size: 58pt; }
.h2 { font-size: 32pt; }
.lead { font-size: 12.5pt; }
.kicker { font-size: 9pt; }
.step, .flow .fs, .fig, .g, .rows, .chart-card { border-radius: 16px; }
.step { padding: 18px 18px 20px; } .step .n { font-size: 30pt; } .step h3 { font-size: 13pt; margin-top: 12px; }
.step .when { font-size: 8.5pt; } .step p { font-size: 9.5pt; margin-top: 8px; }
.flow .fs { padding: 16px 15px; } .flow .fs b { font-size: 10.5pt; margin-top: 12px; } .flow .fs span { font-size: 9pt; }
.flow .fi { width: 26px; height: 26px; font-size: 9pt; }
.flow .fs:not(:last-child)::after { top: 28px; }
.loop { font-size: 9pt; margin-top: 10px; }
.fig { padding: 16px 18px; } .fig .v { font-size: 34pt; margin-top: 8px; } .fig .k { font-size: 8.5pt; } .fig .d { font-size: 8.5pt; margin-top: 6px; }
.chart-card { padding: 16px 18px 8px; } .chart-card h3 { font-size: 11pt; } .chart-card .sub { font-size: 8.5pt; }
.rows { padding: 2px 16px; } .row { padding: 5px 0; } .row .rn, .row .rv { font-size: 9.5pt; } .row .rr { font-size: 7.8pt; }
.row.tot .rv { font-size: 10.5pt; }
.cols-h { font-size: 11pt; } .cols-s { font-size: 8.5pt; margin-bottom: 8px; }
.g { padding: 16px 18px; } .g b { font-size: 11.5pt; } .g p { font-size: 9.5pt; }
.c b { font-size: 9.5pt; } .c span { font-size: 8.8pt; }
.built li { font-size: 10.5pt; padding: 9px 0; }
.days li { padding-bottom: 14px; } .days .w { font-size: 8.5pt; } .days .t { font-size: 11pt; }
.fine { font-size: 7.5pt; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cover-net { flex: 1; min-height: 0; position: relative; }
.cover-net .net-wrap { position: absolute; inset: 0; }
.cover-net .net-cap { font-size: 10pt; bottom: 4px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.stat { border-top: 1px solid var(--hair); padding-top: 10px; }
.stat .v { font-size: 22pt; font-weight: 700; letter-spacing: -0.04em; }
.stat .k { font-size: 8.5pt; color: var(--text-2); margin-top: 2px; }
.ceil { display: grid; grid-template-columns: auto 1fr; gap: 26px; align-items: center; }
.ceil .bigstat { font-size: 64pt; font-weight: 700; letter-spacing: -0.06em; line-height: 0.9; }
.phones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.phones figure { margin: 0; }
.phones figcaption { text-align: center; font-size: 8.5pt; color: var(--text-2); margin-top: 10px; }
.phone { box-shadow: 0 0 0 1px #3a3a3c inset, 0 0 0 1.5px #0a0a0a, 0 16px 40px rgba(0,0,0,.6); }
.built { columns: 2; column-gap: 28px; }
.built li { break-inside: avoid; }
.closer { margin-top: auto; }
.page .deep-art { padding: 18px 20px; border-radius: 16px; }
.page .plan { margin-top: 2px; }
.page .pl { grid-template-columns: 1.1in 1fr; padding: 11px 0; }
.page .pk { font-size: 10pt; } .page .pv { font-size: 11pt; }
.closer .h2 { font-size: 30pt; }
"""

# ─────────────────────────── network animation ───────────────────────────
NET_JS = r"""
(function () {
  "use strict";
  var cv = document.getElementById("net");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var capEl = document.querySelector(".net-cap");
  var phaseEl = document.getElementById("net-phase");
  var descEl = document.getElementById("net-desc");
  var PH = [
    { t: 0, name: "Today", desc: "One chair. About 80 visits a month." },
    { t: 4.5, name: "Pilot", desc: "Two artists bring their own clients into the app." },
    { t: 9, name: "The Collective", desc: "Eight artists, one app, shared Glow Rewards." }
  ];
  var CYCLE = 18;
  var LABELS = ["Lash", "Brow", "Nails", "Lash", "Brow", "Nails", "Lash", "Brow"];
  var ORDER = [0, 4, 2, 6, 1, 5, 3, 7];
  var W, H, cx, cy, R, dpr;
  var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(7);

  var nodes = [{ ang: 0, appear: -1, clients: [] }];
  for (var i = 0; i < 8; i++) {
    nodes.push({ ang: ORDER[i] * Math.PI / 4 - Math.PI / 2 + 0.3, label: LABELS[i],
      appear: i < 2 ? PH[1].t + i * 0.4 : PH[2].t + (i - 2) * 0.45, clients: [] });
  }
  var mk = function (n, count, rMin, rMax) {
    for (var k = 0; k < count; k++) n.clients.push({ r: rMin + rnd() * (rMax - rMin), a: rnd() * 6.283,
      s: (0.25 + rnd() * 0.55) * (rnd() < 0.5 ? -1 : 1), born: n.appear + rnd() * 1.2 });
  };
  mk(nodes[0], 16, 26, 58);
  for (var j = 1; j < nodes.length; j++) mk(nodes[j], 11, 16, 34);
  var comets = [], extra = 0, spawnAcc = 0, T = 0;

  var size = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H * (window.NET_FREEZE ? 0.47 : 0.5); R = Math.min(W * 0.36, H * 0.36);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  };
  var pos = function (n) {
    if (n === nodes[0]) return [cx, cy];
    return [cx + Math.cos(n.ang) * R * 1.12, cy + Math.sin(n.ang) * R * 0.92];
  };
  var alphaOf = function (n, t) {
    var a = n.appear < 0 ? 1 : Math.min(1, Math.max(0, (t - n.appear) / 0.9));
    var out = Math.min(1, Math.max(0, (CYCLE - t) / 1.2));
    return a * out;
  };
  var phaseIdx = -1;
  var setPhase = function (t) {
    var idx = t >= PH[2].t ? 2 : t >= PH[1].t ? 1 : 0;
    if (idx === phaseIdx || !phaseEl) return;
    phaseIdx = idx;
    capEl.style.opacity = 0;
    setTimeout(function () {
      phaseEl.textContent = PH[idx].name; descEl.textContent = PH[idx].desc; capEl.style.opacity = 1;
    }, frozen ? 0 : 260);
  };

  var step = function (dt) {
    T += dt;
    if (T >= CYCLE) { T = 0; comets = []; extra = 0; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); }
    var t = T;
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(0, 0, W, H);
    var c0 = pos(nodes[0]);
    var live = [];
    for (var i = 1; i < nodes.length; i++) {
      var a = alphaOf(nodes[i], t);
      if (a <= 0) continue;
      live.push(nodes[i]);
      var p = pos(nodes[i]);
      ctx.strokeStyle = "rgba(244,201,214," + (0.16 * a) + ")"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
    }
    /* comets: a client crossing from an artist to Evelyn */
    if (live.length) {
      spawnAcc += dt * (0.9 + live.length * 0.45);
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        var src = live[Math.floor(rnd() * live.length)];
        comets.push({ n: src, t0: t, dur: 1.5 + rnd() * 0.6, bend: (rnd() - 0.5) * 0.8 });
      }
    }
    for (var k = comets.length - 1; k >= 0; k--) {
      var cm = comets[k], u = (t - cm.t0) / cm.dur;
      if (u >= 1 || u < 0) { if (u >= 1) extra = Math.min(extra + 1, 40); comets.splice(k, 1); continue; }
      var s = pos(cm.n), mx = (s[0] + c0[0]) / 2 - (c0[1] - s[1]) * cm.bend, my = (s[1] + c0[1]) / 2 + (c0[0] - s[0]) * cm.bend;
      var e = u * u * (3 - 2 * u);
      var x = (1 - e) * (1 - e) * s[0] + 2 * (1 - e) * e * mx + e * e * c0[0];
      var y = (1 - e) * (1 - e) * s[1] + 2 * (1 - e) * e * my + e * e * c0[1];
      ctx.fillStyle = "rgba(247,211,222," + (0.95 * alphaOf(cm.n, t)) + ")";
      ctx.beginPath(); ctx.arc(x, y, 2.1, 0, 6.283); ctx.fill();
    }
    /* nodes and their clients */
    for (var n = 0; n < nodes.length; n++) {
      var nd = nodes[n], al = alphaOf(nd, t);
      if (al <= 0) continue;
      var q = pos(nd), isE = n === 0;
      var count = isE ? 16 + Math.floor(extra * 0.6) : nd.clients.length;
      for (var m = 0; m < nd.clients.length && m < count; m++) {
        var cl = nd.clients[m];
        cl.a += cl.s * dt;
        var ca = isE ? al : al * Math.min(1, Math.max(0, (t - cl.born) / 0.8));
        ctx.fillStyle = "rgba(245,245,247," + (0.75 * ca) + ")";
        ctx.beginPath(); ctx.arc(q[0] + Math.cos(cl.a) * cl.r, q[1] + Math.sin(cl.a) * cl.r * 0.9, 1.35, 0, 6.283); ctx.fill();
      }
      var rad = isE ? 11 + Math.min(extra, 40) * 0.12 : 6.5;
      var g = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rad * 3.2);
      g.addColorStop(0, isE ? "rgba(244,201,214," + 0.55 * al + ")" : "rgba(255,255,255," + 0.28 * al + ")");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], rad * 3.2, 0, 6.283); ctx.fill();
      ctx.fillStyle = isE ? "rgba(247,211,222," + al + ")" : "rgba(236,236,240," + al + ")";
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 6.283); ctx.fill();
      ctx.font = (isE ? "600 13px" : "500 11px") + " InterV, -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isE ? "rgba(245,245,247," + al + ")" : "rgba(161,161,166," + al + ")";
      ctx.fillText(isE ? "Evelyn" : nd.label, q[0], q[1] + (isE ? 78 : rad + 42));
    }
    setPhase(t);
  };

  var frozen = typeof window.NET_FREEZE === "number";
  size();
  if (frozen) {
    for (var f = 0; f < window.NET_FREEZE * 60; f++) step(1 / 60);
    return;
  }
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm) { for (var g2 = 0; g2 < 14 * 60; g2++) step(1 / 60); return; }
  var last = performance.now(), raf = null, vis = true;
  var loop = function (now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt);
    raf = requestAnimationFrame(loop);
  };
  var play = function () { if (raf === null && vis && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };
  var pause = function () { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } };
  window.addEventListener("resize", function () { size(); }, { passive: true });
  document.addEventListener("visibilitychange", function () { if (document.hidden) pause(); else play(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) play(); else pause(); }).observe(cv);
  }
  play();
})();
"""

WEB_JS = r"""
(function () {
  "use strict";
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm || !("IntersectionObserver" in window)) document.documentElement.classList.add("no-motion");

  /* reveal on scroll */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
      e.target.querySelectorAll("[data-count]").forEach(countUp);
    });
  }, { threshold: 0.2 }) : null;
  document.querySelectorAll(".reveal").forEach(function (el) { if (io) io.observe(el); });

  /* count-up numbers: "+$93k" style */
  function countUp(el) {
    var target = Number(el.getAttribute("data-count"));
    var pre = el.getAttribute("data-pre") || "", suf = el.getAttribute("data-suf") || "";
    if (rm) { el.textContent = pre + target + suf; return; }
    var t0 = performance.now(), dur = 1600;
    var tick = function (now) {
      var u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      el.textContent = pre + Math.round(target * e) + suf;
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  if (rm) document.querySelectorAll("[data-count]").forEach(countUp);

  /* the live phone: cycles through real Lumevina screens */
  var imgs = document.querySelectorAll(".live-phone img");
  var dots = document.querySelectorAll(".live-dots i");
  var cap = document.querySelector(".live-cap");
  var caps = ["The Lumevina site, on a phone", "Booking with a 50% deposit", "Glow Rewards", "The owner dashboard"];
  var cur = 0;
  var show = function (i) {
    imgs[cur].classList.remove("on"); dots[cur].classList.remove("on");
    cur = i;
    imgs[cur].classList.add("on"); dots[cur].classList.add("on");
    cap.textContent = caps[cur];
  };
  if (imgs.length && !rm) setInterval(function () { if (!document.hidden) show((cur + 1) % imgs.length); }, 3200);
})();
"""


DIALOG_JS = r"""
/* Step cards open their game plan in a panel that grows out of the
   card itself (clip-path from the card's rectangle to the full panel),
   content rising in behind it. Prev / next slide between steps; Esc,
   the backdrop or the close button shrink it back into its card. */
(function () {
  "use strict";
  var ov = document.querySelector(".sd-overlay");
  if (!ov) return;
  var panel = ov.querySelector(".sd-panel"), backdrop = ov.querySelector(".sd-backdrop");
  var body = ov.querySelector(".sd-body"), closeBtn = ov.querySelector(".sd-close");
  var prev = ov.querySelector(".sd-prev"), next = ov.querySelector(".sd-next");
  var dots = [].slice.call(ov.querySelectorAll(".sd-dots i"));
  var steps = [].slice.call(ov.querySelectorAll(".sd-step"));
  var cards = [].slice.call(document.querySelectorAll("button.step[data-open]"));
  var NAMES = ["Step 1 · Grow your chair", "Step 2 · Pilot two artists", "Step 3 · The Collective"];
  var EASE = "cubic-bezier(.2,.8,.2,1)";
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canAnimate = !!panel.animate && !rm;
  var cur = 0, busy = false;

  var show = function (n) {
    steps.forEach(function (st, i) { st.hidden = i !== n; });
    dots.forEach(function (d, i) { d.className = i === n ? "on" : ""; });
    cur = n;
    prev.hidden = n === 0; next.hidden = n === steps.length - 1;
    prev.querySelector(".sd-lbl").textContent = n > 0 ? NAMES[n - 1] : "";
    next.querySelector(".sd-lbl").textContent = n < steps.length - 1 ? NAMES[n + 1] : "";
    panel.setAttribute("aria-labelledby", "sd-title-" + (n + 1));
    body.scrollTop = 0;
  };

  var insetFrom = function (card) {
    var c = card.getBoundingClientRect(), p = panel.getBoundingClientRect();
    var px = function (v) { return Math.max(0, Math.round(v)) + "px"; };
    return "inset(" + px(c.top - p.top) + " " + px(p.right - c.right) + " " +
      px(p.bottom - c.bottom) + " " + px(c.left - p.left) + " round 22px)";
  };
  var FULL = "inset(0px 0px 0px 0px round 28px)";

  var open = function (n) {
    if (busy) return;
    var card = cards[n];
    show(n);
    ov.hidden = false;
    document.documentElement.classList.add("sd-lock");
    card.classList.add("is-origin");
    if (canAnimate) {
      busy = true;
      var a = panel.animate([{ clipPath: insetFrom(card) }, { clipPath: FULL }], { duration: 640, easing: EASE });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "ease" });
      body.animate([{ opacity: 0, transform: "translateY(22px) scale(.985)" }, { opacity: 1, transform: "none" }],
        { duration: 560, delay: 200, easing: EASE, fill: "backwards" });
      closeBtn.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "none" }],
        { duration: 360, delay: 360, easing: EASE, fill: "backwards" });
      a.onfinish = function () { busy = false; };
    }
    closeBtn.focus({ preventScroll: true });
  };

  var close = function () {
    if (busy || ov.hidden) return;
    var card = cards[cur];
    var done = function () {
      ov.hidden = true;
      document.documentElement.classList.remove("sd-lock");
      cards.forEach(function (c) { c.classList.remove("is-origin"); });
      busy = false;
      card.focus({ preventScroll: true });
    };
    if (!canAnimate) { done(); return; }
    busy = true;
    body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: "ease", fill: "forwards" });
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 480, easing: "ease", fill: "forwards" });
    var a = panel.animate([{ clipPath: FULL }, { clipPath: insetFrom(card) }], { duration: 520, easing: EASE, fill: "forwards" });
    a.onfinish = function () {
      done();
      panel.getAnimations().forEach(function (x) { x.cancel(); });
      body.getAnimations().forEach(function (x) { x.cancel(); });
      backdrop.getAnimations().forEach(function (x) { x.cancel(); });
    };
  };

  var go = function (n) {
    if (busy || n < 0 || n >= steps.length || n === cur) return;
    var dir = n > cur ? 1 : -1;
    cards.forEach(function (c) { c.classList.remove("is-origin"); });
    cards[n].classList.add("is-origin");
    if (!canAnimate) { show(n); return; }
    busy = true;
    var out = body.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-40 * dir) + "px)" }],
      { duration: 200, easing: "ease-in", fill: "forwards" });
    out.onfinish = function () {
      show(n);
      out.cancel();
      var inn = body.animate([{ opacity: 0, transform: "translateX(" + (40 * dir) + "px)" }, { opacity: 1, transform: "none" }],
        { duration: 380, easing: EASE });
      inn.onfinish = function () { busy = false; };
    };
  };

  cards.forEach(function (c, i) { c.addEventListener("click", function () { open(i); }); });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  prev.addEventListener("click", function () { go(cur - 1); });
  next.addEventListener("click", function () { go(cur + 1); });
  document.addEventListener("keydown", function (e) {
    if (ov.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight") go(cur + 1);
    else if (e.key === "ArrowLeft") go(cur - 1);
    else if (e.key === "Tab") {
      /* keep focus inside the panel */
      var f = [].slice.call(panel.querySelectorAll("button:not([hidden])"));
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
})();
"""

# ─────────────────────────── web page ───────────────────────────
WEB = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lumevina Growth Blueprint</title>
<meta name="description" content="A three-step plan to grow Lumevina beyond one chair.">
<style>__BASE____WEB__</style>
</head>
<body>

<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="kicker reveal">Lumevina · Growth Blueprint</p>
      <h1 class="h1 reveal">One chair.<br><span class="grad">Then a house.</span></h1>
      <p class="lead reveal">A simple, three-step plan to grow Lumevina beyond the hours one person can work.</p>
    </div>
    <div class="net-col">
      <div class="net-wrap">
        <canvas id="net" aria-label="Animation: Evelyn's single chair grows into a network of artists whose clients cross over to book facials." role="img"></canvas>
      </div>
      <div class="net-cap"><b id="net-phase">Today</b><span id="net-desc">One chair. About 80 visits a month.</span></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap ceiling">
    <div class="reveal">
      <p class="kicker">The problem</p>
      <h2 class="h2" style="margin-top:14px">Your income stops <span class="dim">when your hands stop.</span></h2>
      <p class="lead" style="font-size:1.2rem;margin-top:20px">Every dollar today needs Evelyn in the treatment room. More hours isn&rsquo;t a plan.</p>
    </div>
    <div class="reveal">
      <div class="bigstat grad num">$220k</div>
      <p class="lead" style="margin-top:14px">The most one person can earn in a year. Fully booked, never sick, before rent, product and taxes.</p>
      <div class="meter"><div class="track"><div class="fill"></div></div>
        <div class="lab"><span>Chair time used</span><b>100% · the ceiling</b></div></div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">The plan</p>
      <h2 class="h2" style="margin-top:14px">Three steps. <span class="dim">Each one earns the next.</span></h2>
    </div>
    <div class="steps">__STEPS__</div>
    <p class="foot-note reveal">Tap a step to open its game plan. Each one starts only when the one before it has worked.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">How it works</p>
      <h2 class="h2" style="margin-top:14px">One app. <span class="dim">Everyone wins.</span></h2>
      <p class="lead">Talented young artists get a real business. Lumevina gets more clients, and every client can reach Evelyn.</p>
    </div>
    <div class="flow">__FLOW__</div>
    <p class="loop reveal">Then the facial client books a lash fill, and the circle starts again.</p>
  </div>
</section>

<section>
  <div class="wrap built-grid">
    <div class="reveal">
      <div class="live-phone">__LIVEPHONE__</div>
      <p class="live-cap">The Lumevina site, on a phone</p>
      <div class="live-dots"><i class="on"></i><i></i><i></i><i></i></div>
    </div>
    <div class="reveal">
      <p class="kicker">Already built</p>
      <h2 class="h2" style="margin:14px 0 26px">The system is ready. <span class="dim">It needs switching on.</span></h2>
      <ul class="built">__BUILT__</ul>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">The numbers</p>
      <h2 class="h2" style="margin-top:14px">What it could add. <span class="dim">Every year.</span></h2>
      <p class="lead">Added profit per year once all three steps are running, in year two to three.</p>
    </div>
    <div class="figs reveal">
      <div class="fig"><div class="k">Low</div><div class="v num" data-count="33" data-pre="+$" data-suf="k">+$33k</div><div class="d">The chair grows a little; the Collective barely covers its lease.</div></div>
      <div class="fig hl"><div class="k">Likely</div><div class="v num grad" data-count="93" data-pre="+$" data-suf="k">+$93k</div><div class="d">Membership sticks, seven artists, clients cross over.</div></div>
      <div class="fig"><div class="k">High</div><div class="v num" data-count="173" data-pre="+$" data-suf="k">+$173k</div><div class="d">Full membership and eight busy artists.</div></div>
    </div>
    <div class="chart-card reveal">
      <h3>Added profit per month, over three years</h3>
      <p class="sub">Line: likely case. Shaded: low to high. The dip is the new space&rsquo;s rent arriving before its artists do.</p>
      __CHART__
    </div>
    <div class="num-grid">
      <div class="reveal"><div class="rows-head" style="padding:22px 4px 0"><div class="cols-h">Your chair</div><div class="cols-s">Added revenue per month · likely, with range</div></div>__CHAIR__</div>
      <div class="reveal"><div class="rows-head" style="padding:22px 4px 0"><div class="cols-h">The Collective</div><div class="cols-s">Per month, once 6&ndash;8 artists are in</div></div>__COLL__</div>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">Guardrails</p>
      <h2 class="h2" style="margin-top:14px">Grow fast. <span class="dim">Stay safe.</span></h2>
    </div>
    <div class="guard">__GUARD__</div>
    <div class="costs reveal">__COSTS__</div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">Start here</p>
      <h2 class="h2" style="margin-top:14px">The next 90 days.</h2>
    </div>
    <div class="days-wrap reveal"><ol class="days">__DAYS__</ol></div>
  </div>
</section>

<section class="close center">
  <div class="wrap reveal">
    <h2 class="h1">Start small.<br>Prove it.<br><span class="grad">Then grow.</span></h2>
    <p class="fine">Prepared for Evelyn Romero, Lumevina Aesthetics Spa, Woodland Hills, CA · September 2026.<br>All figures are illustrative estimates based on current menu prices and will be updated with real booking numbers. Not financial or legal advice.</p>
  </div>
</section>

__DIALOG__
<script>__NET__</script>
<script>__WEBJS__</script>
<script>__STEPSJS__</script>
</body>
</html>
"""


PLUS = ('<span class="plus" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" '
        'stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>')


def steps_html(reveal=True):
    if not reveal:   # print: static cards
        return "".join('<div class="step"><div class="n grad">%s</div><h3>%s</h3><p class="when">%s</p><p>%s</p></div>'
                       % (n, t, w, d) for n, t, w, d in STEPS)
    return "".join('<button type="button" class="step reveal" data-open="%d" aria-haspopup="dialog" '
                   'aria-label="Open step %s: %s">'
                   '<div class="n grad">%s</div><h3>%s</h3><p class="when">%s</p><p>%s</p>%s</button>'
                   % (i, n, t, n, t, w, d, PLUS) for i, (n, t, w, d) in enumerate(STEPS))


def step_dialog():
    arts = []
    for d in DEEP:
        arts.append('<article class="sd-step" data-step-panel="%d" hidden><div class="sd-grid">'
                    '<div class="sd-head"><p class="kicker">%s</p>'
                    '<h2 class="sd-h" id="sd-title-%d">%s <span class="dim">%s</span></h2></div>'
                    '<div class="deep-art"><svg class="scene" data-step="%d" viewBox="%s" role="img" aria-label="%s"></svg></div>'
                    '<div class="plan">%s</div>'
                    '</div></article>' % (d["n"] - 1, d["when"], d["n"], d["h"], d["dim"],
                                          d["n"], d["vb"], d["aria"], plan_html(d["plan"])))
    return ('<div class="sd-overlay" hidden><div class="sd-backdrop"></div>'
            '<div class="sd-panel" role="dialog" aria-modal="true" aria-labelledby="sd-title-1">'
            '<button type="button" class="sd-close" aria-label="Close"><svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" '
            'stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>'
            '<div class="sd-body">%s</div>'
            '<nav class="sd-nav"><button type="button" class="sd-prev"><span class="sd-arrow">&larr;</span> <span class="sd-lbl"></span></button>'
            '<span class="sd-dots"><i></i><i></i><i></i></span>'
            '<button type="button" class="sd-next"><span class="sd-lbl"></span> <span class="sd-arrow">&rarr;</span></button></nav>'
            '</div></div>') % "".join(arts)


def flow_html(reveal=True):
    r = " reveal" if reveal else ""
    return "".join('<div class="fs%s"><div class="fi">%d</div><b>%s</b><span>%s</span></div>'
                   % (r, i + 1, a, b) for i, (a, b) in enumerate(FLOW))


def guard_html(reveal=True):
    r = " reveal" if reveal else ""
    return "".join('<div class="g%s"><b>%s</b><p>%s</p></div>' % (r, a, b) for a, b in GUARD)


def costs_html():
    return "".join('<div class="c"><b>%s</b><span>%s</span></div>' % c for c in COSTS)


def days_html():
    return "".join('<li><div class="w">%s</div><div class="t">%s</div></li>' % d for d in DAYS)


live = ('<div class="phone"><div class="screen">'
        + "".join('<img src="%s" alt=""%s>' % (SHOT[n], ' class="on"' if i == 0 else "")
                  for i, n in enumerate(("home", "book", "rewards", "dash")))
        + '</div><span class="island"></span></div>')

font = b64(FONT)
base = BASE_CSS.replace("__FONT__", font)

web = (WEB.replace("__BASE__", base).replace("__WEB__", WEB_CSS)
       .replace("__STEPS__", steps_html()).replace("__FLOW__", flow_html())
       .replace("__LIVEPHONE__", live).replace("__BUILT__", built_list())
       .replace("__CHART__", CHART).replace("__CHAIR__", rows(CHAIR, CHAIR_TOTAL))
       .replace("__COLL__", rows(COLLECTIVE, COLL_TOTAL)).replace("__GUARD__", guard_html())
       .replace("__COSTS__", costs_html()).replace("__DAYS__", days_html())
       .replace("__NET__", js_ascii(NET_JS)).replace("__WEBJS__", js_ascii(WEB_JS))
       .replace("__DIALOG__", step_dialog()).replace("__STEPSJS__", STEPS_JS + js_ascii(DIALOG_JS)))

# ─────────────────────────── print pages ───────────────────────────
def foot(n):
    return foot_n(n, 8)


PRINT = """<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Lumevina Growth Blueprint</title>
<style>__BASE____PRINT__</style></head><body>

<section class="page">
  <div>
    <p class="kicker">Lumevina · Growth Blueprint</p>
    <h1 class="h1" style="margin-top:14px">One chair.<br><span class="grad">Then a house.</span></h1>
    <p class="lead" style="margin-top:16px;max-width:5.4in">A simple, three-step plan to grow Lumevina beyond the hours one person can work.</p>
  </div>
  <div class="cover-net"><div class="net-wrap"><canvas id="net"></canvas>
    <div class="net-cap"><b id="net-phase">The Collective</b><span id="net-desc">Eight artists, one app, shared Glow Rewards.</span></div></div></div>
  <div class="stats">
    <div class="stat"><div class="v grad num">+$93k</div><div class="k">Likely added profit per year, by year 2&ndash;3</div></div>
    <div class="stat"><div class="v num">3 steps</div><div class="k">Each starts only when the last one worked</div></div>
    <div class="stat"><div class="v num">90 days</div><div class="k">To go live and test the first artist</div></div>
  </div>
  <p class="fine">Prepared for Evelyn Romero · Lumevina Aesthetics Spa · Woodland Hills, CA · September 2026</p>
  __F1__
</section>

<section class="page">
  <div>
    <p class="kicker">The problem</p>
    <h2 class="h2" style="margin-top:10px">Your income stops <span class="dim">when your hands stop.</span></h2>
  </div>
  <div class="ceil">
    <div class="bigstat grad num">$220k</div>
    <p class="lead">The most one person can earn in a year. Fully booked, never sick, before rent, product and taxes. More hours isn&rsquo;t a plan.</p>
  </div>
  <div>
    <p class="kicker">The plan</p>
    <h2 class="h2" style="margin:10px 0 18px">Three steps. <span class="dim">Each one earns the next.</span></h2>
    <div class="steps">__STEPS__</div>
  </div>
  <div>
    <p class="kicker">How it works</p>
    <h2 class="h2" style="margin:10px 0 18px">One app. <span class="dim">Everyone wins.</span></h2>
    <div class="flow">__FLOW__</div>
    <p class="loop">Then the facial client books a lash fill, and the circle starts again.</p>
  </div>
  __F2__
</section>

__DEEPP__

<section class="page">
  <div>
    <p class="kicker">Already built</p>
    <h2 class="h2" style="margin-top:10px">The system is ready. <span class="dim">It needs switching on.</span></h2>
  </div>
  <div class="phones">
    <figure>__P1__<figcaption>The site</figcaption></figure>
    <figure>__P2__<figcaption>Booking + deposit</figcaption></figure>
    <figure>__P3__<figcaption>Glow Rewards</figcaption></figure>
    <figure>__P4__<figcaption>Owner dashboard</figcaption></figure>
  </div>
  <ul class="built">__BUILT__</ul>
  <p class="fine">Real screens from the Lumevina site as it runs today.</p>
  __F3__
</section>

<section class="page">
  <div>
    <p class="kicker">The numbers</p>
    <h2 class="h2" style="margin-top:10px">What it could add. <span class="dim">Every year.</span></h2>
  </div>
  <div class="figs">
    <div class="fig"><div class="k">Low</div><div class="v num">+$33k</div><div class="d">The Collective barely covers its lease.</div></div>
    <div class="fig hl"><div class="k">Likely</div><div class="v num grad">+$93k</div><div class="d">Membership sticks; seven artists; clients cross over.</div></div>
    <div class="fig"><div class="k">High</div><div class="v num">+$173k</div><div class="d">Full membership and eight busy artists.</div></div>
  </div>
  <div class="chart-card">
    <h3>Added profit per month, over three years</h3>
    <p class="sub">Line: likely. Shaded: low to high. The dip is the new space&rsquo;s rent arriving before its artists do.</p>
    __CHART__
  </div>
  <div class="two">
    <div><div class="cols-h">Your chair</div><div class="cols-s">Added revenue per month · likely, with range</div>__CHAIR__</div>
    <div><div class="cols-h">The Collective</div><div class="cols-s">Per month, once 6&ndash;8 artists are in</div>__COLL__</div>
  </div>
  __F4__
</section>

<section class="page">
  <div>
    <p class="kicker">Guardrails</p>
    <h2 class="h2" style="margin:10px 0 18px">Grow fast. <span class="dim">Stay safe.</span></h2>
    <div class="guard">__GUARD__</div>
    <div class="costs" style="margin-top:18px">__COSTS__</div>
  </div>
  <div>
    <p class="kicker">Start here</p>
    <h2 class="h2" style="margin:10px 0 18px">The next 90 days.</h2>
    <ol class="days">__DAYS__</ol>
  </div>
  <div class="closer">
    <h2 class="h2">Start small. Prove it. <span class="grad">Then grow.</span></h2>
    <p class="fine" style="margin-top:10px">All figures are illustrative estimates based on current menu prices and will be updated with real booking numbers. Not financial or legal advice.</p>
  </div>
  __F5__
</section>

<script>window.NET_FREEZE = 15.2; window.STEPS_FREEZE = true;</script>
<script>__NET__</script>
<script>__STEPSJS__</script>
</body></html>
"""

pr = (PRINT.replace("__BASE__", base).replace("__PRINT__", PRINT_CSS)
      .replace("__STEPS__", steps_html(False)).replace("__FLOW__", flow_html(False))
      .replace("__BUILT__", built_list()).replace("__CHART__", CHART)
      .replace("__CHAIR__", rows(CHAIR, CHAIR_TOTAL)).replace("__COLL__", rows(COLLECTIVE, COLL_TOTAL))
      .replace("__GUARD__", guard_html(False)).replace("__COSTS__", costs_html())
      .replace("__DAYS__", days_html()).replace("__NET__", js_ascii(NET_JS))
      .replace("__P1__", phone(SHOT["home"])).replace("__P2__", phone(SHOT["book"]))
      .replace("__P3__", phone(SHOT["rewards"])).replace("__P4__", phone(SHOT["dash"])))
for i, pg in ((1, 1), (2, 2), (3, 6), (4, 7), (5, 8)):
    pr = pr.replace("__F%d__" % i, foot(pg))
pr = pr.replace("__DEEPP__", "".join(deep_print(d, 3 + k, 8) for k, d in enumerate(DEEP)))
pr = pr.replace("__STEPSJS__", STEPS_JS)

for name, html in (("web.html", web), ("print.html", pr)):
    html = html.encode("ascii", "xmlcharrefreplace").decode("ascii")
    with open(os.path.join(OUT, name), "w") as f:
        f.write(html)
    print(name, len(html))
