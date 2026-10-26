# Scorecard: Rest Frame No. 004, "The hammer and the feather" (final)

Measured on the delivered file `out/rest-frame-004-9x16.mp4` by `kits/cinema/film/qa.py` and `scorecard.py`, unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 2168 frames, H.264 High BT709, AAC 48 kHz stereo 258k, 4.44 Mbps video, 42.5 MB |
| Length | 60–75 s; picture = sound | 72.267 s / 72.267 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the hammer and the feather side by side above the Moon's floor, ghost rows level, the title in the air. "Which lands first?" is spoken by 1.38 s |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −2.0 dBTP**, LRA 5.0 LU |
| Voice over music | ≥ 10 LU | 21.2 LU (dialogue −13.8, music −35.0 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.96; mono loss −0.16 dB (dialogue 0.06 dB) |
| Sound sync | transients within a frame | 13 kinds, 58 events, all PASS: transients worst 0 ms; slow swells (reveal, section, swell, time.slow) worst 0 ms |
| Labels vs picture | sound on the first visible frame | 7/7 exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 2168 frames |
| Flashing | ≤ 3 flashes a second | 0 large-area luminance changes (frames none), 0 flash pairs, worst 0/s |
| Determinism | resumable, byte-stable | 8 chunks, every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 0.5 h for 2168 frames (0.88 s/frame, K avg 2.1, max 8) |

## Review rounds
1. **Script review** (independent, before voicing): its fixes were applied before the voice was locked (25 Oct,
   00274e2).
2. **Animatic rounds** (25–26 Oct): the bench camera lowered and widened so the drop sits between the readout and the
   captions; MICROSCOPE as a card; Earth labeled at its center; the labels and notes kept off the readout.
3. **Recheck pass** (26 Oct, at the user's request): captions break at phrases; the spine readout pinned to the safe
   line with a wrapping label.
4. **Fact audit** (the coordinating session, 26 Oct): "The feather? Still drifting down." (52 cm of 160 when the hammer
   lands, at a 100 cm/s terminal speed), "Gravity speeds them up equally.", the "< 5" readout for MICROSCOPE's parts in a
   million billion; the changed lines re-voiced (lint 0 errors before and after).
5. **Rule 8, "One line wins"** (an implementer, an independent reviewer and a fixer): the reviewer's must-fix restored
   the Moon floor (`scene.add` sat inside a comment); stepped-back props and ghost rows mix toward the paper on screen
   (a display-space shader), ink and arrows by their color, so a third keeps a third of the contrast; the Earth rows
   held at a third through the Moon setup; "Illustration" (the drift) and "Not to scale" kept to their beats; the pull
   arrows step back on "But".
6. **HUD audit and stills** (every 0.25 s, the whole film; thirteen final-tier stills looked at 390 px wide):
   - the why's pill "gravity: far stronger on the hammer" (750 px) ran into the readout for 2 s: now "pulled far harder";
   - the force arrows were hidden by the hammer's own handle (they started at its head and ran down the handle): they
     now start just under each object;
   - a right-side pill could not fit beside the hammer and was clamped back over its arrow: both pills sit left of
     their arrows, and "same acceleration" became "same speed-up" (the narration's "harder to speed up") so it fits
     beside the feather's arrow;
   - "still drifting" starts on the spoken "Still" (1.4 s on screen instead of 0.7).
7. **Soundtrack**: the native AAC encoder rang on vo01's "s" ("lands") to +3.1 dBTP while the WAV peaked at −4.3;
   vo01 sits 0.5 dB lower in the mix and the AAC lands at −2.0. The studio could not read the counter tick's tag
   ("m/s²": ² is a digit to `isdigit` but not to `int`); the tag is written with a plain 2.
8. **Final**: one run, 33.5 min, no restarts. Stills of the delivered contact sheet looked at again: nothing new.

## Noted, not fixed
- The whoa's readout shows "< 5" (parts in a million billion) from the cut, before the narration reaches the number;
  it lights on "a few parts in a million billion".
- A stepped-back hammer or feather keeps its full-strength contact shadow (the cyc's casters have no strength setting).

## Not measured here
- A physicist's sign-off on the claims and pictures: `CLAIMS-REVIEW.md`, `HUMAN-REVIEW.md`.
- A listen on a phone speaker and on headphones ("geology hammer", "MICROSCOPE", "Still drifting down").
