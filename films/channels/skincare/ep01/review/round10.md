# Skin Sense No. 001, review round 10 (same reviewer as rounds 3–9)

Judged from: `review/draft-preview-r9.mp4` (540×960, 75.0 s), frames at 0, 1, 21, 30, 44, 52.5, 52.8, 53.1, 53.5,
56, 59 and 61.5 s, and the change list for commit 01f186a. I did not read the commit's code.

Scores: **a 4 · b 4 · c 4 · d 4 · e 4 · f 3 · g 4 · h 4**.

**Verdict: PASS, on two conditions** (C1 and C2 below). Both are small. Verify them on two stills (52.6, 56) before
the final render; no further full review is needed.

## Against my round-9 blockers

1. **To-scale card: fixed.**
   - The card is now lit glass in the marrow stream, with the same cells soft behind it (53.1–61).
   - It reads as part of the world, not a template.
   - It also removes the stream → section → card round trip: the film goes stream → card in one place, so (d) rises
     to 4.
2. **Follicle facets: fixed.**
   - No hard planes are left (21, 30, 44).
   - The smoothed lumps now read as stacked ridges, a little like a ribbed shell, more than soft tissue.
   - That is acceptable at phone size (polish).
3. **Hook: fixed.** The spot is now clearly the subject at frame 0. The lower 40% of the frame is still dark, but it
   reads as vignette.

## Conditions (fix before the final)

- **C1. Honesty: the wrong badge sits over the stream (≈ 52.5–52.78).** "Model on a tissue photo" fades in over the
  marrow stream (52.8), where there is no photo; the correct "Model, not a photo" is fading out underneath it. This
  is the leftover cut-back badge (`film.json`: 52.33–52.78). Fix: delete that badge entry, and carry "model, not a
  photo" from 45.6 to 53.0.
- **C2. The "to scale" card is muddied by cells at a different scale (53.1–61).**
  - The drifting cells behind and in front of the glass are about 10× the "white cell ≈ 8 µm" dot.
  - Several of them cross the dashed paper bar and the baseline (53.1, 53.5, 56).
  - With "To scale" on screen, a viewer can read the big spheres as the white cells being measured, which undercuts
    the comparison.
  - Fix: keep the cells out of the card's rectangle in the foreground; dim the ones behind the glass by about 50%
    and blur them more; and draw the ten gauge cells in the same lit cell material, so it is clear the dots are
    those cells, scaled down.

## Polish (not blocking)

- The caption-less stream hold remains (49.5–52.3), which keeps (f) at 3.
- The follicle's ridges read as a ribbed shell (21–44). Break up their regularity.
- The horny layer is still stripes.
- The hook could push in a little more to lose the dark lower band.
- Title case is unchanged.

## Scores

- **a. First 2 seconds: 4.** The lit cheek and a readable spot, with the question at 0.09 s.
- **b. One thread: 4.** Unchanged.
- **c. Picture moves with the sentence: 4.** The pus cell now lives in the same stream as the marrow line. It would
  stay at 4 once C2 makes the scale read cleanly.
- **d. Every cut or move motivated: 4.** The round trip is gone; the stream carries into the gauge.
- **e. Voice carries meaning, screen the figures: 4.** Unchanged.
- **f. Rhythm: 3.** One caption-less 2.8 s hold remains after "Earth".
- **g. Ending calls back, tease lands: 4.** Unchanged.
- **h. Production value: 4.**
  - The cheek, the terrain, the cells, the spill, the depth of field and the glass gauge in the stream all hold up.
  - No frame now reads as a default render or a template.
  - It is not a 5: the follicle's regular ridges and the striped horny layer still look procedural.
