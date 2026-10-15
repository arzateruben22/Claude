# SoCal Timesheet — Functional Spec v1

A timesheet program for Atlas SoCal inspectors that computes labor coding,
overtime, lunch compliance, and splits LIVE as time is entered — replacing
guesswork with the rules in `../RULEBOOK.md`. Static app, no build step.
Runs two ways from the same source: (a) repo/local copy, (b) claude.ai
artifact with a shared database (inspectors submit, managers review).

Pilot scope: this is a computation + validation + review tool. It runs
ALONGSIDE the official payroll system until the company adopts it. It never
silently guesses on an undecided rule — it flags "pending QC ruling."

## Files (all under `socal-system/timesheet/`)

- `index.html` — full standalone HTML document (doctype, head with ONLY
  charset/viewport/title/claude-viewport-meta/style; everything else,
  scripts included, inside body). The artifact variant is derived from it
  mechanically at publish time, so keep that head/body discipline exactly.
- `rules.js` — pure ES module. Zero DOM, zero storage, zero Date.now().
  THE rules engine. Importable from browser and node.
- `app.js` — ES module: UI logic, storage layer, export, print prep.
- `tests/rules.test.mjs` — node test runner, zero dependencies:
  `node tests/rules.test.mjs` prints per-case results and exits 1 on any
  failure, 0 when green.

## rules.js — public API (exact contract)

```js
// Time strings are 24h "HH:MM". A block whose stop <= start crosses midnight.
// category: "work" | "travel" | "lunch" | "break"
//   work+travel+break are PAID (count toward worked time and tier accrual);
//   lunch is UNPAID (excluded from everything except elapsed time).
// jobRef: optional string (log # / job tag) for multi-job allocation.

export function evaluateShift(input) { /* ... */ }
// input = {
//   date: "YYYY-MM-DD",            // calendar date the shift STARTS
//   blocks: [{category, start, stop, jobRef?, note?}],
//   priorMinutes?: number,          // paid minutes already worked earlier
//                                   // that day (other job/employer) — see §Tiers
//   options?: {
//     holiday?: boolean,
//     secondLunchWaived?: boolean,
//     dayMeta?: undefined,          // reserved
//   },
// }
// returns {
//   ok: boolean,                    // false when any flag.severity === "error"
//   workedMinutes, lunchMinutes, breakMinutes, elapsedMinutes,
//   family: "PW" | "PWSS",
//   familyReason: string,           // human sentence: counts + rule applied
//   tiers: [{code, minutes, hours}],// chronological-merged totals, see codes
//   byJob: [{jobRef, tiers:[{code, minutes, hours}]}], // allocation per jobRef
//   split: null | {                 // present when shift crosses midnight
//     dayOne: {date, tiers},
//     dayTwo: {date, tiers, shiftChange: true},
//   },
//   flags: [{severity, code, message}], // severity: "error"|"warn"|"ruling"|"info"
//   timelineOk: boolean,
// }

export function validateOdometer({begin, end, claimedMiles}) 
// → {miles, flags:[...]}  // error ODO_NEGATIVE when end<begin;
//                         // warn MILES_MISMATCH when claimedMiles≠end-begin

export function validateEA(project, ea)
// → flags: 105-Express EA must end in "4"; D8 EA must end in "3";
//   else warn EA_FORMAT with the rule named. CTC: no suffix rule.

export const FLAG_CODES = { /* every code below, as constants */ };
```

## Rule semantics (normative — the Verify phase tests these)

Authority order: RULEBOOK.md > this spec > implementation convenience.
All arithmetic in integer minutes. Hours reported as minutes/60 rounded to
2 decimals.

### Worked time
- workedMinutes = sum of work + travel + break block durations.
- lunchMinutes excluded from workedMinutes and from tier accrual.
- elapsedMinutes = last stop − first start (crossing midnight adds 24h).

### Family (PW vs PWSS)
- Window = 06:00–17:00 local clock, evaluated against the actual clock
  time of every PAID minute (post-midnight minutes use their real clock
  time on day two).
- inside = paid minutes with clock time in [06:00, 17:00); outside = rest.
- inside > outside → PW. outside > inside → PWSS.
- Exact tie → family of the shift's FIRST block start: start clock time in
  [06:00,17:00) → PW else PWSS.
- One family per shift; it prefixes every tier code of that shift.

### Tiers (accrual ladder)
- Accrual clock starts at priorMinutes (default 0). Each PAID minute
  increments it. Ladder by accrued total: minutes 1–480 → Regular;
  481–720 → 1.5 OT; 721+ → 2.0 DT. (8 hrs regular; after 4 OT hours
  everything further is 2.0 — rulebook.)
- Day-of-week minimums, applied PER MINUTE by the calendar day that minute
  falls on (matters for overnight): Saturday → minimum 1.5 OT;
  Sunday → minimum 2.0 DT. Effective tier = max(ladder tier, day minimum).
- Holiday (options.holiday): NO rule exists yet — compute as the weekday
  ladder and add flag ruling HOLIDAY_RULING. Never guess premium pay.
- Saturday open question: whether ladder 2.0 (after 4 OT hrs) applies on a
  Saturday where ALL hours are already 1.5 — i.e. do Saturday hours 5+
  roll to 2.0? RULEBOOK marks this OPEN. Behavior: keep 1.5 (ladder's
  Regular minutes map to 1.5 via the Saturday minimum; ladder 1.5 minutes
  stay 1.5; ladder 2.0 minutes (post-720 accrual) do go 2.0), and when a
  Saturday shift's paid time exceeds 240 min, add flag ruling
  SAT_RULING_2X explaining both readings.
- Tier codes: `PW Regular`, `PW 1.5 OT`, `PW 2.0 DT`, `PWSS Regular`,
  `PWSS 1.5 OT`, `PWSS 2.0 DT`.

### Overnight split
- If any paid/lunch minute falls on the day after input.date, split is
  non-null. dayOne = minutes before 24:00; dayTwo = minutes from 00:00,
  date = next calendar date, shiftChange: true (checklist "Shift Change"
  row). Tier accrual is continuous across midnight (one shift, one ladder);
  day minimums apply per actual calendar day (Fri→Sat spill: Sat portion
  min 1.5; Sat→Sun spill: Sun portion min 2.0; Sun→Mon spill: Mon portion
  reverts to pure ladder).
- tiers (top level) = dayOne + dayTwo merged.

### Lunch compliance (flag codes)
- Rule: 1st lunch must BEGIN ≤ 4h59m (299 min) after first block start,
  measured in elapsed clock time.
  - Shift with elapsedMinutes ≤ 299 and no lunch: no flag (rule vacuous).
  - elapsed > 299, no lunch block: error LUNCH1_MISSING.
  - First lunch starts at elapsed ≥ 300: error LUNCH1_LATE (message
    includes actual elapsed h:mm and the 4:59 limit).
- 2nd lunch: required when workedMinutes > 720 (over 12 hrs): must BEGIN
  ≤ 9h59m (599 min) elapsed. Missing → error LUNCH2_MISSING; late →
  error LUNCH2_LATE. When workedMinutes in (600, 720] and no second
  lunch: info LUNCH2_WAIVABLE ("second lunch waivable under 12 hrs" —
  note options.secondLunchWaived records the waiver; absent waiver the
  info flag still shows, severity info either way).
- Rest breaks: advisory only — if any continuous paid span without a
  break/lunch exceeds 240 min, warn REST_BREAK_ADVISORY (CA 10-min paid
  rest per 4 hrs, advisory pending company policy ruling).

### Timeline validation
- Blocks auto-sort by start (respecting midnight crossing: a block whose
  start is earlier than the previous block's stop clock time is placed on
  day two). After sorting: overlapping blocks → error OVERLAP; zero/negative
  duration after midnight adjustment → error BAD_BLOCK; gap > 0 min between
  consecutive blocks → warn GAP (gaps are off-clock; message states the gap
  isn't paid); total elapsed > 20h → error LONG_SHIFT (likely entry error).
- No blocks → error NO_BLOCKS. timelineOk = no error-severity timeline flags.

### Multi-job allocation (byJob)
- Every paid minute carries the jobRef of its block ("" when absent).
- byJob groups tier minutes by jobRef. Sum over byJob equals tiers exactly.
- priorMinutes exists precisely so a second job/employer in the same day
  does NOT restart the ladder: a second shift entered with priorMinutes=480
  begins at 1.5 OT.

### Flag codes (complete enum)
LUNCH1_MISSING, LUNCH1_LATE, LUNCH2_MISSING, LUNCH2_LATE, LUNCH2_WAIVABLE,
REST_BREAK_ADVISORY, SAT_RULING_2X, HOLIDAY_RULING, OVERLAP, BAD_BLOCK,
GAP, LONG_SHIFT, NO_BLOCKS, ODO_NEGATIVE, MILES_MISMATCH, EA_FORMAT.

### Golden vectors (reproduce the three REAL verified daily logs)
1. FC 2026-07-29 (Wed): work 02:00–05:00, lunch 05:00–05:30,
   work 05:30–10:30 → worked 480, PW (inside 270 vs outside 210 — count
   it: paid clock minutes 02:00–05:00 outside (180) + 05:30–06:00 outside
   (30) + 06:00–10:30 inside (270); 270>210) → 8.00 `PW Regular`, no
   error flags. (Real outcome on his daily log: 8 PW Regular.)
2. EA 2026-08-06 (Thu, D8): work 00:30–03:45, lunch 03:45–04:15,
   work 04:15–10:00 → worked 540; outside = 00:30–03:45 (195) +
   04:15–06:00 (105) = 300, inside = 06:00–10:00 (240) → PWSS;
   ladder: 480 Regular + 60 OT → `PWSS Regular` 8.00 + `PWSS 1.5 OT` 1.00.
   (Real outcome: 8 + 1.)
3. FC 2026-08-02 (Sun): work 05:00–08:00, lunch 08:00–08:30,
   work 08:30–15:30 → worked 600; inside 540 vs outside 60 → PW; Sunday
   minimum 2.0 on every minute → `PW 2.0 DT` 10.00. Lunch began 180 min
   in → compliant. (Real outcome: 10 PW 2.0 DT.)

## index.html + app.js — UI spec

Treatment: utilitarian field tool, industrial/roadwork character. NOT the
taco site's identity; this is an internal tool (CLAUDE.md's client-identity
rules don't apply, its accessibility floor does: 4.5:1, visible focus,
reduced-motion respected, core readable without JS failing gracefully).

Design tokens (use exactly; define per the artifact theme contract —
all tokens on bare `:root`, dark redefinitions under
`@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){...}}`
AND `:root[data-theme="dark"]{...}`, body gets explicit token background):
- Light: --bg:#F4F6F3; --surface:#FFFFFF; --ink:#1B232C; --muted:#5B6671;
  --line:#D7DDD6; --accent:#C8641E (work-zone orange, AA on surface);
  --ok:#2E7D43; --warn:#A96F0A; --err:#BB3A34; --ruling:#6B5CA8.
- Dark: --bg:#13181E; --surface:#1C232B; --ink:#E9EDF0; --muted:#97A2AC;
  --line:#2C353E; --accent:#E98B4B; --ok:#58B072; --warn:#D1A33C;
  --err:#E0726C; --ruling:#A79AD6. color-scheme: dark in both dark blocks.
- Type: Google Fonts "Barlow Semi Condensed" (600/700) for headings,
  labels, tier codes; system stack
  (-apple-system, "Segoe UI", Roboto, sans-serif) for body;
  font-variant-numeric: tabular-nums on all times/hours/odometer.
- Layout: single column, max-width 760px, mobile-first; side gutters
  padding-left/right: max(16px, env(safe-area-inset-left/right, 0px)) on
  the outer wrapper; `<meta name="claude:viewport-fit-sides" content="cover">`
  beside <title>. <title>SoCal Timesheet</title>.

Screens (tab bar, hash deep-links `#entry` `#review` `#rules`):

1. **Entry** (default): 
   - Inspector select (roster from CONTACTS.md: Aleksey Souglobov, Fernando
     Carranza, Alberto Pineda-Gonzalez, Eriberto Aragon, Rigoberto Arroyo,
     Carlos Viramontes, Steven Chang, Eduardo Gomez; plus free-text option).
   - Date picker; weekday label shown (Sat/Sun badge).
   - Project select: 105-Express (EA auto 07-314524, Group select
     Field (23-0454.12)/Lab (23-0454.00)) | D8 (EA + Task Order inputs,
     Group 1 Field / 2 Plant) | CTC (free EA). EA validated live
     (validateEA), edits allowed.
   - "Hours already worked today (other job)" → priorMinutes (h:mm input).
   - Holiday toggle.
   - Blocks table: rows of {category select, start, stop, job/log # text,
     description text}; add/remove/duplicate row; times as HH:MM inputs.
   - Vehicle: begin/end odometer (auto miles), itinerary stops (one per
     line), make/model/plate (persist last-used per inspector).
   - LIVE RESULTS CARD (recomputes on every input): big tier totals
     (code + hours), family + familyReason, split preview (two dated rows
     incl. "Shift Change"), lunch status line, flags list (color-coded by
     severity; "ruling" items styled distinctly with "PENDING QC RULING"
     chip). Errors block Submit (button disabled with reason).
   - Submit → saves entry {status:"submitted"}. Save Draft → {status:"draft"}.
2. **Review** (manager):
   - List of entries (newest first): inspector, date, project, total hours
     by tier, flag count chips, status chip (Draft/Submitted/Approved/
     Kicked back). Click → detail: full readonly rendering of entry +
     results card recomputed from stored blocks (never trust stored
     results — recompute), Approve / Kick back (required note) buttons.
   - CSV export button: all approved+submitted entries, one row per
     (date-portion × tier × jobRef): Date, Inspector, Project, EA,
     TaskOrder, Group, JobRef, LaborCode, Hours, Miles, Status, Flags.
     CSV built as a textarea the user copies (artifact viewers cannot
     download files; also render a Copy button via navigator.clipboard
     with fallback select).
3. **Rules**: static digest of the rulebook rules the engine implements
   (plain language, the window, the ladder, lunch limits, Sat/Sun, splits,
   priorMinutes) + an "Open rulings" list (Saturday 2.0 question, holiday
   pay, lab-line exemption, rest-break policy) — the transparency screen.
   State plainly: computes company rulebook rules; not legal advice.

Storage layer (app.js):
- `window.claude?.use` present → artifact mode: `const db = await
  claude.use("db")` (null → fall back to local mode with a visible
  "Local only — sign in on claude.ai for shared mode" note).
  Collection "timesheets"; doc id `ts_<date>_<slug(inspector)>_<rand base36
  from crypto.getRandomValues>`; fields {inspector, date, project, ea,
  taskOrder, group, priorMinutes, holiday, blocks, vehicle:{begin,end,
  itinerary,make,model,plate}, status, managerNote, example?:true,
  createdAtClient}. onSnapshot once for the Review list. Writes only on
  user action. All storage calls try/catch; UI never breaks on storage
  failure.
- No `window.claude` → localStorage key "socal-timesheet-v1" (same doc
  shapes in an object map), try/catch everywhere, page fully functional
  without it (in-memory).
- First frame renders a designed empty state (what will appear + how to
  add the first entry) before any store answers. No seeds in page source;
  examples are seeded into the db AFTER publish (marked `example: true`,
  rendered with an EXAMPLE chip).
- `user` capability (artifact mode): opportunistic — prefill "Entered by"
  from `user.me()` name when available; never required.
- Print: @media print stylesheet renders the open entry roughly like the
  "Materials Engineering Staff Daily Report" (header fields, time table,
  vehicle block, hours-worked grid). Print button hidden in artifact mode
  (`window.claude?.use` present) because viewers can't print there.

Artifact contract musts (the publish variant is derived from index.html):
head contains ONLY charset, viewport (viewport-fit=cover), <title>,
claude:viewport-fit-sides meta, Google Fonts <link>, one <style>. ALL
scripts at end of body. rules.js/app.js loaded as
`<script type="module" src="./app.js">` (app.js imports ./rules.js).
No other external resources. No alert/confirm/prompt. No window.open.
Form controls all have stable ids. No horizontal page scroll at 375px.

## Out of scope v1 (roadmap notes only)
Strike tracking/discipline, payroll export formats, per-inspector
rate amounts, PDF generation, invoice-tab writing (lives in the
import-sheet flow), auth beyond claude.ai sharing.

## v1.1 additions (build these too)

### Inspector day ledger (cumulative OT across shifts — "the Randy case")
Overtime is a property of the PERSON's workday, not of a job. A second
shift or second job the same day must not restart the 8-hour regular
clock. Implementation:
- Workday = calendar date (midnight to midnight), consistent with the
  checklist's "Shift Change" midnight split.
- When an entry is being edited for inspector I on date D, the app
  computes `ledgerMinutes(I, D)` = sum of PAID minutes that fall on date D
  from every OTHER stored entry of inspector I: an entry dated D contributes
  its dayOne paid minutes (or all paid minutes when it has no split); an
  entry dated D−1 that crosses midnight contributes its dayTwo paid minutes
  (use rules.evaluateShift on the stored blocks to get the split; never
  trust stored totals).
- The "Hours already worked today" field is PREFILLED with ledgerMinutes
  and shows the ledger lines ("8:00 PM–2:00 AM, 360 min, job X") under it;
  the inspector may override with a note (e.g. hours at another employer
  not in this system). Manual override is recorded as
  `priorMinutesManual: true`.
- Example that must work end to end: Randy (free-text inspector),
  2026-08-05: entry A work 20:00–02:00 (jobRef "JOB-A", crosses into
  8/6); entry B dated 2026-08-06 work 06:00–12:00 (jobRef "JOB-B").
  Entry B's prefilled prior minutes = 120 (the 00:00–02:00 spill of A
  that landed on 8/6). Entry B tiers: 360 paid minutes starting at
  accrual 121 → 360 Regular? NO: accrual 121..480 = 360 Regular exactly
  → PW Regular 6.00. Change A to 18:00–02:00 (prior = 120 still, since
  only post-midnight minutes land on 8/6) — ledger logic is by DATE of
  the minute, not by shift. Then make B 06:00–14:00 with lunch 10:00–10:30:
  paid 450, accrual 121→570 → Regular 360 min (121..480) + 1.5 OT 90 min
  (481..570) → PW Regular 6.00 + PW 1.5 OT 1.50.

### Billing rates & invoice preview
- Rates are BILLING rates (what Atlas invoices the client per hour by
  labor code), per project, per inspector. They are NOT pay rates; label
  them "Invoice rate" everywhere.
- Store in collection `rates` (artifact mode) / localStorage key
  `socal-timesheet-rates-v1`; doc id `<project>`, fields
  {project, period, byInspector: {<name>: {"PW Regular":n, "PW 1.5 OT":n,
  "PW 2.0 DT":n, "PWSS Regular":n, "PWSS 1.5 OT":n, "PWSS 2.0 DT":n,
  "Non-PW":n}}}. No rate values in page source; seeded after publish.
  Editable in a Settings panel on the Rules screen (table), writes only on
  Save.
- Results card gains an "Invoice preview" line: Σ tier.hours × rate for the
  entry's project + inspector; "—" with the note "no rate on file" when
  missing. Review detail shows the same; CSV export gains Rate and Amount
  columns.
- Non-PW hours: v1 has no Non-PW entry type; show nothing for it.
