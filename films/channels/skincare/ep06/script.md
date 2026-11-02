# Outer Layer No. 006: "Goosebumps" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Bible §7 #6.

The story: every hair has a tiny muscle, and a nerve that pulls it when we are cold or afraid. In a furred
animal that fluffs the coat into a blanket of trapped air; we have about as many follicles as a chimpanzee, but
ours grow fine, near-invisible hairs, so the bumps rise with nothing to fluff. The wrong idea is "a useless
leftover"; the person is Ya-Chieh Hsu's lab at Harvard (Shwartz et al., Cell, 2020), which found that the same
nerve also wires into the follicle's stem cells, the muscle holds that wiring in place, and in the cold it wakes
them. The whoa: the reflex that once fluffed fur still tends the follicle that grows the hair. "To scale" puts
one of our fine hairs beside the paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Why do we get goosebumps?" to the takeaway's "still"; the voice
carries the meaning and the screen the specifics (arrector pili, sympathetic nerve, noradrenaline, the chimpanzee
comparison, Shwartz et al. 2020 in mice, vellus < 30 µm, 100 µm paper). The picture changes scale with the
ideas: an arm's skin at the mm rung → one follicle in section, its muscle and nerve → a furred coat lifting →
our fine hairs → the stem cells at the bulge, lit by the nerve → back out to the bumps.

Honesty, on screen: the follicle section is "simplified"; the fur is an "illustration"; the stem-cell finding is
"in mice"; the hair width is "vellus: by definition < 30 µm". The skin is drawn in three melanin levels (deep in
the hook, light in the follicle, medium in the close). No advice.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep06 --segment toscale`.

## hook {shot: frame 0, the payoff: skin at the mm rung in a deep tone, bumps raised round each fine hair, gauge at 0 µm · badge: simplified · title: "Goosebumps" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–4.5 s)
vo: Why do we get *goosebumps*? We hardly have fur. {c1}

## normal {shot: the skin flattens, then a cut opens through one bump: a follicle, its hair, a tiny muscle running from the follicle to the surface, a nerve beside it; on "cold" the nerve lights, the muscle shortens, the hair stands and the skin around it puckers · spine arrector pili · picture-only 0.5 s · energy: 0.45} (4.5–16 s)
vo: Nearly every hair has its own tiny muscle, and when we're cold or frightened, a nerve tugs it, pulling the hair upright and the skin around it into a *bump*. {c2,c3}

## change {shot: match cut on "In" to a furred coat in section: hundreds of hairs stand together and the air between them thickens; then back to ours on "ours": the same number of follicles, the hairs fine and pale · spine ≈ same follicles as a chimpanzee · badge: illustration · picture-only 0.6 s · energy: 0.55} (16–28 s)
vo: In a furry animal, that fluffs the coat into a blanket of trapped *air*. {c4} We have about as many hair follicles as a chimpanzee, but ours grow fine, almost invisible hairs. {c5,c6}

## why {shot: push down the follicle to the bulge on "But"; the stem cells there light; the nerve's branches reach them on "nerve", held in place by the muscle · badges: in mice · Shwartz et al., 2020 · picture-only 2.2 s · energy: 0.5} (28–42 s)
vo: So the bumps look like a leftover. {c7} But a team at Harvard found the same nerve also reaches the stem cells that grow the hair, and the little muscle holds it in *place*. {c8,c9}

## whoa {shot: cold arrives (a frost line across the surface); the nerve fires, the stem cells divide and a new hair grows up the follicle (time ×N); remove the muscle in a second follicle beside it on "Without" and its wiring fades, its hair waits · spine noradrenaline · picture-only 3.2 s · energy: 0.8} (42–55 s)
vo: In the cold, that nerve wakes the stem cells, and the mice grew new hair *sooner*. {c10} Take the little muscle away, and the wiring fades. {c11}

## toscale {segment: toscale · the gauge lifts to centre beside the follicle: one of our fine hairs' width fills in, then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (55–61.5 s)
vo: And most of the hairs it tends are thinner than a third of a sheet of *paper*. {c12,c13}

## takeaway {shot: back to the hook's skin, the bumps rising once more · picture-only 0.5 s · energy: 0.3} (61.5–68.5 s)
vo: So why do we still get goosebumps? Because the muscle that raises a hair still *looks after it*. {c14}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–74.5 s)
vo: That's the outer layer, for now. Next season, we go *deeper*. {-}
end card: "Next layer: season 2, deeper" · "Outer Layer · Season 1"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see `claims.json`. A
  person opens each link, and a board-certified dermatologist signs off, before posting.
- The tease (the season's last) is a placeholder until the first builder or the coordinator names season 2's
  first topic.
- Listen at T0: goosebumps, follicles, chimpanzee.
