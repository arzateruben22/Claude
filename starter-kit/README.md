# Booking & Commerce Starter Kit

The **reusable engine** behind a GlossGenius-class spa/salon/service site —
scheduling, loyalty points, gift certificates, retail inventory, saved-card
payments, in-person settlement, and analytics — with **no template, no fonts,
no color scheme**. You bring the design; this brings the brains.

Everything is **headless**: plain JavaScript modules that own the *rules and the
data*, and hand you plain numbers/objects to render however you like. Drop them
into any stack (vanilla, React, Vue, Svelte, Astro…) and any design.

---

## What's in the box

| Engine | File | Does |
|---|---|---|
| **Storage adapter** | `core/store.js` | One place data lives. localStorage / memory / your Supabase. |
| **Payments + vault** | `core/payments.js` | Card validation, brand, saved-card-on-file, the single Stripe swap point. |
| **Loyalty / points** | `core/rewards.js` | Earn/spend, blocks→$, welcome, referral, birthday, streak. |
| **Gift certificates** | `core/giftcards.js` | Issue codes, redeem with rollover balances, outstanding liability. |
| **Retail inventory** | `core/inventory.js` | Stock, low-stock, online + in-person sell, sales log. |
| **Scheduling** | `core/scheduling.js` | Availability/slots, deposits, no-overlap, reschedule, cancel window. |
| **Settlements** | `core/settlements.js` | Close each invoice: cash/card in person, or no-show (+ fee). |
| **Analytics** | `core/analytics.js` | Retention, most-booked, bookkeeping, gift liability, retail sales, goals. |
| **Backend** | `server/` | Supabase schema + Stripe/Resend/Twilio edge functions + webcal feed. |

Maps to the GlossGenius feature set: online booking + deposits, confirmations &
reminders (server), loyalty, gift cards, client CRM (from `buildClients`),
analytics/bookkeeping, no-show protection, inventory, saved cards.

**Not included (on purpose):** UI, HTML, CSS, fonts, colors, and copy. Those are
your brand. Also not here: the booking *modal markup*, cart *drawer*, and intake
*form fields* — those are template-specific; wire the engines to your own markup
(patterns below).

---

## Architecture in one breath

```
your UI  ──calls──▶  core engines  ──read/write──▶  store adapter  ──▶  localStorage (demo)
                                                                    └─▶  Supabase (live)
money ──▶ server/ (Stripe PaymentIntent + webhook) ──writes──▶ same data
```

Swap `createLocalStore()` for a Supabase-backed store and the **exact same engine
code** runs on real data. Money and email/SMS live in `server/` so secrets never
touch the browser.

---

## Quick start

```js
import { createLocalStore } from "./core/store.js";
import { createScheduling } from "./core/scheduling.js";
import { createRewards }    from "./core/rewards.js";
import { createGiftCards }  from "./core/giftcards.js";
import { createInventory }  from "./core/inventory.js";
import { createPayments }   from "./core/payments.js";
import { createSettlements} from "./core/settlements.js";
import * as analytics       from "./core/analytics.js";

const store = createLocalStore("myspa_");            // one prefix per app

const schedule  = createScheduling({ store, config: { openMin: 8*60, closeMin: 18*60, slotMin: 30, depositPct: 0.5 }});
const rewards   = createRewards({ store });
const gift      = createGiftCards({ store, codePrefix: "GC" });
const inventory = createInventory({ store, seed: [{ id:"serum", name:"Serum", stock:5, cost:32, price:75 }]});
const pay       = createPayments({ store });
const settle    = createSettlements({ store, noShowFee: 40 });

// book
const day   = schedule.dateKey(schedule.upcomingDays(1)[0]);
const slots = schedule.availableSlots(day, 60);          // -> [480, 510, ...]
schedule.add({ date: day, start: slots[0], dur: 60, total: 200, deposit: 100, paid: 100,
               services: ["service-a"], name:"Ava", email:"ava@x.com", source:"web" });

// reward, gift, sell, settle …
rewards.award(100, { dayKey: day }, "Deposit");
const card = gift.create({ amount: 100, recipientEmail: "bee@x.com" });   // -> { code: "GC-…" }
inventory.sell("serum", 1, "online");
settle.settlePaid(`${day}|${slots[0]}|ava@x.com`, "cash", 100);

// analyze
const clients = analytics.buildClients(schedule.all());
analytics.retention(clients);        // { rate, returned, ... }
analytics.bookkeeping(schedule.all()).totals;
gift.liability();                    // outstanding $ you still owe in service
```

Run the full tour: `node example.mjs` (uses an in-memory store).

---

## API cheat-sheet

**scheduling** — `availableSlots(date,dur)` · `upcomingDays(n)` · `deposit(total)` ·
`canBook(date,start,dur)` · `add(booking)` · `reschedule(i,date,start,dur)` ·
`withinCancelWindow(b)` · `all()`
Config: `openMin, closeMin, slotMin, lunch, workingDays, depositPct, cancelWindowMs`.

**rewards** — `quote(amount,ctx)` · `award(amount,ctx,note)` · `spend(pts)` ·
`redeemableBlocks(cap)` · `points()` · `refCode()` · `claimWelcome()` · `creditReferral()`
Config: `earnPerDollar, blockPoints, blockValue, welcomeBonus, referralBonus, birthdayBonus, streakBonus, streakDays`.

**giftcards** — `create(d)` → `{code}` · `lookup(code)` · `quote(code,amount)` ·
`redeem(code,amount)` · `all()` · `liability()`.

**inventory** — `all()` · `add(p)` · `sell(id,qty,channel)` · `decrement(id,qty)` ·
`setStock(id,n)` · `summary()` · `sales()`.

**payments** — `cardValid/expiryValid/cvcValid` · `cardBrand` · `process(payment)` ·
`saveCard(email,card,exp)` · `getCard(email)` · `forgetCard(email)`.

**settlements** — `settlePaid(key,method,amt)` · `settleNoShow(key,chargeFee)` ·
`reopen(key)` · `get(key)` · `summary(visits)`.

**analytics** — `buildClients(bookings)` · `retention(clients)` · `mostBooked(bookings)` ·
`sourceSplit(bookings)` · `bookkeeping(bookings,fees)` · `giftLiability(cards)` ·
`retailSales(sales,month?)` · `goalProgress(actual,target)`.

---

## Data model (storage keys, with your prefix)

`bookings` (array) · `rewards` (object + ledger) · `giftcards` (array) ·
`inventory` (array) · `retail_sales` (array) · `cards` (saved cards by email) ·
`settlements` (by booking key). Booking shape:
`{ date, start, dur, services:[id], total, paid, deposit, source, name, email }`.

**Accounts (magic-link):** don't build your own — use **Supabase Auth** email
OTP / magic links. Store the signed-in email; key rewards/cards/intake by it.
**Intake / consent forms:** just a JSON blob per email —
`store.set("intake", { [email]: { answers, signature, signedAt } })`. Render your
own fields; validate required ones before saving.

---

## Going live (the plug-ins)

1. **Supabase** — create tables from `server/schema.sql` (bookings table has a
   `no_overlap` exclusion constraint → double-booking is impossible). Write a
   Supabase-backed store (see `core/store.js` sketch) and the engines run on real,
   shared data. Supabase Auth handles passwordless login.
2. **Stripe** — deploy `server/functions/create-deposit-intent` + `stripe-webhook`;
   replace `payments.process()` with a real PaymentIntent confirm; back the vault
   with a SetupIntent (off-session) to charge saved cards for rebooking/no-show fees.
3. **Resend** (email) + **Twilio** (SMS) — `server/functions/send-confirmation`
   sends confirmations, reminders, and gift-code emails.
4. **Calendar** — `server/functions/calendar-feed` serves a private webcal `.ics`
   the owner subscribes to; the dashboard/app read live availability.

Full backend steps + secrets live in `server/README.md`. Secrets go in
Supabase/host env vars only — never in the repo or the browser.

---

## Using this in a new session

Point me at this folder and say, e.g.:
> "Use the starter-kit engines. Build me a [booking / shop / dashboard] UI in
> [my design], wired to `core/*`, storage on localStorage for now."

I'll import the engines, build your branded UI on top, and flip the store to
Supabase when you're ready to go live. Nothing here dictates how it looks.
