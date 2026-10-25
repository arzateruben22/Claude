# Light Minute No. 005: "How big is the Sun" (draft; fact-check before posting)

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #4. It pays off episode 4's tease ("Next: pour Earths into the Sun. How many before
it's full?") and sets up episode 6 (your speed).

The story: in our sky the Sun looks no bigger than the full Moon. Across its face go 109 Earths.
Anaxagoras, in Athens, said it was a fiery stone bigger than southern Greece; calling it a stone, not
a god, got him charged with impiety. He was right, by a factor of about eight thousand. Fill it: about 1.3 million Earths. It holds 99.8% of
the solar system's mass, and among the stars it is ordinary. The person: Anaxagoras; the wrong idea:
that the Sun is about the size it looks; the stakes: what he risked for calling it a stone.

Honesty, on screen: "not to scale" where it is not (the beads are packed for show), "illustration"
on the star field, and "by volume" on the 1.3 million.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep05 --segment readout`.

## hook {shot: frame 0, the payoff: the Sun and the full Moon side by side, the same size, Earths starting to pour into one · spine "Earths inside: ?" · title: "How big is the Sun" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–3.8 s)
vo: Which holds a million *Earths*? {-} They look like *twins*. {c17}

## normal {shot: your sky: the Sun and the full Moon side by side, the same size; then the true sizes and distances, a ×400 ruler · spine "400 × wider, 400 × farther" · picture-only 0.2 s · energy: 0.45} (3.8–14 s)
vo: In your sky, the Sun and the full Moon look the same size. {c1} But one is about four hundred times wider, and four hundred times farther *away*. {c2}

## change {shot: true sizes: Earths lined up across the Sun's face, Earth a dot at its rim · spine "Earths across: 109" · picture-only 0.2 s · energy: 0.55} (14–22.5 s)
vo: Line Earths up across the Sun's face: a hundred and *nine*. {c3} Your whole world would fit inside one big *sunspot*. {c14}

## why {shot: a map-like overlay: the Peloponnese against the Sun's disc, a speck; the label "Anaxagoras, Athens" · spine "his guess: bigger than southern Greece" · picture-only 2 s · energy: 0.62} (22.5–40 s)
vo: Nearly twenty-five centuries ago, in Athens, Anaxagoras said the Sun was a fiery stone, bigger than southern *Greece*. {c4} Calling it a stone, not a god, got him charged with impiety. {c5} He was right. {c6} By a factor of about eight *thousand*. {c15}

## whoa {shot: the beads pour in until the Sun is full; then the one scale jump: pull back until the Sun is one star among many · spine "Earths inside: 1.3 million", then "the biggest known stars: over 1,000 × wider" · picture-only 3 s · energy: 0.8} (40–52.5 s)
vo: Melt down one point three million Earths, and they'd *fill* it. {c7} Yet among the stars, it's ordinary. {c9} Some are more than a thousand times *wider*. {c8}

## takeaway {shot: hold on the star field, the Sun one point among many · picture-only 0.2 s · energy: 0.3} (52.5–59 s)
vo: Astronomers even file the Sun under *dwarf* stars. {c10} Out there, this is what ordinary looks like. {c11}

## readout {segment: readout · the closing light-time readout: "5 s" across the Sun, then "8 min 20 s" Sun to Earth · a ping per line · picture-only 0.2 s · energy: 0.45} (59–66 s)
vo: *Light time*, across the Sun: about five seconds. {c12} Sun to Earth: eight minutes, twenty seconds. {c13}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (66–72 s)
vo: Next: since this started, you've flown at least two thousand kilometers. {c16} *How*? {-}
end card: "Next light: how fast are you *moving*" · "Light Minute · No. 006"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Anaxagoras, impiety, sunspot, "one point three million".
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
