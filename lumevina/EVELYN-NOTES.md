# Notes from Evelyn: website v2

Started Monday, October 19, 2026. Her words come first, then what it means for the site.

## What she's asked for so far (relayed by Ruben)

- **Keep it simple.** The site should be much more seamless.
- **Keep:** the order page (services and shop), the page about her, and a full FAQ / policies page.
- **Hold back for now:** the Glow page and the Glow section. These stay hidden, not deleted, so they can come back.
- **Journal:** remove it and turn it into a "reach out" section for any questions.
- **Booking:** full calendar availability. It should be very easy for new clients and easy for Evelyn to keep track of her availability.
- **GlossGenius:** she wants a link to her GlossGenius page. Ruben thinks booking could work directly on the site instead.

## What Evelyn says

### Checkout at the visit (her side)

- How she wants checkout to feel: **seamless**. Her flow is:
  1. Open the client's **profile**.
  2. The appointment shows the **service and a price breakdown**.
  3. She can **add products** to it and **save** it.
  4. She **charges right there**: tap to pay, or whatever method the client uses.
- Ruben's summary back to her: seamless for the customer, and **even more focus on making it seamless for Evelyn** on the handling side.

**What it means for the site:** the dashboard needs one "check out this visit" screen. It opens from the client or today's appointment. It shows the service, the deposit already paid and the balance. Products can be added from her shelf. One button charges: cash, card or tap to pay, Zelle. Today the dashboard splits this across "Settle visits", "Inventory" and "Clients".

### Her biggest concern

- **As little trial and error as possible** on her end. That covers the new website, the booking system and the analytics page.

**What it means for the site:**
- The dashboard opens on **Today**: who's coming, and one button to check each visit out.
- Each job she does often gets its own clearly named tab: Today, Calendar, Clients, Orders to ship, Money. Analytics ("Insights") goes last.
- Every button says exactly what it does. Nothing is hidden behind a gesture or a long scroll.
- A changed setting saves on its own, says "Saved", and can be undone.
- The website and the dashboard use the same words: a "day off" on her side is a closed day on the client's calendar.

### Product guide and shop-first (Ruben, Oct 19)

- Use **Evelyn's product guide** (43 entries from her GlossGenius inventory: Face Reality 30, GlyMed Plus 9, Mixi Skincare 3, Circadia 1).
- **Products become the face of the website.** Booking is the second theme.
- She's fine with booking on the website **but doesn't want to fully leave GlossGenius**. Can both calendars work together?

**What it means for the site:**
- The shop leads the homepage; Book a facial is the second section.
- The 10 entries the guide flags (cut-off names, unclear sizes) stay as drafts, hidden from clients, until Evelyn confirms them.
- Out-of-stock products say "Request it" so clients can still ask for them.
- Both calendars: see "Running both calendars" in the handoff.

**Still to confirm from the guide:** the $6.00 shipping fee in her inventory (the site charges $8, free over $75), the $83.20 Barrier Repair Cream price, whether older sunscreens are still sold, which products need a consultation first, and where stock is managed: the website, GlossGenius, or both.

## Quick questionnaire (about 5 minutes)

1. What worries you most about moving to a new website and booking system?
2. What takes up the most time in your week right now: booking, reminders, answering DMs, checkout, shipping, or something else?
3. What do clients ask you most often?
4. Should clients book on the new site, or stay on GlossGenius for now? What would you hate to lose from GlossGenius?
5. Are your hours the same every week, or do they change week to week? How far ahead can clients book?
6. What do you need from a new client before their visit: intake form, photos, deposit, anything else?
7. At checkout, how do clients usually pay: cash, card, tap to pay, Zelle? What do you want to see on that screen?
8. Will you mostly use the dashboard on your phone, an iPad, or a laptop?
9. What should you hear about right away: new bookings, cancellations, questions, orders to ship? By text or email?
10. If the site did only three things perfectly, which three would they be?
11. Is there anything on the current site you want gone or changed?

**Evelyn's answers (Oct 19, sent by Ruben):**

1. **Worries:** learning something new, clients getting confused, payments going wrong, how long setup takes. *"Checkout being easy for me. When I check out clients on GlossGenius I am able to add products and services and give them a total upfront. They can also pay with tap or card on file, all on my app."*
2. **Most time:** answering DMs, shipping orders. *"Answering clients' individual questions about skin concerns and products."*
3. **Clients ask most:** aftercare, skin concerns, product concerns.
4. **Booking:** stay on GlossGenius for now. *Would hate to lose:* "The convenience, and I just switched to GlossGenius."
5. **Hours:** the same every week. Clients can book **1 month** ahead.
6. **Before a first visit:** intake form, deposit, signed consent, their current products. *"I would like there to be an option to add photos of their skin."*
7. **How clients pay:** card, tap to pay, Zelle, Klarna or Afterpay. (Cash wasn't picked.)
8. **Dashboard:** on her **phone**.
9. **Tell her right away:** new bookings, cancellations, orders to ship, low stock, client questions. By **text and email**.
10. **Three things to get perfect:** (1) checkout being convenient and seamless, (2) a seamless online shop for clients, (3) automated responses for recurring questions.
11. **Change:** the colors and aesthetic. Keep it easy for clients and for her to navigate.

**What her answers mean for the site:**
- **Booking stays on GlossGenius.** Every Book button opens her GlossGenius page; the website's own calendar stays built but switched off (js/site-config.js). Needed: her GlossGenius booking link.
- **Visit checkout stays on GlossGenius** too: it already does what she wants (products and services, a total upfront, tap or card on file). The dashboard doesn't need its own checkout screen for now.
- **The website's job is the shop:** a seamless online shop and checkout for clients, and shipping that takes as little of her time as possible.
- **Automated answers:** the "Ask Lumevina" chat should answer aftercare and product questions on its own, from her catalog, and pass real skin concerns to her.
- **Colors and aesthetic:** to change. Her product guide suggests warm beige, white and classic black.
- **Dashboard:** built for her phone first. Alerts by text and email (needs the server).
- **Skin photos:** an option for new clients to add photos. GlossGenius holds her intake forms, so check whether its forms can take photos first.
- **Confirm:** the policies say "cash is preferred", but she didn't pick cash.

## Open questions for her

- Her GlossGenius booking link, if Book buttons should go there.
- If booking moves onto the site, GlossGenius booking would need to be turned off so nobody double-books.

## Done after her answers (Oct 19)

- **Booking goes to GlossGenius:** every Book button on the site is a link to https://lumevina.glossgenius.com/ (js/site-config.js). The website's own calendar stays built and switched off.
- **The look:** warm beige, white and classic black, from her product guide. Black buttons, white cards, a warm beige page.
- **The shop is in sections, like a routine:** cleansers, toners and mists, serums, acne and spot care, moisturizers, eye care, sun care, supplements, and more from the shelf. Type buttons jump to each section; on phones each section swipes sideways.
- **Product photos:** tapping a product opens it large, with its size, what the label says, price, stock and Add to cart. Photos also show in the cart and at checkout.
- **Names from the labels:** photographed products use the name printed on the product ("Brilliant Defense SPF 50", "11% L-Mandelic Serum"); her inventory title is kept beside it.
- **Two guide flags answered by the label photos:** Clear Skin Balance (60 softgels, a dietary supplement) and GlowTone Corrective Serum (1 fl oz / 30 ml) are now live. Eight flagged drafts remain.

### Photos

On the site now (files received): 5%, 11% and 15% L-Mandelic Serum; 2.5% and 5% Advanced Acne Med; Mineral Matte SPF 28; Moisture Balance Toner (6 fl oz and 2 fl oz); Omni Clear Mist; PowerMineral SPF 50; all nine GlyMed Plus products (Barrier Repair Cream, Cell Protection Balm, Eye Calm, Firming Eye Cream, Firming Serum with Phyto-Stem Cells, Glycolic Facial Cleanser, Revitalizing Essence with NAD+, Skin Recovery Mist, Vitamin C Cleanser); Circadia Vitamin Veil Cleansing Oil; plus the older Daily SPF 30 Plus shot.

Done Oct 19: every product has its photo (all 43). Sent again in batches of five and matched by the name on the label. Dew Drop's photo is small (280 px); a bigger one is welcome. For the record, the ones that had to be re-sent: 8% L-Mandelic Serum, Antioxidant Peptide Eye Gel, Barrier Balance Creamy Cleanser, Barrier Care Gel Cream, Brilliant Defense SPF 50, Clear Skin Balance, Cran-Peptide Cream, Daily SPF 30 Plus (new shot), Ultra Gentle Gel Cleanser, GlowTone Corrective Serum, HydraBalance Gel, HydraRemedy Gel Serum, HydraCalm Mask, invisiClear Spot Patches, L-Mandelic Face and Body Wash, Retinal B3 Serum, Retinol Peptide Serum, Soothing Radiance Toner, Sulfur Spot Treatment, Ultra Gentle Gel Cleanser (6 fl oz and 2 fl oz), and the three Mixi Skincare products (Mineral SPF 50, Hydroxi, Dew Drop).

**Guide flags answered by label photos:** [1] Clear Skin Balance, [3] GlowTone Corrective Serum, [4] HydraCalm Mask, [5] invisiClear patches (24), [6] L-Mandelic Face and Body Wash, [7] the $14 Moisture Balance Toner is the 2 fl oz bottle, [8] Retinal B3 Serum (Face Reality, 1 fl oz), and [2]: the $14 entry is the Ultra Gentle Gel Cleanser travel size, 2 fl oz (confirmed by Evelyn). [9] GlyMed Firming Serum with Phyto-Stem Cells, 1 oz / 30 ml. [10] Mixi Skincare Mineral SPF 50, 2 fl oz, no tint named on the tube. Every flagged product is now live.

**Same product, two sizes:** Moisture Balance Toner (6 fl oz $34, 2 fl oz $14) and Ultra Gentle Gel Cleanser (6 fl oz $33, 2 fl oz travel size $14). Each size stays its own listing with its own stock. No other photos repeat, apart from Daily SPF 30 Plus, which already had an older photo.

**To confirm:** the invisiClear $10 price (partly clipped) and the Retinal B3 Serum quantity.

## Round two questionnaire (Oct 19)

Sent at the same link: https://claude.ai/artifact/YChu6itk5K1NpWfrQdF5Ak. 21 questions in four parts: quick confirmations (invisiClear price, Retinal B3 count, the two remaining drafts, the "cash preferred" line, products that need a consult first), shipping and pickup (fee, where, how fast, pickup, returns), her shop (where stock lives, who writes product copy, photos, the site's voice, why buy from her), and ideas to try (routine bundles, refill reminders, a skin quiz, automatic answers, extras in orders, her About story).

**Round two answers:** _(add when they arrive)_

## Hours, after-hours and booking in both places (Oct 19, later)

- **Her hours (from Evelyn):** Tuesday 12–7, Wednesday 11–7, Thursday 11–7, Friday 10–5, Saturday 9:30–6, closed Sunday and Monday. Now the site's default week (js/hours.js); the calendar, the FAQ and the assistant read it. No lunch break is set; add one in the dashboard if she takes one.
- **After-hours facials:** outside her hours, or on a closed day, for the $32 After-Hours Add-On already on her menu. The site doesn't book those on its own: the Book section and the FAQ send the client to the Contact form with the request pre-written, and she confirms.
- **Booking in both places for now (Ruben):** new clients book on the website's calendar. Clients who already book with her on GlossGenius can still use it, with a note under the Book heading that all booking is moving here. Set in js/site-config.js (booking.mode "both").
- **The opening logo animation was removed (Oct 19)** at Ruben's request: the site opens straight to the homepage, and the hero plays its entrance right away.

## The Skin Playbook (Oct 19)

- The questionnaire the assistant learns from: https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ. Six sections, 120 questions plus optional notes per product. It saves each section as she types, so she can leave and come back; for the saving to reach us, invite her email from the page's Share menu with Contributor access or higher and no public link. "Copy all my answers" is the backup.
- **Speaking her answers:** the mic key on her phone keyboard dictates into any box. The page can't open the microphone itself inside the preview viewer.
- **Voice memos:** each item has "Add a recording" for a voice memo from her phone's recorder (.m4a works). They stay with her answers for a later voice assistant in her own voice. That needs her consent, a voice provider, and the real website, where the microphone works.

## Her current menu (Oct 19, from her GlossGenius page)

Only what's on GlossGenius is offered now. The full list, with her descriptions, prices, times, deposits and the "2 options", is in `GLOSSGENIUS-SERVICES.md`; the site reads it from `js/services.js`.

- **New:** ProCell Microchanneling (from $350); the ProCell package, 4 for $1,100 (regularly $1,400), first 10 clients, payment plans; Refresh Peel and Corrective Peel ($230, or $270 with dermaplaning); dermaplaning options on New Clients Start Here ($260+), the Custom Facial ($230+) and Ageless Grace ($280); Brows + underarms ($45).
- **Gone (hidden, not deleted):** Couples Facial, Back Facials, BioRePeel, First Time Brazilian, Extended Bikini, leg waxing, nose, sideburn, hairline and full-face waxing.
- **Renamed:** the Acne Program is the Acne Bootcamp.
- **Deposits are hers, per service** (Ruben, Oct 19): $50 acne consultation, $49 consultations, $30 Brazilian / Wax Wednesday / Bikini / Mini Vajacial / Full Arm / Full Back / acne treatments, $20 Half Arm / Half Back / Full Butt; facials, peels and ProCell have none.
- **After-hours visits: an extra $50** (was $32). Booked by message.
- **Virtual Consultation:** $50, Mondays only, message first.
- **Glow Membership repriced** (still held back; raised again in v3, below): Glow **$175** (Custom Facial or Monthly Acne, a $200 value), Ageless **$225** (Ageless Grace, a $240 value, plus dermaplaning every other visit, about $260 a month in all). Ruben, Oct 19: "increase membership prices" — the perks (shelf discount, free shipping, add-on discount) carry the rest of the value. Dermaplaning is no longer covered by Glow, since it's now a $30–$40 option.

**Still to confirm:** ProCell Microchanneling's two options; whether facials, peels and ProCell should take a deposit online; a ProCell photo. Calendar stays in 30-minute steps (Ruben, Oct 19).

## Booking on the website: on hold (Oct 19)

Evelyn wants to get used to the website before clients book on it. Every Book button opens her GlossGenius page, and the Book section says "Coming soon: booking right here on the website." The website's own calendar, deposits and calendar sync are built and waiting. When she's ready: `js/site-config.js` → `booking.mode: "both"` (both places), later `"site"`.

## Cleaning time between clients (Oct 19)

Evelyn needs 30 minutes after every appointment to clean and sanitize. The website's booking (when it's switched on) never starts an appointment within 30 minutes of another one ending, on either side; several treatments booked together count as one visit, with the 30 minutes after the whole visit. The database enforces the same gap, and the server's check against her Google Calendar includes it. **While booking runs on GlossGenius:** set a 30-minute buffer after each service in GlossGenius (its service settings have a buffer or "processing time" option; the exact name may differ in her app).

## Her logo on the homepage (Oct 19)

Her full logo (the circle, profile and roses, with LUMEVINA and AESTHETICS SPA) is sharp vector art: `img/logo-full.svg` on the homepage, centred above the headline and tinted in the earthy palette through a mask. The art is traced from her logo; the words are Cormorant Garamond turned into shapes, so nothing depends on a font loading, and her outlined EV has a soft fill so the whole word reads on a phone. The homepage logo fades in with the headline and drifts up gently as you scroll. If Evelyn has the original logo file (PDF, AI or SVG) from her designer, swap it in for an exact match.

## Pinch-zoom no longer jolts the page (Oct 19)

Pinch-zooming on a phone fires resize events, and the scroll animations used to re-measure on every one, so the page jumped as if it had reloaded. They now re-measure only when the page's real width changes (rotating the phone or resizing a window). The page also keeps a pull at the top from spilling into the browser's or the Claude app's pull-to-refresh, which reloads the whole page.

## FAQ & Policies, condensed (Oct 19)

The questions and the policies are now one short list of 8 (one open at a time, two columns on wide screens): New here, Hours, Deposits & payment, Cancelling & rescheduling, Late arrivals & refunds, Before & after your facial, Location & parking, and Products, virtual visits & gift cards. Duplicates were merged and every policy term kept (48 hours, the $43 same-day fee, 50% for no-shows, Saturdays can't be moved, the 10-minute grace period, the 24-hour window). The desktop card shelf and the phone tiles are gone. **Lash fills are removed**: Evelyn doesn't offer them. Ask Lumevina reads the same list (`node knowledge/scripts/build-bundle.mjs` after any edit).

## Her coffee-neutral palette (Oct 19)

Linen #F5F1EA (the page), Khaki #D7C9B8, Camel #B2967D (tints), Cocoa #7D5A44 ("chosen by Evelyn." and every headline accent, quiet notes), Espresso #4A342A (secondary text), with black kept for headings, buttons and outline buttons. Tokens at the top of `css/styles.css`.

## Menu button (Oct 19)

The two-line menu now opens the moment a finger lifts, not only on the click that follows: some in-app viewers can lose that click.

## Gifts (Oct 19)

One **E-Gift Certificate** card under the featured services: her vector logo in Khaki on black, and a choice of **$50, $100, $200, $400 or a custom amount** ($25 to $1,000, whole dollars), then "Add $X gift to cart". It's a dollar-value certificate toward any treatment, emailed with its own code, never expiring. (The per-treatment gift list and the fixed $110 certificate were removed to save space.) Generated by `node scripts/build-services.mjs`; the amount picker lives in `js/cart.js`. On wide screens the featured services now sit as one wide signature card (photo beside its words) over a row of three. The acne New Client Consultation + Treatment is $220 everywhere (the FAQ said $225).

## Cart and checkout on phones (Oct 19)

On phones the cart and checkout now rise from the bottom as sheets, with the page dimmed above them: tap the page, the ×, or **Keep shopping** to close. Before, the cart filled the whole screen and its × sat in the top-right corner, right under the Claude app's own ⋯ button, so there was no way out inside the app.

## The CanvasRebel photo in Meet Evelyn (Oct 19)

The Meet Evelyn box opens with Evelyn's photo from the CanvasRebel interview (`img/press/canvasrebel-evelyn.webp`, 1200 px wide, framed on her face with the logo in the photo whole), linked to the article with a "Featured in CanvasRebel" label.

## Gift certificates: balances that carry over (Oct 19)

A gift certificate is a dollar amount toward any treatment, used at the visit:
- **Worth more than the visit:** a $100 certificate on a $50 visit covers $50, and $50 stays on it for next time.
- **Worth less than the visit:** on a $120 visit it covers what's left on it, and the client pays only the difference.

**At the visit (bookings are on GlossGenius for now):** Evelyn opens her dashboard → Gift certificates → **Use a gift certificate**, types the code and the visit total, sees what it covers, what the client pays and what stays on it, and taps Use. Every use is recorded, and the table shows each certificate's balance and last use.

**Clients** can tap **Check a gift balance** under the certificate on the website. After buying, the confirmation explains how it works.

**Going live:** the balances live in the server's gift ledger (`gift_cards`, `gift_redemptions`, the `gift-cards` function), so a certificate bought on one phone works on Evelyn's dashboard and anywhere else. Set a `STUDIO_KEY` secret and type it once into the dashboard. Until then (the demo), certificates live in the browser they were bought in. Tested: the ledger in a real Postgres (the $50 and $120 cases, used-up and unknown codes refused) and the whole flow in the browser.

## The Skin Playbook, round two: client questions and screenshots (Oct 19)

The playbook now opens on **Questions clients ask**: 31 real texts clients send ("Do I need to stop my products before my facial?", "When can I wear makeup again?", "Should I shave before my wax?", "How often should I get a facial?"), in five cards: before a visit, right after, routines and products, results, booking. Each one she answers once is one the assistant can answer for her, in her words. New sections: **Treatments, explained** (11 cards: the steps, how it feels, how they'll look after, how often, results, who it's for, who has to wait, pairings), **Visits and the studio** (what to wear, makeup, guests, first visit, under-18s, payment, returns, how fast she replies) and **Your materials**. Skin concerns gained blackheads, hormonal breakouts and melasma, plus "common mistakes" and "everyday habits"; products gained "pairs with" and "how long it lasts". Nothing is pre-filled, and pregnancy, medications, reactions and conditions stay hand-offs to her.

**Screenshots:** every card has **Add screenshots** (several at once; images or PDFs; an iPhone photo is converted on her phone if needed). Old texts to clients, aftercare cards, product guides, Instagram posts: she doesn't have to retype anything. `knowledge/scripts/read-screenshots.mjs` transcribes them (her words exactly, clients' names and numbers left out), and the import puts them on the card she added them to. Same link as before; her saved answers are kept. Uploading needs Editor access on the link.

## Skin plans: the chat knows each client's routine (Oct 19)

In the dashboard, open any client under **Clients** → **Write a plan** (or **Write a skin plan** at the top, for a GlossGenius client who has never booked on the site: just their name and email). A plan is: skin type, what they're working on, their goal, where they are now, morning and night steps picked from her shelf (or typed), anything once or twice a week, what to avoid for now, the next step, a note to them, and dated visit notes. Nothing is pre-filled.

**The client** sees it under **My Lumevina → Your skin plan** once signed in with that email, with an **Ask about my routine** button. **Ask Lumevina** greets them knowing the plan and answers "what do I use at night?", "what's my routine?", "what should I avoid?", "what's next?" straight from it. Asking to change it ("can I add vitamin C?"), a reaction, pregnancy, medications or a condition still goes to Evelyn, and when the server is connected her drafted reply already knows their plan, pre-visit form, visits and what she told them before.

**Sign-in:** connected, "Send my sign-in link" emails a real one-tap link (Supabase Auth); the demo signs straight in. Tested: the plan from the dashboard to the account and the chat at phone and desktop sizes, and the live sign-in (link, session refresh, an expired link, sign-out) against a stand-in server.

## About Evelyn and service details (Oct 19)

**About Evelyn:** her CanvasRebel photo now sits above the swipe cards and is the one link to the interview ("Featured in CanvasRebel →"). The separate Press card, which linked to the same article and was mostly empty space, is gone; the cards are Meet Evelyn, Our approach and The room.

**Service details:** tap any service (a featured card, or a line in Explore Every Service) and its details open: her full description from GlossGenius, the time, the deposit (or "nothing due until your visit"), its options each with their own Book button, and Keep looking. On phones it rises from the bottom; on a computer it's a centered card. Book works exactly like the page's own Book buttons (her GlossGenius page for now).

## Talk it through: Claude interviews Evelyn (Oct 19)

The Skin Playbook now opens on **Talk it through**. Claude asks the playbook's questions one at a time (she can let it pick, starting with the questions clients text her, or choose a topic), asks a short follow-up when an answer is too vague for a client to act on ("for how many days?", "which cleanser?"), and saves her words, lightly cleaned, into the same answers as the other tabs. Each saved answer appears as a chip under Claude's message; tapping it opens that card so she can check or edit it. She can type, use the mic key on her keyboard, or the mic button where her browser allows; Claude's questions can be read aloud. **Skip this card**, **Change topic** and **Start the conversation over** (answers stay) are there too. Claude never suggests answers or gives advice. It runs on her own Claude account (Claude asks her to allow it the first time); the conversation is kept with the playbook. Same link as before.

Her saved answers so far (Skin concerns → breakouts) are untouched; a treatment she ticked under its old name ("Acne Program …") now shows under the current name ("Acne Bootcamp …").

## Texting assistant: drafts by texting herself (Oct 19)

From the ChatGPT idea (Anthropic's iMessage plugin for Claude Code), the safe version: Evelyn texts herself a client's question from her iPhone, and Claude on her Mac texts back a draft reply from her Skin Playbook, FAQ and shelf for her to copy and send. Only her own self-chat reaches it (clients are never added), SMS stays off, and the `texting/` folder blocks Claude from opening files, running commands or browsing. Personal and medical questions come back marked "this one's yours to answer". Setup: `texting/SETUP.md` (about 15 minutes on her Mac; needs a Claude Pro or Max plan). It reads `texting/knowledge.md`, rebuilt with the rest of the knowledge. Automatic drafts for client texts, approved by her before anything is sent, is a separate build, not started.

## The menu drops down (Oct 19)

On phones and tablets the two-line button now opens a dropdown card under the header instead of a full-screen page: the six sections, "New here? Start here", Book now, and Cart and My Lumevina. The page stays where it was behind a light shade; tapping outside, a link or Escape closes it. On a computer the links stay in the header as before.

## The menu button inside the Claude app (Oct 19)

In the Claude app on a phone, the app's own × and ⋯ float over the top strip of the site and take every tap there, so the two-line menu (and Cart) never got the tap. When the site is opened inside an app's frame on a phone, the header now sits just below that strip. On its own (a normal browser, or once it's on her domain) the header is unchanged.

## Products first: real checkout, one stock count, Lumevina Studio (Oct 20)

Booking stays on GlossGenius; the website starts with products. `GLOSSGENIUS-PARITY.md` lists everything GlossGenius does next to what the site has, and the order to close the gaps (products and her app now; client care next; booking-only features only if booking ever moves).

**Checkout (live once the server is connected):** the cart hands off to Stripe's own payment page: card, Apple Pay, Google Pay, and pay-over-time where she switches it on, with California sales tax by Stripe Tax. Shipping is $8, free over $75; pickup at a visit is free. Gift certificates go through the same checkout and are emailed to the recipient (or saved for a chosen date). After paying, the site says thank you and the receipt comes by email. Until then, the demo checkout works as before.

**One stock count:** the website and the dashboard read the same shelf. An online order takes stock off by itself; in the dashboard's Inventory (now her real 43 products), Sell takes one off for an in-person sale and − / + fix a recount.

**Lumevina Studio:** the dashboard on her iPhone's home screen. New orders, gift certificate sales, client questions from Ask Lumevina and low stock arrive as notifications and in a Recent feed, orders and questions also by email, and each morning a short email lists new orders, what's waiting to ship, questions waiting for her and what's running low. Setup is in GO-LIVE.md (6c).

## Ask Lumevina looks things up, and takes photos (Oct 20)

**Looking things up:** clients can ask the chat where their order is. Signed in, it finds their own orders; otherwise it asks for the order number (now at the top of every receipt email, LUM- and 8 characters) and the email they ordered with. It says whether it's being packed, shipped (with a Track my package button) or waiting for pickup, and never shows an address. Typing a gift certificate code tells them what's left on it. When the chat names products from her shelf that are in stock, Add to bag buttons appear under the answer, and a signed-in client with a skin plan can add their whole routine in one tap ("I'm running low, can I reorder?").

**Photos with questions:** when a question goes to Evelyn, the client can add up to three photos before tapping Send. Only she sees them. Live, the assistant looks at them to write her draft and adds a plain line on what they show (where, colour, size, whether the photo is clear enough), never a diagnosis; if a photo is too dark or blurry, the draft asks for a better one. They show on the dashboard's Client questions; tap one to see it full size.

**Replying:** live, Send reply on the dashboard emails the client (their reply comes back to her inbox), and a signed-in client also sees it in the chat. Nothing reaches her until the client taps Send to Evelyn.

**Fixed along the way:** the chat's typo fixer read "running" as "burning", so "I'm running late" went to Evelyn as a skin reaction. It no longer swaps the first letter of a word unless it's a one-letter typo.

## v3: no reason to go back to GlossGenius (Oct 20)

Ruben, Oct 20: give clients and Evelyn no reason to keep booking through GlossGenius; bring in Glow Points and the membership as the reason to book here, behind an on/off switch, without crowding the site; raise the membership prices to cover running the site instead of GlossGenius.

**The switch.** `js/site-config.js → version`: `"v2"` is today's site (booking on GlossGenius, membership and points held back); `"v3"` moves everything home. Anyone can try v3 first with `?preview=v3` at the end of the address (only that browser, with a small "Previewing v3 · leave" note). The dashboard follows the same switch. GO-LIVE.md section 6 is the switch-over, step by step.

**What v3 adds, calmly.** No new header button and no pop-ups: Glow Points is one quiet band with three facts, and the points count appears in the header only once there are some. The membership section shows the founding rate and how many founding spots are left. The book section carries one line for GlossGenius clients ("that visit stands; your first booking here comes with 100 Glow Points"). The magic mirror and emoji cards are gone.

**Prices.** Glow **$185**, Ageless **$235** a month. The first 25 members keep the founding rate, **$175** and **$225**, for as long as they stay. Running the site instead of GlossGenius costs less (about $45–85 a month against GlossGenius's $24–168), so the increase is for what the membership now includes (no deposits, a card on file, member pricing on the shelf with free shipping), not to cover costs.

**For clients:** booking with a deposit or just a card on file (members: neither); a confirmation and a reminder by email, a text the day before if they want one; move or cancel from the link in every email (her 48-hour and Saturday rules hold); a waitlist on full days; Glow Points (1 per $1, 100 on the first booking here, referrals, birthdays); the membership for real (bank, gift, pause, cancel online, change the billing card); members' shelf discount and free shipping in the shop.

**For Evelyn (dashboard → Appointments):** today and what's coming; **Check out** a visit the way she described it above: the service and the deposit already paid, add products from her shelf, a discount, Glow Points, a tip (15/20/25% or her own), then charge the card on file, record cash or "Other" (Zelle), or send a pay link the client opens on their phone (Apple Pay, Google Pay, pay over time). No card reader: tap to pay on her phone isn't part of this. **No-show** and **late-cancel fees** in one tap: $43 for a late cancellation, and for a no-show 50% of the service as her policy says, with the deposit already kept counting toward it (to confirm with her). **Book for a client** (phone or in person, any time) with an email asking for a card. The **waitlist**. **Clients → import the GlossGenius client list** (its CSV export), then **Invite** them once. **Members** with their facials and billing. **Extra Mondays** are off until she turns them on; members book them first.

**Automatic messages** (hourly): the reminder email, the day-before text, a review request the day after a visit (needs her Google review link), "time for your next facial" four weeks after a visit with nothing booked (not members), and "running low?" about two months after a shop order.

**To ask her:** the no-show fee (50% of the service, with the deposit counting toward it, or on top of it?); her Google review link; whether she wants text reminders (Twilio, about $2 a month plus a cent a text, after a few days' registration); the studio address for confirmations.

## The chat learns: her 10 minutes, client profiles, and Teach the chat (Oct 20)

Ruben, Oct 20: an interview where Claude asks Evelyn everything the chat needs, nonstop, in 5 to 10 minutes; a profile for every client (the products, supplements and services they use and have had) that the chat remembers and gets better from.

**Her 10 minutes.** The Skin Playbook link now opens Talk it through on the **10-minute version**: the 26 questions clients ask most, one after another (before a visit, right after, routines, results, which facial, facial aftercare, the order of a routine, what not to mix, a first visit, and her hard lines). A line under the question says where she is ("12 of 26 · about 5 minutes left") with a thin progress bar; after each answer the box is ready for the next one, so she can keep talking (the keyboard's mic, or the questions read aloud). At the end Claude thanks her and stops. Everything else in the playbook can wait ("Claude picks", or a topic). A conversation she already started gets a "Switch to the 10-minute version" link. Same link as before; her saved answers are untouched.

**Every client's skin profile.** In My Lumevina, signed in: **Build my skin profile**, nine short questions in about two minutes, one at a time (tap for skin type and concerns, a line for the rest): what they use morning and night (any brand), anything weekly, supplements, treatments they've had here or elsewhere and roughly when, what their skin reacts to, and their goal. Then they look it over and tick a box to save it. They can edit or delete it any time. Medicines and health conditions aren't asked for here: those stay on the pre-visit form, for Evelyn.

**The chat remembers.** When a signed-in client tells the chat something lasting ("I take collagen every morning", "fragrance breaks me out"), it keeps a one-line note, shows "Noted in your skin profile" under its answer, and knows it next time. Clients see every note in My Lumevina and can forget one or all. It never keeps medicines, prescriptions, pregnancy or conditions, and it never advises on supplements (those questions go to Evelyn). With a profile, the chat answers from her playbook made specific to the client (for example, naming which of their products to stop before a facial); anything that changes their routine still goes to her.

**Evelyn sees it all.** Each client's card in the dashboard's Clients now shows their skin profile and what they've told the chat.

**Teach the chat.** When she answers an everyday skin question in Client questions (with "Teach the chat" ticked, the default for those), Claude writes a general version of her answer: no names, nothing about that client, in her words, nothing added. It waits in the new **Teach the chat** card; she checks it, edits it, and taps Approve, and from then on the chat answers that question for every client. She can add her own answers there too, and remove any. Questions about reactions, pregnancy, medication, conditions and emergencies are never suggested.

**How it "gets better", honestly:** Claude isn't retrained on anyone's data. It gets better three ways, all visible and all hers to control: her playbook (the 10 minutes, then the rest), the answers she approves in Teach the chat, and each client's own profile and notes, which only that client and Evelyn ever see.

## Her first answers reach the chat (Oct 20)

- **What she has answered so far:** one card, Skin concerns → Breakouts and acne: what she asks a client first, her morning products, what to avoid, how long results take ("3 to 6 months"; "give it 90 days"), and which facial to book. It's in the chat's knowledge now (`knowledge/concerns/breakouts-and-acne.md`), along with every treatment on her menu in her own GlossGenius words.
- **Her routines by skin type** (dry/normal and oily/combo) were typed in the Night box but say "for morning routine", so they were moved to the Morning box word for word. The Night question is open again, so the chat hands night-routine questions to her until she answers it.
- **Still open on that card:** her night routine, the most common mistakes, everyday habits, and when it must come to her. Everything else in the playbook is unanswered; the 10-minute version (Talk it through) covers the 26 questions clients ask most.
- **Answered questions fold away** in the questionnaire ("5 questions answered already", tap to check or change), so she only sees what's left.
- **The preview's chat answers with Claude** from all of it (on the viewer's own Claude account), streaming like a normal chat, with the same hand-off rules first. The live website's chat uses the server once `supabase functions deploy ask` has run with the new bundle.

## The chat knows esthetics, and the questionnaire got easier (Oct 21)

- **A general skincare layer** (`knowledge/general/`): how skin works, ingredients, routine order and what not to mix, what each kind of treatment is, standard aftercare, waxing rules, common concerns, red flags and the esthetician's scope. The chat uses it to explain and to fill gaps, saying "generally" when it's not hers; Evelyn's own words win wherever they exist, and nothing in it is used to diagnose, to call something normal, to change a client's routine or to decide a contraindication. Those still go to her.
- **Hand-offs explain themselves.** When the chat passes a question to Evelyn, it can add one or two general sentences the client reads while they wait (for example, that waxing usually waits six to twelve months after Accutane, which is why it's her call). Nothing about the client's own skin, never "that's normal". The plain-code hand-offs (pregnancy, medications, reactions, named conditions) stay instant and carry no note.
- **Signed-in clients:** the chat may point out a general rule against what they listed (two exfoliants on the same night, a retinoid before a wax) and send the decision to Evelyn; it never changes a routine itself.
- **Quick confirm** in her playbook: 147 common answers drafted from standard practice and her own GlossGenius descriptions, one at a time: Yes, Fix it, or Not this one. About 30 minutes in all, in any number of sittings. Only what she confirms reaches the chat, as her words. Talk it through offers the same drafts.
- **The model:** the chat asks for the model Ruben chose in both the server and the preview; in the preview, a viewer whose plan can't run it gets the quick tier instead.

## The chat reads texting, and sounds like a person (Oct 21)

- **Shorthand and typos:** wdym, idk, ty, thx, pls, u, ur, b4, tmrw, appt, rn, lmk, nvm, w/, "heyyy", "facail", "brazillian", "pregnent" all read as what the client meant, on the website and on the server, before the safety rules run. The chat never points a typo out. "wdym?" after an answer gets the same thing again, shorter.
- **How it sounds:** a real person at the front desk: warm, quick, plain, a little playful when the client is, calm when they're worried; matches their length and energy; no "Great question!", no exclamation-mark pile-ups. Emoji only when the client used one first or the moment is clearly light, never on anything medical or a hand-off. Evelyn's own voice notes, once she writes them, win over all of it.

## Her priorities, ranked, and on her phone (Oct 21)

- **Today**, the first card after Lumevina Studio: what needs her, in order. Right now (urgent or medical questions, questions past the promised reply time, a failed membership payment, an order overdue to ship, today's clients without a pre-visit form), Today (appointments, orders to ship, pickups, questions due, sold-out products), This week (running low, members cancelling, the waitlist, chat answers to approve, regulars overdue to rebook), Housekeeping (the shelf count, her Skin Playbook). Each line opens the card that handles it. PRIORITIES.md is the list in plain words.
- **Her phone:** everything in Right now arrives the moment it happens; "Still waiting: Maya" once when a question passes its reply time; and every morning "Today at Lumevina" with the top three, even if that's daily. Nothing waiting, nothing sent.
- **Restocking** is on the list as sold out (today) and running low (this week); what to order and how many stays her call.

## Getting customers without the conversation (Oct 21)

- **Not Etsy.** Etsy only allows handmade and vintage, and the brands she carries (Face Reality, GlyMed Plus) generally forbid third-party marketplaces and advertising under their set prices; check her reseller agreements. Her website is the store; Google Shopping's free listings and the Instagram shop are the "marketplaces" that point to it.
- **Not a loss.** Professional skincare retails at about double wholesale (she should confirm), so she earns at the shelf price. First orders get a perk instead: free pickup, 100 Glow Points on a first booking, and WELCOME10 at checkout, never in an ad.
- **Local first:** 20 miles around Woodland Hills, then LA County, then OC. A local client is a facial and a membership, not a $8 shipment.
- **Built:** MARKETING.md, the campaigns and local listings, the welcome offer, a 30-day Instagram calendar in her voice, 12 ad creatives, the product feeds, a free-pickup line in the shop, and a Monday task that drafts the week. Ads still need her ad accounts, her card and her yes.

## Skin School, bulked from her answers and the general layer (Oct 21)

- **Forty lessons now** (three new modules in Level 3: before and after a treatment, waxing done well, your first visit at Lumevina), drafted from the general esthetics layer and her own menu descriptions.
- **Under every lesson:** "Evelyn says" in her own words wherever she has answered that question in her playbook (grows as she answers; nothing invented), "The general picture" from the general layer, hedged, and "On Evelyn's shelf" with the products that belong to that lesson and their label lines. Rebuilt from the same files the chat uses, so one import feeds both.
- **Thirteen diagrams drawn in code**, in the course's own style: skin layers, type vs. condition, the barrier, SPF amount, the exfoliant ladder, the retinoid ramp, the order of steps, what not to mix, purging vs. a reaction, the 90-day acne calendar, aftercare timeline, what's normal, the waxing ruler, red flags. No borrowed photos, no invented anatomy. The style can change to match a reference once Ruben sends it.
- Skin School stays held back on the live site (`site-config.js` → school) until she has reviewed the lessons.

## The motion studio: lesson explainers rendered from code (Oct 21)

- **Eight short clips, 20 to 24 seconds each**, one per key lesson: the three skin layers and why results take weeks, the barrier as bricks and mortar, how much sunscreen and how often, the eight-week retinoid ramp, the order of steps morning and night, what isn't combined (six pairs that collide), purging vs. a breakout, and the 90-day acne calendar that opens on her own sentence from the playbook.
- **How they're made** (`docs/school/motion/`): each scene is a shot list plus a `seek(t)` function that sets everything on screen from time alone; the engine captures every frame in Chromium and pipes it into ffmpeg. No timers, no randomness, no CSS animation: the same scene renders the same bytes every time, and the log keeps a hash of every frame as proof. Before anyone watches, the engine warns about text that runs past the frame or sits on other text, and about stretches where nothing moves.
- **Where they show:** the lesson's video box plays the explainer (poster, tap to play) until Evelyn records her own lesson video; the 9:16 cut of each clip sits in `marketing/ads/out/video/` for Reels and TikTok, captions carrying every line with the sound off.
- **What's not in them:** stock footage, music, a fake voice. Her voiceover can be laid over any clip when she records.
- **Reference:** the "code-rendered motion studio" idea (brief → shot list → frame engine → review → deliver) that Ruben sent; this is that pipeline, with the lesson notes as the brief.

## Solid scenes and the storefront plan (Oct 21, later)

- **Two clips in three dimensions**, after the reference Ruben sent (a toy set under studio light, blocks and dominoes with real shadows): *Inside a pore* (lesson 8-2: a voxel block of skin, the pore clogs with dead cells and oil, oxidizes dark, inflames red, then mandelic acid and benzoyl peroxide clear it, day counter to 90) and *Ninety nights* (lesson 3-3: ninety dominoes, one per night, four skipped, the chain picks up again, lands on Day 90). Same engine, three.js vendored, every frame still a pure function of time.
- **Every explainer now has a WebM copy** beside the mp4 so it plays in browsers without H.264; the lesson box plays the clip on tap and the placeholder stays where there's none.
- **STOREFRONT.md** is the step-by-step for selling to people who aren't her clients yet: ask the four brands first (email drafted), the paperwork, a consult gate on the actives, an online consult that credits toward the first order, the channels in order, and the TikTok Shop / Shopify call. The one thing only she can do this week: send the three brand emails.

## The consult gate and the online Skin Consult (Oct 21, later)

- **On the shelf:** the actives (Acne Med 2.5% and 5%, the 11% and 15% mandelic serums, Retinal B3, Retinol Peptide, Hydroxi) now say *Needs a quick consult*. A tap opens a short sheet: name, email, a few lines about their skin, or the full pre-visit form. She gets a notification; the client gets a "got it" email.
- **Her side:** a Consults card on the dashboard, under Today. Approve (that product, or every active), decline, with a line she writes that goes in the email. Approval is by email address, so the client buys with the same address and it goes straight through; the server checks it at checkout too, so the chat or a crafted request can't skip it.
- **The online Skin Consult:** a card above the shelf, $35, checks out like a product with no shipping. On payment: a "what happens next" email to the client (she messages within two business days to set a 15-minute video or phone call), a notification to her, a row under Consults. *Done* sends the $35 back as a certificate code and unlocks every active for that email.
- **The list of gated products follows the brands' answers** (STOREFRONT.md, step 0): one flag per product in the catalog.
- Tested: the server harness (120 checks), the type check, and the browser at 390 and 1280 (the ask, the sheet, the dashboard decision, the unlocked button, a consult-only bag with no shipping).
- **A third solid clip** (lesson 10-1, *What actually ages skin*): UV rays from a sun reach the dermis of the voxel block and leave dark spots and tired collagen; the SPF shield goes on and the rays bounce; two hours later it thins and a ray slips through, then it's reapplied. Week 11 in the TikTok pack.
- **Follow-through on the gate:** a request a day old nudges her phone once ("Still waiting to buy: Maya"); the chat's Add to bag on a gated active ends with "Ask Evelyn to unlock it", which opens the sheet; her approval email's links carry the client's email, so a new phone knows who was approved, and the checkout prefills that email (a mismatch says which email her yes is for).
- **A fourth solid clip** (lesson 11-1, *Sensitive and rosacea-prone skin*): the top row of the voxel block as bricks on a glowing sheet of mortar; a scrub, hot water and one active too many wear it, water leaks out, irritants fall in and the bricks go red; then the cream goes on, the gaps close and a day counter runs to 14, with the rosacea line at the end. Week 12 in the TikTok pack. The home page now has a *Skin science* strip with all four solid clips, two by two.
- **Buy again** (STOREFRONT.md step 2.6): a signed-in client's My Lumevina lists what they bought before, newest first, each one a tap back into the bag, with *Add all* when there is more than one. Sold out says so; an active she hasn't unlocked for them says *Needs a quick consult* and opens the sheet. Live, it reads their own orders from the server (the orders table lets a signed-in client read only their own rows); in the demo, this browser's orders.

## Found by search, Buy again, and two more clips (Oct 21, later still)

- **Search and shares:** the home page now carries structured data for the studio (hours, Woodland Hills, Instagram) and every product on the shelf (price, in stock or not, photo, its own link), share tags for iMessage and DMs (the pore clip's poster), and a robots file that keeps the dashboard out of Google. Skin School carries the course as structured data too (levels, hours, prices, the two free lessons), and `school.html#learn-1-1` opens the free lesson straight away: that is the link for the TikTok bio.
- **Under the clips:** one line pointing at Skin School, the free lessons and the $149. The chat knows the course and its prices now.
- **Two more solid clips:** *Why a dark spot takes months, not weeks* (lesson 9-3: pigment cells hand melanin up, the surface sheds a month at a time, the shield and the brighteners finish it) and *Every moisturizer is three kinds of ingredients* (lesson 2-2: humectants pull water up, emollients fill the seams, the occlusive film on top). Weeks 13 and 14 in the TikTok pack.
- **It keeps going on its own:** a scheduled task ("Lumevina: keep rendering and improving", hourly) continues this work in the same session: finishes renders, commits, pushes, republishes the previews, picks the next improvement. Ruben stops it by saying stop (or from the scheduled tasks list). The "Code-rendered motion film" link Ruben sent is a separate running session, not a branch; nothing from it has been pushed yet, so nothing of it is folded in here.
- **A seventh solid clip** (lesson 2-1, *Cleansing, done right*): the day lands on the surface as a sunscreen-and-makeup film, oil beads and grit; a balm drop spreads and melts the film, a lukewarm rinse carries it off; foam circles for a sixty-second clock, rinses, and the barrier is still there, with the "tight and squeaky means too strong" line. Week 15 in the TikTok pack. The home strip now shows six clips, three rows of two; the rest live in Skin School.
- **An eighth solid clip** (lesson 4-2, *How often, and how much*): dead-cell plates on top of the block; one acid drop sheds the loosest fifth with Tuesday and Friday lit on a week of chips; a drop every night sheds them all into a plastic shine with sting sparks and a red top; then the cream, the plates growing back over fourteen days of rest, and the note about the week around a professional peel. Week 16 in the TikTok pack.
- **The product sheet names its lesson:** while the course is switched on, every product sheet carries one line, *From Skin School: Cleansing, done right* (or the lesson that fits: moisturizers, sunscreens, toners, eye care, masks and supplements by category; serums and spot care by the active in their name), linking straight to that lesson. The lesson is general; the label stays the label.
- **Two more in the queue** (rendering one after another): *How to read a label* (lesson 3-1, flat: the bottle's four claims struck through, the flip to the list, the first five, the 1% line, the star after the fragrance) and *Vitamin C in the morning* (lesson 5-1, solid: free radicals chipping at collagen, most bounced by the sunscreen, the rest fizzling at the amber glow, and a vial going from straw to brown over twelve weeks). Weeks 17 and 18 in the TikTok pack.
- **And a tenth, flat:** *Three kinds of dark spots* (lesson 9-1): three faces, scattered sun spots, the marks where breakouts were, the mirrored patches of melasma with its triggers, and the red marks that are vessels, not pigment. Week 19 in the TikTok pack. The product sheets, the home strip and Skin School all pick these up as they render; the hourly task reviews each contact sheet before the full render.
- **Six more lesson diagrams** (twenty now): the first routine (3-2), the anti-aging short list (10-2), the seasons (7-3), the supporting cast (5-3), the brighteners (9-2) and the pregnancy pause-or-keep lists (11-2), drawn in code from the lessons' own lines, in the lesson player above the notes.
- **Every lesson has a visual now** (29 diagrams, 14 clips, more rendering): the last nine diagrams cover scrubs and dermaplaning (4-3), the Sunday ritual (7-1), massage direction (7-2), how acne forms (8-1), who does what in California (10-3), prep before a visit (12-1), after a wax (13-2), which treatment to book (14-1) and a routine from her shelf (14-2).
- **Eighteen clips rendered** (nine flat, nine solid), each in its lesson and cut 9:16 for TikTok; `marketing/ads/out/video/README.md` lists them by week with the hook and the length (regenerated by `node scripts/clip-index.mjs`). The nineteenth, *Three kinds of dark spots*, landed too: nineteen clips, every one in its lesson and in the TikTok folder.
- **A twentieth clip:** *The anti-aging short list* (lesson 10-2, flat): the morning and night tiles, then a two-lane race over eight weeks, a gentle retinoid every night against a strong one once a week with its peeling. Week 20 in the TikTok pack. Twenty clips rendered, every one in its lesson and in the TikTok folder with its 9:16 cut.
- **A twenty-first clip:** *The week before your facial* (lesson 12-1, flat): a nine-day calendar with the pauses marked day by day (the prescription retinoid, retinol and acids, sun, waxing or shaving, the trip after), then "breaking out? come in" and the one thing that waits. Week 21 in the TikTok pack. Twenty-one clips, all in their lessons and in the TikTok folder.

