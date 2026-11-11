# Job Finder

Finds real openings in Los Angeles and Orange counties that are applied for on the employer's own
site, ranks them against the applicant's stated goals, and publishes a private page with direct
links, honest gap notes, cover-letter drafts and an "applied" tracker.

## Pieces

| File | What it does |
|------|--------------|
| `sweep.workflow.js` | Multi-agent web-search sweep: re-checks existing leads first, then one finder per employer slice, then an independent pass that tries to disprove each posting and writes honest application notes. Every agent has an explicit search cap. |
| `../src/lib/jobfinder/score.ts` | Pure ranking engine: 0–100 fit score with a per-factor breakdown, list assignment (best fit / stretch / below pay target / ruled out) and the reason for every exclusion. Tests: `tests/unit/jobfinder-score.test.ts`. |
| `../src/lib/jobfinder/geo.ts` | Home base (Canoga Park), city coordinates for LA and Orange counties, straight-line distance, the LA/OC area split and the distance-based pay target. |
| `../scripts/jobfinder-build.ts` | Reads the sweep's journals, scores and selects, writes `data/jobs/<date>.json` and renders the page from `page-template.html`. |
| `page-template.html` | The published page. Job data is embedded; per-person status, ticks and letter edits are stored privately (artifact `db` + `user` capabilities, with a local fallback). |
| `latest.html` | The last built page, as published at https://claude.ai/artifact/F1YK2dnRzYcaE7j5ke3xyR (capabilities: `db`, `user`, `sample`). |
| `../data/jobs/<date>.json` | The ranked result of each run, including what was ruled out and why. |
| `../data/jobs/<date>.leads.json` | The leads sent back through the second check, in the order the sweep script indexes them (`recheck:<n>` in a journal is lead `n`). |

## What the page lets the applicant do

- Enter name, city, phone and email once; they replace the matching [placeholders] in every draft.
- Paste a résumé. "Tailor to my résumé" and "Suggest résumé changes for this job" ask Claude, on the
  viewer's own account, to rewrite using only facts in that résumé (the prompt forbids invented
  experience, credentials or dates). The résumé is sent only when one of those buttons is pressed.
- "Write my tailored résumé" on a job rewrites the pasted résumé for that posting (same facts,
  reordered and reworded only). "Tailor every job" does the résumé and the cover letter for every
  listed job in turn, with a Stop button, and halts on a refusal or rate limit.
- Jobs are grouped under "Los Angeles area" and "Orange County area", with an Area filter, and each
  card shows the pay target for its distance from Canoga Park.
- Tick the posted requirements that are true, mark each job To do / Applied / Skip, and copy a CSV
  that the CareerQuest tracker imports. The light tracker state lives in the viewer's private
  `data/users/<id>/jobfinder` document and each job's written résumé and letter in its own
  `data/users/<id>/jf-<jobId>` document (one document is capped at 256 KiB), so everything follows
  them across devices, with browser storage as the fallback.
- Checked locally with a stand-in runtime (`db`, `user`, `sample`): sync, restore on a second device,
  no write on load, tailoring hidden when unavailable. The live Claude call itself was not exercised.

## Rules the engine enforces

- A posting the second pass looked for and could not find on the employer's site is ruled out.
- "Could not check" is not "disproved": when the second pass cannot run its searches, the lead is
  kept, labelled "found once, not double-checked", and classified from the first pass's reading.
- Only a mandatory credential (licence, certification, degree) blocks a job. A stated need for
  experience (required, or years listed as preferred) makes the job a stretch and is stated plainly
  on the card. Conditions of the job (shifts, physical work, own tools, screening) and preferred
  items are shown but are not counted as gaps.
- Pay rule: about $35 an hour within 15 miles of Canoga Park, plus $0.45 an hour for each mile
  beyond that (`PAY_RULE` in `geo.ts`; the per-mile figure is an assumption and is stated on the
  page). A job whose top of range is more than 5% under its target goes to "Below your pay target".
- A lead with no second-pass verdict is kept as "found once, not double-checked", never ruled out
  for that reason alone, and a checked copy always replaces an unchecked copy of the same posting.
- Driving requirements are flagged and scored, never assumed about the applicant. Paperwork
  (ID, diploma, residency) is listed as "have ready", not as a gap.
- Nothing is padded: if fewer postings survive than were asked for, the page says so.

## Running a pass

1. Run `sweep.workflow.js` with the Workflow tool, for example
   `args = { today: "YYYY-MM-DD", verifyCap: 5, findCap: 12, leads: [...previous leads...], keys: ["city-utilities", ...] }`.
   WebSearch allows 200 calls per turn across all agents, so keep
   `leads × verifyCap + slices × findCap + new candidates × verifyCap` under that.
   To re-check stored leads, pass `leadIdx: [0, 1, ...]` (indexes into the `LEADS` array embedded in
   the script, which must match `data/jobs/<date>.leads.json`).
2. Build: `npx tsx scripts/jobfinder-build.ts --journals <workflow transcript dir>[,<dir>] --leads data/jobs/YYYY-MM-DD.leads.json --date YYYY-MM-DD --out data/jobs/YYYY-MM-DD.json --html jobfinder/latest.html`
3. Publish `jobfinder/latest.html` to the existing artifact so the link and saved statuses are kept.

## Limits to know about

- The sandbox this ran in cannot open job sites (hosts are not on the environment's network
  allow-list), so postings are confirmed from search-result extracts, not from the live page.
- The applicant's résumé has not been provided. Fit is scored against stated goals and an assumed
  beginner background; cover letters use [brackets] for facts only the applicant knows, and the
  tailored résumé slot on each job stays empty until a résumé is pasted into the page.
- Distances are straight-line from Canoga Park to the city centre, not drive times. A posting that
  says only "Los Angeles" is placed downtown and marked as an estimate on its card.
