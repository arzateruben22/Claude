"""02 · Aftercare Cards: eight 5 x 7 cards to hand clients after a treatment, plus phone versions to text."""
import os, zipfile

import doc as D
from brand import TOKENS, font_css

SLUG = "02-aftercare-cards"
NAME = "Aftercare Card Set"

# (title, subtitle, [(section, [lines])])
CARDS = [
    ("Facial", "Your skin after today's treatment", [
        ("Today", ["Skip makeup for the rest of the day if you can.",
                   "Keep your hands off your face.",
                   "Skip the gym, sauna, hot yoga and hot showers."]),
        ("The next 48 hours", ["Hold off on retinoids, acids and scrubs.",
                               "Use a gentle cleanser, moisturizer and SPF 30+.",
                               "Sleep on a fresh pillowcase tonight."]),
        ("What's normal", ["A little pinkness for a few hours, and a few small breakouts in the first week as your "
                           "skin clears."]),
        ("Call me if", ["You notice swelling, blisters, a rash, or redness that gets worse after a day."]),
    ]),
    ("Acne Facial", "Your skin after extractions", [
        ("Today", ["Don't touch, pick or squeeze. Your skin is already healing.",
                   "Skip makeup for 12 hours, then use clean brushes.",
                   "Avoid the gym, sauna and anything that makes you sweat."]),
        ("The next 48 hours", ["Pause retinoids, acids and benzoyl peroxide unless I've said otherwise.",
                               "Use only the products I recommended.",
                               "Fresh pillowcase, clean phone screen."]),
        ("What's normal", ["Small red marks where extractions were done, fading in 1 to 3 days. A few new spots as "
                           "deeper congestion comes up."]),
        ("Call me if", ["A spot turns hot, swollen or painful, or you see yellow crusting."]),
    ]),
    ("Chemical Peel", "Your skin's first week", [
        ("The first 48 hours", ["Cleanse with cool water and a mild cleanser; moisturize often.",
                                "No sweating, sauna, steam or hot showers.",
                                "No makeup for 24 hours."]),
        ("For 7 days", ["Don't pick, peel or scrub flaking skin. Let it shed on its own.",
                        "No retinoids, acids, scrubs, waxing or other treatments.",
                        "SPF 30+ every day, reapplied outdoors. Avoid direct sun."]),
        ("What's normal", ["Tightness and shine, then flaking from about day 2 or 3. Some people barely peel, and the "
                           "peel still worked."]),
        ("Call me if", ["You notice blisters, oozing, crusting, intense burning or itching, or dark patches."]),
    ]),
    ("Dermaplaning", "Your smooth, fresh skin", [
        ("The first 24 hours", ["Go easy on makeup until tomorrow.",
                                "Avoid heat, heavy sweating and hot showers.",
                                "Keep your hands off your face."]),
        ("The next 3 days", ["No retinoids, acids, scrubs or peels.",
                             "No waxing or threading on the area for a week.",
                             "SPF 30+ daily. Fresh skin burns faster."]),
        ("What's normal", ["Smooth, slightly pink skin. Hair grows back the same, not thicker or darker, in about "
                           "3 to 4 weeks."]),
        ("Call me if", ["Bumps, irritation or a rash don't settle within 2 days."]),
    ]),
    ("Face Waxing", "Brows, lip and chin", [
        ("The first 24 hours", ["No makeup or fragranced products on the area.",
                                "Avoid heat, sun, tanning, saunas and steam.",
                                "Keep your hands off the area."]),
        ("The next 48 hours", ["No exfoliants, retinoids or acids on the area.",
                               "A cool compress calms any redness."]),
        ("What's normal", ["Redness and tiny bumps for a few hours."]),
        ("Between visits", ["Skip the tweezers so hair grows evenly. Book again in 3 to 5 weeks."]),
        ("Call me if", ["Skin looks raw or weepy, or bumps last longer than 2 days."]),
    ]),
    ("Body Waxing", "Including bikini and Brazilian", [
        ("The first 48 hours", ["Wear loose, breathable cotton.",
                                "Skip hot tubs, saunas, pools, tanning and workouts.",
                                "Bikini or Brazilian: skip intimacy for 24 hours."]),
        ("From day 3", ["Exfoliate gently 2 to 3 times a week to prevent ingrown hairs.",
                        "Moisturize every day."]),
        ("What's normal", ["Redness and small bumps for a day or two."]),
        ("Between visits", ["Don't shave. Book again in 4 to 6 weeks."]),
        ("Call me if", ["You notice painful bumps, pus, or a rash that spreads."]),
    ]),
    ("Lash Lift & Tint", "Keeping your curl", [
        ("The first 24 hours", ["Keep lashes dry: no water, steam, sauna or swimming.",
                                "No mascara, eye makeup or eye cream.",
                                "Don't rub your eyes or sleep face-down."]),
        ("After that", ["Brush your lashes every morning.",
                        "Use an oil-free makeup remover to help the lift last.",
                        "A lash conditioner keeps them healthy."]),
        ("What's normal", ["The lift lasts 6 to 8 weeks. The tint fades gently over 4 to 6 weeks."]),
        ("Call me if", ["Eyes turn red, swollen, watery or itchy. Rinse with cool water and see a doctor if it "
                        "doesn't settle."]),
    ]),
    ("Brow Lamination", "Laminated and tinted brows", [
        ("The first 24 hours", ["Keep brows completely dry.",
                                "No makeup, brow gel or skincare on the brows.",
                                "Don't rub them, sweat heavily or sleep face-down."]),
        ("After that", ["Brush brows into shape every morning.",
                        "Nourish them nightly with a drop of brow oil.",
                        "Keep retinoids and acids away from the brows."]),
        ("What's normal", ["Results last 6 to 8 weeks. Tint fades over 3 to 4 weeks."]),
        ("Call me if", ["Redness, itching, bumps or swelling don't settle within a day."]),
    ]),
]

CARD_CSS = """
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
body{font-family:var(--sans);color:var(--ink);font-weight:300;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.card{position:relative;display:flex;flex-direction:column;background:#fff;overflow:hidden}
.card .kick{font-size:var(--k);letter-spacing:.2em;text-transform:uppercase;color:var(--rose);font-weight:500}
.card h1{font-family:var(--serif);font-weight:500;font-size:var(--t);line-height:1;margin:var(--g1) 0 0;letter-spacing:-.005em}
.card .sub{font-family:var(--serif);font-style:italic;font-size:var(--s);color:var(--muted);margin:.25em 0 0}
.card .rule{height:0;border-top:.75pt solid var(--hair);margin:var(--g2) 0 var(--g3)}
.card .sec{margin:0 0 var(--g3)}
.card .sec h2{margin:0 0 .35em;font-size:var(--k);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:500}
.card .sec.alert h2{color:var(--rose)}
.card ul{margin:0;padding:0;list-style:none}
.card li{position:relative;padding-left:1.05em;margin:0 0 .3em;font-size:var(--b);line-height:1.38}
.card li::before{content:"";position:absolute;left:.1em;top:.62em;width:.34em;height:.34em;border-radius:50%;background:var(--rose)}
.card .sec.one li{padding-left:0}
.card .sec.one li::before{display:none}
.card .end{margin-top:auto;display:flex;gap:1.2em;font-size:var(--k);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:400}
.card .end span{display:flex;align-items:flex-end;gap:.6em;flex:1}
.card .end .note{font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:var(--s);color:var(--rose)}
.card .end span i{flex:1;border-bottom:.75pt solid var(--rule);height:1.4em;font-style:normal}
"""

PRINT_CSS = """
@page{size:11in 8.5in;margin:0}
.sheet{width:11in;height:8.5in;position:relative;break-after:page}
.sheet:last-child{break-after:auto}
.card{position:absolute;top:.75in;width:5in;height:7in;padding:.42in .42in .38in;
  --k:7pt;--t:37pt;--s:14pt;--b:10.6pt;--g1:7pt;--g2:15pt;--g3:14pt}
.card.l{left:.5in}.card.r{left:5.5in}
.crop{position:absolute;background:#9a8b90}
.a4 .sheet{width:297mm;height:210mm}
"""

PHONE_CSS = """
.card.phone{width:360px;height:640px;padding:44px 30px 30px;--k:9.5px;--t:40px;--s:17px;--b:13.4px;--g1:8px;--g2:16px;--g3:13px}
"""


def card_html(c, cls=""):
    title, sub, secs = c
    out = ['<div class="card %s"><div class="kick">Aftercare</div><h1>%s</h1><p class="sub">%s</p><div class="rule"></div>'
           % (cls, D.esc(title), D.esc(sub))]
    for name, lines in secs:
        klass = "sec" + (" alert" if name == "Call me if" else "") + (" one" if len(lines) == 1 else "")
        out.append('<div class="%s"><h2>%s</h2><ul>%s</ul></div>' % (
            klass, D.esc(name), "".join("<li>%s</li>" % D.inline(x) for x in lines)))
    if "phone" in cls:
        out.append('<div class="end"><span class="note">Questions? Just reply to my text.</span></div></div>')
    else:
        out.append('<div class="end"><span>Questions<i></i></span><span>Next visit<i></i></span></div></div>')
    return "".join(out)


def crops(x_in, y_in, w_in, h_in):
    """Hairline crop marks just outside each corner of a card."""
    m, L = 0.08, 0.22
    out = []
    for cx in (x_in, x_in + w_in):
        for cy in (y_in, y_in + h_in):
            hx = cx - m - L if cx == x_in else cx + m
            vy = cy - m - L if cy == y_in else cy + m
            out.append('<i class="crop" style="left:%sin;top:%sin;width:%sin;height:.5pt"></i>' % (hx, cy, L))
            out.append('<i class="crop" style="left:%sin;top:%sin;width:.5pt;height:%sin"></i>' % (cx, vy, L))
    return "".join(out)


def print_html(size):
    sheets = []
    for i in range(0, len(CARDS), 2):
        left, right = CARDS[i], CARDS[i + 1]
        if size == "a4":
            # A4 landscape is 11.69 x 8.27 in; center the pair
            ox, oy = (11.69 - 10) / 2, (8.27 - 7) / 2
        else:
            ox, oy = 0.5, 0.75
        sheets.append('<div class="sheet">%s%s%s%s</div>' % (
            card_html(left, "l").replace('class="card l"', 'class="card l" style="left:%sin;top:%sin"' % (ox, oy)),
            card_html(right, "r").replace('class="card r"', 'class="card r" style="left:%sin;top:%sin"' % (ox + 5, oy)),
            crops(ox, oy, 5, 7), crops(ox + 5, oy, 5, 7)))
    page = "@page{size:297mm 210mm;margin:0}" if size == "a4" else ""
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s%s%s</style></head><body class="%s">%s</body></html>'
            % (font_css(), TOKENS, CARD_CSS, PRINT_CSS, page, size, "".join(sheets)))


def phone_html():
    cards = "".join('<div style="margin:0 0 20px">%s</div>' % card_html(c, "phone") for c in CARDS)
    return ('<!doctype html><html><head><meta charset="utf-8"><style>%s%s%s%s body{padding:0;width:360px}</style></head>'
            '<body>%s</body></html>' % (font_css(), TOKENS, CARD_CSS, PHONE_CSS, cards))


def word_doc():
    pages = []
    for title, sub, secs in CARDS:
        blocks = [("h", "Aftercare"), ("title", title, "_%s_" % sub)]
        for name, lines in secs:
            blocks += [("h", name), ("list", lines)]
        blocks += [("fields", [("Questions", 1, "q"), ("Next visit", 1, "n")])]
        pages.append({"name": title, "blocks": blocks})
    return {"title": NAME, "header": None, "foot": "Aftercare", "pages": pages}


START = {
    "inside": [
        ("Print sheets", "All eight cards at 5 x 7 in, two to a page with crop marks, on US Letter or A4."),
        ("Phone cards", "The same eight cards as tall images (1080 x 1920) to text or email after a visit, or post "
                        "to Instagram stories."),
        ("Word file", "Every card on its own 5 x 7 page, fully editable."),
        ("The cards", "Facial · Acne Facial · Chemical Peel · Dermaplaning · Face Waxing · Body Waxing · "
                      "Lash Lift & Tint · Brow Lamination"),
    ],
    "tips": [
        "Read each card and adjust the timings to the products and protocols you use.",
        "Add your phone number or Instagram handle on the Questions line, or leave it to write in.",
        "Print on matte cardstock (80 to 110 lb), then trim along the crop marks.",
        "Save the phone cards to a favorites album so you can text the right one before the client reaches the car.",
    ],
    "paper": "Matte cardstock, 80 to 110 lb cover, prints and writes on beautifully.",
    "legal": True,
    "fillable": False,
}


def build(c):
    c.pdf(None, "Aftercare Cards - 5x7 Print Sheets - US Letter.pdf", "letter", html_text=print_html("letter"))
    c.pdf(None, "Aftercare Cards - 5x7 Print Sheets - A4.pdf", "a4", html_text=print_html("a4"))
    # the landscape sheets print at the size their @page asks for
    for j in c.jobs[-2:]:
        j["width"], j["height"] = (1056, 816) if "letter" in j["html"] else (1123, 794)
    out = c.shot(phone_html(), "phone", ".card.phone", 360, 640, scale=3, kind="png")
    c.docx(word_doc(), "Aftercare Cards - Editable Word.docx", size=(5, 7, 0.4))
    c.start_here()

    def pack():
        z = c.path("Aftercare Cards - Phone Versions.zip")
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, card in enumerate(CARDS):
                zf.write("%s-%d.png" % (out, i + 1), "%02d %s.png" % (i + 1, card[0].replace("&", "and")))
    c.after.append(pack)
    c.add("Aftercare Cards - Phone Versions.zip")
