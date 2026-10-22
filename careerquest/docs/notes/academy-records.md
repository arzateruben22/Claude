# academy-records — apprenticeship directory, work hours, documents, certification tracker, seed

## What was built

### Reference-data seed
- `prisma/seed.ts` (`npm run db:seed` → `tsx prisma/seed.ts`): builds a PrismaClient with the pg adapter (relative
  imports only, `dotenv/config` for `.env`) and calls `seedReferenceData()`.
- `src/lib/seed/{schema,load,run}.ts` (relative imports, no `server-only`, usable from tsx and the app):
  zod validation of `data/seed/apprenticeship_programs.json` (by `slug`) and `certification_requirements.json`
  (by `code`); invalid entries and duplicate keys are skipped with messages, never fatal. Upserts in one transaction,
  never deletes (a program dropped from the JSON keeps its row so saved interests survive), never touches user data.
  Logs created/updated/total counts.
- Honesty enforced at seed time: `OPEN` without a verification date and a source URL is stored as `UNVERIFIED`;
  `startingWageVerified` without wage text is stored as `false`; `verifiedOn` is the seed's calendar day (UTC midnight).
- Verified: `npx dotenv -e .env.test -- tsx prisma/seed.ts` run twice (6 programs / 5 requirements; second run
  0 created, 6 + 5 updated). `npm run db:seed` was also run once against the dev DB (reference rows only).

### `/academy/apprenticeships` and `/academy/apprenticeships/[slug]`
- Directory with region + union GET filters (URL state, works without JS), program cards and a detail page:
  outbound apply/website links (`target=_blank rel="noopener noreferrer"`, http(s) only), eligibility, process
  steps (caveat lines flagged "Unverified"), duration, classroom hours, starting wage **only** when
  `startingWageVerified` (otherwise "Not verified — contact the program"), fees ("Not stated in official sources —
  ask the program" when null), contact (tel:/mailto:), recruitment badge (Open only if seeded OPEN; Closed;
  "Unverified — check the program site"), recruitment note, last-verified date and sources.
- Per-user tracker (`UserProgramInterest`): status INTERESTED → APPLIED → TESTING → INTERVIEWING → WAITLISTED →
  ACCEPTED / DECLINED, applied date (not in the future), notes, remove. Checklist JSON generated from eligibility +
  process steps + standard documents (diploma/GED, algebra transcript, photo ID, résumé, DMV printout only when the
  program lists one); requirements the research marked unverified become "Ask the program: …". Item ids are stable
  hashes so ticks survive regeneration. Ticks are optimistic (`useOptimistic`).
- Every write runs `applyEventToMissions(PROFILE_UPDATED)` and `evaluateAchievements` in the same transaction
  (ACCEPTED unlocks "Apprenticeship Accepted" immediately).

### `/academy/hours`, `/academy/hours/[id]`, `GET /academy/hours/export`
- `WorkHourEntry` CRUD: employer, supervisor, date (not in the future), hours 0.25–24 in quarter-hour steps, ≤ 24 h
  per date across entries (checked under the player row lock), work type, optional program, description,
  verification. EMPLOYER_VERIFIED / OFFICIAL_RECORD require an attached document of the user's (PAY_STUB,
  HOURS_VERIFICATION or OTHER — chosen from uploads or uploaded with the entry); without one the entry is saved as
  SELF_REPORTED and the message explains why.
- Self-reported and verified totals are always shown side by side. **Classroom instruction (work type CLASSROOM)
  is kept out of the on-the-job totals**, charts, projection, caps estimate and milestones, and is shown in its own
  "Classroom milestones" card (verified vs self-reported; this year vs "at least 150 h/year" and total vs "720 h of
  related and supplemental instruction", both parsed from the seed facts and omitted if the text is missing).
- General Electrician "estimated countable hours" with per-area caps parsed from the seeded requirement notes
  (defaults per area when missing), for verified and for all logged hours, labelled "Estimate — DIR decides
  eligibility"; two-area rule warning; unmapped work types (solar PV, other) listed as not counted; lighting is
  counted under the stricter finish-work & fixtures cap.
- Charts (Recharts, chart tokens, sr-only tables): weekly hours (last 12 weeks, verified vs self-reported, reuses
  `BarSeriesChart`) and cumulative verified vs self-reported vs the requirement line.
- Projection: trailing 8-week verified average (history window when 4–8 weeks), "Not enough data" under 4 weeks of
  verified history, "No recent hours" when the window is empty; always labelled Estimate.
- Requirement tile: "Commonly cited for General Electrician, subject to official DIR rules · last verified
  Oct 21, 2026" (from the seeded requirement; a fallback 8,000 is shown as unverified if the table and seed file are
  both unavailable).
- XP: WORK_HOURS_LOGGED once per entry (`xp:hours-entry:<id>`, sourceType `WorkHourEntry`), never re-awarded on
  edit, revoked on delete. TRAINING_MILESTONE at verified on-the-job 1,000/2,000/4,000/6,000/8,000
  (`xp:hours-milestone:<n>`, sourceType `WorkHourMilestone`): dropping below a milestone (delete, downgrade, proof
  document deleted) revokes it; re-crossing earns it once more, so the net is never more than one award. Every write
  calls `applyEventToMissions(WORK_HOURS_LOGGED)` + `evaluateAchievements` in the same transaction.
- CSV export (papaparse, formula-trigger cells prefixed with `'`, BOM, `Content-Disposition: attachment`), audited
  (`hours.export`), rate limited, 401 JSON when signed out.

### Documents (`src/lib/documents/**`, `GET /api/documents/[id]`)
- Upload server action `uploadDocumentAction` (and inline uploads in the hours and certification forms):
  ≤ 10 MB, extension allowlist pdf/png/jpg/jpeg/webp, magic-byte sniffing, the sniffed type must match the
  extension (a PNG named `.pdf` is rejected), MIME stored from the bytes, display name sanitized, random storage
  name `ab/<48 hex>.<ext>` under `UPLOAD_DIR` (default `./uploads`, git-ignored; dirs 0700, files 0600, `wx`),
  sha256 stored. Size/extension are checked before the bytes are read.
- Owner-only download: session auth (401 signed out), 404 for anyone else / unknown / missing file, always
  `Content-Disposition: attachment` (RFC 6266 + RFC 5987 name), `X-Content-Type-Options: nosniff`,
  `Cache-Control: private, no-store`, `Content-Security-Policy: default-src 'none'; sandbox`.
- Delete removes the row and then the file; entries the document verified become SELF_REPORTED (milestones,
  missions, achievements re-synced) and a certification it verified is un-verified (XP revoked). Audited.
- Generic `saveDocument(userId, kind, file)` / `saveFormFile` accept any `DocumentKind`, so the résumé module can
  store RESUME documents.

### `/academy/certification`
- CertificationStatus per classification (default GENERAL; `?c=RESIDENTIAL` etc. from the seeded requirements):
  trainee registration + expiry, approved school, exam application, eligibility notice, exam scheduled/passed,
  certified date + expiry. Past-only dates cannot be in the future; chronology is validated.
- Timeline with states and estimates (trainee renewal = registration + 1 year when no expiry is entered; exam
  window = eligibility + 365 days; certification renewal = certified + 3 years). Reminders: trainee renewal within
  60 days/overdue, exam window closing, certification renewal window (≤ 365 days, urgent ≤ 90) with the 32-hour
  continuing-education reminder.
- Eligibility estimate: verified on-the-job hours vs the classification's required hours (+ caps estimate for
  GENERAL), self-reported excluded and said so; "Estimate — DIR decides eligibility".
- "Verified certification" requires a recorded certified date + a CERTIFICATE document (pick an upload or upload
  inline) → CERTIFICATION_VERIFIED XP once (`xp:certification:<code>`, sourceType `CertificationDocument`, sourceId
  `<code>:<documentId>`), labelled "Self-attested with document — CareerQuest does not check state records".
  Removing the mark, clearing the certified date or deleting the document revokes it; switching documents keeps the
  net award at one. The schema has no document column on CertificationStatus, so the active ledger row is the link.
- Certificate / trainee-card uploads and DIR links (dir.ca.gov only, from `certification_facts.json` via the
  Academy roadmap loader).

## Public API (for other modules)
- `seedReferenceData(db, { dataDir?, log? })`, `loadProgramSeeds()`, `loadRequirementSeeds()`, `parseProgramSeeds()`,
  `isHttpUrl()` — `src/lib/seed/*`.
- `saveDocument(userId, kind, { name, size, bytes })`, `saveFormFile(userId, kind, file)`, `readFormFile(formData, field)`,
  `listDocuments(userId, kinds?)`, `getOwnedDocument(userId, id)`, `deleteDocument(userId, id)`,
  `documentDownloadResponse(userId, id)` — `src/lib/documents/service.ts`; `documentHref(id)`, `validateUpload()`,
  `DOCUMENT_KIND_LABELS` — `src/lib/documents/validation.ts`; actions `uploadDocumentAction`, `deleteDocumentAction`.
- Hours: `createWorkHourEntry`, `updateWorkHourEntry`, `deleteWorkHourEntry`, `getHoursSummary`, `getHoursPageData`,
  `exportHoursCsv` (`src/lib/academy/hours/service.ts`); `syncHourMilestonesTx`, `afterHoursChangeTx`,
  `verifiedOjtHours` (`rewards.ts`); pure `estimateCountableHours`, `parseAreaCaps`, `projectCompletion`,
  `splitTotals`, `weeklySeries`, `cumulativeSeries`, `parseClassroomTargets`.
- Programs: `listPrograms`, `getProgramBySlug` (`directory.ts`); `trackProgram`, `saveProgramInterest`,
  `toggleChecklistItem`, `removeProgramInterest` (`interest.ts`); pure `buildProgramChecklist`, `recruitmentBadge`.
- Certification: `getCertificationPageData`, `saveCertificationStatus`, `verifyCertification`,
  `removeCertificationVerification`, `getCertificationVerification` (`service.ts`); `listRequirements`,
  `getRequirement` (`requirements.ts`, DB with seed-file fallback); pure timeline/reminders/eligibility.

## How to test
- `npx vitest run tests/unit/academy-records-*.test.ts tests/unit/seed.test.ts tests/unit/documents.test.ts`
  (6 files, 87 tests; DB suites use careerquest_test and a temp `UPLOAD_DIR`).
- Manual: `npm run db:seed`, then /academy/apprenticeships → save a program → detail page checklist; /academy/hours →
  log a self-reported entry, a "verified" entry without a document (saved as self-reported), and one with a PDF;
  export CSV; /academy/certification → enter dates, upload a certificate, mark verified.

## Known gaps / notes
- Uploads go through server actions, whose default body limit is 1 MB: files between ~1 MB and 10 MB fail until
  `next.config.ts` raises `experimental.serverActions.bodySizeLimit` (see shared change requests). The client checks
  10 MB and shows a friendly error if the request is refused.
- WorkType has no underground-conduit or stock-room value, so those DIR areas (caps 750 / 300) can only be logged as
  "Other" and are not estimated.
- `DailyActivity.trainingHours` is not written (logging past hours must not rewrite streak history); activity is
  recorded through the WORK_HOURS_LOGGED XP award dated today.
- The game module's `verifiedHoursTotal` (missions/achievements) still counts CLASSROOM hours; this module's
  totals and TRAINING_MILESTONE XP do not.
- Not opened in a browser (next dev/build not allowed in this stage); UI is covered by renderToStaticMarkup tests,
  including a label-for-every-control check. Needs a manual pass at 375 px.
- External program and DIR sites cannot be reached from the sandbox; all facts are the researched seed data with
  their verification dates.
