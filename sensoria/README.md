# Sensoria — Website

A single-page, dark-iridescent storefront for Sensoria, an intelligent
neuro-beauty brand. No build step: static HTML + CSS + vanilla JS, with GSAP
for scroll animation. Host it anywhere that serves static files (Netlify,
Vercel, GitHub Pages, cPanel) — or just open `index.html` in a browser.

## Files

| Path | What it is |
|------|-----------|
| `index.html` | All page content — products, prices, copy, cart & checkout markup |
| `css/styles.css` | Design system (iridescent palette, glass cards, type, layout) |
| `js/main.js` | Nav, mobile menu, newsletter form, GSAP animations |
| `js/cart.js` | Cart drawer, localStorage persistence, demo checkout |
| `js/vendor/` | GSAP 3.12.5 + ScrollTrigger (self-hosted) |
| `fonts/` | Cormorant Garamond + Jost (self-hosted woff2) |

## The cart & checkout (demo)

- **Add to cart** buttons carry `data-id`, `data-name`, `data-price` — that's
  all `cart.js` reads, so editing a product is just editing those attributes.
- The cart persists in `localStorage` under the key `sensoria_cart`.
- Checkout is a **demo**: card fields are formatted and validated locally
  (Luhn check, expiry, CVC) but **no payment is processed and no data leaves
  the browser**. The footer and checkout both say so.

### Swapping in real payments (Stripe)

Search `js/cart.js` for `TODO`. In the checkout submit handler, replace the
demo success with:

1. `POST` the cart lines to your server.
2. On the server, create a Stripe **PaymentIntent** (never put secret keys in
   this repo — they live server-side only).
3. Confirm the payment client-side with Stripe.js Elements, then show the
   success view.

Alternatively, the fastest path with zero server code: replace the checkout
button with a [Stripe Payment Link](https://stripe.com/payments/payment-links)
per product bundle.

## Editing products

Each product is one `<article class="product-card">` in the Shop section —
copy a card, change the name, description, price, and the `data-*` attributes
on its button. Add a matching `visual-*` gradient class in `styles.css` for
its card art.

## Things to fill in before launch

1. **Newsletter** — the form shows a client-side thanks; wire it to your email
   service (see `TODO` in `js/main.js`).
2. **Payments** — see above.
