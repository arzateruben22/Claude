# Outer Layer s1v2: "Where a glow comes from" (draft; dermatologist sign-off before posting)

About 72 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2 (BRIEF.md).

The story: follow one beam of light onto a cheek. Only a few percent bounces off the top as a glint, because the
outer layer (stratum corneum) bends light about as strongly as glass; smooth and well-watered, that glint comes
back in one direction like a mirror, dry and rough, it scatters. The wrong idea is "a glow is a surface shine";
the turn is that the glint is the small part: most light goes in, scatters among cells and fibres, and a large
share comes back out, tinted on the way by melanin and blood. The whoa: a rush of blood sends it back redder, and
people asked to make faces look healthy (Stephen, Coetzee, Law Smith & Perrett, 2009) turned exactly that blood
colour up. "To scale" puts how far light gets in (blue about a millimetre, red several times deeper) beside a
stack of paper.

Flow (WRITING.md, 29 Oct): one thread from the hook's "Where does a glow come from?" to the takeaway's "Mostly
from within"; the voice carries the meaning and the screen the specifics (n ≈ 1.55 vs air 1.0, ≈ 4–7 % glare,
≈ 40 % back out in one example, the 2011 hydration study, the 2009 face study, ≈ 1 mm vs ≈ 4–5 mm, 100 µm
paper). The picture is one beam the camera follows: the cheek's surface → the glint (mirror vs scattered) → down
through a simplified section among cells, fibres and vessels → back out, tinted → the cheek again, lit from within.
Two cuts at most, both scale jumps.

Honesty, on screen: the section is "simplified"; the beam paths are an "illustration"; the reflection share is
"≈ 4–7 %, near head-on light"; the 40 % back-out is "one example (model)"; the hydration panels are "one study";
the depth bars are "estimate" (they vary with skin and beam); the face-colour panel uses a "model" face, never a
real person's before/after. The cheek and the section appear in light, medium and deep tones side by side, never one tone
alone (more melanin absorbs more, so less comes back). No advice and no product: the film never says how to get a glow, only what one is.
Sign-off: the flush and blood-colour lines touch on skin redness; a dermatologist checks they don't read as a
claim about any condition.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/s1v2/glow --segment toscale`.

## hook {shot: frame 0, the payoff: a cheek in warm side light, seeming lit from within; one thin beam of white light enters frame · badge: illustration · title: "Where a glow comes from" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–4.5 s)
vo: Where does a *glow* come from? Follow the light in. {-}

## normal {shot: no cut: the camera rides the beam down to the surface; at contact a small bright glint splits off · spine: reflected ≈ 4–7 % · readout n 1.55 | air 1.0 · badge: near head-on light · picture-only 0.5 s · energy: 0.45} (4.5–15 s)
vo: It meets your skin's outer layer, which bends light about as strongly as glass. {c1,c2} So only a few percent bounces straight back off the top, as a *glint*. {c3}

## change {shot: split surface, same beam: left, flat hydrated corneocytes send the glint back as one tight ray; right, lifted dry flakes spray it into a haze · badges: one study · illustration · picture-only 0.6 s · energy: 0.55} (15–26 s)
vo: Smooth and full of water, that layer sends the glint back in one clean *direction*, like a mirror. {c4,c5} Dry it out, and it scatters light every which way. {c6}

## why {shot: an iris through the surface opens on a simplified section; the rest of the beam threads among cells and collagen fibres, zig-zagging, and many paths turn and climb back out · spine: back out ≈ 40 % · badges: simplified · one example (model) · picture-only 2.2 s · energy: 0.5} (26–39 s)
vo: You might guess a glow is that glint. {-} But it's the small part: most light slips inside, bounces among cells and fibres, and a large share comes back *out*. {c7,c8}

## whoa {shot: the climbing paths pass melanin grains and a capillary; they pick up a warm tint; the capillary widens and the outgoing light reddens; pull back to a model face beside a slider labelled "oxygenated blood colour" nudged up · badges: model face · Stephen et al., 2009 · picture-only 3.2 s · energy: 0.8} (39–52.5 s)
vo: Melanin and blood tint it on the way, and a rush of blood sends it back *redder*. {c9,c10} Asked to make a face look healthy, people turned that up. {c11}

## toscale {segment: toscale · the gauge lifts to centre beside the section: a blue bar stops at ≈ 1 mm beside a stack of ten 100 µm sheets; a red bar runs on to ≈ 4–5 mm · badge: estimate · picture-only 0.5 s · energy: 0.4} (52.5–59.5 s)
vo: Blue light gets barely a millimetre in, about ten sheets of paper; red light goes several times *deeper*. {c12,c13,c14}

## takeaway {shot: back to the hook's cheek, now with the beam paths faintly traced coming out of it · spine holds: back out ≈ 40 %, glint ≈ 4–7 %, label "from within" · picture-only 0.5 s · energy: 0.3} (59.5–67.5 s)
vo: So where does a glow come from? Mostly from within: light that went in, met your blood, and came *back*. {c15}

## tease {end card held ≥ 1.6 s · energy: 0.35} (67.5–74 s)
vo: Next: skin closes almost any cut. But is a scar still *skin*? {-}
end card: "Next layer: is a scar still skin?" · "Outer Layer · No. 002"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches: ncbi.nlm.nih.gov failed to
  resolve); see `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before
  posting.
- "Bends light about as strongly as glass": stratum corneum n ≈ 1.55 (dry) against window glass ≈ 1.5. Fresnel
  at head-on incidence, ((1.55 − 1)/(1.55 + 1))² ≈ 4.7 % (computed), inside the measured 4–7 %.
- "About ten sheets of paper": ≈ 1 mm ÷ ≈ 100 µm per sheet = 10 (computed). Depths depend on skin type, site and
  beam width; on screen as "estimate".
- Tease and end card set with the season's chain (see `../SEASON.md`).
- Listen at T0: melanin.
