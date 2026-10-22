# integrations-imports — integrations registry, mailbox OAuth + sync, and imports

Owner paths: `src/lib/integrations/**`, `src/lib/imports/**`, `src/app/(app)/integrations/**`,
`src/app/(app)/applications/import/**`, `src/app/api/integrations/**`, `src/app/api/oauth/**`,
`src/components/integrations/**`, `src/components/imports/**`,
`tests/unit/{integrations,imports,oauth}*.test.ts`, this file. No shared files were changed.

## Routes

| Route | What it does |
|---|---|
| `/integrations` | Provider cards grouped by category: status badge + reason, description, "How applications get captured", capability matrix, accounts (last sync, history range, last error), Connect (consent dialog), Sync now, Scheduled sync on/off, Disconnect (confirm, optional "also delete imported email records"), import links; Chrome extension setup steps; last 10 sync runs. Shows `?connected=` / `?oauthError=` outcomes from the OAuth callback. |
| `/applications/import` | Email files: upload `.eml`/`.mbox` (≤ 25 MB, ≤ 50 files, ≤ 2,000 messages) or paste one raw email. |
| `/applications/import/spreadsheet` | `.csv` / `.tsv` / `.xlsx` (≤ 10 MB, ≤ 5,000 rows): header detection → column mapping with suggestions → 20-row preview validated per row → import. |
| `/applications/import/urls` | Job links, one per line, optional ` \| Company \| Job title`; no network fetch. |
| `/applications/import/exports` | LinkedIn "Job Applications.csv" preset (with download steps) and an applicant-tracking-system preset. |
| `POST /api/oauth/google/start`, `POST /api/oauth/microsoft/start` | Consent-dialog form POST → sealed state cookie → 303 to the provider. Session + same-origin required, 10 starts / 10 min. |
| `GET /api/oauth/google/callback`, `GET /api/oauth/microsoft/callback` | Validates state + session binding, exchanges the code (PKCE), stores encrypted tokens, redirects to `/integrations`. |
| `POST /api/integrations/sync` | `Authorization: Bearer $CRON_SECRET` → every user's CONNECTED, sync-enabled mailbox connections; otherwise the signed-in user's own connections (same-origin, 10/hour). |

## Registry (`src/lib/integrations/registry.ts`, pure)

`PROVIDERS` has one entry for every `IntegrationProvider` plus `UNION_PORTALS` (no schema enum, never
has connections): `{ key, name, category, description, capture[], capabilities, connect, platform,
verificationNote, importLinks }`. Capabilities `{ importApplications, getJobDetails, syncStatuses,
matchRecords, reportErrors }` are `"supported" | "experimental" | "unsupported"`:

- Gmail / Outlook: import + status sync + matching + error reporting supported; job details unsupported.
  `verificationNote` says they were built against the documented APIs and tested with simulated responses only.
- Chrome extension: import (user-confirmed captures), job details (page you are on), matching.
- Indeed, LinkedIn, Glassdoor, ZipRecruiter, Workday: only `matchRecords` supported (their posting URLs reduce to stable ids in `normalizeUrl`).
- Greenhouse, Lever: `getJobDetails` experimental (public postings APIs), `reportErrors` experimental.
- SmartRecruiters, iCIMS, ADP, GovernmentJobs, USAJOBS, union portals: `matchRecords` experimental only.

`computeStatus(provider, { env, connection, extensionTokenUsage, now? }) → { status, reason }` returns exactly
one of Connected / Available / Experimental / Manual-only / Unsupported:

- Gmail/Outlook: "Manual-only" ("OAuth client not configured — import .eml/.mbox files instead") unless
  client id **and** secret **and** `APP_URL` are set; then "Connected" only for a CONNECTED connection,
  otherwise "Available" (with a reconnect reason for NEEDS_REAUTH / ERROR). A CONNECTED row on a server
  whose client config was removed shows "Manual-only" (it cannot sync).
- Job boards / ATS / government / union: "Manual-only" with the honest capture paths (LinkedIn's reason names its data export).
- Greenhouse / Lever: "Experimental" (postings only, not live-verified).
- Chrome extension: "Connected" when a non-revoked, unexpired ApiToken has `lastUsedAt` within 30 days; else "Available" with setup steps.
- Unknown key: "Unsupported".

`CONSENT` holds the consent-dialog copy (reads, scopes + meaning, stores, retention, disconnect).

## Adapters (`src/lib/integrations/adapters/*`)

`IntegrationAdapter { provider; capabilities; importApplications?(ctx); getJobDetails?(url); syncStatuses?(ctx) }`.
`runOperation(adapter, op, ...args)` throws `NotSupportedError` when the capability is `unsupported` or the
method is missing; `canRun()` checks the same. Other typed errors: `IntegrationAuthError` (grant unusable →
NEEDS_REAUTH), `IntegrationHttpError { status, retryable }`. All HTTP uses an injected `fetch` with a 30 s
timeout; response bodies are never copied into errors. `getAdapter(key, { fetch })` returns the Gmail,
Outlook, Greenhouse or Lever adapter, or a "manual" adapter with no operations.

- **Gmail** (`gmail.ts`): `users.messages.list?q=…&maxResults≤100` → `messages.get?format=raw` →
  `parseGmailRaw` → `processRawEmail(provider "GMAIL")`. Query (`email-filter.ts`):
  `newer_than:{days}d -in:chats (from:(<recruiting senders>) OR subject:(application OR applying OR interview OR offer OR assessment))`.
  ADP and Workday's employee domain are deliberately not in the sender list (payroll/HR mail); LinkedIn is
  narrowed to `jobs-noreply@linkedin.com`. First run uses the chosen history range (30/90/180/365); later
  runs use "days since the last completed run + 1".
- **Outlook** (`outlook.ts`): `GET /v1.0/me/messages?$select=id,internetMessageId,conversationId,subject,from,toRecipients,receivedDateTime,body&$filter=receivedDateTime ge {iso}&$orderby=receivedDateTime asc&$top=50`
  with `Prefer: outlook.body-content-type="text"`, following `@odata.nextLink` **only** when it is an
  `https://graph.microsoft.com/` URL (the bearer token is never sent elsewhere). `$orderby` on the filtered
  property (allowed by Graph) keeps paging stable while new mail arrives. Graph cannot express the Gmail
  filter, so each message is checked with `isLikelyJobEmail()` and discarded unparsed/unstored if it fails.
- Both: hard cap `MAX_ITEMS_PER_RUN = 500` items fetched per run (exact; Outlook resumes mid-page with a
  `skip`). The cursor (`IntegrationConnection.syncCursor`, JSON) stores either `{ completedAt }` or a resume
  point (Gmail: query + page token; Outlook: Graph link + skip). Messages the classifier labels UNRELATED are
  skipped and **not stored**. 401 → refresh once and retry; second 401 or `invalid_grant` → NEEDS_REAUTH.
  429/5xx/network on a page stop the run (FAILED, or PARTIAL if items were already processed) and keep the
  resume point; per-message failures are recorded and the run continues (PARTIAL).
- **Greenhouse / Lever** (`postings.ts`): `getJobDetails(url)` for `boards.greenhouse.io/{board}/jobs/{id}`
  (also `job-boards.` and `embed/job_app?for=&token=`) → `boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}`;
  `jobs.lever.co/{site}/{uuid}` (and `jobs.eu.`) → `api.lever.co/v0/postings/{site}/{id}`. Only validated
  path segments reach fixed hosts. Lever returns no employer name, so `company` stays null. Every result has
  `liveVerified: false`. These are not wired into any UI yet (the URL import is deliberately no-fetch).

## OAuth (`src/lib/integrations/oauth/*`)

- Authorization code + PKCE S256. Google: `https://accounts.google.com/o/oauth2/v2/auth`, scopes
  `openid email https://www.googleapis.com/auth/gmail.readonly`, `access_type=offline`, `prompt=consent`.
  `gmail.readonly` is the least privilege that can read message bodies: `gmail.metadata` exposes only
  headers/labels and cannot be combined with the `q` search used to fetch job mail only; every other Gmail
  scope can modify the mailbox. Microsoft: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/{authorize,token}`
  (tenant from `MICROSOFT_TENANT`, validated, default `common`), scopes `offline_access Mail.Read User.Read`
  (`Mail.ReadBasic` would exclude bodies). `redirect_uri = {APP_URL}/api/oauth/{google|microsoft}/callback`.
- State cookie `cq_oauth_{google|microsoft}`: HttpOnly, SameSite=Lax, `Secure` in production, path
  `/api/oauth/{provider}`, 10 minutes. Value = AES-256-GCM sealed `{ sha256(state), code_verifier,
  sha256-binding(userId, sha256(session token)), historyDays, expiry }`. The callback rejects a missing or
  tampered cookie, another provider, a state whose hash differs, an expired attempt, or a different
  session/user (constant-time comparisons). The cookie is cleared on every callback.
- Callback: exchanges the code at the token endpoint; refuses (and revokes) a grant without mail scope
  (Google lets users untick it); account email from the Google id_token (`aud` must equal our client id;
  received directly from the token endpoint over TLS, per OIDC) or the Gmail profile / Graph `/me`.
  Tokens are stored only via `encryptSecret`; `(userId, provider, accountEmail)` rows are reused on
  reconnect (refresh token kept if not re-issued; cursor reset when the range changed or it had been
  disconnected). Audit: `integration.connected`, `integration.connect_failed`, `integration.disconnected`,
  `integration.needs_reauth`, `integration.sync_toggled`, `integrations.scheduled_sync`, `applications.imported`.
- `connectionTokenSource(connection, { env, fetch })`: decrypts lazily, refreshes 60 s before expiry or on
  demand, stores rotated tokens encrypted, never writes tokens back to a connection that was disconnected.
- Disconnect: Google `POST https://oauth2.googleapis.com/revoke` (refresh token); Microsoft has no per-token
  revocation endpoint, so the UI tells the user where to remove the app. Tokens, expiry and cursor are wiped,
  status DISCONNECTED; optionally `EmailMessage` rows of that connection are deleted. Applications stay.

## Sync and scheduling

`syncConnection(userId, connectionId, deps)` (one SyncRun with scanned/matched/created/updated, `errors`
JSON of `{ code, message, ref? }` — never message content — and status SUCCEEDED / PARTIAL / FAILED;
`CAP_REACHED` is informational), `syncUserConnections`, `syncAllUsers(deps, { userIds? })`.
`lastSyncAt` updates on SUCCEEDED/PARTIAL; `lastError` is the fatal message or "N items could not be
processed"; RUNNING runs older than 30 min are closed as FAILED (interrupted); a live run blocks a second one.
`matched` = messages linked to an existing record (updated or already up to date).

Cron (any scheduler; nothing is scheduled inside the app):

```sh
# every 30 minutes; CRON_SECRET must be ≥ 16 characters or the scheduler path is disabled
curl -fsS -X POST "$APP_URL/api/integrations/sync" -H "Authorization: Bearer $CRON_SECRET"
```

Users are processed one at a time; one user's failure never stops the others. The JSON report contains
user ids, connection ids, statuses and counts — no addresses. Each connection reads at most 500 messages
per call, so a large first sync completes over several scheduled runs. Production wiring:
`productionSyncDeps()` (`src/lib/integrations/defaults.ts`) = real fetch + `ingestObservation` + process env.

## Imports (`src/lib/imports/*`)

Pure, client-safe: `csv.ts` (papaparse; BOM, quotes, CRLF/CR, delimiter detection, blank rows kept for row
numbers), `dates.ts` (`parseImportDate`: YYYY-MM-DD[ time], YYYY/MM/DD, MM/DD/YYYY, M/D/YY, DD/MM/YYYY when
the first number > 12, "-"/"." separators, trailing times like LinkedIn's "10/14/25, 3:41 PM", month names
"Jan 5, 2026" / "January 5 2026" / "5 Jan 2026" / "Mon, Jan 5, 2026", Excel serials; impossible dates rejected),
`table.ts` (header-row detection in the first 10 rows, ≤ 100 columns, ≤ 5,000 data rows, cells ≤ 5,000 chars),
`mapping.ts` (fields, header synonyms, `suggestMapping`, `mappingProblems`, `mapStatus`, `mapSource`,
`validateRow`), `presets.ts` (generic / LinkedIn / ATS; personal-data columns — phone, email, address,
screening questions/answers, résumé name, identity/EEO fields — are dropped right after parsing for every
preset), `urls.ts` (`parseUrlLines`, `hintsFromUrl`), `outcome.ts` (shared totals/buckets), `types.ts`.
Server-only: `xlsx.ts` (read-excel-file `/node`, first sheet), `spreadsheet.ts`, `email-files.ts`,
`url-import.ts`, `batches.ts`, `ingest.ts` (`defaultIngest` = `ingestObservation`), `actions.ts` ("use server").

- **Spreadsheet row → observation**: kind from a mapped status column (Applied/Submitted → SUBMITTED,
  Saved/To apply → JOB_SEEN, Interview → INTERVIEW_INVITED, Rejected/Not selected → REJECTED, Offer → OFFER,
  Hired/Onboarding → ONBOARDING, Assessment/Test → ASSESSMENT_INVITED, Phone screen/Recruiter → RECRUITER_RESPONSE,
  Under review/Received → ACKNOWLEDGED; Withdrawn/Closed/unknown fall back to the date rule with a warning),
  else SUBMITTED with a date applied, else JOB_SEEN. `source IMPORT`, `origin CSV_IMPORT`, `confidence 0.95`,
  `verified false` (self-reported), `observedAt` = noon of the applied day in the user's timezone (import time
  when there is no date — with a warning when a status says applied). Evidence `CSV_ROW`,
  `sourceRef = sha256(["csv-row-v1", normalizeCompany, normalizeTitle, appliedDay, normalizedUrl, REQUISITION,
  kind, location])` — cosmetic differences (case, spacing, URL tracking params, CSV vs TSV, column order) hash
  the same, so re-importing creates nothing new; notes become the evidence snippet (≤ 300 chars).
  Future dates, unreadable dates, missing company/title are row errors; bad URLs are warnings.
- **Email files**: extension check + content check (RFC 5322 header block, no binary) per file / per mbox
  message; ImportBatch kind MBOX when any mbox is present, else EML; providers EML / MBOX / PASTE; UNRELATED
  messages skipped and not stored.
- **URLs**: JOB_SEEN, `origin URL_IMPORT`, evidence `URL` with `sourceRef = normalizedUrl`; confidence 0.9
  for typed details, 0.8 for details read from the URL path, 0.5 for neither (the engine then asks for details).
- **Results**: totals `{ total, created, updated, duplicate, needsReview, ignored, errors }` + per-row issues
  (stored in `ImportBatch.errors` without row content, capped at 500). Spreadsheet/URL rows the engine sends
  to review are reported in the result with the reason (no review-queue row exists for them); email imports
  link to `/applications/review`.

## How to test

```sh
npx vitest run tests/unit/imports-parsing.test.ts tests/unit/imports-db.test.ts \
  tests/unit/integrations-registry.test.ts tests/unit/integrations-adapters.test.ts \
  tests/unit/integrations-sync.test.ts tests/unit/oauth-flow.test.ts tests/unit/integrations-render.test.ts
```

- `imports-parsing` (86): CSV edge cases, header detection, 5,000-row cap, 30 date cases, mapping/status/source,
  row validation, fingerprints, presets, a `.xlsx` workbook generated in the test (stored ZIP + `zlib.crc32`)
  read through `read-excel-file/node`, extension/content mismatches, Windows-1252 CSV, URL lists and hints,
  email file checks, upload-error wrapper.
- `imports-db` (7, real ingestion engine): same CSV twice → second run all duplicates (also as reordered TSV);
  server-side mapping validation; LinkedIn export never stores phone/email/Q&A/résumé name anywhere; URL import
  creates SAVED leads only and is idempotent; email files matched to an existing record, unrelated mail not
  stored, re-import creates nothing; paste + content/size rejections.
- `integrations-registry` (10), `integrations-adapters` (14): statuses, matrices, Greenhouse/Lever with fake
  fetch, NotSupportedError, Gmail query, job-mail filter, cursors, Graph link validation.
- `oauth-flow` (13): authorization URLs (PKCE challenge = S256(verifier), scopes, redirect_uri from APP_URL),
  sealed cookie, state/session/user/expiry/provider rejections, scope-missing revoke, code exchange with
  tokens encrypted at rest (plaintext absent from the row), reconnect, refresh, disconnect revoke + wipe (+ email deletion), Outlook.
- `integrations-sync` (12): paging + cap + resume, incremental window, idempotent re-delivery, refresh on 401,
  PARTIAL on message failure, outage keeps cursor, revoked grant → NEEDS_REAUTH, cross-user refusal,
  Outlook nextLink/Prefer/filtering/exact cap/foreign-host refusal, scheduler isolation, scheduler auth.
- `integrations-render` (10): server-render smoke tests of cards, matrix, runs, consent trigger, import summary/forms.

## External dependencies / environment

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`,
`MICROSOFT_TENANT` (default `common`), `APP_URL` (also the OAuth redirect base — users must open the app
on this origin, or the state cookie will not be found on callback), `CRON_SECRET` (≥ 16 chars).
Register redirect URIs `{APP_URL}/api/oauth/google/callback` (Google Cloud console, Gmail API enabled;
`gmail.readonly` is a restricted scope requiring Google verification for public apps) and
`{APP_URL}/api/oauth/microsoft/callback` (Entra app registration, delegated Mail.Read + User.Read + offline_access).

## Known gaps / limits

- **Nothing here has touched a live provider**: Google, Microsoft, Greenhouse and Lever are unreachable from
  the build sandbox; all provider behavior is tested against fakes that follow the documented APIs.
- **Server action body limit**: Next's default server-action body limit is 1 MB, and the proxy buffers
  bodies up to 10 MB. Until `next.config.ts` raises both (see shared change request), email uploads and
  spreadsheets above 1 MB fail; the forms show "The upload could not be sent…" instead of crashing.
- Spreadsheet rows only carry one stage; the stage date is unknown, so later stages are dated at the
  applied date (or import time). Withdrawn/Closed are not importable stages (warned).
- Spreadsheet/URL rows that the engine routes to review are not persisted anywhere for later review; they are
  listed in the import result and re-importing retries them.
- The Greenhouse/Lever `getJobDetails` adapters have no UI caller yet.
- Two simultaneous "Sync now" requests for one connection can both start (no row lock); processing is
  idempotent, so the cost is duplicate fetching only.
- English-only email classification (inherited from email-core).
