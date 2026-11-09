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
// at least minFall × g when it can be, at most maxG × g). What the car meets up there is planned for how the traffic
// drives (traffic/limits.ts), not for the worst any driver could do, since in the air the car can't brake or steer but a
// hop that is never granted is no hop: each vehicle braking as a driver plans to (`brake`, the model's comfortable
// 3.2 m/s², or harder when it already is), and, for passing it, speeding up at its driver's rate (IDM.accel, × 1.4 for a
// bold driver) only until it is back at its own cruising speed. A sudden stop past that (a crash ahead) is met honestly:
// Traffic.collide counts any vehicle whose roof the car is under. The landing is the driver's, on the tyres (2 g of
// brakes, twice the traffic's hardest): a vehicle past the touchdown is a veto only when the car would come down within
// one car length and 2 m of its tail plus `landGap` s at the closing speed (it braking at `landBrake` meanwhile); one
// within `landWarn` s of that gets the hop with a "traffic on landing" warning.
// (Before the 2026-11-09 retune: 10 m/s² of braking for every vehicle, 2.24 m/s² of speeding up for the whole hop and
// 1.5 s of empty lane past the touchdown, which refused 5 of 6 deliberate hops in moderate traffic; PROJECT_OC_HYPERCAR.md §6.4.)
export const HOP = {
  peak: 1.5, clear: 0.35, maxPeak: 7.5, maxT: 2.5, minT: 0.6, maxG: 2.5, minFall: 0.55, scan: 60, minV: 5,
  landGap: 0.5, landRoom: 2, landWarn: 1.5,
  brake: IDM.comfort, landBrake: 4,
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
// the same for a vehicle speeding up at `a` (the closing speed falls) until it has gained `gain` m/s (back at its own
// cruising speed), then holding it
function closeInSpeeding(gap: number, vc: number, a: number, gain: number) {
  if (gap <= 0) return 0;
  const tg = a > 0 ? Math.max(0, gain) / a : 0;
  if (tg <= 0) return vc > 0 ? gap / vc : Infinity;
  const t = closeIn(gap, vc, -a);
  if (t <= tg) return t;
  const gg = vc * tg - 0.5 * a * tg * tg, vg = vc - a * tg;            // closed while it speeds up, and the closing speed after
  return vg > 0 ? tg + (gap - gg) / vg : Infinity;
}
// a natural ballistic air time for a peak (the arc's gravity = g)
export const naturalT = (peak: number) => Math.sqrt((8 * peak) / G);

// what the arc must do for one vehicle ahead: stay above `hc` from t1 to t2 (seconds after take-off; t1 with it braking
// as HOP.brake plans, t2 with it speeding up toward its cruising speed). The nearest vehicle in the lane must be cleared
// (`must`); one further on only if the car would come down within one car length and 2 m of its tail, plus HOP.landGap
// s (`tLand`, it braking at HOP.landBrake: landing on its bumper is not a hop; `room` replaces HOP.landGap for the one
// a plain hop comes down short of). `car`: the vehicle, for a refusal's reason
export interface HopNeed { t1: number; tLand: number; t2: number; hc: number; must: boolean; room?: number; car?: HopVehicle }
const tauIn = (H: number, hc: number) => (1 - Math.sqrt(Math.max(0, 1 - hc / H))) / 2;
// the first need an arc misses (null when it clears them all)
function missed(H: number, T: number, needs: HopNeed[]): HopNeed | null {
  for (const n of needs) {
    if (!n.must && n.t1 >= T && n.tLand >= T + (n.room ?? HOP.landGap)) continue;   // down with room before it: the driver's to manage
    if (n.hc >= H || n.t1 <= 0) return n;
    const a = tauIn(H, n.hc);
    if (T * a > n.t1 || T * (1 - a) < n.t2) return n;
  }
  return null;
}
const fits = (H: number, T: number, needs: HopNeed[]) => !missed(H, T, needs);
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
// the car's centre (m), its speed along the road and its own cruising speed (both at the world's pace), whether its
// driver is a bold one (speeds up 1.4× harder), its acceleration now (m/s², braking negative; optional), its lateral
// offset from the car's (m), its size and roof height; `other`: on another road, projected onto this one
export interface HopVehicle { ds: number; v: number; v0: number; bold: boolean; acc?: number; dd: number; len: number; wid: number; height: number; kind: string; other?: boolean }
// `short`: a plain hop that comes down well short of this vehicle (it was too far ahead to clear in one hop). `warn`: a
// vehicle within HOP.landWarn s of the touchdown (the driver lands into traffic). `block`: the vehicle behind a refusal
export interface HopPlan { peak: number; T: number; over: string | null; refuse: string | null; short?: string | null; warn?: boolean; block?: HopVehicle | null }
// what clearing one vehicle asks of the arc, with its centre `ds` m ahead: up by the time it could be under the car (it
// braking as planned, or harder if it already is), and still up until the car is past its nose (it speeding up, at
// most back to its own cruising speed); and the landing room in front of it (one car length and HOP.landRoom m)
function needFor(c: HopVehicle, ds: number, vx: number, halfL: number): HopNeed {
  const tailGap = ds - c.len / 2 - halfL, vc = vx - c.v;              // car's nose to its tail; the closing speed
  const brake = Math.max(HOP.brake, -(c.acc ?? 0)), up = IDM.accel * (c.bold ? IDM.boldAccel : 1);
  return {
    t1: closeInBraking(tailGap - 2, vc, brake, c.v),
    tLand: closeInBraking(tailGap - HOP.landRoom - 2 * halfL, vc, Math.max(HOP.landBrake, brake), c.v),
    t2: closeInSpeeding(ds + c.len / 2 + 2 + halfL, vc, up, c.v0 - c.v), hc: c.height + HOP.clear, must: false, car: c,
  };
}
// a vehicle the car comes down in front of with less than HOP.landWarn s of room (past the one car length and 2 m)
const tight = (T: number, needs: HopNeed[]) => needs.some((n) => !n.must && n.t1 >= T && n.tLand >= T + HOP.landGap && n.tLand < T + HOP.landWarn);
// Thrust Hop's arc for a car at speed vx: the nearest vehicle in its lane within HOP.scan m ahead that it is closing on
// is the one it hops (cleared by HOP.clear m from 2 m before its tail to 2 m past its nose); every other vehicle in the
// lane that the car could reach in the air, or would come down within one car length and 2 m (plus HOP.landGap s) of,
// must be cleared too (the car's lane only: a vehicle in the next lane is not in the way; the game counts one moving into
// it as in it). Times allow for the traffic braking or speeding up meanwhile as it drives (HOP.brake, the driver's own
// rate up to its cruising speed; the landing room at HOP.landBrake). With none, a 1.5 m hop. When the nearest is too
// far ahead to clear in one hop at this closing speed, a plain hop that comes down short of it with that room, if one
// fits. Refused (no gas spent) when nothing up to 7.5 m and 2.5 s clears ("Get closer to clear" when it could be cleared
// from nearer, "Need more speed to clear" when not even then), or the car would come down on another vehicle. Anything
// the plan doesn't assume (a driver's emergency stop) is met honestly: Traffic.collide counts any vehicle whose roof the
// car is under. (The world's pace is not one of them: Game keeps the driver's Focus Time from changing it during a hop.)
export function planHop(vx: number, halfL: number, halfW: number, cars: HopVehicle[]): HopPlan {
  const needs: HopNeed[] = [];
  let over: HopVehicle | null = null, first: HopNeed | null = null, tooClose = false;
  for (const c of cars) {
    if (Math.abs(c.dd) > c.wid / 2 + halfW + 0.25) continue;               // not in the car's lane
    const tailGap = c.ds - c.len / 2 - halfL;                            // car's nose to its tail
    if (c.ds + c.len / 2 < -halfL) continue;                             // already behind the car
    const vc = vx - c.v;
    const n = needFor(c, c.ds, vx, halfL);
    if (n.t1 >= HOP.maxT && n.tLand >= HOP.maxT + HOP.landWarn) continue;   // beyond the longest hop and its landing room
    needs.push(n);
    if (vc > 0.5 && tailGap <= HOP.scan && (!over || c.ds < over.ds)) { over = c; first = n; }
  }
  if (first) { first.must = true; tooClose = first.t1 <= 0.05; }
  if (tooClose) return { peak: 0, T: 0, over: over?.kind ?? null, refuse: 'Too close to clear', block: over };
  const arc = arcFor(needs);
  if (arc) return { peak: arc.peak, T: arc.T, over: over?.kind ?? null, refuse: null, warn: tight(arc.T, needs) };
  // no arc, and the nearest vehicle can be cleared on its own: the car would come down on the next one (the first that
  // the nearest's own arc misses)
  const own = first ? arcFor([first]) : null;
  if (!first || !over || own) {
    const ref = own ?? { peak: HOP.peak, T: naturalT(HOP.peak) }, m = missed(ref.peak, ref.T, needs);
    return { peak: 0, T: 0, over: over?.kind ?? null, refuse: 'No room to land', block: m?.car ?? null };
  }
  // the nearest can't be cleared from here at this closing speed. A plain hop that comes down short of it (it stops
  // being a must), with HOP.landWarn s of room before it, not HOP.landGap: the car was heading straight at it, and the
  // air time took that long from the brakes (at 0.5 s a 1.5 m hop short of a semi at +30 m/s ended in its tail); every
  // other need met
  first.must = false; first.room = HOP.landWarn;
  const plain = arcFor(needs);
  // (the toast names the vehicle it comes down short of, so that one is no "traffic on landing")
  if (plain) return { peak: plain.peak, T: plain.T, over: null, refuse: null, short: over.kind, warn: tight(plain.T, needs.filter((n) => n !== first)) };
  // or say what would: nearer (0.3-0.8 s from its tail at this closing speed; "Too close" when only further back would
  // do, as from a few metres off its bumper at a low closing speed), or faster
  const vc = vx - over.v, base = over.len / 2 + halfL + 2;
  let back = false;
  for (const lead of [0.3, 0.5, 0.8]) {
    const ds = base + vc * lead;
    if (!arcFor([{ ...needFor(over, ds, vx, halfL), must: true }])) continue;
    if (ds < over.ds) return { peak: 0, T: 0, over: over.kind, refuse: 'Get closer to clear', block: over };
    back = true;
  }
  return { peak: 0, T: 0, over: over.kind, refuse: back ? 'Too close to clear' : 'Need more speed to clear', block: over };
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
