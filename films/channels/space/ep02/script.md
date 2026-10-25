# Light Minute No. 002: "The nearest star" (draft; fact-check before posting)

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #6, posted on **18 Nov 2026**, the day Voyager 1 reaches one light-day from Earth
(NASA's date). It pays off episode 1's tease ("Next: leave for the nearest star today. When do we
arrive?") and sets up episode 3 (Venus day).

The story: the farthest thing we have ever sent crosses one light-day this month. That sounds far.
It is one day of light on a road about fifteen hundred light-days long, and the trip at its speed
would take longer than our species has lived in Europe. The person is the Voyager team (every command
now waits a day, and the answer another day); the wrong idea is that a craft in "interstellar
space" is nearly there: it has not even reached the Sun's comet cloud.

Honesty, on screen: the solar view and the local view are "not to scale" (sizes); Voyager's path is
"simplified" (its 1979–80 planet flybys are drawn as a smooth curve); the 49-year flight and the
signal's day run under speed notes; Proxima is drawn off Voyager's real heading ("Voyager is not
headed there"); the stars' colours and the probe are an "illustration".

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep02 --segment readout`.

## hook {shot: the local view (frame 0, the payoff): the Sun's tiny teal light-day ring, labelled "Voyager 1 is in here", and Proxima Centauri far off with its dashed 4.24-light-year lane · badge: not to scale · title: "The nearest star" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–4 s)
vo: How long to the nearest *star*? Say we leave *today*. {-}

## normal {shot: cut to the solar view, the planets' orbits; Voyager 1 flies out of the plane, 1977 → 2026 under a speed note, a year counter · labels: Earth, Voyager 1, "about 17 km/s" · pill: "Earth → Moon in about 6 h" · picture-only 0.2 s · energy: 0.45} (4–15 s)
vo: Our ride is *Voyager 1*, the farthest thing we've sent. {c1} It left in nineteen seventy-seven. {c2} It coasts at about seventeen kilometers a second: Earth to the Moon in *six hours*. {c3,c4}

## change {events: light.front from Earth, a counter 0 → 24 h; the reply comes back, 48 h · ring "1 light-day" · picture-only 0.2 s · energy: 0.5} (15–26 s)
vo: On November eighteenth, it crosses a line. {c5} Its signal now needs a full *day* to reach us. {c6} The team sends a command today. {-} The answer comes the day after *tomorrow*. {c7}

## why {shot: the heliopause as a faint bubble, labelled "2012"; then a gentle pull-back (×12) until the inner edge of the comet cloud (theory, badged) shows far beyond Voyager; a ghost path to it, "300 years" · picture-only 2 s · energy: 0.55} (26–42 s)
vo: In twenty twelve, it crossed into interstellar space. {c8} Nearly there, then? {-} It hasn't even reached the Sun's cloud of *comets*. {c9} That's three hundred years away. {c10} Getting through it: thirty thousand more. {c19}

## whoa {shot: the episode's one scale jump: the solar view shrinks until the light-day ring is a speck beside the Sun, and Proxima Centauri arrives · events: scale.jump, arrive · counter "at Voyager's speed: about 75,000 years" · tag "at today's distance" · picture-only 3 s · energy: 0.7} (42–56 s)
vo: The nearest star, Proxima Centauri, is about fifteen hundred light-days out. {c11} At Voyager's speed: about *seventy-five thousand years*. {c12} Count back that far, and our species hadn't reached *Europe*. {c13}

## takeaway {shot: hold on the local view; the speck labelled "day 1", the lane to Proxima "of about 1,550" · picture-only 0.2 s · energy: 0.5} (56–62 s)
vo: So we haven't left for the stars. {-} Voyager has crossed day one of *fifteen hundred*. {c14}

## readout {segment: readout · the closing light-time readout: ring "1 day" (the speck), then a wide ring "4 years, 3 months" through Proxima · a ping per ring · picture-only 0.2 s · energy: 0.45} (62–68.5 s)
vo: *Light time*, Earth to Voyager: one day. {c15} To Proxima Centauri: four years and three months. {c16}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (68.5–74 s)
vo: Next: a world that turns slower than it orbits. {c17} And *backwards*. {c18}
end card: "Next light: the planet that turns *backwards*" · "Light Minute · No. 003"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- "On November eighteenth, it crosses a line" is in the present tense: it reads as true on the post date
  (18 Nov 2026) and as a dated fact after it.
- Listen at T0: Voyager, Proxima Centauri, interstellar, comets.
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
