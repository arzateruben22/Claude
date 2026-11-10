# Progress

Last updated: 2026-11-10. **Work is paused here at the owner's request.** Everything
below is the state to resume from.

## Where things stand

| Area | State |
|---|---|
| Platform research (what YouTube / TikTok / Google sign-in can attest) | **Done**, with an evidence tier on every statement. Policy pages were seen only through search excerpts — see "Blockers". |
| Data rules (`src/db/schema.sql`, twelve database-enforced promises) | **Done and tested**, then attacked directly with raw SQL (below). |
| Business logic (`src/domain/`): claims, ledger, caps, accounts, erasure, dashboard read model, competitions, integrity self-check | **Done and tested** |
| Platform adapter contract, capability matrix, mock adapters | **Done and tested** |
| Sign-in layer (`src/auth/`) | **Built and tested (92 tests), not independently reviewed, never run against Google.** Its author reported full line and branch coverage and 56 of 57 hand-made mutations caught. |
| Raw-SQL attack suite (`test/db/`) | **Done.** 1,212 attacks on the promises with the application bypassed. It found 27 problems: 17 are fixed, 1 was reclassified as the application's job (and is tested there), **9 remain open** (listed below). |
| HTTP layer, config, start-up, sample-data seed (`src/app.js`, `src/server.js`, `src/config.js`, `src/http/`, `scripts/seed.js`) | **Draft: runs, checked by hand only, NO automated tests, not reviewed.** The build that was writing it was cut off by a restart before it wrote any tests or a report. See "The HTTP draft". |
| Single-screen UI | **Design preview only.** `design-preview/crew-rewards-preview.html` is a clickable mock on sample data (published privately to the owner). It is not wired to the API and uses inline styles and scripts, which the real app's security policy forbids — it is the visual and interaction reference for building `public/` from `docs/UI_BRIEF.md`. `public/` holds a placeholder page. |
| Live YouTube adapter, YouTube channel linking | **Not started** — needs a Google Cloud project |
| Second project (the separate marketplace product) | **Not started** — its source archive was not provided and its owner's authorisation is needed. Nothing of it is in this repository; a concept preview was made for the owner and deliberately kept out. |

## Tests

`npm test` → **1,391 tests: 1,382 passing, 0 failing, 9 marked to-do** (run 2026-11-10,
Node 22). The 9 to-do tests are the open findings listed below; each is a test that will
pass once its finding is fixed.

| Suite | Tests | Covers |
|---|---|---|
| `test/db` | 1,212 | every promise attacked with raw SQL, under several connection settings |
| `test/domain` | 76 | ledger, caps, claims lifecycle, accounts and Google identity rules, videos, task types, erasure (including a byte-level check of the database file and re-erasure of a restored backup), integrity self-check, dashboard read model, competitions, policy wording |
| `test/auth` | 92 | ID-token verification with locally minted tokens, sessions, CSRF, nonces, rate limits, dev sign-in, cookies |
| `test/platforms` | 11 | adapter contract and the honesty of every result |
| `test/http` | **0** | nothing yet — see below |

Handoff acceptance criteria:

| Criterion | State |
|---|---|
| Three sample accounts and avatars visible on one page | The data arrives in one `GET /api/dashboard` response (tested in the business logic; seen by hand over HTTP). **The page itself does not exist yet** — only the clickable preview. |
| An approved task creates exactly one ledger entry and updates balance and leaderboard | **Passing** in automated tests of the business logic and at the database level. Over HTTP: seen by hand, not automated. |
| A duplicate submission cannot double-credit | **Passing**, including the case found in review (a link credited before its video was tracked) and resetting an approved claim with raw SQL. Over HTTP: seen by hand, not automated. |
| API failures and unsupported like attribution are shown honestly | **Passing** for the adapters, claim checks and the dashboard payload; the screen is not built. |
| Admin adjustments are recorded and reversible | **Passing** |
| Auth, authorization, data deletion, privacy tests | **Passing** for sign-in modules, business-logic authorization, deletion and privacy. **No per-route tests exist yet.** |
| Mobile performance tests | **Not started** (needs the UI) |

## The HTTP draft

It was written by a build step that was interrupted. What is known about it:

- `npm run seed` then `npm run dev` work. The seed creates the three sample members
  (totals 45 / 40 / 25), four sign-in accounts, sample videos and a spread of
  submissions, and finishes with a clean integrity check.
- Checked by hand with curl on 2026-11-10: health check; `401` when signed out; wrong dev
  code refused; a request with no `Origin` refused; dev sign-in; `GET /api/session`
  returns a CSRF token; `GET /api/dashboard` shows the three members, `demo_mode: true`
  and like attribution as unsupported; the security headers are present; a member gets
  `403` on an admin route; a path-traversal request gets `404`; a submission without a
  CSRF token is refused; a submission is created; its duplicate gets `409`; a member
  cannot approve; the admin's approval writes one entry and a repeat approval reports
  `already_applied`; the leaderboard changes; `GET /api/admin/integrity` is clean; the
  request log holds no bodies or addresses.
- **Not known:** everything else. No route has an automated test. The Google sign-in
  route, erasure over HTTP, the start-up refusals, rate limiting, body-size limits and
  most admin routes have not been exercised at all. Treat it as a head start, not as
  finished work.

## Open findings from the attack suite

All nine need direct access to the database file; none was found to be reachable through
the application. Each is a to-do test in `test/db/schema.test.js`.

1. A ledger row written with id `-1` makes every later insert fail (the no-replace guard
   reads an auto-assigned id as `-1`). Same for the audit table.
2. A ledger row written with the largest possible id exhausts the id space.
3. Audit columns other than `detail` accept an address or a link.
4. An address or link hidden behind a JSON escape (`@`) passes the audit check.
5. Timestamps with hour `24` pass the format check.
6. `videos.stats_fetched_at` has no format check, although the 30-day clean-up compares it as text.
7. With CHECK constraints switched off *and* `recursive_triggers` off, `REPLACE` can still rewrite a reversal.
8. The database adapter's `exec()` does not screen `REPLACE` statements (the application only uses it for the schema and pragmas).

## Decisions

See `DECISIONS.md`. Section B lists behaviour choices that need the owner's yes or no
(most important: who the admin is — the admin account should not be one of the three members).

Three defaults came out of the sign-in build and are the owner's to confirm:

- Google sign-in tokens are accepted with **no clock tolerance**: a server clock running
  behind Google's would refuse fresh tokens. A few seconds of leeway is a one-line change.
- A wrong dev sign-in code and an unknown address get the same `401`; after five wrong
  codes dev sign-in locks until restart, and a successful sign-in does not reset the count.
- Sign-in rate limiting uses a fixed one-minute window per client.

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

## Third design review

A third independent review (pragmatic-engineering lens) reported after the core was
built. Its findings, and where each stands:

| # | Finding | Status |
|---|---|---|
| PE-01 | **A video could be credited twice to one member**: submitting a link before the video was put on the tracked list and again afterwards gave two credits. | **Fixed.** Reproduced first (25 → 50 points), then closed: one subject per platform video, tracked or not, enforced in the schema; a regression test replays the reproduction. Erasure rewrites that subject so an erased member's video id does not linger. |
| PE-02 | Sample data and real data are told apart by scanning for a few kinds of row; sample awards would pass the scan. | Open. Plan: a database is `demo` or `live` for its whole life; simulated results and dev sign-in only in a demo database. |
| PE-03 | The migration runner cannot apply a table rebuild, and a rebuild would silently drop guard triggers. | Open — **do before any real data exists.** |
| PE-04 | A missing database file looks like a first start; backup is one sentence. | Open. |
| PE-05 | The dashboard payload carries only the public slice; a member's own history lives in two other routes with different shapes; no place for avatar images. | Open — **do before the UI is built.** |
| PE-06 | "Nobody credits themselves" is a rule about accounts, not people. | Wording fixed in the docs; the owner question is in `DECISIONS.md` B3. A warning when exactly one admin exists is still to add. |
| PE-07 | A failed statistics refresh leaves no trace; JSON columns accept anything. | Open. |
| PE-08 | The time zone that defines "month" and "day" can be edited at any moment; no row stores the local day. | Open. |
| PE-09 | "Verified" is reachable only through seeded rows; two members could link one channel. | Half done: one channel per member is now enforced. The simulated link flow and recording the link's source are open. |
| PE-10 | Competitions have no rules about prizes. | Open. |
| PE-11 | Five simplifications. | Open. Plan: accept three (drop the unused session column; refused sign-ins go to the process log, not the permanent audit table; stable codes on trigger messages); keep comment matching and the ranking setting. |
| PE-12 | Ids and random values are not injectable. | Deferred. |
| PE-13 | "Each promise is enforced by the database" overstated four of them. | Fixed in the docs: they now say which parts are application code. |
| PE-14 | "Exactly five tiers" can be expressed in the schema. | Half done: deleting a tier is refused. Shipping the five rows with the schema is open. |

## When work resumes, in this order

1. **Give the HTTP draft its tests and a review** before building on it: the acceptance
   list end to end over real HTTP (`docs/API.md` and the brief it was built from say
   which), a role check generated for every admin route, request protection, start-up
   refusals, sign-in over HTTP, erasure over HTTP, the seed. Then an adversarial review of
   sign-in and HTTP together: sessions, CSRF, cookies, nonce replay; leaks of other
   members' data in any response, log line or error. Require a reproduction for every finding.
2. **Apply the rest of the third review**, PE-05 and PE-03 first; each change updates
   schema, `integrity.js`, tests and docs together.
3. **Close the nine open attack-suite findings** (turn each to-do test into a passing one).
4. **Build the single-screen UI** from `docs/UI_BRIEF.md` against `docs/API.md`, using
   `design-preview/crew-rewards-preview.html` as the visual reference and whatever the
   owner said about it, with the end-to-end, reduced-motion and page-weight tests listed
   in the brief. Produce screenshots at an iPhone viewport.
5. When a Google Cloud project exists: real sign-in end to end, the YouTube channel
   link, then a live YouTube adapter behind the existing adapter contract.
6. Second project: only after its archive and its owner's authorisation arrive.
