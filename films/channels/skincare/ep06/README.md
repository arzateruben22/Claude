# Skin Sense No. 006: "Same list as cigarettes" (look 2 rebuild, first real draft)

About 76 s, 9:16 (1080×1920, 30 fps), narrated by a synthetic voice (bf_isabella, labelled "Narration: synthetic
voice (AI)"), with an original score (`outerlayer-slide`). Built in the owner-approved look test 2 (2 Nov,
`../looktest2/`, `../s1v2/BUILD-LOOK2.md`). One deep skin tone throughout (bible, owner-approved).
**Tanning episode: a board-certified dermatologist signs off on every line before posting.**

**The story:** tanning beds share IARC's Group 1 with tobacco smoking and processed meat; the group ranks how sure
the evidence is, not how big the harm. The beds' light is mostly UVA ("may be" 10–15× the midday sun in large,
powerful units); first use before 35 went with melanoma risk raised by more than half in pooled studies; Australia
and Brazil banned commercial beds; the long rays pass the ≈ 100 µm top layer; the sun made the list in 1992, the
beds in 2009.

**The picture (four hero shots, `review/storyboard.md`):**
1. **The list:** IARC Group 1 as a bevelled, engraved slate slab tilted ~12° in violet haze, a tube bank behind it as bokeh and a dust shaft across it; cyan inlays in recessed grooves light
   the three rows, then the evidence line (hook, normal; returns for the takeaway with the sun's row, 1992).
2. **The canopy:** deep-tone skin under 3D UVA tubes (core, glass, reflector housings, acrylic), god rays and dust;
   the tubes flare on "ten" and swell on "sun"; on "young" the camera re-frames up into the canopy, so no skin is in
   frame under the risk figures.
3. **The switch-off (the UV switch):** the cyan scan line on "Whole countries acted"; in the UV camera the skin's
   left half goes dark as its bank flickers out (Australia · 2015–16), then the right (Brazil · 2009).
4. **The cut face:** a block of skin cut open, seen three-quarters, its face a real stained tissue photo (micrograph); violet UVA dashes pass the top
   layer into the dermis; the gauge sets the top layer ≈ 100 µm beside the paper.

Honesty on screen: "IARC Group 1 · excerpt" and the plate's own line "ranks the strength of evidence, not the size of
risk"; "large, powerful units" and "UVA vs midday sun · may be"; "pooled studies · 2012 (corr.) · 2007" with
"relative risk · first use < 35"; "model, not a photo" on the canopy and the UV switch-off; "tissue photo · rays simplified" on the
cut face. Years appear on screen only. No advice.

Files: `script.md`, `claims.json`, `voice.py`/`vo/`, `compile.py` → `film.json`/`sheet.json`, `scene.mjs`
(`../set/studio.js`, `../set/prod.js` (the channel look), `../set/terrain.js`, `../set/motif.js`, `../set/ref/textures.js`), `review/`, `out/`.

    python3 -I films/channels/skincare/ep06/compile.py
    python3 -I kits/cinema/script/lint.py films/channels/skincare/ep06 --segment toscale
    bash films/channels/skincare/s1v2/draft.sh 06        # takes /tmp/chromium.lock itself
