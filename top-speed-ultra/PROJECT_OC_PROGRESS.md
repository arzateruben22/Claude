# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-10-22 (12:45 UTC): the overdrive's round 1 landed: the thumbs and the wheels

- **Landed on `claude/hypercar`** after independent adversarial judges, each running on Opus (the session's model since
  the Fable limit at 05:28), returned **keep**:
  - `fable/wheels` as 7ab71b5 (8 commits, `src/preview/car-wheel.ts` only);
  - `fable/hands` as fb35439 (13 commits: `hands.ts`, `hands-sdf.ts`, `hands-geo.ts`, `hands-skin.ts`, `test-hands.ts`
    and new `tools/preview-hands-*` tools).
- **The thumbs (the owner's "Fix the thumbs still").**
  - Each thumb lies along the rim's front face toward twelve, with the nail square to the driver's eye (cosine 0.98 m /
    0.97 f) and the tip's pad on the leather.
  - The first web space is a saddle instead of a mound, so the rim shows in a notch between the index knuckle and the
    thumb (no eye ray through the web meets the rim, 0/105).
  - There's an IP knuckle and crease that also reads on the shaded thumb in the game (luminance 50 at the IP against
    61-66 beside it, where before there was no dip), and a wider nail.
  - Off the wheel (the Closer's watch check, the Ace's wave) a thumb bone curls the thumb into the fist, so those poses
    no longer read as a thumbs-up. On the wheel the render is pixel-identical to the pass before it.
  - **Cost:** 664 triangles (+0.9 %, 75,744 to 76,408 in the seat view), no new draw calls, 2 more skeleton bones, still
    no per-frame allocation.
  - **The judge** re-rendered the seat view at the game's framing (`?frame=game`, 1170x2532 High): pixel-identical to the
    implementer's shot. It then built the game and shot it in game at the owner's capture size (393x852 at 3x).
- **The wheels.**
  - The Aero Disc's banding is gone: the cover is re-meshed as polar grids (max triangle aspect 3.6, was 499).
  - Every spoke style has crowned faces that catch a highlight; twin5, cl10 and blade are forged-wide.
  - The five-bolt hub boss is smaller (34 % of the rim, was 41 %), with chamfered nuts and a valve stem on every open
    style.
  - Round 7 x 8 mm drill holes on the discs instead of ovals.
  - The caliper wordmarks sit on a strip of their own aspect (stretch 1.00, was 0.38).
  - Phone tyres drop their groove geometry: about 13 % fewer triangles per car on phone (GT 141,920 to 122,384 for all
    five cars' wheels), with the sidewall pixel-identical.
  - **Cost:** High +388 to +1,228 triangles a wheel, no new material keys, so no new draw calls.
  - **The judge** re-rendered the headline shot (GT twin5 wheel-side, High): byte-identical.
- **The judges' one-line hooks** (fbb60a7, outside the two branches' files):
  - the hands' off-wheel blend and wave hold while the game is paused (`CockpitState.paused`, so `setWheelAngle` gets
    0 then);
  - the calipers pick their wordmark strip by the car's brand (`brand: P.brand` in `car.ts` and `PlayerCar.buildWheels`);
  - a NaN step can no longer leave the arms at NaN.
- **Verified on the merged build** (fbb60a7; tsc clean, `npm run build` clean), one group at a time:

  | Group | Result |
  | --- | --- |
  | boot | 6/6 |
  | abilities | 4/4 (fires the abilities' off-wheel hand poses) |
  | launch | 11/11 (the Wheels tab check included) |
  | render | 14/14 |

  Both branches had also passed these groups at their own heads. The render group's "reset" check failed once on each
  branch (29.21 against a 30 m/s pre-reset speed) and passed on the re-run: a load flake, not these changes.
- **Not done or not proven, honestly:**
  - **Hands:**
    - The thumb's IP and MCP stand 2.5 and 5-7 mm off the leather; only the tip touches. It's hidden from the seat.
    - The thumb-bone weights change sharply across the web in the off-wheel poses; smoothing them is queued.
    - The Wrench's knee pose curls the thumb more than it should.
    - The nail reads near-white under the test page's light.
  - **Wheels:**
    - A 1 px dashed seam on the twin5's Y stem at close range.
    - The crown stands up to 2 mm proud of the boss at the spoke root.
    - The recess disc floats 0.7-4.9 mm over the sloped boss.
    - On the phone chase camera the wheels look the same; the gain shows in the garage and close views.
  - No real-phone frame rates (SwiftShader only).
- **A lesson from the run.** At 11:40 the overdrive was stopped and resumed with the hands and wheels judges moved ahead
  of the other implementers. A Workflow resume replays saved results only until its first new agent call; after that
  everything runs live. So the face, physics, hair and body audits ran live on Fable and failed at once (no Fable usage
  spent). Round 2 (`overdrive-round2.js`, from 12:15) carries those four audits inline and makes no Fable calls:
  - physics and face/eyes first;
  - then hair and body, branched from the face head if face is kept.

## 2026-10-22 (08:40 UTC): the five-hour limit again; the integration is committed, resumed for its proofs

- **About 07:05 UTC:** the session's five-hour limit stopped all three agents; it reset at 07:50.
- **What the agents had committed (all pushed):**
  - **`integrate/live`:**
    - 1b0bc0c, the integration itself: `top-speed-ultra/` only from `claude/live-server` db324db, a regular commit
      with nothing outside the game folder;
    - Live in this branch's navigation: the phone's Online app, the radial menu's Online wedge, the live drive;
    - the live side's menu details on the cinematic menu, the account avatar in the car's accent;
    - the Live panel usable mid-drive; live drivers' names on the World Map; the control rail placed under the sky
      camera;
    - the tests moved to the unified menu (the live groups open Live from the rail's Online row; the mode cards' arrow
      keys; the mid-drive Live panel from the phone).
  - **`fable/hands`:** the thumb now separates from the hand (a web valley beside the proximal phalanx) and its joint
    reads (two segments, a crease, a spatulate tip), plus measuring tools.
  - **`fable/wheels`:** the OC mark unstretched on the hypercar's calipers and Aero Disc.
- **Not yet done:** none of this is proven by a full test run or judged. Those runs' results were lost with the
  agents, so the resumed integrator re-runs every core group and the live groups before its judge. Hands and wheels
  continue to their proofs and judges.

## 2026-10-22 (05:27 UTC): a container restart; the work kept and resumed

- **05:20 UTC:** the session's container restarted and every running agent stopped. The disk survived.
- **Kept, and now pushed:**
  - `fable/hands`: 5 more commits, including a node check for the thumbs and the first web space
    (`tools/preview-hands-web.mjs`) and a merge of `claude/hypercar`;
  - `fable/wheels`: brought up to `claude/hypercar`;
  - `retro/port`: brought up to `claude/hypercar`.
- **The live integration** (`integrate/live`) was mid-merge: every path outside `top-speed-ultra/` already restored, and
  all eight conflicts resolved in the working tree but unstaged. The rerun reviews those resolutions against both sides
  before committing, then runs every core group plus the live ones (the live-server session's core run on db324db had
  been cut off).
- **05:28: the Fable model's usage limit was reached.** Every relaunched agent failed at once, before doing any work. The
  remaining agents (the implementers, judges, the critic and the integrator) now run on Opus, the session's model. The
  seven audits stay Fable's, replayed from the journal. Which model judged each landing will be named in its entry.
- **Relaunched at 05:27, then on Opus at 05:31,** at most three agents at once: the integration and the overdrive (its implementers continue
  their existing branches). The Retro finish waits for the first free slot. No log says whether memory caused the
  restart; the cap is a precaution.

## 2026-10-21 (23:02 UTC): paused by the owner

The owner said "Pause". Both workflows were stopped and the hourly task switched off. The 00:20 stop-and-ask check-in was
deleted. Nothing was merged: no branch had reached a judge. Where each piece stands (all committed, no uncommitted
scraps; both workflows resume from their journals):

- **Hands, `fable/hands`** (worktree `.claude/worktrees/wf_ba9f2603-ef8-8`), unjudged:
  - c285d6e: the thumbs lie along the rim, nails to the driver, the web open (the owner's "fix the thumbs");
  - cfeee35: the pose allocates nothing per frame; blend and wave run on the game's dt, so they stop while paused;
  - 2a52270: the test page frames the seat view like the game (`?frame=game`).
  - Its proof renders, suite groups and judge had not run.
- **Wheels, `fable/wheels`** (worktree `-10`), unjudged:
  - c2350ef: the Aero Disc cover re-meshed as polar grids (no banding);
  - e5ea194: crowned, forged-width spoke faces;
  - 8ff6257: round drill holes, the caliper wordmark, chamfered nuts, a valve stem;
  - 7599805: a plain tread band on the phone tier.
- **Retro, `retro/port`**: the three port commits plus a merge of `claude/hypercar` (960dc12). Its verification against
  the merge bar had not finished.
- **Audits done** for hands, signs, wheels, face, physics, hair and body; the signs spec delivered (bdc9b47).
- **Not started:** the face, physics, hair and body implementations; the critic.

## 2026-10-21 (21:55 UTC): both workflows cut off by the usage limit; resumed

- **What the limit cut off.** At about 18:30 UTC the session's five-hour usage limit stopped every running agent; it
  reset at 21:50 UTC.
  - **The Fable overdrive:** six audits had finished (hands, signs, wheels, face, physics, hair, under
    `scratchpad/fable/<area>/before/`). The body audit, the signs spec, every implementer and the critic were cut off.
  - **The hands implementer** had begun only plan item 1, the thumb re-solve parameters, uncommitted and unproven. It
    was saved as `scratchpad/fable/hands/partial-thumb-params.patch` and the worktree removed so the rerun starts clean.
  - **The Retro port** had made its three commits on `retro/port` (9e29640 the render style and its settings pieces,
    619ae83 Game's hooks and the switch under Low, c6d03c4 the two suite checks and `tests/modes-retro.mjs`) but proved
    nothing.
- **The 75 % checkpoint** (20:35) fired during the outage. The owner then said "continue and don't stop", so it is
  replaced by a usage guard: no new agents while the limit is hit.
- **Resumed at 21:55.**
  - The overdrive resumes from its journal: the six audits replay, and the rest runs live.
  - A new workflow verifies the Retro port on its own branch against the agreed merge bar (tsc clean; boot, render and
    phone groups pass), then an adversarial judge decides.
  - Nothing from either is merged yet.

## 2026-10-21 (17:45 UTC): the online board (live server), from server-observed poses only

Agreed with the live-server session (session_014twwPd83rJxBkHT9T8yEiQ, which owns `claude/live-server`): this session
builds the board as new files; that session wires it into `server.mjs` and the menu. A Fable agent designed and built it
(anti-cheat is Fable-class) on **`claude/live-board`** (cut from `claude/live-server` 6d16421; commits 9c76011, 99c5fd4).

- **Files.** Four new files only: `live/board.mjs`, `live/test/board.test.mjs`, `src/live/board.ts` (the GET
  /api/board client) and `src/ui/OnlineBoard.tsx` (the panel, reusing the existing panel and board styles).
- **Rules** (documented at the top of `board.mjs`):
  - Only poses the relay accepted count, on the server's clock; no score from a phone is trusted.
  - Distance comes from displacement, metered by a token bucket capped at the reported speed and 110 m/s, so a
    teleport, a reconnect or a parked car reporting speed earns nothing. The daily ceiling is 3,000 km.
  - Top speed is the speed held for 3 s, cross-checked against ground speed.
  - The longest unbroken drive breaks on more than 3 s without a pose (the relay's own freshness window) or less than
    3 m per 3 s.
  - The day is Pacific, DST-correct; today and the rolling week.
  - Banned and deleted players are hidden through the server's `players` table; the output is names and numbers only.
  - At most one write per driver per 5 s; rows kept 35 days.
  - Speed Survival streaks and near misses are off the board: computer traffic exists only on the phone.
- **Checked.**
  - `node --test test/board.test.mjs` **9/9**, reproduced by this session. It covers teleport, reconnect and parked
    cases; a spike, a 2.9 s burst and a 3 s hold; drive splits; both 2026 DST dates; ordering, limits, names only, bans
    and deletions; `forget()`; a bot at 199 m/s for an hour capped at 110 m/s; and 24 writes for 1,200 poses.
  - The agent's run of the live server's `npm test` was **57/57**, and `tsc` was clean.
  - The agent also proved the wiring snippet end to end on a scratch copy of `server.mjs`.
- **Wired (17:49, that session's report):** reviewed and merged onto `claude/live-server` (merge af33cc8).
  - `/api/board` has its own rate limit, and `board.close()` runs on shutdown.
  - A new server test shows a 4.5 s drive at 30 m/s giving about 135 m and 30 m/s held; "you" appears only with a token;
    rows carry names and numbers only; a ban hides the driver and a delete removes them. The live `npm test` was
    **58/58** on a quiet machine.
  - The menu has an "Online board" pick in the Live section when a server is set; that session's browser check was
    running.
  - These are that session's results, not re-run here.
- **Still open:** an independent adversarial review of the rules before the board goes public (the owner's decision,
  queued).
- **Honest gap:** a modified client driving a perfect straight line at the ceiling can't be told apart by poses alone.
  It is bounded by the ceiling, shows under its name in a lobby slot, and a ban removes it.

## 2026-10-21 (17:50 UTC): weekly events (activities); the story's logic tested without a browser

- **Weekly events** (`story.ts` `EVENTS`): three simulated meets, each at set hours of the device's local week:
  - Dee's Cars & Coffee, Saturday 7:00 to 11:00, Glenwood Drive off the 73 South;
  - the Friday Night Meet, Friday 19:00 to 23:00, Weir Canyon Road off the 91 East;
  - Jun's Sunday Canyon Run, Sunday 8:00 to 12:00, 10 miles on the 241 South.
  While one is on, its invitation is a message in the phone (id `event@week`) with the job to get there. Each pays
  once a week. They are not real events and not gatherings of real players.
- **`tests/story.mjs`** (new, `npm run test:story`, about a second, no browser), **14/14**:
  - the unlock chains (fresh: only Mara; after her first at level 2: her second and Sal's; a home opens Dee's);
  - every job pays; every chain points at a real message; errand keys are unique;
  - events by day and hour (Saturday 9:00 Cars & Coffee, 12:00 none, Friday 20:30 the meet, Sunday 9:00 the run,
    none below their level);
  - Cars & Coffee pays once this week, not again, and again next week;
  - a race job needs both its course and its place.
- **In the browser** (17:50, the build after ec321ad; Playwright with the page's clock set to Saturday 24 October 2026,
  9:15 PDT, `timezoneId: America/Los_Angeles`, a level-3 profile):
  - the menu rail read "Phone · 3 new";
  - Messages listed Dee's "Cars & Coffee" first, then Sal and Mara;
  - her thread's job read "Errand: the Glenwood Drive exit off the CA-73 South, within 15:00 · 2,000 credits, 500 XP";
  - no page errors.
  - Not yet in the regression suite: the launch group isn't re-run while the Fable workflow renders.
- **Full suite on the build before the events** (25eb3f2: homes, the story, errands, the panels' Done bar): `npm test`,
  all groups, **66/66** (run 16:40 to 17:15 UTC, slow beside other renders).

## 2026-10-21 (17:30 UTC): activities: timed errands to real exits

- **Errands** (story job kind `errand`): six errands from five of the characters.
  - Each starts a Free Drive at the start of a real carriageway. Take the named real exit within a time limit set for
    about 50 mph on average.
  - The six: a parcel to Imperial Highway off the 57 North (5.0 mi, 6:00); a tyre to Dyer Road off the 55 South
    (4:30); a sensor kit to Jamboree Road off the 405 South (5:30); wedding flowers to Jamboree Road off the 5 North
    (7:00); coffee for the meet to Glenwood Drive off the 73 South (8:00); a charger to Gypsum Canyon Road off the 91
    East (8:00). Exits and distances were read from the data first.
  - **Delivered** is exact: the car's path becomes that sign's own exit ramp (`Game.errandTick`). The clock is game
    time, so it stops while paused. At zero the errand is called off and the drive goes on.
  - The HUD shows the clock in Free Drive's empty third slot, and "Errand: <exit> exit · <distance>" on the guidance
    line when no route manoeuvre is due.
  - Set it up from the phone chooses Free Drive and the errand's freeway.
- **Checked** (new launch check; `npm test -- --only=launch` **11/11**):
  - Sal's errand read "the Imperial Highway exit off the CA-57 North, within 6:00", and the Start pick became the 57
    North.
  - In the drive, the errand's sign was "CA 90 / Imperial Highway", 5.0 mi ahead. The HUD read "Errand: Imperial
    Highway exit · 5.0 mi" (`tests/out/launch-errand-hud.png`).
  - A copy past its clock was called off.
  - Putting the car on that sign's ramp ended the drive "Delivered" and paid 1,400 credits with "Job done for Sal Reyes".
  - Not proven: a driven approach to the ramp; the test places the car on it.

## 2026-10-21 (17:00 UTC): characters and story on the phone (Messages, Contacts)

- **Story** (`src/game/story.ts`): five fictional OC characters, ours, written for 13+ (no romance, no real people
  or businesses):
  - Mara Ortiz, who runs the tyre shop under the Orangewood studio;
  - Jun Park, an Irvine aero engineer;
  - Sal Reyes, a courier who knows every exit;
  - Dee Okafor, who organises a Saturday car meet ("no street racing, just cars and coffee");
  - Nina Hale, a Vela test driver.
- **Messages and jobs.** Twelve messages in threads, opened by level, homes owned, races won and the message before.
  Eleven carry a job built only from what the game has: a Survival score, Time Trial miles, a race placing on a named
  course, miles of Free Drive on a named freeway, or a top speed. Each pays 600 to 10,000 credits and XP, paid when a
  run meets it (`Game.settleJobs` at the end of every run and race; not on a "Too far behind" race).
- **On the phone.** Messages (threads, unread badges, the job's goal and pay, Set it up) and Contacts (the people
  you've heard from, labelled fictional) replace the two Roadmap icons.
  - Set it up goes back to the menu with the job's mode chosen, plus its course or freeway.
  - The menu rail has a Phone row with "N new".
  - The results screen lists "Job done for …" with the pay.
  - Nothing is sent or received over a network. Profile: `story { done, read }`, defaulted for older saves.
- **Checked** (new launch check, `npm test -- --only=launch` **10/10**):
  - a fresh story shows 1 unread; Mara's thread reads "Reach 120 mph · 600 credits";
  - Set it up chose Free Drive;
  - a drive ending at 134 mph paid the job (+600 credits on top of the drive's own), and the results said "Job done
    for Mara Ortiz";
  - her next message then showed as unread.
  - Screenshot: `tests/out/launch-story-thread.png`.

## 2026-10-21 (16:30 UTC): Lifestyle: homes (the life half's first piece); every panel's Done bar fixed

The owner asked for the life half and the online side toward 95 %, with homes and walk-in interiors first, online
on a free-tier backend, and the map OC-only. The online side is already the always-on session's `claude/live-server`
lane (accounts, lobby, relay, ghosts, crews, $0 on the owner's machine), so this session does not build it; it asked
that session which of its open gaps (online board, races against people) it wants handed over, and how interiors
should reuse its on-foot engine.

- **Homes** (`src/game/homes.ts`, `src/ui/Homes.tsx`): nine fictional homes in real OC neighbourhoods (Anaheim, Orange,
  Tustin, Huntington Beach, Irvine, Anaheim Hills, Laguna Canyon, Newport Beach, Dana Point), our own names, no real
  address or listing.
  - Each costs 8,000 to 240,000 credits (earned only) and opens from level 1 to 15.
  - Each owned home adds 1 to 3 garage slots (`garageSlots`, at most 12).
  - The first one bought is where you live. Homes sell back for 60 %, never if your cars would no longer fit.
  - The menu's Lifestyle row (greyed until now) and a Homes app on the phone open the panel.
  - **Start here** sets the start to the real exit nearest the home (`Game.nearestExit`; weigh stations, rest areas
    and vista points are skipped).
  - The World Map draws every home as a small house (yours filled, the one you live in ringed), lists them under
    Places, and opens on a home from the panel's "On the map", with "Start from" for one you own.
  - Profile: `homes`, `home`, defaulted for older saves without a version bump.
- **Checked.**
  - Each home's nearest exit, read from the built page: Orangewood Avenue on the 57 (0.1 mi), Glassell/Grand on the
    22, Edinger on the 55, Brookhurst on the 405 (3.9 mi: Huntington Beach is far from a freeway), Jeffrey/University on
    the 405, Imperial Highway on the 91, Glenwood on the 73, Bison on the 73, Camino Las Ramblas on the 5.
  - Found and fixed on the way: Orangewood first resolved to the 5 (its point was 1 km west), and the Hills Ranch to
    a weigh station.
  - New launch check: 9 homes; buy Orangewood for 8,000; slots 1 → 2; the level-15 home locked; Start here makes the
    Start pick read "Orangewood Avenue exit"; selling returns 4,800.
  - `npm test -- --only=launch,boot` **15/15**.
- **Every panel's Done bar** stopped 20 px above the screen's edge (the overlay's padding), and content scrolled
  visibly beneath it (seen on Profile). It now sticks to the real bottom edge with the safe area inside it.
  `tools/panel-shots.mjs` (new): Profile and Lifestyle at 1280 × 720 and 390 × 844, top and bottom, no errors, no
  sideways scroll.
- **Not a bug: panels shot at opacity 0.** In software rendering the panel's 0.3 s fade-in clock stayed at 0 for about
  1.6 s, because no frame was produced while the 3D scene rendered; the element was never remounted. The shot tool now
  waits for the animation to finish.

## 2026-10-21 (12:00 UTC): the garage's Wheels tab (U5 done); the run card saves in the viewer; the aero cover's streaks

- **Wheels tab (U5).** Two rim styles per car (`cars.ts` `WHEELS`, our own names), fitted live to the car behind the
  panel and kept per car in `settings.wheels` (validated in `readSettings`). Only the four wheels are rebuilt
  (`PlayerCar.buildWheels`); the body, cockpit and hands stay. Two new rim designs in `car-wheel.ts`:
  - **Cross Lace** (`mesh`): twenty slim spokes in crossing pairs, machined faces. Second style for the GT and the Brio.
  - **Turbine Blade** (`blade`): seven blades swept toward the rim, mirrored on the left. Second style for the Corsa and
    the Vela E.
  - The hypercar's second style is the **Aero Disc** cover.
  - Each choice has a small face-on rim drawing (SVG, `RimIcon` in `App.tsx`).
- **Checked.** Close-up renders (`tools/preview-shoot.mjs src/preview/test-car.ts`, `view=wheel-side`, new `rim=`
  query; `tests/out/wheels/`): GT Cross Lace, Corsa Turbine Blade, hypercar and Vela E Aero Disc. New launch check:
  the tab lists 2 styles; Cross Lace is fitted and saved; 4 wheels in the scene; the car's root keeps 11 children
  through both changes. `npm test -- --only=launch` **8/8**.
- **Found and fixed: the Aero Disc cover was shaded in heavy streaks** (pre-existing on the Vela E's own wheels; the
  hypercar render showed it). The dished cover's normals were averaged over the cap's long sliver triangles; they now
  come from the dish's formula. The heavy faceting is gone. Faint streaks remain in the 0.5 m close-up only. A matte
  cover kept them (not reflections); a high sun made them worse; at the garage line-up's distance they don't show. So
  they are the shadow map's resolution where the tyre's bulge shadows the cover, not the cover's shape.
- **Not a bug: old wheels on a car change.** The old code disposed of the previous wheels without removing them; a
  check on the previous build (GT, hypercar, Corsa, GT in owner mode) found the root at 11 children throughout, so
  nothing was left behind. `buildWheels` removes them explicitly anyway.
- **Run card in the viewer.** The save through the viewer's prompt was already in `runCard.ts` (fd7c0c3); the test
  artifact had never declared it. Republished with `downloads` declared (version 3); the publish no longer warns.
  Not yet tried by a person inside the viewer.
- **Customize tab** added to the garage as "coming later" (U5's last tab). `tools/garage-shot.mjs` (new,
  `tests/out/garage/`): every tab at 1280 × 720 and 390 × 844, no page errors, no sideways scroll; on a phone the five
  tabs wrap to two rows. `npm test -- --only=render` **14/14**; launch rerun on the final build **8/8**.
- **Phone size (390 × 844, touch) for the other new panels**, on this build:
  - the World Map: `tools/map-shots.mjs`, no errors;
  - the radio card: `tools/radio-shot.mjs`, tuned Coast, no errors; the card fits under the top bar, with stars,
    volume and Off/Close in reach;
  - the phone: `tools/phone-shot.mjs`, home and Credits, no errors; the Map app opened the World Map.
  - Shots are in `tests/out/phone390/`.
- **Glove stripe.** `hands.ts` now passes the driver's accent to the glove's wrist stripe. No visible change today:
  the Ace is the only gloved driver and its accent equals the old default.

## 2026-10-21 (11:45 UTC): the full suite green on the merged branch; the test build republished

- `npm test` (all groups) after the clothing merge: **62/62**. The intermittent reset check passed this time.
- **Settings rail (U8) and radial menu (U3)** (`tools/quick-shots.mjs`, `tests/out/quick/`, 1280 × 720 and 390 × 844,
  no errors): the rail jumps to a section (Sound lit); on a phone the rail is a scrolling strip. Holding Pause opens
  the six wedges round a hub that names the wedge under the pointer; releasing over the upper-right wedge opened
  "Go to" at both sizes (read back from the page), and the drive was not paused.
- **Test build** republished to https://claude.ai/artifact/9tXRF74cdLc7Po7DqHeJFS (version 2) from this build. The
  publish noted that the run card's download does nothing inside the artifact viewer (it does not grant plain
  downloads); queued below.

## 2026-10-21 (11:10 UTC): the full suite on this session's work

- `npm test` (all groups) on the branch at 06:55 (World Map, paint, radio, phone, settings rail, radial menu; before
  the clothing merge): **61/62**. The one failure: "reset puts the car back on the road, stopped" (`7.92 → 0.54 m/s`:
  the car never reached the 30 m/s the check drives up to before resetting).
- Rerun of the `render` group alone, side by side: the current code **14/14** (reset `40 → 0.01 m/s`) and this
  session's starting commit (07f46ac) **14/14** (`40.02 → 0.02 m/s`). Intermittent and not reproduced on either; the
  cause is not known (the check's speed-up is simulated time, so machine load should not matter). Watch it.

## 2026-10-21 (11:00 UTC): the drivers' clothes, a black-frame bug fixed

A lane on this session (worktree, merged as one commit) finished the drivers' clothing pass from the parked work,
rendered on the preview (`tests/out/preview/fashion2/` in its worktree, every frame looked at) and in the game:
- **The Closer**: a pressed white (ivory for her) cuff with an edge stitch and a gold cufflink (a pearl button for
  her), the gold bracelet watch with an index ring, blued hands and a crown, red polish on her nails.
- **The Ace**: black ribbed fire-suit sleeves with a small Rossini R chevron patch, black stitched gloves with knuckle
  pads and a lavender (#b9a6ff, the UI's Ace colour) stripe at the wrist.
- **The Wrench**: an olive work shirt rolled twice above the forearm with a hem stitch and a slight tan line, a
  polished titanium smart watch whose black screen shows a green grip readout.
- **A bug found and fixed**: the Wrench's cockpit rendered entirely black in the game (both presentations, 960 × 540).
  The smart watch's glass had 28 vertices with zero-length normals; the shader turned them into NaN and the
  post-processing spread it over the frame. The mesh builder now widens its stencil where points coincide and never
  emits a zero normal; the frames render (`game/wrench-m.png`, read by eye here too). Why the baseline's identical
  glass did not go black is not explained.
- **Numbers** (the preview's JSON, budget 12 calls, 220k triangles): Closer 75,744 / 6 (male), Ace 57,180 / 3, Wrench
  110,292 / 6; arms build 1.7 to 2.6 s on the shared software renderer (baseline 1.6 to 1.9 s).
- **Checked**: `npx tsc --noEmit` clean, `npm run build` clean, `npm test -- --only=boot,abilities` 10/10 on the lane.
- **Here**: the game now passes each driver's own nail colour (it hard-coded a burgundy for every female presentation,
  so the Closer's red never showed and the Wrench had polish she shouldn't).
- **Still off**: the glove stripe takes the default colour (hands.ts does not pass the accent; right for the Ace only);
  the Wrench's roll never shows from the seat; the knuckle pads read as round patches; the Closer's weave is faint.

## 2026-10-21 (06:30 UTC): the World Map, the garage's paint, the radio card; the two sessions coordinated

- **Two sessions.** Another session (the always-on one) runs lanes for the seat view, body fidelity, the freeways,
  Ultra graphics, the UI to the reference, the graphics modes and the store (`PROJECT_OC_HANDOFF.md`). This session
  stopped its overlapping lanes and pushed their unjudged work as `claude/wip-c-seat` and `claude/wip-c-world`; the
  other session agreed to build on this branch's UI and to bind the Look tokens to its three graphics modes.
- **World Map (U4)** (`WorldMap.tsx`, `tools/map-shots.mjs`): proven at 1280 × 720 and 390 × 844 in three rounds
  (`tests/out/map`, `map2`, `map3`), no errors. Round one showed labels over each other and phone views framed behind
  the sheet; labels now take boxes (shields, the race's markers and our places first, then cities from the largest)
  and every fit frames the visible part of the screen; a picked race frames its own stretch.
  Round three (`map3`, read by eye) framed the Santa Ana course clear of the sheet and the shields, and showed a real
  bug: **Santa Ana Checkpoints** ("12 km of the 5 through Santa Ana") ran between Mission Viejo and Lake Forest. I-5
  North passes Santa Ana at 0.629 of its length (measured in the game: 1.6 km from the city centre), so the course
  now starts at 0.565 instead of 0.38 (`race.ts`); old best times on it stay under the same id. Fits now also keep
  clear of the map's title (the Finish label sat under it).
- **The garage's Paint tab (U5)**: `npm test -- --only=launch` **7/7 passed**, including the new check (Sunset Orange
  reaches the car, `car.config.paint` 0xe5620b, and the saved settings; back to Rossini Red) and the theme/Look check;
  `tests/out/launch-paint.png` shows the GT behind the panel in Sunset Orange. Wheels and Upgrades say "coming later".
- **The radio card (U7)** (`RadioCard.tsx`, `tools/radio-shot.mjs`): frames at 1280 × 720 and 390 × 844
  (`tests/out/radio/`, no errors): KCST tuned from the card and playing a generated title, the starred station sorted
  first, volume, Off; on a phone it sits under the top bar, clear of the steering and pedals. Its stars were low in
  their rows; centred.
- **The phone (U6)** (`Phone.tsx`, `tools/phone-shot.mjs`): from the pause screen, at 1280 × 720 and 390 × 844
  (`tests/out/phone/`, no errors): the device clock, the driver's colour on the level line, nine working apps and
  Messages and Contacts greyed "Roadmap"; Credits shows the balance and how credits are earned; the Map app opens the
  World Map (checked by the script). Races had the same trophy icon as Bests; it takes the wheel.

## 2026-10-21 (later): the style library, a live hypercar display, a Look setting, the run card's colours

The owner uploaded their style library (branch `style-references`) and asked for continuous improvement. Logged here:

- **The style guide.** `PROJECT_OC_STYLE_GUIDE.md` reads the library (three art directions, tokens, cameras,
  navigation) against the game; its text files are copied to `style-references/`. The default and hypercar
  atmosphere uses the library's ULTRA tokens exactly (background #030915, accent #408CFF 6.1:1, secondary #8BD6FF,
  primary #DDE9F3, foreground #F6FBFF, success #6FF7DE).
- **The hypercar's display is live** (`car-gauges.ts` `hyperScreen`, `cockpit.ts`, `PlayerCar.ts`): a base drawn once,
  the speed, gear, power in use, revs and tune repainted at most 15 times a second, only when they change. The right
  pod (a battery charge and a range, meaningless on a combustion car) is the rev bar. Proof: an in-game frame at
  1280 × 720, High, day (`tests/out/cluster/hyper-live-day.png`, `tools/grade-shot.mjs`): the display reads 66 MPH in
  3rd while the HUD reads 66 and 3; no page errors. The previews keep the 132-in-sixth still.
- **Look: Futuristic or Realistic** (Settings, Display; `settings.look`, `<html data-look>`): Realistic takes the
  library's HD tokens for the surfaces, ink and shapes (graphite #0a111d, HUD plates at 86 %, 8 px corners, no skew,
  hex lattice or scanlines, a contemporary display sans); the car keeps its accent, and on the hypercar the accent is
  HD's muted blue with champagne for what's selected (contrast in the stylesheet: ink 17.3:1, blue 8.3:1, champagne
  6.9:1). Proof: `tools/atmo-shots.mjs --look=hd` on the hypercar and the GT, menu and drive (`tests/out/look-hd/`),
  no errors, read by eye: flat rounded controls, a steel-blue Drive plate, champagne selection, the GT's orange
  accent inside the Realistic shapes. A greyed Lifestyle row ("Roadmap") joins Online, from the library's navigation.
- **The run card takes the atmosphere** (`runCard.ts`): its background, glow, lane lines, hairline and accents are
  read from the page's tokens when it is drawn (falling back to the OC sunset).
- **A suite check** (launch group): the theme follows the car and driver, and the Look switches, re-points the base
  and is saved. Its first run is with the merged branch (below).
- **A cinematic camera; the menu is filmed with it** (`Game.ts` `SHOTS`, `view3`): four long-lens tracking shots cut
  hard (a low hero front three-quarter pushing in, the profile, a low rear three-quarter, a high drone), all within
  5 m of the car so none needs to know where the walls are; "Cinematic" is last in the View cycle; the menu's attract
  drive uses it, a run still opens in the driver's seat. Proof (`tools/atmo-shots.mjs --shot=0`): the first frames
  (`tests/out/cine/`, hypercar and GT, no errors) put the car's lower body behind the mode cards, so the hero tilts
  down 0.07 rad; the reshoot after the atmosphere settled (`tests/out/cine2/oc-hyper-menu.png`, no errors) shows the
  hypercar at dusk, its ice-blue blades and splitter strip lit, clear of the cards and right of the rail, as on the
  library's ULTRA home screens.

## 2026-10-21: the ice reference: the UI re-themed, the menu and drive HUD rebuilt, the hypercar's lights and cluster judged (branch `claude/hypercar`)

The owner sent a second concept board (the menu with the hypercar as its hero, and the cockpit HUD, in a navy and
ice-blue colour world) with "keep rendering graphics for this car and HUD interface as well as overall themes of
colour". What it maps to is written in `PROJECT_OC_UI_TARGET.md` ("Owner's direction, 2026-10-21"). Two lanes ran at
once: the UI (theme, menu, HUD) and the hypercar's lights and cluster (M2, judged for the first time).

- **Theme ("Ice noir", `src/ui/styles.css`).** The sunset tokens became the ice family with the same roles (`--ice`
  press and focus, `--cyan` selected, `--ember` danger only); the base went from violet-black to navy-black; chrome is
  a touch cooler. Contrast is in the token comments. Every screen re-themed from the tokens; no rule needed its own
  colour. The page's theme colour is #04070d.
- **The OC mark in chrome** (`Mark.tsx`, `.oc-mark`): the owner's letterform alpha filled with brushed chrome, lit from
  below in ice. The 480 px sunset cut-out stays for the run card; the 1200 and 240 px cut-outs are out of the repo
  (the bundle's images went from about 157 KB to 58.5 KB inlined). The name stays OC Ultra: Top Speed.
- **The menu** (`App.tsx`, `ModeArt.tsx`, `Icons.tsx`): the rail (brand, Drive, Car / Driver / Start on or Race with
  line icons, the traffic chips labelled simulated, Profile, Bests, Settings, Online greyed "Roadmap"), the player card
  (avatar, name, level with an XP bar, credits without a currency sign), the live attract drive as the hero, the four
  modes as picture cards (four SVG night scenes drawn in code) with the brief above them, the Loop Lab card and the
  data credits under them. Phones: one column, Drive fixed under the thumb. Every accessible name the suite and
  `tools/ui-shots.mjs` use is unchanged (Drive, Settings, Bests, Profile, the `.pick` rows, the mode radios).
- **The drive HUD** (`HUD.tsx`): the mode line and the small chrome OC on the top-left plate; the road as a guide sign
  (the route shield, then the direction; the OC mark left the route chip for the mode plate); the controls as an icon
  rail down the right with a mouse, a strip along the top on phones; the speed block with the revs as a slanted ice
  bar (scaleY now), big numerals, the gear in an outlined box, and chips: the handling profile (Arcade under 0.35,
  Sport under 0.75, Sim), ABS and TCS (both run at every handling setting in `Physics.ts`), Unleashed for the
  hypercar in Free Drive; the round road map bottom left with a mouse (the game reads the window's rect from the DOM,
  so the sky camera still draws where its box is). The ability hexagon moved left of the wider block.
- **The hypercar (M2 judged, `src/preview/car-*.ts`, `cockpit.ts`, `car-gauges.ts`, `PlayerCar.ts` lamp colours).**
  The night renders of the WIP showed every LED blown out to white under ACES (a pale material colour at emissive
  2.4 to 2.8). The material blues are now deeper so the tone-mapped result lands on the reference's screen colours:
  `led: { color: 0x5eb8ff, halo: 0x1e6fd8, edge: 0x0c4fb8 }` (hypercar only; `ledTex` gained an optional edge stop
  with the cache key unchanged when it is omitted); the blade lamp texture the same family; the dash line's intensity
  1.4. Sampled in the hero render (sRGB): splitter (151, 201, 240), blade (128, 153, 186), sill (133, 162, 194)
  against the reference's (122, 152, 190) strips and (176, 219, 245) core. A driver display of its own
  (`hyperScreenTex`: OC, 132, MPH, the gear in a box, hexagonal ice frame, a kW pod and a segment bar, the centre
  screen SPORT / ABS TCS) replaces the Vela's on the hypercar's binnacle, centred on its driver at 88 % on a carbon
  plinth; beams 0xd4e8ff and an ice-tinted road pool for the hypercar only (the other cars keep 0xfff4e6 and the
  white pool). Calipers already read royal blue; the OC centre cap already reads.
  - Renders (960 × 540, night, showroom key, `tests/out/preview/ice/`): hero, front, rear34, wheel, seat, dash, with
    the before pair for hero, front, seat and dash. Own cost unchanged: 32 calls / 246,612 triangles on `high`
    (budget 40 / 260k); the interior went from 63 / 170,307 to 60 / 167,389 (one screen replaces the tach assembly).
  - The Corsa's side view before and after: 0 of 518,400 pixels differ by more than one level (max 0).
  - Still off against the reference: the rim's top band clips the small OC mark in the seat view (it fits in the
    dash view); the caliper's OC lettering is clipped (M1b item 9); the rear LEDs read thin at the rear 3/4 distance;
    "132" is not a true light weight (headless Chromium has no light face); the body's shape gaps stay M1b's. The
    beam colour change is type-checked and rendered in the preview, not yet looked at in a game night frame.
- **The atmosphere follows the car** (owner, later the same day: "every specific car we choose, each one representing
  a different atmosphere"). `App.tsx` sets `<html data-car>` from the car in the garage (the garage re-renders the
  App when a car is picked, so it switches live), and `styles.css` re-points the tokens per car: the hypercar is the
  ice reference; the Rossini GT keeps the owner's OC sunset over violet-black (the wordmark's colours, so the starter
  car opens in the identity the owner gave on 2026-10-16); the Brio is aqua over deep sea green; the Corsa racing
  yellow on graphite (its Drive plate takes black ink, `--on-deep`); the Vela E violet over plum with a magenta
  flash. The Drive plate's fill and ink come from tokens (`--ice-deep-2`, `--on-deep`). Contrast per block is in the
  stylesheet. Proof: `tools/atmo-shots.mjs` (new) picks each car through the garage and shoots the menu and a drive
  frame into `tests/out/atmo/`; on the final build it shot all five cars with no errors (`tests/out/atmo/<car>-menu.png` and `<car>-drive.png`, 1280 × 720), each read by eye: the rail, the player card, the cards and the HUD take each car's colours, the Drive plate keeps its ink readable on every fill, and the hypercar's drive frame shows the Unleashed chip. Known and by design: the hypercar's cluster is a static texture (it reads 132 while the HUD reads the live speed), like the GT's digital window; a live cluster is a later step. The first run of the tool timed out on screenshots while the suite ran beside it; the tool now waits up to 180 s for a frame and returns to the menu after a failure.
- **The driver's layer, the futuristic details, the menu's atmosphere per car, an Ultra grade** (owner, later the same
  day: "do the same for each driver ... keep upscaling the ultra graphics ... a more futuristic theme"). The driver
  signs the human elements with `--drv` (`<html data-driver>`): The Closer gold #ffd166, The Ace lavender #b9a6ff
  (the first lavender-white, #d4dbff, read as plain ink in the shot and was changed; 9.6:1 on the darkest base), The
  Wrench green #7dffa8. Decoration: a hex lattice behind the glass, chamfered HUD plates with scanlines, brackets on
  the speed block, a slow accent sweep on the rail (off with reduced motion). The menu's attract drive takes the car's
  atmosphere (`CarDef.atmosphere`, `Game.syncAtmosphere`): hypercar night, GT sunset, Brio cloudy sunset, Corsa clear
  day, Vela E misty sunrise; a run uses the player's settings; the car's atmosphere holds on the menu only until the
  player changes time or weather that session and never reaches the saved settings. Ultra only
  (`QualityPreset.grade`): a grade pass (vignette, radial chromatic aberration about 1.5 px at the corners, a grain
  proportional to the pixel so the night's blacks stay black; the lane's first version added the grain linearly,
  which would lift black by about 28 levels, and was changed before any render) and a bloom at threshold 0.85,
  strength 0.3. Proof: `tools/atmo-shots.mjs` on a clean worktree (HEAD plus only these files, since two other lanes
  had unbuilt work in the tree): all five cars and all three drivers shot with no errors (`tests/out/atmo3/`), each
  read by eye: the GT at sunset with its flare, the Vela in a hazy dawn, the hypercar at night with its beams on the
  road (its first menu shot caught the sky mid-ease, by design a few seconds), the Corsa in daylight; the Closer's
  gold and the Wrench's green on the Driver row and the avatar ring. The hypercar at night in a run (`tools/grade-shot.mjs`, 640 × 360, `tests/out/attract/ultra-night.png` and `high-night.png`, no page errors): the two frames read close to identical at this size, the grade is subtle by design (a slightly darker rim on Ultra, no visible fringing or grain at 640 px, no lifted blacks), and the bloom change does not blow out the sky. At 640 × 360 the HUD covers much of the frame; a larger frame is the better judge once the world lane lands.
- **Checked:** `npx tsc --noEmit` (both configs) clean. `npm run build` clean. `tools/ui-shots.mjs` at 390 × 844 and
  1280 × 720 (`tests/out/ui-ice2/`), every screen read by eye: the rail, the player card, the cards, the sign plate,
  the icon rail, the speed block and the round map all read; one layout bug found and fixed on the first pass (the
  rail's nav row was too short, clipping the traffic chips and the rows under them; the nav now takes the rows above
  the cards). `npm test -- --only=boot,phone,launch` on the final build: **16/16 passed** (boot 6, phone 5 including "menu fits a 390 × 844 phone" and "driving HUD: top bar clear of the gear readout", launch 5 including the run card download). Run before the one-line short-window rule that hides the lede under 760 px tall.
- **Not done:** the `render` and `race` suite groups were not run in this session (the HUD's race plate was
  re-themed, not restructured); a real-phone look; the owner's wording "Project OC / Orange County Freeway Simulator"
  in the lockup is the owner's call (one line in `Mark.tsx`).

## 2026-10-20: the OC Hypercar is drivable (owner mode), on the finished physics

The owner asked for the hypercar "ASAP". Branch `claude/hypercar-drive` = the body (`a137e50`) + the vehicle-dynamics
model (`claude/drift`) + its car entry. It is a procedural model built in code, not a finished 3D asset.

- **Two tunes.** Free Drive runs Unleashed (1,690 kg, 1.5 MW, 2,000 Nm, all-wheel drive 40% front, torque vectoring,
  fan-level downforce ClA 2.2, tyres 1.8× stiffer, 2 g brakes); Races, Time Trial and Survival run the race tune
  (1,500 kg, 620 kW, ClA 1.0, default tyres and brakes). The tune is picked when a run starts (`tuneFor`), and the start
  toast says which ("Free Drive · Unleashed", "Time Trial · race tune").
- **Measured** (`node tests/dynamics.mjs`, 1,742 passed, 0 failed): Unleashed 338 mph, 0-60 2.20-2.82 s, 100-0
  56-68 m, lateral g 1.58 / 1.44 / 1.05 at 25 / 40 / 80 m/s (h 0.15); first on every metric. The rear-drive-only checks
  (power-over and held-drift entries, the ABS-off lock time) are reported for it, not bound: its all-wheel drive and
  vectoring stop those slides by design. In the game (owner mode, I-405 North, autopilot): 53 mph after 2 s, 261 mph
  within 45 s, no page errors; frames in tests/out/hyper-drive/.
- **Garage.** It shows as the fourth card ("Founder Edition · not on sale yet (test build)"); never bought or sold for
  credits (`profile.buy`/`sell` refuse it); drivable in owner mode. Groups `boot` and `progression` 12/12.
- **Not done yet.** The full seat drop (for now its eye sits 0.13 m lower and 0.07 m further in, so the roof clears
  the view; the dash top still crosses the lower view), the lights and its own cockpit touches (M2), Cold Thrust /
  Ground Lock / Thrust Hop (M5), the Founder exclusives (M6), the face and rear fidelity (M1b), and the axle spin
  scaled to its tyre sizes.

## 2026-10-17 to 19: the OC Hypercar's body repaired after review (hypercar M1 repair, branch `claude/hypercar`)

Two reviews (art and code) rejected M1: honest and in budget, but not recognisably the sheet's car outside the side
view, with a headlamp show-through the report left out and a cost comparison that mixed measures. The M1 code was
fixed in place, not reverted. It is still a **procedural model built in code**, not a finished 3D asset, and it still
has no `CarDef` (the garage and the game can't reach it until M3).

The repair took ten passes. The first nine (October 17 to 19) stopped before they finished: their logs end
part-way through the final renders, the suite run or the report (the sixth pass's suite run also lost its browser in
the `phone` group). This is the tenth pass's report, on the code as it now stands. **Every render, number and check
below is from the last two passes, on the same code** (October 19): the ninth pass rendered the side, the phone
side, the front, the rear and the two Corsa budget rows (21:58 to 22:03 UTC); the tenth rendered the rest (from
22:57), re-ran the body-number probes (the same figures as the ninth's, to the millimetre), and produced the sheet,
the crops, the colour samples, the other cars' check, the suite run and this entry. Two things come from earlier
passes and are named where used: the "before" renders of the other cars' check (renders of the unchanged copy of the
code, which can't have changed), and figures quoted as history of what a pass changed. Neither pass changed the car's code; the ninth added a preview-only camera (`test-car.ts`
`&cam=x,y,z&at=x,y,z&fov=`, for close looks at one detail; no view uses it unless asked). The last changes to the
car are the sixth pass's (the paint's metalness and the blades' light guide) and the seventh's (the wheel's prongs);
both are described below.

- **A two-tone drawn by the paint shader** (`car-mats.ts` `PaintMask`, `ShapeParams.masks`): convex regions in the
  car's top, front or side plane where the paint turns gloss black (no metal, a rougher base, a softer clear coat),
  with an optional limit on the plane's own axis. Nothing is laid over the skin, so it can't z-fight, and the edges
  are crisp at any distance. The mask code is compiled only into a paint that has masks (its own program), so the
  other four cars' paint shaders are exactly what they were. The hypercar uses 14 of the 16 mask slots.
- **TOP** (`hyper-top-r2`, overlay in `hyper-vs-ref-r2`):
  - The canopy is a narrow teardrop: half-width 0.50 m at the cabin against the body's 0.925 m (54 %; was 0.75 m),
    and the windscreen's base 0.47 m against 0.976 m at the cowl (48 %; was 0.70 m, 72 %). It narrows to 0.11 m at the wing. The roof from the windscreen's
    header back to the rear screen is smoked glass (`roofGlass`), so from above the canopy reads as one dark teardrop
    between silver flanks.
  - A dark spine runs from the rear screen to the tail; the canopy's steep flanks either side stay silver (the
    buttresses). Either side of it, a lens-shaped opening on the deck with three silver ribs across it, and the
    tail's deck centre is dark. The rectangular louvre panel and the engine-lid shut line are gone.
  - At the front, a dark V runs from behind the badge to the windscreen, and two long louvred vents lie along the
    fenders' inner walls by the cowl (`ventsQ`, a new quad vent). The four square vent patches are gone.
  - A dark channel runs along each side of the canopy's base, from the cowl vent back into the opening on the deck
    (|x| 0.47 to 0.63 m; two mask regions that overlap, so no seam). With it the front fenders and the rear haunches
    read as separate silver pods.
- **FRONT** (`hyper-front-r2` and `hyper-front-night-r2`, camera 1.0 m up; was 1.6 m):
  - The bonnet is sunk between peaked fender crests: a new `crown` makes the deck rise as u^2.6 from the centre to
    the crest. At the front axle the bonnet's centre is 0.533 m and the crests 0.792 m (at |x| 0.765 m).
  - The blades are slim: the lamp patch is about 5.5 cm deep (was 12 to 15). They sit on the fender's lower edge,
    silver above, and there is no dark field round them. Each one's outer end bends back up the fender's corner
    (`bladeSweep` 0.125: z += 0.125 u^3 along the blade, the lens kept square to its front edge so it doesn't shear):
    its front edge climbs steadily from 0.384 m at the inner end to 0.527 m at the outer (nine points along it; the
    sheet's FRONT reads about 0.30 to 0.48 m). The black below the blades follows the curve in five convex mask pieces, each overlapping the next by
    3 to 6 cm, so no half-tone seam shows where two meet.
  - **Sixth pass: a bolder light guide.** The ice-blue line along each blade's front edge is bolder: a fifth of the lens's
    depth at the inner end to a third at the outer (it was a ninth to a quarter), with its halo following it (`lampTex` `'blade'`, used only by this car). The sheet's HEADLIGHT DETAIL shows a thick,
    hard-glowing line; the thin one read as a scratch at a distance.
  - The whole lower nose below the bonnet's leading edge is gloss black across the full width: the silver bonnet
    comes down to a gentle V at the badge (0.35 m up in the middle), and the blades, the fangs and the main intake
    sit in one black band, as on the sheet's FRONT. The OC badge is on the silver just above the edge.
  - A tall 'fang' corner intake under each blade's outer half (|x| 0.60 to 0.84 m, 0.10 to 0.30 m up), with its LED
    running down the intake's outer edge and forward along the splitter to its corner (it was an S-curve on the
    fender's side).
  - The canopy springs from the deck at the cowl: the 0.10 m step under the windscreen is gone.
- **REAR** (`hyper-rear-r2` and `hyper-rear-night-r2`, camera 1.0 m up; was 1.3 m):
  - The deck's centre is lowered between the haunches, so the haunch crests (0.875 m at the rear axle, |x| 0.785 m) stand 0.15 m above the deck
    at |x| 0.3 m (0.725 m). The spine, the ribbed openings and the fins sit
    in that recess under the wing.
  - The tail below the bar is a recessed black well (1.2 × 0.22 m, 0.1 m deep, a mesh 0.03 m in) with the plate in it.
  - The diffuser's mouth is a wide trapezoid under the plate: 0.47 m half-width at its top, 0.67 m at the floor, with
    eight carbon strakes. Its LED outline runs across the top, down the slanted sides and out along the floor to the
    tail's corners, as on the sheet's REAR.
- **WHEELS** (`hyper-wheel-r2`): five spokes, each splitting in two toward the rim (ten prongs, from the WHEEL DETAIL
  panel; was ten split spokes), a gloss-black lip (no polished ring), a dark grey disc (tint 0x5c6068) and darker
  rubber (tint 0x7a818e). **Seventh pass: straight prongs.** The halves of each spoke now part linearly from 36 % of
  its length (the gap grows with the radius, 0.17 rad either side at the rim), so each prong runs straight to the
  rim as the sheet's forks do; the sixth pass's smoothstep made them S-curves that read as tentacles in the wheel
  render. Same triangles. Sampled in the wheel render (mean sRGB of 9 × 9 boxes): the disc (23, 19, 16) and (1, 1, 1), the
  sidewall (31, 24, 19) and (29, 22, 17), so the face and the tyre read black, not bronze; the drilled disc keeps a
  faint warm cast in the golden-hour light. A thin reflection still runs round the lip.
- **PAINT**: 0xc8d3e8 at metalness 0.3, roughness 0.27 (M1 had 0xbfc4cc at 0.8 and 0.22; the fifth pass 0.5). **Sixth
  pass:** the front and rear views face away from the golden-hour sun, so at metalness 0.5 they read mid grey; at 0.3
  the paint takes more of the sky's light and reads lighter there, with the same reflections in the side view.
  (The sixth pass measured the front view's fender at (123, 134, 156) at metalness 0.5.) Sampled (mean sRGB of 9 × 9 boxes;
  the boxes are marked in the session scratchpad, `m1r11/it/sample-*.png`):
  - side view, lit by the low sun: the door (204, 198, 197) and the rear quarter (218, 211, 208). Light and close to
    neutral, with a faint warm cast from the golden-hour test sky's pink horizon.
  - front and rear views, which face away from the sun: the front fender (139, 148, 167), the bonnet
    (140, 148, 165) and the rear haunch (140, 147, 161). A cool mid grey, not the sheet's bright silver (see the gaps).
  - under the preview's showroom key at night: the front fender (209, 216, 229) and the bonnet (176, 186, 205) in the
    front view. Surfaces that face away from the overhead strips stay dark: the rear haunch (49, 61, 88) in the rear
    view, and the door (62, 72, 97) in the hero.
- **Night**: the preview has `&key=showroom` (three overhead strip lights, preview only, not the game's light), so
  the silver reads as it does on the sheet (`hyper-hero-r2`, `hyper-rear34-r2`, `hyper-front-night-r2`,
  `hyper-rear-night-r2`). The game's own night is unchanged.
- **Artefacts**:
  - The gloss-black field under each blade is gone (found in review: the silver skin pierced it in ragged islands on
    both builds; see the M1 gaps below). The dark is now the paint's own mask. The 3× crop of the nose
    (`hyper-nose-3x-r2`, x 140-420, y 250-380 of the golden-hour hero, `high` above `phone`) is clean on both builds: no silver islands, no seams and no dark speckle at the far corner. The lamp patch
    stands 5 mm off the skin on `high` and 8 mm on `phone`, as does the corner intake's frame.
  - The phone build's zigzag on the scoop's front crease and the stepped highlights round the side intake
    (`hyper-scoop-3x-r2`, x 300-600, y 230-340 of the side view, `high` above `phone`): the zigzag and the steps are gone on both builds; a faint wave remains at the intake's upper rear
    corner on `phone`. Through each raked
    end of the scoop the stations are finer (0.018 m on `high`, 0.03 m on `phone`), and each quad there is split
    along the diagonal that lies closer to the surface.
- **WING**: a legible close render (`hyper-wing-r2`, golden hour): the carbon weave on the main plane, both swan
  necks, the end plates and their LEDs, the flap's LED, the spine, the ribbed openings and the fins.
- **Lineup** (`hyper-lineup-r2`): all five cars nose to tail on one floor (the view opens its lens to fit them).
- **Body numbers** (from the body functions, esbuild + node, re-run by the tenth pass, equal to the ninth's): roof peak 1.121 m at z 0.15 (sheet 1.05); rear haunch
  0.875 m (0.85); tail top 0.700 m in the middle, 0.650 m at the shoulder (0.73).
- **Budget** (the page's JSON line, side view, the same measure for every row; own cost = car shown minus car hidden,
  scene = the whole frame with the car shown; both include the shadow pass. The stage's last-frame
  `renderer.info` is not used, because it may or may not include the shadow pass):

  | Car | Own cost: calls / triangles | Scene: calls / triangles | Plan budget (own) |
  | --- | --- | --- | --- |
  | Hypercar `high` | 29 / 245,994 | 33 / 248,008 | ≤ 40 / 260,000 |
  | Hypercar `phone` | 29 / 125,756 | 33 / 127,770 | ≤ 36 / 135,000 |
  | Corsa `high` | 31 / 219,861 | 35 / 221,875 | |
  | Corsa `phone` | 31 / 114,157 | 35 / 116,171 | |

  Against the Corsa, like for like: two calls fewer on both builds, and 11.9 % more triangles on `high` (+26,133)
  and 10.2 % more on `phone` (+11,599). The repair added 8,307 triangles on `high` (237,687 before) and 417 on
  `phone` (125,339); the sixth and seventh passes' changes add none. No NaN positions: the page's geometry check reported
  none in any of the 14 hypercar renders listed below, nor in the two Corsa rows.
- **The other four cars are unchanged, within render noise.** Eleven views of them rendered by the tenth pass
  from this worktree (GT side, front and seat; Brio side, hood and rear; Corsa side on both builds, and chase; Vela
  side, and top on `phone`), each compared pixel by pixel with a render of a copy of the code before M1 (equal to git
  HEAD for all 128 tracked `src` and `tools` files, re-checked by the tenth pass; those renders were made by earlier
  passes, October 17 and 19, plus two by the tenth for noise pairs; the log is `m1r11/diff.log` in the session
  scratchpad):
  - Identical (0 pixels): GT side and Corsa side `high`.
  - A few pixels by one level: Brio side 4, Brio rear 2, Corsa side `phone` 1, Vela side 1, Vela top `phone` 8.
  - GT front: 60 pixels by one level, in the band where two renders of the unchanged copy differ by 64.
  - GT seat: 86 pixels (up to 122 levels), in the box where two renders of the unchanged copy differ by 85.
  - Brio hood 3,624 and Corsa chase 814 pixels, by one level, all in the sky above the horizon (rows 0 to 165 and 0
    to 115); no pixel of any car changed. That band varies from one render to the next: two renders of the
    unchanged copy's chase differ by 1,799 pixels, and this worktree's hood and chase from the sixth pass and from
    the tenth differ by 915 and 1,433 (the code between those two differs only in the hypercar's wheel and a preview
    camera, neither of which these cars use). Two renders of the unchanged copy's hood happened to match exactly.
  - The lineup (`hyper-lineup-r2`) shows all five cars together on one floor.
- **Renders** (`tests/out/preview/`, 960 × 540, from the ninth and tenth passes as above): `hyper-side-r2`, `-front-r2`,
  `-front-night-r2`, `-rear-r2`, `-rear-night-r2`, `-top-r2`, `-wheel-r2`, `-wing-r2`, `-hero-sunset-r2`,
  `-hero-r2` (night, showroom key, bloom), `-rear34-r2` (the same), `-phone-side-r2`, `-phone-hero-sunset-r2`,
  `-lineup-r2`, `hyper-corsa-high-side-r2` and `hyper-corsa-phone-side-r2` (the budget rows), the crops
  `hyper-nose-3x-r2` and `hyper-scoop-3x-r2`, and the sheet `hyper-vs-ref-r2.png` (every reference panel beside its
  render, with 50/50 overlays for the side and the top). The pre-repair renders, including the stale
  `hyper-back-ortho.png` and `hyper-wheel-side.png`, were moved out of the folder (to the session scratchpad,
  `m1r/superseded`), so it shows only the current car. (The plan's two Corsa renders, `hyper-plan-corsa-*-side.png`,
  stay: they are the plan's own evidence.)
- **Gaps, honestly:**
  - **The seat drop still isn't built** (decision 1). The narrower canopy lowers the roof over the shared eye (x −0.37, z 0.10) to
    1.067 m, 0.093 m below the 1.16 m eye. With the 0.15 m drop (eye 1.01 m) it leaves 0.057 m of headroom, and at
    the eye's height the canopy's flank is 0.43 m out, 0.06 m from the eye. M2's cockpit should seat this car's driver further in
    (the sheet's occupants sit about ±0.25 m from the centre; the outside view's cabin silhouette already does,
    `seatX` 0.27), or the canopy must widen again.
  - **The TOP is closer, not identical.** The sheet's plan is a sculpted dark canopy with flying buttresses and deep
    openings into an engine bay; ours draws the openings as gloss-black regions of the paint with ribs over them,
    not holes. The front fenders' outer vents aren't built, and the sheet's TOP and SIDE disagree (§3 of the plan).
    The front fenders in the top view show a stepped edge in their reflection, and in the golden-hour hero the clear
    coat (roughness 0.03) mirrors a torn dark streak on the front fender over the arch: both come from the preview's
    reflection probe, a 128-pixel cube shared with every car. It is preview only (the game gives the car no probe;
    `car-probe.ts` is imported only by `test-car.ts`), so it was not changed.
  - **The blades** are bolder now but still a line on a slim lens: the sheet's lamp has a deeper dark lens with a
    small module above the line.
  - **The REAR**: the cabin's rounded back still shows over the deck between the wing's mounts, where the sheet has
    a busier structure. The bar's ends don't sweep down as on the sheet. Where the carbon lower body meets the silver
    at the rear corners (`lowCarbon`, whole skin triangles sent to carbon) the edge is stepped, seen in the rear and
    rear 3/4 views.
  - **Warm light on the dark parts.** In the golden-hour test light the carbon and the gloss black reflect the warm
    horizon at grazing angles, so the splitter's top and the lower ends read brown-grey in the side and hero views
    where the sheet's night showroom shows them black.
  - **The dark V** reads grey at low angles: it reflects the sky.
  - **Silver in shade.** The sheet's paint is bright cool silver everywhere; ours reads that way only where light
    falls on it. In the golden-hour test light the front and rear views (facing away from the sun) read a cool mid
    grey, about (140, 148, 165).
  - **The night look** comes from the preview's showroom key. On the game's freeway at night the car still reads dark.
  - **The caliper's OC mark** is clipped by the caliper's upper edge in the wheel render and reads as a fragment.
  - The interior is the Corsa's until M2's `'hyper'` interior.
- **Blockers for M3** (recorded in the plan's M3 row): the seat drop (and the driver's position) must land before the
  car gets a `CarDef`. `PlayerCar.update` spins both axles at `vx / SPEC.wheelR` (0.345 m), but this car's tyres are
  0.35 and 0.37 m, so each axle's spin must be scaled by `SPEC.wheelR / r`.
- **Checked** (tenth pass, October 19, 22:56 to 23:26 UTC; logs in the session scratchpad, `m1r11/`):
  - `npx tsc --noEmit` is clean on both configs (`tsconfig.json`, which includes all of `src`, and
    `tsconfig.game.json`), and `npm run build` succeeds (single file 3,494 KB of JS).
  - `npm test -- --only=boot,render,phone`: 24/24 pass, exit 0 (boot 6, render 13, phone 5). These groups never
    reach the hypercar (it has no `CarDef`); they show that the shared code the repair touched (`car-body.ts`,
    `car-mats.ts`, `car-wheel.ts`, `car.ts`, `PlayerCar.ts`) still builds and drives the other cars.
  - Every render named above was looked at by eye, and the nose and scoop at 3× (`hyper-nose-3x-r2`,
    `hyper-scoop-3x-r2`).
  - The diff names no real car maker or product.

## 2026-10-17: the OC Hypercar's body, paint, LEDs, wheels and badge (hypercar M1, branch `claude/hypercar`)

The OC Hypercar Prototype 01 from the owner's reference sheet, as a **procedural model built in code**: one
parametric body, with its materials, lights and textures generated at load. It's not a finished 3D asset, a scan or
a downloaded model. It exists in the previews only: it has no `CarDef` until M3, so the garage and the game don't
offer it yet.

- **The car** (`car-shape.ts` `HYPER`): `CarId` `'oc-hyper'`, brand `'oc'` (new in the brand union; `badgeTex`,
  `carMaterials` and the cockpit's hub badge take it). 4.72 m long, 3.00 m wheelbase, staggered 0.70 / 0.74 m tyres
  (`axle.rR`), from `PROJECT_OC_HYPERCAR.md` §3.
- **Nose and tail styles `'hyper'`** (`car-body.ts`):
  - At the front: the deep stepped carbon splitter (a raised second tier, tall end plates, an LED along its edge),
    the central opening with carbon blades and a centre fin, `'blade'` headlamps on gloss-black fields, and an LED
    from each blade down the corner into the splitter. Louvred bonnet vents ahead of the cowl, and a centre crease
    up to a carbon fin.
  - Along the sides: a deep door scoop whose ends lean back down the side (new `scallop.rake`, with `pow`), a black
    diagonal intake ahead of the rear wheel, and taller carbon skirts with two LED lines.
  - At the rear: twin fins on the deck, the big wing on swan necks with end plates (`wing.plate`) and LEDs, and the
    full-width red bar (`tail` material, so it brightens on the brakes in M2). A carbon diffuser with eight fins, an
    LED round its mouth, the OC plate, and two small thruster nozzles set dark into the diffuser for M5.
- **Materials**:
  - Paint: cool light silver (0xbfc4cc), metalness 0.8, roughness 0.22, fine flake on High, clear coat 1.
  - LEDs (`car-mats.ts` `led`): ice blue (core 0xa6dcff, halo 0x2f8fe8), emissive 2.8 on the `high` build (over
    the 0.92 bloom threshold on High and Ultra) and 1.7 on `phone`.
  - Carbon on the aero, the skirts and the lower ends.
- **Wheels** (`car-wheel.ts` `'multi'`): ten thin gloss-black spokes that split toward the rim, a lower sidewall
  (`sidewall: 0.75`, a 22-inch look), blue calipers (0x1f4fd8) and a bigger OC centre cap. No tyre lettering (M2,
  optional).
- **The OC mark** (`oc-mark.ts`): traced once from the owner's mask (960 × 343) to two outlines. The car draws it in
  code, never stretched, on the nose badge, the rear plate, the wheel caps and the calipers.
- **Measured from the body functions** (sheet value in brackets): roof peak 1.121 m at z 0.15 (1.05), rear haunch
  0.869 m (0.85), tail top 0.726 m (0.73).
- **Renders** (`test-car.ts`, 960 × 540), in `tests/out/preview/` (moved to the session scratchpad, `m1r/superseded`,
  by the repair above, whose `-r2` renders replace them):
  - `hyper-front`, `-rear`, `-side`, `-top`, `-hero` (night, bloom), `-hero-sunset`, `-rear34` (night, bloom) and
    `-wheel`
  - `hyper-phone-side` and `hyper-phone-hero-sunset`
  - `hyper-vs-ref.png`: every reference panel beside its render, with a 50/50 side overlay with the hubs aligned
  - The preview gained views `hero`, `rear34`, `back-ortho`, `top-full` and `wheel-side`, and the options
    `&time=night`, `&bloom=1` (the game's bloom pass) and `&cy=`.
- **Budget** (the page's JSON line, side view; own cost = car shown minus car hidden, shadow pass included):

  | Car | Own cost: calls / triangles | Plan budget |
  | --- | --- | --- |
  | Hypercar `high` | 29 / 237,687 | ≤ 40 / 260,000 |
  | Hypercar `phone` | 29 / 125,339 | ≤ 36 / 135,000 |
  | Corsa `high` | 31 / 219,861 | |
  | Corsa `phone` | 31 / 114,157 | |

  No NaN positions on either build (the page's geometry check logged none).
- **The other cars are unchanged.** Renders from a copy of the code before this work, compared with renders after
  it:
  - Corsa side `high`: identical, 0 pixels.
  - Corsa side `phone`: 2 pixels, by 1 level.
  - Vela top `phone`: 10 pixels, by 1 level.
  - Brio rear `high`: 2 pixels, by 1 level.
  - GT front `high`: 76 pixels, by 1 level. Two renders of the unchanged copy differ by 64 pixels in the same band,
    so this is render noise.
- **Gaps, honestly:**
  - **The seat drop isn't built** (the owner's decision 1). The roof over the shared eye is 1.113 m, 0.047 m
    *below* the eye (1.16 m). So the cockpit view of this car is unusable until the seat drop lands, which has to be
    before M3 makes it drivable.
  - **The top view** shows rectangular glass panels and louvres, not the sheet's dark teardrop canopy with its
    flying buttresses.
  - **The roof** is 1.12 m against the sheet's 1.05 m.
  - **The night preview** has no street lamps or headlights, so the body reads dark and the LEDs carry it.
  - **The phone build** shows a small stepped highlight on the scoop's front crease.
  - **Found in review, not in this report:** the gloss-black field under each blade (lifted 2.8 mm along the skin's
    normal) was pierced by the silver skin on both builds: ragged silver islands in the dark field and dark speckle
    round the far lamp. Fixed in the repair above (the field is gone; the dark is drawn by the paint).
  - The interior is the Corsa's until M2's `'hyper'` interior.
- **Checked**:
  - `npx tsc --noEmit` (both configs) is clean, and `npm run build` succeeds.
  - `npm test -- --only=boot,render,phone`: 24/24.

## 2026-10-16: owner mode, every car unlocked for the owner (hypercar M0, branch `claude/hypercar`)

The owner wants to "use all the cars I want" right now. Owner mode is a test-build switch, **not security**: anyone
who types `#owner` gets it. Before any real sale it has to be compiled out of public builds or tied to the owner's
signed-in account (`PROJECT_OC_HYPERCAR.md` §8, M0, and decision 5).

- **The switch** (`src/game/settings.ts`): the setting `owner` (boolean, default off, only `true` counts when a save
  is read). Opening the game with `#owner` turns it on and saves it; `#owner=0` turns it off. An artifact link keeps a
  bare `#anchor`. The hash is also read while the page is open (`hashchange` in `App.tsx`). Settings has a new
  "Testing" group with the toggle "Owner mode (all cars unlocked, test builds only)".
- **The garage** (`App.tsx` `GaragePanel`, kept small because another branch is restyling it): a black-on-amber
  "Owner mode" chip beside the heading (12.45:1) and a line saying the saved garage doesn't change. Every listed car
  has Drive with no credits, level or slot. Buy and Sell are hidden while owner mode is on.
- **What the garage lists** (`cars.ts` `garageCars`): the GT, the Brio and the Corsa. The Vela E stays in the game but
  shows only in owner mode or once the profile owns it (owner, 2026-10-16). The hypercar isn't built yet (M1), so a
  normal garage lists three cars until then.
  When it lands, the hypercar is a procedural model built in code, not a finished 3D asset.
- **Nothing written to the profile** (`Game.ts` `carId`, `chooseOwnerCar`): the owner's pick is kept in its own
  localStorage key, `tsu.ownerCar`, never in `tsu.profile`. Turning owner mode off brings back the profile's own car.
  Driving still earns XP and credits as usual; owner mode itself doesn't add cars, spend credits or change the
  chosen car.
- **Checked**:
  - `npx tsc --noEmit` and the game config are clean, and `npm run build` succeeds.
  - `npm test -- --only=progression,phone`: 11/11. The new `progression` check walks a level-6 profile with the GT
    and the Brio (both slots full, 11,002 credits) through the real UI:
    - Off: the garage lists GT, Brio and Corsa, with no chip.
    - On, from the Settings toggle: the chip shows, and all 4 cars (Vela E included) are drivable with no Buy or Sell.
      The Vela E was picked: computed top speed 201 → 224 mph, the built car `vela-e`, a Free Drive run in `vela-e`.
      The saved profile was byte-identical before and after the pick.
    - Off again: the car is back to the Brio and the shop buttons return.
    - `#owner` and `#owner=0` on the open page switch it on and off and save it.
  - Screenshots by `tests/out/m0-owner-shots.mjs`, each from a fresh load (owner mode on comes from opening with
    `#owner`), all in `tests/out/m0-owner/`:
    - `garage-{off,on}-{phone,desktop}.png`, at 390 × 844 and 1440 × 900.
    - `garage-on-vela-{phone,desktop}.png`: the Vela E driven on a level-1 profile. The saved profile stayed `null`,
      so it was never written.
    - `settings-on-phone.png`.
  - No sideways scroll. No page errors.
  - Frame at the menu (`renderer.info`, Low): phone 313 calls / 537,547 triangles; desktop 343 / 567,153. With the
    Vela E built: 313 / 529,621 and 333 / 543,559.

## 2026-10-16: the game is "OC Ultra", and the OC sunset wordmark replaces the R badge (UI pass, identity)

The owner, looking at the loading screen on their phone: "get rid of that R as the logo and replace it with the new
logo; make the game called 'OC Ultra' and below just make it say 'Top Speed'." Built from `PROJECT_OC_UI_TARGET.md`,
section "Identity: the OC sunset wordmark".

- **The lockup** (`src/ui/Mark.tsx`, `OcLockup`): the owner's OC wordmark, the chromed ULTRA beside it on the letters'
  baseline, a quiet TOP SPEED line under both. It is the page heading on the menu and the loading screen ("OC Ultra
  Top Speed" to a screen reader) and one labelled image ("OC Ultra: Top Speed") in the pause and results headers. No
  R badge anywhere in the UI; the R stays the car's brand on the wheel hub and bodies, untouched.
- **The mark elsewhere**: the run card's header (the 480 px cut-out, ULTRA and TOP SPEED drawn beside and under it),
  the HUD's route chip and your row's "OC" tag in the race standings (the 240 px cut-out). There is no phone overlay
  or radial menu yet (U3, U6), so neither has the mark.
- **The name**: page title and noscript "OC Ultra: Top Speed" (`index.html`, `scripts/single-file.mjs`); run card
  hashtag `#OCUltra`, share title "OC Ultra: Top Speed", file `oc-ultra-<mode>-<score>.png`; feedback report's first
  line "OC Ultra <version> · feedback report"; the feedback share title. Docs and the folder name keep their names.
- **Theme** (`src/ui/styles.css`): tokens `--sunset` `--sunset-text` `--ember` `--amber` `--night` (black ink) and
  `--sunset-edge` replace the yellow and magenta; sunset for the thing to press and focus, amber for selection, ember
  for danger; a sunset hairline on every panel top; Drive lit with the sunset edge; a palm-and-skyline watermark at
  7 % on the loading and pause screens, drawn as SVG and cut to the letterform with `oc-mask.png` as a CSS mask.
  Contrast measured (WCAG 2.x, on the base `#0b0812`): sunset 8.75:1, sunset-text 9.79:1 (4.96:1 on a HUD plate over a
  white sky), amber 11.77:1, ember 4.56:1 (fills and lines only), black on Drive's edge gradient 6.93:1 where the label
  sits.
- **Size**: the single-file page grew from 3,427,120 to 3,620,249 bytes (+193,129, 188.6 KiB; the four images inline
  as 184 KiB of base64), under the 200 KB budget.
- **Checked**: `npx tsc --noEmit` clean; `npm test -- --only=phone,launch,boot` 16/16, with two new checks in `launch`
  (the report's first line names OC Ultra; the run card downloads as `oc-ultra-free-<score>.png`). Screenshots at
  390 × 844 and 1440 × 900 by `tests/out/identity-shots.mjs`: `tests/out/ui-after/identity-{menu,loading,hud,hud-free,
  pause,results,runcard}-{phone,desktop}.png`. The loading screen is raised with the game's own loading hook for the
  capture, because boot is too quick here to catch reliably.

## 2026-10-16: the reference pass, R2 to R4, checked together and integrated

Three more deltas from `PROJECT_OC_VISUAL_TARGET.md` were reviewed and kept, and are committed together on
`claude/ref-pass`: R2 (overcast light, below), R3 (the race HUD) and R4 (palms with real fronds), whose own entries
follow this one. The rows of the visual target are now marked: R1 to R4 Done (R3 has no lap counter, because no course
has laps, and the map corner shows no rival dots), R5 to R7 Not yet.

**R2, overcast light** (`src/game/env/Environment.ts`, and the output pass in `src/game/Game.ts`). Under cloud the sky
now does the lighting, by day only (night keeps its moonlight). How overcast it is follows how much of the sun the
weather hides: none in clear weather, which renders exactly as before, about three quarters under cloudy, all of it in
rain.

- The direct sun falls away much faster than before and turns a neutral, slightly cool white. Under cloudy it keeps
  about 7% of its clear strength, enough for a faint shadow under the cars instead of hard shadows.
- The sky light (the hemisphere light) rises and turns nearly neutral and a little cool, with a grey ground bounce.
- The environment map that lights the paint and the cabin brightens under cloud, so the dark plastics don't go black.
  The visible sky goes a little greyer.
- The cloud deck's undersides darken (cloudy's `cloudDark` 0.35 to 0.5) and the dome flattens, so the deck comes down
  toward the horizon.
- Exposure opens up by as much as 20% (1.016 under cloudy by day, up from 0.92), so the sky reads bright and the road
  mid-grey while the cockpit stays the darker part of the frame.
- On High and Ultra, the output pass desaturates the frame by up to 15% under cloud (0.89 saturation under cloudy).
  This is folded into the existing output shader, so it adds no extra pass. Low and Medium have no output pass, so
  they get the light without this grade.

**Verified** (960 × 540, High, Free Drive, 30 s at 30 m/s, overlay hidden; `tests/out/fix-r2-shot.mjs`). I-405 North,
day, cloudy: `tests/out/fix-R2-cloudy-{cockpit,chase,hood}.png` against
`tests/out/fix-R2-before-cloudy-{cockpit,chase,hood}.png`. The light state read back
(`tests/out/fix-R2-before-day-cloudy.log` against `fix-R2-after-day-cloudy-v2.log`): sun intensity 1.302 to 0.23,
hemisphere 0.598 to 0.917 (sky colour #dfeaf7 to #ecedf7), exposure 0.92 to 1.016. In the chase frame the car's shadow
on the road is much fainter and the grade is greyer. Sunset, cloudy, at the old 3 degree sunset preset:
`tests/out/fix-R2-sunset-cloudy-{cockpit,chase,hood}.png` against `fix-R2-before-sunset-cloudy-*.png`. The road and
the walls read clearly lighter than the near-black of before (sun 0.291, hemisphere 0.685, exposure 1.094;
`fix-R2-after-sunset-cloudy.log`). Clear weather renders as before, since with no cloud every new term drops out:
`tests/out/fix-R2-clear-cockpit.png` (sun 3.1, hemisphere 0.55, exposure 0.92; `fix-R2-after-day-clear.log`). The cost
is the same draw calls (cockpit 761, chase 615, hood 539 before and after). No suite check was added for R2. The
render group still renders rain, fog and mist by day (the weathers R2 changes most) with no page errors.

**R3, the race HUD.** The position box with the race timer, the standings with estimated gaps that fall in position
order, the rev lights, and Free Drive's road-name plate back where it was on the phone. See the R3 entry below:
`tests/out/fix-R3-r2-phone.png`, `fix-R3-r2-desktop.png`, `fix-R3-r2-phone-free.png`, `fix-R3-r2-suite.log`.

**R4, the palms.** Frond-card crowns cut out by alpha: 382 triangles on High and Ultra and 222 on Low and Medium,
against 448 before. Frond-shaped shadows and ringed, leaning trunks. See the R4 entry below:
`tests/out/fix-R4-compare-2x.png`, `tests/out/preview/fix-R4-palm-crown-high.png`, `fix-R4-suite-render.log`.

**The whole suite on the three together** (`npx tsc --noEmit` clean, `npm run build`, then `npm test` in the `tsu-ref`
worktree; `tests/out/integrate-ref-suite.log`): **58/58 passed**, exit 0, in about 13 minutes of group time. The lines
that touch this pass: "race standings: gaps fall in position order, the timer sits in the race box: 78 rows ahead and
72 behind over 50 s, all in order"; "palms: alpha-tested frond crowns within the old triangle budget: 109 palms in 11
crown meshes, 222 triangles a crown at Low"; "high: … palm crowns 382 triangles; ultra: … 382; low: … 222"; renders
day rain, fog and mist; no page errors in any group.

Not checked: a real phone or GPU, the Medium tier's frames, and R2's look at night or in rain, fog or mist (the suite
renders those weathers, but no one has compared their frames before and after).

**Merged into `claude/always-on`**, on top of the lens flare (g2) and the headlight beam pool. Both sides were kept
where they met. In `Environment.ts`, the new star shader goes with R2's overcast exposure. In `cockpit.ts`, the
interface returns both the live `mirrors` (R1) and the rear-view face, `rearView`, that the flare's occlusion test
uses. That face now follows the live mirror over the driver's side. `Game.ts` and `textures.ts` merged on their own:
the saturation uniform is set before the composer renders and the flare draws after it, so the flare is not
desaturated, and the frond and bark textures sit beside `beamPool()`. On the merge: `npx tsc --noEmit` clean, `npm run
build`, `npm test -- --only=boot,render,race,phone` **30/30 passed** (`tests/out/merge-ref-suite.log`; it includes
"renders sunset, clear … daylight 0.92" on the new 5.5 degree sunset, the race standings check and both palm checks).
One frame pair of R2's light on the new sunset (CA-91 West, cloudy, High;
`tests/out/merge-R2-sunset-cloudy-{cockpit,chase}.png`, `merge-R2-sunset-cloudy.log`) shows daylight 0.91, sun 0.299,
hemisphere 0.846 and exposure 1.04. The road reads mid-grey, the live mirrors show the road behind, and there are no
page errors. The sun is out of frame there, so the flare under cloud was not seen; by the code it is about a fifth of
its clear strength under cloudy.

## 2026-10-16: palms with real fronds (reference pass, R4)

The palms were a dense green ball of 18 plain arcs and a skirt of 10 more (448 triangles at every tier). Now:

- **Crown** (`palmCrown(detail)` in `road/props.ts`). Each frond is one 1.5 m card folded along its midrib into a
  V, bent along a rachis that lifts at the base and droops toward the tip: young fronds higher and upright, old ones
  lower and hanging, the vertex colour darker toward the crown's heart. A few straw-brown dead fronds hang under the
  crown, and a 7-sided collar of leaf bases joins it to the trunk. High and Ultra: 12 live + 5 dead fronds, 6
  segments a frond, **382 triangles**. Low and Medium (`props < 1`): 10 + 4, 4 segments, **222 triangles**. Still one
  InstancedMesh per part per tile.
- **Frond texture** (`frond()` in `textures.ts`). One 512 × 512 texture with a live pinnate frond (bare petiole, pale
  midrib, lance-shaped leaflets leaving it at about 45 degrees and drooping at their ends, gaps between them) and a
  dead one, alpha-tested at 0.4, double-sided. It is now uploaded as ImageData instead of a canvas: a canvas keeps
  premultiplied colour, so every transparent texel had turned black (read back rgba 0,0,0,0 outside the frond; now
  91,122,57,0) and the mip-maps darkened the fronds' edges. A low alpha floor across the blade keeps far fronds solid:
  box-filtered like the GPU's mip-maps, the share of texels passing the alpha test is 1.09 of mip 0's at mip 1, 1.24
  at mip 2 and 1.6 at mips 3 to 5, so far fronds fill in rather than dissolve.
- **Trunk.** The bark has a ring groove every 32 pixels (80 rings a trunk) over a lattice of leaf-base scars. Trunks
  lean up to 3.4 degrees in a random direction; the crown sits on the leaning top with a random yaw and a 1 to 1.25
  scale. These come from a second random stream, so every house, tree and palm is where it was.
- **Shadows.** three.js's shadow pass copies `map` and `alphaTest` into its depth material when a material has both,
  so the crowns cast frond-shaped shadows with no custom depth material (Medium, High and Ultra; Low has no shadows).

**Verified** (960 × 540, I-405 North, day, clear, Free Drive, 30 s at 30 m/s, overlay hidden;
`tests/out/fix-R4-shot.mjs`): `tests/out/fix-R4-high-chase.png`, `fix-R4-high-hood.png`, `fix-R4-low-chase.png`,
`fix-R4-low-hood.png`. The before frames, `tests/out/fix-R4-before-{high,low}-{chase,hood}.png`, were rendered by
the first R4 attempt from this worktree's own build before any palm edit (its log lists the old crown: alphaTest
0.45, 448 triangles); the main checkout's build was not used because it is a different branch. The same palm before
and after, 2×: `tests/out/fix-R4-compare-2x.png` (a dense blob before; separate arching fronds, the dead ones and the
lean after). Close-ups from the realism preview (`src/preview/test-palm.ts`, the game's own palms at 13 m):
`tests/out/preview/fix-R4-palm-crown-high.png` (and `-2x`), `fix-R4-palm-crown-low.png`, `fix-R4-palm-whole-high.png`,
and `fix-R4-palm-shadow-high.png` (the crown's shadow on the ground, leaflets visible in it).

| Frame (calls / triangles a frame) | Before | After |
| --- | --- | --- |
| High, chase | 615 / 1,508,910 | 615 / 1,503,364 |
| High, hood | 539 / 1,404,037 | 539 / 1,398,491 |
| Low, chase | 408 / 457,335 | 408 / 449,653 |
| Low, hood | 332 / 392,832 | 332 / 385,150 |

The crowns' own share, the same frame with them shown and hidden (`tests/out/fix-R4-calls.mjs`, hood): Low 4 calls and
8,658 triangles (4 crown meshes in view), High 7 calls and 58,446 triangles (main and shadow passes). Two consecutive
measurements of the paused frame, crowns unchanged, read 374 then 332 calls on Low and 584 then 539 on High (an extra pass on
some frames), so single-run call counts can differ by about that much.

New checks in the render group: "palms: alpha-tested frond crowns within the old triangle budget" (the crown meshes
alpha-tested, double-sided and casting shadows, at most 448 triangles, the frond blade between 15% and 85% gaps, a
transparent texel keeping its colour), and the High/Ultra rebuild check now reads the crown's triangles at each tier
(at most 448, Low fewer than High). `npm test -- --only=render` **13 of 13** (`tests/out/fix-R4-suite-render.log`):
"109 palms in 11 crown meshes, 222 triangles a crown at Low, castShadow set; blade 41.62% gaps; transparent texel rgba
91,122,57,0" (castShadow is set on every tier; Low's renderer draws no shadows) and "high: … palm crowns 382
triangles; ultra: … 382; low: … 222", no page errors.

Not checked: a real phone or GPU, the Medium tier's frames, palms at sunset or night.

## 2026-10-16: the race HUD (reference pass, R3), second round after the judge

The race HUD replaces the three race numbers in the stats box with a position box (the big position, "of 4", the
distance to go, and now the race timer beside the position, labelled Time), the live standings (position, the
rival's OC city tag, name, the gap to you in seconds, your row in volt; a phone shows the three rows around you)
with the note "Gaps in s · estimated", and eight rev lights over the gear. The judge sent the first cut back for
three things, all fixed:

- **Free Drive had moved on the phone.** The road-name plate had been pushed to +292 px for every mode. In the
  `(pointer: coarse)` block it is back at +244 px; only while the race box is shown
  (`.hud:has(.hud-race:not([hidden]))`) does it go under the box, to +292 px. The opt-in frame-rate chip moves under
  the race box in a race too (+282 px; at +218 px it sat on the standings).
- **The timer sat stacked under the road name, over the horizon.** It now lives in the race box, top right
  (`.hud-pos > .hud-timer`); nothing of the race HUD is on the road plate.
- **The gap column could disagree with the order.** `standings()` estimated a car behind you with its own speed,
  so a slow car further back could show a smaller gap than a fast one just behind (the first cut's desktop frame
  read P2 −9.0, P3 −13.7, P4 −11.3). Every gap is now the distance along the course at your speed (`vMe`), so the
  gaps fall with the positions; finishers are still ranked first, ahead of every unfinished car.

**Verified:** `tests/out/fix-R3-r2-phone.png` (390 × 844, Irvine Sprint, 40 s in: race box 156–287 px, timer
0:40.6 in it, gaps −6.1 / −8.4, plate at 302 px) and `tests/out/fix-R3-r2-desktop.png` (1440 × 900: timer 0:40.9 in
the box, gaps −6.5 / −6.9 / −12.6, plate alone at the top); `tests/out/fix-R3-r2-phone-free.png` (Free Drive on the
phone: plate at 254 px = 10 + 244, under the Distance/Top box at 156–210 px); `tests/out/fix-R3-r2-phone-race-fps.png`
(frame-rate chip at 292 px, under the box, left of the plate). New check in the race group: 50 s of the Irvine
Sprint (20 s slow, 30 s fast) sampled every second, 78 rows ahead and 72 behind, gaps never out of order; the HUD
timer in `.hud-race`, none on the plate, the HUD gap column in order. `npm test -- --only=race,phone` **11 of 11**,
no page errors. Not checked on a real phone.

## 2026-10-16: the sun's lens flare draws at High, and the sunset preset is a sunset again (finding g2)

**The flare.** three's `Lensflare` reads the framebuffer back for its occlusion test, which fails on the multisampled
target High and Ultra render into: it never drew there and left a solid 16-px black square at the sun's screen
position (`tests/out/audit-sunset-ahead-{hood,cockpit,chase}.png`, `audit-crops/ahead-hood-sun.png`). It is gone.
`Environment` now draws the flare itself: `updateFlare()` projects `sunDir` through the camera's own orientation
each frame and places five additive planes (the glow at 26 % of the screen's height, four ghost rings at
sun·(1−2d)) in a small screen-space scene with an orthographic camera, sized in shares of the screen's height so
they stay round in portrait, and `renderFlare()` draws that scene over the finished frame after the composer, so
bloom and AO never see it and Low (no composer) gets the same picture. Occlusion is a raycast toward the sun every
third frame (400 m, through the roads, the traffic and the terrain's instanced props; see-through, hidden and
skinned meshes ignored; 0.2–2 ms per cast here), the mountain ring's crest height at the sun's azimuth
(`ridgeAltitude`, soft over the sun's half-degree disc), and for the player's car `PlayerCar.sunBlocked`: the
cabin as a box with the kit's windscreen, side windows, rear screen and the Vela's glass roof as openings and the
rear-view mirror (now `Cockpit.rearView`) as a blocker, since raycasting the real body cost 15–19 ms. The result
blends over 0.3 s. The ring writes depth now, so stars and clouds no longer show through its ridges. Glow texture
given a hot core and long halo, ghost rims softened (`textures.ts`).

**The sunset preset.** The first version of this fix lifted the sunset sun from 3° to 8° because the ring's crest
is 6.9° at its azimuth (258°), so a 3° sun had never shown; the judge rejected that: at 8° `daylight`
(`smoothstep(−0.1, 0.14, alt)`) is exactly 1, the suite's `renders sunset, clear` check (`e.day < 1`) fails by
construction, and the preset read as full afternoon (sunlight 3.1, hemisphere light and sky gain the same as day).
Retuned without touching the ring or the formula: the crest profile, computed from the ring's own `fbm2` (3.0° at
az 164° to 12.3° at az 110°), is lowest in the western half at az 292–293° (5.0–5.1°, a late-June sunset
direction over OC), so the preset is now **5.5° at az 292°**: the whole disc clears the crest by 0.14° (the
flare's ridge factor is exactly 1), daylight 0.91 (0.92 after the suite's 15 s ease from day), sunlight 2.86,
golden 0.79, so the preset is dimmer and warmer than day again. I-405 North, the suite's own start, faces it 11°
left of the nose at the start and 12° right after 30 s. Not touched, worth its own finding: the sunrise preset
(4° at az 100°) sits behind a 9.6° crest, so it never shows its sun either.

**Verified** (headless Chromium, SwiftShader, 960 × 540, I-405 North after 30 s of autopilot; all with zero page
errors):
- `npm test -- --only=render` **12 of 12** (`tests/out/fix-g2-r2-render.log`): sunset daylight 0.92, day 1,
  night 0; the suite's own `tests/out/sky-sunset-clear.png` (Low, 640 × 360, cockpit) shows the sun just over the
  ridge through the windscreen with the glow and ghost train.
- High, cockpit/chase/hood (`tests/out/fix-g2-r2-sunset-high-{cockpit,chase,hood}.png`,
  `fix-g2-r2-sunset-high.log`): flare visible in all three (strength 0.77, ridge 1, nothing hit, raycast
  0.3–1.9 ms), the sun in a dip of the ridge line, long lamp-post and palm shadows down the road, no square;
  563–638 draw calls and 1.45–1.56 M triangles a frame.
- Low, hood/chase (`fix-g2-r2-sunset-low-{hood,chase}.png`, `fix-g2-r2-sunset-low.log`): the same placement
  (sun at pixel 580,206 in the hood view on both presets), 342–418 calls, 0.40–0.46 M triangles.
- High, portrait 390 × 844, hood/cockpit (`fix-g2-r2-sunset-portrait-high-{hood,cockpit}.png`,
  `fix-g2-r2-portrait-high.log`): the glow and ghosts stay round, the sun over the ridge right of the nose. With
  the sun turned to the car's heading (az 279°, crest 8.3°) the ridge hides it, honestly: no flare and no square
  (`fix-g2-r2-sunset-ahead-portrait-high-hood.png`, ridge factor 0). Pre-existing and not part of this finding:
  the cloud layer stretches into vertical streaks in portrait.
- Ultra, hood, 640 × 360 (`fix-g2-r2-sunset-ultra-hood.png`, `fix-g2-r2-sunset-ultra.log`): the flare draws over
  the bloomed frame, no square; 1,278 calls, 3.74 M triangles a frame.
- `npx tsc --noEmit` clean for both `tsconfig.json` and `tsconfig.game.json`.
- Before/after: `tests/out/audit-sunset-ahead-hood.png` (black square, stars by day) vs
  `tests/out/fix-g2-r2-sunset-high-hood.png`; the first fix's bright-afternoon frames are `fix-g2-sunset-high-*.png`.

## 2026-10-15: live rear-view and door mirrors on High and Ultra (reference pass, R1)

The first delta against the owner's reference image (`PROJECT_OC_VISUAL_TARGET.md`): the rear-view mirror used to
show the sky's environment map (a dark band from the seat). `Game.configureCar` now passes `mirrors: 'live'` to
`PlayerCar` on High and Ultra when the device has a fine pointer (phones and Low/Medium keep `'env'`), and
`buildCockpit` returns its `CarMirror`s so the car can switch them off outside the seat and dispose them on a
rebuild. Three things were needed to make the glass show the road and the traffic behind:

- **Our cars are mid-engined.** From the mirror's eye the bulkhead window frames the car's own wing, tail lamps and
  engine-cover louvres, with the car behind squeezed into a slot (`tests/out/dbg-mirror2-eye-aim.png`). The
  rear-view therefore renders the world without the player's car (`CarMirror.hide`: body, cabin, hands, wheels,
  hidden for that nested render only), as a rear camera would, and is aimed straight back 2.5 degrees below level.
  The door mirror keeps the flank.
- **The glass was off screen.** Hung just left of centre it sat 45 degrees right of the eye and only its left 38 %
  was in a 16:9 frame at the cockpit's 58-degree view. It now hangs over the driver's side (x about -0.22), fully in
  frame at 16:9 and 16:10.
- **Cost.** Each mirror renders every other frame (the two alternate) into a 512x128 / 256x112 target with a 400 m
  far plane: the far road chunks were most of the draw calls (471 -> 172 for the rear-view), the sky dome still
  draws (it sits at the far plane whatever it is), the backdrop hills and clouds beyond 400 m do not. Measured in
  SwiftShader at 960x540, High, I-405 North, day, moderate traffic, over 4 frames with `info.autoReset` off: 645
  calls / 2.13 M triangles a frame with `'env'`, 823 / 3.05 M with the live mirrors (the rear-view's own render 172
  calls / 0.92 M, the door mirror's 181 / 0.93 M; the player's car is 240 k triangles).

The judge rejected the first cut for one reason: the mount had moved for every tier, so on a phone (portrait, 96°
view) the environment-map mirror became a dark slab over 43 % of the screen width in front of the road
(`tests/out/review-R1-phone-cockpit.png`). Fixed by hand: with `'env'` the glass keeps its old place just left of
centre and its old aim through the bulkhead window; only the live mirror moves over the driver's side.
`tests/out/fix-R1-phone-cockpit.png` (390 × 844, Low) shows the road clear again, with no mirror targets built
(`car.interior.mirrors.length === 0`). Suite: `npm test -- --only=render` **12 of 12** on the agent's cut (the
High/Ultra/Low preset check now also asserts live/live/env mirrors); the hand fix typechecks and only changes the
`'env'` branch.

**Verified:** `tests/out/fix-R1-cockpit.png` (the driver's seat with a sedan placed 20.9 m behind in the same lane:
it fills the middle of the rear-view, with the median, the lane line, a second car in the right lane and the sound
wall; 2x crops `fix-R1-cockpit-{rearview,door}.png`; `fix-R1-before-cockpit*.png` is the `'env'` state). `npm test
-- --only=render` **12 of 12** (the High/Ultra/Low preset switch now also checks the mirror mode: live, live, env),
`npx tsc --noEmit` clean. Not measured on a real GPU.
## 2026-10-18: semi-real drift physics, measured and kept

The car model now shifts weight: braking loads the front, throttle loads the rear, and cornering loads the outside
tyres, and a tyre gives less grip per unit of load the more it carries (load sensitivity). Steering has a counter-steer
lock, the handbrake gives a yaw kick, a spun-up rear slides on kinetic grip, and stability control backs off while the
driver holds a slide. A drift readout (angle, active, time) is exposed. Rear-end contacts with traffic now use the
closing direction, so a 120 m/s rear-end with a sideways offset is a crash, not a side push (`traffic/contact.ts`).

How it was checked: `node tests/dynamics.mjs` steps the car at 120 Hz in node against the parent commit a89d4f0 with the
same method; 1574 checks passed, 0 failed (report: `tests/out/dynamics-report.md`, deterministic run to run).

- Control table, Corsa (best earnable car), parent → now, Arcade (h 0.15) / Sport (0.5) / Simulation (0.9):
  0-60 2.95 → 3.09 / 3.25 → 3.71 / 4.06 → 4.71 s; top speed 232 → 229 mph; 100-0 83.2 → 71.1 / 85.2 → 76.3 /
  88.2 → 84.0 m; lateral g at 40 m/s 1.07 → 1.04 / 1.20 → 1.15 / 1.16 → 1.12; handbrake catch caught in
  0.75 / 1.24 / 1.35 s, no spin. The other earnable cars move the same way and stay inside the bounds of
  PROJECT_OC_DYNAMICS.md §7.7.
- Stability (autopilot-gain lane follower, straights at 134/168/201 mph with a lane change and yaw shove, a 600 m
  sweeper with a lift and a brake): worst body slip for the earnable cars 2.09° (GT, h 1, sweeper at 123 mph), at most
  1.43° after 7 s. The Unleashed-like test car peaks at 10.98° in the same sweeper at h 1 and settles to 4.11°.
- Contact: a stopped sedan or semi hit at 60/120/150 m/s with 0 to 1.6 m offset is a contact in 25 of 25 phases every
  time; 2.0 m (sedan) / 2.3 m (semi) is always a miss.
- 240 Hz against 120 Hz: worst difference 2.04% on 0-60 (Corsa, h 0.9).
- Advisory for the hypercar race tune: the plan's race-tune-like car is 0.6 mph over the Corsa's top speed, and over on
  lateral g at 80 m/s in Simulation; the race tune must be re-set on claude/hypercar.
- Build and type check pass. Browser suite (survival, race, progression, phone, abilities): 25/26 passed; the failure
  is "ramming a stopped car ends the run and shows the local board" timing out waiting for the result overlay after
  the crash was registered (g.over true).

Kept by two reviewers.

## 2026-10-15: first realism pass by agents: headlight beams, the NPC nose, the jaw and neck

The first orchestrated render pass (two art-director audits, then one fix agent per shortfall and a sceptical judge
per fix) kept three fixes before the account's session limit stopped it. Each was judged on before/after renders.

**Headlight beams (game, finding g1).** The two spotlights painted blown-out, heart-shaped blobs on the road right
under the bumper, and came on at sunset. Now the spots are a narrow soft cone aimed just above level, so they reach
traffic and walls but not the road under the nose, and the low beam on the road is a painted pool: a 12 × 38 m
additive strip of fourteen rows re-laid on the road's height each frame (it follows crests and sags), with two
pools merging into one widening wedge and a soft cut-off at 30–36 m lifted on the right like a US low beam
(`textures.ts` `beamPool()`, `PlayerCar.ts`, `Game.ts` `weatherTick`: the lamps now fade in with gloom instead of
switching at a threshold). Before/after: `tests/out/audit-night-hood.png` vs `tests/out/fix-g1-night-hood.png`,
and the cockpit, chase and sunset frames beside them. The judge kept it and listed what remains: a faint two-lobe
seam at 4–6 m in the hood view, the narrower cone no longer lights adjacent-lane cars inside 15 m or a nearby wall
(not yet looked at in a night shot with a wall), the pool ignores camber on banked ramps, it is not fogged, and a lit
traffic car at 28 m reads as a blown-white rear: pre-existing, worth its own finding.

**The NPC nose (people, p1).** The bridge was a pinched blade with hard sidewall creases and a separate bulbous tip.
`src/onfoot/people/head.ts`: a wider radix starting at the eye line, softer dorsum and sidewall blends, the tip a
lobule that continues the dorsum, fuller maxilla beside the nose. Judged at 0.62 m and 0.33 m on the reference,
casual and elder presets at three yaws (`tests/out/preview/fix-p1-*.png`): the crease and the ridge highlight are
gone, the bridge reads about twice as wide, nothing else moved. Cost flat (build-time SDF).

**Jaw to neck (people, p2).** One convex curve from chin to throat, masseter lumps, a ball under the chin, the
trapezius rising to the ears. `head.ts` and `body.ts`: a concave cervicomental angle, the mandible's lower border as
an edge over the neck, a visible sternocleidomastoid band, the neck a column, the elder's wattle a distinct pouch.
Judged on profile, front, talk, lineup and collar renders (`tests/out/preview/fix-p2-*.png`). Noted, not blocking:
a soft dark patch under the lean female's ear in profile, and her collarbones now at the gaunt limit.

**Not reached:** the lens flare's black square at High (g2), stars by day (g3), waxy skin (p3) and the rest of both
audits' lists (night lighting, Monopoly houses, blank mirrors, paper mountains, flat daylight; teeth, hair, mouth
corners, brows, expressions). They run in the next pass. The audit also judged my lens flare (added earlier today):
it never draws at High and leaves a solid black square at the sun; the sunset preset's 3° sun also sits below the
procedural ridge line, so the flare would rarely show even when fixed.

**Verified:** the judges' renders above, `npx tsc --noEmit` clean, and the full suite on this build: `npm test`
**53 of 56** (`tests/out/full-1015c.log`) with the three misses all 30 s Playwright timeouts on a screenshot or a
click in the launch group while another pass was rendering on the same four cores; the launch group alone then
**5 of 5** (`tests/out/launch-1015e.log`), so every check passed on this build. The suite's actions now get two
minutes instead of Playwright's 30 s (`tests/regression.mjs` `open()`), since software rendering shares the CPU
with other renders here; what a check asserts is unchanged.

## 2026-10-15: the ability hand poses are on the anatomical hands

The one thing the realism hands had lost against the old cockpit: the abilities' gestures. `DriverArms.setPose`
now takes a hand off the rim and back. A pose names where the wrist goes and which way the hand points and its back
faces; the hand bone's rotation is solved from the bind hand's measured axes (wrist to middle knuckle, the palm
normal), the arm's two-bone IK follows the wrist, and it blends over 0.3 s each way. Clear Path: the left hand comes
up at the window and waves (a slow roll about the forearm) for 1.6 s. Focus Time: the left wrist comes up in front
of the eyes, back of the hand to the driver, for 0.9 s. Locked In: the right hand rests on the console, palm down,
for the five seconds, the left hand steering alone. The fingers keep their grip curl in every pose; there's no
finger rig, so a wave reads as a raised loose fist.

**Verified:** the preview's hands page with `?pose=knee|watch|wave` (`tests/out/preview/pose-*.png`), then the game
itself: each ability fired through `useAbility()` with the matching driver and captured from the driver's seat
(`tests/out/pose-{wave,watch,knee}.png`: the Closer's wave with the gold watch, the Ace's gloved watch check, the
Wrench's hand down on the console while the left hand holds the wheel). `npm test -- --only=abilities` **4 of 4**
with the poses in; no page errors. Then the full suite on this build (semi, autopilot fix, poses): `npm test`
**56 of 56**, 20 minutes in this container (`tests/out/full-1015b.log`).

## 2026-10-15: the tractor-trailer semi, a cleaner windscreen, and a safer autopilot

**The semi.** The last block-built traffic vehicle is now built like the others, from `src/preview/traffic.ts`: a
conventional tractor (boxy loft, a 2.2 m hood narrower than the cab, glass only over the doors, chrome grille
surround and bumper, sun visor, roof fairing in the paint colour, twin stacks, fuel tanks between the axles, frame
rails and a fifth wheel over the tandem, west-coast mirrors) and a 45 ft box trailer with floor frame, side skirts,
red conspicuity tape, landing gear, door seam and lock rods, mud flaps and an underride guard, 20 m in all on five
axles. The game instances ten turning wheels from the spec's axle list, and keeps the semi in the two right lanes.
`tests/out/preview/traffic-semi.png` is the preview render; `tests/out/semi-chase.png` is the game, placed 22 m behind
one on the 405.

**Windscreen dust** at the driver's seat was reading as snow at the desktop tier: its opacity is halved (0.26 →
0.13). It is still there against the light.

**The autopilot** (attract mode and the suite's driver) used to judge a lane by where cars were, not where they were
going, and the longer semi changed the seeded Survival run enough that at 39 s it moved into lane 3 as a pickup 5 m
ahead was also moving into lane 3. It now counts a car that is signalling and moving into a lane as already in it,
for both the gap ahead and the clear check. Seeded Survival runs through again.

**Verified:** `npm test -- --only=survival` **7 of 7** (a new check: seven traffic classes from the preview, the semi
20 m × 2.5 m with ten wheels, 5 of 154 seeded cars are semis and every one spawned in the two right lanes; the seeded
run now scores 8,591 with a 16.82 s best streak, 21 clean passes, top 116 mph). `--only=survival,abilities` **10 of
10** on the first semi build before the tractor was reshaped. No page errors in any run.

## 2026-10-15: the Chrome noir menus are in the game

The owner asked for "something more modern with a futuristic HD cyberpunk feel" and chose direction B, "Chrome
noir", from the two the designers built in worktrees. The agent that was to apply it is stopped by the weekly limit, so
its patch (`scratchpad/ui-design-2.patch`: `index.html`, `scripts/single-file.mjs`, `src/ui/App.tsx`,
`src/ui/styles.css`) was applied three-way and the three conflicts resolved by hand: the day's "start at your exit"
picker and Feedback panel now live inside the new layout (the Start panel is a `panel wide`; the roads and exits grids
scroll with their panel). The look: a chromed ULTRA wordmark with a slow sheen, Big Shoulders Display for headings,
Chakra Petch for text, JetBrains Mono for numbers and labels, violet-black glass with a hairline edge, magenta
selection corners, a yellow Drive dock pinned to the bottom of the menu, hexagonal ability button, angled chips
for the touch pedals and the top bar. Every accessible name, role and class the suite relies on is kept.

Three layout faults from the unfinished direction were fixed: controls scrolled into view landed under the sticky
Drive dock and panel footers (now `scroll-padding-bottom` on the overlays, so Playwright's and the browser's
scroll-into-view keep them clear); the exit picker's inner scroll fought the panel's sticky footer (its
`max-height`s removed, the panel grows and the overlay scrolls); and the desktop side card (Loop Lab, the data credit)
was pinned to the animating menu column instead of the viewport (the slide-in now animates the column's parts).

**Verified:** `npm test -- --only=launch,phone,boot` **16 of 16** on this build (the phone layout checks, the exit
picker click-through, the Feedback and Share run buttons). All 13 screens captured at phone and desktop size in
`tests/out/ui-after/` (the capture tool now waits for entrance animations to finish: in software rendering the first
frames after load take seconds, so the animations started late and the first desktop captures were mid-fade).
Not reviewed yet: an art-director pass over every screen for polish; the agents' review and polish steps run when the
limit lifts.

## 2026-10-15: the realism preview's cars, cockpits and hands are in the game

The owner, after trying the test build: "This game looks like garbage, keep rendering for MAXIMUM RESULTS." The
background agents that were going to integrate the realism preview are stopped by the account's weekly limit until
Oct 18, so the integration was done by hand, ahead of the preview's remaining parts.

**What changed.** `src/game/vehicle/PlayerCar.ts` now builds the player's car from the preview modules
(`src/preview/car.ts`, `cockpit.ts`, `hands.ts`): the four garage cars as four distinct bodies (clearcoat metallic
paint with flake, shut lines, LED lamps, tail-lamp clusters, diffuser, exhausts, forged wheels with tyres and
drilled discs, a contact shadow), each with its own cockpit (GT black Alcantara and cognac Nappa, Brio navy leather
with aluminium, Corsa carbon buckets with harnesses and a roll hoop, Vela E ivory leather with a screen dash), a real
tachometer with a live needle, a windscreen with the dashboard's ghost reflection and dust, door and rear-view
mirrors, and the driver's anatomical hands gripping the rim at ten and two with the chosen look (skin tone, sleeves or
rolled, gloves, gold/steel/smart watch, ring, bangle, painted nails on the female presentation). The wheels spin and
the fronts steer (the preview built them rigid; the game puts each in its own groups, calipers on the hub). Graphics
Low and Medium use the preview's 'phone' quality tier, High and Ultra the 'high' tier. The paint, the car and the
driver's look rebuild only what changed. The previous cockpit (`Cockpit.ts`, `Instruments.ts`) is no longer used.

**Verified** (headless Chromium, SwiftShader, 960 × 540, Low, sunset, `tests/out/car-low-{cockpit,chase,hood}.png`
and `tests/out/dbg2-*.png`): build in software 428 ms car + 597 ms cockpit + 966 ms hands; no page errors; the
driver's seat shows the dash, tach, mirror, A-pillar and both hands with the Closer's gold watch; chase shows the GT
from behind with tail lamps, diffuser and wheels; hood shows the bonnet lip and the road once the half-second view
blend has finished (a shot taken mid-blend sits inside the windscreen). Frame cost at the seat: 355 draw calls,
490k triangles (the old car: 444 calls, 491k), 10–12 fps in this software renderer, the same as before the change.
**Suite:** `npm test -- --only=boot,survival,render,phone,launch` with the new car and traffic: **34 of 34** (the
render group's six skies, the lost-context recovery and the High/Ultra rebuild all pass with the preview car built
at both tiers; Survival's seeded numbers are unchanged: 16,244, 28.75 s, 25 passes). The test link
https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 carries this build.

**Traffic bodies** (same session). The preview's unbranded traffic vehicles (`src/preview/traffic.ts`, moved out of
`car.ts` and given a coupe) now feed the game's instanced traffic: sedan, coupe (the "sports" class), SUV, pickup, a
new van class, and the box truck are lofted bodies with a glass band and vertex-coloured trim (grille, bumpers,
mirrors, box, bed), on the game's own turning wheels and braking lamps, in the preview's clearcoat paint with the
per-car instance colour. Collision boxes and wheel positions come from the same specs, so what you see is what you
hit. The semi is still the block-built one. Verified (`tests/out/traffic-{cockpit,chase}.png`, Heavy, seeded, 154
cars): bodies, colours and lamps render through the instancing; 373 draw calls and 838k triangles from the seat in
Heavy traffic (the bodies are denser than the old profiles); no page errors.

**The road** (same session). The interstates and state routes (the 5, 405, 22, 55, 57, 91) are now Portland cement
concrete, as they are: light grey-beige slabs 4.57 m long with sealed, slightly skewed transverse joints, the
longitudinal joint at each lane edge, diamond-ground tining in the normal map, darker polished wheel paths, an oil
line and hairline cracks (`textures.ts` `pcc()`, one lane by one slab per tile, with its own roughness map; rain
darkens and glosses it like the asphalt). The toll roads (73, 133, 241, 261) and every ramp stay asphalt. Lane lines
are four raised Botts' dots per 3.66 m where there was a painted dash, with the reflective marker in the gap kept.
Sound walls are split-face masonry block in running bond, tan, 0.2 m courses (`blockWall()`), instead of tinted
concrete. Verified in daylight from the seat, chase and hood cameras (`tests/out/car-low-{cockpit,chase,hood}.png`,
Low, 960 × 540): the slabs, joints, dots and block courses read at every distance; no page errors; 371 draw calls
and 606k triangles from the seat in Moderate traffic. Suite: `--only=boot,render,survival` **24 of 24** on this
build (the rain and fog renders cover the wet concrete).

**Not done, candidly.** The ability hand animations (the Closer's watch check, the Ace's wave, the Wrench's hand on
the knee) do not yet exist on the new hands: `setPose` is a no-op until the hands get a rig. The cockpit's two side
screens are static pictures (the HUD carries speed and gear); the shift paddles do not flick. Phone performance is
still unmeasured; the Feedback report will say.

## 2026-10-15: launch features: start at your exit, and the run card

Built for the local launch plan (`PROJECT_OC_BUSINESS.md`): every OC resident has an exit, and a run should be
shareable without a server.

- **Start at your exit.** The Start panel now lists all 20 carriageways under the 12 quick starts; tapping one lists
  every real exit on it (from the guide signs in the map data: 416 across the network, 4 to 58 per carriageway) with
  its distance along the road and which side it leaves. Picking one starts you 450 m before its sign, in the second
  lane, and the toast names the exit. `Settings.exit` holds the key (`'<carriageway> @ <metres>'`); the quick starts
  clear it. Time Trial keeps its fixed start.
- **Run cards.** The results screen has "Share run": a 1080 × 1350 PNG drawn on the device (the road's shield, the big
  number, the reason, the stats, "#TopSpeedOC", "A game. Drive the real ones at the limit.", and the device-only and
  map-credit lines). It goes through the phone's share sheet where there is one, otherwise it downloads. Nothing is
  uploaded by the game.

**Verified** (headless Chromium, SwiftShader, `npm test -- --only=launch,boot,phone,survival`, then `--only=launch`
again after a test fix): 22 of 22 checks pass.
- Launch: CA-57 North lists 14 exits, the same number the data has; picking "Orangewood Avenue" (the Lot 57 exit) and
  tapping Drive started on CA-57 North 450 m before the sign. The run card downloaded as `top-speed-oc-free-703.png`,
  1080 × 1350, 955 KB (screenshots `tests/out/launch-exits.png`, `tests/out/launch-run-card.png`).
- Boot, Survival and Phone groups unchanged: 781,426 lane points clear, 11,333,756 barrier segments the same twice,
  Survival score 16,244 with a 28.75 s streak, the phone menu and HUD fit, Go to lists 20.
- One test fix: the first run of the card check timed out at 15 s because the results screen keeps rendering the
  scene behind it at 1–2 fps here, so the click and the drawing took about 19 s; the check now allows 90 s.

Not measured: a real phone's share sheet (headless Chromium has no `navigator.share`, so the download path is what
the suite exercises).

**Feedback report** (same day). Pause → Feedback, or Settings → Feedback, shows a report about the device and the
drive: the browser, screen and pointer, cores and memory, the GPU (`WEBGL_debug_renderer_info`), the graphics preset,
pixel ratio and drawing-buffer size, frame rate, draw calls, triangles and textures, the mode, road, speed, traffic
density and car count, the sky settings. Copy (clipboard, or select-and-copy where that is refused) and Share (where
`navigator.share` exists). The game sends nothing; the player pastes it to us. This is how the launch's ambassadors
report real-phone performance, which has never been measured.
- Verified (`npm test -- --only=launch`, 4 of 4): the report named the browser (HeadlessChrome), "GPU: ANGLE (Google,
  Vulkan 1.3.0 (SwiftShader Device (Subzero)...))", the Low preset, "11 fps · 444 draw calls · 491k triangles · 45
  textures" and the drive on CA-57 North; Copy and Back worked with no page errors (`tests/out/launch-feedback.png`).
  Those numbers describe this sandbox's software renderer, not any phone.

**Abilities tuned toward the owner's "about 5 seconds"** (same day): Clear Path 8 → 6 s (traffic needs a moment to
move over), Locked In 7 → 5 s, Focus Time stays 5 s; cooldowns unchanged. **Clear Path with No Traffic**: with the
density at None and no cars about, the ability says "No traffic to clear" and keeps its charge instead of burning a
45 s cooldown on nothing.
- Verified (`npm test -- --only=abilities,launch`, 9 of 9): Clear Path 153 → 106 cars with all 46 in view kept, scale
  0.65 then 1 after its 6 s, cooldown blocks a refire; Focus Time 0.7× then 1×; Locked In grip ×1.3 then ×1 after
  5 s; with density None and 0 cars, Clear Path did not fire and stayed ready. Phone group re-run after the Feedback
  button was added to the pause and settings screens: 5 of 5.

**Full suite after the day's changes: 55 of 55** (`npm test`, all nine groups, about 11 minutes here). The
interchange chains, races, progression and render checks match the 2026-10-12 numbers (405 N → 55 N in 215 s, the
Irvine Sprint won in 2:21.7, 178 XP for 60 s, the six skies rendered, context loss recovered).

**Test link.** This build is published separately at https://claude.ai/artifact/AsFiTsf6TFF4Hij25U3MR9 so it can be
tried on a real phone (the main link https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV still holds the 2026-10-13
build: updating it needs the 3 MB live page read first, which this session could not do safely). Inside the
artifact viewer a plain download does nothing, so the run card there goes through the viewer's own save hook (see
the technical notes); on a phone the share sheet comes first either way.

## 2026-10-12: a committed regression suite, and the bugs it found

The test scripts behind the entries below (`final.js`, `modes.js`, `sim.js`, `dbg3.js`) were never committed. They're
replaced by `tests/regression.mjs`, run with `npm test`. It has 50 checks in eight groups, uses the same method
(headless Chromium, SwiftShader, `window.__game`), and takes about 10 minutes here. The technical notes explain it.

### Results

- **The build as committed (c0d7b34): 42 of 49 passed.** All 7 failures came from the bugs below. The same suite ran
  against both builds, with `GAME_HTML` pointing at the old one.
- **With all six fixes: 50 of 50 passed.** The numbers in this section are from that final run.
- **The 50th check came later.** It compares the barriers on a first and a second look (bug 5). It was checked against
  the fixed build with only that fix undone, where it failed: 18,040 segments over 3 m on the first look, 298 on the
  second.

| Group | Verified |
| --- | --- |
| Boot | Menu after 2.7–5.5 s across runs. 20 carriageways on 10 routes. 781,426 lane points with no barrier within 1 m of a lane's centre. 11.3 million barrier segments the same on a first and a second look. OSM/Overture credit shown. No Controls screen. |
| Interchanges | Moderate traffic, seeded. 405 N → 55 N in 215 s, 55 N → 91 E in 403 s, 91 E → 241 S in 269 s (sim time). Largest move in one simulated second: 50.4 m, so no teleports. No wrong-way time. The profile counted 4 freeways and 3 interchanges. Turned around at the end of the 5 South, the navigator planned again (4 hand-offs). After a road with no way through, it picked the destination up again (11 hand-offs). |
| Speed Survival | Heavy traffic, seeded. 45 s at 116 mph: score 16,244, best streak 28.8 s, 25 clean passes, 1 near miss. At 63 mph the streak is 0 and the best is kept. 8 passes counted for exactly 8 newly scored cars; a re-pass of a car that had already scored didn't count. Ramming a stopped car at 30 m/s ends the run: "Crashed into a sports car", with the board labelled "Local leaderboard · this device only". Two Time Trials: 154 cars identical at the start and after 8 s. |
| Races | The countdown holds you off the gas (0 m/s, moved 0 m, in gear 1) and flat on it (at most 0.1 m/s, 0.11 m). Rivals stay at 0 m/s. Flat out, the autopilot won the Irvine Sprint: P1 in 2:12.0–2:21.7 over three runs, +1,540 credits. (The build as committed won in 2:48.6 in both its runs; why it was slower wasn't traced.) Driving slowly ends "Too far behind" at P4. |
| Abilities | Clear Path: 154 → 125 cars, all 59 in view kept, traffic scale 0.65 then 1, no refire in the cooldown. Focus Time: world at 0.7× then 1×. Locked In: grip ×1.3 then ×1. |
| Progression | 60 s of driving: 178 XP, 64 credits, "Ton Up", saved as profile v1. Showroom: "29,900 more credits needed", "Opens at level 5", then the Brio bought with 11,000 credits left; computed top speed 211 → 201 mph. Ultra Realism: tunnel vision 0 at level 1; 0.42 at level 6 and 155 mph; 0 once switched off. Radio: Coast → Freeway FM → Canyon Radio → off, audio running. |
| Render | 640 × 360. Day, sunset, night, rain, fog and mist rendered. Rain: grip 0.8, wet 1. Fog: visibility 0.14. Night: daylight 0. Live time with a fixed clock: daylight 0 at 02:13 Pacific, 1 at 13:00. Pause holds the car; resume moves it. Reset: 40.0 → 0.7 m/s. Recovers from a lost WebGL context. High and Ultra rebuild mid-drive. |
| Phone | 390 × 844, touch. The menu and Profile fit with no sideways scroll. The top bar is clear of the gear readout. Touch controls are shown. Go to lists all 20 carriageways. |

No page errors in any group.

### Bugs found and fixed

1. **The countdown backed you off the grid.**
   - The countdown holds the car with `brake: 1`. In automatic, holding the brake at a standstill selects reverse
     (the arcade way to back up). So off the gas, the car backed 2.05 m off its grid slot at up to 1.7 m/s, in
     reverse, in Races and Time Trial.
   - The old check only tried it flat on the gas.
   - Fix: `CarPhysics.hold` keeps reverse out while the countdown holds the brakes. Now: 0 m/s, in gear 1.
2. **Barrier stubs in travel lanes at ramp starts.**
   - Barriers are worked out lazily, ±32 samples at a time. For ramps that start at another road, a line meant to
     clear the first three samples ran `w[k] = w[k] && 1`, which turned "not worked out yet" (−1) into a barrier.
   - So if a ramp was first looked at from further along it, it got a 4–6 m barrier stub inside the freeway's
     lanes. Whether a stub appeared depended on what you'd driven past before.
   - Fix: those samples are set to 0, as the comment intended.
3. **Barriers on ramps 2.5 to 3.5 m overhead.**
   - A ramp climbing past a freeway gets barriers once it's 2.5 m clear of it. The physics took barriers within
     3.5 m of the car's height, so it hit barriers over its roof.
   - One stood in the fast lane of the 55 North at 13.13 km, at the I-5 interchange. With seeded Moderate traffic,
     3 of 8 runs of 405 N → 55 N → 91 E ended up off the route. In one, the autopilot hit that barrier at 50 m/s
     and spun onto a ramp backwards.
   - Fix: the physics only takes barrier segments within 2 m of the car's height.
   - After all the fixes, 8 of 8 seeds reached the 91, in 377–396 s with 0–4 contacts.
4. **Crash cushions inside the 91.**
   - Two ramps (ids 443 and 282) stop inside the 91 East and West, near 65.3 km and 10.4 km. They have no road
     after them, so each got a wall and a crash cushion in lane 3.
   - Fix: a road that stops on another road gets no end wall (`Network.hasEndWall`). Rendering uses the same rule.
5. **Barrier segments tens of metres long on a first look.**
   - `wallsNear` read a segment's end from a shared buffer after checking its neighbours. If that check had to work
     out more of the road, it overwrote the buffer, and the segment's end jumped about 64 m along the barrier.
   - On a curve, that chord cuts across the road for one physics step. On a first pass over every road, 24,221 of
     4.6 million segments were longer than 3 m (up to 74.9 m), and 4 crossed within 1.5 m of a road's centre line.
   - Fix: the end is copied before the neighbours are checked. Now 937 are longer than 3 m (up to 24.4 m), the same
     on a first and a second pass, so those are the shape of the roads, not the cache.
6. **Navigation went quiet.**
   - If a reroute found no way (from a ramp you'd spun onto backwards, say), the route was left empty and never
     planned again. The prompt disappeared for the rest of the drive while Go to still showed a destination.
   - Being turned around at the end of a freeway never re-planned either.
   - Fix: `Game.followRoute()` keeps the destination and plans again at the next road and after a turnaround.

**The lane scan.** It finds any barrier within 1 m of a lane's centre line, on every lane of all 20 carriageways
every 4 m.
- Before the fixes: 121 spots. 17 were barriers 2.5–3.5 m overhead and 104 were at road level. The at-grade count
  depends on the order roads are first looked at.
- After: 0.

### Found, not fixed

- **The autopilot isn't a perfect driver in Heavy traffic.** It crashed in 2 of 12 seeded two-minute Survival runs,
  before and after the fixes:
  - It rear-ended a car during its own lane change.
  - A traffic car (not an aggressive one) changed lanes into it about 5 m ahead, closing at 20 m/s.

  The suite seeds Survival and Free Drive traffic so its runs repeat. The game itself still seeds them at random.
- **No planned way north from the far south.** Past about 42.6 km on the 405 South and 53 km on the 5 South, the
  planner has no way back north, because turnarounds and street exits aren't in its graph. The prompt is blank until
  you're turned around at the end, and then it comes back.
- **Switching graphics presets leaks a little.** Each round trip to Ultra leaves about 17–20 more textures alive
  (36 → 56 → 73). The frame rate on Low afterwards is unchanged (1.63 fps before, 1.50 and 1.63 after, at 320×180).
- **Frame rates here are low.** SwiftShader in this sandbox draws Low at about 1.6–2.3 fps, Medium at 0.3–0.7 fps,
  and High and Ultra at about 0.3 fps once warm. At 640 × 360, the first three frames after a switch took 108 s on
  High and 271 s on Ultra. Low runs no faster at 320×180 than at 640×360, so it's limited by geometry (about 400 draw calls and 440k
  triangles), not pixels. This is not a phone measurement.

## 2026-10-09 (later): P2–P4 systems

All of these were built, then checked in Playwright. Results are as printed by the test scripts.

### Profile (`profile.ts`)

Versioned v1 on the device: XP and levels, fictional credits, lifetime stats, freeways driven, nine achievements, and
a Profile screen.

Verified:
- XP and levels accrue from driving.
- "Ton Up" unlocks.
- The Profile screen renders at phone size.

### Weather and time (`env/Environment.ts`)

Verified:
- Six combinations rendered (day, sunset, night, rain, fog, mist) with no errors.
- Rain: grip 0.8, wet 1.
- Fog: visibility 0.14.
- Live mode at 02:13 Pacific gave daylight 0 (correct).

### Drivers and abilities (`drivers.ts`)

| Ability | Verified result |
| --- | --- |
| Clear Path | Removed 0 of 67 cars in view and 26 out of sight; scale 0.65 during, 1 after; the 45 s cooldown blocks a refire |
| Focus Time | Traffic moved at 0.70× |
| Locked In | Grip 1.00 → 1.30 → 1.00 |

Hand poses were checked in screenshots (the watch flex shows the gold watch).

### Races, cars, garage (`race.ts`, `cars.ts`)

Verified:
- The countdown holds you and all rivals at 0 m/s.
- Racing slowly ends "Too far behind" at P4.
- Flat out, the autopilot won the Irvine Sprint, and 1,500 credits and racesWon were added.
- Buying the Brio for 9,000 of 20,000 credits leaves 11,000, and the physics mass becomes 1,250 kg.
- The showroom refuses without enough credits ("29,900 more credits needed") and below the car's level ("Opens at
  level 8").

**Bug found and fixed.** Rivals crept forward at 1 m/s during the countdown.

### Ultra Realism and radio

Verified:
- Locked below level 5.
- At level 6 and 155 mph, tunnel vision reached 0.37, and it switches off on its own.
- The radio cycles Coast → Freeway FM → Canyon Radio → off, with the audio context running.

**Bugs found and fixed:**
- On phones the top bar covered the gear readout. Buttons now have their own row.
- Route shields on the profile were greyed out by a CSS selector.
- Coarse terrain tiles could cover a road in a cut at speed. They now stay below nearby roads.

### Full regression (`final.js`)

Verified:
- Loads in 16.9 s in software rendering.
- 405 N → 55 N in 274 s on the autopilot.
- Night and rain render.
- The High and Ultra presets rebuild mid-drive.
- Recovers from a lost WebGL context.
- Pause and resume work. Reset was checked separately with real frames: 39.9 → 0.5 m/s.
- Speed Survival scored 2,723 points, with a best streak of 27.6 s.
- The race finished P1.
- No page errors.

## 2026-10-09: the real freeway network

### Data

- **OpenStreetMap is blocked here.** The sandbox blocks openstreetmap.org, overpass-api.de and geofabrik.de (proxy
  403).
- **Overture Maps is reachable.** Its public S3 bucket is open, and Overture's transportation theme is derived from
  OSM under the ODbL. We range-read only the parquet row groups that cover OC: 27 row groups in one file.
- **What came out.**
  - 4,166 motorway and trunk segments, with route refs, connectors, levels and destinations.
  - 46,902 street segments, used for overpasses.
- **Elevation.** 324 AWS Terrain Tiles at zoom 13 (USGS 3DEP/NED in the US).
- **The builder** is `tools/oc-network/build.py`, whose README explains it. It produces:
  - 20 carriageways and 1,247 ramp pieces
  - 1,256 junctions and 506 grade-separated crossings
  - 247 street overpasses and 428 exit signs with OSM destination text
- **Builder checks.**
  - 502 of 506 crossings clear 6.5 m. The other 4 are listed in its output.
  - The largest height step at a junction is 0.29 m.
- **Reachability** (offline graph check): every freeway direction can reach every other, except SR-261 South. That
  one really ends at Walnut Ave; in the game it turns you around.

### Engine

- **Rewrite onto the data.** The procedural single road was replaced:
  - `world/Path.ts`: spline paths, one-way, finite.
  - `world/Network.ts`: grid, surfaces, barriers, routing.
  - `world/Roads.ts`: chunk streaming for every path, overlap culling, decks and columns, guide signs, overpasses.
  - `world/Terrain.ts`: real elevation tiles, road embankments and cuts, OC scenery, the sea.
- **Physics** now collides with real barrier segments, gore noses included.
- **Traffic** runs on every nearby carriageway, follows Y junctions, and collides in world space.
- **Phone-first UI.** The Controls screen is gone. The top bar has View, Go to and Pause. The corner window shows a
  map or a sky camera. There are five traffic levels, a start-freeway picker, and a local leaderboard.

### Verified: driving through real interchanges (the autopilot steers, the physics drives)

Each chain is one continuous drive with no teleporting. Route and path switches came from the game's own
`trackPath`. One of the chains had started on I-405 North by mistake: the test script never passed its starting
point through to the browser. That bug was fixed for later runs, and the chain is still a valid drive.

| Chain | Freeways | Result |
| --- | --- | --- |
| I-405 N → 55 N → 91 E → 241 S | 4 | All reached (I-5 S leg ran out of the 900 s test budget on the 241) |
| I-405 N → 55 N → I-5 N → 57 N | 4 | All reached: 405/55 connectors, 55→5 connector, the Orange Crush to the 57 |
| I-405 N → 55 S → 73 S → I-5 S | 4 | All reached: the 73 ends in the 5 at San Juan Capistrano |

Freeways driven so far: I-405, CA-55, CA-91, CA-241, I-5, CA-57 and CA-73.

Later the same day, after the steering change and the ramp-side fix:

| Chain | Result |
| --- | --- |
| I-405 N → 55 N → 91 E → 241 S | All reached again with the new steering |
| 91 W → 55 S → I-5 S | Reached. The 55 South starts from the 91 at a Y |
| I-5 S → 55 S → 405 N, then 55 N → 91 W → 57 S → **22 E** | All reached |
| 241 N → **133 S** → I-5 N → 55 N → 91 E → 241 S, then **133 N** | Both 133 directions reached. The 261 leg ran out of its 1,600 s budget; reaching 241 South from 241 North means a long loop |
| 241 S → **261 S** at the Y (`dbg3.js`) | Hand-off at s = 9,197 m, then 500 m on the 261 |

**All ten freeways have now been driven through real junctions:** I-5, I-405, 22, 55, 57, 73, 91, 133, 241, 261.

**Bug found and fixed.** The autopilot drove past the I-5 South → 133 connector. `sideOf()` judged the ramp's
side against the straight tangent at the split, and the 5 curves there. It now projects onto the curved road.

- **No page errors.** None of the game runs logged a page error. The only error in the logs came from that same test
  script.

### Verified: Speed Survival (`modes.js`)

- 45 s at the autopilot's 116 mph cruise in Heavy traffic: score 1,601, best streak 10.6 s, 8 clean passes,
  1 near miss.
- A car that has already scored can't score again.
- The streak drops to 0 under 100 mph, and the best streak is kept.
- Ramming a car at a closing speed of about 22 m/s ends the run, and the results screen shows.
- The results screen shows the "Local leaderboard · this device only" label. The automated check for this missed it
  first time: the CSS uppercases the label, and the check was case-sensitive. The label itself is there.

### Verified: physics fixes

- **Bug: traffic collisions pumped energy in.** The car you hit was slowed instead of pushed, so contact repeated
  every step. Seen: 275 mph backwards. Fixed the sign of the impulse.
- **Sim mode spinning at about 160 mph.** Three causes:
  - The tyre falloff had a step at 0.12 rad. It's now smooth.
  - The 2.6° steering floor at speed asked for about 13 g. Lock is now speed-sensitive, at about 0.6° at 200 mph.
  - Sim had no stability control at all. It now has a light race-mode one that only acts past about 5° of slide.

  Result, autopilot at handling 1 (`sim.js`):

  | Cruise | Worst slide | Spins |
  | --- | --- | --- |
  | 134 mph | 0.8° | none |
  | 168 mph | 3.6° | none |
  | Flat out (166 mph on the curves) | 14.5°, once | none |

  There was one 14.5° slide flat out. Race-mode stability control caught it.

### Verified: UI at phone size (390 × 844, touch)

- The menu, start picker, Go-to picker, driving HUD and sky camera all render. There's no horizontal scroll.
- Found and fixed: the top bar covered the gear readout, and the grey HUD labels were unreadable against a bright sky.

### Verified: hands

- The thumb used to cross the rim face like a stick. It now lies along the rim's inner side, and the back of the
  hand sits over the rim.

### Not done yet, honestly

- **Performance on a real phone is unmeasured.** In SwiftShader the Low preset drew about 400 to 800 calls and
  500k triangles. Tree canopies were the biggest share and now have a 4× lighter phone version, not yet re-measured.
- **Exits.** There are no exit numbers, and street ramps rejoin by moving you to an on-ramp, not by driving streets.

## Before this log

- **Top Speed OC v1/v2.** A single-file canvas game, committed and published earlier (commit 24ac829).
- **Ultra.** A 3D engine on a procedural freeway. It became the base for this work.
