# Job Finder

Finds real openings in Los Angeles and Orange counties that are applied for on the employer's own
site, ranks them against the applicant's stated goals, and publishes a private page with direct
links, honest gap notes, cover-letter drafts and an "applied" tracker.

## Pieces

| File | What it does |
|------|--------------|
| `sweep.workflow.js` | Multi-agent web-search sweep: re-checks existing leads first, then one finder per employer slice, then an independent pass that tries to disprove each posting and writes honest application notes. Every agent has an explicit search cap. |
| `../src/lib/jobfinder/score.ts` | Pure ranking engine: 0–100 fit score with a per-factor breakdown, list assignment (best fit / stretch / ruled out) and the reason for every exclusion. Tests: `tests/unit/jobfinder-score.test.ts`. |
| `../scripts/jobfinder-build.ts` | Reads the sweep's journals, scores and selects, writes `data/jobs/<date>.json` and renders the page from `page-template.html`. |
| `page-template.html` | The published page. Job data is embedded; per-person status, ticks and letter edits are stored privately (artifact `db` + `user` capabilities, with a local fallback). |
| `latest.html` | The last built page, as published. |
| `../data/jobs/<date>.json` | The ranked result of each run, including what was ruled out and why. |

## Rules the engine enforces

- A posting the second pass looked for and could not find on the employer's site is ruled out.
- "Could not check" is not "disproved": when the second pass cannot run its searches, the lead is
  kept, labelled "found once, not double-checked", and classified from the first pass's reading.
- Only a mandatory credential (licence, certification, degree) blocks a job. A required number of
  years is an experience gap, which makes the job a stretch and is stated plainly on the card.
- Driving requirements are flagged and scored, never assumed about the applicant. Paperwork
  (ID, diploma, residency) is listed as "have ready", not as a gap.
- Nothing is padded: if fewer postings survive than were asked for, the page says so.

## Running a pass

1. Run `sweep.workflow.js` with the Workflow tool, for example
   `args = { today: "YYYY-MM-DD", verifyCap: 5, findCap: 12, leads: [...previous leads...], keys: ["city-utilities", ...] }`.
   WebSearch allows 200 calls per turn across all agents, so keep
   `leads × verifyCap + slices × findCap + new candidates × verifyCap` under that.
2. Build: `npx tsx scripts/jobfinder-build.ts --journals <workflow transcript dir>[,<dir>] --date YYYY-MM-DD --out data/jobs/YYYY-MM-DD.json --html jobfinder/latest.html`
3. Publish `jobfinder/latest.html` to the existing artifact so the link and saved statuses are kept.

## Limits to know about

- The sandbox this ran in cannot open job sites (hosts are not on the environment's network
  allow-list), so postings are confirmed from search-result extracts, not from the live page.
- The applicant's résumé has not been provided. Fit is scored against stated goals and an assumed
  beginner background; cover letters use [brackets] for facts only the applicant knows.
