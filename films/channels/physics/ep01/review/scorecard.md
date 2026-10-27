# Scorecard: Rest Frame No. 001, "Thrown or dropped?" (final)

Measured on the delivered file `out/rest-frame-001-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2248 frames, H.264 High BT709, AAC 48 kHz stereo 259k, 2.91 Mbps video, 29.8 MB |
| Length | 60–75 s; picture = sound | 74.933 s / 74.933 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 3.4 LU |
| Voice over music | ≥ 10 LU | 21.0 LU (dialogue −13.9, music −34.9 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.11 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 11 kinds, 81 events, all PASS: transients worst 0.1 ms; slow swells (reveal, section, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 20/20 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2248 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 1.1 h for 2248 frames (1.78 s/frame, K avg 2.2, max 12) |

v3.1, 26 Oct 2026: readability kit (round 767b57b) + the 26 Oct fact audit's fixes + label polish (independently checked). Rendered 15:51–18:06 UTC, resumed once after a container restart with the same code (no mixed versions).
