# Hosting Prism Studio

Prism runs on your laptop today. To connect real accounts it needs a public **https** address: Google, TikTok
and Meta send you back to it after you approve access, and Instagram downloads each Reel from it. This folder
puts the studio on one small server with automatic HTTPS.

**What runs where**

| Machine | Runs | Why |
|---|---|---|
| Server (this guide) | Postgres, the web app, the worker (publishing, status checks, scheduling), nightly database backups, Caddy (HTTPS) | always on, reachable by the platforms |
| Your films machine (this repo) | rendering, compilations (`compilation.mjs`), covers, posting packs | needs Chromium, ffmpeg and the cinema kit; heavy |

Finished files travel from the films machine to the server with `deploy/sync-media.sh`. A compilation job queued
on the server stops at once with a message saying to build it on the films machine; it doesn't retry.

## 1. What you need

- A server with Docker: 2 vCPU, 2 GB RAM, 40 GB disk is enough to start (each short is about 25 MB). Any VPS works
  (Hetzner, DigitalOcean, Lightsail…).
- A domain or subdomain (for example `studio.yourname.com`) with a DNS **A record** pointing at the server.
- Ports 80 and 443 open (Caddy uses them to get and renew the certificate).

## 2. First start

```bash
# on the server
git clone <this repo> /srv/prism && cd /srv/prism/prism-studio
cp deploy/env.example .env.production
openssl rand -hex 32    # run three times: POSTGRES_PASSWORD, SESSION_SECRET, INTEGRATIONS_KEY
nano .env.production     # DOMAIN, the three secrets, OWNER_PASSWORD_HASH (step 3)
mkdir -p films-mirror
docker compose --env-file .env.production up -d --build
```

The web container migrates the database and seeds the channels on every start (both safe to repeat), then serves
on port 3100 behind Caddy. Check it: `curl https://<your domain>/api/health` should print `{"ok":true}`.
`docker compose ps` should show `app`, `db` and `backup` as healthy (the backup service makes its first backup a
minute after the first start; section 7).

The image is about 405 MB on disk (93 MB to download), down from 1.44 GB: it carries Next's standalone server and
only the packages the worker and the migrate / seed / import scripts load (drizzle-orm, pg, web-push, tsx), not the
compiler, the test tools or the build cache. The build stops with an error if the worker or a script ever imports a
package the image doesn't carry.

## 3. Your passphrase

Generate the hash on any machine with the repo (the passphrase itself never goes on the server):

```bash
npm run owner:password -- "a long passphrase only you know"
```

Copy the printed `OWNER_PASSWORD_HASH=…` line into `.env.production`, then `docker compose --env-file .env.production up -d`.

## 4. Episodes and media

```bash
# on the films machine, from the repo root
prism-studio/deploy/sync-media.sh you@server:/srv/prism/prism-studio/films-mirror
# then on the server
docker compose --env-file .env.production run --rm app import
```

Only `films/channels/*/ep*/out/` and `films/channels/*/compilations/` are copied. The import is the same as
`npm run import:episodes` locally; it never overwrites an approval.

## 5. Connect the platforms

In each developer console, set the redirect URI to your domain:

| Platform | Redirect URI |
|---|---|
| YouTube (Google Cloud OAuth client) | `https://<domain>/api/auth/youtube/callback` |
| TikTok for Developers | `https://<domain>/api/auth/tiktok/callback` |
| Instagram (Meta app, Instagram Login) | `https://<domain>/api/auth/instagram/callback` |

Put each app's ID and secret in `.env.production`, restart (`up -d`), then open **Connections** in the studio. The
platform conditions (test mode, audits, quotas) are in `../INTEGRATIONS.md`.

## 6. Everyday operations

| Task | Command (on the server, in `prism-studio/`) |
|---|---|
| Update to the latest code | `git pull && docker compose --env-file .env.production up -d --build` |
| Logs | `docker compose logs -f app worker` |
| Back up the database now | `docker compose --env-file .env.production run --rm backup once` |
| See the backups | `docker compose --env-file .env.production run --rm backup list` |
| Restore a backup | section 7 |
| Who signed in, failed tries | `docker compose exec db psql -U prism -c "select created_at, action, detail from audit_log where entity = 'owner' order by created_at desc limit 20"` |
| Stop everything | `docker compose down` (data stays in the volumes; never add `-v`, it deletes the database) |

Keep `.env.production` and the backups off GitHub (`.gitignore` and `.dockerignore` already leave out
`.env.production`, `backups/` and `films-mirror/`). The studio stores no platform passwords; connection tokens are
sealed with `INTEGRATIONS_KEY`. Losing that key means reconnecting every account.

## 7. Backups

The `backup` service does this on its own; nothing to set up.

- **When:** every night at 03:15 server time (UTC, unless you set `BACKUP_TZ`, for example
  `BACKUP_TZ=America/Los_Angeles`, or another `BACKUP_AT=HH:MM` in `.env.production`). On start, if the newest
  backup is over a day old, it makes one at once. A failed backup is tried again twice, 10 minutes apart.
- **Where:** `prism-studio/backups/` on the server: `daily/prism-YYYY-MM-DD.sql.gz` (the newest 14 kept) and
  `weekly/prism-YYYY-Www.sql.gz` (the first backup of each week; the newest 8 kept, about two months). Each is the
  whole database as gzipped SQL, checked after writing. Only root can read them: they hold everything in the studio.
- **Check:** `docker compose ps` shows `backup` as unhealthy when the newest backup is over 26 hours old; its log says
  why (`docker compose logs backup`).
- **Keep a copy elsewhere.** Backups on the server's own disk don't survive losing the server. From your laptop, now
  and then: `rsync -a --rsync-path="sudo rsync" you@server:/srv/prism/prism-studio/backups/ ~/prism-backups/` (or
  turn on your VPS provider's disk snapshots).
- The videos aren't in the database: they live on the films machine (`films/channels/*/ep*/out`) and in
  `films-mirror/`, which `sync-media.sh` can always copy again.

**Restore** (it loads the backup into a new database, checks it loaded completely, and only then swaps it in; the
database it replaces is kept, renamed `prism_before_restore_<date>_<time>`):

```bash
cd /srv/prism/prism-studio
docker compose --env-file .env.production run --rm backup list                  # pick one
docker compose --env-file .env.production stop app worker                       # it refuses while they're connected
docker compose --env-file .env.production run --rm backup restore daily/prism-2026-10-25.sql.gz
docker compose --env-file .env.production up -d                                 # migrations bring an older backup up to date
```

Sign in and look around. When all is well, drop the old copy (the restore prints its exact name):
`docker compose exec db dropdb -U prism prism_before_restore_20261026_101500`. To undo instead, stop `app` and
`worker` again and rename the databases back with `psql -d postgres` (`alter database … rename to …`).

**On a new server** (the old one is gone): do section 2 with the same `.env.production` (above all the same
`INTEGRATIONS_KEY` and `SESSION_SECRET`), copy the backup file into `backups/daily/` there, then
`docker compose --env-file .env.production stop app worker`, the `restore` line above, and `up -d`.

## 8. Sign-in protection

One passphrase guards the studio, so sign-in is throttled in the web container: after a wrong passphrase that
address waits 1, 2, 4, then 8 seconds; the 5th wrong try locks it for 15 minutes, and each further lockout doubles
(up to 24 hours). Across all addresses, at most 20 wrong tries an hour are accepted. Tries sent in parallel can't
get around this (each one reserves its place before the check), and the check is constant-time. Every failure,
lockout and sign-in is in the audit log with the address (never the passphrase). Restarting the web container
clears the counters. A device that is already signed in stays signed in (30 days).

Strangers can fill that hourly ceiling on purpose. So every successful sign-in also leaves a signed `prism_device`
cookie on that browser (400 days, separate from the session and never a session itself): a device you've signed in
on before can sign in even while the ceiling is full, still held to its own address's waits and lockouts. A new
phone or laptop has no such cookie: if the ceiling is full when you first sign in on it, wait for the hour to pass,
sign in from a device you've used before, or restart the web container (`docker compose restart app`). Changing
`SESSION_SECRET` signs every device out and forgets every device mark.

## What was tested, and what wasn't

Tested in the build container on 26 Oct 2026, with the slim image: built from a clean copy of the committed code
(`git archive`, then this change copied over); `db`, `app`, `worker` and `backup` started from `docker-compose.yml`
with a test env file and an override publishing the app on 127.0.0.1:3199 (no Caddy). Migrations and the seed ran;
`/api/health` answered 200; an unsigned visit redirected to the login page; in Chromium at 390 px and 1440 px a wrong
passphrase was refused ("Wait 1 s" on an immediate retry) and the right one opened the home screen with no page
errors; the audit log held the failure and the sign-ins with the address and no passphrase; the worker started its
job loop; `run --rm app import` ran the episode import. The backup service made its start-up backup, `once`,
`list` and `prune` worked, the healthcheck turned healthy, and `restore` refused while the app was connected, then
swapped in the backup (a row written after the backup was gone, the old database kept) and the app came back
healthy. The script was also run against the dev database into a scratch folder and restored into a scratch
database (same row counts in every table checked); retention was checked with 20 daily and 13 weekly files (14 and
8 kept, other files untouched). Image size measured the same way before (1.44 GB) and after (405 MB).

Not tested there (it needs a real domain): Caddy getting the certificate, the platforms' redirects, and the
address Caddy passes on (the throttle reads the last `X-Forwarded-For` entry; Caddy sets it to the client's
address). A night-time run at 03:15 wasn't waited for (`backup.sh next` printed the right number of seconds). The
sandbox also reaches npm through a proxy, so the test build used a variant of the Dockerfile with that proxy's
certificate (never committed). The committed `Dockerfile` is the plain one.
