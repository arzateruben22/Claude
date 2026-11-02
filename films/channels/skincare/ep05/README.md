# Skin Sense No. 005: "The sunscreen experiment" (look 2 rebuild, 2 Nov)

About 77 s, 9:16 (1080×1920, 30 fps), narrated by a synthetic voice (bf_isabella, labelled "Narration: synthetic
voice (AI)"), with an original score (`outerlayer-slide`). The approved look (look test 2; `../s1v2/BUILD-LOOK2.md`).
One medium skin tone throughout (bible §1). A board-certified dermatologist signs it off before posting.

**The story:** the Nambour trial (Queensland, 1992–96). Chance decided who put sunscreen on every morning; the others
used it as they pleased, or not at all. After 4.5 years, silicone casts of the backs of hands showed no detectable
increase in ageing in the daily group (relative odds 0.76, 0.59–0.98; Hughes et al., 2013). Followed ten more years,
melanoma came out at about half, in small numbers (11 vs 22, HR 0.50, 0.24–1.02, not quite significant; Green et al.,
2011). To scale: a lab's test dose is a film of ≈ 20 µm, a fifth of a paper. No advice, no product.

**The picture:** three hero places, one slow move per setup, dust in light shafts and shallow depth of field.
1. The sunscreen macro: one patch of skin, the left half under sunscreen, the right bare; the UV switch (a cyan scan
   line) on "But" turns the screened half dark and the bare half lilac with the damage the eye misses
   ("illustration · not trial data"). It returns for to-scale (the satin film, grazing, with the gauge) and the loop
   (the UV switch again on "skin").
2. The silicone cast of the skin's lines: grey, no hairs, raking light; the lines deepen ("model · 4.5 years,
   compressed"), with "ageing trial 4.5 years" and the odds plate.
3. The micrograph cut face (stained section, `../set/ref`): the ten-year tally, "small numbers · not quite significant".

The model hands (`../set/hands05.js`) and the town (`../set/town05.js`) are retired from this episode (files kept).

Files: `script.md`, `claims.json`, `voice.py`/`vo/`, `compile.py` → `film.json`/`sheet.json`, `scene.mjs`
(`../set/terrain.js`, `../set/studio.js`, `../set/motif.js`, `../set/ref/textures.js`), `review/` (storyboard,
scorecard, draft preview, contact sheet), `out/`, `assets.md`.

    python3 -I films/channels/skincare/ep05/compile.py
    python3 -I kits/cinema/script/lint.py films/channels/skincare/ep05 --segment toscale
    bash films/channels/skincare/s1v2/draft.sh 05
