# Scorecard: pass 1 → pass 3

The gate: score hook, readability, continuity, motion and sound sync, fix the three worst defects,
re-render, and score again. Two kinds of score sit side by side below:

- **Measured** (`scripts/qa.py`): deductions from frame and geometry probes, the same script for both
  passes. Pass 1 was re-scored with the corrected QA (`pass1-newqa`), which measures real glyph boxes,
  the word's own motion and glyph-core contrast. The old pass-1 report is `review/qa-pass1.md`.
- **Panel** (pass 1 only): five independent reviewers looked at the frames. They were much stricter than
  the measured QA, and their defect list drove passes 2 and 3. The pass-3 panel hasn't run yet,
  because subagent usage is limited this week.

## Measured, 16:9 / 9:16

| Dimension | Pass 1 | Pass 3 |
|---|---|---|
| Hook | 9 / 9 | 9 / **10** |
| Readability | 9 / 8 | **10** / **10** |
| Continuity | 10 / 10 | 10 / 10 |
| Motion | 8 / 8 | 8 / **9** |
| Sound sync | 10 / 10 | 10 / 10 |

| Metric | Pass 1 | Pass 3 |
|---|---|---|
| Typed "glow" legible (sharp, in frame, not smeared) | 44% / 0% | **72% / 61%** |
| Brand first legible | 4.9 s / 9.7 s | 4.9 s / **4.9 s** |
| Frames with stepped motion blur (> 6 px per sub-frame) | 40 / 31 | **8 / 0** |
| Largest frame-to-frame exposure jump | 0.37 / 0.43 | **0.05 / 0.07** |
| Camera motion in the first half second (px/frame) | 6.3 / 4.3 | **11.7 / 7.8** |
| Final title: glyph core vs background | 6.6:1 / 8.2:1 | 7.6:1 / 6.5:1 |
| Final title: glyph vs letter gaps (halo flooding) | 3.7:1 / 2.8:1 | **4.1:1** / 2.0:1 |
| Final title capitals (real glyph height) | 55 px / ≈59 px (panel's pixel measurement) | 55 px / **71 px** (stacked lockup) |
| Loudness / true peak | −13.9 LUFS / −4.7 dBTP | −13.7 LUFS / −4.7 dBTP |

Remaining deductions:

- **16:9 hook: frame 0's sprite is 3.6% of the frame height.** The panel asked for a wider frame 0, so
  the layer name isn't cropped. The trade-off is a smaller sprite. It moves from frame 1.
- **Camera brake at 2.53 s (both formats).** The camera now settles onto the first landing (absolute
  key) instead of reversing past it. The probe still sees the deceleration, as one verifier predicted.
  It reads as the camera catching the landing on the beat. Left as a style choice.
- **16:9: 8 frames over the 6 px stepping line.** These are the fastest whips, at about 8 px per sample
  with 64 samples.
- **Sync: the zaps now sound 75 ms before the keyframe pops.** This is intentional: they now land
  with the beam's first light (`fx.beams` fires at `kf.t − 0.08`). The QA reports it as a 45 ms
  placement offset. It's still a 10.

## Panel, pass 1 (16:9 / 9:16)

Hook 7 / 5 · readability 7 / 4 · continuity 6 / 5 · motion 5 / 4 · sound didn't run.

The panel's three worst picks were the double-exposed landings, the "glow" beat, and the S5 keyframe
run (with the stepped motion blur close behind). The verifiers argued S5 and the 9:16 brand payoff
mattered more than the landing ghosts. All of these are fixed, as follows.

## The three worst, and what happened to them

1. **Double-exposed mascot on landings** (pass 2). The stretch now relaxes at contact, the landing squash
   has a 40 ms attack, and there's no crouch in mid-air. Proof in rendered frames:
   `review/pass1-vs-pass2-sections.jpg` (f60, f61, f63, f75, f90, both formats).
2. **The "glow" beat** (passes 2–3). Focus pulls to the typed word, then to the Glow row, with a hold on
   the stomp. In 9:16 the camera rises behind the panel. Legible frames went from 44% / 0% to 72% / 61%.
3. **Stepped motion blur** (pass 2). Sub-frames up to 64 at no more than 4.5 px each, near-field and
   effect probes, and floors for the shatter and the streak. Stepped frames went from 40 / 31 to 8 / 0.

Pass 3 then took the rest of the panel's list:

- S5 shows the title building in the background.
- The lighting jump is gone (corners stay dark).
- The trot shake and the yaw snaps are gone.
- The reflection is front faces only and fades with height.
- The shadow no longer floats past the slab.
- The pop flash no longer covers the drop.
- The halo no longer floods the letter gaps.
- The 9:16 end card is a stacked lockup with real margins.
- The hook poster now comes from frame 68.
- The mix is calmer: −3 dB hats, a high shelf, and an outro that eases back 3 dB.

After a new reference, **OPUS 5.5 forms from liquid chrome** at 9.0–10.25 s (`kits/cinema/liquid2d.js`).

## Determinism

Five frames were re-rendered out of order with the final code: 16:9 f300, f75, f150 and 9:16 f330, f120.
Four are byte-identical. 16:9 f75 differs in 212 pixels (0.01% of the frame) by one colour level, in a
single 75×63 px patch. That's invisible, and it most likely comes from panel-texture state that depends
on render order. The film is reproducible to the eye, and byte-exact in the large majority of frames.

## Still for a human

See `review/HUMAN-REVIEW.md`: brand use, the editor UI's resemblance, AI labelling, a flashing check,
listening on real speakers, and the taste calls (the stacked 9:16 lockup, the S5 framing, the chrome
OPUS).
