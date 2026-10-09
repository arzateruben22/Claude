// Traffic on every freeway carriageway near you, both directions, and on the freeways crossing overhead. Each car
// keeps its lane and a safe gap (the Intelligent Driver Model), signals before it changes lanes and only moves
// when the gap is there (you included, judged by how fast you're closing), gets out of your way now and then,
// and follows its freeway into the next one where it ends in a Y. Cars appear and disappear beyond the haze.
// Deterministic: the same seed and the same driving give the same traffic.

import * as THREE from 'three';
import { Path, ORIGIN } from '../world/Path';
import type { Network } from '../world/Network';
import { buildClasses, wheelGeometry, CarClass, PAINTS } from './carModels';
import { clamp, rng, smoothstep } from '../util';

export interface TrafficCar {
  cls: number; path: Path; s: number; d: number; v: number; v0: number;
  lane: number; from: number; to: number; t: number;   // t: lane change progress, -1 when settled
  sig: number; sigT: number; acc: number; ps: number; pd: number; spin: number;
  decide: number; hitT: number; stopT: number; color: THREE.Color; side: number; touched: number; id: number;
  bold: boolean;                                       // an aggressive driver (Expert traffic)
  x: number; z: number; y: number; h: number;          // world pose, refreshed every step
}
export interface PlayerView {
  path: Path; s: number; d: number; v: number; vd: number; rel: number; len: number; wid: number;
  x: number; z: number; y: number; psi: number; wx: number; wz: number;
}
export interface Contact { car: TrafficCar; speed: number; nx: number; nz: number; depth: number }
export interface PassEvent { car: TrafficCar; clean: boolean; close: boolean; gap: number; rel: number }
export interface TrafficLevel { perKmLane: number; bold: number }

const A = 1.6, B = 3.2;

export class Traffic {
  readonly group = new THREE.Group();
  readonly classes: CarClass[] = buildClasses();
  cars: TrafficCar[] = [];
  private meshes: { body: THREE.InstancedMesh; glass: THREE.InstancedMesh; tail: THREE.InstancedMesh; head: THREE.InstancedMesh; wheels: THREE.InstancedMesh; blink: THREE.InstancedMesh }[] = [];
  private r = rng(91);
  private nextId = 1;
  level: TrafficLevel = { perKmLane: 5, bold: 0 };
  scale = 1;                                           // a temporary thinning (the Clear Path ability)
  pace = 1;                                            // how fast everyone drives (slower in rain and fog)
  viewAhead = 1600;

  constructor(private net: Network, capacity = 320) {
    const wheel = wheelGeometry();
    const blinkGeo = new THREE.BoxGeometry(0.12, 0.08, 0.04);
    const bodyM = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.32, envMapIntensity: 1.1 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0c1016, metalness: 0.85, roughness: 0.06, envMapIntensity: 1.4 });
    const lightM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const wheelM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
    const blinkM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.1, 0.1), toneMapped: false });
    for (const c of this.classes) {
      const cap = c.id === 'semi' || c.id === 'truck' ? Math.ceil(capacity / 3) : capacity;
      const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number, shadow = true) => {
        const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(im); return im;
      };
      const body = mk(c.body, bodyM, cap); body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      const tail = mk(c.tail, lightM, cap, false); tail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      this.meshes.push({ body, glass: mk(c.glass, glassM, cap), tail, head: mk(c.head, lightM, cap, false), wheels: mk(wheel, wheelM, cap * c.wheels.length), blink: mk(blinkGeo, blinkM, cap * 2, false) });
    }
    this.group.name = 'traffic';
  }

  reseed(seed: number) { this.r = rng(seed); this.nextId = 1; this.cars = []; }
  clear() { this.cars = []; }
  private heavy(c: CarClass) { return c.id === 'truck' || c.id === 'semi'; }

  // the freeway carriageways in view, with the stretch of each that's within reach
  private windows(px: number, pz: number) {
    const R = this.viewAhead, out = new Map<Path, [number, number]>();
    for (const h of this.net.near(px, pz, R)) {
      if (!h.path.main) continue;
      const w = Math.sqrt(Math.max(0, R * R - h.dist * h.dist));
      const a = clamp(h.s - w, 0, h.path.len), b = clamp(h.s + w, 0, h.path.len);
      const cur = out.get(h.path);
      out.set(h.path, cur ? [Math.min(cur[0], a), Math.max(cur[1], b)] : [a, b]);
    }
    return out;
  }

  fill(player: PlayerView) {
    this.cars = [];
    for (let k = 0; k < 4; k++) this.topUp(player, true);
  }

  private topUp(player: PlayerView, initial: boolean) {
    const per = this.level.perKmLane * this.scale;
    if (per <= 0) return;
    const counts = new Map<Path, number>();
    for (const c of this.cars) counts.set(c.path, (counts.get(c.path) ?? 0) + 1);
    for (const [p, [a, b]] of this.windows(player.x, player.z)) {
      const want = Math.round(per * p.lanes * (b - a) / 1000);
      let have = counts.get(p) ?? 0, guard = 0;
      while (have < want && guard++ < (initial ? want * 3 : 3)) {
        const s = a + this.r() * (b - a);
        if (this.spawn(p, s, player, initial)) have++;
      }
    }
  }

  private pickClass(p: Path, lane: number) {
    let t = this.r() * this.classes.reduce((a, c) => a + c.weight, 0);
    for (let i = 0; i < this.classes.length; i++) {
      t -= this.classes[i].weight;
      if (t <= 0) return this.heavy(this.classes[i]) && !p.truckLane(lane) ? 0 : i;
    }
    return 0;
  }

  private spawn(p: Path, s: number, player: PlayerView, initial: boolean) {
    const lane = Math.floor(this.r() * p.lanes);
    const at = p.at(s, p.laneCenter(lane));
    const dist = Math.hypot(at.x - player.x, at.z - player.z);
    // never pop in where you'd see it: beyond the haze, or (at the start) anywhere but right in front of you
    if (!initial && dist < this.viewAhead * 0.72 && !(p === player.path && s < player.s - 250)) return false;
    if (p === player.path) {
      if (Math.abs(s - player.s) < 30) return false;
      if (lane === p.laneOf(player.d) && s > player.s && s < player.s + (initial ? 260 : 450)) return false;
    }
    if (dist < 25) return false;
    const cls = this.pickClass(p, lane), c = this.classes[cls];
    for (const o of this.cars) if (o.path === p && (o.lane === lane || o.to === lane) && Math.abs(o.s - s) < (c.len + this.classes[o.cls].len) / 2 + 22) return false;
    const bold = this.r() < this.level.bold;
    const pref = 1.1 - 0.2 * (lane / Math.max(1, p.lanes - 1));      // faster on the left
    const v0 = (c.speed[0] + this.r() * (c.speed[1] - c.speed[0])) * pref * (bold ? 1.18 : 1);
    const d = p.laneCenter(lane);
    const paint = c.fixedColor ? c.fixedColor[Math.floor(this.r() * c.fixedColor.length)] : PAINTS[Math.floor(this.r() * PAINTS.length)];
    this.cars.push({ cls, path: p, s, d, v: v0 * (0.92 + this.r() * 0.08), v0, lane, from: lane, to: lane, t: -1, sig: 0, sigT: 0, acc: 0, ps: s, pd: d,
      spin: this.r() * 6, decide: 2 + this.r() * 6, hitT: 0, stopT: 0, color: new THREE.Color(paint), side: Math.sign(player.s - s) || 1, touched: -99, id: this.nextId++,
      bold, x: at.x, z: at.z, y: at.y, h: at.h });
    return true;
  }

  // AI at the physics rate. Returns cars you just passed.
  step(dt: number, player: PlayerView, time: number): PassEvent[] {
    const passes: PassEvent[] = [];
    this.topUp(player, false);
    const R = this.viewAhead * 1.25;
    // off the end of a freeway: on into the next one if it carries on, otherwise gone
    for (const c of this.cars) {
      if (c.s <= c.path.len) continue;
      const nx = c.path.next;
      const j = c.path.out.find((o) => o.to === nx && o.s >= c.path.len - 1);
      if (nx && nx.main && j) {
        const over = c.s - c.path.len;
        c.path = nx; c.s = c.ps = j.toS + over;
        c.lane = c.from = c.to = Math.min(c.lane, nx.lanes - 1); c.t = -1; c.sig = 0;
        c.d = c.pd = nx.laneCenter(c.lane);
      } else c.v = -1;
    }
    this.cars = this.cars.filter((c) => c.v >= 0 && Math.hypot(c.x - player.x, c.z - player.z) < R);
    // each carriageway is its own queue
    const byPath = new Map<Path, TrafficCar[]>();
    for (const c of this.cars) { let a = byPath.get(c.path); if (!a) byPath.set(c.path, (a = [])); a.push(c); }
    const pOn = player.path;
    const pLane = pOn.laneOf(player.d);
    for (const [path, list] of byPath) {
      list.sort((a, b) => a.s - b.s);
      const playerHere = path === pOn && player.d > path.paveL - 1 && player.d < path.paveR + 1;
      for (let i = 0; i < list.length; i++) {
        const c = list[i], cl = this.classes[c.cls];
        c.ps = c.s; c.pd = c.d;
        let gap = 1e9, vl = 0;
        for (let j = i + 1; j < list.length; j++) {
          const o = list[j];
          if (!(o.lane === c.lane || o.to === c.lane || o.lane === c.to || o.to === c.to)) continue;
          gap = o.s - c.s - (this.classes[o.cls].len + cl.len) / 2; vl = o.v; break;
        }
        if (playerHere) {
          const pd = player.s - c.s;
          const inLane = Math.abs(player.d - path.laneCenter(c.lane)) < 2.3 || (c.t >= 0 && Math.abs(player.d - path.laneCenter(c.to)) < 2.3);
          if (pd > 0 && inLane) { const g = pd - (player.len + cl.len) / 2; if (g < gap) { gap = g; vl = player.v; } }
        }
        if (c.stopT > 0) c.stopT -= dt;
        const v0 = c.stopT > 0 ? 0 : c.v0 * this.pace;
        const s0 = c.bold ? 2 : 3, th = c.bold ? 0.85 : 1.25;
        const sStar = s0 + c.v * th + (c.v * (c.v - vl)) / (2 * Math.sqrt(A * B));
        let acc = A * (1 - Math.pow(c.v / Math.max(1, v0), 4)) - (gap < 1e8 ? A * Math.pow(Math.max(sStar, 0) / Math.max(gap, 0.5), 2) : 0);
        acc = clamp(acc, -9, A * (c.bold ? 1.4 : 1));
        if (c.stopT > 0) acc = Math.min(acc, -4);
        c.acc = acc;
        c.v = Math.max(0, c.v + acc * dt);
        c.s += c.v * dt;
        c.spin += (c.v / cl.wheelR) * dt;
        // lane changes: signal first, then a 3 s move (bold drivers: shorter signal, quicker move)
        if (c.t >= 0) {
          if (c.sigT > 0) c.sigT -= dt;
          else {
            c.t += dt / (c.bold ? 2.0 : 3.0);
            c.d = path.laneCenter(c.from) + (path.laneCenter(c.to) - path.laneCenter(c.from)) * smoothstep(0, 1, c.t);
            if (c.t >= 1) { c.lane = c.to; c.from = c.to; c.t = -1; c.sig = 0; c.d = path.laneCenter(c.lane); }
          }
        } else if (c.stopT <= 0) {
          c.decide -= dt;
          const behind = playerHere && pLane === c.lane && player.s < c.s && c.s - player.s < 140 && player.v > c.v + 8;
          if (c.decide <= 0 || (behind && c.decide < 1.5 && c.lane < path.lanes - 1)) {
            c.decide = (c.bold ? 1.5 : 3) + this.r() * (c.bold ? 3 : 6);
            const slow = gap < 70 && vl < c.v0 - 2;
            const options: number[] = [];
            if (behind && !c.bold && this.r() < 0.7) options.push(c.lane + 1);
            if (slow) options.push(c.lane - 1, c.lane + 1);
            else if (this.r() < (c.bold ? 0.35 : 0.12)) options.push(c.lane + (this.r() < 0.5 ? -1 : 1));
            for (const to of options) {
              if (to < 0 || to >= path.lanes) continue;
              if (this.heavy(cl) && !path.truckLane(to)) continue;
              if (this.safe(c, to, list, player, playerHere)) { c.from = c.lane; c.to = to; c.t = 0; c.sig = to > c.lane ? 1 : -1; c.sigT = c.bold ? 0.5 : 1.3; break; }
            }
          }
        }
        if (c.hitT > 0) c.hitT -= dt;
        // did you just pass it?
        if (playerHere) {
          const side = Math.sign(player.s - c.s) || c.side;
          if (side !== c.side) {
            const lat = Math.abs(player.d - c.d) - (cl.wid + player.wid) / 2;
            if (side > 0 && Math.abs(player.d - c.d) < 7.5) passes.push({ car: c, clean: time - c.touched > 4, close: lat < 0.9, gap: lat, rel: player.v - c.v });
            c.side = side;
          }
        } else c.side = Math.sign(player.s - c.s) || c.side;
        const at = path.at(Math.min(c.s, path.len), c.d, AT);
        c.x = at.x; c.z = at.z; c.y = at.y;
        const vd = (c.d - c.pd) / dt;
        c.h = at.h - Math.atan2(vd, Math.max(c.v, 3));
      }
    }
    return passes;
  }

  private safe(c: TrafficCar, to: number, list: TrafficCar[], player: PlayerView, playerHere: boolean) {
    const cl = this.classes[c.cls];
    const k = c.bold ? 0.55 : 1;
    for (const o of list) {
      if (o === c || !(o.lane === to || o.to === to)) continue;
      const ahead = o.s - c.s, half = (this.classes[o.cls].len + cl.len) / 2;
      if (ahead > 0 && ahead - half < Math.max(12, c.v * 0.9) * k) return false;
      if (ahead <= 0 && -ahead - half < Math.max(10, (o.v - c.v) * 3.5 + 8) * k) return false;
    }
    if (playerHere && Math.abs(player.d - c.path.laneCenter(to)) < 3.2) {
      const ahead = player.s - c.s, half = (player.len + cl.len) / 2;
      if (ahead > 0 && ahead - half < Math.max(15, c.v) * k) return false;
      if (ahead <= 0 && -ahead - half < Math.max(25, (player.v - c.v) * 4 + 15) * (c.bold ? 0.4 : 1)) return false;
    }
    return true;
  }

  // you against the traffic: two oriented boxes in the world (separating axes), on any road, at your height
  collide(player: PlayerView): Contact[] {
    const out: Contact[] = [];
    const pf = [Math.sin(player.psi), Math.cos(player.psi)], pr = [-Math.cos(player.psi), Math.sin(player.psi)];
    const hl = player.len / 2, hw = player.wid / 2;
    for (const c of this.cars) {
      const dx = c.x - player.x, dz = c.z - player.z;
      if (Math.abs(dx) > 25 || Math.abs(dz) > 25 || Math.abs(c.y - player.y) > 2.5) continue;
      const cl = this.classes[c.cls];
      const cf = [Math.sin(c.h), Math.cos(c.h)], cr = [-Math.cos(c.h), Math.sin(c.h)];
      const cl2 = cl.len / 2, cw = cl.wid / 2;
      let best = 1e9, nX = 0, nZ = 0, separated = false;
      for (const ax of [pf, pr, cf, cr]) {
        const proj = (f: number[], r: number[], l: number, w: number) => l * Math.abs(f[0] * ax[0] + f[1] * ax[1]) + w * Math.abs(r[0] * ax[0] + r[1] * ax[1]);
        const pa = proj(pf, pr, hl, hw), ca = proj(cf, cr, cl2, cw);
        const dist = dx * ax[0] + dz * ax[1];
        const over = pa + ca - Math.abs(dist);
        if (over <= 0) { separated = true; break; }
        if (over < best) { best = over; const sg = dist > 0 ? -1 : 1; nX = ax[0] * sg; nZ = ax[1] * sg; }
      }
      if (separated) continue;
      // closing speed along the push direction (n points from the car toward you)
      const cvx = Math.sin(c.h) * c.v, cvz = Math.cos(c.h) * c.v;
      const vrel = -((player.wx - cvx) * nX + (player.wz - cvz) * nZ);
      out.push({ car: c, speed: Math.max(0, vrel), nx: nX, nz: nZ, depth: best });
    }
    return out;
  }

  bump(c: TrafficCar, dv: number, time: number) {
    c.v = Math.max(0, c.v + dv);
    c.hitT = 3; c.touched = time;
    if (Math.abs(dv) > 4) c.stopT = 8;
  }

  // Clear Path: cars ahead of you in your lane move over, where the gap allows (nobody teleports)
  makeWay(player: PlayerView, range = 320) {
    const p = player.path, lane = p.laneOf(player.d);
    const list = this.cars.filter((c) => c.path === p).sort((a, b) => a.s - b.s);
    for (const c of list) {
      if (c.s < player.s || c.s > player.s + range || c.t >= 0 || c.lane !== lane) continue;
      const cl = this.classes[c.cls];
      for (const to of [lane + 1, lane - 1]) {
        if (to < 0 || to >= p.lanes || (this.heavy(cl) && !p.truckLane(to))) continue;
        if (this.safe(c, to, list, player, false)) { c.from = c.lane; c.to = to; c.t = 0; c.sig = to > c.lane ? 1 : -1; c.sigT = 0.4; break; }
      }
    }
  }

  // clear the space you're about to be put back into
  clearAround(x: number, z: number, r = 70) { this.cars = this.cars.filter((c) => Math.hypot(c.x - x, c.z - z) > r); }
  // thin the traffic out of sight (Clear Path): drop a share of the cars you can't see right now
  thin(fraction: number, player: PlayerView, camFwdX: number, camFwdZ: number) {
    this.cars = this.cars.filter((c) => {
      const dx = c.x - player.x, dz = c.z - player.z, dist = Math.hypot(dx, dz);
      const inView = dist < 40 || (dist < this.viewAhead * 0.8 && (dx * camFwdX + dz * camFwdZ) / Math.max(1, dist) > 0.35);
      return inView || this.r() > fraction;
    });
  }

  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p3 = new THREE.Vector3(); private sc = new THREE.Vector3(1, 1, 1); private w4 = new THREE.Matrix4(); private wq = new THREE.Quaternion();

  render(alpha: number, time: number) {
    const counts = this.meshes.map(() => 0);
    const blinkOn = Math.floor(time * 2.6) % 2 === 0;
    for (const c of this.cars) {
      const cl = this.classes[c.cls], m = this.meshes[c.cls];
      if (counts[c.cls] >= m.body.instanceMatrix.count) continue;
      const i = counts[c.cls]++;
      const s = c.ps + (c.s - c.ps) * alpha, d = c.pd + (c.d - c.pd) * alpha;
      const at = c.path.at(Math.min(s, c.path.len), d, AT);
      const slope = c.path.sample(Math.min(s, c.path.len), SP).slope;
      const yaw = c.h - at.h;
      this.e.set(Math.atan(slope), at.h + Math.PI + yaw, 0);
      this.q.setFromEuler(this.e);
      this.p3.set(at.x - ORIGIN.x, at.y, at.z - ORIGIN.z);
      this.m4.compose(this.p3, this.q, this.sc);
      m.body.setMatrixAt(i, this.m4); m.glass.setMatrixAt(i, this.m4); m.tail.setMatrixAt(i, this.m4); m.head.setMatrixAt(i, this.m4);
      m.body.setColorAt(i, c.color);
      const brake = c.acc < -0.9 || c.stopT > 0 ? 3.2 : 1;
      m.tail.instanceColor!.setXYZ(i, brake, brake, brake);
      cl.wheels.forEach(([x, y, z], w) => {
        this.wq.setFromAxisAngle(X_AXIS, -c.spin);
        this.w4.compose(V.set(x, y, z), this.wq, S.set(1, cl.wheelR, cl.wheelR));
        m.wheels.setMatrixAt(i * cl.wheels.length + w, this.w4.premultiply(this.m4));
      });
      const hazards = c.stopT > 0;
      for (let k = 0; k < 2; k++) {
        const on = blinkOn && (hazards || (c.sig !== 0 && (k === 0 ? c.sig < 0 : c.sig > 0)));
        const [x, y, z] = cl.blink[k];
        this.w4.compose(V.set(x, y, z), IDQ, on ? ONE : ZERO);
        m.blink.setMatrixAt(i * 2 + k, this.w4.premultiply(this.m4));
      }
    }
    this.meshes.forEach((m, k) => {
      const n = counts[k], cl = this.classes[k];
      m.body.count = m.glass.count = m.tail.count = m.head.count = n;
      m.wheels.count = n * cl.wheels.length; m.blink.count = n * 2;
      for (const im of [m.body, m.glass, m.tail, m.head, m.wheels, m.blink]) im.instanceMatrix.needsUpdate = true;
      if (m.body.instanceColor) m.body.instanceColor.needsUpdate = true;
      if (m.tail.instanceColor) m.tail.instanceColor.needsUpdate = true;
    });
  }
}
const AT = { x: 0, y: 0, z: 0, h: 0 };
const SP = { x: 0, y: 0, z: 0, h: 0, k: 0, slope: 0 };
const X_AXIS = new THREE.Vector3(1, 0, 0), V = new THREE.Vector3(), S = new THREE.Vector3(), IDQ = new THREE.Quaternion();
const ONE = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Vector3(0, 0, 0);
