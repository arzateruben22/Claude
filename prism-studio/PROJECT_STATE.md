# Project state

_Updated 2026-10-26._

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

## Stage B (done)
- Lessons: 4–6 rendered shorts → one 16:9 compilation built by the worker (`compilation.mjs`), approved as an exact video + title + description, marked uploaded, dissolvable until published. Channel → Lessons tab.
- Learn: experiments (one change, a metric, a minimum sample, a status trail) and learnings (finding, confidence, evidence, counter-examples, decision).
- Posting text engine: per-platform titles, descriptions/captions, hashtags, YouTube tags and the sources comment, generated from the script's beats and claims.json, within every limit; `npm run text:regenerate`, `npm run text:pack` (writes `out/POSTING.md` + `posting.json` next to each delivered episode); Regenerate button in Review.
- Costs (`/costs`, in More, Settings and each channel's Overview): monthly production budgets (studio-wide and per channel, carried forward from the month they're set), spent vs budget this month and for the last six months, and cost entries (what, amount, currency, channel/episode, date, actual or ESTIMATE) the owner can add, edit and void. Rules in `src/domain/costs.ts`: whole cents, estimates and voided entries never count, no currency conversion, never touches the reward ledger, `canUsePaidGeneration(channelId, amount)` (Settings switch on, external actions not stopped, a channel budget with room, and room in the studio-wide one when set). Migration `0002_costs_demo_toggle`.
- Demo-data switch (Settings → Show demo data, `studio_settings.show_demo`, off by default): lists hide demo episodes, series, lessons and jobs unless it's on; shown ones are labelled DEMO. Counting (XP, progress, achievements, rewards, analytics totals, badges, lesson eligibility, planning) filters `is_demo` itself and never reads the switch. `npm run db:seed -- --demo` adds a labelled demo series (numbered 901+, the channel counter untouched).

## Stage C (first cut, in progress)
- Connector contract (`src/integrations/types.ts`), sealed tokens, OAuth start/callback routes with a sealed state cookie and PKCE, signed public media links (Instagram), connections domain (verify account onto the destination, refresh, expire, disconnect), publish job + `publish_status` follow-up, the minute scheduler for "Approved" channels, Publish now on the desk, Connect/Disconnect on Accounts. 12 tests with a fake connector.
- Connectors for YouTube (resumable upload, captions, thumbnail, status, metrics), TikTok (inbox upload or direct post, status, metrics) and Instagram (Reels container → publish, limit check, insights): registered; 62 mocked-fetch tests. Each connector's `conditions` text states what could not be verified against the live docs (the sandbox can't open Google/TikTok/Meta developer pages; web-search excerpts were used).
- Not yet: API analytics import.

## Next
- Connect the first real account (needs the owner's Google Cloud / TikTok / Meta app credentials in `.env.local`); verify a real upload end to end on a private test video.
- API analytics (`metric_snapshots` source `api`).
- When a paid generator exists: its job calls `canUsePaidGeneration` first and records its estimate, then the actual cost, in `cost_ledger` (with `job_id`); concurrent paid jobs will need a reservation under a lock, like rewards.
- **Stage D/E:** hosted deployment (managed Postgres, object storage for media), push notifications for due uploads.

## Open owner decisions
- Final names for Skincare and What If? (both are working names); the Skincare narrator voice.
- Real handles, emails and links for the 11 accounts (Accounts screen).
- Whether Skin School content joins the shared Instagram (only with Evelyn/Lumevina's agreement).
- Reward budget: monthly cap and funding (nothing is reserved until set).
- Production budgets: a monthly amount per channel (Costs). Paid generation stays off until one is set and Settings → Paid generation is on.
