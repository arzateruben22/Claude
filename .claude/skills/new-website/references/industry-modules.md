# Industry Modules

An industry module is a **named bundle of components + config + copy patterns**
that snaps onto the shared architecture. We don't rebuild sites per industry — we
assemble the base (tokens, nav, hero, sections, CTA, footer, SEO/a11y floor) and
then plug in the module(s) the client needs.

Every module reuses the machinery catalogued in
[design-system-and-components.md](./design-system-and-components.md). The
Restaurant module is **fully shipped** (Los Güeros + shawarma-queen); the rest are
documented as assemblies of the same proven parts plus the swap-in seams noted in
[backend-integrations.md](./backend-integrations.md). Nothing here forks the
architecture.

---

## Restaurant / Food Truck / Coffee / Bakery — SHIPPED

The reference module. Everything below already runs in the repo.

- **Menu section** — `.carta-group` categories, `.carta-row` items carrying
  `data-name/price/ingredients`. Duplicate a row/group to extend.
- **Online ordering** — cart drawer, quick-add, add-on popover (options +
  remove-ingredients, generic cap logic), toast feedback.
- **Pickup & delivery** — time-slot scheduler (`OPEN_HOURS`/`slotsFor`) and a
  delivery gate (`DELIVERY_MIN` + progress bar).
- **Mandatory payment** — test-mode card form until `PAYMENT_LINKS` is real;
  order → structured email handoff ready to swap for a POS/Checkout call.
- **Loyalty & membership** — Puntos punch-card, sign-up/log-in + welcome bonus,
  on-device order history.
- **PWA install** — installable app + App Store coming-soon card.

Config seam: constants at the top of `js/main.js`. Reservations (vs. ordering) is
a swap-in — reuse the scheduler UI, point it at a bookings backend.

---

## Fitness Gym / Personal Trainer

Assemble from: hero + sections + CTA, the **scheduler** (reused from ordering) for
class/session booking, **membership** (reused loyalty/member block) for plans, a
gallery (trainer profiles as cards), and a form for waivers.

| Feature | Built from | Backend seam |
|---|---|---|
| Class / session scheduling | Time-slot scheduler (`OPEN_HOURS`/`slotsFor`) | Bookings (Cal.com/Calendly or DB) |
| Memberships / plans | Membership + pricing cards | Payments (Stripe subscriptions) |
| Trainer profiles | Card grid + reveal | CMS (optional) |
| Waivers | Inquiry form → mailto | Form service / DB |
| Progress tracking | On-device state (punch-card pattern) | Auth + DB when multi-device |

---

## Beauty Salon / Barbershop / Nail Salon

Appointment-first. Reuse the scheduler for booking, membership for loyalty, cards
for the service catalog and stylist profiles, and the cart for retail product
sales.

| Feature | Built from | Backend seam |
|---|---|---|
| Appointment booking | Scheduler + add-on popover (pick stylist/add-ons) | Bookings |
| Service catalog | `.carta-*` pattern re-labeled as services | — |
| Stylist profiles | Card grid | CMS (optional) |
| Product sales | Cart drawer | Payments |
| Loyalty | Punch-card | Auth + DB when multi-device |

---

## Medical / Dental / Chiropractic

Trust- and intake-first. **Do not process PHI in the browser.** Static marketing +
accessible intake that hands off to a HIPAA-appropriate backend.

| Feature | Built from | Backend seam |
|---|---|---|
| Appointment scheduling | Scheduler | HIPAA-eligible bookings/EHR — never store PHI client-side |
| Patient intake forms | Inquiry form pattern | HIPAA-eligible form processor |
| Insurance fields | Form fields + validation states | Same |
| Services / providers | Card grid | CMS (optional) |

Guardrail: the on-device storage patterns used for loyalty are **not** acceptable
for patient data. Intake is a handoff to a compliant backend, full stop.

---

## Contractor / Roofing / Plumbing / HVAC / Electrical / Construction

Lead-funnel first. Emphasize the estimate request, service areas, project proof,
and (for trades) an emergency-call CTA.

| Feature | Built from | Backend seam |
|---|---|---|
| Estimate / quote request | Multi-field inquiry form + validation states | Form service / CRM |
| Project gallery | Gallery + before/after slider | CMS (optional) |
| Service areas | Static list / map embed | — |
| Emergency call CTA | Sticky/transparent nav CTA + tel: link | — |
| Lead funnel | Hero → proof → CTA flow | Analytics on the primary action |

---

## Real Estate / Automotive / Dealerships

Listing/catalog-driven. Reuse product cards as listings, filters/search over a
static or CMS-backed dataset, gallery per listing, inquiry form per item.

| Feature | Built from | Backend seam |
|---|---|---|
| Listings grid | Product/pricing cards | CMS / DB when inventory is large or live |
| Filters & search | Client-side filter over static JSON | Search backend at scale |
| Listing detail + gallery | Gallery + reveal | CMS |
| Inquiry / test-drive request | Inquiry form | CRM |

---

## E-Commerce / Fashion / Clothing Brands

The cart machinery already exists — extend it. For real catalogs and inventory,
this is the most likely case to graduate to a backend (or Shopify/Stripe).

| Feature | Built from | Backend seam |
|---|---|---|
| Product cards + detail | Card patterns + gallery | CMS / commerce platform |
| Cart & checkout | **Ordering drawer** extended | Payments (Stripe Checkout / Shopify) |
| Variants / options | Add-on popover (options pattern) | Product data model |
| Inventory | — | DB / commerce platform |

---

## SaaS / AI Companies / Agencies / Consultants

Marketing-site archetype: strong hero, feature cards, pricing tables, social
proof, docs/blog optional. Mostly static; forms → CRM; auth only if there's an
actual app behind it (then Next.js, see backend reference).

| Feature | Built from | Backend seam |
|---|---|---|
| Feature grid | Card grid + reveal | — |
| Pricing tables | Pricing cards + states | Payments (subscriptions) |
| Social proof / logos / testimonials | Sections + schema markup | — |
| Lead capture / demo request | Inquiry form | CRM |
| Blog / docs | Static or CMS | CMS (Sanity/Payload) |
| App auth / dashboard | — | Next.js + auth + DB (real app, not a marketing site) |

---

## Churches / Nonprofits / Hotels / Events / Venues / Hospitality

Reuse the same base plus: scheduler for services/tours/bookings, gallery, and a
donation/inquiry CTA. Donations use the **payments** seam; a "give" flow is the
ordering/checkout pattern pointed at a donation link.

---

## Adding a new industry module

1. Start from the base assembly (tokens, nav, hero, sections, CTA, footer, floor).
2. Map the industry's core action to an existing pattern (scheduler, cart, form,
   card grid) — you almost never need something new.
3. Note the backend seam(s) it will eventually need, but ship static-first.
4. Give the client a **unique identity** — the module is behavior, never a look.
5. If you build a genuinely new reusable piece, fold it into the component
   library and the [reuse map](../SKILL.md) so the next site inherits it.
