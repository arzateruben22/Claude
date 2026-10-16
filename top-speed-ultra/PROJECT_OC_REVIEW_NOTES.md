# Project OC: review notes

## 2026-10-16: review of the day's agent work (unverified)

Two read-only review lenses read the diff `04fdb17..6bacdd9` on `claude/always-on` and the live-mirror commit
`368cd01` on `claude/ref-pass`: **phone cost and memory**, and **correctness and robustness**. The third lens
(rules, honesty and docs), the two sceptics meant to try to refute each finding, and the completeness critic were
stopped by the account's limit, so **every finding below is unverified**: treat each as a claim to check against
the code before acting on it. No finding was rated above severity 3; the one severity-3 item (phone-1) is the
first to check.

What the lenses checked and found sound is worth recording too: the beam pool is allocation-free per frame and
follows the floating origin (it is a child of the car's root, re-laid each frame); the people builder's rounds add
no SDF primitives (build cost flat); the mirrors are only built on High and Ultra on a device with a fine pointer,
are disposed on every rebuild, skip GTAO's override pass and don't re-render shadows; the autopilot's new lane rule
cannot latch or count a car two lanes over; the suite's longer action timeout cannot mask a failure (every check
asserts explicitly); no new TypeScript casts; no rule breaks found in the changed code.

**Next:** the overnight session runs the refuters and the rules lens (`PROJECT_OC_HANDOFF.md`, Fable queue), then
fixes what survives; the low-risk ones (phone-6, correctness-6, correctness-8) are routine and can go to a daytime
session as they are.

## Findings, by severity

### phone-1: Low/Medium pay for two per-fragment SpotLights at night, and their visibility toggle recompiles every lit program at dusk

- **Where:** `src/game/vehicle/PlayerCar.ts:207`
- **Severity / confidence:** 3 / 0.75
- **What:** setHeadlights() still drives two THREE.SpotLight objects on every quality tier (`b.visible = on > 0.02; b.intensity = on * 70`). The commit moved the visible road lighting to the painted pool and says the spots now only reach 'traffic and walls', but nothing gates them on `cfg.quality`. three evaluates every visible spot light in the fragment loop of every MeshStandard/MeshPhysical material (roads, terrain, walls, traffic, car, cockpit), whatever the light's `distance`, so Low/Medium phones pay two extra spot evaluations per lit fragment all night for a subtle effect. The same line flips `visible` from false to true as `on` crosses 0.02, which changes the renderer's lights-state hash and forces a new program (shader compile) for every lit material the first time it happens in a session.
- **How it fails:** Low preset, night (or weather crossing the fog/rain gloom thresholds): gloom passes ~0.41, both spots become visible in one frame, every lit material compiles a 2-spot-light variant (tens to hundreds of programs; a multi-hundred-millisecond to multi-second freeze on a mid-range phone, the same hitch the notes already see as 'minutes' in SwiftShader on High), and from then on every lit fragment carries the two spot evaluations until dawn.
- **Proposed fix:** On the 'phone' tier keep the beams permanently invisible and rely on the painted pool plus the lamp emissive (e.g. `b.visible = on > 0.02 && this.cfg?.quality === 'high'`); on 'high', either keep them always visible with intensity 0 (one program variant, no dusk recompile) or precompile the lit variant at load with `renderer.compile()` while the beams are visible.

### phone-2: The hands' per-frame pose solver allocates ~30 objects a frame on every tier

- **Where:** `src/preview/hands.ts:158`
- **Severity / confidence:** 2 / 0.9
- **What:** `pose()` runs every frame from PlayerCar.updateCockpit → setWheelAngle. Per side per frame it allocates: `new THREE.Vector3(0, 0, 1)` (line 151, once per call), `s.hand.quaternion.clone()` (158, added by the pose commit), `s.wristW_m.clone()` (159), the `[wrist.x, wrist.y, wrist.z]` array plus the ~8 V3 arrays `reach()` builds via sub/norm/madd/perp (160, hands-sdf.ts:382-389), `new THREE.Vector3(...r.shoulder)` and `new THREE.Vector3(...r.elbow)` with array spreads (161), and `new THREE.Quaternion()` for the twist (170). That is roughly 30 short-lived objects a frame at 60 fps on all tiers, phone included.
- **How it fails:** Driving at the seat on Low on a phone: ~1,800 small allocations a second from the hands alone, which is steady minor-GC pressure (periodic 1-3 ms pauses on a mid-range Android) for a solver whose outputs are two bone transforms.
- **Proposed fix:** Hoist scratch objects into the buildDriverArms closure (a Z-axis Vector3, two Quaternions, two Vector3s for S and E, a reusable wrist Vector3 and a wrist array) and have `reach()` write into caller-supplied arrays or Vector3s instead of returning fresh ones.

### correctness-1: Headlights still snap on at the rain and fog boundaries; only dusk is ramped

- **Where:** `src/game/Game.ts:825`
- **Severity / confidence:** 2 / 0.9
- **What:** gloom is built from two step terms, `e.visibility < 0.3 ? 0.6 : 0` and `e.wet > 0.5 ? 0.5 : 0`, and only then passed through smoothstep(0.35, 0.8). Environment lerps `wet` and `fogFar` continuously (Environment.ts:176), so the smoothstep ramps nothing at those boundaries: gloom jumps 0 -> 0.5 or 0 -> 0.6 in one frame and `on` jumps 0 -> 0.26 (rain) or 0 -> 0.58 (fog). The comment on line 826 ('a ramp, not a switch') is only true for the day/night term.
- **How it fails:** Daytime, weather 'changing' (or switch clear -> rain in Settings mid-drive): as `e.wet` eases past 0.5 the two SpotLights go from visible=false to intensity 18 cd and the pool from invisible to 9 % in a single frame; the light count changing also forces a shader recompile of every lit material on that frame (a hitch, long in SwiftShader). Fog by day pops to 58 %. The pre-change code had the same step, so this is a claim not met rather than a regression.
- **Proposed fix:** Make the weather terms continuous before taking the max, e.g. `gloom = Math.max(dark, 0.6 * smoothstep(0.45, 0.2, e.visibility), 0.5 * smoothstep(0.3, 0.7, e.wet))`, so the beams and pool fade in over the weather's 2.5 s time constant.

### phone-3: Skin shader on the 'phone' tier now does 16-18 noise lookups and up to 3 cell searches per fragment, most of the age work for every NPC regardless of age

- **Where:** `src/onfoot/people/skin.ts:258`
- **Severity / confidence:** 2 / 0.85
- **What:** Counting the fragment code after preprocessing (script in scratchpad): the phone body tier went from 11 vnoise/0 cells per fragment to 16 vnoise/0 cells unconditionally (+2 vnoise, 1 cells inside `if (uAge > 0.02)`); the phone face tier from 11 vnoise/2 cells to 18 vnoise/3 cells unconditionally (+4 vnoise, 1 cells when aged). Each `cells()` is a 27-cell loop of hh33 + dot. The forehead/neck furrow chain (`drift`, `li`, `seg`, `lines`: 4 vnoise, lines 258-262), the crow's-feet fan (2 vnoise, lines 246-256) and the age-spot `cells(hp * 0.11 + 4.0)` (line 197) all run outside the `uAge` branch even though their results are multiplied by `uAge` (`crease` at 263, `spot` at 198) and are exactly zero for anyone 25 or younger. `mid3`/`mid` only scale results, they do not skip work. Note: the people builder is not in the game bundle today (only src/onfoot/test-people.ts imports it), so no player pays this yet; it will when on-foot ships to phones.
- **How it fails:** A young NPC at LOD 0 filling a third of a portrait phone screen: ~300k fragments each run 6 wasted vnoise and one wasted 27-cell search (roughly a third of the shader's noise cost) that end as zero; aged NPCs pay the same plus the branch. On a mid-range phone GPU this is in the order of a couple of milliseconds a frame per close NPC, on top of the SSS lighting.
- **Proposed fix:** Move the furrow chain, the crow's-feet fan and the age-spot `cells` inside the existing `if (uAge > 0.02)` block (uniform branch, free when false) and set `crease = 0.0` there otherwise; consider gating the crow's feet on `mid3 > 0.001` like `crepe` already is.

### correctness-2: Live mirrors' alternation depends on both being drawn every frame; the door mirror is often culled

- **Where:** `src/preview/car-mirror.ts:84`
- **Severity / confidence:** 2 / 0.8
- **What:** (claude/ref-pass, 368cd01) Each CarMirror keeps its own `frame` counter and advances it only when its onBeforeRender runs (`if ((this.frame++ % every) !== phase % every) return;`). An object that is frustum-culled never reaches onBeforeRender, so its counter stalls while the other mirror's keeps counting. The rear-view (phase 0) and door mirror (phase 1) therefore alternate only as long as both are inside the main camera's frustum on every frame.
- **How it fails:** Desktop High, landscape, cockpit view: the driver's door mirror sits at or past the left edge of the 58-degree view and leaves the frustum whenever the driver looks right or straight ahead at speed (look yaw, speed FOV). Each time it drops out for an odd number of frames and comes back, its parity now matches the rear-view's: both nested scene renders land on the same frame, then none on the next, i.e. 3 scene renders / 1 scene render alternating (a 2 Hz frame-time sawtooth) instead of the claimed 'one extra low-resolution render a frame'.
- **Proposed fix:** Drive the phase from one shared counter rather than per-mirror: e.g. a `static tick` on CarMirror advanced once per game frame (call `CarMirror.tick++` in Game.frame before render) and test `(CarMirror.tick % every) === phase`.

### correctness-3: Beam pool is laid along +s and pitched by a factor that never flips, so a car facing against the path gets the wrong profile

- **Where:** `src/game/vehicle/PlayerCar.ts:235`
- **Severity / confidence:** 2 / 0.7
- **What:** `layPool` samples `path.height(s + k)`, i.e. k metres further along the path, and tilts the rows by `this.root.rotation.x`. That pitch (line 200) is `atan(p.slope) * cos(psi - p.psi)`, where `psi` is the interpolated heading and `p.psi` the current physics heading, so the cosine is ~1 always; it was evidently meant to be the heading relative to the road (`p.roadH`, Physics.ts:214) so the pitch inverts when the car faces down-path. Pre-existing for the body pitch, but the new pool makes it a visible error: for a reversed car the rows take the heights of the road behind it and are pitched the wrong way.
- **How it fails:** Night, spun 180 degrees after a wall hit on a graded ramp (the 73 through the hills, ~5 % grade): with the nose now pointing down-path, `height(s + k) - y` rises +1.9 m at k = 38 while the real road ahead falls 1.9 m, and the pitch term adds the same error again, so the far end of the lit pool floats ~2-4 m in the air (or buries itself on the opposite grade) instead of lying on the road.
- **Proposed fix:** Compute `rel = Math.cos(psi - p.roadH)` once in update(); use it for the pitch (`atan(p.slope) * rel`) and in layPool sample `path.height(s + k * Math.sign(rel))` so the pool follows the road the car actually faces.

### correctness-4: Mirror far plane of 400 m cuts the terrain and road to a straight edge the fog cannot hide

- **Where:** `src/preview/cockpit.ts:681`
- **Severity / confidence:** 2 / 0.7
- **What:** (claude/ref-pass, 368cd01) Both CarMirrors are built with `far: 400` (lines 681 and 686). The Sky still draws (three's Sky forces z to the far plane), but every road chunk, wall and terrain tile beyond 400 m is clipped, while `scene.fog.far` at High is ~0.92 * 2070 * fogFar = ~1900 m in clear weather (Environment.ts:212), so at 400 m the fog is only ~20 %. The comment acknowledges losing 'the hills and clouds' (the far ring) but the real hills in view behind the car are terrain tiles and are cut too.
- **How it fails:** Rear-view on the 405 through Irvine at High, clear day: in the glass the road, sound walls and ground end on a hard horizontal line ~3 px below the horizon (the eye is 1.2 m up, so 400 m subtends 0.17 degrees), with flat sky colour where the windscreen shows the Santa Ana foothills; a car following at 350-400 m pops in and out of existence at that line.
- **Proposed fix:** Either let the mirrors use the main camera's far (the default) and accept the draw calls, or keep 400 m but set `scene.fog.far` (and near) to the mirror's far for the duration of the nested render so the cut fades into haze, restoring them in the finally block.

### correctness-5: HalfFloat mirror targets will reproduce the lens flare's black square (g2) inside the glass

- **Where:** `src/preview/car-mirror.ts:68`
- **Severity / confidence:** 2 / 0.6
- **What:** (claude/ref-pass, 368cd01) The mirror render target is `HalfFloatType`. The Lensflare (Environment.ts:100, parked 900 m along sunDir at :274, frustumCulled=false by three, no far-plane test in its onBeforeRender) is not in either mirror's `hide` list, so its onBeforeRender runs inside the nested render and calls `renderer.copyFramebufferToTexture` into its RGBA8 probe textures. WebGL2 rejects copyTexSubImage2D from a float colour buffer into an unsigned-normalised texture (INVALID_OPERATION), so the 16x16 probe quad is 'restored' with an empty texture and the elements never draw. This is the same mechanism as the main pass at High/Ultra, where the composer target is also HalfFloat (Game.ts:523) - the progress log's g2 'solid black square at the sun, never draws at High'.
- **How it fails:** High or Ultra, sunset or sunrise, driving so the sun is behind the car (I-405 South at sunrise, CA-91 West at sunset): when the sun's reflection falls inside the rear-view, a 16x16 black square appears in the glass at the sun each mirror frame, plus a GL error per frame in the console. On Low/Medium the main pass draws to the canvas so neither the main-view square nor the mirror one occurs - which is why g2 only shows at High.
- **Proposed fix:** Add `env.flare` to each mirror's `hide` list (cheapest, correct: a flare is a lens artefact of the main camera). For g2 itself, render the flare after the composer to the canvas (or use UnsignedByteType for the composer's target) so copyFramebufferToTexture reads an 8-bit buffer.

### phone-4: The beam-pool texture asks for maximum anisotropy on a smooth gradient that covers a large grazing-angle screen area

- **Where:** `src/game/textures.ts:384`
- **Severity / confidence:** 2 / 0.55
- **What:** `beamPool()` returns `tex(c, false)` and then sets `t.anisotropy = ANISO` again (ANISO = min(16, maxAnisotropy) on every tier, including Low). The pool is a 12 × 38 m strip seen almost edge-on from the seat and hood at night, so its fragments are exactly the case anisotropic filtering spends up to 16 taps on; but the texture is Gaussians and smoothsteps with no high-frequency content, so trilinear mipmapping would look identical.
- **How it fails:** Low preset at night in the hood or cockpit view: the pool's near rows cover roughly a third of the screen; on a tile-based mobile GPU every one of those fragments samples the 128 × 512 texture with up to 16 anisotropic taps for no visible benefit.
- **Proposed fix:** Set `t.anisotropy = 1` for the beam pool (keep `generateMipmaps`), and consider tying the global ANISO to the tier (Low: 2-4) since `configureTextures` currently ignores it.

### phone-5: Live door mirror renders the whole high-tier player car into a 256 × 112 target; only the rear-view has an exclusion list (claude/ref-pass 368cd01)

- **Where:** `src/game/vehicle/PlayerCar.ts:99`
- **Severity / confidence:** 2 / 0.5
- **What:** In the worktree commit, setMirrorExclusions() builds `hide` only for 'rear-view-mirror'; the door mirror (cockpit.ts:686, `every: 2, phase: 1`) hides nothing, so its nested render draws the exterior body (~180k triangles with clearcoat MeshPhysical paint), the full cockpit kit, the SDF-skinned hands and four wheel kits into 28k pixels every other frame. The car-mirror comment itself notes that skipping the car 'saves drawing the car's quarter-million triangles into an 80-pixel-high target' for the rear-view; the door mirror keeps paying it. Desktop High/Ultra only (phones get 'env'), so this is draw-call and vertex cost on the desktop build, not a phone cost.
- **How it fails:** High preset, driver's seat, on an odd frame: the door mirror's render submits the exterior, interior and hands (the interior's per-mesh frustum culling drops some, the body mesh's one bounding sphere does not), adding most of the car's triangle count to a frame that already runs 563-638 draw calls.
- **Proposed fix:** Give the door mirror its own list: hide the interior group and the arms (they are a few pixels through the window opening) and keep only the exterior and the wheels, or lower that mirror's `every` to 3 and measure both in `tests/out`.

### phone-6: CarMirror.onBeforeRender allocates two Vector3s and an array on every mirror render (claude/ref-pass 368cd01)

- **Where:** `src/preview/car-mirror.ts:90`
- **Severity / confidence:** 1 / 0.95
- **What:** `C.clone().sub(P).dot(N)` (line 90), `vc.lookAt(E.clone().add(N))` (line 94) and `this.hide.filter((h) => h.visible)` (line 111, added by the commit) allocate on each active mirror render, although the class already keeps a set of scratch vectors (P, N, C, E, Y, c) for exactly this purpose. With two mirrors alternating that is three allocations every frame on desktop High/Ultra; phones never run it.
- **How it fails:** Desktop High at 60 fps: ~180 small allocations a second from the mirrors alone, plus the `hidden` array; harmless on a desktop GC but needless in a hot path that already avoids allocation elsewhere.
- **Proposed fix:** Reuse a scratch Vector3 (`c.copy(C).sub(P).dot(N)`, `c.copy(E).add(N)` for lookAt) and replace the filter with a pre-sized reusable array or a loop that records which entries were toggled.

### correctness-6: Hand-pose blend and wave run on the wall clock, so they animate while the game is paused

- **Where:** `src/preview/hands.ts:150`
- **Severity / confidence:** 1 / 0.9
- **What:** `pose()` derives its blend step from `performance.now()` (`dt = min(0.1, (now - lastT)/1000)`) and the wave from `sin(now * 0.0138)` (line 157). It is called every frame from PlayerCar.updateCockpit -> setWheelAngle, which Game.frame runs even when paused (Game.ts:791 is outside the `if (!this.paused)` block), whereas the pose's lifetime `poseT` only counts down in simulate().
- **How it fails:** Fire Clear Path (left hand waves for 1.6 s) and pause within the first second: the scene behind the pause panel keeps rendering and the hand keeps waving indefinitely; on resume the remaining ~1 s of `poseT` elapses and only then does it return. Likewise during Focus Time the world runs at 0.7x but the 0.3 s blend runs at 1x.
- **Proposed fix:** Pass the game's (scaled) dt into the arms - e.g. `setWheelAngle(rad, dt)` or an `update(dt)` - and advance both `o.t` and a wave phase accumulator from it, so a paused game passes dt = 0.

### correctness-8: Suite asserts the live mirrors exist but never renders a frame with them, so the nested render path is untested

- **Where:** `tests/regression.mjs:590`
- **Severity / confidence:** 1 / 0.9
- **What:** (claude/ref-pass, 368cd01) The render group's High/Ultra check sets `live` from `scene.traverse` finding a 'rear-view-mirror' with a `target` and asserts `live === (q !== 'low')`, which is what the log claims ('asserts live/live/env'). But frames are only awaited for `slow || q === 'low'` (line 591), and the mirrors are 'env' on Low, so in the default suite no CarMirror.onBeforeRender ever executes: the hide/restore of the player's car, the nested render inside the composer's MSAA RenderPass, the GTAO override skip and the active-flag toggling all pass without being exercised.
- **How it fails:** A regression that throws inside the mirror's nested render (e.g. a disposed target after a quality switch, or an exception before the `finally` resets `CarMirror.busy`) would still report 'live mirrors on' and the group's 'no page errors' check would pass, because the page never rendered a High frame.
- **Proposed fix:** After switching to 'high', await at least one rendered frame (with the existing long timeout) and assert `rv.target` was drawn to - e.g. expose a render count on CarMirror and expect it > 0 - or read a few pixels of the target via a test hook; keep it out of the default run only if the frame time is prohibitive, and say so in the log.

### correctness-7: Rebuilding the hands mid-ability drops the pose while the ability continues

- **Where:** `src/game/vehicle/PlayerCar.ts:163`
- **Severity / confidence:** 1 / 0.85
- **What:** `setPose` forwards to `this.arms` but PlayerCar does not remember the pose, and `buildHands` (lines 145-152) creates fresh DriverArms whose `off` state is zero (hands on the wheel). A quality change goes through applyQuality(true) -> configureCar() -> configure() with quality changed -> buildHands, without ending the ability.
- **How it fails:** Wrench fires Locked In (right hand on the console for 5 s), pauses, switches Graphics High -> Low, resumes: the car and hands rebuild with both hands on the rim although `gripBoost` is still 1.3 and `poseT` > 0; the pose never comes back for that activation. (Changing driver/skin instead ends the ability via applyDriver -> endAbility, so only the quality path shows it.)
- **Proposed fix:** Store the current pose in PlayerCar (`this.pose`) in setPose and, at the end of buildHands, call `this.arms.setPose(this.pose, true)` so the rebuilt hands resume the pose immediately.

### phone-7: The beam pool's nearest rows are drawn at full screen size but are painted almost fully transparent

- **Where:** `src/game/vehicle/PlayerCar.ts:34`
- **Severity / confidence:** 1 / 0.6
- **What:** BEAM_POOL.near is 2 m and the pool's alpha is shaped by `along = smoothstep(near, 6.5, k) * ...` (textures.ts:371), so the strip's first rows (2 m to roughly 4.5 m, the ones nearest the camera and therefore the largest on screen) carry alpha near zero yet are rasterised and blended every frame the lights are on. In the hood view part of that band is also under the bonnet.
- **How it fails:** Low preset at night, hood or cockpit camera: the two or three nearest rows of the additive strip occupy a wide band at the bottom of the frame, each fragment fetching the texture and blending to add essentially nothing.
- **Proposed fix:** Start the strip where the fade reaches a visible level (BEAM_POOL.near ≈ 4.5 m, keeping the canvas mapping in step), or drop POOL_ROWS' first row; the cut-off and wedge shapes are unaffected.
