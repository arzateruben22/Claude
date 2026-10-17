# Project OC (Top Speed OC: Ultra)

A phone-first, first-person driving game on Orange County's real freeways. This folder is the whole game. Start
here, then read:
- `PROJECT_OC_MASTER_PROMPT.md`: the owner's full vision and every feature they've asked for.
- `PROJECT_OC_PROGRESS.md`: what's done and how it was checked.
- `PROJECT_OC_ROADMAP.md`: what's left, in priority order.
- `PROJECT_OC_TECHNICAL_NOTES.md`: how it works.

## Where things are

- **Code.** `src/game/`:
  - `world/` holds the road network, roads and terrain.
  - `vehicle/`, `traffic/`, `env/` and `audio/` are the car, traffic, sky and weather, and sound.
  - `Game.ts` ties them together.
- **UI.** `src/ui/`.
- **Road data.** `src/data/oc-network.json` comes from OpenStreetMap via Overture Maps (ODbL). It's rebuilt by
  `tools/oc-network/`, which has its own README.
- **Build.**
  - `npm install && npm run build` writes `dist/top-speed-ultra.html` (opens from disk) and `dist/artifact.html`.
  - Republish `dist/artifact.html` to https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV to keep the same link.
- **Older versions.** `../top-speed-oc/` holds v1/v2 (a single-file canvas game) and `loop.html` (the Loop Lab arcade
  preview). Leave them as they are.
- **Store.** `src/store/` (catalog, account, entitlements, payments, locker) and `src/ui/Store.tsx`; the server side
  (Supabase migration, the `create-checkout` and `stripe-webhook` functions) is in `server/`, whose README has the
  go-live steps. Live mode is a build setting (`.env.example`); keep the artifact build in test mode. After changing
  `catalog.json` or `cosmetics.json`, run `npm run store:sync` and `npm run store:check`.
- **The repo root** is a separate client website (Taqueria Los Güeros). Don't touch it for game work.

## Rules that always apply

- **The store: test mode until the owner says live** (owner, 2026-10-16; this replaces "no real money").
  - Payments are built but in test mode. Nothing is charged until the owner connects Stripe and Supabase and turns
    live mode on.
  - In test mode the card form is a demo: the 4242 4242 4242 4242 test card, and nothing leaves the browser. Live
    payments go through Stripe's hosted Checkout page, never through our own card fields.
  - Sell cosmetics, expansions and support only. The catalog is `src/store/catalog.json`, what each item unlocks is
    `src/store/cosmetics.json`, and the reasons are in `PROJECT_OC_MONETIZATION.md`.
  - Never sell power: no faster-than-earnable cars, and no grip, handling, score, XP or credit boosts.
  - Never sell credits. Credits are earned by driving only.
  - No random paid rewards (no loot boxes), no premium currency, no ads at launch.
  - Everything the game has today stays free.
  - Purchases are 13+.
  - Nothing is sold, or pre-sold, before it exists in the game.
- **Our own brands.** Rossini, Vela and the "R" badge are ours. No real car brands, logos, Hot Wheels or Rolex.
- **Honest claims.**
  - No live weather is fed in; it's simulated.
  - No live occupancy for the future Golden Road area.
  - Multiplayer is roadmap only. Don't claim it exists.
- **Radio.** Original or licensed audio only. Never scrape streams.
- **Map data.** Never copy Google Maps data.
- **Other projects.** Don't modify Trade Crawler or other projects in this repo.
- **Verify before you claim.**
  - Run the regression suite before and after a change: `npm run build && npm test` (about 10 minutes here; `--only=`
    for some groups). Add a check for anything new you build. The technical notes explain the suite.
  - Test in Playwright (headless Chromium with `--use-angle=swiftshader`), using the `window.__game` hooks
    (`fastForward`, `navigateTo`, `stats`).
  - Log results in `PROJECT_OC_PROGRESS.md`. Never invent results.
- **Commits** go on branch `claude/always-on`.

## Model policy (owner, 2026-10-16)

- **Daytime (Pacific):** sessions and their agents run on Opus 5.5 for routine implementation, renders, suite runs
  and integration.
- **Overnight:** Fable 5.1, on what it is best at: the hardest reasoning (vehicle physics, rendering architecture,
  the people builder's geometry), design decisions, and adversarial review of the day's agent output. Keep its
  session capacity for that; don't spend it on screenshots and suite runs.
- Workflow scripts take a `model` per agent; daytime passes set `'opus'`, overnight passes leave the default.

## Triage rule for new ideas (owner, 2026-10-16)

When the owner brings a new idea or feature, the session triages it before building, on any model:

- **Opus-class (build now, in this session):** UI screens and HUD, menus, content (stations, paints, cars'
  trim, signs, props), textures and materials tuning, docs, tests, integration, renders and screenshots, small
  physics or audio tuning with an existing model, anything reversible in an afternoon.
- **Fable-class (hand to a Fable 5.1 session):** a new simulation or vehicle-dynamics model, rendering
  architecture (new passes, LOD or streaming budgets, the single-file build), geometry and skinning systems
  (rigs, expressions, hair, the people builder's fields), data pipelines where correctness is hard to check
  (map import, provenance), security, privacy or business-rule design, and anything where a wrong design is
  expensive to undo. Also the adversarial review of a day's agent output.
- **Mixed:** build the routine part now on Opus agents and dispatch the hard core to a `fable` agent from this
  session (agents take a `model`); only recommend switching the whole session when the owner's own back-and-forth
  with the model is the hard part (a design conversation, a decision).

When an idea is Fable-class, the session must (1) say so in one line, (2) give the owner a ready-to-paste prompt
block headed "Fable prompt" that names the files, the rules that apply, the proof required (which renders, which
suite groups) and where to log it, and (3) append the same block under "Fable queue" in `PROJECT_OC_HANDOFF.md`
so the next overnight session finds it even if the owner doesn't switch right away. The reverse holds for a
Fable session handed routine work: queue it under "Opus queue".
