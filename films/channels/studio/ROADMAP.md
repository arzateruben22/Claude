# Roadmap

Five stages. Each row is one piece of work with the files it touches, what it depends on, its size, what it buys
in plain words, and how to tell it worked. No row promises a saving in hours or a gain in views: where a cost was
measured it is quoted, and where it was not, it says "not measured".

Size: **S** one or two files, no render needed to check. **M** several files, or one channel's renders to check.
**L** new rendering code, or a change on all four channel branches with full renders to check.

Where the gaps were found: [README.md](README.md) (engine and wish-list), [LIBRARY.md](LIBRARY.md) (what each
library section is missing), [STRUCTURE.md](STRUCTURE.md) sections 10 and 12, [AUTOMATION.md](AUTOMATION.md)
section 2, [QA.md](QA.md) section 7.

## Stage 1: essential foundation

### Done: delivered by this blueprint (11 Nov 2026, not yet committed)

| Deliverable | Files | Checked by |
|---|---|---|
| System map, 12-stage pipeline, fidelity standard, honest-label table | [README.md](README.md) | Read against the four audits |
| Folder structure and names | [STRUCTURE.md](STRUCTURE.md) | Against the channel branches and Prism's importer |
| Channel identity system | [identities/](identities/) `skincare.json`, `physics.json`, `whatif.json`, `space.json` | `python3 -I -m json.tool`; [tools/validate.py](tools/validate.py) reads them |
| Master episode schema and shot manifest | [schema/](schema/) `episode.schema.json`, `shot.schema.json`; [SHOTS.md](SHOTS.md); [templates/](templates/) | `tools/validate.py templates/episode.example.json` |
| Four-input workflow | [NEW-EPISODE.md](NEW-EPISODE.md); [tools/new_episode.py](tools/new_episode.py) | One worked example per format in NEW-EPISODE.md |
| Production library map | [LIBRARY.md](LIBRARY.md) | Against the channel branches |
| QA framework and 100-point internal rubric | [QA.md](QA.md); [qa/rubric.json](qa/rubric.json) | The rubric sums to 100 (30 automated, 70 by people) |
| QA tool for every format | [tools/qa_episode.py](tools/qa_episode.py) | Run on six delivered videos (two in full, four on the file gates) and on deliberately broken clips: [QA.md](QA.md) section 3 |
| Automation map | [AUTOMATION.md](AUTOMATION.md) | Commands read from the tools' own headers |
| Episode Intelligence Report | [templates/episode-intelligence-report.md](templates/episode-intelligence-report.md); [reports/README.md](reports/README.md) | Not yet used on an episode |
| A skill so later sessions follow this | `.claude/skills/episode-blueprint/SKILL.md` | Not yet triggered in a session |

### To do

| # | Work | Files | Depends on | Size | Benefit | Test |
|---|---|---|---|---|---|---|
| 1.1 | Review and commit the blueprint; tell each builder where to read it | `films/channels/studio/`, `.claude/skills/episode-blueprint/` | The coordinator's go-ahead | S | Builders on channel branches can read one current copy | `git show origin/claude/made-with-claude-film:films/channels/studio/README.md` works from a channel branch |
| 1.2 | Prism: Season 3 slate, season start numbers, the voice flag and its wording (Skin Sense and One More Orbit use real recordings; Possibility Lab Season 3 uses the owner's cloned voice, labelled AI), `body` fallback, hook "?" fix, relink retry | `prism-studio/scripts/import-episodes.ts`, `src/domain/disclosures.ts`, `metadata.ts`, `lessons.ts`, `tests/` ([AUTOMATION.md](AUTOMATION.md) rows 1 to 7 and 9; row 8, `LESSON_MAX`, is optional: a pushed film links through `linkByChapters`, which has no limit) | Final part titles: they must equal the film's `chapters.txt` lines. Reality Rulebook's title awaits the owner | M | Season 3 episodes appear in Prism at all; real and cloned voices are labelled truthfully | `npm run typecheck && npm test`; a new test for `slateForEpisode`; `ep13` imports on the dev database and links to its film |
| 1.3 | Merge the kit forks. `compilation.mjs`: five versions (each channel branch and the shared branch). `lint.py`: three forks (physics, space, skincare) plus the base. Also forked: `sci/hud.js` (physics), `script/claims_sheet.py` and `script/test_via.py` (space), `studio/compose.py` (whatif), `kits/cinema/motion/` (skincare only). Restore `film/splice.py` on Skin Sense's branch | `kits/cinema/` on the four channel branches and the shared branch ([STRUCTURE.md](STRUCTURE.md), section 1) | Each builder's agreement on what its fork changed (`KIT-CHANGES.md`) | M | One fix reaches every channel | Each channel's Season 2 scripts lint with the same errors and warnings as before; `compilation.mjs --cards-only` draws the same cards |
| 1.4 | Lint profiles per format (premium lesson, ASMR pace, part, long film); no warning on CTA.md's own lines; accept the `verified_via` values in [QA.md](QA.md) section 3B ("owner opened the page", "calculation", "derivation", "own model", "assumption (no source)", and the not-yet-read values the forks use) | `kits/cinema/script/lint.py` | 1.3 | M | The lint tells the truth about Season 3 scripts instead of failing them all | Evelyn's lesson script and one long-film script pass; every CTA.md line passes; Season 2 results unchanged |
| 1.5 | Rename Skin Sense's old `episode.json` (the input of its composition engine) | `skincare: set/ss3.mjs`, `build_ep.py`, `make_sheet.py`, `tables.py`; `ep04` to `ep12` | Nothing | S | The master spec's name is free on Skin Sense | A draft of `ep12` renders the same sample frames (sha256 in `frames.jsonl`) |
| 1.6 | Skin Sense writes delivery QA where Prism reads it | `skincare: set/final.sh` (`review/qa-delivery.json` to `build/qa-delivery.json`) | Nothing | S | Prism shows Skin Sense's QA result | The import attaches `fails` to a Skin Sense episode |
| 1.7 | Fix Possibility Lab's `chapters.txt` (a seventh line that matches no episode) | `whatif: compilations/s2/chapters.txt` | 1.2 row 9 (relink retry), or a fresh registration | S | Its six episodes link to their long video | Prism shows the parts under the long video |
| 1.8 | Stale shared documents | [../DECISIONS.md](../DECISIONS.md) (old names, "go daily"); [../SEASON-FORMAT.md](../SEASON-FORMAT.md) (`push-one.sh`, "description.md" where `chapters.txt` is meant, the 10 Nov look bullet, "Reality Rulebook first", `<pl\|oo>-cta.m4a` where the recording scripts say `<prefix>-s<season>-cta.m4a`); [../PACKAGING.md](../PACKAGING.md) (its example title "The Moon Starts Coming Closer. It Won't Stop." is retired for One More Orbit); [../STUDIO-STYLE.md](../STUDIO-STYLE.md) (say that `#2F5BFF` is Reality Rulebook's Prism accent; on screen its cobalt is `#1F3BD1`); `films/channels/render-finals.sh` (channel list) | The owner's decisions below | S | A builder reading an old file no longer builds the wrong thing | Each corrected line cites the decision's date |
| 1.9 | Stale channel documents | Each `bible.md`; `skincare: theme.json`, `s3-looktest/BRIEF.md`; `whatif: voice-owner/README.md` (the clone rule); `physics: bible.md` line 522 ("The compilations/s2 rebuild is dropped": confirm it still holds) | The look gate (Skin Sense) | S | The same | The builder confirms in the handoff |
| 1.10 | Check an identity file against its `theme.json` | [tools/validate.py](tools/validate.py), or a new `tools/check_identity.py` reading the branch with `git show` | 1.1 | S | The summary agents plan from cannot drift from what the viewer sees | Changing one hex in a copy makes it fail; the four real files pass. Skin Sense is compared with `theme-ivory.json` and `set/ss3.mjs`, not `theme.json`, until that file is replaced ([STRUCTURE.md](STRUCTURE.md), section 12) |
| 1.11 | Pilot: take one episode through the whole blueprint, from the four inputs to the report | One episode folder on its channel branch | 1.1; the look gate for that channel | M | The blueprint is corrected by use before a season depends on it | `validate.py` passes, `qa_episode.py` exits 0, the report exists, and its "Changes to the blueprint" list is applied |

## Stage 2: visual production systems

Fidelity upgrades the capability audit showed are possible but not built. Costs are the audit's measurements on
this machine (4 cores, software rasteriser). "Not measured" means measure it on one real shot before adopting it.

| # | Work | Files | Depends on | Size | Measured or unknown cost | Benefit | Test |
|---|---|---|---|---|---|---|---|
| 2.1 | A size option in the renderer, with the finish's pixel constants scaled | `kits/cinema/film/render.mjs` (`TIERS`), `kits/cinema/cinema3d.js` (`pxPerSample` 3.5 px, the 700-tap depth-of-field stop) | Nothing | M | 1440x2560: 2.28 and 3.06 s a frame against 1.58 and 1.54 at 1080 (1.4 to 2 times). 2160x3840: 5.03 and 6.15 s a frame | A real native 1440 master, for episodes whose art is at least 1440 px wide | The same frame at both sizes, compared after downscaling; new stills approved; safe boxes scaled; the file is labelled "1440 native" only when it is |
| 2.2 | A 2560x1440 master for one continuous 16:9 film | `kits/cinema/film/` (a native tier from 2.1, or a labelled upscale step like `youtube1440.py`) | 2.1 for native | S | Native: as 2.1, with 16:9 assumed equal per pixel (not measured). Upscale: not measured | Season 3 long films get the file Prism needs without wrapping them in cards | `qa_episode.py --kind long` passes; `nativeSize` in `episode.json` says which it is |
| 2.3 | Soft shadows on Reality Rulebook, One More Orbit and Possibility Lab | Channel `set/` light rigs; a shared rig in `kits/cinema/sci/` | 2.9 helps | M | Not measured on the kit finish. Skin Sense already renders 2048 px `PCFSoftShadowMap` shadows inside its 1.58 s a frame | Objects sit on their ground instead of floating | A/B stills of one shot; seconds a frame from `frames.jsonl`; 30 stepped frames show no shadow crawl |
| 2.4 | Physically based materials as a kit library, starting from Skin Sense's skin, cell, strand and fluid materials | New `kits/cinema/sci/materials.js`, from `skincare: set/studio.js` | Nothing | M | Clearcoat and sheen: not measured alone. Transmission: about 1.6 s a frame against 0.8 to 1.2 in the capability test | The other channels can use glass, liquid and soft surfaces without rewriting them. Say "skin shading that approximates subsurface scattering", never the bare term | Stills per material; cost per frame recorded beside each |
| 2.5 | A shared environment for reflections; decide on real `.hdr` files | `kits/cinema/sci/` (the procedural soft box through `PMREMGenerator.fromScene`); a loader and one licensed `.hdr` only if chosen | Nothing | M | Procedural: in use on Skin Sense. `.hdr`: not measured; no loader is vendored | Consistent reflections across channels. Output stays 8-bit SDR either way | Stills; the file's licence in `assets.md`; the label stays "environment reflections" |
| 2.6 | An ambient occlusion pass | `kits/cinema/cinema3d.js`, or a vendored pass | 2.1 (constants scale) | L | Not measured. Nothing exists to measure | Contact shading in corners and under objects | A/B stills; seconds a frame; 30 stepped frames show no flicker |
| 2.7 | Grain in the kit finish | `kits/cinema/cinema3d.js`, from `skincare: set/w3d.js` (`grain` in its own finish, used at 0.02 by the Season 3 look test), `set/look3.js` `grainV3` and `set/studio.js` `createGrain` | Nothing | S | Render cost not measured. Grain raises the bit rate, and files stay under 90 MB (the 10 s look test with grain is 27 MB, 21 Mbps: its `out/qa.json`) | Skin Sense Season 3 asks for the kit finish plus grain | Seeded: a frame is byte-identical whatever the render order; the delivered file's size before and after |
| 2.8 | Named camera presets and one shared rig | A preset file in `kits/cinema/`; `kits/cinema/sci/rig.js` from `space: set/rig.js` and `whatif: set/rig.js` | Nothing | M | None at render time | `camera.preset` in a shot manifest resolves to real keys ([SHOTS.md](SHOTS.md) section 6) | A manifest preset renders the same frames as the hand-written keys it replaced |
| 2.9 | Shared light rigs and one colour bridge | `kits/cinema/sci/`, from `physics: set/props.js`, `set/aces.js`, `space: set/look.js`, `whatif: set/look.js`, `skincare: set/studio.js` | Nothing | M | None expected; verify | One place to fix light and colour | Each channel's reference still is unchanged |
| 2.10 | Skin Sense Season 3 look: theme file, voxel world, through-the-surface descent rig. A 10 s look test exists (voxel take: `set/voxel3d.js`, rendered on the `--plain` path with grain 0.02 in `set/w3d.js`, no motion blur). It awaits the owner's look gate. It is not yet a reusable world or a theme file | `skincare: theme` for the night look, `set/voxel3d.js`, `set/night.mjs`, `s3-looktest/` | The owner's look gate | L | Not measured yet: measure from the look test's `frames.jsonl` on the machine that rendered it | The season's one world, reused by six lessons | The owner approves one still and one 10 s clip; then stills per lesson |
| 2.11 | An ASMR score preset | `kits/cinema/studio/vibes/` | The owner's loudness decision (below) | S | None at render time | Lessons share one quiet sound world | The studio's `qa.json` passes; no hit, sting or whoosh in the cue sheet |
| 2.12 | Reference sheets for recurring figures and skin tones | Channel `library/`; a table from `episode.json` `three.skinHex` | Nothing | S | None | The blue anchor figure and each skin tone look the same in every episode | A new shot matches the sheet on a side-by-side grab |
| 2.13 | Lift Season 3 worlds out of single films | Each film's `scene.mjs` into the channel's `set/` | The film is delivered | M | None | The next episode starts from a world, not from zero | The film still renders the same sample frames |

Not on this roadmap, because the engine cannot do them: hardware ray tracing, path-traced global illumination, HDR
output, 4K video as a delivery tier. 4K stays for stills (5 to 7 s each, measured). If the machine or the engine
changes, measure first and update the wish-list table in [README.md](README.md) in the same change.

## Stage 3: automation and asset management

| # | Work | Files | Depends on | Size | Benefit | Test |
|---|---|---|---|---|---|---|
| 3.1 | One compile step that reads `episode.json` and `shots.json` | `kits/cinema/`, from `skincare: set/build_ep.py` and the per-episode `compile.py` files | 1.5; 2.8 | L | A new episode stops copying and editing the last one's compile file (132 to 430 lines today); `disclosures` and the format carry over by themselves | A Season 2 episode rebuilt through it gives the same `film.json` |
| 3.2 | One cover tool, one posting-text tool, one like/follow remix | `kits/cinema/`, from the per-channel copies in [LIBRARY.md](LIBRARY.md) | 1.3 | M | Four forks become one | Each channel's last cover and posting text come out the same |
| 3.3 | The archive index | New `tools/archive_index.py` writing `archive/<slug>.json` ([STRUCTURE.md](STRUCTURE.md) section 9) | 1.1 | M | One list of every delivered file, its size, whether its pixels are native or an upscale, its QA result | Every row matches `git ls-tree` on the channel branch; nothing typed by hand |
| 3.4 | An index of owner art, skin tones and environments (one still each) | New tool reading each `art/index.json`, `library/` and the delivered posters | Nothing | M | Which painting was used where, at what size, and that it is AI-made; which worlds exist | Spot-check five paintings against their films |
| 3.5 | A claims index across episodes, and one table of the constants the `calc.py` files restate | New `tools/claims_index.py` reading every `claims.json`; a shared constants file | Nothing | S | A source a person opened last season is found again. Statuses are copied, never upgraded by a tool | A claim marked OPEN in its episode is OPEN in the index; each `calc.py` gives the same numbers as before |
| 3.6 | Which frames did an edit touch, and a wider code hash | `kits/cinema/film/` (port the idea of `films/made-with-claude/scripts/signatures.cjs --diff`); include Skin Sense's `episode.json`, `print3d.js`, `w3d.js` and art in the hash | Nothing | M | A partial re-render no longer rests on judgment | Change one label: the diff lists only the frames that show it; re-rendering them gives the same sha256 per frame as a fresh render |
| 3.7 | One long-film build | From `physics: lf01/build.py`, `parts.py` and `whatif: longform/earth-spin/compile.py` | 3.1 | M | The film and its 8 parts come from one description on every channel | Each channel's parts start and end on the film's chapter times |
| 3.8 | A render queue for a season | Replace `films/channels/render-finals.sh` and `rerender-finals.sh` | Nothing | S | A season's finals run one after another and restart safely | Kill it mid-chunk and start again: no frame is rendered twice |
| 3.9 | Prism import hardening | `prism-studio/scripts/import-episodes.ts` (guard the JSON parse; measure size; check the poster exists) | 1.2 | S | One bad file no longer stops a whole import | A test with a malformed `film.json` |
| 3.10 | The owner's own cloned voice, if he keeps it | `kits/cinema/voice/`; a consent note beside the recordings | His recorded consent; an AI label on every use | M | Add-on lines without a new recording session. Evelyn's voice is never cloned | `disclosures.aiVoice` is true wherever it speaks; the owner approves each use by ear |
| 3.11 | `new_episode.py` sees the channel branch | [tools/new_episode.py](tools/new_episode.py) | 1.1 | S | It can refuse a folder that is taken and find a part's long film | Asking for an existing folder number fails with the reason |

## Stage 4: quality assurance

`qa_episode.py`, the rubric and the scores file exist (Stage 1). This stage makes them the way every channel works.

| # | Work | Files | Depends on | Size | Benefit | Test |
|---|---|---|---|---|---|---|
| 4.1 | Run the tool on every delivered master and long video once, and tune it | [tools/qa_episode.py](tools/qa_episode.py), [qa/rubric.json](qa/rubric.json) `formats` | 1.1 | S | Thresholds proven on every delivered file, not the six run so far ([QA.md](QA.md) section 3). Known already: Reality Rulebook's remixed Season 2 masters fail `length`. Reality Rulebook's strobe against the flash count is the likely next surprise | A table of every file's result; each fail traced to the video or to the tool |
| 4.2 | Make it the last step of every final, so the freeze and voiceless-gap checks are gates on every channel; retire the channel copy of `gaps.py` | `skincare: set/final.sh`; the other channels' build notes; [../briefs/render-worker.md](../briefs/render-worker.md); `space: season2/gaps.py` | 4.1 | S | A failed gate is seen before a commit, on every channel | A deliberately broken clip stops the script |
| 4.3 | Per-format profiles in the kit's delivery QA, or a kit-shaped result written by `qa_episode.py` | `kits/cinema/film/qa.py`, or `tools/qa_episode.py` writing `build/qa-delivery.json` | 4.1 | M | Prism stops showing a false length failure on 70 to 90 s lessons | A 78 s lesson imports with no `fails`; a 68 s short is unchanged; `scorecard.py` still runs |
| 4.4 | An ASMR profile: loudness target, the voice-gap rule, a check for sudden loudness jumps | [qa/rubric.json](qa/rubric.json) `formats`; `tools/qa_episode.py` | The owner's two decisions below; the first finished lesson to measure | M | "No hits, stings or sudden loudness changes" becomes a measured gate | Passes the approved look-test clip; fails a clip with an added hit |
| 4.5 | Frame checks from one command | New `tools/grabs.py`: from `shots.json`, the last frame of each shot beside the first of the next, with the safe box drawn; 30 stepped frames at each cut | 1.11 | M | The coordinator's continuity, safe-area, text-block and flicker checks start from one sheet | The sheet for one delivered episode shows every cut |
| 4.6 | Count text blocks in the render's audit | `kits/cinema/film/render.mjs` (the audit) | Nothing: `render.mjs` is the same file on the four branches | M | The two-text-block rule is measured, not eyeballed | The frames Possibility Lab's `declutter.py` was written for are flagged without it |
| 4.7 | Check captions against the measured words | `tools/qa_episode.py`, reading `film.json` captions and `vo/words.json` | 3.1 helps (one caption shape) | S | "Captions synced to the voice" becomes a tool gate | Shift one caption by 0.3 s: it fails |
| 4.8 | A self-test for the QA tool | New test script that builds the four broken clips (flash, freeze, silence, black start) with ffmpeg and expects exit 1 | Nothing | S | A change to the tool cannot silently stop catching a failure | The script passes on a clean checkout |
| 4.9 | The reviewer's brief names the scores file | [../briefs/](../briefs/) | 1.1 | S | People's scores are recorded the same way on every channel | A filled `review/rubric-scores.json` gives a total |

## Stage 5: continuous optimisation

| # | Work | Files | Depends on | Size | Benefit | Test |
|---|---|---|---|---|---|---|
| 5.1 | An Episode Intelligence Report after every episode | `review/intelligence-report.md` in each episode folder ([reports/README.md](reports/README.md)) | 1.11 | S each | What was learned is written once, where the next builder looks | Rubric criterion RU3; the report's "Measured" half cites a file for every number |
| 5.2 | Platform numbers in the reports | The owner's screenshots or CSV; Prism's Analytics labels each number API, CSV or MANUAL | The owner sends them, or connects an account | S each | Hypotheses about what worked can be checked. Until then they stay hypotheses | Every number in "Measured" has its source and date; none in "Hypotheses" |
| 5.3 | Lessons flow back into the blueprint | [identities/](identities/), [SHOTS.md](SHOTS.md), [QA.md](QA.md), [LIBRARY.md](LIBRARY.md) | 5.1 | S each | The same mistake is not made on the next channel | Each change cites the report it came from |
| 5.4 | Render cost per shot | New `tools/render_cost.py` reading `build/final/*/frames/*/frames.jsonl` (milliseconds per frame are logged) against `shots.json` windows | 1.11 | M | Planning uses the studio's own measured seconds per frame for each kind of shot | Its total equals the scorecard's render cost for the same episode |
| 5.5 | A season review | One page per season from that season's reports: gates that failed, re-renders and why, seconds a frame by channel | 5.1 | S | The next season's plan starts from counts, not memory | Every figure can be traced to a report |
| 5.6 | Rubric upkeep | [qa/rubric.json](qa/rubric.json) (`version`) | 5.5 | S | Points follow what the owner's notes keep catching | Each change is dated, with the reports that led to it |
| 5.7 | One measured experiment at a time | For example: a native 1440 short beside its upscale; 4K stills for thumbnails | 2.1 | M | The opt-in tiers are chosen on evidence | Written up as a report: what was measured, and what is still a guess |
| 5.8 | Retire per-channel `PRODUCTION.md` logs | Each channel's `PRODUCTION.md` | 5.1 in use | S | One place and one style for lessons | New lessons appear in reports only |

## Decisions that wait for the owner

These block rows above. None is settled here.

| Decision | Why it matters | Blocks |
|---|---|---|
| Skin Sense Season 3 look: confirm the dark voxel look (`#0B1513`, teal `#3FBFAE`) over the ivory base | The identity file marks it "pending look gate" | 2.10, 1.9 |
| Reality Rulebook's Season 3 title | Part titles must equal the film's chapter lines. On the channel branch `lf01/script.md` now carries "How Much Would You Slow Time to Watch Light Move?", while `lf01/packaging.json` still names "Slow Down One Second Until Light Stands Still"; the owner's choice is not on record | 1.2 |
| ASMR loudness: -14 LUFS (today's gate) or nearer the look test's -16.2 | The look test fails today's gate | 2.11, 4.4 |
| Does the 1.2 s voice-gap rule apply to ASMR lessons, and to picture-only beats in a long film? | Today a short fails on it, and a long film lists each gap for a person | 4.4 |
| Still cards in a joined long video | Measured: 131.5 s of the 517.5 s Skin Sense Season 2 long video is frozen picture (still cards with narration over them). SEASON-FORMAT.md says never to stretch with long holds. Whether cards cost viewers is not measured | Skin Sense Season 3's long video |
| Posting order for Season 3 | SEASON-FORMAT.md says Reality Rulebook first; Possibility Lab reached finals first | 1.8 |
| The owner's own cloned voice: consent on record, and the wording of the AI label | A channel README still says never clone | 3.10, 1.9 |
| Evelyn's written OK, and how she is credited | Her voice and a look that draws on her course | Skin Sense Season 3 delivery |
| Native 1440 as an opt-in tier | 1.4 to 2 times the render time, measured | 2.1 in use |
| The freeze limit: 1.4 s (the tool's setting, from the coordinator's brief) or the renderer's 2.5 s | No rule file states a number. Once confirmed it is written into [../STUDIO-STYLE.md](../STUDIO-STYLE.md) | [QA.md](QA.md) section 3A, `freeze` |
| Reality Rulebook's Season 2 `ep09` to `ep12` run long (coordinator) | Remixed with the like/follow line over a held end card; `ep12` measures 77.233 s, over the 75 s window. Record the four as accepted exceptions, or widen the short window. No approved master is re-cut meanwhile | 4.1; `lengthOpenDecision` in [qa/rubric.json](qa/rubric.json) |
| Expert sign-off | Reality Rulebook: a physicist signs off each script before it posts (channel bible; the name is a TODO). Skin Sense: a dermatologist review is the owner's decision (`films/channels/briefs/coordinator-handoff.md`; its bible asks for a board-certified dermatologist); until decided it is a TODO in every handoff | Posting on both channels |

## First five actions, in order

1. **Review and commit the blueprint** (1.1), and put the twelve decisions above to the owner in one message.
2. **Prism's Season 3 changes** (1.2), rows 1 and 2 first. Until they are deployed, Season 3 folders import nothing,
   and Possibility Lab is already at finals.
3. **Run `qa_episode.py` on every delivered master and long video** (4.1). It costs no render, gives a baseline for
   all four channels, and finds a wrong threshold before a builder trusts an exit code.
4. **Merge the lint forks and add the format profiles** (1.3, 1.4). Season 3 scripts cannot be linted honestly
   until then.
5. **Pilot one episode through the whole blueprint** (1.11), after its look gate and after 1.5 if it is a Skin Sense
   lesson. Write its Episode Intelligence Report, then fix the blueprint from the report's last section.
