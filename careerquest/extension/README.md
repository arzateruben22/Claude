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
4. Click **Save**. Chrome asks you to allow the extension to contact that URL —
   this is an *optional* host permission requested only for your CareerQuest
   origin. Then click **Test connection**: it calls `/api/extension/me` and
   shows your name.

The token is kept in `chrome.storage.local` for this browser profile only. It is
sent solely as `Authorization: Bearer …` to the URL you configured and is never
written to logs.

## Supported sites (content scripts run only here)

| Platform | Pages |
| --- | --- |
| Indeed | job views, search job panes, Indeed Apply (`smartapply.indeed.com`) and its post-apply page |
| LinkedIn | `linkedin.com/jobs/*` including the Easy Apply modal |
| Glassdoor | job listings |
| ZipRecruiter | job pages and 1-Click Apply |
| Workday | `*.myworkdayjobs.com` postings, apply flow, completion page |
| Greenhouse | `boards.greenhouse.io`, `job-boards.greenhouse.io` |
| Lever | `jobs.lever.co` |
| SmartRecruiters | `jobs.smartrecruiters.com`, `careers.smartrecruiters.com` |
| iCIMS | `*.icims.com` portals |
| ADP | `workforcenow.adp.com`, `recruiting.adp.com`, ADP career/recruitment pages |
| GovernmentJobs / NEOGOV | `*.governmentjobs.com` |
| USAJOBS | `usajobs.gov` |

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
  *possible* confirmation (see below). Nothing is recorded until you click *Yes*.
- Footer: queued captures ("2 captures waiting to send · Retry now") and Settings.

## How confirmation detection works

Each platform script looks, on every render (debounced `MutationObserver` + URL
watch, so single-page apps are covered), for three signals:

| Signal | Example |
| --- | --- |
| phrase in **visible** text | "Your application has been submitted", "Application sent", "Thank you for applying", … (per-platform list) |
| confirmation **route** | URL contains `/post-apply`, `/applied`, `/thanks`, `/confirmation`, … |
| confirmation **element** | e.g. Greenhouse `#application_confirmation`, Workday `applyFlowCompletedPage`, LinkedIn `post-apply-modal` |

Confidence: phrase + route/element → **0.9–0.95**; phrase only → **0.8**;
route/element only → **0.7**; an ambiguous single word such as ZipRecruiter's
"Applied" badge → **0.6**. Only a confirmation with confidence **≥ 0.8** is sent
automatically (`CONFIRMATION_PAGE`), and even then the request contains only the
matched sentence (≤ 300 characters), never the page. Anything lower sets a
*pending* flag (badge **!**) and the popup asks you. An apply form on screen is
reported as `APPLY_STARTED` (badge **…**) which only pre-fills that prompt — it is
never recorded as submitted. Confirmation pages that do not repeat the job title
are pre-filled from the job page seen earlier in the same tab.

Badges: **✓** already tracked / sent, **!** confirmation pending your answer,
**…** application in progress, **↻** capture queued for retry.

## Offline / errors

Captures that fail with a network error, 5xx or 429 are stored in a small local
queue and retried with exponential backoff (30 s base, capped at 6 h, max 8
attempts) through `chrome.alarms`; 429 honours `retryAfterSeconds`. A 401 clears
the connected state (the popup shows *Reconnect*) and keeps the capture queued
until you reconnect. The options page can **Retry now** or **Clear local queue**.

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

- `tests/specs/lib.spec.js` — **unit** tests of `src/lib` in plain Node (no browser).
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
- What automation cannot cover: Chrome's native permission prompt
  (`chrome.permissions.request`) never resolves in headless, so the options test
  asserts the stored request flag; `activeTab` cannot be granted
  programmatically, so "Capture this page" on a non-listed site is verified
  manually (the same code path is exercised on a listed site).

Set `CQ_HEADED=1` to watch the browser; `PLAYWRIGHT_CHROMIUM_PATH` overrides the
browser binary (defaults to `/opt/pw-browsers/chromium` when present).
