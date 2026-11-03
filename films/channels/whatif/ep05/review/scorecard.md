# Scorecard: Back of the Envelope No. 005, "Everybody jump" (final)

Measured on the delivered file `out/envelope-005-9x16.mp4` by `kits/cinema/film/qa.py` (PASS) and `scorecard.py`,
unless noted. Rendered by the render worker (commit a65c3c9) from c991e60 with the committed soundtrack.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2196 frames, H.264 High BT709, AAC 48 kHz stereo 270k, 3.97 Mbps video, 38.9 MB |
| Length | 60–75 s; picture = sound | 73.200 s / 73.200 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 3.9 LU |
| Voice over music | ≥ 10 LU | 13.6 LU (dialogue −13.6, music −27.2 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.15 dB (dialogue 0.08 dB) |
| Sound sync | transients within a frame | 9 kinds, 38 events, all PASS: transients worst 0 ms; slow swells (swell) worst 37 ms |
| Flashing | ≤ 3 flashes a second | 1 large-area luminance change (frames 1198), 0 flash pairs, worst 0/s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: you on the model Earth, the title; "Would the Earth move?" spoken by 1.1 s |
| Text in the safe box | x 90–900, y 250–1420 | The worker's QA: PASS; every caption page, label and counter checked in stills over three review rounds |
| Delivery sizes | | Master 38.9 MB; YouTube 1440 version 57.1 MB; poster and contact sheet in `out/` |

The one large-area change (frame 1198, 25% of the frame) is the single cut into the dive; it is not a flash.

## Compelling pass (independent review, 1–5); No. 004 for the ratchet: 4, 4, 4, 4, 4, 4, 5
| Point | Round 1 | Round 2 | Round 3 (final) |
|---|---|---|---|
| First 2 seconds | 3 | 4 | 4 |
| One thread | 4 | 4 | 4 |
| Picture moves with the sentence | 2 | 3 | 4 |
| Every move motivated | 2 | 3 | 4 |
| Voice carries meaning, screen the figures | 4 | 4 | 4 |
| Rhythm | 4 | 4 | 4 |
| Ending, callback, tease | 4 | 4 | 5 |

## Review rounds
See `REVIEW.md` (round 1 led to the rebuild around the model Earth; rounds 2 and 3 fixed and checked in stills).
