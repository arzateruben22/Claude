# Lumevina vs. GlossGenius — parity checklist

An honest running scorecard: what the Lumevina site already does, what's
scaffolded (frontend built, needs the backend switched on), and what's still
missing. Updated as we close gaps.

Legend: ✅ done · 🟡 scaffolded (flips on with Supabase/Stripe/Resend) · ⬜ not built yet

## For the customer (client-facing)

| Feature | Lumevina | GlossGenius | Notes |
| --- | --- | --- | --- |
| Online booking | ✅ | ✅ | Multi-service, back-to-back; opens on a service picker |
| Deposits at booking | 🟡 | ✅ | 50% deposit; Stripe-ready (demo now) |
| On-screen confirmation | ✅ | ✅ | Order id + summary |
| Confirmation email/SMS | 🟡 | ✅ | `send-confirmation` fn; needs Resend/Twilio keys |
| 24-hour reminder | 🟡 | ✅ | Queued by webhook; flush documented |
| Add to calendar (.ics) | ✅ | ✅ | Works now, 1-day alarm |
| Pre-visit intake / consent | ✅ | ✅ | Real form, validation, e-signature |
| Loyalty / points | ✅ | ✅ | Glow Rewards — deeper than GG |
| Referrals · birthday · welcome | ✅ | partial | GG has some; ours is richer |
| Flash-opening discounts | ✅ | ⬜ | Dynamic pricing to fill slow slots |
| Gift certificates | ✅ | ✅ | Gift a specific service or a value; full code lifecycle |
| Self-service cancel (48-hr) | ✅ | ✅ | In My Lumevina |
| Self-service reschedule | ✅ | ✅ | In-flow link; 48-hr rule enforced |
| Saved card for rebooking / auto no-show fee | ⬜ | ✅ | Stripe supports it; not wired |
| Two-way texting with the spa | ⬜ | ✅ | Needs messaging backend |
| Emailed receipts | 🟡 | ✅ | Rides on the email piece |

## For the owner (business-facing)

| Feature | Lumevina | GlossGenius | Notes |
| --- | --- | --- | --- |
| One shared calendar / no double-booking | 🟡 | ✅ | DB exclusion constraint in `schema.sql`; live w/ Supabase |
| Owner analytics dashboard | ✅ | ✅ | Revenue, rebooking, no-show, app-vs-web, rewards |
| Most-booked services | ✅ | ✅ | Ranked bars |
| Booking source (app vs web) | ✅ | ⬜ | Captured from booking #1 |
| Client CRM (profiles, history, forms) | ✅ | ✅ | Searchable → visit history + intake answers |
| New-member retention cohort | ✅ | partial | Returned vs first-time |
| In-person balance settlement (cash/card) | ✅ | ✅ | "Settle visits": mark paid cash/card |
| No-show tracking (deposit kept) | ✅ | ✅ | Deposit kept, balance written off |
| Auto-charge no-show/late-cancel fee | 🟡 | ✅ | Needs saved card (Stripe off-session) |
| Gift-certificate liability tracking | ✅ | partial | Outstanding balance tile + per-cert table |
| Bookkeeping / tax (income) | ✅ | partial | Income, fees, net, CSV; expenses not tracked |
| Calendar sync (Google/Apple) | ✅ | ✅ | Owner .ics feed |
| Intake forms visible to owner | ✅ | ✅ | Per client in the CRM |
| Automated confirmations/reminders | 🟡 | ✅ | `send-confirmation` function |
| Marketing campaigns (email/SMS blasts) | ⬜ | ✅ | Newsletter stub only |
| Waitlist (auto-fill cancellations) | ⬜ | ✅ | Flash openings are a cousin |
| Reviews / reputation management | ⬜ | ✅ | Planned |
| Memberships / recurring billing | ⬜ | ✅ | Rewards exist; no subscriptions |
| Staff / team management | ⬜ | ✅ | Single-provider today |
| Retail inventory POS + card reader | ⬜ | ✅ | Retail via affiliate links (Take It Home) |
| Expense tracking | ⬜ | partial | Income-side only today |

## Where Lumevina is ahead of GlossGenius

- A fully custom, one-of-a-kind brand (theirs is templated)
- A deeper loyalty program (points, referrals, birthday, flash pricing, petal)
- Gift certificates: gift a specific treatment *or* a value, with code
  redemption, rollover balances, and an owner liability view
- Ownership + no monthly fee, and an own-branded iPhone app path

## Suggested order for what's left

1. **Turn on the backend** (Supabase + Stripe + Resend) — flips deposits, the
   shared live calendar, and confirmation/reminder emails from 🟡 to ✅ at once
2. **Saved card on file** — enables 1-tap rebooking *and* auto no-show fees
3. **Marketing** — simple email campaign to past clients
4. **Waitlist** — auto-offer a freed slot
5. **Reviews** — post-visit review request
6. Memberships, staff, expense tracking — as the business (or white-label) grows

Out of scope for a website (hardware/financial products): in-person card-reader
POS hardware, integrated banking/debit card, payroll. (In-person card payments
are covered by Stripe Tap to Pay / Terminal on the owner's phone.)
