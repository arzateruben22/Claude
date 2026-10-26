# Scorecard: Rest Frame No. 005, "The spinning chair" (final)

Measured on the delivered file `out/rest-frame-005-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2008 frames, H.264 High BT709, AAC 48 kHz stereo 258k, 5.06 Mbps video, 44.6 MB |
| Length | 60–75 s; picture = sound | 66.933 s / 66.933 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: from above, the mannequin on the swivel chair mid-pull, the dumbbells' ghost spiral curling in, the title in the air. "Why does it speed up?" is spoken by 1.30 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −2.0 dBTP**, LRA 4.5 LU |
| Voice over music | ≥ 10 LU | 20.9 LU (dialogue −13.6, music −34.5 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.95; mono loss −0.25 dB (dialogue 0.07 dB) |
| Sound sync | transients within a frame | 13 kinds, 40 events, all PASS: transients worst 0 ms; slow swells (energy.loss, reveal, section, swell, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 8/8 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2008 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 7 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.6 h for 2008 frames (1.15 s/frame, K avg 6.0, max 12) |

## Review rounds
1. **Script review** (independent, before voicing): its fixes were applied before the voice was locked (25 Oct,
   a3a3b4f): the arms counted in the spin model, and "outside" for the torque (nothing outside pushed).
2. **Build and recheck** (26 Oct): the direction and scene written; captions break at phrases; the spine readout pinned
   to the safe line; the model note as a card; HUD audit clean.
3. **Fact audit** (the coordinating session, 26 Oct): "Nothing motorized." in the hook, the record re-voiced ("The
   record, set by a young Canadian skater: three hundred forty-two turns a minute. Nearly six turns a second."), the
   whoa's camera keyed on "record,"; US spelling in the tease and end card; lint 0 errors before and after.
4. **Rule 8, "One line wins"** (an implementer, an independent reviewer and a fixer): the review's must-fix split the
   whoa's spine so the record's label arrives with its number; the never-shown "easier to turn" label (and its orphan
   sound) removed; "18°" leaves on "Arms in". The chair and the ghost ladders step back through `set/aces.js`
   `screenAlpha`, so a third keeps a third of the contrast on screen (opacity 1/3 had kept about a tenth).
5. **HUD audit and stills** (every 0.25 s, the whole film: 0 issues; sixteen final-tier stills looked at 390 px wide):
   the whoa's readout read "spin rate 80 rpm" just as the ink skater came in, as if it were hers; it now reads "your
   spin, arms in" until "three".
6. **Soundtrack**: sync failed on the loop's last ghost click, scheduled on the film's last frame (two more were past
   the end); the clicks now stop 0.15 s before the end. −14.1 LUFS, −2.0 dBTP, sync PASS.
7. **Final**: one run, 40 min, no restarts.

## Noted, not fixed
- The chair at a third keeps its full-strength floor shadows (the cyc's casters have no strength setting).
- The whoa's skater is an ink illustration ("Illustration", 4 s); her spin is drawn with motion arcs, not to the 342 rpm.

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones ("Nothing motorized", "three hundred forty-two").
