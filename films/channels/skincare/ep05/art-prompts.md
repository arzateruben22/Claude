# Art prompts: Skin Sense No. 005, "The Sunscreen Experiment" (tone: medium, one tone for the whole episode)

One **text-free** still per shot. Until real art exists the film uses procedural placeholders (`../set/gen_art.py`, marked on screen). Plates, bar charts, pills and the scan line are drawn in code and need no art. **The melanoma figures are on a plain plate: never draw skin, a lesion or a person under them.**

## Global style (from ART-DIRECTION.md; paste into every prompt)
Premium medical illustration with realistic tissue texture: translucent membranes, fine fibres, delicate branching structures, soft lighting, subtle moisture, convincing depth. Warm ivory ground; peach and rose tissue; pale-gold nerves; restrained teal accents; no excessive glow. Calm, detailed, elegant. Soft transition from the tissue to the ivory ground at the top and bottom edges (headline and captions sit on clean ivory). Look reference: `../reference/ep04-frown-reference.webp`.
**Always add:** `no text, no letters, no numbers, no labels, no captions, no watermark, no logos, no human face, no gore, no flat cartoon, no plastic look, no neon glow, no busy layout.`
**Format:** 941 × 1065 px or larger (0.884 aspect; 1882 × 2130 preferred), PNG, same scale and lighting across shots. Filenames match `art/<name>.png`; all images share common 0–1 coordinates so `episode.json` anchors keep working. Conceptual and simplified (the footer says so); no real person; one melanin level for the whole episode.

| # | file / shot | time | what to draw | framing |
|---|---|---|---|---|
| 1 | `skin` · the patch | 0–22, 54–60 | A macro of medium-tone skin: fine criss-cross surface lines, a few pores, soft raking light from the upper left; no hair, no blemish, no lesion, not a hand with a face | flat macro, shallow depth, left half very slightly satin (a thin film of sunscreen), right half bare, a soft seam |
| 2 | `cast` · silicone cast | 17–29 | A pale ivory-grey silicone impression of the same skin lines (the negative: ridges become grooves), soft gloss, translucent edge | macro, same framing as 1 |
| 3 | `uv` · ultraviolet view | 29–41 | The same patch seen by an ultraviolet camera as an illustration: deep violet-brown tissue with pale blue-white patches where damage hides under the surface; clearly stylised | macro, same framing as 1 |
| 4 | end card ground | 60–68 | Reuse 1 (veiled ~90 %) | — |

Prompt template: `[Global style]. Subject: <what to draw>. Camera: <framing>. Palette: warm ivory ground, medium-tone peach skin, restrained teal accents. [Always add].`
Checks before swapping in generated art: no text, no face, no lesion, same medium tone in every image, the same patch geometry across 1–3 so the camera can cross-fade, a dermatologist glances at the UV illustration (it must not look like trial data; the badge says illustration).
