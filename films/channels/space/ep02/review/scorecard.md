# Scorecard: Light Minute No. 002, "The nearest star" (final)

Measured on the delivered file `out/lightminute-002-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 1.13 Mbps video, 13.1 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the speck that holds Voyager 1 beside the Sun, Proxima Centauri far off, the spine reading "4.24 light-years". "How long to the nearest star?" is spoken by 1.87 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 1.9 LU |
| Voice over music | ≥ 10 LU | 12.2 LU (dialogue −14.1, music −26.3 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.77; mono loss 0.45 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 9 kinds, 45 events, all PASS: transients worst 2 ms; slow swells (light.front, scale.jump, section) worst 49.4 ms |
| Labels vs picture | sound on the first visible frame | 17/17 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2240 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2240 frames (0.81 s/frame, K avg 2.2, max 12) |

Notes on the numbers:
- **Voice over music is 12.2 LU**, comfortably over the gate.
- **Flashing:** no frame changes luminance over more than 1% of the screen. The two zooms and the signal fronts stay small.
- **Render cost:** 31 min on this box (0.81 s a frame); K reaches 12 only in the jump to Proxima.

## Review rounds
1. **Script:** an independent review (retention 6/10) found the why's logic broken ("Not even close" answered with a speed ratio),
   the trip time out of step with its own arithmetic (73,000 vs 74,800 years), "forty-nine years … one day of light" repeating the
   change, a weak takeaway, and a tease that called Venus's day "longer than its year" (its sunrise-to-sunrise day is shorter).
   Fixed: the why now turns on the comet cloud (300 years away, 30,000 to cross), the trip is "about seventy-five thousand years"
   (computed) with an "at today's distance" note, "our species hadn't reached Europe" replaces the Neanderthal line, the takeaway
   is "day one of fifteen hundred", and the tease is "a world that turns slower than it orbits. And backwards."
2. **Picture rules** (WRITING.md "The picture", merged from the coordinating session on 25 Oct): a spine readout added, the end
   card's footnote, energies building to the whoa and dropping for the takeaway; the end card sits on the hook's composition.
3. **Stills (final tier, 12 + 4 checks):** Voyager's label left the safe box during the flight (the camera now pulls back with
   Voyager's distance), the trip counter was clipped at the left, the readout value overran the safe box, the heliopause label sat
   on the spine; all fixed before the final. `review/stills-ep02.jpg`.
4. **Final:** rendered in one pass, 22:15–22:46 UTC, 25 Oct; QA PASS.

## Not measured here
- An astronomer's sign-off on the claims and pictures: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
