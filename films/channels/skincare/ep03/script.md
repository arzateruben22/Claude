# Outer Layer s1v2: "What's in a scar" (draft; dermatologist sign-off before posting)

About 74 s, 9:16, narrated by a synthetic voice (labelled as AI), with an original score. Season 1 v2, topic 6.

The story (facts pass 2, 2 Nov): before birth, a cut heals without a scar; now it doesn't. Why? Normal skin's
deep layer (the dermis) is a basket weave of collagen that gives every way you pull; a scar is the same collagen
laid side by side in one direction, with no hair and no sweat glands. The wrong idea is "healed means as good as
new": in the classic tensile study (Levenson et al. 1965, rats) healed skin topped out at about 80% of the skin
around it, a rope missing one strand in five. The whoa: until roughly 22–24 weeks of gestation a wound in fetal
skin regrows the weave, follicles and all, and one place in an adult still nearly can: the lining of the mouth.
"To scale" puts the part of skin that regrows perfectly (the epidermis, about 0.07–0.12 mm on most of the body)
beside the paper (≈ 100 µm). The closing twist answers the hook: mice born without the white cells that drive
inflammation (macrophages, neutrophils) healed skin wounds with no visible scar, so the scar may be the price of
defence.

The three "I didn't know that" beats, ranked: (1) scarless healing before about 24 weeks of gestation, the hook;
(2) the mouth still heals nearly without a scar, the whoa; (3) mice without inflammatory white cells heal
scar-free, the closing twist. The counter-intuitive turn: "healed" is not "as good as new" (why).

Flow (WRITING.md, 29 Oct): one thread from the hook's "Why do you scar now? Before birth, a cut healed without one"
to the takeaway's "So, why the scar? … heal without one"; the voice carries the meaning and the screen the
specifics (≈ 80% strength, rat skin, ≈ 22–24 weeks, 0.07–0.12 mm, 100 µm paper, mouse study, Levenson et al.
1965 and Martin et al. 2003 in the end-card footnote). Spoken numbers: the sixth month, one strand in five, the
paper's thickness.

Honesty, on screen: the section is "simplified"; the strength curve is a "model", badged "rat skin"; the fetal
section is an "illustration", never a photo; the epidermis depth is "most of the body"; the knee at the end is
"model, not a photo"; the mice are badged "mouse study". At most two labels at a time; captions carry the words.
No real person's scar, no before/after. The film describes biology only; it never says what to do about a scar or
names a treatment or product. Any line about scars as a skin condition is for the dermatologist to sign off.

One line per beat. `*starred*` words get a camera landing or a sound hit. In a vo line, `{c1}` ties a sentence
to `claims.json` and `{-}` marks a sentence that states nothing outside the film.
Check it with `python3 -I kits/cinema/script/lint.py films/channels/skincare/ep03 --segment toscale`.

## hook {shot: frame 0, the reveal on an old scar across a knee · labels stay: simplified · title: "What's in a scar" · pre: 0.05 · picture-only 0.4 s · energy: 0.6} (0–5 s)
vo: Why do you *scar* now? {-} Before birth, a cut healed without one. {c11}

## normal {shot: the push into the weave under the surface · labels stay: simplified · picture-only 0.5 s · energy: 0.45} (5–15 s)
vo: Under the surface, most of your skin's strength is collagen, woven every which way like a basket, so it gives whichever way it's *pulled*. {c1}

## change {shot: the cut, and the patch laid in one direction · labels stay: illustration · picture-only 0.6 s · energy: 0.55} (15–25 s)
vo: Cut through it, and the body doesn't reweave. {c2} It patches: new threads side by side, all one way, with no hair or sweat *glands*. {c3,c4}

## why {shot: the pull test on the patch, stalling short of full · labels stay: model · rat skin · picture-only 2.2 s · energy: 0.5} (25–38.5 s)
vo: We call that healed, as good as new. {-} But pulled until it tears, even an old scar is only as strong as a rope missing one strand in *five*. {c5}

## whoa {shot: the reveal on fetal skin regrowing the weave, then the inside of a cheek · labels stay: illustration · ≈ 22–24 weeks · picture-only 3.0 s · energy: 0.8} (38.5–51.5 s)
vo: Until about the sixth month of pregnancy, a baby's skin regrows the weave, follicles and all. {c6} And one place in you still nearly can: your *mouth*. {c7}

## toscale {segment: toscale · shot: the top layer beside the paper · labels stay: most of the body · picture-only 0.5 s · energy: 0.4} (51.5–59 s)
vo: But on most of your body, only the top layer, about this paper's thickness, regrows without a *seam*. {c8,c9}

## takeaway {shot: back to the hook's knee · labels stay: model, not a photo · mouse study · picture-only 0.5 s · energy: 0.3} (59–67.5 s)
vo: So, why the scar? {-} Mice born without germ-fighting cells heal without one: a scar may be the price of *defence*. {c10}

## tease {end card held ≥ 1.6 s · energy: 0.35} (67.5–74 s)
vo: Next: a deadly poison, in a frown. {-} How much goes *in*? {-}
end card: "Next layer: a deadly poison, in a frown. How much goes in?" · "Outer Layer · No. 003"

## Notes
- Facts pass 2 (2 Nov, owner's direction): new whoa (the mouth) and new closing twist (inflammation and the
  PU.1 null mouse); the strength figure now spoken as a rope; labels cut to two at a time. Shot descriptions are
  look-agnostic while the picture is redesigned; re-voice before compile.
- Every claim was checked through search excerpts only (page fetches are blocked in this session); see
  `claims.json`. A person opens each link, and a board-certified dermatologist signs off, before posting.
- Tease and end card set with the season's chain (see `../s1v2/SEASON.md`).
- "Only as strong as a rope missing one strand in five": Levenson et al. 1965 measured rat skin; the 80%
  ceiling is standard surgical teaching for human skin, but the voice never says "your" scar is 80%. Badge
  "rat skin"; screen "≈ 80%".
- "About the sixth month": reviews give the switch at about 22–24 weeks of gestation (weeks 22–26 are the sixth
  month). The screen shows the weeks.
- "Still nearly can: your mouth": reviews call oral mucosal healing "nearly scarless" and "minimal scarring", not
  scar-free; it can scar with complications or disease. The voice says "nearly".
- "Mice born without germ-fighting cells": PU.1 null mice lack macrophages and functioning neutrophils
  (Martin et al. 2003); their wounds closed on time and the repair "appears scar-free". That inflammation drives
  scarring is the authors' and later reviews' interpretation, supported by fetal studies (an induced inflammatory
  response makes fetal wounds scar); hence "may be". Screen badge "mouse study".
- "About this paper's thickness": the epidermis is about 0.07–0.12 mm on most of the body (≈ 100 µm paper),
  0.05 mm on the eyelids, up to about 1.5 mm on palms and soles.
- End-card footnote: "Levenson et al., 1965 (rat skin) · Martin et al., 2003 (mice)".
- Listen at T0: collagen, follicles.
