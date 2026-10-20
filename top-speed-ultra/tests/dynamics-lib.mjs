// The dynamics harness's scenarios. Every function takes the physics module M ({ CarPhysics, SPEC, applyCar, Path })
// so the same code measures the parent commit's bundle (the control column) and the current tree. Node only, no
// browser; the road is a synthetic Path, the network has no walls. Methods as PROJECT_OC_DYNAMICS.md §0.
export const G = 9.81, MPH = 2.236936, DEG = 180 / Math.PI;

export function makeStraight(Path, km = 30) {
  const N = Math.round(km * 10) + 1, c = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) c[i * 3 + 1] = i * 100;
  return new Path(1, 'm', 4, c);
}
// a constant-radius arc (left-hand when sign > 0), about `len` metres long
export function makeArc(Path, R, sign = 1, len = 8000) {
  const step = Math.min(50, R / 4), N = Math.max(8, Math.ceil(len / step)), c = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) { const th = (i * step) / R; c[i * 3] = sign * R * (1 - Math.cos(th)); c[i * 3 + 1] = R * Math.sin(th); }
  return new Path(2, 'm', 4, c);
}
export const net = { wallsNear(x, z, y, r, out) { out.length = 0; } };
export const ctl = () => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, lookBack: false, lookYaw: 0, lookPitch: 0, analog: true });

// the two test CarDefs from the hypercar plan's §5.2 and §5.3 (Unleashed-like without its ability; race-tune-like)
export const TUNES = {
  unleashed: { id: 'unleashed', name: 'Unleashed-like', blurb: '', price: 0, level: 0, mass: 1690, power: 1500000, torque: 2000, redline: 9000, CdA: 0.62, ClA: 2.2, grip: 1.3, paint: 0, final: 3.0,
    Cf: 225000, Cr: 333000, steerGain: 1.25, brakeG: 2.0, halfL: 2.36, halfW: 1.02 },
  race: { id: 'race', name: 'Race-tune-like', blurb: '', price: 0, level: 0, mass: 1500, power: 620000, torque: 1000, redline: 9000, CdA: 0.8, ClA: 1.0, grip: 1.04, paint: 0, final: 4.0 },
};

// a car at a handling value. The parent's applyCar ignores the optional fields, so the harness sets the ones it had a
// way to set (Cf/Cr on SPEC, the steering gain on maxDelta); brakeG did not exist there (its pedal is fixed at 1.35 g).
export function setup(M, car, handling, opts = {}) {
  const grip = M.applyCar(car);
  const S = M.SPEC;
  if (!('steerGain' in S)) {
    if (car.Cf) { S.Cf = car.Cf; S.Cr = car.Cr; }
    if (car.halfL) { S.halfL = car.halfL; S.halfW = car.halfW; }
  }
  const p = new M.CarPhysics();
  p.handling = handling; p.grip = grip; p.auto = true;
  if (!('steerGain' in S) && car.steerGain) { const orig = p.maxDelta.bind(p); p.maxDelta = (v) => orig(v) * car.steerGain; }
  if ('abs' in p) { p.abs = opts.abs ?? true; p.tc = opts.tc ?? true; }
  return p;
}
export const hasWheels = (p) => 'kR' in p;
// the scripted drivers decide at 120 Hz whatever the physics rate, so a 240 Hz run compares the physics, not the script
export const tick = (t, st) => { if (t + 1e-9 < st.ctl) return false; st.ctl += 1 / 120; return true; };
export const bodySlip = (p) => Math.abs(Math.atan2(p.vy, Math.max(1, Math.abs(p.vx)))) * DEG;
export const driftAngle = (p) => (p.drift ? p.drift.angle : p.vx > 1 ? -Math.atan2(p.vy, p.vx) * DEG : 0);

// the controllers' slip targets, from public state (the same arithmetic as Physics.ts §3.6-3.7, straight-line loads)
export function targets(M, p) {
  const S = M.SPEC, L = S.a + S.b, assist = 1 - p.handling, mu = (1.12 + 0.3 * assist) * p.grip, v = Math.abs(p.vx);
  const down = 0.5 * 1.225 * S.ClA * v * v, Wf = (S.mass * G * S.b) / L, Wr = (S.mass * G * S.a) / L, dLong = (S.mass * p.ax * S.h) / L;
  const Fzf = Math.max(500, Wf - dLong + 0.42 * down), Fzr = Math.max(500, Wr + dLong + 0.58 * down), k = S.loadSens ?? 0.12;
  const muF = mu * Math.min(1.1, Math.max(0.7, 1 - k * (Fzf / Wf - 1))), muR = mu * Math.min(1.1, Math.max(0.7, 1 - k * (Fzr / Wr - 1)));
  const sTc = 2.5 + 2.65 * Math.sqrt(Math.min(1, Math.max(0, (p.handling - 0.35) / 0.55)));
  const sgn = p.vx < 0 ? -1 : 1;                                   // braking in reverse is a positive slip ratio
  return { kAbsF: (sgn * -(2 + 0.5 * assist) * muF) / (S.kx ?? 20), kAbsR: (sgn * -(2 + 0.5 * assist) * muR) / (S.kx ?? 20), kTc: (sTc * muR) / (S.kx ?? 20) };
}

// full throttle from rest: 0-60, 0-100, the quarter mile with its trap speed, the top speed (|dv| per step under
// 0.0002 m/s for 3 s, i.e. under 0.024 m/s^2)
export function accel(M, road, car, h, hz, maxT = 160) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl();
  p.placeAt(road, 100, road.laneCenter(1), 0);
  c.throttle = 1;
  let t = 0, t60 = -1, t100 = -1, tq = -1, vq = 0, vmax = 0, s0 = p.s, lastV = 0, settleT = 0, kPeak = 0, kTopSum = 0, kTopN = 0;
  for (; t < maxT; t += dt) {
    p.step(dt, c, road, net);
    const v = p.vx;
    if (t60 < 0 && v >= 26.8224) t60 = t + dt;
    if (t100 < 0 && v >= 44.704) t100 = t + dt;
    if (tq < 0 && p.s - s0 >= 402.336) { tq = t + dt; vq = v; }
    if (v > vmax) vmax = v;
    if (hasWheels(p) && t < 3) kPeak = Math.max(kPeak, p.kR);
    if (!Number.isFinite(v)) return { nan: true, t60, t100, tq, vq: 0, top: 0 };
    if (t > 20 && Math.abs(v - lastV) < (0.0002 * 120) / hz) { settleT += dt; if (hasWheels(p)) { kTopSum += p.kR; kTopN++; } if (settleT > 3) break; } else settleT = 0;
    lastV = v;
  }
  return { t60, t100, tq, vq: vq * MPH, top: vmax * MPH, kPeak, kTop: kTopN ? kTopSum / kTopN : 0 };
}

// 100-0: a 0.2 s settle at 44.7 m/s, then the full pedal to 0.5 m/s; the mean front slip ratio over the stop against
// the ABS target, and (ABS off) the time for the front to reach kappa < -0.9
export function brake(M, road, car, h, hz, opts = {}) {
  const v0 = opts.v0 ?? 44.704, dt = 1 / hz, p = setup(M, car, h, opts), c = ctl();
  p.placeAt(road, 100, road.laneCenter(1), v0);
  let t = 0;
  for (; t < 0.2; t += dt) { c.throttle = p.vx < v0 ? 0.6 : 0; p.step(dt, c, road, net); }
  const s1 = p.s; c.throttle = 0; c.brake = 1; t = 0;
  let kSum = 0, kTSum = 0, kN = 0, tLock = -1, pMin = 1;
  while (p.vx > 0.5 && t < 20) {
    p.step(dt, c, road, net); t += dt;
    if (hasWheels(p) && p.vx > 3) { kSum += p.kF; kTSum += targets(M, p).kAbsF; kN++; pMin = Math.min(pMin, p.absP.f); if (tLock < 0 && p.kF < -0.9) tLock = t; }
    if (!Number.isFinite(p.vx)) return { nan: true, dist: 1e9, t };
  }
  return { dist: p.s - s1, t, kMean: kN ? kSum / kN : 0, kTarget: kN ? kTSum / kN : 0, tLock, pMin };
}

// lateral g at a speed: for each steering value of a sweep, 4 s with a throttle/brake speed hold; the mean |ay| over
// the last 2 s counts only with the sideslip under 0.12 rad and the speed within 8%; the best run is kept
export function latG(M, road, car, h, hz, v0) {
  const dt = 1 / hz;
  const one = (steer) => {
    const p = setup(M, car, h), c = ctl();
    p.placeAt(road, 500, road.laneCenter(1), v0);
    let sum = 0, n = 0, betaMax = 0, vMin = 1e9, vMax = 0;
    for (let t = 0; t < 4; t += dt) {
      c.steer = steer;
      c.throttle = Math.max(0, Math.min(1, 0.3 + (v0 - p.vx) * 0.5));
      c.brake = Math.max(0, Math.min(1, (p.vx - v0 - 0.3) * 0.4));
      p.step(dt, c, road, net);
      if (t >= 2) { sum += Math.abs(p.ay); n++; betaMax = Math.max(betaMax, Math.abs(Math.atan2(p.vy, Math.max(1, Math.abs(p.vx))))); vMin = Math.min(vMin, p.vx); vMax = Math.max(vMax, p.vx); }
      if (!Number.isFinite(p.vx)) return { ok: false, g: 0 };
    }
    return { ok: betaMax < 0.12 && vMin > v0 * 0.92 && vMax < v0 * 1.08, g: sum / n / G, beta: betaMax };
  };
  const sweep = [0.02, 0.035, 0.05, 0.07, 0.09, 0.12, 0.15, 0.19, 0.24, 0.3, 0.38, 0.47, 0.58, 0.7, 0.85, 1.0];
  let best = { g: 0, steer: 0, ok: false, beta: 0 };
  for (const s of sweep) { const r = one(s); if (r.ok && r.g > best.g) best = { ...r, steer: s }; }
  if (best.steer > 0) {
    const i = sweep.indexOf(best.steer), lo = sweep[Math.max(0, i - 1)], hi = sweep[Math.min(sweep.length - 1, i + 1)];
    for (let k = 1; k < 6; k++) { const s = lo + ((hi - lo) * k) / 6; const r = one(s); if (r.ok && r.g > best.g) best = { ...r, steer: s }; }
  }
  return best;
}

// the scripted counter-steer: the front wheels pointed along the front axle's travel, within the lock on that side
function counterSteer(M, p, trim = 0) {
  const want = Math.atan2(p.vy + M.SPEC.a * p.r, Math.max(1, p.vx)) + trim;
  const lock = p.steerLock ? p.steerLock(want >= 0 ? 1 : -1) : p.maxDelta();
  return Math.max(-1, Math.min(1, -want / lock));
}
const trace = (log, t, p, c, every, state) => {
  if (!log) return;
  if (t + 1e-9 < state.next) return;
  state.next += every;
  log.push(`${t.toFixed(2)}s slip ${driftAngle(p).toFixed(1)} yaw ${(p.r * DEG).toFixed(0)}/s delta ${(p.delta * DEG).toFixed(1)} kR ${(p.kR ?? 0).toFixed(2)} thr ${c.throttle.toFixed(2)} steer ${c.steer.toFixed(2)} hb ${c.handbrake ? 1 : 0} v ${p.vx.toFixed(1)}`);
};

// handbrake entry at v0 (full left steer, handbrake, throttle off) to `entry` degrees, then the catch: handbrake off,
// throttle 0.15, counter-steer every step; time until |angle| < 5 deg, the peak, the peak yaw rate, a spin
export function catchTest(M, road, car, h, hz, v0 = 17.88, entry = 25, log = null) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl(), st = { next: 0, ctl: 0 };
  p.placeAt(road, 300, road.laneCenter(1), v0);
  for (let t = 0; t < 0.5; t += dt) { c.throttle = p.vx < v0 ? 0.5 : 0.1; p.step(dt, c, road, net); }
  let t = 0, peak = 0, entered = false;
  c.throttle = 0; c.steer = -1; c.handbrake = true;
  while (t < 1.0 && !entered) { p.step(dt, c, road, net); t += dt; trace(log, t, p, c, 0.1, st); if (tick(t, st)) entered = Math.abs(driftAngle(p)) >= entry; }
  const tEntry = t, angleEntry = driftAngle(p);
  c.handbrake = false; c.throttle = 0.15; c.brake = 0; st.ctl = 0;
  let tc = 0, caught = -1, maxR = 0, spun = false;
  while (tc < 4) {
    if (tick(tc, st)) c.steer = counterSteer(M, p);
    p.step(dt, c, road, net); tc += dt; trace(log, t + tc, p, c, 0.1, st);
    const ang = Math.abs(driftAngle(p));
    peak = Math.max(peak, ang); maxR = Math.max(maxR, Math.abs(p.r) * DEG);
    if (ang > 80 || p.vx < 3 || !Number.isFinite(p.vx)) { spun = true; break; }
    if (caught < 0 && ang < 5) caught = tc;
  }
  return { entered, tEntry, angleEntry, peak, caught, maxR, spun, vEnd: p.vx };
}

// power-over: 2nd gear held, steer 0.5 left, full throttle for 1.5 s with TC as the profile has it; then the catch
// controller with throttle 0.3 for up to 3 s. Reports the slip reached, when it passed 12 and 20 deg, the catch time,
// a spin, the angle and yaw rate at 3 s, and whether the yaw rate fell once the throttle lifted
export function powerOver(M, road, car, h, hz, v0, log = null) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl(), st = { next: 0, ctl: 0 };
  p.placeAt(road, 300, road.laneCenter(1), v0);
  p.auto = false; p.gear = v0 > 25 ? 3 : 2;
  for (let t = 0; t < 0.5; t += dt) { c.throttle = p.vx < v0 ? 0.5 : 0.1; p.step(dt, c, road, net); }
  let t = 0, peak = 0, t12 = -1, t20 = -1, kPeak = 0;
  c.steer = -0.5; c.throttle = 1;
  for (; t < 1.5; t += dt) {
    p.step(dt, c, road, net); trace(log, t, p, c, 0.1, st);
    const ang = Math.abs(driftAngle(p)); peak = Math.max(peak, ang);
    if (hasWheels(p)) kPeak = Math.max(kPeak, p.kR);
    if (t12 < 0 && ang > 12) t12 = t; if (t20 < 0 && ang > 20) t20 = t;
    if (!Number.isFinite(p.vx)) return { nan: true, peak, spun: true };
  }
  c.throttle = 0.3;
  let tc = 0, caught = -1, spun = false, rPeak = 0, rEnd = 0, angEnd = 0;
  for (; tc < 3; tc += dt) {
    if (tick(tc, st)) c.steer = counterSteer(M, p);
    p.step(dt, c, road, net); trace(log, t + tc, p, c, 0.1, st);
    const ang = Math.abs(driftAngle(p)); peak = Math.max(peak, ang); rPeak = Math.max(rPeak, Math.abs(p.r));
    if (ang > 100 || p.vx < 2 || !Number.isFinite(p.vx)) { spun = true; }
    if (caught < 0 && ang < 5 && tc > 0.1) caught = tc;
  }
  rEnd = Math.abs(p.r) * DEG; angEnd = Math.abs(driftAngle(p));
  return { peak, t12, t20, caught, spun, kPeak, rEnd, angEnd, finite: Number.isFinite(p.vx) && Number.isFinite(p.r), rPeak: rPeak * DEG };
}

// the pure-pursuit lane follower with the autopilot's gains, in units of maxDelta()
export function pursuit(M, p, path, lane) {
  const L = M.SPEC.a + M.SPEC.b, v = Math.max(3, p.vx), look = Math.min(70, Math.max(9, 6 + v * 0.75));
  const tgt = path.at(Math.min(path.len, p.s + look), path.laneCenter(lane));
  const dx = tgt.x - p.x, dz = tgt.z - p.z;
  const fwd = dx * Math.sin(p.psi) + dz * Math.cos(p.psi), left = dx * Math.cos(p.psi) - dz * Math.sin(p.psi);
  const alpha = Math.atan2(left, Math.max(0.1, fwd)), Ld = Math.hypot(dx, dz);
  const kappa = (2 * Math.sin(alpha)) / Math.max(1, Ld);
  const deltaLeft = Math.atan(L * kappa) + 0.55 * (kappa * v - p.r) * (L / v);
  return Math.max(-1, Math.min(1, -deltaLeft / p.maxDelta()));
}

// lift-off in a sweeper whose radius needs 0.9 x the car's lateral g at this speed: 1 s following the lane with a
// speed hold, then the hands held (the wheel angle, not the stick: the lock opens as the car slows) and the throttle
// to zero; the worst slip, and the worst after 4 s
export function liftOff(M, car, h, hz, v0, gLat, log = null) {
  const dt = 1 / hz, R = Math.max(25, (v0 * v0) / (0.9 * gLat * G));
  const road = makeArc(M.Path, R, 1, Math.max(400, v0 * 6 + 200));
  const p = setup(M, car, h), c = ctl(), st = { next: 0, ctl: 0 };
  p.placeAt(road, 50, road.laneCenter(1), v0);
  let worst = 0, tail = 0, deltaHeld = 0, spun = false, wide = 0;
  for (let t = 0; t < 4.5; t += dt) {
    if (t < 1) { if (tick(t, st)) { c.steer = pursuit(M, p, road, 1); c.throttle = Math.max(0, Math.min(1, 0.3 + (v0 - p.vx) * 0.5)); c.brake = Math.max(0, Math.min(1, (p.vx - v0 - 0.3) * 0.4)); } deltaHeld = p.delta; }
    else if (tick(t, st)) { c.steer = Math.max(-1, Math.min(1, -deltaHeld / p.maxDelta())); c.throttle = 0; c.brake = 0; }
    p.step(dt, c, road, net); trace(log, t, p, c, 0.1, st);
    const b = bodySlip(p);
    if (t >= 1) worst = Math.max(worst, b);
    if (t >= 4) tail = Math.max(tail, b);
    wide = Math.max(wide, Math.abs(p.d - road.laneCenter(1)));
    if (b > 90 || !Number.isFinite(p.vx)) { spun = true; break; }
  }
  return { R, worst, tail, spun, wide, finite: Number.isFinite(p.vx) };
}

// a held drift: the 40 mph handbrake entry, let go as the car is about to reach 25 deg (a driver anticipates: angle
// plus 0.15 s of yaw), then counter-steer trimmed to hold about 25 deg, the throttle 0.8 eased off as the angle runs
// past the target, for 3 s: the mean rear slip ratio over the hold and the longest drift.time
export function heldDrift(M, road, car, h, hz, log = null, o = {}) {
  const antic = o.antic ?? 0.05, target = o.target ?? 25, thrMin = o.thrMin ?? 0.3, kThr = o.kThr ?? 0.025, trim = o.trim ?? 0.35, kTrim = o.kTrim ?? 0.02, pre = o.pre ?? 8;
  const dt = 1 / hz, p = setup(M, car, h), c = ctl(), st = { next: 0, ctl: 0 };
  p.placeAt(road, 300, road.laneCenter(1), 17.88);
  for (let t = 0; t < 0.5; t += dt) { c.throttle = 0.3; p.step(dt, c, road, net); }
  let t = 0;
  c.throttle = 0; c.steer = -1; c.handbrake = true;
  let go = false;
  while (t < 1.0 && !go) {
    p.step(dt, c, road, net); t += dt; trace(log, t, p, c, 0.1, st);
    if (tick(t, st)) { go = Math.abs(driftAngle(p)) + Math.abs(p.r) * DEG * antic >= target; if (Math.abs(driftAngle(p)) > pre) c.steer = counterSteer(M, p); }   // the hands come round while the handbrake is still on
  }
  c.handbrake = false; c.throttle = 0.8; st.ctl = 0;
  let kSum = 0, n = 0, held = 0, spun = false, angSum = 0, nAll = 0;
  for (let th = 0; th < 3; th += dt) {
    if (tick(th, st)) {
      const ang = Math.abs(driftAngle(p)), err = target - ang;     // + when the angle is short of the target
      const sgn = Math.sign(driftAngle(p) || 1);
      c.steer = counterSteer(M, p, -sgn * Math.max(-trim, Math.min(trim, kTrim * err)));
      c.throttle = Math.max(thrMin, Math.min(0.8, 0.8 - kThr * Math.max(0, ang - target)));
    }
    p.step(dt, c, road, net); trace(log, t + th, p, c, 0.1, st);
    // the rear's slip while the driver is holding it: counter-steering (the wheel turned the way the nose points
    // off the travel) with the throttle at least half open; that is when the §3.7 rule lifts the TC's target
    if (hasWheels(p) && c.throttle >= 0.5 && c.steer * driftAngle(p) > 0 && Math.abs(driftAngle(p)) > 8) { kSum += p.kR; n++; }
    angSum += Math.abs(driftAngle(p)); nAll++;
    held = Math.max(held, p.drift ? p.drift.time : 0);
    if (Math.abs(driftAngle(p)) > 90 || p.vx < 3 || !Number.isFinite(p.vx)) { spun = true; break; }
  }
  return { kMean: n ? kSum / n : 0, holdSteps: n, held, spun, meanAngle: nAll ? angSum / nAll : 0, vEnd: p.vx };
}

// the held-drift rule (§3.7) on its own, no driver skill involved: a 20° slide imposed at 15 m/s, full counter-steer
// and 0.8 throttle for 0.5 s; the rear must spin well past the profile's plain TC target because `holding` lifts it
export function heldRule(M, road, car, h, hz) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl(), st = { ctl: 0 };
  p.placeAt(road, 300, road.laneCenter(1), 15);
  p.vy = -15 * Math.tan(20 / DEG); p.r = 0;
  let kPeak = 0, kTc = 0, minM = 1, over = 0;
  for (let t = 0; t < 0.5; t += dt) {
    if (tick(t, st)) { c.steer = counterSteer(M, p); c.throttle = 0.8; }
    p.step(dt, c, road, net);
    if (!hasWheels(p)) continue;
    kTc = targets(M, p).kTc;
    // while the car is still sliding (past 8°) with the rear past the plain target, the TC must not be cutting
    if (Math.abs(driftAngle(p)) > 8) { kPeak = Math.max(kPeak, p.kR); if (p.kR > kTc + 0.02) { minM = Math.min(minM, p.tcM); over++; } }
  }
  return { kPeak, kTc, minM, over, angle: driftAngle(p) };
}

// the TC check: full throttle from 5 m/s in 1st for 2 s; the peak rear slip ratio against the TC target
export function tcCheck(M, road, car, h, hz, tc) {
  const dt = 1 / hz, p = setup(M, car, h, { tc }), c = ctl();
  p.placeAt(road, 100, road.laneCenter(1), 5); p.auto = false; p.gear = 1;
  let kPeak = 0, kTc = 0;
  c.throttle = 1;
  for (let t = 0; t < 2; t += dt) { p.step(dt, c, road, net); if (hasWheels(p)) { kPeak = Math.max(kPeak, p.kR); kTc = targets(M, p).kTc; } }
  return { kPeak, kTc };
}

// the stability runs (stab.mjs as written): a lane follower on the straight with a lane change at 1 s and a yaw shove
// at 4 s, or on the R600 sweeper with a lift (2-3.5 s) and a 0.8 brake (4.5-5.5 s). Worst body slip, worst after 7 s,
// growth over the last 2 s, how far off the lane, a spin
export function stab(M, path, car, h, hz, v0, kind, log = null) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl(), st = { next: 0, ctl: 0 };
  p.placeAt(path, 300, path.laneCenter(1), v0);
  let lane = 1, worst = 0, worstT = 0, spun = false, tail = 0, at7 = 0, wide = 0, steady = 0;
  for (let t = 0; t < 9; t += dt) {
    if (kind === 'straight') {
      if (t > 1 && t < 1 + dt) lane = 2;
      if (t > 4 && t < 4 + dt) p.push(0, 0, 0.12);
    }
    if (tick(t, st)) {
      if (kind === 'straight') { c.throttle = p.vx < v0 ? 0.85 : 0.04; c.brake = 0; }
      else {
        const lift = t > 2 && t < 3.5, brk = t > 4.5 && t < 5.5;
        c.throttle = lift || brk ? 0 : p.vx < v0 ? 0.85 : 0.04; c.brake = brk ? 0.8 : 0;
      }
      c.steer = pursuit(M, p, path, lane);
    }
    p.step(dt, c, path, net); trace(log, t, p, c, 0.25, st);
    const b = bodySlip(p);
    if (t < 2) steady = b;                                       // the steady cornering slip before the first event
    if (b > worst) { worst = b; worstT = t; }
    if (t > 7) { tail = Math.max(tail, b); if (at7 === 0) at7 = b; }
    wide = Math.max(wide, Math.abs(p.d - path.laneCenter(lane)));
    if (b > 60 || Math.abs(p.d) > 12 || !Number.isFinite(p.vx)) { spun = true; break; }
  }
  return { worst, worstT, tail, at7, wide, spun, steady, vEnd: p.vx };
}

// the rear-end contact: a stopped car, the player closing at U with a lateral offset, stepped at 120 Hz through 25
// approach phases with Game.simulate's push-out. The contact must come on the first overlapping step with its speed
// along the player's nose at least 0.9 x the closing speed; at 2.0 m of offset, no contact
export function contactCase(sweptContact, cls, U, off, hz = 120) {
  const dt = 1 / hz, hl = 2.3, hw = 0.99, [len, wid, height] = cls;
  const car = { x: 0, z: 0, y: 0, h: 0, v: 0 };
  const out = { speed: 0, nx: 0, nz: 0, depth: 0 };
  let hits = 0, n = 0, minAlong = 1, late = 0, firstMiss = 0;
  for (let ph = 0; ph < 25; ph++) {
    n++;
    const step = U * dt, z0 = -(hl + len / 2) - (ph / 25) * step - step;
    const P = { x: off, z: z0, y: 0, psi: 0, wx: 0, wz: U, px: off, pz: z0, ppsi: 0, altitude: 0, len: hl * 2, wid: hw * 2 };
    let got = false, overlappedBefore = false;
    for (let k = 0; k < 12 && !got; k++) {
      P.px = P.x; P.pz = P.z; P.ppsi = P.psi;
      P.z += P.wz * dt; P.x += P.wx * dt;
      // a plain overlap at the final pose, to know whether this is the first overlapping step
      const overlapNow = Math.abs(P.z - car.z) < hl + len / 2 && Math.abs(P.x - car.x) < hw + wid / 2;
      const hit = sweptContact(P, car, len, wid, height, dt, out);
      if (hit) {
        got = true; hits++;
        const along = (out.speed * Math.abs(out.nz)) / U;
        minAlong = Math.min(minAlong, along);
        if (overlappedBefore) late++;
        P.x += out.nx * out.depth; P.z += out.nz * out.depth;
      } else if (overlapNow) overlappedBefore = true;
    }
    if (!got) firstMiss++;
  }
  return { n, hits, minAlong: hits ? minAlong : 0, late, misses: firstMiss };
}

// the handbrake with the foot on the brake (the usual entry on a phone): from v0, full left steer, the handbrake and
// the pedal at `brake` together, throttle off; the time to `entry` degrees of body slip, the lowest rear slip ratio
// (−1 is locked) and the lowest rear ABS pressure on the way
export function handbrakeWithPedal(M, road, car, h, hz, brake = 0.5, v0 = 17.88, entry = 25) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl();
  p.placeAt(road, 300, road.laneCenter(1), v0);
  for (let t = 0; t < 0.5; t += dt) { c.throttle = p.vx < v0 ? 0.5 : 0.1; p.step(dt, c, road, net); }
  c.throttle = 0; c.steer = -1; c.handbrake = true; c.brake = brake;
  let t = 0, tEntry = -1, kMin = 1, pMin = 1, peak = 0;
  for (; t < 1.5 && tEntry < 0; t += dt) {
    p.step(dt, c, road, net);
    if (hasWheels(p)) { kMin = Math.min(kMin, p.kR); pMin = Math.min(pMin, p.absP.r); }
    const a = Math.abs(driftAngle(p)); peak = Math.max(peak, a);
    if (a >= entry) tEntry = t + dt;
  }
  return { brake, tEntry, kMin, pMin, peak, finite: Number.isFinite(p.vx) };
}

// braking in reverse: v0 backwards in reverse gear, a 0.2 s settle, then the full pedal (in reverse the pedals swap,
// so the throttle control is the brake) to 0.5 m/s; the mean front slip ratio over the stop against the ABS target
// (positive: the wheel is slower than the road, which is backwards), the lowest front pressure, and with ABS off the
// time for the front to lock (κF > 0.9)
export function reverseBrake(M, road, car, h, hz, opts = {}) {
  const v0 = opts.v0 ?? 10, dt = 1 / hz, p = setup(M, car, h, opts), c = ctl();
  p.placeAt(road, 500, road.laneCenter(1), -v0); p.gear = -1; p.auto = false;
  for (let t = 0; t < 0.2; t += dt) p.step(dt, c, road, net);
  const s1 = p.s, v1 = -p.vx; c.throttle = 1; c.brake = 0;
  let kSum = 0, kTSum = 0, kN = 0, tLock = -1, pMin = 1, t = 0;
  while (p.vx < -0.5 && t < 10) {
    p.step(dt, c, road, net); t += dt;
    if (hasWheels(p) && p.vx < -3) { kSum += p.kF; kTSum += targets(M, p).kAbsF; kN++; pMin = Math.min(pMin, p.absP.f); if (tLock < 0 && p.kF > 0.9) tLock = t; }
    if (!Number.isFinite(p.vx)) return { nan: true, dist: 1e9, t };
  }
  return { v1, dist: s1 - p.s, t, kMean: kN ? kSum / kN : 0, kTarget: kN ? kTSum / kN : 0, tLock, pMin, finite: Number.isFinite(p.vx) };
}

// the race launch from the line, as Game.simulate's countdown drives it: `hold` with the brake, the handbrake and the
// throttle (pinned, or off) for `holdT`, then GO (brake and handbrake off, full throttle); how far the car crept
// during the hold, and 0-60 from GO
export function goLaunch(M, road, car, h, hz, throttleHeld = 1, holdT = 1) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl();
  p.placeAt(road, 100, road.laneCenter(1), 0);
  const s0 = p.s;
  let crept = 0, kHold = 0;
  for (let t = 0; t < holdT; t += dt) {
    p.hold = true; c.throttle = throttleHeld; c.brake = 1; c.handbrake = true;
    p.step(dt, c, road, net); p.hold = false;
    crept = Math.max(crept, Math.abs(p.vx)); if (hasWheels(p)) kHold = Math.max(kHold, Math.abs(p.kR));
  }
  const moved = p.s - s0, rpmGo = p.rpm;
  c.brake = 0; c.handbrake = false; c.throttle = 1;
  let t60 = -1;
  for (let t = 0; t < 20 && t60 < 0; t += dt) { p.step(dt, c, road, net); if (p.vx >= 26.8224) t60 = t + dt; }
  return { throttleHeld, crept, moved, kHold, rpmGo, t60 };
}

// a steady turn at v0 with a speed hold: the mean yaw rate (°/s) and lateral acceleration (g) over the last 2 s of 4,
// and the worst sideslip (rad). For the torque-vectoring check (the same car with `vector` 1 against 0)
export function steadyTurn(M, road, car, h, hz, v0, steer = 0.3) {
  const dt = 1 / hz, p = setup(M, car, h), c = ctl();
  p.placeAt(road, 500, road.laneCenter(1), v0);
  let rs = 0, as = 0, n = 0, beta = 0;
  for (let t = 0; t < 4; t += dt) {
    c.steer = steer; c.throttle = Math.max(0, Math.min(1, 0.3 + (v0 - p.vx) * 0.5)); c.brake = Math.max(0, Math.min(1, (p.vx - v0 - 0.3) * 0.4));
    p.step(dt, c, road, net);
    if (t >= 2) { rs += Math.abs(p.r); as += Math.abs(p.ay); n++; beta = Math.max(beta, Math.abs(Math.atan2(p.vy, Math.max(1, Math.abs(p.vx))))); }
    if (!Number.isFinite(p.vx)) return { r: NaN, g: NaN, beta: NaN };
  }
  return { r: (rs / n) * DEG, g: as / n / G, beta };
}
