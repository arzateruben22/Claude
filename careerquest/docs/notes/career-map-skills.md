# career-map-skills — Career Map and Skill Tree

Owner key: `career-map-skills`. Built 2026-10-22. Both pages are worked out from the user's persisted,
userId-scoped data on every request; nothing is incremented, and nothing here awards XP.

## Routes

| Route | What it shows |
|-------|---------------|
| `/career-map` (`?node=<key>` opens a stop) | Planning-tool notice ("completing nodes here is not a credential"), legend with status counts, the interactive map (or a list view), the detail panel for the selected stop, the three-credential comparison and a note on how the figures were researched. |
| `/skills` (`?skill=<key>` opens a skill) | "Levels reflect activity in CareerQuest, not a credential" notice, summary tiles, the tree (Electrical, Field, Job search) with prerequisite edges, and the detail panel (how to level up, all thresholds, current activity, links). |

## Career Map

### Graph (`src/lib/career-map/graph.ts`, pure)
26 stops. Main path: Beginner → Entry preparation → Electrician Trainee or Apprentice → Supervised
experience → Certification eligibility → California certification (DIR) → Experienced electrician →
Specialist / Foreman / Management. "Apprenticeship completion (journeyman)" is its own credential stop
and one of two alternative routes into Certification eligibility (`prereqMode: "any"`). "CSLB C-10
Contractor License" branches from Experienced electrician. Side branches (entry route → role): elevator,
commercial HVAC, industrial maintenance, building engineer, construction office (coordinator →
estimator → assistant PM) and commercial plumbing & pipefitting.

Edges are `required` (can lock; `satisfiedBy: "completed" | "started"`) or `typical` (usual order, never
locks). `validateCareerGraph()` checks unknown/duplicate keys, cycles, reachability from Beginner,
overlapping positions, and the honesty rules below.

### Where figures come from
- `src/lib/career-map/seed.ts` parses `data/seed/certification_facts.json`, `certification_requirements.json`,
  `apprenticeship_programs.json` and `data/research/electrician_research.json`; `load-seed.ts` reads them
  (server-only, fresh per request, `CAREER_MAP_DATA_DIR` overrides the folder).
- Every electrician-path figure (hours, fees, durations, years) is a `sourced`/`estimate` fact carrying
  the source URLs and `verifiedOn` of its seed section. Unverified / conflicting / partial items keep
  their flags. CareerQuest's own text (`guidance`) never contains figures — enforced by
  `validateCareerGraph` and the tests (license class names like "C-10" are the only exception).
- Side branches are descriptions only (`sourcedFigures: false`) and say so.
- Durations are labelled "Estimate". The C-10 experience years (4) are parsed from the seed requirement
  text; program lengths (4.5–5 years) come from the program records.
- If a seed file is missing, its figures are omitted (the page shows a warning), never guessed.

### Status derivation (`src/lib/career-map/status.ts`, pure)
Inputs (`CareerUserData`, loaded by `service.ts`): profile (primary trade, interests, onboarding),
`UserProgramInterest` statuses, `CertificationStatus` dates, work hours split verified
(EMPLOYER_VERIFIED/OFFICIAL_RECORD) vs self-reported and on-the-job vs CLASSROOM, Academy lesson
progress per track, practice exams (`exam:*` quiz attempts), up to 2,000 most recent non-merged
applications (matched to stops by job title, `jobs.ts`), uploaded document kinds and the user's marks.

Each stop gets `status`, `derivedStatus`, `reason` ("In progress because: 1,240 verified hours of 8,000
(General Electrician)"), labelled evidence (Verified / Self-reported / Observed / Estimate / Marked by
you), notes on what CareerQuest cannot see, progress, training progress per Academy track, related
applications, documents on file, prerequisites with their status, a personal pace estimate (supervised
experience: verified hours over the last 84 days) and a list of actions (first = next recommended action).

Highlights: trainee registration (valid/expired), program acceptance or a hire into an apprentice job
completes "Trainee or Apprentice"; supervised hours compare **verified** on-the-job hours with the
classification on the user's tracker (General first; Residential etc. when that is the tracked row);
exam application/eligibility/schedule/pass/certified dates drive eligibility and certification;
expired certificates show "renewal needed"; certification starts Experienced electrician with journey-level
time estimated from the certification date, which also drives the C-10 progress bar (estimate only).
Application activity on a stop that is still locked (e.g. applying to foreman jobs before certification)
is listed as evidence but does not mark it in progress. Apprenticeship completion and the C-10 license
have no record type in the schema, so only the user's own mark can complete them; the panel says so.

"You are here": on the user's primary-trade branch, the furthest stop in progress, else the first
available, else the last completed (electrician: main spine, plus forks once Experienced has started).

### User marks
`UserCareerNode` rows exist only for marks ("Marked by you"): status Not started / In progress /
Completed + optional note (≤ 500 chars). The mark wins on the map; the data-derived reason stays visible
("From your data: …"). Marks award no XP. `setCareerNodeMark` / `clearCareerNodeMark` (service) and
`markCareerNodeAction` / `clearCareerNodeMarkAction` (server actions: `requireUser`, 30/min rate limit,
zod, node key must be on the map, `revalidatePath("/career-map")`).

### UI (`src/components/career-map/`)
`CareerMapExplorer` (client): Map/List toggle, selection mirrored to `?node=`, detail panel beside the
map on `lg` and below it on small screens (scrolled into view on selection; "Back to the map" returns
focus). `MapCanvas`: absolutely positioned stop buttons over an SVG connector layer inside a scroll
container (touch pans natively; mouse drag-to-pan on the background), roving tabindex with arrow-key
spatial navigation (`navigation.ts`), Home/End, Enter/Space opens details, "Center on my position",
current stop centred on load, smooth scrolling only without reduced motion (OS setting or
`data-reduced-motion`). `NodePanel` shows every field; `MarkForm` is the mark/clear form. Status is
always visible text, not colour only. `MapLegend`, `CareerListView`, `CredentialCompare`, `ResearchNote`.

## Skill Tree

### Catalog (`src/lib/skills/catalog.ts`, pure)
12 skills, five nested levels each (meeting level N always meets N−1; property-tested):
- **Electrical** (Fundamentals, Safety, Systems, Installation, Code / NEC, Exam prep — tracks from
  `data/academy`): L1 one lesson, L2 ⌈⅓⌉ of the track, L3 ⌈⅔⌉, L4 every lesson, L5 every lesson with an
  average best quiz score ≥ 90 %. A track with no lessons is "Unavailable".
- **Field / Supervised field hours**: verified on-the-job hours; brackets 1 h, ⅛, ¼, ½ and all of the DIR
  General Electrician requirement from the seed (1,000 / 2,000 / 4,000 / 8,000). Self-reported and
  classroom hours never count. Unavailable if the seed cannot be read.
- **Job search**: Applications (distinct positions 1/10/25/50/100), Résumé (versions 1/2/3, then 3 + 10
  and 5 + 25 applications sent with a recorded version), Interviewing (L1 any of 1 prep / 1 completed
  interview, then preps + INTERVIEW_COMPLETED 1+1, 3+3, 5+5, 8+10), Networking & follow-ups
  (FOLLOW_UP_SENT, one per application per day: 1/5/15/30/60), Negotiation (salary prep = saved
  SalaryScenario or completed `gh.p3.salary` mission; offers recorded; accepted: L1 prep or an offer,
  L2 an offer, L3 offer + prep, L4 two offers + prep, L5 + an accepted offer).
- Edges: Fundamentals → Systems, Installation; Safety → Installation, Supervised field hours; Installation
  → Code / NEC → Exam prep; Systems → Exam prep; Applications → Interviewing, Networking; Résumé →
  Interviewing; Interviewing → Negotiation. A level-0 skill with an unstarted prerequisite shows "Start
  with …" (activity still counts).

### `refreshSkills(userId, now?)` (`src/lib/skills/service.ts`)
Loads metrics (`loadSkillMetrics`), computes views, creates missing `UserSkill` rows
(`createMany … skipDuplicates`) and updates only rows whose level, points or first-reached date changed
(second call writes nothing). `UserSkill.xp` stores **skill points** (level × 100 + % toward the next
level, 0–500), not ledger XP. `unlockedAt` = first time the skill reached level 1, cleared if the
activity behind it is deleted. Called by `/skills` on each render.

## Public API
- `src/lib/career-map/graph.ts`: `buildCareerGraph(seed)`, `validateCareerGraph(graph)`, `topologicalOrder`,
  `allFacts`, `containsFigure`, `CAREER_NODE_KEYS`, `MAIN_PATH`, `BRANCHES`, `BRANCH_LABELS`, `UNSOURCED_NOTE`.
- `src/lib/career-map/seed.ts`: `parseCareerSeed(raw, errors?)`, `parseExperienceYears(text)`, `flagFromText`.
  `load-seed.ts` (server-only): `loadCareerSeed(dataDir?)`.
- `src/lib/career-map/status.ts`: `deriveCareerMap(graph, data)`, `currentPosition(nodes, branch)`,
  `formatMonths`, `monthsBetween`, `TRADE_BRANCH`, `INTEREST_BRANCH`, `PACE_WINDOW_DAYS`.
- `src/lib/career-map/service.ts` (server-only): `getCareerMapData(userId, now?)`, `loadCareerUserData(db, userId, now?)`,
  `loadCareerGraph()`, `setCareerNodeMark(userId, { nodeKey, status, notes })`, `clearCareerNodeMark(userId, nodeKey)`,
  `CareerMapInputError`.
- `src/lib/career-map/actions.ts` ("use server"): `markCareerNodeAction`, `clearCareerNodeMarkAction`.
- `src/lib/career-map/jobs.ts`: `matchesJob(text, spec)`, `jobText`, `ENTRY_LEVEL_TERMS`.
  `navigation.ts`: `spatialNeighbor`, `edgePath`, `nodeOrigin`, `canvasSize`, `MAP_LAYOUT`.
- `src/lib/skills/catalog.ts`: `SKILLS`, `computeSkills(metrics)`, `evaluateSkill`, `trackThresholds`,
  `fieldThresholds`, `validateSkillCatalog`, `emptySkillMetrics`, types `SkillMetrics`, `SkillView`.
- `src/lib/skills/service.ts` (server-only): `refreshSkills(userId, now?)`, `loadSkillMetrics(db, userId)`,
  `loadFieldHoursGoal()`.
- Components: `CareerMapExplorer`, `MapCanvas`, `NodePanel`, `MarkForm`, `MapLegend`, `CareerListView`,
  `CredentialCompare`, `ResearchNote`, `FactList`; `SkillTreeExplorer`, `SkillBranchTree`, `SkillDetail`.

## How to test
```
npx vitest run tests/unit/career-map-*.test.ts tests/unit/skills-*.test.ts
```
- `career-map-graph` — real seed loads; graph valid; every prerequisite exists; acyclic; every numeric
  electrician fact has source URLs and a check date; side branches have no figures; credentials distinct;
  durations labelled Estimate; empty seed → valid graph with no figures; job-title matching.
- `career-map-status` — fixture users: new user, in-progress hours with self-reported/classroom evidence
  and pace, completed hours unlocking eligibility, Residential classification, program acceptance + user
  mark, certification and journey-level time / C-10 progress, expired trainee and certificate, exam
  application/eligibility, applications vs locks, lessons → training, HVAC focus branch; navigation/geometry.
- `career-map-db` — loader against `careerquest_test` (scoping, verification/work-type split, documents,
  practice exams), marks set/update/clear/unknown key.
- `career-map-render`, `skills-render` — `renderToStaticMarkup` smoke tests of every component.
- `skills-catalog` — thresholds per skill, nesting property, locks, validation.
- `skills-db` — idempotent refresh, levels from real records, first-reached date kept, levels drop when data is deleted.

## Known gaps
- Not opened in a browser (next dev/build not allowed here); needs a manual pass at 375 px (map panning,
  arrow keys, sticky panel, list view).
- Links to `/academy/apprenticeships`, `/academy/hours`, `/academy/certification` (academy-records),
  `/discovery`, `/coach` and `/salary` show placeholders or 404 until those modules land.
- DIR per-work-area hour caps are not applied (stated in the UI); totals are raw verified hours.
- Job-title matching is phrase based and can misfile an unusual title; such evidence is labelled Observed.
- Documents "on file" match by `Document.kind` only (no upload UI in this module).
