// Vehicle dynamics: a single-track (bicycle) model with longitudinal and lateral load transfer, tyre load sensitivity,
// a wheel-speed state per axle driving one combined-slip (friction ellipse) tyre law, ABS and traction control as
// slip-ratio controllers on those states, aero drag and downforce, a 7-speed dual-clutch drivetrain with its inertia
// reflected to the driven axle, and the hypercar's interfaces: an external body force and axle load (`ext`), a front
// drive share, torque vectoring on the rear axle, and a scripted hop bound to the road. Runs at a fixed 120 Hz; nothing
// in it depends on the step size (exact exponentials, an implicit wheel update in two substeps).
// Car frame: x forward, y to the left, yaw rate r counter-clockwise (left) positive. SI units throughout.

import { clamp, lerp, smoothstep } from '../util';
import type { Controls } from '../input';
import type { Path, RoadPoint } from '../world/Path';
import type { Network, Wall } from '../world/Network';

export const SPEC = {
  // mid-engine: 57% of the weight on the rear axle; wider rear tyres (stiffer) keep it understeering and stable
  mass: 1480, a: 1.45, b: 1.2, h: 0.42, Iz: 2250, halfW: 0.99, halfL: 2.3,
  wheelR: 0.345, gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], reverse: 2.9, final: 4.44, eff: 0.9,
  idle: 1000, redline: 8000, limiter: 8150, peakTorque: 770, power: 530000,
  CdA: 0.62, ClA: 0.5, crr: 0.012, Cf: 125000, Cr: 185000, steerRatio: 13,
  // weight transfer: mean track, the front share of the lateral transfer (roll-stiffness split), tyre load sensitivity
  // (the peak friction coefficient falls 12% for every +100% of load), and the pitch/roll filters on ax/ay (1/s)
  track: 1.62, rollF: 0.5, loadSens: 0.12, lagAx: 10, lagAy: 10,
  // wheels and brakes: longitudinal slip stiffness per unit load, axle inertias (two wheels with brakes), engine plus
  // clutch inertia (reflected through the gearing), the pedal in g and the front share of brake torque
  kx: 40, IwF: 2.2, IwR: 2.6, Ieng: 0.25, brakeG: 1.6, brakeBias: 0.66,
  // the hypercar's knobs; these defaults change nothing for the earnable cars
  steerGain: 1, driveFront: 0, vector: 0, steerRate: 2.4, csRate: 2.0, hbKick: 0,
};
const L = SPEC.a + SPEC.b, G = 9.81, RHO = 1.225;
const U0 = 2.0;              // floor of the slip-ratio denominator (m/s)
const W_STICK = 1.0;         // below this wheel speed (rad/s) a brake that can hold the wheel does
const CLUTCH_T = 0.25;       // the clutch comes back in over this long after a handbrake pull (the clutch kick)

export function engineTorque(rpm: number) {
  const ramp = rpm < 3300 ? lerp(430, SPEC.peakTorque, clamp((rpm - 1000) / 2300, 0, 1)) : SPEC.peakTorque;
  return Math.min(ramp, SPEC.power / Math.max(1, (rpm * Math.PI) / 30));
}

export interface Impact { kind: 'wall' | 'car' | 'land'; speed: number; side: number }

// The tyre: one law for both axles. Slip ratio kappa (+ wheel faster than the road), slip angle alpha (+ velocity left
// of the wheel), normalised by the friction limit so the ellipse is a circle: F = mu Fz tanh(s) fall(s), shared between
// x and y in the direction of the slip. A locked or spinning wheel spends the circle on x and gives almost no lateral
// force, which is what makes the steering go dead under a lock-up and lets the handbrake and power-over swing the tail.
// K is the local slope dFx/dkappa for the implicit wheel update; s the normalised slip for the re-grip guard.
interface TyreOut { fx: number; fy: number; K: number; s: number }
const TF: TyreOut = { fx: 0, fy: 0, K: 0, s: 0 }, TR: TyreOut = { fx: 0, fy: 0, K: 0, s: 0 }, TT: TyreOut = { fx: 0, fy: 0, K: 0, s: 0 };
function tyre(kappa: number, alpha: number, Fz: number, mu: number, Ck: number, Ca: number, fallP: number, out: TyreOut) {
  const Fmax = mu * Fz;
  const sx = (Ck * kappa) / Fmax, sy = (Ca * alpha) / Fmax, s = Math.sqrt(sx * sx + sy * sy);   // not Math.hypot: it allocates
  out.s = s;
  if (s < 1e-9) { out.fx = 0; out.fy = 0; out.K = Ck; return; }
  const fall = 1 - fallP * smoothstep(2.0, 4.5, s);          // past the peak the rubber slides and gives less
  const th = Math.tanh(s), F = Fmax * th * fall;
  const cx = sx / s, cy = sy / s;
  out.fx = F * cx; out.fy = -F * cy;
  out.K = Math.max(0, Ck * (((th * fall) / s) * (1 - cx * cx) + (1 - th * th) * fall * cx * cx));
}
// tyre load sensitivity: an axle's peak friction coefficient falls a little with the load it carries above its static
// share, and with the transfer d onto its outside tyre (the inside gives up more than the outside gains)
function loadMu(mu: number, Fz: number, Fz0: number, d: number, k: number) {
  return mu * clamp(1 - k * ((Fz / Fz0 - 1) + (4 * d * d) / (Fz0 * Fz)), 0.7, 1.1);
}
// one axle's wheel speed over a substep h: linearised backward Euler with the tyre's local slope (fully implicit in the
// linear regime, a plain torque integrator once the tyre is saturated), a brake that holds a stopped wheel when it can,
// stops a wheel at zero rather than reversing it, and a re-grip guard for a sliding wheel coming back to zero slip.
// T.fx leaves as the force the implicit step solved for (the linearised force at the end of the substep), so the body
// sees the same impulse the wheel did: with the stale start-of-substep force a free-rolling axle would drag the car by
// the slip the body's own acceleration gave it since the last update, kilonewtons at walking pace
function wheelStep(w: number, v: number, u: number, Td: number, Tcap: number, I: number, T: TyreOut, R: number, h: number) {
  const Tnet = Td - R * T.fx;
  let w1 = 0;
  if (!(Tcap > 0 && Math.abs(w) < W_STICK && Math.abs(Tnet) <= Tcap)) {
    const Tb = Tcap * Math.tanh(w / 0.5);
    w1 = w + (h * (Tnet - Tb)) / (I + (h * R * R * T.K) / u);
    if (Tcap > 0 && w !== 0 && Math.sign(w1) !== Math.sign(w) && Math.abs(Tnet) <= Tcap) w1 = 0;
    else {
      const k0 = (w * R - v) / u, k1 = (w1 * R - v) / u;
      if (T.s > 1.5 && k0 !== 0 && Math.sign(k1) !== Math.sign(k0)) w1 = v / R;
    }
  }
  T.fx += (T.K * R * (w1 - w)) / u;
  return w1;
}

export class CarPhysics {
  // absolute world position and heading (heading: 0 = +z, increasing turns toward +x, i.e. left)
  x = 0; z = 0; y = 0; psi = 0;
  px = 0; pz = 0; ppsi = 0;   // the pose at the start of the last step (the traffic's swept contact)
  vx = 0; vy = 0; r = 0;
  delta = 0;                  // front wheel angle, + left
  rpm = SPEC.idle;
  gear = 1;                   // -1 reverse, 1..7
  auto = true;
  shiftT = 0;
  revBlip = 0;
  limiter = false;
  wheelRot = 0; wheelRotR = 0;
  ax = 0; ay = 0;             // body accelerations for the suspension, camera and audio
  slipF = 0; slipR = 0; spin = 0;
  // the wheels: axle angular speeds, the slip ratios this step, the ABS pressure and TC torque multipliers (a value
  // under 0.95 is the warning light), and the switches (the game never turns them off; the harness does)
  wF = 0; wR = 0; kF = 0; kR = 0;
  absP = { f: 1, r: 1 }; tcM = 1;
  abs = true; tc = true;
  // the caller's forces this step, in newtons: a body force along x (thrust) and a load pressed onto the axles 45/55
  // (fan suction). The physics never writes them.
  ext = { fx: 0, fz: 0 };
  // the hop: a scripted parabola bound to the road
  airborne = false;
  air = { t: 0, T: 0, peak: 0, alt: 0, vz: 0, rel: 0 };
  throttleOut = 0;            // what the engine is actually being asked for (after shifts and TC)
  s = 0; d = 0; slope = 0;
  handling = 0.35;            // 0 arcade .. 1 sim
  grip = 1;                   // the road: 1 dry, about 0.8 in the rain
  hold = false;               // on the start line: the brakes are on, and holding them doesn't select reverse
  // the drift readout, for the marks, the smoke and the HUD: the body slip angle in degrees (+ when the nose points
  // left of the direction of travel), whether it counts as a drift (past 8° over 8 m/s) and for how long it has (a
  // transition to the other side within half a second keeps the count going)
  drift = { angle: 0, active: false, time: 0 };
  impacts: Impact[] = [];
  roadH = 0;
  private driftLapse = 0;
  private hbWas = false; private hbMz = 0; private hbT = 1;
  private clutch = 1;         // 0 with the handbrake pulled (clutch in), back to 1 over CLUTCH_T after it
  private stillT = 0;
  private proj = { s: 0, d: 0 };
  private rp: RoadPoint = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };
  private at = { x: 0, y: 0, z: 0, h: 0 };
  private wallBuf: Wall[] = [];

  get speed() { return Math.sqrt(this.vx * this.vx + this.vy * this.vy); }
  get altitude() { return this.air.alt; }
  get ratio() { return this.gear < 0 ? SPEC.reverse : SPEC.gears[this.gear - 1]; }
  // the most the front wheels will turn at this speed: full lock when parking, a few degrees at 200 mph
  // (what the tyres can use: past ~100 mph a fraction of a degree already asks for more than the grip there is)
  maxDelta(v = Math.abs(this.vx)) { return clamp((L * 13.5) / (v * v + 1) + 0.03 * (1 - smoothstep(18, 55, v)) + 0.0065, 0.0065, 0.52) * (1 + this.handling * 0.35) * SPEC.steerGain; }
  // the lock available to a steer request on this side (+1 left, -1 right): maxDelta()'s speed limit, opened up on the
  // counter-steer side (the front wheels turned toward the direction of travel) to the body slip angle plus an 8°
  // margin, up to a road car's 38° of lock, so a slide can be caught and straightened; steering into the slide stays
  // speed-limited
  steerLock(side: number, v = Math.abs(this.vx)) {
    const base = this.maxDelta(v);
    if (this.vx < 3 || side * this.vy <= 0) return base;
    const beta = Math.abs(Math.atan2(this.vy, this.vx)), cap = Math.max(0.66, base);
    return base + clamp(beta + 0.14 - base, 0, cap - base) * smoothstep(0.04, 0.12, beta);
  }

  placeAt(road: Path, s: number, d: number, speed: number) {
    const p = road.at(s, d, this.at);
    this.x = this.px = p.x; this.z = this.pz = p.z; this.y = p.y; this.psi = this.ppsi = p.h; this.roadH = p.h;
    this.vx = speed; this.vy = 0; this.r = 0; this.delta = 0;
    this.s = s; this.d = d; this.gear = speed > 20 ? 4 : 1; this.shiftT = 0;
    this.wF = this.wR = speed / SPEC.wheelR; this.kF = this.kR = 0; this.spin = 0;
    this.absP.f = this.absP.r = 1; this.tcM = 1;
    this.airborne = false; this.air.alt = 0; this.air.t = 0;
    this.ax = 0; this.ay = 0;
    this.drift.angle = 0; this.drift.active = false; this.drift.time = 0; this.driftLapse = 0; this.hbMz = 0; this.hbT = 1; this.hbWas = false; this.clutch = 1;
    this.rpm = Math.max(SPEC.idle, this.wheelRpm() * this.ratio * SPEC.final);
  }

  // the axle the engine is geared to (signed, so reverse reads negative)
  private wheelRpm() { return ((SPEC.driveFront > 0.5 ? this.wF : this.wR) * 30) / Math.PI; }

  shift(dir: 1 | -1) {
    if (this.shiftT > 0) return false;
    const spd = this.vx;
    if (dir > 0) {
      if (this.gear === -1) { this.gear = 1; this.shiftT = 0.25; return true; }
      if (this.gear >= SPEC.gears.length) return false;
      this.gear++; this.shiftT = 0.09; return true;
    }
    if (this.gear === 1) { if (spd < 1.5) { this.gear = -1; this.shiftT = 0.3; return true; } return false; }
    if (this.gear <= 1) return false;
    const next = (this.wheelRpm() * SPEC.gears[this.gear - 2] * SPEC.final);
    if (next > SPEC.redline + 150) return false;                 // would over-rev: refuse
    this.gear--; this.shiftT = 0.12; this.revBlip = 0.18; return true;
  }

  // Thrust Hop: a ballistic arc of the given peak height and air time, bound to the road. Refused while airborne, under
  // 3 m/s, or with nothing to fly. The caller decides height and time, and refuses under structures before calling.
  hop(peakHeight: number, airTime: number) {
    if (this.airborne || this.vx < 3 || airTime <= 0 || peakHeight <= 0) return false;
    const A = this.air;
    A.t = 0; A.T = airTime; A.peak = peakHeight; A.alt = 0; A.vz = (4 * peakHeight) / airTime;
    const rel = this.psi - this.roadH; A.rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.airborne = true;
    return true;
  }

  step(dt: number, c: Controls, road: Path, net: Network) {
    this.px = this.x; this.pz = this.z; this.ppsi = this.psi;
    if (this.airborne) { this.airStep(dt, c, road); return; }
    const assist = 1 - this.handling;
    const mu = (1.12 + 0.3 * assist) * this.grip;
    let throttle = c.throttle, brake = c.brake;

    // reverse the arcade way: hold brake at a standstill to back up
    const spd = this.vx;
    if (this.auto && !this.hold) {
      if (Math.abs(spd) < 0.6 && brake > 0.5 && throttle < 0.1) { this.stillT += dt; if (this.stillT > 0.45 && this.gear > 0) { this.gear = -1; this.shiftT = 0.25; } }
      else this.stillT = 0;
      if (this.gear === -1 && throttle > 0.1 && spd > -0.6) { this.gear = 1; this.shiftT = 0.2; }
    }
    if (this.gear === -1) { const t = throttle; throttle = brake; brake = t; }

    // automatic: shift up near the redline (earlier when cruising), down when the revs sag or you brake hard; the gear
    // holds while the handbrake is pulled (a locked rear reads as a standstill)
    if (this.auto && this.shiftT <= 0 && this.gear > 0 && !c.handbrake) {
      const up = 5200 + 2700 * clamp(throttle, 0, 1);
      if (this.rpm > up && this.gear < SPEC.gears.length && this.vx > 3) this.shift(1);
      else if (this.gear > 1) {
        const down = 2200 + 2200 * throttle + 1600 * brake;
        const lower = this.wheelRpm() * SPEC.gears[this.gear - 2] * SPEC.final;
        if (this.rpm < down && lower < 7300) this.shift(-1);
      }
    }

    // steering: full lock when parking, a few degrees at 200 mph, and more on the counter-steer side when sliding; hands
    // already moving in a slide move faster (the counter-steer rate), into the slide and on the straight at today's rate
    const v = Math.abs(this.vx);
    const base = this.maxDelta(v);
    const side = c.steer < 0 ? 1 : -1;
    const want = -c.steer * this.steerLock(side, v);
    const betaCs = this.vx >= 3 && side * this.vy > 0 ? Math.abs(Math.atan2(this.vy, this.vx)) : 0;
    const rate = SPEC.steerRate * (1 + (SPEC.csRate - 1) * smoothstep(0.08, 0.2, betaCs)) * dt;
    this.delta += clamp(want - this.delta, -rate, rate);
    const delta = this.delta;

    // loads: static split, longitudinal transfer through the centre-of-mass height, downforce, the caller's suction; the
    // lateral transfer loads each axle's outside tyre, split by roll stiffness (a touch more at the front in arcade,
    // which keeps the nose pushing rather than the tail stepping out). Braking into a corner moves load forward and
    // rotates the car; throttle on the way out squats the rear and grips.
    const down = 0.5 * RHO * SPEC.ClA * v * v;
    const Wf = (SPEC.mass * G * SPEC.b) / L, Wr = (SPEC.mass * G * SPEC.a) / L, dLong = (SPEC.mass * this.ax * SPEC.h) / L;
    const Fzf = Math.max(500, Wf - dLong + down * 0.42 + this.ext.fz * 0.45);
    const Fzr = Math.max(500, Wr + dLong + down * 0.58 + this.ext.fz * 0.55);
    const dLat = (SPEC.mass * this.ay * SPEC.h) / SPEC.track, rollF = clamp(SPEC.rollF + 0.06 * assist, 0.3, 0.7);
    const dF = clamp(dLat * rollF, -Fzf / 2, Fzf / 2), dR = clamp(dLat * (1 - rollF), -Fzr / 2, Fzr / 2);
    const muF = loadMu(mu, Fzf, Wf, dF, SPEC.loadSens), muR = loadMu(mu, Fzr, Wr, dR, SPEC.loadSens);

    // drivetrain: the engine follows the axle it is geared to, so wheelspin flares the tach. The handbrake goes with
    // the clutch in (the clutch kick): the engine revs free of the wheels and comes back in over a quarter second.
    // Not on the start line (`hold`): the handbrake there only holds the car, the clutch stays in and the launch at GO
    // is the same clutch-slip launch as from a standstill
    if (this.shiftT > 0) this.shiftT -= dt;
    const shifting = this.shiftT > 0;
    const kick = c.handbrake && !this.hold;
    this.clutch = kick ? 0 : Math.min(1, this.clutch + dt / CLUTCH_T);
    const ratio = this.ratio * SPEC.final * (this.gear < 0 ? -1 : 1);
    const geared = Math.abs(this.wheelRpm() * ratio);                           // what the wheels would turn the engine at
    let target = kick ? SPEC.idle + throttle * (SPEC.redline - SPEC.idle) : geared;
    const slipping = (this.gear === 1 || this.gear === -1) && target < 2600;
    if (slipping) target = Math.max(target, SPEC.idle + throttle * 2400);   // clutch slip off the line
    target = Math.max(target, SPEC.idle);
    if (this.revBlip > 0) { this.revBlip -= dt; target += 900; }
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * (shifting ? 25 : 18)));
    this.limiter = this.rpm >= SPEC.redline;
    if (this.rpm > SPEC.limiter) this.rpm = SPEC.limiter - 60;
    let torque = 0;
    if (!shifting && !this.limiter) torque = engineTorque(this.rpm) * throttle;
    if (throttle < 0.05 && !slipping) torque = -(28 + this.rpm * 0.0085);   // engine braking
    if (shifting) torque *= 0.15;
    const Tdrive = torque * ratio * SPEC.eff * this.clutch;                     // at the axles, before the split
    // brakes as torques; the handbrake is enough rear torque to lock the axle, and the tyre law takes the grip away.
    // It is a separate torque: the ABS modulates the pedal's share of the rear only, so a pull with the foot on the
    // brake (the usual entry on a phone) still locks the rear
    const Tped = brake * SPEC.brakeG * SPEC.mass * G * SPEC.wheelR;
    const TbF = Tped * SPEC.brakeBias, TbR = Tped * (1 - SPEC.brakeBias);
    const Thb = c.handbrake ? 1.3 * muR * Fzr * SPEC.wheelR : 0;
    // the handbrake's yaw kick: pulled with the wheel turned, the tail steps out at once. A moment, a fraction of what
    // the front axle could give, with a 0.2 s envelope
    if (c.handbrake && !this.hbWas && this.vx > 4) {
      this.hbMz = -Math.sign(c.steer) * Math.min(1, Math.abs(c.steer)) * SPEC.hbKick * SPEC.a * muF * Fzf * smoothstep(4, 12, v) * (0.7 + 0.3 * this.handling);
      this.hbT = 0;
    }
    this.hbWas = c.handbrake;
    let Mz = 0;
    if (this.hbT < 0.4) { Mz += this.hbMz * Math.exp(-this.hbT / 0.2); this.hbT += dt; }

    // slip angles
    const vxs = Math.max(Math.abs(this.vx), 0.5) * Math.sign(this.vx || 1);
    const aF = Math.atan2(this.vy + SPEC.a * this.r, Math.abs(vxs)) - delta * Math.sign(vxs);
    const aR = Math.atan2(this.vy - SPEC.b * this.r, Math.abs(vxs));
    this.slipF = Math.abs(aF); this.slipR = Math.abs(aR);
    // is the driver holding a slide: counter-steering with a real slip angle on, the handbrake pulled with the wheel
    // turned, or (past the arcade range, fully in sim) on the power in a slide. The stability control and the traction
    // control both back off for it. Fades above 90 mph.
    const betaS = Math.atan2(this.vy, Math.max(1, Math.abs(this.vx))), beta = Math.abs(betaS);
    const race = (1 - assist) * smoothstep(0.06, 0.16, beta) * smoothstep(8, 20, v);
    const counter = clamp((delta * Math.sign(betaS)) / Math.max(0.03, base), 0, 1) * smoothstep(0.05, 0.14, beta);
    const flick = c.handbrake ? Math.min(1, Math.abs(c.steer) * 1.5) * 0.8 : 0;
    const power = throttle * smoothstep(0.35, 0.9, this.handling) * smoothstep(0.06, 0.16, beta);
    const holding = Math.max(counter, flick, power) * (0.82 + 0.18 * this.handling) * (1 - 0.6 * smoothstep(40, 65, v));

    // the wheels: two substeps, the body held. ABS holds each axle at the tyre's peak (a normalised slip, so the target
    // follows the road's grip and the axle's load) and TC holds the driven axle at the profile's slip (the peak in
    // arcade, a visible flare in sport, a spin-catcher in sim, lifted out of reach while the driver holds a drift).
    // Both set their multiplier each substep from the torque that lands the axle on the target slip: the tyre's force
    // there plus what the axle's inertia needs to get there. ABS dumps pressure at once and re-applies it at 8/s, so
    // the pedal drops and comes back the way a driver feels it. No integrator, so nothing to wind up or chatter on a
    // light axle (a pedal's torque moves a free axle by its whole slip target in one substep), and no limit cycle whose
    // shape would depend on the step
    const R = SPEC.wheelR, hs = dt / 2, cd = Math.cos(delta), sd = Math.sin(delta);
    // the tyre's falloff past its peak (saturating at the Sim profile, h = 0.9: the last tenth of the slider takes the
    // remaining assist away, not more rubber), and the controllers' targets in normalised slip: ABS at the peak; TC at
    // the peak through arcade (h <= 0.35), then a visible flare in sport (3.9 at 0.5) and a spin-catcher in sim (5.15
    // at 0.9 and above)
    const fallP = 0.02 + 0.18 * Math.min(this.handling, 0.9), sAbs = 2.0 + 0.5 * assist;
    const sTc = 2.5 + 2.65 * Math.sqrt(clamp((this.handling - 0.35) / 0.55, 0, 1));
    const vF = this.vx * cd + (this.vy + SPEC.a * this.r) * sd, vR = this.vx;
    const uF = Math.max(Math.abs(vF), U0), uR = Math.max(Math.abs(vR), U0);
    // the engine's inertia reaches the driven axle through the gearing as far as the clutch is in: not during a shift,
    // and not with the handbrake pulled, so the rear locks at once and spins back up on its own inertia when it is let go
    const Ieng = shifting ? 0 : SPEC.Ieng * ratio * ratio * this.clutch;
    const IF = SPEC.IwF + Ieng * SPEC.driveFront, IR = SPEC.IwR + Ieng * (1 - SPEC.driveFront);
    const CkF = SPEC.kx * Fzf, CkR = SPEC.kx * Fzr;
    const absOn = this.abs && brake > 0.02, tcOn = this.tc && Tdrive > 0 && !kick && throttle > 0.02;   // on the start line the TC stays on: the rear is held, not spun against the brakes
    // on the start line the TC asks for zero slip: the driven wheels stay still against the brakes with the throttle
    // pinned, and the launch at GO starts from a held car
    const kTc = (sTc * muR) / SPEC.kx, kTcEff = this.hold ? 0 : kTc + (1.5 - kTc) * holding;
    // the ABS target follows the road speed's sign: braking in reverse is a positive slip ratio, and the pressure
    // that lands the wheel there comes out with the sign of the wheel's speed (the brake torque opposes it)
    const sgnF = vF < 0 ? -1 : 1, sgnR = vR < 0 ? -1 : 1;
    const kAbsF = ((-sAbs * muF) / SPEC.kx) * sgnF, kAbsR = ((-sAbs * muR) / SPEC.kx) * sgnR;
    const TdF0 = Tdrive * SPEC.driveFront, TdR0 = Tdrive * (1 - SPEC.driveFront);
    let wF = this.wF, wR = this.wR, Pf = this.absP.f, Pr = this.absP.r, M = 1;
    let fxF = 0, fyF = 0, fxR = 0, fyR = 0;
    for (let i = 0; i < 2; i++) {
      const kR = (wR * R - vR) / uR, kF = (wF * R - vF) / uF;
      if (tcOn) {
        // the rear's share of the torque that holds the target slip; with a driven front, the tighter of the two
        tyre(kTcEff, aR, Fzr, muR, CkR, SPEC.Cr, fallP, TT);
        M = TdR0 > 1e-6 ? clamp((R * TT.fx + (IR * ((kTcEff * uR + vR) / R - wR)) / hs) / TdR0, 0.05, 1) : 1;
        if (TdF0 > 1e-6) {
          tyre(kTcEff, aF, Fzf, muF, CkF, SPEC.Cf, fallP, TT);
          M = Math.min(M, clamp((R * TT.fx + (IF * ((kTcEff * uF + vF) / R - wF)) / hs) / TdF0, 0.05, 1));
        }
      }
      if (absOn && Math.abs(vR) > U0 && TbR > 1e-6) {
        tyre(kAbsR, aR, Fzr, muR, CkR, SPEC.Cr, fallP, TT);
        const Pd = clamp((sgnR * (TdR0 * M - R * TT.fx - (IR * ((kAbsR * uR + vR) / R - wR)) / hs)) / TbR, 0.05, 1);
        Pr = Pd < Pr ? Pd : Math.min(Pd, Pr + 8 * hs);
      } else Pr = 1;
      tyre(kR, aR, Fzr, muR, CkR, SPEC.Cr, fallP, TR);
      wR = wheelStep(wR, vR, uR, TdR0 * M, TbR * Pr + Thb, IR, TR, R, hs);
      fxR += TR.fx * 0.5; fyR += TR.fy * 0.5;
      if (absOn && Math.abs(vF) > U0 && TbF > 1e-6) {
        tyre(kAbsF, aF, Fzf, muF, CkF, SPEC.Cf, fallP, TT);
        const Pd = clamp((sgnF * (TdF0 * M - R * TT.fx - (IF * ((kAbsF * uF + vF) / R - wF)) / hs)) / TbF, 0.05, 1);
        Pf = Pd < Pf ? Pd : Math.min(Pd, Pf + 8 * hs);
      } else Pf = 1;
      tyre(kF, aF, Fzf, muF, CkF, SPEC.Cf, fallP, TF);
      wF = wheelStep(wF, vF, uF, TdF0 * M, TbF * Pf, IF, TF, R, hs);
      fxF += TF.fx * 0.5; fyF += TF.fy * 0.5;
    }
    this.wF = wF; this.wR = wR; this.absP.f = Pf; this.absP.r = Pr; this.tcM = M;
    this.kF = (wF * R - vF) / uF; this.kR = (wR * R - vR) / uR;
    this.spin = Math.max(0, this.kR);
    this.throttleOut = torque > 0 ? throttle * M * (shifting ? 0.15 : 1) : 0;
    // low speed: the lateral forces fade and the car simply follows its front wheels
    const lowSpeed = smoothstep(1.5, 6, v);
    fyF *= lowSpeed; fyR *= lowSpeed;

    // torque vectoring: a left/right drive-torque difference on the rear axle, limited by what the tyres have spare.
    // Its target is the neutral (kinematic) yaw rate for the wheel angle, not the stability control's understeering
    // one: it pulls the car toward the line the driver asked for, so a car with it turns in harder, never less
    const rCap = (mu * G) / Math.max(5, v);
    const rWant = clamp((this.vx * Math.tan(delta)) / L / (1 + 0.0009 * v * v), -rCap, rCap);
    if (SPEC.vector > 0) {
      const rNeutral = clamp((this.vx * Math.tan(delta)) / L, -rCap, rCap);
      const cap = muR * Fzr, spare = Math.sqrt(Math.max(0, cap * cap - fxR * fxR - fyR * fyR));
      const dFv = SPEC.vector * clamp(2.0 * (rNeutral - this.r), -1, 1) * Math.min(0.5 * spare, Math.abs(TdR0) / R);
      Mz += SPEC.track * dFv;
    }

    const drag = 0.5 * RHO * SPEC.CdA * this.vx * Math.abs(this.vx);
    const roll = SPEC.crr * SPEC.mass * G * Math.sign(this.vx) * smoothstep(0, 1, Math.abs(this.vx));
    const grade = SPEC.mass * G * Math.sin(Math.atan(this.slope)) * Math.cos(this.psi - this.headingAt(road));
    const Fx = fxR + fxF * cd - fyF * sd - drag - roll - grade + this.ext.fx;
    const Fy = fyR + fyF * cd + fxF * sd;
    Mz += SPEC.a * (fyF * cd + fxF * sd) - SPEC.b * fyR;
    const ax = Fx / SPEC.mass, ay = Fy / SPEC.mass;
    // the body: the velocity turned through this step's yaw exactly (a first-order cross term drifts a few per cent
    // over a second at a drift's yaw rates, and differently at each rate), then the accelerations
    const rdt = this.r * dt, cr = Math.cos(rdt), sr = Math.sin(rdt), vx0 = this.vx, vy0 = this.vy;
    this.vx = vx0 * cr + vy0 * sr + ax * dt;
    this.vy = vy0 * cr - vx0 * sr + ay * dt;
    this.r += (Mz / SPEC.Iz) * dt;
    const rKin = (this.vx * Math.tan(delta)) / L;
    this.r = lerp(rKin, this.r, Math.pow(lowSpeed, dt * 120));
    this.vy *= lerp(Math.exp(-dt * 8), 1, lowSpeed);
    // stability control. Arcade: always on, pulling yaw toward what the wheels ask for and bleeding off sideways
    // slide. Sim keeps a light race-mode version that only steps in once the car is really sliding (past ~5°).
    // Both back off while the driver holds the slide. Hands straight or turned into the slide, as in a lift or a
    // brake in a fast sweeper, it catches the car as before.
    if (assist > 0 || race > 0) {
      this.r += (rWant - this.r) * (1 - Math.exp(-dt * (5 * assist + 3.5 * race) * (1 - holding)));
      this.vy *= Math.exp(-dt * (2.2 * assist * assist + 1.6 * race) * (1 - holding) * (1 - holding));
    }
    if (brake > 0 && Math.abs(this.vx) <= 0.05) this.vx *= Math.exp(-12.6 * dt);
    if (Math.abs(this.vx) < 0.05 && throttle < 0.05 && brake > 0.05) this.vx = 0;
    this.ax += (ax - this.ax) * (1 - Math.exp(-dt * SPEC.lagAx));
    this.ay += (ay - this.ay) * (1 - Math.exp(-dt * SPEC.lagAy));
    // the drift readout
    const d = this.drift;
    d.angle = this.vx > 1 ? (-Math.atan2(this.vy, this.vx) * 180) / Math.PI : 0;
    d.active = Math.abs(d.angle) > 8 && v > 8;
    if (d.active) { d.time += dt; this.driftLapse = 0; } else if ((this.driftLapse += dt) > 0.5) d.time = 0;   // half a second of grace links a transition

    // move through the world
    const sf = Math.sin(this.psi), cf = Math.cos(this.psi);
    this.x += (sf * this.vx + cf * this.vy) * dt;
    this.z += (cf * this.vx - sf * this.vy) * dt;
    this.psi += this.r * dt;
    this.wheelRot += wF * dt;
    this.wheelRotR += wR * dt;

    // where are we on the road; the barriers keep us on it
    road.project(this.x, this.z, this.s, this.proj);
    this.s = this.proj.s; this.d = this.proj.d;
    const p = road.sample(Math.min(Math.max(this.s, 0), road.len), this.rp);
    this.y = p.y; this.slope = p.slope; this.roadH = p.h;
    net.wallsNear(this.x, this.z, this.y, 4, this.wallBuf);
    const fx = sf, fz = cf, rx = -cf, rz = sf;
    const walls = this.wallBuf;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const ex = w.bx - w.ax, ez = w.bz - w.az, L2 = ex * ex + ez * ez || 1;
      const t = ((this.x - w.ax) * ex + (this.z - w.az) * ez) / L2;
      let nx = w.nx, nz = w.nz, dist: number;
      if (t >= 0 && t <= 1) dist = (this.x - (w.ax + ex * t)) * nx + (this.z - (w.az + ez * t)) * nz;
      else {
        // past the end of a barrier: only its very end (a gore nose, a dead end) is a post you can hit
        if ((t < 0 && !w.capA) || (t > 1 && !w.capB)) continue;
        const qx = t < 0 ? w.ax : w.bx, qz = t < 0 ? w.az : w.bz, dx = this.x - qx, dz = this.z - qz, dd = Math.sqrt(dx * dx + dz * dz);
        if (dd > 3.2 || dd < 1e-4) continue;
        nx = dx / dd; nz = dz / dd; dist = dd;
      }
      if (dist < -0.3) continue;                                     // the far side of someone else's barrier
      const reach = SPEC.halfL * Math.abs(fx * nx + fz * nz) + SPEC.halfW * Math.abs(rx * nx + rz * nz);
      if (dist < reach) this.hitWall(nx, nz, reach - dist);
    }
  }

  // in the air: drag and thrust only, the wheels free-rolling, the pose bound to the road it left
  private airStep(dt: number, c: Controls, road: Path) {
    const A = this.air;
    A.t += dt;
    const drag = 0.5 * RHO * SPEC.CdA * this.vx * Math.abs(this.vx);
    const ax = (-drag + this.ext.fx) / SPEC.mass;
    this.vx += ax * dt; this.vy = 0; this.r = 0;
    this.s = clamp(this.s + this.vx * dt, 0, road.len);
    this.d = clamp(this.d, road.edgeL + SPEC.halfW, road.edgeR - SPEC.halfW);
    const at = road.at(this.s, this.d, this.at);
    this.x = at.x; this.z = at.z; this.roadH = at.h; this.psi = at.h + A.rel;
    const tau = Math.min(1, A.t / A.T);
    A.alt = 4 * A.peak * tau * (1 - tau); A.vz = ((4 * A.peak) / A.T) * (1 - 2 * tau);
    const p = road.sample(this.s, this.rp);
    this.y = p.y + A.alt; this.slope = p.slope;
    const w = this.vx / SPEC.wheelR;
    this.wF = this.wR = w; this.kF = this.kR = 0; this.spin = 0;
    this.wheelRot += w * dt; this.wheelRotR += w * dt;
    this.absP.f = this.absP.r = 1; this.tcM = 1;
    this.slipF = this.slipR = 0;
    if (this.shiftT > 0) this.shiftT -= dt;
    const target = Math.max(SPEC.idle, Math.abs(this.wheelRpm() * this.ratio * SPEC.final));
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * 18));
    this.limiter = false;
    this.throttleOut = c.throttle;
    this.ax += (ax - this.ax) * (1 - Math.exp(-dt * SPEC.lagAx));
    this.ay += (0 - this.ay) * (1 - Math.exp(-dt * SPEC.lagAy));
    const d = this.drift;
    d.angle = 0; d.active = false;
    if ((this.driftLapse += dt) > 0.5) d.time = 0;
    if (A.t >= A.T) {
      this.airborne = false; A.alt = 0;
      this.impacts.push({ kind: 'land', speed: (4 * A.peak) / A.T, side: 0 });
    }
  }

  private headingAt(road: Path) { return road.heading(Math.min(Math.max(this.s, 0), road.len)); }

  // a barrier with normal n (pointing back at you) that you're `depth` into
  private hitWall(nx: number, nz: number, depth: number) {
    this.x += nx * depth; this.z += nz * depth;
    const sf = Math.sin(this.psi), cf = Math.cos(this.psi);
    const wx = sf * this.vx + cf * this.vy, wz = cf * this.vx - sf * this.vy;
    const vn = -(wx * nx + wz * nz);                              // > 0: moving into the wall
    if (vn <= 0) return;
    // along the wall: whichever way you're heading
    let tx = -nz, tz = nx;
    if (tx * sf + tz * cf < 0) { tx = -tx; tz = -tz; }
    let vt = wx * tx + wz * tz;
    const scrub = Math.min(Math.abs(vt), vn * 0.5 + 0.04);         // the hit, plus a little grinding friction each step
    vt -= Math.sign(vt) * scrub;
    const out = vn * 0.25;
    const nwx = tx * vt + nx * out, nwz = tz * vt + nz * out;
    this.vx = nwx * sf + nwz * cf;
    this.vy = nwx * cf - nwz * sf;
    // glance the nose back along the wall
    const h = Math.atan2(tx, tz);
    let rel = this.psi - h; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.psi -= rel * clamp(vn * 0.04, 0.05, 0.6);
    this.r *= 0.4;
    this.impacts.push({ kind: 'wall', speed: vn, side: 0 });
  }

  // a shove from another car, in world coordinates
  push(wx: number, wz: number, yaw: number) {
    const sf = Math.sin(this.psi), cf = Math.cos(this.psi);
    this.vx += wx * sf + wz * cf;
    this.vy += wx * cf - wz * sf;
    this.r += yaw;
  }
}
