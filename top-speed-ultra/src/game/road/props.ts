// Shared scenery geometry and materials: built once, instanced by every chunk.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from '../textures';
import { rng, noise2 } from '../util';

const memo = new Map<string, unknown>();
function once<V>(key: string, make: () => V): V { if (!memo.has(key)) memo.set(key, make()); return memo.get(key) as V; }

function paint(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => [number, number, number]) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function lumpy(radius: number, detail: number, seed: number, amount: number) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + (noise2(x * 1.3 + seed, z * 1.3 + y, seed) - 0.5) * amount;
    p.setXYZ(i, x * n, y * n * 0.92, z * n);
  }
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- materials
export const mats = {
  concrete: () => once('m.concrete', () => { const t = T.concrete(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.92, color: 0xd8d4cc }); }),
  darkConcrete: () => once('m.dconcrete', () => { const t = T.concrete(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95, color: 0x8f8a82 }); }),
  metal: () => once('m.metal', () => new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.85, roughness: 0.42 })),
  darkMetal: () => once('m.dmetal', () => new THREE.MeshStandardMaterial({ color: 0x55595f, metalness: 0.7, roughness: 0.5 })),
  wood: () => once('m.wood', () => new THREE.MeshStandardMaterial({ color: 0x5e4a38, roughness: 0.95 })),
  foliage: () => once('m.foliage', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.35 })),
  bark: () => once('m.bark', () => new THREE.MeshStandardMaterial({ map: T.bark(), roughness: 0.95 })),
  trunk: () => once('m.trunk', () => new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 })),
  frond: () => once('m.frond', () => new THREE.MeshStandardMaterial({ map: T.frond(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, vertexColors: true })),
  lampHead: () => once('m.lamphead', () => new THREE.MeshStandardMaterial({ color: 0x3c3f44, metalness: 0.6, roughness: 0.4, emissive: 0x111111 })),
  wire: () => once('m.wire', () => new THREE.LineBasicMaterial({ color: 0x2a2b2e, transparent: true, opacity: 0.85 })),
  facade: (k: 0 | 1 | 2) => once('m.facade' + k, () => new THREE.MeshStandardMaterial({ map: T.facade(k), roughness: k === 2 ? 0.25 : 0.85, metalness: k === 2 ? 0.4 : 0 })),
  roof: () => once('m.roof', () => new THREE.MeshStandardMaterial({ color: 0x8b8680, roughness: 0.95 })),
  signFace: () => once('m.signback', () => new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.6, roughness: 0.5 })),
};

// ---------------------------------------------------------------- trees and plants
// Washingtonia fan palm: tall bare trunk and a tight crown, with a skirt of dead fronds
export const palmTrunk = () => once('g.palmtrunk', () => {
  const g = new THREE.CylinderGeometry(0.2, 0.33, 1, 9, 6, true);
  g.translate(0, 0.5, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 12);
  return g;
});
export const palmCrown = () => once('g.palmcrown', () => {
  const parts: THREE.BufferGeometry[] = [], r = rng(7);
  const frondGeo = (len: number, droop: number, dead: boolean) => {
    const g = new THREE.PlaneGeometry(1.5, len, 1, 8);
    g.translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {                      // arc it over
      const y = p.getY(i), t = y / len;
      p.setXYZ(i, p.getX(i), y * Math.cos(t * droop), -y * Math.sin(t * droop) * 0.9);
    }
    g.computeVertexNormals();
    return paint(g, () => (dead ? [0.55, 0.42, 0.28] : [0.9 + r() * 0.15, 1, 0.85]));
  };
  for (let i = 0; i < 18; i++) {
    const g = frondGeo(2.6 + r() * 0.8, 1.2 + r() * 0.9, false);
    g.rotateX(-0.5 + r() * 0.6); g.rotateY((i / 18) * Math.PI * 2 + r() * 0.3);
    parts.push(g);
  }
  for (let i = 0; i < 10; i++) {                             // the brown skirt hanging under the crown
    const g = frondGeo(2.2, 2.6, true);
    g.rotateX(0.2); g.rotateY((i / 10) * Math.PI * 2);
    g.translate(0, -0.6, 0);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
});
// detail 3 for High/Ultra (about 1,600 triangles), 1 for phones (about 400)
export const treeCanopy = (detail = 3) => once('g.canopy' + detail, () => {
  const r = rng(13), parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const g = lumpy(1.6 + r() * 0.9, detail, i * 7, 0.6);
    g.translate((r() - 0.5) * 2.6, 4.6 + r() * 1.8, (r() - 0.5) * 2.6);
    parts.push(g);
  }
  const g = mergeGeometries(parts)!;
  return paint(g, (x, y, z) => { const n = noise2(x * 0.8, z * 0.8 + y, 3); const k = 0.55 + 0.5 * n; return [0.1 * k, 0.2 * k + y * 0.004, 0.07 * k]; });
});
export const treeTrunk = () => once('g.trunk', () => { const g = new THREE.CylinderGeometry(0.18, 0.3, 4.6, 7); g.translate(0, 2.3, 0); return g; });
export const cypress = () => once('g.cypress', () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.95 * Math.sin(Math.pow(t, 0.7) * Math.PI) * (1 - t * 0.35) + 0.05, t * 12)); }
  const g = new THREE.LatheGeometry(pts, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (noise2(y * 1.5, Math.atan2(z, x) * 2, 9) - 0.5) * 0.35; p.setXYZ(i, x * n, y, z * n); }
  g.computeVertexNormals();
  return paint(g, (_x, y) => [0.06 + y * 0.003, 0.13 + y * 0.004, 0.07]);
});
export const shrub = () => once('g.shrub', () => {
  const g = lumpy(1, 1, 5, 0.6); g.scale(1.4, 0.9, 1.4); g.translate(0, 0.7, 0);
  const r = rng(17);
  return paint(g, () => (r() < 0.1 ? [0.78, 0.3, 0.48] : [0.1 + r() * 0.04, 0.2 + r() * 0.06, 0.08]));   // oleander in flower
});

// ---------------------------------------------------------------- freeway hardware
export const lightPole = () => once('g.lightpole', () => {
  const parts: THREE.BufferGeometry[] = [];
  const pole = new THREE.CylinderGeometry(0.1, 0.18, 12, 8); pole.translate(0, 6, 0); parts.push(pole);
  for (const s of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.06, 0.07, 3.2, 6); arm.rotateZ(Math.PI / 2 - 0.12 * s); arm.translate(s * 1.55, 12.2, 0); parts.push(arm);
  }
  return mergeGeometries(parts)!;
});
export const lampHeads = () => once('g.lampheads', () => {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) { const h = new THREE.BoxGeometry(0.85, 0.16, 0.38); h.translate(s * 3.1, 12.35, 0); parts.push(h); }
  return mergeGeometries(parts)!;
});
// a roadside standard: the arm reaches back over the lanes (local +x)
export const lightPoleSingle = () => once('g.lightpole1', () => {
  const pole = new THREE.CylinderGeometry(0.1, 0.18, 11.5, 8); pole.translate(0, 5.75, 0);
  const arm = new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6); arm.rotateZ(Math.PI / 2 - 0.1); arm.translate(1.65, 11.7, 0);
  return mergeGeometries([pole, arm])!;
});
export const lampHeadSingle = () => once('g.lamphead1', () => { const h = new THREE.BoxGeometry(0.9, 0.17, 0.4); h.translate(3.45, 11.9, 0); return h; });
export const powerPole = () => once('g.powerpole', () => {
  const pole = new THREE.CylinderGeometry(0.14, 0.2, 13, 7); pole.translate(0, 6.5, 0);
  const arm = new THREE.BoxGeometry(2.6, 0.14, 0.14); arm.translate(0, 12.2, 0);
  const brace = new THREE.BoxGeometry(1.2, 0.08, 0.08); brace.rotateZ(0.6); brace.translate(0.5, 11.9, 0);
  return mergeGeometries([pole, arm, brace])!;
});

// buildings: box with per-face UVs so one window cell is ~3.6 m whatever the size
export function building(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv, cell = 3.6;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];          // +x -x +y -y +z -z faces, 4 vertices each
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / (cell * 2), uv.getY(i) * dims[f][1] / (cell * 2));
  }
  return g;
}
export const buildings = () => once('g.buildings', () => [building(26, 9, 18), building(34, 15, 20), building(22, 36, 22)]);
