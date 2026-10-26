# Light Minute No. 005: "How big is the Sun"

74.7 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 4's tease ("Next: pour Earths into the Sun. How many to fill it up?") and
sets up episode 6 ("Next: since this started, you've flown at least two thousand kilometers. How?").

STATUS: see `review/scorecard.md` (filled in on delivery).

## The story
Which holds a million Earths? The Sun and the full Moon look like twins in your sky, but one is about four hundred
times wider and four hundred times farther away. A hundred and nine Earths line up across its face; our whole world
would fit inside one big sunspot. Nearly twenty-five centuries ago, in Athens, Anaxagoras said the Sun was a fiery
stone bigger than southern Greece; calling it a stone, not a god, got him charged with impiety. Bigger, yes: by a
factor of about seven thousand. Melt down 1.3 million Earths and they'd fill it. Yet among the stars it's no giant:
some are more than a thousand times wider. Astronomers even file the Sun under dwarf stars.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger (19 claims), pronunciation (Anaxagoras) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 1.0, normal 1.0, change 0.95, why 1.05, whoa 0.95, takeaway 0.95, readout 1.0, tease 0.9) |
| `compile.py` | The direction: two places and one cut between them (on the change's section sound); the first place has three shots |
| `scene.mjs` | The picture |

## The direction
- **"sky":** the Moon and the Sun at their true size and distance ratios, shrunk together (1:150,000 of a km), seen
  from Earth through a long lens (3.3°, a slow push to 3.0° through the hook): twins, both whole in the frame, named
  from frame 0 until the cut; through "look the same size" they drift a little closer together (to 0.85 of the
  separation, so their name pills never meet; frame 0 and the end card keep the full separation). On "But" a cut to
  **"wide"**: beside the Sun (about half the frame's width), the Moon moved next to it at its true size, about 1 px
  (lit brighter so the speck shows), marked with an ice ring: "four hundred times wider". On "and" a cut to
  **"side"**: the same line seen square-on from far out (rolled so it runs from Earth, lower left, to the Sun, upper
  right), glowing teal sight lines drawn out from Earth to the Sun's limbs ("four hundred times farther"); Earth and
  the Moon are one marked dot at that scale, its label below it, clear of the lines. The markers (beacons) keep the
  draft's size at every resolution.
- **"sun":** the Sun 100 units in radius at true scale. 109 Earths fill a row across its face as the counter climbs
  (the face a little dimmer from the row to the melt, so the silhouettes keep their edges and the why beat's face
  isn't clipped white; the row leaves before the zoom); a big sunspot (2.6 Earth radii: a dark umbra in a grey
  penumbra with faint filaments, soft-edged) with an Earth in it, through a ×20 long lens zoom that slides the spot
  straight to its place (the face dimmer in the close-up, with a finer granulation of true-size cells, about 1,000 km,
  and a sphere fine enough that the limb stays round); a slow push through the why beat, with a card (top left),
  "Anaxagoras" over "Athens, 5th century BCE"; southern Greece as a map: the Peloponnese's outline laid on the face
  about 3,000 times enlarged, shrinking to a dark dot (still about 380 times enlarged; badged "map enlarged"), then
  from "Bigger, yes" a ring grown from its width (about 200 km) out of the dot by "By", slowing into the Sun's limb
  by "thousand"; the Sun dims to a lemon limb line and fills with 6,500 dots from the bottom up, the filled volume
  keeping pace with the counter (1 dot = 200 Earths, by volume; the emptied Sun shows the sky behind the dots); then
  the one scale jump (2.8 s): everything shrinks ×850 until the Sun is a dot among stars (the backdrop's stars
  brighten through the jump; a field streams in at its end, then a slow orbit through it, 12° → 30°, for parallax)
  inside the dashed outline of the largest known stars (1,000 × its radius), which comes in once it has shrunk to
  size. The outline leaves as the takeaway starts and the camera pushes in on the Sun (its dot swells once on
  "dwarf") at the drift limit, 4.8% a second (dist 440 → 240), so Earth's orbit is about twice as wide by the
  readout. The readout: a teal ping on the Sun on "Light time", then a ring of light grows out to Earth's orbit (same
  scale: 1 AU, about 215 Sun radii, Earth on it) by "twenty seconds", eased so the trip reads; the light is gone
  before the end card. No field star sits in the spine's band after the jump.
- **Spine readout:** ? → 400× → 400× · 400× → 1–109 → southern Greece (his guess) → 7,000 → 0–1,300,000 → >1,000× →
  G2V · dwarf. Then the readout segment.
- **Loop:** the end card cuts back to the sky view of frame 0, 0.3 s after the card starts (under its scrim, the twins
  dimmed). Footnote: the Sun holds about 99.8% of the solar system's mass.
- **Poster:** the filled bead Sun with "1,300,000" (44.5 s).

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `true sizes, shown side by side` | The hook's twins, from frame 0 (the loop point) | The sizes and the separation from Earth are true; a full Moon a degree from the Sun is never seen, so the pair is a composition |
| `true sizes, not distances` | The wide shot (from "But") | The Sun and the Moon at their true sizes, but the Moon is moved beside the Sun (in the sky it is 400 times nearer than the Sun). It is about 1 px there, so a thin ring marks it; a glow would read as its size |
| `true distances, shrunk` + `dots enlarged` | The side view (from "and") | The distances are true ratios, scaled down together; at that scale the Moon sits 2 px from Earth and the Sun is 4 px across, so Earth-and-Moon and the Sun are marked with glowing dots |
| `true scale` | The row of Earths and the sunspot | The row is drawn in the plane of the Sun's limb, so it spans the disc exactly as seen; the Sun's face is drawn just under the bloom (white-grey) so the silhouettes read |
| `map enlarged` | The Peloponnese | Its outline (traced from coordinates, about 40 points; 21,700 km² against the true 21,550) arrives about 3,000 times enlarged and shrinks to about 380 times; at true scale it would be about 1/7,000 of the Sun's width, under a pixel |
| `1 dot = 200 Earths, by volume` | The melt | Whole spheres would pack fewer (about 830,000 at random, 960,000 at best) |
| `illustration · star spacing not to scale` | The giant outline and the star field | One circle for "the largest known stars" (their sizes are uncertain). The stars around the Sun are placed for the picture, far closer together than real stars (and kept out of the spine's band), and their dots don't show their sizes. Earth's orbit in the readout is drawn to the outline's scale (the outline has gone by then) |
| `light sped up` | The readout's ring of light | It reaches Earth's orbit in 1.7 s of film; the real trip takes 8 min 20 s |

The full Moon is drawn lit from behind the viewer; in the sky the two are not seen full at once, so the hook frame is a
composition of their sizes, not a moment. In the wide shot the Moon keeps that lighting (at 1 px its phase can't show).
The why beat's card ("Anaxagoras", "Athens, 5th century BCE") is a caption, not a cheat: c4 places him in Athens in
the mid-5th century BCE (c. 450–430 BCE).
