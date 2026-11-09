# Possibility Lab Season 2 · Episode 4: "Every shuffle is new" (draft; fact-check before posting)

S2E04 (folder ep10): Season 2 numbers its episodes from 1 again; the folder name stays ep10 so the pipeline and Prism imports keep working.

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
The destination No. 009's end card promised. Every number comes from `calc.py` (exact 52 factorial; UN population;
NASA's age of the universe); `compile.py` reads its `RESULTS`. The voice says four figures (fifty-two, sixty-eight
digits, eight billion, fourteen billion); the running sum, labels and footnote carry the rest (8 x 10^67, 3.6 x 10^27
shuffles, 4 x 10^-41, the 1,000-times row).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep10 --segment work`.

## hook {shot: you, one blue figure, riffle a deck on the graph paper; the cards fan out in one new order · badge: thought experiment · title: "Every shuffle is new" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5.2 s)
vo: Has this *ever* happened? Shuffle a deck, and look at the order. {-}

## normal {shot: the deck fans; the choices multiply: 52, then 51, then 50 on the spine · spine "52 × 51 × 50 …" · picture-only 0.3 s · energy: 0.45} (5.2–15 s)
vo: The first card can be any of fifty-two, the next any of the *rest*. {c1} Multiply all those choices, and you count the *orders*. {c2}

## change {shot: the product grows into a long number that fills the screen · events: term.write · energy: 0.65} (15–24 s)
vo: The answer has sixty-eight digits, too big to say out *loud*. {c3} Each shuffle is just one pick from that huge *pile*. {-}

## why {shot: a crowd of figures each shuffling; a clock runs back to the Big Bang · badge: ∵ one shuffle a second, for everyone · picture-only 2 s · energy: 0.55} (24–35.5 s)
vo: Now give everyone alive a deck, eight billion of us. {c4} Shuffle once a second for fourteen billion years, the age of the *universe*. {c5}

## whoa {shot: all those shuffles pile up as a bar, beside a bar for all possible orders that is far too tall to fit; the box closes round "< 1 in 10^36" · events: answer.box · picture-only 3 s · energy: 0.75} (35.5–48.8 s)
vo: Even then, you cover less than one part in a trillion trillion trillion of the *orders*. {c6} Your shuffle is almost certainly the first of its *kind*. {c7}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (48.8–56.4 s)
vo: Give the planet a thousand times more shufflers, and it barely *changes*. {c8} The pile of orders is just too *big*. {-}

## takeaway {shot: back to your deck, one new order, held · picture-only 0.3 s · energy: 0.45} (56.4–64.9 s)
vo: Shuffle well, and your order has almost certainly never existed before. {c9} Not certain, but a very safe *bet*. {-}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (64.9–70.7 s)
vo: Next envelope: all the water on Earth, in one *ball*. {-}
end card: "Next envelope: *all the water, one ball*" · "Possibility Lab · Season 2 · Episode 4" · footnote: "52! = 80,658,175,170,943,878,571,660,636,856,403,766,975,289,505,440,883,277,824,000,000,000,000." (c2)

## Notes
- Every number is `calc.py`'s; "almost certainly" is a probability statement, said as one. Real shuffles are imperfect: the film says "shuffle well".
- The thought experiment is badged: one fair shuffle a second for every person alive, since the Big Bang.
- Listen at T0: "fifty-two", "sixty-eight", "trillion trillion trillion".
