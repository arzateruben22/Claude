# Scorecard: Body Backstage No. 03, "The jump" (DRAFT round 3, 4 Nov 2026; not a final)

This is the draft cut, not a delivered final. Nothing here was measured on a final file; the numbers come from the
studio's own QA on the draft mix and from the compile/lint gates. The final tier has not been rendered.

| Gate | Target | Draft result |
|---|---|---|
| Format | draft preview 540×960, 15 fps, H.264 + AAC | as rendered (`review/preview-ep03.mp4`) |
| Length | 60–75 s; picture = sound | 74.4 s (film.json `dur`), end card 3.0 s |
| Script lint | 0 errors | `lint.py --segment meanwhile`: 0 errors, 1 warning |
| Hook | question by 2 s; a surprise early | "As fast as light?" ends about 1.2 s; "An expert once thought so." ends 3.5 s |
| Loudness (draft mix) | −14 LUFS, ≤ −1 dBTP on the AAC | about −14.1 LUFS, about −1.8 dBTP (studio master.json) |
| Voice over music | ≥ 10 LU | about 15.7 LU (studio qa.json) |
| Sync | within a frame | studio sync PASS |
| Claims | every sentence sourced; model figures marked | c1–c21; c21 ("34 vs 4") is a computation, basis: model |

Not run for this draft: `qa.py` (delivery), flashing, safe-box audit on a final, `youtube1440.py`. Scores (a)–(h) are the
independent reviewer's, not recorded here.
