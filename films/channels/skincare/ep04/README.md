# Outer Layer No. 004: "What a tan is"

74.2 s, 9:16. **Status: draft round 2** (review fixes applied, being re-rendered); the final goes to the render worker
after the re-score. Narration: synthetic voice (Kokoro bf_isabella, one speed per line). Score: original
(studio preset `outerlayer-slide`). Nothing has been posted.

- Draft preview: `review/outerlayer-004-9x16-draft-preview.mp4` (540×960, 15 fps)
- Draft contact sheet: `review/draft-contact-sheet.jpg`

## The story

A tan looks like skin getting ready for the sun; it starts after the sun has done harm. UV fuses two letters of a
living cell's DNA in under a trillionth of a second; the cell notices (p53), sends a message (α-MSH) down to the
pigment cells; days later melanin sits over each nucleus like a parasol. Mice without p53 in their skin cells never
tan (Cui et al., Cell, 2007). A whole tan adds up to about SPF 3–4. To scale: a dozen parasols stacked are as thick
as a sheet of paper. Callback: "So, is a tan a shield? A thin one. It's how your skin remembers the light."

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` (16, search excerpts), `pron.json` | The words, the claims ledger, the pronunciations (melanin, parasol) |
| `voice.py` | Voices the script with one Kokoro speed per line (tts.py's own phonemes and trim) |
| `fixwords.py` | Places "SPF" and "three" in vo05 by hand from the line's energy (the recognizer heard "SPF3"); run after align.py |
| `vo/` | 8 WAVs, `lines.json`, `words.json` |
| `compile.py` | The direction: shots, the tanning clock (×60,000), camera keys, labels, badges, counters, transitions, captions, title, end card → `film.json`, `sheet.json` |
| `scene.mjs` | The picture, a pure function of t |
| `../set/section.js`, `rays.js`, `motif.js`, `rig.js`, `look.js` | The channel's shared set (first builder's) |
| `../set/dna04.js`, `melanocyte04.js` | This episode's blocks: the DNA ladder with the fused bases; the pigment cell, its message and the melanin caps. (`uv04.js` was the first cut's UV; the episode now uses the channel's `rays.js`) |

## Rebuild

From the repo root, with `E=films/channels/skincare/ep04`:

```
$CINEMA_VOICE/venv/bin/python -I $E/voice.py --models $CINEMA_VOICE/models
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py $E/vo $CINEMA_VOICE/models
python3 -I $E/fixwords.py
python3 -I kits/cinema/script/lint.py $E --segment toscale --bpm 64.2857
python3 -I $E/compile.py
(cd $E && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio)
node kits/cinema/film/render.mjs --film $E --tier draft
node kits/cinema/film/render.mjs --film $E --tier draft --assemble --audio $E/build/audio/mix.m4a
```

## Review round 1 (independent review of the first draft) and what changed

- The tease caption covered the end card → the card sits 30 vmin higher.
- Close shots fell inside the cells (hollow cells, z-striping) → the camera stops at ≥ 200 µm.
- Five hard brightness cuts → an iris on the two scale jumps (into the nucleus, back out), a dip to the slide on the rest.
- "A dozen side by side would span a sheet of paper" said more than the note (width vs thickness) → re-voiced:
  "a dozen stacked would be as thick as a sheet of paper", and twelve parasols stack inside the paper's bar.
- The gauge ran under the captions → it shows only in the field and the to-scale shot.
- The named subject wasn't the brightest thing → darker, larger caps; a p53 glow; rays fall at the cut face and what gets in glows (the channel's `rays.js`, as No. 002).
- The mice pair didn't read → light tone, the one with p53 floods with melanin.
- Caption breaks (hedge split from its number, "lacked that | guardian", "In under a", "would span |") → glued.
- Tone implication (only light skin shown "letting UV through") → the field is the hook's medium tone; light skin appears only in the mice pair, where it tans.
- Badges: "model" on the field, "illustration" while caps form, one number for the nucleus (≈ 9 µm, estimate); duplicated counter/label text removed.
