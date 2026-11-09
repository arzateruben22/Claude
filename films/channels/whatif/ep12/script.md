# Possibility Lab Season 2 · Episode 6: "Catch all the lightning" (draft; fact-check before posting)

S2E06 (folder ep12): Season 2 numbers its episodes from 1 again; the folder name stays ep12 so the pipeline and Prism imports keep working.

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 011's end card promised. Every number comes from `calc.py` (a worldwide flash rate, an
order-of-magnitude energy per flash, world electricity use); `compile.py` reads its `RESULTS`. The voice says four
figures (forty-four a second, a billion joules, about five days, nearly eighty times); the running sum, labels and
footnote carry the rest (1.4 billion flashes, 390 TWh, 1.3%, 0.5 and 47 days).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep12 --segment work`.

## hook {shot: you, one blue figure, under a night sky on the graph paper; a bolt strikes far off and a light bulb above you glows for a blink · badge: thought experiment · title: "Catch all the lightning" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.3 s)
vo: Could lightning power the *world*? Catch every bolt, for a whole year. {-}

## normal {shot: the globe turns; bolts flicker over it, a counter ticks flashes a second · spine "44 flashes a second" · picture-only 0.3 s · energy: 0.45} (5.3–17 s)
vo: Somewhere on Earth, lightning is flashing right now, about forty-four times every *second*, all around the planet. {c1} That adds up to more than a billion flashes in a *year*. {c2}

## change {shot: one bolt, enlarged, with a meter beside it reading "about 1 billion joules" · events: term.write · energy: 0.65} (17–27 s)
vo: One flash carries roughly a billion joules, a rough guess with a wide *range*. {c3} Multiply it by every flash in the *year*. {-}

## why {shot: the year's bolts pour into a tank on the paper; the tank fills to a mark labelled 390 billion kWh · badge: ∵ every bolt caught, nothing lost · picture-only 2 s · energy: 0.55} (27–40 s)
vo: That is about four hundred billion kilowatt-hours, a very big number. {c4} But a number only means something next to another number, so let's put it beside what we really *use*. {-}

## whoa {shot: a second tank, the world's electricity for a year, towers over the first; the lightning tank is a thin slice; the box closes round "≈ 5 days" · events: answer.box · picture-only 3 s · energy: 0.75} (40–52.5 s)
vo: The world uses nearly eighty times more electricity in a year. {c5} All the lightning on Earth would run it for about five *days*. {c6}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (52.5–61 s)
vo: If a flash holds ten times less or ten times more, the answer swings from half a day to about seven *weeks*. {c7}

## takeaway {shot: the bolts scatter across the whole globe, each gone in a blink · picture-only 0.3 s · energy: 0.45} (61–69 s)
vo: And catching it is the real problem. {-} The bolts are everywhere, and each one is over in a split *second*. {-}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (69–74.5 s)
vo: Next envelope: a what-if that you ask us *next*. {-}
end card: "Next envelope: *your what-if*" · "Possibility Lab · Season 2 · Episode 6" · footnote: "About 44 flashes a second: Christian et al., J. Geophys. Res. 108 (2003)." (c1)

## Notes
- Every number is `calc.py`'s and an order of magnitude: the energy of a flash varies a lot, so the film gives a range and says "roughly".
- The takeaway says only that catching it is hard; it does not claim a share that could be captured.
- Listen at T0: "forty-four", "billion joules", "five days".
