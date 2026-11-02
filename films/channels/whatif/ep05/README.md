# Back of the Envelope No. 005: "Everybody jump"

73.2 s, 9:16. The narrator is synthetic (Kokoro am_puck) and the score is original (studio preset `envelope-working`,
A lydian at 50 BPM). It pays off No. 004's tease ("if everyone jumped at once, would the Earth move?") and sets up
No. 006 ("what if a whole day's rain fell in one second?").

STATUS: delivered. Final in `out/` (qa.py PASS); measured scorecard in `review/scorecard.md`.

## The story
When you jump, you push the ground away, and the ground is the whole planet. Gather all 8.2 billion of us in one
place and jump together: for about half a second we're in the air and the Earth moves the other way. It sounds like
it should knock the planet off course, but the push is shared out by weight, and the Earth outweighs all of us about
ten trillion times (6.0 × 10²⁴ kg against 5 × 10¹¹ kg). So it moves about 3 × 10⁻¹⁴ m: three thousand times smaller
than a hydrogen atom. When we land it settles back. Jump higher or count us lighter: still thousands of times smaller
than an atom. The Earth does move; it just never notices.

## Files

| File | What it is |
|---|---|
| `calc.py` | d = N·m·h / M with sources, the take-off and recoil speeds, the sensitivity table |
| `script.md`, `claims.json`, `pron.json` | The words (lint clean, Flow), the claims ledger (9 claims), pronunciations (none needed) |
| `voice.py`, `vo/` | am_puck, one Kokoro call and speed per sentence, measured pauses |
| `compile.py` | The direction → `film.json` and `sheet.json` (the zoom keys are shared with the scene) |
| `scene.mjs` | The picture |
| `../set/ladder05.js` | New set block: the powers-of-ten ladder (screen-space, true metres), a planet sphere with graticule, a cap of beads, arrows |

## The direction
- **A model Earth** on the graph-paper desk (badged), you on its top, crouched at frame 0 (the loop's composition).
- **Normal:** your hop on "jump", a marker arrow at the globe pushed down; everyone gathers round you as a cap of
  blue beads. **Change:** everyone hops (4× slower), the globe dips (exaggerated, badged).
- **Why:** out to the dashed path round the Sun; a ghost globe knocked off it on "knock … off course", back on "But";
  the speed counters (you 2.8 m/s up, the Earth 2.4 × 10⁻¹³ m/s down) over a slow push in; the spine: Earth ÷ us ≈ 10¹³.
- **Whoa:** the dive into your foot hands over to the ladder: your jump (40 cm), a hair, a red blood cell, an atom,
  and the Earth's step (≈ 3 × 10⁻¹⁴ m), boxed on "land", shrinking back to nothing on "was".
- **Show your work:** the whole sum with the Earth's mass; jump 50 cm; everyone half as heavy; one atom.
- **Takeaway:** back up the ladder to you, landed, on the globe among everyone. The end card returns to frame 0.
