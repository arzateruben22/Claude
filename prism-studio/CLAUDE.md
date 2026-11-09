# Prism Studio: notes for Claude

- **The database is the source of truth.** These markdown files are developer memory only. Never put business
  facts (accounts, money, numbers) in code or docs.
- **Rules live in `src/domain/`.** Screens and actions call the domain; they don't reimplement its rules. Each rule
  that can go wrong has a test in `tests/`. Add one when you add a rule.
- **Never** store platform passwords, recovery codes or 2-step codes. Never invent account-specific links: only
  official generic links, or ones built from an ID the owner entered (`youtubeStudioFor`).
- **Publishing is manual.** Opening, downloading, sharing or copying never marks anything published; only
  the owner's "Uploaded" buttons (owner-reported) or a verified integration does. Nothing posts by itself; the buttons
  only record what the owner did. One publication record per destination.
- **Uploaded buttons (owner's decision, 9 Nov 2026):** the owner posts by hand and presses "Uploaded on YouTube & TikTok" /
  "Uploaded on Instagram"; that records owner-reported posts (audit-logged, undoable). Approvals are no longer part of the UI.
- **Video clearing (owner's request):** once both Uploaded buttons have stood 3 days (`VIDEO_CLEAR_GRACE_DAYS`), the worker's
  hourly `cleanup_uploaded_media` job erases that episode's `out/*.mp4` from the server and sets `episodes.video_cleared_at`
  (`src/domain/media-cleanup.ts`). Covers, captions and text stay; the importer keeps cleared episodes as they are;
  media-push skips their videos. Never inside a git checkout or a read-only mirror. Compilations are never touched.
- **Money:** Prism never moves money. Personal rewards are owner-funded, reserved only within the funded balance
  and the monthly cap, under a row lock. Demo or estimated numbers never create or reserve a reward. Production
  budgets are separate, and paid generation stays off without one.
- **Demo data** is always labelled DEMO (or SIMULATED) on screen and never counts as real progress.
- Times are stored in UTC and shown in the studio timezone (`src/domain/time.ts`, DST-safe).
- **Connectors** (`src/integrations/`) are pure API clients with injected `fetch`; the studio decides what/when to publish (`src/domain/publish.ts`). Only a platform's own "published" answer verifies a publication. Tokens are sealed; never log them.
- Raw SQL: drizzle expands a JS array parameter into a parenthesised list. Write `col in ${arr}`, never `= any(${arr})`.
- Verify with `npm run typecheck && npm test && npx next build`, then click through at 390 px and desktop.
