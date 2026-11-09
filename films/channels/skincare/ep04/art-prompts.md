> **Superseded for the owner's pictures:** the owner is making 8 pictures from `ART-PROMPTS-CHATGPT.md` (on `claude/made-with-claude-film`), named `ep04-01` ... `ep04-08` (.png or .webp, 941 × 1672 full-frame with ivory top and bottom). `episode.json` maps them: e1 = shot 1 (forehead section; fallback `art/section.png`), e2 = shot 2 (nerve arrives), e3 = shot 3 (vesicles), e4 = shot 4 (release), e5 = shot 5 (muscle answers; falls back to shot 4), e6 = shot 6 (toxin enters), e7 = shot 7 (SNAP-25 cut, message held), e8 = shot 8 (relaxed + sprouts; falls back to shot 1). Run `python3 -I ../set/art_index.py ep04` after adding files. Label anchors and overlay positions in `episode.json` were tuned only for shot 2 so far. The spec below is the earlier 12-shot plan, kept for reference.

# Art prompts: Skin Sense No. 004, "The Message Behind a Frown"

One **text-free** illustration per shot, for an image model once the owner's key arrives. Until then the film uses a marked placeholder crop of `../reference/ep04-frown-reference.webp` (baked text painted out). All typography, labels, leader lines, the toxin particle, the cut mark, the new endings and the teal dots are drawn in code, so **none of them belong in the art** (the particle, the sprouts and the dots can be re-added to the art later; then remove the code layer).

## Global style (from ART-DIRECTION.md; paste into every prompt)
Premium medical illustration with realistic tissue texture: translucent membranes, fine fibres, delicate branching structures, soft lighting, subtle moisture, convincing depth. Warm ivory ground; peach and rose tissue; pale-gold nerve; restrained teal molecules; no excessive glow. Calm, detailed, elegant. Soft transition from the tissue to the ivory ground at the top and bottom edges (so the headline and captions sit on clean ivory). Reference image for look: `reference/ep04-frown-reference.webp`.
**Always add:** `no text, no letters, no numbers, no labels, no captions, no watermark, no logos, no human face, no skin photograph, no gore, no flat cartoon, no plastic look, no neon glow, no busy layout.`
**Format:** one still per shot, 941 × 1065 px or larger (same 0.884 aspect as `art/placeholder.png`; 1882 × 2130 preferred so the closest push-in stays sharp), PNG, no baked fade needed (the page masks the top and bottom). Keep the same artwork scale and lighting across shots so the camera can move between them.
**Honesty:** conceptual, simplified, not to scale (the footer says so); do not draw a real person; do not imply an injection site or a face.

## Shots (scene-table.md times)
| # | shot | time | what to draw | framing | anchors (0–1 of the image) to set in `art.json` |
|---|---|---|---|---|---|
| A1 | The whole junction | 0–6, 41–61 | A bulb-shaped nerve ending (pale gold, translucent, a few fine branching fibres inside) resting over a rose-pink muscle fibre with fine cross-striations; tiny round sacs of messenger inside the ending; a thin wavy gap between ending and muscle; a few teal beads in the gap | three-quarter view from slightly above, ending upper-left, fibre lower-right, shallow depth of field | nerve (0.41,0.20), ach (0.63,0.50), fibre (0.62,0.80), snap (0.50,0.49) |
| A2 | Sacs at the docking sites | 6–8 | Close on the lower edge of the ending: several sacs (translucent, a few pale beads inside) touching the membrane at small cup-shaped docking zones | macro, lens close to the membrane | sacs (0.45,0.46) |
| A3 | Release into the gap | 8–12 | The same docking zones with teal beads spilling into the wavy gap and landing on the muscle surface | macro, side on, the gap in the lower third | ach (0.60,0.52) |
| A4 | The muscle fibre | 12–15 | Rose fibre with fine striations, the surface slightly rippled where the beads land; a second fibre behind it | wide-macro along the fibre | fibre (0.62,0.74) |
| A5 | The toxin arrives | 16–19 | A small restrained navy-violet particle (smooth, slightly translucent, no glow) beside the membrane of the ending, then just inside it | medium, whole ending visible | toxin path from (0.16,0.10) to (0.50,0.49) |
| A6 | The protein is cut | 19–22 | Inside the ending, near a docking zone, one stylised coiled protein strand (twisted ribbon, navy and teal) in two halves with a clean break and a small gap | macro, very shallow depth, sacs soft behind it | snap (0.50,0.49) |
| A7 | Stuck | 22–26 | The sacs pressed to the membrane but closed; no beads in the gap; the muscle fibre calm | medium | ach (0.60,0.52), fibre (0.62,0.70) |
| A8 | Kerner plate ground | 28–38 | No anatomy: a quiet warm-ivory paper texture with a faint ink-wash wash at the edges (a period feel); **no portrait, no real person, no sausage, no writing** | flat, full frame | none |
| A9 | New endings | 43–47 | The same ending with three fine pale-gold sprouts reaching from its underside toward the fibre, tips slightly swollen | medium, as A1 | sprout tips (0.46,0.71), (0.56,0.73), (0.66,0.67) |
| A10 | Message flows again | 47–50 | A9 with teal beads crossing the gap near the new tips and landing on the fibre | macro | ach (0.60,0.58) |
| A11 | Wide close | 53–61 | A1 again, slightly pulled back, ivory edges generous | wide | as A1 |
| A12 | End card ground | 61–68 | A1 or A11 (the page veils it ~90 % ivory) | wide | none |

## Per-shot prompt template
`[Global style]. Subject: <the "what to draw" cell>. Camera: <framing cell>. Palette: warm ivory ground, peach and rose tissue, pale-gold nerve, restrained teal. [Always add].`
Example (A6): "Premium medical illustration… Subject: inside a translucent pale-gold nerve ending, one stylised coiled protein strand, twisted ribbon in navy and teal, broken cleanly into two halves with a small gap, soft out-of-focus sacs behind it. Camera: macro, very shallow depth of field. Palette: warm ivory… no text, no letters…"

## Checks before a generated image replaces the placeholder
No text or letters anywhere; no face or skin; no gore; structures match the sentence they sit under (nerve ending, sacs, gap, fibre); the conceptual simplification is noted in the footer; the same look across shots; `art.json` anchors updated (labels and leader lines follow them); a person with dermatology/neuroscience training glances at the mechanism pictures.
