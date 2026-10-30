# Outer Layer No. 001: "The dead layer" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Bible §7 #1.

The story: the skin you can see is dead, every cell of it, and that is the point. Cells are born
alive at the base of the epidermis, rise for about two weeks, and take themselves apart on purpose
near the top. The wrong idea is that the dead layer is waste waiting to flake off; the stakes are
water: newborns whose wall isn't finished lose about five times as much through their skin
(Rutter and Hull, 1979). The "to scale" beat puts the whole dead layer beside a sheet of paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's question to its callback; the voice carries the meaning and the screen the specifics (≈15 rows, day 14, 1979, Rutter & Hull, 32 vs 6 g/m²·h, 17 µm on the cheek, 100 µm paper); "to scale" is the wall's last turn, not an announcement.

Honesty, on screen: the section is "simplified" (about 15 rows drawn, real cells are flatter); the
climb runs under "time ×N"; the brick wall is a "model"; the water beads are an "illustration".
The skin is drawn in three melanin levels across the episode (light in the hook, deep in the climb,
medium in the whoa); nothing about any one tone is said or implied.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}`
ties a sentence to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep01 --segment toscale`.

## hook {shot: frame 0, the payoff: the section in a light tone, the top rows of dead flat cells lit, gauge at 0 µm · badge: simplified · title: "The dead layer" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Is your skin *alive*? The part you can see isn't: not one cell. {c1}

## normal {shot: push into the section on "Look"; label the stratum corneum, one dead cell, then the living layers · spine ≈15 rows · picture-only 0.5 s · energy: 0.4} (5–16 s)
vo: Look closer: the surface is a stack of flattened cells, more than a dozen deep, each an empty shell packed with *keratin*. {c2,c3} The living ones start just underneath. {c4}

## change {shot: the camera drops to the basal row on "down there" and rides up with one cell (time ×300,000) · spine day 0 → 14 · picture-only 0.6 s · energy: 0.55} (16–28 s)
vo: Every one of them began down there, alive, then rose for about two weeks, filling with keratin, until near the top it took itself apart, *on purpose*. {c5,c6,c7}

## why {shot: pull back on "But" until the rows read as bricks; the lipid mortar lights on "sealed"; water beads turn back under the wall on "inside" · badge: model · picture-only 2.2 s · energy: 0.5} (28–41.5 s)
vo: It looks like waste, waiting to flake away. {-} But sealed together with fats, those shells build a kind of *brick wall*, and the wall keeps your water inside. {c8,c9}

## whoa {shot: match cut on "Babies" to two walls, a finished one and a thin one; water streams out through the thin one · spine 1979 → ≈5× · badges: illustration · Rutter & Hull, 1979 · picture-only 3.2 s · energy: 0.8} (41.5–53.5 s)
vo: Babies born too early haven't finished theirs, and doctors measuring their skin found it losing water about *five times* as fast. {c10,c11}

## toscale {segment: toscale · the gauge lifts to centre beside the section: the wall's 17 µm fills in, then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (53.5–61 s)
vo: And that whole wall, on a cheek, is thinner than a fifth of a sheet of *paper*. {c12,c13}

## takeaway {shot: back to the hook's composition, the dead rows glowing faintly · picture-only 0.5 s · energy: 0.3} (61–68.5 s)
vo: So, is your skin alive? Underneath, yes. On top, it wears a layer that *died* for it. {c14}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–74 s)
vo: Next: does SPF one hundred block twice as much as *fifty*? {-}
end card: "Next layer: does SPF 100 block twice as much as 50?" · "Outer Layer · No. 002"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before posting.
- "About five times as fast" is computed from the study's averages (about 32 g/m² an hour under 30 weeks
  against about 6 near term: 32 ÷ 6 ≈ 5.3); both figures and the study are on screen.
- "Thinner than a fifth of a sheet of paper": 17 µm against 100 µm (0.17); both on the gauge.
- Listen at T0: keratin.
