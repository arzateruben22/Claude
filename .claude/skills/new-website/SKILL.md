---
name: new-website
description: Run the studio's full website build process for a new client or project. Use when the user says things like "let's build another website", "new $5k website", "new client site", "start a new site", or names a new business to build for. Runs the intake questionnaire, generates a unique design system, reuses proven code from the Los Güeros build, verifies in a real browser, and ships a preview + deploy plan.
---

# New Website — Studio Process

This repo doubles as the studio template: the Los Güeros taqueria site at the
repo root is the reference implementation. Follow this process start to finish.

**Architecture doctrine.** The system-first thinking behind every build — the 17
layers, the quality floor, and the budget-tier assembly model — lives in
[`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md). This skill is the *how*;
that doc is the *why*. Deep references it links to:

- [`references/design-system-and-components.md`](references/design-system-and-components.md)
  — token architecture (color/type/space/radius/shadow, light+dark) and the full
  component library with real CSS/JS anchors.
- [`references/industry-modules.md`](references/industry-modules.md) — pluggable
  per-industry feature sets that snap onto the shared architecture.
- [`references/backend-integrations.md`](references/backend-integrations.md) — the
  swap-in seams (payments, storage, CMS, bookings, notifications) that keep
  static-first the default.

## Step 0 — Where does the new site live?

Ask the user (or infer from context):
- **Real client project** → its own GitHub repo. Ask the user to create an empty
  repo and add it to the session (`add_repo`), then build there and copy
  reusable pieces from this repo.
- **Quick build / demo** → a subfolder in this repo (e.g. `sites/<client>/`),
  servable via GitHub Pages at `/<repo>/sites/<client>/`.

## Step 1 — Intake questionnaire (always, before building)

Use AskUserQuestion. Adapt wording to the business, but always cover these four:

1. **Business & brand** — Real business with name/address/hours/assets, or
   invent placeholder branding? Collect: name, location, phone, socials,
   existing logo/colors, any reference images.
2. **Art direction** — Offer 3 distinct directions grounded in the subject's
   own world (never generic templates). If reference images were provided,
   anchor the options to them. One option gets "(Recommended)".
3. **Scope** — multiSelect: menu/services/products section, online ordering or
   booking, catering/inquiry form, gallery, bilingual touches, rewards/PWA app,
   social links. Note budget tier if given ($1.5k = brochure page, $5k = adds
   ordering/booking + animations, $10k = adds PWA/rewards/payments).
4. **Tech & deploy** — Default and recommend: single static page, custom CSS +
   self-hosted GSAP, zero build step (host anywhere). Next.js only if the user
   asks or needs routes/backend.

## Step 2 — Design plan (before any code)

- Load the `frontend-design` skill and follow its process: token system
  (4–6 named colors, 2 typefaces, layout concept, one signature element).
- Optionally run `ui-ux-pro-max` search for the industry:
  `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<industry> <tone>" --design-system`
- **Every client gets a unique palette and type pairing.** Never reuse the
  Los Güeros look (espresso/amber/Cormorant) for another client — reuse the
  *quality bar and machinery*, not the identity.
- State the plan to the user in 4–5 lines before building.

## Step 3 — Reuse map (copy, then re-skin)

Proven pieces in this repo — copy the pattern, swap tokens/content:

| Feature | Where | Notes |
|---|---|---|
| Token system & section scaffolding | `css/styles.css` (top) | Replace every color/font value from the new design plan |
| Self-hosted fonts | `fonts/` + `@font-face` block | Fetch new faces via `npm pack @fontsource/<font>` |
| GSAP + ScrollTrigger, self-hosted | `js/vendor/`, motion block in `js/main.js` | Hero timeline, `[data-reveal]` sections, stagger lists; respects reduced-motion |
| Nav + mobile menu + Connect dropdown | `index.html` header, `.nav-drop` | Includes `[hidden]` display:none fix |
| Hero video treatment | `.hero-media` + scrim CSS, ffmpeg crop/compress flow | 1080p CRF 28, poster frame, pause on reduced-motion/data-saver |
| Ordering drawer (cart, qty, quick-add) | ordering IIFE in `js/main.js` + panel markup | Menu items carry `data-name/price/ingredients` in HTML |
| Add-on popover (qty, options, remove-ingredients) | `.addon-pop` markup + logic | Cap logic (e.g. 3 salsa cups) is generic |
| Delivery gate ($ minimum + progress bar) | `DELIVERY_MIN` in ordering IIFE | |
| Mandatory payment + test-mode card form | `PAYMENT_LINKS`, `payMethods`, `validateCard` | Only ever accepts the 4242 test card until a real processor link is set |
| Time-slot scheduler | `OPEN_HOURS`, `slotsFor` | Keep in sync with displayed hours |
| Catering/inquiry form → mailto | `.catering-form` | Swap email; suggest Formspree for real inboxes |
| PWA kit (installable app) | `manifest.webmanifest`, `sw.js`, `icons/`, install block in `js/main.js` | Regenerate icons from the new brand mark; bump `CACHE` per deploy |
| Points/rewards system | Puntos block in ordering IIFE + `#rewards` section | Weight cheap rewards toward high-margin items; earn preview in cart; on-device order history |
| Membership (log in / sign up + welcome bonus) | member block in ordering IIFE + `.member-pop` markup | `SIGNUP_BONUS` config; on-device until a backend (Supabase/POS) exists — swap the storage layer, keep the UI |
| App Store coming-soon card | `.appstore-badge` card in `#rewards` | Home-screen installs still grant `INSTALL_BONUS` |
| Clear-all with two-tap confirm | `.order-clear` | |

## Step 4 — Build standards (non-negotiable)

- English-first with optional second-language accents (`lang` attributes).
- Readable with JS disabled; entrance states set from JS only.
- Relative asset paths (works under GitHub Pages subpaths).
- Contrast ≥ 4.5:1, visible focus states, 44px touch targets,
  `prefers-reduced-motion` respected, no emoji as icons.
- Never collect real card numbers without a payment processor.
- Verify in Chromium via Playwright (`playwright-core`,
  executablePath `/opt/pw-browsers/chromium`) at 1440px and 375px; drive the
  key flows, screenshot, and fix what you see before showing the user.

## Step 5 — Deliver

1. Screenshots to the user + a self-contained Artifact preview (inline CSS/JS/
   fonts as data URIs — see the session pattern: strip doctype/head, single file).
2. Commit with clear messages; push; open a PR only when the user asks or the
   repo's flow expects it.
3. Deploy: GitHub Pages (Settings → Pages → main → root) or Netlify.
4. Launch checklist to the user: real phone/hours/prices, ordering or payment
   link (Stripe/PayPal/Venmo), catering email, socials, custom domain,
   Google Business profile link.
