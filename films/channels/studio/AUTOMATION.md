# Automation

What runs from one command today, what needs code or an outside service first, and what stays with a person.

Three facts frame every table:

- **"Automated" means a tool in the repo does the step when an agent runs one command.** Nothing runs on a timer.
  An agent (a builder or the coordinator) starts every step and reads the result.
- **Nothing posts by itself.** Publishing is manual: the owner posts by hand and presses "Uploaded"
  ([prism-studio/CLAUDE.md](../../../prism-studio/CLAUDE.md)).
- **Channel tools live on the channel's branch.** A path written `space: season2/gaps.py` is
  `films/channels/space/season2/gaps.py` on `claude/space-s2` ([STRUCTURE.md](STRUCTURE.md), section 1).

## 1. Automated today

`$E` is the episode folder. Stage numbers are the pipeline's in [README.md](README.md).

| Stage | Step | Tool | Command |
|---|---|---|---|
| 1 Concept | Scaffold an episode from the four inputs | [tools/new_episode.py](tools/new_episode.py) (new) | `python3 -I films/channels/studio/tools/new_episode.py --channel <slug> --topic "..." --duration <s> --format <kind> --out <a scratch folder>` (without `--out` it writes `./new-episodes/` in the current directory) |
| 1, 5 | Check the plan: `episode.json`, `shots.json`, claims used, human gates | [tools/validate.py](tools/validate.py) (new) | `python3 -I films/channels/studio/tools/validate.py $E` |
| 2 Research | Recompute every number in the script | `calc.py` in the episode or film folder (Possibility Lab, every long film) | `python3 -I $E/calc.py` |
| 2 | The claims sheet for a reviewer | `kits/cinema/script/claims_sheet.py` | `python3 -I kits/cinema/script/claims_sheet.py $E --reviewer "a physicist"` |
| 4 Script | Lint the script: template, pace, length, hook, claim tags, reading grade | `kits/cinema/script/lint.py` | `python3 -I kits/cinema/script/lint.py $E --segment <measure\|readout\|work>` |
| 4 | The four-part recording script for a real voice | `films/channels/voice-scripts/make_recording_script.py` | see the file's header; prints the reading time and warns above 10 minutes |
| 5 Storyboard | Scene table (Skin Sense) | `skincare: set/tables.py` | on the channel branch |
| 6 Visual | Stills with the full finish | `kits/cinema/film/render.mjs` | `node kits/cinema/film/render.mjs --film $E --tier final --times 2,9,20` |
| 6 | Theme contrast | `kits/cinema/sci/contrast.py` | `python3 -I kits/cinema/sci/contrast.py <slug>` |
| 6 | Labelled placeholder art, art index, skin-tone match (Skin Sense) | `skincare: set/gen_art.py`, `set/art_index.py`, `set/labmatch.py` | on the channel branch |
| 7 Motion | Compile the clock: `film.json`, `sheet.json` | `$E/compile.py` (three channels); `skincare: set/build_ep.py epNN` | `python3 -I $E/compile.py` |
| 7 | Animatic and draft; the event table for sound | `kits/cinema/film/render.mjs` | `--tier animatic`, `--tier draft`, `--cues` |
| 8 Voice | AI voice, word timings | `kits/cinema/voice/tts.py`, `align.py`; per-line speeds in the channel's `voice.py` | `$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/tts.py $E/script.md $E/vo --voice <id>`, then `.../align.py $E/vo` (the voice tools run in their own Python, set up by `kits/cinema/voice/setup.sh`) |
| 8 | Clean a real recording and cut it to lines | `kits/cinema/voice/polish.py`; `whatif: voice-owner/cut.py` | `python3 -I kits/cinema/voice/polish.py <recording> --film $E` (`--style whisper` for Skin Sense Season 3) |
| 8 Sound | Compose, master, measure sync | `kits/cinema/studio/render.py` (runs `studio/qa.py`) | `python3 -I kits/cinema/studio/render.py $E/sheet.json $E/build/audio` (Skin Sense: `--root $E $E/sheet.json $E/audio`) |
| 8 | List voiceless gaps | `space: season2/gaps.py`; also inside [tools/qa_episode.py](tools/qa_episode.py) | `python3 -I gaps.py $E` |
| 9 Editing | Final render, detached, resumable | `kits/cinema/film/run.sh` | `kits/cinema/film/run.sh $E --tier final`; a bare `run.sh $E` resumes |
| 9 | Join chunks, add sound, write the master and poster | `kits/cinema/film/render.mjs` | `--tier final --assemble --audio <mix>` |
| 9 | Replace only the title card and end card | `kits/cinema/film/splice.py` (not on `claude/outer-layer-s1-b`) | `python3 -I kits/cinema/film/splice.py $E --name <name>` |
| 9 | Skin Sense: compile, sound, render, assemble, QA, upscale in one go | `skincare: set/final.sh` | `films/channels/skincare/set/final.sh epNN` |
| 9 | Long video joined from episodes | `kits/cinema/film/compilation.mjs` (five versions: each channel branch and the shared branch); `skincare: compilations/vol02/build-vol02.sh` | `node kits/cinema/film/compilation.mjs --channel ... --episodes ... --name ...` |
| 10 QA | Delivery gates for 60 to 75 s shorts; the measured table | `kits/cinema/film/qa.py`, `scorecard.py` | `python3 -I kits/cinema/film/qa.py $E` |
| 10 | Every format: hard gates, automated rubric points | [tools/qa_episode.py](tools/qa_episode.py) (new) | `python3 -I films/channels/studio/tools/qa_episode.py <video> --episode $E/episode.json --out $E/review/qa-report.json` (a long video: `--kind long`; joined from episodes: `--kind long --cards`) |
| 11 Export | The 1440x2560 YouTube file (an upscale) | `kits/cinema/film/youtube1440.py` | `python3 -I kits/cinema/film/youtube1440.py $E` |
| 11 | Covers | `whatif: covers.py`; `space: season2/make_cover.py`; `skincare: set/covers.mjs` | per channel |
| 11 | Caption file, posting text, `packaging.json` helpers | `whatif: srt.py`, `posting_pack.py`; `space: season2/make_posting.py`, `pack.py`; `prism-studio`: `npm run text:pack` | per channel |
| 11 | The like/follow line over the end card (sound only) | `whatif: cta/remix.py`; `space: season2/cta_remix.py`; `skincare: set/cta_line.py` | per channel |
| 11 | Send finished files to Prism, import, check | `prism-studio/scripts/push-media.mjs`, `import-episodes.ts`, `check-media.ts` | `node scripts/push-media.mjs --dry-run <slug>`, then without `--dry-run` (it queues the import), `npm run media:check` (run by the coordinator in `prism-studio/`, on a checkout of `claude/made-with-claude-film`, after bringing the delivered files in: [STRUCTURE.md](STRUCTURE.md), section 11) |
| 12 Archive | Archive an uploaded season; erase episode videos from the server 3 days after both "Uploaded" buttons | Prism Studio | happens inside Prism |

Not a tool, but done by an agent without a person: searching for sources and drafting claims (they stay OPEN),
writing the script and the shot manifest, building the scene, reading frame grabs, filling the builder's and
coordinator's rubric scores, writing the Episode Intelligence Report.

## 2. Needs a code change or an integration

Nothing here works today. Each row names where the change goes and its roadmap stage ([ROADMAP.md](ROADMAP.md)).

### Prism Studio, before Season 3 imports

All in `prism-studio/` on `claude/made-with-claude-film`. Folders outside a season slate import nothing: Reality
Rulebook's `ep13` to `ep20` already exist and are invisible until rows 1 and 2 are deployed.

| # | What | Where | Stage |
|---|---|---|---|
| 1 | Add a `SEASON3` slate. Film channels: 8 titles equal to the film's `chapters.txt` lines. Skin Sense: 6 titles. Series title starts "Season 3:" | `scripts/import-episodes.ts` | 1 |
| 2 | `seasonsFor`: add Season 3 at `first: 13`, or derive `first` from earlier slate lengths (Season 4 starts at ep21; Skin Sense at ep19) | `scripts/import-episodes.ts` | 1 |
| 3 | `slateForEpisode`: no change; add a test | `tests/` | 1 |
| 4 | Read `film.json` `disclosures.aiVoice` in place of the hard-coded `aiVoice: true`. In Season 3, Skin Sense and One More Orbit use real recordings; Possibility Lab uses the owner's cloned voice, labelled AI; Reality Rulebook keeps its AI voice | `scripts/import-episodes.ts`, `src/domain/disclosures.ts` | 1 |
| 5 | Posting wording for a real voice, and for the owner's cloned voice ("a synthetic version of the owner's own voice (AI)") | `src/domain/metadata.ts` (`buildMetadata`, `postingNotesFor`) | 1 |
| 6 | Season 3 parts have beats `hook`, `body`, `tease`; fall back to `body` so posting text is not just the two-second hook | `src/domain/metadata.ts` | 1 |
| 7 | Stop appending "?" to a hook that is a statement | `scripts/import-episodes.ts` | 1 |
| 8 | Optional. No change is needed for a pushed film: `linkByChapters` has no count limit. `LESSON_MAX = 6` limits only `createLesson` and the Lessons form; raise it to 8 only if the owner should be able to build an 8-part lesson inside Prism | `src/domain/lessons.ts` | Optional |
| 9 | `registerCompilation`: retry linking when no parts are linked, so corrected chapters take effect | `src/domain/lessons.ts` | 1 |
| 10 | `catalog.ts`: no change needed | | |
| 11 | Unguarded parse: a malformed `film.json` or `claims.json` fails the whole import. Guard it, or validate before every push | `scripts/import-episodes.ts`; until then `python3 -I -m json.tool` on both files | 3 |
| 12 | Every episode is recorded as 1080x1920 and labelled a Short without measuring; a missing poster is stored anyway | `scripts/import-episodes.ts` | 3 |

Order: deploy 1 and 2, then push `ep13` before or with the film. Verify with `npm run typecheck && npm test`.

### The film kit and the channels

| What | Where | Why it is needed | Stage |
|---|---|---|---|
| Per-format lint profiles (premium lesson, ASMR pace, long film); an exemption for CTA.md lines; accept `verified_via` "owner opened the page" | `kits/cinema/script/lint.py` (three forks and the base to merge first) | The lint fails Season 3 formats and warns on the studio's own like/follow lines | 1 |
| Merge the kit forks: `compilation.mjs` (five versions), `lint.py` (three forks plus the base), and `sci/hud.js`, `script/claims_sheet.py`, `script/test_via.py`, `studio/compose.py`, `kits/cinema/motion/` ([STRUCTURE.md](STRUCTURE.md), section 1) | `kits/cinema/` on the four channel branches and the shared branch | A fix made on one branch does not reach the others; `film/splice.py` is missing on Skin Sense's branch | 1 |
| Rename Skin Sense's old `episode.json` (the input of `set/ss3.mjs`) | `skincare: set/ss3.mjs`, `build_ep.py`, `make_sheet.py`, `tables.py` | It collides with the master spec's file name | 1 |
| Skin Sense writes delivery QA to `review/`; Prism reads `build/qa-delivery.json` | `skincare: set/final.sh` | Prism does not see its QA | 1 |
| A size option in the renderer | `kits/cinema/film/render.mjs` (`TIERS` is hard-coded) | A native 1440x2560 tier. It rendered correctly in a scratch copy at 1.4 to 2 times the 1080 time | 2 |
| Constants that are absolute in pixels | `kits/cinema/cinema3d.js` (`pxPerSample` 3.5 px; the depth-of-field loop stops at 700 taps) | A new size shifts the look unless these scale | 2 |
| A 2560x1440 writer for one continuous 16:9 film | `kits/cinema/film/` | `youtube1440.py` handles 9:16 only; `compilation.mjs` wraps finished episodes | 2 |
| Grain, ambient occlusion, shadows on the three film channels | `kits/cinema/cinema3d.js`, channel `set/` | In the wish-list table of [README.md](README.md) as missing | 2 |
| Skin Sense files outside the renderer's code hash | `kits/cinema/film/render.mjs`, or the channel's imports | A resume misses changes to `episode.json`, `print3d.js`, `w3d.js` and art | 3 |
| Which frames did an edit touch | `kits/cinema/film/` (the made-with-claude film has `signatures.cjs --diff`; the channel renderer does not) | Partial re-renders rest on the builder's judgment today | 3 |
| One generic compile step, one cover tool, one posting tool, one like/follow remix | `kits/cinema/`, from the per-channel copies in [LIBRARY.md](LIBRARY.md) | Each channel carries its own fork | 3 |
| The archive index and a claims index | [tools/](tools/) | Paths are set in [STRUCTURE.md](STRUCTURE.md), section 9; no tool builds them | 3 |
| Per-format profiles in the kit's own delivery QA | `kits/cinema/film/qa.py` | It fails a 70 to 90 s lesson on length, and Prism shows its `fails` | 4 |

### Outside services

| What | State today | What it would take | Stage |
|---|---|---|---|
| Posting to YouTube, TikTok and Instagram | Manual. Prism has connector code (`prism-studio/src/integrations/`) and says publishing is manual until a platform is connected | The owner connects an account in Prism's settings. Posting still needs the owner's decision per post | Not planned; the owner's call |
| Platform numbers | Connected accounts are read by Prism's worker; other accounts are logged by hand or pasted as CSV on Analytics (`prism-studio/RUNBOOK.md`) | The same connection, or the owner's CSV or screenshots | 5 |
| Paintings | The owner makes them in ChatGPT from the studio's prompts and uploads them | Stays with the owner's account; no key is stored | Not planned |
| A clone of the owner's own voice | No clone tool on this branch or the channel branches. An earlier toolchain is on `claude/voice-clone` (`kits/cinema/voice/CLONE.md`, with a consent gate) and a new trial is under way: Roadmap 3.10. Possibility Lab's Season 3 film already defaults to the cloned voice (`longform/earth-spin/compile.py`, `VOICE=own`) | His recorded consent, an AI label on every use, and his approval by ear. Evelyn's voice is never cloned | 3 |
| Expert sign-off | Reality Rulebook: a physicist signs off each script before it posts (channel bible; the name is a TODO). Skin Sense: a dermatologist review is the owner's decision (`films/channels/briefs/coordinator-handoff.md`); until decided it is a TODO in every handoff. No route to an expert exists in the repo | The owner finds and asks the expert | Not planned |

## 3. Needs a person

| Step | Who | Why a tool cannot do it | Where the result is recorded |
|---|---|---|---|
| Agree the topic and working title | Owner | It is the owner's channel | `episode.json` `title`, `status` |
| The look gate: one still, and for Skin Sense Season 3 a 10 s clip, before any full build | Owner | Taste and brand. A wrong look costs hours of render | `episode.json` `status.lookGate`; the season look's `status` in the identity file |
| Open every source | Owner or a reviewer | The rule itself: a claim is OK only when a person has opened the page. An agent's search excerpt stays OPEN | `claims.json` `status`, `verified_via`; `episode.json` `status.sources` |
| Expert sign-off | A named expert, through the owner. Reality Rulebook: a physicist signs off each script before it posts (channel bible; the name is a TODO). Skin Sense: a dermatologist review is the owner's decision (`films/channels/briefs/coordinator-handoff.md`); until decided it is a TODO in every handoff | Outside knowledge and accountability | `review/claims-table.md`; a TODO in the handoff until done |
| Record the voice | Owner (Possibility Lab, One More Orbit); Evelyn, through the owner (Skin Sense) | Skin Sense and One More Orbit use real recordings; Possibility Lab Season 3 uses the owner's cloned voice for the film's Part A, labelled AI, with his real takes for the part lines. Evelyn's voice is never synthesised, and the studio never contacts her | `voice-owner/`, `voice-evelyn/`; `episode.json` `status.recording`, `voice.synthetic`, `voice.consent` |
| Evelyn's written OK and credit choice | Owner | Consent belongs to her | A TODO in every handoff until the owner confirms |
| Make the paintings | Owner, in ChatGPT | The owner's account | `art/` in the film folder; `disclosures.aiVisuals` |
| Choose the title | Owner | [../PACKAGING.md](../PACKAGING.md): scores are judgments, not predictions | `packaging.json` `winner`; `status.title` |
| Listen on a phone speaker and headphones | Owner | Agents cannot hear | Rubric criterion AQ4 in `review/rubric-scores.json` |
| Watch the film and approve it | Owner | Agents judge frames, not a film at speed | Gate `owner_approval` |
| Post, then press "Uploaded" | Owner | Publishing is manual, by rule | Prism Studio |
| Send platform numbers (screenshots or CSV) | Owner | No account is read automatically unless the owner connects it | The "Measured" half of the Episode Intelligence Report |
| Passwords, keys, payment details | Owner, in settings | Never in chat or in a file | Nowhere in the repo |
| Say "commit" and "push" | Owner or coordinator | House rule: commit only when asked; never force-push; never touch `main` | git, on the channel's branch |

## 4. Selective re-render: what is true today

- The final renders in 10 s chunks. Each chunk is encoded and verified, then its PNGs are deleted
  (`kits/cinema/film/render.mjs`).
- `kits/cinema/film/run.sh $E` resumes: it keeps every verified frame and chunk and renders the rest. It survives
  the 2-hour limit on background jobs because it detaches.
- **One range:** `node kits/cinema/film/render.mjs --film $E --tier final --from A --to B --fresh` discards and
  re-renders the chunks that range touches. The range is widened to whole chunks.
- **After a code change** the renderer refuses to add to old chunks ("that would mix two versions in one film").
  `--force-mixed` accepts the mix and records it in `manifest.json`; `--assemble` needs it too. It is safe only when
  the edit cannot change any frame outside the range. No tool checks that today.
- **A change of length, size or frame rate** cannot be mixed at all: render the whole film fresh.
- **Sound only:** no re-render. Run the studio again, then `--assemble --audio <mix>`.
- **Title card and end card only:** `kits/cinema/film/splice.py` re-renders the two ends and copies the middle bit
  for bit (9:16 masters). The file is not on `claude/outer-layer-s1-b`, so Skin Sense cannot use it yet.
- **Stills:** `--times 2,9,20` renders single frames with the full finish.
- **A Chromium update** blocks a resume by design; `--force-mixed` would join two browsers' frames, so render fresh.
- **Skin Sense:** `episode.json`, `print3d.js`, `w3d.js` and the art are outside the code hash. After touching them,
  render fresh.
- **A joined long video** is rebuilt whole by its build script after any episode in it changes.

How to choose: [QA.md](QA.md), section 6.

## 5. Batch: what is true today

- **One render at a time per machine.** `render.mjs` refuses a second render while one runs (`--share-cpu`
  overrides it, and both then run 1.6 to 1.8 times slower, per `kits/cinema/film/README.md`). A batch is a queue.
- **Measured speed** on this machine: about 1.5 s a frame at 1080x1920, so about 1.1 to 1.2 hours for an 80 s
  episode and 7 to 8 hours for a 9-minute film ([README.md](README.md), "Master resolution per format"). Earlier whole
  finals logged 0.89 and 1.13 s a frame, so it varies.
- **Queue scripts that exist:** `films/channels/render-finals.sh` (the first episodes, one after another; its
  channel list is old) and `films/channels/rerender-finals.sh <ep> <ep> ...` (cues, compile, sound, final, assemble,
  QA for each; safe to restart). Both were written for the per-episode `compile.py` layout of Season 1.
- **A render worker** is a second session that only renders: [../briefs/render-worker.md](../briefs/render-worker.md).
- **Whole-channel commands:** `python3 -I kits/cinema/film/youtube1440.py films/channels/<slug>` upscales every
  episode that needs it. `npm run media:push` sends every changed file of one channel.
- **Not batched today:** the compile step (one `compile.py` per episode on three channels), covers and posting text
  (a tool per channel), QA (`qa_episode.py` takes one video; loop over files in the shell), and the scaffold.
- **Disk:** about 5 GB free. Keep one final in flight; a 4K chunk alone holds about 600 MB of PNGs.
