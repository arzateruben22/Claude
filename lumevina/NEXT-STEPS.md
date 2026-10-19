# Lumevina v2: where things stand (Oct 19, 2026)

Read this and EVELYN-NOTES.md (her requests and questionnaire answers) before changing anything.

## Ground rules

- Work on branch `claude/landing-page-redesign-payments-mqp9sd`. Commit and push there only; no pull requests.
- The repo root is a different client's site (Taqueria Los Güeros). Lumevina lives in `lumevina/`.
- Never ask Evelyn about rent, monthly costs or personal finances.
- Product copy (descriptions, claims, directions) comes from Evelyn or the brand's approved text. Don't invent it. Label text from her product photos is fine.
- Card payments stay in test mode (4242) until Stripe is connected.
- Test in Playwright at phone (390) and desktop (1280) widths before committing.

## Links

- New website preview (v2): https://claude.ai/artifact/Tj4xhnVKZrw3ouTcsRnrtG
- First version (v1, unchanged): https://claude.ai/artifact/CtwjWKBV65jNfhM1qxYKP5
- Evelyn's questionnaire: https://claude.ai/artifact/YChu6itk5K1NpWfrQdF5Ak
- Her GlossGenius booking page: https://lumevina.glossgenius.com/

## How the site is built now

| File | What it does |
|---|---|
| `js/site-config.js` | The switches: held-back features (membership, rewards, routine, school, partners) and booking mode (`glossgenius` now). |
| `js/catalog.js` | Her 43 products from the product guide, with label names, sizes, label text and photos. |
| `js/inventory.js` | Stock, prices and draft confirmations laid over the catalog (localStorage now). |
| `js/shop.js` | The hero's "On the shelf now", the shop in routine sections, the product detail panel. |
| `js/cart.js` | Cart and checkout; takes stock off on a paid order; photos in the cart. |
| `js/booking.js`, `js/book-section.js`, `js/hours.js` | The site's own booking calendar, built but switched off while booking stays on GlossGenius. |
| `js/contact.js` | The "Reach out" form; questions land in the dashboard's Client questions. |

The look: warm beige, white and classic black (tokens at the top of `css/styles.css`).

## Still to do, in order

0. **Shop toolbar (in progress):** the new toolbar (search with an "In stock only" switch, brands as text tabs) and the sticky Expandable Tabs type navigator are built and styled but not yet tested. Test at 390 and 1440 widths: the navigator sticks under the header, the section on screen opens its tab, tapping a tab jumps there, brand tabs filter. Fix what's off, then update the v2 preview link.
1. **Product detail panel:** size buttons for products sold in two sizes (Moisture Balance Toner, Ultra Gentle Gel Cleanser), then short optional sections: description, "Good for" tags, how to use, key ingredients, Evelyn's tip. No ratings or reviews.
2. ~~**Checkout:** the cart's + button can exceed the shelf count; a returning buyer who types their email doesn't get their last address filled in.~~ Done Oct 19: the cart stops at the shelf count and a returning buyer's address fills in from their email.
3. **Photos (first priority, Oct 19):** 22 products still show their label card instead of a photo. They were all sent once while Claude was mid-task, so they arrived as pictures and never saved as files; send them again as a new message while Claude is idle, five or so at a time, and they'll be matched to products by name as before. Missing, Face Reality (19): 8% L-Mandelic Serum, Antioxidant Peptide Eye Gel, Barrier Balance Creamy Cleanser, Barrier Care Gel Cream, Brilliant Defense SPF 50, Clear Skin Balance, Cran-Peptide Cream, Ultra Gentle Gel Cleanser (6 fl oz) and its 2 fl oz travel size, GlowTone Corrective Serum, HydraBalance Gel, HydraRemedy Gel Serum, HydraCalm Mask, invisiClear Hydrocolloid Spot Patches, L-Mandelic Face and Body Wash, Retinal B3 Serum, Retinol Peptide Serum, Soothing Radiance Toner, Sulfur Spot Treatment. Mixi Skincare (3): Mineral SPF 50, Hydroxi, Dew Drop. Until a photo lands, the card shows a brand-tinted label with the product name (not a broken image), so the shop still looks finished. `node -e 'window={};require("./js/catalog.js");window.LUMEVINA_CATALOG.products.filter(p=>!p.photo).forEach(p=>console.log(p.brand,"|",p.name))'` prints the current list.
4. **Ask Lumevina chat:** automatic answers for aftercare and product questions from the catalog; drop membership, rewards and Skin School answers while those are held back; booking questions go to GlossGenius.
5. **Dashboard on her phone:** daily jobs first (orders to ship, client questions, low stock); the Inventory card should use the real catalog.
6. **Launch plan:** Stripe, Supabase (shared stock, orders, saved addresses), text and email alerts, domain, and how stock stays in sync with her GlossGenius in-person sales (GlossGenius has no public API).
7. **Privacy page and the preview hub** to match the new look.
8. **Ask Lumevina, live:** `knowledge/README.md` has the flow. Once Evelyn's playbook answers are in: export the `playbook` collection from https://claude.ai/artifact/R1pRrnH79BwaUoBZexefVQ, run import-playbook.mjs and build-bundle.mjs, deploy `server/functions/ask`, set `ask.endpoint` and `ask.key` in js/site-config.js, then run the eval live (`node knowledge/eval/run-eval.mjs --live`).
9. **A voice assistant in her voice:** later. Needs her consent, her voice memos from the playbook, a voice provider, and the real website on its own domain (the microphone doesn't work inside the preview viewer).

## Still to confirm with Evelyn

- The invisiClear patches price ($10, partly cut off in her screenshot).
- How many Retinal B3 Serums she has.
- The $83.20 Barrier Repair Cream price (the 4 fl oz Elite tube).
- Shipping: her inventory has a $6.00 shipping fee; the site charges $8, free over $75.
- The policies say cash is preferred, but she didn't pick cash in her answers.
- Which products need a consultation before purchase.

## Republishing the preview

The preview is the homepage with its `<head>` folded into the page body: drop the charset and viewport tags, set the title to "Lumevina v2", and keep everything else. Publish it with `root` set to a folder holding `css/`, `js/`, `img/`, `fonts/` and `manifest.webmanifest`, to the same v2 link. Only changed files need sending on an update.
