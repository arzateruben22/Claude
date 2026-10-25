# Project state

_Updated 2026-10-25._

## Stage A: foundation (done)
- **Data and rules:**
  - Schema, migrations and seed: 5 channels, 11 destinations, 5 creations, 40 challenges and quests, 8 milestone rules, 33 setup steps.
  - Domain rules: episode numbering and states, version-bound approvals, per-destination publications, schedule/plan/reschedule, rewards, XP, evolution, the job queue.
  - Real episodes imported from `films/channels` (claims become sources; finals become versions, exports and SRT captions).
- **Screens:** Home, Upload Desk (share/download/copy/bundle, mark uploaded, undo, position memory), Review, episode detail, channels (5 tabs), Calendar (plan, blackouts), Accounts and setup checklists, Analytics (manual and CSV), Rewards (budget, cap, claim/release, trophies, demo preview), Evolution (tree, requirements, branch choice, challenges, quests, demo preview, one-time reveal), Queue, Settings, sign-in, offline page.
- **App and server:**
  - PWA: manifest, icons, and a service worker that caches only the offline shell.
  - Owner-only proxy and per-action checks; media with Range support; allow-listed media keys.
  - Worker with housekeeping.
- **Verified:**
  - `tsc` is clean and `next build` is clean.
  - 52 Vitest tests on the failure paths.
  - A 14-step Playwright run through the real UI on a test database (sign-in, approve, edit withdraws, plan, the upload desk refusals, mark uploaded celebrates, analytics unlock, evolution).

## Next
- **Stage B:** lesson builder (six published shorts → expanded YouTube lesson, using `kits/cinema/film/compilation.mjs`), experiments and learnings, cost ledger and budgets UI, a demo-data toggle.
- **Stage C:** verified platform integrations (see INTEGRATIONS.md), API analytics.
- **Stage D/E:** hosted deployment (managed Postgres, object storage for media), push notifications for due uploads.

## Open owner decisions
- Final names for Skincare and What If? (both are working names); the Skincare narrator voice.
- Real handles, emails and links for the 11 accounts (Accounts screen).
- Whether Skin School content joins the shared Instagram (only with Evelyn/Lumevina's agreement).
- Reward budget: monthly cap and funding (nothing is reserved until set).
