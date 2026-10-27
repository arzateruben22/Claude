# Project state

_Updated 2026-10-26._ The code for stages A to E is built and tested. What's left needs the owner: a domain and a
server, developer apps at Google, TikTok and Meta, the 11 accounts, and a first private test upload.

**Checks today:** `tsc` clean; `next build` clean; 279 Vitest tests pass (one more, the real lesson build, runs only
when asked: `LESSON_E2E=1`). The screens were checked in Chromium at 390 px and 1440 px: no sideways scroll,
no page errors, no failed requests. `npm run preview` retakes the gallery in `docs/preview-gallery/`.

## Stage A: foundation (done)
- Schema, migrations and seed: 5 channels, 11 destinations, 5 creations, 40 challenges and quests, 8 milestone
  rules, 33 setup steps.
- Rules: episode numbering and states, version-bound approvals, one publication per destination, schedule, plan
  and reschedule, rewards, XP, evolution, the job queue, DST-safe times.
- Real episodes imported from `films/channels`: claims become sources; finals become versions, exports and SRT
  captions.
- Screens: Home, Upload Desk (share, download, copy, ZIP bundle, mark uploaded, undo, position memory), Review,
  episode page, channels, Calendar, Accounts and setup checklists, Analytics, Rewards, Evolution, Queue, Settings,
  sign-in, offline page. PWA shell; owner-only proxy plus a check in every action; media with HTTP Range from
  allow-listed keys only.
- Verified: a 14-step Playwright run through the real UI on a test database.

## The wall (redesign, done)
- Home is six monitors over an original, code-rendered night skyline (`npm run wallpaper`): the shared Instagram in
  the middle, What If? above, two portrait screens each side (`src/lib/rig.ts`). On a phone, Instagram comes first.
- Each monitor opens `/m/<slug>`: one card per account with the cover or thumbnail, title, caption, hashtags and
  sources comment, each with a copy button. Download and the platform's upload page appear only for an approved
  post.
- Instagram: two slots a day, rotating across the channels, oldest unplaced episode first; an episode goes on
  Instagram once. A slot that passes with nothing planned reads "Missed" and spends no episode.
- Covers (`npm run covers`): a 9:16 cover and a 16:9 thumbnail per delivered episode, from a caption-free frame of
  the final, in the channel's own theme. The import uses a cover only when it is newer than the render.
- Verified: 16 pages and sign-in at 390 and 1440 px, no console errors, no broken images.

## Stage B: lessons, learning, text, costs (done)
- Lessons: 4–6 shorts become one 16:9 compilation built by the worker, approved as an exact video and text.
- Learn: experiments (one change, a metric, a minimum sample) and learnings (finding, confidence, evidence).
- Posting text for every platform from the script and `claims.json`, within each limit; Regenerate in Review;
  `npm run text:regenerate`, `npm run text:pack`.
- Written forms in descriptions and captions ("In 2017", "130 million", "40%"); anything ambiguous stays in words.
  Tested on every narration line of the real scripts.
- Sources thread: sources that don't fit one comment become a first comment plus numbered replies, split only
  between sources. Copy fields on the post cards and the desk, in POSTING.md, `posting.json` (`replies`) and the ZIP.
- Costs (`/costs`): monthly production budgets per channel and studio-wide, cost entries (actual or ESTIMATE),
  spent against budget for six months, and the paid-generation gate (`canUsePaidGeneration`).
- Settings → Show demo data (off by default). Counting never reads the switch.

## Stage C: platform connections (built; waiting for the owner's developer apps)
- Connect with OAuth (PKCE, sealed state), tokens sealed with `INTEGRATIONS_KEY`, refresh and expiry, Disconnect.
- YouTube (resumable upload, captions, thumbnail, status, metrics), TikTok (inbox upload or direct post, status,
  metrics) and Instagram (Reels container, publish, insights). Publish now on the desk; the minute scheduler for
  channels set to "Approved". Only the platform's own answer marks a post verified.
- API analytics: the worker pulls each verified post daily for 30 days, then weekly; one row per post, metric and UTC
  day; Refresh now on Analytics and the episode page; source tags on every number.
- Tested without the network: 62 connector tests with a mocked `fetch`, and 26 publishing and analytics tests with a
  fake connector. Not tested against the live platforms: that needs the apps and accounts below. Each connector's `conditions` text says what couldn't be checked.
- Not yet: YouTube watch time (needs the YouTube Analytics scope, so a reconnect) and Instagram reel watch time.

## Stage D: going online (ready; needs a domain and a server)
- One server with Docker Compose (`deploy/DEPLOY.md`): Postgres, the web app, the worker, Caddy for HTTPS, and a
  nightly backup service (03:15, 14 daily and 8 weekly, a restore that keeps the replaced database).
- Sign-in protection: per-address backoff and doubling lockouts, a studio-wide ceiling of 20 failures an hour,
  audit entries without the passphrase.
- Image 405 MB (was 1.44 GB): Next standalone output plus only what the worker and scripts load.
- Verified in this sandbox: image built from a clean copy; db, app, worker and backup up; health 200; sign-in at 390
  and 1440 px; import; backup, list, prune and restore. Not verified: Caddy's certificate and the platforms'
  redirects (both need the real domain).

## Stage E: notifications (done)
- Settings → Notifications: turn on this device, the device list with Remove, a test notification, the last five.
- The worker sends: upload due (30 min before a manual slot with an approved post), a scheduled publish that failed
  or needs you, an Instagram slot passed with nothing planned. Each once; never for demo or simulated posts.
- 24 tests with a fake push sender. A real subscription couldn't complete in the sandbox (no route to the browser's
  push service); it needs the owner's phone on the hosted site.

## What needs the owner
1. **A domain and a server.** A subdomain with an A record to a small VPS (2 vCPU, 2 GB RAM, 40 GB), ports 80 and 443
   open. Then `deploy/DEPLOY.md` sections 2–4: secrets, the passphrase hash, media sync and import.
2. **Developer apps**, with redirect URIs on that domain (`DEPLOY.md` section 5, conditions in `INTEGRATIONS.md`):
   - Google Cloud: an OAuth client with the YouTube Data API v3; publish the consent screen to production, or
     tokens expire after 7 days.
   - TikTok for Developers: Login Kit and the Content Posting API. Until TikTok audits the app, uploads go to the
     inbox or post privately.
   - Meta: an app with Instagram Business Login; the shared Instagram must be a professional account with a role on
     the app.
3. **The 11 accounts:** five YouTube channels, five TikTok accounts and the shared Instagram. Enter each handle and
   link on Accounts, then Connect. Prism never stores passwords or 2-step codes.
4. **A first private test upload:** approve one episode for one connected account, publish it as private (TikTok:
   inbox), and check it turns verified and its numbers arrive. Then the next platform.
5. **Notifications on the phone:** open the hosted studio from the Home Screen app, turn on notifications, send a
   test. Set `PUSH_SUBJECT` (a mailto: or the https site) for Safari.
6. **Backups off the server:** copy `backups/` now and then, or turn on the provider's disk snapshots.

## Open owner decisions
- Final names for Skincare and What If? (both are working names); the Skincare narrator voice.
- Whether Skin School content joins the shared Instagram (only with Evelyn/Lumevina's agreement).
- Per channel: publish by hand, or let the worker publish approved posts ("Approved" automation).
- Whether to apply for TikTok's audit (direct public posts) or keep inbox uploads.
- Reward budget: monthly cap and funding (nothing is reserved until set).
- Production budgets: a monthly amount per channel. Paid generation stays off until one is set and Settings → Paid
  generation is on.
- Posting windows: the defaults (YouTube 09:00, TikTok 12:00, Instagram 11:30 and 18:30) are provisional.

## Next in code
- When a paid generator exists: its job calls `canUsePaidGeneration` first and records its estimate, then the actual
  cost, in `cost_ledger` with `job_id`. Concurrent paid jobs will need a reservation under a lock, like rewards.
- After the first live uploads: correct each connector against what the platform really returns, and add YouTube
  watch time.
- If the media outgrows one disk: an object-storage adapter for media (not built; `.env.example` has the `S3_*`
  names) and, if wanted, a managed database. See DECISIONS (single server).
