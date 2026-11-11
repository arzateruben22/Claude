# Possibility Lab's character (owner's reference art, 11 Nov 2026)

The owner sent three references and said "use best judgment". Decision: this is the channel's mascot from Season 3 on,
in thumbnails and covers now, and in the films from the v2 pass (the one with the owner's own voice).

| File | What it is |
|---|---|
| `ref-arms-open.png` | 2D model sheet pose: arms open, delighted, "!" marks |
| `ref-wave.png` | 2D pose: waving, hand on hip |
| `cover-sunrise-arcs.png` | the owner's finished composite: the mascot on Earth's horizon under a golden arc of suns, shadows fanning. Use as the P6 or P7 cover as is (add the words in code) |

## Design (keep it consistent everywhere)
- Round head (about 1/3 of the height), a pill-shaped torso, thin tube arms and legs, four-finger cartoon gloves with cuffs, big rounded sneakers.
- Pure white body with a clean black outline and soft grey cel shading; big oval eyes with highlights, a wide open smile.
- In space scenes, a faint blue rim light (the channel's accent) keeps him readable against black; never recolour the body.
- Expressions carry the hook: delighted (default), awe (mouth "o", eyes up), shock (eyes wide, hands on cheeks), bracing (leaning into wind, one hand on head), floating-happy (arms out, feet off the ground).
- Size in covers and thumbnails: his face must read in a phone grid, so 12-25% of the frame height. The world stays huge around him.
- Never: realistic human features, other colours for the body, logos, text on the character.

## In the films (v2 pass)
Build him in three.js: toon shading (MeshToonMaterial, 3 bands) plus an inverted-hull black outline; face as a texture atlas
(eyes and mouth states swapped per beat); gloves and sneakers as rounded meshes. He replaces the capsule mannequin in every shot,
with an expression per beat matched to the narration.

AI art disclosure: the references and composites are AI illustrations. Say "Thumbnail illustration made with AI" wherever they're used.
