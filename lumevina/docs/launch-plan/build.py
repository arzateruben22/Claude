"""Lumevina · The First 90 Days — a companion to the Growth Blueprint.

How many members Lumevina needs by day 90 for dues to pay every business bill, the
weekly pace to get there, how the talent search runs alongside it, and the
two engines that keep going after day 90.

Builds two files from one set of content, in the Growth Blueprint's design
(its CSS is read straight from ../blueprint/build.py, so the two never drift):
  web.html   — scrolling page with a live calculator
  print.html — five Letter pages, printed to PDF

Run:  python3 build.py OUTDIR
"""
import ast, base64, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BP = os.path.join(HERE, "..", "blueprint")
OUT = sys.argv[1] if len(sys.argv) > 1 else HERE


def bp_css():
    """BASE / WEB / PRINT CSS from the Growth Blueprint, without running it."""
    tree = ast.parse(open(os.path.join(BP, "build.py")).read())
    out = {}
    for node in tree.body:
        if (isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id in ("BASE_CSS", "WEB_CSS", "PRINT_CSS")):
            out[node.targets[0].id] = ast.literal_eval(node.value)
    return out


CSS = bp_css()
FONT = base64.b64encode(open(os.path.join(BP, "inter-var.woff2"), "rb").read()).decode()

# ─────────────────────────── the numbers ───────────────────────────
WORDS = {10: "Ten", 11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen", 16: "Sixteen",
         17: "Seventeen", 18: "Eighteen", 19: "Nineteen", 20: "Twenty", 21: "Twenty-one", 22: "Twenty-two"}
money = lambda n: "${:,}".format(int(round(n)))
# Monthly bills: what it costs to keep the doors open, before anyone books.
# Estimates to check against Evelyn's real statements, set 5–10% above the
# first guesses for headroom, plus what a business normally pays to keep a
# site, app and books running.
BILLS = [("Room · suite rent and utilities", 1400),
         ("Insurance and license", 65),
         ("Website and app care", 200),     # a normal care plan runs $150–$500 a month
         ("Hosting, database, texts, domain and email", 65),
         ("Marketing · Instagram and chair cards", 160),
         ("Bookkeeping and tax prep, spread monthly", 50),
         ("Laundry and small supplies", 60)]
BILLS_TOTAL = sum(v for _, v in BILLS)

DUES = round(0.6 * 159 + 0.25 * 169 + 0.15 * 209, 2)   # plan mix: 6 in 10 Glow $159, 1 in 4 Clear Skin $169, the rest Ageless $209
FEE = round(DUES * 0.029 + 0.30, 2)
SUPPLIES = 16.0                    # product used in the member's monthly facial
PERKS = 5.5                        # 10% off the shelf, 15% off add-ons, averaged per member
KEPT = DUES - FEE - SUPPLIES - PERKS
FLOOR = math.ceil(BILLS_TOTAL / KEPT)
ARTIST_PERK = 6.0                  # members' 10% with artists, paid by Lumevina, once artists join
FLOOR_WITH_ARTISTS = math.ceil(BILLS_TOTAL / (KEPT - ARTIST_PERK))
PLAN = FLOOR + 3                   # the plan by day 90: the floor plus room for a cancellation or a slow month
PAY = [3000, 4000, 5000]           # Evelyn's monthly pay, before taxes: members for dues to cover the business and her pay
PAY_DEFAULT = 4000
pay_members = lambda pay: math.ceil((BILLS_TOTAL + pay) / KEPT)

MEMBER = [("Average dues · the plan mix", "$%d" % round(DUES), "6 in 10 Glow · 1 in 4 Clear Skin · the rest Ageless"),
          ("Card fee", "−$%.2f" % FEE, "2.9% + 30¢"),
          ("Supplies for the monthly facial", "−$%d" % SUPPLIES, "Backbar product used in the treatment"),
          ("Member perks", "−$%.2f" % PERKS, "10% off the shelf and 15% off add-ons, averaged")]

LADDER = [5, FLOOR, PLAN, 25, 30, 50]

ONE_TIME = [("Founding Five kits", "$160", "5 × cleanser + SPF at cost"),
            ("Attorney consult", "about $480", "Pilot terms, month 2"),
            ("Chair cards", "$65", "A member card for the treatment room")]
ONE_TIME_TOTAL = 160 + 480 + 65

# Members by the end of each week, weeks 0–13 (day 90 ≈ the end of week 13).
LIKELY = [0, 0, 0, 0, 3, 5, 7, 9, 10, 12, 14, 15, 17, 18]
LOW = [0, 0, 0, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11]
HIGH = [0, 0, 0, 0, 5, 7, 9, 11, 13, 16, 18, 20, 22, 24]
FLOOR_WEEK = next(i for i, v in enumerate(LIKELY) if v >= FLOOR)

PACE = [("Week 1", "Count what’s there: facial clients from the last six months, visits a month, who already comes every four to eight weeks. Set up the Saturday scoreboard.", 0),
        ("Weeks 2–3", "Live payments on, booking moves to Lumevina. In the chair, Evelyn mentions it: membership opens soon, first five get a free kit. Build an early list of 15 names.", 0),
        ("Week 4", "Launch. The early list hears a day first, then a text and email to every client and an Instagram post. The Founding Five opens.", 3),
        ("Week 5", "The Founding Five fills. Kits handed over in person, and each founder’s next facial booked before she leaves.", 5),
        ("Weeks 6–9", "The offer after every facial, next month booked on the spot. About 45 facial visits a month; one in eight says yes.", 12),
        ("Weeks 10–13", "Win-back texts to clients not seen in 60 days, with the member price as the reason to return. Members refer a friend; both get a free add-on.", PLAN)]

SOURCES = [("Founding Five launch", "Early list, text, email, Instagram", 5),
           ("In the chair, after every facial", "About 1 in 8 of the facial clients offered", 7),
           ("Win-back texts", "Clients not seen in 60+ days", 3),
           ("Member referrals", "Both get a free add-on", 2),
           ("Website and checkout", "Facial cards, the nudge, the booking upsell", 1)]

SCRIPT = ("The offer, in the chair",
          "“Your skin renews about every four weeks. As a member it’s $159 a month instead of $195 a visit, and I’ll hold your spot for next month. Want me to book it now?”")

BEHIND = [("Personal invites", "Evelyn texts her 20 most loyal clients herself. Nothing converts like her."),
          ("A member week", "Anyone who joins that week gets a free LED add-on. It costs time, not product."),
          ("Show the results", "Before-and-after posts with the member price on them."),
          ("Don’t", "Cut the dues or reopen the Founding Five. It teaches clients to wait for a deal.")]

TALENT = [("Weeks 1–4", "Build the list", "Ask every client who does their lashes, brows and nails. Save the name, the Instagram, and how many clients mentioned her. Goal: 15 names."),
          ("Weeks 5–8", "Get to know them", "Follow and book the top five as a client. Coffee with three: their business, not a deal yet. The one-hour attorney consult on pilot terms."),
          ("Weeks 9–13", "Pick two", "The two whose clients overlap most with Evelyn’s. The one-page pilot offer drafted and ready for day 90.")]

GATE = [{"tag": "Day 90 · %d or more members" % FLOOR, "big": "Sign two artists", "hl": True,
         "sub": "Offer the pilot to your best two in months 4–5, live by month 6.",
         "inc": ["Free for 90 days, then 12% on bookings through Lumevina",
                 "Members save 10% with them, and Lumevina pays it",
                 "Their clients earn Glow Points to spend with Evelyn"]},
        {"tag": "Day 90 · under %d members" % FLOOR, "big": "Keep talking", "hl": False,
         "sub": "Sign nothing yet. The list stays warm while members catch up.",
         "inc": ["Thirty more days of the member push",
                 "Use the levers: personal invites, a member week",
                 "Check again at day 120"]}]

WHY_FIRST = ("Why members first", "An artist signs for clients. %s members who save 10%% with her are %s reasons to say yes, and they’re the pitch at every coffee."
             % (WORDS[PLAN], WORDS[PLAN].lower()))

ENGINE_M = [("Months 4–6", "About %s new members a month" % {3: "three", 4: "four", 5: "five", 6: "six"}.get(round((30 - PLAN) / 3.0), "a few"), "30 members"),
            ("Month 6", "Dues about $4,770 a month, with this much left for Evelyn’s pay", "+$%s" % "{:,}".format(int(round(30 * KEPT - BILLS_TOTAL, -1)))),
            ("Year 2", "Dues alone cover the business and about %s a month of pay" % money(round(50 * KEPT - BILLS_TOTAL, -2)), "50 members"),
            ("Room check", "50 members is about 12 facials a week", "¼ of open hours")]
ENGINE_T = [("Months 4–5", "Sign the two pilot artists, if day 90 passed", "2 artists"),
            ("Month 6", "The pilot goes live, free for 90 days, then 12%", "Pilot live"),
            ("Month 12", "Go or no-go: 15% of their clients book Evelyn", "The gate"),
            ("Year 2", "The Collective: lease signed, pilot artists pick first", "6–8 artists")]

# ─────────────────────────── if product leads ───────────────────────────
# Five facials a week, and a monthly product subscription (the Glow Routine) does the rest.
FPW = 5                                    # facials a week
F_AVG = 190.0                              # average facial after the price rise, members and non-members
F_MONTH = FPW * 52 / 12.0
F_KEPT_EACH = F_AVG - (F_AVG * 0.029 + 0.30) - SUPPLIES
F_SALES, F_KEPT = F_MONTH * F_AVG, F_MONTH * F_KEPT_EACH
F_LEFT = F_KEPT - BILLS_TOTAL              # left for Evelyn's pay from facials alone
R_PRICE = 75.0                             # Glow Routine, a month
R_COGS = 0.50                              # wholesale is usually about half the price
R_SHIP = 4.0                               # shipping and packaging, averaged (many pick up at a visit)
R_FEE = round(R_PRICE * 0.029 + 0.30, 2)
R_KEPT = R_PRICE * (1 - R_COGS) - R_FEE - R_SHIP
subs_for_pay = lambda pay: max(0, math.ceil((pay - F_LEFT) / R_KEPT))
PL_CHAIR = [("Facials a month", "about %d" % round(F_MONTH), "%d a week, Tuesday to Saturday" % FPW),
            ("Sales", money(round(F_SALES, -1)), "At about %s a visit" % money(F_AVG)),
            ("Kept after supplies and card fees", money(round(F_KEPT, -1)), "About $%d of every $100" % int(F_KEPT_EACH / F_AVG * 100)),
            ("Business bills", "−" + money(BILLS_TOTAL), "The same bills as page 2")]
PL_SUB = [("Glow Routine, a month", money(R_PRICE), "Refills and a daily skin supplement, chosen by Evelyn"),
          ("Product cost", "−$%.2f" % (R_PRICE * R_COGS), "Wholesale is usually about half the price"),
          ("Card fee", "−$%.2f" % R_FEE, "2.9% + 30¢"),
          ("Shipping and packaging", "−$%d" % R_SHIP, "Averaged: many pick up at a visit")]
PL_GOALS = [("Pay Evelyn $3,000 a month", subs_for_pay(3000), "Facials plus subscribers"),
            ("Pay Evelyn $4,000 a month", subs_for_pay(4000), "Facials plus subscribers"),
            ("Outsell the facials", math.ceil(F_SALES / R_PRICE), "More product sales than facial sales"),
            ("Out-earn the facials", math.ceil(F_KEPT / R_KEPT), "More kept from product than from facials")]
PL_HOW = [("Cap the facial spots", "12 facial memberships with a waitlist. Her time is the scarce thing, so facials can price up again."),
          ("Every facial ends with a routine", "The chair is where subscribers start: five facials a week become new routines."),
          ("The Glow Routine, $%d a month" % R_PRICE, "Evelyn’s pick of refills and a daily skin supplement, a seasonal update, a 15-minute video check-in each quarter, 10% off facials."),
          ("Start without inventory", "A practitioner dispensary ships supplements for you at a lower margin. Buy the steady sellers wholesale once they prove out."),
          ("Check before selling supplements", "Seller’s permit and sales tax, insurance that covers products, the brand’s own wording, and a doctor’s OK in pregnancy or on medication."),
          ("Expect more cancelling", "Plan for about 1 in 10 subscribers a month until real numbers arrive, so the chair and the site keep bringing new ones.")]

# ─────────────────────────── three ways to run it ───────────────────────────
# The same pay for Evelyn, with the money coming mostly from facials, half and
# half, or mostly from product. share = facials' part of all sales.
MODE_PAY = 4000
MODES = [
    {"id": "facials", "name": "Facials lead", "share": 0.8, "tag": "About 80% of sales from facials",
     "do": [("In the chair", "The Glow Membership at every facial; the routine as a take-home."),
            ("On the site", "Leads with facials and the membership. The Glow Routine sits in the shop."),
            ("Evelyn’s week", "Facial slots open Tuesday to Saturday."),
            ("Stock", "Shelf products for retail and the kits. No supplement stock."),
            ("Watch", "Members and facial bookings.")]},
    {"id": "even", "name": "50/50", "share": 0.5, "tag": "Half from facials, half from product",
     "do": [("In the chair", "Every facial ends with both: the membership or the routine, whichever fits."),
            ("On the site", "The membership and the Glow Routine side by side."),
            ("Evelyn’s week", "Four chair days, one day for boxes, check-ins and posts."),
            ("Stock", "Best sellers bought wholesale; supplements through a dispensary."),
            ("Watch", "The split: keep each side between 40% and 60%.")]},
    {"id": "product", "name": "Product leads", "share": 0.3, "tag": "About 70% of sales from product",
     "do": [("In the chair", "Facials become the premium spot: 12 member spots and a waitlist. Every facial starts a routine."),
            ("On the site", "Leads with the Glow Routine. Facials shown as limited."),
            ("Evelyn’s week", "Two or three chair days. The rest for video check-ins, posts and packing."),
            ("Stock", "Routine products wholesale, with 30 to 45 days on the shelf."),
            ("Watch", "Subscribers, and cancellations under 1 in 10 a month.")]}]


def solve(share, pay=MODE_PAY):
    """facials a month and subscribers for a pay goal and a sales split"""
    r = (R_PRICE / F_AVG) * share / (1 - share)           # facials per subscriber
    subs = (BILLS_TOTAL + pay) / (F_KEPT_EACH * r + R_KEPT)
    return r * subs, subs


for m in MODES:
    fm, sb = solve(m["share"])
    m.update(fpw=fm * 12 / 52, subs=math.ceil(sb), hours=fm * 12 / 52 * 1.25,
             fsales=fm * F_AVG, rsales=math.ceil(sb) * R_PRICE)

FLIP_WHEN = [("Toward product", "Product sales beat facial sales two months running, the facial book has a waitlist, or Evelyn wants fewer chair hours."),
             ("Toward facials", "Routine cancellations run over 1 in 10 a month, product keeps less than $40 of every $100, or facial demand outgrows the open slots."),
             ("One step at a time", "Go through 50/50 first and hold it a month. Members keep their plans and subscribers keep their boxes either way.")]
FLIP_HOW = [("The numbers", "Bookkeeping’s Coming in shows the split: services and dues against retail."),
            ("The site", "Swap which offer leads: the top of the page, the nudge card, the shop."),
            ("The chair", "Change the offer at the end of each facial."),
            ("Stock", "Raise or lower reorder levels on the dashboard."),
            ("Evelyn’s week", "Open or close facial slots in the booking calendar.")]

SCORE = [("Members", "Against the plan: %d by day 90" % PLAN),
         ("Offers made in the chair", "Every facial client, every visit"),
         ("Say-yes rate", "One in eight or better"),
         ("Cancellations", "Fewer than 1 in 20 a month"),
         ("Names on the talent list", "15 by week 4")]

money = lambda n: "${:,}".format(int(round(n)))


# ─────────────────────────── graphics ───────────────────────────
def pace_svg():
    X0, X1, Y0, Y1, YMAX = 48, 784, 262, 26, 30
    x = lambda w: X0 + (X1 - X0) * w / 13.0
    y = lambda v: Y0 - (Y0 - Y1) * v / YMAX
    ws = range(14)
    p = ['<svg class="chart pace" viewBox="0 0 800 300" role="img" aria-label="Members by week, first 90 days. '
         'The plan reaches %d members by week %d, when dues pay every business bill, and %d by day 90. The range runs from %d to %d."'
         '>' % (FLOOR, FLOOR_WEEK, PLAN, LOW[-1], HIGH[-1])]
    for i, (a, b, name) in enumerate(((0, 3, "Set up"), (3, 5, "Launch"), (5, 9, "In the chair"), (9, 13, "Win-back and referrals"))):
        p.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" class="st st%d"/>' % (x(a), Y1 - 8, x(b) - x(a), Y0 - Y1 + 8, i % 2))
        p.append('<text x="%.1f" y="%d" class="stl">%s</text>' % (x(a) + 8, Y1 + 8, name))
    for v in (5, 10, 15, 20, 25):
        p.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" class="grid"/>' % (X0, X1, y(v), y(v)))
        p.append('<text x="%d" y="%.1f" class="yl">%d</text>' % (X0 - 10, y(v) + 4, v))
    p.append('<line x1="%d" x2="%d" y1="%d" y2="%d" class="base"/>' % (X0, X1, Y0, Y0))
    for w, lab in ((0, "Now"), (4, "Week 4"), (8, "Week 8"), (13, "Day 90")):
        anchor = "start" if w == 0 else ("end" if w == 13 else "middle")
        p.append('<text x="%.1f" y="%d" class="xl" text-anchor="%s">%s</text>' % (x(w), Y0 + 22, anchor, lab))
    hi = " ".join("%.1f,%.1f" % (x(w), y(HIGH[w])) for w in ws)
    lo = " ".join("%.1f,%.1f" % (x(w), y(LOW[w])) for w in reversed(ws))
    p.append('<polygon class="band" points="%s %s"/>' % (hi, lo))
    # the floor: dues pay every bill
    p.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" class="floor"/>' % (X0, X1, y(FLOOR), y(FLOOR)))
    p.append('<text x="%.1f" y="%.1f" class="floorl">The minimum · %d members</text>' % (x(0.2), y(FLOOR) - 8, FLOOR))
    p.append('<path class="likely" pathLength="1" d="M%s"/>' % " L".join("%.1f,%.1f" % (x(w), y(LIKELY[w])) for w in ws))
    fx, fy = x(FLOOR_WEEK), y(LIKELY[FLOOR_WEEK])
    p.append('<circle class="cross" cx="%.1f" cy="%.1f" r="4.5"/>' % (fx, fy))
    p.append('<text class="crossl" x="%.1f" y="%.1f" text-anchor="middle">Week %d: bills covered</text>' % (fx, fy + 24, FLOOR_WEEK))
    ex, ey = x(13), y(LIKELY[13])
    p.append('<circle class="endpt" cx="%.1f" cy="%.1f" r="5"/>' % (ex, ey))
    p.append('<text class="endl" x="%.1f" y="%.1f" text-anchor="end">%d by day 90</text>' % (ex - 12, ey - 14, PLAN))
    p.append('</svg>')
    return "".join(p)


def lanes_svg():
    X0, X1 = 104, 784
    x = lambda m: X0 + (X1 - X0) * m / 24.0
    L1T, L1B = 26, 118                 # members lane, top/bottom
    ym = lambda v: L1B - (L1B - L1T) * v / 50.0
    B1, B2 = 150, 180                  # talent bars
    p = ['<svg class="chart lanes" viewBox="0 0 800 246" role="img" aria-label="After day 90, two engines. Members grow '
         'from %d at day 90 to 30 by month 6 and 50 by year 2. Talent: build the list to day 90, sign two artists in months 4 to 5, '
         'the pilot runs to month 12, then the Collective in year 2.">' % PLAN]
    p.append('<text x="0" y="%d" class="lanel">Members</text>' % ((L1T + L1B) // 2 + 4))
    p.append('<text x="0" y="%d" class="lanel">Talent</text>' % ((B1 + B2) // 2 + 4))
    for m in (0, 3, 6, 12, 24):
        p.append('<line x1="%.1f" x2="%.1f" y1="%d" y2="%d" class="grid"/>' % (x(m), x(m), L1T - 10, B2 + 8))
    pts = [(0, 0), (0.92, 3), (1.15, 5), (FLOOR_WEEK / 4.33, FLOOR), (3, PLAN), (6, 30), (12, 40), (24, 50)]
    line = " L".join("%.1f,%.1f" % (x(m), ym(v)) for m, v in pts)
    p.append('<path class="area" d="M%.1f,%d L%s L%.1f,%d Z"/>' % (x(0), L1B, line, x(24), L1B))
    p.append('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" class="floor"/>' % (X0, X1, ym(FLOOR), ym(FLOOR)))
    p.append('<text x="%.1f" y="%.1f" class="floorl" text-anchor="end">Minimum · %d</text>' % (x(24) - 4, ym(FLOOR) - 6, FLOOR))
    p.append('<path class="likely" pathLength="1" d="M%s"/>' % line)
    for m, v, lab, anc in ((3, PLAN, "%d" % PLAN, "middle"), (6, 30, "30", "middle"), (12, 40, "40", "middle"), (24, 50, "50", "end")):
        p.append('<circle class="dot" cx="%.1f" cy="%.1f" r="4"/>' % (x(m), ym(v)))
        p.append('<text class="dotl" x="%.1f" y="%.1f" text-anchor="%s">%s</text>' % (x(m) - (4 if anc == "end" else 0), ym(v) - 10, anc, lab))
    bars = [(0, 3, "Build the list", "b0"), (3, 5, "Sign two", "b1"), (5, 12, "Pilot · 2 artists", "b1"),
            (12, 15, "Find space", "b0"), (15, 24, "The Collective", "b2")]
    for a, b, lab, cls in bars:
        p.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" rx="8" class="bar %s"/>' % (x(a) + 1.5, B1, x(b) - x(a) - 3, B2 - B1, cls))
        p.append('<text x="%.1f" y="%d" class="barl %s">%s</text>' % ((x(a) + x(b)) / 2, B1 + 19, cls, lab))
        p[-1] = p[-1].replace('<text ', '<text text-anchor="middle" ', 1)
    for m, lab, anc in ((3, "Gate: %d+ members" % FLOOR, "start"), (12, "Gate: go or no-go", "start")):
        p.append('<line x1="%.1f" x2="%.1f" y1="%d" y2="%d" class="gate"/>' % (x(m), x(m), L1T - 14, B2 + 22))
        p.append('<text x="%.1f" y="%d" class="gatel" text-anchor="%s">%s</text>' % (x(m) + 5, B2 + 20, anc, lab))
    for m, lab in ((0, "Now"), (3, "Day 90"), (6, "Month 6"), (12, "Year 1"), (24, "Year 2")):
        anchor = "start" if m == 0 else ("end" if m == 24 else "middle")
        p.append('<text x="%.1f" y="%d" class="xl" text-anchor="%s">%s</text>' % (x(m), 240, anchor, lab))
    p.append('</svg>')
    return "".join(p)


# ─────────────────────────── html pieces ───────────────────────────
def rows(items, total=None, sub=True):
    h = '<div class="rows">'
    for it in items:
        h += '<div class="row"><span class="rn">%s</span><span class="rv">%s</span>%s</div>' % (
            it[0], it[1], ('<span class="rr">%s</span>' % it[2]) if sub and len(it) > 2 and it[2] else "")
    if total:
        h += '<div class="row tot"><span class="rn">%s</span><span class="rv">%s</span></div>' % total
    return h + '</div>'


def bills_rows():
    return rows([(n, money(v)) for n, v in BILLS], ("Every month", money(BILLS_TOTAL)))


def member_rows():
    return rows(MEMBER, ("Each member leaves", "$%d" % round(KEPT)))


def ladder_html():
    mx = max(LADDER) * KEPT
    h = '<div class="ladder"><div class="ld-row ld-h"><span>Members</span><span>Dues kept</span><span>Left for her pay</span><span></span></div>'
    for n in LADDER:
        kept, left = n * KEPT, n * KEPT - BILLS_TOTAL
        cls = " is-floor" if n == FLOOR else (" is-plan" if n == PLAN else "")
        tag = " <i>the minimum</i>" if n == FLOOR else (" <i>the plan</i>" if n == PLAN else "")
        left_s = ("+" + money(left)) if left >= 10 else ("even" if left >= 0 else "−" + money(-left))
        h += ('<div class="ld-row%s"><span class="ld-n">%d%s</span><span>%s</span><span class="ld-left%s">%s</span>'
              '<span class="ld-bar"><b style="width:%.1f%%"></b><em style="left:%.1f%%"></em></span></div>'
              % (cls, n, tag, money(kept), " neg" if left < 0 else "", left_s, kept / mx * 100, BILLS_TOTAL / mx * 100))
    return h + '</div>'


def pace_html():
    return '<div class="pace-t">' + "".join(
        '<div class="pc-row"><span class="pc-w">%s</span><span class="pc-t">%s</span><span class="pc-n num">%s</span></div>'
        % (w, t, ("%d" % n) if n else "—") for w, t, n in PACE) + '</div>'


def sources_html():
    return rows([(a, str(n), b) for a, b, n in SOURCES], ("By day 90", str(sum(n for _, _, n in SOURCES))))


def cards(items, cls="g"):
    return "".join('<div class="%s"><b>%s</b><p>%s</p></div>' % (cls, a, b) for a, b in items)


def talent_html(reveal=""):
    return "".join('<div class="g tl%s"><span class="tl-w">%s</span><b>%s</b><p>%s</p></div>' % (reveal, w, a, b) for w, a, b in TALENT)


def gate_html(reveal=""):
    h = ""
    for o in GATE:
        h += ('<div class="offer%s%s"><div class="of-tag">%s</div><div class="of-big">%s</div><p class="of-sub">%s</p><ul class="of-list">%s</ul></div>'
              % (" hl" if o["hl"] else "", reveal, o["tag"], o["big"], o["sub"],
                 "".join('<li><span class="ck"></span><span>%s</span></li>' % i for i in o["inc"])))
    return h


def engine_rows(items):
    return '<div class="rows">' + "".join(
        '<div class="row"><span class="rn"><span class="ek">%s</span>%s</span><span class="rv">%s</span></div>' % it for it in items) + '</div>'


FLOW = [("Days 1–90 · Members", "The offer after every facial. %d pays the bills; aim for %d." % (FLOOR, PLAN)),
        ("Alongside · Talent", "A list of 15 artists, coffee with three, pick two."),
        ("Day 90 · The gate", "%d+ members: sign two artists. Under: keep pushing." % FLOOR),
        ("After · Two engines", "30 members by month 6, the pilot live, then the Collective.")]


def flow_html(reveal=""):
    return "".join('<div class="fs%s"><div class="fi">%d</div><b>%s</b><span>%s</span></div>' % (reveal, i + 1, a, b)
                   for i, (a, b) in enumerate(FLOW))


def mode_cols_html():
    h = ""
    for m in MODES:
        fs = m["fsales"] / (m["fsales"] + m["rsales"]) * 100
        h += ('<div class="mode-col"><p class="mc-name">%s</p><p class="mc-tag">%s</p>'
              '<div class="mix"><b style="width:%.0f%%"></b></div><div class="mix-l"><span>Facials %d%%</span><span>Product %d%%</span></div>'
              '<div class="mc-stats"><div><b>%d</b><span>facials a week</span></div><div><b>%d</b><span>subscribers</span></div>'
              '<div><b>%d</b><span>hours in the chair</span></div></div><ul class="mc-do">%s</ul></div>'
              % (m["name"], m["tag"], fs, round(fs), 100 - round(fs), round(m["fpw"]), m["subs"], round(m["hours"]),
                 "".join('<li><b>%s</b> %s</li>' % d for d in m["do"][:3])))
    return h


def cards2(items):
    return "".join('<div class="c"><b>%s</b><span>%s</span></div>' % i for i in items)


def pl_goals_html():
    return "".join('<div class="c"><b>%s · %d subscribers</b><span>%s</span></div>' % (a, n, b) for a, n, b in PL_GOALS)


def pl_how_html():
    return "".join('<div class="c"><b>%s</b><span>%s</span></div>' % h for h in PL_HOW)


def score_html():
    return "".join('<div class="c"><b>%s</b><span>%s</span></div>' % s for s in SCORE)


def pay_html():
    return "".join('<div class="c"><b>%s a month · %d members</b><span>Business bills and pay: %s</span></div>'
                   % (money(p), pay_members(p), money(BILLS_TOTAL + p)) for p in PAY)


def onetime_html():
    return "".join('<div class="c"><b>%s · %s</b><span>%s</span></div>' % s for s in ONE_TIME)


# ─────────────────────────── css ───────────────────────────
LP_CSS = r"""
.chart .floor { stroke: #f4c9d6; stroke-width: 1.5; stroke-dasharray: 5 6; opacity: .85; }
.chart .floorl { fill: var(--rose); font-size: 12px; font-weight: 600; }
.chart .cross { fill: #000; stroke: #f4c9d6; stroke-width: 2.5; }
.chart .crossl { fill: var(--text-2); font-size: 11.5px; font-weight: 500; }
.lanes .lanel { fill: var(--text); font-size: 13px; font-weight: 600; }
.lanes .area { fill: rgba(244,201,214,.1); }
.lanes .dot { fill: #f4c9d6; stroke: #000; stroke-width: 2.5; }
.lanes .dotl { fill: var(--text); font-size: 12px; font-weight: 600; }
.lanes .bar.b0 { fill: #1f1f22; } .lanes .bar.b1 { fill: rgba(244,201,214,.22); } .lanes .bar.b2 { fill: #f0c2cf; }
.lanes .barl { fill: var(--text); font-size: 11.5px; font-weight: 600; } .lanes .barl.b2 { fill: #000; }
.lanes .gate { stroke: rgba(255,255,255,.35); stroke-width: 1; stroke-dasharray: 3 4; }
.lanes .gatel { fill: var(--text-2); font-size: 11px; font-weight: 500; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.stat { border-top: 1px solid var(--hair); padding-top: 12px; }
.stat .v { font-weight: 700; letter-spacing: -0.045em; line-height: 1; }
.stat .k { color: var(--text-2); margin-top: 6px; line-height: 1.4; }
.eq { display: flex; align-items: baseline; justify-content: center; gap: .5em; flex-wrap: wrap; background: var(--card); border-radius: 22px;
  font-weight: 700; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.eq .op { color: var(--text-3); font-weight: 500; }
.eq small { font-size: .38em; letter-spacing: -0.01em; font-weight: 500; color: var(--text-2); }
.ladder { background: var(--card); border-radius: 22px; }
.ld-row { display: grid; grid-template-columns: 1.25fr .9fr 1fr 1.6fr; gap: 12px; align-items: center; border-bottom: 1px solid var(--hair);
  font-variant-numeric: tabular-nums; }
.ld-row:last-child { border-bottom: 0; }
.ld-h { color: var(--text-3); font-weight: 500; }
.ld-n { font-weight: 600; }
.ld-n i { font-style: normal; font-weight: 500; color: var(--rose); margin-left: 4px; }
.ld-left { font-weight: 600; white-space: nowrap; } .ld-left.neg { color: var(--text-3); font-weight: 500; }
.ld-row.is-floor .ld-left, .ld-row.is-plan .ld-left { color: var(--rose); }
.ld-bar { position: relative; height: 8px; border-radius: 999px; background: #1f1f22; }
.ld-bar b { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--grad); }
.ld-bar em { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #fff; opacity: .7; border-radius: 1px; }
.ld-row:not(.is-floor):not(.is-plan) .ld-bar b { opacity: .45; }
.pace-t { background: var(--card); border-radius: 22px; }
.pc-row { display: grid; grid-template-columns: 6.2rem 1fr 3.2rem; gap: 14px; align-items: baseline; border-bottom: 1px solid var(--hair); }
.pc-row:last-child { border-bottom: 0; }
.pc-w { color: var(--rose); font-weight: 600; }
.pc-t { color: var(--text); line-height: 1.42; letter-spacing: -0.01em; }
.pc-n { text-align: right; font-weight: 700; letter-spacing: -0.03em; }
.tl .tl-w { display: block; color: var(--rose); font-weight: 600; margin-bottom: 6px; }
.ek { display: block; color: var(--rose); font-weight: 600; }
.four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.costs.five { grid-template-columns: repeat(5, 1fr); }
.costs.three { grid-template-columns: repeat(3, 1fr); }
.behind .c:last-child b { color: var(--text-3); }
.mix { position: relative; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #e2b08c, #f0c2cf); overflow: hidden; }
.mix b { position: absolute; inset: 0 auto 0 0; background: #f5f5f7; border-radius: 999px 0 0 999px; }
.mix-l { display: flex; justify-content: space-between; color: var(--text-2); margin-top: 6px; font-variant-numeric: tabular-nums; }
.mix-l span:last-child { color: var(--rose); }
.mode-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.mode-col { background: var(--card); border-radius: 16px; padding: 14px 16px; }
.mc-name { font-weight: 700; letter-spacing: -0.02em; }
.mc-tag { color: var(--text-3); margin: 2px 0 10px; }
.mc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 12px 0 8px; }
.mc-stats b { display: block; font-weight: 700; letter-spacing: -0.03em; }
.mc-stats span { color: var(--text-3); line-height: 1.25; display: block; }
.mc-do { list-style: none; margin: 0; padding: 8px 0 0; border-top: 1px solid var(--hair); display: grid; gap: 6px; }
.mc-do li { color: var(--text-2); line-height: 1.35; }
.mc-do b { display: block; color: var(--rose); font-weight: 600; }
"""

LP_WEB = r"""
.hero90 { padding: 96px 0 40px; }
.hero90 .h1 { font-size: clamp(3rem, 7.4vw, 6rem); }
.hero90 .lead { font-size: clamp(1.15rem, 2vw, 1.4rem); max-width: 40rem; margin-top: 22px; }
.hero90 .stats { margin-top: 44px; }
.stat .v { font-size: clamp(2.6rem, 6vw, 3.8rem); } .stat .k { font-size: .95rem; }
.eq { font-size: clamp(2.2rem, 6vw, 4rem); padding: 30px 24px; margin-top: 14px; }
.ladder { padding: 6px 22px; margin-top: 14px; }
.ld-row { padding: 13px 0; font-size: .98rem; } .ld-h { font-size: .8rem; }
.pace-t { padding: 6px 22px; }
.pc-row { padding: 16px 0; } .pc-w { font-size: .92rem; } .pc-t { font-size: 1.02rem; } .pc-n { font-size: 1.6rem; }
.calc { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; margin-top: 14px; }
.calc-in { background: var(--card); border-radius: 22px; padding: 22px 24px; display: grid; gap: 20px; }
.calc-in label { display: grid; grid-template-columns: 1fr auto; row-gap: 10px; font-size: .95rem; color: var(--text-2); }
.calc-in output { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.calc-in input { grid-column: 1 / -1; width: 100%; accent-color: #f0c2cf; }
.calc-out { border-radius: 22px; padding: 24px; display: flex; flex-direction: column; justify-content: center;
  background: linear-gradient(160deg, #2a1d23 0%, #16110f 100%); box-shadow: inset 0 0 0 1px rgba(244,201,214,.25); }
.calc-out .big { font-size: clamp(3.4rem, 8vw, 5rem); font-weight: 700; letter-spacing: -0.06em; line-height: .9; }
.co-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }
.co-pair > div + div { border-left: 1px solid rgba(244,201,214,.2); padding-left: 16px; }
.calc-out .t { font-size: 1rem; font-weight: 600; margin-top: 10px; letter-spacing: -0.015em; line-height: 1.3; }
.calc-out .s { color: var(--text-2); font-size: .92rem; margin-top: 8px; line-height: 1.45; }
.calc-note { color: var(--text-3); font-size: .85rem; margin-top: 12px; }
.mode-ui { display: grid; justify-items: center; gap: 18px; }
.mode-switch { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); padding: 5px; border-radius: 999px; background: #1a1a1d;
  width: min(520px, 100%); box-shadow: inset 0 0 0 1px var(--hair); --i: 0; }
.mode-switch button { position: relative; z-index: 1; font: inherit; font-size: .95rem; font-weight: 600; color: var(--text-2); background: none; border: 0;
  border-radius: 999px; padding: 11px 8px; cursor: pointer; transition: color .3s; }
.mode-switch button[aria-checked="true"] { color: #000; }
.mode-switch button:focus-visible { outline: 2px solid var(--rose); outline-offset: 2px; }
.ms-thumb { position: absolute; top: 5px; bottom: 5px; left: 5px; width: calc((100% - 10px) / 3); border-radius: 999px; background: var(--grad);
  transform: translateX(calc(var(--i) * 100%)); transition: transform .45s cubic-bezier(.3,.8,.2,1); box-shadow: 0 6px 24px -6px rgba(244,201,214,.6); }
.mode-pay { display: grid; grid-template-columns: 1fr auto; row-gap: 8px; width: min(520px, 100%); color: var(--text-2); font-size: .92rem; }
.mode-pay output { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.mode-pay input { grid-column: 1 / -1; width: 100%; accent-color: #f0c2cf; }
.mode-panel { width: 100%; background: var(--card); border-radius: 22px; padding: 24px; }
.mp-tag { color: var(--text-2); margin-bottom: 12px; }
.mix.big { height: 14px; }
.mix b { transition: width .6s cubic-bezier(.3,.8,.2,1); }
.mp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin: 22px 0 18px; }
.mp-stats b { display: block; font-size: clamp(2rem, 4.4vw, 2.8rem); font-weight: 700; letter-spacing: -0.045em; line-height: 1; }
.mp-stats span { display: block; color: var(--text-3); font-size: .85rem; margin-top: 6px; }
.mp-do { list-style: none; margin: 0; padding: 14px 0 0; border-top: 1px solid var(--hair); display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.mp-do li { color: var(--text-2); font-size: .9rem; line-height: 1.4; animation: mp-in .45s ease both; }
.mp-do b { display: block; color: var(--rose); font-weight: 600; margin-bottom: 2px; }
@keyframes mp-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ms-thumb, .mix b { transition: none; } .mp-do li { animation: none; } }
.tl { display: flex; flex-direction: column; }
.lanes .likely { stroke-width: 2.5; }
.mt { margin-top: 14px; } .mt2 { margin-top: 40px; }
.chart-scroll { overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
.chart-scroll::-webkit-scrollbar { display: none; }
.swipe-hint { display: none; color: var(--text-3); font-size: .8rem; margin: 8px 0 4px; }
@media (max-width: 860px) {
  /* charts keep a readable size on a phone and swipe sideways inside their card */
  .chart-scroll { margin: 0 -24px; padding: 0 24px; }
  .chart-scroll .chart { min-width: 660px; }
  .chart-scroll .pace { min-width: 560px; }
  .swipe-hint { display: block; }
  .chart-scroll .chart .stl { display: block; }
  .flow { grid-template-columns: 1fr 1fr; gap: 10px; }
  .flow .fs { padding: 18px 16px; } .flow .fs b { margin-top: 12px; font-size: 1rem; } .flow .fs span { font-size: .88rem; }
  .flow .fs:not(:last-child)::after { display: none; }
  .hero90 .stats { grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stat .v { font-size: 2.4rem; } .stat .k { font-size: .8rem; }
  .four, .three, .calc { grid-template-columns: 1fr; }
  .mp-stats { grid-template-columns: repeat(2, 1fr); } .mp-do { grid-template-columns: 1fr; }
  .mode-switch button { font-size: .85rem; padding: 10px 4px; }
  .costs.five, .costs.three { grid-template-columns: 1fr 1fr; }
  .ld-row { grid-template-columns: 1.3fr .9fr .9fr; } .ld-bar { grid-column: 1 / -1; }
  .pc-row { grid-template-columns: 1fr auto; } .pc-t { grid-column: 1 / -1; grid-row: 2; }
}
"""

LP_PRINT = r"""
.h1 { font-size: 52pt; }
.stat .v { font-size: 30pt; } .stat .k { font-size: 9pt; }
.eq { font-size: 25pt; padding: 10px 18px; border-radius: 16px; }
.ladder { padding: 2px 16px; border-radius: 16px; }
.ld-row { padding: 4px 0; font-size: 9.5pt; } .ld-h { font-size: 7.8pt; }
.pace-t { padding: 2px 16px; border-radius: 16px; }
.pc-row { grid-template-columns: 0.95in 1fr 0.45in; padding: 8px 0; gap: 12px; }
.pc-w { font-size: 9pt; } .pc-t { font-size: 9.6pt; } .pc-n { font-size: 15pt; }
.four, .three { gap: 12px; }
.g.tl { padding: 14px 16px; } .tl .tl-w { font-size: 8.5pt; margin-bottom: 4px; } .g.tl p { font-size: 9.2pt; }
.ek { font-size: 8.5pt; }
.sub-h { font-size: 11pt; font-weight: 650; letter-spacing: -0.015em; margin-bottom: 6px; }
.lanes .likely { stroke-width: 2.5; }
.costs.how { row-gap: 10px; }
.mode-col { padding: 12px 14px; } .mc-name { font-size: 12pt; } .mc-tag { font-size: 8.4pt; } .mix-l { font-size: 8.4pt; }
.mc-stats b { font-size: 16pt; } .mc-stats span { font-size: 7.6pt; } .mc-do li { font-size: 8.4pt; }
"""

WEB_JS = r"""
(function () {
  "use strict";
  var rm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm || !("IntersectionObserver" in window)) document.documentElement.classList.add("no-motion");
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.2 }) : null;
  document.querySelectorAll(".reveal").forEach(function (el) { if (io) io.observe(el); });

  /* the calculator: how many members pay every bill */
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var calc = function () {
    var bills = +$("c-bills").value, sup = +$("c-sup").value, dues = +$("c-dues").value, pay = +$("c-pay").value;
    var kept = dues - (dues * 0.029 + 0.30) - sup - __PERKS__;
    var floor = Math.ceil(bills / kept);
    $("o-bills").textContent = fmt(bills);
    $("o-sup").textContent = fmt(sup);
    $("o-dues").textContent = fmt(dues);
    $("o-floor").textContent = floor;
    $("o-pay").textContent = fmt(pay);
    $("o-payn").textContent = Math.ceil((bills + pay) / kept);
    $("o-payt").textContent = pay ? "members also pay Evelyn " + fmt(pay) + " a month" : "set her pay to see this";
    $("o-plan").textContent = "Aim for " + (floor + 3) + " by day 90, with room for a cancellation.";
    $("o-sub").textContent = "Each member leaves " + fmt(kept) + ". At 30 members, dues leave " +
      fmt(30 * kept - bills) + " a month for her pay.";
  };
  ["c-bills", "c-sup", "c-dues", "c-pay"].forEach(function (id) { $(id).addEventListener("input", calc); });
  calc();

  /* if product leads: facials a week + Glow Routine subscribers */
  var pcalc = function () {
    var fpw = +$("p-fpw").value, favg = +$("p-favg").value, r = +$("p-r").value, cogs = +$("p-cogs").value / 100,
        bills = +$("p-bills").value, pay = +$("p-pay").value;
    var fm = fpw * 52 / 12, fKeptEach = favg - (favg * 0.029 + 0.30) - __SUP__;
    var fSales = fm * favg, fKept = fm * fKeptEach, left = fKept - bills;
    var rKept = r * (1 - cogs) - (r * 0.029 + 0.30) - 4;
    $("po-fpw").textContent = fpw; $("po-favg").textContent = fmt(favg); $("po-r").textContent = fmt(r);
    $("po-cogs").textContent = Math.round(cogs * 100) + "%"; $("po-bills").textContent = fmt(bills); $("po-pay").textContent = fmt(pay);
    $("po-left").textContent = (left < 0 ? "−" : "") + fmt(Math.abs(left));
    var need = rKept > 0 ? Math.max(0, Math.ceil((pay - left) / rKept)) : Infinity;
    $("po-subs").textContent = isFinite(need) ? need : "—";
    $("po-subs-t").textContent = "subscribers pay Evelyn " + fmt(pay) + " a month";
    $("po-sell").textContent = "Outsell the facials at " + Math.ceil(fSales / r) + " subscribers.";
    $("po-earn").textContent = rKept > 0 ? "Out-earn them at " + Math.ceil(fKept / rKept) + ". Each subscriber leaves " + fmt(rKept) + "."
      : "At this cost the routine loses money on every box.";
  };
  ["p-fpw", "p-favg", "p-r", "p-cogs", "p-bills", "p-pay"].forEach(function (id) { $(id).addEventListener("input", pcalc); });
  pcalc();

  /* three ways to run it: the same pay, a different split */
  var MODES = __MODES_JSON__;
  var mode = MODES[0];
  var mpaint = function () {
    var pay = +$("m-pay").value;
    var fav = __F_AVG__, fk = __F_KEPT__, rp = __R_PRICE__, rk = __R_KEPT__, bills = __BILLS_N__;
    var r = (rp / fav) * mode.share / (1 - mode.share);
    var subs = Math.ceil((bills + pay) / (fk * r + rk)), fm = r * (bills + pay) / (fk * r + rk);
    var fs = fm * fav, rs = subs * rp, share = Math.round(fs / (fs + rs) * 100);
    $("mo-pay").textContent = fmt(pay);
    $("mp-tag").textContent = mode.tag;
    $("mp-mix").style.width = share + "%";
    $("mp-fs").textContent = "Facials " + share + "% \u00b7 " + fmt(fs) + " a month";
    $("mp-rs").textContent = "Product " + (100 - share) + "% \u00b7 " + fmt(rs) + " a month";
    $("mp-fpw").textContent = Math.round(fm * 12 / 52);
    $("mp-subs").textContent = subs;
    $("mp-hours").textContent = Math.round(fm * 12 / 52 * 1.25);
    $("mp-pay").textContent = fmt(pay);
    $("mp-do").innerHTML = mode.do.map(function (d) { return "<li><b>" + d[0] + "</b>" + d[1] + "</li>"; }).join("");
    var sw = document.querySelector(".mode-switch");
    sw.style.setProperty("--i", MODES.indexOf(mode));
    sw.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-mode") === mode.id)); });
  };
  var msw = document.querySelector(".mode-switch");
  msw.addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]");
    if (b) { mode = MODES.filter(function (m) { return m.id === b.getAttribute("data-mode"); })[0]; mpaint(); }
  });
  msw.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var i = (MODES.indexOf(mode) + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length;
    mode = MODES[i]; mpaint(); msw.querySelector('[data-mode="' + mode.id + '"]').focus(); e.preventDefault();
  });
  $("m-pay").addEventListener("input", mpaint);
  mpaint();
})();
"""


# ─────────────────────────── pages ───────────────────────────
HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lumevina First 90 Days</title>
<meta name="description" content="The minimum members Lumevina needs by day 90 to run in profit, the weekly pace to get there, and the talent search alongside it.">
<style>__CSS__</style>
</head>
<body>
"""

WEB_BODY = """
<section class="hero90">
  <div class="wrap">
    <p class="kicker reveal">Lumevina · The first 90 days</p>
    <h1 class="h1 reveal" style="margin-top:18px">__FLOOR_W__ members.<br><span class="grad">Ninety days.</span></h1>
    <p class="lead reveal">The fewest members Lumevina needs by day 90 for dues to pay every business bill, the weekly pace to get there,
    and how the talent search runs alongside it. After day 90, both keep growing.</p>
    <div class="stats reveal">
      <div class="stat"><div class="v grad num">__FLOOR__</div><div class="k">The minimum by day 90. Dues pay every business bill.</div></div>
      <div class="stat"><div class="v num">__PLAN__</div><div class="k">The plan by day 90, with room for a cancellation or a slow month.</div></div>
      <div class="stat"><div class="v num">30</div><div class="k">By month 6, then 50 by year 2. Artists sign from month 4.</div></div>
    </div>
    <div class="chart-card reveal mt2">
      <h3>Members, week by week</h3>
      <p class="sub">Line: the plan. Shaded: slow to strong. Dashed: the minimum, where dues pay every business bill.</p>
      <div class="chart-scroll">__PACE_SVG__</div><p class="swipe-hint">Swipe the chart to see day 90 &rarr;</p>
    </div>
    <div class="flow mt">__FLOW__</div>
    <p class="foot-note reveal">Three ways to run it: <a href="#switch" style="color:var(--rose)">facials lead, 50/50, or product leads</a>.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">The minimum</p>
      <h2 class="h2" style="margin-top:14px">Why __FLOOR_W_L__. <span class="dim">Dues pay the business.</span></h2>
      <p class="lead">Membership dues arrive before the month starts. Once they cover the business&rsquo;s bills, every other booking,
      add-on and product is profit, and a slow week can&rsquo;t sink the month.</p>
    </div>
    <div class="num-grid">
      <div class="reveal"><div class="cols-h">The business&rsquo;s monthly bills</div><div class="cols-s">Spa costs only. Home, car and food come from her pay</div>__BILLS__</div>
      <div class="reveal"><div class="cols-h">What each member leaves</div><div class="cols-s">Per member, per month</div>__MEMBER__</div>
    </div>
    <div class="eq reveal"><span>__BILLS_TOTAL__</span><span class="op">÷</span><span>$__KEPT__</span><span class="op">=</span><span class="grad">__FLOOR__ members</span></div>
    <div class="reveal mt2"><div class="cols-h">What each step up the ladder leaves</div><div class="cols-s">Dues only. What&rsquo;s left after the business&rsquo;s bills is what Evelyn pays herself from</div>__LADDER__</div>
    <div class="reveal mt2"><div class="cols-h">Paying Evelyn too</div><div class="cols-s">Members for dues alone to cover the business and her monthly pay, before taxes. Her regular bookings pay her too, so this is the members-only view</div>
      <div class="costs three">__PAY__</div></div>
    <div class="reveal mt2"><div class="cols-h">Try your real numbers</div><div class="cols-s">Move the sliders to Evelyn&rsquo;s actual rent and costs</div>
      <div class="calc">
        <div class="calc-in">
          <label for="c-bills">Business bills a month <output id="o-bills"></output><input id="c-bills" type="range" min="800" max="3200" step="50" value="__BILLS_N__"></label>
          <label for="c-sup">Supplies per facial <output id="o-sup"></output><input id="c-sup" type="range" min="5" max="30" step="1" value="__SUP_N__"></label>
          <label for="c-dues">Average dues <output id="o-dues"></output><input id="c-dues" type="range" min="149" max="199" step="1" value="__DUES_N__"></label>
          <label for="c-pay">Evelyn&rsquo;s pay, before taxes <output id="o-pay"></output><input id="c-pay" type="range" min="0" max="8000" step="250" value="__PAY_N__"></label>
        </div>
        <div class="calc-out" aria-live="polite">
          <div class="co-pair">
            <div><div class="big grad num" id="o-floor"></div><div class="t">members pay the business</div></div>
            <div><div class="big num" id="o-payn"></div><div class="t" id="o-payt"></div></div>
          </div>
          <p class="s" id="o-plan"></p><p class="s" id="o-sub"></p></div>
      </div>
      <p class="calc-note">Card fee 2.9% + 30¢ and $__PERKS__ of member perks are included. Pay is before taxes, and her regular
      bookings, waxing, add-ons and retail pay her too, so the second number is the members-only view.</p>
    </div>
    <div class="reveal mt2"><div class="cols-h">One-time launch costs</div><div class="cols-s">About __ONETIME_TOTAL__, paid back from dues above the business&rsquo;s bills by month 5</div>
      <div class="costs three">__ONETIME__</div></div>
    <p class="foot-note reveal">Why it&rsquo;s growth, not moved money: a regular who came every seven weeks spent about $121 a month.
    As a Glow member she spends $159, comes every month, and pays first.</p>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">How to get there</p>
      <h2 class="h2" style="margin-top:14px">Thirteen weeks. <span class="dim">One offer at a time.</span></h2>
      <p class="lead">Most of the first members are clients who already love Evelyn. The plan is to ask every one of them,
      at the right moment, with next month&rsquo;s facial booked on the spot.</p>
    </div>
    <div class="reveal"><div class="rows-head"><div class="cols-h">Week by week</div><div class="cols-s">Members by the end of each stretch · the plan</div></div>__PACE__</div>
    <div class="num-grid mt2">
      <div class="reveal"><div class="cols-h">Where the __PLAN__ come from</div><div class="cols-s">The plan, by day 90</div>__SOURCES__</div>
      <div class="reveal"><div class="cols-h">__SCRIPT_K__</div><div class="cols-s">Two minutes at the end of every facial</div>
        <div class="offer hl"><p class="of-big" style="font-size:1.5rem;line-height:1.3;letter-spacing:-0.02em">__SCRIPT_V__</p>
        <p class="of-ask">Book it before she leaves. A facial on the calendar is a member who stays.</p></div></div>
    </div>
    <div class="reveal mt2"><div class="cols-h">If week 7 ends under __BEHIND_N__ members</div><div class="cols-s">Pull these levers, in this order</div>
      <div class="costs behind four">__BEHIND__</div></div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">Talent, alongside</p>
      <h2 class="h2" style="margin-top:14px">Scout now. <span class="dim">Sign at day 90.</span></h2>
      <p class="lead">Both run from day one. The talent search is about two hours a week, mostly Ruben, and never takes
      Evelyn out of the treatment room. Nothing gets signed until the members are there to offer.</p>
    </div>
    <div class="three">__TALENT__</div>
    <div class="offers mt">__GATE__</div>
    <div class="perk reveal"><b>__WHY_K__</b><span>__WHY_V__</span></div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">After day 90</p>
      <h2 class="h2" style="margin-top:14px">Two engines. <span class="dim">Both keep running.</span></h2>
      <p class="lead">Members keep coming from the chair and from referrals. Artists add a second income on top.
      Each gate is a number, so every step is earned by the one before it.</p>
    </div>
    <div class="chart-card reveal">
      <h3>The next two years</h3>
      <p class="sub">Members above; the talent track below. Dashed lines are the gates.</p>
      <div class="chart-scroll">__LANES_SVG__</div><p class="swipe-hint">Swipe the chart to see year 2 &rarr;</p>
    </div>
    <div class="num-grid">
      <div class="reveal"><div class="rows-head" style="padding-top:22px"><div class="cols-h">Engine 1 · Members</div><div class="cols-s">The chair, referrals, the site</div></div>__ENGINE_M__</div>
      <div class="reveal"><div class="rows-head" style="padding-top:22px"><div class="cols-h">Engine 2 · Talent</div><div class="cols-s">Matches the Growth Blueprint&rsquo;s pipeline</div></div>__ENGINE_T__</div>
    </div>
    <p class="foot-note reveal">Once artists join, members&rsquo; 10% with them costs Lumevina about $__ARTIST__ a member a month, __ARTIST_NOTE__.</p>
    <div class="reveal mt2"><div class="cols-h">The Saturday scoreboard</div><div class="cols-s">Five numbers, every week. The dashboard&rsquo;s Glow Membership card and launch ledger count most of them.</div>
      <div class="costs five">__SCORE__</div></div>
  </div>
</section>

<section id="switch">
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">Three ways to run it</p>
      <h2 class="h2" style="margin-top:14px">Flip the lead. <span class="dim">Keep the pay.</span></h2>
      <p class="lead">The same pay for Evelyn with the money coming mostly from facials, half and half, or mostly from product.
      Switch to see what changes, and flip the business the same way when the sales say so.</p>
    </div>
    <div class="mode-ui reveal">
      <div class="mode-switch" role="radiogroup" aria-label="How Lumevina runs">
        <span class="ms-thumb" aria-hidden="true"></span>
        <button type="button" role="radio" aria-checked="true" data-mode="facials">Facials lead</button>
        <button type="button" role="radio" aria-checked="false" data-mode="even">50/50</button>
        <button type="button" role="radio" aria-checked="false" data-mode="product">Product leads</button>
      </div>
      <label class="mode-pay" for="m-pay">Evelyn&rsquo;s pay, before taxes <output id="mo-pay"></output>
        <input id="m-pay" type="range" min="1000" max="8000" step="250" value="__MODE_PAY_N__"></label>
      <div class="mode-panel" aria-live="polite">
        <p class="mp-tag" id="mp-tag"></p>
        <div class="mix big"><b id="mp-mix"></b></div>
        <div class="mix-l"><span id="mp-fs"></span><span id="mp-rs"></span></div>
        <div class="mp-stats">
          <div><b class="num" id="mp-fpw"></b><span>facials a week</span></div>
          <div><b class="num" id="mp-subs"></b><span>Glow Routine subscribers</span></div>
          <div><b class="num" id="mp-hours"></b><span>hours in the chair a week</span></div>
          <div><b class="num grad" id="mp-pay"></b><span>for Evelyn, after the bills</span></div>
        </div>
        <ul class="mp-do" id="mp-do"></ul>
      </div>
    </div>
    <div class="perk reveal"><b>The honest read</b><span>__MODE_READ__</span></div>
    <div class="reveal mt2"><div class="cols-h">When to flip</div><div class="cols-s">The numbers decide, not the mood of one month</div>
      <div class="costs three">__FLIP_WHEN__</div></div>
    <div class="reveal mt2"><div class="cols-h">The flip, in a week</div><div class="cols-s">Five things change; nothing is lost</div>
      <div class="costs five">__FLIP_HOW__</div></div>
  </div>
</section>

<section id="product">
  <div class="wrap">
    <div class="sec-head center reveal">
      <p class="kicker">Another way · if product leads</p>
      <h2 class="h2" style="margin-top:14px">Five facials a week. <span class="dim">The shelf does the rest.</span></h2>
      <p class="lead">If Evelyn keeps the chair to about __PL_FPW__ facials a week, a monthly product subscription can carry the rest.
      It earns less per dollar but takes none of her hours.</p>
    </div>
    <div class="num-grid">
      <div class="reveal"><div class="cols-h">The chair · __PL_FPW__ facials a week</div><div class="cols-s">Facials still pay the bills, with some left over</div>__PL_CHAIR__</div>
      <div class="reveal"><div class="cols-h">What each Glow Routine subscriber leaves</div><div class="cols-s">Per subscriber, per month</div>__PL_SUB__</div>
    </div>
    <div class="perk reveal"><b>The trade</b><span>$100 of facials keeps about $__PL_F100__; $100 of product keeps about $__PL_R100__. A facial member keeps
    about $__PL_MEMBER__ a month and takes an hour of Evelyn&rsquo;s time; a subscriber keeps about $__PL_RKEPT__ and takes none. About __PL_RATIO__
    subscribers earn what one member does.</span></div>
    <div class="reveal mt2"><div class="cols-h">Subscribers needed</div><div class="cols-s">Glow Routine at $__PL_RPRICE__ a month, with five facials a week</div>
      <div class="costs four">__PL_GOALS__</div></div>
    <div class="reveal mt2"><div class="cols-h">Try it</div><div class="cols-s">Facials a week, prices and product cost</div>
      <div class="calc">
        <div class="calc-in">
          <label for="p-fpw">Facials a week <output id="po-fpw"></output><input id="p-fpw" type="range" min="1" max="25" step="1" value="__PL_FPW__"></label>
          <label for="p-favg">Average facial <output id="po-favg"></output><input id="p-favg" type="range" min="150" max="260" step="5" value="__PL_FAVG__"></label>
          <label for="p-r">Glow Routine a month <output id="po-r"></output><input id="p-r" type="range" min="40" max="150" step="5" value="__PL_RPRICE__"></label>
          <label for="p-cogs">Product cost, share of price <output id="po-cogs"></output><input id="p-cogs" type="range" min="30" max="70" step="5" value="50"></label>
          <label for="p-bills">Business bills a month <output id="po-bills"></output><input id="p-bills" type="range" min="800" max="3200" step="50" value="__BILLS_N__"></label>
          <label for="p-pay">Evelyn&rsquo;s pay, before taxes <output id="po-pay"></output><input id="p-pay" type="range" min="0" max="8000" step="250" value="__PAY_N__"></label>
        </div>
        <div class="calc-out" aria-live="polite">
          <div class="co-pair">
            <div><div class="big grad num" id="po-subs"></div><div class="t" id="po-subs-t"></div></div>
            <div><div class="big num" id="po-left"></div><div class="t">left from facials after the bills</div></div>
          </div>
          <p class="s" id="po-sell"></p><p class="s" id="po-earn"></p></div>
      </div>
      <p class="calc-note">Supplies $__SUP_N__ a facial and card fees are included. Subscribers carry $4 of shipping and packaging, averaged.</p>
    </div>
    <div class="reveal mt2"><div class="cols-h">How to run it</div><div class="cols-s">If this becomes the plan</div>
      <div class="costs three how">__PL_HOW__</div></div>
    <p class="foot-note reveal">At five facials a week, a part-time or shared room could cut the biggest bill. Every __PL_STEP__ less a month is one fewer
    member, or about __PL_STEP_SUBS__ fewer subscribers.</p>
  </div>
</section>

<section class="close">
  <div class="wrap center reveal">
    <h2 class="h2">__FLOOR_W__ by day ninety. <span class="grad">Then keep building.</span></h2>
    <p class="fine">All figures are estimates from current menu prices and assumed costs. Replace the bills with Evelyn&rsquo;s real
    statements before deciding. A companion to the Lumevina Growth Blueprint. Not financial or legal advice.</p>
  </div>
</section>
<script>__JS__</script>
</body>
</html>
"""

PRINT_BODY = """
<section class="page">
  <div>
    <p class="kicker">Lumevina · The first 90 days</p>
    <h1 class="h1" style="margin-top:12px">__FLOOR_W__ members.<br><span class="grad">Ninety days.</span></h1>
    <p class="lead" style="margin-top:16px;max-width:6.4in">The fewest members Lumevina needs by day 90 for dues to pay every business bill,
    the weekly pace to get there, and how the talent search runs alongside it.</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="v grad num">__FLOOR__</div><div class="k">The minimum by day 90. Dues pay every business bill.</div></div>
    <div class="stat"><div class="v num">__PLAN__</div><div class="k">The plan by day 90, with room for a cancellation or a slow month.</div></div>
    <div class="stat"><div class="v num">30</div><div class="k">By month 6, then 50 by year 2. Artists sign from month 4.</div></div>
  </div>
  <div class="chart-card">
    <h3>Members, week by week</h3>
    <p class="sub">Line: the plan. Shaded: slow to strong. Dashed: the minimum, where dues pay every business bill.</p>
    __PACE_SVG__
  </div>
  <div class="flow">__FLOW__</div>
  <p class="fine" style="font-size:9pt;color:var(--text-2)">Pages 6 and 7: three ways to run it (facials lead, 50/50, product leads), and what the product-led version needs.</p>
  __F1__
</section>

<section class="page tight">
  <div>
    <p class="kicker">The minimum</p>
    <h2 class="h2" style="margin-top:10px">Why __FLOOR_W_L__. <span class="dim">Dues pay the business.</span></h2>
    <p class="lead" style="margin-top:10px;font-size:11pt">Dues arrive first. Once they cover the business&rsquo;s bills, everything else is profit.</p>
  </div>
  <div class="two">
    <div><div class="cols-h">The business&rsquo;s monthly bills</div><div class="cols-s">Spa costs only. Home, car and food come from her pay</div>__BILLS__</div>
    <div><div class="cols-h">What each member leaves</div><div class="cols-s">Per member, per month</div>__MEMBER__</div>
  </div>
  <div class="eq"><span>__BILLS_TOTAL__</span><span class="op">÷</span><span>$__KEPT__</span><span class="op">=</span><span class="grad">__FLOOR__ members</span></div>
  <div><div class="cols-h">What each step up the ladder leaves</div><div class="cols-s">Dues only. What&rsquo;s left after the business&rsquo;s bills is what Evelyn pays herself from</div>__LADDER__</div>
  <div><div class="cols-h">One-time launch costs</div><div class="cols-s">About __ONETIME_TOTAL__, paid back from dues above the business&rsquo;s bills by month 5</div>
    <div class="costs three">__ONETIME__</div></div>
  <div><div class="cols-h">Paying Evelyn too</div><div class="cols-s">Members for dues alone to cover the business and her monthly pay, before taxes. Her regular bookings pay her too</div>
    <div class="costs three">__PAY__</div></div>
  <p class="fine" style="font-size:8.5pt;color:var(--text-2)">Why it&rsquo;s growth, not moved money: a regular who came every seven weeks
  spent about $121 a month. As a Glow member she spends $159, comes every month, and pays first.</p>
  __F2__
</section>

<section class="page tight">
  <div>
    <p class="kicker">How to get there</p>
    <h2 class="h2" style="margin-top:10px">Thirteen weeks. <span class="dim">One offer at a time.</span></h2>
  </div>
  <div><div class="cols-h">Week by week</div><div class="cols-s">Members by the end of each stretch · the plan</div>__PACE__</div>
  <div class="two">
    <div><div class="cols-h">Where the __PLAN__ come from</div><div class="cols-s">The plan, by day 90</div>__SOURCES__</div>
    <div><div class="cols-h">__SCRIPT_K__</div><div class="cols-s">Two minutes at the end of every facial</div>
      <div class="offer hl"><p class="of-big" style="font-size:13pt;line-height:1.35;letter-spacing:-0.015em">__SCRIPT_V__</p>
      <p class="of-ask">Book it before she leaves. A facial on the calendar is a member who stays.</p></div></div>
  </div>
  <div><div class="cols-h">If week 7 ends under __BEHIND_N__ members</div><div class="cols-s">Pull these levers, in this order</div>
    <div class="costs behind" style="grid-template-columns:repeat(4,1fr)">__BEHIND__</div></div>
  __F3__
</section>

<section class="page">
  <div>
    <p class="kicker">Talent, alongside</p>
    <h2 class="h2" style="margin-top:10px">Scout now. <span class="dim">Sign at day 90.</span></h2>
    <p class="lead" style="margin-top:12px;font-size:11pt">Both run from day one. The talent search is about two hours a week, mostly Ruben,
    and never takes Evelyn out of the treatment room. Nothing gets signed until the members are there to offer.</p>
  </div>
  <div class="three">__TALENT__</div>
  <div><div class="cols-h">The day-90 gate</div><div class="cols-s">One number decides the next step</div>
    <div class="offers">__GATE__</div></div>
  <div class="perk"><b>__WHY_K__</b><span>__WHY_V__</span></div>
  <div><div class="cols-h">The Saturday scoreboard</div><div class="cols-s">Five numbers, every week. The dashboard counts most of them.</div>
    <div class="costs" style="grid-template-columns:repeat(5,1fr)">__SCORE__</div></div>
  __F4__
</section>

<section class="page">
  <div>
    <p class="kicker">After day 90</p>
    <h2 class="h2" style="margin-top:10px">Two engines. <span class="dim">Both keep running.</span></h2>
    <p class="lead" style="margin-top:12px;font-size:11pt">Members keep coming from the chair and from referrals. Artists add a second
    income on top. Each gate is a number, so every step is earned by the one before it.</p>
  </div>
  <div class="chart-card">
    <h3>The next two years</h3>
    <p class="sub">Members above; the talent track below. Dashed lines are the gates.</p>
    __LANES_SVG__
  </div>
  <div class="two">
    <div><div class="cols-h">Engine 1 · Members</div><div class="cols-s">The chair, referrals, the site</div>__ENGINE_M__</div>
    <div><div class="cols-h">Engine 2 · Talent</div><div class="cols-s">Matches the Growth Blueprint&rsquo;s pipeline</div>__ENGINE_T__</div>
  </div>
  <p class="fine" style="font-size:8.5pt;color:var(--text-2)">Once artists join, members&rsquo; 10% with them costs Lumevina about $__ARTIST__
  a member a month, __ARTIST_NOTE__.</p>
  <div class="closer">
    <h2 class="h2">__FLOOR_W__ by day ninety. <span class="grad">Then keep building.</span></h2>
    <p class="fine" style="margin-top:10px">All figures are estimates from current menu prices and assumed costs. Replace the bills with
    Evelyn&rsquo;s real statements before deciding. A companion to the Lumevina Growth Blueprint. Not financial or legal advice.</p>
  </div>
  __F5__
</section>

<section class="page tight">
  <div>
    <p class="kicker">Three ways to run it</p>
    <h2 class="h2" style="margin-top:10px">Flip the lead. <span class="dim">Keep the pay.</span></h2>
    <p class="lead" style="margin-top:10px;font-size:11pt">__MODE_PAY__ a month for Evelyn, after the bills, three ways. The web version has the switch.</p>
  </div>
  <div class="mode-cols">__MODE_COLS__</div>
  <div class="perk"><b>The honest read</b><span>__MODE_READ__</span></div>
  <div><div class="cols-h">When to flip</div><div class="cols-s">The numbers decide, not the mood of one month</div>
    <div class="costs three">__FLIP_WHEN__</div></div>
  <div><div class="cols-h">The flip, in a week</div><div class="cols-s">Five things change; nothing is lost</div>
    <div class="costs" style="grid-template-columns:repeat(5,1fr)">__FLIP_HOW__</div></div>
  __F6__
</section>

<section class="page tight">
  <div>
    <p class="kicker">Another way · if product leads</p>
    <h2 class="h2" style="margin-top:10px">Five facials. <span class="dim">The shelf does the rest.</span></h2>
    <p class="lead" style="margin-top:10px;font-size:11pt">About five facials a week, and a monthly product subscription that takes none of Evelyn&rsquo;s hours.</p>
  </div>
  <div class="two">
    <div><div class="cols-h">The chair · __PL_FPW__ facials a week</div><div class="cols-s">Facials still pay the bills, with some left over</div>__PL_CHAIR__</div>
    <div><div class="cols-h">What each Glow Routine subscriber leaves</div><div class="cols-s">Per subscriber, per month</div>__PL_SUB__</div>
  </div>
  <div class="perk"><b>The trade</b><span>$100 of facials keeps about $__PL_F100__; $100 of product keeps about $__PL_R100__. A member keeps about
  $__PL_MEMBER__ and takes an hour; a subscriber keeps about $__PL_RKEPT__ and takes none. About __PL_RATIO__ subscribers earn what one member does.</span></div>
  <div><div class="cols-h">Subscribers needed</div><div class="cols-s">Glow Routine at $__PL_RPRICE__ a month, with five facials a week</div>
    <div class="costs" style="grid-template-columns:repeat(4,1fr)">__PL_GOALS__</div></div>
  <div><div class="cols-h">How to run it</div><div class="cols-s">If this becomes the plan</div>
    <div class="costs three how">__PL_HOW__</div></div>
  <p class="fine" style="font-size:8.5pt;color:var(--text-2)">At five facials a week, a part-time or shared room could cut the biggest bill.
  Every __PL_STEP__ less a month is one fewer member, or about __PL_STEP_SUBS__ fewer subscribers.</p>
  __F7__
</section>
</body>
</html>
"""



def fill(h, web):
    rv = " reveal" if web else ""
    rep = {
        "__FLOOR_W__": WORDS.get(FLOOR, str(FLOOR)), "__FLOOR_W_L__": WORDS.get(FLOOR, str(FLOOR)).lower(),
        "__FLOOR__": str(FLOOR), "__PLAN__": str(PLAN), "__FLOOR2__": str(FLOOR_WITH_ARTISTS),
        "__KEPT__": "%d" % round(KEPT), "__BILLS_TOTAL__": money(BILLS_TOTAL), "__ARTIST__": "%d" % ARTIST_PERK,
        "__BILLS_N__": str(BILLS_TOTAL), "__SUP_N__": "%d" % SUPPLIES, "__DUES_N__": "%d" % DUES, "__PERKS__": "%.2f" % PERKS, "__ONETIME_TOTAL__": money(ONE_TIME_TOTAL), "__BEHIND_N__": str(LIKELY[7] - 2),
        "__ARTIST_NOTE__": ("and the minimum moves to %d" % FLOOR_WITH_ARTISTS) if FLOOR_WITH_ARTISTS > FLOOR
                           else ("and the minimum stays at %d" % FLOOR),
        "__PACE_SVG__": pace_svg(), "__LANES_SVG__": lanes_svg(),
        "__BILLS__": bills_rows(), "__MEMBER__": member_rows(), "__LADDER__": ladder_html(),
        "__ONETIME__": onetime_html(), "__PAY__": pay_html(), "__PAY_N__": str(PAY_DEFAULT), "__PACE__": pace_html(), "__SOURCES__": sources_html(),
        "__SCRIPT_K__": SCRIPT[0], "__SCRIPT_V__": SCRIPT[1],
        "__BEHIND__": "".join('<div class="c"><b>%s</b><span>%s</span></div>' % b for b in BEHIND),
        "__TALENT__": talent_html(rv), "__GATE__": gate_html(rv), "__WHY_K__": WHY_FIRST[0], "__WHY_V__": WHY_FIRST[1],
        "__FLOW__": flow_html(rv),
        "__MODE_READ__": ("At the same pay, product leading frees about %d hours a week in the chair but needs about %d more "
                          "subscribers. It pays off once Evelyn&rsquo;s facial hours are full, or when she wants them back, "
                          "not before." % (round(MODES[0]["hours"] - MODES[2]["hours"]), MODES[2]["subs"] - MODES[0]["subs"])),
        "__MODE_COLS__": mode_cols_html(), "__FLIP_WHEN__": cards2(FLIP_WHEN), "__FLIP_HOW__": cards2(FLIP_HOW),
        "__MODE_PAY__": money(MODE_PAY), "__MODE_PAY_N__": str(MODE_PAY),
        "__PL_CHAIR__": rows(PL_CHAIR, ("Left for Evelyn’s pay", money(round(F_LEFT, -1)))),
        "__PL_SUB__": rows(PL_SUB, ("Each subscriber leaves", "$%d" % round(R_KEPT))),
        "__PL_GOALS__": pl_goals_html(), "__PL_HOW__": pl_how_html(),
        "__PL_F100__": "%d" % int(F_KEPT_EACH / F_AVG * 100), "__PL_R100__": "%d" % round(R_KEPT / R_PRICE * 100),
        "__PL_MEMBER__": "%d" % round(KEPT), "__PL_RKEPT__": "%d" % round(R_KEPT), "__PL_RATIO__": "%.1f" % (KEPT / R_KEPT),
        "__PL_STEP__": money(round(KEPT, -1)), "__PL_STEP_SUBS__": {4: "four", 5: "five", 6: "six"}.get(round(round(KEPT, -1) / R_KEPT), "several"),
        "__PL_FPW__": str(FPW), "__PL_FAVG__": "%d" % F_AVG, "__PL_RPRICE__": "%d" % R_PRICE,
        "__ENGINE_M__": engine_rows(ENGINE_M), "__ENGINE_T__": engine_rows(ENGINE_T), "__SCORE__": score_html(),
    }
    for k in sorted(rep, key=len, reverse=True):
        h = h.replace(k, rep[k])
    return h


base = CSS["BASE_CSS"].replace("__FONT__", FONT) + LP_CSS
web = HEAD.replace("__CSS__", base + CSS["WEB_CSS"] + LP_WEB) + fill(WEB_BODY, True).replace(
    "__JS__", WEB_JS.replace("__PERKS__", "%s" % PERKS).replace("__SUP__", "%s" % SUPPLIES)
    .replace("__MODES_JSON__", json.dumps([{k: m[k] for k in ("id", "name", "share", "tag", "do")} for m in MODES], ensure_ascii=True))
    .replace("__F_AVG__", "%s" % F_AVG).replace("__F_KEPT__", "%.4f" % F_KEPT_EACH).replace("__R_PRICE__", "%s" % R_PRICE)
    .replace("__R_KEPT__", "%.4f" % R_KEPT).replace("__BILLS_N__", str(BILLS_TOTAL)))
foot = lambda n: '<div class="pfoot"><span>Lumevina · The first 90 days</span><span>%d / 7</span></div>' % n
pr = HEAD.replace("__CSS__", base + CSS["PRINT_CSS"] + LP_PRINT) + fill(PRINT_BODY, False)
for i in range(1, 8):
    pr = pr.replace("__F%d__" % i, foot(i))

for name, html in (("web.html", web), ("print.html", pr)):
    assert "__" not in html.replace("__proto__", ""), [l for l in html.split("\n") if "__" in l][:3]
    html = html.encode("ascii", "xmlcharrefreplace").decode("ascii")
    with open(os.path.join(OUT, name), "w") as f:
        f.write(html)
    print(name, len(html), "floor", FLOOR, "kept %.2f" % KEPT)
