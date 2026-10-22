# CareerQuest — Project Progress Log

This file is the hand-off record for future sessions. Keep it current: what works, what is stubbed,
what is blocked on external dependencies, and the exact next step.

## Environment facts (verified 2026-10-21)
- Node 22, npm 10. Next.js 16.4 (App Router, Turbopack, `cacheComponents` **disabled** on purpose — every
  authenticated page is dynamic). React 19.3. Tailwind 4 (tokens in `src/app/globals.css`).
- Prisma 7.10 with the `prisma-client` generator → `src/generated/prisma` (git-ignored; `npm install` regenerates).
  Driver adapter `@prisma/adapter-pg`. Config in `prisma.config.ts`, URL from `.env`.
- PostgreSQL 16. Local dev cluster script: `scripts/dev-db.sh` (data dir `/var/lib/postgresql/careerquest-dev`).
  Databases: `careerquest` (dev) and `careerquest_test` (vitest/playwright, `.env.test`).
- Auth is first-party: bcrypt (cost 12) + DB-backed sessions (`Session` table, sha256 of an opaque cookie token,
  30-day sliding). `src/proxy.ts` gates app routes by cookie presence; `requireUser()` validates.
- Server clock is UTC; users default to `America/Los_Angeles`. Anything written to a `@db.Date` column must be
  derived with `todayInTz(profile.timezone)` (see `src/lib/dates.ts`), never `new Date()`.

## Phase status
| Phase | Status | Notes |
|-------|--------|-------|
| 1 Foundation | **complete** (2026-10-21) | schema, auth, shell, UI primitives, tracker, dashboard, goals, analytics, settings; acceptance e2e green |
| 2 Email intelligence | pending | |
| 3 Chrome extension | pending | |
| 4 Game systems | pending | hooks in `src/lib/game/{missions,achievements}.ts` are no-op stubs until Phase 4 |
| 5 Academy | pending | research facts in scratchpad → to be seeded in `prisma/seed.ts`; lesson JSON drafts in `data/academy/lessons/` |
| 6 AI + analytics | pending | |
| 7 Mobile/polish | pending | |

## Phase 1 — what works
**Routes (all authenticated, all dynamic):**
- `/dashboard` Command Center: campaign eyebrow ("Day N of L · Phase P"), welcome card until onboarding is done,
  Today / This week / Total submitted / Interview rate tiles, next-best-action, campaign timeline, 14-day chart
  (Recharts), pipeline funnel, follow-ups due, upcoming interviews, XP/level + streak, missions placeholder
  (honest "arrives in a later phase"), recent activity.
- `/dashboard/goals` Numbers game: pace math, milestone ladder, data-threshold-gated suggestions, live calculator
  with "Save as my targets".
- `/applications` list (search, status chips with counts, source/category/sort/archived filters, pagination,
  desktop table + mobile cards, quick status select), `/applications/new`, `/applications/[id]` (stage change
  with note + date, follow-ups, interviews + outcomes, notes, merged timeline with source + Verified badges,
  details, offers, archive/restore/delete), `/applications/[id]/edit`.
- `/analytics`: GET filter form (range presets, status/source/category/employer/salary/location/archived),
  observed tiles with n + Wilson 95% intervals and a "Low sample" badge under n < 10, daily/weekly activity,
  funnel, sources donut, conversion by source/category/résumé version, status distribution, follow-up workload,
  `GET /api/export/applications` CSV export carrying the same filters (401 JSON when signed out).
- `/settings` (Profile & goals), `/settings/campaign` (targets + restart), `/settings/eligibility`,
  `/settings/appearance` (Classic / Cyber / Ultra + reduced motion), `/settings/account` (password, sessions,
  JSON export via `GET /api/account/export`, delete account), `/settings/tokens` (developer API tokens),
  `/settings/onboarding` (3-step wizard, +50 XP once).
- Later-phase routes `/missions /discovery /career-map /academy /skills /coach /salary /integrations` are honest
  placeholders ("Module under construction … no demo data is shown").

**Services / contracts in place:** `src/lib/applications/service.ts` is the only entry point for application
lifecycle changes (status history + `recordApplicationEvent` in one transaction, idempotent XP via dedupe keys);
`src/lib/profile/service.ts` owns profile/campaign/onboarding; `src/lib/account/*` owns sessions, password,
export, delete; `src/lib/dashboard/queries.ts`, `src/lib/goals/calculator.ts`, `src/lib/analytics/*` are
read-only and userId-scoped.

**Tests (all green on 2026-10-21):**
- `npx tsc --noEmit` → 0 errors; `npx eslint src tests` → 0 problems; `npm run build` → 28 routes compiled.
- `npx vitest run` → 17 files / 215 tests (pure logic + DB-backed suites against `careerquest_test`; each DB
  suite creates and cascade-deletes its own user).
- `npx playwright test` → `tests/e2e/auth.spec.ts` (2 tests) and `tests/e2e/phase1-acceptance.spec.ts`
  (2 tests: full register → onboarding → log SUBMITTED application → SCREENING with note → list → dashboard
  → analytics → sign out/in flow with XP assertions 0 → 50 → 75 → 75; plus a route walk of every shell route,
  both API exports and the placeholders) on both `desktop-chromium` and `iphone` projects. Run `npm run build`
  first; the config starts `next start -p 3100` with `.env.test`.

**Integration fixes applied during the Phase 1 merge:**
- `registerAction` dated `CampaignState.startedAt` with `new Date()` (a `@db.Date` column) → after 17:00 PT the
  campaign started "tomorrow". Now uses `todayInTz("America/Los_Angeles")` and `targetEndAt = start + 90`.
- Onboarding wizard: the "Next" and "Finish setup" buttons shared one React slot, so Chrome submitted the form
  when step 2's Next flipped `type="button"` → `"submit"` mid-click (skipping step 3). Fixed with distinct keys.
- Top bar now shows total XP at every width (`data-testid="topbar-xp"`); streak stays `sm:`-only.
- Welcome card "Finish setup" links to `/settings/onboarding`; funnel stages and the detail status badge carry
  `data-testid`s; shared `Dialog` uses `useId()` for its title id.

## Contracts every module must respect
- Applications never mutate status directly: use the applications service (Phase 1 module) which writes
  `ApplicationStatusHistory` and calls `recordApplicationEvent` (`src/lib/events/record-event.ts`).
- XP is only awarded through `awardXp` with a stable `dedupeKey`; the ledger's unique constraint makes repeats no-ops.
- Inferred status changes (email/extension/import) go through `canApplyInferredStatus` in
  `src/lib/applications/status.ts` and never downgrade or override user-confirmed data.
- Every query is scoped by `userId` from `requireUser()`/`authenticateBearer()`.

## Known shared-code issues (not blocking, fix before Phase 2 writers rely on them)
- `record-event.ts` / `xp.ts` dedupe by catching P2002, which aborts a Postgres interactive transaction (25P02).
  `src/lib/applications/events.ts` (`recordEventOnce` / `awardXpOnce`) pre-checks dedupe keys instead; Phase 2/3
  writers (email re-sync, extension retries, CSV import) must use those wrappers or the shared helpers must switch
  to a `findUnique` pre-check.
- `record-event.ts` keys XP as `xp:${applicationId}:${reason}`, so repeatable actions (follow-ups, interviews)
  never re-award; the applications service tops up with per-day / per-interview keys. Prefer fixing the shared key
  scheme in Phase 4 and deleting the top-up code.
- `src/lib/dates.ts` `dateKey/addUtcDays/daysBetween` use local-time date-fns math; dashboard/goals use exact UTC
  helpers in `src/lib/goals/days.ts`. Switch the shared helpers to UTC math and re-point callers.
- `server-only` throws under vitest; DB-backed suites `vi.mock("server-only", () => ({}))`.
- In-memory rate limiter is per-process (documented in `@/lib/rate-limit`).
- Salary filters in analytics compare raw amounts regardless of HOURLY vs ANNUAL (stated on the page).

## External dependencies (not live, honest fallbacks provided)
- Gmail/Outlook OAuth: need `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` → otherwise EML/MBOX/CSV/paste import.
- Anthropic API key for the LLM coach → otherwise rules-based coach (always available).
- Web push VAPID keys → otherwise in-app notifications only.

## Next exact step
Phase 2 — Email intelligence: build the classification engine against the labeled fixture corpus
(`tests/fixtures/emails/`), the EML/MBOX/CSV/paste importers with dedup (`src/lib/applications/normalize.ts`
similarity + requisition ids), and the `/integrations` page with honest OAuth-not-configured fallbacks. All
inferred status changes must go through `canApplyInferredStatus` and the applications service `changeStatus`
(`{ applied, reason }` result, optional `evidenceId`), using `recordEventOnce` for idempotent re-syncs.
