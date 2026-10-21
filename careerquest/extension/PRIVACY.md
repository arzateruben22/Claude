# Privacy — CareerQuest Job Tracker

This extension exists to save job postings and application confirmations to
*your* CareerQuest account. It is built to read as little as possible.

## What is collected

Only these fields, and only from pages on the supported job boards (or from a
page you explicitly capture with the popup button):

| Field | Source |
| --- | --- |
| Company name | JSON-LD `JobPosting.hiringOrganization`, `og:site_name`, known heading elements |
| Job title | JSON-LD `JobPosting.title`, `og:title`, known heading elements |
| Location | JSON-LD `jobLocation`, known location elements |
| Salary text | JSON-LD `baseSalary`, known salary elements, or a `$…` pattern in visible text |
| Requisition / job id | JSON-LD `identifier`, known elements, "Req ID …"/`R-12345`-style patterns, the URL |
| Canonical page URL | `<link rel="canonical">` or the tab URL (fragment removed, max 2048 chars) |
| Page title | `document.title` (max 300 chars) |
| Platform | derived from the hostname |
| Confirmation sentence | at most 300 characters of the one sentence that matched a known confirmation phrase (e.g. "Your application has been submitted") — only for confirmation captures |
| Capture metadata | which signals matched (`detectedBy`), a confidence score, timestamp |

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
  (≤ 300 characters) is kept.
- Anything from a page unless it is a supported job board, or you clicked
  "Capture this page" in the popup for that tab (`activeTab`).

## Where data goes

- Captures are sent **only** to the CareerQuest URL you configure in the options
  page, authenticated with your developer token. The extension asks Chrome for
  permission to contact that single origin (an *optional* host permission).
- Captures that cannot be delivered are kept in `chrome.storage.local` on your
  device until they are sent (or you clear the queue in the options page).
- The developer token is stored in `chrome.storage.local` for this browser
  profile and is redacted from all logging.
- No analytics, no third-party services, no remote code.

## Your control

- Nothing is recorded as a submitted application unless either a recognized
  confirmation page is detected with confidence ≥ 0.8, or you click
  "I submitted this application" / "Yes" in the popup.
- The extension never submits forms, clicks buttons, bypasses CAPTCHAs, logins or
  anti-automation measures, or acts on a page in any way.
- Remove the token with "Forget token" in the options page, clear the queue with
  "Clear local queue", or uninstall the extension to delete all local data.
