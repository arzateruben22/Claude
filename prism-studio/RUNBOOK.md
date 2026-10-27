# Runbook

## Daily routine (about 15 minutes)
1. **Home** is the wall. The line at the top says what's due today and how many episodes wait for review. Each
   monitor shows its next post; open one to see every account it feeds. The **Upload Desk** lists the same tasks
   in time order.
2. Each post is one account. Check the account card says the handle you're signed in as in that app.
3. Once a post is approved: on a phone, **Share to app** sends the exact video straight to TikTok, YouTube or
   Instagram. Otherwise **Download**, then copy the caption (and the title for YouTube). For YouTube, also upload
   **Captions .srt**. Turn on the platform's AI / synthetic-content label (the narration is synthetic).
4. If the sources are too long for one comment, post the first comment, then each **reply** in order.
5. Post it, then **Mark uploaded**: tick the account box, and paste the post link if you have it. If you scheduled it
   inside the platform instead, give that time.
6. Leaving for the app and coming back returns you to the same task.

## Library
More → **Library** lists every finished video per channel at full quality: Download (the MP4), Cover, Thumbnail,
Captions, and the episode page for each platform's text. Long videos sit at the top of their channel. Downloading
never marks anything posted.

## Weekly
- **Review** new renders: watch each one, check the sources, then approve each account's video and text.
- **Calendar → Plan the next 7 days**. Add blackout days for travel. Instagram takes two posts a day, rotating
  across the channels; an episode goes on Instagram once. A slot that passes with nothing planned shows as missed.
- **Analytics:** see below.
- **Queue:** look for dead jobs, then retry or read the error.

## New episodes from the films pipeline
On the films machine (it needs Chromium, ffmpeg and the cinema kit):
1. Render, then QA (`kits/cinema/film/qa.py`).
2. `npm run covers` draws the 9:16 cover and the 16:9 YouTube thumbnail for each delivered episode
   (`out/<name>-cover.jpg`, `-thumb.jpg`). It skips episodes whose cover is newer than the video; `--force` redoes
   them; pass `films/channels/<ch>/epNN` to do just one.
   Then `python3 -I kits/cinema/film/youtube1440.py films/channels/<ch>/epNN` makes the 1440×2560 YouTube version
   (`out/<name>-9x16-youtube.mp4`); the import gives it to the YouTube posts. TikTok and Instagram keep the master.
3. **Queue → Import rendered episodes**, or `npm run import:episodes`. A new render becomes a new version: older
   approvals end and the episode comes back to Review. A cover older than the render is not used (the film's poster
   is, until covers run again). A changed cover withdraws that post's approval.
4. `npm run text:pack` writes `out/POSTING.md` and `posting.json` next to each delivered episode, so the text is at
   hand without the studio.

On the server: `deploy/sync-media.sh you@server:/srv/prism/prism-studio/films-mirror` from the films machine, then
`docker compose --env-file .env.production run --rm app import` there.

## Posting text
- Titles, captions, hashtags, YouTube tags and the sources comment come from the script and `claims.json`.
- Edit them by hand in Review (or on the episode page). **Regenerate titles, captions and hashtags** there (one
  episode) or `npm run text:regenerate` (all) writes them again from the script and replaces hand edits. A text that
  changes loses its approval; approve it again.
- Descriptions and captions use written forms for numbers ("In 2017", "130 million", "40%"); titles, sources and
  hashtags are never rewritten.

## Analytics
- Connected accounts: the worker reads each verified post's numbers daily for 30 days, then weekly. **Refresh now**
  on Analytics or on the episode page (Numbers) asks at once.
- Other accounts: log views from each app, or paste a CSV, on Analytics.
- Every number shows where it came from (API, CSV, MANUAL, ESTIMATE, DEMO) and when. Milestones unlock from real
  numbers only.
- "Needs reconnecting": the platform refused the token. Accounts → **Reconnect**; pulls resume on their own.

## Notifications
- On each phone or computer: Settings → **Notify this device**, allow notifications, then **Send a test notification**.
  On iPhone/iPad, add Prism Studio to the Home Screen first and turn them on from there.
- You get: **Upload due** 30 minutes before a manual slot whose post is approved; **Publish failed** or **Needs you**
  when a scheduled automatic publish gave up or ended in the TikTok inbox / as private; **Instagram slot passed** when
  a slot went by with nothing planned. Tapping one opens that task, the Calendar or Settings. Each event notifies once.
- The worker sends them; nothing is sent while publishing is paused (upload due, Instagram) or external actions are
  stopped (upload due).

## Costs
- **Costs** (More → Costs): set a monthly production budget per channel (and, if you like, a studio budget: a ceiling
  for all channels together). It carries on each month until you change it. Record what you pay for (voices, music,
  services); tick **estimate** for quotes. Estimates and voided entries never count as spent. Prism only records
  costs; it never pays anything.
- Paid generation stays off unless Settings → **Paid generation** is on and that channel's budget has room this month
  (and the studio budget, when set). A cost in another currency is never converted: it holds back the channel it was
  recorded for, and, while a studio budget is set, every channel (the studio budget covers them all, so Prism can't
  tell whether it has room). The reason under the chip names the entry and where it was recorded. Without a studio
  budget, a studio-wide or other channel's entry in another currency holds nothing back. "Studio-wide" entries are the
  ones with no channel.

## Demo data
`npm run db:seed -- --demo` adds a labelled demo series. It stays hidden until Settings → **Show demo data**; shown or
not, it never counts toward progress, rewards, XP, achievements or analytics totals.

## Backups
- **On the server** (`docker-compose.yml`): the `backup` service dumps the database every night at 03:15 into
  `backups/` (14 daily, 8 weekly) and backs up at once on start if the newest is over a day old. Copy `backups/` off the
  server now and then. Restore: `docker compose stop app worker`, `docker compose run --rm backup restore
  daily/prism-YYYY-MM-DD.sql.gz`, `docker compose up -d` (`deploy/DEPLOY.md`, section 7; the replaced database is kept).
- **On a laptop:** `BACKUP_DIR=data/backups PGHOST=localhost PGUSER=prism PGPASSWORD=… PGDATABASE=prism
  sh deploy/backup.sh once` (the `data/backups` folder is git-ignored). Restore into an empty database with
  `gunzip -c FILE | psql`.
- The rendered videos live in the films repo (`films/channels/*/ep*/out`), not in the database.

## Deploy and update
- First start, passphrase, media, platform redirects and backups: `deploy/DEPLOY.md`.
- Update the server: `git pull && docker compose --env-file .env.production up -d --build` (migrations run on start).
- Logs: `docker compose logs -f app worker`. Health: `https://<domain>/api/health` prints `{"ok":true}`.
- Never `docker compose down -v`: it deletes the database volume.

## Production build on this machine
`nice -n 10 npx next build && npm start` serves the build on port 3100 (`npm start -- -p 3107 -H 127.0.0.1` for another
port or interface). `npm start` runs `.next/standalone/server.js`, the same server as the Docker image, after copying
`.next/static` and `public` next to it; it reads `.env.local` and makes `MEDIA_ROOT` and `FILMS_REPO_ROOT` absolute
(the server runs inside `.next/standalone`). Stop it with Ctrl-C. `next start` is not used: it doesn't support the
standalone output.

## Preview gallery
`npm run preview` builds if needed, starts the production server (`scripts/start.mjs`) on a free port against the dev database, signs in
with `data/DEV-PASSWORD.txt`, retakes the screenshots in `docs/preview-gallery/`, rewrites the figures and date in its
`index.html`, and stops the server. It needs Playwright with Chromium (`npm install -g playwright`). The captions are
in `scripts/preview.ts`; the "Where it stands" section is written by hand.

## Clickable preview (read-only copy of the whole app)
The owner's preview link is a static copy of every screen, so the studio can be clicked through without hosting it.
Make a throwaway copy of the database (`su postgres -c "createdb -O prism -T prism prism_static"`), run
`npm run build`, start the app on it (`DATABASE_URL=…/prism_static npm start -- -p 3111 -H 127.0.0.1`), then
`BASE=http://127.0.0.1:3111 node scripts/static-preview.cjs <out dir>`. It saves each page reachable from the wall with
its CSS, fonts, wallpaper, covers and light preview copies of the videos (540 px wide; 854 px for long videos); scripts are removed, copy buttons work
(their text is in `data-copy`), and buttons that change things do nothing. With `FILES_BASE` set to where the
films repo's files can be downloaded (a public repo's `https://github.com/<owner>/<repo>/raw/<branch>/`), the Download
buttons fetch the full-quality files from there; without it they do nothing. Publish `<out dir>/index.html` with the rest
of `<out dir>` as supporting files, then stop the server and drop the copy.

## Problems
| Symptom | Do |
|---|---|
| Can't sign in | Check `OWNER_PASSWORD_HASH` and `SESSION_SECRET` in `.env.local`. Wrong tries wait 1, 2, 4, 8 s; the 5th locks that address for 15 min (doubling each time, up to 24 h); 20 wrong tries an hour from anywhere pause sign-in for everyone. The message says how long. Restarting the web server clears it; signed-in devices stay signed in |
| A task says "not approved" | Open Review: an edit, a new cover or a new render withdrew the approval. Approve again |
| A post link is refused | Paste the platform's own https link. TikTok links must belong to the saved handle |
| Jobs stuck "running" | The worker died: start `npm run worker`. Expired leases are recovered within 15 minutes |
| Marked uploaded by mistake | Use **Undo** on the task (the audit log keeps the history) |
| Everything must stop | Settings → **Pause publishing** and/or **Stop external actions** (also pauses analytics pulls) |
| A lesson job fails on the server | Lessons are built on the films machine (`compilation.mjs`); sync and import there |
| No notifications arrive | Settings → Notifications: is the device listed, and does the test arrive? A device with failed sends shows why; one the browser dropped disappears on its own. Is the worker running? |
| "The notification signing key can't be opened" | `INTEGRATIONS_KEY` or `SESSION_SECRET` changed. Put the old one back, or press **Reset notifications** and turn them on again on each device |
| A post says "connection needs reconnecting" | The platform refused the token. Accounts → **Reconnect**; pulls resume on their own |
| `npm run preview` says sign-in failed | `data/DEV-PASSWORD.txt` doesn't match `OWNER_PASSWORD_HASH` in `.env.local` |
