"""10 · The Esthetician Business Kit: products 01 to 08 together, with the client journal as a bonus."""
import os, zipfile

SLUG = "10-esthetician-business-kit"
NAME = "Esthetician Business Kit"

MAX_ZIP = 19.0e6          # Etsy takes files up to 20 MB each, five per listing

START = {
    "inside": [
        ("Client Intake & Consent Kit", "Eight fillable forms, plus Word versions."),
        ("Aftercare Card Set", "Eight 5 x 7 cards, print sheets, phone versions and Word."),
        ("Skin Analysis & Treatment Record", "Face map, visit log and progress map."),
        ("Service Menu & Price List", "Menu, price list and a 40-description library."),
        ("Membership Pricing Calculator", "Spreadsheet: tiers, break-even and a 12-month plan."),
        ("Bookkeeping & Profit Tracker", "Spreadsheet: income, expenses, products and profit."),
        ("Rebooking & Membership Scripts", "About 45 scripts for the room, texts, DMs and policies."),
        ("Open Your Studio Planner", "A 90-day planner with checklists and weekly pages."),
        ("Bonus: Skin Journal", "A 30-day journal to print for your clients or sell in your studio."),
    ],
    "tips": [
        "Unzip everything into one folder. Each product has its own Start Here page.",
        "Start with the Intake & Consent Kit and the Service Menu: they're what clients see first.",
        "Then set up the two spreadsheets, and work through the planner one week at a time.",
    ],
    "extra": [("h", "The bonus journal"),
              ("p", "With this kit you may print the Skin Journal for your own clients, give it away with a facial "
                    "series, or sell printed copies in your studio. Please don't share or sell the PDF itself.")],
    "legal": True,
    "fillable": False,
}


def build(c):
    c.start_here(formats=())


def pack(dist, mods):
    """Zip products 01 to 09 into as few files as Etsy allows."""
    out = os.path.join(dist, SLUG, "files")
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith(".zip"):
            os.remove(os.path.join(out, f))
    entries = []
    for m in mods:
        if m.SLUG.startswith("10"):
            continue
        d = os.path.join(dist, m.SLUG, "files")
        folder = "%s %s" % (m.SLUG[:2], m.NAME if not m.SLUG.startswith("09") else "BONUS " + m.NAME)
        for f in sorted(os.listdir(d)):
            entries.append((os.path.join(d, f), "%s/%s" % (folder, f)))
    parts, cur, size = [], [], 0
    for src, arc in entries:
        s = os.path.getsize(src)
        if cur and size + s > MAX_ZIP:
            parts.append(cur)
            cur, size = [], 0
        cur.append((src, arc))
        size += s
    parts.append(cur)
    names = []
    for i, part in enumerate(parts):
        name = "Esthetician Business Kit%s.zip" % ("" if len(parts) == 1 else " - Part %d of %d" % (i + 1, len(parts)))
        with zipfile.ZipFile(os.path.join(out, name), "w", zipfile.ZIP_DEFLATED) as z:
            for src, arc in part:
                z.write(src, arc)
        names.append(name)
    return names
