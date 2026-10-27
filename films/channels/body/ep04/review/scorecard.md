# Scorecard: Meanwhile, Inside No. 04, "The gap" (final)

Measured on the delivered file `out/meanwhile-inside-004-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2232 frames, H.264 High BT709, AAC 48 kHz stereo 262k, 2.59 Mbps video, 26.6 MB |
| Length | 60–75 s; picture = sound | 74.400 s / 74.400 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: two nerve endings meeting, seemingly joined, in a soft light-microscope blur; the title "Do they touch?" and the readout "touching: ?". "Do your nerve cells touch?" is spoken by 1.6 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 2.8 LU |
| Voice over music | ≥ 10 LU | 16.0 LU (dialogue −13.4, music −29.4 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.9; mono loss 0.04 dB (dialogue 0.09 dB) |
| Sound sync | transients within a frame | 12 kinds, 50 events, all PASS: transients worst 9 ms; slow swells (breath, diffuse, dissolve, section, swell) worst 57.5 ms |
| Labels vs picture | sound on the first visible frame | 8/8 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2232 frames |
| Flashing | ≤ 3 flashes a second | 2 large-area luminance changes (frames 2041, 2171), 1 flash pairs, worst 1/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2.5 h for 2232 frames (4.02 s/frame, K avg 2.6, max 12) |

## Review rounds
1. **Script review** (independent, before voicing; 25 Oct fixes) and **voiced lint**: 0 errors before and after voicing.
2. **Visual review** (four lenses, 26 Oct; each finding verified): the joined-looking hook, the field's used junction,
   the gap readout, the bursts, the panels, the electricity pull-out.
3. **Fact-check audit** (independent, 26 Oct): the electron-microscope-style view badged "illustration · not to scale"
   through its replay; "Through a lens, they look joined" (new c17); "Camillo Golgi, who made the stain…"; "A typical
   nerve cell reaches thousands of others"; "touching: ?"; c3 and c12 re-sourced. Two lines re-voiced.
4. **Frame review** (three lenses, 26 Oct; each finding verified): the chemical messenger was never drawn (its mesh
   was never added to the scene: a bug) and now drifts across the gap; the handoff readout holds 0.001 s through the
   whoa and the takeaway ("timed" while counting, then "about"); notes, labels and readouts clear of each other and of
   what they name; the camera on the junction as it is named; Golgi's reading steps back as Cajal's arrives; the
   axon's glow dims once it has arrived; the depth target read texel by texel (no dotted rims on blurred silhouettes).
5. **Re-check** (24 frames) and **ten final-tier stills** from the delivered file (`stills-ep04.jpg`).
6. **Final**: 2.5 h, paused by the owner about 25 min from the end and resumed from its kept frames (`--resume`;
   assembled with `--force-mixed`, the page code unchanged between the two runs).

## Not measured here
- A physiologist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones.
