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

### Decisions waiting (the owner's)

- The online board: the speed ceiling 110 m/s (raise to the hypercar's top speed +5 % when it ships), the 3,000 km daily ceiling, an all-time board (not built), public vs signed-in only (public now, names only), and an independent adversarial review of its rules before it goes public.
- Online, for later: races against real people on the live server (the live-server session's view: a design question for the owner); chat stays out for a 13+ audience unless the owner decides on moderation.
- Art direction LOW (retro) as a third Look; renaming Profile to Career; the paid image pilot; the root `CLAUDE.md`
  replaced on the `style-references` branch (see the style guide's "Decisions for the owner").

## State on `claude/live-server` at its last update (2026-10-21, Opus: the live server shares the desks' machine; continuous improvement)

- **The owner's standing order (2026-10-21):** keep improving and rendering, and keep going until they say stop. A
  scheduled task ("OC Ultra: keep improving", every 2 hours at :36) wakes this session to continue from this list.
- **The live server** (decisions 16 and 17): `top-speed-ultra/live/` and the game's live code are on branch
  `claude/live-server`, pushed. It shares the desks' always-on machine (the owner's choice): `server/setup.sh` runs
  `server/live-install.sh` (Node 22, the game page built on the box, the `oc-live` service on 127.0.0.1:8791), and
  `sudo bash server/live.sh` makes it public for free through Tailscale Funnel (or `LIVE_DOMAIN=` with Caddy), checked
  end to end. `server/live-cap.sh`, `live-ban.sh`, `live-status.sh` (with the ladder's verdict).
- **Blocked on the owner:** the push of `claude/live-server` onto `claude/always-on` (the branch the desks' machine
  pulls) was refused by the session's permission check as a production deploy. Until the owner allows it or merges
  it, the desks' machine doesn't have the live server. On the machine they can also run
  `git fetch origin claude/live-server && git merge origin/claude/live-server && sudo bash server/setup.sh`.
- **Built since the first version:** gzip and ETag for the page (3.7 to 1.9 MB), the nearest-32 rule (outbound at 250
  drivers 550 to 190 MB a minute), reconnect after a restart (close code 4001), a name filter and bans, name plates
  over ghost cars, the 2 s roster (map dots, who's on and where, Drive with), the horn (G, 500 m, panned), change
  password and delete account, the measured ladder (`/api/ladder`), the DJ every three minutes, readable long toasts,
  Invite a friend.
- **Also done this round:** the security review's 15 findings fixed with tests (`live/test/hardening.test.mjs`); the
  service runs as `oclive` from /opt/oc-live with a hardened unit; password reset by email (Resend, off until
  `RESEND_KEY`/`MAIL_FROM`), the account email setting, the menu's "N of 25 driving now", the pause screen's live
  line, Invite a friend, and a watchdog alert if `oc-live` stops. `cd live && npm test`: 45 of 45.
- **The owner's checkpoint (2026-10-21, 17:20 UTC):** at 75% of the session's usage, pause, assess and ask questions.
  No session can read the plan's usage meter, so the gauge is the session's token budget (under 25% left) or the
  owner saying so. The scheduled task's prompt carries the same rule: it disables itself, reports, and asks.
- **Afternoon, 2026-10-21:** the owner resumed the loop ("keep going til everything is finished") and asked whether
  live traffic should stay light: decision 18, computer cars capped light while driving live. The welcome-card check
  in `livephone` timed out because of the test, not the game (the card renders at full size in a lone page); the check
  now blanks the first phone and polls on a timer. **The online board:** session_01SwssTo7t6RP6BjTKo6BMvm
  (claude/hypercar) offered to build it. Agreed: it is built from poses the server itself accepted (distance, top
  speed held 3 s, longest drive), never from client-submitted scores; that session writes `live/board.mjs`,
  `live/test/board.test.mjs`, `src/live/board.ts`, `src/ui/Board.tsx`; this lane wires `server.mjs` and the menu and
  reviews. Anti-cheat rules are Fable-class: have a Fable session review them before the board goes public.
  **Merged and wired (17:55 UTC).** Owner questions it raises: raise the speed ceiling (110 m/s) when the hypercar
  ships; is 3,000 km a day right; an all-time board; public board or signed-in only (public now, names only).
- **Next** (in order; Opus-class unless marked):
  1. Done: every suite group passes on the latest build (core 62 of 62, `live` 12 of 12, `livephone` 5 of 5). Crews,
     cruise nights, password reset and the realistic-mode fixes are in (progress log, the morning entry).
  2. Binary poses (F7 in the Fable queue) before the cap passes 100.
  3. The talk bank in the on-foot scenes once Lot 57 is in the game.
  4. Done since: crews (private rooms by code), cruise nights, ghost lamps, OC's clock on the HUD, the observed
     temperature, lit billboards at night, the Live line in the Feedback report. Still to weigh with the owner:
     spectating a friend's drive. Night lighting (the road reads bright at night) is in the Opus queue, but the graphics
     lanes touch the same files: take it there, not here.
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

**F7. The live relay's binary format, before the cap passes 100.**

```
OC Ultra (top-speed-ultra), branch claude/live-server. Read CLAUDE.md, live/README.md (the ladder, the bandwidth
budget) and live/server.mjs (tick, rosterTick, onPose) and src/live/client.ts (onMessage, send, poseOf). Design and
build a binary wire format for poses and snapshots: 12 to 16 bytes a row (id, x and z as int32 decimetres from the
map origin or int16 offsets from the receiver, y, heading quantised to 16 bits, speed, brake bit), sent as binary
WebSocket frames, with a version byte so old clients are refused cleanly; keep JSON for everything else. Prove it:
the same rows decode to within 0.1 m and 0.01 rad of the JSON ones (a property test over random poses across OC),
node live/test/load.mjs 100 and 250 before and after (outbound MB a minute, CPU), `cd live && npm test` green, and
`npm test -- --only=live,livephone` green. Log the numbers in PROJECT_OC_PROGRESS.md; update the ladder's bandwidth
table in live/README.md.
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

### Fable prompt: an adversarial review of the online board's rules, queued 2026-10-21

> You are reviewing OC Ultra's online board before it goes public. Read `top-speed-ultra/live/board.mjs` (its header
> states every rule), its tests `live/test/board.test.mjs`, the wiring in `live/server.mjs` (search `board.`), the
> relay's pose checks (`onPose`: SPEED_MAX 200 m/s, JUMP_MAX 240 m/s, the 3 s freshness window) and
> `src/ui/OnlineBoard.tsx`. Rules that apply: CLAUDE.md's honest claims (the board ranks only what the server saw;
> never phone-kept scores), no real money, names only in public output. Try to beat it as a modified client that
> stays inside the relay's limits: post more distance, a higher held speed or a longer drive than honest driving
> could; make it list a banned or deleted player; make it leak an id, a position or a time of day; make it cost the
> server (writes, memory, queries) out of proportion. For each attack, say whether it works, what it would post,
> and the smallest fix. Prove fixes with new cases in `live/test/board.test.mjs` and `cd live && npm test` green.
> Owner decisions to recommend on, not decide: the 110 m/s ceiling vs the hypercar, 3,000 km a day, an all-time
> board, public vs signed-in only. Log in PROJECT_OC_PROGRESS.md; commit on `claude/live-server`.

- **Freeway guide signs (for the realism-2 lane when it resumes; written 22:40 UTC by this session's Fable audit).**
  Spec: `docs/specs/SIGNS_SPEC.md` (seven ranked items: a Highway Gothic look-alike laid out in metres; Caltrans panel
  content with the yellow EXIT ONLY band, shields, two destinations, control cities, LEFT plaques; night
  retroreflection; a galvanised box-truss structure; a refcounted texture cache and phone resolution; one structure for
  closely spaced exits; exit numbers from OSM junction:ref). Ready-to-paste prompt: `docs/specs/SIGNS_PROMPT.md`.
  Census: `tools/signs-census.ts` (416 signs, 122 dropping a destination, 73 of 396 exit pairs under 800 m; reproduced).
  It needs one Game.ts hook (`roads.setNight(dark)`) from whoever owns Game.ts.

## Opus queue (routine items waiting for a daytime session)

- Everything in the daytime prompt above, in order.
- When the owner resumes pushes: merge claude/realism-2, claude/store, claude/hypercar (and claude/drift once F1
  passes) onto claude/always-on in that order, reusing the hand resolutions in local/live-preview (49a26c4), run the
  full suite, then push.
- The people pass (oc-people-2.js, tsu-people worktree): P4 teeth, P6 mouth corners, P7 brows and beards.
- From the audits, not yet taken: night lighting (cabin lit as daylight, freeway lamps light nothing), the
  Monopoly houses, the paper mountains, flat clear-day light, traffic bodies' door seams and mirrors, the chase
  camera's hovering rear wheels; teeth, mouth corners, brows and beards on the people.
