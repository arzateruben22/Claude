# Project OC: session handoff

The owner runs daytime sessions on Opus 5.5 and overnight sessions on Fable 5.1 (`CLAUDE.md`, Model policy). Every
session starts cold, so this file holds the current state and a ready-to-paste prompt for each kind of session.
The session that ends updates it. Inside a session, workflow scripts route agents by task, not by the session's
model: routine work to `opus`, hard reasoning to `fable`.

## State at the last update (2026-10-21, a Fable session: the live server)

- **The live server exists** (owner's decision 15): `top-speed-ultra/live/` (server.mjs, its tests, deploy scripts,
  README with the costs and the capacity ladder), `src/live/client.ts`, `src/game/live/LiveCars.ts`, `src/ui/Live.tsx`,
  hooks in Game.ts and App.tsx, settings `live` and `liveUrl`, and the suite's `live` group. Branch
  `claude/live-server` off `claude/always-on`, pushed as a backup (decision 14). Not deployed: it needs a domain and
  a box (README, "Put it on the internet"). The cap starts at 25; `deploy/cap.sh` raises it.
- **Also built (decision 16):** the realistic mode (live weather from the NWS and live freeway flow from TomTom via
  the server's `/api/now`, simulated when there is no feed; the Realistic preset in Settings), the talk bank and the
  Coastal League (`src/talk/`, `tests/talk.mjs`), the radio DJ lines, and twelve billboards near the venues
  (`src/data/ads.json`, `src/game/road/billboards.ts`). To turn the feeds on: `NOW_WEATHER=nws NOW_TRAFFIC=tomtom
  TOMTOM_KEY=…` in `/etc/oc-live.env` (the key is a free TomTom developer sign-up).
- **Next for the live server** (Opus-class unless marked): names over the ghost cars; binary poses and the
  nearest-32 rule before the cap passes 50 (Fable-class: the relay's format and its proof); email verification and
  password reset with Resend; a name-moderation list and a `banned` column; a "who's driving" list on the pause
  screen; the artifact link's page can't reach a server, so the served page at the domain is the public way in.
- Everything below this line is the state from 2026-10-18 and still applies to the other lanes.

## State at the update before (2026-10-18, 22:00 UTC, an Opus session)

- **Pushes are paused by the owner** (2026-10-17: "without pushing anything til further command"). Everything since
  is committed locally only. Run Fable in this same Claude Code session (`/model`), not a fresh one: a fresh
  session clones GitHub and would miss the local commits.
- **PAUSED 2026-10-18 22:19 UTC by the owner's rule** ("pause this session when I reach 50% of my session limit";
  the five-hour window was at about 45% and climbing 1% every 10 s with nine workflows running, so everything was
  stopped at once). Nothing was lost: every workflow commits per milestone, and interrupted agents' edits stay on disk
  (their scripts tell the next builder to continue from them). To resume, in this same session (pushes are paused, so
  a fresh session would miss the local commits), relaunch each with Workflow({scriptPath, resumeFromRunId}) from
  /tmp/claude-0/-home-user-Claude/104ede24-b5bc-5131-bb4c-1bc7e86a4fd2/scratchpad/:
  - Opus: oc-hypercar-3.js wf_7f9f9a3a-d82 (M1 body repair was in flight); oc-ui-pass.js wf_2eea3cf4-88f (U3 radial
    menu judge); oc-realism-2.js wf_6a88409a-2ee (W3 surfaces builder); oc-store-hypercar.js wf_9a01de13-61a (the
    $4.99 SKU builder).
  - Fable: oc-f1-dynamics.js wf_5afd6056-420 (designer); oc-f5-people-specs.js wf_aa50a799-e92 (three designers);
    oc-f2a-store-review.js wf_d2209927-ef1 (lenses); oc-f3a-review.js wf_517aad3b-46a (measure + lenses);
    oc-f4-budgets.js wf_303fc3f1-753 (designer, worktree tsu-stream on claude/stream).
  - Then F2-B (fixes in tsu-store after the SKU commits) and F3-B (fixes per branch once idle) from the F2 and F3
    findings files, and F6 (PROJECT_OC_DECISIONS.md: nine decisions, all pending; the owner answers one at a time).
  - Resume fewer lanes at a time if the owner wants the window to last: nine at once burn about 6% a minute.
- **Map scope from the owner (2026-10-20, decision 11):** LA County is stopped; the map is Orange County only, every
  freeway, street, roundabout and mall. After the hypercar and the sky-camera and debris fixes, OC streets come next
  (Fable prompt "OC streets" below), with the drive into Lot 57 as their first slice.
- **Priority order from the owner (2026-10-19, decision 10 in PROJECT_OC_DECISIONS.md):** the hypercar fully
  drivable first (F1 dynamics, then hypercar M1 to M6, then F4 budgets, then the live merge and suite), then the
  store SKU and F2, then on foot at Lot 57 (F5 people specs, then PROJECT_OC_ON_FOOT.md Phases 1 to 3), then the UI
  pass, realism-2 and F3. Resume lanes in that order, two at a time under the usage rule: F1 oc-f1-dynamics.js
  wf_5afd6056-420 and the hypercar oc-hypercar-3.js wf_7f9f9a3a-d82 first; F4 oc-f4-budgets.js wf_303fc3f1-753 when
  one of them finishes; the store SKU oc-store-hypercar.js wf_9a01de13-61a after the hypercar's M6.
- **Model change (2026-10-19, 23:22 UTC).** The Fable limit was reached, so this session and every remaining
  workflow agent now run on Opus. F1 (vehicle dynamics) finished on Fable and is committed (`2e86368` on
  `claude/drift`); F4's design and F5's expressions spec finished on Fable and replay from cache. The unfinished
  calls in oc-f4-budgets.js, oc-f5-people-specs.js, oc-f2a-store-review.js and oc-f3a-review.js were switched to
  `'opus'` (the Fable versions are kept beside them as `*.bak-fable` in the scratchpad). Until Fable is back, the
  model policy in CLAUDE.md reads as Opus for everything, and the Fable queue's remaining reviews run on Opus.
- Branches and worktrees (all under `/home/user/Claude`):
  - `top-speed-ultra/` on `claude/always-on`: the luxury glass menu (U0), adaptive HUD (U1), navigation card and
    chevrons (U2, `a340f1d`, the last pushed commit); the UI pass continues there (U3 radial menu onward).
  - `tsu-ref` on `claude/realism-2`: W1 buildings `36ffbd4`, W2 traffic cars and mirrors `3784a68`; W3–W6 continue.
  - `tsu-hyper` on `claude/hypercar`: plan `339cca5` (`PROJECT_OC_HYPERCAR.md`), owner mode `16bd03c`; M1 body
    (in repair) to M6 continue.
  - `tsu-store` on `claude/store`: the launch kit `bb798e0` (test-mode store, server functions, presentation,
    fact-checked plans); the $4.99 OC Hypercar Founder Edition SKU continues there.
  - `tsu-drift` on `claude/drift`: the drift physics draft `0a6a24e`, unverified, waiting for F1.
  - `tsu-live` on `local/live-preview` (never pushed): all judged work merged by hand (`49a26c4`); its build is
    live at https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV (33/33 on boot, phone, store, progression).
- The owner's latest product decisions: the OC Hypercar Founder Edition at $4.99, sold to Dec 31, 2026; two tunes
  (Unleashed in Free Drive, the race tune at or under the Rossini Corsa in every scored mode, ability off there);
  four cars in the garage (GT, Brio, Corsa, Hypercar; the Vela E hidden, kept in code); owner mode (`#owner`).

## Prompt for an Opus 5.5 daytime session

```
OC Ultra (top-speed-ultra). Read CLAUDE.md, PROJECT_OC_HANDOFF.md (State, Opus queue) and the top of
PROJECT_OC_PROGRESS.md. Pushes stay paused until the owner says otherwise: commit locally only. With ultracode on,
resume the paused workflows from their scripts in the session scratchpad (oc-hypercar-3.js, oc-ui-pass.js,
oc-realism-2.js, oc-store-hypercar.js) with their run ids, at most three heavy lanes at once (4 cores). When they
finish, re-merge every branch into tsu-live (local/live-preview), run the suite groups boot, phone, store,
progression, render, survival and race, and republish dist/artifact.html to the test link. Agents on 'opus';
commit only judged work; no model names in commits or code; log in PROJECT_OC_PROGRESS.md; update this file.
```

## Prompt for a Fable 5.1 overnight session

```
OC Ultra (top-speed-ultra). This is the Fable 5.1 hard-reasoning session. Read CLAUDE.md, PROJECT_OC_HANDOFF.md
(State and Fable queue) and the top of PROJECT_OC_PROGRESS.md. The newest work is local only (pushes are paused):
do not push or pull; commit locally. Opus workflows may still be running in tsu-hyper, tsu-ref, tsu-store and the
main checkout: do not edit files they are working on; F1 works in tsu-drift, the reviews are read-only until they
fix. Run at most two lanes. Fable agents design, review and fix; anything that renders or runs the suite goes to
an 'opus' agent. Work the Fable queue in order: F1 vehicle dynamics, F2 store security and pricing, F3 the
adversarial review of Oct 16-18, F4 streaming and render budgets, F5 the people specs. Keep F6 (decisions) for when
the owner is here. Log in PROJECT_OC_PROGRESS.md and update PROJECT_OC_HANDOFF.md at the end.
```

## Fable queue (hard items waiting for an overnight session)

Each block is ready to paste on its own. Order: F1 to F5 overnight; F6 with the owner.

**F1. Vehicle dynamics: drift, weight transfer, ABS, traction control, and the hypercar.**

```
OC Ultra (top-speed-ultra). Read CLAUDE.md, PROJECT_OC_HANDOFF.md, the top of PROJECT_OC_PROGRESS.md and
tsu-hyper/top-speed-ultra/PROJECT_OC_HYPERCAR.md (sections 5, 6 and 9). Pushes are paused: commit locally only.
Work in the tsu-drift worktree, branch claude/drift, file src/game/vehicle/Physics.ts (a bicycle model at 120 Hz).
Commit 0a6a24e is an unverified draft: lateral and longitudinal load transfer with tyre load sensitivity,
counter-steer lock, a handbrake yaw kick, kinetic grip for a spun-up rear, stability control that backs off while
the driver holds a slide, and a drift readout. Review it and finish one vehicle-dynamics model:
1. Weight transfer: longitudinal and lateral, roll stiffness split per car; braking into a corner rotates the car,
   throttle on exit squats the rear. Check signs, magnitudes and load sensitivity.
2. ABS: a slip-ratio controller per axle (not a force cap), strong in Arcade, lighter in Simulation, off-able.
3. Traction control: a rear slip-ratio target that trims torque; strong in Arcade, permissive in Sport, minimal in
   Simulation; a held drift must still keep the rear spinning.
4. The profiles (Arcade 0.15, Sport 0.5, Simulation 0.9 on the existing handling setting) must feel distinct;
   write down what each assist does at each value.
5. Per-car parameters from src/game/cars.ts flow through. The OC Hypercar Founder Edition (claude/hypercar, M3 and
   M5) needs an all-wheel-drive split with torque vectoring, a hook for its Cold Thrust and Ground Lock forces, and
   the scripted Thrust Hop's airborne state (landing loads, never switching road levels at an interchange, the
   traffic-collision skip, overpass clearance). If M3 or M5 is not built yet, design the interfaces they plug into
   and write them in PROJECT_OC_TECHNICAL_NOTES.md. Keep the owner's two-tune rule: Unleashed (maxed, with the
   ability) only in Free Drive; the race tune at or under the Rossini Corsa, ability off, in every scored mode.
6. Collision at speed: traffic contacts resolve on the smallest overlap, so a ~120 m/s closing-speed rear-end with
   a sideways offset reads as a side push and Survival continues. Make it a swept or substepped contact.
7. Safety: the autopilot's 134-200 mph runs (250+ for Unleashed) stay spin-free; a lift or brake in a fast sweeper
   never throws the car round in Arcade; a slide is catchable in Sport; every other car is unaffected unless
   intended.
Proof: the drift test script (slip angle and yaw traces for a handbrake entry, a power-over and a lift-off at 40,
70 and 120 mph per profile), a 60-0 braking test per profile with and without ABS, a rear-end test at 120 m/s
closing speed, and 'npm test -- --only=survival,race,progression,phone,abilities' green. Log the numbers in
PROJECT_OC_PROGRESS.md; commit on claude/drift. Agents: dynamics design and review on 'fable', test runs on 'opus'.
```

**F2. Store security and pricing, before live mode.**

```
OC Ultra (top-speed-ultra), worktree tsu-store, branch claude/store (bb798e0 plus local commits; pushes are paused,
commit locally only). Read CLAUDE.md (the money rule), PROJECT_OC_MONETIZATION.md, server/README.md,
server/supabase/migrations/*.sql, server/supabase/functions/*, src/store/* and src/ui/Store.tsx. Adversarially review
it before the owner turns live mode on:
- Can a player grant themselves an entitlement (RLS, the anon key, the functions' auth checks)? Can a price, a SKU's
  availability or the founder window come from the client?
- Is the Stripe webhook's signature check constant-time, on the raw body, with a timestamp tolerance, in front of
  everything, and idempotent? Do refunds and cancelled subscriptions revoke?
- The OC Hypercar Founder Edition ($4.99, to Dec 31, 2026): are serial numbers assigned only by the server, one per
  payment across webhook retries, never reused, a refunded number retired, No. 0000 reserved for tests? Is the
  window checked in create-checkout and the webhook?
- Owner mode (#owner, settings.owner, on claude/hypercar) unlocks every car on the device: it must be compiled out
  of, or account-gated in, any build that sells the car. Design that.
- Is any secret in the client bundle (grep dist/)? Do the prices survive Stripe's fees ($4.99 keeps about $4.55)?
  Is anything a loot box, a premium currency, or pay-to-win where something is scored (check the two-tune rule)?
  Are the 13+ gate, AB 2426's licence-not-ownership wording and California's auto-renewal terms in place?
Fix what is wrong, prove it with 'npm test -- --only=store', a webhook signature test and a serial test (one serial
per event across a retried delivery; a retired number after a refund), log it in PROJECT_OC_PROGRESS.md, and list
what the owner must decide. Agents: review and fixes on 'fable', test runs on 'opus'.
```

**F3. Adversarial review of the Oct 16-18 agent output, and the open findings.**

```
OC Ultra (top-speed-ultra). Pushes are paused: commit locally only. Adversarially review what agents built from
Oct 16 to Oct 18, read-only first:
- claude/always-on (main checkout): 0bf284e glass menu, 1bae196 adaptive HUD, a340f1d navigation card and chevrons,
  and any later local UI commits (radial menu onward).
- claude/realism-2 (tsu-ref): 36ffbd4 buildings (texture atlases: about 60 MB of GPU memory estimated at High, about
  1.1 s of first-tile atlas painting at Low), 3784a68 traffic cars and mirrors, and later local commits.
- claude/hypercar (tsu-hyper): 339cca5 plan, 16bd03c owner mode, and later local milestones.
- claude/store (tsu-store): bb798e0 and later local commits.
- local/live-preview (tsu-live): 49a26c4, where the session merged all branches by hand: check the hand-resolved
  conflicts in src/ui/App.tsx (store and owner-mode hooks on the new menu), PlayerCar.setPaint (swapping the body
  and mirror paint materials), carPaint's mirror variant in src/preview/car.ts, the run card's Founder badge
  position in src/ui/runCard.ts, and settings.ts's owner default.
Three lenses, each a separate 'fable' agent: correctness (bugs, broken saves, per-frame allocation), the rules
(our own brands only, honest claims, no real money outside test mode, accessibility floor) and phone cost (draw
calls, memory, first-load time). Then a refuter per finding that tries to disprove it. Write the confirmed findings
with severity 1-5 to PROJECT_OC_REVIEW_NOTES_2.md, fix the severity 4-5 ones yourself (with 'opus' agents for the
suite groups that cover them), and also fix the open severity 4-5 findings of PROJECT_OC_REVIEW_NOTES.md (Oct 16).
Queue the rest under "Opus queue" in PROJECT_OC_HANDOFF.md.
```

**F4. Streaming and render budgets at the hypercar's speed.**

```
OC Ultra (top-speed-ultra). Pushes are paused: commit locally only. The OC Hypercar's Unleashed tune reaches about
339 mph on its tyres and 350 with Cold Thrust (134-156 m/s), far beyond what the world was built for. Design, then
prove with measurements, the rendering and streaming budgets:
- World streaming and the road look-ahead (src/game/world/Roads.ts, Terrain.ts): chunks ahead at 156 m/s, build
  cost per frame, no holes or pop-in; the test harness's fastForward streams only every 24 steps (30 m at speed).
- Traffic spawn distance and despawn at 120+ m/s closing speeds.
- Per-tier budgets (Low/phone, High, Ultra): draw calls (the W1 hood frame measured 589 calls and 1.48 M triangles
  at High), triangles, GPU memory (the building atlases are estimated at about 60 MB at High), first-load time and
  the single-file size (dist/top-speed-ultra.html is about 3.75 MB).
Write the design and the budgets in PROJECT_OC_TECHNICAL_NOTES.md ("Budgets"), implement the streaming changes in
the main checkout only after the UI pass there has finished (or in a new worktree), and prove them with 'opus'
agents: a 60 s top-speed run on I-405 North with chunk and frame-time logs at High and Low, and
'npm test -- --only=boot,render,survival,phone' green. Log in PROJECT_OC_PROGRESS.md.
```

**F5. People specs: fingers, expressions, hair.**

```
OC Ultra (top-speed-ultra). Design, don't build. Read src/preview/hands.ts (the anatomical hands and their poses:
wheel, knee, watch, wave), the people builder (src/preview/people*.ts or wherever the NPC faces live; find it) and
the latest people renders in tests/out. Write three short specs the daytime agents can implement, in
PROJECT_OC_TECHNICAL_NOTES.md under "Specs for the next pass": (1) a finger rig so a wave opens the hand and the
wheel grip curls the fingers (bones, weights, the pose data, the phone cost); (2) an expression system that moves
the cheeks, the eyes and the nasolabial fold with the mouth (blend shapes or bones, the parameters, three test
expressions); (3) the hair silhouette fix (the updo reads as a cap from the front). Each with its acceptance renders.
No renders or suite runs on Fable agents.
```

**F6. Decisions, with the owner (a design conversation; Fable is best for it).**

```
OC Ultra (top-speed-ultra). The owner is here to decide. Walk me through each open decision one at a time, with
the facts, the options and your recommendation, and record each answer in PROJECT_OC_DECISIONS.md (create it):
1. The hypercar's roof: lower the seat 0.15 m on this car only for a 1.12 m roof, or keep the shared driver frame
   and a 1.25 m roof (PROJECT_OC_HYPERCAR.md section 3).
2. What "never sold again" covers after Dec 31, 2026: the Founder Edition's exclusives only, or the car itself.
3. Ground Lock on launch (1.5 s to 60) until all-wheel drive exists, or 2.2 s on tyres alone.
4. Free Drive's credit earnings capped at the race tune's top speed for the hypercar (recommended).
5. Owner mode in public builds: compiled out or account-gated.
6. The founder windows if the launch calendar moves (the $10 Founder Pack and the $4.99 hypercar).
7. Names: there is a real Rossini watch maker (a US filing exists) and a HiFuture "Vela" smartwatch. Rename the
   three in-game watches? Keep Rossini and Vela as car brands?
8. The UE5 go/no-go (PROJECT_OC_UE5_MIGRATION.md).
9. Pushes: when to resume, and the merge order for claude/realism-2, claude/store, claude/hypercar and claude/drift
   onto claude/always-on.
Do not change code in this session beyond recording the decisions.
```

### Fable prompt: OC streets (every street in Orange County), queued 2026-10-20

```
OC Ultra (top-speed-ultra), the OC streets design. The owner (2026-10-20, decision 11 in PROJECT_OC_DECISIONS.md): stop LA
County; the map is Orange County only, done deeply: every freeway and expressway, every public street with intersections,
signals and stop signs, roundabouts, malls and their parking structures. Design it, then build its first slice.
Read: CLAUDE.md, PROJECT_OC_DECISIONS.md (10 and 11), PROJECT_OC_TECHNICAL_NOTES.md (roads, streaming, the single-file
build, the F4 "Budgets" section on claude/stream), PROJECT_OC_ON_FOOT.md (the Anaheim data, Phases 2-3, the 804 m drive in
from the 57), tools/anaheim/README.md and its pipeline, src/data/anaheim/*.json, src/game/world/ (Network, Roads, Path),
src/game/traffic/, PROJECT_OC_DYNAMICS.md.
Design (write "OC streets" in PROJECT_OC_TECHNICAL_NOTES.md): (1) the data: every OC city's streets, connectors,
roundabouts, signals and stop signs where tagged, malls and parking structures, from Overture/OpenStreetMap only (credited;
never Google), measured counts and sizes per city; (2) a tiled street model that fits the single-file artifact (16 MB cap;
today 3.75 MB) with streaming by distance and speed; (3) intersections: geometry, lane inference without lane counts, signal
phases, stop-sign rules, turn lanes, roundabout entry and yield; (4) the freeway-to-street hand-off at every ramp terminal;
(5) surface traffic (the IDM on streets, yielding, turning) and pedestrians at crossings; (6) phone budgets per tier;
(7) the freeway gaps (I-605 at Seal Beach, the SR-90 expressway); (8) milestones with checks. Then build slice 1: the drive
from the 57 South exit into the Lot 57 lot (on-foot Phase 3b) on real streets with working signals.
Rules: OSM/Overture only and credited; no live data claims; static-first, no downloaded assets; honest labels; commits on a
branch off claude/always-on, local only while the owner's push hold stands; no model names in code or commits.
Proof: per-city data counts against the source; the autopilot drives from the 57 to the lot without touching a kerb or
running a red; a scan finds no street geometry inside any freeway travel lane; draw calls and triangles at Low and High in a
dense city block; npm test groups boot, interchanges, render, phone plus a new streets group. Log in PROJECT_OC_PROGRESS.md.
If Fable is unavailable, run it on Opus with a design judge pair before any build.
```

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- When the owner resumes pushes: merge claude/realism-2, claude/store, claude/hypercar (and claude/drift once F1
  passes) onto claude/always-on in that order, reusing the hand resolutions in local/live-preview (49a26c4), run the
  full suite, then push.
- The people pass (oc-people-2.js, tsu-people worktree): P4 teeth, P6 mouth corners, P7 brows and beards.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
