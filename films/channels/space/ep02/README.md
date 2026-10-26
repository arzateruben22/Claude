# Light Minute No. 002: "The nearest star"

74.7 s, 9:16. Posts on **18 November 2026**, the day NASA says Voyager 1 reaches one light-day from Earth.
The narrator is synthetic (Kokoro am_michael) and the score is original (studio preset `lightminute-vacuum`).
It pays off episode 1's tease ("Next: leave for the nearest star today. When do we arrive?") and sets up
episode 3 ("Next: a world that turns slower than it orbits. And backwards.").

**Delivered (25 Oct):** `out/lightminute-002-9x16.mp4` (74.67 s, −14.1 LUFS / −1.8 dBTP, voice 12.2 LU over the music,
sync PASS, 0 flashes, 0 text warnings: `qa.py` PASS), with its poster (49.3 s), contact sheet, `review/scorecard.md`,
`HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md` and `assets.md`. It has not been posted.

## The story
Our farthest traveller, Voyager 1 (1977, about 17 km/s), crosses one light-day on 18 November 2026: every
command now waits a day, and the answer another day. It crossed into interstellar space in 2012, so is it
nearly there? It has not even reached the Sun's comet cloud (300 years away; 30,000 more to cross it). The
nearest star is about 1,550 light-days out: about 75,000 years at Voyager's speed, longer ago than our species
reached Europe. Voyager has crossed day one of fifteen hundred.

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
  closer than the word before: the spine readout changes on the first word of each number phrase.
- "Voyager 1" is written with the digit (as NASA writes it); the voice says "one" (lines.json phonemes).

## The direction
- **Shots:** the hook (frame 0: the local view, the speck that holds everything we've sent, Proxima far off), then
  **one continuous shot**: Voyager's flight (1977 → 2026 under a 200,000,000× speed note; the camera's distance
  grows with Voyager's, so it climbs to the same height in frame), the signal out to Voyager and the answer
  back (50,000×), the heliopause, a ×12 pull-back to the comet cloud, the episode's one scale jump to Proxima
  (1.9 s), the readout. The end card sits on the hook's composition, so a replay loops.
- **Spine readout** (WRITING.md "The picture", rule 2), one place at the left, its small label naming the beat:
  4.24 light-years to Proxima → year 1977–2026 → signal travel 24 h → command to answer 48 h → 2012 → 300 years
  to the comet cloud → 30,000 more → 1,550 light-days → 75,000 years → 1,550. Then the channel's readout
  segment in its usual place.
- **Ladder rungs**, all centred on the Sun: solar (1 unit = 1 AU), oort (1 AU), local (0.01 light-year).
- **Sound:** a ping when the command leaves and when the answer leaves; an arrival chime on Voyager and on
  Earth; the two zooms glide; decade ticks on the year counter. Energies build to the whoa (0.8) and drop for
  the takeaway (0.3).

## Honesty notes (badges on screen)

| Badge | Where | Why |
|---|---|---|
| `not to scale` | Throughout | The Sun's and Voyager's glows are sizes in pixels; Proxima's too |
| `path simplified` | The flight | Voyager's 1979–80 Jupiter and Saturn flybys are drawn as one smooth curve; the straight part runs at 3.556 AU/yr (16.9 km/s), so the drawn heliopause crossing is at 122.5 AU (the real one: 121.7 AU, 18.2 billion km) |
| `200,000,000× faster`, `50,000× faster` | The flight; the signal | From the clocks |
| `comet cloud: theory` | From "cloud" to the takeaway | No object in the distant Oort cloud has been seen. Drawn from 1,240 AU (Voyager's position plus 300 years) to 108,000 AU (plus 30,000 years), NASA's two figures |
| `Voyager isn't headed there` | From Proxima's arrival | Voyager 1 heads for Ophiuchus; Proxima is drawn up-right for the composition |
| `at today's distance` | With the 75,000 years | Proxima is approaching (about −22 km/s), so the trip time holds it still |

Other drawing conventions, for the reviewer:
- The light-day ring and the readout ring are drawn as great circles through Voyager (and Proxima) in the
  plane nearest the screen: the sphere of that radius, seen.
- At the solar scale "Earth" is labelled at the Sun (1 AU is under a pixel there).
- Proxima is a red dwarf; the channel has no warm hues, so it is drawn pale lemon-white, like every star label.
- The heliopause is drawn as a sphere; the real one is blunt on the nose side and stretched behind.

## Kit issues worked around here
- `hud.end`'s `next` line is sized for a call to action; the footnote's size and colour are set in `scene.mjs`.
- The year and signal counters read a frozen clock whose τ lands within float error of 48 h; they floor with a
  1e-3 h margin so "47 h" never shows.
- A counter's value text in the readout style is too wide at 17 characters ("4 years, 3 months"); its size is
  set to 5.5 vmin in `scene.mjs`.
