# Campaigns: Meta and Google, local first

Everything here is ready to paste into Ads Manager and Google Ads. Budgets are starting points; the rules at the end of MARKETING.md apply to every line. Replace `https://lumevina.com` with her real domain once it exists.

## Links (with UTM tags, so the dashboard can tell where people came from)

| Use | Link |
|---|---|
| Shop, Meta | `https://lumevina.com/?utm_source=meta&utm_medium=paid&utm_campaign=local-shelf#shop` |
| First facial, Meta | `https://lumevina.com/?utm_source=meta&utm_medium=paid&utm_campaign=local-first-facial#book` |
| Acne Bootcamp, Meta | `https://lumevina.com/?utm_source=meta&utm_medium=paid&utm_campaign=local-acne#book` |
| Wax Wednesday, Meta | `https://lumevina.com/?utm_source=meta&utm_medium=paid&utm_campaign=local-wax#book` |
| Gift certificate, Meta | `https://lumevina.com/?utm_source=meta&utm_medium=paid&utm_campaign=gift#gift` |
| Google Search, facials | `https://lumevina.com/?utm_source=google&utm_medium=cpc&utm_campaign=search-facial#book` |
| Google Search, products | `https://lumevina.com/?utm_source=google&utm_medium=cpc&utm_campaign=search-shop#shop` |
| Google Business Profile | `https://lumevina.com/?utm_source=google&utm_medium=organic&utm_campaign=gbp` |
| Instagram bio | `https://lumevina.com/?utm_source=instagram&utm_medium=bio` |

## Meta (Instagram + Facebook)

**Account setup, once:** Meta Business Suite → an ad account in her name with her card → connect the Instagram account → Commerce Manager catalog from `feed/meta.csv` (so products can be tagged) → the Meta pixel on the website (one line in `index.html` once she has the pixel id; Ruben adds it).

**Geo, phase 1:** a 20-mile radius around Woodland Hills, CA. Phase 2: Los Angeles County. Phase 3: Orange County (its own campaign).

**Placements:** Instagram feed, Stories, Reels; Facebook feed. Turn off Audience Network.

### Campaign 1: the shelf, local pickup
- Objective: Sales (website purchases) once the pixel has 50 purchases; until then, Traffic to `#shop`.
- Budget: $10/day. Audience: women and men 22–55, radius above, interests: skincare, facials, esthetician, Face Reality, GlyMed, "clean beauty"; plus a lookalike of her client list once it's uploaded (Customers → export from the dashboard).
- Creatives: `pickup-square`, `pickup-story`, `shelf-square`, `shelf-story`.
- Primary text (3 variants; keep under 125 characters where it shows above the fold):
  1. The skincare from Evelyn's treatment room, now online. Pick it up free at your facial in Woodland Hills, or we ship.
  2. Face Reality, GlyMed Plus, Mixi, Circadia: the professional shelf, for home. Free pickup at the studio. $8 shipping, free over $75.
  3. Running low on your cleanser? Reorder from Evelyn's shelf and collect it at your next visit.
- Headline (40 chars): "Her shelf, online" · "Free pickup in Woodland Hills" · "Professional skincare, for home"
- Description: "Lumevina Aesthetics Spa · Woodland Hills" · Call to action: Shop Now.

### Campaign 2: the first facial
- Objective: Leads/Traffic to `#book`; later, Sales with the booking confirmation as the event.
- Budget: $10/day. Audience as above, 25–55, add interests: spa, facial, self-care, wedding (for event glow), exclude current clients (customer list).
- Creatives: `first-facial-square/story`, `acne-square/story` (as its own ad set so the numbers stay separate), `wax-square/story` (its own ad set, Wednesday-heavy schedule).
- Primary text:
  1. New here? Start with a facial: a consultation, a look at what you use now, and a fully customized facial, one on one with Evelyn. 60 minutes, $220, Woodland Hills.
  2. (acne) Breakouts? Start a plan, not a product. A consultation and treatment, a home routine Evelyn adjusts with you, and a visit every few weeks. Give it 90 days.
  3. (wax) Wax Wednesday: a Brazilian is $65 on Wednesdays. Hard wax, one on one, 40 minutes, free parking.
- Headline: "Book your first facial" · "Acne Bootcamp: the consultation" · "Wax Wednesday, $65"
- Call to action: Book Now.

### Campaign 3: gift certificates (November 15 to December 23, and the week before Mother's Day)
- Objective: Sales. Budget $8/day. Audience: 25–65, the LA radius, interests: gifts, spa, skincare; and anyone who visited the site in 90 days (retargeting).
- Creatives: `gift-square/story`. Primary text: "A facial they'll actually use. A gift certificate for any treatment or amount, emailed today or on the day you choose. No expiry."

### Retargeting (always on, $5/day)
Website visitors in the last 30 days who didn't buy or book: the `pickup` creative with "Still thinking it over? Pick it up free at the studio." Cart abandoners get the shelf creative.

### What to watch, weekly
Cost per purchase and cost per booking (target: under $25 for a product order, under $60 for a first facial, since a first facial is worth $220 plus whatever follows). Frequency above 3 in a week: swap the creative. Click rate under 0.8%: swap the primary text first.

## Google Search

**Setup, once:** Google Ads account with her card → link Google Business Profile → conversion tracking: the booking confirmation page and the order success page (Ruben adds the tags) → Merchant Center from `feed/google.xml` for Shopping.

**Geo:** the same radius; bids higher within 10 miles. Schedule: her hours plus evenings.

### Campaign A: facials (Search, $10/day)
- Ad group "facial near me": `facial near me`, `facial woodland hills`, `facial calabasas`, `facial tarzana`, `facial encino`, `esthetician near me`, `best facial san fernando valley`, `hydrafacial woodland hills` (she doesn't do it; the ad says what she does), `dermaplaning near me`, `chemical peel near me`.
- Ad group "acne": `acne facial near me`, `acne treatment esthetician`, `face reality esthetician`, `acne bootcamp`, `acne specialist woodland hills`.
- Ad group "wax": `brazilian wax woodland hills`, `brazilian wax near me`, `wax wednesday`, `bikini wax woodland hills`.
- Negatives: `free`, `school`, `jobs`, `salary`, `course`, `diy`, `at home`, `laser`, `botox`, `med spa`, `dermatologist`, `cheap`.
- Headlines (30 chars, Google picks the mix): "Facials in Woodland Hills" · "One On One With Evelyn" · "Book Online, No Phone Call" · "Custom Facial, 60 Minutes" · "Acne Bootcamp: Start Here" · "Brazilian Wax, $65 Wednesdays" · "Free Parking, Easy Booking" · "Professional Skincare Shelf"
- Descriptions (90 chars): "A consultation, a look at your routine, and a fully customized facial. Book a time online." · "Every treatment is with Evelyn Romero, licensed esthetician. Woodland Hills, free parking."
- Sitelinks: Book · Services · Shop · Gift certificates.

### Campaign B: her products (Shopping, free listings first)
Free listings cost nothing: Merchant Center + the feed, and her products appear when people search the names. Paid Shopping ($5/day) only after free listings show which products get clicks: `face reality mandelic serum`, `glymed plus`, `mixi skincare`, `circadia vitamin veil`, each linking to the product on her site. The brand terms are allowed for an authorized reseller; check her agreement for any rule on bidding on the brand name.

## What Claude reviews

Export each platform's weekly report as CSV into `marketing/results/` (any filename with the date). The Monday task reads it and writes what to pause, swap or scale into `marketing/weekly/<date>.md`. Once the ad accounts exist, the next step is connecting them so the same review happens from live numbers.
