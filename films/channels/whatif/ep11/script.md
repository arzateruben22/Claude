# Possibility Lab No. 011: "All the water in one ball" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 010's end card promised. Every number comes from `calc.py` (USGS's total of Earth's water, NASA's
sizes of the Earth and the Moon); `compile.py` reads its `RESULTS`. The voice says four figures (one point four billion
cubic kilometers, fourteen hundred kilometers, four hundred kilometers, an eighth of one percent); the running sum,
labels and footnote carry the rest (1,386,000,000 km³, 3,480 km, 12,756 km, 40%, 11%, 2.6 cm, 2.5%).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep11 --segment work`.

## hook {shot: you, one blue figure, beside a glass of water on the graph paper; the glass rises into a floating ball and grows · badge: thought experiment · title: "All the water in one ball" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.3 s)
vo: How big is Earth's *water*? Gather every drop into one ball, and measure it. {-}

## normal {shot: oceans, ice caps, rivers and clouds drain upward into one stream; the cubic-kilometer counter climbs · spine "all of Earth's water" · picture-only 0.3 s · energy: 0.45} (5.3–17 s)
vo: Count the oceans, the ice, the lakes, the rivers, the water underground, and the water in the air. {c1} It adds up to about one point four billion cubic *kilometers*. {c2}

## change {shot: the stream gathers into a sphere that swells; a ruler in kilometers · events: term.write · energy: 0.65} (17–27 s)
vo: Squeeze all of it into one round ball, as if it were a single giant drop. {-} That ball is about fourteen hundred kilometers *wide*. {c3}

## why {shot: pull back beside the ball: the Earth beyond, a planet-sized sphere · badge: ∵ liquid, ice and vapor counted together · picture-only 2 s · energy: 0.55} (27–40 s)
vo: That sounds enormous, and next to us it is. {-} But our world is much bigger, so let's set the ball next to a *planet*. {-}

## whoa {shot: the water ball hangs beside the Moon, then beside the Earth; the box closes round "≈ 1,400 km" · events: answer.box · picture-only 3 s · energy: 0.75} (40–52.5 s)
vo: It is less than half as wide as the *Moon*. {c4} Next to the Earth, it is a marble beside a *basketball*. {c5}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (52.5–61 s)
vo: Only a small part of the water is fresh; count just that, and the ball is about four hundred kilometers *wide*. {c6}

## takeaway {shot: the Earth with a thin blue film; the ball beside it · picture-only 0.3 s · energy: 0.45} (61–69 s)
vo: Earth looks like a water world from space. {-} But its water is only about an eighth of one percent of its *volume*. {c7}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (69–74.5 s)
vo: Next envelope: could we catch all the world's *lightning*? {-}
end card: "Next envelope: *catching all the lightning*" · "Possibility Lab · No. 011" · footnote: "USGS Water Science School: about 1.386 billion km³ of water on Earth." (c2)

## Notes
- Every number is `calc.py`'s. The answer is about 1,400 km (1,383 km computed), badged "liquid, ice and vapor counted together": all water, not only the sea.
- The last line means volume: one eighth of one percent of the Earth's volume.
- Listen at T0: "kilometers", "fourteen hundred", "marble".
