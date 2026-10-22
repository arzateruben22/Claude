# Rest Frame No. 001: "Thrown or dropped?" (draft; a physicist signs off before it posts)

About 75 s as voiced (74.9 s laid out on the 112.5 BPM grid), 9:16, narrated by a synthetic voice (af_bella at speed 0.95, labelled as AI), with an
original score. Built from the bible's episode-1 script (`../bible.md`, §8) with every fix from
the cross-check (`../../crosscheck.json`) applied:

- Throws at 0.44, 0.89 and 1.33 m/s from the 1 m rail land 20, 40 and 60 cm out, so nothing
  travels more than 60 cm sideways and a 6.7 cm ball stays big in 9:16. The change beat uses the
  0.44 m/s throw.
- "Always on the same frame" is gone. These throws land on one frame because the scene is drawn
  without air, and the badge now says how much air would change: the fastest throw would land
  0.30 ms late, against 1.67 ms of physics time per frame at ×1/20 (computed with the bible's
  `drag.py` model).
- "Galileo showed in 1638" is now "described": 1638 is when Two New Sciences was published.
- Added the channel's recurring segment, a "measure it" beat on the strobe ladder.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/physics/ep01 --segment measure`.

## hook {shot: measure view; frame 0: two balls mid-fall, their ghosts level · title drop: "Thrown or dropped?" · badge: slowed ×20 · pre: 0.1 · energy: 0.7} (0–4.5 s)
vo: Which ball lands *first*? One thrown sideways, one just dropped. {-}

## normal {shot: reset, slider drift · events: time.slow to ×1/20, the strobe every 1/20 s · labels: "1/20 s apart", "gravity" · pre: 0.15 · energy: 0.45} (4.5–14.1 s)
vo: Here's a drop, slowed twenty times. {-} Ghosts every twentieth of a second, and the gaps keep
*growing*: a falling ball speeds up the whole way down. {c1}

## change {events: the second ball thrown from the rail at 0.44 m/s, landing 20 cm out; both knocks on one frame · pre: 0.1 · energy: 0.5} (14.1–23.5 s)
vo: Now throw one sideways from the same height, at the same instant. {-} It sails twenty
centimeters across… and lands on the *same frame*. {c2}

## why {shot: the turn, 60–90°, landing on "same height" · vectors: equal gravity arrows, a constant sideways arrow · picture-only 2 s · pre: 0.25 · energy: 0.55} (23.5–39.2 s)
vo: Gravity pulls both balls *down* the same way. {c3} In sixteen thirty-eight, Galileo described
a throw as two motions: a steady glide across, plus a fall. {c4} So at every tick, both sit at
the *same height*. {c5}

## whoa {shot: pull back · events: throws at 0.89 and 1.33 m/s land 40 and 60 cm out; rungs across four trails, four knocks on one frame · picture-only 3 s · energy: 0.7} (39.2–52.3 s)
vo: Throw twice as hard, then three times: forty centimeters out, then sixty. {c6} Every row of
ghosts stays *level*, and all four land on the *same frame*. {c7}

## measure {segment: measure · the strobe ladder: count the nine rungs down the dropped ball's trail, then the stopwatch reads "0.45 s" · pre: 0.2 · energy: 0.5} (52.3–61.1 s)
vo: *Measure it*: nine gaps of a twentieth of a second. {c8} A one-meter fall takes about
*point four five seconds*, thrown or dropped. {c9}

## takeaway {shot: hold on the four trails · badge: "air ignored: the fastest throw would land 0.3 ms late; a frame here is 1.7 ms" · energy: 0.45} (61.1–68.8 s)
vo: Sideways speed changes *where* a ball lands, not *when*. {c10} For a level throw, only the
height sets the clock. {c11}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (68.8–74.9 s)
vo: Next: why big swings and small swings take almost the *same time*. {c12}
end card: "Next: the swing's secret" · "Follow Rest Frame"

## Notes
- The scene runs the fall in closed form without air (B3 Props), so "the same frame" is exact on
  screen. Air would delay the throws by 0.04, 0.15 and 0.30 ms (tennis ball, 1 m drop): under a
  frame, which is what the takeaway's badge says.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0: Galileo, twentieth, centimeters, "sixteen thirty-eight".
- TODO: the handle, a physicist's sign-off, the blind A/B of af_bella against Skin School's
  af_heart (cross-check), and the AI-voice label in the post.
