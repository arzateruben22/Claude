# CareerQuest

Real-world career simulator + universal job application tracker + California electrician career academy.

CareerQuest turns a job search into a measurable campaign: every mission, XP award and achievement maps to a
real action (an application you submitted, an interview you attended, a lesson you completed, documented training
hours). Game progress is never presented as a license, certification, offer or verified experience.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 with semantic design tokens, three themes (CYBER default, CLASSIC, ULTRA) |
| Database | PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | First-party email + password (bcrypt) with database-backed sessions and bearer API tokens for the extension |
| Charts / motion | Recharts, `motion` |
| Tests | Vitest (unit + database tests), Playwright (end-to-end, desktop + iPhone) |

## Quick start

```bash
cd careerquest
cp .env.example .env            # edit DATABASE_URL and AUTH_SECRET
npm install                     # also runs `prisma generate`
scripts/dev-db.sh start         # optional: local PostgreSQL 16 cluster (Linux, postgresql-16 installed)
npm run db:migrate              # applies prisma/migrations
npm run db:seed                 # reference data (California certification facts, apprenticeship directory)
npm run dev                     # http://localhost:3000
```

Create an account at `/register`. All data is private to the account that created it.

## Environment variables

See `.env.example` for the full list. Required: `DATABASE_URL`, `AUTH_SECRET` (16+ random characters; used to
derive the AES-256-GCM key that encrypts stored OAuth tokens), `APP_URL`.

Optional integrations are **off** until configured and are labeled accordingly in the Integrations page:

| Variable | Enables |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail read-only import of application emails (OAuth) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Outlook Mail.Read import (OAuth) |
| `ANTHROPIC_API_KEY` | LLM-backed Career Coach (the rules-based coach works without it) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web push notifications (in-app notifications work without them) |

Without the Gmail/Outlook credentials you can still import application emails from `.eml` / `.mbox` exports,
CSV files, pasted email text and job URLs.

## Database

- Schema: `prisma/schema.prisma` (single source of truth). Config: `prisma.config.ts`.
- `npm run db:migrate` — create/apply migrations in development.
- `npm run db:deploy` — apply migrations in production.
- `npm run db:reset` — drop and recreate the dev database (destructive).
- `npm run db:studio` — browse data.
- Tests use a separate database (`.env.test`, `careerquest_test`). Apply migrations to it with
  `npx dotenv -e .env.test -- prisma migrate deploy`.

## Testing

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # eslint
npm test                   # vitest unit + database tests (uses .env.test)
npm run build              # production build (required before e2e)
npm run test:e2e           # Playwright acceptance tests (starts `next start` on port 3100 with .env.test)
```

Playwright uses a pre-installed Chromium when `/opt/pw-browsers/chromium` exists (or `PLAYWRIGHT_CHROMIUM_PATH`),
otherwise run `npx playwright install chromium` once.

## Browser extension

The Chrome (Manifest V3) extension lives in `extension/` and is documented in `extension/README.md` once Phase 3
lands. It authenticates with a developer token created in Settings → Developer tokens.

## Project status

See `PROGRESS.md` for the phase-by-phase status, contracts every module follows, external dependencies and the
exact next step. The product is not complete until the acceptance workflow in `tests/e2e/` passes end to end.
