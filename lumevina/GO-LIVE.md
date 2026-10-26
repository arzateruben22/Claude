# Taking Lumevina live

A plain checklist, in order. Steps marked **(Claude)** are code work to ask for in a session; everything else is an account to create or a button to press. Keys and passwords never go in chat or in the code: they're pasted into Supabase as "secrets" (step 3).

## 1. Finish the last build pieces (Claude)

- [x] **Shop checkout through Stripe** (built Oct 20): cards, Apple Pay, Google Pay, pay-over-time where switched on, sales tax by Stripe Tax, shipping or pickup, gift certificates. It turns on when `js/site-config.js → shop` is filled in.
- [x] **Shared stock** (built Oct 20): the products table; an online sale and a Sell in the dashboard take from the same count.
- [x] **Dashboard Inventory** on her real 43 products (built Oct 20).
- [x] **Lumevina Studio** (built Oct 20): the dashboard on her phone, with notifications and a morning email.
- [x] **v3** (built Oct 20): booking on the website (deposits, a card on file, reminders by email and text, moving and cancelling online, a waitlist), Glow Membership and Glow Points for real, and her GlossGenius jobs in the dashboard (Appointments: checkout with tips, fees, booking for a client; the GlossGenius client import and invitation). Off until `version: "v3"` in `js/site-config.js`; try it any time with `?preview=v3`. Section 6 is the switch-over.
- [x] **Selling past the client list** (built Oct 21, STOREFRONT.md): the consult gate on the actives, the online Skin Consult ($35, credited), Buy again in My Lumevina, structured data and share tags for search, the Skin School clips (twelve flat and solid explainers, each cut 9:16 for TikTok), and the course's own structured data and lesson links. Waiting on Evelyn: the three brand emails (step 0 there).

## 2. Create the accounts (about 30 minutes, in Evelyn's name)

| Account | What it's for | Cost |
|---|---|---|
| **Domain** (Cloudflare or Namecheap), e.g. lumevina.com | the web address | ~$15–20 a year |
| **Stripe** (stripe.com), with her bank account | card payments, deposits, Klarna / Affirm / Afterpay | ~3% per card payment, no monthly fee |
| **Supabase** (supabase.com) | the shared calendar, stock, orders and client questions | free to start |
| **Netlify** or **Cloudflare Pages**, connected to the GitHub repo, folder `lumevina` | hosting the website | free |
| **Resend** (resend.com) | booking and order emails | free to start |
| v3: **Twilio** (twilio.com), optional | the day-before text reminder (US texting needs its A2P registration, a few days) | ~$2 a month plus about a cent a text |
| **Google Cloud**, signed in with the Google account GlossGenius syncs to | keeping the two calendars in sync | free |
| **Anthropic** (console.anthropic.com) | Ask Lumevina's answers | a few dollars a month |
| Later: **Apple Developer** and **Google Play** | the app in the stores | $99 a year; $25 once |

## 3. Connect them (Claude can walk through this live)

1. **Supabase:** create the project, then run `server/schema.sql` in its SQL editor, then `server/seed-products.sql` (her 43 products and the online Skin Consult, from `node scripts/seed-products.mjs`; `products.consult` marks the actives that need her yes first, `server/README.md` → The consult gate).
2. **Secrets:** paste the keys into Supabase (Project → Edge Functions → Secrets): Stripe, Anthropic, Resend, the three Google ones from `server/scripts/google-auth.mjs`, and a **`STUDIO_KEY`**: a long phrase only Evelyn knows, which lets her dashboard use gift certificates, save skin plans, change stock and see orders. She types it once into the dashboard (Lumevina Studio, at the top) and that device remembers it. Also: **`SITE_URL`** (the website's address), **`OWNER_EMAIL`** (where her order alerts and morning email go), and **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** for phone notifications (make the pair once with `npx web-push generate-vapid-keys`).
3. **Deploy** the server functions: `supabase functions deploy` (the list is in `server/README.md`).
4. **Stripe webhook:** in Stripe → Developers → Webhooks, point it at the `stripe-webhook` function's address, with the events in `server/README.md` → Turning on v3 → Stripe (the checkout.session.* ones for the shop; v3 adds invoice.paid and customer.subscription.*).
4b. **Stripe for the shop:** Settings → Payment methods: turn on Apple Pay, Google Pay and any of Klarna / Afterpay / Affirm she wants. **Sales tax:** set up Stripe Tax (her business address and California registration), then add the secret `STRIPE_TAX=on`. Selling products in California generally needs a seller's permit; her accountant should confirm the setup.
5. **GlossGenius:** turn on Google Calendar sync, both ways.
5b. **Client sign-in:** in Supabase → Authentication → URL Configuration, set the Site URL to the website's address and add it to Redirect URLs (the emailed sign-in link comes back there).
6. **The website's settings** (`js/site-config.js`): fill in the Supabase address and public key for the shop, the calendar sync and Ask Lumevina.
6b. **Morning email:** schedule `studio-digest` once with Supabase cron (`server/README.md` → Lumevina Studio).
6c. **Evelyn's phone:** open `<her site>/dashboard.html` in Safari → Share → Add to Home Screen → open **Studio** → add the studio key → Turn on notifications → Send a test.
7. **Domain:** point it at Netlify or Cloudflare (they show the two records to add).

## 4. Test before real money

- [ ] Book a waxing (deposit), a facial (nothing due) and the acne consultation, with Stripe in **test mode**.
- [ ] Check each one shows in her Google Calendar and blocks the time in GlossGenius.
- [ ] Buy a product with Stripe's test card (4242 4242 4242 4242): Stripe's page opens, the receipt email arrives, stock drops by one on the website and in the dashboard, the order shows on her Shipping list, and her phone gets a "New order" notification.
- [ ] Buy a $50 gift certificate for someone else: they get the code by email; one dated for tomorrow goes out with the next morning email.
- [ ] Ask Lumevina a price question and a skin question (the skin one should go to Evelyn).
- [ ] After the test product order: ask the chat "where's my order?" signed in (it finds it), then signed out with the order number from the receipt email (LUM-…) and the same email. Mark it shipped on the dashboard with a tracking number and ask again: a Track my package button appears. Type a gift code into the chat: it says what's left.
- [ ] Send a skin question with a photo: it shows on the dashboard's Client questions with the photo and a line on what it shows; Send reply emails the test address, and (signed in) the reply appears in the chat.
- [ ] Skin plan: write one in the dashboard for a test email, sign in on the website with that email (the link arrives by email), see it under My Lumevina, then ask the chat "what do I use at night?" (answered from the plan) and "can I add vitamin C?" (goes to Evelyn).
- [ ] Gift certificate: buy a $100 one, then on the dashboard use it on a $50 visit ($50 should stay on it) and on a $120 visit (it covers the last $50; the client pays $70). "Check a gift balance" on the site should show each step, from another phone too.
- [ ] Switch Stripe to **live** keys, then the payment checklist below.

### Payments: the security checklist (read once, tick before the first real charge)

How it's built, so nothing here is a surprise: **no card number ever touches the website or the server.** Every payment (a product, a deposit, a membership, a pay link) opens Stripe's own page, and the card on file is kept by Stripe; the server stores only a card label like "Visa •••• 4242" and Stripe's ids. That keeps Evelyn in PCI's simplest tier (SAQ A, the questionnaire Stripe fills with her). Every price is worked out by the server from her own product and service tables, never from the browser. Stripe tells the server what was paid through a signed webhook (the signature is checked, old events are rejected, and a paid order is only ever finished once). Every table has row-level security: a signed-in client can read their own orders, bookings and plan and nothing else; the dashboard's changes go through functions that need her studio key. Scripts that hammer checkout, booking or the chat get a "slow down" after a handful of calls.

- [ ] **Live keys, live webhook.** `STRIPE_SECRET_KEY=sk_live_…` and a *new* webhook endpoint in live mode with its own `STRIPE_WEBHOOK_SECRET` (test and live secrets differ; a test event on the live deployment is ignored and logged).
- [ ] **`SITE_URL` is set** to her real https address, so Stripe only sends people back to her site.
- [ ] **Studio key:** at least 20 characters, made with a password manager, saved only in the dashboard and in Supabase's secrets (never in a text or email). Rotate it if a phone with the dashboard is lost.
- [ ] **The dashboard lives on its own address** (for example `studio.her-domain`, or the Supabase-hosted page behind her sign-in), not next to the public pages: the studio key sits in that page's browser storage, and a separate origin keeps the public site's scripts away from it.
- [ ] **HTTPS only, with the headers** in `_headers` (Netlify or Cloudflare Pages pick the file up; on Vercel copy them into `vercel.json`). Check with https://securityheaders.com after the first deploy.
- [ ] **Stripe Radar** is on (it is by default); turn on "block if CVC fails" and "block if postal code fails" in Stripe → Radar → Rules. 3-D Secure runs on Stripe's page when a bank asks for it, nothing to set.
- [ ] **Apple Pay** on her domain: Stripe → Settings → Payment methods → Apple Pay → add the domain (the verification file goes at `/.well-known/`).
- [ ] **Receipts and refunds:** Stripe → Settings → Emails, turn on successful-payment and refund emails as a second receipt. Refunds happen in Stripe's dashboard (the order's payment is linked from Shipping) or from the dashboard's checkout for a visit.
- [ ] **Stripe Tax** on, with the studio's address, then `STRIPE_TAX=on`; check one test order shows California sales tax.
- [ ] **One real $1 test**: buy the cheapest item with a real card, see the order, stock, receipt and her notification, then refund it in Stripe and check the refund email arrives.
- [ ] **Two-step sign-in** on Stripe, Supabase, the domain registrar and Google (her calendar), with the recovery codes in her password manager.
- [ ] **Who gets alerts:** `OWNER_EMAIL` is hers, and Stripe → Settings → Team has only her (and Ruben if she wants, as Developer, not Administrator).

## 5. Launch

- [ ] Instagram bio and Google Business profile link to the new site.
- [ ] Booking stays on GlossGenius at launch (Evelyn's choice): the site says "booking right here is coming soon". When she's ready, section 6.

**Not charging clients extra for the app.** Running costs are small (a few dollars to ~$50 a month to start, plus card fees). In-person services and physical products sold in the app aren't subject to Apple's in-app purchase cut; only digital products, like a future online course, would be.

## 6. Switching to v3 (booking, membership and points here)

One switch, when Evelyn is ready: everything below is built and tested; it needs the accounts above and these steps (`server/README.md` → Turning on v3 has the commands).

1. **Preview it first.** Open the site with `?preview=v3` at the end of the address (and `dashboard.html?preview=v3`). Only that browser sees it; "Previewing v3 · leave" in the corner ends it.
2. **Server:** run the current `server/schema.sql`, add the v3 secrets (`SITE_VERSION=v3`; Twilio, `REVIEW_URL` and `STUDIO_ADDRESS` if wanted), deploy the v3 functions, add the webhook events, turn on Stripe's customer portal, and schedule `client-reminders` hourly.
3. **Her dashboard:** check her hours; Clients → choose the GlossGenius client export (a CSV) → Import. Nothing is sent yet.
4. **Test mode run** (Stripe test keys, card 4242 4242 4242 4242):
   - [ ] A guest books a Brazilian: Stripe's page takes the $30 deposit; the confirmation email has "Cancel or move it"; it's in her Google Calendar and Appointments.
   - [ ] A facial with no deposit: Stripe's page only saves the card.
   - [ ] From the email link: move it (48+ hours ahead), then cancel it; book again the same month and the deposit comes off.
   - [ ] A full day offers the waitlist; cancelling a booking that day emails the person waiting.
   - [ ] Join Glow: Stripe's page at $175 (founding); My Lumevina shows 1 facial; book it with no deposit; pause, cancel, keep.
   - [ ] In Appointments: check out a visit with a product and a 20% tip by the card on file; a pay link (open it on a phone); cash. Mark a no-show and charge the fee.
   - [ ] Book for a client from the dashboard with "email a card link"; the client adds a card from the email.
   - [ ] The hourly run: a reminder email for a booking 3 days out; the text the day before (if Twilio is set up).
   - [ ] Glow Points: the first booking shows 100 + the deposit's points in My Lumevina.
   - [ ] Skin profile: sign in, My Lumevina → Build my skin profile, save it; ask the chat a prep question that mentions a product you use ("I use a vitamin C serum…"): the answer fits, and "Noted in your skin profile" appears; forget the note in My Lumevina.
   - [ ] Teach the chat: answer an everyday skin question in Client questions with "Teach the chat" ticked; a general version appears in Teach the chat; approve it; ask the chat the same question from another browser and it answers in her words.
5. **Switch:** set `version: "v3"` in `js/site-config.js` and publish. Then Clients → **Invite**: one email to each imported client (their first booking here comes with 100 Glow Points; anything already booked on GlossGenius stands).
6. **The weeks after:** GlossGenius appointments already booked stay on her calendar (the two calendars keep seeing each other through Google). Once none are left, GlossGenius can be cancelled.

Prices in v3: Glow **$185**, Ageless **$235** a month; the first 25 members keep the founding rate, **$175** and **$225**, for as long as they stay.

## 7. Making the chat know Evelyn (any time, v2 or v3)

- [ ] **Her 10 minutes:** the Skin Playbook link → Talk it through → **Start the 10 minutes**. Claude asks the 26 questions clients ask most, one after another; she talks or types. Her answers save as she goes; then they're exported, imported and bundled for the chat (`knowledge/README.md`, steps 3 and 4), and `ask` is redeployed.
- [ ] The rest of the playbook whenever she likes (Claude picks, or a topic).
- [ ] After that it grows by itself, with her approval: every everyday question she answers becomes a suggested answer in **Teach the chat**, and each signed-in client's skin profile and notes make answers specific to them.

## 8. Getting found: feeds, listings, ads (MARKETING.md), and selling past the client list (STOREFRONT.md)

1. **Google Business Profile, Nextdoor, Yelp, Apple Maps:** claim them with the copy in `marketing/local-listings.md`; the booking link with its UTM tag.
2. **Product feeds:** `node scripts/build-feed.mjs --site https://<her domain>` → `feed/google.xml` (Google Merchant Center: free Shopping listings and Maps) and `feed/meta.csv` (Meta Commerce Manager: Instagram and Facebook Shop, checkout on the website). Publish the `feed/` folder with the site and point each platform's scheduled fetch at it. Add barcodes to `scripts/gtins.json` as she reads them off the boxes.
3. **The welcome code:** Stripe → Coupons → 10% once → Promotion code WELCOME10, first-time order only (`marketing/welcome-offer.md`). Checkout already accepts codes.
4. **Ads, when she's ready:** a Meta ad account and a Google Ads account in her name, her card; the Meta pixel and Google conversion tags on the site (Ruben); then the campaigns in `marketing/campaigns.md`, starting at $10/day each, 20 miles around Woodland Hills. Creatives: `node marketing/ads/build-ads.mjs` → `marketing/ads/out/`.
5. **Every Monday** Claude drafts the week's posts and ad variants into `marketing/weekly/`; she posts what she likes.
6. **Search and shares, already on the page:** `robots.txt` keeps the dashboard and the working folders out of search; `js/seo.js` writes the studio (hours, Woodland Hills, Instagram) and the whole shelf (price, stock, photo, the product's own link) as structured data for Google; the share tags in `index.html` give iMessage, Instagram DMs and the TikTok bio a title and the pore clip's poster. Once the domain exists: make the `og:image` address absolute (`https://<her domain>/img/school/video/8-2.jpg`), add `Sitemap: https://<her domain>/sitemap.xml` to `robots.txt` with a three-line sitemap (the home page, `docs/school/school.html`, `privacy.html`), and submit it in Google Search Console.
