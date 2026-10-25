# Rest Frame: production log, episodes 2–6

Branch `claude/rest-frame-ep02-06`. One line per episode, updated as it moves. The process for each episode is
episode 1's (`ep01/README.md`), plus the picture rules added to `kits/cinema/script/WRITING.md` on 24 Oct ("The
picture: what the best references do"), which apply from episode 2 on:

1. One world, few cuts: camera moves, cuts on a sound.
2. A spine readout: one number on screen the whole episode, its label naming the beat.
3. A human-scale anchor at least once.
4. Every beat changes the picture.
5. One idea per caption line.
6. The last frame hands back to frame 0 (a seamless replay); one true-fact footnote on the end card.
7. The score builds with the escalation and drops for the reveal.

Priority (coordinating session, 25 Oct): episodes 2–5 first, for the vol01 compilation; episode 6 after episode 5
is delivered. Commit and push at every milestone (script and voice locked, compile passing, animatic checked, final
delivered).

## Episodes

| # | Title | State |
|---|---|---|
| 02 | The swing's secret | scripted · reviewed (7/10; fixes applied) · voiced (172 words, 71.7 s; lint 0 errors before and after) · built · stills OK · **rendering** (final, started 22:21 UTC 25 Oct) |
| 03 | Where does the bounce go? | scripted · reviewed (7/10; fixes applied: "squashes flat", "motion doesn't vanish", "never loses energy" corrected) · voiced (153 words, 66.9 s; lint 0 errors before and after) · compile and scene written; animatic waits for ep02's final (one Chromium job) |
| 04 | The hammer and the feather | scripted · reviewed (6.5/10; fixes applied: wrong takeaway, MICROSCOPE dates 2016–18, "a few parts" in 10¹⁵) · voiced (166 words, 72.0 s; lint 0 errors before and after) · compile and scene written |
| 05 | The spinning chair | scripted (lint 0 errors) · in review · set: spin model (`spin.js`, checked against its port and a brute integral) and the chair with a mannequin (`chair.js`) |
| 06 | The ten-metre straw | — (after 05 is delivered) |

## New in the channel set (`set/`)

- `swing.js`: B6, the exact simple pendulum (Jacobi elliptic functions by the AGM), plus a mass on a spring.
  Checked against a numeric integration: under 1e-9 rad at 10°, 30° and 80°.
- `pendulum.js`: the gantry prop (beam, post and arm, clamps, ink strings, brass bobs), for any number of pendulums.
- `bench_py.py`: the Python ports the compilers share: `Clock` (clock.js, copied from ep01's compiler),
  `Pendulum` (swing.js) and `Spinner` (spin.js).
- `ink.js`: line drawings standing in the set (a hand, Joule's paddle-wheel apparatus; helpers for more).
- `balls.js`: a basketball and the closed-form stacked drop (perfect or lossy bounces).
- `moon.js`: the bible's Moon dressing (a regolith floor faded in over the paper cyc), a geological hammer, a falcon feather.
- `spin.js`: a spin whose moment of inertia changes, angular momentum conserved.
- `chair.js`: a swivel chair with a seated wooden mannequin holding two dumbbells (two-bone IK arms).

## Kit changes

None so far (`KIT-CHANGES.md`).

## Questions

None yet. Choices taken provisionally from the bible are marked in each episode's HUMAN-REVIEW.md.
