# Taking Lumevina live

A plain checklist, in order. Steps marked **(Claude)** are code work to ask for in a session; everything else is an account to create or a button to press. Keys and passwords never go in chat or in the code: they're pasted into Supabase as "secrets" (step 3).

## 1. Finish the last build pieces (Claude)

- [x] **Shop checkout through Stripe** (built Oct 20): cards, Apple Pay, Google Pay, pay-over-time where switched on, sales tax by Stripe Tax, shipping or pickup, gift certificates. It turns on when `js/site-config.js → shop` is filled in.
- [x] **Shared stock** (built Oct 20): the products table; an online sale and a Sell in the dashboard take from the same count.
- [x] **Dashboard Inventory** on her real 43 products (built Oct 20).
- [x] **Lumevina Studio** (built Oct 20): the dashboard on her phone, with notifications and a morning email.
- [ ] Booking deposits stay on GlossGenius for now (her choice); the website's own deposit checkout is built for later.

## 2. Create the accounts (about 30 minutes, in Evelyn's name)

| Account | What it's for | Cost |
|---|---|---|
| **Domain** (Cloudflare or Namecheap), e.g. lumevina.com | the web address | ~$15–20 a year |
| **Stripe** (stripe.com), with her bank account | card payments, deposits, Klarna / Affirm / Afterpay | ~3% per card payment, no monthly fee |
| **Supabase** (supabase.com) | the shared calendar, stock, orders and client questions | free to start |
| **Netlify** or **Cloudflare Pages**, connected to the GitHub repo, folder `lumevina` | hosting the website | free |
| **Resend** (resend.com) | booking and order emails | free to start |
| **Google Cloud**, signed in with the Google account GlossGenius syncs to | keeping the two calendars in sync | free |
| **Anthropic** (console.anthropic.com) | Ask Lumevina's answers | a few dollars a month |
| Later: **Apple Developer** and **Google Play** | the app in the stores | $99 a year; $25 once |

## 3. Connect them (Claude can walk through this live)

1. **Supabase:** create the project, then run `server/schema.sql` in its SQL editor, then `server/seed-products.sql` (her 43 products, from `node scripts/seed-products.mjs`).
2. **Secrets:** paste the keys into Supabase (Project → Edge Functions → Secrets): Stripe, Anthropic, Resend, the three Google ones from `server/scripts/google-auth.mjs`, and a **`STUDIO_KEY`**: a long phrase only Evelyn knows, which lets her dashboard use gift certificates, save skin plans, change stock and see orders. She types it once into the dashboard (Lumevina Studio, at the top) and that device remembers it. Also: **`SITE_URL`** (the website's address), **`OWNER_EMAIL`** (where her order alerts and morning email go), and **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** for phone notifications (make the pair once with `npx web-push generate-vapid-keys`).
3. **Deploy** the server functions: `supabase functions deploy` (the list is in `server/README.md`).
4. **Stripe webhook:** in Stripe → Developers → Webhooks, point it at the `stripe-webhook` function's address, with the events listed at the top of `server/functions/stripe-webhook/index.ts` (payment_intent.* and checkout.session.*).
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
- [ ] Switch Stripe to **live** keys.

## 5. Launch

- [ ] Instagram bio and Google Business profile link to the new site.
- [ ] Booking stays on GlossGenius at launch (Evelyn's choice): the site says "booking right here is coming soon". When she's ready, set `booking.mode: "both"` in `js/site-config.js`, and later `"site"`.
- [ ] When she wants them: Glow Membership (Glow $175, Ageless $225) is one switch in `js/site-config.js`.

**Not charging clients extra for the app.** Running costs are small (a few dollars to ~$50 a month to start, plus card fees). In-person services and physical products sold in the app aren't subject to Apple's in-app purchase cut; only digital products, like a future online course, would be.
