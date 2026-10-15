# Project OC: technical notes

These notes are for whoever works on this next, person or agent. Read this before changing the road, physics or
traffic code.

## Stack

- TypeScript 5.5, Vite 5, three.js 0.160 and React 18. There's no other runtime dependency.
- `npm run build` type-checks and builds. It then folds everything into `dist/top-speed-ultra.html`, which opens
  from disk, and `dist/artifact.html`, a body fragment for hosts that add their own wrapper.
- The network data, `src/data/oc-network.json`, is about 2.3 MB. It's imported as JSON, with `json.stringify` set
  so Vite emits `JSON.parse`. The single-file build is about 3 MB.

## Coordinates and conventions

- **World.** x is east and z is south, in metres. y is height above sea level in metres. The origin is 33.72° N,
  117.83° W, projected equirectangularly; the error across OC is well under a metre.
- **Floating origin.** `ORIGIN` in `world/Path.ts` re-centres every 1.5 km. Renderable groups sit at
  `(ox - ORIGIN.x, 0, oz - ORIGIN.z)`. The simulation keeps absolute JS doubles. Path arrays are Float32, which
  gives about 3 mm precision at 45 km.
- **Heading.** h means the tangent is `(sin h, cos h)`, and right is `(-cos h, sin h)`. Increasing h turns left.
  The car model faces -z, so `root.rotation.y = psi + π`.
- **Paths.** Every path is one-way. You drive it with s increasing, and d is the offset to the right of the
  centreline.
- **Cross-section of a path.**
  - Travel lanes run from `edgeL` to `edgeR`, which are -lanes·3.66/2 to +lanes·3.66/2.
  - Paved shoulders run out to `paveL` and `paveR`.
  - Barrier faces are at `wallL` and `wallR`, 0.35 m beyond the pavement.
  - Lane 0 is the leftmost, fast lane. Trucks use the rightmost two.

## The network (`world/Network.ts`, `world/Path.ts`)

- **Paths.** 20 freeway carriageways and 1,247 ramp pieces.
  - Each is a centripetal Catmull-Rom spline through the exported control points, resampled every 2 m.
  - Each sample stores x, y, z, unwrapped heading, curvature and grade.
- **Junctions.**
  - `out` lists where you can leave a path, with a kind:
    - `diverge`: a ramp starts while this path carries on.
    - `merge`: this path ends inside another.
    - `continue`: end-to-start.
  - `next` is where the travel lanes carry on past the end, if anywhere. `prev` is the reverse.
  - Junction positions are control points, so they're exact on both paths.
- **Spatial grid.** Cells are 50 m, with a path id and sample index every 8 m.
  - `near(x, z, r)` gives one hit per path stretch, with its projection.
  - `surfaces(x, z, y)` gives the paved surfaces under a point at that height. Bridges don't count.
  - `covered()` asks whether a point is on another road. Both use it.
- **Barriers.** A path has a barrier along each paved edge wherever that edge point isn't on another road (within
  2.5 m of height).
  - This one rule produces gaps where ramps split off, gore noses, merges, and Y junctions where one freeway ends in
    another. It's computed lazily per sample and cached, a window of ±32 samples at a time.
  - A ramp that starts at another road has no barrier for its first three samples. They're set outright, because the
    first look at a ramp can come from further along it, before those samples are worked out.
  - The physics collides with the actual barrier segments (`wallsNear`). Run ends (`capA`/`capB`) act as posts, so
    you can hit a gore nose.
  - The physics only takes barrier segments within 2 m of the car's height. A ramp climbing past your road gets
    barriers once it's 2.5 m clear of it, and those are over your roof.
  - A path with no `next` gets a wall across its end (and a crash cushion), unless it ends on another road
    (`hasEndWall`). The game turns you around or rejoins you before you reach it.
  - `wallsNear` copies each segment's end before checking its neighbours, because `hasWall` can reuse the shared
    `AT` buffer while it works out more of the road.
  - `npm test` scans every travel lane of the 20 carriageways for a barrier within 1 m of the lane's centre line, and
    checks that the barriers come out the same on a first look as on a second.
- **Routing.** `route(from, s, to)` is a small Dijkstra over (path, entry s) states. Its cost is distance plus 30 m
  for each ramp piece. It returns the list of junctions to take, or null if there's no way.
  - Turnarounds and street exits aren't edges, so from the far south of the 405 and the 5 (past about 42.6 km and
    53 km) there's no planned way back north.
  - `Game.followRoute()` keeps the navigator on track whenever the road under you changes: it ticks off a hand-off,
    plans again if you've left the route, or arrives. If there's no way from the road you're on, it keeps the
    destination and tries again at the next road, and after a turnaround or rejoin.

**OSM quirk to know about.** Ramp lines leave from the middle of the carriageway; that's where OSM puts the node.
For the first 100 to 300 m a ramp's centreline runs inside the freeway's pavement. Two things depend on this:
- Rendering hides the overlapped part of the lower-ranked road.
- The autopilot only steers for a ramp once the ramp line is further out than its lane.

## Rendering

- **Roads (`world/Roads.ts`).** Chunks are 160 m per path, plus one per street overpass. They're built nearest and
  ahead first, with a budget per frame.
  - Each chunk has lane and shoulder strips. Quads covered by a better-ranked road (mains before ramps, then lower
    id) are dropped.
  - Each chunk also has paint (lane dashes, edge lines, reflectors), barrier runs (Jersey, or a 4.6 m block sound
    wall in town), light standards, and guide-sign gantries 800 m and 260 m before each exit.
  - Elevated sections (more than 2 m above ground) get a deck underside and columns. Columns are never placed on
    another road.
- **Road surfaces.** `Roads` picks the lane material per path: `pcc` (concrete slabs, `textures.ts` `pcc()`, tiled one
  lane wide by `SLAB` = 4.57 m along, so `vRow` uses `SLAB` for those paths) for mains that are not toll roads
  (`TOLL` set), `asphalt` otherwise. `setWet` darkens and glosses both. Lane lines are Botts' dots: four 0.11 m
  quads per dash period at 0.45 + k × 0.92 m, lifted 0.02 m, plus the reflector in the gap. Sound walls use
  `blockWall()` (courses along the strip's u, which runs up the face; blocks along v, the road).
- **Terrain (`world/Terrain.ts`).** Tiles are 480 m. LOD 0 has a 12 m grid within about 520 m; LOD 1 has a 40 m
  grid.
  - Heights are the 60 m elevation grid plus noise. Every road sample then pulls nearby vertices toward the road's
    height, so embankments and cuts form.
  - Bridges cap the ground below the deck instead of pulling it up. Vertex colours show dry grass, chaparral on
    slopes, irrigated green in town, and sand at sea level.
  - Scenery sits on a jittered grid and is always clear of roads. On the flats it's stucco houses with tile roofs
    and office blocks; elsewhere, palms, trees and shrubs.
  - A sea plane sits at y = -0.4.
- **The player's car (`vehicle/PlayerCar.ts`).** Built from the realism preview's modules, which the game now
  depends on (read-only: `src/preview/car.ts` `buildCar`, `cockpit.ts` `buildCockpit`, `hands.ts`
  `buildDriverArms`, `car-wheel.ts` `addWheel`, `spec.ts` `EYE`). `configure({ car, paint, quality, look,
  presentation, nails })` rebuilds only what changed: car id or quality → the exterior (`cabin: 'full'`, no wheels),
  the cockpit (`body: false`, `mirrors: 'env'`) and four wheel groups (hub kit on a steering group, spinning kit
  inside it, placed from `bodyFor(id).AXLE`); paint → the shared paint material's colour; look, presentation or
  nails → the hands. Quality tiers: Low and Medium → 'phone', High and Ultra → 'high'. From the seat the exterior's
  glass, frit and cabin silhouette are hidden (`setOutsideView`). `updateCockpit()` steers the wheel mount
  (`delta × steerRatio`, clamped to ±2.2 rad), the hands follow it, and the tach needle takes the rpm. Build cost in
  SwiftShader: about 0.4 s car, 0.6 s cockpit, 1 s hands (the hands' SDF is meshed at load and cached per
  presentation and quality). `Cockpit.ts` and `Instruments.ts` are the previous look and are no longer used.
- **Traffic bodies (`traffic/carModels.ts`).** All seven classes come from `src/preview/traffic.ts`
  `trafficParts(kind, 'phone', { wheels: false })`: `paint` (the body loft and end caps, no colour attribute so the
  instance colour paints it), `glass` (the band), `trim` (vertex-coloured, one shared material and one more
  `InstancedMesh` per class), and `spec` (length, width, wheel radius, track, every axle's z) for the class's
  dimensions and wheel positions. The game keeps its own wheels and lamps. The body material is the preview's
  `M.paint` with a white base, which honours `instanceColor`. The semi is a rig: the loft is a conventional tractor
  (boxy sections, a narrowed 2.2 m hood, glass only over the doors via `glassEnd`, chrome grille and bumper, sun
  visor, a roof fairing in paint, stacks, tanks, frame rails, fifth wheel, west-coast mirrors) placed at the front of
  a 20 m frame, and the 45 ft trailer (box, floor frame, skirts, conspicuity tape, landing gear, door rods, mud flaps,
  underride guard) is trim in that frame; `rig.axles` lists all five axles, so the game instances ten wheels.
- **Environment.** The sky shader, PMREM lighting, sun shadows following the car, haze and the far mountain ring
  are unchanged from Ultra. Since 2026-10-15 the sun has a lens flare (`three/examples/jsm/objects/Lensflare`): a
  warm glow at the sun and four ghost rings down the lens axis, from two canvas textures (`T.flareGlow`,
  `T.flareGhost`). `Environment.follow()` parks it 900 m out along `sunDir` from the camera every frame and scales
  the elements' colours by daylight × the sun's height × the weather's sun factor, so it fades under cloud, goes in
  rain and fog, and is off at night. Its own depth test hides it behind the roof, pillars and mirror; the glass
  doesn't write depth, so it reads through the windscreen.
- **Corner window.** It's either a 2D heading-up map drawn into a canvas at 10 Hz, or a scissored second render from
  a camera 150 m above the car.

## UI

- `src/ui/styles.css` is the "Chrome noir" stylesheet: every colour, font and gradient is a token at the top
  (`--void`, `--night`, `--volt`, `--mag`, `--chrome`, `--f-display`, `--f-ui`, `--f-mono`, …). The fonts load from
  Google Fonts through the link in `index.html` and in `scripts/single-file.mjs`; keep the two in step.
- The menu is `.overlay.menu > .menu-col` with a `.row.dock` that is `position: sticky; bottom: 0` (the Drive
  button stays reachable while the column scrolls), and `.menu-aside` fixed to the viewport on wide screens. Panels
  (`.panel`) have a sticky last `.row` as their footer. Every `.overlay` sets `scroll-padding-bottom`, so anything
  scrolled into view (by a tap, a tab, or Playwright) lands above those footers.
- The column's slide-in animates its children, not the column: a transform on the column would make the fixed
  aside position itself relative to the column.
- `tools/ui-shots.mjs` captures the 13 screens and waits for entrance animations to finish before each shot; in
  SwiftShader the first frames after load take seconds (shader compilation), which delays the animations' start.

## Simulation

- Fixed 120 Hz physics with an accumulator and interpolation.
- **`CarPhysics.step(dt, controls, path, net)`.**
  - The bicycle model and drivetrain are unchanged.
  - After moving, the car is projected onto the current path for s, d, height and grade. It then collides with
    barrier segments from `net.wallsNear`.
- **`Game.trackPath()`.**
  - If the car is outside its path's lanes (or every fourth step anyway), it scores the surfaces under the car. The
    score rewards being inside a path's lanes, heading alignment, the current path (stickiness), and the route's
    next path. The car switches to the best one.
  - This is how you go onto ramps, off them, and through Y junctions. No scripted hand-offs.
- **Traffic (`traffic/Traffic.ts`).**
  - Cars live on freeway carriageways within view. Each carriageway is its own queue: IDM gaps, signalled lane
    changes with gap checks, yielding to a fast player.
  - At a freeway's end a car carries on into `next`; otherwise it despawns.
  - Collisions are oriented boxes in world space, within 2.5 m of height, so they work across roads and at
    junctions.
  - Spawning is deterministic for a seed, at cars per km per lane. It happens beyond 72% of the view distance, so
    nothing pops in close.
- **Autopilot** (the menu demo, and the test driver).
  - Pure pursuit on whichever road it means to be on.
  - Lane choice for gaps and for the next exit.
  - Curve speed √(7.5 / k).
  - Gap control by closing speed.

## Modes and scoring

- **Free Drive.** Start on any of 12 carriageway points. Navigate anywhere.
- **Speed Survival.**
  - Score is distance times a speed band (×1 at 100 mph, more above), times a streak multiplier of up to ×3 after
    60 s over 100 mph.
  - Clean passes score 100 and near misses (gap under 0.9 m) score 250, times a combo of up to ×8.
  - Each car scores once. Cars under 10 m/s don't score. Nothing scores while wrong-way.
  - Hitting a wall above 3 m/s, or any contact, resets the streak.
  - A crash ends the run: a car above 7 m/s, or a wall above 17 m/s.
- **Time Trial.** Fixed start and seed. 60 s, plus 25 s every 2 km.
- **Runs.** Stored per mode, top ten, in `localStorage` under `tsu.runs.v1`. Always labelled local.

## Testing hooks

- `window.__game` exposes:
  - `fastForward(seconds, controls, cruise)`: runs the simulation without rendering; cruise > 0 drives with the
    autopilot.
  - `navigateTo(label)` sets a route.
  - `stats` returns the path, position, speed, roads and tiles built, path switches, freeways visited and the route.
  - `frames` counts rendered frames.
- Playwright runs headless Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`. Tests use
  `fastForward` for distance (about 25× real time) and real frames only where rendering is the point.
- In this sandbox SwiftShader draws Low at about 1.6–2.3 fps (at 320×180 as at 640×360, so it's limited by geometry,
  not pixels), Medium at 0.3–0.7 fps, and High and Ultra at about 0.3 fps once warm. The first frames after a switch
  to High or Ultra take minutes. None of this says anything about a phone.

## The regression suite (`npm test`)

- `tests/regression.mjs` drives the built `dist/top-speed-ultra.html` through `window.__game` and prints PASS or FAIL
  with the numbers each check saw. Run `npm run build` first. It takes about 10 minutes here.
- Groups: `boot`, `interchanges`, `survival`, `race`, `abilities`, `progression`, `render`, `phone`, `launch`. Run some with
  `npm test -- --only=race,survival`. Add `--slow` to render the High and Ultra presets too.
- `GAME_HTML=path/to/top-speed-ultra.html npm test` tests another build, such as an older commit's.
- Every group opens a fresh browser context, so each starts with an empty profile. Screenshots go to `tests/out/`
  (git-ignored).
- Free Drive and Speed Survival seed their traffic at random. The suite puts the car back on its mark and seeds the
  traffic (`traffic.reseed(n)` and `fill()`), so every run is the same drive. The autopilot isn't a perfect driver:
  in Heavy traffic it crashed in 2 of 12 seeded two-minute Survival runs.

## Game systems added after the network

- **`profile.ts`.** `ProfileBook.add()` takes small increments (time, distance, passes, freeways, interchanges) and
  returns level-ups and unlocks. It saves when there's something worth saving. `buy`, `sell` and `choose` handle the
  garage; `reward` handles race payouts. Migration lives in `migrate()`.
- **`drivers.ts`.** `DRIVERS`, `ABILITIES`, `lookFor()`, which gives the cockpit's cosmetic look, and `Ability`,
  which does duration and cooldown.
  - Clear Path sets `Traffic.scale = 0.65` (fewer spawns), `Traffic.thin()` (out of view only) and
    `Traffic.makeWay()` (gap-checked lane changes).
  - Focus Time steps traffic with `dt × 0.7`.
  - Locked In multiplies grip by 1.3.
  - `PlayerCar.setLook()` and `setPose('wave' | 'watch' | 'knee' | null)` handle the hands: Clear Path waves the left
    hand at the window for 1.6 s, Focus Time brings the left wrist up for a 0.9 s watch check, Locked In rests the
    right hand on the console for its duration.
- **Start at your exit.** `Game.exitsFor(label)` lists a carriageway's real exits from `net.signs` (key, sign text,
  s, miles, side), de-duplicated by key `'<carriageway> @ <metres>'`. `Settings.exit` holds a key; `Game.start()`
  resolves it to the sign (within 20 m, so a rebuilt data file still matches) and places the car at `sign.s - 450`
  (clamped to the road) in the second lane. An empty key, or one the data no longer has, falls back to `Settings.start`.
- **Run cards (`src/ui/runCard.ts`).** `drawRunCard(result, name)` draws a 1080 × 1350 canvas; `shareRunCard()` tries,
  in order: `navigator.share` with the PNG as a file where `canShare` allows it (phones); the hosted page's viewer
  save prompt (`window.claude.use('downloads')` → `save({filename, data})`, which the claude.ai artifact viewer
  provides when the artifact is published with `capabilities: {downloads: true}`; a plain download does nothing in
  that viewer); else an `<a download>` of a blob URL (the file:// build and ordinary hosting). `Result.road` carries
  the carriageway for the shield.
- **Feedback report.** `Game.report()` gathers the device and drive numbers (`Report`); `src/ui/feedback.ts` formats
  them and copies to the clipboard (falling back to select-and-`execCommand('copy')`). `VERSION` in `settings.ts`
  must be bumped with `package.json`.
- **`cars.ts`.** `applyCar()` writes a car's numbers into the physics `SPEC`. `figures()` gives the showroom's
  estimates, calibrated to the GT's measured 3.3 s and 211 mph.
- **`race.ts`.**
  - Courses are stretches of one carriageway.
  - Rivals are `Traffic` cars with a `racer` record. They're never despawned or thinned, are held during the
    countdown, run flat out up to √(11/k) in curves, and are set against your car's computed top speed.
  - Progress means projecting onto the course path.
- **`env/Environment.ts`.**
  - `sunPosition()` is an astronomical sun position for 33.72° N, 117.83° W.
  - Weather presets come from the `WX` table. The state eases toward its target over about 2.5 s.
  - The PMREM environment map is rebuilt at most every 4 s when things change.
  - Rain streaks are a 1,800-segment `LineSegments` round the camera.
- **`audio/Radio.ts`.** A sixteenth-note scheduler on the audio clock, looking 250 ms ahead. Each station has a key,
  chords, tempo, swing and style (pads, synthwave or lo-fi). It plays into `AudioEngine.musicBus`, which bypasses the
  Ultra Realism muffle.

## Known issues

- **Unresolved crossings.** 4 of 506 crossings don't fully clear (the builder prints them): a ramp clips another road
  at about 3 places.
- **Junction height steps.** Up to 0.29 m.
- **Lane counts.** They're per route, so lane drops and adds aren't modelled. HOV and express lanes aren't separate.
- **Exits.** There are no exit numbers, since the source data has no `junction:ref`.
- **Street ramps.** They end at a barrier. The game moves you to a nearby on-ramp instead of driving surface
  streets.
- **Hands.** Anatomical since 2026-10-15 (the preview's). The ability poses are on them since the same day
  (`DriverArms.setPose`: a pose names the wrist's place and which way the hand points and its back faces; the bone's
  rotation is solved from the bind hand's measured axes, the arm's IK follows, and it blends in and out over 0.3 s).
  The fingers keep their grip curl in every pose: there is no finger rig. The cockpit's side screens are static; the
  paddles don't flick.
- **Switching graphics presets leaks a little.** Each round trip to Ultra leaves about 17–20 more textures alive
  (36 → 56 → 73), probably the bloom and GTAO passes' render targets, which `EffectComposer.dispose()` doesn't free.
  The frame rate on Low afterwards is unchanged.
- **Traffic can cut in close.** A traffic car (not an aggressive one) changed lanes into the autopilot about 5 m ahead
  while closing at 20 m/s, in Heavy traffic.
