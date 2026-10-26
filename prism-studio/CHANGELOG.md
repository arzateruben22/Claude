# Changelog

## 0.3.0 — 2026-10-26 (Stage B complete)
- Costs screen: monthly production budgets (studio-wide and per channel), spent vs budget by month, cost entries with add/edit/void, ESTIMATE labels, and the paid-generation gate (`canUsePaidGeneration`).
- Settings → Show demo data (off by default); DEMO labels on the desk, review, calendar and analytics; real-only analytics totals; `db:seed -- --demo`.
- Nav badge counts and channel episode counts no longer include demo episodes.

## 0.2.0 — 2026-10-25 (Stage B + Stage C first cut)
- Lessons (compilations) built by the worker; Learn screen; posting text engine with POSTING.md packs.
- Automated publishing: connector contract, sealed OAuth grants, connect flow, publish and status jobs, scheduler, Publish now.
- Fixed: multi-line VO lines were cut at the first line end when read from script.md.

## 0.1.0 — 2026-10-25 (Stage A)
- Foundation: schema, domain rules, seed, and the episode import from the films pipeline.
- Every Stage A screen, the Upload Desk with manual publishing, the PWA shell, the worker.
- Tests: 52 domain/library tests and a 14-step end-to-end run.
- Fixed while testing:
  - Raw-SQL array parameters (reward balances, job type filter).
  - A spring-forward daylight-saving time converted 31 minutes late.
  - Unlock celebrations were lost when the task left the desk.
  - Media streams crashed the server when the browser cancelled.
