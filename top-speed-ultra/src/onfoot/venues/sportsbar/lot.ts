// The bar's lot (the module map's lot.ts row): the asphalt over the lot S0-data derived, aisle 416 redrawn as ours
// (4.5 m, one-way, 6.0 m out from the front wall in front of the unit), the stall striping and wheel stops along
// aisle 415, the ride-share pick-up box opposite the door, and 6 m pole lights (ours; no lamps are mapped here). The
// parked cars are Lot 57's ParkedCars on the bar's own stalls (local metres, every one facing 0 or pi) and your car is
// Lot 57's yourCar, plus our own 152-triangle stand-in of it, built the way Lot 57's stand-in is built (L5).
import * as THREE from 'three';
import { Kit, P2, offsetLine } from '../../engine/geom';
import { Collider, circ } from '../../engine/collide';
import type { Stall } from '../../engine/lot';
import type { Frame } from '../../engine/frame';
import type { BarMats } from './mats';
import { decodeGame, SliceJson } from './def';
import { AISLE416_TAIL, FRONT, fd } from './layout';

export interface BarLot { colliders: Collider[]; aisle: P2[]; aisleRibbon: P2[]; door: { x: number; z: number }; spawn: { x: number; z: number } }

/** aisle 416 as we draw it (game coordinates): the mapped line round the tip, as far as (-6616.2, -9323.6), then ours */
export function aisle416(slice: SliceJson): P2[] {
  const mapped = decodeGame(slice.seg[416].p);
  const k = mapped.findIndex(([x, z]) => Math.hypot(x + 6616.2, z + 9323.6) < 0.2);
  return [...mapped.slice(0, k + 1), ...AISLE416_TAIL];
}
/** a polyline's ribbon as one ring (left side out, right side back) */
export function ribbonRing(pts: P2[], w: number): P2[] {
  const Lft = offsetLine(pts, w / 2), Rgt = offsetLine(pts, -w / 2);
  return [...Lft, ...Rgt.reverse()];
}

export function buildBarLot(kit: Kit, m: BarMats, F: Frame, slice: SliceJson, lotF: P2[], stalls: Stall[], yours: Stall): BarLot {
  const asphalt = kit.get('lot-asphalt', m.asphalt, { uv: 6, ao: false });
  const mark = kit.get('venue-markings', m.marking, { ao: false });
  const concrete = kit.get('venue-concrete', m.concrete, { uv: 4, cast: true });
  const steel = kit.get('venue-steel', m.steel, { cast: true });
  const heads = kit.get('lot-heads', m.lampHead, { glow: false });
  const col: Collider[] = [];
  const toL = (g: P2): P2 => F.toLocal(g[0], g[1]);
  const lot = lotF.map(([u, v]) => F.fromFrame(u, v));
  // the lot's asphalt (laid a touch under the street ribbons), and aisle 416 as ours
  asphalt.cap(lot, 0.012, 0xffffff);
  const aisle = aisle416(slice).map(toL), ribbon = ribbonRing(aisle, FRONT.aisle.w);
  asphalt.ribbon(aisle, FRONT.aisle.w, 0.016, 0xffffff);
  // one-way arrows down its middle, and the ride-share pick-up box opposite the door (s 6 to 12)
  const box = [fd(FRONT.aisle.d0 + 0.3, FRONT.rideshare.s0), fd(FRONT.aisle.d1 - 0.3, FRONT.rideshare.s0), fd(FRONT.aisle.d1 - 0.3, FRONT.rideshare.s1), fd(FRONT.aisle.d0 + 0.3, FRONT.rideshare.s1)].map(([u, v]) => F.fromFrame(u, v));
  for (let i = 0; i < 4; i++) mark.ribbon([box[i], box[(i + 1) % 4]], 0.12, 0.03, 0xe8e2c8);
  for (let s = FRONT.rideshare.s0 + 0.8; s < FRONT.rideshare.s1 - 0.4; s += 0.9) { const a = F.fromFrame(...fd(FRONT.aisle.d0 + 0.4, s)), b = F.fromFrame(...fd(FRONT.aisle.d1 - 0.4, s + 0.6)); mark.ribbon([a, b], 0.1, 0.03, 0xe8e2c8); }
  for (const t of [0.35, 0.62]) {
    const i = Math.floor(t * (aisle.length - 1)), a = aisle[i], b = aisle[Math.min(aisle.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const ux = dx / l, uz = dz / l, px = -uz, pz = ux, c: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    mark.ribbon([[c[0] - ux * 1.2, c[1] - uz * 1.2], [c[0] + ux * 0.6, c[1] + uz * 0.6]], 0.18, 0.03, 0xf2f0e8);
    mark.ribbon([[c[0] + ux * 1.2, c[1] + uz * 1.2], [c[0] + ux * 0.4 + px * 0.45, c[1] + uz * 0.4 + pz * 0.45]], 0.16, 0.03, 0xf2f0e8);
    mark.ribbon([[c[0] + ux * 1.2, c[1] + uz * 1.2], [c[0] + ux * 0.4 - px * 0.45, c[1] + uz * 0.4 - pz * 0.45]], 0.16, 0.03, 0xf2f0e8);
  }
  // the stalls: lines between them and a wheel stop in each (stalls face 0 or pi, 2.75 m x 5.5 m)
  const W = 2.75, D = 5.5;
  for (const s of stalls) {
    for (const dx of [-W / 2, W / 2]) mark.box(s.x + dx, 0.03, s.z, 0.1, 0.005, D, 0xf2f0e8);
    const nose = s.face === 0 ? s.z - D / 2 + 0.65 : s.z + D / 2 - 0.65;
    concrete.box(s.x, 0.065, nose, 1.8, 0.13, 0.16, 0xd2ccc0);
    if (s.mine) for (let z = s.z - D / 2 + 0.6; z < s.z + D / 2 - 0.4; z += 1.1) mark.box(s.x, 0.031, z, 0.5, 0.005, 0.12, 0xc3f23a);
  }
  // 6 m pole lights round the courtyard and by the front (ours)
  const poles: P2[] = [[-6606.5, -9384.8], [-6619, -9384.8], [-6631.5, -9384.8], [-6644, -9384.8], [-6625, -9360], [-6645, -9369], [-6620.5, -9328.8]];   // the courtyard's 3 m median, the drive along the arm's courtyard wall, and south of the patio
  for (const g of poles) {
    const [x, z] = toL(g);
    concrete.cyl(x, 0, z, 0.24, 0.24, 0.45, 10, 0xb9b3a7);
    steel.cyl(x, 0.45, z, 0.08, 0.06, 5.6, 8, 0x3a3d40, false);
    heads.box(x, 6.1, z, 0.5, 0.12, 0.5, 0xffffff);
    kit.light({ x, y: 6.0, z, i: 110, ch: 1, reach: 26, down: 2.0 });
    col.push(circ(x, z, 0.3, 'pole', true));
  }
  // your car's driver door and the spawn, turned with your stall (the module map's lot.ts row, from L7 and L8)
  const f = yours.face, turn = (a: number, b: number): P2 => [a * Math.cos(f) + b * Math.sin(f), -a * Math.sin(f) + b * Math.cos(f)];
  const cx = yours.x, cz = yours.z - 0.15, [ox, oz] = turn(-1.25, 0.75), [sx, sz] = turn(0, -0.2);
  const door = { x: cx + ox, z: cz + oz }, spawn = { x: door.x + sx, z: door.z + sz };
  return { colliders: col, aisle, aisleRibbon: ribbon, door, spawn };
}

/** our own stand-in for your car: body, glasshouse and wheels in 152 triangles (vertex colour x paint), built the way
 *  Lot 57's private proxyGeometry builds a parked car's (L5) */
export function standInGeometry(len: number, wid: number, belt = 0.85, roof = 1.3, r = 0.33) {
  const parts: THREE.BufferGeometry[] = [];
  const tint = (g: THREE.BufferGeometry, v: number) => { const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(v), 3)); return g.index ? g.toNonIndexed() : g; };
  const body = new THREE.BoxGeometry(wid, belt - r * 0.6, len * 0.98); body.translate(0, r * 0.6 + (belt - r * 0.6) / 2, 0); parts.push(tint(body, 1));
  const cab = new THREE.BoxGeometry(wid * 0.86, roof - belt, len * 0.5); cab.translate(0, belt + (roof - belt) / 2, -len * 0.05); parts.push(tint(cab, 0.06));
  for (const z of [len * 0.33, -len * 0.33]) for (const s of [-1, 1]) { const w = new THREE.CylinderGeometry(r, r, 0.22, 8).rotateZ(Math.PI / 2); w.translate(s * (wid / 2 - 0.1), r, z); parts.push(tint(w, 0.04)); }
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); colr.set(g.attributes.color.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.computeBoundingSphere();
  return g;
}
