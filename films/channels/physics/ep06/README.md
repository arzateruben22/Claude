# Rest Frame No. 006, "The ten-meter straw"

Episode 6 of Rest Frame, the physics channel (films/channels/physics). It is 73.3 s long, 9:16, narrated by af_bella
at speed 1.0 (a synthetic voice, labeled as AI). It pays off episode 5's tease ("Next: a drinking straw, three stories
tall. Could you still drink through it?") and sets up episode 7 (why ice floats). **Nothing has been posted.** A
physicist signs off the script before it posts.

| | |
|---|---|
| **Final** (26 Oct 15:49: 1080×1920, 30 fps, full finish, −14.0 LUFS / −1.9 dBTP; `qa.py` PASS; the 05:09 final, 339bc41, is superseded) | `out/rest-frame-006-9x16.mp4`, poster `.jpg`, contact sheet `-contact.jpg` (`review/scorecard.md` has every measured gate) |
| Review | `review/scorecard.md`, `HUMAN-REVIEW.md`, `CLAIMS-REVIEW.md`; `assets.md` |
| Seventeen final-tier stills | `review/stills-ep06.jpg` (PNGs in `build/stills/final/9x16/frames/`, not committed) |

## The story

| Beat | Line | Picture |
|---|---|---|
| hook | "What lifts a drink up a *straw*? Something invisible, pushing." | The top of a three-story straw: its water stopped well under the pump on the roof, boiling at the top |
| normal | "A glass of water. A straw. One sip. The water climbs twenty centimeters, to your lips. It feels like you're *pulling* it." | The wooden mannequin at a small table sips; the water climbs 19.3 cm; the spine: the air in the straw, 1013 → 994 hPa |
| change | "Now fill it completely. Seal it, airtight, with a lid. Then sip, however hard you like. *Nothing* rises." | The glass fills to the brim; an airtight lid comes down round the straw; a hard sip takes the straw to 915 hPa (lit) and nothing moves |
| why | Torricelli, 1644: we live at the bottom of an ocean of air, pressing on everything; a sip lowers the pressure in the straw and the air outside pushes the drink *up*. "How hard can it push?" | The lid comes off; Torricelli's tube in ink; the air's push as arrows on the drink (the tube steps back to a third); the sip works again |
| whoa | "Make the straw three stories tall. Your lungs alone? About one meter. Pumping with cheeks and tongue, one stunt reached seven. With a perfect pump, the water stops near ten *meters*. At the top, room-temperature water boils." | The tall straw up the flat-roofed ink house behind the bench: the lungs alone lift it 1.00 m, the mouth-pumping stunt 7.00 m (each a tick on the straw), then the pump takes it up, slowing (a ghost every 1/5 s), to 10.11 m; up close, boiling froth at the top |
| measure | "*Measure it*: the air above one square centimeter weighs just over a kilogram. So does ten point three meters of water." | Wide: a dashed column of air above 1 cm² of the basin (1.03 kg); then the 10.3 m line, and a card: why it stops at 10.1 m |
| takeaway | "Straws don't pull. The atmosphere *pushes*, and its push runs out near ten meters." | Back at the table, sipping; the spine held lit at 10.11 m, "the air's push, at most" |
| tease | "Next: frozen water, floating on liquid water. Why doesn't it *sink*?" | Back to the top of the tall straw for the loop; footnote: Torricelli's 76 cm of mercury |

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json`, `pron.json`, `footnote-claim.json` | The words (175 spoken), 14 claims, the footnote's claim, a pronunciation (Torricelli) |
| `vo/`, `compile.py`, `scene.mjs` | The voice, the direction, the picture |
| `../set/straw.js` | **New reusable block**: glass without a transmission material (a Fresnel rim and a highlight stripe), a glass of water, straws and tall pipes with liquid columns, a screw lid, a hand vacuum pump and hose, boiling bubbles, a small table, an ink house front (gable or flat roof) with a meter scale, Torricelli's tube in ink, a dashed ink line; the hydrostatics helpers (h = Δp/ρg) |
| `../set/spine.js`, `../set/captions_py.py`, `../set/chair.js` (`reach`) | Shared with episodes 2–5: the readout's place, the phrase-broken captions, the mannequin's empty hands |
| `../set/aces.js` (`acesFwd`, `screenAlpha`) | **New helpers**: the finish's forward curve, and the opacity at which a mark keeps a given share of its contrast against the paper on screen |

## Rebuild

As in `../ep02/README.md`, with `E=films/channels/physics/ep06`.

## Notes

- The cyc's wall is hidden in this episode (an open paper floor): the house is 11 m tall and the studio wall is 4.2 m, so
  the house is the backdrop and the tall shots have no seams.
- Rule 8 ("One line wins") is built in: `FILM.dim` drops each beat's deliverer to a third as the next one begins
  (Torricelli's tube, the air's push, the lungs' meter, the stunt's seven, the ghosts, the air column). A third is a third
  of the mark's contrast on screen: blending happens in scene light, before the finish's ACES curve, so opacity 1/3
  would keep only about 1/11; `screenAlpha` gives the opacity that keeps a third (about 0.7).
- The coordinating session's audit (26 Oct) changed the hook ("Something invisible, pushing."), the change ("however
  hard you like": the lungs' best, not a seal-breaking maximum), the whoa (the lungs alone, then the 7 m stunt, c15) and
  the takeaway (the push runs out near ten meters); the first delivery (339bc41) is superseded.
