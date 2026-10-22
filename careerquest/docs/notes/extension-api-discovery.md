# extension-api-discovery — extension API, Job Discovery, mobile capture

Owner paths: `src/app/api/extension/**`, `src/lib/extension-api/**`, `src/app/(app)/discovery/**`
(placeholder replaced), `src/lib/discovery/**`, `src/components/discovery/**`,
`src/app/(app)/share/**`, `src/components/share/**`,
`tests/unit/{extension-api,discovery,share}*.test.ts`, this file. No shared files were changed.

## Routes

| Route | What it does |
|---|---|
| `GET /api/extension/me` | `200 { userId, name, email, scopes }`. Connection test for the extension. Any token with `capture:write` **or** `applications:read` may call it (it only describes the token's owner), so a capture-only token can still test its connection. |
| `GET /api/extension/lookup?url=&company=&title=&requisitionId=` | `200 { matches: [{ id, companyName, positionTitle, status, appliedAt, postingUrl, detailUrl }] }` — `findCandidateMatches`, top 3 with score ≥ 0.65, user-scoped. Needs `applications:read`. 400 when none of url/company/requisitionId is given, a parameter is repeated or unknown, or `url` is not http(s). |
| `POST /api/extension/captures` | `201 { capture: { id, status }, application: { id, status, detailUrl } \| null, action }`. Needs `capture:write`. Rules below. |
| `OPTIONS /api/extension/*` | `204`. `Access-Control-Allow-Origin` echoes only `chrome-extension://<32 a–p>` origins and the exact `APP_URL` origin; allowed headers `authorization, content-type`; methods `GET, POST, OPTIONS`; max-age 600; never `Allow-Credentials`. Real responses carry the same allow-origin plus `Vary: Origin` and `Access-Control-Expose-Headers: Retry-After`. |
| `/discovery` | Leads: "Paste a job URL or posting text" quick add, lead list (Active / Dismissed / In tracker), fit score with per-factor explanation, eligibility flags, "Show hidden (n)", convert / "I already applied" / keep / dismiss / restore / edit / delete. |
| `/discovery/companies` | Target companies: add/edit/remove, priority 1–3, careers/website links, count of the user's applications per company (normalized name), +5 XP once per company. |
| `/discovery/search` | Outbound search links (Indeed, LinkedIn Jobs, ZipRecruiter, Glassdoor, GovernmentJobs, USAJOBS per interest × region; CalCareers statewide), `target="_blank" rel="noopener noreferrer"`, with a plain statement that CareerQuest does not scrape job boards. |
| `/discovery/apprenticeships` | `ApprenticeshipProgram` rows via `listPrograms` (academy-records) with recruitment badge, last-checked date, unverified wage labelled, official links and a link to `/academy/apprenticeships/<slug>`. Empty table → honest empty state. |
| `/share` | Mobile capture / PWA share target (`GET ?title=&text=&url=`, already declared in `public/manifest.webmanifest`). Gated by the `(app)` layout. Paste box (plain GET form) when opened directly. |

All responses of `/api/extension/*` are JSON (`Cache-Control: no-store`, `nosniff`); errors are
`{ error }`. 401 (missing / malformed / unknown / revoked / expired token, or deleted account) adds
`WWW-Authenticate: Bearer`. 403 = missing scope. 413 body > 16 KB, 415 not `application/json`.
429 after 60 requests per token per minute (in-memory sliding window, `extension-api:<tokenId>`
bucket shared by all three endpoints): `{ error, retryAfterSeconds }` + `Retry-After`.

## POST /captures rules (`src/lib/extension-api/captures.ts`)

Validation (`schemas.ts`, zod `strictObject` at both levels — unknown keys are 400): `kind` ∈
JOB_PAGE / APPLY_STARTED / CONFIRMATION_PAGE / MANUAL_CONFIRMATION; `url` http(s) ≤ 2048;
`platform` an `ApplicationSource` value (optional/null); company/title/location/salaryText/
requisitionId ≤ 300 (whitespace-collapsed); `confidence` 0..1; `evidence = { pageTitle ≤ 300,
detectedBy ≤ 32 items × ≤ 300, confirmationText? ≤ 300, capturedAt ISO, captureId? ≤ 64 }`
(`captureId` is the extension's per-capture retry id — it must be accepted); `applicationId?` ≤ 64.

Stored evidence is rebuilt from an allow-list: page title and confirmation sentence are PII-masked
again server-side (`[email]` / `[phone]`), `confirmationText` is kept only for confirmation kinds,
`detectedBy` deduplicated. `platform` = the sent value, or `detectPlatform(url)` when missing/OTHER.

One transaction with the per-user ingestion lock (`lockUserIngestion`):

1. `applicationId` given → must be one of the user's applications, else **404**, nothing stored.
2. Idempotency → `action: "duplicate"` with the existing capture and its application: same
   `(kind, normalizedUrl, confirmationText)` within 24 h (and the same `applicationId` when one is
   given), or the same `evidence.captureId` within 7 days. Dismissed captures never count.
3. Capture row created (`PENDING_CONFIRMATION`, `tokenId`).
4. Per kind:
   - `JOB_PAGE` → `observationFromCapture` (JOB_SEEN) → `ingestObservationInTx`. Confidence is
     floored at 0.8 because the extension only sends JOB_PAGE on the user's "Save to CareerQuest"
     click; a Saved record never claims a submission. Creates a SAVED record or matches one.
   - `APPLY_STARTED` → stored only, `PENDING_CONFIRMATION`, `action: "pending_confirmation"`,
     `application: null` (shows in `/applications/review/captures`).
   - `CONFIRMATION_PAGE` → ingested when confidence ≥ 0.8 (≥ 0.9 → verified → Confirmed, per the
     engine's `CAPTURE_VERIFY_MIN_CONFIDENCE`); below 0.8 → stored `PENDING_CONFIRMATION`.
   - `MANUAL_CONFIRMATION` → USER_CONFIRMED_SUBMISSION, verified, confidence forced to 1.
5. IngestResult → capture: created/updated → `ACCEPTED` (+ applicationId, resolvedAt),
   duplicate → `DUPLICATE`, needs_review/ignored → stays `PENDING_CONFIRMATION` with
   `action: "pending_confirmation"` and `application: null` so it appears in the review queue.
   `IngestNotFoundError` → 404 (transaction rolled back), `IngestValidationError` → 400.

`detailUrl = ${APP_URL}/applications/<id>` (falls back to the request origin when APP_URL is
unset); merged records are followed to the surviving record. Every accepted POST writes
`audit("extension.capture", { tokenId, kind, platform, confidence, action, captureStatus, attached,
applicationId })` — no URL, company, title or page text; a 404 attach writes
`extension.capture.rejected` with only kind + status.

## Job Discovery (`src/lib/discovery/**`)

- `eligibility.ts` (pure): `detectEligibility(text)` → flags + matched phrases for company
  vehicle / take-home truck; driving record, valid driver's license (straight or curly apostrophe),
  MVR/DMV printout; CDL, commercial driver's license, Class A/B license. "commercial driver's
  license" sets only the CDL flag. `hiddenByFilters(lead, profile)` uses the profile's
  `excludeCompanyVehicleJobs / excludeDrivingRecordJobs / excludeCdlJobs`. Flags never reject.
- `regions.ts` (pure): county → incorporated cities (+ common community names) for LA, Orange,
  Riverside, San Bernardino, San Diego, Ventura; "<X> County" text, metro aliases ("Los Angeles
  Metropolitan Area", "Inland Empire", "OC"); any other profile region matches by its own name.
- `trades.ts` (pure): title vocabulary and board search phrases per career interest; primary trade
  → interest; `orderedInterests` (primary first).
- `score.ts` (pure): 0–100 fit = Trade 40 (primary 40 / other interest 25) + Region 25 (in region
  25, remote 10, elsewhere in CA 5) + Pay 25 (floor ≥ target 25, top ≥ target 15, top ≥ 85 % 8;
  hourly annualised × 2080 and labelled as an estimate; apprenticeship titles compare with
  `apprenticeshipMinHourly` when the user is open to apprenticeships) + Eligibility 10 (0 only when
  a flag the user filters out is present). Each factor carries a one-line reason; the UI shows
  "Fit n/100 · Estimate" and "Why n/100?" with every factor. Stored in `JobLead.matchScore` on
  create/update; the list always recomputes from the current profile.
- `paste.ts` (pure, client + server): first http(s) URL (trailing punctuation trimmed, `www.` →
  https), `normalizeUrl` / `detectPlatform`, labelled lines (Title/Company/Location/Pay), share
  headlines (Indeed "Title - Company - City, ST - Indeed.com", LinkedIn "Check out this job at …:"
  and "<Company> hiring <Title> in <City> | LinkedIn", Greenhouse "Job Application for … at …",
  Lever "Company - Title"), "Title at Company" only when it reads like a job headline, `City, CA`,
  first pay figure, eligibility flags; company/title from the URL path (`hintsFromUrl`) only when the
  text has none. No network access anywhere.
- `leads.ts`: `listLeads` (active view splits visible / hidden-by-filters, sorted by fit),
  `createLead` / `updateLead` (dedupe against the user's leads by `normalizedUrl`, or normalized
  company + title when there is no URL; against tracked applications by `normalizedUrl`; cap 2,000
  leads), `setLeadStatus` (NEW/SAVED/DISMISSED; never touches CONVERTED), `deleteLead`,
  `convertLead(userId, leadId, { mode: "saved" | "applied", attachTo?, force? })`:
  - saved → links to an already-tracked record (same normalized URL, or a sure fuzzy match), else
    returns `choose` with candidates for the 0.65–0.9 band, else `createApplicationInTx(status SAVED,
    origin URL_IMPORT)` copying location, pay (parsed), category, notes and the three flags.
  - applied → `ingestObservationInTx` with USER_CONFIRMED_SUBMISSION (source IMPORT, origin
    URL_IMPORT, verified, evidence MANUAL_NOTE `lead:<id>:applied`), attached to the lead's earlier
    conversion when there is one; `needs_review` → `choose`.
  - The lead becomes CONVERTED with `convertedApplicationId` in the same transaction.
- `companies.ts`: list (priority, name) with application counts via `groupBy(normalizedCompany)`;
  create refuses a duplicate normalized name; XP `awardXpStandalone({ reason: TARGET_COMPANY_ADDED,
  dedupeKey: "xp:target-company:<normalizedName>", sourceType: "TargetCompany", sourceId })`,
  at most 10 awards per rolling 24 h; delete revokes that XP (`revokeXpForSource`); cap 300.
- `share.ts`: `loadShareContext` (tracked matches ≥ 0.65, top 3, plus a lead with the same URL) and
  `shareDecision`: lead → `createLead`; track → JOB_SEEN (source IMPORT, origin MOBILE, 0.9,
  unverified, evidence URL `share:seen:<key>`); applied → USER_CONFIRMED_SUBMISSION (verified,
  evidence MANUAL_NOTE `share:applied:<key>`). `<key>` = normalized URL, else a hash of company +
  title. A lead with the same URL is marked CONVERTED. Uncertain match → `choose`.
- `actions.ts` (`"use server"`, `requireUser` + zod): `createLeadAction`, `updateLeadAction`,
  `leadStatusAction`, `deleteLeadAction`, `convertLeadAction`, `createTargetCompanyAction`,
  `updateTargetCompanyAction`, `deleteTargetCompanyAction`, `shareDecisionAction`. Result data
  `{ message, tone: "success" | "info", href?, hrefLabel?, candidates?, mode? }`. "Same job" /
  "create new" buttons send one `choice` value (`<mode>:attach:<uuid>` or `<mode>:new`).

The quick-add form parses on the device as you type and pre-fills only fields you have not edited;
without JavaScript the server fills blank fields from the pasted text (`form.ts`) and adds detected
flags to the checked ones (with JavaScript the checkboxes the user saw are trusted as given).

## Mobile capture — what works where

- **Android (Chrome / Chromium) with CareerQuest installed:** the manifest's `share_target`
  (GET `/share?title=&text=&url=`) puts CareerQuest in the system share sheet. Android apps often put
  the link in `text`; the parser takes the first URL from `url`, then `text`.
- **iOS / iPadOS:** Safari's share sheet does **not** reliably list installed web apps as share
  targets, so CareerQuest makes no claim of native share-sheet support there. Two fallbacks:
  1. Open CareerQuest → `/share` (also the "Capture a job link" manifest shortcut) and paste the link
     or posting text into the paste box.
  2. An iOS Shortcut: Shortcuts → New Shortcut "Save job to CareerQuest" → in Details turn on
     **Show in Share Sheet** and accept URLs, Safari web pages and Text → add **Get URLs from Input**
     → **URL Encode** that URL → **Text**: `https://<your CareerQuest host>/share?url=<URL Encoded
     Text>` → **Open URLs**. Sharing a page to the shortcut opens `/share` with the link filled in.
     "Open URLs" opens Safari, not the home-screen app (home-screen web apps keep a separate
     sign-in), so you must be signed in to CareerQuest in Safari. This was not tested on a device.
- Nothing is saved until the user taps Save as lead / Save to tracker (not applied yet) /
  I applied — confirm. Layout is single-column with full-width buttons at 375 px.

## How to test

```
npx vitest run tests/unit/extension-api-routes.test.ts tests/unit/extension-api-schemas.test.ts \
  tests/unit/discovery-logic.test.ts tests/unit/discovery-db.test.ts tests/unit/discovery-render.test.ts \
  tests/unit/share-db.test.ts tests/unit/share-render.test.ts
```

- `extension-api-routes` (DB, route handlers called with `Request`): 401 for missing / malformed /
  unknown / revoked tokens; `/me`; scopes (403); 60/min → 429 with `retryAfterSeconds` +
  `Retry-After`; CORS preflight and response headers; validation (unknown keys, caps, bad values,
  non-JSON, wrong content type → nothing stored); allow-listed + PII-masked evidence; JOB_PAGE then
  CONFIRMATION_PAGE for the same URL → one application Saved → Submitted with both history rows from
  EXTENSION; email-imported record + extension confirmation for the same Workday job → one record,
  EMAIL + EXTENSION_CAPTURE evidence, submission XP once (Phase 3 acceptance); low-confidence
  confirmation → pending and listed by `loadCaptureReview`; APPLY_STARTED never submits;
  MANUAL_CONFIRMATION → Submitted, verified; repeated POST and a second click → duplicate; explicit
  attach; another user's application → 404 with nothing stored; audit row without URL/company;
  `/lookup` result shape, user isolation and parameter validation.
- `extension-api-schemas`: CORS origin policy and headers, schema caps/strictness, evidence
  allow-list, PII masking, lookup query parsing.
- `discovery-logic`: flags, regions, trades, fit score factors, paste/share parsing (incl. not
  inventing company/title from casual text), search links, form parsing, schemas.
- `discovery-db`: lead create/dedupe/flags/hidden/sort/status/delete, ownership, conversion (saved,
  idempotent, applied on the converted record, email-imported match, uncertain → choose → attach /
  force), target companies (XP key, duplicate names, counts, revoke on delete, 24 h cap).
- `share-db`: field requirement, lead + duplicate, track (MOBILE origin, lead converted), context
  matches + isolation, applied once (XP once), text-only applied, foreign attach refused, choose.
- `discovery-render` / `share-render`: server-render smoke tests of every component and page.

## Decisions and known gaps

- Search links are built from each board's public search URL pattern
  (`indeed.com/jobs?q=&l=`, `linkedin.com/jobs/search/?keywords=&location=`,
  `ziprecruiter.com/jobs-search?search=&location=`, `glassdoor.com/Job/jobs.htm?sc.keyword=&locKeyword=`,
  `governmentjobs.com/jobs?keyword=&location=`, `usajobs.gov/Search/Results?k=&l=`,
  `calcareers.ca.gov/CalHrPublic/Search/JobSearchResults.aspx#kw=`). The sandbox cannot reach these
  hosts, so the formats were not checked live; CalCareers' hash parameter is the least certain.
- User-asserted observations from Discovery and /share use `source: "IMPORT"` because the ingest
  contract excludes `USER`; the record's `createdVia` is URL_IMPORT / MOBILE and the stage is
  verified, but status history shows the source as Import (see shared change requests).
- `JobLead` has no normalized company column, so the no-URL duplicate check compares normalized
  company + title in memory (bounded by the 2,000-lead cap).
- The rate limiter is in-memory per process (as `src/lib/rate-limit.ts` documents).
- None of these pages were opened in a real browser (`next dev` is not allowed in this stage); the UI
  is covered by server-render smoke tests. The extension itself was not run against this server here.
- The current extension build never POSTs `APPLY_STARTED` (it only raises a local prompt); the
  server still accepts and queues it as specified.
