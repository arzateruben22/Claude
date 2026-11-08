# Possibility Lab No. 009: "A rope around the Earth" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 008's end card promised. Every number comes from `calc.py` (NASA's Earth diameter; circle
geometry); `compile.py` reads its `RESULTS`. The voice says four figures (forty thousand kilometers, one meter, six
meters, four of you); the running sum, labels and footnote carry the rest (2 x pi x 1 m = 6.28 m, 63 m at ten meters,
the ball, the Sun).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep09 --segment work`.

## hook {shot: a rope hugging the whole Earth, a thin chalk ring; you, one blue figure, stand on the graph paper beside the rope's near edge · badge: thought experiment · title: "A rope around the Earth" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.3 s)
vo: How much more *rope*? Round the whole Earth, lifted one meter off the ground. {-}

## normal {shot: the rope runs off both ways along the paper; the counter shows its length · spine "40,000 km of rope" · picture-only 0.3 s · energy: 0.45} (5.3–17 s)
vo: Start with a rope that hugs the planet, about forty thousand kilometers *long*. {c1} Now lift it, so it floats one meter above the ground, *everywhere*. {-}

## change {shot: the rope rises a meter on poles, round the whole globe; a guess bar fills: "thousands of km?" · events: term.write · energy: 0.65} (17–27 s)
vo: A whole planet of rope, lifted all at once. {-} You might guess it needs thousands of kilometers more, because the planet is so *big*. {-}

## why {shot: a plain circle on the paper, the radius marked, then the radius grows by one meter · badge: ∵ a perfect circle · picture-only 2 s · energy: 0.55} (27–40 s)
vo: But a circle's length is two times pi times its radius, the distance to its *center*. {c2} Lift the rope a meter, and that radius is a meter *bigger*. {c3}

## whoa {shot: the extra rope laid out beside you on the paper, about four of you head to toe; the box closes round "≈ 6.3 m" · events: answer.box · picture-only 3 s · energy: 0.75} (40–52.5 s)
vo: So the rope grows by two times pi times one meter, about six *meters*. {c4} That is about four of you, lying head to *toe*. {c5}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (52.5–60 s)
vo: Try a basketball or the Sun: lift the rope one meter, and the extra rope is the *same*. {c6}

## takeaway {shot: the rope, lifted ten meters, and its extra length, 63 m · picture-only 0.3 s · energy: 0.45} (60–69 s)
vo: The planet's size cancels out, and only the height of the lift *matters*. {c7} Lift it ten times higher, and you need ten times more *rope*. {c8}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (69–74.5 s)
vo: Next envelope: a shuffled deck, and a very rare *order*. {-}
end card: "Next envelope: *a shuffled deck*" · "Possibility Lab · No. 009" · footnote: "NASA Earth Facts: equatorial diameter 12,756 km." (c1)

## Notes
- Every number is `calc.py`'s; the answer is a thought experiment, badged: a perfect sphere, a smooth rope, no sag.
- The answer is "about 6.3 m" however big the planet: said once, shown in the box.
- Listen at T0: "radius", "pi", "six".
