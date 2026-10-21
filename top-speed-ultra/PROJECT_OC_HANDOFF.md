# Project OC: session handoff

The owner runs daytime sessions on Opus 5.5 and overnight sessions on Fable 5.1 (`CLAUDE.md`, Model policy). Every
session starts cold, so this file holds the current state and a ready-to-paste prompt for each kind of session.
The session that ends updates it. Inside a session, workflow scripts route agents by task, not by the session's
model: routine work to `opus`, hard reasoning to `fable`.

## State at the last update (2026-10-21, ~06:00 UTC)

- Branch `claude/hypercar` holds everything judged: the ice reference UI, per-car and per-driver atmospheres, the
  style guide from the owner's library (`PROJECT_OC_STYLE_GUIDE.md`), the ULTRA tokens, the Look setting
  (Futuristic / Realistic), the live hypercar display, the Ultra grade, the run card's colours, the cinematic camera
  (the menu is filmed with it). `claude/ultra-world-wip` holds the parked world and clothing work; two lanes are
  finishing it in isolated worktrees and merge only when verified.

## Standing instruction (owner, 2026-10-21): keep improving until the owner says stop

An hourly scheduled task wakes this session. Each run: read notifications and background results first; merge what
is verified; then take the next item below, prove it on renders (`tools/grade-shot.mjs`, `tools/atmo-shots.mjs`,
`tools/ui-shots.mjs`, `tools/preview-shoot.mjs`), run the suite groups it touches, log it in
`PROJECT_OC_PROGRESS.md`, commit and push to `claude/hypercar`, tick it here. Never block on a question: put owner
decisions under "Decisions waiting" and move to the next item. Never spend real money, add a paid service, or
publish anything beyond the owner's private test artifact. Stop when the owner says stop (delete the scheduled task).

### Improvement queue (top first)

1. Merge the verified Ultra world pass and the driver clothing pass from their lanes; run `npm test` in full.
2. Republish the test build to https://claude.ai/artifact/9tXRF74cdLc7Po7DqHeJFS after each merged milestone.
3. The hypercar's seat view: the canopy header and the dash top crowd the view (the seat drop, M1 and M3 notes in
   `PROJECT_OC_HYPERCAR.md`); the rim clips the display's top.
4. Hypercar body fidelity M1b items 1, 3, 4, 6, 7 (`PROJECT_OC_HYPERCAR.md` section 8), each against the sheet.
5. The full-screen World Map (U4 in `PROJECT_OC_UI_TARGET.md`), in the library's ULTRA map style.
6. Garage tabs (U5): paint and wheels, applied live; then the radio panel (U7) and the phone (U6).
7. Night: freeway lamps and wet road reflections at High (after the world pass lands), checked against the
   library's ULTRA night boards.
8. Traffic bodies: door seams, mirrors and tinted glass (if the world pass did not), then a second sedan shape.
9. Performance: Ultra's draw calls and triangles after each pass, logged; Low unchanged.

### Decisions waiting (the owner's)

- Art direction LOW (retro) as a third Look; renaming Profile to Career; the paid image pilot; the root `CLAUDE.md`
  replaced on the `style-references` branch (see the style guide's "Decisions for the owner").

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
- Adversarial review of the store before live mode (security and business rules are Fable-class). Built 2026-10-16
  on `claude/store` (`PROJECT_OC_PROGRESS.md`, the store entry):

```
Fable prompt. Project OC (top-speed-ultra), store review, branch claude/store. Read CLAUDE.md (the store rule),
PROJECT_OC_MONETIZATION.md, server/README.md and the Store section of PROJECT_OC_TECHNICAL_NOTES.md. Code:
src/store/*.ts, src/ui/Store.tsx, server/supabase/migrations/0001_oc_ultra_store.sql,
server/supabase/functions/{create-checkout,stripe-webhook}/index.ts and _shared/*.ts. Rules: test mode until the
owner turns live on; cosmetics, expansions and support only; no power, credits, loot boxes or premium currency;
everything in the game today stays free; 13+ to buy; nothing sold before it exists in the game. Review
adversarially: can a client change a price, buy an unavailable, expired or (live keys) unbuilt item, keep items
after a refund or a cancelled club, read or write another player's rows, replay or forge a webhook, or get a live
build to take a card in the page? Is the age question neutral, and are the club's terms and checkbox what
California's automatic renewal law asks? Do any purchasable items change SPEC, grip, scoring, credits or XP? Check
the API details server/README.md marks "verify at launch". Then look at the paint renders
(tests/out/store-founders-sunset-chase.png and new seat/hood/chase renders per finish) and say whether the paint
entitlements in cosmetics.json can move from "hook" to "ready". Proof: findings with file and line, fixes for
severity 4-5, `npm run store:check`, `npm test -- --only=store,store-live`, and server/supabase/tests/run-local.sh
all passing. Log in PROJECT_OC_PROGRESS.md.
```

- Review the store's payment and entitlement security (`server/supabase/*`, `src/store/*`) and the pricing in
  `PROJECT_OC_MONETIZATION.md` before live mode. The prompt above covers the security. For the pricing, start from
  the owner decisions in `PROJECT_OC_PROGRESS.md`'s launch-kit entry (2026-10-16): the Rossini GT Spider sold for
  money and also earnable for credits, the Founders badge and roll against the testers' free "Founders" promise,
  Founders Sunset against Newport Sunset, no upgrade price from a paint pack to the Founder Pack, the watch names,
  and any hypercar SKU against the "never sell power" rule.

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

- Vehicle dynamics: finish the drift physics and add real weight transfer, ABS and traction control, for every car
  including the OC Hypercar (owner's hypercar directive, 2026-10-16), plus the hypercar's AWD, thrust and hop review. The drift draft is committed as work in
  progress on `claude/drift` (0a6a24e, unverified). Fable prompt:

  ```
  OC Ultra (top-speed-ultra). Read CLAUDE.md, PROJECT_OC_HANDOFF.md, the top of PROJECT_OC_PROGRESS.md and
  PROJECT_OC_HYPERCAR.md (on claude/hypercar). Work in the tsu-drift worktree, branch claude/drift, file
  src/game/vehicle/Physics.ts (the bicycle model at 120 Hz). Commit 0a6a24e is an unverified draft: lateral and
  longitudinal load transfer with tyre load sensitivity, counter-steer lock, a handbrake yaw kick, kinetic grip for a
  spun-up rear, stability control that backs off while the driver holds a slide, and a drift readout. Review it and
  finish it as one vehicle-dynamics model:
  1. Weight transfer: longitudinal and lateral, with roll stiffness split per car, so braking into a corner rotates
     the car and throttle on exit squats the rear. Are the signs, magnitudes and load sensitivity right?
  2. ABS: a slip-ratio controller per axle (not just a force cap), strong in Arcade, lighter in Simulation, off-able.
  3. Traction control: a rear slip-ratio target that trims torque, strong in Arcade, permissive in Sport, minimal in
     Simulation; it must still let a held drift keep the rear spinning.
  4. The three profiles (Arcade 0.15, Sport 0.5, Simulation 0.9 on the existing handling setting; M4 on
     claude/hypercar adds the Settings UI) must feel distinct: write down what each assist does at each value.
  5. Per-car parameters from src/game/cars.ts (mass, CdA, ClA, grip; the hypercar's downforce) must flow through;
     no paid car may out-perform the best earnable one.
  6. Safety: the autopilot's 134–200 mph runs stay spin-free, a lift or brake in a fast sweeper never throws the car
     round in Arcade, and a slide is catchable in Sport.
  7. The OC Hypercar Founder Edition (claude/hypercar, milestones M3 and M5; the owner wants it the fastest car with
     the best handling and traction): an all-wheel-drive split with torque vectoring for it, how its Cold Thrust and
     Ground Lock forces combine with the tyres, and a review of the scripted Thrust Hop's airborne state (landing
     loads, never switching road levels at an interchange, the traffic-collision skip, overpass clearance). Decide
     whether a free-flight hop is worth its cost. Keep the owner's two-tune rule: Unleashed (maxed, with the
     ability) in Free Drive only; the race tune (the best earnable car's envelope, ability off) in race, time trial
     and Speed Survival.
  Proof: the drift test script (slip angle and yaw traces for a handbrake entry, a power-over and a lift-off at 40,
  70 and 120 mph per profile), a braking test (60–0 distance per profile, with and without ABS), and
  'npm test -- --only=survival,race,progression,phone' green. Log it in PROJECT_OC_PROGRESS.md with the numbers;
  commit on claude/drift. Agents: reviewers and the dynamics design on 'fable', test runs on 'opus'.
  ```

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
