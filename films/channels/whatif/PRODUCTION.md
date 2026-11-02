# Back of the Envelope: production log (season 1)

Branch `claude/back-of-the-envelope-s1` (from `claude/made-with-claude-film`). Six 60–75 s vertical episodes and
one long video (vol01 = episodes 1–5). One line per episode, updated as it moves:
scripted → voiced → built → stills OK → draft → reviewed → final → delivered (+ QA numbers).

| No. | Title | State |
|---|---|---|
| 001 | Through the Earth | **final** (QA PASS, −14.1 LUFS, −1.6 dBTP), hand-off docs written (2 Nov) |
| 002 | Everyone, one place | **final** (QA PASS, −14.1 LUFS, −1.5 dBTP) after five review rounds; hand-off docs written (2 Nov) |
| 003 | All the ants | passed review round 5 (a4 b4 c4 d4 e5 f4 g4); final rendering on the render worker (cdad9d3) |
| 004 | Count to a billion | **final** from the second builder (merged at c2568b6) |
| 005 | Everybody jump | second builder: final rendering |
| 006 | Every raindrop at once | second builder: rendering |

## Log

**27 Oct — channel set-up.**
- Narrator auditions (`auditions/`): am_puck, bm_fable, af_kore read the episode-1 hook and an explanatory
  line through one chain; measured pace, pitch range and the aligner's hearing. Recommended am_puck (most animated
  intonation); bm_fable the alternative. The owner decides; episodes are voiced with am_puck until then.
- Bible (`bible.md`): graphite and marker; Bricolage Grotesque / Figtree / JetBrains Mono (+ Caveat for scribbles);
  the boxed answer; "Show your work"; D lydian at 90 BPM, pizzicato and pencil; six episodes ranked.
- `theme.json`: `contrast.py whatif` 0 fails, 0 warnings. The first ground (`#131417`) sat ΔE76 4.7 from Los Güeros'
  espresso (fail under 5): moved to `#171A1E`; the plate went to 95% so the spoken word keeps 4.5:1 over the
  brightest part of the model.
- Fonts (`fonts/SOURCES.md`): the four OFL families from `google/fonts` at a pinned commit, sha256 recorded.
- Kit changes (`KIT-CHANGES.md`): studio voices `pluck` and `scratch`, preset `envelope-working`, three event rows;
  Rest Frame 001's soundtrack byte-identical before and after.

**27 Oct — No. 001, Through the Earth.**
- `calc.py`: PREM density (Dziewonski & Anderson 1981) integrated for g(r) and the fall time: 2,290.6 s
  (Klotz 2015: 38 min 11 s = 2,291 s); PREM's mass comes out within 0.02% of NASA's. Uniform Earth 2,530 s
  (42 min 10 s), constant g 2,281 s; core ±10%: 39 / 37 min (the sensitivity line); top speed 9.9 km/s.
- Script: lint clean (172 words); the hook was rewritten twice for pace (am_puck reads short lines fast).
- Voice: one Kokoro call per sentence with a measured pause (Meanwhile, Inside's method, `voice.py`), so the hook's
  question lands at 1.83 s and every line runs 2.5–2.9 words/s; 74.0 s laid out on the 90 BPM grid.
- Picture: four animatic still passes (fixes: a three-quarter view so the model reads as a half-sphere, hook notes
  moved off the title band, a backdrop dome instead of the raw clear colour, the gravity profile moved off the cut
  face onto its own panel beside the model, counters on plates, the ruler square to the camera).
- Sound: sync PASS on every kind; −14.1 LUFS / −1.6 dBTP on the AAC; music 12.9 LU under the voice (raised from
  26 LU, which left the bed nearly inaudible; the siblings sit at 12.1–12.5).

**30 Oct — the Flow standard and the re-score.**
- The coordinator flagged that D lydian at 90 BPM is exactly Lumevina's Skin School score (its 18:02 message on
  27 Oct reached this session only at the pause). Re-scored to **A lydian at 50 BPM** (a 16th = 9 frames; no
  channel or Lumevina uses it; the slow pulse suits the new tone): preset, bible §3, theme motif, signature plucks
  A4, E5, D♯5 at 0, +9, +18 frames. Sync PASS; music 13.6 LU under the voice.
- The owner's new standard (`WRITING.md` "Flow", `lint.py` from 663408e): ep01 rewritten as one thread. The voice
  says four figures (days, ten kilometers a second, forty-two and thirty-eight minutes); the running sum, labels,
  the show-your-work card and the end-card footnote carry 12,700 km, 100 km/h, Klotz 2015, 76 min, 39 and 42.
  The segment is woven in ("Lighten that core in the sum…"), and the last line calls back to the hook ("a fall
  through the Earth … a way of weighing its heart"). Lint: 0 errors, no flow warnings.
- Re-voiced slower (am_puck, Kokoro 0.6–0.86 per sentence, 0.38 s pauses, 0.6 s after a question): 74.4 s on the
  50 BPM grid, every line 2.4–2.9 words/s, hook question at 1.69 s. Claims ledger re-pointed to the new sentences
  (same 13 claims; notes say where each figure now appears on screen).
- Draft review round 1 (`ep01/review/REVIEW-ROUND1.md`): 10 confirmed findings (framing, notes and labels over the
  model, a camera pop, orphan caption pages, picture/voice timing, clipped voice files); all fixed and checked in
  stills. Sound re-rendered: sync PASS. Final render started 05:02 (detached, chunked, resumable).

**30 Oct – 2 Nov — full speed; the compelling pass.**
- The owner approved the Flow style and am_puck. A second builder (branch `claude/back-of-the-envelope-s1-b`) took
  episodes 4–6; a render worker (`-render-a`) renders finals from committed jobs. Paused 30 Oct–2 Nov by the owner.
- Every review now adds a compelling pass (seven lenses scored 1–5; anything under 4 is fixed before the final;
  each episode must score at least as well as the last). Ep01's middle stayed on one composition too long (the
  coordinator's note); the lesson, applied from No. 002: change scale or framing with every new idea.
- No. 002 (you → the crowd at true scale → Greater London → the planet → the cube beside the tower → you): two
  review rounds. Round 1, 10 findings (the cube read taller than the tower through perspective, a stale running sum,
  the work card over the cube, three pops, a flash cutting to the globe, a flat field, label collisions); round 2,
  5 left plus the cube too small; the fixes include people gathering round you from frame 0 (the hook's motion),
  a textured crowd field, a short work card, and the cube's front face beside the tower. Scores after round 2:
  a3 b4 c3 d4 e5 f4 g4 (round 3 pending).
- No. 003: Wilson & Hölldobler's 1994 "ants weigh as much as us" against Schultheiss et al. 2022 (twice the ants,
  a fifth of our carbon); a pan balance whose beam leans with the story. A kit bug surfaced here: `numerals.py`
  turned "two and a half million" into "2.5" (fixed additively, see KIT-CHANGES.md).
- New shared set pieces (additive; ep01 renders identically): `crowd.js`, `tower.js`, `balance.js`; `desk.js`
  takes an optional `span` (the floor and dome grow for shots far above the paper).
- 2 Nov, later: No. 002 round 3 scored a4 b4 c3 d4 e5 f4 g4. A slow orbit over the crowd (21–43 s) is aimed at
  lens c, and round 4 is in review. No. 003 round 1 scored a2 b4 c2 d3 e5 f4 g3. Its round 2 fixed the flicker
  and six other findings, but the reviewer found the new hook and the "each" shot unreadable. Round 3 changes:
  - a wide, low lens behind a larger ant, with the whole balance beyond; the loop lands on the same framing;
  - the fingertip side-on and labelled;
  - a to-scale carpet of your 2.44 million ants (5 mm apart, a 7.8 m square), from your feet up to the whole
    square.
  `crowd.js` now centres its square on its group. The output is unchanged at the origin, which is where No. 002
  uses it.
- 2 Nov, night: No. 001 final merged from the render worker (QA PASS, −14.1 LUFS, −1.6 dBTP, 0 flashes) with its
  hand-off docs. No. 002 passed review round 5 (a4 b4 c4 d4 e5 f4 g4) after the 828 m rule over the cube; its
  final is with the worker. No. 003 passed review round 5 (a4 b4 c4 d4 e5 f4 g4) after five rounds. The hook was
  rebuilt as a broadside balance beyond a walking ant, and the "each" beat as a to-scale ant carpet seen top-down,
  then rising to you. Its final is queued behind No. 002. Kit: `CINEMA.holdCuts` (opt-in, cinema3d.js).
  Season title from the coordinator: "Impossible, worked out" (vol01 --title/--thumb).
