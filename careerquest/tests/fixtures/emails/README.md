# Email classification fixture corpus

Forty synthetic, hand-labeled job-search emails for the Phase 2 email classification engine.
Every message is addressed to the test user `Ruben Test <ruben.test@example.com>`, dated in 2026,
and written to look like what a Los Angeles / Orange County trades job seeker (apprentice electrician,
HVAC, elevator helper, pipefitter, maintenance, construction coordination) actually receives.

Nothing here is real: employers use fictional names and reserved `.example` domains, people are
invented, and only the *platform* sender addresses (`noreply@indeed.com`, `no-reply@myworkday.com`,
`usajobs@usajobs.gov`, ...) and platform-style tracking links mirror real services so that
sender-domain detection can be tested.

## Files

| Path | What it is |
|------|------------|
| `NNN-<source>-<kind>.eml` | One RFC 5322 message per file, CRLF line endings, numbered 001-040. |
| `index.json` | Ground-truth labels: `[{ file, expected: {...}, notes }]` (schema below). |
| `all.mbox` | Every `.eml`, in file order, as a classic mbox (for the MBOX import path). |
| `parse-check.mjs` | Validator. `node tests/fixtures/emails/parse-check.mjs` exits 1 on any problem. |
| `build-mbox.mjs` | Rebuilds `all.mbox` from the `.eml` files. Run it after adding or editing a fixture. |

## Coverage

| Classification | Count | Files |
|----------------|------:|-------|
| `APPLICATION_SUBMITTED` | 10 | 001 Indeed, 002 LinkedIn, 003 Workday, 004 Greenhouse, 005 Lever, 006 SmartRecruiters, 007 iCIMS, 008 ADP, 009 GovernmentJobs/NEOGOV, 010 USAJOBS |
| `EMPLOYER_ACKNOWLEDGMENT` | 4 | 011 employer HR note, 012 union JATC, 013 recruiter reply thread, 014 "under review" status |
| `RECRUITER_MESSAGE` | 4 | 015 availability question, 016 LinkedIn InMail, 017 staffing agency, 018 "let's find a time" |
| `INTERVIEW_INVITATION` | 4 | 019 Calendly-style phone screen, 020 on-site with address, 021 Zoom-style video, 022 apprenticeship panel |
| `ASSESSMENT_INVITATION` | 2 | 023 HireVue-style with deadline, 024 JATC aptitude test appointment |
| `REJECTION` | 5 | 025 polite personal, 026 "position has been filled", 027 "other candidates" (base64), 028 subtle, 029 Workday status change |
| `OFFER` | 2 | 030 formal offer (pay, start date, e-sign), 031 conditional pending background check |
| `ONBOARDING` | 2 | 032 Workday onboarding tasks / I-9, 033 first-day logistics |
| `JOB_ALERT` | 3 | 034 Indeed, 035 LinkedIn, 036 ZipRecruiter |
| `INCOMPLETE_APPLICATION` | 2 | 037 Indeed, 038 Workday |
| `APPLICATION_INVITATION` | 1 | 039 Indeed "invited you to apply" |
| `UNRELATED` | 1 | 040 trade-school newsletter |

`UNKNOWN` exists in the Prisma enum but is never a ground-truth label here.

Formats: 20 `text/plain`, 10 `multipart/alternative` (text + HTML parts), 10 `text/html` only.
The HTML messages imitate real transactional templates (nested tables, inline styles, preheader
text, tracking pixels, click-tracking URLs, unsubscribe footers, Outlook/Word markup in 020).
Transfer encodings: everything is `7bit`/`8bit` except 002 (both parts quoted-printable),
016 and 034 (quoted-printable HTML with UTF-8 characters) and 027 (base64 HTML). Headers are
plain ASCII (no RFC 2047 encoded words). Several messages carry realistic extras
(`Reply-To`, `List-Unsubscribe`, `In-Reply-To`/`References`, `Auto-Submitted`, vendor `X-` headers).

Platforms represented: INDEED 4, LINKEDIN 3, WORKDAY 4, GREENHOUSE 2, LEVER 2, SMARTRECRUITERS 1,
ICIMS 1, ADP 1, GOVERNMENTJOBS 1, USAJOBS 1, ZIPRECRUITER 1, COMPANY_SITE 13, OTHER 5, null 1.
`GLASSDOOR` is in the enum but has no fixture yet.

## Label schema (`index.json`)

```json
{
  "file": "003-workday-application-submitted.eml",
  "expected": {
    "classification": "APPLICATION_SUBMITTED",
    "employer": "Harbor Line Elevator Co.",
    "positionTitle": "Elevator Mechanic Helper",
    "requisitionNumber": "R-2026-01844",
    "platform": "WORKDAY",
    "interviewAt": null,
    "recruiterName": null,
    "countsAsSubmission": true,
    "minConfidence": 0.95
  },
  "notes": "what makes this one tricky"
}
```

### Conventions

- **classification** - one of the twelve `EmailClassification` values above.
- **employer** - the organization the email is *about*, spelled exactly as the message spells it
  (so `"Harbor Line Elevator Co."` with the period). A staffing agency whose client is unnamed is
  the employer (017); a union training committee is the employer for apprenticeship mail
  (012, 022, 024); a federal agency is the employer for USAJOBS (010). `null` for `JOB_ALERT` and
  `UNRELATED` even though those emails name many companies.
- **positionTitle** - the role as the message states it, singular, without location or level
  suffixes. The apprenticeship program is normalized to `"Inside Wireman Apprentice"`. `null` for
  alerts and unrelated mail.
- **requisitionNumber** - the bare identifier without its label: `"9087123"`, not `"Job ID 9087123"`.
  Styles present: `R-2026-01844`, `R-2026-02210`, `JR118223`, `REQ-55102`, `9087123`, `2026-BR-114`,
  `REF4471W`, `FFA-26-LB-0417-DE`. Applicant numbers (`A-26-0392`), NEOGOV Application IDs
  (`15488723`) and offer-letter ids are *not* requisitions and are labeled `null`.
- **platform** - detected from *this message's* sender domain and branding, not from where the
  original application was made. Employer-domain senders are `COMPANY_SITE`; union offices, staffing
  agencies and third-party assessment vendors (HireVue-style, 023) are `OTHER`; `UNRELATED` is `null`.
  Note that Indeed uses two sender addresses (`noreply@` and `alert@`) and LinkedIn three
  (`jobs-noreply@`, `messages-noreply@`, `jobalerts-noreply@`).
- **interviewAt** - set only for `INTERVIEW_INVITATION` with a fixed date and time, as ISO 8601 with
  the Pacific offset of that date (`-08:00` through 2026-03-07, `-07:00` from 2026-03-08). For a time
  range it is the start; for the JATC panel (022) it is the *report* time, not the "interviews begin"
  time. A self-scheduling link (019) is still an interview invitation but has no time, so `null`.
  Assessment appointments (024) are deliberately *not* recorded here; the time is in `notes`.
- **recruiterName** - the human the candidate would reply to, as a bare name: `"Priya Natarajan"`,
  not `"Priya Natarajan via LinkedIn"`; `"Kelly Ruiz"`, not `"Kelly Ruiz | TradeForce Staffing"`.
  `null` for automated platform mail. Other people named in a message (hiring managers, second
  interviewers) are not the recruiter.
- **countsAsSubmission** - `true` only for `APPLICATION_SUBMITTED` and for `EMPLOYER_ACKNOWLEDGMENT`
  messages that confirm a completed application. It is `false` for everything else, including
  `INCOMPLETE_APPLICATION`, `APPLICATION_INVITATION`, job alerts, and recruiter mail that mentions a
  past application (017). Fourteen fixtures count; note that some are *duplicates of the same
  application* (001 + 011, 003 + 014), which an importer should merge rather than double-count.
- **minConfidence** - a floor, 0.6-0.95, for what a good deterministic classifier should report.
  Platform boilerplate sits at 0.9-0.95; subtle or conversational messages at 0.6-0.75.
- **notes** - the trap in that message. Read these before changing the classifier.

## Threads and traps

The fixtures tell a few consistent stories, which is useful for dedupe, merge and status-progression tests:

- **Acme Electric / Apprentice Electrician**: 001 Indeed confirmation, 011 employer acknowledgment,
  019 phone-screen link, 025 polite rejection.
- **Harbor Line Elevator Co. / Elevator Mechanic Helper (R-2026-01844)**: 003 Workday confirmation,
  014 under review, 018 recruiter asks for availability, 030 offer, 032 onboarding. 038 is a second,
  unfinished Harbor Line application (R-2026-02210).
- **Pacific Coast Mechanical / Pipefitter (Job ID 9087123)**: 008 ADP confirmation, 016 InMail
  (separate cold outreach), 021 video interview, 031 conditional offer, 033 first day.
- **Golden State Builders**: 004 Greenhouse confirmation and 027 rejection (Construction Project
  Coordinator); 013 acknowledgment and 020 on-site interview (Assistant Project Manager);
  039 invitation and 037 unfinished application (Estimator).
- **Southland Electrical JATC / Inside Wireman Apprentice**: 012 acknowledgment, 024 aptitude test, 022 panel interview.
- **Sunrise Aerospace Components (REQ-55102)**: 007 iCIMS confirmation, 023 assessment.
- **Southland Realty Partners / Building Engineer (REF4471W)**: 006 SmartRecruiters confirmation, 028 subtle rejection.
- **Sunbelt HVAC Services / HVAC Technician**: 005 Lever confirmation, 015 recruiter question, 026 position filled.

Pairs that look alike but must classify differently:

| Looks like | Is actually | Files |
|------------|-------------|-------|
| Indeed confirmation card with employer + title | job alert / unfinished application / invitation to apply | 001 vs 034, 037, 039 |
| Workday "Thank you for applying" template | unfinished application | 003 vs 038 |
| "Application status update" | positive (under review) vs rejection (no longer under consideration) | 014 vs 029 |
| Recruiter mentions a "formal interview" and "calendar invite" | nothing scheduled, just asking availability | 018 vs 019 |
| JATC appointment notices | aptitude test (assessment) vs oral interview | 024 vs 022 |
| "On-demand video interview" | assessment with a deadline, not an interview | 023 vs 021 |
| The word "offer" | "offer the position to another candidate" (rejection); "accepting your offer" (onboarding) | 025, 032 vs 030, 031 |
| Subject names employers and a title | LinkedIn job-alert digest | 035 |
| "Apply now", "Electrician", "HVAC", "aptitude test" | education marketing | 040 |

## Validating and regenerating

```sh
node tests/fixtures/emails/parse-check.mjs   # structural + label checks, exits 1 on failure
node tests/fixtures/emails/build-mbox.mjs    # regenerate all.mbox after editing any .eml
```

`parse-check.mjs` has no dependencies. Besides the header/MIME checks it verifies that every
non-null string label (`employer`, `positionTitle`, `requisitionNumber`, `recruiterName`) literally
appears in the decoded message, that `countsAsSubmission`/`interviewAt` follow the conventions
above, and that each message in `all.mbox` round-trips byte-for-byte to its `.eml`
(after CRLF to LF normalization and `>From ` unescaping; 033 contains a body line starting with
`From ` on purpose).

To add a fixture: write the `.eml` with CRLF line endings and the headers listed at the top of
`parse-check.mjs`, append its entry to `index.json` with a `notes` string, run `build-mbox.mjs`,
then `parse-check.mjs`.

## Using the corpus in tests

```ts
import fs from "node:fs";
import path from "node:path";

const dir = path.join(__dirname, "../fixtures/emails");
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));

for (const { file, expected, notes } of index) {
  test(`${file} -> ${expected.classification}`, () => {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    const result = classifyEmail(parseEml(raw)); // Phase 2 API
    expect(result.classification, notes).toBe(expected.classification);
    expect(result.confidence).toBeGreaterThanOrEqual(expected.minConfidence);
    expect(result.countsAsSubmission).toBe(expected.countsAsSubmission);
  });
}
```
