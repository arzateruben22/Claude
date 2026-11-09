// S2a's scripted staff (PROJECT_OC_SPORTS_BAR.md, "Ordering", "Regulars, walk-ins and staff" and "The bartenders' lane
// path"): one bartender on the lane path behind the counter and one server on the floor, in the house uniform (night
// violet, a lime trim). They run on a job queue, not needs. The bartender walks the bar-aligned lane path (staff.ts),
// moved along it directly with no collision test; the server walks the walk grid like anyone else. S3a brings the full
// staff plan (counts by the crowd share, the host, the barback). Both are built by the people builder at LOD 1, used
// through its exports only.
import * as THREE from 'three';
import { buildPerson, Person } from '../../people';
import { baseBody, baseLook, defaultFace, HAIR_COLORS } from '../../people/params';
import type { PersonOptions, Garment } from '../../people';
import type { Frame } from '../../engine/frame';
import type { WalkGrid } from '../../engine/walkgrid';
import type { P2 } from '../../engine/venue-def';
import { ClipLayer } from '../../engine/sim/clips';
import { pathAt, pathLength } from './staff';
import { LANE_PATH, HANDOFF } from './layout';

/** our uniform: a night-violet polo with a lime trim, dark trousers, black sneakers */
export function staffOptions(seed: number, f: boolean): PersonOptions {
  let s = seed >>> 0; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const body = { ...baseBody(f ? 'f' : 'm'), age: 24 + Math.round(r() * 20), height: f ? 1.62 + r() * 0.08 : 1.72 + r() * 0.1, fat: 0.3 + r() * 0.25, muscle: 0.4 + r() * 0.2 };
  const look = { ...baseLook(), skin: [0xeac0a4, 0xc99472, 0x9c6545, 0x65402f][Math.floor(r() * 4)], hair: (f ? 'ponytail' : r() < 0.5 ? 'short' : 'buzz') as PersonOptions['look']['hair'], hairColor: [HAIR_COLORS.black, HAIR_COLORS.darkBrown, HAIR_COLORS.brown][Math.floor(r() * 3)] };
  const outfit: Garment[] = [
    { kind: 'polo', color: 0x2c2758, fabric: 'cotton', sleeve: 0.25, neck: 'collar', accent: 0xc3f23a },
    { kind: 'trousers', color: 0x1b1b20, fabric: 'cotton' },
    { kind: 'sneakers', color: 0x161616, fabric: 'leather', accent: 0xf2f2f0 },
  ];
  return { seed, name: 'staff', body, face: defaultFace(f ? 'f' : 'm'), look, outfit, acc: { hoops: null, studs: null, chain: null, watch: null, bracelet: null, ring: null, bag: 'none', bagColor: 0x111111 } };
}

const FLOOR = 0.15;
const LANE_LEN = pathLength(LANE_PATH);
/** arc length along the lane path for a frame u on its first leg (the counter), clamped to the leg */
const sOfU = (u: number) => Math.max(0, Math.min(LANE_PATH[1][0] - LANE_PATH[0][0], u - LANE_PATH[0][0]));
export const POSTS_U = [15.5, 18.7, 21.9, 25.1];

export interface StaffBody { p: Person; x: number; z: number; y: number; heading: number; moving: boolean; carry: string | null; role: 'bartender' | 'server' }

/** the bartender: on the lane path, serving the counter first come first served: make 4 to 8 s, hand over */
export class Bartender implements StaffBody {
  role = 'bartender' as const;
  p: Person; x = 0; z = 0; y = FLOOR; heading = 0; moving = false; carry: string | null = null;
  s = sOfU(POSTS_U[1]); private target = this.s; private speed = 1.2;
  /** the job in hand: make an item for someone at counter u, then hand it over */
  job: { item: string; forU: number; make: number; t: number; stage: 'walk' | 'make' | 'hand'; done: () => void } | null = null;
  queue: { item: string; forU: number; make: number; done: () => void }[] = [];
  constructor(private F: Frame, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4101) {
    this.p = buildPerson({ ...staffOptions(seed, false), quality, lod: 1 });
    this.p.group.name = 'staff-bartender'; this.p.group.userData.group = 'staff';
    this.place();
  }
  /** an order: make it for the guest at counter position u (frame), then call done on the hand-over */
  order(item: string, forU: number, makeS: number, done: () => void) { this.queue.push({ item, forU, make: makeS, done }); }
  private place() {
    const { at, dir } = pathAt(LANE_PATH, this.s), [x, z] = this.F.fromFrame(at[0], at[1]);
    this.x = x; this.z = z;
    return dir;
  }
  update(dt: number) {
    if (!this.job && this.queue.length) { const j = this.queue.shift()!; this.job = { ...j, t: 0, stage: 'walk' }; this.target = sOfU(j.forU); }
    if (!this.job) this.target = sOfU(POSTS_U[1]);
    const d = this.target - this.s, step = this.speed * dt;
    this.moving = Math.abs(d) > 0.02;
    if (this.moving) this.s += Math.sign(d) * Math.min(Math.abs(d), step);
    const dir = this.place();
    const j = this.job;
    if (this.moving) { this.heading = this.F.yawFromFrame(dir[0] * Math.sign(d || 1), dir[1] * Math.sign(d || 1)); this.p.play('walk'); }
    else {
      this.p.play('idle');
      if (j && j.stage === 'walk') { j.stage = 'make'; j.t = 0; }
      // making: turned to the back bar; handing over and idle: facing the counter
      this.heading = this.F.yawFromFrame(0, j?.stage === 'make' ? 1 : -1);
    }
    if (j && j.stage === 'make') { j.t += dt; this.carry = j.t > j.make * 0.6 ? j.item : null; if (j.t >= j.make) { j.stage = 'hand'; j.t = 0; this.carry = j.item; } }
    else if (j && j.stage === 'hand') { j.t += dt; if (j.t >= 0.7) { this.carry = null; const done = j.done; this.job = null; done(); } }
    // the work clip while making or wiping down at the post
    const want = (j && j.stage === 'make') || (!j && !this.moving) ? 'wipe' : null;
    if (want && this.clips.playing(this.p) !== 'wipe') this.clips.play(this.p, 'wipe');
    else if (!want && this.clips.playing(this.p) === 'wipe') this.clips.stop(this.p);
    this.p.group.position.set(this.x, this.y, this.z); this.p.group.rotation.y = this.heading;
    this.p.update(dt); this.clips.apply(this.p, dt);
  }
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
  constructor(private F: Frame, private grid: WalkGrid, private clips: ClipLayer, quality: 'phone' | 'high', seed = 4207) {
    this.p = buildPerson({ ...staffOptions(seed, true), quality, lod: 1 });
    this.p.group.name = 'staff-server'; this.p.group.userData.group = 'staff';
    this.home = F.fromFrame(30.6, 10.35); [this.x, this.z] = this.home;
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
    if (!this.job && this.queue.length) { this.job = this.queue.shift()!; this.wait = this.job.delay ?? 0; this.path = null; }
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
    this.p.update(dt * (this.moving ? 1.05 : 1)); this.clips.apply(this.p, dt);
  }
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
