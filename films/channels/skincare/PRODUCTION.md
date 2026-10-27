# Outer Layer: production log (season 1)

Branch `claude/outer-layer-s1` (from `claude/made-with-claude-film`). One line per episode, updated as it moves:
scripted → voiced → built → draft reviewed → final → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | The dead layer | §7 #1 | scripted, lint clean (175 words); voiced (bf_isabella, per-line speed 0.76–0.95), 74.2 s on the grid, lint clean; compile.py + scene built; draft stills under way (to fix: the thin wall must read thinner in the whoa, the to-scale card sits over the section and its paper label under the captions, dermis fibres alias, the climber needs to win its frames) |
| 002 | Does SPF 100 beat SPF 50? | §7 #2 | planned |
| 003 | Bath fingers | §7 #3 | planned |
| 004 | What a tan is | §7 #4 | planned |
| 005 | Same cells, every colour | §7 #5 | planned |
| 006 | Goosebumps | §7 #6 | planned |
| vol01 | Long video (episodes 1–5) | | planned |

## Log
- **27 Oct, block 1.** Bible, fonts (Newsreader, Red Hat Text, Red Hat Mono; OFL), theme.json (contrast.py: 0 fails;
  the first accent, `#6A2FD0`, sat ΔE00 3.2 from Rest Frame's wave violet and was moved to `#9135A8`; water moved to
  `#00685F`), narrator auditions (af_nicole, bf_isabella, am_fenrir; recommended bf_isabella), episode 1 script, claims
  (14, all search excerpts) and voice; the `pluck` voice and the `outerlayer-slide` preset (KIT-CHANGES.md).

- **27 Oct, block 1 (cont.).** Episode 1 compile.py (shots hook · section · walls · gauge · close; the climb at 300,000×;
  10 labels, 8 notes, 6 spine values; 30 caption pages, numbers glued to their units) and the first scene: the procedural
  section (`set/section.js`, three tones across the episode), the climbing cell, water beads, two walls for the whoa,
  the depth gauge projected from the section so its µm marks are true to the picture (`set/motif.js`). Fixed in
  stills: the camera sat inside the block (distances ×2.6), clipping planes ignored a block's offset (the two walls
  were cut to one window), the gauge read the safe box as fractions.

## Questions (for the owner, through the coordinator)
- Narrator: bf_isabella recommended (auditions/README.md); carrying on with it until told otherwise.
- Channel colour in Prism Studio: the catalogue's placeholder `#D99A92` is a dusty rose close to Lumevina; proposed `uv` `#9135A8`.
