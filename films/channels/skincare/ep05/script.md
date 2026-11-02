# Outer Layer No. 005: "Same cells, every colour" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Bible §7 #5.

The story: put the lightest skin and the darkest side by side and count the pigment cells (melanocytes) in the
bottom row: about the same number. What differs is the work each one does: deeper skin's make more of the dark
melanin, in larger grains, handed out one by one. The wrong idea is "darker skin has more pigment cells"; the
people are Nina Jablonski and George Chaplin (2000), who set measured skin colour beside satellite UV and found
the two follow each other. The whoa: every skin colour is the same trade, folate kept safe from strong UV against
vitamin D made under weak UV, struck under a different sky. "To scale" puts the spacing of the pigment cells
(≈ 32 µm, computed from ≈ 955 per mm²) beside the paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Which has more?" (and the guess that follows it, "the darkest") to the takeaway's "None of them"; the voice
carries the meaning and the screen the specifics (≈ 1 per 36 cells, ≈ 955 per mm², melanosome sizes, Jablonski &
Chaplin 2000, the UV map, folate, vitamin D, 32 µm, 100 µm paper). The picture changes scale with the ideas: three
sections side by side → the basal rows, counted → one pigment cell's grains up close in three tones → a globe of
UV → the three sections again under their skies. Only three cuts, all scale jumps (irises).

Honesty, on screen: the sections are "simplified"; the counts are "same body site"; the grains are an
"illustration" of the measured sizes; the UV map is a "model" of the published pattern; the spacing is an
"estimate" (computed). The three sections are light, medium and deep side by side for the whole film, and the
film says nothing about any one tone except its melanin; never health, never behaviour, never worth. No advice.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep05 --segment toscale`.

## hook {shot: frame 0, the payoff: three sections side by side, light, medium and deep, their pigment cells lit in the bottom row, gauge at 0 µm · badge: simplified · title: "Same cells, every colour" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Which has more *pigment cells*? Count them, row by row. {-}

## normal {shot: no cut: the camera keeps pushing down to the three basal rows; the pigment cells glow, everything else steps back; on "Count" they light one by one in step across the three sections and a tally lands under each, the same · spine ≈ 1 : 36 → ≈ 955 / mm² · badge: same body site · picture-only 0.5 s · energy: 0.45} (5–17.5 s)
vo: Most would guess the darkest. {-} But in the bottom row of skin, each pigment cell feeds melanin to a few dozen neighbours. {c1,c2} Across all three, the number comes out about the *same*. {c3}

## change {shot: an iris into one medium-section pigment cell opens on three cells side by side, side by side, their grains (melanosomes) up close: few, small and clustered in the light one; many, larger, single in the deep one · badge: illustration · picture-only 0.6 s · energy: 0.55} (17.5–28 s)
vo: What changes is the work each one does. {c4} In deeper skin, they make more of the dark melanin, in larger grains, handed out one by *one*. {c5,c6}

## why {shot: an iris out of the grains opens on a globe; UV as a violet band strongest at the equator; dots of skin colour fill in and follow it on "matched" · badges: model · Jablonski & Chaplin, 2000 · picture-only 2.2 s · energy: 0.5} (28–40 s)
vo: So why would the work differ? Nina Jablonski and George Chaplin set skin colour beside sunlight, all around the world, and the two *matched*. {c8}

## whoa {shot: an iris from the globe's band opens on the three sections side by side, each under its own sky (fierce UV over the deepest, weak over the lightest); folate kept safe under the first, vitamin D made in the last; the camera arcs across all three, never one tone alone · picture-only 3.2 s · energy: 0.8} (40–53 s)
vo: Their idea: under fierce sun, more melanin protected a vitamin called folate. {c9} Under weak sun, less of it let enough light through to make *vitamin D*. {c10}

## toscale {segment: toscale · the gauge lifts to centre beside the sections: the gap between two pigment cells fills in, then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (53–61 s)
vo: And on any one part of the body, the pigment cells sit about a third of a paper's thickness *apart*. {c11,c12}

## takeaway {shot: back to the hook's three sections, their pigment cells lit · picture-only 0.5 s · energy: 0.3} (61–68 s)
vo: So, which has more? None of them. {c13} Same cells, every colour, each answering its own *sky*. {c14}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68–74.5 s)
vo: Next: skin answers the cold, too. Why goosebumps, with almost no *fur*? {-}
end card: "Next layer: why do we still get goosebumps, with almost no fur?" · "Outer Layer · No. 006"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see `claims.json`. A
  person opens each link, and a board-certified dermatologist signs off, before posting.
- "About a third of a paper's thickness apart": ≈ 955 melanocytes per mm² (meta-analysis mean across sites) →
  one per ≈ 1,047 µm² → ≈ 32 µm apart on a square grid (computed); 32 ÷ 100 ≈ a third. The number varies by body
  site, not by skin colour.
- Listen at T0: melanin, folate, Jablonski, Chaplin, vitamin D.
