# Evelyn's business priorities, ranked

What needs her first, in the order the dashboard's **Today** card shows it and the order her phone is told about it. One ranking everywhere: `server/functions/_shared/priorities.ts` (the server), `js/studio-priorities.js` (the dashboard), `studio-digest` (the morning push and email) and `client-reminders` (the hourly nudge).

## How she hears about it

| When | What reaches her phone |
|---|---|
| The moment it happens | Everything in **Right now** as it lands: a new client question (every kind), a failed membership payment, a new order, a product selling out, a booking, a cancellation, a new member, a waitlist sign-up. |
| Once, when a question passes its promised reply time | "Still waiting: Maya" (members are promised 24 hours, everyone else 2 days). The hourly `client-reminders` run sends it once per question. |
| Every morning | "Today at Lumevina": the top three items from Right now and Today, with the full list in the morning email. Sent whenever there is anything in those two tiers, even if that's every day. Nothing waiting: nothing sent. |

Turning notifications on: Lumevina Studio on her home screen → save the studio key → Turn on notifications (dashboard.html, the first card).

## 1. Right now

A client is waiting on her, or money is at risk.

1. **An urgent or medical question waiting.** Reactions, medications, pregnancy, named conditions and emergencies never get an answer from the chat; the client may be worried right now. → Client questions.
2. **A question past the promised reply time.** The website promises members a reply within 24 hours and everyone else within 2 days. → Client questions.
3. **A membership payment that failed.** Stripe retries on its own; a message asking them to update the card in My Lumevina keeps the membership. → Members.
4. **An order overdue to ship.** Promised within two business days of the order. → Shipping.
5. **A client booked today without a pre-visit form.** Send the link, or take it on the tablet before the treatment. → Appointments.

## 2. Today

6. **Today's appointments**, first time and who. → Appointments.
7. **Orders to ship by today.** Pack, label, mark shipped; the tracking email goes out by itself. → Shipping.
8. **Pickups set aside**: paid on the website for pickup at a visit, in the last week. → Shipping.
9. **Questions due today.** A reply is drafted for each. → Client questions.
10. **Sold-out products.** Clients can request them from the shop; restock or hide them. → Inventory.

## 3. This week

11. **Running low** (3 or fewer, or the product's own low mark). Reorder before they sell out between visits. → Inventory.
12. **Members cancelling.** A personal message before their last facial. → Members.
13. **The waitlist for the next 7 days.** A cancellation emails the first in line by itself; a text from her fills it faster. → Appointments.
14. **Suggested chat answers to approve** (Teach the chat). → Teach the chat.
15. **Regulars who haven't rebooked in 5 weeks** (two or more visits, nothing booked ahead). The rebook email already went out; a personal text brings them back. → Clients.

## 4. Housekeeping

16. **The shelf count** when it hasn't been updated in a month. → Inventory.
17. **Her Skin Playbook: Quick confirm.** Common answers drafted for her to confirm or fix; every one she confirms is one the chat answers for her. → the playbook link.

## Not on the list, on purpose

Restocking decisions beyond the count (what to order, how many) are hers; the list only says what's out or low. Money reports, taxes and payouts stay in Stripe and her accountant's hands. Anything about a client's skin stays between her and the client.

**Added October 21:** *Waiting to buy* (right now): a client asked for an active and told her about their skin; approve or decline in Consults. *Online consults to schedule* (today): paid Skin Consults waiting for the 15-minute call.
