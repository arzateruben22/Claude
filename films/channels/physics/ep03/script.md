# Rest Frame No. 003: "Where does the bounce go?" (draft; a physicist signs off before it posts)

About 72 s, 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labelled as AI), with an
original score. Built from the bible's episode 3 (`../bible.md`, §7 #3) and episode 2's tease ("Next: a
dropped ball, bouncing back. It never reaches your hand."), which this episode pays off.

- A tennis ball dropped from 1 m, bouncing with restitution 0.75 (each bounce keeps 56% of its height):
  the middle of the ITF's approved range (dropped from 254 cm onto concrete, it must come back to
  135–147 cm, 53–58%). The scene's bounce series is exact (`../set/bench.js`).
- The change looks closer at one contact, slowed ×40: the knock as sound rings, and the squash that doesn't quite spring back
  (the rubber's internal friction, which is where most of the bounce goes: heat).
- The wrong idea: energy "lost" in a bounce. The person: James Joule, whose falling weights warmed water.
- The whoa stacks the ball on a basketball. The scene shows perfect bounces (the ideal case, badged):
  the tennis ball leaves at 2.65× its landing speed and climbs 7× as high. Real balls lose some of that.
- The measure segment prices one bounce: a quarter of a joule, about two thousandths of a degree.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep03 --segment measure`.

## hook {shot: measure view; frame 0: the ball at the top of its first rebound, well under the dashed "your hand" line, the drop's ghosts above it · title drop: "Where does the bounce go?" · badge: slowed · pre: 0.1 · energy: 0.6} (0–5 s)
vo: Why can't it reach your *hand*? {-} Somewhere, nearly half its bounce disappeared. {c19}

## normal {shot: the drop and three bounces, slowed, ghosts every 1/20 s · spine: the height of each top · pre: 0.15 · energy: 0.45} (5–13.5 s)
vo: One meter down. {-} Fifty-six centimeters back up. {c1} Then thirty-two. {c2} Then eighteen. {c16}
Each bounce keeps just over *half* its height. {c3}

## change {shot: macro push into one contact, slowed ×40 · events: sound rings, the squash, the floor's shiver · pre: 0.1 · energy: 0.5} (13.5–20.5 s)
vo: Look closer. {-} The knock: a puff of *sound*. {c4} The ball squashes, and doesn't quite spring
*back*. {c5}

## why {shot: Joule's apparatus drawn in ink beside the bench · picture-only 2 s · pre: 0.25 · energy: 0.55} (20.5–38 s)
vo: We call that energy *lost*. {-} James Joule wouldn't. {-} In the eighteen-forties, he let falling
weights turn a paddle in water, and the water *warmed*. {c6} Energy doesn't vanish. {c7} It becomes
heat, shaking and sound, spread too thin to *see*. {c8}

## whoa {shot: pull back and tilt up with the tennis ball · events: the stack dropped from 50 cm, the basketball hands over its bounce · badge: perfect bounces · picture-only 3 s · energy: 0.8} (38–51 s)
vo: Balance it on a basketball. {-} Drop both together. {-} The basketball hands over most of its
bounce. {c9} The tennis ball rockets past your *hand*. {c10}

## measure {segment: measure · back to the single bounce: the spine prices it · pre: 0.2 · energy: 0.3} (51–60.5 s)
vo: *Measure it*: those missing forty-four centimeters? {-} A quarter of a joule. {c11} Even if it all
stays in the ball, two thousandths of a *degree*. {c12}

## takeaway {shot: hold on the ladder of bounces · badge: "Air ignored" · energy: 0.45} (60.5–66.5 s)
vo: A bounce never *destroys* energy. {c13} It gives it away, knock by knock. {c14}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (66.5–72 s)
vo: Next: a hammer, a feather, the *Moon*. {c15} Nobody wins. {c17}
end card: "Next drop: the hammer and the feather" · "Follow Rest Frame" · footnote: "Joule (1850): 772 foot-pounds warm a pound of water 1 °F, within 1% of today's value."

## Notes
- The bounce series and the stacked drop are closed form (no simulation), without air.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Joule, "eighteen-forties", "thirty-two".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
