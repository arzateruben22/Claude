# Light Minute No. 003: "Venus day"

74.7 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 2's tease ("Next: a world that turns slower than it orbits. And
backwards.") and sets up episode 4 ("Next: the Moon never stops falling toward us. So why doesn't it land?").

**Delivered (26 Oct), rechecked and re-rendered (26 Oct):** `out/lightminute-003-9x16.mp4` (74.67 s, −14.1 LUFS /
−1.8 dBTP, voice 12.3 LU over the music, sync PASS, 0 flashes, 0 text warnings: `qa.py` PASS; 2.0 Mbps at CRF 15), with
its poster (50.4 s), contact sheet and `review/` (scorecard round 4 lists the recheck's fixes). It has not been posted.

**After the draft review (26 Oct):** `compile.py` and `scene.mjs` carry the review's confirmed fixes (the direction and
the honesty notes below describe them). That cut has not been rendered yet: the MP4 above predates it, and a stills
check comes before the final.

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
| `compile.py` | The direction. Two scene clocks for Venus, "orbit" and "spin", plus "guess" for the Cassinis' 23 hours; piecewise constant (one linear stop), integrated here as clock.js does, so the sunrise ticks (7, from 43.4 s, every 2.52 s = 116.75 days) and the inferior conjunction at the readout are computed |
| `scene.mjs` | The picture: one shot that follows Venus in close (rig.js's `poseAt` with a follow weight) and pulls back to the diagram |
| `../set/venus.js` | **New reusable block:** Venus's cloud deck, baked (an illustration in pale greys; no yellow, the channel has no warm hues) |

Rebuild: as episode 2's README (`E=films/channels/space/ep03`; lint with `--segment readout --bpm 56.25`).

## The direction
- **Close view** (hook, guesses, radar, the true turn): the camera follows Venus and looks across the Sun's
  direction, so Venus is half lit and the teal meridian pin ("you") crosses the terminator. The hook pushes in
  slowly; the change beat orbits 10° (0.7° a second). The pin fades while it would show only as a blip on the far
  pole. The guesses play on the pin: 23 hours forwards (50,000×), then locked to face the Sun while the orbit runs
  (1,000,000×), with a dashed teal pointer from the pin toward the off-frame Sun. For the radar, Venus eases left so
  the dashed beam (Earth to Venus) and its ping have room; the pin dims under it. The truth: the orbit paused
  (badged) and the spin at 1,000,000×, backwards: the pin crosses the face through "backwards", under an arc arrow
  with a large head (no label: the caption says it).
- **Diagram** (normal, whoa, takeaway, readout): the pull to it rises over Venus first, so Venus never turns its night
  side to the camera on "Stand there"; the Sun grows in late in each pull, below the notes. "you" hangs just above
  Venus's disc. Both clocks run at 4,000,000×; each sunrise (the pin's local hour falling through sunrise) drops a
  teal tick on Venus's orbit with a low ping, and "a sunrise" names the first one after "you" has gone ("rising in
  the west"). The clocks slow to a stop with Venus and Earth lined up (inferior conjunction). The readout holds on
  the light-time ring (it grows with "Light time, Sun to Venus", "6 min" at its foot), then pushes onto Venus and
  Earth for the radar's round trip: a ping runs between their drawn limbs, "4 min round trip" at the middle.
- **Your sky** (the whoa, under the captions): a horizon dial laid out as a sky seen facing south on Earth (east on
  the left), so the Sun visibly rises on the right, in the west, and crosses the other way from Earth's.
- **Spine readout** (above the captions, centred): ? → 365 → 300 → 23 hours → 225 days → 1962 → 243 → 243 > 225 →
  117 → west → 243 > 225 → 117 < 225. Then the readout segment in the same place (6 min, then 4 min with "round").
- **Loop:** the end card pushes back into the hook's close view; Earth shrinks away under the card. Footnote:
  "Radar first timed Venus's turn in 1962: about 243 days, backwards."

## Honesty notes (badges on screen)

| Badge | Where | Why |
|---|---|---|
| `clouds: drawn` | Hook (bottom left, until the pull has taken the deck out of frame); the close views | The cloud deck is drawn, not imaged; the real one is featureless in visible light |
| `not to scale` | The diagram | Venus, Earth and the Sun are enlarged |
| `1,000,000× faster`, `50,000× faster`, `4,000,000× faster`, `slowing to a stop` | From the clocks (one note at a time, top left) | The orbit and the spin are sped up; the last note holds while they slow to the readout's stop |
| `orbit paused` | The true turn | The spin alone, so the 243-day turn is seen against a fixed Sun |
| `light sped up` | The readout | The light-time ring crosses 108 million km in 1.2 s and the ping makes the 4-minute round trip in 2 s |

Drawing conventions: Venus's 2.6° axial tilt is drawn upright-ish (−2.64°, i.e. retrograde, as 177.4° is); the
pin stands on the equator; the guesses blend into each other over 0.4–0.8 s; the Sun is hidden in the close views
and in the readout's push (it shrinks away with the move: it would fill a corner and bloom); Earth is drawn brighter
on the diagram; Schiaparelli's pointer and the radar's dashed beam are diagram marks; the "your sky" dial
shows where the Sun is, behind the clouds (its note says so).
