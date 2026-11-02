# Back of the Envelope No. 006: "Every raindrop at once"

73.2 s, 9:16. The narrator is synthetic (Kokoro am_puck) and the score is original (studio preset `envelope-working`,
A lydian at 50 BPM). The bible's backup for idea 6 ("Every cat at once" has no measured meow loudness to stand on).
It pays off No. 005's tease ("what if a whole day's rain fell in one second?") and ends the season with "Next envelope:
walking to the Moon".

STATUS: draft under review (round 2). The measured scorecard follows the final.

## The story
On an ordinary day the sky lets go of nearly a Great Lake (about 1,400 km³: rain, snow and hail, NASA's water-cycle
budget), so thinly that we barely notice: like 80 Amazon rivers falling all day. Squeeze that day into one second and
the sky pours like 7 million Amazons at once. It sounds like a flood with nowhere to run, but the rain lands where it
always lands, 78% on the open ocean. Spread over the whole planet, a day's weather is a layer about 3 mm deep (2.8):
about two coins, stacked. Wetter or drier budgets barely change it (2.6–3.1 mm). So the sky's rain is a thin film,
spread wide; a storm is where it piles up (the record day: 1,825 mm, Réunion, 1966).

## Files

| File | What it is |
|---|---|
| `calc.py` | The day's volume, the pour in Amazons, the average depth, the sensitivity across budgets |
| `script.md`, `claims.json`, `pron.json` | The words (lint clean, Flow), the claims ledger (11 claims), pronunciations (none needed) |
| `voice.py`, `vo/` | am_puck, one Kokoro call and speed per sentence, measured pauses |
| `compile.py` | The direction → `film.json` and `sheet.json` |
| `scene.mjs` | The picture |
| `../set/rain06.js` | New set block: rain streaks (one LineSegments mesh, pure in t), water discs and columns, coins |

## The direction
- **Hook:** you under a full sky of rain, frozen mid-fall (frame 0 and the loop).
- **Normal:** the day passes on a clock (00:00 → 24:00) as a drizzle falls; the sum: 520,000 km³ ÷ 365 ≈ 1,400 km³;
  ÷ 24 h ≈ 80 Amazons. **Change:** the clock snaps to "1 second", then the downpour; the counter leaps to 6.9 million.
- **Why:** a waffle of 100 squares beside you lights on "lands": 78 ocean, 22 land (hatched).
- **Whoa:** down to a cross-section card at your feet, true to scale in mm: the water fills to 2.8 mm, two coins
  (1.52 mm each) slide in beside it; "≈ 3 mm" boxed. **Show your work:** the sum, an upper bound, a drier budget.
- **Takeaway:** a clean cut on "So" to you standing in a faint film ("3 mm, everywhere"); the record storm day's
  column (1.8 m) rises beside you, taller than you. The end card lifts back to frame 0.
