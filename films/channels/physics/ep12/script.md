# Reality Rulebook · Season 2 · Episode 6: "The slow raindrop" (draft; a physicist signs off before it posts)

S2E06 (folder ep12), the season finale.

About 66 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.85, labeled as AI), with an original score.

- One world: a tall air column seen from the side, three raindrops of different sizes falling from a small cloud past a height ladder. Each drop's
  fall is computed from the drag equation (m dv/dt = m g - ½ C ρ A v², OpenStax University Physics Vol. 1, 6.4) for a round drop with a drag
  coefficient of 0.5 (our model, badged; real drops flatten, so real speeds differ), drawn slowed down. Arrows show the weight (down, constant)
  and the drag (up, growing). A strobe of ghosts shows the spacing growing and then staying the same.
- The facts are from Loftus and Wordsworth, "The Physics of Falling Raindrops in Diverse Planetary Atmospheres", arXiv 2102.09570 (read in full text):
  drag grows with speed (Eq. 4), terminal velocity is where drag equals weight, bigger drops are faster, they are never teardrop shaped, there is a
  largest stable size and past it they break apart, and a raindrop reaches 99% of its terminal speed within about 1% of its fall.
- Spine readout: the falling drop's speed (m/s), from the model.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep12 --segment measure`.

## hook {shot: a small cloud above a tall air column, one raindrop leaves it · title drop: "The slow raindrop" · pre: 0.1 · energy: 0.7} (0.0–4.0 s)
vo: How fast is *rain*? {-} It starts far above, in clouds. {-}

## normal {shot: the drop falls past the height ladder, ghosts every half second: the gaps grow, then stop growing · labels: "speeding up", "steady speed" · picture-only 0.7 s · pre: 0.12 · energy: 0.45} (4.0–17.9 s)
vo: A stone dropped from a roof keeps speeding up until it lands. {-} A raindrop doesn't. {-} Watch the ghosts: the gaps grow, then stop growing. {-} It reaches its top speed almost at *once*. {c1}

## change {shot: the weight arrow (down, steady) and the drag arrow (up, growing) beside the drop · labels: "weight", "air pushing back" · pre: 0.1 · energy: 0.5} (17.9–26.9 s)
vo: The air pushes back. {-} You feel it with a hand out of a car window. {-} The faster the drop falls, the harder the air *pushes*. {c2}

## why {shot: the two arrows grow to the same length; the speed line goes flat · picture-only 0.7 s · pre: 0.2 · energy: 0.55} (26.9–39.7 s)
vo: It's a tug of war between the weight pulling down and the air pushing up. {-} At some speed, the push of the air matches the drop's weight. {c3} After that, the speed stays the *same*. {c4}

## whoa {shot: three drops side by side, small, middle and big; the big one flattens like a bun and splits · picture-only 0.55 s · pre: 0.15 · energy: 0.75} (39.7–51.5 s)
vo: Big drops fall faster than small ones. {c5} Raindrops are never *teardrops*. {c6} Small ones are round, and the biggest flatten like a bun, and then break apart. {c7}

## measure {segment: measure · the model's speed plot for a small and a big drop, plateaus marked · pre: 0.2 · energy: 0.5} (51.5–61.1 s)
vo: *Measure it*: in this model, a one-millimeter drop tops out near five meters a second. {c8} A five-millimeter drop, near ten. {c9}

## takeaway {shot: hold on the plateau · badge: "A model: a round drop, made-up round numbers" · pre: 0.25 · energy: 0.45} (61.1–67.5 s)
vo: The air gives every drop a speed limit. {c10} So rain from way up high lands *gently*. {-}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (67.5–73.3 s)
vo: That's season *two*. {-} Thanks for watching, and see you next time. {-}
end card: "That's season two" · "Follow Reality Rulebook" · footnote: "Loftus and Wordsworth, arXiv 2102.09570 (2021)"

## Notes
- c1, c2, c3, c4, c5, c6, c7 are SOURCE-READ against the arXiv paper (Loftus and Wordsworth; full text read by the builder; the c2 and c3/c4 sentences are also in OpenStax 6.4, read); c8 and c9 are our own model (own model, OPEN: a person should recompute them from the drag equation with C = 0.5, air density 1.21 kg/m³).
- "A falling stone keeps speeding up" is common knowledge for a short fall; the line says nothing about real stones in air at speed.
- Listen at T0: "once", "pushes", "same", "teardrops", "gently", "two".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
