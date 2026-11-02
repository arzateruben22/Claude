# Rest Frame No. 001: "Thrown or dropped?" (Flow version for the owner's voice) (draft; a physicist signs off before it posts)

About 75 s as voiced (74.9 s laid out on the 112.5 BPM grid), 9:16, narrated by a synthetic voice (af_bella at speed 1.0, labelled as AI), with an
original score. Built from the bible's episode-1 script (`../bible.md`, §8) with every fix from
the cross-check (`../../crosscheck.json`) applied:

- Throws at 0.44, 0.89 and 1.33 m/s from the 1 m rail land 20, 40 and 60 cm out, so nothing
  travels more than 60 cm sideways and a 6.7 cm ball stays big in 9:16. The change beat uses the
  0.44 m/s throw.
- "Always on the same frame" is gone. These throws land on one frame because the scene is drawn
  without air, and the badge now says how much air would change: with air, the fastest throw
  lands 0.30 ms after the drop, against 1.67 ms of physics time per frame at ×1/20 (computed with
  the bible's `drag.py` model).
- "Galileo showed in 1638" is now "Galileo saw", undated: 1638 is when Two New Sciences was published.
- Added the channel's recurring segment, a "measure it" beat on the strobe ladder.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep01 --segment measure`.


> **Owner-voice version (2 Nov).** The owner chose to voice Rest Frame 001 themselves, rewritten in the Flow style (WRITING.md) and read in one take,
> mostly talked, with three whispered moments: the hook; "and lands on the same frame" (change); "It's almost a tie" (tease).
> Same beats, events and claims as `script.md`: lint is clean against a claims ledger whose `sentence` fields follow these lines. When the recording
> arrives, this replaces `script.md`, the ledger's sentences are updated the same way, and compile.py re-times the film to the reading.
> The recording page is https://claude.ai/artifact/CJ1jBzjJoXDb5snabSQCzK (version 3).

## hook {shot: measure view; frame 0: two balls mid-fall, their ghosts level · title drop: "Thrown or dropped?" · badge: slowed ×20 · pre: 0.1 · energy: 0.7} (0–4.3 s)
vo: Which lands *first*? A ball thrown sideways, or one just dropped? {-}

## normal {shot: reset, slider drift · events: time.slow to ×1/20, the strobe every 1/20 s · labels: "1/20 s apart", "gravity" · pre: 0.08 · energy: 0.45} (4.3–14.1 s)
vo: Start with the drop, slowed right down. {-} The gaps between its ghosts keep *growing*: a falling ball gains speed all the way down. {c1}

## change {events: the second ball thrown from the rail at 0.44 m/s, landing 20 cm out; both knocks on one frame · pre: 0.1 · energy: 0.5} (14.1–22.7 s)
vo: Now throw one sideways, from the same height, at the same instant. {-} It sails farther out… and lands on the *same frame*. {c2}

## why {shot: the turn, 60–90°, landing on "same height" · vectors: equal gravity arrows, a constant sideways arrow · picture-only 2 s · pre: 0.18 · energy: 0.55} (22.7–38.7 s)
vo: Old gunnery books drew cannonballs flying straight, then dropping. {c13} Galileo saw two motions at once: a steady glide across, and a fall. {c4} Gravity only pulls *down*, so at every moment, both share the *same height*. {c3,c5}

## whoa {shot: pull back · events: throws at 0.89 and 1.33 m/s land 40 and 60 cm out; rungs across four trails, four knocks on one frame · picture-only 3 s · pre: 0.15 · energy: 0.7} (38.7–51.2 s)
vo: Throw harder, then harder still. {-} The landings spread wider, but every row stays *level*, and all four land on the *same frame*. {c6,c7}

## measure {segment: measure · the strobe ladder: count the nine gaps between the dropped ball's ten ghosts, then the stopwatch reads "0.45 s" · pre: 0.2 · energy: 0.5} (51.2–60.3 s)
vo: Now *measure it*. {-} Each gap is a twentieth of a second, and the one-meter fall takes just under half a second, thrown or dropped. {c8,c9}

## takeaway {shot: hold on the four trails · badge: "air ignored: with air, the fastest throw lands 0.3 ms after the drop; a frame here is 1.7 ms" · pre: 0.25 · energy: 0.45} (60.3–68.5 s)
vo: Thrown or dropped? A *tie*. {-} Sideways speed decides *where*, height alone *when*. {c10,c11} In real air, the throw lands a sliver late. {c14}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (68.5–74.9 s)
vo: Next: one pendulum, big swing against small. {-} It's *almost* a tie. {c12}
end card: "Next: the swing's secret" · "Follow Rest Frame" · footnote: "Two motions at once: Galileo, Two New Sciences, 1638"
