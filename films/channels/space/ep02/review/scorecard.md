# Scorecard: Light Minute No. 002, "The nearest star" (final)

Measured on the delivered file `out/lightminute-002-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2240 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 1.7 Mbps video, 18.4 MB |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the speck that holds Voyager 1 beside the Sun, Proxima Centauri far off, the spine reading "4.24 light-years". "How long to the nearest star?" is spoken by 1.87 s |
| Length | 60–75 s; picture = sound | 74.667 s / 74.667 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.8 dBTP**, LRA 1.9 LU |
| Voice over music | ≥ 10 LU | 12.2 LU (dialogue −14.1, music −26.3 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.77; mono loss 0.45 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 9 kinds, 44 events, all PASS: transients worst 24 ms; slow swells (light.front, scale.jump, section) worst 49.4 ms |
| Labels vs picture | sound on the first visible frame | 14/14 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2240 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2240 frames (0.76 s/frame, K avg 2.2, max 24) |

Notes on the numbers:
- **Voice over music is 12.2 LU**, comfortably over the gate.
- **Flashing:** no frame changes luminance over more than 1% of the screen. The two zooms and the signal fronts stay small.
- **Render cost:** the 26 Oct re-render took 30 min on this box (0.76 s a frame); K reaches 24 only in the jump to Proxima
  (24 motion-blur sub-frames there, up from 12, so the comet points streak smoothly instead of as dotted rows).
- **Bitrate:** 1.7 Mbps video at CRF 15 with aq-mode 3 (the kit's sharper master since the readability pass), up from 1.13.

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
5. **Recheck (26 Oct; the owner asked for every episode to be rechecked and re-rendered).** An independent frame review
   (40 findings, every one checked here against the frames) and the coordinating session's readability pass (767b57b).
   Fixed: the change showed the signal going out on "Its signal now needs a full day to reach us"; it now comes home,
   then the command goes out and the answer comes back, in step with the voice. The light-day circle, the fronts and the
   heliopause rim are screen circles through Voyager as seen (they were lopsided ellipses off the Sun, cropped by the
   frame), with the Sun eased toward the middle so they fit. The spine and readout sit on a plate (fronts and the lane
   pass behind them), never overprint (0.4 s between values), and swap on the right words (the readout swapped on the
   "to" of "Earth to Voyager"); the year counter starts as "nineteen seventy-seven" is spoken; "300" waits for "three
   hundred"; the spine rests through the jump. Pills moved below the captions (they covered the Sun); duplicate labels
   (300 years, 30,000 more, of about 1,550, the ring's 4 years 3 months) removed; Voyager is marked at the comet cloud's
   scale; a light pulse runs the lane on "fifteen hundred"; the comet cloud thins through the jump and is gone by the
   takeaway (and from the hook and end, so the loop matches); the hook's Proxima and dashed lane are bigger; captions
   keep number phrases on one line; the end card's title fits its ring and sits on a dimmed Sun; the footnote is larger.
   Re-rendered fresh 04:16–04:46 UTC, 26 Oct; QA PASS.

## Not measured here
- An astronomer's sign-off on the claims and pictures: `review/CLAIMS-REVIEW.md` and `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
