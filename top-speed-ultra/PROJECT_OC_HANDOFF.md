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
## State at the last update (2026-10-18, 22:00 UTC, an Opus session)

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

- **Freeway guide signs (for the realism-2 lane when it resumes; written 22:40 UTC by this session's Fable audit).**
  Spec: `docs/specs/SIGNS_SPEC.md` (seven ranked items: a Highway Gothic look-alike laid out in metres; Caltrans panel
  content with the yellow EXIT ONLY band, shields, two destinations, control cities, LEFT plaques; night
  retroreflection; a galvanised box-truss structure; a refcounted texture cache and phone resolution; one structure for
  closely spaced exits; exit numbers from OSM junction:ref). Ready-to-paste prompt: `docs/specs/SIGNS_PROMPT.md`.
  Census: `tools/signs-census.ts` (416 signs, 122 dropping a destination, 73 of 396 exit pairs under 800 m; reproduced).
  It needs one Game.ts hook (`roads.setNight(dark)`) from whoever owns Game.ts.
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
- Merge note (store lane ST1, 2026-10-21): claude/modes had no Ultra entitlement yet, so `claude/store` defines it in `src/store/entitlements.ts` (`ULTRA_ENTITLEMENT = 'graphics-ultra'`, `ultraUnlocked({ owner })`; no sku or price): RS2 should read that flag, not define its own.

## For Lot 57's owners (from the sports bar's S1, 2026-11-02; `PROJECT_OC_SPORTS_BAR.md` open item O28)

Two shadow flaws in Lot 57's page (`src/onfoot/main.ts` at `claude/onfoot` ab9fbe1), found by reading three.js 0.160.1
and checked on the bar's page, which works round both. The bar doesn't edit Lot 57's files before E0, so these are
Lot 57's to take (or E0's):

1. **A mesh on layer 1 casts into no shadow map.** `WebGLRenderer.render` passes the main camera to
   `shadowMap.render`, and `WebGLShadowMap.renderObject` tests `object.layers.test(camera.layers)` with that main
   camera (`WebGLShadowMap.js` renderObject); a shadow camera's layers are never read, so
   `env.sun.shadow.camera.layers.enable(1)` does nothing. Lot 57 puts your first-person body on layer 1 (and on High
   the LOD 1 kept under the close-up LOD 0, in `applyAvatar`), so in first person your driver casts no shadow, and on
   High in third person nothing casts for the close-up body. **Remedy (the bar's):** a hidden caster. Keep the body on
   layer 0, visible, `castShadow` on, and give its mesh an `onBeforeRender` that saves `geometry.drawRange.count` and
   sets it to 0, and an `onAfterRender` that puts it back: every colour pass then issues an empty draw (1 call, 0
   triangles), and the shadow pass, which calls `onBeforeShadow` instead, draws it in full. The bar's
   `venues/sportsbar/visibility.ts` (`setHiddenCaster`) does this; S1 measured it (the sun's map drops by the caster's
   own triangles when its `castShadow` is turned off; `tests/sportsbar.mjs`, the shadows group).
2. **At Ultra the shadow maps are drawn twice a frame.** Every `renderer.render` redraws the maps unless
   `shadowMap.autoUpdate` and `shadowMap.needsUpdate` are both false, and GTAO's normal pass is a second
   `renderer.render` of the scene (`GTAOPass.js`). **Remedy (the bar's):** `renderer.shadowMap.autoUpdate = false`, and
   once a frame, just before the composer runs, `renderer.shadowMap.needsUpdate = true`: the frame's first render draws
   the maps and clears the flag, so GTAO's normal pass (and any measuring render) draws none. The bar's `main.ts`
   (`render()`) does this; S1 checks one frame's `renderer.info` against the pass, each map once, GTAO's pass and the
   post.

Two more, found in the bar's S1 screenshots after the note above was written (the bar's page shares the code they come
from; Lot 57's page was not run for them, so on Lot 57 they are likely, not seen):

3. **GTAO darkens what lies under a mesh with no normals, and the mountain ring.** GTAO's normal pass draws every
   visible mesh (but points and lines) with a `MeshNormalMaterial`. The lamp pools (`lamp-pools` in Lot 57's
   `main.ts`, built from positions and UVs only) and the game's mountain ring (`src/game/env`, a `MeshBasicMaterial`
   with no normals) read there as surfaces facing nowhere. On the bar's page at Ultra the lot under the pools went near
   black at noon and the mountains turned dark slate; with GTAO off, or the fix, both read as on HD
   (`tests/out/sportsbar/probe/`). **Remedy (the bar's):** wrap the pass's `overrideVisibility` so that, after its own
   rule, it also hides every mesh with no `normal` attribute or whose material writes no depth (the pools, glass, blob
   shadows, a wordmark); `restoreVisibility` puts them back. The bar's `main.ts` (`applyQuality`) does this.
4. **The 3200 m ground quad can draw over the asphalt.** The ground plane (one quad at y -0.03, no polygon offset)
   drew over the lot's asphalt (y 0.012, offset -1) across the whole near lot in one view at 844x390 on Low, though
   not at 390x844 or 1280x720 from the same spot: a triangle that size rasterises with depth error larger than the
   4.2 cm between them. **Remedy (the bar's):** a polygon offset on the ground material pushing it back (factor 4,
   units 8); the asphalt then wins at every view the suite shoots.

Three leaks, found by S1's repair counting `renderer.info.memory` over rounds of quality switches on the bar's page
(Low, HD, Ultra, HD, Low with a pose after each: 6 textures and 50 geometries more each round before the fixes, none
after). The bar's page now frees each itself; the files they come from are unchanged, so Lot 57's page and the game
still leak them:

5. **`ParkedCars.dispose()` frees only the instance buffers** (`lot57/lot.ts`; its comment says the models are the
   game's, shared). But `trafficParts()` (`src/preview/traffic.ts`) builds new geometries on every call, and each
   `ParkedCars` makes its own stand-in geometries and stand-in material, so every rebuild (a switch between High and
   Ultra) leaves 25 geometries (5 kinds x 4 parts and a stand-in) on the GPU. **Remedy (the bar's):** before
   `dispose()`, dispose every mesh's geometry in the group and the stand-ins' material (`disposeParked` in the bar's
   `main.ts`).
6. **The people builder's `dispose()` leaves the skeleton's bone texture** (`people/person.ts`: it disposes the
   geometries and materials, not `skeleton.dispose()`), one 12 x 12 float texture per body; a crowd that rebuilds
   bodies (S3a) would leak one per body. **Remedy (the bar's, for your avatar):** dispose the old body's skeletons,
   and the textures its materials hold that the new body doesn't share (`disposePerson`). For `people/`'s owners.
7. **The game's `Environment.rebuildEnv()` frees the PMREM texture, not its render target** (`src/game/env/
   Environment.ts`): `texture.dispose()` on a render target's texture releases nothing in three.js 0.160.1, so each
   rebuild (the sun moving, a weather change, a page dimming the environment's ground) leaves a 768 x 1024 half-float
   target (about 6 MB) on the GPU. **Remedy (the bar's):** the page replaces `rebuildEnv` on its own instance with the
   same rebuild that keeps the `fromScene()` render target and disposes the previous one. For the game's owners too.

## Owner questions (open)

- **The sports bar's Low and the sun map** (`PROJECT_OC_SPORTS_BAR.md`, "Owner questions", 1). Decision 15 lists
  "hard shadows" for Low, and the game's `RETRO` preset has a 1024 sun map; the bar's Low plans none (hard-edged blobs
  and baked light) to stay inside Low's 150-call, 250k frame. If the owner or RS3's style guide asks for hard sun
  shadows, the bar turns on a 1024 `BasicShadowMap` with a short caster list: inside and overhead it fits, but outside
  Low takes its first three fallbacks (no detailed parked cars, fewer LOD 1 people, no far street props). Not settled.
- **Person builds stall the page** (same section, 2). Each build is one synchronous call on a desktop CPU: 0.29 s to
  1.0 s for LOD 2 and LOD 1, 4.6 s for a phone LOD 0 and 7 to 9.5 s for a high-quality one. The plan now fills the room
  on a time budget that works at any frame rate (full in about 46 s at Low, 2.3 min at HD, 4.1 min at Ultra, cards
  standing in), builds **no NPC LOD 0 at Low, HD or Ultra** (the person you talk to stays at LOD 1, so a conversation
  never freezes the page: 4.6 s saved at Low, 7 to 9.5 s at HD and Ultra), and builds your avatar's Ultra-only LOD 0
  during loading or behind a paused "Preparing Ultra…" sheet. Each LOD 1 or LOD 2 build is still a stalled frame. A
  fix needs a worker or step-wise build in `people/` (F5's builders and Lot 57's P1d own it). Not settled: accept the
  fill's stalls and LOD 1 for the person you talk to, or ask for that build before the bar's S3a (with it, NPC LOD 0
  comes back; at Low inside it needs Low's first fallback).
- **For RS3 and `people/`'s owners (from the sports bar plan):** a toon path for the people builder's skin. Under the
  Retro Stylizer's hook-fit rule `skinMaterial` stays physically lit (its hook adds `computeSpecularOcclusion`), so a
  LOD 0 body in view at Low would have toon clothes and physical skin. The bar draws no LOD 0 at Low, so nothing shows
  it yet.
