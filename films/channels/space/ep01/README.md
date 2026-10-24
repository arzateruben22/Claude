# Light Minute No. 001: "If the Sun vanished"

74.7 s, 9:16. **The final is delivered** (24 Oct): `out/lightminute-001-9x16.mp4` (−14.1 LUFS / −1.9 dBTP, QA PASS),
with its poster, contact sheet, `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md` and `assets.md`. It has not been posted.
The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset `lightminute-vacuum`).

- Preview: `review/preview-ep01.mp4` (540×960, 15 fps, AAC 44.1 kHz 192k)
- Ten final-tier stills: `review/stills-ep01.jpg`

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger and the pronunciations (`us` added: the tease's starred word gets primary stress) |
| `voice.py` | Voices the script with one Kokoro speed per line. It reuses `kits/cinema/voice/tts.py`'s own `phonemes()` and `trim()`; see "Voice" |
| `vo/` | 8 WAVs, `lines.json` (with each line's speed) and `words.json` (align.py) |
| `compile.py` | The direction. Every shot, clock, camera key, label, badge, counter, pill, title and end-card moment hangs on a beat or a spoken word. Writes `film.json` and `sheet.json` |
| `scene.mjs` | The picture, a pure function of t: the channel's set plus this episode's staging |
| `../set/*.js` | The channel's reusable Orrery: `sky`, `star`, `planet` (B2, with Earth's surface baked from a coarse coastline), `orbit`, `grid`, `galaxy` (B9, plus a star cloud), `rig` (the telescope mount), `look` (token colours through the finish), `motif` (title ring and band, end ring, readout style, m:ss) |
| `kits/cinema/sci/front.js` | Shared kit block, new: `radius`, `arrival`, `retarded`, `seen`, `train`; screen-space `ring` and `segment` ribbons; `shell`; `probes`; GLSL `retardedStep` |
| `kits/cinema/sci/ladder.js` | Shared kit block, new: rungs, `logDolly` (the focus glides in screen space), crossfades, float-safe re-centring, `niceLength` |

## Rebuild

Run these from the repo root, with `E=films/channels/space/ep01` and `$CINEMA_VOICE` set to the voice venv and models. This build used the scratchpad's `longform/venv` and `models`.

```
$CINEMA_VOICE/venv/bin/python -I $E/voice.py --models $CINEMA_VOICE/models          # nice -n 10; about 1.5 min
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py $E/vo $CINEMA_VOICE/models
python3 -I kits/cinema/script/lint.py $E --segment readout --bpm 56.25
python3 -I $E/compile.py
node kits/cinema/film/render.mjs --film $E --cues --share-cpu       # pan + the picture's own "shown" times
python3 -I $E/compile.py                                            # again, to take them in
(cd $E && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .)
node kits/cinema/film/render.mjs --film $E --tier animatic --share-cpu
node kits/cinema/film/render.mjs --film $E --tier final --times 0,14.6,23.5,28.9,38.5,46.3,51.5,58.6,67.4,72 --build $E/build/stills --share-cpu
node kits/cinema/film/render.mjs --film $E --tier draft --share-cpu
node kits/cinema/film/render.mjs --film $E --tier draft --assemble --audio build/audio/mix.wav --name preview-ep01-48k --out $E/build/assembled
ffmpeg -i $E/build/assembled/preview-ep01-48k.mp4 -i $E/build/audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy \
  -af "aresample=44100:resampler=soxr:precision=28,apad=whole_len=3292800,atrim=end_sample=3292800" \
  -c:a aac -b:a 192k -ar 44100 -movflags +faststart $E/review/preview-ep01.mp4
# final (not run): kits/cinema/film/run.sh $E --tier final, then --tier final --assemble --audio build/audio/mix.m4a
```

## Voice

- **Speed per line.** With one `--speed` (tts.py), the lint failed four lines. At 1.0 the hook ran 3.60 words/s, the tease 3.78, the change 3.09 and the whoa 3.14. Slowing the whole script ran the film past 75 s.
- **Speeds used:** hook 0.82, normal 1.06, change 0.93, why 1.06, whoa 0.93, takeaway 1.0, readout 1.0, tease 0.79. Every line now runs 2.47–2.98 words/s.
- **Script headings changed, not words.** For the 2.0 s hook rule and the 75 s length, the hook's `pre` went from 0.1 to 0.03 (one frame), and the hook, normal and takeaway got `picture-only 0.2 s`.
- **Phonemes checked in `lines.json`:** kilometers, gravitational, neutron, light-years, twenty-seven, galaxy and vanished are all right.

## QA

**Lint:** 0 errors, 0 warnings.
- 171 words, 74.67 s on the 56.25 BPM grid.
- The hook's question ends at 1.95 s.
- 12 claims cited out of 12.

**Layout (beat start, s):** hook 0, normal 3.73, change 16.00, why 25.07, whoa 42.67, takeaway 54.40, readout 60.27, tease 68.27. The end card arrives at 68.33, on "Next:".

**Sound** (`build/audio/qa.json`):
- AAC: −14.1 LUFS, −1.9 dBTP (WAV −14.05 / −2.0), LRA 1.6.
- Music sits 10.7 LU under the voice (−24.8 against −14.2).
- Phone check: pass.
- Sync PASS on every kind (median/max ms):

  | Kind | ms |
  |---|---|
  | arrive | 0/0 |
  | body.vanish | 57/57 (slow, within 3 frames) |
  | counter.show | 0/0 |
  | counter.tick | 0/0 |
  | label | 0/0 |
  | light.front | 0/1.1 |
  | merge | 49/49 (slow) |
  | scale.jump | 0/0 |
  | section | 0/49 (slow) |
  | signature | 0/0 |

- Against the picture's own `shown` times (18 labels): max 0 ms.

**Picture:**
- Animatic, the whole film: audit clean. Draft, the whole film: audit clean.
- A dense audit also ran: the renderer's rules plus box overlaps, every 1/6 s, all 449 moments, clean (that script lived in a session scratchpad and is not kept).
- Review cross-check: the body channel's generic dense audit (`films/channels/body/ep01/qa/audit.mjs`, the renderer's rules plus the apps' UI zones), run on this film every 0.1 s (747 moments): no text problems. Its only flags are the top-right badges touching x = 900 at 540 px (≤ 1 px of rounding at the UI-zone edge).
- Purity (review): `films/channels/physics/ep01/qa/purity.mjs` on this film, 40 frames sought in order and shuffled: canvas identical 40/40. Hidden badges keep a stale `left`/`top` (invisible, as in the other channels). `set/planet.js` now uses `anisotropy = 1` (it was 4): SwiftShader's anisotropic filtering carries state between draws (found on Rest Frame). The ten stills and the draft were made with 4; a still at 46.3 s with 1 looks the same.
- All text sits inside x 90–900 and y 250–1420.

**Render budget, measured on this box while it was shared with another agent's draft:**
- **Final tier (1080×1920, full finish):** a sample of 48 frames spread evenly over the film.
  - Median 1.75 s/frame, mean 1.77, max 2.74.
  - K mean 2.25, max 7 in the sample. K reaches 12 only in the rewind (0.7 s), the race pull-back and the 1.9 s scale jump.
- **Projected final:** 2,240 frames, about 1.1 h of rendering, about 1.2–1.3 h with page loads and encodes. The budget is 4 h.
- **Draft:** 1,120 frames, 0.47 s/frame, K avg 2.2 (max 6), 9 min 19 s.
- **Ten stills:** 1.81 s/frame.

## Honesty badges on screen

| Badge | Where |
|---|---|
| `not to scale` | Every diagram, and the race |
| `time ×N` | From each scene clock: ×64 diagram, ×300 grid, ×10¹⁵ race, ×90 then ×300 whoa, ×64 takeaway. The clock stops for the readout, so the readout has no time badge |
| `orbit sped up ×5,000` | Separate from the light clock. N is computed in compile.py from the 28.5° arc drawn against the true 0.0057° |
| `analogy` | The grid |
| `thought experiment` | Whenever the Sun is gone |
| `true scale` | The Earth-scale shot (Earth 12,742 km across, moving its true 14,900 km) |

## Claims and TODO

- **Claims:** all 12 are `ok`, but every one was checked through a search excerpt only. A person opens each link before posting.
- **Sources for the post:** `python3 -I kits/cinema/script/lint.py films/channels/space/ep01 --sources`
- **TODO (script and bible):**
  - the handle `@lightminute`, plus trademark and handle checks;
  - a decision on adding miles for US viewers;
  - the AI-voice label in the post ("voice: synthetic").

## A human must review

- **Listen at T0:**
  - kilometers, gravitational, neutron, and the stressed "us";
  - the starred words inside phrases (the lint lists them);
  - whether the tease at speed 0.79 sounds too slow.
- **Earth's continents** are a coarse coastline drawn from memory (`set/planet.js`). They read as Earth at phone size, but they are not a map.
- **The galaxy** (`set/galaxy.js`) is an illustration with a 27,000-ly ring, and it carries no badge.
- **Drawing conventions:**
  - The gravity front is drawn 0.24 units (about 3 px) outside the light front, so both read; physically they coincide.
  - The 1 AU light-time ring is drawn 0.32 units outside the orbit.
- **The whoa clock** speeds up (×90 to ×300, badged) after the news arrives, so the straight path visibly leaves the dashed old orbit. The light clock stops and holds at 8:20, lit.
- **Photosensitivity:**
  - The Sun's vanishing (two times) and reappearing (rewind) are single one-frame pops, never a flash.
  - The kilonova glow ramps up over 0.6 s.
  - Earth darkens over about 0.3 s when the news arrives.
  - Analyzer pass on the final (`kits/cinema/film/qa.py`): no frame changes luminance over more than 3% of the screen; 0 flashes.
- **Badges and scale pills are silent.** The preset maps no sound to the `badge` and `scale` kinds. Their events are in `sheet.json` anyway.

## Kit issues worked around here (kit files not edited)

1. **The cinema3d.js probe sees mesh origins only.** probe2 and CINEMA_PX are not in the file yet. A mesh origin at or behind the lens reads as a huge jump, so K jumps to kMax: the race's opening frame measured K 12 before the fix. Fixes:
   - `front.js` ribbons park their mesh origin on their own shape (an arc's centre, a segment's start).
   - The sky sphere's origin is parked in front of the lens.
   - The race's Earth is hidden while it is behind the camera.
   - Points and shader motion (stars, galaxy, cloud, growing fronts) get invisible probe meshes (`front.js probes()`). The sky's probes take their directions from the camera at the frame's own moment, so the probe measures the camera's turn.
2. **tts.py has one `--speed`.** `voice.py` voices per line with tts.py's own functions (see "Voice").
3. **ACES cannot reach the saturated tokens with positive light.**
   - Teal and ice come out pale. `set/look.js` inverts the finish with Newton and lets one channel go negative, so tokens land exactly.
   - `line()` keeps the hue at partial strength.
   - Lilac and ice lines stay at 0.8 strength or below, because at full strength they need so much blue light that the bloom turns them blue.
4. **hud.js labels can't be forced below their anchor, and 3D subjects aren't obstacles to them.** The ruler and label anchors were placed so labels never cover Earth.
5. **render.mjs's audit checks only two moments per shot.** It missed overlaps that the dense audit caught: Earth against the speed label, and badge or counter stacking across cuts. Overlays that end on a cut now leave 0.3 s before it (`before_cut` in compile.py).
6. **The studio's `light.front` sparkle uses ping grains, which the sync QA can mistake for label pings.** The race's shower is 0.6 s long and its labels are spaced after it.
7. **`--assemble` writes 48 kHz AAC 256k.** The 44.1 kHz preview is muxed with ffmpeg.
   - The audio content is exactly the picture's length: 3,292,800 samples = 74.6667 s.
   - The MP4 edit list rounds to the millisecond, so ffprobe shows 74.666 against 74.667.
