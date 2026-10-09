// The real Orange County freeway network: 20 carriageways (ten freeways, both directions) and every ramp that
// hangs off them, decoded from src/data/oc-network.json (built by tools/oc-network from Overture Maps data,
// which is derived from OpenStreetMap). Answers the questions the game asks: which roads are near a point,
// which surface you're on, where the barriers are, how tall the ground is, and how to get from A to B.

import { Path, STEP, Junction } from './Path';
import { clamp } from '../util';
import raw from '../../data/oc-network.json';

interface RawPath { k: 'm' | 'l'; n: number; p: number[]; lanes: number; route?: string; dir?: string; name?: string; conn?: number }
interface RawSign { p: number; i: number; side: 'L' | 'R'; ramp: number; text: string[] }
interface RawOver { name: string | null; cls: string; a: [number, number]; b: [number, number]; y: number; w: number }
interface RawNet {
  v: number; origin: [number, number]; attribution: string; paths: RawPath[]; junctions: [number, number][][];
  signs: RawSign[]; overpasses: RawOver[]; terrain: { x0: number; z0: number; dx: number; nx: number; nz: number; q: number; data: string };
}

export interface Sign { path: Path; s: number; side: 'L' | 'R'; ramp: Path; text: string[] }
export interface Overpass { name: string; cls: string; ax: number; az: number; bx: number; bz: number; y: number; w: number; id: number }
export interface Hit { path: Path; s: number; d: number; dist: number }
export interface Wall { ax: number; az: number; bx: number; bz: number; nx: number; nz: number; y: number; capA: boolean; capB: boolean }

export const ROUTE_LABEL: Record<string, string> = {
  'I-5': '5', 'I-405': '405', 'SR-91': '91', 'SR-55': '55', 'SR-57': '57', 'SR-22': '22', 'SR-73': '73', 'SR-133': '133', 'SR-241': '241', 'SR-261': '261',
};
export const DIR_WORD: Record<string, string> = { N: 'North', S: 'South', E: 'East', W: 'West' };

const CELL = 50;
const cellKey = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);

export class Network {
  readonly paths: Path[] = [];
  readonly mains: Path[] = [];
  readonly signs: Sign[] = [];
  readonly overpasses: Overpass[] = [];
  readonly attribution: string;
  readonly origin: [number, number];
  private grid = new Map<number, number[]>();
  // terrain grid
  readonly tx0: number; readonly tz0: number; readonly tdx: number; readonly tnx: number; readonly tnz: number;
  heights!: Float32Array;
  // barrier state per path and side: -1 unknown, 0 open, 1 barrier
  private walls = new Map<number, { L: Int8Array; R: Int8Array }>();

  private constructor(private data: RawNet) {
    this.attribution = data.attribution;
    this.origin = data.origin;
    data.paths.forEach((rp, id) => {
      const ctrl = new Float64Array(rp.n * 3);
      let x = 0, z = 0, y = 0;
      for (let i = 0; i < rp.n; i++) {
        x += rp.p[i * 3]; z += rp.p[i * 3 + 1]; y += rp.p[i * 3 + 2];
        ctrl[i * 3] = x / 10; ctrl[i * 3 + 1] = z / 10; ctrl[i * 3 + 2] = y / 10;
      }
      const p = new Path(id, rp.k, rp.lanes, ctrl, rp.route ?? null, rp.dir ?? null, rp.name ?? null, !!rp.conn);
      if (p.main) { p.label = `${p.route!.startsWith('I-') ? 'I-' : 'CA-'}${ROUTE_LABEL[p.route!]} ${DIR_WORD[p.dir!]}`; this.mains.push(p); }
      this.paths.push(p);
    });
    // junctions: who flows into whom
    for (const j of data.junctions) {
      const ent = j.map(([pid, ci]) => ({ p: this.paths[pid], s: this.paths[pid].ctrlS[ci], ci }));
      for (const a of ent) for (const b of ent) {
        if (a === b || a.p === b.p) continue;
        const aStarts = a.ci === 0, aEnds = a.ci === data.paths[a.p.id].n - 1;
        const bStarts = b.ci === 0, bEnds = b.ci === data.paths[b.p.id].n - 1;
        let kind: Junction['kind'] | null = null;
        if (bStarts && !aStarts) kind = aEnds ? 'continue' : 'diverge';
        else if (aEnds && !bEnds && !bStarts) kind = 'merge';
        if (!kind) continue;
        a.p.out.push({ s: a.s, to: b.p, toS: b.s, kind });
        b.p.inc.push({ s: b.s, to: a.p, toS: a.s, kind });
      }
    }
    for (const p of this.paths) {
      p.out.sort((u, v) => u.s - v.s); p.inc.sort((u, v) => u.s - v.s);
      // carry on past the end: prefer a main, then the widest
      const ends = p.out.filter((o) => o.s >= p.len - 1);
      if (ends.length) p.next = ends.sort((u, v) => (u.to.main === v.to.main ? v.to.lanes - u.to.lanes : u.to.main ? -1 : 1))[0].to;
    }
    for (const p of this.paths) if (p.next && !p.next.prev) p.next.prev = p;
    // ramp labels: where it leads
    for (const p of this.paths) if (!p.main) p.label = this.leadsTo(p);
    // spatial grid: every 8 m of every path
    for (const p of this.paths) {
      const seen = new Set<number>();
      for (let i = 0; i < p.n; i += 4) {
        const k = cellKey(Math.floor(p.xs[i] / CELL), Math.floor(p.zs[i] / CELL));
        if (seen.has(k)) continue;
        seen.add(k);
        let a = this.grid.get(k); if (!a) this.grid.set(k, (a = []));
        a.push(p.id, i);
      }
    }
    for (const s of data.signs) {
      const p = this.paths[s.p];
      this.signs.push({ path: p, s: p.ctrlS[s.i], side: s.side, ramp: this.paths[s.ramp], text: s.text });
    }
    data.overpasses.forEach((o, id) => this.overpasses.push({ name: o.name ?? '', cls: o.cls, ax: o.a[0], az: o.a[1], bx: o.b[0], bz: o.b[1], y: o.y, w: o.w, id }));
    const t = data.terrain;
    this.tx0 = t.x0; this.tz0 = t.z0; this.tdx = t.dx; this.tnx = t.nx; this.tnz = t.nz;
  }

  static async load(): Promise<Network> {
    const net = new Network(raw as unknown as RawNet);
    await net.decodeTerrain();
    return net;
  }

  private async decodeTerrain() {
    const t = this.data.terrain;
    const bin = Uint8Array.from(atob(t.data), (c) => c.charCodeAt(0));
    let bytes: Uint8Array;
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error('This browser cannot unpack the terrain (no DecompressionStream).');
    const d = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const h = new Float32Array(t.nx * t.nz);
    for (let r = 0; r < t.nz; r++) {
      let acc = 0;
      for (let c = 0; c < t.nx; c++) { acc += d[r * t.nx + c]; h[r * t.nx + c] = acc * t.q; }
    }
    this.heights = h;
  }

  // bare-earth height (metres above sea level), bilinear
  ground(x: number, z: number) {
    const fx = clamp((x - this.tx0) / this.tdx, 0, this.tnx - 1.001), fz = clamp((z - this.tz0) / this.tdx, 0, this.tnz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = this.heights, n = this.tnx;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  // roads whose centreline passes within r of (x, z): one hit per path (per stretch of it)
  near(x: number, z: number, r: number, out: Hit[] = []): Hit[] {
    out.length = 0;
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL), r0 = Math.floor((z - r) / CELL), r1 = Math.floor((z + r) / CELL);
    const best = new Map<number, Hit>();
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const a = this.grid.get(cellKey(cx, cz));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const p = this.paths[a[k]], i = a[k + 1];
        const pr = p.project(x, z, i * STEP, PR);
        if (pr.s < -2 || pr.s > p.len + 2) continue;
        const key = p.id * 4096 + Math.floor(pr.s / 400);
        const dist = Math.abs(pr.d);
        if (dist > r + p.paveR) continue;
        const prev = best.get(key);
        if (!prev || dist < prev.dist) best.set(key, { path: p, s: pr.s, d: pr.d, dist });
      }
    }
    for (const h of best.values()) out.push(h);
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }

  // the paved surfaces under (x, z) at about height y (bridges above or below don't count)
  surfaces(x: number, z: number, y: number, margin = 0, out: Hit[] = []) {
    const hits = this.near(x, z, 30, HITS);
    out.length = 0;
    for (const h of hits) {
      const p = h.path;
      if (h.s < -margin || h.s > p.len + margin) continue;
      if (h.d < p.paveL - margin || h.d > p.paveR + margin) continue;
      if (Math.abs(p.height(clamp(h.s, 0, p.len)) - y) > 2.5) continue;
      out.push({ ...h });
    }
    return out;
  }

  // is (x, z, y) on some road other than `self` (and better ranked, if asked)?
  covered(x: number, z: number, y: number, self: Path, margin: number, rankedAbove = false) {
    const hits = this.near(x, z, 28, HITS2);
    for (const h of hits) {
      const p = h.path;
      if (p === self) continue;
      if (rankedAbove && rank(p) > rank(self)) continue;
      if (h.s < 0 || h.s > p.len) continue;
      if (h.d < p.paveL - margin || h.d > p.paveR + margin) continue;
      if (Math.abs(p.height(h.s) - y) > 2.5) continue;
      return true;
    }
    return false;
  }

  // barriers: a path has one along each paved edge wherever that edge isn't running into another road
  private wallState(p: Path) {
    let w = this.walls.get(p.id);
    if (!w) { w = { L: new Int8Array(p.n).fill(-1), R: new Int8Array(p.n).fill(-1) }; this.walls.set(p.id, w); }
    return w;
  }
  hasWall(p: Path, i: number, side: 'L' | 'R') {
    const w = this.wallState(p)[side];
    if (w[i] < 0) {
      const lo = Math.max(0, i - 32), hi = Math.min(p.n - 1, i + 32);
      for (let k = lo; k <= hi; k++) {
        if (w[k] >= 0) continue;
        const d = side === 'L' ? p.wallL : p.wallR;
        const at = p.at(k * STEP, d, AT);
        w[k] = this.covered(at.x, at.z, at.y, p, 0.6) ? 0 : 1;
      }
      // no barrier across the first/last few metres where a ramp starts or ends at another road
      if (p.prev || p.inc.some((j) => j.s < 1)) for (let k = 0; k < Math.min(p.n, 3); k++) w[k] = w[k] && 1;
    }
    return w[i] === 1;
  }

  // barrier segments within r of (x, z), near height y, for the physics
  wallsNear(x: number, z: number, y: number, r: number, out: Wall[]) {
    out.length = 0;
    const hits = this.near(x, z, r + 25, HITS3);
    for (const h of hits) {
      const p = h.path;
      if (Math.abs(p.height(clamp(h.s, 0, p.len)) - y) > 3.5) continue;
      const i0 = clamp(Math.floor((h.s - r) / STEP), 0, p.n - 2), i1 = clamp(Math.ceil((h.s + r) / STEP), 0, p.n - 2);
      for (const side of ['L', 'R'] as const) {
        const d = side === 'L' ? p.wallL : p.wallR;
        for (let i = i0; i <= i1; i++) {
          if (!this.hasWall(p, i, side) || !this.hasWall(p, i + 1, side)) continue;
          const a = p.at(i * STEP, d, AT), ax = a.x, az = a.z, ay = a.y;
          const b = p.at((i + 1) * STEP, d, AT);
          // normal pointing back onto this road: the right barrier faces left, the left one faces right
          // (with t = (sin h, cos h), right is (-t.z, t.x))
          const tx = b.x - ax, tz = b.z - az, L = Math.hypot(tx, tz) || 1;
          const nx = side === 'R' ? tz / L : -tz / L, nz = side === 'R' ? -tx / L : tx / L;
          const capA = i === 0 || !this.hasWall(p, i - 1, side), capB = i + 2 >= p.n || !this.hasWall(p, i + 2, side);
          out.push({ ax, az, bx: b.x, bz: b.z, nx, nz, y: ay, capA, capB });
        }
      }
      // a dead end: a wall across the end of the road
      if (!p.next && p.len - h.s < r + 5) {
        const e = p.len - 0.5;
        const a = p.at(e, p.wallL, AT), ax = a.x, az = a.z; const b = p.at(e, p.wallR, AT);
        const hd = p.heading(e);
        out.push({ ax, az, bx: b.x, bz: b.z, nx: -Math.sin(hd), nz: -Math.cos(hd), y: a.y, capA: false, capB: false });
      }
    }
    return out;
  }

  // where does this ramp lead? (the freeway it joins, or the street it ends at)
  leadsTo(p: Path, depth = 0): string {
    if (p.main) return p.label;
    if (depth > 6) return '';
    for (const j of p.out) if (j.to.main) return j.to.label;
    for (const j of p.out) { const l = this.leadsTo(j.to, depth + 1); if (l) return l; }
    return '';
  }

  // the cheapest way from where you are to a target path (entering it anywhere), as a list of hand-offs
  route(from: Path, fromS: number, to: Path, toS = -1): Junction[] | null {
    type St = { p: Path; s: number; cost: number; via: Junction[] };
    const best = new Map<number, number>();
    const open: St[] = [{ p: from, s: fromS, cost: 0, via: [] }];
    let found: St | null = null;
    let guard = 0;
    while (open.length && guard++ < 20000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].cost < open[bi].cost) bi = i;
      const st = open.splice(bi, 1)[0];
      if (st.p === to && (toS < 0 || st.s <= toS)) { found = st; break; }
      const key = st.p.id * 1000 + Math.floor(st.s / 200);
      if ((best.get(key) ?? Infinity) <= st.cost) continue;
      best.set(key, st.cost);
      for (const j of st.p.out) {
        if (j.s < st.s - 1) continue;
        open.push({ p: j.to, s: j.toS, cost: st.cost + (j.s - st.s) + (j.to.main ? 0 : 30), via: [...st.via, j] });
      }
    }
    return found ? found.via : null;
  }
}

// mains first, then ramps; among equals the lower id wins
export const rank = (p: Path) => (p.main ? 0 : 1e6) + p.id;

const PR = { s: 0, d: 0 };
const HITS: Hit[] = [], HITS2: Hit[] = [], HITS3: Hit[] = [];
const AT = { x: 0, y: 0, z: 0, h: 0 };
