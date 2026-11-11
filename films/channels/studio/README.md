# Studio blueprint

Written 11 Nov 2026 from four audits of the repo: the render engine (measured), the four channel branches, what Prism
Studio imports, and the binding rules.

## What this is

- The one place that says how the four science channels make an episode, from a topic to an archived film.
- It is built on what exists: the film kit (`kits/cinema/`), the channel folders on their branches, and Prism Studio.
- It adds what was missing: channel identity files, an episode spec, a shot manifest, an internal QA rubric and a roadmap.
- Every capability stated here was read in the code or measured. Anything not built yet says "Roadmap" and its stage.
- The shared rule files stay the authority: [PACKAGING.md](../PACKAGING.md), [SEASON-FORMAT.md](../SEASON-FORMAT.md), [CTA.md](../CTA.md), [STUDIO-STYLE.md](../STUDIO-STYLE.md). This folder links to them and never restates them.

## The four inputs a new episode needs

| Input | Example | What it decides |
|---|---|---|
| Channel name | "Skin Sense" | The identity file ([identities/](identities/)): palette, type, look, voice, sound, rules, branch, folder |
| Episode topic | "What one shiver does inside you" | The question, the hook, the claims to research |
| Target duration | 80 s | The format's length window, the word budget, the beat times |
| Output format | `short`, `premium`, `part` or `long` | Aspect, size, frame rate, the folder it lands in, which QA gates apply |

Everything else is looked up or drafted from these: see [NEW-EPISODE.md](NEW-EPISODE.md).

Four inputs start the work. They do not finish it. These steps stay with a person:

| Step | Who | Rule |
|---|---|---|
| Choose the title | Owner | [PACKAGING.md](../PACKAGING.md) |
| Approve the look (one still, one 10 s clip) before a build | Owner | [SEASON-FORMAT.md](../SEASON-FORMAT.md), the `cinema-kit` skill |
| Open every source before a claim is marked OK | Owner or a reviewer | [STUDIO-STYLE.md](../STUDIO-STYLE.md) |
| Record the voice, or pass on a guest's recording and written OK | Owner | [SEASON-FORMAT.md](../SEASON-FORMAT.md) |
| Post, and press "Uploaded" | Owner | `prism-studio/CLAUDE.md` |

## System map

| Who | Does | Works in |
|---|---|---|
| Owner | Decides topics, titles and looks. Records Possibility Lab and One More Orbit. Passes on Evelyn's recording for Skin Sense. Makes paintings in ChatGPT. Opens sources. Posts by hand | Chat, GitHub upload pages, ChatGPT, Prism Studio |
| Coordinator | Keeps the shared rules, this blueprint, the briefs and the recording scripts. Passes work between the owner and the builders. Pushes finished media to Prism | Branch `claude/made-with-claude-film`: `films/channels/*.md`, `films/channels/studio/`, `films/channels/voice-scripts/`, `prism-studio/` |
| Channel builder (one per channel) | Writes the script and claims, builds the scene, renders, runs QA, commits. Does not push to Prism: the coordinator does ([STRUCTURE.md](STRUCTURE.md), section 11) | The channel's own branch, `films/channels/<slug>/` ([STRUCTURE.md](STRUCTURE.md)) |
| Film kit | Lints scripts, makes and aligns voice, composes sound, renders, measures | `kits/cinema/` (`script/`, `voice/`, `studio/`, `film/`, `sci/`, `cinema3d.js`) |
| ChatGPT | Paints stills from the studio's prompts, on the owner's account. Its images are always disclosed as AI illustrations | Prompts: [CHATGPT-ART-PROMPTS.md](../CHATGPT-ART-PROMPTS.md), `packaging.json` `chatgptPrompt`. Results: `art/` in the episode folder |
| Prism Studio | Imports finished files, shows the title, cover, captions and sources, records what the owner uploaded, holds analytics | `prism-studio/` (production code is on `claude/made-with-claude-film`) |

```
 OWNER ──── 4 inputs, decisions, recordings, ChatGPT paintings ────►  COORDINATOR
   ▲                                                                 (claude/made-with-claude-film: shared rules,
   │ reviews, posts by hand,                                          this blueprint, recording scripts, prism-studio/)
   │ presses "Uploaded"                                                  │ brief                 ▲ finished files,
   │                                                                     ▼                       │ committed on the channel branch
 PRISM STUDIO ◄── push-media.mjs + import, by the COORDINATOR      CHANNEL BUILDER ── uses ──► FILM KIT (kits/cinema)
 (prism-studio/)   (finished files only)                           (own branch: films/channels/<slug>/)   script · voice · studio · film
   │                                                                     ▲
   └── analytics, when they exist ──► Episode Intelligence Report ───────┘ lessons feed the next episode
```

Facts that shape the map:

- Each channel is built on its own branch. The copies of `films/channels/<slug>/` on `claude/made-with-claude-film` are old.
- `kits/cinema/film/render.mjs`, `film/qa.py`, `cinema3d.js` and `studio/qa.py` are identical on the four branches. `film/compilation.mjs` has five versions (each channel branch and the shared branch) and `script/lint.py` three forks plus the base; other kit files are forked too. The list is in [STRUCTURE.md](STRUCTURE.md), section 1; merging them is Roadmap stage 1.
- Prism imports only finished files with fixed names. Working folders never reach it ([STRUCTURE.md](STRUCTURE.md)).

## The 12-stage pipeline

One table. "Today" names the tool or file that does the stage now. New pieces from this blueprint are marked "new".

| # | Stage | Input | Output | Today | Quality bar | If it fails |
|---|---|---|---|---|---|---|
| 1 | Concept | The four inputs; the identity file; the season slate | `episode.json` with the question, hook, payoff and format | By hand: `season2/SLATE.md`, `s3-slate/*.packaging.json`. Scaffold: [NEW-EPISODE.md](NEW-EPISODE.md), [tools/](tools/) (new) | One question, one story. The title claims no more than the script will prove | Take the next topic on the slate. Do not research a weak question |
| 2 | Research | The question and hook | `claims.json`, every row OPEN with its source; `calc.py` and `calc.json` for computed numbers | Builder by hand; the `calc.py` pattern (Possibility Lab and every long film); `kits/cinema/script/claims_sheet.py` | Every factual sentence has a source or a derivation. No invented statistics, studies or quotes | Hedge as far as the source goes, or cut the claim. If the hook's fact fails, go back to stage 1 |
| 3 | Narrative | Claims; the format | `story.beats` in `episode.json`. Long film: 8 chapters, each ending on an open loop | `kits/cinema/script/WRITING.md`; [SEASON-FORMAT.md](../SEASON-FORMAT.md) | One thread from hook to payoff. Long film: a live number, a twist at about 60%, the payoff in the last minute, a last shot that loops to the first | Reorder the beats before any line is written |
| 4 | Script | Beats; claims | `script.md` with claim tags, `pron.json`, `review/clarity-review.md`; a recording script for a real voice | `kits/cinema/script/lint.py`, `numerals.py`; `voice-scripts/make_recording_script.py` | Lint passes. Short: 150 to 180 words, 2.2 to 3.0 words a second, a question spoken by 2.0 s. Grade 8 or lower, sentences up to 22 words, about four spoken numbers | Rewrite the failing lines and lint again. Known gap: lint has no profile for 70 to 90 s lessons, ASMR pace or long films, and warns on CTA.md lines (Roadmap stage 1) |
| 5 | Storyboard | Script; identity; season look | `shots.json`, `review/scene-table.md` | Scene table by hand (Skin Sense: `set/tables.py`). Manifest: [SHOTS.md](SHOTS.md), [schema/](schema/) (new) | Every shot has a purpose, a principle, start and end states and acceptance checks. Each aspect is its own composition, never a crop | Fix the manifest. No scene code before the shot list is approved |
| 6 | Visual production | Approved shots; owner art | `scene.mjs`, channel `set/` modules, `art/`, stills | three.js scene with a pure `window.seek(t)`; `kits/cinema/sci/*`; stills with `render.mjs --tier final --times` | Stills approved before a full render. Skin Sense: the owner's look gate. Channel palette and type only. `kits/cinema/sci/contrast.py` reports 0 fails | Revise the stills. Missing owner art: build on a labelled placeholder (Skin Sense: `set/gen_art.py`) and never deliver with it |
| 7 | Motion | Scene; voice timings | `film.json` (shots, beats, camera keys, captions, cues); a draft | `compile.py` per episode, or Skin Sense's `set/build_ep.py`, on `kits/cinema/script/timeline.py`; `render.mjs --tier animatic` or `draft`, `--cues` | The camera move has a reason. The picture moves with the sentence. No frozen stretch in a draft. Scale jumps carry a motion-blur floor (`kits/cinema/events.json`) | Re-key and re-run the draft tier (540x960). Never fix motion in a final |
| 8 | Narration and sound | Script; recordings or the AI voice; cues | `vo/` WAVs, `lines.json`, `words.json`; `sheet.json`; the mix, stems and `qa.json` | `kits/cinema/voice/tts.py` or `polish.py`, then `align.py`; `kits/cinema/studio/render.py` with a preset in `studio/vibes/` | -15 to -13 LUFS, true peak at most -1 dBTP, mono-safe. Transients within one frame. Voiceless gaps of at most 1.2 s. An AI voice is labelled | Re-voice or re-cut the one line. An AI stand-in carries drafts until a recording arrives. Evelyn's voice is never synthesised |
| 9 | Editing | Scene; `film.json`; the mix | `out/<name>-9x16.mp4` and its poster; long: `compilations/<name>/<name>-16x9.mp4` | `kits/cinema/film/run.sh <ep> --tier final`, `render.mjs --assemble --audio`; long: `film/compilation.mjs`; parts from the film's own 9:16 render | Every chunk verified. The code hash unchanged across a resume. One Chromium job per machine. Theme fonts present | `run.sh <ep>` resumes. A title or end-card change only: `film/splice.py` (not on Skin Sense's branch). After a Chromium update: render fresh |
| 10 | QA | The delivered mp4; `audit.json`; the studio's `qa.json`; claims | `review/qa-report.json`, `review/rubric-scores.json` (new); `build/qa-delivery.json`, `review/scorecard.md`, `review/HUMAN-REVIEW.md` | [tools/qa_episode.py](tools/qa_episode.py) (new: the hard gates and the automated rubric points, every format); `kits/cinema/film/qa.py` (60 to 75 s shorts only), `film/scorecard.py`, `studio/qa.py`; the (a) to (h) gate in [STUDIO-STYLE.md](../STUDIO-STYLE.md); the 100-point rubric in [QA.md](QA.md) (new) | `qa_episode.py`: every hard gate passed. Gate: nothing under 3; (a), (g), (h) at 4 or more; nothing factual or ethical open. Rubric: 95 or more, an internal assessment only. Release needs both | Go back to the stage that caused it. Re-render only the chunks that changed |
| 11 | Export | A master that passed QA | The YouTube file, cover, captions, `out/packaging.json`, `POSTING.md`; the episode ready for review in Prism | `film/youtube1440.py`; cover and posting tools per channel ([LIBRARY.md](LIBRARY.md)); `prism-studio/scripts/push-media.mjs`, then the import, run by the coordinator from the shared branch's checkout ([STRUCTURE.md](STRUCTURE.md), section 11) | Names match [STRUCTURE.md](STRUCTURE.md). The cover is newer than the mp4. Every `packaging.json` check is true. `npm run media:check` is clean | Fix the file and push again. Prism ignores a re-render in a season already marked uploaded |
| 12 | Archiving | A delivered, posted episode | A commit on the channel branch; the Episode Intelligence Report; an archive row | git; Prism archives a season once the owner has pressed every "Uploaded" button. Report and archive: [STRUCTURE.md](STRUCTURE.md) (new) | Every delivered file committed, each under 90 MB. The report keeps verified data apart from hypotheses | No analytics yet: write the report from the measured build data and mark the rest "not yet measured" |

Automation and human steps per stage: [AUTOMATION.md](AUTOMATION.md).

## Maximum-fidelity standard

"The highest quality the engine supports" means: the best picture this renderer really produces, at a size it really
renders, described in words that are true. It never means a name borrowed from a renderer we do not run.

### The engine

- three.js r160, core only (`kits/cinema/vendor/three.module.min.js`). No addons are vendored.
- Frames are drawn in headless Chromium through Playwright. The GL renderer is a CPU software rasteriser
  (`render.mjs` launches with `--use-angle=swiftshader`). There is no GPU and no WebGPU. WebGL 2, maximum texture 8192, MSAA 4.
- A scene is a browser module with a pure `window.seek(t)` ([kits/cinema/film/README.md](../../../kits/cinema/film/README.md)).
- `kits/cinema/film/render.mjs` captures one 8-bit PNG per frame of the whole page (the canvas plus the caption
  overlay). It encodes 10 s chunks (x264 slow, CRF 12, BT.709), then `--assemble` joins them, adds AAC sound and writes
  the delivery at CRF 15. Output is 8-bit SDR.
- Sizes are fixed in `TIERS`: the final tier is 1080x1920 or 1920x1080. There is no size option today.

### The finish applied today

| Path | Channels | Applies | Does not apply |
|---|---|---|---|
| Kit finish, `kits/cinema/cinema3d.js` | Reality Rulebook, One More Orbit, Possibility Lab | Motion blur (2 to 32 sub-frames across a 180 degree shutter), bokeh depth of field, bloom, ACES and sRGB, 4x MSAA or sub-pixel jitter | Grain. Shadows and ambient occlusion (these scenes cast none). Captions and labels are page text, so they get no motion blur |
| Skin Sense's own finish, `finish()` in `set/w3d.js`, rendered with `--plain` | Skin Sense Season 2 | 4x MSAA, a 20-tap depth of field, bloom, ACES, a soft-box environment for reflections, 2048 px soft shadows, physically based skin materials | Motion blur (the kit finish is off). The 3-D picture is a 1080x1060 canvas inside the page. Grain: `finish()` takes a `grain` amount (`three.grain` in the episode's data file), 0 in the Season 2 episodes and 0.02 in the Season 3 look test; the helpers `set/look3.js` `grainV3` and `set/studio.js` `createGrain` also exist |

Skin Sense Season 3 asks for the kit finish plus grain ([SEASON-FORMAT.md](../SEASON-FORMAT.md)). The kit carries no grain
([kits/cinema/README.md](../../../kits/cinema/README.md)). Skin Sense's own finish does (`grain` in `set/w3d.js`): the Season 3
look test uses it at 0.02 on the `--plain` path, which has no motion blur. Grain in the kit finish is Roadmap stage 2.

### The directive's wish-list, as it stands

| Effect | Status | How, and where |
|---|---|---|
| Motion blur | Have | `cinema3d.js` accumulates sub-frames. Not on the `--plain` path, not on page text |
| Depth of field | Have | Bokeh in `cinema3d.js`; 20-tap in Skin Sense's `set/w3d.js` |
| Bloom, ACES tone mapping | Have | Both finishes |
| Physically based materials | Have, used by Skin Sense only | Clearcoat, sheen, transmission and thickness render without errors. Reality Rulebook uses MeshStandardMaterial; One More Orbit and Possibility Lab use custom shaders |
| Soft shadows | Have, used by Skin Sense only | `PCFSoftShadowMap` in `set/w3d.js`. The other three channels cast no shadows: Roadmap stage 2 |
| Reflections | Approximate | A pre-filtered environment map (`PMREMGenerator`), not ray-traced |
| Refractions | Approximate | `MeshPhysicalMaterial` transmission, screen-space. Correct in a test, at about 1.6 s a frame against 0.8 to 1.2 s |
| Subsurface scattering | Approximate | `skinMaterial` in Skin Sense's `set/studio.js`: sheen, clearcoat, an attenuation tint, warm fill. Not in the kit |
| Volumetric lighting | Approximate | Additive shaft geometry (`createShaft` in `set/studio.js`), glow sprites and bloom |
| HDR environment lighting | Approximate | A procedural soft box through `PMREMGenerator.fromScene`. No `.hdr` files or loader |
| Film grain | Have, Skin Sense only | Skin Sense's own finish (`set/w3d.js` `grain`) and the helpers `grainV3` and `createGrain`; not in the kit: Roadmap stage 2 |
| Global illumination | Not available | No path tracer is vendored. Stand-in: environment light plus a hemisphere light |
| Ambient occlusion | Not available | No SSAO or GTAO pass. To be written or vendored: Roadmap stage 2 |
| Ray tracing | Not available | No GPU, and WebGL 2 has no ray-tracing interface |
| HDR output | Not available | Capture is 8-bit PNG; delivery is 8-bit SDR |
| Native 1440 video | Not wired | Renders correctly with a one-line size override in a scratch copy of `render.mjs`. A size option is Roadmap stage 2 |
| 4K video (2160x3840) | Not wired | Renders correctly the same way. Cost below. Stills only |

### Master resolution per format, with the measured cost

Measured on this machine (4 cores, 11 Nov 2026) on two real episodes: Skin Sense ep12 on the plain path and
Reality Rulebook ep12 with the kit finish. Seconds of render per frame:

| Size | Skin Sense ep12 | Reality Rulebook ep12 | 80 s episode (2,400 frames) | 9-minute film (16,200 frames) |
|---|---|---|---|---|
| 1080x1920 | 1.58 | 1.54 | 1.1 to 1.2 h | 7 to 8 h |
| 1440x2560 | 2.28 | 3.06 | 1.6 to 2.1 h | 11 to 14 h |
| 2160x3840 | 5.03 | 6.15 | 3.5 to 4.2 h | 24 to 29 h |

The hour figures are estimates from those frames, for this machine only, with encode and page loads. The Reality
Rulebook figures are a floor: every sampled frame sat at the lowest blur count. 16:9 was not measured; equal pixel
counts are assumed. Earlier whole finals logged 0.89 and 1.13 s a frame at 1080, so speed varies.

How far to trust this table:

- The larger sizes were rendered through a one-line size override in a scratch copy of `render.mjs`. The audit did
  not record its exact command, how many frames it sampled at each size, or at which times, and its `frames.jsonl`
  files and logs were not kept. Only the comparison JPGs survive, so the table cannot be re-derived.
- The machine was not idle: other jobs shared its 4 cores during the audit, so the figures include that load.
- One figure was checked again the same day by the blueprint's review: four 1080x1920 stills of Skin Sense ep12 on
  the plain path took 2.52, 1.73, 1.37 and 1.91 s (mean 1.88 s). So the 1080 row is the right order of magnitude.
  The 1440 and 4K rows, the transmission figure (about 1.6 s a frame against 0.8 to 1.2 s), "600 MB per 4K chunk"
  and "maximum texture 8192" were not re-checked.
- Treat every figure here as an estimate until it is re-measured with `kits/cinema/film/scorecard.py` on the first
  Season 3 final, and record that measurement in the film's Episode Intelligence Report.

| Format | Rendered at | Delivered as | Honest label |
|---|---|---|---|
| `short`, `part`, `premium` (9:16) | Native 1080x1920, 30 fps | `<name>-9x16.mp4` at 1080x1920 for TikTok and Instagram; `<name>-9x16-youtube.mp4` at 1440x2560, a Lanczos upscale (`kits/cinema/film/youtube1440.py`) | "1080x1920 native". The YouTube file: "1440 upscale" |
| `long`, joined from episodes (Seasons 1 and 2; Skin Sense Season 3) | No single render: cards are drawn at 2560x1440; each episode picture is its 1080x1920 master | `<name>-16x9.mp4`, a 2560x1440 frame built by `kits/cinema/film/compilation.mjs`. It accepts only 1080x1920 masters and scales each down to 810x1440 in the centre slot | "2560x1440 upload; episode picture 810x1440 from the 1080x1920 master" |
| `long`, one continuous 16:9 film (Season 3 on the three film channels) | `render.mjs` draws 1920x1080, 30 fps | `<name>-16x9.mp4` at 2560x1440. No tool writes that file yet (Roadmap 2.2) | Once built by upscale: "2560x1440 upscale of a 1080 render" |
| Stills (covers, thumbnails) | Up to 2160x3840, at 5 to 7 s each | JPG at the size [PACKAGING.md](../PACKAGING.md) asks for | The size it was rendered at |
| Native 1440 (opt-in) | Roadmap stage 2 | Only when the art is at least 1440 px wide; 1.4 to 2 times the render time | "1440 native", once it exists |
| 4K video | Not a tier | An experiment only | Never claimed |

Why 1080 is the shorts master: TikTok and Instagram stop at 1080x1920, the QA gates and safe boxes are written in
1080 pixels, and the owner's paintings are smaller than that (Skin Sense ep12: 941x1672). In the 4K test frames, type
and lines were sharper, but mesh facets and fixed-size textures showed.

One gap to close: a single continuous 16:9 film has no tool that writes its 2560x1440 file. `youtube1440.py` handles
9:16 episodes only, and `compilation.mjs` builds the frame around finished episodes. Roadmap stage 2 adds either a
native 2560x1440 tier or a labelled upscale step for a single film.

### Never claim a technique we did not use

| Say | Never say |
|---|---|
| "Code-rendered 3-D illustration", "AI illustration" (for the owner's paintings) | "Photo", "footage", or "photorealistic" without "illustration" |
| "1080x1920 native; YouTube file is a 1440 upscale" | "1440p native", "4K", "cinematic 4K" |
| "Soft shadows" (Skin Sense only) | "Ray-traced shadows" |
| "Environment reflections", "screen-space refraction" | "Ray-traced reflections and refractions" |
| "Skin shading that approximates subsurface scattering" | "Subsurface scattering" |
| "Light shafts and bloom" | "Volumetric lighting" |
| "Environment and hemisphere light" | "Global illumination", "path tracing" |
| "Internal score 96 of 100" in a review file | A score in public text, or as a prediction of views |

Rules:

1. A technique, resolution or number goes into a film's notes, a post or a report only if the build log or a
   measurement shows it. `shots.json` records what each shot really used.
2. Render seconds, loudness, length and sync are copied from `build/qa-delivery.json` and the scorecard, never typed from memory.
3. A render or an AI image is never presented as a photo. Mark it "Illustration" where it could pass for one ([PACKAGING.md](../PACKAGING.md)).
4. When the engine gains a technique, update the wish-list table in the same change that adds the code.

### Risks that come with the engine

- The kit finish has pixel-absolute constants: `pxPerSample` is 3.5 px, and the depth-of-field loop stops at 700 taps. A new size shifts the look, so a new tier needs its own stills.
- Background jobs end after 2 hours. Long renders depend on `run.sh` resume. A Chromium update blocks resume by design.
- Skin Sense's `episode.json`, `print3d.js`, `w3d.js` and art sit outside `render.mjs`'s code hash, so a resume misses changes to them. Render fresh after touching them.
- Files stay under 90 MB (GitHub refuses 100 MB). A 9-minute film gets about 1.3 Mbps at any size.
- Disk: about 5 GB free. One 4K chunk holds about 600 MB of PNGs.

## Where everything is

| File | What it holds |
|---|---|
| [STRUCTURE.md](STRUCTURE.md) | The folder structure, file names, which branch holds what, what Prism imports, where reports and the archive go |
| [identities/](identities/) | One identity file per channel, and how to read and change them |
| [schema/](schema/) | `episode.schema.json` (the master episode spec) and `shot.schema.json` (the shot manifest) |
| [SHOTS.md](SHOTS.md) | The shot generation template and the shot manifest |
| [NEW-EPISODE.md](NEW-EPISODE.md) | The workflow that starts from the four inputs |
| [QA.md](QA.md), [qa/rubric.json](qa/rubric.json) | The QA framework and the 100-point internal rubric, and its machine-readable copy |
| [AUTOMATION.md](AUTOMATION.md) | What runs by itself today, what needs an outside service, what needs a person |
| [ROADMAP.md](ROADMAP.md) | The five stages, with dependencies, difficulty, benefit and tests |
| [LIBRARY.md](LIBRARY.md) | The permanent production library: ten sections mapped to real paths, and the reusable modules per channel |
| [templates/](templates/) | Starting files for an episode, a shot manifest and the Episode Intelligence Report |
| [tools/](tools/) | Python tools (standard library only): `new_episode.py` scaffolds, `validate.py` checks the plan, `qa_episode.py` checks the delivered video |
| [reports/](reports/) | How Episode Intelligence Reports are written, and where season reviews go |

Existing documents this folder builds on:

| Document | Covers |
|---|---|
| [../PACKAGING.md](../PACKAGING.md) | Titles, thumbnails, `packaging.json`, truth rules |
| [../SEASON-FORMAT.md](../SEASON-FORMAT.md) | The long film and its 8 parts, Skin Sense Season 3, voice recordings |
| [../CTA.md](../CTA.md) | The like/follow lines and where they go |
| [../STUDIO-STYLE.md](../STUDIO-STYLE.md) | The (a) to (h) quality gate, words, facts, process rules |
| [../DECISIONS.md](../DECISIONS.md) | Early channel decisions and platforms (it keeps the old channel names) |
| [../briefs/STANDARDS-v2.md](../briefs/STANDARDS-v2.md) | Clarity standard and the four review deliverables |
| [../../../kits/cinema/README.md](../../../kits/cinema/README.md) | The kit and the finish |
| [../../../kits/cinema/film/README.md](../../../kits/cinema/film/README.md) | The renderer, tiers, delivery QA, compilations |
| [../../../kits/cinema/script/WRITING.md](../../../kits/cinema/script/WRITING.md) | The story standard |
| [../../../kits/cinema/voice/README.md](../../../kits/cinema/voice/README.md), [studio/README.md](../../../kits/cinema/studio/README.md) | Voice and sound |
| [../../../.claude/skills/cinema-kit/SKILL.md](../../../.claude/skills/cinema-kit/SKILL.md) | The film process and its approval gates |
| [../../../prism-studio/CLAUDE.md](../../../prism-studio/CLAUDE.md) | Prism Studio's rules |

## Differences from the directive's wording

The repo and the owner's latest decisions win. Each difference is recorded, not hidden.

| The directive says | The studio records | Why |
|---|---|---|
| Skin Sense is ivory, peach, rose, deep green `#00685F` | That as the base identity, plus a Season 3 look: voxel skin layers on `#0B1513`, teal `#3FBFAE`, ivory serif captions. Status: pending look gate, owner to confirm | The owner's 11 Nov 2026 decision in SEASON-FORMAT.md, asked for twice, is the newest |
| "Photorealistic" | "Photoreal illustration, always disclosed" | PACKAGING.md's truth rules: a render or AI image is never presented as a photo |
| "Cinematic 4K" | Shorts at native 1080x1920. Long videos uploaded at 2560x1440: a joined video holds 810x1440 episode pictures between cards drawn at full size; one continuous film is a 1080 render, upscaled once a tool exists. 4K for stills and as an experiment | Measured above. No native 1440 or 4K tier exists |
| Ray tracing, global illumination, subsurface scattering, volumetrics | "Not available" or "approximate", effect by effect | The engine is a CPU rasteriser on WebGL 2 |
| A 100-point score with a target of 95 | An internal rubric layered over the (a) to (h) gate. Never public, never a prediction | STUDIO-STYLE.md's gate stays binding; PACKAGING.md says scores are judgments |
| Start an episode from four inputs | Four inputs start the scaffold. The look gate, source opening and title choice stay with a person | The `cinema-kit` skill, SEASON-FORMAT.md, STUDIO-STYLE.md |
| Automate the workflow | Everything up to "ready for review" can be automated. Publishing stays manual | `prism-studio/CLAUDE.md`: nothing posts by itself |
| Reality Rulebook cobalt `#2F5BFF` | On screen: cobalt `#1F3BD1` (`theme.json`). `#2F5BFF` is the packaging and Prism accent | The channel's own theme file |
| Possibility Lab's small glossy blue mannequin | A flat-shaded blue faceless anchor figure (`set/anchor.js`) | As built; gloss is not rendered today |

Open conflicts inside the repo, found by the rules audit. Each needs a decision or a fix; none is settled here.

| Conflict | Proposed handling |
|---|---|
| CTA.md lines trip `lint.py`'s "Never write" list | Add an exemption for CTA.md lines (Roadmap stage 1) |
| `lint.py` and `film/qa.py` fail 70 to 90 s lessons, ASMR pace and long films. STANDARDS-v2's "change every 2 to 4 s" clashes with ASMR's slow cuts | Per-format profiles (Roadmap stage 1 for lint, stage 4 for QA) |
| Possibility Lab's `voice-owner/README.md` says never clone; the owner later asked for a clone of his own voice, and the Season 3 film's Part A already defaults to it (`longform/earth-spin/compile.py`, `VOICE=own`) | Allowed for the owner's own voice only, with his recorded consent and an AI label ("Narration: a synthetic version of the owner's own voice (AI)"). His consent is not on record in the repo yet: a TODO until it is. Evelyn's voice is never cloned |
| One 7 to 10 minute recording session against a long video of at least 8:30 | A word target per channel (`wpm` in the identity file). Short parts get real add-on lines, never padding |
| SEASON-FORMAT.md says Reality Rulebook goes first; Possibility Lab reached finals first | The owner decides the posting order |
| Stale items: DECISIONS.md keeps old channel names and "go daily"; `lint.py` rejects `verified_via` "owner opened the page"; SEASON-FORMAT.md names `push-one.sh`, which is on no branch | Fix in Roadmap stage 1. Use `prism-studio/scripts/push-media.mjs` |
