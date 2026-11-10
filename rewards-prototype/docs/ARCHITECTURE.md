# Rewards prototype — architecture

How the prototype is put together and why. Three documents hold the detail and are
kept authoritative; this one is the map:

| For… | Read |
|---|---|
| the data contract and its twelve promises | `../src/db/schema.sql` |
| every route, header, cookie and start-up rule | `API.md` |
| what YouTube / TikTok / Google can and cannot attest | `PLATFORM_CAPABILITIES.md` |
| defaults that are waiting for the owner's approval | `../DECISIONS.md` |

## 1. What this is, and what it is not

A private, sign-in-gated, single-screen dashboard for a small group (three members to
start). Each member has an avatar, a piggy bank of **virtual points**, XP, one of five
evolution tiers, a rank and an activity history. An admin adds videos, reviews what
members submit, tunes the numbers, and can correct the ledger with a full audit trail.

Hard limits, enforced in code and schema rather than in copy:

| Limit | How it is enforced |
|---|---|
| Points are virtual. No cash value, no redemption, no payout. | No currency field, payout table or withdrawal path exists. `domain/policy.js` refuses money wording in any admin-entered name or reason. |
| No reward for likes, comments, views, shares, follows or subscriptions. | Only task types (contributions) can lead to a ledger entry. Engagement numbers exist only as informational statistics on `videos`; no table, column or code path links them to the ledger. `domain/policy.js` refuses task names, descriptions and reasons that describe engagement. |
| Points never derive from platform data. | The read model computes points, XP, tier and rank from the ledger alone; statistics travel in a separate field. |
| Never call something "verified" unless a platform attested it. | `verified` can only be written with an adapter source, on a task that has an automatic check, for evidence on that platform (schema CHECKs and trigger). A person's approval is `manually_reviewed`. |
| Never credit an unreviewed claim. | A claim becomes approved only by its ledger award being written, and that award is refused unless the claim is pending and reviewed (triggers). |
| Simulated checks are never passed off as real. | Mock adapters write `mock_adapter` as the source; the API reports `demo_mode`; the server refuses to start in live mode on a database holding simulated data. |

Out of scope: payments of any kind, automating engagement, scraping, unofficial APIs,
multi-tenant use.

## 2. Stack (placeholder, awaiting approval)

| Choice | Why |
|---|---|
| Node.js ≥ 22.13, ES modules, plain JavaScript | No build step; runs anywhere Node runs. |
| SQLite through the built-in `node:sqlite` | One file; real transactions, constraints and triggers; no database server. |
| `jose` — the only runtime dependency | Google's guidance is to verify ID tokens with a maintained library, not by hand. |
| `node:http` with a small router | About fifty routes; a framework would add more surface than it removes. |
| Static front end in `public/` (no bundler) | Fast first paint on a phone. Built in the UI phase against `API.md`. |
| `node:test` | Built in. |

`node:sqlite` is still flagged experimental in Node 22 (the npm scripts silence the
warning). Everything that touches it is in `src/db/sqlite.js`; swapping to
`better-sqlite3`, or porting the SQL to Postgres, is confined to that module and the
schema file.

The adapter opens every connection with `foreign_keys = ON`, `recursive_triggers = ON`,
`secure_delete = ON`, `journal_mode = DELETE` and `synchronous = FULL`, verifies them,
and refuses `REPLACE` statements. `journal_mode` is **not** WAL on purpose: with WAL the
pages of an erased member stay readable in the `-wal` file for as long as the server
runs.

## 3. Layout

```
rewards-prototype/
  src/
    config.js            environment -> validated config (the only reader of process.env)
    app.js  server.js    wiring and start-up order (API.md §1)
    db/
      schema.sql         THE data contract (read this first)
      sqlite.js          the only module that touches node:sqlite: open(), tx(), helpers
      migrate.js         schema.sql = version 1; migrations/000N_*.sql after that
      tombstones.js      erased member ids, replayed at boot against restored backups
    lib/                 errors, ids, clock, validation
    domain/              business rules over a db handle — no HTTP, no env, clock injected
      context.js         who is acting; requireAdmin / requireAdminUser / requireSelfOrAdmin
      policy.js          engagement and money wording lint
      settings.js  tiers.js  members.js  users.js  videos.js  taskTypes.js
      claims.js          submit / platform check / review / withdraw / revoke
      ledger.js  caps.js award / bonus / adjust / reverse; monthly cap and budget
      leaderboard.js     the dashboard read model; decides what members see of each other
      competitions.js    a time window over the ledger
      erasure.js         export and erasure
      audit.js           append-only audit trail
      integrity.js       asserts what the schema cannot
    auth/                Google ID-token verification, sessions, CSRF, nonces, rate limits, dev sign-in
    platforms/           adapter contract, capability matrix, mock adapters, registry
    http/                router, request protection, handlers, static files
  scripts/seed.js        three sample members and a spread of sample data (dev + mock only)
  public/                front end (a placeholder until the UI phase)
  test/                  db (raw-SQL attacks), domain, auth, platforms, http (acceptance)
  docs/
```

Dependency direction: `http → auth, domain, platforms → db, lib`. `domain` never imports
from `http` or reads the environment.

Every domain function takes a context `{ db, clock, actor, requestId }` first. The HTTP
layer builds `actor` from the session's account row on every request — never from the
URL or body. Domain functions enforce their own authorization, so a missing check in a
route handler cannot grant anything.

## 4. Data model

`schema.sql` is commented line by line. In brief:

- **members** (who appears on the dashboard) and **users** (who may sign in: an
  allowlist keyed by e-mail, then bound once to the Google `sub`). An admin need not be
  a member, and should not be — see §6.
- **videos** with informational aggregate statistics; **task_types**, the rewardable
  contributions.
- **claims** — "I did this task" — carrying two independent facts:
  `verification_status` (`unverified | manually_reviewed | verified`) and `decision`
  (`pending | approved | rejected | withdrawn | revoked`).
- **ledger_entries** — append-only; kinds `task_award | bonus | adjustment | reversal`;
  buckets `earned | bonus`. Balances are always computed, never stored.
- **tiers** (exactly five), **settings**, **competitions**, **sessions**, **audit_log**,
  and the single-row **erasure_guard**.

### The twelve promises

Each is enforced by the database except where its row says otherwise; application
checks otherwise exist only to give clearer messages. `test/db/schema.test.js` attacks
every one with raw SQL.

| # | Promise |
|---|---|
| P1 | An approved claim has exactly one ledger award, and becomes approved **only** by that award being written. |
| P2 | A duplicate submission can never be credited twice: one live claim per member + task + subject, exceptions only after a credit, by an admin, with a reason. A platform video is one subject whether it is picked from the tracked list or pasted as a link, before or after it is tracked. *Recognising a pasted link as a video is application code; the database then refuses a video link under any other kind of subject.* |
| P3 | No award without a reviewed or attested claim; the `earned` bucket grows only through such an award. |
| P4 | The ledger is append-only. |
| P5 | A correction can be undone once, mirrors its target and counts in its target's month; undoing an award revokes the claim. |
| P6 | Engagement has no path to points (structural). |
| P7 | Erasure really deletes, is all-or-nothing, and is the only way ledger rows or claims are deleted. |
| P8 | No account can approve the claims of, or write a positive entry for, the member it is attached to. *A rule about accounts, not people: it cannot stop one person who holds both an unattached admin account and a member account.* |
| P9 | There is always an admin who can sign in. |
| P10 | The audit trail cannot be rewritten and holds no addresses or links. *Reasons and evidence text are kept out by `domain/audit.js`, not by the database.* |
| P11 | No points bucket and no XP total goes below zero. |
| P12 | "Verified" means a platform attested it; a decided claim's evidence and verification never change. |

What constraints cannot express — claims and awards agreeing as a whole, every ledger
entry having its audit row, the guards themselves still being present and unmodified —
is asserted by `domain/integrity.js` at boot (the server refuses to serve otherwise),
after every erasure, and in the tests.

## 5. Flows

### 5.1 Sign-in

Specified in `API.md` §3. The essentials: Google ID token verified with `jose` (RS256,
audience, issuer, expiry, at most ten minutes old) and a server-side single-use nonce;
allowlist lookup by Google `sub`, or — on first sign-in only, and only when Google is
authoritative for the address — by e-mail; a random session token in an HttpOnly cookie
with only its hash stored; sessions tied to the sign-in mode that created them.

Dev sign-in exists so the prototype can run before a Google Cloud project does. It
needs a code printed in the terminal at start, locks after five wrong codes, and cannot
be used on a database that has ever seen a Google sign-in. A tunnel or reverse proxy in
front of the dev server therefore does not hand out accounts.

### 5.2 Claim lifecycle

```
submit ──> pending / unverified ──(adapter attests)──> pending / verified
              │                                            │
              ├─ withdraw ─> withdrawn                     ├─ reject ─> rejected
              ├─ reject ───> rejected                      │
              └─ approve: mark manually_reviewed,          └─ approve: write the award
                 write the award ──┐                                    │
                                   ▼                                    ▼
                       approved (by trigger, because the award exists)
                                   │
                                   └─ revoke = reverse the award ─> revoked (by trigger)
```

- **Submit.** Evidence rules depend on the task: written feedback must reach a minimum
  length; a task with an ownership check needs a video link. The subject is
  `video:<platform>:<platform video id>` for any YouTube or TikTok video — picked from
  the tracked list or pasted as a link, tracked or not — else the normalised form of
  another link, else the hash of the text. A second
  live claim for the same member + task + subject is refused with `409 duplicate_claim`,
  and the refused attempt is audit-logged. Points and XP are snapshotted from the task.
  A member's own submissions are limited per local day.
- **Platform check** (tasks with an automatic check only). Only a positive attestation
  sets `verified`. "Not attested", "unsupported", "not connected" and API failures all
  leave the claim `unverified`, with the reason stored and shown.
- **Approve.** One transaction: block self-review; mark `manually_reviewed` if not
  already attested; check the monthly cap and budget; write the award — which is what
  approves the claim. A cap refusal (`409 cap_exceeded`) rolls everything back.
  Approving an approved claim returns the existing entry and changes nothing.
- **Revoke.** Reverse the award; the claim becomes `revoked` by trigger. The member may
  submit again.
- **Exception.** After a credit, an admin may enter a further claim for the same subject
  with a reason; it takes the next exception number and is audit-logged.

### 5.3 Ledger rules

- **Bonus**: admin-granted, `bonus` bucket, needs a reason and an `Idempotency-Key`.
- **Adjustment**: may deduct from either bucket; may add only to `bonus`. Needs a reason
  and an `Idempotency-Key`.
- **Reversal**: the exact negative of one earlier entry, once; carries its target's month.
- **Caps**: every positive non-reversal entry counts toward the member's monthly cap and
  the overall monthly budget, in the entry's month (configured time zone, fixed at
  write time). Reversed entries stop counting. Over the limit → `409 cap_exceeded`,
  nothing written. Nothing is ever silently reduced.
- **Idempotency**: awards and reversals have keys the server derives from the row
  (`award:<claim>`, `reversal:<entry>`); client keys are stored as
  `req:<admin id>:<key>`. Same key and payload → the original entry; same key, different
  payload → `409 idempotency_conflict`.
- **Never negative**: an entry that would take a bucket or the XP total below zero is
  refused (`409 would_go_negative`), with the ids of earlier deductions that are in the way.
- Every entry records the admin account that wrote it and has its own audit row.

### 5.4 Export and erasure

`domain/erasure.js`. One transaction behind the erasure guard deletes the member's
ledger entries, claims, sign-in account and sessions, their videos (a video another
member's claim still points at becomes an anonymous archived placeholder, and that
claim's text — written about the erased member's video — is blanked), nulls the detail
of audit rows about them, and deletes the member. The guard can only be cleared once
the member is gone, so a partial erasure cannot commit. If the member is the only admin
who can sign in, the member data is erased and the account is kept, detached.

Afterwards the member id is appended to a tombstone file; at every start any tombstoned
id found in the database (a restored backup) is erased again. Backups should be made
with `VACUUM INTO`. Opaque random ids remain in the audit trail; they identify nobody.

## 6. Roles

Summarised here; the route-by-route version is `API.md` §4–§5.

| Capability | Signed-out | Member | Admin |
|---|---|---|---|
| Health check, sign-in | yes | yes | yes |
| Dashboard, public activity, videos, task types, capability matrix | no | yes | yes |
| Own claims, own ledger (with notes and reasons), own export and erasure | no | yes | yes |
| Other members' claims, ledger, evidence, notes, e-mail addresses | no | **no** | yes |
| Submit / withdraw a claim | no | own only | on behalf, audit-logged |
| Review, approve, reject, revoke | no | no | yes — never their own member's |
| Bonus, adjustment, reversal | no | no | yes — never a credit to their own member |
| Members, videos, task types, tiers, settings, competitions | no | read public fields | manage |
| Sign-in allowlist | no | no | manage — never their own role, status or member link |
| Audit log, integrity report | no | no | yes |

Because nobody may credit themselves, **an admin who is also a member cannot have their
own submissions approved by themselves**. Either the admin account is not attached to a
member (the default the seed uses), or there are two admins.

## 7. Platform adapters

`platforms/contract.js` defines one interface, mock or live:

```js
adapter.platform                       // 'youtube' | 'tiktok'
adapter.mode                           // 'mock' | 'live'
adapter.capabilities()                 // what the platform can attest, in plain words
await adapter.fetchVideoStats(id)      // { ok: true, stats, fetched_at, source } | { ok: false, error }
await adapter.checkVideoOwnership({ platformVideoId, memberChannelId })
await adapter.checkComment({ ... })    // informational only
await adapter.checkLike({ ... })       // always 'unsupported'
// check result: { outcome: 'attested' | 'not_attested' | 'unsupported' | 'not_configured' | 'unavailable', reason, evidence }
```

Adapters never throw for expected conditions; they return a result that says what
happened, and the UI shows it. Only `attested` can lead to `verified`.

The prototype ships **mock adapters** with deterministic sample data, including
deliberate failures (quota exhausted, video not found, platform outage, hidden like
count, an incomplete comment scan). In `live` mode, until real adapters exist, every
call answers `not_configured` — "not connected" — rather than guessing.

## 8. Testing

- `test/db` — raw-SQL attacks on every promise, with the application bypassed.
- `test/domain` — every rule, with a fixed clock and an in-memory database; the
  acceptance criteria are named `ACCEPTANCE:` tests.
- `test/auth` — tokens minted with a local key set: wrong audience, issuer, expiry, age,
  signature, algorithm confusion, nonce replay; sessions; CSRF; rate limits; dev sign-in.
- `test/platforms` — the adapter contract and the honesty of every result.
- `test/http` — the acceptance list end to end over real HTTP, request protection, and
  a role check on every admin route.
- UI, mobile-performance and reduced-motion tests come with the UI phase.
