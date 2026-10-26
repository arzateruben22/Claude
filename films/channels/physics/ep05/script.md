# Rest Frame No. 005: "The spinning chair" (draft; a physicist signs off before it posts)

About 70 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labelled as AI), with an
original score. Built from the bible's episode 5 (`../bible.md`, §7 #5) and episode 4's tease ("Next: a
spinning office chair. Pull in your arms, and you accelerate. Why?"), which this episode pays off.

- A person on a swivel chair holding two 2 kg dumbbells pulls them from 80 cm to 20 cm from the axis.
  The model (`../set/spin.js`): angular momentum conserved (friction ignored, badged); the seated person and
  the chair's top without the arms are taken as 2.0 kg·m² (an assumption, badged), and each arm (3.5 kg) is a
  rod from the shoulder (19 cm out) to the hand, moving in with it. The spin goes up 2.67× (2.2–3.1× for a
  body of 1.5–3.0 kg·m²: "more than twice as fast"). The spine counts rpm: 30, then 80, then the skater's 342.
- The measure segment reads the strobe ladder seen from above: ghosts every 1/10 s, 18° apart with the
  arms out (one turn every 2 s), 48° apart with them in.
- The whoa: the fastest spin on ice skates, 342 rpm (Guinness: Olivia Oliver, Warsaw, January 2015).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep05 --segment measure`.

## hook {shot: from above; frame 0: the chair mid-spin as the arms come in, the dumbbells' ghosts spreading apart · title drop: "The spinning chair" · pre: 0.1 · energy: 0.6} (0–3.5 s)
vo: Why does it speed *up*? {-} Nobody pushes. {-} Nothing pushes. {-}

## normal {shot: from above, a slow push · the person turning once every 2 s, arms out, two dumbbells · pre: 0.15 · energy: 0.45} (3.5–13.5 s)
vo: Sit on a swivel chair with two dumbbells, arms out wide. {-} Give yourself one gentle push. {-} You turn about once
every two *seconds*. {-}

## change {shot: the arms come in; the ghost gaps open up · pre: 0.1 · energy: 0.5} (13.5–20 s)
vo: Now pull both dumbbells in, to your chest. {-} Suddenly, you're whipping round more than twice as
*fast*. {c1}

## why {shot: the turn, from above to the side · vectors: the weights' path spiralling in · picture-only 2 s · pre: 0.25 · energy: 0.55} (20–37 s)
vo: It feels like something pushed. {-} Nothing *outside* did. {c2} With no twist from outside, your
total amount of spin can't change. {c3} Weight near the middle is easier to turn, so that same amount
turns you *faster*. {c4} Your arms paid for every extra turn. {c5}

## whoa {shot: an ink skater beside the chair, arms in, spinning · picture-only 3 s · energy: 0.8} (37–50 s)
vo: Skaters use this. {c13} In twenty fifteen, a young Canadian skater spun at three hundred forty-two
turns a *minute*. {c6} Nearly six turns a second. {c7}

## measure {segment: measure · from above, frozen: the two ghost ladders, arms out and arms in · pre: 0.2 · energy: 0.3} (50–57.5 s)
vo: *Measure it*: ghosts a tenth of a second apart. {-} Arms out, eighteen degrees. {c8} Arms in, nearly
*fifty*. {c9}

## takeaway {shot: the chair spinning on, arms in · badge: "Friction ignored" · energy: 0.45} (57.5–62.5 s)
vo: One push set your total spin. {c10} Your arms just decide how *fast*. {c11}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (62.5–69 s)
vo: Next: a drinking straw, three storeys tall. {-} Could you still *drink* through it? {-}
end card: "Next drop: the ten-metre straw" · "Follow Rest Frame" · footnote: "Olivia Oliver, 342 rpm, Warsaw 2015: the Guinness record for the fastest spin on ice skates (as of 2026)."

## Notes
- The spin is computed from angular momentum (no simulation); friction is ignored (badged).
- The seated body's own moment of inertia (2.0 kg·m²) and the arms' 3.5 kg are assumptions, stated in claims.json and badged.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: "three hundred forty-two", "swivel".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
