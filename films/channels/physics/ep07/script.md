# Reality Rulebook No. 007: "The slinky that waits" (draft; a physicist signs off before it posts)

About 68 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labeled as AI), with an original score. Season 2,
episode 1, from `../season2/SLATE.md`. The reveal is the channel's usual one: one visible rule, measured on the strobe ladder.

- One world: a slinky held from the top over the paper bench, a ruled backdrop, ghosts of the top and bottom coils.
- The physics is the ideal slinky (a spring with no rest length, so coils never collide), run as a chain of 60 equal masses in
  `scene.mjs` and checked against the closed form (the bottom waits exactly √(2ℓ/g), 0.35 s for a 60 cm hang). A real slinky
  is close, not exact: the picture says "ideal slinky".
- Spine readout: how far the bottom coil has fallen (cm): it holds 0.0 while the top falls, then the centre of mass, then the wait.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep07 --segment measure`.

## hook {shot: close on the bottom coil, the top falling above it · title drop: "The slinky that waits" · badge: slowed ×10 · pre: 0.1 · energy: 0.7} (0–4.2 s)
vo: Does a slinky's bottom *fall*? {-} Not at first… not *yet*. {c1}

## normal {shot: wide, the whole slinky held up from the top · labels: "held at the top", "about 60 cm hung" · pre: 0.12 · energy: 0.45} (4.2–13 s)
vo: Held by the top, a slinky hangs long and still. {-} Let go. {-} The top drops… and the bottom doesn't move at *all*. {c2}

## change {shot: slowed, side on, ghosts of the bottom coil stack in one place · labels: "bottom: still", "top: falling" · pre: 0.1 · energy: 0.5} (13–22 s)
vo: Slowed down, the top coils pile up from above, while the bottom floats there. {c3} For about a *third* of a second. {c4}

## why {shot: a pull-back to the coils, a wave front drawn down the slinky · picture-only 2 s · pre: 0.2 · energy: 0.55} (22–38 s)
vo: Why doesn't it fall? {-} Nothing down there has been *told*. {c5} The pull of the spring doesn't jump to the other end; it travels down the coils, like a wave. {c6} Until the news arrives, the bottom has no reason to move. {c7}

## whoa {shot: the centre of the slinky marked, falling smoothly the whole time · picture-only 3 s · pre: 0.15 · energy: 0.75} (38–50 s)
vo: And the *middle*? It falls the whole time, like a dropped ball. {c8} The top rushes down, the bottom waits, and the average is a plain fall. {c9}

## measure {segment: measure · the ladder of ghosts, the stopwatch reads "0.35 s" when the top meets the bottom · pre: 0.2 · energy: 0.5} (50–59 s)
vo: *Measure it*: the bottom's ghosts stack in one place for a third of a second. {c10} Then the top arrives, and they all go together. {c11}

## takeaway {shot: hold on the pile falling together · badge: "Ideal slinky: no air, no friction" · pre: 0.25 · energy: 0.45} (59–64 s)
vo: News at one end takes *time* to reach the other. {c12}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (64–70 s)
vo: Next: dry spaghetti, bent until it snaps. {-} It never breaks in *two*. {c13}
end card: "Next drop: spaghetti never breaks in two" · "Follow Reality Rulebook" · footnote: "Calkin, Am. J. Phys. 61, 261 (1993): the first careful analysis of the falling spring"

## Notes
- Every claim is OPEN: no source page has been opened by a person (see `claims.json`). Do not mark OK from a search excerpt.
- The "about 60 cm" and "a third of a second" are the model's numbers for one illustrated slinky; a real one differs (the badge says so).
- Listen at T0: slinky, "third", "told", "spaghetti".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
