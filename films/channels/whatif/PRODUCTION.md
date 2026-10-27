# Back of the Envelope: production log (season 1)

Branch `claude/back-of-the-envelope-s1` (from `claude/made-with-claude-film`). Six 60–75 s vertical episodes and
one long video (vol01 = episodes 1–5). One line per episode, updated as it moves:
scripted → voiced → built → stills OK → draft → reviewed → final → delivered (+ QA numbers).

| No. | Title | State |
|---|---|---|
| 001 | Through the Earth | built; animatic stills OK; draft rendering (27 Oct) |
| 002 | Everyone, one place | bible |
| 003 | All the ants | bible |
| 004 | Count to a billion | bible |
| 005 | Everybody jump | bible |
| 006 | Every cat at once (backup: every raindrop at once) | bible |

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
