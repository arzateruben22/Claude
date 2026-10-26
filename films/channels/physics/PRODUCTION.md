# Rest Frame: production log, episodes 2–6

> **Recheck pass (26 Oct, from 03:35 UTC), at the user's request: "complete and rechecked and rendered for better
> placement on subtitles, animations, HD quality / graphics".** What changed for every episode:
> - Captions break at phrases (`set/captions_py.py`), not mid-phrase ("…a tenth of a / second bunch up at the" is gone);
>   a few sentences are laid out by hand (`CAP_FIX` in each compile.py); the last caption clears before the end card.
> - The spine readout is pinned to the safe line with a wrapping label, cards stop at 38vmin (`set/spine.js`), so no
>   card or tag sits on it; a step-through audit of every HUD plate (each 0.25 s) leaves only sub-0.25 s crossfades.
> - The coordinating branch's readability pass is merged (`767b57b`): bigger counter labels and card text, labels that
>   avoid all text, masters at CRF 12 and deliveries at CRF 15 with aq-mode 3, and WRITING.md rule 8 "One line wins".
>   Every episode, ep02 included, is re-rendered on it.
> - ep04's bench camera is lower and wider (the drop sits between the readout and the captions).
> **Paused 06:07–08:12 UTC by the session's usage limit** (the worker restarted; ep03's final resumed from frame 476; the
> rule-8 fix stage for ep02, ep04 and ep05 re-run after the reset). ep06 delivered 05:09 (QA PASS).
> **Fact audit (26 Oct, from the coordinating session; reports on its branch, films/audits/2026-10-26).** Every confirmed
> finding checked against our files and applied (commit fa0e26b): ep02's pendulum wave comes back "just as gradually"
> (x(60−t) = x(t)), ep03's "doesn't spring back as hard" and "about three thousandths of a degree", ep04's "< 5" readout,
> "Still drifting down" and "Gravity speeds them up equally", ep05's "Nothing motorized"; sources repointed where an
> excerpt didn't come from the cited page. The changed lines were re-voiced (lint 0 errors before and after).
> Order (04:40 UTC): the rule-8 pass on ep02–05 runs as a workflow (one implementer, one independent reviewer and one
> fixer per episode; agents never run Chromium); meanwhile ep06 (written with rule 8 from the start) renders its final,
> then each of ep02–05 gets compile → cues → compile → soundtrack → stills at 390 px → final → QA, in order.
> **ep06 audit (08:15 UTC, from the coordinating session): the 05:09 delivery (339bc41) is superseded.** Applied: the
> hook "Something invisible, pushing." ("not suction" overclaimed), "however hard you like" (a hard sip, not a
> maximum), "Your lungs alone? About one meter." then the 7 m mouth-pumping stunt (c15, Veritasium 2012; the audit's
> mouth-suction paper not found in our searches, so not cited), the takeaway "its push runs out near ten meters".
> Re-voiced (175 words, 73.3 s; lint 0 errors). It re-renders after ep02–05 (commit 11c7b36).
> **A third on screen (08:30).** Blending and the lerp toward the paper both happen in scene light, before the
> finish's ACES curve, so opacity 1/3 (or a 2/3 lerp) keeps only about 1/11 of a mark's contrast on screen; ep02's
> review caught it. `set/aces.js` now has `screenAlpha(k, ink, paper)` (the opacity that keeps k of the contrast,
> about 0.7 for a third); ep06 uses it, and each of ep02–05 is mapped through it before its final.
> `ps -eo args | grep "[r]ender.mjs"` shows the one render; a bare `kits/cinema/film/run.sh <dir>` resumes it.
> The pre-merge ep02 frames are in `ep02/build/final/9x16.prev`; ep03's first final is in `ep03/build/superseded/` (not committed).

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
| 02 | The swing's secret | **delivered** (25 Oct 23:04 UTC): 71.7 s, −14.1 LUFS / −1.9 dBTP, voice 21.3 LU over music, sync PASS (86 events), 0 audit warnings, 0 flashes; `qa.py` PASS; render 41.5 min · `out/rest-frame-002-9x16.mp4` · **re-render pending** (26 Oct recheck: phrase captions, spine layout, rule 8, the readability kit) |
| 03 | Where does the bounce go? | **delivered** (26 Oct 09:08 UTC): 67.5 s, −14.0 LUFS / −1.9 dBTP, voice 20.9 LU over music, sync PASS (57 events), 0 audit warnings, 0 flashes; `qa.py` PASS; render 27.5 min · `out/rest-frame-003-9x16.mp4` · on the audit, rule 8 and screen-true thirds (the 08:35 final, QA PASS, was superseded: its stepped-back ball nearly vanished) |
| 04 | The hammer and the feather | scripted · reviewed · voiced (166 words, 72.0 s) · compile and scene · animatic checked (bench camera lowered, MICROSCOPE card, labels) · **rule 8 pass in progress**, then cues, soundtrack, stills, final |
| 05 | The spinning chair | scripted · reviewed · voiced (156 words, 66.9 s; tease re-voiced for US spelling, audio identical) · compile and scene written · HUD audit clean · **rule 8 pass in progress**, then animatic, cues, soundtrack, stills, final |
| 06 | The ten-meter straw | scripted · reviewed · voiced · built with rule 8 · delivered 05:09 (QA PASS), **superseded by the coordinating session's audit** (08:15): re-voiced (175 words, 73.3 s; lint 0 errors), the 7 m stunt added, screen-true thirds · **final re-render queued after ep02–05** |

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
- `chair.js`: a swivel chair with a seated wooden mannequin holding two dumbbells (two-bone IK arms); `reach()` and
  `dumbbells: false` for empty hands (ep06).
- `captions_py.py`: the caption pager every compile.py uses (phrase breaks, per-sentence fixes, end-card clearance).
- `aces.js` (added): `acesFwd`, the finish's forward curve, and `screenAlpha`, the opacity that keeps a share of a mark's contrast on screen.
- `spine.js`: where the spine readout sits (pinned to the safe line, wrapping label) and the card width.
- `straw.js`: glass without transmission (a Fresnel rim and a highlight stripe), a glass of water, straws and tall pipes
  with a liquid column, a screw lid, a hand vacuum pump and hose, an ink house front with a meter scale, boiling
  bubbles, Torricelli's tube in ink; the hydrostatics helpers (h = Δp/ρg).

## ep05 plan (for the resume)
- Takes: hook (from above, mid-pull, ghosts of both dumbbells) · normal: the push on "push." (30 rpm, arms out) ·
  change: arms in from "pull" to "chest." (80 rpm) · why: the turn from above to the side; arms out on "Weight near the
  middle", in again on "turns you faster" (`spinner` moves) · whoa: an ink skater beside the chair, the spine counting to
  342 rpm on "three hundred forty-two" · measure: frozen from above, the arms-out ghosts (18°) and arms-in ghosts (48°) ·
  takeaway: spinning on, "Friction ignored" and "Model: body 2.0 kg·m² (assumed)" notes · tease: re-run the hook so
  the last frame is frame 0.
- Spine: rpm (30 → 80), then 342 for the skater, then degrees per 1/10 s (18 → 48).

## Kit changes

None (`KIT-CHANGES.md`: a `--crf` option was added and withdrawn on 26 Oct when the upstream readability pass made the same change).

## Questions

1. **Spelling: US or UK?** The voice is American and episodes 1–5's captions are US ("meter", "centimeters"); the bible
   writes "ten-metre" and "storeys". Taken provisionally: US everywhere on screen (episode 6's title is "The ten-meter
   straw"; episode 5's tease and end card were changed to match, its audio unchanged).
2. **Rule 8's layout for Rest Frame.** Taken from the coordinating session's own episode: the speed column top-left, the
   standing cheats top-right, the spine readout between and below them (moved per shot when the subject is there).
3. **Episode 6's open paper floor.** The 11 m house can't stand inside the 4.2 m cyc, so episode 6 hides the cyc wall
   (the floor stays). Provisional; the alternative is a taller wall option in `set/cyc.js`.
Choices taken provisionally from the bible are marked in each episode's HUMAN-REVIEW.md.
