# Marketing: getting Lumevina in front of LA and Orange County

How Evelyn gets shop customers and new facial clients without selling anyone face to face, what Claude does on its own, and what needs her (an ad account, a card, a yes). Local first: the whole point of her shelf is that it's ten minutes from the client, picked up at a facial or shipped the same week.

## The three answers

**Etsy, or any marketplace: no.** Etsy allows only handmade, vintage and craft supplies; reselling retail skincare is against its rules and the listing gets removed. The bigger reason: Face Reality and GlyMed Plus are professional lines sold through licensed estheticians, and their reseller agreements (check hers) generally forbid selling on third-party marketplaces (Etsy, Amazon, eBay, Walmart) and advertising below their minimum advertised price. A marketplace listing can end her account with the brand. Her own website is the storefront. What we push is traffic to it, and the one marketplace-like channel that *is* her store is Google Shopping's free listings (below), which link to her site.

**Selling at a loss: no need, and not allowed.** Professional skincare retails at roughly double wholesale (she should confirm her own numbers), so she earns at the shelf price. The brands' minimum advertised price rules mean the shelf price can't be advertised lower anyway. The lever for a first order is a perk, not a cheaper shelf: free pickup at the studio, 100 Glow Points on a first booking, and a welcome code (WELCOME10, first purchase only, at checkout, not in the ad). Clients who come for a $220 facial and leave with $90 of products are the business; a $5 loss on a cleanser isn't.

**"Bots that run ads": partly.** Nothing legitimate places ads without an ad account in her name, a card on it and her approval of every campaign; Meta and Google both require it, and skincare is a watched category (no medical claims, no before/after promises, no "do you suffer from…" targeting). What Claude does without her: builds the product feeds, the creatives, the copy and the campaigns (this folder), drafts every week's posts and ad variants on a schedule, and reviews results she pastes in. What becomes possible once her Meta and Google ad accounts exist: connecting them to Claude so it reads performance and adjusts budgets and audiences on a weekly schedule, with her approving changes above a threshold. That's step two; step one is below.

## Where the customers are (in this order)

| Channel | Cost | What it does | Claude's part |
|---|---|---|---|
| **Her existing clients** | $0 | The GlossGenius import + Invite (dashboard → Clients) tells everyone she already has that the shelf is online and pickup is free at their visit. Word of mouth starts here. | The email is written; she taps Invite. |
| **Google Business Profile** | $0 | "Esthetician near me" and "facial Woodland Hills": the map listing, with products, posts, hours, booking link, reviews. The highest-intent local traffic there is. | `marketing/local-listings.md`: the profile copy, product entries, weekly posts. The review request after visits already runs. |
| **Google Shopping free listings** | $0 | Her products show in Google's Shopping tab and on Maps when someone searches the product name, linking to her site. Allowed: it's her own store. | `scripts/build-feed.mjs` → the feed Merchant Center reads. |
| **Instagram + Facebook Shop** | $0 | Products tagged in posts and stories, checkout on her website. | The same feed, Meta format; the 30-day post calendar in her voice. |
| **Meta ads, local** | from $10/day | Instagram and Facebook, 25 miles around Woodland Hills first, then OC. Two campaigns: the shelf (pickup at your facial) and the first facial. | `marketing/campaigns.md`: audiences, budgets, copy; `marketing/ads/` creatives. |
| **Google Search ads, local** | from $10/day | "facial near me", "acne facial Woodland Hills", "Brazilian wax Woodland Hills", the product names. | Keywords, negatives and ad text in `marketing/campaigns.md`. |
| **Nextdoor + Yelp** | $0 to small | Neighborhood trust; a Nextdoor business page and posts; Yelp's free profile with the booking link. | Copy in `marketing/local-listings.md`. |

Shipping outside the area is fine and happens by itself; it's the *ads* that stay local, because a local client is worth a facial, a membership and a shelf, and the shipping cost is zero when they pick up.

## The local radius

Phase 1 (first 4 weeks): 20 miles around Woodland Hills: the San Fernando Valley, Calabasas, Agoura, the Westside, Pasadena. Phase 2: Los Angeles County. Phase 3: Orange County, once she has a reason to drive there (a client base, or a second pickup point). Each phase keeps its own campaign so the numbers stay readable.

## What's in this folder

| Path | What |
|---|---|
| `marketing/campaigns.md` | Meta and Google campaigns: objectives, audiences, geo, budgets, ad copy within each platform's limits, UTM links, the rules for skincare ads. |
| `marketing/local-listings.md` | Google Business Profile, Nextdoor, Yelp: profile copy, product entries, posts. |
| `marketing/welcome-offer.md` | The first-order perk: WELCOME10 at checkout (set up in Stripe), pickup, Glow Points. |
| `marketing/instagram-30-days.md` | Thirty posts and stories in her voice, local, no claims she hasn't made. |
| `marketing/ads/build-ads.mjs` | Makes the creatives (`marketing/ads/out/*.png`): six concepts, square and story. |
| `scripts/build-feed.mjs` | Makes `feed/google.xml` and `feed/meta.csv` from the catalog, for Merchant Center and the Meta catalog. |
| `marketing/weekly/` | What Claude drafts each Monday: the week's posts, two ad variants, and a review of any numbers she pasted into `marketing/results/`. |

## Rules every ad and post follows

- Only claims she has made or the label makes. "Exfoliates and brightens" (label), "give it 90 days" (hers); never "cures acne", "erases wrinkles", "medical-grade".
- No before/after photos in ads (Meta disapproves them for skincare; they also promise results).
- No "you" plus a condition ("struggling with acne?") in ad text; Meta's personal-attributes rule. "Breakouts? Start a plan" is fine; "Do you have acne?" is not.
- Prices only at or above the shelf price; the welcome code lives at checkout, not in the ad.
- Every link carries UTM tags so the dashboard can tell where a client came from.
- Her face and studio sell better than any stock photo; product photos are the fallback.

## What Claude does every week (the scheduled task)

Every Monday morning a scheduled task drafts the week into `marketing/weekly/<date>.md`: five posts in her voice, two ad variants for the running campaign, and, if `marketing/results/` has a new export, a short read of what worked and what to change. It pushes the draft to the branch and sends Ruben a notification. Nothing is posted or spent by it.

## Video: twelve Skin School explainers, cut for Reels and TikTok

`marketing/ads/out/video/` holds the 9:16 cut (720×1280, H.264, silent, captioned) of each Skin School explainer: skin layers, the barrier, sunscreen amount, the retinoid ramp, the order of steps, what not to mix, purging vs. a breakout, the 90-day acne calendar, a bottle turned around (the front is marketing, the first five ingredients, the 1% line, the star after the fragrance), three faces with three kinds of dark spots (scattered sun spots, marks where breakouts were, the mirrored patches of melasma, and the red marks that are vessels, not pigment), the anti-aging short list with a two-lane race (gentle every night against strong once a week), the week before a facial as a nine-day calendar with the pauses marked, a ruler where the hair grows to a quarter inch before a wax (two timing cards, three rules), four faces with their oil and the one-hour bare-face test, the first day after a treatment (four things kept off, three allowed) and the week strip with the actives-off and flaking days marked, plus nine in three dimensions in the style of the viral code-rendered clips: inside a pore as it clogs and clears, ninety nights as a domino chain with four skipped nights and a restart, the sun's rays reaching the dermis until the SPF shield goes on, thins, and is reapplied, a tired barrier: bricks on glowing mortar, worn by a scrub, hot water and one active too many, then sealed again by subtraction, a dark spot made at the bottom of the epidermis, carried out a month at a time, guarded by the shield and sped up by the brighteners, a moisturizer taken apart: humectants pulling water up, emollients filling the seams, the occlusive film on top, a double cleanse: the day's film and grit, the balm that melts it, the lukewarm rinse, sixty seconds of foam, the acid dose: a fifth of the dead-cell plates shed twice a week, all of them and a plastic shine every night, then two weeks of rest, and vitamin C in the morning: free radicals chipping at collagen, most bounced by the sunscreen, the rest fizzling at the amber glow, and a vial going from straw to brown over twelve weeks. The TikTok order to post them: the pore first (skin science travels), then dominoes, then the flat explainers one a week. They are rendered from code in `docs/school/motion/` (see the README there), so a wording change re-renders in a minute and every frame is reproducible. Post them as Reels with the lesson's caption as the first line and "Skin School, free lesson on the site" as the call to action; the welcome code stays at checkout. They carry no claims beyond the general layer and her own words.
