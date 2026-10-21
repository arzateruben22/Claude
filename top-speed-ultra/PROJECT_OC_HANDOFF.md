# Project OC: session handoff

The owner runs daytime sessions on Opus 5.5 and overnight sessions on Fable 5.1 (`CLAUDE.md`, Model policy). Every
session starts cold, so this file holds the current state and a ready-to-paste prompt for each kind of session.
The session that ends updates it. Inside a session, workflow scripts route agents by task, not by the session's
model: routine work to `opus`, hard reasoning to `fable`.

## State at the last update (2026-10-21, a Fable session on the owner's direct request)

- Branch `claude/hypercar` (this session's checkout; `claude/always-on` is not on this remote): the UI re-themed to
  the owner's ice reference ("Ice noir" tokens, the chrome OC mark, the rail menu with picture cards, the drive HUD
  with the sign plate, the icon rail, the speed block and the round map), and the hypercar's M2 lights and cluster
  judged on renders and re-tuned (see the 2026-10-21 entry in `PROJECT_OC_PROGRESS.md` and the 2026-10-21 section
  of `PROJECT_OC_UI_TARGET.md`). Suite groups run: boot, phone, launch. Not run: render, race, the rest.
- Next in the UI pass: the reference's pieces not built (Photo mode, the Phone, a showroom hero for the hypercar on
  the menu), then U1 to U8 as listed in `PROJECT_OC_UI_TARGET.md`, all in the ice tokens.
- Hypercar: M1b (body fidelity) and M3 to M6 as before; the seat view's rim clips the cluster's OC mark.
- Pending from the owner: whether the lockup should read the mock's "Project OC / Orange County Freeway Simulator"
  instead of "OC Ultra / Top Speed"; a real-phone Feedback report; the UE5 go/no-go.

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

- Review the store's payment and entitlement security and the pricing before live mode (being built now on
  `claude/store`: `server/supabase/*`, `src/store/*`, `PROJECT_OC_MONETIZATION.md`). Fable prompt:

  ```
  OC Ultra (top-speed-ultra), branch claude/store (merged onto claude/always-on once the UI pass lands). Read CLAUDE.md
  (the money rule), PROJECT_OC_MONETIZATION.md, server/README.md, server/supabase/migrations/*.sql,
  server/supabase/functions/*, src/store/*. Adversarially review it before the owner turns live mode on: can a player
  grant themselves an entitlement (RLS, the anon key, the functions' auth checks)? Can a price come from the client?
  Is the Stripe webhook's signature check constant-time with a timestamp tolerance on the raw body, and idempotent?
  Do refunds and cancelled subscriptions revoke? Is any secret in the client bundle (grep dist/)? Do the prices survive
  Stripe's fees, and is anything pay-to-win, a loot box or a premium currency? Are the COPPA 13+ gate and California's
  auto-renewal terms in place? Fix what is wrong, prove it with `npm test -- --only=store` and a webhook signature
  test, log it in PROJECT_OC_PROGRESS.md, and list anything the owner must decide.
  ```

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
