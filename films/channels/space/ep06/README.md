# Light Minute No. 006: "Your speed"

74.7 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 5's tease ("Next: since this started, you've flown at least two thousand
kilometers. How?") and sets up episode 7 ("Next: more trees on Earth, or stars in our galaxy?").

STATUS: see `review/scorecard.md` (filled in on delivery).

## The story
How fast are you moving now, sitting perfectly still? Earth spins: at the equator the ground moves about 1,670 km/h,
faster than sound. Earth circles the Sun at about 30 km a second: since this began, farther than New York to Boston.
Ptolemy argued that if Earth moved, birds and clouds would be left behind; in 1632 Galileo answered with a ship's cabin:
below deck on calm water, nothing tells you the ship is moving. You feel a jolt, never a smooth ride. Zoom out: the Sun
drags us round the galaxy at about 230 km a second; one lap takes about 230 million years, and last time round the
first dinosaurs had just appeared. So your speed has no single answer. First ask: compared to what?

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger (15 claims), pronunciations (Ptolemy, Galileo) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 1.0, normal 1.08, change 1.08, why 1.15, whoa 1.15, takeaway 0.95, readout 1.15, tease 0.9) |
| `compile.py` | The direction: three ladder rungs (earth 1,000 km, solar 1 million km, galaxy 1,000 ly), a pull-back and the one jump, three clocks (spin ×1,000, orbit ×1,000,000, the Sun's lap ×10¹⁴) |
| `scene.mjs` | The picture: one camera pose, the world moving under it |

## The direction
- **One world, one camera:** Earth at true size with a teal pin on the equator ("you") turning, the equator drawn as
  a thin ice line from "at the equator" to the pull-back; the pull-back to the orbit (Earth's pale ice marker runs an
  ice arc: teal stays light's colour); back to Earth for Ptolemy's objection; **Galileo's cabin** as an inset over
  Earth, which dims to about a tenth of its light behind it while its spin waits (a ship on calm water, the hull cut
  away below deck and sitting in the water: the water slides past while the drops fall straight, the fish swims and
  the butterflies flutter in place; on "jolt" the ship lurches and what isn't fixed to it keeps its place: the drops
  swing past the cup, the butterflies stay put, the fish lags); "Zoom out": the one jump, Earth's dot handing over
  to the Sun as a point, holding for a moment on the Sun among its neighbours (a cloud of nearby stars seen from just
  outside it), then out to the galaxy, the Sun a lemon glow on its lap (a dashed lilac ring of 27,000 light-years,
  kept under the bloom so it stays lilac, dimmed by colour after its beat; the disc turning with its arms trailing);
  the readout: light's path from the Sun to the centre, its front moving at one speed, while the camera drifts in.
  The path, the lap and the Sun leave, and the disc dims a little, before the end card's words arrive.
- **Spine readout:** ? → 1,670 → 1,225 → 30 → **the real km round the Sun since the film began, counting live**
  (29.78 × t) → 230 (km a second) → 230 million (years) → first dinosaurs → ? ("compared to what"). The last "?"
  loops to frame 0's.
- **Footnote:** one lap of the galaxy takes the Sun about 230 million years.

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `1,000× faster`, `1,000,000× faster`, `10¹⁴× faster` | From the clocks | The spin waits while Earth is a dot in the orbit view and behind the cabin (it is not drawn turning there, and its note leaves while the cabin is up); the jump hides the orbit's rung (it would only flash past); the galaxy's clock runs from the jump's end and stops for the readout ("your galactic trip so far") |
| `not to scale` | While the enlarged Sun is in frame | The Sun and Earth's marker are enlarged |
| `illustration` | Galileo's cabin | A drawing of the Dialogue's thought experiment (1632), not a scene from it |
| `illustration` | The cloud of nearby stars, while the jump holds on it | The Sun's neighbourhood drawn, not mapped: the stars' places are made up |
| `galaxy: illustration` | The galaxy | Drawn, not imaged; the Sun 27,000 light-years from the centre (the channel's figure) |

The live km counter is true time (it does not follow the orbit clock's speed-up). Earth's axial tilt is drawn upright.
