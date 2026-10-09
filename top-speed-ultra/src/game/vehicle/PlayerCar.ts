// The player's car: a lofted mid-engine body (our own design), wheels that spin and steer, lights, the cockpit,
// and a sprung body that pitches under acceleration and braking, rolls in corners and buzzes with the engine.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Cockpit, EYE } from './Cockpit';
import { CarPhysics, SPEC } from './Physics';
import { ORIGIN } from '../world/Path';
import { clamp, lerp, smoothstep } from '../util';
import * as T from '../textures';

// body cross-section parameters along the length (z from nose -2.3 to tail +2.3)
function halfW(z: number) {
  const f = Math.exp(-((z + 1.33) ** 2) / 0.35), r = Math.exp(-((z - 1.32) ** 2) / 0.4);
  return lerp(0.8, 0.95, smoothstep(-2.3, -1.6, z)) + 0.045 * f + 0.06 * r - 0.04 * smoothstep(1.9, 2.3, z);
}
function belt(z: number) {
  if (z < -1.17) return lerp(0.48, 0.74, smoothstep(-2.3, -1.4, z)) + 0.05 * Math.exp(-((z + 1.33) ** 2) / 0.25);
  if (z < 0.45) return lerp(0.84, 0.88, smoothstep(-1.17, 0.45, z));
  return lerp(0.9, 0.86, smoothstep(0.45, 2.3, z));
}
function crown(z: number) {
  if (z < -1.17) return lerp(0.55, 0.76, smoothstep(-2.3, -1.17, z));
  return lerp(1.03, 0.93, smoothstep(0.45, 2.25, z));
}

function loft(zs: number[], section: (z: number) => [number, number][]) {
  const rows = zs.map(section), cols = rows[0].length, pos: number[] = [], idx: number[] = [];
  rows.forEach((row, i) => row.forEach(([x, y]) => pos.push(x, y, zs[i])));
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const range = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + (b - a) * (i / (n - 1)));

export class PlayerCar {
  readonly root = new THREE.Group();          // position, heading, the road's grade
  readonly body = new THREE.Group();          // sprung: pitch, roll, heave, vibration
  readonly cockpit = new Cockpit();
  readonly eye = new THREE.Object3D();
  readonly hood = new THREE.Object3D();
  readonly rear = new THREE.Object3D();
  private wheels: { steer: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private tail: THREE.MeshStandardMaterial;
  private sus = { p: 0, pv: 0, r: 0, rv: 0, h: 0, hv: 0 };
  private lastJoint = 0;
  // previous and current physics poses, for interpolation
  private prev = { x: 0, y: 0, z: 0, psi: 0 };
  private cur = { x: 0, y: 0, z: 0, psi: 0 };

  constructor() {
    this.root.rotation.order = 'YXZ';
    this.root.add(this.body);
    this.body.add(this.cockpit.group);
    this.eye.position.copy(EYE); this.body.add(this.eye);
    this.hood.position.set(0, 1.0, -1.45); this.body.add(this.hood);
    this.rear.position.set(0, 1.15, 2.6); this.rear.rotation.y = Math.PI; this.root.add(this.rear);
    const paint = this.cockpit.m.paint;
    paint.clearcoatNormalMap = T.paintPeel(); paint.clearcoatNormalScale = new THREE.Vector2(0.15, 0.15);
    // the shell: sides and floor the whole length, a bonnet in front, an engine deck behind, open over the seats
    const sides = loft(range(-2.3, 2.3, 48), (z) => {
      const w = halfW(z), b = belt(z);
      const half: [number, number][] = [[w * 0.93, b], [w, b - 0.14], [w * 1.01, 0.46], [w * 0.98, 0.28], [w * 0.9, 0.16], [w * 0.45, 0.13], [0, 0.13]];
      // right top, down and under, up to left top (this order makes the faces point outward)
      return [...half.map(([x, y]) => [-x, y] as [number, number]), ...half.slice(0, -1).reverse()].reverse();
    });
    const deck = (z0: number, z1: number) => loft(range(z0, z1, 24), (z) => {
      const w = halfW(z) * 0.93, b = belt(z), c = crown(z);
      const front = z < 0;
      return range(-1, 1, 13).map((u) => {
        const fender = front ? 0.07 * Math.exp(-((Math.abs(u) - 0.78) ** 2) / 0.02) * smoothstep(-2.2, -1.5, z) : 0.05 * Math.exp(-((Math.abs(u) - 0.82) ** 2) / 0.02);
        return [u * w, b + (c - b) * (1 - u * u) * (front ? 0.6 : 1) + fender] as [number, number];
      });
    });
    const shell = new THREE.Group();
    for (const g of [sides, deck(-2.3, -1.17), deck(0.45, 2.3)]) shell.add(new THREE.Mesh(g, paint));
    // nose and tail panels, the bulkhead behind the seats, a black floor
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6, metalness: 0.2 });
    const intake = new RoundedBoxGeometry(1.4, 0.24, 0.06, 3, 0.03); intake.translate(0, 0.36, -2.29); shell.add(new THREE.Mesh(intake, dark));
    const nose = new RoundedBoxGeometry(1.58, 0.36, 0.05, 3, 0.04); nose.translate(0, 0.33, -2.28); shell.add(new THREE.Mesh(nose, paint));
    const tailP = new RoundedBoxGeometry(1.8, 0.62, 0.05, 3, 0.04); tailP.translate(0, 0.56, 2.29); shell.add(new THREE.Mesh(tailP, paint));
    const diffuser = new RoundedBoxGeometry(1.5, 0.2, 0.3, 2, 0.03); diffuser.translate(0, 0.22, 2.2); shell.add(new THREE.Mesh(diffuser, dark));
    for (let i = -2; i <= 2; i++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.28), dark); fin.position.set(i * 0.25, 0.22, 2.22); shell.add(fin); }
    const bulk = new RoundedBoxGeometry(1.86, 0.45, 0.06, 2, 0.02); bulk.translate(0, 0.78, 0.5); shell.add(new THREE.Mesh(bulk, dark));
    for (const s of [-1, 1]) {
      const fin = new RoundedBoxGeometry(0.16, 0.2, 1.6, 3, 0.06); fin.translate(s * 0.72, 1.0, 1.2); shell.add(new THREE.Mesh(fin, paint));
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 20, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3a3c, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
      exhaust.position.set(s * 0.22, 0.34, 2.33); shell.add(exhaust);
      const head = new RoundedBoxGeometry(0.4, 0.045, 0.1, 2, 0.02); head.rotateY(s * 0.35); head.translate(s * 0.62, 0.5, -2.16);   // set into the nose, below the bonnet line
      shell.add(new THREE.Mesh(head, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde6ff, emissiveIntensity: 0.6, roughness: 0.2 })));
      const side = new RoundedBoxGeometry(0.05, 0.16, 0.6, 2, 0.03); side.translate(s * 0.99, 0.62, 0.95); shell.add(new THREE.Mesh(side, dark));   // side intakes
    }
    this.tail = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 1.2, roughness: 0.3 });
    for (const s of [-1, 1]) { const t = new RoundedBoxGeometry(0.56, 0.045, 0.04, 2, 0.015); t.translate(s * 0.5, 0.8, 2.31); shell.add(new THREE.Mesh(t, this.tail)); }
    const third = new RoundedBoxGeometry(0.3, 0.03, 0.03, 2, 0.01); third.translate(0, 0.93, 2.28); shell.add(new THREE.Mesh(third, this.tail));
    const under = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 4.5), dark); under.rotation.x = Math.PI / 2; under.position.y = 0.13; shell.add(under);
    shell.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    this.body.add(shell);
    // wheels: tyre, multi-spoke rim, disc and caliper
    const tyre = new THREE.TorusGeometry(0.268, 0.078, 18, 44); tyre.rotateY(Math.PI / 2);
    const tyreM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.88 });
    const rimM = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.9, roughness: 0.32 });
    const discM = new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 0.8, roughness: 0.45 });
    const calM = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.4 });
    for (const [x, z] of [[-0.85, -1.33], [0.85, -1.33], [-0.87, 1.32], [0.87, 1.32]]) {
      const steer = new THREE.Group(); steer.position.set(x, SPEC.wheelR, z);
      const spin = new THREE.Group(); steer.add(spin);
      spin.add(new THREE.Mesh(tyre, tyreM));
      const out = Math.sign(x);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.2, 32, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide }));
      spin.add(barrel);
      for (let i = 0; i < 10; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.2, 0.03), rimM);
        const a = (i / 10) * Math.PI * 2;
        sp.position.set(out * 0.085, Math.cos(a) * 0.12, Math.sin(a) * 0.12); sp.rotation.x = -a;
        spin.add(sp);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16).rotateZ(Math.PI / 2), rimM); cap.position.x = out * 0.095; spin.add(cap);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 32).rotateZ(Math.PI / 2), discM); disc.position.x = out * 0.02; spin.add(disc);
      const cal = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.13, 0.17, 2, 0.02), calM); cal.position.set(out * 0.04, 0.12, z < 0 ? 0.08 : -0.08); steer.add(cal);
      steer.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
      this.root.add(steer);
      this.wheels.push({ steer, spin, front: z < 0 });
    }
  }

  snapshot(p: CarPhysics) { this.prev.x = this.cur.x; this.prev.y = this.cur.y; this.prev.z = this.cur.z; this.prev.psi = this.cur.psi; this.cur.x = p.x; this.cur.y = p.y; this.cur.z = p.z; this.cur.psi = p.psi; }
  teleport(p: CarPhysics) { this.snapshot(p); this.snapshot(p); }

  // place everything for this frame; alpha blends the last two physics steps
  update(dt: number, alpha: number, p: CarPhysics, braking: boolean, now: number) {
    const x = lerp(this.prev.x, this.cur.x, alpha), z = lerp(this.prev.z, this.cur.z, alpha), y = lerp(this.prev.y, this.cur.y, alpha);
    let dpsi = this.cur.psi - this.prev.psi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
    const psi = this.prev.psi + dpsi * alpha;
    this.root.position.set(x - ORIGIN.x, y, z - ORIGIN.z);
    this.root.rotation.y = psi + Math.PI;
    this.root.rotation.x = Math.atan(p.slope) * Math.cos(psi - p.psi);
    // suspension: springs toward the load transfer, plus expansion joints every 15 m and a little engine buzz
    const s = this.sus, v = Math.abs(p.vx);
    // springs, stepped at 120 Hz whatever the frame rate (a big frame step would make them blow up)
    const n = Math.min(24, Math.max(1, Math.ceil(dt * 120))), h = dt / n;
    const pt = clamp(p.ax * 0.0042, -0.05, 0.045), rt = clamp(-p.ay * 0.0034, -0.045, 0.045);
    for (let i = 0; i < n; i++) {
      s.pv += (95 * (pt - s.p) - 13 * s.pv) * h; s.p += s.pv * h;
      s.rv += (110 * (rt - s.r) - 14 * s.rv) * h; s.r += s.rv * h;
      s.hv += (260 * (0 - s.h) - 18 * s.hv) * h; s.h += s.hv * h;
    }
    s.p = clamp(s.p, -0.08, 0.08); s.r = clamp(s.r, -0.07, 0.07); s.h = clamp(s.h, -0.06, 0.06);
    const joint = Math.floor(p.s / 15);
    if (joint !== this.lastJoint) { this.lastJoint = joint; if (v > 3) { s.hv -= 0.02 + v * 0.0009; s.pv += 0.03 + v * 0.0006; } }
    const buzz = (p.rpm / 8000) * 0.00035 + v * 0.000012;
    this.body.position.set((Math.random() - 0.5) * buzz, s.h + (Math.random() - 0.5) * buzz * 2, 0);
    this.body.rotation.set(s.p + (Math.random() - 0.5) * buzz * 0.6, 0, s.r);
    for (const w of this.wheels) {
      w.spin.rotation.x = -(w.front ? p.wheelRot : p.wheelRotR);
      if (w.front) w.steer.rotation.y = p.delta;
    }
    this.tail.emissiveIntensity = braking ? 5 : 1.2;
    void now;
  }
}
