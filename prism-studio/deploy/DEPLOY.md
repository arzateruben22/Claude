# Hosting Prism Studio

Prism runs on your laptop today. To connect real accounts it needs a public **https** address: Google, TikTok
and Meta send you back to it after you approve access, and Instagram downloads each Reel from it. This folder
puts the studio on one small server with automatic HTTPS.

**What runs where**

| Machine | Runs | Why |
|---|---|---|
| Server (this guide) | Postgres, the web app, the worker (publishing, status checks, scheduling), Caddy (HTTPS) | always on, reachable by the platforms |
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
| Back up the database | `docker compose exec -T db pg_dump -U prism prism > ~/prism-$(date +%F).sql` |
| Restore a backup | `docker compose exec -T db psql -U prism prism < ~/prism-YYYY-MM-DD.sql` |
| Stop everything | `docker compose down` (data stays in the volumes) |

Keep `.env.production` and the backups off GitHub. The studio stores no platform passwords; connection tokens are
sealed with `INTEGRATIONS_KEY`. Losing that key means reconnecting every account.

## What was tested, and what wasn't

Tested in the build container on 26 Oct 2026: the image builds from a clean copy of the committed code; `db`, `app`
and `worker` start; migrations and the seed run; `/api/health` answers 200; an unsigned visit redirects to the login
page; signing in with the passphrase opens the home screen; the worker starts its job loop.

Not tested there (it needs a real domain): Caddy getting the certificate, and the platforms' redirects. The
sandbox also reaches npm through a proxy, so the test build used a variant of the Dockerfile with that proxy's
certificate. The committed `Dockerfile` is the plain one.
