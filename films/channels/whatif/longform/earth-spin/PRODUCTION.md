# Season 3 — "What If Earth Spun Faster and Couldn't Stop?" — production notes

Narration is a synthetic voice (Kokoro `am_puck`, default speed 0.76, 0.38 s sentence gap, `pron.json`).
Every description says so and every film.json carries `"disclosures":{"aiVoice":true}`.

## Layout
- `script.md` — the narration (v3.1). `script-v2.md` / `script-owner.md` belong to the owner-voice alternate set.
- `compile.py` — long film. `VOICE=ai` (default) reads `vo/`; `VOICE=owner` reads `vo-owner/`.
- `scene.mjs` — the one three.js scene, a pure function of t. Used by the long film and all eight parts.
- `parts/` — `lines/` (opening, cliffhanger, closer and like/follow lines), `make_part.py`, `compile_part.py`,
  `deliver.py`, `cover.py`, `sub_window.py`, `partN/`. Delivered files go to `whatif/ep13..ep20` (part N → ep{12+N}),
  the long film to `compilations/s3/`.
- `voice-owner/`, `vo-owner/`, `script-owner.md` — his real recording, kept untouched as the alternate set.

## Swapping in his own voice later
Per-sentence timing data is kept: `vo/words.json` (long film) and `parts/partN/vo/words.json` (parts) come from the aligner.
All picture timing is derived from those files, nothing is hand-timed.

Files to replace
1. Long film: the per-sentence wavs in `vo/NN.wav` (one wav per script line, same numbering as `script.md`).
2. Parts: `parts/lines/vo/*.wav` (opening/cliffhanger/closer/CTA lines) and the sentence wavs. Parts cut their sentences
   from the long film's line wavs by word times, so replace `vo/` first, then rerun `make_part.py N --voice ai` for each part
   (point `--partlines` at his lines).

Then
- `kits/cinema/voice/align.py <vodir> $CINEMA_VOICE/models` on each replaced folder (rewrites `words.json`).
- `python3 compile.py` and `parts/compile_part.py N` — captions, `at("voNN:word")` anchors, the day-length KEYS, weight windows,
  gaps and the CTA position all re-time automatically from the new `words.json`.
- `kits/cinema/studio/render.py sheet.json build/audio` (and `sheet-sub.json` for the YouTube "subscribe" variant) rebuilds the mix at -14 LUFS.

What must be re-rendered
- If every part and the long film come out within about 0.1 s per beat of the current durations: nothing but the audio mix
  and the assemble step (`run.sh … --assemble --audio …`), plus `srt.py`, `deliver.py N`, `sub_window.py N`.
- Otherwise the picture chunks whose timings shift (render.mjs reports the stale chunks; delete them and rerun). With a
  different overall length the film is re-rendered from the first shifted beat on. His real reading is about 32% faster
  than the stock pace, so expect the long film to shrink and the parts to need new gaps/trims (`compile_part.py N [target]`).
- Covers are image-only stills from the film's own scene and only change if beat times shift: `parts/cover.py N SECONDS`.

The cloned-voice (`vo-own/`) work was set aside; `VOICE=own` still points at it if it is revived.

## YouTube "subscribe" version
The 1080 file says "follow" (audio and caption). The `-youtube` 1440p file says "subscribe": `parts/sub_window.py N` re-renders
only the chunk(s) holding the CTA caption and splices them in, with `build/audio-sub/mix.m4a` as the audio.

## QA run on every file
kit `qa.py` PASS, flashing 0, text audit 0 (at most 2 text blocks plus badge and series line), no voiceless gap over 1.2 s,
`ffmpeg freezedetect=n=0.003:d=1.4` none except the end card, 1440p for the YouTube files. All claims stay OPEN until a person
opens the source (c24 gust speed and c27 basketball hoop have no source yet).

## Placeholders / TODO
- Channel handles and posting copy in `POSTING.md` are placeholders; nothing is posted.
- Voice is the stock voice until he records the swap.
