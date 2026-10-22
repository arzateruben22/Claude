# coach-reports — Career Advisor + weekly reports

Owner key: `coach-reports`. Built 2026-10-22. Replaces the `/coach` placeholder and adds `/coach/resumes`,
`/analytics/reports`, `/analytics/reports/[weekStart]` and `GET /api/reports/[weekStart]`.

## Routes (all authenticated, dynamic)

| Route | What it does |
|---|---|
| `/coach` | **This week's priorities**: the top 3 recommendations from the rules engine, one per group. Every number in them is a metric chip; opening a chip shows the value, n, 95% interval, basis (Observed / Self-reported / Verified / Estimate / Your target / Reference data), definition and a link to the records. There is also a "more recommendations" disclosure and "The numbers the Advisor uses", which lists every metric with its id. The **chat panel** has starter prompts, an application picker for drafts and tailoring, quick replies, copyable drafts labelled "Draft · not sent", a mock-interview banner and "Clear conversation". `?ask=<text>` pre-fills the message box once; recommendation buttons use this. |
| `/coach/resumes` | Résumé versions: paste, edit (`?edit=<id>`), make default, delete. The Advisor tailors from the most recently updated version. `GAME_LINKS.resume` already points to `/coach`, and the Résumés tab is one click away. |
| `/analytics/reports` | Up to 52 weeks, newest first, from the week of the user's first activity (the earlier of account creation and the earliest application date). Each week shows whether it is stored, frozen or incomplete. Has a "Generate this week's report" button. |
| `/analytics/reports/[weekStart]` | Report view for a Monday `YYYY-MM-DD`. Shows a freshness banner, tiles with deltas, a comparison table by section, the cumulative funnel with intervals, the missions completed and the top recommendations with their cited numbers. Also: CSV and JSON download, Print (an inline `@media print` sheet hides the app chrome), and "Regenerate from today's data" on past weeks. Anything that is not a Monday, or a future week, returns 404. |
| `GET /api/reports/[weekStart]?format=csv\|json` | Session auth (401 JSON when signed out). The report is looked up by the session user's id, so a user only ever gets their own. 400 for a bad week or format, 404 for a future week, 429 at more than 60 downloads/min. Writes the audit entry `export.weekly_report`. The freshness rule is the same as the page's. |

## Metrics snapshot — `src/lib/coach/metrics.ts` (server-only) + `snapshot.ts` (pure)

`loadCoachFacts(userId, now)` reads persisted, userId-scoped data into a JSON-serializable `CoachFacts`. It uses the shared
definitions: `computeFunnel`/`conversionBy` over non-archived, non-merged applications (the same slice Analytics uses by
default). Effort counts for today and this week are counted by the day the application was applied, archived included,
which is the dashboard's rule. Follow-ups use the dashboard's active statuses and due-bound. `buildSnapshot(facts)`
turns the facts into `Metric[]` (`{ id, label, value, display, basis, n?, interval?, lowSample?, detail?, href? }`).
`getCoachSnapshot(userId, now)` does both steps.

Metric ids (stable; data-dependent ids are slugged):

- Funnel: `funnel.applied`, `funnel.responses`, `funnel.response_rate`, `funnel.screened`, `funnel.interviews`, `funnel.interview_rate`, `funnel.offers`,
  `funnel.offer_rate`. Rates carry n, a Wilson 95% interval and `lowSample` (n < 10).
- Conversions, only for groups with n ≥ 5:
  - `category.best` / `category.worst`, `source.best` / `source.worst`, `resume.best` / `resume.worst`. Best and worst need at least two qualifying groups with different rates.
  - One metric per qualifying group: `category.<slug>`, `source.<slug>`, `resume.<slug>`.
- Week and targets: `week.applied`, `week.target`, `week.pace_expected` (daily target × planned workdays before today, capped at the weekly
  target), `week.active_days`, `today.applied`, `today.target`.
- `followups.overdue`, `followups.due_today`, `applications.stale` (SUBMITTED/CONFIRMED with no status change, event or follow-up date
  in 21 days, and no future follow-up planned).
- `interviews.attended`, `interviews.upcoming` (next 7 days), `interviews.next`; `offers.open`, `offers.next_decision`,
  `offers.best_annualized` (estimate).
- `campaign.day`, `campaign.phase`, `streak.current`, `streak.longest`, `activity.consecutive_days` (calendar days in a row with real
  activity, rest days excluded).
- Academy: `academy.lessons_completed`, `academy.track.<track>`, `academy.next_lesson`, `academy.days_since_activity`, `quiz.latest`,
  `quiz.recent_average` (last 5 attempts of any kind).
- `hours.self_reported`, `hours.verified` (EMPLOYER_VERIFIED + OFFICIAL_RECORD), `hours.days_since_last`.
- `resume.versions`, `goals.salary_immediate`, `goals.salary_long_term`, `xp.total`.
- Programs:
  - `programs.open_verified`, `programs.unverified`, `programs.saved`.
  - `program.<slug>` for each directory row. The value is OPEN only when the row says OPEN **and** has `verifiedOn`; otherwise the text reads "Recruitment status unverified, check the program's site (last checked …)".
- Ids produced by tools: `stage.response_to_interview`, `stage.interview_to_offer` (bottleneck), `fit.score` (résumé match), `alignment.average`,
  `gaps.postings_analyzed`. They are stored with the message that cites them.

## Rules engine — `src/lib/coach/rules.ts` (pure)

`evaluateRules(snapshot)` returns `Recommendation { id, priority, title, body, citations, action: { label, href }, group }`, sorted by
priority. Citations, and inline `[metric.id]` tokens in `body`, are filtered to metrics that exist in the snapshot.
`weeklyPriorities(recs, 3)` returns the top 3, one per group. There are 30 rules:

| id | fires when |
|---|---|
| `first-application` | No applications logged yet |
| `finish-setup` | Onboarding not completed, so targets may be defaults |
| `interview-soon` | A pending interview within 7 days with prep not marked complete (priority 98 within 48 h) |
| `interview-practice` | Interview within 7 days and prep already done: suggest a mock interview |
| `offer-decision-due` | An open offer with a decision date within 3 days |
| `offer-negotiation` | At least one open offer: evaluate and negotiate (links `/salary/offers`) |
| `followups-overdue` / `followups-today` | Follow-up backlog |
| `volume-behind` / `today-target` / `volume-on-target` | Volume vs the weekly/daily target |
| `strongest-category` | Best job category (n ≥ 5) beats the overall rate: reallocate some volume; body has the interval and n, and flags overlapping intervals as "could still be chance" |
| `weakest-source` | A source with n ≥ 10 whose interval doesn't overlap the best source's |
| `best-resume` | One résumé version (n ≥ 5) has a better response rate than another |
| `low-response-rate` | Response rate under 10% after ≥ 30 applications: résumé/targeting review |
| `bottleneck-screening` / `bottleneck-interviews` | ≥ 5 responses with < 25% reaching interviews / ≥ 3 interviews and no offer |
| `stale-applications` | Submitted applications quiet for 21+ days: follow up or mark No Response |
| `apprenticeship-open` | Verified OPEN programs (with a check date) the user hasn't applied to |
| `apprenticeship-unverified` | Saved programs with unverified status: check the site, with the last-checked date |
| `apprenticeship-research` | Open to apprenticeships but no program saved |
| `academy-start` / `academy-momentum` / `quiz-review` | No lessons yet / 7+ idle days / latest quiz not passed |
| `hours-unverified` / `hours-logging` | Self-reported hours with nothing verified / nothing logged for 14 days |
| `rest-day` | 6+ consecutive active days |
| `small-sample` | Fewer than 10 applications: rates are not reliable yet |
| `resume-missing` | No résumé version saved |
| `campaign-closing` | Seven or fewer days left in the campaign |

## Chat providers — `src/lib/coach/service.ts`

`sendCoachMessage(userId, { text, applicationId?, role? }, { now?, llm? })` routes a message, runs the provider, and
persists both `CoachMessage` rows in one transaction.

- **Mock interview running** (the last assistant message holds an active `interview` state less than 6 h old): the message is treated
  as the answer. "skip" and "stop" are commands. The banks have 6 questions each for `apprentice-electrician`,
  `construction-coordinator` and `maintenance-technician`. Feedback is a STAR keyword heuristic plus key-point coverage
  (`mock-interview.ts`), and every piece of feedback is labelled "not a hiring prediction".
- **Tool intents always use RULES**, even when Claude is configured. Each has a deterministic, fact-preserving tool:
  - Follow-up email draft (`drafts.ts`).
  - Cover-letter skeleton: placeholders for unknowns; résumé terms appear only as prompts.
  - Résumé tailoring (`resume-tailor.ts`): keyword gap analysis and suggestions that only move or reword existing lines. Equivalent-term swaps such as LOTO → "lockout/tagout (LOTO)" are allowed. A tailored copy is built from the résumé's own lines. Everything is checked by `usesOnlyResumeFacts` (no new words or numbers).
  - Résumé alignment across recent postings.
  - Skill gaps: posting requirements missing from the résumé, plus the least-covered Academy tracks.
  - Apprenticeship comparison: database rows, verified-open first, with verification text.
  - Salary progression: targets, offers and the wage text in the program directory, plus links to `/salary/compare` and `/salary`.

  When an application is needed and none is selected, the text is matched against the user's own active applications. If that is ambiguous or nothing matches, quick replies are offered. An `applicationId` belonging to someone else is never loaded: lookups use `{ id, userId }`.
- **Open questions** (how am I doing, what should I do today, bottlenecks, best-fit roles, anything unrecognised) go to the
  **ANTHROPIC** provider when `ANTHROPIC_API_KEY` is set. Otherwise the RULES answer is used, and "help" always stays on RULES.
  - Request (`anthropic.ts`): `client.beta.messages.create({ model: "claude-opus-5-5", max_tokens: 16000, output_config: { effort: "medium" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", system: SYSTEM_PROMPT, messages }, { timeout: 120_000, maxRetries: 1 })`.
    - No temperature, top_p, top_k or `thinking` is sent.
    - The SDK 1.1.0 types accept every field, so no casts are needed.
    - The second argument is SDK request options, not API parameters.
  - `SYSTEM_PROMPT` (`prompt.ts`) is a fixed string. It requires `[metric_id]` citations, forbids invented facts, outcomes and promises, makes external communication draft-only, and treats only verified OPEN programs as open.
  - The metrics JSON is sent in the final user turn. Up to 10 previous turns go along as plain text.
  - A `refusal` stop reason, an empty answer, or any error falls back to the RULES answer with a visible notice. Errors are caught most-specific first: `AuthenticationError` → `RateLimitError` → `BadRequestError` → `APIError` (including connection errors) → anything else.
  - Citations are parsed with `extractCitations`, and unknown ids are dropped from the text and the list.
  - Rate limit: at most 20 ANTHROPIC answers per user per rolling hour. This is a durable count of `CoachMessage` rows plus the in-process `rateLimit` attempt limiter. Over the limit, the RULES answer is shown with a notice.
- The client is injectable (`llm: LlmClient | null`), so tests use fakes and never touch the network.

Stored message format (`CoachMessage.metrics`, parsed defensively by `messages.ts`):
`{ v: 1, kind, citations: CitedMetric[] (frozen label/display/basis/n/interval at answer time), notice?, actions?, quickReplies?, drafts?, interview?, context?, model? }`.
The `provider` column is "RULES" or "ANTHROPIC". The user row gets the provider that answered it.

## Weekly reports — `src/lib/reports/weekly.ts` (server-only), `week.ts` / `csv.ts` (pure)

- A week runs Monday–Sunday in the profile timezone, and is compared with the previous week.
- Day assignment uses `instantDateKey`: date-only values by their UTC date, timestamps in the user's timezone.
- Rows (`key`, this week, prior week, change, basis, unit):
  - Applications: `applications.applied` (with the weekly target) and `applications.active_days`.
  - Responses and interviews:
    - `funnel.responses`, `funnel.interviews` and `funnel.offers` count applications whose *first* signal of that stage fell in the week. Signals come from status history, events, Interview rows and Offer rows.
    - `interviews.scheduled` counts interviews on the calendar (cancelled ones excluded).
    - `interviews.attended`.
  - Follow-ups: `followups.sent` (FOLLOW_UP_SENT events).
  - XP and missions: `progress.xp` (net, so revocations are subtracted) and `progress.missions`.
  - Academy: `learning.lessons`, `learning.quiz_attempts` and `learning.quizzes_passed`, plus the average score.
  - Work hours: `hours.self_reported` and `hours.verified`.
- Also stored:
  - The cumulative funnel (applied, responded, interviewed and offers, with response and interview rates, n and intervals) as of each week's Sunday.
  - The titles of the missions completed.
  - The top 3 recommendations **as of generation time**, with their cited metrics frozen.
- All non-merged applications count, archived included (archiving hides a record; it does not undo it).
- Persistence: `WeeklyReport (userId, weekStart)` is upserted, and a race on the unique key falls back to an update.
  - `getWeeklyReport(userId, week, { now, regenerate })` recomputes the **current week on every call**.
  - A **past week is computed once** (on the first view, generation or download) and then served frozen. It is recomputed only with `regenerate: true`, which is the "Regenerate" button.
  - `complete = generatedAt ≥ end of the week`. A report frozen mid-week says so and invites a regenerate.
- `data.version = 1`. `readReportData` ignores rows with an unknown version, and they are recomputed.

## Public API (for integration)

- `getCoachSnapshot(userId, now?)`, `loadCoachFacts`, `buildSnapshot(facts)`, `citeMetrics(byId, ids)`, `programMetricId(p)`.
- `evaluateRules(snapshot)`, `weeklyPriorities(recs, n=3)`, `RULES`, `RULE_IDS`.
- `sendCoachMessage(userId, input, deps?)`, `listCoachMessages(userId, limit?)`, `clearCoachMessages(userId)`, `listApplicationChoices(userId)`,
  `latestResume(userId)`, `LLM_HOURLY_LIMIT`.
- `askClaude(client, { snapshot, history, question })`, `defaultLlmClient()`, `llmConfigured()`, `SYSTEM_PROMPT`, `buildMessages`.
- `analyzeFit(jd, resume)`, `tailoredResumeDraft(resume, fit)`, `usesOnlyResumeFacts`, `aggregateGaps`, `extractKeywords`.
- `followUpEmail(app, opts)`, `coverLetter(app, opts)`; mock interview: `QUESTION_BANK`, `evaluateAnswer`, `continueInterview`.
- `listResumes`, `saveResume` (fires the `RESUME_UPDATED` mission hook + achievements in the same transaction; no direct XP), `setDefaultResume`,
  `deleteResume`.
- `computeWeeklyReport(userId, weekStart, now?)`, `getWeeklyReport(userId, weekStart, opts?)`, `listReportWeeks(userId, now?)`, `weeklyReportCsv(data)`.
- Server actions:
  - `sendCoachMessageAction`, `clearCoachHistoryAction`, `saveResumeAction`, `deleteResumeAction` and `setDefaultResumeAction` (`src/lib/coach/actions.ts`).
  - `generateWeeklyReportAction` (`src/lib/reports/actions.ts`, which redirects to the report).
- Components:
  - `PrioritiesCard`, `MetricChip`, `RichText`, `ChatPanel`, `MetricsCard`, `ResumeManager` and `CoachTabs`.
  - `ReportView`, `WeekList`, `GenerateReportForm`, `PrintButton` and `ReportsTabs` (`ANALYTICS_SECTION_TABS`: Overview | Forecast | Weekly reports).

## How to test

```sh
npx vitest run tests/unit/coach-*.test.ts tests/unit/reports-*.test.ts   # 8 files, 112 tests
npx tsc --noEmit 2>&1 | grep -E 'coach|reports'                           # clean
npx eslint src/lib/coach src/lib/reports src/components/coach src/components/reports \
  "src/app/(app)/coach" "src/app/(app)/analytics/reports" src/app/api/reports tests/unit/coach-*.test.ts tests/unit/reports-*.test.ts
```

- `coach-rules`:
  - The snapshot has unique ids, honest program status, and n ≥ 5 grouping.
  - All 30 rules fire under their conditions, with valid citations, sorting and top-3 grouping.
  - Replies use the example tone, cite metrics, and stay honest.
- `coach-tools`: intents, citation parsing (placeholders and links untouched), rich text, the STAR heuristic, interview state, tailoring (rewrites and the tailored draft pass the fact check; ordinary words such as "excel at" are not swapped), drafts and message parsing.
- `coach-anthropic`: the exact request shape, citations kept or dropped, refusal and empty answers, and the six error classes mapped most-specific first. All of this runs with a fake client.
- `coach-service` (DB):
  - The snapshot counts come from seeded data.
  - The RULES path persists messages; a fake Claude client parses citations, and a refusal falls back.
  - The hourly limit holds, tools never call the LLM, and another user's application is never loaded.
  - Tailoring stores `fit.score`, and the mock interview spans several messages.
  - Clearing the history works, and résumé CRUD is limited to the owner.
- `reports-weekly` (DB, a seeded week):
  - Every row matches this week vs the prior week, including XP revocation, a date-only application date and verified vs self-reported hours.
  - Past weeks freeze until regenerated, the current week recomputes, and there is exactly one row per week.
  - The week listing, CSV sanitization, and the route (401/400/404, CSV/JSON headers, audit entry, owner-only) are covered.
- `coach-render` / `reports-render` / `coach-page-render`: `renderToStaticMarkup` smoke tests for every component and page, using mocked loaders.

Manual check once the app builds:
1. Visit `/coach` as a new user. Priorities show "Log your first application" and "Add your résumé".
2. Add a résumé under Résumés.
3. Log applications with job descriptions.
4. Ask "Tailor my résumé" and pick the application.
5. Try "Mock interview" and choose a role.
6. Open `/analytics/reports`, generate this week's report, then download the CSV.

## Known gaps / notes

- When no `ANTHROPIC_API_KEY` is configured (the default in this sandbox), every answer comes from the rules engine. The ANTHROPIC path is
  covered only with a fake client: no live call was made here, because outbound network is blocked.
- The in-process attempt limiter is per Node process. The durable limit is the `CoachMessage` count, which also holds across instances.
- Résumé tailoring is a keyword heuristic over pasted text, using a trade-term dictionary of equivalent terms. It does not parse PDF or DOCX
  (`ResumeVersion.fileName` is shown but not used).
- Weekly-report recommendations reflect the user's data at generation time, not the state during that week; the UI says so.
- Program comparison and "explain salary progression" depend on the directory being seeded (`npm run db:seed`, academy-records). With an
  empty directory they say so.
- The forecast module (`src/lib/forecast`) is not imported, so the Advisor works whether or not it exists. Its page is linked from the analytics tabs.

## Shared change requests (not made — outside my paths)

1. `src/app/(app)/analytics/page.tsx`: render `<ReportsTabs />` (from `@/components/reports/reports-tabs`) right after the `PageHeader`, in both
   branches, so Overview, Forecast and Weekly reports are reachable from `/analytics`. Today `/analytics/reports` is linked from the Coach header
   and from the report pages only.
2. `src/components/forecast/nav.ts`: add `{ href: "/analytics/reports", label: "Weekly reports" }` to `ANALYTICS_TABS` so `/analytics/forecast`
   shows the same three tabs, or switch that page to `ANALYTICS_SECTION_TABS`.
3. Optional (dashboard owner): show `weeklyPriorities(evaluateRules(await getCoachSnapshot(userId)), 1)` as the Command Center's
   next-best action, so the dashboard and the Advisor agree.
