// S2a's scripted staff (PROJECT_OC_SPORTS_BAR.md, "Ordering", "Regulars, walk-ins and staff" and "The bartenders' lane
// path"): one bartender on the lane path behind the counter and one server on the floor, in the house uniform (night
// violet, a lime trim). They run on a job queue, not needs. The bartender walks the bar-aligned lane path (staff.ts),
// moved along it directly with no collision test; the server walks the walk grid like anyone else. S3a brings the full
// staff plan (counts by the crowd share, the host, the barback). Both are built by the people builder at LOD 1, used
// through its exports only.
import * as THREE from 'three';
import { buildPerson, Person } from '../../people';
import type { PersonOptions } from '../../people';
import { staffPerson } from '../../cast';
import type { Frame } from '../../engine/frame';
import type { WalkGrid } from '../../engine/walkgrid';
import type { P2 } from '../../engine/venue-def';
import { ClipLayer } from '../../engine/sim/clips';
import { pathAt, pathLength } from './staff';
import { LANE_PATH, HANDOFF, FN } from './layout';

/** our uniform: a night-violet polo with a lime trim, dark trousers, black sneakers, worn by one of the six (the cast,
 *  src/onfoot/cast.ts, 2026-11-11): one of the three men or (f) the three women, by seed */
export function staffOptions(seed: number, f: boolean): PersonOptions {
  return staffPerson(seed, (f ? 3 : 0) + ((seed >>> 0) % 3), { kind: 'polo', color: 0x2c2758, sleeve: 0.25, neck: 'collar', accent: 0xc3f23a, trousers: 0x1b1b20 });
}

const FLOOR = 0.15;
const LANE_LEN = pathLength(LANE_PATH);
/** arc length along the lane path for a frame u on its first leg (the counter), clamped to the leg */
const sOfU = (u: number) => Math.max(0, Math.min(LANE_PATH[1][0] - LANE_PATH[0][0], u - LANE_PATH[0][0]));
export const POSTS_U = [15.5, 18.7, 21.9, 25.1];

export interface StaffBody { p: Person; x: number; z: number; y: number; heading: number; moving: boolean; carry: string | null; role: 'bartender' | 'server' | 'host' | 'barback' | 'house' }

/** the bartender: on the lane path, serving a section of the counter first come first served: make 4 to 8 s, hand
 *  over (S3a: two to four of them, each with a section; the crew keeps their centres at least 0.6 m apart along u). At
 *  Low, with no barback, the westmost one leaves the lane by the staff flap now and then, steps onto the walk grid at
 *  H, collects the empties and comes back the same way (`trip`) */
export class Bartender implements StaffBody {
  role = 'bartender' as const;
  p: Person; x = 0; z = 0; y = FLOOR; heading = 0; moving = false; carry: string | null = null;
  s = sOfU(POSTS_U[1]); private target = this.s; private speed = 1.2;
  /** the counter's u range this bartender serves (S3a's sections), and the lane's limits this frame from the crew */
  section: [number, number] = [LANE_PATH[0][0], 26.2];
  sMin = 0; sMax = LANE_LEN;
  /** on shift (drawn and serving) */
  on = true;
  /** the flap trip (Low): out along the lane to H, the empties on the walk grid, back to H, in along the lane */
  trip: { stage: 'out' | 'floor' | 'back' | 'in'; path: P2[] | null; pi: number; picked: number; t: number } | null = null;
  trips: { start: number; reachedH: number | null; picked: number; back: number | null; floorPts: number }[] = [];
  grid: WalkGrid | null = null;
  nextEmpty: (() => { x: number; z: number; take: () => void } | null) | null = null;
  /** the job in hand: make an item for someone at counter u, then hand it over */
  job: { item: string; forU: number; make: number; t: number; stage: 'walk' | 'make' | 'hand'; done: () => void } | null = null;
  queue: { item: string; forU: number; make: number; done: () => void }[] = [];
  /** the counter positions (frame u) this bartender has handed something over at */
  served = new Set<number>();
  constructor(private F: Frame, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4101, lod: 1 | 2 = 1) {
    this.p = buildPerson({ ...staffOptions(seed, false), quality, lod });
    this.p.group.name = 'staff-bartender'; this.p.group.userData.group = 'staff';
    this.place();
  }
  /** an order: make it for the guest at counter position u (frame), then call done on the hand-over */
  order(item: string, forU: number, makeS: number, done: () => void) { this.queue.push({ item, forU, make: makeS, done }); }
  /** the section's middle: where it waits */
  get post() { return (this.section[0] + this.section[1]) / 2; }
  /** u on the counter's leg (the flap leg reads the flap's u) */
  get u() { return LANE_PATH[0][0] + Math.min(this.s, LANE_PATH[1][0] - LANE_PATH[0][0]); }
  private place() {
    const { at, dir } = pathAt(LANE_PATH, this.s), [x, z] = this.F.fromFrame(at[0], at[1]);
    this.x = x; this.z = z;
    return dir;
  }
  /** start a flap trip: out to H, the empties, back (false if it's busy) */
  startTrip(now: number) { if (this.trip || this.job || this.queue.length || !this.grid) return false; this.trip = { stage: 'out', path: null, pi: 0, picked: 0, t: 0 }; this.trips.push({ start: now, reachedH: null, picked: 0, back: null, floorPts: 0 }); return true; }
  private tripStep(dt: number, now: number) {
    // (a trip's record: the checks' audit reset may have cleared the list mid-trip, so one is started again)
    if (!this.trips.length) this.trips.push({ start: now, reachedH: null, picked: 0, back: null, floorPts: 0 });
    const tr = this.trip!, rec = this.trips[this.trips.length - 1], H = this.F.fromFrame(HANDOFF[0], HANDOFF[1]);
    const walkPath = (to: P2) => { const pth = this.grid!.path(this.x, this.z, to[0], to[1]); tr.path = pth && pth.length ? [...pth, to] : [to]; tr.pi = 0; };
    const follow = () => {
      if (!tr.path) return true;
      const tgt = tr.path[tr.pi], dx = tgt[0] - this.x, dz = tgt[1] - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) { this.x = tgt[0]; this.z = tgt[1]; tr.pi++; if (tr.pi >= tr.path.length) { tr.path = null; return true; } }
      else { this.x += (dx / d) * step; this.z += (dz / d) * step; this.heading = Math.atan2(dx, dz); this.moving = true; }
      return false;
    };
    if (tr.stage === 'out' || tr.stage === 'in') {
      const goal = tr.stage === 'out' ? LANE_LEN : sOfU(this.post), d = goal - this.s;
      if (tr.stage === 'in' && d < 0 && this.s - Math.abs(d) < this.sMin - 1e-6) { this.place(); return; }   // wait for room on the lane
      const step = this.speed * dt; this.moving = Math.abs(d) > 0.02;
      if (this.moving) this.s += Math.sign(d) * Math.min(Math.abs(d), step);
      const dir = this.place();
      if (this.moving) this.heading = this.F.yawFromFrame(dir[0] * Math.sign(d || 1), dir[1] * Math.sign(d || 1));
      if (!this.moving && tr.stage === 'out') { tr.stage = 'floor'; rec.reachedH = now; this.x = H[0]; this.z = H[1]; }
      else if (!this.moving && tr.stage === 'in') { this.trip = null; rec.back = now; }
      return;
    }
    if (tr.stage === 'floor') {
      rec.floorPts++;
      if (!tr.path) {
        const e = tr.picked < 4 ? this.nextEmpty?.() ?? null : null;
        if (!e) { tr.stage = 'back'; walkPath(H); return; }
        walkPath([e.x, e.z]); (tr as unknown as { take: () => void }).take = e.take;
      }
      if (follow()) { const take = (tr as unknown as { take?: () => void }).take; if (take) { take(); tr.picked++; rec.picked++; this.carry = 'empty-glass'; (tr as unknown as { take?: () => void }).take = undefined; } }
      return;
    }
    if (tr.stage === 'back') { if (!tr.path) walkPath(H); if (follow()) { tr.stage = 'in'; this.carry = null; this.s = LANE_LEN; this.place(); } }
  }
  update(dt: number, now = 0) {
    this.moving = false;
    if (this.trip) { this.tripStep(dt, now); }
    else {
      if (!this.job && this.queue.length) { const j = this.queue.shift()!; this.job = { ...j, t: 0, stage: 'walk' }; }
      const lo = sOfU(this.section[0] + 0.3), hi = sOfU(this.section[1] - 0.3);
      const want = this.job ? sOfU(Math.max(this.section[0] + 0.3, Math.min(this.section[1] - 0.3, this.job.forU))) : sOfU(this.post);
      this.target = Math.max(this.sMin, Math.min(this.sMax, Math.max(lo, Math.min(hi, want))));
      // the target is inside the crew's limits, so a step toward it never brings two bartenders closer than 0.6 m
      const d = this.target - this.s, step = this.speed * dt;
      this.moving = Math.abs(d) > 0.02;
      if (this.moving) this.s += Math.sign(d) * Math.min(Math.abs(d), step);
      const dir = this.place();
      const j = this.job;
      if (this.moving) this.heading = this.F.yawFromFrame(dir[0] * Math.sign(d || 1), dir[1] * Math.sign(d || 1));
      else {
        if (j && j.stage === 'walk' && Math.abs(this.s - want) < 0.05) { j.stage = 'make'; j.t = 0; }
        else if (j && j.stage === 'walk' && Math.abs(this.s - this.target) < 0.05 && Math.abs(this.target - want) >= 0.05) { j.stage = 'make'; j.t = 0; }
        // making: turned to the back bar; handing over and idle: facing the counter
        this.heading = this.F.yawFromFrame(0, j?.stage === 'make' ? 1 : -1);
      }
      if (j && j.stage === 'make') { j.t += dt; this.carry = j.t > j.make * 0.6 ? j.item : null; if (j.t >= j.make) { j.stage = 'hand'; j.t = 0; this.carry = j.item; } }
      else if (j && j.stage === 'hand') { j.t += dt; if (j.t >= 0.7) { this.carry = null; const done = j.done; this.served.add(Math.round(j.forU * 100) / 100); this.job = null; done(); } }
    }
    // the work clip while making or wiping down at the post
    const j = this.job;
    const want = !this.trip && ((j && j.stage === 'make') || (!j && !this.moving)) ? 'wipe' : null;
    if (want && this.clips.playing(this.p) !== 'wipe') this.clips.play(this.p, 'wipe');
    else if (!want && this.clips.playing(this.p) === 'wipe') this.clips.stop(this.p);
    if (this.moving) this.p.play('walk'); else this.p.play('idle');
    this.y = FLOOR + (this.trip && this.trip.stage !== 'out' && this.trip.stage !== 'in' && this.grid ? Math.max(0, this.grid.height(this.x, this.z) - FLOOR) : 0);
    this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading;
  }
  /** the body's own animation (only while it's drawn as a mesh; the crowd's draw pass calls it) */
  animate(dt: number) { this.p.update(dt); this.clips.apply(this.p, dt); }
  /** where an item handed over sits: just over the counter's edge in front of the bartender */
  handPoint(): P2 { const [u] = this.F.toFrame(this.x, this.z); return this.F.fromFrame(u, 13.55); }
  get busy() { return !!this.job || this.queue.length > 0; }
  get laneLength() { return LANE_LEN; }
}

export interface ServerJob {
  kind: 'take' | 'deliver' | 'bus';
  /** where to go (local), and what to do on arrival */
  to: () => P2; arrive: () => void;
  /** a delay before setting off (sim seconds): the plan's arrival within 30 to 90 s, by staffing */
  delay?: number;
  label: string;
}
/** the server: walks the floor on the walk grid, takes table orders, brings food from the pass and drinks from the
 *  pick-up, and buses empties */
export class Server implements StaffBody {
  role = 'server' as const;
  p: Person; x: number; z: number; y = FLOOR; heading = 0; moving = false; carry: string | null = null;
  private path: P2[] | null = null; private pi = 0; private speed = 1.3; private wait = 0;
  job: ServerJob | null = null; queue: ServerJob[] = [];
  home: P2;
  on = true;
  constructor(private F: Frame, private grid: WalkGrid, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4207, lod: 1 | 2 = 1, home: P2 = [30.6, 10.35]) {
    this.p = buildPerson({ ...staffOptions(seed, seed % 2 === 1), quality, lod });
    this.p.group.name = 'staff-server'; this.p.group.userData.group = 'staff';
    this.home = F.fromFrame(home[0], home[1]); [this.x, this.z] = this.home;
    this.heading = F.yawFromFrame(1, 0);
  }
  add(j: ServerJob, front = false) { if (front) this.queue.unshift(j); else this.queue.push(j); }
  get busy() { return !!this.job || this.queue.length > 0; }
  /** walk to a point on the grid; false if there's no way */
  private go(t: P2) {
    const p = this.grid.path(this.x, this.z, t[0], t[1]);
    this.path = p && p.length ? p : [[t[0], t[1]]]; this.pi = 0;
    return !!p;
  }
  update(dt: number) {
    // a job waits out its delay in the queue (the plan's arrival time), so a server with a job not yet due does the next
    // one that is (S3a: the crowd's table service shares the servers; alone, as in S2a, the timing is the same)
    for (const q of this.queue) if (q.delay) q.delay = Math.max(0, q.delay - dt);
    if (!this.job && this.queue.length) { const k = this.queue.findIndex((q) => !q.delay); if (k >= 0) { this.job = this.queue.splice(k, 1)[0]; this.wait = 0; this.path = null; } }
    const j = this.job;
    if (j && this.wait > 0) { this.wait -= dt; }
    else if (j && !this.path) this.go(j.to());
    else if (!j && !this.path && Math.hypot(this.x - this.home[0], this.z - this.home[1]) > 0.3) this.go(this.home);
    this.moving = false;
    if (this.path) {
      const tgt = this.path[this.pi], dx = tgt[0] - this.x, dz = tgt[1] - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) { this.x = tgt[0]; this.z = tgt[1]; this.pi++; if (this.pi >= this.path.length) { this.path = null; if (j) { this.job = null; j.arrive(); } } }
      else { this.x += (dx / d) * step; this.z += (dz / d) * step; this.heading = Math.atan2(dx, dz); this.moving = true; }
    }
    if (!this.job && !this.path && Math.hypot(this.x - this.home[0], this.z - this.home[1]) <= 0.3) this.heading = this.F.yawFromFrame(1, 0);
    this.p.play(this.moving ? 'walk' : 'idle');
    this.y = FLOOR + Math.max(0, this.grid.height(this.x, this.z) - FLOOR);
    this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading;
  }
  /** the body's own animation (only while it's drawn as a mesh; the crowd's draw pass calls it) */
  animate(dt: number) { this.p.update(dt * (this.moving ? 1.05 : 1)); this.clips.apply(this.p, dt); }
  /** how long a walk from here to a point takes: its path on the walk grid over the server's pace (seconds) */
  walkSeconds(t: P2) {
    const p = this.grid.path(this.x, this.z, t[0], t[1]) ?? [t];
    let d = 0, x = this.x, z = this.z;
    for (const [px, pz] of p) { d += Math.hypot(px - x, pz - z); x = px; z = pz; }
    return d / this.speed;
  }
  /** face a point (on arrival at a table) */
  face(x: number, z: number) { this.heading = Math.atan2(x - this.x, z - this.z); }
  get pickup(): P2 { return this.F.fromFrame(26.15, 12.95); }
  get pass(): P2 { return this.F.fromFrame(30.6, 10.35); }
  get handoff(): P2 { return this.F.fromFrame(HANDOFF[0], HANDOFF[1]); }
}


/** the host (S3a): at the door's stand when the room is busy (s >= 0.6), through the featured match's x1.25 window and
 *  through game nights; greets arrivals by turning to them */
export class Host implements StaffBody {
  role = 'host' as const;
  p: Person; x: number; z: number; y = FLOOR; heading: number; moving = false; carry: string | null = null; on = false;
  private baseYaw: number; greeted = 0;
  constructor(F: Frame, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4421, lod: 1 | 2 = 2) {
    this.p = buildPerson({ ...staffOptions(seed, true), quality, lod });
    this.p.group.name = 'staff-host'; this.p.group.userData.group = 'staff';
    [this.x, this.z] = F.fromFrame(6.8, 7.6); this.baseYaw = this.heading = F.yawFromFrame(FN[0], FN[1]);
  }
  /** someone coming in within 3 m: turn to them */
  greet(x: number, z: number) { this.heading = Math.atan2(x - this.x, z - this.z); this.greeted++; }
  update(dt: number) { this.heading += Math.atan2(Math.sin(this.baseYaw - this.heading), Math.cos(this.baseYaw - this.heading)) * Math.min(1, dt * 0.5); this.p.play('idle'); this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading; }
  animate(dt: number) { this.p.update(dt); this.clips.apply(this.p, dt); }
  get busy() { return false; }
}
/** the barback (S3a, HD and Ultra, s >= 0.5): collects empties on the walk grid and takes them to the pass */
export class Barback implements StaffBody {
  role = 'barback' as const;
  p: Person; x: number; z: number; y = FLOOR; heading = 0; moving = false; carry: string | null = null; on = false;
  private path: P2[] | null = null; private pi = 0; private speed = 1.25; private take: (() => void) | null = null; private toPass = false;
  home: P2; picked = 0;
  nextEmpty: (() => { x: number; z: number; take: () => void } | null) | null = null;
  constructor(F: Frame, private grid: WalkGrid, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4519, lod: 1 | 2 = 2) {
    this.p = buildPerson({ ...staffOptions(seed, false), quality, lod });
    this.p.group.name = 'staff-barback'; this.p.group.userData.group = 'staff';
    this.home = F.fromFrame(30.6, 11.0); [this.x, this.z] = this.home;
  }
  private go(t: P2) { const p = this.grid.path(this.x, this.z, t[0], t[1]); this.path = p && p.length ? [...p, t] : [t]; this.pi = 0; }
  update(dt: number) {
    this.moving = false;
    if (!this.path) {
      if (this.toPass) { this.toPass = false; this.carry = null; }
      const e = this.carry ? null : this.nextEmpty?.() ?? null;
      if (e) { this.go([e.x, e.z]); this.take = e.take; }
      else if (this.carry) { this.go(this.home); this.toPass = true; }
      else if (Math.hypot(this.x - this.home[0], this.z - this.home[1]) > 0.4) this.go(this.home);
    }
    if (this.path) {
      const tgt = this.path[this.pi], dx = tgt[0] - this.x, dz = tgt[1] - this.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) { this.x = tgt[0]; this.z = tgt[1]; this.pi++; if (this.pi >= this.path.length) { this.path = null; if (this.take) { this.take(); this.take = null; this.picked++; this.carry = 'empty-glass'; this.go(this.home); this.toPass = true; } } }
      else { this.x += (dx / d) * step; this.z += (dz / d) * step; this.heading = Math.atan2(dx, dz); this.moving = true; }
    }
    this.p.play(this.moving ? 'walk' : 'idle');
    this.y = FLOOR + Math.max(0, this.grid.height(this.x, this.z) - FLOOR);
    this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading;
  }
  animate(dt: number) { this.p.update(dt); this.clips.apply(this.p, dt); }
  get busy() { return !!this.path; }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
/** a held item's place in a hand: between the wrist and the fingers (Lot 57's placeHeld, npcs.ts), written here so the
 *  bar doesn't import Lot 57's crowd */
export function handPoint(p: Person, side: 'R' | 'L', out: THREE.Vector3): THREE.Vector3 | null {
  const hand = p.group.getObjectByName('hand' + side), fing = p.group.getObjectByName('fing' + side);
  if (!hand || !fing) return null;
  hand.updateWorldMatrix(true, false); fing.updateWorldMatrix(false, false);
  _v.setFromMatrixPosition(hand.matrixWorld); _w.setFromMatrixPosition(fing.matrixWorld);
  return out.copy(_v).lerp(_w, 0.55);
}
