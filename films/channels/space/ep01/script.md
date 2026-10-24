# Light Minute No. 001: "If the Sun vanished" (draft; fact-check before posting)

About 71 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Built from the bible's episode-1 script (`../bible.md`, §8) with every fix from the
cross-check (`../../crosscheck.json`) and DECISIONS.md applied:

- The whoa's orbit is no longer a visible arc passed off as eight minutes: in 499 s Earth moves
  only about 14,900 km, 0.006° of its orbit. The film shows that true move at Earth scale
  (1.2 Earth widths), and the diagram's arc carries its own badge, "orbit sped up ×N", apart from
  the light clock, which always runs true.
- One galactic-centre figure for the whole channel: **about 27,000 light-years** (GRAVITY 2021,
  8,275 pc). It closes this episode's light-time readout; B9's "You are here" label and episodes
  5 and 10 use the same number.
- The hook question is shorter, so it is spoken by 2.0 s.
- The tease points to "Nearest star", which goes second (it posts on 18 Nov 2026).
- Arcs stay at or below 1.5° a second (stars are Points, which the motion-blur probe can't see).
- Added the channel's recurring segment, the closing light-time readout.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep01 --segment readout`.

## hook {shot: diagram view; frame 0: the Sun gone, the teal front mid-flight, Earth still curving · badge: thought experiment · title: "If the Sun vanished" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–4 s)
vo: What if the Sun *vanished*? How soon would you *know*?

## normal {shot: rewind, a slow arc of at most 1.5° a second · labels: Sun, Earth · ring "8 min 20 s" · picture-only 0.2 s · energy: 0.45} (4–15 s)
vo: Rewind. {-} We circle the *Sun* at nearly thirty kilometers a second. {c2} It's so far away that
even its light needs *eight minutes and twenty seconds* to reach us. {c1,c3}

## change {events: body.vanish (a one-frame pop, no flash), light.front, the light clock 0:00 → 8:20 in true time · badge: thought experiment · energy: 0.5} (15–24.5 s)
vo: Now switch it *off*. {-} Down here, nothing changes. {-} Its last light is on the way: for over
eight minutes, your sky looks *exactly the same*. {c4}

## why {shot: gravity grid; the well flattens outward at the light front's speed · badge: analogy · picture-only 2 s · energy: 0.55} (24.5–40.5 s)
vo: Gravity is no faster: changes in it travel at the *speed of light*. {c5} In twenty seventeen, we
caught two neutron stars colliding. {c13} Their light and gravitational waves crossed a hundred and
thirty million light-years, and arrived under *two seconds* apart. {c6}

## whoa {shot: Earth at Earth scale moves its true 14,900 km (1.2 Earth widths) while the clock runs; then the diagram, its arc badged "orbit sped up ×N" apart from the light clock · events: arrive; Earth leaves on its tangent · picture-only 3 s · energy: 0.7} (40.5–52 s)
vo: So for eight minutes, Earth keeps *circling* a Sun that isn't there. {c7} Then the news
*arrives*, and Earth sails off, *straight* into the dark. {c8}

## takeaway {shot: pull back to the light-time ring · picture-only 0.2 s · energy: 0.5} (52–58.5 s)
vo: Light and gravity share one speed limit. {c9} Everything you see in the sky is *old news*. {c10}

## readout {segment: readout · the closing light-time readout: ring "8 min 20 s", then a wider ring "27,000 years" around the galaxy's center (the episode's one scale jump, at most 3 s) · a ping per ring · energy: 0.45} (58.5–65.5 s)
vo: *Light time*, Sun to Earth: eight minutes, twenty seconds. {c11} Our galaxy's center: light from
the last *Ice Age*. {c12,c14}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (65.5–71.5 s)
vo: Next: leave for the nearest star today. {-} When do we *arrive*?
end card: "Next: the nearest star" · "Light Minute · No. 002"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- On screen, the whoa's true-scale label reads "14,900 km in 8 min 20 s" (claim c7's note). N in
  "orbit sped up ×N" is set in compile.py from the arc the diagram draws.
- Listen at T0: kilometers, gravitational, galactic center.
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
