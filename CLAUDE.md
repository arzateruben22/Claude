# Studio repo — websites by Ruben

This repository is both a live site and the studio template:

- **Repo root** = the production site for **Taqueria Los Güeros** (Anaheim
  taco shop): candlelit single-page site with video hero, online ordering,
  salsa add-ons, mandatory payment (test mode until Stripe is connected),
  Puntos Güeros rewards with membership sign-up/log-in and order history
  (all on-device until a backend exists), and PWA install with an App
  Store coming-soon card. Deployed via GitHub Pages from
  `main`. Do not re-theme it — its identity (espresso `#100C09`, amber
  `#E8A356`, Cormorant Garamond + Jost, English-first with Spanish accents)
  belongs to that client.
- **`.claude/skills/new-website`** = the studio process. When the user asks to
  build a new website ("let's build another $5k website", "new client site"),
  invoke the `new-website` skill and follow it: intake questionnaire first,
  unique design system per client, reuse the proven machinery listed in the
  skill's reuse map, verify in Playwright at 1440/375, deliver an Artifact
  preview, and only then commit/push.
- **`docs/ARCHITECTURE.md`** = the studio's system-first doctrine (the 17 layers,
  quality floor, budget-tier assembly model) with deep references for the design
  system + component library, industry modules, and backend/integration seams.
  It's the *why* the `new-website` skill executes — read it when planning a build.

House rules that always apply:

- Ask the intake questions before designing; state the design plan before code.
- Every client gets a distinct palette/typography — never recycle a previous
  client's identity.
- Static-first: no build step, self-hosted fonts and GSAP, relative paths.
- Accessibility floor: 4.5:1 contrast, focus states, reduced-motion support,
  readable without JS.
- Never collect real card data without a connected payment processor; the
  built-in card form stays in 4242 test mode until `PAYMENT_LINKS` is real.
- Placeholders (phone numbers, emails, prices, hours) are marked with TODO —
  list them in every handoff summary.
