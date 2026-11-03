# Body Backstage No. 01: "Single file" (season 1 reboot, live scan; a physiologist signs off before it posts)

About 71 s, 9:16, narrated by a synthetic voice (bf_emma, labelled as AI), with an original score.
Built from the bible's episode-1 script (`../bible.md`, §8) with every fix from the cross-check
(`../../crosscheck.json`) applied:

- "most of the cells in your body" is now "most of your own cells" (bacteria outnumber red cells
  if microbes count).
- The unsupported "only about half its width" [S3] is replaced by a sourced figure: red cells pass
  microvessels about 3 µm wide, less than half of a 7.5 µm cell (Rochester BME).
- The ride-along is shown slowed ×10 with a badge, at most 3 s, with no motes near the lens.
- The locator is a 2D body silhouette in the HUD, not a mannequin; O₂ is labelled white with its
  glyph and ring.
- Added the channel's recurring segment, the "Meanwhile" tally (DECISIONS.md).

One line per beat. `*starred*` words get a camera landing or a sound hit. `{…}` in a heading is
direction for the compiler. In a vo line, `{c1,c2}` after a sentence ties it to `claims.json` and
`{-}` marks a sentence that states nothing outside the film; neither is spoken. Check it with
`python3 -I kits/cinema/script/lint.py films/channels/body/ep01 --segment meanwhile`.

Reboot (3 Nov 2026): every line rewritten the way a friend would say it (no "micrometers", "erythrocyte" or bare
counts; comparisons and plain words), the claims unchanged. The picture is the live-scan look (../looktest).

## hook {shot: macro; frame 0 is the hero cell folded into a parachute in a capillary · title: "Single file" · pre: 0.1 · energy: 0.7} (0–5.6 s)
vo: How does this cell *fit*? {-} Its pipe is *narrower* than it is. {c1}

## normal {shot: craneBack to the hero cell in an artery · locator: 2D body silhouette in the HUD, the region marked by a chartreuse pulse-line blip on the beat (no ring: body has no circles) · labels: red blood cell, no nucleus · energy: 0.45} (5.6–17.6 s)
vo: Each one is a *dented disc*, pressed in on both sides. {c2} It even threw out its own *nucleus*. {c3} And they outnumber all your other
cells put together. {c4}

## change {shot: rideAlong as the vessel branches and narrows, slowed ×10 with a "slowed ×10" badge, at most 3 s, no motes within two cell widths of the lens · label: capillary · energy: 0.5} (17.6–26.8 s)
vo: Follow one as the pipes split, and split again, into the *tiniest* ones. {c5} There's no room to pass, so
they go in *single file*. {c6}

## why {shot: slow push; fold, slide, spring back · picture-only 2.5 s · energy: 0.55} (26.8–38 s)
vo: You'd guess its skin stretches to fit. {-} It barely does. {c7} That *dent* gives it spare skin, so it folds up neatly
like a *parachute* instead. {c8,c9}

## whoa {shot: pullBack to a capillary net, every cell in single file · non-circular iris (membrane blob or vertical wipe) + scale pill "3 µm" · picture-only 3.5 s · energy: 0.7} (38–51.2 s)
vo: The tightest squeeze is less than *half its width*. {c10} And it does this its whole life, over
and over, for about *four months*. {c11}

## takeaway {shot: the cell pops out and springs back to a disc; on "jam" the camera looks back down the capillary, where a stylised crescent sickle cell (label "sickle cell", badged "illustration") is lodged · label: O₂, white with its glyph and ring · energy: 0.5} (51.2–58.8 s)
vo: Sickle cells lose that *dent*, stiffen, and can jam where oxygen gets dropped off. {c12,c16} That dent
has a job. {c17}

## meanwhile {segment: meanwhile · tally "while you watched": new red cells, 2,000,000 × t from frame 0, on the pulse line · mallet ticks on the lub-dub · energy: 0.45} (58.8–64.8 s)
vo: *Meanwhile*, as you watched, your bones made over a hundred million new ones. {c13}

## tease {shot: push into the cell · end card held ≥ 2 s · signature: thump E♭2, thump B♭2 +0.4 s, mallet G5 +1.2 s · energy: 0.4} (64.8–71.6 s)
vo: Next: what this cell *carries*. {-} Room for about a billion passengers. {c14,c15}
end card: "Next: A billion passengers" · "Body Backstage · No. 02"

## Notes
- The tally counts from frame 0 at 2 million a second (MedlinePlus). The line lands at about
  59 s, when it reads about 118 million, so "over a hundred million" holds while the line starts
  after 50 s. If the beats move earlier than that, reword it.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0 (bf_emma reads British English): micrometers (MY-kroh-mee-terz, the unit, not the
  gauge), capillary (kuh-PIL-uh-ree is fine in British English), nucleus, marrow.
- TODO: the handle, a physiologist's sign-off, and the AI-voice label in the post.
