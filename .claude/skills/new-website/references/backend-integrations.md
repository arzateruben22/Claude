# Backend & Integrations

The studio ships **static-first**. This document defines the *seams* where a
static site cleanly graduates to a backend or a third-party service — so on-device
behavior swaps to a real service without rewriting the UI.

Core idea: **the UI is stable, the storage/transport layer is pluggable.** Los
Güeros already proves this — the cart, loyalty, membership, and payment surfaces
are done; only where the data *goes* changes when a backend arrives.

---

## Decision: do we even need a backend?

Default to **no**. Add one only when a real requirement demands it:

| Need | Static answer | When it forces a backend |
|---|---|---|
| Take orders/inquiries | Prefilled email (`mailto`) / Formspree | High volume, structured records, dashboards |
| Take payment | Payment links (Stripe/PayPal/Venmo) | Full custom checkout, subscriptions, invoices |
| Loyalty / accounts | On-device `localStorage` | Cross-device sync, real identity |
| Content edits by client | Edit HTML | Non-technical client edits often |
| Listings/inventory | Static JSON | Large, live, or transactional inventory |
| App auth / dashboards | — | There is a genuine application behind the site |

If nothing in the right column is true, stay static. Say so, and why.

When a backend *is* warranted, the default recommendation is **Next.js +
TypeScript + Tailwind** for the app, with the swap-in services below. Keep the
marketing surface static even then.

---

## The swap-in seams (each keeps the shipped UI)

### 1. Payments — `PAYMENT_LINKS` seam
Today: `PAYMENT_LINKS = { stripe, paypalMe, venmo }` at the top of the ordering
IIFE. Empty → the built-in **test-mode card form** that only accepts 4242 and
transmits nothing. Fill in `stripe` → real Stripe Checkout; `paypalMe`/`venmo`
→ pay-now links with the exact total.

- **Never** collect real card data until a processor is connected — this is a
  hard studio rule, not a preference.
- Graduation path: order payload is already assembled as structured lines →
  replace the email handoff (`sendOrder`) with a Stripe Checkout Session /
  Square / Toast call. Subscriptions → Stripe Billing.

### 2. Orders / inquiries — the `ORDER_EMAIL` / form seam
Today: orders and the catering form compose a prefilled `mailto`. Graduation:
point `sendOrder` and `.catering-form` at Formspree (quick) or a real endpoint /
POS. The structured payload already exists — only the transport changes.

### 3. Accounts, loyalty & history — the storage seam
Today: membership, Puntos balance, and order history live in `localStorage` (a
digital punch-card). This is deliberate and correct for launch. Graduation:
replace the storage layer with **Supabase / Postgres** behind auth — **keep the
member UI (`.member-pop`, `SIGNUP_BONUS`) exactly as-is.** Migrate the on-device
record to the account on first authenticated login.

> Never use the on-device pattern for anything sensitive (see Medical module).
> It's fine for loyalty points; it's not fine for PHI, real payment data, or PII
> you're liable for.

### 4. CMS — the content seam
Today: content lives in `index.html`. Graduation when the client edits often:
**Sanity** or **Payload CMS**, content fetched at build/runtime. Static export
stays possible with most headless CMSes — don't add a server just to edit copy if
a build-time fetch works.

### 5. Bookings / scheduling — the scheduler seam
Today: `OPEN_HOURS` + `slotsFor` render local time slots (no availability check).
Graduation: back it with **Cal.com / Calendly** or a DB availability model when
you need real conflict-free booking, confirmations, and reminders.

### 6. Notifications — email/SMS/push
- Email: **Resend** (transactional — confirmations, receipts).
- SMS: Twilio (order/appointment reminders).
- Push: the PWA (`sw.js`) is already installable; add the Push API when there's a
  backend to send from.

### 7. Analytics — the measurement seam
Privacy-respecting by default (Plausible / GA4 configured for privacy). Measure
the **one primary conversion** per site (order placed, booking made, lead sent),
not vanity metrics. No third-party script that violates the a11y/perf floor.

---

## Recommended stack menu (choose intentionally, per project)

Not a default to reach for reflexively — pick against the actual need and state
the tradeoff.

| Concern | Static default | Swap-in when needed |
|---|---|---|
| Framework | Vanilla HTML/CSS/JS | Next.js + React + TypeScript |
| Styling | Custom CSS tokens | Tailwind (+ shadcn/ui) |
| Animation | Self-hosted GSAP + ScrollTrigger | Framer Motion (in React apps) |
| Auth | None (on-device) | Supabase Auth / Clerk / Better Auth |
| Database | Static JSON / none | Postgres via Supabase; Prisma/Drizzle |
| Payments | Payment links + test card | Stripe (Checkout / Billing) |
| CMS | HTML | Sanity / Payload |
| Email/SMS | mailto | Resend / Twilio |
| Bookings | Local slots | Cal.com / Calendly |
| Hosting | GitHub Pages / Netlify | Vercel / Cloudflare (for the app) |
| Analytics | — | Plausible / GA4 (privacy-configured) |

---

## Security & data guardrails (every project)

- No secrets, API keys, or tokens in client-side code — ever. Server-side only.
- No real card data client-side without a connected processor.
- On-device storage is for non-sensitive convenience state only (loyalty points,
  cart) — never PHI, card data, or PII you're liable for.
- Validate and sanitize anything sent to a backend; treat all client input as
  untrusted.
- Keep the marketing site static even when an app backend exists — smaller attack
  surface, faster, cheaper.
