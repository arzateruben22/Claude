# ep07 clarity and pacing review (STANDARDS-v2, section 1, 5, 6)

S2E01 (folder ep07)

Tool: `kits/cinema/script/lint.py` (from made-with-claude-film 3108849). Run 8 Nov 2026 after the last script edit.
Result: 0 errors; whole script grade 3.0 (target 7 or below); no sentence over 22 words (longest: 20).
Lint is a guide: it is blind to the pictures and to how a number sounds. The real test is reading it aloud once.

## Reading grade per beat (Flesch-Kincaid, lint's own formula)
| beat | grade | note |
|---|---|---|
| hook | -0.3 | one question, 7 words |
| normal | 4.2 | longest beat for a new idea: thirty Earths |
| change | 1.8 | three short sentences |
| why | 1.8 | three short sentences |
| whoa | 5.9 | the two big numbers |
| work | 3.8 | sensitivity |
| takeaway | 3.7 | Apollo |
| tease | 5.0 | |
All beats are under the limit of 8. Several grades are low because the sentences are short; the grade says nothing about whether a figure lands.

## Lines rewritten for a sixth grader, and why
- Change: "Walk at an easy pace ... and you arrive in about nine years" was one 25-word sentence (grade 8.3). Now three: "Walk at an easy pace, the kind you could chat through. Never stop, not even to sleep. You would arrive in about nine years." It says what an easy pace is in the same breath.
- Whoa: dropped "every day" and "instead" (31 to 30 words) so the two figures are not buried.
- Normal: "five kilometers an hour" and "three hundred eighty-four thousand kilometers" moved onto the screen (spine and counter). The voice says "about thirty Earths away", a comparison a listener can picture. This follows the Flow rule: the voice carries four figures (30, 9, 26, 140), the screen carries the rest.
- Hook: the question is first and short (1.6 s); the second sentence ("Starting at your own front door") is slowed so the hook reads at 2.7 words/s.
- "Popular daily step goal" replaces "ten thousand steps": the number is on screen as a label, the voice says what it is.

## Moments tightened or cut
- First draft had a sentence naming the Moon's distance in kilometers; cut, because the spine shows it.
- The "why" beat of the first draft was thin (18 words, two ideas); it is now three short sentences, one idea each (nobody walks day and night; you sleep, eat, stop; so a working day).
- Open: the whoa beat still holds two big numbers back to back (26 and 140). If the reviewer finds it overwhelming, move 140 to the work beat.

## Review round 1 changes (9 Nov 2026)
- Script: the 140 moved to the work beat with its reason ("ten thousand steps a day ... is only about seven and a half kilometers", against 40 km a day), so 26 and 140 are no longer spoken back to back; "years" is said after 140; "Apollo eleven's crew" replaces "The Apollo crews"; the quarter-century line and the shoes line were cut (runtime 72.0 s).
- Picture: shaded 3D Earth and Moon, a blue walker figure in stop-and-go steps (8 hours a day: it stops to sleep, eat, tie a shoe), a camera pan up the line in the normal beat, labels staged one at a time, the work card's sum on one line, the end card showing "≈ 26 years" with the line cleared, and the last frame equal to frame 0.
- Claims: c4, c6, c8, c10 relabelled as calculations; c5 as an assumption; the Bohannon link removed from them; the footnote names "NASA Science, Moon Facts".

## Review round 2 changes (9 Nov 2026)
- Layout rebuilt for the whole 9:16 frame: a dive from the wide view onto each walker and a chase, with big figures (13% of the frame) low in it, the Earth and the Moon big at the start and the arrival, star dust for depth, and three vignettes at the stops (bed, table, shoe, timed to "sleep", "eat" and "shoe"). Camera moves at 10.5 s (pan up the line), 17 s and 31 s (a swing round the walker) and 62 s (a push in toward the Moon).
- The 10,000-step label holds until "a hundred and forty"; the counter is hidden while the work card is up, so nothing overlaps; the nonstop label is a badge so it no longer overlaps the Moon label; the lone "≈" at 24.5 s is gone (the "≈" and its figure are now one term).
- The end is a calm hold on frame 0's picture. Frame 0 is now the bare picture (the title, badge and label arrive at 0.3 s), so the loop's whole-frame PSNR is 50.8 dB.
- 41 to 52 s: the work beat now pushes in on the walkers at the Moon as 'slower adds years' is spoken (a time clock pops in as 'quicker' is spoken), pulls back to the lanes at the step-goal line, and follows the step walker up its lane. Vignettes sit on short chalk ledges.
- Runtime is 72.0 s. c5's `source_url` in the ledger must be a web address for the linter (it errors on "none"); the table prints "none (assumption)".

## Status (9 Nov 2026)
- Word timings: aligned with the owner-approved Parakeet pin (8 word ends clamped to the pauses). `film.json` is built from real timings.
- Draft render: `out/envelope-s2e01-9x16-draft.mp4` (540x960, 15 fps, 72.0 s, AAC -14.1 LUFS / -1.8 dBTP, sync PASS), 0 audit warnings. Final not rendered, awaiting the gate.
- Sources: five of nine claims read by the builder (SOURCE-READ); none OK until a person opens it.
- Rhythm: see scene-table.md for the two stretches that run longer than 4 s between distinct changes.
