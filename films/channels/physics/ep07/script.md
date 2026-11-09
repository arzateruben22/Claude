# Reality Rulebook · Season 2 · Episode 1: "The slinky that waits" (draft; a physicist signs off before it posts)

S2E01 (folder ep07).

About 68 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.9, labeled as AI), with an original score. Season 2,
episode 1, from `../season2/SLATE.md`. The reveal is the channel's usual one: one visible rule, measured on the strobe ladder.

- One world: a slinky held from the top over the paper bench, a ruled backdrop, ghosts of the top and bottom coils.
- The physics is the ideal slinky (a spring with no rest length, so coils never collide), run as a chain of 60 equal masses in
  `scene.mjs` and checked against the paper's model (a tension spring with touching turns, as in the paper; tuned to its typical 0.3 s collapse). A real slinky
  is close, not exact: the picture says "ideal slinky".
- Spine readout: how far the bottom coil has fallen (cm): it holds 0.0 while the top falls, then the centre of mass, then the wait.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep07 --segment measure`.

## hook {shot: close on the bottom coil, the top falling above it · title drop: "The slinky that waits" · badge: slowed ×10 · pre: 0.1 · energy: 0.7} (0–3.2 s)
vo: Does a slinky's bottom *fall*? {-} Not *yet*. {c1}

## normal {shot: wide, the whole slinky held up from the top, a ruler beside it · labels: "held at the top", "hung about 1.5 m" · picture-only 3.4 s · pre: 0.12 · energy: 0.45} (3.2–14.4 s)
vo: Held by the top, a slinky hangs long and still. {-} Let go. {-} The top drops… and the bottom doesn't move at *all*. {c2}

## change {shot: slowed, side on, ghosts of the bottom coil stack in one place · labels: "bottom: still", "top: falling" · pre: 0.1 · energy: 0.5} (14.4–22.1 s)
vo: Slowed down, the top coils pile up from above, while the bottom floats there. {c3} For about *three tenths* of a second. {c4}

## why {shot: a pull-back to the coils, a wave front drawn down the slinky · picture-only 2 s · pre: 0.2 · energy: 0.55} (22.1–37.9 s)
vo: Why doesn't it fall? {-} Nothing down there has been *told*. {c5} The pull of the spring doesn't jump to the other end; it travels down the coils, like a wave. {c6} Until the news arrives, the bottom has no reason to move. {c7}

## whoa {shot: the balance point (centre of mass) marked with a dot, falling smoothly the whole time beside a dropped ball · picture-only 3 s · pre: 0.15 · energy: 0.75} (37.9–50.7 s)
vo: Its *balance point*, the spot you could balance it on? It falls like a dropped ball. {c8} The top rushes, the bottom waits: the average is a plain fall. {c9}

## measure {segment: measure · the ladder of ghosts, the stopwatch reads "0.3 s" when the top meets the bottom · pre: 0.2 · energy: 0.5} (50.7–59.7 s)
vo: *Measure it*: the bottom's ghosts stack in one place for three tenths of a second. {c10} Then the top arrives, and they all go together. {c11}

## takeaway {shot: hold on the pile falling together · badge: "Illustrated slinky: its fall is modeled, with no air" · pre: 0.25 · energy: 0.45} (59.7–64 s)
vo: Even through a spring, news travels at a limited *speed*. {c12}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (64–71.2 s)
vo: Next: dry spaghetti, bent until it snaps. {-} It almost never breaks in *two*. {c13}
end card: "Next drop: spaghetti almost never breaks in two" · "Follow Reality Rulebook" · footnote: "Real slinkies: about 0.3 s (Cross and Wheatland, 2012)."

## Notes
- Every claim is OPEN: no source page has been opened by a person (see `claims.json`). Do not mark OK from a search excerpt.
- "About three tenths of a second" is the paper's typical figure for real slinkies; the picture is an illustrated slinky tuned to it (the badge says so).
- Listen at T0: slinky, "three tenths", "told", "spaghetti".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
