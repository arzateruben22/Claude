# Taking Lumevina live

A plain checklist, in order. Steps marked **(Claude)** are code work to ask for in a session; everything else is an account to create or a button to press. Keys and passwords never go in chat or in the code: they're pasted into Supabase as "secrets" (step 3).

## 1. Finish the last build pieces (Claude)

- [ ] **Real card payments.** The booking deposit and the shop checkout still use the 4242 test card. Connect both to Stripe (Stripe Checkout: cards, Apple Pay, Google Pay, Klarna, Affirm, Afterpay).
- [ ] **Shared stock.** Products table on the server, so an online sale and a Sell in the dashboard take from the same count.
- [ ] **Dashboard Inventory** on her real 43 products.

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

1. **Supabase:** create the project, then run `server/schema.sql` in its SQL editor.
2. **Secrets:** paste the keys into Supabase (Project → Edge Functions → Secrets): Stripe, Anthropic, Resend, the three Google ones from `server/scripts/google-auth.mjs`, and a **`STUDIO_KEY`**: a long phrase only Evelyn knows, which lets her dashboard use gift certificates and save skin plans. She types it once into the dashboard (the "Use a gift certificate" box, or a skin plan's Save) and that browser remembers it.
3. **Deploy** the server functions: `supabase functions deploy` (the list is in `server/README.md`).
4. **Stripe webhook:** in Stripe → Developers → Webhooks, point it at the `stripe-webhook` function's address.
5. **GlossGenius:** turn on Google Calendar sync, both ways.
5b. **Client sign-in:** in Supabase → Authentication → URL Configuration, set the Site URL to the website's address and add it to Redirect URLs (the emailed sign-in link comes back there).
6. **The website's settings** (`js/site-config.js`): fill in the Supabase address and public key for the shop, the calendar sync and Ask Lumevina.
7. **Domain:** point it at Netlify or Cloudflare (they show the two records to add).

## 4. Test before real money

- [ ] Book a waxing (deposit), a facial (nothing due) and the acne consultation, with Stripe in **test mode**.
- [ ] Check each one shows in her Google Calendar and blocks the time in GlossGenius.
- [ ] Buy a product: stock drops by one on the website and in the dashboard.
- [ ] Ask Lumevina a price question and a skin question (the skin one should go to Evelyn).
- [ ] Skin plan: write one in the dashboard for a test email, sign in on the website with that email (the link arrives by email), see it under My Lumevina, then ask the chat "what do I use at night?" (answered from the plan) and "can I add vitamin C?" (goes to Evelyn).
- [ ] Gift certificate: buy a $100 one, then on the dashboard use it on a $50 visit ($50 should stay on it) and on a $120 visit (it covers the last $50; the client pays $70). "Check a gift balance" on the site should show each step, from another phone too.
- [ ] Switch Stripe to **live** keys.

## 5. Launch

- [ ] Instagram bio and Google Business profile link to the new site.
- [ ] Booking stays on GlossGenius at launch (Evelyn's choice): the site says "booking right here is coming soon". When she's ready, set `booking.mode: "both"` in `js/site-config.js`, and later `"site"`.
- [ ] When she wants them: Glow Membership (Glow $175, Ageless $225) is one switch in `js/site-config.js`.

**Not charging clients extra for the app.** Running costs are small (a few dollars to ~$50 a month to start, plus card fees). In-person services and physical products sold in the app aren't subject to Apple's in-app purchase cut; only digital products, like a future online course, would be.
