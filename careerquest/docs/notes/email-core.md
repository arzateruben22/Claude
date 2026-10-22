# email-core — deterministic email-intelligence library

Owner paths: `src/lib/email/**`, `tests/unit/email*.test.ts`, this file. No shared files were changed.

## What was built

| File | Purpose |
|------|---------|
| `src/lib/email/parse.ts` | `parseEmail(raw, meta?)` (alias `parseEml`) — RFC 5322 via mailparser `simpleParser` → `ParsedEmail`; `splitMbox(content)`; `parseGmailRaw(base64url, meta?)`; `fromGraphMessage(graphJson)`; `truncateUtf8`, `parseDateHeader`. |
| `src/lib/email/html.ts` | Dependency-free HTML → text (`htmlToText`, `htmlToTextWithLinks`, `decodeEntities`, `normalizeWhitespace`, `linksFromPlainText`). |
| `src/lib/email/platforms.ts` | Sender-domain → platform/kind table (`senderInfo`), `domainMatchesEmployer`, `PLATFORM_NAMES`. |
| `src/lib/email/datetime.ts` | Explicit date+time extraction (`findDateTimes`, `extractAppointment`), zone words PT/PST/PDT/ET/CT/MT/UTC, default `America/Los_Angeles`. |
| `src/lib/email/extract.ts` | Field extractors: employer, title, requisition, recruiter, location, salary, application URL. |
| `src/lib/email/classify.ts` | `classifyEmail(parsed)` (pure, deterministic); `classifyEmailWithOptionalAi(parsed, ai?)`; `EmailAiClassifier` interface. |
| `src/lib/email/observation.ts` | `toObservation(parsed, classification, { provider, now? })` → `ApplicationObservation | null`; `buildSnippet`, `maskPii`, `observationKindFor`. |
| `src/lib/email/store.ts` (server-only) | `storeClassifiedEmail`, `upsertClassifiedEmail`, `decideReviewStatus`, `applyIngestOutcome`, `purgeReviewedBodies`, `minimizedBody`. |
| `src/lib/email/pipeline.ts` (server-only) | `processRawEmail(userId, raw | ParsedEmail, ctx, ingest)` and `processRawEmails(...)` for batches. |

### ParsedEmail
`{ externalId, threadId, fromAddress, fromName, toAddress, subject, receivedAt, text, headers: { listUnsubscribe, autoSubmitted, replyTo, authenticationResults }, links }`

- `externalId`: Message-ID without `<>`; for Gmail without Message-ID `gmail:<id>`; for Graph without internetMessageId `graph:<id>`; otherwise `sha256:<hex>` of from/to/subject/raw Date/first 4 KB of text (stable across re-imports).
- `threadId`: first entry of References, else In-Reply-To; `meta.threadId` (Gmail threadId) / Graph `conversationId` override.
- `receivedAt`: the Date header parsed strictly. Missing or unparseable → `null` (mailparser would substitute "now"; we do not).
- `text`: text/plain part when it has real content, otherwise the HTML part converted (scripts/styles/comments/hidden preheaders/images removed, links reduced to their text, table cells joined, entities decoded, whitespace collapsed). Capped at 200 KB (UTF-8). Attachments are ignored.
- `links`: up to 60 `{ text, url }` from anchors / labeled plain-text URLs (tracking pixels excluded) — used only to pick `applicationUrl`; never stored.

### Classification
`classifyEmail(parsed) → { classification, confidence, signals, extracted, matchedPhrase, sender }`

- `extracted = { employer, positionTitle, requisitionNumber, platform, location, salaryText, interviewAt, recruiterName, recruiterEmail, applicationUrl }`.
- `sender = { address, domain, kind, recognizedPlatform, employerDomain, forwarded, sentAt, authFailed }`.
- Weighted phrase families per class (noisy-OR). Subject + first 800 chars of the body count fully; deeper matches (listings, footers) ×0.7. Per-class neutralizers remove look-alike phrases (hypothetical/past interviews, "offer the position to another candidate", "accepting your offer", conditional "if your background matches", "prepares you for … tests").
- Decision precedence: unfinished application (≥0.6) → INCOMPLETE; invitation to apply (≥0.6) → INVITATION; digest subject or alert score ≥0.8 → JOB_ALERT (listing text never upgrades it); OFFER/REJECTION/ONBOARDING/INTERVIEW/ASSESSMENT (≥0.5) beat "thank you for applying"; then received vs recruiter; then UNRELATED/UNKNOWN. "Received"-style mail from a job board/ATS → `APPLICATION_SUBMITTED`, from the employer/union/person → `EMPLOYER_ACKNOWLEDGMENT`.
- Confidence = winning score, +40 % of the remaining gap for platform-typical classes from a recognized platform, minus 0.5 × (strongest unrelated competitor − 0.35), clamped to [0.05, 0.98]. Fixture floors are all met; subtle mail (013, 014, 028) lands at 0.75–0.81 by design.
- Forwards (`Fwd:` / "Forwarded message" blocks) are unwrapped: classification, platform and date come from the original sender. Quoted reply history ("On … wrote:", `>` lines) is ignored.
- Extraction never guesses: JOB_ALERT and UNRELATED return no employer/title; UNRELATED returns `platform: null`; `interviewAt` only for INTERVIEW_INVITATION and only with an explicit date + clock time (zone-less times are Pacific; a missing year is resolved from the weekday, else the Date header). Requisition: labeled ids, then bare parenthesized ids, then `extractRequisitionId` from `normalize.ts` over text with applicant/application/meeting/passcode ids masked.
- AI hook: `classifyEmailWithOptionalAi(parsed, ai)` consults `ai.classify(parsed, deterministic)` only when deterministic confidence < 0.6; AI can never turn JOB_ALERT / INCOMPLETE_APPLICATION / APPLICATION_INVITATION into APPLICATION_SUBMITTED / EMPLOYER_ACKNOWLEDGMENT; AI confidence is capped at 0.85 (so AI results are never `verified`); deterministic extracted values win; AI errors/null fall back to the deterministic result. **No AI implementation is included.**

### Observation (`toObservation`)
Mapping per the contract (SUBMITTED, ACKNOWLEDGED, RECRUITER_RESPONSE, INTERVIEW_INVITED, ASSESSMENT_INVITED, REJECTED, OFFER, ONBOARDING; null for JOB_ALERT / INCOMPLETE / INVITATION / UNRELATED / UNKNOWN). `source`/`origin` = `EMAIL`; `observedAt` = original send date (forward block date for forwards) → Date header → `opts.now` → now. Evidence: `{ kind: "EMAIL", sourceRef: "<PROVIDER>:<externalId>", title: subject, snippet (≤300 chars around the decisive phrase; emails, phone numbers and URLs masked), data: { classification, provider, senderDomain, senderKind, forwarded } }`. `postingUrl` is set only when the selected link is a specific posting (Indeed jk, LinkedIn /jobs/view, Greenhouse/Lever/Workday/iCIMS/SmartRecruiters/ZipRecruiter/Glassdoor job URLs), normalized with `normalizeUrl`.
`verified` = kind ∈ {SUBMITTED, ACKNOWLEDGED, REJECTED, OFFER, ONBOARDING} ∧ confidence ≥ 0.9 ∧ (job board/ATS sender ∨ sender domain matches the employer) ∧ not a forward ∧ no DMARC/DKIM/SPF failure in `Authentication-Results`. (We cannot verify DKIM ourselves; a recorded failure only ever removes `verified`.)

### Storage (`store.ts`)
- Upsert on `(userId, provider, externalId)`; concurrent creates fall back to update (P2002).
- `decideReviewStatus`: no observation → AUTO_ACCEPTED (record only); confidence < 0.45 → AUTO_ACCEPTED, observation not stored (`extracted.belowReviewFloor`); no employer → NEEDS_REVIEW; 0.45 ≤ c < 0.8 → NEEDS_REVIEW; else AUTO_ACCEPTED.
- Stored: headers, masked snippet, classification/confidence, `extracted` = `StoredEmailExtract` (fields, signals, `observation: SerializedObservation | null`, last `ingest` outcome). `bodyText` only on NEEDS_REVIEW rows: URL query strings stripped, ≤ 8 KB. Never HTML or attachments.
- Rows the user CONFIRMED/DISMISSED: re-runs refresh classification/confidence/snippet/extracted fields but keep `reviewStatus`, `applicationId`, `bodyText` and the stored `extracted.observation`.
- `connectionId` / `importBatchId` are checked to belong to the user (throws otherwise). `applyIngestOutcome` links only applications owned by the user.
- `purgeReviewedBodies(userId)` nulls `bodyText` on CONFIRMED/DISMISSED rows; returns the count. Call it after the review UI resolves rows (or on a schedule).

### Pipeline (`pipeline.ts`)
`processRawEmail(userId, input, { provider, connectionId?, importBatchId?, ai?, now? }, ingest)` → `{ emailMessageId, externalId, classification, confidence, action, applicationId, reason }` with `action` ∈ `ingested | duplicate | needs_review | stored | ignored | user_reviewed | ingest_failed`.
Only AUTO_ACCEPTED rows with an observation call `ingest(userId, observation)`. `created/updated/duplicate` → `applicationId` linked; `needs_review` → row NEEDS_REVIEW with the minimized body; `ignored` → recorded; a thrown ingest → NEEDS_REVIEW + `extracted.ingest.action = "error"` (nothing lost; a later re-run retries). A re-delivery of an already linked, unchanged AUTO_ACCEPTED message returns `duplicate` without calling ingest. `processRawEmails` runs sequentially and reports per-message errors.

## Integration notes for other engineers
- Sync/import callers: `processRawEmail(userId, raw, { provider: "GMAIL" | "OUTLOOK" | "EML" | "MBOX" | "PASTE", connectionId, importBatchId }, ingestObservation)` where `ingestObservation` comes from `src/lib/ingest/engine.ts` (not written yet; the signature `(userId, observation) => Promise<IngestResult>` matches the contract, extra `options` can be bound with a closure). MBOX: `splitMbox(fileContent)` then process each. Gmail: `parseGmailRaw(message.raw, { id, threadId })`. Outlook: `fromGraphMessage(json)` (request `internetMessageId,conversationId,subject,from,toRecipients,replyTo,receivedDateTime,body,internetMessageHeaders`).
- Review UI: NEEDS_REVIEW rows carry `extracted.observation` (use `deserializeObservation`) and `extracted.ingest.candidateIds` when the engine asked for review. After confirm/dismiss, set `reviewStatus` and call `purgeReviewedBodies(userId)`.
- `SUBMISSION_CLASSES` / `NEVER_SUBMISSION_CLASSES` are exported from `classify.ts` for UI/analytics.

## How to test
```sh
npx vitest run tests/unit/email-golden.test.ts tests/unit/email-synthetic.test.ts tests/unit/email-store.test.ts
```
- `email-golden.test.ts` (205 tests): every fixture in `tests/fixtures/emails/index.json` — classification (prints a per-class confusion table; currently 40/40 = 100 %), confidence ≥ `minConfidence`, `countsAsSubmission ⇔ observation kind ∈ {SUBMITTED, ACKNOWLEDGED}`, zero observations for JOB_ALERT / INCOMPLETE / INVITATION, employer / title / requisition / platform / recruiter / interviewAt equal to the labels (case/whitespace-insensitive, nulls must stay null), observation shape and snippet masking, `all.mbox` → 40 messages identical to the `.eml` parses.
- `email-synthetic.test.ts` (49 tests): 22 inline synthetic emails in phrasings/platforms not in the corpus (Glassdoor, TestGorilla, HackerRank, Graph, "acknowledge receipt", "pursue other applicants", "we'd like to offer you", status "Not Selected", booking links …) and adversarial cases: digest containing "application submitted" in a listing (neutral and alert subjects), rejections that say "thank you for applying" (employer and ATS senders), `Fwd:` confirmation, RFC 2047 + quoted-printable UTF-8 (accented employer), missing Date and Message-ID, HTML-only with tracking links/hidden preheader/script/style/conditional comments, 1 MB body, failed DMARC; plus mbox, Gmail raw, Graph, HTML, date and AI-hook unit tests.
- `email-store.test.ts` (19 DB tests, own users, cascade cleanup): idempotent upsert, per-provider/per-user rows, review routing, 8 KB body cap with query strings stripped, user decisions preserved, purge scoping, foreign connection rejected, pipeline with a fake ingest (ingested / duplicate / never for alerts-incomplete-invitations / needs_review / ingest error / user_reviewed / cross-user application id ignored / Graph `ParsedEmail` input / batch error isolation).

Verification run: `npx tsc --noEmit` (no errors in owned paths), `npx eslint src/lib/email tests/unit/email-*.test.ts` (clean), the three suites above: 273/273 passing.

## Known gaps / limits
- English phrase families only; non-English job mail will mostly land in UNKNOWN/UNRELATED (the optional AI hook is the intended fallback).
- `verified` is a heuristic on sender identity; the library does not validate DKIM signatures itself (it honors a recorded failure in `Authentication-Results`).
- Person-name detection is lexical (two capitalized tokens without organization vocabulary). Three-word names are only accepted in signature context, so a sender display name like "Mary Ann Smith" yields no recruiter name (by design: never guess).
- Zone abbreviations map to the region's wall clock (a "PST" time in July is read as Pacific local time).
- The fixture corpus has no GLASSDOOR or UNKNOWN-labeled example; both are covered only by the synthetic tests.
- No real Gmail/Graph network calls are made here (callers fetch; sandbox blocks the providers anyway).
