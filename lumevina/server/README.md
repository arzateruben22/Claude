# Lumevina — server (Supabase + Stripe)

The backend that turns the site's demo into the real thing: the shop's
checkout, Evelyn's studio app, the assistant, and in v3 (`js/site-config.js →
version: "v3"`) booking, Glow Membership and Glow Points on the website, with
everything she did in GlossGenius done from her dashboard. **Turning on v3**
below is the checklist.

## What's here

| File | Purpose |
| --- | --- |
| `schema.sql` | Postgres schema: contacts (every client by email, imported from GlossGenius or not), bookings (with a database-level double-booking guard), memberships, the Glow Points ledger, waitlist, orders, gift certificates, site settings, row-level security |
| `functions/book/` | (v3) Website booking: prices the visit, checks her hours and both calendars, holds the time, and opens Stripe Checkout for the deposit and the card on file; get, move, cancel, waitlist, and a client's own list |
| `functions/membership/` | (v3) Glow Membership on Stripe Billing: plans and founding spots, join, and the member's pause, cancel, keep, billing card and gift |
| `functions/rewards/` | (v3) A signed-in client's Glow Points, history, referral link and birthday month |
| `functions/profile/` | A signed-in client's skin profile and the chat's notes about them: see, save (with their yes), forget, delete |
| `functions/studio-book/` | (v3) Evelyn's Appointments: the list, checkout at the visit (tip, products, card on file, cash or a pay link), fees, cancel, booking for a client, card requests, the waitlist |
| `functions/client-reminders/` | (v3) Run hourly: reminder email, the day-before text, review request, rebook nudge, running-low refill, each once |
| `functions/client-prefs/` | (v3) The unsubscribe link in client emails |
| `functions/availability/` | Busy times for the booking calendar: website bookings plus her Google Calendar (where GlossGenius writes) |
| `functions/stripe-webhook/` | Every Stripe event: paid orders, bookings, saved cards, visit pay links, membership invoices and subscription changes |
| `functions/calendar-feed/` | Her appointments as a private calendar feed (.ics) |
| `functions/ask/` | Ask Lumevina: answers everyday questions with Claude from the spa's own facts and the answers Evelyn approved, specific to a signed-in client's profile; remembers what they tell it; hands personal ones to Evelyn with a drafted reply |
| `functions/gift-cards/` | Gift certificates: check a balance, use one at the visit (studio key), list them, sell one in person |
| `functions/client-plans/` | Skin plans: Evelyn writes each client's routine (studio key); the signed-in client reads theirs |
| `functions/create-checkout/` | The shop's real checkout: prices the cart from the products table and opens Stripe Checkout (cards, Apple/Google Pay, pay-over-time, Stripe Tax, shipping or pickup, gift certificates) |
| `functions/studio/` | Lumevina Studio (her dashboard): notifications on, the alerts feed, orders, stock and prices, client questions; in v3 also her hours and extra Mondays, the GlossGenius client import and invitation, the members list, each client's skin profile, and Teach the chat (studio key) |
| `functions/studio-digest/` | Her morning email and notification, led by her priorities for the day (`_shared/priorities.ts`, PRIORITIES.md); sends gift certificates dated for today (run daily by cron) |
| `functions/_shared/orders.ts`, `notify.ts`, `mail.ts`, `sms.ts` | Finishing a paid order; alerting Evelyn (feed, push, email); sending email and texts |
| `functions/_shared/bookings.ts`, `visits.ts`, `membership.ts`, `points.ts`, `contacts.ts`, `hours.ts`, `stripe.ts` | (v3) Pricing and confirming a booking, cancelling, the policy; checking out a visit; membership credits and billing hold; Glow Points; client records; her hours and extra Mondays; Stripe calls |
| `functions/_shared/catalog.ts` | Generated price/duration catalog — the server's source of truth |

## Turning on v3: booking, Glow Membership and Glow Points

v3 moves the client side home from GlossGenius and gives Evelyn the same
jobs in her dashboard. Try it first with `?preview=v3` at the end of the
site's address (that browser only); the dashboard follows the same switch.

### What runs where

| The client | Function | What happens |
| --- | --- | --- |
| Books (Book section) | `book` → `create` | Checks her hours and extra Mondays (`site_settings`), her Google Calendar and the database's overlap guard; uses Glow Points (signed in, up to half the deposit), a gift certificate or a deposit carried over; saves a `pending` booking for 31 minutes and opens Stripe Checkout: the deposit with the card saved, or just the card when nothing is due. A member's facial, or a signed-in client with a card on file and nothing due, is confirmed at once. |
| Pays | `stripe-webhook` (`checkout.session.completed`, `metadata.kind = booking`) | `confirmBooking`: held, card saved on the client, points (100 extra on a first booking here), the membership facial used, her Google Calendar, the confirmation email (and a text if they asked), her alert |
| Moves or cancels | `book` → `get`, `reschedule`, `cancel` (the link in every email, `?manage=<token>`, and My Lumevina) | 48 hours or more ahead, not a Saturday: move it, or cancel with the deposit carried to a new date that month. Later: cancelling keeps the deposit and Evelyn decides on the fee. |
| Finds a day full | `book` → `waitlist` | A cancellation emails the first person waiting |
| Joins a membership | `membership` → `join`, then `stripe-webhook` | Stripe Checkout in subscription mode at today's price (the founding rate for the first 25, kept while the subscription continues); the webhook makes the membership, and each `invoice.paid` adds that month's facial |
| Manages it (My Lumevina) | `membership` → `status`, `pause`, `unpause`, `cancel`, `keep`, `card`, `gift` | Pause skips one billing (once a year); cancel ends after the 3-month minimum or the month paid for; billing holds at 2 banked facials and picks up when one is booked; `card` opens Stripe's billing portal |
| Sees their points | `rewards` → `status`, `birthday` | The ledger, keyed by email, so points earned before signing in are there |
| Unsubscribes | `client-prefs` | Marketing emails stop (appointment emails continue) |

| Evelyn (dashboard, studio key) | Function | |
| --- | --- | --- |
| Appointments | `studio-book` | `list`, `quote`, `checkout` (`card` on file, `cash`, `link` for a pay link they open on their phone, `other`; tip, products, discount, points), `fee` ($43 for a late cancellation; a no-show is 50% of the service, with a deposit already kept counting toward it), `no_show`, `cancel` (refunds the deposit), `book` (for a client, any time; `request_card` emails a card link), `card_link`, `waitlist`, `waitlist_remove` |
| Clients | `studio` | `import_clients` (the GlossGenius client CSV, in chunks of 500), `invite` (one email to each imported client who hasn't booked here: 100 Glow Points on their first booking; `dry: true` counts), `contacts`, `contact_note` |
| Hours, extra Mondays | `studio` | `hours_set`, `extra_mondays_set` (both in `site_settings`, which the website reads) |
| Members | `studio` | `members`, `five_kit` |
| Automatic messages | `client-reminders` (hourly cron) | Reminder email 3 days before; a text the day before to clients who said yes; a review request the day after (`REVIEW_URL`); "time for your next facial" 4 weeks after a visit with nothing booked (members skipped); "running low?" about two months after a shop order, with a link that refills the bag. Each goes once (`sent_messages`). |

### Checklist

1. **Schema.** Run the current `schema.sql` (new: `contacts`, `waitlist`,
   `sent_messages`, `site_settings`, `client_profiles`, `client_memory`,
   `learned_answers`, and new columns on `bookings` and `memberships`).
2. **Secrets.**

   ```sh
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
     SITE_URL=https://her-domain STUDIO_KEY="<a long phrase only Evelyn knows>" \
     RESEND_API_KEY=re_... FROM_EMAIL="Lumevina <hello@her-domain>" OWNER_EMAIL=evelyn@... \
     SITE_VERSION=v3
   # texts (optional; US texting needs an A2P 10DLC registration in Twilio first):
   supabase secrets set TWILIO_SID=AC... TWILIO_TOKEN=... TWILIO_FROM=+1...   # or TWILIO_MESSAGING_SID=MG...
   # optional:
   supabase secrets set REVIEW_URL=https://g.page/r/... STUDIO_ADDRESS="<the studio's address, for confirmations>" PREFS_SECRET=<random>
   ```

   `SITE_VERSION` is the assistant's default; the website also tells it which
   version it runs, so a `?preview=v3` visitor gets v3 answers. Without
   `PREFS_SECRET`, unsubscribe links are signed with the studio key.
3. **Deploy.**

   ```sh
   for f in book membership rewards studio-book studio client-reminders client-prefs availability stripe-webhook ask profile consult create-checkout studio-digest; do
     supabase functions deploy $f --no-verify-jwt
   done
   ```

4. **Stripe.** Webhook endpoint: the `stripe-webhook` function's URL, with
   `checkout.session.completed`, `checkout.session.expired`,
   `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.updated` and `customer.subscription.deleted`.
   Turn on the **customer portal** (Settings → Billing → Customer portal,
   with "update payment method") so Change billing card works. Nothing to
   create for the membership prices: each subscription carries its price.
5. **Cron** (SQL editor, the studio key in Vault as for the morning email):

   ```sql
   select cron.schedule('client-reminders', '7 * * * *', $$
     select net.http_post(
       url := 'https://<project>.supabase.co/functions/v1/client-reminders',
       headers := jsonb_build_object('Content-Type', 'application/json',
         'x-studio-key', (select decrypted_secret from vault.decrypted_secrets where name = 'studio_key')),
       body := '{}'::jsonb);
   $$);
   ```

6. **Website.** In `js/site-config.js`: `version: "v3"`, `shop.supabase`
   and `shop.key`, and `booking.availability`. Sign-in links: Supabase →
   Authentication → URL Configuration (below, under Skin plans).
7. **Dashboard.** Save the studio key under Lumevina Studio; set her hours
   and, when she wants them, extra Mondays (Glow Membership card; off until
   she chooses); Clients → import the GlossGenius CSV, then Invite.
8. **Test in Stripe's test mode first** (card 4242 4242 4242 4242): a guest
   booking with a deposit, one with no deposit, moving and cancelling from
   the email link, a membership join and its first facial, a checkout with a
   tip, a pay link, a late-cancel fee. GO-LIVE.md has the full list.

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

## Skin profiles, the chat's memory, and learning from Evelyn

**Skin profile** (`client_profiles`, `functions/profile`, `js/profile.js`).
In My Lumevina a signed-in client answers nine short questions in about two
minutes: skin type, what they're working on, what they use morning and
night (any brand), anything weekly, supplements, treatments they've had
here or elsewhere, what their skin reacts to, and their goal. It's saved
only with their yes (`consent: true`), and they can edit or delete it.
Medicines and health conditions aren't asked for here; those stay on the
pre-visit form.

**The chat's memory** (`client_memory`). `functions/ask` offers Claude a
`remember` tool: when a signed-in client tells it something lasting about
their skin or routine ("I take collagen every morning"), it saves one short
line. The server refuses anything about medicines, prescriptions, pregnancy
or conditions, skips repeats, and keeps the newest 60. The client sees each
note in My Lumevina and can forget one or all; the chat shows "Noted in your
skin profile" under its answer when it keeps one.

Both go into the client's file (`_shared/profiles.ts` → `profileParts`), so
answers from Evelyn's playbook come out specific to them. A "my skin"
question from a client with a profile now reaches Claude instead of going
straight to Evelyn (as it already did with a plan); Claude still hands her
anything that changes their routine, and never advises on supplements.
Evelyn sees the profile and the notes on each client's card (`studio` →
`client_profile`).

| `profile` action | What |
| --- | --- |
| `get` | the profile and the chat's notes |
| `save` (`profile`, `consent: true`) | saves it |
| `forget` (`id`) / `forget_all` | one note, or all of them |
| `delete` | the profile and every note |

**Learning from Evelyn** (`learned_answers`, `_shared/learn.ts`). When she
sends a reply from Client questions to an everyday question (kind `skin` or
`other`, with "Teach the chat" ticked), Claude reads the question and her
reply and, if there's a general answer in it, writes one: no names, nothing
about that client, in her words, nothing added. It waits in the dashboard's
**Teach the chat** card until she approves it (editing first if she likes)
or dismisses it; she can also add her own and remove any. Approved answers
go into every chat, after the playbook, cached like it. Reactions,
pregnancy, medication, conditions and emergencies are never suggested. This
is how the chat gets better: her playbook, her approved answers, and each
client's own profile. Claude itself isn't retrained on anyone's data.

```sh
supabase functions deploy profile --no-verify-jwt
# ask and studio carry the rest; ANTHROPIC_API_KEY is already set for ask
```

**Sign-in links.** My Lumevina signs clients in with Supabase Auth's emailed
link (no password, no extra library: `js/account.js`). In Supabase → Authentication:
- **URL Configuration:** Site URL = the website's address; add it (and the
  preview address, if any) under Redirect URLs.
- **Email Templates → Magic Link:** Evelyn's wording, if she likes.
- Email sign-ins are on by default; for her own sending address, set up
  custom SMTP with the same Resend account as the confirmations.

## Brakes on the public functions

`create-checkout`, `book` (create and waitlist) and `ask` count their calls per
caller in `request_log` (`_shared/guard.ts`): 8 checkouts in 15 minutes, 6
bookings in 30, 10 waitlist adds in an hour, 30 chat questions in 10, by IP
and by the email given. Past that the call gets a 429 with `reason:
"slow_down"` (the website says so; the chat falls back to its keyword
answers). No real client gets near it; a script holding every time slot or
running up the assistant's bill does. The brake fails open if the table is
missing. Rows clear themselves after a day.

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

## A sale at the studio

Dashboard → Clients: **Check out** on a client, or **New sale** at the top for
someone not in the list yet (js/studio-sale.js). She adds what they're taking
from the shelf, any treatment done on the spot, a discount and a tip, and how
they paid: their card on file (charged now), cash, a pay link (Stripe's page
on their phone), or other. `functions/studio` → `sale` (`_shared/sales.ts`)
writes it as an order with `source: 'studio'` and runs the same finish as a
web order (`_shared/orders.ts` → `fulfillOrder`): stock off, receipt emailed,
Glow Points landed on the subtotal, the products under their Buy again, and
her books. A pay link finishes through the webhook when they pay. The row's
Purchases column (`client_orders`) shows everything they've bought, online
and at the studio. Run the current `schema.sql` once for the `orders.source`
column.

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

Email goes through [Resend](https://resend.com) (verify the sending domain,
then `RESEND_API_KEY` and `FROM_EMAIL`); texts through Twilio, optional.
The booking's own messages (confirmed, moved, cancelled, card requests) go
out from `_shared/bookings.ts` as they happen; the scheduled ones (reminders,
the day-before text, review, rebook, running low) from `client-reminders`,
hourly (Turning on v3 → Cron). The booking form asks for a mobile number and
whether to text a reminder; nobody is texted without that yes. The older
`notifications` table in `schema.sql` is no longer used.

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
   editor).
4. In Supabase Auth settings, enable **Email (magic link)** — no passwords.
5. Create a [Stripe](https://stripe.com) account. Copy the **secret key** and
   set the function secrets (keys live only here — never in the repo or app):

   ```sh
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

6. Deploy the functions and add the Stripe webhook: Turning on v3 → Deploy
   and Stripe (for the shop alone, `create-checkout` and `stripe-webhook`).

## How the website talks to the server

Every module checks `js/site-config.js → shop` and runs in demo mode (this
browser only, test cards) until it's filled in:

- `js/booking.js` → `book` (and `availability`); `js/manage.js` → `book`
  for the link in each email.
- `js/membership.js` → `membership`; `js/rewards.js` → `rewards`;
  `js/account.js` → Supabase Auth (the emailed sign-in link) and `book` →
  `mine` for the client's appointments.
- `js/hours.js` and `js/extra-days.js` → `site_settings` (read) and
  `studio` (her saves).
- `js/cart.js` → `create-checkout`; `js/ask.js` → `ask`.
- The dashboard → `studio`, `studio-book`, `gift-cards`, `client-plans`.

Card numbers never touch the website or the server: Stripe's own pages take
them, and the server keeps only Stripe's customer and card ids and a label
like "Visa •••• 4242".

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

Built (v3): `functions/membership` and `_shared/membership.ts`, with the
browser's rules from `js/membership.js` (the demo) mirrored on the server.

- **Prices.** Glow $185 and Ageless $235 a month; the first 25 members join
  at the founding rate, $175 and $225, kept for as long as the subscription
  continues (`PLANS` in `_shared/membership.ts` and `js/membership.js`; keep
  them the same). Each subscription is created with its own price, so a
  later price change never touches existing members.
- **Join** = Stripe Checkout in subscription mode (the terms are shown on
  Stripe's page too). The webhook creates the `memberships` row
  (`ensureMembership`): the Founding Five number and kit for the first five,
  `min_ends_at` three months out.
- **Each paid month** (`invoice.paid`, `creditInvoice`) adds one facial.
  With two banked, billing holds (`pause_collection: void`, `on_hold`) and
  picks up when one is booked (`resumeBilling` in `confirmBooking`).
- **Pause** skips the next billing, once a year. **Cancel** sets `cancel_at`
  to the later of the minimum and the month paid for; banked facials stay
  usable 60 days after. California's automatic-renewal law wants online
  cancellation when the signup was online, and the price, frequency, minimum
  and how to cancel shown at join: both are in place.
- **Booking with a membership facial** costs nothing and needs no deposit;
  the rest of the visit is 15% off for members; skincare 10% (Glow) or 15%
  (Ageless) off at checkout.
- **Gift** a banked facial: a gift certificate for that facial, emailed.

Have the member terms reviewed before launch.

### Extra Mondays

`js/extra-days.js` holds the owner's choice (off, every other Monday, every
Monday), set from the dashboard's Glow Membership card. The calendar opens
those Mondays (11 to 7); members book them first and everyone else from the
Friday before. Live, it's one row in `site_settings` (`extra_mondays`),
saved through `studio` → `extra_mondays_set`, read by every browser, and
checked again in `book` (`_shared/hours.ts`: `members_first` for a
non-member before the Friday). Off until she turns it on.

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
   in `stripe-webhook`, when an order with shipped items is paid, insert a
   `shipments` row: package and weight from the same
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
   includes an email. To send it from Lumevina instead, email the tracking
   link (`_shared/mail.ts`) when a row turns `shipped`.

## Running both calendars

While GlossGenius appointments are still on her calendar (v2 with
`mode: "both"`, or the first weeks of v3), the two have to see each other. Both have to see each other's appointments, or the
same time gets booked twice. GlossGenius has no public API, but it syncs
with **Google Calendar both ways**, so her Google Calendar is the meeting
point and the website only talks to Google:

```
GlossGenius  ⇄  her Google Calendar  ⇄  website (server/functions)
```

- **GlossGenius → website:** GlossGenius puts each appointment in her Google
  Calendar. `functions/availability` reads her busy times (Google freeBusy)
  plus the website's own bookings, and the Book section greys those times
  out. `book` checks Google once more before holding the time.
- **Website → GlossGenius:** when a booking is confirmed, `confirmBooking`
  writes it into her Google Calendar (`_shared/google.ts`), and
  GlossGenius blocks that time. Moves and cancellations update it.

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
   (and redeploy `book`, `studio-book` and `stripe-webhook`).
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

The ledger is `rewards_ledger`, keyed by email (`_shared/points.ts`, the
same rules as `js/rewards.js`): 1 point per $1 paid (deposits, the rest of
the visit at checkout, shop orders, gift certificates; never the tip),
double on a Wednesday or a Wax Wednesday booking, +100 on a client's first
booking on the website (not when Evelyn books it for them), +50 once a year
in their birthday month, and +25 when a **non-member's** next visit is
within 5 weeks of the last (members already have a facial every month).
100 points take $10 off; points cover up to half of a deposit, or any part
of a visit at checkout. A booking cancelled in time hands its points back
(the `return_booking_points` trigger).

Referrals give both sides $15: the friend gets **$15 off their first visit**
(`book` records the code from `?ref=` in `bookings.referral_code` when it's
their first booking and someone else's code), and the client who shared it
gets **150 points** when that first visit is checked out (`completeVisit`,
once per friend). **Share my code** (My Lumevina) opens the phone's share
menu with a link like `https://her-domain/?ref=GLOW-AB12`, built from
`SITE_URL`.

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

The product sheet shows "From Skin School: <lesson>" while the course is on (`js/shop-lessons.js`: cleansers, moisturizers, sunscreens, toners, eye care, masks and supplements by category; serums and spot care by the active in their name). `school.html#learn-1-2` opens that lesson straight away (the links in the TikTok captions and the free lessons in the page's structured data); plain `#learn` opens where they left off. `docs/school/seo.js` writes the course as structured data from the curriculum itself: the three levels with their lesson counts, the hours, the tiers as offers and the two free lessons, so search engines see the course without a hand-kept copy.

## Flash openings → push notifications

When a cancellation frees a slot, insert a row into `flash_slots` and send a
push to the tokens in `push_tokens` via APNs (an edge function with an APNs
key, or a service like OneSignal). The app registers tokens through
Capacitor's push plugin — see `app/` and `APP.md`.

## Evelyn's priorities (Lumevina Studio → Today)

One ranking (`_shared/priorities.ts`; PRIORITIES.md in plain words) feeds the dashboard's Today card (`studio` → `priorities`), the morning push and email (`studio-digest`: the push carries the top three from "right now" and "today" and goes whenever there is anything in those tiers), and the hourly run (`client-reminders` → `owner_nudge`: "Still waiting: Maya" once a question passes its promised reply time). A failed membership invoice (`invoice.payment_failed`) sets `memberships.billing_failed_at`, tells her, and the next paid invoice clears it. On a database created before Oct 21, 2026:

```sql
alter table questions add column owner_nudged_at timestamptz;
alter table memberships add column billing_failed_at timestamptz;
```

## The consult gate, and the online Skin Consult

Some products need Evelyn's yes before they sell: benzoyl peroxide (Acne Med), the 11% and 15% mandelic serums, Retinal B3, Retinol Peptide, Hydroxi (`js/catalog.js` → `consult: true`; the list follows what the brands answer, STOREFRONT.md step 0). On the shelf they show **Needs a quick consult** instead of Add to cart. The client writes a few lines about their skin (`js/consult.js`); Evelyn approves or declines in the dashboard (Consults); approval is by email, so the same address checks out normally afterwards, signed in or not. `create-checkout` checks the same approval, so the gate can't be skipped by the chat or a crafted request.

The **online Skin Consult** is a line in the catalog (`svc-online-consult`, `kind: "consult"`, $35): the shop shows it as a card above the shelf, it checks out like a product (no shipping, services tax code), and on payment the client gets "what happens next", Evelyn gets a notification, and a row lands in Consults. **Done** unlocks every active for that email and issues a $35 gift certificate (`gift_cards`, source `studio`), emailed with the code.

```
functions/consult        request (a client asks; "got it" email; her phone), status (what this email may buy)
functions/studio         consults, consult_decide { id, status, reply?, products? }, consult_done { id }
_shared/consults.ts      approvedFor / mayBuy (the check), requestConsult, decideConsult, consultPaid, consultDone
_shared/priorities.ts    "Waiting to buy" (right now), "online consults to schedule" (today)
```

Deploy and migrate:

```
supabase functions deploy consult --no-verify-jwt
supabase functions deploy create-checkout studio stripe-webhook studio-digest client-reminders --no-verify-jwt
```

```sql
alter table products add column if not exists kind text not null default 'product' check (kind in ('product', 'consult'));
alter table products add column if not exists consult boolean not null default false;
create or replace view shelf as select id, stock, price_cents, hidden, kind, consult from products;
-- then the consults table from schema.sql (it has owner_nudged_at), and: node scripts/seed-products.mjs (it carries kind and consult)
```

**Buy again** (`js/buy-again.js`, My Lumevina): a signed-in client's past shelf purchases, one tap back into the bag. Live, the website reads `orders` straight through PostgREST with the client's own token (`select=items,paid_at&status=eq.paid`); the policy `clients read their own orders` in schema.sql limits it to rows whose email matches the signed-in email, so no function is involved. Gated actives go through the consult gate as usual. The order receipt and the "running low?" email carry the same one-tap link (`?reorder=<ids>#shop`).
