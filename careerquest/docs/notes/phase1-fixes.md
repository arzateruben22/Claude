# phase1-fixes — Phase 1 review findings, transaction API, merged semantics, detail/list UI

Owner key: `phase1-fixes`. Every finding below has a regression test that was run against the
original code first (13 of the new service tests failed there; the metric tests failed 9/10) and
passes now.

## Findings fixed

| ID | Fix | Tests |
|----|-----|-------|
| F1 | A submission (application date, APPLIED event, XP, daily count) is recorded only when the status implies one: pipeline ≥ SUBMITTED, REJECTED or NO_RESPONSE (`impliesSubmission`). WITHDRAWN/CLOSED count only with evidence: an application date or a previous submitted status (`countsAsSubmission`). Never-applied records keep `appliedAt = null`; SAVED/PREPARING ignore a typed date (service) and the create action returns a field error for it. Editing keeps the existing application date when the field is blank. | `applications-fixes` (F1 block), `applications-status` (submission semantics), `dashboard-fixes` (metric level), `analytics-fixes` |
| F3 | Numbers game counts applications by application day inside [campaign start, today]: `completed`, pace, consistency, milestones, `responses` and `responseRate` are campaign-window values. `GoalsData.completedAllTime` carries the all-time total (shown in the tile hint). | `dashboard-fixes` (restarted campaign with backdated applications) |
| F5 | The dashboard funnel and rates come from `computeFunnel` (src/lib/analytics/funnel.ts) — one definition per stage; ACCEPTED counts as hired on both pages; `DashboardData.rates` gained `lowSample` and `interviewInterval`; the Interview-rate tile shows a "Low sample" badge (or the 95% interval) and the funnel strip a low-sample note. | `dashboard-fixes` (dashboard == analytics on the reviewer's scenario), `dashboard-render` |
| F6 | `createApplication(userId, input, origin, opts?)`: source = `opts.source ?? ORIGIN_EVENT_SOURCE[origin]` (EMAIL→EMAIL, EXTENSION→EXTENSION, CSV_IMPORT/URL_IMPORT→IMPORT, PLATFORM_API→PLATFORM_API, MANUAL/MOBILE→USER, SYSTEM→SYSTEM); `verified = opts.verified ?? source === "USER"`; `evidenceId` is attached to the history row, SAVED event and milestones; `statusVerified` follows. | `applications-fixes` (F6 block) |
| F7 | Analytics keeps the wide SQL bounds, then keeps exactly the records whose calendar day (`applicationDayKey` = application day, else day added, user timezone) is in range — for the page and the CSV export. The daily "applied" series is keyed by the same application day, so it sums to the funnel's applied count. | `analytics-fixes` (8 PM Pacific case, export) |
| F8 | Tracker `from`/`to` use `dayRangeInTz` (profile timezone; same reading as the dates the list displays). `dayRange` is kept (deprecated). | `applications-fixes` (F8) |
| F9 | When an unverified OFFER_RECEIVED milestone exists and a verified source reaches an offer stage, the event is upgraded to verified and JOB_OFFER_VERIFIED is paid once (`xp:<id>:JOB_OFFER_VERIFIED`). A verified source re-submitting an *unverified* current stage now confirms it (history row "Confirmed Offer", `statusVerified = true`, `result.confirmed = true`) instead of returning `same_status`; the status panel shows a "Confirm <stage>" button for unverified stages. | `applications-fixes` (F9 block), `applications-helpers`, `applications-render` |
| F10 | STATUS_CHANGED events are keyed by their history row (`<id>:status:<historyId>`), so every transition keeps its event and note. | `applications-fixes` (F10) |

F4 (streaks) was skipped as instructed (game engine).

## Transaction-composable service API (src/lib/applications/service.ts)

```ts
export type ServiceTx = Prisma.TransactionClient;
createApplicationInTx(tx, userId, input: ApplicationInput, origin: RecordOrigin,
  opts?: { source?: EventSource; verified?: boolean; evidenceId?: string | null }): Promise<CreateApplicationResult>
changeStatusInTx(tx, userId, id, input: StatusChangeInput, source: EventSource, verified: boolean): Promise<ChangeStatusResult>
addSourceLinkInTx(tx, userId, applicationId, { platform, url?, externalId?, origin }): Promise<{ created: boolean; link: ApplicationSourceLink }>
fillEmptyFieldsInTx(tx, userId, id, patch: FillableFields): Promise<{ application: Application; filled: string[] }>
```

- `createApplication` / `changeStatus` open a transaction and delegate to these (no duplicated logic).
  The profile timezone is read through `tx`, so it sees the caller's uncommitted writes (tested).
- `addSourceLinkInTx`: ownership-checked (throws `ApplicationNotFoundError`); idempotent per platform +
  normalized URL, or platform + external id; a link with neither is a no-op when the platform is already
  linked; on a match only empty `url`/`externalId` are filled. Only http(s) URLs are stored.
- `fillEmptyFieldsInTx`: sets only empty fields (`employmentType` UNKNOWN counts as empty); a new
  posting URL re-derives `normalizedUrl`, `source` (only when it is still OTHER) and the requisition
  fallback (patch → URL → description). Salary is filled only as a whole when the record has no pay at
  all (never mixes bounds/periods). Recruiter: unlinked record → new contact; linked contact → only a
  missing email (and a name only when the contact's name is its email placeholder). `filled` lists
  what changed (including derived `source` / `requisitionNumber`).
- Also exported: `ORIGIN_EVENT_SOURCE`, `attributionForOrigin` (pure, `src/lib/applications/origin.ts`),
  `CreateApplicationOptions`, `SourceLinkInput`, `FillableFields`, `FillEmptyFieldsResult`.
- New pure helpers in `status.ts`: `impliesSubmission`, `countsAsSubmission`, `hasApplied`,
  `appliedInstant`. `isSubmittedStatus` is unchanged (display/back-compat only — not for metrics/XP).

## One "applied" definition and population rules

- Applied = `appliedAt != null` OR an APPLIED event (`hasApplied`), used by `classifyApplication`
  (Analytics), the dashboard and the Numbers game.
- Effort counts (Today, This week, 14-day chart, campaign progress) count applications by application
  day **including archived** ones (archiving hides a record; it does not undo an application), never
  merged or deleted ones, and never never-applied ones. They are now derived from application records,
  not `DailyActivity`, so a deleted record stops counting.
- Funnel/rates/"Total submitted" use the non-archived slice, matching Analytics' default filters.

## Merged records (`mergedIntoId != null`)

Excluded from: tracker list/counts/`hasAny`/categories (even with archived included), dashboard
(totals, funnel, effort counts, follow-ups, upcoming interviews, recent activity), goals, analytics
(totals, funnel, options, `hasAnyApplications`), and the CSV export. The detail page still opens a
merged record, shows a "Merged into …" banner linking to the survivor, and hides the stage/follow-up/
interview/note forms.

## UI changes

- Detail page: Offers card (`OffersCard`) with **Add offer details** → `/salary/offers/new?applicationId=<id>`
  at OFFER/ACCEPTED/HIRED, plus the recorded offers; Evidence card (kind badge, source label from
  `evidenceSourceLabel` — known providers/platforms only, unknown strings are never echoed — title,
  snippet, capture time); "Seen on: Indeed · Workday" row from `ApplicationSourceLink` (only http(s)
  URLs become links); unverified badge shows when it was last set; "Applied" shows "Not applied".
- List header: **Import** → `/applications/import`, **Review queue** → `/applications/review` with a
  count badge from `getReviewQueueCount(userId)` (`src/lib/applications/review-count.ts`: EmailMessage
  NEEDS_REVIEW + ExtensionCapture PENDING_CONFIRMATION + DuplicateCandidate PENDING), hidden at 0,
  "99+" cap, accessible label. Both pages are built by others and may 404 until integration.
- CSV export writes an `export.applications` audit row.

## Phase-1 UX self-review — what changed

1. Validation errors no longer wipe input in the stage, follow-up, note, schedule-interview and
   interview-outcome forms (`useToastForm`: submit via `onSubmit` + transition, so React's automatic
   form reset never runs; fields are cleared only after a successful save; `action` kept for no-JS).
2. Delete dialog said "XP you already earned stays on your record" — false since F2; now says the XP is
   taken back and the record stops counting. Archive copy explains what archiving does to counts.
3. Create/edit form: no "Applied on" field for stages that were never applied; WITHDRAWN/CLOSED explain
   they count only with a date; edit hint "Blank keeps the current date"; status hints say saved leads
   do not count toward targets.
4. Post-create alert said "counted toward today's target" (wrong for backdated dates) → "counts toward
   your daily target on the day you applied".
5. Dashboard: Interview-rate tile labelled Observed with n, low-sample badge or 95% interval; funnel
   strip states it uses Analytics' definitions; chart caption "By the day each application was sent";
   Missions empty state no longer claims missions arrive "in a later phase" (they exist now).
6. Numbers game: "Applied this campaign" with all-time in the hint; ladder/calculator copy says
   "this campaign"; response-rate sentence flags low samples.
7. Analytics: definitions footnote and "never applied (saved or closed)" hint match the new rules.
8. 375 px: list header actions wrap (PageHeader's own actions row does not); long notes/timeline
   details/interview notes/job descriptions use `break-words`; detail columns are `min-w-0`; mobile
   list cards show an "Unverified" badge (desktop already did).
9. Posting links render only for http(s) URLs (records can now come from captures).

## How to test

```
npx vitest run tests/unit/applications*.test.ts tests/unit/dashboard*.test.ts tests/unit/goals*.test.ts \
  tests/unit/analytics*.test.ts tests/unit/auth-safe-next.test.ts
```
New files: `tests/unit/applications-fixes.test.ts`, `tests/unit/dashboard-fixes.test.ts`,
`tests/unit/analytics-fixes.test.ts`, `tests/unit/applications-page-render.test.ts`; additions in
`applications-status`, `applications-helpers`, `applications-render`, `analytics-funnel`,
`dashboard-render`. `dashboard-queries` no longer assumes zero missions (the game engine now creates them).

## Known gaps

- Moving a record from a submitted stage back to SAVED/PREPARING (a correction) keeps its application
  date, APPLIED event and XP; there is no "I never actually applied" undo yet.
- `DailyActivity.applicationsSubmitted` (used by streaks/missions) is still an event counter that is
  never decremented on delete/merge, so streak/mission numbers can differ from the dashboard's
  application-derived counts after a delete or merge.
- `getDashboardData` / `getGoalsData` load every non-merged application (funnel-relevant events only)
  per request; fine for personal trackers, worth an aggregate cache past a few thousand records.
- `addSourceLinkInTx` idempotency is application-level (no DB unique constraint), so two concurrent
  transactions for the same record could both insert.
