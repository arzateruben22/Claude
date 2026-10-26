# Meanwhile, Inside No. 06, "The exit"

Episode 6 of Meanwhile, Inside (`films/channels/body`). It runs 74.4 s at 9:16, narrated by bf_emma (a synthetic
voice, labelled as AI). It pays off episode 5's tease ("Next: a cell that leaves your blood. It squeezes through a
wall.") and sets up episode 7 ("The spark"). **Nothing has been posted.** A physiologist signs off the script and the
pictures first.

| | |
|---|---|
| Delivery | `out/meanwhile-inside-006-9x16.mp4`, poster `out/meanwhile-inside-006-9x16.jpg`, contact sheet `out/meanwhile-inside-006-9x16-contact.jpg` |
| Measured gates | `review/scorecard.md` |
| Sign-off sheets | `review/CLAIMS-REVIEW.md` (25 claims), `review/HUMAN-REVIEW.md` |

## The story

- **Hook:** inside a venule under a fingertip's skin, one neutrophil caught halfway through a seam between two wall
  cells, its nucleus pinched at the waist, red cells streaming behind it. "How does this cell leave your blood? This
  wall has no open door." The spine readout, new neutrophils made while you watch, is already counting, dimmed.
- **Normal:** the same cell a minute earlier, round, riding the stream (a scale bar: about 8 µm, round, in blood);
  "Yet under a sore fingertip, they pile up outside the wall": down through the lining to the white cells beyond it.
- **Change (the person and the wrong idea):** one engraved plate (badged "illustrated"): Virchow taught that pus grew
  from the inflamed tissue (its cells glow); in 1867 his assistant Cohnheim watched a living frog's vessels (the
  plate's blood starts to move); white cells climbed out (three push through the wall).
- **Why:** back in the venule (slowed): where tissue is inflamed the wall turns sticky (fine threads light on the
  lining) and the cell rolls; its grips switch on and it stops; it crawls to a seam, which glows. The stakes: in a rare
  inherited condition those grips are faulty, and one such cell rolls on past the seam (badged an illustration).
- **Whoa:** a cut-away through the seam (sped up): the cell wedges its nucleus in and the two wall cells part around
  it; it pours through a gap narrower than itself; behind it the seam seals shut; it is free in the tissue.
- **Takeaway:** an iris out to the fingertip, one sore spot by the nail (a swelling and a soft glow, the same on any
  skin; never a wound, blood or pus drawn), its white cells ghosted beneath: "So pus is mostly white cells from your
  blood. Each one let itself out."
- **Meanwhile:** the readout lights on its pulse line: more than ten million new neutrophils while you watched (a low
  estimate, badged); the locator marks the bone marrow.
- **Tease:** out of the fingertip, up the arm, to the heart; a small patch high in its right upper chamber flickers
  on each beat. The end card irises back to frame 0 and carries a fact: Augustus Waller saw blood cells cross
  capillary walls in 1846, 21 years before Cohnheim.

## The picture

Two places joined by the membrane iris: the venule (µm; the cell, the red cells and the gap near their true sizes;
the time slowed in the normal and the why, sped up in the whoa, each badged) and the fingertip (an illustration).
The change's plate and the tease's figure are drawn in the overlay. The hero is a new set block,
`set/wanderer.js`: a translucent body rebuilt each frame from an hourglass profile (the volume kept as it pours
through a waist held to the gap), with a lobed nucleus that goes first.

## Files

| File | What it is |
|---|---|
| `script.md`, `claims.json` | 8 lines, 168 words; 25 claims, all from search excerpts |
| `pron.json` | `Virchow` (FEER-koh), `Cohnheim` (KOHN-hime) |
| `voice.py` | Episode 1's wrapper, one speed per sentence; per-line pauses in the hook, the meanwhile and the tease |
| `compile.py`, `scene.mjs` | The direction and the picture |
| `qa/` | Episode 1's tools (unchanged copies) |
| `../set/wanderer.js` | New: the neutrophil (B8, the wanderer) |

No kit file was changed.

## For a human to review

- **Shown but not claimed:** the venule's proportions; the wall cells' shapes; the threads (selectins) and grips
  (integrins) as drawn; the rolling and crawling speeds (slowed); the squeeze's duration (minutes in life, seconds
  here: sped up); the nucleus's three lobes; the tissue's fibres; the engraving (one drawing in the manner of a
  19th-century plate, not a reproduction of Cohnheim's figures); the fingertip and the sore spot (stylised); the body
  figure and the heart.
- **The readout:** new neutrophils at 1.5 × 10¹⁰ a day (c23's floor; 173,611 a second, computed), passing ten
  million at 57.6 s.
- **Listen at T0:** Virchow, Cohnheim, "eighteen sixty-seven", neutrophil, micrometres.
