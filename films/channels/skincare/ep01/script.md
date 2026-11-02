# Outer Layer: "The fight you never saw" (draft; dermatologist sign-off before posting)

About 77 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2,
topic: how we get pimples. This is a skin condition, so a board-certified dermatologist signs off before posting.

The story: a red spot looks as if it arrived overnight, but it is the last visible scene of an immune fight that
began under skin that looked clear. The wrong idea is "a spot is an infection, a germ that doesn't belong"; the
bacterium (Cutibacterium acnes) lives in follicles of skin with and without acne, and the spot comes largely from the
body's answer to it (debated, badged so). The stakes: white cells flood the follicle, its wall can give way, and a
squeeze often pushes the contents deeper, where a mark is more likely. "To scale" puts one white cell (a neutrophil,
≈ 8 µm round, 12–15 µm spread) beside the paper's 100 µm. This film does not retell how a pore clogs (Skin School
covers that); the plug is seen, never explained.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Is this spot new?" to the takeaway's "No… a fight that began
out of sight"; the voice carries the meaning and the screen the specifics (28% · 25 people, 12 weeks · Do et al.
2008; "macrophages ≈ papule levels" · Jeremy et al. 2003; C. acnes; neutrophil; 8–15 µm; 100 µm paper). The picture
changes scale with the ideas: a cheek with one red spot → a stack of time-lapse photos of the same patch → a push
under clear skin to one follicle ringed by immune cells → the bacterium, at rest, in two follicles side by side →
white cells pouring in, the wall thinning and opening into the dermis → a thumb's pressure from above, the spill
driven deeper → the gauge with one white cell and the paper → back to the cheek. Cuts are scale jumps only.

Honesty, on screen: the cheek and the follicle are "simplified" (no real person's face, no before/after); the photo
stack is "illustration" of a study's method; the cell crowding is "biopsy study, acne patients' back skin"; the
bacterium's role is "debated"; the rupture is "model"; the timeline is never given in weeks (no reliable source;
see research.md). No advice: the film describes what pressure does in the skin, not what the viewer should do.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/s1v2/pimples --segment toscale`.

## hook {shot: frame 0, the payoff, the UV camera: a cheek (light tone) in the viewfinder, one spot ringed in cyan; across the clear skin around it, follicles glow orange-red (the bacterium, under UV) · badge: model, not a photo · title: "The fight you never saw" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Is this spot *new*? Its fight began under skin that looked perfectly clear. {c1}

## normal {shot: no cut: the viewfinder becomes a stack of photos of the same patch, flipping back to earlier photos ("earlier photo n / 6", no interval implied); on "clear" the spot is gone from the earlier frames · spine: 28% of new red spots · badge: one study · Do et al., 2008 · picture-only 0.5 s · energy: 0.45} (5–15.5 s)
vo: Follow faces photo by photo, and more than a quarter of new red spots rise from skin that looked perfectly *clear*. {c2} So what was happening underneath? {-}

## change {shot: the macro flight: the UV view gives way to daylight terrain, a low glide over the clear patch to one pore, then a cut below the surface to one follicle in section: no spot, but immune cells already ringing it, lit one by one · badge: biopsy study · Jeremy et al., 2003 · picture-only 0.6 s · energy: 0.55} (15.5–25.5 s)
vo: Look beneath that clear skin, and the defence is already there, immune cells crowding the follicle, some as thickly as in a red *spot*. {c3}

## why {shot: pull back to two follicles side by side, one calm, one ringed; the same rod-shaped bacterium glows orange-red deep in both; on "answers" only the ringed one's cells light · badges: simplified · debated · picture-only 2.2 s · energy: 0.5} (25.5–38 s)
vo: It's easy to picture an infection. {-} But this bacterium lives in skin with spots and skin without. {c4} What makes the spot is largely how your body *answers* it. {c5}

## whoa {shot: push into the ringed follicle: white cells pour in, the wall thins and gives way, the contents spill into the dermis; then a thumb's pressure from above drives the spill deeper and the red spreads · badge: model, not a photo · picture-only 3.2 s · energy: 0.8} (38–51.5 s)
vo: White cells flood in until the follicle's wall can give way, spilling the fight *deeper*. {c6,c7} A squeeze often pushes it further, where a *mark* is more likely. {c8,c9}

## toscale {segment: toscale · the gauge lifts to centre beside the follicle: one white cell rises out of the spill (≈ 8 µm), ten stack (≈ 80 µm), then the paper's 100 µm · picture-only 0.5 s · energy: 0.4} (51.5–60 s)
vo: And the pus is that fight's fallen: white cells so small that ten in a row still wouldn't span this paper's *thickness*. {c10,c11}

## takeaway {shot: back to the hook's UV cheek, the one spot lit, the clear skin around it now showing its own ringed follicles in faint cyan · picture-only 0.5 s · energy: 0.3} (60–67 s)
vo: So, is it new? No. {-} It's the end of a fight that began out of *sight*. {c12}

## tease {end card held ≥ 1.6 s · energy: 0.35} (67–73 s)
vo: Next: the light on your face, and where it really *goes*. {-}
end card: "Next layer: where the light on your face goes" · "Outer Layer · No. 001" · footnote: "In one study, 28% of new inflamed spots rose from skin that looked clear (Do et al., 2008)."

## Notes
- Look (reboot, 2 Nov): UV camera reveals and macro flights (bible §2); shot directions rewritten for it, the spoken lines unchanged from `s1v2/pimples`. The orange-red follicle glow under UV is on screen only (claims.json c13).
- Every claim was checked through search excerpts only (the proxy blocks page fetches; www.ncbi.nlm.nih.gov does
  not resolve from this session); see `claims.json`. A person opens each link, and a board-certified dermatologist
  signs off, before posting.
- "More than a quarter": Do et al. 2008 tracked 25 people with untreated facial acne, photographed every 2 weeks for
  12 weeks; 28% of inflammatory lesions were preceded by normal-appearing skin (54% by comedones). Lesions too small
  to see in a photo, or that came and went between photos, were missed, so "looked clear" is literal: clear in the
  photo. Screen: "28% · in one study".
- "As thickly as in a red spot": Jeremy et al. 2003 found macrophage numbers in uninvolved skin "similar to those in
  papules"; T cells were raised but lower than in papules. Hence "some" in the line.
- "About a tenth of a paper's thickness": a resting neutrophil ≈ 8 µm (Ting-Beall et al. 1993: volume ≈ 299 µm³,
  sphere ≈ 8.3 µm, computed); spread on a smear 12–15 µm. 8–15 µm ÷ 100 µm ≈ a twelfth to an eighth: "about a tenth".
- No number of weeks is spoken or shown for how long a spot takes to form: the popular "2–3 weeks" / "8 weeks" /
  "90 days" figures trace to brands and clinics, not to a measured study (research.md).
- Tease and end card set with the season's chain (see `../SEASON.md`).
- Listen at T0: follicle, bacterium, pus.
