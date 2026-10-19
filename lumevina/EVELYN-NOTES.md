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

Ruben's first priority (Oct 19): every product gets its photo. Seen in chat but not received as files, so they need sending again as a new message (label details already added; the photos go up once the files arrive): 8% L-Mandelic Serum, Antioxidant Peptide Eye Gel, Barrier Balance Creamy Cleanser, Barrier Care Gel Cream, Brilliant Defense SPF 50, Clear Skin Balance, Cran-Peptide Cream, Daily SPF 30 Plus (new shot), Ultra Gentle Gel Cleanser, GlowTone Corrective Serum, HydraBalance Gel, HydraRemedy Gel Serum, HydraCalm Mask, invisiClear Spot Patches, L-Mandelic Face and Body Wash, Retinal B3 Serum, Retinol Peptide Serum, Soothing Radiance Toner, Sulfur Spot Treatment, Ultra Gentle Gel Cleanser (6 fl oz and 2 fl oz), and the three Mixi Skincare products (Mineral SPF 50, Hydroxi, Dew Drop).

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
- **The opening logo animation** was checked on a fresh visit: the black logo loads, the words play, the intro clears, and the headline animates in.

## The Skin Playbook (Oct 19)

- The questionnaire the assistant learns from: https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ. Six sections, 120 questions plus optional notes per product. It saves each section as she types, so she can leave and come back; for the saving to reach us, invite her email from the page's Share menu with Contributor access or higher and no public link. "Copy all my answers" is the backup.
- **Speaking her answers:** the mic key on her phone keyboard dictates into any box. The page can't open the microphone itself inside the preview viewer.
- **Voice memos:** each item has "Add a recording" for a voice memo from her phone's recorder (.m4a works). They stay with her answers for a later voice assistant in her own voice. That needs her consent, a voice provider, and the real website, where the microphone works.
