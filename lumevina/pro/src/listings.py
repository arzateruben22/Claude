"""The Etsy catalog: titles, tags, descriptions, prices and sections for all ten listings.

write() checks every listing against Etsy's limits and writes
    dist/etsy/listings.json   read by etsy/upload.py
    dist/etsy/listings.csv    for copy-paste or a bulk-listing tool
"""
import csv, json, os, re

SHOP = "LumevinaStudio"
SECTIONS = ["Client Forms", "Studio Business", "Planners and Journals", "Bundles"]

MADE_BY = ("MADE BY\n"
           "Evelyn Romero, licensed esthetician and owner of Lumevina Aesthetics in Woodland Hills, California. "
           "These are the tools she uses in her own studio, cleaned up for yours. They were created with the help of "
           "AI writing and design tools, then reviewed and edited by hand.")
DIGITAL = ("HOW IT WORKS\n"
           "• This is a digital download. Nothing will be shipped.\n"
           "• Right after you check out, Etsy gives you a download link (Purchases and reviews, in your account).\n"
           "• Open the Start Here page first. It shows you how to edit, print and use everything.")
LICENSE = ("YOUR LICENSE\n"
           "Use it in your own business and print as many copies as you need for your clients. Please don't resell "
           "or share the files. One purchase covers one business.")
LEGAL = ("GOOD TO KNOW\n"
         "These are templates, not legal or medical advice. Rules for estheticians differ by state and country, so "
         "check your licensing board's scope of practice and have a local attorney review consent forms and "
         "policies before you use them.")
QUESTIONS = "Questions? Message us any time. We reply within one business day."


def desc(hook, included, formats, extra=None, legal=False):
    parts = [hook, "WHAT'S INCLUDED\n" + "\n".join("• " + x for x in included),
             "FORMATS\n" + "\n".join("• " + x for x in formats), DIGITAL]
    if extra:
        parts.append(extra)
    if legal:
        parts.append(LEGAL)
    parts += [MADE_BY, LICENSE, QUESTIONS]
    return "\n\n".join(parts)


CATALOG = {
    "01": {
        "title": "Esthetician Intake and Consent Forms Kit, 8 Fillable PDF and Word Spa Forms, Facial, Chemical Peel, Waxing, Dermaplaning",
        "price": 24.00, "section": "Client Forms",
        "tags": ["esthetician forms", "client intake form", "consent form", "facial consent form", "spa intake form",
                 "skincare forms", "chemical peel form", "waxing consent", "dermaplaning form", "fillable pdf form",
                 "salon forms", "esthetician gift", "beauty business"],
        "description": desc(
            "Every form a new client signs, written by a licensed esthetician and ready to use today. Clients can fill "
            "them in on an iPad, or you can print them. Edit every word in the Word version.",
            ["Client Intake: contact details, skin goals, skin type questions and current routine",
             "Health History: 14 yes/no questions (isotretinoin, retinoids, pregnancy, cold sores and more), allergies and medications",
             "Facial Treatment Consent", "Chemical Peel Consent, with patch test and studio notes",
             "Dermaplaning Consent", "Waxing Consent, with areas", "Photo Release with sharing choices",
             "Studio Policies: deposits, cancellations, late arrivals, refunds and privacy",
             "A Start Here guide"],
            ["Fillable PDF, US Letter (8.5 x 11 in)", "Fillable PDF, A4",
             "Editable Word file (works in Microsoft Word, Google Docs and Pages)"], legal=True),
    },
    "02": {
        "title": "Aftercare Cards for Estheticians, 8 Printable 5x7 Cards and Phone Versions, Facial, Peel, Waxing, Lash Lift, Brow Lamination",
        "price": 14.00, "section": "Client Forms",
        "tags": ["aftercare card", "esthetician card", "facial aftercare", "waxing aftercare", "peel aftercare",
                 "lash lift aftercare", "brow lamination", "skincare card", "spa aftercare", "printable card",
                 "esthetician gift", "beauty business", "client care card"],
        "description": desc(
            "Send every client home knowing exactly what to do. Eight aftercare cards that answer the questions you "
            "get the night after a treatment, in calm, clear language. Print them, or text the phone version before "
            "the client reaches the car.",
            ["Facial", "Acne Facial and extractions", "Chemical Peel", "Dermaplaning", "Face Waxing",
             "Body Waxing, including bikini and Brazilian", "Lash Lift and Tint", "Brow Lamination and Tint",
             "Each card: the first day, the next few days, what's normal, and when to call"],
            ["Print sheets: two 5 x 7 in cards per page with crop marks, US Letter and A4",
             "Phone versions: eight 1080 x 1920 images to text, email or share to stories",
             "Editable Word file with each card on its own 5 x 7 page"], legal=True),
    },
    "03": {
        "title": "Skin Analysis Face Map and Treatment Record, Fillable Esthetician Consultation Form, Facial Chart, Client Progress Map",
        "price": 9.00, "section": "Client Forms",
        "tags": ["face map", "skin analysis form", "facial consultation", "esthetician forms", "treatment record",
                 "client record", "skin consultation", "facial chart", "esthetician chart", "skincare form",
                 "spa client form", "fillable pdf form", "beauty business"],
        "description": desc(
            "A professional skin analysis in one page: a clean face map with numbered zones and a marking key, skin "
            "type, Fitzpatrick and Glogau, today's hydration, oil and sensitivity, concerns and the plan.",
            ["Skin Analysis with face map, marking key and treatment plan",
             "Treatment Record: 22 visits per page with products, strengths and skin response",
             "Progress Map: before and now face maps to show clients how far they've come",
             "A Start Here guide"],
            ["Fillable PDF, US Letter and A4 (mark the face map with Apple Pencil in Markup)",
             "Editable Word file"]),
    },
    "04": {
        "title": "Esthetician Service Menu and Price List Template, Editable Word Spa Menu with 40 Facial and Waxing Descriptions",
        "price": 14.00, "section": "Studio Business",
        "tags": ["service menu", "price list template", "spa menu template", "esthetician menu", "facial menu",
                 "salon price list", "menu template", "beauty price list", "editable menu", "word template",
                 "service list", "esthetician gift", "spa price list"],
        "description": desc(
            "An elegant service menu and price list you can make yours in ten minutes, plus the part everyone gets "
            "stuck on: forty service descriptions, already written.",
            ["Two-page service menu with descriptions, times and prices",
             "One-page price list", "Description Library: 40 ready-to-use service descriptions",
             "Wording guide: how to describe results without medical claims",
             "Six tips for a menu that sells"],
            ["Editable Word files (Microsoft Word, Google Docs, Pages)", "Sample PDFs to see the finished look"]),
    },
    "05": {
        "title": "Spa Membership Pricing Calculator, Esthetician Spreadsheet for Excel and Google Sheets, Break-Even and 12-Month Plan",
        "price": 19.00, "section": "Studio Business",
        "tags": ["membership pricing", "spa membership", "pricing spreadsheet", "salon spreadsheet",
                 "business calculator", "excel template", "google sheets", "subscription price", "beauty business",
                 "esthetician tools", "facial membership", "small business tool", "pricing calculator"],
        "description": desc(
            "Price a monthly facial membership with confidence. Put in your costs and up to three tiers, and see what "
            "each member is worth, how many members cover your bills, how many pay you, and how full your calendar gets.",
            ["Calculator: your costs, three tiers, card fees, product costs and perks",
             "The answers: kept per member, break-even members, members for your pay goal, hours filled",
             "Your First Year: a 12-month growth plan with sign-ups and cancellations",
             "Price Test: profit at 12 prices and 6 member counts, color-coded",
             "Example numbers modeled on a small studio, to start from"],
            ["Excel file (.xlsx) that opens in Excel, Google Sheets and Numbers"]),
    },
    "06": {
        "title": "Esthetician Bookkeeping and Profit Tracker, Salon Income, Expense and Inventory Spreadsheet, Excel and Google Sheets",
        "price": 16.00, "section": "Studio Business",
        "tags": ["bookkeeping sheet", "profit tracker", "expense tracker", "income tracker", "salon bookkeeping",
                 "small business excel", "esthetician tools", "google sheets", "excel template", "beauty business",
                 "spa bookkeeping", "inventory tracker", "tax spreadsheet"],
        "description": desc(
            "Know what you actually keep. Log sales and expenses in seconds with drop-downs, and the tracker works out "
            "card fees, monthly profit, your tax set-aside and your best month.",
            ["Income log with tips, payment method and automatic card fees",
             "Expense log with 13 beauty-business categories", "Retail product tracker with margins and reorder alerts",
             "Month by Month profit and loss", "The Year at a Glance dashboard", "600 rows ready in each log"],
            ["Excel file (.xlsx) that opens in Excel, Google Sheets and Numbers"],
            extra="This tracker helps you stay organized. It isn't tax advice; share it with your tax preparer."),
    },
    "07": {
        "title": "Rebooking and Membership Scripts for Estheticians, 45 Client Text Templates, No-Show Policy Wording, Spa Marketing",
        "price": 15.00, "section": "Studio Business",
        "tags": ["rebooking scripts", "salon scripts", "esthetician scripts", "client text template",
                 "spa marketing", "beauty business", "membership scripts", "salon marketing", "client retention",
                 "text templates", "esthetician tools", "no show policy", "booking policy"],
        "description": desc(
            "The words that fill a calendar, in a voice that never feels pushy. What to say in the treatment room, what "
            "to text, and how to answer the questions every client asks.",
            ["In the room: the rebook, offering two times, the home-care handoff",
             "The membership: how to introduce it, plus answers to cancel, cost and \"let me think about it\"",
             "Texts: confirmations, reminders, check-ins, win-backs, openings, birthdays, reviews and referrals",
             "Protecting your time: deposits, late cancellations, no-shows, running late and price increases",
             "DMs: price questions, availability, acne, services outside your scope and reviews"],
            ["PDF, US Letter and A4", "Editable Word file"]),
    },
    "08": {
        "title": "Open Your Esthetics Studio 90-Day Planner, Printable Business Checklist, Pricing Worksheet and Weekly Pages",
        "price": 17.00, "section": "Planners and Journals",
        "tags": ["esthetician planner", "business planner", "salon planner", "spa business plan", "90 day planner",
                 "beauty business", "esthetician gift", "startup checklist", "open a salon", "small business plan",
                 "goal planner", "printable planner", "new esthetician"],
        "description": desc(
            "Going out on your own? This planner turns the first ninety days into one clear focus a week, with the "
            "checklists and numbers you need before your first client.",
            ["Before You Open: a paperwork checklist", "The Room: equipment, disposables and backbar checklists",
             "Your Prices: what an hour must earn, service by service", "Your First 25 Clients tracker",
             "30 post ideas", "13 weekly pages, each with a focus", "3 monthly reviews and a Day 90 reflection"],
            ["Fillable PDF, US Letter and A4: print it or type on an iPad"]),
    },
    "09": {
        "title": "Skincare Journal and Routine Planner, 30-Day Skin Tracker, Printable and Fillable, Acne and Habit Tracker",
        "price": 8.00, "section": "Planners and Journals",
        "tags": ["skincare journal", "skin care planner", "skincare routine", "skin tracker", "acne tracker",
                 "beauty planner", "self care journal", "printable journal", "skincare gift", "habit tracker",
                 "wellness journal", "skin diary", "routine planner"],
        "description": desc(
            "Thirty days to finally understand your skin: what you use, how it responds, and what actually works. "
            "Made by a licensed esthetician who wishes every client kept one.",
            ["My routine: morning, evening and weekly", "My products, with opened and use-by dates",
             "Patch tests and a slow start for anything new", "A 30-day diary", "Four weekly check-ins",
             "Progress photo log", "Habit tracker", "Facial visits and questions", "Day 30 review"],
            ["Fillable PDF, US Letter and A4: print it or fill it in on a tablet"]),
    },
    "10": {
        "title": "Esthetician Business Kit Bundle, Intake and Consent Forms, Aftercare Cards, Service Menu, Spreadsheets and Planner",
        "price": 69.00, "section": "Bundles",
        "tags": ["esthetician bundle", "esthetician forms", "spa business kit", "salon templates", "beauty business",
                 "esthetician gift", "client intake form", "aftercare card", "service menu", "business planner",
                 "esthetician tools", "spa templates", "new esthetician"],
        "description": desc(
            "Everything you need to run your studio like a pro, in one download: the forms, the cards, the menu, the "
            "numbers and the plan. Eight products plus a bonus, for about half the price of buying them one by one.",
            ["Client Intake and Consent Kit (8 forms)", "Aftercare Card Set (8 cards)",
             "Skin Analysis and Treatment Record", "Service Menu and Price List with 40 descriptions",
             "Membership Pricing Calculator", "Bookkeeping and Profit Tracker",
             "Rebooking and Membership Scripts", "Open Your Studio 90-Day Planner",
             "Bonus: Skin Journal, which you may print for your clients"],
            ["Fillable PDFs (US Letter and A4), Word files and Excel spreadsheets, in a ZIP"], legal=True),
    },
}

TAG_OK = re.compile(r"^[A-Za-z0-9 ]+$")


def check(key, item):
    errs = []
    t = item["title"]
    if len(t) > 140:
        errs.append("title is %d characters (max 140)" % len(t))
    for ch in "%:&":
        if t.count(ch) > 1:
            errs.append("title uses %r more than once" % ch)
    if len(item["tags"]) > 13:
        errs.append("%d tags (max 13)" % len(item["tags"]))
    if len(set(item["tags"])) != len(item["tags"]):
        errs.append("repeated tag")
    for tag in item["tags"]:
        if len(tag) > 20 or not TAG_OK.match(tag):
            errs.append("tag %r is too long or has symbols" % tag)
    if item["section"] not in SECTIONS:
        errs.append("unknown section")
    return ["%s: %s" % (key, e) for e in errs]


def write(mods, dist):
    out = os.path.join(dist, "etsy")
    os.makedirs(out, exist_ok=True)
    rows, problems = [], []
    for m in mods:
        key = m.SLUG[:2]
        item = dict(CATALOG[key])
        problems += check(key, item)
        fdir = os.path.join(dist, m.SLUG, "files")
        idir = os.path.join(dist, m.SLUG, "images")
        files = sorted(os.listdir(fdir)) if os.path.isdir(fdir) else []
        # Start Here first, so it's the first thing a buyer sees
        files.sort(key=lambda f: (not f.startswith("Start Here"), f))
        images = sorted(os.listdir(idir)) if os.path.isdir(idir) else []
        if len(files) > 5:
            problems.append("%s: %d files (Etsy allows 5 per listing)" % (key, len(files)))
        for f in files:
            if os.path.getsize(os.path.join(fdir, f)) > 20e6:
                problems.append("%s: %s is over 20 MB" % (key, f))
        item.update({"key": key, "slug": m.SLUG, "name": m.NAME,
                     "files": ["%s/files/%s" % (m.SLUG, f) for f in files],
                     "images": ["%s/images/%s" % (m.SLUG, f) for f in images],
                     "type": "download", "who_made": "i_did", "when_made": "made_to_order", "is_supply": False,
                     "quantity": 999})
        rows.append(item)
    if problems:
        raise SystemExit("Listing problems:\n  " + "\n  ".join(problems))
    json.dump({"shop": SHOP, "sections": SECTIONS, "listings": rows}, open(os.path.join(out, "listings.json"), "w"),
              indent=2, ensure_ascii=False)
    with open(os.path.join(out, "listings.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["key", "title", "price", "section", "tags", "files", "images", "description"])
        for r in rows:
            w.writerow([r["key"], r["title"], "%.2f" % r["price"], r["section"], ", ".join(r["tags"]),
                        " | ".join(os.path.basename(x) for x in r["files"]),
                        " | ".join(os.path.basename(x) for x in r["images"]), r["description"]])
    return rows
