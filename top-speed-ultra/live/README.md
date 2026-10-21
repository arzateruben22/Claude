# OC Ultra: the live server

The first real server for the game: accounts, a lobby with a cap on how many drive at once (25 to start), and a
relay that shows every driver the other drivers' cars on the freeway. It is an **alpha**. The game stays honest
about it: "Live · alpha" on the menu, the cap and the line explained before anyone signs up, and nothing it
doesn't do is claimed.

What it does today:

- **Accounts.** Sign up with a driver name (3 to 16 letters, numbers or underscores), a password (8 or more
  characters) and a 13-or-older check; email is optional and unused until password reset exists. Passwords are
  hashed with scrypt; sessions are 32-byte random tokens, stored hashed, good for 30 days. Log-ins are rate
  limited (10 wrong tries per name, 40 sign-ups or log-ins per address, per 15 minutes).
- **The lobby.** `MAX_PLAYERS` drivers online at once. Everyone past that waits in line, in order, sees their place
  (#1, #2, …) and is let in as slots free. One car per account: a second log-in replaces the first. The cap can be
  changed while it runs (`deploy/cap.sh 50`) and is kept across restarts.
- **The relay.** Each driver's game sends its car's pose about ten times a second (x, y, z, heading, speed, brake
  light). The server drops anything it doesn't believe (off the map, over 200 m/s, a jump of more than 240 m/s
  between two poses, a non-number) and disconnects a client that keeps sending it. Ten times a second it sends each
  driver the poses of the drivers within 3 km. Nothing scored leaves the device: scores, credits, levels and the
  garage stay in the player's browser as before.
- **In the game.** The other drivers are ghosts drawn with the coupe body in each driver's paint. No collisions
  (nothing to grief), no sound, no chat, no names over the cars yet.

What it doesn't do yet (honest list): email verification and password reset (needs an email sender; Resend's
free tier covers it), name moderation, chat, names over cars, races against real people, an online leaderboard
(that needs anti-cheat, and the relay has none worth the name), and more than one lobby.

## Run it here

```bash
cd top-speed-ultra/live
npm install
MAX_PLAYERS=25 node server.mjs          # http://127.0.0.1:8791/health
npm test                                # 6 tests: accounts, the cap and the line, the relay, what it refuses
node test/load.mjs 100 20               # 100 pretend drivers for 20 s: CPU, bandwidth, snapshots per second
```

In the game (dev server or the built page): Live · alpha on the menu → Account → server address
`http://127.0.0.1:8791` → Sign up → turn on "Drive live" → Drive. A second browser (or a private window) with a
second account drives on the same freeway and each sees the other's car. The suite's `live` group does exactly
this with three browsers against a cap of two: `npm test -- --only=live` from `top-speed-ultra/`.

## Put it on the internet

The browser only opens a socket from an https page to a `wss://` server, so the server needs HTTPS, so it needs a
domain. Steps (about 30 minutes, once):

1. **A domain** (about $10 a year; see costs). Point an `A` record, say `live.yourdomain.com`, at the server's IP.
2. **A server.** A $6 DigitalOcean Droplet (1 vCPU, 1 GB, Ubuntu 24.04) is enough for the first caps. The owner's
   trading desks already run on one like it (`../../START-HERE.md`); the live server can share that machine
   (then it costs nothing extra) or get its own (recommended once real players are on it, so one can't take the
   other down).
3. **Install.** On the server:
   ```bash
   git clone -b claude/always-on https://github.com/arzateruben22/Claude.git oc && cd oc/top-speed-ultra
   npm ci && npm run build                   # builds dist/top-speed-ultra.html, which the server then serves at /
   cd live && sudo LIVE_DOMAIN=live.yourdomain.com bash deploy/setup.sh
   ```
   That installs Node 22 and Caddy, copies the server to `/opt/oc-live`, writes `/etc/oc-live.env` (the cap, an
   admin token, the paths), and starts `oc-live` and Caddy as services. Caddy fetches the certificate itself.
4. **Play.** Open `https://live.yourdomain.com/`: the game page is served by the live server, so the address field
   can stay empty. Players who open the game from the downloaded file or the artifact link type the address in once.

Day to day:

```bash
bash deploy/status.sh           # online / cap, in line, peak, poses relayed and dropped, CPU and memory
bash deploy/cap.sh 50           # raise the cap (no restart; kept after one)
journalctl -u oc-live -f        # the log: one JSON line per join, leave, queue, kick
git pull && npm run build && sudo LIVE_DOMAIN=live.yourdomain.com bash deploy/setup.sh   # update
```

Back up `/opt/oc-live/data/live.db` (the accounts). It is small; the Droplet's own backups ($1.20 a month) or a
nightly `sqlite3 .backup` copy both do.

## What it costs

Prices as found on 2026-10-21 from the providers' pages and price trackers (the official DigitalOcean page could
not be fetched from this sandbox; its figures are from third-party guides and should be checked at
digitalocean.com/pricing before buying). Everything is monthly unless marked.

| Item | Needed? | Cost | Notes |
| --- | --- | --- | --- |
| **Server:** DigitalOcean Basic Droplet, 1 vCPU / 1 GB / 1 TB transfer | Yes (or share the desks' box) | **$6** | The $4 (512 MB) tier would run it but leaves little room for Caddy and updates. Sharing the existing $6 trading box costs $0 extra. |
| Droplet backups (weekly) | Recommended | $1.20 | 20% of the Droplet price. |
| **Domain** (.com at Cloudflare Registrar, at cost) | Yes (HTTPS needs it) | about **$10.46 a year** (≈ $0.87) | Namecheap, Porkbun and others are in the same range; renewals at Cloudflare are the same price. |
| TLS certificate | Yes | $0 | Let's Encrypt, fetched and renewed by Caddy. |
| Bandwidth | Included | $0 up to 1 TB, then $0.01 per GiB | See the budget below: a full lobby of 25 all day, every day, would use about 0.9 TB; real use is a small fraction. |
| Email for password reset (Resend) | Later, optional | $0 | Free tier: 3,000 emails a month, 100 a day. |
| Cloudflare in front (DDoS, caching) | Optional | $0 | The free plan proxies WebSockets. |
| Alerts (ntfy, as the desks use) | Optional | $0 | |
| **Total, own server** | | **about $7 to $8 a month** | $6 + $1.20 backups + the domain. |
| **Total, sharing the desks' server** | | **about $1 a month** | the domain only. |

Not needed: an Apple or Google developer account (the server has nothing to do with the stores), a database
service (SQLite on disk), a message broker, or any paid plan.

Alternatives, if the owner prefers them:

- **Fly.io**: a `shared-cpu-1x` 256 MB machine is about $1.94 a month in Ashburn plus a small volume for the
  database ($0.15 per GB); pay as you go, no plan. Cheapest, but 256 MB is tight above the first caps, and egress
  is billed.
- **Hetzner**: raised its prices twice in 2026 and some entry plans were unavailable in US locations in August;
  check hetzner.com before counting on it.
- **Cloudflare Workers + Durable Objects**: $5 a month minimum, no egress charges, scales by itself; but this
  server would need a rewrite for it (no Node, no SQLite file, a different socket model). Not for this code.

### The bandwidth budget

One pose row in a snapshot is about 45 bytes of JSON. A driver receives one snapshot every 100 ms holding the
drivers within 3 km of them, so with everyone bunched up:

| Drivers online | Rows per snapshot | Per driver | Whole lobby | If full 24/7 |
| --- | --- | --- | --- | --- |
| 25 | up to 24 | 11 KB/s | 270 KB/s | 0.7 TB a month |
| 50 | up to 49 | 22 KB/s | 1.1 MB/s | 2.9 TB a month |
| 100 | up to 99 | 45 KB/s | 4.5 MB/s | 11 TB a month |

Drivers spread over the whole county see far fewer than "everyone", and a lobby is not full around the clock, so
real use at 25 is tens of GB a month. The table says when the relay must change: before the cap passes 50, move
the poses to a binary frame (12 bytes a row instead of 45) and cap rows per snapshot at the nearest 32. That is on
the ladder below.

## Growing the cap: the ladder

Start at 25. Raise it one rung at a time, after a week at the current rung in which **all** of these held
(`deploy/status.sh` has every number):

- the peak reached the cap at least a few times (people actually waited in line; `queuedEver` grew),
- CPU stayed under 50% at the peak and memory under 60% (`status.sh`, or `top`),
- dropped poses stayed under 1% of poses in, and kicks for "Timed out" didn't spike (a sign the box is lagging),
- bandwidth stayed inside the month's allowance at the pace it was going,
- nobody reported ghosts jumping or appearing late.

| Rung | Cap | What changes first |
| --- | --- | --- |
| 1 | **25** | Nothing. This is the launch setting. |
| 2 | **50** | `bash deploy/cap.sh 50`. Same box. |
| 3 | **100** | Binary poses and the nearest-32 rule in the relay (a day's work, no change to accounts). Consider the 2 GB Droplet ($12). |
| 4 | **200** | 2 vCPU Droplet ($18), or a second lobby (north and south county) on the same box. |
| 5 | **500** (`CAP_MAX`) | The relay moves to per-region rooms and a dedicated box; by then it earns its keep. |

The measured numbers from `node test/load.mjs` on each machine belong in the progress log; the ones from this
sandbox are there under 2026-10-21.

## Security notes, for the next review

- Passwords: scrypt (N=16384, r=8, p=1), 16-byte salt, constant-time compare; an unknown name costs the same time
  as a wrong password (a dummy hash is checked), so names can't be enumerated by timing.
- Tokens: 256-bit random, only their SHA-256 is stored; a log-out deletes the session; expired sessions are swept
  every minute.
- The socket: hello within 8 s or it's closed; one message type per state; 1 KB max frame; up to 15 poses a second
  accepted, the rest dropped without a strike; 40 bad poses and the client is disconnected; a dead socket is
  dropped after 45 s without a pong.
- The admin endpoint only exists when `ADMIN_TOKEN` is set, and then only answers to it (a wrong token gets a 404).
- The service runs as its own user with a read-only system and can write only its data folder (the unit file).
- Not done: email verification, password reset, name moderation, abuse reports, per-account bans (a `banned`
  column and a check in `sessionFor` is all it takes), and any anti-cheat beyond plausibility (the relay never
  scores, so there is nothing to cheat for yet).
- Privacy: the server stores the name, the optional email, the password hash and the times of sign-up and last
  log-in. It logs joins and leaves with the account id and name. It never sees scores, the garage or the device.
