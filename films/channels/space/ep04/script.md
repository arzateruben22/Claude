# Light Minute No. 004: "The falling Moon" (draft; fact-check before posting)

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #3. It pays off episode 3's tease ("Next: the Moon never stops falling toward us.
So why doesn't it land?") and sets up episode 5 (the size of the Sun).

The story: the Moon is falling, every second. Without gravity it would fly off in a straight line;
gravity bends the line into a circle: it falls, and always misses. Newton's test: the Moon is sixty
times farther from Earth's center than an apple, and gravity fades with distance squared, so there it
should be thirty-six hundred times weaker. Then in one minute the Moon should fall as far as an apple
falls in one second, about five meters (one point four millimeters a second), and it does. The person:
Newton; the wrong idea: that the heavens run on their own rules (Aristotle's two realms).

Honesty, on screen: "not to scale" (sizes), the clock's speed note, "gap ×1,000,000" (the drop is
magnified a million times to be seen), "thought experiment" while gravity is cut, and "the story
goes" for the apple.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep04 --segment readout`.

## hook {shot: frame 0, the payoff: Earth and the Moon, the Moon's straight ghost path leaving the orbit, the gap between them lit · spine "fallen below its straight line: 1.4 mm a second" · badge: gap ×1,000,000 · title: "The falling Moon" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–3.6 s)
vo: What's holding the Moon *up*? {-} Nothing. {c1} It's *falling*. {c17}

## normal {shot: the orbit from above, the Moon moving under a speed note · labels: Earth, Moon, "about 1 km/s" · spine "distance: 384,400 km" · picture-only 0.2 s · energy: 0.45} (3.6–14 s)
vo: Look up tonight: it's about thirty Earths away. {c2} And it moves sideways at about a kilometer every second. {c3} That's New York to Boston in five *minutes*. {c4}

## change {shot: thought experiment: gravity cut, the Moon leaves on its straight line; then gravity back, the line bends · badge: thought experiment · energy: 0.55} (14–23.5 s)
vo: Now switch gravity off. {-} The Moon would fly off in a *straight line*. {c5} Gravity bends it back toward us. {c6} So it falls, and always *misses*. {c18}

## why {shot: an apple and the Moon on one line from Earth's centre; the ruler "60 Earth radii"; the pull shrinks by 3,600 · spine "gravity there: 1/3,600" · picture-only 2 s · energy: 0.62} (23.5–41.5 s)
vo: The heavens, people believed, had their own rules. {c19} Newton, the story goes, wondered if the pull that drops an *apple* reaches the Moon. {c7} The Moon is sixty times farther from Earth's center than the apple. {c8} Gravity fades with distance squared: thirty-six hundred times *weaker*. {c9}

## whoa {shot: the Moon's minute: its 4.9 m drop below its straight line beside the apple's first second, both drawn ×1,000,000 on one scale (the path at true scale) · badge: falls drawn ×1,000,000 · spine "apple, 1 second: 4.9 m", then "Moon, 1 minute: 4.9 m" (1.4 mm a second) · picture-only 3 s · energy: 0.8} (41.5–53 s)
vo: Then in one *minute*, the Moon should fall as far as an apple falls in one second. {c10} About five meters. {c11} And it *does*. {c12}

## takeaway {shot: pull back, the whole orbit, the ghost lines of a dozen seconds · picture-only 0.2 s · energy: 0.3} (53–59.5 s)
vo: So the pull that drops an apple is the same pull that keeps the Moon *falling*. {c13}

## readout {segment: readout · the closing light-time readout: ring "1.3 s" Earth to Moon · a ping · picture-only 0.2 s · energy: 0.45} (59.5–66 s)
vo: *Light time*, Earth to Moon: one point three seconds. {c14} You always see the Moon that late. {c15}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (66–72 s)
vo: Next: pour Earths into the Sun. {-} How many to fill it *up*? {-}
end card: "Next light: how many Earths fill the *Sun*" · "Light Minute · No. 005"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: "three hundred eighty-four thousand", "thirty-six hundred", "millimeters".
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
