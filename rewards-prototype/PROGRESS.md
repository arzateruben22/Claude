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
| Sign-in layer (`src/auth/`) | **In progress.** Work-in-progress modules and tests are committed so nothing is lost; they have not been reviewed and the author's report has not been read yet. |
| Raw-SQL attack suite against the schema (`test/db/`) | **In progress — not in the repository yet** |
| HTTP layer, config, server start-up, sample-data seed (`src/http/`, `src/app.js`, `src/server.js`, `scripts/seed.js`) | **Queued behind the sign-in layer — not started** |
| Adversarial review of sign-in + HTTP | **Not started** |
| Single-screen UI | **Design preview only.** `design-preview/crew-rewards-preview.html` is a clickable mock on sample data (published privately to the owner for review). It is not wired to the API and uses inline styles and scripts, which the real app's security policy forbids — treat it as the visual and interaction reference when building `public/` from `docs/UI_BRIEF.md`. |
| Live YouTube adapter, YouTube channel linking | **Not started** — needs a Google Cloud project |
| Second project (the separate marketplace product) | **Not started** — its source archive was not provided and its owner's authorisation is needed. Nothing of it is in this repository. |

## Tests

`npm test` → **171 tests: 170 passing, 0 failing, 1 marked to-do** (run 2026-11-10, Node 22). 85 of these are the reviewed core; the rest are the in-progress sign-in tests, not yet reviewed.

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
| A duplicate submission cannot double-credit | **Passing** at the business-logic level, including the case found in review (a link credited before its video was tracked, PE-01 below). Not yet proven over HTTP. |
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

## Third design review — what will be done with it

A third independent review (pragmatic-engineering lens) reported after the core was
built. Its findings, and the decision on each:

| # | Finding | Decision |
|---|---|---|
| PE-01 | **A video could be credited twice to one member**: the duplicate check keyed on the tracked-video id when the video was on the list and on the link otherwise, so submitting a link before the video was tracked and again afterwards gave two credits. | **Fixed.** Reproduced first (25 → 50 points), then closed: one subject per platform video, tracked or not (`video:<platform>:<platform id>`), enforced in the schema; a regression test replays the reproduction. Erasure rewrites that subject so an erased member's video id does not linger. |
| PE-02 | Sample data and real data are told apart by scanning for a few kinds of row; sample awards would pass the scan. | Accept. A database is `demo` or `live` for its whole life (one row, set at creation); simulated results and dev sign-in are only possible in a demo database. |
| PE-03 | The migration runner cannot apply a table rebuild, and a rebuild would silently drop guard triggers. | Accept, before any real data exists: `schema.sql` stays the complete current schema, migrations only upgrade old databases, and a test requires both routes to produce an identical schema. |
| PE-04 | A missing database file looks like a first start; backup is one sentence. | Accept: refuse to start on a missing database unless told to create one; add a backup command with retention; state the persistent-disk requirement. |
| PE-05 | The dashboard payload carries only the public slice; a member's own history lives in two other routes with different shapes; no place for avatar images. | Accept before the UI is built: one activity item shape for public and own history, a detail route, change detection, a signed-in-only image route. |
| PE-06 | "Nobody credits themselves" is a rule about accounts, not people. | Accept the wording; `DECISIONS.md` B3 already asks the owner who the admin is. Add a warning when exactly one admin exists. |
| PE-07 | A failed statistics refresh leaves no trace; JSON columns accept anything. | Accept: store the last refresh error next to the last good numbers; `json_valid` CHECKs. |
| PE-08 | The time zone that defines "month" and "day" can be edited at any moment; no row stores the local day. | Accept: the zone is fixed per database; claims store their local day. |
| PE-09 | "Verified" is reachable only through seeded rows; nothing stops two members linking one channel. | Accept: a simulated link flow in demo mode (same UI states the real Google consent will use), one member per channel, link source recorded. |
| PE-10 | Competitions have no rules about prizes. | Accept: one prize per member per competition, only once it is closed. Streaks and easter eggs are declared out of version 1 (cosmetic only, store nothing). |
| PE-11 | Five simplifications. | Accept three (drop the unused session column; refused sign-ins go to the process log, not the permanent audit table; stable codes on trigger messages). **Keep** comment matching (the owner wants likes and comments tracked; it stays informational) and the ranking setting. |
| PE-12 | Ids and random values are not injectable. | Defer. File-level tests it asks for already exist for erasure. |
| PE-13 | "Each promise is enforced by the database" overstates four of them. | Accept: the documents will say exactly which parts are application code. |
| PE-14 | "Exactly five tiers" can be expressed in the schema. | Accept the simple form: ship the five rows with the schema and forbid inserting or deleting tiers. |

## Next steps, in order

1. **Land the in-progress build.** When the sign-in, schema-attack and HTTP work
   arrives: read each author's report (deviations from `docs/API.md`, defects found,
   anything not done); run `npm test` and record the real totals here; start the server
   with the dev settings, seed it, sign in with the printed code and fetch
   `/api/dashboard` to see the three sample members. Fix or record every reported
   defect. Do not mark this done from a report alone.
2. **Apply the rest of the third review** in the order of the table above (PE-01 is done). Schema
   changes wait until the schema-attack suite has landed (it is being written against
   the current schema); each change updates schema, `integrity.js`, tests and docs together.
3. **Adversarially review sign-in and HTTP** before building on them: sessions, CSRF,
   cookies and nonce replay; a role check on every route; leaks of other members' data
   in any response, log line or error; idempotency and caps through the HTTP surface;
   start-up refusals. Require a reproduction for every finding.
4. **Build the single-screen UI** from `docs/UI_BRIEF.md` against `docs/API.md`, using
   `design-preview/crew-rewards-preview.html` as the visual reference and whatever the
   owner says about it, with the end-to-end, reduced-motion and page-weight tests listed
   in the brief. Produce screenshots at an iPhone viewport.
5. Fill in real run instructions and a curl walkthrough in `README.md` once step 1 is verified.
6. When a Google Cloud project exists: real sign-in end to end, the YouTube channel
   link, then a live YouTube adapter behind the existing adapter contract.
7. Second project: only after its archive and its owner's authorisation arrive. (A
   concept preview for it was made for the owner and deliberately kept out of this
   public repository.)
