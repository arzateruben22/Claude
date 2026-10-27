# Scorecard: Light Minute No. 006, "Your speed" (final)

Measured on the delivered file `out/lightminute-006-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 6.67 Mbps video, 64.7 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: Earth turning under the "you" pin on the equator, the spine asking "your speed right now ?". "How fast are you moving now?" is spoken by 1.6 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 1.9 LU |
| Voice over music | ≥ 10 LU | 12.3 LU (dialogue −14.1, music −26.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.78; mono loss 0.4 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 5 kinds, 26 events, all PASS: transients worst 2 ms; slow swells (scale.jump, section) worst 30.9 ms |
| Labels vs picture | sound on the first visible frame | 7/7 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings in each of the 8 chunk runs (the whole film); every label, counter, note and caption page checked at its middle and ends (156 moments): none outside the box, none on other text |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.7 h for 2240 frames (1.13 s/frame, K avg 2.5, max 12) |

## Review rounds
1. **Script:** reviewed and fixed before voicing (the hook asks the question the takeaway answers; one number per
   sentence; Ptolemy's "birds and clouds left behind" as the wrong idea, Galileo's 1632 cabin as the answer).
2. **Recheck and script audit (26 Oct):** "you" stand on the equator in Ecuador, drawn on the side facing the camera;
   Earth comes back after the orbit view; the coordinating session's script audit applied (the why beat's spine heading,
   Ptolemy re-sourced; no line re-voiced).
3. **Draft review, round 1 (26 Oct):** an independent two-lens review of a draft cut (text/layout and picture), every
   finding verified by a second agent: 30 confirmed. Galileo's cabin is drawn as an inset (ship, cutaway cabin, bowl and
   fish, drops, butterflies, a lurch on "jolt"), the jump passes through a cloud of nearby stars instead of an empty
   frame, the galaxy turns on its own clock, labels moved off the Sun and the lap.
4. **Draft review, round 2 (26 Oct):** 26 confirmed. Earth really dims behind the cabin (through its own shader) and
   its spin waits there; the jump holds on the Sun among its neighbours; the lap reads lilac (kept under the bloom's
   knee); "230 million" for the lap; the equator drawn on "at the equator"; the light's front at one speed; the end
   card over a quieter galaxy; captions re-glued ("about two hundred thirty / kilometers a second."); after the stills,
   the star cloud fades before it shrinks into a knot. Stills at 1080 after each round; every label, counter, note and
   caption page checked at its middle and ends (156 moments): no text outside the safe box, none on other text.
5. **Final:** rendered 19:15–20:02 UTC, 26 Oct, one 10 s chunk at a time; QA PASS. The delivery file runs 6.7 Mbps
   (the star fields, the galaxy and Earth's texture cost bits; other episodes are mostly dark diagrams).
