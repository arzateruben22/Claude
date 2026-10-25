# Changelog

## 0.1.0 — 2026-10-25 (Stage A)
- Foundation: schema, domain rules, seed, and the episode import from the films pipeline.
- Every Stage A screen, the Upload Desk with manual publishing, the PWA shell, the worker.
- Tests: 52 domain/library tests and a 14-step end-to-end run.
- Fixed while testing:
  - Raw-SQL array parameters (reward balances, job type filter).
  - A spring-forward daylight-saving time converted 31 minutes late.
  - Unlock celebrations were lost when the task left the desk.
  - Media streams crashed the server when the browser cancelled.
