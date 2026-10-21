# Freeway guide signs: implementation spec for the realism-2 lane (FW signs)

Branch `claude/realism-2`, worktree `tsu-ref`. Files you own for this: `src/game/textures.ts` (sign drawing), `src/game/world/Roads.ts` (gantry, placement, update), `src/game/road/props.ts` (materials, new exports only where noted), `tests/regression.mjs` (new checks), `tools/oc-network/build.py` + `src/game/world/Network.ts` (item 7 only). Not yours: `src/game/Game.ts`, `src/ui/*`, `src/preview/test-car.ts` (render with it, never edit it). Every number below that is a *target* is to be proven by a render or a check you run; the baseline numbers come from the audit's shots listed at the end.

## Already done by the lane (checked on origin/claude/realism-2 @3784a68 and origin/claude/wip-ref @db4b3f0)

- Nothing sign-related. `sign()`, `fitText()`, `roundRect()` in textures.ts and `gantry()` / `signText()` / the 800 m + 260 m placement loop in Roads.ts are byte-identical to `claude/hypercar`. On wip-ref `sign()` sits at textures.ts:1036 (hypercar: 462) because the buildings (W1) and sound-wall tone work sit above it; `signText()` is at Roads.ts:559. wip-ref also rewrote Roads.ts walls (`wallTone`, `roadShading.ts`, `hash2`), so the anchors quoted below are function names, not line numbers.
- Baseline conditions on the stretch (I-405 North, `STRETCH = { label: 'I-405 North', ctrl0: 200, ctrl1: 270 }` in src/preview/spec.ts): Jamboree Rd EXIT ONLY gantry at s=1232 (62 m ahead from s=1170, 20 m from s=1212); John Wayne Airport 1/2 MILE gantry at s=2238 (58 m from s=2180). Baseline at s=1170 per the audit: 463 draw calls / 711k tris (q=high, 1280x720).
- The audit's counting script is `tools/signs-census.ts` (bundle and run as its header says). Its numbers: 416 signs (25 side L), 832 gantries, 122 signs with a dropped second destination, 73 of 396 consecutive exit pairs < 800 m, 29 gantry pairs < 120 m, 520 distinct exit textures + 14 through panels.

## Colours (sRGB hex you pass to the canvas / `Color.setHex`; linear values for any threshold you compute in a check)

| use | hex | linear RGB |
|---|---|---|
| guide green (FHWA green, Pantone 342) | `#006b4a` | 0.000, 0.147, 0.069 |
| legend white | `#f2f2ee` | 0.888, 0.888, 0.855 |
| EXIT ONLY yellow (FHWA yellow, Pantone 116) | `#f5c518` | 0.913, 0.558, 0.009 |
| band black | `#141414` | 0.007, 0.007, 0.007 |
| galvanised steel (new `P.mats.galvanised`) | `0x8d9196` | 0.266, 0.283, 0.305 |
| aluminium panel back | `0xb8bcc0` | 0.479, 0.503, 0.527 |
| luminaire glow | `0xfff1dc` | 1.000, 0.880, 0.716 |

The canvas texture stays `SRGBColorSpace` (`tex(c, true)`); the GPU linearises it. The legend white's linear 0.888 x emissiveIntensity 0.85 = 0.755 before tonemapping, which is why the 0.85 cap in item 3 keeps it under both bloom thresholds (Ultra 0.85 / High 0.92, Game.ts:621).

---

## Item 1 (impact 5, risk 2): Highway Gothic look-alike and a panel laid out in metres

**Where:** textures.ts `sign()` + a new `src/game/fonts/ocHighway.ts`; Roads.ts `gantry()` takes the panel size.

**Font.** Overpass Bold 700 (SIL OFL 1.1, the Red Hat face designed after Highway Gothic), Latin subset only (U+0020-007E, U+00BD "1/2" is drawn as text "1/2" so it is not needed, U+00E9 for "Peñasquitos"-style names is not in OC data; keep the subset to Basic Latin + U+00B0 + U+2013), woff2, base64 in a TS module exporting `OC_HIGHWAY_WOFF2_B64` (target 20-30 KB; subset with fonttools `pyftsubset --flavor=woff2 --unicodes=U+0020-007E,U+00B0,U+2013`). Keep the OFL text as `src/game/fonts/OFL-Overpass.txt`. Load once in textures.ts:

```
const face = new FontFace('OC Highway', `url(data:font/woff2;base64,${B64})`, { weight: '700' });
document.fonts.add(face); face.load().then(() => redrawSigns(), () => {});
```
`sign()` draws immediately with `700 Npx "OC Highway", "Saira Semi Condensed", Arial, sans-serif`; every cache entry keeps its canvas, spec and texture; `redrawSigns()` redraws every live entry and sets `texture.needsUpdate = true`. Set `g.letterSpacing = '0.06em'` guarded by `'letterSpacing' in g` (Chrome 99+; Firefox falls back to normal tracking, acceptable). Do not touch the Google Fonts link in `scripts/single-file.mjs` (not yours, and the UI still uses it).

**Layout in metres, 128 texels/m on high.** Cap heights: destination lines 0.6 m (lowercase x-height follows the face, roughly 0.45 m), cardinal word ("NORTH") 0.45 m caps, bottom text ("1/2 MILE", "NEXT RIGHT") 0.45 m caps, exit-tab text 0.4 m, line gap 0.3 m, margins 0.45 m all round. Canvas font px = cap_m x 128 / capRatio, where capRatio = Overpass cap height / em = 0.71 (measure once with `measureText('H').actualBoundingBoxAscent` at 100px and cache it; do not hard-code if the measurement is available). Panel width = widest line + 0.9 m, clamped to [4.5, 9.5] m; height = sum(line caps) + gaps + 2 x 0.45 (+ 0.9 m for the yellow band of item 2, + 0 for the tab which hangs above the panel inside the canvas: add 0.75 m of canvas height on top, transparent outside the tab). `fitText` squeezes only when a line exceeds 8.6 m. Canvas = ceil(width x 128) x ceil(height x 128), each rounded up to a multiple of 64, max 1216 x 640 (phone: item 5). `sign()` returns `{ tex, w, h }` in metres (new export `signPanel(spec)`; keep `sign()` as a thin wrapper for one release so nothing else breaks, then delete it).

**Border:** 0.05 m white stroke (6-7 texels), inset 0.04 m from the edge, corner radius 0.15 m. **Colours:** table above.

**Roads.gantry():** `new THREE.PlaneGeometry(panel.w, panel.h)` per panel; the panel's centre y = PANEL_BOTTOM + h/2 (PANEL_BOTTOM from item 4; until item 4 lands keep today's H + 0.55 - 1.9 + h/2 so the bottom edge stays where it is). The back box follows the same w/h + 0.1 m.

**Verify:** `node tools/preview-shoot.mjs src/preview/test-car.ts <out> --size=1280x720 --query="view=chase&s=1212&time=sunset&q=high"` (20 m) and `s=1170` (62 m); crop the panels at 2x and look: letterforms must read as Highway Gothic-like (round bowls, wide tracking, the Overpass "R" leg), the panel wrapped around the message with no empty lower half. Before/after of `crop-day-20m-signs-2x.png`. Also one shot at `s=1132` (100 m): the destination line must still be readable at 1280 px (0.6 m cap at 100 m in the 60 degree chase camera is about 6 px; if it is not readable, raise destination caps to 0.7 m and say so; do not go back to 0.82 m).

**Leave alone:** the chase camera, the `once()` cache for the other textures, `roundRect` (reused), `label()`.

## Item 2 (impact 5, risk 3): what Caltrans actually posts on the panel

**Where:** textures.ts `signPanel(spec)`, Roads.ts `signText()`, `gantry()`.

**Spec type** (textures.ts, exported):
```
export interface SignSpec {
  tab?: { exit?: string; left?: boolean };           // 'EXIT 5' tab top-right; left: 'LEFT' plaque, tab top-left
  shields?: { net: 'I' | 'CA' | 'US'; num: string; dir?: 'NORTH'|'SOUTH'|'EAST'|'WEST' }[];
  lines: string[];                                     // 1-2 destination lines, mixed case
  bottom?: { kind: 'exitOnly'; lanes: 1 | 2 } | { kind: 'text'; text: string };   // '1/2 MILE' | 'NEXT RIGHT' | '1 MILE'
}
```
**Drawing order, top to bottom:** tab (if any) -> shield row (shields 0.75 m tall with the cardinal word beside them, 0.45 m caps) -> destination lines -> bottom band. Shields: I = blue `#003f87` body with a red `#bf0a30` crown and the white number in 0.4 m caps (if the owner wants to stay clear of the AASHTO Interstate mark, draw a plain blue shield with no INTERSTATE band; default to plain); CA = green miner's-spade `#006b4a` outline white with white number; US = white shield, black number. Yellow EXIT ONLY band: full panel width, 0.9 m tall, `#f5c518`, legend "EXIT" [down arrow, 0.6 m tall, 0.12 m stem, 0.45 m head] "ONLY" in `#141414` 0.45 m caps; one arrow per exit lane, arrows at x = panel centre +/- 0.9 m for lanes=2. Exit tab: 0.75 m tall, width = text + 0.6 m, green with the 0.05 m white border, "EXIT 5" 0.4 m caps, top-right (top-left when left); drawn only when `tab.exit` is set. LEFT plaque: inside the tab, "LEFT" black on yellow, drawn even with no exit number (then the tab is the plaque alone).

**Roads.signText()** returns a SignSpec: keep up to **two** non-route labels (apply today's abbreviations), turn `/^(I|CA|US)\s+(\d+)\s*(North|South|East|West)?/i` labels into shields with `dir`. Exit panel: `{ shields, lines, bottom: 260 m -> { kind: 'exitOnly', lanes: 1 }, 800 m -> { kind: 'text', text: '1/2 MILE' } , tab: side L -> { left: true } }`. Through panel: `{ shields: [{ net: p.route.startsWith('I-') ? 'I' : 'CA', num: ROUTE_LABEL[p.route], dir: DIR_WORD[p.dir].toUpperCase() }], lines: [controlCity ?? p.name] }`.

**Control cities table** (Roads.ts, `CONTROL_CITY: Record<string, string>` keyed `${route}${dir}`). Ship these 12 as confident: I-5 N Los Angeles, I-5 S San Diego, I-405 N Long Beach, I-405 S San Diego, SR-55 N Riverside, SR-55 S Newport Beach, SR-57 N Pomona, SR-57 S Santa Ana, SR-22 E Orange, SR-22 W Long Beach, SR-91 E Riverside, SR-241 N Riverside. Verify before adding: SR-91 W, SR-73 N/S, SR-133 N/S, SR-241 S, SR-261 N/S (Caltrans posted signs or the OSM `destination` tags on each freeway's continuation way); until verified the through panel shows `p.name` as today. Put the source of each verified row in a comment.

**Verify:** `s=2180` (John Wayne Airport / MacArthur Blvd on one panel, "1/2 MILE" bottom text), `s=1212` (yellow EXIT ONLY band with one arrow over the exit lane, Jamboree Rd), and the through panel in the same frames reading shield + NORTH + "Long Beach". Add a regression check in the `render` group (or a new `signs` group, which is cheaper to run alone) that calls `signText(['John Wayne Airport','MacArthur Boulevard'])` through `window.__game` or a direct import and expects `lines.length === 2`, and `signText(['CA 55 North','Riverside'])` to give a CA shield with dir NORTH.

**Leave alone:** `Network.ts` types until item 7; the ramp/side logic; `DIR_WORD`, `ROUTE_LABEL`.

## Item 3 (impact 5, risk 3): night: retroreflective legend, dim field, lit structures

**Where:** Roads.ts `gantry()`, `update()`, new `setNight()`; props.ts only for `lampHead` reuse.

**Material** per face (one per gantry after item 5's atlas): `new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.55, metalness: 0 })`. Keep `this.gantries: { x, z, nx, nz, mats: MeshStandardMaterial[], lit: boolean, lamp?: MeshStandardMaterial }[]`; `gantry()` pushes, `drop()` removes (store the entry on `holder.userData.gantry`). Sign normal: in the holder frame +z faces the oncoming driver; with the holder rotated by `pt.h + PI`, world normal = `(nx, nz) = (sin(pt.h + PI), cos(pt.h + PI))` in the same convention `p.sample()` uses for heading (check it against `hx, hz` passed to `update()` by printing the dot product for the s=1232 gantry when the car is at s=1212: it must be about -1).

**Per frame in `update(x, z, hx, hz)`** (the gantries array is a few dozen entries; no allocation):
```
dx = gx - x; dz = gz - z; d = hypot(dx, dz); tx = dx / d; tz = dz / d;
cone     = smoothstep(0.80, 0.94, tx * hx + tz * hz);          // the headlamps' beam
entrance = max(0, -(tx * nx + tz * nz));                       // the sign faces the car
range    = smoothstep(420, 60, d) * (0.35 + 0.65 * smoothstep(10, 45, d));   // observation-angle roll-off near the sign
retro    = cone * entrance * range;
litFloor = lit ? 0.12 : 0.03;                                  // lit = hash of the gantry's s, about one in two
mats[i].emissiveIntensity = min(0.85, dark * (0.85 * retro + litFloor));
if (lamp) lamp.emissiveIntensity = lit ? 0.6 * dark : 0;       // luminaire heads, colour 0xfff1dc (per-gantry material, not P.mats.lampHead(), which Game.ts drives)
```
`smoothstep(a, b, x)` with a > b must be the descending form (use `1 - smoothstep(b, a, x)`); the file already has `smoothstep` and `clamp` imported.

**Night factor.** Add `setNight(dark: number)` (0 day .. 1 night). The one-line call `this.roads.setNight(dark)` belongs next to `this.roads.setWet(e.wet)` in Game.ts `weatherTick()` (Game.ts:959-960, where `dark = 1 - e.daylight` is computed): Game.ts is not yours; put the request in your not_done / log entry for the coordinator. Until it lands, derive inside `update()` once per second: find the scene's `DirectionalLight` through `this.group.parent` (cache the reference after the first traverse), `dark = 1 - clamp(light.intensity / 3.1, 0, 1)`; `setNight()` overrides the fallback when it has been called at least once.

**Verify:** `view=chase&time=night&bloom=1&head=night&lit=1&q=high` at `s=1132` (100 m), `s=1170` (62 m), `s=1212` (20 m): white legend bright at 100 m, field dim green, no halo at 20 m. **Regression check** (new, in `tests/regression.mjs`, your file; put it in a `signs` group so it runs alone): sample the night frame at 20 m and at 100 m by reading back pixels through `window.__game` (render target or `canvas.toDataURL` of the composer output): legend luma in [0.45, 0.85] at 100 m; the panel field's luma below the legend's; at 20 m with bloom on no sign pixel above 0.9. Rect positions: derive from the projected panel corners (project the face's world position with the camera) rather than hard-coded pixels, so the check survives camera changes.

**Leave alone:** `P.mats.lampHead()` (Game.ts sets its emissive every frame for the street lights), the bloom pass, the headlamp levels in PlayerCar.

## Item 4 (impact 4, risk 2): a Caltrans box-truss structure

**Where:** Roads.ts `gantry()`; props.ts gains `galvanised` (new export only).

Height layout (changed from the audit's 6.4/7.9 so the walkway clears the panel face and keeps 5.64 m / 18'6" over the lanes): bottom chords centre y = 6.0 m, top chords 7.5 m, front/back chords 1.5 m apart (box 1.5 x 1.5 m), chord r 0.10 (CylinderGeometry, 8 segments), diagonals r 0.045 (6 segments) on all four faces, panel length 1.5 m, alternating direction, verticals r 0.045 at every panel. Posts: CylinderGeometry r 0.30, 10 segments, from the pedestal top to the top chord, at `p.wallL - 1.2` and `p.wallR + 1.2`. Pedestal: BoxGeometry 1.0 x 0.6 x 1.0 (concrete material, second mesh, bottom at pt.y - 0.1), base plate 0.9 x 0.05 x 0.9 on top with four 0.08 m bolt stubs (r 0.04, h 0.08). Walkway: 0.9 m wide, 0.05 m thick plane under the front bottom chord, top at 5.85 m, along the span between the posts; a 64x64 grate alpha texture (new `T.grate()` in textures.ts: 2-texel bars on a 8-texel pitch, both directions), `alphaTest 0.5`, `DoubleSide`, galvanised colour; handrail 1.07 m above the grating: two rails r 0.025 (at 0.55 and 1.07 m) with posts r 0.025 every 2.0 m. Panels: **bottom edge at 6.1 m**, face 0.3 m in front of the front chords' front face, extruded aluminium back 0.04 m behind the face (0xb8bcc0, metalness 0.5, roughness 0.6) with three horizontal Z-bar channels 0.08 x 0.08 m along the back; merge the backs into the galvanised mesh if you use one material for both (then the back is galvanised grey, acceptable) or keep one `aluminium` mesh. Luminaires: per panel two heads 0.45 x 0.15 x 0.2 m on 0.6 m arms (r 0.03) off the walkway front edge, head top 0.3 m below the panel bottom, under the panel's left and right thirds; material: a per-gantry `MeshStandardMaterial({ color: 0x3c3f44, metalness: 0.6, roughness: 0.4, emissive: 0xfff1dc, emissiveIntensity: 0 })` driven by item 3 (one material shared by both heads of the structure, disposed in `drop()`).

**Material:** props.ts `galvanised: () => once('m.galv', () => new MeshStandardMaterial({ color: 0x8d9196, metalness: 0.55, roughness: 0.6 }))`. Use it for the truss, posts, base plate, bolts, handrail. Leave `metal` as it is (light standards).

**Budget:** 1,800 to 2,500 tris and 3 to 5 draw calls per structure (galvanised merged mesh, concrete pedestals, grating, luminaire heads, one atlased face). **LOD:** wrap the structure in a `THREE.LOD`: full truss within 300 m; beyond, a reduced mesh (chords, posts, panels, no diagonals, handrail or luminaire geometry, about 500 tris). On `q=phone` use the reduced mesh at every distance plus the walkway plane (no handrail). Keep `castShadow` on the galvanised mesh and the faces only.

**Verify:** day shots at `s=1212` and `s=1170` and the printed JSON of preview-shoot: at most +5 draw calls and +5,000 tris on the s=1170 frame against the audit's baseline (463 calls / 711k tris); the crop must show a four-chord box, round posts, pedestals, the walkway grating and handrail, with no specular "chrome" edges in the day shot. Run the `render` group once.

**Leave alone:** `P.lightPoleSingle`, `P.lampHeadSingle`, `P.mats.metal`, the end-wall crash cushion, the wall geometry (wip-ref is editing it; take `p.wallL / p.wallR` as they come).

## Item 5 (impact 3, risk 2): texture lifecycle and phone resolution

**Where:** textures.ts (new `signAcquire(spec)` / `signRelease(spec)`), Roads.ts `gantry()` / `drop()`.

Separate sign cache keyed by `JSON.stringify(spec)` with `{ tex, canvas, w, h, refs }`; `signAcquire` increments, `signRelease` decrements and, at zero, moves the entry to a 24-entry LRU (Map insertion order); evicting from the LRU calls `tex.dispose()`. One canvas per gantry (atlas): draw the gantry's panels side by side with a 16-texel gutter, the face mesh is one PlaneGeometry per panel sharing one material (set UVs per panel), so a two-panel structure is one texture and one draw call. Resolution: 128 texels/m on high (max 1216 x 640 per panel, so a two-panel atlas is at most 2448 x 640), 64 texels/m on phone (max 608 x 320; a 0.6 m cap is still 38 texels). Keep `generateMipmaps` and `anisotropy = ANISO` (what `tex()` already sets); `configureTextures()` already knows SIZE, read it to pick the density (`SIZE <= 512` -> phone). Store the spec key on `face.userData.signKey`; `drop()` releases it after disposing the material. The redraw-on-font-load of item 1 iterates this cache.

**Verify:** a check in the `signs` group: 60 s of autopilot (`fastForward`) across three exits on I-405 North from the preview stretch; `renderer.info.memory.textures` at the end within +6 of the start (the LRU holds up to 24, but those are counted only once drawn; measure before and after and print both). Plus `q=phone` at `s=1212` still readable (look at it).

**Leave alone:** `once()` and `tex()` themselves; the other textures' SIZE logic.

## Item 6 (impact 3, risk 2): one structure for closely spaced exits

**Where:** Roads.ts constructor (after `signsBy` is filled), `buildChunk()`.

Plan per path once: for each sign, candidates at `s - 800` (1/2 MILE) and `s - 260` (EXIT ONLY); sort by s; walk in order and when a candidate lands within 150 m of an earlier kept structure on the same path, drop it and add its panel to that structure: if the dropped one is the 1/2 MILE panel of the *next* exit sitting on this exit's EXIT ONLY structure, its bottom becomes `{ kind: 'text', text: 'NEXT RIGHT' }` (side L: 'NEXT LEFT'); if the distance from the kept structure to that next exit is 1,400-1,800 m, use '1 MILE' instead; otherwise keep '1/2 MILE'. Keep the `s < 30` guard. Store `this.gantryPlan: Map<pathId, { s: number; panels: { sign: Sign; spec: SignSpec; lane: number }[] }[]>` and have `buildChunk()` place the entries with `s0 <= s < s1`. A structure never carries more than three panels (through + two exits); the third panel sits over the next lane inward.

**Verify:** extend `signs-on-stretch.ts` to print the pairs closer than 150 m with their path label and s (there are 29 under 120 m); pick one on a main (prefer I-405 North if any falls on the preview stretch, else change `s` in the chase query to reach it on another freeway through `&cam=&at=` or a temporary stretch) and shoot before/after: one structure where there were two, the second exit's name on it with NEXT RIGHT. Also print the planned structure count network-wide (expect 832 minus roughly the 29-73 merged).

**Leave alone:** `Sign.s` and `Network.signs` (the plan is derived, the data is not changed).

## Item 7 (impact 5 data half, risk 3; separate, needs network): exit numbers and label types

**Where:** `tools/oc-network/build.py`, `src/game/world/Network.ts` (`RawSign` gains `ref?: string; sym?: string[]`), `src/data/oc-network.json` rebuilt.

build.py: keep Overture's `destinations.labels[].type` (street | country | route_ref | toward_route_ref | unknown) and `symbols` (airport, hospital, ...) per sign; fetch OSM `junction:ref` with one Overpass API bbox query over OC (`node["highway"="motorway_junction"]["ref"](33.38,-118.12,33.95,-117.41)`, about 500 nodes, ODbL like the rest; cache the response in `tools/oc-network/cache/`), match each sign's diverge node to the nearest junction node within 30 m, write `ref`. The exit tab draws only when `ref` is present; the airport glyph (a simple white plane silhouette 0.5 m) draws before the destination when `sym` has `airport`. Credit stays OSM/Overture (already in the menu credits; nothing new to add unless the Overpass instance's terms ask for it).

**Verify:** `python -I` count of signs with refs after the rebuild (expect most of the 416; report the exact number), and the `s=1212` shot showing the Jamboree Rd tab with its real exit number only if the data has it (I-405 Jamboree Rd is exit 5 in the real world; print what the data says, do not hard-code it).

**Leave alone:** the path geometry and junction snapping in build.py; everything else in the JSON.

---

## Order and gates

1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7. After each item: `npm run typecheck`, the one render that proves it (one at a time, `--timeout=900`), look at the PNG, then one suite group (`npm test -- --only=signs` once it exists, `--only=render` after item 4 and at the end). Commit per item on `claude/realism-2` with the required trailer. If a group fails, re-run it once; if it fails the same way on the unmodified base, say so. Nothing in this spec touches Game.ts, src/ui, PlayerCar or the road surfaces.