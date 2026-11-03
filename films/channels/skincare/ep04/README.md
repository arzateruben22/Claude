# Skin Sense No. 004: "The deadliest dose" (look 2 rebuild)

The channel was formerly Outer Layer. The folder, the theme ids and the `outerlayer-slide` preset keep the old name.

**Format.** About 75 s, 9:16 (1080×1920, 30 fps). Narrated by a synthetic voice (bf_isabella, labelled "Narration: synthetic voice (AI)"), with an original score (`outerlayer-slide`). One light skin tone throughout (bible §1).

**Topic.** "What Botox does", mechanism only. The voice says "botulinum toxin" and never the brand. The film never recommends the treatment, never says where it goes or who gives it, and gives no advice. A dermatologist signs off before posting.

**The story.** A frown is a nerve ending telling a muscle to pull. The toxin slips into that ending and cuts SNAP-25, so the acetylcholine waits and never leaves. Justinus Kerner traced "sausage poison" around 1820 and guessed it might become a medicine. The dose is counted in mouse-lethality units: one frown takes 20, against an estimated ≈ 3,000 lethal for a 70 kg adult. The cleft (≈ 50 nm) is about 2,000 times thinner than paper. Months later the nerve grows spare endings, then prunes them away.

## The picture (approved look, look test 2)

There are four hero shots (`review/storyboard.md`):
1. **The brow:** the frown as a skin macro in studio light (`../set/brow04.js` restyled with `../set/studio.js`'s `skinMaterial`).
2. **The junction:** the neuromuscular junction at cell scale (`../set/nmj04.js`, new). It uses `cellMaterial`, `nucleusMaterial` and `strandMaterial`, with haze, dust and a shaft.
3. **The cut face:** the stained micrograph cut face below the skin (`../set/ref`, public domain).
4. **The dose:** the brow with the UV scan line on "twenty", and the dose plate (notes: "estimate, 70 kg adult · units differ by product · side effects can occur far below this").

The channel look (stage 1, `../set/prod.js`: `lookV2`, `richen`) and the unified HUD (`../set/hudv2.js`: `unifyHud`) are applied.

The old schematic `../set/junction04.js`, the UV camera brow (`../set/uvcam.js`) and the macro terrain are retired from this episode.

## Files

- `script.md`, `claims.json`, `voice.py` / `vo/`
- `compile.py` → `film.json` / `sheet.json`: every moment hangs on a spoken word.
- `scene.mjs`
- `review/`: the storyboard, the scorecard, the draft preview and the contact sheet.
- `out/`

## Build

- Compile: `python3 -I films/channels/skincare/ep04/compile.py`
- Lint: `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep04 --segment toscale` (0 errors, 0 warnings)
- Draft: `bash films/channels/skincare/s1v2/draft.sh 04`. Every Chromium job takes `flock /tmp/chromium.lock`.
