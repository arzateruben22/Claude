// The lot south of the venue (PROJECT_OC_ON_FOOT.md, "Site plan": stalls in four rows on the two mapped aisles,
// entries from Dupont where the mapped driveways are): asphalt, stall lines, wheel stops, a planted median with shade
// trees and light poles, the raised walk along the fence, the parked cars (the game's own fictional traffic models;
// how many follows the simulated crowd) and your car in your stall, the one nearest the lot gate.
import * as THREE from 'three';
import { Kit, rand } from './geom';
import { PLAN } from './coords';
import { Collider, box, circ, boxMM } from './collide';
import { trafficParts, trafficMaterials, TrafficKind } from '../../preview/traffic';
import { buildCar, CarId } from '../../preview/car';
import type { Mats } from './mats';
import type { Tree } from './venue';

export interface Stall { x: number; z: number; face: number; row: number; mine: boolean; ada: boolean }
export interface LotInfo { stalls: Stall[]; colliders: Collider[]; trees: Tree[]; mine: Stall; door: { x: number; z: number } }

const L = PLAN.lot, ROWS: { z0: number; z1: number; face: number }[] = [
  { z0: L.z0, z1: L.z0 + L.stallD, face: 0 },                          // A: noses north, toward the fence
  { z0: L.aisles[0] + L.aisleW / 2, z1: L.aisles[0] + L.aisleW / 2 + L.stallD, face: Math.PI },
  { z0: L.aisles[1] - L.aisleW / 2 - L.stallD, z1: L.aisles[1] - L.aisleW / 2, face: 0 },
  { z0: L.aisles[1] + L.aisleW / 2, z1: L.aisles[1] + L.aisleW / 2 + L.stallD, face: Math.PI },
];
export const MEDIAN = { z0: ROWS[1].z1, z1: ROWS[2].z0 };
export const WALK_GAP = { x0: -6.6, x1: -3.6 };            // a striped walk through row A from the lot gate

export function buildLot(kit: Kit, m: Mats): LotInfo {
  const asphalt = kit.get('lot-asphalt', m.asphalt, { uv: 6, ao: false });
  const mark = kit.get('lot-markings', m.marking, { ao: false });
  const concrete = kit.get('lot-concrete', m.concrete, { uv: 4 });
  const steel = kit.get('lot-steel', m.steel, { cast: true });
  const heads = kit.get('lot-heads', m.lampHead, { glow: false });
  const mulch = kit.get('lot-mulch', m.rubber, { ao: false });
  const plants = kit.get('venue-plants', m.plant, { cast: true });
  const col: Collider[] = [], trees: Tree[] = [], r = rand(3157);
  const westEdge = -52.4, eastEdge = 57.5;
  // the asphalt (subdivided so the lot lights' pools read), and the driveway aprons out to Dupont
  asphalt.grid(westEdge, L.z0, eastEdge, L.z1, 0.02, 0xffffff, 2.0);
  asphalt.grid(eastEdge, L.aisles[0] - L.aisleW / 2, PLAN.dupontEastKerb, L.aisles[0] + L.aisleW / 2, 0.02, 0xffffff, 2.0);
  asphalt.grid(PLAN.dupontWestKerb, L.aisles[1] - L.aisleW / 2, westEdge, L.aisles[1] + L.aisleW / 2, 0.02, 0xffffff, 2.0);
  asphalt.grid(eastEdge, L.aisles[1] - L.aisleW / 2, PLAN.dupontEastKerb, L.aisles[1] + L.aisleW / 2, 0.02, 0xffffff, 2.0);
  // the raised walk along the fence (a 0.15 m kerb onto the lot)
  concrete.slab([[westEdge, (PLAN.lotWalk.z0 + PLAN.lotWalk.z1) / 2], [eastEdge, (PLAN.lotWalk.z0 + PLAN.lotWalk.z1) / 2]], PLAN.lotWalk.z1 - PLAN.lotWalk.z0, 0, 0.15, 0xc6c0b4, 0xa8a297);
  // the stalls
  const stalls: Stall[] = [];
  const W = L.stallW, n = Math.floor((eastEdge - 1 - (westEdge + 1)) / W), x0 = westEdge + 1 + ((eastEdge - 1 - (westEdge + 1)) - n * W) / 2;
  ROWS.forEach((row, ri) => {
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * W;
      mark.box(x, 0.03, (row.z0 + row.z1) / 2, 0.1, 0.005, L.stallD, 0xf2f0e8);
    }
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * W, z = (row.z0 + row.z1) / 2;
      if (ri === 0 && x > WALK_GAP.x0 - 0.2 && x < WALK_GAP.x1 + 0.2) continue;
      const nose = row.face === 0 ? row.z0 + 0.65 : row.z1 - 0.65;
      concrete.box(x, 0.065, nose, 1.8, 0.13, 0.16, 0xd2ccc0);
      stalls.push({ x, z, face: row.face, row: ri, mine: false, ada: false });
    }
  });
  // the striped walk from the gate across row A
  for (let z = ROWS[0].z0 + 0.3; z < ROWS[0].z1; z += 0.6) mark.box((WALK_GAP.x0 + WALK_GAP.x1) / 2, 0.03, z, WALK_GAP.x1 - WALK_GAP.x0 - 0.2, 0.005, 0.3, 0xf2f0e8);
  // two accessible stalls by the walk (blue lines, a hatched aisle)
  const byGap = stalls.filter((s) => s.row === 0).sort((a, b) => Math.abs(a.x - WALK_GAP.x0) - Math.abs(b.x - WALK_GAP.x0));
  for (const s of byGap.slice(0, 1)) {
    s.ada = true;
    for (let z = ROWS[0].z0 + 0.3; z < ROWS[0].z1 - 0.2; z += 0.5) mark.box(s.x, 0.031, z, W - 0.3, 0.005, 0.12, 0x2b5ca8);
  }
  // your stall: the first one east of the walk
  const mine = stalls.filter((s) => s.row === 0 && s.x > WALK_GAP.x1).sort((a, b) => a.x - b.x)[0];
  mine.mine = true;
  // the median: a kerbed planting strip with shrubs, shade trees and the lot's light poles
  const mz0 = MEDIAN.z0 + 0.1, mz1 = MEDIAN.z1 - 0.1, mx0 = westEdge + 1.5, mx1 = eastEdge - 1.5;
  concrete.boxMM(mx0, 0, mz0, mx1, 0.15, mz0 + 0.15, 0xd2ccc0); concrete.boxMM(mx0, 0, mz1 - 0.15, mx1, 0.15, mz1, 0xd2ccc0);
  concrete.boxMM(mx0, 0, mz0, mx0 + 0.15, 0.15, mz1, 0xd2ccc0); concrete.boxMM(mx1 - 0.15, 0, mz0, mx1, 0.15, mz1, 0xd2ccc0);
  mulch.boxMM(mx0 + 0.15, 0.1, mz0 + 0.15, mx1 - 0.15, 0.13, mz1 - 0.15, 0x3e2f24);
  for (let x = mx0 + 1; x < mx1 - 0.5; x += 1.1 + r() * 0.8) {
    const h = 0.35 + r() * 0.35, c = [0x4f6a3a, 0x5d7a44, 0x6a7f4a, 0x47603a][Math.floor(r() * 4)];
    plants.box(x, 0.13 + h / 2, (mz0 + mz1) / 2 + (r() - 0.5) * 0.5, 0.7 + r() * 0.4, h, 0.9, c, r() * 3);
  }
  col.push(boxMM(mx0, mz0, mx1, mz1, 'median', false));
  for (const x of [-38, -13, 12, 37]) {
    concrete.cyl(x, 0.13, (mz0 + mz1) / 2, 0.3, 0.3, 0.5, 10, 0xb9b3a7);
    steel.cyl(x, 0.6, (mz0 + mz1) / 2, 0.11, 0.08, 8.6, 8, 0x5a5e62);
    for (const s of [-1, 1]) {
      const hz = (mz0 + mz1) / 2 + s * 0.95;
      steel.box(x, 9.15, (mz0 + mz1) / 2 + s * 0.5, 0.08, 0.08, 1.0, 0x5a5e62);
      heads.box(x, 9.1, hz, 0.55, 0.12, 0.75, 0xffffff);
      kit.light({ x, y: 9.0, z: hz, i: 110, ch: 1, reach: 34, down: 2.2 });
    }
    col.push(circ(x, (mz0 + mz1) / 2, 0.35, 'pole', true));
  }
  for (const x of [-25.5, 0, 24.5, 49]) trees.push({ x, z: (mz0 + mz1) / 2, y: 0.13, s: 0.85 + r() * 0.15, kind: 'shade' });
  // wall packs on the Shed's south wall and two bollard lights along the walk
  for (const x of [-42, -28]) { heads.box(x, 4.2, PLAN.shed.z1 + 0.22, 0.4, 0.3, 0.18, 0xffffff); kit.light({ x, y: 4.1, z: PLAN.shed.z1 + 0.6, i: 30, ch: 1, reach: 16, down: 1 }); }
  for (const x of [-30, 10, 34]) { steel.cyl(x, 0.15, PLAN.lotWalk.z0 + 0.8, 0.09, 0.09, 1.0, 8, 0x2b2e31); heads.cyl(x, 1.1, PLAN.lotWalk.z0 + 0.8, 0.1, 0.1, 0.12, 8, 0xffffff); kit.light({ x, y: 1.1, z: PLAN.lotWalk.z0 + 0.8, i: 4, ch: 1, reach: 6 }); col.push(circ(x, PLAN.lotWalk.z0 + 0.8, 0.14, 'bollard')); }
  const door = { x: mine.x - 1.25, z: mine.z + 0.6 };
  return { stalls, colliders: col, trees, mine, door };
}

// ------------------------------------------------------------------ parked cars
const KINDS: { kind: TrafficKind; w: number }[] = [{ kind: 'sedan', w: 34 }, { kind: 'suv', w: 30 }, { kind: 'coupe', w: 10 }, { kind: 'pickup', w: 16 }, { kind: 'van', w: 5 }];
const PAINTS = [0xf2f2f0, 0xf2f2f0, 0xe9e9e6, 0x111214, 0x111214, 0x1c1d20, 0x8d9196, 0x8d9196, 0xb5b8bc, 0x5d6168, 0x5d6168, 0x23395f, 0x7f1416, 0xb7a68c, 0x2c4a3a, 0x3f4a59];

/** at most this many parked cars get the detailed model (per kind, the instance buffers are this big) */
const NEAR_CAP = 40;
export class ParkedCars {
  group = new THREE.Group();
  colliders: Collider[] = [];
  count = 0;
  /** detailed models for the nearest cars, a 150-triangle stand-in for the rest */
  near = 0;
  private meshes: { kind: TrafficKind; parts: THREE.InstancedMesh[]; proxy: THREE.InstancedMesh; len: number; wid: number }[] = [];
  private cars: { k: number; m: THREE.Matrix4; c: THREE.Color; x: number; z: number }[] = [];
  private lastX = Infinity; private lastZ = Infinity;
  constructor(private stalls: Stall[], readonly quality: 'phone' | 'high', nearCount: number) {
    this.group.name = 'parked-cars';
    this.near = nearCount;
    const max = stalls.length;
    const proxyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3 });
    for (const { kind } of KINDS) {
      const p = trafficParts(kind, quality, { wheels: true }), mats = trafficMaterials(0xffffff, quality);
      const parts: THREE.InstancedMesh[] = [];
      for (const [geo, mat, name] of [[p.paint, mats.paint, 'paint'], [p.glass, mats.glass, 'glass'], [p.trim, mats.trim, 'trim'], [p.lamps, mats.lamp, 'lamps']] as [THREE.BufferGeometry, THREE.Material, string][]) {
        if (!geo.attributes.position.count) continue;
        const im = new THREE.InstancedMesh(geo, mat, Math.min(max, NEAR_CAP));
        im.name = `parked-${kind}-${name}`; im.count = 0; im.castShadow = name === 'paint' || name === 'trim'; im.receiveShadow = true;
        if (name === 'paint') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.min(max, NEAR_CAP) * 3), 3);
        this.group.add(im); parts.push(im);
      }
      const proxy = new THREE.InstancedMesh(proxyGeometry(p.spec), proxyMat, max);
      proxy.name = `parked-${kind}-far`; proxy.count = 0; proxy.castShadow = true; proxy.receiveShadow = true;
      proxy.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
      this.group.add(proxy);
      this.meshes.push({ kind, parts, proxy, len: p.spec.len, wid: p.spec.wid });
    }
  }
  /** free the instance buffers (the models themselves are the game's, shared) */
  dispose() { this.group.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose(); }); }
  /** fill a share of the stalls (seeded by the day and hour, so a test can reproduce it); your own stall stays yours */
  fill(share: number, seed: number) {
    const r = rand(seed), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    this.colliders.length = 0; this.cars.length = 0;
    const total = KINDS.reduce((s, k) => s + k.w, 0);
    for (const s of this.stalls) {
      if (s.mine) continue;
      // nearer the gate fills first: people park close
      const near = Math.max(0, 1 - Math.hypot(s.x + 5, s.z - 20) / 90);
      if (r() > share * (0.75 + 0.5 * near)) continue;
      let pick = r() * total, ki = 0;
      while (pick > KINDS[ki].w) { pick -= KINDS[ki].w; ki++; }
      const k = this.meshes[ki];
      const face = s.face + (r() - 0.5) * 0.06, dx = (r() - 0.5) * 0.3, dz = (r() - 0.5) * 0.25;
      const back = (L.stallD - k.len) / 2 - 0.2;           // pulled in toward the wheel stop
      const zz = s.z + (s.face === 0 ? -back : back) + dz;
      q.setFromAxisAngle(up, face);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(s.x + dx, 0, zz), q, new THREE.Vector3(1, 1, 1));
      this.cars.push({ k: ki, m, c: new THREE.Color().setHex(PAINTS[Math.floor(r() * PAINTS.length)]), x: s.x + dx, z: zz });
      this.colliders.push(box(s.x + dx, zz, k.wid + 0.1, k.len + 0.1, face, 'car', true, true));
    }
    this.count = this.cars.length;
    this.lastX = Infinity;
  }
  /** detailed models for the cars nearest (x, z); re-sorted when you've moved a few metres */
  update(x: number, z: number, force = false) {
    if (!force && Math.hypot(x - this.lastX, z - this.lastZ) < 3) return;
    this.lastX = x; this.lastZ = z;
    for (const k of this.meshes) { for (const im of k.parts) im.count = 0; k.proxy.count = 0; }
    const order = this.cars.map((c, i) => ({ i, d: Math.hypot(c.x - x, c.z - z) })).sort((a, b) => a.d - b.d);
    order.forEach(({ i }, rank) => {
      const c = this.cars[i], k = this.meshes[c.k];
      if (rank < Math.min(this.near, NEAR_CAP)) for (const im of k.parts) { const j = im.count++; im.setMatrixAt(j, c.m); if (im.instanceColor) im.setColorAt(j, c.c); }
      else { const j = k.proxy.count++; k.proxy.setMatrixAt(j, c.m); k.proxy.setColorAt(j, c.c); }
    });
    for (const k of this.meshes) for (const im of [...k.parts, k.proxy]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  }
}

/** a stand-in for a far parked car: body, glasshouse and wheels in about 150 triangles (vertex colour x paint) */
function proxyGeometry(S: { len: number; wid: number; belt: number; roof: number; r: number; track: number; axles: number[]; ws1: number; bl0: number }) {
  const parts: THREE.BufferGeometry[] = [];
  const tint = (g: THREE.BufferGeometry, v: number) => { const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
  const body = new THREE.BoxGeometry(S.wid, S.belt - S.r * 0.6, S.len * 0.98); body.translate(0, S.r * 0.6 + (S.belt - S.r * 0.6) / 2, 0); parts.push(tint(body, 1));
  const cabL = Math.min(S.len * 0.55, Math.abs(S.bl0 - S.ws1) + 0.4), cab = new THREE.BoxGeometry(S.wid * 0.86, S.roof - S.belt, cabL);
  cab.translate(0, S.belt + (S.roof - S.belt) / 2, (S.ws1 + Math.min(S.bl0, S.len / 2 - 0.3)) / 2); parts.push(tint(cab, 0.06));
  for (const z of S.axles.slice(0, 2)) for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(S.r, S.r, 0.22, 8).rotateZ(Math.PI / 2); w.translate(s * (S.wid / 2 - 0.1), S.r, z); parts.push(tint(w, 0.04)); }
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); col.set(g.attributes.color.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** your own car in your stall, with its paint (the game's car builder) */
export function yourCar(stall: Stall, car: CarId, paint: number | undefined, quality: 'phone' | 'high') {
  const g = buildCar({ car, paint, quality, cabin: 'full' });
  g.position.set(stall.x, 0, stall.z - 0.15);
  g.rotation.y = stall.face;
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.name = 'your-car';
  const collider = box(stall.x, stall.z - 0.15, 2.05, 4.7, stall.face, 'car', true, false);
  return { group: g, collider };
}
