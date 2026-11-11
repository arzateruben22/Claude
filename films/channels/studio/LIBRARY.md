# The permanent production library

What the studio already owns and can reuse, in the directive's ten sections. Every path below exists today. Each
section ends with what is missing and the roadmap stage that adds it ([ROADMAP.md](ROADMAP.md)).

How to read a path:

- `kits/cinema/...` and `films/channels/<file>` are on every branch; the shared rule files are current on `claude/made-with-claude-film`.
- `physics: set/cyc.js` means `films/channels/physics/set/cyc.js` on that channel's branch (`claude/physics-s2`, `claude/space-s2`, `claude/whatif-s2`, `claude/outer-layer-s1-b` for skincare). Read it with `git show origin/<branch>:<path>`.
- Episode folders: `ep01` to `ep06` are Season 1, `ep07` to `ep12` Season 2.

The library is not one folder. The reusable code lives in the kit and in each channel's `set/`; this page is its index.

## 1. Design systems

| Path | What it is |
|---|---|
| `films/channels/studio/identities/<slug>.json` | New: the channel identity in one file ([identities/README.md](identities/README.md)) |
| `<channel>: theme.json` | The look the renderer reads: tokens, roles, fonts, sizes, safe box, label colours, contrast pairs, motif |
| `<channel>: fonts/` | Self-hosted faces with licences and `SOURCES.md` |
| `<channel>: bible.md` | The channel's look, sound, narrator, set and episode template |
| `skincare: theme-ivory.json`, `set/ss3.mjs`, `set/hudv2.js` | The ivory look: card theme for the long video, the composition engine, the overlay rules |
| `kits/cinema/sci/hud.js` | Captions, labels with leaders, badges, counters, scale pill, title and end cards, themed by CSS variables |
| `kits/cinema/film/page.mjs` | Turns a `theme.json` into the page a frame is drawn on |
| `kits/cinema/sci/contrast.py` | Checks every theme's text pairs for WCAG contrast, and that channels' colours stay apart |
| [../STUDIO-STYLE.md](../STUDIO-STYLE.md), [../PACKAGING.md](../PACKAGING.md) ("Channel visual DNA") | The one-page style sheet and each channel's packaging look |

Missing:

- Skin Sense has no theme file for the Season 3 look; its `theme.json` is still the old violet look. Stage 2, after the look gate.
- Nothing checks an identity file against its `theme.json`. Stage 1.
- The bibles are stale in places (old channel names, superseded fonts and hexes). Stage 1 clean-up.

## 2. Character and object references

| Path | What it is |
|---|---|
| `physics: library/` | Owner-made art: `blue-ball-round.webp`, `blue-ball-squashed.webp`, `slinky-hanging-hand.webp`, `splash-crown-a.webp`, `splash-crown-b.webp` |
| `space: library/` | `earth-light-ring-a.webp`, `earth-light-ring-b-icy.webp`, `moon-limb-craters.webp`, `ringed-planet-stylised-blue.webp` |
| `whatif: library/` | `walker-earth-to-moon.webp` (the cover reference), `sideways-room-chair.webp`, `sideways-room-mug.webp`, `speaker-sound-waves.webp` |
| `skincare: library/` | `skin-layers-section-a.webp` |
| `space: long01/art/` | Season 3 Moon paintings and `README.md` (what each is for, and what it may not be used for) |
| `whatif: set/anchor.js` | The blue human-scale figure and car, reused by every episode |
| `physics: set/chair.js`, `set/props.js`, `set/balls.js`, `set/ink.js` | The faceless wooden mannequin, bench props, balls, ink-line illustrations |
| `skincare: set/hand.js` | A smooth model hand grown from metaballs |
| `skincare: set/labmatch.py` | Matches skin colour across an episode's pictures in CIE-LAB (one skin tone per episode) |
| `skincare: set/ref/` | Reference textures with `SOURCES.md` |
| `skincare: epNN/art/index.json` (`set/art_index.py`) | The pictures present in an episode |
| `whatif: bible.md`, "Cover reference" | The figure-on-a-journey cover, in words |

Missing:

- No index across channels: which picture, where it was used, its pixel size, whether it is AI-made. Stage 3 (asset index).
- No reference sheet per recurring figure (proportions, colours, what it never does). Stage 2.
- Skin-tone calibration values live inside episode files (`episode.json` `three.skinHex`), not in one table. Stage 3.

## 3. Environments

| Channel | Path | Environment |
|---|---|---|
| Reality Rulebook | `set/cyc.js` | "The Bench": the ruled warm-paper cyclorama, in centimetres |
| | `set/moon.js` | The Bench's Moon dressing and Apollo 15 props |
| | `lf01/scene.mjs` | Season 3's daylight kitchen (lives in the film's scene, not yet in `set/`) |
| One More Orbit | `set/sky.js`, `set/galaxy.js` | The star sky, the Milky Way and star clouds |
| | `set/planet.js`, `set/star.js`, `set/moon.js`, `set/venus.js`, `set/comets.js` | Planets, the Sun, the Moon, Venus, the Oort cloud |
| | `set/grid.js` | The gravity grid (always under an "analogy" badge) |
| | `long01/art/` | Season 3's painted night beach |
| Possibility Lab | `set/desk.js` | The graph-paper desk every episode stands on |
| | `set/globe.js`, `set/ladder05.js`, `set/crowd.js`, `set/tower.js` | The cut-open planet, the powers-of-ten dive, a crowd from above, a tower and measuring cube |
| | `longform/earth-spin/scene.mjs` | Season 3's graph-paper equator and speeding sky |
| Skin Sense | `set/w3d.js` | The ivory studio (soft environment, warm key, cool rim, soft shadows) |
| | `set/goose3d.js` to `set/print3d.js` | Six Season 2 skin worlds |
| | `set/terrain.js`, `set/section.js`, `set/uvcam.js` | Season 1: macro skin terrain, the cut-face section, the UV camera view |
| | `set/voxel3d.js`, `set/night3d.js`, `set/night.mjs`, `s3-looktest/` | Season 3 look test only (10 s): the voxel take, an earlier night take, and the night overlay. Pending the owner's look gate |
| Kit | `kits/cinema/sci/ladder.js` | Scale rungs with a log dolly and float-safe re-centring |

Missing:

- Season 3 worlds sit inside one film's `scene.mjs`. Lift the reusable parts into `set/` when the film is delivered. Stage 2.
- Skin Sense's Season 3 world: a 10 s look test exists (voxel take: `set/voxel3d.js`, rendered on the `--plain` path with grain 0.02 in `set/w3d.js`, no motion blur). It awaits the owner's look gate. It is not yet a reusable world or a theme file. Stage 2, after the look gate.
- No picture catalogue of environments (one still each). Stage 3.

## 4. Camera presets

| Path | What it is |
|---|---|
| `kits/cinema/keys.js` | Keyed camera with per-key eases, portrait overrides, handheld micro-motion and focus keys |
| `space: set/rig.js` | The telescope mount: locked diagram view, drift, arc, scale jump; never handheld |
| `whatif: set/rig.js` | The same code as One More Orbit's, used as an orbit rig around a target |
| `skincare: set/rig.js`, `set/w3d.js` (`camAt`, `camPose`) | The Season 1 orbit camera; the Season 2 camera spline |
| `physics: epNN/compile.py` (writes `film.json` `cam`) | The locked measure view, drifts and the one turn per episode |
| `kits/cinema/sci/ladder.js` | The log dolly for scale changes |
| `kits/cinema/cinema3d.js` (`window.CINEMA_FOCUS`) | Focus distance and f-stop per frame |

Missing:

- No named preset list that a shot manifest can point at (`camera.preset` in [SHOTS.md](SHOTS.md)). Presets are numbers inside each `compile.py`. Stage 2.
- `rig.js` is copied between channels. One shared rig in the kit. Stage 2.

## 5. Lighting and materials

| Path | What it is |
|---|---|
| `kits/cinema/cinema3d.js` | The finish: motion blur, bokeh depth of field, bloom, ACES and sRGB |
| `skincare: set/studio.js` | `createStudio` (three-point rig and a soft-box environment), `skinMaterial`, `cellMaterial`, `strandMaterial`, `fluidMaterial`, `createShaft` (light shaft), `createGrain` |
| `skincare: set/w3d.js` | The ivory studio lights, 2048 px soft shadows, the channel's own finish (with an optional `grain` amount), tube, glow and texture helpers |
| `skincare: set/prod.js`, `set/look3.js` | The production pass (surface variation, out-of-focus specks), skin, hairs and grain v3 |
| `physics: set/props.js` | The Bench's light rig (soft key, hemisphere fill, cool rim) and lit props |
| `physics: set/aces.js`; `whatif: set/aces.js` | Colours fed through the finish's ACES inverse so they land on theme tokens (`screenAlpha` for overlays) |
| `space: set/look.js`; `whatif: set/look.js` | The same idea for those channels' ground and accent colours |
| `physics: set/straw.js` | Glass and a liquid column without the costly transmission material |
| `kits/cinema/metaballs.js`, `kits/cinema/liquid2d.js` | 3-D liquid that beads and merges; a liquid text morph |

Missing, all stage 2:

- No shared light rigs or material library in the kit: each channel carries its own.
- `aces.js` and `look.js` are copied between channels.
- Reality Rulebook, One More Orbit and Possibility Lab cast no shadows.
- No ambient occlusion pass, and no grain in the kit (Skin Sense's own finish in `set/w3d.js` has a `grain` amount).
- No `.hdr` environments or loader.

What the engine can and cannot do is in [README.md](README.md), "Maximum-fidelity standard".

## 6. Episode templates

| Path | What it is |
|---|---|
| `films/channels/studio/schema/`, `templates/`, `tools/` | New: the episode spec, the shot manifest, starting files and the tools that check them |
| `<channel>: bible.md`, "Episode template" | The beat table for a short (hook, normal, change, why, whoa, takeaway, tease) |
| `kits/cinema/script/lint.py`, `kits/cinema/script/README.md` | The template check and the script format |
| `kits/cinema/script/timeline.py` | Lays out beats, captions and cues from the script and the voice timings |
| `kits/cinema/film/demo/` | A 6 s demo episode that uses every part of the runtime once |
| `physics, space, whatif: epNN/compile.py` | The episode's direction; each new episode starts from the last one's file |
| `skincare: set/build_ep.py`, `set/make_sheet.py`, `set/final.sh`, `epNN/episode.json` | The only data-driven episode build: one generic compile step plus a data file per episode |
| `physics: lf01/build.py`, `lf01/parts.py` | One script compiled into the long film and its eight parts |
| `whatif: longform/earth-spin/compile.py`, `shorts/compile_short.py`, `parts_plan.py` | The same job, Possibility Lab's way |
| `films/channels/voice-scripts/make_recording_script.py` | The four-part recording script for a season |
| [../PACKAGING.md](../PACKAGING.md), `films/channels/packaging-drafts/` | The `packaging.json` shape, and drafts |
| [../SEASON-FORMAT.md](../SEASON-FORMAT.md) | The season template: one long film and eight parts; six premium lessons |

Missing:

- Three channels have no generic compile step; a new episode copies and edits the last `compile.py` (132 to 430 lines in the ep01, ep07 and ep12 files). Stage 3.
- Two different long-film builds (Reality Rulebook's and Possibility Lab's). One shared pattern. Stage 3.
- `lint.py` has no profile for premium lessons, ASMR pace or long films. Stage 1.

## 7. Audio systems

| Path | What it is |
|---|---|
| `kits/cinema/studio/` | The sound studio: `compose.py`, `instruments.py`, `dsp.py`, `duck.py`, `master.py`, `meter.py`, `render.py`, `qa.py`, `review.py` |
| `kits/cinema/studio/vibes/` | Score presets: `restframe-bench.json` (Reality Rulebook), `lightminute-vacuum.json` (One More Orbit), `envelope-working.json` (Possibility Lab), `outerlayer-slide.json` (Skin Sense) |
| `kits/cinema/events.json` | One row per event kind: sound lead, priority, span, motion-blur floor |
| `kits/cinema/voice/tts.py`, `align.py` | The AI voice (one WAV per line) and word timings |
| `kits/cinema/voice/polish.py` | Cleans a real recording and cuts it into lines; styles `normal`, `extra`, `whisper` |
| `films/channels/voice-scripts/` | Recording scripts and their generator |
| `whatif: voice-owner/` | The owner's Season 3 recordings, `README.md`, `cut.py`, `cutS.py` |
| `skincare: voice-evelyn/evelyn-s3-full.m4a` | Evelyn's Season 3 recording |
| `space: season2/gaps.py` | Lists voiceless gaps in the dialogue stem |
| `space: season2/cta_remix.py`; `whatif: cta/remix.py`; `skincare: set/cta_line.py` | Adds the like/follow line to a finished short |
| `space: season2/make_bridges.py`; `skincare: set/long_voice.py` | Voices the long video's opening, bridges and finale |
| `<channel>: auditions/` or `review/narrator-audition.m4a` | Narrator auditions |

Missing:

- No ASMR score preset, and no loudness profile for it. Stage 2 (preset), stage 4 (QA profile).
- The like/follow remix exists in three forks. One shared tool. Stage 3.
- No clone tool on this branch or the channel branches. An earlier toolchain is on `claude/voice-clone` (`kits/cinema/voice/CLONE.md`, with a consent gate) and a new trial is under way: Roadmap 3.10. Any use needs the owner's recorded consent and an AI label.
- `gaps.py` is One More Orbit's only; every channel has the 1.2 s rule. `tools/qa_episode.py` now measures the same gaps on any dialogue stem; retiring the channel copy is Stage 4.2.

## 8. Scientific reference library

| Path | What it is |
|---|---|
| `<channel>: epNN/claims.json` | The claims ledger of each episode: claim, sentence, source, date accessed, how it was verified, status |
| `whatif: epNN/calc.py`; `physics: lf01/calc.py`; `space: long01/calc.py` | Every computed number, with inputs and sources |
| `kits/cinema/script/claims_sheet.py` | Builds `review/CLAIMS-REVIEW.md` for a named reviewer |
| `kits/cinema/script/lint.py --sources` | The post's source list |
| `physics: set/bench.js`, `set/bench_py.py`, `set/swing.js`, `set/spin.js` | Closed-form falls, throws, bounces, the exact pendulum, a spinning body |
| `space: set/orbit.js` | A Kepler orbit with a fixed-step solver |
| `kits/cinema/sci/clock.js`, `front.js`, `strobe.js`, `arrows.js` | Time warp, expanding fronts, strobe ladders, vectors: the honest-measurement blocks |
| `space: theme.json` `motif.facts` | Channel-wide fixed facts (one galactic-centre distance) |
| `films/channels/crosscheck.json`, `films/audits/2026-10-26/` | The early cross-channel check and the fact audit |
| `skincare: set/ref/SOURCES.md` | Sources of the reference textures |

Missing:

- No index of claims across episodes. A source a person opened last season is found again from scratch. Stage 3 (built from every `claims.json`, statuses copied, never upgraded by a tool).
- No shared table of constants; each `calc.py` restates them. Stage 3.
- `lint.py` rejects `verified_via` "owner opened the page". Stage 1.

## 9. Quality assurance

| Path | What it is |
|---|---|
| [QA.md](QA.md) | New: the QA framework and the 100-point internal rubric |
| `films/channels/studio/tools/qa_episode.py` | New: every hard gate for every format on the delivered video (freeze and voiceless gaps included), the files beside it, and the automated rubric points; writes `review/qa-report.json` |
| `films/channels/studio/qa/rubric.json` | New: the hard gates, the thresholds per format and the 100 points, as data |
| `films/channels/studio/tools/validate.py` | New: the plan (`episode.json`, `shots.json`, claims used, human gates) |
| `kits/cinema/film/qa.py` | Delivery gates on the finished mp4: size, picture against sound, length, loudness, true peak, mono safety, flashing, text audit |
| `kits/cinema/film/scorecard.py` | The measured table for `review/scorecard.md` |
| `kits/cinema/studio/qa.py` | Sound sync per event kind |
| `kits/cinema/script/lint.py` | Script gates: template, pace, length, hook, holds, claims |
| `kits/cinema/sci/contrast.py` | Contrast and colour distance of the themes |
| `kits/cinema/film/render.mjs` (`audit.json`, the code hash, chunk checks) | Text outside the safe box, stale-code detection on resume, verified chunks |
| `kits/cinema/film/compilation.mjs` (`qa.json`) | Long-video gates: size, length, loudness, chapters |
| [../STUDIO-STYLE.md](../STUDIO-STYLE.md) | The (a) to (h) gate scored by a reviewer |
| [../briefs/STANDARDS-v2.md](../briefs/STANDARDS-v2.md) | The clarity standard and four review deliverables |
| `<channel>: epNN/review/` | Scene table, claims table, clarity review, scorecard, human review |
| `whatif: declutter.py` | One text element per idea |
| `prism-studio/scripts/check-media.ts` (`npm run media:check`) | Flags a missing 1440 file, cover or captions before posting |

Missing:

- `qa.py` has one profile (60 to 75 s shorts). Premium lessons, ASMR and long films need their own. Stage 4.
- `tools/qa_episode.py` fills in the measured rubric points and measures both frozen picture and voiceless gaps. It is not yet the last step of each channel's final (Stage 4.2).
- Skin Sense writes `review/qa-delivery.json`, so Prism does not see its QA. Stage 1.

## 10. Completed-episode archive

| Path | What it is |
|---|---|
| `<channel>: ep01/` to `ep12/`, `out/` | Delivered episodes: master, YouTube file, cover, packaging, posting text. 12 masters are committed on each of three channels; Skin Sense has 10 (`ep02` and `ep03` have none on its branch) |
| `<channel>: compilations/vol01/`, `compilations/s2/` (Skin Sense: `vol02/`) | Two delivered long videos per channel |
| `<channel>: PRODUCTION.md`, `KIT-CHANGES.md` | The build log and the kit changes, with lessons learned |
| Prism Studio, Library, Archived seasons | Uploaded seasons, read-only |
| `films/library.py` | A download page generator (stale: old channel names, three channels) |
| `skincare: shelved-s1/` | The first Season 1, never posted, kept with its bible |

Missing:

- No archive index and no Episode Intelligence Reports yet. Paths are set in [STRUCTURE.md](STRUCTURE.md), section 9. Report template: stage 1. Index tool: stage 3. Analytics in the reports: stage 5.
- Lessons sit in four `PRODUCTION.md` files in four styles. The reports replace that habit. Stage 5.

## Reusable modules per channel

"Used by" lists the episode folders whose `scene.mjs` imports the module (Skin Sense Season 2: the module named in
`episode.json`). Read from each branch on 11 Nov 2026.

### Kit blocks (`kits/cinema/sci/`), all channels

| Module | What it does | Used by |
|---|---|---|
| `hud.js` | Captions, labels, badges, counters, title and end cards | Reality Rulebook ep01 to ep12 and `lf01`; One More Orbit ep01 to ep12; Possibility Lab ep01 to ep12 and `longform/earth-spin`; Skin Sense ep01 to ep03 |
| `clock.js` | Time warp with speed badges | Reality Rulebook ep01 to ep05; One More Orbit ep01 to ep04, ep06; Possibility Lab ep01 |
| `strobe.js` | Strobe ladders: ghost stamps at equal time steps | Reality Rulebook ep01 to ep07 |
| `arrows.js` | Instanced vectors with label anchors | Reality Rulebook ep01, ep02, ep04, ep06 |
| `front.js` | Expanding fronts, rings of constant pixel width | One More Orbit ep01 to ep12; Possibility Lab ep01, ep02, ep05 |
| `ladder.js` | Scale rungs and a log dolly | One More Orbit ep01, ep02, ep06 |
| `path.js`, `swarm.js`, `cutaway.js` | Flow along a curve, seeded particles, a shell cut by a plane | No active channel's episode scene |

### Reality Rulebook (`films/channels/physics/set/`)

| Module | What it does | Used by |
|---|---|---|
| `cyc.js` | The ruled warm-paper stage | ep01 to ep12 |
| `props.js` | Bench props and the light rig | ep01 to ep12 |
| `aces.js` | Colour bridge through the finish | ep01 to ep12 |
| `title.js` | Title and end card, "the drop" | ep01 to ep12, `lf01` |
| `spine.js` | Where the spine readout sits | ep02 to ep12, `lf01` |
| `readout.js` | Ruler-tick scale readout | ep01 |
| `bench.js`, `bench_py.py` | Closed-form falls, throws and bounces, and their Python ports for `compile.py` | ep01, ep03 |
| `ink.js` | Ink-line illustrations standing in the set | ep03 to ep06 |
| `chair.js`, `spin.js` | Swivel chair with a faceless mannequin; a body whose moment of inertia changes | ep05 (`chair.js` also ep06) |
| `swing.js`, `pendulum.js` | The exact pendulum; a gantry of pendulums | ep02 |
| `balls.js` | Basketball and the stacked drop | ep03 |
| `moon.js` | Moon dressing and Apollo 15 props | ep04 |
| `straw.js` | Glass and a liquid column | ep06 |
| `captions_py.py` | Captions broken at phrases | The compile steps (`lf01/build.py` imports it) |

Season 2 episodes (ep07 to ep12) use only the stage, props, colour bridge, title and spine from `set/`; their subjects
are built inside each `scene.mjs`.

### One More Orbit (`films/channels/space/set/`)

| Module | What it does | Used by |
|---|---|---|
| `look.js` | Colours as the finish needs them | ep01 to ep12 |
| `motif.js` | The light-time ring on title and end cards | ep01 to ep12 |
| `beacon.js` | A light of constant pixel size, for a star or probe at any scale | ep02 to ep12 |
| `planet.js` | A planet with a baked surface, terminator and rim | ep01, ep03 to ep07, ep10 to ep12 |
| `sky.js` | The star sky | ep01 to ep07, ep09 |
| `rig.js` | The telescope mount | ep01 to ep07, ep09 |
| `star.js` | An emissive, limb-darkened star | ep01, ep03, ep05, ep06, ep09 |
| `moon.js` | The Moon's surface, an illustration | ep04, ep05, ep12 |
| `galaxy.js` | The Milky Way and star clouds as points | ep01, ep06, ep07 |
| `venus.js` | Venus's cloud deck | ep03 |
| `comets.js` | The Oort cloud (under a "theory" badge) | ep02 |
| `orbit.js` | Kepler orbits and the free path after gravity is cut | ep01 |
| `grid.js` | The gravity grid | ep01 |
| `capglue.py` | Keeps number phrases on one caption line | The compile steps |
| `season2/pack.py`, `make_cover.py`, `make_posting.py`, `make_long_thumb.py` | `packaging.json`, covers, posting text, the long video's thumbnail | Season 2 |
| `season2/gaps.py`, `cta_remix.py`, `make_bridges.py`, `render_bridges.mjs` | Voiceless gaps, the like/follow remix, the long video's bridges | Season 2 and `compilations/s2/` |

### Possibility Lab (`films/channels/whatif/set/` and the channel root)

| Module | What it does | Used by |
|---|---|---|
| `desk.js` | The graph-paper desk | ep01 to ep12, `longform/earth-spin` |
| `look.js` | Colours as the finish needs them | ep01 to ep12, `longform/earth-spin` |
| `motif.js` | The envelope flap title and the boxed answer | ep01 to ep12, `longform/earth-spin` |
| `anchor.js` | The blue figure and car | ep01 to ep09, ep11, ep12, `longform/earth-spin` |
| `spine.js` | The running sum | ep01 to ep12 |
| `rig.js` | The orbit camera | ep01 to ep12 |
| `aces.js` | Colour bridge through the finish | ep07 to ep12, `longform/earth-spin` |
| `globe.js` | A planet cut in half, with a tunnel | ep01, ep02 |
| `crowd.js` | A crowd seen from above | ep02, ep03 |
| `tower.js` | A tower silhouette and a measuring cube | ep02 |
| `balance.js` | A pan balance and its heaps | ep03 |
| `tape04.js` | Paper sheets on the desk that carry real type | ep04, ep06 |
| `ladder05.js` | The powers-of-ten dive | ep05, ep07 |
| `rain06.js` | Rain and water for the graph-paper world | ep06 |
| `declutter.py` | One text element per idea | Season 2 re-render |
| `covers.py`, `srt.py`, `posting_pack.py`, `cta/remix.py` | Covers, the `.srt`, posting text, the like/follow remix | Season 2 |
| `epNN/calc.py` | Every number in the episode | ep01 to ep12, `longform/*` |
| `epNN/loopfix.sh` | The music tail for the loop | ep07 to ep12 |

### Skin Sense (`films/channels/skincare/set/`)

| Module | What it does | Used by |
|---|---|---|
| `ss3.mjs` | The ivory composition engine: headline, pills with leaders, camera moves on a painting, plates and charts, word-lit captions, end card | ep04 to ep12 |
| `w3d.js` | The shared 3-D base: ivory studio, soft shadows, own finish, camera spline, helpers | ep08 to ep12, through the scenes below |
| `goose3d.js` | Goosebumps: a field of hairs and what lies under it | ep07 |
| `finger3d.js` | Fingers wrinkling in water | ep08 |
| `sweat3d.js` | The sweat gland and its duct | ep09 |
| `tan3d.js` | A skin cell making its pigment cap | ep10 |
| `brick3d.js` | The skin barrier as a brick wall | ep11 |
| `print3d.js` | Fingerprint ridges growing | ep12 |
| `studio.js`, `prod.js`, `look3.js`, `hudv2.js` | The look-development library (lights, skin and tissue materials, light shaft, grain), the production pass, look v3, overlay rules | ep01 to ep03 |
| `terrain.js`, `section.js`, `uvcam.js`, `rig.js`, `motif.js` | Season 1's macro terrain, cut-face section, UV camera view, orbit camera, gauge and cards | ep01 to ep03 (some also in the old 3-D cuts kept in `ep04/old-3d` to `ep06/old-3d`) |
| `build_ep.py`, `make_sheet.py`, `final.sh` | The generic compile step, the sound cue sheet, the final render and QA in one command | ep04 to ep12 |
| `tables.py`, `covers.mjs`, `cta_line.py`, `pack_fix.py` | Scene table, covers, the like/follow line, the posting-pack fix | Season 2 |
| `labmatch.py`, `art_index.py`, `gen_art.py` | Skin-tone match, the art index, labelled placeholder art | Season 2 |
| `long_voice.py` | Narration for the long video's cards | `compilations/vol02/` |

### The same code in more than one channel

These are the first candidates to move into the kit (Roadmap stage 2 for scene code, stage 3 for tools):

| Code | Copies |
|---|---|
| The colour bridge through ACES | `physics: set/aces.js`, `whatif: set/aces.js` (unchanged copy); `space: set/look.js`, `whatif: set/look.js` (copy with another ground colour) |
| The orbit camera | `space: set/rig.js`, `whatif: set/rig.js` (unchanged copy); Skin Sense has its own `set/rig.js` |
| Caption glue | `space: set/capglue.py`, `skincare: set/capglue.py` |
| Covers | `whatif: covers.py`, `space: season2/make_cover.py`, `skincare: set/covers.mjs` |
| Posting text | `whatif: posting_pack.py`, `space: season2/make_posting.py`, `skincare: set/pack_fix.py`, `prism-studio/scripts/posting-pack.ts` |
| The like/follow remix | `whatif: cta/remix.py`, `space: season2/cta_remix.py`, `skincare: set/cta_line.py` |
| Long-video cards and joins | Five versions of `kits/cinema/film/compilation.mjs`: one on each channel branch and one on the shared branch |
