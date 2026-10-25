# Light Minute No. 006: "Your speed" (draft; fact-check before posting)

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #5. It pays off episode 5's tease ("Next: since this started, you've flown at least
two thousand kilometers. How?") and sets up episode 7 (trees or stars).

The story: sitting still, you ride Earth's spin, faster than sound at the equator; Earth's orbit adds
thirty kilometers a second; the Sun carries us round the galaxy at about two hundred thirty a second, one
lap in about 230 million years: the last time we were here, the first dinosaurs were just appearing. Why
don't we feel any of it? Galileo's ship's cabin: a steady speed can't be felt, only a change in it. The
person: Ptolemy, then Galileo; the wrong idea: that if Earth moved, we would feel it (birds and clouds left
behind). The answer it lands on: speed is always compared to something.

Honesty, on screen: "not to scale" and the clocks' speed notes on every diagram, "illustration" on the
galaxy, and "speeds add as directions allow" (the speeds point different ways; the film stacks them as
sizes, not as one sum).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep06 --segment readout`.

## hook {shot: frame 0, the payoff: the one scale jump frozen mid-way, Earth's spin, its orbit and the Sun's path round the galaxy drawn as three nested speeds; spine "your speed: ?" (answered at the end: "compared to what?") · title: "Your speed" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–3.4 s)
vo: How fast are you moving *now*? {-} Sitting perfectly *still*. {-}

## normal {shot: Earth close, spinning under a speed note; a pin at the equator ("you, if you live here") · spine "Earth's spin, at the equator: 1,670 km/h" · picture-only 0.2 s · energy: 0.45} (3.4–12.5 s)
vo: Earth spins: at the equator, the ground moves about sixteen hundred seventy kilometers an hour. {c1} That beats the speed of *sound*. {c2}

## change {shot: pull back to Earth's orbit · spine "Earth around the Sun: 30 km/s" · picture-only 0.2 s · energy: 0.55} (12.5–21.5 s)
vo: And Earth circles the Sun at about thirty kilometers every second. {c3} Since this began, you've gone farther than New York to *Boston*. {c4}

## why {shot: Galileo's cabin, below deck: a bowl, a butterfly, drops falling straight; the ship moving on calm water · spine "what you can feel: a change in speed" · picture-only 2 s · energy: 0.62} (21.5–40 s)
vo: Ptolemy argued that if Earth moved, birds and clouds would be left *behind*. {c5} In sixteen thirty-two, Galileo answered with a ship's cabin. {c6} Below deck on calm water, nothing tells you the ship is *moving*. {c13} You feel a jolt, never a smooth *ride*. {c7}

## whoa {shot: the one scale jump: from Earth's orbit out to the galaxy, the Sun on its lap · spine "the Sun around the galaxy: 230 km/s", then "one lap: 230 million years" · picture-only 3 s · energy: 0.8} (40–55 s)
vo: Zoom out. {-} The Sun drags us round the galaxy at about two hundred thirty kilometers a *second*. {c8} One lap: about two hundred thirty million years. {c9} Last time round, the first dinosaurs had just *appeared*. {c10}

## takeaway {shot: hold on the galaxy, the Sun's lap drawn · picture-only 0.2 s · energy: 0.3} (55–60.5 s)
vo: So your speed has no single answer. {c15} First ask: compared to *what*? {c14}

## readout {segment: readout · the closing light-time readout: "0.05 s" the distance you've flown round the galaxy while watching; "27,000 years" to the galaxy's centre · a ping per line · picture-only 0.2 s · energy: 0.45} (60.5–68.5 s)
vo: *Light time*, across your galactic trip so far: about a twentieth of a second. {c11} To the galaxy's center: about twenty-seven thousand years. {c12}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (68.5–74.5 s)
vo: Next: trees on Earth, or stars in our galaxy. {-} Which are there *more* of? {-}
end card: "Next light: trees or *stars*" · "Light Minute · No. 007"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: "sixteen hundred seventy", Galileo, "two hundred thirty million".
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
