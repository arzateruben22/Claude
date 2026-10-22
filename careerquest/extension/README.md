# CareerQuest Job Tracker (Chrome extension, Manifest V3)

Saves job postings to CareerQuest and records submitted applications from the
job boards you already use — without ever recording anything you did not confirm.

- **Version:** 0.1.0 · **Manifest:** V3 · **No build step, no npm dependencies.**
- Lives in `extension/` of the CareerQuest repo; talks to the CareerQuest
  extension API (`/api/extension/*`) with a developer token.

## Install (unpacked)

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and select this folder (`careerquest/extension`).
3. Pin "CareerQuest Job Tracker" from the extensions menu.

## Connect to CareerQuest

1. In CareerQuest go to **Settings → Developer tokens** and create a token
   (`cqt_…`). Copy it — it is shown once.
2. Open the extension's **Settings** (right-click the icon → Options, or the
   "Settings" link in the popup).
3. Enter the CareerQuest URL (default `http://localhost:3000`) and the token.
   The URL must be `https://` — plain `http://` is accepted only for a local dev
   server (`localhost`, `*.localhost`, `127.x.x.x`, `[::1]`). Without a scheme,
   `https://` is assumed for any other host.
4. Click **Save**. Chrome asks you to allow the extension to contact that URL —
   this is an *optional* host permission requested only for your CareerQuest
   origin (Chrome can grant `https://` sites, `http://localhost` and
   `http://127.0.0.1`; for any other origin the options page says so and
   CareerQuest must answer CORS for the extension instead). Saving also
   **revokes** the permission of a previously configured CareerQuest origin, and
   the connection is re-tested once Chrome grants access. **Revoke site
   permission** removes the current one.
5. **Test connection** calls `/api/extension/me` and shows your name. Testing
   values you have not saved yet never changes the saved connection state.

The token is kept in `chrome.storage.local` for this browser profile only. It is
sent solely as `Authorization: Bearer …` to the URL you configured, never over
plain http to a non-local host (the API client refuses, even for settings saved
by an older version), and is never written to logs.

## Supported sites (content scripts run only here)

Content scripts are limited to job-search, posting and application paths. They
never run in employee HR/payroll portals or candidate account/profile areas that
share these hosts (e.g. ADP Workforce Now pay statements, USAJOBS "My
Applications"/résumés, ZipRecruiter candidate profile, Workday candidate home).
These are the exact `content_scripts` match patterns from `manifest.json`
(`*` matches anything, including `/` and the query string):

| Platform | Match patterns |
| --- | --- |
| Indeed | `https://*.indeed.com/viewjob*`, `/jobs*`, `/q-*`, `/rc/clk*`, `/applystart*`, `/m/*`; `https://smartapply.indeed.com/*`; `https://*.apply.indeed.com/*` |
| LinkedIn | `https://*.linkedin.com/jobs/*` (job views incl. the Easy Apply modal) |
| Glassdoor | `https://*.glassdoor.com/job-listing/*`, `/Job/*`, `/job/*`, `/partner/*`, `/apply/*` |
| ZipRecruiter | `https://*.ziprecruiter.com/c/*/Job/*`, `/jobs/*`, `/jobs-search*`, `/ojob/*`, `/apply/*` |
| Workday | `https://*.myworkdayjobs.com/job/*`, `/*/job/*`, `/details/*`, `/*/details/*` (postings and the apply flow beneath them) |
| Greenhouse | `https://boards.greenhouse.io/*`, `https://job-boards.greenhouse.io/*` |
| Lever | `https://jobs.lever.co/*` |
| SmartRecruiters | `https://jobs.smartrecruiters.com/*`, `https://careers.smartrecruiters.com/*` |
| iCIMS | `https://*.icims.com/jobs/*` |
| ADP | `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/*` (career center), `https://workforcenow.adp.com/jobs/apply/*`, `https://recruiting.adp.com/srccar/*` |
| GovernmentJobs / NEOGOV | `https://*.governmentjobs.com/careers/*`, `https://*.governmentjobs.com/jobs/*` |
| USAJOBS | `https://*.usajobs.gov/job/*`, `/Job/*`, `/GetJob/*`, `/Applicant/Application/complete/*` (and its lower-case form) |

Any other site: open the popup and click **Capture this page**. That uses the
`activeTab` permission plus `chrome.scripting` to run the generic extractor
(JSON-LD `JobPosting`, Open Graph/meta, `<h1>`) on *that tab only, after your
click*. No other site is ever read.

## What the popup does

- **Connection status** — calls `/me`; shows *Connected · Name*, *Not connected*
  (→ Connect), or *Token rejected* (→ Reconnect) after a 401.
- **This page** — the detected company, title, location, salary text,
  requisition id, platform and a confidence meter.
- **Already tracked** — before you save, the extension calls
  `/api/extension/lookup` and lists existing CareerQuest records
  ("Already tracked: Acme · Apprentice Electrician · Submitted on …") with
  **Attach to this record**.
- **Save to CareerQuest** — sends a `JOB_PAGE` capture.
- **I submitted this application** — sends a `MANUAL_CONFIRMATION` capture with
  confidence 1.0 because you asserted it.
- **Did you submit this application?** — appears when the background flagged a
  *possible* confirmation (see below). Nothing is recorded until you click *Yes*,
  and *Yes* records the job the prompt names (the page it was raised on), even if
  the tab has moved on since. *No* is remembered for that page and phrase, so
  re-renders and reloads do not ask again.
- Footer: queued captures ("2 captures waiting to send · Retry now") and Settings.

## How confirmation detection works

Each platform script looks, on every render (debounced `MutationObserver` + URL
watch, so single-page apps are covered), for three signals:

| Signal | Example |
| --- | --- |
| phrase in **visible** text | "Your application has been submitted", "Application sent", "Thank you for applying", … (per-platform list, whole words only) |
| confirmation **route** | URL contains `/post-apply`, `/thanks`, `/confirmation`, Workday `/apply/applied`, … (specific confirmation paths; no bare `/applied`, `/complete` or `/submitted`) |
| confirmation **element** | e.g. Greenhouse `#application_confirmation`, Workday `applyFlowCompletedPage`, LinkedIn `post-apply-modal` (platform-specific; never a bare `*confirmation*` class) |

Where a phrase may come from:

- Text in `nav`, `footer` (`role=navigation/contentinfo`), hidden elements,
  closed `<details>` (FAQ accordions) and form controls is never searched.
- On a page with JSON-LD `JobPosting` (i.e. a job posting) a phrase in the
  description, a heading or a status line does not count; it counts only inside
  the platform's confirmation element, a dialog/alert, or as a heading on a page
  that also has a confirmation route/element.
- Ambiguous single words (ZipRecruiter's "Applied") count only as the entire
  text of one element (a badge/button): "Applied Materials" or "applied behavior
  analysis" never match, and a list with several "Applied" badges is ignored.

Confidence: phrase + route + element → **0.95**; phrase + route or element →
**0.9**; phrase only → **0.7**; route/element only → **0.7**; ambiguous word →
**0.6** (**0.7** with a route/element). Only a confirmation with confidence
**≥ 0.8** — i.e. a phrase corroborated by the platform's confirmation route or
element — is sent automatically (`CONFIRMATION_PAGE`), and even then the request
contains only the matched sentence (≤ 300 characters, ending at the edge of the
element that contains it, with e-mail addresses and phone numbers masked as
`[email]`/`[phone]`), never the page. Anything lower sets a *pending* flag
(badge **!**) and the popup asks you. An apply form on screen is reported as
`APPLY_STARTED` (badge **…**) which only pre-fills that prompt — it is never
recorded as submitted.

A pending prompt stays until you answer it or the tab shows a *different* job's
posting (different requisition id / job id / title); a page that is not
recognisably a posting (e.g. Workday's candidate home after submitting) keeps
it. A page known only by its `<title>` is not treated as a job posting.

Confirmation pages that do not repeat the job title are pre-filled from the job
page seen earlier in the same tab — only if that page was on the same site, less
than 2 hours ago, and no identifier (requisition id, job id in the URL, title,
company) contradicts it. The prompt says when details were pre-filled.

Badges: **✓** already tracked / sent, **!** confirmation pending your answer,
**…** application in progress, **↻** capture queued for retry.

## Offline / errors

Captures that fail with a network error, 5xx or 429 are stored in a small local
queue and retried with exponential backoff (30 s base, capped at 6 h, max 8
attempts) through `chrome.alarms`; 429 honours `retryAfterSeconds` per item (the
alarm only sends items whose own time has come). A 401 clears the connected
state (the popup shows *Reconnect*) and **parks** the queue: no retry alarm runs
until you save settings or a connection test succeeds ("Forget token" parks it
too). The popup re-checks a *Token rejected* state at most every 5 minutes. The
options page can **Retry now** (sends everything immediately) or **Clear local
queue**.

Queue updates are serialised and only one flush runs at a time, so a capture is
never sent twice by overlapping retries nor lost when queued during a flush.
Every capture carries a random `evidence.captureId` that stays the same across
retries, so the server can ignore duplicate deliveries.

## Limitations

- Job boards change their markup. Detection is best-effort: selectors have
  fallbacks (JSON-LD → meta → DOM → URL), but when a site changes, the extension
  degrades to asking you rather than guessing. The app always confirms before
  recording anything unverified.
- The extension never clicks, submits, fills forms, or bypasses CAPTCHAs, logins
  or anti-automation measures. It only reads.
- Content scripts run in the top frame only; apply flows embedded in iframes are
  not observed (use "I submitted this application").
- The service worker fetches the API cross-origin. Either grant the optional host
  permission when saving the options (bypasses CORS) or have CareerQuest answer
  CORS for `chrome-extension://` origins.
- Narrow match patterns mean an apply step hosted outside them (e.g. a USAJOBS
  apply flow before the completion page) is not observed: use "I submitted this
  application" there.
- Free-text salary / requisition scans run only on recognised postings, inside
  the posting container when the platform has one; a "$…" figure inside the
  posting text (e.g. a bonus) may still be read as the salary.

## Development

```
extension/
  manifest.json
  src/background.js         service worker: message hub, API client, badge, queue
  src/lib/*.js              pure modules (no chrome.*): api-client, queue, capture, url, constants
  src/content/common.js     shared extraction helpers + config-driven detector (window.__cqCommon)
  src/content/<site>.js     one detector per platform (registers window.__cqDetect)
  src/content/generic.js    generic extractor used by "Capture this page"
  src/popup/, src/options/  extension pages (ES modules, strict MV3 CSP)
  scripts/make-icons.js     regenerates icons/*.png with a tiny pure-node PNG encoder
  tests/                    Playwright suite (see below)
```

Documented page-side globals: `window.__cqCommon` (helpers) and
`window.__cqDetect()` (current detection). Both live in the content-script
isolated world. Debug the popup as a tab with
`chrome-extension://<id>/src/popup/popup.html?tabId=<tab id>`.

### Tests

From the repo root (`careerquest/`):

```
npx playwright test -c extension/tests/playwright.config.js
```

- `tests/specs/lib.spec.js` — **unit** tests of `src/lib` in plain Node (no browser),
  including a check of the manifest's match patterns against job-board URLs that
  must (and HR/profile URLs that must not) receive a content script.
- All other specs are **extension-loaded**: `tests/fixtures.js` launches a
  persistent Chromium context with `--load-extension` (headless works with the
  full Chromium binary, Chromium 141 "new headless"). The real job-board
  hostnames are mapped to the local HTTPS fixture server with
  `--host-resolver-rules`, so the manifest's real `content_scripts` matches inject
  the real detectors into `tests/fixtures/*.html`. A mock CareerQuest API
  (`tests/servers/mock-api.js`, 127.0.0.1:4320) records every request and can be
  scripted to answer 503/429/401.
- The generic extractor and the shared helpers are additionally unit-tested by
  injecting `common.js`/`generic.js` with `page.addScriptTag` into fixture pages
  served from `127.0.0.1` (no content-script match) and calling `window.__cqDetect()`.
- Negative cases (phrases in descriptions/nav/footer/closed FAQs, "Applied
  Materials", applied-jobs lists, status lines, adjacent PII, review-step
  answers, out-of-scope HR/profile pages) and queue concurrency / 401 / 429 cases
  are covered in `detectors`, `capture-flow` and `queue` specs.
- What automation cannot cover: Chrome's native permission prompt
  (`chrome.permissions.request`) never resolves in headless, so the options test
  asserts the stored request flag (revocation and re-test after a grant are
  tested with an in-page fake of `chrome.permissions`); `activeTab` cannot be granted
  programmatically, so "Capture this page" on a non-listed site is verified
  manually (the same code path is exercised on a listed site).

Set `CQ_HEADED=1` to watch the browser; `PLAYWRIGHT_CHROMIUM_PATH` overrides the
browser binary (defaults to `/opt/pw-browsers/chromium` when present).
