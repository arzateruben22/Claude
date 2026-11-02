# Outer Layer No. 004: "The deadliest dose" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, topic
"What Botox does" (mechanism only; the voice says "botulinum toxin", never the brand).

The story: a frown is not the skin doing something; it is a nerve ending telling a muscle to pull. Botulinum toxin
type A cuts one protein inside that nerve ending (SNAP-25), so the "contract" message (acetylcholine) is made but
never sent. The wrong idea is that it works on the skin, filling or freezing it; the skin is never the target. The
person is Justinus Kerner, who in the 1820s traced a deadly paralysis to spoiled sausages and guessed the same
poison might one day be a medicine. The stakes: it is among the most potent toxins known, and a frown-line dose is
well under a hundredth of the estimated lethal amount. "To scale" puts the gap the message cannot cross (the
synaptic cleft, ≈ 50 nm) beside the paper (≈ 100 µm): about two thousand times thinner. The loop closes on the
hook's "switch off": not the skin, one message, for a few months, until the nerve grows new endings.

Flow (WRITING.md, 29 Oct): one thread from the hook's "What does it switch off?" to the takeaway's answer, "Not the
skin: one message"; the voice carries the meaning and the screen the specifics (acetylcholine, SNAP-25, Kerner
1820 and 1822, ≈ 1–2 ng/kg estimated, 20 units against ≈ 3,000 estimated, 50 nm, 100 µm paper, ≈ 3–4 months,
Scott 1980 and the Carruthers 1992 on the end-card footnote). The picture changes scale with the ideas: a
frown's crease → the muscle under it and the nerve ending on it → one vesicle at the membrane, the protein cut →
an 1820s ledger of sausage cases → the dose against the estimate → the gap beside the paper → the crease again,
smooth, then a new sprout reaching out. Three cuts, all scale jumps (irises).

Honesty, on screen: the section and the junction are "simplified"; the vesicle and the protein are an
"illustration"; the lethal dose is "estimated" (extrapolated, varies by route and source); the dose comparison is
"estimate" (computed from published estimates); the cleft width is "≈, varies by site"; the regrowth is
"time ×N". No face of a real person, no before/after. The film never says who should have it, where, or from
whom, and never names a product. No advice.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep04 --segment toscale`.

## hook {shot: frame 0, the payoff: a section through a brow, the crease above, the muscle below, one nerve ending on the muscle lit, a single message frozen halfway · badge: simplified · title: "The deadliest dose" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Poison, in a *frown*? {-} Among the most poisonous substances known, by the nanogram. {c7}

## normal {shot: no cut: the camera pushes down through the crease to the muscle; on "messenger" the nerve ending releases a puff of acetylcholine and the fibres pull, folding the skin above · spine: message ✓ · badge: simplified · picture-only 0.5 s · energy: 0.45} (5–17 s)
vo: Every frown starts at a nerve ending, which lets out a chemical messenger onto the muscle below. {c1} The muscle pulls, and the skin above it folds into a *crease*. {c2}

## change {shot: an iris into the nerve ending: one vesicle waiting at the membrane; a toxin fragment slips in and snips one protein (SNAP-25 labelled); the vesicle stays put · spine: message ✗ · badge: illustration · picture-only 0.6 s · energy: 0.55} (17–28 s)
vo: Botulinum toxin never touches the skin. {c4} It slips inside the nerve ending and cuts one small protein the message needs, so the message is ready, and never *leaves*. {c3,c14}

## why {shot: an iris out to a candlelit 1820s ledger of sausage-poisoning cases, Kerner's name and dates on a label; the ink of one entry becomes the same molecule · badges: Justinus Kerner, 1820 & 1822 · picture-only 2.2 s · energy: 0.5} (28–41 s)
vo: Two centuries ago, a German doctor named Justinus Kerner traced a deadly paralysis to spoiled sausages. {c5} And he guessed that the same poison might one day become a *medicine*. {c6}

## whoa {shot: an iris from the ledger to a balance: on one side the estimated lethal amount, on the other a frown-line dose, a sliver; readouts ≈ 1–2 ng/kg (estimated) and 20 units vs ≈ 3,000 · badges: estimated · estimate · picture-only 3.2 s · energy: 0.8} (41–53 s)
vo: So how much goes in? {-} The whole frown takes well under a hundredth of the amount estimated to kill a *person*. {c8,c9}

## toscale {segment: toscale · the gauge lifts to centre beside the junction: the gap between nerve and muscle fills in, a hairline, then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (53–61 s)
vo: And the gap that message never crosses is about two thousand times thinner than a sheet of *paper*. {c10,c11}

## takeaway {shot: back to the hook's brow, the crease smooth; the nerve ending puts out a new sprout toward the muscle, then the original ending lights again · spine: message ✓ · badges: time ×N · ≈ 3–4 months · picture-only 0.5 s · energy: 0.3} (61–68 s)
vo: Poison in a frown: just enough to silence one message, until the nerve grows new *endings*. {c12,c13}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68–74.5 s)
vo: Next: two neighbours under the same sun, one experiment. {-} Which hand *aged*? {-}
end card: "Next layer: same sun, one experiment. Which hand aged?" · "Outer Layer · No. 004" · footnote: "Alan Scott first injected it into eye muscles to treat strabismus (1980); Jean and Alastair Carruthers reported frown lines in 1992."

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches: pmc.ncbi.nlm.nih.gov does
  not resolve from this session); see `claims.json`. A person opens each link, and a board-certified
  dermatologist signs off, before posting. This is a treatment topic: sign-off is required.
- Brand: "Botox" is a brand name (onabotulinumtoxinA). The voice says "botulinum toxin" and "it"; the brand
  appears only in the topic name and in source titles. Unit doses differ between products and are not
  interchangeable; the 20-unit figure is the labelled glabellar dose for onabotulinumtoxinA only.
- "Well under a hundredth": 20 units ÷ ≈ 3,000 units (LD50 for a 70 kg adult, extrapolated from monkey data)
  ≈ 0.7 % (computed). By mass the gap is wider: 20 units ≈ 0.15 ng (at ≈ 0.73 ng per 100 units, a secondary
  source) against ≈ 90–150 ng injected (Arnon 2001), ≈ 0.1–0.2 %. Both under 1 %; the voice uses the
  conservative one.
- "About two thousand times thinner": cleft ≈ 50 nm (StatPearls; other sources 20–60 nm) and paper ≈ 100 µm;
  100,000 ÷ 50 = 2,000 (computed).
- Tease and end card set with the season's chain (see `../SEASON.md`).
- Listen at T0: botulinum, Justinus Kerner, acetylcholine (on screen only), SNAP-25 (on screen only).
