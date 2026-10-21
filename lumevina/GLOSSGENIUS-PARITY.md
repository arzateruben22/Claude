# GlossGenius vs. the Lumevina site: what's covered, what isn't

Everything GlossGenius does (from its own feature pages and review listings, Oct 2026; its site couldn't be opened directly, so a few items are marked unverified), next to what the website has. **v2** is the site today: products first, booking on GlossGenius. **v3** is the switch that moves booking, Glow Membership and Glow Points to the website and gives Evelyn GlossGenius's jobs in her dashboard (`js/site-config.js → version`; try it with `?preview=v3`; GO-LIVE.md section 6).

**Status:** ✅ built · 🟡 partly · ⬜ not built · ➖ not needed

## Booking and the calendar

| GlossGenius | Website | Notes |
|---|---|---|
| Online booking page | ✅ v3 | The Book section: a month calendar with her real openings. v2 opens her GlossGenius page. |
| Service menu with descriptions, prices, times | ✅ | Same menu as GlossGenius, with a full-description pop-up. |
| Deposits per service | ✅ v3 | `functions/book` + Stripe Checkout. Members pay none. |
| Card on file | ✅ v3 | Saved by Stripe when booking (or on its own when nothing is due); Evelyn can email a card link. |
| No-show and late-cancellation fees | ✅ v3 | Dashboard → Appointments: $43 for a late cancellation, 50% of the service for a no-show (a deposit already kept counts toward it), charged to the card on file. |
| Clients cancel or move online | ✅ v3 | The link in every email and My Lumevina, with her 48-hour and Saturday rules. |
| Cancellation policy shown everywhere | ✅ | FAQ & Policies, booking, every confirmation. |
| Automated waitlist for cancelled slots | ✅ v3 | A full day offers the waitlist; a cancellation emails the first person waiting. |
| Calendar sync (Google) | ✅ | `availability` and `confirmBooking` through her Google Calendar; `calendar-feed`. |
| Rebooking reminders ("time for your next facial") | ✅ v3 | 4 weeks after a visit with nothing booked (members skipped). |
| Evelyn books for a client (phone, in person) | ✅ v3 | Dashboard → Book for a client, any time, with an optional card-request email. |
| Reserve with Google / Instagram Book button | ⬜ unverified | The website's address works in her Instagram bio and Google profile. |

## Client communication

| GlossGenius | Website | Notes |
|---|---|---|
| Confirmations and reminders (email + text) | ✅ v3 | Confirmation, moved and cancelled emails; a reminder 3 days before; a text the day before for clients who ask (Twilio). |
| Pre-visit instructions and forms in reminders | ✅ v3 | The reminder links the pre-visit form when it's missing, with prep notes. |
| Two-way texting with clients | ⬜ | Texts go out only. The texting assistant drafts her replies (texting/). |
| Email and SMS marketing campaigns | 🟡 | Automatic: the invitation to GlossGenius clients, rebook and "running low?" emails, each with an unsubscribe link. No campaign builder. |
| Review requests after a visit | ✅ v3 | The day after, with her Google review link (`REVIEW_URL`), at most once in 90 days. |
| Birthday messages | 🟡 | Birthday month in My Lumevina gives 50 Glow Points; no birthday email yet. |
| AI receptionist (GlossGenius "Reception AI", reportedly a paid add-on; unverified) | ✅ more on the website | Ask Lumevina: answers from Evelyn's own words plus a general esthetics layer (ingredients, treatments, aftercare, waxing, red flags) that explains rather than guesses; hands medical and personal questions to her with a drafted reply and a one-line general note for the client (photos described, never diagnosed); remembers signed-in clients' skin profiles and plans; finds orders, checks gift balances, adds products to the bag. Knows v2 or v3. No phone line. |

## Clients

| GlossGenius | Website | Notes |
|---|---|---|
| Client profiles: history, notes, purchases | 🟡 | The server keeps every client by email (`contacts`: visits, last visit, card label, notes, where they came from); the dashboard's Clients card shows visits, spend, the pre-visit form, the skin plan, and the client's own skin profile with what they've told the chat. |
| A skin profile the client keeps, and a chat that remembers them | ✅ (GlossGenius has nothing like it) | My Lumevina: their routine, supplements, treatments and sensitivities in two minutes; the chat's notes from what they tell it; both make answers specific to them. |
| Free data import | ✅ v3 | Dashboard → Clients: choose the GlossGenius client export (CSV): names, emails, phones, birthdays, notes, visit counts. Then Invite. |
| Before/after photos on the profile | ⬜ | Private photos per client, Evelyn only: later. |
| Forms, waivers, consent with signature | ✅ | Pre-visit form, consent signed at booking. |
| SOAP/treatment notes | 🟡 | Skin plan visit notes (shared with the client). Private treatment notes: later. |
| Client sign-in | ✅ | Emailed sign-in link (Supabase Auth). |
| Skin plan the client sees and the chat uses | ✅ (GlossGenius has nothing like it) | |

## Money

| GlossGenius | Website | Notes |
|---|---|---|
| Checkout at the visit | ✅ v3 | Appointments → Check out: services, products from her shelf, discount, Glow Points; pay by the card on file, cash, or a pay link on the client's phone (Apple Pay, Google Pay, pay over time). No card reader. |
| Tips | ✅ v3 | 15 / 20 / 25% or her own amount, at checkout. |
| Same-day / instant payouts | 🟡 | Stripe pays out on its schedule; instant payouts are a Stripe setting. |
| Buy now, pay later (Affirm, Afterpay, Klarna) | ✅ | Stripe Checkout, for the shop and pay links (switched on in Stripe). |
| Gift cards | ✅ more on the website | Any amount, balances that carry over, used at checkout. |
| Memberships | ✅ v3 | Glow $185, Ageless $235 a month (founding $175 / $225 for the first 25) on Stripe Billing: bank, gift, pause, cancel online. |
| Loyalty points | ✅ v3 (GlossGenius has none built in) | Glow Points: 1 per $1, 100 on the first booking here, referrals, birthdays. |
| Packages / series | 🟡 | The ProCell package of 4 is on the menu; no package tracking. |
| Product sales online | ✅ | Stripe Checkout, shipping or pickup; members get their discount and free shipping. |
| Retail inventory | ✅ | One count on the server for the website and the dashboard. |
| Sales tax on products | ✅ | Stripe Tax (her accountant should confirm the setup). |
| Reports | 🟡 | Dashboard reports run on sample/browser data until the server is live. |

## Evelyn's side

| GlossGenius | Website | Notes |
|---|---|---|
| Owner mobile app with notifications | ✅ | "Lumevina Studio": the dashboard on her home screen; notifications for bookings, cancellations, members, orders, client questions and low stock, plus a morning email. |
| Hours, days off, blocks | ✅ | Dashboard hours, with extra Mondays for members (v3). |
| Team, payroll, commissions | ➖ | Solo studio. |

## Still open

Two-way texting, a campaign builder, birthday emails, private client notes and before/after photos, package tracking, and a card reader at the studio. None of these keep a client on GlossGenius: booking, paying, reminders, cancelling and rebooking all work on the website in v3.
