# Progress

Last updated: 2026-11-10 (end of the first working session).

## Where things stand

| Area | State |
|---|---|
| Platform research (what YouTube / TikTok / Google sign-in can attest) | **Done**, with an evidence tier on every statement. Policy pages were seen only through search excerpts — see "Blockers". |
| Data rules (`src/db/schema.sql`, twelve database-enforced promises) | **Done and tested** |
| Business logic (`src/domain/`): claims, ledger, caps, accounts, erasure, dashboard read model, competitions, integrity self-check | **Done and tested** |
| Platform adapter contract, capability matrix, mock adapters | **Done and tested** |
| Docs: API contract, architecture, UI brief, decision log | **Done** |
| Sign-in layer (`src/auth/`) | **In progress — not in the repository yet, unverified** |
| Raw-SQL attack suite against the schema (`test/db/`) | **In progress — not in the repository yet** |
| HTTP layer, config, server start-up, sample-data seed (`src/http/`, `src/app.js`, `src/server.js`, `scripts/seed.js`) | **Queued behind the sign-in layer — not started** |
| Adversarial review of sign-in + HTTP | **Not started** |
| Single-screen UI | **Not started** (`docs/UI_BRIEF.md` is the spec) |
| Live YouTube adapter, YouTube channel linking | **Not started** — needs a Google Cloud project |
| Second project (the separate marketplace product) | **Not started** — its source archive was not provided and its owner's authorisation is needed. Nothing of it is in this repository. |

## Tests

`npm test` → **85 tests, 85 passing, 0 failing** (run 2026-11-10, Node 22).

Covered so far: ledger (awards, bonuses, idempotent adjustments, reversals, caps at
month boundaries, never-negative, nobody credits themselves), claims (the acceptance
criteria below), accounts and Google identity binding rules, videos and task types,
export and erasure (including a byte-level check of the database file and re-erasure of
a restored backup), the integrity self-check, the dashboard read model, competitions,
platform adapters, policy wording lint.

Handoff acceptance criteria:

| Criterion | State |
|---|---|
| Three sample accounts and avatars visible on one page | Data side done (`ACCEPTANCE` test on the dashboard payload). **The page itself does not exist yet.** |
| An approved task creates exactly one ledger entry and updates balance and leaderboard | **Passing** at the business-logic level; not yet proven over HTTP |
| A duplicate submission cannot double-credit | **Passing** at the business-logic level; not yet proven over HTTP |
| API failures and unsupported like attribution are shown honestly | **Passing** for the adapters and claim checks; UI not built |
| Admin adjustments are recorded and reversible | **Passing** |
| Auth, authorization, data deletion, privacy tests | Authorization, deletion and privacy **passing** at the business-logic level. **Sign-in and per-route tests are not written yet.** |
| Mobile performance tests | **Not started** (needs the UI) |

## Decisions

See `DECISIONS.md`. Section B lists behaviour choices that need the owner's yes or no
(most important: the admin account should not be one of the three members).

## Blockers and things only the owner can provide

1. A Google Cloud project / OAuth client id (for real sign-in and the YouTube link).
2. Authorised avatar photos; tier names, thresholds and art.
3. Hosting choice and budget.
4. The second project's source archive and its owner's go-ahead.
5. Optional: allow `developers.google.com`, `support.google.com`,
   `developers.tiktok.com` and `www.tiktok.com` in the build environment's network
   settings, so the tier-B statements in `docs/PLATFORM_CAPABILITIES.md` can be checked
   against the pages themselves.
6. This folder is in a public repository; move it to a private one before real
   accounts, photos or credentials are added.

## Next steps, in order

1. **Land the in-progress build.** When the sign-in, schema-attack and HTTP work
   arrives: read each author's report (deviations from `docs/API.md`, defects found,
   anything not done); run `npm test` and record the real totals here; start the server
   with the dev settings, seed it, sign in with the printed code and fetch
   `/api/dashboard` to see the three sample members. Fix or record every reported
   defect. Do not mark this done from a report alone.
2. **Read the third design review** (pragmatic-engineering lens; it had not reported
   when this was written) and act on anything that affects the API contract.
3. **Adversarially review sign-in and HTTP** before building on them: sessions, CSRF,
   cookies and nonce replay; a role check on every route; leaks of other members' data
   in any response, log line or error; idempotency and caps through the HTTP surface;
   start-up refusals. Require a reproduction for every finding.
4. **Build the single-screen UI** from `docs/UI_BRIEF.md` against `docs/API.md`, with
   the end-to-end, reduced-motion and page-weight tests listed there. Produce
   screenshots at an iPhone viewport.
5. Fill in real run instructions and a curl walkthrough in `README.md` once step 1 is verified.
6. When a Google Cloud project exists: real sign-in end to end, the YouTube channel
   link, then a live YouTube adapter behind the existing adapter contract.
7. Second project: only after its archive and its owner's authorisation arrive.
