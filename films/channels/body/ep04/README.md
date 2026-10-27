# Meanwhile, Inside No. 04, "The gap"

Episode 4 of Meanwhile, Inside (`films/channels/body`). It runs 74.4 s at 9:16, narrated by bf_emma (a synthetic
voice, labelled as AI). It pays off episode 3's tease ("A gap most signals can't jump") and sets up episode 5
("Where breath goes"). **Nothing has been posted.** A physiologist signs off the script and the pictures first.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-004-9x16.mp4`, poster `out/meanwhile-inside-004-9x16.jpg`, contact sheet `out/meanwhile-inside-004-9x16-contact.jpg` |
| Ten final-tier stills | `review/stills-ep04.jpg` (from the delivered file at 0, 8, 18, 24, 32, 38.6, 45.4, 48, 58.4 and 73.5 s) |
| Measured gates | `review/scorecard.md` |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (17 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** two nerve endings meeting, in a soft light-microscope blur; the title asks "Do they touch?" and the
  readout "touching: ?". "For decades, no microscope could show it."
- **Normal:** a typical nerve cell reaches thousands of others; over a hundred trillion junctions in your brain
  (the camera pulls back over a small network); through a lens they look joined.
- **Change (the people and the wrong idea):** Golgi, who made the stain, saw one continuous web; with it, Ramón y
  Cajal saw separate cells; they shared the 1906 Nobel, still arguing (two illustrated panels: the plain stain
  first, under "who made the stain"; Golgi's web arrives on "saw one continuous web", Cajal's cells with his name).
- **Why:** in the 1950s electron microscopes showed it: a gap (the blur snaps sharp into an electron-microscope-style
  view, badged "illustration · not to scale"; readout 20–50 nm). At most junctions electricity can't jump it: the
  signal glows down the axon and stops at the tip; calcium floods in; the docked sacs spill their messenger; it
  drifts across; the next cell's receptors light.
- **Whoa:** the handoff replayed slowed, its readout counting to 0.001 s; then the network, where one junction used
  again and again grows stronger: likely part of how you learn.
- **Takeaway:** your nerve cells mostly don't touch; they talk, across gaps, in chemicals (the answer to the hook).
- **Meanwhile:** about fifteen breaths (15 a minute from frame 0), each begun in the brainstem and carried across
  gaps like these to the diaphragm; the junction hands off again on each breath; the locator marks the brainstem,
  where each breath begins.
- **Tease:** an air sac breathing in the dark. The end card irises back to frame 0's blurred contact and carries a
  fact: Golgi and Cajal shared the 1906 Nobel, and argued in their lectures.

The independent script review scored the first draft 6/10; its fixes (listed in `script.md`) were applied before
voicing. The 26 Oct audit (an independent fact check, also listed in `script.md`) changed lines 2 and 3, which were
re-voiced (the other six came back byte-identical), added claim c17, badged the why's view, fixed the frame-0 readout
and re-sourced c3 and c12.

## The picture

One world (the junction at the origin, inside a small network), the change as two overlay panels, one cut to the
tease's air sac and one back for the loop. Not to scale throughout: the junction is enlarged by orders of magnitude.
The blur on frame 0 is the finish's own depth of field focused far behind the contact; it snaps sharp on "gap".
From the start of that sharpening to the end of the why's handoff the corner badge reads "illustration · not to
scale": the view is a model in an electron micrograph's style, not a micrograph and not footage.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | 8 lines, 165 words; 17 claims, all from search excerpts |
| `pron.json` | `Golgi` (ɡˈɒldʒi), `Ramón y Cajal` (the "y" was read as "why") |
| `voice.py` | Episode 1's wrapper; the tease breathes 0.5 s after "those breaths" |
| `compile.py`, `scene.mjs` | The direction and the picture |
| `qa/` | Episode 1's tools (unchanged copies) |

One kit change, opt-in: the balanced caption pager (`../KIT-CHANGES.md`). The set is used as is (`neuron.js` for
the axon).

## For a human to review

- **Shown but not claimed:** the junction's proportions (the gap drawn far wider relative to the terminal); vesicle
  counts; the messenger particles; the receptor shapes; the network's layout; the growth of the "used often"
  junction (a picture of strengthening, not a measured change); the stained-tissue panels (one seeded drawing).
- **The readouts:** "touching: ?" (frame 0), 100+ trillion (c3), 20–50 nm (c10), 0.001 s (c11), breaths (c14).
- **The badges:** "not to scale" (top right, to the cut); "illustration · not to scale" in its place over the
  electron-microscope-style view (the why, from the sharpening to the end of its handoff); "simplified: a few of
  thousands drawn"; "illustration: one stained tissue, two readings"; "slowed" / "sped up" (top left);
  "illustration, not to scale" (the tease's air sac).
- **Sources:** every claim was checked from a search excerpt only; a person opens each link before posting
  (`review/CLAIMS-REVIEW.md`).
- **Listen at T0:** Golgi, Ramón y Cajal, "nineteen oh six".
