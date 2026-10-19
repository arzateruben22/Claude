# Evelyn's Skin Playbook: the questions

The questionnaire Evelyn fills in over several sittings. Her answers become the knowledge the website's assistant answers from (see knowledge/README.md). Generated from knowledge/scripts/playbook-spec.mjs; edit that file, not this one.

Nothing is pre-filled. Every tap option is one of her own product or treatment names, never a claim.

Every card also has **Add screenshots** (old texts, aftercare cards, product guides, Instagram posts; images or PDFs) and **Add a recording** (voice memos). `read-screenshots.mjs` transcribes the screenshots so the assistant can learn from them.

## Questions clients ask

The exact texts you get, answered once, in your words. Every one you answer is one the assistant can handle for you. Screenshots of your old replies work too.

### Before a visit

- "Do I need to stop my products before my facial? Which ones, and for how long?"
- "Can I still come in if I'm on my period?"
- "I'm breaking out right now. Should I still come in?"
- "How long does my hair need to be for a wax?"
- "Should I shave or trim before my wax?"
- "I'm going on vacation / I just got some sun. Can I still get my treatment?"
- "It's my first Brazilian. Any tips?"

### Right after a visit

- "When can I wear makeup again?"
- "Can I work out, swim, sauna or do hot yoga after?"
- "When can I wash my face, and with what?"
- "I broke out after my facial. Is that normal?"
- "My skin is peeling after my peel. What do I do?"
- "When can I go back to my retinol or acids?"
- "I have little bumps after my wax. What should I do?"

### Routines and products

- "Can I keep using my own products with the ones you gave me?"
- "Do I need everything you recommended, or what should I start with?"
- "Which sunscreen should I use?"
- "I'm running out before my next visit. What should I do?"
- "How long does a bottle usually last?"
- "I skipped my routine for a few days. Do I start over?"
- "I'm traveling. What should I bring?"

### Results and how often

- "How many facials until I see a difference?"
- "How often should I get a facial?"
- "How long until my acne clears up?"
- "How often should I get waxed? How long does it last?"
- "Does waxing hurt less over time?"
- "What can I do between visits to keep my results?"

### Booking and the day itself

- "Can I switch to a different treatment when I get there?"
- "Can I add something on the day, like dermaplaning?"
- "Can I book with a friend, back to back?"
- "I don't know which facial to book. Which one is for me?"


## Skin concerns

One at a time. Skip any you don't see much; come back whenever you like.

For each of: Breakouts and acne; Purging vs. a breakout; Dark spots and post-acne marks; Redness and sensitivity; Dryness and dehydration; Oily skin and large pores; Fine lines and firmness; Texture; Under-eyes; Back and body breakouts; Ingrown hairs after waxing; Blackheads and congestion; Hormonal breakouts (jawline, around periods); Melasma and sun spots.

- **What do you ask a client first?** The questions that tell you what's really going on.
- **Morning: what do you recommend from your shelf?** Tap products, then add how to use them. Tap products from her shelf (every live product in js/catalog.js, grouped by type), then how to use them. Plus a box: "In your words".
- **Night: what do you recommend from your shelf?** Tap products from her shelf (every live product in js/catalog.js, grouped by type), then how to use them. Plus a box: "In your words".
- **What should they avoid?** Products, habits, ingredients, mixing.
- **How long until they see results?** Pick one: About 2 weeks · 4 to 6 weeks · 2 to 3 months · 3 to 6 months · It varies a lot. Plus a box: "What to expect along the way".
- **When should they book a facial, and which one?** Tap from her menu: New Clients Start Here · Lumevina Custom Facial · Custom Facial + Dermaplaning · Ageless Grace Facial · ProCell Microchanneling · Refresh Peel · Corrective Peel · Acne Bootcamp (New Client Consultation + Treatment) · Monthly Acne Treatment · Bi-Weekly Acne Treatment · In-Person Consultation · Virtual Consultation. Plus a box: "When, and how often".
- **The most common mistakes clients make with this** Over-exfoliating, picking, switching products too fast: whatever you see most.
- **Habits and everyday tips you give** Pillowcases, phone screens, hair products, makeup, diet, sleep, workouts: only what you actually tell clients.
- **When must this come to you, or to a doctor?** The signs that mean the assistant should stop and hand it to you.

## Treatments, explained

What clients ask before they book: how it feels, how they'll look after, how often to come back.

For each of: New Clients Start Here; Lumevina Custom Facial; Ageless Grace Facial; ProCell Microchanneling; Refresh Peel; Corrective Peel; Dermaplaning (as an add-on); Acne Bootcamp (consultation, monthly and bi-weekly); In-Person and Virtual Consultations; Brazilian, bikini and the mini vajacial; Body and face waxing.

- **What happens, step by step** As you'd walk a nervous first-timer through it.
- **Does it hurt? How does it feel?**
- **How they'll look after, and for how long** Pink for an hour, flaking on day 3, nothing at all: what to plan around.
- **How often should they book it?** Pick one: Every 2 weeks · Every 3 to 4 weeks · Every 4 to 6 weeks · Every 6 to 8 weeks · A series, then maintenance · Once, or as needed. Plus a box: "Anything that changes it".
- **When will they see results, and how long do they last?**
- **Who it's best for, and who should book something else** So the assistant can point people to the right treatment.
- **Who has to wait, or can't have it** Your own rules: recent procedures, products to stop, conditions you won't treat. The assistant still hands medical questions to you.
- **Anything to do before this one, beyond your general list**
- **Good add-ons or pairings** Tap from her menu: New Clients Start Here · Lumevina Custom Facial · Custom Facial + Dermaplaning · Ageless Grace Facial · ProCell Microchanneling · Refresh Peel · Corrective Peel · Acne Bootcamp (New Client Consultation + Treatment) · Monthly Acne Treatment · Bi-Weekly Acne Treatment · In-Person Consultation · Virtual Consultation. Plus a box: "When you'd suggest them".

## Aftercare

What you tell clients after each treatment.

For each of: Facials; ProCell Microchanneling; Refresh Peel (no downtime); Corrective Peel (medium depth); Dermaplaning; Waxing (brows, lip, underarms and body); Brazilian, bikini and the mini vajacial.

- **The first 24 hours** What to do and not do right after.
- **The first week**
- **What's normal** Redness, flaking, bumps, tenderness: what you tell clients not to worry about.
- **What isn't normal** The signs that mean they should message you, or see a doctor.

## Visits and the studio

The practical questions before someone walks in.

- **What should they wear or bring?**
- **Can they arrive wearing makeup?** Pick one: Yes, I'll remove it · Please come bare-faced · Light makeup is fine. Plus a box: "Anything else".
- **Can they bring a friend, partner or child?**
- **What happens at a first visit, from the moment they arrive?**
- **Do you see clients under 18?** Pick one: Yes, with a parent there · Yes, with signed consent · 16 and up only · No. Plus a box: "What they need".
- **Anything different for men?**
- **Ways to pay beyond cash and card** Zelle, Venmo, HSA/FSA cards, payment plans: only what you take.
- **Product returns and exchanges** Opened, unopened, a reaction, a wrong order.
- **How fast you usually reply, and the best way to reach you**
- **Anything else clients always ask before a visit**

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
- **Pairs well with, and what not to use it with**
- **How long it usually lasts**

## Your materials

Anything you already have written: aftercare cards, product guides, your GlossGenius descriptions, Instagram FAQ highlights, texts you send a lot. Add screenshots and the assistant learns from them.

Screenshots first, as many as she likes. Then:

- **What are these, and when do you use them?** For example: my aftercare card for peels, the product guide I text new acne clients, my Instagram FAQ highlight.

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

Each section saves to its own document (`playbook/<section>`) in the questionnaire's database as she types; screenshots and voice memos are stored with the questionnaire and listed in those documents. `knowledge/scripts/read-screenshots.mjs` downloads and transcribes the screenshots, `knowledge/scripts/import-playbook.mjs` turns an export of the documents into the knowledge files, one per concern, treatment and product, with the date and what her screenshots say. `build-bundle.mjs` then packs them, with the FAQ, policies and catalog, into what the server's assistant reads.
