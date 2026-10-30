# Back of the Envelope No. 004: "Count to a billion" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
Every number comes from `calc.py` (exact syllables of every number word to a billion, timed at the measured
pace of the man who counted to a million); `compile.py` reads its `RESULTS`, so the voice, captions, spine
readout and `claims.json` agree. The voice carries what the numbers mean (WRITING.md "Flow"); the running
sum, labels and footnote carry the figures (1,000,000,000 × 1 s, 32 yr, 21 syllables, 9 s, 89 days, 16 h a
day, 2.6 syllables/s, 380 yr, 5 lifetimes, 260 and 190 yr). The world: a paper tape of numbers unspooling
across the graph-paper desk from one blue figure (you), each number a strip as long as it takes to say.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep04 --segment work`.

## hook {shot: the blue figure at the start of a long paper tape on the desk, "1" printed at its foot; spine "1 → 1,000,000,000" · badge: thought experiment · title: "Count to a billion" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5 s)
vo: Can you count to a *billion*? Out loud, every single number. {-}

## normal {shot: the tape ticks forward one number a second; a year counter rides along · spine "1,000,000,000 × 1 s ≈ 32 yr" · badge: ∵ a number a second · picture-only 0.3 s · energy: 0.45} (5–15 s)
vo: A number a second sounds fair, and even at that pace you'd be counting for about *thirty-two years*. {c1} But the numbers don't stay *short*. {c2}

## change {shot: push down the tape: each number's strip grows with its syllables, from "one" to "seven hundred seventy-seven million…" · events: term.write · energy: 0.6} (15–25 s)
vo: Up in the hundreds of millions, every number is a sentence of its own, and you have to say *all* of it. {c2,c3}

## why {shot: a second, shorter tape beside it: one million, a webcam light, a calendar strip of days filling · badge: ∵ his pace, his hours · picture-only 2 s · energy: 0.55} (25–40 s)
vo: We know how fast a person really counts, because a man did it, live on the internet, through most of his waking hours, all the way to a *million*. {c4} It took him most of a *summer*. {c5}

## whoa {shot: pull back along the billion tape until it runs off the desk; the spine resolves and the box closes round "≈ 380 yr"; five blue lifetime bars stack beside it · events: answer.box · picture-only 3 s · energy: 0.75} (40–53 s)
vo: Keep going at his pace, sleeping when he slept, and the whole count takes nearly *four hundred years*. {c6} That's about five whole lifetimes of nothing but *numbers*. {c7}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (53–59 s)
vo: Never sleep, or talk twice as fast, and you'd still need *centuries*. {c8}

## takeaway {shot: back to the figure at the tape's start, the box held · picture-only 0.3 s · energy: 0.45} (59–66 s)
vo: So the word is easy to say once, and the number is out of reach one by *one*. {c9}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (66–72 s)
vo: Next envelope: if everyone jumped at once, would the Earth *move*? {-}
end card: "Next envelope: *everybody jump*" · "Back of the Envelope · No. 004" · footnote: "Jeremy Harper counted aloud from 1 to 1,000,000 in 89 days, 18 June to 14 September 2007, about 16 hours a day." (c4)

## Notes
- Every number is `calc.py`'s; answers are shown to two significant figures ("≈ 380 yr").
- Thought experiment: nobody should try it. Harper's count is the record we calibrate to, not a challenge.
- Listen at T0: "billion", "thirty-two", "centuries".
