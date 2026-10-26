# Meanwhile, Inside No. 05, "Where breath goes"

Episode 5 of Meanwhile, Inside (`films/channels/body`). It runs 74.4 s at 9:16, narrated by bf_emma (a synthetic
voice, labelled as AI). It pays off episode 4's tease ("Where does all that air go?") and sets up episode 6
("The exit"). **Nothing has been posted.** A physiologist signs off the script and the pictures first.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-005-9x16.mp4`, poster `out/meanwhile-inside-005-9x16.jpg`, contact sheet `out/meanwhile-inside-005-9x16-contact.jpg` |
| Measured gates | `review/scorecard.md` |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (16 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** a cluster of air sacs at the end of a fine airway, wrapped in capillaries, breathing; "Where does your
  breath go? Not into a bag. Into these." The readout asks how many.
- **Normal:** an iris to the whole airway tree from the windpipe; the route to the hero's cluster lights fork by
  fork as the readout counts "up to about 23" (the tree draws 7, badged); half a billion sacs, each about 0.2 mm.
- **Change (the people and the wrong idea):** the cluster drawn as the old idea, the lung as clotted blood there to
  cool the heart (a dense, dark, smooth mass, badged an illustration); on "bubbles" it dissolves to Malpighi's view
  (1661, an animal's lung under the microscope).
- **Why:** each sac wrapped in capillaries; an iris to the air–blood wall at true scale beside a red cell, under
  0.5 µm over much of it (drawn 0.4 µm); oxygen slips across and the cell flushes; the wall thickens toward the air,
  the oxygen crosses at a fifth of the rate (Fick: flux falls as the wall thickens; badged "illustration: a thickened
  wall") and the cell dulls: breathing gets harder.
- **Whoa:** the sacs unfold from a person's chest into a 70 m² floor inside a full doubles tennis court's lines
  (260.8 m², drawn whole): about a quarter of it, folded inside your chest. The readout says about 70 m² and the
  corner badge "area to scale · estimates 50–140 m²".
- **Takeaway:** the floor folds back; the chest turns see-through and the sponge shows inside it.
- **Meanwhile:** about six litres of air in and out (5.5 L a minute from frame 0; 6.0 L as "six" is said); air in
  and out of the mouth on each breath; the locator marks the chest.
- **Tease:** a white blood cell squeezing through a seam in a vessel wall, red cells streaming past above it. The end
  card irises back to frame 0's cluster and carries a fact: about 480 million air sacs (Ochs and colleagues, 2004).

The 26 Oct audit (an independent fact check, also listed in `script.md`) changed lines 3, 4 and 5, which were
re-voiced (the other five came back byte-identical): "airy flesh" → "clotted blood", the lung under Malpighi's
microscope → "an animal's lung", "At its thinnest … about half a micrometre" → "Over much of it … under half a
micrometre", "at least seventy" → "about seventy", "At least a third" → "About a quarter" of a tennis court. The
whoa now draws a full doubles court, its two held camera keys pulled back so all of it sits inside the 9:16
platform-safe box; the drawn air–blood wall is 0.4 µm (it was exactly 0.5), the old-idea envelope is a dense, dark
mass (it was pale foam), the readouts say "air–blood wall, under 0.5 µm" and "unfolded, about 70 m²", c4 and c7 were
re-sourced, c9 gained West's textbook range and c10 now cites the ITF Rules of Tennis.

## The picture

Four places joined by the membrane iris: the lung (generations compressed, not to scale), the wall (µm, the wall and
the cell to scale, the O₂ enlarged), the room (metres, area to scale) and the exit (not to scale). The readout runs
through every beat; pink stays on blood (the readouts are in the text colour).

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | 8 lines; 16 claims, all from search excerpts |
| `pron.json` | `Malpighi` (mal-PEE-ghee) |
| `voice.py` | Episode 1's wrapper, one speed per sentence; per-line pauses in the hook, the meanwhile and the tease; the audit's re-worded sentences a little faster (the film stays 74.4 s) |
| `compile.py`, `scene.mjs` | The direction and the picture |
| `qa/` | Episode 1's tools (unchanged copies) |

One kit change, opt-in: the balanced caption pager (`../KIT-CHANGES.md`).

## For a human to review

- **Shown but not claimed:** the airway tree's shape (7 forks drawn for about 23), the clusters, the capillary net's
  layout, the clotted-blood envelope (an illustration of the old idea: a dense, dark, smooth mass), the O₂ molecules' size (enlarged, badged), the
  speed of diffusion (slowed, badged), the thickened wall (a picture of "harder", not a measured disease), the
  person's figure, the tile floor and its fold, the court (a full doubles court, 260.8 m², its real lines, drawn
  whole at the floor's scale), the sponge drawn inside the chest, the exit's cell and wall.
- **The readouts:** 23 forks (c2), 480 million sacs (c1), 0.2 mm (c3), 1661 (c5), "air–blood wall, under" 0.5 µm
  (c7), "unfolded, about" 70 m² (c9), the tally at 5.5 L a minute (c13).
- **The badges:** "not to scale" (top right, to the wall's cut); "simplified: 7 of ~23 forks drawn"; "illustration:
  the old idea" (the envelope); "wall and cell to scale · O₂ enlarged"; "slowed" (top left); "area to scale ·
  estimates 50–140 m²" (the whoa, to the fold); "illustration" (the takeaway and the meanwhile); "not to scale" and
  "sped up" (the tease).
- **Sources:** every claim was checked from a search excerpt only; a person opens each link before posting
  (`review/CLAIMS-REVIEW.md`).
- **Listen at T0:** Malpighi, "sixteen sixty-one", micrometre.
