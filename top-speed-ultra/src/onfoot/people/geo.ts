// Meshing parts of the body field into skinned BufferGeometry: boxes, triangle filters (the seams between the coarse
// body and the fine head and hands), skin weights from per-bone distances, baked ambient occlusion.
import * as THREE from 'three';
import { Field, Sdf } from './field';
import { meshField, MeshOut, Box } from './mesher';
import { V3, clamp, dot } from './math';
import { Rig, BONES } from './body';

export interface Part {
  mesh: MeshOut;
  idx: Uint32Array;           // the kept triangles
  skinIndex: Uint16Array; skinWeight: Float32Array;
  ao: Float32Array;
}

export function aabbBox(lo: V3, hi: V3, h: number): Box {
  const pad = 2 * h;
  const o: V3 = [lo[0] - pad, lo[1] - pad, lo[2] - pad];
  return { o, ax: [1, 0, 0], ay: [0, 1, 0], az: [0, 0, 1], nx: Math.ceil((hi[0] - lo[0] + 2 * pad) / h), ny: Math.ceil((hi[1] - lo[1] + 2 * pad) / h), nz: Math.ceil((hi[2] - lo[2] + 2 * pad) / h) };
}

export function fieldBounds(f: Field, filter?: (c: V3, r: number, i: number) => boolean): [V3, V3] {
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  for (const b of f.bounds()) {
    if (filter && !filter(b.c, b.r, b.i)) continue;
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.c[i] - b.r); hi[i] = Math.max(hi[i], b.c[i] + b.r); }
  }
  return [lo, hi];
}

/** mesh a field in a box, keeping triangles whose centroid passes `keep` */
export function meshPart(field: Sdf, box: Box, h: number, keep?: (x: number, y: number, z: number) => boolean): { mesh: MeshOut; idx: Uint32Array } {
  const mesh = meshField(field, box, h);
  if (!keep) return { mesh, idx: mesh.idx };
  const P = mesh.pos, I = mesh.idx, out: number[] = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (keep((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3)) out.push(I[t], I[t + 1], I[t + 2]);
  }
  return { mesh, idx: Uint32Array.from(out) };
}

/** skin weights: a gaussian of how much farther each bone's flesh is than the nearest, top four */
export function skinWeights(rig: Rig, pos: Float32Array, act: ((i: number) => Int32Array | null) | null, sigmaScale = 1) {
  const nv = pos.length / 3, nb = BONES.length;
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const d = new Float64Array(nb), w = new Float64Array(nb);
  const f = rig.field;
  for (let v = 0; v < nv; v++) {
    const a = act ? act(v) : null;
    f.boneDist(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], a, a ? a.length : 0, d);
    let dmin = 1e9;
    for (let b = 0; b < nb; b++) dmin = Math.min(dmin, d[b]);
    for (let b = 0; b < nb; b++) { const q = (d[b] - dmin) / (rig.sigma[b] * sigmaScale); w[b] = q < 3 ? Math.exp(-q * q) : 0; }
    // top four
    let tot = 0;
    for (let k = 0; k < 4; k++) {
      let best = -1, bw = 0;
      for (let b = 0; b < nb; b++) if (w[b] > bw) { bw = w[b]; best = b; }
      if (best < 0) { si[v * 4 + k] = 0; sw[v * 4 + k] = 0; continue; }
      si[v * 4 + k] = best; sw[v * 4 + k] = bw; tot += bw; w[best] = 0;
    }
    if (tot <= 0) { si[v * 4] = 3; sw[v * 4] = 1; tot = 1; }
    for (let k = 0; k < 4; k++) sw[v * 4 + k] /= tot;
  }
  return { si, sw };
}

/** ambient occlusion from the field: how much the field closes in along the normal at two scales */
export function bakeAO(field: Sdf, pos: Float32Array, nrm: Float32Array, act: ((i: number) => Int32Array | null) | null, d1: number, d2: number) {
  const nv = pos.length / 3, ao = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const a = act ? act(v) : null, na = a ? a.length : 0;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], nx = nrm[v * 3], ny = nrm[v * 3 + 1], nz = nrm[v * 3 + 2];
    const f1 = field.eval(x + nx * d1, y + ny * d1, z + nz * d1, a, na), f2 = field.eval(x + nx * d2, y + ny * d2, z + nz * d2, a, na);
    ao[v] = clamp(1 - 0.55 * clamp((d1 - f1) / d1) - 0.45 * clamp((d2 - f2) / d2), 0.15, 1);
  }
  return ao;
}

export function buildGeometry(pos: Float32Array, nrm: Float32Array, idx: Uint32Array, si: Uint16Array, sw: Float32Array, extra: Record<string, { a: Float32Array; n: number }> = {}) {
  // drop vertices no kept triangle uses
  const nv = pos.length / 3, used = new Int32Array(nv).fill(-1);
  let k = 0;
  for (let i = 0; i < idx.length; i++) if (used[idx[i]] < 0) used[idx[i]] = k++;
  const g = new THREE.BufferGeometry();
  const pick = (src: ArrayLike<number>, n: number, Ctor: Float32ArrayConstructor | Uint16ArrayConstructor) => {
    const out = new Ctor(k * n);
    for (let v = 0; v < nv; v++) { const u = used[v]; if (u < 0) continue; for (let j = 0; j < n; j++) out[u * n + j] = src[v * n + j]; }
    return out;
  };
  g.setAttribute('position', new THREE.BufferAttribute(pick(pos, 3, Float32Array), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(pick(nrm, 3, Float32Array), 3));
  g.setAttribute('aRest', new THREE.BufferAttribute(pick(pos, 3, Float32Array), 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(pick(si, 4, Uint16Array) as Uint16Array, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(pick(sw, 4, Float32Array), 4));
  for (const [name, e] of Object.entries(extra)) g.setAttribute(name, new THREE.BufferAttribute(pick(e.a, e.n, Float32Array), e.n));
  const I = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) I[i] = used[idx[i]];
  g.setIndex(new THREE.BufferAttribute(k < 65535 ? Uint16Array.from(I) : I, 1));
  g.computeBoundingSphere();
  return { geo: g, map: used, count: k };
}

/** the side of a plane a point is on (positive = the side n points to) */
export const side = (p: V3, o: V3, n: V3) => dot([p[0] - o[0], p[1] - o[1], p[2] - o[2]], n);
