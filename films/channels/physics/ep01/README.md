# Rest Frame No. 001, "Thrown or dropped?"

Episode 1 of Rest Frame, the physics channel (films/channels/physics). It is 74.9 s long, 9:16, and
narrated by af_bella at speed 1.0 (a synthetic voice, labelled as AI). It is built end to end on the
studio's brand-neutral pipeline: kits/cinema/voice, script, studio, film and sci. **The final is
delivered** (24 Oct). **Nothing has been posted.** A physicist signs off the script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish, −14.1 LUFS / −2.0 dBTP; QA PASS) | `out/rest-frame-001-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Preview (draft tier: 540×960, 15 fps, finish with K ≤ 6; the final mix as AAC 44.1 kHz 192k) | `review/preview-ep01.mp4` (poster `review/preview-ep01.jpg`) |
| Ten final-tier stills (1080×1920, full finish) | `review/stills-ep01.jpg`; the PNGs are in `build/stills/final/9x16/frames/` |
| Soundtrack | `build/audio/mix.wav`, `mix.m4a`, `qa.json`, `spectrogram.png` |


## v3.1 (26 Oct): the reviewer's polish notes, before the final

The text audit checks text against text, so label, badge and caption plates could still touch. A plate sweep (every label, badge and caption plate, leader and dot, every 0.1 s, and every frame around each fix) found the reviewer's four and four more; seven are fixed, and nothing now touches:

- "1/20 s apart" sits beside its gap (`v: middle`), 25 px under the speed badge (it tucked 18–27 px under it, 7.6–14.1 s). "thrown · 0.44 m/s" likewise (it touched the speed badge as the throw left the rail, 14.6–15.2 s).
- "level" names row 5, not row 4: 80 px under "3 throws overlaid" (it sat ~5 px under it).
- "steady glide" leaves on "both" and "gravity" on "tick", each gone (fade included) before the turn carries its arrow tip and dot under the caption plate. "same height" is gone before the whoa cut: fading across it, it jumped to the new camera's projection of a rung no longer drawn, its dot in the caption plate.
- The speed badge's last exit (the measure cut) fades in 0.15 s, not hud.js's 0.3 s (`CUE.measure.warpOut`, applied in `scene.mjs`): hud.js slides "3 throws overlaid" up as the leaving note fades, and over 0.3 s the plates overlapped (51.4 s). Kit finding 6 below.
- Left as is: the "Air ignored" card comes within 6–11 px of the "1 m" label for 0.1 s as it slides in (61.3 s); they never touch, and it settles 13 px clear.
- The end card's footnote keeps the book's title on one line ("Two New Sciences" joined with no-break spaces): "Two motions at once: Galileo, / Two New Sciences, 1638".
- c14's claim no longer names the internal script or reads as NASA's computation; `review/CLAIMS-REVIEW.md` and `out/POSTING.md` / `posting.json` are regenerated. `assets.md` gives the voice speed as 1.0.
- Three label pans moved, so the soundtrack was re-rendered: sync PASS on every kind, labels 0.0 ms against the page, −14.1 LUFS AAC. No word, voice line or event time changed.

## v3 (26 Oct): an independent audit's fixes

Applied from the script audit (`F1`–`F8`; F4 and F9 were refuted and left alone). **The final in `out/` is the v2 cut until it is re-rendered from these files**; everything up to it (voice, lint, film.json, sheet.json, soundtrack, stills) is rebuilt.

- **F1 (confirmed):** the takeaway's "That holds even for a bullet fired level" broke the bible's no-firearms rule (§9) and was true only without air. It is now "In air, the throws land a sliver after the drop" (c14, rewritten: drag delays the throws 0.04 / 0.15 / 0.30 ms behind the drop, NASA Glenn drag equation).
- **F2 (confirmed):** the air badge names its reference: "With air, the fastest throw lands 0.3 ms after the drop. One frame here is 1.7 ms." (Drag slows the drop too, by 1.54 ms, so the 0.3 ms is against the dropped ball.) The card is drawn at its widest (`maxW: 1.0`, 760 px), so the longer text keeps two lines and clears the "1 m" label.
- **F3 (confirmed):** the measure heading counts "the nine gaps between the dropped ball's ten ghosts" (it said nine rungs; the build already counted gaps).
- **F5 (confirmed):** "Speed decides where a ball lands" is now "Sideways speed decides where it lands" (c10).
- **F6–F8 (style):** "Throw twice as hard" is now "twice as fast" (c6); the end card carries its true-fact footnote, "Two motions at once: Galileo, Two New Sciences, 1638" (c4), styled as episodes 2–4 and faded in on the card's landing so it never sits on the last caption; the script preamble and notes no longer mention a "sixteen thirty-eight" that is never spoken.
- **Re-voiced** at af_bella 1.0: vo05 and vo07 changed (vo07 is 0.81 s longer); the other six WAVs are byte-identical. To keep 74.93 s, four lead-ins changed: normal 0.15 → 0.08, why 0.25 → 0.18, whoa 0.15 (new), takeaway 0.25 (new). The windows in the headings follow the new layout.
- **Found while checking, fixed:** the dense audit (`qa/audit.mjs`, every 0.1 s) caught "1500s drawing" sitting on "steady glide" for 0.4 s as the glide label fell into it (already in v2, at 32.6 s). The drawing's label now leaves on "plus a fall"; the dots stay until "Gravity".

## v2 (24 Oct): new narration and notes

The script was rewritten to the studio story standard (`kits/cinema/script/WRITING.md`; an independent review's fixes applied), re-voiced, and the direction re-pointed to the new words. The HUD notes are the redesigned speed/tag/card notes. Older sections below describe v1 where they quote lines; `script.md`, `claims.json` and `review/HUMAN-REVIEW.md` are current.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger and the pronunciations. The headings' lead-ins (`pre:`) and windows are set so the voiced film fits the template's 75 s |
| `vo/` | The voice: 8 WAVs, `lines.json` (the phonemes sent) and `words.json` (word times) |
| `compile.py` | The direction. Every time hangs on a word or a beat. Each release is solved back from the word its landing must hit, through the closed-form fall and the clock. It writes `film.json` and `sheet.json` |
| `film.json` | The scene's clock: shots, time-warp keys, takes, cue table, camera, labels, badges, readouts, captions, end card |
| `sheet.json` | The studio's cue sheet: preset `restframe-bench`, 8 sections, 102 events, 8 voice lines. Pan positions and first-shown times are merged from `render.mjs --cues` |
| `scene.mjs` | The picture, a pure function of t: the channel's set plus this episode's staging |
| `../set/` | **The channel's reusable set** (bible §5), for episodes 2–10: see below |
| `kits/cinema/sci/strobe.js`, `arrows.js` | **New shared kit blocks**, written for this episode and meant for all three channels |
| `qa/` | Checks the kit doesn't have yet: `audit.mjs` (the renderer's text audit, every 0.25 s), `purity.mjs` (in-order against shuffled seeks), `kprobe.mjs` (every final frame's K, no pixels drawn), `clockcheck.mjs` (compile.py's clock against clock.js) |

### The set: "the Bench" (`films/channels/physics/set/`)

| Block | File | Notes |
|---|---|---|
| B1 Stage | `cyc.js` | A warm-paper cyc, ruled every 5 cm with a stronger line every 10 cm. It wraps round the back and the left, so the camera can turn. Its unlit shader composes the look in display colours and outputs the **ACES inverse**, so the screen shows the tokens exactly: measured `#E5E1D8` for cyc `#E6E2D8`, `#EEEAE2` in the pool, `#8D887E` at the edges for shade `#8A857B`. It also draws a light pool, blob shadows, and a soft `shade` vignette under the apps' UI zones. The bloom threshold is set to 2.6, and cyc-hi needs 1.88 in its brightest channel |
| (bridge) | `aces.js` | `acesInv(hex)` and the GLSL version: the cross-check's feasibility fix, round-tripped to the 8-bit value |
| B3 Props | `props.js` | A tennis ball (felt and seam, albedo ≤ 0.7), the release rail with drop-away gates, an unlit birch meter stick numbered in Plex Mono, and the light rig (key, fill, cool rim; no shadow maps) |
| B3 motion | `bench.js` | Closed form, no simulation: g = 981 cm/s², a 100 cm drop (0.4515 s), level throws, a bounce series (e = 0.75, never claimed). The same file runs in Node |
| Title / end card | `title.js` | "The drop": the title falls onto a ruler line and bounces twice on the signature (0, +12, +20 frames). The width axis squashes on each contact, and three faint strobe copies trail above it |
| Scale readout | `readout.js` | "Ruler ticks on the grid": a number printed under the floor line at a point in the subject's plane (20 / 40 / 60 cm) |
| B2, B4, B5, B10 | kit | `clock.js` (×1/20, the "slowed ×20" and "frozen" badges), `strobe.js`, `arrows.js`, `hud.js` |

**Shared kit blocks (new):**

- `kits/cinema/sci/strobe.js`
  - Ghost stamps at τk = τ0 + kΔ on **one opaque InstancedMesh** (48 slots, shared by takes). Each
    ghost pops in when the subject reaches its own τk, read through the clock's `tOf`.
  - **Rungs** go on a second InstancedMesh and join ghosts that share the same k.
  - An optional silhouette rim keeps pale stamps readable on pale ground.
  - Instance origins never jump inside a frame, so the motion probe stays honest.
- `kits/cinema/sci/arrows.js`
  - Up to 64 instanced vectors: a shaft and a head, drawn with an inverted-hull **ink outline** (4
    InstancedMeshes in all).
  - Length is proportional to the quantity, and short vectors scale their heads down.
  - `tail` / `tip` / `mid` anchors for HUD labels; arrows grow and retract over time.
  - `hold` windows keep a slot at its tail from cut to cut.

## Rebuild

```
E=films/channels/physics/ep01; V=<scratchpad>/longform/venv/bin/python; M=<scratchpad>/models
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
cd $E
# 1. voice (only when a vo line changes), then lint on the measured pace
nice -n 10 $V -I ../../../../kits/cinema/voice/tts.py script.md vo --voice af_bella --speed 1.0 --lexicon pron.json --models $M
nice -n 10 $V -I ../../../../kits/cinema/voice/align.py vo $M
python3 -I ../../../../kits/cinema/script/lint.py . --segment measure --bpm 112.5
# 2. direction → film.json + sheet.json; the page's cue table; then again to merge it
python3 -I compile.py
node ../../../../kits/cinema/film/render.mjs --film . --cues --share-cpu
python3 -I compile.py
# 3. soundtrack
python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .
# 4. picture
node ../../../../kits/cinema/film/render.mjs --film . --tier animatic --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --times 0,12.5,22.3,33.0,36.8,46.6,48.5,57.6,65.5,74.3 --build build/stills --share-cpu --keep-png
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --assemble --audio build/audio/mix.wav --name preview-ep01 --out review
ffmpeg -i review/preview-ep01.mp4 -i build/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 44100 -movflags +faststart review/p.mp4 && mv review/p.mp4 review/preview-ep01.mp4
node qa/audit.mjs . 0.2; node qa/purity.mjs .; node qa/kprobe.mjs .; node qa/clockcheck.mjs film.json
# 5. the final (~50 min idle, 1.4 h shared on this box; detached, resumable)
../../../../kits/cinema/film/run.sh . --tier final --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --assemble --audio build/audio/mix.m4a
```

## Timing (voiced, laid out on the 112.5 BPM grid)

| Beat | Film s | What lands on what |
|---|---|---|
| hook | 0–4.27 | Frame 0: two balls 0.23 s into the fall, ghosts 0–4 level in pairs, the title in the air, "slowed ×20". The title drop lands on its signature at 0.3 s. The take freezes on the question (1.20–1.60 s) |
| normal | 4.27–14.13 | Released on "slowed" (5.84) at ×1 with a tape-stop down to ×1/20. Ghosts every 1/20 s, the gap arrows growing, gravity. The knock lands on "down" (13.27) |
| change | 14.13–22.67 | Dropped plus a 0.44 m/s throw, released on "Now" (14.27). Both knock on "same frame" (21.70); the 20 cm readout comes on "twenty" |
| why | 22.67–38.67 | The 1500s drawing on "drew"; released while Galileo is named (27.14, still at ×1/20). The steady-glide arrow, the floor pegs of the glide, equal gravity arrows. It freezes at the moment of contact (36.37). The rungs come on "every tick", and the 52° turn lands on "same height" (36.07) |
| whoa | 38.67–51.20 | The pull-back. Four takes overlaid (dropped, 0.44, 0.89, 1.33 m/s) land on "same frame" (47.70, on "frame") at 20 / 40 / 60 cm. Rungs run across all four trails, and the row bounces back up level while the camera eases back, so the 1.33 m/s ball, sliding on after its bounce, stays clear of the apps' right-hand UI |
| measure | 51.20–60.27 | The recurring segment: the stopwatch appears once the speed badge has gone (51.53). Nine gap arrows are counted down the dropped trail from "Measure it:" to "…of a second" (51.90–54.13), and the stopwatch reads 0.45 s, lit on "point four five" (56.77) |
| takeaway | 60.27–68.53 | A small pull-back, the "Air ignored" card (61.25), the 20 / 40 / 60 cm readouts on "where" (62.13), and "all 0.45 s" on "when" (64.53) |
| tease | 68.53–74.93 | The end card's drop lands on its signature at 73.43 and holds 1.5 s; its footnote fades in as it lands |

## QA

| Check | Result |
|---|---|
| Lint (`lint.py --segment measure --bpm 112.5`, on the measured voice) | **0 errors**, 1 warning: the recognizer wrote "point four five" as "0.45", so those three word times are interpolated. 171 words in 74.93 s (v3); pace 2.53–2.88 words/s per line; the hook's question is spoken by 1.6 s |
| Pronunciation (`vo/lines.json`) | Galileo `ɡˌælɪlˈeɪoʊ`, twentieth `twˈɛntiəθ`, centimeters `sˈɛntɪmˌiːɾɚz` (from pron.json), "point four five" `pˈɔɪnt fˈɔːɹ fˈaɪv`, one-meter `wˈʌnmˈiːɾɚ`, sliver `slˈɪvɚɹ`. Still listen at T0 |
| Clock | compile.py's port of clock.js agrees with clock.js in Node to 4.9e-7 s over all 50 ghost stamps. Every landing falls exactly on its word |
| Soundtrack (`build/audio/qa.json`) | v3: WAV −14.09 LUFS / −2.0 dBTP, AAC −14.1 LUFS / −1.9 dBTP, LRA 3.4; music **21.0 LU** under the voice (−34.9 vs −13.9 LUFS); sync PASS on every kind, 20 labels against the page at 0.0 ms; phone check passes (correlation 0.96). v2: AAC **−14.0 LUFS**, true peak **−2.0 dBTP**, LRA 3.6. Music **20.9 LU** under the voice (−34.6 vs −13.7 LUFS). **Sync PASS on every kind**: bounce, contact, counter.show/tick/end, label, reveal, section, signature, strobe, time.slow (max 0.1 ms). Against the page's own first-shown times, all 17 labels land on their frame (0 ms; review fix: label times are no longer rounded to 4 decimals in `compile.py`, which had put 6 blips one frame, 33 ms, ahead of their label). Phone check passes (correlation 0.95, mono loss −0.16 dB). 77 of 99 events sound: the rest are badges (no preset sound) or quieter cues masked by a knock or label within 0.2 s |
| Text audit | v3: the renderer's audit is clean on 17 final-tier stills, and `qa/audit.mjs` is clean at every 0.1 s step. v2: The renderer's audit is clean (animatic, stills). A dense audit (`qa/audit.mjs`, the renderer's own AUDIT run every 0.1 s over the whole film) is also clean. It first found 11 problems the built-in audit (2 moments per shot) missed, all now fixed: a label under the speed badge, a readout off-frame during the push-in, and a fading badge pushing another onto the counter |
| UI zones (1080×1920) | Every text sits inside x 90–900, y 250–1420. Captions sit in their plates, 1213–~1381 px. Nothing that matters falls in the top 250, bottom 500 or right 180 px |
| Purity (`qa/purity.mjs`) | The same 40 frames sought in order and shuffled: **canvas identical 40/40** (after turning off anisotropic filtering, see below). HUD markup is identical on 35 of 40; the other 5 differ only in the hidden caption plate's `left` (finding 7) |
| Ten final stills | `review/stills-ep01.jpg`, reviewed one by one. Notes under "For a human to review" |
| Preview file | Video 1124 frames = 74.933 s; audio 74.933 s (0.3 ms apart). The delivered AAC measures −14.1 LUFS and −1.9 dBTP |

## Render budget

Measured at 1080×1920 with the full finish (`frames.jsonl` of the stills and test frames):

- **K 2 frames: median 1.25–1.55 s/frame** with the box lightly shared, and **2.1 s/frame** while
  another channel's renders ran beside it. K 12 frames (the fast camera moves): 2.3–2.8 s. The
  ten stills' last two runs gave medians of 1.55 s and 1.90 s (another channel was rendering).
- **Every frame's K**, from the finish's own probe run over all 2,248 frames without drawing: K 2 on
  2,151 frames, 3–5 on 72, 6–10 on 25, never 12. **Mean K 2.11, median 2.**
- **Projected final: about 50 min on an idle box** (2,248 × 1.27 s, plus encodes), and **about 1.4 h**
  if the box is shared. The budget is ≤ 4 h (a median of 6 s/frame or less), so this sits well inside it.
- Before the probe fix (below), parked instances pinned K at 12 on every camera move: mean K was 3.21,
  with 173 frames at 12.

## Claims and TODOs

- **All 14 claims** in `claims.json` have status `ok`, but every one was checked from a search excerpt
  only (`verified_via: "search excerpt"`; the proxy blocks page fetches). **A person opens each of the
  six source links before posting** (v3 adds NASA Glenn's drag equation for c14). `lint.py --sources` prints the post's source list.
- TODO (script notes, bible): the channel handle and the trademark search; a physicist's sign-off; the
  blind A/B of af_bella against Skin School's af_heart; the AI-voice label and "voice: synthetic" in
  the post; a pinned sources page; the posting accounts.
- No phone numbers, emails, prices or hours appear in this episode, so there are no placeholders of that kind.

## For a human to review

- **End-card wording.** The card says **"Next drop: the swing's secret"** (the channel's tease wording
  in DECISIONS.md and theme.json `motif.tease`). The script's end-card line says "Next: the swing's
  secret". Pick one. The footnote under it (v3) reads "Two motions at once: Galileo, Two New Sciences, 1638" (c4).
- **Badges and labels added for honesty, beyond the script's list:**
  - **"frozen"**: the hook freezes mid-fall on its question, and the why beat freezes at contact.
  - **"3 throws overlaid"**: the whoa shows four takes, synchronised at release, in one plane. Three
    real balls can't leave one point at once.
  - Readouts and labels that only restate ledger numbers: "thrown · 0.44 m/s" (c2), "20 / 40 / 60 cm"
    (c2, c6), "1 m" and "all 0.45 s" (c9).
- **Two real-time instants.** At the normal and change releases the clock is ×1 and ramps to ×1/20
  over 0.3 s, a tape-stop sound included. The ball falls 4.4 cm before slow motion settles. The
  "slowed ×20" badge appears as the ramp starts.
- **Not claimed, but shown:**
  - The bounce after landing uses restitution 0.75.
  - Ghosts sit 2 cm behind the live balls so a ball always draws in front of its own fresh ghost
    (0.5 % scale at this lens).
  - The wall's rulings are 60 cm behind the subject. They carry no numbers and do not measure
    heights; the meter stick and the floor lines at z = 0 do.
- **Captions** sit at y = 0.632·H (1213 px), not the theme's 0.61. That leaves room for the ruler
  readouts under the floor line. The plates still end above 1420 px.
- **The bible's "turn"** is 52° with a 7° tilt, not 60–90°. At 68° the two ladders hid each other.
- **Listen at T0:** Galileo, twentieth, centimeters, "point four five". Also check by eye and
  ear the starred words that sit inside a phrase: the knock on "down", both knocks on "same frame",
  the reveal on "same height", and the stopwatch lighting on "point four five".
- **The physicist's sign-off** on the script and the pictures, especially the overlaid whoa and the
  "air ignored" numbers (0.3 ms after the drop, against a 1.7 ms frame).

### Kit and pipeline findings

Nothing protected was edited. Each workaround lives in this episode or the channel set.

1. **cinema3d.js probe, camera points.** Its five camera points always read 0 px (known: the
   cross-check's probe2). Workaround in `scene.mjs`: in probe mode the scene adds five on-screen bench
   points to `CINEMA.probe`, so camera moves raise K.
2. **cinema3d.js probe, no range guard.** It has no far or off-screen guard, so instances parked at
   y = −10⁴ swung across the screen on every camera move and pinned K at 12. Fixed in the new kit
   blocks: they park inside the set, and arrows hold their slot from cut to cut (`hold`). Every
   channel using strobe.js or arrows.js gets this. probe2 should still drop far and off-screen
   samples.
3. **hud.js `counter({ lit })`** sees only the value, not t. The stopwatch is lit by time from the
   scene, by toggling the class after `hud.update`.
4. **hud.js badges** are one line (`white-space: nowrap`). The four-line air badge needs
   `#hud-air { white-space: pre-line }`, set from the scene.
5. **hud.js `fixed` labels.** A fixed label near the safe box's right edge is clamped back over its
   own anchor. Shots are framed so the subject keeps to the left and the labels to the right.
6. **hud.js badge stack.** A clock badge that is fading out still holds its stack slot, which pushes
   the next badge down for 0.3 s. Retimed. The reverse too: the stack reflows faster than a leaving
   note fades, so the note under it slides up into its plate. Worked around in `scene.mjs` (v3.1) by
   fading the speed badge's last exit in 0.15 s; the kit could hold the reflow until the note has gone.
7. **hud.js caption plate.** Between pages the hidden caption plate keeps the last page's `left`.
   It is invisible, so pixels stay pure, but the DOM depends on the seek order.
8. **render.mjs audit** checks only two moments per shot. A 0.1–0.25 s sweep found 11 problems it missed.
   Worth making denser.
9. **SwiftShader anisotropic filtering** carries state between draws. A frame's last bit (1 level, on
   about 50 pixels of the felt) depended on which frames were sought first. Fixed with
   `anisotropy = 1` in `set/props.js`. Other channels with textured props should do the same.
10. **render.mjs `--cues`** reports the end card's signature at `hud.end`'s t0, which is when the
    drop starts. `compile.py` keeps its own time, the first contact, for signatures and merges only
    pan and first-shown times.
11. **Voiced length.** At af_bella 0.95 the voiced layout came to 76.0 s, over the lint's 75 s. Fixed
    with four `pre:` lead-ins in the script headings; the words are unchanged.
