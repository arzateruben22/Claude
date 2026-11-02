# Back of the Envelope No. 004: "Count to a billion"

73.8 s, 9:16. The narrator is synthetic (Kokoro am_puck) and the score is original (studio preset `envelope-working`,
A lydian at 50 BPM). It pays off No. 003's tease and sets up No. 005 ("Next envelope: if everyone jumped at once, would
the Earth move?").

STATUS: **final with the render worker** (commit 5a8e05e, 2 Nov). The draft passed two review rounds (`review/`); the
measured scorecard is filled in from the worker's QA when it reports.

## The story
Can you count to a billion, out loud, every number? One a second sounds fair, and even that is about 32 years nonstop.
But numbers don't stay short: up in the hundreds of millions each one is a sentence (987,654,321 is 23 syllables,
about 9 seconds). We know the real pace because Jeremy Harper counted to a million on a webcast in 2007, sixteen hours a
day: it took him 89 days, most of a summer (2.6 syllables a second). At his pace and his hours, every number from one
to a billion (about 21 syllables each on average, 21 billion in all) takes about 380 years: nearly four centuries, five
lifetimes. Never sleep (≈ 260 yr), talk twice as fast (≈ 190 yr) or say "hundred and" (≈ 430 yr): still centuries.
The word "one billion" is three syllables; the number is out of reach one by one.

## Files

| File | What it is |
|---|---|
| `calc.py` | Every number: exact syllables of every number word from 1 to 10⁹ (no sampling; American names), Harper's measured pace, the 16-hour day, the sensitivity table |
| `script.md`, `claims.json`, `pron.json` | The words (lint clean, Flow: four figures spoken), the claims ledger (9 claims), pronunciations (none needed) |
| `voice.py`, `vo/` | am_puck, one Kokoro call and speed per sentence, measured pauses (ep01's method) |
| `compile.py` | The direction → `film.json` and `sheet.json` |
| `scene.mjs` | The picture, staged from `film.json` |
| `../set/tape04.js` | New set block: paper sheets with canvas-drawn faces (the slips, the calendar, the ruler), and the American number-name speller used for the slips |
| `sound/` | The delivery soundtrack (studio mix) and its QA |
| `review/` | Draft previews, the review rounds, `HUMAN-REVIEW.md`, `scorecard.md` |

## The direction
- **One line up the desk**, so it climbs the vertical frame: the counting tape (one paper slip per number, longer the
  more syllables it takes to say, a marker dot per syllable), Harper's calendar beyond it, the ruler of centuries beyond
  that. The camera moves up the line; the takeaway pushes back down it to the foot (no cut).
- **Hook:** you (anchor blue) at the tape's foot, slips 1, 2, 3. **Normal:** a slip lands every second with a pencil
  tick, the clock counts (number − 1 seconds), the spine resolves to 32 yr; the camera lifts as the slips ahead grow.
- **Change:** a fast fly up the tape (badged "skipping ahead") to 987,654,321, whose words and dots light as "you have
  to say all of it". **Why:** Harper by his calendar, a square a day filling as the counter climbs to 1,000,000;
  the months light on "summer". **Whoa:** a scale jump back to the ruler of centuries: it fills to 380 years with the
  years counter, the box closes on "four", the naive 32 years bracketed in chalk, five blue lifetimes land beside it.
- **Show your work:** the whole sum on the card's first row; never sleep, twice as fast, British "hundred and".
- **Takeaway:** back at the foot, a "one billion" slip lands after 1, 2, 3 and a "…": no longer than "seven".
- **Loop:** the end card lifts over the last 0.6 s; the last frame is frame 0's composition without the title.
