# Art prompts: Skin Sense No. 006, "Same List as Cigarettes" (tone: deep, one tone for the whole episode)

One **text-free** still per shot. Until real art exists the film uses procedural placeholders (`../set/gen_art.py`, marked on screen). The list plate, the relative-risk bars and the countries plate are drawn in code. **No risk, cancer or disease line is ever shown over skin or a person: the bed is drawn as a canopy of tubes with nobody in it, and the risk figures are on plain plates.**

## Global style (from ART-DIRECTION.md; paste into every prompt)
Premium medical illustration with realistic tissue texture: translucent membranes, fine fibres, delicate branching structures, soft lighting, subtle moisture, convincing depth. Warm ivory ground; peach and rose tissue; pale-gold nerves; restrained teal accents; no excessive glow. Calm, detailed, elegant. Soft transition from the tissue to the ivory ground at the top and bottom edges (headline and captions sit on clean ivory). Look reference: `../reference/ep04-frown-reference.webp`.
**Always add:** `no text, no letters, no numbers, no labels, no captions, no watermark, no logos, no human face, no gore, no flat cartoon, no plastic look, no neon glow, no busy layout.`
**Format:** 941 × 1065 px or larger (0.884 aspect; 1882 × 2130 preferred), PNG, same scale and lighting across shots. Filenames match `art/<name>.png`; all images share common 0–1 coordinates so `episode.json` anchors keep working. Conceptual and simplified (the footer says so); no real person; one melanin level for the whole episode.

| # | file / shot | time | what to draw | framing |
|---|---|---|---|---|
| 1 | `bed` · the canopy | 0–4 (under the plate), 14–23, 54–68 | A tanning bed seen from the side as a curved shell lined with parallel glowing tubes (restrained violet-white light, a soft haze), an empty padded bench below; **nobody in it, no limb, no face** | wide, slightly low, calm; ivory ground at the edges |
| 2 | `skin` · deep-tone surface | 23–46 (under the chart plates) | A macro of deep-tone skin: fine criss-cross surface lines, pores, raking light; no hair, no lesion | flat macro |
| 3 | `section` · skin section | 46–54 | A clean stylised section: a thin horn layer and epidermis (about a tenth of the picture height) over a thicker rose dermis with fine fibres and a pale-gold fat layer; deep-tone epidermis; **leave room above for a code-drawn ray line** | side-on, soft |
| 4 | end card ground | 62–68 | Reuse 1 (veiled ~90 %) | — |

Prompt template: `[Global style]. Subject: <what to draw>. Camera: <framing>. Palette: warm ivory ground, deep-tone brown skin, restrained violet-white light for the tubes, teal accents. [Always add].`
Checks: no person in or near the bed; no text on the tubes or bench; the section reads as a conceptual diagram; the same deep tone in 2 and 3; a person with dermatology training glances at the section.
