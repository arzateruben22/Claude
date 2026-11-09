# Project OC: the OC Hypercar (Founder Edition)

Written 2026-10-16 on branch `claude/hypercar`, for the owner's directive "OC Hypercar — Prototype 01" and the three
follow-ups recorded in `PROJECT_OC_MASTER_PROMPT.md` (Added 2026-10-16, evening). This is the plan, the dimension
sheet, the performance and ability design, and the milestones. **No code was changed in this step.**

The car will be a **procedural model built in code**, like the four garage cars: one parametric body shaped by
numbers. It is not a finished 3D asset, not a scan and not a downloaded model. Every doc, garage card and report must
say so.

What was measured for this document (every number below comes from one of these; nothing is estimated without
saying so):

- **The reference sheet.** The owner's `scratchpad/ref/hypercar-reference.png` (1774 × 887). Its panels were found by
  their frame lines and cropped with Pillow:
  - FRONT: x 12–421, y 467–701
  - REAR: 430–832
  - SIDE: 841–1468
  - TOP: 1477–1772 × 467–885
  - the four detail panels along y 709–885

  Positions were read from 5× grids and brightness profiles, then drawn back onto the panels to check them
  (`measure-side.png`, `measure-front.png`, `measure-rear.png`, `silhouette-top.png` in the session scratchpad).
- **The game's own physics in a scratch harness.**
  - `Physics.ts` and `cars.ts` are bundled with esbuild. `CarPhysics.step` runs at 120 Hz on a mock straight,
    flat, wall-less road.
  - A patched scratch copy adds three knobs, which is how the proposed terms were tested: a brake gain, fan
    suction and a body thrust force.
  - With the knobs at their defaults, the copy reproduces the unpatched physics exactly, for all four cars and on
    every metric. That run is the control.
  - For today's cars the harness also reproduces `figures()`: the same top speeds and the same 0-60 times within
    0.02 s.
- **The real mainline curvature.** The game's `Network` and `Path` were built from `src/data/oc-network.json`:
  20 carriageways, 746 km, curvature smoothed over 60 m.
- **Two renders of the Rossini Corsa** from `src/preview/test-car.ts` at 960 × 540 (§10):
  - `tests/out/preview/hyper-plan-corsa-high-side.png`
  - `tests/out/preview/hyper-plan-corsa-phone-side.png`

---

## 1. What the project is, and what the hypercar reuses

OC Ultra is a phone-first, first-person driving game on Orange County's real freeways:

- **Stack.** three.js 0.160, strict TypeScript and React. One self-contained HTML file
  (`dist/top-speed-ultra.html`, republished as `dist/artifact.html`).
- **No downloaded assets.** Every mesh and texture is generated in code at load time.
- **The road network.** It comes from OpenStreetMap via Overture Maps (ODbL).
- **The loop.** A fixed 120 Hz simulation (`Game.ts`), streamed roads and terrain, IDM traffic, four modes:
  - Free Drive (`Mode` `'free'`)
  - Speed Survival (`'survival'`)
  - Races (`'race'`)
  - Time Trial (`'time'`)

How a car is made today, and what the hypercar reuses:

| Part | Where | What the hypercar takes from it |
| --- | --- | --- |
| One parametric body | `src/preview/car-body.ts` (`bodyFor(id)`, `buildBody`, `buildExtras`) | The loft: superellipse sections along z from five keyed curves (plan half-width `WP`, fender crest `FH`, deck centre `CC`, roof `RH`, canopy half-width `GB`), arches cut at the axles, the nose and tail rounding and chin tuck, the side scallop, glass with a frit border, shut lines drawn by the paint shader, splitter, canards, corner intakes, diffuser with strakes, the wing on swan-neck mounts (Corsa), roof scoop, bonnet and fender vents, mirrors, badges. New: nose and tail styles `'hyper'`, head style `'blade'`, LED strips, bonnet vent pair, rear fins, a plate. |
| The numbers per car | `src/preview/car-shape.ts` (`ShapeParams`, `CarId`, `CAR_IDS`, `SHAPES`, `liftNose`) | A new `ShapeParams` record `oc-hyper` (draft in §4.2). |
| Wheels | `src/preview/car-wheel.ts` (`addWheel`, styles `twin5` / `five` / `cl10` / `aero`) | Tyre section, discs, calipers, hub. New style `multi` (drafted as `split10`; built in M1 as five spokes that each fork in two toward the rim, ten prongs at the rim, from the WHEEL DETAIL panel), gloss black, OC centre cap. |
| Materials | `src/preview/car-mats.ts` (`paint` with flake and clear coat, `carbon` 2×2 twill with anisotropy, `emissive`, `honeycomb`, `glass`, `caliper`) | All of them. New: an ice-blue LED material and a red bar material (emissive, so the bloom pass on High and Ultra picks them up), and a light-silver paint (planned at a higher metalness; built after the M1 review as 0xc8d3e8 at metalness 0.3, so a warm sky doesn't turn it bronze and the faces away from the sun still read light). |
| Reflections | `src/preview/car-probe.ts` (the car's reflection probe: the real road, walls and sky round the car) | As is: this is what puts the freeway in the silver paint. |
| Cockpits | `src/preview/cockpit.ts` (interiors `gt` / `brio` / `corsa` / `vela`) | The Corsa's carbon buckets, harnesses and roll hoop, and the Vela's display binnacle, combined as a new interior `'hyper'` with a Cold Thrust pressure gauge. |
| The player's car | `src/game/vehicle/PlayerCar.ts` | Spinning and steering wheels in their own groups; the sprung body (pitch, roll, heave, buzz); two headlight spot beams and the painted beam pool laid on the road's profile; the tail material brightening on the brakes (1.6 → 5); the eye, hood and rear camera anchors; the sun-flare occluder. |
| Stats and showroom numbers | `src/game/cars.ts` (`CarDef`, `CARS`, `applyCar`, `figures`) | `applyCar()` writes mass, power, torque, redline, CdA, ClA and final drive into the physics `SPEC`, and returns the grip multiplier. New: a tune argument (§5.4). |
| Physics | `src/game/vehicle/Physics.ts` | The whole model, plus parameter fields and, in M5, two force terms and an airborne state (§9). It is a single-track (bicycle) model at 120 Hz with load transfer, `tanh` tyres, a friction circle at the driven rear axle, ABS, a 7-speed dual-clutch with automatic, drag and downforce per car (CdA, ClA), the handling slider (0 arcade to 1 simulation) and stability control. |
| Abilities | `src/game/drivers.ts` (`Ability` with duration and cooldown), `Game.useAbility` | The pattern (an ability object updated in `simulate`, ended by `endAbility`). The hypercar's ability is the car's, separate from the driver's: the driver's Clear Path, Focus Time or Locked In stays as it is in every mode. |
| Garage, profile | `src/ui/App.tsx` (`GaragePanel`), `src/game/profile.ts` (`buy`, `sell`, `choose`, `slotsFor`) | The list, with the owner-mode filter and an entitlement in place of a credit price. |
| Branding | `src/ui/assets/oc-mask.png` (the wordmark's letterform alpha, already in the bundle), `src/ui/Mark.tsx` | The OC mark traced once to a vector outline (§4.1) for the nose badge, the plate and the wheel caps. |

The garage keeps four cars: the Rossini GT, the Brio, the Corsa and the OC Hypercar (the fourth). The Vela E stays in
`CARS` and `SHAPES` but is shown only when owner mode is on or the profile already owns it.

## 2. What code can reproduce, and what it can't

**What code reproduces well** (it's what the parametric body, the materials and the probe already do on the Corsa
and the Vela):

- The overall silhouette and proportions: the low, long body, the wheelbase, overhangs, fender crests, the
  teardrop canopy and the tail height.
- The light-silver metallic paint with flake under a clear coat, and real reflections of the freeway and sky from
  the reflection probe.
- Carbon parts in a real 2×2 twill under clear coat: splitter, side skirts, diffuser, wing, mirror housings.
- The deep splitter with a turned-up lip, the canards, the three-section front intake with vertical blades, the side
  scoop and the deep intake ahead of the rear wheel (with honeycomb and a dark plenum).
- The big wing on swan-neck mounts with end plates, the diffuser strakes.
- The ice-blue LED blades and strips and the full-width red bar, as emissive geometry that blooms on High and Ultra.
- Black multi-spoke wheels with blue calipers, the OC badge, plate and centre caps.
- The headlight beams on the road at night.

**What code can only approximate:**

- **Class-A surfacing.** The sheet's body is sculpted: crisp creases where two surfaces meet at an angle, the
  S-shaped door scoop with sharp edges, flying-buttress panels that stand over a cavity, small fins on the rear
  haunches, layered aero over the front wheel. Our body is one lofted skin of superellipse sections. It can blend,
  scallop and cut openings, but it can't undercut or overlap itself. Overlapping layers and fins have to be separate
  pieces (extrusions or small lofts) laid on the skin, and the sharpest creases come out softened.
- **Fine detail without baked maps.** Vent fins, mesh, bolt heads, panel gaps at the sheet's scale. A sculpted
  high-poly model with **baked normal and ambient-occlusion maps** is how production cars get this cheaply. We
  generate normal maps only for repeating surfaces (carbon, leather, honeycomb) and shade ambient occlusion by a
  position heuristic (`aoFor`).
- **The sheet's light.** A wet showroom floor at night with strip lights, and a film-like grade. The game lights
  the car with the sky, the sun or the street lamps of the freeway it's on.

**What would need external tools**, plainly:

- **A hand-modelled glTF from Blender.**
  - It would be closest to the sheet: subdivision surfacing for the creases, and normal and AO maps baked from a
    sculpt.
  - It breaks two house rules: static-first (everything built in code), and the single-file build's size (a car of
    this quality with its maps is roughly 5–15 MB, an estimate).
  - It needs a person modelling for days. This cloud session can't do that work well.
  - If the owner wants it, it's a separate decision and a separate asset pipeline.
- **The Unreal Engine 5 route** (`PROJECT_OC_UE5_MIGRATION.md`).
  - A modelled car in Unreal with Nanite geometry and ray-traced reflections looks like the hero shot.
  - It's a different engine, months of work (that document's Phases 1–2), and most of it is lost on phones.
  - The car parameters below carry over to it as data (§2.1–2.2 of that document: tuned constants as data, and the
    bodies from `car-shape.ts` as a generator baked at import).

The plan below builds the faithful-as-code version. Where the code falls short of the sheet, §3 and §4 say how far.

## 3. Dimension sheet (from the reference)

**Scale.** The SIDE panel is close to orthographic: the wheels are round, and no far-side wheel shows. The scale is
anchored on the tyres, as the brief asks: about 0.70 m outside diameter at the front and 0.74 m at the rear.

| Tyre | Top (y px) | Bottom, the floor (y px) | Diameter (px) | Anchor | Scale (mm/px) | Centre (x, y px) |
| --- | --- | --- | --- | --- | --- | --- |
| Front | 97 | 185.5 | 88 | 0.70 m | 7.955 | (123.5, 141) |
| Rear | 94 | 185.5 | 91.5 | 0.74 m | 8.087 | (498, 140.3) |

The mean scale is **8.02 mm/px**. The centres sit midway between the white sidewall-lettering arcs (front: 102 and
180.5; rear: 99.5 and 180.5) and agree with the hubs.

**Width.** The REAR panel has an independent anchor: the plate measures 91 × 20 px, an aspect of 4.55:1. A European
520 × 110 mm plate is 4.73:1, and a US plate is 2:1, so it's European-sized. 520 mm / 91 px = **5.71 mm/px** at the
tail.

All values in the car's frame:

| Dimension | Estimate | From | Uncertainty and notes |
| --- | --- | --- | --- |
| Overall length (splitter tip to tail) | **4.72 m** | SIDE: x 10 → 599, 589 px | ±0.12 m. Anchor ±3 %, ends ±2 px. 4.69 m at the front scale, 4.76 m at the rear scale |
| Wheelbase | **3.00 m** | SIDE: 374.5 px between hubs | ±0.10 m (2.98 / 3.03 m at the two scales) |
| Front overhang (axle to splitter tip) | **0.91 m** | 113.5 px | ±0.04 m. The nose face (headlamp tip) is 0.11 m behind the splitter tip |
| Rear overhang | **0.81 m** | 101 px | ±0.04 m |
| Body width | **2.02 m** | REAR: 354 px at the plate's 5.71 mm/px | ±0.08 m. Scales with the plate size if it isn't 520 mm |
| Roof height | **1.05 m** | SIDE: 130.5 px | ±0.04 m. The roof is flat at 1.02–1.04 m from about 1.2 to 1.65 m behind the front axle (silhouette trace) |
| Height with the roof scoop | 1.09 m | SIDE: y 49 | ±0.03 m |
| Front fender crest | 0.79 m | SIDE trace, over the front axle | ±0.02 m |
| Rear haunch crest | 0.85 m | SIDE: y 79 | ±0.03 m |
| Tail top / red bar | 0.73 m / 0.68 m | SIDE: y 95 / 101 | REAR says 0.58 m for the bar (see disagreements) |
| Cowl (windscreen base) | 0.75 m high, 0.37 m behind the front axle | SIDE trace | ±0.03 m |
| Windscreen header | about 1.00 m high, 1.0 m behind the front axle | SIDE | ±0.05 m |
| Ground clearance | splitter underside 0.06 m; side skirt 0.05–0.06 m; splitter LED line 0.076 m | SIDE: y 178.5 / 178–180 / 176 | ±0.02 m |
| Splitter reach ahead of the nose face | 0.11 m | SIDE: x 10 vs 24 | ±0.02 m |
| Splitter span | about 1.94 m | FRONT: 378 px, ÷ about 1.1 for perspective | ±0.08 m |
| Front track (tyre centres) | **1.72 m** | Body width at the axle less tyre width and arch clearance | ±0.06 m. The tyres aren't visible in FRONT or REAR |
| Rear track | **1.69 m** | As above | ±0.06 m |
| Tyres (outside diameter) | 0.70 m front, 0.74 m rear | The brief's anchor | The panel's own ratio is 91.5 / 88 = 1.04 (the anchor's is 1.057) |
| Rims | about 22 in | Lettering ring at mid-sidewall: 0.63 m front, 0.655 m rear; rim ≈ 2 × ring − OD = 0.556 / 0.57 m | ±1 in |
| Tyre widths | about 275 mm front, 345 mm rear | Not measurable; proportions of a car this size | Estimate |
| Wing span (end plate to end plate) | **1.71 m** | REAR: x 50 → 350, 300 px | ±0.10 m. The wing sits about as far from the camera as the rear fenders' widest point, so the plate's scale holds |
| Wing height | 1.07 m to the end plates' top; main plane about 0.89–1.05 m | SIDE: y 52; plane y 55–75 | REAR says 0.94 m (see disagreements) |
| Wing chord / end plates | main plane about 0.36 m; end plates about 0.55 m long × 0.25 m | SIDE: x 527–595 | ±0.05 m |
| Wing position | plane centre 0.50 m behind the rear axle; trailing edge 0.75 m behind it, about 0.06 m inside the tail | SIDE | ±0.05 m |
| Swan-neck mounts | ±0.42 m from the centreline | REAR: uprights at x ≈ 128 and 274 | ±0.04 m |
| Headlamp blades | from \|x\| 0.49 m (y ≈ 0.30) out to 0.94 m (y ≈ 0.48); 0.12–0.40 m behind the nose face | FRONT: (118,140) → (37,108); SIDE: 0.39–0.54 m high | Heights differ between FRONT and SIDE by 0.06–0.09 m |
| Front intake | ±0.59 m wide, 0.04–0.23 m high, vertical blades at about x = ±0.25 m and a centre fin | FRONT | ±0.03 m |
| Red light bar | about 1.66 m long (290 px) | REAR | ±0.06 m |
| Plate | 0.52 × 0.11 m, centred 0.46 m up | REAR | Assumed EU size |
| Door mirrors | on stalks about 0.85–0.95 m behind the front axle, mirror head about 0.85 m up, \|x\| 0.80–0.94 m | SIDE x 200–215; FRONT | ±0.05 m |

**Where the views disagree:**

1. **TOP vs SIDE.**
   - The TOP panel crops the nose at its top edge, so length can't be measured there.
   - Its greenhouse is a long dark canopy with a spine running back into the engine bay, and no separate wing is
     visible. The SIDE shows a silver roof, a short glass canopy, and a large wing on swan necks.
   - Its proportions do agree with the SIDE: rear overhang 80 px against a 200 px width is 0.81 m against 2.02 m.
2. **REAR heights vs SIDE heights.**
   - At the plate's scale, the REAR panel's heights come out 12–15 % lower: wing top 0.94 vs 1.07 m, red bar 0.58 vs
     0.68 m.
   - Ratios between heights agree (wing top over bar: 1.62 vs 1.57). That's a camera above the car looking down, or a
     plate larger than 520 mm.
3. **FRONT width vs height.**
   - At the front fenders, width over height is 2.06, which with the SIDE's 1.05 m would make the car 2.16 m wide.
   - The roof is further from that camera than the fenders, so perspective inflates the ratio. The plate's 2.02 m is
     used.
4. **The cabin.**
   - The FRONT panel shows two occupants about ±0.25 m from the centreline: a narrow, prototype-style cabin.
   - The game's driver sits at x = −0.37 m (`spec.ts` `EYE`), so the game's canopy can't be as narrow.
5. **The headlamp blades** sit 0.06–0.09 m lower in FRONT than in SIDE (perspective again).
6. **Proportions.**
   - A 3.0 m wheelbase with 0.70 m tyres and a 1.05 m roof is long and low, like an endurance prototype.
   - If the sheet's tyres were bigger (0.75 / 0.79 m, 22–23 in rims with taller sidewalls), everything scales up 7 %:
     5.05 m long, 3.21 m wheelbase, 1.12 m roof.
   - The brief's anchor is kept.

**What the game's shared frame forces** (honest gaps, decided in M1):

- **The roof.**
  - All five cars share one driver's frame: eye at (−0.37, 1.16, 0.10) m, wheel hub at (−0.37, 0.80, −0.42) m in
    `spec.ts`. The canopy is built round it.
  - That's why every car's roof peaks at 1.30–1.32 m (`RH` in `car-shape.ts`).
  - With that frame unchanged, the hypercar's roof can't come below about **1.25 m**, 19 % taller than the sheet. That
    loses most of the "extremely low" look.
  - **Recommended:** a per-car seat drop of **0.15 m** (eye at 1.01 m), for a roof of **1.12 m** (+0.07 m over the
    sheet).
  - The cockpit view also needs glass above the eye. The windscreen header is set 0.10 m above the eye 0.4 m ahead
    of it (about 14° up), which moves the canopy's peak about 0.2 m rearward of the sheet's.
  - The drop touches every user of the driver's frame: 57 references in 9 files besides `spec.ts` (`EYE`,
    `WHEEL_AT`, `rimAt`, `WHEEL_TILT`), including the hands. So it must leave the other four cars unchanged:
    renders of their seat, hood, chase and outside views before and after may differ by no more than two renders
    of the unchanged code differ from each other (render noise; §8, M1).
- **Canopy width.** The base half-width was first held at 0.72 m or more for the shared driver's frame. The M1 repair
  narrowed it to the sheet's teardrop (0.47 to 0.50 m, about half the body's width), so once the seat drops the
  canopy's flank is 0.06 m from an eye at x −0.37 m: the cockpit (M2) should seat this car's driver further in.
- **Physics wheelbase.** The physics keeps its 2.65 m (`SPEC.a + SPEC.b`); only the visual wheelbase is 3.0 m.
  - `L` is a module constant computed once in `Physics.ts`, so per-car centre-of-gravity positions belong to the
    dynamics session (§9).
  - The physics wheel radius stays 0.345 m, so the 0.36 m wheels turn 4 % faster than they roll. `PlayerCar` can
    scale the spin by 0.345 / r.

## 4. Visual features and where each goes in the code

| Feature (from the sheet) | Where it goes |
| --- | --- |
| Long, low, wide body: 4.72 × 2.02 m, 3.0 m wheelbase, 1.12 m roof (with the seat drop) | `car-shape.ts`: a new `ShapeParams` `oc-hyper` (§4.2); `CarId`/`CAR_IDS` gain `'oc-hyper'`; `brand` gains `'oc'` |
| Very low, wide, aggressive nose: sharp plan rounding, low chin, a central crease running up to a centre fin, two big louvred bonnet vents | `car-body.ts`: `noseStyle: 'hyper'` (crease and fin as a small loft on the deck centre); the bonnet vents reuse `topVent()` (today's engine-cover louvres) as a pair; `liftNose` amount 0.03 at most (the sheet's nose is about 0.40–0.45 m at the tip) |
| Deep carbon splitter with a turned-up lip and an ice-blue LED along its leading edge; large dive planes on the corners | `buildExtras`: the existing splitter (`splitter.w/d/proud`) and canards, larger; a new LED strip along the splitter's edge (`led` key) |
| Three-section lower intake with vertical carbon blades and a centre fin; corner openings under the lamps | `noseIntake`, `cornerIntake` (existing), strakes list for `'hyper'` (today the Corsa's `[-0.3, -0.11, 0.11, 0.3]`) |
| Ice-blue LED headlight blades: a thin bright line under a dark lens, sweeping up and out to the fender corner, with a small module at the outer end | New `headStyle: 'blade'`: a dark lens patch on the `head` quad and a thin emissive strip along its lower edge (`lampTex` gains a `'blade'` layout); `PlayerCar`'s two beams move to the blades' inner ends (today fixed at x ±0.62, y 0.55, z −2.2) |
| Metallic light silver with realistic reflections | `paint(0xbfc4cc, q, …, { metal: 0.8, rough: 0.22, flake: 0.2 })`: the sheet's paint reads #c3cadb–#cad2e3 as lit, the blue cast being the night scene's; the car probe reflects the real road and sky. **Built** (M1 repair): 0xc8d3e8 at metalness 0.3, roughness 0.27, flake 0.2; the planned 0.8 read bronze under the golden-hour test sky |
| Deep side intakes: a concave scoop down the door feeding a dark intake ahead of the rear wheel | `scallop` (deeper: 0.18 m, against the Corsa's 0.11) and `intake` (taller, further forward); a new optional `scallop.tilt` so the scoop's lower edge rises toward the rear as on the sheet |
| Carbon side skirts with an ice-blue LED strip along the sills | A carbon sill blade below `YSILL` (as the splitter lip is built) with an LED strip on its outer edge |
| Door mirrors on stalks, forward on the door | `mirrorParts()` (existing) at `mirrorAt`, carbon housings (today Corsa-only) |
| Roof scoop | `scoop: true` (existing, Corsa) |
| Sculpted rear haunches with fins | `FH`/`WP` give the haunches; a new `fins` list (two small vertical fins at the rear corners, extruded and rooted in the skin like the canards) |
| Large rear wing on swan necks, with end plates and an ice-blue LED edge | The existing wing (Corsa) with the sheet's numbers; larger end plates (new `wing.plate: [length, height]`); LED strips on the end plates' trailing edges and along the flap |
| Full-width red rear light bar | `tailStyle: 'hyper'`: one thin bar about 1.66 m long at the tail's top edge, in the `tail` material (it already brightens on the brakes in `PlayerCar.update`) |
| Carbon diffuser with tall strakes, mesh panels, an ice-blue accent along its edge and a lit centre element | `diffuser` (existing, 8 fins), `rearMesh` (existing), LED strip on the diffuser's outer edges; the centre element as a small ice-blue light (an accent, not a lamp: a blue rear-facing lamp isn't road-legal, and this one is decoration) |
| OC plate at the rear | `tailStyle: 'hyper'`: a 0.52 × 0.11 m plate, dark, with the OC mark |
| Black multi-spoke wheels (five spokes that fork near the rim, ten prongs at the rim), blue calipers, OC centre caps, white lettering on the tyres | `car-wheel.ts`: a new style `multi` (drafted as `split10`) built from the `twin5` path: five spokes, each a pair joined at the hub that parts toward the rim; `rimColor 0x101318` (sheet #121820), `caliper 0x1f4fd8` (sheet #083692 as lit); the cap draws the OC mark; tyre lettering is our own text ("OC ULTRA", the size) in a procedural sidewall texture (M2, optional) |
| OC branding: nose badge, plate, wheel centres | `badgeTex(256, 'oc')` and the plate's texture draw the OC mark from a traced vector (§4.1), so it works in the previews and the game without loading an image |
| Cockpit: carbon buckets, harnesses, a display in place of the tachometer, a pressure gauge, ice-blue ambient strip | `cockpit.ts`: interior `'hyper'` (Corsa buckets + Vela display binnacle; the tach dial in `car-gauges.ts` is fixed at 0–10,000 rpm, so the display is the right binnacle for an electric car) |
| Condensation jets (Cold Thrust), the fans' look | M5: sprites at two diffuser nozzles (§6.4) |

### 4.1 The OC mark on the car

`src/ui/assets/oc-mask.png` is already in the bundle for the UI (960 × 343, the letterform in its alpha). The car
builders run synchronously, and the preview pages are bundled without a PNG loader, so the car shouldn't load an
image.

M1 traces the mask's alpha once:

- **Tracing.** Pillow plus marching squares, simplified to about 60–120 points per contour (the O's outside and
  inside, and the C).
- **Storage.** The result is a small TS constant, `src/preview/oc-mark.ts`, in the mask's own 960 × 343 space.
- **Uses.** It's drawn into the badge, plate and cap canvases, and extruded 2 mm for the nose badge.

The mark is never stretched (the rule in `Mark.tsx`).

### 4.2 Draft `ShapeParams` for the new car

With the recommended 0.15 m seat drop (eye at y 1.01). Without it, raise `RH` by 0.13 m at the peak (1.25 m) and
`GB`, `WS`, `SG` with it.

New fields are marked `NEW`. Values come from §3. The car frame is x right, y up, the car facing −z, the origin on
the ground under the middle.

```ts
const HYPER: ShapeParams = {
  ...CORSA, id: 'oc-hyper', name: 'OC Hypercar', brand: 'oc', paint: 0xbfc4cc,     // brand 'oc': NEW value
  ZF: -2.43, ZR: 2.29, YSILL: 0.07,
  // 3.00 m wheelbase; 0.70 / 0.74 m tyres; tracks 1.72 / 1.69 m
  axle: { zF: -1.52, zR: 1.48, r: 0.35, rR: 0.37, trackF: 0.86, trackR: 0.845, wF: 0.275, wR: 0.345 },  // rR: NEW
  arch: [0.40, 0.42],
  WP: [[-2.43, 0.86], [-2.2, 0.95], [-1.9, 0.99], [-1.52, 1.0], [-1.1, 0.985], [-0.6, 0.965], [0.0, 0.96], [0.5, 0.98],
       [1.0, 1.01], [1.48, 1.02], [1.9, 1.01], [2.15, 0.98], [2.29, 0.93]],
  // the side panel's silhouette trace (front) and grid reads (rear)
  FH: [[-2.43, 0.40], [-2.27, 0.45], [-2.1, 0.55], [-1.9, 0.66], [-1.7, 0.75], [-1.52, 0.79], [-1.25, 0.77], [-0.9, 0.74],
       [-0.4, 0.72], [0.2, 0.76], [0.8, 0.82], [1.2, 0.85], [1.48, 0.86], [1.9, 0.84], [2.15, 0.80], [2.29, 0.74]],
  CC: [[-2.43, 0.36], [-2.25, 0.42], [-2.0, 0.52], [-1.75, 0.60], [-1.52, 0.65], [-1.15, 0.70], [-0.6, 0.76], [0.6, 0.92],
       [1.2, 0.88], [1.8, 0.80], [2.29, 0.72]],
  RH: [[-1.15, 0.75], [-0.9, 0.86], [-0.6, 0.97], [-0.4, 1.04], [-0.2, 1.09], [0.0, 1.115], [0.2, 1.12], [0.5, 1.10],
       [0.9, 1.03], [1.3, 0.96], [1.7, 0.90], [2.0, 0.86]],
  GB: [[-1.15, 0.74], [-0.5, 0.78], [0.1, 0.78], [0.6, 0.70], [1.2, 0.55], [1.8, 0.42], [2.0, 0.38]],
  ZC0: -1.15, ZC1: 2.0, DROP: 0.06, ROLL: 0.12, P: 4, K: 0.035,
  nose: { R: 0.30, p: 2.8, Ry: 0.08, tuck: 0.06, tuckY: 0.30 },
  tail: { R: 0.18, p: 2.7, Ry: 0.02, tuck: 0.10, tuckY: 0.55 },
  scallop: { depth: 0.18, z0: -0.85, z1: 0.60, e0: 0.80, e1: 0.98, yc: 0.42, h: 0.24, tilt: 0.12 },   // tilt: NEW
  WS: { zb: -1.15, zt: -0.30, xb: 0.70, xt: 0.52 },            // header 0.10 m above the eye, 0.4 m ahead of it
  SG: { fb: [-0.95, 0.80], rb: [0.45, 0.95], rt: [0.30, 1.08], ftZ: -0.28 },
  RG: { x0: 0.36, x1: 0.30, z0: 0.50, z1: 0.85 },
  roofGlass: null, carbonRoof: true,
  intake: { z0: 0.30, z1: 0.95, y0: 0.20, y1: 0.62 },
  louvre: { z0: 0.95, z1: 1.70, x: 0.42, n: 10 },
  door: [[-0.95, 0.16], [0.35, 0.16], [0.45, 0.80], [-0.90, 0.78]],
  frontLid: [[-0.50, -2.25], [0.50, -2.25], [0.55, -1.25], [-0.55, -1.25]],
  head: [[0.46, -2.30], [0.93, -2.12], [0.95, -2.02], [0.50, -2.22]], headStyle: 'blade',            // 'blade': NEW
  noseStyle: 'hyper', tailStyle: 'hyper',                                                            // NEW values
  noseIntake: [[-0.58, 0.06], [0.58, 0.06], [0.50, 0.24], [-0.50, 0.24]],
  cornerIntake: [[0.66, 0.08], [0.95, 0.09], [0.92, 0.30], [0.70, 0.27]],
  rearMesh: { w: 1.5, h: 0.22, cy: 0.42 },
  exhaust: 'none',
  diffuser: { half: 0.80, h: 0.40, z0: 1.75, fins: [-0.8, -0.56, -0.32, -0.1, 0.1, 0.32, 0.56, 0.8] },
  splitter: { w: 1.94, d: 0.62, proud: 0.12, canards: true },
  wing: { span: 1.71, chord: 0.36, y: 0.98, z: 1.98, mountX: 0.42, plate: [0.55, 0.25] },           // plate: NEW
  scoop: true, bonnetVent: true, fenderVents: true, handles: 'hidden',
  mirrorAt: [0.98, 0.86, -0.92], cabinW: 0.80,
  wheel: 'multi', rimColor: 0x101318, caliper: 0x1f4fd8,                                             // 'multi': NEW (drafted as 'split10')
  interior: 'hyper',                                                                                 // NEW value
  // NEW
  seatDrop: 0.15,                          // the driver's frame (eye, wheel, seat, hands, hood camera) moves down this much
  led: { color: 0xdff4ff, halo: 0x3999e2, strips: ['splitter', 'sills', 'diffuser', 'wingPlates'] },
  bar: { color: 0xff2a4a, len: 1.66 },     // the red light bar
  fins: [[0.86, 2.05, 0.12]],              // [|x|, z, height] at the rear corners
  bonnetVents: { x: [0.28, 0.56], z: [-1.95, -1.55], n: 6 },
  plate: { w: 0.52, h: 0.11, y: 0.46 },
};
```

## 5. Performance targets: two tunes

### 5.1 The four cars today

Measured by running each car's `CarDef` through the real `CarPhysics.step` at 120 Hz. Notes on the method:

- **Handling setting.** The default handling (0.35) is what `figures()` is calibrated to. Simulation (1.0) is also
  shown.
- **Lateral grip.** "Lat g" is the tyres' steady lateral force (`p.ay`) over 2 s at a set speed. A run counts only
  with sideslip under 0.12 rad and the speed held within 8 %, and the best over a sweep of steering inputs is kept.
  It compares cars; it is not a skidpad certificate.

| Car | `figures()` card | 0-60 (s) | 0-100 (s) | ¼ mile | Top (mph) | 100-0 (m) | Lat g @25 / 40 / 80 m/s | Sim: 0-60 / 100-0 / lat g @40 / 80 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rossini GT | 211 mph, 3.3 s, 711 hp | 3.28 | 5.73 | 10.48 s @ 149 | 211 | 87.1 | 1.19 / 1.15 / 0.76 | 4.40 / 96.4 / 1.02 / 1.10 |
| Rossini Brio | 201 mph, 3.1 s, 469 hp | 3.11 | 6.02 | 10.67 s @ 138 | 201 | 84.1 | 1.31 / 1.22 / 0.82 | 4.15 / 89.0 / 1.15 / 1.20 |
| Rossini Corsa | 232 mph, 3.1 s, 819 hp | 3.12 | 5.35 | 10.12 s @ 156 | 232 | 84.3 | 1.25 / 1.21 / 0.79 | 4.18 / 90.6 / 1.10 / 1.19 |
| Vela E | 224 mph, 3.3 s, 1019 hp | 3.27 | 5.71 | 10.46 s @ 151 | 224 | 89.4 | 1.04 / 1.04 / 0.58 | 4.39 / 98.9 / 0.94 / 0.92 |

**The best earnable car is the Rossini Corsa** (level 5, 30,000 credits):

- It's the quickest and fastest, and its grip is within 1–5 % of the light Brio's.
- The Vela E is hidden from new players and is slower on every count.
- The earnable envelope today is: 232 mph, 3.11–3.12 s to 60, 84 m from 100 mph, about 1.2 g at 40 m/s, about 0.8 g
  at 80 m/s in Arcade.

### 5.2 UNLEASHED: Free Drive only

An electric tri-motor feel. In the game's one drive curve that means huge torque from zero, constant power above
base speed, and no exhaust.

| Field | Unleashed | Note |
| --- | --- | --- |
| mass | 1,690 kg | A tri-motor car with a compact pack |
| power | 1,500 kW (2,012 hp) | |
| torque | 2,000 Nm | `engineTorque` is flat to 7,160 rpm, then constant power |
| redline | 9,000 rpm | Inside the fixed 10,000 rpm tach, though the car uses the display binnacle |
| final | 3.0 | The 7-speed model kept; gear cap 351 mph |
| CdA / ClA | 0.62 / 2.2 m² | Downforce 1.5× its weight at 300 mph |
| grip | 1.30 | Today's best is 1.07 |
| `Cf` / `Cr` (NEW per car) | 225,000 / 333,000 N/rad | 1.8× today's fixed values: wider tyres, a stiffer response |
| steering gain (NEW) | 1.25 | Multiplies `maxDelta` |
| brake (NEW, replaces the fixed 1.35 g pedal) | 2.0 g | ABS per axle as today |
| collision box (NEW per car) | halfL 2.36, halfW 1.02 m | Today every car uses 2.30 / 0.99 |

Measured with the model (arcade default 0.35; the "Ground Lock" and "Cold Thrust" columns use the M5 force terms of
§6 in the scratch copy):

| | Tyres only | + Ground Lock (fans) | + Ground Lock + Cold Thrust | Best earnable |
| --- | --- | --- | --- | --- |
| 0-60 mph | 2.22 s | **1.50 s** | **0.66 s** (0.76 s thrust alone) | 3.11 s |
| 0-100 mph | 3.80 s | 2.64 s | 1.26 s | 5.35 s |
| 0-300 mph | 21.1 s | 19.9 s | 16.2 s | n/a |
| ¼ mile | 8.36 s @ 199 mph | 7.45 s @ 204 | 6.19 s @ 213 | 10.12 s |
| Top speed | **339 mph** (drag-limited; `figures()` says 336) | 339 | **350 mph** | 232 |
| 100-0 / 200-0 mph | 63.9 / 229.6 m | 54.5 / 208.6 m | (no thrust while braking) | 84.1 / 306.0 m |
| Lat g @25 / 40 / 80 / 130 m/s | 1.45 / 1.67 / 1.23 / 1.23 | **1.96 / 1.93** / 1.25 / 1.23 | same | 1.31 / 1.22 / 0.82 / none (no earnable car reaches 130 m/s) |
| Simulation (1.0): 0-60, lat g @40 / 80 / 130 | 3.07 s; 1.41 / 1.67 / 1.80 | 2.05 s; 2.05 / 1.76 / 1.82 | | 4.15 s; 1.15 / 1.20 |

It is clearly first in top speed, 0-60, cornering grip, downforce and braking, at both handling extremes.

**About the 1.5 s 0-60.** The game's physics drives the rear axle only.

- A rear-drive car's launch is capped by rear-tyre load: about mu × 0.55 / (1 − 0.16 mu) g with today's weight split
  and centre-of-gravity height.
- On tyres alone, 1.5 s needs grip about 1.6. That would make the car corner at about 2.1 g with no help, and leave
  Ground Lock nothing to add. The run at grip 1.56 gave 1.74 s.
- The design uses the fans instead. Ground Lock spins up for a hard launch as well as hard cornering, which is what
  a fan car does. That gives 1.50 s while the base grip stays at 1.30.
- "On its tyres" here means without Cold Thrust; with an empty tank it's 2.2 s.
- The real fix is an all-wheel-drive split (the tri-motor's front motor), queued for the dynamics session (§9). After
  that, the same 1.5 s comes from the drive layout, and Ground Lock can go back to corners only.

**The garage card can't use `figures()` for this tune.**

- `figures()` is calibrated to the Rossini GT and says 2.6 s and 336 mph here, against the 2.2 / 1.5 s and 339 mph
  measured.
- M3 stores the measured numbers per tune in `cars.ts`, and the physics test fails if a card drifts from the
  simulation by more than 0.1 s or 2 mph.

### 5.3 RACE TUNE: every scored mode

The earnable envelope, at or under the Corsa on every measured number, with the ability off:

| Field | Race tune |
| --- | --- |
| mass | 1,500 kg |
| power | 620 kW (831 hp) |
| torque | 1,000 Nm |
| redline / final | 9,000 / 4.0 |
| CdA / ClA | 0.80 / 1.0 |
| grip | 1.04 |
| `Cf` / `Cr` | today's (125,000 / 185,000) |
| steering gain | 1.0 |
| brake | 1.35 g |

| Measured (arcade 0.35) | Race tune | Corsa | Difference |
| --- | --- | --- | --- |
| 0-60 | 3.12 s | 3.12 s | 0 (Brio 3.11) |
| 0-100 | 5.36 s | 5.35 s | +0.2 % |
| ¼ mile | 10.13 s @ 155 | 10.12 s @ 156 | +0.1 % |
| Top speed | 231 mph | 232 mph | −0.4 % (`figures()` card: 229 mph, 3.1 s) |
| 100-0 | 84.6 m | 84.3 m | +0.4 % longer (Brio 84.1) |
| Lat g @40 / 80 m/s | 1.20 / 0.77 | 1.21 / 0.79 | −1 % / −2.5 % |
| Lat g @25 m/s | 1.07 | 1.25 | −14 % (heavier car on today's fixed tyre stiffness; raising `Cf`/`Cr` 6 % would push the simulation-mode 80 m/s figure 0.01 g over the Corsa, so it stays under) |
| Simulation: 0-60 / 100-0 / lat g @40 / 80 | 4.19 s / 90.8 m / 1.07 / 1.18 | 4.18 s / 90.6 m / 1.10 / 1.19 | all at or under |

Notes on the race tune:

- **Iterations.** Two earlier drafts (CdA 0.74 and 0.78) reached 237 and 233 mph, over the Corsa. The final CdA
  0.80 was chosen to land under it.
- **Fallback.** If any M3 measurement in the game puts the race tune over the Corsa, it becomes the Corsa's numbers
  verbatim.
- **Races.** Rivals are set against your car's own top speed (`Game.carTop()` × 0.95 / 0.92 / 0.89), so a race in
  the race tune is the same race as in a Corsa.

### 5.4 How the tune switches

- **The call.** `applyCar(c, tune)` takes `'unleashed' | 'race'`. The hypercar's `CarDef` carries both sets; the
  other cars ignore the argument.
- **The choice.** `Game.start()` already calls `applyCarChoice()` before anything else, races included. It passes
  `mode === 'free' ? 'unleashed' : 'race'`, and latches the tune in a field for the run.
- **Attract mode.** `startAttract()` (the menu's demo) applies the race tune.
- **Nothing changes mid-run.** Settings, the garage and the pause menu don't touch the tune; the next `start()`
  does. The car ability is enabled only when the latched tune is Unleashed.
- **What the player sees.**
  - The HUD gets a `tune` field and shows an **"Unleashed"** chip in Free Drive.
  - The garage card shows both rows: "Free Drive · Unleashed: 339 mph · 1.5 s" and "Races, Time Trial, Survival ·
    Race tune: 231 mph · 3.1 s".
  - Run cards and the local board say which tune ran.

### 5.5 What breaks at the Unleashed speed, and how M3 tests each

Unleashed tops out at 151 m/s (339 mph), 157 m/s with thrust. That's 1.26–1.31 m per 120 Hz step, and 5 m per frame
at 30 fps.

1. **World streaming.**
   - **Roads.** `Roads.update` builds at most `budget` chunks per call. Chunks are 160 m (`CHUNK`), and the game
     calls `stream(1)` once a frame.
   - **Terrain.** `Terrain.update` builds one 480 m tile per call, with the detailed tiles within 520 m.
   - **Draw distance.** 900 m on Low, 1,300 Medium, 1,800 High, 2,400 Ultra. On Low the car crosses its whole draw
     distance in 6 s.
   - **The test harness.** `fastForward` streams only every 24 steps: 30 m at this speed between one-chunk builds.
     That's a test-harness limit, and M3's tests stream every simulated frame.
   - **Test:** 60 s at 150 m/s through the busiest interchanges (M3 picks them by counting chunk descriptors per
     square km; the 5/405 and 55/405 junctions are the likely ones), stepped as 30 fps frames, on Low and High.
     - No unbuilt road chunk within 600 m ahead at any frame (`Roads.pending` restricted to ahead).
     - Terrain detail under the car.
     - Chunk build time logged (worst and 95th percentile ms).
     - The origin rebase (every 1.5 km, so every 10 s) timed.
2. **Road look-ahead.** The navigator warns 1,600 m before a diverge: 10.7 s at 150 m/s. The autopilot looks
   6 + 0.75 v m ahead and scans curvature 40 + 3v m ahead.
   - **Test:** a routed drive across an interchange at 150 m/s takes its ramp.
3. **Traffic spawn distance.**
   - Cars spawn only beyond 0.72 × the view distance (615–855 m on Low, a band crossed in about 2 s at 120 m/s
     closing speed). Top-ups run every step (up to 3 tries per carriageway); despawn is beyond 1.25 ×.
   - **Test:** 60 s at 150 m/s on Heavy. Cars within 600 m ahead stay within ±30 % of the density target. No car
     appears within 400 m in front of the camera (log each spawn's distance).
4. **Tunnelling through traffic.**
   - A step moves the car 1.26 m and closes on traffic at about 1.0–1.25 m. Boxes are 9 m long together, so they never
     pass through each other.
   - But `Traffic.collide` resolves along the axis of least overlap (a 2D separating-axis test). In a fast rear-end
     with the cars offset 1.2–1.6 m sideways, the first overlap can be smaller across than along. The car is then
     pushed sideways at a low contact speed: no crash, and Survival goes on.
   - **Test:** scripted rear-ends at 120 m/s closing with lateral offsets 0, 0.6, 1.2 and 1.6 m. Each must register
     a contact along the car's axis (|n·forward| > 0.7) at about the closing speed.
   - **Fix:** a swept test (time of first contact along the relative velocity within the step), or four collision
     substeps when closing faster than 40 m/s.
   - Barriers are safe: a wall is missed only above about 155 m/s *sideways* (reach + 0.3 m per step). The test is
     150 m/s into a barrier at 30°.
5. **Steering lock and Arcade's stability control.**
   - `maxDelta` at 134 m/s is 0.0095 rad in Arcade. The stability control pulls the yaw rate toward
     rKin / (1 + 0.0009 v²), divided by 17 at 300 mph.
   - Before the tyre and steering fields, the candidate held only **0.61 g at 130 m/s** in Arcade, less than the
     earnable cars at 80 m/s. With `Cf`/`Cr` × 1.8 and steering gain 1.25 it holds **1.23 g**.
   - **The road decides the rest.** Of the 746 km of mainline (smoothed radius: median 10.2 km, 10 % under 981 m,
     1 % under 558 m), the share that needs more lateral grip than:

     | At | 0.61 g | 1.0 g | 1.23 g | 2.0 g |
     | --- | --- | --- | --- | --- |
     | 300 mph | 31 % | 23 % | **19.4 %** | 8.4 % |
     | 250 mph | 26 % | 16 % | 11.3 % | 2.1 % |
     | 200 mph | 17 % | 6 % | 2.6 % | 0.3 % |

     So flat out at 300 mph, a fifth of the mainline needs a lift. That's honest physics, not a bug. The wash-wide
     must still be a slide, not a wall-strike every time.
   - **Test:** a fast test driver (pure pursuit, speed = min(Vmax, √(a·R))) at a = 1.1 g for 10 km each on the 405
     North and the 5 North, at Arcade and Simulation. No wall contacts, within ±0.6 m of its lane.
   - Then a flat-out run, logged to show where it lifts.
   - M4 then scales the stability control's yaw target by the car's grip.
6. **Camera.**
   - The field-of-view widening and Ultra's shake both saturate at 90 m/s, which is fine. The impact shake is already
     capped.
   - **Test:** cockpit, hood and chase frames at 150 m/s: camera finite, chase distance steady, no jitter between
     interpolated physics poses (`alpha`).
7. **Speedo and HUD.**
   - The HUD shows a rounded mph integer, so 339 fits. The corner map redraws at 10 Hz (15 m apart).
   - The cockpit tach in `car-gauges.ts` is fixed at 0–10,000 rpm with the red line at 8,500 for every car. The
     hypercar's display binnacle replaces it.
   - **Test:** HUD at 339 mph at 375 × 812 portrait, with no wrap or clipping, and the "Unleashed" chip visible.
8. **Sound.**
   - The engine voices run at rpm / 15 Hz: 600 Hz at 9,000, fine. Wind saturates at 108 m/s.
   - There is no electric voice: the Vela E plays the V8 today too. The hypercar needs a motor whine (a tone rising
     with motor speed, plus a little inverter hiss), and the thrust, fan and hop sounds of §6.
   - **Test:** every audio parameter finite at 157 m/s (no NaN into `setTargetAtTime`), master gain ≤ 1.
9. **Physics stability.**
   - `Cf`/`Cr` × 1.8 keeps the explicit 120 Hz step stable: the fastest lateral and yaw modes are λ·dt ≈ 0.5 at
     6 m/s, against a limit of 2.
   - **Test:** parking-speed turns at 2–10 m/s with no yaw ripple; 0 → 339 mph with no NaN; lane changes at 300 mph
     settle.
10. **Earnings.** Free Drive pays XP and credits by distance (`profile.add`: 1 XP per 100 m, 1 credit per 200 m).
    Flat out, Unleashed would earn 47 % faster than the best earnable car (2,718 against 1,854 credits an hour).
    - **Fix (M3):** while Unleashed, the distance that earns is capped at the race tune's top speed (103 m/s × dt).
    - **Test:** an hour of fast-forwarded Free Drive at 150 m/s earns the same as at 103 m/s.

## 6. The ability: Cold Thrust, Ground Lock, Thrust Hop

The inspiration, as reported on 2026-10-15 (manufacturer claims, not verified): a sports car with rear cold-gas
thrusters fed by compressed-air tanks for brutal launches, fans that suck it to the road for about 2 g of cornering,
and a thruster-assisted hop over other vehicles.

These are **our own systems with our own names**. No real company or product is named anywhere in the game, the
code, the UI, commits or player-facing text.

**Rules:**

- **Free Drive only.** The ability exists only when the latched tune is Unleashed: off in Races, Time Trial and
  Speed Survival.
- **When it's off.** Never during a countdown, while paused, in the attract demo, or after a run has ended.
- **The driver's own ability** (Clear Path, Focus Time, Locked In) is unchanged and separate.

### 6.1 The tank

| Item | Value |
| --- | --- |
| Capacity | 100 %, shown as 0–700 bar on the pressure gauge |
| Full thrust | Empties it in 6 s |
| Recharge while driving (above 5 m/s) | 1/12 of the tank a second |
| Recharge under braking (the compressor on regen) | 1/6 a second |
| Recharge when stopped | none |
| Minimum to start thrust | 10 % |

### 6.2 Cold Thrust (hold)

- **The force.** A body force along the car's x, a = 2.0 g × (1 − smoothstep(0, 80 m/s, v)) + 0.05 g, scaled by how
  hard the button is held (touch is on/off). So about 2 g off the line, 1.5 g at 60 mph, and gone by 180 mph except a
  0.05 g floor. The floor lifts the top speed a little: measured 339 → **350 mph**.
- **Measured.** 0-60 in 0.76 s on thrust alone, 0.66 s with Ground Lock. Peak acceleration 4.4 g.
- **As built (M5, 2026-10-20, on the merged dynamics model).** The force is 2.6 g × (1 − smoothstep(0, 80, v)) + 0.05 g
  through `ext.fx`. On the finished model the push transfers load off the front axle, and the traction control trims
  the all-wheel drive to what the front can take, so 2.0 g of force netted only about 1.1 g over the tyres and fans
  (0-60 in 0.97 s). At 2.6 g the car nets about 2 g extra at launch (headless, Arcade: 1.86 g from 5 to 10 m/s, 1.55 g from 10 to
  15, 1.3 g by 20 m/s).
  Measured in the built game (Arcade): 0-60 in **0.79 s** with THRUST and Ground Lock (1.34 s fans only, 2.26 s
  tyres only), 0-100 in 1.47 s, peak 4.53 g; one tank from flat out lifts 335 → 341 mph (the tank lasts 6 s, so the
  asymptotic 350 is not reached).
- **The body and camera.** The head and pitch offsets in `updateCamera` and `PlayerCar` are already clamped, so a
  4 g launch doesn't throw the view.
- **Off at once.** On release, an empty tank, or the brake.

### 6.3 Ground Lock (automatic)

- **The force.** Fan suction added to both axles' loads (45 / 55 front / rear): 0.5 × the car's weight to 90 mph,
  falling to 0.2 × by 200 mph, where the wing takes over.
- **When it's on.** Automatically, when the driver asks for more than 0.8 g sideways, or launches hard (full
  throttle below 30 m/s with the rear spinning). It spins up in 0.25 s.
- **Cost.** 3 % of the tank a second. It's off below 5 %.
- **Measured.** Lateral 1.96 g at 25 m/s and 1.93 g at 40 m/s in Arcade, 2.05 g at 40 m/s in Simulation ("about
  2 g at low and middle speeds"). It makes the 1.50 s launch. 100-0 is 54.5 m.
- **As built (M5, 2026-10-20).** On the merged model (tyre load sensitivity), 0.5 × weight gave 1.91 g at 25 m/s and
  1.73 g at 40 m/s, so the suction is 0.8 × weight to 90 mph, easing to 0.3 × by 200 mph. Measured (the harness's
  steering sweep): 2.04 / 1.81 / 1.22 g at 25 / 40 / 80 m/s in Arcade (tyres alone 1.54 / 1.49 / 1.18), 2.02 / 1.97 /
  1.57 g in Simulation (1.36 / 1.42 / 1.45). Arcade at 40 m/s is held at 1.81 g by Arcade's steering lock (full lock
  there is 3.2°), not by the fans; that is M4's grip-scaled stability control. The compressor pauses while the fans
  spin (they share its drive), so the 3 % a second is a real cost: 4 s of cornering at 25 m/s takes 12 %.

### 6.4 Thrust Hop (double-tap)

A short scripted ballistic hop:

- **Cost.** It needs 40 % of the tank and costs 35 %.
- **Height and air time.** The game picks them. It scans 60 m ahead in the car's lane for the nearest vehicle, then
  sets the peak to clear its roof by 0.6 m (a sedan about 1.5 m, a semi about 4.1 m, so peaks of about 2.1–4.7 m). The
  air time keeps the car above that height from 2 m before the vehicle's tail to 2 m past its nose at the current
  closing speed, up to 2.5 s.
  - If the closing speed is too low for that, it does a 1.5 m hop and the HUD says "Need more speed to clear".
  - With no vehicle ahead, it's a 1.5 m hop.
- **Bound to the road.**
  - In the air, the car keeps its own path: s advances with its speed and its lateral position is held within the
    lanes.
  - Its height is the road's height there plus the parabola, and its heading is the road's heading plus its current
    angle to it.
  - Path switching (`trackPath`) is off in the air, so it **always lands on the road it left**, even at a split.
- **No hop under structures.** It's refused if an overpass or a sign gantry lies over the hop's ground track (the
  next v × air time + 20 m), from `Network.overpasses` and the gantry signs. The HUD says "Structure ahead".
- **In the air.**
  - Tyre forces are off: no drive, no lateral force, no brakes. Drag keeps acting, and so does thrust if it's held.
  - Traffic contact uses each vehicle class's height: no contact while the car's underside is above the other's
    roof. Today `Traffic.collide` just skips anything more than 2.5 m away vertically, which a semi exceeds.
  - Barrier contact is off while the lateral position is clamped.
- **The landing.** Tyres back on. A heave impulse into `PlayerCar`'s suspension proportional to the vertical speed,
  a camera bump, and a thump (`audio.thump`).
- **As built (M5, 2026-10-20).** `planHop` in `HyperAbility.ts` clears the nearest vehicle it is closing on by 0.35 m
  (peak 1.5–7.5 m, air time 0.6–2.5 s, the arc's fall at most 2.5 g and at least 0.55 g where an arc allows). Every other vehicle in the lane
  that it could reach in the air or within 1.5 s of touching down must be cleared too, or the hop is refused ("No room
  to land"). The plan allows for each vehicle braking as hard as the traffic model ever brakes (10 m/s², to a stop at
  most) while the car could be over it, ordinary hard braking (4 m/s²) for the landing room, and speeding up as hard as
  an aggressive driver does (2.24 m/s²) for the time over it; the numbers live in `traffic/limits.ts`, which
  `Traffic.ts` reads too. (That was the first build's planner: it refused most hops in ordinary traffic, and was
  retuned on 2026-11-09, below.) A car changing lanes counts in the lane it is moving to. The scan reads each vehicle's level against
  this road's own height where it is: the first build compared it with the height under the car, so on a grade it
  missed vehicles 100 m ahead and landed on them (found by the suite's semi check in heavy traffic). Refusals: "Thrust
  Hop: tank low", "Need more speed", "Too close to clear", "No room to land", "Get closer to clear", "Need more speed
  to clear", "Junction ahead: no hop", "No hop: overpass ahead", "No hop: sign gantry ahead", "No hop: bridge
  overhead". Keys: Left Shift (hold, double-tap) and J for the hop; D-pad up; the phone's THRUST button sits beside
  the driver's ability, over BRAKE.
- **Repair (M5 review, 2026-10-21).**
  - **The driver's Focus Time.** The hop is planned for the traffic at the world's pace at take-off (0.7× under
    Focus Time). The first build let Focus Time end in the air: the world snapped back to 1×, a semi went from 15.8 to
    22.6 m/s under the car, and the car touched its trailer 19 times in the air, 0.27 m under its roof (the judge's
    run, seed 25). Now the driver's ability never changes the world's pace during a hop. A Focus Time that runs out
    in the air holds the world at 0.7× until touchdown (`Game.abilityEndHeld`). One asked for in the air waits for
    touchdown ("Focus Time on landing", `Game.focusOnLand`). Clear Path and Locked In don't change the pace; their
    ends hold to touchdown too, which is harmless.
  - **A vehicle too far ahead to clear in one hop.** At low closing speeds the nearest vehicle is often too far to
    clear in 2.5 s. The hop then comes down at least `HOP.landGap` (1.5 s) short of it, with every other vehicle's
    need met (toast "Thrust Hop · short of the sedan"). When even that doesn't fit, it says "Get closer to clear" if
    the vehicle could be cleared from 0.3–0.8 s behind its tail, else "Need more speed to clear".
  - **Smaller fixes.**
    - The HUD's hop label and the dash gauge say "charging" only while the compressor runs ("Hop: tank low" / "LOW"
      otherwise).
    - The refusal past a road's end now says "Junction ahead: no hop".
    - The gauge counts in 10 bar at most 4 times a second on the phone build (5 bar, 10 a second on High).
    - The thrust sounds are built the first time the hypercar uses them.
    - The gantry offsets are one constant (`GANTRY_AHEAD` in `Network.ts`), used by `Roads.ts` and the hop's
      clearance check.
    - THRUST lets go when a gamepad is unplugged with D-pad up held.
- **Retune for play (M5 play review, 2026-11-09).** The play judge's fair test (moderate traffic on the suite's I-405
  North straight, the car lined up 50 m behind each vehicle ahead with nothing between in that lane) granted 11 of 73
  double-taps at +30 m/s (15 %) and 13 of 73 at +40 (18 %), 6-9 % in heavy traffic; at +15 m/s every grant was a 1.5 m
  hop short of the vehicle (0 % over anything); casual double-taps while cruising at 55 and 80 m/s were granted 1 and 5
  times in 25 (4 % and 20 %), none over a vehicle. "No room to land" was most of it. The first planner stacked worst
  cases on every vehicle: 1.5 s of empty lane past the touchdown, an emergency stop (10 m/s²) for when it could be
  under the car, and the bold driver's 2.24 m/s² of speeding up for the whole hop for when the car is past it. Now
  (`HOP` and `planHop` in `HyperAbility.ts`; the vehicles' `v0`, `bold` and `acc` passed in by `Game.thrustHop`):
  - **The landing is the driver's.** A vehicle past the touchdown is a veto only when the car would come down within
    one car length and 2 m of its tail plus 0.5 s at the closing speed (`landGap`, was 1.5 s; the vehicle braking at
    4 m/s² meanwhile). Within 1.5 s of that (`landWarn`) the hop goes, its toast ending "· traffic on landing": the
    driver lands on 2 g of brakes or changes lanes. A plain hop short of a vehicle too far to clear keeps 1.5 s of room
    before that vehicle (the car was heading straight at it; with 0.5 s a short hop at a semi at +30 m/s ended in its
    tail in testing), so from 50 m at +15 m/s it now says "Get closer to clear" (no gas spent) where it used to spend
    35 % of the tank on a bunny hop.
  - **Braking as drivers do.** Each vehicle is planned braking at the traffic model's comfortable 3.2 m/s²
    (`IDM.comfort`), or harder when it already is (its acceleration now). An emergency stop past that is met honestly
    by the contact model, as before.
  - **Speeding up to its own cruise.** Each vehicle speeds up at its own driver's rate (1.6 m/s², 2.24 for a bold one)
    only until it is back at its own cruising speed (`v0`, at the weather's pace): not at all for a car already at its
    cruise. A sedan at +15 m/s can now be cleared from up to about 20 m off its tail (17 m before); from 50 m no hop of
    2.5 s can (the car needs about 4 s just to pass it).
  - **Messages.** "Too close to clear" also when only a start further back would clear (it said "Get closer to clear"
    3 m off a sedan's bumper). The vehicle behind a refusal is logged (`hopLog.block`) for the tests.
  - **The suite's straight is a co-signed stretch.** I-405 North from 34.5 to 37.15 km, where `findStraight` lands and
    where the judge measured, carries CA-22 West on the same centreline in the road network: its four lanes laid over
    I-405's five, so its vehicles drive half a lane (1.83 m) off every I-405 lane centre and overlap the car's lane by
    about 9 cm. The contact model counts them, on the ground too: cruising there on the autopilot at 55 m/s in moderate
    traffic with no hop, the car was in contact with CA-22 West vehicles for 3,791 steps (12 hits) in 40 s. On that
    stretch they were 14 of the 17 "Too close to clear" refusals at +30 m/s (5 alongside or just behind the car, 9 within
    30 m ahead; the other 3: a semi the probe had placed the car into, and 2 cars changing into the lane), and half the
    vehicles behind "No room to land". So the planner is right to count them, and that stretch understates the hop.
    It is a map-data issue outside M5 (two routes' traffic on one carriageway), reported for the map pipeline and not
    fixed here. The availability check runs on a straight with no other freeway on its pavement (I-5 North from 47 km).
  - **Measured** (a probe of the judge's set-up run on the build before and after the retune, the same seeds 7-12 and
    vehicles; granted, then over the vehicle; `tests/out/hyper-thrust/avail.mjs`, its results beside it as
    `avail-before-*.json` and `avail-after-*.json`):

    | Set-up | Before | After |
    | --- | --- | --- |
    | I-405 North 34.5 km (co-signed), moderate, +30 m/s from 50 m | 11 of 74 (15 %), 9 over (12 %); the judge: 11 of 73 | 21 of 76 (28 %), 14 over (18 %) |
    | the same, +40 m/s | 15 of 73 (21 %), 10 over | 36 of 78 (46 %), 25 over (32 %) |
    | the same, +30 m/s, nothing between on any road | 7 of 42 (17 %) | 16 of 40 (40 %) |
    | the same, heavy, +30 / +40 m/s | 2 of 54 (4 %) / 3 of 54 (6 %) | 12 of 54 (22 %) / 19 of 61 (31 %) |
    | I-5 North 47 km (no co-signed route), moderate, +30 m/s from 50 m | 24 of 77 (31 %), 23 over (30 %); 14 under a structure | 42 of 78 (54 %), 41 over (53 %); 19 under a structure |
    | the same, +40 m/s | 31 of 76 (41 %) | 54 of 79 (68 %) |
    | the same, heavy, +30 / +40 m/s | 12 of 54 (22 %) / 14 of 56 (25 %) | 17 of 60 (28 %) / 29 of 64 (45 %) |
    | a sedan at +15 m/s from 10 / 15 / 20 m (I-5 North) | 81 / 70 / 0 % over it | 85 / 79 / 76 % over it |
    | a sedan at +15 m/s from 50 m (I-5 North) | 66 of 72 granted, 0 over (bunny hops short of it) | 0 granted: "Get closer to clear" 62 of 63 |
    | casual double-taps at 55 / 80 m/s, I-405 North (the judge: 1 and 5 of 25) | 11 / 4 of 50 (22 / 8 %) | 16 / 5 of 50 (32 / 10 %) |
    | casual double-taps at 55 / 80 m/s, I-5 North | 40 / 38 of 50 | 43 / 37 of 50 |

    Contacts after the retune: none in the air on I-5 North in any granted hop, and none at all within 1.5 s of
    touchdown at +30 m/s (42 hops) or at +15 m/s from 10 and 15 m (from 20 m one landing rubbed a vehicle for 9 steps,
    no hit). At +40 m/s, 3 of 54 landings with traffic close ahead ended in the next
    vehicle on the ground (4 hits): the test's autopilot only brakes, and the landing is the driver's. On the co-signed
    stretch at +40 m/s there were 9 hits on the ground after 36 granted hops (the autopilot watches only its own road's
    traffic), and 2 contacts in the air over the two +40 m/s runs, each with a CA-22 West SUV driving half a lane off
    (1.82-1.87 m from the car's line) as the car came down beside it at 0.75 and 1.95 m up.
  - **Not covered headless.** `tests/dynamics.mjs` has no planner coverage (it never calls `planHop` or `hop()`): the
    hop is proven only in the browser, by the suite's abilities group and `tests/out/hyper-thrust/thrust.mjs`.

### 6.5 Controls

| Device | Cold Thrust | Thrust Hop |
| --- | --- | --- |
| Phone | One **THRUST** button beside the driver's ability, over BRAKE (in `HUD.tsx`, shown only when the ability is live; held sideways, the two sit low in the middle). Thrust starts after 120 ms of holding (at once under 5 m/s), so a tap isn't a burst | A second tap within 300 ms. The button's ring is the tank gauge |
| Keyboard | Hold **Left Shift** | Double-tap Left Shift, or **J** (Shift is unused today; F stays the driver's ability) |
| Gamepad | Hold D-pad up (button 12; unused today) | Double-tap D-pad up |

### 6.6 Visuals, sound, HUD and cockpit

- **Jets.** White condensation jets with an ice-blue tint from two small nozzles in the diffuser:
  - additive camera-facing sprites (about 24 a nozzle, one instanced draw call), stretched along the jet and fading
    in 0.4 s;
  - a short cone with scrolling noise at each nozzle.
  - Seen in the chase and hood views and in the mirrors. From the seat, the gauge, the sound and the push tell you.
- **Fans.** A faint shimmer under the sills while Ground Lock runs (a cheap alpha strip). Optional.
- **Sound.** All built from the engine's existing noise buffer and oscillators:
  - Cold Thrust: a sharp high-passed hiss (2–6 kHz band-passed noise) with a valve click at the start and a low thump.
  - Ground Lock: a rising whine (400–1,200 Hz plus noise).
  - The compressor: a faint hum while recharging, and a tick when full.
  - The hop: a whoosh, then a landing thump.
- **HUD.** A tank arc beside the speed ("THRUST 84 %"), a "GROUND LOCK" light while the fans run, "HOP READY" or the
  reason it's blocked, and the "Unleashed" chip.
- **Cockpit.** A 0–700 bar pressure gauge on the `'hyper'` display, the ambient strip pulsing blue while thrusting.

## 7. The Founder Edition exclusives

| Exclusive | How |
| --- | --- |
| A numbered plaque on the sill and the console | Engraved-look text drawn in a canvas: "OC HYPERCAR · FOUNDER EDITION · No. 0042". The number comes from the store entitlement later. **In owner mode it reads "No. 0000 · TEST"**; with no entitlement there is no number, and none is ever invented |
| A paint and LED colour reserved to it | **As built (M6): "Glacier Silver"** (0xc8d3e8, the M1 paint, renamed from the plan's "OC Founder Silver" 0xbfc4cc as the M6 brief asked) with **"Founder Ice"** LEDs (0xa6dcff / 0x2f8fe8, the M1 strips). One place: `src/game/founder.ts` (`GLACIER_SILVER`, `FOUNDER_ICE`, `finishesFor`, `paintFor`). The game has no paint picker yet: the finishes list a picker must use offers the pair on no other car, and a reserved paint asked for on another car falls back to that car's own colour. Check the names against the store's "Founders Sunset" pearl so the two founder offers don't blur (§11) |
| LED wake-up sweep | In the garage and on the start line: the LEDs light in sequence over 1.2 s. The splitter from the centre out, the blades inner to outer, the sills front to back, the diffuser, then the red bar from the centre out. One `uSweep` uniform on the LED material (emissive × smoothstep along each strip's own coordinate). Respects reduced motion (lights at once) |
| A garage reveal stage | A dark stage like the sheet's: a wet-look floor, a ring of strip lights, a slow turntable, the sweep. Built from `src/preview/stage.ts` and `test-stage.ts`. Shown once when the car first enters the garage, then on demand |
| A Founder Edition badge on its run card | `runCard.ts` draws a small badge with the plaque number beside the car name on cards from this car |

**The honest promise.**

- "Sold until December 31, 2026, then never sold again" is true only if the owner keeps it.
- **One constant.** The window is `FOUNDER_UNTIL = '2026-12-31T23:59:59-08:00'` (Pacific).
- **The server enforces it**, not the device's clock: the store pass's checkout and webhook.
- **The copy says only what the owner commits to.** The owner has to decide one thing before sales:
  - Is it the *Founder Edition and its exclusives* (plaque, colour, sweep, reveal, badge) that are never sold again?
  - Or is it *the car itself*, which then can never become earnable or sold in another form?
- No countdown timers, no "only N left" (there's no cap on numbers), no extensions.

## 8. Milestones

The brief referred to a milestone list "below" that wasn't included. These follow the order of the project's own
task title: plan and owner mode, body, lights, fastest car, profiles, Cold Thrust and Hop, exclusives.

Every milestone ends with `npm run build`, the named suite groups, renders read by eye, numbers logged in
`PROJECT_OC_PROGRESS.md`, and no regressions in the other four cars.

| Milestone | What | Tests and proof |
| --- | --- | --- |
| **M0 Plan and owner mode** | This document. Owner mode: the setting `owner` (`settings.ts`), turned on by opening the game with `#owner` (`#owner=0` turns it off; an artifact link keeps a bare `#anchor`) or by the Settings toggle "Owner mode (all cars unlocked, test builds only)", with a visible "Owner mode" chip in the garage. **Built 2026-10-16** (logged in `PROJECT_OC_PROGRESS.md`): every listed car drivable without credits, level or slot, the pick kept apart from the profile; the hypercar's own parts of this row wait for the car (M1, M3). The garage shows GT, Brio, Corsa and the OC Hypercar; the Vela E only with owner mode or when owned. In owner mode the hypercar is drivable with "No. 0000 · TEST". It has no credit price, can't be bought with credits, can't be sold for credits (`profile.sell` refuses it), and doesn't take a garage slot (a level-1 profile has one: `slotsFor`). **Owner mode is a local switch, not security:** anyone can type `#owner`. That's acceptable while everything is test mode, but before any real sale it must be compiled out of public builds or tied to the owner's signed-in account, or the paid car is free to anyone who reads this. | `progression`: a fresh profile's garage lists four cars; the Vela appears with owner mode or ownership; the hypercar shows "Founder Edition · test mode" instead of a price; buy and sell refuse it. `boot`. A search shows no purchase flow on this branch. |
| **M1 The body** (procedural model) | **Body, paint, LEDs, wheels and badge built 2026-10-17, repaired after review from 2026-10-17 to 19** (logged in `PROJECT_OC_PROGRESS.md`, renders beside the sheet in `tests/out/preview/hyper-vs-ref-r2.png`); the seat drop waits for decision 1 (§12), and the roof over the shared eye is 1.067 m, below the 1.16 m eye, so it lands before the car is drivable (see M3). `oc-hyper` `ShapeParams` (§4.2); nose and tail styles `'hyper'`, head style `'blade'`, wheel `multi` (five split spokes), staggered tyres (`rR`), the traced OC mark on the badge, plate and caps, carbon pieces, fins, cowl vents, a narrow teardrop canopy with dark channels along its base, a deck crown, a full-width black lower nose, a wide diffuser mouth, and a gloss-black two-tone drawn by the paint shader (`masks`). The seat drop (0.15 m) through `spec.ts`, `cockpit.ts`, the hands and `PlayerCar`'s anchors, as one per-car offset that is zero for every other car | Renders at 960 × 540 (`test-car.ts`): side, front and rear (camera 1.0 m up), top, hero (golden hour, and night under the preview's showroom key), rear 3/4, wheel, wing and lineup, each beside the matching reference crop, with 50/50 overlays for the side and the top. The other four cars: eleven views (GT side, front and seat; Brio side, hood and rear; Corsa side on both builds, and chase; Vela side, and top on `phone`) compared pixel by pixel with renders of the code before M1: unchanged within render noise (0 to 8 pixels by one level on the side, rear and top views; 60 and 86 on the GT front and seat, where two renders of the unchanged code differ by 64 and 85; the hood and chase views differ by one level in the sky only, a band that varies between renders of the same code), and the lineup render. Budget numbers from the page's JSON line (§10). NaN check. Groups `boot`, `render`, `phone` |
| **M1b Body fidelity (queued 2026-10-19; set aside on 2026-11-09, then built that evening as the day's leftover; uncommitted, still a procedural model built in code)** | M1 landed with its side view, budget and code accepted by both reviewers, but the art review (twice) found the front, rear and top not yet recognisably the sheet's car. By the owner's build order (the hypercar drivable first), the body was committed as it is and these fixes wait for a fidelity pass after M6; M2 takes the headlamp blades because it owns the lights:<br>1. ~~Nose and face: replace the convex black lower 'bumper' with the sheet's structure: a crisp silver lip at blade height overhanging a black intake zone set back 8-12 cm, with angular vertical fins and a central divider; silver fender 'fangs' down each outer corner to the splitter, with the LED on the fang's inner edge; sharpen the nose in plan.~~ **Done in M1b (2026-11-09)**, except the plan sharpening: `ShapeParams.face` gives a lip line from 0.33 m at the centre up to the blades' inner tips (0.37 m at 0.45 m out) and on under each blade to 0.49 m at the fang (0.80 m out); below it, inside the fangs, the body's warp sets the nose back 0.10 m over a 2.4 cm step, so the lip overhangs a recessed zone (the splitter, under YSILL + 1 cm, stays put). Three 'front' masks paint the recessed faces gloss black (the five under-blade masks and the two front masks are gone); five carbon fins 20 mm thick stand in it (a central divider and pairs at 0.23 and 0.47 m, the outer pair leaning in 6 cm at the top), from 3.5 cm behind the lip's edge down to the splitter; the corner intake moved inside the fang (0.58 to 0.77 m) and its LED onto the fang's own front face along its inner edge, from just under the lip to the splitter; the front low carbon drops from 62 % to 30 % of the side's height, so the fangs are silver down to the splitter. The lip's own V (0.33 m at the badge rising to 0.37 m at the blade tips) is the blunt point in the FRONT and hero views; the nose's plan rounding (nose.R, p) is unchanged.<br>2. ~~Headlamp blades: make them read as the sheet's main feature. Each runs from about 0.12 m off centre to the fender corner (about 0.75 m long per side), about 2.5 cm tall, emissive, under a dark lamp-socket recess. Today they are thin short arcs on the edge of a black mass.~~ **Done in M2 (2026-10-21):** built to the sheet and to §3's dimension row (each blade from |x| 0.49 m out to 0.94 m), not to this note's 'about 0.12 m off centre': the sheet's FRONT panel puts each blade's inner tip 0.47 m off the centre, with silver nose between the two tips (an earlier M2 pass ran the blades in to 0.14 m along the lower nose's edge, so they nearly met in the middle as one curved bar). Each blade is a lit face 25 mm tall along the head quad's swept front edge from x 0.45 m, y 0.39 m out round the fender's corner to x 0.90 m, y 0.53 m (0.54 m long in plan, 0.56 m along its path), narrowing to 6 mm over its inner eighth. Over it a dark socket (the smoked lens at a third of the sky's reflection, the three-cell module at its outer end, the blade's blue glow only along its lower fifth) stands 74 mm over the face's top edge at the outer end and tapers to nothing about halfway in; in plan it runs back 2 cm at the tip to 16 cm at the outer end (`ShapeParams.blade`, `car-body.ts`). Every figure here is measured from the built geometry (`tests/out/m2g-measure/run.mjs`). Renders: `tests/out/preview/m2g/blades-sheet-vs-render.png` (the sheet's FRONT over the render at night and by day, scaled to the same width), `hyper-front-a.png`, `hyper-front-night-a.png` and `-x3`, `hyper-hero-a.png` and `-x3`, `hyper-hero-night-a.png` and `-x3`, `hyper-hood-a.png`; in the game, `tests/out/m2g/hyper-night-front34.png`.<br>3. ~~Bonnet: shrink the filled dark V to a narrow spine, no more than 10 cm at the cowl, with an arrow tip at the badge; two dark hood vents or sockets either side near the cowl.~~ **Done in M1b:** the spine is 2 cm wide behind the badge and 10 cm at the cowl, with an arrow tip from 2.275 to 2.165 m ahead of the car's middle (just behind the badge at 2.30 m); a dark socket mask frames each of the two louvred cowl vents.<br>4. ~~Splitter: proud 0.24 to about 0.10-0.12 m; carbon black, not tan, in daylight; smaller end plates; no plank ahead of the nose in SIDE.~~ **Done in M1b:** proud 0.12 (after the nose's lean its leading edge is at z −2.424 m, 3.2 cm ahead of the lip's point at −2.392); the hypercar's outside carbon is its own darker weave (`carbonTint` 0x5d626b, metalness 0.25, a softer clear coat; every other car's carbon is the same material as before): the splitter's top reads (92, 104, 106) in the front view by day against (132, 140, 137) before; end plates 0.22 x 0.10 m (were 0.36 x 0.20). The SIDE overlay shows no plank ahead of the nose.<br>5. ~~Side: intakeQ into the sheet's big scoop, about twice the area, the door crease feeding it, the sill LED clearly visible in SIDE.~~ **Done in M1b:** the scoop is a dark wedge from the door's rear edge (z 0.17 to 0.19 m, upright) down a diagonal to the skirt at z 0.98 m, between y 0.30 and 0.65 m: 0.179 m² in side view against 0.099 (1.8x), the door's scallop running into its front edge; the upper sill LED runs the skirt from z −0.95 to 0.92 m at 16 mm (was −0.55 to 0.15 at 8 mm), the foot LED 13 mm (was 10).<br>6. ~~Plan: the coke-bottle (0.84 m at the cabin, haunches 1.03-1.05 m); the haunch openings as the sheet's large dark teardrops; drop the finned rocket shapes and the cross-ribs.~~ **Done in M1b:** WP is 0.845 m from z −0.2 to 0.15 (0.925 before), 1.00 m over the front axle and 1.045 m over the rear; each opening is one teardrop (three overlapping convex masks: its point at 0.39 m out, z 0.64 m, by the canopy, widening to 0.215-0.77 m at z 1.36 m, its round end at 1.74 m); the dark channels along the canopy's base are gone, the silver cross-ribs are not built (`deckRibs` unset), and the twin fins moved out onto the haunches' crests (x 0.80 to 0.74 m, 6 cm tall).<br>7. ~~Rear: a recessed tail the silver haunches wrap round; no stepped corner notches; the red bar along the tail's upper edge, wrapping round the corners; structure under the wing.~~ **Done in M1b:** `ShapeParams.tailRecess`: the tail face has an opening from the valance's top (0.38 m) up to 7.5 cm under the tail's own upper edge (so it arches a little with the deck), 6 cm in from the sides; its silver walls lean in 3 cm to a gloss-black floor 0.10 m deep that carries the mesh, the plate and the reversing lamps (the flat black panel is gone). The rear low carbon drops from 70 % to 53 % of the side's height, so the side's carbon line meets the valance's top with no step. The bar is a ribbon 4 mm over the opening's top edge, following it, 8 mm lower over its last 6 cm, then 9 cm round each corner on the haunch's skin, narrowing to a third; the rear signals are its outer 0.26 m and the wrap. Under the wing, a louvred vent either side of the spine (x 0.15 to 0.37 m, z 1.74 to 2.12 m, six blades).<br>8. ~~Proof renders: the hero from the sheet's low camera; no mottled reflection tears; a darker canopy without white struts; hyper-vs-ref rebuilt with a matched hero overlay.~~ **Done in M1b:** the `hero-sheet` view in `test-car.ts` is the sheet's camera solved from six landmarks on its hero panel (13 px rms on 1774 x 460): 0.53 m up, 3.2 m out and 4.4 m ahead of the car's middle, a 58 degree horizontal lens; `&probeRes=` sets the probe's cube size for proof shots (512 here): the blotches then resolve as crisp reflections of the sound wall and the sky; what remains on the fang is facet shading where the face's step crosses the skin's quads (not fixed). The canopy: the hypercar's glass absorbs 0.86 with 0.7 reflection (was 0.62 and 1.0, shared) and its A-pillars are gloss black (a mask), so no silver strut shows. `tests/out/preview/m1b/hyper-vs-ref-m1b.png` and the hero overlays `hero-overlay-m1b.png`, `hero-sheet-ours-overlay-m1b.png` (no hand alignment: the frame scaled 1.848x and cropped to the panel).<br>9. Details: un-clip the caliper's OC mark (or drop it). ~~Round off the square wheel-well opening.~~ ~~Lift the front and rear views' paint toward the sheet's light silver.~~ **Partly done in M1b:** the arches follow the circle down to the axle and drop straight to the sill from there (`archRound`: the cut at the radius, not at the circle's chord through the sill), so the opening is round over the tyre; the paint's metalness 0.3 → 0.06 and its sky reflection 1.2x: the median silver in the front view (1.0 m camera) is (149, 160, 178), was (137, 143, 149) in M1's render; the sheet's FRONT (152, 163, 185); the rear (111, 124, 144), was (93, 109, 131). **Not done:** the caliper's OC mark is drawn in `src/preview/car-wheel.ts`, which belongs to another session's pass (the wheels): handed over in `PROJECT_OC_HANDOFF.md`.<br>10. ~~Re-run the same evidence.~~ **Done in M1b:** §10's table (27 / 250,370 high, 27 / 118,080 phone); the other four cars' body geometry hashes identical to HEAD's and their lineup pixels identical; tsc on both configs, the build, `node tests/dynamics.mjs` and the suite groups (logged in `PROJECT_OC_PROGRESS.md`). | The same renders as M1, each beside its reference crop, judged again by the art lens; the other four cars pixel-unchanged; budget inside §10. Groups `boot`, `render`, `phone` |
| **M2 Lights and cockpit** (done, committed 2026-11-09) | LED material and strips (splitter, sills, diffuser, wing plates), the blades, the red bar (brake-lit through `mats.tail`), headlight beams moved to the blades, bloom on High and Ultra; interior `'hyper'` (Corsa buckets, display binnacle, pressure gauge, ambient strip). Optional tyre lettering in our own text.<br>**Built 2026-10-20 to 21** (logged in `PROJECT_OC_PROGRESS.md`; still a procedural model built in code). The blades are the face's main feature (M1b item 2, ticked there). The two headlamp beams start 55 % of the way out along each blade (±0.72, 0.49, −2.25 m: `CarBody.beamAt`); the road pool they leave is the game's painted strip, as for every car, fading in from under the nose (2 m ahead of the centre, painted for lamps 1.24 m apart; the blades' beams are 1.43 m apart) to 40 m. The red bar brightens on the brakes through `mats.tail` at its own levels, 0.5 as a tail light and 6 on the brakes (`lampMaterials('blade')`, read by `PlayerCar` from the material's `userData.levels`; every other car keeps 1.6 → 5), and while braking a red haze spreads round it (`brakeGlow`: one additive quad, two triangles, a draw call only while lit), because a 2 cm bar is a pixel or two tall from the chase camera and its own level hardly shows there. Turn signals: amber over the upper two thirds of each front corner LED and over the bar's outer 0.26 m, flashing at 1.5 Hz while the car crosses toward the next lane (sideways faster than 0.6 m/s for 0.2 s above 6 m/s, held 1 s) or while the front wheels are steered past 0.12 rad under 12 m/s (a turn). Reversing lamps either side of the plate. The signals, reversing lamps and haze are built hidden and switched by visibility (`SWITCHED_LAMPS`), so they cost nothing until lit. Bloom is the game's existing High/Ultra pass. Interior `'hyper'`: the Corsa's buckets, roll hoop and Alcantara wheel with ice-blue stitching and rim stripe, blue harnesses, an ice-blue ambient line along the dash and both door cards, the OC badge on the wheel's boss and "O C" on the tachometer, and a gauge pod on the dash kept for M5's tank gauge (`Cockpit.gaugeAt`); no rear-view mirror (it would hang across the road under the low header). The driver sits 0.20 m lower and 0.10 m further in (`seatOffset`; eye (−0.27, 0.96, 0.10) m, decision 1 in §12), replacing the drive branch's temporary `HYPER_EYE`; the hood camera sits at 0.85 m (`hoodY`). Changed from this row's plan: the binnacle stays the Corsa's tachometer, and the pressure gauge's face is M5's. Not built: the optional tyre lettering | Night and sunset renders: beauty, rear, chase, seat, dash. In-game frames: braking raises the bar (emissive 1.6 → 5); beams on at night. Groups `render`, `phone`.<br>**Shown (2026-10-21, the blades as built):** in-game frames on High, I-405 North, owner mode, Free Drive (`tests/out/m2g/`, the left-hand signals in `tests/out/m2h/`): seat, hood, chase and a front three-quarter view by day and at night, braking against not braking (bar 0.5 → 6 and the haze; red pixels round the bar 136 → 704 by day, 192 → 885 at night), the signals in a lane change each way and the reversing lamps at night, beams and pool on at night. Preview renders (`tests/out/preview/m2g/`): front by day and at night, hero by day and at night, hood, and the sheet's FRONT over the render (`blades-sheet-vs-render.png`). The suite check `OC Hypercar: seat, beams from the blades, brake bar and haze, turn signals, reversing lamps (M2)` in `render`.<br>**Re-checked 2026-11-09** on the same code (the build byte-identical to 2026-10-21's): every in-game frame shot again (`tests/out/m2o/`: seat, hood, chase, front three-quarter and braking by day and at night, the right-hand signal and the reversing lamps at night; red pixels round the bar 134 → 691 by day, 191 → 929 at night), the preview's front by day and at night against the sheet (`tests/out/preview/m2o/blades-sheet-vs-render.png`); `npm test -- --only=render` 14/14 and `--only=boot,phone` 11/11; `node tests/dynamics.mjs` 1,742 passed |
| **M3 The fastest car: two tunes** (SEAT pass done, committed 2026-11-09: seat view, tyre spin per axle, tune chip, Free Drive earnings cap; see `PROJECT_OC_PROGRESS.md`) | `CarDef` with `unleashed` and `race` sets; `applyCar(c, tune)` latched at `start()`; new `SPEC` fields (brake gain, `Cf`/`Cr`, steering gain, collision box); HUD chip; garage card from measured numbers; the Free Drive earnings cap; the swept traffic collision; streaming at speed. **Blockers from M1, before the `CarDef`:** the seat drop must land first (the roof over the shared eye is 1.067 m, 0.093 m below it), and the narrow canopy puts its flank 0.06 m from the eye at x −0.37 m once dropped, so the driver should sit further in (the sheet's occupants are about ±0.25 m out). `PlayerCar.update` spins both axles at `vx / SPEC.wheelR` (0.345 m) while this car's tyres are 0.35 / 0.37 m: scale each axle's spin by `SPEC.wheelR / r` (§3) | A headless physics test (this document's harness, promoted to `tests/`) asserts: Unleashed ≥ §5.2's numbers and first on every metric; the race tune ≤ the Corsa on every metric at handling 0.35 and 1.0. In-game: Free Drive applies Unleashed (`SPEC.power` 1.5 MW); Races, Time Trial and Survival apply the race tune; nothing changes mid-run. The ten checks in §5.5. Groups `boot`, `race`, `survival`, `progression`, `interchanges`, and a new `hypercar` group |
| **M4 Driving profiles: Arcade, Sport, Simulation** | **Done 2026-11-09 (committed)** (§8.1; logged in `PROJECT_OC_PROGRESS.md`): the Settings profiles at the dynamics model's points (Arcade 0.15, Sport 0.5, Simulation 0.9), one line each, Custom off those points, a new player in Arcade; no physics changed. Planned as: named points on the handling slider (Arcade 0.0–0.35, Sport about 0.6, Simulation 1.0) with their assists shown; the stability control's yaw target scaled by the car's grip, so the rKin / (1 + 0.0009 v²) cap doesn't throttle a 1.2 g car | Each profile's 0-60, 100-0 and lateral g logged for all five cars and both hypercar tunes. No spins at 200 mph in Arcade (the existing claim) and at 300 mph on straights in the hypercar. Race tune still ≤ the Corsa in every profile |
| **M5 Cold Thrust, Ground Lock, Thrust Hop** | **Done (committed 2026-10-20 entry). Built 2026-10-20, repaired after review 2026-10-21, the repaired build re-verified 2026-11-09, the hop's planner retuned for play 2026-11-09** (§6.4; logged in `PROJECT_OC_PROGRESS.md`; as built in §6.2-6.4). Thrust force, fan suction, tank, airborne state, controls, jets, sound, HUD and cockpit gauge, the rules of §6 | `abilities`: thrust 0-60 ≤ 0.8 s; tank drains and refills to §6.1's numbers; off in race, time and survival, in a countdown and while paused; Ground Lock about 2 g at 25 m/s (≥ 1.85 g in Arcade) and at 40 m/s in Simulation (≥ 1.9 g), more than the tyres alone (Arcade's 1.81 g at 40 m/s is held by its steering lock, §6.3); a hop clears a parked sedan and a moving semi at set closing speeds with no contact and lands on the same path (path id unchanged, inside the lanes); in natural moderate traffic at least half the double-taps lined up 50 m behind a vehicle at +30 m/s (and 15 m behind a sedan at +15 m/s) go over it with 0 contacts on the same road, and at least 30 % of casual double-taps at 55 m/s are granted; refused under an overpass and a gantry. `phone`: the THRUST button's hold and double-tap at 390 × 844. Chase-view renders of the jets |
| **M6 Founder Edition exclusives** | **DONE 2026-11-09, committed** ✓ (§8.2; logged in `PROJECT_OC_PROGRESS.md`). Plaque (sill and console), reserved paint and LEDs, the wake-up sweep, the reveal stage, the run-card badge | Renders: the door sill and console (plaque reads "No. 0000 · TEST" in owner mode), the reveal stage, a run card. The reserved paint can't be chosen for another car. No real serials anywhere until the store's entitlement exists |

### 8.1 M4 as built (2026-11-09, committed)

**What it is.** Three named driving profiles in Settings, at the points the dynamics model already defines on the
handling slider (`PROJECT_OC_DYNAMICS.md` §3.9): **Arcade 0.15**, **Sport 0.5**, **Simulation 0.9**. Each button puts
the slider on its point; the slider anywhere else reads **Custom** (no profile pressed, a Custom line lit, "Between
Sport and Simulation: every assist scales smoothly with the slider"). Ticks under the track mark the three points; the
readout says "Arcade · 0.15". One line each, from what `Physics.ts` does at that point:

| Profile | The line in Settings | What the physics does there |
| --- | --- | --- |
| Arcade 0.15 | Strong stability and traction control, the most grip; forgiving past the limit. | Tyre μ 1.375; stability pull 4.25/s, slide bleed 1.59/s; TC holds the tyre's peak; falloff past the peak 4.7 %; steering lock ×1.05 |
| Sport 0.5 | Lighter stability control, 8% less grip; the rear can step out on the power. | μ 1.27 (−7.6 %); pull 2.5/s plus the race-mode pull past about 5° of slide, bleed 0.55/s; TC lets the rear flare (normalised slip 3.9); falloff 11 %; lock ×1.18 |
| Simulation 0.9 | Stability control only in a real slide, 16% less grip; the tyres let go past the limit. | μ 1.15 (−16.4 %); pull 0.5/s plus the race-mode pull, bleed 0.02/s; TC only catches a spin (5.15); falloff 18 %; lock ×1.32 |

**Where.** `src/game/settings.ts` (`PROFILES`, `PROFILE_IDS`, `profileOf`, `customLine`; the saved `handling` is
clamped to 0..1 on load), `src/ui/App.tsx` (`Handling`, in Settings → Driving), `src/ui/styles.css` (`.htrack`,
`.profiles`). The slider value stays the one saved setting the physics reads, so older saves load as they were and the
suite's hooks (`phys.handling`, the settings it seeds) work unchanged. The suite (`tests/regression.mjs`) takes
`SUITE_HANDLING`, checks Settings at 390 × 844 and 1280 × 720, and drives the hypercar's race tune in its survival and
race groups. The autopilot in `Game.ts` (the suite's driver and the menu's demo) lifts in a slide (below).

**One decision.** A new player now starts in **Arcade (0.15)**, so the first look at Settings shows a named profile.
The default was 0.35 (between Arcade and Sport), which `figures()` and §5's tables were measured at; a save made
before this keeps 0.35 and Settings shows it as Custom ("Between Arcade and Sport"). Reverting is one constant
(`defaults()` in `settings.ts`).

**No physics changed.** `Physics.ts` is untouched: the profiles are the dynamics model's own values. Weight transfer,
load sensitivity, ABS and traction control are that model's (merged from `claude/drift`). Anything deeper waits for a
vehicle-dynamics session (§9's queue). The plan's "grip-scaled stability control" was found already covered by the
model's `rCap = mu·g/max(5, v)` (`PROJECT_OC_DYNAMICS.md` §3.10). What still holds the Unleashed tune in Arcade at
40 m/s (1.81 g with Ground Lock, §6.3) is Arcade's steering lock and the `rKin / (1 + 0.0009 v²)` yaw target, both in
`Physics.ts`; changing them is for that session, not this milestone.

**Measured** (`node tests/dynamics.mjs`: 1,742 passed, 0 failed; the real `CarDef`s and both of the hypercar's tunes
through `tuneFor` with the harness's own scenarios, `tests/out/profiles/measure.mjs`):

| Profile | Car | 0-60 s | 0-100 s | top mph | 100-0 m | lat g 25 / 40 / 80 m/s |
| --- | --- | --- | --- | --- | --- | --- |
| Arcade 0.15 | Rossini GT | 3.25 | 5.88 | 209.1 | 74.8 | 1.18 / 1.00 / 0.60 |
| | Rossini Brio | 3.19 | 6.53 | 199.6 | 70.2 | 1.27 / 1.08 / 0.68 |
| | Rossini Corsa | 3.09 | 5.45 | 229.1 | 71.1 | 1.23 / 1.04 / 0.63 |
| | Vela E | 3.32 | 5.78 | 222.6 | 75.4 | 1.10 / 0.87 / 0.45 |
| | OC Hypercar, Unleashed | 2.20 | 3.75 | 337.9 | 56.1 | 1.58 / 1.44 / 1.05 |
| | OC Hypercar, race tune | 3.09 | 5.46 | 229.7 | 70.8 | 1.22 / 1.02 / 0.61 |
| Sport 0.5 | Rossini GT | 3.97 | 6.73 | 209.0 | 80.5 | 1.15 / 1.09 / 0.80 |
| | Rossini Brio | 3.69 | 7.03 | 199.6 | 75.6 | 1.23 / 1.17 / 0.89 |
| | Rossini Corsa | 3.71 | 6.33 | 229.1 | 76.3 | 1.20 / 1.15 / 0.84 |
| | Vela E | 3.95 | 6.64 | 222.6 | 81.4 | 1.10 / 1.01 / 0.63 |
| | OC Hypercar, Unleashed | 2.38 | 4.02 | 337.9 | 60.4 | 1.50 / 1.50 / 1.28 |
| | OC Hypercar, race tune | 3.70 | 6.33 | 229.7 | 76.2 | 1.19 / 1.13 / 0.82 |
| Simulation 0.9 | Rossini GT | 5.01 | 8.49 | 209.0 | 88.8 | 1.05 / 1.06 / 1.00 |
| | Rossini Brio | 4.59 | 8.07 | 199.6 | 83.1 | 1.13 / 1.14 / 1.07 |
| | Rossini Corsa | 4.71 | 7.98 | 229.1 | 84.0 | 1.10 / 1.12 / 1.04 |
| | Vela E | 4.99 | 8.35 | 222.6 | 89.8 | 1.03 / 1.00 / 0.78 |
| | OC Hypercar, Unleashed | 2.77 | 4.63 | 337.9 | 66.5 | 1.39 / 1.45 / 1.43 |
| | OC Hypercar, race tune | 4.71 | 8.03 | 229.7 | 83.8 | 1.10 / 1.11 / 1.05 |

- **No spins on the straights** (the harness's lane change at 1 s and 0.12 rad/s yaw shove at 4 s): every earnable car
  and the race tune at 201 mph, worst body slip 0.58-0.79° in Arcade, 0.73-1.04° in Sport, 0.89-1.34° in Simulation;
  the Unleashed tune (the real `CarDef`, all-wheel drive and vectoring) at 300 and 336 mph, worst 0.71 / 0.71° in
  Arcade, 0.87 / 0.88° in Sport, 1.02 / 1.05° in Simulation. After 7 s every run was at most 0.18° (the Vela E in
  Simulation; the Unleashed tune at most 0.15°).
- **The suite at each profile** (`SUITE_HANDLING=0.15|0.5|0.9 npm test -- --only=survival,race,phone`, the final
  build): 24/24, 24/24, 24/24. The survival and race groups now drive the hypercar's race tune too (a Survival streak in
  the seeded heavy traffic; a flat-out win of the Irvine Sprint) and check the run drove at the suite's handling;
  Settings is checked at 1280 × 720 (race group) and 390 × 844 (phone group). Images:
  `tests/out/settings-profiles-1280-{arcade,sport,simulation}.png`, `tests/out/phone-settings-arcade.png`,
  `tests/out/phone-settings-custom.png`, and `tests/out/profiles/settings-{1280,390}-{fresh,saved035}.png` (a new
  player against a save at the old 0.35).
- **Found by the proof: the autopilot spun the race tune out in Simulation.** The first suite run at 0.9 ended the
  hypercar's 45 s heavy-traffic Survival drive at 25.5 s: braking behind traffic to 27 m/s, then 0.85 throttle out of
  it, the tail stepped out (4° of body slip at 38 m/s; in Simulation the traction control only catches a spin) and the
  car walked a full lane right into a box truck while the autopilot held its lane. A probe of the same drive on more
  seeds (`tests/out/profiles/survival-probe.mjs`, before: `survival-probe-before.txt`): at 0.9 the race tune ended 3 of
  7 drives (worst slip 13-19° in the slides), the Corsa 1 of 6 (17.7°), the GT 0 of 7; at Arcade 0.15 the race tune
  0 of 6 (worst 1.3°). The car does what Simulation promises; the test driver didn't lift. The autopilot now eases off
  in a slide (throttle × 1 − 0.95·smoothstep(1.4°, 3.4°) of body slip), as a driver does. After: 29 of 29 drives ran
  the full 45 s with no contact, worst slip 3.3° (`survival-probe-after.json`); the Arcade drives came out identical
  to before (the lift never engaged). For play: in Simulation the race tune steps out on the power more readily than
  the Corsa (1,000 Nm on a 4.0 final against 820 Nm on 4.3: 13 % more torque at the wheels in each gear).
- **The race tune against the Corsa: not at or under on every number (found here, from M3, not fixed by M4).** It is
  0.6 mph over on top speed in all three profiles (229.7 vs 229.1) and 0.01 g over at 80 m/s in Simulation (1.05 vs
  1.04; at h 1.0 it is 1.15 vs 1.09); its 100-0 is 0.1-0.3 m shorter and its Sport 0-60 0.01 s quicker, at the
  harness's noise bounds. `tests/dynamics.mjs` reports this as an advisory (the same CarDef as its race-tune-like
  test car). A race CdA of 0.81 brings the top speed under in every profile (228.7-228.8 mph) and changes nothing
  else past noise; the Simulation 80 m/s figure did not move with CdA 0.81, ClA 0.95 or grip 1.03 (1.06 in each), so
  it needs a look at why the heavier race tune holds more at 80 m/s in Simulation than the Corsa. Queued for the
  tune's owner (§5.3: "if any measurement puts the race tune over the Corsa, it becomes the Corsa's numbers verbatim").

### 8.2 M6 as built (2026-11-09, committed)

**What it is.** The Founder Edition's exclusives, all built in code like the car (a procedural model, not a finished
3D asset). Nothing is sold and no owners are counted: the store branch sells the car and assigns the numbers.

| Exclusive | As built | Where |
| --- | --- | --- |
| The number | One function, `founderSerial()`, returns `null` until the store's `hypercar-founder` entitlement exists; every plaque, the garage card and the run card then print **"No. 0000 · TEST"** (`plaqueNumber()`; `plaqueLine()` is "FOUNDER EDITION · No. 0000 · TEST"). The store pass fills that one function; a real serial prints "No. 0042" | `src/game/founder.ts` |
| The plaques | Brushed aluminium, engraved and filled black: the OC mark, "OC HYPERCAR · PROTOTYPE 01", "FOUNDER EDITION" over a Founder Ice enamel line, and the number. One on the console lid behind the bridge (0.18 m, tilted 0.3 rad to the driver, reading from the seat), one on the driver's door sill cap at z −0.3 (0.14 m, tilted inboard, reading front to back as you look down to the left). The car has no opening doors, so the door's sill cap by the glass (what `cockpit.ts` calls the sill) is the sill a driver sees; a step-over kick plate would never be in view. Cost: one more draw call (the plaque material; the carbon plinths merge into the cockpit's carbon mesh), 604 triangles, one 1024 × 256 canvas (512 × 128 on the phone build) | `cockpit.ts` (`plaque` option), `car-tex.ts` (`plaqueTex`) |
| Paint and LEDs | Glacier Silver and Founder Ice, reserved (§7 row above). `car-shape.ts` and `cars.ts` take them from `founder.ts`; `Game.configureCar` passes the paint through `paintFor` | `founder.ts`, `car-shape.ts`, `cars.ts`, `Game.ts` |
| The wake-up sweep | One shared uniform (`WAKE`, the sweep's progress 0 → 1.1) on the hypercar's LED strips, headlamp blades and red bar only (`wakeable`, patched in `carMaterials` for the OC brand; no other car's shaders change). Each point lights at its phase from its position in the car's frame: the splitter from the centre out, the blades inner to outer, the corner and sill strips front to back, the diffuser and the wing plates, then the red bar from the centre out, each with a short flash as the front passes. A quarter second dark, then 1.2 s. It plays when the car is chosen in the garage (`applyCarChoice`) and on the start line (after the loading screen in `start` and `startRace`, so a race's grid sees it through the countdown). Reduced motion: the lights are on at once (read live from the media query) | `src/preview/car-wake.ts`, `car.ts`, `PlayerCar.ts` (`wake`, `wakeHold`), `Game.ts` (`wakeFounder`) |
| The reveal stage | At the top of the hypercar's garage card: a black stage with a wet-look clear-coated floor lit in a pool, an anodised turntable with a lathe-ringed top and a Founder Ice ring at its edge, 18 strip lights on a 12 m ring behind (one draw call) and a halo over the car, with a prefiltered environment made once from the same lights. The table turns the car from its rear three-quarter through its side to the hero front three-quarter (6.2 s, easing out) while the room comes up, the lights wake (from 0.9 s) and a light sweeps nose to tail (0.9-3.3 s: a moving spot, and a glint drawn across the card). It renders with the game's renderer into a corner of the game's canvas just before the frame's own render covers it, copied into the card's canvas; it renders only while it moves, then the card and the session keep the last frame (opening the garage again shows it without building anything). It plays by itself the first time on a device (`tsu.founderReveal`), then on demand ("Replay reveal"); choosing the car replays only the lights' wake at the hero angle. Reduced motion: the last frame, still. The card also says what only this car has and the founder window's date from `FOUNDER_UNTIL` ("Founder window to Dec 31, 2026 (Pacific)"); no "limited", no countdown, no counts | `src/preview/reveal.ts`, `Game.ts` (`openReveal`, `playReveal`, `closeReveal`, test hooks `revealState`, `revealHold`), `App.tsx` (`FounderStage`), `styles.css` (`.fe-*`) |
| The run-card badge | Cards from runs in the hypercar carry "OC HYPERCAR", an ice-blue "FOUNDER EDITION" badge, and the number with the tune ("No. 0000 · TEST · Unleashed" in Free Drive, "· Race tune" in the scored modes). `Result` now carries `car` and `tune` | `runCard.ts`, `Game.ts` (`runCar`) |

**Not done, honestly.**
- There is no paint picker in the game, so "never offered on another car" is held by the finishes list and `paintFor`,
  and checked by the suite; the preview page's `?paint=` developer override can still paint anything any colour.
- The stage's light sweep shows mostly as the glint across the card: the paint's look comes from the stage's static
  environment, and a moving reflection would mean re-filtering it every frame (not cheap), so it was left out. The
  stage has no bloom.
- Copying the game's canvas into the card in the same frame is standard WebGL behaviour and works in Chromium here; it
  was not tried on Safari or a real phone. No frame rates on real hardware were measured.
- The car on the stage still has M1's dark lower nose (the M1b fidelity pass is queued).

## 9. Physics: what exists, what each milestone adds, what waits

**What exists** (`Physics.ts`, 271 lines):

- A single-track model at 120 Hz.
- Static weight split 45 / 55 % front / rear with longitudinal load transfer (CG height 0.42 m).
- Downforce split 42 / 58 %.
- `tanh` tyres with a fall-off past the peak in Simulation.
- A friction circle at the driven rear axle and one on the front for braking.
- Traction trimmed in Arcade.
- ABS with a brake balance that keeps the rear from locking.
- A 7-speed dual-clutch with automatic shifts and a clutch-slip launch.
- Engine braking, drag and rolling resistance, grade.
- A kinematic blend below 6 m/s.
- The handling slider: tyre mu 1.315 → 1.12, steering lock +35 %, the stability control's strength.
- Arcade's stability control and Simulation's light race-mode version.
- Barrier collisions and traffic impulses (in `Game.simulate`).

**M3 adds parameters only:**

- `SPEC.brakeG`, per-car `Cf` / `Cr`, a steering gain on `maxDelta`, per-car `halfL` / `halfW`.
- The traffic contact made swept (or substepped) at high closing speed.
- `L` stays a module constant, because the centre-of-gravity positions don't change.

**M5 adds two force terms and a scripted state over the existing model, as tested in the scratch copy:**

- Thrust: `Fx += thrust` in the body's x.
- Fan suction: `Fzf += 0.45 × fan`, `Fzr += 0.55 × fan`, which feeds both the traction limit and the lateral
  capacity.
- An airborne state, scripted as in §6.4. While it lasts, `step()` skips the tyre forces, path switching and wall
  contact, and `PlayerCar` adds the hop height.

**M4** adds the three profiles (built 2026-11-09, §8.1: Settings only, no physics). The grip-scaled stability control was found already in the model (`rCap`, `PROJECT_OC_DYNAMICS.md` §3.10).

**Queued for a deeper vehicle-dynamics session** (Fable-class, the same work as the drift physics in the `tsu-drift`
worktree):

- Weight transfer with tyre load sensitivity (mu falling with load), lateral load transfer.
- Real ABS and traction-control models.
- **An all-wheel-drive split and torque vectoring.** The tri-motor's front motor would give the 1.5 s launch without
  the fans.
- Per-car centre of gravity and wheelbase (`L` read per car).
- An electric single-speed drivetrain.
- **The hop's free-flight version:** pitch and roll in the air, landing on any surface.

> **Fable prompt (queue it in `PROJECT_OC_HANDOFF.md` under "Fable queue").** Branch `claude/hypercar`, files
> `src/game/vehicle/Physics.ts`, `src/game/cars.ts`, `src/game/Game.ts`, `PROJECT_OC_HYPERCAR.md` §5 and §9. Extend
> the single-track model without changing any of the four earnable cars' measured numbers (§5.1's table, the control):
> an all-wheel-drive split with a per-car front share and per-axle friction circles, torque vectoring on the rear
> axle, tyre load sensitivity, per-car CG and wheelbase (`L` read per car), and an airborne free-flight state with
> pitch and roll for the Thrust Hop. Rules: the race tune must stay at or under the Rossini Corsa on every metric at
> handling 0.35 and 1.0; our own names only. Proof: the headless physics test (§5.1 and §5.3 numbers for every car,
> both tunes, both handling extremes), the `hypercar`, `abilities` and `race` suite groups, and a 300 mph lane change
> and a hop landing shown in chase-view frames. Log in `PROJECT_OC_PROGRESS.md`.

## 10. Performance budgets

Renders of `test-car.ts` at 960 × 540, side view, every figure read from the page's JSON line. "Own cost" is the car
shown minus the car hidden; "Scene" is the whole frame with the car shown. Both include the shadow pass. (The first
version of this table had a "Frame" column from the stage's last-frame `renderer.info`, which may or may not include
the shadow pass, so it didn't compare like with like; it is replaced by the scene totals.)

| Build | Own cost: calls / triangles | Scene: calls / triangles | Image |
| --- | --- | --- | --- |
| Corsa, `high` | 31 / 219,861 | 35 / 221,875 | `tests/out/preview/hyper-corsa-high-side-r2.png` |
| Corsa, `phone` | 31 / 114,157 | 35 / 116,171 | `tests/out/preview/hyper-corsa-phone-side-r2.png` |
| Hypercar, `high` (M1 repair) | 29 / 245,994 | 33 / 248,008 | `tests/out/preview/hyper-side-r2.png` |
| Hypercar, `phone` (M1 repair) | 29 / 125,756 | 33 / 127,770 | `tests/out/preview/hyper-phone-side-r2.png` |
| Hypercar, `high` (M2) | 29 / 246,566 | 33 / 248,580 | `tests/out/preview/m2i/hyper-side.png` |
| Hypercar, `phone` (M2) | 29 / 126,184 | 33 / 128,198 | `tests/out/preview/m2i/hyper-phone-side.png` |

Like for like, the hypercar costs two calls fewer than the Corsa on both builds and 11.9 % more triangles on `high`
(+26,133), 10.2 % more on `phone` (+11,599), inside the budget below on both.

M2 (2026-10-20 to 21): the blades add 572 triangles on `high` and 428 on `phone` over M1, and no draw call. Their
rebuild to the sheet on 2026-10-21 (inner tips at 0.45 m instead of 0.14 m) kept the same number of samples along
each blade, so the counts held; the M2 rows were re-rendered from that code (`m2i`). The switched lamps (turn
signals, reversing lamps, brake haze) are 4 calls and 48 triangles, drawn only while lit (every lamp lit: 33 /
246,614 in `tests/out/preview/m2i/hyper-chase-lit.png`, against 29 / 246,566 unlit). The Corsa re-rendered in the
same pass gives the table's numbers exactly (31 / 219,861, `m2i/corsa-side.png`, pixel for pixel the M1 render
`hyper-corsa-high-side-r2.png`; on `phone` 31 / 114,157 in the earlier M2 pass, `m2f/corsa-phone-side.png`).

The part budget for a car in `spec.ts` is `BUDGET.car`: 60 calls and 300,000 triangles.

**The hypercar's budget:**

- **High:** at most 40 calls and 260,000 triangles of its own (the Corsa + 30 % calls, + 18 % triangles).
- **Phone:** at most 36 calls and 135,000.
- **Where the extra goes.** New materials: the LED and red-bar emissives (2 calls), the plate (1). The rest reuses
  the Corsa's materials. Geometry: the split-spoke wheels (about +20 % wheel triangles), fins, vents, the bigger wing
  and plates, the sill blades.
- **LODs** are the two quality builds, `phone` and `high`. The player's car is never far from the camera, and the
  hypercar never appears as traffic: rivals use the `sports` traffic class.
- **Collision** is the physics box from the car's dimensions: halfL 2.36 m, halfW 1.02 m (`SPEC` per car, M3).
- **Measured, not assumed.** M1 logs the real numbers the same way, from the same view, on both builds (the table
  above). The in-game frame from the seat waits for M3: until the car has a `CarDef` the game can't drive it (today
  the whole player's car is logged at about 240k triangles in `PROJECT_OC_PROGRESS.md`).

## 11. The store side (for the `claude/store` branch; not built here)

Real money stays in test mode. This branch builds no purchase flow.

**The SKU: "OC Hypercar Founder Edition", $4.99, one time.**

- **Fees.** Stripe's standard US fee of 2.9 % + 30¢ takes $0.44, so we keep **$4.55**. An international card costs
  1.5 % more (7¢): $4.47.
- **Refunds and disputes.** A refund loses the $0.44. A dispute costs $15 plus the sale.
- **The price rule.** `PROJECT_OC_MONETIZATION.md` prices in whole dollars. $4.99 is the owner's choice, so that
  rule needs an exception line.

**The entitlement.**

- A grant `hypercar-founder` puts `oc-hyper` in the profile's vehicles outside the slot count, with the serial.
- The car can't be sold back for credits (that would turn dollars into credits).
- It's restored on sign-in, like every other item in that document.

**The serial number.**

- Assigned by the server, never the device: a per-SKU sequence written to the entitlement row when the payment
  webhook succeeds.
- It starts at 0001 and is never reused. A refunded number is retired, not reissued.
- No. 0000 is reserved for owner-mode testing.

**The founder window.**

- `FOUNDER_UNTIL` (one constant), checked when the checkout is created and in the webhook. A checkout created before
  the deadline and paid after it is honoured.
- On the 90-day calendar the store opens December 3 at the earliest, so this window is about four weeks, like the
  Founder Pack's.
- After the window the catalog item goes `available: false`, and owners keep everything.

**Things the store pass must reconcile:**

- **Two founder offers.** The $10 Founder Pack (sold to the same date) and this car. Keep the names, badges and
  paints distinct ("Founder '26" badge and "Founders Sunset" pearl vs "Founder Edition" plaque and "OC Founder
  Silver"), and say plainly that the pack doesn't include the car.
- **The hidden Vela E.** Hiding it from new players makes the catalog's Vela E Wheel Set unsellable to them.
- **The rule files.** `CLAUDE.md` on this branch still says "No real money"; the store branch changed that rule.

**The fairness note to add to `PROJECT_OC_MONETIZATION.md`** (its rule 3 says "No car faster than one you can earn
at your level" and "A car that is faster, grippier or quicker off the line than what you can earn at your level is
never sold"). Draft wording:

> **3a. The owner's two-tune rule (2026-10-16).** The OC Hypercar Founder Edition is the one car that is faster than
> anything you can earn, and only in Free Drive, where nothing is scored, timed or ranked. There it runs Unleashed:
> the highest top speed, the quickest launch and the most grip, downforce and braking in the game, and its own
> ability (Cold Thrust, Ground Lock, Thrust Hop). In every scored mode (Speed Survival, Races, Time Trial) it runs
> the race tune. The race tune is at or under the best car you can earn (the Rossini Corsa) on every measured number,
> and checked by a physics test at both handling extremes. Its ability is off there. Free Drive's distance earnings
> are capped at the race tune's top speed, so the paid car doesn't earn credits or XP faster. Its Free Drive runs and
> run cards are marked "Unleashed". So the no-pay-to-win rule holds wherever there is something to win.

## 12. Decisions for the owner

1. **The seat drop** (§3). Approve the 0.15 m drop for a 1.12 m roof, or keep the shared frame and a 1.25 m roof.
   *M2 (2026-10-20):* the cockpit needed a working driver's seat, and with the windscreen as built (its header 1.03
   to 1.05 m at the driver's x) a 0.15 m drop puts the header 2 to 6 degrees above the eye line, across the road at
   the horizon. So M2 seats this car's driver 0.20 m lower and 0.10 m further in (eye at (−0.27, 0.96, 0.10) m;
   header 8 to 13 degrees up, 0.12 m of headroom). It is one number (`seatDrop`); the other cars are unchanged. A
   1.25 m roof instead is still open to the owner, and would put the driver back on the shared frame.
   *SEAT (2026-11-09):* built to the 1.12 m roof. The driver also sits 0.10 m further forward (`seatFwd`; eye at
   (−0.27, 0.96, 0.0) m, 0.118 m under the headliner) and the windscreen runs up to z −0.10 m, so the header's lip lies
   42 degrees above the eye line, over the top of the seat camera's frame on a 16:9 screen and a portrait phone (it
   crossed a third of the way down the 16:9 frame before). Still one per-car offset (`seatOffset`), zero for every
   other car (`PROJECT_OC_PROGRESS.md`, 2026-11-09 SEAT).
2. **What "never sold again" covers** (§7): the Founder Edition's exclusives, or the car itself.
3. **Ground Lock on launch** (§5.2). The fans give the 1.5 s 0-60 until the AWD split exists. Or accept 2.2 s on
   tyres alone.
4. **The Free Drive earnings cap** (§5.5, item 10). Recommended, so a paid car doesn't earn faster.
5. **Owner mode in public builds** (§8, M0). Compiled out or account-gated before any real sale.
6. **The founder window's length** if the launch calendar moves (the store doc's same question for the Founder Pack).
