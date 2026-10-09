// Vehicle dynamics: a single-track (bicycle) model with load transfer, saturating tyres, a friction circle at the
// driven rear axle, aero drag and downforce, ABS and a 7-speed dual-clutch drivetrain. Runs at a fixed 120 Hz.
// Car frame: x forward, y to the left, yaw rate r counter-clockwise (left) positive.

import { clamp, lerp, smoothstep } from '../util';
import type { Controls } from '../input';
import type { Path } from '../world/Path';
import type { Network, Wall } from '../world/Network';

export const SPEC = {
  // mid-engine: 57% of the weight on the rear axle; wider rear tyres (stiffer) keep it understeering and stable
  mass: 1480, a: 1.45, b: 1.2, h: 0.42, Iz: 2250, halfW: 0.99, halfL: 2.3,
  wheelR: 0.345, gears: [3.08, 2.19, 1.63, 1.29, 1.03, 0.84, 0.69], reverse: 2.9, final: 4.44, eff: 0.9,
  idle: 1000, redline: 8000, limiter: 8150, peakTorque: 770, power: 530000,
  CdA: 0.62, ClA: 0.5, crr: 0.012, Cf: 125000, Cr: 185000, steerRatio: 13,
};
const L = SPEC.a + SPEC.b, G = 9.81, RHO = 1.225;

export function engineTorque(rpm: number) {
  const ramp = rpm < 3300 ? lerp(430, SPEC.peakTorque, clamp((rpm - 1000) / 2300, 0, 1)) : SPEC.peakTorque;
  return Math.min(ramp, SPEC.power / Math.max(1, (rpm * Math.PI) / 30));
}

export interface Impact { kind: 'wall' | 'car'; speed: number; side: number }

export class CarPhysics {
  // absolute world position and heading (heading: 0 = +z, increasing turns toward +x, i.e. left)
  x = 0; z = 0; y = 0; psi = 0;
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
  throttleOut = 0;            // what the engine is actually being asked for (after shifts and TC)
  s = 0; d = 0; slope = 0;
  handling = 0.35;            // 0 arcade .. 1 sim
  grip = 1;                   // the road: 1 dry, about 0.8 in the rain
  impacts: Impact[] = [];
  private stillT = 0;
  private proj = { s: 0, d: 0 };

  get speed() { return Math.hypot(this.vx, this.vy); }
  get ratio() { return this.gear < 0 ? SPEC.reverse : SPEC.gears[this.gear - 1]; }
  // the most the front wheels will turn at this speed: full lock when parking, a few degrees at 200 mph
  // (what the tyres can use: past ~100 mph a fraction of a degree already asks for more than the grip there is)
  maxDelta(v = Math.abs(this.vx)) { return clamp((L * 13.5) / (v * v + 1) + 0.03 * (1 - smoothstep(18, 55, v)) + 0.0065, 0.0065, 0.52) * (1 + this.handling * 0.35); }

  placeAt(road: Path, s: number, d: number, speed: number) {
    const p = road.at(s, d);
    this.x = p.x; this.z = p.z; this.y = p.y; this.psi = p.h;
    this.vx = speed; this.vy = 0; this.r = 0; this.delta = 0;
    this.s = s; this.d = d; this.gear = speed > 20 ? 4 : 1; this.shiftT = 0;
    this.rpm = Math.max(SPEC.idle, this.wheelRpm() * this.ratio * SPEC.final);
  }

  private wheelRpm() { return (this.vx / SPEC.wheelR) * 30 / Math.PI; }

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

  step(dt: number, c: Controls, road: Path, net: Network) {
    const assist = 1 - this.handling;
    const mu = (1.12 + 0.3 * assist) * this.grip;
    let throttle = c.throttle, brake = c.brake;

    // reverse the arcade way: hold brake at a standstill to back up
    const spd = this.vx;
    if (this.auto) {
      if (Math.abs(spd) < 0.6 && brake > 0.5 && throttle < 0.1) { this.stillT += dt; if (this.stillT > 0.45 && this.gear > 0) { this.gear = -1; this.shiftT = 0.25; } }
      else this.stillT = 0;
      if (this.gear === -1 && throttle > 0.1 && spd > -0.6) { this.gear = 1; this.shiftT = 0.2; }
    }
    if (this.gear === -1) { const t = throttle; throttle = brake; brake = t; }

    // automatic: shift up near the redline (earlier when cruising), down when the revs sag or you brake hard
    if (this.auto && this.shiftT <= 0 && this.gear > 0) {
      const up = 5200 + 2700 * clamp(throttle, 0, 1);
      if (this.rpm > up && this.gear < SPEC.gears.length && this.vx > 3) this.shift(1);
      else if (this.gear > 1) {
        const down = 2200 + 2200 * throttle + 1600 * brake;
        const lower = this.wheelRpm() * SPEC.gears[this.gear - 2] * SPEC.final;
        if (this.rpm < down && lower < 7300) this.shift(-1);
      }
    }

    // steering: full lock when parking, a few degrees at 200 mph
    const v = Math.abs(this.vx);
    const maxDelta = this.maxDelta(v);
    const want = -c.steer * maxDelta;
    this.delta += clamp(want - this.delta, -2.4 * dt, 2.4 * dt);
    const delta = this.delta;

    // loads: static split, longitudinal transfer, downforce
    const down = 0.5 * RHO * SPEC.ClA * v * v;
    const Fzf = Math.max(500, (SPEC.mass * G * SPEC.b) / L - (SPEC.mass * this.ax * SPEC.h) / L + down * 0.42);
    const Fzr = Math.max(500, (SPEC.mass * G * SPEC.a) / L + (SPEC.mass * this.ax * SPEC.h) / L + down * 0.58);

    // drivetrain
    if (this.shiftT > 0) this.shiftT -= dt;
    const shifting = this.shiftT > 0;
    const ratio = this.ratio * SPEC.final * (this.gear < 0 ? -1 : 1);
    const wheelRpm = this.wheelRpm();
    let target = Math.abs(wheelRpm * ratio);
    const slipping = (this.gear === 1 || this.gear === -1) && target < 2600;
    if (slipping) target = Math.max(target, SPEC.idle + throttle * 2400);   // clutch slip off the line
    target = Math.max(target, SPEC.idle);
    if (this.revBlip > 0) { this.revBlip -= dt; target += 900; }
    this.rpm += (target - this.rpm) * Math.min(1, dt * (shifting ? 25 : 18));
    this.limiter = this.rpm >= SPEC.redline;
    if (this.rpm > SPEC.limiter) this.rpm = SPEC.limiter - 60;
    let torque = 0;
    if (!shifting && !this.limiter) torque = engineTorque(this.rpm) * throttle;
    if (throttle < 0.05 && !slipping) torque = -(28 + this.rpm * 0.0085);   // engine braking
    if (shifting) torque *= 0.15;
    let Fx_r = (torque * ratio * SPEC.eff) / SPEC.wheelR;
    // traction: the rear can only push so hard (traction control trims it in arcade)
    const rearLimit = mu * Fzr;
    this.spin = 0;
    if (Math.abs(Fx_r) > rearLimit) {
      this.spin = (Math.abs(Fx_r) - rearLimit) / rearLimit;
      Fx_r = Math.sign(Fx_r) * rearLimit * (assist > 0.3 ? 0.98 : 0.9);
    }
    this.throttleOut = torque > 0 ? throttle * (shifting ? 0.15 : 1) : 0;
    // brakes with ABS: never more than the tyres can hold
    let brakeF = brake * 1.35 * SPEC.mass * G;
    let Fx_f = 0;
    if (brakeF > 0 && Math.abs(this.vx) > 0.05) {
      const dir = -Math.sign(this.vx);
      // ABS on both axles; brake distribution keeps the rear from locking up as weight moves forward
      const bf = Math.min(brakeF * 0.62, mu * Fzf * 0.97), br = Math.min(brakeF * 0.38, mu * Fzr * (assist > 0.3 ? 0.55 : 0.68));
      Fx_f += dir * bf; Fx_r += dir * br;
    } else if (brakeF > 0) { this.vx *= 0.9; brakeF = 0; }
    let rearGrip = 1;
    if (c.handbrake) { Fx_r += -Math.sign(this.vx) * mu * Fzr * 0.85; rearGrip = 0.32 + 0.25 * assist; }

    // tyres: slip angles, saturating lateral force, friction circle at the rear
    const vxs = Math.max(Math.abs(this.vx), 0.5) * Math.sign(this.vx || 1);
    const aF = Math.atan2(this.vy + SPEC.a * this.r, Math.abs(vxs)) - delta * Math.sign(vxs);
    const aR = Math.atan2(this.vy - SPEC.b * this.r, Math.abs(vxs));
    const tire = (alpha: number, Fz: number, C: number, grip: number) => {
      const max = mu * Fz * grip;
      let f = max * Math.tanh((C * alpha) / max);
      if (this.handling > 0.5) f *= 1 - 0.1 * (this.handling - 0.5) * 2 * smoothstep(0.08, 0.22, Math.abs(alpha));   // sim: tyres let go past the peak
      return -f;
    };
    // the front shares its grip between braking and turning: brake hard in a corner and it pushes wide
    const frontCircle = Math.sqrt(Math.max(0, 1 - (Fx_f / (mu * Fzf)) ** 2));
    let Fyf = tire(aF, Fzf, SPEC.Cf, 1) * Math.max(0.3, frontCircle);
    const rearCircle = Math.sqrt(Math.max(0, (mu * Fzr * rearGrip) ** 2 - Fx_r * Fx_r)) / Math.max(1, mu * Fzr * rearGrip);
    let Fyr = tire(aR, Fzr, SPEC.Cr, rearGrip) * Math.max(0.25, rearCircle);
    this.slipF = Math.abs(aF); this.slipR = Math.abs(aR);
    const lowSpeed = smoothstep(1.5, 6, v);
    Fyf *= lowSpeed; Fyr *= lowSpeed;

    const drag = 0.5 * RHO * SPEC.CdA * this.vx * Math.abs(this.vx);
    const roll = SPEC.crr * SPEC.mass * G * Math.sign(this.vx) * smoothstep(0, 1, Math.abs(this.vx));
    const grade = SPEC.mass * G * Math.sin(Math.atan(this.slope)) * Math.cos(this.psi - this.headingAt(road));
    const cd = Math.cos(delta), sd = Math.sin(delta);
    const Fx = Fx_r + Fx_f * cd - Fyf * sd - drag - roll - grade;
    const Fy = Fyr + Fyf * cd + Fx_f * sd;
    const ax = Fx / SPEC.mass, ay = Fy / SPEC.mass;
    this.vx += (ax + this.vy * this.r) * dt;
    this.vy += (ay - this.vx * this.r) * dt;
    this.r += ((SPEC.a * (Fyf * cd + Fx_f * sd) - SPEC.b * Fyr) / SPEC.Iz) * dt;
    // low speed: the car simply follows its front wheels
    const rKin = (this.vx * Math.tan(delta)) / L;
    this.r = lerp(rKin, this.r, lowSpeed);
    this.vy *= lerp(Math.exp(-dt * 8), 1, lowSpeed);
    // stability control. Arcade: always on, pulling yaw toward what the wheels ask for and bleeding off sideways
    // slide. Sim keeps a light race-mode version that only steps in once the car is really sliding (past ~5°),
    // so you can drift it but a lift or a brake in a fast curve doesn't throw it round.
    const beta = Math.abs(Math.atan2(this.vy, Math.max(1, Math.abs(this.vx))));
    const race = (1 - assist) * smoothstep(0.06, 0.16, beta) * smoothstep(8, 20, v);
    if (assist > 0 || race > 0) {
      const rWant = rKin / (1 + 0.0009 * v * v);
      this.r += (rWant - this.r) * (1 - Math.exp(-dt * (5 * assist + 3.5 * race)));
      this.vy *= Math.exp(-dt * (2.2 * assist * assist + 1.6 * race));
    }
    if (Math.abs(this.vx) < 0.05 && throttle < 0.05 && brake > 0.05) this.vx = 0;
    this.ax = this.ax + (ax - this.ax) * Math.min(1, dt * 10);
    this.ay = this.ay + ((ay - 0) - this.ay) * Math.min(1, dt * 10);

    // move through the world
    const sf = Math.sin(this.psi), cf = Math.cos(this.psi);
    this.x += (sf * this.vx + cf * this.vy) * dt;
    this.z += (cf * this.vx - sf * this.vy) * dt;
    this.psi += this.r * dt;
    this.wheelRot += (this.vx / SPEC.wheelR) * dt;
    this.wheelRotR += (this.vx / SPEC.wheelR) * (1 + this.spin * 0.6) * dt;

    // where are we on the road; the barriers keep us on it
    road.project(this.x, this.z, this.s, this.proj);
    this.s = this.proj.s; this.d = this.proj.d;
    const p = road.sample(Math.min(Math.max(this.s, 0), road.len));
    this.y = p.y; this.slope = p.slope; this.roadH = p.h;
    net.wallsNear(this.x, this.z, this.y, 4, this.wallBuf);
    const fx = Math.sin(this.psi), fz = Math.cos(this.psi), rx = -Math.cos(this.psi), rz = Math.sin(this.psi);
    for (const w of this.wallBuf) {
      const ex = w.bx - w.ax, ez = w.bz - w.az, L2 = ex * ex + ez * ez || 1;
      const t = ((this.x - w.ax) * ex + (this.z - w.az) * ez) / L2;
      let nx = w.nx, nz = w.nz, dist: number;
      if (t >= 0 && t <= 1) dist = (this.x - (w.ax + ex * t)) * nx + (this.z - (w.az + ez * t)) * nz;
      else {
        // past the end of a barrier: only its very end (a gore nose, a dead end) is a post you can hit
        if ((t < 0 && !w.capA) || (t > 1 && !w.capB)) continue;
        const px = t < 0 ? w.ax : w.bx, pz = t < 0 ? w.az : w.bz, dx = this.x - px, dz = this.z - pz, dd = Math.hypot(dx, dz);
        if (dd > 3.2 || dd < 1e-4) continue;
        nx = dx / dd; nz = dz / dd; dist = dd;
      }
      if (dist < -0.3) continue;                                     // the far side of someone else's barrier
      const reach = SPEC.halfL * Math.abs(fx * nx + fz * nz) + SPEC.halfW * Math.abs(rx * nx + rz * nz);
      if (dist < reach) this.hitWall(nx, nz, reach - dist);
    }
  }
  private wallBuf: Wall[] = [];
  roadH = 0;

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
