# Outer Layer No. 006: "Same list as cigarettes" (draft; dermatologist sign-off before posting)

About 73 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, tanning beds.
**Tanning episode: a board-certified dermatologist signs off on every line before posting (bible §8, §9).**
Facts pass 2 (2 Nov): three ranked "I didn't know that" beats, one counter-intuitive turn, fewer labels.

The story: tanning beds sit on the same cancer list as tobacco smoke (IARC Group 1, 2009), and so does processed
meat (2015). Nobody thinks a sausage is a cigarette, and the list's keepers say so: the top group ranks how sure the
evidence is, not how big the harm (the counter-intuitive turn, which the hook sets up and the takeaway lands). The
film then follows that evidence: the light the beds give off (mostly UVA; in large, powerful units it "may be 10 to
15 times" the midday sun's intensity), the people the experts saw it in most clearly (first use before 35: melanoma
risk RR 1.59 and 1.75 in two meta-analyses), then whole countries acting on it within months (Brazil 2009,
Australia 2015). "To scale" puts the top layer of skin (≈ 100 µm on most skin) beside the paper, with the long
rays passing it. The closing twist: the sun itself made the list in 1992, seventeen years before the beds did,
because the list follows the evidence, and the evidence on the beds took longer to become sure.

The three beats, ranked: (1) processed meat shares the list, so the list can't be ranking harm (hook, and the
turn in normal); (2) whole countries switched commercial beds off within months (whoa); (3) the sun was on the list
years before the beds (the takeaway's reframe, calling back "Same list as cigarettes").

Flow (WRITING.md, 29 Oct): one thread from the hook's "Same list as cigarettes?" through "all three" and "how
sure" to the takeaway's "the same certainty"; the sun of the change ("the midday sun") comes back in the takeaway.
The voice carries the meaning and about three numbers ("ten to fifteen times", "thirty-five", "more than half");
the screen carries the specifics (IARC, Group 1, 2009, 2015, 1992, UVA, 10–15×, RR 1.59 / 1.75, Brazil 2009,
Australia 2015, ≈ 100 µm, 100 µm paper). Every number has a human-scale meaning in the voice: the midday sun,
an age, "more than half", paper, "years before". The picture changes scale with the ideas: the list, three lines
lit → the open bed → a section of skin under the light → a crowd of first sessions, sorted by age → a map, two
countries going dark → the section's top layer beside the paper → the list again. Cuts are scale jumps only.

Labels: at most two on screen at a time; the captions carry the words. Each beat header names the labels that stay.

Honesty, on screen: the list carries "strength of evidence, not size of risk" through the hook's turn and the
takeaway; the intensity figure is badged "large, powerful units · may be"; the risk figures are "pooled studies ·
relative risk" with both reviews and their ages; the section is "simplified"; the skin is a "model, not a photo".
No advice: the film never tells the viewer to use or avoid anything (or what to eat); it reports a classification,
measurements and what two governments did.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep06 --segment toscale`.

## hook {shot: frame 0, the reveal on the list: an IARC Group 1 excerpt over skin under a bed's light ("model, not a photo"); on "cigarettes" two lines light, on "meat" a third · labels that stay: "IARC Group 1" + "model, not a photo" · title: "Same list as cigarettes" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–4.3 s)
vo: Same list as cigarettes? Processed *meat* is on it too. {c1}

## normal {shot: no cut: the list holds, three lines lit; on "sure" one line lands under them · labels that stay: "IARC Group 1" + "strength of evidence, not size of risk" · picture-only 0.5 s · energy: 0.45} (4.3–15.7 s)
vo: All three share the top group of the World Health Organization's cancer agency, which says that doesn't make them equally dangerous: it ranks how *sure* the evidence is. {c2,c3}

## change {shot: a scale jump into the bed, its tubes lighting; on "ten to fifteen" they flare · labels that stay: "UVA · ×10–15 midday sun" + "large, powerful units · may be" · picture-only 0.6 s · energy: 0.55} (15.7–27.2 s)
vo: Into the bed, then: its light is mostly UVA, the long rays. {c4} In large, powerful units, it may be ten to fifteen times as intense as the midday *sun*. {c5}

## why {shot: no cut; the reveal on the first sessions, sorted by age · labels that stay: "first use before 35 · RR 1.59 (2012, corrected) · 1.75 (2007)" + "pooled studies · relative risk" · picture-only 2.0 s · energy: 0.5} (27.2–41.6 s)
vo: When the beds joined that group, the sharpest signal came from people who started young. {c6} In pooled studies, first use before thirty-five went with melanoma risk raised by more than *half*. {c7}

## whoa {shot: the reveal on the map: on "Brazil" one country goes dark, on "off" a second · labels that stay: "commercial beds banned: Brazil 2009 · Australia 2015" + "model, not a photo" · picture-only 3.0 s · energy: 0.8} (41.6–51.3 s)
vo: Whole countries acted: Australia switched off every commercial bed in the land, and Brazil banned them *too*. {c8,c9}

## toscale {segment: toscale · the reveal on the skin's section: long rays pass the top layer; the gauge sets it beside the paper · labels that stay: "≈ 100 µm · paper 100 µm" + "simplified" · picture-only 0.5 s · energy: 0.4} (51.3–58.9 s)
vo: And those long rays reach right through the top layer, on most skin about as thin as *paper*. {c10,c11}

## takeaway {shot: back to the hook's list; on "sun" a fourth line lights above the others, dated first · labels that stay: "solar radiation · Group 1 since 1992 · beds 2009" + "strength of evidence, not size of risk" · picture-only 0.5 s · energy: 0.3} (58.9–67.3 s)
vo: The sun made that list years before the beds. {c12} Same list as cigarettes: not the same harm, the same *certainty*. {c13}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (67.3–73.3 s)
vo: Next season: why do bath fingers wrinkle, but never your *arm*? {-}
end card: "Next season: why do bath fingers wrinkle?" · "Outer Layer · season 2" · footnote: "IARC classified UV-emitting tanning devices as carcinogenic to humans (Group 1) in 2009."

## Notes
- Every claim was checked through search excerpts only: the proxy blocks page fetches (www.iarc.who.int does not
  resolve in this session); see `claims.json`. A person opens each link, and a board-certified dermatologist signs
  off, before posting.
- Processed meat (new, c1–c3): IARC classified processed meat consumption as Group 1 in October 2015 (Monographs
  Vol. 114); WHO's Q&A says it is "in the same category as causes of cancer such as tobacco smoking and asbestos
  (IARC Group 1) … but this does NOT mean that they are all equally dangerous". The film names it only as a member
  of the list, never as a diet point.
- "More than half": the corrected Boniol et al. 2012 BMJ estimate for first use before 35 is RR 1.59 (1.36–1.85);
  the original 1.87 was withdrawn (correction, BMJ 2012;345:e8503). The IARC 2007 meta-analysis gave 1.75
  (1.35–2.26) for first use before 35. IARC's 2009 summary describes the same result as a 75% increase "before age
  30"; the film doesn't use that pairing. "More than half" is true of both; the screen shows both, with their ages.
- "Ten to fifteen times": AAP technical report (Balk, Pediatrics 2011), "may be 10 to 15 times higher than that of
  the midday sun", for UVA from large, powerful units; the figure is old and not universal (measured devices range
  from about 2 to 26 times solar UVA). Fallback, if the dermatologist prefers it: WHO's "at least as intense as
  midday tropical sunlight".
- "Within months": IARC's decision was published in late July 2009; ANVISA's RDC 56 is dated 9 November 2009.
  The ban has been challenged in Brazilian courts (sources conflict on its current reach); the film reports only
  that Brazil banned them.
- "The sun made that list years before the beds" (new, c12): IARC Vol. 55 (1992) put solar radiation in Group 1
  and sunlamp/sunbed use in Group 2A; the beds moved to Group 1 in 2009. On screen: 1992 and 2009.
- "About as thin as paper": epidermis usually ≈ 0.1 mm (0.07–0.12 mm), thicker on palms and soles.
- Tease and end card unchanged, word for word (season chain, `../s1v2/SEASON.md`).
- Listen at T0: UVA, melanoma.
