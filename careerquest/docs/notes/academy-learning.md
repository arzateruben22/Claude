# academy-learning — Electrician Academy: lessons, quizzes, workshop, practice exam, roadmap

Owner key: `academy-learning`. Built 2026-10-22. Records pages (`/academy/apprenticeships`, `/academy/hours`,
`/academy/certification`) and the DB seed belong to `academy-records` and are **not** part of this module.

## Routes (all authenticated, dynamic)

| Route | What it does |
|---|---|
| `/academy` | Track overview: Electrician level + XP (from `PlayerStats.electricianXp`), lessons completed, practice exams passed, bench exercises cleared, "continue/up next" card, links to Roadmap / Workshop / Practice exam / Apprenticeships / Training hours / Certification, six tracks with per-track progress bars and lesson cards (state badge, lock reason, best score). |
| `/academy/lessons/[key]` | Lesson: objectives, sections (text markdown, formula cards, sanitized + theme-aware diagrams, worked examples with step-by-step reveal, callouts styled by tone safety/warning/tip/simulation, scrollable tables), practice panel with instant feedback, quiz CTA, sources, disclaimer, prev/next in track. Opening an unlocked lesson marks it `IN_PROGRESS`. Locked lessons show objectives + the missing prerequisites; `?preview=1` shows the content read-only without starting the lesson (quiz stays locked). |
| `/academy/lessons/[key]/quiz` | Client form → `submitLessonQuizAction` (server grading). Results with per-question explanations, retake, recent attempts. |
| `/academy/workshop` | Exercise list with clean-run status, best score, run count. Simulation notice. |
| `/academy/workshop/[key]` | Bench: generated SVG schematic, virtual multimeter, graded **Exercise** mode and ungraded **Experiment** mode (edit volts/ohms, open/short parts, add in series/parallel, remove), hints, fault-finding multiple choice, bench report → `submitWorkshopAction`. |
| `/academy/exam` | Start form (25 or 50 questions, optional timer), bank blueprint by area, the real-exam facts from the roadmap data (with conflict/partial badges), attempt history. |
| `/academy/exam/take?size=25[&timed=1]` | Generates a seed and redirects to `…&seed=N` (reload = same exam). Questions without keys; `submitExamAction` grades. |
| `/academy/exam/review/[id]` | Past attempt (scoped to the owner) with results by area, explanations, NEC references. |
| `/academy/roadmap` | Renders `data/seed/certification_facts.json` + `certification_requirements.json`: verification date + method caveat, "Verify on the official site before acting", the three-way credential comparison ("none automatically grants the others"), classifications with hours, trainee route + forms, fees, exam facts, renewal, the law + pending AB 1707, CSLB C-10, and the full `unverifiedItems` list. Every section lists its source links and last-checked date; badges: Conflicting sources / Unverified / Partially verified are derived from the data. |

`AcademyTabs` (`src/components/academy/academy-tabs.tsx`) is the sub-navigation for every academy page and already
lists the three records routes — the records engineer can import it as is.

## Modules (`src/lib/academy/`)

- `content.ts` (server-only): reads `data/academy/{lessons,workshop}/*.json` and `exam/question_bank.json`, validates
  with the zod schemas in `schema.ts`, caches per process (production) or per file-mtime signature (dev, so content
  fixes appear without a restart). Invalid files are skipped and logged (`[academy-content] …`), unknown prerequisites
  are dropped, workshops whose numeric tasks do not solve to a finite value are skipped, bad bank questions are skipped
  individually. API: `getTracks()`, `listLessons()`, `getLesson(key)`, `listWorkshops()`, `getWorkshop(key)`,
  `getQuestionBank()`, `getContentIssues()`, `loadAcademyContent(root)` (tests), `resetAcademyContentCache()`.
  `ACADEMY_CONTENT_DIR` overrides the root.
- `schema.ts` (zod) + `constants.ts` (zod-free types/constants used by client code). Lessons allow up to 16 sections;
  numeric `toleranceType` defaults to `absolute` (matches `data/academy/INDEX.md`).
- `markdown.ts` → AST; `components/academy/markdown.tsx` renders React elements (paragraphs, line breaks, bold, italic,
  code, ordered/unordered lists, headings). No `dangerouslySetInnerHTML`; raw HTML shows as text.
- `svg-sanitize.ts`: tokenizer + allowlist re-serializer (svg, g, path, line, polyline, polygon, rect, circle, ellipse,
  text, tspan, defs, marker, title, desc). Strips scripts, `on*`, href/xlink:href, class, `<use>/<image>/<a>/<style>/
  <foreignObject>`/animation, comments/CDATA/doctypes, `url()` in style, external/`data:`/`javascript:` refs (after
  entity decoding). Keeps `url(#local)` markers. Maps the five dark-theme diagram colors to theme tokens via inline
  style (`DIAGRAM_THEME_COLORS`). Applied in `DiagramFigure` right before injection.
- `grading.ts`: numeric parsing ("1,200", "7.5 A", "−3"), tolerance checks, item/quiz grading (pass on the exact ratio).
- `quiz.ts`: `toPublicQuiz` (no answers/explanations/tolerances to the client).
- `solver.ts`: pure DC solver for nested series/parallel networks; open = ∞, short = 0; never NaN (open strings share the
  string voltage, shorted branches share group current, a dead short across the source sets `deadShort`).
- `schematic.ts`: ladder layout; `sandbox.ts`: experiment-mode edits; `workshop.ts`: public projection, bench grading,
  meter formatting ("60 mA", "OL").
- `exam.ts`: mulberry32 PRNG, largest-remainder allocation by area weight, deterministic `selectExamQuestions(bank,
  size, seed)`, `gradeExam` (by area), `EXAM_PASS_PERCENT = 70`, timer pace 144 s/question.
- `progress.ts`: lesson states (LOCKED until prerequisites COMPLETED; a COMPLETED lesson stays completed), track views,
  next-lesson suggestion.
- `roadmap.ts` (server-only): tolerant reader of the seed facts (every field optional, http(s) links only).
- `service.ts` (server-only, all queries scoped by userId) and `actions.ts` (`"use server"`: three actions, each
  `requireUser` + per-user rate limit 30/min + zod + `revalidatePath("/academy","layout")`, `/dashboard`, `/missions`).

## Contracts other modules rely on

| Activity | QuizAttempt.quizKey | `passed` means | XP | Missions / achievements |
|---|---|---|---|---|
| Lesson quiz | the content `quiz.key` (e.g. `ohms-law-quiz`) | score ≥ `passingScore` % | `LESSON_COMPLETED`, key `xp:lesson:<lessonKey>`, sourceType `Lesson`, once per lesson | first completion: `DailyActivity.lessonsCompleted += 1` + `applyEventToMissions(LESSON_COMPLETED, sourceId=lessonKey)`; every pass: `applyEventToMissions(QUIZ_PASSED, sourceId=quiz.key)` + `evaluateAchievements` — all in one transaction with the attempt and `LessonProgress` |
| Workshop | `workshop:<key>` | clean run: all tasks correct **and** no numeric answer read off the meter (or committed after experimenting) first | none (prevents inflation) | clean run: `applyEventToMissions(QUIZ_PASSED, sourceId=workshop:<key>)` + `evaluateAchievements` |
| Practice exam | `exam:<size>:<seed>` | ≥ 70 % | `PRACTICE_EXAM_PASSED`, key `xp:exam-pass:<YYYY-MM-DD in user tz>`, sourceType `PracticeExam`, sourceId attempt id — max once per day | pass: `applyEventToMissions(QUIZ_PASSED, sourceId=exam:<size>:<seed>)` + `evaluateAchievements` |

`LessonProgress`: `attempts` counts quiz attempts, `bestScore` is the best percent, `status` IN_PROGRESS on open/fail,
COMPLETED on first pass (never downgraded), `completedAt` set once. `QuizAttempt.answers` stores per-item
`{id, answered, correct, given}` (lesson), `{id, answered, correct, measuredFirst, given}` (workshop) or
`{id, area, selected, correct}` (exam).

Answer keys never reach the browser before grading: quiz/exam/workshop multiple-choice keys and explanations are only in
server-action results. Practice items are checked client-side by design. Numeric workshop answers are derivable from the
published circuit, so the bench checks them instantly with the same solver the server uses.

## How to test

```sh
npx vitest run tests/unit/academy-*.test.ts     # 10 files, 96 tests (DB suites use careerquest_test)
npx tsc --noEmit 2>&1 | grep -E 'academy'        # clean for these paths
npx eslint src/lib/academy src/components/academy "src/app/(app)/academy" tests/unit/academy-*.test.ts
```

- `academy-content`: real data loads with zero issues; fixtures prove skip+log, 16-section limit, dev re-read.
- `academy-solver`: every workshop task finite; hand-checked series-basics, series-parallel-1, series-parallel-2,
  fault-finding-open, missing-ground-path; open/all-open/short/dead-short/no-NaN/KCL-KVL; schematic layout.
- `academy-markdown`, `academy-svg`: parser/renderer + sanitizer removals (scripts, handlers, href, external refs,
  style url(), foreignObject, entity-encoded schemes) and preservation of all 60+ real diagrams.
- `academy-quiz` (DB): locked quiz refused, open → IN_PROGRESS, fail doesn't complete, pass twice → XP once, best score
  kept, prerequisite unlock, per-user scoping.
- `academy-workshop` (DB + render), `academy-exam` (DB + render: XP once per local day, stale/tampered selections
  rejected, owner-only review), `academy-roadmap` (flags, tolerance, render), `academy-lessons` (+ `-render`).

## Known gaps / notes for integration

- Not opened in a browser (no `next dev`/`build` allowed here); UI is covered by `renderToStaticMarkup` smoke tests only.
  Worth a manual pass at 375 px: bench schematic scrolls horizontally inside its card by design (min width 320 px).
- The lesson page marks IN_PROGRESS during the server render (idempotent upsert). If link prefetching ever renders the
  full page, a prefetched lesson would be marked started.
- The exam timer runs in the browser only (reload restarts it) and timing is not persisted.
- Retaking an already-passed lesson quiz creates another passed QuizAttempt; the game module's `QUIZ_PASSED` metric
  counts passed attempts, so a memorized retake can satisfy "pass a quiz this week". XP is unaffected.
- `/academy/apprenticeships`, `/academy/hours`, `/academy/certification` are linked but built by `academy-records`.
- `src/lib/game/lessons-index.ts` (game module) reads lesson JSON separately with looser parsing; it could switch to
  `listLessons()` from `@/lib/academy/content` so both agree on which lessons are valid.

## External dependencies

None. Content is read from `data/academy/**` and `data/seed/**` at runtime (never copied into code).
