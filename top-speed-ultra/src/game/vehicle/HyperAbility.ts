// The OC Hypercar's own systems (PROJECT_OC_HYPERCAR.md §6), all fed by one compressed-air tank. Our own names:
//   Cold Thrust (hold THRUST): rear cold-gas thrust, about 2 g more than the tyres give off the line, fading with
//     speed to a 0.05 g floor.
//   Ground Lock (automatic): fans that press the car onto the road when the driver asks for more than 0.8 g sideways
//     or launches hard: 0.8 of the car's weight to 90 mph, falling to 0.3 by 200 mph (where the wing has taken over),
//     for about 2 g of cornering at low and middle speeds.
//   Thrust Hop (double-tap THRUST): a short ballistic hop bound to the road, its height and air time chosen to clear
//     the vehicles ahead in the car's lane. The valve stays shut in the air (the arc is planned at the take-off speed).
// Pure logic, no three.js (the headless dynamics harness can drive it). Each step it writes the physics' caller-owned
// inputs, `ext.fx` (thrust, N) and `ext.fz` (fan suction, N); the hop's arc goes to `CarPhysics.hop`. It is live only
// for the hypercar on its Unleashed tune in Free Drive; everywhere else the game keeps it off and both forces at zero.

import { clamp, lerp, smoothstep } from '../util';
import type { Controls } from '../input';
import { SPEC } from './Physics';
import type { CarPhysics } from './Physics';
import { IDM } from '../traffic/limits';

const G = 9.81;
export const TANK = {
  fullS: 6,               // seconds of full thrust in a full tank (the valve's flow, whatever the speed)
  recharge: 1 / 12,       // per second while driving above 5 m/s (the compressor)
  rechargeBrake: 1 / 6,   // per second under braking (the compressor on regen)
  minStart: 0.1,          // the valve opens only with this much in the tank
  lockCost: 0.03,         // per second of Ground Lock at full spin
  lockMin: 0.05,          // Ground Lock stops below this
  hopNeed: 0.4, hopCost: 0.35,
  bar: 700,               // the pressure gauge's full scale
};
// Cold Thrust's push at full valve (m/s²): 2.6 g of the car's weight at a standstill, about 2 g at 60 mph, gone by
// 180 mph but for a 0.05 g floor. Under that much acceleration the load moves onto the rear axle: the front unloads and
// the traction control trims the drive to what it can still take, so the car nets about 2 g more than on its tyres
// and fans alone at launch (measured in Arcade: 1.86 g from 5 to 10 m/s, 1.55 g from 10 to 15, 1.3 g by 20 m/s): the
// design's "about 2 g extra", fading with speed.
export const thrustAccel = (v: number) => G * (2.6 * (1 - smoothstep(0, 80, v)) + 0.05);
// Ground Lock's suction at full spin (N): fan-car levels, 0.8 of the car's weight (tyre load sensitivity takes back part
// of each newton; this is what reaches about 2 g at 25 m/s), easing to 0.3 between 90 and 200 mph
export const fanLoad = (mass: number, v: number) => mass * G * lerp(0.8, 0.3, smoothstep(40.2, 89.4, v));

// the hop's defaults: a 1.5 m hop when nothing needs clearing; clear a roof by this much; the arc's limits (its fall
// at least minFall × g when it can be, at most maxG × g), and the room it lands in: a vehicle the car would reach within
// landGap seconds of touching down must be cleared in the air too, or the hop is refused
// Traffic doesn't hold its speed while the car is in the air, and in the air the car can't brake or steer, so what it
// meets up there is planned for the traffic's limits (traffic/limits.ts): each vehicle braking as hard as any driver
// does (`brake`, the model's 10 m/s² clamp: it comes back sooner, so the car must be up earlier) and, for passing it,
// speeding up as hard as any does (`speedUp`: the car is over it for longer). The landing room is room to react on the
// tyres (2 g of brakes, twice the traffic's hardest), so it is planned for ordinary hard braking (`landBrake`)
export const HOP = {
  peak: 1.5, clear: 0.35, maxPeak: 7.5, maxT: 2.5, minT: 0.6, maxG: 2.5, minFall: 0.55, scan: 60, minV: 5, landGap: 1.5,
  brake: IDM.maxBrake, landBrake: 4, speedUp: IDM.accel * IDM.boldAccel,
};
// how long until the car has closed `gap` metres on a vehicle at closing speed vc that changes at `a` m/s² (Infinity
// when it never does)
function closeIn(gap: number, vc: number, a: number) {
  if (gap <= 0) return 0;
  if (Math.abs(a) < 1e-9) return vc > 0 ? gap / vc : Infinity;
  const disc = vc * vc + 2 * a * gap;
  if (disc < 0) return Infinity;
  const t = (-vc + Math.sqrt(disc)) / a;
  return t > 0 ? t : Infinity;
}
// the same for a vehicle at speed v braking at `b` until it stops (a parked car can't come back toward the car)
function closeInBraking(gap: number, vc: number, b: number, v: number) {
  const t = closeIn(gap, vc, b), ts = Math.max(0, v) / b;
  if (t <= ts) return t;
  const gs = vc * ts + 0.5 * b * ts * ts, vs = vc + b * ts;          // closed while it brakes, and the closing speed after
  return vs > 0 ? ts + (gap - gs) / vs : Infinity;
}
// a natural ballistic air time for a peak (the arc's gravity = g)
export const naturalT = (peak: number) => Math.sqrt((8 * peak) / G);

// what the arc must do for one vehicle ahead: stay above `hc` from t1 to t2 (seconds after take-off; t1 with it braking
// as hard as traffic can, t2 with it speeding up as hard as traffic can). The nearest vehicle in the lane must be
// cleared (`must`); one further on only if the car could reach it in the air (it braking at the limit: t1 < T) or within
// HOP.landGap of touching down (it braking hard, `tLand`: landing on its bumper is not a hop).
export interface HopNeed { t1: number; tLand: number; t2: number; hc: number; must: boolean }
const tauIn = (H: number, hc: number) => (1 - Math.sqrt(Math.max(0, 1 - hc / H))) / 2;
function fits(H: number, T: number, needs: HopNeed[]) {
  for (const n of needs) {
    if (!n.must && n.t1 >= T && n.tLand >= T + HOP.landGap) continue;   // down well before it gets there: room to brake or steer
    if (n.hc >= H || n.t1 <= 0) return false;
    const a = tauIn(H, n.hc);
    if (T * a > n.t1 || T * (1 - a) < n.t2) return false;
  }
  return true;
}
// the arc (peak H, air time T) that clears every need: for each peak from the lowest that could clear, the air time as
// close as it can be to a natural ballistic one for that peak (never a snap of more than 2.5 g). The lowest peak whose
// arc falls at 0.55 g or more wins, so a slow approach gets a higher, believable hop rather than a low float; failing
// that, the least floaty arc that fits. null when no arc up to 7.5 m and 2.5 s clears.
export function arcFor(needs: HopNeed[]): { peak: number; T: number } | null {
  let hMin = HOP.peak;
  for (const n of needs) if (n.must) hMin = Math.max(hMin, n.hc + 0.25);
  let floaty: { peak: number; T: number; g: number } | null = null;
  for (let H = hMin; H <= HOP.maxPeak + 1e-9; H += 0.05) {
    const lo = Math.max(HOP.minT, Math.sqrt((8 * H) / (HOP.maxG * G))), tn = clamp(naturalT(H), lo, HOP.maxT);
    let best = -1;
    for (let k = 0; k <= 48; k++) {
      const T = lo + ((HOP.maxT - lo) * k) / 48;
      if (fits(H, T, needs) && (best < 0 || Math.abs(T - tn) < Math.abs(best - tn))) best = T;
    }
    if (best > 0 && fits(H, tn, needs)) best = tn;
    if (best <= 0) continue;
    const g = (8 * H) / (best * best);                 // the arc's own gravity
    if (g >= HOP.minFall * G) return { peak: H, T: best };
    if (!floaty || g > floaty.g) floaty = { peak: H, T: best, g };
  }
  return floaty ? { peak: floaty.peak, T: floaty.T } : null;
}

// one vehicle the hop may have to clear, in the car's own road frame: its centre's distance along the road ahead of
// the car's centre (m), its speed along the road, its lateral offset from the car's (m), its size and roof height
export interface HopVehicle { ds: number; v: number; dd: number; len: number; wid: number; height: number; kind: string }
// `short`: a plain hop that comes down well short of this vehicle (it was too far ahead to clear in one hop)
export interface HopPlan { peak: number; T: number; over: string | null; refuse: string | null; short?: string | null }
// what clearing one vehicle asks of the arc, with its centre `ds` m ahead: up by the time it could be under the car (it
// braking), and still up until the car is past its nose (it speeding up)
function needFor(c: HopVehicle, ds: number, vx: number, halfL: number): HopNeed {
  const tailGap = ds - c.len / 2 - halfL, vc = vx - c.v;              // car's nose to its tail; the closing speed
  return {
    t1: closeInBraking(tailGap - 2, vc, HOP.brake, c.v), tLand: closeInBraking(tailGap - 2, vc, HOP.landBrake, c.v),
    t2: closeIn(ds + c.len / 2 + 2 + halfL, vc, -HOP.speedUp), hc: c.height + HOP.clear, must: false,
  };
}
// Thrust Hop's arc for a car at speed vx: the nearest vehicle in its lane within HOP.scan m ahead that it is closing on
// is the one it hops (cleared by HOP.clear m from 2 m before its tail to 2 m past its nose); every other vehicle in the
// lane that the car could reach in the air, or within HOP.landGap s of touching down, must be cleared too (the car's
// lane only: a vehicle in the next lane is not in the way; the game counts one moving into it as in it). Times allow
// for the traffic braking or speeding up meanwhile at its limits (HOP.brake, HOP.speedUp; the landing room at
// HOP.landBrake). With none, a 1.5 m hop. When the nearest is too far ahead to clear in one hop at this closing speed,
// a plain hop that comes down at least HOP.landGap s short of it (with room to brake), if one fits. Refused (no gas
// spent) when nothing up to 7.5 m and 2.5 s clears ("Get closer to clear" when it could be cleared from nearer, "Need
// more speed to clear" when not even then), or the car could come down on another vehicle. Anything the plan can't
// know (a driver's sudden stop after a crash) is met honestly: Traffic.collide counts any vehicle whose roof the car is
// under. (The world's pace is not one of them: Game keeps the driver's Focus Time from changing it during a hop.)
export function planHop(vx: number, halfL: number, halfW: number, cars: HopVehicle[]): HopPlan {
  const needs: HopNeed[] = [];
  let over: HopVehicle | null = null, first: HopNeed | null = null, tooClose = false;
  for (const c of cars) {
    if (Math.abs(c.dd) > c.wid / 2 + halfW + 0.25) continue;               // not in the car's lane
    const tailGap = c.ds - c.len / 2 - halfL;                            // car's nose to its tail
    if (c.ds + c.len / 2 < -halfL) continue;                             // already behind the car
    const vc = vx - c.v;
    const n = needFor(c, c.ds, vx, halfL);
    if (n.t1 >= HOP.maxT && n.tLand >= HOP.maxT + HOP.landGap) continue;   // beyond the longest hop and its landing
    needs.push(n);
    if (vc > 0.5 && tailGap <= HOP.scan && (!over || c.ds < over.ds)) { over = c; first = n; }
  }
  if (first) { first.must = true; tooClose = first.t1 <= 0.05; }
  if (tooClose) return { peak: 0, T: 0, over: over?.kind ?? null, refuse: 'Too close to clear' };
  const arc = arcFor(needs);
  if (arc) return { peak: arc.peak, T: arc.T, over: over?.kind ?? null, refuse: null };
  // no arc, and the nearest vehicle can be cleared on its own: the car would come down on the next one
  if (!first || !over || arcFor([first])) return { peak: 0, T: 0, over: over?.kind ?? null, refuse: 'No room to land' };
  // the nearest can't be cleared from here at this closing speed. A plain hop that comes down well short of it (it
  // stops being a must: down at least HOP.landGap s before the car could reach it, with every other need met)
  first.must = false;
  const plain = arcFor(needs);
  if (plain) return { peak: plain.peak, T: plain.T, over: null, refuse: null, short: over.kind };
  // or say what would: nearer (0.3-0.8 s from its tail at this closing speed), or faster
  const vc = vx - over.v, base = over.len / 2 + halfL + 2;
  for (const lead of [0.3, 0.5, 0.8]) if (arcFor([{ ...needFor(over, base + vc * lead, vx, halfL), must: true }])) return { peak: 0, T: 0, over: over.kind, refuse: 'Get closer to clear' };
  return { peak: 0, T: 0, over: over.kind, refuse: 'Need more speed to clear' };
}

export class HyperAbility {
  live = false;           // the hypercar on its Unleashed tune in Free Drive (latched at run start)
  tank = 1;               // 0..1 (0..700 bar)
  thrust = 0;             // the valve's opening, 0..1
  fan = 0;                // the fans' spin, 0..1
  lock = false;           // Ground Lock commanded
  demand = 0;             // the lateral g the wheel angle asks for (what Ground Lock watches)
  charging = false;       // the compressor is filling the tank (for its hum)
  // edges for the sound and the HUD: counts that only go up (the valve opening, the tank reaching full)
  valveOpens = 0; fulls = 0;
  private open = false;
  private lockHold = 0;

  reset(live: boolean) {
    this.live = live; this.tank = 1; this.lastTank = 1; this.thrust = 0; this.fan = 0; this.lock = false; this.open = false; this.lockHold = 0; this.demand = 0;
  }
  get pressure() { return Math.round(this.tank * TANK.bar); }
  get hopReady() { return this.live && this.tank >= TANK.hopNeed; }

  // one 120 Hz step, before `p.step`. `on`: the run allows it now (not counting down, not over); paused runs don't step
  step(dt: number, p: CarPhysics, c: Controls, on: boolean) {
    const live = this.live && on;
    const k = 1 - Math.exp(-dt * 30), kFan = 1 - Math.exp(-dt * 12);   // the valve opens in about 0.1 s, the fans spin up in 0.25 s
    if (!live) {
      this.open = false; this.lock = false; this.lockHold = 0; this.charging = false;
      this.thrust += (0 - this.thrust) * k; this.fan += (0 - this.fan) * kFan;
      if (this.thrust < 1e-3) this.thrust = 0;
      if (this.fan < 1e-3) this.fan = 0;
      p.ext.fx = 0; p.ext.fz = 0;
      return;
    }
    const v = Math.abs(p.vx), m = SPEC.mass;
    // Cold Thrust: held, forward, off the brake, on the road, with gas in the tank; the valve shuts on release, the brake,
    // empty, or in the air (a hop's arc and its landing room are planned at the take-off speed: thrust held through the
    // air would carry the car past both)
    const want = c.thrust > 0.05 && c.brake < 0.1 && p.gear > 0 && p.vx > -0.5 && !p.airborne;
    if (!this.open && want && this.tank >= TANK.minStart) { this.open = true; this.valveOpens++; }
    if (this.open && (!want || this.tank <= 0)) this.open = false;
    this.thrust += ((this.open ? clamp(c.thrust, 0, 1) : 0) - this.thrust) * k;
    if (this.thrust < 1e-3) this.thrust = 0;
    const a = thrustAccel(Math.max(0, p.vx)) * this.thrust;
    p.ext.fx = m * a;
    this.tank -= (this.thrust / TANK.fullS) * dt;

    // Ground Lock: on when the wheel asks for more than 0.8 g sideways or the car launches hard (full throttle under
    // 30 m/s with the drive axles at their traction limit), held 0.4 s after, and never in the air
    const L = SPEC.a + SPEC.b;
    this.demand = (p.vx * p.vx * Math.abs(Math.tan(p.delta))) / L / G;
    const launch = c.throttle > 0.9 && p.vx > -0.5 && p.vx < 30 && (p.tcM < 0.98 || p.spin > 0.05);
    if (!p.airborne && (this.demand > 0.8 || launch)) this.lockHold = 0.4; else this.lockHold -= dt;
    this.lock = this.lockHold > 0 && this.tank > TANK.lockMin && !p.airborne;
    this.fan += ((this.lock ? 1 : 0) - this.fan) * kFan;
    if (this.fan < 1e-3) this.fan = 0;
    p.ext.fz = p.airborne ? 0 : fanLoad(m, v) * this.fan;
    this.tank -= TANK.lockCost * this.fan * dt;

    // the compressor: while driving with the valve shut and the fans idle (they share its drive), faster under braking;
    // nothing at a standstill. So Ground Lock's 3 % a second is a real cost through a long corner
    this.charging = this.thrust < 0.02 && this.fan < 0.05 && v > 5 && this.tank < 1;
    if (this.charging) this.tank += (c.brake > 0.1 ? TANK.rechargeBrake : TANK.recharge) * dt;
    const was = this.tank;
    this.tank = clamp(this.tank, 0, 1);
    if (was >= 1 && this.tank === 1 && this.lastTank < 1) this.fulls++;
    this.lastTank = this.tank;
  }
  private lastTank = 1;

  // spend the hop's gas (the game has already planned and launched the arc), and shut the valve at once: no thrust is
  // left to carry the car past the stretch the plan checked
  spendHop(p: CarPhysics) {
    this.tank = Math.max(0, this.tank - TANK.hopCost); this.lastTank = this.tank;
    this.open = false; this.thrust = 0; p.ext.fx = 0;
  }
}
