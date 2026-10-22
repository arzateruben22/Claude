# Electrician Academy content index

Hand-off reference for the CareerQuest Electrician Academy content in `data/academy/` and the seed facts in `data/seed/`. The app's loaders are built against the format below; `scripts/validate-academy.mjs` enforces it. Tables reflect the content as of 2026-10-22; rerun the validator for current counts.

## Validate

```sh
node scripts/validate-academy.mjs            # report; exits 1 on any error
node scripts/validate-academy.mjs --verbose  # also prints every solved workshop quantity
node scripts/validate-academy.mjs --root DIR # validate another checkout (fixture tests)
```

Plain Node 18+, no dependencies. It checks JSON validity and every rule in "Format conventions", unique lesson keys and globally unique item ids, that prerequisites and relatedLessons exist (and have no cycles), SVG safety and size, solves every workshop circuit numerically, checks the exam bank and the three seed files, cross-checks certification hours and fees against `data/research/electrician_research.json`, and lints all prose for known-wrong California facts (for example an un-itemized "$175" fee, PSI named without the CPS HR / Pearson VUE change, Labor Code 3099 without 108, Residential 4,500 hours, "$25 per year" trainee fees, CE hours other than 32). There is no npm script yet; a suggested `package.json` entry is `"validate:academy": "node scripts/validate-academy.mjs"`.

## At a glance

| Content | Count |
|---|---|
| Lessons | 31 (1205 estimated minutes) |
| Lesson sections | 364 |
| Practice items | 214 |
| Quiz questions | 326 |
| Workshop exercises | 9 (54 tasks) |
| Exam bank questions | 120 |
| Seed: apprenticeship programs | 6 |
| Seed: certification classifications | 5 |

## Tracks and lessons

Lessons are ordered by `order` within each track. Prerequisites are lesson keys; a lesson with none can be started first.

### FUNDAMENTALS (8 lessons, 245 min)

Electrical theory: charge, Ohm's law, circuits, power, AC/DC, magnetism.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `electrical-basics` | Electrical Basics: Charge, Voltage, Current and Resistance | 25 | (none) | 7 / 10 (80) |
| 2 | `ohms-law` | Ohm's Law | 25 | `electrical-basics` | 7 / 9 (80) |
| 3 | `series-circuits` | Series Circuits | 30 | `ohms-law` | 7 / 9 (80) |
| 4 | `parallel-circuits` | Parallel Circuits | 30 | `series-circuits` | 7 / 9 (80) |
| 5 | `series-parallel-circuits` | Series-Parallel Circuits | 35 | `series-circuits`, `parallel-circuits` | 7 / 9 (80) |
| 6 | `electrical-power-and-energy` | Electrical Power and Energy | 30 | `ohms-law`, `series-parallel-circuits` | 7 / 10 (80) |
| 7 | `ac-and-dc` | AC and DC | 35 | `electrical-power-and-energy` | 7 / 10 (80) |
| 8 | `magnetism-and-induction` | Magnetism and Induction | 35 | `ac-and-dc` | 7 / 9 (80) |

### SAFETY (4 lessons, 130 min)

Shock and arc flash, OSHA/Cal/OSHA/NFPA 70E, grounding and bonding, meters, first aid.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `electrical-safety-fundamentals` | Electrical Safety Fundamentals | 35 | (none) | 6 / 9 (80) |
| 2 | `grounding-and-bonding` | Grounding and Bonding | 35 | `electrical-safety-fundamentals` | 6 / 9 (80) |
| 3 | `working-safely-with-tools-and-meters` | Working Safely with Tools and Meters | 30 | `electrical-safety-fundamentals` | 6 / 8 (80) |
| 4 | `jobsite-first-aid-and-emergency-response` | Jobsite First Aid and Emergency Response | 30 | `electrical-safety-fundamentals` | 6 / 8 (80) |

### INSTALLATION (5 lessons, 190 min)

Raceways, cables and boxes, conductors and ampacity, plans, residential layout.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `conduit-fundamentals` | Conduit Fundamentals | 40 | `electrical-safety-fundamentals` | 7 / 9 (80) |
| 2 | `wiring-methods-and-boxes` | Wiring Methods and Boxes | 35 | `conduit-fundamentals` | 7 / 8 (80) |
| 3 | `conductors-and-ampacity` | Conductors and Ampacity | 40 | `wiring-methods-and-boxes` | 7 / 9 (80) |
| 4 | `blueprint-and-plan-reading` | Blueprint and Plan Reading | 35 | `conductors-and-ampacity` | 7 / 9 (80) |
| 5 | `residential-circuit-layout` | Residential Circuit Layout | 40 | `blueprint-and-plan-reading`, `grounding-and-bonding` | 7 / 9 (80) |

### SYSTEMS (5 lessons, 175 min)

Transformers, three-phase, motors and controls, lighting, troubleshooting.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `transformers-basics` | Transformers: Basics | 30 | `magnetism-and-induction`, `ac-and-dc` | 7 / 9 (80) |
| 2 | `three-phase-power` | Three-Phase Power | 35 | `transformers-basics`, `ac-and-dc` | 7 / 9 (80) |
| 3 | `motors-and-controls` | Motors and Motor Controls | 40 | `three-phase-power`, `magnetism-and-induction` | 8 / 10 (80) |
| 4 | `lighting-systems-and-controls` | Lighting Systems and Controls | 35 | `electrical-power-and-energy`, `ac-and-dc` | 7 / 9 (80) |
| 5 | `troubleshooting-methodology` | Troubleshooting Methodology | 35 | `working-safely-with-tools-and-meters`, `series-parallel-circuits` | 7 / 9 (80) |

### CODE (5 lessons, 185 min)

NEC navigation and concept-level coverage of Articles 100-110, 210-230, 240/250 and Chapters 5-7.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `nec-structure-and-navigation` | NEC Structure and Navigation | 30 | (none) | 7 / 9 (80) |
| 2 | `nec-general-requirements-overview` | NEC General Requirements (Articles 100 and 110) | 35 | `nec-structure-and-navigation` | 7 / 10 (80) |
| 3 | `nec-branch-circuits-feeders-services-overview` | NEC Branch Circuits, Feeders and Services (Articles 210, 215, 230) | 40 | `nec-general-requirements-overview` | 8 / 10 (80) |
| 4 | `nec-grounding-overcurrent-overview` | NEC Grounding, Bonding and Overcurrent Protection (Articles 250 and 240) | 40 | `nec-branch-circuits-feeders-services-overview`, `grounding-and-bonding` | 8 / 10 (80) |
| 5 | `nec-special-occupancies-and-equipment-overview` | NEC Special Occupancies and Equipment (Chapters 5, 6 and 7) | 40 | `nec-grounding-overcurrent-overview`, `motors-and-controls` | 8 / 10 (80) |

### EXAM_PREP (4 lessons, 280 min)

California certification process, exam math, code lookup drills, a 50-question practice exam.

| # | Key | Title | Min | Prerequisites | Practice / Quiz (pass %) |
|---|---|---|---|---|---|
| 1 | `california-certification-exam-overview` | California Certification Exam Overview | 30 | (none) | 5 / 8 (80) |
| 2 | `exam-math-and-calculations` | Exam Math and Calculations | 60 | `ohms-law`, `electrical-power-and-energy`, `conductors-and-ampacity`, `transformers-basics` | 8 / 10 (80) |
| 3 | `code-lookup-speed-drills` | Code Lookup Speed Drills | 40 | `california-certification-exam-overview` | 8 / 10 (80) |
| 4 | `practice-exam-1` | Practice Exam 1 | 150 | `california-certification-exam-overview`, `exam-math-and-calculations`, `code-lookup-speed-drills` | 4 / 50 (70) |

## Workshop exercises (virtual bench)

Each exercise is a DC resistor network the app solves; tasks ask for a solved quantity or a multiple-choice judgment. Every workshop file carries the disclaimer "Simulated bench exercise; not field experience."

| Key | Title | Difficulty | Min | Source | Faults | Tasks (numeric / MC) | Related lessons |
|---|---|---|---|---|---|---|---|
| `parallel-basics` | Parallel Basics: Same Voltage, Currents Add | 1 | 10 | 24 V | none | 6 / 0 | `ohms-law`, `parallel-circuits` |
| `series-basics` | Series Basics: One Path, One Current | 1 | 10 | 12 V | none | 6 / 0 | `ohms-law`, `series-circuits` |
| `fault-current-path` | Where Does the Fault Current Go? | 2 | 12 | 120 V | none | 5 / 0 | `grounding-and-bonding`, `electrical-safety-fundamentals` |
| `missing-ground-path` | The Ground Rod That Could Not Trip the Breaker | 2 | 10 | 120 V | R2 open | 3 / 2 | `grounding-and-bonding`, `electrical-safety-fundamentals` |
| `series-parallel-1` | Series-Parallel 1: A Series Resistor Feeding a Parallel Pair | 2 | 15 | 12 V | none | 6 / 0 | `series-parallel-circuits` |
| `voltage-divider` | Voltage Divider Under Load | 2 | 15 | 24 V | none | 6 / 0 | `series-circuits`, `series-parallel-circuits` |
| `fault-finding-open` | Fault Finding: An Open Branch | 3 | 15 | 12 V | R3 open | 4 / 2 | `series-circuits`, `parallel-circuits`, `series-parallel-circuits` |
| `meter-fault-finding` | Find the Open with a Meter | 3 | 15 | 12 V | R2 open | 5 / 2 | `working-safely-with-tools-and-meters` |
| `series-parallel-2` | Series-Parallel 2: A Line Resistor and a Nested Branch | 3 | 20 | 48 V | none | 7 / 0 | `series-parallel-circuits`, `electrical-power-and-energy` |

## Exam question bank

`exam/question_bank.json` holds 120 original multiple-choice questions for randomized practice exams, with the disclaimer that they are not taken from and do not predict the confidential DIR exam. 98 questions cite an NEC section number in `necReference`; the rest are theory or safety (`null`).

| Area key | Label | Blueprint weight | Questions |
|---|---|---|---|
| `general_knowledge_theory` | General knowledge and theory | 14% | 16 |
| `wiring_methods_materials` | Wiring methods and materials | 24% | 28 |
| `grounding_bonding` | Grounding and bonding | 14% | 16 |
| `services_feeders_branch_circuits` | Services, feeders and branch circuits | 20% | 24 |
| `overcurrent_protection` | Overcurrent protection | 10% | 12 |
| `motors_transformers_special_equipment` | Motors, transformers and special equipment | 12% | 16 |
| `safety` | Safety | 6% | 8 |

By difficulty: 1 = 54, 2 = 53, 3 = 13. `practice-exam-1` (lesson) tags each of its 50 quiz items with the same area keys (12/10/7/7/6/5/3), and the validator checks those tags against this list.

## Format conventions

All files are UTF-8 JSON, 2-space indented. Unknown fields are reported as warnings; anything below marked "must" is an error.

### Lesson: `lessons/<key>.json`

| Field | Rule |
|---|---|
| `key` | kebab-case, unique across lessons, equal to the file name |
| `track` | `FUNDAMENTALS` \| `SAFETY` \| `INSTALLATION` \| `SYSTEMS` \| `CODE` \| `EXAM_PREP` |
| `order` | positive integer, unique within the track |
| `title`, `summary`, `disclaimer` | non-empty strings. Lessons use: "Educational simulation. Completing this lesson is not qualifying work experience, a certification or a license." |
| `estimatedMinutes` | positive number |
| `prerequisites` | array of existing lesson keys (no self-reference, no cycles; may be empty) |
| `objectives` | non-empty array of strings ("Students will be able to ...") |
| `sections` | 5 to 16 section objects (below) |
| `practice` | 4 to 8 items |
| `quiz` | `{ key, passingScore, questions }`: `key` kebab-case and unique (convention `<lessonKey>-quiz`), `passingScore` a percent in (0, 100], `questions` 6 to 60 items |
| `sources` | non-empty array of `{ title, url }` with http(s) URLs |

Section types (the `type` field selects the shape):

| `type` | Fields |
|---|---|
| `text` | `heading?`, `markdown` (no raw `<script>`, `<iframe>` or `on*=` handlers) |
| `formula` | `name`, `expression`, `variables: [{ symbol, meaning, unit }]` (non-empty; `unit` non-empty, use "none" or "dimensionless" when unitless), `explanation` |
| `diagram` | `title`, `svg`, `caption` |
| `example` | `problem`, `solutionSteps: string[]` (non-empty), `answer` (string) |
| `callout` | `tone`: `safety` \| `tip` \| `warning` \| `simulation`; `text` |
| `table` | `caption`, `columns: string[]` (non-empty strings), `rows: string[][]` (every row has exactly one cell per column) |

SVG rules: the root `<svg>` has a `viewBox`; at most 8 KB (UTF-8 bytes); no `<script>`, `<foreignObject>`, `on*` event attributes, `javascript:` URLs, CSS `@import`, or `href`/`xlink:href`/`url()` that points anywhere except an in-document `#id`. Diagrams use `currentColor` plus a few fixed accent colors so they work in light and dark themes.

### Items (practice and quiz)

```jsonc
{ "id": "<lessonKey>-p1", "type": "numeric", "prompt": "...", "answer": 3, "unit": "A",
  "tolerance": 0.02, "toleranceType": "absolute", "explanation": "..." }
{ "id": "<lessonKey>-q4", "type": "multiple_choice", "prompt": "...",
  "choices": ["...", "...", "..."], "correctIndex": 1, "explanation": "..." }
```

- `id` is globally unique across lessons, workshop tasks and the exam bank, and starts with `<lessonKey>-` (convention: `-pN` practice, `-qN` quiz).
- Numeric: `answer` is a finite number; `unit` optional; `tolerance` >= 0. **`toleranceType` defaults to `absolute`** (tolerance in the answer's unit) when omitted; `relative` means a fraction of the answer (0.02 = 2 %). The validator rejects tolerances that would accept wrong answers (absolute > 10 % of the answer, relative > 0.1) and relative tolerance on an answer of 0.
- Multiple choice: 3 to 5 distinct non-empty choices; `correctIndex` is a valid 0-based index.
- Optional `area` (string) tags a practice-exam item with an exam-bank area key; when present it must be one of the keys in `exam/question_bank.json` `areas`.

### Workshop exercise: `workshop/<key>.json`

| Field | Rule |
|---|---|
| `key` | kebab-case, unique, equal to the file name |
| `title`, `description`, `disclaimer` | non-empty strings |
| `difficulty` | integer 1 to 5 |
| `estimatedMinutes` | positive number |
| `relatedLessons` | array of existing lesson keys |
| `circuit.sourceVolts` | number > 0 (ideal DC source) |
| `circuit.network` | nested `{ "type": "series" \| "parallel", "items": [...] }` or `{ "type": "resistor", "id", "ohms" }`; resistor ids match `^[A-Za-z][A-Za-z0-9]*$` and are unique in the circuit; `ohms` > 0 |
| `circuit.faults?` | `[{ "id": "<resistor id>", "fault": "open" \| "short" }]`, at most one fault per resistor; open = infinite ohms, short = 0 ohms |
| `tasks` | numeric `{ id, question, quantity, tolerance, toleranceType? }` with `quantity` one of `R_total`, `I_total`, `P_total`, `V_<id>`, `I_<id>`, `P_<id>`; or `{ id, type: "multiple_choice", question, choices, correctIndex, explanation? }` |
| `hints`, `learningGoals` | non-empty string arrays |

The validator solves every circuit (faults applied) and requires each numeric task's quantity to be finite. Quantities that are undefined are rejected: anything behind a dead short across the source, the voltage split between two opens in one series string, or the current split between two shorted branches. Expected answers are computed by the app's solver, not stored in the file; `--verbose` prints them.

### Exam bank: `exam/question_bank.json`

`{ disclaimer, areas, questions }`. `areas` is `[{ key, label, weight }]` with weights summing to 1. `questions` has at least 100 entries of `{ id, area, difficulty (1-3), prompt, choices (3-5), correctIndex, explanation, necReference }`, where `area` is an area key and `necReference` is a section/table string or `null`. Ids and prompts are unique.

### Seed files: `data/seed/`

- `apprenticeship_programs.json`: array of programs with all of `slug` (kebab, unique), `name`, `sponsor`, `region` (`Los Angeles County` \| `Orange County` \| `Southern California` \| `Riverside / Inland Empire`), `isUnion`, `website`, `applyUrl` (URL or null), `eligibility[]`, `processSteps[]`, `durationYears` (number or null), `classroomHours`, `startingWage`, `fees` (string or null), `startingWageVerified` (cannot be true when `startingWage` is null), `contact { phone?, address?, email? }`, `recruitmentStatus` (`OPEN` \| `CLOSED` \| `UNVERIFIED`), `recruitmentNote`, `sourceUrls[]` (non-empty), `verifiedOn` (YYYY-MM-DD, not in the future). Field-mapping decisions are in `seed/apprenticeship_notes.md`.
- `certification_requirements.json`: one record per code `GENERAL`, `RESIDENTIAL`, `FIRE_LIFE_SAFETY`, `VOICE_DATA_VIDEO`, `NON_RESIDENTIAL_LIGHTING` with `name`, `hoursRequired` (must equal the research value), `notes`, `sourceUrl`, `verifiedOn`.
- `certification_facts.json`: program, trainee, fees (numeric fees must equal the research values; `combinedInitialCost` must equal application + exam), exam, renewal, law, contractor license, wages and `unverifiedItems`. Every nested `verifiedOn` is a real, non-future date and every `*Url`/`sourceUrls` value is a URL.

## California certification facts used in the content

Source of truth: `data/research/electrician_research.json` and `.md` (verified 2026-10-21 through search extracts of official pages; see the research file for caveats). Content must match these or say "verify on the DIR site" with the check date.

| Topic | Fact | Basis |
|---|---|---|
| Who must be certified | People doing electrician work for a C-10 contractor; registered apprentices and supervised registered trainees are exempt; C-7 and C-45 scope not covered | Labor Code 108.2, 108.4 |
| Law | Labor Code Division 1, Chapter 4.5, sections 108-108.5 (formerly 3099-3099.5, renumbered by AB 1087 in 2002); regulations 8 CCR 290.0-296.3 | research `law` |
| Hours | General 8,000; Residential 4,800; Fire/Life Safety 4,000; Voice Data Video 4,000; Non-Residential Lighting 2,000; work for a C-10 contractor with per-area caps | 8 CCR 291.1, DIR pages 1a-1e |
| Other routes | Completing a state- or federally-approved apprenticeship in the classification; registered trainee completing an Approved Curriculum (General: 8,000 OJT hours plus 720 hours of instruction). No "education credit" rule found | 8 CCR 291.1, 291.2(g), DIR page 2a |
| Trainee | Approved Curriculum at a DIR-listed school; at least 150 classroom hours a year; one trainee per certified supervising electrician; $25 initial fee; annual renewal with no fee | 8 CCR 296.2, 296.3, 292.0(d) |
| Fees | Application $75 plus exam $100 (do not write "$175 application fee"); retest $100; renewal $100; lapsed renewal $200 and replacement card $30 appear only on DIR's fee page | 8 CCR 292.0, DIR fee page |
| Exam provider | Historically PSI; for exams on or after June 1, 2026, scheduling by CPS HR Consulting and delivery through Pearson VUE | DIR test-information page |
| Exam format | General exam 100 multiple-choice questions; minimum scaled score 70 (PSI-era bulletin; not 70 % raw); time limit conflicting: 4 h (FAQ) vs 4 h 30 min (test-info page); test within one year of the eligibility notice; 60-day wait to retest | research `exam` |
| Renewal | Every 3 years; 32 hours of CE from a DIR-approved provider; about 2,000 hours of industry work in the prior 3 years; $100. Timing and lapsed-card guidance conflict between the FAQ/fee page and 8 CCR 291.5 | 8 CCR 291.5, DIR FAQ |
| Pending | AB 1707 (2025-26) would move the program to CSLB; enrolled September 4, 2026; final status unverified as of 2026-10-21 | leginfo bill text |

## Authoring rules

- **NEC text.** Paraphrase and cite article, section and table numbers only; never reproduce NEC sentences or definitions verbatim. Section numbers follow the 2017-2023 editions and the content tells learners to confirm against the edition named in their exam materials and the adopted California Electrical Code (2022 CEC = 2020 NEC; 2025 CEC = 2023 NEC).
- **Worked numbers.** Every example and numeric item is recomputed during review; intermediate values in solution steps must reproduce the stated answer.
- **Honesty.** All questions are original; nothing claims to come from or predict the confidential DIR exam. Lessons, workshops and practice exams are labeled as simulation, not work experience, certification or a license.
- **Unverified facts.** Anything not confirmed in the research file is phrased as "verify on the DIR site" (or the relevant official site) with the check date, never stated as fact.
