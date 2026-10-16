# Project OC: session handoff

The owner runs daytime sessions on Opus 5.5 and overnight sessions on Fable 5.1 (`CLAUDE.md`, Model policy). Every
session starts cold, so this file holds the current state and a ready-to-paste prompt for each kind of session.
The session that ends updates it. Inside a session, workflow scripts route agents by task, not by the session's
model: routine work to `opus`, hard reasoning to `fable`.

## State at the last update (2026-10-16, 07:55 UTC, an Opus session)

- Branch `claude/always-on` at `81939d3`: everything above plus the lens flare at every tier (sunset preset 5.5°
  at az 292°) and `PROJECT_OC_REVIEW_NOTES.md` (15 unverified findings from two review lenses).
- Running (Opus workflow `oc-day-1016`): the race HUD repair and the palms in the `tsu-ref` worktree, then the
  integrator commits R2 (overcast, judged keep) + whatever is kept on `claude/ref-pass`, runs the full suite, and
  merges onto `claude/always-on`. In parallel, the wordmark assets are prepared in the session scratchpad
  (`wordmark/final/`); the UI pass copies them into `src/ui/assets/`.
- Next in this session: the UI pass (`oc-ui-pass.js`, all Opus): UID wordmark and theme, U0 luxury menu, then the
  rest of the board.
- Waiting for Fable: the drift physics (`tsu-drift` worktree, `Physics.ts` half-built), the review's refuters and
  rules lens, the hand, expression and hair specs (see the Fable queue).
- Pending from the owner: a real-phone Feedback report, the UE5 go/no-go.

## Prompt for an Opus 5.5 daytime session

```
Project OC (top-speed-ultra). Read CLAUDE.md, PROJECT_OC_HANDOFF.md, PROJECT_OC_PROGRESS.md (top entries),
PROJECT_OC_VISUAL_TARGET.md and PROJECT_OC_UI_TARGET.md. Then, with ultracode on, in this order, one lane at a
time or at most two (the machine has 4 cores; a third lane makes the suite time out):
1. Integrate what is judged and uncommitted: the overcast light in the tsu-ref worktree (commit on claude/ref-pass),
   the flare rewrite in the main checkout if its re-judge passed (check the progress log), then merge
   claude/ref-pass onto claude/always-on, run the full suite, log, push, republish dist/artifact.html to the test link.
2. Finish the reference pass: race HUD (standings, gaps, lap timer, rev lights, OC city tags) and palm fronds, each
   judged on renders; then the drift pass items D2 (skid marks) and D3 (smoke and readout) on top of the drift
   physics once a Fable session has reviewed it.
3. Run the UI pass from PROJECT_OC_UI_TARGET.md starting with UID (the owner's OC sunset wordmark everywhere "OC"
   reads, and its theme tokens; assets in src/ui/assets/), then U0, the seamless luxury menu.
Agents: routine builders, judges and integrators on model 'opus'. Commit only judged work; no model names in
commits or code; verify before you claim; log in PROJECT_OC_PROGRESS.md. Update PROJECT_OC_HANDOFF.md at the end.
```

## Prompt for a Fable 5.1 overnight session

```
Project OC (top-speed-ultra). Read CLAUDE.md, PROJECT_OC_HANDOFF.md and the top of PROJECT_OC_PROGRESS.md. This is
the hard-reasoning session: do not spend it on renders or suite runs. Run at most two lanes. In this order:
1. Review the drift physics in the tsu-drift worktree (src/game/vehicle/Physics.ts, the bicycle model at 120 Hz):
   is the slide catchable, is weight transfer and load sensitivity right, does the stability control back off only
   under counter-steer, will the autopilot's 134–200 mph runs stay spin-free? Fix what is wrong, prove it with the
   drift test script and the suite's survival and race groups, commit on claude/drift.
2. Read PROJECT_OC_REVIEW_NOTES.md (the adversarial review of the day's agent work) and fix the confirmed findings
   of severity 4 and 5 yourself; queue the rest for the daytime session in this file.
3. Design, don't build: the finger rig for the anatomical hands (so a wave opens the hand), the expression system
   that moves cheeks and eyes with the mouth, and the hair silhouette fix, as short specs the daytime agents can
   implement. Put them in PROJECT_OC_TECHNICAL_NOTES.md under "Specs for the next pass".
Agents: reviewers and designers on model 'fable', anything that renders or runs the suite on 'opus'. Update
PROJECT_OC_HANDOFF.md at the end.
```

## Fable queue (hard items waiting for an overnight session)

- Review and finish the drift physics (`tsu-drift` worktree, `src/game/vehicle/Physics.ts`); see the overnight
  prompt above.
- Specs: finger rig for the anatomical hands; expression system coupling cheeks, eyes and the nasolabial fold to
  the mouth; hair silhouette (updo reads as a cap from the front).
- Fix the severity 4–5 findings of `PROJECT_OC_REVIEW_NOTES.md` once it exists.

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
