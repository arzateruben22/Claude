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
3. ~~**Photos:**~~ Done Oct 19: all 43 products show a photo (`img/products/`, named after the product). Only the Mixi Dew Drop shot is small (280 px, upscaled to 800); swap it if Evelyn has a bigger one. A product without a photo falls back to a brand-tinted label card, so a new product never shows a broken image. Photos only save as files when they're sent as a fresh message while Claude is idle; a batch sent mid-task arrives as pictures only.
3a. **Her menu (Oct 19):** every service, price, time and deposit lives in `js/services.js` (copied from her GlossGenius page; `GLOSSGENIUS-SERVICES.md` has her full descriptions). After changing it, run `node scripts/build-services.mjs` (menu, gift choices, server catalog), then `node knowledge/scripts/build-bundle.mjs`. Open questions are at the end of EVELYN-NOTES.md.
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

The preview is one self-contained page: run `node knowledge/scripts/build-bundle.mjs`, then `node scripts/build-single-file.mjs` (→ `dist/lumevina.html`, with the chat's knowledge inside). Fold its `<head>` into the page body (our own `<title>`, no outer skeleton; the v3 preview also switches `version` to `"v3"`) and publish it to the same link with `capabilities: {"sample": {}}`, so the chat can answer with Claude on the viewer's own account.
