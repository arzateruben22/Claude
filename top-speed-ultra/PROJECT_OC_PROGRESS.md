# Project OC: progress log

Newest first. Every claim names how it was checked. "Verified" means it was run in headless Chromium (SwiftShader,
software rendering) through Playwright, using the game's `window.__game` test hooks. No real phone or GPU was
available, so frame rates on real hardware are **not** measured.

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
