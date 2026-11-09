# Possibility Lab Season 2 · Episode 2: "Everyone holds hands" (draft; fact-check before posting)

S2E02 (folder ep08): Season 2 numbers its episodes from 1 again; the folder name stays ep08 so the pipeline and Prism imports keep working.

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 007's end card promised. Every number comes from `calc.py` (UN population, one assumed arm span,
NASA's equator and Moon distance); `compile.py` reads its `RESULTS`. The voice says four figures (eight billion,
twelve million kilometers, three hundred and ten laps, one person in three hundred); the running sum, labels and
footnote carry the rest (1.5 m, 40,075 km, 32 trips to the Moon, 27 million, 1.4 and 1.7 m).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep08 --segment work`.

## hook {shot: you, one blue figure, arms out, on the graph paper; another figure beside you takes your hand, then another, a chain running off to the horizon · badge: thought experiment · title: "Everyone holds hands" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.3 s)
vo: How long is a chain of *us*? Everyone on Earth, holding hands. {-}

## normal {shot: arms out wide, a ruler under you reads one arm span; kids and grown-ups stand in a row · spine "1.5 m a person" · picture-only 0.3 s · energy: 0.45} (5.3–17 s)
vo: Stretch your arms out wide. You are about as wide as you are *tall*. {c1} Call it a meter and a half, for grown-ups and kids *together*. {c2}

## change {shot: the chain grows past the horizon, person by person; the km counter runs · events: term.write · energy: 0.65} (17–27 s)
vo: Now add all eight billion people, one after another, hand in hand. {c3} Out past the horizon it goes, until the line is about twelve million kilometers *long*. {c4}

## why {shot: pull back: the chain is a thin thread across the dark; no scale · badge: ∵ a thought experiment · picture-only 2 s · energy: 0.55} (27–40 s)
vo: That number is too big to picture. {-} So let's wrap the line around something we all know: the *Earth*. {-} Pull it tight, like a thread. {-}

## whoa {shot: the chain wraps the equator; the globe fills with laps like a ball of thread; the box closes round "≈ 310 laps" · events: answer.box · picture-only 3 s · energy: 0.75} (40–52.5 s)
vo: It circles the Earth about three hundred and ten *times*. {c5} And one lap needs only about one person in three hundred of *us*. {c6}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (52.5–59 s)
vo: Make everyone a little shorter or taller, and the chain still wraps the Earth hundreds of *times*. {c7}

## takeaway {shot: the thread straightens toward the Moon; it makes the trip thirty-two times · picture-only 0.3 s · energy: 0.45} (59–66.5 s)
vo: The same line would reach the Moon again and *again*. {c8} We are each small, but together we are very *long*. {-}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (66.5–72 s)
vo: Next envelope: a rope round the Earth, lifted one *meter*. {-}
end card: "Next envelope: *a rope round the Earth*" · "Possibility Lab · Season 2 · Episode 2" · footnote: "UN World Population Prospects 2024: about 8.2 billion people." (c3)

## Notes
- Every number is `calc.py`'s; the answer is a thought experiment, badged: no oceans in the way, nobody left out.
- The answer is "about 310 laps", not 12.3 million km: the voice says both, the box holds the laps.
- Listen at T0: "eight billion", "twelve million", "three hundred and ten".
