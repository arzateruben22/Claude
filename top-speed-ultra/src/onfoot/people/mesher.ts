// Copied from src/preview/hands-mesh.ts (generic field, metre units).
// Meshing a distance field once, fast: a sparse surface-nets mesher. The field is first sampled at the centres of
// 4-cell blocks; only blocks the surface can pass through are refined, and each of those evaluates just the
// primitives that can reach it. Vertices are projected onto the true surface with a Newton step and given the
// field's gradient as their normal, so the mesh is smooth without any extra smoothing pass.
import { Sdf } from './field';
import { V3 } from './math';

export interface Box { o: V3; ax: V3; ay: V3; az: V3; nx: number; ny: number; nz: number }
export interface MeshOut {
  pos: Float32Array;            // vertex positions (field units)
  nrm: Float32Array;            // unit normals
  idx: Uint32Array;             // triangles
  vblock: Int32Array;           // each vertex's block, for its active primitive list
  act: (Int32Array | null)[];   // per block: the primitives that can reach it
  stats: { blocks: number; near: number; evals: number; verts: number; tris: number; ms: number; phases?: number[]; avgAct?: number };
}

const B = 4;   // cells per block edge
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export function meshField(field: Sdf, box: Box, h: number): MeshOut {
  const t0 = performance.now();
  const nbx = Math.ceil(box.nx / B), nby = Math.ceil(box.ny / B), nbz = Math.ceil(box.nz / B);
  const nx = nbx * B, ny = nby * B, nz = nbz * B;
  const px = nx + 1, py = ny + 1, pz = nz + 1;
  const vals = new Float32Array(px * py * pz), state = new Uint8Array(px * py * pz);
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const nb = nbx * nby * nbz;
  const near = new Uint8Array(nb), bsign = new Int8Array(nb);
  const act: (Int32Array | null)[] = new Array(nb).fill(null);
  const [ox, oy, oz] = box.o, [ax0, ax1, ax2] = box.ax, [ay0, ay1, ay2] = box.ay, [az0, az1, az2] = box.az;
  const P = (i: number, j: number, k: number, out: number[]) => {
    const a = i * h, b = j * h, c = k * h;
    out[0] = ox + a * ax0 + b * ay0 + c * az0; out[1] = oy + a * ax1 + b * ay1 + c * az1; out[2] = oz + a * ax2 + b * ay2 + c * az2;
  };
  const br = (B * h * Math.sqrt(3)) / 2, reachR = br * 1.6 + h, margin = Math.max(field.maxK * 1.3, 3 * h);
  const tmp = [0, 0, 0], pv = new Float64Array(field.n);
  let evals = 0, nNear = 0;

  // ---- 1. which blocks can hold the surface, and what reaches each of them (super-blocks of 4^3 blocks first)
  const SB = 4, sbr = (SB * B * h * Math.sqrt(3)) / 2;
  const skip = new Uint8Array(nb);
  for (let sz = 0; sz < nbz; sz += SB) for (let sy = 0; sy < nby; sy += SB) for (let sx = 0; sx < nbx; sx += SB) {
    P((sx + SB / 2) * B, (sy + SB / 2) * B, (sz + SB / 2) * B, tmp);
    const D = field.eval(tmp[0], tmp[1], tmp[2], null, 0); evals++;
    if (Math.abs(D) <= sbr * 1.6 + reachR) continue;
    for (let bz = sz; bz < Math.min(nbz, sz + SB); bz++) for (let by = sy; by < Math.min(nby, sy + SB); by++) for (let bx = sx; bx < Math.min(nbx, sx + SB); bx++) {
      const bi = bx + nbx * (by + nby * bz); skip[bi] = 1; bsign[bi] = D < 0 ? -1 : 1;
    }
  }
  for (let bz = 0; bz < nbz; bz++) for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
    const bi = bx + nbx * (by + nby * bz);
    if (skip[bi]) continue;
    P((bx + 0.5) * B, (by + 0.5) * B, (bz + 0.5) * B, tmp);
    const D = field.eval(tmp[0], tmp[1], tmp[2], null, 0); evals++;
    bsign[bi] = D < 0 ? -1 : 1;
    if (Math.abs(D) > reachR) continue;
    near[bi] = 1; nNear++;
    let m = 1e9;
    for (let i = 0; i < field.n; i++) { pv[i] = field.prim(i, tmp[0], tmp[1], tmp[2]); m = Math.min(m, pv[i] + reachR); }
    const list: number[] = [];
    for (let i = 0; i < field.n; i++) if (pv[i] - reachR <= m + margin) list.push(i);
    act[bi] = Int32Array.from(list);
  }
  const blockOf = (i: number, j: number, k: number) => Math.min(nbx - 1, (i / B) | 0) + nbx * (Math.min(nby - 1, (j / B) | 0) + nby * Math.min(nbz - 1, (k / B) | 0));
  const val = (i: number, j: number, k: number) => {
    const g = i + px * (j + py * k);
    if (state[g]) return vals[g];
    // not refined: far from the surface, so its block's sign is right; but evaluate if a near block asks
    const bi = blockOf(i, j, k), a = act[bi];
    P(i, j, k, tmp);
    const v = field.eval(tmp[0], tmp[1], tmp[2], a, a ? a.length : 0); evals++;
    vals[g] = v; state[g] = 1;
    return v;
  };

  const tB = performance.now();
  // ---- 2. refine the near blocks
  for (let bz = 0; bz < nbz; bz++) for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
    const bi = bx + nbx * (by + nby * bz);
    if (!near[bi]) continue;
    const a = act[bi]!, na = a.length;
    for (let k = bz * B; k <= bz * B + B; k++) for (let j = by * B; j <= by * B + B; j++) for (let i = bx * B; i <= bx * B + B; i++) {
      const g = i + px * (j + py * k);
      if (state[g]) continue;
      P(i, j, k, tmp);
      vals[g] = field.eval(tmp[0], tmp[1], tmp[2], a, na); state[g] = 1; evals++;
    }
  }
  const sval = (i: number, j: number, k: number) => {
    const g = i + px * (j + py * k);
    if (state[g]) return vals[g];
    const bi = blockOf(i, j, k);
    if (near[bi]) return val(i, j, k);
    return bsign[bi] * 1e3;
  };

  const tR = performance.now();
  // ---- 3. one vertex per cell the surface passes through
  const pos: number[] = [], vb: number[] = [];
  const cv = new Float64Array(8), cp = new Float64Array(24);
  const cellVertex = (i: number, j: number, k: number) => {
    const c = i + nx * (j + ny * k);
    if (cellVert[c] >= 0) return cellVert[c];
    let inside = 0;
    for (let q = 0; q < 8; q++) {
      const di = q & 1, dj = (q >> 1) & 1, dk = (q >> 2) & 1;
      cv[q] = sval(i + di, j + dj, k + dk); if (cv[q] < 0) inside++;
      P(i + di, j + dj, k + dk, tmp); cp[q * 3] = tmp[0]; cp[q * 3 + 1] = tmp[1]; cp[q * 3 + 2] = tmp[2];
    }
    if (inside === 0 || inside === 8) return -1;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) {
      const va = cv[a], vbb = cv[b];
      if ((va < 0) === (vbb < 0)) continue;
      const t = va / (va - vbb);
      sx += cp[a * 3] + (cp[b * 3] - cp[a * 3]) * t; sy += cp[a * 3 + 1] + (cp[b * 3 + 1] - cp[a * 3 + 1]) * t; sz += cp[a * 3 + 2] + (cp[b * 3 + 2] - cp[a * 3 + 2]) * t; n++;
    }
    const id = pos.length / 3;
    pos.push(sx / n, sy / n, sz / n); vb.push(blockOf(i, j, k));
    cellVert[c] = id;
    return id;
  };
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const dac = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
    const dbd = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
    if (dac <= dbd) tris.push(a, b, c, a, c, d); else tris.push(b, c, d, b, d, a);
  };
  for (let bz = 0; bz < nbz; bz++) for (let by = 0; by < nby; by++) for (let bx = 0; bx < nbx; bx++) {
    const bi = bx + nbx * (by + nby * bz);
    if (!near[bi]) continue;
    for (let k = bz * B; k < bz * B + B; k++) for (let j = by * B; j < by * B + B; j++) for (let i = bx * B; i < bx * B + B; i++) {
      const v0 = sval(i, j, k), in0 = v0 < 0;
      // +x edge: the cells round it, counter-clockwise about +x
      if (j > 0 && k > 0 && i < nx && (sval(i + 1, j, k) < 0) !== in0) {
        const c0 = cellVertex(i, j - 1, k - 1), c1 = cellVertex(i, j, k - 1), c2 = cellVertex(i, j, k), c3 = cellVertex(i, j - 1, k);
        if (in0) quad(c0, c1, c2, c3); else quad(c3, c2, c1, c0);
      }
      if (i > 0 && k > 0 && j < ny && (sval(i, j + 1, k) < 0) !== in0) {
        const c0 = cellVertex(i - 1, j, k - 1), c1 = cellVertex(i - 1, j, k), c2 = cellVertex(i, j, k), c3 = cellVertex(i, j, k - 1);
        if (in0) quad(c0, c1, c2, c3); else quad(c3, c2, c1, c0);
      }
      if (i > 0 && j > 0 && k < nz && (sval(i, j, k + 1) < 0) !== in0) {
        const c0 = cellVertex(i - 1, j - 1, k), c1 = cellVertex(i, j - 1, k), c2 = cellVertex(i, j, k), c3 = cellVertex(i - 1, j, k);
        if (in0) quad(c0, c1, c2, c3); else quad(c3, c2, c1, c0);
      }
    }
  }

  // ---- 4. onto the surface, with the field's gradient for the normal
  const nv = pos.length / 3, P32 = new Float32Array(pos), N32 = new Float32Array(nv * 3);
  const tC = performance.now();
  // the field's gradient from four samples on a tetrahedron (its mean is the value)
  const e = h * 0.2;
  for (let v = 0; v < nv; v++) {
    const a = act[vb[v]], na = a ? a.length : 0;
    let x = P32[v * 3], y = P32[v * 3 + 1], z = P32[v * 3 + 2];
    let gx = 0, gy = 0, gz = 1;
    for (let it = 0; it < 2; it++) {
      const f1 = field.eval(x + e, y - e, z - e, a, na), f2 = field.eval(x - e, y - e, z + e, a, na);
      const f3 = field.eval(x - e, y + e, z - e, a, na), f4 = field.eval(x + e, y + e, z + e, a, na);
      evals += 4;
      const f0 = (f1 + f2 + f3 + f4) * 0.25;
      gx = (f1 - f2 - f3 + f4) / (4 * e); gy = (-f1 - f2 + f3 + f4) / (4 * e); gz = (-f1 + f2 - f3 + f4) / (4 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-12 || it === 1 || Math.abs(f0) < h * 1e-3) break;
      let s = f0 / g2;
      const mag = Math.abs(f0) / Math.sqrt(g2);
      if (mag > 0.6 * h) s *= (0.6 * h) / mag;
      x -= gx * s; y -= gy * s; z -= gz * s;
    }
    P32[v * 3] = x; P32[v * 3 + 1] = y; P32[v * 3 + 2] = z;
    const gl = Math.hypot(gx, gy, gz) || 1;
    N32[v * 3] = gx / gl; N32[v * 3 + 1] = gy / gl; N32[v * 3 + 2] = gz / gl;
  }
  const ms = performance.now() - t0;
  return { pos: P32, nrm: N32, idx: Uint32Array.from(tris), vblock: Int32Array.from(vb), act, stats: { blocks: nb, near: nNear, evals, verts: nv, tris: tris.length / 3, ms, phases: [tB - t0, tR - tB, tC - tR, performance.now() - tC].map(Math.round), avgAct: Math.round(act.reduce((s, a) => s + (a ? a.length : 0), 0) / Math.max(1, nNear)) } };
}
