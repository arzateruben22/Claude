# Scorecard: Light Minute No. 001, "If the Sun vanished" (final)

Measured on the delivered file `out/lightminute-001-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 2.86 Mbps video, 29.2 MB |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: Earth (labelled) on its orbit, with the title. "What if the Sun vanished?" is spoken by 1.95 s, and "How soon would you know?" by 3.4 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 1.6 LU |
| Voice over music | ≥ 10 LU | 10.7 LU (dialogue −14.2, music −24.8 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.76; mono loss 0.38 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 10 kinds, 54 events, all PASS: transients worst 0.7 ms; slow swells (body.vanish, light.front, merge, scale.jump, section) worst 57 ms |
| Labels vs picture | sound on the first visible frame | 18/18 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2240 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.9 h for 2240 frames (1.47 s/frame, K avg 2.5, max 12) |

Notes on the numbers:
- **Voice over music is 10.7 LU**, the thinnest margin of the four films (the gate is 10). The
  `lightminute-vacuum` drone is meant to sit close under the voice. Listen on a phone speaker: if the
  words feel crowded, lower the drone 2 dB in the preset and re-master. That re-renders only the sound,
  not the picture.
- **Photosensitivity** (the README's open item): no frame changes luminance over more than 3% of the
  screen. The Sun's vanishing, its return, the kilonova and Earth's darkening all stay small.

## Review rounds
1. Episode build: the animatic, ten final-tier stills and a draft preview with the mastered
   soundtrack were reviewed shot by shot. The verdict was go, with fixes.
2. Fixes before the final (commit 29d4e70):
   - Earth is named on frame 0. The opening frame had read as abstract rings.
   - The galaxy carries an "illustration" badge.
   - The end card uses the channel's "Next light:".
   - Anisotropic filtering is off. In SwiftShader it made pixels depend on render order, which breaks
     byte-stable resume.
3. Final: rendered in one pass, 00:28–01:25 UTC, 24 Oct.

## Not measured here
- An astronomer's sign-off on the claims and pictures: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones (see the voice-over-music note).
