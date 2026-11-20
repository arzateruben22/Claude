// Lumevina — pay over time (Klarna, Afterpay, Affirm) on Stripe's payment page.
//
// Stripe's page offers each of them by itself once Evelyn switches it on in her Stripe
// Dashboard (Settings → Payment methods) and the order qualifies: each one has its own
// smallest and largest amount, and Stripe shows only the ones that fit. Nothing in this
// code turns a method on. PAY_LATER=off hides them all, on every page the website opens
// (the shop checkout, her pay links for a sale, and the visit link); anything else, or
// nothing set, leaves them to the Dashboard.
//
// One rule they all share: a pay-over-time payment can't save a card for later. So:
//   - the booking deposit, which keeps the card on file for the cancellation / rescheduling
//     fee, is card-only on purpose (functions/book);
//   - memberships are subscriptions: card only (functions/membership);
//   - the visit link offers pay-over-time only when the client's card is already on file
//     (functions/studio-book), otherwise it saves the card as before.

export const payLaterOn = () => (Deno.env.get("PAY_LATER") ?? "on").trim().toLowerCase() !== "off";

/** Spread into a Checkout Session's params: with PAY_LATER=off, cards (Apple Pay and Google Pay included) only. */
export const cardOnly = (): Record<string, unknown> => (payLaterOn() ? {} : { payment_method_types: ["card"] });
