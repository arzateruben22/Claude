# Scorecard: Meanwhile, Inside No. 03, "The jump" (final)

Measured on the delivered file `out/meanwhile-inside-003-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2244 frames, H.264 High BT709, AAC 48 kHz stereo 263k, 1.74 Mbps video, 18.8 MB |
| Length | 60–75 s; picture = sound | 74.800 s / 74.800 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: a spark mid-leap between two gaps of a myelinated fibre, the readout "how fast is this spark? ? m/s", the title "The jump". "How fast is this spark?" is spoken by 1.8 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 2.4 LU |
| Voice over music | ≥ 10 LU | 15.9 LU (dialogue −13.5, music −29.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.9; mono loss 0.07 dB (dialogue 0.08 dB) |
| Sound sync | transients within a frame | 9 kinds, 83 events, all PASS: transients worst 9 ms; slow swells (section, swell) worst 57.5 ms |
| Labels vs picture | sound on the first visible frame | 17/17 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2244 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.9 h for 2244 frames (4.58 s/frame, K avg 3.2, max 12) |

## Review rounds
1. **Script review** (independent, before voicing): the 25 Oct fixes (Helmholtz's method; "faster" hedged; the F1
   comparison; the spine to toe locator).
2. **Voiced lint**: one sentence at a time with measured pauses; 0 errors before and after voicing.
3. **Visual review** (four lenses, 26 Oct; each finding verified): the race, the hook's spike train, the drum, the
   readout colours, the body figure.
4. **Fact-check audit** (independent, 26 Oct): no "longest" (spine to toe), "thick wrapped" fibres drawn thicker in
   the race, "your fibres", "faster fibres"; four lines re-voiced.
5. **Frame review** (three lenses, 26 Oct; 27 findings verified): the drum rig mirrored so its traces read left to right
   in time (the far twitch lands later); its badges split ("illustration · delay exaggerated", "slowed"); frame 0's
   spark inside the safe box; labels moved off their subjects; the race's "thick wrapped fibre" pill lifted over the
   pulses (an opt-in kit `lift`); "wrapped fibre · F1 record: 373" names whose 540 km/h it is; the tally "a heart at
   rest, as you watched"; the ECG in the signal colour; the tease lands on "the end of the line". The title's pulse
   line, which had been scaled into a thick bar behind the hook's readout, pinned to its width.
6. **Re-check** (33 frames after the fixes) and **ten final-tier stills** from the delivered file (`stills-ep03.jpg`).
7. **Final**: one run, 2.9 h.

## Noted, not fixed
- The race's readout counts from 1 to 150 m/s under "thick wrapped fibres, up to" (it rolls up from the bare speed).
- The race and the drum are illustrations: speeds slowed, distances compressed, the drum's delay exaggerated (badged).

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
