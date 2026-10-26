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
| `compile.py` | The direction. One clock ("moon"): ×20,000 for the diagrams, ×120,000 while gravity is off (so the straight flight is seen), frozen for Newton's test, ×8 for the whoa's one minute (it plays in 7.5 s, ending after "And it does"), ×20,000 again through the takeaway, frozen for the readout |
| `scene.mjs` | The picture: Earth, the Moon and the orbit at true scale (1 unit = 10,000 km) |
| `../set/moon.js` | **New reusable block:** the Moon's surface, baked (an illustration: greys, maria placed roughly) |

## The direction
- **One shot, three views:** a close view on the Moon (hook and whoa), the diagram from above (normal, change,
  takeaway, readout) and a side view on the Earth–Moon line (Newton's test). The swing from the side view into the
  whoa goes in two legs (onto the Moon, halfway round and still far, then a push in), so the Moon never leaves the
  frame; the pull back after it goes in two stages too (out on the Moon to dist 200, then over to the diagram), with the
  orbit dimmed while its near arc sweeps up behind the caption. The end card pushes back into frame 0.
- **Frame 0 = the whoa's last frame:** the Moon a minute after leaving its straight line, with the gap (labelled
  "fall ×1,000,000"; the spine says "4.9 m below its straight line in one minute"). The subject sits right of centre so
  the labels and, in the whoa, the apple have the left half.
- **Gravity off:** the Moon itself flies on along its straight line at 120,000×, lit by a pale glow (its true disc is a
  pixel), with a trail behind it and the rest of the line dashed ahead ("no gravity: a straight line" under the line,
  behind the Moon; the orbit drawn faint). On "Gravity bends it back" it is bent back onto its orbit, angle and
  distance eased together so it swoops forward rather than sliding back (an illustration, under the "thought
  experiment" note), with the straight flight still drawn. Then a short straight line ahead of the Moon shows what
  the spine's "1.4 mm below its straight line each second" is measured from.
- **True scale throughout**, except three things, all badged: the Moon's fall below its straight line is drawn a
  million times larger (4.9 m → 4,900 km on screen), the apple is a glyph, and the hollow rings that mark Earth and
  the Moon are a fixed size in pixels.
- **Spine readout:** 4.9 m in a minute (the hook) → 30 Earths → 1 km a second → 5 min → 60 Earth radii → 1/3,600 → apple 4.9 m in
  a second → Moon 4.9 m in a minute → gravity. Then the readout segment.
- **Newton's test, drawn:** the apple just off Earth's limb with its own pull arrow (pointing at Earth's centre; its
  name taken over from Earth's, and gone before the ruler comes in, after which the story note names it), a lilac
  line wiped from the apple out to the Moon on "reaches the Moon", the ruler of 60 Earth radii above the line, and
  below it the pull's strength along the line (height ∝ 1/r², labelled "pull: 1/distance²", no moving head) drawn out
  from the apple to the Moon, complete on "weaker" (it is flat long before the Moon: 1/3,600). The orbit is dimmed
  while the ruler and the curve are up; the side view pushes in slowly (dist 250 → 230) meanwhile.
- **The whoa:** the apple's first second and the Moon's minute side by side at the same ×1,000,000, both drawn from the
  straight line to the body's centre in the same solid lilac (gravity), so the two 4.9 m falls are the same length on
  screen ("1 second", "1 minute"). The apple's second runs on the same ×8 clock as the Moon's minute: it waits on the
  line, then falls in a blink, while the Moon takes the 7.5 s. The spine's label steps to the Moon on "And it does".
- **The takeaway:** the Moon runs on round its orbit at 20,000× under a fan of the straight lines it keeps falling away
  from (each from one of its last dozen places on the orbit, 0.8° apart). The diagram is turned so the readout holds
  the Moon 30° left of the top, clear of the "real speed of light" note; its name arrives as the takeaway's speed note
  leaves.

## Honesty notes

| Badge | Where | Why |
|---|---|---|
| `falls ×1,000,000` (the hook's label: `fall ×1,000,000`) | Hook; the whoa, until the Moon is back on its orbit | The real gap after a minute is 4.9 m |
| `markers enlarged`, `true scale` (two tags) | The normal | Sizes and distances true; the hollow rings that mark Earth and the Moon are a fixed size in pixels |
| `20,000× faster`, `120,000× faster`, `8× faster` | From the clock (the normal, the change, the whoa, the takeaway) | The apple's first second in the whoa runs on the same ×8 clock |
| `thought experiment` | Gravity off, and the Moon bent back onto its orbit | |
| `the apple: a story, not to scale` | While the apple is drawn (Newton's test) | The anecdote is secondhand (Conduitt); the apple is a glyph |
| `real speed of light` | The readout | The ring takes 1.3 s of film to reach the Moon's distance |

The light-time ring is drawn just outside the orbit. Earth's spin runs on the same clock. The Moon keeps one face to
Earth (tidally locked), as drawn.
