# Possibility Lab's character (owner's references, 11 Nov 2026)

The owner sent references and said "use best judgment". DECISION: the mascot is the little visor ROBOT (`ref-robot.png`),
from Season 3 on: in thumbnails and covers now, and in the films from the v2 pass (the one with the owner's own voice).
The rubber-hose cartoon (`ref-arms-open.png`, `ref-wave.png`, `cover-sunrise-arcs.png`) is kept as an alternate look only.

Why the robot: it is 3D-native (soft white vinyl, glossy black visor, glowing eyes), so our three.js renderer can match the
reference closely and it sits naturally in the owner's photoreal Earth images; it fits a space and physics "what if" channel;
the eyes alone carry clear expressions at phone size.

| File | What it is |
|---|---|
| `ref-robot.png` | THE mascot: white rounded body, hands on hips, black-soled boots, a large glossy black visor with two white oval eyes |
| `ref-arms-open.png`, `ref-wave.png` | alternate 2D cartoon (not used unless the owner asks) |
| `cover-sunrise-arcs.png` | the owner's composite with the cartoon; its scene (a golden arc of suns, fanned shadows) can be re-used with the robot |

## Design (keep it consistent everywhere)
- Proportions: head and helmet about 40% of the height, a rounded pear torso, short thick limbs, mitten hands, boots with a black sole band.
- Materials: matte-satin white vinyl (roughness ~0.45, a light clearcoat), subtle seams; a visor of glossy black glass that reflects the
  scene (environment reflection plus a bright specular highlight top-right); eyes as emissive white ovals behind the glass.
- In space scenes: a faint blue rim light; near the Sun: a warm rim. Never recolour the body.
- Expressions (eyes only): neutral ovals; happy (upward arcs); wide (bigger ovals); blink; squint (flattened, bracing into wind);
  awe (tall ovals, looking up). The head tilts and the body poses do the rest (hands on hips, arms out, leaning, floating).
- Size in covers and thumbnails: the visor must read in a phone grid, so 12-25% of the frame height. The world stays huge.
- Never: a mouth or human features, logos or text on the body, other body colours.

## In the films (v2 pass)
Build him in three.js (MeshPhysicalMaterial body with clearcoat, a visor with high-gloss black plus envMap, emissive eye meshes or
an eye texture atlas, a simple rig for head, arms, legs). He replaces the capsule mannequin in every shot, with an expression
and pose per beat matched to the narration.

AI art disclosure: the references are AI illustrations. Covers that use the owner's photoreal images say "Thumbnail illustration made with AI".
