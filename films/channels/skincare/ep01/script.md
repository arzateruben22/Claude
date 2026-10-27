# Outer Layer No. 001: "The dead layer" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Bible §7 #1.

The story: the skin you can see is dead, every cell of it, and that is the point. Cells are born
alive at the base of the epidermis, rise for about two weeks, and take themselves apart on purpose
near the top. The wrong idea is that the dead layer is waste waiting to flake off; the stakes are
water: newborns whose wall isn't finished lose about five times as much through their skin
(Rutter and Hull, 1979). The "to scale" beat puts the whole dead layer beside a sheet of paper.

Honesty, on screen: the section is "simplified" (about 15 rows drawn, real cells are flatter); the
climb runs under "time ×N"; the brick wall is a "model"; the water beads are an "illustration".
The skin is drawn in three melanin levels across the episode (light in the hook, deep in the climb,
medium in the whoa); nothing about any one tone is said or implied.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}`
ties a sentence to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep01 --segment toscale`.

## hook {shot: frame 0, the payoff: a fingertip at the mm rung cut open into the section, the top rows of dead flat cells lit, gauge at 0 µm · badge: simplified · title: "The dead layer" · pre: 0.05 · picture-only 0.3 s · energy: 0.6} (0–4.5 s)
vo: Is the skin you see *alive*? Not one cell of it. {c1}

## normal {shot: dive into the section; label the stratum corneum's rows, a corneocyte, the living layers below · gauge 0 → 17 µm · picture-only 0.3 s · energy: 0.4} (4.5–15 s)
vo: Your outermost layer is about fifteen rows of flattened cells. {c2} Each one is dead: a flat shell packed with *keratin*. {c3} The living skin starts just beneath them. {c4}

## change {shot: follow one cell from the basal row up through the layers (time ×N), it flattens and empties near the top · counter "day 0 → 14" · picture-only 0.3 s · energy: 0.55} (15–27 s)
vo: Follow one cell from the bottom. {-} It's born alive, at the base. {c5} For about two weeks it rises, filling with keratin. {c6} Then, near the top, it takes itself apart, *on purpose*. {c7}

## why {shot: pull back; the rows become bricks, lipid sheets light in water colour between them · badge: model · picture-only 2.2 s · energy: 0.5} (27–41.5 s)
vo: That layer looks like waste, waiting to flake off. {-} Scientists picture it as a *brick wall*: dead cells for bricks, fats for mortar. {c8} And that wall is what keeps your water *inside*. {c9}

## whoa {shot: a newborn's thin wall beside a finished one; water beads stream out through the thin one · counter "≈ 5×" · badge: illustration · picture-only 3.2 s · energy: 0.8} (41.5–55.5 s)
vo: In nineteen seventy-nine, two doctors measured water leaving the skin of newborns. {c10} Babies born before thirty weeks, before that wall is finished, lost about *five times* as much. {c11}

## toscale {segment: toscale · the gauge lifts to centre: the dead layer's 17 µm fills in beside the paper mark (100 µm) · picture-only 0.4 s · energy: 0.4} (55.5–63.5 s)
vo: To scale: on the cheek, the whole dead layer is about seventeen micrometers. {c12} A sheet of paper is about a *hundred*. {c13}

## takeaway {shot: back to the fingertip; the dead rows glow faintly, then settle · picture-only 0.3 s · energy: 0.3} (63.5–69 s)
vo: Every day, you're kept alive by cells that already *died* to build a wall. {c14}

## tease {end card held ≥ 1.6 s · signature: plucks F5, C6, A5 · energy: 0.35} (69–75 s)
vo: Next: does SPF one hundred block twice as much as *fifty*? {-}
end card: "Next layer: does SPF 100 block twice as much as 50?" · "Outer Layer · No. 002"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before posting.
- The 1979 figures (about 32 g/m² an hour under 30 weeks against about 6 near term) are the
  study's own averages; "about five times" is computed from them (32 ÷ 6 ≈ 5.3).
- Listen at T0: keratin, micrometers, SPF.
