# Light Minute No. 003: "Venus day"

74.7 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 2's tease ("Next: a world that turns slower than it orbits. And
backwards.") and sets up episode 4 ("Next: the Moon never stops falling toward us. So why doesn't it land?").

**Delivered (26 Oct):** `out/lightminute-003-9x16.mp4` (74.67 s, −14.1 LUFS / −1.7 dBTP, voice 12.3 LU over the music,
sync PASS, 0 flashes: `qa.py` PASS), with its poster (50.4 s), contact sheet and `review/`. It has not been posted.
Chunk 001 was re-rendered after the first assembly (see `review/scorecard.md`).

## The story
Can one day outlast a year? On Venus: yes, and no. For three hundred years astronomers chased faint smudges in
its clouds; the Cassinis clocked about 23 hours, Schiaparelli said one face always faced the Sun. In 1962 radar
from a dish in California found both wrong: one turn takes 243 days, longer than its 225-day year, and it turns
backwards. Stand there, and the spin and the orbit team up: the Sun comes back every 117 days, rising in the west.
So yes, one turn outlasts a year; but the day you'd live by is the Sun coming back.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger (17 claims), pronunciations (Schiaparelli, Cassinis) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 0.9, normal 1.1, change 1.15, why 1.15, whoa 1.0, takeaway 0.95, readout 1.08, tease 0.92) |
| `compile.py` | The direction. Two scene clocks for Venus, "orbit" and "spin", plus "guess" for the Cassinis' 23 hours; piecewise constant (one linear stop), integrated here as clock.js does, so the sunrise ticks (8, every 2.52 s in the whoa = 116.75 days) and the inferior conjunction at the readout are computed |
| `scene.mjs` | The picture: one shot that follows Venus in close (rig.js's `poseAt` with a follow weight) and pulls back to the diagram |
| `../set/venus.js` | **New reusable block:** Venus's cloud deck, baked (an illustration in pale greys; no yellow, the channel has no warm hues) |

Rebuild: as episode 2's README (`E=films/channels/space/ep03`; lint with `--segment readout --bpm 56.25`).

## The direction
- **Close view** (hook, guesses, radar, the true turn): the camera follows Venus and looks across the Sun's
  direction, so Venus is half lit and the teal meridian pin ("you") crosses the terminator. The guesses play on
  the pin: 23 hours forwards (50,000×), then locked to face the Sun while the orbit runs (10⁶×). The truth: the
  orbit paused (badged) and the spin at 2,000,000×, backwards, with an arc arrow.
- **Diagram** (normal, whoa, takeaway, readout): both clocks at 4,000,000×; each sunrise (the pin's local hour
  falling through sunrise) drops a teal tick on Venus's orbit with a low ping. At the readout the clocks have
  stopped with Venus and Earth lined up (inferior conjunction) for the radar's round trip.
- **Spine readout** (left of the captions, centred): ? → 365 → 23 hours → 225 days → 243 → 243 > 225 → 117 →
  west → 117. Then the readout segment in the same place.
- **Loop:** the end card pushes back into the hook's close view. Footnote: "Radar first timed Venus's turn in 1962:
  about 243 days, backwards."

## Honesty notes (badges on screen)

| Badge | Where | Why |
|---|---|---|
| `clouds: illustration` | Hook; the close views | The cloud deck is drawn, not imaged; the real one is featureless in visible light |
| `not to scale` | The diagram | Venus, Earth and the Sun are enlarged |
| `10⁶× faster`, `50,000× faster`, `2,000,000× faster`, `4,000,000× faster` | From the clocks | |
| `orbit paused` | The true turn | The spin alone, so the 243-day turn is seen against a fixed Sun |

Drawing conventions: Venus's 2.6° axial tilt is drawn upright-ish (−2.64°, i.e. retrograde, as 177.4° is); the
pin stands on the equator; the guesses blend into each other over 0.4–0.8 s; the Sun is hidden in the close view
(it would fill a corner and bloom).
