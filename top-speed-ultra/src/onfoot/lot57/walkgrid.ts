// The walkable area as a grid of 0.5 m cells (PROJECT_OC_ON_FOOT.md: "a walkability grid of 0.5 m cells over the
// walkable area, A* with corner smoothing. No navmesh library."):
//   region: 1 where you may stand at all (the block inside the Dupont loop, the Orangewood sidewalks and crosswalks
//           between State College and the stadium-entrance signal). Everything else is the edge: kerbs are walls
//           except at crosswalks, and past the ends a quiet wall holds you.
//   raised: 1 on raised surfaces (sidewalks, the yard, the Shed's floor): 0.15 m up, one easy step.
//   free:   region cells whose centre is at least the body's radius from every collider and from the edge, for tap to
//           go and for "never stuck" (moved to the nearest free cell).
import type { Collider, ColliderSet } from './collide';
import { distTo } from './collide';
import type { P2 } from './geom';

export const CELL = 0.5;
export const RADIUS = 0.3;

export class WalkGrid {
  readonly nx: number; readonly nz: number;
  readonly region: Uint8Array; readonly raised: Uint8Array; free: Uint8Array;
  private staticFree: Uint8Array | null = null;
  // A* scratch
  private g: Float32Array; private from: Int32Array; private seen: Uint32Array; private closed: Uint32Array; private run = 0;
  private heap: Int32Array; private hf: Float32Array; private hn = 0;

  constructor(readonly x0: number, readonly z0: number, x1: number, z1: number) {
    this.nx = Math.ceil((x1 - x0) / CELL); this.nz = Math.ceil((z1 - z0) / CELL);
    const n = this.nx * this.nz;
    this.region = new Uint8Array(n); this.raised = new Uint8Array(n); this.free = new Uint8Array(n);
    this.g = new Float32Array(n); this.from = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
    this.heap = new Int32Array(1 << 20); this.hf = new Float32Array(1 << 20);
  }
  ix(x: number) { return Math.floor((x - this.x0) / CELL); }
  iz(z: number) { return Math.floor((z - this.z0) / CELL); }
  cx(i: number) { return this.x0 + (i + 0.5) * CELL; }
  cz(j: number) { return this.z0 + (j + 0.5) * CELL; }
  idx(x: number, z: number) { const i = this.ix(x), j = this.iz(z); return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : j * this.nx + i; }
  inRegion(x: number, z: number) { const k = this.idx(x, z); return k >= 0 && this.region[k] === 1; }
  isFree(x: number, z: number) { const k = this.idx(x, z); return k >= 0 && this.free[k] === 1; }
  height(x: number, z: number) { const k = this.idx(x, z); return k >= 0 && this.raised[k] ? 0.15 : 0; }

  // ------------------------------------------------------------------ painting the layers
  /** fill a polygon (scanline at cell centres) */
  fillPoly(layer: Uint8Array, ring: P2[], v = 1) {
    const n = ring.length;
    let zmin = Infinity, zmax = -Infinity;
    for (const [, z] of ring) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
    const j0 = Math.max(0, this.iz(zmin)), j1 = Math.min(this.nz - 1, this.iz(zmax));
    const xs: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const z = this.cz(j); xs.length = 0;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const [xa, za] = ring[a], [xb, zb] = ring[b];
        if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) * (xb - xa)) / (zb - za));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - this.x0) / CELL - 0.5)), i1 = Math.min(this.nx - 1, Math.floor((xs[k + 1] - this.x0) / CELL - 0.5));
        for (let i = i0; i <= i1; i++) layer[j * this.nx + i] = v;
      }
    }
  }
  /** a stroke of half-width w along a polyline */
  stroke(layer: Uint8Array, pts: P2[], w: number, v = 1, clip?: { x0: number; x1: number; z0: number; z1: number }) {
    for (let s = 1; s < pts.length; s++) {
      const [ax, az] = pts[s - 1], [bx, bz] = pts[s];
      const i0 = Math.max(0, this.ix(Math.min(ax, bx) - w)), i1 = Math.min(this.nx - 1, this.ix(Math.max(ax, bx) + w));
      const j0 = Math.max(0, this.iz(Math.min(az, bz) - w)), j1 = Math.min(this.nz - 1, this.iz(Math.max(az, bz) + w));
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = this.cx(i), z = this.cz(j);
        if (clip && (x < clip.x0 || x > clip.x1 || z < clip.z0 || z > clip.z1)) continue;
        let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        if ((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2 <= w * w) layer[j * this.nx + i] = v;
      }
    }
  }
  rect(layer: Uint8Array, x0: number, z0: number, x1: number, z1: number, v = 1) {
    for (let j = Math.max(0, this.iz(z0)); j <= Math.min(this.nz - 1, this.iz(z1 - 1e-6)); j++)
      for (let i = Math.max(0, this.ix(x0)); i <= Math.min(this.nx - 1, this.ix(x1 - 1e-6)); i++) {
        const x = this.cx(i), z = this.cz(j);
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) layer[j * this.nx + i] = v;
      }
  }
  /** keep only the region inside a box */
  clipRegion(x0: number, z0: number, x1: number, z1: number) {
    for (let j = 0; j < this.nz; j++) for (let i = 0; i < this.nx; i++) {
      const x = this.cx(i), z = this.cz(j);
      if (x < x0 || x > x1 || z < z0 || z > z1) this.region[j * this.nx + i] = 0;
    }
  }

  /** work out the free cells: the region eroded by the body's radius, less everything within it of a collider */
  computeFree(set: ColliderSet, dynamicOnly = false) {
    const n = this.nx * this.nz;
    if (!dynamicOnly || !this.staticFree) {
      const f = new Uint8Array(n);
      for (let j = 1; j < this.nz - 1; j++) for (let i = 1; i < this.nx - 1; i++) {
        const k = j * this.nx + i;
        // a neighbour outside the region is 0.25 m away (closer than the radius); a diagonal one 0.35 m (not)
        if (this.region[k] && this.region[k - 1] && this.region[k + 1] && this.region[k - this.nx] && this.region[k + this.nx]) f[k] = 1;
      }
      for (const o of set.all) if (o.on && !o.dyn) this.carve(f, o);
      this.staticFree = f;
    }
    this.free = this.staticFree.slice();
    for (const o of set.all) if (o.on && o.dyn) this.carve(this.free, o);
  }
  private carve(f: Uint8Array, o: Collider) {
    const R = RADIUS + 0.02, h = { d: 0, nx: 0, nz: 0 };
    const i0 = Math.max(0, this.ix(o.minx - R)), i1 = Math.min(this.nx - 1, this.ix(o.maxx + R));
    const j0 = Math.max(0, this.iz(o.minz - R)), j1 = Math.min(this.nz - 1, this.iz(o.maxz + R));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.nx + i;
      if (!f[k]) continue;
      if (distTo(o, this.cx(i), this.cz(j), h).d < R) f[k] = 0;
    }
  }

  // ------------------------------------------------------------------ queries
  /** the nearest free cell centre to a point (searching outward up to maxR metres) */
  nearestFree(x: number, z: number, maxR = 60): [number, number] | null {
    const ci = this.ix(x), cj = this.iz(z), R = Math.ceil(maxR / CELL);
    let best: [number, number] | null = null, bd = Infinity;
    for (let r = 0; r <= R; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= this.nx || j >= this.nz || !this.free[j * this.nx + i]) continue;
        const d = (this.cx(i) - x) ** 2 + (this.cz(j) - z) ** 2;
        if (d < bd) { bd = d; best = [this.cx(i), this.cz(j)]; }
      }
      if (best && Math.sqrt(bd) <= r * CELL) return best;
    }
    return best;
  }
  /** can you walk straight from a to b (every cell along it free)? */
  clear(ax: number, az: number, bx: number, bz: number) {
    const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / 0.2));
    for (let k = 0; k <= n; k++) { const t = k / n; if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  /** A* over free cells (8-connected, no cutting corners), then the path pulled tight. null if unreachable. */
  path(ax: number, az: number, bx: number, bz: number, maxExpand = 250000): P2[] | null {
    let s = this.idx(ax, az), t = this.idx(bx, bz);
    if (s < 0 || t < 0) return null;
    if (!this.free[s]) { const p = this.nearestFree(ax, az, 3); if (!p) return null; s = this.idx(p[0], p[1]); }
    if (!this.free[t]) { const p = this.nearestFree(bx, bz, 3); if (!p) return null; t = this.idx(p[0], p[1]); bx = p[0]; bz = p[1]; }
    const run = ++this.run, nx = this.nx, ti = t % nx, tj = (t / nx) | 0;
    const hfun = (k: number) => { const di = Math.abs((k % nx) - ti), dj = Math.abs(((k / nx) | 0) - tj); return (Math.max(di, dj) + 0.4142 * Math.min(di, dj)) * CELL; };
    this.hn = 0; this.g[s] = 0; this.seen[s] = run; this.from[s] = -1; this.push(s, hfun(s));
    let found = false, expand = 0;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
    while (this.hn > 0) {
      const k = this.pop();
      if (this.closed[k] === run) continue;
      this.closed[k] = run;
      if (k === t) { found = true; break; }
      if (++expand > maxExpand) break;
      const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, c] of D) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= this.nz) continue;
        const q = jj * nx + ii;
        if (!this.free[q] || this.closed[q] === run) continue;
        if (di && dj && (!this.free[j * nx + ii] || !this.free[jj * nx + i])) continue;
        const ng = this.g[k] + c * CELL;
        if (this.seen[q] !== run || ng < this.g[q]) { this.seen[q] = run; this.g[q] = ng; this.from[q] = k; this.push(q, ng + hfun(q)); }
      }
    }
    if (!found) return null;
    const cells: P2[] = [];
    for (let k = t; k >= 0; k = this.from[k]) cells.push([this.cx(k % nx), this.cz((k / nx) | 0)]);
    cells.reverse();
    cells[cells.length - 1] = [bx, bz];
    if (this.isFree(ax, az)) cells[0] = [ax, az];
    // pull the string tight: from each corner, jump to the farthest point still in plain sight
    const out: P2[] = [cells[0]];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.clear(cells[a][0], cells[a][1], cells[b][0], cells[b][1])) b--;
      out.push(cells[b]); a = b;
    }
    return out;
  }
  private push(k: number, f: number) {
    if (this.hn >= this.heap.length) return;
    let i = this.hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.hf[p] <= f) break; this.heap[i] = this.heap[p]; this.hf[i] = this.hf[p]; i = p; }
    this.heap[i] = k; this.hf[i] = f;
  }
  private pop() {
    const top = this.heap[0], last = this.heap[--this.hn], lf = this.hf[this.hn];
    let i = 0;
    for (;;) {
      let c = i * 2 + 1; if (c >= this.hn) break;
      if (c + 1 < this.hn && this.hf[c + 1] < this.hf[c]) c++;
      if (this.hf[c] >= lf) break;
      this.heap[i] = this.heap[c]; this.hf[i] = this.hf[c]; i = c;
    }
    this.heap[i] = last; this.hf[i] = lf;
    return top;
  }
  /** the region as run lengths per row, for the test page's checker */
  exportRegion() {
    const rows: number[][] = [];
    for (let j = 0; j < this.nz; j++) {
      const r: number[] = []; let i = 0;
      while (i < this.nx) {
        while (i < this.nx && !this.region[j * this.nx + i]) i++;
        if (i >= this.nx) break;
        const a = i; while (i < this.nx && this.region[j * this.nx + i]) i++;
        r.push(a, i - a);
      }
      rows.push(r);
    }
    return { x0: this.x0, z0: this.z0, cell: CELL, nx: this.nx, nz: this.nz, rows };
  }
}
