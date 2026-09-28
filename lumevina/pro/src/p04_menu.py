"""04 · Service Menu & Price List: an editable menu, a one-page price list and 40 ready-to-use descriptions."""

SLUG = "04-service-menu-templates"
NAME = "Service Menu & Price List"

FACIALS = [
    ("Signature Facial", "60 min", "$125", "A facial built around your skin that day: a deep cleanse, gentle exfoliation, "
     "extractions as needed, a mask matched to your goals and a slow face, neck and shoulder massage."),
    ("Express Facial", "30 min", "$75", "The essentials when time is short: cleanse, exfoliate, mask and hydrate. "
     "Lovely between full facials or before an event."),
    ("Clear Skin Facial", "75 min", "$145", "For breakouts and congestion: a thorough cleanse, a clarifying exfoliation, "
     "careful extractions, high frequency and a calming mask."),
    ("Age-Renewal Facial", "75 min", "$155", "Firming and brightening: resurfacing exfoliation, peptide and antioxidant "
     "serums, sculpting facial massage and LED light."),
    ("Hydrating Glow Facial", "60 min", "$135", "Dewy, plumped skin: a hydrating exfoliation, layered hyaluronic serums, "
     "a cooling mask and lymphatic massage."),
    ("Teen Facial", "45 min", "$80", "A gentle introduction for ages 12 to 17: a deep cleanse, light extractions and a "
     "simple routine to take home."),
]
ADVANCED = [
    ("Dermaplaning", "45 min", "$95", "Removes dead skin and peach fuzz for a smooth, glowing finish that makeup glides "
     "over. Includes a cleanse, hydrating mask and SPF."),
    ("Chemical Peel", "45 min", "from $120", "A professional peel chosen for your skin to brighten dullness, soften "
     "texture and fade dark spots. A consultation comes first."),
    ("Dermaplaning + Peel", "60 min", "$165", "The two together for the smoothest, brightest result. The peel works "
     "deeper on freshly exfoliated skin."),
    ("Microcurrent Lift", "60 min", "$150", "Gentle currents tone the muscles of the face for a lifted, sculpted look. "
     "Best in a series of six."),
]
ADDONS = [("LED light therapy", "+$25"), ("High frequency", "+$15"), ("Extra extractions", "+$20"),
          ("Jelly mask", "+$20"), ("Eye treatment", "+$15"), ("Lip treatment", "+$10"),
          ("Dermaplaning", "+$45"), ("Scalp massage", "+$15")]
WAX = [("Brows", "$22"), ("Lip", "$14"), ("Chin", "$14"), ("Full face", "$55"), ("Underarm", "$25"),
       ("Half arm", "$35"), ("Full arm", "$50"), ("Half leg", "$50"), ("Full leg", "$80"), ("Bikini", "$45"),
       ("Extended bikini", "$55"), ("Brazilian", "$70"), ("Back", "$60"), ("Chest", "$50")]
LASH = [("Brow tint", "$20"), ("Brow lamination", "$75"), ("Lamination + tint", "$90"), ("Lash tint", "$25"),
        ("Lash lift", "$80"), ("Lash lift + tint", "$95")]

MENU_P1 = {"name": "Service Menu", "cls": "big", "blocks": [
    ("masthead", "Your Studio Name", "Skin care · Your City, State"),
    ("h", "Facials"),
    ("menu", FACIALS),
    ("h", "Peels and advanced treatments"),
    ("menu", ADVANCED),
]}
MENU_P2 = {"name": "Service Menu", "cls": "big", "blocks": [
    ("h", "Add to any facial"),
    ("prices", ADDONS, 2),
    ("h", "Waxing"),
    ("prices", WAX, 2),
    ("h", "Lash and brow"),
    ("prices", LASH, 2),
    ("space", 0.12),
    ("callout", "The Glow Club · $119 a month", "One Signature Facial every month, 10% off products and 15% off "
     "add-ons. Unused facials roll over for 60 days. Cancel with 30 days' notice."),
    ("h", "Good to know"),
    ("p", "Please arrive 10 minutes early for your first visit to fill in your forms. Cancellations need 24 hours' "
          "notice. Gift cards are available for every service."),
    ("space", 0.1),
    ("p", "**Book** yourstudio.com  ·  **Call or text** (000) 000-0000  ·  **Instagram** @yourstudio"),
]}

PRICE_LIST = {"name": "Price List", "blocks": [
    ("masthead", "Your Studio Name", "Price list"),
    ("h", "Facials"),
    ("prices", [(n, p) for n, _, p, _ in FACIALS], 2),
    ("h", "Peels and advanced"),
    ("prices", [(n, p) for n, _, p, _ in ADVANCED], 2),
    ("h", "Add-ons"),
    ("prices", ADDONS, 2),
    ("h", "Waxing"),
    ("prices", WAX, 2),
    ("h", "Lash and brow"),
    ("prices", LASH, 2),
    ("h", "Membership"),
    ("prices", [("The Glow Club, monthly", "$119")], 2),
    ("space", 0.1),
    ("small", "Prices include a consultation. Gratuity is appreciated but never expected."),
]}

MENU = {"title": "Service Menu", "header": None, "foot": "Your Studio Name · Service menu",
        "pages": [MENU_P1, MENU_P2, PRICE_LIST]}

# ─────────────────────────── the description library ───────────────────────────
LIBRARY = [
    ("Facials", [
        ("Signature Facial", "A facial built around your skin that day. We cleanse, exfoliate, extract where needed and "
         "finish with a mask and massage chosen for your goals."),
        ("Express Facial", "Thirty minutes to fresh, glowing skin. The essentials of a full facial for when time is short."),
        ("Hydrating Facial", "Layer after layer of hydration for skin that feels tight or looks tired. You'll leave "
         "plump, dewy and comfortable."),
        ("Brightening Facial", "Gentle resurfacing and vitamin-rich serums to wake up dull skin and even out tone."),
        ("Calming Facial", "For sensitive or reactive skin: cool, soothing and fragrance-free, with a barrier-loving "
         "mask to settle redness."),
        ("Back Facial", "A deep cleanse, exfoliation and extractions for the hard-to-reach skin of your back. "
         "Perfect before a wedding or a beach trip."),
        ("Men's Facial", "A no-fuss deep clean for skin that deals with shaving, sweat and city life. Includes "
         "extractions and a hydrating finish."),
        ("Teen Facial", "A gentle first facial that clears congestion and teaches a simple routine teens will "
         "actually follow."),
        ("Pregnancy Facial", "A relaxing, pregnancy-safe facial with side-lying comfort and gentle, soothing products."),
        ("Bridal Facial", "Timed for your big day: a glow-boosting facial plus a plan for the weeks before, so your "
         "skin is camera-ready."),
    ]),
    ("Clear skin", [
        ("Clear Skin Facial", "A focused treatment for breakouts and congestion, with careful extractions and a "
         "calming finish."),
        ("Acne Series", "Six treatments, two weeks apart, with a home routine to match. The steady path to "
         "clearer skin."),
        ("Extractions", "Gentle, thorough clearing of blackheads and clogged pores, followed by a soothing mask."),
        ("High Frequency", "A gentle current that helps calm active breakouts and refine the look of pores."),
    ]),
    ("Age renewal", [
        ("Age-Renewal Facial", "Peptides, antioxidants and sculpting massage for skin that looks firmer, smoother "
         "and more radiant."),
        ("Microcurrent", "Gentle currents that tone the face for a lifted, sculpted look. No downtime; best in a series."),
        ("LED Light Therapy", "Red light for radiance and firmness, blue light for breakout-prone skin. Relaxing and "
         "painless."),
        ("Facial Massage", "A slow, sculpting massage that eases tension and leaves the face looking refreshed "
         "and lifted."),
    ]),
    ("Peels and exfoliation", [
        ("Chemical Peel", "A professional-strength exfoliation chosen for your skin to brighten, smooth texture and "
         "fade the look of dark spots."),
        ("Enzyme Peel", "A gentle fruit-enzyme exfoliation that brightens without the peeling. Lovely for "
         "sensitive skin."),
        ("Dermaplaning", "A smooth, fresh surface in one visit. Removes dead skin and peach fuzz so makeup "
         "glides on."),
        ("Dermaplaning + Peel", "The two together for the smoothest, brightest result of all."),
        ("Body Polish", "An all-over exfoliation and hydration for soft, glowing skin from shoulders to heels."),
    ]),
    ("Add-ons", [
        ("Eye Treatment", "A cooling mask and gentle massage to refresh tired, puffy eyes."),
        ("Lip Treatment", "Gentle exfoliation and a nourishing mask for soft, smooth lips."),
        ("Jelly Mask", "A cool, sealing mask that drives hydration in and leaves skin bouncy."),
        ("Scalp Massage", "Ten minutes of pure relaxation to melt away tension."),
        ("Hand and Arm Massage", "Warm hands, soft skin and a few extra minutes of calm."),
        ("Neck and Décolleté", "Extend your facial's care to the neck and chest, where skin shows age first."),
        ("Paraffin Hands", "Warm paraffin that softens and soothes dry hands."),
        ("Brow Tidy", "A quick shape-up to finish your facial."),
    ]),
    ("Waxing", [
        ("Brow Wax", "A shape designed for your face, finished with a soothing balm."),
        ("Brazilian", "Complete, careful and quick, with a calm, judgment-free approach. First visits are always "
         "welcome."),
        ("Bikini", "Tidy lines outside the swimsuit area, with gentle wax made for sensitive skin."),
        ("Full Leg", "Smooth legs for weeks, with less regrowth over time than shaving."),
    ]),
    ("Lash and brow", [
        ("Lash Lift", "A natural curl that lasts six to eight weeks. No extensions, no curler, no fuss."),
        ("Lash Tint", "Darker, defined lashes that look like mascara without the smudges."),
        ("Brow Lamination", "Fuller, brushed-up brows that stay in place for six to eight weeks."),
        ("Brow Tint", "Deeper color that frames the face and fills in sparse areas."),
        ("Lift + Tint Duo", "The lash lift and tint together for wide-awake eyes every morning."),
    ]),
]

WORDS = [
    ("Say this", "Not this"),
    ("clearer, calmer skin", "cures acne"),
    ("softens the look of fine lines", "removes wrinkles"),
    ("helps fade the look of dark spots", "treats hyperpigmentation"),
    ("soothes redness", "heals rosacea"),
    ("a lifted, sculpted look", "a non-surgical facelift"),
    ("supports your skin's barrier", "repairs damaged skin"),
]


def library_doc():
    pages, cur = [], []
    first = {"name": "Description Library", "blocks": [
        ("title", "Description _Library_", "Forty ready-to-use service descriptions. Copy them into your menu, "
         "booking app or website, and change a word or two so they sound like you."),
        ("h", "How to write your own"),
        ("steps", ["Lead with how the client will feel or look afterward, not with the machine or the acid.",
                   "Say who it's for (“for sensitive skin,” “before an event”).",
                   "Keep it to one or two sentences. Details belong in the consultation.",
                   "Name the time and the price clearly, so no one has to ask."]),
        ("h", "Stay on the cosmetic side"),
        ("p", "Estheticians improve how skin looks and feels; doctors treat disease. Words like _cure_, _treat_ and "
              "_heal_ can cross that line with your state board and with advertising rules."),
        ("table", ["Say this", "Not this"], [55, 45], [list(r) for r in WORDS[1:]], "words", 13),
        ("h", "Build a menu that sells"),
        ("list", ["**Lead with your signature.** Put the facial you want most people to book first.",
                  "**Offer three levels.** An express, a signature and a premium option make the middle one feel "
                  "easy to choose.",
                  "**Make add-ons effortless.** A short list with small prices is the easiest upgrade to say yes to.",
                  "**Show time and price together.** Clients compare by value per minute, whether they notice or not.",
                  "**End with the membership.** Once someone sees the menu, a monthly plan is the obvious next step.",
                  "**Keep it short.** Ten to fifteen services beats forty. Fewer choices, faster decisions."]),
    ]}
    pages.append(first)
    blocks = []
    for cat, items in LIBRARY:
        blocks.append(("h", cat))
        blocks.append(("kv", items))
    # split the library over pages by category count (content measured in print; see build report)
    split = [blocks[:6], blocks[6:]]
    for chunk in split:
        pages.append({"name": "Description Library", "blocks": chunk})
    return {"title": "Description Library", "header": "brand", "foot": "Lumevina Studio · Description library",
            "pages": pages}


MENU_CSS = """
.big{padding-top:.62in}
.big .mast{margin:.12in 0 .26in}.big .mname{font-size:33pt}
.big .menu{gap:13pt}.big .mn{font-size:16.5pt}.big .mi p{font-size:9.3pt;margin-top:3pt}.big .mp{font-size:10.5pt}
.big .prices{gap:8pt 28pt}.big .pr{font-size:10pt}
.big .h{margin:16pt 0 10pt;font-size:8pt}
.big .callout{padding:13pt 16pt 12pt}.big .callout .ct{font-size:15pt}.big .callout p{font-size:9.5pt}
"""

START = {
    "inside": [
        ("Service menu", "A two-page menu with descriptions and a one-page price list, as a Word file to edit and a "
                         "sample PDF to see the finished look."),
        ("Description library", "Forty service descriptions across facials, clear skin, age renewal, peels, add-ons, "
                                "waxing, and lash and brow, plus a guide to wording that stays cosmetic."),
    ],
    "tips": [
        "Open the menu in Word or Google Docs and replace **Your Studio Name**, the city, and your contact line.",
        "Delete the services you don't offer and add your own. Copy descriptions from the library.",
        "Set your prices. Keep the dotted leaders by pressing Tab before a price.",
        "Export as PDF to print, email, or upload to your booking page and link in bio.",
    ],
    "legal": False,
    "fillable": False,
}


def build(c):
    c.pdf(MENU, "Service Menu - Sample - US Letter.pdf", "letter", extra_css=MENU_CSS)
    c.docx(MENU, "Service Menu - Editable Word.docx")
    lib = library_doc()
    c.pdf(lib, "Description Library - 40 Services.pdf", "letter")
    c.docx(lib, "Description Library - Editable Word.docx")
    c.start_here()
