// Geometry kit for the car: parts are built as separate geometries, filed under a material key, and merged into one
// mesh per material at the end (that is what keeps the cockpit and the car inside their draw-call budgets).
// Every merged geometry carries position, normal, uv (in metres unless a part says otherwise) and 'ao', a baked
// ambient-occlusion term that patched materials apply to their image-based (indirect) light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = THREE.Vector3;
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// a smooth curve through keyed values (Catmull-Rom, clamped ends); keys sorted by x
export function curve(keys: [number, number][]) {
  const xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]), n = keys.length;
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
    const y0 = ys[Math.max(0, i - 1)], y1 = ys[i], y2 = ys[i + 1], y3 = ys[Math.min(n - 1, i + 2)];
    const x0 = xs[Math.max(0, i - 1)], x1 = xs[i], x2 = xs[i + 1], x3 = xs[Math.min(n - 1, i + 2)];
    // tangents scaled for uneven spacing
    const m1 = (y2 - y0) / Math.max(1e-6, x2 - x0) * (x2 - x1), m2 = (y3 - y1) / Math.max(1e-6, x3 - x1) * (x2 - x1);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * y2 + (t3 - t2) * m2;
  };
}

// ------------------------------------------------------------------------------------------------ surfaces
// a surface from a grid of points rows[i][j] (i along v, j along u). UVs are arc lengths in metres / scale.
// Faces point along (d/du x d/dv); pass flip to turn them round.
export function gridGeo(rows: V3[][], o: { flip?: boolean; uScale?: number; vScale?: number; closeU?: boolean } = {}) {
  const ni = rows.length, nj = rows[0].length + (o.closeU ? 1 : 0);
  const pos = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2), idx: number[] = [];
  const us = o.uScale ?? 1, vs = o.vScale ?? 1;
  const vAcc = new Float32Array(nj);
  for (let i = 0; i < ni; i++) {
    let ua = 0;
    for (let j = 0; j < nj; j++) {
      const p = rows[i][j % rows[i].length];
      if (j > 0) ua += p.distanceTo(rows[i][(j - 1) % rows[i].length]);
      if (i > 0) vAcc[j] += p.distanceTo(rows[i - 1][j % rows[i - 1].length]);
      const k = i * nj + j;
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      uv[k * 2] = ua / us; uv[k * 2 + 1] = vAcc[j] / vs;
    }
  }
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const a = i * nj + j, b = a + 1, c = a + nj, d = c + 1;
    if (o.flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// sweep an elliptical section along a path; N and B are the section's axes at each point (a along N, b along B).
// UVs: u around (0..1 * around), v along in metres / vScale.
export function sweepGeo(path: V3[], N: V3[], B: V3[], a: (i: number) => number, b: (i: number) => number, segs = 12, o: { vScale?: number; around?: number; th0?: number; th1?: number; flip?: boolean } = {}) {
  const rows: V3[][] = [];
  const th0 = o.th0 ?? 0, th1 = o.th1 ?? Math.PI * 2, full = Math.abs(th1 - th0 - Math.PI * 2) < 1e-6;
  for (let i = 0; i < path.length; i++) {
    const row: V3[] = [];
    for (let j = 0; j <= segs; j++) {
      const th = th0 + (th1 - th0) * (j / segs), ca = Math.cos(th) * a(i), sb = Math.sin(th) * b(i);
      row.push(path[i].clone().addScaledVector(N[i], ca).addScaledVector(B[i], sb));
    }
    rows.push(row);
  }
  const g = gridGeo(rows, { vScale: o.vScale ?? 1, flip: !o.flip });
  // u around as a fraction, so a texture can wrap exactly
  const uv = g.attributes.uv as THREE.BufferAttribute, nj = segs + 1;
  for (let i = 0; i < path.length; i++) for (let j = 0; j < nj; j++) uv.setX(i * nj + j, (j / segs) * (o.around ?? 1));
  if (full) weldSeam(g, path.length, nj);
  return g;
}
// average the normals across a closed seam (first and last column)
function weldSeam(g: THREE.BufferGeometry, ni: number, nj: number) {
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < ni; i++) {
    const a = i * nj, b = a + nj - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
}
// tube along a polyline with parallel-transport frames
export function tubeGeo(path: V3[], r: (i: number) => number, segs = 8, o: { vScale?: number; rb?: (i: number) => number; up?: V3 } = {}) {
  const N: V3[] = [], B: V3[] = [];
  let prevN = (o.up ?? v3(0, 1, 0)).clone();
  for (let i = 0; i < path.length; i++) {
    const t = path[Math.min(path.length - 1, i + 1)].clone().sub(path[Math.max(0, i - 1)]).normalize();
    const n = prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize();
    if (n.lengthSq() < 0.5) n.set(1, 0, 0);
    N.push(n); B.push(t.clone().cross(n).normalize()); prevN = n;
  }
  return sweepGeo(path, N, B, r, o.rb ?? r, segs, { vScale: o.vScale });
}

// revolve a profile [radius, along-axis][] round an axis ('x' | 'y' | 'z'). u = angle fraction * uRepeat (so a
// streaky texture along u reads as concentric machining), v = profile length / vScale.
export function latheGeo(profile: [number, number][], segs: number, axis: 'x' | 'y' | 'z' = 'z', o: { uRepeat?: number; vScale?: number; a0?: number; a1?: number; flip?: boolean } = {}) {
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2;
  const rows: V3[][] = [];
  for (const [r, h] of profile) {
    const row: V3[] = [];
    for (let j = 0; j <= segs; j++) {
      const a = a0 + (a1 - a0) * (j / segs), c = Math.cos(a) * r, s = Math.sin(a) * r;
      row.push(axis === 'z' ? v3(c, s, h) : axis === 'x' ? v3(h, c, s) : v3(s, h, c));
    }
    rows.push(row);
  }
  const g = gridGeo(rows, { vScale: o.vScale ?? 1, flip: !o.flip });
  const uv = g.attributes.uv as THREE.BufferAttribute, nj = segs + 1;
  for (let i = 0; i < profile.length; i++) for (let j = 0; j < nj; j++) uv.setX(i * nj + j, (j / segs) * (o.uRepeat ?? 1));
  if (Math.abs(a1 - a0 - Math.PI * 2) < 1e-6) weldSeam(g, profile.length, nj);
  return g;
}

// an extruded 2D shape (in its own x, y), depth along +z from 0, with a small bevel
export function extrude(shape: THREE.Shape, depth: number, bevel = 0.002, curveSegs = 12) {
  return new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: bevel > 0 ? 2 : 0, curveSegments: curveSegs }).translate(0, 0, bevel);
}
export function roundRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// a convex polygon with rounded corners
export function roundPoly(pts: [number, number][], r: number) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), rr = Math.min(r, da * 0.45, db * 0.45);
    const p0: [number, number] = [p[0] + (a[0] - p[0]) / da * rr, p[1] + (a[1] - p[1]) / da * rr];
    const p1: [number, number] = [p[0] + (b[0] - p[0]) / db * rr, p[1] + (b[1] - p[1]) / db * rr];
    if (i === 0) s.moveTo(p0[0], p0[1]); else s.lineTo(p0[0], p0[1]);
    s.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
  }
  s.closePath();
  return s;
}

// a flat face (z = 0, facing +z) from an outline with holes, triangulated with a grid of interior points so it
// bends smoothly when warped. UVs are x, y in metres.
export function capGeo(outline: THREE.Vector2[], holes: THREE.Vector2[][], spacing = 0.1) {
  const inside = (p: THREE.Vector2, poly: THREE.Vector2[]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const near = (p: THREE.Vector2, poly: THREE.Vector2[], d: number) => {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()), 0, 1);
      if (a.clone().addScaledVector(ab, t).distanceTo(p) < d) return true;
    }
    return false;
  };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of outline) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const steiner: THREE.Vector2[][] = [];
  for (let y = y0 + spacing / 2; y < y1; y += spacing) for (let x = x0 + spacing / 2; x < x1; x += spacing) {
    const p = new THREE.Vector2(x + (Math.round(y / spacing) % 2) * spacing * 0.5, y);
    if (!inside(p, outline) || holes.some((h) => inside(p, h))) continue;
    if (near(p, outline, spacing * 0.35) || holes.some((h) => near(p, h, spacing * 0.35))) continue;
    steiner.push([p]);
  }
  const all = [...outline, ...holes.flat(), ...steiner.flat()];
  const faces = THREE.ShapeUtils.triangulateShape(outline.slice(), [...holes.map((h) => h.slice()), ...steiner]);
  const pos = new Float32Array(all.length * 3), uv = new Float32Array(all.length * 2), idx: number[] = [];
  all.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; uv[i * 2] = p.x; uv[i * 2 + 1] = p.y; });
  for (const [a, b, c] of faces) {
    const A = all[a], B = all[b], C = all[c], cr = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    if (Math.abs(cr) < 1e-12) continue;
    if (cr > 0) idx.push(a, b, c); else idx.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const nrm = new Float32Array(all.length * 3); for (let i = 0; i < all.length; i++) nrm[i * 3 + 2] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// planar UVs in metres by the dominant axis of each vertex normal
export function boxUV(g: THREE.BufferGeometry, scale = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u: number, v: number;
    if (ax >= ay && ax >= az) { u = z; v = y; } else if (ay >= az) { u = x; v = z; } else { u = x; v = y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ------------------------------------------------------------------------------------------------ the kit
export type AOFn = (p: V3, n: V3) => number;
// a smooth deformation of space: moves p in place, returns false where it is the identity (and its Jacobian too)
export type WarpFn = (p: V3) => boolean;
interface Part { g: THREE.BufferGeometry }
// apply a warp to a geometry: positions move, normals turn with the warp's local Jacobian (cofactor transform)
export function warpGeo(g: THREE.BufferGeometry, warp: WarpFn) {
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute | undefined;
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const N = new THREE.Vector3(), t = new THREE.Vector3(), e = 1e-3;
  const col = (out: V3, k: 0 | 1 | 2) => {
    Q.copy(P).setComponent(k, P.getComponent(k) + e); warp(Q); out.copy(Q);
    Q.copy(P).setComponent(k, P.getComponent(k) - e); warp(Q); return out.sub(Q).multiplyScalar(1 / (2 * e));
  };
  for (let i = 0; i < p.count; i++) {
    P.set(p.getX(i), p.getY(i), p.getZ(i));
    Q.copy(P);
    if (!warp(Q)) continue;
    p.setXYZ(i, Q.x, Q.y, Q.z);
    if (!n) continue;
    col(a, 0); col(b, 1); col(c, 2);
    N.set(n.getX(i), n.getY(i), n.getZ(i));
    // A^-T is proportional to [b x c, c x a, a x b] (as columns)
    const out = t.crossVectors(b, c).multiplyScalar(N.x);
    out.add(Q.crossVectors(c, a).multiplyScalar(N.y)).add(Q.crossVectors(a, b).multiplyScalar(N.z)).normalize();
    n.setXYZ(i, out.x, out.y, out.z);
  }
  p.needsUpdate = true; if (n) n.needsUpdate = true;
  return g;
}
export class Kit {
  private parts = new Map<string, Part[]>();
  ao: AOFn | null = null;
  warp: WarpFn | null = null;
  // run fn with the warp off (rigid parts placed by hand at warped positions)
  rigid(fn: () => void) { const w = this.warp; this.warp = null; try { fn(); } finally { this.warp = w; } }

  // file a geometry under a material key; m places it; uv: 'keep' keeps its UVs, a number box-maps at that scale
  add(key: string, g: THREE.BufferGeometry, m?: THREE.Matrix4 | null, uv: 'keep' | number = 'keep') {
    let geo = g.index ? g : g.setIndex([...Array(g.attributes.position.count).keys()]);
    if (m) geo = geo.applyMatrix4(m);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (uv !== 'keep' || !geo.attributes.uv) boxUV(geo, typeof uv === 'number' ? uv : 0.1);
    if (this.warp) warpGeo(geo, this.warp);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key)!.push({ g: geo });
    return this;
  }
  has(key: string) { return this.parts.has(key); }
  keys() { return [...this.parts.keys()]; }
  // merge each key into one mesh with its material; keys without a material are skipped
  build(mats: Record<string, THREE.Material | undefined>, parent: THREE.Object3D, o: { shadow?: (key: string) => boolean; receive?: boolean } = {}) {
    const out: Record<string, THREE.Mesh> = {};
    for (const [key, parts] of this.parts) {
      const mat = mats[key];
      if (!mat) continue;
      const geo = mergeGeometries(parts.map((p) => p.g), false);
      if (!geo) throw new Error('merge failed for ' + key);
      bakeAO(geo, this.ao);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = key;
      mesh.castShadow = o.shadow ? o.shadow(key) : false;
      mesh.receiveShadow = o.receive ?? true;
      parent.add(mesh);
      out[key] = mesh;
    }
    return out;
  }
}
// per-vertex ambient occlusion from a heuristic of position and normal (1 = open)
export function bakeAO(g: THREE.BufferGeometry, fn: AOFn | null) {
  const p = g.attributes.position, n = g.attributes.normal, a = new Float32Array(p.count);
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    if (!fn) { a[i] = 1; continue; }
    P.set(p.getX(i), p.getY(i), p.getZ(i)); N.set(n.getX(i), n.getY(i), n.getZ(i));
    a[i] = clamp(fn(P, N), 0, 1);
  }
  g.setAttribute('ao', new THREE.BufferAttribute(a, 1));
  return g;
}

// ------------------------------------------------------------------------------------------------ material patches
// compose onBeforeCompile hooks
type Hook = (sh: THREE.WebGLProgramParametersWithUniforms) => void;
export function patch(m: THREE.Material, key: string, hook: Hook) {
  const prev = m.onBeforeCompile.bind(m), prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => { prev(sh, r); hook(sh); };
  m.customProgramCacheKey = () => prevKey() + '|' + key;
  m.needsUpdate = true;
  return m;
}
// apply the baked 'ao' attribute to indirect light (and a little to direct, for crevices the shadow map misses)
export function withAO(m: THREE.Material, direct = 0.25) {
  return patch(m, 'ao' + direct, (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float ao;\nvarying float vAo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAo = ao;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAo;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= vAo;
        reflectedLight.indirectSpecular *= mix(1.0, vAo, 0.85);
        reflectedLight.directDiffuse *= mix(1.0, vAo, ${direct.toFixed(3)});
        reflectedLight.directSpecular *= mix(1.0, vAo, ${direct.toFixed(3)});`);
  });
}

// a matrix from position, Euler rotation and scale
export function mat(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, s: number | V3 = 1) {
  const sc = typeof s === 'number' ? v3(s, s, s) : s;
  return new THREE.Matrix4().compose(v3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), sc);
}
// a matrix that puts local +y along a->b, centred between them, scaled to its length on y
export function between(a: V3, b: V3) {
  const d = b.clone().sub(a), len = d.length();
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(v3(0, 1, 0), d.normalize()), v3(1, len, 1));
}
// a basis matrix: local x, y, z axes and origin
export function basis(o: V3, x: V3, y: V3, z: V3) {
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);
}
