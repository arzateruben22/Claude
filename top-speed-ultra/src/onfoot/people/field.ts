// A person as one signed distance field (metres): round cones and ellipsoids, each owned by a bone (for skinning) and
// a blend group. Primitives smooth-union into their group; groups form a tree (core <- limbs <- fingers) and each
// child blends into its parent with its own radius, while siblings stay a hard min (legs never melt together, fingers
// never web). Carves (smooth subtraction) cut the mouth, nostrils, eye sockets and ears.
// Adapted from src/preview/hands-sdf.ts (copied, not imported: that folder belongs to another workflow).
import { V3, add, cross, len, madd, norm, perp, sub } from './math';

const S = 21;
export const MAX_GROUPS = 24;

export interface Sdf {
  n: number;
  prim(i: number, x: number, y: number, z: number): number;
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number): number;
  maxK: number;
}

export class Field implements Sdf {
  n = 0;
  F: number[] = [];
  type: number[] = []; group: number[] = []; k: number[] = []; bone: number[] = []; carve: number[] = [];
  /** per group: parent group and the blend radius into it */
  gParent: number[] = [-1]; gK: number[] = [0];
  maxK = 0;
  private Fa = new Float64Array(0);
  private T = new Uint8Array(0); private Gp = new Uint8Array(0); private K = new Float64Array(0); private C = new Uint8Array(0);
  private acc = new Float64Array(MAX_GROUPS); private res = new Float64Array(MAX_GROUPS);
  private nG = 1;

  addGroup(parent: number, k: number) { this.gParent.push(parent); this.gK.push(k); this.maxK = Math.max(this.maxK, k); return this.gParent.length - 1; }

  /** round cone a (r1) -> b (r2); section scaled by su along `up` and sl across (sl2 at b) */
  cone(a: V3, b: V3, r1: number, r2: number, up: V3, su: number, sl: number, group: number, k: number, bone: number, sl2 = sl, carve = 0) {
    const ax = norm(sub(b, a)), L = len(sub(b, a));
    const u = perp(up, ax), l = cross(ax, u);
    const bb = Math.max(-0.95, Math.min(0.95, (r1 - r2) / Math.max(L, 1e-6))), aa = Math.sqrt(1 - bb * bb);
    this.F.push(a[0], a[1], a[2], ax[0], ax[1], ax[2], u[0], u[1], u[2], l[0], l[1], l[2], L, r1, r2, su, sl, Math.min(1, su, sl, sl2), bb, aa, sl2);
    this.push(0, group, k, bone, carve);
    return this.n - 1;
  }
  /** capsule-ish round cone with a round section */
  rc(a: V3, b: V3, r1: number, r2: number, group: number, k: number, bone: number, up: V3 = [0, 0, 1], su = 1, sl = 1) {
    return this.cone(a, b, r1, r2, up, su, sl, group, k, bone);
  }
  /** ellipsoid at c, semi-axes rx along ax, ry along up (made perpendicular), rz across */
  ell(c: V3, ax: V3, up: V3, rx: number, ry: number, rz: number, group: number, k: number, bone: number, carve = 0) {
    const x = norm(ax), u = perp(up, x), l = cross(x, u);
    this.F.push(c[0], c[1], c[2], x[0], x[1], x[2], u[0], u[1], u[2], l[0], l[1], l[2], rx, ry, rz, 0, 0, 0, 0, 0, 0);
    this.push(1, group, k, bone, carve);
    return this.n - 1;
  }
  /** axis-aligned ellipsoid */
  ea(c: V3, rx: number, ry: number, rz: number, group: number, k: number, bone: number, carve = 0) {
    return this.ell(c, [1, 0, 0], [0, 1, 0], rx, ry, rz, group, k, bone, carve);
  }
  private push(t: number, g: number, k: number, bone: number, carve: number) {
    this.type.push(t); this.group.push(g); this.k.push(Math.max(k, 1e-5)); this.bone.push(bone); this.carve.push(carve); this.n++;
    this.maxK = Math.max(this.maxK, k);
  }
  finalize() {
    this.Fa = Float64Array.from(this.F);
    this.T = Uint8Array.from(this.type); this.Gp = Uint8Array.from(this.group); this.K = Float64Array.from(this.k); this.C = Uint8Array.from(this.carve);
    this.nG = this.gParent.length;
    if (this.nG > MAX_GROUPS) throw new Error('too many blend groups');
    return this;
  }
  prim(i: number, x: number, y: number, z: number) {
    const F = this.Fa, b = i * S;
    const dx = x - F[b], dy = y - F[b + 1], dz = z - F[b + 2];
    const lx = dx * F[b + 3] + dy * F[b + 4] + dz * F[b + 5];
    const ly = dx * F[b + 6] + dy * F[b + 7] + dz * F[b + 8];
    const lz = dx * F[b + 9] + dy * F[b + 10] + dz * F[b + 11];
    if (this.T[i] === 0) {
      const L = F[b + 12], r1 = F[b + 13], r2 = F[b + 14], tl = lx <= 0 ? 0 : lx >= L ? 1 : lx / L;
      const su = ly / F[b + 15], sl = lz / (F[b + 16] + (F[b + 20] - F[b + 16]) * tl), qx = Math.sqrt(su * su + sl * sl), qy = lx;
      const bb = F[b + 18], aa = F[b + 19], kk = -bb * qx + aa * qy;
      let d: number;
      if (kk < 0) d = Math.sqrt(qx * qx + qy * qy) - r1;
      else if (kk > aa * L) d = Math.sqrt(qx * qx + (qy - L) * (qy - L)) - r2;
      else d = qx * aa + qy * bb - r1;
      return d * F[b + 17];
    }
    const rx = F[b + 12], ry = F[b + 13], rz = F[b + 14];
    const ax = lx / rx, ay = ly / ry, az = lz / rz;
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt((ax * ax) / (rx * rx) + (ay * ay) / (ry * ry) + (az * az) / (rz * rz));
    return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
  }
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    const acc = this.acc, res = this.res, nG = this.nG;
    for (let g = 0; g < nG; g++) acc[g] = 1e9;
    const n = act ? nAct : this.n;
    // unions first
    for (let j = 0; j < n; j++) {
      const i = act ? act[j] : j;
      if (this.C[i]) continue;
      const d = this.prim(i, x, y, z), g = this.Gp[i], a = acc[g], k = this.K[i];
      const h = Math.max(k - Math.abs(a - d), 0) / k;
      acc[g] = Math.min(a, d) - h * h * k * 0.25;
    }
    // the group tree, leaves first (children always have higher indices than their parents)
    for (let g = 0; g < nG; g++) res[g] = acc[g];
    for (let g = nG - 1; g >= 1; g--) {
      const d = res[g];
      if (d > 1e8) continue;
      const p = this.gParent[g], a = acc[p], k = this.gK[g];
      const h = Math.max(k - Math.abs(a - d), 0) / k;
      const v = Math.min(a, d) - h * h * k * 0.25;
      if (v < res[p]) res[p] = v;
    }
    let s = res[0];
    // carves: smooth subtraction
    for (let j = 0; j < n; j++) {
      const i = act ? act[j] : j;
      if (!this.C[i]) continue;
      const d = -this.prim(i, x, y, z), k = this.K[i];
      const h = Math.max(k - Math.abs(s - d), 0) / k;
      s = Math.max(s, d) + h * h * k * 0.25;
    }
    return s;
  }
  /** each primitive's bounding sphere */
  bounds(): { c: V3; r: number; i: number }[] {
    const out: { c: V3; r: number; i: number }[] = [];
    for (let i = 0; i < this.n; i++) {
      if (this.carve[i]) continue;
      const b = i * S, F = this.F, c: V3 = [F[b], F[b + 1], F[b + 2]];
      if (this.type[i] === 0) {
        const L = F[b + 12], s = Math.max(F[b + 15], F[b + 16], F[b + 20], 1), r = Math.max(F[b + 13], F[b + 14]) * s;
        out.push({ c: madd(c, [F[b + 3], F[b + 4], F[b + 5]], L / 2), r: L / 2 + r, i });
      } else out.push({ c, r: Math.max(F[b + 12], F[b + 13], F[b + 14]), i });
    }
    return out;
  }
  /** per bone: the nearest primitive's distance (for skin weights); out has one slot per bone */
  boneDist(x: number, y: number, z: number, act: Int32Array | null, nAct: number, out: Float64Array) {
    out.fill(1e9);
    const n = act ? nAct : this.n;
    for (let j = 0; j < n; j++) {
      const i = act ? act[j] : j;
      if (this.C[i]) continue;
      const d = this.prim(i, x, y, z), b = this.bone[i];
      if (d < out[b]) out[b] = d;
    }
  }
}

export const centre = (a: V3, b: V3): V3 => add(a, b).map((v) => v / 2) as V3;
