# SoCal Dispatch System — Rulebook

Operating rules for the Atlas SoCal (105 Freeway / EA 07-314524 + D8 + CTC) testing
dispatch, checklist, logs, and invoicing pipeline. Compiled from the owner's answers
and verified against the 2026 SoCal Checklist Budget Tracker workbook and real
July 2026 emails. Last updated: 2026-07-31.

## Pipeline (one job, end to end)

1. **Client notice arrives** — FMJV105 portal email `[EXTERNAL]`, no-reply.
   Two types: *Compaction Notice* and *Concrete Pour Notice (CPN)*. The notice
   number (e.g. `CPN# ID: 852`) becomes the dispatch ID used in log numbers.
2. **Dispatch** — Atlas assigns inspector(s), files Field Testing Request Form(s),
   and sends the dispatch email. Log number format: `MMDDYY-ID###-Description-1`
   where MMDDYY is the **actual work date**.
3. **Checklist entry** — one row per inspector per shift on the `SoCal CList` tab.
4. **Logs** — fabricated specimens entered in `Whittier Cylinder Log` /
   `Whittier Beam Log`, one row per break age (e.g. 2 @ 42-day + 2 @ 90-day hold).
   Break dates = cast date + cure days; future break rows appear on the checklist
   under Whittier Lab on the break date.
5. **Daily log / timesheet** — inspector submits hours, miles (odometer), group.
6. **Invoice** — monthly tab; manually transcribed from the checklist.
   Lab breaks roll up per day: tests = specimens broken, ~0.5 hr per specimen.

## Groups

- **Group 1** = field work
- **Group 2** = plant work
- Project 105 uses named groups: `Field (23-0454.12)`, `Lab (23-0454.00)`.

## Labor codes

- **PW** — majority of the shift's hours fall inside 6:00 AM–5:00 PM.
- **PWSS** (special shift) — majority of hours fall outside 6:00 AM–5:00 PM.
- **Non-PW** — miscellaneous: interviews, PTO, and similar.
- **Tie-breaker** — a 50/50 shift codes to the side where the shift *started*.
- **OT 1.5** — automatic all day Saturday; and any hours past 8 in a day.
- **OT 2.0** — automatic all day Sunday; and after 4 hours of OT 1.5, remaining
  hours go to 2.0 (weekday: 8 regular → 4 @ 1.5 → 2.0 past hour 12).
- **OPEN QUESTION:** on Saturday, does the 4-hour OT rule roll hours 5+ to 2.0?
- **OPEN QUESTION:** are Whittier Lab break lines exempt from shift rules?
  (Observed: lab lines are always PW-Regular, even 10:15 PM on Saturday 7/4.)
- **OPEN QUESTION:** holiday coding/pay.

## Overnight splits

A shift crossing midnight gets a second checklist row dated the next day at
12:00 AM with **Status = "Shift Change"**, carrying the post-midnight hours.
If the spillover lands on Saturday, that row's shift type becomes OT.
"Repeat" status rows are re-listings of the same dispatch — not extra work.

## Miles

Read from the **odometer on the inspector's daily log**. Verification: match the
daily log exactly; flag values identical to the same inspector's previous day;
flag outliers vs. that inspector's history.

## Split jobs vs single-inspector jobs

- **Single inspector:** one request form; Remarks combines duties
  ("Plant Inspection / Cylinder Fabrication (…)"); one dispatch email with both
  duty bullets; one checklist row.
- **Split job:** two request forms sharing the same Log #, differing only in
  Approximate Time, Engineer's Name, and Remarks (which states the portion).
  Two dispatch emails (duty in the subject), staggered times (plant inspector
  starts ~1 hr before fabrication). Checklist: one row per inspector.
- **Compaction batching:** client sends one notice per test; dispatch batches
  them into one email per inspector-shift with per-test times; checklist stacks
  all tests in a single row's cells. **Additional compactions added later for
  the same inspector + day (same project) are appended into that existing
  checklist row (new time + log # stacked in the cells) — do NOT create a new
  row.** Compaction dispatch emails do not use the `REVISED:` subject prefix —
  that convention is for pour/fabrication re-sends.
- Inspector named on the form may differ from who actually works it —
  reassignment between form and execution is normal.

## District 8 checklist entry format

D8 jobs use a different Job Description style than 105 (no time/ID# prefix).
Format: `Concrete Plant Inspection -  N Cylinders for every X CY & N Breaks
@ D days (UW, KB, AC, Temp) - Mix #<mix> - <total> CY / See Dispatch Email /
Check Request` (e.g. "3 Cylinders for every 1,500 CY & 3 Breaks @ 42 days
(UW, KB, AC, Temp) - Mix #2102-Opt1 - 2,500 CY"). Columns: Project = D8,
EA = 1C08U4-style, Task Order = #N, Group = numbered (1 field / 2 plant).
Cylinder sets are named `S#N_Mix#<mix>`; hours flow to the D8 tabs, not the
105 invoice. Example verified: EA 8/6/26 Coffman Plant shift, Group 2,
8 PWSS Reg + 1 PWSS 1.5 OT.

## Email formats

### Inbound client notices (FMJV105 Noreply, `[EXTERNAL]`)
- Compaction: `FMJV105 COMPACTION REQUEST# ID: NNN - date - title`. Fields:
  Compaction Date/time, Package, Title, Requirement %, Site Access, Test By,
  Source Material, Contact. Revisions re-send with
  `Inspection Request: Revised Detail` and a newer "last revised" timestamp.
- Pour: `New Request - FMJV105 CPN# ID: NNN - date - placement` (revisions:
  `Revise Detail - …`). Fields: mix design + application, pour date/time,
  location, quantity CY, pour rate, plant, strength, slump, admixtures,
  sample qty, washout, field contact. Mix design PDF attached.
- Client notices may contradict themselves (e.g. CPN #833 said JPCP placement
  with an LCB mix block) — always sanity-check before drafting.
- Client's requested time is advisory; dispatch sets the actual schedule.

### Outbound dispatch emails
- From dispatcher "on behalf of SoCal Dispatch".
- To: SoCal Dispatch; Vosoughi, Payam (Consultant); + assigned inspector
  (the only variable). Cc: fixed metro.net/HNTB/Accenture list.
- Subject: `105 Freeway / 07-314524 - MM/DD/YYYY - [Duty]: [Scope] @ [time]`
  (compaction: `… - Compactions - MM/DD/YYYY - 9:00 AM to 1:00 PM`).
- Body skeleton: "Hello," → "Your testing request has been assigned to
  Inspector, NAME, his cell number is ###." → per job: highlighted scope line,
  bold `Duty – date @ time`, `Cylinder Pick-Up – next date`, spec bullets
  (`-Fabricate N cylinders, n for D-Day Break and n for Hold (Temp, AC, KB, & UW).
  One set every X CY.` / beams line / `-Inspector to perform Concrete Plant
  Inspection – Drop off aggregate samples @ Whittier Lab`), `Log #: …` →
  escalation list (Foreman → METRO Field Inspector → Michael Maksimos →
  Payam Vosoughi) → delay/cancellation note (reply-all + Teams) → signature.
- Revisions: subject prefixed `REVISED:`, full email re-sent, same Log # —
  supersedes the previous email. A revision may change the job entirely
  (7/30: ID835 WB LCB revised into EB JPCP, same ID kept).
- Attachments: plant contacts docx, mix design PDF(s), request form xlsx per Log #.

### Request form (Field Testing Request Form, revised 09/14/23)
- Blanks keep constants: EA 07-314524, RE Dan Leon + phone, LA/105.
- Machine-readable: header fields by cell, plus legacy checkbox controls
  (checked state in ctrlProps) for material type (LCB/JPCP/PCC…), tests
  (UW/BP/Air), Beam/Cylinder Break, break-day schedule, compaction type + %.
- Key cells: C9 inspector, C10 date needed, G10 time, C11 quantity, K11 mix,
  E12 test number, C48 engineer (Atlas), C49 Log No, C51 Remarks (duty split).

## Naming / data conventions

- Log/set numbers use the **actual cast date** after reschedules.
- Dispatch IDs come from the client portal and are NOT globally unique across
  the year — the full log number is the unique key.
- Fabrication specs by material: LCB = 4 cyl, 2 @ 7-day + 2 hold;
  structural PCC = 4 cyl, 2 @ 42-day + 2 hold; JPCP = 6 cyl 3 @ 42-day +
  3 hold + 3 beams @ 7-day (occasionally 3/5-day early-age beams).
  Hold = 90 days.
- Client CPN boilerplate ("6 cylinders per 150 CY") is routinely overridden by
  Atlas standard specs above.

## Verification checks (the audit)

1. Checklist break rows ↔ cylinder/beam log rows: set #, date (cast + days),
   qty, tank.
2. Dispatch email/notice ↔ checklist ↔ log cast entries (by log number).
3. Reverse: performed log breaks must appear on the checklist.
4. Set-name date prefix must equal cast date; year suffix must match year.
5. Internal log sanity: no times in date columns (1900 dates), tanks filled in.
6. Invoice lab lines: tests = checklist specimens that day, hours ≈ 0.5/specimen.
7. Labor codes per rules above; miles per daily log + repeat/outlier flags.

## Duty determines expected deliverables (completion verification)

The DISPATCH EMAIL's duty line is the source of truth for what a completion
report must contain — not the request form's fabrication section (the form
describes the whole job; the duty describes that inspector's portion):
- "Concrete Plant Inspection" only -> batch check / PCC record / aggregates;
  NO fabrication docs expected, NO cylinder/beam log entries from this report.
- "Plant Inspection & Cylinder Fabrication" (combined, one inspector) ->
  fabrication docs expected; create cylinder/beam log entries + break rows.
- Split job -> judge each inspector's report only against their own portion;
  the fabrication portion's report drives the log entries.

## Inspector completion email

Subject-only email (no body) from the inspector, subject format:
`YY-MMDD_LogNumber_Project-105_07-314524_Duty_Mix#_Initials`
(e.g. `26-0729_072926-ID845-DS6-1_Project-105_07-314524_PI_Cylinders-Mix#55723740_FC`).
Attachments (typical full set, ~14 files): mix design PDF, MPQP + Weighmaster
certs, request form xlsx, batch ticket PDF, COC PDF, cylinder location docx,
aggregate sampling docx, batch check xlsx, concrete testing xlsm, cylinder
break sheet xlsx, daily PCC record xlsx, TL-0101 xlsm, **inspector daily log
xlsx**. Verify subject log # against attachments — first specimen received had
ID846-DS9 in the subject while all 14 attachments were ID845-DS6.

## Inspector daily log (xlsx, "Materials Engineering Staff Daily Report")

- Sheet "Daily Report". Header: E4 contract, E5 EA, E6 date performed,
  E7 tester name.
- Time blocks from row 11: col A category (Field/Lab/Lunch), F start, J stop,
  N task description. Lunch is its own row and is unpaid.
- Vehicle Use (~rows 32-35): A34 beginning odometer, F34 ending odometer,
  K34 mileage (must equal end-start), P34 itinerary, vehicle make/model/plate.
- Hours Worked boxes (~rows 41-44): PW Regular / PW 1.5 OT / PW 2.0 DT /
  PWSS Regular / PWSS 1.5 / PWSS 2.0; group ("Field"/"Lab") nearby (~AI44).
- One daily log can cover multiple jobs/pours in the same shift — task rows
  name each plant visit and mix; match mixes to the dispatched jobs that day.
- Verified example (FC 7/29): shift 2:00 AM-10:30 AM, 30-min lunch, 8.0 hrs
  PW Regular (majority of hours inside 6 AM-5 PM -> PW ✓), 57 miles
  (30560→30617 ✓), covered ID844 (Mix 557237) + ID845 (Mix 55723740).

## Lunch rules (verification checks)

- 1st lunch must begin no later than 4:59 into the shift.
- 2nd lunch must begin no later than 9:59 into the shift when working more
  than 12 hours; waivable when the shift is under 12 hours.
- Lunch rows are unpaid and excluded from billed hours.

## QC compliance & reasonableness checks

Reasonableness (baseline-building — refine as more daily logs arrive):
- Drive time vs miles: travel-row duration must be plausible for the itinerary
  distance; flag both too-long and too-short.
- Time-on-task norms (seed values from FC 7/29 log): batch check ~30 min,
  aggregate sampling ~30 min, concrete testing ~45-60 min, travel
  Whittier<->Gardena ~45 min, lab break ~0.5 hr/specimen. Flag large outliers.
- Identical durations/miles repeated day after day = copy-paste flag.

Caltrans/spec compliance (encode rules QC actually enforces; confirm refs):
- Breaks performed on the scheduled cure date (cast + cure days), not late.
- Specimens buried/cured within the required window after cast.
- Sampling frequency honored: one set per 300 CY (structural/LCB) or
  1,000 CY (JPCP) vs CY actually poured per batch tickets.
- Reports submitted within required turnaround.
- Lunch rules (see Lunch section) — meal-period compliance.
- Form cites 2018 Standard Specs 40-1.01D(1) for fabrication/curing/handling.
- OPEN: collect the specific spec references QC holds inspectors to.

## Known open items

- Daily log + timesheet examples not yet provided (hours/miles/group leg).
- Rulebook open questions above (Saturday 2.0, lab exemption, holidays).
- Findings punch list: `findings/SoCal_CrossCheck_Findings.xlsx` (49 items,
  vs. the 7/30 workbook; still unfixed as of the 7/31 file), plus:
  ID855 cast entry missing (7/31), tank "?" placeholders on new log rows,
  Ferreira/Ferrerira spelling drift, compaction email subject-date typo
  (said 7/30, logs 073126).
