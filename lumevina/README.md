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

## Booking (real) vs. cart (demo)

- **Book now** buttons link to the real Acuity Scheduling catalog:
  `https://app.acuityscheduling.com/catalog/d3692663` — appointments and
  real purchases happen there.
- **Add to cart** buttons on the site are a demo storefront: the cart
  persists in `localStorage` (key `lumevina_cart`) and the checkout
  validates card fields locally (Luhn, expiry, CVC) but **no payment is
  processed and no data leaves the browser**. The footer, cart, and
  checkout all say so, and the cart links back to the Acuity catalog for
  real purchases.

### Swapping in real payments

Search `js/cart.js` for `TODO`. Options:

1. Keep sending purchases through the Acuity catalog (zero code — already
   linked everywhere).
2. Stripe: `POST` the cart to your server, create a **PaymentIntent**
   server-side (secret keys never go in this repo), confirm with Stripe.js
   Elements, then show the success view.
3. Stripe **Payment Links** — per-item links, no server code.

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
