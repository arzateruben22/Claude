# Lumevina vs. GlossGenius — parity checklist

An honest running scorecard: what the Lumevina site already does, what's
scaffolded (frontend built, needs the backend switched on), and what's still
missing. Updated as we close gaps.

Legend: ✅ done · 🟡 scaffolded (flips on with Supabase/Stripe) · ⬜ not built yet

## For the customer (client-facing)

| Feature | Status | Notes |
| --- | --- | --- |
| Online booking | ✅ | Multi-service, back-to-back scheduling |
| Deposits at booking | 🟡 | 50% deposit; Stripe-ready (demo now) |
| Booking confirmation on screen | ✅ | Success screen with order + summary |
| **Confirmation email/SMS** | 🟡 | `send-confirmation` function; needs Resend/Twilio keys |
| **24-hour reminder** | 🟡 | Queued by webhook; scheduled flush documented |
| **Add to calendar (.ics)** | ✅ | Works now, with a 1-day alarm |
| **Pre-visit intake / consent form** | ✅ | Real form, validation, e-signature; owner-visible |
| Loyalty / points | ✅ | Glow Rewards — richer than GlossGenius |
| Referrals · birthday · welcome bonus | ✅ | Built |
| Flash-opening discounts | ✅ | Dynamic pricing to fill slow slots |
| Gift certificates | ✅ | In-cart purchase |
| Self-service cancel (48-hr policy) | ✅ | In My Lumevina |
| Self-service reschedule | ⬜ | Cancel + rebook only for now |
| Saved card for faster rebooking | ⬜ | Stripe supports it; not wired |
| Two-way texting with the spa | ⬜ | Needs messaging backend |
| Emailed receipts | 🟡 | Rides on the email piece above |

## For the owner (business-facing)

| Feature | Status | Notes |
| --- | --- | --- |
| One shared calendar / no double-booking | 🟡 | DB exclusion constraint in `schema.sql` |
| Owner analytics dashboard | ✅ | Revenue, rebooking, no-show, app-vs-web, rewards |
| Booking source (app vs web) | ✅ | Captured from booking #1 |
| **Intake forms visible to owner** | 🟡 | Stored per client; read in dashboard/table |
| Automated confirmations/reminders | 🟡 | `send-confirmation` function |
| Deposits / no-show protection | 🟡 | 50% deposit rule |
| Client CRM (profiles, history, notes) | ⬜ | Next big build |
| Calendar sync (Google/Apple) | ⬜ | Planned |
| Marketing campaigns (email/SMS blasts) | ⬜ | Newsletter stub only |
| Waitlist (auto-fill cancellations) | ⬜ | Flash openings are a cousin |
| Reviews / reputation management | ⬜ | Planned |
| Memberships / recurring billing | ⬜ | Rewards exist; no subscriptions |
| Staff / team management | ⬜ | Single-provider today (matters for growth) |
| Inventory / retail POS + card reader | ⬜ | Hardware — out of scope for a website |
| Bookkeeping / expense & tax reports | ⬜ | Analytics only today |
| Integrated banking / instant payout card | ⬜ | Stripe payouts cover the basics |

## Where Lumevina is ahead of GlossGenius

- A fully custom, one-of-a-kind brand (theirs is templated)
- A deeper loyalty program (points, referrals, birthday, flash pricing, petal)
- Ownership + no monthly fee, and an own-branded iPhone app path

## Suggested order for what's left

1. **Client CRM** — per-client profile with history + notes (the biggest owner gap)
2. **Self-service reschedule** — client moves their own appointment
3. **Waitlist** — auto-offer a freed slot
4. **Marketing** — simple email campaign to past clients
5. **Reviews** — post-visit review request
6. Memberships, staff, bookkeeping — as the business (or white-label) needs them

Out of scope for a website (hardware/financial products): in-person card-reader
POS, integrated banking/debit card, payroll.
