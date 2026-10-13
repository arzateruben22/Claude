# Realism preview

A separate page that shows how realistic Project OC can look in a browser: the driver's hands, the car inside and
out, the real I-405 North through Irvine with its real buildings, at golden hour. It is **not the game**: it imports
game modules read-only and never changes them. What works here can later move into the game behind the quality
presets.

## Rules for every part

- **Never edit files outside `src/preview/`** (and `tools/preview-*.mjs`, `tests/out/preview/`). The game, its tests
  and its docs stay as they are. To start from a game module, copy it into `src/preview/` and change the copy.
- **Made in code.** No downloaded models, textures, fonts or HDRIs. Textures are drawn at load with canvas or
  generated in shaders. The one exception is open map data (OpenStreetMap / Overture, ODbL), credited.
- **Our own brands only.** Rossini, Vela and the "R" badge. No real car brands, logos or copied designs, no Rolex.
- **three.js 0.160.1** (`three` and `three/examples/jsm/...`), TypeScript, strict. `npx tsc --noEmit` must pass.
- **Budgets** are in `spec.ts` (draw calls, triangles, texture size per part). Stay inside them. Offer a `quality`
  option: `'phone'` (lighter) and `'high'` (the full look).
- **Fast to build.** A part should generate in well under 2 s on a desktop. Cache generated textures; share materials.

## Frames and units

- Metres, y up. **The car's frame** (`spec.ts`): x to the driver's right, the car faces -z, origin on the ground under
  the middle of the car, driver on the left. `EYE`, `WHEEL_AT`, `WHEEL_TILT`, `rimAt()`, `rimA()`, `rimB()` and `GRIP`
  describe the steering wheel and where the hands hold it.
- **The scene's frame** (`stage.ts`): local metres around the stretch's middle. Network data is in world metres
  (x east, z south, y above sea level): convert with `stage.toLocal()`. `stage.roadPoint(s, d)` gives a point on
  I-405 North, `stage.driverView(s)` puts the camera in the driver's seat and returns the car's frame there.
- **The stretch**: `stage.stretch` has the network (`net`), the I-405 North path (`path`), the range `s0..s1`
  (a few kilometres), the real exit signs on it (`signs`, with destination text) and every path (mains and ramps) within
  400 m (`paths`). `net.ground(x, z)` is the bare-earth height. `net.overpasses` are the streets that cross.

## Testing a part

Each part has a test page `src/preview/test-<part>.ts` built on `makeStage()` that frames the part and calls
`stage.ready()`. Render it with:

    node tools/preview-shoot.mjs src/preview/test-<part>.ts tests/out/preview/<part>-<view>.png --size=640x360 --query="view=x"

It prints the renderer's numbers (draw calls, triangles) and any page errors. Other parts are being written at the
same time, so check types with `npx tsc --noEmit 2>&1 | grep <your files>` and fix every error in your own files. SwiftShader renders in software here
(4 CPUs, shared): keep test renders small (640×360 or less) and scenes focused. Look at every screenshot (it is a PNG
you can read). The current game, for comparison: `src/preview/test-stage.ts` → `tests/out/preview/before-seat.png`.

## Parts and their APIs

| Part | File | Exports |
| --- | --- | --- |
| Hands | `hands.ts` | `buildDriverArms(o: HandsOptions): DriverArms` — both hands gripping the rim at `GRIP` plus forearms and sleeves to the shoulders, in the car's frame |
| Car | `car.ts`, `cockpit.ts` | `buildCar(o: CarOptions): THREE.Group` (exterior, car's frame); `buildCockpit(o: CockpitOptions): Cockpit` (interior, car's frame, with its steering wheel at `WHEEL_AT`); optional `buildTrafficCar(kind, paint)` |
| Road | `road.ts` | `buildRoad(stage, o): THREE.Group` — every road surface, marking, barrier, wall, sign, light pole and overpass on the stretch |
| Buildings | `buildings.ts`, `data/buildings.json` | `buildBuildings(stage, o): THREE.Group` — real footprints from Overture Maps, heights where known |
| Atmosphere | `atmosphere.ts` | `setupAtmosphere(stage, o): Atmosphere` — sky, sun, shadows, image-based light, haze, post-processing |
| Ground and plants | `ground.ts` | `buildGround(stage, o): THREE.Group` — terrain, groundcover, palms, trees and shrubs, clear of the roads |
| The scene | `main.ts` | puts it all together; `?view=` presets; the page that gets published |

Each part documents its options at the top of its file.

## Builds

The game's `npm run build` type-checks with `tsconfig.game.json`, which leaves out `src/preview/`, so work here can
never break the game's build. Plain `npx tsc --noEmit` still checks everything, the preview included.
