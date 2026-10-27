# Scorecard: Rest Frame No. 003, "Where does the bounce go?" (final)

Measured on the delivered file `out/rest-frame-003-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2024 frames, H.264 High BT709, AAC 48 kHz stereo 258k, 2.97 Mbps video, 27.3 MB |
| Length | 60–75 s; picture = sound | 67.467 s / 67.467 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the strobe of the drop and first rebound beside the meter stick, the ball rising well under the hand, the title in the air. "Why can't it reach your hand?" is spoken by 1.70 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.0 LUFS, −1.9 dBTP**, LRA 3.8 LU |
| Voice over music | ≥ 10 LU | 20.9 LU (dialogue −13.6, music −34.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.24 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 14 kinds, 57 events, all PASS: transients worst 0.1 ms; slow swells (reveal, section, swell, time.slow, wave.on) worst 21 ms |
| Labels vs picture | sound on the first visible frame | 10/10 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2024 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes, 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 7 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2024 frames (0.78 s/frame, K avg 2.6, max 12) |

## Review rounds
1. **Script review** (independent, before voicing): its fixes were applied before the voice was locked (25 Oct, 79fad8e).
2. **Draft and animatic rounds** (25 Oct): animatic checked, soundtrack, ten final-tier stills; a first final rendered
   that night.
3. **Recheck pass** (26 Oct, at the user's request): captions break at phrases; the spine readout pinned to the safe
   line; the height and hand labels placed clear of other text; the first final superseded (labels lingered across
   cuts, mid-phrase captions).
4. **Fact audit** (the coordinating session, 26 Oct): "doesn't spring back as *hard*" and "about three thousandths of
   a *degree*" re-voiced (lint 0 errors before and after); c4, c8 and c14 repointed to OpenStax College Physics 8.5,
   c5 and c12 to the pages their new excerpts came from (the dynamic tennis-ball test; the ITF core recipe); "James
   Joule wouldn't." given its own claim, c20 (his 1843 postscript).
5. **Rule 8, "One line wins"** (an implementer, an independent reviewer and a fixer): the review's four should-fixes
   were taken (the record ladder and the hand step back on "A"; "sound" and Joule's labels leave with their drawings;
   the spine stays lit through its exit). `set/ink.js`: Joule's top cords were never drawn (a statement inside a
   comment); fixed.
6. **The 08:35 final** (QA PASS) was looked at frame by frame and superseded: a stepped-back hand, ball and ghost
   ladder kept only about a tenth of their contrast (opacity and the lerp toward the paper act in scene light, before
   the finish's curve), so the ball nearly vanished on "It becomes heat". Every step-back now goes through
   `set/aces.js` `screenAlpha`, so a third keeps a third on screen. The "heat" pills sat on the ball; they now point
   at the contact patch at the ball's lower-left edge, and the first one leaves 0.6 s before the cut, before the
   rising ball carries it into the readout (the render audit's catch). HUD audit 17.5–36 s every 0.25 s: 0 overlaps.
7. **Final**: one run, 27.5 min, no restarts. Twelve stills from the delivered file (`stills-ep03.jpg`), looked at
   390 px wide.

## Noted, not fixed
- On "and the water warmed" the "the water warms" pill crosses Joule's tank and cord; the drawing has stepped back to
  a third by then, so the pill and the red column read first.
- A stepped-back ball keeps its full-strength contact shadow (the cyc's casters have no strength setting).

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones ("Joule", "eighteen-forties", "thousandths").
