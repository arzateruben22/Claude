# Scorecard: Meanwhile, Inside No. 06, "The exit" (final)

Measured on the delivered file `out/meanwhile-inside-006-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.
The delivered file carries the written-number captions ("In 1867", "about 8 micrometres", "More than 10 million"):
chunks 0, 1, 2 and 6 were rendered again with them after the full final (27 Oct), the other four kept.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2232 frames, H.264 High BT709, AAC 48 kHz stereo 261k, 3.29 Mbps video, 33.1 MB |
| Length | 60–75 s; picture = sound | 74.400 s / 74.400 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: one neutrophil caught halfway through a seam in a venule wall, its nucleus pinched at the waist, and the title "The exit". "How does this cell leave your blood?" is spoken by about 1.9 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 2.6 LU |
| Voice over music | ≥ 10 LU | 16.0 LU (dialogue −13.4, music −29.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.9; mono loss 0.02 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 11 kinds, 36 events, all PASS: transients worst 10 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 47 ms |
| Labels vs picture | sound on the first visible frame | 5/5 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over the full run (2232 frames) and 0 over each of the four chunks rendered again for the captions |
| Flashing | ≤ 3 flashes a second | 12 large-area luminance changes (frames 155, 157, 158, 357, 358, 774), 7 flash pairs, worst 2/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.5 h for 2232 frames (4.07 s/frame, K avg 3.0, max 12); the caption fix's four chunks 1.5 h more |

## Review rounds
1. **Script review** (independent, before voicing) and **voiced lint**: 0 errors before and after voicing.
2. **Fact-check audit** (independent, 26 Oct): the tease asks "What sets off nearly every heartbeat you have?" (the
   embryo's first beats and ectopic beats are not the SA node's; the bible's row 7 says so); "past" pinned in `pron.json`.
3. **Frame review** (three lenses, 26 Oct; each finding verified): the tally parked under the title and lit only for
   the meanwhile, hidden for the engraving and the whoa; the title on its own plate; the engraving clipped to its
   plate; the "grips" label timed to the switch and held off during the faulty cell; the faulty cell rolls on past the
   seam at a steady pace; labels anchored on what they name; camera keys for the why, the finger and the
   tease; the stakes badged "illustration: rare inherited condition".
4. **Re-check** in a browser, then **cues and soundtrack** (sync PASS, −14.1 LUFS, 16.0 LU over music).
5. **Final**: 2.5 h, one run; then the caption fix (four chunks, 1.5 h), assembled with the soundtrack's mix.
6. **Ten final-tier stills** from the delivered file (`stills-ep06.jpg`, at 0, 9.5, 19.5, 22.5, 32, 42, 50, 58, 66
   and 72 s), each looked at; the changed captions read cleanly. For a human eye: at 9.5 s and 32 s a red cell drifts
   behind the dimmed tally readout and shows through its panel.

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
