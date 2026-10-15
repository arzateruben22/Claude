# Project OC: evaluating a move to Unreal Engine 5

**Status: evaluation only.** Nothing in the project was changed, moved or deleted for this document. It was written
on 2026-10-15 from the code on `claude/always-on` at commit `03b026c`, by reading every module and the four project
docs. Numbers marked *estimate* are judgement, not measurements. Prices are approximate and need checking at the time
of purchase.

The owner's ask: evaluate migrating Project OC to Unreal Engine 5 while preserving everything already built; audit the
engine, languages, file structure, 3D assets, character systems, driving mechanics, maps and gameplay logic; say what
can be reused, converted or must be rebuilt; explain how **Rhys** becomes a working UE5 character; do not modify the
current project; plan it in phases starting with a small playable prototype; and state the hardware and cloud needs
before proceeding.

---

## 0. The short version

1. **It is not a migration; it is a second build.** Nothing from a three.js/TypeScript game runs inside Unreal. What
   carries over is the *data* (the real road network, terrain, Anaheim streets and buildings), the *numbers* (every
   car, tyre, traffic, scoring, ability and XP constant, all verified), the *design* (four docs, the identity, the
   dialogue, the rules), and the *algorithms* (ported line by line to C++). The rendering, assets, UI, audio, input,
   saves and build are rebuilt with Unreal's own systems, which is the point of moving.
2. **Keep the web game as the phone product.** This matches the direction already agreed (desktop leads graphics,
   phones scale down). Unreal on phones is possible but loses most of what makes it worth having (Lumen, Nanite,
   MetaHumans), and app stores add accounts, review and a native build pipeline. The web game stays live, keeps its
   link, and keeps shipping.
3. **Rhys does not exist in the project under that name.** A repo-wide search found the name only inside base64
   terrain data (a coincidence of letters). What exists is the **player character system**: three driver archetypes
   (The Closer, The Ace, The Wrench), each in a male or female presentation, five skin tones, cosmetics, three hand
   animations, one timed ability each, a profile whose default name is "Driver", and the on-foot people builder. Section
   3 shows how all of that becomes one UE5 character and what a "Rhys" built from it would keep. Before Phase 1 starts,
   the owner needs to say which of these Rhys is (or write the character sheet in §3.1).
4. **Start with one playable stretch**, the same 5 km of the I-405 North the realism preview uses, one car, traffic,
   the driver's-seat camera with hands on the wheel, and Speed Survival scoring. Four to eight weeks for one engineer
   (*estimate*). Then decide with a measured result whether two codebases are worth it.
5. **Hardware:** a Windows PC with an RTX 4070-class GPU, 32 GB of RAM (64 recommended) and a 1 TB NVMe drive, or a
   cloud GPU workstation at roughly $1 to $1.50 an hour. **This cloud session cannot run Unreal** (no GPU, no Windows,
   4 CPUs). It can still do all of Phase 0: the engine-independent C++ core, the data exporters and the character
   sheet, all testable here.

---

## 1. Audit: what exists today

### 1.1 Engine and languages

| | |
| --- | --- |
| Engine | None. A custom engine on **three.js 0.160.1** (WebGL 2): fixed 120 Hz simulation with interpolation, floating origin re-centred every 1.5 km, chunk streaming, its own physics, traffic, environment and audio. |
| Languages | **TypeScript 5.5** (strict) for the game, UI, realism preview and on-foot work: about 18,400 lines (`src/game` 5,677; `src/ui` 855; `src/preview` 6,969; `src/onfoot` 4,858). GLSL as shader chunks inside TypeScript. **Python 3** for the two data pipelines (`tools/oc-network`, `tools/anaheim`; pyarrow, shapely). **JavaScript (ESM)** for the build, screenshot and test tools. CSS for the UI. |
| UI | React 18 over the canvas (`src/ui/App.tsx`, `HUD.tsx`, `Touch.tsx`, `styles.css`). |
| Build | Vite 5 → one self-contained HTML (`dist/top-speed-ultra.html`, about 3.2 MB) plus `dist/artifact.html` for the hosted link. No build step at runtime, no server. |
| Tests | `tests/regression.mjs`: 50 checks in 8 groups, Playwright driving headless Chromium (SwiftShader) through `window.__game` hooks. About 10 minutes. 50/50 on the last full run. |
| Runtime deps | three, react, react-dom. Nothing else. |
| Size | 62 MB on disk without `node_modules` (117 MB) and `dist` (9 MB). The repo also holds the older v1/v2 canvas game (`top-speed-oc/`, 132 KB) and the Loop Lab preview (23 KB), both left as they are. |

### 1.2 File structure

| Path | What it is | Lines |
| --- | --- | --- |
| `src/game/Game.ts` | The loop: renderer, scene, 120 Hz simulation, cameras, modes, navigation, HUD numbers, test hooks | 1,128 |
| `src/game/vehicle/Physics.ts` | Single-track (bicycle) car model, drivetrain, tyres, ABS, barrier collision | 271 |
| `src/game/vehicle/PlayerCar.ts`, `Cockpit.ts`, `Instruments.ts` | Lofted body, wheels, lights, sprung body; the interior and the driver's hands; tach, screens, shift lights | 937 |
| `src/game/world/Network.ts`, `Path.ts` | The road network: decode, splines, spatial grid, barriers, routing | 462 |
| `src/game/world/Roads.ts`, `Terrain.ts` | Road chunk meshes, paint, barriers, gantries; terrain tiles with embankments and scenery | 642 |
| `src/game/traffic/Traffic.ts`, `carModels.ts` | IDM traffic, lane changes, spawning, collisions, racers; ten instanced vehicle classes | 491 |
| `src/game/env/Environment.ts` | Sky, sun position, weather table, shadows, rain, night | 296 |
| `src/game/audio/AudioEngine.ts`, `Radio.ts` | Synthesised V8 and effects; three stations composed in code | 294 |
| `src/game/drivers.ts`, `cars.ts`, `race.ts`, `profile.ts`, `records.ts`, `settings.ts`, `input.ts`, `textures.ts`, `road/props.ts`, `util.ts` | Characters and abilities; the four cars; races; profile, XP, achievements; local bests; settings and quality presets; input; procedural textures; scenery | 1,156 |
| `src/ui/` | Menus, panels, HUD, touch controls, one stylesheet | 855 |
| `src/data/oc-network.json` | The real OC freeway network and a 60 m terrain grid (2.3 MB) | |
| `src/data/anaheim/` | A 3 km slice of Anaheim's stadium district, city streets, the freeway-to-venue link (1.9 MB) | |
| `src/preview/` | The realism preview (separate page): SDF hands, four car bodies, cockpit, stage, test pages | 6,969 |
| `src/onfoot/` | The people builder (parametric bodies, faces, skeleton, animation, clothes, hair, LODs) and its test page | 4,858 |
| `tools/oc-network/`, `tools/anaheim/` | Python pipelines from Overture Maps (OSM-derived) and AWS Terrain Tiles | |
| `tools/*.mjs`, `tests/` | Screenshot tools, hand-measuring tools, the regression suite | |
| `PROJECT_OC_*.md`, `CLAUDE.md` | Master prompt, progress log, roadmap, technical notes, on-foot plan | 1,483 |

### 1.3 3D assets

**There are no asset files.** No models, textures, fonts (one Google Font loaded by link), HDRIs, audio clips or
animation data exist anywhere in the project. Every visual and sound is generated in code at load:

- **Geometry:** lofted sections (car body, traffic profiles), swept tubes (steering wheel), extrusions (dash, door
  cards), merged primitives (scenery), road strips from the splines, signed-distance fields meshed with surface nets
  (the preview's hands, the people's bodies and heads).
- **Textures:** painted into canvases (`textures.ts`: carbon weave, leather, concrete, paint flake, sign faces, the
  tachometer) and normal maps computed from height fields.
- **Materials:** three.js `MeshPhysicalMaterial` with custom shader chunks (skin, clearcoat paint, fabric).
- **Audio:** Web Audio oscillators and noise (engine, wind, tyres, radio music, station idents).
- **Animation:** procedural (hand poses, wheel following, head bob, people's idle/talk/walk/sit/laugh/turn), no
  keyframe files.

This is both the reason the game ships as one 3 MB file and the reason nothing visual transfers to Unreal as an
asset: there is nothing to import. What transfers is the *design* of each thing (shapes, dimensions, palettes,
behaviours) and, for the procedural generators, the option of porting them to Unreal's Geometry Script.

### 1.4 Character systems

Four systems make up the player character and the people:

1. **Driver archetypes** (`drivers.ts`): `closer` (The Closer, Dealmaker: pressed shirt, heavy gold watch; ability
   Clear Path), `ace` (The Ace, Racer: gloves; Focus Time), `wrench` (The Wrench, Engineer: sleeves rolled, smart
   watch; Locked In). Each has a male or female presentation (cosmetic: hands 0.9 scale for `f`, bracelet or ring),
   five skin tones (`SKINS`). `lookFor(id, presentation, skin)` returns a `DriverLook`: skin, sleeve colour or rolled,
   gloves colour, watch (gold, steel, smart or none), ring, bracelet, scale, and the ability's hand pose (`watch`,
   `wave`, `knee`).
2. **In-car hands and arms.** In the game (`Cockpit.ts`): stylised fists and arms that follow the wheel, with
   `setLook()` and `setPose()`. In the preview (`src/preview/hands*.ts`): anatomical SDF hands gripping the rim at
   148° and 32° (`spec.ts` GRIP), forearms and sleeves to the shoulders, nails (natural or painted), watches, ring,
   bangle, gloves; 71k triangles per pair on 'high'; measured hand lengths 182.6 mm (m) and 167.7 mm (f).
3. **The profile** (`profile.ts`): name (default "Driver", 20 characters), avatar colour (8), XP and level
   (400·n^1.5), credits, lifetime stats, freeways driven, nine achievements, cars owned. Saved locally, versioned (v1)
   with a migration path.
4. **The people builder** (`src/onfoot/people/`): one continuous body generator (`BodyShape`: sex, age 21–75, height,
   heads, fat, muscle, apple/pear, belly, bust, shoulders, hips, waist, legs, posture, soft), a face generator
   (`FaceShape`: 22 parameters), a `Look` (skin, iris, 9 hair styles, grey, facial hair, glasses, make-up, freckles,
   tattoos, nails), garments (19 kinds, 7 fabrics), accessories; a **26-bone skeleton** (root, hips, spine, chest,
   neck, head, clavicle/arm/forearm/hand/fingers/thumb ×2, thigh/shin/foot/toe ×2); morph-target expressions
   (neutral, smile, laugh, playful, talking, listen, surprised) and visemes (AA, EE, OO, MM, FF); procedural idle,
   talk, walk, sit, laugh, turn and head/eye aim; three LODs; 16 presets spanning the body-diversity brief. Status:
   built and rendering; faces still read as stylised game faces, hair and clothes mid-way (see the progress log).

There is no named character, no backstory text, no voice and no recorded animation. The "personality" that exists
is each archetype's title, blurb and ability, the owner's rules for NPC lines (friendly, respectful, no real
businesses), and about 60 planned original lines in `PROJECT_OC_ON_FOOT.md`.

### 1.5 Driving mechanics

- **Physics** (`Physics.ts`): single-track model with load transfer, saturating tyres, a friction circle at the driven
  rear axle, aero drag and downforce, ABS, a 7-speed dual-clutch with shift logic, a speed-sensitive steering lock,
  arcade-to-sim stability control (`handling` 0..1), reverse by holding the brake at a standstill, `hold` for the
  start line. Fixed 120 Hz. After moving, the car is projected onto its path (s, d, height, grade) and collides with
  the real barrier segments. Calibrated: the Rossini GT does 0–60 in 3.3 s and 211 mph in the sim.
- **Cars** (`cars.ts`): four of our own: Rossini GT (1,480 kg, 711 hp), Rossini Brio (1,250 kg, 470 hp), Rossini
  Corsa (1,410 kg, 819 hp, big downforce), Vela E (2,150 kg, 1,020 hp, 1,400 Nm electric). `applyCar()` writes mass,
  power, torque, redline, drag, downforce and final drive into the one `SPEC`.
- **Road following** (`Game.trackPath`): the car scores the paved surfaces under it and switches path; that alone
  takes you onto ramps, through merges and Y junctions, with no scripted hand-offs.
- **Navigation**: Dijkstra over (path, entry) states, prompts ("Keep right: CA-55 North · 0.4 mi"), reroutes, arrival.
- **Cameras** (`Game.updateCamera`): driver's seat (eye at (−0.37, 1.16, 0.10) m in the car frame; FOV 58°, 96° in
  portrait), free look (+8°), hood (62°), chase (6.6 m back, 2.25 m up, 8.2/2.9 in portrait, looking 3.5 m ahead and
  0.9 m up), look back, a corner window that is a map or a sky camera 150 m up. Head sway from body accelerations;
  Ultra Realism shake and tunnel vision.
- **Input** (`input.ts`): keyboard, gamepad, mouse and touch folded into one smoothed analog `Controls`.
- **Autopilot**: pure pursuit, lane choice, curve speed √(7.5/k), gap control. Drives the attract mode and the tests.

### 1.6 Maps and data

- **`oc-network.json`** (2.3 MB, Overture Maps release 2026-09-23.1, derived from OpenStreetMap, ODbL; elevation
  from AWS Terrain Tiles, USGS): 20 carriageways (I-5, I-405, CA-22, 55, 57, 73, 91, 133, 241, 261 both ways),
  1,247 ramp pieces, 1,256 junctions, 247 real street overpasses, real exit-sign destination text, a 60 m elevation
  grid. Control points are delta-coded decimetres; the game rebuilds centripetal Catmull-Rom splines sampled every
  2 m with heading, curvature and grade. Verified: every freeway reaches every other; 502 of 506 crossings clear
  6.5 m; the largest junction step is 0.29 m; a full-lane scan finds no barrier within 1 m of any lane centre.
- **Projection:** x east, z south, y up, metres from 33.72° N, 117.83° W (equirectangular; error under a metre
  across OC).
- **Anaheim** (`src/data/anaheim/`): `slice.json` (3 km × 3 km: 2,891 street segments, 2,928 buildings with heights,
  places as categories only, land use, water), `streets-city.json` (Anaheim's streets to the city limit),
  `freeway-link.json` (the CA-57 South Orangewood exit, path 1142, and the streets to the lot). Verified to line up
  with the freeway network within 0.3 m.
- **Procedural fill:** terrain noise, embankments and cuts pulled to the roads, scenery (stucco houses, offices,
  palms, trees), the Lot 57 venue layout (designed, in `PROJECT_OC_ON_FOOT.md`, with our own name, sign and palette).

### 1.7 Gameplay logic

- **Modes:** Free Drive (12 starts, navigate anywhere), Speed Survival, Races (Irvine Sprint, Santa Ana Checkpoints,
  Foothill Sprint, Riverside Endurance) against three AI rivals (Marco V., Dani K., Sol R.), Time Trial (fixed seed).
- **Scoring** (exploit-resistant, verified): distance × speed band × streak multiplier (up to ×3 after 60 s over
  100 mph); clean passes 100, near misses (under 0.9 m) 250, combo up to ×8; each car scores once; cars under 10 m/s
  don't; nothing while wrong-way; contact resets the streak; a crash (car over 7 m/s, wall over 17 m/s) ends the run.
- **Traffic:** five densities (None to Expert, 45% aggressive at Expert), deterministic per seed, IDM (a = 1.6,
  b = 3.2), signalled gap-checked lane changes, trucks right, flow into the next freeway, despawn beyond the haze.
- **Abilities:** Clear Path (8 s, 45 s cooldown: spawn scale 0.65, thin out of view, make way in view), Focus Time
  (5 s, 40 s: world at 0.7×, car at 1×), Locked In (7 s, 35 s: grip ×1.3).
- **Progression:** XP, levels, credits (earned only, never bought), garage slots 1 + level/4, buy/sell at 60%, Ultra
  Realism at level 5, nine achievements.
- **Weather and time:** real sun position from the clock (`sunPosition()`), presets, six weathers from a table
  (turbidity, sun, sky, cloud, fog, haze colour, wet, grip), rain grip 0.8, all simulated and labelled so.
- **Rules that are code, not just docs:** no payments; our brands only; the local leaderboard says "this device
  only"; the OSM/Overture credit is on screen; no live data of any kind.

### 1.8 UI, audio, saves, build, tests

- UI: 13 screens (menu, settings, bests, profile, driver, garage, start, course, loading, driving, go to, paused,
  results), phone first (390 px, 44 px targets), with the "Chrome noir" redesign built in a worktree and not yet
  applied (fonts Big Shoulders Display, Chakra Petch, JetBrains Mono).
- Audio: everything synthesised; three radio stations composed live; Ultra Realism muffle on a bus the music
  bypasses.
- Saves: `localStorage` keys `tsu.settings`, `tsu.profile` (v1), `tsu.runs.v1`, `tsu.best.*`, `tsu.race.*`.
- Build and delivery: one HTML file; the hosted link at claude.ai; GitHub Pages for the studio site at the repo root
  (a separate client project; untouched).
- Tests: the regression suite and `window.__game` hooks (`fastForward`, `navigateTo`, `stats`, `frames`).

### 1.9 What is verified as of this audit

From `PROJECT_OC_PROGRESS.md` (2026-10-12): 50 of 50 regression checks pass; interchange chains drive end to end
with seeded traffic; scoring, abilities, races, progression, weather, phone layout and context-loss recovery are all
checked in headless Chromium. Not measured anywhere: frame rates on a real phone or a real GPU. The realism preview,
the hands, the people builder and the Chrome noir UI are work in progress with renders on disk and progress notes,
not yet in the game.

---

## 2. Reuse directly, convert, or rebuild

"Directly" means the file or number is used as it is. "Convert" means the logic is ported line by line (TypeScript to
C++ or Blueprint) and checked against the original. "Rebuild" means Unreal's own system replaces ours and only the
design carries over. Nothing in TypeScript runs inside Unreal.

### 2.1 Reuse directly

| Component | How it is used in UE5 |
| --- | --- |
| `src/data/oc-network.json`, `src/data/anaheim/*.json` | The source of truth for roads, junctions, signs, overpasses, terrain, streets and buildings. An editor-time importer reads them (see §4, Phase 0). The files stay where they are; the UE project reads copies. |
| `tools/oc-network/`, `tools/anaheim/` (Python) | Unchanged. If UE needs a different resolution or box (LA County later), these pipelines produce it. |
| The projection (origin 33.72° N, 117.83° W; x east, z south) | Kept as the world frame, converted to UE axes by one formula (§3.7). UE5's Large World Coordinates (doubles) remove the need for the floating origin. |
| Every tuned constant | `SPEC` and the four `CarDef`s; `ABILITIES` durations and cooldowns; IDM a/b, lane-change rules, densities per km per lane; scoring bands, combo and streak rules; XP curve, prices, slots, sell rate; the `WX` weather table; camera offsets and FOVs; `GRIP` angles 148°/32°; `EYE`, `WHEEL_AT`, rim radius 0.178 m. These become Data Assets or a `.ini`/CSV, with the same names. |
| `sunPosition()` | The astronomical formula ports verbatim (20 lines) and drives UE's Sun Position or a directional light. |
| Design docs, identity, text | The master prompt, roadmap, on-foot plan (Lot 57, palette, site plan, the 60 lines), car names and blurbs, station names, achievements, course names, rival names, the honesty labels. |
| The regression suite's checks | Not the code (Playwright), but each of the 50 checks is a written acceptance test: the same drives, the same expected numbers. They become Unreal Automation tests (Phase 1 ports the Survival and Interchange groups). |
| Verification method | The habit: never claim a result that was not run; log it. |

### 2.2 Convert (port the logic)

| Component | Target in UE5 | Notes |
| --- | --- | --- |
| `Physics.ts` (271 lines) | A C++ `UOCVehicleComponent` with its own fixed 120 Hz accumulator, driving the car actor's transform; Chaos is used for queries and the visual suspension only | Porting keeps the verified feel and numbers (3.3 s, 211 mph, no spins at 200 mph). Replacing it with Chaos Vehicles would change the handling and invalidate the calibration; it can be an option later. |
| `Network.ts`, `Path.ts` | A C++ `UOCRoadNetwork` subsystem: the same decode, spline resampling at 2 m, spatial grid, `near`, `surfaces`, `covered`, barrier rule, `hasEndWall`, `route` (Dijkstra) | The barrier rule stays the single source of collision geometry, so the gore noses, merges and Y junctions behave as verified. At import time the walls are computed once for the whole network instead of lazily. |
| `trackPath`, `enterPath`, `followRoute`, `rejoin` | Methods on the vehicle component and a `UOCNavigator` | Same scoring of surfaces; same prompts. |
| `Traffic.ts`, `carModels.ts` | A C++ `UOCTrafficSubsystem` with a struct per car and one `UInstancedStaticMeshComponent` per vehicle class (the same instancing idea), seeded RNG, IDM, lane changes, flow into `next`, oriented-box contacts, racers | Mass Entity / MassTraffic (City Sample) is an option for thousands of cars later; not needed for 150–250 cars in view. |
| Scoring, modes, races, abilities, profile, records, XP | Plain C++ classes (no engine types) wrapped by a `UOCGameMode` and `UOCPlayerState`; abilities through the Gameplay Ability System (GAS) | Keep the exploit rules exactly. Saves move to `USaveGame` with the same v1 fields and migration. |
| Autopilot | Same C++ core; used by the attract mode and the automation tests | |
| `Environment.ts` weather state machine | Our table and easing drive UE's Sky Atmosphere, Volumetric Clouds, Exponential Height Fog and a wetness material parameter | The sky itself is rebuilt (below). |
| Procedural generators worth keeping as generators | Geometry Script (Blueprint or Python) in the editor: road chunks from the cross-section rules, the car bodies from `car-shape.ts` parameters, sign faces from the destination text | Run once at import and baked to static meshes, not at runtime. |
| People parameters (`params.ts`) | The `BodyShape`, `FaceShape`, `Look`, garment and preset tables become a Data Table that drives MetaHuman (or our own) character assembly | The values and the 16 presets carry over; the mesh generation does not (see rebuild). |

### 2.3 Rebuild with Unreal's systems

| Component | Replaced by | What carries over |
| --- | --- | --- |
| three.js rendering, shaders, post (bloom, GTAO), quality presets | Lumen, Nanite, Virtual Shadow Maps, TSR, the post-process volume; Scalability groups instead of our four presets | The look targets: golden hour on the 405, clearcoat paint, carbon weave, leather; the honesty about what each tier is. |
| Procedural canvas textures | Material graphs (Substance-style noise, parameters) or baked textures made in Blender/Substance; Quixel Megascans is allowed for surfaces (rock, concrete, asphalt) but not for anything that would copy a real car or venue | Palettes and dimensions. The "made in code" rule needs a decision (§7). |
| Car bodies and cockpit | Modelled meshes (Blender or Unreal's modelling tools), Nanite, car paint material with flake and clearcoat; the interior with a Control Rig steering wheel | Our own designs: GT, Brio, Corsa, Vela E proportions from `car-shape.ts`; the cockpit layout from `Cockpit.ts`; the "R" badge. |
| Hands and arms | A skeletal hand rig (MetaHuman hands or a custom rig) with IK to the rim via Control Rig | `GRIP` angles, `rimAt()` as a spline on the wheel, nail options, the watch/ring/gloves per look, the three ability poses. |
| People (NPCs and the player on foot) | MetaHumans (faces, bodies, grooms, facial rig) assembled from our parameter tables, or a custom modular character | The body-diversity brief, the 16 presets, the expressions and visemes list, the respectful-framing rules, "no real likeness". |
| Procedural animation | Animation Blueprints with state machines, additive breathing/weight-shift, Control Rig for look-at and hand IK; facial animation through the MetaHuman rig's curves | The behaviours: idle, talk, walk, sit, laugh, turn, aim; the viseme set. |
| Terrain | A Landscape imported from a heightmap we bake (our grid plus the road pull, so embankments survive), World Partition, Landscape grass and foliage | Heights and the embankment rule. |
| Roads | Static meshes generated at import (Geometry Script or PCG) from the network, with collision from the barrier segments; Nanite; HLODs | The cross-section (3.66 m lanes, shoulders, 0.35 m to the barrier face), paint rules, gantries 800 m and 260 m before exits, deck undersides and columns. |
| Scenery and vegetation | PCG framework with Megascans or our own foliage; placement rule "never on a road, never in a footprint" | The placement rules; the Irvine plant mix. |
| Sky, sun, weather | Sky Atmosphere, Volumetric Clouds, Sun Position plugin or our formula, Exponential Height Fog, Niagara rain | The weather table, the real sun. |
| Audio | MetaSounds (it can synthesise: oscillators, noise, filters), Audio Modulation, Submixes for the muffle | The engine design (V8, four pulses per rev, intake, pops, limiter), the radio's chords, tempos and styles. The station names. |
| UI | UMG with Common UI (gamepad, touch), one Material-based style; the Chrome noir tokens become a UMG style set | Screens, copy, honesty labels, touch targets, the design direction. |
| Input | Enhanced Input (keyboard, gamepad, touch, mouse) | The action list and the smoothing rule (a tap is a nudge, a hold is full lock). |
| Saves | `USaveGame` slots, local; cloud saves only if a backend exists (none does) | The v1 fields and migration. |
| Build and delivery | Packaged Windows build (later Mac/Linux, consoles need Epic's console access); no browser target (Pixel Streaming needs GPU servers) | The single link goes away for the UE build; the web game keeps it. |
| Tests | Unreal Automation (functional tests, Gauntlet) and a headless `-nullrhi` mode for logic tests | The 50 checks as specs. |

---

## 3. Rhys as a UE5 character

### 3.1 What "Rhys" is today, and what it must mean

There is no Rhys in the code, docs or data. The player character is defined by data, not by a name:

```
archetype      closer | ace | wrench          (title, blurb, ability, hand pose)
presentation   m | f                          (scale 0.9 for f; ring/bracelet rules)
skin           0..4                           (SKINS: 0xf1c6a5, 0xd9a37f, 0xb67a52, 0x8a5536, 0x5c3a24)
look           sleeve | gloves | watch | ring | bracelet | nails (painted on f in the preview)
profile        username (default "Driver"), avatar, level, XP, credits, stats, achievements, cars
on foot        a Person from the people builder in that look (planned; the builder exists)
```

So **Rhys is one row of that data plus a name**, unless the owner has a character in mind from outside this project.
To preserve "his established appearance, personality, animations and gameplay functionality" there has to be an
established version to preserve. The recommended step before Phase 1: the owner fills in this sheet (or confirms one
of the three archetypes as Rhys), and it goes into the repo as `PROJECT_OC_CHARACTERS.md`:

| Field | Options the project already supports | Rhys |
| --- | --- | --- |
| Archetype and ability | The Closer / Clear Path; The Ace / Focus Time; The Wrench / Locked In | ? |
| Presentation | m / f | ? |
| Skin tone | SKINS 0–4 | ? |
| Cosmetics | sleeve colour or rolled; gloves; gold, steel or smart watch; ring; bracelet; painted nails | ? |
| Body (on foot) | any `BodyShape` preset or values (height, fat, muscle, shoulders, posture, age…) | ? |
| Face and hair | `FaceShape` values; hair style (9), colour, grey, facial hair, glasses | ? |
| Clothes (on foot) | 19 garment kinds, 7 fabrics, colours | ? |
| Voice | none (text captions only, by rule) | text only |
| Lines | the friendly, respectful style of the on-foot plan; no real people or businesses | ? |
| Name on screen | profile username (20 characters) | Rhys |

No real person's likeness, no real brand on the watch or clothes, adult, and the same care as every other body: those
rules apply to Rhys as to every NPC.

### 3.2 Appearance in UE5

- **One character, two situations.** In the car, the player sees their own arms and hands; on foot, a full body in
  third person and the arms again in first person. In UE5 that is one `AOCCharacter` (a `ACharacter` subclass) whose
  skeletal mesh is a full body; the vehicle camera is placed at the eye socket and the body is rendered with the
  cockpit (so the knees in black shorts and white sneakers from `Cockpit.ts` come for free, and the arms are the
  same arms you see on foot).
- **Mesh.** Recommended: a MetaHuman generated from Rhys's sheet (body type from `BodyShape`, face sculpt from
  `FaceShape`, skin from the SKINS tone, groom from the hair style). MetaHumans give a facial rig, LODs and grooms
  that would take months to rebuild. Alternative that keeps the "made in code" rule: port the people builder's SDF
  generator to Geometry Script and generate the mesh in the editor; this is a research project of its own and is not
  recommended for Phase 1–3. Either way the mesh is our own and not a scan of anyone.
- **Cosmetics as components.** Sleeves, gloves, watch, ring, bracelet and nails are `UStaticMeshComponent`s or
  material parameters attached to hand sockets, chosen by the same `DriverLook` logic (`lookFor()` ported). The watch
  is our own unbranded design (gold, steel or smart), the dial text "ROSSINI" as in the preview.
- **Materials.** Skin from the MetaHuman skin material with our tone as the base colour; nails with a clearcoat
  painted-polish option (`nails: hex | null`); leather gloves with knuckle holes; shirt cuff weave. The preview's
  measured hand sizes (182.6 mm / 167.7 mm) set the skeletal scale check.

### 3.3 Personality

Personality lives in data and in behaviour, both portable:

- **Identity Data Asset** (`UOCDriverDefinition`): id, name ("Rhys"), title, blurb, ability, look. The three
  archetypes' blurbs are the existing voice: short, confident, no swagger.
- **Lines** (`UDataTable`): the on-foot lines tagged by time of day, weather and player state, as planned; the four
  conversation options (Talk, Compliment, Ask about the area, Invite to hang out) with several answers each; NPCs
  can decline. Captions only, never voiced, by the project's rule.
- **Signature behaviours**: the ability's hand pose (the watch check for Clear Path, the wave for Focus Time, a hand on
  the knee for Locked In) as Animation Montages; the idle weight shift and talking gestures from `anim.ts` as additive
  animations with per-character timing offsets so no two people move in step.
- **Expressions**: neutral, smile, laugh, playful (a wink with a half smile), talking, listen, surprised, as Pose
  Assets on the facial rig; visemes AA, EE, OO, MM, FF driven by a curve timed to the caption's length (`say(line,
  seconds)` ported).

### 3.4 Animations

| Today (procedural) | UE5 |
| --- | --- |
| Hands follow the wheel; arms reach (two-bone) from the shoulders | Control Rig: two-bone IK from shoulder sockets to two rim targets that rotate with the wheel; targets from `rimAt(148°)` and `rimAt(32°)` |
| `setPose(on)`: watch / wave / knee for the ability | Three montages with upper-body blend; triggered by the ability's activation event |
| Head sway from body accelerations; Ultra Realism shake | Camera Modifier reading the vehicle's `ax`, `ay`; shake as a Camera Shake asset gated by reduced-motion |
| Idle breathing and weight shift; talk gestures; walk; sit; laugh; turn; head and eye aim | Animation Blueprint state machine (Idle, Talk, Walk, Sit, Laugh, Turn) with additive breathing; Control Rig look-at for head and eyes; a walk cycle either hand-animated or from Epic's free animation packs (licensed for UE use) |
| Blinks, lids over the iris, visemes | MetaHuman facial rig curves |
| Seamless glide from third person to the face-to-face shot (about 1 s, eased; position, look target, FOV and depth of field together) | One `ACameraActor` driven by a Timeline: a Hermite curve for position, interpolated look target, FOV lerp, and a post-process DoF ramp (focal distance and f-stop) on the same curve; `SetViewTargetWithBlend` is the fallback. Reduced motion: a 0.3 s crossfade |

### 3.5 Gameplay functionality

- **Abilities through GAS.** One `UGameplayAbility` per ability with the existing numbers as a Data Asset
  (duration, cooldown):
  - Clear Path: a Gameplay Effect that sets the traffic subsystem's spawn scale to 0.65, calls `thin()` (out of view
    only) and `makeWay()` (gap-checked), for 8 s; cooldown 45 s. The verified rule "nothing in view vanishes" stays
    as an automation test.
  - Focus Time: global time dilation 0.7 with the player car and camera at `CustomTimeDilation = 1/0.7` so the car is
    unaffected, for 5 s; cooldown 40 s. Traffic, its lights and sounds slow, as now.
  - Locked In: a grip multiplier attribute ×1.3 on the vehicle component for 7 s; cooldown 35 s.
  - HUD: the round button with the cooldown ring (`coolFrac`), the F key / gamepad face button.
- **Driving.** The ported vehicle component, car choice via `applyCar()`, auto/manual, the handling slider.
- **Progression.** The profile as `UOCPlayerState` + `USaveGame`: XP, level, credits, achievements, garage. Credits
  are earned only; no store, no purchases, nothing real.
- **On foot.** A walking mode on the same character: capsule movement from `UCharacterMovementComponent` with the
  on-foot plan's numbers (0.3 m radius, 0.18 m step, no jump), "Get in" at the car, tap-to-go via UE's NavMesh (the
  plan's A* grid is not needed in UE), the conversation menu, the "Simulated crowd" label and the data credit.
- **Cameras.** The six views with the exact offsets in §1.5, as Spring Arm and Camera components plus the corner sky
  camera as a `USceneCaptureComponent2D` to a render target (150 m up, looking down).

### 3.6 Two bodies, one character

In the car the game today shows only arms and legs; the preview adds anatomical hands. In UE5 the full body sits in
the seat, so the first-person view is the real body's arms. That removes a whole class of seams (the hands look the
same in and out of the car, the sleeves and watch are the same assets) and is how modern driving games with on-foot
sections do it. The cost is a seated pose and a steering Control Rig that holds up at the eye's distance (40–70 cm),
which is where the preview's hand work earns its keep as the reference for scale, grip and nails.

### 3.7 Coordinate mapping (so nothing is re-measured)

Project OC is right-handed, metres, **x east, y up, z south**; the car faces −z with x to the driver's right. Unreal is
left-handed, centimetres, **X forward/north, Y right/east, Z up**. One formula converts both the world and the car
frame:

```
X_ue = -z * 100        Y_ue = x * 100        Z_ue = y * 100
yaw_ue (degrees) = 180 - h * 180/pi          (h: the network's heading, tangent (sin h, cos h))
```

| Point | Project OC (m) | UE5 (cm, car frame) |
| --- | --- | --- |
| Driver's eye `EYE` | (−0.37, 1.16, 0.10) | (X −10, Y −37, Z 116) |
| Wheel hub `WHEEL_AT` | (−0.37, 0.80, −0.42) | (X 42, Y −37, Z 80); the face leans back toward the driver by 21.8° |
| Left shoulder (GRIP) | (−0.60, 0.88, 0.24) | (X −24, Y −60, Z 88) |
| Right shoulder (GRIP) | (−0.14, 0.88, 0.24) | (X −24, Y −14, Z 88) |
| Hood camera | (0, 1.00, −1.45), pitch −0.04 rad | (X 145, Y 0, Z 100), pitch −2.3° |
| Look-back camera | (0, 1.15, 2.60) | (X −260, Y 0, Z 115), yaw 180° |
| Chase (landscape) | 6.6 m back, 2.25 m up, look 3.5 m ahead + 0.9 m up | arm −660, Z +225, target (X 350, Z 90) |

World positions use the same formula with the network's metres, and UE5's doubles hold OC's 60 km without the
1.5 km re-centring.

---

## 4. Phased plan

Each phase ends with something runnable and a written, verified result in `PROJECT_OC_PROGRESS.md`. The current
project is never modified by any phase; the UE work lives in its own repository (Unreal projects are gigabytes of
binary `.uasset` files; they do not belong in this repo next to a GitHub Pages site).

### Phase 0: the spec pack and the engine-free core (2–3 weeks, can be done in this cloud session)

No Unreal needed. Everything here is testable in this container.

1. **Character sheet.** `PROJECT_OC_CHARACTERS.md` with Rhys filled in (§3.1) and the three archetypes.
2. **OC core library in plain C++17** (`oc-core/`): the vehicle model, the road network (decode, splines, grid,
   barriers, routing), traffic (IDM, lane changes, spawning), scoring, abilities, profile/XP, sun position, autopilot.
   No engine types. **Golden tests:** the TypeScript game records traces (inputs and state per 120 Hz step, for the
   suite's seeded drives) through `window.__game`; the C++ core must reproduce them to a tolerance. This is how
   "preserve everything" is proven rather than hoped.
3. **Exporters** (Python, in `tools/ue/`): the network as UE-frame spline CSV/JSON with per-path cross-section,
   junction lists, sign text, overpasses; barrier segments as a collision list; a 16-bit heightmap PNG of our terrain
   with the road pull baked in (2 m for the prototype stretch, 4–8 m county-wide); the Anaheim slice as footprints
   and streets in the UE frame.
4. **Acceptance list:** the 50 checks rewritten as engine-neutral specs with their expected numbers.
5. **Art brief:** per car and the cockpit, the dimensions and reference renders from the preview; the Lot 57 site
   plan; the Chrome noir style tokens.

Deliverable: a repo `oc-core` with passing golden tests, the exporters and their outputs, the docs. Nothing in
`top-speed-ultra/` changes except docs (and, if the owner agrees, a small read-only trace hook on `window.__game`).

### Phase 1: a small playable prototype (4–8 weeks, one engineer, *estimate*)

Scope, deliberately small:

- UE 5.6 or newer, C++ project, Windows target. The `oc-core` library linked in as a plugin.
- **One stretch:** the I-405 North from Jamboree Road to the CA-55 interchange, the same stretch as the preview
  (`spec.ts` STRETCH), with its ramps, the four real exit signs and the real overpasses. Roads generated at import
  from the exported data, Nanite static meshes, barrier collision from the exported segments, Landscape from the
  baked heightmap, Megascans or simple materials for concrete and asphalt, PCG palms and shrubs clear of the road.
- **One car:** the Rossini GT, a first modelled body and cockpit from the preview's dimensions, car paint with
  clearcoat, the ported physics, auto gearbox.
- **The driver:** Rhys as a MetaHuman (or a placeholder mannequin if the sheet is not ready), seated, hands on the
  wheel through Control Rig, the cockpit camera at `EYE`, the hood and chase cameras.
- **Traffic:** the ported subsystem with three vehicle classes (sedan, SUV, semi), Moderate density, seeded.
- **Speed Survival** scoring with the exploit rules, a HUD (speed, gear, streak, score) and a results screen with the
  "Local leaderboard · this device only" label. No menus beyond start and results.
- **Sky:** Sky Atmosphere with the real sun at golden hour; one weather (clear).
- **Tests:** the Survival group and one interchange (405 N to 55 N) as Automation tests running the autopilot.

**Gate to Phase 2** (measured, not felt): 60 fps at 1080p on an RTX 3060-class GPU on Epic's "High" scalability;
the GT's 0–60 and top speed within 2% of the web game; the seeded 45 s Survival run scores within 5% of the web
game's 16,244; a side-by-side video of the stretch in both builds that the owner judges worth two codebases.

### Phase 2: the whole county, the game (3–5 months, *estimate*)

- All 20 carriageways and 1,247 ramps through World Partition and HLODs; navigation and prompts; all 12 starts.
- All four cars (bodies, cockpits with per-car wheels and dashes as in the preview's `THEMES`), the garage, credits,
  profile and saves, achievements, levels.
- Races with the three rivals, Time Trial, Free Drive; the five densities and Expert's aggressive share.
- Weather and time: the six weathers from the table, rain (Niagara, wet roads, grip 0.8), night with headlights and
  lamps, live sun.
- Abilities through GAS with the three hand montages; Ultra Realism (tunnel vision, shake, muffle).
- Audio in MetaSounds: the V8, wind, tyres, the three stations, the idents.
- The full UI in UMG/Common UI in the Chrome noir style, gamepad and keyboard, and the corner map/sky window.
- The regression groups ported: boot, interchanges, survival, race, abilities, progression, render.

### Phase 3: on foot at Lot 57 (3–4 months, *estimate*)

- The Anaheim slice imported: streets, kerbs, sidewalks, crosswalks, signals, real street-name signs, building
  footprints extruded with believable facades, the venue on its real lot with our own sign and layout.
- Getting out of the car at the lot and back in; the GTA-style follow camera; the seamless glide into the
  conversation shot and back; the four options; the lines; "Simulated crowd" and the credit on screen.
- NPCs as MetaHumans assembled from the people builder's parameter tables: the full body range from the 16 presets
  and continuous values, night-out clothes, hair grooms, expressions and visemes, idle/talk/walk/sit groups; crowd
  sizes by time and day as the on-foot plan simulates them. Adults only, respectful framing, no real likeness.
- The player's own body (Rhys) walking, sitting, ordering (free, fictional, alcohol-free), joining a group.

### Phase 4: platforms (2–3 months each, *estimate*, optional)

- **Mac/Linux desktop** builds from the same project.
- **Consoles** need Epic's platform access and a publisher or dev-kit agreement; not a solo-developer step.
- **Phones:** possible with the mobile renderer and heavy scaling (no Lumen on most devices, MetaHuman LODs, 30 fps
  targets), app-store accounts and review, 1–2 GB downloads. The recommendation stands: **the web game is the phone
  product**; a UE phone build only if the desktop game earns it.

Throughout: the web game keeps shipping. Features that both builds need (new counties, new lines, new cars) are
specified once in the data and docs and built twice; that is the real cost of the second build, and the reason to
gate it on Phase 1.

---

## 5. Hardware and cloud requirements

### 5.1 What this cloud session can and cannot do

- **Cannot:** install or run Unreal Engine (no GPU, no Windows, a Linux container with 4 CPUs and limited disk), open
  `.uasset` files, build or package a UE project, run MetaHuman Creator, measure any frame rate.
- **Can:** all of Phase 0 (C++ core with golden tests compiled with g++, the Python exporters, the docs, the character
  sheet), write C++ source and editor Python scripts for the UE project (unbuilt until someone opens them on a UE
  machine), review screenshots and logs the owner sends back, and keep the web game going in parallel.

### 5.2 A development workstation (one is required from Phase 1)

| Part | Minimum | Recommended | Why |
| --- | --- | --- | --- |
| OS | Windows 10/11 64-bit | Windows 11 | Primary UE platform; MetaHuman and most plugins first on Windows. macOS (Apple Silicon M2 Pro or better) works for development but lags on Lumen/Nanite features and cannot make Windows builds. |
| CPU | 8 cores (Ryzen 7 / Core i7) | 12–16 cores (Ryzen 9 / Core i9) | Shader compilation, Nanite builds, lighting, packaging are CPU-bound and take tens of minutes on 8 cores. |
| RAM | 32 GB | 64 GB | World Partition with the whole county, MetaHumans and the editor together exceed 32 GB. |
| GPU | NVIDIA RTX 3060 12 GB | RTX 4070 Super / 4080 (12–16 GB VRAM) | Lumen, Nanite and Virtual Shadow Maps at 1080p–1440p; 4K needs 16 GB+. AMD RX 7800 XT works; NVIDIA has the smoother tooling. |
| Storage | 1 TB NVMe | 2 TB NVMe | UE 5.x install 60–100 GB; the project with derived-data cache 50–300 GB; Megascans and MetaHumans add tens of GB. |
| Display | 1080p | 1440p or 4K | To judge the "4K hyper-realistic" tier honestly. |
| Approximate cost | $1,500–1,800 | $2,500–3,500 | Prices move; check at purchase. |

Also needed: an Epic Games account (UE is free to use; a 5% royalty applies to game revenue above $1 million lifetime
per product, under Epic's current EULA; check the terms), Visual Studio 2022 with the C++ game workload, and Git with
LFS or Perforce (Helix Core is free for up to 5 users) for the UE project's binaries.

### 5.3 Cloud alternatives (if there is no workstation)

| Option | What it is | Approximate cost | Fit |
| --- | --- | --- | --- |
| AWS g4dn.xlarge (T4, 16 GB, 4 vCPU) | A Windows GPU VM you remote into | about $0.55/h + Windows licence + storage (500 GB gp3 about $40/month) | Enough for Phase 1 at 1080p; slow shader compiles. |
| AWS g5.2xlarge (A10G 24 GB, 8 vCPU, 32 GB) | Same, stronger | about $1.25/h | Phases 1–3. Stop it when idle: 40 h/week is about $200/month. |
| Azure NV-series / Google G2 (L4) | Equivalents | about $0.80–1.50/h | Same. |
| Shadow / Paperspace style cloud PCs | Managed gaming or creator PCs with a desktop GPU | about $30–100/month for part-time use | Easiest start; check GPU class and storage limits. |
| Parsec or Moonlight | Remote desktop with low latency | free or cheap | Needed on any of the above to see the editor at a usable frame rate. |

Egress: downloading builds from a cloud VM costs per GB (about $0.09/GB on AWS); a 5 GB build is cents, a daily
habit of it adds up.

### 5.4 If the UE build must be played in a browser

Unreal has no shipping web target. **Pixel Streaming** renders on a GPU server and streams video: roughly one GPU
per one or two concurrent players (a g4dn.xlarge at about $0.55/h per player, so an always-on seat is about
$400/month), plus a signalling server and TURN for phones behind NAT. Good for a demo link to show investors or a
publisher; not a way to serve players at scale. The web game remains the way to share a link.

### 5.5 Build and test infrastructure

- GitHub Actions cannot build UE on its hosted runners (no Windows GPU, 100 GB+ of engine). A self-hosted runner on
  the workstation or the cloud VM can run Automation tests nightly (`-nullrhi` for logic tests, a real GPU for render
  tests).
- Automated screenshots and the "never invent results" rule carry over: Automation test reports and screenshot
  comparisons are logged in `PROJECT_OC_PROGRESS.md` as now.

### 5.6 Licences and rules to carry into Unreal

- **OpenStreetMap / Overture (ODbL):** the credit on screen stays ("Freeway geometry: Overture Maps Foundation, derived
  from OpenStreetMap contributors (ODbL)"), and the derived data files stay public as they are now in this repo.
- **Our own brands only:** no real car, watch or venue names or designs; Megascans surfaces are fine, licensed vehicle
  models of real cars are not.
- **MetaHuman:** free with Unreal; check the current MetaHuman licence terms before using them outside Unreal (Epic
  broadened them in 2025). No scans of real people.
- **Epic's free animation and content packs:** licensed for use in Unreal projects; check each pack's terms.
- **No real money, no live data claims, simulated crowds labelled:** unchanged.
- **Fonts:** Google Fonts used by the Chrome noir design are open licences; bundle the files in the UE project.

---

## 6. Honest trade-offs

| | Web game (today) | UE5 build |
| --- | --- | --- |
| Reach | One link, any phone or laptop, 3 MB, no install | Windows download of 2–6 GB; phones only with a separate effort |
| Graphics ceiling | "Next" tier at best: real geometry, procedural materials, no photoreal people | Photoreal roads, cars and people are reachable with Lumen, Nanite, MetaHumans and licensed surfaces |
| Cost of a feature | Built once, in TypeScript, tested in 10 minutes headless | Built once in the data/docs, twice in code; tests need a GPU machine |
| Team | One developer or agent, this repo | At least one UE engineer plus art time (modelling cars and the venue, animation); a workstation or cloud GPU |
| What is kept | Everything | Data, numbers, algorithms (ported and proven), design, identity; not the rendering, assets, UI, audio |
| Risk | Phone performance is still unmeasured | Scope creep; two codebases drifting; art cost; no browser link |

---

## 7. Open decisions for the owner

1. **Who is Rhys?** One of the three archetypes, or a new sheet (§3.1). Phase 1 can use a placeholder, but
   "preserving his established appearance" needs the sheet first.
2. **The "made in code" rule.** Unreal's strengths are MetaHumans, Megascans and modelled assets. Keep "our own
   designs, no real likeness, no real brands" and drop "no downloaded models or textures" for the UE build?
3. **Two products or one.** The recommendation is web for phones, UE for desktop. If the owner wants a single UE
   product on every platform, the phone work in Phase 4 moves up and the gate in Phase 1 should include a mid-range
   Android device.
4. **Where it lives.** A new repository for the UE project (recommended), with `oc-core` as a shared library used by
   both; this repo's game stays as it is.
5. **Budget.** A workstation (about $2,500) or a cloud GPU (about $200–400/month part-time), and the engineer's time
   (Phases 0–3 total 7–12 months for one person, *estimate*).

## 8. Before proceeding: checklist

- [ ] Rhys's character sheet written and approved.
- [ ] The rule change in §7.2 decided.
- [ ] A UE-capable machine chosen (workstation or cloud) and an Epic account created.
- [ ] Phase 0 started here: `oc-core` golden tests against the web game's traces; exporters; the acceptance list.
- [ ] Phase 1 scope confirmed as written (one stretch, one car, Rhys seated, traffic, Survival scoring, one weather).
- [ ] The web game continues on its own track (NPC realism, Chrome noir UI, cars from every camera).
