# Skin Sense: "The fight you never saw" (draft; dermatologist sign-off before posting)

About 74 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2,
topic: how we get pimples. This is a skin condition, so a board-certified dermatologist signs off before posting.

Facts pass 2 (2 Nov, `../s1v2/FACTS-PASS-2.md`): script and facts only; the shot descriptions are short and
look-agnostic because the picture is being redesigned.

The three "I didn't know that" beats, ranked:
1. **Hook.** The fight under a new spot began under skin that looked clear: in one photo study more than one new
   inflamed spot in four rose from clear-looking skin (Do et al. 2008), and biopsies of clear skin already show immune
   cells ringing the follicle, macrophages at red-spot levels (Jeremy et al. 2003).
2. **Whoa.** The white cells that flood the follicle, until its wall can give way, come from a supply the marrow
   renews daily: roughly 5–10 × 10¹⁰ neutrophils a day, several for every person on Earth (Summers et al. 2010;
   Dancey et al. 1976; UN WPP 2024). Pus is those cells, fallen.
3. **Closing twist.** The germ the spot is fought against is the most abundant bacterium in healthy, oily skin
   (Rozas et al. 2021) and, in lab and mouse work, its propionic acid makes skin cells build barrier lipids
   (Almoughrabie et al. 2023).

The counter-intuitive turn (why): a spot looks like an infection, a germ that doesn't belong. But the bacterium is
the most common one in clear, oily skin, skin with acne carries no more of it (Platsidaki & Dessinioti 2018), and
the spot is largely the body's own answer (Huang et al. 2024; debated, badged so).

Numbers the voice says: "one in four" (28%), "several for every person on Earth" (≈ 5–10 × 10¹⁰ a day ÷ 8.2 billion),
"ten in a row … this paper's thickness" (≈ 8 µm × 10 = 80 µm < 100 µm). Every exact figure is on screen.

Labels: at most two on screen at once (listed per beat as `labels:`); captions carry the words. Honesty: the cheek
and follicle are "model, not a photo"; the bacterium's role is "debated"; the rupture and the barrier finding carry
their study type. No weeks are given for how long a spot takes (no reliable source; research.md). No advice, no
brands: the film describes what happens in the skin, not what the viewer should do.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep01 --segment toscale`.

## hook {shot: frame 0, the payoff: a cheek with one red spot, the skin around it clear · labels: title "The fight you never saw" · model, not a photo · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5.5 s)
vo: Is this spot *new*? Its fight began under skin that looked perfectly clear. {c1}

## normal {shot: the same patch, photo by photo, back in time; the spot gone from the earlier photos · labels: spine "28% of new red spots · one study, Do et al. 2008" · picture-only 0.5 s · energy: 0.45} (5.5–15.5 s)
vo: Follow faces photo by photo, and more than one new red spot in four rises from skin that looked *clear*. {c2} So what was happening underneath? {-}

## change {shot: the reveal beneath the clear patch: one follicle, immune cells already ringing it · labels: biopsy study, Jeremy et al. 2003 · model, not a photo · picture-only 0.6 s · energy: 0.55} (15.5–24.5 s)
vo: Beneath that clear skin, the defence has already gathered, immune cells crowding the follicle, some as thickly as in a red *spot*. {c3}

## why {shot: two follicles, one calm, one ringed, the same bacterium in both; only the ringed one answers · labels: C. acnes · debated · picture-only 2 s · energy: 0.5} (24.5–38 s)
vo: It's easy to picture an infection. {-} But it's the most common bacterium in clear, oily skin, and skin with acne carries no more. {c4,c5} What makes the spot is largely your body's *answer*. {c6}

## whoa {shot: the reveal inside the ringed follicle: white cells pour in, the wall gives way, the fight spills deeper · labels: model, not a photo · "≈ 5–10 × 10¹⁰ a day ≈ 6–12 per person on Earth" · picture-only 3 s · energy: 0.8} (38–51 s)
vo: White cells flood in until the follicle's wall can give way, spilling the fight *deeper*. {c7,c8} Each day, your marrow makes several for every person on *Earth*. {c9}

## toscale {segment: toscale · the gauge: one white cell (≈ 8 µm), ten in a row (≈ 80 µm), the paper (≈ 100 µm) · labels: "1 white cell ≈ 8 µm" · "paper ≈ 100 µm" · picture-only 0.5 s · energy: 0.4} (51–60 s)
vo: And pus is the fight's fallen: white cells so small that ten in a row still wouldn't span this paper's *thickness*. {c10,c11}

## takeaway {shot: back to frame 0's cheek, the clear skin around the spot now known to hold its own quiet fights · labels: lab and mouse study, Almoughrabie et al. 2023 · picture-only 0.5 s · energy: 0.3} (60–68 s)
vo: Is it new? {-} No: a fight begun out of sight, against a germ that even helps build your skin's *barrier*. {c12,c13}

## tease {end card held ≥ 1.6 s · energy: 0.35} (68–74 s)
vo: Next: the light on your face, and where it really *goes*. {-}
end card: "Next: where the light on your face goes" · "Skin Sense · No. 001" · footnote: "In one study, 28% of new inflamed spots rose from skin that looked clear (Do et al., 2008)."

## Notes
- Every claim was checked through search excerpts only (page fetches are blocked from this session); see
  `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before posting.
- "More than one in four": Do et al. 2008 tracked 25 people with untreated facial acne, photographed every 2 weeks
  for 12 weeks; 28% of inflammatory lesions were preceded by normal-appearing skin (54% by comedones). "Looked
  clear" is literal: clear in the photo. Screen: "28% · one study".
- "As thickly as in a red spot": Jeremy et al. 2003 found macrophage numbers in uninvolved skin "similar to those in
  papules"; T cells were raised but lower than in papules. Hence "some".
- "Skin with acne carries no more": reviews report no quantitative difference in C. acnes between acne and
  healthy skin (Platsidaki & Dessinioti 2018; Rozas et al. 2021). Strain and biofilm differences exist; the line
  speaks only of amount.
- "Several for every person on Earth": Summers et al. 2010 give basal neutrophil output of 5–10 × 10¹⁰ a day
  (Dancey et al. 1976 measured ≈ 0.85–0.87 × 10⁹ /kg/day, ≈ 6 × 10¹⁰ for 70 kg). ÷ 8.2 billion people (UN WPP 2024)
  ≈ 6–12 each. The kinetics are old data under review (Trends Immunol 2022), hence "several", not a number.
- "Ten in a row still wouldn't span": resting neutrophil ≈ 8 µm (Ting-Beall et al. 1993); ten ≈ 80 µm against
  paper ≈ 100 µm.
- "Even helps build your skin's barrier": Almoughrabie et al. 2023 (Sci Adv): of common skin bacteria tested, only
  C. acnes raised keratinocyte lipid output (≈ threefold), driven by its propionic acid; seen in cultured cells and
  mouse skin, with a matching signal in human acne skin. Screen badge: "lab and mouse study".
- Cut in this pass: the squeeze line (AAD) and the on-screen UV glow note; neither was a step toward the new whoa
  or twist. They stay in research.md.
- No number of weeks is spoken or shown for how long a spot takes to form (research.md).
- Tease and end card unchanged, set with the season's chain (see `../s1v2/SEASON.md`).
- Listen at T0: follicle, bacterium, pus.
