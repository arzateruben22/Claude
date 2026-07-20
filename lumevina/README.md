# Lumevina Aesthetics Spa — Website

A single-page, ivory-and-mauve storefront for Lumevina Aesthetics Spa.
No build step: static HTML + CSS + vanilla JS, with GSAP for scroll
animation. Host it anywhere that serves static files (Netlify, Vercel,
GitHub Pages, cPanel) — or just open `index.html` in a browser.

## Files

| Path | What it is |
|------|-----------|
| `index.html` | All page content — services, prices, copy, inline SVG logo, cart & checkout markup |
| `css/styles.css` | Design system (ivory/mauve palette, cards, type, layout) |
| `js/main.js` | Nav, mobile menu, newsletter form, GSAP animations |
| `js/cart.js` | Cart drawer, localStorage persistence, demo checkout |
| `js/vendor/` | GSAP 3.12.5 + ScrollTrigger (self-hosted) |
| `fonts/` | Cormorant Garamond + Jost (self-hosted woff2) |

## Booking, scheduler & payments

- **Book now** buttons link to the real Acuity Scheduling catalog:
  `https://app.acuityscheduling.com/catalog/d3692663` — confirmed
  appointments and real purchases happen there today.
- **The scheduler** (`js/booking.js`) opens from every service's Book
  button: Tue–Sun, 8 AM–6 PM, 12–12:30 lunch, 30/60-minute slots, and a
  **required 50% deposit** collected in step two of the modal. Requests
  persist in `localStorage` (key `lumevina_bookings`).
- **The cart** (`js/cart.js`) persists in `localStorage` (key
  `lumevina_cart`) with its own checkout.
- Both checkouts run on **one shared payment engine**:
  `js/payments.js`. It owns card formatting, Luhn/expiry/CVC validation,
  and `process()` — currently a labeled **demo** that charges nothing and
  sends nothing off the browser.

### Going live with Stripe (one file)

Everything is staged so real payments are a single swap — see the
`STRIPE INTEGRATION POINT` comment at the top of `js/payments.js`:

1. Create a Stripe account and a tiny server endpoint
   (`POST /create-payment-intent`) that creates a **PaymentIntent** with
   the amount — the secret key lives only on that server.
2. Add Stripe.js Elements on the client and replace
   `LumevinaPayments.process()` with `stripe.confirmCardPayment(...)`.
3. Done — the cart checkout **and** the booking deposit both go live at
   once, and Apple Pay / Google Pay come free with Elements.

Zero-server alternative: Stripe **Payment Links** per service/deposit, or
keep routing everything through the Acuity catalog (already linked).

## Editing services

Each service is one `<article class="product-card">` in the Services
section — copy a card, change the name, description, price, and the
`data-*` attributes on its button. Add a matching `visual-*` gradient
class in `styles.css` for its card art.

## The logo

The Lumevina mark (circle, profile line art, roses, wordmark) is an
inline `<svg class="hero-logo">` in `index.html`, so the wordmark renders
in the site's Cormorant Garamond. To swap in the original logo file,
replace that `<svg>` with an `<img>` pointing at your asset.

## Things to fill in before launch

1. **Newsletter** — the form shows a client-side thanks; wire it to your
   email service (see `TODO` in `js/main.js`).
2. **Payments** — see above.
