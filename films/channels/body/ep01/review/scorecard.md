# Scorecard: Body Backstage No. 01, "Single file" (season 1 reboot, live scan): final

Measured on the delivered file `out/body-backstage-001-9x16.mp4` by `kits/cinema/film/qa.py` (PASS) and
`scorecard.py`. Rendered at the final tier from commit 577eaa9 by four render workers, split by time range
(W1 0–20 s c292f88, W2 20–40 s ee50a70, W3 40–60 s 1d7199d, W4 60–70.4 s 7f50d89; identical code and page hashes),
assembled with `sound/body-backstage-001-mix.m4a`. The delivery is encoded at CRF 20, the lowest CRF under 95 MB:
CRF 15 was 165.7 MB and CRF 19 was 100.8 MB.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2112 frames, H.264 High BT709, AAC 48 kHz stereo 263k, 10.19 Mbps video, 92.0 MB |
| Length | 60–75 s; picture = sound | 70.400 s / 70.400 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.7 dBTP**, LRA 3.3 LU |
| Voice over music | ≥ 10 LU | 16.0 LU (dialogue −13.4, music −29.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.89; mono loss 0.11 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 12 kinds, 34 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 57.5 ms |
| Labels vs picture | sound on the first visible frame | 9/9 exact (DOM-measured first visible frame) |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |

## Compelling pass (independent review, REVIEW.md, four rounds)
| Point | R1 | R2 | R3 | R4 (final) |
|---|---|---|---|---|
| a First 2 seconds | 2 | 3 | 4 | 4 |
| b One thread | 3 | 3 | 3 | 3 |
| c Picture moves with the sentence | 3 | 3 | 3 | 3 |
| d Every move motivated | 3 | 3 | 3 | 3 |
| e Voice carries meaning, screen the figures | 3 | 4 | 4 | 4 |
| f Rhythm | 3 | 3 | 3 | 3 |
| g Ending, callback, tease | 3 | 3 | 4 | 4 |
| h Production value | 2 | 3 | 3 | 4 |

The gate is met: no score is under 3, (a), (g) and (h) are at 4, and nothing factual is open. Voice: the stray
syllables are fixed in the voice itself ("It barely does." replaces "It can't."; a lead-in gate on vo03 and vo07),
and the recognizer hears every line cleanly.

Known polish, not blocking:
- the sickle cell is not wedged on "jam"
- the "tiniest pipe" label
- the meanwhile beat has no picture of its own
- small HUD crowding at 55 s
- the tease caption reads "1 billion" where "a billion" is said (the numerals pass)
