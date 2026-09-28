"""09 · Skin Journal & Routine Planner: thirty days to know your skin (for clients, not studios)."""

SLUG = "09-skin-journal-routine-planner"
NAME = "Skin Journal & Routine Planner"

K = "Skin Journal"


def diary(first, last):
    rows = [[str(d), None, "[]", "[]", "[]", None, None] for d in range(first, last + 1)]
    return {"name": "Diary", "kicker": K, "blocks": [
        ("title", "30-Day _Diary_", "Days %d to %d. A line a day is enough. Skin today: 1 is rough, 5 is your best." % (first, last)),
        ("table", ["Day", "Date", "AM", "PM", "SPF", "Skin today", "What I noticed"], [6, 11, 6, 6, 6, 11, 54],
         rows, "d%d" % first, 36),
    ]}


def checkin(n):
    w = "wk%d" % n
    return {"name": "Week %d" % n, "kicker": K, "blocks": [
        ("title", "Week %d _Check-In_" % n, "Take a photo in the same spot and light as last time, then answer honestly."),
        ("fields", [("Date", 1, w + "_date"), ("Photo taken", 1, w + "_photo")]),
        ("h", "This week my skin felt"),
        ("checks", "", ["Calm", "Glowing", "Dry or tight", "Oily", "Breaking out", "Sensitive", "Dull", "Just okay"], w + "_felt", 4),
        ("h", "Rate it"),
        ("table", ["", "1", "2", "3", "4", "5"], [40, 12, 12, 12, 12, 12], [
            ["Clarity (fewer breakouts)", "[]", "[]", "[]", "[]", "[]"],
            ["Hydration", "[]", "[]", "[]", "[]", "[]"],
            ["Even tone", "[]", "[]", "[]", "[]", "[]"],
            ["Texture", "[]", "[]", "[]", "[]", "[]"],
            ["How I feel about my skin", "[]", "[]", "[]", "[]", "[]"]], w + "_rate", 20),
        ("cols", [("h", "What changed"), ("lines", 4, w + "_changed")],
         [("h", "What might have caused it"), ("lines", 4, w + "_cause")], 0.5),
        ("h", "Next week I'll"),
        ("checks", "", ["Keep everything the same", "Drink more water", "Sleep more", "Stop picking",
                        "Reapply SPF", "Add one new product", "Book a facial", "Other ___"], w + "_next", 2),
        ("box", "Notes and questions for my esthetician", 1.6, w + "_notes"),
    ]}


INTRO = {"name": "Start", "kicker": K, "blocks": [
    ("title", "My Skin _Journal_", "Thirty days to know your skin: what you use, how it responds, and what actually "
     "works. Bring it to your next facial."),
    ("h", "How to use it"),
    ("steps", ["Write down your routine and the products you own. You may find you need fewer than you think.",
               "Add one new product at a time, and patch test it first.",
               "Fill in one line of the diary each night. It takes thirty seconds.",
               "Once a week, take a photo and do the check-in."]),
    ("h", "About me"),
    ("fields", [("Name", 2, "name"), ("Start date", 1, "start")]),
    ("checks", "My skin is usually", ["Dry", "Oily", "Combination", "Normal", "Sensitive"], "type", 5),
    ("h", "My goals"),
    ("checks", "", ["Fewer breakouts", "More even tone", "Less redness", "More hydration", "Smoother texture",
                    "Softer fine lines", "A simpler routine", "Wear less makeup", "Other ___"], "goal", 3),
    ("h", "In thirty days I want to"),
    ("lines", 4, "wish"),
    ("callout", "Three rules that fix most skin", "Wear sunscreen every morning, even indoors by a window. Change one "
     "thing at a time. Give anything new four to six weeks before you judge it."),
]}

ROUTINE = {"name": "Routine", "kicker": K, "blocks": [
    ("title", "My _Routine_", "Apply from thinnest to thickest. Sunscreen is always last in the morning."),
    ("h", "Morning"),
    ("table", ["Step", "Product", "Notes"], [22, 40, 38], [
        ["Cleanse", None, None], ["Tone or essence", None, None], ["Serum", None, None], ["Eye cream", None, None],
        ["Moisturize", None, None], ["Sunscreen", None, None]], "am", 26),
    ("h", "Evening"),
    ("table", ["Step", "Product", "Notes"], [22, 40, 38], [
        ["Remove makeup", None, None], ["Cleanse", None, None], ["Treatment", None, None], ["Serum", None, None],
        ["Eye cream", None, None], ["Moisturize", None, None]], "pm", 26),
    ("h", "Weekly"),
    ("table", ["What", "Product", "Which days"], [22, 40, 38], [
        ["Exfoliate", None, None], ["Mask", None, None], ["Something else", None, None]], "weekly", 26),
    ("small", "Using a retinoid or an exfoliating acid? Keep them on different nights, and use them in the evening only."),
]}

PRODUCTS = {"name": "Products", "kicker": K, "blocks": [
    ("title", "My _Products_", "Everything on your shelf. Most products last 6 to 12 months once opened: look for the "
     "little open-jar symbol with a number, like 12M."),
    ("table", ["Product", "Brand", "Opened", "Use by", "Price", "Keep it?"], [28, 20, 12, 12, 10, 18], 16, "prod", 28),
    ("h", "On my wish list"),
    ("lines", 4, "wish_list"),
]}

NEW = {"name": "Trying something new", "kicker": K, "blocks": [
    ("title", "Trying Something _New_", "Patch test first, then add it slowly. If your skin reacts, you'll know exactly why."),
    ("h", "How to patch test"),
    ("steps", ["Dab a little behind your ear or along your jaw, once a day, for three days.",
               "Look for redness, itching, bumps or burning. Any of those means stop.",
               "No reaction? Start using it on your face, two or three times a week at first."]),
    ("h", "Patch tests"),
    ("table", ["Product", "Started", "Where", "Day 1", "Day 2", "Day 3", "Result"], [26, 11, 14, 8, 8, 8, 25], 6, "patch", 30),
    ("h", "Adding it in slowly"),
    ("table", ["Product", "Week 1", "Week 2", "Week 3", "Week 4", "How it's going"], [24, 12, 12, 12, 12, 28], [
        ["", "2x", "3x", "Every other day", "Daily", None],
        [None, None, None, None, None, None], [None, None, None, None, None, None],
        [None, None, None, None, None, None]], "ramp", 30),
    ("small", "Retinoids and strong acids often cause a little dryness or a few breakouts in the first month. Stop and "
              "ask your esthetician if you see burning, peeling that doesn't settle, or a rash."),
]}

PHOTOS = {"name": "Photos", "kicker": K, "blocks": [
    ("title", "Progress _Photos_", "The mirror lies; photos don't. Same spot, same light, same time of day, no makeup."),
    ("table", ["Date", "Light", "Front", "Left", "Right", "What I see"], [13, 17, 8, 8, 8, 46],
     [[None, None, "[]", "[]", "[]", None] for _ in range(13)], "photo", 32),
    ("callout", "The perfect progress photo", "Face a window in daylight, phone at eye level, hair back, face "
     "relaxed. Take one straight on and one from each side. Save them to one album so you can compare."),
]}

VISITS = {"name": "Facials", "kicker": K, "blocks": [
    ("title", "My _Facials_", "What was done, what your esthetician said, and when you're going back."),
    ("table", ["Date", "Treatment", "What my esthetician said", "Next visit"], [13, 24, 45, 18], 10, "visit", 40),
    ("h", "Questions for my next visit"),
    ("lines", 5, "questions"),
]}

HABITS_ROWS = ["Sunscreen", "Water", "7 hours of sleep", "Removed makeup", "Hands off my face", "Fresh pillowcase",
               "Moved my body"]
HABITS = {"name": "Habits", "kicker": K, "blocks": [
    ("title", "Habit _Tracker_", "Tick a box every day you do it. Watch what happens to your skin on the good streaks."),
    ("table", [""] + [str(d) for d in range(1, 16)], [22] + [5.2] * 15,
     [[h] + ["[]"] * 15 for h in HABITS_ROWS], "hab1", 30, "grid"),
    ("table", [""] + [str(d) for d in range(16, 31)], [22] + [5.2] * 15,
     [[h] + ["[]"] * 15 for h in HABITS_ROWS], "hab2", 30, "grid"),
    ("h", "My best streak, and what I noticed"),
    ("lines", 4, "streak"),
]}

END = {"name": "Day 30", "kicker": K, "blocks": [
    ("title", "Day _30_", "Compare your first photo with today's. Then decide what stays."),
    ("cols", [("h", "Keep"), ("lines", 5, "keep")], [("h", "Let go"), ("lines", 5, "letgo")], 0.5),
    ("h", "My routine now"),
    ("cols", [("lines", 5, "am_final", "Morning")], [("lines", 5, "pm_final", "Evening")], 0.5),
    ("h", "The biggest thing I learned about my skin"),
    ("lines", 4, "learned"),
    ("callout", "Keep going", "Skin renews itself roughly every four weeks, and slows down with age. The best results "
     "come from the next thirty days, and the thirty after that."),
]}

DOC = {"title": NAME, "header": "brand", "foot": "Lumevina · Skin journal",
       "pages": [INTRO, ROUTINE, PRODUCTS, NEW, diary(1, 15), diary(16, 30),
                 checkin(1), checkin(2), checkin(3), checkin(4), PHOTOS, HABITS, VISITS, END]}

START = {
    "inside": [
        ("Journal", "%d pages: your routine, your products, patch tests, a 30-day diary, four weekly check-ins, a "
                    "photo log, a habit tracker, facial visits and a day-30 review." % len(DOC["pages"])),
        ("Two sizes", "US Letter and A4. Print it, or fill it in on an iPad or tablet: every line is a typing field."),
    ],
    "tips": [
        "Print it and keep it by the bathroom sink, or open it in a PDF app on your tablet.",
        "Start with My Routine and My Products. You'll see where your skin care money goes.",
        "Fill in one line of the diary each night, and a check-in every Sunday.",
        "Bring it to your next facial. Your esthetician will love you for it.",
    ],
    "paper": "Print double-sided and staple, or three-hole punch it into a small binder.",
    "legal": False,
    "fillable": True,
}


CSS = """
body{font-size:10pt}
.title h1{font-size:31pt}.title p{font-size:10.2pt}
.h{font-size:8pt;margin:17pt 0 9pt}
.lb{font-size:9.2pt}
.cgrid{font-size:9.8pt;gap:6pt 12pt}
.cb{width:10pt;height:10pt}
.ln{height:20pt}.lines .ln{height:22pt}
table.t{font-size:9.2pt}table.t th{font-size:7.4pt}
.callout{padding:12pt 15pt 11pt}.callout .ct{font-size:15pt}
ol.steps li{margin-bottom:4pt}
"""


def build(c):
    c.pdf(DOC, "Skin Journal - US Letter.pdf", "letter", fillable=True, extra_css=CSS)
    c.pdf(DOC, "Skin Journal - A4.pdf", "a4", fillable=True, extra_css=CSS)
    c.start_here(formats=("pdf",))
