# Scorecard: Body Backstage No. 02, "A billion passengers" (season 1 reboot, live scan): final

Measured on the delivered file `out/body-backstage-002-9x16.mp4` by `kits/cinema/film/qa.py` (PASS) and
`scorecard.py`. Rendered at the final tier from commit 9a2f9f4 on four render boxes, split on 10 s chunk boundaries
(lead 0–20 s; W1 20–40 s 719be49; W3 40–50 s f5958f3; W4 50–60 s 5037c8f and 60–73.2 s 6e5c2f9; identical code and
page hashes), assembled with `sound/body-backstage-002-mix.m4a`. The delivery is encoded at CRF 20, the lowest CRF under
95 MB (92.3 MB; CRF 19 would be about 101 MB, as in No. 01).

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2196 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 9.82 Mbps video, 92.3 MB |
| Length | 60–75 s; picture = sound | 73.200 s / 73.200 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 3.3 LU |
| Voice over music | ≥ 10 LU | 15.8 LU (dialogue −13.4, music −29.2 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.88; mono loss 0.09 dB (dialogue 0.1 dB) |
| Sound sync | transients within a frame | 13 kinds, 52 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 57.5 ms |
| Labels vs picture | sound on the first visible frame | 15/15 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 600 frames |
| Flashing | ≤ 3 flashes a second | 1 large-area luminance change (frames 1662), 0 flash pairs, worst 0/s |

## Compelling pass (independent review, REVIEW.md, four rounds and a follow-up)
| Point | R1 | R2 | R3 | R4 (final) |
|---|---|---|---|---|
| a First 2 seconds | 3 | 3 | 3 | 4 |
| b One thread | 4 | 4 | 4 | 4 |
| c Picture moves with the sentence | 2 | 3 | 3 | 3 |
| d Every move motivated | 3 | 4 | 4 | 4 |
| e Voice carries meaning, screen the figures | 3 | 3 | 3 | 3 |
| f Rhythm | 3 | 3 | 3 | 3 |
| g Ending, callback, tease | 3 | 3 | 3 | 4 |
| h Production value | 2 | 3 | 3 | 4 |

The gate is met: no score is under 3, (a), (g) and (h) are at 4, and nothing factual is open. The two round-4
blockers (the clipped highlight in the whoa, the skin callback's badges) are fixed (REVIEW.md, round 4 follow-up).

Known polish, not blocking:
- "Empty, it's dark red" plays over a full, bright molecule (22.0)
- the meanwhile beat has no picture of its own (62.0)
- the caption plate sits on the vein in the skin callback (53.8–55.0)
- the white bead O₂, the scan wipes and the flat fat band keep (h) from 5
