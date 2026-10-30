# Back of the Envelope No. 001: "Through the Earth" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Every
number comes from `calc.py` (PREM density, a uniform Earth, constant gravity); `compile.py` reads
its `RESULTS`, so the voice, captions, spine readout and `claims.json` agree. The world: a cutaway
Earth on the graph-paper desk, a straight tunnel through its centre, one small blue figure (the
human-scale anchor) who falls.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a
sentence ties it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep01 --segment work`.

## hook {shot: the cutaway Earth, the tunnel lit, the figure at the rim; spine "12,700 km ÷ ? = ? min" · badge: thought experiment · title: "Through the Earth" · pre: 0.1 · picture-only 0.3 s · energy: 0.65} (0–5.5 s)
vo: How long to fall *through the Earth*? Step in, and let go. {-}

## normal {shot: push along the tunnel; the anchor figure beside a car for scale · badges: ∵ no air, ∵ no heat, ∵ no spin · spine term "12,700 km" · picture-only 0.3 s · energy: 0.45} (5.5–14 s)
vo: The tunnel runs straight through the middle of the planet, so long that driving it would take *days*. {c1,c2} But you'll be *falling*. {-}

## change {shot: the figure drops; a speed readout climbs, peaks at the centre, falls to zero at the far rim · events: term.write · energy: 0.6} (14–27 s)
vo: And gravity keeps pulling, until at the center you're moving about *ten kilometers a second*. {c3} Then that pull slows you on the way up, and you arrive just as you *stop*. {c4}

## why {shot: the cutaway's layers light one by one; a gravity graph rises through the mantle and peaks at the core's edge · badge: ∵ PREM density (seismology) · picture-only 2 s · energy: 0.55} (27–44.5 s)
vo: That whole trip, the textbooks said, takes *forty-two minutes*. {c5} But they pictured the same stuff all the way down. {c6} A graduate student redid the sum with the real Earth, and its heavy core makes gravity grow *stronger* as you fall. {c7,c8}

## whoa {shot: the spine resolves and the box closes around "≈ 38 min"; pull back as the figure falls back and forth, a round-trip counter ticking · events: answer.box · picture-only 3 s · energy: 0.75} (44.5–57 s)
vo: So you fall faster, sooner, and come out the other side in about *thirty-eight minutes*. {c9} With nobody to catch you, you'd swing back through, *forever*. {c10}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity row below · energy: 0.5} (57–62.5 s)
vo: Lighten that core in the sum, and the answer drifts back toward the *textbook's*. {c11,c12}

## takeaway {shot: the box holds; the cutaway's core glows marker · picture-only 0.3 s · energy: 0.45} (62.5–69.5 s)
vo: So a fall through the Earth is more than a ride. {-} It's a way of weighing its *heart*. {c13}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (69.5–74.5 s)
vo: Next envelope: could everyone alive stand in one *city*? {-}
end card: "Next envelope: *everyone, one place*" · "Back of the Envelope · No. 001" · footnote: "Klotz, Am. J. Phys. 83, 231 (2015): 38 min 11 s with the real Earth; 42 min 12 s uniform." (c9)

## Notes
- Every number is `calc.py`'s; the film never shows more than two significant figures of an
  answer (the footnote quotes the paper's own seconds, attributed).
- Thought experiment: no tunnel could survive the heat or pressure; the badges say so.
- Listen at T0: Klotz, kilometers, seventy-six.
