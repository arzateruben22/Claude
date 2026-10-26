# Scorecard: Rest Frame No. 006, "The ten-meter straw" (final)

Measured on the delivered file `out/rest-frame-006-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2064 frames, H.264 High BT709, AAC 48 kHz stereo 258k, 2.75 Mbps video, 25.9 MB |
| Length | 60–75 s; picture = sound | 68.800 s / 68.800 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the top of the three-story straw, its water stopped well under the pump on the roof, the title in the air. "What lifts a drink up a straw?" is spoken by 1.86 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 4.3 LU |
| Voice over music | ≥ 10 LU | 21.0 LU (dialogue −13.7, music −34.7 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.19 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 13 kinds, 37 events, all PASS: transients worst 0 ms; slow swells (energy.loss, reveal, section, swell, time.slow) worst 10 ms |
| Labels vs picture | sound on the first visible frame | 8/8 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2064 frames |
| Flashing | ≤ 3 flashes a second | 2 large-area luminance changes (frames 1480, 1728), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 7 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2064 frames (0.92 s/frame, K avg 5.5, max 12) |

## Review rounds
1. **Script review** (independent, before voicing): not ready, six must-fixes, all taken. The change beat's jar,
   pumped empty around an open straw, would have bubbled (room air pushes down the straw), so the change is a glass
   filled completely under an airtight lid (the jar-lid demonstration, sourced); "It isn't you" became "Surprisingly,
   not suction" (c13); US spelling throughout (the title "The ten-meter straw"; episode 5's tease and end card too);
   the measure says "the air above" and "just over a kilogram" and a card explains 10.1 m against 10.3 m; heights on
   the house's scale count from the basin's surface; the whoa answers episode 5's question first (lungs about a meter,
   then the perfect pump to near ten meters). Ledger notes added: the 1643/1644 dating, boiling only at the very top,
   "lungs" not "you".
2. **Voiced lint**: af_bella at 1.0 ran five short lines at 3.2–3.7 words a second; rewritten with full stops and
   longer words (auditioned) until every line was at or under 3.0. 0 errors before and after voicing; one warning
   kept (the change beat is 18 words against the template's 20).
3. **Picture rules** (WRITING.md 1–8, with the readability kit merged on 26 Oct): one world (the bench in front of
   the house, the tall straw beside it), the spine readout from hPa to meters, held lit at 10.11 m through the
   takeaway; the mannequin as the human anchor; each beat's deliverer stepping back to a third as the next begins;
   notes in the top-right only, at most two, framing tags 4 s; the loop to frame 0; the end-card footnote.
4. **Draft and animatic rounds** (four): the cyc's 4.2 m wall left seams behind an 11 m house, so the wall is hidden
   (an open paper floor) and the house stands behind the bench; the gable roof crossed the title, so the roof is flat
   with the pump standing on it; the straw widened to read at phone size; the hook reframed so the pump clears the
   title; the readout moved clear of the pipe in the boil close-up; the measure's notes leave 0.3 s before the cut.
   HUD audit (every 0.25 s): 0 overlaps.
5. **Final-tier stills** (`stills-ep06.jpg`, eleven), looked at 390 px wide: the boiling froth was too small to read
   on "boils"; the bubbles were enlarged (still only in the top 1.4 cm).
6. **Final**: one run, 33 min, no restarts.

## Noted, not fixed
- The open paper floor meets the paper sky at a soft horizon behind the bench; it reads as ground and sky.
- The climb's ghosts are small at the wide framing; the pace is badged as an illustration.

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones ("Torricelli", "room-temperature").
