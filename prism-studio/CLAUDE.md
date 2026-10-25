# Prism Studio: notes for Claude

- **The database is the source of truth.** These markdown files are developer memory only. Never put business
  facts (accounts, money, numbers) in code or docs.
- **Rules live in `src/domain/`.** Screens and actions call the domain; they don't reimplement its rules. Each rule
  that can go wrong has a test in `tests/`. Add one when you add a rule.
- **Never** store platform passwords, recovery codes or 2-step codes. Never invent account-specific links: only
  official generic links, or ones built from an ID the owner entered (`youtubeStudioFor`).
- **Publishing is manual.** Opening, downloading, sharing or copying never marks anything published; only
  "Mark uploaded" (owner-reported) or a verified integration does. One publication record per destination.
- **Approvals bind an exact export** (file hash + title + caption + hashtags + cover + disclosures + destination).
  Any change withdraws the approval.
- **Money:** Prism never moves money. Personal rewards are owner-funded, reserved only within the funded balance
  and the monthly cap, under a row lock. Demo or estimated numbers never create or reserve a reward. Production
  budgets are separate, and paid generation stays off without one.
- **Demo data** is always labelled DEMO (or SIMULATED) on screen and never counts as real progress.
- Times are stored in UTC and shown in the studio timezone (`src/domain/time.ts`, DST-safe).
- Raw SQL: drizzle expands a JS array parameter into a parenthesised list. Write `col in ${arr}`, never `= any(${arr})`.
- Verify with `npm run typecheck && npm test && npx next build`, then click through at 390 px and desktop.
