# Rest Frame No. 003, "Where does the bounce go?"

Episode 3 of Rest Frame, the physics channel (films/channels/physics). It is 66.9 s long, 9:16, narrated by af_bella
at speed 1.0 (a synthetic voice, labelled as AI). It pays off episode 2's tease ("a dropped ball, bouncing back. It never
reaches your hand.") and sets up episode 4. **Nothing has been posted.** A physicist signs off the script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish) | `out/rest-frame-003-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep03.jpg` |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Why can't it reach your *hand*? Somewhere, nearly half its bounce disappeared." | The strobe of the drop and first rebound, frozen at the top, under an ink hand; the title drops |
| normal | "One meter down. Fifty-six centimeters back up. Then thirty-two. Then eighteen. Each bounce keeps just over *half* its height." | The drop and three bounces at ×1/3, drifting right like a strobe photograph, beside the meter stick; the tops labelled |
| change | "Look closer. The knock: a puff of *sound*. The ball squashes, and doesn't quite spring *back*." | A macro on one contact at ×1/40, frozen at the deepest squash; sound rings; the heat glow at the patch |
| why | "We call that energy *lost*. James Joule wouldn't. … the water *warmed*. Energy doesn't vanish. It becomes heat, shaking and sound, spread too thin to *see*." | Joule's paddle-wheel apparatus drawn in ink, the weights falling and the thermometer rising; back to the ball with heat, shaking and sound named |
| whoa | "Balance it on a basketball. Drop both together. The basketball hands over most of its bounce. The tennis ball rockets past your *hand*." | The stack from 50 cm at ×1/4, perfect bounces (badged); the camera rides up with the tennis ball to its 3.8 m peak, a ladder of slowing ghosts below it |
| measure | "*Measure it*: those missing forty-four centimeters? A quarter of a joule. Even if it all stays in the ball, two thousandths of a *degree*." | The record of the bounces; "44 cm missing"; the spine prices it |
| takeaway | "A bounce never *destroys* energy. It gives it away, knock by knock." | The spine: energy destroyed 0.000 J |
| tease | "Next: a hammer, a feather, the *Moon*. Nobody wins." | Re-dropped so the last frame is frame 0's moment; footnote: Joule's 1850 figure |

## Picture rules (WRITING.md, "The picture")

- **One world:** the bench throughout (the macro and Joule's drawing are camera moves within it); the whoa's stack stands beside the bench.
- **Spine readout** (top left): bounce height → lost this knock 44% → tennis-ball height → 44 cm missing → 0.245 J → 0.0021 °C → energy destroyed 0.000 J.
- **Human scale:** the ink hand at 1 m and the basketball.
- **Loop** to frame 0; **footnote** on the end card; **score** 0.8 in the whoa, 0.3 in the measure.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (153 spoken), 19 claims, the end-card footnote's claim, the pronunciation (Joule) |
| `vo/` | The voice: 8 WAVs, `lines.json`, `words.json` |
| `compile.py` | The direction → `film.json`, `sheet.json` |
| `scene.mjs` | The picture |
| `../set/balls.js`, `../set/ink.js` | **New reusable blocks**: the basketball and stacked drop; ink drawings (hands, Joule's apparatus) |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep03`.

## Kit and pipeline notes

- No kit file was changed.
- `f.at("vo04:Energy")` matched the first "energy" in the line ("We call that energy lost"), so a camera key and a fade
  fired 8 s early in the first animatic; anchors that repeat a word now use `#2`.
- The cyc wall is 4.2 m tall: the stack's peak (3.8 m) is framed so only a thin band above the wall shows, in the apps'
  own top zone.
