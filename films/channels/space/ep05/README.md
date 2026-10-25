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
  from Earth through a long lens (2.6°): twins. The camera swings out and widens (24°) and the depth shows, with the
  sightline cone from Earth grazing both.
- **"sun":** the Sun 100 units in radius at true scale. 109 Earths fill a row across its face as the counter climbs;
  a big sunspot (2.6 Earth radii) with an Earth in it; the Peloponnese as a teal dot (enlarged, badged); the Sun
  melts to a glowing outline and fills with 6,500 dots from the bottom up (1 dot = 200 Earths, by volume); then the
  one scale jump (2.7 s): everything shrinks ×2,400 until the Sun is a dot inside the dashed outline of the largest
  known stars (1,000 × its radius).
- **Spine readout:** ? → 400× · 400× → 1–109 → southern Greece → 8,000 → 0–1,300,000 → 1,000×+ → G2V · dwarf. Then the
  readout segment.
- **Loop:** the end card cuts back to the sky view of frame 0. Footnote: the Sun holds about 99.8% of the solar
  system's mass.

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `true sizes and distances, shrunk` | The sky view | Ratios exact, everything scaled down together |
| `true scale` | The row of Earths and the sunspot | |
| `dot enlarged` | The Peloponnese | At true scale it would be 1/8,400 of the Sun's width, under a pixel |
| `1 dot = 200 Earths, by volume` | The melt | Whole spheres would pack fewer (about 960,000) |
| `illustration` | The giant outline | One circle for "the largest known stars" (their sizes are uncertain) |

The full Moon is drawn lit from behind the viewer; in the sky the two are not seen full at once, so the hook frame is a
composition of their sizes, not a moment.
