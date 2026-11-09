# Reality Rulebook · Season 2 · Episode 4: "The ring a coffee drop leaves" (draft; a physicist signs off before it posts)

S2E04 (folder ep10).

About 66 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.85, labeled as AI), with an original score.

- One world, seen from above and a little in front: a lit coffee drop on a sheet of paper, brown specks inside (drawn in 3-D, with the stain growing on the paper as it dries). The specks' paths come from a simple closed-form
  model of the drying drop (Deegan's pinned-edge picture: evaporation strongest at the edge, the edge stuck, flow from the middle
  outward), run in `scene.mjs`. It is our model with made-up round numbers, not a measurement, and it says so.
- Facts from the 1997 Nature paper (Deegan et al.) and the 2011 Nature paper (Yunker et al.), both only from search excerpts: the
  nature.com pages were not reachable from the builder's session, so every claim is OPEN.
- Spine readout: the share of specks in the ring (percent).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep10 --segment measure`.

## hook {shot: top view, close on a drop of coffee on paper, specks inside · title drop: "The ring a coffee drop leaves" · pre: 0.1 · energy: 0.7} (0.0–3.7 s)
vo: Why does coffee leave a *ring*? {-} Not… blobs. {-}

## normal {shot: top view, the drop, then the dried stain beside it, darker at the edge · labels: "coffee drop", "dark ring" · picture-only 0.7 s · pre: 0.12 · energy: 0.45} (3.7–14.7 s)
vo: Spill a drop of coffee and let it dry. {-} It leaves a dark ring, with a paler middle. {c1} Coffee is mostly water, with tiny brown specks in it. {-}

## change {shot: the drying drop, the specks' paths drawn as faint trails streaming outward · labels: "specks", "edge" · pre: 0.1 · energy: 0.5} (14.7–20.0 s)
vo: Watch the specks. {-} They don't stay put. {-} They stream *outward*, toward the edge. {c2}

## why {shot: side cutaway of the drop: a lens of water, the edge stuck to the paper, arrows from the middle to the edge · picture-only 0.7 s · pre: 0.2 · energy: 0.55} (20.0–32.3 s)
vo: The edge of the drop is stuck to the paper. {c3} Water evaporates from that edge, so water from the middle flows out to replace it. {c4} The flow carries the specks *along*. {c5}

## whoa {shot: top view again: the drop thins, the specks rush to the edge and pile up into a ring · picture-only 0.55 s · pre: 0.15 · energy: 0.75} (32.3–42.9 s)
vo: As the drop thins, the flow speeds up. {c6} In the last moments, the specks pile up at the edge. {c10} Make the specks oval, and the ring can *vanish*. {c7}

## measure {segment: measure · the share of specks in the ring counts up while the drop dries · pre: 0.2 · energy: 0.5} (42.9–47.7 s)
vo: *Measure it*: in this model, nine in ten specks reach the ring. {c8}

## takeaway {shot: hold on the finished ring · badge: "A model, not a measurement" · pre: 0.25 · energy: 0.45} (47.7–57.9 s)
vo: Oval specks cling together at the surface, which can hold them back from the *edge*. {c11} A stuck edge and an outward flow: that's all a ring takes. {-}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (57.9–65.1 s)
vo: Next: listen carefully to a mug filling with water. {-} You can *hear* it rise. {c9}
end card: "Next drop: listen to the cup fill" · "Follow Reality Rulebook" · footnote: "Deegan et al., Nature 389, 827 (1997)"

## Notes
- All claims are OPEN. c3 and c5 come from the abstract excerpt of Deegan et al. ("Pinning of the contact line of the drying drop ensures
  that liquid evaporating from the edge is replenished by liquid from the interior"); c7 from the Yunker et al. abstract excerpt
  ("ellipsoidal particles are deposited uniformly during evaporation"); c6, c8 and c10 are derivations from our own model (no URL; c8: specks still in the middle when the film gets thinner than a speck stay there, so the model ends with 93% in the ring, the readout counts up in the measure beat only and freezes on that figure: the model check in review/model-check.md gives 0.928 at s = 0.95). c9 is the next episode's tease (nothing opened).
- Listen at T0: "ring", "outward", "oval", "hear".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post. nature.com was not reachable from the builder session:
  a person should open both papers.
