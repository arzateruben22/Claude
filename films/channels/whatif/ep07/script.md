# Possibility Lab No. 007: "Walking to the Moon" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 006's end card promised. Every number comes from `calc.py` (NASA's mean Moon distance, an easy
walking pace, one assumed walking day); `compile.py` reads its `RESULTS`. The voice says four figures (thirty Earths,
nine years, twenty-six years, a hundred and forty); the running sum, labels and footnote carry the rest
(384,400 km, 5 km/h, 76,880 h, 8 h a day, 4 and 6 km/h, 10,000 steps, 7.5 km, three days).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep07 --segment work`.

## hook {shot: you, one blue figure on the graph paper, a small path of footprints running off to the horizon · badge: thought experiment · title: "Walking to the Moon" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.4 s)
vo: How long to walk to the *Moon*? Starting at your own front door. {-}

## normal {shot: pull back off the paper: the Earth, then the Moon far across the dark, thirty Earths away · spine "384,400 km" · picture-only 0.3 s · energy: 0.45} (5–13 s)
vo: The Moon sits about thirty Earths away, lined up side by *side*, with nothing but dark between. {c1,c2}

## change {shot: the walker sets off along the line; the years counter runs · events: term.write · energy: 0.65} (13–23 s)
vo: Walk at an easy pace, the kind you could chat through. {c3} Never stop, not even to sleep. {-} You would arrive in about nine *years*. {c4}

## why {shot: the walker stalls at a bed, a table, a chair, then moves on; the counter slows · badge: ∵ eight hours a day · picture-only 2 s · energy: 0.55} (23–34 s)
vo: But nobody walks day and night. {-} You sleep, you eat, you stop to tie a shoe. {-} So give yourself a working day of *walking*. {c5}

## whoa {shot: the walker's line stretches out across the gap; the counter reaches the Moon; the box closes round "≈ 26 yr" · events: answer.box · picture-only 3 s · energy: 0.75} (34–42.5 s)
vo: A working day of walking gets you there in about twenty-six *years*. {c6}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (42.5–56.5 s)
vo: Slower adds years, quicker trims a few. {c8} Ten thousand steps a day, the popular goal, is only about seven and a half *kilometers*. {c7} So that trip takes about a hundred and forty *years*. {c10}

## takeaway {shot: the Moon beside a small capsule that crosses the gap in three days · picture-only 0.3 s · energy: 0.45} (56.5–65 s)
vo: Apollo eleven's crew made the same trip in about three *days*. {c9} The distance never changed, only the *speed*. {-}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (65–70.5 s)
vo: Next envelope: what if everyone on Earth held *hands*? {-}
end card: "Next envelope: *everyone, holding hands*" · "Possibility Lab · No. 007" · footnote: "NASA Science, Moon Facts: average distance 384,400 km." (c1)

## Notes
- Every number is `calc.py`'s; the answer is a thought experiment, badged: no road, no air, no rest stops.
- The nonstop figure (about nine years) is the floor, never the headline: the boxed answer is the honest one (26 years).
- Listen at T0: "kilometers", "twenty-six", "Apollo".
