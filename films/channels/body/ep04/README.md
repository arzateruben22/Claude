# Meanwhile, Inside No. 04, "The gap"

Episode 4 of Meanwhile, Inside (`films/channels/body`). It runs 74.0 s at 9:16, narrated by bf_emma (a synthetic
voice, labelled as AI). It pays off episode 3's tease ("A gap most signals can't jump") and sets up episode 5
("Where breath goes"). **Nothing has been posted.** A physiologist signs off the script and the pictures first.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-004-9x16.mp4`, poster `out/meanwhile-inside-004-9x16.jpg`, contact sheet `out/meanwhile-inside-004-9x16-contact.jpg` |
| Measured gates | `review/scorecard.md` |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (16 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** two nerve endings meeting, in a soft light-microscope blur; the title asks "Do they touch?" and the
  readout "touching? ?". "For decades, no microscope could show it."
- **Normal:** a typical nerve cell reaches out to thousands of others; over a hundred trillion junctions in your
  brain (the camera pulls back over a small network); up close they look joined.
- **Change (the people and the wrong idea):** using the same stain, Golgi saw one continuous web, Ramón y Cajal
  separate cells; they shared the 1906 Nobel, still arguing (two illustrated panels).
- **Why:** in the 1950s electron microscopes showed it: a gap (the blur snaps sharp; readout 20–50 nm). At most
  junctions electricity can't jump it: the signal glows down the axon and stops at the tip; calcium floods in; the
  docked sacs spill their messenger; it drifts across; the next cell's receptors light.
- **Whoa:** the handoff replayed slowed, its readout counting to 0.001 s; then the network, where one junction used
  again and again grows stronger: likely part of how you learn.
- **Takeaway:** your nerve cells mostly don't touch; they talk, across gaps, in chemicals (the answer to the hook).
- **Meanwhile:** about fifteen breaths (15 a minute from frame 0), each begun in the brainstem and carried across
  gaps like these to the diaphragm; the junction hands off again on each breath; the locator marks the diaphragm.
- **Tease:** an air sac breathing in the dark. The end card irises back to frame 0's blurred contact and carries a
  fact: Golgi and Cajal shared the 1906 Nobel, and argued in their lectures.

The independent script review scored the first draft 6/10; its fixes (listed in `script.md`) were applied before
voicing.

## The picture

One world (the junction at the origin, inside a small network), the change as two overlay panels, one cut to the
tease's air sac and one back for the loop. Not to scale throughout: the junction is enlarged by orders of magnitude.
The blur on frame 0 is the finish's own depth of field focused far behind the contact; it snaps sharp on "gap".

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | 8 lines, 163 words; 16 claims, all from search excerpts |
| `pron.json` | `Golgi` (ɡˈɒldʒi), `Ramón y Cajal` (the "y" was read as "why") |
| `voice.py` | Episode 1's wrapper; the tease breathes 0.5 s after "those breaths" |
| `compile.py`, `scene.mjs` | The direction and the picture |
| `qa/` | Episode 1's tools (unchanged copies) |

No kit file was changed; the set is used as is (`neuron.js` for the axon).

## For a human to review

- **Shown but not claimed:** the junction's proportions (the gap drawn far wider relative to the terminal); vesicle
  counts; the messenger particles; the receptor shapes; the network's layout; the growth of the "used often"
  junction (a picture of strengthening, not a measured change); the stained-tissue panels (one seeded drawing).
- **The readouts:** 100+ trillion (c3), 20–50 nm (c10), 0.001 s (c11), breaths (c14).
- **Listen at T0:** Golgi, Ramón y Cajal, "nineteen oh six".
