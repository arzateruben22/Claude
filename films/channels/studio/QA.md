# Quality assurance

How an episode is checked before the owner sees it, and again before it is exported. Three things to know first:

- **The score is an internal assessment.** The 100 points are the studio's own check of its own work. They are not
  proof of quality, never a public number, and never a prediction of views.
- **Hard gates come first.** A failed hard gate blocks release whatever the score. A score of 99 with one failed
  gate is a blocked episode.
- **Fix the shot, not the episode.** Every failure names the shot or the stage that caused it (section 6).

Machine-readable copy of everything below: [qa/rubric.json](qa/rubric.json). The tool that applies it:
[tools/qa_episode.py](tools/qa_episode.py).

## 1. The three layers

| Layer | What it is | Where it is written | Who decides |
|---|---|---|---|
| Hard gates | 26 pass-or-fail rules. 12 are measured from the delivered file, 8 are read from files beside it, 6 are recorded by people | `hardGates` in [qa/rubric.json](qa/rubric.json); section 3 | Tool, builder, coordinator, owner |
| The (a) to (h) gate | The reviewer's eight scores, 1 to 5, on every episode. It stays binding, and is one of the hard gates | [../STUDIO-STYLE.md](../STUDIO-STYLE.md), "Quality gate" | Reviewer (the coordinator) |
| The 100-point rubric | 42 criteria in ten categories. 30 points are scored by the tool, 70 by people. Target: 95 | `categories` in [qa/rubric.json](qa/rubric.json); section 4 | Tool, builder, coordinator, owner |

Release needs both: every hard gate passed, and 95 points or more. Neither replaces the other. The rubric is layered
over the (a) to (h) gate, not in place of it: each of the eight axes maps to one rubric criterion (`gateAxes` in the
rubric file).

## 2. Running QA

Stage 10 of the pipeline ([README.md](README.md)). Run on the channel's own branch, from the repo root.

```
E=films/channels/<slug>/epNN
python3 -I kits/cinema/film/qa.py $E                      # 60 to 75 s shorts only: writes $E/build/qa-delivery.json
python3 -I kits/cinema/film/scorecard.py $E               # the measured table for $E/review/scorecard.md
python3 -I films/channels/studio/tools/validate.py $E     # the plan: episode.json and shots.json

# every format: hard gates and the automated rubric points
python3 -I films/channels/studio/tools/qa_episode.py $E/out/<name>-9x16.mp4 \
    --episode $E/episode.json --out $E/review/qa-report.json

# once per episode: the form people fill in. Then score, and check for release
python3 -I films/channels/studio/tools/qa_episode.py --blank-scores > $E/review/rubric-scores.json
python3 -I films/channels/studio/tools/qa_episode.py $E/out/<name>-9x16.mp4 --episode $E/episode.json \
    --scores $E/review/rubric-scores.json --release --out $E/review/qa-report.json
```

A long video: `qa_episode.py <channel>/compilations/<name>/<name>-16x9.mp4 --kind long --episode <working folder>/episode.json`.
Add `--cards` when it is joined from finished episodes with narrated still cards (the Season 2 format, and Skin
Sense Season 3's long video).

`qa_episode.py` exits 1 when a hard gate fails, 2 when a file cannot be read, else 0. With `--release` it exits 1
unless every hard gate has passed, the people's gates included. `--file-only` measures the file and reads nothing
else. Run time, measured 11 Nov 2026 on the shared 4-core machine while other jobs ran: about 10 s for a 68 s short,
about 80 to 95 s for an 8:37 long video at 2560x1440. The time is the picture decode.

What each existing tool covers:

| Tool | Command | Covers | Formats |
|---|---|---|---|
| `kits/cinema/script/lint.py` | `python3 -I kits/cinema/script/lint.py $E --segment <name>` | Script: template, pace, length, hook by 2.0 s, holds, claim tags, reading grade | 60 to 75 s shorts. No profile for premium lessons, ASMR pace or long films (Roadmap stage 1) |
| `kits/cinema/sci/contrast.py` | `python3 -I kits/cinema/sci/contrast.py <slug>` | Theme contrast (4.5:1) and colour distance | All |
| `kits/cinema/film/render.mjs` | writes `build/<tier>/<aspect>/audit.json` | Text outside the safe box or overlapping | The kit page. Skin Sense's plain path writes no text audit |
| `kits/cinema/studio/qa.py` | runs inside `kits/cinema/studio/render.py`; writes `build/audio/qa.json` | Sound on its picture event, voice over music, phone speaker | All |
| `kits/cinema/film/qa.py` | above | Size, picture against sound, length, loudness, true peak, mono, flashing, text audit | 60 to 75 s shorts only |
| `kits/cinema/film/scorecard.py` | above | The measured table, with render cost from the log | Shorts |
| `kits/cinema/film/compilation.mjs` | writes `compilations/<name>/qa.json` | Long video joined from episodes: size, length 5 to 11 min, loudness, peak, chapters | Joined long videos |
| [tools/validate.py](tools/validate.py) | above | The plan: schemas, windows, claims used, transitions, the like/follow moment, human gates | All |
| [tools/qa_episode.py](tools/qa_episode.py) | above | Every file gate for every format, the files beside the video, the automated rubric points | All |
| Channel gates | One More Orbit `season2/gaps.py`; Possibility Lab `declutter.py`, `calc.py` and its compelling pass; Skin Sense `set/labmatch.py` | Voiceless gaps; one text element per idea; every number recomputed; skin-tone match | That channel |
| `prism-studio` | `npm run media:check` | A missing 1440 file, cover or captions before posting | Imported episodes |

Checks by hand, when a draft needs a quick look:

```
ffmpeg -i draft.mp4 -vf freezedetect=n=-60dB:d=1.4 -an -f null - 2>&1 | grep freeze        # frozen picture
ffmpeg -i build/audio/stems/dialog.wav -af silencedetect=n=-42dB:d=1.0 -f null - 2>&1 | grep silence_end   # voice gaps
ffmpeg -i final.mp4 -map 0:a:0 -af ebur128=peak=true:framelog=verbose -f null - 2>&1 | tail -12             # loudness, true peak
ffmpeg -ss 12.5 -i final.mp4 -frames:v 1 grab-12.5.png                                    # one frame, full size
ffmpeg -ss 12 -i final.mp4 -frames:v 30 step-%02d.png                                     # 30 consecutive frames
```

## 3. Hard gates

`fail` blocks. `waiting` means a person has not done their part yet. `not checked` means the tool found nothing to
read; a person may then record the result in the scores file. A person can settle a `not checked` or a listed
(`review`) result. A person cannot overrule a measured fail.

### A. Measured from the delivered file (tool signs off)

| Gate | Passes when | Threshold from | If it fails |
|---|---|---|---|
| `size` | 1080x1920 (short, premium, part); 2560x1440 (long). A file named `-youtube.mp4` may be 1440x2560, and is always called an upscale | `kits/cinema/film/qa.py`, `compilation.mjs`, `youtube1440.py` | Assemble from the right tier. Never scale a master to pass |
| `fps` | 30 fps, constant | `kits/cinema/film/scorecard.py` (format target), `render.mjs` | Assemble again with `render.mjs --assemble` |
| `length` | short 60 to 75.5 s; part 61 to 75.5 s; premium 60 to 90.5 s (aim 70 to 90); long 8:30 to 11:00 (aim 8:30 to 9:30) | `qa.py`; [../SEASON-FORMAT.md](../SEASON-FORMAT.md); `compilation.mjs` | Too short: add real, fact-checked content. Never a longer hold or a slower voice. Too long: cut a decorative line |
| `loudness` | -15 to -13 LUFS (9:16); -15.5 to -12.5 LUFS (long), on the delivered AAC | `qa.py`; `compilation.mjs` | Re-master the sound, assemble again. No re-render |
| `true_peak` | At most -1 dBTP | `qa.py`, `compilation.mjs` | Re-master with a lower ceiling |
| `av_length` | Picture and sound within one frame (9:16), within 0.1 s (long) | `qa.py`; `compilation.mjs` | Assemble again; trim the music tail in the cue sheet |
| `mono_safe` | Correlation at least 0.3 and at most 3 dB lost in mono. 9:16 only; measured but not gated on a long video | `qa.py` | Narrow the stem that cancels, re-master |
| `flashes` | At most 3 flashes in any second | `qa.py` (WCAG 2.3.1 general flash) | Soften that one transition; re-render its chunk |
| `silence` | No stretch of 1.2 s or more below -40 dB in the mix | The 1.2 s rule in [../CTA.md](../CTA.md); -40 dB is the tool's setting | Carry the gap with room tone, score or picture-led sound; re-master |
| `freeze` | No frozen stretch of 1.4 s or more, except the end card (a hold that reaches the last 3 s and is at most 8 s) | Standing gate; channels ran `freezedetect` on drafts. The end-card allowance is the tool's setting | Give the shot a motivated move or a developing picture; re-render its chunk |
| `first_frame` | 9:16: frame 0 is composed, not blank or black. Long: a fade-in with at most 0.5 s of blank picture | The `cinema-kit` skill ("frame 0 is already composed"); the long allowance is the tool's setting | Start the first shot on its picture; re-render chunk 0 |
| `file_size` | At most 95 MB | `compilation.mjs` (GitHub refuses 100 MB) | Assemble at the capped rate |

### B. Read from files beside the video

| Gate | Passes when | File read | Signs off | If it fails |
|---|---|---|---|---|
| `voice_gaps` | No voiceless gap over 1.2 s (plus one frame) before the end card. On a long film each longer gap is listed for a person | `build/audio/stems/dialog.wav` (Skin Sense: `audio/stems/dialog.wav`), or `--dialog` | Tool; coordinator on a long film | Close the gap in the voice layout or add a fact-checked line |
| `text_audit` | 0 text-audit warnings | `build/qa-delivery.json`, else `build/final/*/audit.json` | Tool; builder by frame grabs where no audit exists | Move or shorten the one label |
| `sound_sync` | Every transient within one frame of its picture event | `build/audio/qa.json` (Skin Sense: `audio/qa.json`) | Tool | Fix the cue's time in the event table |
| `claims_honest` | No claim is marked `ok` unless a person opened its source | `claims.json` | Tool | Set it back to open |
| `chapters` (long) | First chapter at 0:00, in order, each at least 10 s, one title each. Starts come from the build's segment starts, never typed. Each line equals one part's title | `chapters.txt` beside the video | Tool for the timings; builder for the titles | Regenerate from the build; fix a title in the part |
| `sources_opened` | Every claim is `ok`, by a person who opened the page | `claims.json` | Owner or a reviewer | Open the links. Reword or cut what fails |
| `look_gate` | `status.lookGate` is `approved` | `episode.json` | Owner | Send stills; change only what the owner names |
| `packaging` | Five titles, three thumbnails, three pairings, a winner, every check true | `out/packaging.json` (long: `packaging.json` beside the video) | Builder; the owner chooses the title | Revise the pairing whose check is false ([../PACKAGING.md](../PACKAGING.md)) |

### C. Recorded by people (in `review/rubric-scores.json`)

| Gate | Passes when | Signs off | Evidence |
|---|---|---|---|
| `gate_a_h` | Nothing under 3; (a), (g), (h) at 4 or more; nothing factual or ethical open | Coordinator, as reviewer | [../STUDIO-STYLE.md](../STUDIO-STYLE.md); the four review files in [../briefs/STANDARDS-v2.md](../briefs/STANDARDS-v2.md) |
| `text_blocks` | At most two text blocks at once, besides the series line, badges and disclaimers | Coordinator | Frame grabs at every label change |
| `captions_sync` | Captions are built from the measured words of the delivered voice; three spot checks agree | Builder | `vo/words.json`, `film.json` captions, three grabs |
| `truth_labels` | Nothing presented as a photo; AI voice and AI art disclosed; hypotheses and idealisations labelled; title and thumbnail claim no more than the script | Coordinator | [../PACKAGING.md](../PACKAGING.md) truth rules; [README.md](README.md) "Never claim" |
| `channel_rules` | Every `rules` and `never` line in the channel's identity file holds | Coordinator | [identities/](identities/) |
| `owner_approval` | The owner has seen it and said it can be posted | Owner | The owner's own words, with the date |

Standing rules that these gates carry, so none is lost: no voiceless gap over 1.2 s; no freeze over about 1.4 s
except the end card; no more than 3 flashes a second; at most two text blocks; captions synced to the voice; long
videos at least 8:30; chapters computed from segment starts; every packaging check true; claims stay OPEN until a
person opens the source.

### What two delivered videos taught the tool

Both are finished and approved. Measured 11 Nov 2026 with `qa_episode.py`; frames and sound were then inspected.

| Measure | Skin Sense ep12 (short) | Skin Sense Season 2 long video |
|---|---|---|
| Size, rate, length | 1080x1920, 30 fps, 68.467 s | 2560x1440, 30 fps, 517.533 s (8:37.5) |
| Loudness, true peak | -14.1 LUFS, -1.9 dBTP (the kit's own record: the same) | -14.3 LUFS, -1.2 dBTP |
| Picture against sound | 0.000 s apart | 0.042 s apart |
| Mono | Correlation 0.91, loss 0.1 dB | Correlation 0.91, loss 0.1 dB |
| Silence in the mix | None | None |
| Flashes | Worst 1 in a second, transitions at frames 1 and 1098 (the kit's own record: the same) | Worst 2 in a second |
| Frozen picture | One hold, 63.2 s to the end: the end card, 5.23 s | 14 stretches, 131.5 s in all, besides a 7.2 s end card. Frame grabs at ten points showed still cards each time: the opening, an episode's own end card, a bridge, the finale. Their narration is in `compilations/vol02/voice/` |
| First frame | Composed | One black frame, then a fade-in |
| Voiceless gaps (stem) | Longest 1.21 s | No stem available |

Four rules were set from this, and are the tool's own settings, not the owner's:

1. **The end card.** "Ignore the last 3 s" would have failed ep12: its end card holds 5.2 s, with the like/follow
   line spoken over it. A hold that reaches the last 3 s is the end card, up to 8 s (the longest card
   `compilation.mjs` draws).
2. **Cards in a joined long video.** The Season 2 long videos carry a still opening, bridges and a finale with
   narration over them. `--cards` lists each frozen stretch for a person to confirm instead of failing. Without it a
   long video is held to the same rule as a short: Season 3 films have no cards ([../SEASON-FORMAT.md](../SEASON-FORMAT.md)).
3. **A fade-in on a long video.** The long video opens on one black frame. A long video may fade in; a 9:16 file
   may not, because its cover is a frame of the video.
4. **One frame of tolerance on voice gaps.** ep12's longest gap reads 1.211 s at -42 dB, 1.214 s at -40 dB and
   1.245 s at -35 dB. The edge moves with the threshold, so the limit is 1.2 s plus one frame.

## 4. Acceptance criteria by category

Points are whole numbers. "Auto" criteria are scored by `qa_episode.py`: all checks pass, full points; any fails,
zero; nothing to read, not scored and listed for a person. Reviewers are agents or the owner. Agents cannot hear
and cannot watch at speed, so they judge frames and files, and the owner judges sound and feel.

### Scientific accuracy (15)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| SA1 | 3 | Every claim has its sentence, source link and title, access date, how it was verified and a status; none needs rewording | Auto: `claims.json` (the same fields `kits/cinema/script/lint.py` requires) | Tool |
| SA2 | 4 | A person has opened every source; every claim is `ok`; none rests on a search excerpt | `claims.json`; `review/claims-table.md`, column "what the source actually says" | Owner |
| SA3 | 3 | Every number heard matches the screen, the source and `calc.py`; hedges go exactly as far as the source | `script.md` against `claims.json` and `calc.json`; a grab of each figure | Coordinator |
| SA4 | 3 | Each shot shows its principle truthfully: scale and direction right, idealisations badged, thought experiments labelled | `shots.json` `principle` against a grab of each shot | Coordinator |
| SA5 | 2 | The hook, title and thumbnail promise no more than the script proves | `packaging.json` winner against `script.md` | Coordinator |

Correction: a wrong or unsupported line is reworded or cut in `script.md` and `claims.json`. Only that line is
re-voiced and only its shots are rebuilt. A wrong picture is fixed in its shot. An expert sign-off that is still
missing is listed as a TODO in the handoff, never marked done.

### Visual fidelity (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| VF1 | 2 | The format's size, 30 fps constant, H.264 yuv420p, AAC | Auto: `size`, `fps`, `codec` | Tool |
| VF2 | 2 | 0 text-audit warnings | Auto: `text_audit` | Tool |
| VF3 | 3 | Grabs at the key moments are clean: no banding, jagged edges, clipped highlights, z-fighting or popping; captions hold 4.5:1 | Full-size grabs at the hook, each scale change, the payoff and the end; `kits/cinema/sci/contrast.py` | Coordinator |
| VF4 | 2 | No default 3-D render, template or stock look: axis (h) | The contact sheet | Coordinator |
| VF5 | 1 | Every technique, size and number in the notes and in `shots.json` was really used and is labelled honestly | `shots.json`, the render log, [README.md](README.md) "Never claim" | Builder |

Correction: fix the material, light or label in the one shot and re-render its chunks. A banding ground (One More
Orbit's indigo) is fixed in the scene, not by a filter on the master.

### Temporal stability (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| TS1 | 3 | At most 3 flashes in any second | Auto: `flashes` | Tool |
| TS2 | 3 | No frozen stretch of 1.4 s or more, except the end card | Auto: `freeze` (a person confirms cards with `--cards`) | Tool; coordinator for cards |
| TS3 | 1 | Frame 0 is composed | Auto: `first_frame` | Tool |
| TS4 | 3 | No flicker, shimmer, popping or jitter from frame to frame | 30 consecutive frames stepped across every cut and at three other points | Coordinator |

Correction: the report names the frames. Fix the one transition or element (for example a readout that flickers
between two values) and re-render the chunks that hold it.

### Style consistency (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| SC1 | 3 | Palette and type are the channel's own; the season look matches the approved still | Grabs against [identities/](identities/) and the approved still | Coordinator |
| SC2 | 2 | The owner approved the look before the full render | `episode.json` `status.lookGate`, and where the approval was given | Owner |
| SC3 | 2 | The signature devices are present; light and materials stay the same from shot to shot | The contact sheet against `identity.signatureDevices` | Coordinator |
| SC4 | 2 | At most two text blocks at once; one idea on screen | Grabs at every label change | Coordinator |
| SC5 | 1 | Nothing borrowed from another channel's or client's identity | The theme tokens and fonts the scene uses | Builder |

Correction: a colour or font that drifted is fixed at its source (`theme.json`, the `set/` module), then the shots
that show it are re-rendered. If the identity file and `theme.json` disagree, fix the identity file in the same change.

### Spatial continuity (8)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| SP1 | 2 | Shot windows run in order with no gap or overlap; every join is named the same from both sides | Auto: `plan_valid` ([tools/validate.py](tools/validate.py)) | Tool |
| SP2 | 3 | Each shot starts where the last one ended; scale jumps are bridged; the viewer always knows where they are | The last frame of each shot beside the first frame of the next ([SHOTS.md](SHOTS.md), continuity rules) | Coordinator |
| SP3 | 3 | Composed for its own aspect; the subject and all text inside the safe area | Grabs with the safe box drawn (`theme.json` safe box) | Coordinator |

Correction: fix the `startState` of the later shot to match, re-key its first camera key, re-render from that shot's
first chunk to the next cut.

### Cinematography (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| CI1 | 4 | Every camera move has a reason: axis (d) | `shots.json` `camera` and `purpose` against the frames | Coordinator |
| CI2 | 3 | The picture moves with the sentence: axis (c). A meaningful change every 2 to 4 s; slower, never frozen, for ASMR lessons | `review/scene-table.md` against the frames | Coordinator |
| CI3 | 3 | Focus sits on what the line names; one focal point; the last frame works as a poster | Grabs at each focus change and the last frame | Coordinator |

Correction: re-key the one shot. Check the new keys on the draft tier (540x960) first; never tune motion in a final.

### Narration clarity (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| NC1 | 3 | The lint passes for the format: grade 8 or lower per beat, no sentence over 22 words, pace and length in range | `kits/cinema/script/lint.py`; `review/clarity-review.md` | Builder |
| NC2 | 2 | No stretch of 1.2 s or more below -40 dB in the mix | Auto: `silence` | Tool |
| NC3 | 3 | Understood on the first listen: one idea per sentence, terms explained at once, about four spoken numbers: axis (e) | `script.md` read once; `review/clarity-review.md` | Coordinator |
| NC4 | 2 | Captions follow the delivered voice word for word and in time, with the channel's required lines | Captions built from `vo/words.json`; three spot checks | Builder |

Correction: rewrite the one line, re-voice it (or list it for the owner's next recording), run `align.py`, rebuild
the captions. If its length changes, every later shot moves: see section 6.

### Viewer engagement (10)

This is craft, not a forecast. No criterion predicts views.

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| VE1 | 3 | By 2.0 s a question is spoken and the picture already shows the subject: axis (a) | Frames 0 to 60; `vo/words.json` | Coordinator |
| VE2 | 2 | One thread from hook to payoff, open loops, a steady rhythm: axes (b), (f) | `script.md` beats | Coordinator |
| VE3 | 2 | The ending delivers the promised answer: axis (g). The like/follow line comes after the payoff, never in the first 20 s | The last shot; [../CTA.md](../CTA.md) | Coordinator |
| VE4 | 1 | The length lands inside the format's target window | Auto: `length_target` | Tool |
| VE5 | 2 | Packaging complete, every check true | Auto: `packaging` | Tool |

Correction: a weak hook or ending is a script and first-shot or last-shot fix, made before the final. After a final,
re-render only the first or last chunks.

### Audio quality (10)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| AQ1 | 3 | Loudness in the window; true peak at most -1 dBTP | Auto: `loudness`, `true_peak` | Tool |
| AQ2 | 2 | Mono-safe; picture and sound the same length | Auto: `mono_safe`, `av_length` | Tool |
| AQ3 | 2 | Every sound on its picture event; the voice at least 10 LU over the music | Auto: `sound_sync`, `voice_over_music` (the studio's `qa.json`) | Tool |
| AQ4 | 3 | On a phone speaker and on headphones the voice is clear, nothing rings or clicks, and the channel's sound rules hold | The owner's listen | Owner only |

Correction: sound fixes never re-render the picture. Change the cue sheet or the preset, run
`kits/cinema/studio/render.py`, then `render.mjs --assemble --audio`.

### Reusability (7)

| ID | Pts | Passes when | Inspected with | Signs off |
|---|---|---|---|---|
| RU1 | 2 | Files are named and placed as [STRUCTURE.md](STRUCTURE.md) says | Auto: `names` | Tool |
| RU2 | 2 | New scene code that will be needed again lives in the channel's `set/`, and [LIBRARY.md](LIBRARY.md) lists it | The commit's file list | Builder |
| RU3 | 2 | The Episode Intelligence Report is written, measured facts apart from hypotheses | `review/intelligence-report.md` ([reports/README.md](reports/README.md)) | Builder |
| RU4 | 1 | The build can be repeated from the folder: commands recorded, the render log shows verified chunks | The report's command list; the render log | Builder |

Correction: move the module, add the library row, write the report. None of these touch the film.

## 5. Recording the score

1. `qa_episode.py --blank-scores` prints the form: every criterion a person scores, and the six people's gates.
   Save it as `review/rubric-scores.json` in the episode folder (`review/` never reaches Prism).
2. Each scorer fills in `points`, `by`, `date` and a one-line `note` naming the evidence. Leave `null` what nobody
   has judged. No evidence means 0, not a guess.
3. Run `qa_episode.py ... --scores review/rubric-scores.json`. The report adds the people's points to the automated
   ones. It gives a total only when every criterion is scored; until then it shows how many points are still open.
4. The pass mark is 95. Write the score in `review/` and in the Episode Intelligence Report only. Never in a post,
   a description or a thumbnail.

What the score is not: it is not the owner's approval, it does not show that viewers will like the film, and it is
not comparable across channels. Platform numbers go in the "Measured" half of the report, apart from it.

## 6. Correction: fix the shot, not the episode

| What failed | Redo | Keep | How |
|---|---|---|---|
| A sound gate: loudness, peak, mono, silence, sync | The mix | Every rendered frame | `kits/cinema/studio/render.py`, then `render.mjs --film $E --tier final --assemble --audio <mix>` |
| One shot's picture: a flash, a freeze, a label, a look note | The 10 s chunks that hold the shot | Every other chunk | `render.mjs --film $E --tier final --from A --to B --fresh --force-mixed`, then `--assemble --audio <mix> --force-mixed` |
| The title card or end card text only | The first and last seconds | The middle, bit for bit, and the sound | `kits/cinema/film/splice.py` (9:16 masters) |
| A line of narration, same length | That line's voice, its captions, its chunks | The rest | Re-voice the line, `align.py`, the compile step, then as "one shot's picture" |
| A line of narration, new length | Everything after the line | Everything before it only if the film's length is unchanged | If `dur` changes the renderer refuses to mix: render the whole film fresh |
| Packaging | `packaging.json`, the cover | The film | [../PACKAGING.md](../PACKAGING.md) |
| An episode inside a joined long video | The episode, then the join | The other episodes | Rebuild the join with the channel's long-video script |

Rules for a partial re-render:

- `--force-mixed` tells the renderer to accept chunks made by two versions of the code. It records the mix in
  `manifest.json`. Use it only when the change cannot touch a frame outside the range. Nothing proves that today:
  the kit renderer has no frame-signature diff (Roadmap stage 3). If in doubt, render the film fresh.
- The range is widened to whole chunks, so one shot costs 10 to 20 s of film.
- Skin Sense's `episode.json`, `print3d.js`, `w3d.js` and art sit outside the renderer's code hash. After touching
  them, render fresh.
- After any fix, run `qa_episode.py` again and replace the report. Count the re-render in the Episode Intelligence
  Report.

## 7. Limits of this QA

- **Voiceless gaps cannot be measured from the mp4.** Music fills them. The gate needs the dialogue stem.
- **Tested on two videos**, both Skin Sense. Expect a threshold to need tuning on the first One More Orbit file
  (dark frames) and the first ASMR lesson.
- **The flash check runs at half the kit's grid** (108x192 against 216x384) to stay fast. On ep12 it gave the same
  transitions as `kits/cinema/film/qa.py`, with the changed area within 0.7% of the frame.
- **Mono loss is read to 0.1 dB** (ffmpeg's loudness summary); the kit reads 0.01 dB.
- **`kits/cinema/film/qa.py` still fails a 70 to 90 s lesson on length**, and Prism shows that file's `fails`.
  Until the kit has per-format profiles (Roadmap stage 4), `qa_episode.py` is the gate for premium lessons and
  long films.
- **No tool sees banding, jagged edges or flicker.** Those are the coordinator's frame checks.
- **Open questions for the owner**, listed in [ROADMAP.md](ROADMAP.md): whether the 1.2 s voice-gap rule applies to
  ASMR lessons and to picture-only beats in a long film; whether ASMR lessons deliver at -14 LUFS (today's gate) or
  near the look test's -16.
