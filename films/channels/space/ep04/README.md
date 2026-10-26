# Light Minute No. 004: "The falling Moon"

73.1 s, 9:16. The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset
`lightminute-vacuum`). It pays off episode 3's tease ("Next: the Moon never stops falling toward us. So why doesn't
it land?") and sets up episode 5 ("Next: pour Earths into the Sun. How many to fill it up?").

**Delivered (26 Oct):** `out/lightminute-004-9x16.mp4` (73.07 s, −14.1 LUFS / −1.9 dBTP, voice 12.5 LU over the music,
sync PASS, 0 flashes, 0 text warnings: `qa.py` PASS), with its poster (50.6 s), contact sheet and `review/`. Not posted.

## The story
What's holding the Moon up? Nothing: it's falling. It is about thirty Earths away and moves sideways at about a
kilometer a second (New York to Boston in five minutes). Switch gravity off and it would fly off in a straight line;
gravity bends it back, every moment. The heavens, people believed, had their own rules. Isaac Newton, the story goes,
wondered if the pull that drops an apple reaches the Moon: sixty times farther from Earth's centre, so thirty-six
hundred times weaker. Then in one minute the Moon should fall as far as an apple falls in one second: about five
meters. And it does. So the pull that drops an apple is the very same pull that holds the Moon.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words and the claims ledger (18 claims) |
| `voice.py`, `vo/` | Voiced one Kokoro speed per line (hook 0.85, normal 1.05, change 1.0, why 1.1, whoa 0.9, takeaway 0.8, readout 1.0, tease 0.8) |
| `compile.py` | The direction. One clock ("moon"): ×100,000 for the diagrams, frozen for Newton's test, ×8 for the whoa's one minute (it plays in 7.5 s, ending after "And it does") |
| `scene.mjs` | The picture: Earth, the Moon and the orbit at true scale (1 unit = 10,000 km) |
| `../set/moon.js` | **New reusable block:** the Moon's surface, baked (an illustration: greys, maria placed roughly) |

## The direction
- **One shot, three views:** a close view on the Moon (hook and whoa), the diagram from above (normal, change,
  takeaway, readout) and a side view on the Earth–Moon line (Newton's test). The end card pushes back into frame 0.
- **Frame 0 = the whoa's last frame:** the Moon a minute after leaving its straight line, with the gap.
- **True scale throughout**, except two things, both badged: the Moon's fall below its straight line is drawn a
  million times larger (4.9 m → 4,900 km on screen), and the apple is a glyph.
- **Spine readout:** 1.4 mm a second → 30 Earths → 1 km a second → 5 min → 60 Earth radii → 1/3,600 → apple 4.9 m in
  a second → Moon 4.9 m in a minute → gravity. Then the readout segment.
- **Newton's test, drawn:** the pull's arrow slides out from the apple to the Moon along the ruler of 60 Earth radii,
  its length falling as 1/r² (it is invisible by the time it reaches the Moon: 1/3,600).

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `fall drawn ×1,000,000` | Hook; the whoa | The real gap after a minute is 4.9 m |
| `true scale` | The normal | Sizes and distances true |
| `100,000× faster`, `8× faster` | From the clock | |
| `thought experiment` | Gravity off | |
| `the apple: a story`, `apple not to scale` | Newton's test | The anecdote is secondhand (Stukeley, Conduitt) |

The light-time ring is drawn just outside the orbit. Earth's spin runs on the same clock. The Moon keeps one face to
Earth (tidally locked), as drawn.
