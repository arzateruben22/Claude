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
| `compile.py` | The direction: three ladder rungs (earth 1,000 km, solar 1 million km, galaxy 1,000 ly), a pull-back and the one jump, three clocks (spin ×2,000, orbit ×10⁶, the Sun's lap ×10¹⁴) |
| `scene.mjs` | The picture: one camera pose, the world moving under it |

## The direction
- **One world, one camera:** Earth at true size with a teal pin on the equator ("you") turning; the pull-back to the
  orbit (Earth's marker runs a teal arc); Ptolemy's and Galileo's lines labelled on Earth; "Zoom out": the jump to the
  galaxy, the Sun on its lap (a dashed lilac ring of 27,000 light-years); the readout ring.
- **Spine readout:** ? → 1,670 → 1,225 → 30 → **the real km round the Sun since the film began, counting live**
  (29.78 × t) → 230 → 230 (million years) → first dinosaurs → ? ("compared to what"). The last "?" loops to frame 0's.
- **Footnote:** one lap of the galaxy takes the Sun about 230 million years.

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `2,000× faster`, `10⁶× faster`, `10¹⁴× faster` | From the clocks | |
| `not to scale` | The orbit | The Sun and Earth's marker are enlarged |
| `galaxy: illustration` | The galaxy | Drawn, not imaged; the Sun 27,000 light-years from the centre (the channel's figure) |

The live km counter is true time (it does not follow the orbit clock's speed-up). Earth's axial tilt is drawn upright.
