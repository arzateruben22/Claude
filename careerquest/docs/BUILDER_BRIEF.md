# CareerQuest builder brief (read this first)

You are one of several engineers building CareerQuest **in parallel in the same working tree**
(`/home/user/Claude/careerquest`). Run every command from that directory. The product spec is the
user's CareerQuest master prompt; the parts relevant to your task are restated in your assignment.

## Hard rules for parallel work

1. **Only create or modify files inside the paths you own** (listed in your assignment). Reading any
   file is fine. If a shared file needs a change, do not make it: describe the exact change in your
   final report under `sharedChangeRequests` and work around it.
2. Never edit: `prisma/schema.prisma` or migrations, `package.json` / `package-lock.json`,
   `src/app/layout.tsx`, `src/app/globals.css`, existing files in `src/components/ui/`,
   `src/lib/{db,crypto,utils,format,dates,action-result,rate-limit,audit,hooks}.ts`, `src/lib/auth/**`,
   `src/lib/events/**`, `src/proxy.ts`, `PROGRESS.md`, `README.md` — unless your assignment explicitly
   grants it. Do not delete or rename existing route files (`page.tsx`, `route.ts`); replacing a
   placeholder page's contents is fine.
3. Never run `next build`, `next dev`, `next start`, `npm install`, `prisma migrate`, `prisma generate`
   or Playwright. A later integration stage does that. Never commit or push.
4. Never delete or truncate data you did not create. DB-backed tests create their own user with a unique
   email and delete it in `afterAll` (cascade deletes the rest). Tests use the `careerquest_test`
   database automatically (`tests/setup.ts` loads `.env.test`).
5. Write your hand-off notes to `docs/notes/<your-key>.md` (what you built, routes, how to test,
   known gaps, external dependencies). Keep them factual.

## Verification you must run before finishing

- `npx tsc --noEmit 2>&1 | grep -E '<regex of your paths>'` → no errors in your paths (other engineers'
  in-progress files may show errors; ignore those, never "fix" them).
- `npx eslint <your paths>` → clean. The React Compiler lint rules are on: never call `setState`
  synchronously inside `useEffect` (use `useIsMounted()` from `@/lib/hooks` for mount detection,
  derive state during render, or use event handlers).
- `npx vitest run <your test files>` → green. Pure logic lives in plain `.ts` modules with unit tests.
  UI that you cannot open in a browser is smoke-tested with `react-dom/server` `renderToString` tests
  (see `tests/unit/applications-render.test.ts` for the pattern).

## Stack facts (verified — do not guess alternatives)

- **Next.js 16.4** App Router, `cacheComponents: false` (classic dynamic rendering). Page props:
  `{ searchParams: Promise<Record<string, string | string[] | undefined>> }`,
  `{ params: Promise<{ id: string }> }` — always `await` them. Do **not** use the `PageProps<>` helper
  for new routes. Route handlers: `export async function GET(req: Request)` etc. `redirect()` throws —
  never call it inside `try/catch`.
- **React 19.3**: Server Components by default; `"use client"` for interactivity. Forms use Server
  Actions (`"use server"` files) with `useActionState(action, null)` and the signature
  `(prev: ActionResult | null, formData: FormData) => Promise<ActionResult>`; call `revalidatePath()`
  after mutations. Every exported async function in a `"use server"` file becomes a public endpoint —
  export only actions, put helpers elsewhere, validate every input with zod and authorize with
  `requireUser()`.
- **Prisma 7**: `import { prisma } from "@/lib/db"`; types from `@/generated/prisma/client` (`Prisma`,
  model types); enums from `@/generated/prisma/enums` (runtime object + type, usable with `z.enum()`).
  `prisma/schema.prisma` is the source of truth — read it. Decimal columns must be converted with
  `Number()` before math or before passing to client components. `@db.Date` columns hold UTC-midnight
  dates representing a calendar day in the user's timezone.
- **Dates** (`@/lib/dates`, exact UTC math): `todayInTz(tz, now?)`, `dateKeyInTz(date, tz)`,
  `dateFromKey('YYYY-MM-DD')`, `dateKey(utcMidnightDate)`, `startOfWeekUtc`, `addUtcDays`,
  `daysBetween`, `campaignDay`. The user's timezone is `UserProfile.timezone` (default
  `America/Los_Angeles`). `src/lib/applications/time.ts` has tz-aware input parsing/formatting helpers
  (`parseDateInput`, `formatInTz`, …) — reuse them.
- **Auth**: Server Components/Actions: `const user = await requireUser()` (`@/lib/auth/current-user`).
  Route handlers: `getSessionUser()` (`@/lib/auth/session`) → 401 JSON when null; bearer tokens for the
  extension/mobile: `authenticateBearer(req.headers.get("authorization"))` + `hasScope()`
  (`@/lib/auth/api-token`). **Every query is scoped by `userId`; every update/delete uses
  `where: { id, userId }` or verifies ownership first. Never trust ids from the client.**
- **Rate limiting**: `rateLimit(key, limit, windowMs)` + `clientKey(prefix)` from `@/lib/rate-limit`.
- **Validation/results**: zod 4 (`z.email()`, `z.enum(PrismaEnum)`), `ok()/fail()/fromZodError()` from
  `@/lib/action-result`. Formatting: `@/lib/format` (`formatCurrency`, `formatPercent`, `formatDate`,
  `formatRelative`, `enumLabel`…), `cn()` from `@/lib/utils`.
- **Audit**: `audit(action, { userId, entityType, entityId, metadata })` from `@/lib/audit` for
  security-relevant actions (connect/disconnect integrations, exports, deletions, token use).
- **Secrets**: `encryptSecret()/decryptSecret()` (AES-256-GCM) and `sha256()/randomToken()` from
  `@/lib/crypto`. OAuth tokens are only ever stored encrypted.
- `server-only` is stubbed in vitest (`vitest.config.ts` alias) — DB tests can import server modules
  directly, no `vi.mock` needed.

## UI conventions

- Tailwind 4 semantic tokens only (no raw colors): `bg-bg`, `bg-bg-elevated`, `bg-surface`,
  `bg-surface-strong`, `bg-surface-hover`, `border-line`, `border-line-strong`, `text-fg`,
  `text-fg-muted`, `text-fg-subtle`, `bg-accent`/`text-accent`/`bg-accent-soft`/`text-accent-fg`,
  `bg-gold`/`text-gold`/`bg-gold-soft`, `text-success`/`bg-success-soft`, `text-warning`/
  `bg-warning-soft`, `text-danger`/`bg-danger-soft`, `text-info`/`bg-info-soft`; charts use CSS vars
  `var(--chart-1)`…`var(--chart-6)`. Utility classes: `glass`, `glass-strong`, `rounded-card`,
  `rounded-ctl`, `shadow-glow`, `tnum`, `animate-rise`.
- Primitives from `@/components/ui` (read them before use): `Button` (variants primary | secondary |
  ghost | danger | gold | outline; sizes sm | md | lg | icon; `loading`), `buttonClasses()`, `Card*`,
  `Input`, `Textarea`, `Select`, `Label`, `Field` ({label, htmlFor, errors, hint}), `FieldError`,
  `Checkbox` ({label}), `Badge` ({tone}), `StatusBadge`, `ProgressBar`, `StatTile`, `PageHeader`
  ({title, description, actions, eyebrow}), `EmptyState`, `Alert` ({tone, title}), `Dialog` (client),
  `LinkTabs` (client), `useToast()` (provider is mounted in the app layout). Icons: `lucide-react`.
  Put new reusable components in **your own** components folder.
- Mobile first: must work at 375 px wide (the app has a bottom nav; `main` already has `pb-24` on
  mobile). Tables need an overflow wrapper or a card layout on small screens.
- Accessibility: every input has a `<label>`; buttons have accessible names; status text is visible
  text (not color only); keyboard reachable; respect reduced motion (CSS already clamps animations;
  for `motion` use `useReducedMotion()`).
- Navigation already lists every top-level section (`src/components/shell/nav-config.ts`). Sub-pages
  inside your section should use `LinkTabs`.

## Product honesty rules (non-negotiable)

- No hardcoded/demo statistics, no fake charts, no buttons that do nothing. Empty states say there is
  no data yet and what to do next.
- Never present inferred data as verified, game progress as a license/certification/offer, simulated
  training as qualifying field experience, or estimates as facts. Label **Observed**, **Estimate**,
  **Hypothetical**, **Self-reported**, **Verified** explicitly.
- Never promise employment outcomes, overtime, raises or recruitment dates. Unverified facts show
  "Unverified" and the date they were last checked.
- Never submit applications, send emails or contact anyone without an explicit user action.

## Core contracts (already implemented — use them, don't re-implement)

### Applications service — `src/lib/applications/service.ts` (server-only)
- `createApplication(userId, input: ApplicationInput, origin: RecordOrigin = "MANUAL")`
- `updateApplication(userId, id, input)` — fields only, never status.
- `changeStatus(userId, id, { status, occurredAt?, note?, evidenceId? }, source: EventSource = "USER", verified = true)`
  → `{ applied: true, … } | { applied: false, reason }`. **The only way status changes.** For inferred
  sources it refuses downgrades/overrides of user-confirmed data (`canApplyInferredStatus` in
  `src/lib/applications/status.ts`).
- `recordFollowUp`, `addNote`, `scheduleInterview`, `markInterviewOutcome`, `archiveApplication`,
  `restoreApplication`, `deleteApplication` (revokes the record's XP), `listApplications`,
  `getApplication`.
- Normalization: `src/lib/applications/normalize.ts` (`normalizeCompany`, `normalizeTitle`,
  `normalizeUrl`, `detectPlatform`, `extractRequisitionId`, `similarity`).
- Status metadata: `src/lib/applications/status.ts`; labels: `src/lib/applications/labels.ts`.

### Events and XP — `src/lib/events/record-event.ts`, `src/lib/game/xp.ts`
- `recordApplicationEvent(tx, { userId, applicationId, type, source, verified?, occurredAt?,
  activityDate, dedupeKey?, xpDedupeKey?, payload?, evidenceId? })` appends an event exactly once
  (ON CONFLICT DO NOTHING — safe inside `prisma.$transaction`, a duplicate never aborts it) and applies
  XP, daily activity, missions and achievements.
- `awardXp(tx, { userId, reason, dedupeKey, amount?, sourceType?, sourceId?, activityDate? })` —
  idempotent by `(userId, dedupeKey)`. **Application-derived XP uses `sourceType: "Application"`**
  so it can be revoked. `revokeXpForSource(tx, userId, sourceType, sourceId)` reverses it.
  `awardXpStandalone(input)` when not in a transaction. XP values/levels: `src/lib/game/xp-config.ts`.
- XP is never awarded from UI code directly, never for spam/duplicates, and always with a stable key
  derived from the real-world record (e.g. `xp:lesson:<lessonKey>`, `xp:mission:<missionId>`).
- Mission/achievement hooks: `applyEventToMissions(tx, ctx)` (`src/lib/game/missions.ts`) and
  `evaluateAchievements(tx, userId)` (`src/lib/game/achievements.ts`). Non-application activities
  (lessons, quizzes, work hours) call them too with `type: "LESSON_COMPLETED" | "QUIZ_PASSED" |
  "WORK_HOURS_LOGGED" | "PROFILE_UPDATED" | "RESUME_UPDATED"`.

### Ingestion — `src/lib/ingest/types.ts` (contract) and `src/lib/ingest/engine.ts` (implementation)
Every automated capture path (email sync/import, the Chrome extension, CSV/URL imports, mobile share)
produces an `ApplicationObservation` and calls
`ingestObservation(userId, observation, options?) → IngestResult`. Only the ingestion engine turns
observations into application records: it matches existing records (deterministic first, fuzzy
second), creates records only when the evidence justifies it, applies status through the applications
service with source attribution, never overwrites user-confirmed data, attaches evidence idempotently
(`Evidence` unique on `(userId, kind, sourceRef)`), and returns `needs_review` for ambiguous cases.
Producers persist pending state on their own rows (EmailMessage `reviewStatus = NEEDS_REVIEW` with
`extracted.observation = serializeObservation(o)`; ExtensionCapture `PENDING_CONFIRMATION`).
Job alerts, application invitations and unfinished applications are **never** submissions.

## Environment facts

- PostgreSQL 16 on 127.0.0.1:5432 (`careerquest` dev, `careerquest_test` tests). If it is down:
  `scripts/dev-db.sh start`.
- Outbound network to most third-party hosts is blocked in this sandbox: OAuth providers, job boards
  and DIR pages cannot be reached. Design network code with an injectable `fetch` and test it with
  fakes; never claim a live integration works.
- Installed and available: `mailparser` (+types), `papaparse`, `read-excel-file`, `@anthropic-ai/sdk`,
  `recharts`, `motion`, `lucide-react`, `date-fns`, `zod`, `bcryptjs`.
- Email fixture corpus with golden labels: `tests/fixtures/emails/` (`index.json`, `*.eml`, `all.mbox`).
- Academy content: `data/academy/{lessons,workshop,exam}` (format in `data/academy/INDEX.md` once
  written, and in the lesson JSON files). Seed facts: `data/seed/*.json`, `data/research/*`.
