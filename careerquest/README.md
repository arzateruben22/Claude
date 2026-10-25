# CareerQuest

Real-world career simulator + universal job application tracker + California electrician career academy.

CareerQuest turns a job search into a measurable campaign: every mission, XP award and achievement maps to a
real action (an application you submitted, an interview you attended, a lesson you completed, documented training
hours). Game progress is never presented as a license, certification, offer or verified experience; inferred
data is labelled Observed / Estimate / Self-reported / Verified everywhere it appears.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 with semantic design tokens, three themes (CYBER default, CLASSIC, ULTRA) |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | First-party email + password (bcrypt) with database-backed sessions and bearer API tokens for the extension |
| Charts / motion | Recharts, `motion` |
| Tests | Vitest (unit + database tests), Playwright (end-to-end, desktop + iPhone), the extension's own Playwright suite |

## Quick start

```bash
cd careerquest
cp .env.example .env            # edit DATABASE_URL, AUTH_SECRET, APP_URL
npm install                     # also runs `prisma generate`
scripts/dev-db.sh start         # optional: local PostgreSQL 16 cluster (Linux, postgresql-16 installed)
npm run db:migrate              # applies prisma/migrations (use `npm run db:deploy` outside development)
npm run db:seed                 # reference data: apprenticeship directory + California certification requirements
npm run dev                     # http://localhost:3000
```

Create an account at `/register`, finish the three-step setup at `/settings/onboarding`, then log an
application. All data is private to the account that created it.

`npm run db:seed` is idempotent (upserts, never deletes, never touches user data). Without it the apprenticeship
directory, the Career Map's program facts and the Advisor's program comparison show honest "not loaded yet"
states.

## What is in the app

| Section | Routes |
|---------|--------|
| Command Center | `/dashboard` (today's missions card, numbers, funnel, follow-ups, interviews, XP/streak), `/dashboard/goals` |
| Missions | `/missions`, `/missions/week`, `/missions/campaign` (Operation Get Hired + the $150K Electrician Path), `/missions/achievements` |
| Job Discovery | `/discovery` (leads with fit score), `/discovery/companies`, `/discovery/search`, `/discovery/apprenticeships`; `/share` (PWA share target / paste capture) |
| Application Tracker | `/applications`, `/applications/new`, `/applications/[id]`, `/applications/[id]/edit`, `/applications/import` (+ `/spreadsheet`, `/urls`, `/exports`), `/applications/review` (+ `/captures`, `/duplicates`) |
| Career Map / Skill Tree | `/career-map` (`?node=`), `/skills` (`?skill=`) |
| Electrician Academy | `/academy`, `/academy/lessons/[key]` (+ `/quiz`), `/academy/workshop` (+ `/[key]`), `/academy/exam` (+ `/take`, `/review/[id]`), `/academy/roadmap`, `/academy/apprenticeships` (+ `/[slug]`), `/academy/hours` (+ `/[id]`, CSV at `/academy/hours/export`), `/academy/certification` |
| Career Advisor | `/coach` (rules-based always; Claude when `ANTHROPIC_API_KEY` is set), `/coach/resumes` |
| Analytics | `/analytics`, `/analytics/forecast`, `/analytics/reports` (+ `/[weekStart]`, CSV/JSON at `/api/reports/[weekStart]`) |
| Salary Simulator | `/salary`, `/salary/compare`, `/salary/offers` (+ `/new`, `/[id]`, `/[id]/edit`) |
| Integrations | `/integrations` (Gmail/Outlook OAuth when configured, extension setup, sync runs) |
| Notifications / Settings | `/notifications`; `/settings` (+ `/campaign`, `/eligibility`, `/appearance`, `/account`, `/tokens`, `/onboarding`) |

## Environment variables

See `.env.example` for the full, commented list. Required: `DATABASE_URL`, `AUTH_SECRET` (16+ random characters;
derives the AES-256-GCM key that encrypts stored OAuth tokens) and `APP_URL` (the public origin users open; also
the OAuth redirect base, the base of the extension API's links and the only non-extension origin answered by CORS).

Optional integrations are **off** until configured and are labelled accordingly in the Integrations page:

| Variable | Enables |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail read-only import of application emails (OAuth, PKCE) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Outlook Mail.Read import (OAuth, PKCE) |
| `ANTHROPIC_API_KEY` | Claude-backed Career Advisor answers for open questions (the rules-based Advisor works without it) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push notifications (`npm run push:keys` generates a pair; in-app notifications work without them) |
| `CRON_SECRET` | The scheduler endpoints below (must be at least 16 characters) |
| `TRUST_PROXY` / `TRUST_PROXY_HOPS` | Rate limiting by `X-Forwarded-For` behind a trusted reverse proxy only |
| `UPLOAD_DIR` | Where uploaded documents (pay stubs, certificates, résumés) are stored; defaults to `./uploads` |

Without the Gmail/Outlook credentials you can still import application emails from `.eml` / `.mbox` exports
(up to 25 MB per import), CSV/TSV/XLSX files (up to 10 MB), pasted email text and job URLs. Document uploads are
limited to 10 MB. `next.config.ts` raises Next's server-action and proxy body limits to 26 MB to match.

## Scheduler (cron) endpoints

Nothing is scheduled inside the app. Call these from cron or a platform scheduler with the shared secret:

```sh
# every 15–60 minutes: due reminders for every user + web push where enabled
curl -fsS -X POST "$APP_URL/api/notifications/dispatch" -H "Authorization: Bearer $CRON_SECRET"
# every 30 minutes: background Gmail/Outlook sync for every CONNECTED, sync-enabled mailbox
curl -fsS -X POST "$APP_URL/api/integrations/sync" -H "Authorization: Bearer $CRON_SECRET"
```

Both answer 401 without the secret. `POST /api/integrations/sync` without the secret syncs only the signed-in
user's own connections (same origin, rate limited) and is what the "Sync now" button calls.

## Database

- Schema: `prisma/schema.prisma` (single source of truth). Config: `prisma.config.ts`.
- `npm run db:migrate` — create/apply migrations in development (interactive).
- `npm run db:deploy` — apply migrations in production / non-interactive environments.
- `npm run db:reset` — drop and recreate the dev database (destructive).
- `npm run db:seed` — upsert the reference data from `data/seed/*.json`.
- `npm run db:studio` — browse data.
- Tests use a separate database (`.env.test`, `careerquest_test`). Apply migrations and seed it with
  `npx dotenv -e .env.test -- prisma migrate deploy && npx dotenv -e .env.test -- tsx prisma/seed.ts`.
- Adding a migration without the interactive CLI: edit the schema, then
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<UTC timestamp>_<name>/migration.sql`
  and run the deploy commands above.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` / `npm run build` / `npm start` | Next.js dev server / production build (runs `prisma generate` first) / production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`npx eslint src tests` for the same scope CI uses) |
| `npm test` | Vitest unit + database tests against `careerquest_test` |
| `npm run test:e2e` | Playwright: `tests/e2e/auth.spec.ts`, `phase1-acceptance.spec.ts`, `smoke-routes.spec.ts` on `desktop-chromium` and `iphone` |
| `npm run validate:academy` | `scripts/validate-academy.mjs`: validates every Academy lesson, workshop circuit, exam question and seed fact |
| `npm run push:keys` | Generates a VAPID key pair for web push |
| `npm run icons` | Regenerates the PWA icons |
| `npm run format` | Prettier over `src/` and `extension/` |

## Testing

```bash
npm run typecheck && npx eslint src tests
npm test                                   # vitest
npm run validate:academy
npm run build                              # required before e2e (playwright.config.ts runs `next start`)
npx playwright test                        # or one spec: npx playwright test tests/e2e/smoke-routes.spec.ts --project=iphone
npx playwright test -c extension/tests/playwright.config.js   # the Chrome extension's own suite
```

`playwright.config.ts` reads `E2E_PORT` (default 3100) and `E2E_ENV_FILE` (default `.env.test`), sets `APP_URL`
from the port, starts `next start -p $E2E_PORT` and reuses a server that is already listening — after a rebuild,
stop the old one first (`fuser -k 3100/tcp`). Parallel worktrees can use ports 3101–3103. Playwright uses the
pre-installed Chromium at `/opt/pw-browsers/chromium` (or `PLAYWRIGHT_CHROMIUM_PATH`), otherwise run
`npx playwright install chromium` once.

## Browser extension

The Chrome (Manifest V3) extension lives in `extension/` — see `extension/README.md` for the unpacked install
(`chrome://extensions` → Developer mode → Load unpacked → `careerquest/extension`), the exact sites its content
scripts run on, and `extension/PRIVACY.md`. It authenticates with a developer token created in
**Settings → Developer tokens** and talks only to `/api/extension/me`, `/api/extension/lookup` and
`/api/extension/captures`.

## Project status

See `PROGRESS.md` for the phase-by-phase status, what each module delivers, the contracts every module follows,
external dependencies and the exact next step. `docs/notes/*.md` are the per-module hand-off notes.
