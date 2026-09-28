"""03 · Skin Analysis & Treatment Record: face map, analysis, plan, visit log and progress map."""
from brand import INK, ROSE, MUTED

SLUG = "03-skin-analysis-face-map"
NAME = "Skin Analysis & Treatment Record"

# (number, x, y): zone markers on the face drawing
ZONES = [(1, 150, 92), (2, 150, 146), (3, 104, 190), (3, 196, 190), (4, 150, 210), (5, 88, 238), (5, 212, 238),
         (6, 150, 250), (7, 150, 305), (8, 80, 290), (8, 220, 290), (9, 150, 368)]
ZONE_NAMES = ["Forehead", "Between the brows", "Eye area", "Nose", "Cheeks", "Upper lip", "Chin", "Jawline", "Neck"]


def face(zones=True, stroke=INK):
    s = stroke
    d = [
        # head, ears, neck
        '<path d="M150 30C210 30 250 75 252 150C254 215 238 270 205 310C185 334 165 345 150 345C135 345 115 334 95 310'
        'C62 270 46 215 48 150C50 75 90 30 150 30Z" fill="none" stroke="%s" stroke-width="1.3"/>' % s,
        '<path d="M49 158C36 148 30 172 33 193C36 212 43 223 53 224" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
        '<path d="M251 158C264 148 270 172 267 193C264 212 257 223 247 224" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
        '<path d="M112 330C112 350 110 368 104 388M188 330C188 350 190 368 196 388" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
        # hairline, brows
        '<path d="M66 118C84 76 216 76 234 118" fill="none" stroke="%s" stroke-width=".8" stroke-dasharray="2 3"/>' % s,
        '<path d="M92 143C105 133 125 132 138 138M162 138C175 132 195 133 208 143" fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round"/>' % s,
        # eyes
        '<path d="M96 166C106 157 127 157 137 167C127 173 106 173 96 166ZM163 167C173 157 194 157 204 166C194 173 173 173 163 167Z" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
        '<circle cx="116.5" cy="165.5" r="5.2" fill="none" stroke="%s" stroke-width="1"/><circle cx="183.5" cy="165.5" r="5.2" fill="none" stroke="%s" stroke-width="1"/>' % (s, s),
        # nose
        '<path d="M144 172C143 194 139 210 135 222M135 225C139 234 145 234 150 231C155 234 161 234 165 225" fill="none" stroke="%s" stroke-width="1.1" stroke-linecap="round"/>' % s,
        # lips
        '<path d="M121 266C131 259 142 257 150 261C158 257 169 259 179 266C167 269 158 270 150 270C142 270 133 269 121 266Z" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
        '<path d="M121 266C132 281 168 281 179 266" fill="none" stroke="%s" stroke-width="1.1"/>' % s,
    ]
    if zones:
        for n, x, y in ZONES:
            d.append('<circle cx="%d" cy="%d" r="8" fill="#fff" stroke="%s" stroke-width=".8"/>'
                     '<text x="%d" y="%d" text-anchor="middle" font-family="Jost, Arial, sans-serif" font-size="9.5" fill="%s">%d</text>'
                     % (x, y, ROSE, x, y + 3.4, ROSE, n))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 22 260 372" width="260" height="372">%s</svg>'
            % "".join(d))


LEGEND = [("●", "Open comedones (blackheads)"), ("○", "Closed comedones"), ("A", "Papules, pustules (acne)"),
          ("M", "Milia"), ("H", "Hyperpigmentation"), ("R", "Redness"), ("T", "Broken capillaries"),
          ("D", "Dehydration lines"), ("W", "Fine lines, wrinkles"), ("S", "Scarring")]

ANALYSIS = {"name": "Skin Analysis", "blocks": [
    ("title", "Skin _Analysis_", "Map what you see, then build the plan around it."),
    ("fields", [("Client", 2.4, "client"), ("Date", 1.1, "date"), ("Esthetician", 1.6, "esthetician")]),
    ("cols", [
        ("svg", face(), 3.95, "Zones: " + " · ".join("%d %s" % (i + 1, z) for i, z in enumerate(ZONE_NAMES))),
        ("h", "Draw on the map"),
        ("table", ["Mark", "Meaning", "Mark", "Meaning"], [11, 39, 11, 39],
         [[LEGEND[i][0], LEGEND[i][1], LEGEND[i + 5][0], LEGEND[i + 5][1]] for i in range(5)], "legend", 11),
    ], [
        ("h", "Skin type"),
        ("checks", "", ["Normal", "Dry", "Oily", "Combination", "Sensitive"], "type", 3),
        ("h", "Fitzpatrick"),
        ("checks", "", ["I", "II", "III", "IV", "V", "VI"], "fitz", 6),
        ("h", "Glogau (aging)"),
        ("checks", "", ["I · none", "II · in motion", "III · at rest", "IV · all over"], "glogau", 2),
        ("h", "Today"),
        ("checks", "Hydration", ["Good", "Fair", "Low"], "hydration", 3),
        ("checks", "Oil", ["Low", "Balanced", "High"], "oil", 3),
        ("checks", "Sensitivity", ["Low", "Moderate", "High"], "sensitivity", 3),
        ("checks", "Pores", ["Fine", "Visible", "Enlarged"], "pores", 3),
        ("h", "Concerns"),
        ("checks", "", ["Acne", "Congestion", "Dark spots", "Melasma", "Redness", "Rosacea", "Dehydration",
                        "Fine lines", "Laxity", "Scarring", "Sun damage", "Ingrowns"], "concern", 3),
    ], 0.47),
    ("h", "The plan"),
    ("cols", [
        ("lines", 3, "plan_studio", "In the studio: treatments and how often"),
    ], [
        ("lines", 3, "plan_home", "At home: morning and evening"),
    ], 0.5),
    ("fields", [("Products recommended", 3, "products"), ("Next visit", 1.2, "next")]),
]}

RECORD = {"name": "Treatment Record", "blocks": [
    ("title", "Treatment _Record_", "One line per visit. Keep it with the client's intake and consent forms."),
    ("fields", [("Client", 2.4, "client"), ("Date of birth", 1.2, "dob"), ("Phone", 1.4, "phone")]),
    ("fields", [("Cautions (allergies, medications, contraindications)", 4, "cautions")]),
    ("table", ["Date", "Service", "Products and strength", "Time or layers", "Skin response", "Home care given", "Init."],
     [9, 15, 22, 10, 17, 19, 8], 22, "visit", 26, "grid"),
]}

PROGRESS = {"name": "Progress Map", "blocks": [
    ("title", "Progress _Map_", "Compare the skin at the start of a series with where it is now."),
    ("fields", [("Client", 3, "client"), ("Goal", 3, "goal")]),
    ("cols", [
        ("h", "Before"),
        ("fields", [("Date", 1, "before_date"), ("Visit", 0.6, "before_visit")]),
        ("svg", face(zones=False), 3.75, ""),
        ("lines", 5, "before_notes", "What I see"),
    ], [
        ("h", "Now"),
        ("fields", [("Date", 1, "after_date"), ("Visit", 0.6, "after_visit")]),
        ("svg", face(zones=False), 3.75, ""),
        ("lines", 5, "after_notes", "What's changed"),
    ], 0.5),
    ("h", "Photos"),
    ("checks", "", ["Front", "Left side", "Right side", "Same light and distance", "Client consent on file"], "photos", 5),
    ("h", "Next steps"),
    ("lines", 2, "next_steps"),
]}

DOC = {"title": NAME, "header": "studio", "foot": "Skin analysis & treatment record",
       "pages": [ANALYSIS, RECORD, PROGRESS]}

START = {
    "inside": [
        ("Fillable PDF", "Skin Analysis with face map, Treatment Record and Progress Map, on US Letter and A4. Type on "
                         "an iPad or print and write by hand."),
        ("Word file", "The same three pages, editable."),
        ("Face maps", "Mark what you see with the symbols in the key, or with an Apple Pencil in Markup."),
    ],
    "tips": [
        "Add your studio name at the top of each page (fillable PDF or Word).",
        "Fill in the Skin Analysis at the first visit, and again every few months.",
        "Log every visit on the Treatment Record, including products, strengths and how the skin responded.",
        "Use the Progress Map at the start and end of a series to show clients how far they've come.",
    ],
    "legal": False,
    "fillable": True,
}


def build(c):
    c.pdf(DOC, "Skin Analysis & Treatment Record - Fillable - US Letter.pdf", "letter", fillable=True)
    c.pdf(DOC, "Skin Analysis & Treatment Record - Fillable - A4.pdf", "a4", fillable=True)
    c.docx(DOC, "Skin Analysis & Treatment Record - Editable Word.docx")
    c.start_here()
