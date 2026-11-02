# Outer Layer: production log (season 1)

Branch `claude/outer-layer-s1` (from `claude/made-with-claude-film`). One line per episode, updated as it moves:
scripted → voiced → built → draft reviewed → final → delivered (+ QA numbers).

| No. | Title | Bible | State |
|---|---|---|---|
| 001 | The dead layer | §7 #1 | **Final** (render worker A, 00a50fc): 73.73 s, −14.1 LUFS / −1.8 dBTP, 1 flash, QA PASS; master 62.6 MB, YouTube 1440 84 MB. Compelling 3 rounds → all 4s. First final (57f42c4) withdrawn: gauge headings ran together |
| 002 | Does SPF 100 beat SPF 50? | §7 #2 | **Final** (render worker B, 8f65176): 70.0 s, −14.1 LUFS / −1.9 dBTP, 0 flashes, QA PASS; master 53.6 MB, YouTube 1440 79 MB. Compelling 4 rounds → all 4s |
| 003 | Bath fingers | §7 #3 | **Final** (Back of the Envelope worker A, ba052e4 from b02282b): 70.0 s, −14.1 LUFS / −2.0 dBTP, 0 flashes, QA PASS (text audit clean); master 19.7 MB, YouTube 1440 30.9 MB. Compelling 4 rounds → all 4s |
| 004 | What a tan is | §7 #4 | second builder (`claude/outer-layer-s1-b`): drafts in review |
| 005 | Same cells, every colour | §7 #5 | **Final** (second builder, de90651): 72.8 s, −14.1 LUFS / −1.9 dBTP, 2 flashes, QA PASS; master 47.1 MB, YouTube 1440 63 MB |
| 006 | Goosebumps | §7 #6 | **Final** (render worker A, f039cde): 74.20 s, −14.1 LUFS / −2.4 dBTP, 4 flashes (QA PASS; under the per-second limit, listed for the flash-analyzer check), master 27.6 MB, YouTube 1440 42 MB. Taken over from the second builder; compelling 4 rounds → all 4s; tease placeholder (season 2 topic) |
| vol01 | Long video (episodes 1–5) | | planned |

## Log
- **27 Oct, block 1.** Bible, fonts (Newsreader, Red Hat Text, Red Hat Mono; OFL), theme.json (contrast.py: 0 fails;
  the first accent, `#6A2FD0`, sat ΔE00 3.2 from Rest Frame's wave violet and was moved to `#9135A8`; water moved to
  `#00685F`), narrator auditions (af_nicole, bf_isabella, am_fenrir; recommended bf_isabella), episode 1 script, claims
  (14, all search excerpts) and voice; the `pluck` voice (later replaced for this channel by `reed`) and the `outerlayer-slide` preset (KIT-CHANGES.md).

- **27 Oct, block 1 (cont.).** Episode 1 compile.py (shots hook · section · walls · gauge · close; the climb at 300,000×;
  10 labels, 8 notes, 6 spine values; 30 caption pages, numbers glued to their units) and the first scene: the procedural
  section (`set/section.js`, three tones across the episode), the climbing cell, water beads, two walls for the whoa,
  the depth gauge projected from the section so its µm marks are true to the picture (`set/motif.js`). Fixed in
  stills: the camera sat inside the block (distances ×2.6), clipping planes ignored a block's offset (the two walls
  were cut to one window), the gauge read the safe box as fractions.

- **27 Oct, end of block 1 (PAUSE).** The coordinator's notes applied: studio colour `water` `#00685F`; the channel's
  voice is now a breathy `reed` (plucks are Back of the Envelope's); my `pluck` reverted from the kit so the branches
  merge cleanly; `qa.py` measures the reed by its rise. Ep01 mix: AAC −14.1 LUFS / −1.7 dBTP, music 15 LU under the
  voice; sync passes on every kind but one label whose picture time was stale (cues being re-measured).
  **Next:** re-run `--cues` → compile → mix until sync PASS; fix the open still items; draft render; independent review.

- **30 Oct (WIP at PAUSE).** Ep01 rewritten to Flow, voiced (bf_isabella, 0.70–0.86), lint clean, sync PASS
  (−14.1 LUFS / −1.9 dBTP); draft cut assembled (out/outerlayer-001-9x16-draft.mp4, not committed). **Next:** independent
  review of the draft → fixes → send the final to the render worker. Ep02 script + claims lint clean, not yet voiced.
  Second builder (ep04–06, `claude/outer-layer-s1-b`) and render worker (`claude/outer-layer-s1-render-a`) are set up.

- **2 Nov.** The owner's compelling pass added to every review (seven scores, a ratchet: each episode at least as good as
  the last). No. 001 through three rounds to all 4s; No. 002's first review fell below and was reworked (fewer spoken
  figures, short landings, the shield callback; countable trails for "2 against 1"; match moves at every cut). Channel
  rule: one skin tone per episode's world, rotating (bible §1); the owner approved it ("OK", 2 Nov ~03:10 UTC), with
  No. 005 the exception that shows all tones together. Kit: `pluck` reverted for Back of the Envelope; `reed`
  voice; `qa.py` measures it by its rise. Shared set: flakes, rays/film/trails, wrinkle/vessels/water, gauge film bar
  and span past 110 µm, opt-in `mortarFloor`. A second builder (ep04–06) and a render worker (finals) joined.

## Questions (for the owner, through the coordinator)
- Narrator: bf_isabella recommended (auditions/README.md); carrying on with it until told otherwise.
- Channel colour in Prism Studio: the catalogue's placeholder `#D99A92` is a dusty rose close to Lumevina; set by the coordinator to `water` `#00685F`.

- **2 Nov, ~04:15 UTC.** Rebalance: No. 006 taken over from the second builder (its script, claims, voice and first
  set merged at a8f4314); light tone (rotation), whole-follicle framing, round-1 review 3/4/2/2/3/3/3, reworked
  (63217b9). No. 002 round 3: 4/4/3/3/4/4/4 (gauge values had vanished: a statement hidden behind a comment in
  `set/motif.js`, fixed; cuts matched), round 4 rendering. No. 003 round 2: 3/4/3/3/4/4/4, reworked (domed pads, cheek
  bar via an opt-in `cheek` in `set/motif.js`, matched cuts), round 3 queued. Owner approved one tone per episode.
