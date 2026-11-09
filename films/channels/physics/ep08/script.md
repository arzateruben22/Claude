# Reality Rulebook No. 008: "Spaghetti never breaks in two" (draft; a physicist signs off before it posts)

About 66 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.9, labeled as AI), with an original score. Season 2,
episode 2, from `../season2/SLATE.md`; it pays off episode 7's tease.

- One world: a dry spaghetti stick held at both ends over the paper bench, bent until it snaps.
- This is an illustration, not a simulation: the stick's bend is a circular arc and the pieces' flight is drawn to match the
  published high-speed pictures only in kind (badged). The facts come from two papers: Audoly and Neukirch (2005) on why the
  stick breaks again, and Heisser et al. (2018) on twisting first (about 250 degrees and more gives two pieces).
- Spine readout: the number of pieces, then the twist angle in degrees.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep08 --segment measure`.

## hook {shot: close on a spaghetti stick bent into a bow, about to snap · title drop: "Spaghetti never breaks in two" · pre: 0.1 · energy: 0.7} (0–4 s)
vo: How many *pieces*? {-} Bend a spaghetti stick until it snaps. {-}

## normal {shot: wide, the stick held at both ends, bent slowly · labels: "dry spaghetti", "bend slowly" · pre: 0.12 · energy: 0.45} (4–13 s)
vo: Hold both ends and push them together, slowly. {-} The stick curves, then snaps. {-} You expect two halves. {-} You almost always get *three* or more. {c1}

## change {shot: slowed, side on, the pieces flying, the break points marked · labels: "first break", "second break" · pre: 0.1 · energy: 0.5} (13–19.5 s)
vo: Slowed down, the first break isn't the end. {-} A moment later, it snaps *again*, and again. {c2}

## why {shot: a wave of wiggles drawn running along the stick from the first break, the bend growing where it arrives · picture-only 2 s · pre: 0.2 · energy: 0.55} (19.5–36 s)
vo: The physicist Richard Feynman noticed this, and asked *why*. {c3} Years later, two physicists explained it. {c4} The first break sends ripples along the stick. {c5} They bend it even *more* than before, and that extra bend breaks it again. {c6}

## whoa {shot: the stick is twisted, a stripe winding along it, then bent: it snaps in two · picture-only 3 s · pre: 0.15 · energy: 0.75} (36–50 s)
vo: In twenty eighteen, a team at MIT found a trick. {c7} Twist the stick first, over two thirds of a turn. {c8} Then bend it: usually just *two* pieces. {c9}

## measure {segment: measure · the twist counter climbs from 0 to 250 degrees as the pieces count drops from three to two · pre: 0.2 · energy: 0.5} (50–58 s)
vo: *Measure it*: little twist, three or more pieces. {c10} Past about two hundred fifty degrees, two pieces win. {c11}

## takeaway {shot: hold on the clean two-piece snap beside the shattered one · badge: "Illustration: not a simulation" · pre: 0.25 · energy: 0.45} (58–66 s)
vo: It depends on how you break it. {-} Bend slowly: a chain of snaps. {c12} Twist first: usually one *clean* break. {c13}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (66–72.5 s)
vo: Next: a jar of nuts. {-} The biggest one tends to *climb*. {c14}
end card: "Next drop: the nut that rises" · "Follow Reality Rulebook" · footnote: "Heisser et al., PNAS 115, 8665 (2018)"

## Notes
- Every claim: see `claims.json`. c1, c3 (Feynman's observation), c7-c11, c12-c13 are SOURCE-READ against the arXiv full text of the 2018
  paper; c2, c4, c5, c6 (the 2005 cascade) and c14 (ep09's tease) were not opened (APS blocks the page): search excerpts only, so OPEN.
- "Two thirds of a turn" is 240 degrees; the paper says binary fracture dominates above about 250 degrees: the voice says
  "more than two thirds of a turn", the screen says "about 250 degrees".
- Listen at T0: Feynman, "twenty eighteen", "two hundred fifty", "spaghetti".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
