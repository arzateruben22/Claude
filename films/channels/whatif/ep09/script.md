# Possibility Lab Season 2 · Episode 3: "A rope round the Earth" (draft; fact-check before posting)

S2E03 (folder ep09): Season 2 numbers its episodes from 1 again; the folder name stays ep09 so the pipeline and Prism imports keep working.

About 71 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 008's end card promised. Every number comes from `calc.py` (NASA's Earth diameter; circle
geometry); `compile.py` reads its `RESULTS`. The voice says four figures (forty thousand kilometers, one meter, six
meters, four of you); the running sum, labels and footnote carry the rest (2 x pi x 1 m = 6.28 m, 63 m at ten meters,
the ball, the Sun).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep09 --segment work`.

## hook {shot: a rope hugging the whole Earth, a thin chalk ring; you, one blue figure, stand on the graph paper beside the rope's near edge · badge: thought experiment · title: "A rope round the Earth" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–6.6 s)
vo: How much more *rope*? Round the whole Earth, lifted one meter off the ground. {-}

## normal {shot: the rope runs off both ways along the paper; the counter shows its length · spine "40,000 km of rope" · picture-only 0.3 s · energy: 0.45} (6.6–17.4 s)
vo: Start with a rope that hugs the planet, about forty thousand kilometers *long*. {c1} Now lift it one meter above the ground, *everywhere*. {-}

## change {shot: the rope rises a meter on poles, round the whole globe; a guess bar fills: "thousands of km?" · events: term.write · energy: 0.65} (17.4–25.2 s)
vo: A whole planet of rope, lifted all at once. {-} You might guess it needs thousands of kilometers *more*. {-}

## why {shot: a plain circle on the paper, the radius marked, then the radius grows by one meter · badge: ∵ a perfect circle · picture-only 0.4 s · energy: 0.55} (25.2–37.2 s)
vo: But a circle's length is two times pi times its radius, the distance to its *center*. {c2} Lift the rope a meter, and the radius grows a *meter*. {c3}

## whoa {shot: the extra rope laid out beside you on the paper, about four of you head to toe; the box closes round "≈ 6.3 m" · events: answer.box · picture-only 0.4 s · energy: 0.75} (37.2–48 s)
vo: So the rope grows by two times pi times one meter, a bit over six *meters*. {c4} That is about four of you, lying head to *toe*. {c5}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (48–55.8 s)
vo: Try a basketball or the Sun: lift the rope one meter, and the extra rope is the *same*. {c6}

## takeaway {shot: the rope, lifted ten meters, and its extra length, 63 m · picture-only 0.3 s · energy: 0.45} (55.8–64.2 s)
vo: The planet's size cancels out: only the lift *matters*. {c7} Ten times higher needs ten times more *rope*. {c8}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (64.2–70.8 s)
vo: Next envelope: a shuffled deck, and a very rare *order*. {-}
end card: "Next envelope: *a shuffled deck*" · "Possibility Lab · Season 2 · Episode 3" · footnote: "NASA Earth Facts: equatorial diameter 12,756 km." (c1)

## Notes
- Every number is `calc.py`'s; the answer is a thought experiment, badged: a perfect sphere, a smooth rope, no sag.
- The answer is "about 6.3 m" however big the planet: said once, shown in the box.
- Listen at T0: "radius", "pi", "six".
- Lint note: the kit lint asks for picture-only 2 s (why) and 3 s (whoa); for this channel the coordinator's rule "no voiceless gap over 1.2 s" overrides it, so those lint errors are expected.
