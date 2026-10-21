// You, on foot (PROJECT_OC_ON_FOOT.md, "Camera" and "Movement and collisions"): a kinematic body of radius 0.3 m
// that reaches its speed in about 0.25 s and stops in 0.15 s, walks at 1.4 m/s on a short push and jogs at 3.0 m/s
// on a full one outdoors (walking only inside the Shed), and is pushed out of everything it overlaps, three passes a
// step, so it slides along walls. The edge of the walkable area (kerbs except at crosswalks, the end of the hangout
// area) is the walk grid's blocked cells, pushed out of as squares. If anything ever leaves you inside a collider
// you're moved to the nearest free cell. Tap to go follows an A* path; sitting snaps you to a seat.
import * as THREE from 'three';
import { ColliderSet, distTo, Hit } from './collide';
import { WalkGrid, CELL, RADIUS } from './walkgrid';
import { inShed } from './coords';
import type { P2 } from './geom';
import type { Seat } from './venue';
import type { Person } from '../people';

export const WALK = 1.4, JOG = 3.0, ACCEL = JOG / 0.25, DECEL = JOG / 0.15;
const STEP = 1 / 60;

export interface Stick { x: number; y: number; run: boolean }      // y forward, x right; |stick| <= 1
export type View = 'first' | 'third';

export class Player {
  x = 0; z = 0; y = 0;
  vx = 0; vz = 0;
  heading = 0;                       // which way the body faces (radians, atan2(dx, dz))
  yaw = 0; pitch = -0.05;            // the look
  view: View = 'first';
  seat: Seat | null = null;
  path: P2[] | null = null; pathI = 0; pathGoal: { seat?: Seat; spot?: string } | null = null;
  private stuckT = 0; private lastProgress = 0;
  eye = 1.6;                         // eye height from your driver
  bobPhase = 0;
  reducedMotion = false;
  /** the last thing that held you, for the toasts: 'edge' (the end of the hangout area), 'kerb', or a collider tag */
  lastBlock = '';
  rescues = 0;
  person: Person | null = null;
  private h: Hit = { d: 0, nx: 0, nz: 0 };
  private near: import('./collide').Collider[] = [];

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
    let d = this.set.clearance(x, z, 1.2).d;
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
      const p = this.path[this.pathI];
      const dx = p[0] - this.x, dz = p[1] - this.z, d = Math.hypot(dx, dz), last = this.pathI === this.path.length - 1;
      if (d < (last ? 0.12 : 0.35)) {
        if (last) { this.arrive(); return; }
        this.pathI++; this.lastProgress = Infinity; this.stuckT = 0;
      } else {
        tx = dx / d; tz = dz / d;
        want = Math.min(WALK, last ? Math.max(0.5, d * 2.2) : WALK);
      }
      // stuck on something that moved (a parked car, a gate): give up after a while
      if (d < this.lastProgress - 0.05) { this.lastProgress = d; this.stuckT = 0; } else this.stuckT += dt;
      if (this.stuckT > 2.5) { this.path = null; this.pathGoal = null; this.lastBlock = 'stuck'; }
    } else {
      const mag = Math.min(1, Math.hypot(sx, sy));
      if (mag > 0.02) {
        const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
        sx /= Math.max(mag, 1e-6); sy /= Math.max(mag, 1e-6);
        const dx = fx * sy + rx * sx, dz = fz * sy + rz * sx, l = Math.hypot(dx, dz) || 1;
        tx = dx / l; tz = dz / l;
        const run = stick.run || mag > 0.92;
        want = run && !this.indoors ? JOG : mag >= 0.75 || stick.run ? WALK : WALK * (0.35 + 0.65 * mag / 0.75);
      }
    }
    // accelerate toward the wanted velocity (reach it in about 0.25 s, stop in 0.15 s)
    const wx = tx * want, wz = tz * want;
    let ex = wx - this.vx, ez = wz - this.vz;
    const el = Math.hypot(ex, ez), lim = (want > this.speed ? ACCEL : DECEL) * dt;
    if (el > lim) { ex *= lim / el; ez *= lim / el; }
    this.vx += ex; this.vz += ez;
    // move, then push out of everything, three passes, sliding along walls
    const ox = this.x, oz = this.z;
    let nx = ox + this.vx * dt, nz = oz + this.vz * dt;
    this.lastBlock = '';
    for (let pass = 0; pass < 3; pass++) {
      const q = this.set.query(nx - 1, nz - 1, nx + 1, nz + 1, this.near);
      let moved = false;
      for (const o of q) {
        distTo(o, nx, nz, this.h);
        if (this.h.d < RADIUS) { const k = RADIUS - this.h.d + 1e-4; nx += this.h.nx * k; nz += this.h.nz * k; moved = true; this.lastBlock = o.tag; }
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
      }
      if (!moved) break;
    }
    // never stuck: still inside something after three passes (a corner pinch) means stay put, and if even the old
    // spot is now inside (a gate shut on you, a car parked on you), go to the nearest free cell
    if (this.clearance(nx, nz) < RADIUS - 0.02) {
      if (this.clearance(ox, oz) >= RADIUS - 0.02) { nx = ox; nz = oz; }
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
    if (sp > 0.1 && !this.reducedMotion) this.bobPhase += dt * Math.PI * 2 * (1.7 + 0.3 * sp);
  }
  private turnTo(target: number, k: number) {
    let d = target - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.heading += d * Math.min(1, k);
  }

  /** walk to (x, z) by a path round obstacles; returns the path or null when there's no way */
  goTo(x: number, z: number, goal: { seat?: Seat; spot?: string } | null = null): P2[] | null {
    if (this.seat) this.stand();
    const p = this.grid.path(this.x, this.z, x, z);
    if (!p || p.length < 2) { this.path = null; this.pathGoal = null; return p; }
    this.path = p; this.pathI = 1; this.pathGoal = goal; this.stuckT = 0; this.lastProgress = Infinity;
    return p;
  }
  private arrive() {
    const g = this.pathGoal;
    this.path = null; this.pathGoal = null; this.vx = this.vz = 0;
    if (g?.seat) this.sit(g.seat);
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
    const bob = this.reducedMotion || this.seat ? 0 : 0.015 * Math.sin(this.bobPhase * 2) * Math.min(1, this.speed / WALK);
    return out.set(this.x, this.y + (this.seat ? sitEye : this.eye) + bob, this.z);
  }
  lookDir(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  /** place the camera: first person at the eyes; third person 2.4 m behind, 0.45 m right, 1.75 m up, pulled in by walls */
  camera(cam: THREE.PerspectiveCamera) {
    const eye = this.eyePos(new THREE.Vector3()), dir = this.lookDir(new THREE.Vector3());
    if (this.view === 'first') {
      cam.position.copy(eye);
      cam.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);
      return { dist: 0, hide: true };
    }
    const head = new THREE.Vector3(this.x, this.y + (this.seat ? this.seat.y + 0.62 : this.eye), this.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    // the orbit: back and up by the pitch (looking down raises the camera)
    const back = 2.4, right = 0.45, up = 1.75 - this.eye;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ox = -fx * back * cp + rx * right, oz = -fz * back * cp + rz * right, oy = up - back * sp;
    const want = new THREE.Vector3(head.x + ox, head.y + oy, head.z + oz);
    // pull in so it never goes through a wall (a ray against the tall colliders)
    const t = this.set.ray(head.x, head.z, want.x, want.z, (o) => o.tall);
    const len = Math.hypot(ox, oz), keep = t < 1 ? Math.max(0.25, (t * len - 0.25) / len) : 1;
    const pos = new THREE.Vector3(head.x + ox * keep, Math.max(0.35, head.y + oy * (0.4 + 0.6 * keep)), head.z + oz * keep);
    cam.position.copy(pos);
    // look past your driver at the world (they sit a little left of centre and low in the frame)
    cam.lookAt(head.x + fx * 4 * cp, head.y - 0.35 + sp * 4, head.z + fz * 4 * cp);
    const dist = Math.hypot(pos.x - this.x, pos.z - this.z);
    return { dist, hide: dist < 0.7 };
  }
}

export { STEP };
