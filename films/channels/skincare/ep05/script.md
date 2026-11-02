# Outer Layer No. 005: "The sunscreen experiment" (draft; dermatologist sign-off before posting)

About 70–74 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Brief: s1v2/BRIEF.md,
topic "sunscreen vs no sunscreen", told through one trial. Facts pass 2 (2 Nov, `../s1v2/FACTS-PASS-2.md`). This
episode is about sunscreen, so a board-certified dermatologist signs it off before posting (bible §8, §9).

The story: two model hands, side by side, the same to the eye. In Nambour, Queensland, in 1992, chance (a
randomised trial) decided which adults would put sunscreen on their head, neck, arms and hands every morning. The
turn: it was never sunscreen against none; the others could use it as they pleased, or not at all. After 4.5 years
(the ageing trial's whole length), silicone casts of the backs of their hands showed no detectable increase in
ageing in the daily group (relative odds of increased ageing 0.76). The wrong idea is "sun damage is the burn you
feel"; an ultraviolet camera shows damage the naked eye misses. The whoa: the same people were followed for ten
more years after the trial ended, and melanoma came out at about half in the daily group, in small numbers (HR
0.50, 95% CI 0.24–1.02, not quite significant). "To scale" puts the lab test dose of sunscreen (2 mg/cm², ≈ 20 µm,
computed) beside the paper. The closing twist: both groups missed mornings, even the daily one (by the end, 77% used it at
least 3–4 days a week, against 33% of the others); it simply had more of them, and the skin kept count.

The three ranked beats: (1) hook: one group showed no detectable ageing in 4.5 years (Hughes et al. 2013); (2) whoa:
a decade after the trial, melanoma at about half, in small numbers (Green et al. 2011); (3) closing twist: both hands
missed mornings, even the "daily" one (adherence, Hughes et al. 2013). The counter-intuitive turn: "never sunscreen against
none" (the control arm was discretionary use).

Flow (WRITING.md, 29 Oct): one thread from the hook's "Which hand aged?" to the takeaway's "So, which hand aged?",
answered by "the skin kept count". The voice carries the meaning ("four and a half years", "ten more years", "about
half", "a fifth of a paper") and the screen carries the specifics (Nambour 1992–96, 1,621 adults, SPF 15+,
relative odds 0.76 [0.59–0.98], HR 0.50 [0.24–1.02], 11 vs 22, 77% vs 33%, Hughes et al. 2013, Green et al. 2011,
2 mg/cm², 20 µm, 100 µm paper). The picture (look test 2, 2 Nov) holds three hero places: one patch of skin, half under sunscreen and half bare
(the macro; the UV switch shows what the eye misses) → the silicone cast of the skin's lines → the stained micrograph
under the ten-year tally → the macro's film beside the gauge → the hook's macro again.

Labels: at most two on screen at a time; captions carry the words. Each beat header lists the labels that stay.

Honesty, on screen: the macro and the cast are a "model, not a photo", never a before/after of a real person; the UV view is an
"illustration · not trial data"; the ageing trial is "4.5 years"; the melanoma tally is badged "small numbers · not
quite significant"; the film thickness is an "estimate" (lab test dose). The film describes the evidence and never
tells the viewer what to do or what to buy. No product or brand.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep05 --segment toscale`.

## hook {shot: the sunscreen macro, one patch of skin, left half under sunscreen, right bare, the same to the eye · labels: badge "model, not a photo" · title "The sunscreen experiment" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5.5 s)
vo: Which hand *aged*? In four and a half years, one showed no detectable ageing. {c5}

## normal {shot: a long crane along the macro's seam, dust in a light shaft; "daily" on the screened half · labels: spine "Nambour · 1992" · badge "model, not a photo" · picture-only 0.5 s · energy: 0.45} (5.5–17.5 s)
vo: They belong to two neighbours in Nambour, a Queensland town where pure chance decided who would wear sunscreen every *morning*. {c1} Head, neck, arms and hands, before the day began. {c2}

## change {shot: close on the bare half, patches of sunscreen coming and going, then the silicone cast of the skin's lines · labels: spine "ageing trial: 4.5 years" · plate "relative odds 0.76 (0.59–0.98) · Hughes et al., 2013" · picture-only 0.6 s · energy: 0.55} (17.5–29 s)
vo: It was never sunscreen against *none*: the others could use it whenever they pleased, or not at all. {c3} Researchers read the fine lines in silicone casts of hands. {c4}

## why {shot: the macro, a warm flush, then the UV switch (a cyan scan line) on "But" · labels: badge "illustration · not trial data" · spine holds · picture-only 2.2 s · energy: 0.5} (29–42 s)
vo: It's easy to think sun damage is the burn you feel. {-} But an ultraviolet camera reveals damage the naked eye misses, long before it shows on the *surface*. {c6}

## whoa {shot: the micrograph cut face of the dermis, the ten-year tally over it, 11 against 22 · labels: badge "micrograph · healthy stained skin" · spine "followed to 2006" · plate "HR 0.50 (0.24–1.02) · small numbers · not quite significant · Green et al., 2011" · picture-only 3.2 s · energy: 0.8} (42–55 s)
vo: And they were followed for ten more years. {c7} Melanoma, the most serious skin cancer, came out at about *half*, in numbers too small to be sure. {c9,c13}

## toscale {segment: toscale · the macro grazing over the screened half's satin film, the gauge beside a sheet of paper · labels: gauge "≈ 20 µm · paper 100 µm" · badge "estimate · lab test dose" · picture-only 0.5 s · energy: 0.4} (55–62 s)
vo: At a lab's test dose, that morning layer is about a fifth of a paper's *thickness*. {c10}

## takeaway {shot: back to the hook's macro (the loop), the UV switch on "skin" · labels: none beyond the badge (the adherence figures stay off screen until confirmed from the paper itself) · badge "model, not a photo" · picture-only 0.5 s · energy: 0.3} (62–68.5 s)
vo: So, which hand aged? Both groups missed mornings; one missed far fewer, and the skin kept *count*. {c12,c11}

## tease {end card held ≥ 1.6 s · signature: reed F5, C6, A5 · energy: 0.35} (68.5–74.5 s)
vo: Next: tanning beds share a list with cigarettes. Same list, same *risk*? {-}
end card: "Next layer: tanning beds and cigarettes. Same list, same risk?" · "Outer Layer · No. 006" · footnote: "Nambour Skin Cancer Prevention Trial, Queensland, 1992–96, followed to 2006"

## Notes
- Every claim was checked through search excerpts only (page fetches are blocked in this session); see
  `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before posting.
- Trial length: the ageing result covers the trial's 4.5 years (1992–96). "Ten more years" is only the melanoma
  follow-up after the trial ended; no line implies a ten-year ageing trial.
- The melanoma "about half" is the overall hazard ratio, 0.50 (95% CI 0.24–1.02, P = .051): 11 vs 22 primary
  melanomas, not quite statistically significant, hence "in numbers too small to be sure" and the badge. Invasive
  melanoma alone was 3 vs 11 (HR 0.27, 0.08–0.97). The dermatologist decides if "about half" is fair.
- "Never sunscreen against none": the control arm used sunscreen at their usual, discretionary rate, which for many
  meant rarely or never; the line says "or not at all" as a possibility, not as the group's behaviour.
- "Both missed mornings; one had more": by the trial's end, 77% of the daily group applied sunscreen at least 3–4
  days a week, against 33% of the discretionary group (Hughes 2013, via coverage). "One had more" means more mornings
  with sunscreen than the other group, not a perfect routine.
- "No detectable ageing" renders the abstract's "no detectable increase in skin aging"; it was measured on the
  backs of the hands only, in 903 adults under 55.
- "About a fifth of a paper's thickness": 2 mg/cm² at about 1 g/cm³ ≈ 20 µm (computed); 20 ÷ 100 = a fifth. The
  line says "at a lab's test dose", so it does not describe what anyone in the trial applied, or recommend an amount.
- The squamous cell result (fewer tumours during the trial, rate ratio 0.61) left the voice in this pass; it stays in
  `research.md`.
- No line tells the viewer to wear sunscreen.
- Tease and end card set with the season's chain (see `../s1v2/SEASON.md`); the tease is unchanged.
- Listen at T0: Nambour, Queensland, melanoma.
