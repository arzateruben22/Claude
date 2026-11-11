# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

## 2026-11-11: The driving HUD fits with a destination set

The owner asked to fix the interface when a destination is chosen: at 1450 x 767 and 1350 x 750 in the OC Hypercar
headed for Stoppage Time, the destination card sat under the rail, THRUST crowded the speed box and the HUD ran off the
window's edges. Built: one navigation panel top left (turn, guide sign, next exit, then the destination with distance,
time "at your pace", "No traffic", "simulated"); a rail that turns into 44px icons on short windows; THRUST, the ability
and the tank panel left of the speed box; HUD boxes held 16px above the visible bottom in a frame that crops the page
(`--bot`, `--ctl-b`); "Timing..." instead of "-" until the car is fast enough to time. New test groups `nav-hud` and
`venues-trips` (the Lot 57 round trips moved out of `venues` so no run passes 20 minutes).

Frames (tests/out/nav-hud/): before-r1-framed-1350x750, before-r1 (1450x767), after-r1 at 1450x767, 1280x600, 390x844
and 844x390, after-r1-framed-1350x750. Framed scan: 16px gap for the speed box and clock at 1450x767 and 1350x750;
c3962c5 in the same frames has them 14px below the edge and cuts 12 boxes.

Suite (headless Chromium, SwiftShader, load average 18-24): `npx tsc --noEmit` clean; boot 6/6; venues 13/13;
venues-trips 2/2; phone 16/17 (the sky camera check fails the same way on c3962c5, so it was already there); nav-hud 3/3.
It passed a play lens and a code lens.

## 2026-11-11: the driving HUD with a destination set (`claude/nav-hud`, uncommitted)

The owner, 2026-11-09, with screenshots at 1450 × 767 and 1350 × 750 in the OC Hypercar headed for Stoppage Time:
"lets fix the interface when i choose a destiantion". The destination card sat under the right-hand rail (VIEW over
"at your pace" and "simulated"), THRUST sat against the speed block, and in the owner's window the HUD ran off the
top, left, right and bottom.

What changed (`src/ui/HUD.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`):
- **One navigation panel top left** (`.hud-tl` > `.hud-navs`): the next manoeuvre (arrow, distance, guide sign, the next
  exit) and, under a hairline, the destination (name, distance, time "at your pace", traffic "simulated"), with the
  mode's numbers under it in the same column. On a phone they stay lines of the plate, ordered.
- **The rail** fills the band between the sky camera and the speed block and is a size container: labelled rows when
  they fit, icons (hidden label plus tooltip) in one, two or three columns on a short window.
- **The bottom-right cluster** is sized from one set of tokens (`--spd-w`, `--spd-h`, `--spd-b`, `--act`): the ability
  and THRUST sit left of the speed block, the tank panel over them, never over the speed or the rail.
- **A host frame bigger than the window** (what the owner's screenshots showed): `useVisibleInsets` reads the visible
  part of the page with an IntersectionObserver and feeds the cut-off edges into the HUD's safe areas (`--vis-*` into
  `--sa-*`). `.app` is `overflow: clip`, so focus cannot scroll the game sideways.

Checked (headless Chromium, SwiftShader; the machine at a load average of about 23):
- A scratch DOM scan, destination Stoppage Time set, Auto-drive off and on: no two visible HUD boxes overlap, every
  box inside the viewport minus safe areas, "at your pace" and "simulated" whole, no sideways scroll, at 1450 × 767,
  1350 × 750, 1366 × 768, 1280 × 720, 1440 × 900, 1920 × 1080, 1280 × 600 and on a phone (DPR 3, touch) at 390 × 844
  and 844 × 390: OC Hypercar Modern with the sky camera, OC Hypercar Modern and Minimal with the map dial (plus
  cockpit and hood at 1350 × 750 and 1280 × 600), Rossini GT Modern and Minimal: 0 failures in 98 measurements.
  The same scan on c3962c5 failed at all four desktop sizes run (1450 × 767, 1350 × 750, 1280 × 600, 1920 × 1080: the
  destination card under the rail; the ability over the speed block; at 1280 × 600 the tank panel under Pause); its
  two phone sizes passed. Not separately confirmed: Minimal's tucked state (in the scan the rail was still showing
  after 5.5 s; tucking only hides boxes, and the phone group's Minimal check covers the tuck itself).
- The game in a frame larger than its window (cut 20/30 px and 10/20/90/30 px): the observer read the crop exactly and
  no HUD box fell outside the visible part; c3962c5 in the same frame cut the rail, the sky camera, the speed block,
  THRUST and the clock, as in the owner's screenshots. Whether claude.ai's viewer crops this way is inferred from those
  screenshots, not measured in the viewer.
- Frames (first pass): `tests/out/nav-hud/before-*.png` and `after-*.png`.

Repair after review (2026-11-11, same branch, uncommitted; the HUD fix itself kept as it was):
- **The bottom line in a host frame.** The speed block, the clock, the map dial and its compass sat flush on the visible
  bottom edge when the page was cut by a bigger frame (`--spd-b` and the clock used `max(16px, var(--sa-b))`). They now
  read one token, `--bot: max(16px, var(--sa-b), calc(var(--vis-b, 0px) + 16px))` (and `--ctl-b` the same with 14 px):
  on a device the same as before, in a cropping frame 16 px off the visible edge like the other edges. Framed scan
  (`after-r1-framed-*`): speed block and clock 16 px above the visible bottom at 1450 × 767 and 1350 × 750, no box cut,
  no overlap; c3962c5 in the same frames: both 14 px below it, 12 boxes cut.
- **Small polish.** The time line reads "Timing…" (not "–") until the car has a pace to time (Game.ts gives -1 below
  4.5 m/s); on a phone the time and the traffic each stay on one line ("No traffic" no longer splits).
- **The check is its own group, `nav-hud`** (`npm test -- --only=nav-hud`), out of the phone group. It opens a phone
  context (390 × 844, DPR 3, isMobile, hasTouch, the hypercar on the Modern HUD, Stoppage Time from the rail's Go to),
  checks 390 × 844 and 844 × 390, closes it, then opens the desktop page (sky camera, Modern) for 1450 × 767,
  1350 × 750, 1280 × 600 and 1280 × 600 with Auto-drive. The blank-page step is gone. `open()` takes a `dpr`.
- **The venue round trips are their own group, `venues-trips`**: inside `venues` they took that run past 20 minutes
  here (cut at 1,200 s in the round trips, as the reviewer's run was).
- **The sky-camera check at base.** c3962c5's phone group (scratch copy outside the worktree, same load, one run at a
  time) fails "sky camera: a sharp live picture inside its frame; it stays while Minimal tucks the map" the same way:
  `page.waitForFunction: Timeout 60000ms exceeded` (its wait for the Minimal tuck). So it is already there, not from
  this work; its 60 s wait is left as it is (raising it is the owner's call). That base run was then stopped by the
  1,200 s cap during the THRUST check (`tests/out/nav-hud/suite-phone-base-c3962c5-r1.txt`).

Proof, re-run after the repair (headless Chromium, SwiftShader, one Playwright process at a time, load average 18-24):
- `npx tsc --noEmit` clean. `npm run build`: "artifact page marked as the owner test build (owner mode on)".
- `--only=boot`: 6/6 passed (103 s).
- `--only=venues`: 13/13 passed (587 s; desktop 412 s, phone 142 s).
- `--only=venues-trips`: 2/2 passed (1,119 s): heap 88.1 MB, then 162.9 / 163.4 / 163.8 MB after each trip; game
  renderer geometries 232/232/232.
- `--only=phone`: 16/17 (1,121 s). The one failure is the sky-camera check above (also failing at c3962c5).
- `--only=nav-hud`: 3/3 passed (411 s): phone 390x844 (pp) 13 boxes, 844x390 (pl) 12 boxes, DPR 3 (88 s); desktop
  1450x767, 1350x750, 1280x600 and 1280x600 with Auto-drive, 13 boxes each (258 s); no page errors.
- Frames with Stoppage Time chosen, OC Hypercar, Modern HUD, sky camera, Auto-drive off, `tests/out/nav-hud/`:
  `after-r1-oc-hyper-modern-sky-autooff-{1450x767,1350x750,1280x600,1920x1080,390x844,844x390}.png` (scan: 0 bad;
  the 1280 × 600 rail is 44 px icons) and `before-r1-*` from c3962c5 (scan: 4 bad: the destination card under the
  rail at 1450 × 767, 1350 × 750 and 1280 × 600, the ability over the speed block at all four desktop sizes, the tank
  panel under Pause at 1280 × 600; its phone sizes passed); `after-r1-framed-*` and `before-r1-framed-*` as above.
  The phone frames are at DPR 3 with touch. The ability in these runs is the default driver's (Clear Path).

## 2026-11-09: the final live merge (`claude/final-live`): what the main link now carries

Built on `origin/local/live-preview` (a29015a: GPS follow, the venues in the game, the two modes) and merged, one at a
time: `origin/claude/onfoot` (3386549, Lot 57 P1d maximum graphics), `origin/claude/sports-bar` (c76046e, Stoppage
Time S2a needs, ordering and screens; S2b pool, darts and shuffleboard; S3a crowd and staff; S3b interactions,
relationships and conversations) and `origin/claude/hypercar` (b49f7f3, which carries `claude/hypercar-drive`: M5 Cold
Thrust, Ground Lock and Thrust Hop; M4 Arcade, Sport and Simulation profiles; M6 Founder Edition plaques, reveal stage
and wake-up sweep; M2 lights and cockpit; SEAT). Not merged: the road debris fix (`claude/fix-road`, under its own
review). Stoppage Time ends at S3b and the hypercar's lane A at SEAT, as the owner chose.

What is on the live link now:
- **Modes.** Exactly Free Drive and Speed Survival. The hypercar branch's race code (rivals, countdown, race tune in
  Races and Time Trial) was not brought back; its race tune runs in Speed Survival, and its checks that drove a race
  now drive Free Drive or Speed Survival.
- **Lot 57** in the game is the P1d page: Low (the retro look), HD and Ultra, inside the game's mount layer (the game's
  'high' is read as HD).
- **Stoppage Time** in the game is the S3b page: the needs strip and mood, ordering at the bar and at a table, the
  screens (simulated matches), the games, the crowd with its conversations.
- **The OC Hypercar** is in the garage out of the box on the owner test build (`dist/artifact.html`, owner mode on):
  Unleashed in Free Drive with THRUST beside FOCUS TIME on the phone, the tank panel, Ground Lock and Thrust Hop; its
  Founder Edition card with the reveal stage; the profiles in Settings.

Fixes the merge needed (one follow-up commit):
- Leaving Lot 57 kept the whole venue alive (about 70 MB of heap a round trip): on Low the venue's toon look had swapped
  the meshes' materials, so the release disposed the toon copies and left the venue renderer on the game's shared car
  paint's dispose listeners. `Look.dispose()` now gives the meshes their own materials back first. Three round trips:
  heap 215, 210, 211, 212 MB (was 216, 280, 349, 418).
- Auto-drive's last throttle stayed on after it handed back on arrival in a fast-forward (the suite saw 78 mph against
  its 72): the pedal now lifts as it hands back.
- `tests/regression.mjs`: the request log the store checks read was lost in the merge; restored.

Checked (headless Chromium, SwiftShader): `npx tsc --noEmit` clean; `npm run build` (artifact 5.3 MB, marked
owner-test); both standalone builds; regression groups boot 6/6, survival 8/8, modes 9/9, progression 13/13, phone
17/17, venues 14/14; `tests/onfoot.mjs --only=desktop` 19/19; `tests/onfoot-p1d.mjs` Low/HD/Ultra at golden hour;
`tests/sportsbar.mjs --only=data` 19/19; `tests/sportsbar-s2a.mjs --only=checks` 22/22; `tests/sportsbar-s3b.mjs
--only=smoke` 1/1. Phone proof (the artifact with a viewport meta, 390 x 844, touch, DPR 3; also 844 x 390 and one
1440 x 900 look) in `tests/out/final-live/`: the two-mode menu; Go to Lot 57, Auto-drive, Get out, Order an agua
fresca, HD, Drive back; the same for Stoppage Time (the TV, a tamarindo at the bar, the needs strip); the garage's OC
Hypercar, driven Unleashed on I-405 North, Cold Thrust held (tank 100 to 73 %) and a Thrust Hop. No page errors.
Not measured on a real phone or GPU. Seen on both this build and `local/live-preview`: after driving back from a
venue the cockpit's wheel pad reads paler than before the trip (not caused by this merge).

## 2026-11-09: two modes only: Free Drive and Speed Survival (claude/modes-trim, not committed)

- **The owner (2026-11-08, about 9:05 PM PT, with a screenshot of the menu's "03 RACES" and "04 TIME TRIAL" cards):**
  "lets get rid of these play modes all entirely and only stick to free drive and try to stay over 100mph game mode".
  The game now offers exactly two modes, Free Drive (`'free'`) and Speed Survival (`'survival'`, "Stay over 100 mph").
- **Removed.**
  - `src/game/race.ts` (deleted): the four courses, the three rivals, standings, gates, race best times.
  - `Game.ts`: `startRace`, `raceTick`, `finishRace`, `endRace`, the race state, the countdown (only Races and Time
    Trial used it), Time Trial's clock, checkpoints and fixed seed, and the race and clock fields of the HUD data and the
    result. `carTop()` stays: Auto-drive's cruise uses it.
  - `Traffic.ts`: the AI racer (`racer`, `addRacer`, `removeRacers`, `clearStretch` and the racer branches in the
    car-following, lane-change, despawn, `clearAround` and `thin` code). Ordinary traffic runs the same code paths and
    draws the same random numbers as before.
  - `settings.ts`: `Mode` is `'free' | 'survival'`; `MODES` lists two; `Settings.course` is gone. New `modeOf()` reads
    any other mode as Free Drive.
  - UI: the menu's Races and Time Trial cards (the menu shows 01 Free Drive and 02 Speed Survival, `.modes` two
    columns at every size), their `ModeArt` scenes, the Race pick, the Races sheet (course picker), the race HUD box and
    its CSS, Time Trial's HUD numbers and its last-10-s warning and wake, the race and Time Trial results, run-card
    variants and bests (the Bests panel offers Speed Survival and Free Drive), the phone's Races app, the World Map's
    Races tab, course line and "Race here" (its Places rows keep their layout under a renamed class), and "Races won" on
    the profile.
  - Copy: the hypercar's blurb, the Store's two-tune text and terms, `catalog.json`'s hypercar description and
    `cosmetics.json` (the free list and the tunes) now name Speed Survival only. README's Modes, `tools/map-shots.mjs`
    and `tools/ui-shots.mjs` lose their race shots.
  - In short landscape windows the rail's "Orange County · California" line is hidden: with two cards the grid is
    shorter and it rose from below the fold (y 477 of 390) to under the Drive dock (y 354). Seen in a baseline-vs-new
    frame pair at 844 x 390.
- **Old saves.** `readSettings()` drops a saved `mode` and `course`; the menu always opens on Free Drive (it never
  remembered a mode). `migrate()` drops `racesWon`. `Game.start('race' | 'time')` from any old caller runs Free Drive.
  `tsu.best.time`, `tsu.race.<course>` and the `time`/`race` lists in `tsu.runs.v1` stay on the device, unread.
- **Decisions.**
  - Story jobs that were races or Time Trial became Free Drive mileage jobs on the same freeways, under the same ids (a
    job already done stays done; pay unchanged): jun-1 8 mi ending on I-405 North (was the Irvine Sprint top two);
    jun-2 12 mi ending on I-5 South (was Time Trial 12 mi); dee-1 6 mi on CA-241 North (was win the Foothill Sprint);
    sal-3 8 mi on I-5 North (was Santa Ana Checkpoints top three); nina-1 15 mi ending on CA-91 East (was Riverside
    Endurance podium). Their texts say Free Drive.
  - Unlocked by race wins: only dee-2 ("Five wins", the 25,000 Survival demo). It is re-tied to **miles driven**:
    100 lifetime miles (`Unlock.miles`, the profile's distance), after dee-1 as before.
  - "Races won" is gone from the profile screen and the profile.
  - Store: no item was race- or Time-Trial-only. Only copy changed (above); the store stays in test mode, the server
    catalog copy is unchanged (`store:sync --check`: in sync, 22 skus).
  - The hypercar: Unleashed in Free Drive, its race tune (the name of the tune, unchanged) in Speed Survival, as
    `tuneFor()` already did for every non-free mode. The cluster's "RACE TUNE" label and the cockpit's drive-mode dial
    ("RACE" among WET/SPORT) are the car's, not a game mode, and stay.
  - Left as is: `Physics.ts` keeps its `hold` flag (the countdown's), now unused by the game: that file is another
    session's. `tests/dynamics.mjs` still checks the launch from a hold; it is physics, not a mode.
- **Tests.** The `race` group and the Time Trial determinism check are gone. New `modes` group (7 checks): two cards,
  01 Free Drive and 02 Speed Survival, no Races or Time Trial text on the menu; a saved `'race'` (first load) and
  `'time'` (second load, with an old profile's `racesWon`, Time Trial and race runs and bests) both open on Free Drive,
  settings drop `mode`/`course`, the profile drops `racesWon` and keeps its credits and story, Bests offers Speed
  Survival / Free Drive; `start('race')`/`start('time')` run Free Drive; no Races in the phone or the World Map; Speed
  Survival at 104 mph with a 17 s streak, then a crash into a stopped car ends it; Auto-drive not offered in Speed
  Survival; the hypercar 341 mph flat out in Free Drive, 234 mph in Speed Survival. The survival group's stopped car is
  now an existing traffic car held by its own stop timer (`stoppedCarAhead`), since `addRacer` went. `tests/story.mjs`
  checks no job is a race or Time Trial, jun-1 is a Free Drive job, and dee-2 opens at 100 miles, not 99.
- **Results (load average 5 to 20 from other lanes).** `npx tsc --noEmit` and the game tsconfig clean. `npm run build`:
  dist/artifact.html 4,847,325 bytes, only it marked owner-test. `npm run store:check`: the same 2 wheel-style problems
  as origin/local/live-preview (src/preview/car-wheel.ts, not ours); the server catalog in sync.
  - `npm test -- --only=boot,survival,phone,progression,modes`: boot 19 s, survival 24 s, modes 55 s, progression
    713 s, phone 604 s; **44/44 passed**. After the landscape CSS fix, `--only=boot,modes`: **14/14 passed**.
  - `node tests/story.mjs`: all passed. `node tests/dynamics.mjs`: **1742 passed, 0 failed**.
- **Proof** (a copy of dist/artifact.html with a charset and viewport meta prepended; 390 x 844 and 844 x 390 touch at
  DPR 3, 1440 x 900; frames in tests/out/modes-trim/, each looked at): the menu at all three sizes shows two cards,
  01 Free Drive and 02 Speed Survival, side by side, no gaps, no sideways scroll, no Races or Time Trial text; Free
  Drive driven on I-405 North (76 mph, 0.39 mi); Speed Survival held at 115-116 mph with the HUD showing the streak
  (16.2 s on the phone, "Over 100 15.8 s" on the desktop), then "Crashed into a sedan" with the Speed Survival result;
  a saved `{mode: 'race', course: 'irvine'}` and a profile with `racesWon: 3` load on Free Drive (4,200 credits kept,
  `racesWon` gone) and drive. No page errors in any of them. The desktop crash frame caught the results card mid
  fade-in (the DOM read shows "Speed Survival", "Crashed into a sedan", 952 points); the phone frame shows it whole.
- **Review round 1 (fixes).** The review found one player-visible mention of races: the phone's Credits app said
  "Earned by driving: distance, clean passes, near misses, races and records." It now says "... near misses and
  records." (`Phone.tsx`). With races gone, the hypercar's "no clock and no rivals" for Free Drive implied rivals
  elsewhere, so "and no rivals" is dropped from `FREE_DRIVE_ONLY` (`Store.tsx`, and its comment), the hypercar
  description in `catalog.json` and the `about` text in `cosmetics.json`; `npm run store:sync` rewrote the server copy
  (no change in its file: it carries no descriptions) and `store:sync --check` reports in sync, 22 skus.
  - Checks: `tsc --noEmit` clean; `npm run build` clean (dist/artifact.html 4,847,276 bytes, owner-test marked);
    `test:story` all passed; `npm test -- --only=boot,survival,phone,progression,modes`: **44/44 passed**;
    `store:check`: the same 2 wheel-style problems from `src/preview/car-wheel.ts` (another session's file).
  - `grep -oiE '\braces?\b' dist/artifact.html`: 14 hits, none of them copy about races: `Promise.race`, the cars'
    `race` tune config and `tuneFor`, and the hypercar's tune name ("RACE TUNE" on its cluster, "race tune" in the
    Store and garage text for Speed Survival). "no rivals" and "races and records" are gone from the page.
  - Proof (frames `*-r1.png` in tests/out/modes-trim/, looked at): the Credits app at 390 x 844, 844 x 390 and
    1440 x 900 reads the new line; the Store's lede reads "(no clock, your Free Drive bests stay on your device, ...)"
    under the "Test mode · Nothing is charged. Use 4242 4242 4242 4242." banner; no line on either screen names races,
    rivals, courses or Time Trial. Menu, Free Drive, Speed Survival (116 mph, 15.4 s streak, then "Crashed into a
    sedan", Speed Survival result) and a save with mode 'race', course 'irvine', `racesWon: 7` and `tsu.mode` 'time'
    (opens on Free Drive, 4,200 credits kept, `racesWon` gone) re-run with the same results as above. No page or console
    errors. The desktop crash frame again caught the result card mid fade-in (DOM read: "Speed Survival", "Crashed
    into a sedan", 1,103 points); the phone frame shows it whole.

## 2026-11-09: the hypercar's two lanes merged and proven together (branch `claude/hypercar`, committed)

Still a **procedural model built in code**, not a finished 3D asset. `origin/claude/hypercar` had nothing new at the
fetch (the live display, Look setting, atmospheres, cinematic menu and World Map were already on this branch; its
last merge here is f0224b8), so
this is lane A (`claude/hypercar`: lights, cockpit, seat drop, body; b34e4a4) plus lane B (`claude/hypercar-drive`:
M4 driving profiles, M5 Cold Thrust / Ground Lock / Thrust Hop, M6 Founder exclusives; 685a1ac). Fourteen files
conflicted; every resolution keeps both sides. M1b body fidelity stays out (dropped by the owner's choice). Races and
Time Trial are untouched here (their removal is on the live branch).

**What the merge broke, and the fixes:**
- **The console plaque floated 12 cm over the console.** M6 placed it for the shared Corsa console (y 0.467 m);
  M2's own hypercar interior (`cockpit.ts` 'hyper') lowers its console 0.12 m, moves it 0.10 m forward and narrows it
  30 %. The plate now follows the lid: centre (0, 0.347, −0.20) m, 0.13 m wide on the 0.147 m lid (the Corsa's, and
  every other car's, unchanged).
- **The pressure gauge sat on the wrong binnacle.** M5 put it over the Corsa binnacle's left display; M2 gave the
  hypercar a screen binnacle and kept a gauge pod for it (`Cockpit.gaugeAt`). The gauge now lives in the pod: a 16:10
  display inscribed in the 46 mm dial, 2 mm behind its glass, at (0.16, 0.671, −0.839) m in the cockpit's frame (the
  old placement stays as the fallback for a cockpit without a pod). In the seat frame it reads 655 bar in the pod
  (`tests/out/hyper-final/free-seat.png`); on the race tune the display is hidden as before.
- **The jets' nozzles and the gauge were built where the cockpit no longer is.** The UI pass split the car's build so
  the Wheels tab rebuilds only the wheels; M5's nozzle and gauge build moved into `buildCarAndCockpit` (it was a type
  error: `ck` undefined).
- **Two tune chips.** M3's chip in the speed block came from the menu's selected mode; M5's `.hud-tune` came from the
  run. One chip now: the speed block's chip row ends in the tune's chip driven by `Game.hud.tune` (Unleashed / Race
  tune), so a run started any way reads right (the menu's mode read "Unleashed" in a Speed Survival run started
  through `window.__game`). M5's four suite reads of `.hud-tune` now read `.hud-chips i`. The profile chip names the
  driving profile (`settings.ts` `profileOf`: Arcade, Sport, Sim or Custom).
- **`--ice` meant two things.** The drive lane set `--ice: #8fd0ff` on `:root`; the UI pass made `--ice` the accent
  each car's atmosphere re-points (orange for the GT, teal, yellow, violet). The atmospheres keep `--ice`; the
  hypercar's systems (THRUST panel and button, Ground Lock light) and the Founder Edition card use new fixed tokens
  `--founder`, `--founder-line`, `--founder-wash`, `--founder-glow` (#8fd0ff, the drive lane's values). The profiles'
  ticks used `--amber`, which the UI pass removed: now `--cyan` (what's selected).
- **THRUST overlapped the ability button on desktop.** The UI pass moved the ability to 300 px from the right; THRUST
  is now at 386 px (10 px clear). At 960 × 540 the boxes are THRUST 498-574, ability 584-660 px across.
- **Two `paintFor`s.** `cars.ts` (the Paint tab's per-car paints) and `founder.ts` (the reserved-paint guard). Game.ts
  imports the founder one as `founderPaint` and the car wears `founderPaint(id, paintFor(car, saved), own)`. The
  hypercar's first paint in the Paint tab is Glacier Silver (`GLACIER_SILVER`; it was named "Founder Silver", same
  0xc8d3e8).
- **The LED colours.** `FOUNDER_ICE` (founder.ts) now holds M2's tuned strip colours (core 0x5eb8ff, halo 0x1e6fd8,
  edge 0x0c4fb8; it held the pre-M2 0xa6dcff / 0x2f8fe8) and `car-shape.ts` reads all three from it.
- **Two checks the merged suite found.** (1) The progression group's Founder garage-card check opens the garage
  from the menu and drives the hypercar from its card, but the tune-chip check that now runs before it (lane A's)
  ended inside a Speed Survival run with the hypercar chosen (so the card read "Driving it" and its lights never
  woke): it now goes back to the menu at its end and puts back, and applies, the car it came in with. (2) Clear Path removed cars in sight ("24 cars in view vanished", abilities):
  it judged "in sight" by the camera alone, which holds whatever the last drawn frame left; in the merged game a run
  opens with a half-second blend from the menu's cinematic shots, and frames here took up to 17 s, so the likely
  cause (not proven frame by frame) is a camera still facing elsewhere when the check fired. `Traffic.thin` now keeps
  a car that is near, or ahead of the camera, or ahead of the car itself (the check's own test of "in view").
- Kept from both: the per-car atmosphere and `ability: 'hyper'` on the hypercar's `CarDef` (the race tune clears the
  ability), lane A's lamp work (signals, reverse, brake haze) with lane B's wake-up sweep on the LED, blade and bar
  materials, the earnings cap with the hyper latch, the Look setting with the profiles' defaults, the run card's
  atmosphere palette with the Founder badge's fixed ice.

**Checks (headless Chromium, SwiftShader, through `window.__game`; no real phone or GPU):**
- `npx tsc --noEmit` clean; `npm run build` (single file 3516 KB js, 101.8 KB css); `node tests/dynamics.mjs`
  **1742 passed, 0 failed**.
- `npm test -- --only=boot,race,survival,abilities,progression,phone,render`, one run on the merged build
  (`tests/out/hyper-final/suite.log`, load average 13-19 on the shared 4 cores): **73/76**. boot 6/6 (31 s),
  survival 8/8 (51 s), race 8/8 (119 s), abilities 20/21 (280 s), progression 8/9 (494 s), render 14/15 (1451 s),
  phone 9/9 (242 s). The three failures: Clear Path and the Founder garage card (both fixed above), and render's
  "pause stops the simulation, resume carries on", which timed out waiting 60 s for 5 frames (no assertion failed):
  the check before it measured 3 frames in 53 s after rebuilding the hypercar twice, and the next check (reset, 5
  frames) passed. Not re-run (render takes 24 minutes here); it is load, as far as this run shows, not proven.
- After the two fixes, only the two groups they touch, re-run: **abilities 21/21** (173 s; Clear Path: "154 → 122
  cars; all 57 in view kept") and **progression 9/9** (305 s; the garage card: "played 66 frames to 6.2 s, a stage
  frame 30 calls, 70,123 triangles … chosen: lights at 0.32 s into the wake")
  (`tests/out/hyper-final/suite-recheck.log`, `suite-recheck3.log`; in `suite-recheck.log` the card still read
  "Driving it", and in `suite-recheck2.log` the restored car was chosen but not applied, so the scene still held the
  hypercar and choosing it did not wake its lights).
- **The car, driven** (`tests/out/hyper-final.mjs`, owner mode by `#owner`, 960 × 540 High, seeded): Free Drive
  started from the menu: the OC Hypercar, Unleashed (grip 1.3), ability live, chip "Unleashed", THRUST and the tank
  panel on screen. On an empty I-405 North straight, 0-60 mph: 2.20 s on its tyres alone (ability off), 1.31 s with
  Ground Lock, **0.79 s with Cold Thrust held** (0-100 mph 1.46 s; tank 100 % → 1.4 %). From 60 mph, 40 s flat out on
  the autopilot reached **322 mph**. A Thrust Hop at 67 mph: "ok", 1.1 s airborne. Speed Survival started through
  `window.__game` (night): race tune (grip 1.04), no ability (`hyper.live` false, no THRUST keys or button, THRUST
  held gives 0 N), chip "Race tune"; a 25 s run on the autopilot at 100 mph in moderate traffic with THRUST held
  scored 2,281 with no collisions; the race tune's 0-60 is 3.09 s (twice), and 40 s flat out from 60 mph reached
  226 mph. No page errors. Frames: `tests/out/hyper-final/free-seat.png`, `free-chase.png` (the jets flowing, the ice
  strips, the red bar), `survival-seat.png`, `survival-chase.png` (night, headlight pool, race tune chip). They were
  taken on the build before the Clear Path and suite-order fixes, which change nothing they show.
- **Not done, honestly.** The 0-100 of the race tune measured 5.45 s in one run and 10.39 s in another (the second
  launched inside a Survival run whose own rules may have intervened), so only its 0-60 is quoted. At 960 × 540 the
  ability button's right edge overlaps the speed block by 8 px (the UI pass's layout at that width; not this merge's).
  A run's results card reads the run's fields 1.2 s after it ends, so a new run started inside that window (only
  possible through `window.__game`) shows the new run's distance and top speed on the old card; not changed here.

## 2026-11-09: SEAT, the hypercar's seat view, rolling tyres, tune chip and Free Drive earnings cap (branch `claude/hypercar`, committed)

Still a **procedural model built in code**, not a finished 3D asset. The merged M2 had already replaced the drive
branch's temporary `HYPER_EYE` with the per-car `seatOffset` (0.20 m lower, 0.10 m in); this pass finishes the seat
view and M3's leftovers. The other session's unjudged seat pass (`origin/claude/wip-c-seat`) was read first; taken
from it: the forward seat (`seatFwd` 0.10 m, through `seatOffset`, the cabin silhouette and the dash profile), no
wipers on the hypercar, and the windscreen ghost fading up the glass. Not taken: its smaller display and second dash
light line (the display already sits in the wheel's opening), and its windscreen top at −0.20 (measured: the header
still crossed the top of a portrait phone's frame).

- **Seat view (`car-shape.ts`, `car-body.ts`, `cockpit.ts`).** Eye at (−0.27, 0.96, 0.0) m, 0.118 m under the
  headliner (the Corsa's: 0.113). The windscreen runs up to z −0.10 (was −0.30) with the side glass's front corner and
  the smoked roof glass moved back with it, so the header's lip sits 42 degrees above the eye line (the Corsa's: 14),
  over the top of the frame on 16:9 (top edge about 25 degrees up) and portrait (about 33). Seen from the seat
  camera's numbers (`tests/out/seat/measure/`): the lip's lowest point was 170 to 232 px down a 1280 × 720 frame and
  230 to 272 px down a 390 × 844 one; now 142 and 130 px above them. The hypercar's side-glass frit column is half as
  wide (its long raked front edge made a 6 cm black band beside the A-pillar), its windscreen has more rows (the top
  frit row stays narrow and out of frame), the wipers are gone (two dark bars across the road), and the dashboard's
  reflection fades out from 30 to 60 % up the glass (at night its far edge was a hard line across the sky: a sky
  pixel through the screen, (700, 200) in the 1280 × 720 night frame, went from (44,37,30) to (14,12,8)). The eye, cockpit, hands (`armsAt`) and steering
  wheel move by the one per-car offset; every other car's is zero.
- **Tyres roll with the road (`PlayerCar.ts`).** Each axle's spin is the physics' wheel angle × `SPEC.wheelR / r`.
  One simulated second at 30 m/s (`tests/out/seat/spin-check.mjs`): the car moved 30.28 m; the hypercar's front tyre
  turned 86.57 rad × 0.35 m = 30.30 m and its rear 81.90 rad × 0.37 m = 30.30 m (unscaled they turned 87.82 rad,
  30.7 and 32.5 m). The GT (0.345 m) is unchanged (factor exactly 1, as for the Corsa); the Brio's 0.332 m and the
  Vela's 0.35 m tyres now also roll true (factors 1.039 and 0.986).
- **Tune chip (`App.tsx`, `HUD.tsx`, `styles.css`).** While the hypercar is driven the HUD's chips end in
  **Unleashed** (filled, Free Drive) or **Race tune** (outlined in the same ice blue, Speed Survival). At 390 × 844
  each is 65 × 14 CSS px at 8.5 px type (`tests/out/seat/after/chips-free-over-survival-390x844.png`).
- **Free Drive earnings cap (`cars.ts` `topSpeed`, `earnCapFor`; `Game.ts`; `profile.ts` `paid`).** While the hypercar
  runs Unleashed, the distance that pays XP and credits is counted at no more than the race tune's top speed,
  102.49 m/s; the profile's distance driven still counts in full. Suite check (progression): 31.5 s held at 150 m/s
  drove 4,700 m and paid 3,211 m (16.06 credits, 32.11 XP; the cap allows 3,228 m); at 90 m/s it paid 2,800 of
  2,824 m. Flat out that is about 1,845 credits an hour, the best earnable car's pace. Not capped: interchange and
  first-freeway bonuses and errands (fixed sums per event, not per metre).

Proof, all looked at. In-game seat frames, before (the HEAD build) and after, day and night, 1280 × 720 High and
390 × 844 phone (Medium, touch, 2x), the hypercar and the Corsa (`tests/out/seat-shots.mjs`):
`tests/out/seat/{before,after}/{oc-hyper,rossini-corsa}-{day,night}-{1280x720,390x844}.png`, plus
`after/oc-hyper-day-390x844-survival.png`. (The 1280 "before" frames have no HUD: the script showed it from the 390
run on.) In-game frames differ run to run (engine buzz, live mirrors), so the other cars' sameness is shown on the
preview: seat views of the GT, Brio, Corsa and Vela at 960 × 540 from the HEAD source and the working tree
(`tests/out/seat/preview/{before,after}/*-seat.png`): Corsa 28 and Vela 91 pixels differ, by one level at most; GT 64 and
Brio 93, and every one of them over one level (47 and 68) is on the tachometer's needle, which sweeps with time
(`gt-seat-diffcrop.png`, `brio-seat-diffcrop.png`); their cockpits'
own calls and triangles identical (GT 62 / 169,572, Brio 59 / 159,618, Corsa 63 / 158,988, Vela 54 / 148,704). The
hypercar's cockpit 60 → 58 calls, 167,389 → 167,707 triangles; its body 29 → 28 calls, 251,430 → 250,654
(the wipers out). Its side and hero views before and after: `tests/out/seat/preview/hyper-{side,hero,seat}-before-over-after.png`.

Checks: `npx tsc --noEmit` clean; `npm run build` (top-speed-ultra.html md5 52948b3f…); `node tests/dynamics.mjs`
**1742 passed, 0 failed**; `npm test -- --only=boot` 6/6, `--only=render` 14/14 (the M2 check now reads "eye
-0.27,0.96,0"), `--only=phone` 5/5, `--only=progression` **7/7** with the new check "OC Hypercar: Unleashed / Race
tune chip, Free Drive earnings capped at the race tune's pace" (logs `tests/out/seat/suite-*.log`).

Left as they are, for every car: the windscreen's dust film is additive and unlit, so at night the sky through the
glass takes a faint warm cast; the A-pillar trim reads tan at night. `seatX` stays 0.27 m (the sheet's occupants are
about 0.25 m out; at 0.25 the narrowed buckets would sink another 2 cm into the console).

## 2026-11-09: sync merge of `origin/claude/hypercar` into this lane's M2 (branch `claude/hypercar`, not pushed)

Merged the other session's 91 commits (`91421fb`..`67e65b9`: per-car atmospheres and driver colours, the Ultra grade,
`PROJECT_OC_STYLE_GUIDE.md` with ULTRA tokens, the hypercar's live display in `car-gauges.ts` and the Look setting, the
cinematic menu camera, the World Map, the Wheels tab, hands, wheels, physics, story and the rest) into this lane's M2
(`8f57a02`). Still a **procedural model built in code**, not a finished 3D asset. Conflicts in `PlayerCar.ts`,
`car-body.ts`, `car-tex.ts`, `car.ts` and this log; `cockpit.ts`, `car-shape.ts`, `test-car.ts` and `regression.mjs`
merged on their own. Every side's work kept; where both finished the same M2 item:

- **Blade colours: theirs** (emissive edge 0x0c4fb8, body 0x1e6fd8, core 0x5eb8ff, the car's new LED family).
  Judged on the same night front render with each texture (`tests/out/preview/m2-sync/ab-blade-theirs-front-night.png`,
  `ab-blade-ours-front-night.png`, crops `ab-blade-crops-x3.png`). Theirs reads as a white-blue core in a deeper blue
  glow, as the sheet's FRONT does; ours read flatter mid-blue. Lit blade pixels average (141,164,195) against ours'
  (139,160,190); the sheet's strips sample about (122,152,190). **Kept from this lane:** the blade geometry (the tip
  and socket taper), the socket's blue spill (re-tinted to 0x1e6fd8) and the smoked lens at 0.3 of the sky.
- **LED strips: theirs** (`HYPER.led` with an `edge` stop, `ledTex`/`M.led` take it). This lane had not changed them.
- **Beams: both.** This lane's positions from the blades (`beamAt`); their ice-tinted beam colour and road pool.
- **Red bar: this lane's** (levels 0.5 → 6, the brake haze `brakeGlow` with `glowTex`); theirs had not changed it.
- **Interior: both.** This lane's seat drop, roof glass and bulkhead fixes; their carbon plinth and amb line at 1.4.
- **Binnacle: theirs.** Their live driver display replaces this lane's tach with "O C". The header comment in
  `cockpit.ts` now says so.
- **Fixed after the merge:** their display, centred on the driver, reached x 0.01 m and ran into this lane's M5 gauge
  pod at x 0.06 m. In the seat and dash frames the pod's bezel cut the display's top-right corner. The pod moved to
  x 0.16 m and is now clear.

Checks: `npx tsc --noEmit` (both configs) clean; `npm run build` (artifact md5 234e1b0b…);
`node tests/dynamics.mjs` **1742 passed, 0 failed**; `npm test -- --only=boot,render,phone` **25/25 passed** (boot 29 s,
render 676 s, phone 141 s; the M2 check "eye -0.27,0.96,0.1, beam 0.71,0.49,-2.25; bar 0.5 → 6 and its haze; right
signal lit 0.5 s into a lane change (0.54 m); … left driving at 30.02 m/s"; log `tests/out/m2-sync/suite-boot-render-phone.log`).
That suite run was **before** the pod move. The move is one constant, re-type-checked and rebuilt, but not re-run in
the suite.

Frames (960 × 540, one browser, `tests/out/m2-sync/shoot.mjs`), all looked at:
`tests/out/preview/m2-sync/hyper-night-{beauty,rear,seat,dash}.png`. Seat and dash were re-shot after the pod move.
Exterior 29 calls / 251,430 triangles (the other session's wheels add about 4,900 over M2's 246,566). Interior
60 calls / 167,389.

## 2026-10-20 to 11-09: the OC Hypercar's lights and cockpit (hypercar M2, branch `claude/hypercar`)

Still a **procedural model built in code**, not a finished 3D asset. The first M2 pass was cut off by a usage pause
and its work was committed unjudged (`d2f046b`). Later passes left edits on disk: the blades rebuilt to the sheet, the
brake haze, and fixes to the signals and the bulkhead. The pass of 2026-10-21 reviewed both, kept them, re-measured
the numbers and logged them here. The pass of 2026-11-09 found the code unchanged since then (its `npm run build` is
byte-identical to the 2026-10-21 one: `dist/artifact.html` md5 f4ea4917…, `dist/top-speed-ultra.html` 3c0ecbba…),
kept it, shot every in-game frame again (`tests/out/m2o/`) and ran the suite groups that had not yet passed with the
M2 check in them. Every number below is from the code as it stands.

- **Headlamp blades, the face's main feature** (M1b item 2, ticked in the plan). They are built to the sheet's FRONT
  panel, where each blade's inner tip sits about 0.47 m off the centre, with silver nose between the two tips. Read
  again on 2026-10-21 from the panel at 3×, the tips sit 0.46 and 0.48 m off the centre and the outer ends at 0.92 m.
  - Each blade is a lit face 25 mm tall along the head quad's swept front edge. It runs from (0.45, 0.39, −2.34) m
    out round the fender's corner to (0.90, 0.53, −2.06) m: 0.54 m in plan, 0.56 m along its path. It narrows to
    6 mm over its inner eighth.
  - Over it, a smoked socket stands 74 mm over the face at the outer end, where the three-cell module sits. It tapers
    to nothing about halfway in, and is 2 cm deep in plan at the tip and 16 cm at the outer end.
  - The lens keeps a third of the sky's reflection, and the blade's blue glow reaches only its lower fifth. So from
    the hood camera, which looks down on them, the sockets read as dark glass with a blue edge.
  - Measured from the built geometry with `tests/out/m2g-measure/run.mjs`. Against the sheet:
    `tests/out/preview/m2o/blades-sheet-vs-render.png` (the sheet's FRONT over the preview's front view at night, with
    the game's bloom, and by day; re-rendered 2026-11-09: 29 calls / 246,566 triangles, as before).
  - An earlier pass (`tests/out/m2e/`) ran the blades in to 0.14 m along the lower nose, so they nearly met as one
    curved bar. That version is gone.
- **Beams from the blades.** The two spot beams start 55 % of the way out along each blade, at
  (±0.72, 0.49, −2.25) m (`CarBody.beamAt`), aimed at (±0.72, 0.9, −70). The road pool is unchanged: the game's
  painted strip for every car, fading in from 2 m ahead of the centre (under the nose) and painted for lamps 1.24 m
  apart, against the blades' 1.43 m. Measured in the game: off by day; at night
  on (intensity 70, pool opacity 1), with the blades' emissive going from 2.4 to 5.4.
- **The red bar on the brakes.**
  - The bar's levels are 0.5 as a tail light and 6 on the brakes (`lampMaterials('blade')`, read by `PlayerCar`
    through the tail material's `userData.levels`). Every other car keeps 1.6 → 5.
  - While braking, a red haze spreads round the bar (`brakeGlow`: one additive quad 1.68 × 0.11 m, 2 triangles, one
    draw call only while lit). The bar is 2 cm tall, one or two pixels from the chase camera, so its level alone
    barely shows there.
  - Red pixels round the bar in the game's chase frames go from 134 to 691 by day, and from 191 to 929 at night
    (2026-11-09: `tests/out/m2o/day-chase-free-vs-brake-x4.png`, `night-chase-free-vs-brake-x4.png`; the 2026-10-21
    frames gave 136 → 704 and 192 → 885). Counted by `tests/out/m2o-brake-compare.py` in the box x 370–590,
    y 320–400, where a pixel is red if r ≥ 120 and r is more than 1.8× both g and b.
- **Turn signals and reversing lamps.** They are built hidden and switched by visibility (`SWITCHED_LAMPS`).
  - The amber signals cover the upper two thirds of each front corner LED (y 0.18–0.33 m) and the bar's outer
    0.26 m. They flash at 1.5 Hz on a lane change (sideways faster than 0.6 m/s for 0.2 s above 6 m/s, held 1 s),
    and while the front wheels are steered past 0.12 rad under 12 m/s.
  - White reversing lenses sit either side of the plate.
  - Signals are for driving forward only: backing up never signals. An earlier run caught the left signal blinking
    while the car backed up at 22 mph and weaved.
  - In the game at night:
    - The right-hand signals lit 0.45 s into a lane change (0.63 m across; the same on 2026-11-09), and the
      left-hand ones 0.45 s into one the other way (0.55 m).
    - Full-lock turns at 5 mph signalled the side turned to (both runs).
    - The reversing lamps came on in gear −1, with no signal: at 18 mph backwards on 2026-10-21, and on 2026-11-09 at
      83 mph backwards (−36.9 m/s), because the shot script holds the brake for 4.5 s and the Unleashed tune's reverse
      has no speed limit (see "Not M2's" below).
  - Frames: `tests/out/m2o/night-signal-right-and-reverse-x4.png` (2026-11-09: the bar's right end amber, then the
    two reversing lamps; 20 amber pixels in the bar's box against 0 in the reversing frame), and
    `tests/out/m2h/hyper-night-chase-signal-left.png` and `hyper-night-front34-signal-left.png` (the bar's left end
    and the near front corner amber). The front three-quarter camera sits on the car's left, so for the
    right-hand signal it sees only the unlit near corner (`tests/out/m2g/night-front34-signal-right-x4.png`).
- **Cockpit `'hyper'`:**
  - The Corsa's carbon buckets, roll hoop and Alcantara wheel, with ice-blue stitching and rim stripe, and blue
    harnesses.
  - An ice-blue ambient line along the dash and both door cards.
  - The OC badge on the wheel's boss, and "O C" on the tachometer.
  - A gauge pod on the dash for M5's tank gauge (`Cockpit.gaugeAt`).
  - No rear-view mirror: under the low header it would hang across the road.
  - The driver sits 0.20 m lower and 0.10 m further in (measured eye in the game (−0.27, 0.96, 0.10) m). This
    replaces the drive branch's temporary `HYPER_EYE`. The hood camera is at 0.85 m.
- **Fixed in review of the earlier passes' code:**
  - The bulkhead behind the seats had widened by 12 mm a side on every car. Now only the hypercar's follows its wall.
  - The night shot script read the lamps before the car's update, so its signal frame was frozen in the off phase.
    The scripts now read them after it, with the traffic cleared round the car.
  - The suite's M2 check left the player's car rolling backwards at about 8 m/s (it backs up for the reversing
    lamps). The `pause` and `reset` checks after it drive on the autopilot for a few seconds and expect forward
    speed, so on a loaded machine they failed (s went backwards on resume; 20 m/s where they want 30). The check now
    puts the car back in its nearest lane, driving forward at the speed it came in at, and asserts that it did.
- **In-game frames.** High, 960 × 540, I-405 North, owner mode, Free Drive (the Unleashed tune), with the hypercar
  picked as the owner's car. Shot again on 2026-11-09 with `tests/out/m2o-lights.mjs` (the 2026-10-21 script, writing
  to `m2o`); logs `tests/out/m2o/lights-day.log` (07:06–07:22) and `lights-night.log` (07:23–07:40), no page errors.
  The frames:
  - `tests/out/m2o/hyper-{day,night}-{cockpit,hood,chase,chase-braking,front34}.png`
  - `hyper-night-chase-signal-right.png`, `hyper-night-front34-signal-right.png`, `hyper-night-chase-reverse.png`
  - the left-hand signals, in `tests/out/m2h/` (`m2h-signal-left.mjs`, 2026-10-21, the same code)

  The 2026-10-21 frames (`tests/out/m2g/`, and `m2m/` by day) and the 2026-11-02 night frames (`m2n/`) came from
  builds byte-identical to this one.
- **Cost.** The player's car's whole-frame cost: every pass, the car shown minus the car hidden. Compared with the
  Rossini Corsa at the same moment (2026-11-09, `tests/out/m2o/lights-day.log`):
  - From the seat: 182 calls / 876,960 triangles, against the Corsa's 264 / 1,272,326. The Corsa also renders a
    rear-view mirror, which the hypercar doesn't have.
  - Chase: 123 / 446,402, against the Corsa's 131 / 422,745.
  - Hood: 47 / 339,691.
  - Braking adds 1 call and 2 triangles (124 / 446,404).
  - The exterior on the preview page (side view): 29 calls / 246,566 triangles on `high` and 29 / 126,184 on
    `phone` (`tests/out/preview/m2i/hyper-side.png`, `hyper-phone-side.png`). That is 572 and 428 triangles over M1
    and no extra draw call; the blades' rebuild kept their sample count. Every switched lamp lit adds 4 calls and 48
    triangles (33 / 246,614, `m2i/hyper-chase-lit.png`). Inside the budget (40 / 260,000 on `high`, 36 / 135,000 on
    `phone`).
- **Other cars unchanged:**
  - The Corsa's side view re-rendered in this pass is pixel for pixel the M1 render: `tests/out/preview/m2i/corsa-side.png`
    against `hyper-corsa-high-side-r2.png` of 2026-10-19, 0 pixels differ, 31 calls / 219,861 triangles.
  - The new lamp code sits behind the hypercar's own lamp style (`'blade'`) and shape keys (`bar`, `blade`, `led`).
    The other cars' tail levels stay 1.6 → 5, and their bulkhead is back at M1's 0.866 m.
  - In the earlier M2 pass, the GT's seat view differed from the pre-M2 render in 178 pixels: the tachometer
    needle's idle flutter (`tests/out/preview/m2g/gt-seat-before-after-tach-x4.png`), with the same 62 calls and
    169,572 triangles.
- **Checks (2026-11-09, logs in `tests/out/m2o/`):** `npx tsc --noEmit` and `-p tsconfig.game.json` clean; `npm run
  build`; `node tests/dynamics.mjs` 1,742 passed, 0 failed; `npm test -- --only=render` **14/14** (992 s; the M2 check
  "eye -0.27,0.96,0.1, beam 0.71,0.49,-2.25; bar 0.5 → 6 and its haze; right signal lit 0.5 s into a lane change
  (0.54 m); turns at 2.59 and 2.69 m/s signal -1, 1; reverse lamps on in gear -1, no signal; left driving at 30.02
  m/s"), then `pause`, `reset`, the lost WebGL context and the presets all passing after it); `npm test --
  --only=boot,phone` **11/11**. Each ran on the shared machine with two or three other lanes' browsers (load 12 to 22
  on 4 cores). The render group's runs of 2026-10-21 (`tests/out/m2i-suite-render*.log`, `m2j-suite-render.log`)
  had failed after the M2 check, by frame timeouts in `pause`, `reset` and the context check, or a closed browser on
  that loaded machine; this run is the first green one with the check in it.
- **Seen, not M2's:**
  - At night the scripts' front three-quarter camera (not one of the game's cameras) shows a lit patch with a ragged
    top edge on the sound wall behind the car (`tests/out/m2o/hyper-night-front34.png`). It sits in the same place
    in the frame in `tests/out/m2h/hyper-night-front34-signal-left.png`, where the streetlights stand elsewhere, so it
    moves with the car or the camera, not with the road's lamps; the hypercar's beams point ahead and cast no
    shadows. Its cause was not traced.
  - Reverse has no speed limit in `Physics.ts` (another session's file): in gear −1 the brake drives the car
    backwards through `SPEC.reverse` (2.9) and the final drive up to the engine's redline, so with the Unleashed
    tune 4.5 s of held brake from a creep reached −36.9 m/s (83 mph) in the night shot script. Handed to that
    session: cap the drive force while `gear < 0` once −vx passes a reverse limit (about 8 m/s).
- **Not done:**
  - the optional tyre lettering
  - the pressure gauge's face (M5)
  - the rest of M1b (nose, bonnet, splitter, side scoop, plan, rear), which waits for the fidelity pass

## 2026-10-27 (05:30 UTC): the sky camera fixed on iPhone and desktop; a roomier phone HUD and seat view (branch `ui/phone-space`)

- **The owner:** "Sky view camera still doesn't show correctly on mobile view and I'm not too sure on desktop so let's fix
  that. Also we need more space on the phone when navigating as well as the pov driver, everything is too clunky." Their
  iPhone, through the OC Freeway shared link (the main link).
- **Built on the always-on session's claude/hud-pov** (597c495 seat view, 2258dfc HUD condense; stopped, never reviewed).
  The new commits are on `ui/phone-space`:
  - 1f28fc9: the sky camera has its own canvas inside the frame.
  - 4adcf42: the guidance is shown whole and with its lane; the seat view is framed below the notch.
  - 0ddee6e: no blank frame on a resize; a self-checked copy with a direct fallback.
- **The sky camera's causes**, all present in main link v9 (local/live-preview ef9f1b1):
  - three r160's setScissor/setViewport already multiply by the pixel ratio, and renderCorner multiplied again. So the
    picture landed at pr times its place and size: an empty frame at Medium on an iPhone (pr 1.5) and on desktop at Low
    (pr 0.75).
  - The square painted under the DOM frame poked past its rounded corners.
  - At Low it rendered at 1 px per CSS px (blocky at dpr 3).
  - The Minimal HUD slid the window away 4 s after every tap.
  - Now the view renders at the window's size times the device pixel ratio (capped at 2 on Low, 3 above) and is copied
    into a canvas inside the frame.
  - A self-check on the third copy compares 49 sample points with the WebGL buffer. If the copy is blank (a WebKit
    risk), it falls back for the session to drawing directly into the main canvas inside the frame's box, in CSS pixels.
    Forced with `?skyfallback=1` or `__game.setSkyFallback(true)`.
  - A ResizeObserver handles iOS's late layout; resizes that change nothing return early, so no cleared frame is ever
    shown.
- **Room on the phone:** one compact plate at the top holds the speed, the gear, the next manoeuvre with its distance and
  lane ("4.9 mi KEEP RIGHT"), the whole road sign and the ETA. Radio, phone and clock are a tap away. The road ahead is
  clear. The portrait seat view puts the horizon below the top safe area.
- **Judged:** an independent judge (Opus) said keep. Its two severity-2 notes, the resize flicker and the WebKit copy
  risk, were then fixed in a repair round.
- **Verified** (headless Chromium, SwiftShader, an iPhone UA at dsf 3 for 393x852 and 430x932, plain, with the safe-area
  insets forced, and inside an iframe like the claude.ai viewer; plus 852x393, 1280x720 and 1440x900):
  - tsc clean; render 15/15; phone 12/12. The phone group includes the sky picture checks, the copy self-check (49/49)
    and the forced fallback (0.68 levels from the copy against 71 for the road).
  - 42 after shots with no page errors.
  - Earlier on 4adcf42: boot 6/6, launch 11/11.
  - **Seat-view test changed:** the "seat view: horizon, cluster and windscreen clear" check now waits for the 0.5 s
    camera blend to finish. It had raced the frame rate on the repair build.
- **Not verified:**
  - **Real iPhone:** not tested on a real iPhone or in WebKit (none installed here). The self-check and fallback exist
    for that.
  - **Seat view:** in portrait the cockpit, windscreen, top band and touch controls take about 95% of the height. More
    road there needs a cockpit or touch-control redesign: an owner decision.
  - **Desktop seat view:** the destination card still overlaps the windscreen's right edge, as before.

## 2026-10-25 (23:35 UTC): the thumbs, wheels and physics in the main game (main link v9); paused by the owner

- **The main game.** The owner asked for this branch's graphics in the game itself. claude/hypercar is merged into
  local/live-preview, the main game's branch, as ef9f1b1. It was pushed as a fast-forward from the always-on session's
  8d5ba6c.
  - **Conflicts:** two only. In PlayerCar.ts the store's paint finish and the cockpit's pause flag are both kept; the
    progress log keeps both sides. Nothing outside top-speed-ultra/ changed.
  - **Verified on that build:** tsc and the build clean; boot 6/6, abilities 4/4, survival 8/8, race 6/6, render 15/15,
    launch 11/11.
  - **Published** to the main link as **version 9**. The live v8 matched the build of 8d5ba6c exactly (apart from the
    page wrapper), so nothing in it was lost. The store and the owner unlock are kept.
  - The always-on session (session_01NkQ41gebWX6mPbmCQZBc81) was told.
  - **Agreed with that session:** its unreviewed HUD and seat-view work lives on claude/hud-pov and reaches
    local/live-preview only once kept. Whoever lands last builds and publishes from the tip.
- **The weekly limit (2026-10-22 ~17:00 to 2026-10-25 22:00 UTC)** stopped the live integration before its judge. The
  hourly task was switched off while the session ran on overage. At 22:10 the owner said "Keep going", accepting the
  overage. The integration (fourth start), the Retro finish and overdrive round 3 (face/eyes) were resumed.
- **Paused by the owner at 23:32 UTC ("Okay take a pause").** All three were stopped before their judges.
  - **Live integration (integrate/live 48d4262, pushed).** At 48d4262 every core group had passed (boot,
    interchanges, survival, race, abilities, progression, render, phone, launch; 2026-10-22). The live group passed
    again in the fourth start. livephone was running; live/ npm test, the story test and the judge had not run.
  - **Retro (retro/port d21573d, pushed).** It is brought up to date with claude/hypercar. tsc and the build were clean,
    and the boot, render and phone groups passed in its verify step. The shots, defaults and perf checks and the judge
    had not finished.
  - **Face/eyes round 3 (fable/face b5ac6a2, pushed).** The round-3 fixes for the re-judge's defects are uncommitted
    in its worktree (.claude/worktrees/fable-face). A copy is saved at scratchpad/pause-2335/fable-face.patch, plus
    morphs.ts.
    - Done: the beard's side box ramps and the neck step; a leaf morphs.ts for the import cycle; the beard tufts
      taper; the brow guard.
    - Not done: the grey-beard speckle; the after shots; the judge.
  - Hair and body did not start.
- **Not yet:** claude/always-on is still unconnected; that waits on the integration landing.

## 2026-11-09: the Founder Edition's exclusives (hypercar M6, committed)

Branch `claude/hypercar-drive`, committed. The OC Hypercar is a procedural model built in code (no downloaded
asset). What only it has, as built (`PROJECT_OC_HYPERCAR.md` §8.2): numbered plaques on the driver's door sill cap and
the console reading **"FOUNDER EDITION · No. 0000 · TEST"** (the number comes from one function, `founderSerial()` in
`src/game/founder.ts`, which returns null until the store's entitlement exists; no number is made up on the device);
**Glacier Silver** paint and **Founder Ice** LEDs offered on no other car; an LED wake-up sweep (strips, blades, then the
red bar) when it is chosen in the garage and on the start line; a reveal stage at the top of its garage card (a
turntable in a dark showroom, the lights waking and a light sweeping over it, played once per device and then on
demand, still under reduced motion); and a Founder Edition badge on its run cards. No purchase flow; no "limited", no
countdown, no owner counts; the card shows only the founder window's date from `FOUNDER_UNTIL`.

**Verified** (headless Chromium, SwiftShader, a shared 4-core machine with other passes running; frame rates on real
hardware not measured):
- `npx tsc --noEmit` on `tsconfig.json` and `tsconfig.game.json`: clean. `npm run build`: 3,545 KB js, 69.8 KB css.
- Suite, final build: `--only=progression` **8/8** (new: "Founder Edition: the plaque reads …" and "the hypercar's
  garage card: the reveal stage plays once …": 65 stage frames to 6.2 s, last frame mean 41.6 with 1,218 ice-blue
  samples, reopened from the session's frame without building, chosen: lights 0.08 s into the wake, reduced motion
  still); `--only=render` **14/14** (new: "the Founder Edition's lights wake on the start line …": over 92 frames dark
  for 16, then 0.01 → 0.56 → 1.1, then steady; the GT's tail shader has no wake; reduced motion steady at once);
  `--only=phone` **9/9** in the combined run (new: "the Founder Edition card at 390 × 844 …": stage 318 × 179 px in a
  350 px card, no sideways scroll; `tests/out/phone-garage-founder.png`). That combined run (`progression,phone,render`)
  was 29/31: the radio check failed once with "audio suspended" (a 300 ms wait for the audio context under load; it
  passed on the rerun, untouched by M6) and my own reduced-motion check read the shared uniform a frame early (the
  check was fixed to wait a frame; it passed on the rerun).
- `node tests/dynamics.mjs`: 1,742 passed, 0 failed (no physics changed).
- Cost. The reveal stage's frame (renderer info of its own render, no shadow pass): **31 draw calls, 135,320
  triangles** with the High build of the car, **31 / 74,063** with the phone build; it renders only while it moves.
  Its build took 0.6 s (1440 × 900 run) to 2.0 s (phone run) on a quieter machine, 3.4-17 s while other passes ran.
  The cockpit's plaques: one more draw call (their material; the plinths merge into the carbon mesh) and 604 triangles;
  the hypercar's interior from the console camera: 47 calls, 155,363 triangles. No other car's materials or shaders
  change (the wake patch is applied to the OC brand only; the render check reads the GT's shader key).
- Images (read by eye): the garage card mid-reveal and settled at 1440 × 900 (`tests/out/founder/garage-1440-mid-r3.png`,
  `garage-1440-end-r3.png`) and 390 × 844 (`garage-390-mid-r3.png`, `garage-390-end-r3.png`); the plaques
  (`plaque-console-r2.png`, `plaque-sill-r1.png`, preview page at 960 × 540); the start-line wake from the front right
  on a race grid at night, front strips waking then the sills (`startline-a-r3.png` at 0.25 s, `startline-b-r3.png` at
  0.75 s, `startline-steady-r3.png`) and the game's chase camera with the START gate (`startline-chase-r3.png`; the
  front camera is a proof camera, the chase camera sees only the tail); the run card from a Free Drive in it
  (`runcard-r1.png`, 1080 × 1350, "No. 0000 · TEST · Unleashed"). Script: `tests/out/founder/proof.mjs`; the stage's
  preview page: `src/preview/test-reveal.ts`.

**Not done, honestly.** There is no paint picker, so "reserved" is held by the finishes list and `paintFor` and
checked by the suite. The stage's light sweep shows mostly as a glint drawn across the card (a moving reflection would
need its environment re-filtered every frame). The canvas copy into the card was only tried in Chromium. The car on
the stage still shows M1's dark lower nose (M1b queued).

## 2026-11-09: driving profiles in Settings: Arcade, Sport, Simulation (hypercar M4, committed)

Branch `claude/hypercar-drive`, committed. The OC Hypercar is a procedural model built in code (no downloaded asset). Settings → Driving → Handling now has three named
profiles at the points the dynamics model defines (`PROJECT_OC_DYNAMICS.md` §3.9): Arcade 0.15, Sport 0.5, Simulation
0.9. A button puts the slider on its point; the slider anywhere else reads Custom (no profile pressed, a lit Custom
line saying which two it sits between). One line each says what the point changes; ticks under the track mark the
points; the readout says "Arcade · 0.15". The slider value stays the only saved setting the physics reads, so saves and
the suite's hooks work as before. A new player starts in Arcade (the default was 0.35, which an older save keeps and
Settings shows as Custom). **No physics changed** (`Physics.ts` untouched): the profiles are the model's own values;
anything deeper is queued for a vehicle-dynamics session (`PROJECT_OC_HYPERCAR.md` §8.1, §9). Code: `settings.ts`
(`PROFILES`, `profileOf`, `customLine`, the saved value clamped to 0..1), `App.tsx` (`Handling`), `styles.css`; the
suite gains `SUITE_HANDLING`, the profile checks and the hypercar's race tune in the survival and race groups; the
autopilot (`Game.ts`, the suite's driver and the menu demo) lifts the throttle in a slide (below).

- **Settings, checked in the suite.** At 390 × 844 (phone group): Arcade, Sport and Simulation each set the slider,
  the game's settings, the physics and the saved settings to 0.15 / 0.5 / 0.9, with that button pressed and its line
  lit; one keyboard step left of Simulation reads "Custom · 0.85" with "Between Sport and Simulation: every assist
  scales smoothly with the slider."; no sideways scroll. At 1280 × 720 (race group): Settings names the profile the run
  drives at. Images: `tests/out/phone-settings-arcade.png`, `tests/out/phone-settings-custom.png`,
  `tests/out/settings-profiles-1280-arcade.png`, `-sport.png`, `-simulation.png`, and a fresh profile against a save at
  0.35 at both sizes in `tests/out/profiles/` (`settings-1280-fresh.png`, `settings-1280-saved035.png`,
  `settings-390-fresh.png`, `settings-390-saved035.png`; `tests/out/profiles/shoot.mjs`).
- **Measured per profile** (`node tests/dynamics.mjs`: 1,742 passed, 0 failed; every car and both of the hypercar's
  tunes through `tuneFor` in `tests/out/profiles/measure.mjs`, table in `PROJECT_OC_HYPERCAR.md` §8.1): e.g. the
  Corsa 0-60 3.09 / 3.71 / 4.71 s, 100-0 71.1 / 76.3 / 84.0 m, 1.04 / 1.15 / 1.12 g at 40 m/s in Arcade / Sport /
  Simulation; the Unleashed tune 2.20 / 2.38 / 2.77 s, 56.1 / 60.4 / 66.5 m, 1.44 / 1.50 / 1.45 g. No spin on the
  harness's straights with a lane change and a yaw shove: every earnable car and the race tune at 201 mph (worst
  0.58-1.34°), the Unleashed tune at 300 and 336 mph (worst 0.71-1.05°).
- **Found, not fixed (from M3):** the race tune is 0.6 mph over the Corsa's top speed in every profile (229.7 vs 229.1)
  and 0.01 g over at 80 m/s in Simulation. A race CdA of 0.81 fixes the top speed; the 80 m/s figure did not move with
  CdA, ClA or grip, so it needs the tune's owner (§8.1).
- **Suite** (`SUITE_HANDLING=<h> npm test -- --only=survival,race,phone`, the final build): Arcade 0.15 **24/24**,
  Sport 0.5 **24/24**, Simulation 0.9 **24/24**. In each: the GT and the hypercar's race tune build a Survival streak
  in the seeded heavy traffic (race tune: score 12,730 / 11,609 / 11,329, best streak 16.64 s; the run asserts the
  physics drove at the suite's value), and each wins the Irvine Sprint flat out on the autopilot (race tune P1 in
  2:05.2 / 3:03.2 / 2:25.4; the time depends on the traffic it meets, see below). New checks: Settings at 1280 × 720
  names the run's profile; the 390 × 844 check above.
- **Found by the proof, fixed in the test driver.** The first Simulation run failed the new hypercar Survival check:
  braking behind traffic, then 0.85 throttle out of it, the race tune's tail stepped out (4° of body slip at 38 m/s;
  the Simulation traction control only catches a spin) and the autopilot let it walk a lane into a box truck at
  25.5 s. A probe of the same drive on seven seeds (`tests/out/profiles/survival-probe.mjs`,
  `survival-probe-before.txt`): at 0.9 the race tune ended 3 of 7 drives, the Corsa 1 of 6, the GT 0 of 7; at 0.15 the
  race tune 0 of 6. The autopilot now lifts in a slide (throttle × 1 − 0.95·smoothstep(1.4°, 3.4°) of body slip):
  29 of 29 drives then ran the full 45 s with no contact, worst slip 3.3° (`survival-probe-after.json`); the Arcade
  drives were identical to before. In the Irvine Sprint (`tests/out/profiles/race-probe.mjs`, each run twice and
  repeating exactly) the lift never engaged in Arcade (worst slip 1.19° GT, 0.84° race tune) and in Sport only after
  a contact; in Simulation the cars reach 1.56-1.59° before any contact, so it eases them there. The suite's race
  times moved between builds (GT at 0.15: 2:11.1 before, 2:40.9 after) because its race checks carry the autopilot's
  lane over from the previous check and the traffic met differs; with the lane reset each probe run repeats to the
  tenth. For play: in Simulation the race tune steps out on the power more readily than the Corsa (13 % more torque at
  the wheels in each gear).
- **Also after the autopilot change, at the suite's default 0.35:** `npm test -- --only=abilities,interchanges` 28/28,
  every hypercar number as in the M5 entry (0-60 0.792 s with THRUST, a full tank 6.03 s, 334.32 → 340.6 mph, Ground
  Lock 1.54 → 2.04 g at 25 m/s). Not run this time: boot, progression, render, launch.
- **Not changed, for the other session:** `Physics.ts` (the profiles need nothing from it). If the Unleashed tune
  should corner harder in Arcade at 40 m/s (held at 1.81 g by Arcade's steering lock and the `rKin / (1 + 0.0009 v²)`
  yaw target, §6.3 of the plan), that is a change there.

## 2026-10-20: hypercar M5 committed (Cold Thrust, Ground Lock, Thrust Hop)

Milestone M5 is done and committed on `claude/hypercar-drive`. The OC Hypercar is still a procedural model built in
code, not a finished 3D asset. What was built: Cold Thrust (rear thrust from a tank), Ground Lock (fan suction) and
Thrust Hop (a planned hop over traffic), live only on the Unleashed tune in Free Drive. Code in
`src/game/vehicle/HyperAbility.ts`, `src/game/vehicle/ThrustJets.ts`, `src/game/traffic/limits.ts` and the files
listed in the entry below. Images: `tests/out/hyper-thrust-day.png`, `tests/out/hyper-thrust-hop-r2.png`.
Numbers (details below): 0-60 in 0.79 s with thrust and Ground Lock, peak 4.53 g, a full tank lasts 6.03 s, Ground
Lock 2.04 g at 25 m/s in Arcade. Suite after the play retune: `npm test -- --only=abilities,survival,race,phone,boot,progression`
53/53 passed; `node tests/dynamics.mjs` 1,742 passed, 0 failed. The play review's own test (moderate traffic, seeds
31-34, the I-5 North straight plus four roads not tuned on) found the hop granted and over the vehicle 40-76 % of the
time at +30 m/s from 50 m and 83-94 % over a sedan at +15 m/s from 15 m, about 230 hops with 0 contacts in the air.

## 2026-10-20: the OC Hypercar's own ability: Cold Thrust, Ground Lock and Thrust Hop (hypercar M5)

Branch `claude/hypercar-drive`. The car's own systems, separate from the driver's ability, on the dynamics model's
interfaces (`ext.fx`, `ext.fz`, `hop()`, `airborne`), no new physics. Live only on the Unleashed tune in Free Drive
(`CarDef.ability: 'hyper'`, cleared by the race tune); our own names only. Code: `src/game/vehicle/HyperAbility.ts`
(tank, thrust, fans, the hop's planner), `src/game/vehicle/ThrustJets.ts` (the jets), `Game.ts` (rules, the hop, the
clearance check), `input.ts` (Left Shift hold / double-tap, J, D-pad up, the touch button), `PlayerCar.ts` (nozzles, the
dash gauge, the landing), `AudioEngine.ts`, `HUD.tsx`, `styles.css`, `App.tsx` (controls help), `contact.ts` (the level
check measured from the road under a hopping car). Measured in the built game (owner mode, I-405 North, the
simulation stepped at 120 Hz through `window.__game`; `tests/out/hyper-thrust/thrust.mjs`, report in
`tests/out/hyper-thrust/report.json`):

- **Cold Thrust** (2.6 g × (1 − smoothstep(0, 80, v)) + 0.05 g, see the plan §6.2 for why 2.6): 0-60 in 0.79 s with
  THRUST and Ground Lock, 1.34 s fans only, 2.26 s tyres only; 0-100 1.47 s; peak 4.53 g. One tank from flat out:
  335 → 341 mph. A full tank lasts 6.03 s (the suite's check). From 50 %: 73.47 % after 3 s driving at 30 m/s in the
  proof script (`report.json`, `tank.cruise3From50` = 0.7347) and 73.94 % in the suite's check of the same 3 s drive
  started elsewhere on the straight (its 900 m window against the script's 2,600 m one; the 0.47-point gap between
  the two runs was not traced further; both are under the 75 % of a compressor running all 3 s, and the check allows
  75 ± 3 %); 66.67 % after 1 s braking and 50 % after 2 s stopped in both; at 8 % the valve stays shut (both).
- **Ground Lock** (0.8 × weight to 90 mph, 0.3 × by 200 mph): 1.54 → 2.04 g at 25 m/s and 1.49 → 1.81 g at 40 m/s in
  Arcade, 1.42 → 1.97 g at 40 m/s in Simulation; 4 s of it costs 11.7 % of the tank.
- **Thrust Hop**: at 60, 120 and 200 mph a 1.5 m apex, 1.1 s up, the same road and lane, at most 0.06° of slip, springs
  0.03 m, camera dip 0.087 m. Over a parked sedan (roof 1.44 m): apex 2.54-2.74 m by approach, no contact. Over a moving semi in heavy
  traffic (roof 4.1 m, closing at 40 m/s): peak 5.2-6.35 m over the seeds tried, 0.61-0.85 m over its roof at the
  lowest point over the trailer, no contact, the same road.
  Refused under an overpass ("No hop: overpass ahead"), before a sign gantry and under 40 % of tank, with no gas spent.
  **Bug found and fixed:** the hop's scan compared each vehicle's height with the road under the car, so on a grade it
  dropped vehicles 100 m ahead and the car landed on them (2 and then 3 of 6 seeded semi hops in a debug run); it now reads the level against the
  road's own height where the vehicle is, and plans for the traffic braking or speeding up while the car is up.
- **Off where it should be**: no button, no force and no hop in a race, the time trial and Speed Survival (the race
  tune, chip "Race tune"), through the countdown, and while paused.
- **Jets**: 3 draw calls and 384 triangles while gas flows (one instanced sprite call, 48 sprites on High and 24 on the
  phone build, plus two nozzle cones), none otherwise; no allocation per frame.
- **Frames** (960 × 540 High, read by eye): `tests/out/hyper-thrust-day.png` and `-night.png` (the jets in chase view),
  `-hop.png` (over a parked sedan), `-semi.png` (over a semi in heavy traffic), `-refused.png` (the toast under an
  overpass), `-cockpit.png` and `-dash.png` (the pressure gauge on the binnacle's left display), `-phone.png` (390 × 844:
  THRUST beside the driver's ability, the tank panel, the Unleashed chip).
- **Suite and harness** (*superseded* by the 37/37 re-verifications below and the repaired build's 40/40 run at the end
  of this entry): `npm test -- --only=abilities,survival,race,phone` on the first build: abilities 14/14 (ten
  new hypercar checks), survival 7/7, phone 6/6 (the THRUST hold and double-tap at 390 × 844), race 6/6. The race
  group's existing "Too far behind" check timed out at its 10 s wait in two full runs with the machine at a load of
  about 20 and passed when the group ran alone (9.8 s). `node tests/dynamics.mjs`: 1,742 passed, 0 failed. `tsc` clean
  on both configs; `npm run build` clean.
- **Re-verified 2026-10-21** on an unchanged tree, after a machine restart (load 35-50 from other passes): `tsc
  --noEmit` and `npm run build` clean; `node tests/dynamics.mjs` 1,742 passed, 0 failed; `npm test --
  --only=abilities,survival,race,phone` **37/37 passed** in 48 min 44 s (survival 7, race 6 with "Too far behind" in
  30.9 s on the longer wait, abilities 18 with 14 hypercar checks, phone 6 with the THRUST button check). The suite's
  numbers: 0-60 2.225 s on the tyres, 1.333 s with Ground Lock, 0.792 s with THRUST on Left Shift, peak 4.55 g; a full
  tank 6.03 s; top speed 334.3 → 340.6 mph; Ground Lock 1.54 → 2.04 g at 25 m/s, 1.49 → 1.81 (Arcade) and 1.42 → 1.97
  g (Simulation) at 40 m/s; hops at 60/120/200 mph landed at 60/118/196 mph with at most 0.06° of slip; parked sedan
  apex 2.74 m; semi (seed 18, 261 cars) peak 6 m, 0.85 m over the roof, 0 contacts; a forced arc under the roof made
  contact at 3.09 m, one at roof + 0.5 m did not. `tests/out/hyper-thrust/thrust.mjs` re-run (51 min 53 s): the same
  telemetry to the digit, and every frame above shot again and read by eye. Jets' cost by day 907 vs 904 draw calls,
  1,879,950 vs 1,879,566 triangles (+3 calls, +384 triangles); at night 941 vs 938, 1,916,410 vs 1,916,026.
- **Re-verified again 2026-10-21 (later)** on the same unchanged tree, after another machine restart (load 1 at the
  start, about 42 once the other passes resumed): `tsc --noEmit` on both configs and `npm run build` clean; `node
  tests/dynamics.mjs` 1,742 passed, 0 failed; `tests/out/hyper-thrust/thrust.mjs` (44 min 16 s) gave the same telemetry
  as the run above in every section of `report.json` (accel, top, tank, landings, semi, refused, lock), and every frame
  was shot again and read by eye; jets' cost by day 900 vs 897 draw calls, 1,908,484 vs 1,908,100 triangles, at night
  935 vs 932, 1,955,910 vs 1,955,526 (+3 calls, +384 triangles both times). `npm test --
  --only=abilities,survival,race,phone` **37/37 passed** in 50 min 54 s (survival 7, race 6 with "Too far behind" in
  42.2 s, abilities 18, phone 6).
- **The repaired build re-verified 2026-11-09** (the review repairs of 2026-10-21 in the plan's §6.4: Focus Time held
  through a hop, the plain hop short of a vehicle too far to clear, the gauge's redraw cap and "charging" label, THRUST
  let go on a pad unplug). An earlier attempt on 2026-11-02 lost its phone group to a browser crash, and the proof
  script's last two runs had stopped part-way, so the tree on disk was checked again from scratch (load 5-16 from other
  passes): `tsc --noEmit` on both configs and `npm run build` clean; `node tests/dynamics.mjs` **1,742 passed, 0
  failed**. `npm test -- --only=abilities,survival,race,phone` **40/40 passed** in 8 min 56 s (survival 7 in 56 s, race 6
  in 61 s with "Too far behind" in 5.8 s, abilities 20 in 197 s with 16 hypercar checks, phone 7 in 213 s with the
  THRUST button at 390 × 844 and the sideways HUD at 844 × 390). Its numbers matched the runs above: 0-60 2.225 s on the
  tyres, 1.333 s with Ground Lock, 0.792 s with THRUST; a full tank 6.03 s; 334.32 → 340.6 mph; Ground Lock 1.54 → 2.04 g at 25
  m/s; semi (seed 18) peak 6 m, 0.85 m over the roof, 0 contacts; Focus Time ending in the air: 0.7× through the
  air, 0.72 m over the trailer, 0 contacts; the plain hop at 10 m/s came down 19.2 m short of the parked sedan; the
  phone button's hold took the tank 100 → 79.19 %. `tests/out/hyper-thrust/thrust.mjs`, run one part at a time
  (`--only=tele`, `frames`, `more`, `phone,land`): the telemetry (`report.json`) matched the 2026-10-21 run in every
  section (0-60 0.79 / 1.34 / 2.26 s, 0-100 1.47 s, peak 4.53 g; 335.1 → 341.3 mph; landings at 60/120/200 mph:
  1.5 m apex, 1.1 s up, at most 0.06° of slip; semi seed 25 peak 5.3 m, 0.7 m over the roof, 0 contacts; refused under
  Seal Beach Boulevard, before the Laguna Beach / CA 133 South gantry and at 30 %; 0 page errors). Every frame was
  shot again and read by eye: `hyper-thrust-day.png`, `-night.png` (jets white by day, ice-blue at night, the THRUST
  panel and the Unleashed chip), `-refused.png` (the toast under the overpass), `-hop.png` (2.44 m up over the parked
  sedan, peak 2.54 m), `-semi.png` (seed 13, 6.14 m up over the trailer, peak 6.35 m, 0 contacts), `-cockpit.png` (the
  gauge reads 405 bar at 58 %), `-dash.png` (325 bar at 46 %), `-phone.png` (390 × 844, THRUST held, the panel at 92 %) and
  `-landscape.png` (844 × 390, no overlaps). Jets' cost by day 904 vs 901 draw calls, 1,914,660 vs 1,914,276 triangles;
  at night 935 vs 932, 1,960,654 vs 1,960,270 (+3 calls, +384 triangles, 48 sprites on High).
- **Thrust Hop retuned for play, 2026-11-09** (the play review: the hop was refused at 5 of 6 deliberate double-taps
  in moderate traffic). The plan's §6.4 has the details and the full before/after table. Code:
  - `HyperAbility.ts`: a vehicle past the touchdown vetoes the hop only when the car would come down within one car
    length and 2 m of its tail plus 0.5 s at the closing speed (`HOP.landGap`, was 1.5 s; within 1.5 s the toast adds
    "· traffic on landing"). Each vehicle is planned braking at 3.2 m/s² (`IDM.comfort`, or harder when it already is;
    was 10 m/s²) and speeding up at its own driver's rate only back to its own cruising speed (was 2.24 m/s² for the
    whole hop). A plain hop short of a vehicle keeps 1.5 s of room before it. "Too close to clear" when only further
    back would clear. The vehicle behind a refusal is logged in `hopLog.block`.
  - `Game.ts`: passes each vehicle's cruising speed, bold flag and acceleration to the planner, and scans out to the
    warning's room. `setHyper` is public (the suite's and the proof script's hook).
- **Measured** with `tests/out/hyper-thrust/avail.mjs`, the judge's set-up run on a copy of the old build and on the
  new one (seeds 7-12, the same vehicles; results in `tests/out/hyper-thrust/avail-before-*.json` and
  `avail-after-*.json`):
  - **The judge's stretch** (I-405 North from 34.5 km, moderate), granted:
    - +30 m/s from 50 m: 15 % → 28 % (12 → 18 % over the vehicle).
    - +40 m/s: 21 → 46 %.
    - +30 m/s with nothing between on any road: 17 → 40 %.
    - Heavy: 4 → 22 % at +30 m/s, 6 → 31 % at +40 m/s.
    - Casual double-taps at 55 / 80 m/s: 22 / 8 % → 32 / 10 %.
  - **The judge's own figures before:** 15-18 % at +30 / +40 m/s, 6-9 % in heavy traffic, 0 % over anything at
    +15 m/s, and 1 and 5 of 25 casual double-taps at 55 and 80 m/s.
  - **That stretch carries CA-22 West on I-405 North's centreline** (34.5-37.15 km in the road network). Its traffic
    drives half a lane off every I-405 lane and overlaps the car's lane by about 9 cm. Cruising there on the autopilot
    at 55 m/s with no hop, the car was in contact with CA-22 West vehicles for 3,791 steps (12 hits) in 40 s. They were
    14 of the 17 "Too close to clear" refusals at +30 m/s and both contacts in the air at +40 m/s. This is a map-data
    issue outside M5, reported and not fixed here.
  - **A straight with no other freeway on its pavement** (I-5 North from 47 km), granted:
    - +30 m/s: 31 → 54 % (30 → 53 % over the vehicle; 19 of 78 under an overpass, refused by design).
    - +40 m/s: 41 → 68 %.
    - Heavy: 22 → 28 % at +30 m/s, 25 → 45 % at +40 m/s.
    - A sedan at +15 m/s from 10 / 15 / 20 m off its tail: 81 / 70 / 0 % → 85 / 79 / 76 % over it.
    - From 50 m: 66 bunny hops short of it (0 over) → 62 of 63 "Get closer to clear", no gas spent. From 50 m at
      +15 m/s no 2.5 s hop can pass a sedan; the car needs about 4 s.
    - Casual double-taps at 55 / 80 m/s: 80 / 76 % → 86 / 74 %.
  - **Contacts after the retune** on I-5 North: none in the air. None within 1.5 s of touchdown at +30 m/s (42 hops)
    or at +15 m/s from 10 and 15 m. From 20 m, one landing rubbed a vehicle for 9 steps on the ground (no hit). At
    +40 m/s the autopilot, which only brakes, hit the next vehicle after 3 of 54 landings into traffic (4 hits): the
    landing is the driver's.
- **Suite after the retune** (load 12-18 from other passes): `npm test -- --only=abilities,survival,race,phone,boot,progression`
  **53/53 passed** in 11 min 15 s (boot 6, survival 7, race 6, abilities 21, progression 6, phone 7).
  - The new check "Thrust Hop in natural traffic" on I-5 North from 47 km, moderate, untouched seeded traffic, nothing
    from any road between, no structure over the track:
    - +30 m/s from 50 m: 42 of 52 over the vehicle (81 %), 43 granted, 14 with traffic on landing, at least 0.44 m
      over the roof, 0 contacts, the same road.
    - A sedan at +15 m/s from 15 m: 25 of 27 over it (93 %).
    - Cruising at 55 m/s: 36 of 40 double-taps granted (90 %), 0 contacts in the air.
  - The existing hop proofs, re-run:
    - Landings at 60 / 120 / 200 mph: 1.5 m apex, 1.1 s up, at most 0.06° of slip.
    - The semi in heavy traffic: seed 11 after 1 semi refused (the first planner refused 8 of the first 9), peak 5.9 m,
      0.66 m over the trailer, 0 contacts.
    - Focus Time held to touchdown: 0.5 m over the trailer, 0 contacts.
    - THRUST held through the air: 0 N up, the valve open again on landing.
    - The plain hop at a parked sedan from 35 m at 10 m/s: down 22.1 m short of it.
- **Other checks:** `tsc --noEmit` on both configs and `npm run build` clean; `node tests/dynamics.mjs` 1,742 passed,
  0 failed.
- **No headless coverage of the planner.** The dynamics harness never calls `planHop` or `hop()`, so the hop is proven
  only in the browser: the suite and the proof script.
- **Proof script's telemetry re-run** (`thrust.mjs --only=tele`; `report.json`):
  - The same to the digit as before in accel, top speed, tank, landings and Ground Lock.
  - The parked-sedan hop: peak 2.54 m (2.74 m before), 0 collisions.
  - The semi in heavy traffic on the I-405 North straight (cars between removed): seed 16 after 4 refusals (seed 25
    after 8 before), all four "No room to land" with the next vehicle 23-46 m past the semi. Peak 5.05 m, 0.48 m over
    the trailer, 0 contacts, the same road; its toast "Thrust Hop · over the big rig · traffic on landing".
- **Frames re-shot** (`thrust.mjs --only=hop,semi --suffix=-r2`, 960 × 540 High, read by eye):
  - `tests/out/hyper-thrust-hop-r2.png`: 2.25 m up over the parked sedan, peak 2.39 m, the HUD reading "Airborne".
  - `-semi-r2.png`: seed 11, the first semi tried, 5.18 m up over the trailer, peak 5.2 m, 0.91 m clear so far,
    0 contacts.
- **Not done, honestly**: Arcade's 40 m/s figure is held at 1.81 g by Arcade's steering lock, not the fans (M4's
  grip-scaled stability control). The gauge sits on the Corsa-derived binnacle and the driver's left hand covers its
  left third until M2 gives the hypercar its own interior. The seat view still shows the canopy bar across the
  windscreen (the M1/M3 seat drop). The hop is the scripted road-bound arc (no pitch or roll in the air).

## 2026-11-09: Stoppage Time S3b kept after review and committed

Both reviewers kept the repaired S3b (interactions, relationships and conversations). The details of the build, the
measured numbers against the plan's budgets and each check's result are in the entry below this one; the checks file
`tests/out/sportsbar/sportsbar-s3b-checks.json` (13:48 UTC) records 55 results passing. Its one `"ok": false` is an
expected negative inside the Buy a round check (a second round isn't offered within 10 sim minutes). The play
reviewer checked the busy night again on the 13:29 build without help: at Low, 844x390, on the default Saturday 21:00
night with no week or seed pinned, after 5, 20 and about 35 sim minutes pool-2 and darts-3 stayed free with Play in
their menus, guests held the other four spots, every busy spot offered Watch and "you're next", and Challenge was
offered to 17 to 20 guests at each sample. Through the real radial, Challenge was turned down twice with a spoken line
(acceptance about 0.55), then accepted by Vanessa (0.86), which started darts on darts-3 with no guest moved. Talk
opened the reply chips at once and three warm replies took rapport from 0 to 11.68. Images:
`tests/out/sportsbar/s3b-*-1280x720-r2.png` and `s3b-*-1280x720-final.png`. Budget numbers: the mean decision batch
was 0.306 to 0.328 ms against the 0.4 ms desktop target, and every pose's frame stayed inside its row
(`s3b-r2-budgets-shots.log`). No phone was run. Open items carried to S4: O37 (friendship climbs fast) and O38
(Ultra's fillers, listeners' facing).

## 2026-11-09: Stoppage Time S3b repaired after review

Both reviews rejected S3b's first build: on the default Saturday 21:00 night guests took every game spot, so you
couldn't start a game or Challenge anyone through the real menus (S2b's controls test only passed because its hooks
cleared guests off the spot); guests' darts and shuffleboard were statistical even on screen; you couldn't Join a group
from the menu; and a memory line named a goal that never happened. This repair keeps the rest of S3b. Every number
below was read from runs on this machine (headless Chromium with SwiftShader, one Playwright page at a time; load about
8 with other workflows' browsers). The final build is `dist/sportsbar/sportsbar.html` built at 13:29 UTC (1,765,754
bytes, 590,024 gzipped); every run named "final" below used it. No phone was run.

- **What changed** (the plan's S3b "As built" notes and open items O35 to O38 have the detail):
  - **Spots kept for you.** Guests never take the last free pool table or the last free dartboard (a game of that kind
    you're playing counts as yours); a spot you choose is held while you walk to it (90 sim s or until your game
    begins). `npcgames.ts`.
  - **A busy spot always answers a tap.** Its menu has Watch (pool, darts or shuffleboard: a watcher's place by it, or
    clear floor 1.6 to 4.5 m off when those are taken), a toast says "you're next", nobody else starts there when the
    match ends (2 sim minutes), and a toast says it's free. `life.ts`, `npcgames.ts`.
  - **Guests' darts and shuffleboard on the physics** while on screen or within 15 m (`DartsSpot` and `ShuffleSpot` in
    `games.ts`: the house's throw model and the plan's NPC slide, each side's competitiveness; darts and pucks drawn as
    item instances in cream and blue), statistical otherwise, changing mode only between turns or frames. O35 closed.
  - **Join from your menu** (after Talk) for a person in a group of 2 to 5, no acceptance roll: you walk to the gap and
    join; the members present turn to you and one says hello. Your walk up now follows a person who moved (twice).
  - **Lines.** Toast and cheer lines about a goal (and S3a's "goal of the season") are picked only within 60 s of one;
    a late winner's only when that goal came in the last fifth of its match. A round or toast remembers the team that
    had just scored, and the memory line names it only then ("You're the one who bought that round. Respect."
    otherwise). 145 lines.
  - **Smaller fixes.** Introduce refuses the target as the second person (even forced) and `rel(id, id)` is refused;
    the pairs never store a person with themselves. A Talk accepted toward a group that filled during the walk ends
    there (logged as full), and nobody is left in a 'group' action outside a group. "Pool with <name> · you break" with
    a guest; "the house player" only with the house.
  - **Allocations in the decisions.** Pairs are looked up by id both ways round (no key string), the person adverts'
    log is built only when a check asks (`logAdverts`), heads go into one scratch vector, the matches are stepped
    without a copy, and a group's anchor has no closure.
  - **Hooks.** `playHere` no longer moves guests: on a busy spot it says busy and makes you next; `stageGames` stages
    only free spots. New: `spots()`, `closeRadial()`, `menuFor(id)`, `logAdverts(on)`; `games()` names your opponent.
- **`npx tsc --noEmit` passes.** `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are unchanged.
- **Unit tests** (`node tests/sportsbar-social.mjs`): 36 of 36, the 31 before and five new: a remembered round with no
  goal in it never names a team over 400 seeds, and with the Undertow in its memory reads "...when the Bluffside
  Undertow scored"; the 8 moment-tagged lines never picked without a goal, the late ones only with a late goal; no
  self-pair from `apply` or `meet`; pairs found either way round and gone from both sides when a person is forgotten; a
  saved self-pair skipped on load.
- **The busy night, through the real menus** (`tests/sportsbar-s3b.mjs --only=busy`, Low 844 x 390, Saturday 21:00,
  week 43, `seed(1)`; final run `s3b-r2-final-low.log`):
  - After 5 sim minutes and again after 15: pool-1, darts-1, darts-2 and the shuffleboard in guests' matches (4
    matches), pool-2 and darts-3 free and kept for you; their menus offer Play pool and Play darts; Challenge offered to
    12 of the 12 guests checked.
  - A click on the radial's Play started your game on pool-2 (after the walk, 18 steps of 0.03 sim minutes) and on
    darts-3 (4 steps), with no guest moved off a spot.
  - Each busy spot's menu (pool-1, darts-1, darts-2, the shuffleboard) had Watch and the toast "Guests are playing ...
    here · you're next"; Watch from the menu queued you; the shuffleboard's match ended after 1 sim minute, "freed for
    you" was logged, a sim minute later nobody else had started there and its menu offered Play shuffleboard.
  - Join from Ryan's menu (Talk, Join, Challenge): you walked over and were in his group of 6 (his own when you
    clicked); Say goodbye took you out.
  - Introduce of a guest to themselves (forced) and `rel(33, 33)` refused; pairs 72 before and after.
- **The rest of S3b's page checks on the final build:** smoke, adverts, talk, interactions, persist, games and busy, 28
  of 28 (`s3b-r2-final-low.log`):
  - Adverts: 1,402 decisions, at most 8 people and 47 adverts (21 objects, 31 people's); 3,387 person adverts, every
    expected delta and needs term matching the test's working; 35 accepted Talks and Joins all leaving both in one
    group (none toward a full group in this run); no guest in a 'group' action outside a group.
  - Talk: 144 group samples, never two speakers; listeners faced the speaker in 158 of 172 (92%). The build before the
    last two fixes measured 190 of 259 (73%) in the same check; the review's run had 76%. Logged in O38 for S4.
  - Interactions: all 11 by the table's numbers as before; the Challenge now ran with no guests' match stopped first
    (free for you then: pool-2 and darts-3), darts on darts-3 against Vanessa. The Introduce check holds the loop while
    it reads the numbers (a real frame between reads had faded quiet rapport by 0.003, over the tolerance, in one run).
  - Guests' games: pool-1 on the physics (12 shots in 2 sim minutes, the largest energy rise 0) and pool-2 off screen
    (6 statistical turns, 14 balls laid out on the way back) as before; darts-2 with you 2.5 m behind the oche on the
    board's physics (Ryan v Ray: "1, 300 left; 20, 280 left; 1, 279 left; 1, 300 left"; the darts drawn); the
    shuffleboard on the bed's physics (Melissa v Tran: six slides, five in zone 3, one in the gutter; up to 4 guests'
    pucks on the bed, 4 discs drawn); off screen both went statistical (darts-2 9 turns, the shuffleboard 3 frames).
    Over 20 sim minutes 42 matches started and 28 ended (a darts match on the physics is quicker than a statistical
    one: about a minute; a guests' turn there is paced at 2 s to line up, 1.8 s between darts and 5 s to pull them).
- **Budgets on the final build** (S3b's run: 21 poses, Low, HD and Ultra on one page after a 30 sim-minute
  fast-forward, the caps 36, 70 and 100 reached, every item at its cap, 3 to 5 guests' matches at every pose;
  `s3b-r2-budgets-shots.log`), all inside their rows:
  - Low (pass, frame): `door` 108/172.8k, 108/168.6k; `tv-east` 115/172.3k; `stall` 119/208.0k; `patio` 85/132.4k;
    `overhead` 111/169.2k; portrait `door` 105/169.8k, `overhead` 110/167.2k.
  - HD (pass, frame, sun): `door` 145/363.2k, 198/479.5k, 41/135.0k; `tv-east` 153/362.2k, 205/480.7k; `stall`
    135/338.0k, 221/602.8k, 74/283.8k; `patio` 109/218.7k, 188/479.1k; `overhead` 191/511.2k, 275/771.7k, 72/279.1k;
    portrait `door` 140/357.5k, 193/474.3k; portrait `overhead` 191/518.4k, 274/767.3k.
  - Ultra (pass, frame, sun, pool spots): `door` 189/694.6k, 577/1,877.1k, 90/430.9k, 57/50.8k and 56/38.3k;
    `tv-east` 248/967.9k, 665/2,307.9k; `stall` 185/854.8k, 454/2,287.1k, 92/613.0k (pool spots frozen); `patio`
    163/723.5k, 407/2,010.8k; `overhead` 242/1,004.1k, 677/2,637.0k, 93/611.2k, 52/13.2k and 53/38.3k; portrait
    `door` 183/683.4k, 562/1,846.9k; portrait `overhead` 247/1,003.8k, 696/2,670.1k.
  - No NPC at LOD 0 and no casting mesh other than a `lod1` at any pose. A batch of up to 6 decisions: the mean of the
    last 400, 0.306 to 0.308 ms at Low's poses and 0.328 ms at HD's and Ultra's (the first S3b build's Low run: 0.46
    ms; the desktop target 0.4 ms).
- **Screenshots on the final build** (HD, 1280 x 720; each looked at; `s3b-r2-shots-2.log`):
  `tests/out/sportsbar/s3b-conversation-radial-1280x720-r2.png` (you in a group of three; the menu on Ramon: Talk,
  Joke, Buy a round · 16 tokens, Challenge · darts, Say goodbye and the "i"; Marisol's line and your two reply chips),
  `s3b-card-1280x720-r2.png` (Marisol: Acquaintance, Regular, the friendship bar, "You got talking with Marisol",
  "Everyone here is simulated"), `s3b-round-1280x720-r2.png` ("Round for 4 · 16 house tokens (no cash value) · on its
  way"), `s3b-toast-1280x720-r2.png` (no goal just in, so a plain toast line: "To good company!"; you holding a tamarindo
  agua fresca), `s3b-npc-pool-overhead-1280x720-r2.png`
  (Marisol and Ramon's match on table 1 from overhead), `s3b-npc-darts-1280x720-r2.png` (dartboard 2 close, two
  guests' darts in it by the 20 and the 1) and `s3b-npc-shuffle-1280x720-r2.png` (the bed's scoring end, two cream and
  one blue guests' pucks by the zone lines). The first darts and shuffleboard frames of this run were framed too far
  (the board behind the thrower's head; the pucks too small) and were re-shot closer.
- **The earlier phases' checks on the final build** (run after it, 13:48 to 14:11 UTC):
  - S3a's checks, staff, reactions, clock, fillers, spares and switch groups: 30 of 30 (`s3b-r2-regress-s3a.log`).
    Fillers at Saturday 21:00: Low live 31 + held 9 + fillers 64 = 104, HD 60 + 2 + 59 = 121, Ultra 90 + 0 + 22 = 112,
    each with every free eligible slot filled (the target 130; O38).
  - S2b's checks 14 of 14 and controls 7 of 7, with no guest moved off a spot (`s3b-r2-regress-s2b.log`): `playHere`
    now says busy on a spot guests are using and makes you next, and the test runs the sim on a minute at a time until
    their match ends. It waited twice: the shuffleboard 3 sim minutes and darts-1 2. The controls group needed no wait.
    `stageGames` staged only free spots for the pieces check.
  - S2a's checks 22 of 22 and save 2 of 2 (`s3b-r2-regress-s2a-2.log`). The first run failed the table-service check
    (`s3b-r2-regress-s2a.log`): every stool at high-top 2 was held or sat on, so the page refused the order ("no free
    place right now"); the check now takes the first high-top with a stool free for you (high-top 1 here).
  - Node: `tests/sportsbar-crowd.mjs`, `tests/sportsbar-sim.mjs` and S2b's `tests/sportsbar-games.mjs` (15) all pass.
- **Left open:** whether four guests' matches on a Saturday read as too many is the owner's call in play (O36); quick
  friendship from repeated Jokes (O37) and Ultra's fillers and the listeners' facing (O38), both for S4; the murmur (no
  audio on either page).
- **QA review of the repair (14:16 to 14:18 UTC, the 13:29 build; two short headless runs at Low, 844 x 390, the
  default Saturday 21:00 with no week or seed pinned):** after 5, 20 and about 35 sim minutes, pool-2 and darts-3 were
  free and offered Play; pool-1, darts-1, darts-2 and the shuffleboard had guests (four matches, some darts solo); every
  busy spot's menu offered Watch with the toast "Guests are playing … here · you're next". Challenge was offered to 17
  to 20 of 17 to 20 guests checked. Through the real radial, Challenge was turned down twice with a spoken line (p 0.55)
  and accepted once (Vanessa, p 0.86): your darts game began on darts-3 against her ("Darts with Vanessa: 301, straight
  out · you throw first"). Two of four walk-ups failed on the way ("Couldn't reach Eli", a seated guest; "A stool is in
  the way. Stopped here."). A Talk through the radial opened the reply chips at once; three warm replies took rapport
  0 to 11.68 and wrapped at 3. A round for a party of one plus you cost 8 tokens (53 to 45) with the "no cash value"
  toast. Listeners faced the speaker in 29 of 41 samples (71%; floor 70%), 0 groups with two speakers. No console
  errors. `npx tsc --noEmit` passes; `tests/sportsbar-social.mjs` 36 of 36.

## 2026-11-09: Stoppage Time S3b built: interactions, relationships and conversations (uncommitted)

S3b of `PROJECT_OC_SPORTS_BAR.md` is built on `claude/sports-bar` and not committed. Every number below was read from
runs on this machine (headless Chromium with SwiftShader, one Playwright page at a time; the machine's load was 5 to
23 with other workflows' browsers running). No phone was run.

- **What's new.** People advertise (the 11 interactions, the acceptance formula, the expected deltas, the candidate
  rule), the beats for guests and for you (your radial menu for a person with "More…" and the "i", Introduce and Buy a
  round among them; guests' own rounds), talking groups of 2 to 6 across parties, relationships and memory with the
  regulars' and your friendships kept on the device, people's cards and People here (pause menu), 141 lines, guests'
  games (invites; pool on the table's physics on screen and statistical off it), and the hooks `rel(id?)` and
  `interact(targetId, kind)`. Files: `src/onfoot/engine/sim/relations.ts`, `interactions.ts` (new), `groups.ts`,
  `lines.ts`, `autonomy.ts`, `tokens.ts` (changed); `src/onfoot/venues/sportsbar/social.ts`, `npcgames.ts` (new),
  `crowd.ts`, `life.ts`, `games.ts`, `hud.ts`, `main.ts` (one hook, `overheadAt`), `src/onfoot/sportsbar.html`; tests
  `tests/sportsbar-social.mjs` and `tests/sportsbar-s3b.mjs` (new). `lot57/`, `people/`, `src/onfoot/main.ts` and
  `src/onfoot/index.html` are unchanged. The as-built choices are under S3b in the plan.
- **`npx tsc --noEmit` passes;** the page builds with `npx vite build --config src/onfoot/vite.sportsbar.config.ts`
  (`dist/sportsbar/sportsbar.html`, 1,750 kB, 585 kB gzipped).
- **Relationship maths, unit tests** (`node tests/sportsbar-social.mjs`, Node, against hand-worked numbers): 31 of 31.
  Rapport and friendship updates (+6 from 0: 6 and 2.1; then +9: 14.64 and 5.2059; then -6 with k 0.15), the bounds,
  rapport's fade (none in the first 5 quiet minutes, then 1.5 a minute to 0 and not past it), friendship's fade (0.5 a
  device day; one that reached 45 never under 20), the ring of 8, highlights (the first meeting and the biggest two),
  the level thresholds (0, 19, 20, 44, 45, 74, 75, -1, -29, -30) and Stranger, "Getting along" at 30, the 64-a-person
  cap, persistence through JSON (friendship, memory and highlights kept, rapport back to 0, walk-ins not kept); the
  acceptance formula (0.75 for strangers; 0.97 and 0.05 at the clamps), the memory term, the context terms, the plan's
  expected-delta examples (Talk at p 0.8: social 10; Joke at p 0.7: fun 4.2, social 5.6), a Challenge's game deltas,
  Introduce's start, a Talk advert scored by hand term by term (85.3464, the urgent +30 included), Joke's affinity by
  playful, Excited +15 and the goal's +30 on Cheer together, groups of at most 6, one speaker at a time, the 141 lines
  (S3a's 30 and 111 more; every interaction's kind; 10 remembering, 4 by your state; none offers a bet or says LIVE).
  S3a's `tests/sportsbar-crowd.mjs` and `tests/sportsbar-sim.mjs` still pass (the worked "Urgent needs" arithmetic and
  the blocklist).
- **Page checks** (`node tests/sportsbar-s3b.mjs`; Low 844 x 390 at Saturday 21:00, week 43, `seed(1)` unless named),
  all passed on the final runs (`tests/out/sportsbar/sportsbar-s3b-checks.json`; logs `tests/out/sportsbar/logs/s3b-*.log`):
  - **People advertise.** Over a 20 sim-minute fast-forward, 1,048 decisions: at most 8 people and 43 adverts in any
    (21 objects, 26 people's; the caps 8, 89, 41 and 48), 1,047 with people in them, 165 chose an interaction. The last
    300 decisions' 2,748 person adverts (challenge, talk, joke, team, goodbye, introduce, high-five): every expected
    delta and needs term equals the test's own working from the logged p and the plan's table. 26 accepted Talks and
    Joins (groups of 2, 3 and 4), every one leaving both in one group. Guests' own interactions in the run: 182, of 10
    kinds (challenge, round, joke, talk, goodbye, cheer, high-five, toast, introduce, team).
  - **Conversations** (rendered frames at `door`, `tv-east` and `overhead`, 36 frames): 144 group samples, never two
    speakers, nobody in two groups; listeners faced the speaker in 170 of 174 (98%), all bodies by the head (inside,
    everyone built is a mesh, so no card was a listener). On the final build (a visitor now stands in the circle
    nearest the person they came to, rather than nearest where they came from): 151 of 199 (76%).
  - **Each interaction end to end through `interact()`** (forced accepted or not; rapport and friendship by the
    plan's updates, both people's needs by the table, the memory, the caption and the beat in the log): Talk accepted
    (0 to 6; you in their group; the reply chips: warm 6 to 7.92, a quip to a guest not playful 7.92 to 6.0256) and not
    (0 to -3); Joke (6.0256 to 14.6641), Cheer together within 8 s of a goal (to 19.1753), High-five after a goal for a
    team you share (to 26.1526), Toast holding drinks (0 to 7); Buy a round for a group of 3 (you and two): 80 to 68
    house tokens, a second within 10 minutes not offered, brought after 113 sim s, offered again after 10.7 sim
    minutes; Introduce (Peter and Alan start at 9.865 = 10 + 0.3 min(16.74, -0.45), +5 each with you); Ask about their
    team (+4; the card shows "Mesa Quail"); Console (0 to 8; "My team lost" -12 to -6); Challenge (pool on pool-1, your
    opponent Peter, not the house); Say goodbye (+2, you out of the group). Introduce ran with `force` (its second
    person farther than 8 m from you); Console's setup sets the guest's team as just lost (`npcTeamLost`), as a seen
    final whistle does.
  - **Cards and lists:** Peter's menu "Talk · Joke · Introduce… · Challenge · pool" and the "i"; People here sorted by
    friendship (Peter Friendly 21.9, Natalie 5.3, Ryan 2.8, Ray 2.4, Alan 1.3).
  - **Sparks and puffs** in the HUD layer: 3 shown over heads; the frame 108 calls and 168.0k triangles before and with
    them.
  - **Persistence across a reload:** Tina (r19), friendship 6.5573 before and 6.5569 after (saved to 3 decimals, 19 s
    of the per-day fade), 21 pairs loaded, rapport 18.25 to 0 (this visit's), 4 memories and 2 highlights kept, her team
    still known.
  - **Guests' games:** pool-1 with you 2.3 m away on the physics: 13 shots in 2 sim minutes, all on the physics, the
    largest energy rise in a shot 0. pool-2 off screen (you 18 m away, looking away): 6 statistical turns of 15.5 to 27.6
    s, 1 ball potted (groups stripes and solids, 7 and 6 left); walking up, the physics took over and the 14 object
    balls left were laid out (15 less 1), left 7 and 6 as before, the closest two 0.095 m apart (2r 0.056). Over 20 sim
    minutes: 8 invites (2 accepted, 6 dropped), 18 matches started (by Challenge and invites), 4 ended with their
    results.
  - **Budgets, S3a's run again** (21 poses: the five at 844 x 390 and `door` and `overhead` at 390 x 844, at Low, HD and
    Ultra in turn on one page, after a 30 sim-minute fast-forward; the caps 36, 70 and 100 reached; every item model at
    its cap; 1 to 9 groups talking and 5 or 6 guests' matches at every pose), all inside their rows:
    - Low (pass / frame, calls and triangles): `door` 108/171.8k and 107/167.5k; `tv-east` 115/172.3k; `stall`
      119/209.5k; `patio` 85/134.3k; `overhead` 111/165.9k; portrait `door` 105/169.4k, `overhead` 110/163.7k (rows
      118/203.9k inside, 139/244.3k outside, 118/197.9k overhead; frame 150/250k).
    - HD: `door` 147/363.9k, frame 200/481.4k, sun 41/134.7k; `tv-east` 154/361.0k, 206/483.4k; `stall` 135/338.6k,
      221/605.9k, sun 74/284.7k; `patio` 109/224.1k, 190/489.2k; `overhead` 194/497.8k, 278/759.9k, sun 72/279.5k;
      portrait `door` 140/353.4k, `overhead` 192/499.2k, 276/764.3k.
    - Ultra: `door` 192/701.1k, frame 586/1,907.9k, sun 91/438.2k, pool spots 58/49.2k and 57/47.9k; `tv-east`
      247/960.2k, 666/2,303.4k; `stall` 185/856.8k, 454/2,296.4k, sun 92/616.0k (pool spots frozen, 684); `patio`
      163/724.2k, 410/2,015.4k; `overhead` 247/989.9k, 690/2,629.2k, sun 94/620.9k, pool spots 53/12.3k and 54/47.9k;
      portrait `door` 185/690.3k, `overhead` 248/990.0k, 706/2,664.1k, sun 97/620.9k.
    - No NPC at LOD 0 and no casting mesh other than a `lod1` at any pose. A batch of up to 6 decisions took 0.52 to 0.53
      ms on average (S3a's repair: 0.41 ms; the people's adverts are the difference; the desktop target 0.4 ms); the
      crowd's step 0.2 to 1.4 ms.
- **On the final build** (after the budget run: the approach spot nearest the target, the `playHere` and `stageGames`
  hooks freeing their spots, the `overheadAt` hook, the reply chips' label on its own line, the card's friendship
  number; none of these is in the draw path): smoke, adverts (1,045 decisions, at most 8 people and 43 adverts; 2,858
  person adverts all matching; 23 accepted Talks and Joins all both in one group), talk (above), interactions (all 11,
  the card, People here, the sparks), persist, games and the shots passed again (`s3b-final-2.log`, `s3b-final-3.log`),
  and Low's seven budget poses again, all inside their rows (`door` 108/169.3k, frame 107/165.1k; `tv-east` 115/173.4k;
  `stall` 119/209.5k; `patio` 85/132.7k; `overhead` 111/166.9k; portrait 105/167.8k and 110/167.3k;
  `s3b-final-4.log`), a batch of decisions 0.46 ms on average. The groups talking are recorded at each pose: 1 or 2 at
  the first five and none at the two portrait poses, after `crowdAt('outside')` had moved walk-ins out of their
  parties for `stall` and `patio`; 5 or 6 guests' matches at every pose.
- **The earlier phases' checks** (run 12:19 to 12:35 UTC, before the last fixes above; corrected after review, which
  found "on this build" wrong: the budgets' HD and Ultra rows (11:39 to 11:50) are from before them too, and only
  Low's seven poses were run on the final build): S3a's checks, staff, reactions, clock, fillers, spares and switch
  groups 30 of 30 (`s3b-regress-s3a.log`; S3a's Join now gives your group's keys and party as before); S2b's checks
  14 of 14 and controls 7 of 7 (`s3b-regress-s2b-2.log`, `s3b-regress-s2b.log`; S2b's `playHere` hook now frees its
  spot of a guests' match first, as it skips the walk, and `stageGames` the three it stages); S2a's checks 22 of 22
  (`s3b-regress-s2a-2.log`) and save 2 of 2. S2a's "order food at a table" check now takes a high-top nobody holds
  (high-top 2 first): with S3b's guests moving between tables, a party of four held all of high-top 2, and the page
  rightly toasted "Order food: no free place right now".
- **How the groups run over time** (a probe, Low, Saturday 21:00 from `seed(1)`, every 5 sim minutes to 40): 3 to 5
  groups with two or more present (sizes 2 to 4, a circle or two among them), 8 to 12 of the 31 guests in games, 3 to
  9 standing or sitting in a group; leaving: 42 wrap-ups, 14 to games, 12 decisions elsewhere by 40 minutes.
- **Seen in the runs (recorded, not marks):** guests take to the games: on a Saturday 21:00 room every game spot was in
  use within 3 sim minutes of loading, and 5 or 6 matches were on at every budget pose (at Low 10 to 12 of 31 guests).
  The Challenge advert's expected deltas carry its game's (fun 40 x p for pool), so it outbids most adverts for the
  competitive.
- **Screenshots** (HD, 1280 x 720, on the final build, each looked at): `tests/out/sportsbar/s3b-conversation-radial-1280x720-final.png`
  (you in a group of three by the standing floor, the menu on Ramon: Talk, Joke, Buy a round · 16 tokens, Challenge ·
  darts, Say goodbye and the "i"; Marisol's line and your two reply chips, "Reply · 1" over each), `s3b-card-1280x720-final.png`
  (Marisol: Acquaintance, Regular, mood Fine and social, the friendship bar, "Friendship 2 of 100 · team: ask them",
  "You got talking with Marisol"), `s3b-round-1280x720-final.png` (the toast "Round for 4 · 16 house tokens (no cash
  value) · on its way" and Marisol's "Oh, you're a legend. Thanks."), `s3b-toast-1280x720-final.png` ("To a late winner
  and a long night."; you holding a tamarindo agua fresca), `s3b-npc-pool-overhead-1280x720-final.png` (the overhead
  camera 9 m over pool table 1: Marisol and Ramon's match with the balls spread on the cloth and a player bent over the
  table; table 2 beside it). The first set, without `-final`, was the same scenes before the chips' label and the
  closer overhead camera (the overhead one showed the whole room, the match too small to read).
- **Left open (at the build; see the repair above):** guests' darts and shuffleboard on the physics (O35, closed by the
  repair); the murmur (no audio on either page).

## 2026-11-09: Stoppage Time S3a committed (the crowd, staff, fillers and how people are drawn)

S3a, as repaired after review (the entry below), was kept by the follow-up review and is committed on
`claude/sports-bar`.

- **The reviewer's own run** (one Playwright page on the final build, dist of 09:18, headless Chromium with
  SwiftShader, 844 x 390, Low, Saturday 21:00, week 43, `seed(1)`, 10:43 to 10:45 UTC, no other browser running):
  - Loaded: live 36 of 36 (31 guests; 2 bartenders, 2 servers, the host), 77 fillers, 6 spares. At `door`: 7 bodies
    at LOD 1, 25 at LOD 2, 81 cards, no NPC at LOD 0; the pass 103 calls and 163.4k triangles (row 118 / 203.9k).
  - After a 30 sim-minute fast-forward: median mood 60.75, 0% Low; stuck at most 1.0 s, no watchdog rescue, no slot
    over capacity, nobody in the lane, live never over 36, at most 5 staff; a batch of decisions 0.38 ms on average
    (the slowest 4.9 ms). Drinks: 17 bar and 10 table orders, the bar's wait 9 s median and table service 146 s; at
    the end 4 of 31 holding a drink and 1 waiting. No table mixed fillers and live people; the nearest filler 6.73 m
    (Low's minimum 6 m).
  - Trying to break it: 5 guests drawn at LOD 1 within 7.2 m sent home and the 3 nearest fillers' units handed over,
    then Low to HD to Low with no frame between. No body shown under a card and no spare shown either time, no NPC at
    LOD 0, every drawn body at phone quality, live 34 then 36 of 36 (the round trip held 29 and left 41 fillers).
  - Tapping the nearest filler (a rail stool, 6.07 m) gave Sean, live, with his "Say hi" menu; live stayed at 36;
    `pose()` closed the menu.
  - A forced goal on channel 1: 62 reaction records, 34 of them people who could see a screen, 8 reacted; nobody who
    couldn't see a screen reacted.
  - Monday 05:00: 0 live, 0 fillers, 0 staff. No console or page error at any point.
  - `npx tsc --noEmit` passes. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are unchanged.
- **Images looked at:** the builder's 11 `-r2` shots and the reviewer's `qa-s3a-r2-goal-door-low-844x390.png` and
  `qa-s3a-r2-overhead-low-844x390.png` (the patio's tables and rail stools taken at Low from overhead).
- **Noted, not blocking:** a forced goal (`fireMoment`) carries a 0-0 score, so the "On now" chip still reads 0-0 in
  the goal "after" shots. The `stall` pose faces the north wall, so it shows no glazing. Some LOD 1 bodies at HD show
  grey patches on their tops (the people builder's, not this phase's code).
- **Still open:** the toon half of "Low stays Retro" (O15, O16); no phone run. S3b is next.

## 2026-11-09: Stoppage Time S3a repaired after review

The review kept most of S3a and asked for one draw bug fixed, the groups measured before the builder's last fixes run
again on the final code, a few tighter checks, and the crowd's believability looked at. All done on
`claude/sports-bar`, uncommitted. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched
(`git status` on each empty). `npx tsc --noEmit` passes; `tests/sportsbar-crowd.mjs` passes 16 of 16 (the scheduler's
check on the new ring of frame records among them). The page is 1,674.8 KB (560.4 KB gzipped) by Vite's count.

- **What changed:**
  - **The draw bug.** A body sent home (`removeNpc`) while drawn as a card went to the spares with its old draw
    signature (`card:0`); a hand-over took it, set it visible, and its new guest drawn as a card had the same
    signature, so `applyBody` returned early and the body stayed shown, at the old guest's place, under the card. Now
    a body going to the spares clears its signature and forgets its clip, and a spare taken by a hand-over is hidden
    with no signature, so its first `applyBody` sets visibility, LOD and casting afresh. `vis().people` now reports
    `shownAsCards` and `sparesShown`, and a new check (`--only=spares`) builds the case.
  - **`pose()`** moves the camera first, then runs `buildAll()` (whose LOD 1 queue takes the nearest people from the
    camera), then the rule; before, the queue used the previous camera. The `camera([...])` hook places the camera at
    once, and the goal shots call `buildAll()` after it.
  - **The radial menu** (the person's "Say hi" among them) closes on `pose()` and on every change of graphics.
  - **The per-frame allocations the review listed in the people's draw path are gone:** one pooled people list, filled and insertion-sorted once a
    frame (again only if a hand-over near you changed who's live), read by the LOD 1 queue (worked out once a frame,
    not in both `hasWork()` and `nextJob()`) and by `drawModes` (two passes over the sorted list for casters first;
    the casters a flag, not a set); inside or not from (x, z) without a tuple; one camera-point object; one plate
    scale; the hand items without an array a person; the hand-over cell check as numbers, not a string a frame; the
    scheduler's frame log a ring of 6,000 records reused in place.
  - **The switch log carries its evidence** (each held guest's unit distance, every live guest's after the hold, the
    room before anyone came back) and the switch checks assert the units' rule going down and held-before-fillers
    exactly going up (below).
  - **Drinks (ours).** A probe of the reviewer's case (Low, Saturday 21:00, seed 1, 30 sim minutes) found the
    deliveries weren't slow (table service 128 s median, the bar 9 s; 2 servers) but the room's drinks ran in step: a
    room settled at a set clock seated everyone with fresh thirst (50 to 75), they ordered around minutes 3 to 19 and
    were all satisfied by minute 30 (holding a drink: 0 at first, 8 to 10 around minutes 10 to 17, 1 at minute 30). A
    settled guest now has thirst 40 to 85 and a quarter are part-way through a drink (1 to 6 sips left), from a random
    stream of its own so the seating is the same as before. Arrivals still come in with the table's needs.
  - **Whole tables at HD and Ultra (ours).** With the target past the guest cap and the guest cap over 0.4 of the
    capacity (HD's 60, Ultra's 90; not Low's 31), parties of two and three take singles close together (standing spots
    or stools) with p 0.75 rather than 0.35, so fewer tables of four hold a party of two (no table mixes fillers and
    live people, so a part-filled table is lost to the fillers).
  - The decision timing is per batch: `decideMs` is one entry a step, the step's up to 6 decisions; the logs and the
    plan now say "a frame's decisions (a batch of up to 6)".
- **Checks, on the final code** (headless Chromium, SwiftShader, one browser at a time, the machine at a load of about
  14; `tests/out/sportsbar/logs/s3a-r2-checks.log` and `s3a-r2-all.log`, results in `sportsbar-s3a-checks.json`): 63 of
  63 (6 and 57). A first full run (`s3a-r2-first-stopped.log`) found one failure, no laugh in the 4-minute run: the
  drinks' state then drew from the seating's random stream and reshuffled the room; it was stopped, the stream split
  and every group run again.
  - **Needs and mood** (Low, Saturday 21:00): thirst under 30, 13 of 15 (86.7%) chose a drink-tagged action within two
    decisions; hunger 8 of 8; fun 16 of 16. After 30 sim minutes: median mood 66.0, 0% Low; stuck at most 1.0 s, no
    watchdog rescue; no slot over capacity; nobody in the lane; live never over 36; a frame's decisions 0.408 ms on
    average (a batch of up to 6; the slowest batch 5.3 ms of the last 400). Mood on bodies at tv-east over 6 goals:
    clap, cheer and groan on LOD 1 (4, 1, 3) and LOD 2 (27, 1, 1); 24 laughs on bodies in the 4-minute run.
  - **Drinks** (the same 30 sim minutes, `drinks()`): 16 ordered at the bar and 14 by table service, 29 handed over,
    the wait 10 s median at the bar and 125 s by table service (the slowest 164 s) with Low's 2 servers; holding a
    drink, once a sim minute: 8 7 6 4 4 3 3 1 1 0 0 0 2 3 5 6 6 5 6 6 6 6 6 7 9 9 9 10 8 6 of 27 to 31 live guests (at
    minute 30, 6 holding and 1 waiting; before the change the same run read 1 holding). The plan's drink is 6 sips
    40 to 70 s apart, about 5.5 minutes, and a guest re-orders at about thirst 45, so about 1 in 5 holding is the
    steady state; the dip to 0 around minute 10 is the first quarter's drinks running out before the rest are thirsty.
  - **Staff:** at Low 2 bartenders served all 14 counter positions, the westmost left by the flap, reached H, picked
    3, 3 and 2 empties on three trips and came back; HD and Ultra 4 bartenders, every position served, centres at least
    1.913 m and 2.313 m apart; nobody in the lane or the flap; staff on 5, 10 and 10.
  - **Reactions** (Ultra, Saturday 20:08, 10 seeded goals): 102 supporters who could see a screen, 62.7% reacted
    within 1 s against a mean p of 60.7%; 62% of the other side groaned, 24% of the neutral clapped; nobody who
    couldn't see a screen reacted. At the featured final whistle 2 of 10 eligible winners started dancing (2 drew it
    with no free spot), each a winner who could see a screen, active 0.51 and up, fun 50 or less.
  - **Fillers** (live + held + fillers against the target 130, or every free eligible place): Low Saturday 21:00
    31 + 12 + 65 = 108 (65 free eligible), the nearest filler 6.07 m; HD 60 + 3 + 51 = 114, nearest 9.22 m; Ultra
    90 + 0 + 20 = 110, nearest 9.10 m (before the repair 108, 93 and 91); Tuesday 15:00 19 of 19 at each preset; no
    table mixes fillers and live people. The room as loaded at each preset, from the builds group (no pose, you at the
    spawn): Low 31 + 67 = 98, HD 60 + 53 = 113, Ultra 90 + 17 = 107. Tapping a filler (patio table 4, 11.67 m) gave
    Olivia, a walk-in, live there with her menu. **Clock:** Tuesday 15:00 19 guests against Saturday's 108; closed
    (Monday 04:00) nobody inside, no filler, no staff; Low never drew more than 5 staff; the live count never passed
    the cap.
  - **Spares (new):** at Low on the patio pose (outside), 6 guests drawn as cards were sent home (their bodies to the
    spares), then the filler unit farthest away (33.17 m) was handed over: its guest took the first of those bodies
    and was drawn as a card; no body shown under a card, no spare shown.
  - **Low and the shaders:** one NPC forced to LOD 0 at Low after a 30 sim-minute fast-forward and every pose (18
    calls, 63.5k) compiled with no shader error, its hair `retroSkip`. The toon half still waits for the Retro module.
  - **The builds on the time budget** (from load): Low 31 builds (26 LOD 2, 5 LOD 1) until the room reached its cap,
    span 43.7 s within 55.6 s (ratio 1.335, F 937.8 ms, the builds 7.9 s of it); HD 30, 75.9 s within 109.0 s (1.183,
    F 2,135 ms); Ultra 30, 121.8 s within 198.4 s (1.044, F 3,891 ms). Never two a frame, the gap met at every build (at
    least 1.04, 2.18 and 4.94 times the need), no idle frame. Warm-up frames (logged, not timed): Low 1.9, 3.5 and 2.0
    s; HD 3.3, 6.5 and 2.1 s; Ultra 3.7, 10.9 and 5.4 s.
  - **A change of graphics** (10 of 10; every switch behind its sheet, the live count the new cap from the switch
    frame, your group of three live, no regular or held guest a filler):
    - Low to HD: 20 of 20 held guests back (room 29), then 9 fillers made live; 21 bodies rebuilt behind the sheet
      (2,403 ms); every body at high quality; timed, the next 30 builds passed the four marks (75.9 s within 121.3 s,
      ratio 1.063, the gap at least 1.73 times the need; warm-up 1.2, 3.4 and 2.6 s).
    - HD to Ultra: 11 of 11 back (room 30), 19 fillers made live; no body rebuilt, the atlas kept.
    - Ultra to Low: 59 held, 10.11 to 30.12 m away (12 regulars, 19 standing); the nearest held unit 9.22 m and the
      farthest live unit 9.22 m (one table split across the cut), so the units' rule holds; 21 rebuilt (10,576 ms
      behind the sheet on the loaded machine). A held guest tapped (Chloe) came back as herself under the cap.
    - Low to Ultra: 59 of 59 back (room 59), no filler made live; 21 rebuilt (5,519 ms).
    - Ultra to HD: 30 held, 19.39 to 30.12 m (7 regulars, 16 standing); held unit 19.24 m, live unit 19.24 m; no
      rebuild, the atlas kept. HD to Low: 29 held (10.11 to 20.69 m); held unit 9.22 m, live unit 9.22 m; 21 rebuilt
      (5,391 ms).
    - After each switch and `buildAll()` at `door`: LOD 1 bodies 6.5k to 9.5k at Low (mean 7.8k to 7.9k, 7 bodies) and
      8.6k to 14.2k at HD and Ultra (mean 11.7k to 11.8k, 17 and 41 bodies); no console error.
  - **Budgets** (every pose and preset inside its rows; the margin is the row less the measured `stats()`, calls and
    triangles):
    - Low (cap 36): door pass 105/166.5k of 118/203.9k (margin 13/37.4k); tv-east 112/171.9k (6/32.0k); stall
      119/206.0k of 139/244.3k (20/38.3k); patio 85/133.2k (54/111.1k); overhead 111/167.0k of 118/197.9k (7/30.9k); at
      390x844 door 105/167.6k (13/36.3k), overhead 110/167.0k (8/30.9k). The frame 84 to 118 calls, 129.0k to 201.8k
      of 150/250.0k. No shadow maps.
    - HD (cap 70): door pass 145/372.3k of 177/465.7k (32/93.4k), frame 198/488.8k of 294/718.9k (96/230.1k), sun
      41/133.2k; tv-east 154/365.6k (23/100.1k); stall 135/341.5k of 176/449.5k (41/108.0k), frame 221/613.2k of
      328/854.6k, sun 74/288.9k; patio 109/224.8k (67/224.7k); overhead 190/505.3k of 222/609.4k (32/104.1k), frame
      274/772.8k of 374/1014.5k (100/241.7k); at 390x844 door 140/356.6k (37/109.1k), overhead 192/508.9k (30/100.5k).
    - Ultra (cap 100): door pass 187/696.2k of 302/1202.6k (115/506.4k), frame 570/1871.1k of 1155/3259.2k, sun
      89/432.2k, the pool maps 56/49.8k and 55/26.0k; tv-east 250/976.9k (52/225.7k), frame 666/2320.7k; stall
      185/853.5k of 246/1086.4k (61/232.9k), frame 454/2287.0k of 683/3011.9k (the pool maps frozen, 0.7k); patio
      163/736.2k (83/350.2k); overhead 242/1006.0k of 302/1180.0k (60/174.0k), frame 683/2663.4k of 1185/3396.7k; at
      390x844 door 184/681.7k (118/520.9k), overhead 243/998.5k (59/181.5k).
    - The sums cost a LOD 1 body at 7.5k (Low) and 11.6k (HD and Ultra); the drawn bodies average 7.8k to 7.9k and
      11.7k to 11.8k, so the sums' per-body figure is exceeded by 0.3k to 0.4k and 0.1k to 0.2k a body: at most about
      2.8k at Low's 7 LOD 1s and 8.2k at Ultra's 41, against the smallest triangle margins above (30.9k at Low's
      overhead, 93.4k at HD's door, 174.0k at Ultra's overhead).
  - **The crowd's own CPU a frame** (less any build in it; `s3a-r2-crowdframe.log`, real frames after `buildAll()`,
    `peopleBrief().frameMs` read after each frame): Low door 0.9 ms median, 3.1 ms at the 90th percentile (60 frames);
    Low patio 0.5 and 2.0 ms (40); Ultra door 2.2 and 3.9 ms (30); Ultra overhead 2.5 and 5.1 ms (20). Single frames
    reached 19 to 120 ms (one in each run; garbage collection and SwiftShader aren't separated from it here). The
    crowd's step 0.2 to 0.3 ms median. The builder's 0.4 to 2.8 ms were one frame a pose, so there's no like-for-like
    "before" for the allocation change; the median is what it's for.
  - **Screenshots** (all looked at), in `tests/out/sportsbar/`, `-r2`:
    - `s3a-goal-before-1280x720-r2.png` and `s3a-goal-after-1280x720-r2.png` (HD): before the goal, after `buildAll()`
      at the shot's camera (5 built), the nearest guests are LOD 1 bodies (16 at LOD 1, 54 at LOD 2, 4 cards), with
      their hair and clothes; after it, arms up at the booths, a caption, the Cheer button; 8 of the 34 who could see
      reacted.
    - `s3a-goal-before-390x844-r2.png` and `s3a-goal-after-390x844-r2.png` (Low): 6 at LOD 1 nearest, 13 built at the
      shot's camera; 11 of 23 reacted, arms up across the room.
    - `s3a-overhead-friday-1280x720-r2.png`: a packed Friday, live 70 and 48 fillers of a target of 110; reads full,
      the patio's tables taken.
    - `s3a-door-low-844x390-r2.png` (32 meshes, 71 cards), `s3a-stall-low-844x390-r2.png` (it faces the north wall at
      its corner: the parked cars and you, no glazing in view, as before) and `s3a-patio-low-844x390-r2.png` (the rail
      stools and tables taken, the people inside reading through the glass).
    - `s3a-atlas-low-r2.png` (192 cells, clean) and `s3a-tuesday-1280x720-r2.png` (a quiet Tuesday 15:00: 19 guests
      and 4 staff, a few people at the pool tables and the bar).
  - **Regressions** (on the final build): `tests/sportsbar-crowd.mjs` 16 of 16, `tests/sportsbar-sim.mjs` all pass; S2a's
    page checks 22 of 22 (`s3a-r2-s2a-checks.log`); S2b's checks and controls 20 of 21 at first
    (`s3a-r2-s2b-checks.log`: the shuffleboard swipe's puck left at 2.15 m/s against the 2.4 to 3.6 wanted, the
    gesture's 40 ms timers late at a load of about 13; nothing in the swipe's path changed), then the controls group
    alone 7 of 7 (`s3a-r2-s2b-controls-2.log`: 2.87 m/s, as in S2b's own run); S1's memory group 2 of 2
    (`s3a-r2-s1-memory.log`: the rest 105, 132, 143, 132, 106 and back to 132, 143, 132, 106 geometries, the people 39
    to 41, 83 to 85 and 149 to 150). Lot 57's page still builds (1,172.5 KB, 372.75 KB gzipped).
- **Left open:** the Retro toon half of "Low stays Retro" (O15, O16); S3b's people adverts, interactions and NPC games;
  the murmur; the patio closing for rain; no phone run. A room reached by switching up keeps the seating it had, so Ultra's
  room can still come out under Low's on another seed or path (a probe during the repair read 90 + 10 = 100 at the
  door after switching up from Low). Nothing committed.

## 2026-11-09: Stoppage Time S3a built: the crowd, staff, fillers and how people are drawn

S3a (`PROJECT_OC_SPORTS_BAR.md`, "### S3a") is built on `claude/sports-bar`, uncommitted. The room fills: regulars and
walk-ins in parties, live up to the preset's cap with the staff, and fillers (cards) making up the rest of the
simulated crowd; guests choose what to do by the plan's utility AI; two to four bartenders serve the counter by
sections, servers run table service, and at Low the westmost bartender leaves by the flap to collect empties; the crowd
reacts to the screens; people are drawn as LOD 1, LOD 2 or cards by the visibility rule, with the casting people and
Ultra's pool-slot people; bodies are built on the time budget, and a change of graphics moves the live count to the
new cap behind its sheet. `people/`, `lot57/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched (`git
status` on each empty); the bar's own `venues/sportsbar/main.ts` changed in a few local lines only (below).
`npx tsc --noEmit` passes. The page is 1,670.9 KB (559.0 KB gzipped) by Vite's count.

- **The first step.** `git fetch origin claude/onfoot` found nothing newer than 47c71a6 (merged at a5ac3fd), so no
  merge was made. The re-measure: every L row, the contracts and the `people/` internals unchanged (the plan's "S3a's
  re-measure"); the Retro module still only on `origin/claude/wip-modes` (O15).
- **What's new:**
  - `engine/sim/crowd.ts` (the regulars' pool of 48 in friend groups of 2 to 5, first names from 200, traits, teams by
    arrival time, favourites; parties of 1 to 6; log-normal stays with an 80-minute median; the staff plan by the
    share, Low's five), `autonomy.ts` (the utility AI, term by term, the urgent rule, hysteresis, overlays and the
    top-three draw), `groups.ts` (Lot 57's talking-group rules), `builds.ts` (the time budget and its log), `names.ts`,
    `lines.ts` (30 starter lines). No three.js in any of them.
  - `venues/sportsbar/crowd.ts`: the crowd on the page (settling at a set clock, Poisson arrivals from the lot and the
    drop-off, leaving, the live cap with the staff, held guests, fillers and the hand-over with 6 spare bodies), the
    guests' actions on the objects (the bar and table service through the staff, water, the jukebox, the restrooms out
    of sight, watching, sitting, dancing, eating, chatting at their table), the watchdog and the decision log, the
    reactions to the screens (cheer, groan, clap; the direct dance chance at the featured final whistle), the draw
    modes (LOD 1, LOD 2, cards; the casting people with a hidden LOD 1 under a LOD 2; Ultra's pool-slot people), moods
    on bodies (walk speed, a slump when Low, the clips, laughter in standing groups, captions near you), the builds,
    a change of graphics, and the hooks.
  - `venues/sportsbar/cards.ts`: the filler atlas (the atlas eight, 3 poses, 8 directions, 192 cells; 1024 with 48 x 96
    cells at Low, 2048 with 96 x 192 at HD and Ultra) and the cards' one instanced mesh and the blobs'.
  - `crew.ts`: the bartenders' sections and lane limits and the westmost one's flap trip at Low; the host; the barback.
  - `life.ts`: the crowd wired in (its step in the sim, its frame at the top of the update, the reactions, the items in
    hands, the person menu, the S3a hooks); your table and seat choices respect the crowd's slots and fillers.
  - `main.ts` (local edits only): the crowd's context (the renderer, the overhead's target, the state, how your avatar
    is drawn), Sit and tap to sit skip a taken seat, the doors open for guests too, `stats()` and `vis()` report the
    people, `pose()` and `buildAll()` build every pending body first, and every change of graphics goes behind a
    "Switching to …" sheet (Ultra's "Preparing Ultra…" as before), with a `switchSheet(q)` hook.
  - `def.ts`: `fillerMinM` 6 at Low and 9 at HD and Ultra; HD's `staff` 10.
  - Tests: `tests/sportsbar-crowd.mjs` (the engine side in Node) and `tests/sportsbar-s3a.mjs` (the page: smoke,
    checks, staff, reactions, clock, fillers, retro, builds, switch, budgets, shots); S1's memory check changed as
    below.
  - The player beside the crowd (found by S2a's checks run as regressions, fixed here in `life.ts`, `crowd.ts` and
    `crew.ts`): your food and table orders go to the least busy server on shift, and that server's trips for them go
    ahead of the crowd's; a server's job now waits out its delay (the arrival time) in the queue, so a job not yet due
    never keeps a server standing while another is due (a probe found both servers standing through the crowd's
    30 to 90 s arrival delays while wings ordered at the counter sat "on the way"; alone, as in S2a, the timing is the
    same). At a one-person spot someone in the crowd is using (the jukebox, the water station) your action waits in
    the queue ("someone's there, you're next"), the crowd leaves the spot to you, and it starts when they're done (up
    to 2 sim minutes). The jukebox's spot is the page's own, not a venue slot, and the crowd didn't know it (so it
    read as taken to you, and no guest ever picked a song): the crowd now takes it into its places. With every place
    that sees a screen taken, Watch finds you a clear patch of floor in front of it with it in view (the patio's inside
    its rail), clear of people and of every place the crowd uses.
  - S1's memory check (`tests/sportsbar.mjs`, "memory") now takes the people's own geometries off the renderer's count
    (`peopleGeometries()`: the uploaded geometries of the bodies the crowd holds now, the guests', the spares' and the
    staff's) and logs them beside each row: with the crowd, who's in and who's at LOD 1 move between rounds (the run
    against the crowd read one geometry more at Ultra in the second round, 293 against 292). A body let go without
    being disposed is in none of the crowd's lists, so it stays in the rest and still fails the check. A probe of the
    same sequence read the people at 39 to 41 (Low), 85 (HD) and 150 (Ultra) geometries, the rest 105 to 106, 130 to
    132 and 143.
- **Checks** (headless Chromium, SwiftShader, one browser at a time; `tests/sportsbar-s3a.mjs`, logs in
  `tests/out/sportsbar/logs/`, results in `tests/out/sportsbar/sportsbar-s3a-checks.json`):
  - **Engine** (`tests/sportsbar-crowd.mjs`, Node): 16 of 16. The plan's worked arithmetic comes out as written:
    watching 70.46 without the urgent rule; the drink 12 m away with 10 of 13 taken 28.94 without it and 58.94 with it;
    water 47.35; watching re-scored plain 25.46; the bar screens from 12 m 6.72; a drink-tagged action picked with p
    0.988 (20,000 seeded decisions); table service at thirst 29 scores 73.57; seated, ordering at about thirst 45
    (28.33) and not at 50 (24.36); hysteresis keeps the current action; urgency 0.200, 0.650, 1.107, 2.000. Groups:
    268 turns in 20 minutes, median 3.50 s, 1.00 to 10.00 s, 1.40 laughs a minute. The staff plan by share, Low's five,
    48 regulars in 14 groups of 2 to 5, 200 names, stays median 79.6 minutes, 30 lines, the scheduler.
  - **Needs drive choices** (Low, Saturday 21:00; the last run after the fixes, `s3a-checks-7.log`): thirst under 30,
    16 of 18 (88.9%) chose a drink-tagged action within two decisions; hunger 6 of 6; fun 14 of 14 (70% wanted). After
    a 30 sim-minute fast-forward: median mood 65.0, 0% Low; stuck at most 1.0 s, no watchdog rescues; no slot over
    capacity; nobody in the lane; live never over 36; a frame's decisions 0.225 ms on average (a batch of up to 6; the slowest batch 2.1 ms, over the last 400 batches).
  - **Mood on bodies:** in real frames at the tv-east pose over 6 goals, clap (4), cheer (1) and groan (2) on LOD 1,
    clap (31), cheer (2) and groan (2) on LOD 2; 16 laughs on bodies in a 4-minute run; no NPC at LOD 0.
  - **Staff** (the same run): at Low two bartenders served all 14 counter positions, the westmost left by the flap,
    reached H, picked 2 empties and came back (and was out on a second trip, 3 picked, when the check read); HD and
    Ultra four bartenders, every position served, centres at least 0.72 m (HD) and 2.313 m (Ultra) apart, nobody in
    the lane or the flap; staff on 5, 10 and 10.
  - **Reactions** (Ultra, Saturday 20:08, 10 seeded goals): 109 supporters who could see a screen, 61.5% reacted
    within 1 s against a mean p of 59.6% (within 12 points wanted); 61% of the other side's groaned; 23% of the neutral
    clapped (p 0.25); nobody who couldn't see a screen reacted. At the featured final whistle 3 of 10 eligible winners
    started dancing (p = 0.5 x active; 2 drew it with no free spot), each one a winner who could see a screen, active
    0.50 and up, fun 50 or less.
  - **Fillers** (live + held + fillers = the target, or every free eligible place): Low Saturday 21:00 31 + 0 + 77 =
    108 of 130 (77 free eligible), the nearest filler 6.07 m (6 wanted); HD 60 + 0 + 33 = 93 (33 free), nearest 9.22 m
    (9 wanted); Ultra 90 + 0 + 1 = 91 (1 free), nearest 13.03 m; Tuesday 15:00 19 live of 19 at each preset; no table
    mixes fillers and live people. Tapping a filler (patio table 6, 17.84 m) gave Jack, a walk-in, live there with his
    menu. Closed (Monday 04:00) nobody inside; Low never draws more than 5 staff; the live count never passed the cap.
  - **Low and the shaders:** one NPC forced to LOD 0 at Low after a 30 sim-minute fast-forward (17 calls, 65.8k)
    compiled with no shader error, its hair marked `retroSkip`. The toon half waits for the Retro module (O15).
  - **The builds on the time budget** (from load, until the room reaches its cap or the first 30 counted builds): Low
    31 builds (26 LOD 2, 5 LOD 1), span 55.1 s within 71.2 s (ratio 1.316, F 879.5 ms); HD 30, 71.8 s within 112.7 s
    (1.083); Ultra 30, 131.5 s within 222.7 s (1.004). Never two a frame, the gap met at every build (at least 1.01,
    1.52 and 1.83 times the need), no idle frame. The three warm-up frames were logged and not timed (Low 5.0, 4.5 and
    1.4 s; HD 6.7, 7.4 and 2.7 s; Ultra 8.7, 19.9 and 4.5 s).
  - **A change of graphics** (10 of 10): Low to HD behind "Switching to HD…": live 70 at the cap from the switch
    frame, 20 held guests back before 9 fillers made live, 21 bodies rebuilt behind the sheet (2,494 ms), your group
    live, every body at high quality; timed, the next 30 builds passed the four marks (74.3 s within 111.6 s, ratio
    1.133). HD to Ultra and Ultra to HD: no body rebuilt, the atlas kept. Ultra to Low: live 36, 59 held (the nearest
    10.11 m away, the farthest 30.12 m; 12 regulars), 21 rebuilt (4,769 ms behind the sheet), every body at phone
    quality. A held guest tapped (Chloe) came back as herself, room made under the cap first (36 of 36). LOD 1 bodies
    after a switch: 6.5k to 9.5k at Low (mean 7.8k to 7.9k), 8.6k to 14.3k at HD and Ultra (mean 11.8k). No console
    errors.
  - **Budgets** (`stats()` at the poses against the sums, every row inside):
    - Low (cap 36): door 107/165.3k of 118/203.9k; tv-east 114/171.5k; stall 119/206.8k of 139/244.3k; patio
      85/135.9k; overhead 110/165.0k of 118/197.9k; at 390x844 door 104/165.2k and overhead 109/165.0k. No shadow maps.
    - HD (cap 70): door pass 142/357.7k of 177/465.7k, frame 192/442.6k of 294/718.9k, sun 38/102.6k; tv-east
      148/354.5k; stall 135/333.0k of 176/449.5k, frame 219/595.8k of 328/854.6k, sun 74/280.8k; patio 113/226.3k;
      overhead 190/501.9k of 222/609.4k, frame 274/771.7k of 374/1014.5k; at 390x844 door 140/346.0k and overhead
      192/507.1k.
    - Ultra (cap 100): door pass 186/683.6k of 302/1202.6k, frame 571/1850.8k of 1155/3259.2k, sun 90/430.1k, the
      pool maps 57/44.0k and 56/40.0k; tv-east 250/965.5k, frame 669/2286.7k; stall 185/839.3k of 246/1086.4k, frame
      454/2243.8k of 683/3011.9k (the pool maps frozen, 684 tris); patio 163/719.5k; overhead 243/998.7k of
      302/1180.0k, frame 679/2624.4k of 1185/3396.7k; at 390x844 door 181/663.8k and overhead 242/1001.3k, frame
      686/2664.5k.
    - The crowd's step 0.1 to 0.9 ms (one 4.3 ms), its frame 0.4 to 2.8 ms, a frame's decisions (a batch of up to 6) 0.155 ms on average at Ultra;
      a frame's CPU 5 to 18 ms here without a build and 255 to 1,238 ms with a LOD 1 build in it (SwiftShader; real
      hardware not measured).
  - **Screenshots** (all looked at), in `tests/out/sportsbar/`:
    - `s3a-goal-before-1280x720-r1.png` and `s3a-goal-after-1280x720-r1.png` (HD, Saturday 21:00): 14 of the 39 who
      could see a screen reacted, claps at the front, a cheer at the back, the Cheer button up.
    - `s3a-goal-before-390x844-r1.png` and `s3a-goal-after-390x844-r1.png` (Low): 11 of 23, two cheering.
    - `s3a-overhead-friday-1280x720-r1.png`: a packed Friday, live 70 and 46 fillers of a target of 110; reads full.
    - `s3a-door-low-844x390-r1.png`, `s3a-stall-low-844x390-r1.png`, `s3a-patio-low-844x390-r1.png`: Low on a
      Saturday night; the door packed, the patio's people inside read through the glazing (the stall pose faces the
      north wall, no glazing in view).
    - `s3a-atlas-low-r1.png`: the Low atlas (192 cells).
    - `s3a-tuesday-1280x720-r1.png`: a quiet Tuesday 15:00, 19 guests of 19 and 4 staff.
  - **Regressions:** S1's Node sim (`tests/sportsbar-sim.mjs`) and S2b's engine (`tests/sportsbar-games.mjs`) all
    pass. S2a's page checks first read 18 of 22 against the crowd (the jukebox, the
    two counter orders, a patio screen's watch: the fixes above), then 22 of 22 (`s3a-s2a-checks-3.log`: a song +4.62
    fun over 1.5 minutes with the walk, water +17.60 thirst; both counter orders in hand 2.50 sim minutes after the food
    was picked; the patio screen watched 20:11 to 20:27, +5 tokens). S2b's page checks and controls: 21 of 21. S1's
    data, honesty, shadows and memory groups: 36 of 37, the memory check one geometry over at Ultra in the second
    round (the change above), then the memory group 2 of 2 (`s3a-s1-memory.log`: the rest 105, 132, 143, 132, 106 and
    back to 132, 143, 132, 106 exactly; the people 39 to 41, 83 to 85 and 149 to 150 geometries).
- **Re-measured on the final code** (the repair, the entry above; `tests/out/sportsbar/logs/s3a-r2-checks.log` and
  `s3a-r2-all.log`): the builds, a change of graphics, the budgets, the reactions, the fillers, the clock and the
  shots, which had run here before the jukebox's spot joined the crowd's places and the servers' queue changed, all
  passed again on the repaired code: the builds' four marks at Low, HD and Ultra (ratios 1.335, 1.183 and 1.044) and
  after the timed Low-to-HD switch (1.063); all six switches with the units' rule and held-before-fillers asserted;
  every budget pose inside its rows (the tightest Low's tv-east pass by calls, 6 under, and Low's overhead by triangles, 30.9k under); reactions 62.7% against
  a mean p of 60.7%; fillers 108, 114 and 110 of 130 on a Saturday night; closed hours empty; the eleven screenshots
  shot again as `-r2`.
- **Left open:** the Retro toon half of "Low stays Retro" (O15, O16: the Retro module is still only on
  `origin/claude/wip-modes`); S3b's people adverts, the 11 interactions and NPC games; the murmur (no audio on either
  page); the patio closing for rain (the page has no weather); (the draw pass's small arrays a frame went in the repair,
  above); LOD 1 bodies average 7.8k at Low and 11.8k at HD and
  Ultra, a little over the sums' per-body figures, every pose inside its row all the same; no phone run. Nothing
  committed.

## 2026-11-09: Stoppage Time S2b committed (pool, darts, shuffleboard)

S2b, as repaired after review (the entry below), was kept by the follow-up review and is committed on
`claude/sports-bar`. Built: pool on both tables (the house player Rocío, ball in hand anywhere after a scratch), darts
on the three boards, and the shuffleboard, with their game cameras, HUD hints and the game clips (pool stance and shot,
dart throw, shuffleboard slide).

- **Checks, re-run by the reviewer:** `npx tsc --noEmit` passes (re-run again before this commit).
  `node tests/sportsbar-games.mjs` passes 15 of 15: energy never rose, no ball left the bed, the slowest break settled
  in 6.82 s, the house chose 189 pots and 11 safeties, a puck at 3.0 m/s stopped 6.5468 m away. The builder's final
  page run (`tests/sportsbar-s2b.mjs`) passed 21 of 21 page checks and controls and 8 of 8 screenshots. The reviewer's
  own probe at 1280 x 720 (14 random hard pool shots, both scratch paths) found no ball off the bed and no overlap, and
  no console or page error. `lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are unchanged.
- **Budgets:** the game pieces in play cost 4 calls and 1.4k triangles at Low, 4.7k at HD and Ultra, inside their rows;
  every budget pose stays within its sums (details in O4 of the plan and the S2b entries below).
- **Images:** `tests/out/sportsbar/s2b-pool-aim-*-r2.png`, `s2b-pool-shot-*-r2.png`, `s2b-darts-oche-*-r2.png`,
  `s2b-darts-throw-*-r2.png`, `s2b-shuffle-slide-*-r2.png`, `s2b-shuffle-rest-*-r2.png` (844 x 390 and 1280 x 720),
  and `s2b-clip-*-r2.png`.
- **Still open:** the pool stance and shot clips go to the design review queue (`PROJECT_OC_HANDOFF.md`). S3a is next.

## 2026-11-09: Stoppage Time S2b repaired after review

Two reviews of S2b: one kept it with fixes, one rejected it (your ball in hand wasn't "anywhere", and the games'
per-frame drawing allocated memory). Both lists are done on `claude/sports-bar`, uncommitted; what was good is kept.
`lot57/`, `people/`, `src/onfoot/main.ts` and `src/onfoot/index.html` still show an empty `git status` and `git diff`.
`npx tsc --noEmit` passes. The page is 1,573.5 KB (525.9 KB gzipped) by Vite's count.

- **Two claims in S2b's summary were wrong, and are corrected here and in the plan:**
  - The near-black people over the pool table were not Low's missing lights. They were your own avatar, drawn in the
    game view, standing just under the pool camera (its eye about 0.25 m below the camera's): its arms and shoulders
    showed as black shapes at the frame's left edge at Low and at HD (`s2b-pool-aim-1280x720-r2.png` of the first
    round was HD).
  - The darts "mid-throw" screenshot had no dart in the air: its own log said "0 in the air" and the check passed
    anyway.
- **What changed:**
  - **Ball in hand for you** (the plan's "a scratch gives ball in hand anywhere"): after the house scratches, your cue
    ball starts on the head spot and stays in hand; a drag that starts on it (within 8 cm on the cloth) moves it
    anywhere on the bed, to the nearest free spot (`PoolGame.place(x, y, keep)` through `freeSpot`); the shot ends it.
    The hint says "Ball in hand: drag the cue ball to place it anywhere · then drag back from it to aim · release to
    shoot". Hooks: `shoot(id, { place: [x, y], ... })` (refused without ball in hand), `placeCue`, and
    `houseShot(id, 'scratch' | { angle, speed })`, which scripts the house's next shot so a check can have it scratch.
  - **Your avatar is hidden in the pool view** (a hidden caster at HD and Ultra), from the move in to the move back;
    darts and shuffleboard still show it over your shoulder.
  - **The toasts no longer cover the "Simulated crowd" chip.** Outside a game they sit under the top centre column and
    the screens chip (their bottom measured by a `ResizeObserver`, not per frame); in a game, just above the game's
    bar.
  - **The darts throw screenshot** is taken with the third dart in the air. A frame here (0.5 to 3 s) is longer than
    the whole 0.44 s throw, so a hook, `holdDart(id, k)`, holds the dart at 12% of its flight, and the check fails if
    no dart is in the air.
  - **The shuffleboard's zones read.** The lines are 4 cm wide (they were 2 cm) and cream (they were near black), the
    foul line bright red, and the numbers 1, 2 and 3 are painted in the zones (12 strokes in the markings batch, about
    0.2k triangles, no call). From the throwing end the zones are 6 m off and nearly edge-on, so no paint makes them
    legible from there. While your puck slides and in the pause after, the camera now follows it, 1.7 m behind and
    over its line. The new `s2b-shuffle-rest-*` screenshots show it.
  - **A bug found on the way:** the shuffleboard's sideways sign took the screen's left for its right. A swipe drifting
    right sent the puck left, and the camera stood on your left. Fixed: a right drift goes right (checked on screen
    below).
  - **The scripted shots refuse non-numbers** instead of clamping them: a NaN, infinite, zero or negative speed, a NaN
    angle, a bad place, and the darts' and shuffleboard's values. `PoolGame.shoot` and `ShuffleGame.slide` refuse them
    too. Before, a NaN angle left the table rolling until the 60 s settle limit.
  - **No allocations in the per-frame paths** (the code review's list):
    - Pool: the drawing and `toW` write into a scratch pair or inline math with the cached axes, and `guide()` fills
      one result object.
    - Shuffleboard: pucks are drawn through a private method with the cached bed axes, and the substep keeps one event
      object.
    - Darts: the sway and the reticle write into scratch pairs (`swayInto`).
    - Places worked out once at construction: the oche, the aside spots, the thrower's place, the house's places, the
      darts and shuffleboard camera eyes, and the walk-away anchor.
    - The game bar's text is rebuilt only when the game's version changes, and the balls and pucks left are fields
      (`PoolGame.leftN`, `ShuffleGame.bySide`). The power meter and the reticle are written only when their values
      change.
    - The house's ball-in-hand search passes the skipped ids to `clearPath` as numbers and reads its targets once.
- **Checks** (headless Chromium with SwiftShader, one browser at a time; other lanes' suites were running, and the
  load was about 9 to 11):
  - `node tests/sportsbar-games.mjs`: **15 of 15** (`tests/out/sportsbar/logs/s2b-r-games-unit.log`). The 13 as
    before, with the same numbers: no energy rise over 500 breaks, the slowest settling in 6.82 s; 189 pots and 11
    safeties; the 3.0 m/s puck stopping 6.5468 m away. Two are new:
    - Ball in hand: placing at (0.2, -0.3) keeps the ball in hand there. Asking for (9, 0.3), off the bed, puts it at
      (0.467, 0.300), on the cushion's line. Asking for the 5 ball's spot moves it 60 mm off that centre. Five bad
      shots are refused. A good shot leaves from (0.20, -0.30) and ends the ball in hand.
    - The house's ball-in-hand search (`bestPlacement`), timed in Node over 200 seeded layouts: median 1.11 ms, 95th
      percentile 4.53 ms, worst 8.47 ms. The worst includes the first call's warm-up. The previous version wasn't
      timed, so there's no before figure.
  - `node tests/sportsbar-s2b.mjs --only=checks,controls` on the final build: **21 of 21**
    (`s2b-r-final-checks.log`). The S2b checks pass with the same numbers as before: the three games and the close
    loss, the clips at each LOD with `people/` clean, the breakdown, and the cameras (in over 5 frames and back over 6,
    0.000 m from your eye, 2 cuts with reduced motion). The breakdown's base is now 110 calls and 162.7k triangles: the
    painted numbers. The new checks:
    - Ball in hand after the house's scripted scratch: the house's log says "Rocío scratched: ball in hand". The cue
      ball sat at (0, -0.495), the head spot, still in hand, with the hint shown. `shoot` with
      `place: [0.3, -0.25]` struck from (0.3, -0.25), and the ball in hand ended.
    - Twelve bad scripted values refused, each with its reason, and nothing moved.
    - The toasts at 844 x 390: "You: nothing down" at y 264 to 294, just over the bar (from y 300). After you leave,
      the toast is at y 132 to 171, under the chip (y 92 to 126). No overlap either time.
    - The bar rebuilt 0 times over 4 frames of your turn, and once after a shot. In third person at Low your avatar
      isn't drawn in the pool view, and is drawn in the darts view.
    - By pointer at 1280 x 720: a 190 px drag from the cue ball moved it from the head spot to (0.1024, -0.125), still
      in hand. A drag back from it then shot from there.
    - A swipe drifting 20 px right gave a line of +0.954 degrees. On screen the bed's +y lies to the right (x 672 px
      against 649), and the puck stopped at y +0.107 m.
    - The toasts at 1280 x 720: "You: 20 · 20 · 281 to go" at y 557 to 587, over the bar (from 593); after leaving, at
      y 132 to 171; the chip at y 92 to 126.

    The earlier checks: the pool drag (74.05 degrees, power 0.327) and the darts flick (T20). The straight swipe gave
    2.98 m/s and stopped at 6.5497 m. In one earlier run the same gesture measured 2.56 m/s, because the page's timed
    events stretched under load; the check's band (2.4 to 3.6) held.
  - `--only=shots --tag=r2`: **8 of 8** (`s2b-r-shots-3.log`). I looked at every image:
    - `s2b-pool-aim-*-r2.png` and `s2b-pool-shot-*-r2.png` (844 x 390 Low, 1280 x 720 HD): the table, the cue, the
      guide, the ghost ball and the power. No black shapes at the edges, only the pockets. Your avatar was not drawn
      (Low) or a hidden caster only (HD).
    - `s2b-darts-oche-*-r2.png`: the aim held on the treble 20, its sway putting the reticle by the treble 1 at that
      instant. The toast "You: 20 · 20 · 221 to go" sits above the
      game bar, and the chip reads.
    - `s2b-darts-throw-*-r2.png`: the third dart in the air, just out of your hand, lower left of the board (1 in the
      air, at 12% of its flight).
    - `s2b-shuffle-slide-*-r2.png`: your puck on its way, the camera following.
    - `s2b-shuffle-rest-*-r2.png`, new: your puck at rest in zone 3, with the zone lines and the painted 1, 2 and 3
      legible ahead, and the toast "Your puck: zone 3" over the bar.
  - Not re-run: the budget poses, and S1's and S2a's groups. The repair adds no draw call. The venue gains about 0.2k
    triangles, and in S2b's budget run the closest any pose came to a row was 3 calls and 31.8k triangles under it.
    The toasts' new place isn't checked by any S1 or S2a check.
- **Left open:** the cue is drawn on its own, not in your or Rocío's hands. It's written up with the pool stance and
  shot clips for the design review queue (`PROJECT_OC_HANDOFF.md`, O33). Watch pool, other people's games, the
  unwatched games' statistics (S3a), keyboard and gamepad shots, and the games' sounds are still not built. Frame rates
  on real phones were not measured.

## 2026-11-09: Stoppage Time S2b built: pool, darts and shuffleboard

S2b (`PROJECT_OC_SPORTS_BAR.md`, "### S2b: the games") is built on `claude/sports-bar`, uncommitted: pool on both
tables, darts on the three boards and the shuffleboard, each played against the scripted house player, with the plan's
physics, rules and controls, the house's shot selection and aim error, the game cameras, the results and the four game
clips. `people/`, `lot57/`, `src/onfoot/main.ts` and `src/onfoot/index.html` are untouched (`git status` on each
empty); the bar's own `venues/sportsbar/main.ts` changed in five lines (the game view's camera hook and your avatar
drawn in it). `npx tsc --noEmit` passes. The page is about 1,565 KB (523 KB gzipped) by Vite's count, 56 KB more
than S2a's.

- **What's new:**
  - `engine/sim/pool.ts`, `darts.ts`, `shuffle.ts` and `games.ts` (no three.js): the plan's pool physics (r 0.028 m,
    1.98 x 0.99 m bed, restitution 0.95 and 0.75, 0.25 m/s², pockets r 0.055, 240 Hz, no spin), simplified 8-ball, the
    house's shot selection exactly as the plan's six steps and its aim error; the standard dartboard, 301 straight out
    with the bust, your sway; the shuffleboard (mu 0.07, 0.8, 0.6, 240 Hz, zones and frames to 15); the results'
    numbers. Also the unwatched games' statistical pool turn and seeded layout (not wired: S3a's).
  - `venues/sportsbar/games.ts` (the six game spots, your drag, flick and swipe, the pieces, the house's turns),
    `gamecams.ts` (above the table, behind the oche, behind the puck; 0.5 s, a cut with reduced motion) and `house.ts`
    (the house player, Rocío, one of our staff, built at LOD 1 with the crew at load). `life.ts` wires them: Play pool,
    Play darts and Play shuffleboard on the radial menus, the games' need rates while you play, the results (the
    "Won a game" moodlet at 12 x (0.6 + 0.8 x competitive) and 5 house tokens, or "Lost a close one"), three of
    tonight's goals, and the hooks `game(id)`, `shoot(id, params)`, `games()`, `playHere`, `playOut`, `leaveGame`,
    `gamecam`, `house`. The game bar, the cue's power meter and the dart's reticle are HTML (`sportsbar.html`).
  - The venue: the pool tables redrawn to the plan's playing bed (the same boxes moved: 684 triangles a table and lamp,
    as before), the shuffleboard's bed to 6.7 x 0.51 m with side rails and its four lines, and the dartboard's face
    redrawn at the standard radii with its numbers, so the face is the board the scoring reads.
  - The clips: pool stance, pool shot, dart throw and shuffleboard slide on S2a's clip layer.
- **Bugs found and fixed while building:** the dart reticle sat about 0.4 m off the board: after the game view moves
  the camera, its world matrix was still the one Lot 57's `lookAt` left at your eye, so projections that frame used
  your eye (the game view now updates the matrix; handoff item 10). A dart thrown during a fast-forward's one-second
  step spent its wind-up and stayed in the air (the step now carries the remainder into the flight). The budget
  poses' first run measured the pool camera, not the poses, because staging the games made a game yours (staged games
  now leave the camera and the walking-away rule alone, and a test's fixed camera wins over a game view).
- **Checks** (headless Chromium with SwiftShader, one browser at a time; other lanes' browsers were running throughout
  and the machine was at a load of about 16 to 20):
  - `node tests/sportsbar-games.mjs` (no browser): **13 of 13 passed** (`tests/out/sportsbar/logs/s2b-games-unit.log`):
    - pool physics over 500 random breaks (the cue ball behind the head string, within 3 degrees of the apex, 3.5 to
      5.5 m/s), every 240 Hz substep: the largest rise in kinetic energy over a substep 0 (energy never grew); no ball
      ever off the bed, and every ball off the table one that was potted; the slowest break settled in 6.82 s (median
      4.93 s), 0.74 balls potted a break;
    - the house's pool shots in 200 seeded layouts (2 to 15 object balls scattered, groups or an open table): 189 pots,
      each passing both clear-path tests with a cut under 70 degrees (side pockets within 50 degrees), and 11 safeties;
    - 40 whole pool games with the house's selection on both sides all ended with a winner (the longest 197 shots);
    - darts: the board (T20 60, D20 40, 1 right of 20, 6, 3 and 11 at 3, 6 and 9 o'clock, bull 50, 25, off 0); from
      40, a single 20 leaves 20, a treble 20 then busts back to 40 and passes the turn; a single 20 from 40 then 20
      wins (no double); 40 whole games all ended (the longest 12 turns); the sway 30, 19.5, 9.0, 19.1 and 31.7 mm at 0,
      0.6, 1.2, 2 and 3 s held, 12.8 mm at 1.2 s with energy 5;
    - shuffleboard: a puck released at 3.0 m/s stopped **6.5468 m** away (v² / 2 mu g = 6.5531 m), in zone 3; a puck slid
      into another knocked it on; 40 whole games to 15 all ended (4.0 frames a game on average).
  - `node tests/sportsbar-s2b.mjs --only=checks,controls` on the final build: **14 of 14 passed**
    (`tests/out/sportsbar/logs/s2b-final-checks.log`; the same checks passed before the last two fixes in
    `s2b-checks-2.log` and `s2b-controls-3.log`). The checks (844 x 390, Low, Saturday 21:00, week 43):
    - the house player built at load (LOD 1, 7.3k triangles at phone quality) with the bartender and the server;
    - a pool game completed: you won (your shots by the hook: the break, then the house's own selection for your balls
      with no aim error; the house at its 3.3 degree error), 18 shots in all, "Won a game" +11.99 (12 x
      (0.6 + 0.8 x 0.5) = 12.00), tokens +5 from the game (+5 more from "Pot two balls in one pool turn"), the emotion
      Confident; while playing, the needs ran at pool's rates;
    - a darts game at competitive 0.9: you won, "Won a game" +15.82 (15.84), +5 from the game and +5 for "Win a game
      of darts";
    - a shuffleboard game (your slides at zone 3's speed, straight): you won 15-0 in two frames, +11.99, +5 from the
      game and +5 for "Land a 3 at shuffleboard";
    - a close loss: you stalled at 1 to go and the house checked out: "Lost a close one" -3.97, no tokens from the game
      (the one token that came was the time in the bar);
    - with a game of each kind set up, `breakdown()` (a fixed camera over the games, the loop frozen) changed only in
      the item meshes: 110 calls and 162.5k without pieces, 114 and 163.9k with them (balls 31 x 32, bands 14 x 16,
      sticks 8 x 12, discs 5 x 16: 4 calls, 1.4k);
    - the game cameras: for each game, in over 6 frames and back to your view over 6 frames once the turn passed,
      the camera 0.000 m from your eye in first person; with reduced motion a cut each way (the blend 1 on the first
      frame of your turn and 0 on the first frame after);
    - the four game clips play on a person built at LOD 2, 1 and 0 (weight 1; the right arm turned 0.25 rad in the pool
      stance and shot, 1.36 in the dart throw, 1.01 in the slide), and `git status` and `git diff` on `people/` empty.
  - The controls (1280 x 720, Low; the loop frozen during each gesture so the events are quick; the darts' and the
    shuffleboard's gestures dispatched as timed touch events in the page, since mouse events over the test's connection
    arrived up to a frame apart on this loaded machine): a 91 px drag back from the cue ball set the aim (74.05 degrees) and the power (0.327, the
    meter showing it) and the release shot; at the darts a press and a slow release threw nothing, and a 1.2 s hold
    then a flick up (240 px in 64 ms) threw one dart, a treble 20; a swipe of 360 px in 0.2 s slid the puck at
    2.98 m/s to 6.558 m, zone 3.
  - `--only=shots,clipshots --tag=r2`: **9 of 9** (`s2b-shots-2.log`), every image looked at:
    `tests/out/sportsbar/s2b-pool-aim-*-r2.png` and `s2b-pool-shot-*-r2.png` (overhead: the cue drawn back, the guide
    to the ghost ball and the object ball's line, the power meter; then the break spreading), `s2b-darts-oche-*-r2.png`
    and `s2b-darts-throw-*-r2.png` (behind the oche: the numbered board, two darts in the 20, the reticle swaying round
    the treble 20), `s2b-shuffle-slide-*-r2.png` (down the board, a puck on its way and one in the scoring end), each at
    844 x 390 (Low) and 1280 x 720 (HD); and `s2b-clip-*-r2.png`. The first round of shots (`s2b-shots-1.log`) showed the
    reticle off the board and your own head and back filling the darts and shuffleboard views: fixed (the matrix above,
    and the two cameras moved over the shoulder and ahead of your body).
  - `--only=budgets` (844 x 390; at each preset the five budget poses with a game of each kind set up, the pieces in
    play, then every item model at its cap): **16 of 16** (`s2b-budgets-2.log`). The pieces in play: 31 balls, 14 bands,
    5 discs, 5 sticks, 4 calls, 1.4k at Low and 4.7k at HD and Ultra; at the caps 6 calls, 5.7k and 13.9k. The pass
    (calls/triangles; at the caps; the sums' column) and the pass less the people and items (its row):
    - Low: door 72/92.4k (74/96.8k of 118/203.9k; less 65/69.3k of 74/101.4k), tv-east 79/100.6k, stall (outside)
      107/169.9k (of 139/244.3k; less 99/138.9k of 119/177.8k), patio 73/99.6k, overhead 75/98.5k (of 118/197.9k);
    - HD: door 73/113.5k (of 177/465.7k), tv-east 79/125.6k, stall 111/267.1k (of 176/449.5k; less 103/217.3k of
      139/328.2k), patio 85/155.0k, overhead 119/274.3k (of 222/609.4k); the whole frame 121 to 198 calls;
    - Ultra: door 84/153.1k (of 302/1,202.6k), tv-east 127/422.4k, stall 145/621.0k (of 246/1,086.4k; less 117/424.6k of
      159/611.4k), patio 123/507.3k, overhead 128/477.0k (of 302/1,180.0k); the whole frame 290 to 381 calls and up to
      1,612k.
    The staff are three now (the house player is the third): 3 calls and 21.8k at Low, 33.3k at HD and Ultra. The page's
    own CPU per frame at the poses was 1.5 to 12.3 ms (the machine loaded).
  - `node tests/sportsbar-sim.mjs`: 32 of 32, as before (`s2b-s2a-sim.log`).
  - S2a's page checks on the S2b page (`node tests/sportsbar-s2a.mjs --only=checks`): **22 of 22 passed**
    (`s2b-s2a-checks.log`): ordering, sips, watching, the jukebox and water, dancing, the screens, the items, the
    honesty and menu checks and the clip layer (which now probes the game clips too) all as before.
  - S1's groups on the S2b page (`node tests/sportsbar.mjs --only=data,honesty,shadows,memory --tag=s2b`): **37 of 37
    passed** (`s2b-s1-regress.log`): the frame, the street sets, the I-5, the trees, the front, the zones and slots,
    walking on the real grid, the lane path, the stalls, the darts' faces (a ray from each oche meets the face at 2.31
    m), tap to go from the customer side; the real name in none of the 176 files under `src/` or the built page, and no
    "live", odds, bet or currency word on any canvas or in the UI with every sheet open; at Ultra both pool spots' maps
    frozen and drawn once, and your avatar's caster dropping the sun's map by 11.8k in first and third person
    (`s1-shadow-ultra-third-lot-noon-s2b.png` looked at); and Low, HD, Ultra, HD, Low twice coming back to the same
    counts round after round (low 25 textures and 105 geometries at the start, one of each more than S2a's page: the
    house player; the second round adds 0 and 0).
- **Left open:** the pool stance and shot read as a lean over the table rather than a cue drawn back (written up for
  the design review queue in `PROJECT_OC_HANDOFF.md`); Watch pool, other people's games and the unwatched games'
  statistics wired to them (S3a); teams of 2 and invites (S3a); the games' sounds; keyboard and gamepad shots. (This
  entry also said the people seen from above the pool table were near black because Low has no real lights. That was
  wrong: it was your own avatar under the pool camera, at Low and HD alike, fixed in the repair above.)
  Frame rates on real phones were not measured.

## 2026-11-09: Stoppage Time S2a committed

S2a (needs, objects, ordering and the screens), with its repair after review, is committed on `claude/sports-bar`.
The second review kept it: the reviewer drove ordering four ways in a fresh Playwright session at 844 x 390 (table
food then a counter drink; a drink menu open then a table order; drink, food, drink, food at the counter; cancelling
and a stray pick) and every run ended with no orders left and the menu closed, with no console errors.

- Checks as measured in the entry below: `npx tsc --noEmit` passes; `tests/sportsbar-sim.mjs` 32 of 32;
  `tests/sportsbar-s2a.mjs` checks 22 of 22 and save, shots and clip shots 12 of 12; S1's groups on this page 65 of 65.
- Budgets: the items per instance and at their caps are within their rows (6 calls, 5.7k triangles at Low; 13.9k at
  HD and Ultra against 6.0k and 14.1k). The page is 1,509 KB (504 KB gzipped). Frame rates on real phones were not
  measured.
- Images: `tests/out/sportsbar/s2a-*-r2.png` (needs panel and strip at 390 x 844 and 844 x 390, radial menu, ordering,
  holding a drink, TV goal, guide, dance, clips sheet) and `s1-door-front-in-low-2100-s2a-r2.png`,
  `s1-shadow-ultra-third-lot-noon-s2a-r2.png`. Logs in `tests/out/sportsbar/logs/` (not committed).

## 2026-11-09: Stoppage Time S2a repaired after review

The review of S2a (one reject, one keep) drove the page and found four defects in the core loop that S2a's own 16
checks didn't catch, plus stale messages, a radial menu over the needs strip at 844 x 390, per-frame allocations and
smaller items. All are fixed in place on `claude/sports-bar`, uncommitted; what S2a did well is kept. `people/`,
`lot57/`, `src/onfoot/main.ts` and `index.html` are still untouched (`git status` on each empty). `npx tsc --noEmit`
passes. The page is 1,509 KB (504 KB gzipped), 7 KB more than S2a's.

- **What was wrong and what changed:**
  - **Ordering could lock itself for the visit.** Ordering a drink and then food at the counter left two orders
    "choosing" behind one menu; a picked item went to the first, whatever its kind; "Not now" dropped one; the other
    stayed forever, and `notHolding` with it. Now (`venues/sportsbar/life.ts`): only one order is ever choosing. A
    second order at the counter waits in the queue (its icon stays, stage `waiting`) until the open menu is answered,
    then opens its own; a server who arrives while a menu is open waits beside you. A picked item answers the open
    menu only if it's that menu's kind. "Not now" drops the order its menu was opened for. A menu sheet closed without
    an answer drops its order, and any order still choosing with no menu open is dropped the same frame. An unfinished
    order of a kind, or one queued, keeps that kind off the menu; an empty in your hand no longer does (it's set down
    when the next item comes), and with no table within 3 m a toast says once where it can go.
  - **"A match watched to the final whistle" could never complete on the big screen** or the screens that follow it:
    at the whistle's minute the big screen has already turned to highlights. The screen's channel is now taken just
    before the whistle (`channelAt`).
  - **Sip drank the whole glass at once.** `sip()` now does nothing while a sip's 2.4 s clip plays; the empty goes down
    after the last sip's clip.
  - **The schedule** paired teams slot by slot on their own (CGS v ARK three times on a Saturday, SFT four slots in a
    row, the same featured pair Friday and Saturday). Each day's pairings now come from a seeded round-robin
    (`engine/sim/tv.ts`, `pairings()`): 28 pairings for the eight teams, no pairing twice a day, no team in two slots
    in a row, and a featured pairing never the same as the day before's in the same league (in weeks 30 to 55 that
    took a second draw once in 52 such days). Each slot's own seed still draws the match.
  - **Sim time and the clock.** Setting the clock to the same reading twice didn't restart sim time (found by the new
    final-whistle check: the second run started 17 minutes late), and a clock set back left every absolute timer in
    the future (found by the new nudge check: the next sip was an hour away, so a drink stayed in hand). A set clock
    now always restarts sim time, and a jump keeps every timer's time left (the next sip, orders, an action's start, a
    dance, reservations, the moodlets' fading, the nudges' spacing).
  - **Messages.** A set clock takes toasts and captions down; a fast-forward takes them down at its start, and at its
    end any it raised whose time has run out in sim seconds.
  - **The radial menu** stays below the needs strip and above the map credit, measured after it's drawn.
  - **Allocations in the frame:** the clip layer's helpers and quaternions are hoisted to module scratch (no closures
    or quaternions per call); `drawItems` uses a member Euler and no array literals; the screens' channels are worked
    out once a sim minute (every kick-off and whistle falls on one) and the screen mesh's UVs only when the big
    screen's channel or the opening hours change; the heaters are a constant; `Moodlets.prune` and `hold` work in
    place; `stepOrders` doesn't copy; `Reservations.lapse` returns a reused buffer; `eventsBetween` fills a reused
    buffer (the broadcast has its own) and skips fixtures outside the span; the fixtures cache has a numeric key; the
    life layer's `doing()` and the page's clock object are filled in place. These are code changes; the allocation
    rate itself wasn't measured.
  - **Smaller items:** the server's walk time is its grid path over its pace; your reservations hold for the walk
    (its path at walking pace) plus 10 s, renewed if you're still walking when one lapses; the Cheer button shows
    after any moment, as the plan says (goals, big chances, touchdowns, field goals, big plays, final whistles), and a
    cheer counts as a team moment only for a score or a win; `clipTest` frees its test person's bone texture.
- **Checks** (headless Chromium with SwiftShader, one browser at a time; the machine at a load of about 10):
  - `node tests/sportsbar-sim.mjs`: **32 of 32 passed** (`tests/out/sportsbar/logs/s2a-r2-sim.log`), three new: the
    schedule over weeks 30 to 55 (182 days, 1,924 fixtures: no pairing twice in a day, no team in two slots in a row,
    no featured pairing repeated from the day before), the draw the same from a fresh schedule, and `eventsBetween` in
    time order from one reused buffer (164 events on a Saturday). With the new pairings, week 43's 49 Marigold
    matches average 1.69 goals and 4.37 big chances (the plan: about 2 and 4) and 25 gridiron games 2.40 touchdowns
    (2.5).
  - `node tests/sportsbar-s2a.mjs --only=checks --tag=r2`: **22 of 22 passed** on the final build
    (`tests/out/sportsbar/logs/s2a-r2-checks-3.log`; the first two runs, `-1` and `-2`, found the two sim-time faults
    above). S2a's 16 checks pass as before (the same decay, mood, jukebox, water, dance, watching, ordering, items,
    featured, highlights, honesty, menu, clip and HD numbers; the clip probe values are identical to S2a's), and six
    are new:
    - Order a drink then Order food at the counter: the drink menu opened with the food order waiting in the queue;
      wings picked on the drink menu changed nothing; after 30 s still one order choosing; the lime soda picked, the
      food menu opened; both delivered 2.5 sim minutes after the food was picked; once finished (the empties on the
      counter), the bar offered Order a drink and Order food again.
    - Not now on the drink menu dropped only the drink order and the food menu opened; Not now there dropped it; a
      food menu closed unanswered was dropped by the next frame ("menu closed"); both offered again.
    - Twelve Sip taps in a row: one sip (6 to 5 left); a tap 2 sim seconds later: none; 3 s later: one; with the clock
      set back an hour the automatic sips went on.
    - "Watch a match to the final whistle" drawn for the visit: watching the big screen from 20:11 to 20:27 (its
      channel 1 until the 20:25 whistle, highlights after) completed it, +5 tokens; the same on patio screen 1, which
      follows the big screen.
    - The low-need nudge: thirst from 30.05 under 30 showed "Thirsty: the bar's 3 m away"; setting the clock then
      left no toast and no caption.
    - The heaters: "Warm by the heater" +2 at frame (12.9, -2.6) at 21:00 (night 1), none at (17.0, -2.6), none by the
      heater at 13:00 (night 0). (The tired prompt and your team's goal-for and team-won moodlets were confirmed by the
      reviewer by hand; no check of their own yet.)
  - `--only=save,shots,clipshots --tag=r2`: **12 of 12** (`tests/out/sportsbar/logs/s2a-r2-shots-1.log`): saving
    round-trips and the page works with storage blocked; every S2a screenshot again with `-r2`; and two new at 844 x
    390 on Low, driven as the review drove it: a dance at Saturday 21:00 after a closed hour (the "closed · opens
    09:00" toast at 05:00) and a drink's hand-over, with no toast and no caption left; and the big screen's radial,
    its pills from 77 to 279 px, the strip ending at 50 and the credit starting at 333.
  - S1's groups on the repaired page (`node tests/sportsbar.mjs --only=data,walks,seats,cross,shadows,memory
    --tag=s2a-r2`): **65 of 65 passed**
    (`tests/out/sportsbar/logs/s2a-r2-s1-regress.log`, screenshots `*-s2a-r2.png`). Data: the frame, the near and far
    sets, the I-5 and the bridge rule, the trees, the front, the zones and slots, walking on the real grid (137 stand
    points, the worst 0.413 m; 11,641 cells reached, none in the lane or the flap), the lane path, the stalls (fill
    bias 0.834), the darts, tap to go from the customer side, the light streams and every street row, all as S1's.
    Walks: 1,000 random walks (500 tap to go, 500 stick; 1,068,196 positions over 25,822 m against 173 colliders)
    never ended inside a collider or crossed a wall, the patio fence or the party wall (1 tap had no path, 499
    arrived). Seats: tap to go reached all 91 seats and sat you down; sit and stand on each kind. Cross: at Low, HD and
    Ultra, walking out of the front and patio doors in first and third person flips the state on the crossing frame
    with only the listed swaps (front door, first person: step 49 of 162), and the door screenshots at 12:00 and 21:00
    (`s1-door-front-in-low-2100-s2a-r2.png` looked at). Shadows: at HD and Ultra your avatar's caster drops the sun's
    map by 11.8k triangles when turned off, first and third person, and Ultra's two pool spots' maps are frozen and
    drawn once outside. Memory: Low, HD, Ultra, HD, Low twice comes back to the same counts round after round (low
    24 textures and 104 geometries, then 52 and 105 after the first round's caches; the second round adds 0 and 0).
    That's 2 textures and 8 geometries more than S1's page at every step (S2a's screens, staff and items), and none is
    left behind by a switch, though S2a rebuilds the item meshes, the broadcast texture and both staff on one. So `tapScreen`'s routing to the radial menu first didn't disturb tap to go,
    walking or seating.
- **Screenshots, each looked at** (`tests/out/sportsbar/*-r2.png`): the needs panel and strip at 390 x 844 and 844 x
  390; at 1280 x 720 HD the bar's radial menu, the drinks sheet, holding a drink in first person (just after the
  hand-over, so the bartender's caption is current); the TV wall at the featured match's first goal (week 44, 20:03,
  Ridgeview Sundials 4': week 43's Saturday featured match, MSQ v HBL, now ends 0-0 with no goal, so the suite takes
  the next week with one and says so) with GOAL banners on three screens and no stale caption; the guide card for
  that Saturday (12:00 BLU v RVS, 12:30 SFT v PAL, 13:00 ARK v CGS, ...: no pairing twice, no team twice running);
  a dance at 21:00; at 844 x 390 the dance with the strip, chips and screens clear of stale messages
  (`s2a-dance-844x390-r2.png`), and the big screen's radial (Watch the game, Stand and watch, Dance) below the strip
  (`s2a-radial-big-844x390-r2.png`); each clip again (`s2a-clip-*-r2.png`, `s2a-clips-sheet-r2.png`), the same poses
  as S2a's.
- **Left open:** as S2a's entry, less the nudges, the heater and the final-whistle goal, which now have checks. The
  room is still empty but for the two staff while the chip says "Packed" (S3a). No phone run.

## 2026-11-08: Stoppage Time S2a, needs, objects, ordering and the screens (built and verified; uncommitted)

Phase S2a of `PROJECT_OC_SPORTS_BAR.md`, built on `claude/sports-bar` after merging Lot 57's committed P1b and P1c
(`claude/onfoot` 47c71a6; merge commit a5ac3fd, the only commit of this pass: `PROJECT_OC_PROGRESS.md` conflicted,
both entries kept; `npx tsc --noEmit` and `npm run build` passed on the merge). The S2a build itself is uncommitted, as
the workflow asked. Lot 57's files (`src/onfoot/lot57/`, `main.ts`, `index.html`) and `src/onfoot/people/` are
unchanged (`git status` on `people/` empty, checked by the suite); Lot 57's page still builds
(`npx vite build --config src/onfoot/vite.config.ts`, 1,172 KB). Everything on the page stays simulated and labelled:
the matches are fictional and seeded, every screen frame carries a SIMULATED tag, nothing costs money (house tokens
only, no price or purchase path anywhere), and the player's menu is alcohol-free.

- **First, the merge and the re-measure (O1).** Every row of "Lot 57's numbers" was read again at 47c71a6. **L17
  moved, and it broke the bar's page:** Lot 57's `Hud` now binds P1b's caption, reply chips, order and holding chip
  and order sheet (`caption`, `chips`, `reply0`, `reply1`, `status2`, `status2Text`, `order`, `orderTitle`,
  `orderWho`, `menuItems`) in its constructor without null checks, so S1's committed `sportsbar.html` would throw at
  `new Hud()` after this merge. S2a's page carries them (and uses the order sheet, the captions and the chip). L3 and
  L12 gained additive members (`ParkedCars.nearDist`, a give-way rule in Lot 57's page; `computeFree`'s optional
  people); every other row is unchanged, so no sum moved. Contracts: additive (`Player`'s `Goal` and `onArrive`, which
  S2a's queue uses; `Collider.see`; `Venue.counters`). `people/` unchanged since ab9fbe1, so O2 holds. The Retro module
  is still uncommitted (`style.ts` 9bfd9da822 in `tsu-modes`, also in a WIP snapshot on `origin/claude/wip-modes`, not
  on `claude/modes`). The plan's tables carry the moves.
- **What was built** (new: `src/onfoot/engine/sim/` rng, needs, objects, tv, leagues, broadcast, held, clips and
  tokens; `venues/sportsbar/` life, crew, menu and objects; `tests/sportsbar-s2a.mjs`, `tests/sportsbar-sim.mjs` and
  `tests/onfoot/sportsbar-blocklist.json`; changed: `venues/sportsbar/hud.ts`, `sportsbar.html`, and 17 lines of
  `venues/sportsbar/main.ts`, kept small and local for the parallel lane that makes it mountable; 2,641 lines of
  TypeScript in the new and rewritten modules). The page is now 1,502 KB (503 KB gzipped), 107 KB more than S1's:
  - **Needs, mood, moodlets, emotion, personality** (`engine/sim/needs.ts`), the plan's formulas term by term: the five
    shown needs and the NPCs' hidden bladder, the rates while doing things, the trait multipliers, mood = 20 + 0.6 x
    the weighted average + the moodlets, the moodlet table (fading linearly), and the emotion order.
  - **Smart objects** (`engine/sim/objects.ts`, `venues/sportsbar/objects.ts`): the catalogue's 41 adverts in 15 types,
    every placed object with its layout slots, reservations, and the action queue (up to 3; tap an icon to cancel;
    moving the stick cancels the walk). The pool tables, dartboards and shuffleboard are in the catalogue but not
    offered until S2b.
  - **Ordering** (`venues/sportsbar/life.ts`, `crew.ts`): at the counter (a bartender on the lane path makes a drink in
    4 to 8 s and hands it over; food goes to the kitchen, 60 to 180 s, and the server brings it) and table service at
    booths, high-tops and patio tables (the server sets off to arrive 30 + 60 x the crowd share seconds after the call,
    takes the order in 8 s, fetches it from the pick-up or the pass, brings it). Lot 57's order sheet shows our menu
    ("You drove here, so your drinks are alcohol-free. On the house."). You hold a drink in the right hand and food in
    the left (the corners of the first-person view); sips every 40 to 70 s (+7 thirst, 6 a drink), eating at +10 a
    minute until the basket is eaten; empties go on the nearest table and the server buses them. Two staff, in our
    night-violet polo with a lime trim, built by the people builder at LOD 1.
  - **The screens** (`engine/sim/tv.ts`, `broadcast.ts`, `leagues.ts`): both fictional leagues with their teams and
    colours, the channel windows and kick-off slots, the featured match and `gameNight` exactly as the plan's tables,
    the match models (Marigold chances, gridiron possessions), highlights (the previous match day's before a day's
    first final whistle and on Tuesday), the broadcast pictures (pitch, field, score bug, GOAL and TOUCHDOWN banners,
    half-time and full-time cards, up-next cards, the SIMULATED tag in every frame), the TV chip, the guide card with
    code-drawn crests and "Pick a side". **One deviation, for the budget:** the three channels are cells of one canvas
    texture, so the twelve screens are one mesh and one draw call (the venue's test-card batch is hidden; the calls
    are unchanged); Low draws 512 x 288 a channel at 8 Hz, HD and Ultra 1024 x 576 at 15 and 30 Hz.
  - **Watching** (x1.6 only while the featured match is in play on the screen watched), **the jukebox** (fun +6, 20 s,
    a toast naming a KFWY track; no audio yet), **the water station** (thirst +20, 15 s), **the dance spot** on game
    nights (you only; three dances, changing every minute).
  - **Held items** (`engine/sim/held.ts`): the six instanced meshes (glass, basket, disc, ball, band, stick),
    `frustumCulled = false`, casting into the sun's map only, lit by the interior's baked channel.
  - **The clip layer** (`engine/sim/clips.ts`): drink, eat, sway, two-step, arm pump, cheer, groan and clap as an
    external pose layer by bone name (and the staff's own wipe), with an upper-body overlay for seated people.
  - **The player's UI** (`hud.ts`, `sportsbar.html`): the needs strip (five rings with icons, the low word under a ring
    under 30, the mood face and the emotion), the needs panel (bars with the word and the number, the moodlets, the
    tokens and their label, tonight's three, "Saved on this device only"; two columns on a short landscape phone), the
    queue icons, the radial menu (up to six pills, keys 1 to 6, LB on the gamepad), the Cheer button for 8 s after a
    goal or touchdown, the tired prompt under 10 energy, a text size setting, the TV chip and the guide.
  - **Tokens and saving** (`engine/sim/tokens.ts`): 50 on the first visit, 1 per 5 minutes in the bar (at most 12),
    5 per goal of tonight's three; saved under `oc.onfoot.sportsbar.v1`, every access wrapped.
  - **Hooks:** `needs`, `setNeeds`, `setTraits`, `mood`, `use(objectId, action, item?)`, `queue`, `tv(day?, week?)`,
    `setWeek`, `setTimeScale`, `fastForward`, `tokens`, and for the suite `offers`, `held`, `orders`, `staff`, `items`,
    `itemsAtCap`, `catalogue`, `tvAt`, `tvFrames`, `clipTest`, `saveNow`, `radial`, `openNeeds`, `openGuide` and more.
- **Checks** (headless Chromium with SwiftShader, one browser at a time, the machine shared at a load of 5 to 8):
  - `node tests/sportsbar-sim.mjs` (no browser): **29 of 29 passed.** The decay over 10 sim minutes standing equals the
    formula at outgoing 0, 0.5 and 1 (hunger 62, thirst 54, fun 58, social 64, 60 and 56, energy 66); every rate while
    doing things; mood 80 at full needs, 20 empty, 57.35 at the seeded average (= 20 + 0.6 x 62.25), 44.51 after 20
    minutes alone (the plan: 44.5); the featured match each day; the same seeds giving the same fixtures from two
    schedules built apart; in week 43, 49 Marigold matches averaged 2.35 goals and 4.20 big chances (the plan: about 2
    and 4), 25 gridiron games 2.84 touchdowns (the plan: 2.5); gameNight and the x1.25 window; the blocklist (21 names
    against 552 entries, no match).
  - `node tests/sportsbar-s2a.mjs --only=checks` (1280 x 720, Low): **16 of 16 passed**
    (`tests/out/sportsbar/logs/s2a-checks-1.log`, and again on the final build, after the look fixes below:
    `s2a-checks-final.log`, 16 of 16). The page boots with no console errors. The needs decay at the
    table's rates through the page (every need within 0.01 of the formula at all three outgoing values). Mood 80 Happy
    at full needs; 57.35 Fine at the seeded average. The jukebox gave fun +4.6 over 1.5 min with the walk (+6 less
    the walk's decay); the water station thirst +17.6 (+20 less it). Dance offered at Friday 20:26, Saturday 21:00 and
    Saturday 01:59, not at Friday 20:24 or Thursday 21:00, and you dance. Watching: fun +8.00 in 2 min while the
    featured match was in play (x1.6), +5.00 for the 21:00 match (not featured) and +5.00 on highlights. A drink at the
    bar: the walk, the wait ("making"), the hand-over within 12 sim seconds, then thirst 40 to 57 in 2.5 min (3 sips).
    Food at a high-top: seated, the server came from 7.8 m to 0.8 m, the wings arrived after 3.5 sim minutes, hunger
    +9.2 in a minute. Items: per instance glass 19, basket 20, disc 16, ball 32, band 16, stick 12 at Low and 40, 44,
    31, 128, 32, 24 at HD and Ultra, every one within its row; no new mesh in the scene after ordering, holding and
    leaving empties. The featured match each day as the plan's table, x1.25 only inside its window (checked a minute
    either side of both ends), every other fixture not featured. Highlights: "Monday's highlights" on Tuesday,
    "Friday's" on Saturday at 11:00, "Today's" at 13:00. The same clock gave the same fixtures twice; 204 channel frames
    drawn, none without the SIMULATED tag and none with the word "live"; 1,689 canvas strings, none with "live" or a
    betting or currency word. The menu: 15 items, all alcohol-free, no price field; 41 adverts. The clip layer:
    `people/` untouched; each of the nine clips turned its bones at LOD 2, 1 and 0 (a LOD 0 built in 5.4 s here).
  - `--only=save` : **2 of 2.** Saving round-trips (a second page: visits 1 to 2, the team and the regulars' seed kept);
    with `localStorage` throwing, the page boots clean and plays, and keeps nothing.
  - `--only=budgets` (844 x 390, Saturday 21:00, the six item models at their caps, the two staff in the room): **17 of
    17.** At every pose and preset the pass is inside the sums' column and the pass less the people and items inside
    the "without people or items" row; the items are 6 calls, 5.7k at Low and 13.9k at HD and Ultra (rows 6.0k and
    14.1k); the staff 2 calls, 14.4k at Low and 22.0k at HD and Ultra. The passes: Low 73 to 108 calls and 89.4k to
    166.9k (stall the most); HD 74 to 120 and 111.4k to 272.2k (overhead the most); Ultra 85 to 146 and 151.0k to
    618.9k (stall). The page's simulation took 0 to 0.1 ms a frame (`stats().simMs`; S3a's crowd isn't there yet).
    (`tests/out/sportsbar/logs/s2a-budgets-2.log`; every row is in `tests/out/sportsbar/sportsbar-s2a-checks.json`.)
  - S1's `honesty` and `closed` groups re-run on the S2a page (`node tests/sportsbar.mjs --only=honesty,closed`): **7 of
    7 passed** (`tests/out/sportsbar/logs/s2a-s1-regress.log`): no real name in the 169 files under `src/` or the page,
    no "live" outside the two allowed negations in 78 UI strings and 128 canvas strings, the closed-hours doors.
    S1's budgets check now subtracts the staff and the items with your avatar (they are people and items, which its
    row leaves out); S2a's own budget sweep above covers the same rows. S1's other groups weren't re-run in this pass.
- **Screenshots** (each looked at): the needs panel open at 390 x 844 and 844 x 390 (`s2a-needs-panel-*.png`; at 844 x
  390 the first try scrolled to its button and hid the bars, so the panel now has two columns there and opens at its
  top) and the strip (`s2a-needs-strip-*.png`); at 1280 x 720 HD the radial menu on the bar (Order a drink, Order food,
  Watch the bar screens) with the bartender behind the counter (`s2a-radial-bar-1280x720.png`), the order sheet
  (`s2a-ordering-1280x720.png`), holding a drink in first person (`s2a-holding-drink-first-1280x720.png`; the cup was
  made smaller and lower after the first look); the TV wall at the featured match's first goal, Saturday of week 43
  at 20:16 (Saltflat Terns, 12'), with GOAL banners on the big screen and the two channel-1 screens beside it
  (`s2a-tv-goal-1280x720.png`), and the guide card (`s2a-guide-1280x720.png`); a game-night dance at Saturday 21:00
  (`s2a-dance-1280x720.png`, the arm pump, the drink in the raised hand). Each clip on your avatar
  (`s2a-clip-*.png`, `s2a-clips-sheet.png`).
- **The clips, looked at (O33).** Cheer (arms up in a V) and arm pump read clearly; clap reads (the hands meet a little
  high, at the face); drink and eat bring the hand up to the chin (the first try only reached the chest: the sip now
  rises over 0.8 s in absolute time, and the elbow comes further forward); sway and two-step read only in motion (a
  still shows arms bent in front). Groan reads as hands behind the head more than hands on the head, with too little
  bow: shipped, and written up in `PROJECT_OC_HANDOFF.md` for the design review queue with the two dances.
- **Left open:** no audio yet (the jukebox's music, the room, the broadcast bed); the Watch camera drift; the
  first-visit "Tap people and things" hint; the autonomy setting (it needs S3a's utility AI); the player's team
  moodlets, the heater's +2, the low-need nudges and the tired prompt are built but no check exercises them; the
  people-dependent parts (chat, Lean and chat, cheering with others, rounds, three of tonight's goals) wait for S3a and
  S3b; Low still draws standard materials until the Retro module lands (S4); nothing has run on a phone.

## 2026-11-08: the venues in the game: drive to Lot 57 or Stoppage Time, get out, walk, drive away (claude/venues-in-game)

- **Reviewers' outcome: kept by the play and code reviews (2026-11-09).** After fix r1 the play review drove to Lot 57 (ramp 1142) and Stoppage Time (ramp 124) at 390 x 844 touch, got out, walked, and drove away by each venue's own Car then Drive, back on an on-ramp at 0 mph and merging at 62-63 mph; three Stoppage Time round trips held one host, heap 104 MB, programs 57, hosts 0; 844 x 390 and 1440 x 900 also checked; no page errors.
- **Review fix r1 (2026-11-09): Stoppage Time had no way back in.** The reviewers played both venues from the artifact
  page at 390 x 844, 844 x 390 and 1440 x 900: Lot 57 did what the owner asked, Stoppage Time did not. The bar offered
  Drive only within 1.8 m of the car door, but you get out 1.94 m from it and Car's walk ends 2.05 m from it, so Drive
  never appeared (in the game or on the bar's own page), and the game's Drive on is hidden on foot. The earlier claim
  below that "the venue's own Drive" was proven for both venues was wrong: the suite and the proof frames had called
  `window.__game.drive()`, not the button. Fixed:
  - `src/onfoot/venues/sportsbar/main.ts` line 471 (one line, the sports-bar lane edits this file too): `nearCar` is
    now within 2.6 m. Drive is offered where you get out (1.94 m) and where Car's walk ends (2.05 m). The standalone
    page, probed at 390 x 844 touch: spawn ["Drive"] at 1.94 m; inside the front door [none] at 36.84 m; tap Car, then
    ["Drive"] at 2.05 m; a tap on Drive gives its own-page toast ("...Driving out comes when it joins the game."); no
    errors. `node tests/sportsbar.mjs --only=seats,honesty`: 8 of 8 pass.
  - The suite's `venues` group now drives away the way a player does: right after Get out it asserts the venue offers
    Drive where you stand; after the walk it taps Car (`#car`), runs the walk ahead with the venue's sim, waits for the
    venue's HUD to put Drive on `#act`, taps it, and checks you're back on an on-ramp at 0 mph with the venue gone. The
    round trips go back the same way, and the phone check taps Drive on instead of calling the hook.
  - The round-trip geometry check was flaky (the reviewers' run: 215, 215, 405; mine before the change: the same). A
    probe of 5 trips showed the game renderer's count steps up once by about 185, on whichever trip back its first
    frames draw scene objects not drawn before (the scene graph itself grew by 6), and then holds flat: 220, 220, 405,
    405, 405, while a second probe of 4 get-outs stayed at 220 throughout. The renderer's count is a high-water mark of
    the scene's geometries it has drawn, so the check now reads the game's scene graph (distinct geometries, at most
    +16 from trip 2 to 3; no venue object left in it) and that the renderer holds no more than the scene has (+24),
    with textures and programs as before.
  - The phone part of the group booted a second game beside the first, still drawing; it timed out twice (300 s, then
    600 s) at a load average of about 20. It now runs in a context of its own after the first closes.
  - `tests/venues-shoot.mjs` taps Get out (phone) or clicks it (desktop) instead of calling the hook, then taps Car and
    Drive, shoots the Drive button by your car, the cockpit back on the on-ramp, and the car after a 40 s cruise. Frames
    carry `-r1`.
- **r1 results (2026-11-09, load average 13 to 20 from other lanes).** `npx tsc --noEmit` and
  `npx tsc --noEmit -p tsconfig.game.json` clean. `npm run build`: dist/artifact.html 4,868,737 bytes (the same size as
  before the fix: 1.8 and 2.6 are the same length), 5 chunks folded in, only artifact.html marked owner-test. Standalone
  builds: dist/onfoot/index.html 1,207,092 bytes, dist/sportsbar/sportsbar.html 1,428,999 bytes.
  - `npm test -- --only=boot,race,phone,progression,venues`: **49/50 passed**; the one failure was race's "racing slowly
    ends Too far behind" (a 10 s wait timed out under load; the group untouched by this work), which passed on a rerun of
    `--only=race` (7/7). Earlier r1 runs: 46/48 (the round-trip geometry flake and the phone boot timeout, both fixed
    above; also once the owner-test check read the chip as "Owner mode Â· test build": dist/artifact.html has no charset
    meta, since the artifact host adds the shell, so Chromium opening it from disk sometimes guesses Windows-1252; it
    passed on the other two runs; the marking is another lane's and was not changed).
  - The venues lines: Lot 57 parked on ramp 1142 at 276 m after 89 s of Auto-drive; ready in 31.1 s, 0 game frames on
    foot, 27 people, standing 0.55 m from the door with Drive on offer; walked 60.7 m to the bar and ordered; Car walked
    you to 0.57 m, Drive (76 x 76) tapped: on the ramp to CA-57 North (path 233) at 4 m, 0 mph. Stoppage Time parked on
    ramp 124 at 285.7 m after 90 s; ready in 57.8 s, 0 game frames, standing 1.94 m from the door with Drive on offer;
    walked 34.9 m in through the front door (indoors); Car walked you to 2.05 m, Drive tapped: on the ramp to I-5 North
    (path 1101) at 4 m, 0 mph. Three Lot 57 round trips, each back by the venue's Drive: heap 174.6 MB before, then
    169.2, 169.5, 169.6 MB; game renderer geometries 215/215/215 (scene graph 548/548/548), textures 92/92/92, programs
    57/57/57; the venue's renderer at ready 164 geometries and 96 textures each time. Phone (own context): prompt
    168 x 48 "Park at Lot 57"; Get out 168 x 52, focused; Drive on 127 x 52; a tap on Drive on: on the ramp to CA-57
    North. No page errors.
  - **The replay** (`node tests/venues-shoot.mjs`, the artifact page with the viewport meta injected, 390 x 844, touch,
    DPR 3; then 844 x 390 and 1440 x 900): Stoppage Time: tapped Get out ([Drive] offered at 1.94 m), walked in through
    the front door (indoors, 36.84 m from the car), tapped Car (2.05 m, [Drive]), tapped Drive: on the ramp to I-5 North
    (path 1101) at 4 m, 0 mph, no venue styles left; a 40 s cruise: I-5 North main road at 59 mph. Lot 57 the same way:
    Get out ([Drive] at 0.55 m), into the yard by a group (27 people, Lively), Car (0.55 m), Drive: CA-57 North on-ramp
    at 0 mph, then CA-57 North main road at 59 mph. Desktop 1440 x 900 by click: Lot 57 back to CA-57 North (59 mph after
    the cruise), Stoppage Time back to I-5 North (60 mph). No page errors on either page.
  - Frames (tests/out/venues/, each looked at): `phone-stoppage-5-drive-by-your-car-r1.png` (third person by your red
    car in the bar's lot at night, Drive on the action button, the chip and the credit on screen),
    `phone-stoppage-6-back-on-the-ramp-r1.png` (cockpit, 0 mph, "To I-5 North"), `phone-stoppage-7-merged-r1.png`
    (61 mph on I-5 North, gantries ahead), `phone-stoppage-4-inside-r1.png` (pool tables, booths, the bar),
    `phone-stoppage-2-arrival-r1.png` ("Drove Anaheim Way to Stoppage Time · street driving isn't built yet", Get out /
    Drive on), `phone-lot57-5-drive-by-your-car-r1.png`, `phone-lot57-6-back-on-the-ramp-r1.png`,
    `phone-lot57-7-merged-r1.png` (62 mph on CA-57 North), `phone-landscape-844x390-getout-r1.png`, and the desk
    `-r1` set (`desk-stoppage-5-drive-by-your-car-r1.png` and the rest), 24 in all.
  - Still true: Stoppage Time's chip says "Simulated crowd · Lively" while S1 has no people yet (its S2 brings them).

- **The owner (2026-11-08, about 2:40 PM PT):** "Wait so is everything connect now? Like can I drive OC ultra and then go
  to either sports bar?" (not yet: they were separate pages), then "keep going and rendering and dont stop, lets finish
  this by tonight as soon as possible". Built: phase 3a of PROJECT_OC_ON_FOOT.md and J1 of PROJECT_OC_SPORTS_BAR.md,
  with the fade. Real surface-street driving (3b, J2) is still a later phase, and the game says so.
- **Destinations.** "Lot 57" and "Stoppage Time" are places in the Go to sheet (a Places row above the freeways) and on
  the World Map's Places tab (with Navigate to while driving). `navigateTo('Lot 57')` routes to ramp 1142 (CA-57 South,
  Orangewood Avenue); `navigateTo('Stoppage Time')` to ramp 124 (I-5 North, Disney Way / Katella Avenue), from the
  freeway-link files (another of the venue's exits if the default can't be reached). The corner-map route, the lane
  hint, the chevrons and Auto-drive work unchanged; the card names the exit and the venue ("Keep right for Orangewood
  Ave exit to Lot 57", destination "Lot 57"), and the route carries on down the ramp.
- **Arrival** (`src/game/venues.ts`, `Game.arriveVenue`). On any of the plans' ramps (Lot 57: 1142, 1264, 562;
  Stoppage Time: 124 and 791 to 573), route or not, in Free Drive: 80 m before the ramp meets the street (where the data's
  terminal projects onto the ramp; on 1142 and 562 that is mid-ramp, at 356 m and 410 m), or on a tap of the "Park at
  Lot 57" prompt shown on those ramps, the screen fades for about a second and the car is parked: the game stops
  driving, the toast says "Drove Orangewood Ave to Lot 57 · street driving isn't built yet" (State College Blvd from
  1264; "Drove Anaheim Way to Stoppage Time ·…", Katella Ave from the I-5 South exit), the same words stay above the
  controls, and Get out and Drive on replace the pedals (52 px tall, labelled buttons; Get out takes the keyboard focus).
  Auto-drive arriving this way hands back in the same toast ("Auto-drive off: you have control").
- **Get out** (`Game.getOut`, `src/game/onfoot.ts`). A fade; the game's loop stops (no rAF, no frames drawn: the suite
  counts 0 game frames on foot), its sound is suspended and its input detached; the venue's code loads (a dynamic
  import) and mounts in the page: you stand by the driver's door in first person with your car (its model and paint,
  the hypercar included) in your stall, the venue's own HUD, loading screen, controls and hooks (`window.__onfoot`).
  Lot 57 has everything its page has (tap to go, Sit, Order, Join, Leave, the people); Stoppage Time its S1 venue and
  avatar. The clock follows the game's time (a preset's hour today, or Live); the quality maps Low to Low, High to High
  (Stoppage Time's HD), Ultra to Ultra, Medium to Low on a touch screen and High on a desktop.
- **Drive.** The venue's own Drive (at the driver's door; Car walks you there; at Stoppage Time only since r1, above) or
  the car's Drive on: a fade, the
  cockpit, the engine, and the car on the nearest on-ramp back to the freeway (preferring the one onto the freeway you
  left by) at 0 mph, with a toast ("On the ramp to CA-57 North · street driving isn't built yet"). The venue is disposed
  completely: its frame loop stops, the listeners it put on window and document come off, the people, parked cars and
  composer are disposed, every geometry, material and texture in its scene is released, the renderer is disposed and its
  context dropped, `window.__onfoot` goes, and the game's stylesheets come back. On foot the game's UI (pause, the
  radial menu, Menu, Garage) is hidden and cleanly unavailable; the venue's own pause works.
- **Architecture.** `src/onfoot/embed.ts` (new): `mountPage` and the `Embed` (track listeners, release, stop). Each page's
  main now exports `mount(host, { car, paint, quality, clock, reducedMotion, onDrive, html })` returning `{ ready,
  dispose }`; the standalone pages boot through the same `mount(document.body)`, and keep their own Vite configs. The
  diff in `src/onfoot/main.ts` and `src/onfoot/venues/sportsbar/main.ts` is small (+28/-9 and +31/-9 lines: the options,
  `track(() => new Hud())`, a `dead` check in the loop, the Drive hook, a cleanup block, the exported mount). In the game
  the page's index.html goes into a host div with its own style, and the game's stylesheets are switched off while it's
  up (the two share class names such as `.panel`). The venues' code is three dynamic chunks (979 KB); `vite.config.ts`
  no longer inlines dynamic imports and trims the venues' map slices with their own plugins; `scripts/single-file.mjs`
  folds every chunk into the page (each a function in a second module script, run on its first import; the
  owner-test marking unchanged), so the single file still opens from disk with the venues in it.
  **dist/artifact.html: 3,828,392 bytes before, 4,868,737 after** (limit 16 MB).
- **Repairs the merge needed (venue internals, minimal):** Lot 57's `mats.ts` read `P.mats.facade`, which the live
  game's props no longer have (W1 buildings): the block's buildings fall back to Lot 57's own tilt-up texture (one line;
  the standalone page threw at load in this merge). Stoppage Time's page lacked the ids Lot 57's P1b/P1c HUD binds
  (caption, chips, order sheet): added as one hidden div in `sportsbar.html` (its page threw "reading 'addEventListener'"
  at load in this merge). Both cars lists accept `oc-hyper`.
- **Hooks:** `__game.venue()` (id, name, phase parked/leaving/foot/returning, ramp, street), `__game.getOut()`,
  `__game.drive()`, `__game.arriveVenue()`, `__game.routeName`; `window.__onfoot` while on foot.
- **Checks: a new suite group `venues`** (tests/regression.mjs): both venues end to end, three Lot 57 round trips with the
  JS heap (with gc) and the game renderer read after each, and the phone layout of Get out in a 390 x 844 context.
- **Suite (before r1; its Drive steps called `window.__game.drive()`, not the venue's button, so they did not prove
  the venue's Drive):** `npm test -- --only=boot,race,phone,progression,venues`: **50/50 passed** (2026-11-09 01:25,
  load average about 16 from other lanes). The venues lines:
  - Lot 57: 89 s of Auto-drive, parked on ramp 1142 at 276 m; ready in 31.8 s, the game drew 0 frames on foot, low, 27
    people, clock Sun 19:30, standing 0.6 m from the driver's door; walked 60.7 m (straight line) to the bar, Order opened
    the sheet, ordered an agua fresca (making); Drive: on the ramp to CA-57 North (path 233) at 4 m, 0 mph.
  - Stoppage Time: 99 s of Auto-drive, parked on ramp 124 at 285.6 m; ready in 40.6 s, 0 game frames, 0 people (S1);
    walked 34.9 m to the front door and in (indoors: true); Drive: on the ramp to I-5 North (path 1101) at 4 m, 0 mph.
  - Three round trips: heap 174.1 MB before, then 169, 169.7, 169.8 MB; game renderer geometries 215/405/405 (the first
    trip back brings in traffic models not drawn before, then flat), textures 92/92/92, programs 57/57/57; the venue's
    renderer at ready 164 geometries and 96 textures each time. No page errors.
  - Phone 390 x 844: prompt 168 x 48 "Park at Lot 57"; Get out 168 x 52, focused; Drive on 127 x 52; no pedals.
  - (The first run of the new group found a 22-carriageway count in the phone group's Go to check, from the places
    row's class: renamed; and its own walk timing: fixed.)
- **Standalone pages:** both build (`dist/onfoot/index.html` 1,207,092 bytes, `dist/sportsbar/sportsbar.html` 1,428,999
  bytes; still no exports in the inlined script, so Lot 57's worker trick holds). `node tests/onfoot.mjs --only=portrait`
  3 passed, 0 failed; `node tests/sportsbar.mjs --only=seats,honesty` 8 of 8 pass. Note: `npm run build` empties dist/,
  so build the venue pages after the game.
- **Proof frames** (tests/out/venues/, read one by one; phone frames from dist/artifact.html with a viewport meta
  injected, 390 x 844, touch, DPR 3, Sunset, Low): `phone-lot57-1-route.png` (the route on the corner map, "1.0 mi Keep
  right Orangewood Ave…", Lot 57 on the card, AUTO), `phone-lot57-2-arrival.png` (parked, the words and Get out / Drive
  on), `phone-lot57-3-by-your-car.png` (third person by your car in the lot, the yard behind), `phone-lot57-4-inside-people.png`
  (in the yard by a group of regulars), `phone-lot57-5-back-on-freeway.png` (cockpit on the CA-57 North on-ramp, 0 mph),
  `phone-stoppage-1-route.png`, `phone-stoppage-2-arrival.png`, `phone-stoppage-3-by-your-car.png`,
  `phone-stoppage-4-inside.png` (inside the bar: pool tables, booths, the bar), `phone-stoppage-5-back-on-freeway.png`;
  `phone-landscape-844x390-getout.png`; desktop 1440 x 900: `desk-1440x900-getout.png`, `desk-lot57-1440x900.png`,
  `desk-stoppage-1440x900.png`. No page errors on either page (shoot-log.txt).
- **Known limits:** in the game Lot 57's patio bodies are built on the main thread (its page's worker reruns the page's
  own script, which the game's can't be), so Get out takes about 20 to 40 s in SwiftShader; the venue loading screen shows
  the progress. Your parked car isn't saved in the profile yet (a v2 migration for profile.ts's owner). Stoppage Time has
  no people until its S2.

## 2026-11-02: GPS "follow it": route on the corner map, lane hints, Auto-drive (claude/gps-follow, r4 kept by the play and code reviews)

- **Reviewers' outcome: kept by the play and code reviews.** tsc and build exit 0; a 390x760 drive took a hand-off
  by hand, Auto-drive engaged in 1 frame, steer and brake handed back (gas did not), and it arrived with 0
  collisions; Race offers no Auto-drive.
- **The owner (2026-11-01, about 7:20 PM PT): "Also make it where you put navigation on the gps to follow it"**, and
  chose both: the route drawn to follow by hand, and an Auto-drive button that drives it, with steer or brake handing
  the car back.
- **What it does:**
  - The corner map draws what is left of the route with an arrow at the next hand-off and the distance on a pill. It
    zooms in as the hand-off nears. With no route it still shows the road you are on in yellow, as before.
  - From 2 mi out, the guidance card shows a lane hint, with the lanes the hand-off leaves from lit.
  - The Auto-drive button appears only with a route in Free Drive. Steering or braking (keys, touch or pad) hands
    the car back; gas alone does not. It stays in reach when the Minimal HUD tucks the icons away: with the controls
    on a phone, and on a desktop at the rail's right edge above Pause's chip (r3; before, the desktop rail tucked it).
- **Review fixes (r2):**
  - **Desktop guidance card:** every item now has its own grid cell, so the hint no longer pushes the sign into the
    arrow column.
  - **Phone on its side (844 x 390):** the lanes moved to the right end of the destination line, so the sign is
    whole again. It had been cut to "CA-55 NO...".
  - **Missed hand-off:** a hand-off missed on the road you are still on now triggers a new plan. This applies to the
    guidance at 4 Hz and to Auto-drive when it is switched on. With no way from here, the destination is kept and
    Auto-drive hands back.
- **Review fixes (r3)**: the second review rejected r2 only because its own new suite check failed on a quiet
  machine (phone group 12/13):
  - **Cause:** the AUTO tag waited for the next 0.1 s HUD tick. The check counted 3 frames, which held a tick only when
    frames ran 33 ms or longer.
  - **Fix in the game:** `Game.navNow()` sends the HUD and redraws the corner map on the next frame. It runs whenever
    Auto-drive flips (`setAutoDrive`, the arrival hand-back in `followRoute`) and whenever a route is set or cleared
    (`navigateTo`, `setRoute(null)`, which start, attract and race entry go through).
  - **Fix in the check:** "follow the route" now waits on the state it reads: the map's `routeDrawn`, the button, the
    lit lanes, and the AUTO tag with the button's `aria-pressed`. It no longer counts frames. It also asserts that AUTO
    is up at each size before measuring.
  - **One toast:** turning Auto-drive on with no way from here now plans before switching on, so it says "No way to X
    from here" once. Before, a second "No way from here: Auto-drive off" came first.
- **Review fix (r4):** the third review passed the phones and found one desktop problem.
  - **Problem:** at 1440 x 900 with the lane hint up, the turn word was cut to "KEEP RIG..." whenever the distance read
    in feet, which is the whole final approach.
  - **Cause:** the distance line kept 64 px clear for the lanes, but 5 lane marks are only 37 px wide.
  - **Fix (styles.css, desktop only):** the room now follows the lane count. The marks are 8n - 3 px wide for n
    lanes, and the word stops 7 px short of them: 44 px for up to 5 lanes, 52 px for 6, 60 px for 7.
  - **New suite check (progression group, desktop):** "desktop 1440 x 900: the guidance card keeps the turn word whole
    beside the lane hint, in feet". It sets the route, fast-forwards to 1 km before the hand-off and waits for the
    desktop layout, lit lanes and a distance in feet. It then requires `.hud-nav-dist span` scrollWidth <=
    clientWidth + 1, the word clear of the lanes, and a laid-out card (a paused game hides the HUD, so every width
    would read 0). It also sets Keep right, Keep left and Continue beside "5280 ft", with 5 lanes and with all 7, and
    restores the card afterwards.
- **Verified in r4** (4 cores; other lanes' Playwright ran between my runs, load 3 to 7):

  | Check | Result |
  | --- | --- |
  | `npx tsc --noEmit`, `npm run build` | exit 0, exit 0 |
  | `npm test -- --only=phone` (started 19:26) | **13/13**, 439 s. "follow the route": map accent pixels 0 to 2332 (656 route points); lanes 2 of 5 lit, "Keep right"; HUD cover unchanged at 390 x 844 (13.6 %), 390 x 760 (15.1 %, controls from 77.6 %) and 844 x 390 (11.8 %, cluster to 28.5 %); steer drag and BRAKE each took over |
  | `npm test -- --only=race,progression` (started 19:34) | **16/17**, progression 881 s. The new desktop check passed: "3200 ft Keep right" with 5 lanes, 78/78 px, 26 px clear of the lanes; every word whole beside 5280 ft with 5 and 7 lanes. The one failure was race's "racing slowly ends Too far behind", a 10 s wait for the results screen under load. This branch does not touch it |
  | `npm test -- --only=race` rerun (20:00) | **7/7**, "Too far behind" at P4 after 184 s |
  | My own drive at 1440 x 900, Free Drive, route to CA-55 North | "Keep right" whole (78/78 px) at 1.7 mi, 4860, 3190, 2640, 1550, 840 and 420 ft; 26 to 38 px clear of the 37 px lanes; the sign whole. With Auto-drive on: HUD cover 12.1 %, no overlaps, no small targets |
  | The card's words beside "5280 ft" and "10.2 mi", 2 to 7 lanes | 36 of 36 whole: Keep right 78 px, Keep left 70 px, Continue 62 px; the closest is 10 px from the lanes (Keep right with 7) |
  | Phone 390 x 760 (viewport-meta copy, DPR 3) and 844 x 390, Auto-drive on at 2650 ft | Unchanged, because the fix applies only to the desktop layout. Sign whole; lanes "00011"; no overlaps or small targets; the corner map up at 808 m (the Minimal wake), so the cover reads 16.0 % and 12.7 % with it |
  | Page errors | None in any context |

- **Frames (r4):** tests/out/gps/ d1-r4-1440x900-auto, d1-r4-card (1490 and 1420 ft, "KEEP RIGHT" whole beside the
  lanes), d2-r4-1440x900-2600ft, d2-r4-card, d3-r4-card-7lanes-forced (7 marks forced on, still whole),
  p1-r4-390x760-lanes and l1-r4-844x390-lanes; not committed.
- **Verified in r3** (4 cores; no other lane's Playwright was running when each suite run started; load 0.5 at the
  phone run's start and 2.4 at the race/progression run's start, 8 and 4.8 at their ends):

  | Check | Result |
  | --- | --- |
  | `npx tsc --noEmit`, `npm run build` | exit 0, exit 0 |
  | `npm test -- --only=phone` | **13/13**, 473 s. "follow the route" passed in 78.9 s: map accent pixels 0 to 2363 (656 route points); lanes 2 of 5 lit, "Keep right"; AUTO on; HUD cover unchanged at 390 x 844 (13.6 %), 390 x 760 (15.1 %) and 844 x 390 (11.8 %); steer drag and BRAKE each took over; cleared. The budget check read 10.3 %, 12.1 % in the app and 9.2 % |
  | `npm test -- --only=race,progression` | **16/16** (race 51 s, progression 650 s). "owner test build" passed this time, so the known base timeout did not occur |
  | HUD tick held 5 s away (`hudT = 5`), then the toggle, at 480 x 320 | AUTO tag and `aria-pressed` agree 2 frames after on and after off (twice each); a cleared route drops the button in 2 frames. Before the fix this waited for the held tick |
  | No way from here (the network's route stubbed for one call) | `setAutoDrive(true)` returns false with one toast: "No way to CA-55 North from here" |
  | Desktop 1440 x 900, Minimal, tucked | View, Go to and Radio hidden off the edge; Auto-drive visible at the rail's right edge (x 1286 to 1426) above Pause's chip (x 1382 to 1426) |
  | 844 x 390 with Auto-drive and the lane hint | Sign "CA-55 North" 97/97 px; no page errors in any context |

- **Frames (r3):** tests/out/gps/ p1-route-map-r3, p2-lane-hint-r3, p3-auto-on-r3, p4-arrived-r3 (390 x 760, DPR 3),
  d2-r3-1440x900-minimal-tucked and l1-r3-844x390; not committed. Arrival under Auto-drive from 900 m before the
  exit took 61 s sim: I-405 North, CA-55 South ramp, CA-55 North. It handed back with no button and no AUTO tag.
- **Verified in r2** (headless Chromium, SwiftShader, viewport-meta copy of dist/artifact.html):

  | Check | Result |
  | --- | --- |
  | Desktop 1440 x 900 at 1.7 mi | Sign whole on its own row; card identical with and without the hint |
  | Phone on its side 844 x 390 | Sign 97/97 px |
  | HUD cover with lanes and AUTO | Unchanged: 15.1 % at 390 x 760, 11.8 % at 844 x 390 |
  | Auto-drive switched on 770 m past the CA-55 exit | Replanned at once and arrived on CA-55 North by I-405 N, CA-22 E and CA-55 N: 39 km, 1273 s sim, 0 collisions |

- **`npm test -- --only=boot,race,phone,progression`** at load 16-19 on 4 cores: 33/35. Every check this branch adds
  or touches passed. The two failures are load timeouts in untouched checks:
  - "owner test build": a 300 s click;
  - "sky camera": a 240 s frame wait.

  The reviewer saw the same failures. The quiet-machine run then failed the new check on timing; r3 fixed that
  (above).
- **Frames:** tests/out/gps/ (p1-route-map, p2-lane-hint, p3-auto-on, p4-arrived, p5-auto-mid, p6-takeover,
  d1-1440x900, l1-844x390); not committed.
- **Status:** r2 was not accepted because the new check failed on a quiet machine (phone group 12/13), and r3 fixed
  that. r3 was not accepted because the desktop card cut the turn word beside the lane hint, and r4 fixed that. The r3
  and r4 fixes are uncommitted on claude/gps-follow, awaiting review.

## 2026-10-22 (13:45 UTC): physics landed (dt-independence); the owner asked for a pause once tasks complete

- **The owner (13:38 UTC): "Take a pause once tasks are complete."** The work in flight finishes and lands if judged
  keep: the live integration, the face/eyes judge, and this physics landing. Nothing new starts: hair, body and the
  Retro finish wait. A watcher stops overdrive round 2 if it reaches hair or body. When the in-flight work is done, the
  hourly task and the Sunday check-in are switched off.
- **Landed `fable/physics` on `claude/hypercar`** as e1c2270 (2 commits, `src/game/vehicle/Physics.ts` only). The judge (Opus)
  returned keep and reproduced every claim byte for byte.
  - **What changed:**
    - A step longer than 1/120 s now runs as equal 1/120 s steps with the controls held, so a 60 Hz caller gets the
      120 Hz car. Measured 60 against 120 Hz: 0-60 within 0.37 % (was 2.94 %), 0-100 0.22 % (1.08 %), quarter mile
      0.10 % (0.55 %), top speed 0.00 %, 100-0 0.11 %, lateral g 0.000 g, catch time within 9.8 % (the scripted driver
      decides at 60 Hz).
    - A barrier grind costs per second, not per step. 240 against 120 Hz, the barrier's share of the speed lost is
      within 0.4-3.0 % in the judge's harder press (base: up to +99 %).
  - **In the game nothing changes for a player:** the game always steps at exactly 1/120 s, a path the judge proved
    bit-identical. The value is that the model now meets the dynamics design's dt-independence requirement and protects
    any future caller at another rate.
  - **The judge's guards** (f00ae9f, by the coordinator):
    - a non-finite step is ignored, and a long one is capped at 12 steps (`step(Infinity)` used to loop forever);
    - a landing counts as a fresh barrier touch.

    Both are bit-identical at 120 Hz.
  - **Verified on the merged build:**

    | Check | Result |
    | --- | --- |
    | `node tests/dynamics.mjs` | 1742 passed, 0 failed; the JSON byte-identical to the judge's and to before (sha256 e28f83e5) |
    | `--hz=60 --only=perf,drift` | 1163 passed, 13 failed, byte-identical to the judge's (base: 31 failed). The 13 are harness artefacts |
    | survival | 7/7 |
    | race | 6/6 |

    The 13 harness artefacts: the 60 Hz kTop sampling aliases on the rev limiter (8 top-speed rows with tops equal to
    120 Hz's), plus driver-rate checks.
  - **Not done:**
    - **Plan item 1** (an implicit lateral/yaw step, which takes the low-speed yaw snap from 2,651 to 166 deg/s², under
      the tyres' 558 ceiling) is built but not committed: it fails 82 Sim catch checks. That's the owner's call (see the
      handoff's "Decisions waiting").
    - **Harness fixes for the tests lane:**
      - the advisory rows print `[object Object]`;
      - kTop should be sampled per 1/120 s;
      - a car travelling backwards reads a drift angle of 0.
    - The audit's step-cost label was out by 1,000: the model costs about 0.018 % of one core, not 21 %.

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
- **Republished** the test build (version 9, from fbb60a7).
- **Not yet merged into `claude/always-on`, on purpose.** A trial merge conflicted in `Game.ts`, `settings.ts`, `App.tsx`,
  `HUD.tsx`, `styles.css` and three docs. The two branches split at 9cdcf07. Since then, always-on's 18 game commits are
  all in the live server's code by patch, except decision 16 (`PROJECT_OC_DECISIONS.md`). That code reaches this branch
  only through `integrate/live`, a plain commit, so git can't see the overlap. Resolving now would either undo
  always-on's live work or repeat the integration's work by hand. The merge was aborted. It happens right after
  `integrate/live` lands: game files resolve to this branch's versions, decision 16's lines are kept, and the diff outside
  `top-speed-ultra/` stays empty.
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
## 2026-10-22: the live build republished (version 8): the store, the other session's homes, story, errands, phone and Settings, and the OC Hypercar drivable out of the box

Kept by three reviewers (nothing of ours dropped; nothing of theirs dropped; the hypercar playable and the unlock safe): the store merge 9068c23 (origin/claude/store 7a5a856, test mode only), the merges e7bdeed and 6eb5592 (origin/claude/hypercar up to 388cfa2: Settings in sections, the radial menu, the phone and radio card, clothes and nails, garage tabs and wheels, nine fictional homes, five fictional characters and their errands, weekly simulated meets), the Settings-rail fix 10efc6b, and the owner test build unlock 8d7af7e and 8370506 (the owner asked at 9:40 PM PT on 2026-10-21 to make sure the hypercar is playable on their end). The unlock: scripts/single-file.mjs marks only dist/artifact.html of a test-mode build (`data-build="owner-test"`), and settings.ts turns owner mode on for each visit to a marked page while CONFIG.live is false; a live-mode build is never marked and ignores the mark; #owner=0 or the Settings toggle turns it off. Suite: boot, race and survival pass, phone 8/8, progression 7/7 (with the new owner test build check). Browser proof at 390x844 and 1440x900 (tests/out/live-merge-3/): a fresh profile and a saved owner:false profile both open in owner mode; the OC Hypercar drives in Free Drive on its Unleashed tune (grip 1.3) and in Time Trial on its race tune (grip 1.04); the starter stays the Rossini GT; no console errors. Published as version 8 of https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV at 13:30 UTC (6:30 AM PT) and pushed to local/live-preview. Reviewer's non-blocking note: while the test build forces owner mode on, a later change to any other setting saves owner:true on that device. Next: the condensed HUD and the seat-view fix from the owner's two phone screenshots (2026-10-21, about 10 PM PT).

## 2026-10-21: the live build republished with the other session's home screen and HUD

The judged merge 60788f5 (origin/claude/hypercar ba4f99f into local/live-preview) was kept by both reviewers (nothing of either side dropped; tsc clean; build 3,519 KB; boot 6/6; the other suite failures were frame timeouts under load, one of them reproduced on the pre-merge build). Published as version 7 of https://claude.ai/artifact/3RkEetQBRvcm3dpNeVwMgV at 15:59 UTC (8:59 AM PT) and pushed to local/live-preview. Reviewers' non-blocking notes: the reduced-motion list misses one idle-HUD icon, the no-backdrop-filter fallback covers fewer panels, and the World Map opens over a menu that stays focusable underneath. Next in this worktree: the kept store commit 7a5a856 and the other session's 19 newer claude/hypercar commits, as one more judged merge.

## 2026-10-22: the owner test build: the OC Hypercar drivable out of the box (`local/live-preview`)

The owner (2026-10-21, 9:40 PM PT): "make sure the hypercar is playable on my end." `npm run build` now marks only
`dist/artifact.html` (the private test link) as the owner test build (`<div id="root" data-build="owner-test">`,
`scripts/single-file.mjs`); `loadSettings` then turns owner mode on for the visit even where the device saved it off,
so the OC Hypercar has a Drive button in the garage with no setting to find and no `#owner`. Never marked when
`VITE_OWNER_TEST_BUILD` is "false" or `VITE_PAYMENTS_LIVE` is "true" (checked: both print "unmarked"); the game also
ignores the mark when the store is live (`CONFIG.live`). `#owner=0`, or the Settings toggle, turns it off for that
visit; the Settings row says "This test build turns owner mode on", the garage chip "Owner mode · test build". The
starter stays the Rossini GT; `dist/top-speed-ultra.html` (and so the suite) is unmarked.

- Suite, `--only=boot,race,survival,progression,phone` on the merged build: 34/35; the one failure was the new check's
  own harness (a second load on the same URL was only a fragment change); fixed, progression rerun 7/7, the new check
  included (saved owner:false → on, hypercar picked; `#owner=0` → off). The merge itself broke nothing in these groups.
- Browser proof on `dist/artifact.html` from disk, 390 x 844 and 1440 x 900 (`tests/out/live-merge-3/`), no page or
  console errors, no failed requests:
  - fresh profile, no hash: owner mode on, five cars listed, the hypercar's Drive button selects it (`oc-hyper`);
    Free Drive: car `oc-hyper`, the Unleashed chip, computed top 341 mph; 15 s of game time on full throttle with the
    autopilot steering through moderate traffic: 0 to 154 mph in 8 s, top 154 (phone) and 171 mph (desktop);
    Time Trial: still `oc-hyper`, no Unleashed chip, computed top 234 mph (the race tune);
  - saved settings `owner:false`: owner mode on for the visit (the saved value stays false), Drive on the hypercar;
  - `#owner=0`: off, the hypercar listed as "Founder Edition · not on sale yet (test build)", no chip.
  - Note: `artifact.html` has no viewport meta (the host adds the document shell), so opened from disk at phone size
    it lays out at 980 px and scales down; the phone frames show that, not the published page's phone layout.

## 2026-10-22 (merge): `claude/hypercar` up to 388cfa2 into the live build (`local/live-preview`)

Brings the homes (Lifestyle: nine fictional homes in real OC neighbourhoods, credits only, extra garage slots, start
from home), the five story characters on the phone (Messages, Contacts, jobs paid at run end), the six timed errands
to real exits, the weekly simulated meets in Messages, the freeway signs spec (`docs/specs/`) and the panels' Done bar
fix. The Retro render (RS1) is on `retro/port` and the online board on `claude/live-server`; neither is on
`claude/hypercar` yet, so neither is in this build. Five files conflicted (rerere had no resolution for them); every
side was kept:

- `App.tsx`: the menu stays the glass sheet with the Drive dock (ours); the hypercar side's rail rows were carried into
  it: Lifestyle (was "Roadmap") opens the homes, and a Phone row with the unread count. Lifestyle's homes are a screen
  of their own over the menu, like the store, the World Map and the phone (`inSheet` leaves them out). The garage
  keeps the store's slot count (`slotsUsed`) with the hypercar side's slots from homes and its wording. The Homes
  screen sits before the loading screen, which stays last.
- `HUD.tsx`: our navigation and destination cards stay; the hypercar side's errand line uses the same guidance chip
  when no route is set (with a route the nav card has it); the errand clock in Free Drive's third slot came in clean.
- `Game.ts`: the HUD state carries both: ours' compass, clock, nav and destination fields and theirs' `errand`.
- `package.json`: the store's `store:sync` and `store:check` and theirs' `test:story`.
- `PROJECT_OC_HANDOFF.md`: both Fable queue items (the vehicle dynamics prompt and the freeway signs spec).
- `profile.ts` (merged clean, one fix): selling a home checks `slotsUsed`, so a store-only car (the Founder Edition)
  takes no slot there either, as in `buy`.
- Checked: `npx tsc --noEmit` clean; built; the menu, Lifestyle and the phone looked at at 1440 x 900 and 390 x 844,
  no page errors.

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

## 2026-10-21 (merge): `claude/hypercar` into the live build (`local/live-preview`)

The live build now has both lines of UI work: the U0-U2 passes (the glass sheet with the Drive dock, the adaptive HUD
with compass, clock chip and Minimal auto-hide, the navigation and destination cards and road chevrons) and the ice
reference work (per-car atmospheres, driver colours, the Look setting, the Ultra grade, the cinematic menu hero, the
World Map, the hypercar's live display). Where both sides restyled the same thing, the hypercar side's design was
kept and the U0-U2 parts were rebuilt on its tokens: the menu is the hypercar side's rail, player card and mode cards
inside the sheet, with the dock (Drive, Settings, Bests, Profile) at the foot of the rail in place of its rail
buttons; the road chip is the guide sign with the route shield, with the nav and destination cards beside it. The OC
sunset tokens stay defined (the GT's atmosphere and the store read them).

- Checked: `npx tsc --noEmit` clean; `npm run build` wrote `dist/artifact.html`.
- Suite, `--only=boot,race,survival,progression,phone`, on a machine at load 40-50 on 4 cores: 29/34. The five
  failures were all Playwright timeouts waiting for rendered frames, a screenshot or a click (one frame took 41 s).
  Rerun: race 6/6. Ultra Realism timed out the same way on the pre-merge build (5/6 there). With the timeouts raised
  in a scratch copy of the suite (no assertion changed), progression 6/6 and phone 8/8 on the merged build.
- Frames (1280 x 720, Low, day, `tests/out/live-merge/`): `menu.png` (the GT's sunset, the cinematic hero, the rail
  and dock, the four mode cards) and `drive.png` (the driver's seat at 66 mph on I-405 North with a route to CA-55
  North: nav card, destination card, compass, clock chip, mode plate, speed block, icon rail, round map, chevrons).
  No page errors; the HUD panels' boxes do not overlap; read by eye.

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

## 2026-10-21: ST1, the Founder Edition SKU finished in test mode, and the catalog check accepts a car's own wheel (branch `claude/store`, committed)

This pass continues from the edits on disk (the two entries below, 33 changed files) and from an ST1 attempt earlier
the same night. That attempt made the checker change and the Ultra flag, then stopped when the machine restarted. Its
logs are `tests/out/store-st1-*.log`; its suite run, at a load of 35 to 40, failed on a screenshot timeout and then on
a closed browser. Nothing is committed or merged. `hypercar-founder` stays `available: false`, so nothing in this
branch can charge anyone, in test mode or live.

**The catalog check and the hypercar's wheel.** The live preview (`local/live-preview`, which holds `claude/hypercar`)
adds `'multi'` to `WheelStyle` in `src/preview/car-wheel.ts` for the OC Hypercar (`wheel: 'multi'` in `car-shape.ts`).
The old checker wanted the store's wheel styles and that type to be the same list, so the preview's suite failed with
"wheel styles twin5,five,cl10,aero differ from car-wheel.ts twin5,five,cl10,aero,multi". `tools/store-check-catalog.mjs`
now checks three things:

- Every store style (`cosmetics.json` `wheel_styles`) is in the type.
- A style in the type that the store doesn't list is valid only while a car in `car-shape.ts` wears it as its factory
  wheel (a car-only style), and no paid wheel setup may use it.
- A style no car wears and the store doesn't list fails: a style forgotten in `cosmetics.json`, or a dead one in the
  code.

It reads `src/preview/`, where every lane keeps these files today, or `src/game/vehicle/` if they move. This pass also
makes the factory-wheel match accept a `wheel:` that ends its line or object (`wheel: 'multi' }`); the type's own line
still doesn't count. `cosmetics.json`'s note and the checker list in `PROJECT_OC_MONETIZATION.md` say the same.

**The Ultra flag (decision 15).** `claude/modes` (read at `1af99e2` with its uncommitted RS1 edits) has no Ultra
entitlement yet. This branch defines it the way the Founder Edition's car is defined: `ULTRA_ENTITLEMENT =
'graphics-ultra'` and `ultraUnlocked({ owner })` in `src/store/entitlements.ts`. It's an entitlement only the server's
webhook could grant, read with `has()`, and owner mode and any test-mode build unlock it. No sku grants it and it has
no price, so nothing can sell it. The id is `graphics-ultra`, not `ultra`, because `settings.ts` already uses `ultra`
for Ultra Realism (the level-5 tunnel vision). One line in `PROJECT_OC_HANDOFF.md`'s Opus queue tells RS2 to read it.

**The store's suite under load.** Three changes in `tests/regression.mjs`, in the store group only. No assertion
changed.

- The store group holds the game's frame loop while it checks the store's UI. `holdGame` cancels the game's
  `requestAnimationFrame` through `window.__game`, and `resumeGame` starts it again. At a load of 45 to 50 (nine
  headless browsers on four cores), the game drawing behind the panel made a screenshot run past 240 s and a click
  past 120 s. With the loop held, the store-opening check took 76 s instead of 286 s at the same load.
- The Founders Sunset check makes the menu's two clicks with the loop held. It runs the loop until the chase camera
  has drawn six frames, then holds it again for the shot and for "Share run" (the run card is a 2D canvas of its own).
- The store group's screenshots and the run card's download get the frames' allowance (`FRAMES_MS`, 240 s) instead of
  120 s and 90 s.

**One layout fix.** The previous attempt's `Price` in `Store.tsx` puts the test-mode notice under every price. That
makes a narrow item card wrap the price under the name, where it sat mid-card at 1280 and 390. `.store-pricebox` now
keeps it at the card's right edge (`margin-left: auto`).

**Verified** (2026-10-21, load average 33 to 50 from the other passes; logs in `tests/out/`, `st1b` names):

- `npx tsc --noEmit` is clean (`store-st1b-tsc.log`, the final files). `npm run build` is clean
  (`store-st1b-build2.log`, the final files). The bundle holds no `sk_`, `rk_`, `whsec_` or service-role key and no
  "nothing is scored".
- The checker (`store-st1b-check.log`):
  - `npm run store:check` passes on this branch: 22 skus, 11 available, 45 entitlements, 4 store wheel styles, and the
    server copy in sync.
  - On scratch copies, 11 of 11 came out as expected. These pass: this branch's catalog with this branch's code; with
    the live preview's `car-wheel.ts`, `car-shape.ts` and `cars.ts` ("car-only multi"); with those files moved to
    `src/game/vehicle/`; with `multi` also listed as a store style; and with the hypercar's wheel written last on its
    line.
  - These fail: a style no car wears; `multi` left in both types after the hypercar stops wearing it; a paid setup
    using `multi`; `multi` listed but missing from this branch's type; `aero` removed from the type; and the hypercar
    sku `available: true` with its grants still `build`.
  - The ten planted catalogs from 2026-10-19 (the $4.99 exception, the founder window, exclusives, numbering) behave
    as before: 10 of 10.
- `node server/supabase/tests/serial-webhook.mjs` passed 24/24 (`store-st1b-webhook.log`). That includes "a refund
  retires No. 0001, clears it from the row and takes the car back", "a retired number is never reissued: the next sale
  is No. 0003", and the three cases the review reproduced: one live number per player, a refund before its
  completion, and a refund racing the numbering both ways round.
- `server/supabase/tests/run-local.sh` ran as the postgres user (`store-st1b-rls.log`). Both migrations ran twice.
  Every player and anonymous write or call on 0001's and 0002's tables and functions was refused. A refund retires the
  number and clears it from the row.
- The Ultra flag (`store-st1b-ultra-flag.log`) was checked on esbuild bundles of `entitlements.ts` in a scratch folder,
  with fetch refused. A test-mode build unlocks it with no grant. A live-mode build doesn't, unless owner mode is on or
  the account holds `graphics-ultra`. No request was made.
- `npm test -- --only=boot,progression,store` on the final build (`store-st1b-suite3.log`, 33 min at a load of 44 to
  50): boot 6/6, progression 5/5, store 16 of 17. The one failure was the Founders Sunset run card: the "Share run"
  click ran past 120 s with the game drawing behind the result screen. That check then got the hold described above,
  with only the test file changed and the same build. After that, `npm test -- --only=store` passed **17/17** in
  1123 s at a load of 49 to 50 (`store-st1b-suite4.log`).
  - Two earlier runs on the way: `store-st1b-suite.log` hit two screenshot timeouts and two click timeouts before the
    hold, and was stopped by hand. `store-st1b-suite2.log` passed 27/28; the run card's 90 s download wait failed.
- Screenshots, each one looked at:
  - At 1280 × 720: `store-1280x720.png`, `store-hypercar-1280x720.png` and `store-items-1280x720.png`.
  - At 390 × 844: `store-390.png`, `store-hypercar-390x844.png`, `store-items-390x844.png` and
    `store-checkout-390.png`.
  - Also `store-hypercar-card-1440.png`, `store-checkout-1440.png` and `store-founders-sunset-chase.png`.
  - Every price has "Test mode · nothing is charged" right under it, and the wrapped prices sit at the card's right
    edge. The suite measures this: all 12 prices at 1440, 1280 and 390, and the checkout sheet's price at 1440. The
    hypercar card says "Coming soon", "No pre-orders" and "Sold until Dec 31, 2026", with no quantity and no "never
    again".

**Not run here.** Anything that needs the owner's accounts: a real Supabase project (its Auth, PostgREST and
row-level security under Supabase's own roles), the Edge Functions deployed on Deno, and Stripe test-mode Checkout with
real webhook deliveries. The serial test runs the real `stripe-webhook` code with its types stripped by Node. It runs
against Postgres 16 behind a small stand-in for PostgREST, and it answers Stripe's refund and session calls itself.
`run-local.sh` uses a stub of Supabase's roles and `auth.uid()`. This pass didn't run the render group; the render
line in the 2026-10-19 repair entry below comes from that run's own log.

**For the merge with the live preview.** The store files there are this branch's committed `bb798e0`, except
`src/game/profile.ts`, which will conflict. The live preview's `buy` and `sell` refuse `oc-hyper` by id, and this
branch refuses any store-only car (`storeOnly`) and keeps it outside the slot count: keep both. The store suite's sell
check accepts either message ("can't be sold for credits").

## 2026-11-09: P1d committed (Lot 57 at maximum graphics)

Committed the kept P1d repair r2: three presets (retro Low, realistic HD, Ultra with GTAO, capped bloom, MSAA 4x,
4096 soft shadows, 16x anisotropy, window mirror), new `look.ts`, `retro.ts`, `surfaces.ts`, `dress.ts`, `sky.ts`,
`glass.ts`. Final build md5 52b703d72fde498a1e5ed2d14ab4d816. Art review re-checked: `npx tsc --noEmit` clean; on dist
at 390x844 touch, Low drew 110 calls / 220,338 triangles (inside 250k), Ultra 611 calls / 3.66M triangles, no console
errors; walk(0,1,3s) moved 8.65 m. Screenshots: `tests/out/onfoot/*-p1d.png`, `onfoot-p1d-compare-*.png`,
`review-p1d-r2-390-{low,ultra}-sat21.png` (not committed; tests/out and dist stay out of git). Details below.

## 2026-11-09: Lot 57 on foot, P1d repair r2

The reviewers kept P1d's code and its retro Low but sent it back on the look (art) and on reporting and robustness
(code). This pass makes each fix they listed; it was told not to commit. Unchanged: the game's code (`src/game`,
`src/ui`), its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts`, the people builder
(`src/onfoot/people/`), `src/preview/` and `Physics.ts` (checked with `git diff --stat 47c71a6` on those paths: empty).
`main.ts` changed in two small, local places for the parallel venues-in-game lane: `Look` is given `env`, and three
test hooks (`textures()`, `groupTris(name)`, `aoView(on, tune)`). Four builds of `dist/onfoot/index.html`, which
differ only in Ultra's bloom (`tests/out/onfoot/logs/p1d-r2.md5`). The sweep ran on 5030dff01fecf0971a192206af5a9200;
its Ultra night shots showed square haloes round the near bulbs (a bulb's emissive is many times white, and its
saturated edge, blurred through the bloom's short separable kernels, took their square shape). A narrower radius
(886dd6033ff44c95980f30062efae468, the build the suite ran on) didn't cure it; dropping the bloom's coarse levels and
raising its strength to 0.8 (f2de9f2eb08466fbd91347268c314751) turned the lit pylon into a white blob at night. The
final build, 52b703d72fde498a1e5ed2d14ab4d816, caps what goes into Ultra's bloom (at 1.4, keeping its hue) with a
strength of 0.5 and radius 0.5 at night (HD: 0.34 and 0.55, uncapped): round haloes and a readable pylon. Every Ultra
Saturday 21:00 shot was re-shot on it at both sizes and the names check run again. Ultra's golden-hour and noon shots
were not re-shot, so their bloom is the first build's (its threshold rises with the daylight, to 4.5 at noon, so by
day it spreads little; at golden hour the lit bulbs may still show the old haloes). Low and HD don't take this code
path, so their shots and the suite stand.

- **Ultra set apart from HD** (`lot57/look.ts`, `lot57/glass.ts`):
  - GTAO strong in the contact areas: three's defaults (and P1d's 0.5 m) left only the table legs dark; now a 2 m
    reach, no fall-off along a sample's path, the occluders taken as 6 m thick, the result raised to 2.2. Checked with
    the new `aoView('raw' | true)` hook: under the tables and benches, at the Shed's base and under its hoods.
  - After dark while open: four string-light spots (was two) casting shadows, hung from the spans nearest a point
    7 m ahead of you (P1d's nearest-to-you put their pools behind the camera), narrower cones (pools, not a wash),
    85 cd x night; the strings' baked light on the yard turned down to 60% for the frame and the painted pools under
    the strings and heaters up 2.2x, for the contrast between a pool and the dark round it; a stronger bloom at
    night (strength 0.5, threshold 0.72, its input capped: see the builds above).
  - Reflections in the Shed's glass: a planar mirror (three's `Reflector` with our glass shader: a Fresnel term over
    the panes, 512 px, no MSAA, drawn at most once a frame and kept out of GTAO) for the tank-room window and the four
    roll-up doors' glass when they're down, all in the Shed's yard-wall plane.
  - The people: rim x2.1 and fill x1.7 on Ultra (HD x1.1 and x1.05) through a new gain uniform (`mats.ts RIM_GAIN`,
    `crowdview.ts withFill`).
  - The grade: a little more contrast and mid-tone colour on Ultra.
- **Mountains with form, every preset** (`lot57/sky.ts`): the ring is rebuilt as three ranges one behind another (the
  far one keeps Environment's crest exactly, so the sun still sets behind the same ridge; the nearer two stay under
  it), lit by the sun's direction and colour and the sky, with ridged relief in the fragment shader (seamless round
  the compass), darker gullies, and haze graded by range and by height (feet deeper in it). Banded in the retro look.
  Still drawn without fog and kept out of GTAO. About 5k triangles (was 512).
- **Low at night**: no cloud deck once it's dark in the retro look (it showed as brown-grey smudges); by day its clouds
  are a crisp cut of a blurrier level of the texture (rounded shapes, not the noise's ragged edge).
- **Umbrellas' undersides** (`mats.ts CANOPY`, set each frame): the sun through the canvas and the paving's bounce by
  day, the strings' warm fill after dark, added to the canopy's back faces (and a third of it to the outside: canvas
  is translucent); the patio umbrellas' valance a lighter teal (it read as a black band in shade).
- **Golden hour golden**: the sweep's golden clock is now the hour the page's sun is nearest 5 degrees up (found on the
  page each run: Saturday 16:18 this week, sun 5.01 degrees), not 15:50 (10 degrees). The visible sky warms toward
  the horizon and the clouds go amber while the sun is low, and the sun and sky light are warmed for the frame
  (Environment's own colours put back after it), on every preset.
- **Low's budgets**: your own car on Low has plain wheels (the food trucks' Low tyre and rim, scaled) in place of
  the garage wheels: 62,158 to 35,102 triangles (`groupTris('your-car')`). Low's tiling surfaces are packed into
  512 px atlas pages (four 240 px tiles each with wrapped borders; the toon shader repeats a tile itself and samples
  with capped gradients): 22 surfaces into 6 pages. The two pool textures are one. Canvas textures the visible scene
  uses on Low (the new `textures()` hook): 42 before, 25 to 27 now, 7 or 8 of them over 512 px (the signs' text
  atlas, the cloud deck, the trees' leaf cards, the business park's lit windows, your car's lamps and badge). **The
  plan's 12 is still not met.**
- **Code**: `stats().look.passes` names each pass itself (the build minified the class names); `Toon` re-converts a
  mesh whenever it wears something that is neither its toon nor a material already found unconvertible (WeakMaps, not
  userData); leaving Low puts back each mesh's own earlier `castShadow` (kept in `userData.lowNoCast`); `Toon.sync`
  walks a kept array; `placeSpots` uses plain loops and a partial insertion sort, no allocation; Low restyles only what
  the renderer drew unstyled last frame (from its own draw list) instead of walking the scene every 20 frames; a spot
  moved to a new span draws its shadow map that frame. The pylon's cabinet glows a little less at night (its art
  washed out under bloom).
- **Checked**, headless Chromium with SwiftShader, one browser of ours at a time on a machine other lanes were loading
  (load average 13 to 19). Every screenshot named here was looked at.
  - `npx tsc --noEmit` clean. The real venue's name is in nothing under `src/onfoot` or in `dist/onfoot/index.html`.
  - **The sweep** (`tests/onfoot-p1d.mjs`, now with `--detail=sign,gate,trucks,glass` shot at golden hour and Saturday
    21:00): east, shed and lawn at golden hour, Saturday 21:00 and noon, plus the sign, gate, trucks and glass views
    at golden hour and 21:00, at Low, HD and Ultra, at 390x844 (touch) and 1280x720: 102 shots,
    `tests/out/onfoot/onfoot-<size>-<view>-<preset>-<clock>-p1d-r2.png`. No console errors or warnings
    (`tests/out/onfoot/logs/p1d-r2-390.log`, `p1d-r2-1280.log`).
  - **Sheets** (`tests/onfoot-sheets.py`, Pillow): P1c | P1d | r2, a row a preset, for each view and clock
    (`onfoot-p1d-r2-compare-<size>-<view>-<clock>.png`); HD | Ultra (`onfoot-p1d-r2-hd-vs-ultra-<size>-...`); the
    detail views (`onfoot-p1d-r2-detail-<size>-<view>.png`).
  - **stats() at each preset**, over the 17 shots of each in the sweep (calls, triangles, the people's calls; frame ms
    is `stats().frameMs`, the CPU's part, at the shot, with the largest of the four frames sampled before it):

    | Preset | 390x844 | 1280x720 |
    | --- | --- | --- |
    | Low | 57 to 100 calls, 117k to 201k tris, people 0 to 6; 1.4 to 5.7 ms (32.5) | 76 to 129, 164k to 221k, people 0 to 6; 2.2 to 5.7 ms (32.5) |
    | HD | 83 to 184, 180k to 508k, people 0 to 21; 2.7 to 10.8 ms and once 131.1 (133.3) | 126 to 197, 315k to 513k, people 0 to 24; 3.6 to 14.5 ms (85.7) |
    | Ultra | 156 to 616, 0.39M to 3.57M, people 0 to 56; 5.5 to 22.5 ms (55.2) | 279 to 739, 1.33M to 4.24M, people 0 to 90; 6.2 to 64 ms (500.4, one sample) |

    Ultra's seven Saturday 21:00 shots at each size, re-shot on the final build (`p1d-r2-ultra21-390.log`,
    `p1d-r2-ultra21-1280.log`, no console errors): 390x844 198 to 607 calls, 0.86M to 3.56M triangles, 5.8 to 16.1 ms
    (41.6); 1280x720 342 to 711 calls, 2.12M to 4.36M triangles, 6.7 to 24.6 ms (24.6). The table's Ultra column
    includes the sweep's own night shots, since replaced.

    Low and HD are inside the plan's Low and High budgets in every shot (Low: 150 calls, 250k triangles, 16 for the
    people; High: 350, 700k, 24). Ultra has no budget in the plan; it is heavier than P1d's (four spots, the mirror,
    the mountains). Drawn start to finish (`timeFrames(3)`, median, east view; software rendering on a machine loaded
    to 13 to 19, so only the presets' relative cost): 390x844 Low 288 to 405 ms, HD 1.0 to 1.3 s, Ultra 3.9 to 4.5 s;
    1280x720 Low 1.1 to 1.4 s, HD 4.2 to 4.8 s, Ultra 7.9 to 10.6 s. Canvas textures in view: Low 25 to 27, HD and
    Ultra 51 to 53. `stats().look.passes` in the built page reads, on Ultra: "scene (render), MSAA 4x", "ambient
    occlusion (GTAO)", "bloom (UnrealBloom)", "output (tone map, sRGB)", "grade (vignette, split tone, golden hour)";
    on Low: "scene", "retro (tone map, ink, sky bands, palette, dither)".
  - **What the shots show**:
    - HD | Ultra at 390x844, east view, Saturday 21:00 (`onfoot-p1d-r2-hd-vs-ultra-390x844-east-sat21.png`): a
      difference you see at once: on Ultra a pool of light on the paving under the strings and round the heater with
      darker paving round it, the left-hand table in shade, a little more contrast; round haloes on the bulbs. At noon in the shed view
      (`...-shed-noon.png`) the difference is smaller: the ground under the picnic tables and benches darker, a
      touch more contrast and colour; Ultra's reflections show in the glass view
      (`onfoot-p1d-r2-detail-390x844-glass.png`: the string lights in the tank-room window at 21:00).
    - The mountains have form at golden hour on every preset: lit rock ridges and darker gullies, rose-tan, hazier
      to their feet and with distance (`onfoot-p1d-r2-compare-390x844-lawn-golden.png`, P1d's cream cut-out beside).
    - Golden hour reads golden: warm light and long shadows, a warm horizon and lit clouds, also looking east.
    - Low by night: a clean black sky with stars, no smudges (`onfoot-390x844-east-low-sat21-p1d-r2.png`,
      `onfoot-390x844-shed-low-sat21-p1d-r2.png`).
    - The umbrellas' undersides are cream in shade, not black, on Low and HD (`onfoot-390x844-shed-low-golden-p1d-r2.png`).
    - The detail: the pylon's neon at night, the trucks' lit serving windows and awnings, the gate with the fictional
      "On tap" menu board, a bike rack at the edge of the gate view.
  - **The Phase 1 suite, on the final build**: `node tests/onfoot.mjs --only=crowd-phone,walks,names --suffix=-p1d-r2`,
    16 of 16. Its first run was stopped by this session's own two-hour limit on the chained job after the four walks
    checks had passed (`tests/out/onfoot/logs/onfoot-p1d-r2-suite-walks.log`: 1,000 random walks against 504
    colliders, none ending inside a collider, off the walkable area or through a wall; 454 of 454 tap-to-go walks with
    a path arrived; its two crowd "fails" there are the browser closing under it, not results); the crowd and names
    groups were run again on their own, 12 of 12 (`onfoot-p1d-r2-suite2.log`). Low within budget in all 24 views at
    each phone size: worst 135 calls and 233,409 triangles at 844x390, 119 calls and 234,429 triangles at 390x844 (P1d:
    246,845 and 248,029; the margin is now about 6%), the people at most 13 and 16 calls. The people's CPU: median 0.4
    and 0.3 ms, 90th percentile 0.6 and 0.5 ms, worst single frames 2.5 ms (844x390) and 93.9 ms (390x844) on this
    loaded machine. Facing as drawn and the names checks pass.
- **Not done, or short** (candidly):
  - The Low texture budget (12 at 512 px): 25 to 27 canvas textures in view, 7 or 8 over 512 px. Getting to 12 means
    folding in textures this page doesn't paint (the game's cloud deck and business-park windows, the car's lamps,
    badge and wordmark, the trees' leaf cards) or dropping them on Low.
  - At noon, Ultra over HD is modest in the shed view (above); the mirror covers the Shed's yard-wall glass only (the
    forecourt's storefront glass and the sawtooth glazing still reflect the sky map).
  - The gate view on a phone is narrow: the bike racks are at its edge.
  - Nothing ran on a real phone or GPU: frame rates, including Low's at the higher pixel ratio with its shadow pass
    and full-screen retro pass, are not measured.

## 2026-11-08: Lot 57 on foot, P1d: maximum graphics, three presets (not committed)

P1d of `PROJECT_OC_ON_FOOT.md` Phase 1: Lot 57 as good as the browser allows at the owner's three presets (2026-10-21:
"let's just stick with 3"), Low inside the plan's phone budgets. Not committed: this pass was told not to commit. These
are unchanged: the game's code, its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts`, the people
builder (`src/onfoot/people/`), `src/preview/` and `Physics.ts`. Build `dist/onfoot/index.html` md5 in
`tests/out/onfoot/logs/p1d.md5`.

- **The presets** (`setQuality('low' | 'hd' | 'ultra')`; `'high'` and `?quality=high` still select HD; the pause
  menu's Graphics row reads "Low · retro", "HD", "Ultra" with a line saying what each is). How each frame is drawn is
  the new `lot57/look.ts`; `main.ts` only calls it (its composer code moved there). The edits to `main.ts` are small
  and in place (the preset's name, the calls to `look`, three hooks, your driver's shadow on Low), for the parallel
  venues-in-game lane; whether they merge cleanly is for that merge to show. `tests/onfoot.mjs` changed in one line
  (the check after Ultra to High accepts the name `hd`).
  - **Low, the retro look** (`lot57/retro.ts`): full resolution (pixel ratio up to 2, was 0.85 x and at most 1),
    every lit material swapped for a cel-shaded toon one (a lit side, a narrow mid band, a shade side; albedo
    posterized by brightness so colours keep their hue), then one full-screen pass: the tone map, a colour lift,
    dark ink where the depth bends (the second difference of 1/z: silhouettes and convex edges, not flat paving), the
    sky in flat bands, a 16-bit palette (5-6-5) with a 4x4 ordered dither. Hard one-step sun shadows (a 1024 map over
    32 m round you, from the big shapes only: the Shed, the hoods, the tables' tops, umbrellas, the trucks and painted
    props, palms, poles; not the parked cars, your car, the trees' leaves, the thin steel or, on Low, your driver). No bloom, ambient occlusion or reflections; no lens flare. The
    people get it too (their bodies cel-shaded and inked). Modelled on the game's own Retro style on the
    `retro/port` branch (`src/game/render/style.ts`, commit 9e29640), which isn't on `claude/modes` as a kept commit
    (only uncommitted work in its worktree) and changes the game's code, so it wasn't merged here: when it lands, the
    two should become one module.
  - **HD, the realistic look**: soft sun shadows (2048, PCF soft), 4x multisampling, bloom on the lights after dark,
    four real lights near you, normal maps on the surfaces (new on HD), and a grade: a soft vignette, a touch of
    contrast, warm highlights and cool shadows, and at golden hour the low sun's warmth through the frame.
  - **Ultra**: as HD plus GTAO ambient occlusion (the sky's far layers kept out of it: the mountain ring had gone
    black under it, as it already half did in P1c), 4096 sun shadows, 16x anisotropic filtering, eight real lights
    near you, two of the string lights' spots casting shadows of their own after dark while Lot 57 is open (their
    maps drawn in turn, one every other frame), stronger relief.
- **Light.** The sun and sky follow the clock (the game's Environment); golden hour is graded warm on every preset
  (`look.gold`, from the sun's height). Pools of warm light on the ground under the string lights (every third bulb),
  the heaters and the fire tables, lit when Lot 57 is open after dark. Ambient occlusion baked into the ground's
  vertex colours round walls, fences, tables, planters, the trucks and the new props, and a slow colour variation
  across the lawn, the pavers and the concrete. A rim of light on the people's bodies (the sky's by day, the strings'
  after dark), added by the crowd's own material wrapper (`crowdview.ts withFill`), so the people builder is
  unchanged.
- **Materials, all painted in code** (`lot57/surfaces.ts`): the Shed's walls are painted brick (paint in the joints,
  chips showing brick), its roof and the new door hoods corrugated galvanised steel, gravel pads, the umbrellas'
  canvas weave, brushed steel kegs, flame cards, oil stains on a third of the lot's stalls; normal maps from height for
  the painted brick, the corrugation, gravel, wood grain, worn concrete, asphalt and the canvas (HD and Ultra; Ultra
  stronger), as well as P1c's pavers, brick and block.
- **Detail** (`lot57/dress.ts`): two fire tables on the lawn (board-formed concrete, a burner pan, flames that flicker
  after dark and hold steady with reduced motion) on gravel pads, in place of the low tables the lawn chairs faced; a
  corrugated hood over each roll-up door; our fictional menu board on the Shed's yard wall under a gooseneck lamp;
  neon round the corner pylon's cabinet, both faces (a cream outline and a red rule), lit when open; four bike racks
  on the frontage strip; a stack of kegs by the bins. Planters, palms, the slatted fence, the heaters and the trucks'
  windows and awnings were already there.
- **Hooks**: `stats().look` (style, passes, shadow map size and type, anisotropy, spots lit, the toon swap's counts,
  bloom, AO) and `stats().lights`; `timeFrames(n)` (n frames drawn start to finish, each waited for with a pixel read);
  `casters(n)` (what casts the sun's shadow and the shadow passes' measured cost).
- **A movement fix the checks asked for** (`lot57/player.ts`): the "never stuck" rule now allows 1.5 cm of overlap at
  most, not 2 cm. P1d's new colliders shifted the seeded random walks, and two stick walks then ended pinched against
  a parked car's corner at 2.000 cm, which the independent walk checker (2 cm, in game coordinates) read as just over.
- **Checked**, headless Chromium with SwiftShader, one browser of ours at a time on a machine other lanes were
  loading to 13 to 23; every screenshot named here was looked at. The final build is md5
  84e8f9643c8d1d530e8120ddec461906: the suite and the Low shots ran on it; the HD and Ultra shots ran on the build
  before it (50c7cc92), which draws HD and Ultra the same (the last changes were Low's casters, your driver's shadow
  on Low, and the movement fix above).
  - `npx tsc --noEmit` clean. The real venue's name is in nothing under `src/onfoot` or in `dist/onfoot/index.html`.
  - **The sweep** (`tests/onfoot-p1d.mjs`, new): three views (`east` across the yard to the lawn and trucks, `shed`
    from the yard's north-east corner to the Shed, `lawn` the fire tables and trucks), at golden hour (Saturday
    15:50: the sun about 10 degrees up in mid-November), Saturday 21:00 and Saturday noon, at Low, HD and Ultra, at
    1280x720 and 390x844 (touch): 54 shots, `tests/out/onfoot/onfoot-<size>-<view>-<preset>-<clock>-p1d.png`, no
    console errors or warnings in either run (`tests/out/onfoot/logs/p1d-after-1280.log`, `p1d-after-390.log`).
  - **Before**: the same 54 from P1c's committed build r2 (`-p1c.png`; its High is HD's place), and side-by-side
    sheets, `tests/out/onfoot/onfoot-p1d-compare-<size>-<view>-<clock>.png` (P1c left, P1d right, a row a preset).
  - **stats() at each preset**, over the nine shots of each (calls, triangles, the people's calls):

    | Preset | 390x844 | 1280x720 | P1c, 390x844 | P1c, 1280x720 |
    | --- | --- | --- | --- | --- |
    | Low | 72 to 101 calls, 156k to 177k tris, people 2 to 6 | 76 to 126, 157k to 234k, people 2 to 6 | 58 to 84, 131k to 151k | 61 to 113, 132k to 209k |
    | HD | 126 to 183, 356k to 490k, people 2 to 21 | 152 to 194, 406k to 518k, people 6 to 23 | 119 to 174, 352k to 485k | 144 to 188, 400k to 514k |
    | Ultra | 266 to 417, 1.60M to 2.46M, people 3 to 58 | 347 to 568, 1.94M to 3.34M, people 17 to 90 | 257 to 402, 1.59M to 2.46M | 336 to 508, 1.94M to 2.93M |

    Low is inside the plan's phone budget (150 calls, 250k triangles, 16 for the people) in every shot at both sizes;
    its new cost over P1c is mostly the hard sun shadows' pass (measured with `casters()`: 19 calls and 56k triangles
    in the east view before the casters were trimmed and the box narrowed; 16 calls and 40k in the lot view after the
    first trim). HD is inside the High budget (350, 700k, 24).
    Ultra has no budget in the plan; its top is Saturday 21:00 in the east view, a frame that drew a spot's shadow map.
  - **Frame ms.** `stats().frameMs` is the CPU's part of a frame (JavaScript only): Low 2.1 to 8.4 ms, HD 2.9 to 7.8 ms,
    Ultra 7.2 to 16.1 ms in 15 of the 18 shots, and 24.9 ms (1280x720, east view, Saturday 21:00), 53.5 ms (1280x720,
    shed view, Saturday 21:00) and 157 ms (1280x720, lawn view, golden hour) in the other three; of the four frames
    sampled before each Ultra shot, single frames of up to 81.1 ms (corrected in the r2 repair: this line
    first said 7.2 to 16.1 ms with one 157 ms frame, which the logs `p1d-after-1280.log` and `p1d-after-390.log` don't
    support). Drawn
    start to finish here (`timeFrames(3)`, median, east view; software rendering on a loaded 4-core machine, so only the
    presets' relative cost, not a phone's or a GPU's frame rate): 1280x720 Low 654 to 761 ms, HD 2.8 to 3.2 s, Ultra
    8.0 to 16.9 s; 390x844 Low 262 to 394 ms, HD 1.0 to 2.9 s, Ultra 4.0 to 5.3 s.
  - **The Phase 1 suite, on the final build**: `node tests/onfoot.mjs --only=crowd-phone,walks,names --suffix=-p1d`,
    16 of 16 (`tests/out/onfoot/logs/onfoot-p1d-suite2.log`). 1,000 random walks (500 tap, 500 stick) against 504
    colliders: none ends inside a collider, off the walkable area or through a wall (the run before the movement fix
    failed with the two car pinches above: `onfoot-p1d-suite.log`); 454 of 454 tap-to-go walks with a path arrived.
    Low within budget in all 24 views at each phone size (twelve views, first and third person, Saturday 21:00):
    worst 131 calls and 246,845 triangles at 844x390, 119 calls and 248,029 triangles at 390x844 (the lot's views, where
    your own detailed car is in sight: the margin there is under 1%), the people at most 13 and 16 calls, counted and measured. Facing as
    drawn, the people's CPU (median 0.3 to 0.4 ms; one 40 ms frame at 390x844 on the loaded machine) and the names
    checks pass. (`suite.log`'s first run of the two crowd budget checks, before the casters were trimmed, failed at
    268k and 261k triangles.)
  - **What the shots show** (looked at, every one; the comparison sheets side by side):
    - Low is a different game now: crisp, outlined, cel-shaded, with hard shadows, posterized pools of light, a banded
      sky and the people cel-shaded and inked too, at full resolution on the phone.
    - The lawn changed most: the fire tables on their gravel pads, lit and flickering after dark, the chairs round
      them in their light (`onfoot-1280x720-lawn-hd-sat21-p1d.png`, `onfoot-390x844-lawn-low-sat21-p1d.png`).
    - Golden hour reads warm on every preset (the grade), with long sun shadows across the yard; on Ultra the mountain
      ring is lit again instead of black.
    - HD and Ultra by night and at noon in the yard change less than the rest: the pools under the heaters and strings,
      the rim on the people, the vignette and grade, the Shed's painted brick and corrugated hoods (`shed` view).
- **Not done, or short of the brief** (candidly):
  - The plan's Low budget of 12 canvas textures at 512 px is not met (P1d adds seven canvas textures on every preset,
    the painted brick replacing the tilt-up one, and seven normal maps on HD and Ultra; P1c was already over it). Low's calls, triangles and the people's calls are inside
    budget in every shot and every suite view, but with under 1% to spare in the lot's views; the people's CPU has
    medians of 0.3 to 0.4 ms but single frames of 4.4 ms (844x390) and 40.3 ms (390x844) on this loaded machine,
    against the plan's 2 ms; and Low now has a hard 1024 sun shadow map, which the owner's retro brief asks for and the
    plan's Low column doesn't list.
  - The umbrellas' undersides stay dark at HD and Ultra by day (no bounce from the sunlit paving); in the retro look
    they go near black.
  - The retro look's cloud deck turns into flat blobs, and Low's shadows stop 16 m from you (by design, for the
    budget): tables farther off have none.
  - Ultra's two shadow-casting spots draw every caster in their cones again (one map every other frame); Ultra by
    night reaches 568 calls and 3.3M triangles at 1280x720. There is no Ultra budget in the plan, but this is heavy.
  - Golden hour is a clock (Saturday 15:50) on this week's date: the page's sun follows the device's season, so the
    same hour in June is not golden.
  - Nothing ran on a real phone or GPU; frame rates are not measured.

## 2026-10-21: Lot 57 on foot, P1c committed (people, build r2)

P1c, the people milestone, is committed as build r2 (`dist/onfoot/index.html` md5 e50e3fa0f8840195e793470d0b8776db,
not committed itself). It has forty people: guests in standing and seated talking groups, staff and walkers. The crowd
curve follows day and hour, and the "Simulated crowd" chip is on screen. The play reviewer kept it. They checked
`npx tsc --noEmit` (clean), saw no console or page errors in their own Playwright run (390x844 Low, High portrait,
Low), found nothing changed in the game, the people builder or the configs, and found the real venue's name nowhere.
Their counts by clock match the r2 entry below. Screenshots: `tests/out/onfoot/onfoot-*-p1c-r2.png`, among them
the 1280x720, 844x390 and 390x844 Tuesday 15:00 and Saturday 21:00 crowd shots and
`onfoot-1280x720-crowd-reopen-third-p1c-r2.png`. Known small defect: one reachable only through a test hook, which doesn't block.

## 2026-11-02: Lot 57 on foot, P1c repaired after review (build r2, not committed)

The P1c review kept build F for play and returned it for code. Everything both reviewers asked for is below, with
what it measured. Nothing is committed: this repair pass was told not to commit. These are unchanged: the game's
code, its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts`, and the people builder
(`src/onfoot/people/`, another session's files).

- **The reviewers' QA of build F** (`dist/onfoot/index.html`, md5 0572831d…), logged here as the code review asked:
  - **The play reviewer's runs.** Two runs of their own, one at a time: 390x844 touch at Low, then 1280x720 at High.
    - No console or page errors. `npx tsc --noEmit` clean.
    - The real venue's name is in none of `src/onfoot`, `dist/onfoot` or `src/data/anaheim`.
    - No changes to `src/game`, `src/ui`, the root `vite.config.ts` or `package.json`.
  - **Counts by clock**, matching the builder's:
    - Tuesday 15:00 Quiet, 0.155 of capacity: 5 guests, 4 staff, 9 inside.
    - Saturday 21:00 Packed, 0.915: 29 guests, 15 seated, 11 groups, 7 staff, 35 inside.
    - Friday 18:00 Lively: 22 guests, 28 inside. Monday 11:00 Quiet: 9 inside.
    - Thursday 03:00, Sunday 22:00 and Tuesday 23:30: 0 inside and 0 staff. Sunday 22:00 still has 2 walkers outside.
    - 30 quick clock flips, and a turnover followed at once by closing: the right counts, and 0 shown or drawn
      inside when closed.
  - **Talk.** In 440 Low and 40 High samples, never two speakers at once.
    - In rendered High frames, listeners drawn as bodies faced the speaker in 95 of 101 looks.
    - The cut-outs, read from their stale head bones, faced the speaker in 28 of 197 looks at High and 156 of 515
      at Low.
  - **Budgets.**
    - Low 390x844: 100 to 110 calls, at most 225k triangles, the people 2 calls.
    - High at Saturday 21:00: 191 calls, 563k triangles, the people 24 calls (their limit exactly).
  - **The rest.**
    - The chip was on screen at every clock they checked, and read "Closed" when closed.
    - Reduced motion took head bob from 0.0299 m to 0 and turned transitions off.
    - These were all refused cleanly: an off-map go or tap, edge taps, a tap on a taken seat, and 20 rapid act()
      presses.
  - **The people's CPU** (`crowdMs`):
    - Low: median 0.3 ms, worst 2.4 ms.
    - High: median 0.9 ms, 90th percentile 2.1 ms, worst 5.5 ms.
    - 5.5 ms on Low in the frame after a clock change.
  - **Defects found:**
    - A stale "Lot 57 is closed · opens 11:00" toast under "Open till 01:00" and "Packed".
    - The 96% facing figure came from unrendered steps, which animate everyone.
    - The CPU spikes.
    - White specks on a cut-out's legs at night.
  - **The code reviewer** returned it for two things: a per-frame allocation in hot loops, and a repaint that froze
    a walker. Everything else they could check held.
- **Fixed**, all in `src/onfoot/`:
  - **The stale toast.** When setting the clock changes whether Lot 57 is open, a toast that says it's closed is
    taken off at once (`hud.ts` `clearToast`, `main.ts` `applyClock`).
  - **Facing, measured as drawn.**
    - `groups()` now reports `bodyFaces` (the body's heading within 25 degrees of the line to the speaker) beside
      `facesSpeaker` (the head, from the bones).
    - New checks count a body by its head and a cut-out by its body, in two ways:
      - in rendered frames;
      - over 30 s stepped the way a rendered frame steps (`sim(s, false, 'view')`, new: only the people drawn as
        bodies animate).
    - The old check, which animates everyone, is kept and now says so.
    - Standing listeners now turn their body part of the way toward the speaker: 80% of the angle, at most 40
      degrees, with the builder's little turning steps. They stay turned through the pause after, and the head
      does the rest. A cut-out shows only the body's heading, so it now faces the speaker too.
    - A person who turns from a cut-out into a body (or is posed when the clock is set) is posed with a
      quarter-second step, so their head is already looking at the speaker. With a 1/30 s step it still pointed at
      a stale target for the first frames.
  - **The people's per-frame work** (`lot57/npcs.ts`, `crowdview.ts`):
    - **Looks.** A listener stores who they look at. The eyes are read in the animation step, not every frame. The
      builder is told only when the target changes, or every 0.3 s to follow a moving head.
    - **Bones.** Each person's head, chest, arms, forearms, right hand and fingers are looked up once. They are the
      builder's skeleton, the same objects at every level of detail.
    - **Held items.** Only the chain from the scene down to the hand and fingers is updated, not the whole body's
      tree, and at most once a frame.
    - **Animation phases.** Each person's animation steps start at their own phase.
    - **No per-frame closures or arrays** in `allot()`, the host's greeting test or the worker pool's count.
    - **Setting the clock** now poses everyone out, and plans the busser's first leg, in the clock change itself
      rather than in the first frame after it.
    - **A split of `crowdMs`.** `stats().crowdParts` breaks it into talk, move, anim, allot, pump, post and path
      planning.
  - **Repaints.** `paint()` now:
    - puts back exactly what was shown;
    - restarts what the person was playing, so a walker walks on;
    - clears the look, which is set again at their next step;
    - marks the pose stale, so a body is posed again before it's drawn.
  - **The light specks on cut-outs' legs.** Each cut-out cell is now painted at twice its size and box-filtered
    down into the atlas. A leg is only two or three texels wide, and its lit edge broke into specks when magnified.
  - **The people's 24 calls on High** are now measured, not only counted:
    - New hook `peopleCalls()` draws the frame with the people and again without them.
    - That found a real undercount. A cup's glass is transparent and double-sided, so three.js draws it in two
      passes: one call counted, two drawn (worst view: 24 counted, 28 drawn).
    - Held items are now counted as they're drawn (`drawCost`).
    - The High and Low budget sweeps measure every view, and a new check runs after an Ultra-to-High switch.
  - **Hooks for the checks:** `repaint(id)`, `legs(id)` (the stride), `atlas(id)` (a person's cells read back as a
    PNG), and `setClock()` now returns `ms`. `walkgrid.ts` gained two diagnostic fields: the last search's expanded
    cells and its string-pulling time.
- **Checked on build r2** (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1c-r2.md5`):
  - **How it was run.** `node tests/onfoot.mjs --only=crowd,crowd-phone,names --suffix=-p1c-r2`: **29 of 29**
    (`tests/out/onfoot/logs/onfoot-p1c-r2-crowd.log`). Headless Chromium with SwiftShader, one browser at a time on
    a machine shared with other jobs. `npx tsc --noEmit` clean. Every screenshot named here was looked at.
  - **Counts by clock: unchanged from build F.**
    - Tuesday 15:00: 5 guests, 4 staff, 9 inside.
    - Saturday 21:00: 29 guests, 15 seated, 11 groups, 7 staff, 35 inside.
    - The four closed hours: 0 inside.
  - **Talk.** 0 samples with two speakers in any run.
    - **Unrendered**, everyone animated (the old method, labelled): heads 903 of 936 (96%).
    - **As drawn at High**, two views. Rendered frames: bodies by the head 92 of 94, cut-outs by the body 69 of 71,
      together 98%. Stepped as drawn over 30 s: 337 of 355 and 262 of 270, together 96%.
    - **As drawn on Low.**
      - 844x390, rendered: bodies 31 of 31, cut-outs 181 of 211 (86%), together 88%.
      - 844x390, stepped: 84 of 85 and 458 of 530, together 88%.
      - 390x844, rendered: 23 of 25 and 111 of 143 (78%), together 80%.
      - 390x844, stepped: 84 of 89 and 306 of 352, together 88%.
    - Seated cut-outs stay lowest: they turn at most 25 degrees on the seat.
  - **The toast.** At Tuesday 23:30 in the yard: "Lot 57 is closed · opens 11:00". Set to Saturday 21:00: no toast,
    under "Open till 01:00" and "Packed" (`onfoot-1280x720-crowd-reopen-third-p1c-r2.png`).
  - **The repaint.** A walker drawn as a body was repainted mid-walk. Over the next six frames, its stride (one thigh
    ahead of the other) went 6.7, 25.2, 31.6, 14, 9.8 and 30 degrees, and it was still playing 'walk'. A guest
    standing idle measured 1.3 degrees.
  - **The specks are gone.** See `onfoot-1280x720-crowd-cal-night-imp-p1c-r2.png` and the crop
    `onfoot-1280x720-crowd-cal-night-legs-p1cE-vs-p1c-r2.png` (build E's cut-out, r2's cut-out, r2's body). The
    atlas read back (`atlas(id)`) shows smooth limbs too.
  - **Budgets, counted and measured.**
    - **High:** 22 views, first and third person. The people at most 24 calls counted and 24 measured. The whole
      frame at most 201 calls and 691,699 triangles.
    - **After Ultra to High:** 12 views, counted equal to measured in every one, worst 24.
    - **Low 844x390:** at most 121 calls and 236,465 triangles. The people 13 counted, 13 measured.
    - **Low 390x844:** at most 102 calls and 236,817 triangles. The people 16 counted, 16 measured.
    - **Open: one view.** In the High sweep, third person at the lot gate counted 8 and measured 10 (9 in the run
      before), still far under 24. Probed from a fresh boot, the same view matched (9 and 9), so the cause wasn't
      found.
  - **The required screenshots,** all looked at, with the chip and the credit on screen:
    - `onfoot-1280x720-crowd-{tue15,sat21}-p1c-r2.png`
    - `onfoot-844x390-crowd-{tue15,sat21}-p1c-r2.png`
    - `onfoot-390x844-crowd-{tue15,sat21}-p1c-r2.png`
  - **Unchanged from build F:**
    - Reduced motion: head bob 3.0 cm, then 0; the toast's transition 0 s.
    - The staff, the walkers and an arriving party (which sat down within 62 s).
    - Ultra: 15 bodies, 461 calls.
    - The real venue's name is in none of the 52 files.
- **The people's CPU** (`crowdMs`, this machine's desktop CPU under SwiftShader, not a phone):

  | Measure | Build F | Build r2 |
  | --- | --- | --- |
  | High, 150 frames standing at Saturday 21:00 (median / 90th percentile / worst) | 1.0 / 1.3 / 8.0 ms | 0.7 / 0.8 / 1.6 ms |
  | Low 844x390 (median / 90th percentile / worst) | not measured this session | 0.4 / 0.6 / 2.2 ms |
  | Low 390x844 (median / 90th percentile / worst) | 0.6 / 0.9 / 3.6 ms | 0.3 / 0.5 / 6.9 ms |
  | First three frames after a clock change, worst | 4.2 ms High, 4.5 ms Low | 0.9 ms High, 0.4 and 0.7 ms Low |

  - **Where the numbers come from.** Build F's column is an A/B run back to back with an intermediate repair build
    (`tests/out/onfoot/logs/p1c-r2-cpu-ab-buildF-vs-r2pre.jsonl`). r2's column is the suite run.
  - **What's solid and what isn't.**
    - The steady-state medians and 90th percentiles are about the same, and they move with the machine's load:
      another job's browser ran at 250% CPU at times, and the load average was 4 to 9 on 4 cores.
    - Under that load the intermediate build and F traded places: High worst 7.2 against 8.0 ms, Low worst 4.7
      against 3.6 ms.
    - The clear change is the first frame after a clock change.
  - **The first frame after a clock change.**
    - The split showed most of it in one path search: the busser starting his first round, 6 to 14 ms right after
      a clock change. The same search, about 340 expanded cells, took 0.4 ms at other times.
    - That search now runs inside the clock change, which already takes 0.5 to 6 s. In r2 no first frame after a
      clock change has any planning in it.
  - **The remaining spikes** move between parts from frame to frame. One 390x844 frame spent 6.8 ms animating 4
    people who usually take 0.1 ms. That fits pauses (scheduling, or collecting the builder's per-update garbage),
    not steady work.
- **Runs on the way, for honesty:**
  - **Build r2a** (`onfoot-p1c-r2a-crowd.log`): 28 of 29. The new measured-calls check failed, which found the glass
    undercount.
  - **Build r2b** (`onfoot-p1c-r2b-crowd.log`): 28 of 29.
    - At 390x844 the rendered-frames sample read bodies 21 of 36. It was 12 consecutive frames, about 2 s, often of
      the same few people, right after the camera moved.
    - That led to the quarter-second pose for new bodies, and to spacing the samples 0.5 s apart.
  - **A probe of the phone groups** (`onfoot-p1c-r2c-phone-probe.log`, the final build with the consecutive
    samples): 10 of 10.
  - **Speck and spike probes:** one-off scripts, not in the suite.
- **Regression on build r2:** `node tests/onfoot.mjs --only=desktop,actions,actions-phone --suffix=-p1c-r2`, **40 of
  40** (`tests/out/onfoot/logs/onfoot-p1c-r2-regress.log`).
  - That covers P1a's desktop group (tap to go reaching all 157 free seats from both starts, closing time, the
    hooks) and P1b's actions at High and on a phone (ordering at the bar and both trucks, Join and Leave, nothing
    through a wall, the cooks drawn on Low).
  - Group talk in that run: listeners faced the speaker in 916 of 946.
  - `onfoot-1280x720-act-joined-p1c-r2.png` was looked at.
  - Not re-run: the landscape and portrait groups and the 1,000 walks. The walk grid's change is two diagnostic
    fields, and its paths are unchanged.
- **For the people builder's session** (its files weren't touched; these would trim the crowd's per-frame garbage):
  - `person.ts` `lookAt()`: copy into a vector it keeps, instead of `target.clone()` on every call.
  - `anim.ts` `update()`, while a look target is set: replace the per-update `new THREE.Vector3()`,
    `this.lookTarget.clone()` and `new THREE.Quaternion()` with module-level scratch objects.
    - Its returned `{ yaw, pitch }` object, `person.ts`'s per-update `(out) => …getWorldPosition(out)` closure, and
      `pose()`'s `R`, `knee` and `ank` closures are allocated on every update too.
  - `person.ts` `eyes()`: the `hf.toBody([0, 0, 0.01])` offset could be worked out once, not per call.

## 2026-11-02: Lot 57 on foot, P1c: forty people, the crowd curve and the chip (build F, not committed)

P1c of `PROJECT_OC_ON_FOOT.md` Phase 1 ("NPCs", "Groups that look like they're talking", "Walkers, arrivals and
staff", "Simulated crowds", the phone budgets), on the standalone page (`src/onfoot/`). The game's code, its
`vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts` and the people builder (`src/onfoot/people/`, used
through its exports only) are unchanged. An earlier builder of P1c left most of this on disk uncommitted (its own
19-check run passed on its build); this entry is the run on the builds made since (B to F; F is on disk).

- **What's there** (all in `src/onfoot/`):
  - `lot57/npcs.ts`: forty people, every one built by the people builder and every one fictional.
    - 31 guests in twelve parties: five standing circles (two barrel tables in the yard, one in the Shed, the
      bag-toss lawn, the third truck slot) and seven seated groups (tables 3, 6, 9 and 11 in the yard, a picnic
      table by the trucks, two at the bar, the lawn chairs). P1b's two groups are the same people.
    - Seven staff in our patina green: the bartender and a cook in each truck (they serve you, P1b), a second
      bartender working the back bar (from 40% of capacity), a host at the gate, a busser making rounds of the
      tables (from 30%), and a lot attendant waving cars in on busy nights.
    - Two walkers on the Orangewood sidewalks (one jogs), whether Lot 57 is open or not; one late, none from 01:00
      to 06:00.
    - The crowd curve: `clock.ts`'s simulated share of the fictional 220 times 31 guests decides how many are in, as
      whole parties in a fixed arrival order. Setting the clock settles it at once. On the live clock parties arrive
      at random (about one every two minutes while it's under its level), walk in by a path from a car in the lot or
      along the Orangewood sidewalk and in by the entry walk, stay (log-normal, median 75 minutes) and walk out
      again. Closed: nobody inside, the staff gone. Nothing is live.
    - Talk in every group: one speaker at a time, turns of 1 to 10 s (median about 3.5), 0.2 to 0.8 s pauses, the
      next speaker usually whoever was looked at; listeners look at the speaker with glances away and nod in the
      pauses; group laughter; a sip every 40 to 90 s. Seated listeners turn up to 25 degrees on the seat toward the
      speaker; a seated speaker beats the words with a hand.
  - `lot57/crowdview.ts`: drawing forty people inside the budgets, nearest first, from what the rest of the scene
    left last frame: the patio body (LOD 1, built in two workers), the far body (LOD 2, built at load), or an
    impostor (a card painted at load from that person's own body from eight sides, standing and sitting; all of
    them one instanced draw call). Walls, buildings and truck bodies hide people. One instanced soft-shadow call;
    on High the nearest four cast the sun's shadow. Ultra has no budget in the plan: everyone near is a body.
  - `lot57/crowd-worker.ts`: the worker that builds the patio bodies (the page's own script started from a blob).
  - `main.ts`: the crowd wired in. When a frame is over the triangle budget, or people near you were drawn as
    impostors for want of triangles, fewer parked cars get their detailed model. New hooks: `crowd()`,
    `turnover()`, `crowdView()`, `takenSeats()`, `peopleReady()`; `stats()` now reports guests, inside, groups,
    talking, seated, walkers, street, staff, bodies, impostors, the LOD counts, the people's calls and triangles and
    the rest of the scene's.
  - `lot57/doings.ts`: a seat a guest is in or walking to can't be taken ("Someone's sitting there."); Join is for
    standing circles that are all there.
- **This session's changes on top of the earlier draft** (builds B to F):
  - The yard read empty under "Packed": two of its twelve tables had people. The roster is now twelve parties
    (was ten): at Saturday 21:00 four yard tables and two barrel tables have people. A pair sits across from each
    other (the bench or lawn chair opposite), not side by side.
  - After dark the people stood in the lit yard as dark cut-outs: the venue's night light is baked into its own
    materials, and the builder's body material saw only the sky and a few real lights. The coarse bodies now take
    the same warm lamp fill as the held items, by where each person stands (`crowdview.ts` `withFill`, the
    builder's material wrapped, not changed). Bodies and impostors drawn side by side match (the new calibration
    check).
  - Parties from the street cut across the verge and through the frontage planting beds. They now walk the
    sidewalk to the entry walk and in through the gate, and out the same way; the five beds are colliders, for you
    too (`venue.ts`).
  - Parties walked in and out holding their drinks. Now they walk empty-handed and have their drinks once they're
    settled.
  - Tests: the arriving shot is aimed at the party and checks it's drawn (the old one missed them); a new check
    draws one view all bodies, then all impostors, by night and by day.
  - `stats()` reports `crowdMs`, the people's CPU in the last frame (`simMs` counts only your own steps), and the
    budget checks print its worst.
- **Checked** with `node tests/onfoot.mjs`: headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time on a machine shared with five other workflows. `npx tsc --noEmit` is clean. Every screenshot
  named here was looked at. Two builds:
  - **Build F**, the one on disk (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1c-buildF.md5`): P1a's
    desktop group, the crowd groups and names, **39 of 39** (`tests/out/onfoot/logs/onfoot-p1c-buildF.log`,
    `--suffix=-p1cF`).
  - **Build E**: the crowd groups and names, **20 of 20** (`onfoot-p1c-buildE-crowd.log`), and every other group,
    **54 of 54** (`onfoot-p1c-buildE-regress.log`), `--suffix=-p1cE`. Build F differs from E only in measuring: two
    timers in `main.ts` and the `crowdMs` field in `stats()` (and the tests printing it).
  - The numbers below are build F's unless marked E.
    - Boot on Tuesday 15:00 at 1280x720 (High) with no console errors: 40 people, the far bodies built at load in
      7.2 s, the 40 patio bodies from the two workers within 17 s more (0.8 to 1.0 s each), no worker errors; the
      impostor atlas is 2048x1680. On a phone (Low) the far bodies took 7.4 s (844x390) and 7.5 s (390x844).
    - The counts by the clock (guests, staff, people on the sidewalks, everyone inside the fence): Tuesday 15:00
      Quiet (0.155 of capacity): 5 guests (2 seated, 2 groups), 4 staff, 2 on the sidewalks, 9 inside. Saturday
      21:00 Packed (0.915): 29 guests (15 seated, 11 groups), 7 staff, 2 on the sidewalks, 35 inside. Ten more open
      hours from Monday 12:00 to Sunday 20:30 all within the curve's target (at most one over, never more than three
      under) and rising with the share. Closed (Tuesday 09:00 and 23:30, Sunday 22:00, Thursday 03:00): 0 inside, 0
      guests, 0 staff; 2, 1, 2 and 0 walkers on the sidewalks.
    - Talk: 660 group samples over 30 s at Saturday 21:00 in all 11 groups there (five standing, six seated): 0
      with two speakers; listeners faced the speaker (the head within 25 degrees of the speaker's eyes, from the
      bones) in 928 of 968 looks (96%); the lowest group 91% (table 6). Build E: 916 of 947 (97%), lowest 92%.
    - Staff: Tuesday 15:00 the bartender, both cooks and the host; Saturday 21:00 also the second bartender, the
      busser (12.8 m of rounds in 20 s) and the lot attendant in the lot. Walkers: both on the Orangewood
      sidewalks, 9.5 and 26.3 m in 10 s; none at Thursday 03:00.
    - Turnover at Saturday 14:00: the barrel table by the lawn left for the lot and table 3 walked in off the
      street, along the sidewalk and in by the entry walk, empty-handed, and sat down within 49.5 s
      (`onfoot-1280x720-crowd-arriving-p1cF.png`, both of them drawn); no walk without a path.
    - Budgets, from `stats()` at Saturday 21:00 (calls and triangles from `renderer.info`, every pass included):
      - **Low** (the phone default), 12 views in first and third person each: 844x390 worst 121 calls and 236,465
        triangles, the people at most 15 calls; 390x844 worst 102 calls and 236,817 triangles, the people at most
        14 calls. Limits 150, 250k and 16. In P1a's seven views (build E) worst 121 calls and 242,222 triangles.
      - **High** (1280x720), 11 views in first and third person: worst 199 calls and 691,699 triangles, the people
        at most 24 calls. Limits 350, 700k and 24. The scene alone didn't pass 700k in any view.
      - The screenshot views: High Tuesday 15:00 174 calls, 496,958 triangles (3 bodies, 1 impostor); High Saturday
        21:00 191 calls, 574,838 triangles (10 bodies, 6 impostors; the people 24 calls, 64,588 triangles); Low
        844x390 83 and 89 calls, 126,612 and 146,698 triangles; Low 390x844 77 and 83 calls, 123,242 and 143,308.
      - Ultra (no budget in the plan): 461 calls, 2,787,428 triangles, 15 bodies.
      - The people's CPU (`crowdMs`: their talk, walks, animation and drawing choices), on this machine's desktop
        CPU under SwiftShader, not a phone: in the budget views at most 1.2 ms a frame on High and 1.3 and 4.7 ms
        on Low (one frame each, three frames after a jump of the camera). Over 150 frames standing still at
        Saturday 21:00 (a one-off script, not in the suite): Low median 0.5 to 0.7 ms, 90th percentile 0.7 to
        2.8 ms, worst 7.2 ms; High median 1.0 ms, 90th percentile 1.4 to 5.0 ms, worst 12.1 ms. The plan's target
        is under 2 ms on a mid phone; the spikes are over it already on a desktop (see below).
    - Bodies against impostors in one view, night and day
      (`onfoot-1280x720-crowd-cal-{night,day}-{body,imp}-p1cE.png`): they read alike.
    - Reduced motion: head bob 3.0 cm, then 0; the toast's transition 0 s.
    - Screenshots with the chip on screen (`hudVisible` checks it and the map credit in each), looked at:
      `onfoot-1280x720-crowd-{tue15,sat21,sat21-wide,sat21-ultra,arriving}-p1cF.png`,
      `onfoot-1280x720-crowd-{sat21-shed,sat21-lawn}-p1cE.png`, `onfoot-844x390-crowd-{tue15,sat21}-p1cF.png`,
      `onfoot-390x844-crowd-{tue15,sat21}-p1cF.png`.
    - The real venue's name is in none of the 52 files (`src/onfoot`, `src/data/anaheim`, the built page).
  - Build E, every earlier group (P1a's desktop, landscape and portrait, P1b's actions at High and on a phone, the 1,000
    walks) with the forty people in: **54 of 54** on build E (`tests/out/onfoot/logs/onfoot-p1c-buildE-regress.log`).
    - Tap to go still reaches every free seat from the front gate and the lot walk and sits you (314 walks, 157
      free seats); the 15 seats the guests sit in at Saturday 21:00 are refused ("Someone's sitting there.") from
      both starts. 1,000 random walks (500 tap, 500 stick) never end inside a collider, leave the area or cross a
      wall: 1,532,032 positions over 36,851 m against 502 colliders (the five planting beds added); all 450 tap
      walks with a path arrived.
    - P1b's actions with the crowd in: ordering at the bar and both trucks, from a stool, from either end of the
      bar; Join and Leave in the yard and on the lawn, a tap from one circle to another; nothing through a wall;
      the cooks drawn on Low. Group talk in that run: 0 of 660 samples with two speakers, listeners facing the
      speaker in 923 of 963 (96%).
    - Budgets in P1a's and P1b's views: High at most 200 calls (the day view) and 677,612 triangles (third
      person in the yard) over P1a's nine views; the High action views 129 to 197 calls, up to 684k triangles;
      Low (844x390) worst 121 calls and 242,222 triangles; the phone action views 66 and 74 calls, 129k and 170k
      triangles.
    - The Ultra night and dusk views ran through (the earlier builder's run had lost its browser there): yard
      288 calls and 2.22M triangles, third person at dusk 551 calls and 3.41M.
    - Screenshots looked at: `onfoot-1280x720-{night,ultra-night,ultra-third-evening,act-joined}-p1cE.png`,
      `onfoot-844x390-night-p1cE.png`, `onfoot-390x844-act-joined-p1cE.png`.
  - Earlier runs this session, for honesty: build B (the roster change alone) passed the same 19 crowd checks
    (`onfoot-p1c-buildB-crowd.log`); build D (with the lamp fill, the gate walk and the planting beds) passed 20 of
    20 (`onfoot-p1c-buildD-crowd.log`). Build C's run and build D's regression run were stopped by hand when a
    newer build replaced them (their logs say so). A build G that spread the people's animation updates over
    frames measured no better (Low 90th percentile 0.8 to 4.1 ms, High 1.3 to 6.6 ms) and was reverted; the page
    rebuilt after the revert is byte-identical to build F. The earlier builder's last regression run
    (`onfoot-p1c-final-regress.log`) lost its browser at the Ultra night check and stopped; it isn't counted.
- **Not built, or not measured.**
  - Mingling (someone drifting to another group or the bar and back), dogs, joggers' routes beyond the two
    sidewalks, arrivals from drop-offs at the Dupont kerb, and joining a seated group.
  - The weather's effect on the crowd (the page has no weather) and the first-Friday third truck. The Tuesday
    trivia night is in the curve (+15% from 19:00 to 21:00).
  - Ordering on arrival: a party has its drinks once it's settled, without a visit to the bar.
  - Walking people don't step round each other, only round you and the tables.
  - The lawn chairs' party comes only when the crowd is near full (it's last in the arrival order), so the talk
    check doesn't sample it at Saturday 21:00.
  - At patio distance an impostor holds its painted pose: a walker drawn as one glides.
  - Frame rates on a phone, and the people's CPU per frame on a phone. On this desktop the median is 0.5 to 1 ms
    but one frame in ten reaches 2.8 ms (Low) to 5 ms (High) and the worst 7 to 12 ms: over the plan's 2 ms phone
    target. Where the spikes come from isn't profiled yet (spreading the animation over frames didn't help).
- **For the people builder's session** (its files weren't touched; `src/onfoot/people/` is used through its exports):
  - `lodMaterial()` could take a fill uniform (a local ambient level) so the crowd needn't wrap its
    `onBeforeCompile` (`crowdview.ts` `withFill`).
  - LOD 0 can't be built in a worker: its hair cards draw on a canvas. An `OffscreenCanvas` path would let the
    close-ups build off the main thread too.
  - A seated laugh and a seated talk gesture (the crowd hand-poses the shoulders and a beat hand on top of the
    builder's 'sit'), and an apron garment for the staff.
  - One draw call per person is the crowd's limit on phones (13 bodies at most on Low); a shared skinned batch or
    instanced skinning for the coarse LODs would let more people near you be bodies.
  - Carried from P1b: the LOD 1 shells' ragged open necklines and armholes, and skin flecks at the shoulders on
    heavy builds.

## 2026-11-02: Lot 57 on foot, P1b repaired after review (build D)

The P1b review (one reviewer rejected for play, one kept the code) found four faults the 53 checks never exercised,
and per-frame allocations to remove before commit. All are fixed in `src/onfoot/` and `tests/onfoot.mjs`. The
game's code, its `vite.config.ts` and `package.json`, `src/onfoot/vite.config.ts` and the people builder
(`src/onfoot/people/`) are unchanged.

- **Fixed**
  - **The cooks were never drawn on Low, the phone default** (a regression from build C's budget fix). The Low
    view test drew its line to the person's centre, and both cooks stand inside their truck's collider, so the
    line always hit the truck. Staff are now tested to a point 0.3 m out on the customer's side of their counter
    (`npcs.ts`, `StaffPost.seeX`). The view test also has its own filter now (`main.ts`, `blocksView`). Only
    full-height things hide a person: walls, buildings, truck bodies, tanks and doors. Glass doesn't, and neither
    does a stretch of wall with an eye-level window in it (the Shed's two storefront windows and the tank-room
    window: `venue.ts` marks those stretches `see`, and they stay solid to walk into and to act through). The low
    planter walls, fences and gates you see over don't hide anyone either; build C hid the yard's people from the
    Orangewood sidewalk behind the 0.95 m planter wall.
  - **A tap on a person while you stood in another group's circle stopped you 2.38 m from the old group.**
    Leaving a circle always walked you a step back, and that walk replaced the tap's. Now the step back happens
    only when you press Leave standing still, or on the way in to join (`doings.ts` `leave()`). If you're already
    walking somewhere else, you keep going.
  - **At the ends of the bar the drink was ready before the bartender got there.** The 4 to 8 s now start once the
    bartender or cook reaches the taps or the flat-top (`doings.ts` `tick()`, with a 20 s fallback). Staff also
    walk at 1.2 m/s, not 0.75 (`npcs.ts` `update()`); the builder's walk cycle is tuned for 1.25.
  - **The regulars' clothes showed skin.** At LOD 1 (what everyone is drawn with on Low and High), the builder's
    shells cut v, scoop, square and strap necklines and sleeveless armholes with ragged edges. That made a dress
    read as torn. Separately, Lena's tan shirt (`0xc9a77a`) read as bare skin under the string lights. I rendered
    the regulars side by side at LOD 1 (crew, v and scoop necks; 0.3 and 0.5 sleeves; on a slim and a heavy
    build): a crew neck with half sleeves was the cleanest. `npcs.ts` `patioOutfit()` now gives the regulars'
    tops and dresses a crew neck (shirts and polos keep their collars) and sleeves to at least half the upper arm
    (0.5 where they were under 0.3). A top in a skin-like colour (sRGB hue 12 to 50 degrees) takes one of our dark
    colours instead (Lena's shirt is now red). Heels still become flats on the lawn.
  - **Per-frame allocations.**
    - `doings.ts` `available()` now writes the shared pair in place: no list, no closure.
    - `npcs.ts` `soft()` reuses its objects.
    - Module-level Sets replace the array literals in `items.ts` `formOf` and `isDrink` and in `npcs.ts`
      `placeHeld`.
    - `itemName` reads a table built once.
    - The order chip is rewritten only when its stage, item, order or 2% progress step changes.
    - The staff-mouth loop is a plain loop.
    - `hud.ts` `status()` caches its text span and writes `--p` only on change.
- **Checked** on build D (`dist/onfoot/index.html`, md5 in `tests/out/onfoot/logs/p1b-buildD.md5`) with
  `node tests/onfoot.mjs --suffix=-r2`. Headless Chromium with SwiftShader, one browser at a time. `npx tsc
  --noEmit` is clean. Every screenshot named here was looked at.
  - Landscape, portrait, phone actions, walks and names: **22 of 22**
    (`tests/out/onfoot/logs/onfoot-p1b-r2-lowgroups-buildD-2026-11-02.log`).
    - New phone check (390x844, Low): each truck cook is drawn 1.94 m from you at the window, at the flat-top
      while making, and back at the window when the elote is ready (`onfoot-390x844-act-truck-r2.png`). Both cooks
      are hidden from behind their trucks. The bartender is drawn through the west storefront window from the
      forecourt, and hidden from a spot where the line runs through the wall between that window and the
      entrance.
    - Low budgets hold: worst 118 calls and 242,295 triangles over P1a's seven views; the phone action views drew
      64 calls and 122k triangles holding, 71 calls and 162k joined (build C: 73 and 161k joined).
    - 1,000 random walks pass against 497 colliders: the window stretches add six segments to the 491, with the
      same union.
  - High actions (1280x720), the 13 earlier checks and two new ones, with the phone actions run again in the same
    process: **21 of 21** (`tests/out/onfoot/logs/onfoot-p1b-r2-actions-buildD-run3-2026-11-02.log`).
    - Bar ends: from stools 0 and 19, the bartender walked 6.96 m and 14.4 m before starting. The orders were ready
      at 12.5 s and 17.1 s (makes of 6.68 s and 5.15 s), with the bartender 1 m from the cup across the counter and
      0 m along it. The check allows 1.05 m across and 0.3 m along: the bartender stands behind the 0.72 m counter
      and its mats.
    - Tap from inside a circle: joined to the yard group, a tap on Kenji in the lawn group walked you 31.8 m. You
      left the yard circle on the way, stopped 1.72 m from the lawn group's centre (radius 0.8 m), and were offered
      Join for that group.
    - Glass: the wall check now also taps seat 22 through the storefront glass. It's picked, the walk goes in by
      the entrance (crossing the Shed's north wall at x -5135.86, inside the 2.8 m doorway), and you sit.
    - Budgets: the High action views drew 114 calls and 306k triangles holding, 177 and 640k holding in third
      person, and 193 and 691k joined in third person (limits 350 and 700k). Ultra joined drew 393 calls and
      2,478,124 triangles.
    - Group talk: 0 of 120 samples had two speakers; listeners faced the speaker in 197 of 208 (95%).
  - P1a's desktop group at High (1280x720): **19 of 19** on build D
    (`tests/out/onfoot/logs/onfoot-p1b-r2-desktop-buildD-2026-11-02.log`). Tap to go still reaches all 172 seats
    from both starts (344 walks, all seated). The High budget holds over the nine views: worst 228 calls and
    680,215 triangles (the third person from the front), limits 350 and 700k.
  - So every High check now comes from build D: the review's gap (the 32 High checks from build A) is closed.
  - Run history, for honesty. The first High actions run on build D
    (`onfoot-p1b-r2-actions-buildD-run1-2026-11-02.log`) passed 13 of 15. The two failures were in the tests: the
    stool check waited exactly the make's length, and the new bar-ends check compared local with game coordinates.
    A second run (`...-run2-fixedwaits-...log`) showed that the older bar check's fixed wait (`dur - 2.5 + 0.2` s
    after a 2.5 s step) also came up 0.02 s short now that the make starts on arrival. That left an order pending,
    and four more checks failed in a cascade. Every order wait in the suite now steps the world until the order is
    ready (at most 30 s).
- **Screenshots** (`tests/out/onfoot/`, `-r2` names, all looked at):
  - `onfoot-390x844-act-truck-r2.png` (new) and `onfoot-390x844-act-{making,joined,reply,left}-r2.png`.
  - `onfoot-844x390-night-r2.png` and `onfoot-1280x720-{night,trucks-night}-r2.png`.
  - `onfoot-1280x720-act-{ready,ready-truck,seated-holding,holding-third,joined,joined-third,left,wall-tap,
    joined-ultra}-r2.png`.
  - The other `-r2` shots were re-made by the same runs and aren't cited here.
- **Known costs and carried forward.**
  - Switching quality between Low and High here rebuilds the nine people, and the page freezes for 23 to 32 s
    (the reviewer's measurement; not re-measured here).
  - On heavy builds (fat about 0.9), the LOD 1 shell still lets the skin through in small flecks at the top of the
    shoulders, whatever the garment. A crew dress, a top and skirt, and a closed cardigan all showed it in the
    side-by-side renders. Jules at the yard table shows it in `onfoot-1280x720-act-joined-r2.png`. That fix
    belongs to the people builder's session (notes below).
  - At night the cooks read as dark silhouettes against their lit kitchens on Low, which has no point lights. On
    High the taco cook is still in silhouette while the noodle cook is lit (`onfoot-1280x720-trucks-night-r2.png`,
    looked at).
  - `onfoot-1280x720-act-wall-tap-r2.png` is nearly black: the forecourt is unlit at night (P1a), and the solid
    wall fills the middle of the view.
  - Toast and caption timers count frames, so they linger under SwiftShader. That's a test artefact.
- **For the people builder's session** (its files weren't touched):
  - LOD 1 garment shells cut open necklines (v, scoop, square, strap) and sleeveless armholes with a ragged,
    stair-stepped edge that shows skin in patches.
  - On bodies with fat at about 0.85 or more, skin flecks show at the shoulder tops through any upper garment at
    LOD 1. Seen on `randomPerson(301)` (fat 0.88) and `randomPerson(302)` (0.93) at 1 to 2 m.
  - There's no apron garment for staff.

## 2026-11-02: Lot 57 on foot, P1b: things to do (tap to go, Sit, Order, Join and Leave)

P1b of `PROJECT_OC_ON_FOOT.md` Phase 1 ("What you can do"), on the standalone page (`src/onfoot/`). The game's code,
its `vite.config.ts` and `package.json`, and the people builder (`src/onfoot/people/`, used through its exports only)
are unchanged.

- **New** (all in `src/onfoot/`):
  - `lot57/doings.ts`: the context actions and their order: Pick up, Leave, Stand, Drive, Order, Join, Sit. One big
    button (76 px) shows the best one; a second, smaller one appears when two make sense (Order and Sit at the bar;
    Stand and Order on a bar stool). Every action needs a clear line from you to what it acts on (no wall, fence,
    gate, glass, door, truck, tank or building in between, tested in 2D against the colliders) as well as range.
  - Ordering: the bar and both truck windows. A sheet of five big buttons (64 px tall) per counter, our own items,
    free (no prices, no credits), alcohol-free for you. The bartender or cook comes along the counter to you, turns
    to the taps or the flat-top to make it (4 to 8 s, a progress ring on the order chip), sets it on the counter and
    says so; Pick up puts it in your hand. You hold it in the lower right of the first-person view and in your
    avatar's right hand in third person (the forearm brought up, steady while you walk). Ordering from a bar stool
    works without standing.
  - `lot57/items.ts`: the menu (15 items over three counters) and each item modelled in code: lathed cups with our
    printed sleeves (LOT 57, TWO LANE, NIGHT SHIFT), ice, straws and citrus wheels; a shaker pint with a foam head;
    paper boats with a checked liner (tacos with chunky filling, a three-hole pretzel with salt and mustard,
    dumplings); a noodle box with flaps, a wire handle and chopsticks; an elote cup; a bowl of cucumbers. One
    painted 256 px atlas, three materials, lit after dark like the venue's baked light.
  - `lot57/npcs.ts`: two groups of three regulars (by the barrel table in the yard, on the lawn by the bag toss),
    the bartender and a cook in each truck, built by the people builder at load. Groups talk on their own: one
    speaker at a time, turns of 1 to 10 s (median about 3.5 s), pauses, listeners looking at the speaker with
    glances away, nods, group laughter. Join opens a gap in the circle where you stand (they re-space keeping their
    order, the host across from you) and they turn to you; a short conversation runs (`lot57/talk.ts`: a line, two
    reply chips, their answer, a second exchange from someone else, then "Drive safe" and back to their own talk).
    Leave mid-conversation and someone says goodbye; the circle closes up with your spot between two of them. On
    Ultra the host is the builder's close-up body (LOD 0). People are soft: tap to go plans round them, and they
    nudge rather than block you.
  - Tap to go: a seat (sits you down), one of the regulars (walks you up to the group), staff or the counter or a
    truck window (walks you there and opens the order sheet on arrival), or the ground. Only what you can see
    counts: a seat or a person farther along the ray than the first solid wall it hits isn't picked. Glass isn't a
    wall for a tap: a stool seen through a storefront window from the forecourt is picked, and the walk goes in by
    the entrance (seat 22, checked in the repair below). Acting still needs a clear line, so Sit isn't offered
    through the glass.
  - HUD: captions with the speaker's name (a question stays up until you answer), reply chips, the order sheet,
    and an order and holding chip. Phone portrait stacks the chips in a column above the order chip and puts the
    captions under the crowd chip; keyboard 1 to 5 picks on the sheet, 1 and 2 reply, Escape closes; gamepad B
    stands, leaves or closes.
  - Test hooks added on `window.__onfoot`: `target`, `press`, `sheet`, `pick`, `closeSheet`, `reply`, `state`,
    `talk`, `groups`, `npcs`, `counters`, `reach`, `offerAt`, `sight`, `project`, `lastTap`, `inHand`, `hold`;
    `sim(seconds, untilStop, world)` runs the people and the order too; `stats()` now reports npcs, groups, staff,
    npcsDrawn, npcTris, npcCalls, crowdBuildMs, holding.
  - Low stays inside its budget with the people in it: on phones, regulars past 40 m and drinks in hand past 15 m
    aren't drawn (the plan's far-crowd impostors aren't built), people a wall or a truck body hides aren't drawn, and
    the parked cars get their detailed models only within 45 m (the 12 nearest had them however far off, 70 m away
    behind the Shed from the sidewalk). High and Ultra draw as before.
  - Fixes found by the checks: the opener's caption timed out while the reply chips waited (it now stays until you
    answer); the member who said goodbye kept talking over the group's own next turn; the paper boats and noodle box
    were wound inside out (liner outside, print inside); the tacos read as sausages (now chunky filling between
    tortilla edges); in portrait the caption overlapped the chips and the order chip sat on the map credit.
- **Checked** with `node tests/onfoot.mjs` (headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time on a machine shared with five other workflows). **53 of 53 pass** across two builds:
  - Build A (`tests/out/onfoot/logs/onfoot-p1b-full-buildA-2026-11-02.log`, every group): 52 of 53; the Low budget
    view failed at 252,499 of 250k triangles with both groups in it.
  - Build C, the final one (`dist/onfoot/index.html` md5 in `tests/out/onfoot/logs/p1b-buildC.md5`): landscape,
    portrait, phone actions, walks and names re-run, **21 of 21**
    (`tests/out/onfoot/logs/onfoot-p1b-lowgroups-buildC-2026-11-02.log`). Build C differs from A only in lines that
    apply on Low (the phone people and drink distances, the 45 m car detail), so the 32 High checks (P1a's desktop
    group and P1b's desktop actions) stood from build A (the review found that gap; all of them were re-run on
    build D in the repair entry above). `npx tsc --noEmit` is clean. Every screenshot named below
    was looked at.
  - Tap to go: a tap on the ground walks a 4-waypoint path round a table with the dots shown, and arrives; a tap on
    a seat on screen walks there and sits; P1a's check still reaches all 172 seats from the front gate and the lot
    walk and sits (344 walks, now with the people in place); 1,000 random walks (500 tap, 500 stick) never end inside
    a collider, leave the area or cross a wall (1,456,209 positions over 35,012 m, 491 colliders), and all 445
    tap walks with a path arrive.
  - Sit and Stand at every kind of seat (bench, picnic, lawn chair, bar stool, high-top) with the button; on a bar
    stool the buttons read Stand and Order.
  - Order and hold: at the bar, the sheet's five items, made in 6.19 s (4 to 8), the bartender at the taps, ready on
    the counter, Pick up, held in first person and in third person 0.088 m from your avatar's right hand; both
    trucks (birria tacos, garlic noodles), each Pick up replacing what you held; from a bar stool, ordered and
    picked up without standing; on a phone, a finger tap on the bar walks you there and opens the sheet (buttons
    64 px tall), a tap on an item, Pick up with the button.
  - Join and Leave: the yard group re-spaces to leave a 90 degree gap either side of you, the host across; a full
    conversation (hello, a line, your reply chip, the answer, a second exchange from another member, "Good talking.
    Drive safe."), then Leave puts you 1.97 m from the centre; the lawn group joined by tapping one of them on screen
    and left mid-conversation (a goodbye); on a phone the caption, chips (56 px or taller) and button are on screen
    and clear of each other. Group talk over 30 s: 0 of 120 samples with two speakers, listeners facing the speaker
    in 196 of 204 (96%).
  - Nothing through a wall: over every free point in a 0.5 m grid round the venue (30,486 points), each offer (2,009
    at normal reach; 14,803 with the ranges stretched four times) has a clear line to what it acts on, checked in
    Node against the exported colliders; at four times the reach the line test turned down 185 nearest seats behind
    walls. A tap on a high-top stool behind the Shed's north wall from the forecourt, and on the cook from behind the
    taco truck, went to the ground; the same stool tapped from inside was picked; nothing is offered at a truck's back.
  - Ultra: the host who talks to you is the builder's close-up body (LOD 0): 393 calls, 2,447,828 triangles in that
    view (no Ultra budget in the plan).
  - Budgets (`renderer.info`, shadow passes included): High worst 228 calls and 680,195 triangles over P1a's nine
    views, and 193 calls, 690,134 triangles in the action views (joined, third person; limits 350 and 700k); Low
    worst 118 calls and 242,295 triangles over P1a's seven views (limits 150 and 250k), and in the phone action views
    73 calls and 161k triangles joined, 64 and 122k holding (as the check prints them).
  - `stats()` on High at the start, Sat 21:00: npcs 9, groups 2, staff 3, seated 0, walkers 0, npcsDrawn 7, npcTris
    10,852, npcCalls 7, draw calls 231, triangles 655,584, sim 0 ms, frame 6.2 ms (CPU time in SwiftShader, not a
    frame rate), crowd built in 15,063 ms. On Low (390x844): 100 calls, 219,370 triangles, crowd built in 10,964 ms.
- **Screenshots** (`tests/out/onfoot/`): `onfoot-1280x720-act-{tap-to-go,sit,order-sheet,making,ready,holding,
  holding-third,ready-truck,holding-noodles,seated-holding,joined,joined-third,left,wall-tap,joined-ultra}.png`,
  `onfoot-390x844-act-{tap-to-go,sit,order-sheet,making,ready,holding,joined,reply,left}.png`, and P1a's views re-shot
  with the people in them.
- **Not done or not measured**: frame rates on a phone or a GPU; the crowd at full scale (40 NPCs, arrivals,
  walkers, seated groups, the crowd curve driving numbers) is the next milestone. Building the nine people takes
  10 to 15 s of the load here. The people builder's own limits show up close (LOD 1 faces at conversation distance
  are soft; some outfits showed skin-coloured patches at the neckline, fixed for the regulars in the repair below,
  and some flats read as bare feet); staff wear our
  patina-green tops because the builder has no apron garment; the hold pose and nods are applied over the
  builder's animation from `npcs.ts` (the builder's files are unchanged). The forecourt north of the Shed is unlit
  at night (P1a).
## 2026-10-21: Stoppage Time S1, the venue and your avatar in it (a standalone page; built and re-verified through 2026-11-02, committed)

Phase S1 of `PROJECT_OC_SPORTS_BAR.md`, built on `claude/sports-bar` after merging Lot 57's committed P1a
(`claude/onfoot` ab9fbe1; merge commit ce67d8f, the only commit of this pass; the build itself is uncommitted, as the
workflow asked). Stoppage Time is our own fictional sports bar at the real site on South Claudina Way, Anaheim: our
name, look, interior and menu. The twelve screens show a still test card tagged "SIMULATED"; the crowd chip reads the
schedule's level ("Simulated crowd · Packed") and no people are built yet (S3a). Nothing on the page is live, nothing
costs money, and Ultra is an entitlement flag only (test hooks and `?ultra=1`; no price, no purchase path). Lot 57's
files (`src/onfoot/lot57/`, `main.ts`, `index.html`), `src/onfoot/people/`, the game's code and its configs are
unchanged.

- **First, the re-measure (open item O1).** Every row of "Lot 57's numbers, as measured" was read again at ab9fbe1.
  Moved, and updated in the plan with the commit and date: L2 (`ParkedCars` takes a fourth argument, `farDetail`), L3
  (12, 24 and 40 detailed parked cars), L5 (the far detailed cars don't cast), L7 (your car's lamps off), L9 (Lot 57's
  avatar LOD 0 now on High and Ultra, built at load), L11 (Lot 57 instances only palms now) and L20 (a slice-trimming
  plugin). L1 (`PRESET`), L4, L6, L8, L10, L12 to L19 and L21 are unchanged. No contract the bar relies on broke (the
  changes are additive). The `people/` internals (O2) are unchanged. The Retro module (O15) is still uncommitted on
  `claude/modes`; its API holds (`RetroWorld` gains an optional `sun`), so the bar's Low draws standard materials at
  full resolution until it merges. No sum moved. Both scripts re-run: they now compute the frame from building 61 as
  the page does, which moves one barrier-gate point 126 m out across the front sector's line (39 near points, 497 far;
  was 38 and 498).
- **What was built** (all new: `src/onfoot/sportsbar.html`, `src/onfoot/vite.sportsbar.config.ts`,
  `src/onfoot/engine/`, `src/onfoot/venues/sportsbar/`, `tests/sportsbar.mjs`, `tests/sportsbar-shoot.mjs`; 3,387
  lines of TypeScript, 141 of HTML):
  - **The page and its build.** `npx vite build --config src/onfoot/vite.sportsbar.config.ts` writes one file,
    `dist/sportsbar/sportsbar.html` (1,382 KB, 460 KB gzipped), which opens from disk. Its own config, so the game's
    and Lot 57's don't change; it trims the bar's slice to the fields the page reads at build time.
  - **The engine facade** (`src/onfoot/engine/`): re-exports of Lot 57's modules (never its data, coords or main), and
    the new `frame.ts` (the building frame, computed from building 61's ring: worst 0.065 m against the plan's
    table), `schedule.ts` (the business day, open and closed hours, the crowd share), `venue-def.ts`, `streets.ts` (the
    near and far street sets, the I-5's bridges and ramps under the bridge rule, the light streams) and `overhead.ts`
    (the overhead camera: pan, pinch, twist, 45-degree steps).
  - **The venue** (`venues/sportsbar/`): the bar and back bar, 12 screens, 2 pool tables, 3 dart boards, the
    shuffleboard, high-tops, booths, the patio with its pergola, heaters and planters, the front walk, ramp, bike rack
    and doors; 91 seats and 46 standing, watching, game and staff spots; 83 object colliders; the lot (55 stalls,
    your car and its 152-triangle stand-in, 7 pole lights, aisle 416 redrawn as ours); 6 palms and 4 shade trees at
    the script's spots.
  - **Views and controls**: first person, third person and overhead (the walls facing the camera cut away), tap to go
    and sit, stick and keyboard, the action button; the hours and closed doors from the schedule.
  - **Graphics**: Low (full resolution, no shadow map, the far set simple), HD (2048 sun map, bloom, 2 pool spot
    lights) and Ultra (4096 sun map, GTAO, bloom, rect-area and heater lights, the pool spots casting, the far set in
    full, the high-quality parked cars, your avatar's LOD 0 in third person). Inside, outside and overhead states set
    what's drawn (the parked cars near you, your car or its stand-in); your avatar casts through a hidden LOD 1 caster;
    the shadow maps are drawn once a frame.
  - **Hooks** on `window.__onfoot` (Lot 57's names and the bar's: `stats`, `breakdown`, `vis`, `pose`, `frame`,
    `layout`, `streetSets`, `bridges`, `crossings`, `peopleCosts`, `debug` and more).
- **Found by looking at the screenshots, and fixed in this pass:** white pendant shades, pergola light strips too
  bright by day, a white-looking oak, a violet facade that read black and a lot too dark at night; then, in the last
  round (before and after images in `tests/out/sportsbar/probe/`):
  1. **At Ultra the lot went near black at noon** under the lot lights' pools, and the mountains dark slate. GTAO's
     normal pass drew the pools and the game's mountain ring, which carry no normals, as surfaces facing nowhere. The
     AO pass now leaves out every mesh with no normals or no depth write. Before:
     `before-s1-shadow-ultra-first-lot-noon.png`, `before-s1-door-front-out-ultra-1200.png`; after:
     `probe-1280x720-ultra-down-a.png`, `probe-1280x720-ultra-a.png`. `stats().ao` now measures that pass as drawn,
     and the budgets check uses it.
  2. **At 844x390 on Low the lot drew as bare ground** from the spawn (not at 390x844 or 1280x720 from the same spot):
     the 3200 m ground quad beat the asphalt 4.2 cm above it on depth at that one view. The ground's material now has
     a polygon offset pushing it back. Before: `before-s1-844x390-low-spawn-noon.png`; after: `probe-844x390-low-a.png`.
  3. **The pool tables read black at night on Low.** They're their own meshes (for Ultra's pool spots), outside the
     kit, so they missed its night-light bake, and Low has no pool spots. The page now bakes them too. Before:
     `before-s1-844x390-low-door-night.png`; after: `probe-844x390-low-door-night.png`.
  4. **At 640x360 the hours pill ran under the view button.** Between 521 and 760 px wide it now drops the bar's name
     (`s1-closed-640x360-tue0930.png`).
  Lot 57's page shares 1 and 2; the handoff tells its owners (`PROJECT_OC_HANDOFF.md`, "For Lot 57's owners", items 3
  and 4). Open item O34 records both.
- **Checked** with `node tests/sportsbar.mjs` (headless Chromium, `--use-angle=swiftshader
  --enable-unsafe-swiftshader`, one browser at a time, on a shared machine at a load of about 15).
  Two runs make the record, both on this machine: run 2 (07:53 to 09:18 UTC, the whole suite, 138 of 139: the one
  failure was the cars check reading drawn triangles, since rewritten to count your car's whole body) and run 3 on the
  final build (closed, honesty, cars, budgets, shadows and shots again, after the four fixes above: 86 of 86 pass,
    09:40 to 10:09 UTC). The Ultra door crossings were run again on the final build too (run 4,
  `s1-run-4-cross-ultra.log`, 9 of 9 pass, 10:01 to
  10:10 UTC). The groups not run again (data, walks, seats, the Low and HD crossings, rates) test code the fixes don't
  touch; their numbers are run 2's. Results are merged into `tests/out/sportsbar/sportsbar-checks.json`; the logs are
  `tests/out/sportsbar/logs/s1-run-2.log` and `s1-run-3.log`. `npx tsc --noEmit` is clean.
  - **Boots with no console errors** at 1280x720, 844x390 and 390x844 (touch) and 640x360, at Low, HD and Ultra.
  - **The data** (all pass): the frame matches the building-frame table to 0.065 m over 5 points and the bar's point
    lands in our unit; the built near set is exactly the script's (streets 60, buildings 8, land use 0, water 0,
    infrastructure shapes 33, points 39; far 554, 417, 67, 18, 172, 497); 12 near batches plus 2 stream meshes (at most
    14 calls) and 4 far simple batches; the light streams only on the five near carriageway pieces (northbound 560 into
    362, 1,035 m; southbound 222, 358, 438, 974 m; lamps 0.6 to 8.2 m up); the I-5 drawn (five carriageway pieces 14 m
    wide, seven links 8 m); the bridge rule (98 piers built, 64 near; 33 left out, 19 near, as the script prints; 393
    connectors, worst height spread 0 m; 58 crossings without a junction all clear 5.5 m or lie in the 5 tunnels); the
    10 trees within 0.000 m of the script's spots in 4 instanced meshes; the front fits (walk 0.40 m, ramp 0.41 m, bikes
    0.81 m, planters 1.02 and 1.00 m, patio 1.88 m from aisle 416's ribbon; the ribbon 3.72 m from building 61); 12
    zones and 107 slots inside the walls, 14 patio zones and 30 slots inside the fence; nothing overlaps (26 zones, 137
    slots, 83 colliders; the shuffleboard's thrower 1.59 m from the first stool); walking on Lot 57's real grid at the
    page's offset, all 137 stand points within 0.413 m of a reachable cell, H 0.052 m, no reachable cell in the lane or
    the flap (11,641 cells reached); the lane path 16.32 m with least clearance 0.10 m; 6 walks at the counter's ends,
    the gate and the flap (1,440 positions) never in the lane; 55 stalls in 4 rows, fill bias 0.834.
  - **1,000 random walks** (500 tap-to-go, 500 stick; 1,068,196 positions over 25,822 m against 173 colliders): none
    ends inside a collider or crosses a wall, the patio fence or the party wall; the checker itself catches a path
    through the front glass, the party wall, the fence and a pool table.
  - **Seats:** tap to go reaches all 91 seats from just inside the front door and sits you down (paths up to 34.93 m);
    sit and stand work on a stool, a high-top, a bench and a picnic seat.
  - **Closed hours** (Tue 09:30): both doors locked, a tap inside from the front walk has no path, the walk to your car
    arrives; the pill reads "Tue 09:30 · Closed · opens 11:00" and the chip "Simulated crowd · Closed".
  - **Honesty:** the real name nowhere in `src/` or the built page (150 files); no "live" on any canvas (35 strings) and
    only inside the allowed negations in the UI (49 strings, every sheet opened); no places file and no part of Lot 57's
    slice in the page, the bar slice's own description in it; the chip and the credit on screen at 1280x720.
  - **The door crossings** at Low, HD and Ultra, both doors, first and third person (162 steps each): the state flips
    on the crossing frame (step 49 first person, 151 third); the 14 near and 4 far (15 at Ultra) street meshes and the
    4 tree meshes are the same on both sides; the sun's casters are the same (40 at HD, 44 at Ultra); the only swaps are
    the parked cars near you (0 to 4, 12 and 36) and your car (stand-in to detailed at Low and HD; detailed on both
    sides at Ultra).
  - **The budgets without people or items** at the five poses (844x390, and `door` and `overhead` at 390x844), Saturday
    21:00, all pass: `stats().pass` less your avatar's own body is inside the row at every pose, `breakdown()` agrees
    with the pass within 1%, and one frame's `renderer.info` is the pass, the AO pass at Ultra, each map once and the
    post. The worst of each preset (pass less your avatar, of the row): Low 99/136.3k of 119/177.8k outside (`stall`)
    and 71/67.0k of 74/101.4k inside (`tv-east`); HD 111/223.6k of 139/328.2k (`overhead`) and 71/73.1k of 94/174.4k;
    Ultra 120/426.2k of 159/611.4k (`overhead`), 117/421.9k (`stall`) and 99/223.4k of 139/415.4k inside. Whole frames:
    Low 62 to 100 calls and 62.8k to 144.1k; HD 107 to 187 and 128.5k to 446.4k; Ultra 258 to 355 and 405.9k to
    1,525.4k (the sun's map 33 to 67 calls and 83.3k to 372.4k; each pool spot's map 22 to 27 calls and 228 triangles,
    frozen outside; the AO pass 59 to 117 calls; post 14 at HD, 18 at Ultra). Your avatar's caster drops the sun's map
    by 11,762 triangles at every HD and Ultra pose. The street sets come to 18 calls and 38.1k at Low, 18 and 38.5k
    at HD, 29 and 78.2k at Ultra (allocated 20/35k, 30/60k and 40/120k): the streets run 3.1k over Low's allocation,
    the venue 33.5k under its own (16.5k of 50k), and no pose's pass leaves its row, so no fallback was taken. (The
    review held this against S1: the plan's check says all the streets within their row. The repair below moved 5k of
    Low's venue row to its streets', 45k and 40k, and the suite now checks it.)
  - **Rates** here (844x390, the `door` pose; SwiftShader on a shared machine at a load of about 15, not a phone):
    after a switch, 3 warm-up frames took 6.4 s at Low, 8.6 s at HD and 19.0 s at Ultra, then 1.06, 0.55 and 0.30 frames
    a second, the page's own CPU 1.5, 4.1 and 9.2 ms a frame. Load to walkable: 11.5 to 14.8 s at Low.
  - **The people builder** (open item O3, `peopleCosts()`): an NPC at phone quality 1,136, 6,651 and 58,541 triangles
    at LOD 2, 1 and 0 (LOD 0 18 calls, built in 8.2 s), at high quality 1,136, 10,105 and 139,943 (11.5 s); your driver
    at phone 1,508, 7,810 and 66,693 (19 calls, 6.4 s), at high 1,508, 11,762 and 158,252 (8.7 s).
  - **Your avatar's shadow** at HD and Ultra, first and third person, in the lot and on the front walk at noon (the
    sun behind the camera): all pass. The sun's map drops by 11.8k triangles when the caster's `castShadow` is turned
    off; in first person the avatar draws 1 call and 0 triangles in the pass (the hidden caster); at Ultra in third
    person the LOD 0 shows (21 calls, 158,372 triangles) and only its hidden LOD 1 casts. The shadow shows in the four
    first-person shots (`s1-shadow-{high,ultra}-first-{lot,walk}-noon.png`).
  - **The cars as measured:** your car (the default) 62.2k triangles in 25 meshes at Low and 118.3k at HD and Ultra;
    the parked cars near you at the `stall` pose 4 detailed and 39 stand-ins, 17.4k in 13 calls at Low (cap 17.4k), 12
    and 31, 33.5k in 17 calls at HD (cap 39.3k), 36 and 7, 201.1k in 20 calls at Ultra (cap 202.7k); switching between
    HD and Ultra rebuilds the same 43 cars in the same stalls (13 sedans, 16 SUVs, 2 coupes, 8 pickups, 4 vans, same
    colours). The other three of your four cars were not measured (the plan's "never over 65.6k and 121.1k").
  - **Screenshots** (all in `tests/out/sportsbar/`; every one cited here was looked at). The phase's set, from run 3's
    final build: 1280x720 at HD, noon and Saturday 21:00, `door`, `bar`, `tv`, `pool`, `spawn`, `patio` (third
    person), `overhead` (walls cut away), `exterior`, `freeway` (from the patio rail) and `katella` (a fixed camera on
    the I-5 bridge from East Katella) (`s1-1280x720-high-*-{noon,night}.png`, 20); 844x390 at Low, `door`, `spawn`,
    `patio`, `overhead`, `exterior`, noon and night (`s1-844x390-low-*.png`, 10); 390x844 at Low, `door`, `spawn`,
    `overhead`, noon and night (`s1-390x844-low-*.png`, 6); 1280x720 at Ultra, `door`, `patio`, `exterior` at night
    (`s1-1280x720-ultra-*-night.png`, 3); closed hours at 640x360 (`s1-closed-640x360-tue0930.png`); the honesty
    shot (`s1-1280x720-spawn-night.png`); the 8 shadow shots; and the door crossings, both doors, inside and out, noon
    and night, at each preset (`s1-door-{front,patio}-{in,out}-{low,high,ultra}-{1200,2100}.png`, 24; the Ultra eight
    shot again on the final build, below). Run 3's 39 phase shots were compared pixel by pixel with run 2's, which
    were all looked at: the 13 that changed in more than 0.2% of their pixels were looked at again (the fixes show
    where expected: the lot's asphalt at 844x390, the pool tables at night, the Ultra night shots); the other 26
    differ in under 0.2% of their pixels. The Low and HD door-crossing shots are run 2's.
  - **Does it read as a believable neighbourhood sports bar in a SoCal strip?** S1 said yes, to this eye: a violet
    unit with a lit wordmark over a glazed front, a long oak bar with a back bar of bottles under a row of screens, two
    pool tables under long shades, booths and high-tops, a pergola patio with heaters by the I-5, palms and a striped
    lot. **The review found what that look missed** (in S1's own overhead shots, and by trying to break the page):
    the brand neon over the restrooms was mirrored and read "ball, backwards 3, plus"; the three dartboards were
    invisible (each board's face sat inside its black backboard's box, so the darts zone showed three black
    rectangles); the chalk centre circle wasn't drawn at all (its quads faced down: the frame's (u, v) mirrors
    three.js's (x, z), so a quad's corner order alone didn't say which way it faced; the oche line was the same); the
    ceiling was a black void at noon and at night (one cap in near-black paint), reading as a room open to a black
    sky; and the pool tables were plain boxes with a felt inset (their pockets were tiny boxes buried inside the rails).
    **All five are fixed in the repair below** and were looked at in the repair's shots: the neon reads "+3" and the
    ball, the boards show their faces, the circle, its spot and the halfway line are drawn, the room has a pale
    suspended tile ceiling on a dark T-bar grid with diffusers, and the tables have rails, cushions, six pockets and
    diamond sights. Still weak, for S3a and S4: no people, the night outside very dark beyond the lamps, and the
    ceiling's tiles read a little warm under the interior light.
- **The repair after review (same day, 12:00 to 17:00 UTC; the first pass was cut off at about 14:17 when the machine
  restarted, mid-way through its last suite run, and a second pass finished it).** Two reviews rejected S1 on defects its checks
  didn't cover (the play review: the neon, the dartboards, tap to go, the chalk circle, the ceiling and the pool tables;
  the code review: the light streams, disposal, a never-drawn pool-spot map, per-frame allocations and Low's streets
  row). Every item was fixed, as asked, keeping the rest:
  - **The neon** over the restrooms (`venue.ts`): a viewer facing +v has +u on the left, so the glyphs are now laid
    out mirrored about the board's centre (u 29.06): "+3" then the ball. Before and after, cropped from the overhead
    shots: `tests/out/sportsbar/probe-r2/before-overhead-neon-crop.png` ("ball, backwards 3, plus") and
    `after-overhead-neon-crop-r2.png` ("+3", ball); the close-up `s1-1280x720-high-neon-{noon,night}-r2.png`.
  - **The dartboards:** each face moved 1 cm in front of its backboard (v 15.69; the backboard is v 15.70 to 15.75).
    New check (data group): a ray from each oche point at bullseye height meets `bar-signs` first, at 2.31 m, before
    `bar-paint` at 2.32 m, at all three boards. Shot: `s1-1280x720-high-darts-{noon,night}-r2.png`.
  - **Tap to go from the customer side** (`main.ts`, `tapGo`): a tap whose point or ray lies inside the unit but not on
    free floor now goes to the nearest free cell that is also inside, within 4 m of the tapped point (on your side of
    it when there's one there); with none, the "Can't get there from here" toast. The review asked for 3 m. Built
    exactly that way, the data group refused three of the review's own seven test taps (the bottle wall from u 18 and
    from u 22, and the screen over u 18.7: nothing free inside within 3 m, since the tapped points lie at v 15.49 to
    15.67 and the nearest free cells on the customer side at v 12.27 to 12.45, past the 2.5 m-deep bar and the stools'
    clearance; `tests/out/sportsbar/logs/s1-r2-tap-3m-probe.log`, about 15:45 UTC), so the radius is 4 m: the seven
    taps snap 1.31, 2.63, 2.99, 3.00, 3.09, 3.16 and 3.25 m. (The first pass of this repair also walked back along
    your line of sight, with no limit, when nothing lay within 4 m; that fallback is gone, so beyond 4 m a tap is
    refused, as the review asked.) New check (data group): the seven taps from the customer side (the bottle wall at u
    18 and 22 and at an angle from u 10, three bar screens, the counter top) each snap within 4 m and end inside, on
    the customer side, 0.54 to 1.03 m from the counter's edge (S1 walked the first out of the front door to the
    courtyard at u 17.7, v 16.9); `tapLook()` now reports each tap's snap.
  - **The chalk centre circle and the oche line:** every floor quad in `venue.ts` is now wound to face up whatever the
    frame's handedness (`fquad` uses `quadTo` with an up vector); the marks' material already had a polygon offset
    over the floor's (-4 against -2). Shot looking down from 2.75 m at (33.5, 4.75): `s1-1280x720-high-circle-noon-r2.png`
    (the circle, its spot and the halfway line).
  - **The ceiling:** a suspended acoustic-tile ceiling, pale violet-grey (`0x8c8698`) subdivided so the baked light
    reads on it, with a little interior glow of its own (dark when closed), on a dark T-bar grid (2 x 4 ft) with eight
    square diffusers, all in the existing `unit-ceiling` batch (no new call; hidden overhead as before). Shots:
    `s1-1280x720-high-ceiling-{noon,night}-r2.png` and every interior shot.
  - **The pool tables:** oak rails round a night-violet bed, cloth cushions broken at the pockets, six black pocket
    mouths through the rails' tops and 18 mother-of-pearl sights; 684 triangles a table and lamp (was 228), in the same
    two meshes. Shots: `s1-1280x720-high-pool-{noon,night}-r2.png`, `door`.
  - **The light streams** (`engine/streets.ts`): `update()` takes the preset's car count and shares it over both
    chains by length (Low 100: northbound 52, southbound 48; HD 200: 103 and 97; Ultra 400: 206 and 194); the page's
    clamp after it is gone. New check (data group) at all three presets; shots `s1-1280x720-high-freeway-night-r2.png`
    and `s1-844x390-low-freeway-{noon,night}-r2.png`.
  - **Disposal on a switch** (`main.ts`): the post chain's passes before the composer; the far set's old geometries
    (`rebuildFar`); the old trees' instanced meshes; your old car's geometries and its own materials; and three leaks
    the new check found beyond the review's list: Lot 57's `ParkedCars.dispose()` leaves each set's model geometries
    and stand-in material (25 geometries a rebuild), the people builder's `dispose()` leaves the skeleton's bone
    texture, and the game's `Environment.rebuildEnv()` frees its PMREM texture but not the render target (one 768 x
    1024 target every clock change). The page frees all three itself (the files are unchanged; `PROJECT_OC_HANDOFF.md`,
    "For Lot 57's owners", items 5 to 7). New memory group: Low, HD, Ultra, HD, Low twice with a pose each; before
    the fixes each round added 6 textures and 50 geometries; now the first round leaves 28 textures and 1 geometry more than the
    start, which a debugging pass traced to what the game keeps on purpose (the car builder's cached high-quality
    maps, about 19 data textures; 9 canvas and small data textures made at load and first drawn at HD; the sun's 2048
    map, which the game's environment keeps allocated at Low), and the second round comes back to exactly the first's
    50 textures and 97 geometries (the check).
  - **Ultra's pool-spot maps** (`visibility.ts`): a spot frozen before its map was ever drawn is drawn once on the next
    frame (`needsUpdate`), so an Ultra page that opens outside doesn't sample an empty map through the glass.
  - **Per-frame allocations:** `poseDoors` (venue.ts: its THREE objects made once, and each leaf's line along its wall
    worked out at build, so the leaves' wall points are no longer arrays made a frame), `setOverheadCut` and
    `nearPoint` (main.ts), `BarInput.takeOver()` (two tap lists that swap) and your avatar's key (four fields compared)
    allocate nothing a frame now; so do two more found on the way, the doors' approach test (the doors' centres in
    local metres, worked out once) and `visibility.ts`'s state test (the camera's frame coordinates inline).
  - **Low's rows** (the plan, "The allocations"; O4): the fallback (dropping the near set's markings, 2.4k) would have
    left the streets at about 35.7k, still over 35k, so 5k moved from Low's venue row to its streets' (45k and 40k; the
    near set's rows at Low and HD to 16k); the sums and the "without people or items" rows don't move.
    `venues/sportsbar/def.ts` carries the rows (`ALLOC`); the data group checks all the streets as built at every
    preset (Low 18/38.1k of 20/40k, HD 18/38.5k of 30/60k, Ultra 29/78.2k of 40/120k) and the budgets group the
    venue, the streets and the trees as drawn at every pose.
  - **Checked** on the final build with the whole suite in one run, one browser: `node tests/sportsbar.mjs --tag=r2`
    (`tests/out/sportsbar/logs/s1-r2-final.log`, 15:48 to 16:58 UTC, the machine at a load of 7 to 13). **156 of 156
    pass.** The merged results file (`tests/out/sportsbar/sportsbar-checks.json`) was started afresh for this run, so
    it holds this run alone (the earlier file, with S1's and the first pass's results, is kept as
    `logs/sportsbar-checks-before-r2-final.json`). The built page was then rebuilt from the final sources and is
    byte-identical to the one tested (sha256 91fc2216...e58f8); `npx tsc --noEmit` is clean. The first pass's runs
    (`s1-r2-run-1.log` to `s1-r2-run-3.log`, 12:54 to 14:16) are superseded: they tested a build before the tap rule's
    final form and the last allocation fixes, and run 3 died with the restart. What the run shows:
    - **The data** (19 checks): all of S1's, as before (the frame 0.065 m; the near and far sets exactly the script's;
      the bridge rule; the trees; the front; the zones and slots; nothing overlaps; the real grid; the lane path; the
      stalls), and the repair's four: the darts (each oche's ray meets the board's face at 2.31 m, before `bar-paint` at
      2.32 m), tap to go from the customer side (seven taps, snaps 1.31 to 3.25 m, each ending inside 0.54 to 1.03 m from
      the counter's edge), the light streams at Low, HD and Ultra (100, 200 and 400 cars; northbound 52, 103 and 206,
      southbound 48, 97 and 194, by the chains' 1,035 and 974 m), and all the streets as built within their rows (Low
      18/38.1k of 20/40k, near 14/14.7k of 14/16k; HD 18/38.5k of 30/60k, near 14/15.1k of 14/16k; Ultra 29/78.2k of
      40/120k, near 14/15.9k of 15/25k).
    - **1,000 random walks** (500 by tap to go, through the 4 m rule; 1,068,196 positions over 25,822 m): none ends in a
      collider or crosses a wall, the fence or the party wall (1 tap had no path, 499 arrived); **seats:** all 91
      reached and sat in; sit and stand on each kind; **closed hours** and **honesty** as before (150 files clean; 35
      canvas and 49 UI strings clean; no places file or Lot 57 slice in the 1,357 KB page; the chip and credit on
      screen).
    - **The door crossings** at Low, HD and Ultra, both doors, first and third person: the state flips on the crossing
      frame (step 49 and 151); the same 14 near and 4 far (15 at Ultra) street meshes and 4 tree meshes on both sides;
      the same 40 (HD) and 44 (Ultra) sun casters; the only swaps the parked cars near you (0 to 4, 12 and 36) and your
      car (stand-in to detailed at Low and HD).
    - **The budgets** at every pose and preset, the same figures as the first pass: the venue 35 to 39 calls and 17.1k
      to 19.1k; each pool spot's map 684 triangles; the worst pass less your avatar Low 99/138.9k of 119/177.8k
      (`stall`), HD 111/224.5k of 139/328.2k (`overhead`), Ultra 120/427.1k of 159/611.4k (`overhead`); whole frames
      Low 62 to 100 calls and 65.4k to 146.7k, HD 107 to 187 and 132.0k to 448.2k, Ultra 258 to 355 and 413.0k to
      1,531.6k; post 14 at HD and 18 at Ultra; your avatar's caster drops the sun's map by 11,762 at every HD and Ultra
      pose; `breakdown()` within 1% everywhere.
    - **Rates** (844x390, `door`): after a switch, 3 warm-up frames 2.0 s at Low, 2.8 s at HD and 4.5 s at Ultra, then
      1.04, 0.76 and 0.39 frames a second, the page's CPU 1.6, 7.6 and 7.1 ms a frame; load to walkable (`buildMs`)
      7.6 s at Low. SwiftShader on a shared machine, not a phone.
    - **Shadows** at HD and Ultra, first and third person, lot and front walk at noon: all pass as in S1 (the sun's map
      drops 11.8k with the caster off; 1 call and 0 triangles in the pass in first person and under Ultra's LOD 0, 21
      calls and 158,372 triangles for the LOD 0 itself); new: an Ultra page opened outside has both pool spots' maps
      frozen and drawn once (`vis().poolSpots[].drawn`).
    - **Cars** as in S1 (your car 62.2k and 118.3k; parked 17.4k, 33.5k and 201.1k under their caps; the same 43 cars
      after a switch); **memory:** Low, HD, Ultra, HD, Low twice: 22 textures and 96 geometries at the start, 50 and
      97 after the first round (the caches above), and 50 and 97 again after the second (no growth); **Lot 57's page**
      still builds with its own config (1,069.80 kB).
  - **Screenshots**, all with `-r2` names in `tests/out/sportsbar/`, all from this run, every one looked at (the door,
    shadow, Low and Ultra-outside sets through contact sheets of two to six; the rest one by one): 1280x720 at HD,
    noon and Saturday 21:00, the phase's ten views and the repair's four
    (`s1-1280x720-high-{door,bar,tv,pool,spawn,patio,overhead,exterior,freeway,katella,darts,neon,circle,ceiling}-{noon,night}-r2.png`,
    28); 844x390 at Low, with the freeway view (`s1-844x390-low-{door,spawn,patio,overhead,exterior,freeway}-{noon,night}-r2.png`,
    12); 390x844 at Low (`s1-390x844-low-{door,spawn,overhead}-{noon,night}-r2.png`, 6); Ultra at night
    (`s1-1280x720-ultra-{door,patio,exterior}-night-r2.png`, 3); the closed and honesty shots
    (`s1-closed-640x360-tue0930-r2.png`, `s1-1280x720-spawn-night-r2.png`); the 8 shadow shots
    (`s1-shadow-{high,ultra}-{first,third}-{lot,walk}-noon-r2.png`) and the 24 door shots
    (`s1-door-{front,patio}-{in,out}-{low,high,ultra}-{1200,2100}-r2.png`). Before and after, in
    `tests/out/sportsbar/probe-r2/`: the neon cropped from the overhead (`before-overhead-neon-crop.png`, S1's: "ball,
    backwards 3, plus"; `after-overhead-neon-crop-r2.png`, cropped from this run's `overhead-noon`: "+3", ball), and
    the I-5 from 90 m over the lot at 21:00 on HD (`before-1280x720-high-i5-night.png`, S1's build: one line of lights
    on the northbound carriageway; `after-1280x720-high-i5-night-r2.png`, the first pass's build, whose streams code
    is the final one: both carriageways). From the patio rail (`freeway-night`) the trees and the pergola hide most of
    both carriageways and the lights read as one dotted band; at Low (no bloom, 100 cars) they are a few faint specks
    on the horizon. **Looked at for the brief's question again:** the boards show their faces; the neon reads "+3"
    and the ball; the circle, its spot and the halfway line are on the floor; the room has a pale tile ceiling on a
    dark grid with diffusers, at noon and at night; the pool tables have rails, pockets and sights. With those, the
    inside reads as a finished SoCal strip-mall sports bar at noon and at night, and through the glazing from the lot
    at night (the lit ceiling and the screens show from outside). Left for S3a and S4: no people, the night outside
    very dark beyond the lamps, the doors' leaves caught mid-slide in some shots, the tiles a little warm under the
    interior light, and the water station by the restrooms still a plain white box.
- **Lot 57 is unaffected.** Its page still builds with its own config (`dist/onfoot/index.html`, 1,069.80 kB), its
  files are untouched (`git status` shows no change under `src/onfoot/lot57/`, `main.ts`, `index.html` or `people/`),
  and its own suite passes unchanged: `node tests/onfoot.mjs` on its build, 35 of 35 (10:17 to 10:34 UTC;
  `tests/out/sportsbar/logs/lot57-suite-s1.log`), and again after the repair, on its page as the bar suite's `lot57`
  group rebuilt it from the final sources, 35 of 35 (17:00 to 17:28 UTC, at a load of about 14;
  `tests/out/sportsbar/logs/lot57-suite-s1-r2.log`, details in `tests/out/onfoot/onfoot-checks.json`).
- **Left open** (each in the plan's Open items table or the handoff):
  - **Retro** (O15): `claude/modes` hasn't merged, so Low is the standard materials at full resolution; S4 turns the
    Retro look on.
  - **Phones** (O30): nothing has run on a phone; every rate here is SwiftShader on a loaded shared machine.
  - **Low's streets** (O4): closed by the repair below (the rows re-allocated, the venue 45k and the streets 40k at
    Low, and the suite checking them).
  - **The night outside** reads very dark beyond the lamps (the front lot, the street, the freeway view); the doors'
    leaves are caught mid-slide in the door shots (a leaf takes 0.45 s to open and the page steps at most 0.1 s a frame,
    so a shot taken a few frames after a pose catches it moving). Both are for S4's light and look pass.
  - **Your car's other three bodies** weren't measured (only the default).
  - **Lot 57's `PRESET`** (L1) is re-synced again at S4 (O1).
  - **Lot 57's copies** of the GTAO and ground-depth flaws (O34) and of the two shadow flaws (O28) are its owners'.

## 2026-11-02: Lot 57 on foot, P1a finished and re-verified on the final build (35 of 35 checks)

The P1a builder of 2026-10-21 (entry below) was cut off mid-run: its last suite runs (17:45 and earlier) lost their
browser part-way, so nothing after its morning 26-check run had been verified end to end. This pass picked up the
drafts as they were on disk, finished the venue's dressing and re-ran the whole suite. The game's code, its
`vite.config.ts` and `package.json`, and the people builder (`src/onfoot/people/`) are unchanged.

- **What changed in this pass** (all in `src/onfoot/`):
  - The yard reads as a beer garden by day: a market umbrella through every communal table (cream canopy with a
    crown, a teal or patina valance, ribs and a runner underneath), four barrel standing tables between the tables (no
    seats; the Shed's barrels share the same code), a steel napkin and salt-and-pepper caddy at both ends of every
    table, and a chalkboard A-frame on the walk in at the front gate (our tap list).
  - The palms along Orangewood are now colliders (they had none, so you could walk through a trunk), and none stands
    in the middle of the walk to our front gate.
  - A soft pool of light on the ground under every street and lot head after dark (one additive draw call): the
    asphalt's dark colour swallowed the baked lamp light, so Orangewood read black between the lamps.
  - Your car is parked with its lamps off (it showed its headlamps lit in the lot at night).
  - Rounder bar stools and barrel tops on High and Ultra (16 and 24 sides); Low keeps cheaper ones, and on Low the
    table caddies, the umbrella ribs and four in nine of the bougainvillea leaves aren't drawn, which keeps Low inside
    its triangle budget (it was 253,577 of 250k after the dressing; now 245,487).
  - The male driver's build and face are a little broader (shoulders, jaw, brow): at third-person distance the
    builder's default male frame read narrow and soft in the fitted white shirt.
  - Toasts name the new obstacles ("A palm", "The chalkboard", the host stand, shelf, generator and propane cage).
- **Checked** with `node tests/onfoot.mjs` (headless Chromium, `--use-angle=swiftshader --enable-unsafe-swiftshader`,
  one browser at a time; 27 minutes on this shared machine). **35 of 35 pass** on the final build
  (`tests/out/onfoot/onfoot-checks.json` and `tests/out/onfoot/logs/onfoot-final-2026-11-02.log`, 2026-11-02 05:09
  UTC). `npx tsc --noEmit` is clean. Every screenshot below was looked at.
  - Boots with no console errors at 1280x720 (High), 844x390 and 390x844 (touch, Low by default) and 640x360 (walks).
  - Day (Sat 14:00) and night (Sat 21:00) screenshots at all three sizes, the "Simulated crowd" chip and the
    OpenStreetMap/Overture credit on screen and inside the viewport, clear of the action button.
  - 1,000 random walks (500 tap to go, 500 stick): 1,455,899 positions over 35,006 m, checked in Node against the 491
    exported colliders and the walkable region by an independent checker (which is shown to catch a made-up path
    through the Shed's wall, into a bench and onto the road): none ends inside a collider, leaves the area or crosses
    a wall or fence. All 445 tap-to-go walks with a path arrived; 55 taps had no path (shut or staff-only places).
  - Tap to go reaches all 172 seats from the front gate and from the lot walk and sits you down (344 walks, 14.0 to
    67.3 m); tap a bench seat, walk 6.78 m, Sit, Stand.
  - Touch (thumb pad 1.05 m, look drag 20 degrees, a quick tap starts a walk), keyboard (W 1.03 m) and a stubbed
    gamepad (left stick 1.11 m, Y to third person).
  - Reduced motion: head bob 3.0 cm to 0, the toast's transition 0 s. Closing (Tue 09:00) shows you out to the lot
    walk with "Closed · opens 11:00" and "Simulated crowd · Closed", and a tap into the yard finds no way in.
  - Budgets (`renderer.info`, shadow passes included): High worst 195 calls and 669,951 triangles over nine views
    (limit 350 and 700k); Low worst 118 calls and 245,487 triangles over seven views (limit 150 and 250k). Ultra (no
    budget in the plan): 264 calls and 2.08M triangles in the yard at night; 432 calls and 2.84M in third person with
    the close-up driver (158,252 triangles, 19 calls).
  - `stats()` on High in the day: npcs 0, groups 0, seated 0, walkers 0, 195 draw calls, 629,928 triangles, sim
    0 ms, frame 9.1 ms (the page's CPU time per frame in SwiftShader, not a frame rate). The crowd is P1b, so the
    people counts are 0 by design.
  - The real venue's name is in none of the 46 files in `src/onfoot`, `src/data/anaheim` and the built page; our
    names are on the page, and it never says "real-time" or "people here now".
- **Screenshots** (`tests/out/onfoot/`): `onfoot-1280x720-{day,third-day,third-front-day,trucks-day,night,
  third-night,shed-night,trucks-night,park-night,sign-night,sign-crosswalk-night,seated-night}.png`,
  `onfoot-1280x720-ultra-{night,trucks-night,shed-night,bar-night,sign-night,third-evening,lot-evening}.png`,
  `onfoot-1280x720-aerial-evening.png`, `onfoot-844x390-{day,night,sign-night}.png`,
  `onfoot-390x844-{day,night}.png`. (The "evening" shots are at 17:30, which in this week's season is after dark.)
- **Not done or not measured**: frame rates on a phone or a GPU; the crowd, Order, Join and Leave (P1b). The parked
  cars are the game's traffic models and read toy-like up close; the driver's look in third person (a dark notch at
  the fitted shirt's collar, a lumpy back) belongs to the people builder, which another session owns.

## 2026-10-21: Lot 57 on foot, P1a: the venue, your driver, controls, collisions and test hooks (standalone page)

*(Superseded by the 2026-11-02 entry above: the numbers below come from a 26-check run on the morning of
2026-10-21; later changes that day, such as the close-up driver on High, were never verified end to end.)*

Phase 1a of `PROJECT_OC_ON_FOOT.md`: a standalone page, not yet in the game. `src/onfoot/index.html` with its own
Vite config (`npx vite build --config src/onfoot/vite.config.ts` writes `dist/onfoot/index.html`, one file that opens
from disk; `npx vite --config src/onfoot/vite.config.ts` serves it). The game's code, `vite.config.ts` and
`package.json` are unchanged.

- **The venue, ours, built in code** (`src/onfoot/lot57/`): the Shed (brick-red tilt-up, five-tooth north-light
  sawtooth roof, four glass roll-up doors, our mural; inside a 16 m bar with 20 stools, a tap wall of plain coloured
  handles, eight tanks behind glass, six high-tops, barrel tables, a chalkboard of our own items and the game's local
  leaderboard labelled "this device only"), the yard (12 communal tables, 8 poles plus 4 over the lawn and trucks, 411
  bulbs on catenaries, 4 heaters), the lawn (three bag-toss lanes, a stacking-block table, lawn chairs), Two Lane
  Tacos and Night Shift Noodles with picnic tables, the planter wall and gate, our 6.5 m pylon sign with its reader
  board, the lot (stalls, wheel stops, a planted median, lot lights) with your car in your stall. Night light is baked
  per vertex; the gates and doors shut after our fictional hours and you are shown out.
- **Around it, from OpenStreetMap via Overture (ODbL, credited on screen)**: Orangewood and the Dupont loop, mapped
  sidewalks and crosswalks, the business park's footprints and heights, parking areas, land use, the stadium's light
  towers as plain massing. Road widths, markings, lamps, palms and the block's turf setbacks are our defaults. The real
  footprints in our site are dropped.
- **Your driver** (the people builder) in first and third person; LOD 1 on Low and High, the close-up LOD 0 in third
  person on Ultra.
- **Controls**: touch (a floating thumb pad in the left 45%, a look drag on the right, tap to go), keyboard (WASD,
  Shift, E/Q/V/C, Esc) and gamepad (sticks, A/X/Y/B, Back, Start).
- **Collisions**: a 0.3 m body pushed out of every wall, fence, table, bench, truck, planter, pole and parked car
  (polygons, boxes, circles, segments in a 4 m hash), three passes a step; kerbs are walls except at crosswalks; tap to
  go on a 0.5 m grid with A*.
- **Test hooks** on `window.__onfoot`: `setClock(day, hour)`, `setQuality('low'|'high'|'ultra')`, `stats()` (npcs,
  groups, seated, walkers, drawCalls, triangles, simMs, frameMs and more), `go(x, z)`, `tap(x, z)`, `act()`,
  `view()`, `frames`, plus `look`, `walk`, `sim`, `pos`, `colliders`, `region`, `seats`, `probe`, `breakdown`.
- **Not in P1a**: the crowd (NPCs, groups, staff) is P1b; `stats()` reports 0 people. The chip already shows the
  simulated level from the clock ("Simulated crowd · Packed" on a Saturday night).

Checked by `node tests/onfoot.mjs` (headless Chromium, SwiftShader; screenshots in `tests/out/onfoot/`):
- **26 of 26 checks pass** (`tests/out/onfoot/onfoot-checks.json`, 2026-10-21):
  - Boots with no console errors at 1280x720 (High), 844x390 and 390x844 (touch, Low: the default for a coarse
    pointer), and 640x360 (the walk run).
  - Day and night screenshots at all three sizes with the "Simulated crowd" chip and the OpenStreetMap/Overture credit
    on screen and readable (their boxes are checked to be inside the viewport and clear of the action button).
  - 1,000 random walks (500 tap to go, 500 stick, from seeded random free points) never end inside a collider, leave
    the walkable area or cross a wall or fence: 1,236,553 positions over 17,077 m, each checked in Node against the
    438 exported colliders and the walkable region by an independent checker. The checker is shown to fail on a made-up
    path through the Shed's west wall, into a bench and onto the road. 53 taps had no path (targets in staff-only or
    shut areas such as the tank room); they toast "Can't get there from here".
  - Touch: the thumb pad walks you 1.45 m in a few frames, a look drag turns you 20°, a quick tap starts a walk.
    Keyboard: W walks 1.33 m. Gamepad (a stubbed `navigator.getGamepads`): the left stick walks 0.89 m, Y switches to
    third person.
  - Tap a bench seat, walk there (6.78 m path), Sit, Stand with the action button.
  - Reduced motion: the head bob goes from 3.0 cm to 0, the toast's transition to 0 s.
  - At closing (Tue 09:00) you're shown out to the lot walk, the hours read "Closed · opens 11:00", the chip
    "Simulated crowd · Closed", and a tap into the yard finds no way in.
  - Budgets (`renderer.info`, shadow passes included): Low worst 106 calls and 234,067 triangles over seven views
    (limit 150 and 250k); High worst 178 calls and 677,790 triangles over the day, third-person, night and Shed views
    (limit 350 and 700k). Ultra (no budget in the plan) draws 213 calls and 1.31M triangles at night; in third person
    at dusk with the LOD 0 driver (159,850 triangles, 19 calls) it's 368 calls and 2.09M triangles (that view shot with
    `node tests/onfoot-shots.mjs`, `onfoot-1280x720-ultra-third-evening.png`).
  - The real venue's name appears in none of the 44 files in `src/onfoot`, `src/data/anaheim` and the built page; our
    names (LOT 57, Two Lane Tacos, Night Shift) are on the page, and it never says "real-time" or "people here now".
- **Fixes in this round**: Low was at 243k of its 250k triangles, so Low now draws 8-triangle bulbs and 12 detailed
  parked cars (16 before); High drew the close-up driver (LOD 0) in third person, 845k triangles with its shadow, so
  LOD 0 is now Ultra only; on High the bulbs are 36 triangles and the plants don't cast shadows. The idle body turns to
  face where you look (in third person it used to face the camera). The block's setbacks are turf, not bare dirt.
  Ultra builds the parked cars from the traffic models' high-quality set.
- **Not measured**: frame rates on a phone or a GPU. `frameMs` in `stats()` is the page's own CPU time per frame in
  SwiftShader, not a frame rate.

## 2026-10-21: the sports bar's site data and plan (Phase 0)

The owner asked for a playable Sims-like world at the Lopez & Lefty's site in Anaheim. We build our own sports bar
there, under our own name, with no real business's name, menu or look, and only fictional leagues and teams on the TVs.

- **Kept: the site data.** The Anaheim tools now take a `sportsbar` venue next to Lot 57 and produce the bar's street
  slice, places and freeway link from OpenStreetMap via Overture. A reviewer re-ran both pipelines in scratch copies:
  Lot 57's outputs are byte-identical to before (verify 12 of 12), and the bar's outputs reproduce byte for byte
  (verify 13 of 13).
- **Kept: the design plan** (`PROJECT_OC_SPORTS_BAR.md`), after a seventh pass. This round fixed all twelve items the
  round-6 review listed and added an "Open items for the builders" section near the top: every known gap or unchecked
  claim, with how and in which phase it gets resolved. Lot 57's parts are now described as contracts (names and what
  they promise), and every number read from Lot 57's code is marked with when it was measured; the first build step
  re-measures them. A reviewer checked the plan's three.js claims line by line against the installed library and re-ran
  both check scripts with matching results. Both reviewers accepted the plan; building phases S1 to S4 comes next.

## 2026-10-17: the navigation card, the destination card and blue chevrons on the road (UI pass, U2)

Panel 2 of the owner's concept board, built from `PROJECT_OC_UI_TARGET.md` (U2). It shows only with a route set
(Go to, or `navigateTo`), reuses the route planner and `Game.nextManoeuvre()`, and is hidden in races.

- **Navigation card** (top left on a wide screen): the manoeuvre's arrow in the route's blue (a fork for keep
  left/right, mirrored for left; straight on otherwise), the distance, "Keep right" and the road it leads to as a green
  guide sign ("CA-55 NORTH": the first freeway along the route, so a ramp signed for both directions reads the one you
  want), and under a hairline the next exit along this road with its real sign text from the map data ("Your exit" when
  it's the one the route takes, "Next exit" otherwise; on a ramp, "Now on" and the sign the ramp was taken from). A ramp
  that forks at its end now reads "Keep left/right" too, not "Continue". The stats plate moves under the card.
- **Destination card** (top right, under the corner window): the destination road and its distance along the route,
  the time at your pace (your speed damped over about 12 s; "–" when you're barely moving) labelled "at your pace", and
  the traffic setting labelled "simulated". The Minimal HUD tucks it away with the corner window.
- **Phone**: each folds into one line. The manoeuvre (arrow, distance, sign) sits under the road chip where the green
  prompt was; the destination line (time at your pace · traffic · simulated, plus the road when the sign doesn't
  already name it) sits above the chip, under the speed box and the corner window, so neither covers more road than
  the prompt did.
- **Chevrons** (`src/game/road/chevrons.ts`): one InstancedMesh of up to 81 flat quads every 4 m for 300 m, 7 cm over
  the road, fading in over the first 14 m and out over the last 150 m; on the lane the route needs (the exit lane within
  1600 m of a diverge, moving over from your lane with a smoothstep; the side a forking ramp goes; the outside lane where
  a ramp joins). Legs are worked out only when the route or your road changes (`chevrons.rebuilds`). A crisp core over
  an additive glow, blended premultiplied so the blue holds on sunlit concrete (pure additive washed out to near white
  there: the first capture). Seen from every camera; hidden with no route, in the attract drive, in races and in the
  corner's sky camera.
- **Open**: on a phone in the default driver's-seat view the HUD covers most of the chevrons; a layout fix to
  follow. Screenshots: `tests/out/ui-after/nav-phone.png`, `nav-desktop.png`, `nav-chevrons-chase.png`,
  `nav-chevrons-ramp.png`, `nav-sky-corner.png`, `tests/out/phone-nav.png` (local, not committed).
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "19/19 passed", including the new
  phone check "Go to: navigation line, destination line and road chevrons; Clear route hides them" (picks CA-55 North in
  Go to on a 390 × 844 phone: both lines one line tall, clear of each other and the road chip, nothing cut short, 72
  chevrons; Clear route hides both lines and all chevrons). `tests/out/u2-nav-shots.mjs` (Free Drive on I-405 North,
  route to CA-55 North, the car in lane 2 of 5 about 230 m before the 55's ramp): the chevrons read d = 0 m at 6 m ahead,
  2.2 m at 46 m, 6.7 m at 86 m and 7.3 m (the centre of lane 4, the exit lane) from 106 m on, then follow the ramp; on
  the two-lane ramp before it forks they keep to its right lane (d = 1.8 m), the side for the 55 North; the card says
  "730 ft · Keep right · CA-55 NORTH · Your exit: CA 55 North / CA 55 South / Freeway"; no clipped text, no sideways
  scroll; Clear route: no cards, 0 chevrons; no page errors at either size.
- **Screenshots** (tests/out/ui-after/): nav-phone.png, nav-desktop.png, nav-chevrons-chase.png, nav-chevrons-ramp.png,
  nav-sky-corner.png; tests/out/phone-nav.png from the suite.
- **Found, not fixed** (outside U2): the corner's sky camera draws in the wrong place when the render scale isn't 1
  (the Low preset's 0.75 on a desktop): `renderCorner` multiplies the scissor and viewport by the pixel ratio, and three.js
  multiplies them again, so the picture lands at 0.75 of its place and size on screen and the window stays blank
  (nav-sky-corner.png). Wherever the renderer's pixel ratio isn't 1 (a phone on Medium or up: 1.5 to 2) it lands
  scaled by that ratio instead. Passing CSS pixels (no `* pr`) should fix it.

## 2026-10-16: the adaptive HUD: a HUD style setting, a compass, a clock chip, auto-hide (UI pass, U1)

Panels 1 and 9 of the owner's concept board, built from `PROJECT_OC_UI_TARGET.md` (U1).

- **Status row, both styles**: a thin compass strip at the top centre (a tape of ticks with N E S W and the four
  between, under a sunset index; the bearing is the car's own, from its yaw) and a chip at the top right with this
  device's clock and the temperature the game simulates, labelled "simulated" (`Environment.tempF`: OC's coast by the
  hour, less a few degrees for the weather in force; a clear day reads 72°). The top bar and the corner window now sit
  one row lower, under it.
- **HUD style** (Settings, Display): Modern (the default: every control stays) or Minimal. In Minimal, after 4 s of
  just driving the top bar slides up and away and the corner window off the right edge (the game stops drawing it
  there); speed, gear, the stats, the route prompt and the ability ring stay. Pause stays too, as a round chip in the
  corner, so pausing is always one tap. With a route set, a round nav bubble takes the corner's place: the next
  manoeuvre's arrow (keep left, keep right, ahead) and the distance. A tap, a mouse move, a key or a pad button brings
  everything back; driving input (the pedals, the steering rail, W A S D and the arrows, Space, Q, E, V, the pad's
  triggers and handbrake and shift buttons) doesn't, or the road would never clear. Keyboard focus on a control of the
  bar keeps it up. Reduced motion: it just shows and hides, no slide.
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "18/18 passed", including the new
  phone check "HUD: compass and clock chip; Minimal tucks the bar away after 4 s, Pause stays, a tap brings it back"
  (it switches to Minimal through Pause, Settings, HUD style; reads 304° on I-405 North through Irvine, which runs
  northwest; then pauses from the round chip). `tests/out/u1-hud-shots.mjs` at 390x844 and 1440x900: Modern still up
  after 5.5 s; Minimal tucked away 3.5-4.2 s after the last input; a real tap (phone) or mouse move (desktop) brought it
  back; holding W did not; Tab did, and focus on "View" held the bar up past 6 s; with reduced motion the transitions
  are 0 s; no page errors.
- **Screenshots** (tests/out/ui-after/): hud-modern-phone.png, hud-modern-desktop.png, hud-minimal-shown-phone.png,
  hud-minimal-shown-desktop.png, hud-minimal-hidden-phone.png, hud-minimal-hidden-desktop.png, hud-settings-phone.png,
  hud-settings-desktop.png.

## 2026-10-16: the main menu is one glass sheet with a Drive dock (UI pass, U0)

The owner asked for a main menu that feels "more seamless" with "a finer luxury Apple-like aesthetic feel". Built from
`PROJECT_OC_UI_TARGET.md`, section "Owner's direction, 2026-10-16" (U0).

- **One sheet**: the menu is a single frosted-glass sheet over the live attract drive. Opening Settings, Bests,
  Profile, Driver, Garage, Start or Course changes what the sheet shows with a cross-fade; the sheet itself stays put
  instead of a new panel mounting.
- **The dock**: a Drive dock stays at the bottom while screens change, marks the screen you are on, and there is only
  one Drive button. Tapping the current screen's dock button returns to the menu.
- **The finish**: hairline borders, large soft radii, spacing on an 8 pt rhythm, the system font stack for text,
  CSS-drawn switches and segmented controls, visible focus rings, reduced motion respected. Chrome noir's base and
  yellow accent stay; the angled chips and magenta corners are gone.
- **Checked**: `npx tsc --noEmit` exits 0. `npm test -- --only=phone,launch,boot`: "17/17 passed, exit 0", including
  the new phone check "menu: one sheet; the Drive dock stays while its screens change" (result "same sheet, dock marks
  Settings, one Drive button"). A separate review script at 390x844 passed 14/14.
- **Screenshots** (tests/out/ui-after/): menu-before-phone.png, menu-before-desktop.png, menu-after-phone.png,
  menu-after-desktop.png, u0-crossfade-mid-phone.png, u0-crossfade-mid-desktop.png, u0-focus-phone.png,
  u0-focus-desktop.png, and the full set phone-*.png / desktop-*.png (menu, settings, bests, profile, driver, garage,
  start, course, loading, driving, goto, paused, results).

## 2026-10-16: traffic cars get door seams, mirrors and pillars; the player's door mirror loses its dark band (realism pass, W2)

Before, traffic bodies were smooth soap bars: no door cut lines, handles, pillars or plates, and a bare black box beside
each windscreen pillar for a mirror. Now every class carries, in its existing vertex-coloured trim mesh: door mirrors on
stalks (a pod with a glass facing back; west-coast mirrors on two arms on the box truck and semi), dark recessed
door-seam strips (front and rear door cuts; the van's sliding door; the pickup's cab-to-bed gap), door handles, a
black B-pillar and rear-door divider across the glass, wheel-arch liners, darker lower sills, blank licence plates
front and back (no text, no real format) and a third brake light under the roof's back edge (not on the box truck
or semi). The player's door mirror pod and stalk now use their own paint (`mirrorPaint`, no shut lines), so the
door's shut line no longer draws a dark band across the stalk; `PlayerCar.setPaint` tints both. Details in
`PROJECT_OC_TECHNICAL_NOTES.md` (traffic).

- Draw calls: traffic stays 49 instanced meshes (7 classes x 7). Whole frame at 960x540, High, same seeded road:
  chase 635 → 637, cockpit 778 → 780, hood 559 → 561; the +2 fits the player's one new mirror mesh in the colour
  and shadow passes, the only mesh added. Triangles a frame: chase 1,543,728 → 1,570,336 (+1.7%), cockpit
  2,101,020 → 2,140,932, hood 1,438,855 → 1,465,463.
- Trim triangles a vehicle as the game instances it (phone geometry): sedan 30 → 212, coupe 30 → 188, SUV 30 → 220,
  pickup 42 → 236, van 30 → 212, box truck 110 → 258, semi 498 → 578. The player's paint (44,930) is now paint
  43,010 + mirrorPaint 1,920.
- Checked by eye in headless Chromium (SwiftShader) at 960x540. Before: `tests/out/w2-before-preview-lineup.png`,
  `-preview-sedan.png`, `-preview-sedan-rear.png`, `w2-before-chase.png` (crops `-chase-sedans`, `-chase-left4x`),
  `w2-before-cockpit-mirror.png`, `w2-before-hood.png` (crops `-hood-left3x`, `-hood-right`). After: the same names
  with `w2-after-`, plus `w2-after-preview-semi.png` and `-boxtruck-rear.png`; side by side in `tests/out/w2-cmp-*.png`.
- Suite (`--only=survival,race,render`, load average 17 on 4 cores from other renders): 25/28. New checks pass:
  "traffic is the preview's bodies..." (49 instanced meshes, trim triangles as above) and "the door mirrors have
  their own paint, without the shut lines, and follow the car's colour". The three failures were timeouts: "pause
  stops the simulation" and "recovers from a lost WebGL context" both pass when re-run with the suite's own steps
  and longer waits; "racing slowly..." and "flat out, the autopilot wins..." each wait 10 s for the result and each
  passed in one run and timed out in another, with the same build.
- Not measured on a real phone or GPU.

## 2026-10-16: houses and offices look like Orange County, not Monopoly pieces (realism pass, W1)

Before, every house was the same white box with a salmon cone roof and every office a tan box with one window grid.
Now houses come in four plans (L-shaped ranch, two-storey with garage wing, ranch with gabled garage, two-storey
gabled), with windows, a panelled front door and sidelight, sectional garage doors, and Spanish-tile, grey-composite
or shake roofs over OC stucco tints. Offices come in three types (2, 3 and 8 storeys) with curtain wall, tower glass or
precast facades, rooftop units and a penthouse on the tower. Low keeps the variety with hipped plans only (two house
draw calls per tile). Each plan or type is one instanced draw call per tile over two shared atlases; the scenery
layout is unchanged. Details in `PROJECT_OC_TECHNICAL_NOTES.md`; preview page `src/preview/test-buildings.ts`.

- Checked by eye in headless Chromium (SwiftShader) at 960x540, High and Low, chase and hood views; a reviewer
  pass compared before and after and found no regression.
- Before: `tests/out/w1-before-high-chase.png`, `w1-before-high-hood.png`, `w1-before-high-office-chase.png`,
  `w1-before-high-office-hood.png`, `w1-before-low-chase.png`, `w1-before-low-hood.png`.
- After: `tests/out/w1-after-high-chase.png`, `w1-after-high-hood.png`, `w1-after-high-office-chase.png`,
  `w1-after-high-office-hood.png`, `w1-after-low-chase.png`, `w1-after-low-hood.png`, crops
  `tests/out/w1-crop-after-*.png`, preview `tests/out/w1-prev2-office0.png`, atlas `tests/out/w1-atlas.png`.
- Not measured on a real phone or GPU.

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

## 2026-10-19 (later): the hypercar store change, repaired after two reviews (branch `claude/store`, not committed)

Two reviews of the entry below (integrity and business) rejected it. The server, serial, entitlement and checker
work stood; three serial cases broke "a refunded number is retired", the checker had gaps, and some copy wasn't
true. This pass fixes each point as the reviews asked. Still not committed or merged; the SKU stays `available:
false`.

**Server (migration 0002, `stripe-webhook`).**

- **A refund racing the numbering (P3).** `assign_serial` now locks the purchase row (`select ... for update`)
  before it reads the status. A refund written at that moment either commits first, and `assign_serial` refuses
  ("refunded, not paid"; the webhook answers 500 and Stripe retries), or it waits until the number is issued and
  its trigger then retires it. A completion that reads back a refunded purchase now also takes back what a racing
  delivery granted.
- **A retired number on the plaque (P1).** The refund trigger now resets the player's entitlement rows for that sku
  to their lowest live number, or to none. A second paid purchase by a player who already holds a live number (two
  checkouts opened side by side) is refused inside `assign_serial`: marked `refused`, never numbered, and refunded
  in full (idempotency key `founder-duplicate-<session>`; a retry re-asks with the same key). The client's
  "refused" message now names both reasons.
- **A refund delivered before its completion (P2).** `charge.refunded` with no matching purchase no longer answers
  "ignored". It looks up the Checkout Session at Stripe (`GET /v1/checkout/sessions?payment_intent=`) and records
  the purchase as `refunded`, so the completion that follows reads `refunded` and grants nothing. A charge with no
  Checkout Session is still ignored (200); a failed lookup is a 500, so Stripe retries.
- **Not built, noted for the owner** (`PROJECT_OC_MONETIZATION.md` §12, `server/README.md`): `restore()` at boot in
  live mode, and treating a lost dispute like a refund.

**Checker** (`tools/store-check-catalog.mjs`): an entitlement marked `exclusive: X` may be granted by sku X only; a
sku that grants a car (a `vehicle`) or a server-numbered item (`serial: 'server'`) must be `serial: true` and in the
founder window.

**Copy.**

- **Free Drive.** It has a score (the distance), a saved best, a device-only board and a shareable run card, so
  "where nothing is scored, timed or ranked" is gone everywhere: the catalog description, the store's two-tune line,
  intro line and terms, rule 3a and the catalog row, `cosmetics.json`, and the deck's store page. The new words:
  no clock and no rivals, your Free Drive bests stay on your device, and Unleashed runs and run cards are marked.
  The marking isn't built (the car isn't in the game), so it is now a condition for `available: true` in rule 3a and
  in the car's `needs`.
- **"Then never again"** is off the car's copy (catalog, the deck's chip and card, the doc's catalog row, the
  marketing callout) until the owner decides what it covers. "Sold until December 31, 2026" stays, and so does the
  open decision in §12. The Founder Pack's own "then never again" is unchanged.
- **"Never power"** now reads "never pay-to-win" with the exception named, in `launch-kit/index.html`, `plan.html`,
  `marketing.html` and `store.html`, `PROJECT_OC_MARKETING.md` (the four places) and `PROJECT_OC_LAUNCH_90.md`. Each
  notes that the exception still waits for the owner's edit of `CLAUDE.md`. `CLAUDE.md` itself is not edited.
- **"Every freeway, mode and car stays free"** now says "every car you can earn": the store intro (which no longer
  calls everything "Optional looks" while the car's card shows), the under-13 lines, the main-menu tile, the
  ambassador answer in `PROJECT_OC_MONETIZATION.md` and the deck's under-13 line.
- **The Founder Ice swatch** sits right beside the paint's swatch, not on its own at the end of the line, where at
  1440 it read as a fourth item.

**Verified** (2026-10-19, load average 3 to 8 from other passes; logs in `tests/out/`, `-r2` names):

- `node server/supabase/tests/serial-webhook.mjs`: **24/24** (`store-hypercar-webhook-r2.log`). The 17 earlier
  checks plus 7 new: a second purchase refused and refunded with one key, never numbered; its refund leaves the
  first number on the plaque; two live numbers (planted as the old webhook issued them) go back to the lowest, then
  to none; a refund before its completion leaves nothing granted or numbered; a charge with no session is ignored
  and a failed lookup is a 500; a refund held open while `assign_serial` runs (it waits 2.0 s, then refuses); an
  `assign_serial` held open while the refund arrives (the refund waits 2.0 s, then retires the number). The earlier
  refund check now expects the row's number cleared. The same file against the **pre-repair** migration and webhook
  (a scratch copy): **16/24**, failing exactly on P1, P2 and P3 (`store-hypercar-webhook-oldcode-r2.log`).
- `server/supabase/tests/run-local.sh`, as the postgres user: both migrations twice; `rls-probe.sql` now probes 0002
  too. A player reads only their own number; as that player, 8 writes and calls on `serials`, `serial_counters`,
  `entitlements.serial`, `assign_serial` and `retire_serial` are refused, and as an anonymous visitor 6 are; a
  refund retires the number and clears it from the row (`store-rls-r2.log`).
- The checker on planted catalogs in a scratch copy of the files it reads (`store-hypercar-check-r2.log`): with
  `oc-hyper` simulated in a scratch `cars.ts` and its grants `ready`, dropping `serial`, a new $3 sku with no window
  granting `car-oc-hyper`, the Coast Paint Pack granting it, a second numbered sku granting it, and the Coast Paint
  Pack granting the plaque each exit 1; the simulated car alone exits 0. A 498-cent hypercar, a 499-cent Coast Paint
  Pack and `available: true` without the car also exit 1. `npm run store:check` passes on the real files.
- `npx tsc --noEmit` and `npm run build` clean (`store-hypercar-tsc-r2.log`, `store-hypercar-build-r2.log`). Both
  Edge Functions also typecheck strictly with a Deno shim (outside the repo). The bundles hold no `sk_`/`rk_`/
  `whsec_` key, no service-role name and no "nothing is scored".
- `npm test -- --only=store`: **16/16** in 796 s (`store-hypercar-suite-r2.log`). It ran on the build before two
  later edits that change no UI (a note in `cosmetics.json`, a deck stat); the build above is from the final files.
  Screenshots: `store-hypercar-1440x900-r2.png`, `store-hypercar-390x844-r2.png`, `store-hypercar-card-1440-r2.png`
  (the Founder Ice swatch beside the paint), `store-hypercar-card-390-r2.png`, `store-lede-390-r2.png`.
- The deck (Playwright, `deck-store-hypercar-r2.log`): no sideways scroll on the store page at 1440 or 390, or on
  the index, plan, marketing and go-live pages at 390; no page errors; the card's ice line sweeps in on reveal, is
  there at once with reduced motion and steady without JavaScript. Screenshots: `deck-store-hypercar-1440-r2.png`,
  `deck-store-hypercar-390-r2.png`, `deck-store-rules-1440-r2.png`, `deck-store-rules-390-r2.png`,
  `deck-index-rules-1440-r2.png`.
- `npm test -- --only=render` once more (`store-hypercar-render-r2.log`, load 5.0 to 6.6 at the start): **12 of 13**
  passed; "High and Ultra presets rebuild mid-drive" failed with "Target page, context or browser has been closed"
  (the browser went away under it), and the run then ended on an uncaught `browserContext.close`. Not re-run since;
  this line was left as a placeholder by that session and is filled in from its log on 2026-10-21 (entry above).

## 2026-10-19: the OC Hypercar Founder Edition in the store, "Coming soon" (branch `claude/store`, not committed)

The owner's decisions of 2026-10-16, as `PROJECT_OC_HYPERCAR.md` §11 on `claude/hypercar` specifies them: the car is
sold for $4.99, one time, in the founder window to December 31, 2026. It is still being built on that branch, so the
store shows it as **Coming soon** and nothing can buy it, in test mode or live. Built in two sessions (the first was
stopped by a usage limit part-way; the second finished it and ran every check again). Not committed or merged.

**What changed.**

- **Catalog.** `hypercar-founder` in `src/store/catalog.json`: 499 cents, one time, `serial: true`, `available:
  false` with a plain `unavailable_reason`. Both founder items name the window as `"FOUNDER_UNTIL"`, one constant in
  `src/store/founder.json` (`2026-12-31T23:59:59-08:00`, the last second of the 31st in Pacific time; a bare
  `2026-12-31` would end at 4 pm Pacific on the 30th). The store (`catalog.ts`), the server's copy (`npm run
  store:sync` writes the date and `founder_until`) and the checker all read that file.
- **Checker** (`tools/store-check-catalog.mjs`): $4.99 is accepted for that sku only; the founder window must be the
  constant; the two founder offers may share no grant and no name; a store car is sold only once it is in
  `src/game/cars.ts`, takes no slot and is never sold back; a numbered sku needs a migration that seeds its counter.
- **Entitlement.** `car-oc-hyper`, `plaque-founder-edition` and `paint-oc-founder-silver` (with Founder Ice LEDs) in
  `cosmetics.json`. `entitlements.ts` `storeCars()`/`syncGarage()` and `profile.ts` `setStoreCars()` put `oc-hyper`
  in the garage outside the slot count while the account owns it, refuse to sell it for credits, take it out on
  sign-out or refund and put it back on sign-in.
- **Serials** (server only). Migration `0002_founder_serials.sql`: a per-sku counter, a `serials` ledger, a `serial`
  column on `entitlements`, `assign_serial()` (service role only), a trigger that retires a refunded number, and
  RLS (a player reads their own number, never writes it). `stripe-webhook` asks for the number when the payment
  succeeds; `create-checkout` and the webhook both check the window (the webhook by the session's creation time).
- **Store panel** (`Store.tsx`, `styles.css`): the card in silver and Founder Ice, "Founder Edition · sold until Dec
  31, 2026", $4.99, the plaque and paint, "The $10 Founder Pack does not include this car", "Coming soon" and "No
  pre-orders".
- **Docs and deck.** `PROJECT_OC_MONETIZATION.md`: the $4.99 exception and its fees ($0.44, $4.55 kept, $4.47 on an
  international card), rule 3a (the two-tune rule, with the race-tune numbers from the plan's §5.3), the two founder
  offers kept apart, the Vela E Wheel Set caveat (also a `caveat` in the catalog), and a note that the forecast
  doesn't count the car. `launch-kit/store.html` (the card, the price row, the rules, the forecast note), `index.html`,
  `plan.html` (the $4.99 calculator preset), `marketing.html` and `golive.html` (migration 0002).

**Verified** (2026-10-19, load average 0 to 9 from other passes):

- `npm run store:check`: fails on a planted 498-cent hypercar and on a planted 499-cent Coast Paint Pack, and on a
  planted `available: true` (the car isn't in `cars.ts`); passes once restored (`tests/out/store-hypercar-check.log`).
- `npx tsc --noEmit` and `npm run build` clean (`store-hypercar-tsc.log`, `store-hypercar-build.log`).
- `node server/supabase/tests/serial-webhook.mjs`, the real `stripe-webhook` against a throwaway Postgres 16 with
  both migrations: **17/17** (`store-hypercar-webhook.log`). A retried delivery (3 concurrent, 1 later) and the
  session's second success event all keep No. 0001; a refund retires No. 0001 and the next sale is No. 0003; a
  session created a minute before the deadline and paid an hour after is honoured; one created after it is refused
  and refunded once; No. 0000 can't be issued; a player can't write, issue or reset a number.
- `server/supabase/tests/run-local.sh` (run as the postgres user): both migrations twice, every probe refused.
  **Corrected after review:** `rls-probe.sql` then probed the 0001 tables only, so "every probe refused" covered
  none of 0002's objects. The player probes of `serials`, `serial_counters` and `assign_serial` were in
  `serial-webhook.mjs` alone, and nothing probed them as an anonymous visitor or probed `retire_serial`. The repair
  below adds them to `rls-probe.sql`.
- `npm test -- --only=store`: **16/16** in 811 s (`store-hypercar-suite.log`), including the hypercar card, the
  garage grant and the webhook test. Screenshots: `store-hypercar-1440x900.png`, `store-hypercar-390x844.png`,
  `store-hypercar-card-1440.png`, `store-hypercar-card-390.png`.
- The deck (Playwright, `tests/out/deck-store-hypercar.log`): no sideways scroll at 1440 or 390; the card's top line
  sweeps in when the section is revealed, is there at once with reduced motion, and is steady without JavaScript;
  the plan's $4.99 preset reads "Stripe keeps $0.44 of $4.99". Screenshots: `deck-store-hypercar-1440.png`,
  `deck-store-hypercar-390.png`, `deck-store-prices-1440.png`, `deck-store-money-1440.png`.
- `npm test -- --only=render` once, at a load average of 6 to 9: **13/13** in 949 s (`store-hypercar-render.log`).
  "pause stops the simulation, resume carries on" passed in 94.1 s. This tree gives each 5-frame wait 240 s instead
  of 60 s (`FRAMES_MS` in `tests/regression.mjs`, set by the first session after 5 frames took up to 58.7 s under
  SwiftShader at a load of 15 to 19). No assertion changed.

**Open, for the owner.**

- `CLAUDE.md` still says "Never sell power: no faster-than-earnable cars" without rule 3a's two-tune exception. It
  wasn't edited by an agent; the suggested line is in `PROJECT_OC_MONETIZATION.md` §11.
- What "never sold again" covers (the Founder Edition's exclusives, or the car itself), owner mode in public builds,
  and the Vela E Wheel Set once the Vela E is hidden (`PROJECT_OC_MONETIZATION.md` §12).

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

## 2026-10-16: the launch kit: the plan, the marketing, the store in test mode and the presentation, committed

The owner's ask (2026-10-16): a 30–90 day launch plan at minimum up-front cost, free marketing to start before
launch, a presentation with animated step-by-step guides the way Lumevina's was, a paywall built Lumevina's way but
not live until Supabase and Stripe are plugged in, and realistic prices for what the game could sell. All of it is
now committed on `claude/store`, on top of `4756141` (the three documents' first drafts and the catalog). It is not
merged into `claude/always-on`, where the UI pass is still running; the orchestrator merges it later. Nothing is
deployed, and nothing can be charged: no Stripe or Supabase account is connected.

**What was made** (the two entries below have the detail):

- `PROJECT_OC_LAUNCH_90.md`, the $0 plan: 13 weeks from Day 1 (Monday, October 19), the OC-only beta on Days 1–45
  (testers from Day 15), the store on Day 46 at the earliest. Each step names who does it, its cost, the proof it
  worked and what to do if it didn't. Then the metrics, the gates, the risks, and the optional costs, each with the
  trigger that justifies it.
- `PROJECT_OC_MARKETING.md`, the free pre-launch playbook: the hook ("Drive the real 405 at sunset, on your phone"),
  three clips a week, the waitlist, the press, OC communities and car meets, and the unpaid Founders crew with the FTC
  disclosure.
- `PROJECT_OC_MONETIZATION.md`, what the store sells and why. At launch, 11 items: the Founder Pack ($10, sold until
  December 31, 2026), two paint packs, four wheel sets and three driver styles at $3 each, and a pay-what-you-want tip
  from $2. Body kits ($5), the Lot 57 hangout outfits ($3; the owner's "get out like a Sims character and go to Golden
  Road" idea, planned as our own fictional taproom, free to visit, and the store never names Golden Road), the
  Rossini GT Spider ($5), a
  livery pack ($5) and a club ($3 a month or $30 a year) are in the catalog as `available: false`. None can be sold
  until it exists in the game.
- The store and paywall in test mode: `src/store/`, `src/ui/Store.tsx`, `server/` (the migration, the
  `create-checkout` and `stripe-webhook` functions, the go-live README), `.env.example`, the secrets lines in
  `.gitignore`, and the new store rule in `CLAUDE.md` in place of "no real money".
- The presentation in `launch-kit/`: the hub, the 90-day plan with its calculator, the marketing guides, the store
  demo and the go-live guide.

**The money, plainly.** Over 90 days, with 200 to 3,000 players reaching the menu and 1–3 % of them buying, the
store brings in about $12 to $660 after fees (`PROJECT_OC_MONETIZATION.md` §7). The plan's simpler arithmetic gives
$0 to about $850, most likely under $100. Against the plan's full optional spending list (about $280), the low and
middle cases lose money. A California LLC's $800 yearly tax would sink all three. Expect little or no profit.

**Fact-checked.** Each document had two adversarial passes on 2026-10-16, by web search. Direct page loads to
stripe.com, supabase.com and Google's help pages were refused from this machine, so those figures come from search
summaries, and each document cites its sources with their dates. By the passes' own counts they made 17 corrections
to the monetization document, 24 to the plan and 34 to the marketing document. Among them:

- Stripe's second $15 fee for contesting a dispute.
- The .com price, about $11.17 from 1 Nov 2026 (Verisign's $10.97 plus ICANN's 20¢).
- The FTC penalty, kept at $53,088 for 2026.
- "Early access" as a material connection: 16 CFR 255.5, not 255.0(e).
- SB 122: signed 29 Jun 2026, with draft CDTFA rules of 1 Sep 2026.
- The scope of the Supreme Court's grant in Epic v. Apple: the contempt finding.
- The Founder Pack's nine paints, all still "hook".
- The build size: 3.5 MB with the store.

The paywall had an independent check of its own (typecheck clean, the store group 13/13), and the reviewer kept it,
with fixes recommended before live mode; those belong to the Fable review queued in `PROJECT_OC_HANDOFF.md`. The
presentation was reviewed and kept. For this commit I changed four dated "uncommitted" notes (three in
`PROJECT_OC_LAUNCH_90.md`, one in `PROJECT_OC_MARKETING.md`) to say the files are committed.

**Checked for this commit**, in the `tsu-store` worktree. No other pass ran in this worktree, but three other passes'
renders and suites shared the 4 cores (load average 9 to 18 while the suite ran):

- `npx tsc --noEmit`: clean, exit 0 (`tests/out/commit-tsc.log`).
- `npm run build`: clean, exit 0. The single file is 3,371 KB of JS and 49.4 KB of CSS (`tests/out/commit-build.log`).
- `npm run store:check`: "catalog ok: 21 skus (11 available), 42 entitlements" and "server catalog in sync: 21 skus,
  11 available, 0 with every grant ready".
- The full suite, `npm test` (`tests/out/commit-suite.log`, 01:25 to 02:39 UTC), exit 1. Its last lines, exactly
  as printed: "77/78 passed. Failed:" and "pause stops the simulation, resume carries on: page.waitForFunction:
  Timeout 60000ms exceeded." By group: boot 6/6, interchanges 7/7, survival 7/7, race 6/6, abilities 4/4,
  progression 5/5, render 12/13, phone 5/5, launch 5/5, store 13/13, store-live 7/7.
  - The failure is a time-out, not a wrong value. The check waits at most 60 s for 5 frames (`frames()`, unchanged
    on this branch), and the load average was 13 to 14 at the time. The render group's other checks took 41 to 83 s
    each, and the context-loss check took 454 s.
  - Rerunning the render group alone (`tests/out/commit-render-rerun.log`, 02:39 to 03:00 UTC, load 11 to 18)
    passed that check in 32.3 s. Then the next check, "reset puts the car back on the road, stopped", timed out in
    the same 5-frame wait (it had passed in the full run, in 64.7 s). That run printed "12/13 passed." Each of the
    two checks passed in the seven earlier logged runs I found, in this and the other worktrees.
  - Why I don't think it's the store: the store adds no per-frame work. Its only timers are the test-mode waits
    inside a purchase or a sign-in, and the paint hook runs only when a store item changes. With no store paint,
    the car gets the same paint material as before. The two checks don't touch the store. Not proven on an idle
    machine: no quiet window came up while I worked. Rerun `npm test -- --only=render` when the other passes are
    idle.

**Open: the owner's decisions.**

- **Prices.** Every price in `catalog.json` is a proposal (TODO, owner).
- **The Founder window.** It ends 2026-12-31 23:59:59 Pacific (Day 74). Sales start on Day 46 (Thursday, December 3)
  at the earliest, so the window is about four weeks. If Day 1 moves, decide before sales start: keep December 31 (a
  shorter window, and the '26 on the badge stays true), or move the end with the calendar. Never extend it once
  sales start.
- **Two kinds of Founders.** The business draft promised the 45-day testers a free "Founders" badge, and the plan
  (B6) puts the unpaid crew's names on the Founders credits. The Founder Pack sells a Founder '26 badge and a place on
  the Founders roll. Decide how the free and the paid Founders differ.
- **Founders Sunset.** The pack's exclusive paint (#E8622C pearl, "never sold again") is close to Newport Sunset
  (#E2603A gloss, in the $3 Coast pack; ΔE76 about 8). Change one of them, or the exclusive may read as hollow.
- **The Rossini GT Spider** ($5, also earnable for credits). Paying skips its credit price. That isn't power, but it
  is in tension with "never sell credits". Make it money-only or credits-only.
- **No upgrade price.** A paint-pack buyer who later buys the Founder Pack pays twice for those paints. The checkout
  refuses only a buyer who already owns everything in it. The cart isn't built either, so each item pays its own 30¢.
- **A hypercar.** The session's task list names a "Hypercar Founder Edition … fastest car" and a "$4.99 OC Hypercar
  Founder Edition SKU on claude/store". Selling a car faster than the earnable ones breaks "never sell power". No
  such SKU is in this commit. The owner should settle this before one is added.
- **The store in a public test-mode build.** Hide it, or show it as a labelled demo. Marketing clip 1.1's copy
  depends on the answer.
- **The trademark check.** The Rossini Notte, Rossini Ora and Vela Pulse watches: Zhuhai Rossini filed a ROSSINI
  mark (serial 79148981, status unchecked), and HiFuture sells a VELA smartwatch. Run the USPTO class 14 search and
  rename the watches before those styles sell. "Top Speed" is T-Bull's racing game, so keep it out of tags (plan F2).
- **The first real-phone run.** Nothing in this kit has run on a real phone. Gate 0, and every post with a link, wait
  for it.
- **The seller** (TODO): an individual or an LLC, the support email, Stripe's statement descriptor, the domain, the
  Orange County name filing and the city business licence, and a lawyer's look at the terms, the refund and privacy
  policies, and the club's terms.

**Verify at launch** (each document lists its own, with sources):

- Stripe's fees and its $15 dispute fees (third-party sources only).
- Supabase Free's limits and its mailer cap (2 or 3 an hour); Resend's 100-a-day cap.
- Google Play's fees and its Epic settlement (pending court approval).
- Apple's US link-out commission (in court; Supreme Court argument targeted for January 2027).
- Texas SB 2420.
- SB 122's final CDTFA rules, before 1 January 2027.
- The B&P 17602 notice windows.
- Whether a minor can disaffirm a single in-game purchase, and whether AB 2426 reaches in-game cosmetics.
- The FTC penalty, again in January 2027.
- Each subreddit's rules, on the morning you post; each car meet, with its organiser.
- The radio call signs KCST, KFWY and KNYN. KFWY is a defunct Washington AM call sign.

**Left inconsistent, for their owners:**

- `PROJECT_OC_MONETIZATION.md` §7 still uses a $10 domain and "about $280". The plan and its calculator use $11.17.
- §9 names `orders` and `refund_requests`. The built schema has `purchases` and `entitlements`, and no refund
  table.
- The built `waitlist` table takes the full 5-digit ZIP, but the plan's F6 says only "in OC: yes/no" and the first
  three digits are stored. This is a privacy point for the Fable review.

## 2026-10-16: the launch presentation (`launch-kit/`, branch `claude/store`)

The owner's ask for "a whole presentation with animated step-by-step guides", built Lumevina's way as a small site
in `launch-kit/`: `index.html` (the hub: the OC sunset wordmark, "OC Ultra" with "Top Speed" beneath, a "Try this
first" strip and a link to the test build), `plan.html` (the 90-day plan: the four phases as one road of 35 steps,
the release routine, the 13 weeks, the metrics, the gates and risks, and the money calculator), `marketing.html`
(the hook, the 8-week clip calendar, five guides: clips, the waitlist, the press, the Founders crew with the FTC
disclosure, posting day; templates with copy buttons), `store.html` (what stays free, the 11 items read from
`catalog.json` and `cosmetics.json` at build time, a test-mode checkout demo, later items, the rules, the money) and
`golive.html` (`server/README.md`'s ten steps with the migration and every command ready to copy). Every guide has a
road rail, a car that drives step to step, Next, Back and optional auto-play. Nothing is deployed or committed; the
orchestrator publishes it as one artifact. Total 556 KB with the two wordmark images.

**Checked** (headless Chromium through Playwright, from `file://`):

- Every page at 390 × 844 and 1440 × 900 (`tests/out/deck-<page>-{phone,desktop}.png`): no horizontal scroll, no
  page or console errors, the Google Fonts faces loaded.
- The store demo follows `src/store/payments.ts`: 4242 succeeds and grants all 12 Founder Pack items; 4000 0000 0000
  0002 is declined and grants nothing; a valid non-test number (4111…) is refused; a bad Luhn number, a past expiry, a
  missing age, a bad email and a missing 18-or-guardian tick each give the game's own message; a $1 tip is refused;
  a car's wheel set needs that car "earned"; Use Founders Sunset repaints the preview car. No card number is stored.
- The plan calculator matches the plan's §7.3 table ($846.90 at 3,000 players, 3%, $10).
- With JavaScript off, every step and catalog card is visible; with reduced motion, nothing animates.
- The copy buttons fall back to selecting the text when the clipboard is refused (headless refuses it).

**Not checked:** a real phone, and the published artifact itself (the platform's wrapper was imitated locally).
`server/README.md` step 1 says a project ref is "12 letters"; the go-live page avoids stating a length (verify).

## 2026-10-16: the store and paywall, in test mode, built the Lumevina way (branch `claude/store`)

The owner's ask: a paywall "exactly like Lumevina", not live until Supabase and Stripe are plugged in, but with every
technical piece in place. Built in the `tsu-store` worktree; nothing deployed, nothing committed. The rules are the
new store rule in `CLAUDE.md`; what is sold and for how much is only `src/store/catalog.json` and `cosmetics.json`
(unchanged by this pass); the reasons are in `PROJECT_OC_MONETIZATION.md`.

**What was built.**

- **Client** (`src/store/`): `config.ts` (test mode unless `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
  `VITE_PAYMENTS_LIVE=true` are all set at build time), `payments.ts` (the one Stripe integration point: test mode
  checks Luhn, expiry and CVC and takes Stripe's test cards only, 4242 succeeds and 4000 0000 0000 0002 declines, any
  other number is refused unread; live mode sends the token and the sku, never a price, to `create-checkout` and goes
  to Stripe's hosted Checkout page, then confirms the purchase from the server on return), `account.ts` (a neutral
  month-and-year age question before the email, keeping only 13+ or not; magic-link sign-in that signs straight in
  during the demo and uses Supabase Auth live; sign-out), `entitlements.ts` (`has`, `list`, `restore`; a ledger in
  `localStorage` in test mode, the `entitlements` table cached for offline play live), `locker.ts` (the paint each
  car wears), `bus.ts` (safe storage and the change event), `catalog.ts` (types).
- **The Store panel** (`src/ui/Store.tsx`, styles under `.store` in `styles.css`): the test-mode banner, the account
  box with Restore purchases, Your items (the paint picker for your car, test receipts), the Founder Pack with its
  fixed end date and no countdown, the catalog grouped by kind with prices and what each unlocks, "Earn the … first"
  for a car you don't own, and a checkout sheet with "Looks only", the AB 2426 licence line, the 18-or-guardian box,
  the tip's pay-what-you-want amount (floor $2), the Founders roll opt-in, and a subscription's terms above an
  unticked checkbox. App.tsx: one Store entry in the main menu, one in the pause menu, the panel line, and the store
  opening by itself after a Stripe return or a sign-in link.
- **In the game**: store paints go on the car through `PlayerCar.setPaint(hex, finish)`, which now takes the finish
  numbers from `cosmetics.json` (pearl, gloss, satin, metallic) and swaps the cached material instead of recolouring
  it (recolouring would have left the next car built in the factory colour wearing the store paint). The run card
  draws the Founder '26 badge and the Founders frame when owned. Wheels, driver styles, liveries, kits, outfits and
  the club items are data only: they can be bought in test mode and are listed in Your items, but no hook shows them
  yet. `cosmetics.json` statuses were left as they were (the paints stay `hook` until a review checks the renders).
- **Server** (`server/`, not deployed): the migration (`profiles`, `purchases`, `entitlements`, `waitlist`,
  `invite_codes`, row-level security on all), `create-checkout` and `stripe-webhook` Edge Functions (fetch and Web
  Crypto, no SDK), the server's catalog copy (`npm run store:sync`; `npm run store:check` runs both catalog checks),
  `.env.example` files, and `server/README.md` with the go-live steps, each with how to tell it worked.

**Verified.**

- `npx tsc --noEmit` clean; `npm run build` clean (`tests/out/store-continue-tsc.log`, `store-continue-build.log`).
- Before the change, on the same tree's build: boot, phone and launch **16/16** (from the first builder's notes;
  that run's log wasn't kept).
- After, `npm test -- --only=store,store-live,boot,phone,launch` (`tests/out/store-continue-suite.log`, 20:41 to
  21:21 UTC, with other passes' renders loading the 4 cores to 9 to 13): **36/36 passed**, exit 0. That's boot 6/6,
  phone 5/5, launch 5/5, store 13/13 and store-live 7/7.
  - An earlier full run (`store-definitive-suite.log`, 19:20) stopped at the store group's first page. It took more
    than 120 s to reach the menu while other passes rendered. `tests/regression.mjs` now gives a page up to 5 minutes
    to boot (`BOOT_MS`, in `open()`, the store reload and the store-live loads). No assertion was changed, and the
    boot check still prints the real load time (16.7 s in this run).
  - The store lines:
    - catalog: the two files agree with each other, the code and the server copy. 21 skus (11 available), 42
      entitlements; the server catalog is in sync.
    - webhook signature: RFC 4231 case 2 matches. Good and rolled-secret headers pass. A tampered body, a wrong
      key, a timestamp ±301 s off, and missing or malformed headers all fail. The form encoding is right.
    - the store opens from the menu with every available item and its price: 11 items on sale, 10 not offered. The
      banner reads "TEST MODE Nothing is charged. Use 4242 4242 4242 4242." The Brio wheel set says "Earn the
      Rossini Brio first".
    - 4000 0000 0000 0002 is declined and grants nothing: "Your card was declined. Nothing was charged and nothing
      was added." A non-test card (4111…) is refused. 0 items.
    - the Founder Pack bought with 4242 grants 12 of 12 entitlements. The receipt reads "RECEIPT · TEST MODE …
      Founder Pack $10.00 USD, Visa •••• 4242, OCU-TEST-…, Founders roll: Test Founder". The card number is not in
      storage.
    - the Founders Sunset paint becomes selectable and goes on the car: #e8622c, metalness 0.35, roughness 0.25,
      clear coat 1/0.03, on every body-paint mesh. Factory paint puts #a80d10 back.
    - the tip: $1 is refused ("Choose an amount from $2 to $100."); $7 grants the one badge.
    - the club (preview only; not on sale): "$30.00 a year, renews automatically every year until you cancel."
      shows above an unticked checkbox, and Pay stays disabled.
    - the purchase survives a reload: Founder Pack "Owned", 13 entitlements, the car still in #e8622c, signed in as
      founder@example.com with the Founder '26 and Fuelled the build badges.
    - the car in Founders Sunset (chase shot), and the run card's frame pixel at rgb(241,129,54).
    - phone: the store, the checkout and the receipt fit 390 × 844 with no sideways scroll.
    - test mode sends nothing to Supabase or Stripe: 19 requests, to file:, fonts.googleapis.com and
      fonts.gstatic.com only.
    - live (against the mock project): secure-checkout banner; magic-link request and return; checkout body
      `{"sku":"founder-pack-2026","roll_name":null,"renewal_agreed":false,"adult_or_guardian":true}`, with no price
      and no card form; back from Stripe the receipt comes from the purchase row and Founders Sunset is on the car;
      a refused item shows the server's reason; a cancelled checkout says nothing was charged; 20 mocked calls, to
      mock-oc-ultra.supabase.co and checkout.stripe.com only.
- Row-level security, on PostgreSQL 16 with a stub of Supabase's roles (`server/supabase/tests/run-local.sh`,
  `tests/out/store-rls.log`): the migration runs twice cleanly; a player reads only their own purchases and
  entitlements and every write to them is refused; a player can upsert only their own profile; an anonymous visitor
  can add an email to the waitlist and nothing else (no reading it, no setting a referral code, bad emails and ZIPs
  refused); `invite_codes` is closed to both.
- The two Edge Functions type-check with the project's TypeScript 5.5 in strict mode, with only `Deno.env.get` and
  `Deno.serve` declared (a scratch tsconfig; there is no Deno on this machine to run them).
- Screenshots: `tests/out/store-1440.png`, `store-checkout-1440.png`, `store-receipt-1440.png`,
  `store-club-terms-1440.png`, `store-390.png`, `store-checkout-390.png`, `store-receipt-390.png`,
  `store-founders-sunset-chase.png` (the GT in Founders Sunset), `store-run-card-founder.png`,
  `store-live-checkout-1280.png`, `store-live-receipt-1280.png`.

**Found and fixed on the way:** the tip's price line ran 16 px off a 390 px screen; a select wrapped in its label
read its whole option list as its name (every field now has its own label); the checkout footer wrapped to two
lines in the narrow sheet and covered the renewal checkbox; live sign-in cleared the address before setting the
"reopen the store" flag, so the store would not have reopened after a sign-in link (caught while writing the
`store-live` group).

**Checked by web search (2026-10-16, second builder).** docs.stripe.com still doesn't resolve from this machine,
so these come from search results quoting Stripe's and Supabase's pages:
- the webhook signature scheme and Stripe's 5-minute default tolerance;
- 4242 succeeds;
- 4000 0000 0000 0002 is the generic decline (confirmed by third parties only);
- the literal `{CHECKOUT_SESSION_ID}`, and `client_reference_id` up to 200 characters;
- `custom_unit_amount` for pay-what-you-want;
- 2.9 % + 30¢ US card fees;
- Supabase's `/otp` with `create_user`.

Two things changed. `server/README.md` step 3 no longer says an unlisted redirect URL is refused: Supabase falls
back to the Site URL. And the README's last section now cites each source.

**Not checked, and left out.** The Edge Functions have never run in Supabase's runtime or against Stripe's API (no
deployment; `server/README.md` lists each detail still to verify at launch, and its step 9 is the real test). Not built: the club's customer portal and monthly paint (`invoice.paid`), a refund-request button,
the waitlist form and invite-code redemption, the Founders roll in a credits screen, the badges on the profile card
(the profile panel lives in App.tsx, which is being reworked), and hooks for wheels, driver styles, liveries and kits.
`PROJECT_OC_MONETIZATION.md` §9 still names `orders` and `refund_requests` tables; the built schema is `purchases`
(plus `entitlements`) and has no refund-request table yet. Its §8.2 asks for the birth year; the store asks for the
month and year, so nobody in their birthday year passes early. Security and business-rule design are Fable-class
under the triage rule: a review prompt naming these files is queued under "Fable queue" in `PROJECT_OC_HANDOFF.md`.

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
