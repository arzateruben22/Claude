# ingest-engine — matching, ingestion engine, duplicates, review queue

Owner paths: `src/lib/ingest/**` (types.ts extended additively only), `src/lib/dedup/**`,
`src/app/(app)/applications/review/**`, `src/components/review/**`,
`tests/unit/{ingest,dedup,review}*.test.ts`, this file. No shared files were changed.

## What was built

| File | Purpose |
|------|---------|
| `src/lib/ingest/types.ts` | Additive only: `ApplicationObservation.interviewType?`, `IngestOptions.forceCreate?`, `IngestOptions.statusOverride?`. |
| `src/lib/ingest/match-score.ts` | Pure scoring: `scoreMatch(a, b, ctx)`, `decideMatch(candidates)`, `companySimilarity`, `titleSimilarity`, `locationKey/locationAgreement`, `normalizeRequisition`, `subjectFromApplication/subjectFromPartial`. |
| `src/lib/ingest/match.ts` | `findCandidateMatches(db, userId, partial, { limit, minScore, excludeIds })` (server-only). |
| `src/lib/ingest/rules.ts` | Pure: `targetStatusFor`, `isPlatformConfirmation`, `kindForStatus`, `parseSalaryText`, `guessInterviewType`, `sanitizeObservation`, typed errors `IngestNotFoundError` / `IngestValidationError`. |
| `src/lib/ingest/engine.ts` | `ingestObservation`, `ingestObservationInTx`, `observationFromCapture`, `observationFromEmailRow`, `partialFromObservation`, `isStatusProgress`, `lockUserIngestion`. |
| `src/lib/ingest/review.ts` | Review-queue loaders (`loadEmailReview`, `loadCaptureReview`, `loadDuplicateReview`, `loadAttachOptions`, `getReviewCounts`) and resolvers (`resolveEmailReview`, `resolveCaptureReview`, `resolveInterviewInvite`), `ReviewError`. |
| `src/lib/ingest/review-actions.ts` | `"use server"`: `resolveEmailReviewAction`, `resolveCaptureReviewAction`, `resolveInterviewInviteAction`, `resolveDuplicateAction`, `scanDuplicatesAction`. |
| `src/lib/ingest/review-schemas.ts`, `review-view.ts` | zod form schemas + `parseDecision`; serializable view models and labels (client-safe). |
| `src/lib/dedup/pairs.ts` | Pure: `findDuplicatePairs` (blocking + scoring), `shouldAdoptMergedStatus`, `suggestKeep`, `orderedPair`. |
| `src/lib/dedup/scan.ts` | `scanDuplicates(userId)`. |
| `src/lib/dedup/merge.ts` | `mergeApplications`, `mergeDuplicateCandidate`, `dismissDuplicate`, `DuplicateError`. |
| `src/app/(app)/applications/review/{layout,page,captures/page,duplicates/page}.tsx` | Review queue UI (LinkTabs: Emails · Captures · Possible duplicates, with counts). |
| `src/components/review/*` | Client cards (email, capture, duplicate, interview invitation), scan button, shared parts, `useReviewForm`. |

## Routes
- `/applications/review` — emails with `reviewStatus = NEEDS_REVIEW` (25 newest), plus "Interview times to add": automatically filed (AUTO_ACCEPTED, unverified) interview invitations linked to a record whose time (≥ now − 14 days) has no interview yet.
- `/applications/review/captures` — `ExtensionCapture` rows with `PENDING_CONFIRMATION`.
- `/applications/review/duplicates` — `DuplicateCandidate` rows with `PENDING` (both records not merged), "Scan for duplicates".

## Matching (`findCandidateMatches` + `scoreMatch`)
Queries (all `userId`-scoped, `mergedIntoId = null`, bounded): explicit id; requisition (`requisitionNumber IN [raw, UPPER]`, index userId+requisitionNumber); `normalizedUrl` equality (index); email thread (other EmailMessage rows of the same `threadId` with an `applicationId`); `ApplicationSourceLink.url IN [raw, normalized]` joined to the user's applications; company equality or first-word prefix (`normalizedCompany` index, LIKE prefix works because the DB collation is `C.UTF-8`), up to 100; the user's 30 most recent records. Source-link URLs of every loaded candidate are also compared after `normalizeUrl`.

Scores: explicit 1.0; same requisition + same normalized company 1.0 (similar company ≥ 0.85: 0.96); same normalized URL 0.98; linked email thread 0.97; saved source link 0.97. Fuzzy (only when company similarity ≥ 0.85): `0.30 + 0.20·c + 0.45·title²` (title unknown on one side: +0.18), location same +0.03 / different −0.25, dates ≤ 21 days +0.02 / > 180 days −0.07 / > 365 days −0.15, conflicting requisitions −0.35, different postings on the same host −0.10, capped at 0.96. Titles compare order-insensitively; explicit levels ("Electrician I" vs "II") cap title similarity at 0.6. A leading multi-word company prefix ("southland electrical" / "southland electrical jatc") scores ≥ 0.88 (review band, never sure alone).
Decision: top ≥ 0.9 and ≥ 0.1 above the runner-up → match; top ≥ 0.65 → review with candidate ids; else none.

## Engine (`ingestObservation`) — one transaction per observation
1. `sanitizeObservation` (enums, trimmed/capped strings, http(s) URLs only, confidence clamped, future `observedAt` → now). Per-user advisory lock (`pg_advisory_xact_lock`), so concurrent deliveries cannot create two records for one job (tested).
2. Explicit `applicationId`: ownership checked before any write (follows `mergedIntoId`, ≤ 5 hops); otherwise `IngestNotFoundError`.
3. `APPLY_STARTED`: never writes anything; returns `ignored` (with the sure match's id, if any).
4. Evidence first: `createMany(skipDuplicates)` on `(userId, kind, sourceRef)`. Existing evidence already attached → `duplicate`, no side effects.
5. Confidence < 0.45 (no explicit target) → `ignored` (evidence it just inserted is removed). Matching as above; review band → `needs_review` + `candidateIds` (evidence kept unattached for the review queue). A match below the auto-apply threshold (0.8 or `opts.autoApplyThreshold`) → `needs_review`.
6. Match → `changeStatusInTx(source = obs.source, verified = obs.verified, evidenceId)`, `fillEmptyFieldsInTx` (location, requisition, posting URL, recruiter, salary parsed from `salaryText`), `addSourceLinkInTx`, evidence attached, `lastSyncedAt`. Two engine policies on top of the service:
   - **Unverified progress over a verified stage** (the service refuses it) → `needs_review` with that record as the candidate, nothing applied; the user's review re-ingests it verified. Stale/backward evidence is just attached (`updated`, `statusApplied: null`, reason says why).
   - **Older evidence never reopens a closed record** (terminal → open stage when `observedAt` < `statusUpdatedAt`), even when reviewed.
7. No match → create only for `CREATING_KINDS`, confidence ≥ threshold (or `forceCreate`), company and title present (otherwise `needs_review`; `allowCreate: false` → `needs_review`). Status mapping: JOB_SEEN→Saved; SUBMITTED→Submitted, or **Confirmed** for a verified platform confirmation (email classified APPLICATION_SUBMITTED from a job board/ATS, an extension confirmation page, or PLATFORM_API); USER_CONFIRMED_SUBMISSION→Submitted; ACKNOWLEDGED→Confirmed; RECRUITER_RESPONSE / ASSESSMENT_INVITED→Screening; INTERVIEW_INVITED→Interviewing; REJECTED, OFFER as named; ONBOARDING→Accepted. `statusOverride` (review queue) replaces the mapping. The application date is the observation date for statuses that imply a submission. Created via `createApplicationInTx(origin, { source, verified, evidenceId })`; `detectionConfidence` stored.
8. Interview invitations: the stage's `INTERVIEW_SCHEDULED` milestone recorded by the service gets the time on its payload when it was created in this transaction (`scheduledAt`, `scheduledFor` — marked "not confirmed" when unverified). An `Interview` row is created only when `obs.verified` (reviewed); for an already-interviewing record a verified invite gets its own `INTERVIEW_SCHEDULED:<interviewId>` event. The time is also kept on `Evidence.data.interviewAt`.
9. XP only through the service/event recording; `xpAwarded` reported.

Converters: `observationFromCapture` (JOB_PAGE/SHARED_URL→JOB_SEEN, APPLY_STARTED→APPLY_STARTED, CONFIRMATION_PAGE→SUBMITTED verified iff confidence ≥ 0.9, MANUAL_CONFIRMATION→USER_CONFIRMED_SUBMISSION verified; evidence `EXTENSION_CAPTURE` / `capture:<id>` / snippet = `evidence.confirmationText`; observedAt = `evidence.capturedAt` when valid and not in the future). `observationFromEmailRow` = `deserializeObservation(extracted.observation)` or null.

## Duplicates
- `scanDuplicates(userId)`: newest 5,000 non-merged records; blocks by posting URL (own + source links), requisition, 4-char company prefix and linked email threads; pairs ≥ 0.65 stored as `DuplicateCandidate` (A id < B id, signals JSON `{ signals, deterministic, scannedAt }`). PENDING rows are updated in place, DISMISSED/MERGED pairs are never re-proposed, stale PENDING rows are deleted. Returns `{ scanned, found, created, updated, removed, skipped }`.
- `mergeApplications(userId, keepId, mergeId)` (one transaction, per-user lock, audit `applications.merge`): ownership + not-merged checks; revoke merged record's XP (`revokeXpForSource`); events move under the kept record's keys (`<mergeId>:X` → `<keepId>:X`; a milestone the kept record already has keeps its history as `merged:<mergeId>:<key>`, and a duplicate APPLIED decrements that day's `DailyActivity.applicationsSubmitted`); status history, interviews, offers, evidence, emails, captures, leads and earlier merges move; source links move or fold into equivalent ones, and the merged record's own platform/URL becomes a link; empty fields filled (incl. appliedAt, follow-up, documents, recruiter contact linked as-is, notes appended); a further-along stage is adopted with `changeStatusInTx(..., "SYSTEM", merge.statusVerified)` (the service refuses overriding verified data with unverified); XP the combined record should hold is restored (`awardXp`, stable keys: `xp:submitted:<fingerprint>`, `xp:<keepId>:<REASON>`, interview keys; never a second award for a slot the kept record already holds; no activity date so daily XP/streaks are not double counted); merged record gets `mergedIntoId` + `archivedAt`; `MERGED` event on the kept record; candidate pair → MERGED, other pending pairs with the merged record deleted, "not a duplicate" decisions carried over.
- `dismissDuplicate(userId, candidateId)` → DISMISSED. `mergeDuplicateCandidate(userId, candidateId, keepId)` validates the pair.

## Review queue decisions
"Create new application" (`forceCreate`), "Attach to this record" / "Or attach to another application" (explicit `applicationId`), each re-ingesting with the user's edits (company, title, location, stage, interview time/type) and `verified = true`; the event source stays EMAIL / EXTENSION. The queue row is updated in the same transaction (email → CONFIRMED + applicationId + stored observation/ingest outcome; capture → ACCEPTED or DUPLICATE). "Not an application": email → DISMISSED / capture → DISMISSED, unattached evidence for it deleted. `purgeReviewedBodies(userId)` runs after every email decision. Duplicates: "Merge into the selected record" (keep choice preselected via `suggestKeep`) / "Not a duplicate". Interview invitations: "Add interview" (`scheduleInterview`) / "Not needed" (email marked CONFIRMED). Enter in a text field never submits (disabled hidden default button); buttons carry the decision via the submitter.

## How to test
```sh
npx vitest run tests/unit/ingest-*.test.ts tests/unit/dedup-*.test.ts tests/unit/review-*.test.ts
```
- `ingest-match-score.test.ts` (pure): Indeed→Workday same job (sure), same company/different title (no match), same title/different location (review), staffing agency vs client (no fuzzy match; same posting link 0.98), "Acme Electric Inc" vs "ACME Electric", requisition equality/conflict, missing title, levels, date and same-board penalties, deterministic signals, margin rule.
- `ingest-rules.test.ts` (pure): mapping, platform confirmation, salary/interview parsing, validation.
- `ingest-engine.test.ts` (DB): create/duplicate/match, review routing, refusals, APPLY_STARTED, explicit foreign id, interviews (unverified/verified), progress-over-verified → review → reviewed apply, older evidence never reopens, forceCreate/statusOverride, concurrency (one record), capture/email converters.
- `ingest-email-acceptance.test.ts` (DB, real `processRawEmail` + real `ingestObservation`): 001+011 → one Confirmed record, 2 evidence, 25 XP once, re-run unchanged; 003+014 → 014 queued (confidence 0.75), review offers the Workday record at 1.0, attach → one record, 2 evidence, 25 XP once, re-run unchanged; 025 rejection → Rejected with source EMAIL (019 queued for review); 034–040 → nothing created; user-confirmed Interviewing + DMARC-failed (unverified) submission → no downgrade.
- `dedup-pairs.test.ts` (pure), `dedup-merge.test.ts` (DB): Indeed SAVED + Workday SUBMITTED → one SUBMITTED record, history/links/evidence preserved, 25 XP total, merged record gone from lists; reverse keep; restored award when the merged record held it; interview XP moves; dismiss never re-proposed; guards.
- `review-resolve.test.ts` (DB): loaders and decisions; `review-actions.test.ts` (schemas + action wiring); `review-render.test.ts` (cards, pages, layout, empty states).

Verification: `npx tsc --noEmit` → no errors in owned paths; `npx eslint` on owned paths → clean; owned suites 9 files / 91 tests passing. Full suite: 1297/1299; the 2 failures are in `career-map-status` / `skills-render` (other engineers' in-progress files).

Corpus check (all 40 fixtures through the real pipeline + engine, in file order): 14 records, one per story in the fixture README; 0 false duplicates on a scan; alerts/unfinished/invitations/newsletter stored only; 014 and 028 queued (confidence < 0.8); 8 recruiter/interview/assessment emails queued because they would move a verified stage forward without verification.

## Integration notes
- Email sync/import: `processRawEmail(userId, raw, ctx, ingestObservation)` — the signature matches `IngestFn` directly.
- Extension capture API (`/api/extension/captures`): store the capture row, then `ingestObservation(userId, observationFromCapture(capture), { allowCreate })`; on `needs_review` keep it `PENDING_CONFIRMATION` (the review page shows it), on `created/updated` set `ACCEPTED` + `applicationId`, on `duplicate` `DUPLICATE`; `IngestResult.applicationId` of an `ignored` APPLY_STARTED is the "already tracked" record.
- CSV/URL imports: build observations with `evidence.kind = CSV_ROW | URL` and a stable `sourceRef` (row hash / normalized URL).
- `IngestNotFoundError` / `IngestValidationError` / `DuplicateError` / `ReviewError` are typed for route handlers.

## Known gaps
- Because the applications service treats evidence-verified stages like user-confirmed ones, most recruiter/interview/assessment emails after a verified platform confirmation go to the review queue (one click to attach). See shared change request.
- Out-of-order history imports (newest first) date a record by the first evidence processed; a later, older confirmation does not move `appliedAt` back.
- Recruiter mail that creates a record (no match) is Screening, which implies a submission (APPLIED event + XP) per the mapping; cold outreach without a prior application can therefore create an "applied" record when the confidence is ≥ 0.8 (fixture 017 does).
- The review page shows the 25 newest/strongest items per tab (no paging UI); a note says when more exist.
- `ApplicationSourceLink.url` and `EmailMessage.threadId` have no indexes; the lookups are bounded by the user's own rows but scan them.
- Mission progress already credited for a merged duplicate is recomputed from data on the MERGED event (missions use distinct positions), but `DailyActivity` counters other than the duplicate-APPLIED decrement are not rewritten.
