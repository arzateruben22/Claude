# Reality Rulebook · Season 2 · Episode 5: "Listen to the cup fill" (draft; a physicist signs off before it posts)

S2E05 (folder ep11).

About 68 s, 9:16, narrated by a synthetic voice (af_bella at speed 0.85, labeled as AI), with an original score.

- One world: a mug seen in cross-section, water rising in it from a thin stream; the empty space above the water is drawn as a
  pipe closed at the water end, its air shown as layers that move up and down (slowed 300×), and a pitch readout.
- The facts: the pitch of pouring rises because the air above the water is like an organ pipe closed at one end, whose pitch is
  c / (4 (l + 0.62 R)) (Bagad et al., arXiv 2411.11222, read in full); the closed-pipe relation f = v / 4L and flutes changing the
  tube's length (OpenStax University Physics Vol. 1, 17.5, read in full). The two pitch numbers are computed from that formula
  for an illustrated mug (R = 4 cm, c = 343 m/s): 10 cm of empty space gives about 690 Hz, 2 cm gives about 1,900 Hz.
- Spine readout: the pitch of the filling mug, in vibrations a second (Hz).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is direction for the
compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and `{-}` marks a sentence that states nothing
outside the film; neither is spoken. Check it with `python3 -I kits/cinema/script/lint.py films/channels/physics/ep11 --segment measure`.

## hook {shot: a mug in cross-section, water just starting to pour in · title drop: "Listen to the cup fill" · pre: 0.1 · energy: 0.7} (0.0–4.3 s)
vo: Can you hear a mug *fill*? {-} Eyes closed, just listening. {-}

## normal {shot: wide: the stream pours, the water climbs; a pitch readout rises · labels: "water", "empty space" · picture-only 0.7 s · pre: 0.12 · energy: 0.45} (4.3–14.4 s)
vo: Pour water into a mug, and the sound climbs higher and higher. {c1} A computer can even work out the water level from the sound alone. {c2}

## change {shot: close on the empty space above the water: a pipe, its air drawn as layers moving up and down · labels: "a pipe, closed at the water", "air moving" · badge: "air motion slowed 300×" · pre: 0.1 · energy: 0.5} (14.4–22.9 s)
vo: The empty space above the water acts like a pipe, closed at the water end. {c3} Sound bounces up and down inside it. {c4}

## why {shot: two pipes side by side, a short one and a long one; the short one's air moves faster · picture-only 0.7 s · pre: 0.2 · energy: 0.55} (22.9–36.8 s)
vo: A short pipe rings higher than a long one. {c5} A flute player changes the note by changing the length of the pipe. {c6} As the water rises, the empty space shrinks, and the pitch *climbs*. {c7}

## whoa {shot: the mug fills to the brim line; the pitch readout and the empty-space bracket shrink together · picture-only 0.55 s · pre: 0.15 · energy: 0.75} (36.8–46.1 s)
vo: Less empty space, a higher *pitch*. {-} With two centimeters left, the mug rings nearly three times higher than when empty. {c9}

## measure {segment: measure · the mug fills while a pitch trace is drawn, with the two readings marked · pre: 0.2 · energy: 0.5} (46.1–57.6 s)
vo: *Measure it*: with ten centimeters of empty space, you hear about seven hundred vibrations a second. {c10} With two centimeters, you hear nearly two thousand. {c11}

## takeaway {shot: hold on the full mug and the trace · badge: "An illustrated mug: numbers computed from a formula" · pre: 0.25 · energy: 0.45} (57.6–65.1 s)
vo: A shorter pipe makes a higher note. {c12} Next time you pour, *listen*: the mug tells you how full it is. {-}

## tease {end card held ≥ 1.5 s · signature: knocks D6, B5, G5 at 0, +12, +20 frames · energy: 0.4} (65.1–70.7 s)
vo: Next: a raindrop falls a mile. {-} Why doesn't it *hurt*? {-}
end card: "Next drop: the slow raindrop" · "Follow Reality Rulebook" · footnote: "Bagad et al., arXiv 2411.11222 (2024)"

## Notes
- c1, c2, c3, c4, c7 are SOURCE-READ against the arXiv paper (Bagad et al.); c5, c6, c12 against OpenStax 17.5; c9, c10, c11 are
  our own computation from the paper's formula for an illustrated mug (own model, OPEN: a person should recompute; they point at this model folder); nothing is OK until a person opens the pages.
- The ten-centimeter and two-centimeter numbers use R = 4 cm and c = 343 m/s, with the paper's end correction 0.62 R.
- Listen at T0: "hertz" (said as "vibrations a second"), "closed", "flute".
- TODO: the handle, a physicist's sign-off, the AI-voice label in the post.
