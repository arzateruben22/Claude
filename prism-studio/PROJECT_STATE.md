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

## Stage C (in progress)
- Connector contract (`src/integrations/types.ts`), sealed tokens, OAuth start/callback routes with a sealed state cookie and PKCE, signed public media links (Instagram), connections domain (verify account onto the destination, refresh, expire, disconnect), publish job + `publish_status` follow-up, the minute scheduler for "Approved" channels, Publish now on the desk, Connect/Disconnect on Accounts. 12 tests with a fake connector.
- Connectors for YouTube (resumable upload, captions, thumbnail, status, metrics), TikTok (inbox upload or direct post, status, metrics) and Instagram (Reels container → publish, limit check, insights): registered; 62 mocked-fetch tests. Each connector's `conditions` text states what could not be verified against the live docs (the sandbox can't open Google/TikTok/Meta developer pages; web-search excerpts were used).
- API analytics (`src/domain/api-analytics.ts`, job `pull_metrics`, migration `0003_api_analytics`): the worker's housekeeping queues a pull for each verified, real publication on a connected destination whose connector reads metrics, daily for 30 days after publication and then weekly (counted in UTC days from the last attempt, kept in `metric_pulls`). Rows are `metric_snapshots` with source `api`, one per post, metric and UTC day (a partial unique index; a re-pull that day updates it), and views run the milestone rules. Auth failures mark the connection expired ("needs reconnecting" on Analytics and Accounts) and stop its pulls with no retries; network errors retry with backoff; simulated and demo publications are never pulled; Stop external actions pauses pulls. Refresh now on Analytics and on the episode page (new Numbers section). Every number shows a source tag (API / CSV / MANUAL / ESTIMATE / DEMO) and when it was pulled or logged. 14 tests with a fake connector.
- Fixed on Accounts: the connection's Disconnect and TikTok forms were nested inside the account's Save form (invalid HTML: a hydration error, and without JS the Save fields fell outside their form).
- Not yet: watch time from YouTube (needs the YouTube Analytics API scope, so a reconnect) and Instagram reel watch-time insights; the pull records them as soon as a connector returns them.

## Stage E (push notifications: done)
- Settings → Notifications: **Notify this device** (service worker + PushManager with the studio's VAPID public key, the only key that reaches a browser), the device list with **Remove** (and "this device" found by an endpoint hash, never the endpoint), **Send a test notification**, and the last five notifications. **Turn off on this device** unsubscribes and forgets it. iPhone/iPad: from the Home Screen app only (the screen says so).
- Rules in `src/domain/push.ts` (migration `0004_push_notifications`: `push_keys`, `push_subscriptions`, `push_events`): VAPID keys made on first need, private key sealed (INTEGRATIONS_KEY, else HKDF from SESSION_SECRET; refused with a clear message when neither is set; an unreadable key offers a reset); endpoints only on known push services over https; one row per browser; 404/410 deletes the device; the worker's minute tick sends (a) upload due 30 min before a manual slot with an approved, ready post, (b) a scheduled automatic publish that dead-lettered or ended handed off (inbox/private), (c) an Instagram slot passed with nothing planned; each at most once (dedupe key inserted before sending). Never for demo or simulated posts. Events older than 90 days are pruned.
- `public/sw.js`: `push` shows the notification, `notificationclick` opens its screen (same origin only: the desk task, Calendar or Settings), `pushsubscriptionchange` re-saves a renewed subscription through the owner-only `POST /api/push/subscription`.
- `src/lib/push-sender.ts` is the only code that reaches a push service (web-push); the domain takes the sender as a parameter. 24 tests with a fake sender (no network), including one that checks web-push accepts the options and the VAPID JWT verifies against the public key.
- Verified in Chromium at 390 px and 1440 px (no overflow, no page errors; the no-JS view lists devices with working Remove). A real subscription can't complete in this sandbox (it can't reach Google's push registration), so the flow was checked up to the browser's subscribe call; the subscribe now gives up after 30 s with a clear message instead of "Working…" forever.

## Next
- Connect the first real account (needs the owner's Google Cloud / TikTok / Meta app credentials in `.env.local`); verify a real upload end to end on a private test video.
- When a paid generator exists: its job calls `canUsePaidGeneration` first and records its estimate, then the actual cost, in `cost_ledger` (with `job_id`); concurrent paid jobs will need a reservation under a lock, like rewards.
- **Stage D:** hosted deployment (managed Postgres, object storage for media). Then turn on notifications on the owner's phone from the Home Screen app and send a test; set `PUSH_SUBJECT` (mailto: or the https site) for Safari.

## Open owner decisions
- Final names for Skincare and What If? (both are working names); the Skincare narrator voice.
- Real handles, emails and links for the 11 accounts (Accounts screen).
- Whether Skin School content joins the shared Instagram (only with Evelyn/Lumevina's agreement).
- Reward budget: monthly cap and funding (nothing is reserved until set).
- Production budgets: a monthly amount per channel (Costs). Paid generation stays off until one is set and Settings → Paid generation is on.
