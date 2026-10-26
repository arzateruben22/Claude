# Rest Frame No. 002: "The swing's secret" (draft; a physicist signs off before it posts)

About 72 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labelled as AI), with an
original score. Built from the bible's episode 2 (`../bible.md`, §7 #2) and episode 1's tease
("Next: one pendulum, big swing against small. It's almost a tie."), which this episode pays off.

- Two identical pendulums, 99.4 cm long (the seconds pendulum: about one second per swing at
  g = 9.81 m/s²), released together from 30° and 10°. The scene runs the exact large-angle motion
  (Jacobi elliptic functions, `../set/pendulum.js`), not the small-angle formula, so the 1.55% the
  30° swing loses against the 10° one (1.74% against the small-swing ideal) is really on screen.
- A "swing" is one way across, as a clock counts it (tick, tock). The measure segment counts 20.
- The whoa rebuilds Harvard's pendulum-wave design: fifteen pendulums making 51 to 65 back-and-forth swings
  a minute, run fast with the speed badge on screen.
- The wrong idea: Galileo claimed every swing, wide or narrow, takes the same time. For small swings he was
  nearly right; the measure segment shows by how much he was wrong for a 30° swing.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep02 --segment measure`.

## hook {shot: measure view; frame 0: both pendulums mid-swing near the bottom, neck and neck, their ghosts behind them · title drop: "The swing's secret" · badge: slowed · pre: 0.1 · energy: 0.6} (0–3.5 s)
vo: Which swing gets back *first*? Big? Or small? {-}

## normal {shot: one pendulum, released at ×1, then ×1/5 for the swing back with ghosts every 1/10 s · labels: "99.4 cm", "1 s", "1/10 s apart" · pre: 0.15 · energy: 0.45} (3.5–14 s)
vo: Each string is just under a meter, as in a grandfather clock. {c1} One swing: about
*one second*. {c2} Ghosts every tenth of a second bunch up at the turns. {c3}

## change {events: both released together at ×1/4 from 30° and 10°; both pass the bottom on one word · labels: "30°", "10°" · pre: 0.1 · energy: 0.5} (14–21.5 s)
vo: Pull its twin three times farther. {-} Let both go. {-} Three times the distance… and still,
*neck and neck*. {c4}

## why {shot: frozen at release, then slowed · card: Galileo's claim · vectors: gravity's pull along the arc (about 3×), then the speed at the bottom (about 3×) · picture-only 2 s · pre: 0.25 · energy: 0.55} (21.5–39 s)
vo: Galileo claimed every swing takes the same time, wide or narrow. {c5} For small swings, he was
*nearly* right. {c6} Three times farther out, the pull is almost three times stronger. {c7} So it
covers triple the path at nearly triple the speed: *nearly* the same time. {c8}

## whoa {shot: the turn, from the front (fifteen look like one) to above the row · fifteen pendulums, 51–65 back-and-forth swings a minute, run fast; they realign on "line" · picture-only 3 s · energy: 0.8} (39–51 s)
vo: Now hang fifteen, each a little shorter. {c9} Only length changes. {c16} For half a minute, they drift apart. {c10} Then,
just as gradually… back in *line*. {c17}

## measure {segment: measure · the two pendulums again, run fast; a counter counts twenty swings, then it freezes with the big one behind · pre: 0.2 · energy: 0.3} (51–61 s)
vo: *Measure it*: twenty swings, and the big one is three tenths of a second *behind*. {c11} At
thirty degrees, Galileo is off by about one part in sixty. {c12}

## takeaway {shot: hold, both swinging in real time · badge: "Ideal pendulums: no air, no friction" · energy: 0.45} (61–66.5 s)
vo: Length sets the beat. {c13} A wider swing just moves faster: *almost* fast enough. {c14}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (66.5–72 s)
vo: Next: a dropped ball, bouncing back. {-} It never reaches your *hand*. {c15}
end card: "Next drop: where does the bounce go?" · "Follow Rest Frame"

## Notes
- The scene runs the exact pendulum (no small-angle approximation), without air or friction; the
  takeaway's badge says so.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Galileo, "neck and neck", "three tenths".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
