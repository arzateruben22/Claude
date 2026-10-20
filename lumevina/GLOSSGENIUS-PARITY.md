# GlossGenius vs. the Lumevina site: what's covered, what isn't

Evelyn keeps booking on GlossGenius for now and starts the website with products. This list is everything GlossGenius does (from its own feature pages and review listings, Oct 2026; its site couldn't be opened directly, so a few items are marked unverified), next to what the website has, and the order to close the gaps in.

**Status:** ✅ built · 🟡 partly / built but not live · ⬜ not built · ➖ not needed while GlossGenius keeps booking

## Booking and the calendar

| GlossGenius | Website | Notes |
|---|---|---|
| Online booking page | ✅ | Every Book button opens her GlossGenius page today; the site's own calendar is built and switched off (`booking.mode`). |
| Service menu with descriptions, prices, times | ✅ | Same menu as GlossGenius, with a full-description pop-up. |
| Deposits per service | ✅ built, not live | `create-deposit-intent` + Stripe. Off while GlossGenius books. |
| Card on file | ⬜ | Needed only if booking moves (Stripe SetupIntent). |
| No-show and late-cancellation fees | ⬜ | Needs card on file. Policy text is on the site. |
| Cancellation policy shown everywhere | ✅ | FAQ & Policies, booking, confirmations. |
| Automated waitlist for cancelled slots | ⬜ | ➖ while GlossGenius books. |
| Calendar sync (Google) | ✅ built, not live | `availability`, `calendar-feed`. |
| Rebooking reminders ("time for your next facial") | ⬜ | Phase 3. |
| Reserve with Google / Instagram Book button | ⬜ unverified | Her GlossGenius link works in her Instagram bio today. |

## Client communication

| GlossGenius | Website | Notes |
|---|---|---|
| Booking confirmations, reminders, follow-ups (email + text) | ✅ built, not live | `send-confirmation` (Resend email, optional Twilio SMS). Only for website bookings. |
| Pre-visit instructions and forms in reminders | 🟡 | Intake form exists; not attached to reminders yet. |
| Two-way texting with clients | ⬜ | The texting assistant drafts replies for Evelyn (texting/). A client texting line is a separate build. |
| Email and SMS marketing campaigns | ⬜ | Phase 2: email to opted-in clients. |
| Review requests after a visit | ⬜ | Phase 2 (after product orders too). |
| Birthday messages | 🟡 | Birthday month is stored (rewards, off). |
| AI receptionist (GlossGenius "Reception AI", reportedly a paid add-on; unverified) | ✅ more on the website | Ask Lumevina: answers from Evelyn's own words, hands medical/personal questions to her with a drafted reply (photos attached, described for her, never diagnosed), remembers signed-in clients' skin plans, says where an order is, checks gift balances, and puts Add to bag buttons under the products it names. No phone/voice line yet. |

## Clients

| GlossGenius | Website | Notes |
|---|---|---|
| Client profiles: history, notes, purchases | 🟡 | Dashboard Clients: visits, spend, pre-visit form, skin plan. Online orders will join it (Phase 1). Private notes not yet. |
| Before/after photos on the profile | ⬜ | Phase 2 (private photos per client, Evelyn only). |
| Forms, waivers, consent with signature | ✅ | Pre-visit intake + acne consent with signature. |
| SOAP/treatment notes | 🟡 | Skin plan visit notes (shared with the client). Private treatment notes: Phase 2. |
| Client sign-in | ✅ built, not live | Emailed sign-in link (Supabase Auth). |
| Skin plan the client sees and the chat uses | ✅ (GlossGenius has nothing like it) | |

## Money

| GlossGenius | Website | Notes |
|---|---|---|
| Checkout at the visit (Tap to Pay, card reader) | ⬜ | ➖ while GlossGenius books: she checks out in GlossGenius. |
| Tips | ⬜ | ➖ same. |
| Same-day / instant payouts | 🟡 | Stripe pays out on its schedule; instant payouts are a Stripe setting. |
| Buy now, pay later (Affirm, Afterpay, Klarna) | **Phase 1** | Stripe Checkout offers them for shop orders (switched on in Stripe). |
| Gift cards | ✅ more on the website | Any amount, balances that carry over, used at the visit from the dashboard. |
| Memberships | ✅ built, off | Glow Membership, held back by choice. |
| Packages / series | 🟡 | ProCell package of 4 is on the menu; package tracking is booking-side. |
| Product sales online | **Phase 1** | The shop works but its checkout is a demo. Phase 1 makes it real. |
| Retail inventory | 🟡 → **Phase 1** | Counts kept in the browser; Phase 1 moves them to the server so the site and the dashboard share one count. |
| Sales tax on products | **Phase 1** | Stripe Tax (her accountant should confirm the setup). |
| Reports | 🟡 | Dashboard reports run on sample/browser data until the server is live. |

## Evelyn's side

| GlossGenius | Website | Notes |
|---|---|---|
| Owner mobile app with notifications | **Phase 1** | "Lumevina Studio": the dashboard on her home screen, with notifications for new orders, client questions and low stock, plus a morning email. |
| Team, payroll, commissions | ➖ | Solo studio. |
| Free data import | ➖ | |

## The order to build it in

**Phase 1, products first (now):** real checkout through Stripe (cards, Apple Pay and Google Pay, pay-over-time where Stripe offers it), sales tax, shipping or pickup, gift certificates through the same checkout, one stock count on the server, order emails to the buyer and to Evelyn, and the Studio app with notifications and a daily email.

**Phase 2, client care that doesn't depend on booking:** review requests, "running low?" restock reminders from each product's usual lifespan, an email list with simple campaigns, private client notes and before/after photos. (Done early: the chat checks order status and gift balances, adds products to the bag, and takes photos with questions for Evelyn.)

**Phase 3, only if booking moves to the website:** card on file and no-show fees, the cancellation waitlist, rebooking reminders, forms attached to reminders, checkout at the visit with tips.
