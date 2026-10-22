# Privacy — CareerQuest Job Tracker

This extension exists to save job postings and application confirmations to
*your* CareerQuest account. It is built to read as little as possible.

## What is collected

Only these fields, and only from the job-search, posting and application pages
of the supported job boards listed with their exact URL patterns in
[README.md → Supported sites](README.md#supported-sites-content-scripts-run-only-here)
(or from a page you explicitly capture with the popup button). The extension
does not run in HR/payroll portals or candidate account areas on the same hosts
— for example ADP Workforce Now pages outside its career center
(`/mascsr/default/mdf/recruitment/`), USAJOBS "My Applications"/profile pages,
ZipRecruiter candidate profile/settings, or Workday candidate home.

| Field | Source |
| --- | --- |
| Company name | JSON-LD `JobPosting.hiringOrganization`, `og:site_name`, known heading elements |
| Job title | JSON-LD `JobPosting.title`, `og:title`, known heading elements |
| Location | JSON-LD `jobLocation`, known location elements |
| Salary text | JSON-LD `baseSalary`, known salary elements, or a `$…` pattern in the posting text¹ |
| Requisition / job id | JSON-LD `identifier`, known elements, the URL, or "Req ID …"/`R-12345`-style patterns in the posting text¹ |
| Canonical page URL | `<link rel="canonical">` or the tab URL (fragment removed, max 2048 chars) |
| Page title | `document.title` (max 300 chars) |
| Platform | derived from the hostname |
| Confirmation sentence | at most 300 characters of the one sentence that matched a known confirmation phrase (e.g. "Your application has been submitted") — only for confirmation captures. It ends at the edge of the element that contains it (text in a neighbouring element, such as your name or e-mail under the banner, is never included) and e-mail addresses and phone numbers in it are replaced by `[email]` / `[phone]`² |
| Capture metadata | which signals matched (`detectedBy`), a confidence score, timestamp, and a random capture id (`captureId`) that lets CareerQuest ignore a duplicate delivery of the same capture |

¹ The free-text scans run **only** on a page identified as a job posting (JSON-LD
`JobPosting` or the platform's own title/company element) — never on apply
forms, review steps, confirmation pages or unrecognised pages — and only inside
the posting/description container when the platform has one. Residual: a `$…`
figure or id written inside the posting text itself (e.g. a sign-on bonus) can
be picked up as the salary / requisition id.

² Residual: a name that is part of the matched sentence itself (e.g. "Thank you
for applying, Jane") is not removed.

Every field is trimmed and length-limited before it leaves the page, and the
request body is built from an allow-list (`src/lib/capture.js`): nothing else can
be included even if a detector returned it.

## What is never read or sent

- **Form field values** of any kind: name, email, phone, address, SSN, passwords,
  payment details, résumé text, cover letters, answers to screening questions.
  The text scanner skips `input`, `textarea`, `select` and `option` elements
  entirely, as well as scripts, styles and hidden content.
- Cookies, session storage, local storage of any website.
- Browsing history or pages on sites other than the supported job boards. The
  extension requests no `tabs`, `history`, `webNavigation` or `<all_urls>`
  permission; content scripts are limited to the hosts listed in
  `manifest.json`.
- Full page text or HTML. For confirmation detection only the matched sentence
  (≤ 300 characters, masked as described above) is kept. Text in navigation,
  footers, hidden elements and closed FAQ sections is not searched.
- Anything from a page unless it is a supported job board, or you clicked
  "Capture this page" in the popup for that tab (`activeTab`).

## Where data goes

- Captures are sent **only** to the CareerQuest URL you configure in the options
  page, authenticated with your developer token. The extension asks Chrome for
  permission to contact that single origin (an *optional* host permission); when
  you change the URL, the permission for the previous origin is revoked, and the
  options page can revoke the current one.
- The URL must use `https://`; plain `http://` is accepted only for a CareerQuest
  running on this computer (`localhost`, `127.x.x.x`, `[::1]`), so the token never
  crosses the network unencrypted.
- Captures that cannot be delivered are kept in `chrome.storage.local` on your
  device until they are sent (or you clear the queue in the options page). While
  CareerQuest rejects the token, they wait without retrying.
- Also in `chrome.storage.local`: the per-tab "did you submit?" prompt (the
  detected job fields, cleared when you answer or close the browser), and for up
  to 30 days (at most 500 entries each) the page URL + matched phrase of prompts
  you answered and of confirmations already recorded, so you are not asked twice
  and nothing is recorded twice.
- The developer token is stored in `chrome.storage.local` for this browser
  profile and is redacted from all logging.
- No analytics, no third-party services, no remote code.

## Your control

- Nothing is recorded as a submitted application unless either a recognized
  confirmation page is detected with confidence ≥ 0.8 — a confirmation phrase
  together with the platform's confirmation URL or confirmation element; a
  phrase alone, an "Applied" badge or a phrase inside a job posting never
  qualifies — or you click "I submitted this application" / "Yes" in the popup.
  "Yes" records the job the prompt names.
- The extension never submits forms, clicks buttons, bypasses CAPTCHAs, logins or
  anti-automation measures, or acts on a page in any way.
- Remove the token with "Forget token" in the options page, clear the queue with
  "Clear local queue", or uninstall the extension to delete all local data.
