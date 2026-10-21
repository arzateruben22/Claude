// What blocks you on foot, resolved in 2D on the ground plane (PROJECT_OC_ON_FOOT.md, "Movement and collisions"):
// building footprints and our structures as polygons; tables, benches, trucks, planters and parked cars as boxes;
// poles, heaters and trees as circles; fences and walls as thick segments. They sit in a 4 m spatial hash. The body
// is a circle of radius 0.3 m pushed out of everything it overlaps, three passes a step, so it slides along walls.
// The edge of the walkable area (kerbs, the end of the hangout area) is a grid of blocked cells (walkgrid.ts), which
// the same push-out treats as squares.

export type ColliderKind = 'seg' | 'box' | 'circ' | 'poly';
export interface Collider {
  id: number;
  k: ColliderKind;
  tag: string;                 // wall, fence, table, bench, truck, car, building, pole, tree, gate, door, counter...
  tall: boolean;               // blocks the third-person camera
  dyn: boolean;                // changes with the clock (gates, roll-up doors, parked cars)
  on: boolean;                 // active now
  // seg: a -> b, radius r (half the wall's thickness); circ: centre a, radius r
  ax: number; az: number; bx: number; bz: number; r: number;
  // box: centre a, half sizes hx, hz, turned by rot round y (cos c, sin s)
  hx: number; hz: number; c: number; s: number;
  // poly: ring of x, z pairs
  pts: Float64Array | null;
  minx: number; minz: number; maxx: number; maxz: number;
}

let nextId = 1;
const base = (k: ColliderKind, tag: string, tall: boolean, dyn: boolean): Collider => ({
  id: nextId++, k, tag, tall, dyn, on: true, ax: 0, az: 0, bx: 0, bz: 0, r: 0, hx: 0, hz: 0, c: 1, s: 0, pts: null, minx: 0, minz: 0, maxx: 0, maxz: 0,
});
export function seg(ax: number, az: number, bx: number, bz: number, thick: number, tag: string, tall = true, dyn = false): Collider {
  const o = base('seg', tag, tall, dyn); o.ax = ax; o.az = az; o.bx = bx; o.bz = bz; o.r = thick / 2;
  o.minx = Math.min(ax, bx) - o.r; o.maxx = Math.max(ax, bx) + o.r; o.minz = Math.min(az, bz) - o.r; o.maxz = Math.max(az, bz) + o.r;
  return o;
}
/** a box: centre, full sizes, rotation round y (the Batch.box convention) */
export function box(cx: number, cz: number, sx: number, sz: number, rot: number, tag: string, tall = false, dyn = false): Collider {
  const o = base('box', tag, tall, dyn); o.ax = cx; o.az = cz; o.hx = sx / 2; o.hz = sz / 2; o.c = Math.cos(rot); o.s = Math.sin(rot);
  const ex = Math.abs(o.hx * o.c) + Math.abs(o.hz * o.s), ez = Math.abs(o.hx * o.s) + Math.abs(o.hz * o.c);
  o.minx = cx - ex; o.maxx = cx + ex; o.minz = cz - ez; o.maxz = cz + ez;
  return o;
}
export function boxMM(x0: number, z0: number, x1: number, z1: number, tag: string, tall = false, dyn = false) {
  return box((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(z1 - z0), 0, tag, tall, dyn);
}
export function circ(cx: number, cz: number, r: number, tag: string, tall = false, dyn = false): Collider {
  const o = base('circ', tag, tall, dyn); o.ax = cx; o.az = cz; o.r = r;
  o.minx = cx - r; o.maxx = cx + r; o.minz = cz - r; o.maxz = cz + r;
  return o;
}
export function poly(ring: [number, number][], tag: string, tall = true): Collider {
  const o = base('poly', tag, tall, false);
  o.pts = new Float64Array(ring.length * 2);
  o.minx = o.minz = Infinity; o.maxx = o.maxz = -Infinity;
  ring.forEach(([x, z], i) => { o.pts![i * 2] = x; o.pts![i * 2 + 1] = z; o.minx = Math.min(o.minx, x); o.maxx = Math.max(o.maxx, x); o.minz = Math.min(o.minz, z); o.maxz = Math.max(o.maxz, z); });
  return o;
}

/** signed distance from (px, pz) to the collider's surface (negative inside) and the outward direction */
export interface Hit { d: number; nx: number; nz: number }
export function distTo(o: Collider, px: number, pz: number, out: Hit): Hit {
  if (o.k === 'circ') return around(px - o.ax, pz - o.az, o.r, out);
  if (o.k === 'seg') {
    const dx = o.bx - o.ax, dz = o.bz - o.az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - o.ax) * dx + (pz - o.az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = o.ax + dx * t, qz = o.az + dz * t;
    around(px - qx, pz - qz, o.r, out);
    if (out.nx === 1 && out.nz === 0 && Math.abs(px - qx) < 1e-9 && Math.abs(pz - qz) < 1e-9) { const l = Math.sqrt(l2) || 1; out.nx = -dz / l; out.nz = dx / l; }
    return out;
  }
  if (o.k === 'box') {
    const dx = px - o.ax, dz = pz - o.az;
    const x = dx * o.c - dz * o.s, z = dx * o.s + dz * o.c;
    let nlx = 0, nlz = 0;
    if (Math.abs(x) <= o.hx && Math.abs(z) <= o.hz) {
      const ex = o.hx - Math.abs(x), ez = o.hz - Math.abs(z);
      if (ex < ez) { nlx = x < 0 ? -1 : 1; out.d = -ex; } else { nlz = z < 0 ? -1 : 1; out.d = -ez; }
    } else {
      const qx = x < -o.hx ? -o.hx : x > o.hx ? o.hx : x, qz = z < -o.hz ? -o.hz : z > o.hz ? o.hz : z;
      const vx = x - qx, vz = z - qz, l = Math.hypot(vx, vz);
      out.d = l; nlx = vx / l; nlz = vz / l;
    }
    out.nx = nlx * o.c + nlz * o.s; out.nz = -nlx * o.s + nlz * o.c;
    return out;
  }
  // polygon
  const P = o.pts!, n = P.length / 2;
  let best = Infinity, bqx = 0, bqz = 0, inside = false, ex = 0, ez = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = P[i * 2], zi = P[i * 2 + 1], xj = P[j * 2], zj = P[j * 2 + 1];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) inside = !inside;
    const dx = xi - xj, dz = zi - zj, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - xj) * dx + (pz - zj) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = xj + dx * t, qz = zj + dz * t, d2 = (px - qx) ** 2 + (pz - qz) ** 2;
    if (d2 < best) { best = d2; bqx = qx; bqz = qz; ex = dx; ez = dz; }
  }
  const l = Math.sqrt(best);
  if (l > 1e-9) { out.nx = (px - bqx) / l; out.nz = (pz - bqz) / l; } else { const el = Math.hypot(ex, ez) || 1; out.nx = ez / el; out.nz = -ex / el; }
  if (inside) { out.nx = -out.nx; out.nz = -out.nz; out.d = -l; } else out.d = l;
  return out;
}
function around(vx: number, vz: number, r: number, out: Hit) {
  const l = Math.hypot(vx, vz);
  if (l < 1e-9) { out.d = -r; out.nx = 1; out.nz = 0; return out; }
  out.d = l - r; out.nx = vx / l; out.nz = vz / l;
  return out;
}

/** the 4 m spatial hash */
export class ColliderSet {
  all: Collider[] = [];
  private cells = new Map<number, Collider[]>();
  private stamp = new Map<number, number>();
  private tick = 0;
  static readonly CELL = 4;
  private key(ix: number, iz: number) { return (ix + 32768) * 65536 + (iz + 32768); }
  add(...cs: Collider[]) { for (const c of cs) this.all.push(c); }
  rebuild() {
    this.cells.clear();
    const C = ColliderSet.CELL;
    for (const o of this.all) {
      if (!o.on) continue;
      const x0 = Math.floor(o.minx / C), x1 = Math.floor(o.maxx / C), z0 = Math.floor(o.minz / C), z1 = Math.floor(o.maxz / C);
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let l = this.cells.get(k); if (!l) { l = []; this.cells.set(k, l); } l.push(o);
      }
    }
  }
  /** active colliders whose box comes within `pad` of the rectangle */
  query(x0: number, z0: number, x1: number, z1: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const C = ColliderSet.CELL, t = ++this.tick;
    for (let ix = Math.floor(x0 / C); ix <= Math.floor(x1 / C); ix++) for (let iz = Math.floor(z0 / C); iz <= Math.floor(z1 / C); iz++) {
      const l = this.cells.get(this.key(ix, iz)); if (!l) continue;
      for (const o of l) {
        if (this.stamp.get(o.id) === t) continue;
        this.stamp.set(o.id, t);
        if (o.maxx < x0 || o.minx > x1 || o.maxz < z0 || o.minz > z1) continue;
        out.push(o);
      }
    }
    return out;
  }
  /** the smallest clearance from a point to anything (negative = inside), and what it is */
  clearance(px: number, pz: number, reach = 1): { d: number; o: Collider | null } {
    const near = this.query(px - reach, pz - reach, px + reach, pz + reach), h: Hit = { d: 0, nx: 0, nz: 0 };
    let d = Infinity, w: Collider | null = null;
    for (const o of near) { distTo(o, px, pz, h); if (h.d < d) { d = h.d; w = o; } }
    return { d, o: w };
  }
  /**
   * The first thing a 2D ray from a to b hits, as a fraction of the way (1 = nothing). `only` filters colliders (the
   * camera uses the tall ones).
   */
  ray(ax: number, az: number, bx: number, bz: number, only: (o: Collider) => boolean): number {
    const near = this.query(Math.min(ax, bx) - 0.5, Math.min(az, bz) - 0.5, Math.max(ax, bx) + 0.5, Math.max(az, bz) + 0.5);
    let best = 1;
    const dx = bx - ax, dz = bz - az;
    const hitSeg = (x0: number, z0: number, x1: number, z1: number) => {
      const ex = x1 - x0, ez = z1 - z0, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-12) return;
      const t = ((x0 - ax) * ez - (z0 - az) * ex) / den, u = ((x0 - ax) * dz - (z0 - az) * dx) / den;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    };
    const hitCirc = (cx: number, cz: number, r: number) => {
      const fx = ax - cx, fz = az - cz, a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
      if (c < 0) { best = 0; return; }
      const disc = b * b - 4 * a * c; if (disc < 0 || a < 1e-12) return;
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t < best) best = t;
    };
    for (const o of near) {
      if (!only(o)) continue;
      if (o.k === 'circ') hitCirc(o.ax, o.az, o.r);
      else if (o.k === 'seg') {
        // the wall's two faces
        const ex = o.bx - o.ax, ez = o.bz - o.az, l = Math.hypot(ex, ez) || 1, nx = -ez / l * o.r, nz = ex / l * o.r;
        hitSeg(o.ax + nx, o.az + nz, o.bx + nx, o.bz + nz); hitSeg(o.ax - nx, o.az - nz, o.bx - nx, o.bz - nz);
        hitCirc(o.ax, o.az, o.r); hitCirc(o.bx, o.bz, o.r);
      } else if (o.k === 'box') {
        const cs = boxCorners(o);
        for (let i = 0; i < 4; i++) hitSeg(cs[i][0], cs[i][1], cs[(i + 1) % 4][0], cs[(i + 1) % 4][1]);
      } else {
        const P = o.pts!, n = P.length / 2;
        for (let i = 0, j = n - 1; i < n; j = i++) hitSeg(P[j * 2], P[j * 2 + 1], P[i * 2], P[i * 2 + 1]);
      }
    }
    return best;
  }
}
export function boxCorners(o: Collider): [number, number][] {
  const P = (x: number, z: number): [number, number] => [o.ax + x * o.c + z * o.s, o.az - x * o.s + z * o.c];
  return [P(-o.hx, -o.hz), P(o.hx, -o.hz), P(o.hx, o.hz), P(-o.hx, o.hz)];
}

/** everything as plain data, for the test page's independent checker */
export function exportColliders(set: ColliderSet) {
  return set.all.filter((o) => o.on).map((o) => {
    if (o.k === 'circ') return { k: 'circ', tag: o.tag, x: o.ax, z: o.az, r: o.r };
    if (o.k === 'seg') return { k: 'seg', tag: o.tag, ax: o.ax, az: o.az, bx: o.bx, bz: o.bz, r: o.r };
    if (o.k === 'box') return { k: 'poly', tag: o.tag, pts: boxCorners(o).flat() };
    return { k: 'poly', tag: o.tag, pts: Array.from(o.pts!) };
  });
}
