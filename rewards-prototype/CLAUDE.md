# Working in rewards-prototype/

This folder is a self-contained project, separate from everything else in the
repository (the root `CLAUDE.md` is about a different project and does not apply here).

A private single-screen dashboard with **virtual points**, an append-only audited
ledger and honest verification states. Read `PROGRESS.md` first for where things stand
and what is next.

## Non-negotiable product rules

1. Points are virtual. No currency symbols, no money words, no payout, redemption,
   interest or "owed" language — in code, copy, seed data or tests.
2. Likes, comments, views, shares, follows and subscriptions may be *displayed* as
   statistics and can **never** earn points or XP. Do not add any route, field, task or
   UI affordance that rewards or counts them toward anything.
3. Never label something "verified" unless a platform adapter attested it. A person's
   approval is "manually reviewed". Simulated (mock) results are always labelled simulated.
4. Points, XP, tiers and rank come only from the ledger — never from platform numbers.
5. Never claim work is done until its tests have been run. Report real test totals.
6. Secrets live in environment variables. Never ask for one in chat, never commit one.
7. This repository is public: no real names beyond the three sample first names in the
   seed, no real e-mail addresses (`*.example.test` only), no photos, no credentials.

## Where the truth lives

| Topic | File |
|---|---|
| Data rules and the twelve promises | `src/db/schema.sql` |
| Every route, header, cookie, start-up rule; the dashboard payload | `docs/API.md` |
| What the platforms can and cannot attest (with evidence tiers) | `docs/PLATFORM_CAPABILITIES.md` |
| How it fits together | `docs/ARCHITECTURE.md` |
| The screen to build | `docs/UI_BRIEF.md` |
| Defaults awaiting the owner's approval; behaviour choices to confirm | `DECISIONS.md` |

If code and `docs/API.md` disagree, one of them has a bug — fix it; do not work around it.

## How to work here

- `npm test` runs everything (`node:test`, no network, fixed clock). Keep it green.
- Node ≥ 22.13, ES modules, plain JavaScript with JSDoc. The only runtime dependency is
  `jose`. Do not add dependencies or a build step without the owner's say-so.
- Business rules live in `src/domain/` and are backed by constraints and triggers in
  `schema.sql`. Route handlers stay thin and never re-implement or bypass a rule.
- Do not weaken, drop or route around a schema trigger or CHECK to make something work.
  If a rule is wrong, change the rule deliberately: schema, `integrity.js`, tests and
  docs together, and record it in `DECISIONS.md`.
- `schema.sql` is version 1. Once real data exists, never edit it: add
  `src/db/migrations/0002_<name>.sql`.
- No `INSERT OR REPLACE` / `REPLACE INTO` (the database adapter rejects them).
- The domain never reads `process.env`, never calls `Date.now()` directly (the clock is
  injected), and never logs or audit-logs evidence text, e-mail addresses, tokens or URLs.
- The front end must obey the Content-Security-Policy in `docs/API.md` §2: no inline
  scripts, no `style=""` attributes, no inline handlers, no third-party assets.
- Keep `PROGRESS.md` and `DECISIONS.md` current as part of the same change.
