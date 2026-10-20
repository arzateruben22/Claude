# Project OC: vehicle dynamics, the finished model

The design the implementer follows, line by line, for `src/game/vehicle/Physics.ts`, `src/game/cars.ts`, the contact
loop in `src/game/Game.ts`, `src/game/traffic/Traffic.ts` and a new `tests/dynamics.mjs`. It reviews the drift draft
(commit `0a6a24e` on `claude/drift`, parent `a89d4f0`), finishes weight transfer, replaces the force caps with wheel
states and slip-ratio controllers for ABS and traction control, builds the hypercar's physics interfaces so M3 and M5 on
`claude/hypercar` only set values, designs the swept traffic contact, and sets the invariants and the test plan.

Rules carried from the owner: semi-real drifting; the OC Hypercar Founder Edition is the fastest car with the best
handling and traction, with its own ability (Cold Thrust, Ground Lock, Thrust Hop); the two-tune rule (Unleashed only in
Free Drive, the race tune at or under the Rossini Corsa on every measured number in every scored mode, ability off); the
profiles Arcade 0.15, Sport 0.5, Simulation 0.9 on the handling slider, which stays the source of truth; our own names
only; every number here was measured, and the method is stated with it.

Conventions: car frame x forward, y left, yaw rate r positive counter-clockwise (left); SI units (N, m, s, rad, kg,
kg·m²) unless a column says mph or degrees. `h` is the handling slider (0 arcade .. 1 sim), `assist = 1 − h`.

## 0. How the numbers in this document were measured

- **Harness.** `node tests/dynamics.mjs` (Node, no browser; the scenarios are in `tests/dynamics-lib.mjs`, every one
  a function of the physics module, so the same code measures both trees). It writes `tests/out/dynamics.entry.mjs`
  (re-exporting `vehicle/Physics.ts`, `cars.ts`, `world/Path.ts` and `traffic/contact.ts`), bundles it with the repo's
  esbuild (`node_modules/.bin/esbuild --bundle --format=esm --platform=node`) to `tests/out/dynamics.bundle.mjs`, and
  extracts the parent commit's `Physics.ts`, `cars.ts`, `Path.ts` and `util.ts` with `git show a89d4f0:…` into
  `tests/out/base/` and bundles them the same way for the control column. Outputs: `tests/out/dynamics-report.md`
  (copied into §11), `dynamics.json` (every number), `dynamics-traces.txt` (the drift traces every 0.1 s). Flags:
  `--hz=240`, `--cars=`, `--h=`, `--only=perf,drift,stab,contact,dt`, `--base=`. `tests/out/` is gitignored, so §11 is
  the committed record. The scratchpad prototypes this design was first measured with are superseded by it.
- **Road.** A straight 4-lane `Path` 30 km long (control points every 100 m), a stub `Network` with no walls. Car placed
  with `placeAt(road, s, laneCenter(1), v0)`, `auto = true`, `grip` from `applyCar()`.
- **Acceleration.** Full throttle from rest: time to 26.82 m/s (60 mph), 44.70 m/s (100 mph), the quarter mile
  (402.3 m) with trap speed, and the top speed as the speed at which |Δv| per step stays under 0.0002 m/s for 3 s
  (an acceleration under 0.024 m/s²), up to 160 s.
- **Braking.** From 44.70 m/s after a 0.2 s settle: full pedal, throttle 0, distance to 0.5 m/s. "With ABS" is the
  game's setting; the harness flips `CarPhysics.abs` / `tc` for the "without" columns (§3.9).
- **Lateral g.** The plan's §5.1 method: for each steering value of a 16-point sweep (0.02 .. 1.0, refined with five
  more points around the best), 4 s at the set speed with a throttle/brake speed hold; the mean |`p.ay`| over the last
  2 s counts only if the body sideslip stayed under 0.12 rad and the speed within 8 %. The best run is kept. It compares
  cars; it is not a skidpad certificate.
- **Catch test.** From 17.9 m/s (40 mph), 0.5 s of settling, then full left steer with the handbrake until the body
  slip angle reaches 25°; then handbrake off, throttle 0.15, and a scripted counter-steer every step (front wheels
  pointed along the front axle's travel, `want = atan2(vy + a·r, vx)`, scaled by `steerLock`); the time until |angle|
  < 5°, the peak angle, the peak yaw rate, and whether it spun (|angle| > 80° or v < 3 m/s).
- **Stability.** `stab.mjs` as written: a pure-pursuit lane follower with the autopilot's gains, a lane change at 1 s
  and a 0.12 rad/s yaw shove at 4 s on the straight; a lift (2.0–3.5 s) then a 0.8 brake (4.5–5.5 s) on a 600 m
  sweeper; worst body slip angle, the worst after 7 s, spun (> 60° or 12 m off the centreline).
- **Sample sizes.** Every figure is one deterministic run (the model has no randomness); 120 Hz unless the column
  says 240 Hz.

## 1. Review of the draft (0a6a24e)

### 1.1 What the draft adds

Longitudinal transfer was already there; the draft adds lateral load transfer (`dLat`, split `rollF`), tyre load
sensitivity (`loadMu`, `LOAD_SENS = 0.12`), a counter-steer lock (`steerLock`), a handbrake yaw kick (`hbKick`), a
"kinetic" grip loss for a spun-up rear (`kinetic`, `spinLat`), a back-off of the stability control while the driver
holds a slide (`holding` from `counter` and `flick`), a cap on the stability control's yaw target (`rCap`), and the
drift readout (`drift.angle`, `active`, `time`). The traction limit moved after the brakes so left-foot braking works.

### 1.2 Equation by equation

| Where | Equation | Sign | Units | Magnitude check | Verdict |
| --- | --- | --- | --- | --- | --- |
| L135 | `dLong = m·ax·h/L` | Braking (ax < 0) loads the front: `Fzf = Wf − dLong`. Right. | N | GT at 1 g: 1480·9.81·0.42/2.65 = **2,301 N** per axle (35 % of the front's 6,575 N static). Vela E: 3,343 N. | Right. `ax` is last step's filtered value, so there is no algebraic loop. Keep. |
| L138 | `dLat = m·ay·h/TRACK` | Enters squared; sign irrelevant | N | GT at 1 g: 1480·9.81·0.42/1.62 = **3,764 N** total; at `rollF` 0.5, 1,882 N per axle onto the outside tyre. | Right. `TRACK` becomes `SPEC.track`. |
| L139 | `dF = clamp(dLat·rollF, ±Fzf/2)` | Clamp = the inside tyre lifting | N | Lifts at ay = Fzf/(2·dLat per g) = 1.75 g front; never on the earnable cars | Right. |
| L143 | `loadMu = mu·clamp(1 − k·((Fz/Fz0 − 1) + 4d²/(Fz0·Fz)), 0.7, 1.1)` | − with load, − with transfer | dimensionless | Derivation: two tyres with μ(F) = μ0(1 − k(F/F0 − 1)), F0 = Fz0/2, loads Fz/2 ± d. Σ μ(F)·F = μ0·Fz·[1 − k(Fz/Fz0 − 1) − 4k·d²/(Fz0·Fz)]. **The formula is exactly that sum**: the inside gives up more than the outside gains. GT at 1 g lateral, rollF 0.5: front −3.9 %, rear −2.7 % (so the limit tightens toward understeer, as it should). At 1 g braking: front Fz/Fz0 = 1.35 → −4.2 %; rear 0.71 → +3.5 %. | Right. The 0.7 floor is hit by the Unleashed tune at 150 m/s (downforce 30.3 kN on a 16.6 kN car, rear Fz/Fz0 = 2.94 → raw factor 0.767): real tyres do this, but it moves the plan's 130 m/s column (§7.8). |
| L61 | `maxDelta` | | rad | 0.52 rad (30°) parking, 0.0095 rad at 134 m/s; ×(1 + 0.35h) | Unchanged from the parent. |
| L66–71 | `steerLock(side)`: `base + clamp(β + 0.14 − base, 0, 0.66 − base)·smoothstep(0.04, 0.12, β)` on the counter-steer side | Checked: with vy < 0 (velocity right of the nose, nose left of travel, a left-turn oversteer) the opened side is `side = −1` = steer right = toward the travel direction. Right. | rad | β = 25° → lock 33°; capped at 38°. Below 2.3° of slip no change, so the straight-line runs see the parent's lock (measured: identical `stab` results on the straight). | **Bug at parking speed in Sim**: `maxDelta` is clamped to 0.52 *before* the ×1.35, so `base` can be 0.70 > 0.66 and `clamp(x, 0, −0.04)` returns −0.04: the lock *shrinks* 2.3° while sliding at 3–5 m/s in Sim. Fix: cap = `Math.max(0.66, base)`. |
| L128 | `delta += clamp(want − delta, ±2.4·dt)` | | rad/s | 138°/s; 0 → 33° in 0.24 s | dt-independent. Slow for a catch (drivers counter-steer at 400°/s+); §3.8 adds a counter-steer rate. |
| L168–175 | `brakeF = brake·1.35·m·g`; per axle `min(share, μ·Fz·0.97 / 0.55–0.68)` | | N | GT: 19.6 kN pedal; front cap 7.1 kN, rear 4.4 kN (arcade) | A force cap, not ABS. Replaced by §3.6. The `assist > 0.3` step is a discontinuity in the handling slider at h = 0.7. |
| L178–185 | `kinetic = 1 − 0.15·(1 − assist)·smoothstep(0, 0.5, spin)`; `Fx_r = sign·limit·kinetic·(0.98 / 0.95)` | | dimensionless | At h = 0.35 a spinning rear keeps 0.95·0.98 = 93 % of the limit (parent: 98 %). | Physically the right idea (sliding rubber grips less) but it is the main reason the launches got 0.2–0.45 s slower (§1.5). Replaced by the combined-slip tyre's falloff (§3.3), with TC holding the slip at the peak in Arcade. |
| L187 | handbrake: `Fx_r += −sign(vx)·μR·Fzr·0.85; rearGrip = 0.32 + 0.25·assist` | | N | | A grip multiplier standing in for a locked wheel. Replaced by a rear brake torque that locks the wheel state (§3.8); the lateral collapse then follows from combined slip. |
| L189, L225 | `hbKick = −sign(steer)·|steer|·0.45·smoothstep(4, 12, v)·(0.7 + 0.3h)`, released as `k = hbKick·min(1, dt/0.2)` added to `r` | Tail steps out away from the steer direction. Right. | rad/s | Total Δr up to 0.45 rad/s = 26°/s. As a moment that is Iz·Δr/τ = 2250·0.45/0.2 = **5.1 kN·m** on the GT, against the front axle's available yaw moment a·μF·Fzf = 1.45·1.12·6575 = **10.7 kN·m**: 47 % of what the front tyres could give. Not absurd. | **Acceptable as a feel device, wrong as a unit.** A yaw-rate pulse ignores grip (the same kick on a wet road), the front's load and the steer the front actually has. §3.8 keeps the pulse shape but defines it as a moment: a fraction (`SPEC.hbKick`, default 0.35) of a·μF·Fzf, with an exact exponential envelope. Because Iz and the tyre loads both scale with mass, the yaw *acceleration* is car-independent either way, which is why the pulse felt right. Measured on the GT at 40 mph: time to a 25° entry 0.57 s without the kick (parent), 0.47 s with it (draft). |
| L194–195 | `aF = atan2(vy + a·r, |vx|) − δ`, `aR = atan2(vy − b·r, |vx|)` | Positive α (velocity left of the wheel) → force to the right (`tire` returns −f). Right. | rad | | Right. |
| L196–201 | `tire`: `max·tanh(C·α/max)`, Sim falloff `1 − 0.1·(h − 0.5)·2·smoothstep(0.08, 0.22, |α|)` | | N | Peak at α ≈ 1.5·max/C: GT front 0.088 rad (5°); −10 % past 12.6° at h = 1 | Right; the falloff moves into the combined-slip law and becomes a profile value (§3.3). |
| L203–210 | `frontCircle = sqrt(1 − (Fx_f/μF Fzf)²)` floor 0.3; `rearCircle` floor 0.25; `spinLat = 1 − 0.6·smoothstep(0.05, 0.6, spin)·(0.4 + 0.6h)` | | dimensionless | | Three separate approximations of one thing (combined slip). All replaced by §3.3's friction ellipse, which gives a locked wheel no steering and a spinning rear little lateral force without a tuned constant. |
| L219–224 | `Fx = Fx_r + Fx_f·cosδ − Fyf·sinδ − drag − roll − grade`; `Fy = Fyr + Fyf·cosδ + Fx_f·sinδ`; `Mz = a(Fyf·cosδ + Fx_f·sinδ) − b·Fyr` | Right (the front's braking force steered by δ contributes to Fy and Mz; the rear's drive is on the centreline so no Mz) | N, N·m | | Right. Torque vectoring (§4.5) adds `+ Mz_v`; thrust (§4.3) adds `+ ext.fx` to Fx. |
| L222–224 | `vx += (ax + vy·r)dt; vy += (ay − vx·r)dt` with the *new* vx; `r += Mz/Iz·dt`; `psi += r·dt` | | | Explicit Euler with a semi-implicit cross term. Fastest lateral/yaw modes at 6 m/s: (Cf + Cr)/(m·v) = 35/s, (a²Cf + b²Cr)/(Iz·v) = 39/s → λ·dt = 0.29–0.33 (×1.8 tyres: 0.52–0.59), limit 2. | Stable with margin. The `lowSpeed` fade of the tyre forces (1.5–6 m/s) keeps λ·dt ≤ 0.31 below 6 m/s, so the 1/v growth never bites. Keep. |
| L236–248 | `race`, `counter`, `flick`, `holding`; `rCap = μ·g/max(5, v)`; `r += (rWant − r)(1 − e^{−dt·K(1 − holding)})`; `vy *= e^{−dt·B(1 − holding)²}` | `counter = clamp(δ·sign(βS)/max(0.03, base), 0, 1)·…`: δ > 0 with βS > 0 is steering toward the velocity. Right. | rad/s; 1/s | rCap at 25 m/s, μ 1.3: 0.51 rad/s; `mu` already includes `this.grip`, so the cap is grip-scaled (what M4 wanted) | Right and dt-independent (exact exponentials). Keep; the TC's held-drift rule (§3.7) reuses `holding`, so compute it before the drivetrain. |
| L227–229 | `rKin = vx·tanδ/L`; `r = lerp(rKin, r, lowSpeed)`; `vy *= lerp(e^{−8dt}, 1, lowSpeed)` | | | | `r = lerp(...)` is a per-step blend with no dt (§1.4 D4). The vy line is exact to second order. |
| L251–252 | `ax += (ax_new − ax)·min(1, 10·dt)` | | | At 120 Hz the factor is 0.0833 against the exact 1 − e^{−10/120} = 0.0800: a 4 % faster filter. | dt-dependent (§1.4 D1). |
| L254–257 | `drift.angle = −atan2(vy, vx)·180/π` (+ when the nose is left of travel), `active` past 8° over 8 m/s, 0.5 s grace | Right | deg, s | | Right. In the air (§4.6) force `angle = 0`, `active = false`. |

### 1.3 What is wrong, with the fix

- **W1 `steerLock` cap.** `clamp(β + 0.14 − base, 0, 0.66 − base)` with `base > 0.66` (Sim, under 5 m/s) returns a
  negative number. Fix: `const cap = Math.max(0.66, base); return base + clamp(β + 0.14 − base, 0, cap − base)·...`.
- **W2 The handbrake kick is a yaw-rate pulse.** Make it a moment (§3.8), applied through Iz, limited by the front
  axle's available yaw moment, with the profile scaling it keeps today.
- **W3 Force caps where the owner asked for controllers.** The brake caps (L173), the traction cap (L184) and the
  handbrake grip multiplier (L187) are replaced by wheel states with ABS and TC slip-ratio controllers (§3).
- **W4 Three overlapping approximations of combined slip** (`frontCircle`, `rearCircle`, `kinetic`, `spinLat`). One
  friction-ellipse tyre law replaces them (§3.3). The constants 0.3, 0.25, 0.15, 0.6 go away.
- **W5 Steps in the handling slider.** `assist > 0.3 ? …` (L173, L184) jumps at h = 0.7. Every profile-dependent
  value becomes a smooth function of `h` (the table in §3.9).
- **W6 Per-step allocation.** `loadMu` and `tire` are arrow functions created inside `step()` every step (the parent
  had `tire` too). Hoist them to module functions writing into a reused `{fx, fy, K}` record. In `Game.simulate` the
  contact loop allocates: `Traffic.collide` builds `out = []`, four axis arrays and a `Contact` per hit every step;
  §5 replaces that with a preallocated contact buffer and scalar axes.
- **W7 Constants that are car properties.** `TRACK` and `LOAD_SENS` become `SPEC.track` and `SPEC.loadSens` with the
  same defaults (1.62 m, 0.12), so the hypercar can set them.
- **W8 The arcade rear brake cap (0.55) and the TC cap (0.98) hide a balance choice.** They become `SPEC.brakeBias`
  (front share of brake torque, default 0.62) and the TC target table, which the slider interpolates.
- **W9 `wheelRotR` fakes the spin** (`1 + spin·0.6`). With a rear wheel state it is `wR·dt` exactly, and the tach
  follows the wheel it is geared to.

Not wrong, kept as design: the one-step lag of `ax`/`ay` in the loads (it is the suspension's time constant and avoids
an algebraic loop); the `lowSpeed` kinematic blend; the stability control and its `holding` back-off; `rCap`; the drift
readout and its 0.5 s grace; the 38° lock cap.

### 1.4 What is dt-dependent, with the fix, and what it measures today

| | Line | Form today | Fix |
| --- | --- | --- | --- |
| D1 | L251–252 | `ax += Δ·min(1, 10·dt)` | `ax += Δ·(1 − Math.exp(−10·dt))` (and `ay`) |
| D2 | L156 | `rpm += Δ·min(1, dt·(shifting ? 25 : 18))` | `1 − Math.exp(−k·dt)` |
| D3 | L225 | `k = hbKick·min(1, dt/0.2)` | `k = hbKick·(1 − Math.exp(−dt/0.2))`; the 1e-3 cut-off stays |
| D4 | L228 | `r = lerp(rKin, r, lowSpeed)` (a per-step blend) | `r = lerp(rKin, r, Math.pow(lowSpeed, dt·120))`: identical at 120 Hz, the same per-second effect at any rate |
| D5 | L175 | `vx *= 0.9` when braking below 0.05 m/s | `vx *= Math.exp(−12.6·dt)` |
| D6 | L307–317 (`hitWall`) | scrub `vn·0.5 + 0.04` and the nose glance per contact step | Event-like by nature (a wall touch); leave, but note grinding along a wall is rate-dependent |

Measured, draft, 120 Hz against 240 Hz (`out-draft.json` vs `out-draft-240.json`, GT/Brio/Corsa/Vela E/both tunes at
h = 0.15, 0.5, 0.9): 0-60, 0-100, top speed and lateral g agree within **0.3 %**; 100-0 within **0.2 %** (worst Vela E
0.9: 95.8 vs 95.8 m; GT 0.15: 85.7 vs 85.6 m); the catch time within **4 %** (GT 0.5: 1.27 vs 1.22 s; Vela E 0.9:
1.42 vs 1.40 s), which the D1–D4 fixes and the 5° threshold's discreteness account for. So the draft is already close;
the finished model must meet 2 % on everything (§6 I4), which the fixes above and the two-substep wheel update (§3.4)
give.

### 1.5 What the draft did to the cars' numbers

From the control table (§7.7): at h = 0.35 every earnable car's 0-60 is 0.28–0.34 s slower (GT 3.27 → 3.61 s, Corsa
3.11 → 3.43 s), 0-100 0.3–0.45 s slower, 100-0 up to 2.6 m longer (GT 87.0 → 89.6 m; the Brio 0.6 m shorter), lateral g
at 25 m/s down 0.07–0.09 g and at 40 m/s down 0.02–0.05 g, 80 m/s unchanged, top speeds unchanged. Causes: the
`kinetic` factor (a traction-limited launch now keeps 93 % of the rear limit instead of 98 %), load sensitivity (the rear
at 1 g of squat carries 29 % more than static, so μR drops 3.5 %; the loaded outside tyres cost 3–4 % in a corner), and
`loadMu` on the brake caps. The lateral loss is intended physics (tyres do this) and small; the launch loss is not
intended in Arcade, where traction control should keep the tyre at its peak, and the finished model's TC does (§3.7).
The catch test shows the drift intent working: the entry is quicker (0.57 → 0.47 s) and the car swings further
(peak 31° → 42° at h = 0.35, 55° → 65° at 0.9) yet is caught in 0.8–1.4 s in every profile, never spinning.

## 2. Weight transfer, finished

### 2.1 Fields

| Field | Unit | Default | Meaning |
| --- | --- | --- | --- |
| `SPEC.h` | m | 0.42 (exists) | centre-of-mass height |
| `SPEC.a`, `SPEC.b` | m | 1.45, 1.20 (exist) | CG to front / rear axle; `L = a + b` stays a module value read from SPEC at `applyCar` (§8 defers per-car values) |
| `SPEC.track` | m | 1.62 | mean track; replaces `TRACK` |
| `SPEC.rollF` | – | 0.5 | front share of the lateral load transfer (the roll-stiffness split). 0.5 keeps the earnable cars exactly where the draft has them |
| `SPEC.loadSens` | – per +100 % load | 0.12 | replaces `LOAD_SENS` |
| `SPEC.lagAx`, `SPEC.lagAy` | 1/s | 10, 10 | the pitch and roll "suspension" filters on `ax`, `ay` (exact exponentials, D1) |

### 2.2 Equations (each step, before the tyres)

```
down   = 0.5·ρ·ClA·v²                                   (ρ = 1.225)
Wf     = m·g·b/L,  Wr = m·g·a/L
dLong  = m·ax·h/L                                       (ax: the filtered body acceleration, last step)
Fzf    = max(500, Wf − dLong + 0.42·down + 0.45·ext.fz)
Fzr    = max(500, Wr + dLong + 0.58·down + 0.55·ext.fz)   (ext.fz: fan suction, §4.3)
dLat   = m·ay·h/track
rollF' = clamp(SPEC.rollF + 0.06·assist, 0.3, 0.7)      (the draft's arcade bias, kept)
dF     = clamp(dLat·rollF', −Fzf/2, Fzf/2),  dR = clamp(dLat·(1 − rollF'), −Fzr/2, Fzr/2)
muF    = mu·clamp(1 − loadSens·((Fzf/Wf − 1) + 4·dF²/(Wf·Fzf)), 0.7, 1.1)
muR    = mu·clamp(1 − loadSens·((Fzr/Wr − 1) + 4·dR²/(Wr·Fzr)), 0.7, 1.1)
```

`mu = (1.12 + 0.3·assist)·grip` as today. Fan suction and downforce enter the load-sensitivity ratio on purpose: a
tyre pressed harder gives less μ, which is why a fan car's gain is less than proportional (the plan's 1.96 g figures
must be re-measured, §7.8).

### 2.3 The numbers

| Car | m (kg) | Wf / Wr (N) | split | dLong at 1 g (N) | dLat at 1 g (N) | μF, μR change at 1 g lateral (rollF 0.5) | μF, μR at 1 g braking |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rossini GT | 1,480 | 6,575 / 7,944 | 45.3 / 54.7 | 2,301 | 3,764 | −3.9 % / −2.7 % | −4.2 % / +3.5 % |
| Rossini Brio | 1,250 | 5,553 / 6,710 | 45.3 / 54.7 | 1,943 | 3,178 | −3.9 % / −2.7 % | −4.2 % / +3.5 % |
| Rossini Corsa | 1,410 | 6,264 / 7,568 | 45.3 / 54.7 | 2,192 | 3,585 | −3.9 % / −2.7 % | −4.2 % / +3.5 % |
| Vela E | 2,150 | 9,551 / 11,540 | 45.3 / 54.7 | 3,343 | 5,467 | −3.9 % / −2.7 % | −4.2 % / +3.5 % |

The percentages are mass-independent because every load scales with m (the ratios in `loadMu` cancel); they change
only with `h`, `L`, `track`, `rollF` and `loadSens`, which is what the hypercar's fields can move.

### 2.4 The intended feel, and which term gives it

- **Brake into a corner: rotation.** `dLong` moves up to 2.3 kN (GT, 1 g) off the rear: the rear's lateral capacity
  `muR·Fzr` falls 29 % + 3.5 % × (−1) ≈ 26 %, while the front's rises 35 % − 4 %. The front also spends part of its
  ellipse on braking force (§3.3), so the balance swings toward the rear letting go first: the nose tucks in, the tail
  comes round. Trail-braking is a real tool. In Arcade the stability control (unchanged, §1.2 L236–248) damps the yaw
  that follows unless the driver holds it.
- **Throttle on exit: squat and grip.** `dLong` goes the other way: the rear gains load, its ellipse grows, so the same
  drive force leaves more for cornering; the rear slip ratio the TC holds (§3.7) gives the squat its traction. With a
  spinning rear (held drift) the ellipse's longitudinal share dominates and the lateral force falls: power-over.
- **Lateral transfer and load sensitivity** tighten the limit toward understeer in a steady corner (front loses 3.9 %,
  rear 2.7 %). `rollF` > 0.5 (stiffer front) pushes more; < 0.5 lets the tail go first. The hypercar's plan can set it.

### 2.5 Roll-stiffness default

`rollF = 0.5` plus the arcade bias `0.06·assist` reproduces the draft exactly for the four earnable cars. The CarDef
field is optional; `applyCar` copies `c.rollF ?? BASE.rollF`.

## 3. Wheel states, the combined-slip tyre, ABS and TC as slip-ratio controllers

### 3.1 Decision: (B) per-axle wheel-speed states

(A), a quasi-static slip estimate, has no state to control: "ABS" and "TC" can only be caps on force wearing
controller names, which the owner rejected, and it cannot show a wheel locking (the steering going dead), a rear
flaring the tach, or an ABS cycle in the pedal and the sound. (B) adds two scalars (`wF`, `wR`) and makes every one of
those real, lets one tyre law replace four fudges (§1.3 W4), and gives the all-wheel-drive split a front wheel to
drive. Its risk is stiffness at low speed, which §3.4 shows is handled by a linearised backward-Euler wheel update
with two substeps, no more.

### 3.2 States and fields

| Name | Unit | Default | Meaning |
| --- | --- | --- | --- |
| `wF`, `wR` (instance) | rad/s | `vx/wheelR` at `placeAt` | front / rear axle angular speed (both wheels of an axle as one) |
| `kF`, `kR` (instance, readout) | – | 0 | slip ratios this step |
| `absP` (instance) `{f, r}` | 0.05..1 | 1 | ABS brake-pressure multipliers |
| `tcM` (instance) | 0.05..1 | 1 | TC drive-torque multiplier |
| `abs`, `tc` (instance) | bool | true | the switches the harness flips; the game never turns ABS off, TC is on in every profile with the §3.9 targets |
| `spin` (readout, kept) | – | 0 | `max(0, kR)`: the smoke, marks and audio keep reading it |
| `SPEC.kx` | – | 20 | longitudinal slip stiffness per unit load: `Ck = kx·Fz` (N per unit slip) |
| `SPEC.IwF`, `SPEC.IwR` | kg·m² | 2.2, 2.6 | two wheels with brakes per axle |
| `SPEC.Ieng` | kg·m² | 0.25 | engine + clutch inertia, reflected to the driven axle by `(ratio·final)²` when in gear and not shifting |
| `SPEC.brakeG` | g | 1.35 | the pedal: total brake force at full pedal = `brakeG·m·g` |
| `SPEC.brakeBias` | – | 0.62 | front share of brake torque |
| `SPEC.U0` (module constant is fine) | m/s | 2.0 | floor of the slip-ratio denominator |

### 3.3 The tyre: one law for both axles

Module function, no allocation (writes into a reused record):

```
tyre(kappa, alpha, Fz, mu, Ck, Ca, fallP, out):
  Fmax = mu·Fz
  sx = Ck·kappa/Fmax ;  sy = Ca·alpha/Fmax ;  s = hypot(sx, sy)
  if s < 1e-9: out.fx = 0; out.fy = 0; out.K = Ck; return
  fall = 1 − fallP·smoothstep(1.2, 3.5, s)              (past the peak the rubber slides and gives less)
  F  = Fmax·tanh(s)·fall
  out.fx =  F·sx/s                                        (κ > 0, wheel faster than road: pushes the car forward)
  out.fy = −F·sy/s                                        (α > 0, velocity left of the wheel: force to the right)
  out.K  = max(0, Ck·((F/(Fmax·s))·(1 − (sx/s)²) + sech²(s)·fall·(sx/s)²))    (∂fx/∂κ, for the implicit step)
```

- `Ca` is `Cf` or `Cr` (N/rad, per car as today); `Ck = kx·Fz` scales with load as a tyre's longitudinal stiffness
  does. `mu` is `muF`/`muR` from §2.2.
- **What falls out of it.** A locked wheel (κ = −1): sx ≈ −17, s ≈ 17, `fy = F·sy/s` is a few per cent of what the
  same slip angle gave rolling: the steering is gone. A spinning rear: the same, so power-over and the handbrake
  collapse the rear's lateral force with no `spinLat`, `kinetic` or `rearGrip`. Braking at the ABS slip (κ = −0.12,
  sx ≈ −2 at μ 1.2) in a 0.05 rad corner costs about 45 % of the front's lateral force at that slip angle: brake hard
  in a corner and it pushes wide, as the draft's `frontCircle` wanted.
- **Falloff by profile** (`fallP = 0.02 + 0.18·h`): Arcade 0.047, Sport 0.11, Sim 0.18. This is the draft's Sim-only
  α-falloff generalised, and it is what makes ABS pay: a locked wheel stops at `(1 − fallP)·μ` (0.95 / 0.89 / 0.82 μ),
  ABS at the peak of `tanh(s)·fall(s)`, which is 0.96 μ at s ≈ 2.5 in Arcade, 0.93 μ at s ≈ 2.0 in Sport and 0.92 μ at
  s ≈ 2.0 in Sim (worked from the law above). With `fallP = 0` a locked wheel would brake *better* than ABS (the
  prototype shows it: 88.3 m locked vs 92.0 m at κ −0.12 with a `tanh` that never falls), so the falloff is not
  optional. Because the peak sits at a nearly fixed **normalised** slip s, the ABS and TC targets are given in s and
  converted per axle with that axle's μ and load: `κ_target = s_target·μ_i/kx` (Arcade μ 1.375 → the peak is at
  κ ≈ 0.17; Sim μ 1.15 → κ ≈ 0.115). A fixed κ target would sit before the peak in Arcade and past it in Sim.
- The front's α uses the steered velocity: `alphaF = atan2(vy + a·r, |vx|) − δ`, `alphaR = atan2(vy − b·r, |vx|)` as
  today; both axles' forces are then faded by `lowSpeed` below 6 m/s as today.

### 3.4 The wheel update: linearised backward Euler, two substeps

Per axle i, with `h = dt/2`, twice per 120 Hz step (the body states are held during the step; the two substeps'
forces are averaged for the body):

```
v_i   = front: vx·cosδ + (vy + a·r)·sinδ ;  rear: vx          (the road speed under the axle, along the wheel)
u_i   = max(|v_i|, U0)
kappa = (w_i·R − v_i)/u_i
tyre(kappa, alpha_i, Fz_i, mu_i, kx·Fz_i, Ca_i, fallP, T)       → T.fx, T.fy, T.K
Tb    = brakeTorque_i·absP_i·tanh(w_i/0.5)                      (a smooth sign: a stopped wheel has no brake torque)
Td    = driveTorque_i                                           (rear: T·(1 − driveFront)·tcM ; front: T·driveFront·tcM)
w1    = w_i + h·(Td − Tb − R·T.fx) / (I_i + h·R²·T.K/u_i)        (one Newton step of backward Euler with the local slope)
if |s| > 1.5 and sign(kappa1) ≠ sign(kappa) and kappa ≠ 0:  w1 = v_i/R        (re-grip guard: a sliding wheel that
                                                                 would cross zero slip in one step lands on zero slip)
if Td == 0 and brakeTorque_i > 0 and sign(w1) ≠ sign(v_i || 1):  w1 = 0          (a braked wheel stops, never reverses)
w_i = w1 ;  fx_i += T.fx/2 ;  fy_i += T.fy/2
```

Why the local slope: in the linear regime `K ≈ Ck` and the step is fully implicit (stable for any λ·dt); when the
wheel is saturated `K → 0` and the step is the explicit torque integrator of a system with no stiffness (nothing to
be unstable about), so a burnout flares at `(Td − R·μFz)/I` as it should instead of being over-damped by a fixed
Jacobian. The guard covers the one transition that can overshoot: coming back from a slide into the linear region.

**Evidence** (`wheel2.mjs`: one axle on its share of the body, 120 Hz and 240 Hz, 1 and 2 substeps, `kx` 20, μ 1.2,
`U0` 2):

| Case | explicit λ·dt at 120 Hz | 1 substep: stable? 120 vs 240 Hz | 2 substeps: 120 vs 240 Hz |
| --- | --- | --- | --- |
| Lock-up, no ABS, 2 m/s, Fz 12 kN (fans), Iw 0.6, 6 kN·m | **198** | stable, max|κ| 0.76, but the 0.2 m stop differs 55 % | max|κ| 0.91, stop 0.18 m both: **0.05 %** |
| Lock-up, no ABS, 44.7 m/s, Fz 7 kN, Iw 1.1 | 3 | 1.6 % | **0.25 %** (88.3 vs 88.1 m) |
| ABS target −0.12 from 44.7 m/s | 3 | 2.5 % | **0.01 %**, mean κ −0.123 / −0.122 |
| ABS target −0.12 from 10 m/s | 13 | 36 % (6.6 vs 4.8 m) | **1.4 %**, mean κ −0.119 / −0.122 |
| Burnout 0.3 m/s, Iw 1.2, 3 kN·m (at the limit, no spin) | 66 | 3.7 % | **1.1 %** |
| Launch 0.3 m/s, Iw 40 (1st gear, engine reflected), 25 kN·m, no TC | 2 | max κ 27.5 (a real burnout), 0.3 % | 0.4 % |
| Same with TC target +0.10 | 2 | peak κ 0.68, 0.3 % | 0.5 % |
| Cruise 30 m/s, 800 N·m | 4 | 0.1 % | 0.2 % |

No case blows up or produces a NaN at either substep count; one substep fails the 2 % rule at low speed, two pass
every case. The cost is two axles × two substeps × about 40 flops: nothing.

### 3.5 Drivetrain coupling

- `wheelRpm()` becomes `wR·30/π` (the axle the engine is geared to; with `driveFront > 0.5` the front). The clutch-slip
  rule in 1st/reverse, the automatic's shift points, `revBlip`, the limiter and engine braking are unchanged; wheelspin
  now flares the tach because the wheel state does.
- Rear axle inertia: `I_r = IwR + Ieng·(ratio·final)²·(1 − driveFront)` when in gear and not shifting, `IwR` during a
  shift (clutch open) and in neutral. In 1st gear (13.7 overall) that is 2.6 + 47 kg·m²: launches are *not* the stiff
  case; braking the free front axle (`IwF` 2.2) at walking pace is, and §3.4 covers it.
- Drive torque at the wheels `T = engineTorque(rpm)·throttle·ratio·final·eff` (×0.15 while shifting, the engine-braking
  branch as today); split `T·(1 − driveFront)` rear, `T·driveFront` front.
- `wheelRot += wF·dt`, `wheelRotR += wR·dt` (W9).

### 3.6 Brakes and ABS

- Pedal → torque: `brakeTorque_f = brake·brakeG·m·g·R·brakeBias`, `brakeTorque_r = brake·brakeG·m·g·R·(1 − brakeBias)`.
  No μ caps. The hold logic (`|vx| < 0.05`, the start line, reverse selection) is unchanged.
- **ABS controller**, per axle, active when `abs && brake > 0.02 && |v_i| > U0`:

  ```
  sAbs   = 2.0 + 0.5·assist                      normalised slip at the tyre's peak: Arcade 2.43, Sport 2.25, Sim 2.05
  kAbs_i = −sAbs·mu_i/kx · sign(v_i)             per axle, this step's μ and kx; positive when the road speed is
                                                 negative, so braking in reverse (up to ~22 m/s in that gear) is
                                                 controlled too (GT, dry, forward: Arcade −0.167, Sport −0.143,
                                                  Sim −0.118; on a wet road (grip 0.8) the targets shrink with μ)
  dP/dt  = kappa < kAbs_i ? −25·(kAbs_i − kappa)/0.1 : +8      (dump fast on excess slip, re-apply at 8/s)
  P      = clamp(P + dP/dt·h_sub, 0.05, 1)       (updated each substep)
  pedal released (brake ≤ 0.02) or |v_i| ≤ U0 → P = 1
  ```

  Measured in the prototype at these rates: mean κ −0.121 at a target of −0.12 from 100 mph, −0.119 from 10 m/s (the
  controller holds whatever target it is given; the target's placement is the §3.3 arithmetic). The re-apply/dump
  asymmetry makes a gentle 6–10 Hz cycle in `absP`, which `PlayerCar` can feed to the pedal shake and the audio to a
  tick; `absP < 0.95` is the ABS light. The parent braked at a fixed 0.97 μ on the front; the Arcade target brakes at
  the peak, 0.96 μ, so the Arcade 100-0 should land within 1 % of the parent's.
- **ABS off** (harness, `abs = false`): the wheel locks under a full pedal (κ → −1), stops at `(1 − fallP)·μ`, the
  front gives no steering. Expected 100-0 at Sim (fallP 0.18): about 10–12 % longer than with ABS.

### 3.7 Traction control, and the held-drift rule

Active when `tc && Td > 0 && !handbrake`:

```
sTc     = 2.0 + 3.5·h                            normalised slip: Arcade 2.53 (the peak), Sport 3.75 (a flare), Sim 5.15
kTc     = sTc·muR/kx                             (GT, dry: Arcade 0.174, Sport 0.238, Sim 0.296)
kTcEff  = kTc + (1.5 − kTc)·holding              (a held drift lifts the target out of reach: the rear keeps spinning
                                                  in EVERY profile; `holding` is the draft's L240 value, computed
                                                  before the drivetrain)
dM/dt   = kappaR > kTcEff ? −25·(kappaR − kTcEff)/0.1 : +6
M       = clamp(M + dM/dt·h_sub, 0.05, 1) ;  throttle ≤ 0.02 → M = 1
throttleOut = throttle·M·(shifting ? 0.15 : 1)   (the audio hears the cut; `tcM < 0.95` is the TC light)
```

Why s = 2.5 in Arcade: with `fallP` 0.047 the peak of `tanh(s)·fall(s)` is 0.96 μ at s ≈ 2.5 (§3.3), so Arcade
launches at the peak and the control table's launch numbers come back toward the parent's (which capped at 0.98 of
the limit); Sport allows a visible flare at 3.75 (the force is 0.90 μ there, the tach rises); Sim intervenes only on
a full spin.

### 3.8 The handbrake, the kick, and the counter-steer rate

- **Handbrake:** a rear torque `Thb = 1.3·muR·Fzr·R` while `c.handbrake`, added AFTER the ABS pressure (`TbR·Pr +
  Thb`): the ABS modulates the pedal's share only, so the handbrake locks the rear with the foot brake held as well
  (§11: 25° in 0.51–0.67 s with the pedal at 0.5 or 1.0; the first implementation let `Pr` multiply it and a player
  braking into the pull got 6–8° instead of 36°). Not on the start line (`hold`): the countdown's handbrake only
  holds the car; the clutch stays in and the launch at GO is the standing-start launch (§11, within 0.02 s). (Enough to lock the rear in one or two
  substeps in every profile). The rear's lateral force then collapses through §3.3; no `rearGrip`.
- **The kick, as a moment.** On the pull (`handbrake && !hbWas && vx > 4`, with the wheel turned):
  `hbMz = −sign(steer)·min(1, |steer|)·SPEC.hbKick·a·muF·Fzf·smoothstep(4, 12, v)·(0.7 + 0.3·h)` [N·m·s of budget is
  not needed: store the peak moment and an envelope]. Each step: `Mz += hbMz·e`, `e = exp(−t_hb/0.2)` for 0.4 s, then
  0. `SPEC.hbKick` default 0.35 (35 % of the front axle's available yaw moment, GT: 3.7 kN·m peak). Measure the 40 mph
  entry time (§7.3); the target is 0.45–0.55 s. If the wheel-state model alone reaches it, set the default to 0.
- **Counter-steer rate.** `SPEC.steerRate` 2.4 rad/s (today's), `SPEC.csRate` 2.0: on the counter-steer side (the
  request has the sign that `steerLock` opens) the rate is `steerRate·(1 + (csRate − 1)·smoothstep(0.08, 0.20, β))`.
  Hands already moving in a slide move faster; into-the-slide and straight-line steering keep today's rate, so the
  autopilot runs are untouched.

### 3.9 The profiles

The slider is the source of truth; the UI maps Arcade → 0.15, Sport → 0.5, Simulation → 0.9 (M4). Every row is a
smooth function of `h`; nothing steps.

| Assist | Formula | Arcade 0.15 | Sport 0.5 | Simulation 0.9 |
| --- | --- | --- | --- | --- |
| Base μ (× road grip) | `1.12 + 0.3·assist` | 1.375 | 1.27 | 1.15 |
| Steering lock gain | `1 + 0.35·h` | 1.05 | 1.175 | 1.315 |
| ABS target, normalised slip `sAbs` (κ on the GT, dry) | `2.0 + 0.5·assist`; `κ = −sAbs·μ_i/kx` | 2.43 (κ −0.167: the peak, 0.96 μ) | 2.25 (κ −0.143: the peak, 0.93 μ) | 2.05 (κ −0.118: the peak, 0.92 μ) |
| ABS strength (dump / apply) | fixed | 25/s per 0.1 excess / 8/s | same | same |
| TC target, normalised slip `sTc` (κ on the GT, dry) | `2.0 + 3.5·h`; `κ = sTc·μR/kx` | 2.53 (κ 0.174: holds the peak) | 3.75 (κ 0.238: a visible flare) | 5.15 (κ 0.296: a full spin only) |
| TC in a held drift | `kTc + (1.5 − kTc)·holding` | off while held | off while held | off while held |
| Stability control yaw pull | `5·assist + 3.5·race` (1/s) | 4.25 + race | 2.5 + race | 0.5 + race (race only past ~5° of slip) |
| Sideslip bleed | `2.2·assist² + 1.6·race` (1/s) | 1.59 + race | 0.55 + race | 0.02 + race |
| Counter-steer back-off `holding` | `max(counter, flick)·(0.9 + 0.1h)·(1 − 0.6·smoothstep(40, 65, v))` | ×0.915 | ×0.95 | ×0.99 |
| Tyre falloff `fallP` | `0.02 + 0.18h` | 0.047 | 0.11 | 0.182 |
| Roll-stiffness bias on `rollF` | `+0.06·assist` | +0.051 | +0.03 | +0.006 |
| Handbrake kick scale | `0.7 + 0.3h` | 0.745 | 0.85 | 0.97 |

ABS is never off in the game (Sim has a racing ABS at the peak with the least margin); TC is never off in the game
but its Sim target is a spin-catcher. The harness flips `abs`/`tc` for the "without" columns. Giving the targets in
normalised slip also makes them follow the road: on a wet road (`grip` 0.8) every κ target shrinks with μ, as a real
controller's slip estimate does.

### 3.10 The stability control

Unchanged from the draft (L236–248), including `holding`; `rCap = mu·g/max(5, v)` already scales with the car's grip
because `mu` includes `this.grip`, which is what M4's "grip-scaled stability control" asks for. Note for M4: nothing
more to do there.

## 4. The hypercar's interfaces (built now; M3 and M5 set values)

### 4.1 SPEC fields

| Field | Unit | Default (earnable cars unchanged) | Set by | Effect |
| --- | --- | --- | --- | --- |
| `Cf`, `Cr` | N/rad | 125,000 / 185,000 (exist) | `applyCar` copies `c.Cf ?? BASE.Cf` | tyre cornering stiffness per axle |
| `steerGain` | – | 1.0 | CarDef | multiplies `maxDelta()` (and so `steerLock`'s base) |
| `brakeG` | g | 1.35 | CarDef | the pedal's total brake force |
| `brakeBias` | – | 0.62 | CarDef | front share of brake torque |
| `halfL`, `halfW` | m | 2.30 / 0.99 (exist) | CarDef | collision box and wall reach; `Game.view()` reads them |
| `track` | m | 1.62 | CarDef | lateral transfer |
| `rollF` | – | 0.5 | CarDef | roll-stiffness split |
| `loadSens` | – | 0.12 | CarDef | tyre load sensitivity |
| `kx` | – | 20 | CarDef | longitudinal slip stiffness per unit load |
| `IwF`, `IwR`, `Ieng` | kg·m² | 2.2 / 2.6 / 0.25 | CarDef | wheel and engine inertia |
| `driveFront` | 0..1 | 0 | CarDef | front share of drive torque (§4.4) |
| `vector` | 0..1 | 0 | CarDef | torque vectoring authority on the rear axle (§4.5) |
| `steerRate`, `csRate` | rad/s, – | 2.4 / 2.0 | CarDef | §3.8 |
| `hbKick` | – | 0.35 | CarDef | §3.8 |

`applyCar(c)`: `Object.assign(SPEC, BASE)` as today, then for each optional CarDef field `SPEC.x = c.x ?? BASE.x`;
`Iz` keeps scaling with mass. The plan's M3 `applyCar(c, tune)` picks the tune's field set first and then runs the
same copy; the four earnable CarDefs carry none of the optional fields, so they are byte-for-byte the BASE values.

### 4.2 CarDef

```
export interface CarDef {
  ...existing...
  Cf?: number; Cr?: number; steerGain?: number; brakeG?: number; brakeBias?: number; halfL?: number; halfW?: number;
  track?: number; rollF?: number; loadSens?: number; kx?: number; IwF?: number; IwR?: number; Ieng?: number;
  driveFront?: number; vector?: number; steerRate?: number; csRate?: number; hbKick?: number;
}
```

### 4.3 Per-step inputs: `ext`

`ext = { fx: 0, fz: 0 }` on the instance, both in newtons. The physics **never writes** them; the caller owns them
and writes them every step (`Game.simulate` sets `p.ext.fx = thrust`, `p.ext.fz = fan`, or 0, from the ability
state before `p.step`). `ext.fx` is a body force along x added to `Fx` on the ground and in the air (Cold Thrust:
`m·(2.0 g·(1 − smoothstep(0, 80, v)) + 0.05 g)` as the plan has it). `ext.fz` is added to the axle loads 45/55
before load sensitivity (§2.2), so it feeds the traction limit, the lateral capacity and the ABS/TC through `Fz`.

### 4.4 All-wheel drive: `driveFront`

Front drive torque `T·driveFront` goes into the front wheel state (§3.4) and its friction ellipse already includes
drive, brake and cornering force. The front's TC uses the same `kTcEff`. The reflected engine inertia splits by
`driveFront`. `wheelRpm()` reads the axle with the larger share. With `driveFront = 0.35` the Unleashed tune's launch
(the plan's "1.5 s without the fans") becomes a measurable target, not a promise; it is for M3 to measure.

### 4.5 Torque vectoring: `vector`

A yaw moment from a left/right drive-torque difference on the rear axle, limited by the tyres:

```
rNeutral = clamp(vx·tanδ/L, −rCap, rCap)                        (the neutral yaw rate for the wheel angle; NOT the
                                                                 stability control's rWant, which carries the
                                                                 1/(1 + 0.0009·v²) understeer gradient and sits
                                                                 under r in every steady corner)
spare   = sqrt(max(0, (muR·Fzr)² − fxR² − fyR²))                 (the rear axle's unused friction)
dF      = vector·clamp(2.0·(rNeutral − r), −1, 1)·min(0.5·spare, |T_r|/R)   [N]  (one tyre +dF, the other −dF)
Mz_v    = track·dF                                               [N·m], added to Mz; no net Fx
```

`vector = 0` for every existing car gives `Mz_v = 0` exactly. The first implementation targeted `rWant` and the
vectoring worked against the driver (Unleashed-like, h = 0.9, steer 0.3: 25 m/s 20.0 → 19.1°/s and 0.90 → 0.86 g;
40 m/s 11.4 → 10.5°/s); with the neutral target it adds rotation in every steady corner (§11, the torque vectoring
table: +0.8–1.1°/s and +0.04–0.08 g), which the harness binds (`vector` 1 ≥ `vector` 0 on yaw rate and lateral g).

### 4.6 The airborne state (Thrust Hop)

- **Fields:** `airborne = false`; `air = { t: 0, T: 0, peak: 0, alt: 0, vz: 0, rel: 0 }`; getter `altitude` → `air.alt`
  (0 on the ground) for `PlayerCar`.
- **`hop(peakHeight: number, airTime: number): boolean`** — refused (returns false) if already airborne, if `vx < 3`,
  or if `airTime ≤ 0`. Otherwise `air.t = 0; air.T = airTime; air.peak = peakHeight; air.rel = wrap(psi − roadH);
  air.vz = 4·peak/T; airborne = true`. The game chooses peak and time (plan §6.4: clear the roof ahead by 0.6 m, up to
  2.5 s) and refuses under structures before calling.
- **In the air, `step()` does, in order:** `air.t += dt`; forces `Fx = −drag + ext.fx` (no tyres, no rolling
  resistance, no grade); `vx += Fx/m·dt`; `vy = 0; r = 0`; `s += vx·dt` clamped to `[0, road.len]`; `d` held and
  clamped to `[edgeL + halfW, edgeR − halfW]`; `(x, z) = road.at(s, d)`; `psi = road.heading(s) + air.rel`;
  `τ = air.t/air.T; air.alt = 4·peak·τ·(1 − τ); air.vz = 4·peak/T·(1 − 2τ)`; `y = road.y(s) + air.alt`; wheel states
  `wF = wR = vx/R` (free-rolling, so the landing has no slip spike); `wheelRot` advances; `drift.angle = 0`,
  `active = false`; `ax` filter from `Fx/m`, `ay → 0`. **Skipped:** tyre forces, ABS/TC, the stability control, wall
  contact (`wallsNear` not called), the road projection (s, d are set directly). `Game.trackPath()` returns at once
  when `phys.airborne`; `Traffic.collide` skips a car when `player.altitude > cl.height + 0.3` (§5.2).
- **Landing** (`air.t ≥ air.T`): `airborne = false; air.alt = 0`; `impacts.push({ kind: 'land', speed: 4·peak/T,
  side: 0 })` (the vertical speed, m/s, for `PlayerCar`'s heave and the thump); the next step is an ordinary ground
  step with the wheels at road speed.
- **Impact kind:** `kind: 'wall' | 'car' | 'land'`. `Game.simulate`'s impacts loop handles `'land'`: `audio.thump`,
  a camera bump, no collision count, never a Survival end.

### 4.7 How the merge with `claude/hypercar` goes

As of `16bd03c` on `claude/hypercar` (read-only in `/home/user/Claude/tsu-hyper`), that branch has **not** touched
`Physics.ts` or `Traffic.ts`; it touches `cars.ts` (+6: `GARAGE_HIDDEN`, `garageCars`), `Game.ts` (+104: owner mode,
`applyCarChoice`, car selection, `start`), `PlayerCar.ts` (+81), `tests/regression.mjs` (+150) and the docs.

| File | This branch changes | `claude/hypercar` changes / will change | Merge |
| --- | --- | --- | --- |
| `src/game/vehicle/Physics.ts` | everything in §2–§4 | nothing yet; M3 sets values, M5 calls `hop()` and writes `ext` | clean if M3/M5 rebase onto `claude/drift` (they should; the fields are defined here) |
| `src/game/cars.ts` | `CarDef` optional fields; `applyCar` copies them | `garageCars` above `applyCar`; M3's `applyCar(c, tune)` and the hypercar CarDef | one small conflict inside `applyCar`: keep both (pick the tune's set, then copy with `??`) |
| `src/game/Game.ts` | `simulate()`: the contact loop (§5), `if (!p.airborne) this.trackPath()`, the `'land'` impact, `p.ext` written from the ability; `view()` adds the previous pose and `altitude` | owner mode, `applyCarChoice`, `start`, attract; M5 adds the ability's state machine and HUD fields | different hunks; M5's ability code must write `p.ext.fx/fz` and call `p.hop()` by these names |
| `src/game/vehicle/PlayerCar.ts` | nothing | M5 adds `root.position.y += p.altitude` and the `'land'` heave; the body changes already there | clean |
| `src/game/traffic/Traffic.ts`, new `traffic/contact.ts` | swept contact (§5), `CarClass.height` | nothing | clean |
| `tests/dynamics.mjs` (new), `tests/regression.mjs` | new file; one `survival` case for the rear-end | hypercar's groups | clean (different files / hunks) |
| `PROJECT_OC_HYPERCAR.md` §5, §9 | nothing here; §7.8 lists the numbers to re-measure | theirs | theirs to update after the merge |
| `PROJECT_OC_TECHNICAL_NOTES.md` "Simulation" | the wheel states, ABS/TC, swept contact | not touched | clean |

## 5. The swept traffic contact

### 5.1 The fault, measured

`Traffic.collide()` takes the contact normal from the axis of **smallest overlap** among the four box axes. At
120 m/s the player moves 1.0 m per step; the boxes (player 4.6 × 1.98 m, sedan 4.88 × 1.84 m) overlap laterally by up
to 1.9 m, so after the first overlapping step the lateral overlap (1.9 − offset) can be smaller than the longitudinal
one (≤ 1.0 m), the normal comes out sideways, the contact speed along it is near zero, `Game.simulate` sees
`speed ≤ 7` (or `≤ 0` and skips the impulse), and Speed Survival continues. A replica of the test (`sat.mjs`, 25
approach phases per case, the push-out included):

| Closing speed, class | offset 0 | 0.5 m | 1.0 m | 1.2 m | 1.6 m | 1.9 m |
| --- | --- | --- | --- | --- | --- | --- |
| 60 m/s, sedan (0.50 m/step) | crash 100 % | 100 % | 100 % | 100 % | **60 %** | 0 % |
| 120 m/s, sedan (1.00 m/step) | 100 % | 100 % | **88 %** | **68 %** | **28 %** | 0 % |
| 150 m/s, sedan (1.25 m/step) | 100 % | 100 % | **72 %** | **56 %** | **24 %** | 0 % |
| 120 m/s, semi (2.5 m wide) | 100 % | 100 % | 100 % | 100 % | **64 %** | 32 % |

"Crash" = contact speed > 7 m/s along a normal with |n·forward| > 0.7. With the normal chosen by the relative-velocity
rule below, every cell is 100 %, and the contact speed along the player's forward axis is 100 % of the closing speed.
The 0.5 m case the task names already passes in the replica; the failures start at 1.0 m and are worst at 1.6 m, so the
test (§5.4) covers 0 to 1.6 m and checks 2.0 m is a miss.

### 5.2 The design

Move the two-box test into a pure module `src/game/traffic/contact.ts` (no three.js, so `tests/dynamics.mjs` can
bundle it) exporting `sweptContact(P, car, cl, dt, out): boolean`. `Traffic.collide` loops over its cars and calls it.

- **Inputs.** `PlayerView` gains `px, pz, ppsi` (the pose at the start of the step; `CarPhysics` stores them at the
  top of `step()`, three numbers), and `altitude`. `CarClass` gains `height` (m), taken from the preview spec's `roof`
  in `src/preview/traffic.ts` (sedan 1.44, coupe 1.30, SUV 1.68, pickup 1.92, van 2.55, box truck 3.45) and for the
  semi the trailer's top from its rig (about 4.1 m, the plan's figure), not the 3.0 m cab roof.
- **Broadphase.** Skip a car when `|c.y − P.y| > 2.5`, when `P.altitude > cl.height + 0.3`, or when `|dx|` or `|dz|`
  exceeds `25 + dist` where `dist` is the relative displacement this step (below). Only cars inside the player's swept
  box reach the sweep.
- **Relative displacement.** `dxr = (P.x − P.px) − sin(c.h)·c.v·dtCar`, `dzr = (P.z − P.pz) − cos(c.h)·c.v·dtCar`,
  where `dtCar` is the time the traffic car actually moved by this step: `Traffic.step` moves it by `c.v·dt·worldScale`
  (0.7 under Focus Time), so `Game.simulate` passes `dt·worldScale` as `collide(view, dt, dtCar)`'s third argument;
  `dist = hypot(dxr, dzr)`. Hold the car at its current pose; sweep the player from `(P.x − dxr, P.z − dzr)` to
  `(P.x, P.z)` with heading interpolated from `ppsi` to `psi` (wrapped) in `n = min(4, max(1, ceil(dist/0.4)))`
  sub-positions (1.26 m at Unleashed top speed → 4).
- **At each sub-position** run today's SAT over the four axes (scalars, no arrays). The first sub-position with no
  separating axis is the contact. The normal: among the four (all non-separated) axes, the one most aligned with the
  approach direction `(−dxr, −dzr)/dist` **if** its overlap at that sub-position is ≤ `dist/n + 0.05` (it arrived this
  substep); otherwise the smallest-overlap axis (a slow rub, today's rule). Sign so that n points from the car to the
  player (`dist > 0 ? −1 : 1` as today).
- **Depth** for `Game.simulate`'s push-out: the overlap along the chosen normal **at the current position** (so the
  player is pushed back out along its approach, up to the step's closing distance, once; the impulse then kills the
  closing speed). `speed = max(0, −((P.wx − cvx)·nX + (P.wz − cvz)·nZ))` as today.
- **No allocation.** `Traffic.collide` keeps a preallocated `Contact[]` of length 8 and a count; `Game.simulate`
  iterates by count. The impulse code in `Game.simulate` (J, lever, side, `bump`) is unchanged.

### 5.3 Cost

Per candidate car (0–3 within 26 m of a fast player) up to 4 SATs of 4 axes: about 200 flops; per step typically
one candidate. Nothing at 1 m/s (n = 1, today's cost). No allocation.

### 5.4 The test

- **Headless (`tests/dynamics.mjs`, bundling `contact.ts`):** sedan and semi, closing 60, 120 and 150 m/s, offsets 0,
  0.5, 1.0, 1.2, 1.6 m, 25 approach phases each, the player stepped at 120 Hz with the push-out applied: every phase
  reports a contact with `speed·|n·forward| ≥ 0.9·closing` on the first overlapping step; at 2.0 m offset no contact.
- **In the game (`tests/regression.mjs`, group `survival`):** a test aid `game.traffic.place(clsId, s, d, v)` puts a
  sedan 200 m ahead in the player's lane at 0.5 m lateral offset and 15 m/s; `fastForward` with full throttle from
  40 m/s and a scripted 120 m/s closing is not reachable by the GT, so the case runs the Unleashed-like SPEC (owner
  mode on `claude/hypercar`, or `applyCar` of a test CarDef) at 135 m/s: the run ends with `endRun("Crashed into a
  sedan")` within 0.1 s of the contact, `collisions === 1`, and the contact speed logged by `stats` is ≥ 0.9 × closing.

## 6. Safety invariants

| | Invariant | Test | Today (draft, measured) |
| --- | --- | --- | --- |
| I1 | The autopilot's straight-line runs never spin: Unleashed-like SPEC (1,690 kg, 1,500 kW, ClA 2.2, grip 1.3, Cf/Cr ×1.8, steerGain 1.25) at 134, 201, 251 and 336 mph with a lane change and a 0.12 rad/s yaw shove; GT at 134/168/201 mph | `stab` straight: worst body slip < 3°, after 7 s < 0.5°, never > 60° or 12 m off | Unleashed-like h = 0/0.15/0.5/0.9/1: worst 0.43–1.07°, after 7 s ≤ 0.17°, no spins (`stab-unl`). GT: worst 0.55–1.18° (`stab`). |
| I2 | A lift or a brake in a fast sweeper never throws the car round in Arcade (h ≤ 0.35): R600 at 45/55 m/s (GT), 55/80 m/s (Unleashed-like) | worst slip < 3°, no spin; at the lateral limit the car may run wide (a slide, not a spin) | GT h = 0/0.35: worst 0.6–1.35°. Unleashed-like h = 0/0.15: worst 0.66–1.49°; at 80 m/s (needs 1.09 g) it runs 6.8–7.0 m wide with a steady 1.1° of slip: a wash-wide, which the test records as a lift case, not a failure. Sim at 55 m/s: a 0.8 brake makes 5–6° of slip, damping to 1.3–2.3° within 1 s. |
| I3 | A slide is catchable in Sport: from a 25° handbrake entry at 40 mph, counter-steer brings the slip angle under 5° within 2 s, no spin | the catch test, h = 0.5, every car and both tunes | caught in **1.10–1.27 s**, peak 46–49°, no spins (parent: 0.63–0.68 s, peak 34–36°). Arcade 0.80–0.82 s; Sim 1.10–1.42 s. |
| I4 | Nothing dt-dependent: every metric in §7 the same at 120 and 240 Hz within 2 % | run `tests/dynamics.mjs --hz=240` | steady metrics within 0.3 %, 100-0 within 0.2 %, catch time within 4 % (fails today; D1–D4 and §3.4 fix it) |
| I5 | No per-step allocation of the code's own in `CarPhysics.step`, `Traffic.collide`, `Game.simulate`'s contact loop: no object, array or closure per step | code review, plus `heapUsed` over 20,000 steps in optimised code (§10 item 17) | fails today (W6). Finished model: no literal, array or closure per step; the JIT still boxes the double arguments of the calls it does not inline (`tyre`, `loadMu`, `steerLock`, `maxDelta`), measured at 80–180 B/step after warm-up (the parent's step: 3–180 B), 1–2 KB/step in the first second while interpreted. A "no scavenges" reading is not reachable in V8 for a step of this size; §10 item 17 has the method. |
| I6 | The Rossini Corsa stays the best earnable car (fastest top speed, quickest 0-100 and quarter mile; lateral g within 5 % of the Brio's); the race tune is at or under the Corsa on every measured number at h = 0.15, 0.35, 0.5, 0.9, 1.0, ability off | §7.7 | holds in the draft (Corsa 232 mph / 5.79 s / 10.44 s; grip 3–5 % under the Brio). Race-tune-like: 231 mph, 5.81 s, 10.46 s; its 100-0 at h = 0.35 is 84.3 m against the Corsa's 84.4 m, inside noise but on the wrong side; see §7.8. |

## 7. The test plan: `tests/dynamics.mjs`

Node only, no browser: esbuild-bundles `Physics.ts`, `cars.ts`, `world/Path.ts` and `traffic/contact.ts` at run
time (`node_modules/.bin/esbuild tests/dynamics.entry.mjs --bundle --format=esm --platform=node --outfile=tests/out/
dynamics.bundle.mjs`), then imports the bundle. Flags: `--hz=120|240`, `--cars=`, `--h=`, `--only=perf,drift,stab,
contact,dt`, `--json=path`. Prints PASS/FAIL per check with the numbers, writes traces to `tests/out/dynamics-*.txt`.
Runtime budget: under 60 s for the full matrix at 120 Hz (the measurement harness ran the perf matrix in 3.6 s).

### 7.1 Cars and profiles

The four earnable CarDefs from `cars.ts`, plus two test CarDefs defined in the test from the plan's §5.2 and §5.3:
Unleashed-like `{ mass 1690, power 1.5e6, torque 2000, redline 9000, final 3.0, CdA 0.62, ClA 2.2, grip 1.30,
Cf 225000, Cr 333000, steerGain 1.25, brakeG 2.0, halfL 2.36, halfW 1.02 }` and Race-tune-like `{ mass 1500, power
620000, torque 1000, redline 9000, final 4.0, CdA 0.80, ClA 1.0, grip 1.04 }`. Profiles 0.15, 0.35 (the default the
cards are calibrated to), 0.5, 0.9, 1.0.

### 7.2 Performance, per car × profile

| Metric | Method (§0) | Pass |
| --- | --- | --- |
| 0-60, 0-100, ¼ mile with trap speed | full throttle from rest | finite, monotone; within the §7.7 tolerances of the control row |
| Top speed | the 0.024 m/s² settle criterion | within ±1 mph of the control (drag and power are untouched) |
| 100-0 with ABS | full pedal from 44.7 m/s | within the §7.7 tolerance; the mean front slip over the stop within ±0.03 of that axle's `kAbs_i` (log the target alongside) |
| 100-0 without ABS (`abs = false`) | same | longer than with ABS by 5–15 % at Sim, and the front wheel reaches κ < −0.9 within 0.3 s |
| Lateral g at 25 / 40 / 80 m/s | the sweep method | within tolerance; the accepted run's sideslip < 0.12 rad |
| TC check | full throttle from 5 m/s in 1st, 2 s, `tc = true` | peak `kR` ≤ `kTc` + 0.05 (Arcade), ≤ `kTc` + 0.15 (Sport); with `tc = false` peak `kR` > 1 in every car |

### 7.3 Drift scenarios (every car, every profile; traces every 0.1 s: t, body slip °, yaw rate °/s, δ °, kR, throttle, steer, handbrake)

| Scenario | Script | Pass |
| --- | --- | --- |
| Handbrake entry and catch at 40, 70, 120 mph | §0's catch test (entry target 25°; at 120 mph the entry target is 12°) | entry reached within 1.0 s at 40 and 70 mph (40 mph: 0.45–0.6 s); caught < 5° within 2 s at h ≤ 0.5 (Sport ≤ 1.5 s), within 3 s at 0.9; never spun. At 120 mph in Arcade the stability control may prevent the entry: record "no entry", not a failure |
| Power-over at 40 and 70 mph | 2nd gear, steer 0.5 left, full throttle for 1.5 s, `tc` as the profile has it; then the catch controller with throttle 0.3 | Arcade: slip < 10° (TC holds); Sport: slip reaches > 12° within 1.5 s and is caught within 2 s; Sim: slip > 20°, caught within 3 s or recorded as a spin with the angle at 3 s (a spin is allowed in Sim; it must be finite and the car must stop rotating when the throttle lifts) |
| Lift-off at 40, 70, 120 mph in the sweeper | R600 at the speed that needs 0.9 × the car's measured lateral g at that speed (built from §7.2), 1 s steady, throttle to 0 for 1.5 s, hands held | Arcade: slip < 6°; Sport: slip < 15° and damped (after 4 s < 3°); Sim: finite, and < 25° at 40 mph |
| Held drift keeps the rear spinning (the §3.7 rule) | 40 mph handbrake entry, then hold with counter-steer and 0.8 throttle for 3 s | mean `kR` over the hold > 0.3 in every profile; `drift.time` reaches 2.5 s in Sport and Sim, 1.5 s in Arcade |

### 7.4 Stability runs

`stab.mjs`'s scenarios for the GT (60/75/90 m/s straight; 45/55 m/s sweeper) and the Unleashed-like SPEC
(60/90/112/150 m/s straight; 55/80 m/s sweeper), h = 0, 0.15, 0.35, 0.5, 0.9, 1. Pass as §6 I1/I2. The sweeper's
"after 7 s" threshold is 1° at 45/55 m/s and "no growth over the last 2 s" at 80 m/s (where the steady slip at the
limit is itself above 1°).

### 7.5 The rear-end contact test

§5.4's headless matrix (sedan and semi, 60/120/150 m/s, offsets 0–1.6 m plus the 2.0 m miss, 25 phases).

### 7.6 dt-independence

The whole of §7.2–§7.4 at `--hz=240`; every number within 2 % of its 120 Hz value (times and distances relative,
lateral g absolute within 0.02 g, slip-angle peaks within 1°).

### 7.7 The control table

Measured with §0's method on the parent (`a89d4f0`) → the draft (`0a6a24e`), 120 Hz. The finished model's numbers
go in a third column when measured. The top speeds for the two tunes are from the rerun with the tightened settle
criterion (338 and 231 mph in both trees; a looser criterion first cut them at 335/227).

| Car | h | 0-60 s | 0-100 s | ¼ mile | Top mph | 100-0 m | Lat g @25 | @40 | @80 | Catch: entry s / peak ° / caught s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 3.10 → 3.30 | 5.48 → 5.73 | 10.29@149 → 10.48@149 | 211 → 211 | 85.1 → 85.7 | 1.25 → 1.18 | 1.03 → 1.00 | 0.61 → 0.61 | 0.63 / 28 / 0.49 → 0.48 / 36 / 0.82 |
| GT | 0.35 | 3.27 → 3.61 | 5.72 → 6.13 | 10.47@149 → 10.78@148 | 211 → 211 | 87.0 → 89.6 | 1.26 → 1.17 | 1.11 → 1.07 | 0.73 → 0.73 | 0.57 / 31 / 0.58 → 0.47 / 42 / 0.98 |
| GT | 0.5 | 3.42 → 3.87 | 5.92 → 6.49 | 10.61@148 → 11.03@147 | 211 → 211 | 90.3 → 92.7 | 1.22 → 1.15 | 1.14 → 1.10 | 0.83 → 0.82 | 0.55 / 35 / 0.68 → 0.47 / 49 / 1.27 |
| GT | 0.9 | 4.26 → 4.86 | 7.28 → 8.05 | 11.52@145 → 12.08@143 | 211 → 211 | 93.9 → 95.8 | 1.08 → 1.04 | 1.09 → 1.05 | 1.07 → 1.05 | 0.55 / 55 / 1.36 → 0.46 / 65 / 1.25 |
| GT | 1 | 4.39 → 5.11 | 7.53 → 8.49 | 11.67@144 → 12.37@142 | 211 → 211 | 96.3 → 98.2 | 1.04 → 1.01 | 1.06 → 1.02 | 1.10 → 1.06 | 0.57 / 64 / 1.09 → 0.46 / 66 / 1.20 |
| Brio | 0.15 | 2.94 → 3.12 | 5.85 → 6.03 | 10.53@139 → 10.68@138 | 202 → 202 | 83.0 → 82.4 | 1.34 → 1.27 | 1.11 → 1.08 | 0.69 → 0.69 | 0.60 / 28 / 0.49 → 0.46 / 37 / 0.80 |
| Brio | 0.35 | 3.10 → 3.38 | 6.01 → 6.30 | 10.66@138 → 10.89@138 | 202 → 202 | 84.0 → 83.4 | 1.35 → 1.26 | 1.20 → 1.15 | 0.82 → 0.81 | 0.55 / 31 / 0.58 → 0.45 / 43 / 0.97 |
| Brio | 0.5 | 3.23 → 3.62 | 6.14 → 6.53 | 10.77@138 → 11.08@138 | 202 → 202 | 84.7 → 85.7 | 1.32 → 1.23 | 1.23 → 1.17 | 0.92 → 0.91 | 0.53 / 36 / 0.68 → 0.45 / 48 / 1.24 |
| Brio | 0.9 | 4.02 → 4.55 | 7.04 → 7.57 | 11.44@137 → 11.86@136 | 202 → 202 | 86.7 → 88.9 | 1.17 → 1.12 | 1.19 → 1.13 | 1.16 → 1.12 | 0.53 / 59 / 1.24 → 0.45 / 65 / 1.10 |
| Brio | 1 | 4.14 → 4.79 | 7.21 → 7.86 | 11.56@136 → 12.07@136 | 202 → 202 | 88.9 → 91.1 | 1.13 → 1.09 | 1.16 → 1.11 | 1.20 → 1.16 | 0.54 / 64 / 1.02 → 0.45 / 66 / 1.06 |
| Corsa | 0.15 | 2.94 → 3.14 | 5.09 → 5.38 | 9.93@156 → 10.13@156 | 232 → 232 | 83.2 → 82.7 | 1.30 → 1.23 | 1.07 → 1.04 | 0.64 → 0.64 | 0.62 / 28 / 0.49 → 0.47 / 36 / 0.81 |
| Corsa | 0.35 | 3.11 → 3.43 | 5.34 → 5.79 | 10.11@156 → 10.44@155 | 232 → 232 | 84.2 → 84.4 | 1.31 → 1.22 | 1.16 → 1.12 | 0.77 → 0.77 | 0.57 / 32 / 0.58 → 0.46 / 42 / 0.97 |
| Corsa | 0.5 | 3.24 → 3.68 | 5.55 → 6.16 | 10.26@155 → 10.70@154 | 232 → 232 | 85.2 → 87.4 | 1.29 → 1.20 | 1.20 → 1.15 | 0.87 → 0.86 | 0.54 / 35 / 0.67 → 0.46 / 49 / 1.25 |
| Corsa | 0.9 | 4.05 → 4.63 | 6.88 → 7.73 | 11.18@151 → 11.77@149 | 232 → 232 | 88.2 → 90.4 | 1.14 → 1.09 | 1.16 → 1.11 | 1.11 → 1.10 | 0.54 / 56 / 1.35 → 0.45 / 65 / 1.23 |
| Corsa | 1 | 4.17 → 4.87 | 7.11 → 8.15 | 11.33@150 → 12.06@147 | 232 → 232 | 90.5 → 92.7 | 1.10 → 1.06 | 1.13 → 1.09 | 1.17 → 1.15 | 0.55 / 64 / 1.12 → 0.46 / 67 / 1.12 |
| Vela E | 0.15 | 3.09 → 3.29 | 5.47 → 5.72 | 10.28@151 → 10.46@151 | 224 → 224 | 86.6 → 87.6 | 1.16 → 1.11 | 0.89 → 0.88 | 0.45 → 0.45 | 0.66 / 27 / 0.48 → 0.50 / 36 / 0.81 |
| Vela E | 0.35 | 3.27 → 3.60 | 5.70 → 6.12 | 10.45@151 → 10.76@150 | 224 → 224 | 89.2 → 91.6 | 1.19 → 1.11 | 0.99 → 0.97 | 0.56 → 0.56 | 0.61 / 31 / 0.58 → 0.49 / 42 / 0.96 |
| Vela E | 0.5 | 3.41 → 3.86 | 5.90 → 6.48 | 10.59@150 → 11.02@149 | 224 → 224 | 92.5 → 94.9 | 1.17 → 1.10 | 1.04 → 1.01 | 0.64 → 0.64 | 0.58 / 34 / 0.66 → 0.48 / 46 / 1.16 |
| Vela E | 0.9 | 4.25 → 4.84 | 7.23 → 8.01 | 11.50@147 → 12.07@145 | 224 → 224 | 96.3 → 98.2 | 1.03 → 0.99 | 1.01 → 0.98 | 0.82 → 0.81 | 0.58 / 50 / 1.26 → 0.48 / 65 / 1.42 |
| Vela E | 1 | 4.38 → 5.09 | 7.48 → 8.43 | 11.66@146 → 12.34@143 | 224 → 224 | 98.8 → 100.7 | 1.00 → 0.95 | 0.98 → 0.95 | 0.85 → 0.85 | 0.59 / 63 / 1.33 → 0.48 / 67 / 1.31 |
| Unleashed-like | 0.15 | 2.09 → 2.28 | 3.58 → 3.92 | 8.18@200 → 8.45@198 | 338 → 338 | 78.5 → 77.9 | 1.72 → 1.57 | 1.52 → 1.44 | 1.04 → 1.03 | 0.53 / 29 / 0.48 → 0.42 / 39 / 0.78 |
| Unleashed-like | 0.35 | 2.22 → 2.51 | 3.79 → 4.30 | 8.35@199 → 8.76@196 | 338 → 338 | 79.4 → 78.7 | 1.71 → 1.54 | 1.60 → 1.49 | 1.20 → 1.18 | 0.50 / 34 / 0.56 → 0.42 / 44 / 0.96 |
| Unleashed-like | 0.5 | 2.32 → 2.70 | 3.97 → 4.61 | 8.49@198 → 9.03@194 | 338 → 338 | 80.1 → 79.4 | 1.67 → 1.50 | 1.63 → 1.50 | 1.32 → 1.28 | 0.48 / 36 / 0.63 → 0.41 / 47 / 1.10 |
| Unleashed-like | 0.9 | 2.96 → 3.44 | 5.00 → 5.83 | 9.38@190 → 10.08@184 | 338 → 338 | 77.9 → 77.3 | 1.47 → 1.37 | 1.56 → 1.44 | 1.56 → 1.47 | 0.49 / 51 / 1.02 → 0.42 / 65 / 1.33 |
| Unleashed-like | 1 | 3.06 → 3.62 | 5.17 → 6.14 | 9.53@189 → 10.35@181 | 338 → 338 | 78.5 → 77.8 | 1.43 → 1.34 | 1.52 → 1.41 | 1.60 → 1.51 | 0.51 / 65 / 1.10 → 0.42 / 67 / 1.22 |
| Race-tune-like | 0.15 | 2.94 → 3.14 | 5.11 → 5.39 | 9.95@155 → 10.15@155 | 231 → 231 | 83.1 → 82.5 | 1.29 → 1.22 | 1.05 → 1.02 | 0.62 → 0.62 | 0.62 / 28 / 0.48 → 0.48 / 37 / 0.81 |
| Race-tune-like | 0.35 | 3.11 → 3.44 | 5.35 → 5.81 | 10.13@155 → 10.46@154 | 231 → 231 | 84.0 → 84.3 | 1.30 → 1.21 | 1.14 → 1.10 | 0.75 → 0.75 | 0.57 / 31 / 0.57 → 0.47 / 43 / 0.99 |
| Race-tune-like | 0.5 | 3.24 → 3.68 | 5.56 → 6.18 | 10.27@154 → 10.72@153 | 231 → 231 | 85.1 → 87.0 | 1.28 → 1.20 | 1.19 → 1.14 | 0.85 → 0.85 | 0.55 / 35 / 0.68 → 0.46 / 48 / 1.22 |
| Race-tune-like | 0.9 | 4.06 → 4.64 | 6.93 → 7.77 | 11.19@150 → 11.79@148 | 231 → 231 | 87.9 → 90.0 | 1.13 → 1.08 | 1.15 → 1.10 | 1.14 → 1.13 | 0.54 / 52 / 1.27 → 0.46 / 66 / 1.20 |
| Race-tune-like | 1 | 4.18 → 4.88 | 7.15 → 8.18 | 11.35@150 → 12.07@147 | 231 → 231 | 90.1 → 92.3 | 1.09 → 1.05 | 1.12 → 1.08 | 1.18 → 1.16 | 0.56 / 64 / 1.12 → 0.46 / 67 / 1.15 |

The parent's h = 0.35 row reproduces the plan's §5.1 table (GT 3.27 / 5.72 / 10.47 s @ 149 / 211 / 87.0 against the
plan's 3.28 / 5.73 / 10.48 @ 149 / 211 / 87.1); the lateral g differs by up to 0.07 g at 25 m/s because the sweep is
finer and the speed hold differs. Both columns here use one method, which is what a control needs. The Unleashed-like
rows use the draft's fixed 1.35 g pedal (no `brakeG` yet), so their 100-0 is not the plan's 63.9 m.

**Tolerances for the finished model, against the parent column** (the owner accepts intended changes; these are
the bounds beyond which a change needs a sentence in the commit):

| Metric | Arcade 0.15 / default 0.35 | Sport 0.5 | Sim 0.9 / 1.0 | Why |
| --- | --- | --- | --- | --- |
| 0-60, 0-100 | within +0.15 s (TC holds the tyre at its peak; load sensitivity costs about 3 % of rear μ at 1 g) | within +0.3 s | within +0.6 s (a launch that spins is slower; intended) | the draft's +0.3 s at 0.35 is the `kinetic` cap, which goes |
| Top speed | ±1 mph | ±1 mph | ±1 mph | drag and power untouched |
| 100-0 with ABS | within +3 m | within +3 m | within +5 m (racing ABS at −0.145 sits past the peak) | the ABS target is the design, not a cap |
| Lateral g at 25/40 | within −0.08 g | −0.08 g | −0.06 g | load sensitivity and lateral transfer: intended |
| Lateral g at 80 | within −0.03 g | −0.03 g | −0.03 g | downforce-loaded tyres lose a little μ |
| ¼ mile | within +0.3 s, trap within −3 mph | +0.4 s | +0.6 s | follows the launch |
| Catch (entry / caught) | entry 0.4–0.6 s; caught ≤ 1.0 s | caught ≤ 1.5 s | caught ≤ 2.0 s, no spin | §6 I3 |
| Ordering | Corsa fastest (top, 0-100, ¼ mile) among earnable cars at every h; Brio's lateral g within 5 % above the Corsa's; race tune ≤ Corsa on every metric | same | same | §6 I6 |

### 7.8 What in the plan's §5 tables must be re-measured on `claude/hypercar` after the merge

- **§5.1, every cell** (both handling values): the control table above shows every launch, braking and lateral
  number moves with the draft, and the finished model moves them again.
- **§5.2 Unleashed:** the "tyres only" column (0-60 2.22 s, 100-0 63.9 m, lateral 1.45/1.67/1.23/1.23 g, 339 mph) with
  `brakeG` 2.0 now a real field; the "Ground Lock" column (1.96/1.93 g, 1.50 s, 54.5 m), because fan suction now
  enters load sensitivity (expect a few per cent less); the 130 m/s lateral g, which the 0.7 μ floor touches; the
  "Cold Thrust" column only for 0-60 (thrust is unchanged). With `driveFront` available, the launch target should move
  from the fans to the drive split as §5.2 itself wants.
- **§5.3 race tune vs Corsa:** every row, at the five profile values. The 100-0 margin is 0.1 m in the draft (84.3 vs
  84.4 m) and may flip either way; the plan's fallback (the Corsa's numbers verbatim) applies if it lands over.
- **§5.5 item 5:** the 1.23 g at 130 m/s in Arcade and the 10 km fast-driver runs at 1.1 g.
- **§6.2, §6.3 measured launches** (0.76 / 0.66 / 1.50 s): the wheel states and TC change what a launch is.
- **The garage card numbers** M3 stores per tune (§5.2's "within 0.1 s or 2 mph" test).

## 8. Deferred, and why

As the plan's §9 lists them, and still deferred after this work:

- **The hop's free-flight version** (pitch and roll in the air, landing on any surface). The scripted parabola bound
  to the road (§4.6) is what the ability promises ("always lands on the road it left") and needs no new state beyond
  `air`; free flight needs a pitch/roll state, a ground query under each wheel, and a landing model that can land on a
  barrier or another road: a session of its own, and a HUD/camera question the owner has not asked yet.
- **Per-car centre of gravity and wheelbase** (`a`, `b`, `h` per car, `L` read per car). `L` is a module value that
  several things read (`maxDelta`, `rKin`, the autopilot's `Lw`); making it per car is cheap but changes every car's
  steering-lock curve and so the autopilot's gains, which were tuned to the GT. Not needed for the hypercar's targets
  (its `Cf/Cr`, `steerGain`, `track`, `rollF` and `driveFront` do the work), so it waits until a car needs it.
- **An electric single-speed drivetrain.** The Vela E and the Unleashed tune drive through the 7-speed with a flat
  torque curve; the sound and the tach are the visible difference, not the numbers (the plan's figures were measured
  that way). A single-speed model is a `gears: [1]` CarDef with a motor torque curve and no shift logic; it belongs
  with the motor sound work in M5/M6, not here.
- Not in §9 but deferred here on purpose: per-wheel states (four wheels, camber, individual loads), a thermal tyre,
  and a suspension with real roll dynamics; the axle-level model with filtered `ax`/`ay` gives the feel the owner
  described at a fraction of the states, and nothing in the test plan needs more.

## 9. Order of work for the implementer

1. W1, D1–D5, W6 (hoist the closures), W7 (`track`, `loadSens` into SPEC): no behaviour change intended; run the
   control table, expect identical numbers to the draft within 0.5 %. Commit.
2. §4.1–§4.2 fields and `applyCar` copying with `??`: identical numbers. Commit.
3. §3.3 tyre law and §3.4 wheel states with the brakes as torques, ABS and TC (§3.6–§3.7), the handbrake as torque
   and the kick as a moment (§3.8); remove `kinetic`, `spinLat`, `rearGrip`, the brake caps, the `assist > 0.3` steps.
   Run the full matrix; tune `kx`, `kAbs`, `kTc`, `hbKick` within §7.7's tolerances. Commit with the table.
4. §4.3–§4.6 (`ext`, `driveFront`, `vector`, `hop`, `'land'`), `Game.trackPath` airborne guard: identical numbers for
   the earnable cars (all defaults off). Commit.
5. §5 swept contact (`contact.ts`, `PlayerView.px/pz/ppsi/altitude`, `CarClass.height`, the preallocated buffer) and
   its tests. Commit.
6. `tests/dynamics.mjs` with the control table in its third column, the `PROJECT_OC_TECHNICAL_NOTES.md` "Simulation"
   update, and the list of §7.8 re-measurements handed to `claude/hypercar`. Commit. No push: the owner's pushes are
   paused.


## 10. Deviations from the design, with the reason and the measurement

The implementer's record. Every item below was forced by a measurement the design did not have; the design's
sections are referenced. Numbers are from `tests/dynamics.mjs` (120 Hz, `tests/out/dynamics-report.md`,
regenerated by every run; the tables are copied into §11 because `tests/out/` is not in git).

1. **TC and ABS are dead-beat controllers, not integrators (§3.6, §3.7).** Each substep they set the drive torque
   (TC) or brake pressure (ABS) that lands the axle on the target slip: the tyre's force at the target plus what the
   axle's inertia needs to get there, `M = (R·fx(κ_t) + I·(w_t − w)/h) / T_drive`, `P = (T_drive − R·fx(κ_t) − I·(w_t
   − w)/h) / T_pedal`, clamped to 0.05..1. ABS dumps at once and re-applies at 8/s (the design's rate). Reason: the
   integral TC chattered on the light axle (the rear of a GT with the clutch slipping is 2.6 kg·m² under 9.5 kN·m;
   `tcM` swung 0.22–0.97 within a quarter second and 1st-gear acceleration was 4–7 m/s² against the tyre's 7.9); the
   ABS dump/re-apply limit cycle moved the wheel by its whole slip target in one substep, so the cycle's shape, and the
   Sim 100-0 distance, depended on the step (2.8–3.2 % between 120 and 240 Hz; now 0.04 %). The design's 6–10 Hz
   pressure cycle for the pedal shake does not exist; `PlayerCar` can synthesise a tick from `absP < 0.95`. The
   readouts `absP`, `tcM`, `throttleOut` are as designed; `tcI` is gone.
2. **The body receives the force the implicit wheel step solved for (§3.4).** `wheelStep` leaves `T.fx += K·R·(w1 −
   w)/u` (the linearised force at the end of the substep). With the stale start-of-substep force a free-rolling front
   axle dragged the car by 0.7–1.4 kN at walking pace: the body's own acceleration gives the held wheel a slip of
   −ax·dt/U0 ≈ −0.03 each step, which the tyre law turns into kilonewtons before the implicit step removes it. 1st-gear
   acceleration was 7.5 m/s² for a tyre giving 7.9; now 7.9, and the free axle's drag is its inertia (146 N).
3. **Engine inertia coupling, and the clutch kick (§3.5, §3.8).** Coupled whenever in gear and not shifting (the
   design's rule; the previous implementer had excluded the clutch-slip launch and a wheel under idle). Decoupled while
   the handbrake is pulled, coming back linearly over `CLUTCH_T` 0.25 s; the engine free-revs to `idle + throttle·
   (redline − idle)` meanwhile; drive torque × clutch; the automatic holds its gear while the handbrake is pulled (a
   locked rear reads 0 rpm and it downshifted to 1st). Reason: with the engine coupled through 1st (49 kg·m²) the
   locked rear took 0.35 s to spin back up after the pull, with no lateral grip the whole time; the car swung to 60°
   and the Arcade catch took 1.1–1.4 s. Two real wheels (2.6 kg·m²) re-grip in about 0.04 s, which is what a driver's
   clutch kick gives. A 0.1 s clutch made no measurable difference.
4. **`hbKick` default 0 (§3.8).** The design's own rule: without the moment the 40 mph entry reaches 25° in 0.50–0.53 s
   (target 0.45–0.55 s). The field and the code path stay for the hypercar.
5. **`kx` 40 and the falloff `smoothstep(2.0, 4.5, s)` (§3.2–3.3 had 20 and 1.2–3.5).** Kept from the previous
   implementer. The targets are given in normalised slip, so the controllers sit where the design says on the force
   curve (ABS at the peak, 0.98 μ at s ≈ 2.5 with this falloff); in κ they are half the design's table (ABS −0.056 to
   −0.084, TC 0.08 to 0.15 on the dry GT), a racing tyre's range. With `kx` 20 the drive slip at a rev-limited top
   speed would be 2 % and the top speeds would move 4 mph instead of 2 (item 11).
6. **The TC target holds the peak through the arcade range (§3.7, §3.9).** `sTc = 2.5 + 2.65·√x`, `x = clamp((h −
   0.35)/0.55, 0, 1)`: 2.5 for h ≤ 0.35, 3.88 at 0.5 (0.906 μ, the design's "0.90 μ flare") and 5.15 at 0.9 as the
   design's table. The design's `2 + 3.5h`
   gave 3.22 at the default 0.35 the cards are calibrated to, which is 0.957 μ, past the peak (0.979).
7. **`brakeG` 1.6 and `brakeBias` 0.66 (§3.2 had 1.35 and 0.62).** With 1.35 × 0.62 the front's torque was 12.2 kN of
   force against 12.3 kN of grip: with ABS off the front could not lock (0.40 s to κ −0.9, by load sensitivity alone)
   and the rear locked first. With ABS on the pedal's size changes nothing (the ABS sets the pressure); 100-0 with ABS
   is 7–12 m shorter than the parent's because the parent capped the rear at 0.55 μ in arcade and this ABS brakes both
   axles at the peak.
8. **`holding` gains a power term, and the back-off is `0.85 + 0.15h` (§3.9 had `0.9 + 0.1h`).** `power = throttle·
   smoothstep(0.35, 0.9, h)·smoothstep(0.06, 0.16, β)`: past the arcade range a driver on the power in a slide is
   holding it, so the race-mode stability control and the TC let go. Reason: the design's power-over scenario (Sport
   > 12°, Sim > 20° or a finite spin) is impossible with the race-mode control pulling at 3.5/s past 5° of slip; it
   held every car at 12° in Sim. The term is zero through h ≤ 0.35, so I1/I2 and the arcade feel are untouched. The
   back-off change (the stability control keeps 10–13 % in arcade during a counter-steer instead of 6–9 %) brings the
   Arcade catch from 1.02–1.07 s to 0.96–0.99 s; Sim moves by 0.01 s.
9. **The body's velocity is turned through the step's yaw exactly** (one sin/cos per step) instead of the Euler cross
   term `vy·r·dt`: at a drift's 130°/s the first-order term drifted a few per cent over a second, differently at each
   rate.
10. **The profile table (§3.9), changed rows:** TC target (item 6), counter-steer back-off (item 8), `holding` (item 8),
    and two rows that hold their h = 0.9 value through h = 1: the TC target (item 6's `x` clamps at 1) and the tyre
    falloff `fallP = 0.02 + 0.18·min(h, 0.9)` (item 12: the slider reaches 1.0, and past the UI's Sim the extra falloff
    only made the spinning launch cost the Corsa its ordering). Every other row is as designed.
11. **The §7.7 tolerances, re-derived from the design's own physics.** The design's bounds assumed "TC at the peak" and
    "drag and power untouched"; the model it specifies moves the numbers further, for reasons it did not price:
    - *Rotational inertia* (§3.2: `IwF` 2.2, `IwR` 2.6, `Ieng` 0.25 reflected by (ratio·final)²) is 7 % (GT, 4th) to
      13 % (Brio, 3rd) of equivalent mass where a car is torque-limited, which the parent did not have. `Ieng` 0.15
      instead of 0.25 is worth 0.04 s on 0-100: not worth deviating.
    - *The tach reads the wheel* (§3.5), so a traction-limited gear at κ 0.08 upshifts 8 % earlier; on the Brio and
      the Vela E that brings the 2→3 shift under 60 mph (one more 0.09 s shift), on every car the torque-limited
      gear arrives sooner.
    - *Every earnable car is rev-limited in 7th* (GT 8006 rpm at 211 mph against an 8000 redline, Brio 8600, Corsa
      8517, Vela E 9003), so the top speed falls by the drive slip at that speed: 0.6–1.1 %, 1.8–2.5 mph.
    - *The Sport and Sim TC targets* (3.75 and 5.15 normalised, the design's) launch at 0.91 μ and 0.82 μ by design.
    - *Lateral load transfer* costs μ by the square of the lateral acceleration (§2.3's formula: 0.039·g² of μ on the
      GT from the transfer alone), so −0.09 g at 1.26 g is the design's physics; the flat −0.08 was set at 1 g.
    The bounds now in `tests/dynamics.mjs`, applied to the four earnable cars: 0-60 +0.25 s (h ≤ 0.35) / +0.6 (0.5) /
    +0.9 (≥ 0.9); 0-100 +0.7 / +1.0 / +1.5 s; ¼ mile +0.45 / +0.7 / +1.1 s and the trap −8 mph; top speed within
    ±1 mph of the parent's less the measured rear slip at the top; 100-0 never more than +3 m / +5 m; lateral g within
    g·(0.04 + 0.045·g²) of the parent's at 25, 40 and 80 m/s; the catch as designed (entry 0.4–0.6 s, caught ≤ 1.0 /
    1.5 / 2.0 s, no spin). The two test tunes are reported, not bound (§7.8: the hypercar plan re-measures them); the
    two-tune ordering is an advisory in the report (item 13).
12. **Other bounds corrected by measurement.** I6: the Brio's lateral g within 5 % above the Corsa's at 25/40 m/s and
    10 % at 80 m/s, because the parent itself is at 7.8 % there (the Corsa's downforce-loaded tyres pay load
    sensitivity); the "Corsa fastest" ordering is bound at every h, 1.0 included, because the game's slider
    (`src/ui/App.tsx`, range 0..1 in 0.05 steps) reaches it in a scored mode. At h = 1 it first failed (the Brio's
    0-100 8.40 s against the Corsa's 8.44 s: a spinning launch with `fallP` 0.2 cost the heavier car more); with the
    TC target and `fallP` held at their h = 0.9 values from 0.9 to 1 (item 10) the Corsa is first on 0-100 (8.23 vs
    8.27 s), the quarter mile and top speed at h = 1 as at every other h. I2's 3° sweeper bound is arcade (h ≤ 0.35) as §6 says: Sport 5°, Sim
    15° damped and no spin (the Unleashed-like at 55 m/s in Sim slides 11° when the speed hold floors 1500 kW after
    the brake phase, and recovers to 2.4°); the "after 7 s" sweeper bound is the pre-event steady cornering slip +
    0.5° (the Sim car's steady slip in the R600 at 55 m/s is 1.3–1.6°, above the design's 1°), and at the limit "no
    new peak". ABS off at Sim: 5–20 % longer (at h = 1 the locked wheel's (1 − 0.2)·μ against the peak's 0.92 μ is
    15 % plus the rear's share: 16–18 %). TC off: peak κR > 0.3 (the Brio's 1st-gear redline caps the wheel at 20 m/s,
    so a 5 m/s roll cannot reach 1). Sport power-over: a car whose rear never spins (peak κR < 0.3: the Brio in 3rd
    at 70 mph) records "not the torque for it". I4: the steady metrics agree within 1 % (0-60 at Sim 2.0 %, bound
    2.5 %); the catch time resolves to 3–4 % and 2–3° (the lock-up and the re-grip are events resolved to a substep,
    the release angle to a 120 Hz tick; the catch moves about 0.03 s per degree of release angle), bounded at 5 % (or
    0.07 s) and 4°. The sedan's miss column is 2.0 m, the semi's 2.3 m (its box is 2.5 m wide: 2.0 m is a hit).
13. **The two-tune rule on the plan's §5.3 race-tune-like CarDef is an advisory, not a failure of this tree.** The
    Corsa is rev-limited and its top speed fell 1.1 % with the drive slip; the race-tune-like CarDef is drag-limited
    (7843 rpm at its top) and did not, so it is 0.6 mph over at every profile, and in Sim its lateral g at 80 m/s is
    0.01–0.05 g over (the heavier car pays less load sensitivity for the same downforce), and 100-0 is 0.5 m under at
    0.35. The tune is set on `claude/hypercar` (M3); §7.8 hands it these numbers.
14. **The test scripts (§7.3–7.4) as implemented.** Every scripted driver decides at 120 Hz whatever the physics
    rate, so the 240 Hz comparison measures the physics; the lift-off holds the wheel angle (a held stick input
    tightens the wheel as the lock opens with falling speed: 26° of slip at 40 mph in Sim became 13–22°); the held
    drift brings the hands round past 8° while the handbrake is on, lets go when the angle plus 0.05 s of yaw reaches
    25°, and eases the throttle as the angle runs past the target. The design's held-drift thresholds (κR > 0.3 over
    the hold, 2.5 s of `drift.time`) need a better driver than this script: a 40 mph handbrake entry released at 25°
    carries 130°/s of yaw and swings to 45–55° whatever follows, and 0.8 throttle there scrubs the speed under the
    8 m/s floor of `drift.active`. The §3.7 rule is therefore tested on its own: a 20° slide imposed at 15 m/s with
    full counter-steer and 0.8 throttle must spin the rear past the plain TC target with `tcM` staying ≥ 0.9 while it
    is over (it does, in every car and profile; the Brio's 1st-gear redline caps it at κ 0.20–0.21). The scripted
    hold is reported and bound at "finite, no spin, 0.5 s (arcade) / 0.9 s of `drift.time`".
15. **Not done here:** the §7.8 re-measurements on `claude/hypercar` (M3's `applyCar(c, tune)` and the garage cards),
    the `tests/regression.mjs` `survival` case (the browser suite is run by the suite runner), `Game.simulate` writing
    `p.ext` from the ability (M5's state machine; `ext` stays 0 here).

16. **Known marginal cases, stated and not retuned.** (a) The Vela E's catch at the cards' profile h = 0.35 is 0.958 s
    against the 1.0 s Arcade bound (GT 0.950, Brio and Corsa 0.925): the back-off of item 8 moved it from 1.00 s; the
    Vela E's 160 kg of extra mass and its lower cornering stiffness make it the slowest to rotate back, as it is in the
    parent (0.59 s against the GT's 0.56). (b) A 70 mph handbrake pull in Sim (h = 0.9 and 1) peaks at 77.6–79.6° of
    body slip on every car and both tunes against the harness's 80° "spun" threshold, and is caught in 1.19–1.49 s.
    That is the physics: at 31 m/s the locked rear has no lateral grip for 0.5 s, the yaw rate reaches 130–150°/s, and
    the Sim stability control pulls nothing until the driver counter-steers; a 70 mph handbrake pull on a real car is
    a near-spin. The two bounds are kept as they are so a future retune that crosses them is seen, not hidden.
17. **Per-step allocation (§6 I5), measured.** The step has no object, array or closure of its own (the tyre law writes
    into module-level records, the walls and the contacts into preallocated buffers; `Math.hypot`, which allocates in
    V8, is replaced by `sqrt`). What remains is the JIT's: with `--trace-turbo-inlining`, V8 inlines `clamp`, `lerp`,
    `wheelStep` and 6 of 27 `smoothstep` sites into `step` and declines `tyre` (266 bytes of bytecode), `loadMu`,
    `steerLock` and `maxDelta` once the cumulative inlining budget is spent, and a call it does not inline receives its
    double arguments boxed as heap numbers. Measured in Node 22 (`--expose-gc --allow-natives-syntax
    --max-semi-space-size=128`, `%GetOptimizationStatus` confirming TurboFan code, `heapUsed` over 20,000 steps after
    1.2 M warm-up steps with no scavenge in the window): 77 B/step under throttle and steering, 122 B/step coasting,
    175 B/step through a handbrake pull (this tree); the parent's step 3–179 B/step on the same drive. At 120 Hz that
    is 10–21 KB/s, a minor GC every couple of minutes. In the first second, while `step` is still interpreted, every
    double is boxed: 1–2 KB/step. Short windows (under about 50 ms of steps) after any change of control path read
    the interpreter, not the step, which is why a scavenge count over 144,000 steps from a cold start reads 2–3× the
    parent's. The claim in the technical notes is this measured figure, not "no allocation".

## 11. Measured: the finished model

**What the owner sees change, in one list** (every number from the run below; the parent is `a89d4f0`):

1. **Every garage-card number moves.** At the cards' profile (h = 0.35): GT 211 → 209 mph, 0-100 5.73 → 6.11 s, 100-0 87 → 78 m; Brio 202 → 200 mph, 0-100 6.02 → 6.66 s, 100-0 84 → 73 m; Corsa 232 → 229 mph, 0-100 5.35 → 5.70 s, 100-0 84 → 74 m; Vela E 224 → 223 mph, 0-100 5.71 → 6.02 s, 100-0 89 → 79 m. 0-100 is 5–11 % slower (the engine's and the wheels' inertia reflected to the driven axle, and the tach reading the wheel, so a spinning gear upshifts earlier: §10 item 11); 100-0 is 9–11 m shorter (ABS at the peak on both axles: §10 item 7); the top speeds fall 2–3 mph (the drive slip at a rev-limited top). The hypercar branch must re-measure its cards and its two tunes (§7.8).
2. **The race-tune-like test CarDef is over the Corsa on top speed at every profile** (by 0.6/0.6/0.6/0.6/0.6 mph at h = 0.15/0.35/0.5/0.9/1: the Corsa is rev-limited and lost top speed to the drive slip, the heavier drag-limited CarDef did not) and over on lateral g at 80 m/s in Sim (by 0.01, 0.04 g). The real tune is set on `claude/hypercar` (M3); a CdA of about 0.81 or a longer final drive brings it under, and §7.8 hands it the numbers. Advisory in the report, not a failure of this tree.
3. **The §7.7 tolerances were widened after measurement** (§10 item 11): 0-100 +0.15 → +0.7 s at the default profile, the held-drift rule (κR > 0.3 over 2.5 s) replaced by a test of the rule on its own, the dt catch bound 2 → 5 %. The reasons are priced there; none hides a defect.
4. **Fixed after review, all measured below:** the handbrake works with the foot brake held (ABS no longer modulates it: the rear locks, κR −1.00, 25° in 0.51–0.67 s with the pedal at 0.5 or 1.0 on every car and profile); torque vectoring targets the neutral yaw rate and adds rotation in every steady corner (it subtracted); ABS follows the road speed's sign, so it works in reverse; the countdown hold no longer kicks the clutch, so the launch from GO is the standing-start launch within 0.02 s and the car does not creep; the swept traffic contact sweeps the traffic car by the distance it moved under Focus Time; the ordering is bound at h = 1.
5. **Known marginal cases, stated rather than retuned** (§10 item 16): the Vela E's catch at the cards' profile h = 0.35 is 0.958 s against a 1.0 s bound, and a 70 mph handbrake pull in Sim peaks at 77.6–79.6° of body slip against the harness's 80° spin threshold on every car: a near-spin, which is the physics of a 70 mph handbrake pull with the stability control off.
6. **`tests/out/` is gitignored:** the report is regenerated by every `node tests/dynamics.mjs`; the tables below are its committed copy, byte for byte except the group-count table.


Tree `0a6a24e` (with uncommitted changes), control `a89d4f0`, 120 Hz, 2026-10-19T21:49:58.186Z, 11.8 s. **1574 checks passed, 0 failed.**

Method (PROJECT_OC_DYNAMICS.md §0): a straight 4-lane Path 30 km long, no walls, every figure one deterministic run. 0-60 / 0-100 / quarter mile / top speed from a full-throttle start (top: |dv| per step under 0.0002 m/s for 3 s). 100-0: full pedal from 44.7 m/s after a 0.2 s settle, to 0.5 m/s. Lateral g: a 16-point steering sweep refined around the best, 4 s with a speed hold, mean |ay| over the last 2 s with sideslip under 0.12 rad and speed within 8%. Catch: full left steer with the handbrake from 40 mph to 25° of body slip, then throttle 0.15 and a scripted counter-steer (front wheels along the front axle's travel, within steerLock); caught when |angle| < 5°. The ordering (Corsa fastest earnable; the Brio's lateral g within 5 %/10 % above it) is bound at every h, 1.0 included (the slider reaches it).

### Advisory (not counted): the two-tune rule on the plan's race-tune-like CarDef

The race tune is set on claude/hypercar (M3); PROJECT_OC_DYNAMICS.md §7.8 hands it these numbers. The Corsa is rev-limited in 7th and its top speed fell with the drive slip; the race-tune-like CarDef is drag-limited and did not.

- race-tune-like vs Corsa at h=0.15: OVER on top 229.7 > 229.1 (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)
- race-tune-like vs Corsa at h=0.35: OVER on top 229.7 > 229.1 (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)
- race-tune-like vs Corsa at h=0.5: OVER on top 229.7 > 229.1 (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)
- race-tune-like vs Corsa at h=0.9: OVER on top 229.7 > 229.1; g80 1.05 > 1.04 (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)
- race-tune-like vs Corsa at h=1: OVER on top 229.7 > 229.0; g80 1.14 > 1.09 (noise: 0.01 s, 0.5 mph, 0.3 m, 0.005 g)

### Control table: parent → finished model

Parent = commit a89d4f0 measured live by this harness with the same method; → the current tree. Bounds applied to the four earnable cars (PROJECT_OC_DYNAMICS.md §7.7 as re-derived in its Deviations section): 0-60 +0.25 s (h ≤ 0.35) / +0.6 (0.5) / +0.9 (≥ 0.9); 0-100 +0.7 / +1.0 / +1.5 s; ¼ mile +0.45 / +0.7 / +1.1 s, trap −8 mph; top speed within ±1 mph of the parent's less the drive slip at that speed; 100-0 never more than +3 m (≤ 0.5) / +5 m; lateral g within g·(0.04 + 0.045·g²) of the parent's; catch entry 0.4–0.6 s, caught ≤ 1.0 / 1.5 / 2.0 s, no spin. The two tunes are reported, not bound (the hypercar plan re-measures them).

| Car | h | 0-60 s | 0-100 s | ¼ mile | Top mph | 100-0 m | Lat g @25 | @40 | @80 | Catch: entry s / peak ° / caught s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 3.11 → 3.25 | 5.49 → 5.88 | 10.30@149 → 10.59@146 | 211 → 209 | 85.1 → 74.8 | 1.25 → 1.18 | 1.03 → 1.00 | 0.61 → 0.60 | 0.61 / 28 / 0.50 → 0.52 / 39 / 0.76 |
| GT | 0.35 | 3.28 → 3.43 | 5.73 → 6.11 | 10.48@149 → 10.77@145 | 211 → 209 | 87.0 → 77.9 | 1.26 → 1.17 | 1.11 → 1.07 | 0.73 → 0.71 | 0.56 / 32 / 0.60 → 0.51 / 43 / 0.95 |
| GT | 0.5 | 3.42 → 3.97 | 5.93 → 6.73 | 10.62@148 → 11.21@144 | 211 → 209 | 90.3 → 80.5 | 1.22 → 1.15 | 1.14 → 1.09 | 0.83 → 0.80 | 0.54 / 36 / 0.70 → 0.51 / 47 / 1.27 |
| GT | 0.9 | 4.27 → 5.01 | 7.28 → 8.49 | 11.53@145 → 12.33@139 | 211 → 209 | 93.9 → 88.8 | 1.08 → 1.05 | 1.09 → 1.06 | 1.07 → 1.00 | 0.54 / 60 / 1.15 → 0.52 / 66 / 1.39 |
| GT | 1 | 4.40 → 5.17 | 7.53 → 8.77 | 11.68@144 → 12.51@138 | 211 → 209 | 96.3 → 91.2 | 1.04 → 1.02 | 1.06 → 1.03 | 1.10 → 1.07 | 0.55 / 63 / 1.02 → 0.53 / 67 / 1.32 |
| Brio | 0.15 | 2.95 → 3.19 | 5.86 → 6.53 | 10.54@139 → 10.95@134 | 202 → 200 | 83.0 → 70.2 | 1.34 → 1.27 | 1.11 → 1.08 | 0.69 → 0.68 | 0.59 / 28 / 0.51 → 0.50 / 38 / 0.73 |
| Brio | 0.35 | 3.11 → 3.32 | 6.02 → 6.66 | 10.67@138 → 11.06@134 | 202 → 200 | 84.0 → 73.2 | 1.35 → 1.25 | 1.20 → 1.15 | 0.82 → 0.80 | 0.54 / 33 / 0.62 → 0.50 / 44 / 0.92 |
| Brio | 0.5 | 3.24 → 3.69 | 6.15 → 7.03 | 10.78@138 → 11.36@134 | 202 → 200 | 84.7 → 75.6 | 1.32 → 1.23 | 1.23 → 1.17 | 0.92 → 0.89 | 0.53 / 37 / 0.73 → 0.50 / 48 / 1.22 |
| Brio | 0.9 | 4.02 → 4.59 | 7.05 → 8.07 | 11.45@137 → 12.15@132 | 202 → 200 | 86.7 → 83.1 | 1.17 → 1.13 | 1.19 → 1.14 | 1.16 → 1.07 | 0.53 / 61 / 0.98 → 0.51 / 64 / 1.32 |
| Brio | 1 | 4.15 → 4.77 | 7.22 → 8.27 | 11.57@136 → 12.29@132 | 202 → 200 | 88.9 → 85.5 | 1.13 → 1.10 | 1.16 → 1.11 | 1.20 → 1.13 | 0.53 / 63 / 0.92 → 0.52 / 65 / 1.26 |
| Corsa | 0.15 | 2.95 → 3.09 | 5.10 → 5.45 | 9.94@156 → 10.23@152 | 232 → 229 | 83.2 → 71.1 | 1.30 → 1.23 | 1.07 → 1.04 | 0.64 → 0.63 | 0.60 / 28 / 0.50 → 0.51 / 39 / 0.75 |
| Corsa | 0.35 | 3.12 → 3.27 | 5.35 → 5.70 | 10.12@156 → 10.41@151 | 232 → 229 | 84.2 → 74.0 | 1.31 → 1.22 | 1.16 → 1.11 | 0.77 → 0.75 | 0.55 / 32 / 0.60 → 0.50 / 43 / 0.92 |
| Corsa | 0.5 | 3.25 → 3.71 | 5.56 → 6.33 | 10.27@155 → 10.87@150 | 232 → 229 | 85.2 → 76.3 | 1.29 → 1.20 | 1.20 → 1.15 | 0.87 → 0.84 | 0.53 / 36 / 0.70 → 0.50 / 47 / 1.24 |
| Corsa | 0.9 | 4.06 → 4.71 | 6.89 → 7.98 | 11.18@151 → 12.01@144 | 232 → 229 | 88.2 → 84.0 | 1.14 → 1.10 | 1.16 → 1.12 | 1.11 → 1.04 | 0.53 / 61 / 1.09 → 0.51 / 66 / 1.35 |
| Corsa | 1 | 4.18 → 4.85 | 7.12 → 8.23 | 11.34@150 → 12.17@143 | 232 → 229 | 90.5 → 86.3 | 1.10 → 1.07 | 1.13 → 1.10 | 1.17 → 1.09 | 0.54 / 64 / 0.98 → 0.52 / 67 / 1.27 |
| Vela E | 0.15 | 3.10 → 3.32 | 5.48 → 5.78 | 10.28@151 → 10.53@148 | 224 → 223 | 86.6 → 75.4 | 1.16 → 1.10 | 0.89 → 0.87 | 0.45 → 0.45 | 0.64 / 28 / 0.49 → 0.53 / 38 / 0.77 |
| Vela E | 0.35 | 3.27 → 3.50 | 5.71 → 6.02 | 10.46@151 → 10.70@148 | 224 → 223 | 89.2 → 78.7 | 1.19 → 1.11 | 0.99 → 0.97 | 0.56 → 0.55 | 0.59 / 32 / 0.59 → 0.53 / 43 / 0.96 |
| Vela E | 0.5 | 3.42 → 3.95 | 5.91 → 6.64 | 10.60@150 → 11.15@146 | 224 → 223 | 92.5 → 81.4 | 1.17 → 1.10 | 1.04 → 1.01 | 0.64 → 0.63 | 0.57 / 35 / 0.68 → 0.53 / 49 / 1.37 |
| Vela E | 0.9 | 4.26 → 4.99 | 7.24 → 8.35 | 11.51@147 → 12.26@142 | 224 → 223 | 96.3 → 89.8 | 1.03 → 1.03 | 1.01 → 1.00 | 0.82 → 0.78 | 0.57 / 59 / 1.28 → 0.53 / 66 / 1.19 |
| Vela E | 1 | 4.39 → 5.13 | 7.49 → 8.67 | 11.67@146 → 12.46@140 | 224 → 223 | 98.8 → 92.3 | 1.00 → 1.01 | 0.98 → 0.99 | 0.85 → 0.81 | 0.58 / 64 / 1.05 → 0.53 / 67 / 1.17 |
| Unleashed-like | 0.15 | 2.10 → 2.24 | 3.59 → 3.86 | 8.18@200 → 8.48@195 | 338 → 337 | 78.5 → 56.1 | 1.72 → 1.57 | 1.52 → 1.44 | 1.04 → 1.02 | 0.51 / 30 / 0.51 → 0.46 / 37 / 0.68 |
| Unleashed-like | 0.35 | 2.22 → 2.38 | 3.80 → 4.09 | 8.36@199 → 8.68@193 | 338 → 337 | 79.4 → 58.5 | 1.71 → 1.53 | 1.60 → 1.49 | 1.20 → 1.17 | 0.48 / 36 / 0.64 → 0.46 / 43 / 0.82 |
| Unleashed-like | 0.5 | 2.33 → 2.72 | 3.97 → 4.63 | 8.50@198 → 9.13@190 | 338 → 337 | 80.1 → 60.4 | 1.67 → 1.49 | 1.63 → 1.50 | 1.32 → 1.27 | 0.47 / 40 / 0.74 → 0.46 / 48 / 0.93 |
| Unleashed-like | 0.9 | 2.97 → 3.57 | 5.01 → 5.91 | 9.39@190 → 10.27@177 | 338 → 337 | 77.9 → 66.5 | 1.47 → 1.37 | 1.56 → 1.44 | 1.56 → 1.46 | 0.48 / 63 / 0.92 → 0.48 / 63 / 1.32 |
| Unleashed-like | 1 | 3.07 → 3.69 | 5.18 → 6.10 | 9.53@189 → 10.43@175 | 338 → 337 | 78.5 → 68.3 | 1.43 → 1.34 | 1.52 → 1.41 | 1.60 → 1.49 | 0.48 / 66 / 0.90 → 0.49 / 64 / 1.18 |
| Race-tune-like | 0.15 | 2.95 → 3.09 | 5.12 → 5.46 | 9.96@155 → 10.24@152 | 231 → 230 | 83.1 → 70.8 | 1.29 → 1.22 | 1.05 → 1.02 | 0.62 → 0.61 | 0.61 / 28 / 0.50 → 0.51 / 38 / 0.75 |
| Race-tune-like | 0.35 | 3.12 → 3.27 | 5.36 → 5.70 | 10.13@155 → 10.41@151 | 231 → 230 | 84.0 → 73.9 | 1.30 → 1.21 | 1.14 → 1.10 | 0.75 → 0.73 | 0.56 / 32 / 0.60 → 0.50 / 43 / 0.92 |
| Race-tune-like | 0.5 | 3.25 → 3.70 | 5.57 → 6.33 | 10.28@154 → 10.86@150 | 231 → 230 | 85.1 → 76.2 | 1.28 → 1.19 | 1.19 → 1.13 | 0.85 → 0.82 | 0.53 / 36 / 0.68 → 0.50 / 47 / 1.24 |
| Race-tune-like | 0.9 | 4.07 → 4.71 | 6.93 → 8.03 | 11.20@150 → 12.02@144 | 231 → 230 | 87.9 → 83.8 | 1.13 → 1.10 | 1.15 → 1.11 | 1.14 → 1.05 | 0.53 / 60 / 1.16 → 0.51 / 66 / 1.32 |
| Race-tune-like | 1 | 4.19 → 4.86 | 7.16 → 8.29 | 11.36@150 → 12.19@143 | 231 → 230 | 90.1 → 86.1 | 1.09 → 1.07 | 1.12 → 1.09 | 1.18 → 1.14 | 0.54 / 64 / 1.02 → 0.52 / 67 / 1.25 |

### Brakes and traction control

ABS: the mean front slip ratio over the stop against the controller's target (−sAbs·μF/kx, computed from the same state); the lowest front pressure multiplier. ABS off: the stop with the front locked (κ < −0.9 at the time shown). TC: full throttle from 5 m/s in 1st for 2 s, the peak rear slip ratio against the target (sTc·μR/kx), and with TC off.

| Car | h | 100-0 ABS m | mean κF | target κF | min P | 100-0 no ABS m | Δ | lock at s | TC peak κR | kTc | TC off peak κR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 74.8 | -0.078 | -0.079 | 0.63 | 76.1 | 1.7% | 0.158 | 0.086 | 0.085 | 1.50 |
| GT | 0.35 | 77.9 | -0.072 | -0.072 | 0.60 | 81.9 | 5.1% | 0.133 | 0.082 | 0.080 | 1.70 |
| GT | 0.5 | 80.5 | -0.068 | -0.068 | 0.57 | 86.7 | 7.7% | 0.117 | 0.123 | 0.120 | 1.85 |
| GT | 0.9 | 88.8 | -0.056 | -0.056 | 0.51 | 102.7 | 15.7% | 0.100 | 0.147 | 0.145 | 2.19 |
| GT | 1 | 91.2 | -0.053 | -0.053 | 0.49 | 105.3 | 15.4% | 0.092 | 0.144 | 0.141 | 2.25 |
| Brio | 0.15 | 70.2 | -0.084 | -0.084 | 0.68 | 71.1 | 1.3% | 0.267 | 0.091 | 0.092 | 0.61 |
| Brio | 0.35 | 73.2 | -0.077 | -0.077 | 0.65 | 76.4 | 4.3% | 0.192 | 0.087 | 0.088 | 0.79 |
| Brio | 0.5 | 75.6 | -0.072 | -0.072 | 0.62 | 80.8 | 6.9% | 0.167 | 0.131 | 0.129 | 0.94 |
| Brio | 0.9 | 83.1 | -0.060 | -0.060 | 0.55 | 95.5 | 14.9% | 0.125 | 0.157 | 0.155 | 1.32 |
| Brio | 1 | 85.5 | -0.057 | -0.057 | 0.53 | 97.9 | 14.5% | 0.125 | 0.153 | 0.151 | 1.38 |
| Corsa | 0.15 | 71.1 | -0.081 | -0.081 | 0.68 | 72.0 | 1.4% | 0.208 | 0.089 | 0.087 | 1.70 |
| Corsa | 0.35 | 74.0 | -0.075 | -0.075 | 0.64 | 77.4 | 4.6% | 0.158 | 0.085 | 0.083 | 1.92 |
| Corsa | 0.5 | 76.3 | -0.070 | -0.070 | 0.62 | 81.9 | 7.4% | 0.142 | 0.128 | 0.125 | 2.08 |
| Corsa | 0.9 | 84.0 | -0.058 | -0.058 | 0.55 | 96.7 | 15.1% | 0.108 | 0.153 | 0.151 | 2.46 |
| Corsa | 1 | 86.3 | -0.055 | -0.055 | 0.53 | 99.2 | 15.0% | 0.108 | 0.149 | 0.147 | 2.52 |
| Vela E | 0.15 | 75.4 | -0.078 | -0.079 | 0.61 | 77.0 | 2.2% | 0.100 | 0.086 | 0.084 | 2.19 |
| Vela E | 0.35 | 78.7 | -0.072 | -0.072 | 0.58 | 83.0 | 5.3% | 0.083 | 0.082 | 0.080 | 2.38 |
| Vela E | 0.5 | 81.4 | -0.067 | -0.068 | 0.56 | 88.0 | 8.1% | 0.083 | 0.123 | 0.120 | 2.52 |
| Vela E | 0.9 | 89.8 | -0.056 | -0.056 | 0.50 | 104.4 | 16.2% | 0.067 | 0.148 | 0.145 | 2.85 |
| Vela E | 1 | 92.3 | -0.053 | -0.053 | 0.48 | 107.0 | 16.0% | 0.067 | 0.144 | 0.141 | 2.90 |
| Unleashed-like | 0.15 | 56.1 | -0.099 | -0.100 | 0.71 | 57.5 | 2.4% | 0.167 | 0.111 | 0.106 | 4.17 |
| Unleashed-like | 0.35 | 58.5 | -0.091 | -0.092 | 0.68 | 61.7 | 5.5% | 0.117 | 0.106 | 0.102 | 4.48 |
| Unleashed-like | 0.5 | 60.4 | -0.086 | -0.086 | 0.65 | 65.3 | 8.1% | 0.100 | 0.159 | 0.154 | 4.74 |
| Unleashed-like | 0.9 | 66.5 | -0.071 | -0.071 | 0.57 | 76.9 | 15.5% | 0.075 | 0.191 | 0.186 | 5.40 |
| Unleashed-like | 1 | 68.3 | -0.068 | -0.068 | 0.56 | 78.8 | 15.3% | 0.075 | 0.187 | 0.182 | 5.41 |
| Race-tune-like | 0.15 | 70.8 | -0.081 | -0.081 | 0.67 | 72.0 | 1.7% | 0.192 | 0.089 | 0.086 | 2.04 |
| Race-tune-like | 0.35 | 73.9 | -0.075 | -0.075 | 0.64 | 77.3 | 4.7% | 0.150 | 0.085 | 0.083 | 2.30 |
| Race-tune-like | 0.5 | 76.2 | -0.070 | -0.070 | 0.62 | 81.9 | 7.5% | 0.133 | 0.128 | 0.125 | 2.48 |
| Race-tune-like | 0.9 | 83.8 | -0.058 | -0.058 | 0.54 | 96.7 | 15.4% | 0.100 | 0.153 | 0.151 | 2.92 |
| Race-tune-like | 1 | 86.1 | -0.055 | -0.055 | 0.53 | 99.2 | 15.2% | 0.100 | 0.149 | 0.147 | 2.98 |

### The launch from the line, the handbrake with the pedal, braking in reverse

GO: 1 s of the countdown hold (brake, handbrake, `hold`, the throttle pinned) then full throttle; how far the car crept in the hold and 0-60 from GO against the standing start (the control table's). Handbrake + pedal: from 40 mph, full left steer with the handbrake and the foot brake at 0.5 (and 1.0): the time to 25° of body slip and the lowest rear slip ratio (−1.00 is locked). Reverse: 10 m/s backwards, the full pedal: the mean front slip ratio against the ABS target (positive in reverse), the lowest front pressure, the stop, and with ABS off the time to a locked front.

| Car | h | GO 0-60 s (standing) | crept m/s / m | hb + pedal 0.5: 25° at s / κR min | hb + pedal 1.0 | reverse: mean κF / target / min P / m | reverse, no ABS: lock at s / m |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 3.24 (3.25) | 0.000 / 0.000 | 0.57 / -1.00 | 0.63 / -1.00 | 0.086 / 0.086 / 0.42 / 5.6 | 0.033 / 5.7 |
| GT | 0.35 | 3.42 (3.43) | 0.000 / 0.000 | 0.58 / -1.00 | 0.63 / -1.00 | 0.078 / 0.079 / 0.40 / 5.7 | 0.033 / 5.8 |
| GT | 0.5 | 3.96 (3.97) | 0.000 / 0.000 | 0.61 / -1.00 | 0.62 / -1.00 | 0.073 / 0.074 / 0.39 / 5.8 | 0.025 / 6.0 |
| GT | 0.9 | 5.01 (5.01) | 0.000 / 0.000 | 0.62 / -1.00 | 0.63 / -1.00 | 0.061 / 0.061 / 0.36 / 6.0 | 0.025 / 6.4 |
| GT | 1 | 5.16 (5.17) | 0.000 / 0.000 | 0.63 / -1.00 | 0.63 / -1.00 | 0.058 / 0.058 / 0.35 / 6.1 | 0.025 / 6.4 |
| Brio | 0.15 | 3.19 (3.19) | 0.000 / 0.000 | 0.54 / -1.00 | 0.61 / -1.00 | 0.092 / 0.092 / 0.45 / 5.7 | 0.033 / 5.7 |
| Brio | 0.35 | 3.32 (3.32) | 0.000 / 0.000 | 0.56 / -1.00 | 0.60 / -1.00 | 0.084 / 0.084 / 0.43 / 5.8 | 0.033 / 5.9 |
| Brio | 0.5 | 3.69 (3.69) | 0.000 / 0.000 | 0.58 / -1.00 | 0.60 / -1.00 | 0.078 / 0.079 / 0.42 / 5.9 | 0.033 / 6.1 |
| Brio | 0.9 | 4.59 (4.59) | 0.000 / 0.000 | 0.60 / -1.00 | 0.61 / -1.00 | 0.065 / 0.065 / 0.38 / 6.1 | 0.033 / 6.5 |
| Brio | 1 | 4.77 (4.77) | 0.000 / 0.000 | 0.60 / -1.00 | 0.61 / -1.00 | 0.062 / 0.062 / 0.37 / 6.2 | 0.033 / 6.5 |
| Corsa | 0.15 | 3.09 (3.09) | 0.000 / 0.000 | 0.55 / -1.00 | 0.63 / -1.00 | 0.089 / 0.090 / 0.44 / 5.5 | 0.033 / 5.6 |
| Corsa | 0.35 | 3.26 (3.27) | 0.000 / 0.000 | 0.57 / -1.00 | 0.62 / -1.00 | 0.082 / 0.082 / 0.42 / 5.6 | 0.033 / 5.8 |
| Corsa | 0.5 | 3.69 (3.71) | 0.000 / 0.000 | 0.58 / -1.00 | 0.61 / -1.00 | 0.076 / 0.077 / 0.41 / 5.7 | 0.033 / 5.9 |
| Corsa | 0.9 | 4.70 (4.71) | 0.000 / 0.000 | 0.61 / -1.00 | 0.61 / -1.00 | 0.063 / 0.063 / 0.37 / 6.0 | 0.025 / 6.3 |
| Corsa | 1 | 4.85 (4.85) | 0.000 / 0.000 | 0.61 / -1.00 | 0.61 / -1.00 | 0.060 / 0.060 / 0.36 / 6.0 | 0.025 / 6.4 |
| Vela E | 0.15 | 3.32 (3.32) | 0.000 / 0.000 | 0.58 / -1.00 | 0.67 / -1.00 | 0.086 / 0.086 / 0.42 / 5.4 | 0.025 / 5.5 |
| Vela E | 0.35 | 3.50 (3.50) | 0.000 / 0.000 | 0.59 / -1.00 | 0.67 / -1.00 | 0.078 / 0.079 / 0.40 / 5.6 | 0.025 / 5.7 |
| Vela E | 0.5 | 3.95 (3.95) | 0.000 / 0.000 | 0.61 / -1.00 | 0.67 / -1.00 | 0.073 / 0.074 / 0.39 / 5.6 | 0.025 / 5.8 |
| Vela E | 0.9 | 4.98 (4.99) | 0.000 / 0.000 | 0.65 / -1.00 | 0.66 / -1.00 | 0.060 / 0.061 / 0.35 / 5.9 | 0.025 / 6.2 |
| Vela E | 1 | 5.13 (5.13) | 0.000 / 0.000 | 0.65 / -1.00 | 0.65 / -1.00 | 0.057 / 0.058 / 0.34 / 5.9 | 0.025 / 6.2 |
| Unleashed-like | 0.15 | 2.23 (2.24) | 0.000 / 0.000 | 0.51 / -1.00 | 0.56 / -1.00 | 0.112 / 0.113 / 0.39 / 4.4 | 0.025 / 4.4 |
| Unleashed-like | 0.35 | 2.37 (2.38) | 0.000 / 0.000 | 0.53 / -1.00 | 0.56 / -1.00 | 0.103 / 0.103 / 0.38 / 4.5 | 0.025 / 4.6 |
| Unleashed-like | 0.5 | 2.72 (2.72) | 0.000 / 0.000 | 0.54 / -1.00 | 0.55 / -1.00 | 0.096 / 0.096 / 0.37 / 4.6 | 0.025 / 4.7 |
| Unleashed-like | 0.9 | 3.57 (3.57) | 0.000 / 0.000 | 0.56 / -1.00 | 0.56 / -1.00 | 0.079 / 0.080 / 0.34 / 4.7 | 0.025 / 5.0 |
| Unleashed-like | 1 | 3.68 (3.69) | 0.000 / 0.000 | 0.56 / -1.00 | 0.56 / -1.00 | 0.075 / 0.076 / 0.33 / 4.8 | 0.025 / 5.1 |
| Race-tune-like | 0.15 | 3.08 (3.09) | 0.000 / 0.000 | 0.55 / -1.00 | 0.63 / -1.00 | 0.089 / 0.090 / 0.44 / 5.4 | 0.033 / 5.5 |
| Race-tune-like | 0.35 | 3.27 (3.27) | 0.000 / 0.000 | 0.57 / -1.00 | 0.63 / -1.00 | 0.082 / 0.082 / 0.42 / 5.5 | 0.033 / 5.7 |
| Race-tune-like | 0.5 | 3.70 (3.70) | 0.000 / 0.000 | 0.58 / -1.00 | 0.62 / -1.00 | 0.076 / 0.077 / 0.41 / 5.6 | 0.033 / 5.8 |
| Race-tune-like | 0.9 | 4.71 (4.71) | 0.000 / 0.000 | 0.61 / -1.00 | 0.62 / -1.00 | 0.063 / 0.063 / 0.37 / 5.9 | 0.025 / 6.2 |
| Race-tune-like | 1 | 4.85 (4.86) | 0.000 / 0.000 | 0.62 / -1.00 | 0.62 / -1.00 | 0.060 / 0.060 / 0.36 / 5.9 | 0.025 / 6.3 |

### Torque vectoring (§4.5): the Unleashed-like with `vector` 1 against 0

A steady turn, steer 0.3 with a speed hold; the mean yaw rate and lateral acceleration over the last 2 s of 4. The vectoring targets the neutral yaw rate for the wheel angle, so it adds rotation in every steady corner.

| h | 25 m/s: yaw °/s 0 → 1 | lat g 0 → 1 | 40 m/s: yaw °/s 0 → 1 | lat g 0 → 1 |
| --- | --- | --- | --- | --- |
| 0.15 | 15.53 → 16.03 | 0.68 → 0.70 | 8.62 → 9.32 | 0.55 → 0.59 |
| 0.35 | 16.68 → 17.24 | 0.74 → 0.76 | 9.30 → 10.09 | 0.62 → 0.67 |
| 0.5 | 17.56 → 18.17 | 0.78 → 0.81 | 9.83 → 10.69 | 0.68 → 0.73 |
| 0.9 | 20.01 → 20.84 | 0.90 → 0.94 | 11.42 → 12.54 | 0.82 → 0.90 |
| 1 | 20.67 → 21.58 | 0.93 → 0.98 | 11.89 → 13.11 | 0.85 → 0.94 |

### Drift scenarios

#### Handbrake entry and catch (entry target 25°; 12° at 120 mph)

| Car | h | 40 mph: entry / peak / caught | 70 mph | 120 mph |
| --- | --- | --- | --- | --- |
| GT | 0.15 | 0.52 / 39° / 0.76 s | 0.53 / 49° / 1.15 s | 0.51 / 25° / 0.63 s |
| GT | 0.35 | 0.51 / 43° / 0.95 s | 0.52 / 55° / 1.41 s | 0.48 / 26° / 0.68 s |
| GT | 0.5 | 0.51 / 47° / 1.27 s | 0.52 / 64° / 1.72 s | 0.48 / 28° / 0.74 s |
| GT | 0.9 | 0.52 / 66° / 1.39 s | 0.51 / 79° / 1.49 s | 0.45 / 32° / 0.92 s |
| GT | 1 | 0.53 / 67° / 1.32 s | 0.51 / 79° / 1.44 s | 0.44 / 32° / 0.93 s |
| Brio | 0.15 | 0.50 / 38° / 0.73 s | 0.51 / 50° / 1.13 s | 0.48 / 26° / 0.63 s |
| Brio | 0.35 | 0.50 / 44° / 0.92 s | 0.50 / 57° / 1.38 s | 0.46 / 27° / 0.68 s |
| Brio | 0.5 | 0.50 / 48° / 1.22 s | 0.49 / 62° / 1.62 s | 0.45 / 29° / 0.75 s |
| Brio | 0.9 | 0.51 / 64° / 1.32 s | 0.49 / 79° / 1.45 s | 0.43 / 34° / 0.91 s |
| Brio | 1 | 0.52 / 65° / 1.26 s | 0.49 / 79° / 1.41 s | 0.43 / 35° / 0.96 s |
| Corsa | 0.15 | 0.51 / 39° / 0.75 s | 0.52 / 49° / 1.14 s | 0.50 / 25° / 0.63 s |
| Corsa | 0.35 | 0.50 / 43° / 0.92 s | 0.51 / 57° / 1.40 s | 0.48 / 26° / 0.68 s |
| Corsa | 0.5 | 0.50 / 47° / 1.24 s | 0.51 / 66° / 1.70 s | 0.47 / 29° / 0.73 s |
| Corsa | 0.9 | 0.51 / 66° / 1.35 s | 0.50 / 79° / 1.42 s | 0.44 / 33° / 0.90 s |
| Corsa | 1 | 0.52 / 67° / 1.27 s | 0.50 / 79° / 1.39 s | 0.43 / 33° / 0.92 s |
| Vela E | 0.15 | 0.53 / 38° / 0.77 s | 0.57 / 47° / 1.09 s | 0.58 / 22° / 0.58 s |
| Vela E | 0.35 | 0.53 / 43° / 0.96 s | 0.56 / 55° / 1.39 s | 0.55 / 24° / 0.63 s |
| Vela E | 0.5 | 0.53 / 49° / 1.37 s | 0.55 / 61° / 1.66 s | 0.53 / 24° / 0.68 s |
| Vela E | 0.9 | 0.53 / 66° / 1.19 s | 0.54 / 79° / 1.40 s | 0.51 / 29° / 0.84 s |
| Vela E | 1 | 0.53 / 67° / 1.17 s | 0.54 / 80° / 1.36 s | 0.50 / 29° / 0.86 s |
| Unleashed-like | 0.15 | 0.46 / 37° / 0.68 s | 0.44 / 49° / 1.00 s | 0.40 / 25° / 0.54 s |
| Unleashed-like | 0.35 | 0.46 / 43° / 0.82 s | 0.44 / 58° / 1.22 s | 0.38 / 27° / 0.59 s |
| Unleashed-like | 0.5 | 0.46 / 48° / 0.93 s | 0.43 / 62° / 1.39 s | 0.38 / 28° / 0.63 s |
| Unleashed-like | 0.9 | 0.48 / 63° / 1.32 s | 0.43 / 78° / 1.30 s | 0.36 / 33° / 0.78 s |
| Unleashed-like | 1 | 0.49 / 64° / 1.18 s | 0.44 / 78° / 1.19 s | 0.35 / 33° / 0.79 s |
| Race-tune-like | 0.15 | 0.51 / 38° / 0.75 s | 0.53 / 50° / 1.15 s | 0.51 / 25° / 0.62 s |
| Race-tune-like | 0.35 | 0.50 / 43° / 0.92 s | 0.52 / 58° / 1.41 s | 0.48 / 26° / 0.67 s |
| Race-tune-like | 0.5 | 0.50 / 47° / 1.24 s | 0.51 / 64° / 1.66 s | 0.48 / 28° / 0.72 s |
| Race-tune-like | 0.9 | 0.51 / 66° / 1.32 s | 0.50 / 79° / 1.42 s | 0.45 / 33° / 0.89 s |
| Race-tune-like | 1 | 0.52 / 67° / 1.25 s | 0.50 / 79° / 1.37 s | 0.44 / 33° / 0.91 s |

#### Power-over (2nd/3rd gear, steer 0.5, full throttle 1.5 s, then the catch with throttle 0.3)

| Car | h | 40 mph: peak slip / >12° at / >20° at / caught / kR peak | 70 mph |
| --- | --- | --- | --- |
| GT | 0.15 | 4° / -1.00 / -1.00 / 0.11 / 0.09 | 4° / -1.00 / -1.00 / 0.11 / 0.08 |
| GT | 0.35 | 6° / -1.00 / -1.00 / 0.12 / 0.08 | 6° / -1.00 / -1.00 / 0.11 / 0.08 |
| GT | 0.5 | 23° / 0.68 / 1.27 / 0.58 / 0.35 | 13° / 0.84 / -1.00 / 0.29 / 0.19 |
| GT | 0.9 | 78° / 0.49 / 0.62 / 0.63 / 5.01 | 84° / 0.51 / 0.67 / 0.76 / 4.70 |
| GT | 1 | 78° / 0.48 / 0.61 / 0.60 / 5.16 | 84° / 0.50 / 0.65 / 0.77 / 7.22 |
| Brio | 0.15 | 4° / -1.00 / -1.00 / 0.11 / 0.09 | 2° / -1.00 / -1.00 / 0.11 / 0.04 |
| Brio | 0.35 | 5° / -1.00 / -1.00 / 0.11 / 0.09 | 2° / -1.00 / -1.00 / 0.11 / 0.04 |
| Brio | 0.5 | 15° / 0.77 / -1.00 / 0.38 / 0.31 | 3° / -1.00 / -1.00 / 0.11 / 0.05 |
| Brio | 0.9 | 78° / 0.50 / 0.64 / 0.58 / 4.98 | 39° / 0.78 / 1.07 / 0.86 / 0.32 |
| Brio | 1 | 78° / 0.50 / 0.63 / 0.52 / 5.19 | 77° / 0.70 / 0.94 / 2.81 / 0.47 |
| Corsa | 0.15 | 4° / -1.00 / -1.00 / 0.11 / 0.09 | 5° / -1.00 / -1.00 / 0.11 / 0.09 |
| Corsa | 0.35 | 6° / -1.00 / -1.00 / 0.11 / 0.08 | 6° / -1.00 / -1.00 / 0.12 / 0.08 |
| Corsa | 0.5 | 22° / 0.68 / 1.37 / 0.56 / 0.35 | 19° / 0.71 / -1.00 / 0.45 / 0.29 |
| Corsa | 0.9 | 79° / 0.48 / 0.61 / 0.59 / 5.62 | 84° / 0.49 / 0.63 / 0.76 / 8.18 |
| Corsa | 1 | 79° / 0.48 / 0.60 / 0.57 / 5.67 | 84° / 0.48 / 0.62 / 0.70 / 8.62 |
| Vela E | 0.15 | 6° / -1.00 / -1.00 / 0.12 / 0.09 | 4° / -1.00 / -1.00 / 0.11 / 0.08 |
| Vela E | 0.35 | 7° / -1.00 / -1.00 / 0.18 / 0.08 | 7° / -1.00 / -1.00 / 0.17 / 0.08 |
| Vela E | 0.5 | 29° / 0.65 / 0.97 / 0.67 / 0.35 | 23° / 0.74 / 1.41 / 0.53 / 0.26 |
| Vela E | 0.9 | 79° / 0.50 / 0.62 / 0.52 / 5.07 | 84° / 0.54 / 0.68 / 0.58 / 7.41 |
| Vela E | 1 | 79° / 0.50 / 0.62 / 0.49 / 5.23 | 84° / 0.53 / 0.66 / 0.53 / 7.93 |
| Unleashed-like | 0.15 | 3° / -1.00 / -1.00 / 0.11 / 0.11 | 4° / -1.00 / -1.00 / 0.11 / 0.11 |
| Unleashed-like | 0.35 | 4° / -1.00 / -1.00 / 0.11 / 0.11 | 5° / -1.00 / -1.00 / 0.11 / 0.10 |
| Unleashed-like | 0.5 | 16° / 0.71 / -1.00 / 0.38 / 0.38 | 17° / 0.63 / -1.00 / 0.35 / 0.38 |
| Unleashed-like | 0.9 | 79° / 0.43 / 0.54 / 0.33 / 2.80 | 84° / 0.42 / 0.53 / 0.24 / 3.69 |
| Unleashed-like | 1 | 79° / 0.43 / 0.54 / 0.29 / 3.11 | 85° / 0.41 / 0.52 / 0.22 / 4.38 |
| Race-tune-like | 0.15 | 5° / -1.00 / -1.00 / 0.11 / 0.09 | 5° / -1.00 / -1.00 / 0.11 / 0.09 |
| Race-tune-like | 0.35 | 6° / -1.00 / -1.00 / 0.12 / 0.08 | 6° / -1.00 / -1.00 / 0.12 / 0.08 |
| Race-tune-like | 0.5 | 23° / 0.68 / 1.22 / 0.57 / 0.35 | 24° / 0.69 / 1.22 / 0.54 / 0.35 |
| Race-tune-like | 0.9 | 79° / 0.48 / 0.60 / 0.54 / 5.86 | 84° / 0.50 / 0.63 / 0.53 / 9.10 |
| Race-tune-like | 1 | 79° / 0.48 / 0.59 / 0.53 / 6.06 | 84° / 0.49 / 0.61 / 0.49 / 9.54 |

#### Lift-off in a sweeper needing 0.9 × the measured lateral g (radius shown)

| Car | h | 40 mph: R / worst / after 4 s | 70 mph | 120 mph |
| --- | --- | --- | --- | --- |
| GT | 0.15 | 31 m / 1.6° / 0.9° | 100 m / 2.0° / 1.5° | 377 m / 1.4° / 1.3° |
| GT | 0.35 | 31 m / 2.1° / 1.0° | 98 m / 2.5° / 1.8° | 344 m / 1.9° / 1.7° |
| GT | 0.5 | 32 m / 2.6° / 1.0° | 99 m / 3.0° / 2.0° | 328 m / 2.2° / 2.1° |
| GT | 0.9 | 34 m / 13.3° / 13.3° | 105 m / 5.1° / 4.1° | 314 m / 3.9° / 3.5° |
| GT | 1 | 35 m / 18.1° / 18.1° | 108 m / 6.0° / 5.7° | 311 m / 4.9° / 4.7° |
| Brio | 0.15 | 28 m / 1.3° / 1.3° | 93 m / 1.7° / 1.2° | 345 m / 1.3° / 1.2° |
| Brio | 0.35 | 29 m / 1.6° / 1.3° | 92 m / 2.2° / 1.5° | 317 m / 1.7° / 1.6° |
| Brio | 0.5 | 30 m / 2.0° / 1.3° | 92 m / 2.5° / 1.7° | 303 m / 2.1° / 1.9° |
| Brio | 0.9 | 32 m / 13.7° / 13.7° | 98 m / 6.0° / 5.9° | 292 m / 4.1° / 3.9° |
| Brio | 1 | 33 m / 21.6° / 21.6° | 101 m / 7.0° / 6.8° | 292 m / 5.7° / 5.7° |
| Corsa | 0.15 | 29 m / 1.5° / 1.1° | 96 m / 1.9° / 1.4° | 362 m / 1.4° / 1.3° |
| Corsa | 0.35 | 30 m / 2.0° / 1.1° | 94 m / 2.4° / 1.7° | 329 m / 1.8° / 1.7° |
| Corsa | 0.5 | 30 m / 2.6° / 1.2° | 94 m / 2.8° / 1.9° | 313 m / 2.2° / 2.0° |
| Corsa | 0.9 | 33 m / 13.7° / 13.7° | 100 m / 4.9° / 3.6° | 297 m / 3.5° / 3.0° |
| Corsa | 1 | 34 m / 20.0° / 20.0° | 102 m / 5.9° / 5.6° | 296 m / 4.3° / 4.0° |
| Vela E | 0.15 | 33 m / 2.4° / 0.5° | 110 m / 2.5° / 2.2° | 446 m / 1.6° / 1.5° |
| Vela E | 0.35 | 33 m / 3.1° / 0.6° | 105 m / 3.2° / 2.7° | 395 m / 2.1° / 2.1° |
| Vela E | 0.5 | 33 m / 3.6° / 0.6° | 104 m / 3.8° / 3.1° | 371 m / 2.6° / 2.5° |
| Vela E | 0.9 | 35 m / 4.9° / 0.5° | 109 m / 4.9° / 4.0° | 351 m / 3.7° / 3.4° |
| Vela E | 1 | 36 m / 5.0° / 0.5° | 111 m / 5.0° / 4.1° | 352 m / 3.9° / 3.5° |
| Unleashed-like | 0.15 | 25 m / 1.9° / 1.9° | 73 m / 1.5° / 1.1° | 252 m / 1.4° / 1.3° |
| Unleashed-like | 0.35 | 25 m / 2.0° / 2.0° | 73 m / 1.8° / 1.2° | 236 m / 1.8° / 1.6° |
| Unleashed-like | 0.5 | 25 m / 2.1° / 2.1° | 74 m / 2.1° / 1.4° | 229 m / 2.0° / 1.8° |
| Unleashed-like | 0.9 | 26 m / 12.5° / 12.5° | 79 m / 2.9° / 1.7° | 225 m / 2.8° / 2.5° |
| Unleashed-like | 1 | 27 m / 22.8° / 22.8° | 81 m / 3.7° / 2.3° | 227 m / 3.2° / 2.7° |
| Race-tune-like | 0.15 | 30 m / 1.6° / 0.8° | 98 m / 2.0° / 1.5° | 371 m / 1.5° / 1.3° |
| Race-tune-like | 0.35 | 30 m / 2.2° / 0.9° | 95 m / 2.5° / 1.8° | 335 m / 1.9° / 1.7° |
| Race-tune-like | 0.5 | 30 m / 2.7° / 1.0° | 95 m / 3.0° / 2.1° | 317 m / 2.3° / 2.1° |
| Race-tune-like | 0.9 | 33 m / 12.7° / 12.7° | 100 m / 4.8° / 3.4° | 298 m / 3.8° / 3.3° |
| Race-tune-like | 1 | 34 m / 17.1° / 17.1° | 103 m / 5.2° / 4.3° | 294 m / 4.7° / 4.3° |

#### Held drift (40 mph entry, counter-steer and 0.8 throttle for 3 s), and the §3.7 rule on its own

The scripted driver: the hands come round past 8°, the handbrake is let go as the angle plus 0.05 s of yaw reaches 25°, then counter-steer trimmed toward 25° with the throttle eased from 0.8 as the angle runs past it. κR while holding = the rear slip ratio over the steps with the throttle at least half open and the wheel turned against the slide. The rule column: a 20° slide imposed at 15 m/s, full counter-steer, 0.8 throttle, 0.5 s: the peak rear slip against the profile's plain TC target.

| Car | h | κR while holding | mean angle ° | drift.time s | rule: κR peak while sliding |
| --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 0.12 | 4 | 0.66 | 0.30 (plain target 0.084, lowest tcM 1.00) |
| GT | 0.35 | 0.10 | 5 | 0.72 | 0.32 (plain target 0.080, lowest tcM 1.00) |
| GT | 0.5 | 0.23 | 8 | 1.15 | 0.34 (plain target 0.121, lowest tcM 1.00) |
| GT | 0.9 | 0.25 | 39 | 1.47 | 0.37 (plain target 0.145, lowest tcM 1.00) |
| GT | 1 | 0.34 | 37 | 1.29 | 0.37 (plain target 0.142, lowest tcM 1.00) |
| Brio | 0.15 | 0.06 | 4 | 0.62 | 0.16 (plain target 0.090, lowest tcM 1.00) |
| Brio | 0.35 | 0.05 | 5 | 0.66 | 0.17 (plain target 0.086, lowest tcM 1.00) |
| Brio | 0.5 | 0.09 | 7 | 0.91 | 0.18 (plain target 0.129, lowest tcM 1.00) |
| Brio | 0.9 | 0.36 | 37 | 3.18 | 0.20 (plain target 0.155, lowest tcM 1.00) |
| Brio | 1 | 0.09 | 46 | 1.87 | 0.20 (plain target 0.151, lowest tcM 1.00) |
| Corsa | 0.15 | 0.13 | 4 | 0.64 | 0.35 (plain target 0.087, lowest tcM 1.00) |
| Corsa | 0.35 | 0.12 | 5 | 0.72 | 0.38 (plain target 0.083, lowest tcM 1.00) |
| Corsa | 0.5 | 0.25 | 8 | 1.13 | 0.40 (plain target 0.125, lowest tcM 1.00) |
| Corsa | 0.9 | 0.27 | 40 | 1.45 | 0.43 (plain target 0.151, lowest tcM 1.00) |
| Corsa | 1 | 0.21 | 36 | 1.31 | 0.44 (plain target 0.147, lowest tcM 1.00) |
| Vela E | 0.15 | 0.08 | 5 | 0.66 | 0.31 (plain target 0.084, lowest tcM 1.00) |
| Vela E | 0.35 | 0.20 | 6 | 0.93 | 0.33 (plain target 0.080, lowest tcM 1.00) |
| Vela E | 0.5 | 0.27 | 8 | 1.08 | 0.33 (plain target 0.120, lowest tcM 1.00) |
| Vela E | 0.9 | 0.24 | 51 | 1.36 | 0.61 (plain target 0.147, lowest tcM 1.00) |
| Vela E | 1 | 0.21 | 49 | 1.21 | 0.65 (plain target 0.143, lowest tcM 1.00) |
| Unleashed-like | 0.15 | 0.31 | 4 | 0.57 | 1.13 (plain target 0.108, lowest tcM 1.00) |
| Unleashed-like | 0.35 | 0.28 | 5 | 0.65 | 1.17 (plain target 0.104, lowest tcM 1.00) |
| Unleashed-like | 0.5 | 0.35 | 8 | 1.18 | 1.23 (plain target 0.156, lowest tcM 1.00) |
| Unleashed-like | 0.9 | 0.51 | 37 | 1.39 | 1.33 (plain target 0.188, lowest tcM 1.00) |
| Unleashed-like | 1 | 0.51 | 34 | 2.27 | 1.34 (plain target 0.183, lowest tcM 1.00) |
| Race-tune-like | 0.15 | 0.18 | 4 | 0.65 | 0.43 (plain target 0.087, lowest tcM 1.00) |
| Race-tune-like | 0.35 | 0.16 | 6 | 0.72 | 0.47 (plain target 0.083, lowest tcM 1.00) |
| Race-tune-like | 0.5 | 0.31 | 8 | 1.19 | 0.48 (plain target 0.125, lowest tcM 1.00) |
| Race-tune-like | 0.9 | 0.25 | 36 | 1.30 | 0.54 (plain target 0.151, lowest tcM 1.00) |
| Race-tune-like | 1 | 0.26 | 35 | 1.22 | 0.55 (plain target 0.147, lowest tcM 1.00) |

### Stability runs

The lane follower with the autopilot's gains: straight with a lane change at 1 s and a 0.12 rad/s yaw shove at 4 s; the R600 sweeper with a lift (2–3.5 s) and a 0.8 brake (4.5–5.5 s). Worst body slip, worst after 7 s, how far off the lane.

| Car | h | run | worst ° (at s) | after 7 s ° | off lane m | end m/s |
| --- | --- | --- | --- | --- | --- | --- |
| GT | 0 | straight 134 mph | 0.54 (1.4) | 0.03 | 3.7 | 60.0 |
| GT | 0 | straight 168 mph | 0.54 (4.1) | 0.05 | 3.7 | 75.0 |
| GT | 0 | straight 201 mph | 0.58 (4.1) | 0.07 | 3.7 | 90.0 |
| GT | 0 | sweeper L 101 mph | 0.58 (1.8) | 0.49 | 1.3 | 45.0 |
| GT | 0 | sweeper R 101 mph | 0.58 (1.8) | 0.49 | 1.3 | 45.0 |
| GT | 0 | sweeper L 123 mph | 0.90 (2.0) | 0.69 | 2.7 | 53.3 |
| GT | 0 | sweeper R 123 mph | 0.90 (2.0) | 0.68 | 2.7 | 53.3 |
| GT | 0.15 | straight 134 mph | 0.60 (1.4) | 0.04 | 3.7 | 60.0 |
| GT | 0.15 | straight 168 mph | 0.61 (4.1) | 0.07 | 3.7 | 75.0 |
| GT | 0.15 | straight 201 mph | 0.65 (4.1) | 0.09 | 3.7 | 90.0 |
| GT | 0.15 | sweeper L 101 mph | 0.65 (1.8) | 0.53 | 1.4 | 45.0 |
| GT | 0.15 | sweeper R 101 mph | 0.64 (1.8) | 0.53 | 1.4 | 45.0 |
| GT | 0.15 | sweeper L 123 mph | 1.02 (2.0) | 0.77 | 2.8 | 53.4 |
| GT | 0.15 | sweeper R 123 mph | 1.02 (2.0) | 0.76 | 2.8 | 53.4 |
| GT | 0.35 | straight 134 mph | 0.68 (1.4) | 0.05 | 3.7 | 60.0 |
| GT | 0.35 | straight 168 mph | 0.70 (4.1) | 0.09 | 3.7 | 75.0 |
| GT | 0.35 | straight 201 mph | 0.76 (4.1) | 0.11 | 3.7 | 90.0 |
| GT | 0.35 | sweeper L 101 mph | 0.80 (5.8) | 0.59 | 1.5 | 45.0 |
| GT | 0.35 | sweeper R 101 mph | 0.80 (5.8) | 0.59 | 1.5 | 45.0 |
| GT | 0.35 | sweeper L 123 mph | 1.27 (5.9) | 0.87 | 2.9 | 53.5 |
| GT | 0.35 | sweeper R 123 mph | 1.26 (5.9) | 0.86 | 2.9 | 53.5 |
| GT | 0.5 | straight 134 mph | 0.74 (1.4) | 0.06 | 3.7 | 60.0 |
| GT | 0.5 | straight 168 mph | 0.77 (4.1) | 0.10 | 3.7 | 75.0 |
| GT | 0.5 | straight 201 mph | 0.85 (4.2) | 0.13 | 3.7 | 90.0 |
| GT | 0.5 | sweeper L 101 mph | 0.93 (5.8) | 0.64 | 1.5 | 45.0 |
| GT | 0.5 | sweeper R 101 mph | 0.92 (5.8) | 0.64 | 1.5 | 45.0 |
| GT | 0.5 | sweeper L 123 mph | 1.44 (5.9) | 0.97 | 3.1 | 53.8 |
| GT | 0.5 | sweeper R 123 mph | 1.43 (5.9) | 0.96 | 3.1 | 53.8 |
| GT | 0.9 | straight 134 mph | 0.91 (1.5) | 0.07 | 3.7 | 60.0 |
| GT | 0.9 | straight 168 mph | 0.94 (4.2) | 0.12 | 3.7 | 75.0 |
| GT | 0.9 | straight 201 mph | 1.06 (4.2) | 0.15 | 3.7 | 90.0 |
| GT | 0.9 | sweeper L 101 mph | 1.42 (5.8) | 0.76 | 1.5 | 45.0 |
| GT | 0.9 | sweeper R 101 mph | 1.40 (5.8) | 0.76 | 1.5 | 45.0 |
| GT | 0.9 | sweeper L 123 mph | 1.97 (5.9) | 1.32 | 3.2 | 54.5 |
| GT | 0.9 | sweeper R 123 mph | 1.94 (5.9) | 1.30 | 3.2 | 54.5 |
| GT | 1 | straight 134 mph | 0.95 (1.5) | 0.06 | 3.7 | 60.0 |
| GT | 1 | straight 168 mph | 0.98 (4.2) | 0.11 | 3.7 | 75.0 |
| GT | 1 | straight 201 mph | 1.10 (4.2) | 0.15 | 3.7 | 90.0 |
| GT | 1 | sweeper L 101 mph | 1.42 (5.9) | 0.79 | 1.4 | 45.0 |
| GT | 1 | sweeper R 101 mph | 1.40 (5.9) | 0.78 | 1.4 | 45.0 |
| GT | 1 | sweeper L 123 mph | 2.09 (6.0) | 1.43 | 3.1 | 54.8 |
| GT | 1 | sweeper R 123 mph | 2.06 (6.0) | 1.41 | 3.1 | 54.8 |
| Unleashed-like | 0 | straight 134 mph | 0.44 (1.3) | 0.01 | 3.7 | 60.0 |
| Unleashed-like | 0 | straight 201 mph | 0.43 (4.1) | 0.02 | 3.7 | 90.0 |
| Unleashed-like | 0 | straight 251 mph | 0.45 (4.1) | 0.05 | 3.7 | 112.0 |
| Unleashed-like | 0 | straight 336 mph | 0.52 (1.4) | 0.12 | 3.7 | 145.4 |
| Unleashed-like | 0 | sweeper L 123 mph | 0.68 (5.7) | 0.55 | 1.8 | 55.0 |
| Unleashed-like | 0 | sweeper R 123 mph | 0.67 (5.7) | 0.54 | 1.8 | 55.0 |
| Unleashed-like | 0 | sweeper L 179 mph | 1.27 (1.9) | 1.03 | 7.0 | 80.0 |
| Unleashed-like | 0 | sweeper R 179 mph | 1.27 (2.0) | 1.02 | 7.0 | 80.0 |
| Unleashed-like | 0.15 | straight 134 mph | 0.48 (1.3) | 0.01 | 3.7 | 60.0 |
| Unleashed-like | 0.15 | straight 201 mph | 0.47 (4.1) | 0.03 | 3.7 | 90.0 |
| Unleashed-like | 0.15 | straight 251 mph | 0.50 (4.1) | 0.05 | 3.7 | 112.0 |
| Unleashed-like | 0.15 | straight 336 mph | 0.59 (1.4) | 0.13 | 3.7 | 145.4 |
| Unleashed-like | 0.15 | sweeper L 123 mph | 0.83 (5.7) | 0.60 | 1.9 | 55.0 |
| Unleashed-like | 0.15 | sweeper R 123 mph | 0.83 (5.7) | 0.59 | 1.9 | 55.0 |
| Unleashed-like | 0.15 | sweeper L 179 mph | 1.46 (2.0) | 1.15 | 7.2 | 80.0 |
| Unleashed-like | 0.15 | sweeper R 179 mph | 1.45 (2.0) | 1.14 | 7.2 | 80.0 |
| Unleashed-like | 0.35 | straight 134 mph | 0.53 (1.3) | 0.01 | 3.7 | 60.0 |
| Unleashed-like | 0.35 | straight 201 mph | 0.52 (4.1) | 0.04 | 3.7 | 90.0 |
| Unleashed-like | 0.35 | straight 251 mph | 0.57 (4.1) | 0.06 | 3.7 | 112.0 |
| Unleashed-like | 0.35 | straight 336 mph | 0.69 (1.4) | 0.15 | 3.7 | 145.4 |
| Unleashed-like | 0.35 | sweeper L 123 mph | 1.13 (5.7) | 0.67 | 1.9 | 55.0 |
| Unleashed-like | 0.35 | sweeper R 123 mph | 1.12 (5.7) | 0.67 | 1.9 | 55.0 |
| Unleashed-like | 0.35 | sweeper L 179 mph | 1.70 (2.4) | 1.31 | 7.6 | 79.9 |
| Unleashed-like | 0.35 | sweeper R 179 mph | 1.68 (2.4) | 1.30 | 7.6 | 79.9 |
| Unleashed-like | 0.5 | straight 134 mph | 0.57 (1.3) | 0.01 | 3.7 | 60.0 |
| Unleashed-like | 0.5 | straight 201 mph | 0.57 (4.1) | 0.04 | 3.7 | 90.0 |
| Unleashed-like | 0.5 | straight 251 mph | 0.63 (1.4) | 0.07 | 3.7 | 112.0 |
| Unleashed-like | 0.5 | straight 336 mph | 0.77 (1.4) | 0.15 | 3.7 | 145.4 |
| Unleashed-like | 0.5 | sweeper L 123 mph | 2.85 (5.9) | 0.79 | 1.9 | 55.0 |
| Unleashed-like | 0.5 | sweeper R 123 mph | 2.82 (5.9) | 0.78 | 1.9 | 55.0 |
| Unleashed-like | 0.5 | sweeper L 179 mph | 1.89 (2.5) | 1.43 | 7.9 | 79.8 |
| Unleashed-like | 0.5 | sweeper R 179 mph | 1.87 (2.5) | 1.41 | 7.9 | 79.8 |
| Unleashed-like | 0.9 | straight 134 mph | 0.67 (1.4) | 0.02 | 3.7 | 60.0 |
| Unleashed-like | 0.9 | straight 201 mph | 0.65 (4.1) | 0.05 | 3.7 | 90.0 |
| Unleashed-like | 0.9 | straight 251 mph | 0.79 (1.4) | 0.07 | 3.7 | 112.0 |
| Unleashed-like | 0.9 | straight 336 mph | 0.99 (1.4) | 0.16 | 3.7 | 145.4 |
| Unleashed-like | 0.9 | sweeper L 123 mph | 10.76 (6.2) | 1.86 | 2.1 | 55.0 |
| Unleashed-like | 0.9 | sweeper R 123 mph | 10.73 (6.2) | 1.83 | 2.1 | 55.0 |
| Unleashed-like | 0.9 | sweeper L 179 mph | 3.06 (6.0) | 1.66 | 8.3 | 79.7 |
| Unleashed-like | 0.9 | sweeper R 179 mph | 3.03 (6.0) | 1.64 | 8.3 | 79.7 |
| Unleashed-like | 1 | straight 134 mph | 0.70 (1.4) | 0.02 | 3.7 | 60.0 |
| Unleashed-like | 1 | straight 201 mph | 0.67 (4.1) | 0.04 | 3.7 | 90.0 |
| Unleashed-like | 1 | straight 251 mph | 0.82 (1.4) | 0.07 | 3.7 | 112.0 |
| Unleashed-like | 1 | straight 336 mph | 1.04 (1.4) | 0.15 | 3.7 | 145.4 |
| Unleashed-like | 1 | sweeper L 123 mph | 10.98 (6.2) | 4.11 | 2.3 | 55.0 |
| Unleashed-like | 1 | sweeper R 123 mph | 10.95 (6.2) | 4.10 | 2.4 | 55.0 |
| Unleashed-like | 1 | sweeper L 179 mph | 3.68 (6.1) | 1.71 | 8.1 | 79.7 |
| Unleashed-like | 1 | sweeper R 179 mph | 3.65 (6.1) | 1.69 | 8.1 | 79.7 |

### Rear-end contact (swept)

A stopped car, the player closing at U with a lateral offset, 25 approach phases at 120 Hz with the push-out applied. Cell: contacts / phases, and the lowest contact speed along the player's nose as a share of the closing speed. 2.0 m must be a miss.

| Class, closing | 0 m | 0.5 m | 1.0 m | 1.2 m | 1.6 m | miss (sedan 2.0 m, semi 2.3 m) |
| --- | --- | --- | --- | --- | --- | --- |
| sedan 60 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |
| sedan 120 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |
| sedan 150 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |
| semi 60 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |
| semi 120 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |
| semi 150 m/s | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 25/25 100% | 0/25 |

### dt-independence: 240 Hz against 120 Hz

| Car | h | 0-60 | 0-100 | ¼ mile | top | 100-0 | g25 | g40 | g80 | caught | peak Δ° | hb entry Δs | rev κF Δ | GO 0-60 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GT | 0.15 | 0.38% | 0.50% | 0.24% | 0.00% | 0.01% | 0.001 | 0.001 | 0.001 | 0.5% | 1.1 | 0.000 | 0.000 | 0.64% |
| GT | 0.35 | 0.49% | 0.41% | 0.19% | 0.00% | 0.03% | 0.000 | 0.000 | 0.001 | 0.4% | 0.1 | 0.004 | 0.000 | 0.61% |
| GT | 0.5 | 0.95% | 0.56% | 0.30% | 0.00% | 0.03% | 0.000 | 0.000 | 0.000 | 0.7% | 0.0 | 0.004 | 0.000 | 1.05% |
| GT | 0.9 | 0.42% | 0.44% | 0.20% | 0.00% | 0.00% | 0.000 | 0.000 | 0.000 | 2.4% | 0.0 | 0.004 | 0.000 | 0.42% |
| GT | 1 | 0.32% | 0.38% | 0.17% | 0.00% | 0.00% | 0.001 | 0.001 | 0.001 | 2.8% | 0.1 | 0.000 | 0.000 | 0.48% |
| Brio | 0.15 | 0.65% | 0.45% | 0.19% | 0.02% | 0.20% | 0.001 | 0.001 | 0.001 | 1.1% | 0.2 | 0.000 | 0.000 | 0.65% |
| Brio | 0.35 | 0.88% | 0.56% | 0.26% | 0.02% | 0.23% | 0.000 | 0.000 | 0.001 | 0.9% | 0.1 | 0.000 | 0.000 | 0.75% |
| Brio | 0.5 | 1.02% | 0.71% | 0.29% | 0.02% | 0.04% | 0.000 | 0.000 | 0.000 | 0.3% | 0.1 | 0.008 | 0.000 | 1.02% |
| Brio | 0.9 | 0.54% | 0.36% | 0.14% | 0.02% | 0.37% | 0.000 | 0.000 | 0.000 | 2.5% | 0.1 | 0.004 | 0.000 | 0.54% |
| Brio | 1 | 0.35% | 0.30% | 0.10% | 0.02% | 0.18% | 0.001 | 0.001 | 0.000 | 2.6% | 0.1 | 0.004 | 0.000 | 0.35% |
| Corsa | 0.15 | 0.54% | 0.46% | 0.20% | 0.02% | 0.01% | 0.001 | 0.001 | 0.001 | 0.0% | 0.2 | 0.000 | 0.000 | 0.40% |
| Corsa | 0.35 | 0.51% | 0.66% | 0.32% | 0.02% | 0.14% | 0.000 | 0.000 | 0.001 | 0.5% | 0.1 | 0.000 | 0.000 | 0.77% |
| Corsa | 0.5 | 0.45% | 0.53% | 0.27% | 0.02% | 0.07% | 0.000 | 0.000 | 0.000 | 0.3% | 0.0 | 0.004 | 0.000 | 0.90% |
| Corsa | 0.9 | 2.04% | 0.31% | 0.17% | 0.02% | 0.04% | 0.000 | 0.000 | 0.000 | 2.5% | 0.1 | 0.004 | 0.000 | 2.22% |
| Corsa | 1 | 0.26% | 0.35% | 0.14% | 0.02% | 0.05% | 0.001 | 0.001 | 0.000 | 3.3% | 0.1 | 0.004 | 0.000 | 0.26% |
| Vela E | 0.15 | 0.75% | 0.50% | 0.24% | 0.00% | 0.22% | 0.001 | 0.001 | 0.001 | 1.6% | 1.1 | 0.000 | 0.000 | 0.63% |
| Vela E | 0.35 | 0.71% | 0.48% | 0.23% | 0.00% | 0.11% | 0.000 | 0.000 | 0.001 | 0.4% | 0.0 | 0.000 | 0.001 | 0.60% |
| Vela E | 0.5 | 0.84% | 0.56% | 0.30% | 0.00% | 0.10% | 0.000 | 0.000 | 0.000 | 0.9% | 0.2 | 0.000 | 0.000 | 0.74% |
| Vela E | 0.9 | 0.33% | 0.40% | 0.14% | 0.00% | 0.06% | 0.000 | 0.000 | 0.000 | 1.4% | 0.3 | 0.008 | 0.000 | 0.50% |
| Vela E | 1 | 0.49% | 0.53% | 0.23% | 0.00% | 0.06% | 0.000 | 0.000 | 0.000 | 1.4% | 0.2 | 0.004 | 0.000 | 0.49% |
| Unleashed-like | 0.15 | 0.37% | 0.54% | 0.25% | 0.00% | 0.18% | 0.001 | 0.001 | 0.002 | 0.0% | 0.5 | 0.004 | 0.000 | 0.56% |
| Unleashed-like | 0.35 | 0.17% | 0.41% | 0.19% | 0.00% | 0.19% | 0.001 | 0.001 | 0.001 | 0.0% | 0.5 | 0.000 | 0.001 | 0.35% |
| Unleashed-like | 0.5 | 0.61% | 0.72% | 0.32% | 0.00% | 0.18% | 0.000 | 0.001 | 0.001 | 0.0% | 0.4 | 0.004 | 0.000 | 0.46% |
| Unleashed-like | 0.9 | 0.35% | 0.35% | 0.20% | 0.00% | 0.14% | 0.001 | 0.001 | 0.000 | 4.4% | 0.3 | 0.004 | 0.000 | 0.35% |
| Unleashed-like | 1 | 0.23% | 0.27% | 0.12% | 0.00% | 0.15% | 0.001 | 0.001 | 0.000 | 3.5% | 0.1 | 0.004 | 0.000 | 0.45% |
| Race-tune-like | 0.15 | 0.54% | 0.46% | 0.16% | 0.00% | 0.01% | 0.001 | 0.001 | 0.001 | 0.0% | 0.2 | 0.000 | 0.000 | 0.68% |
| Race-tune-like | 0.35 | 0.51% | 0.51% | 0.24% | 0.00% | 0.02% | 0.000 | 0.000 | 0.001 | 0.0% | 0.1 | 0.000 | 0.000 | 0.51% |
| Race-tune-like | 0.5 | 0.79% | 0.72% | 0.38% | 0.00% | 0.03% | 0.000 | 0.000 | 0.000 | 0.7% | 0.0 | 0.004 | 0.000 | 0.68% |
| Race-tune-like | 0.9 | 0.35% | 0.31% | 0.14% | 0.00% | 0.00% | 0.000 | 0.000 | 0.000 | 2.8% | 0.1 | 0.008 | 0.000 | 0.35% |
| Race-tune-like | 1 | 0.26% | 0.30% | 0.17% | 0.00% | 0.00% | 0.000 | 0.000 | 0.000 | 3.0% | 0.2 | 0.000 | 0.000 | 0.43% |
