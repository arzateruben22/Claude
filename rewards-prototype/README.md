# Rewards prototype

A private, single-screen dashboard for a small group. Each member has an avatar, a
piggy bank of **virtual points**, XP, one of five evolution tiers and a rank; an admin
reviews what members contribute and keeps an audited ledger.

> Points are virtual. They have no cash value, cannot be redeemed or withdrawn, and are
> not a promise of future payment. Likes, comments, views, shares, follows and
> subscriptions can be shown as statistics and never earn anything.

**Status (work paused):** the data rules, business logic and sign-in modules are built
and tested. The server and its JSON API run and were checked by hand, but that layer is
a draft with **no automated tests yet**. There is no dashboard screen yet — only a
clickable design preview. `PROGRESS.md` has the details and what comes next.

## Run it locally

Needs Node.js 22.13 or newer. Nothing else: no database server, no accounts.

```bash
cd rewards-prototype
npm install
npm test                 # the whole suite; no network needed
npm run seed             # three sample members and a spread of sample data
npm run dev              # http://localhost:8787  (dev sign-in + sample platform data)
```

`npm run dev` prints a **sign-in code** in the terminal. Dev sign-in needs that code
plus one of the sample addresses (`admin@example.test`, `daryl@example.test`,
`leo@example.test`, `alex@example.test`).

`npm run seed -- --reset` wipes the local database and seeds it again. (The two npm
scripts set their settings with `NAME=value command`, which works on macOS and Linux.)

### Try it with curl

Until the screen exists, the API can be used directly (`docs/API.md` lists every route):

```bash
CODE=paste-the-code-from-the-terminal
ORIGIN='Origin: http://localhost:8787'
JSON='Content-Type: application/json'

# sign in as a sample member (the cookie is kept in ./jar)
curl -s -c jar -X POST -H "$ORIGIN" -H "$JSON" \
  -d "{\"email\":\"leo@example.test\",\"code\":\"$CODE\"}" http://localhost:8787/api/auth/dev-login

# the whole dashboard in one response: three members, leaderboard, videos, limits
curl -s -b jar http://localhost:8787/api/dashboard

# anything that changes data also needs the CSRF token from the session
curl -s -b jar http://localhost:8787/api/session        # -> { ..., "csrf_token": "…" }
```

## What "dev" and "mock" mean

| Setting | Meaning |
|---|---|
| `AUTH_MODE=dev` | Sign-in is simulated (terminal code). For local work only. |
| `AUTH_MODE=google` | Real Sign in with Google. Needs `GOOGLE_CLIENT_ID` and an https `APP_ORIGIN`. Not exercised against Google yet. |
| `PLATFORM_MODE=mock` | YouTube/TikTok checks and statistics are sample data, labelled *simulated* everywhere. |
| `PLATFORM_MODE=live` | Real platform APIs. **Not built yet**: every check answers "not connected". |

All settings are environment variables; `.env.example` lists them and `docs/API.md` §1
explains each, including the conditions under which the server refuses to start.
Never put a secret in a file that is committed.

## Where things are

| | |
|---|---|
| `src/db/schema.sql` | the data rules — twelve promises the database itself enforces |
| `src/domain/` | business rules (claims, ledger, caps, erasure, the dashboard read model) |
| `src/auth/`, `src/http/` | sign-in, sessions, request protection, routes |
| `src/platforms/` | what YouTube/TikTok can attest; mock adapters |
| `docs/API.md` | every route and the dashboard payload |
| `docs/PLATFORM_CAPABILITIES.md` | what the official APIs can and cannot verify, with evidence tiers |
| `docs/ARCHITECTURE.md` | how it fits together |
| `docs/UI_BRIEF.md` | the screen to build next |
| `DECISIONS.md` | placeholders awaiting approval; behaviour choices to confirm |
| `PROGRESS.md` | what is done, tested, blocked and next |

## Known limits

- No dashboard UI yet; `public/` serves a placeholder page.
- The HTTP layer and the seed are a draft checked by hand; they have no automated tests
  and have not been reviewed (see `PROGRESS.md`).
- Nine database-level findings from the attack suite are still open (see `PROGRESS.md`).
- Nothing has been run against live Google, YouTube or TikTok services.
- Linking a YouTube channel is not built (needs a Google Cloud project).
- Runs locally only; no hosting has been chosen.
- This folder sits in a public repository. Move it to a private one before adding real
  accounts, photos or credentials.
