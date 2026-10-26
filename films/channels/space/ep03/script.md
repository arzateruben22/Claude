# Light Minute No. 003: "Venus day" (draft; fact-check before posting)

About 72 s, 9:16, narrated by a synthetic voice (am_michael, labelled as AI), with an original
score. Bible §7 #2. It pays off episode 2's tease ("Next: a world that turns slower than it orbits.
And backwards.") and sets up episode 4 (the falling Moon).

The story: for three centuries astronomers guessed Venus's day through its clouds and got it wrong
both ways (about 23 hours; one face always to the Sun). Radar in the 1960s found a turn of 243 days,
backwards: longer than its 225-day year. The twist: the Sun still comes round every 117 days, and
rises in the west, because the backward spin and the orbit work together. So a day is not a spin;
it is the Sun coming back. The person: the astronomers and the radar team; the wrong idea: both guesses.

Honesty, on screen: "not to scale" (sizes and the orbit), the clock's speed note, "illustration"
on Venus's cloud deck (drawn, not imaged), "a person standing here" for the meridian pin.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/space/ep03 --segment readout`.

## hook {shot: frame 0, the payoff: Venus close, its pin ("you") on the night side, the Sun low on its limb; spine "one turn: ? days" · badge: not to scale · title: "Venus day" · pre: 0.03 · picture-only 0.2 s · energy: 0.7} (0–4.6 s)
vo: Can one day outlast a *year*? {-} On *Venus*: yes. {c19} And no. {c20}

## normal {shot: pull back to the diagram: the Sun, Earth's and Venus's orbits; spine "Earth: 365 sunrises a lap" · labels: Earth, Venus · picture-only 0.2 s · energy: 0.45} (4.6–14.5 s)
vo: On Earth, you see the Sun rise about three hundred sixty-five times a lap. {c1} Next door, Venus hides its face under a permanent lid of *cloud*. {c3}

## change {shot: push in on Venus, blurred clouds; two guesses play on its pin and are struck out · spine "guess: 23 hours", then "guess: 225 days" · picture-only 0.2 s · energy: 0.55} (14.5–25 s)
vo: For three hundred years, astronomers chased faint smudges in those clouds. {c4} The Cassinis, father and son, clocked about twenty-three hours. {c5} Schiaparelli said one side always faced the *Sun*. {c6}

## why {shot: a radar ping from Earth to Venus and back, through the clouds to the pin (the deck stays, badged 'illustration'); the true spin, backwards · spine "one turn: 243 days", then "one year: 225 days" · picture-only 2 s · energy: 0.62} (25–40 s)
vo: In nineteen sixty-two, radar from a dish in California pierced the clouds. {c7} Both guesses were wrong. {c18} Venus turns once every two hundred forty-three days, longer than its year. {c8} And it turns *backwards*. {c10}

## whoa {shot: the diagram, two Venus years under a speed note; each sunrise drops a teal tick on the orbit; a small dial of the pin's sky shows where the Sun is (behind the clouds: a diagram, not a view) · spine "sunrise to sunrise: 117 days", then "where the Sun rises on Venus: west" · picture-only 3 s · energy: 0.8} (40–52 s)
vo: Stand there, and the spin and the orbit team up. {c11} The Sun comes back every hundred and seventeen days, rising in the *west*. {c12,c13}

## takeaway {shot: hold on the diagram, the ticks · spine "243 > 225" (yes), then "117 < 225" (no) · picture-only 0.2 s · energy: 0.3} (52–59 s)
vo: So yes: one turn outlasts a year. {c9} But the day you'd live by is the Sun coming *back*. {c14}

## readout {segment: readout · the closing light-time readout: ring "6 min" Sun to Venus, then the radar's round trip "4 min" Earth–Venus–Earth at its closest · a ping per ring · picture-only 0.2 s · energy: 0.45} (59–65.5 s)
vo: *Light time*, Sun to Venus: six minutes. {c15} The radar's round trip, at its closest: about four minutes. {c16}

## tease {end card held ≥ 1.5 s · signature: pings E5, B5, F♯6 · energy: 0.4} (65.5–72.5 s)
vo: Next: the Moon never stops falling toward us. {c17} So why doesn't it *land*? {-}
end card: "Next light: the Moon that never *lands*" · "Light Minute · No. 004"

## Notes
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Venus, Cassinis, Schiaparelli; "twenty-three hours", "two hundred forty-three".
- TODO: the handle (@lightminute), a decision on adding miles for US viewers, and the AI-voice
  label in the post.
