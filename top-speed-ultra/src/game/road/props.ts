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
  frond: () => once('m.frond', () => new THREE.MeshStandardMaterial({ map: T.frond(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85, vertexColors: true })),
  lampHead: () => once('m.lamphead', () => new THREE.MeshStandardMaterial({ color: 0x3c3f44, metalness: 0.6, roughness: 0.4, emissive: 0x111111 })),
  wire: () => once('m.wire', () => new THREE.LineBasicMaterial({ color: 0x2a2b2e, transparent: true, opacity: 0.85 })),
  signFace: () => once('m.signback', () => new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.6, roughness: 0.5 })),
};

// ---------------------------------------------------------------- trees and plants
// A palm: a tall bare trunk ringed with leaf scars, and a crown of pinnate fronds. Each frond is one card folded
// along its midrib (its halves hang in a V) that arches up from the crown shaft and droops toward the tip: the young
// ones high and upright, the old ones lower and hanging. A few dead fronds hang under the crown, and a short collar
// of old leaf bases joins the crown to the trunk. Both parts are instanced by the terrain; the fronds are cut out of
// the card by the texture's alpha (alphaTest), and three.js's shadow pass applies the same map and alphaTest, so
// they cast frond-shaped shadows.
export const palmTrunk = () => once('g.palmtrunk', () => {
  const g = new THREE.CylinderGeometry(0.2, 0.33, 1, 9, 6, true);
  g.translate(0, 0.5, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 10);
  return g;
});
// detail 1 for High/Ultra (12 live + 5 dead fronds, 382 triangles), 0 for Low/Medium (10 + 4, 222 triangles);
// the old crown was 448 triangles at every tier
export const palmCrown = (detail = 1) => once('g.palmcrown' + detail, () => {
  const parts: THREE.BufferGeometry[] = [], r = rng(7);
  const live = detail ? 12 : 10, dead = detail ? 5 : 4, segs = detail ? 6 : 4, V0 = 1 - 36 / 512;
  // a frond card: lifted `lift` radians at the base, bending down by `bend` along its length (most at the tip), its
  // halves folded down by `fold`. The texture's left half is the live frond, the right one the dead frond, and the
  // cards stop short of the crown-shaft strip across its top. Its vertex colour darkens toward the crown's heart.
  const frond = (w: number, len: number, lift: number, bend: number, fold: number, isDead: boolean, n: number, tint: number[]) => {
    const g = new THREE.PlaneGeometry(w, len, 2, n);
    g.translate(0, len / 2, 0);
    const mid: THREE.Vector3[] = [new THREE.Vector3()], ang: number[] = [lift];
    for (let k = 1; k <= n; k++) {                                         // walk the rachis
      const a = lift - bend * Math.pow(k / n, 1.6);
      mid.push(mid[k - 1].clone().add(new THREE.Vector3(0, Math.sin(a) * len / n, -Math.cos(a) * len / n))); ang.push(a);
    }
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), k = Math.round((p.getY(i) / len) * n), a = ang[k], m = mid[k];
      p.setXYZ(i, x * Math.cos(fold), m.y - Math.abs(x) * Math.sin(fold) * Math.cos(a), m.z - Math.abs(x) * Math.sin(fold) * Math.sin(a));
      uv.setXY(i, (isDead ? 0.5 : 0) + uv.getX(i) * 0.5, uv.getY(i) * V0);
    }
    g.computeVertexNormals();
    const shade = (x: number, y: number, z: number) => 0.55 + 0.45 * Math.min(1, Math.hypot(x, y, z) / 1.8);
    return paint(g.toNonIndexed(), (x, y, z) => { const k = shade(x, y, z); return [tint[0] * k, tint[1] * k, tint[2] * k]; });
  };
  for (let i = 0; i < live; i++) {
    // 0 is an old frond, low and hanging, 1 a young one, high and upright; spread round the crown so they mix
    const age = ((i * 7) % live + r()) / live;
    const g = frond(1.5, 2.9 + r() * 0.9, 0.2 + age * 1.0, 1.2 + (1 - age) * 0.45 + r() * 0.2, 0.55, false, segs,
      [0.78 + r() * 0.14, 0.92 + r() * 0.08, 0.7 + r() * 0.14]);
    g.translate(0, -0.25 + age * 0.45, 0);
    g.rotateY((i / live) * Math.PI * 2 + (r() - 0.5) * 0.35);
    parts.push(g);
  }
  for (let i = 0; i < dead; i++) {                                          // the brown skirt under the crown
    const k = 0.85 + r() * 0.2;
    const g = frond(0.85, 2.4 + r() * 0.5, -0.8 - r() * 0.3, 0.5, 0.4, true, Math.max(3, segs - 2), [k, k * 0.97, k * 0.92]);
    g.translate(0, -0.35, -0.16); g.rotateY((i / dead) * Math.PI * 2 + r() * 0.5);
    parts.push(g);
  }
  // the collar of old leaf bases, a little wider than the trunk's top, from the crown-shaft strip
  const collar = new THREE.CylinderGeometry(0.15, 0.25, 0.85, 7, 1, true).toNonIndexed();
  collar.translate(0, -0.2, 0);
  const cuv = collar.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setY(i, 1 - (cuv.getY(i) > 0.5 ? 3 : 21) / 512);
  parts.push(paint(collar, (_x, y) => { const k = 0.75 + 0.3 * (y + 0.62); return [k, k, k]; }));
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

// ---------------------------------------------------------------- buildings
// The buildings' material: an atlas (T.stucco for the houses, T.facade for the offices) on a MeshStandardMaterial,
// patched so one instanced draw call carries each building's own look. Every vertex's colour says what it is:
// r = 1 on the tinted part (a house's walls, an office's facades), g a baked shade, b = 1 where the instance's choice
// of strip applies (a house's roof row, an office's facade style). Every instance's colour packs (tint.r + 2k,
// tint.g + 2j, tint.b): the tint for the tinted part, k the strip (the UVs move k strips down the atlas), and j one
// of four shades for the rest. The tint shows where the atlas's alpha says (stucco and roofing, curtain glass).
export type Part = [number, number, number];
export const WALL: Part = [1, 1, 0], ROOFING: Part = [0, 1, 1], FACADE_PART: Part = [1, 1, 1], PLAIN: Part = [0, 1, 0], SOFFIT: Part = [1, 0.8, 0];
export function packLook(tint: THREE.Color, k: number, j: number) {
  return new THREE.Color(Math.min(tint.r, 0.999) + 2 * k, Math.min(tint.g, 0.999) + 2 * j, tint.b);
}
export function buildingMat(kind: 'house' | 'office', detail: boolean) {
  return once(`m.${kind}${detail ? 1 : 0}`, () => {
    const a = kind === 'house' ? T.stucco(detail) : T.facade(detail);
    const m = new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap ?? null, roughnessMap: a.roughnessMap ?? null, roughness: a.roughnessMap ? 1 : 0.9, vertexColors: true, envMapIntensity: kind === 'office' ? 1 : 0.6 });
    if (a.normalMap) m.normalScale.set(0.9, 0.9);
    const shift = (kind === 'house' ? T.STUCCO.roofPitch : T.FACADE.pitch) / T.ATLAS_H;
    m.customProgramCacheKey = () => `bld-${kind}-${detail ? 1 : 0}`;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.bShift = { value: shift };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float bShift;\nvarying float vBShade;')
        .replace('#include <color_vertex>', `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  {
    float bK = floor(instanceColor.r * 0.5), bJ = floor(instanceColor.g * 0.5);
    vec3 bTint = vec3(instanceColor.r - 2.0 * bK, instanceColor.g - 2.0 * bJ, instanceColor.b);
    vec3 bShade = bJ < 0.5 ? vec3(1.0) : bJ < 1.5 ? vec3(0.9, 0.86, 0.82) : bJ < 2.5 ? vec3(1.07, 1.04, 1.0) : vec3(0.8, 0.8, 0.83);
    vColor = mix(bShade, bTint, color.r);
    float bS = color.b * bK * bShift;
    #ifdef USE_MAP
      vMapUv.y -= bS;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv.y -= bS;
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv.y -= bS;
    #endif
  }
#endif
  vBShade = color.g;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vBShade;')
        .replace('#include <map_fragment>', `float bMask = 1.0;
#ifdef USE_MAP
  vec4 bTex = texture2D(map, vMapUv);
  diffuseColor.rgb *= bTex.rgb;
  bMask = bTex.a;
#endif`)
        .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vec3(1.0), vColor, bMask) * vBShade;');
    };
    return m;
  });
}

type V3 = [number, number, number];
type UV = [number, number];
// A building's shell, face by face. Every corner carries its atlas coordinate (u in atlas widths, running past 1
// where a strip repeats; y in the atlas's design pixels) and its part (above). Flattened to one non-indexed
// geometry, so every face keeps a flat normal. Faces wind counter-clockwise seen from outside; a footprint's walls
// go front (+z, left to right), right, back, left.
export class Shell {
  private p: number[] = []; private t: number[] = []; private c: number[] = [];
  tri(a: V3, b: V3, c: V3, ua: UV, ub: UV, uc: UV, part: Part) {
    for (const [v, u] of [[a, ua], [b, ub], [c, uc]] as [V3, UV][]) { this.p.push(...v); this.t.push(u[0], 1 - u[1] / T.ATLAS_H); this.c.push(...part); }
  }
  quad(a: V3, b: V3, c: V3, d: V3, ua: UV, ub: UV, uc: UV, ud: UV, part: Part) { this.tri(a, b, c, ua, ub, uc, part); this.tri(a, c, d, ua, uc, ud, part); }
  // a wall from (ax, az) to (bx, bz), y0 up h metres, showing the strip [top, bottom] (design pixels) from u0 metres
  // along it, `per` metres to an atlas width
  wall(ax: number, az: number, bx: number, bz: number, y0: number, h: number, top: number, bottom: number, u0: number, per: number, part: Part) {
    const u1 = u0 + Math.hypot(bx - ax, bz - az);
    this.quad([ax, y0, az], [bx, y0, bz], [bx, y0 + h, bz], [ax, y0 + h, az], [u0 / per, bottom], [u1 / per, bottom], [u1 / per, top], [u0 / per, top], part);
  }
  // a box's four sides and its top, the sides showing [top, bottom] from the strip's bottom up, the top `lid`
  box(cx: number, cz: number, w: number, d: number, y0: number, h: number, side: [number, number], lid: [number, number], per: number, part: Part) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, b = side[1], t = b - (h / per) * 1024;
    for (const [ax, az, bx, bz] of [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]]) this.wall(ax, az, bx, bz, y0, h, Math.max(side[0], t), b, 0, per, part);
    const y = y0 + h;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, lid[1]], [w / per, lid[1]], [w / per, lid[0]], [0, lid[0]], part);
  }
  geometry(name: string) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.t, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); g.name = name;
    return g;
  }
}

// An office block w x d: `floors` storeys of 4 m under a 1 m parapet, each a strip of the facade atlas (the
// instance picks the style), a membrane roof, rooftop units [x, z, w, d, h] and, on a tower, a metal-panel penthouse.
function office(w: number, d: number, floors: number, units: [number, number, number, number, number][], pent?: [number, number, number]) {
  const s = new Shell(), F = T.FACADE, x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2, top = floors * 4 + 1;
  for (const [ax, az, bx, bz] of [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]]) {
    for (let f = 0; f < floors; f++) s.wall(ax, az, bx, bz, f * 4, 4, F.parapet, F.parapet + F.storey, 0, F.wallM, FACADE_PART);
    s.wall(ax, az, bx, bz, floors * 4, 1, 0, F.parapet, 0, F.wallM, FACADE_PART);
  }
  const [ra, rb] = F.roof;
  s.quad([x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0], [0, rb], [w / F.wallM, rb], [w / F.wallM, ra], [0, ra], PLAIN);
  const lid: [number, number] = [ra + 40, ra + 120];
  if (pent) s.box(0, 0, pent[0], pent[1], top, pent[2], [F.penthouse[0], F.penthouse[1]], lid, F.wallM, PLAIN);
  for (const [x, z, uw, ud, uh] of units) s.box(x, z, uw, ud, top + (pent && Math.abs(x) < pent[0] / 2 && Math.abs(z) < pent[1] / 2 ? pent[2] : 0), uh, [F.mech[0], F.mech[1]], lid, F.wallM, PLAIN);
  return s.geometry(`office-${floors}`);
}
// the three office types: a two-storey block, a three-storey one, an eight-storey tower
export const buildings = () => once('g.buildings', () => [
  office(26, 18, 2, [[-5, 2, 3, 2, 1.6], [6, -3, 4, 2.5, 1.8]]),
  office(34, 20, 3, [[-10, 3, 4, 3, 2], [0, -4, 5, 3, 2.2], [9, 4, 3, 2, 1.6]]),
  office(22, 22, 8, [[6.5, 6.5, 3, 2, 1.6], [-6.5, -6.5, 3, 2, 1.6], [0, 1, 4, 3, 1.4]], [9, 9, 3.6]),
]);
