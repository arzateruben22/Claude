# Light Minute No. 002: "The nearest star"

74.7 s, 9:16. Posts on **18 November 2026**, the day NASA says Voyager 1 reaches one light-day from Earth.
The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset `lightminute-vacuum`).
It pays off episode 1's tease ("Next: leave for the nearest star today. When do we arrive?") and sets up
episode 3 ("Next: a world that turns slower than it orbits. And backwards.").

**Delivered 25 Oct; rechecked, audited and re-laid-out 26 Oct:** the fresh final is in the render queue (STATUS:
see `review/scorecard.md`). The flight now climbs to the right, so the signal, the 2012 crossing and the roads to the
comet cloud run clear of the spine on the left. **After the draft review (26 Oct)** the picture was fixed again (see
"The direction" and `review/HUMAN-REVIEW.md`); it needs a fresh `--cues` pass, audio mix and final. It has not been posted.
**After the second draft review (26 Oct):** the scale jump now shows the comet cloud's rim shrinking into the speck, the
road on through the cloud runs off the frame (30,000 years against 300), the light-day ring passes through Voyager,
Voyager is a bigger pale-ice light and the Sun a white one (beacon sizes now hold at every resolution), nothing of the
picture sits under the end card, notes leave one at a time, and some labels and caption pages were re-timed. It needs a
new draft check, `--cues` pass, audio mix and final.

## The story
Our farthest traveller, Voyager 1 (1977, about 17 km/s), crosses one light-day on 18 November 2026: its signal takes a
day to reach us, a command a day to get there and the answer a day to come back. It crossed into interstellar space
in 2012, so is it nearly there? It has not even reached the Sun's comet cloud (about 300 years away; maybe 30,000
more to cross it). The nearest star is about 1,500 light-days out (1,549): about 75,000 years at Voyager's speed; count back
that far and our species wasn't in Europe. So we've barely left for the stars: Voyager has crossed day one of
fifteen hundred.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json` | The words, the claims ledger (19 claims) and the pronunciations |
| `voice.py` | Voices the script with one Kokoro speed per line (ep01's wrapper around tts.py) |
| `vo/` | 8 WAVs, `lines.json` (each line's speed) and `words.json` (align.py) |
| `compile.py` | The direction: shots, clocks, camera keys, the ladder, labels, badges, the spine readout, pills, title and end card, all hung on spoken words. Writes `film.json` and `sheet.json` |
| `scene.mjs` | The picture, a pure function of t |
| `../set/beacon.js` | **New reusable block:** a constant-pixel glow for stars and probes at any rung of the scale ladder |
| `../set/comets.js` | **New reusable block:** the Oort cloud as a thick shell of points (log-uniform radii), shown under a "theory" badge |
| `../set/capglue.py` | **New reusable helper (26 Oct):** keeps number phrases ("nineteen seventy-seven", "thirty thousand") on one caption line, and holds each page until its last phrase has been spoken |
| `review/` | stills, scorecard, human review, claims sign-off |

## Rebuild
From the repo root, with `E=films/channels/space/ep02` and `$CINEMA_VOICE` the voice venv and models
(`kits/cinema/voice/setup.sh`):

```
$CINEMA_VOICE/venv/bin/python -I $E/voice.py --models $CINEMA_VOICE/models
$CINEMA_VOICE/venv/bin/python -I kits/cinema/voice/align.py $E/vo $CINEMA_VOICE/models
python3 -I kits/cinema/script/lint.py $E --segment readout --bpm 56.25
python3 -I $E/compile.py
node kits/cinema/film/render.mjs --film $E --cues
python3 -I $E/compile.py
(cd $E && python3 -I ../../../../kits/cinema/studio/render.py sheet.json build/audio --root .)
node kits/cinema/film/render.mjs --film $E --tier final --times 0,8.5,20.6,25,29.5,36.5,42,48.5,59,64.5,67.5,72 --build $E/build/stills
kits/cinema/film/run.sh $E --tier final
node kits/cinema/film/render.mjs --film $E --tier final --assemble --audio $E/build/audio/mix.wav
cp $E/build/final/9x16/contact-sheet.jpg $E/out/lightminute-002-9x16-contact.jpg
python3 -I kits/cinema/film/qa.py $E && python3 -I kits/cinema/film/scorecard.py $E
```

## Voice
- Speeds per line: hook 0.85, normal 1.16, change 1.1, why 1.15, whoa 1.16, takeaway 0.97, readout 1.1, tease 0.9.
  Every line runs 2.4–3.0 words/s; the film lays out to 74.67 s on the 56.25 BPM grid.
- The recognizer writes numbers as digits ("1977", "300", "75,000"), which align.py maps to words only up to
  100, so the times of "nineteen seventy-seven", "twenty twelve", "three hundred", "thirty thousand", "fifteen
  hundred" and "seventy-five thousand" are interpolated inside their lines (lint warns). Nothing lands on them
  closer than the word before: the spine readout changes on the first word of each number phrase. For the caption
  highlight only, `compile.py` spreads such a run's word starts by character share ("light-days" lights at 44.9 s).
- "Voyager 1" is written with the digit (as NASA writes it); the voice says "one" (lines.json phonemes).

## The direction
- **Shots:** the hook (frame 0: the local view, the speck that holds everything we've sent, Proxima far off; a slow
  push-in), then
  **one continuous shot**: a slow push-in to the launch spot (Voyager starts just right of the Sun, clear of its glow),
  Voyager's flight (1977 → 2026 under a 250,000,000× speed note, from just after "nineteen seventy-seven" is said,
  climbing to the right of the Sun; the camera's distance grows with Voyager's, so it climbs to the same height in
  frame), the signal out to Voyager and the answer back (50,000×), the heliopause, a ×12 pull-back to the comet cloud
  (the cloud steps back while the road to it is told; the road on through it grows in log scale off the frame, so
  30,000 years reads 100× the 300), the episode's one scale jump to Proxima (2.0 s; the cloud's points go in its
  first 0.9 s while its rim shrinks with the zoom into the speck, gone by 1.25 s; Proxima fades in below the
  top-right notes, then the Sun steps back so Proxima wins the whoa), a push in through the whoa (Proxima rises about
  135 px at 1080 × 1920) and back out for the readout, a pulse of light down the lane on "fifteen hundred" (2.4 s;
  Proxima flares as it arrives) and a quicker one on the takeaway's "of fifteen hundred" (1 s, its lit lane gone
  before the readout), the readout (the speck pings on "one day"). The Sun also steps back while Voyager is the
  subject (from its name until its signal leaves, and the 2012 crossing). The end card's camera returns to the hook's
  pose, so a replay continues the move; the Sun, Proxima and the speck step back just before the card (nothing sits
  under its title), and the loop's first frame brings the picture back with the hook.
- **Labels** on moving anchors keep one placement each (fixed: no hopping): Voyager's name on its right
  (clear of the spine), the fronts' names ("signal", "command", "answer") riding their fronts once clear of Voyager,
  "1 light-day" over the ring's top, left of Voyager's name, "comet cloud" up-left of the road, the speck's labels on
  its rim's left ("Voyager 1" while the trip at its speed is told, "day 1", then "Voyager 1" for the readout).
  The 2012 crossing is named by the spine and its tick only, and the speed only by the caption. "Proxima Centauri"
  leaves with "day 1", as the readout arrives (the readout's "1 day" plate sits just above the pill; its own label
  names Proxima from "To Proxima"). Labels that run to a cut fade out before it, so nothing pops off. Notes that
  share a corner leave one at a time (the corner reflows with a leaving note's fade).
- **Spine readout** (WRITING.md "The picture", rule 2), one place at the left, its small label naming the beat:
  4.24 light-years to Proxima → year 1977–2026 → signal travel 24 h → command to answer 48 h → 2012 (out of the Sun's
  wind) → ≈300 years to the comet cloud → ≈30,000 more → ≈1,500 light-days → ≈75,000 years at 17 km/s (its value a size
  smaller, so the lane to Proxima passes clear of the plate) → ≈1,500 (as the voice
  says them: "about fifteen hundred", "about seventy-five thousand"; 1,549 and 74,800 computed). Then the readout
  segment, here above Proxima (y 0.27) so it doesn't sit on the star or its lane.
- **Ladder rungs**, all centred on the Sun: solar (1 unit = 1 AU), oort (1 AU), local (0.01 light-year).
- **Sound:** a ping when the command leaves and when the answer leaves; an arrival chime on Voyager and on
  Earth; the two zooms glide; decade ticks on the year counter. Energies build to the whoa (0.8) and drop for
  the takeaway (0.3).

## Honesty notes (badges on screen)

| Badge | Where | Why |
|---|---|---|
| `not to scale` | Throughout | The Sun's and Voyager's glows are sizes in pixels; Proxima's too |
| `path simplified` | The flight, until the pull-back has shrunk the flybys' curve into the Sun's glow (3–6 px) | Voyager's 1979–80 Jupiter and Saturn flybys are drawn as one smooth curve; the straight part runs at 3.556 AU/yr (16.9 km/s), so the drawn heliopause crossing is at 122.5 AU (the real one: 121.7 AU, 18.2 billion km) |
| `250,000,000× faster`, `50,000× faster` | The flight; the signal | From the clocks |
| `light sped up` | While each pulse runs the lane to Proxima (top left) | The pulses cover 4.24 light-years in 2.4 s and 1 s |
| `comet cloud: theory` | From "cloud" until the cloud's rim has shrunk away in the jump (1.35 s in) | No object in the distant Oort cloud has been seen. Drawn from 1,240 AU (Voyager's position plus 300 years) to 108,000 AU (plus 30,000 years), NASA's two figures |
| `Voyager isn't headed there` | In the hook (which draws the lane), and from Proxima's arrival | Voyager 1 heads for Ophiuchus; Proxima is drawn up-right for the composition |
| `at today's distance` | With the 75,000 years | Proxima is approaching (about −22 km/s), so the trip time holds it still |

Other drawing conventions, for the reviewer:
- The light-day ring and the readout ring are drawn as great circles through Voyager (and Proxima) in the
  plane nearest the screen: the sphere of that radius, seen. The light-day ring, the command's front and the
  heliopause circle are scaled by the point's depth, so they pass through Voyager and the 2012 tick as seen.
- At the solar scale "Earth" is labelled at the Sun (1 AU is under a pixel there).
- Proxima is a red dwarf; the channel has no warm hues, so it is drawn pale lemon-white, like every star label.
- The heliopause is drawn as one circle on the screen through the 2012 crossing (in ice: a boundary, not light);
  the real one is blunt on the nose side and stretched behind.
- The speck (one light-day around the Sun) is drawn at least 30 px in radius (at a 1080-px short side), so it shows
  as a ring around the Sun's core and a label's dot; the lane to Proxima starts on its rim.
- A frame's motion blur never blends the hook and the solar view across the cut (`scene.mjs` renders such a frame
  at its own time).

## Kit issues worked around here
- `hud.end`'s `next` line is sized for a call to action; the footnote's size and colour are set in `scene.mjs`.
- The year and signal counters read a frozen clock whose τ lands within float error of 48 h; they floor with a
  1e-3 h margin so "47 h" never shows.
- A counter's value text in the readout style is too wide at 17 characters ("4 years, 3 months"); its size is
  set to 5.5 vmin in `scene.mjs`.
- The end card's follow pill straddled the end ring; the footnote's margin (2.5 vmin) and the pill's (1.8 vmin) are
  set in `scene.mjs`, as in episodes 3–6.
- The ice and text tokens' linear solves have huge blue channels (and ice a negative red), so a beacon fed a token
  haloed royal blue; `set/beacon.js` has no separate halo colour (a shared change, not made here), so `scene.mjs` gives
  Voyager a pale ice light ([1.2, 1.65, 2.9]) and the Sun a white one ([2.3, 2.45, 3.0]), and clamps the teal glows'
  negative red at zero.
- `set/beacon.js` sizes a beacon in render pixels, so `scene.mjs` scales every beacon by the short side over 540
  (as episode 5 does): the final keeps the reviewed draft's proportions.
