# Outer Layer No. 004: "The deadliest dose" (draft; dermatologist sign-off before posting)

About 75 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, topic
"What Botox does" (mechanism only; the voice says "botulinum toxin", never the brand).

The story: a frown is not the skin doing something; it is a nerve ending telling a muscle to pull. Botulinum toxin
type A cuts one protein inside that nerve ending (SNAP-25), so the "contract" message (acetylcholine) is made but
never sent. The wrong idea is that it works on the skin, filling or freezing it; the skin is never the target. The
person is Justinus Kerner, who in the 1820s traced a deadly paralysis to spoiled sausages and guessed the same
poison might one day be a medicine. The stakes open the film: a banknote's weight of the crystalline toxin,
evenly dispersed and inhaled, is estimated to be enough to kill more than a million people (a theoretical
worst case, JAMA 2001). The counter-intuitive turn is in the whoa: a dose of it is not weighed at all. It is
counted in lethality — one unit is the dose that kills half a group of mice — so the cosmetic dose and the lethal
dose are marked on the same ruler, and a whole frown takes twenty of those units, still under a hundredth of an
estimated lethal dose for a person. "To scale" puts the gap the message cannot cross (the synaptic cleft, ≈ 50 nm)
beside the paper (≈ 100 µm): about two thousand times thinner. The loop closes on a poison that is not washed out:
the muscle comes back because the nerve rebuilds, growing spare endings it later prunes away.

Flow (WRITING.md, 29 Oct): one thread from the hook's poison to the takeaway's rebuilt nerve; the voice carries
the meaning ("a banknote's weight", "counted in mouse deaths", "under a hundredth", "two thousand times thinner")
and the screen carries the specifics (≈ 1 g inhaled and evenly dispersed, acetylcholine, SNAP-25, Kerner 1820,
1 unit = the mouse LD50, 20 units against ≈ 3,000 estimated, 50 nm, 100 µm paper, ≈ 3–4 months, Scott 1980 and
Carruthers 1992 on the end-card footnote). Spoken figures: a million, twenty, a hundredth, two thousand (four).
The picture is being redesigned, so each beat's shot line names only the reveal it needs.

Honesty, on screen: the section and the junction are "simplified"; the message and the cut protein are an
"illustration"; the one-gram figure is "theoretical, ideal dispersal"; the lethal dose is "estimated"
(extrapolated from animals, varies by route and source); the dose comparison is an "estimate" computed from
published estimates, carries "side effects can occur far below this", and "units differ by product" (one unit is
each product's own mouse LD50 and units are not interchangeable); the cleft width is "≈, varies by site"; the
regrowth is "mouse studies; in people, debated" and "time ×N". No face of a real person, no before/after. The film
never says who should have it, where, or from whom, and never names a product. No advice.

At most two labels on screen at once; the captions carry the words. One line per beat. `*starred*` words get a
camera landing or a sound hit. In a vo line, `{c1}` ties a sentence to `claims.json` and `{-}` marks a sentence
that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep04 --segment toscale`.

## hook {shot: the reveal on one frown crease · labels: title "The deadliest dose" · badge: model, not a photo · note: ≈ 1 g, inhaled and evenly dispersed · theoretical (JAMA 2001) · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5.5 s)
vo: Poison, in a *frown*? {-} In theory, a banknote's weight could kill a million people. {c7,c16}

## normal {shot: the drop below the crease to the muscle, and the one nerve ending on it · labels: acetylcholine · badge: simplified · picture-only 0.5 s · energy: 0.45} (5.5–16.5 s)
vo: Every frown starts at a nerve ending, letting out a chemical messenger onto the muscle below. {c1} The muscle pulls, and the skin above folds into a *crease*. {c2}

## change {shot: the reveal inside the nerve ending: the loaded message, and the cut · labels: SNAP-25 · badge: illustration · picture-only 0.6 s · energy: 0.55} (16.5–27.2 s)
vo: Botulinum toxin never touches the skin. {c4} It slips inside the nerve ending and cuts one protein the message needs, so the message waits, and never *leaves*. {c3,c14}

## why {shot: the turn to an 1820s record of sausage deaths, then back to the silenced ending · labels: Justinus Kerner · 1820 · picture-only 2.2 s · energy: 0.5} (27.2–39.3 s)
vo: Two centuries ago a German doctor, Justinus Kerner, traced a deadly paralysis to spoiled sausages, {c5} and guessed the same poison might one day become a *medicine*. {c6}

## whoa {shot: the reveal on the dose: one frown's twenty units beside the estimated lethal dose · labels: 20 units · ≈ 3,000 units, estimated (70 kg) · notes: 1 unit = the dose that kills half a group of mice · units differ by product · side effects can occur far below this · picture-only 3.1 s · energy: 0.8} (39.3–53.2 s)
vo: A dose of this medicine isn't weighed; it's counted in mouse deaths. {c15} One frown takes twenty of those, still under a hundredth of what could kill a *person*. {c8,c9}

## toscale {segment: toscale · the gauge lifts: the gap the message never crosses, beside a sheet of paper · labels: ≈ 0.05 µm · 100 µm · picture-only 0.5 s · energy: 0.4} (53.2–60.6 s)
vo: And the gap that message never crosses is about two thousand times thinner than a sheet of *paper*. {c10,c11}

## takeaway {shot: the crease returns as the ending rebuilds · labels: ≈ 3–4 months · note: mouse studies; in people, debated · picture-only 0.5 s · energy: 0.3} (60.6–68.5 s)
vo: Poison in a frown: one message silenced, and months later the nerve grows spare endings, then prunes them *away*. {c12,c13}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–74.9 s)
vo: Next: two neighbours under the same sun, one experiment. {-} Which hand *aged*? {-}
end card: "Next layer: same sun, one experiment. Which hand aged?" · "Outer Layer · No. 005" · footnote: "Alan Scott first injected it into eye muscles to treat strabismus (1980); Jean and Alastair Carruthers reported frown lines in 1992."

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches: pmc.ncbi.nlm.nih.gov does
  not resolve from this session); see `claims.json`. A person opens each link, and a board-certified
  dermatologist signs off, before posting. This is a treatment topic: sign-off is required.
- Brand: "Botox" is a brand name (onabotulinumtoxinA). The voice says "botulinum toxin", "it" and "this medicine";
  the brand appears only in the topic name and in source titles. Unit doses differ between products and are not
  interchangeable; the 20-unit figure is the labelled glabellar dose for onabotulinumtoxinA only.
- The hook's "banknote's weight": Arnon et al. 2001 estimate that one gram of crystalline type A, evenly dispersed
  and inhaled, would kill more than a million people, while noting that such dissemination would be technically
  difficult; a banknote weighs about one gram (US Currency Education Program). The voice hedges with "in theory"
  and the screen badges the route and the ideal dispersal. This is why the dose matters, not a threat scenario.
- "Counted in mouse deaths": one unit of the product is defined as the calculated median intraperitoneal lethal
  dose (LD50) in mice, so the cosmetic dose is measured on a scale of lethality. The mouse unit is assay- and
  product-specific and is not a standardised unit (up to a tenfold spread between laboratories in one
  multi-laboratory study), which is why the plate carries "units differ by product".
- "Under a hundredth": 20 units ÷ ≈ 3,000 units (estimated human LD50 for a 70 kg adult, extrapolated from
  primate data) ≈ 0.7 % (computed). By mass the gap is wider, ≈ 0.1–0.2 %, but mass and unit estimates do not
  fully agree (see `research.md`), so the voice uses the unit figure and says only "under a hundredth". The plate
  says serious effects can occur far below a lethal dose.
- "About two thousand times thinner": cleft ≈ 50 nm (StatPearls; other sources 20–60 nm) and paper ≈ 100 µm;
  100,000 ÷ 50 = 2,000 (computed).
- The takeaway's pruning: in mouse muscle, recovery runs in two phases — the sprouts carry transmission first,
  then the parent terminals take it back and the spare sprouts are eliminated (de Paiva et al. 1999). In people
  the evidence is thinner and one human study found little collateral sprouting, so the picture badges it.
- Tease and end card set with the season's chain (see `../SEASON.md`). The hook line changed in this pass, so
  `SEASON.md`'s hook column for No. 004 needs updating by the coordinator.
- Listen at T0: botulinum, Justinus Kerner, acetylcholine (on screen only), SNAP-25 (on screen only).
