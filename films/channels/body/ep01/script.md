# Meanwhile, Inside No. 01: "Single file" (draft; a physiologist signs off before it posts)

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

## hook {shot: macro; frame 0 is the hero cell folded into a parachute in a capillary · title: "Single file" · pre: 0.1 · energy: 0.7} (0–5.5 s)
vo: Why is this cell *folded*? Because the road ahead is *narrower* than the cell. {c1}

## normal {shot: craneBack to the hero cell in an artery · locator: 2D body silhouette in the HUD, the region marked by a chartreuse pulse-line blip on the beat (no ring: body has no circles) · labels: red blood cell, no nucleus · energy: 0.45} (5.5–17 s)
vo: Meet a *red blood cell*: a disc about seven micrometers across, dimpled on both sides, with
*no nucleus*. {c2,c3} You have about twenty-five trillion of them: most of your own cells. {c4}

## change {shot: rideAlong as the vessel branches and narrows, slowed ×10 with a "slowed ×10" badge, at most 3 s, no motes within two cell widths of the lens · label: capillary · energy: 0.5} (17–27.5 s)
vo: Now follow it as the vessel branches, and branches again, into a *capillary*. {c5} The
narrowest are slimmer than the cell, so cells go through in *single file*. {c6}

## why {shot: slow push; fold, slide, spring back · picture-only 2.5 s · energy: 0.55} (27.5–39 s)
vo: Here's the trick. The *dimples* give it spare surface for its volume, so it can fold into a
*parachute* without stretching. {c7,c8,c9} Squeeze, slide, spring back.

## whoa {shot: pullBack to a capillary net, every cell in single file · non-circular iris (membrane blob or vertical wipe) + scale pill "3 µm" · picture-only 3.5 s · energy: 0.7} (39–52 s)
vo: The tightest are about three micrometers: less than *half its width*. {c10} And it squeezes
through them for its whole life: about *a hundred and twenty days*. {c11}

## takeaway {shot: the cell pops out and springs back to a disc · label: O₂, white with its glyph and ring · energy: 0.5} (52–59 s)
vo: So that dimple isn't decoration. It gets your blood through your *smallest vessels*, where
oxygen is handed out. {c12}

## meanwhile {segment: meanwhile · tally "while you watched": new red cells, 2,000,000 × t from frame 0, on the pulse line · mallet ticks on the lub-dub · energy: 0.45} (59–65 s)
vo: *Meanwhile*, as you watched, your bone marrow made over a hundred million new red cells. {c13}

## tease {shot: push into the cell · end card held ≥ 2 s · signature: thump E♭2, thump B♭2 +0.4 s, mallet G5 +1.2 s · energy: 0.4} (65–71.5 s)
vo: Next time: what this cell is *carrying*. About a billion passengers. {c14,c15}
end card: "Next: A billion passengers" · "Meanwhile, Inside · No. 02"

## Notes
- The tally counts from frame 0 at 2 million a second (MedlinePlus). The line lands at about
  59 s, when it reads about 118 million, so "over a hundred million" holds while the line starts
  after 50 s. If the beats move earlier than that, reword it.
- Every claim was checked through search excerpts only (the proxy blocks page fetches); see
  `claims.json`. A person opens each link before posting.
- Listen at T0 (bf_emma reads British English): micrometers (MY-kroh-mee-terz, the unit, not the
  gauge), capillary (kuh-PIL-uh-ree is fine in British English), nucleus, marrow.
- TODO: the handle, a physiologist's sign-off, and the AI-voice label in the post.
