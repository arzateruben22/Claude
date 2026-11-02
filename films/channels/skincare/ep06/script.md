# Outer Layer No. 006: "Same list as cigarettes" (draft; dermatologist sign-off before posting)

About 74 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, tanning beds.
**Tanning episode: a board-certified dermatologist signs off on every line before posting (bible §8, §9).**

The story: tanning beds sit on the same cancer list as tobacco smoke (IARC Group 1, 2009), and most people hear
"just as deadly". The wrong idea is that the list ranks harm; it ranks how sure the evidence is. The film follows
the evidence instead: the light the beds give off (mostly UVA, in large, powerful units "may be 10 to 15 times"
the midday sun's intensity), the people the agency's experts saw it in most clearly (those who started young:
first use before 35, melanoma risk ≈ +59% to +75% across two meta-analyses), then whole countries acting on it
(Brazil 2009, Australia 2015). "To scale" puts the whole top layer of skin (≈ 100 µm on most skin) beside the
paper, with the long rays passing it. The takeaway answers the hook: same list, not the same size of harm, the
same certainty.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Same list as cigarettes?" (and the guess, "just as
deadly") to the takeaway's "that sure"; the voice carries the meaning and the screen the specifics (IARC, Group 1,
2009, UVA, 10–15×, before 35, RR 1.59 / 1.75, Brazil 2009, Australia 2015, ≈ 100 µm, 100 µm paper). The picture
changes scale with the ideas: a list of agents, two lines lit → the open bed, its tubes glowing → a section of skin
under the light → a crowd of first sessions, sorted by age → a map, two countries going dark → the section's top
layer beside the paper → the list again. Cuts are scale jumps only.

Honesty, on screen: the list is "IARC Group 1: strength of evidence, not size of risk" for the whole hook and
takeaway; the intensity figure is badged "large, powerful units · may be" and "UVA"; the risk figures are
"pooled studies · relative risk" with both reviews shown; the section is "simplified"; the map is "commercial
beds". No advice: the film never tells the viewer to use or avoid anything; it reports what was measured and what
two governments did.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep06 --segment toscale`.

## hook {shot: frame 0, the payoff: a typeset plate, IARC Group 1 (an excerpt), over a dim macro flight across skin at golden hour (deep tone); on "cigarettes" two lines light, "UV-emitting tanning devices", then "Tobacco smoking" · badge: IARC Monographs, Group 1 · title: "Same list as cigarettes" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Same list as *cigarettes*? Most people hear: just as deadly. {-}

## normal {shot: no cut: the plate holds; on "sure" a line lands under it: ranks how sure the evidence is, not how big the harm · picture-only 0.5 s · energy: 0.45} (5–17 s)
vo: It's the World Health Organization's cancer agency: tanning beds sit in its top group, beside tobacco smoke. {c1} That group ranks how *sure* the evidence is, not how big the harm. {c2}

## change {shot: a scale jump into the bed: the flight runs low under a canopy of tubes that light violet; the skin takes the light; on "ten to fifteen" the tubes flare · spine: UVA vs midday sun ×10–15 (may be) · badge: model · large, powerful units · picture-only 0.6 s · energy: 0.55} (17–28.5 s)
vo: Follow the evidence into the bed: its light is mostly UVA, the long rays. {c3} In large, powerful units, it may be ten to fifteen times as intense as the midday *sun*. {c4}

## why {shot: no cut, under the tubes; the plate: first use before 35, melanoma risk ×1.75 (pooled, 2007) and ×1.59 (pooled, 2012, corrected) · spine: ×1.6–1.75 · badge: pooled studies (meta-analyses) · picture-only 2.2 s · energy: 0.5} (28.5–42 s)
vo: Weighing the studies, the agency's experts found the sharpest signal in people who started young. {c5} In pooled studies, starting before thirty-five went with a melanoma risk raised by more than *half*. {c6}

## whoa {shot: the UV reveal (shutter): the skin through the 365 nm viewfinder, glowing under the bed's light; on "Brazil" it dims, on "switched its own off" it goes nearly dark · plate: commercial tanning beds banned, Brazil 2009, Australia 2015 · daylight strip first · badge: model, not a photo · picture-only 3.2 s · energy: 0.8} (42–53.5 s)
vo: Then whole countries acted: Brazil banned commercial tanning beds that same year; later, Australia switched its own *off*. {c7,c8}

## toscale {segment: toscale · a scale jump into a cut-face section (deep tone): violet dashes of UVA fall through the top layer into the dermis; the gauge lifts: the top layer (≈ 100 µm) beside the paper's 100 µm · badge: simplified · picture-only 0.5 s · energy: 0.4} (53.5–61.5 s)
vo: And the long rays reach right through the top layer, on most skin about as thin as *paper*. {c9,c10}

## takeaway {shot: back to the hook's plate over the flight, both lines lit and the ranking line under them · spine: Group 1 ranks certainty · picture-only 0.5 s · energy: 0.3} (61.5–68 s)
vo: Same list as cigarettes, then: not the same size of harm, but the same *certainty*. {c11}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68–74 s)
vo: Next season: why do bath fingers wrinkle, but never your *arm*? {-}
end card: "Next season: why do bath fingers wrinkle?" · "Outer Layer · No. 006" · footnote: "IARC classified UV-emitting tanning devices as carcinogenic to humans (Group 1) in 2009."

## Notes
- Every claim was checked through search excerpts only: the proxy blocks page fetches (www.iarc.who.int does not
  resolve in this session); see `claims.json`. A person opens each link, and a board-certified dermatologist signs
  off, before posting.
- "More than half": the corrected Boniol et al. 2012 BMJ estimate for first use before 35 is RR 1.59 (1.36–1.85);
  the original 1.87 was withdrawn (correction, BMJ 2012;345:e8503). The IARC 2007 meta-analysis gave 1.75
  (1.35–2.26) for first use before 35. IARC's 2009 summary describes the same result as a 75% increase "before age
  30". "More than half" is true of both estimates; the screen shows both, with their ages.
- "Ten to fifteen times": AAP technical report (Balk, Pediatrics 2011), "may be 10 to 15 times higher than that of
  the midday sun", for UVA from large, powerful units; the figure is old and not universal (measured devices
  range from about 2 to 26 times solar UVA). Dermatologist to confirm it stays.
- "About as thin as paper": epidermis usually ≈ 0.1 mm (0.07–0.12 mm), thicker on palms and soles.
- Tease and end card set with the season's chain (see `../SEASON.md`).
- Listen at T0: UVA, melanoma.
