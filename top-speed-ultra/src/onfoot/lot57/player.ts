// You, on foot (PROJECT_OC_ON_FOOT.md, "Camera", "Movement and collisions" and "Running"): a kinematic body of radius
// 0.3 m that reaches its walk in about 0.12 s and stops from it in 0.07 s, walks at 1.4 m/s, and runs (the stick's run: a
// double-tap and hold of W or of the touch stick, Shift, a full push) at 4.5 m/s outdoors or speed-walks at 2.6 m/s
// indoors (the Shed, the bar), easing up from a walk in about 0.3 s and back down in about 0.2 s; near people it eases
// back to a walk (no running through a crowd); tap to go always walks. It's pushed out of everything it overlaps,
// three passes a step, so it slides along walls. The edge of the walkable area (kerbs except at crosswalks, the end of the hangout
// area) is the walk grid's blocked cells, pushed out of as squares. If anything ever leaves you inside a collider
// you're moved to the nearest free cell. Tap to go follows an A* path; sitting snaps you to a seat.
import * as THREE from 'three';
import { ColliderSet, distTo, Hit, isTall } from './collide';
import { WalkGrid, CELL, RADIUS } from './walkgrid';
import { inShed } from './coords';
import type { P2 } from './geom';
import type { Seat } from './venue';
import type { Person } from '../people';

export const WALK = 1.4, JOG = 3.0, ACCEL = JOG / 0.25, DECEL = JOG / 0.15;
/** running (2026-11-15, the owner: "just make it run / speed walk seamlessly for both devices"): 4.5 m/s outdoors, a
 *  speed walk of 2.6 m/s indoors; up from a walk in about 0.3 s, back down to it in about 0.2 s */
export const RUN = 4.5, BRISK = 2.6, RUN_UP = (RUN - WALK) / 0.3, RUN_DOWN = (RUN - WALK) / 0.2;
/** people closer than CROWD_NEAR (centre to centre, metres) hold you to a walk; from there to CROWD_FAR the run eases in */
const CROWD_NEAR = 1.3, CROWD_FAR = 2.4;
const STEP = 1 / 60;

export interface Stick { x: number; y: number; run: boolean }      // y forward, x right; |stick| <= 1
/** where a tap-to-go walk is headed: a seat to sit in, a group to join, a counter to order at */
export interface Goal { seat?: Seat; spot?: string; join?: number; counter?: string }
export type View = 'first' | 'third';

export class Player {
  x = 0; z = 0; y = 0;
  vx = 0; vz = 0;
  heading = 0;                       // which way the body faces (radians, atan2(dx, dz))
  yaw = 0; pitch = -0.05;            // the look
  view: View = 'first';
  seat: Seat | null = null;
  path: P2[] | null = null; pathI = 0; pathGoal: Goal | null = null;
  /** a tap-to-go walk that ends somewhere to do something (join a group, order at a counter): told on arrival */
  onArrive: (g: Goal) => void = () => {};
  /** people you ease past (NPCs are soft: they never block you, they slow and nudge you; PROJECT_OC_ON_FOOT.md,
   *  "Movement and collisions"). The page refreshes the list each frame. */
  soft: { x: number; z: number; r: number }[] = [];
  private stuckT = 0; private lastProgress = 0;
  /** the last thing that pushed you while following a tap-to-go path (cleared whenever the walk makes progress) */
  private pathBlock = '';
  /**
   * Set when a tap-to-go walk is given up (no progress for 2.5 s: something moved into the way after the path was
   * planned): what held you (a collider's tag, 'kerb' or 'edge'), where, and how much of the path was left. The page
   * toasts it and clears it; `lastGaveUp` keeps it for the test hooks.
   */
  gaveUp: { by: string; x: number; z: number; left: number } | null = null;
  lastGaveUp: { by: string; x: number; z: number; left: number } | null = null;
  eye = 1.6;                         // eye height from your driver
  bobPhase = 0;
  reducedMotion = false;
  /** the last thing that held you, for the toasts: 'edge' (the end of the hangout area), 'kerb', or a collider tag */
  lastBlock = '';
  rescues = 0;
  person: Person | null = null;
  /** the run asked for on the last step (the stick's run, or a full push), whether or not anything held you back */
  runWanted = false;
  /** a page whose people aren't in `soft` (the bar's crowd): the distance from (x, z) to the nearest person on their
   *  feet, or anything >= r when nobody is that close */
  crowdGap: ((x: number, z: number, r: number) => number) | null = null;
  /** the speed the last step aimed for (m/s): RUN, BRISK, WALK or less */
  wantSpeed = 0;
  private h: Hit = { d: 0, nx: 0, nz: 0 };
  private near: import('./collide').Collider[] = [];
  // camera scratch (no allocation per frame)
  private cEye = new THREE.Vector3(); private cDir = new THREE.Vector3();

  constructor(private set: ColliderSet, private grid: WalkGrid, private roadAt: (x: number, z: number) => boolean) {}

  get sitting() { return this.seat !== null; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get indoors() { return inShed(this.x, this.z); }

  place(x: number, z: number) {
    const p = this.grid.isFree(x, z) && this.clearance(x, z) >= RADIUS - 1e-3 ? [x, z] : this.grid.nearestFree(x, z);
    if (!p) return false;
    this.x = p[0]; this.z = p[1]; this.vx = this.vz = 0; this.seat = null; this.path = null;
    this.y = this.grid.height(this.x, this.z);
    return true;
  }

  /** the smallest clearance from the body's centre to any collider or blocked cell (negative = inside) */
  clearance(x: number, z: number) {
    let d = this.set.clearance(x, z, 1.2);
    const g = this.grid, i0 = g.ix(x) - 2, j0 = g.iz(z) - 2;
    for (let j = j0; j <= j0 + 4; j++) for (let i = i0; i <= i0 + 4; i++) {
      if (i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.region[j * g.nx + i]) continue;
      const cx = g.x0 + (i + 0.5) * CELL, cz = g.z0 + (j + 0.5) * CELL;
      const dx = Math.max(Math.abs(x - cx) - CELL / 2, 0), dz = Math.max(Math.abs(z - cz) - CELL / 2, 0);
      d = Math.min(d, Math.hypot(dx, dz) || -0.01);
    }
    return d;
  }

  /** one fixed step of the simulation */
  step(stick: Stick) {
    const dt = STEP;
    if (this.seat) { this.vx = this.vz = 0; return; }
    let sx = stick.x, sy = stick.y;
    // tap to go: steer along the path (any stick input cancels it)
    if (Math.hypot(sx, sy) > 0.15) { this.path = null; this.pathGoal = null; }
    let tx = 0, tz = 0, want = 0;
    if (this.path) {
      let p = this.path[this.pathI], dx = p[0] - this.x, dz = p[1] - this.z, d = Math.hypot(dx, dz), last = this.pathI === this.path.length - 1;
      // a corner reached: straight on to the next leg, whose progress is counted afresh (the count used to carry the
      // corner's last few centimetres over, so any leg longer than about 3.5 m after a corner was dropped)
      while (!last && d < 0.35) {
        this.pathI++; this.lastProgress = Infinity; this.stuckT = 0;
        p = this.path[this.pathI]; dx = p[0] - this.x; dz = p[1] - this.z; d = Math.hypot(dx, dz); last = this.pathI === this.path.length - 1;
      }
      if (last && d < 0.12) { this.arrive(); return; }
      tx = dx / d; tz = dz / d;
      want = Math.min(WALK, last ? Math.max(0.5, d * 2.2) : WALK);
      // stuck on something that moved since the path was planned (a parked car, a gate): give up after 2.5 s with no
      // progress, and say what was in the way
      if (d < this.lastProgress - 0.05) { this.lastProgress = d; this.stuckT = 0; this.pathBlock = ''; } else this.stuckT += dt;
      if (this.stuckT > 2.5) {
        let left = d;
        for (let i = this.pathI + 1; i < this.path.length; i++) left += Math.hypot(this.path[i][0] - this.path[i - 1][0], this.path[i][1] - this.path[i - 1][1]);
        this.gaveUp = this.lastGaveUp = { by: this.pathBlock || 'unknown', x: this.x, z: this.z, left };
        this.path = null; this.pathGoal = null; tx = 0; tz = 0; want = 0;
      }
    } else {
      const mag = Math.min(1, Math.hypot(sx, sy));
      if (mag > 0.02) {
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
        sx /= Math.max(mag, 1e-6); sy /= Math.max(mag, 1e-6);
        const dx = fx * sy + rx * sx, dz = fz * sy + rz * sx, l = Math.hypot(dx, dz) || 1;
        tx = dx / l; tz = dz / l;
        const run = stick.run || mag > 0.92;
        this.runWanted = run;
        if (run) {
          // outdoors a run, indoors a speed walk; near people it eases back toward a walk (nobody is run through)
          const top = this.indoors ? BRISK : RUN, k = this.crowdRoom();
          want = WALK + (top - WALK) * k;
        } else want = mag >= 0.75 ? WALK : WALK * (0.35 + 0.65 * mag / 0.75);
      } else this.runWanted = false;
    }
    if (this.path) this.runWanted = false;
    this.wantSpeed = want;
    // accelerate toward the wanted velocity: up to a walk in about 0.12 s, a walk to a run in about 0.3 s, a run back
    // to a walk in about 0.2 s, and a stop from a walk in 0.07 s (from a run in 0.23 s)
    const wx = tx * want, wz = tz * want, sp0 = this.speed;
    let ex = wx - this.vx, ez = wz - this.vz;
    const el = Math.hypot(ex, ez), lim = (want > sp0 ? (sp0 < WALK ? ACCEL : RUN_UP) : want > 0.05 && sp0 > WALK ? RUN_DOWN : DECEL) * dt;
    if (el > lim) { ex *= lim / el; ez *= lim / el; }
    this.vx += ex; this.vz += ez;
    // move, then push out of everything, three passes, sliding along walls
    const ox = this.x, oz = this.z;
    let nx = ox + this.vx * dt, nz = oz + this.vz * dt;
    // people first, softly (a third of the overlap a step): you slide round them and can ease through a crowd; the
    // hard passes below always have the last word, so nobody can push you into a wall
    for (let i = 0; i < this.soft.length; i++) {
      const o = this.soft[i], dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz), min = o.r + RADIUS;
      if (d < min && d > 1e-6) { const k = ((min - d) / d) * 0.34; nx += dx * k; nz += dz * k; }
    }
    this.lastBlock = '';
    for (let pass = 0; pass < 3; pass++) {
      const q = this.set.query(nx - 1, nz - 1, nx + 1, nz + 1, this.near);
      let moved = false;
      for (const o of q) {
        distTo(o, nx, nz, this.h);
        if (this.h.d < RADIUS) { const k = RADIUS - this.h.d + 1e-4; nx += this.h.nx * k; nz += this.h.nz * k; moved = true; this.lastBlock = o.tag; if (this.path) this.pathBlock = o.tag; }
      }
      // the walk grid's edge, as squares
      const g = this.grid, i0 = g.ix(nx) - 1, j0 = g.iz(nz) - 1;
      for (let j = j0; j <= j0 + 2; j++) for (let i = i0; i <= i0 + 2; i++) {
        if (i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.region[j * g.nx + i]) continue;
        const cx = g.x0 + (i + 0.5) * CELL, cz = g.z0 + (j + 0.5) * CELL;
        const ddx = nx - cx, ddz = nz - cz, qx = Math.max(-CELL / 2, Math.min(CELL / 2, ddx)), qz = Math.max(-CELL / 2, Math.min(CELL / 2, ddz));
        let vx = ddx - qx, vz = ddz - qz, d = Math.hypot(vx, vz);
        if (d < 1e-6) {           // the centre is inside the square: out the nearest side
          const ex2 = CELL / 2 - Math.abs(ddx), ez2 = CELL / 2 - Math.abs(ddz);
          if (ex2 < ez2) { vx = Math.sign(ddx) || 1; vz = 0; d = -ex2; } else { vx = 0; vz = Math.sign(ddz) || 1; d = -ez2; }
          const k = RADIUS - d + 1e-4; nx += vx * k; nz += vz * k; moved = true;
        } else if (d < RADIUS) { const k = RADIUS - d + 1e-4; nx += (vx / d) * k; nz += (vz / d) * k; moved = true; }
        else continue;
        this.lastBlock = this.roadAt(cx, cz) ? 'kerb' : 'edge';
        if (this.path) this.pathBlock = this.lastBlock;
      }
      if (!moved) break;
    }
    // never stuck: still inside something after three passes (a corner pinch) means stay put, and if even the old
    // spot is now inside (a gate shut on you, a car parked on you), go to the nearest free cell. (1.5 cm of overlap
    // at most, not 2: a pinch against a parked car's corner could end at 2.000 cm exactly, which the walk check, at
    // 2 cm in game coordinates, read as just over; P1d's random walks found two)
    if (this.clearance(nx, nz) < RADIUS - 0.015) {
      if (this.clearance(ox, oz) >= RADIUS - 0.015) { nx = ox; nz = oz; }
      else { const p = this.grid.nearestFree(ox, oz); if (p) { nx = p[0]; nz = p[1]; this.rescues++; } }
    }
    this.vx = (nx - ox) / dt; this.vz = (nz - oz) / dt;
    this.x = nx; this.z = nz;
    // the ground: sidewalks and the lot walk are 0.15 m up (one easy step); ease onto them
    const gy = this.grid.height(nx, nz);
    this.y += (gy - this.y) * Math.min(1, dt * 14);
    // the body turns to face where it's going (or where you look, in first person)
    const sp = this.speed;
    if (sp > 0.1) this.turnTo(Math.atan2(this.vx, this.vz), dt * 9);
    else this.turnTo(this.yaw, dt * 6);          // standing: the body turns to face where you look
    // the bob's rate follows the speed, more slowly above a walk (a run's stride is longer, not only quicker)
    if (sp > 0.1 && !this.reducedMotion) this.bobPhase += dt * Math.PI * 2 * (1.7 + 0.3 * Math.min(sp, WALK) + 0.15 * Math.max(0, sp - WALK));
  }
  /** 0 when someone is within CROWD_NEAR of you, 1 when nobody is within CROWD_FAR (the soft list: the people the page
   *  refreshes each frame) */
  private crowdRoom() {
    let d = Infinity;
    for (let i = 0; i < this.soft.length; i++) { const o = this.soft[i], e = Math.hypot(o.x - this.x, o.z - this.z) - o.r; if (e < d) d = e; }
    if (this.crowdGap) d = Math.min(d, this.crowdGap(this.x, this.z, CROWD_FAR + 0.5) - 0.26);
    return Math.max(0, Math.min(1, (d - CROWD_NEAR) / (CROWD_FAR - CROWD_NEAR)));
  }
  /**
   * For the run checks: a clear straight lane of `len` metres from a free spot, indoors or out as asked (the walk grid
   * free, the body's clearance kept, nobody in `soft` or crowdGap within CROWD_FAR of it, the same side of the door all
   * the way), searched from (nearX, nearZ) outward. Returns the start and the yaw along it, or null.
   */
  findLane(indoors: boolean, len: number, nearX = this.x, nearZ = this.z): { x: number; z: number; yaw: number } | null {
    const g = this.grid, x0 = this.x, z0 = this.z;
    const ok = (x: number, z: number) => {
      if (!g.isFree(x, z) || this.clearance(x, z) < RADIUS + 0.12) return false;
      this.x = x; this.z = z; const inn = this.indoors; this.x = x0; this.z = z0;
      if (inn !== indoors) return false;
      for (const o of this.soft) if (Math.hypot(o.x - x, o.z - z) < CROWD_FAR + 0.6) return false;
      return !this.crowdGap || this.crowdGap(x, z, CROWD_FAR + 0.6) >= CROWD_FAR + 0.6;
    };
    for (let r = 0; r < 80; r += 1) for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2 + r * 0.37, x = nearX + Math.sin(ang) * r, z = nearZ + Math.cos(ang) * r;
      if (!ok(x, z)) continue;
      for (let b = 0; b < 8; b++) {
        const yaw = (b / 8) * Math.PI * 2, fx = Math.sin(yaw), fz = Math.cos(yaw);
        let clear = true;
        for (let d = 0.5; d <= len && clear; d += 0.5) clear = ok(x + fx * d, z + fz * d);
        if (clear) return { x, z, yaw };
      }
      if (r === 0) break;
    }
    return null;
  }
  /** how far into a run you are, 0 at a walk or slower to 1 at RUN (the first-person FOV and bob ease with it) */
  get runAmount() { return Math.max(0, Math.min(1, (this.speed - WALK) / (RUN - WALK))); }
  private turnTo(target: number, k: number) {
    let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, k);
  }

  /** walk to (x, z) by a path round obstacles; returns the path or null when there's no way */
  goTo(x: number, z: number, goal: Goal | null = null): P2[] | null {
    if (this.seat) this.stand();
    const p = this.grid.path(this.x, this.z, x, z);
    this.gaveUp = null; this.pathBlock = '';
    if (!p) { this.path = null; this.pathGoal = null; return p; }
    // already there (the goal is the cell you stand in): arrive at once, so a tapped seat still sits you down
    if (p.length < 2) { this.path = null; this.pathGoal = goal; this.arrive(); return p; }
    this.path = p; this.pathI = 1; this.pathGoal = goal; this.stuckT = 0; this.lastProgress = Infinity;
    return p;
  }
  private arrive() {
    const g = this.pathGoal;
    this.path = null; this.pathGoal = null; this.vx = this.vz = 0;
    if (g?.seat) this.sit(g.seat);
    else if (g) this.onArrive(g);
  }
  sit(s: Seat) {
    this.seat = s; this.path = null; this.vx = this.vz = 0;
    this.x = s.x; this.z = s.z; this.heading = s.face; this.yaw = s.face; this.pitch = -0.08;
  }
  stand() {
    const s = this.seat; if (!s) return;
    this.seat = null;
    const p = this.clearance(s.ax, s.az) >= RADIUS && this.grid.isFree(s.ax, s.az) ? [s.ax, s.az] : this.grid.nearestFree(s.ax, s.az);
    if (p) { this.x = p[0]; this.z = p[1]; }
  }

  /** look by a delta (radians); sitting limits the look to about 100 degrees either side of the seat's facing */
  look(dyaw: number, dpitch: number) {
    this.yaw += dyaw;
    if (this.seat) {
      let d = this.yaw - this.seat.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      const lim = (100 * Math.PI) / 180; d = Math.max(-lim, Math.min(lim, d)); this.yaw = this.seat.face + d;
    }
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.pitch = Math.max((-55 * Math.PI) / 180, Math.min((45 * Math.PI) / 180, this.pitch + dpitch));
  }

  /** where the eyes are now (world, local metres) */
  eyePos(out = new THREE.Vector3()) {
    const sitEye = this.seat ? this.seat.y + 0.68 : 1.15;      // about 1.15 m on a bench, higher on a bar stool
    const bob = this.reducedMotion || this.seat ? 0 : (0.015 + 0.012 * this.runAmount) * Math.sin(this.bobPhase * 2) * Math.min(1, this.speed / WALK);
    return out.set(this.x, this.y + (this.seat ? sitEye : this.eye) + bob, this.z);
  }
  lookDir(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  /** place the camera: first person at the eyes; third person 2.4 m behind, 0.45 m right, 1.75 m up, pulled in by walls */
  camera(cam: THREE.PerspectiveCamera) {
    const eye = this.eyePos(this.cEye), dir = this.lookDir(this.cDir);
    if (this.view === 'first') {
      cam.position.copy(eye);
      cam.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);
      this.camOut.dist = 0; this.camOut.hide = true;
      return this.camOut;
    }
    const hx = this.x, hy = this.y + (this.seat ? this.seat.y + 0.62 : this.eye), hz = this.z;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    // the orbit: back and up by the pitch (looking down raises the camera)
    const back = 2.4, right = 0.45, up = 1.75 - this.eye;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ox = -fx * back * cp + rx * right, oz = -fz * back * cp + rz * right, oy = up - back * sp;
    // pull in so it never goes through a wall (a ray against the tall colliders)
    const t = this.set.ray(hx, hz, hx + ox, hz + oz, isTall);
    const len = Math.hypot(ox, oz), keep = t < 1 ? Math.max(0.25, (t * len - 0.25) / len) : 1;
    const px = hx + ox * keep, py = Math.max(0.35, hy + oy * (0.4 + 0.6 * keep)), pz = hz + oz * keep;
    cam.position.set(px, py, pz);
    // look past your driver at the world (they sit a little left of centre and low in the frame)
    cam.lookAt(hx + fx * 4 * cp, hy - 0.35 + sp * 4, hz + fz * 4 * cp);
    const dist = Math.hypot(px - this.x, pz - this.z);
    this.camOut.dist = dist; this.camOut.hide = dist < 0.7;
    return this.camOut;
  }
  private camOut = { dist: 0, hide: true };
}

export { STEP };
