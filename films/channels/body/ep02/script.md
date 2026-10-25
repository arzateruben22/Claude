# Meanwhile, Inside No. 02: "A billion passengers" (draft; a physiologist signs off before it posts)

About 70 s, 9:16, narrated by a synthetic voice (bf_emma, labelled as AI), with an original score.
Built from the bible's episode-2 row (`../bible.md`, §7) to the story standard
(`kits/cinema/script/WRITING.md`). It pays off episode 1's tease ("Room for about a billion
passengers") and sets up episode 3 ("The jump").

- **The wrong idea:** blue blood. Veins look blue, so people guess the blood in them is; it is a
  darker red, and the blue is how light comes back out of skin.
- **The mechanism:** four seats per hemoglobin, filled cooperatively; the colour is the load.
- **The escalation:** every minute your blood comes back to the lungs, and the empty seats refill in
  a quarter of a second.
- An independent review (24 Oct) fixed: "land faster" → "easier" (affinity, not speed); "every iron
  grips" → "each can hold"; "they board" → "the empty seats fill" (returning blood is still mostly
  loaded); "fuel gauge" → "passenger count"; the tease hedged to the fastest nerves; the whoa no
  longer repeats the hook's billion.
- **No talk of pulse oximeters** (bible §9) and no advice.

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/body/ep02 --segment meanwhile`.

## hook {shot: macro; frame 0 is the hero cell cut open, packed with glowing hemoglobin, one O₂ boarding at the cut (labelled O₂) · title: "A billion passengers" · pre: 0.1 · energy: 0.7} (0–5 s)
vo: What's this cell *carrying*? Room for about a *billion* passengers. {c1,c2}

## normal {shot: push into the cut, then the iris to one hemoglobin · labels: hemoglobin, iron · energy: 0.45} (5–16 s)
vo: It's packed with one protein, *hemoglobin*: about two hundred and seventy million copies. {c3}
Each one has four iron atoms, and each can hold an *oxygen*. {c4}

## change {shot: one hemoglobin fills, four O₂ boarding one by one, each sooner; garnet to crimson · label: O₂, white with its glyph and ring · energy: 0.55} (16–27.5 s)
vo: Watch one fill. {-} The first oxygen struggles to board, but each one makes the next one
*easier*. {c5} Dark red at the start; full, it's *bright* red. {c6}

## why {shot: a vein under a slab of skin; red light sinks to the vein, blue bounces back near the surface · badge: illustration · picture-only 2.5 s · energy: 0.55} (27.5–42.5 s)
vo: Your veins look *blue*, so it's easy to guess the blood inside them is. {c7} It never is. {c8}
Returning blood is darker red. {c9} Red light sinks in, and the vein swallows it, so less red comes
*back*. {c10}

## whoa {shot: reveal pull from the vein to the body's loop, then a lung capillary: dark cells flush bright on contact with the air sac, slowed, a 0.25 s counter · picture-only 3.5 s · energy: 0.7} (42.5–55 s)
vo: Your heart sends your blood back through your lungs about *once a minute*. {c11} There, the
empty seats fill. {c12} In about a *quarter of a second*. {c17}

## takeaway {shot: the lung capillary pulled back: darker cells arrive, bright cells leave · energy: 0.5} (55–62 s)
vo: The blue is your skin's trick. {c13} The red is a passenger *count*: brighter means fuller
seats. {c14}

## meanwhile {segment: meanwhile · tally "while you watched": millilitres of oxygen your blood handed out, 250/60 × t from frame 0, on the pulse line · mallet ticks on the lub-dub · energy: 0.45} (62–67.5 s)
vo: *Meanwhile*, as you watched, your blood handed your body about a cup of oxygen. {c15}

## tease {shot: a nerve fibre in the dark, a spark at one end · end card held ≥ 2 s · signature: thump E♭2, thump B♭2 +0.4 s, mallet G5 +1.2 s · energy: 0.4} (67.5–74.5 s)
vo: Next: the signal in your nerves. {-} In the fastest, it doesn't crawl; it *jumps*. {c16}
end card: "Next: The jump" · "Meanwhile, Inside · No. 03"

## Notes
- The tally counts from frame 0 at 250 mL a minute (a resting adult). The line lands near 62 s,
  when it reads about 258 mL: "about a cup" (a US cup is about 237 mL, a metric cup 250 mL). If
  the beats move by more than 8 s, reword it.
- "Never blue": venous blood at rest still carries most of its oxygen; the line says "darker red",
  not "empty".
- Every claim was checked through search excerpts only; see `claims.json`. A person opens each
  link before posting.
- Listen at T0: hemoglobin (British: hee-muh-GLOH-bin), millilitres on screen only.
- TODO: the handle, a physiologist's sign-off, and the AI-voice label in the post.
