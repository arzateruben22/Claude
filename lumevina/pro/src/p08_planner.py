"""08 · Open Your Studio: a 90-day planner for estheticians going out on their own."""

SLUG = "08-open-your-studio-planner"
NAME = "Open Your Studio 90-Day Planner"

WEEKS = [
    ("Paperwork, insurance and the room", "Get every license, permit and policy in order, and set up the treatment "
     "room so it's ready for a client."),
    ("Forms, menu and prices", "Finish your intake and consent forms, your service menu and your prices. Keep the "
     "menu short."),
    ("Your booking page and profiles", "Booking link live, Google Business Profile claimed and verified, Instagram bio "
     "updated with the link."),
    ("The soft launch", "Invite friends, family and past clients. Treat every visit like a real one, and ask each "
     "person for honest feedback."),
    ("Doors open", "Your first full week. Rebook every client before they leave. Note what slowed you down."),
    ("Reviews", "Ask every client so far for a Google review, with a direct link. Aim for ten."),
    ("Launch your membership", "Introduce it to every client this week, and send one text to everyone you've seen."),
    ("A referral partner", "Pick one local business (a salon, gym or boutique) and offer to swap referrals."),
    ("Month two review", "Look at the numbers. Adjust prices, hours or services that aren't pulling their weight."),
    ("A month of content", "Film and write a month of posts in one sitting, then schedule them."),
    ("Your retail shelf", "Choose three hero products you use in every facial, and recommend them at checkout."),
    ("Fill the calendar ahead", "Make sure every regular has their next two visits booked."),
    ("Day 90", "Review, celebrate and set goals for the next 90 days."),
]

PAPERWORK = [
    ["Esthetician license current and displayed", None, "[]", None],
    ["City or county business license", None, "[]", None],
    ["Business name registered (DBA), if not your legal name", None, "[]", None],
    ["EIN from IRS.gov (free), if you'll use one", None, "[]", None],
    ["Seller's permit, if you'll sell retail", None, "[]", None],
    ["Professional and general liability insurance", None, "[]", None],
    ["Business bank account", None, "[]", None],
    ["Booking and card payments set up", None, "[]", None],
    ["Suite or room lease reviewed (term, hours, what's included)", None, "[]", None],
    ["EPA-registered disinfectant, sharps container, first-aid kit", None, "[]", None],
    ["Intake, consent and policy forms ready", None, "[]", None],
    ["Bookkeeping set up", None, "[]", None],
    ["Booking page, Google Business Profile, Instagram link", None, "[]", None],
    ["Emergency contacts and a plan for a client reaction", None, "[]", None],
]

EQUIPMENT = ["Treatment bed", "Stool", "Magnifying lamp", "Steamer", "Towel warmer", "Trolley", "Wax warmer",
             "High frequency", "LED device", "Disinfection jar", "Linens and blankets", "Bolster"]
DISPOSABLES = ["Gloves", "Cotton rounds", "Gauze", "Spatulas", "Lancets", "Bed roll", "Headbands", "Sponges",
               "Mask brushes", "Wax strips", "Blades (if dermaplaning)", "Paper towels"]
BACKBAR = ["Cleanser", "Enzyme or exfoliant", "Peels", "Masks", "Serums", "Moisturizer", "Sunscreen",
           "Massage medium", "Pre- and post-wax", "Eye makeup remover", "Toner", "Spot treatment"]

POSTS = ["What happens in a facial, in 30 seconds", "Your room tour", "Meet your esthetician", "A myth, busted",
         "Before and after (with consent)", "The product I'd buy again", "What SPF actually does",
         "Morning routine in 3 steps", "Evening routine in 3 steps", "A client's question, answered",
         "What a peel feels like", "Why I ask about your medications", "Brazilian: what to expect",
         "How often to get a facial", "Behind the scenes: setting up", "Your skin in winter", "Your skin in summer",
         "A day in the studio", "Three signs of a damaged barrier", "What I'd never put on my face",
         "The membership, explained", "A review, read out loud", "Gift card reminder", "Last-minute opening",
         "How to prep for your first facial", "Aftercare that actually matters", "A tool I love and why",
         "Answering “is this normal?”", "Your skin at every age", "Thank you: what 90 days taught me"]


def week_page(i, focus, why):
    n = i + 1
    return {"name": "Week %d" % n, "kicker": "90-Day Planner", "blocks": [
        ("title", "Week %d _of 13_" % n, ""),
        ("fields", [("Dates", 1.6, "w%d_dates" % n), ("", 1.4, "")]),
        ("callout", "This week: " + focus, why),
        ("cols", [
            ("h", "Top three"),
            ("lines", 3, "w%d_top" % n),
            ("h", "Bookings"),
            ("fields", [("Goal", 1, "w%d_book_goal" % n), ("Booked", 1, "w%d_booked" % n)]),
            ("fields", [("New clients", 1, "w%d_new" % n), ("Rebooked", 1, "w%d_rebooked" % n)]),
            ("h", "Money"),
            ("fields", [("In", 1, "w%d_in" % n), ("Out", 1, "w%d_out" % n)]),
        ], [
            ("h", "To do"),
            ("table", ["✓", "Task"], [10, 90], [["[]", None] for _ in range(7)], "w%d_todo" % n, 17),
        ], 0.5),
        ("h", "Posts this week"),
        ("table", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], [14.3] * 7, 1, "w%d_posts" % n, 40, "grid"),
        ("cols", [("h", "Wins"), ("lines", 3, "w%d_wins" % n)],
         [("h", "Next week"), ("lines", 3, "w%d_next" % n)], 0.5),
        ("box", "Notes", 2.7, "w%d_notes" % n),
    ]}


def review_page(month, weeks):
    m = "m%d" % month
    return {"name": "Month %d review" % month, "kicker": "90-Day Planner", "blocks": [
        ("title", "Month %d _Review_" % month, "Weeks %s. Look at the numbers before you look at the feelings." % weeks),
        ("h", "The numbers"),
        ("table", ["", "Goal", "Actual", "Notes"], [34, 16, 16, 34], [
            ["Clients seen", None, None, None], ["New clients", None, None, None],
            ["Rebooked before leaving", None, None, None], ["Members", None, None, None],
            ["Reviews", None, None, None], ["Money in", None, None, None], ["Money out", None, None, None],
            ["Kept", None, None, None]], m, 20),
        ("cols", [("h", "What worked"), ("lines", 5, m + "_worked")],
         [("h", "What didn't"), ("lines", 5, m + "_didnt")], 0.5),
        ("h", "Change next month"),
        ("lines", 3, m + "_change"),
        ("h", "One thing I'm proud of"),
        ("lines", 2, m + "_proud"),
        ("box", "Notes", 1.7, m + "_notes"),
    ]}


INTRO = {"name": "Start", "kicker": "90-Day Planner", "blocks": [
    ("title", "Open Your _Studio_", "A 90-day planner for estheticians going out on their own: the checklists, the "
     "numbers and thirteen weeks of focus."),
    ("h", "How to use it"),
    ("steps", ["Work through the three checklists before your first client: the paperwork, the room and your prices.",
               "Each week has one focus. Do that first; everything else is a bonus.",
               "Track your first 25 clients. Where they came from tells you where to spend your time.",
               "At the end of each month, fill in the review before you plan the next one."]),
    ("h", "Where I want to be on day 90"),
    ("fields", [("Clients a week", 1, "goal_clients"), ("Members", 1, "goal_members")]),
    ("fields", [("Money in a month", 1, "goal_revenue"), ("Google reviews", 1, "goal_reviews")]),
    ("fields", [("Hours a week", 1, "goal_hours"), ("Days off a week", 1, "goal_off")]),
    ("h", "Why I'm doing this"),
    ("lines", 3, "why"),
    ("h", "The thirteen weeks"),
    ("table", ["Week", "Focus"], [12, 88], [[str(i + 1), w[0]] for i, w in enumerate(WEEKS)], "plan", 13),
]}

PAPER = {"name": "Before you open", "kicker": "90-Day Planner", "blocks": [
    ("title", "Before You _Open_", "The paperwork. Requirements differ by state and city, so confirm each one with your "
     "state board and city hall."),
    ("table", ["Item", "Where or who", "Done", "Date"], [52, 26, 8, 14], PAPERWORK, "paper", 22),
    ("h", "Important numbers"),
    ("fields", [("License number", 1, "license"), ("Renews", 0.7, "license_renew")]),
    ("fields", [("Insurance policy", 1, "insurance"), ("Renews", 0.7, "insurance_renew")]),
    ("fields", [("Business license", 1, "business_license"), ("Renews", 0.7, "business_renew")]),
    ("fields", [("Seller's permit", 1, "sellers_permit"), ("Renews", 0.7, "sellers_renew")]),
    ("h", "Questions for my accountant, insurer or landlord"),
    ("lines", 5, "questions"),
]}

ROOM = {"name": "The room", "kicker": "90-Day Planner", "blocks": [
    ("title", "The _Room_", "Everything to have before your first client. Tick what you have, circle what you need."),
    ("h", "Equipment"),
    ("checks", "", EQUIPMENT, "equip", 3),
    ("h", "Disposables"),
    ("checks", "", DISPOSABLES, "disp", 3),
    ("h", "Backbar"),
    ("checks", "", BACKBAR, "backbar", 3),
    ("h", "Your three hero products for the shelf"),
    ("table", ["Product", "Your cost", "Price", "Why it's the one"], [34, 13, 13, 40], 3, "hero", 20),
    ("h", "Budget"),
    ("fields", [("Equipment", 1, "b_equip"), ("Supplies", 1, "b_supplies"), ("Retail", 1, "b_retail")]),
    ("fields", [("Furniture and decor", 1, "b_decor"), ("Marketing", 1, "b_marketing"), ("Total", 1, "b_total")]),
    ("h", "Shopping list"),
    ("lines", 5, "shopping"),
]}

PRICING = {"name": "Your prices", "kicker": "90-Day Planner", "blocks": [
    ("title", "Your _Prices_", "Price from what an hour has to earn, not from what the studio down the street charges."),
    ("h", "What an hour has to earn"),
    ("fields", [("Monthly costs (rent, insurance, software, marketing)", 3, "p_costs"), ("", 1, "")]),
    ("fields", [("Your monthly pay goal", 3, "p_pay"), ("", 1, "")]),
    ("fields", [("Hours you'll treat clients each month", 3, "p_hours"), ("", 1, "")]),
    ("fields", [("Costs + pay, divided by hours = each hour must earn", 3, "p_hour"), ("", 1, "")]),
    ("small", "Example: $1,800 in costs + $4,000 pay = $5,800. Over 100 treatment hours, each hour must earn $58, "
              "before product. Most studios book 60 to 70% of their open hours in year one, so plan for that."),
    ("h", "Your services"),
    ("table", ["Service", "Minutes", "Product cost", "Price", "Earns per hour"], [36, 14, 16, 14, 20], 15, "svc", 22),
    ("small", "Earns per hour = (price − product cost) ÷ minutes × 60. Anything below your hourly "
              "number needs a new price, a shorter time, or a spot as an add-on instead."),
]}

CLIENTS = {"name": "First 25 clients", "kicker": "90-Day Planner", "blocks": [
    ("title", "Your First _25 Clients_", "Where they came from tells you where to spend your time."),
    ("table", ["#", "Name", "Came from", "First visit", "Rebooked", "Review", "Member"], [5, 27, 24, 14, 10, 10, 10],
     [[str(i + 1), None, None, None, "[]", "[]", "[]"] for i in range(25)], "cl", 22),
    ("small", "Came from: friend or family, past client, Instagram, Google, referral, partner business, walk-by, other."),
]}

CONTENT = {"name": "30 post ideas", "kicker": "90-Day Planner", "blocks": [
    ("title", "30 Post _Ideas_", "Never stare at a blank screen. Tick them off as you go."),
    ("cols", [("table", ["✓", "Idea"], [10, 90], [["[]", p] for p in POSTS[:15]], "posts_a", 23)],
     [("table", ["✓", "Idea"], [10, 90], [["[]", p] for p in POSTS[15:]], "posts_b", 23)], 0.5),
    ("h", "Your own ideas"),
    ("lines", 8, "own_ideas"),
]}

DAY90 = {"name": "Day 90", "kicker": "90-Day Planner", "blocks": [
    ("title", "Day _90_", "Look how far you've come."),
    ("table", ["", "Day 1", "Day 90"], [40, 30, 30], [
        ["Clients a week", None, None], ["Members", None, None], ["Money in a month", None, None],
        ["Google reviews", None, None], ["Instagram followers", None, None]], "d90", 22),
    ("h", "What I learned"),
    ("lines", 4, "learned"),
    ("h", "Keep doing"),
    ("lines", 2, "keep"),
    ("h", "Stop doing"),
    ("lines", 2, "stop"),
    ("h", "The next 90 days"),
    ("fields", [("Clients a week", 1, "n_clients"), ("Members", 1, "n_members"), ("Money in", 1, "n_revenue")]),
    ("lines", 3, "next90"),
]}


def pages():
    out = [INTRO, PAPER, ROOM, PRICING, CLIENTS, CONTENT]
    for i, (focus, why) in enumerate(WEEKS):
        out.append(week_page(i, focus, why))
        if i == 3:
            out.append(review_page(1, "1 to 4"))
        if i == 8:
            out.append(review_page(2, "5 to 9"))
    out.append(review_page(3, "10 to 13"))
    out.append(DAY90)
    return out


DOC = {"title": NAME, "header": "brand", "foot": "Lumevina Studio · Open your studio", "pages": pages()}

START = {
    "inside": [
        ("Planner", "%d pages: three checklists (paperwork, the room, your prices), a first-25-clients tracker, 30 post "
                    "ideas, thirteen weekly pages with a focus for each week, three monthly reviews and a day-90 "
                    "reflection." % len(DOC["pages"])),
        ("Two sizes", "US Letter and A4. Print it, or fill it in on an iPad: every line is a typing field."),
    ],
    "tips": [
        "Print the whole planner, or just the checklists and the week you're in.",
        "On an iPad, open it in Adobe Acrobat Reader or GoodNotes and type or write straight on the pages.",
        "Start with the three checklists before your first client.",
        "Each Monday, read the week's focus and pick your top three.",
    ],
    "paper": "Print double-sided and hole-punch it into a binder, or have a print shop spiral-bind it.",
    "legal": False,
    "fillable": True,
}


def build(c):
    c.pdf(DOC, "Open Your Studio 90-Day Planner - US Letter.pdf", "letter", fillable=True)
    c.pdf(DOC, "Open Your Studio 90-Day Planner - A4.pdf", "a4", fillable=True)
    c.start_here(formats=("pdf",))
