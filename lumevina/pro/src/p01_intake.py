"""01 · Client Intake & Consent Kit: eight forms a studio hands every new client."""

SLUG = "01-intake-consent-kit"
NAME = "Client Intake & Consent Kit"

RETINOIDS = "retinoids (retinol, tretinoin/Retin-A, adapalene/Differin, tazarotene)"

INTAKE = {"name": "Client Intake", "blocks": [
    ("title", "Client _Intake_", "Everything you share stays private and helps me plan a treatment that's right for your skin."),
    ("h", "About you"),
    ("fields", [("Full name", 3, "name"), ("Today's date", 1.3, "date")]),
    ("fields", [("Date of birth", 1.4, "dob"), ("Pronouns", 1, "pronouns"), ("Mobile", 1.6, "phone")]),
    ("fields", [("Email", 2.2, "email"), ("Occupation", 1.4, "occupation")]),
    ("fields", [("Address", 3.2, "address"), ("ZIP", 0.8, "zip")]),
    ("fields", [("Emergency contact", 2.2, "emergency"), ("Their phone", 1.4, "emergency_phone")]),
    ("checks", "Best way to reach you", ["Text", "Call", "Email"], "contact", 3),
    ("fields", [("How did you hear about me?", 3, "referral")]),
    ("h", "Your skin goals"),
    ("checks", "", ["Breakouts or acne", "Clogged pores and blackheads", "Fine lines and firmness",
                    "Dark spots or uneven tone", "Redness or sensitivity", "Dryness or dehydration",
                    "Oiliness and shine", "Rough texture", "Dullness", "Acne scarring",
                    "Ingrown hairs", "Simply relaxing"], "goal", 3),
    ("lines", 1, "success", "In your own words, what would make today a success?"),
    ("h", "Your skin today"),
    ("checks", "By midday my skin feels", ["Tight or dry", "Comfortable", "Shiny in the T-zone", "Shiny all over"], "midday", 4),
    ("checks", "New products usually", ["Agree with me", "Sometimes sting or redden", "Often irritate me"], "reacts", 3),
    ("checks", "In the sun I", ["Always burn", "Burn, then tan a little", "Tan easily", "Rarely burn or tan"], "sun", 4),
    ("h", "Your routine"),
    ("table", ["Step", "What you use (brand and product)", "AM", "PM"], [22, 62, 8, 8], [
        ["Cleanser", None, "[]", "[]"],
        ["Toner or essence", None, "[]", "[]"],
        ["Serums or treatments", None, "[]", "[]"],
        ["Moisturizer", None, "[]", "[]"],
        ["Sunscreen (SPF)", None, "[]", "[]"],
        ["Exfoliants, acids or scrubs", None, "[]", "[]"],
        ["Prescription creams", None, "[]", "[]"],
    ], "routine", 15),
    ("fields", [("Last facial or skin treatment", 2.3, "last_treatment"), ("When", 1, "last_when")]),
    ("fields", [("Anything that didn't agree with your skin?", 3, "disagree")]),
]}

HEALTH = {"name": "Health History", "blocks": [
    ("title", "Health _History_", "Some treatments aren't safe with certain medications or conditions. "
     "If anything changes before a future visit, please let me know."),
    ("fields", [("Client name", 3, "name"), ("Date", 1.3, "date")]),
    ("h", "Your health"),
    ("yn", [
        ("Are you pregnant, trying to conceive, or breastfeeding?", "pregnant"),
        ("Have you taken isotretinoin (Accutane, Absorica, Claravis) in the past 12 months?", "isotretinoin"),
        ("Do you use a retinoid (retinol, tretinoin/Retin-A, adapalene/Differin, tazarotene)?", "retinoids"),
        ("Are you taking antibiotics, oral steroids or blood thinners?", "meds"),
        ("Do you have diabetes or an autoimmune condition?", "diabetes"),
        ("Do you have a pacemaker, metal implants or a heart condition?", "heart"),
        ("Do you have epilepsy or a seizure disorder?", "seizure"),
        ("Do you get cold sores (herpes simplex)?", "cold_sores"),
        ("Have you had skin cancer or any moles that changed?", "skin_cancer"),
        ("Do you have eczema, rosacea, psoriasis or dermatitis?", "eczema"),
        ("Botox, fillers or other injectables in the past 2 weeks?", "injectables"),
        ("Laser, a peel, microneedling or surgery on the area in the past 4 weeks?", "procedures"),
        ("A sunburn, spray tan or tanning bed in the past week?", "sunburn"),
        ("Do you wear contact lenses?", "contacts"),
    ]),
    ("h", "Allergies and sensitivities"),
    ("checks", "", ["Latex", "Aspirin or salicylates", "Nuts", "Fragrance", "Bee products (honey, propolis)",
                    "Adhesives or tape", "Hair dye or tint", "None I know of", "Other ___"], "allergy", 3),
    ("lines", 2, "medications", "Medications and supplements you take"),
    ("lines", 1, "other_health", "Anything else about your health you'd like me to know?"),
    ("h", "Your acknowledgement"),
    ("p", "The information I've given is true and complete to the best of my knowledge. I'll tell my esthetician about "
          "any changes to my health, medications or skin before future treatments. I understand that esthetic "
          "treatments are cosmetic, not medical, and don't replace care from my doctor."),
    ("sign", [("Client signature", 3, "signature"), ("Date", 1.2, "sign_date")]),
    ("fields", [("Parent or guardian (if under 18)", 3, "guardian"), ("Date", 1.2, "guardian_date")]),
]}


def consent(name, title, sub, top, groups, closing, notes=None):
    blocks = [("title", title, sub)]
    blocks += top
    for heading, lines in groups:
        blocks.append(("h", heading))
        for i, text in enumerate(lines):
            if isinstance(text, tuple):
                blocks.append(text)
            else:
                blocks.append(("initial", text, "%s_%d" % (heading.split()[0].lower(), i + 1)))
    blocks += [("h", "Consent"), ("p", closing),
               ("sign", [("Client signature", 3, "signature"), ("Date", 1.2, "sign_date")]),
               ("sign", [("Esthetician", 3, "esthetician"), ("Date", 1.2, "esthetician_date")])]
    if notes:
        blocks += [("space", 0.08), ("box", notes, 1.05, "studio_notes")]
    return {"name": name, "blocks": blocks}


NAME_ROW = ("fields", [("Client name", 3, "name"), ("Date", 1.3, "date")])
READ = "Please read each statement and initial it. Ask me anything before you sign."

FACIAL = consent("Facial Consent", "Facial Treatment _Consent_", READ, [NAME_ROW], [
    ("About your treatment", [
        "I understand a facial may include cleansing, exfoliation, steam, extractions, masks, massage, LED light "
        "and professional skincare products, and that my esthetician will explain any step I ask about.",
        "I've shared my full health history, including medications, allergies and recent treatments. I understand "
        "that leaving something out can put my skin at risk.",
        "I understand that extractions can leave temporary redness or marks, and that I can ask to skip them.",
    ]),
    ("What to expect", [
        "My skin may be pink, sensitive or tight for a few hours, and some people notice a few breakouts or flaking "
        "for several days as the skin adjusts. These usually settle on their own.",
        "Results vary from person to person and depend on home care. No specific result has been promised to me.",
        "I'll follow the aftercare I'm given, contact the studio if anything worries me, and see a doctor for any "
        "reaction that is severe or doesn't improve.",
        "Esthetic treatments are cosmetic. My esthetician doesn't diagnose or treat medical conditions and may "
        "refer me to a doctor or dermatologist.",
    ]),
], "I've read and understood this form, my questions have been answered, and I consent to facial treatments at "
   "this studio today and at future visits. I can ask to stop a treatment at any time.",
   "Studio notes · skin analysis, products used, how the skin responded")

PEEL = consent("Chemical Peel Consent", "Chemical Peel _Consent_", READ, [
    NAME_ROW,
    ("fields", [("Peel (esthetician fills in)", 2.3, "peel"), ("Strength / layers", 1.3, "strength")]),
], [
    ("Before your peel", [
        "I've told my esthetician about any " + RETINOIDS + ", exfoliating acids, scrubs, waxing or sun exposure "
        "on the area in the past 7 days.",
        "I'm not pregnant or breastfeeding, and I haven't taken isotretinoin (Accutane) in the past 12 months.",
        "I don't have cold sores, open wounds, or irritated, sunburned or broken skin on the area. If I'm prone to "
        "cold sores, I've said so.",
    ]),
    ("What to expect", [
        "The peel may feel warm, tingly or itchy. Afterward my skin may look red, tight or shiny. Flaking often "
        "starts around day 2 or 3 and finishes within a week, or I may not peel visibly at all.",
        "Possible reactions include lasting redness, swelling, breakouts, crusting and, rarely, darkening or "
        "lightening of the skin, blistering or scarring. Sun exposure raises the risk of dark marks.",
        "I won't pick, peel or scrub flaking skin. I'll avoid heat and heavy sweating for 48 hours and pause "
        "retinoids and exfoliants for 7 days, or as advised.",
        "I'll wear broad-spectrum SPF 30 or higher every day and avoid direct sun and tanning for at least 2 weeks.",
    ]),
    ("Patch test", [("checks", "", ["Patch test done on ___", "Offered, and I declined"], "patch", 2)]),
], "I've read and understood this form, my questions have been answered, and I consent to a chemical peel today. "
   "I can ask to stop the treatment at any time.",
   "Studio notes · prep, peel and layers, time on skin, how the skin responded")

DERMA = consent("Dermaplaning Consent", "Dermaplaning _Consent_", READ, [NAME_ROW], [
    ("About dermaplaning", [
        "Dermaplaning uses a sterile, single-use blade to gently remove dead skin cells and fine vellus hair "
        "(peach fuzz) from the face.",
        "Hair that's removed grows back at the same rate, color and texture. It doesn't grow back thicker or darker.",
        "I don't have active acne, raised lesions, open wounds, a sunburn or cold sores on the area.",
        "I've told my esthetician about any " + RETINOIDS + " in the past 7 days, and I haven't taken "
        "isotretinoin (Accutane) in the past 12 months.",
    ]),
    ("What to expect", [
        "Possible reactions include temporary redness, sensitivity, small nicks, breakouts and irritation.",
        "For 48 hours I'll avoid exfoliants, retinoids, heat, heavy sweating and direct sun, and I'll wear SPF 30 "
        "or higher every day.",
        "Results vary, and no specific result has been promised to me.",
    ]),
], "I've read and understood this form, my questions have been answered, and I consent to dermaplaning today and "
   "at future visits. I can ask to stop the treatment at any time.",
   "Studio notes · areas, blade changes, products used, how the skin responded")

WAX = consent("Waxing Consent", "Waxing _Consent_", READ, [
    NAME_ROW,
    ("checks", "Area", ["Brows", "Lip", "Chin", "Full face", "Underarm", "Arms", "Legs", "Bikini",
                        "Brazilian", "Back", "Chest", "Other ___"], "area", 4),
], [
    ("Before your wax", [
        "I'm not using " + RETINOIDS + " on the area and haven't in the past 7 days, and I haven't taken "
        "isotretinoin (Accutane) in the past 12 months. I understand these can make skin lift or tear.",
        "I've told my esthetician about any acids, benzoyl peroxide, peels, laser, sunburn or tanning on the area "
        "in the past week, and any medication that thins the skin or blood.",
    ]),
    ("What to expect", [
        "Waxing can cause temporary redness, bumps and sensitivity and, less often, ingrown hairs, bruising, "
        "lifting of the skin, burns or darkening of the skin.",
        "For 24 to 48 hours I'll avoid heat (hot tubs, saunas, hot showers), tanning, pools, tight clothing on "
        "the area and fragranced products, and I'll wait 48 hours before exfoliating.",
        "My esthetician may decline or stop a service at any time for safety or hygiene reasons.",
    ]),
], "I've read and understood this form, my questions have been answered, and I consent to waxing today and at "
   "future visits. I can ask to stop the service at any time.",
   "Studio notes · wax used, areas, how the skin responded")

PHOTO = {"name": "Photo Release", "blocks": [
    ("title", "Photo _Release_", "Before-and-after photos help me track your progress. You decide how they're "
     "used, and you can change your mind at any time by telling me in writing."),
    NAME_ROW,
    ("h", "Please choose one"),
    ("checks", "", [
        "Photos for my private client record only. Never shared.",
        "Photos may be shared on the studio's website and social media **without** my face or identifying features.",
        "Photos may be shared on the studio's website and social media, **including** my face.",
        "No photos, thank you.",
    ], "photo", 1),
    ("fields", [("If shared, tag me (optional)", 2, "tag"), ("", 1, "")]),
    ("h", "Good to know"),
    ("initial", "I won't be paid for photos. Images posted online can be copied by others. If I withdraw "
                "permission, the studio will remove its posts and stop future use, but can't recall copies "
                "already shared.", "photo_ack"),
    ("initial", "Photos are taken on a studio device, stored securely and never edited to change my results.",
     "photo_edit"),
    ("sign", [("Client signature", 3, "signature"), ("Date", 1.2, "sign_date")]),
]}

POLICY = {"name": "Studio Policies", "blocks": [
    ("title", "Studio _Policies_", "The small print that keeps appointments on time and fair for everyone."),
    ("h", "Booking and deposits"),
    ("p", "A $25 deposit holds your appointment and goes toward your service. Deposits are kept for late "
          "cancellations and no-shows."),
    ("h", "Cancelling or rescheduling"),
    ("p", "Please give at least 24 hours' notice. Cancellations with less notice are charged 50% of the service; "
          "no-shows are charged in full. Emergencies happen, so just talk to me."),
    ("h", "Running late"),
    ("p", "Your treatment will be shortened so the next guest starts on time, at the full price. Arriving more than "
          "15 minutes late may count as a no-show."),
    ("h", "Your health and safety"),
    ("p", "Please tell me about any change in your health, medications or skin before each visit. I may adjust, "
          "postpone or decline a treatment if it isn't safe for your skin that day."),
    ("h", "Children and guests"),
    ("p", "To keep the treatment room calm and private, please don't bring children or guests unless we've "
          "arranged it ahead of time."),
    ("h", "Products and refunds"),
    ("p", "Unopened products can be returned within 14 days. Opened products can be exchanged within 7 days if they "
          "don't agree with your skin. Services can't be refunded, but if you're unhappy, tell me within 72 hours "
          "and I'll make it right."),
    ("h", "Your privacy"),
    ("p", "Your forms, notes and photos are kept private and used only to care for your skin. I never sell or share "
          "your information."),
    ("h", "Reminders"),
    ("p", "You'll get a reminder by text or email two days before your visit. Reply to confirm, or to let me know "
          "if plans change."),
    ("h", "Your acknowledgement"),
    ("p", "I've read and agree to these policies."),
    ("sign", [("Client signature", 3, "signature"), ("Date", 1.2, "sign_date")]),
]}

DOC = {"title": NAME, "header": "studio", "foot": "Client intake & consent",
       "pages": [INTAKE, HEALTH, FACIAL, PEEL, DERMA, WAX, PHOTO, POLICY]}

START = {
    "inside": [
        ("Fillable PDF", "All eight forms. Clients can fill them in on an iPad or phone, or you can print them. "
                         "US Letter and A4 are both included."),
        ("Word file", "The same forms, fully editable: add your logo, change the wording, delete what you don't offer."),
        ("The forms", "Client Intake · Health History · Facial Consent · Chemical Peel Consent · Dermaplaning "
                      "Consent · Waxing Consent · Photo Release · Studio Policies"),
    ],
    "tips": [
        "Open the Word file and put your studio's name (or logo) at the top of each page.",
        "Read every form and match it to your services, your state's rules and your own policies. Delete anything "
        "you don't offer.",
        "Change the policy numbers (deposit, notice, fees) to your own.",
        "Save it as a PDF for clients, or keep using the fillable PDF as it is.",
    ],
    "legal": True,
}


def build(c):
    c.pdf(DOC, "Intake & Consent Kit - Fillable - US Letter.pdf", "letter", fillable=True)
    c.pdf(DOC, "Intake & Consent Kit - Fillable - A4.pdf", "a4", fillable=True)
    c.docx(DOC, "Intake & Consent Kit - Editable Word.docx")
    c.start_here()
