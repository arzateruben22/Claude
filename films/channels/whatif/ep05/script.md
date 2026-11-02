# Back of the Envelope No. 005: "Everybody jump" (draft; fact-check before posting)

About 70 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score (A lydian, 50 BPM).
Every number comes from `calc.py` (the Earth's shift d = N·m·h / M, momentum conserved); `compile.py` reads
its `RESULTS`, so the voice, captions, spine readout and `claims.json` agree. The voice carries what the
numbers mean (WRITING.md "Flow"); the running sum, labels and footnote carry the figures (8.2 billion, 62 kg,
40 cm, 0.5 trillion kg, 6.0 × 10²⁴ kg, 10¹³, 3 × 10⁻¹⁴ m, 0.11 nm, 3,000, 2,000–6,000). The world: everyone in
one crowd on the graph-paper desk (No. 002's crowd, one dot a person), a small blue figure (you) at its edge,
the Earth model under it; then a zoom down the scale ladder, from the jump to an atom and past it.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{c1,c2}` after a sentence ties
it to `claims.json`; `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/whatif/ep05 --segment work`.

## hook {shot: one blue figure crouched on the graph paper, a whole Earth model hanging beneath the desk's edge · badge: thought experiment · title: "Everybody jump" · pre: 0.1 · picture-only 0.3 s · energy: 0.6} (0–5 s)
vo: Would the Earth *move*? If all of us jumped, at once. {-}

## normal {shot: the figure jumps; an arrow pushes the planet down; pull back: the crowd fills in round the figure, one dot a person · spine "8.2 billion × 62 kg" · badge: ∵ everyone in one place · picture-only 0.3 s · energy: 0.45} (5–15 s)
vo: When you jump, you push the ground away, and the ground is the whole planet. {c1} So gather everyone into one crowd, all eight billion, and jump *together*. {c2}

## change {shot: the crowd leaves the paper as one; the Earth model sinks a hair, an exaggerated arrow beside it · events: term.write · energy: 0.6} (15–24 s)
vo: For about half a second we're all in the air, and the planet, pushed the other way, drops away beneath our *feet*. {c3}

## why {shot: a balance: the crowd's tiny weight against the whole Earth, the beam pinned flat; spine "÷ 6.0 × 10²⁴ kg" · badge: ∵ momentum is shared out by mass · picture-only 2 s · energy: 0.55} (24–39 s)
vo: It sounds like it should knock the planet off course. {c4} But the push is shared out by weight, and the Earth outweighs all of us ten trillion times *over*. {c5}

## whoa {shot: zoom down the scale ladder: the jump, a hair, a cell, an atom, and past it to the Earth's step; the spine resolves and the box closes round "≈ 3 × 10⁻¹⁴ m" · events: answer.box · picture-only 3 s · energy: 0.75} (39–52 s)
vo: So the whole planet moves a distance three thousand times smaller than a single *atom*. {c6} And when we land, it settles right back where it *was*. {c7}

## work {segment: work · show your work: the whole sum on one line, its badges green, the sensitivity rows below · energy: 0.5} (52–58.5 s)
vo: Jump higher, or count us lighter, and it stays thousands of times smaller than an *atom*. {c8}

## takeaway {shot: back up the ladder to the crowd and the one blue figure, landed · picture-only 0.3 s · energy: 0.45} (58.5–64 s)
vo: So yes, the Earth moves when we jump. {c9} It just never *notices*. {-}

## tease {end card held ≥ 1.5 s · signature: plucks A4, E5, D♯5 · energy: 0.4} (64–71 s)
vo: Next envelope: what if a whole day's rain fell in one *second*? {-}
end card: "Next envelope: *every raindrop at once*" · "Back of the Envelope · No. 005" · footnote: "Earth 5.97 × 10²⁴ kg (NASA); 8.2 billion people (UN, 2024); 62 kg average adult (Walpole et al., 2012)." (c5)

## Notes
- Every number is `calc.py`'s; the answer is shown to one significant figure ("≈ 3 × 10⁻¹⁴ m").
- Thought experiment: spread round the real globe, the pushes point every which way and mostly cancel; the
  badge says everyone stands in one place.
- Listen at T0: "ten trillion", "atom".
