# Meanwhile, Inside No. 01, "Single file"

Episode 1 of Meanwhile, Inside, the human-body channel (`films/channels/body`). It runs 72.0 s at 9:16 and
is narrated by bf_emma, a synthetic voice that must be labelled as AI. It was built end to end on the
studio's brand-neutral pipeline (`kits/cinema/voice`, `script`, `studio`, `film` and `sci`) as far as a
preview. **Nothing has been posted.** A physiologist signs off the script and the pictures before it posts.

| | |
|---|---|
| Preview: draft tier (540×960, 15 fps, finish with K ≤ 6), final mix as AAC 44.1 kHz 192k | `review/preview-ep01.mp4` |
| Ten final-tier stills (1080×1920, full finish) | `review/stills-ep01.jpg`; the PNGs are in `build/stills/final/9x16/frames/` |
| Soundtrack | `build/audio/mix.wav`, `mix.m4a`, `qa.json`, `spectrogram.png` |


## v3 (26 Oct): the script audit's fixes

The independent script audit (`../../../audits/2026-10-26/body-ep01.md`) found two misleading lines and three wording notes.
Applied, re-voiced, re-directed and re-mixed (lint 0 errors; sync PASS):

| | Before | Now |
|---|---|---|
| F1 (why) | "You'd guess it stretches to fit. It can't." | "You'd guess its **surface** stretches to fit. It can't." A red cell does lengthen; its membrane's area can't grow (c7) |
| F2 (takeaway) | "Stiff sickle cells can jam the *smallest vessels*, where oxygen is handed out. That dimple isn't decoration. {-}" | "Sickle cells lose the *disc shape*, stiffen, and can jam where oxygen is handed out. That dimple isn't decoration. {c17}" The button now follows from the line before it, and the dimple sentence carries its own claim (Namvar et al. 2021, the peer-reviewed version of c8's preprint) |
| F4 (whoa) | "The tightest are about three micrometers" | "The tightest **vessels** are about three micrometers" |
| F5 (normal) | "about seven micrometers across" | "about seven and a half micrometers", which matches the "7.5 µm" pill on screen |

- **Direction.** The takeaway opens on the hero still cupped at the mouth of its capillary. It pops out and springs back to a disc on
  "disc shape" (the pop's thump lands on "disc"), and the camera then hands over to the capillary it left, landing there on "jam".
- **F3 (a sickle cell on screen) is not built.** See "For a human to review".
- **Claims.** c8 now cites the published paper (Cell Microbiol 23:e13270). c16 cites NHLBI's sickle cell disease page and lists MIT
  News (2012) and the NHLBI fact sheet in its note; the audit could not re-confirm the fact-sheet quote. c3's claim no longer
  calls the actin ring general to mammals (it was seen in mouse cells). c17 is new.
- **Timing.** The film is 1.2 s longer (72.0 s); everything after the meet shot moves later. Every anchor hangs on a word, so nothing
  was retimed by hand. The planned windows of the normal, change, takeaway, meanwhile and tease headings moved by 0.5 s so lint's
  planned pace stays under 3.0 words a second.
- **Not redone in v3:** the draft preview (`review/preview-ep01.mp4`), the ten-still sheet and `qa/kprobe.mjs` are still v2's. Stills of
  the changed beats were rendered at final quality and checked one by one.

## v2 (24 Oct): new narration and notes

The script was rewritten to the studio story standard (`kits/cinema/script/WRITING.md`; an independent review's fixes applied), re-voiced, and the direction re-pointed to the new words. The HUD notes are the redesigned speed/tag/card notes. Older sections below describe v1 where they quote lines; `script.md`, `claims.json` and `review/HUMAN-REVIEW.md` are current.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | The words and the claims ledger (v3: the 26 Oct audit's fixes; 17 claims) |
| `pron.json` | `micrometers`, `nucleus`, and the phrase `a capillary` (see the tts.py finding below) |
| `voice.py` | The voice. Each sentence is a separate Kokoro call with its own speed, and a measured pause is inserted between sentences. It uses tts.py's own `phonemes()` and `trim()`. `--clamp` runs after align.py |
| `vo/` | 8 WAVs, `lines.json` (per-sentence speeds, gaps and silences) and `words.json` (align.py output; 8 word ends clamped) |
| `compile.py` | The direction. Every cut, iris, clock key, hero anchor, camera key, focus key, label, pill, counter, badge, title and end card hangs on a word or a beat. Writes `film.json` and `sheet.json`, merging pan and first-shown times from `render.mjs --cues` |
| `scene.mjs` | The picture, a pure function of t: the world, the solved journey, the streams, the hero, the HUD and the probe |
| `qa/` | `peek.mjs` (quick looks), `audit.mjs` (the renderer's text audit plus the apps' UI zones, run densely), `purity.mjs` (in-order seeks against shuffled ones), `kprobe.mjs` (each final frame's K without drawing it) |
| `../set/` | **The channel's reusable set** (bible §5), for episodes 2–10. See below |
| `kits/cinema/sci/path.js`, `swarm.js`, `cutaway.js` | **New shared kit blocks**, for all three channels. See below |

### The set: "The Inner Stage" (`films/channels/body/set/`)

| Block | File | Notes |
|---|---|---|
| Stage, light, finish | `look.js` | **An opaque backdrop at a finite distance** (a cross-check fix). A sphere around the camera paints the stage gradient from `theme.json` in screen space. Its colours are ACES-inverted, so after the finish the screen shows `bg` and `bg-hi` exactly, and a hashed dither prevents banding. With this backdrop the finish's depth of field no longer draws a dark rim on silhouettes. Fog fades each material into the backdrop's colour at that pixel, not into one flat colour. A fresnel rim fakes translucency. The light rig is hemisphere #DDF3EC/#0A1F1C, a warm key, and a **mint** rim (cross-check: not pink). It moves with the camera, and there are no shadow maps |
| B1 Vessel | `vessel.js` | A cut-away tube along a `path.js` path. The cut is real geometry, not a clipping plane, so the finish's depth pass sees the same cut. It has a seeded, seamless Voronoi endothelium lining (anisotropy 1) and darker cut rims for the wall's thickness |
| B2 Cell | `rbc.js` | The red cell: an Evans–Fung biconcave profile scaled to 7.5 µm, 0.78 µm thick at the dimple and 2.5 µm at the rim. **The parachute fold keeps arc length along every meridian, so it bends without stretching** (c7). `foldFor(r)` gives the least fold that fits a vessel of radius r. Instanced cells fold in the vertex shader (attribute `aFold`); the hero folds on the CPU, so the depth pass matches it |
| B9 Locator, motif, iris | `motif.js` | **No circles.** The "you are here" locator is a 2D SVG silhouette with a pulse-line blip on the beat. The pulse line kicks under the title on the signature and under the tally on each lub, and flat-lines on the end card. The iris is a membrane-blob mask with a chartreuse edge. Every cut sits at the iris's closed moment |
| Probe | `probe.js` | The cross-check's probe2, implemented in the scene (see the cinema3d.js finding below) |

**Shared kit blocks (new, in `kits/cinema/sci/`):**

- **`path.js`**
  - A CatmullRom (or any `THREE.Curve`) with an arc-length table and rotation-minimising frames.
  - `flow()` tabulates and inverts τ = ∫ds/v.
  - `stream()` is a looping file of things a fixed scene time apart. **It is wrap-safe**: scale is 0 at both path ends and a `wrap` flag tells probes to skip those things.
  - `tube()` builds a full or partial (cut-away) tube with variable radius and slope-correct normals.
  - `instance()` writes one instance matrix.
  - Tested in Node: the line and circle lengths are exact, and τ against a 200,000-step integral is within 1.4e-7.
- **`swarm.js`**: seeded instanced particles placed at home + Σ A·sin(ωt + φ), with an eased, staggered lerp to targets and an optional triangle-wave box fold (a gas). It also has a centroid and per-particle anchors. Determinism is tested.
- **`cutaway.js`**: a star-shaped shell (a sphere deformed by seeded value noise, or any `radial(dir)`) cut by a clipping plane.
  - **The cap is exact without a stencil buffer**: one bisection per angle in the plane. The finish's targets have no stencil buffer.
  - The cap has a `capEdge` attribute, so a material can draw a membrane, crust or rind along the cut.
  - An optional `deform` is applied to both the shell and the cap; here it is the fold.
  - Tested: a sphere's cap radius is exact, and a cut through a red cell's axis gives its biconcave profile.

## Rebuild

```
E=films/channels/body/ep01; V=<scratchpad>/longform/venv/bin/python; M=<scratchpad>/models
export PLAYWRIGHT_DIR=$(dirname $(npm root -g)) CHROMIUM=/opt/pw-browsers/chromium
cd $E
# 1. voice (only when a vo line changes), then the clamp, then lint on the measured pace
nice -n 10 $V -I voice.py --models $M
nice -n 10 $V -I ../../../../kits/cinema/voice/align.py vo $M
$V -I voice.py --clamp
python3 -I ../../../../kits/cinema/script/lint.py . --segment meanwhile --bpm 75
# 2. direction → film.json + sheet.json; the page's cue table; then again to merge it
python3 -I compile.py
node ../../../../kits/cinema/film/render.mjs --film . --cues --share-cpu
python3 -I compile.py
# 3. soundtrack
python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .
# 4. picture checks
node ../../../../kits/cinema/film/render.mjs --film . --tier animatic --share-cpu --fresh
node qa/audit.mjs . 0.2; node qa/purity.mjs . 40; node qa/kprobe.mjs .
node ../../../../kits/cinema/film/render.mjs --film . --tier final --times 0,11.8,22.6,29.6,42.6,47.2,56.9,61.0,66.6,69.5 --build build/stills --share-cpu --keep-png --fresh
# 5. preview
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --share-cpu --fresh
node ../../../../kits/cinema/film/render.mjs --film . --tier draft --assemble --audio build/audio/mix.wav --name preview-ep01 --out review
ffmpeg -i review/preview-ep01.mp4 -i build/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 44100 -movflags +faststart review/p.mp4 && mv review/p.mp4 review/preview-ep01.mp4
# 6. the final (projected ~2.6 h on this box; detached and resumable), then the delivery
../../../../kits/cinema/film/run.sh . --tier final --share-cpu
node ../../../../kits/cinema/film/render.mjs --film . --tier final --assemble --audio build/audio/mix.m4a
```

## Voice

- **Pace.** tts.py at speed 1.0 failed lint's 2.2–3.0 words/s on 7 of 8 lines; the hook ran at 3.62. A single
  slower speed (0.83) would push the hook's question past 2.0 s. bf_emma runs sentences together with no
  breath: "folded?" ended at 1.68 s and "Because" began at 1.69 s. `voice.py` therefore voices each sentence
  separately and inserts 0.30 s of silence after a statement and 0.45 s after the question. Speeds run from
  0.85 to 1.0 per sentence. Every line now runs 2.66–2.95 words/s.
- **Phonemes checked** in `lines.json`: micrometers `mˈaɪkɹəʊmˌiːtəz`, nucleus `njˈuːkliəs`, capillary
  `kəpˈɪləɹi`, parachute `pˈaɹəʃˌuːt`, marrow `mˈaɹəʊ`, twenty-five `twˈɛntifˈaɪv`. One was wrong, "into
  **a** capillary", which came out as "into AY capillary" (`ˈeɪ`). It is fixed by a phrase entry in `pron.json`
  and the script was voiced again.

## Timing (voiced, laid out on the 75 BPM grid)

| Beat | Film s | What lands on what |
|---|---|---|
| hook | 0–5.6 | Frame 0 is the payoff: the hero folded into a parachute in a 4.6 µm capillary, with the title "Single *file*" and its pulse line kicking on the signature (0, +0.4 s). On "narrower" the camera looks up the road ahead |
| normal | 5.6–17.6 | Iris to an artery's crowd, with the locator. Label on "red"; "7.5 µm" pill on "seven" (the voice says "about seven and a half micrometers"). The cell turns edge-on after "dimpled" and is cut open on "nucleus" ("no nucleus" points at the waist of the section). Crane back on "trillion" |
| change | 17.6–26.8 | Iris to the vessel tree ("not to scale"). The hero reaches the first branch point on "branches", the second on "branches" again, and the capillary on "capillary" (label). Iris at 22.32 into the **ride-along, slowed ×10, 22.32–25.32 (3.0 s)**: the capillary narrows below the cell's width and it folds. Then, on "single", the cells coming up behind it in single file |
| why | 26.8–38.4 | A wider stretch: the hero has relaxed to a disc by "guess" ("You'd guess its surface stretches to fit"). It is cut along its axis on "dimples", showing the biconcave profile (label "dimple"), and seen three-quarter on "parachute" as it cups. Picture-only after "instead": its nose enters a 3.8 µm pinch (35.8 s, a squish) and it springs back to a disc with a damped overshoot (36.9 s, a thump). The next cell squeezes too |
| whoa | 38.4–51.6 | The tightest vessel, 3 µm, from "tightest" ("The tightest vessels are about three micrometers"). "3 µm" pill on "three". On "half" a ghost outline of the undeformed cell appears across the vessel, labelled "its width: 7.5 µm". Iris at 43.45, then the reveal pull to the capillary net ("50 µm" pill). The counter runs 0 → 120 days from "about" to "days" (counter.end plays the signature) |
| takeaway | 51.6–59.2 | Iris to the hero, still cupped at the mouth of its capillary. It pops out into a venule and springs back to a disc on "disc shape" (53.03 s, the pop's thump). From 53.77 s the camera hands over to the capillary it left, landing there on "jam" (55.2 s). O₂ diffuses out through the wall on "oxygen" (label, "not to scale") |
| meanwhile | 59.2–65.2 | **The tally**: "new red cells while you watched", 2,000,000 × t from frame 0, so it reads 119.0 million when it appears and as the line starts (59.5 s). It sits on a pulse line that kicks on each lub, and a lub-dub thump plays on each beat |
| tease | 65.2–72.0 | Iris; the hero is cut open on "carries", showing its "passengers" (not to scale), which sparkle on "billion". The end card arrives at 70.0 s: the pulse line flat-lines into "Next, inside: *a billion passengers*" and holds 2.0 s |

How the hero's path is solved: the vessel's widths are laid out so that the flow carries the hero to each
feature on its word. Feature by feature, a bisection finds the place where the hero stands at that word,
with v ∝ 1/r² in one tube (`MI_SOLVE.residual` is 0 for every feature). Camera keys are offsets from the hero,
so a tracking shot cannot lose it.

## QA

| Check | Result |
|---|---|
| Lint (`--segment meanwhile --bpm 75`, measured voice) | **0 errors, 0 warnings** (v3, 26 Oct). 167 words, 72.0 s; 2.66–2.95 words/s per line; the question is spoken by 1.62 s; 17 of 17 claims cited |
| Soundtrack (`build/audio/qa.json`) | v3: AAC **−14.1 LUFS**, true peak **−1.9 dBTP** (WAV −14.04 / −2.0), LRA 3.0. Music **16.0 LU** under the voice (−29.4 vs −13.4 LUFS). **Sync PASS on every kind** (beat, breath, cell.pass, counter.end, counter.show, diffuse, dissolve, impact, label, section, signature, swell); the worst is the swell at 47 ms, against a 3-frame allowance. Against the page's own first-shown times, 8 labels/counters land at 0 ms. Phone check passes (correlation 0.89, mono loss 0.08 dB). 33 of 40 events sound; the silent ones are badges and pills, which have no sound in the preset |
| Text audit | The renderer's own audit flagged one problem on the animatic: the tally ran past the safe box at x = 915. It was fixed by centring the counters on the safe box rather than the frame and moving the tally below the badge stack. `qa/audit.mjs` (the same AUDIT plus the apps' UI zones: top 250, bottom 500, right 180 px) is **clean at all 360 moments, every 0.2 s** (v3, 26 Oct) |
| Purity | 40 frames sought in order and then shuffled: **canvas identical 40/40, whole page 40/40** |
| Renderer's own audit, after the fixes | The animatic (425 frames) and the draft (1,062 frames, 0.99 s/frame, K avg 2.5, max 6) are both clean |
| Preview file (v2, not redone for v3) | Video 1,062 frames = 70.800 s, audio 70.800 s (equal). The delivered AAC (44.1 kHz, 192k) measures −14.1 LUFS, peak −1.9 dBFS |
| Stills | Ten final-tier stills, reviewed one by one (see "For a human to review"). v3: eleven more at the changed beats (9.6, 28.6, 40.6, 42.9, 51.9, 53.2, 54.2, 55.5, 57.6, 61.5 and 71.0 s), no text warnings |

## Render budget

- **K for every final frame** (`qa/kprobe.mjs`): K 2 on 1,050 frames, 3–5 on 685, 6–12 on 309, 13–16 on
  80 (the ride-along, capped at 16 there and at 12 elsewhere). **Mean K 3.87, median 3.**
- **Measured at 1080×1920** with the full finish (the ten stills, CPU shared): **2.9–5.9 s/frame at K ≤ 6, 9.4 s at
  K 16; median 4.9 s.** A fit gives 3.15 s + 0.34 s × K.
- **Projected final: ~2.6 h for 2,124 frames** (v2; v3 has 2,160 frames, about 3 min more) (mean 4.45 s, median 4.2 s per frame). The budget is ≤ 4 h,
  or a median of ≤ 6 s per frame.
- Cost drivers, in order: the ride-along's K 16 (90 frames), and the depth of field on close-ups (the K-2 stills
  range from 2.9 s to 5.9 s depending on how much of the frame is blurred). No shadow maps, no transmission,
  ≤ 400 instanced cells.

## Claims and TODOs

- **All 17 claims** in `claims.json` have status `ok`, and **every one was checked from a search excerpt only**
  (`verified_via: "search excerpt"`: the proxy blocks page fetches). **A person opens each of the 14 source links
  (and the two extra links in c16's note) before posting.** Run `lint.py --sources` for the post's source list.
- Things to check while doing that:
  - c8 and c17 cite the peer-reviewed Namvar et al. 2021 (Cell Microbiol 23:e13270), not the preprint.
  - c2 gives 7–8 µm. The voice says "about seven and a half" and the pill says 7.5 µm.
  - c16: NHLBI's page for "lose the disc shape" and the jam; the fact-sheet quote in its note could not be re-confirmed
    on 26 Oct.
  - c13: the tally's rate is MedlinePlus's "about two million a second".
  - c14: 270 million hemoglobins per cell, from Merck's page. The cross-check could not confirm BioNumbers 102740.
- TODO (script notes): the channel handle and trademark search (USPTO/EUIPO, in-app handles), a physiologist's
  sign-off, the AI-voice label and "voice: synthetic" in the post, a pinned sources page, and the posting accounts.
- No phone numbers, emails, prices or hours appear in this episode, so there are no placeholders of that kind.

## For a human to review

- **End-card wording.** The card says "**Next, inside:** a billion passengers", the channel's tease wording
  (DECISIONS.md, theme.json `motif.tease`). The script's end-card line says "Next: A billion passengers". Pick
  one.
- **Shown but not claimed:**
  - Flow speeds are 0.4 mm/s × (2.6/r)² in the capillaries (inside the cross-check's 0.3–1 mm/s), 2 and
    1.3 mm/s in the arteriole and branch, and 0.6 mm/s in the venule.
  - The pinch is 3.8 µm, the wide stretch 8.3 µm, and the tightest vessel 3 µm.
  - The fold thins the cell to fit. A real cell elongates at constant volume; the model keeps the membrane's
    arc length instead.
  - The spring-back overshoot.
  - The tree's branch segments are compressed, hence "not to scale" on the tree.
  - O₂ molecules and the "passengers" are drawn hugely oversized, hence "not to scale".
- **Badges.** "slowed ×100" stays on for the whole film, because every shot shows flow at ×1/100. It changes to
  "slowed ×10" for the 3 s ride-along.
- **The locator** marks the forearm. The script names no place, so this is staging.
- **The "passengers"** in the tease are a visual hint at episode 2 (O₂ on haemoglobin). No number is shown
  until the voice says "about a billion".
- **No sickle cell on screen (audit F3, a story note; not built).** The takeaway names sickle cells while the
  picture shows the healthy hero springing back to a disc on "disc shape", then the capillary it left, its
  neighbours and O₂. The audit suggests a stylised crescent cell lodged in a capillary, labelled "sickle cell". It
  was left out because it is not a small addition: the hero's capillary carries its single file through the whole
  takeaway, so a lodged cell there would overlap them; the cell-free cross-links are out of frame; a crescent
  needs a new geometry, probe points and a new vessel or camera move; and a "sickle cell" label would compete
  with the O₂ label inside a 7.6 s beat. If the physiologist or the editor wants it, it is a set addition (a
  crescent block in `../set/`) and a re-staged takeaway.
- **Listen at T0:** micrometers, "a capillary", nucleus, marrow. Check the per-sentence pauses: 0.45 s after
  the hook's question, 0.30 s elsewhere. Check by eye and ear the starred words inside a phrase: folded,
  narrower, red blood cell, nucleus, capillary, single file, dimples, parachute, half its width, a hundred and
  twenty days, disc shape, carries. The pop's thump lands on "disc".
- **A physiologist's sign-off** on the script and the pictures, especially the fold (the membrane's area doesn't
  stretch; the model keeps its arc length), the ghost comparison (3 µm against 7.5 µm) and the sickle-cell line
  (c16: whether to name the disease, and "where oxygen is handed out" for the capillaries).

### Kit and pipeline findings

None of the protected files were edited. Each workaround lives in this episode or in the channel's set.

1. **cinema3d.js has no probe2 yet.**
   - Its camera points always read 0 px. Samples near or behind the lens spike. Instances scaled to 0 at a
     wrap still count.
   - Workaround (`set/probe.js`, called from `scene.mjs`): in probe mode the scene hides itself
     (`scene.visible = false`) and writes its own samples into `CINEMA.probe`. These are the cells and
     particles at their JS-computed positions, the hero's folded rim, and several hundred static wall and tissue points.
     The static points measure camera motion correctly, because each is projected through the camera at its
     own end of the shutter. Samples behind the lens, within 15 µm of it, at |ndc| > 1.15, at a wrap or at
     scale 0 are dropped. No kFloor is used.
   - The K cap (12, or 16 for the ride) is set per frame from the tier's own kMax, read at the first probe
     seek, so the draft's K ≤ 6 still holds.
2. **cinema3d.js's depth pass uses `scene.overrideMaterial`.** It therefore sees neither vertex-shader
   deformation nor clipping planes. Workarounds:
   - the vessels are cut as real half-tubes;
   - the hero folds on the CPU;
   - the instanced cells keep a small depth-of-field mismatch (the depth pass sees their unfolded discs);
   - cutaway.js's clipped half still appears in depth (a little cap blur).

   probe2 work could add a depth material hook.
3. **tts.py, lexicon splitting.** The text between lexicon words is phonemized as separate fragments, so a lone
   "a" at a fragment's end is read as the letter name (`ˈeɪ`). Fixed here with the phrase entry `"a capillary"`.
   A fix in tts.py would phonemize the whole line with placeholders.
4. **tts.py has one `--speed` and no pause between sentences** (bf_emma runs them together). `voice.py` voices
   one sentence per call.
5. **align.py stretches word ends.** It snaps starts to the audio but not ends, so the last word before a pause
   is stretched over the silence ("folded?" ran to 2.0 s; its sound ends at 1.52 s). lint's hook check then
   failed. `voice.py --clamp` cuts an end back to the start of a known inserted silence (8 ends in v3), keeping the
   recognizer's value as `end_asr`.
6. **render.mjs's audit checks only two moments per shot.** It caught the tally. `qa/audit.mjs` runs the same
   AUDIT, plus the UI zones, every 0.2 s.
7. **hud.js `scale` caps its bar at 60 % of the safe width.** A 7.5 µm comparison bar could not show in the
   close-up, so the whoa uses a ghost outline with a label instead.
