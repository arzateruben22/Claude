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
    another. It's computed lazily per sample and cached.
  - The physics collides with the actual barrier segments (`wallsNear`). Run ends (`capA`/`capB`) act as posts, so
    you can hit a gore nose.
  - A path with no `next` gets a wall across its end, and the game turns you around or rejoins you before you reach
    it.
- **Routing.** `route(from, s, to)` is a small Dijkstra over (path, entry s) states. Its cost is distance plus 30 m
  for each ramp piece. It returns the list of junctions to take.

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
- **Terrain (`world/Terrain.ts`).** Tiles are 480 m. LOD 0 has a 12 m grid within about 520 m; LOD 1 has a 40 m
  grid.
  - Heights are the 60 m elevation grid plus noise. Every road sample then pulls nearby vertices toward the road's
    height, so embankments and cuts form.
  - Bridges cap the ground below the deck instead of pulling it up. Vertex colours show dry grass, chaparral on
    slopes, irrigated green in town, and sand at sea level.
  - Scenery sits on a jittered grid and is always clear of roads. On the flats it's stucco houses with tile roofs
    and office blocks; elsewhere, palms, trees and shrubs.
  - A sea plane sits at y = -0.4.
- **Environment.** The sky shader, PMREM lighting, sun shadows following the car, haze and the far mountain ring
  are unchanged from Ultra.
- **Corner window.** It's either a 2D heading-up map drawn into a canvas at 10 Hz, or a scissored second render from
  a camera 150 m above the car.

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
- Playwright runs headless Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader`. Software rendering
  runs at about 10 fps, so tests use `fastForward` for distance and real frames for screenshots.

## Known issues

- **Unresolved crossings.** 4 of 506 crossings don't fully clear (the builder prints them): a ramp clips another road
  at about 3 places.
- **Junction height steps.** Up to 0.29 m.
- **Lane counts.** They're per route, so lane drops and adds aren't modelled. HOV and express lanes aren't separate.
- **Exits.** There are no exit numbers, since the source data has no `junction:ref`.
- **Street ramps.** They end at a barrier. The game moves you to a nearby on-ramp instead of driving surface
  streets.
- **Hands.** They're stylised fists.
