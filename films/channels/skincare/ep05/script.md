# Outer Layer No. 005: "The sunscreen experiment" (draft; dermatologist sign-off before posting)

About 70–74 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Brief: s1v2/BRIEF.md,
topic "sunscreen vs no sunscreen, after about ten years". This episode is about sunscreen, so a board-certified
dermatologist signs it off before posting (bible §8, §9).

The story: two model hands, side by side, the same to the eye. In Nambour, Queensland, in 1992, chance (a
randomised trial) decided which adults would put sunscreen on their head, neck, arms and hands every morning; their
neighbours used it as they pleased. After 4.5 years, silicone casts of the backs of their hands showed the daily
group about a quarter less likely to show increased skin ageing (relative odds 0.76). The wrong idea is "sun
damage is the burn you feel"; an ultraviolet camera shows damage the naked eye misses. The whoa: the town was
followed for ten more years, and melanoma came out at about half in the daily group, in small numbers (HR 0.50,
95% CI 0.24–1.02, not quite significant), after squamous cell cancers had already come out lower. "To scale" puts
the lab test dose of sunscreen (2 mg/cm², ≈ 20 µm, computed) beside the paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Which hand aged?" to the takeaway's "So, which hand aged?",
answered by "the skin was keeping its own record". The voice carries the meaning ("about a quarter", "ten more
years", "about half", "a fifth of a paper") and the screen carries the specifics (Nambour 1992–96, 1,621 adults,
SPF 15+, relative odds 0.76 [0.59–0.98], HR 0.50 [0.24–1.02], invasive HR 0.27 [0.08–0.97], SCC tumour rate ratio
0.61 [0.46–0.81], Hughes et al. 2013, Green et al. 1999 and 2011, 2 mg/cm², 20 µm, 100 µm paper). The picture
changes scale with the ideas: two hands → a town map that splits by chance → a silicone cast's fine lines → the
same skin under an ultraviolet camera → a ten-year tally → the gauge → the two hands again.

Honesty, on screen: the hands are a "model", never a photo or a before/after of a real person; the casts are an
"illustration"; the UV view is a "model" of what such cameras show; the trial is "one trial, 1992–96"; the
melanoma tally is badged "small numbers · not quite significant (95% CI 0.24–1.02)"; the squamous cell result is
"counted by tumours"; the film thickness is an "estimate" (computed at a density of about 1 g/cm³, lab test dose).
The film describes the evidence and never tells the viewer what to do or what to buy. No product or brand.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep05 --segment toscale`.

## hook {shot: frame 0, the payoff: a macro flight low over the back of a hand at golden hour (medium tone), a thin cyan seam down the middle: two neighbours' skin as two halves of one model, the same to the eye · badge: model, not a photo · title: "The sunscreen experiment" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Which hand *aged*? Both belong to neighbours, under the same fierce sun. {-}

## normal {shot: a scale jump up and out: a drone over a model town at golden hour; on "chance" a marker rises over every house, cyan or lilac at random; on "morning" the cyan (daily) group lights · spine: Nambour trial begins 1992 · badge: model, not a map · picture-only 0.5 s · energy: 0.45} (5–17.5 s)
vo: In the early nineties, in a Queensland town called Nambour, chance decided who would wear sunscreen every *morning*. {c1} They put it on head, neck, arms and hands; neighbours used it as they pleased. {c2}

## change {shot: a scale jump down to the hand as its grey silicone cast, the seam vertical; on "four and a half years" the lines on the "as they pleased" half deepen, the daily half stays · spine: ageing measured after 4.5 years · plate: about a quarter less likely (relative odds 0.76, 0.59–0.98) · badge: model · Hughes et al., 2013 · picture-only 0.6 s · energy: 0.55} (17.5–29 s)
vo: Then researchers read the fine lines in silicone *casts* of hands. {c3} After four and a half years, the daily group showed no detectable increase in ageing. {c5}

## why {shot: the UV reveal (shutter): the same hand through the 365 nm viewfinder, split, daily | as they pleased; a faint difference from the start, blooming on "ultraviolet camera" (more damage, more sun) · badge: illustration · not trial data (the trial graded casts, not UV photos) · picture-only 2.2 s · energy: 0.5} (29–42 s)
vo: It's easy to think of sun damage as the burn you feel. {-} But an ultraviolet camera picks up damage the naked eye misses, building long before anything shows on the *surface*. {c6}

## whoa {shot: a scale jump back up over the town, higher; the plate: squamous cell cancers lower during the trial, then melanomas ten years on as dots, 11 cyan against 22 lilac · spine: melanoma followed to 2006 · plate footnote: hazard ratio 0.50 (0.24–1.02), not quite significant · badge: Green et al., 1999 · 2011 · picture-only 3.2 s · energy: 0.8} (42–55 s)
vo: Then the town was watched for ten more years. {c7} Squamous cell cancers had already come out lower, and melanoma came out at about *half*, in small numbers. {c8,c9}

## toscale {segment: toscale · a scale jump down to the hand: a satin film settles on the daily half; the gauge lifts: the test dose's film (≈ 20 µm) beside the paper's 100 µm · badge: estimate · picture-only 0.5 s · energy: 0.4} (55–62 s)
vo: At a lab's test dose, that morning layer is about a fifth of a paper's *thickness*. {c10}

## takeaway {shot: back to the hook's hand (the loop) for "which hand aged?"; on "but" the UV split (shutter): the record the eye can't see, badged illustration · not trial data · no daylight strip · spine holds: the ageing trial, 4.5 years · badge: model, not a photo · picture-only 0.5 s · energy: 0.3} (62–68.5 s)
vo: So, which hand aged? The eye can't say, but the skin was keeping its own *record*. {c11}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–74.5 s)
vo: Next: tanning beds share a list with cigarettes. Same list, same *risk*? {-}
end card: "Next layer: tanning beds and cigarettes. Same list, same risk?" · "Outer Layer · No. 006" · footnote: "Nambour Skin Cancer Prevention Trial, Queensland, 1992–96, followed to 2006"

## Notes
- Every claim was checked through search excerpts only: the proxy blocks page fetches (pubmed.ncbi.nlm.nih.gov
  does not resolve in this session); see `claims.json`. A person opens each link, and a board-certified
  dermatologist signs off, before posting.
- The melanoma "about half" is the overall hazard ratio, 0.50 (95% CI 0.24–1.02, P = .051): 11 vs 22 primary
  melanomas, so it is not quite statistically significant; invasive melanoma alone was 3 vs 11 (HR 0.27,
  0.08–0.97). The badge must say "small numbers · not quite significant"; the dermatologist decides if "about half"
  is fair.
- The squamous cell result is by tumour count (rate ratio 0.61, 0.46–0.81); by person, first new SCC, it was 0.88
  (0.50–1.56), not significant. "Come out lower" is said without a figure for that reason.
- "About a fifth of a paper's thickness": the SPF test dose is 2 mg/cm²; at a density of about 1 g/cm³ that is a
  film about 20 µm thick (computed); 20 ÷ 100 = a fifth. Real-world application is often thinner; the line says
  "at a lab's test dose" so it does not describe what anyone in the trial applied.
- The daily group's skin ageing was measured on the backs of the hands only, in 903 adults under 55 (Hughes 2013).
- Tease and end card set with the season's chain (see `../SEASON.md`).
- Listen at T0: Nambour, Queensland, squamous, melanoma.
