# Outer Layer No. 002: "Where a glow comes from" (draft; a board-certified dermatologist signs off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2 (BRIEF.md).
Facts pass 2 (2 Nov, `../s1v2/FACTS-PASS-2.md`): script and facts only; the picture is being redesigned, so the shot
descriptions below are deliberately short and look-agnostic.

The story: follow one beam of light onto a cheek. Only about one ray in twenty bounces off the top as a glint;
smooth, hydrated skin sends that glint back in one direction, dry skin scatters it. The turn: the glint isn't the
glow. Most light goes in, scatters among cells and fibres, and several times more than the glint comes back out,
having passed melanin and blood on the way. The whoa: because it passes your blood, your face changes colour with
every heartbeat, too faint to see, but an ordinary camera can count your pulse in it (Verkruysse, Svaasand &
Nelson, 2008; Wu et al., 2012). "To scale" weighs how deep it goes (blue about a millimetre, ten sheets of paper;
red several times deeper). The closing twist: film faces made by computer once looked like plastic because their
light never went inside, until a model of light travelling under the skin (Jensen et al., 2001) earned an Academy
technical award; yours does go inside, and that's your glow.

Three "I didn't know that" beats, ranked:
1. **Hook:** most of the light on your face goes inside you (≈ 93–96 %; only ≈ 4–7 % glints off). Lister 2012; Jacques (OMLC).
2. **Whoa:** your face changes colour with every heartbeat; a consumer camera can read your pulse from it. Verkruysse 2008; Wu 2012.
3. **Closing twist:** computer faces looked like plastic until light was let inside them (Jensen, Marschner, Levoy & Hanrahan, SIGGRAPH 2001; Academy Technical Achievement Award, 2004).

Counter-intuitive turn (why): you'd picture a glow as shine sitting on the skin, but the shine is the small part;
the glow is light that has travelled through you.

Flow (WRITING.md): one thread from the hook's "Where's your glow from? … goes inside you" to the takeaway's "their
light never went inside. Yours does"; the voice carries the meaning ("one ray in twenty", "several times more",
"ten sheets of paper", "several times deeper") and the screen the figures (≈ 4–7 %, ≈ 40 % back out in one example,
≈ 1 mm vs ≈ 4–5 mm, 100 µm paper, the 2008 / 2012 / 2001 studies in the end-card footnote).

Honesty, on screen: the section is "simplified"; the reflection share is "≈ 4–7 %, head-on"; the 40 % is "one
example (model)"; the hydration contrast is "one study"; the depth bars are "estimate"; every face is a "model, not
a photo", never a real person's before/after. At most two labels at a time; captions carry the words. One medium
tone throughout (bible §1) with the three-tone daylight strip in the takeaway (more melanin absorbs more, so less
comes back). No advice and no product: the film never says how to get a glow, only what one is.
Sign-off: a dermatologist checks that the heartbeat colour line reads as optics, not as a health test or a claim
about any condition, and that "that's your glow" is fair across skin tones.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep02 --segment toscale`.

## hook {shot: frame 0, the payoff: the cheek, seeming lit from within; one beam enters · labels (2): title "Where a glow comes from" · badge: illustration · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–4.5 s)
vo: Where's your *glow* from? {-} Most light on your face goes inside you. {c7}

## normal {shot: the beam reaches the surface; a small glint splits off, tight on one side, hazy on the other · labels (2): spine: glint ≈ 4–7 %, head-on · badge: one study · picture-only 0.5 s · energy: 0.45} (4.5–14.5 s)
vo: Only about one ray in twenty bounces off as a glint. {c3} Smooth, hydrated skin sends it back one way; dry skin scatters it into a *haze*. {c4,c5,c6}

## change {shot: the reveal below the surface: the rest of the beam scatters and climbs back out · labels (2): spine: back out ≈ 40 % · badge: one example (model) · picture-only 0.6 s · energy: 0.55} (14.5–24.5 s)
vo: But the glint isn't the glow. {-} The rest slips in, bounces among cells and fibres, and several times more finds its way back *out*. {c8}

## why {shot: the returning paths pass melanin and a vessel and warm in tint · labels (2): spine: back out ≈ 40 % · badge: simplified · picture-only 2.2 s · energy: 0.5} (24.5–35.5 s)
vo: You'd picture a glow as shine sitting on the skin. {-} But it's light that has travelled through you, past your melanin and your *blood*. {c9}

## whoa {shot: the reveal of the pulse: the cheek's colour rising and falling with each beat, amplified · labels (2): spine: back out ≈ 40 % · badge: model, not a photo · picture-only 3.2 s · energy: 0.8} (35.5–49 s)
vo: Blood moves with your heart, so your face changes colour with every beat: too faint to see, but an ordinary camera can count your *pulse* in it. {c17,c18}

## toscale {segment: toscale · depth bars beside a stack of paper · labels (2): blue ≈ 1 mm · red ≈ 4–5 mm (estimate) · picture-only 0.5 s · energy: 0.4} (49–57.5 s)
vo: And it goes deep: blue light barely a millimetre, about ten sheets of paper; red several times further, through the *skin*. {c12,c13,c14}

## takeaway {shot: a hard, surface-only face beside the hook's cheek, lit from within · labels (2): spine: from within · badge: model, not a photo · picture-only 0.5 s · energy: 0.3} (57.5–65.5 s)
vo: Film faces made by computer once looked like plastic: their light never went *inside*. {c19} Yours does; that's your *glow*. {c15}

## tease {end card held ≥ 1.6 s · energy: 0.35} (65.5–72.5 s)
vo: Next: before birth, a cut healed without a trace. {c16} So why do you *scar*? {-}
end card: "Next layer: is a scar still skin?" · "Outer Layer · No. 002" · footnote: "A camera can read a pulse from the colour of a face (Verkruysse et al., 2008)."

## Notes
- Facts pass 2 (2 Nov): new facts c17–c19 (heartbeat colour, camera pulse, computer faces); dropped the flush (old
  c10) and the healthy-face study (old c11, Stephen et al. 2009) to make room. The tease line is unchanged, word for word.
- Every claim was checked through search excerpts only (page fetches are blocked by the proxy); see `claims.json`.
  A person opens each link, and a board-certified dermatologist signs off, before posting.
- "About one ray in twenty": 1/20 = 5 %, inside the measured 4–7 % (computed; 4–7 % is one in 14 to one in 25).
- "Several times more than the glint": ≈ 40 % back out vs ≈ 5 % glare in Jacques's example = about 8× (computed);
  one example, badged.
- "About ten sheets of paper": ≈ 1 mm ÷ ≈ 100 µm per sheet = 10 (computed). "Several times further": 4–5 mm vs
  1 mm (computed). Depths depend on skin type, site and beam width; on screen as "estimate".
- "Looked like plastic": the 2001 paper itself says surface-only shading gives "a hard computer generated look";
  "plastic" is from Cornell's and Optica's accounts of the work. The award was a Technical Achievement Award (a
  certificate, not an Oscar statuette), so the voice doesn't say "Oscar".
- Tease and end card set with the season's chain (see `../s1v2/SEASON.md`).
- Listen at T0: melanin.
