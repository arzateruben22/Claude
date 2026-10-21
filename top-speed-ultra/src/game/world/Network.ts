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
// How far a road can be over another's pavement and still count as on it (no barrier, crash cushion or deck side there;
// its surface left out there if the other is better ranked). Below, 2.5 m. Above, GIVE_WAY for what hangs under a road: its
// deck hangs 1.5 m under its surface and a Jersey barrier's back 1.4 m, so at 2.5 to 4 m up they stood in the lanes
// underneath, 1 to 2.5 m above them: where the map's heights have a ramp climbing away alongside a freeway or settling
// onto it, its deck and barriers hung across the freeway's lanes as slabs and pieces of barrier at windscreen height.
// From 4 m its deck clears 2.5 m. Its surface (and paint) gives way only up to LEVEL: a sheet with nothing under it, seen
// from below it isn't drawn at all, so 2.5 m up it's clear of the lanes underneath, and leaving it out too cut holes in
// the ramp under the feet of anyone driving it.
export const GIVE_WAY = 4.0, LEVEL = 2.5;
export const onTop = (y: number, oy: number, above = GIVE_WAY) => y - oy >= -2.5 && y - oy <= above;
const cellKey = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);

export class Network {
  readonly paths: Path[] = [];
  readonly mains: Path[] = [];
  readonly signs: Sign[] = [];
  readonly overpasses: Overpass[] = [];
  readonly attribution: string;
  readonly origin: [number, number];
  private grid = new Map<number, number[]>();
  // the widest paved half-width of any path: how much further than r a centreline can be from (x, z) when the path's
  // pavement is still within r (near() adds half the grid's 8 m sample spacing on top)
  private reach = 0;
  // terrain grid
  readonly tx0: number; readonly tz0: number; readonly tdx: number; readonly tnx: number; readonly tnz: number;
  heights!: Float32Array;
  // barrier state per path and side: -1 unknown, 0 open, 1 barrier
  private walls = new Map<number, { L: Int8Array; R: Int8Array }>();
  private ends = new Map<number, boolean>();

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
    // spatial grid: every 8 m of every path, an entry each time the path enters a cell (not just the first: a ramp that
    // curls out of a cell and back into it was missing from it the second time, and near() never saw it there)
    for (const p of this.paths) {
      this.reach = Math.max(this.reach, p.paveR, -p.paveL);
      let last = -1;
      for (let i = 0; i < p.n; i += 4) {
        const k = cellKey(Math.floor(p.xs[i] / CELL), Math.floor(p.zs[i] / CELL));
        if (k === last) continue;
        last = k;
        let a = this.grid.get(k); if (!a) this.grid.set(k, (a = []));
        a.push(p.id, i);
      }
    }
    this.bridgeSags();
    this.levelOverlaps();
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

  // A bridge whose middle the map brought down to the road it crosses: a road more than 25 degrees off another, within 4 m
  // of it where its centreline is over that road's pavement, and SAG metres or more above it (or below it) on both sides.
  // Its heights across are taken straight from the last sample that clear on one side to the first on the other. (Ramp
  // 1203, a loop over the I-5 near the CA-55, came down from 7 m over the freeway to its level in 30 m, 117%, across both
  // carriageways and back up: a ski jump of ramp, barriers and surface coming down into the I-5 North's left lanes, its
  // surface 2 m over them.)
  private bridgeSags() {
    const SAG = 5, NEAR = 4, LOOK = 60, ALONG = Math.cos(Math.PI / 7), hits: Hit[] = [], W = LOOK / STEP;
    for (const p of this.paths) {
      // a sag climbs SAG in LOOK metres or less on each side, so only the samples within LOOK of a grade that steep
      // (on average over 10 m) are looked at
      const steep = new Uint8Array(p.n);
      let none = true;
      for (let k = 0; k + 5 < p.n; k++) if (Math.abs(p.ys[k + 5] - p.ys[k]) >= (SAG / LOOK) * 5 * STEP) { steep[k] = 1; none = false; }
      if (none) continue;
      const look = new Uint8Array(p.n);
      for (let k = 0, last = -1e9; k < p.n; k++) { if (steep[k]) last = k; if (k - last <= W + 5) look[k] = 1; }
      for (let k = p.n - 1, last = 1e9; k >= 0; k--) { if (steep[k]) last = k; if (last - k <= W) look[k] = 1; }
      // the stretches whose centreline crosses another road within NEAR of it, with the highest and lowest of those roads
      const runs: { k0: number; k1: number; hi: number; lo: number }[] = [];
      for (let k = 0; k < p.n; k++) {
        if (!look[k]) continue;
        const x = p.xs[k], z = p.zs[k], y = p.ys[k];
        let q: number | null = null;
        for (const h of this.near(x, z, 0.5, hits)) {
          const o = h.path;
          if (o === p || h.s < 0 || h.s > o.len || h.d < o.paveL || h.d > o.paveR) continue;
          if (Math.cos(p.hs[k] - o.heading(h.s)) >= ALONG) continue;
          const oy = o.height(h.s);
          if (Math.abs(y - oy) < NEAR) { q = oy; break; }
        }
        if (q === null) continue;
        const last = runs[runs.length - 1];
        if (last && k - last.k1 <= 10) { last.k1 = k; last.hi = Math.max(last.hi, q); last.lo = Math.min(last.lo, q); }
        else runs.push({ k0: k, k1: k, hi: q, lo: q });
      }
      if (!runs.length) continue;
      const dy = new Float32Array(p.n);
      let any = false;
      for (const r of runs) {
        // out from the stretch on each side to where this road clears every road it crosses there by SAG, over or under,
        // and on to the top of the climb (or the foot of the fall), so it spans at its own height
        const clear = (k: number, up: boolean) => (up ? p.ys[k] - r.hi >= SAG : r.lo - p.ys[k] >= SAG);
        const on = (k: number, j: number, up: boolean) => (up ? p.ys[j] > p.ys[k] + 0.01 : p.ys[j] < p.ys[k] - 0.01);
        for (const up of [true, false]) {
          let a = r.k0, b = r.k1;
          while (a > 0 && r.k0 - a < W && !clear(a, up)) a--;
          while (b < p.n - 1 && b - r.k1 < W && !clear(b, up)) b++;
          if (!clear(a, up) || !clear(b, up)) continue;
          while (a > 0 && r.k0 - a < W && on(a, a - 1, up)) a--;
          while (b < p.n - 1 && b - r.k1 < W && on(b, b + 1, up)) b++;
          for (let k = a + 1; k < b; k++) dy[k] = p.ys[a] + ((p.ys[b] - p.ys[a]) * (k - a)) / (b - a) - p.ys[k];
          any = true;
        }
      }
      if (any) p.lift(dy);
    }
  }

  // Where a road's pavement lies on a better-ranked road's, running along it (the first and last few hundred metres of
  // a ramp, a freeway starting in or ending in another, a cut-off ramp along a freeway), its heights become that
  // road's, eased back to its own over EASE metres beyond. The map's heights put the two up to 4 m apart there (one on
  // a viaduct or a grade, the other on its own control points): the one's deck, barriers and surface stood across the
  // other's lanes at bumper and windscreen height, and its cars drove under the other's surface. Roads' give-way rules
  // cut those pieces away, but the car still drove through the slab under a road 0.3 to 2.5 m over it (the CA-55 North
  // ending in the CA-91 East). Mains first, in rank order, so a ramp follows a freeway's final heights; a crossing road
  // (more than about 25 degrees off) keeps its own, as a flyover. At every junction with a road already settled, a road
  // keeps level with it: a ramp piece that follows a freeway while the piece it carries on from doesn't (a better-ranked
  // road isn't moved for a worse one) stood up to 2.8 m above or below it where the two meet, a step across the lanes.
  private levelOverlaps() {
    // looked at every EVAL samples (16 m), candidates gathered from the grid every GATHER (48 m); the offset eases out
    // over EASE metres or at GRADE, whichever is longer, and is smoothed over ±SMOOTH samples
    const EVAL = 8, GATHER = 24, EASE = 100, GRADE = 0.04, SMOOTH = 10, KEEP = 5, ALONG = Math.cos(Math.PI / 7), PRQ = { s: 0, d: 0 };
    const ease = (t: number) => (t >= 1 ? 0 : 1 - t * t * (3 - 2 * t));
    // values held at the `fixed` samples, eased out from the nearest one on each side over EASE (or at GRADE), or carried
    // across a short gap between two
    const spread = (val: Float32Array, fixed: Uint8Array) => {
      const n = val.length, out = new Float32Array(val), L = new Int32Array(n), R = new Int32Array(n);
      for (let i = 0, last = -1; i < n; i++) { if (fixed[i]) last = i; L[i] = last; }
      for (let i = n - 1, last = -1; i >= 0; i--) { if (fixed[i]) last = i; R[i] = last; }
      for (let i = 0; i < n; i++) {
        if (fixed[i]) continue;
        const l = L[i], r = R[i], dl = l >= 0 ? val[l] : 0, dr = r >= 0 ? val[r] : 0;
        const lenL = Math.max(EASE, Math.abs(dl) / GRADE), lenR = Math.max(EASE, Math.abs(dr) / GRADE);
        if (l >= 0 && r >= 0 && (r - l) * STEP <= lenL + lenR) { const t = (i - l) / (r - l); out[i] = dl + (dr - dl) * t * t * (3 - 2 * t); }
        else if (l >= 0 && (i - l) * STEP < lenL) out[i] = dl * ease(((i - l) * STEP) / lenL);
        else if (r >= 0 && (r - i) * STEP < lenR) out[i] = dr * ease(((r - i) * STEP) / lenR);
        else out[i] = 0;
      }
      return out;
    };
    // each settled road's offsets, to keep level with at a junction
    const settled = new Map<Path, Float32Array>();
    const offsetAt = (q: Path, s: number) => {
      const o = settled.get(q);
      if (!o) return 0;
      const f = clamp(s / STEP, 0, q.n - 1), i = Math.min(q.n - 2, Math.floor(f));
      return o[i] + (o[i + 1] - o[i]) * (f - i);
    };
    // the junctions each road is at: every road meeting there, not just the pairs that lead into each other (two ramp
    // pieces both carrying on into a third have to stay level with each other too)
    const meets = new Map<Path, { s: number; others: { q: Path; s: number }[] }[]>();
    for (const node of this.data.junctions) {
      const ent = node.map(([pid, ci]) => ({ q: this.paths[pid], s: this.paths[pid].ctrlS[ci] }));
      for (const e of ent) {
        let a = meets.get(e.q); if (!a) meets.set(e.q, (a = []));
        a.push({ s: e.s, others: ent.filter((o) => o.q !== e.q) });
      }
    }
    for (const p of [...this.paths].sort((a, b) => rank(a) - rank(b))) {
      const n = p.n, delta = new Float32Array(n), zone = new Uint8Array(n), cand = new Map<Path, number>();
      let any = false, cur: Path | null = null;
      const look = (k: number) => {
        const x = p.xs[k], z = p.zs[k];
        if (k % GATHER === 0) {
          const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
          for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
            const a = this.grid.get(cellKey(cx + i, cz + j));
            if (!a) continue;
            for (let m = 0; m < a.length; m += 2) { const q = this.paths[a[m]]; if (q !== p && rank(q) < rank(p) && !cand.has(q)) cand.set(q, a[m + 1] * STEP); }
          }
        }
        let best = 0, bestQ: Path | null = null;
        for (const [q, guess] of cand) {
          const pr = q.project(x, z, guess, PRQ);
          cand.set(q, pr.s);
          if (Math.abs(pr.d) > 60 || pr.s < -40 || pr.s > q.len + 40) { cand.delete(q); continue; }
          if (pr.s < 0 || pr.s > q.len || pr.d + p.paveL >= q.paveR || pr.d + p.paveR <= q.paveL) continue;   // the pavements don't overlap
          if (Math.cos(p.hs[k] - q.heading(pr.s)) < ALONG) continue;                                          // crossing, not alongside
          const dy = q.height(pr.s) - p.ys[k];
          // stay with the road already followed while within KEEP of it; take up a new one only within GIVE_WAY (a
          // flyover alongside keeps its height, and a collector alongside for kilometres is let go as it climbs away)
          if (q === cur && Math.abs(dy) <= KEEP) { best = dy; bestQ = q; break; }
          if (Math.abs(dy) > GIVE_WAY || (bestQ && Math.abs(dy) >= Math.abs(best))) continue;
          best = dy; bestQ = q;
        }
        cur = bestQ;
        if (bestQ) { delta[k] = best; zone[k] = 1; any = true; }
      };
      for (let k = 0; k < n; k += EVAL) look(k);
      if ((n - 1) % EVAL) look(n - 1);
      const sm = new Float32Array(n);
      if (any) {
        // between two looked-at samples both on the other road, so is every sample (its offset interpolated)
        for (let k0 = 0; k0 < n - 1; k0 += EVAL) {
          const k1 = Math.min(n - 1, k0 + EVAL);
          if (!zone[k0] || !zone[k1]) continue;
          for (let k = k0 + 1; k < k1; k++) { zone[k] = 1; delta[k] = delta[k0] + ((delta[k1] - delta[k0]) * (k - k0)) / (k1 - k0); }
        }
        // elsewhere: eased out from the nearest stretch on each side, or carried across a short gap between two
        const out = spread(delta, zone);
        // smoothed, so a switch between two roads followed is a bump, not a step
        for (let i = 0; i < n; i++) {
          let acc = 0, wsum = 0;
          for (let j = -SMOOTH; j <= SMOOTH; j++) { const k = i + j; if (k < 0 || k >= n) continue; const w = SMOOTH + 1 - Math.abs(j); acc += out[k] * w; wsum += w; }
          sm[i] = acc / wsum;
        }
      }
      // level with every settled road it meets, at the junction (the change eased in from either side of it), whether
      // or not this road follows another itself (a ramp carrying on from a piece that was moved)
      const fix = new Float32Array(n), at = new Uint8Array(n);
      let moved = any;
      for (const m of meets.get(p) ?? []) {
        // the roads here settled before this one (the others settle after it, and keep level with it then)
        let sum = 0, cnt = 0;
        for (const o of m.others) if (rank(o.q) < rank(p)) { sum += offsetAt(o.q, o.s); cnt++; }
        if (!cnt) continue;
        const k = clamp(Math.round(m.s / STEP), 0, n - 1), c = sum / cnt - sm[k];
        fix[k] = at[k] ? (fix[k] + c) / 2 : c; at[k] = 1;
        if (Math.abs(c) > 1e-3) moved = true;
      }
      if (!moved) continue;
      const corr = spread(fix, at);
      for (let i = 0; i < n; i++) sm[i] += corr[i];
      p.lift(sm);
      settled.set(p, sm);
    }
  }

  // bare-earth height (metres above sea level), bilinear
  ground(x: number, z: number) {
    const fx = clamp((x - this.tx0) / this.tdx, 0, this.tnx - 1.001), fz = clamp((z - this.tz0) / this.tdx, 0, this.tnz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, H = this.heights, n = this.tnx;
    const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  // roads near (x, z): every path whose centreline (its ends included) comes within r + its paved half-width, so whose
  // pavement comes within about r; one hit per path (per 400 m stretch of it), with s unclamped past an end. The grid
  // keeps every 8th metre of each centreline, so the cells searched reach the widest pavement and half a sample spacing
  // past r: a search for what's within 2 m of a shrub has to find the freeway whose centreline is 14 m away in the next
  // cell. (It searched only r, and scenery placed "clear of the roads" came up on the outer lanes and shoulders wherever
  // the centreline was in another cell.)
  near(x: number, z: number, r: number, out: Hit[] = []): Hit[] {
    out.length = 0;
    const R = r + this.reach + STEP * 2 + 1;
    const c0 = Math.floor((x - R) / CELL), c1 = Math.floor((x + R) / CELL), r0 = Math.floor((z - R) / CELL), r1 = Math.floor((z + R) / CELL);
    const best = new Map<number, Hit>();
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const a = this.grid.get(cellKey(cx, cz));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) {
        const p = this.paths[a[k]], i = a[k + 1];
        const pr = p.project(x, z, i * STEP, PR);
        // a projection from a guess far along a curling ramp may not have converged: its (s, d) leads somewhere else, and
        // was taken as that road being here (a hole in a lane, a barrier missing). Step it on; if it still doesn't lead
        // back to the point, keep the road at its true distance from the point of it reached, which can only overstate
        // how far it is (a far search, a terrain tile's, still learns the road is there)
        for (let t = 0; t < 2 && !lands(p, x, z, pr); t++) p.project(x, z, pr.s, pr);
        if (!lands(p, x, z, pr)) {
          const sc = clamp(pr.s, 0, p.len), a = p.at(sc, 0, AT_NEAR);
          pr.d = (pr.d < 0 ? -1 : 1) * Math.hypot(a.x - x, a.z - z); pr.s = sc;
        }
        // past an end, the distance is to the end (it dropped every road that ends near the point and not across from
        // it: a terrain tile whose centre was past a ramp's end never knew the ramp crossed it, and buried it)
        const over = pr.s < 0 ? -pr.s : pr.s > p.len ? pr.s - p.len : 0;
        const dist = over ? Math.hypot(over, pr.d) : Math.abs(pr.d);
        if (dist > r + p.paveR) continue;
        const key = p.id * 4096 + Math.floor(pr.s / 400);
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
    // near() reaches every road whose pavement comes within its r, so r is just the margin (it was 30 m, a guess wide
    // enough for the old search's blind spots; the wider search made that guess twice as slow)
    const hits = this.near(x, z, Math.max(1, margin + 1), HITS);
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

  // is (x, z, y) on some road other than `self` (and better ranked, if asked): over its pavement, from 2.5 m below its
  // surface to `above` over it (GIVE_WAY; LEVEL for a road's surface)?
  covered(x: number, z: number, y: number, self: Path, margin: number, rankedAbove = false, above = GIVE_WAY) {
    const hits = this.near(x, z, Math.max(1, margin + 1), HITS2);
    for (const h of hits) {
      const p = h.path;
      if (p === self) continue;
      if (rankedAbove && rank(p) > rank(self)) continue;
      if (h.s < 0 || h.s > p.len) continue;
      if (h.d < p.paveL - margin || h.d > p.paveR + margin) continue;
      if (!onTop(y, p.height(h.s), above)) continue;
      return true;
    }
    return false;
  }

  // the road (other than `self`) whose pavement, widened by margin, is under (x, z) with its surface between heights y0
  // and y1, if any: where a post, a column or a pole must not stand
  pavedAt(x: number, z: number, y0: number, y1: number, self: Path | null, margin: number) {
    for (const h of this.near(x, z, margin + 1, HITS4)) {
      const p = h.path;
      if (p === self || h.s < -margin || h.s > p.len + margin) continue;
      if (h.d < p.paveL - margin || h.d > p.paveR + margin) continue;
      const y = p.height(clamp(h.s, 0, p.len));
      if (y >= y0 && y <= y1) return p;
    }
    return null;
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
      // no barrier across the first few metres where a ramp starts at another road (set outright: these samples
      // may not have been worked out yet when the first look at this road was further along it)
      if (p.prev || p.inc.some((j) => j.s < 1)) for (let k = 0; k < Math.min(p.n, 3); k++) w[k] = 0;
    }
    return w[i] === 1;
  }

  // a wall across the end of a road that stops, unless it stops on another road (a ramp cut off at the edge of the map
  // inside a freeway, say). The whole width counts: a ramp ending with an edge on another road's shoulder had its crash
  // cushion standing on that road.
  hasEndWall(p: Path) {
    let e = this.ends.get(p.id);
    if (e === undefined) {
      e = !p.next;
      for (const d of [p.paveL, 0, p.paveR]) {
        const at = p.at(p.len - 0.5, d, AT);
        if (e && this.covered(at.x, at.z, at.y, p, 0.6)) e = false;
      }
      this.ends.set(p.id, e);
    }
    return e;
  }

  // barrier segments within r of (x, z), near height y, for the physics
  wallsNear(x: number, z: number, y: number, r: number, out: Wall[]) {
    out.length = 0;
    // a barrier's back is 0.95 m past the pavement
    const hits = this.near(x, z, r + 1.5, HITS3);
    for (const h of hits) {
      const p = h.path;
      if (Math.abs(p.height(clamp(h.s, 0, p.len)) - y) > 3.5) continue;
      const i0 = clamp(Math.floor((h.s - r) / STEP), 0, p.n - 2), i1 = clamp(Math.ceil((h.s + r) / STEP), 0, p.n - 2);
      for (const side of ['L', 'R'] as const) {
        const d = side === 'L' ? p.wallL : p.wallR;
        for (let i = i0; i <= i1; i++) {
          if (!this.hasWall(p, i, side) || !this.hasWall(p, i + 1, side)) continue;
          const a = p.at(i * STEP, d, AT), ax = a.x, az = a.z, ay = a.y;
          // a barrier more than 2 m above or below the car is over its roof or under its wheels (a ramp climbing
          // past the road you're on gets barriers once it's 2.5 m clear of it)
          if (Math.abs(ay - y) > 2) continue;
          // copied now: hasWall() below can reuse AT while it works out more of the road
          const b = p.at((i + 1) * STEP, d, AT), bx = b.x, bz = b.z;
          // normal pointing back onto this road: the right barrier faces left, the left one faces right
          // (with t = (sin h, cos h), right is (-t.z, t.x))
          const tx = bx - ax, tz = bz - az, L = Math.hypot(tx, tz) || 1;
          const nx = side === 'R' ? tz / L : -tz / L, nz = side === 'R' ? -tx / L : tx / L;
          const capA = i === 0 || !this.hasWall(p, i - 1, side), capB = i + 2 >= p.n || !this.hasWall(p, i + 2, side);
          out.push({ ax, az, bx, bz, nx, nz, y: ay, capA, capB });
        }
      }
      // a dead end: a wall across the end of the road
      if (!p.next && p.len - h.s < r + 5 && this.hasEndWall(p)) {
        const e = p.len - 0.5;
        const a = p.at(e, p.wallL, AT), ax = a.x, az = a.z; const b = p.at(e, p.wallR, AT);
        const hd = p.heading(e);
        if (Math.abs(a.y - y) <= 2) out.push({ ax, az, bx: b.x, bz: b.z, nx: -Math.sin(hd), nz: -Math.cos(hd), y: a.y, capA: false, capB: false });
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
// does (s, d) on p lead back to (x, z)? (past an end, the point is that far beyond it)
const AT_NEAR = { x: 0, y: 0, z: 0, h: 0 };
function lands(p: Path, x: number, z: number, pr: { s: number; d: number }) {
  const sc = clamp(pr.s, 0, p.len), a = p.at(sc, pr.d, AT_NEAR);
  return Math.abs(Math.hypot(a.x - x, a.z - z) - Math.abs(pr.s - sc)) < 0.5;
}
const HITS: Hit[] = [], HITS2: Hit[] = [], HITS3: Hit[] = [], HITS4: Hit[] = [];
const AT = { x: 0, y: 0, z: 0, h: 0 };
