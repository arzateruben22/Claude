# Scorecard: Back of the Envelope No. 006, "Every raindrop at once" (final)

Measured on the delivered file `out/envelope-006-9x16.mp4` by `kits/cinema/film/qa.py` (PASS) and `scorecard.py`,
unless noted. Final rendered from f74d471 (scene, compile and soundtrack unchanged since) with the committed soundtrack.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2196 frames, H.264 High BT709, AAC 48 kHz stereo 271k, 5.74 Mbps video, 55.0 MB |
| Length | 60–75 s; picture = sound | 73.200 s / 73.200 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.5 dBTP**, LRA 4.3 LU |
| Voice over music | ≥ 10 LU | 12.9 LU (dialogue −13.7, music −26.6 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.87; mono loss 0.24 dB (dialogue 0.07 dB) |
| Sound sync | transients within a frame | 8 kinds, 32 events, all PASS: transients worst 0 ms; slow swells (swell) worst 37 ms |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2196 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: you in the rain, the title; "A day's rain, all at once?" spoken inside 2 s |
| Delivery sizes | | Master 55.0 MB; YouTube 1440 version 56.4 MB; poster and contact sheet in `out/` |

## Compelling pass (independent review, 1–5); No. 005 for the ratchet: 4, 4, 4, 4, 4, 4, 5
| Point | Round 1 | Round 2 | Round 3 | Final file |
|---|---|---|---|---|
| First 2 seconds | 4 | 4 | 4 | 4 |
| One thread | 4 | 4 | 4 | 4 |
| Picture moves with the sentence | 2 | 3 | 4 | 4 |
| Every move motivated | 2 | 3 | 4 | 4 |
| Voice carries meaning, screen the figures | 4 | 4 | 4 | 4 |
| Rhythm | 4 | 4 | 4 | 4 |
| Ending, callback, tease | 3 | 4 | 4 | **5** |

### Ending re-scored on the final (frames 67.6, 68.5, 69.5, 71.0, 73.1 s)
The payoff "≈ 3 mm" stays boxed in marker at the top of the card; under it the tease title "Next envelope: walking to
the Moon", and the footprint trail steps out left to right on "how long to walk" and reaches the Moon, which lights
on "Moon?" (69.5–71 s). The card then lifts over the last 0.6 s back to you in the rain, frame 0, so the loop closes.
Payoff, callback (the coins' 3 mm) and a tease with a picture of its own: **5**, which matches No. 005 and keeps the
ratchet. Residual note, not a fix: the Moon glyph is small (about a twentieth of the frame width); it reads on a
phone at arm's length in the stills, but it would be the first thing to grow if the card is ever revisited.

## Review rounds
See `REVIEW.md` (three rounds, every finding fixed and checked in stills).
