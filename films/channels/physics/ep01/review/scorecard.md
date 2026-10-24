# Scorecard: Rest Frame No. 001, "Thrown or dropped?" (final)

Measured on the delivered file `out/rest-frame-001-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2248 frames, H.264 High BT709, AAC 48 kHz stereo 259k, 1.73 Mbps video, 18.7 MB |
| Length | 60–75 s; picture = sound | 74.933 s / 74.933 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: two balls mid-fall with their ghosts and the title in the air. "Which ball lands first?" is spoken by 1.7 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.0 LUFS, −2.0 dBTP**, LRA 3.6 LU |
| Voice over music | ≥ 10 LU | 20.9 LU (dialogue −13.7, music −34.6 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.95; mono loss −0.16 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 11 kinds, 79 events, all PASS: transients worst 0.1 ms; slow swells (reveal, section, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 16/16 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2248 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.9 h for 2248 frames (1.37 s/frame, K avg 2.1, max 10) |

## Review rounds
1. Episode build: the animatic, ten final-tier stills and a draft preview with the mastered
   soundtrack were reviewed shot by shot. The verdict was go, with fixes.
2. Fixes before the final (commit 29d4e70):
   - The gravity arrows now end when their tips reach the floor. Before, they shrank into it and read as gravity weakening.
   - A "0" tick marks the throw point that 20, 40 and 60 cm are measured from.
   - A label's sound landed one frame early, because its show time was rounded down. It now lands on the label's first visible frame.
3. Final: the render was paused by the user at frame 1770 and resumed on 24 October from the
   frames on disk. Every resumed frame was checked against its logged hash.

## Not measured here
- A physicist's sign-off on the claims and pictures: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
