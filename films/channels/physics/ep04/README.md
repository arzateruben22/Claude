# Rest Frame No. 004, "The hammer and the feather"

Episode 4 of Rest Frame, the physics channel (films/channels/physics). It is 72.0 s long, 9:16, narrated by af_bella
at speed 1.0 (a synthetic voice, labelled as AI). It pays off episode 3's tease ("Next: a hammer, a feather, the Moon.
Nobody wins.") and sets up episode 5. **Nothing has been posted.** A physicist signs off the script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish) | `out/rest-frame-004-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep04.jpg` |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Which lands *first*? A geology hammer, or a falcon feather?" | On the Moon dressing at ×1/10: both mid-fall, their ghost rows level and joined by rungs; frozen on the question |
| normal | "On Earth, it's no contest. From shoulder height, the hammer lands in about half a *second*. The feather is barely halfway." | Earth at ×1/4: the hammer lands on "second" (0.57 s); the feather's drift (an illustration) is frozen halfway |
| change | "Now take the air away. On the Moon, in nineteen seventy-one, astronaut David Scott dropped both. They landed *together*. 'Mister Galileo was correct in his findings,' he said." | The regolith floor fades in; the drop in real time, both landing on "together" (1.41 s); Scott's words on a card |
| why | Aristotle; gravity pulls the hammer harder; a heavier thing is harder to speed up by *exactly* as much; without air, they tie | Weight arrows (badged not to scale), then equal acceleration arrows; re-dropped at ×1/2, tying on "tie" |
| whoa | "How exact is *exactly*? Starting in twenty sixteen, a satellite let two metals fall around Earth for months. They matched to within a few parts in a million *billion*." | An ink Earth with the satellite's orbit to scale; the spine: < 3 × 10⁻¹⁵ |
| measure | "*Measure it*: on the Moon, that drop takes about one point four *seconds*. On Earth, under six tenths." | The Moon drop in real time with the stopwatch spine |
| takeaway | "Gravity treats them equally. Only the *air* tells them apart." | The ghost rows held level |
| tease | "Next: a spinning office chair. Pull in your arms, and you accelerate. *Why*?" | Back to the hook's moment for the loop; footnote: the falcon feather, the lunar module Falcon |

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (166 spoken), 15 claims, the footnote's claim, pronunciations (Aristotle, Galileo) |
| `vo/`, `compile.py`, `scene.mjs` | The voice, the direction, the picture |
| `../set/moon.js` | **New reusable block**: the Moon dressing (regolith floor), a geological hammer, a falcon feather |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep04`.
