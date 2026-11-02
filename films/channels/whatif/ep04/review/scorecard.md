# Scorecard: Back of the Envelope No. 004, "Count to a billion" (final)

Measured on the delivered file `out/envelope-004-9x16.mp4` by `kits/cinema/film/qa.py` (PASS) and `scorecard.py`,
unless noted. Rendered by the render worker (commit 054ee8d) from 3b5dcb7 with the committed soundtrack.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2214 frames, H.264 High BT709, AAC 48 kHz stereo 272k, 4.3 Mbps video, 42.2 MB |
| Length | 60–75 s; picture = sound | 73.800 s / 73.800 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 4.7 LU |
| Voice over music | ≥ 10 LU | 13.4 LU (dialogue −13.7, music −27.1 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.88; mono loss 0.17 dB (dialogue 0.07 dB) |
| Sound sync | transients within a frame | 9 kinds, 57 events, all PASS: transients worst 1 ms; slow swells (swell) worst 36 ms |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: you at the foot of the counting tape (slips 1, 2, 3), the title; "Can you count to a billion?" spoken by 1.4 s |
| Text in the safe box | x 90–900, y 250–1420 | The worker's render audit: PASS; every caption page, label and counter checked in stills during review (two rounds) |
| Delivery sizes | | Master 42.2 MB; YouTube 1440 version 64.5 MB; poster and contact sheet in `out/` |

## Compelling pass (independent review, 1–5)
| Point | Round 1 | Round 2 (final) |
|---|---|---|
| First 2 seconds | 3 | 4 |
| One thread | 4 | 4 |
| Picture moves with the sentence | 3 | 4 |
| Every move motivated | 3 | 4 |
| Voice carries meaning, screen the figures | 3 | 4 |
| Rhythm | 4 | 4 |
| Ending, callback, tease | 3 | 5 |

## Review rounds
See `REVIEW.md` (12 findings in round 1, 6 in round 2, all fixed and checked in stills), then the shared spine.js
flicker fix and the larger work-card text merged before the final.
