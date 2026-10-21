# The welcome offer: a first order without a lower shelf

Why not a discount on the shelf price: the brands' minimum advertised price rules, and the margin (professional skincare retails at about double wholesale, so she earns at the shelf price). A first-order perk does the same job without breaking either.

## What a first-time customer gets

1. **Free pickup at the studio** (already on the site): no shipping, and a reason to book a facial.
2. **100 Glow Points on a first booking** (v3; already built): $10 toward the next visit or product.
3. **WELCOME10:** 10% off a first shop order, entered at checkout. Not printed in ads (that would be an advertised price); given in the welcome email, the Instagram bio ("first order? code in my bio"), and by the chat when someone asks about a first order.

## Setting up WELCOME10 in Stripe (Ruben, 5 minutes)

Stripe Dashboard → Product catalog → Coupons → New: 10% off, once. Then Promotion codes → New: code `WELCOME10`, that coupon, **First-time order only** on, no expiry, no minimum (or $40 if she prefers). The website's checkout now accepts promotion codes (`allow_promotion_codes` in `functions/create-checkout`), so the field appears on Stripe's payment page by itself.

For a local campaign later: `LOCAL15` with the same settings, used only in Nextdoor posts.

## Where the code is mentioned

- The welcome email (the client-invite email from the dashboard, and the chat's answer to "do you have a first-order discount?"). Both say: "First order? WELCOME10 at checkout takes 10% off, once."
- The Instagram bio: "Woodland Hills · facials, peels, waxing · her shelf online, free pickup · first order: WELCOME10".
- Not in paid ads, not on the shop page.

## What it costs

10% of a first order ($5 to $15 on a typical first basket) against a client who, if they come in, is worth a facial a month. If a first order is pickup, the shipping saving alone covers it.
