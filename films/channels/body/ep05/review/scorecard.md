# Scorecard: Meanwhile, Inside No. 05, "Where breath goes" (final)

Measured on the delivered file `out/meanwhile-inside-005-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2232 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 4.13 Mbps video, 41.0 MB |
| Length | 60–75 s; picture = sound | 74.400 s / 74.400 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the cluster of air sacs wrapped in capillaries, the title "Where breath goes" and the readout "air sacs in your lungs: ?". "Where does your breath go?" is spoken by 1.5 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 2.3 LU |
| Voice over music | ≥ 10 LU | 15.9 LU (dialogue −13.5, music −29.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.9; mono loss 0.03 dB (dialogue 0.1 dB) |
| Sound sync | transients within a frame | 12 kinds, 45 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 47 ms |
| Labels vs picture | sound on the first visible frame | 15/16 exact (DOM-measured first visible frame); the 16th, the court's impact, lands with the court lines as they draw in, 4 frames before their label (by design) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2232 frames |
| Flashing | ≤ 3 flashes a second | 3 large-area luminance changes (frames 155, 915, 2173), 1 flash pairs, worst 1/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.4 h for 2232 frames (3.88 s/frame, K avg 2.6, max 12) |

## Review rounds
1. **Script review** (independent, before voicing) and **voiced lint**: 0 errors before and after voicing.
2. **Visual review** (four lenses, 26 Oct; each finding verified): the route lighting fork by fork, the wall at true
   scale, the court inside the safe box, pink kept on blood.
3. **Fact-check audit** (independent, 26 Oct): "clotted blood" (the old idea), "an animal's lung", "Over much of it …
   under half a micrometre", "about seventy", "About a quarter" of a full doubles court; c4, c7 re-sourced, c9 given
   West's range, c10 the ITF Rules of Tennis. Three lines re-voiced; the other five came back byte-identical.
4. **Frame review** (three lenses, 26 Oct; each finding verified): the thickened wall slows the oxygen's crossing
   (Fick) instead of piling it up; the capillary anchors on a capillary; the route dims once lit; labels point at what
   they name ("oxygen", "you, to scale", "a doubles tennis court", "white blood cell"); the area readout held "folded
   in your chest, about" through the takeaway; the windpipe, tips, wall and meanwhile camera keys; badges merged so no
   corner holds more than two.
5. **Re-check** (24 frames) and **ten final-tier stills** from the delivered file (`stills-ep05.jpg`).
6. **Final**: 2.4 h, one run, no resume.

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
