# Rest Frame No. 003, "Where does the bounce go?"

Episode 3 of Rest Frame, the physics channel (films/channels/physics). It is 67.5 s long, 9:16,
narrated by af_bella at speed 1.0 (a synthetic voice, labeled as AI). It pays off episode 2's tease ("a dropped ball,
bouncing back. It never reaches your hand.") and sets up episode 4. **Nothing has been posted.** A physicist signs off
the script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish; 26 Oct 09:08, QA PASS, −14.0 LUFS / −1.9 dBTP) | `out/rest-frame-003-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Twelve stills from the final | `review/stills-ep03.jpg` |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Why can't it reach your *hand*? Somewhere, nearly half its bounce disappeared." | The strobe of the drop and first rebound, frozen at the top, under an ink hand; the title drops |
| normal | "One meter down. Fifty-six centimeters back up. Then thirty-two. Then eighteen. Each bounce keeps just over *half* its height." | The drop and three bounces at ×1/3, drifting right like a strobe photograph, beside the meter stick; the tops labeled 56, 32 and 18 cm as each is said; the ink hand steps back to a third; the spine: bounce height, live |
| change | "Look closer. The knock: a puff of *sound*. The ball squashes, and doesn't spring back as *hard*." | A macro on one contact at ×1/40, frozen at the deepest squash until "spring", then back fully round; sound rings on "puff", labeled "sound" until the caption turns to the ball; the heat glow at the patch from "squashes", and from "back" a "heat" pill at the contact patch, beside the ball (its lower-left edge), gone 0.6 s before the cut; the spine: lost, this knock 44% |
| why | "We call that energy *lost*. James Joule wouldn't. … the water *warmed*. Energy doesn't vanish. It becomes heat, shaking and sound, spread too thin to *see*." | The ball and its glow step back to a third; Joule's paddle-wheel apparatus drawn in ink ("Joule's paddle wheel"), the weights falling and the thermometer rising; on "warmed." the label leaves, the ink steps back to a third and the red column carries "the water warms"; back to the ball with heat (the glow full again, its pill at the contact patch), shaking and sound named |
| whoa | "Balance it on a basketball. Drop both together. The basketball hands over most of its bounce. The tennis ball rockets past your *hand*." | The stack from 50 cm at ×1/4, perfect bounces (badged "Ideal bounces"), "your hand" on the hand that drops it; the camera rides up with the tennis ball to its 3.8 m peak on "hand.", a ladder of slowing ghosts below it, "7× its fall"; the spine stops on the peak and holds it, lit: tennis ball's peak 376 cm |
| measure | "*Measure it*: those missing forty-four centimeters? A quarter of a joule. Even if it all stays in the ball: about three thousandths of a *degree*." | The record of the bounces at full with the hand (100 cm) and the first top (56 cm): "44 cm missing", the spine: height missing 44 cm; on "A" the record and the hand step back to a third and the spine prices it: energy it took 0.245 J, then average warming, about 0.003 °C, lit from "degree." |
| takeaway | "A bounce never *destroys* energy. It gives it away, knock by knock." | The record, its ladder full again on "It gives it away"; the spine held lit: energy destroyed 0.000 J |
| tease | "Next: a hammer, a feather, the *Moon*. Nobody wins." | The hand, full again, re-drops the ball so the last frame is frame 0's moment; footnote: Joule's 1850 figure |

## Picture rules (WRITING.md, "The picture")

- **One world:** the bench throughout (the macro and Joule's drawing are camera moves within it); the whoa's stack stands beside the bench.
- **Spine readout** (between and below the top corners: centered, on the left in the change, the why and the whoa): bounce height (live) → lost, this knock 44% → tennis ball height (live) → tennis ball's peak 376 cm (held, lit) → height missing 44 cm → energy it took 0.245 J → average warming, about 0.003 °C (lit from "degree.") → energy destroyed 0.000 J (lit through the takeaway).
- **Human scale:** the ink hand at 1 m and the basketball.
- **Loop** to frame 0; **footnote** on the end card; **score** 0.8 in the whoa, 0.3 in the measure.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (155 spoken), 19 claims, the end-card footnote's claim, the pronunciation (Joule) |
| `vo/` | The voice: 8 WAVs, `lines.json`, `words.json` |
| `compile.py` | The direction → `film.json`, `sheet.json` |
| `scene.mjs` | The picture |
| `../set/balls.js`, `../set/ink.js` | **New reusable blocks**: the basketball and stacked drop; ink drawings (hands, Joule's apparatus) |
| `../set/spine.js`, `../set/captions_py.py`, `../set/aces.js` (`screenAlpha`) | Shared with the other episodes: the readout's place, the phrase-broken captions, the opacity at which a stepped-back mark keeps a third of its contrast on screen |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep03`.

## Kit and pipeline notes

- No kit file was changed.
- `f.at("vo04:Energy")` matched the first "energy" in the line ("We call that energy lost"), so a camera key and a fade
  fired 8 s early in the first animatic; anchors that repeat a word now use `#2`.
- The cyc wall is 4.2 m tall: the stack's peak (3.8 m) is framed so only a thin band above the wall shows, in the apps'
  own top zone.
- Rule 8 ("One line wins") is built in: `FILM.dim` drops what delivered the last beat to a third over 0.5 s from a cut or
  a word: the ink hand from the normal (full as the whoa's stack hand, and in the measure until "A"; full again in the
  tease, where it re-drops the ball), the ball and its glow from the why (the glow full again on "heat,"), Joule's ink on
  "warmed." (the red column carries it), the record's ghosts on "A" (full again on "It gives it away"). Labels leave with
  what they name; speed notes sit top-left (the hook's bottom-right, as the title owns the top), standing cheats
  top-right, at most two per corner (no framing tags). A third
  is a third of the mark's contrast on screen: opacity and the lerp toward the paper act in scene light, before the
  finish's ACES curve, so opacity 1/3 (or a two-thirds lerp) would keep only about 1/11; every step-back goes through
  `screenAlpha` (`../set/aces.js`), about 0.7 for a third.
- The coordinating session's fact audit (26 Oct, fa0e26b) changed the change ("doesn't spring back as hard": the ball
  regains its shape, not its push, c5) and the measure ("about three thousandths of a degree": a filled core, about
  1.5 J/(g·K), c12), and gave "James Joule wouldn't." its claim (c20); both changed lines were re-voiced.
