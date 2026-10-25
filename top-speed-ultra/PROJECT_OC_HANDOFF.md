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

### This session (session_01SwssTo7t6RP6BjTKo6BMvm, on `claude/hypercar`): built, handed over, next (06:25 UTC)

Built and pushed on `claude/hypercar`, each proven on frames and logged in `PROJECT_OC_PROGRESS.md`:
- the reference's home screen and driving HUD (the glass rail, the player card, the four picture mode cards, the
  guide-sign road plate, the icon rail, the speed block with chips, the round minimap bottom left with a mouse);
- the colour per car (`<html data-car>`): the starter Rossini GT in the OC sunset orange of decision 13, the
  hypercar in the reference's ice blue, the Brio aqua, the Corsa yellow, the Vela E violet; the driver's colour on
  the human elements (`data-driver`); the run card takes the colours on screen;
- the style guide from the owner's three-mode library (`PROJECT_OC_STYLE_GUIDE.md`, `style-references/`);
- the hypercar's live driver display (speed, gear, power, revs, tune) and its LEDs tuned to tone-map to ice blue;
- the cinematic camera, and the menu filmed with it (the car outside, right of the rail, as on the reference);
- the World Map (U4); the Ultra grade (vignette, edge aberration, grain), Ultra only;
- a "Look" setting (Futuristic / Realistic). **For the graphics-modes lane (decision 15):** fold it into the three
  modes rather than keep a separate control: Ultra sets `<html data-look="ultra">`, HD sets `data-look="hd"` (the
  tokens already exist in `styles.css`), Low a retro token set when RS1 has one; then remove the Look row.

Stopped here because another session's lane owns the work (their branches have the snapshots):
- the hypercar seat view and seat drop: `claude/wip-c-seat` (a first pass, unjudged) for the `tsu-hyper` lane;
- the Ultra world pass (road wear, lamp pools, lit windows, houses, chain-link, skids, our-brand billboards, skyline,
  night env map): `claude/wip-c-world` (unjudged) for the `realism-2` and `gfx` lanes to take from or drop.

Shared-file changes from this session since the lanes table (App.tsx, HUD.tsx, styles.css), one line each:
- 06:00 App.tsx, styles.css: the World Map (`WorldMap.tsx`, panel 'map'), a World Map row on the menu rail and the pause screen.
- 06:20 App.tsx, styles.css: the garage's tabs (Vehicles, Paint, Wheels, Upgrades); paint per car in `settings.paints`.
- 06:25 App.tsx, styles.css: the radio card (`RadioCard.tsx`); the top bar's Radio toggles it instead of cycling (B still cycles).
- Commits from this session carry no model names from here on (the Co-Authored-By line names only Claude).
- 06:40 race.ts: Santa Ana Checkpoints starts at 0.565 of I-5 North (it ran between Mission Viejo and Lake Forest).
- 06:45 App.tsx, styles.css: the phone (`Phone.tsx`, panel 'phone') from the pause screen; the radio card's stars centred.
- 06:50 App.tsx, styles.css: Settings regrouped into six sections (Graphics, HUD and map, World, Driving, Sound, Testing) with a sticky jump rail; every control keeps its label.
- 06:55 App.tsx, styles.css: the radial quick menu (`RadialMenu.tsx`): hold Pause or Tab for 300 ms while driving; a tap on Pause still pauses.
- 17:30 HUD.tsx, Game.ts, App.tsx: errands: `Hud.errand` (Free Drive's third slot and the guidance line), `Game.setErrand/errand/errandTick`, the phone's Set it up passes an errand.
- 17:00 App.tsx, styles.css, Phone.tsx, Game.ts: the story (`story.ts`): the phone's Messages and Contacts, a Phone row on the menu rail, jobs paid at run end (`Result.jobs`), listed on the results screen.
- 16:30 App.tsx, styles.css, WorldMap.tsx, Phone.tsx: Lifestyle (homes): the rail's Lifestyle row opens `Homes.tsx`; a Homes phone app; homes on the World Map; the garage's slots include homes; `.panel > .row:last-child` sticks to the screen's real bottom edge.
- 12:00 App.tsx, styles.css: the garage's Wheels tab (`RimIcon`, `.wheel-chip`); `settings.wheels`; PlayerCar rebuilds only the wheels on a change (`buildWheels`); two rim styles in `car-wheel.ts` (`mesh`, `blade`); the aero cover's normals; a Customize tab ("coming later").

**Also in flight here (from 18:00 UTC):** the Retro render (the modes lane's RS1, from its snapshot `wip-modes` 94b0d52)
ported onto `retro/port` behind that lane's own switch (Settings: "Style: Retro", Low only, default off), the owner
asked to see it now. Only the retro pieces come over (`src/game/render/style.ts`, settings' Style/RETRO/presetFor,
Game's hooks, the toggle, the two RS1 checks, `tests/modes-retro.mjs`). The always-on session (18:07): no objection;
the snapshot is a mid-edit state that never reached a judge, so merge only if tsc and the boot, render and phone groups
pass on the ported branch; the lane's later judged RS1 takes precedence over the port in its merge, so the file set stays
small. RS2/RS3 (Low = Retro, the LOW UI tokens, the Look row's removal) stay that lane's.

**Resumed 04:27 UTC (2026-10-22, the owner: "keep going ... connect it to this branch and integrate both systems
seamlessly"; they chose: the live server + this game, landing only after a judge).** Three workflows: the Fable overdrive
(resumed), the Retro finish (resumed), and the live integration: `integrate/live` cut from `claude/hypercar`, bringing
ONLY `top-speed-ultra/` from `origin/claude/live-server` db324db (no `server/`, `paper-book/`, desks or `START-HERE.md`),
as a regular commit (a merge commit dropping those paths would revert them in a later merge back). The Live UI moves onto
this branch's theme and navigation (the rail's Online row, Settings, the phone). The live-server session was told
(04:35); `claude/live-server` itself is untouched.

**Paused 23:02 UTC by the owner (see the progress log's 23:02 entry for each branch's state); was in flight here (from about 17:05 UTC, the owner: "run full fable for maximum overdrive"):** a Fable workflow
(audit, implement in its own worktree, adversarial judge, one repair round) on the driver's hands (`src/preview/hands*`),
the people builder's faces and eyes, hair and bodies (`src/onfoot/people/*`), the wheels (`src/preview/car-wheel.ts`) and
the physics (`src/game/vehicle/Physics.ts`, against `PROJECT_OC_DYNAMICS.md`). Branches `fable/<area>`, merged here only
once judged. The freeway signs stay the realism-2 lane's: the workflow writes them a spec instead of code. Lanes: please
leave these files to it until its results are logged.

Next here (updated 16:30 UTC; the owner, about 15:45: the life half and online toward 95 %; homes and walk-in
interiors first; online on a free-tier backend; the map OC-only; no real-phone test for now):
- done: homes (Lifestyle), the panels' Done bar, characters and story (phone Messages, Contacts, jobs), errands;
- next: walk-in interiors for owned homes, waiting on the always-on session's answer on how to reuse its on-foot engine
  (`src/onfoot/lot57`). The always-on session (16:00): no stable API yet; home interiors will be venue defs on
  `src/onfoot/engine/` (the sports-bar plan's S1, `PROJECT_OC_SPORTS_BAR.md` on `claude/sports-bar`); it will message
  this session with the commit when S1 is kept;
- online: `claude/live-server` belongs to session_014twwPd83rJxBkHT9T8yEiQ (not the always-on session). Agreed with it
  (16:35): this session builds the online board as NEW files only (live/board.mjs, live/test/board.test.mjs,
  src/live/board.ts, src/ui/OnlineBoard.tsx) on `claude/live-board` cut from `claude/live-server`, from server-observed
  poses only (distance, 3 s sustained top speed, longest unbroken drive per Pacific day; no client-submitted scores, no
  Survival streaks or near misses); that session wires server.mjs and the menu. Built and pushed (17:45): `claude/live-board`
  9c76011, 99c5fd4, board tests 9/9; reviewed, merged and wired by that session (17:49, merge af33cc8 on
  `claude/live-server`, live tests 58/58, an "Online board" pick in the menu's Live section). Chat stays out (13+); races against people are an owner decision for later;
- online: the always-on session's `claude/live-server` already covers it; this session asked which of its open gaps
  (online board with plausibility checks, races against people) it wants handed over, and builds none until it answers.

**The always-on session is active again (07:03 UTC message).** At the owner's request (two phone screenshots) it is
condensing the in-race HUD for phone first (`HUD.tsx`, the HUD styles, the HUD bits of `App.tsx`) and fixing the seat
POV. It asked this session to hold the HUD files. This session starts no HUD work; the live integration touches them only
to resolve the merge (both sides' readouts kept, no redesign). Whichever lands second builds on the other. Agreed at 07:10: the always-on session's condensed HUD lands first on
`local/live-preview` (pushed), with `docs/specs/HUD_CONDENSED.md` giving a slot to every live and story readout; this
session then CHERRY-PICKS only those HUD commits (never a merge of `local/live-preview`, which carries the store) onto
`integrate/live` or `claude/hypercar` and fits the readouts into the slots. If `integrate/live` lands first, message
that session its commit. The always-on
session is also merging `claude/hypercar` (388cfa2) into its `local/live-preview` for the owner's main link.

**Connecting to `claude/always-on` (the owner, 04:40 UTC).** After the live integration lands on `claude/hypercar`,
this session merges `claude/hypercar` into `claude/always-on` (only `top-speed-ultra/` differs; the diff outside it must be
empty), and keeps doing so after every judged landing. The live server's deploy pieces outside the game folder
(`server/live*.sh`, `server/systemd/oc-live.service`, the setup/status/backup hooks, `paper-book/watchdog.py`'s oc-live
alert, START-HERE.md Part 4) stay on `claude/live-server`. The owner chose (04:48) that the live-server session merges
`claude/live-server` into `claude/always-on` when it is resumed, after this session's merge, resolving the desks' files
itself; `top-speed-ultra/` conflicts there resolve in favour of always-on's integrated side. Before landing,
`integrate/live` must pass every core group (the live-server session's last core run on db324db was cut off).

### Decisions waiting (the owner's)

- **Sim mode's low-speed slides (physics plan item 1, 2026-10-22).** Below about 6 m/s of forward speed a "parking cart"
  rescue catches a sideways slide and swings the yaw hard, at 2,651 deg/s², 4.7 times what the tyres allow (558). An
  implicit lateral/yaw step removes that snap (166 deg/s²). But without the rescue, Sim slides past about 60 deg can
  spin, so 82 of the harness's Sim catch checks fail. Choose:
  - (a) big Sim slides may spin, and the Sim catch checks become "a finite spin that stops rotating", like the Sim
    power-over check already is; or
  - (b) keep the rescue.

  If (a), apply `scratchpad/fable/physics/after/item1-not-committed/item1-refined-on-d885737.patch` (it applies
  cleanly; the evidence is in the same folder). Fix the harness's backwards-travel drift reading first.
- **The pause (13:38 UTC): what waits for the owner.**
  - Hair and body: plans from their audits, branched from the face head.
  - The Retro finish (`retro/port`, judge pending).
  - **Face/eyes (`fable/face`, b5ac6a2, pushed; not landed).** Round 2 built teeth, beard/goatee/moustache strand
    cards, smile coupling, eyes set in their sockets, a cheaper phone skin shader and mouth corners, then one repair
    round. The re-judge (Opus) still said revise. Next round:
    - **(sev 3)** full-beard men at yaw 45 deg or more show the beard as a hard-edged dark box over the front of the
      ear. Build masks.ts `side` from smooth ramps that stop before the ear.
    - **(sev 2)** greying facial hair over a dark hair colour still speckles at game distance. Keep the card base at
      hairColor*0.55 unless the hair is itself grey/white.
    - **(sev 1, small):**
      - a person.ts one-liner to feed uEyeP (eyeSize, tilt, hooded) from getFaceMat;
      - move MORPHS/MI/NM to a leaf module (an import cycle);
      - taper the beard tufts at macro;
      - re-aim the talk-mouth crop;
      - correct the brow-difference numbers.

    Evidence: `scratchpad/fable/face/judge1`, `judge2` and `after/`.
  - The walk-in interiors (needs the always-on session's S1 engine).
  - Smaller follow-ups:
    - hands: smooth the thumb-bone weights, the knee pose's thumb, the nail tint;
    - wheels: the twin5 seam, the crown at the spoke root, the recess disc, a high-tier tyre pass.
- **The weekly usage budget: answered (06:50 UTC).** The owner: "Continue all 3 even if my current session runs out - continue once it resets". Every area continues (hands, wheels and the live integration, then Retro, then physics, face/eyes, hair and body); when a limit stops work, the hourly task resumes it after the reset, and a one-off check-in is set for the weekly reset (Sunday 2026-10-25 22:05 UTC).
- The online board: the speed ceiling 110 m/s (raise to the hypercar's top speed +5 % when it ships), the 3,000 km daily ceiling, an all-time board (not built), public vs signed-in only (public now, names only), and an independent adversarial review of its rules before it goes public.
- Online, for later: races against real people on the live server (the live-server session's view: a design question for the owner); chat stays out for a 13+ audience unless the owner decides on moderation.
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

- **Freeway guide signs (for the realism-2 lane when it resumes; written 22:40 UTC by this session's Fable audit).**
  Spec: `docs/specs/SIGNS_SPEC.md` (seven ranked items: a Highway Gothic look-alike laid out in metres; Caltrans panel
  content with the yellow EXIT ONLY band, shields, two destinations, control cities, LEFT plaques; night
  retroreflection; a galvanised box-truss structure; a refcounted texture cache and phone resolution; one structure for
  closely spaced exits; exit numbers from OSM junction:ref). Ready-to-paste prompt: `docs/specs/SIGNS_PROMPT.md`.
  Census: `tools/signs-census.ts` (416 signs, 122 dropping a destination, 73 of 396 exit pairs under 800 m; reproduced).
  It needs one Game.ts hook (`roads.setNight(dark)`) from whoever owns Game.ts.

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
