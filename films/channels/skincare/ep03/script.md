# Outer Layer s1v2: "What's in a scar" (draft; dermatologist sign-off before posting)

About 73 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, topic 6.

The story: zoom into an ordinary old scar until the threads show. Normal skin's deep layer (the dermis) is a
basket weave of collagen that gives every way you pull; a scar is the same collagen laid side by side in one
direction, with no hair and no sweat glands. The wrong idea is "healed means as good as new"; the stakes are the
strength: in the classic tensile study (Levenson et al. 1965, rats) healed skin topped out at about 80% of the
skin around it. The whoa: until roughly 22–24 weeks of gestation, a wound in fetal skin regrows the weave, hair
follicles and all, with no scar. "To scale" puts the part of skin that regrows perfectly (the epidermis, about
0.07–0.12 mm on most of the body) beside the paper (≈ 100 µm): cut no deeper and it comes back; go into the weave
and it patches.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Why do you scar now? Before birth, a cut healed without one" (the whoa, led with; coordinator, 2 Nov) to the
takeaway's "So, why the scar? Skin's quick repair" and "never the weave"; the voice carries the meaning and the screen the
specifics (basket weave vs parallel bundles, collagen type III → I, ≈ 80% strength, Levenson et al. 1965, rat
skin, 22–24 weeks, 0.07–0.12 mm, 100 µm paper). The picture changes scale with the ideas: a scar on a knee →
the dermis, thread by thread → the patch laid in → a pull test, the readout climbing and stalling → a fetal
section regrowing the weave → the gauge beside the paper → the knee again. Cuts are scale jumps (irises) only.

Honesty, on screen: the section is "simplified"; the healing is `time ×N`; the strength curve is a "model" of
the published curve, badged "rat skin" and "classic study"; the fetal section is an "illustration", never a
photo; the epidermis depth is "most of the body" (thicker on palms and soles). No real person's scar, no
before/after. The film describes biology only; it never says what to do about a scar or names a treatment or
product. Any line about scars as a skin condition is for the dermatologist to sign off.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/s1v2/scar --segment toscale`.

## hook {shot: frame 0, the payoff, the macro flight: a pale old scar crossing the skin of a knee (deep tone) at golden hour, smooth, with no pores and no hairs; the camera already easing in · badge: simplified · title: "What's in a scar" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Why do you *scar* now? {-} Before birth, a cut healed without one. {c11}

## normal {shot: no cut: the push carries down through the surface into the dermis; collagen bundles cross over and under in every direction; on "pulled" the weave gives a little one way, then the other · spine: woven · badge: simplified · picture-only 0.5 s · energy: 0.45} (5–17 s)
vo: Under the surface, most of your skin's strength is collagen, woven over and under in every direction like a basket, so it gives a little whichever way it's *pulled*. {c1}

## change {shot: a cut opens through the weave; fresh threads arrive and lie down side by side, all one way, lit cyan; the follicles and sweat glands stop at the border and none appear inside · badges: time ×N · illustration · picture-only 0.6 s · energy: 0.55} (17–28 s)
vo: Cut through it, and the body doesn't reweave. {c2} It patches, laying new threads side by side, all in one direction, and leaves out the hair and the sweat *glands*. {c3,c4}

## why {shot: the patch under a slow pull, a strength meter beside it climbing over weeks and months, then stalling short of the full mark · badges: model · rat skin · classic study · Levenson et al., 1965 · picture-only 2.2 s · energy: 0.5} (28–40.5 s)
vo: We call a closed wound healed, as good as new. {-} But pulled until it tears, even an old scar holds only about four-fifths of the original *strength*. {c5}

## whoa {shot: a smaller, paler block of fetal skin, badged illustration; a cut closes and the weave knits back over and under, follicles budding inside it, no line left · badges: illustration · ≈ 22–24 weeks · picture-only 3.2 s · energy: 0.8} (40.5–53 s)
vo: Yet until about the sixth month of pregnancy, a cut in a baby's skin regrows the weave, follicles and all. {c6} After that, it *patches*. {c7}

## toscale {segment: toscale · the gauge lifts to centre beside the knee's section: the top layer fills in to its depth, then the paper's 100 µm beside it; below the line, the weave · badge: most of the body · picture-only 0.5 s · energy: 0.4} (53–61 s)
vo: And on most of your body, only the top layer, about this paper's thickness, grows back without a *seam*. {c8,c9}

## takeaway {shot: the UV camera on the knee: the scar a smooth seam with no pores and no pattern, the skin around it textured; the weave faintly showing at its edge · badge: model, not a photo · picture-only 0.5 s · energy: 0.3} (61–67.5 s)
vo: So, why the scar? Skin's quick repair: strong enough to close, never the *weave*. {c10}

## tease {end card held ≥ 1.6 s · energy: 0.35} (67.5–74 s)
vo: Next: a deadly poison, in a frown. {-} How much goes *in*? {-}
end card: "Next layer: a deadly poison, in a frown. How much goes in?" · "Outer Layer · No. 003"

## Notes
- Look (reboot, 2 Nov): macro flight, the weave in section and the UV camera (bible §2); shot directions rewritten for it, the spoken lines unchanged from `s1v2/scar`.
- Every claim was checked through search excerpts only (the proxy blocks page fetches; pmc.ncbi.nlm.nih.gov
  does not resolve in this session); see `claims.json`. A person opens each link, and a board-certified
  dermatologist signs off, before posting.
- Tease and end card set with the season's chain (see `../SEASON.md`).
- "About four-fifths of the original strength": Levenson et al. 1965 measured rat skin; the 80% ceiling is the
  standard surgical teaching for human skin, but the voice never says "your" scar is 80%. Badge "rat skin".
- "About the sixth month": reviews give the switch at about 22–24 weeks of gestation (weeks 22–26 are the sixth
  month). The screen shows the weeks.
- "About this paper's thickness": the epidermis is about 0.07–0.12 mm on most of the body (≈ 100 µm paper),
  0.05 mm on the eyelids, up to about 1.5 mm on palms and soles.
- Listen at T0: collagen, follicles.
