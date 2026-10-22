# Pass 3 review synthesis: "Made with Claude · Opus 5.5"

**What I checked myself (read-only).** I looked at the top-3 frames and some extra frames, and measured pixels and audio:

- **OPUS forming.** Confirmed in 16:9 f280, 16:9 f288 and 9:16 f290.
  - 16:9 f280: blurred dots sit under a title cropped to "IADE WITH CLAUDE", and the mascot's eyes are striped.
  - 16:9 f288: "OPUS 5.5" is soft half-letters about 17 px tall.
  - 9:16 f290: the title is cropped to "ADE WITH / AUDE" and the OPUS line can't be read.
- **9:16 end-card halo.** Confirmed in 9:16 f359. Between the two lines (y 750–765) the pixels measure luma 163–181, against glyph cores of 230–247. That reads as a fog plate. The mascot also sits about 20° tipped.
- **Trot-start ghost.** Confirmed in f182 in both formats: the eyes are tripled and the shell edges are doubled on an in-focus mascot in the middle of the frame.
- **Other frames:**
  - f60: a blown, defocused blob with no shards. Confirmed.
  - f79: a white shard sits on the face. Confirmed.
  - f52 flare: the 16:9 region goes 50 → 103 → 68 and the 9:16 left band 17 → 65 → 20. Confirmed.
  - 16:9 f152: CLAUDE's E is cut off at the bottom edge (luma about 150 on row 1079). Confirmed.
- **Audio** (`build/audio.wav`, RMS):
  - The groove runs at −14.4 to −15.4 dBFS.
  - 1.6–2.0 s is −23.2 and 10.4–11.0 s is −24.6, so both holes are confirmed.
- **New (minor):** the warm backdrop also swells during the final leap. Top-sixth luma in 9:16 goes 0.05 (f284) → 0.165 (f289) → 0.01 (f293). It ramps rather than snaps and happens under the whip, so I'd leave it.

## 1. Scores (panel). Pass 1 is the reviewers' current view of it.

| Dimension | Pass 1, 16:9 / 9:16 | Pass 3, 16:9 / 9:16 | Change | Measured QA pass 3 |
|---|---|---|---|---|
| Hook | 6 / 5 | 8 / 7 | +2 / +2 | 9 / 10 |
| Readability | 6 / 4 | 8 / 7 | +2 / +3 | 10 / 10 |
| Continuity | 5 / 4.5 | 7 / 6.5 | +2 / +2 | 10 / 10 |
| Motion | 5 / 4 | 7 / 7 | +2 / +3 | 8 / 9 |
| Sound | 6 / 6 | 6 / 6 | 0 / 0 | 10 / 10 (sync only) |
| **Mean** | **5.6 / 4.7** | **7.2 / 6.7** | +1.6 / +2.0 | 9.4 / 9.8 |

The panel sits 2–3 points under the measured QA in every dimension. The QA misses these problems:

- rotation ghosting
- thin-UI strobing
- edges cropping on oblique views (the probe's title box is wrong there)
- motion inside the brand-legibility test
- whether a sound can actually be heard

## 2. Remaining defects, deduplicated and ranked by viewer impact

Impact = severity × how noticeable (1–3) × how central to "Made with Claude · Opus 5.5" (1–3).

### 1. The liquid-chrome OPUS forming is never seen (both formats, 9.0–10.25). Impact 18

- **Reported by:** readability (severity 3), motion (severity 3), continuity (9:16 OPUS off frame for f270–293), sound (cue at 9.0).
- **Problem:** the swell happens during the 9.25 whip, at 16–17 px with CoC 5–10. By the time the card is sharp (9.83 in 16:9, 10.0 in 9:16), the letters are already finished.
- **Fix:**
  - `timeline.json` `viewer.opusSwell: 9.95`
  - `ui.js:588` `T.opusForm = t < V.opusSwell ? Math.min(0.3, clamp01((t - V.opus) / 0.75)) : 0.3 + 0.7 * clamp01((t - V.opusSwell) / 0.5);`
  - `ui.js:589` `T.opusSettle = clamp01((t - V.opusSwell - 0.35) / 0.6);`
  - `ui.js:590` needs no change: it already keeps `opusT` live until the settle finishes.
  - **Result:** the beads hold through the leap, the letters swell on the settled card from 9.95 to 10.45 and stop moving at about 10.9, which leaves a 1.1 s still hold.
- **Audio (with this fix):** move the `vopus` shimmer (`audio.py:443`) to `V.opusSwell + 0.25`, at −12 dB with a chrome-glint voicing, so it sits between the 10.0 thud and the 10.5 coo.
- **Re-render:** 16:9 f277–f330; 9:16 f277–f359, batched with items 2 and 8.

### 2. 9:16 end-card halo makes a grey plate across the stacked lockup (10.0–12.0). Impact 18

- **Problem:** QA measures glyph:gap at 2.01 (pass 1 was 2.8). MADE WITH looks out of focus on a phone.
- **Fix:**
  - `ui.js:338`: change `* (L.size / 78)` to `* Math.min(1, L.size / 78)`.
  - `ui.js:337`: for the tall layout only, change the halo alpha from `0.72 * glowA` to `0.5 * glowA`.
  - Optional: tall `lines[0].y` −50 → −58 and `sparkY` −182 → −190.
  - **Target:** glyph:gap ≥ 3.5 and the gap pixel at y≈757 ≤ 110.
  - Raise the QA deduction line from 2.0 to 3.0.
- **Re-render:** 9:16 f285–f359 (inside the item 1 batch).

### 3. The trot-start pirouette ghosts the mascot into three copies (both formats, f180–f184). Impact 12

- **Severity:** 4. This is the most visible artifact on the character.
- **Cause:**
  - The turn is about 134° in 0.2 s.
  - `rawSamples` (`main.js:485`) only probes the root point, so it ignores the rotation.
  - The same blind spot causes the head striping in 16:9 f72–f75.
- **Fix:**
  - **(b), first:** make `rawSamples` probe the 8 body corners (x ±0.65·sxz, z ±0.5·sxz, y ∈ {0.2, 1.12}·sy, all × scale, rotated by `P.yaw`). Gate: ≤ 3 px per sub-frame on f176–f190.
  - **(a):**
    - `mascot.js:96`: honour `m.endYaw` for any jump, not just those with face "camera".
    - Add `"endYaw": 0.6` to the jump at t0 5.25.
    - `mascot.js:172`: change `tt / 0.2` to `tt / 0.35`.
- **Re-render:** (b) alone is f178–f186 in both formats plus 16:9 f72–f75. With (a), f158–f192 in both formats.

### 4. The end card falls into an audio hole (both formats, 10.4–11.9). Impact 12

- **Problem:** I measured −24.6 dBFS at 10.4–11.0 against a groove of about −15. Both references stay level here. The pass-3 arc made it about 1 dB deeper.
- **Fix in `audio.py`:**
  - Remove the arc, or limit it to `o0 = outro + 1.0` with −1.5 dB of depth.
  - Keep the 16th arp (−19 dB) and run a hats-only loop from 10.0 to 11.0.
  - Add `bassb.add(bass(hz('G2'),1.0)*np.exp(-tvec(1.0)/0.5), outro, -8)`.
  - Set the crash back to −10 dB.
  - **Target:** 10.4–11.9 within 4 dB of the groove.
- **Re-render:** none. Audio only (0 frames).

### 5. The 2.0 s drop lands soft, in picture and in sound (both formats). Impact 12

- **Picture problem:** f60 is the softest frame of the hook (motionPx 88/113). The pop scale-in and the first take-off straddle f60's shutter, and the shards only appear from f61.
- **Picture fix:**
  - `mascot.js:120` and `:127`: change `seg.t1 - 0.04` to `seg.t1 - 0.06`. The scale then reaches 1 at 1.98, before the shutter opens at 1.9917.
  - First jump only, for `p < 0.08`: `p = 0.08*(2s² − s³)` with `s = p/0.08`. This is C1-continuous, so the arc from f62 on is unchanged.
  - `fx.shards`: render the shards cracked in place from `dt >= -0.012` at scale `d.size*1*fade`. Keep the sparks at `tt = max(0, dt)`.
  - Check that the f60 top face drops below R 235.
- **Picture re-render:** f58–f61 in both formats (8 heavy frames, about 4 min). Confirm with the frame signatures that f62 onward is unchanged.
- **Sound problem:** I measured 1.6–2.0 s at −23.2 dBFS, about 8.7 dB under the groove (refs −2/−1). The snare roll and the voxel chirps carry on to 2.375.
- **Sound fix in `audio.py`:**
  - Lines 337 and 341: change `BEAT / 4` to `BEAT / 8`, so the 8 hits span 1.50–1.94.
  - Line 335: riser −10 → −4 dB. In `riser()`, change the envelope from `**2` to `**1` and the band end from 8000 to 11000 Hz.
  - Optional: gate music and drums to −20 dB over 1.96–2.00.
  - **Target:** 1.6–2.0 within 3 dB of the groove.

### 6. 16:9 title at 5.0: E clipped, glow peaks late, ring cuts the words (16:9 f150–f157). Impact 12

- **Problem:** this is the first brand read, and it shows "MADE WITH CLAUD" plus a stub of the E.
- **Fix:**
  - 16:9 camera keys at t 5.02 and t 5.15: fov 36 → 40.
  - `ui.js:580`: change `/ 0.25` to `/ 0.12`, so full glow lands by f154 while the camera is still.
  - `fx.streak`: impact opacity 0.16 → 0.08.
  - Verify with a bottom- and right-edge pixel test, not the probe's title box.
- **Re-render:** 16:9 f140–f168; 9:16 f150–f158.

### 7. Nothing hits in the first 2 s, which matters most in 9:16 feeds. Impact 8

- **Problem:**
  - 9:16 f0 is effectively pass 1's frame: a 5% sprite under 26% empty wall.
  - The blips peak at −15 dBFS, against −2 dBFS in the refs.
  - The squash peaks 100 ms after its sound.
  - Frame 0 has a one-sided smear.
- **Fix:**
  - 9:16 camera key at t=0: fov 52 → 42 and look z −1.9 → −0.6. Gate: the slab edge sits 8–14% from the top.
  - `ui.js:573`: start the envelope early with `w0 = w - 0.09`.
  - `audio.py:333`: blip −14 → −5 dB, plus `kick()` at −15 under each blip.
  - `main.js:309` and `:524`: centre the shutter at `max(t, shutter/2)`.
- **Re-render (all light frames):**
  - 9:16 f0–f44.
  - 16:9 f0, f12–f22, f27–f37.

### 8. 9:16 end-card lean-back reads as the mascot tipping over (f300–f359). Impact 8

- **Fix:** `mascot.js:192`: change the gain −0.6 to −0.35, and the ramp `/ 0.3` to `/ 0.45`.
- **Re-render:** 9:16 f300–f359 (K=3, cheap), already inside the item 1 and 2 batch.

### 9. A glass shard passes through the mascot's head (both formats, f78–f81). Impact 6

- **Fix:**
  - Change `fx.shards(t)` to `fx.shards(t, P)`.
  - Set `c = P.pos + (0, 0.66·P.sy, 0)`. If `|pos − c| < 1.0`, push the shard out to radius 1.0.
- **Re-render:** whatever `signature()` flags, expected f74–f84 in both formats. Merge with the f72–f75 striping fix from item 3.

### 10. One-frame light flare at f52 (both formats, already present in pass 1). Impact 6

- **Fix:**
  - First render f52 twice for diagnosis: once with bloom off, once with DOF off.
  - If the slab-edge glint is the cause: raise the slab roughness from 0.30 to 0.38.
  - If DOF or bloom spreads it: clamp the DOF/bloom colour fetch to about 4.0.
  - Then check that the far-edge hotspot in f0 and f300 moves by 2 levels or less.
- **Re-render:** f48–f56 in both formats.

### 11. The glow beat and the keyframe run are acted with the back or far side to the lens (4.0–9.25). Impact 6

- **Fix:**
  - `mascot.js:187`: `target = seg.yaw ?? Math.PI*0.85`.
  - Idle at 4.0: `"yaw": -1.0`.
  - Stomp hop at 4.25: `"endYaw": -1.0`.
  - `mascot.js:180`: trot blend 0.45 → 0.7.
  - Keep the 5.25 jump's `endYaw` at 0.6 to match the new trot heading.
  - Check that the beam emitter still reads.
- **Re-render:** f120–f165 and f180–f277 in both formats. The S5 frames are K=3.

### 12. The warm backdrop band snaps in during the S4→S5 jump (both formats, f164–f174). Impact 4

- **Fix:**
  - 5.62 key, 16:9: pos y 2.6 → 4.0.
  - 5.62 key, 9:16: pos y 3.8 → 5.0.
  - Both: look y 0.6 → 0.2.
  - Gate: camera y > mascot y + 0.8 for f160–f178, and 9:16 f169 must still be a face frame.
- **Re-render:** f156–f180, inside item 3's f158–f192 batch.

### 13. The background title is cropped in S5 (16:9 "ADE WITH CLAUDE"; 9:16 OPUS off frame). Impact 4

- **Recommendation:** accept it. The references crop harder. After item 1, 9:16 only loses beads off frame.
- **Fix the docs:** correct "all in frame" in `shotlist.md` and `scorecard.md`.
- **Optional reframe:**
  - 16:9: fov 40 → 43 at 6.0 and 42 → 45 at 9.25.
  - 9:16: look x at the 9.25 key −4.25 → −4.85.

### 14. Thin in-focus UI text strobes ("combs") on whip landings (f108–f122, f170–f178, f290–f299). Impact 3

- **Fix:** in `samplesFor`, set `K = max(K, ceil(px/2.4))` for t in [3.6, 4.08), [5.66, 5.95) and [9.66, 9.98).
- **Re-render:** about 31 frames per format, mostly overlapping the other batches.

### 15. Mid-film sound is masked or mistimed. Impact 2 each, 0 frames

- **Stomp:**
  - Treat it as a big landing: `big = m['type']=='jump' or m.get('stomp')`.
  - Gate drums, bass and music to −12 dB over 4.40–4.495.
  - `thud(1.6)` at −5 dB plus `snare(1.0, seed=77)` at −8 dB on 4.5.
- **Whooshes:** the peak factor goes from `*0.5` to `*0.72`, so the peaks land at 3.79, 5.79 and 9.79.
- **Zaps:** −10 → −5 dB and f0 2600 → 4000 Hz. Give `bell()` a decay argument and use 0.3 for the keyframe dings.
- **Foley:**
  - Keys −10 → −6 dB, with the arp's lighter setting extended to 4.0–4.5.
  - Replace the trot and toolbar ticks with a woody tap (650 Hz) at −16 dB for the trot and −10 dB for the toolbar.
- **Tone:**
  - High shelf −3.5 → −1.0 dB.
  - Hats back to −12/−19.
  - Bass bus −6 → −8 dB.
  - Boings to −9/−7 dB.

### Lower priority (severity 1–2)

| Defect | Fix | Re-render |
|---|---|---|
| Top face clips white on the toolbar (f74–f77, f90) | Ease `rim.intensity` from 3200 to about 2100 across the 2.25–2.5 whip, and back up across the 3.25–4.0 whip | f68–f120, both formats (defer) |
| Keystrokes land mid-air; 9:16 stomp has almost no vertical travel | Hop t0 4.25 → 4.30 and apex 0.5 → 0.65. 9:16 keys at 4.5/4.6: pos [0,7,4] → [0,5.4,4.8]. Gate: glow box x0 ≥ 65 | 16:9 f126–f150; 9:16 f120–f151 |
| Sharp UI shows through the motion-blurred mascot (9:16 f276–f288, 16:9 f290–f297) | DOF depth from the first, centre and last sub-frames, using the maximum view distance | about 21 frames |
| 9:16 mascot covers the final "5" (f297–f299) | Jump `to9x16` [1290,790] → [1320,790] | Inside the ending batch |
| 16:9 mascot leaves the right edge (f294–f298) | 9.62 key pos x −2.6 → −2.2. Gate: x1 ≤ 0.97 | 16:9 f286–f300 (optional) |
| 16:9 hook poster: the background edge cuts through the face | 2.25 key pos y 3.5 → 4.2 | 16:9 f61–f76 plus the poster (optional) |
| Camera drifts back before the 9.25 leap | `groundTrack` samples stop at the next take-off | f270–f277 |
| "glow" is only fully readable 4.375–4.63 | Doc fix, or move the 4.6 hold keys to 4.66 | none, or f138–f151 |

## 3. Cheap wins (no frames, or only a few)

**0 frames:**

- **One audio pass:** items 4, 5 (sound), 7 (blips), 15 and the OPUS shimmer. Re-normalise to −14 LUFS and −1 dBTP, then remux both MP4s. Do this after the OPUS timing (item 1) is locked.
- **Doc and QA fixes:**
  - `HUMAN-REVIEW.md` says −1 dBTP; the master is actually −4.7 dBTP.
  - `shotlist.md`: "all in frame" and "clean on screen 4.375–5.25" are both wrong.
  - Scorecard: the 10/10 claims for readability and continuity aren't supported.
  - QA:
    - Raise the glyph:gap threshold to 3.0.
    - Add a thin-UI strobe check at 2.4 px.
    - Use edge-pixel tests instead of the probe's title box.
    - Make the brand-legibility test respect motionPx.
    - Use a rotation-aware sample probe.

**A few frames:**

| Change | Frames | Notes |
|---|---|---|
| Drop fix (item 5, picture) | 8 heavy | about 4 min |
| Frame-0 shutter fix | 2 light | |
| 9:16 opening plus blip squash timing (item 7) | about 70 light | |
| Body-corner sample probe only (item 3b) | about 13 per format | |
| 9:16 end card: halo, lean and OPUS swell (items 1, 2, 8) | f300–f359 | K=3, cheap; the cost is in f277–f299 |

**Suggested batches:**

| Batch | Covers | Frames |
|---|---|---|
| R1 Ending | Items 1, 2, 8 and the f290–f299 part of item 14 | 16:9 f277–f330; 9:16 f277–f359 |
| R2 S5 entry | Items 3 and 12 | both f156–f192, plus 16:9 f72–f84 (with item 9) |
| R3 Hook | Item 5, item 7, item 10 (after diagnosis) | both f0 and f58–f61; 9:16 f1–f44; 16:9 f12–f37; both f48–f56 |
| R4 Title at 5.0 | Item 6 | 16:9 f140–f168; 9:16 f150–f158 |

## 4. Where the reviewers disagree, and my call

1. **OPUS swell timing.**
   - Readability: start at 9.85, 0.5 s.
   - Motion: start at 10.0, 0.6 s, settle from 10.4.
   - Sound: shimmer at 10.25, based on the current timing.
   - **My call:** 9.95 / 0.5 s, settle 10.3–10.9, shimmer at 10.2. That gives about a 1.1 s still hold, which matters more than a longer morph.
2. **Drop pop offset.** −0.055 (hook) or −0.06 (motion). Both clear f60's shutter; I'd use −0.06 for margin.
3. **S5 title crop.** Readability calls it style-consistent with the references and only needs doc fixes. Continuity wants the camera widened, and their fov values differ (42→45 vs 42→47 plus a look shift). **My call:** accept the crop and fix the docs.
4. **The 9:16 5.62 key.** Motion wants to keep it for the mid-air face frame at f169. Continuity wants the camera raised to remove the backdrop snap. **My call:** raise it, gated on f169 still reading as a face.
5. **16:9 mascot leaving the right edge (f294–f298).** Continuity calls it a defect; motion says it matches reference A at 10.5 s. Low priority.
6. **Motion's "fixed" list says the spark, swoosh and OPUS are all in frame in S5.** The probes and my f280 check ("IADE") contradict it. Treat it as not fixed.
7. **Tone.**
   - Sound reviewer: the pass-3 high shelf and hat cut moved the mix further from the references. The air band is 3.3–4.9 dB under them, against 1.1–2.7 dB in pass 1. That's why sound scores 6 → 6.
   - Scorecard: the mix "ran bright".
   - **My call:** side with the sound reviewer, who measured against the references.
8. **The glow beat.** Readability says it matches or beats reference A. Motion says it is acted from behind, with no eyes in f124–f135. Both are right. Item 11's yaw change and the 9:16 stomp camera change must be gated on the "glow" and Glow-row boxes, so the readability gain isn't lost.
9. **Measured QA against the panel.** QA scores 9–10 where the panel gives 6–8. The 2.53 s camera brake is the one QA flag everyone agrees to leave.
