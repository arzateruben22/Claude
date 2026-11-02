# Changelog

## 0.7.0 — 2026-11-02 (layout round 2)
- Review, phone-first: on a phone, Review is a full-screen vertical player, one episode per screen. Swipe sideways
  (scroll snap) or tap ‹ ›; the top line gives the channel, number, title and "3 / 18". A thumb bar at the bottom holds
  the platform switches (YouTube, TikTok, Instagram; a green dot marks an approved account), Hold and "Approve ·
  <platform>". Below the video: the chosen platform's title, caption and hashtags (once), and the numbered sources.
  Hold opens a short "What needs fixing?" box and adds a hold note (the episode is blocked, as before). Desktop keeps
  the cards: the video beside the same switches, buttons and text. The switches are radio inputs and the panels follow
  them in CSS, so all of it works without JavaScript and in the static preview; with JavaScript, a video stops when
  its episode leaves the screen, the address follows the episode (#ep-…), ← → step, and Escape closes Hold.
- The episode page opens with the same player (full screen on a phone); Previous/Next step through the review queue.
  The QA line, Move, Accounts and text (editing), Numbers, Sources, Script and Notes follow below.
- Outer Layer and Back of the Envelope have their own look on the wall, in the monitor strip and on their screens.
  Outer Layer is a light slide (ground, ink, water, UV; Newsreader and Red Hat Text): its standby monitor lists the
  season over a cross-section of skin under UV, and its screen opens on a light panel. Back of the Envelope is graphite
  and marker (marker, tally, ballpoint; Bricolage Grotesque, Figtree, JetBrains Mono for figures): its titles sit over
  a ballpoint envelope with "≈ ?". The rest of the studio keeps the night look. Fonts as woff2 with their OFL licences
  (public/fonts/SOURCES.md).
- Their colours are final (Outer Layer #00685F, Back of the Envelope #EB63FF), and so are their names: migration 0005
  updates both channels where the colour is still the old default and drops "working name". On a local database run
  `npm run db:migrate` (`npm start` doesn't migrate); the Docker server applies it on start.
- Season progress on every monitor and channel screen, from the database: "Season 1 · 6 of 6 ready" (and "· n posted"
  once published) with one segment per episode. A channel with nothing imported reads "Season 1 in production" with
  its six planned titles (catalog PLANNED_SEASONS), never numbers (src/domain/season.ts, tested).
- On a phone, the monitor strip scrolls the current screen's name into view.
- The wall's status line reads "6 to review" (the season line says how many are ready), and each monitor link has a
  spoken name in sentences ("Rest Frame. 6 to review. Season 1 · 6 of 6 ready. Status light: needs review.").
- Phone wall: a channel with its own identity shows full size before its first cover (the top screen across the width,
  the portrait screens in pairs), so the planned titles are readable on a phone too.
- Phone polish: pages start below the notch and clear the rounded corners (the installed app's status bar is
  translucent); in the installed app a dark band sits under the status bar and the page doesn't rubber-band past its
  ends; no tap flash or double-tap delay on controls; the tab bar and thumb bar aren't selectable; a calmer lede on
  phones; Accounts' help links are 44 px tall.
- Phone polish after review: the offline banner sits below the notch; the lede stays at body size (16 px); one
  kicker-to-title rhythm on every screen, and a page without a lede gives its first panel room; Review's first episode
  keeps a dimmed Previous so the thumb bar never shifts; the Hold sheet meets the bar; the episode page says "1 of 18
  in review". A phone on its side (a browser tab; the installed app stays upright) gets a slim tab bar, a wall that
  fits the screen and Review's buttons above the tab bar.

## 0.6.4 — 2026-10-26 (final check)
- Costs: while a studio budget is set, an entry in another currency anywhere that month (studio-wide or any channel's)
  holds back paid generation for every channel, after the "budget used" checks, and the reason names each entry and
  where it was recorded ("€15.00 Display font licence, studio-wide"). 0.6.3 had let such entries past the studio
  budget; without a studio budget they still hold back nothing but their own channel.
- Posting sheets and the ZIP text file label the sources thread once ("Pinned comment", then "Reply" or "Reply 1, 2…"),
  like the screens.
- Phones: the home header links and review titles get a 44 px tap area without moving the text; cost rows align their
  episode link with the other details.

## 0.6.3 — 2026-10-26 (last review fixes)
- Costs: a cost in another currency holds back paid generation only for the channel it was recorded for, and the reason names it ("a £4.00 entry in another currency this month (Stock clip)"). A studio-wide one is listed as not converted in the All channels figures and turns no channel off. A budget already used now says "budget used" (or "studio budget used") instead of "another currency". The reason shows under the chip on each row, not only as a tooltip.
- Costs: "All channels" and "All entries" for the unfiltered views; "Studio-wide" now only means entries with no channel; categories read "Voice", not "voice". The over-budget amount in By month no longer breaks after its minus sign, and estimates there carry the boxed ESTIMATE tag.
- Record a cost: with a channel chosen, only its episodes can be picked; on Studio-wide, picking an episode moves Channel to the episode's channel. The hint says so.
- Phones: every standalone link and button is at least 44 px tall (the Costs and channel tabs, the channel names on Costs, list and title links, status chips that link); routes that sat inside a sentence ("Plan the week", "Add its handle", "Reconnect in Accounts", "All analytics", Settings → "Budgets and costs") are buttons beside it.
- The More menu is opaque, so the page no longer shows through it.
- Upload Desk: on wider screens the post fields sit right beside the portrait video (no empty column).
- Sources thread: "Pinned comment", then "Reply" (or "Reply 1", "Reply 2" when there are several), each counted once; the checklist reads "then post the reply under it".
- `npm start` runs the standalone server (`scripts/start.mjs`), as the Docker image does; `next start` warned that it doesn't support standalone output. `npm run preview` uses it too.

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
