# Light Minute No. 005: "How big is the Sun"

74.1 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 4's tease ("Next: pour Earths into the Sun. How many to fill it up?") and
sets up episode 6 ("Next: since this started, you've flown at least two thousand kilometers. How?").

STATUS: see `review/scorecard.md` (filled in on delivery).

## The story
Which holds a million Earths? The Sun and the full Moon look like twins in your sky, but one is about four hundred
times wider and four hundred times farther away. A hundred and nine Earths line up across its face; our whole world
would fit inside one big sunspot. Nearly twenty-five centuries ago, in Athens, Anaxagoras said the Sun was a fiery
stone bigger than southern Greece; calling it a stone, not a god, got him charged with impiety. He was right, by a
factor of about eight thousand. Melt down 1.3 million Earths and they'd fill it. Yet among the stars it's ordinary:
some are more than a thousand times wider. Astronomers even file the Sun under dwarf stars.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger (17 claims), pronunciation (Anaxagoras) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 1.0, normal 1.0, change 0.95, why 1.05, whoa 0.95, takeaway 0.95, readout 1.0, tease 0.9) |
| `compile.py` | The direction: two places and one cut (on the change's section sound) |
| `scene.mjs` | The picture |

## The direction
- **"sky":** the Moon and the Sun at their true size and distance ratios, shrunk together (1:150,000 of a km), seen
  from Earth through a long lens (3.3°): twins, both whole in the frame. On "But" a cut to **"side"**: the same line
  seen square-on from far out (rolled so it runs from Earth, lower left, to the Sun, upper right), the sight lines drawn
  out from Earth to the Sun's limbs; Earth and the Moon are one marked dot at that scale.
- **"sun":** the Sun 100 units in radius at true scale. 109 Earths fill a row across its face as the counter climbs;
  a big sunspot (2.6 Earth radii) with an Earth in it, through a ×20 long lens zoom; the Peloponnese as a dark dot
  (enlarged, badged), then a ring grown from its true size to the Sun's limb on "by a factor of about eight thousand";
  the Sun dims to a glowing outline and fills with 6,500 dots from the bottom up (1 dot = 200 Earths, by volume); then the
  one scale jump (2.7 s): everything shrinks ×3,400 until the Sun is a dot inside the dashed outline of the largest
  known stars (1,000 × its radius), which comes in with the zoom-out. The readout draws Earth's orbit to the same
  scale (1 AU, about 215 Sun radii), well inside the giants' outline.
- **Spine readout:** ? → 400× · 400× → 1–109 → southern Greece → 8,000 → 0–1,300,000 → >1,000× → G2V · dwarf. Then the
  readout segment.
- **Loop:** the end card cuts back to the sky view of frame 0. Footnote: the Sun holds about 99.8% of the solar
  system's mass.

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `true sizes, shown side by side` | The hook's twins | The sizes and the separation from Earth are true; a full Moon a degree from the Sun is never seen, so the pair is a composition |
| `true distances, shrunk` + `dots enlarged` | The side view (from "But") | The distances are true ratios, scaled down together; at that scale the Moon sits 2 px from Earth and the Sun is 4 px across, so Earth-and-Moon and the Sun are marked with glowing dots |
| `true scale` | The row of Earths and the sunspot | The row is drawn in the plane of the Sun's limb, so it spans the disc exactly as seen; the Sun's face is drawn just under the bloom (white-grey) so the silhouettes read |
| `dot enlarged` | The Peloponnese | At true scale it would be 1/8,400 of the Sun's width, under a pixel |
| `1 dot = 200 Earths, by volume` | The melt | Whole spheres would pack fewer (about 960,000) |
| `illustration` | The giant outline | One circle for "the largest known stars" (their sizes are uncertain); Earth's orbit in the readout is drawn to the same scale |

The full Moon is drawn lit from behind the viewer; in the sky the two are not seen full at once, so the hook frame is a
composition of their sizes, not a moment.
