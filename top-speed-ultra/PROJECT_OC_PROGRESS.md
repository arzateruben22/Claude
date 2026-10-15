# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

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
