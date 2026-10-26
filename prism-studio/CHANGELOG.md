# Changelog

## 0.6.2 — 2026-10-26 (review fixes)
- Sign-in: the redirect after signing in stays on the site (`/<tab>/evil.example` used to leave it); a device you've signed in on before gets past the studio-wide ceiling, so strangers filling it can't lock you out (`prism_device` cookie; DEPLOY.md section 8).
- Analytics: a token refresh that fails on the network no longer marks the connection expired (the job retries); Instagram's "(#10) not enough viewers" fails that post's pull only, instead of stopping the account's publishing; a same-day re-pull that lowers the views flags the unlocks it backed; Refresh now pressed twice in a minute says "Just refreshed" instead of "Already queued".
- Settings: Paid generation no longer blocks the save (Stop external actions included) in a month without a channel budget; turning it on without one leaves it off with a notice.
- Forms keep what you typed when a submit is refused (they clear only after a success).
- Costs and channel pages: the selected tab is scrolled into view on a phone; the Costs heading names the channel.
- Moving a cost to another channel refreshes both channels' pages.
- Notifications: when every device failed for a passing reason (the push service down), the next minute tries again.
- Posting text: TikTok's pinned comment keeps the production note when no sources are recorded, and TikTok and Instagram warn; Instagram's caption no longer points at a sources comment that isn't there. Spoken pairs before a noun ("in nineteen twelve patients") stay in words; "nineteen eighteen and nineteen nineteen" becomes "1918 and 1919".

## 0.6.1 — 2026-10-26 (docs and preview)
- `npm run preview`: builds if needed, starts the production server on a free port against the dev database, signs in, screenshots the wall (desktop and phone), the Instagram screen, a channel screen, Costs and Settings → Notifications into `docs/preview-gallery/`, rewrites the gallery's figures and date, and stops the server.
- The gallery gains Costs and Notifications.
- Removed the static snapshot (`scripts/snapshot.tsx`, `npm run snapshot`, `docs/preview.html`) and the old-design `docs/preview-phone.png`; both showed the screens before the redesign.
- README, RUNBOOK, PROJECT_STATE and DECISIONS brought up to date (covers, posting packs, import, notifications, analytics, backups, deploy; what needs the owner).

## 0.6.0 — 2026-10-26 (going online: ops hardening)
- Sign-in protection: per-address exponential backoff and doubling lockouts, a studio-wide ceiling of 20 failures an hour, one check at a time (parallel requests can't slip past), an async constant-time passphrase check, and audit entries for sign-ins, failures and lockouts (never the passphrase).
- Nightly database backups on the server (`backup` service, `deploy/backup.sh`): 03:15, 14 daily + 8 weekly, verified, with `once`, `list` and a `restore` that keeps the replaced database.
- A smaller Docker image (1.44 GB → 405 MB): Next standalone output and only the worker's and scripts' packages.
- Fixed: `.env.production` was neither git-ignored nor docker-ignored (the old image could have carried it).

## 0.5.1 — 2026-10-26 (posting-text polish)
- Descriptions and captions use written forms for numbers: years after a year word ("In 2017"), "40%", and large numbers that read one way only ("130 million"). Small counts, fractions, dates, times and anything ambiguous stay in words; titles, sources and hashtags are never changed.
- Sources that don't fit one comment become a thread: the first comment plus numbered replies, split only between sources. Separate copy fields on the post cards and the desk; in POSTING.md, `posting.json` (`replies`) and the ZIP.
- Fixed: at phone width the desk's post fields sat in a half-width column; posting notes up to 20,000 characters are accepted.

## 0.5.0 — 2026-10-26 (Stage E: push notifications)
- Settings → Notifications: Notify this device, the device list with Remove, Send a test notification, recent notifications.
- The worker notifies: upload due (30 min before a manual slot with an approved post), a scheduled automatic publish that failed or needs you, an Instagram slot passed with nothing planned. Each once.
- VAPID keys made on first use and sealed; dropped browsers (404/410) removed; the service worker opens the right screen.

## 0.4.0 — 2026-10-26 (Stage C: API analytics)
- API analytics: the worker pulls each verified post's numbers from its connected platform (daily for 30 days, then weekly), one row per post, metric and UTC day; Refresh now on Analytics and the episode page; source tags (API / CSV / MANUAL / ESTIMATE / DEMO) with pulled-at times; expired grants show "needs reconnecting" and stop pulling.
- Episode page: a Numbers section for its posts.
- Fixed: Accounts nested the connection forms inside the account's Save form.

## 0.3.0 — 2026-10-26 (Stage B complete)
- Costs screen: monthly production budgets (studio-wide and per channel), spent vs budget by month, cost entries with add/edit/void, ESTIMATE labels, and the paid-generation gate (`canUsePaidGeneration`).
- Settings → Show demo data (off by default); DEMO labels on the desk, review, calendar and analytics; real-only analytics totals; `db:seed -- --demo`.
- Nav badge counts and channel episode counts no longer include demo episodes.

## 0.2.2 — 2026-10-26 (the monitor wall)
- Home is a wall of six monitors over an original, code-rendered night skyline (`npm run wallpaper`): Instagram in the middle, a screen per channel around it; on a phone, Instagram first.
- A screen per monitor (`/m/<slug>`): each account's next post with cover or thumbnail, title, caption, hashtags and sources comment, copy buttons, and Download / Open only for approved posts.
- Instagram: two slots a day, rotating across the channels, never the same episode twice; a passed slot with nothing planned reads "Missed".
- Covers and thumbnails for every delivered episode (`npm run covers`), from a caption-free frame in the channel's theme.
- The night-glass look on every screen; calmer status (dot and word).
- Hashtags paste once (some copies had them twice); the desk folds away unapproved tasks; a hand-off without a live approval is ignored.

## 0.2.1 — 2026-10-26 (hosting on one server)
- Docker image and `docker-compose.yml`: Postgres, the web app, the worker and Caddy (automatic HTTPS); `/api/health`; `deploy/sync-media.sh`; `deploy/DEPLOY.md`.
- A lesson build queued on a host without the films toolchain stops once, saying where to run it.

## 0.2.0 — 2026-10-25 (Stage B + Stage C first cut)
- Lessons (compilations) built by the worker; Learn screen; posting text engine with POSTING.md packs.
- Automated publishing: connector contract, sealed OAuth grants, connect flow, publish and status jobs, scheduler, Publish now.
- Fixed: multi-line VO lines were cut at the first line end when read from script.md.

## 0.1.0 — 2026-10-25 (Stage A)
- Foundation: schema, domain rules, seed, and the episode import from the films pipeline.
- Every Stage A screen, the Upload Desk with manual publishing, the PWA shell, the worker.
- Tests: 52 domain/library tests and a 14-step end-to-end run.
- Fixed while testing:
  - Raw-SQL array parameters (reward balances, job type filter).
  - A spring-forward daylight-saving time converted 31 minutes late.
  - Unlock celebrations were lost when the task left the desk.
  - Media streams crashed the server when the browser cancelled.
