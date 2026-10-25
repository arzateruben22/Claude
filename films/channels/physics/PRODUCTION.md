# Rest Frame: production log, episodes 2–6

> **Paused by the user at 23:25 UTC, 25 Oct.** Nothing is rendering. To resume, in order:
> 1. ep03 final: `kits/cinema/film/run.sh films/channels/physics/ep03 --tier final` (about 45 min, detached; check with
>    `ps -eo args | grep "[r]ender.mjs"`, resume with a bare `run.sh <dir>`). Then `render.mjs --film <dir> --tier final
>    --assemble --audio <dir>/build/audio/mix.wav`, copy the contact sheet to `out/rest-frame-003-9x16-contact.jpg`,
>    `qa.py`, `scorecard.py --log <dir>/build/final/9x16/render.log`, `claims_sheet.py` (add the footnote row from
>    `footnote-claim.json`), then scorecard.md, assets.md, HUMAN-REVIEW.md and README.md as in ep02.
>    `build/` is not committed: on a fresh container, re-run `compile.py`, `render.mjs --cues`, `compile.py` and the
>    studio render first (the voice is committed).
> 2. ep04: animatic (`render.mjs --film films/channels/physics/ep04 --tier animatic`), fix what it shows, cues, soundtrack,
>    stills, final, paperwork.
> 3. ep05: write `compile.py` and `scene.mjs` (plan in the ep05 notes below), then as ep04.
> 4. ep06 after ep05 is delivered.
> The voice toolchain lives in `~/.cache/cinema-voice` (`kits/cinema/voice/setup.sh` rebuilds it on a new container).

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
| 02 | The swing's secret | **delivered** (25 Oct 23:04 UTC): 71.7 s, −14.1 LUFS / −1.9 dBTP, voice 21.3 LU over music, sync PASS (86 events), 0 audit warnings, 0 flashes; `qa.py` PASS; render 41.5 min · `out/rest-frame-002-9x16.mp4` |
| 03 | Where does the bounce go? | scripted · reviewed (7/10; fixes applied: "squashes flat", "motion doesn't vanish", "never loses energy" corrected) · voiced (153 words, 66.9 s; lint 0 errors before and after) · built · animatic checked (six rounds) · soundtrack −14.1 LUFS, sync PASS, voice 20.8 LU over music · ten final-tier stills OK (`review/stills-ep03.jpg`; two re-framed and re-checked) · **ready for the final, not started** |
| 04 | The hammer and the feather | scripted · reviewed (6.5/10; fixes applied: wrong takeaway, MICROSCOPE dates 2016–18, "a few parts" in 10¹⁵, Scott's quote added) · voiced (166 words, 72.0 s; lint 0 errors before and after) · compile and scene written; animatic not yet run |
| 05 | The spinning chair | scripted · reviewed (7/10; fixes applied: arms added to the spin model, seated body 2.0 kg·m² badged as an assumption, 'Nothing outside did', 'total amount of spin') · voiced (156 words, 66.9 s; lint 0 errors before and after) · set: `spin.js` (several arm moves; matches its port and a brute integral to 1e-10 rad) and `chair.js` · compile and scene not yet written |
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

## ep05 plan (for the resume)
- Takes: hook (from above, mid-pull, ghosts of both dumbbells) · normal: the push on "push." (30 rpm, arms out) ·
  change: arms in from "pull" to "chest." (80 rpm) · why: the turn from above to the side; arms out on "Weight near the
  middle", in again on "turns you faster" (`spinner` moves) · whoa: an ink skater beside the chair, the spine counting to
  342 rpm on "three hundred forty-two" · measure: frozen from above, the arms-out ghosts (18°) and arms-in ghosts (48°) ·
  takeaway: spinning on, "Friction ignored" and "Model: body 2.0 kg·m² (assumed)" notes · tease: re-run the hook so
  the last frame is frame 0.
- Spine: rpm (30 → 80), then 342 for the skater, then degrees per 1/10 s (18 → 48).

## Kit changes

None so far (`KIT-CHANGES.md`).

## Questions

None yet. Choices taken provisionally from the bible are marked in each episode's HUMAN-REVIEW.md.
