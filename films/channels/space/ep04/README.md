# Light Minute No. 004: "The falling Moon"

74.1 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 3's tease ("Next: the Moon never stops falling toward us. So why doesn't
it land?") and sets up episode 5 ("Next: pour Earths into the Sun. How many to fill it up?").

**Delivered (26 Oct, after the recheck and the script audit):** `out/lightminute-004-9x16.mp4` (74.13 s, −14.1 LUFS /
−1.8 dBTP, voice 12.5 LU over the music, sync PASS, 0 flashes, 0 text warnings: `qa.py` PASS), with its poster
(51.7 s), contact sheet and `review/`. Not posted.

## The story
What's holding the Moon up? Nothing: it's falling. It is about thirty Earths away and moves sideways at about a
kilometer a second (New York to Boston in five minutes). Switch gravity off and it would fly off in a straight line;
gravity bends it back toward us. So it falls, and always misses. The heavens, people believed, had their own rules.
Newton, the story goes, wondered if the pull that drops an apple reaches the Moon: sixty times farther from Earth's
centre, and gravity fades with distance squared, so thirty-six hundred times weaker. Then in one minute the Moon should fall as far as an apple falls in one second: about five
meters. And it does. So the pull that drops an apple is the same pull that keeps the Moon falling.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words and the claims ledger (18 claims) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 0.85, normal 1.05, change 1.0, why 1.1, whoa 0.9, takeaway 0.8, readout 1.0, tease 0.8) |
| `compile.py` | The direction. One clock ("moon"): ×20,000 for the diagrams, ×120,000 while gravity is off (so the straight flight is seen), frozen for Newton's test, ×8 for the whoa's one minute (it plays in 7.5 s, ending after "And it does") |
| `scene.mjs` | The picture: Earth, the Moon and the orbit at true scale (1 unit = 10,000 km) |
| `../set/moon.js` | **New reusable block:** the Moon's surface, baked (an illustration: greys, maria placed roughly) |

## The direction
- **One shot, three views:** a close view on the Moon (hook and whoa), the diagram from above (normal, change,
  takeaway, readout) and a side view on the Earth–Moon line (Newton's test). The end card pushes back into frame 0.
- **Frame 0 = the whoa's last frame:** the Moon a minute after leaving its straight line, with the gap (labelled
  "fall ×1,000,000"; the spine says "4.9 m below its straight line in one minute"). The subject sits right of centre so
  the labels and, in the whoa, the apple have the left half.
- **Gravity off:** the Moon itself flies on along its straight line at 120,000× (the orbit drawn faint), then is drawn
  back onto its orbit as "Gravity bends it back" (an illustration, under the "thought experiment" note).
- **True scale throughout**, except two things, both badged: the Moon's fall below its straight line is drawn a
  million times larger (4.9 m → 4,900 km on screen), and the apple is a glyph.
- **Spine readout:** 4.9 m in a minute (the hook) → 30 Earths → 1 km a second → 5 min → 60 Earth radii → 1/3,600 → apple 4.9 m in
  a second → Moon 4.9 m in a minute → gravity. Then the readout segment.
- **Newton's test, drawn:** the apple just off Earth's limb with its own pull arrow (pointing at Earth's centre), the
  ruler of 60 Earth radii above the line, and below it the pull's strength along the line (height ∝ 1/r²) drawn out
  from the apple to the Moon, complete on "weaker" (it is flat long before the Moon: 1/3,600).
- **The whoa:** the apple's first second and the Moon's minute side by side at the same ×1,000,000, both drawn from the
  straight line to the body's centre, so the two 4.9 m falls are the same length on screen ("1 second", "1 minute").

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `falls ×1,000,000` (the hook's label: `fall ×1,000,000`) | Hook; the whoa, until the Moon is back on its orbit | The real gap after a minute is 4.9 m |
| `true scale · markers not to scale` | The normal | Sizes and distances true; the hollow rings that mark Earth and the Moon are a fixed size in pixels |
| `20,000× faster`, `120,000× faster`, `8× faster` | From the clock | |
| `thought experiment` | Gravity off, and the Moon drawn back onto its orbit | |
| `the apple: a story, not to scale` | While the apple is drawn | The anecdote is secondhand (Conduitt); the apple is a glyph |

The light-time ring is drawn just outside the orbit. Earth's spin runs on the same clock. The Moon keeps one face to
Earth (tidally locked), as drawn.
