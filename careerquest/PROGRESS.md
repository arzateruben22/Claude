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
| 1 Foundation | **complete** (2026-10-21) | schema, auth, shell, UI primitives, tracker, dashboard, goals, analytics, settings; acceptance e2e green. Review-finding fixes F1/F3/F5–F10 in progress (builder `phase1-fixes`). |
| 2 Email intelligence | **building** (2026-10-22) | builders `email-core` → `ingest-engine` + `integrations-imports` |
| 3 Chrome extension | extension built (61 tests); review fixes in progress (`extension-fixes`); backend API builder `extension-api-discovery` |
| 4 Game systems | **building** | `game-engine` → `career-map-skills` |
| 5 Academy | **building** | 31 lessons + 9 workshops + 120-question bank authored; `academy-content` validates facts; `academy-learning` → `academy-records` (seed, hours, documents, certification) |
| 6 AI + analytics | **building** | `forecast-salary` + `coach-reports` |
| 7 Mobile/polish | partly done | PWA service worker (static-only cache), icons, manifest shortcuts/share target, notifications + reminders + optional web push (done, tested). Share page by `extension-api-discovery`. a11y/axe + full acceptance in the integration stage. |

### How the remaining work is organised (2026-10-22)
Parallel builders own disjoint paths and follow `docs/BUILDER_BRIEF.md`; each writes `docs/notes/<key>.md`.
After all builders finish, one serialized integration workflow runs: wire shared changes + green build + route
smoke (desktop and iPhone) → Phase 2–3 browser tests with a local mock OAuth/Gmail/Outlook provider and the
extension in the loop → Phase 4–7 browser tests incl. axe accessibility scans → the 20-step acceptance scenario
and the full suite. Then an adversarial review/verify/fix pass.

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

## Shared-code issues resolved on 2026-10-22
- `recordApplicationEvent` and `awardXp` now insert with `ON CONFLICT DO NOTHING` (createMany + skipDuplicates),
  so a duplicate never aborts the caller's Postgres transaction; `recordEventOnce` / `awardXpOnce` are thin aliases.
- Submission XP is keyed by a normalized position fingerprint (company + title + location), so the same job
  recorded twice earns 25 XP once. Repeatable actions pass `xpDedupeKey` (one follow-up award per application per
  day; one per interview). Application XP carries `sourceType: "Application"`; `deleteApplication` calls
  `revokeXpForSource` (compensating negative rows; the action can be re-earned once if re-recorded).
- `src/lib/dates.ts` is exact-UTC math; `src/lib/goals/days.ts` re-exports it.
- `server-only` is aliased to a stub in `vitest.config.ts`.
- Rate limiting ignores `X-Forwarded-For` unless `TRUST_PROXY=true`; login also has a per-account limit; the
  post-login `next` parameter is validated by `src/lib/auth/safe-next.ts`; unknown-email logins compare against a
  real bcrypt hash.
- Remaining known limitation: the in-memory rate limiter is per-process (use Redis for multi-instance hosting).

## External dependencies (not live, honest fallbacks provided)
- Gmail/Outlook OAuth: need `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` → otherwise EML/MBOX/CSV/paste import.
- Anthropic API key for the LLM coach → otherwise rules-based coach (always available).
- Web push VAPID keys (`npm run push:keys`) → otherwise in-app notifications only.
- A scheduler (cron) calling `POST /api/notifications/dispatch` and `POST /api/integrations/sync` with
  `Authorization: Bearer $CRON_SECRET` for reminders/push and background email sync.

## Next exact step
Wait for the three builder workflows (Phase 2/3, Phase 4/5, fixes + Phase 6) to finish, commit their output, then
run the integration workflow (script kept in the session scratchpad as `wf_int.js`; its prompts are the four
integration stages described above) and the review/verify/fix pass. If a session is interrupted, re-run
`npx tsc --noEmit && npx eslint src tests && npx vitest run && npm run build` to see the current state, then
continue with the first stage that is not green.
