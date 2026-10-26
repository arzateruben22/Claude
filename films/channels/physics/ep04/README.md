# Rest Frame No. 004, "The hammer and the feather"

Episode 4 of Rest Frame, the physics channel (films/channels/physics). It is 72.0 s long (as first built; the 26 Oct
audit's re-voiced lines lengthened the direction to 72.3 s, and the final, not rendered yet, renders on it with the
rule-8 fix), 9:16, narrated by af_bella at speed 1.0 (a synthetic voice, labeled as AI). It pays off episode 3's tease
("Next: a hammer, a feather, the Moon. Nobody wins.") and sets up episode 5. **Nothing has been posted.** A physicist
signs off the script before it posts.

| | |
|---|---|
| **Final** (1080×1920, 30 fps, full finish; not rendered yet: it renders on the current direction) | `out/rest-frame-004-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Ten final-tier stills | `review/stills-ep04.jpg` (made from the final) |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "Which lands *first*? A geology hammer, or a falcon feather?" | On the Moon dressing at ×1/10: both mid-fall, their ghost rows level and joined by rungs, "hammer" and "feather" named as each is said; frozen on the question; the title drops (the hook's speed note sits bottom right, clear of it) |
| normal | "On Earth, it's no contest. From shoulder height, the hammer lands in about half a *second*. The feather? Still drifting down." | Earth (the paper floor) at ×1/4: the hammer lands on "second" (0.57 s, labeled until "feather"), then the clock pauses; on "feather" the hammer and its ghost row step back to a third; the feather's drift (an illustration, tagged "Illustration") is frozen about a third of the way down, "still drifting" on it from "Still"; the spine: the hammer's fall, Earth, 0.57 s |
| change | "Now take the air away. On the Moon, in nineteen seventy-one, astronaut David Scott dropped both. They landed *together*. 'Mister Galileo was correct in his findings,' he said." | The regolith floor fades in, and the Moon card stands; the Earth's result (both ghost rows) stays behind at a third until the Moon's release; the ink hands step back to a third, full for "astronaut David Scott dropped both"; the drop in real time, both landing on "together" (1.41 s); Scott's words on a card; the spine: both, on the Moon, 1.41 s |
| why | Aristotle; gravity pulls the hammer harder; a heavier thing is harder to speed up by *exactly* as much; without air, they tie | Gravity's pull arrows on "Gravity", drawn below each object ("pulled far harder" on the hammer's; badged "Not to scale"), stepping back to a third on "But" until they retract; then equal acceleration arrows ("same speed-up"); re-dropped at ×1/2, tying on "tie"; the spine: each one's acceleration (m/s²), 1.62 |
| whoa | "How exact is *exactly*? Starting in twenty sixteen, a satellite let two metals fall around Earth for months. They matched to within a few parts in a million *billion*." | An ink Earth with the satellite's orbit to scale (tagged "Illustration" for 4 s; Earth labeled at its center from "Earth"; a "MICROSCOPE" card names the mission); the Earth's ring steps back to a third on "satellite" (full again on "around"), the Earth and the orbit on "They" (the satellite and its two metals stay full); the spine, top left: "< 5" parts in a million billion, lit from "billion." |
| measure | "*Measure it*: on the Moon, that drop takes about one point four *seconds*. On Earth, under six tenths." | The Moon drop in real time with the stopwatch spine (the drop, Moon, 1.41 s, lit from "seconds."); on "On Earth" the drop steps back to a third and the spine reads the same drop, Earth, 0.57 s |
| takeaway | "Gravity speeds them up equally. Only the *air* tells them apart." | The ghost rows held level, full again from the cut; the spine held lit at 0.57 s, "both, on Earth, without air" |
| tease | "Next: a spinning office chair. Pull in your arms, and it spins faster. *Why*?" | The hands, full again, release the loop's drop at ×1/10, back to the hook's moment so the last frame is frame 0's; footnote: the falcon feather, the lunar module Falcon |

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (168 spoken), 16 claims, the footnote's claim, pronunciations (Aristotle, Galileo) |
| `vo/`, `compile.py`, `scene.mjs` | The voice, the direction, the picture |
| `../set/moon.js` | **New reusable block**: the Moon dressing (regolith floor), a geological hammer, a falcon feather |
| `../set/spine.js`, `../set/captions_py.py`, `../set/aces.js` (`acesInv`, `ACES_INV_GLSL`) | Shared with the other episodes: the readout's place, the phrase-broken captions, the ACES inverse the step-backs map back through |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep04`.

## Notes

- Rule 8 ("One line wins") is built in: `FILM.dim` steps what delivered the last line back to a third over 0.5 s from a
  cut or a word: the Earth's hammer and its ghost row on "feather"; the Earth's two rows, held behind the change at a
  third until the Moon's release (the hammer's keeps its third, the feather's steps back from the cut); the ink hands
  from the change (full for "astronaut David Scott dropped both", and in the tease, where they release the loop's
  drop); the why's pull arrows on "But" until they retract; the whoa's ink Earth on "satellite" (full again on
  "around") and, with the orbit, on "They"; the measure's drop on "On Earth" (full again at the takeaway's cut). Labels
  are gone by their beat's cut; speed notes sit top-left (the hook's bottom right, clear of the title drop), standing
  cheats top-right, at most two per corner; the two "Illustration" tags stay 4 s at most; the spine holds lit at 0.57 s
  through the takeaway. A third is a third of the contrast on screen: the scene mixes the displayed color (sRGB, after
  the ACES curve) two-thirds of the way to the paper #E6E2D8 and maps it back, the props and the ghost rows in their
  shaders (`rfToPaper`), the ink, the arrows and the rungs by their color (through the ACES inverse), so the draft and
  the finish both keep a third; opacity, which blends in scene light, would keep far less.
- The regolith floor renders again: the recheck pass (10f2150) widened it to the whole floor but left its `scene.add`
  inside a comment, so from then until the rule-8 fix stage (28542ca) the scene drew the paper floor on the Moon (the
  animatic in `build/` was rendered before 10f2150 and has the regolith).
- The coordinating session's fact audit (26 Oct, fa0e26b) changed the normal ("The feather? Still drifting down.": no
  unsourced "barely halfway"; the illustrated drift now sinks at 1.0 m/s, within published feather speeds, c2), the
  takeaway ("Gravity speeds them up equally": the pull is not equal, the acceleration is, c13), the tease ("it spins
  faster", c15) and the whoa's readout ("< 5" parts in a million billion: |η| < 5 × 10⁻¹⁵ at 1σ, from the published
  η = (−1.5 ± 2.3 ± 1.5) × 10⁻¹⁵, ±2.7 combined; it had said "< 3", c10); the changed lines were re-voiced.
