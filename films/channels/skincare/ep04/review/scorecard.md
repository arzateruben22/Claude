# Scorecard: Outer Layer No. 004, "The deadliest dose" (the reboot's look)

## Measured gates (final)

To be filled in from `kits/cinema/film/qa.py` and `scorecard.py`, run on the delivered file.

Draft 1 results:
- **Mix:** −14.1 LUFS / −1.9 dBTP; the voice sits 15.6 LU above the music.
- **Sync:** every sound kind passes.
- **Render audit:** clean.

## Compelling pass (one independent reviewer, every round)

| Point | Draft 1 | Draft 2 | Draft 3 | Draft 4 |
|---|---|---|---|---|
| (a) First 2 s | 3 | 2 | 2 | 3 |
| (b) One thread | 4 | 4 | 4 | 4 |
| (c) Picture moves with the sentence | 3 | 2 | 3 | 3 |
| (d) Motivated cuts | 3 | 3 | 3 | 3 |
| (e) Voice meaning, screen figures | 4 | 4 | 4 | 4 |
| (f) Rhythm | 3 | 3 | 3 | 4 |
| (g) Ending and tease | 3 | 3 | 3 | 3 |

## Review rounds, in short

### Draft 1

Each finding below was checked against the frames and `claims.json` before acting.

**Honesty**
- **Tone strip:** the daylight strip sat under the lethal-dose line, which pairs skin tones with a risk (bible §1). Removed.
- **Dose plate:** now says "units differ by product" and "side effects can occur far below this". Both are from c8 and c9's notes.
- **New badges:**
  - "regrowth studied in mice" (c13: mouse muscle);
  - "≈ 3–4 months, compressed" (c12);
  - "estimate · not to scale" on the gauge.

**The spine readout** (the one number kept on screen throughout)
- It now runs from the first second ("one frown's dose: ?").
- "< 1 %" now holds lit from "kill" to the end card. Before, it left before the payoff.

**The why beat**
- It had been 13 s on one composition. It now cuts back below on "guessed", to the silenced nerve ending, so the thread returns to the junction.

**Pictures**
- **Hook:** a deeper crease and a sharper focus.
- **Inside the nerve ending:** the cut protein's two halves are bigger and part visibly.
- **Takeaway:**
  - the camera is closer on the new endings;
  - the original ending sends its message again (c13);
  - the crease returns.
- **Gauge:** it lifts sooner, and the gap reads "≈ 50 nm" (it had run under the paper bar).
- **Dose plate:** moved above the captions.
- **UV reveal:** fades in faster.

**Not changed**
- **The end card's follow chip** (No. 005) is the next episode, as on every end card.
- **"So how much goes in?"** is kept. The question answers the hook, and the plate's notes now carry the safety context.

### Drafts 2–4

A fresh reviewer each round, scoring independently. Every finding was checked against frames I pulled myself before acting.

**Draft 2**
- **The spine readout disappeared at 28–48 s:** I had ended it at the why beat by mistake. It now runs continuously.
- **Fog:** its colour now matches the ground (0x2c1660), which removes a dark notched band at the terrain's edge.
- **Turn words now have events:**
  - "never leaves": the vesicles press at the membrane and fall back;
  - "sausages": "sausage poison" lights up on its word;
  - "guessed": Kerner's second line arrives.

**Draft 3**
- **The hook was too close to read as a frown.** I confirmed this in the frames. The hook now has two brow mounds and a crease, a wider and sharper camera, and the ng/kg figure on screen on "by the nanogram".
- **The dose plate's bars sat under the captions.** The plate moved up, and REC moved to the viewfinder's foot. A CSS override was needed because the shared style loads after the scene's.
- **Caption breaks:** now fall at phrase boundaries.

**Draft 4**
- **The brow still didn't read as a face:**
  - eyebrow hairs on the two mounds;
  - the frown sets on screen (the relief deepens over the first second);
  - the UV reveal now carries the same crease and mounds, so "the same brow" is literally true;
  - the dose points sit lower, clear of the spine.
- **The loop:** on "endings" the film returns to the brow, with the frown setting again before the end card.
- **The 7.17 s cut:** the cut face now opens close on its crease.
- **Gauge:** the card sits to the left of the nerve ending.
- **Spine:** relabelled at the payoff ("one frown, of a lethal dose") and cleared before the end card. This removes a stray dash that showed through the end bars.

## Look 2 rebuild (2 Nov, Skin Sense)

The picture was rebuilt in the approved look (look test 2), on the facts-pass-2 script. The voice, the claims and the lint are unchanged (lint: 0 errors, 0 warnings).

**Hero shots** (`storyboard.md`)
1. **The brow:** a skin macro in studio light (light tone), oblique and low, with a raking warm key; one slow push into the "11".
2. **The junction:** the neuromuscular junction at cell scale (`../../set/nmj04.js`). A translucent ending holds glowing cyan vesicles on a banded fibre, with violet haze, dust in a shaft and a rack focus from the toxin to SNAP-25.
3. **The cut face:** the stained micrograph cut face, "below the skin", on "never touches the skin".
4. **The dose:** the brow; the UV scan sweeps down on "twenty", and the dose plate (20 against ≈ 3,000) carries its notes.

**Retired from this episode:** the macro terrain flight, the UV-camera brow with five injection points, and the schematic slab junction. Five lit points on a brow read as *where* to inject, and the film never says where, so the UV view shows one faint glow, badged "illustration".

**Overlay**
- At most two labels at once: "nerve ending" and "acetylcholine"; then "SNAP-25".
- Honesty notes sit small in the top corners.
- The spine readout ("< 1 %", one frown of a lethal dose) holds from the takeaway to the end card, so it never sits on the lifted gauge.
- The title, the captions, the gauge and the end card (tease, a follow chip for No. 005, a footnote ending "Narration: synthetic voice (AI)") are kept.
- The channel is now named Skin Sense (ID `skin-sense-004`).

**Draft (look 2), 3 Nov** (`skin-sense-004-9x16-draft-preview.mp4`, `draft-contact-sheet.jpg`)
- **Sync:** PASS. label 0.0/5.0 ms, reveal 12.0/12.0 (slow kind), swell 51.0/51.0 (slow kind), signature 11.0/11.0; all others 0–5 ms.
  - The first run failed on "acetylcholine": it sat 0.17 s after the messenger's diffuse sound. It now lands on "onto".
- **Mix:** music −28.9 LUFS under dialog −13.5 LUFS. The gap is 15.4 LU (pass).
- **Length:** 74.67 s, inside the 60–75 s window.
- **Render:** 2.38 s/frame at draft, K average 2.3 (`kMax` 3 in the scene).

**After that draft (stills only; the next draft carries them)**
- **Coordinator's rules:** the cut face's note is now "tissue photo · stained skin", and its texture is one copy (repeat 1, 1; no tile seams).
- **Channel look, stage 1:** `lookV2` upgrades the brow's skin and adds the graded backdrop and one grade. Grain is 0.007. `richen` is applied to the junction, and the cut face is at fstop 0.1.
- **HUD:** `unifyHud` gives one HUD system, and the plates take its radius.
- **Takeaway framing:** the ending sits under the readout, clear of the captions.

**Open**
- **Eyebrow hairs:** they still read as combed slabs in the oblique macro. `upgradeHairs` assumes terrain hairs standing upright, so it does not fit the brow.
- **End card:** it covers the brow fully, so the loop to frame 0 is only felt through the cut.
- **(h) production value:** not yet scored on the look-v2 frames.
