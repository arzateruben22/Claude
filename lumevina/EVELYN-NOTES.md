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

**Finding it (Oct 26):** Everything Lumevina puts the dashboard on its top row beside the website, with three ways in: **Check out a client** (opens `dashboard.html#checkout`: the client list, a one-line hint and the search ready for a name), **Your clients** and **The whole dashboard**. The dashboard wears the website's own frame (Oct 27): the same header (Lumevina, Owner Studio, her sections as the link row, a solid Check out where the site has Book now, Your website), the same phone menu (01 Today, 02 Clients, 03 Client questions, 04 Shelf & shipping, 05 Books, 06 Members & gifts, 07 Settings, then Check out a client, New sale and Your website), the site's numbered section heads and footer. The client list sits right under Today instead of at the bottom, and a client's **Check out** opens the sale right under their name. On a phone the client list moved from about 25 screens down to the second screen.

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
- **Where they show:** the lesson's video box plays the explainer (poster, tap to play) until Evelyn records her own lesson video; the 9:16 cut of each clip sits in `marketing/ads/out/video/` for Reels and TikTok, a soft original music bed under each, and captions carrying every line, so it works with the sound off too.
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
- **A twenty-second clip:** *Before a wax: a quarter inch* (lesson 13-1, flat): a ruler where the hair grows to a quarter inch with a grain-of-rice badge riding its tip and the grip zone lit, two timing cards with their bars (two to three weeks after shaving, four to six after a wax), then the three rules (no shaving between, exfoliate gently, that morning). Week 22 in the TikTok pack, for Wax Wednesday.
- **A twenty-third:** *Find your real skin type* (lesson 1-2, flat): four faces with their oil (flakes, shine all over, a T-zone, nothing), the bare-face test as four steps and a one-hour clock with the readout landing under each face, then the conditions on top, the oily face turning "oily + dehydrated", and the line to check again every few months. Week 23. A twenty-fourth, *After your facial: the first day, then the week* (lesson 12-2), is rendered too: the four things kept off for 24 hours and the three allowed, then the week strip with the actives-off days (two to three after a facial, five to seven after a peel), the flaking days and the no-new-products week marked. Week 24.
- **Twenty-five and twenty-six:** *Facial massage: slip, direction, a light hand* (lesson 7-2: a drop of oil spreads into slip on the cheek, the strokes draw from the center outward and down the neck to the lymph nodes, the pressure knob settles at light, the skip zones ring red) and *After a wax: bumps, ingrowns, how often* (lesson 13-2: the two days of calm with the four things kept off, two skin patches where normal bumps fade and the other kind turns to pus and spreads, then the week's exfoliation and moisturizer marks and a dial filling to the next wax). Weeks 25 and 26 in the TikTok pack; twenty-six clips in all, every one in its lesson and cut 9:16.
- **Twenty-seven and twenty-eight:** *AHAs, BHAs and PHAs* (lesson 4-1: a skin block with a pore; the AHA drop lifts the loose surface cells and leaves a glow, the BHA drop sinks down the pore and the oil plug clears, the PHA drop spreads a soft tint, then the sunscreen row) and *After a treatment: what's normal, what isn't* (lesson 12-3: a four-rung ladder from normal to 911 that opens one rung at a time, each rung's signs as chips). Weeks 27 and 28.
- **Twenty-nine and thirty** (rendering as this is written): *Build your first routine* (lesson 3-2: morning and night as three numbered steps each, a fourteen-day strip where one product goes in on day one and the next on day fifteen, and a patch square on the jaw with the day counter running to ten) and *How acne really forms* (lesson 8-1: four rings filling for the four causes, three skin patches for clogged, inflamed and cystic, and a twelve-week line beside a big "2 to 3 months"). Weeks 29 and 30. Ten lessons still have a diagram but no clip: 4-3, 5-3, 7-1, 7-3, 9-2, 10-3, 11-2, 11-3, 14-1 and 14-2; they're next.
- **Every lesson has a clip now, in a new studio look** (rendering as this is written). The motion studio was redone to match the reference frames: rounder blocks, a warm floor that fades into the dark, a slow drifting camera, soft light and dust in the room, and gentler entrances. All 40 lessons are being rendered (or re-rendered) in it, one at a time; each replaces its older version in the lesson and in the TikTok folder as it finishes. The ten that were missing: *The supporting cast* (5-3), *Brighteners that work* (9-2), *Pregnancy and breastfeeding* (11-2), *The Sunday ritual* (7-1), *Skin through the seasons* (7-3), and five new scenes: *Scrubs, brushes and dermaplaning* (4-3: a strip of skin meets scrub grit that leaves tiny tears, a soft washcloth and an enzyme mask, then a dermaplaning blade; ends on the at-home rules), *Professional treatments, explained* (10-3: the skin's surface lights for her room, the deeper layers for the medical treatments, the injectables question, and the before-and-after that does most of the work), *Your skin plan for life* (11-3: the plan writes itself and turns over each season, the dermatologist list, a skin check with her), *Which treatment to book* (14-1: new or returning, acne or not, four answers and what to bring) and *Her shelf* (14-2: the base and one addition, mandelic strengths, gel or cream with a toner under either, a pick hopping into the pickup bag). Weeks 31 to 40 in the TikTok pack.

## Ask Lumevina: thinking out loud, and a calmer look (Nov 11)

- **While it works out an answer:** instead of three dots, a quiet "Thinking it through" with the seconds counting and the steps it's actually taking (reading the message, the client's file when they're signed in, Evelyn's notes, putting the answer together). The answer then carries a small "Thought it through · 3s" that opens to the same steps. While it thinks, the send button becomes Stop.
- **The look, to match:** answers sit as plain text on the panel, the client's own messages in soft linen bubbles, the main button flat black and the rest thin outlines. The box at the bottom is a rounded card that grows as you type (Enter sends, Shift+Enter starts a new line) with a square send button; a sent message travels up from the box into the conversation.
- **The shop stays as it was** (the product cards and their pop-up), after a look at products on floating shelves.

## Service photos, one set (Nov 11)

Ten new texture photos (made with ChatGPT in the site's palette, no people, no text) cover all 36 services: each service's pop-up shows its own, and the four featured cards use Ageless Grace, ProCell, Custom Facial and the Brazilian. Close services share one: New Clients; Custom Facial and After-Hours; Ageless Grace; ProCell and its package; both peels; all three Acne Bootcamp visits; both consultations; Brazilian, bikini and inner thigh; body waxing; brows, lip and nostril. The choice lives in one place (`js/services.js` → photo). The menu list itself stays text only. The older texture photos are still used by the ad creatives and the app sample.

## Questions before launch, as a page she fills in (Nov 11)

`docs/launch-questions.html` is the pre-launch checklist as a page Evelyn can fill in on her phone, published at https://claude.ai/artifact/XfuMJKhS4Fm8fdYF5fgYwk. It has 24 questions, quickest first: yes or no, quick facts, short tasks (with the brand email ready to copy) and the launch session times. Most answers are one tap, and notes are optional. Answers save as she goes, one document per question in the page's `answers` collection, so they reach the owner's copy live. On a link that can't save online, answers stay on her phone, and **Copy all my answers** gives her the text to send. To change a question, edit the file and republish the same path.

## Her launch answers (Nov 11)

From her launch questions page (https://claude.ai/artifact/XfuMJKhS4Fm8fdYF5fgYwk), as she answered them, and what changed:

| Question | Her answer | What changed |
|---|---|---|
| Shipping, $8 and free over $75? | "No free shipping, unless they have membership perks." | $8 an order, no free-shipping minimum; Glow members (v3) still ship free; pickup free. Cart, checkout function, page copy, chat, reminder email, ad and shipping kit. |
| Barrier Repair Cream $83.20? | Different price: $104 | $104 on the site, the server seed and the product feeds. |
| invisiClear $10? | That's right | Nothing to change. |
| How many Retinal B3 Serums? | 2 | Counted at 2 (`counted: true` in js/catalog.js keeps her own count while the rest of the shelf isn't counted). |
| Older sunscreens still sold? | Yes, keep them | They stay on the shelf. |
| Seller's permit? | Yes | GO-LIVE step 4b. |
| LA business tax certificate covers retail? | Not sure, then checked: it covers it | Nothing to do. |
| Own a domain? | No, OK to buy one in her name | Bought in the launch session (GO-LIVE step 7). |
| Stripe account? | Yes | Use hers in the launch session. |
| Booking? | Keep GlossGenius for now | Already so (`booking.mode: "glossgenius"`). |
| Deposits for facials, peels, ProCell online? | Yes, "but clients aren't booking through this website yet" | Nothing yet (booking stays on GlossGenius); the amount is a follow-up on her page, set in js/services.js when website booking turns on. |
| WELCOME10? | Yes | Set up the code in Stripe at launch (GO-LIVE). |
| Pay later? | Yes | Checkout says Klarna, Afterpay or Affirm; switch them on in Stripe at launch. |
| Text reminders? | Later | Twilio stays off. |
| Order alerts email | Given | Kept out of this public repo: it goes in the `OWNER_EMAIL` server secret at launch. |
| ProCell: $350 single, 4 for $1,100 (first 10 clients)? | Both right | Nothing to change. |
| Google review link | Given | The `REVIEW_URL` server secret at launch (the "how was your visit" email). |
| Studio address for confirmations | Given | The `STUDIO_ADDRESS` server secret at launch. Kept out of this public repo; the site keeps saying Woodland Hills. |
| A bigger Dew Drop photo | She'll send one | Swap `img/products/` when it arrives. |
| Liability insurance covers product sales? | Covered | Nothing to do. |
| Brand emails sent? | Not yet ("no") | The one real blocker before the shop goes public (STOREFRONT.md step 0). |
| 10 minutes in the Skin Playbook | Not yet | Not blocking; the chat already has her earlier answers. |
| Launch session times | Sunday or Monday, afternoons | Pick the date with her. |
| Ad accounts on Meta and Google | Not yet | Later, before any paid ads. |
| Anything else? | No | |

Still waiting on: the deposit amount (the one question left on her page), the brand emails, the Skin Playbook and the Dew Drop photo.

## The moving hero (Nov 14)

The top of the page is now a moving picture: her logo sculpted in cream, rising from water, with sunbeams, drifting dust and rippling light. It replaced the rose-gold liquid animation and the drawn logo above the headline.

- **How it was made:** a still from ChatGPT (the logo in cream, no lettering, tall 9:16), animated in Higgsfield. The prompt that worked asked for clearly visible motion in the water, light and dust, and only kept the sculpture's shape. The first try, which asked for "gentle" motion and a "completely still" sculpture, came out almost frozen. The original clip is in `marketing/source/hero-phone-higgsfield.mp4`.
- **The files:** `img/hero/hero-phone.mp4` is a 9-second seamless loop (the last second blends into the first), 0.7 MB, with no sound. `img/hero/hero-poster.jpg` is its first frame, shown while it loads and whenever it doesn't play.
- **Where it shows:** on phones and tablets it fills the first screen, with the sculpture at the top and the words over the calm water. On desktop it's a tall panel on the right, feathered into the same cream, with the words and the product row on the left.
- **It stays still** (its first frame) for anyone with reduced motion or data saver on, in iPhone Low Power Mode, and while it's scrolled out of view.
- **Previews:** the clip plays from each preview's asset store (`hero-phone` in `scripts/preview/v2-videos.json` and `v4-videos.json`), like the lesson clips.
- **Still to do:** a wide (16:9) version for desktop, made the same way. With it, desktop gets the full-width picture behind the words, like the Los Güeros site.

Also fixed on the way: the hidden icon set at the top of the page (the EV mark) was taking up 150 px, which showed as a blank strip above the top section in the previews.

## The water, down the page (Nov 15)

The hero's water now runs through the rest of the page, in the same cream and light:

- **Book:** two koi circling in the water, seen from above (`img/water/koi.webp`, from ChatGPT, Nov 16; it replaced the rose). On desktop they swim just right of the booking card; on phones they're a band across the top of the section. A clip of them swimming can replace the still later, the same way as the hero's.
- **FAQ and Contact:** one stretch of open water (`img/water/open.webp`), with the sunbeams over the FAQ and the ripples under Contact.
- **Shop, Services and Skin science:** a soft band of water and light behind each heading, fading out before the content. About keeps its own light.
- **Moving light** (`js/water.js`): light drifts slowly across the water, drawn in code, so there's nothing to download. A ring spreads wherever someone taps open background, including on the hero, but never on a button, link, field or text. It only runs while that part of the page is on screen, and stands still with reduced motion on.
- Both pictures were made in ChatGPT in the hero's style. The originals are in `marketing/source/water-rose.png` and `water-open.png`.

## The stone fountain front page (Nov 16)

- **The front page** is now her logo carved in stone, standing in a pool (`img/hero/hero-stone.webp`, from ChatGPT; original in `marketing/source/hero-stone.png`). It replaced the cream clip, whose original stays in `marketing/source/hero-phone-higgsfield.mp4`. There's no video: `js/water.js` keeps the pool moving. Rings spread from the statue's base every few seconds, as if water were falling in. A drop lands somewhere else in the pool now and then, light plays on the water, and a tap on the water sends a ring. A Higgsfield clip of the stone fountain can replace this later.
- **The light on the water** (front page, Book, FAQ, Contact and the bands) was redone to look like water rather than a net. A few slow waves bend the light into soft, wavy lines that thicken, thin and drift, worked out on a coarse grid and smoothed. It runs at about 25 frames a second, only while on screen.
- **Colours:** the front page is stone beige (`#CCB397`, lit softly from the top left); the pictures further down are still the peach water.

## Her logo in pencil, on the front page (Nov 16, later)

- **The front page** now shows Evelyn's own logo as a pencil sketch, above the headline in the centred column, on warm paper with soft light from the top left. It replaced the stone fountain; that original is in `marketing/source/hero-stone.png`.
  - `js/sketch-logo.js` reads her real logo (`img/logo-full.svg`: the lines traced from her drawing) and draws it in warm graphite with a paper grain, a slight hand wobble, and a second, lighter sketch line.
  - When the page opens, the lines draw themselves in: the circle, then her profile and the roses, with the lettering shaded in last, about three seconds in all.
  - It stays still with reduced motion. If the file can't be read, the plain logo shows.
- **No more droplets:** the automatic rings and drops in the pool are gone. The front page has only the water's light at its foot, under the product row, and tapping there leaves no ring. Tap rings still work on the water sections further down.

## The koi swim, and the pencil gets a hint of chalk (Nov 16, later)

- **Book:** the koi now swim (`img/water/koi.mp4`, 10 s, 0.86 MB, from the clip "Locked overhead camera, exactly two koi"; original in `marketing/source/koi-two.mp4`). It's exactly two fish throughout. The clip doesn't end where it starts, so the loop joins with a dip: the fish fade down into the water over 0.75 s, leaving a soft swirl, and surface again where the clip begins, so there's never a third fish or a ghost. The still is the poster and the section's background. The clip loads and plays only while Book is on screen, and stays still for reduced motion or data saver. The previews play it from their asset store (`water/koi` in `scripts/preview/v2-videos.json` and `v4-videos.json`).
  - An earlier Higgsfield clip was turned down because a third koi grew out of the cream one for about five seconds.
- **The pencil logo:** deeper graphite, finer grain, a soft shadow under the lines, and a very slight hint of dusty-pink chalk rubbed into the roses after they're drawn.

## No more "Consult first" (Nov 16)

Every product now goes straight to the bag. The seven actives that needed Evelyn's yes first were the 2.5% and 5% Acne Med, the 11% and 15% mandelic serums, Retinal B3, Retinol Peptide and Hydroxi. They lost their `consult: true` in `js/catalog.js`, so the shop, the cart, Buy again, the chat and the server's checkout (through `server/seed-products.sql`, where `consult` is now false) all sell them like everything else. The wording about unlocking actives is gone from the shop card, the FAQ and the chat. The online Skin Consult ($35, credited to the first order) stays as a service. To bring the gate back for a product, add `consult: true` to its line again and re-run `node scripts/seed-products.mjs`.

Worth knowing: the gate was there because professional lines usually want their strongest actives sold on a professional's recommendation, and the brand emails (STOREFRONT.md, step 0) haven't gone out yet.

## Skin School off the website (Nov 16)

Skin School is off every version of the website:
- The "Skin science" section (the three lesson clips) now shows only when Skin School is switched on.
- `js/site-config.js` no longer switches it on in any version; v4 dropped "school".
- So the course row in the shop, the "From Skin School" line on products and the chat's course answers are all off too. The chat says classes aren't open yet.
- The site's share description no longer mentions it.
- The share picture is now the koi still (`img/share.jpg`), not a lesson frame.

The course itself (`school.html` and `docs/school/`) is untouched, and so is its card on Everything Lumevina. To bring Skin School back, add "school" to the features in `js/site-config.js`.

## The warm neutral palette (Nov 16)

The website moved off the rosy beige and grey to a warm neutral palette, like the spa, with stronger contrast and no pink or mauve:

| Colour | Hex | Used for |
|---|---|---|
| Warm ivory | #F6F4EF | the main background (`--linen`) |
| Soft white | #FBFAF7 | product cards and lighter sections (`--porcelain`, `--field`) |
| Stone greige | #D8D4CD | secondary sections, borders, dividers (`--khaki`, `--linen-2`) |
| Mushroom taupe | #9A8E82 | subtle accents (`--camel`, `--sand`) |
| Near-black | #171717 | headings, buttons, the logo (`--ink`) |
| Warm charcoal | #403D39 | body text (`--ink-60`, `--espresso`) |

- **Small text accents** (eyebrows, notes, the headline's second line) use a deeper taupe, #6B625A. Mushroom taupe itself is too light to read at small sizes on ivory, while #6B625A reads at 5:1.
- **The other hard-coded shades:** about 90 peach, rose and cocoa shades in `css/styles.css` became the warm neutral of the same lightness (converted by a one-off script: each shade's tint was capped and turned toward the taupe's warm grey). The red for errors and the green for "In stock" stay.
- **The logo:** LUMEVINA is all near-black. The header's "ev" and the drawn logo's EV no longer fade to grey. AESTHETICS SPA is warm charcoal, kept distinct by its small size and wide letter spacing. The pink chalk on the drawn roses is off.
- **The water pictures** (the koi, still and clip, and the open water) and the share picture were re-tinted from peach to warm stone (saturation down to 28%). The koi are now pearl white. The originals are unchanged in `marketing/source/`. The water band behind the headings is stone greige.
- **Unchanged:** the service and product photos keep their natural colours.

## The full name everywhere (Nov 16)

Wherever the website, a receipt, an email, a text or a calendar invite names the business, it now says **Lumevina Aesthetics Spa**:

- **The website:** the footer reads "Lumevina Aesthetics Spa" with "Where glow begins." under it. Also the About text ("the licensed esthetician behind Lumevina Aesthetics Spa", "Lumevina Aesthetics Spa begins with a conversation"), the shop note, the app section, the consent lines on the booking form, the "Back to" buttons, the referral question and the social and email buttons.
- **The chat:** its greeting ("Hello, and welcome to Lumevina Aesthetics Spa") and its built-in answers.
- **What clients receive:** email subjects (receipts, orders, gift certificates, cancellations, an opened time), texts (confirmations, reminders, the waitlist), calendar invites, the card statement line and Stripe's order description. The email sender name defaults to "Lumevina Aesthetics Spa <hello@…>".
- **The other pages:** the privacy page, the shipping kit, the sample receipt, the owner dashboard's title and its calendar feed name.
- **On a phone's home screen** the app is called "Lumevina Spa", because the full name is cut off under the icon. Its full name, "Lumevina Aesthetics Spa", shows everywhere else.

**Kept as they are:** the names of features and treatments (Ask Lumevina, My Lumevina, the Lumevina Custom Facial, Lumevina Studio), the email address, the Instagram handle, and the `ref=Lumevina` code in the brand links, which the brands use to credit her.

**At launch:** set the email sender name to "Lumevina Aesthetics Spa" too (the FROM_EMAIL setting).

**Texts are longer now.** The full name adds 15 characters, so a confirmation with its link may count as two texts, which roughly doubles its cost. To keep texts short, they can start with "Lumevina Spa:" instead; the rest of the site keeps the full name.

## The iPhone app sample, brought up to date (Nov 16)

The app sample on Everything Lumevina (`docs/app-sample`, the hub's app.html) now matches the website:

- **Colours:** the warm neutral palette (ivory, soft white, stone, taupe, charcoal, near-black), with no pink or mauve. The Glow card is black with ivory type, and the tab bar is near-black with an ivory selected tab.
- **The lock screen** shows the koi from the website, seen from above, as the wallpaper.
- **The name:** Lumevina Aesthetics Spa, in the page title, the intro, the Glow card and the share text.
- **Prices and times, from the website's menu:**
  - Lumevina Custom Facial $200, 60 min
  - Custom Facial + Dermaplaning $230, 60 min
  - Ageless Grace Facial $240, 75 min
  - New Clients Start Here $220, 60 min
  - Monthly Acne Treatment $200, 70 min
  - New Client Consultation + Treatment $220, 80 min
  - Brazilian Wax $75, 40 min
  - Brazilian Wax + Mini Vajacial $95, 50 min
  - Underarm Wax $20, 20 min
- **Membership:** Glow $175 and Ageless $225 (the founding rates). Glow covers the Custom Facial or the Monthly Acne Treatment. Ageless covers any of the facials, up to the Ageless Grace.
- **Booking:** members book with no deposit, as the website's Glow perks say ("your card on file holds each booking"); there's no more 50% deposit. Points come after the visit, on what she pays.
- **Hours:** the times offered follow her real hours (Tuesday 12 to 7, Wednesday and Thursday 11 to 7, Friday 10 to 5, Saturday 9:30 to 6).
- **The shelf:** Le Mieux is no longer carried, so "Picked for your skin" shows the GlyMed+ Revitalizing Essence with NAD+ ($50, $45 for members). The Daily SPF 30 Plus is $36 ($32.40 for members).
- **Rewards:** 1 point per $1 paid online or at the studio, and double points on Wednesdays.
- **The app icon** (also the website's home-screen icon and favicon) had mauve line art. Its lines are now warm ivory on black.

**Everything Lumevina itself** moved to the same palette. The card for the full website no longer mentions Skin School, and the card pictures were retaken from the pages as they are now.

## New Clients Start Here: a new photo (Nov 16)

The cream swirl on linen read as pudding, so New Clients Start Here now uses the consultation photo: a small dish with three textures side by side (the same picture as the consultations). It shows in the booking picker, the treatment's pop-up and the menu cards. The swirl (`img/services/new-clients.webp`) is removed.

**Later the same day:** the app's Book list now uses the website's treatment photos, the same ones as the menu and the booking picker:
- Custom Facial and Custom + Dermaplaning share the custom facial photo.
- The Ageless Grace has its own photo.
- New Clients Start Here uses the consultation dish.
- Both acne visits use the acne photo.
- The Brazilians use the Brazilian wax photo, and the underarm uses the body wax photo.

The cleanser in "Picked for your skin" uses the shop's own photo. The "Included with Ageless" tag is outlined, so it reads on the light list.

## The app's chat: the website's full knowledge (Nov 16)

- **The topic buttons** under the app's chat were dark on a near-black bar and hard to see. The bar is now soft white, and the buttons are outlined in charcoal.
- **The same knowledge as the website's chat.** The app now carries everything Ask Lumevina knows: her instructions, the studio's facts and policies (prices, deposits, the 48-hour rule, the $43 same-day fee, Saturdays, hours, parking, shipping), her Skin Playbook, her hard lines and the whole shelf. It's rebuilt from `knowledge/eval/bundle.json` each time the app is built.
- **It knows Sofia:** her Glow membership, her banked facial, her next visit, her points and her welcome kit.
- **Hand-offs:** the website's own rules decide what goes to Evelyn: reactions, pregnancy, medication, conditions, photos to read, and anyone who asks for her. Those show "Sent to Evelyn · reply within 24 hours", then a sample reply from her, sped up for the demo.
- **When Claude answers in the preview,** answers stream in with follow-up buttons, and with "Add" buttons when it names a product.
- **Without Claude** (where the viewer's account can't answer), the built-in answers reply instead. These were also brought up to date: hours, shipping, the change and cancel rules, running late, and Saturdays.
- **A fix on the website too:** the full version (with booking and membership) was giving its chat the "book on GlossGenius" facts. Now it gets the "book right here" facts, on the website and on the server.

## The app: the EV surprise is off (Nov 16)

The "Your EV" section on the app's Rewards tab (tap the EV for a surprise) is removed, with its "Try this" button beside the phone. The notification switch for it now reads "Glow Points and rewards". The Rewards tab goes straight from the points bar to Ways to earn. The website never had it.

## The line under the products (Nov 16)

The line under the hero's products, "As featured in CanvasRebel · Medical-grade skincare", now reads **"The products I use and recommend · Shop medical-grade skincare"**. "Shop medical-grade skincare" links to the shop, and on a phone it stays together on its own line. The CanvasRebel interview is still linked from her photo in Meet Evelyn ("Featured in CanvasRebel →").

## The shop's heading (Nov 16)

- **Heading:** "Professional skincare *for your at-home routine.*" (was "The skincare Evelyn uses, for home.")
- **Paragraph,** in Evelyn's voice: "Browse by brand or skin concern to find the products I stock and recommend for my clients. If something is out of stock, you can request it and I'll order it for you." The shop's search already understands skin concerns (acne, dark spots, sensitive, oily, wrinkles and more), and the brands sit right under it.
- **Pickup:** "📍 Local pickup is free at the Woodland Hills studio—during your appointment or on an open day. Shipping is $8 per order." The dash stays with "studio" on a phone.

## The consultation: online or in person, $75 (Nov 16)

The card above the shop now reads:

> NOT SURE WHAT YOUR SKIN NEEDS?
> **Personalized Skin Consultation · Online or In Person**
> Meet with Evelyn to discuss your skin concerns and current routine, and get personalized guidance on products and next steps. $75
> [Book a Consultation · $75]

- **No code.** The old $35 Skin Consult gave the $35 back as a certificate code on the client's first order. That's gone: $75 is the price. When Evelyn taps Done in her dashboard (Consults), the actives unlock for that client as before, but no certificate goes out. The button reads "Done", not "Done, send the $35".
- **Booking:** the button puts the consultation in the bag. The client pays $75, and Evelyn messages them within two business days to set the time, by video or at the studio. The emails, her dashboard and her daily priorities all say so.
- **The menu matches:** In-Person Consultation and Virtual Consultation are now $75 (were $50), so the page never shows two prices for the same thing. Their $49 deposit is unchanged.
- **Everywhere else:**
  - the shipping policy line ("Not local? The Personalized Skin Consultation ($75) can be online…")
  - the services note under the menu
  - the share description
  - the chat (its built-in answer and its instructions)
  - the server's product list (`server/seed-products.sql`)
  - the privacy page and the TikTok caption
- **To do on GlossGenius:** her In-Person and Virtual Consultations there should be $75 too, since the simpler version of the site books on GlossGenius.

## The GlossGenius booking card: no deposit line (Nov 16)

"Some treatments take a deposit ($20 to $50) when you book…" is removed from the booking card, where booking runs on GlossGenius. The card keeps "New here?" and "Been before?" and the "See openings and book" button. The deposits themselves are unchanged: GlossGenius still takes them, and each one still shows on the menu, in the policies and in the chat.

**Later the same day:** "Book a Consultation · $75" now opens her GlossGenius page (lumevina.glossgenius.com) in a new tab, in both versions of the site, instead of adding the consultation to the bag. The link follows the GlossGenius address in `js/site-config.js`. The chat says to book it on GlossGenius too. On GlossGenius, the In-Person and Virtual Consultations should be $75 so the two match.

## The booking section's wording (Nov 16)

While booking runs on GlossGenius, the Book section reads:

> 02 · Book a facial
> **Book your *next appointment.***
> [ONLINE BOOKING COMING SOON] For now, book through GlossGenius using the button below.
> **New clients:** Choose "New Clients Start Here." For acne, choose "Acne Bootcamp's New Client Consultation + Treatment."
> **Returning clients:** Choose your service and preferred time.
> [Book through GlossGenius]

The deposit wording is gone from the section: "same calendar, same deposits" and "Evelyn's calendar, deposits and reminders are on GlossGenius". In the version that books on the website, "(some treatments take a small deposit)" is gone too. Each deposit still shows beside its treatment on the menu and in the policies. "Opens lumevina.glossgenius.com" stays under the button.

**Simplified the same day:** the heading is now "Book your next appointment." The tag reads "Online booking coming soon", followed by one line: "For now, book through GlossGenius using the button below." Nothing repeats where the calendar is or how deposits work, and nothing suggests booking on the website is already open.

## The gift certificate's wording, and no expiry promise (Nov 16)

The card in Services now reads:

> E-GIFT CERTIFICATE
> **The gift of glow**
> Redeemable toward any treatment at Lumevina Aesthetics Spa. Delivered by email with a unique code.
> *(amounts and Add to cart)*
> Use the balance toward your treatment. Any remaining amount stays on the gift certificate, and you can pay the difference if your treatment costs more.

**"It never expires" is gone from everywhere a client could read it**, and no expiration was added. Evelyn is confirming with a legal source whether a six-month expiration is allowed (California generally doesn't allow expiration dates on gift certificates, with a few exceptions, so it's worth checking before adding one). Removed from:
- the card, the note under the services menu and the FAQ
- the chat: its answers, the balance look-up, and its instructions, which now tell it never to say whether a certificate expires and to offer to ask Evelyn
- the gift email and the server's balance look-up
- the gift ad (the square and story images were redrawn without "No expiry.") and the Instagram and campaign drafts

`node marketing/ads/build-ads.mjs gift` now redraws just one ad concept.

## No koi anywhere (Nov 16)

The koi are gone from everything:
- **Book** sits on the same open water as FAQ and Contact (`img/water/open.webp`), with the moving water light over it and no clip. On phones the heading starts at the top again, without the band left for the fish.
- **The app's lock screen** is the open water too.
- **The link-preview picture** (`img/share.jpg`, what shows when the site is shared in a text or on social media) is now the open water with her logo in near-black. `node scripts/build-share-image.cjs` remakes it.
- **The koi files** are deleted from the site and from `marketing/source/`: `img/water/koi.webp`, `koi.mp4`, `water-koi.png`, `koi-two.mp4`. They're still in the repository's history if they're ever wanted back. The previews no longer use the koi clip.
- **Everything Lumevina's** card pictures are retaken.

## Services: the paragraph under "Your glow, on your schedule" (Nov 16)

Now: "Explore treatments and pricing below. Tap 'Book' to view availability and book through GlossGenius. Any required deposit will be listed with the service. Gift certificates are available in any amount." ("Gift certificates" links to the gift card.) "Through GlossGenius" shows only while the Book buttons open GlossGenius. Once booking moves to the website, the sentence just says "book".

## Shop: no product count (Nov 16)

The "43 products · 43 on the shelf now" line under the shop's search and brands is removed. A hidden copy stays for screen readers, so someone who can't see the page still hears how many products match a search. The search's own "5 products for 'spf'" in its results list is unchanged.

## Shop search on a phone: the keyboard stays up (Nov 16)

Typing in the shop's search on an iPhone showed the results list partly behind the keyboard. Scrolling to reach those results moved the whole page, and in the Claude app (and some others) that closes the keyboard. Now:
- **The search bar moves up under the header** when the keyboard opens, so the results get the room between it and the keyboard.
- **The list ends just above the keyboard** and scrolls inside itself, so every result can be reached.
- **Scrolling the list never moves the page,** even past its end, so the keyboard stays up and the search keeps its text.

## New treatment photos (Nov 16)

Three new photos, in the same warm stone-and-linen style, each on its treatment:
- **Lumevina Custom Facial** (and Custom Facial + Dermaplaning): serum, cream, cryo globes and a brush on a stone tray (`img/services/custom-facial.webp`)
- **ProCell Microchanneling** (and the 4-treatment package): the microchanneling device with serum vials (`img/services/procell.webp`)
- **Ageless Grace Facial:** a bowl of mask with a brush (`img/services/ageless-grace.webp`)

They show on the featured cards in Services, in each treatment's pop-up, in the booking picker and in the app's Book list. The full-size originals are in `marketing/source/service-*.png`. New Clients Start Here keeps the consultation dish for now.

## One move per booking, and the late fee charged by itself (Nov 17)

You asked whether the website can limit rescheduling to once and charge a fee automatically when someone cancels late, since GlossGenius can't. It can, and it's built and tested. **It takes effect when clients book on the website**, because that's where these rules can be enforced. While booking is still on GlossGenius, the website's policy shows the GlossGenius wording and nothing changes.

**The rules, on the website's own booking:**
- **One move.** A client can move an appointment online once, up to 48 hours before (never a Saturday). After that, "Move it" is gone and the page says to reply to the confirmation email, so Evelyn decides. Moving it herself never counts against them. Two quick taps at once can't sneak a second move through.
- **The late fee.** Cancelling inside 48 hours, or cancelling a Saturday appointment, keeps the deposit and charges the **$43 late-cancellation fee to the card on file, by itself**, the moment they confirm. It's the same $43 as before; it was a button Evelyn pressed, now it's automatic.
- **Cancelling 48+ hours ahead** is still free, and the deposit still carries to a new date that month.
- **Once the appointment time has passed,** a client can't cancel online: that's a no-show, which Evelyn charges herself (50% of the service).

**Where clients are told:** a "Cancellation policy" box on the sign-off step (the consent checkbox now names the $43 fee), the payment page (Stripe), the FAQ's "Cancelling & rescheduling", the confirmation and reminder emails, the manage window, and the chat.

**Evelyn's controls:**
- **Refund the fee:** in Appointments, a cancelled booking with a fee has "Refund the $43 fee". It refunds the card, emails the client, and the fee can't be charged again for that booking.
- **If the card can't be charged** (declined, or no card): the cancellation still goes through, Evelyn gets an alert saying so, the client is told she'll be in touch, and her "Charge the $43 fee" button tries again (or she can send a pay link).
- **A switch:** the secret `AUTO_LATE_FEE=off` puts the fee back to her button, with nothing charged automatically.

**To turn it on for real** (not done yet, it needs the server): run the three new lines at the end of `server/schema.sql` in Supabase, then redeploy the `book` and `studio-book` functions. `server/scripts/test-booking-policy.mjs` runs the rules against the real server code (23 checks).

**Things to decide or confirm with Evelyn:**
- A client can still cancel 48+ hours ahead for free and book again, so "one move" limits the Move button, not rebooking. Ending that would mean a fee on every cancellation.
- Charging a card automatically needs the client to have clearly agreed. The box at sign-off, the Stripe payment page and every email now say so. Worth a quick check that a $43 late fee fits California's rules on cancellation fees (they need to be reasonable and disclosed).
- GlossGenius's own policy still can't do either of these, so while clients book there, Evelyn enforces them by hand.

**Also fixed on the way:** Evelyn's Appointments card only turned on for "v3" and skipped "v4" (the full preview); the booking window opened behind its own "too close to move" notice and stayed open after it; Everything Lumevina has a new "Appointments and late fees" link that opens the dashboard in website-booking mode.

## "View all products →" under the shelf (Nov 20)

"On the shelf now" stays. The two lines under its carousel ("The products I use and recommend · Shop medical-grade skincare") are replaced by one link, **View all products →**, which goes down to the shop.

## A simpler Shop section (Nov 20)

The shop now opens with just **Shop all products** and one line, **Free pickup in Woodland Hills · $8 shipping per order**, and the search bar and brand filters sit right underneath.

- **Dropped:** the "01 Shop" label, the intro paragraph, and the 📍 pin.
- **Sold-out items** now say **Request this product** (it still fills in the Contact form with that product, so Evelyn can order it in). The note a client sees when something sells out of their cart uses the same words.
- **On a phone,** the space around the divider between the carousel and the shop is trimmed, so "View all products →" flows straight into the shop. The pickup line is sized to stay on one line on a phone.
- **Section numbers:** with Shop unnumbered, the labels now run **01 to 05** (Book a facial 01, Services & Gift Cards 02, About Evelyn 03, FAQ & Policies 04, Contact 05).

## The consultation card moves down the shop (Nov 20)

The consultation card used to sit between the shop's category tabs and the first product, so the first thing after the search was a booking card. It now sits **below the first group of products** (right after Cleansers), so people meet the products first. It stays in place while someone searches or filters, and the "consultation" link in the top section still jumps to it.

The card is shorter too:

> **Skin consultation**
> Meet with Evelyn online or in person for help building a routine around your skin concerns.
> **Book a consultation · $75**

The "Not sure what your skin needs?" label and the "Personalized Skin Consultation" title are gone from the card (the service itself is still called that on GlossGenius, the menu and the FAQ). The button still opens her GlossGenius page. The chat now says "the consultation card in the shop" rather than "above the shelf".

## It's the cancellation / rescheduling fee, not a "late fee" (Nov 20)

The $43 is now called the **cancellation / rescheduling fee** everywhere it's shown: the website's "Cancelling & rescheduling" policy, the box clients sign at booking, the manage window, My Lumevina, the Stripe payment page, the confirmation and refund emails, the Stripe line on the card statement, the chat and the app sample, and Evelyn's Appointments card and the hub.

The rule reads the same way too: **cancelling or rescheduling within 48 hours** keeps the deposit and charges the $43 (a Saturday appointment can't be moved, so cancelling one is what charges it). Rebooking takes a new deposit.

**How it works today:** inside 48 hours a client can't move an appointment online, so on the website a late change is a cancellation, which charges the fee by itself, and then a new booking with a new deposit. If a client emails Evelyn to move one instead, she handles it by hand: the "Charge the $43 fee" button in Appointments only shows on bookings the client cancelled late, so for a late reschedule she'd charge it from Stripe, or tell me and I'll add a button for it.

The fee's internal names (`late_cancel`, `AUTO_LATE_FEE`) are unchanged so nothing already saved or set up breaks; clients and Evelyn never see them.

## "Ask Evelyn" closes the shop, and Book becomes "Book a facial" (Nov 20)

- **End of the shop:** the two lines under the product grid (shipping and pickup, which already sit at the top of the shop, plus "Not sure what's right for your skin?") are one line: **Need help choosing products? Ask Evelyn →**. It goes to the Contact form.
- **Less air before booking:** the gap between that line and the booking heading is about half what it was (96px instead of 192px on a phone, 132px instead of 240px on a desktop).
- **One heading for booking:** "01 Book a facial" and "Book your next appointment." are replaced by **Book a facial**, with **Appointments at Lumevina in Woodland Hills.** under it.
- **The button comes first** (**View availability & book →**, with "Booking through GlossGenius" under it), then the two instructions: **First visit?** Select "New Clients Start Here." If you're coming in for acne, select "Acne Bootcamp's New Client Consultation + Treatment." **Returning client?** Choose your service and preferred time.
- **"Online booking coming soon" is gone** from the page, since clients can already book online through GlossGenius. When booking moves onto the website, that version keeps a plain "Book a facial" label above "Every opening, at a glance."
- **Section numbers:** Book no longer carries one, so the numbered labels now run **01 Services & Gift Cards, 02 About Evelyn, 03 FAQ & Policies, 04 Contact**.

## Booking is one button on the water, no box (Nov 20)

The big white box is gone. The Book section (while booking runs on GlossGenius) is now just:

> Lumevina Aesthetics Spa
> **Book a facial**
> **[ View services & book → ]**
> First visit? Look for 'New Clients Start Here' or 'Acne Bootcamp' when booking.

"Appointments at Lumevina in Woodland Hills" is replaced by the full name above the heading, and "Booking through GlossGenius" and the returning-client line are dropped. The small first-visit line is there in case new clients pick the wrong service; it's one line to delete if they don't. The section is also a little shorter underneath, since there's less in it. The button still opens her GlossGenius page.

## The four featured treatments are now a scrolling deck, no photos (Nov 20)

The four cards at the top of Services (Ageless Grace Facial, ProCell Microchanneling, Lumevina Custom Facial, Brazilian Wax + Mini Vajacial) no longer have pictures. Each is a text card in its own colour (black, taupe, ivory, stone) showing the name, one line about it, the length and, in a cut-away corner, the price and the **Book** button. As you scroll, the cards are dealt one on top of the next: each rises from below, then settles flat, and the ones underneath lean back and dim. Tapping a card (or its name) still opens the full details with the photo; the photos live there now.

It follows a design from 21st.dev (the "Project Deck" component by Aakash Mehra), redone in plain code because the site doesn't use React; the credit is in the code comments. With "reduce motion" switched on in a phone's settings, or if scripts don't load, the cards simply appear as a plain list, two across on a computer and one on a phone. To change a card's words, price or order, edit `js/services.js` and `scripts/build-services.mjs`, then run `node scripts/build-services.mjs`.

The section's soft background tint now stays behind the heading only (the deck's cut-away corners are the page colour, so the page colour below the heading is flat).

## Pay over time for products and treatments (Nov 20)

She asked for buy now, pay later on products and services. Where it stands:

- **Products and gift certificates:** Stripe's payment page already offers Klarna, Afterpay and Affirm next to card, Apple Pay and Google Pay, once Evelyn switches them on in her Stripe Dashboard (GO-LIVE.md has the step). The cart now says so in one line.
- **Treatments:** in the version where booking stays on GlossGenius, GlossGenius already shows pay-over-time on the services it applies to. In the version where booking is on the website, the visit's pay link (the one Evelyn sends to the client's phone at the end of a visit) now offers it, when the client's card is already on file. Each treatment's details also say "Pay over time with Klarna, Afterpay or Affirm, where your total qualifies."
- **A new FAQ question, "Can I pay over time?"** answers for both versions (and so does the chat, since it reads the FAQ).
- **Where it can't apply, on purpose:** the booking deposit (the website keeps that card on file for the cancellation / rescheduling fee, and these methods can't keep a card) and Glow Membership (a monthly subscription).
- **What to know:** Klarna, Afterpay and Affirm approve the buyer, not us; each has its own smallest and largest order, so small orders may only show card; they typically cost her more per sale than a card does (check Stripe's current pricing). Nothing is live yet: Stripe is in test mode and the server isn't deployed.
- **Switches:** `payLater` in `js/site-config.js` turns the site's lines off; `PAY_LATER=off` on the server hides the methods on Stripe's page. Tests: `scripts/test-booking-policy.mjs` ("Pay over time").

## The shop counts her real inventory (Nov 20)

She sent nine screenshots of her GlossGenius inventory. What changed:

- **Counts:** every quantity on the 42 products already on the site now matches her inventory (25 of them changed). The shop is counting for real (`countStock: true` in `js/site-config.js`): a product at 0 reads "Out of stock" with "Request this product", and one down to a few reads "Only N left". Right now 19 of the 48 shown are at 0, 10 are "Only N left", the rest "In stock". Before launch, keep the dashboard's Inventory in step with GlossGenius (see below).
- **Prices:** every price on her screens already matched the site, except the Barrier Repair Cream: her screen still says $83.20 and the site says $104, the price she set on Nov 11 (kept). The Retinol Peptide Serum's price wasn't visible; the site keeps $60.
- **New on the shop (name, brand, price and count only: no photo, size or label facts yet, so they show as label cards):** Factor Five Eye/Lash Cream $120 (6) and Lash/Brow Growth Serum $79 (3); GlyMed Plus Fulvic Elixir $69 (0), Hydrating Lip Balm $17 (0) and Mega Cream Cleanser $43 (0). Factor Five is a new brand chip.
- **New, held back until she confirms the names (the screenshots cut them off):** KRX All Day Glow Vitamin Ser… $41 (0) and CICA Home Care Sheet Ma… $60 (4); Dermathod Med Shield E… $64 (5) and Priming Peel… $50 (4); SIV Biome Balancing Ser… $79 (3); and two Circadia "Lip Renewing Hydrator -…" at $16 (4 and 3: two lines with the same cut-off name). Clients don't see these.
- **To check with her:** one count was half-hidden behind the + button (Retinol Peptide Serum, read as 4); and the screens may skip a row or two between scrolls (every product already on the site was seen, so nothing from the site is missing).
- **Stock is not shared with GlossGenius.** The site's count and GlossGenius's are separate: if she also sells from GlossGenius, or in person, the site's number has to be corrected in the dashboard (Inventory), or a client can buy something that has just sold. Online orders take stock off the site's count by themselves.

## ProCell: her new menu wording, three treatments (Nov 20)

Evelyn sent new wording and prices for ProCell. In her words, the menu now has:

- **Custom ProCell Microchanneling, $350 per session.** The single session (same id as before), with her new description. She recommends starting with 4 sessions and may plan up to 7.
- **Custom ProCell for Acne Scars (new).** Option 1, $450: one treatment with a customized booster peel and exosome mask. Option 2, $550: the same, plus take-home exosome sheet masks and a recovery kit for all 4 sessions. She recommends starting with 4 and may plan up to 6.
- **ProCell Microchanneling Packages (4 treatments each, both save $300).** Signature + Aftercare, $1,300 (take-home exosome sheet masks and a recovery kit for all 4 sessions) and Deluxe, $1,700 (everything in Signature, plus a customized booster peel and an in-studio recovery treatment at every visit). "Book your full series to save. Ask me about payment plans!" The "next session (package already paid)" option stays for people who have paid.

The old first-10-clients package ($1,100, regularly $1,400) is retired: its id stays in the server's price list so old bookings still read. "Promo pricing is available for a limited time" is gone from the single session, and the first-10-clients line from the chat's ProCell answer and the Instagram post.

**Still to confirm with her:** the times. She gave none, so the new acne-scars treatment is 70 minutes (the same as the single session) and the two packages keep the 60 minutes the old package had. The times only show on the menu and in the calendar once booking runs on the website. Also, her text had a card emoji before "Book your full series"; the site leaves it out.

The menu, the server's price list, the chat's knowledge and the iPhone app sample were regenerated from it (`node scripts/build-services.mjs`).

## Booking on the website now goes in GlossGenius's order (Nov 20)

Evelyn wants clients to move through our booking the way they do on her GlossGenius page. She sent screenshots of it (the service list, "Your service", the day calendar). The on-site booking (the version where booking is here, not on GlossGenius) is now three steps, with the same stepper (services, a day, your details) and the same captions:

1. **Select a service.** A "View All" category menu (Facials, ProCell Microchanneling, Peels, Acne Bootcamp, Consultations, Waxing) and a card for each service: the name in small spaced capitals, "$50.00 deposit required" where there is one, her description, "2 options", "$220+ | 60+ min", the Affirm / Klarna / Afterpay line, and **Select**. (The pay-over-time line follows the `payLater` switch; it gives no "as low as $20 a month" figure, because that number comes from the lenders.)
2. **Your service.** Pick one option ("Select service option · Required"), with the price and time on each, a running **Total** bar at the bottom (the arrow shows what is in the session), and **Select**. Remove is there for a service already chosen.
3. **Select a day.** The calendar, then the times, then **Next**, then "or **Join waitlist**" (it asks for a name and an email right there; a full day shows the same form), then **Details**: the services in the session, with "+ Add another service" (several still book back to back). **Your details** is next: name, email, mobile, then the same sign-off and deposit as before.

A **Book** button on the menu skips to the day with that service chosen; picking a time on the homepage calendar opens at your details with the time held. Moving a booking (the "Reschedule it instead" link, or the link in a client's email) shows just the day and time with no steps, as before. Memberships, flash openings, Glow Points, gift certificates, deposits and the card on file work exactly as they did: only the layout changed.

**What I did not copy:** GlossGenius's dark photo background and rose-gold buttons (the site keeps its own look), and the shopping-bag icon (the "Details" list does that job). **Still to do, if she wants it:** her own screen for editing services (names, options, prices, deposits, hiding one) like GlossGenius's setup, and a client page for managing their booking in the same style. Today the menu lives in `js/services.js` and changes go through the build (`node scripts/build-services.mjs`).

Nothing here has launched: booking on the website is still in the preview, with demo payments.

## Her GlossGenius changes, matched on the menu (Nov 20, 1 pm)

From her screens of the booking page (Ageless Grace Facial, Refresh Peel, Corrective Peel, In-Person and Virtual Consultations), compared line by line with the menu:

- **Corrective Peel is $240 now** (was $230). Its options are named as she has them: Medium Chemical Peel $240 · 60 min, and Medium Chemical Peel + Dermaplaning $270 · 60 min (unchanged).
- **Ageless Grace Facial has a third option:** Ageless Grace Facial + Dermaplaning + Custom Chemical Peel, $310 · 95 min. The other two are as before ($240 · 75 min and $280 · 85 min).
- **Refresh Peel's options use her names:** No Downtime Peel $230 · 10 min, and No Downtime Peel + Dermaplaning $270 · 15 min. Same prices.
- **Both consultations now take a $30 deposit** (was $49): In-Person Consultation, and "Virtual Consultations" (her name). The price is $75 and 45 min, as the site already had. Her description for the virtual one says Mondays only and to reach out first, so it stays "message Evelyn first" on the website.
- **Not changed:** the New Clients Start Here and Custom Facial prices and options (already the same), and the Glow Membership: it covers the Custom Facial ($200) and the Ageless Grace Facial ($240), whose prices did not move. The new Ageless option with a peel is not covered by a membership facial (like the dermaplaning option, it is paid at full price).
- **The chat** follows: the deposit answer says $30 for a consultation, and the peel answers use the live prices ($230 and $240).

If she changed anything else on her page, send its screen and I'll match it.

## Her waxing page, matched; the Services deck runs smoother (Nov 23)

**Waxing, from her GlossGenius screens.** Every price, time and deposit already matched (Brazilian $75, Wax Wednesday $65, Bikini Line $40, Brazilian + Mini Vajacial $95, Underarm $20, Full Stomach $35, Full Butt $40 with a $20 deposit, Nostril $10, Upper Lip $10, Full Arm and Full Back $60, Half Arm and Half Back $30). What changed:
- **Her own descriptions** for 12 services (the menu had a short paraphrase). They show in each service's details and on the booking cards; the menu list keeps the short line.
- **Her names:** "Inner Thigh Add On" and "Stomach Strip Add On" (no hyphen), and the brow card is "Brow Wax + Tweeze", as on her page.
- **The "+" on options, as on GlossGenius:** any service with options shows "$25+ | 30+ min", even when the options take the same time (her Custom Facial shows "60+ min" with two 60-minute options).
- **Pay over time shows from $50 up**, as on her page (the $40 Bikini Line and Full Butt don't carry it; the Brazilian, Wax Wednesday, Mini Vajacial, Full Arm and Full Back do). It was on every priced service before.
- **Booking order for waxing is hers:** one list, in her order, without the menu's sub-headings. The two add-ons still appear only once another service is chosen.
- **Not changed:** the ProCell menu stays as Evelyn wrote it; none of these screens touch it. **To check:** her Brow Wax + Tweeze card says "30+ min", which on her page just means "has options"; I kept both options at 30 minutes, as the earlier screens had them.

**The deck, smoother (phone and desktop).** What I changed: nothing is measured while you scroll (the page is measured once, and again when it changes size or a scroll starts), and a frame writes only what changed; the cards at rest carry no blur at all (the edges of the stacked cards are sharp now) and the arriving card blurs less on a phone; the shadow is a plain shadow instead of a filter that was redrawn every frame; the dim is its own layer; and on a phone the cards follow your finger exactly (no extra smoothing), while a mouse or trackpad gets a snappier spring. **Honest note:** I could not time this on a real phone from here; in a throttled test browser (no graphics chip) the slow frames dropped from about 8 to about 4 in a 75-frame scroll, but that test is noisy.

## iPhone: the Services cards no longer lag (Nov 23)

"Still laggy on iPhone." Three causes, all fixed:
1. **Scrolling the cards with a script.** A phone scrolls on its own thread; a script that moves the cards in step with it always trails the finger. On a phone (any touch screen, or a narrow window) the four cards are now a plain **sticky stack**: each card sticks a little lower than the one before and the next slides over it, done entirely by the browser, with no script, no blur and no 3D. A mouse or trackpad on a computer keeps the dealt, tilting version.
2. **Blur behind the header and the chat button.** The glass blur on the header and the Ask Lumevina button was redrawn on every frame the cards moved under them. On a touch screen they are plain, nearly solid now (same colour, less see-through).
3. **A hidden animation running all the time.** The glowing borders on six buttons were being recalculated 60 times a second, even for buttons far off screen. They now animate only while on screen (and at 30 frames a second on a phone), and stop completely when none is visible.

I can't test on a real iPhone from here, so this is based on what is known to be slow in iPhone's Safari; if it still stutters somewhere, tell me where (which section, scrolling up or down) and I'll go after that exact spot.

## Shop: steadier when you scroll down fast on a phone (Nov 23)

The shop's category bar (Cleansers, Toners & mists…) was flipping between hidden and shown on every little jolt of a fast scroll, repainting a huge full-width shadow each frame, and reading the page layout on every frame; the cards below were all drawn even when far off screen. Now: it hides only after a real stretch of scrolling down and returns after a real stretch back up, its full-width band is a plain layer, it no longer reads layout per frame, and cards off screen aren't drawn until you near them.

## The First 90 Days now starts tomorrow, launch day (Nov 23)

The plan is dated: **day 1 is launch day, Tuesday, November 24, 2026; day 90 is Sunday, February 21, 2027.** The setup weeks are gone (that work is done), so launch is week 1: the site, live payments, booking on Lumevina and the Glow Membership open together, with a text and email to every client, an Instagram post, and the Founding Five. The first Saturday scoreboard is November 28. Every stretch carries its dates (week 2: Dec 1–7, the Founding Five fills; weeks 3–6: Dec 8 – Jan 4, with holiday gift certificates; weeks 7–9: Jan 5–25; weeks 10–13: Jan 26 – Feb 21, win-back, referrals and Valentine's), and so do the talent search, the scoreboard targets and the chart.

The member curve keeps the same weekly pace as before, only three weeks sooner (selling starts on day 1 instead of week 4): 15 members, where Lumevina pays for itself, around week 7 (Jan 11), and the day-90 goal of 20 reached with room. These are the plan's estimates, not results.

## Nov 23, 2026: booking and sign-in get the soft-gradient look
- Signing in now asks one thing at a time (email, then name) on a soft taupe-and-blush background, with a round arrow to continue. Still a one-tap email link, no passwords.
- Booking uses the same look: a serif headline for each step, glass cards and option rows, dark pill buttons with an arrow, and each step fading in as you move between services, the day and your details. How booking works hasn't changed.

## Nov 24, 2026: product names on the homepage shelf
The "On the shelf now" cards on the homepage showed only a photo, price and Add: the name and size were hidden, and the cards had a blank gap. Each card now says what it is (name, two lines at most, and its size).
