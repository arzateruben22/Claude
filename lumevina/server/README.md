# Lumevina — server (Supabase + Stripe)

The backend that turns the site's demo booking/rewards into the real thing:
one shared calendar, real deposits, and a Glow Rewards ledger that follows
the client across devices (site → iPhone app).

## What's here

| File | Purpose |
| --- | --- |
| `schema.sql` | Postgres schema: clients, bookings (with a database-level double-booking guard), rewards ledger, flash slots, push tokens, row-level security |
| `functions/create-deposit-intent/` | Recomputes the price server-side, inserts the booking, creates the Stripe PaymentIntent for the 50% deposit |
| `functions/stripe-webhook/` | Confirms payment, holds the booking, writes rewards (multipliers included), fires the confirmation, documents the referral-credit trigger |
| `functions/send-confirmation/` | Sends confirmation + 24-hour reminder email/SMS (Resend + optional Twilio); also flushes due reminders when run on a schedule |
| `functions/ask/` | Ask Lumevina: answers everyday questions with Claude from the spa's own facts, hands personal ones to Evelyn with a drafted reply |
| `functions/gift-cards/` | Gift certificates: check a balance, use one at the visit (studio key), list them, sell one in person |
| `functions/client-plans/` | Skin plans: Evelyn writes each client's routine (studio key); the signed-in client reads theirs |
| `functions/create-checkout/` | The shop's real checkout: prices the cart from the products table and opens Stripe Checkout (cards, Apple/Google Pay, pay-over-time, Stripe Tax, shipping or pickup, gift certificates) |
| `functions/studio/` | Lumevina Studio (her dashboard): notifications on, the alerts feed, orders, stock and prices (studio key) |
| `functions/studio-digest/` | Her morning email and notification; sends gift certificates dated for today (run daily by cron) |
| `functions/_shared/orders.ts`, `notify.ts`, `mail.ts` | Finishing a paid order; alerting Evelyn (feed, push, email); sending email |
| `functions/_shared/catalog.ts` | Generated price/duration catalog — the server's source of truth |

## Gift certificates

`schema.sql` → `gift_cards` (one row per code, with its balance) and
`gift_redemptions` (every use: the bill, what the certificate covered, what
the client paid, what was left), plus `redeem_gift`, which spends a
certificate in one locked step. A dollar certificate draws down: $100 on a
$50 visit covers $50 and keeps $50; on a $120 visit it covers its $100 and
the client pays the $20 difference.

`functions/gift-cards/` is the only way in (nothing is public in the tables):

| Action | Who | What |
| --- | --- | --- |
| `check` | anyone with the code | balance and status (the site's "Check a gift balance") |
| `redeem` | the dashboard, with `x-studio-key` | spends it against a visit's total |
| `list` | the dashboard, with `x-studio-key` | every certificate, with its uses |
| `issue` | the dashboard, with `x-studio-key` | a certificate sold in person |

```sh
supabase secrets set STUDIO_KEY="<a long phrase only Evelyn knows>"
supabase functions deploy gift-cards --no-verify-jwt
```

Certificates bought on the website: when the shop takes real payments,
`stripe-webhook` calls `issueGift` (`functions/_shared/gifts.ts`) for each
paid `gift-any-<amount>` line, after Stripe confirms, and the code is
emailed. Never issue them from the browser. Until the shop's payments are
live, the website's demo checkout issues codes in the buyer's browser
(js/giftcards.js), which is only for trying it out.

## Skin plans, and what the chat knows about a signed-in client

`schema.sql` → `client_plans`: the routine Evelyn writes for each client in
her dashboard (Clients → Skin plan): skin type, what they're working on,
where they are now, morning, night and weekly steps from her shelf, what to
avoid, the next step, a note, and dated visit notes. Keyed by email, so she
can write one for a GlossGenius client before they ever sign in. Clients
read only their own (row-level security on their sign-in email);
`functions/client-plans/` is the only way to write:

| Action | Who | What |
| --- | --- | --- |
| `mine` | the signed-in client (their session) | their plan, for My Lumevina |
| `list` / `save` / `remove` | the dashboard, with `x-studio-key` | every plan; write or delete one |

```sh
supabase functions deploy client-plans --no-verify-jwt
```

**Ask Lumevina, signed in.** When the website sends a client's session
(`Authorization: Bearer <their access token>`), `functions/ask` builds their
file (`functions/_shared/plans.ts`): the plan, a few pre-visit form answers
(goals, challenges, what they use, last retinol and exfoliation, plus
pregnancy, medications, conditions and allergies as cautions), their visits,
and the last questions Evelyn answered for them. It goes into the prompt
after the cached part, for that request only. With a plan on file, "what do
I use tonight?" is answered from it instead of waiting for her; changing the
plan, a reaction, pregnancy, medications and named conditions still go to
her, and her drafted reply for those uses the same file.

**Sign-in links.** My Lumevina signs clients in with Supabase Auth's emailed
link (no password, no extra library: `js/account.js`). In Supabase → Authentication:
- **URL Configuration:** Site URL = the website's address; add it (and the
  preview address, if any) under Redirect URLs.
- **Email Templates → Magic Link:** Evelyn's wording, if she likes.
- Email sign-ins are on by default; for her own sending address, set up
  custom SMTP with the same Resend account as the confirmations.

## The shop: checkout, stock and orders

`schema.sql` → `products` (one row per product, with the one stock count;
the public `shelf` view shows counts and prices only), `take_stock` (takes
stock off in one step, never below zero, and says what's now low), and
`orders`. Seed the products with `server/seed-products.sql`
(`node scripts/seed-products.mjs` writes it from `js/catalog.js`; running it
again updates names but keeps her stock, prices and hidden flags).

1. The cart posts to `create-checkout`: it re-prices everything from
   `products` (never the browser's prices), refuses more than is on the
   shelf, saves a `pending` order and opens Stripe Checkout. Shipping is
   $8, free over $75 (as on the site); pickup is free. Gift certificates
   are $25–$1,000, not taxed.
2. Stripe sends the buyer back to `SITE_URL?order=done`; the site clears
   the cart and says thank you.
3. `stripe-webhook` gets `checkout.session.completed` and runs
   `fulfillOrder` (`_shared/orders.ts`): the order turns `paid` with the
   real totals and address, `take_stock` runs, gift certificates are issued
   and emailed (dated ones wait for the morning run), a shipped order goes
   on the `shipments` list, the buyer gets a receipt, and Evelyn gets a
   "New order" alert (plus "Low stock" for anything that ran low).

```sh
supabase functions deploy create-checkout
supabase secrets set SITE_URL=https://her-domain STRIPE_TAX=on   # STRIPE_TAX once Stripe Tax is set up
```

## Lumevina Studio (Evelyn's phone)

The dashboard installs to her home screen (`studio.webmanifest`); `sw.js`
shows the notifications. `_shared/notify.ts → notifyOwner` records every
alert in `studio_alerts` (the dashboard's Recent feed), pushes it to each
phone in `studio_push`, and emails `OWNER_EMAIL` for orders and client
questions. Alerts today: new order, new gift certificate sale, low stock,
a client question handed to her by Ask Lumevina (with how many photos).
The same function serves the dashboard's Client questions card
(`questions`, `answer`).

```sh
npx web-push generate-vapid-keys          # once; keep both
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... OWNER_EMAIL=evelyn@...
supabase functions deploy studio --no-verify-jwt
supabase functions deploy studio-digest --no-verify-jwt
```

The morning email (`studio-digest`): store the studio key in Supabase Vault
as `studio_key`, then schedule it in the SQL editor (pg_cron and pg_net are
built in; 15:00 UTC is 8 AM in Los Angeles in summer, 7 AM in winter):

```sql
select cron.schedule('studio-digest', '0 15 * * *', $$
  select net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/studio-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-studio-key', (select decrypted_secret from vault.decrypted_secrets where name = 'studio_key')),
    body := '{}'::jsonb);
$$);
```

On iPhone, notifications from a website need iOS 16.4 or later and work
only from the home-screen app (Share → Add to Home Screen → open Studio).

## Notifications (confirmations & reminders)

The site collects the client's email at booking and a phone on the intake
form. To turn on real messages:

1. Create a [Resend](https://resend.com) account, verify your sending domain,
   and set the secrets:

   ```sh
   supabase secrets set RESEND_API_KEY=re_...  FROM_EMAIL="Lumevina <hello@yourdomain>"
   # optional SMS:
   supabase secrets set TWILIO_SID=AC... TWILIO_TOKEN=... TWILIO_FROM=+1...
   ```

2. Deploy: `supabase functions deploy send-confirmation`. The webhook already
   calls it on every paid booking (confirmation now + a queued 24h reminder).

3. Schedule the reminder flush — in the Supabase dashboard add a cron job
   (Database → Cron) every 15 minutes hitting the function with `{ "due": true }`,
   which sends any reminder rows whose time has arrived.

## Intake forms

`js/intake.js` collects the pre-visit form. Wire its submit to
`upsert` into the `intake_forms` table (keyed by email); the owner reads
them before the visit (a client screen in the dashboard, or straight from
the table editor). Nothing else changes on the client.

## One-time setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Install the CLI: `npm i -g supabase`, then `supabase login` and
   `supabase link --project-ref <your-project-ref>`.
3. Apply the schema: `supabase db push` (or paste `schema.sql` into the SQL
   editor). Also run the `grant_referral_credit` trigger from the bottom of
   `stripe-webhook/index.ts`.
4. In Supabase Auth settings, enable **Email (magic link)** — no passwords.
5. Create a [Stripe](https://stripe.com) account. Copy the **secret key** and
   set the function secrets (keys live only here — never in the repo or app):

   ```sh
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

6. Deploy the functions:

   ```sh
   supabase functions deploy create-deposit-intent
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

7. In the Stripe dashboard, add a webhook endpoint pointing at the
   `stripe-webhook` function URL for events `payment_intent.succeeded` and
   `payment_intent.payment_failed`.

## Wiring the client

The swap points are already marked in the site code:

- `js/payments.js` → `process()` calls `create-deposit-intent`, then confirms
  the PaymentIntent with Stripe.js / the Stripe iOS SDK (Apple Pay comes free
  via `automatic_payment_methods`).
- `js/booking.js` → replace `cellSeedBusy` (the demo availability) with a
  fetch of `day_availability(date)`; keep the same cell math.
- `js/rewards.js` → read the balance from `reward_balances`, write nothing
  locally; the ledger is server-side. The public API of `LumevinaRewards`
  stays the same, so no UI changes.
- `js/account.js` → swap the mock sign-in for
  `supabase.auth.signInWithOtp({ email })` — the UI is already magic-link
  shaped.

## Regenerating the catalog

Whenever prices change on the site, regenerate `_shared/catalog.ts`:

```sh
cd lumevina && node -e '
const fs=require("fs");const html=fs.readFileSync("index.html","utf8");
const booking=fs.readFileSync("js/booking.js","utf8");
const dur30=new Set([...booking.match(/var DUR30 = \{([\s\S]*?)\};/)[1]
  .matchAll(/"([a-z0-9-]+)":/g)].map(m=>m[1]));
const seen=new Map();
for(const m of html.matchAll(/class="[^"]*add-to-cart[^"]*"[^>]*/g)){
  const t=m[0],id=(t.match(/data-id="([^"]+)"/)||[])[1];
  const name=(t.match(/data-name="([^"]+)"/)||[])[1];
  const price=(t.match(/data-price="([^"]+)"/)||[])[1];
  if(!id||seen.has(id))continue;
  seen.set(id,{name,price_cents:Math.round(Number(price)*100),
    dur_min:id==="gift-certificate-100"?0:(dur30.has(id)?30:60)});}
let out="// Lumevina — server-side service catalog\n// GENERATED from index.html + js/booking.js — regenerate with\n// the snippet in server/README.md whenever prices change.\n\nexport const CATALOG: Record<string, { name: string; price_cents: number; dur_min: number }> = {\n";
for(const[id,s]of seen)out+=`  "${id}": { name: ${JSON.stringify(s.name)}, price_cents: ${s.price_cents}, dur_min: ${s.dur_min} },\n`;
fs.writeFileSync("server/functions/_shared/catalog.ts",out+"};\n");
console.log("services:",seen.size);'
```

## Memberships (Stripe Billing)

`js/membership.js` runs the whole Glow Membership flow in the browser today
(join, monthly facials, bank up to 2 with billing held at 2, pause, cancel,
gift a banked facial).
To make it real:

1. In Stripe, create one **Product** per plan (Glow, Ageless) with a
   monthly **Price** ($175 / $225). Clear-skin clients join Glow, which covers
   the Monthly Acne Treatment. Founding members keep the price they
   joined at: never edit a Price, add a new one for new members instead.
2. Join = a Stripe **Subscription** created server-side for the client's
   customer, using the card saved at join (`payment_behavior:
   default_incomplete`, confirmed with Stripe.js), then an insert into
   `memberships` (schema.sql) with `min_ends_at = now() + 3 months`.
3. In `stripe-webhook`, handle:
   - `invoice.paid` → `credits = credits + 1`, ledger row `billed`
   - `invoice.voided` on a held subscription → ledger row `held`
   - `customer.subscription.updated` / `deleted` → mirror `status`, `cancel_at`
4. Billing hold at 2 banked facials (so no one pays for a facial they can't
   use). After every change to `credits` (a paid invoice, a booking, a
   returned or gifted facial), run one `sync_hold` step:
   - `credits >= 2` and not already held → set the subscription's
     `pause_collection = { behavior: 'void' }` (no `resumes_at`), set
     `on_hold = true`, and send the member one email and text: "You have 2
     facials waiting, so we won't bill you on {date}. Book one and your
     monthly facial picks up again."
   - `credits < 2` and held → clear `pause_collection`, `on_hold = false`.
   - Three days before a held billing date, send one booking reminder.
   The member's own pause (step 6) takes priority: while `paused_bill_at` is
   set, leave `pause_collection` as the pause set it, and re-run `sync_hold`
   when it resumes.
5. Cancel = `cancel_at` on the subscription set to the later of the minimum
   end or the current period end. It must be available online from My Lumevina
   (California's automatic-renewal law requires online cancellation when the
   signup was online), and the terms shown at join must state the price,
   billing frequency, minimum term and how to cancel: they already do.
6. Pause = `pause_collection` for the one skipped billing date (once per 12
   months), mirrored in `paused_bill_at`.
7. Booking with a credit: `create-deposit-intent` checks the client has a
   `usable` membership covering the service, prices that service at $0 (and
   takes 15% off the rest of the visit), and decrements `credits` in the same
   transaction as the booking insert.
8. Founding Five: in the join transaction, if fewer than five memberships have
   a `five_no`, set the next number with `five_kit = 'ready'` and
   `five_addon = 'ready'`, and decrement the two kit products (GlyMed+
   Glycolic Facial Cleanser, Face Reality Daily SPF 30 Plus) in `products` so
   the shop never oversells them. The first booking that uses a membership
   credit sets `five_addon = 'used'`; the owner dashboard sets
   `five_kit = 'given'` when the kit is handed over.

Have the member terms reviewed before launch.

### Extra Mondays

`js/extra-days.js` holds the owner's choice (off, every other Monday, every
Monday), set from the dashboard's Glow Membership card. The calendar opens
those Mondays; members book them first and everyone else from the Friday
before. Live: store it as one row in a `site_settings` table, read it in the
calendar, and have `create-deposit-intent` reject a Monday that isn't open
(or a members-only one for a non-member) so the rule holds server-side.

### Glow Routine (product subscription)

`js/routine.js` runs the $75/month Glow Routine in the browser today: focus
(Glow, Clear, Ageless), ship or pick up, card on file, and each charge logged
to the retail sales log at cost so the dashboard's books count it. To make it
real, reuse the membership pattern: one Stripe **Product** with a monthly
**Price**, a **Subscription** at signup, and `invoice.paid` in
`stripe-webhook` writing an `order_items` row (product cost plus shipping or
packaging) and queuing the month's box. Skip a month = `pause_collection` for
that billing date. Before supplements go in the box: a California seller's
permit, sales tax settings from the accountant, insurance that covers
products, and only the brand's approved wording on the site.

### Shipping

`js/shipping.js` keeps one list of everything that goes out by mail (shelf
orders, Glow Routine boxes, Skin School kits) in the browser today, and the
dashboard's **Shipping** card works from it. To make it real:

1. Run the `shipments` table in `schema.sql`.
2. Checkout sends the address as separate fields (street, apt, city, state,
   ZIP). Validate them in the function that creates the PaymentIntent, and
   in `stripe-webhook`, on `payment_intent.succeeded` for an order with
   shipped items, insert a `shipments` row: package and weight from the same
   table as `js/shipping.js` (`PACKS` and `ITEMS`), `ship_by` two business
   days out. For the Glow Routine, insert one on each `invoice.paid` with
   `ship_by` set to that month's box date.
3. The dashboard reads `to_ship` rows instead of localStorage. Mark shipped
   writes `tracking`, `carrier`, `postage_cents`, `supplies_cents`,
   `shipped_at`, and the books use `postage_cents + supplies_cents` instead
   of `est_cents`.
4. Labels stay in Pirate Ship (it has no API): the dashboard's download is
   its import file. If the shop grows past about ten orders a day, a label
   API (Shippo or EasyPost, a few cents a label) can buy the label from the
   dashboard in one tap; the row already has everything it needs.
5. Optional: Pirate Ship emails the client their tracking when the import
   includes an email. To send it from Lumevina instead, have
   `send-confirmation` email the tracking link when a row turns `shipped`.

## Running both calendars

New clients book on the website; clients who already use GlossGenius keep
booking there for now. Both have to see each other's appointments, or the
same time gets booked twice. GlossGenius has no public API, but it syncs
with **Google Calendar both ways**, so her Google Calendar is the meeting
point and the website only talks to Google:

```
GlossGenius  ⇄  her Google Calendar  ⇄  website (server/functions)
```

- **GlossGenius → website:** GlossGenius puts each appointment in her Google
  Calendar. `functions/availability` reads her busy times (Google freeBusy)
  plus the website's own bookings, and the Book section greys those times
  out. `create-deposit-intent` checks Google once more before taking a
  deposit.
- **Website → GlossGenius:** when a deposit is paid, `stripe-webhook` writes
  the booking into her Google Calendar (`_shared/google.ts`), and
  GlossGenius blocks that time.

Setup, once:

1. **In GlossGenius:** connect her Google Calendar in the app's calendar
   sync settings, and make sure it's two-way (her Google events block
   times in GlossGenius). Note which Google calendar GlossGenius writes to.
2. **Google Cloud:** create a project, enable the Google Calendar API, make
   an OAuth client of type "Desktop app", then run
   `GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node server/scripts/google-auth.mjs`
   and sign in with that same Google account.
3. **Secrets:** `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=...`
   If GlossGenius writes to a calendar other than her primary one, also set
   `GOOGLE_BUSY_CALENDARS=primary,<that calendar's id>`.
4. **Deploy:** `supabase functions deploy availability --no-verify-jwt`
   (and redeploy `create-deposit-intent` and `stripe-webhook`).
5. **Website:** in `js/site-config.js`, set `booking.availability` to
   `https://<project>.supabase.co/functions/v1/availability`.

How close to real time: the website reads Google every time the Book
section opens and every two minutes, and checks again before charging, so
a GlossGenius booking blocks the website within however long GlossGenius
takes to push it to Google (usually a minute or two). The other way is
the same: a website booking reaches GlossGenius as fast as GlossGenius
reads Google. In that small window, two people could pick the same time
on the two systems; if it happens, the second one is the one to move.
To close it entirely, she moves all booking to the website (`mode: "site"`).

## Ask Lumevina (client questions)

`js/ask.js` is the chat. With `ask.endpoint` set in `js/site-config.js` it
sends each question to `functions/ask`; without it (or when the function
can't be reached) its keyword answers take over.

```sh
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy ask
```

What the function does with a question:

- **The rules first.** Reactions, pregnancy, medications, skin conditions,
  "what should I use on my skin" and emergencies are caught by plain code
  (`js/ask-rules.js`, copied into the bundle) before any AI call, and go to
  Evelyn. They never depend on the model.
- **Everyday questions:** Claude answers from the bundle (her playbook, the FAQ
  and policies, the shelf with live stock), in her voice. A signed-in client's
  skin plan and file come along (`_shared/plans.ts`).
- **Look-ups** (`_shared/lookups.ts`), as tools the model can call:
  `look_up_order` (a signed-in client's own orders; anyone else needs the order
  number from the receipt, `orders.ref`, plus the email they ordered with; never
  an address or a gift code), `gift_balance` (by code, like the site's balance
  check), and `show_products` (Add to bag buttons under the answer). Up to four
  rounds, then it hands the question to Evelyn instead of looping.
- **Hand-offs:** the model can call `hand_to_evelyn`; nothing is saved until
  the client taps **Send to Evelyn**. Then the website posts `{ handoff, id,
  message, why, name, email, photos }`: the function stores up to three photos
  (JPEGs the website shrank) in the private `question-photos` bucket, writes a
  draft with Claude (it sees the photos, describes them for Evelyn in
  `photo_note`, never diagnoses, and asks for a clearer one when needed), saves
  the row and tells her (push + email). The `id` makes a retry safe.

The dashboard's **Client questions** card reads them through `functions/studio`
(`questions`: every waiting question and the last 30 days answered, photos as
hour-long links) and **Send reply** calls `answer`, which emails the client
(reply-to: `OWNER_EMAIL`) and marks it answered. A signed-in client also sees
Evelyn's reply in their chat (their own rows in `questions`).

Cost: the stable part of the prompt is cached for an hour, so a question costs
mostly its own few hundred tokens; a look-up adds one short round, and a draft
with photos adds the images once.

## Glow Points, rebooking and referrals

The +25 rebooking bonus is for **non-members** (members already have a
facial every month): it's earned when a visit falls within 5 weeks after the
client's last one. `stripe-webhook` records what each booking earned in
`bookings.points_earned`; when a booking is cancelled in time, the
`return_booking_points` trigger hands those points back and the visit stops
counting toward the next rebooking bonus. The website does the same today
(`js/rewards.js` `reverse`, called from My Lumevina's cancel).

Referrals give both sides $15: the friend gets **$15 off their first visit**
(`create-deposit-intent` checks the code belongs to another client and that
it's the booker's first booking, and records it in `bookings.referral_code`),
and the client who shared it gets **150 points ($15)** once that visit is
completed. **Share my code** (Glow Rewards and My Lumevina) opens the phone's
share menu with a link like `https://lumevina.com/?ref=GLOW-AB12`, or copies
it where there's no share menu. A visitor arriving with `?ref=` has the code
remembered and filled in on their first booking; the referral-credit trigger
at the end of `functions/stripe-webhook/index.ts` pays the 150 points once
that first visit is completed. Set the live address in `js/rewards.js`
(`SITE`) when the domain is final.

## Skin School (the online course)

`school.html` is built from `docs/school/` (`python3 docs/school/build.py`). In the
preview, purchases and progress live in the browser (`lumevina_school`) and every
sale is written to `lumevina_course_sales`, which the dashboard's books read.

To go live:

1. **Checkout.** One Stripe Checkout price per tier (Skin Basics $49, The Course
   $149, Course + Kit $229, Course + Evelyn $449). Members: a 25% coupon, and
   Skin Basics as a $0 grant, both checked against `memberships` by email.
   Skin Basics buyers who upgrade get $49 off with a one-time coupon.
2. **Access.** A `course_access` row per buyer (email, tier, order) written by the
   Stripe webhook; lessons past the two free ones load only for a signed-in
   buyer. Progress (`course_progress`: email, lesson id, done at) replaces
   localStorage so it follows them to any device.
3. **Video.** Host the lesson videos on a private video host (Vimeo, Bunny
   Stream or Mux) with signed URLs, so links can't be shared.
4. **Kits.** Kit tiers add an order to the shelf's stock (the cleanser and
   SPF 30) and to the shipping list; cost is product plus postage.
5. **Calls.** Course + Evelyn opens six slots a month on Evelyn's calendar; the
   buyer's pick creates a video-call booking and a check-in 30 days later.

The lessons in `docs/school/curriculum.js` are drafts: Evelyn reviews each one
before recording, and anything medical points to a dermatologist or doctor.

## Flash openings → push notifications

When a cancellation frees a slot, insert a row into `flash_slots` and send a
push to the tokens in `push_tokens` via APNs (an edge function with an APNs
key, or a service like OneSignal). The app registers tokens through
Capacitor's push plugin — see `app/` and `APP.md`.
