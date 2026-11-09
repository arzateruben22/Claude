# Rewards prototype — architecture

Status: **design contract for the core build**. Anything marked *placeholder* is a
default chosen so the prototype can run; it is waiting for the owner's approval and is
recorded in `../DECISIONS.md`.

## 1. What this is, and what it is not

A private, sign-in-gated, single-screen dashboard for a small group (three members to
start). Each member has an avatar, a piggy bank of **virtual points**, XP, one of five
evolution tiers, a rank, and an activity history. An admin adds videos, reviews what
members submit, tunes the numbers, and can correct the ledger with a full audit trail.

Hard limits, enforced in code and schema, not just in copy:

| Limit | How it is enforced |
|---|---|
| Points are virtual. No cash value, no redemption, no payout. | There is no currency field, no payout table and no withdrawal path. UI copy never uses currency symbols. |
| No reward for likes, comments, views, shares, follows or subscriptions. | Only `task_types` (contributions) can lead to a ledger entry. Engagement numbers exist only as informational aggregate statistics on `videos`; there is no table, column or code path that links them to the ledger. `domain/policy.js` also rejects task keys/labels that describe engagement actions. |
| Never call something "verified" unless a platform API attested it. | `verified` can only be written together with an adapter source; `manually_reviewed` only with `admin_review` (schema CHECKs). |
| Never credit an unreviewed claim. | A claim cannot be `approved` while `unverified`, and a `task_award` ledger row cannot be inserted without a matching approved, reviewed claim (schema CHECK + trigger). |
| Simulated checks are never passed off as real. | Mock adapters write `verification_source = 'mock_adapter'`; the API reports `demo_mode: true`; the server refuses to start in live mode against a database that contains mock-verified claims. |

Out of scope for this prototype: payments of any kind, automating engagement, scraping,
unofficial APIs, multi-tenant use.

## 2. Stack (placeholder, awaiting approval)

| Choice | Why |
|---|---|
| Node.js ≥ 22.13, ES modules, plain JavaScript | Already available; no build step; runs anywhere. |
| SQLite through the built-in `node:sqlite` | One file, real transactions, constraints and triggers; no server to run. Wrapped in `src/db/sqlite.js` so swapping to `better-sqlite3` (or porting the SQL to Postgres/D1) touches one module. |
| `jose` for Google ID-token verification — the only runtime dependency | Google's guidance is to use a maintained JWT library rather than hand-rolled verification. |
| `node:http` with a small router | The API is ~35 routes; a framework would add more surface than it removes. |
| Static front end in `public/` (HTML + CSS + ES modules, no bundler) | Fast first paint on a phone; nothing to compile. The premium UI is built against the JSON API. |
| `node:test` | Built in; fast; no test-framework dependency. |

Why not Next.js + Postgres (what the separate marketplace project reportedly uses): it
would need a database server for every local run and a platform decision that has not
been approved yet. The two products must stay separate anyway; only patterns are shared.

`node:sqlite` is still flagged experimental in Node 22 (it prints a warning unless
`--disable-warning=ExperimentalWarning` is passed, which the npm scripts do). Everything
that touches it is confined to `src/db/sqlite.js`.

## 3. Layout

```
rewards-prototype/
  src/
    config.js            env parsing + boot-time safety checks
    server.js            wiring: config -> db -> services -> http
    db/
      schema.sql         THE data contract (read this first)
      sqlite.js          open(), tx(), prepared-statement helpers
      migrate.js         applies schema.sql / numbered migrations
    lib/                 errors, ids, clock, validation helpers
    domain/              pure business rules over a db handle (no HTTP, no env)
      policy.js          engagement denylist, copy rules
      settings.js  tiers.js  members.js  users.js  videos.js  taskTypes.js
      claims.js          submit / verify / review / withdraw
      ledger.js          award / bonus / adjust / reverse / balances
      caps.js            monthly cap + budget arithmetic
      leaderboard.js     dashboard read model
      competitions.js
      audit.js
      erasure.js         export + delete of a member's data
    auth/
      googleIdToken.js   ID-token verification (jose)
      sessions.js  csrf.js  authorize.js  rateLimit.js  devLogin.js
    platforms/
      contract.js        adapter interface + result types
      capabilities.js    what each platform can attest (from docs/PLATFORM_CAPABILITIES.md)
      mockYoutube.js  mockTiktok.js  registry.js
    http/
      router.js  security.js  static.js  handlers/*.js
  scripts/seed.js        three sample members + demo data
  public/                front end (placeholder until the UI phase)
  test/                  domain, auth, platforms, http (acceptance)
  docs/                  this file, API.md, PLATFORM_CAPABILITIES.md, UI_BRIEF.md
```

Dependency direction: `http -> auth, domain, platforms -> db, lib`. `domain` never
imports from `http` or reads `process.env`; time and ids are injected so tests are
deterministic.

## 4. Data model

`src/db/schema.sql` is the source of truth and is commented line by line. Summary:

- **members** — who appears on the dashboard. **users** — who may sign in (allowlist by
  e-mail, then bound to the Google `sub`). An admin need not be a member.
- **videos** — tracked YouTube/TikTok videos with *informational* aggregate stats.
- **task_types** — rewardable contribution types with configurable points and XP.
- **claims** — "I did this task", with `verification_status`
  (`unverified | manually_reviewed | verified`) and, independently, `decision`
  (`pending | approved | rejected | withdrawn | revoked`).
- **ledger_entries** — append-only; `task_award | bonus | adjustment | reversal`;
  buckets `earned | bonus`. Balances are always computed, never stored.
- **tiers** (exactly five), **settings**, **competitions**, **audit_log**, **sessions**.

### Promises and where they are enforced

| # | Promise | Enforcement |
|---|---|---|
| P1 | One approved claim → exactly one ledger entry | unique index `ledger_one_award_per_claim`; approval and award share one transaction |
| P2 | A duplicate submission can never be credited twice | partial unique index `claims_one_live_per_subject` on member + task + subject (+ exception number) for pending/approved claims |
| P3 | Nothing is credited unless reviewed or API-attested | claims CHECK + trigger `ledger_award_requires_reviewed_claim` |
| P4 | The ledger is append-only | triggers `ledger_no_update`, `ledger_no_delete` |
| P5 | A correction can be undone once and mirrors its target | unique index `ledger_one_reversal_per_entry`, trigger `ledger_reversal_must_mirror` |
| P6 | Engagement has no path to points | no linking table/column exists; policy denylist on task types |
| P7 | Erasure really deletes, and is the only delete | `erasure_guard` row checked by the delete/update triggers |

## 5. Flows

### 5.1 Sign-in

1. `GET /api/auth/config` returns the auth mode, the Google client id (if configured)
   and a one-time nonce (also set in a short-lived HttpOnly cookie).
2. The page renders the Sign in with Google button with that nonce. Google returns an ID
   token to the page's callback, which posts it to `POST /api/auth/google`.
3. The server verifies the token with `jose` against Google's published keys: RS256
   only, `aud` = our client id, `iss` ∈ {`accounts.google.com`,
   `https://accounts.google.com`}, not expired, `nonce` equals the cookie nonce,
   `email_verified` true.
4. Lookup by `sub`. If none, lookup an allowlisted user by e-mail **with no `sub` yet**
   and bind it (first sign-in). Otherwise deny with a generic message; denials are
   audit-logged without the e-mail address.
5. A random 256-bit session token is set in an HttpOnly, SameSite=Lax cookie
   (`__Host-sid`, Secure, in production). Only its SHA-256 is stored.

Dev mode (`AUTH_MODE=dev`): `POST /api/auth/dev-login {email}` signs in an allowlisted
user without Google. The server refuses to start in dev mode unless it is bound to a
loopback address and `NODE_ENV` is not `production`. The API reports `auth_mode: "dev"`
so the UI can show that sign-in is simulated.

### 5.2 Request protection

- State-changing requests must carry `X-CSRF-Token` equal to the session's token (issued
  by `GET /api/session`) **and** an `Origin` header matching the configured origin.
- JSON bodies only, 64 KB limit, `Content-Type: application/json` required.
- Headers on every response: a strict Content-Security-Policy that allows Google's
  sign-in script and frames and nothing else third-party, `X-Content-Type-Options`,
  `Referrer-Policy`, `frame-ancestors 'none'`,
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` (needed by the Google popup),
  HSTS in production, `Cache-Control: no-store` on `/api/*`.
- In-memory rate limits: sign-in attempts per IP, claim submissions per user.

### 5.3 Claim lifecycle

```
submit ──> pending/unverified ──(adapter attests)──> pending/verified
              │                                          │
              ├─ withdraw (own, pending) ─> withdrawn     │
              ├─ reject ─> rejected                       ├─ reject ─> rejected
              └─ approve ─> approved/manually_reviewed    └─ approve ─> approved/verified
                                   │                                 │
                                   └──────── revoke (reverses the award) ─> revoked
```

- **Submit** (member for self, or admin on behalf): validates the task type is active,
  evidence meets the task's rules (for example a minimum length for written feedback),
  the daily submission limit, and computes `subject_key`. A second live claim for the
  same member + task + subject is rejected with `409 duplicate_claim` and audit-logged —
  nothing is created. Points/XP are snapshotted from the task type.
- **Exception**: an admin may submit on a member's behalf with an `exception_reason`,
  which takes the next `exception_seq` and is audit-logged. This is the only way a member
  can be credited twice for the same subject.
- **Adapter check** (only for task types with `api_check <> 'none'`): the adapter's
  answer is stored in `verification_detail`. Only a positive attestation sets
  `verified`; "unsupported", "not configured", "not found" and API failures all leave
  the claim `unverified` with the reason shown to the admin.
- **Approve**: in one `BEGIN IMMEDIATE` transaction — re-read the claim (must be
  `pending`), block self-review (an admin linked to the claim's member cannot decide
  it), check the monthly cap and budget, mark the claim reviewed and approved, insert the
  `task_award`, write the audit row. Approving an already-approved claim returns the
  existing entry with `already_applied: true` and changes nothing.
- **Caps**: if the award would exceed the member's monthly cap or the monthly budget,
  approval fails with `409 cap_exceeded` (details included) and the claim stays pending.
  Nothing is silently reduced. Caps count positive `task_award` and `bonus` points in
  the entry's `period`, net of reversals of those entries.
- **Revoke**: reverses the award entry and marks the claim `revoked` in one transaction.

### 5.4 Admin adjustments and reversals

- `adjustment`: signed points and/or XP with a required reason and a required
  `Idempotency-Key`. Replaying the same key with the same payload returns the original
  entry; the same key with a different payload is `409 idempotency_conflict`.
- `reversal`: inserts the exact negative of one earlier entry; an entry can be reversed
  once; a reversal cannot itself be reversed (make a new adjustment instead).
- Neither may take a member's total points or total XP below zero
  (`409 would_go_negative`).
- Every adjustment and reversal writes an audit row in the same transaction.

### 5.5 Reading the dashboard

`GET /api/dashboard` returns one payload for the whole screen: for each active member —
display name, avatar key, XP, tier (level, name, progress to next), points
(`earned`, `bonus`, `pending`, `total`), rank, and recent activity — plus the leaderboard,
the five tiers, the current period's cap usage, `demo_mode`, `auth_mode` and the
platform capability summary. Ranking: total points descending, then XP, with standard
competition ranking for ties (1, 1, 3).

Members can see each other's totals and activity titles. Evidence text and URLs are
visible only to the claim's own member and to admins.

### 5.6 Export and erasure

- `GET /api/me/export` — everything stored about the signed-in member, as JSON.
- `DELETE /api/me` (with typed confirmation) and `DELETE /api/admin/members/:id` — one
  transaction that sets the erasure guard, deletes the member's ledger entries, claims,
  sessions and user account, nulls `detail` on audit rows about them, deletes the member
  row, clears the guard, and writes a `member.erase` audit row containing only counts.
  The last remaining admin account cannot be erased.

## 6. Authorization matrix

| Capability | Signed-out | Member | Admin |
|---|---|---|---|
| Health check, auth config, sign-in | yes | yes | yes |
| Dashboard, leaderboard, videos, task types, capabilities | no | yes | yes |
| Submit / withdraw a claim | no | own only | on behalf, with audit |
| See claim evidence | no | own only | yes |
| Review, approve, reject, revoke claims | no | no | yes (never their own member's) |
| Adjust / reverse ledger, grant bonus | no | no | yes |
| Members, users, videos, task types, tiers, settings, competitions | no | read-only where shown | manage |
| Audit log | no | no | yes |
| Export / erase own data | no | yes | yes (and any member's) |

Authorization is decided on the server from the session's user row on every request;
ids in the URL or body are never trusted to imply ownership.

## 7. Platform adapters

`platforms/contract.js` defines one interface for every platform:

```js
adapter.platform                       // 'youtube' | 'tiktok'
adapter.mode                           // 'mock' | 'live'
adapter.capabilities()                 // see docs/PLATFORM_CAPABILITIES.md
await adapter.fetchVideoStats(id)      // -> { ok: true, stats } | { ok: false, error }
await adapter.checkVideoOwnership({ platformVideoId, memberChannelId })
                                       // -> { outcome: 'attested' | 'not_attested' | 'unsupported'
                                       //              | 'not_configured' | 'unavailable', reason, evidence }
```

Adapters never throw for expected conditions. `error.code` is one of `not_configured`,
`not_found`, `quota_exceeded`, `forbidden`, `unavailable`, `unsupported`; each carries a
human-readable message and `retryable`. Only `outcome: 'attested'` may ever lead to
`verified`.

The prototype ships **mock adapters** with deterministic sample data, including
deliberate failure cases (quota exhausted, video not found, unsupported like
attribution) so the UI's honest-failure states can be built and tested. Live adapters
are a later task and need credentials; what they will and will not be able to do is
recorded, with sources, in `docs/PLATFORM_CAPABILITIES.md`.

## 8. Configuration

All configuration is by environment variable (`.env.example` lists them). Secrets are
never committed and never requested in chat.

| Variable | Meaning | Default |
|---|---|---|
| `PORT`, `HOST` | listen address | `8787`, `127.0.0.1` |
| `DATABASE_PATH` | SQLite file | `./data/rewards.db` |
| `APP_ORIGIN` | exact origin allowed for state-changing requests | `http://localhost:8787` |
| `AUTH_MODE` | `google` or `dev` | `dev` |
| `GOOGLE_CLIENT_ID` | OAuth client id for Sign in with Google | none |
| `ADMIN_EMAILS` | comma-separated allowlist bootstrapped as admins | none |
| `PLATFORM_MODE` | `mock` or `live` | `mock` |
| `SESSION_TTL_HOURS` | session lifetime | `168` |

Boot-time refusals: dev auth on a non-loopback host or in production; `google` auth
without a client id; live platform mode against a database holding mock-verified claims;
production without HTTPS origin.

## 9. Testing strategy

- **Schema tests**: every promise in section 4 is attacked directly with raw SQL.
- **Domain tests**: claim lifecycle, duplicate handling, caps at month boundaries in the
  configured time zone, idempotent approval and adjustment, reversals, erasure, export,
  policy denylist, tiers and ranking with ties.
- **Auth tests**: ID tokens minted with a local key set — wrong audience, wrong issuer,
  expired, bad signature, `alg` confusion, unknown key id, nonce mismatch, unverified
  e-mail, unknown user, disabled user; session expiry; CSRF and Origin enforcement.
- **HTTP acceptance tests**: the handoff's acceptance list end to end through real HTTP
  requests, including role checks on every admin route.
- UI, mobile-performance and reduced-motion tests come with the UI phase.
