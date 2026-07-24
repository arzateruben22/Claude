# Design System & Component Library

The shared visual language and the modular component catalog. Grounded in the
Los Güeros build (`css/styles.css`, `js/main.js`, `index.html`) and the
`sites/shawarma-queen/` build, which prove the same machinery re-skins cleanly.

Golden rule: **reuse the token *structure* and the component *patterns*; replace
every value and every piece of content.** Two builds should share zero color
values and zero copy, but the same token names and the same component anatomy.

---

## 1. Token architecture

Tokens are plain CSS custom properties on `:root` — no build step, no
preprocessor. The layers, in order:

**a. Color.** 4–6 named brand colors plus tints/alpha steps. Los Güeros uses
semantic-ish physical names (`--ink`, `--cream`, `--flame`, `--chile`) rather than
`--color-1`. Provide alpha variants for layering (`--cream-60`, `--cream-15`).

```css
:root {
  --ink: #100c09;      /* base surface            */
  --cream: #f3e9d7;    /* primary text on ink     */
  --cream-60: rgba(243,233,215,.62);  /* muted text */
  --cream-15: rgba(243,233,215,.14);  /* hairlines  */
  --flame: #e8a356;    /* accent / primary action */
  --chile: #b3402f;    /* secondary accent        */
}
```

**b. Typography.** Two self-hosted typefaces max — a display face and a body/UI
face — declared with `@font-face` from `fonts/*.woff2` (`font-display: swap`,
latin subset). Expose as `--font-display` / `--font-body`. Size with `clamp()`
for fluid scale rather than a table of breakpoints:

```css
--font-display: "Cormorant Garamond", Georgia, serif;
--font-body: "Jost", "Avenir Next", "Segoe UI", sans-serif;
/* fluid headline */ font-size: clamp(3.5rem, 13vw, 9rem);
```

Fetch new faces with `npm pack @fontsource/<font>` and drop the woff2 into
`fonts/`. Never link Google Fonts — self-host for privacy and performance.

**c. Space.** A named ramp, not magic numbers: `--space-2 … --space-7`
(0.5rem → 7rem) plus a `--container` max-width. Every margin/padding references
the ramp.

**d. Radius, shadow, elevation.** Add `--radius-*` and `--shadow-*` /
`--elevation-*` scales per client. Los Güeros is nearly flat + glow-based
(candlelight), so its "elevation" is radial-gradient light, not drop shadows —
prove the system flexes to the brand rather than forcing Material shadows.

**e. Motion tokens.** Standard durations/easings as variables so animation reads
as one system: e.g. `--ease-out`, `--dur-1` (fast UI) … `--dur-3` (hero).

### Light + Dark

Los Güeros is intentionally single-theme (a candlelit dark room — light mode
would break its identity). When a client needs both, drive it from tokens only:

```css
:root { --bg: #fff; --fg: #111; }              /* light default        */
:root[data-theme="dark"] { --bg:#0d0d0f; --fg:#f4f4f5; }
@media (prefers-color-scheme: dark) {          /* honor OS preference  */
  :root:not([data-theme]) { --bg:#0d0d0f; --fg:#f4f4f5; }
}
```

Components reference `--bg`/`--fg`/etc., never raw hex — so a theme flip is a
token swap, nothing else changes. Verify contrast ≥ 4.5:1 in **both** themes.

---

## 2. Component library

Modular, copy-then-reskin. "Where" points at the real anchor in the repo. Status:
**shipped** = proven in a live build; **swap-in** = documented pattern to add per
client when scope calls for it.

### Structure & navigation

| Component | Status | Where / notes |
|---|---|---|
| Sticky + transparent nav | shipped | `index.html` header, scroll state in `js/main.js` (`onScroll`) |
| Brand-click-to-top | shipped | `.nav-brand` handler |
| Mobile menu (accessible toggle) | shipped | `toggle`/`setMenu`, Escape-to-close, `[hidden]` display fix |
| Connect / social dropdown | shipped | `.nav-drop` |
| Footer | shipped | `.footer` block in `index.html` |
| Mega menu, sidebar | swap-in | Same nav tokens; expand for catalog-heavy sites (e-commerce, SaaS docs) |

### Hero & content sections

| Component | Status | Where / notes |
|---|---|---|
| Intro curtain (canvas embers) | shipped | `.intro` + first IIFE in `js/main.js`; skippable (Esc), reduced-motion safe |
| Video hero + scrim | shipped | `.hero-media`; 1080p CRF 28, poster frame, pauses on reduced-motion/data-saver |
| `[data-reveal]` scroll sections | shipped | GSAP + ScrollTrigger; entrance state set from JS so no-JS stays readable |
| Staggered list reveal | shipped | `.carta-group` stagger |
| CTA section | shipped | Section pattern in `index.html` |
| Gallery / before-after / stats | swap-in | Reuse reveal + grid tokens |
| Testimonials / reviews / FAQ | swap-in | Static markup + reveal; add schema markup (see SEO) |

### Commerce & conversion (the $5k–$10k machinery)

| Component | Status | Where / notes |
|---|---|---|
| Ordering drawer (cart, qty, quick-add) | shipped | Ordering IIFE in `js/main.js`; items carry `data-name/price/ingredients` in HTML |
| Add-on popover (qty, options, remove-ingredients) | shipped | `.addon-pop`; cap logic (e.g. 3 salsa cups) is generic |
| Delivery gate ($ minimum + progress bar) | shipped | `DELIVERY_MIN` + `gateFill`/`gateText` |
| Time-slot scheduler | shipped | `OPEN_HOURS` + `slotsFor`/`renderSlots`; keep in sync with displayed hours |
| Mandatory payment + **test-mode card form** | shipped | `PAYMENT_LINKS`, `payMethods`, `validateCard` — only ever accepts 4242 until a real processor link is set |
| Order → prefilled email handoff | shipped | `ORDER_EMAIL`; structured lines ready to swap for a POS/Checkout call |
| Catering / inquiry form → mailto | shipped | `.catering-form`, `CATERING_EMAIL`; suggest Formspree for a real inbox |
| Clear-all with two-tap confirm | shipped | `.order-clear` |
| Toast notifications | shipped | `showToast` |
| Pricing tables, product cards | swap-in | Same card + token patterns; e-commerce module extends the cart |

### Membership, rewards & PWA (the $10k tier)

| Component | Status | Where / notes |
|---|---|---|
| Points / rewards punch-card | shipped | Puntos block in ordering IIFE + `#rewards`; earn preview in cart, on-device history |
| Membership (log in / sign up + welcome bonus) | shipped | Member block + `.member-pop`; `SIGNUP_BONUS`; **on-device until a backend exists — swap the storage layer, keep the UI** |
| PWA install kit | shipped | `manifest.webmanifest`, `sw.js`, `icons/`, install block; bump `CACHE` per deploy; `INSTALL_BONUS` on home-screen install |
| App Store coming-soon card | shipped | `.appstore-badge` in `#rewards` |

### States & feedback (design every one)

Every interactive component ships its full state set — never just the happy path:
**default · hover · focus-visible · active · disabled · loading (skeleton) ·
empty · success · error · form-validation**. Los Güeros proves the pattern:
`validateCard` (validation states), `showToast` (success/error feedback), the
delivery gate (locked/unlocked), two-tap clear (confirm state). Reuse these
patterns; don't reinvent feedback per client.

---

## 3. Assembling a new site from the library

1. Instantiate the token layer from the design plan (unique palette + type).
2. Pick the components the scope needs (see budget tiers in `ARCHITECTURE.md`).
3. Copy each from Los Güeros / shawarma-queen, swap tokens + content + config.
4. Wire the config constants at the top of `js/main.js`
   (`ORDER_EMAIL`, `PAYMENT_LINKS`, `OPEN_HOURS`, `DELIVERY_MIN`, `SIGNUP_BONUS`,
   `INSTALL_BONUS`, `CATERING_EMAIL`) — mark every placeholder with `TODO`.
5. Verify in Chromium at 1440/375, drive the flows, fix, then deliver.
