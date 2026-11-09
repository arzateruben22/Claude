# Reality Rulebook · Season 2 · Episode 3: "The nut that rises" (draft; a physicist signs off before it posts)

S2E03 (folder ep09).

About 68 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.85, labeled as AI), with an original score.

- One world: a glass jar of small grains with one big ball at the bottom, shaken. The grains are a 2D computer simulation
  (soft discs, seeded, run once by `sim.mjs` and stored in `sim.json`), drawn as a time-lapse (badged). It is our model, not a
  measurement: it shows the big disc rising through the bed, and says so. The jar is drawn in 3-D (a thin glass cell, grains at fixed depths) from that 2-D model; the reverse-effect jar in the whoa beat is an illustration (a frozen snapshot with a lighter ball moved by hand), badged as such.
- The facts are from one review of the physics of food (Mathijssen et al., arXiv 2201.12128): larger grains often rise when
  mixed grains are shaken (the Brazil nut effect), buoyancy alone doesn't explain it, percolation and granular convection
  each play a part, and a reverse effect exists.
- Spine readout: the big ball's height in the jar (cm).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep09 --segment measure`.

## hook {shot: close on a glass jar of small grains, the one big ball at the bottom · title drop: "The nut that rises" · pre: 0.1 · energy: 0.7} (0–3.7 s)
vo: Where will the nut end up? {-} Starting *underneath* everything. {-}

## normal {shot: wide, a hand shakes the jar · labels: "small grains", "one big ball" · picture-only 2 s · pre: 0.12 · energy: 0.45} (3.7–16.3 s)
vo: Shake a jar of mixed nuts, or a box of cereal, and the biggest pieces often rise to the *top*. {c1} Scientists call it the Brazil nut effect. {c2}

## change {shot: time-lapse of the jar shaking, the big ball climbing · labels: "time-lapse", "big ball" · pre: 0.1 · energy: 0.5} (16.3–22.4 s)
vo: You'd expect heavy things to sink. {-} Yet it happens even when the big pieces are *heavier*. {c3}

## why {shot: a cutaway on the big ball: small grains dropping into the gap under it each shake · picture-only 2 s · pre: 0.2 · energy: 0.55} (22.4–34.9 s)
vo: Here is one reason. {-} Each shake lifts the grains, and small ones tumble into the gaps *under* it. {c4} It can't fit down there, so it's propped up more each shake. {c5}

## whoa {shot: pull back to the whole jar: grains flowing up the walls and down the middle, then a second jar where the big ball sinks · picture-only 3 s · pre: 0.15 · energy: 0.75} (34.9–49.3 s)
vo: Scientists have found several effects at work. {c6} Grains can flow in a loop, up the walls and down the *middle*. {c7} And in some jars, the big ones sink instead. {c8}

## measure {segment: measure · a replay of the climb from the bottom, 1.6x faster than the main run (badge: "Replay · 1.6× faster"), the height counts up from about 4 cm · pre: 0.2 · energy: 0.5} (49.3–58.7 s)
vo: *Measure it*: in this simulation, the big disc climbs from the bottom to near the top. {c9} It takes about ten seconds of shaking. {c12}

## takeaway {shot: hold on the big ball sitting among the top grains · badge: "Simulation, sped up" (the replay keeps running) · pre: 0.25 · energy: 0.45} (58.7–67.2 s)
vo: Shaking doesn't just mix things. It often *sorts* them. {-} Unpopped popcorn kernels sink in a bowl for a related reason. {c10}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (67.2–73.6 s)
vo: Next: a coffee drop dries into a *ring*. {-} Why not a blob? {c11}
end card: "Next drop: the coffee ring" · "Follow Reality Rulebook" · footnote: "Mathijssen et al., arXiv 2201.12128 (2022)"

## Notes
- c1-c3, c6-c8, c10 are SOURCE-READ against the arXiv review (full text read); c4 and c5 are read for percolation but the
  "propped up" step is our plain wording of the mechanism (OPEN); c9 is our own simulation (OPEN, not a published result);
  c11 is ep10's tease (Deegan 1997, not read).
- Listen at T0: "Brazil nut", "heavier", "popcorn", "ring".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
