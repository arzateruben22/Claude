# Rest Frame No. 004: "The hammer and the feather" (draft; a physicist signs off before it posts)

About 70 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labeled as AI), with an
original score. Built from the bible's episode 4 (`../bible.md`, §7 #4) and episode 3's tease ("Next: a
hammer, a feather, the Moon. Nobody wins."), which this episode pays off.

- The drop height is Apollo 15's: about 1.6 m (shoulder height for a standing astronaut). On Earth the
  hammer lands in 0.57 s (computed, no air for the hammer). The feather's drift on Earth is an illustration
  with no number claimed.
- On the Moon (g = 1.62 m/s², NASA's fact sheet) both fall the 1.6 m in 1.41 s (computed), together.
- The wrong idea: Aristotle's "heavier falls faster", held for about two thousand years. Galileo's
  Leaning Tower drop is not used (only Viviani's account places it there).
- The whoa: the MICROSCOPE satellite (flew April 2016 – October 2018; final results 2022) compared two metals
  falling around Earth for months and found them falling alike to within a few parts in 10¹⁵.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep04 --segment measure`.

## hook {shot: measure view on the Moon dressing; frame 0: hammer and feather mid-fall, their ghost rows level · title drop: "The hammer and the feather" · badge: slowed · pre: 0.1 · energy: 0.6} (0–4.5 s)
vo: Which lands *first*? {-} A geology hammer, or a falcon feather? {-}

## normal {shot: the bench (Earth), dropped from 1.6 m at ×1/4 · the hammer lands; the feather drifts · pre: 0.15 · energy: 0.45} (4.5–13 s)
vo: On Earth, it's no contest. {-} From shoulder height, the hammer lands in about half a *second*.
{c1} The feather? {-} Still drifting down. {c2}

## change {shot: the floor turns to regolith: the Moon dressing · both dropped again · pre: 0.1 · energy: 0.5} (13–24 s)
vo: Now take the air away. {-} On the Moon, in nineteen seventy-one, astronaut David Scott dropped
both. {c3} They landed *together*. {c4} "Mister Galileo was correct in his findings," he said. {c16}

## why {shot: vectors: gravity's pull (big on the hammer, tiny on the feather), then the "harder to speed up" bars · picture-only 2 s · pre: 0.25 · energy: 0.55} (24–40.5 s)
vo: For nearly two thousand years, most scholars followed Aristotle: heavier things fall *faster*.
{c5} Gravity does pull the hammer harder. {c6} But a heavier thing is harder to speed up, by *exactly*
as much. {c7} So without air, they tie. {c8}

## whoa {shot: pull back to an ink Earth with a satellite circling · picture-only 3 s · energy: 0.8} (40.5–54 s)
vo: How exact is *exactly*? {-} Starting in twenty sixteen, a satellite let two metals fall around
Earth for months. {c9} They matched to within a few parts in a million *billion*. {c10}

## measure {segment: measure · back on the Moon: the stopwatch reads the fall · pre: 0.2 · energy: 0.3} (54–62 s)
vo: *Measure it*: on the Moon, that drop takes about one point four *seconds*. {c11} On Earth, under six
tenths. {c12}

## takeaway {shot: hold on both ghost rows, level · energy: 0.45} (62–66.5 s)
vo: Gravity speeds them up equally. {c13} Only the *air* tells them apart. {c14}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (66.5–73.5 s)
vo: Next: a spinning office chair. {-} Pull in your arms, and it spins faster. {c15} *Why*? {-}
end card: "Next drop: the spinning chair" · "Follow Rest Frame" · footnote: "The feather was a falcon's. Apollo 15's lunar module was named Falcon."

## Notes
- The falls are closed form (no simulation). On Earth the hammer is drawn without air (its drag over 1.6 m
  is far under a frame); the feather's drift is an illustration.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Aristotle, Galileo, "nineteen seventy-one", "twenty sixteen".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
