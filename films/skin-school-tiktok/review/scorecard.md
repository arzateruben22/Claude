# Scorecard: "Why does a pore clog?" (final)

Measured on the delivered file `out/skin-school-pore-9x16.mp4` unless noted.

| Gate | Target | Result |
|---|---|---|
| Format | 1080×1920, 30 fps, H.264, AAC | 1080×1920, 30 fps CFR, 1800 frames, H.264 High BT.709, AAC-LC 48 kHz stereo 256k, 3.8 Mbps video, 28.9 MB |
| Length | 60 s; picture = sound | 60.000 s / 60.000 s |
| Hook | Payoff image at frame 0; question by 2 s | Frame 0: the pore mouth with glowing oil and the title. "Every breakout starts in one place: a single pore" lands by 3.4 s (a statement hook, not a question) |
| Loudness | −14 LUFS, ≤ −1 dBTP on the AAC | **−14.1 LUFS, −1.9 dBTP**, LRA 4.4 LU |
| Voice over music | ≥ 10 LU | 14.1 LU (dialogue −13.2, music −27.3 LUFS while speaking) |
| Phone speaker | mono-safe | Correlation 0.79; mono loss 0.32 dB (dialogue 0.10 dB) |
| Sound sync | transients within a frame | 13 kinds of sound, all PASS: labels 0/1 ms, cell landings 0/0.1 ms, drops 0/0 ms; slow swells within 3 frames (oxidize 49 ms, swell 55 ms, counter chime 17 ms) |
| Labels vs picture | sound on the first visible frame | 10/10 labels exact (DOM-measured first visible frame) |
| Text in the safe box | x 90–900, y 250–1420 | Render audit: 0 warnings over 1800 frames |
| Captions fit | every line inside its plate | ≤ 24 characters a line, measured fit (scaled when needed) |
| Flashing | ≤ 3 flashes a second | 1 frame in the film with a large-area luminance jump, no flash pairs |
| Determinism | resumable, byte-stable | Rendered in 6 chunks over a worker restart (resumed at frame 360); every frame's sha256 checked against its log before encoding |
| Render cost | ≤ 4 h | 2 h 18 m of rendering for the last 1440 frames (5.7 s/frame, K avg 3.7) plus ~25 min for the first 360 |

## Review rounds
1. Preview 1: the user asked that captions fit their box and labels stop blending into the skin.
   Fixed: 24-character lines with a measured fit; solid labels with a coloured border and leader
   lines; labels never cover their own target; drop labels follow the drops.
2. Preview 2: sound confirmed playing on the user's phone (the first preview's silence was the
   phone's silent mode).
3. Final-quality stills: the week counter was too small to read; enlarged before the final render.

## Fixed along the way
- The plug's top layer never landed in the pilot or in her original scene (four cells hung up to
  6.7 units above the pore, black on black). It lands here.
- Labels were projected through the previous frame's camera (a sub-frame lag in order, a wrong
  place out of order). Fixed in this scene and in the pilot.
