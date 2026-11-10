# One More Orbit, Season 2 · Episode 1: "Trees or stars" (draft; fact-check before posting)

S2E01 (folder ep07). Season 2 numbers its episodes from 1 again (owner decision, 9 Nov 2026).

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #7. It pays off episode 6's tease ("Next: more trees on Earth, or stars in our galaxy?")
and sets up episode 8 (the dark sky).

The story: the galaxy's stars are an estimate from its weight (about a hundred to four hundred billion);
Earth's trees are an estimate from ground plots scaled up with satellite maps (about three trillion, a 2015
study). Both are modelled, neither counted. Turn every star into a tree and the galaxy runs out first: trees
win by roughly eight to thirty times. The person: the 2015 study's team (Crowther and colleagues). The
wrong idea: that a galaxy must hold more of anything than one planet.

Honesty, on screen: "estimate" on both counts, "illustration" on the galaxy, "each dot = a billion" on the tally.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep07 --segment readout`.

## hook {shot: frame 0, the payoff: the galaxy (illustration) with a tally of teal dots beside it that has already overflowed it; spine "trees or stars: ?" · title: "Trees or *stars*" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–3.4 s)
vo: More trees, or more *stars*? {-} Guess *first*. {-}

## normal {shot: the galaxy, slow arc; a pin on the Sun · spine "stars in the Milky Way: 100 to 400 billion (estimate)" · picture-only 0.2 s · energy: 0.45} (3.4–13 s)
vo: Our galaxy has hundreds of *billions* of stars. {c1} Nobody counted them. {c2} Most of its weight is dark matter, so stars are a small *part*. {c10}

## change {shot: pull in to Earth; its forests light as teal dots · spine "trees on Earth: about 3 trillion (estimate)" · picture-only 0.2 s · energy: 0.55} (13–22.5 s)
vo: Now the trees. In twenty fifteen, a team put Earth's at about three *trillion*. {c3} That's *hundreds* of trees for every person alive. {c11}

## why {shot: two methods side by side: ground plots scaled up with satellite maps; a galaxy weighed and divided · spine "both are estimates" · picture-only 0.6 s · energy: 0.62} (22.5–37 s)
vo: Researchers counted trees in *ground* plots, then scaled up with satellite maps. {c5} Both are estimates, not exact counts, so each really means *about*. {c6} The honest answer is a *range*. {-}

## whoa {shot: every star turns into a tree: the galaxy's dots turn teal and fill Earth's tally; the tally overflows past the galaxy · spine "trees ÷ stars: roughly 8 to 30" · picture-only 0.6 s · energy: 0.8} (37–51 s)
vo: Now turn every star into a *tree*. {-} The stars run out, and Earth's forests keep *going*. {-} Trees win, by roughly eight to *thirty* times. {c7} Quick thing: if that made the sky feel bigger, tap like and follow. {-}

## takeaway {shot: hold on the overflow · picture-only 0.2 s · energy: 0.3} (51–58.5 s)
vo: There are *more* trees on Earth than stars in our galaxy. {c12} Big numbers hide in ordinary places. {-}

## readout {segment: readout · the closing light-time readout: "100,000 years" on screen across the galaxy; "1 millionth of a second" across a city block · a ping per line · picture-only 0.2 s · energy: 0.45} (58.5–66 s)
vo: *Light time* across our galaxy: longer than all of written history. {c8} Across a city block: about a *millionth* of a second. {c9}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (66–72 s)
vo: Next: with that many stars, why is the night sky *dark*? {-}
end card: "Next orbit: the *dark* sky" · "One More Orbit · Season 2 · Episode 2"

## Notes
- Every claim is OPEN until a person opens its source page (see `claims.json`); nothing here was opened.
- Listen at T0: "Milky Way", "trillion", "hundreds of billions".
- TODO: kilometers vs miles. The post must carry the AI-voice label (voice: synthetic).
