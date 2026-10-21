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

## Other sessions in flight (read before picking an item; updated 2026-10-21 06:15 UTC)

The owner runs several sessions on this project at once. The always-on session (session_01NkQ41gebWX6mPbmCQZBc81)
runs judged build lanes in git worktrees, each on its own branch, and merges what is kept into `local/live-preview`
(worktree `tsu-live`), builds it, runs `npm test -- --only=boot,race,survival,progression,phone` and republishes the
owner's main live link https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV (the artifact named in `CLAUDE.md`). It also
merges `claude/hypercar` into `local/live-preview` as commits land there (the merge of ba4f99f began at 06:05 UTC;
`rerere` is on in this repository, so conflict resolutions are reused). Its lanes, so nobody builds the same thing twice:

| Branch (worktree) | In flight | Notes |
| --- | --- | --- |
| `claude/hypercar` (tsu-hyper) | M2 lights and cockpit (the lane's own finish of the WIP d2f046b), then a sync merge of this remote branch, then SEAT (the 0.15 m seat drop, the roof, the view from the seat) and M1b body fidelity | the lane's local branch is at 07f46ac plus uncommitted work until M2 commits; the uncommitted work is snapshotted hourly on `claude/wip-hyper` |
| `claude/hypercar-drive` (tsu-hx) | M5 Cold Thrust / Ground Lock / Thrust Hop (repair), M4 driving profiles, M6 Founder exclusives | merged into `claude/hypercar` by the lane's last step |
| `claude/fix-sky`, `claude/fix-road` | the sky-camera fix and the debris fix | integrated into `local/live-preview` by their workflow |
| `claude/onfoot` (tsu-foot) | Lot 57 on foot, P1a venue and avatar, P1b things to do, P1c 40 NPCs, P1d the three graphics modes | its own page under `src/onfoot`, published as its own artifact |
| `claude/gfx` (tsu-gfx) | G1 the Ultra render tier, G2 showroom and photo mode, G3 hypercar materials at Ultra | |
| `claude/realism-2` (tsu-ref) | FW1 to FW6: every OC freeway's surfaces, furniture and signs, interchanges, night, I-605 and SR-90 | |
| `claude/ui-ref` (tsu-ui) | UI1 to UI5: the home screen, HUD, circular minimap, cockpit cluster to the owner's reference image, in the OC sunset orange colourway (`PROJECT_OC_DECISIONS.md`, decision 13) | |
| `claude/modes` (tsu-modes) | RS1 to RS3: exactly three graphics modes, Low (full-res, retro), HD, Ultra; Ultra an entitlement flag only (decision 15) | |
| `claude/store` (tsu-store) | ST1 the Founder SKU and the catalog check, ST2 the Ultra test-mode SKU | |
| `claude/sports-bar` (tsu-bar) | the sports bar plan (`PROJECT_OC_SPORTS_BAR.md`), then S1 to S4 | our own venue at the Lopez & Lefty's site, our own name |

Hourly snapshots of each lane's uncommitted work go to `claude/wip-<name>`. Items 3 (the seat view and the seat
drop) and anything on the lists above are already being built there; a session picking from the queue below gets
more done by taking something else, and by noting what it has taken in "State" above so the lanes can skip it.
This session publishes to https://claude.ai/artifact/9tXRF74cdLc7Po7DqHeJFS; the always-on session publishes to
3RkEetQBRvcm3dpNeVwMgV, so the two builds never overwrite each other.

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
