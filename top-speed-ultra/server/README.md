# OC Ultra store: the server, and how to go live

The store in the game runs in **TEST MODE** until you finish every step below and decide to switch it on. In test
mode nothing is charged, the card form takes Stripe's test cards only, and nothing leaves the player's browser. This
folder is everything the live store needs on the server side. **Nothing here is deployed yet.**

```
server/
  README.md                                    this file: the go-live steps, in order
  supabase/
    config.toml                                function settings for the Supabase CLI (both functions check their own auth)
    .env.example                               the function secrets to set (copy to .env, never commit .env)
    migrations/0001_oc_ultra_store.sql         the tables and their row-level security
    migrations/0002_founder_serials.sql        the OC Hypercar Founder Edition's serial numbers
    functions/create-checkout/index.ts         starts a purchase: checks the player and the item, opens Stripe Checkout
    functions/stripe-webhook/index.ts          Stripe tells us what was paid, refunded or cancelled; this writes it down
    functions/_shared/catalog.json             the server's own copy of the catalog (npm run store:sync; never by hand)
    functions/_shared/store.ts                 catalog rules, Supabase and Stripe calls (fetch only, no SDKs)
    functions/_shared/stripe-signature.ts      the webhook signature check (Web Crypto)
    functions/_shared/form.ts                  Stripe's form encoding
    tests/run-local.sh                         optional: run the migration on a throwaway local Postgres and probe its security
    tests/serial-webhook.mjs                   optional: the Founder Edition's serial numbers through the real webhook
    tests/ultra-entitlement.mjs                optional: the Ultra graphics tier, grant, revoke and restore, end to end
```

The game side is `src/store/` (config, account, entitlements, payments, locker) and `src/ui/Store.tsx`. The game's
build reads three settings (`../.env.example`). How it fits together:

```
 game (browser)                                Supabase (free)                         Stripe
 ───────────────                               ───────────────                         ──────
 Store → Sign in ─── magic link email ───────▶ Auth (sends the link via Resend)
 Buy ── token + sku only ───────────────────▶ create-checkout ── price from its own ──▶ Checkout Session
     ◀──────────────── { url } ──────────────                     catalog copy
 → Stripe's hosted page (card, Apple Pay, Google Pay) ─────────────────────────────────▶ charge
 ◀── back to the game ?checkout=success ─────────────────────────────────────────────── 
                                               stripe-webhook ◀── signed event ──────── checkout.session.completed
                                               → purchases + entitlements rows
 game reads its entitlements (own rows only) ◀─ entitlements table (row-level security)
```

What it costs: Supabase Free is $0 (it pauses after a week with no activity; see step 10). Stripe has no monthly fee
and takes 2.9 % + 30¢ per successful US card charge. Resend (the sign-in email sender) is free up to 3,000 emails a
month and 100 a day. A domain is about $10 a year and is effectively needed for sign-in email (step 3). These figures
are from `PROJECT_OC_MONETIZATION.md` §5 and §7 (checked 2026-10-16); check them again at launch.

**Keys, once, before you start.** The publishable/anon key is public by design and goes in the game. The
**service-role key, any secret key, the Stripe secret key and the webhook secret never go in the game, in chat, in a
screenshot or in git.** They live in Supabase's function secrets only. If one leaks, roll it in the dashboard.

You'll type commands in a terminal, in the `top-speed-ultra` folder. The Supabase CLI runs through `npx` (nothing to
install in the project): the first run downloads it.

---

## 1. Create the Supabase project (free)

1. Go to supabase.com, sign in (GitHub sign-in is fine), and click **New project**.
2. Name: `oc-ultra`. Region: **West US** (the one closest to Orange County). Set a database password and save it in
   your password manager. Plan: **Free**.
3. Wait for it to finish setting up (a minute or two).

**It worked when** Project Settings → API (it may be called "Data API" or "API Keys") shows a **Project URL** like
`https://abcdefghijkl.supabase.co` and an **anon** (or **publishable**, `sb_publishable_…`) key. The 12 letters in the
URL are your **project ref**. Write the URL and the ref down; you need them below.

## 2. Run the migration

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Open `server/supabase/migrations/0001_oc_ultra_store.sql` in a text editor, copy all of it, paste it in, and
   click **Run**. It is safe to run twice.
3. Then the same with `server/supabase/migrations/0002_founder_serials.sql`: the OC Hypercar Founder Edition's
   serial numbers (a counter per numbered sku, the `serials` ledger, a `serial` column on `entitlements`, the
   `assign_serial` function only the webhook may call, and a trigger that retires a refunded number). Also safe to
   run twice.

**It worked when** the editor says "Success. No rows returned", and **Table Editor** lists `profiles`, `purchases`,
`entitlements`, `waitlist`, `invite_codes`, `serial_counters` and `serials`, each marked **RLS enabled** (no "RLS
disabled" warning).

Optional check (if you have Postgres on your computer): `server/supabase/tests/run-local.sh` runs the migrations on a
throwaway local database and tries every write a player or a stranger must not be able to make, on the 0001 tables
and on 0002's `serials`, `serial_counters`, `assign_serial` and `retire_serial`. Each one should print as `refused`.
(On 2026-10-16 it did for 0001, in `tests/out/store-rls.log`; on 2026-10-19 for both, in
`tests/out/store-rls-r2.log`.) The serial numbers have their own end-to-end check: `node
server/supabase/tests/serial-webhook.mjs` runs the real `stripe-webhook` function against a throwaway database with
both migrations (retried and concurrent deliveries keep one number, a refund retires it, the founder window is
judged by when the session was created, a player can read but never write a number, a second purchase by a player
who holds a number is refused and refunded, a refund that arrives before its completion leaves nothing granted, and a
refund racing the numbering never leaves a live number on a refunded purchase). The Ultra graphics tier (the
`graphics-ultra` sku and entitlement, decision 15) has its own end-to-end check: `node
server/supabase/tests/ultra-entitlement.mjs`. It runs the real `create-checkout` and `stripe-webhook` against a
throwaway database. A player's requests run under row-level security. The game's own store code, built live against
that database, does Restore purchases. It checks the checkout line at the server's price, that live keys refuse the
sku while it isn't `ready`, the webhook's one grant, a refund's revoke, and the restore on another device. It also
checks the lock, that owner mode works in a test build and is ignored in a live one, and a test-mode build with the
4242 card. Ultra needs no migration of its own: it is a row in 0001's `entitlements` table, which `rls-probe.sql` now
probes for it too.

Before live mode, two optional hardenings came out of the 2026-10-19 review (`PROJECT_OC_MONETIZATION.md` §12). One
is built (ST2, 2026-10-21): a live build that boots with a player signed in calls `restore()` once, so an item bought
on another device shows without opening the Store, and a locally edited cache can't keep the OC Hypercar or show a
made-up number past the next launch once that read answers (offline, the cache still shows). The other is not built:
handle `charge.dispute.closed` with status `lost` like a refund (retire the number, take the car back). The webhook
ignores dispute events today.

## 3. Sign-in email: settings and a mail sender

Supabase's built-in email only sends to your own team (2 an hour), so players can't sign in until you add a sender.

1. **Authentication → URL Configuration.**
   - **Site URL**: the game's address, for example `https://<org>.github.io/` (the hosting plan is
     `PROJECT_OC_LAUNCH_90.md` F4).
   - **Redirect URLs**: add the game's page with a wildcard, for example `https://<org>.github.io/**`. Sign-in links
     come back to the page the player was on, with `?store=signin`. A URL that isn't listed here is not an error:
     Supabase sends the player to the Site URL instead (reported by a third-party write-up, checked 2026-10-16;
     verify at launch), so the link still signs in but may land on a different page.
2. **Authentication → Sign In / Providers → Email**: email sign-in on. Magic links need no password.
3. **A sender (Resend, free).** Make an account at resend.com, add your domain and the DNS records it shows (at your
   domain registrar), wait for "Verified", then create an API key. In Supabase, **Authentication → Emails → SMTP
   Settings**: turn on custom SMTP. Host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key,
   sender `signin@<your domain>`, sender name `OC Ultra`. Turn Resend's click tracking **off** (tracking rewrites the
   link and can break it).

**It worked when** you sign in from the game (step 8) with an email address that is *not* on your Supabase team and
the link arrives within a minute.

## 4. Create the Stripe account, in test mode

1. Go to dashboard.stripe.com/register and create the account. **Don't activate payments yet.** Keep the
   **Test mode** switch (top right) on for every step until step 10.
2. **Settings → Business → Customer emails**: turn on **Successful payments** and **Refunds**, so Stripe emails every
   receipt.
3. **Settings → Public details**: statement descriptor `OC ULTRA` (TODO: or your legal name), support email (TODO).
4. **Developers → API keys**: copy the **Secret key** (`sk_test_…`). You need it in the next step. Never paste it
   anywhere else.

**It worked when** the dashboard shows the orange "Test mode" banner and the secret key starts with `sk_test_`.

## 5. Set the function secrets

1. Copy `server/supabase/.env.example` to `server/supabase/.env` and fill it in:
   - `STRIPE_SECRET_KEY`: the `sk_test_…` key from step 4.
   - `STRIPE_WEBHOOK_SECRET`: leave as is for now; step 7 gives you this.
   - `SITE_URL`: the exact page players play on, for example `https://<org>.github.io/` (Stripe sends players back
     here).
   - `ALLOWED_ORIGINS`: the site's origin, for example `https://<org>.github.io` (no path). Comma-separate several.
2. In a terminal, in `top-speed-ultra/server`:
   ```
   npx supabase@latest login
   npx supabase@latest link --project-ref <your project ref>
   npx supabase@latest secrets set --env-file supabase/.env
   ```
   Supabase gives every function `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` by itself; don't
   set those. (If your project only has the newer secret keys, set `STORE_SERVICE_KEY` to the `sb_secret_…` key.)

**It worked when** `npx supabase@latest secrets list` shows `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`
and `ALLOWED_ORIGINS` (the values stay hidden).

## 6. Deploy both functions

In `top-speed-ultra`:

```
npm run store:sync                 # the server's catalog copy, from src/store/catalog.json and cosmetics.json
npm run store:check                # both catalog checks must pass
cd server
npx supabase@latest functions deploy create-checkout --no-verify-jwt
npx supabase@latest functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` is on purpose for both. `create-checkout` checks the player's sign-in itself (it asks Supabase Auth
who the token belongs to), which works with the old and the new API keys. `stripe-webhook` is called by Stripe, which
has no Supabase token: the Stripe signature is its check. (`config.toml` says the same, for the CLI.)

**It worked when** opening `https://<ref>.supabase.co/functions/v1/create-checkout` in a browser shows
`{"livemode":false,"on_sale":[ …11 skus… ]}`. Re-run `npm run store:sync` and both deploys after **any** change to
the catalog files: the server charges and grants what its copy says, not what the game says.

## 7. Add the webhook endpoint in Stripe

1. Stripe dashboard (still in Test mode) → **Developers → Webhooks** → **Add endpoint** (it may be called "Add
   destination").
2. Endpoint URL: `https://<ref>.supabase.co/functions/v1/stripe-webhook`.
3. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`,
   `customer.subscription.deleted`. Nothing else is needed (anything else is answered 200 and ignored).
4. Open the endpoint, reveal the **Signing secret** (`whsec_…`), put it in `server/supabase/.env` as
   `STRIPE_WEBHOOK_SECRET`, then in `top-speed-ultra/server`:
   ```
   npx supabase@latest secrets set --env-file supabase/.env
   npx supabase@latest functions deploy stripe-webhook --no-verify-jwt
   ```

**It worked when** the endpoint's **Send test event** with `checkout.session.completed` shows a **200** response
(Stripe's sample event has no player in it, so the body says `"ignored"`). A request without a signature should fail:
`curl -X POST https://<ref>.supabase.co/functions/v1/stripe-webhook -d '{}'` answers `400 {"error":"bad signature"}`.

## 8. Set the game's settings and rebuild

1. Copy `top-speed-ultra/.env.example` to `top-speed-ultra/.env.production.local` (git ignores it) and fill in:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<the anon or publishable key from step 1>
   VITE_PAYMENTS_LIVE=true
   ```
   Only the anon or publishable key, ever. Vite bakes every `VITE_` value into the page for anyone to read.
2. `npm run build`, then deploy `dist/top-speed-ultra.html` to the game's website the usual way.
3. The Claude artifact preview (`dist/artifact.html`) should stay in test mode: build it **without** this file (move
   `.env.production.local` aside, `npm run build`, republish, move it back).

**It worked when** the Store on the game's website says **Secure checkout** where it said **Test mode**, and the
checkout sheet's button says "Checkout" instead of "Pay … (test)".

## 9. One test purchase, end to end (Stripe test mode)

On your phone or computer, on the game's website:

1. **Store** → **Buy · $3** on the Coast Paint Pack → answer the month and year → type your email → **Send my sign-in
   link**.
2. Open the email **on the same device** and tap the link. The game opens with the Store showing you signed in.
3. **Buy · $3** again → tick "I'm 18 or over…" → **Checkout · $3.00**. Stripe's page opens and says **Test mode**.
4. Card `4242 4242 4242 4242`, any future date, any CVC, any ZIP → **Pay**.
5. Stripe sends you back. The Store says "Confirming your purchase…", then shows the receipt.

**It worked when** all of these are true:

- Supabase **Table Editor → purchases** has one row: sku `paint-pack-coast`, status `paid`, amount `300`.
- **entitlements** has four rows for you (the four Coast paints), `revoked_at` empty.
- Stripe **Payments** shows a $3.00 test payment, **Succeeded**, and the webhook endpoint shows the event delivered
  with **200**. Stripe emailed a test receipt.
- In the game, **Your items** lists the four paints, and one goes on your car.

Then try the two other paths:

- **Decline**: buy another item and use `4000 0000 0000 0002` on Stripe's page. Stripe says declined; no new row in
  `purchases`.
- **Refund**: in Stripe, open the $3.00 payment → **Refund** (full). Within a few seconds `purchases.status` becomes
  `refunded` and the four `entitlements` rows get a `revoked_at`. In the game, **Restore purchases**: the paints are
  gone and the car is back in its factory paint.
- **Restore on another device**: sign in with the same email on a second browser and tap **Restore purchases**.

## 10. Live keys, only when you decide

Not before every item in `PROJECT_OC_MONETIZATION.md` §10 is done: the prices approved, the support email and
statement descriptor set, the terms, refund policy and privacy policy reviewed by a lawyer, the trademark searches
done, and your decision on an individual seller or an LLC. Then:

1. Stripe: **Activate payments** (business details, identity, bank account). Switch **Test mode** off.
2. **Developers → API keys** (live): copy the live secret key (`sk_live_…`) into `server/supabase/.env` as
   `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks** (live): add the same endpoint and the same four events again. Live and test endpoints
   have different signing secrets: copy the live `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
4. `npx supabase@latest secrets set --env-file supabase/.env`, then deploy both functions again (step 6).
5. Make one real purchase yourself and refund it end to end (`PROJECT_OC_LAUNCH_90.md` L6).

**What live keys change.** With an `sk_live_`/`rk_live_` key, `create-checkout` sells only items whose every grant is
`ready` in `src/store/cosmetics.json` (`CLAUDE.md`: nothing is sold before it exists in the game). **On 2026-10-16
none is**: the paints are `hook` (their finish hook is now built, see `PROJECT_OC_TECHNICAL_NOTES.md` → Store, but
the statuses wait for the review pass to check the renders), and the Founder badge, frame and roll are `build`. So a
live store shows every item as "On sale once it is in the game" until those statuses change, `npm run store:sync`
runs and the functions are redeployed. **It worked when** `…/functions/v1/create-checkout` says `"livemode":true`
and `on_sale` lists exactly the items you meant to sell.

**Keep Supabase awake.** A Free project pauses after a week with no activity, and a paused project can't answer
Stripe's webhook (Stripe retries for up to three days in live mode; after that, resend the event from the dashboard).
Check the project weekly, or use Pro ($25 a month) for the live months (`PROJECT_OC_MONETIZATION.md` §8.5).

**Switching the store off.** Set `VITE_PAYMENTS_LIVE=false` (or delete the file), rebuild and deploy: the store goes
back to test mode for everyone. Purchases stay in Supabase and Stripe; refund anyone affected from Stripe.

---

## What each part checks

- `create-checkout` refuses: no or expired sign-in (401); an unknown, unavailable or expired item, or (live keys) one
  not yet in the game (409); a missing 18-or-guardian tick, or for the club a missing renewal tick (400); a profile not
  marked 13+ (403); an item whose grants you already all own (409). It never reads a price from the page. The tip's
  pay-what-you-want price is a Stripe Price it makes once (lookup key `tip-fuel-the-build`, $2 to $100, $5 suggested)
  and reuses.
- `stripe-webhook` refuses any delivery whose `Stripe-Signature` doesn't match (HMAC-SHA256, 300 s tolerance) with a
  400 and writes nothing. A redelivered event changes nothing (`stripe_session_id` is unique, and a refunded purchase is
  never re-granted). A refund takes back only what no other paid purchase of yours grants. A cancelled club takes back
  only its while-subscribed items. A database error is a 500, so Stripe retries.
- Row-level security: players read only their own purchases and entitlements, and only the service role writes them;
  the waitlist takes anonymous sign-ups (email, ZIP, referrer) and shows them to nobody but the service role.

## Not built yet (each is a small, separate job)

- **The club**: `club-monthly` and `club-yearly` are `available: false`. Before they open: Stripe's customer portal for
  cancelling online (Settings → Billing → Customer portal), an `invoice.paid` handler that adds each month's club paint,
  the consent record kept three years (California's automatic renewal law; `PROJECT_OC_MONETIZATION.md` §4), and a
  lawyer's read of the renewal terms. The game already shows the terms before an unticked checkbox.
- **A refund-request button** in the store (today the terms point to a support email, TODO).
- **Invite codes and the waitlist form**: the tables exist; nothing in the game or on a site writes to them yet.
- **The Founders roll**: the opt-in name is stored on the purchase (`purchases.roll_name`); baking approved names into
  a credits screen is still to build.
- **Disputes** are ignored by design (no account is ever locked over a dispute, per the FTC's Epic order cited in the
  monetization doc); answer them from the Stripe dashboard.

## Checked on 2026-10-16, and what to verify at launch

Checked here: the migration ran twice on PostgreSQL 16 with a stub of Supabase's roles, and every forbidden write was
refused (`tests/out/store-rls.log`); the webhook's signature check passes RFC 4231's HMAC-SHA256 vector and a
Stripe-style delivery signed independently with Node's crypto, and refuses a tampered body, a wrong secret, a
timestamp 301 s off either way, and missing or malformed headers; the form encoding (`npm test -- --only=store`).
Both functions type-check under TypeScript 5.5 in strict mode with only `Deno.env.get` and `Deno.serve` declared (no
Deno here to run them). The game's live code path was run against a mock project (`npm test -- --only=store-live`): the game built with live
settings, served over http, with Supabase and Stripe's page answered by the test. That checks the game's side of every
call below; it can't check that the real services answer the same way.

**Checked by web search on 2026-10-16** (the build machine still can't open docs.stripe.com or supabase.com
directly, so these come from search results quoting those pages, not from reading them whole):

- The signature scheme the webhook checks: `Stripe-Signature: t=…,v1=…` (test events can add a `v0` to ignore), the
  signed payload is the timestamp, a `.` and the raw body, HMAC-SHA256 keyed with the endpoint's `whsec_` secret,
  one `v1` per active secret while a secret is rolled, and Stripe's own libraries allow **5 minutes** between the
  timestamp and now (`_shared/stripe-signature.ts` uses 300 s). Each retry is signed again with a new timestamp, so
  the tolerance doesn't break retries. Source: [docs.stripe.com/webhooks](https://docs.stripe.com/webhooks) and
  [docs.stripe.com/webhooks/signature](https://docs.stripe.com/webhooks/signature).
- Test cards: `4242 4242 4242 4242` is a successful Visa charge
  ([docs.stripe.com/testing](https://docs.stripe.com/testing)); `4000 0000 0000 0002` is the generic decline
  (`card_declined` / `generic_decline`). Stripe's page shows that row, but the number itself was confirmed only by
  third-party references ([bug0.com](https://bug0.com/blog/stripe-test-cards-2026)). Test cards work only with test
  keys.
- Checkout: `{CHECKOUT_SESSION_ID}` goes into `success_url` literally and Stripe fills it in on the way back
  ([docs.stripe.com/payments/checkout/custom-success-page](https://docs.stripe.com/payments/checkout/custom-success-page));
  `client_reference_id` holds up to 200 characters, and a Supabase user id is 36
  ([docs.stripe.com/api/checkout/sessions](https://docs.stripe.com/api/checkout/sessions)).
- Pay what you want (the tip): a Price with `custom_unit_amount` (`enabled`, `minimum`, `maximum`, `preset`), used by
  its id in the Checkout Session, quantity 1 and no other line items
  ([docs.stripe.com/payments/checkout/pay-what-you-want](https://docs.stripe.com/payments/checkout/pay-what-you-want),
  [docs.stripe.com/api/prices/create](https://docs.stripe.com/api/prices/create)). That is how `create-checkout` builds it.
- Fees: Stripe's standard US domestic card rate is **2.9 % + 30¢** per successful charge, plus 1.5 % for
  international cards and 1 % when currency is converted ([stripe.com/pricing](https://stripe.com/pricing)).
- Supabase Auth: `POST /auth/v1/otp` with `create_user` in the body sends a magic link (the client libraries' option
  of the same name defaults to true); the redirect must be allow-listed, otherwise the Site URL is used (step 3)
  ([Supabase signInWithOtp reference](https://supabase.com/docs/reference/dart/auth-signinwithotp); the body fields
  from a [community thread](https://forum.nordcraft.com/SOLVED-Supabase-Prevent-non-registered-users-from-using-Magic-Link-Login)).
- Supabase Free pauses a project after **one week** with no activity; the data is kept and it can be restored from
  the dashboard. Only third-party summaries said so
  ([jetadmin.io, 2026](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)),
  so read Supabase's own pricing page before you rely on it.

**Not checked**, because nothing is deployed: the functions have never run in Supabase's Edge Runtime or against
Stripe's API, and the details below come from documentation rather than from a real call. Step 9 is the real test.
Verify each at launch:

- Supabase Auth's REST endpoints and the magic-link return: `POST /auth/v1/otp?redirect_to=…` with `{ email,
  create_user }`, the session in the URL's `#access_token=…&refresh_token=…` fragment, `GET /auth/v1/user`,
  `POST /auth/v1/token?grant_type=refresh_token`, `POST /auth/v1/logout`.
- The Edge Runtime's JSON import (`import … with { type: 'json' }`), its default secrets, and `--no-verify-jwt` with
  the newer API keys.
- Stripe: Checkout Sessions with `price_data` (and `recurring` for the club), `client_reference_id`, `metadata`,
  `payment_intent_data.metadata`, `subscription_data.metadata`, the `{CHECKOUT_SESSION_ID}` placeholder; Prices with
  `custom_unit_amount` and `transfer_lookup_key`; hosted Checkout URLs on `checkout.stripe.com` (the game only follows
  those, so a custom checkout domain needs a one-line change in `src/store/payments.ts`); the signature scheme above;
  the test cards `4242 4242 4242 4242` (succeeds) and `4000 0000 0000 0002` (declined).
