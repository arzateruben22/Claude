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

## Phase status
| Phase | Status | Notes |
|-------|--------|-------|
| 1 Foundation | in progress | schema, auth, shell, UI primitives done; modules pending |
| 2 Email intelligence | pending | |
| 3 Chrome extension | pending | |
| 4 Game systems | pending | hooks in `src/lib/game/{missions,achievements}.ts` are no-op stubs until Phase 4 |
| 5 Academy | pending | research facts in scratchpad → to be seeded in `prisma/seed.ts` |
| 6 AI + analytics | pending | |
| 7 Mobile/polish | pending | |

## Contracts every module must respect
- Applications never mutate status directly: use the applications service (Phase 1 module) which writes
  `ApplicationStatusHistory` and calls `recordApplicationEvent` (`src/lib/events/record-event.ts`).
- XP is only awarded through `awardXp` with a stable `dedupeKey`; the ledger's unique constraint makes repeats no-ops.
- Inferred status changes (email/extension/import) go through `canApplyInferredStatus` in
  `src/lib/applications/status.ts` and never downgrade or override user-confirmed data.
- Every query is scoped by `userId` from `requireUser()`/`authenticateBearer()`.

## External dependencies (not live, honest fallbacks provided)
- Gmail/Outlook OAuth: need `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` → otherwise EML/MBOX/CSV/paste import.
- Anthropic API key for the LLM coach → otherwise rules-based coach (always available).
- Web push VAPID keys → otherwise in-app notifications only.

## Next exact step
Run the Phase 1 module workflow (applications tracker, dashboard, goals calculator, analytics, settings), then the
Playwright acceptance test for Phase 1.
