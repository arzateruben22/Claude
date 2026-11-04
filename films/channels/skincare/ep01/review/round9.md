# Skin Sense No. 001, review round 9 (same reviewer as rounds 3–8)

Judged from: `review/draft-preview-r8.mp4` (540×960, 75.0 s), frames at 0, 18.5, 21, 24, 30, 36, 41, 44, 52.6, 53.1,
53.5 and 56 s, and the change list for commit e4720c0. I did not read the commit's code.

Scores: **a 4 · b 4 · c 4 · d 3 · e 4 · f 3 · g 4 · h 3**.

**Verdict: FAIL.** One condition is unmet: (h) must be 4 or more, and it is 3. The follicle section is now close.
What keeps (h) at 3 is the 8 s to-scale card and the frame-0 hook, not the follicle any more.

## Against my round-8 blockers

1. **Follicle and rupture: mostly fixed (18.5–53).**
   - The pre-blurred photo now separates the model from the backdrop.
   - The cell clumps and the varied spill read as material, not as default spheres (44).
   - Haze softens the band above the block, and the shaft no longer hangs in the sky.
   - Left over:
     - The pushed sculpt reads as hard, faceted planes, like a low-poly crystal (18.5, 21, 30), not as soft tissue.
     - The horny layer still reads as stripes.
     - With the 5 px blur the photo no longer reads as tissue. That is acceptable for depth of field.
2. **To-scale card: not fixed (53.5–61).** It is still an empty violet panel with a dashed bar for about 8 s. This
   is now the main reason (h) stays at 3.
3. **Honesty badge: over-corrected.**
   - The badge now ends at 52.78, but the tissue photo stays visible behind the glass card until about 53.4
     (still at 53.1).
   - For about 0.6 s the photo is on screen with only the "To scale" badge.

## Blockers, in priority order

1. **(h) The to-scale card (53.3–61).** If the gauge camera can't see the section, don't fake it:
   - Light the card as a glass object over the stream's graded backdrop, with drifting defocused cells behind it
     (the stream camera already has this look). Give the bar a paper material (fibre grain, a lit edge) and make
     each cell a small lit sphere in the stream's cell material, not a flat dot.
   - Or render the paper sheet and the ten cells in 3D in the stream scene.
2. **(h) Facets on the follicle (18–53).** Smooth the shading normals after the sculpt, or subdivide before
   displacing, so the lumps read as soft and rounded, not as cut planes.
3. **(honesty, one line) 52.78–53.4.** End "model on a tissue photo" when the card covers the photo, at about 53.4,
   not 52.78.

## Polish

- **Hook (0 s).** The spot is about 15 px and the lower 40% of the frame is black. A push-in would protect (a) and
  lift (h): frame 0 is the shot the feed judges.
- **Rhythm and cuts.** The two 2.8 s holds and the stream → section → card round trip are unchanged; they keep (d)
  and (f) at 3.

## Scores

- **a. First 2 seconds: 4 (at risk).** The spot and the question come first, but the spot is tiny.
- **b. One thread: 4.** Unchanged.
- **c. Picture moves with the sentence: 4.** Unchanged.
- **d. Every cut or move motivated: 3.** The stream → section → card round trip is still there.
- **e. Voice carries meaning, screen the figures: 4.** Unchanged.
- **f. Rhythm: 3.** The two holds remain.
- **g. Ending calls back, tease lands: 4.** Unchanged.
- **h. Production value: 3.** It is now a high 3:
  - The cheek, the terrain, the cells, the spill and the depth of field reach the bar.
  - The faceted follicle, the template gauge card (8 s) and the small frame-0 hook still do not.
  - Fixing blocker 1 alone would likely bring (h) to 4.
