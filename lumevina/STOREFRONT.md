# Selling past the client list: the storefront plan

**The short version.** Her website already is the storefront. It has a real checkout (Stripe, with sales tax, shipping or pickup, stock, order emails, a dashboard that tracks every order) and product feeds for Google and Meta. Shopify would be a second copy of the same shop for $39 a month. TikTok Shop and Amazon are marketplaces, and the professional brands she carries generally don't allow their products on marketplaces. So the plan is: make the website shop fully public and fully compliant, add a ten-minute virtual consult so a stranger in Ohio can become a client without a visit, then send TikTok, Instagram and Google traffic to it. TikTok Shop comes only for products a brand approves in writing, or for her own items.

Three things need her yes before anything sells to the public, and they are the first step below.

---

## Step 0 · Ask the brands (today, three emails)

Face Reality, GlyMed Plus, Mixi Skincare and Circadia are professional lines: they sell wholesale to licensed professionals who retail to their clients. Each has its own rules about websites, marketplaces and pricing, and none publishes the full rules; her wholesale agreement and her rep do. What we found in public:

| Brand | Products on her shelf | What's public | What to ask |
|---|---|---|---|
| Face Reality | 30 | Sells only to licensed US professionals; products are "to retail to their clients for their home care"; Acne Experts get wholesale tiers, product credits and direct-to-client shipping. Nothing public on marketplaces or minimum prices. | "May I sell on my own website to the public? Which products need a consult first (Acne Med, the higher mandelic strengths)? Is there a minimum advertised price? May I list on Instagram Shop or TikTok Shop with checkout on my site, or TikTok Shop itself?" |
| GlyMed Plus | 9 | Professional-only line; "authorized online retailer" status exists. | "Please approve my website as an authorized online retailer. Any marketplace rules? Minimum advertised price?" |
| Mixi Skincare | 3 | Nothing public. | Same questions. |
| Circadia | 1 | Its distributor says partners sign that they will not sell through an online cart or on Amazon or eBay. | Ask for written permission, or keep Circadia off the public shop (studio only). |

Send the emails from her address. The replies go into this file under "Brand answers" at the bottom, and the shop is set to match them. Until a brand answers, that brand's products stay as they are now: buyable by anyone who visits, which is the current state of the site, with the actives gated behind a consult (Step 2).

Ready-to-send text:

> Subject: Selling [brand] on my website · Lumevina, Woodland Hills
>
> Hi [rep], I'm Evelyn Romero (account [number]), licensed esthetician and [Certified Acne Expert / authorized professional] in Woodland Hills, CA. I'm opening the shop on my website, lumevina.com, to the public, with checkout and shipping handled on my own site and a consultation before anyone buys the actives. Three questions so I stay inside the agreement: (1) Is selling on my own website to people who aren't yet my clients allowed, and which products need a consult first? (2) Is there a minimum advertised or minimum selling price I should hold? (3) Are Instagram Shop and TikTok Shop allowed, either with checkout on my site or in the app? Thank you. Evelyn

## Step 1 · Paperwork (one afternoon)

1. **California seller's permit** (CDTFA, free, online). Required for selling goods in California; she likely has one already if she retails in the studio. If she does, nothing to do. Stripe Tax computes the sales tax at checkout; the permit is what lets her file and pay it. Los Angeles's combined rate is about 9.75% today and rises on October 1, 2026; Stripe keeps the rate current.
2. **City of Los Angeles Business Tax Registration Certificate.** Woodland Hills is in the City of LA. She probably has this for the studio; confirm it covers retail.
3. **Stripe, live, in her name** (GO-LIVE.md section 2), with Stripe Tax switched on and her bank account connected.
4. **A shipping account**: USPS Ground Advantage through Pirate Ship or Stripe's shipping partner; a stack of the small flat boxes and bubble mailers. Cosmetics ship by ground without paperwork; nothing on her shelf is an aerosol.
5. **Insurance**: ask her esthetician liability carrier to confirm product sales are covered (most policies include "products-completed operations"; the call takes ten minutes).
6. **Policies on the site**: shipping (ships from Woodland Hills, USPS Ground Advantage 2 to 5 days, free over $75, free pickup at the studio), returns (unopened within 14 days, opened products are not returnable, damaged in transit replaced), privacy (exists). Claude writes these pages; she reads them once.
7. **Labeling and FDA**: the brands own the labels and the registrations; a retailer has nothing to file. Benzoyl peroxide products are over-the-counter drugs and sell retail normally.

## Step 2 · The shop, public and compliant (Claude builds, two to three days)

1. **A consult gate on the actives.** Benzoyl peroxide (Acne Med), the 11% and 15% mandelic serums, retinol and any brand-flagged product get a "Needs a quick consult" badge. Tapping it opens the intake she already has (skin type, concerns, routine, photos in daylight). Evelyn gets a push notification, approves in the dashboard with one tap, and the product unlocks in that client's cart. Everything else (cleansers, toners, moisturizers, SPF, masks, supplements) buys straight away. This mirrors the way Face Reality itself sells: on a professional's recommendation.
2. **The virtual consult as a product.** "Skin Consult, online · 15 minutes · $35, credited to your first order." Booked from the shop and the Skin School, done on a video call or through the intake plus a voice note, ends with a routine built on her shelf and the gate opened. This is how someone outside Los Angeles becomes a client; it is also the compliant way to sell them an active.
3. **Product pages from the labels.** Every description is the label's own line, the size, the ingredient list the brand publishes, and her note where she has written one in the Skin Playbook. No claims beyond the label.
4. **Prices at the brand's retail price.** Never under it in a listing or an ad; the welcome code applies at checkout only where the brand allows discounting.
5. **Shipping and pickup at checkout** (exists), order emails with tracking (exists), low stock in the dashboard's Today card (exists).
6. **Buy again in one tap** for signed-in clients, and the "running low" message that already goes out at the right week.

## Step 3 · Get found (weeks two and three)

1. **Google**: Merchant Center with the feed the site already produces (`feed/google.xml`), free listings first, then Shopping ads; Google Business Profile products (free).
2. **Instagram and Facebook**: Commerce Manager with `feed/meta.csv`, checkout on the website (allowed for every brand, since the sale happens on her site); product tags on posts and Reels.
3. **TikTok, the audience**: a business account, the shop link in bio, three posts a week: the Skin School explainer clips (`marketing/ads/out/video/`, 9:16, captioned), her face explaining one thing, a product on the shelf with the label's line. Comments answered by her or by the chat's drafts.
4. **TikTok ads with checkout on the site**: TikTok's catalog takes the same feed; Video Shopping Ads link to the product page on lumevina.com. No marketplace, no brand conflict.
5. **Local first** (MARKETING.md): the 15-mile radius around Woodland Hills gets the ads first, because a local buyer can also book a facial and pick up free.

## Step 4 · TikTok Shop and Shopify, only if

- **TikTok Shop** makes sense when a brand says yes in writing, or for her own items (the Skin School kit, classes, gift cards). Requirements: a US business or sole proprietor with EIN or SSN, government ID, a US bank account, and for cosmetics the ingredient lists and labels; roughly a 6% fee per order (3% in the first month); approval in one to five days; ship within three business days. Open it as a second channel, same stock, same prices.
- **Shopify** only if she wants TikTok Shop and Instagram in-app checkout synced automatically; it would mirror the catalog for $39 a month plus 2.9% and 30 cents a card. Everything else Shopify does, the site already does. Recommendation: skip it for now, revisit when online orders pass fifty a month.
- **Amazon, eBay, Walmart, Poshmark**: no. Pro brands treat marketplace listings as diversion and close accounts over it.

## Step 5 · Numbers to run it by

| Line | Figure |
|---|---|
| Her cost on pro lines | about half of retail (her exact costs are in the dashboard's Inventory) |
| Shipping a small box in California | $5 to $9; free shipping starts at $75 so the box is covered by margin |
| Online consult | $35, credited to the first order, so it costs the client nothing if they buy |
| Ad budget to start | $10 a day, local first |
| First-month goal | 10 online orders from people who have never visited, 5 online consults |
| Judge it at | 90 days, like a routine |

## The 30 days

| Days | Who | What |
|---|---|---|
| 1 | Evelyn | Three brand emails; confirm seller's permit and LA business certificate |
| 1 to 3 | Claude | Consult gate, online consult product, policy pages, label copy |
| 4 to 5 | Evelyn | Stripe live and Stripe Tax on (GO-LIVE.md), shipping account, boxes |
| 6 to 7 | Both | Test orders with the test card, one real $1 order, one refund |
| 8 | Evelyn | Shop public; Claude submits the feeds to Google and Meta |
| 8 to 14 | Evelyn | TikTok business account; first three posts from the explainer clips |
| 15 to 21 | Claude | TikTok catalog and first Video Shopping Ad; local radius |
| 22 to 30 | Both | Read the dashboard: orders, consults, which post sent them; adjust |
| When brands reply | Both | Open TikTok Shop for whatever was approved; keep the rest website-only |

## Brand answers

_(paste the replies here, with the date)_

- Face Reality:
- GlyMed Plus:
- Mixi Skincare:
- Circadia:

---

Sources checked on October 21, 2026: Face Reality's retail page and Expert Extras page (wholesale to licensed US professionals, "retail to their clients", direct-to-client shipping tiers); California Skincare Supply on Circadia's no-online-cart rule; TikTok Shop seller guides (US entity, ID, bank, cosmetics documentation, about 6% per order); CDTFA guidance on the seller's permit. None of the brands publishes its full reseller terms; the agreement she signed and her rep are the authority, which is why Step 0 comes first.
