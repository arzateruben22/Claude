# Project OC (Top Speed OC: Ultra)

A phone-first, first-person driving game on Orange County's real freeways. This folder is the whole game. Start
here, then read:
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
- **The repo root** is a separate client website (Taqueria Los Güeros). Don't touch it for game work.

## Rules that always apply

- **No real money.** Credits are earned by driving only. A paid weather pass or anything like it is design only.
- **Our own brands.** Rossini, Vela and the "R" badge are ours. No real car brands, logos, Hot Wheels or Rolex.
- **Honest claims.**
  - No live weather is fed in; it's simulated.
  - No live occupancy for the future Golden Road area.
  - Multiplayer is roadmap only. Don't claim it exists.
- **Radio.** Original or licensed audio only. Never scrape streams.
- **Map data.** Never copy Google Maps data.
- **Other projects.** Don't modify Trade Crawler or other projects in this repo.
- **Verify before you claim.**
  - Test in Playwright (headless Chromium with `--use-angle=swiftshader`), using the `window.__game` hooks
    (`fastForward`, `navigateTo`, `stats`).
  - Log results in `PROJECT_OC_PROGRESS.md`. Never invent results.
- **Commits** go on branch `claude/always-on`.
