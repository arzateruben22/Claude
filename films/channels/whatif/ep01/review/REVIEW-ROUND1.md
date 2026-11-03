# No. 001 draft review, round 1 (30 Oct)

An independent agent reviewed `preview-ep01.mp4` (the Flow rewrite, A lydian 50, 540×960) in two lenses (text and
layout; picture and story), measured from extracted frames, and verified each finding before reporting.
Verdict: not ready (framing and text collisions); the numbers, badges, sound and loop passed.

| # | Finding (confirmed) | Fix |
|---|---|---|
| 1 | The globe cut off (8.5–13.8 s, 26.4–42.6 s); the gravity graph outside the safe box (x 930) | Camera pulled back and lowered (drive/fall 100 units at fy 0.44; the rest ×1.1 at fy 0.38); graph narrowed (X0 = R + 0.7, XS = 2.3/gmax) |
| 2 | The jump under the platform's top bar; the figure behind the top-left notes | Lower framing puts the rim near y 0.2; jump moved to "falling" |
| 3 | The spine's label had no plate (1.3:1 over the model) | `set/spine.js`: the label sits on the plate colour |
| 4 | "100 km/h" on the spine label | `l-car` below the car, leaves before "But" |
| 5 | A one-frame camera pop at 13.8 s (drive → fall) | The fall shot's first key equals the drive shot's last |
| 6 | Four one-word caption pages; "real / Earth" split | `captions(balance=True, keep=("real Earth", "the textbook's"))`: 29 pages, none shorter than two words a line |
| 7 | Picture behind / ahead of the voice: still figure over "Step in… gravity keeps pulling"; the swing 5 s before "swing" | Fall ×200 starts on "falling" and lands on "stop"; the whoa clock rests until "swing" |
| 8 | Source voice files clipped (vo03/04/05/07) | `voice.py` peaks each sentence at −1 dBFS; re-voiced (same timing) |
| 9 | End-card chip "No. 002" read as a mislabel | Kept: it is the channel's "follow" chip naming the next episode, the same form as Light Minute's; noted for the human review |
| 10 | "on the way up" while the figure moves down the screen; "≈ core" label | Line now "on the way out" (claims re-pointed); the core label is a plain part label |

Stills at every flagged moment checked after the fixes (animatic, 10 times). The final then rendered from this state.
