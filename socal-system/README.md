# SoCal Dispatch System

Toolkit and knowledge base for the Atlas SoCal testing dispatch pipeline:
client request → dispatch email + request form → SoCal checklist → Whittier
cylinder/beam logs → invoice.

## Contents

- `RULEBOOK.md` — all operating rules (groups, labor codes, OT, splits, miles,
  email formats, naming conventions, verification checks). **Read this first.**
- `tools/parse_msg.py` — parses Outlook `.msg` / `.eml` emails: headers, body,
  and attachments (request-form xlsx files extract intact).
  Usage: `python tools/parse_msg.py <files...>`
- `tools/audit_workbook.py` — cross-checks a Budget Tracker workbook:
  checklist break rows ↔ cylinder/beam logs, internal log sanity, invoice
  lab-line reconciliation. Usage: `python tools/audit_workbook.py <workbook.xlsx>`
- `findings/SoCal_CrossCheck_Findings.xlsx` — the 49-item punch list from the
  full audit of the 7/30/2026 workbook (still open as of the 7/31 file).

## Workflow with Claude

1. Drop dispatch/client emails (.msg straight from Outlook) and the current
   workbook into the session.
2. Ask for: an audit (cross-check everything), a draft (dispatch email +
   checklist rows from a client notice or request form), or a ledger
   (per-job trace across all documents).
3. Findings come back with exact tab + row references; drafts follow the
   house formats in RULEBOOK.md.

## Not yet covered

Daily logs and timesheets (hours, miles, group verification) — examples
pending; see RULEBOOK.md open questions.
