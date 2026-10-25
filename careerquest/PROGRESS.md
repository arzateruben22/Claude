# CareerQuest — Project Progress Log

This file is the hand-off record for future sessions. Keep it current: what works, what is stubbed,
what is blocked on external dependencies, and the exact next step.

## Environment facts (verified 2026-10-25)
- Node 22, npm 10. Next.js 16.4 (App Router, Turbopack, `cacheComponents` **disabled** on purpose — every
  authenticated page is dynamic). React 19.3. Tailwind 4 (tokens in `src/app/globals.css`).
- Prisma 7.10 with the `prisma-client` generator → `src/generated/prisma` (git-ignored; `npm install` regenerates).
  Driver adapter `@prisma/adapter-pg`. Config in `prisma.config.ts`, URL from `.env`. Migrations:
  `20261021221146_init`, `20261022031801_notification_dedupe`, `20261025224929_matcher_indexes`.
- PostgreSQL 16. Local dev cluster script: `scripts/dev-db.sh` (data dir `/var/lib/postgresql/careerquest-dev`).
  Databases: `careerquest` (dev) and `careerquest_test` (vitest/playwright, `.env.test`). Both are migrated and
  seeded (`npm run db:seed`, `npx dotenv -e .env.test -- tsx prisma/seed.ts`: 6 programs + 5 requirements).
- Auth is first-party: bcrypt (cost 12) + DB-backed sessions (`Session` table, sha256 of an opaque cookie token,
  30-day sliding). `src/proxy.ts` gates app routes by cookie presence; `requireUser()` validates. Bearer API
  tokens (`Settings → Developer tokens`) authenticate the extension API.
- Server clock is UTC; users default to `America/Los_Angeles`. Anything written to a `@db.Date` column must be
  derived with `todayInTz(profile.timezone)` (see `src/lib/dates.ts`), never `new Date()`.
- Uploads go through Server Actions; `next.config.ts` sets `experimental.serverActions.bodySizeLimit` and
  `experimental.proxyClientMaxBodySize` to 26 MB (documents ≤ 10 MB, `.eml`/`.mbox` ≤ 25 MB, spreadsheets ≤ 10 MB).
  Proven end to end by `tests/e2e/smoke-routes.spec.ts` (a 5 MB PDF and a 5 MB `.eml`).
- Outbound network to third parties is blocked in the build sandbox: Google, Microsoft, job boards and the
  Anthropic API were only exercised against fakes. Nothing claims a live integration works.

## Phase status
| Phase | Status | Notes |
|-------|--------|-------|
| 1 Foundation | **complete** | schema, auth, shell, UI primitives, tracker, dashboard, goals, analytics, settings; review findings F1/F3/F5–F10 fixed (`docs/notes/phase1-fixes.md`). |
| 2 Email intelligence | **complete (integrated 2026-10-25)** | deterministic email classifier (40/40 corpus), ingestion engine + matcher, duplicate scan/merge, review queue, Gmail/Outlook OAuth + sync (fakes only), EML/MBOX/CSV/XLSX/URL/paste imports, `/integrations`. |
| 3 Chrome extension | **complete (integrated)** | MV3 extension in `extension/` (103 Playwright tests), extension API (`/api/extension/*`), `/discovery` + `/share` mobile capture. Not run against a live job board. |
| 4 Game systems | **complete (integrated)** | missions (daily/weekly/campaign/$150K path), streaks, levels, derived stats, 23 achievements, celebration, Career Map, Skill Tree. Dashboard mounts the game engine's `TodayMissionsCard`. |
| 5 Academy | **complete (integrated)** | 31 lessons + 9 workshop circuits + 120-question bank (validator green), lessons/quizzes/workshop/exam/roadmap, apprenticeship directory + tracker, work-hours log with proof documents, certification tracker. |
| 6 AI + analytics | **complete (integrated)** | rules-based Advisor (+ optional Claude), résumé versions, weekly reports (+ CSV/JSON), Beta-Binomial forecast, salary calculator/comparison, offers. |
| 7 Mobile/polish | **integrated; adversarial review pending** | PWA (service worker, manifest shortcuts, share target), notifications + reminders + optional web push, three themes + reduced motion. Route smoke green on desktop and iPhone (no horizontal overflow). axe/a11y scans and the 20-step acceptance scenario are the next stage. |

## Integration stage (2026-10-25, key `integrate-wire`) — what changed
Shared change requests from the builder reports (`docs/notes/builder-reports.json`) that were applied:
- Dashboard: `<TodayMissionsCard userId />` (game engine) replaces the Phase-1 `MissionsCard`; `getDashboardData`
  no longer runs its own mission query and `DashboardData.missions` is gone.
- Analytics sub-navigation: one list (`ANALYTICS_SECTION_TABS`: Overview | Forecast | Weekly reports) rendered on
  `/analytics` (both branches), `/analytics/forecast` and the report pages; `src/components/forecast/nav.ts`
  re-exports it. Settings tabs link to `/notifications`. Application detail offers link to `/salary/offers/<id>`
  ("Compare / negotiate"). `ElectricianPathCard` opens `/career-map?node=supervised-experience`;
  `GAME_LINKS.resume` → `/coach/resumes`.
- `PageHeader` actions wrap (`flex-wrap`) so three header buttons fit at 375 px. `LinkTabs` tolerates a null
  `usePathname()` (server render tests).
- `next.config.ts` body limits (above); `.env.example` documents `APP_URL`'s three roles and the 16-character
  `CRON_SECRET` minimum.
- Game/service hooks: `markInterviewOutcome` fires `INTERVIEW_PREPARED` into `applyEventToMissions`;
  `completeOnboarding` runs in one transaction with `PROFILE_UPDATED` missions + achievements; `restartCampaign`
  moves a reported job to employment history and clears `PlayerStats.currentSalary` (same bookkeeping as
  "Re-open job search"); `verifiedHoursTotal` (missions/achievements/stats) excludes CLASSROOM hours like the
  Academy's totals; `src/lib/game/lessons-index.ts` reads lessons through the Academy's validated loader;
  `getReviewQueueCount` reuses `getReviewCounts` (merged pairs excluded).
- Extension CORS preflight also allows the `accept` header the extension sends.
- Additive migration `matcher_indexes`: `EmailMessage(userId, threadId)`, `ApplicationSourceLink(url)`,
  `JobLead(userId, normalizedUrl)`.
- `tests/e2e/phase1-acceptance.spec.ts` route walk now asserts the real module pages (the "under construction"
  placeholders no longer exist).

Requests **not** applied, and why (candidates for a later stage):
- Allowing unverified forward moves over an evidence-verified stage (`canApplyInferredStatus`): changes the
  honesty contract (evidence-verified vs user-confirmed) and needs a dedicated test pass across ingest/email;
  today the review queue handles it with one click.
- Widening `ApplicationObservation.source` to `USER` for Discovery/`/share` "I already applied": records are
  already verified with `createdVia` URL_IMPORT/MOBILE; only the history source label ("Import") would change,
  and it touches the engine, rules, converters and four modules' tests.
- Partial unique index on `ApplicationSourceLink`, `TargetCompany.normalizedName`, new `WorkType` values,
  `CertificationStatus.certificateDocumentId`: need raw SQL / backfills / form changes beyond an additive index.
- Skipping `evaluateAchievements` for no-op event types, a "You are here" dashboard card, Advisor-driven
  next-best action: optional, not needed for correctness.
- `read-excel-file` in `serverExternalPackages`: the build bundles it without trouble.

## What each module delivers (routes are all authenticated and dynamic)
- **Command Center** `/dashboard`: campaign eyebrow, welcome card until onboarding is done, Today / This week /
  Total submitted / Interview rate (Observed, n, Wilson interval, low-sample flag), next-best-action, campaign
  timeline, 14-day chart, funnel (same definitions as Analytics), follow-ups, interviews, XP/level + streak,
  today's missions, recent activity. `/dashboard/goals` pace math and calculator.
- **Tracker** `/applications/**`: list/new/detail/edit, status changes only through the service, offers card,
  evidence card, "Seen on" links, Import (`/applications/import` email files · spreadsheet · URLs · LinkedIn/ATS
  exports) and Review queue (`/applications/review` emails · captures · duplicates with counts).
- **Email + ingestion** (`src/lib/email`, `src/lib/ingest`, `src/lib/dedup`, `src/lib/integrations`,
  `src/lib/imports`): `processRawEmail` → `ingestObservation` → applications service; per-user advisory lock;
  review band 0.65–0.9; evidence unique on `(userId, kind, sourceRef)`; merge keeps history and XP once.
- **Extension API** `/api/extension/{me,lookup,captures}` (bearer scopes, 60/min, CORS for extension origins),
  **Discovery** `/discovery/**` (leads with fit score + eligibility flags, target companies, board search links,
  program portals), **mobile capture** `/share` (PWA share target + paste).
- **Game** `/missions/**` + `AchievementCelebration` in the app layout; every XP award is idempotent by
  `dedupeKey`; missions recompute from persisted data on each view or hook.
- **Career Map** `/career-map` (26 stops, figures only from seed/research with sources and check dates, user marks
  award no XP) and **Skill Tree** `/skills` (levels from real activity, refreshed on render).
- **Academy** `/academy/**`: lessons with server-graded quizzes (LESSON_COMPLETED XP once), simulated workshop
  (no XP; "Simulation — not qualifying field experience"), practice exam (XP once per local day), roadmap,
  apprenticeship directory + per-user tracker/checklist, hours log (verified vs self-reported always side by
  side; proof documents; CSV export), certification tracker ("self-attested with document").
- **Advisor** `/coach` (30 rules citing metric ids; Claude only when `ANTHROPIC_API_KEY` is set, 20/user/hour),
  `/coach/resumes`; **Analytics** `/analytics`, `/analytics/forecast` (estimates with intervals, no dates),
  `/analytics/reports/[weekStart]` (+ `/api/reports/[weekStart]`); **Salary** `/salary/**` with offers.
- **Integrations** `/integrations`: honest status per provider (Connected / Available / Experimental /
  Manual-only / Unsupported), OAuth consent + sync runs, extension setup. **Notifications** `/notifications`
  (reminders from the user's own data, optional push). **Settings** `/settings/**` incl. onboarding and tokens.

## Contracts every module must respect
- Applications never mutate status directly: use the applications service (`changeStatus` / `changeStatusInTx`)
  which writes `ApplicationStatusHistory` and calls `recordApplicationEvent` (`src/lib/events/record-event.ts`).
- XP is only awarded through `awardXp` with a stable `dedupeKey`; the ledger's unique constraint makes repeats
  no-ops. Application-derived XP carries `sourceType: "Application"` so deletes/merges can revoke it.
- Inferred status changes (email/extension/import) go through `canApplyInferredStatus` and never downgrade or
  override user-confirmed data; the ingestion engine routes refusals to the review queue.
- Every automated capture path produces an `ApplicationObservation` and calls `ingestObservation`.
- Every query is scoped by `userId` from `requireUser()`/`authenticateBearer()`.
- Non-application activity (lessons, quizzes, hours, résumés, program interests, documents, onboarding) calls
  `applyEventToMissions` + `evaluateAchievements` inside its own transaction so missions complete immediately.

## Verification (all green on 2026-10-25)
- `npx tsc --noEmit` → 0 errors; `npx eslint src tests` → 0 problems; `node scripts/validate-academy.mjs` → PASS
  (0 errors, 0 warnings); `npm run build` → 81 routes compiled (Turbopack warnings about dynamic filesystem
  access from the content loaders are expected).
- `npx vitest run` → 96 files / 1,418 tests (pure logic + DB-backed suites against `careerquest_test`; each DB
  suite creates and cascade-deletes its own user).
- Playwright (`npm run build`, then `npx playwright test`; the config starts `next start -p $E2E_PORT` with
  `.env.test` and reuses a running server — kill the old one after a rebuild: `fuser -k 3100/tcp`):
  - `tests/e2e/auth.spec.ts` (2 tests) and `tests/e2e/phase1-acceptance.spec.ts` (2 tests: register → onboarding
    → SUBMITTED application → SCREENING → list → dashboard → analytics → sign out/in with XP 0 → 50 → 75 → 75;
    route walk of every Phase 1 route, both API exports, and the eight module landing pages).
  - `tests/e2e/smoke-routes.spec.ts` (2 tests): a brand-new account visits all 61 page routes (real empty states,
    unknown ids → 404), then a second account completes onboarding and creates data through the UI (application
    moved to Offer + interview + offer record, lead, target company, lesson quiz attempt, 25-question practice
    exam, hours entry, 5 MB proof PDF upload, 5 MB `.eml` import, résumé version, weekly report) and visits
    every static and dynamic route again. Each visit asserts HTTP 200, the h1, no error overlay / "Application
    error", zero browser console errors and (iPhone) `scrollWidth <= innerWidth + 1`.
  - All three specs pass on `desktop-chromium` and `iphone`.
- Extension: `npx playwright test -c extension/tests/playwright.config.js` → 103 tests (last run by the
  `extension-fixes` builder).

## External dependencies (not live, honest fallbacks provided)
- Gmail/Outlook OAuth: need `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` (+ `APP_URL` as redirect base)
  → otherwise EML/MBOX/CSV/XLSX/URL/paste import. Google's `gmail.readonly` is a restricted scope (app verification).
- Anthropic API key for the LLM Advisor → otherwise the rules-based Advisor (always available, labelled).
- Web push VAPID keys (`npm run push:keys`) → otherwise in-app notifications only.
- A scheduler (cron) calling `POST /api/notifications/dispatch` and `POST /api/integrations/sync` with
  `Authorization: Bearer $CRON_SECRET` (≥ 16 chars) for reminders/push and background email sync.
- Research facts (DIR fees, exam vendor, IBEW rates) carry their check date (2026-10-21) and verification flags;
  unverified items say so in the UI. Re-verify on the official sites before a public launch.

## Known limitations carried forward
- In-memory rate limiters are per process (extension API, logins, actions); multi-instance hosting needs a shared store.
- Spreadsheet/URL rows the engine routes to review are listed in the import result only (no persisted review row).
- Email classification is English-only; the AI classifier hook has no implementation.
- Most recruiter/interview/assessment emails that follow a verified platform confirmation need one click in the
  review queue (conservative `canApplyInferredStatus`).
- `DailyActivity` counters are not rewritten on delete/merge beyond the duplicate-APPLIED decrement; the dashboard
  counts from records instead.
- `WorkType` has no underground-conduit / stock-room values, so those DIR areas are logged as "Other".
- Not yet run: axe accessibility scans, the Phase 2–3 browser tests with a local mock OAuth/Gmail/Outlook
  provider and the extension in the loop, the 20-step acceptance scenario.

## Next exact step
Run the next integration stage: Phase 2–3 browser tests with a local mock OAuth/Gmail/Outlook provider and the
extension in the loop, then Phase 4–7 browser tests incl. axe scans, then the 20-step acceptance scenario and the
full suite, then the adversarial review/verify/fix pass. If a session is interrupted, re-run
`npx tsc --noEmit && npx eslint src tests && npx vitest run && node scripts/validate-academy.mjs && npm run build`
and `fuser -k 3100/tcp; npx playwright test` to see the current state, then continue with the first stage that
is not green.
