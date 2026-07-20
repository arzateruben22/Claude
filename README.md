# Taqueria Los Güeros — Website

A single-page, candlelit site for Taqueria Los Güeros, 628 W La Palma Ave, Anaheim, CA.
No build step: static HTML + CSS + vanilla JS, with GSAP for scroll animation.
Host it anywhere that serves static files (Netlify, Vercel, GitHub Pages, cPanel).

## Files

| Path | What it is |
|------|-----------|
| `index.html` | All page content — menu items, prices, hours, copy |
| `css/styles.css` | Design system (colors, type, layout) |
| `js/main.js` | Nav, mobile menu, catering form, GSAP animations |
| `js/vendor/` | GSAP 3.12.5 + ScrollTrigger (self-hosted) |
| `fonts/` | Cormorant Garamond + Jost (self-hosted woff2) |

## Things to fill in before launch

Search `index.html` and `js/main.js` for `TODO`:

1. **Ordering link** — the "Ordena · Order" buttons currently point at the Visítanos
   section. Swap the `href` for your DoorDash/Toast/phone link.
2. **Phone number** — `(714) 555-0000` in the Visítanos section is a placeholder.
3. **Catering email** — `CATERING_EMAIL` in `js/main.js` (the form opens a prefilled
   email; for direct submissions, wire it to a service like Formspree).
4. **Hours & prices** — sample values; edit them directly in `index.html`.

## Online ordering

The menu has add-to-order buttons feeding an order drawer. Adding a dish
opens a popover with a quantity stepper, salsa cups (roja/verde, max 3
per item in any mix, tracked per line), and a remove-ingredients list
driven by each button's `data-ingredients` attribute in `index.html`.
The drawer includes:

- **Pickup** — ASAP (~20 min) or a scheduled time slot. Slots are generated
  from `OPEN_HOURS` in `js/main.js` (15-minute steps, last order 30 minutes
  before close). Keep `OPEN_HOURS` in sync with the hours shown on the page.
- **Delivery** — locked until the subtotal reaches `DELIVERY_MIN` ($50),
  card payment only, 45-minute lead time, requires an address.

Orders are composed into a prefilled email to `ORDER_EMAIL` (top of the
ordering section in `js/main.js`). To take real card payments online,
replace the `sendOrder` email handoff with a POS / payment integration
(Square, Stripe Checkout, or Toast) — the order payload is already
assembled as structured lines at that point.

## Editing the menu

Each dish is one `<li class="carta-row">` in the La Carta section — copy a row,
change the name, description, and price. Groups (Tacos, Burritos…) are
`<div class="carta-group">` blocks; duplicate one to add a category.
