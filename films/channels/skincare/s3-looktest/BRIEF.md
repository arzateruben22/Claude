# Skin Sense Season 3: 10-second look test (owner's request, 11 Nov 2026)

The look gate for Season 3: one 10-second 9:16 clip in the **night look** with **Evelyn's real voice**, for the owner to
approve before any episode is built. Not an episode: no series line, no end card, no CTA.

## Sound
- Voice: `vo/01.wav` (9.88 s), Evelyn's real recording, cut from `../voice-evelyn/evelyn-s3-full.m4a` (11.7-21.4 s) and
  polished with `kits/cinema/voice/polish.py --style whisper`. Never re-voice it and never make an AI copy of her voice.
  Words: "Feel that? … A shiver." (about 0.3-2.4 s) then "Tiny sensors in your skin feel the air cool… and quietly let
  your brain know." (about 3.3-9.6 s). Run align.py for exact word times.
- ASMR mix (SEASON-FORMAT.md, Skin Sense Season 3): a very low warm drone and soft air or brushing foley, no hits,
  stings, whooshes or sudden loudness changes. About -16 LUFS integrated, peaks under -1.5 dBFS.

## Picture (SEASON-FORMAT.md, "The night look")
- 1080x1920, 30 fps, 10.0 s. Deep green-black ground `#0B1513`. Skin and tissue glow softly from within, out of the dark.
  One soft key light, slow drifting particles, shallow depth of field, grain, the cinema kit finish. Teal `#3FBFAE` is
  the only accent. Episode 1 uses the **deep** skin tone (as calibrated for S2 ep12). Never a face. No gold, no rose
  accents, no neutral black ground.
- 0-2.5 s: the camera drifts slowly, low over a dark landscape of skin in macro, fine hairs lying flat, warm light glowing
  up through the surface. On "A shiver" the hairs rise one after another in a slow wave, a small bump under each.
- 2.5-10 s: the camera sinks gently through the surface into the layer below: fine nerve fibres glowing faintly. On
  "feel the air cool" a soft teal signal starts at a fibre ending near the surface and travels away along the nerve,
  into the dark ("let your brain know"). The camera follows a little, then holds as the pulse fades. Slow, calm, no cuts.
- Text: only the captions, one short line at a time, small ivory serif `#F4EDE3`, inside the 9:16 safe area, clear of
  the skin's brightest glow. No labels, no title.

## Deliver
`out/skin-sense-s3-looktest.mp4`, plus `out/skin-sense-s3-looktest-still.png` (the frame at about 5 s) for the look gate.
QA: the flash check, and frame grabs at 1, 2.5, 5 and 9 s. Commit to this branch and report the commit. Don't push to
Prism (the coordinator does).
