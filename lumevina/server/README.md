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
| `functions/_shared/catalog.ts` | Generated price/duration catalog — the server's source of truth |

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
   monthly **Price** ($159 / $209). Clear-skin clients join Glow, which covers
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

## Ask Lumevina (client questions)

`js/ask.js` runs the chat in the browser today: keyword matching answers the
everyday questions, and personal ones are saved to localStorage for the
dashboard's **Client questions** card. To make it real:

1. `supabase secrets set ANTHROPIC_API_KEY=...` and
   `supabase functions deploy ask`. Run the `questions` table in
   `schema.sql`.
2. In `js/ask.js`, send each question to the function instead of
   `classify()`: `POST /functions/v1/ask` with `{ message, history, name,
   email }` and the client's session. It returns `{ answer }`, or
   `{ handoff, due_at }` once the question is saved for Evelyn
   (`needs_contact: true` means ask for a name and email first).
3. The dashboard reads `questions where status = 'waiting'` (members, then
   soonest due), and Send writes `reply`, `status = 'answered'` and
   `answered_at`, then emails the reply with `send-confirmation`'s
   `sendEmail`. The client's chat shows it from their own rows.

How it stays safe: the hand-off rules (reactions, pregnancy, medications,
skin conditions, "what should I use on my skin", emergencies) run as plain
code before any AI call, so they never depend on the model. Claude only
answers from the facts in the function, can hand off on its own when a
question isn't covered, and drafts replies that Evelyn always reviews.
Cost: at a small spa's volume, a few dollars a month (the fast, inexpensive
model is set in `MODEL`).

## Glow Points, rebooking and referrals

The +25 rebooking bonus is for **non-members** (members already have a
facial every month): it's earned when a visit falls within 5 weeks after the
client's last one. `stripe-webhook` records what each booking earned in
`bookings.points_earned`; when a booking is cancelled in time, the
`return_booking_points` trigger hands those points back and the visit stops
counting toward the next rebooking bonus. The website does the same today
(`js/rewards.js` `reverse`, called from My Lumevina's cancel).

Referrals: **Share my code** (Glow Rewards and My Lumevina) opens the phone's
share menu with a link like `https://lumevina.com/?ref=GLOW-AB12`, or copies
it where there's no share menu. A visitor arriving with `?ref=` has the code
remembered and filled in on their first booking; the referral-credit trigger
at the end of `functions/stripe-webhook/index.ts` pays the 150 points once
that first visit is completed. Set the live address in `js/rewards.js`
(`SITE`) when the domain is final.

## Flash openings → push notifications

When a cancellation frees a slot, insert a row into `flash_slots` and send a
push to the tokens in `push_tokens` via APNs (an edge function with an APNs
key, or a service like OneSignal). The app registers tokens through
Capacitor's push plugin — see `app/` and `APP.md`.
