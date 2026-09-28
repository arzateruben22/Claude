"""The "Start here" page that opens every download."""

SHOP = "Lumevina Studio"
MAKER = ("Designed by Evelyn Romero, licensed esthetician and owner of Lumevina Aesthetics in Woodland Hills, "
         "California, from the forms and tools she uses in her own studio.")

LEGAL = ("These are templates, not legal or medical advice. Rules for estheticians differ from state to state and "
         "country to country. Before you use them, check your licensing board's scope of practice and have a local "
         "attorney review the consent forms and policies.")

LICENSE = ("Use these files in your own business, and print or share filled-in copies with your clients as often as "
           "you like. Please don't resell, share or give away the files themselves, edited or not. One purchase "
           "covers one business; message us for a multi-location license.")


def doc(name, start, formats=("word", "pdf")):
    tips = start["tips"]
    blocks = [
        ("title", "Start _here_", "Thank you for your order. Here's what's in your download and how to make it yours."),
        ("h", "What's inside"),
        ("kv", start["inside"]),
        ("h", "Make it yours"),
        ("steps", tips),
    ]
    left, right = [], []
    if "word" in formats:
        left += [("h", "Fonts"),
                 ("p", "The designs use **Cormorant Garamond** and **Jost**, free at fonts.google.com. Google Docs "
                       "has both. Without them, Word swaps in a similar font and everything still works.")]
    if "pdf" in formats:
        left += [("h", "Printing"),
                 ("list", ["Print at **Actual size** (100%), not \u201cFit to page.\u201d",
                           "Use the US Letter or A4 version to match your paper.",
                           start.get("paper", "Plain 24 lb paper is fine; 32 lb feels more premium.")])]
    if start.get("fillable", "pdf" in formats and start.get("legal")):
        right += [("h", "On an iPad or phone"),
                  ("steps", ["Open the fillable PDF in **Files**, **Adobe Acrobat Reader** or any PDF app.",
                             "Tap a line or box to type or tick it. Use **Markup** or **Fill & Sign** to sign.",
                             "Save a copy to the client's record, or email or AirDrop it to yourself."])]
    if left and right:
        blocks.append(("cols", left, right, 0.5))
    else:
        blocks += left + right
    for extra in start.get("extra", []):
        blocks.append(extra)
    if start.get("legal"):
        blocks += [("h", "Before you use them"), ("p", LEGAL)]
    blocks += [("cols", [("h", "Your license"), ("p", LICENSE)],
                [("h", "Questions"),
                 ("p", "Message us on Etsy anytime. We reply within one business day and are happy to help you "
                       "edit or print.")], 0.62),
               ("callout", "From our studio to yours", MAKER + " Some wording was drafted with the help of AI "
                "writing tools, then checked and edited by hand.")]
    return {"title": "Start here · " + name, "header": "brand", "foot": SHOP + " · " + name,
            "pages": [{"name": "Start here", "kicker": name, "blocks": blocks}]}
