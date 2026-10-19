# Evelyn's Skin Playbook: the questions

The questionnaire Evelyn fills in over several sittings. Her answers become the knowledge the website's assistant answers from (see knowledge/README.md). Generated from knowledge/scripts/playbook-spec.mjs; edit that file, not this one.

Nothing is pre-filled. Every tap option is one of her own product or treatment names, never a claim.

## Skin concerns

One at a time. Skip any you don't see much; come back whenever you like.

For each of: Breakouts and acne; Purging vs. a breakout; Dark spots and post-acne marks; Redness and sensitivity; Dryness and dehydration; Oily skin and large pores; Fine lines and firmness; Texture; Under-eyes; Back and body breakouts; Ingrown hairs after waxing.

- **What do you ask a client first?** The questions that tell you what's really going on.
- **Morning: what do you recommend from your shelf?** Tap products, then add how to use them. Tap products from her shelf (every live product in js/catalog.js, grouped by type), then how to use them. Plus a box: "In your words".
- **Night: what do you recommend from your shelf?** Tap products from her shelf (every live product in js/catalog.js, grouped by type), then how to use them. Plus a box: "In your words".
- **What should they avoid?** Products, habits, ingredients, mixing.
- **How long until they see results?** Pick one: About 2 weeks · 4 to 6 weeks · 2 to 3 months · 3 to 6 months · It varies a lot. Plus a box: "What to expect along the way".
- **When should they book a facial, and which one?** Tap from her menu: New Clients Start Here · Lumevina Custom Facial · Custom Facial + Dermaplaning · Ageless Grace Facial · ProCell Microchanneling · Refresh Peel · Corrective Peel · Acne Bootcamp (New Client Consultation + Treatment) · Monthly Acne Treatment · Bi-Weekly Acne Treatment · In-Person Consultation · Virtual Consultation. Plus a box: "When, and how often".
- **When must this come to you, or to a doctor?** The signs that mean the assistant should stop and hand it to you.

## Aftercare

What you tell clients after each treatment.

For each of: Facials; ProCell Microchanneling; Refresh Peel (no downtime); Corrective Peel (medium depth); Dermaplaning; Waxing (brows, lip, underarms and body); Brazilian, bikini and the mini vajacial.

- **The first 24 hours** What to do and not do right after.
- **The first week**
- **What's normal** Redness, flaking, bumps, tenderness: what you tell clients not to worry about.
- **What isn't normal** The signs that mean they should message you, or see a doctor.

## Your products, in order

How a routine fits together, and how clients start the stronger products.

- **The order of steps, morning and night** Cleanser, toner, serum, treatment, moisturizer, SPF: in your words, with anything that changes it.
- **Starting the mandelic serums** Which strength first (5%, 8%, 11%, 15%), how often, and when to move up.
- **Starting the Advanced Acne Med** 2.5% vs. 5%, how much, how often, and how to build up.
- **Retinal B3 Serum vs. Retinol Peptide Serum** Who gets which, and how to start.
- **What not to mix, or not on the same night**
- **Anything you always say about sunscreen**

## Product by product

Optional. A line or two per product, in your words. Label facts are already on the site.

For each of the 43 live products on her shelf, optional:

- **Who is it for?** The skin and concern you reach for it with.
- **How to use it** Amount, when, how often, how to start.
- **Your tip** What you tell clients at the counter.

## Hard lines

What the assistant must never answer for you.

- **The assistant must never answer these. It always hands them to you.** Tap all that apply: Pregnancy or breastfeeding · Accutane, past or present · Prescription retinoids or antibiotics · Any other prescription · A reaction, rash, burning or swelling · Eczema, rosacea, psoriasis or another condition · Cold sores · Clients under 18 · Anything about results or guarantees · Discounts or price exceptions. Plus a box: "Anything else that should always come to you".
- **What should it say while handing a question to you?** One or two sentences, in your words. For example, that you'll answer personally and when.
- **Anything it should never say or promise?** Words, claims, comparisons, brands.

## Your voice

So it sounds like you, not a robot.

- **Real replies you've sent clients** Paste 5 to 10, with names removed. These teach the assistant how you talk. 10 boxes.
- **Words and phrases you use a lot**
- **Words you never use**
- **How do you sign off?** Pick one: — Evelyn · xo, Evelyn · Evelyn · No sign-off. Plus a box: "Or something else".
- **Emoji?** Pick one: Never · Sometimes, one at most · Often. Plus a box: "In your words".
- **How do you open a reply?** Pick one: Hi [name]! · Hey [name], · Hello [name], · Straight to the answer. Plus a box: "Or something else".

## Where the answers go

Each section saves to its own document (`playbook/<section>`) in the questionnaire's database as she types. `knowledge/scripts/import-playbook.mjs` turns an export of those documents into the knowledge files, one per concern, treatment and product, with the date. `build-bundle.mjs` then packs them, with the FAQ, policies and catalog, into what the server's assistant reads.
