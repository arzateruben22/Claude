# Scorecard: Light Minute No. 005, "How big is the Sun" (final)

Measured on the delivered file `out/lightminute-005-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 2.57 Mbps video, 26.6 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the Moon and the Sun side by side at their true sizes as sky twins (badged "true sizes, shown side by side"), the spine asking "Earths inside ?". "Which holds a million Earths?" is spoken by 1.9 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 1.9 LU |
| Voice over music | ≥ 10 LU | 12.4 LU (dialogue −14.1, music −26.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.76; mono loss 0.44 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 6 kinds, 30 events, all PASS: transients worst 0 ms; slow swells (scale.jump, section) worst 45 ms |
| Labels vs picture | sound on the first visible frame | 10/10 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings in each of the 8 chunk runs (the whole film); every label, counter, note and caption page checked at its middle and ends (160 moments): none outside the box, none on other text |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.7 h for 2240 frames (1.15 s/frame, K avg 2.8, max 12) |

## Review rounds
1. **Script:** reviewed and fixed before voicing (the hook's payoff "Which holds a million Earths?", one number per
   sentence, Anaxagoras's "fiery stone bigger than the Peloponnese" as the person and the wrong-size guess).
2. **Recheck and script audit (26 Oct):** the side view, the row, the sunspot, the melt and the ×7,000 ring rechecked;
   the coordinating session's script audit applied ("Bigger, yes", "seven thousand", "it's no giant"; 19 claims) and
   re-voiced.
3. **Draft review, round 1 (26 Oct):** an independent two-lens review of a draft cut (text/layout and picture), every
   finding verified by a second agent: 41 confirmed. A wide shot on "wider" puts the true-size Moon beside the Sun
   ("true sizes, not distances"); the zoom runs straight onto the sunspot; a drawn sunspot disc; the Anaxagoras card;
   a star field after the jump ("illustration · star spacing not to scale"); light drawn in the readout ("light sped
   up"); the spine re-timed to the voice. After the stills: the why beat sits lower (the card clears the Sun), the
   readout is framed wider, the push at "thousand" stays under 5% a second.
4. **Draft review, round 2 (26 Oct):** 37 confirmed. Southern Greece is drawn as its coast (×8, "map enlarged") and
   shrinks onto its true-size patch, the label's anchor on its east tip; "×7,000" arrives without a hop; the sunspot's
   Earth pill dropped (the spot's label above it); "400×" for "wider" before "400× · 400×"; the 1,000× outline leaves
   as the takeaway starts and the camera pushes in on the Sun among the stars, so Earth's orbit is 1.6–1.8× larger in
   the readout; ice beacons kept pale (no royal-blue halo); finer granulation in the close-up; the twins dimmed under
   the end card. Captions keep two number splits ("four / hundred", "one point / three million") that no glue of 24
   characters can mend. Stills at 1080 after each round.
5. **Final:** rendered in 10 s chunks, 21:01–21:21 UTC on 26 Oct and 02:18–02:57 UTC on 27 Oct (paused by the owner in
   between; the kept frames resumed); every label, counter, note and caption page checked at its middle and ends
   (160 moments): clean. QA PASS.
