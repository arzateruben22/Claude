// The real Orange County freeway network: 20 carriageways (ten freeways, both directions) and every ramp that
// hangs off them, decoded from src/data/oc-network.json (built by tools/oc-network from Overture Maps data,
// which is derived from OpenStreetMap). Answers the questions the game asks: which roads are near a point,
// which surface you're on, where the barriers are, how tall the ground is, and how to get from A to B.

import { Path, STEP, LANE_W, Junction } from './Path';
import { limitProfile, PIN } from './Profile';
import { clamp } from '../util';
import raw from '../../data/oc-network.json';
import baked from '../../data/oc-levels.json';

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
// the version of the height passes: bump it when bridgeSags(), levelOverlaps() or limitProfile() change what they do, so
// a build never uses heights baked by an older version (npm test also checks the baked heights against the passes)
export const LEVELS = 4;
interface Baked { version: number; sig: number; runs: [number, number, number][]; data: string; ends?: [number, number][] }
// How far a road can be over another's pavement and still count as on it: from 2.5 m below to LEVEL above, its surface
// is left out there if the other is better ranked, and it has no barrier or crash cushion there. Further up it keeps
// them (a barrier with its back cut short, in Roads): leaving the surface out cut holes in ramps under anyone driving
// them, and leaving the barriers out opened drops of 2.5 to 4 m. What hangs under a road goes over another road up to
// GIVE_WAY below: its deck hangs 1.5 m under its surface, so at 2.5 to 4 m up it stood in the lanes underneath, 1 to 2.5 m
// above them (where the map's heights have a ramp climbing away alongside a freeway or settling onto it, its deck hung
// across the freeway's lanes as slabs at windscreen height). From 4 m it clears 2.5 m. The levelling (levelOverlaps) also
// takes up another road's heights only within GIVE_WAY.
export const GIVE_WAY = 4.0, LEVEL = 2.5;
export const onTop = (y: number, oy: number, above = LEVEL) => y - oy >= -2.5 && y - oy <= above;
// Overhead clearance over a carriageway's travel lanes (California builds to about 4.9 m; 4.5 m is our floor): nothing of
// another road (its surface, deck, soffit, barriers, paint, the side of a cut) may be from 0.05 m to CLEAR over a
// carriageway's drawn travel lanes, widened by SIDE_CLEAR. A deck is thinned to DECK_MIN over them, so a road's surface
// clears them from CLEAR_TOP. (The lanes check had 2 m: ramp 800's surface stopped in mid-air 2.3 m over the I-5
// North's left lane, and the side closing it hung 2.01 to 2.31 m over that lane, a beam at windscreen height.)
export const CLEAR = 4.5, DECK_MIN = 0.4, CLEAR_TOP = CLEAR + DECK_MIN, SIDE_CLEAR = 0.05;
// The exit ramps of the Go To routes to the venues, Stoppage Time and Lot 57: every exit the venues' freeway-link files
// list (src/data/anaheim/freeway-link.json, and the live game's sportsbar-freeway-link.json; each exit's ramp_paths, 28
// ramps; the same network data as this one's). Their drawn travel lanes get the carriageways' overhead clearance
// (Path.lanesClear): ramp 895's deck hung 2.7 to 4.4 m over ramp 797's lane, the I-5 North's exit to Ball Road / Harbor
// Boulevard, a Stoppage Time exit. (Other ramps' lanes are F7 in PROJECT_OC_HANDOFF.md.)
export const GO_TO_RAMPS = new Set([
  1142, 1264, 562, 471, 195, 372, 1199, 418, 995, 93, 683, 1054, 149, 842, 951, 1099, 30, 169, 124, 492, 972,  // Lot 57
  791, 573, 209, 215, 384, 959, 797,                                                                            // and Stoppage Time's others
]);
// how far from a carriageway's pavement a road cut back off its travel lanes (Network.trimEnds) ends: its end wall stands
// on the ground beside it, not on its shoulder
const END_CLEAR = 0.5;
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
  // the map's own heights of each road bridgeSags() changed, for levelOverlaps() to measure against (dropped once loaded)
  private mapYs: Map<Path, Float32Array> | null = new Map();
  // how long the two height passes took at load, ms
  readonly loadMs = { sags: 0, level: 0, baked: 0, trim: 0 };
  // terrain grid
  readonly tx0: number; readonly tz0: number; readonly tdx: number; readonly tnx: number; readonly tnz: number;
  heights!: Float32Array;
  // barrier state per path and side: -1 unknown, 0 open, 1 barrier
  private walls = new Map<number, { L: Int8Array; R: Int8Array }>();
  private ends = new Map<number, { a: number; b: number } | null>();

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
      p.lanesClear = p.main || GO_TO_RAMPS.has(id);
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
    for (const s of data.signs) {
      const p = this.paths[s.p];
      this.signs.push({ path: p, s: p.ctrlS[s.i], side: s.side, ramp: this.paths[s.ramp], text: s.text });
    }
    data.overpasses.forEach((o, id) => this.overpasses.push({ name: o.name ?? '', cls: o.cls, ax: o.a[0], az: o.a[1], bx: o.b[0], bz: o.b[1], y: o.y, w: o.w, id }));
    const t = data.terrain;
    this.tx0 = t.x0; this.tz0 = t.z0; this.tdx = t.dx; this.tnx = t.nx; this.tnz = t.nz;
  }

  // fresh: run the height passes even if the build baked their result (the build itself, and the test that checks the
  // baked heights against them)
  static async load(fresh = false): Promise<Network> {
    const net = new Network(raw as unknown as RawNet);
    await net.decodeTerrain();
    await net.level(fresh);
    return net;
  }

  // The map's heights changed at load: bridgeSags() and levelOverlaps(), or their result as `npm run build` baked it into
  // src/data/oc-levels.json (scripts/levels.mjs), which is used when it was made from this data with this version of the
  // passes. The passes took 0.2 to 0.5 s of a desktop's boot here (four or five times that on a phone); the baked heights
  // take a few milliseconds.
  private async level(fresh: boolean) {
    const t0 = performance.now(), b = baked as unknown as Baked;
    this.sig = this.signature();
    if (!fresh && b.version === LEVELS && b.sig === this.sig && b.ends) {
      const bin = Uint8Array.from(atob(b.data), (c) => c.charCodeAt(0));
      const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      const d = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      let k = 0;
      for (const [id, i0, count] of b.runs) {
        const p = this.paths[id], dy = new Float32Array(p.n);
        for (let i = i0, acc = 0; i < i0 + count; i++) { acc += d[k++]; dy[i] = acc / 1e3; }
        p.lift(dy);
      }
      // and where the roads cut back off a carriageway's lanes end (trimEnds, 19 to 231 ms of a boot when it ran there)
      for (const p of this.paths) p.end = p.len;
      for (const [id, end] of b.ends) this.paths[id].end = end;
      this.loadMs.baked = performance.now() - t0;
    } else {
      this.bridgeSags();
      this.loadMs.sags = performance.now() - t0;
      const t1 = performance.now();
      this.levelOverlaps();
      this.loadMs.level = performance.now() - t1;
      const t2 = performance.now();
      this.trimEnds();
      this.loadMs.trim = performance.now() - t2;
    }
    this.mapYs = null;
  }

  // A road that just stops (no next, a dead end on the map) with its end out over a better-ranked carriageway's travel
  // lanes, higher than at grade with them (over LEVEL), is cut back so it ends before them: its deck (out to the backs of
  // its barriers) clear of that carriageway's pavement, widened by END_CLEAR, and its end closed by a crash cushion and a wall down to the
  // ground (Roads). Ramp 1164 at the I-5 North's Disney Way / Gene Autry Way exit stops on the map 5 m over the 5's left
  // lanes (on its way to Gene Autry Way, a street drawn as a bridge): its end hung in mid-air over them, a slab with a
  // crash cushion on it (2.7 to 3.8 m up in the live game, before the levelling held it clear). The same on the I-5
  // South: ramps 261 (7 m up) and 774 (5 m). Sets p.end, which Roads, the physics' end wall and the end-of-road check use.
  private trimEnds() {
    const PRQ = { s: 0, d: 0 };
    for (const p of this.paths) {
      p.end = p.len;
      if (p.next || p.main) continue;
      const ds = [p.wallL - 0.6, p.paveL, (p.paveL + p.paveR) / 2, p.paveR, p.wallR + 0.6];
      // is the deck at s over such lanes?
      const over = (s: number) => {
        for (const d of ds) {
          const a = this.at(p, s, d);
          for (const h of this.near(a.x, a.z, 1, HITS_END)) {
            const q = h.path;
            if (q === p || !q.lanesClear || rank(q) > rank(p) || h.s < 0 || h.s > q.len || h.d < q.paveL - END_CLEAR || h.d > q.paveR + END_CLEAR) continue;
            const pr = q.project(a.x, a.z, h.s, PRQ), dy = a.y - q.height(clamp(pr.s, 0, q.len));
            if (dy > LEVEL && dy < 30) return true;
          }
        }
        return false;
      };
      // walked back from the end, 1 m at a time, while it's over them (and 3 m past a gap, as a deck can leave the
      // lanes between two)
      let cut = NaN, gap = 0;
      for (let t = 0.25; t < Math.min(p.len, 400); t += 1) {
        if (over(p.len - t)) { cut = p.len - t; gap = 0; } else if (!isNaN(cut) || t > 3) { if (++gap > 3 || isNaN(cut)) break; }
      }
      if (isNaN(cut)) continue;
      p.end = Math.max(Math.min(p.len, 2), cut - 1.5);
    }
  }
  private at(p: Path, s: number, d: number) { return p.at(s, d, AT_END); }
  // what the baked heights were made from: the roads' sample counts, their ends' heights on the map and the junctions
  sig = 0;
  private signature() {
    let h = 2166136261;
    const mix = (v: number) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
    mix(this.paths.length); mix(this.data.junctions.length);
    for (const p of this.paths) { mix(p.n); mix(Math.round(p.ys[0] * 100)); mix(Math.round(p.ys[p.n - 1] * 100)); }
    return h;
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
      // (every other sample: the narrowest pavement is 7 m across, and a stretch's ends are walked out from below)
      const runs: { k0: number; k1: number; hi: number; lo: number }[] = [];
      for (let k = 0; k < p.n; k += 2) {
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
      if (any) { this.mapYs!.set(p, Float32Array.from(p.ys)); p.lift(dy); }
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
    // (the working arrays are allocated once, at the longest road's length, and used a road at a time)
    const N = Math.max(...this.paths.map((p) => p.n)), F = () => new Float32Array(N), U = () => new Uint8Array(N);
    const DELTA = F(), ZONE = U(), SHARE = F(), SM = F(), FIX = F(), AT1 = U(), SP = F(), WANT = F(), WT = F();
    const LI = new Int32Array(N), RI = new Int32Array(N);
    const spread = (val: Float32Array, fixed: Uint8Array) => {
      const n = val.length, out = SP.subarray(0, n), L = LI, R = RI;
      out.set(val);
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
      const n = p.n, delta = DELTA.subarray(0, n).fill(0), zone = ZONE.subarray(0, n).fill(0), cand = new Map<Path, number>();
      // how much following matters at each sample on the other road: the width of pavement the two share, in lanes, or
      // LANES where the other road's pavement reaches this one's travel lanes (a step there is in the lanes: following
      // the CA-91 East less where the CA-55 North ends in it left the 91's shoulder 0.44 m over the 55's left lane)
      const share = SHARE.subarray(0, n).fill(0), LANES = 1e4;
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
        let best = 0, bestQ: Path | null = null, bestW = 0;
        for (const [q, guess] of cand) {
          const pr = q.project(x, z, guess, PRQ);
          cand.set(q, pr.s);
          if (Math.abs(pr.d) > 60 || pr.s < -40 || pr.s > q.len + 40) { cand.delete(q); continue; }
          if (pr.s < 0 || pr.s > q.len || pr.d + p.paveL >= q.paveR || pr.d + p.paveR <= q.paveL) continue;   // the pavements don't overlap
          if (Math.cos(p.hs[k] - q.heading(pr.s)) < ALONG) continue;                                          // crossing, not alongside
          const dy = q.height(pr.s) - p.ys[k], inLanes = Math.min(pr.d + p.edgeR, q.paveR) - Math.max(pr.d + p.edgeL, q.paveL) > 0.3;
          const ov = inLanes ? LANES * LANE_W : Math.min(pr.d + p.paveR, q.paveR) - Math.max(pr.d + p.paveL, q.paveL);
          // stay with the road already followed while within KEEP of it; take up a new one only within GIVE_WAY (a
          // flyover alongside keeps its height, and a collector alongside for kilometres is let go as it climbs away)
          if (q === cur && Math.abs(dy) <= KEEP) { best = dy; bestQ = q; bestW = ov; break; }
          if (Math.abs(dy) > GIVE_WAY || (bestQ && Math.abs(dy) >= Math.abs(best))) continue;
          best = dy; bestQ = q; bestW = ov;
        }
        cur = bestQ;
        if (bestQ) { delta[k] = best; zone[k] = 1; share[k] = clamp(bestW / LANE_W, 0.1, LANES); any = true; }
      };
      for (let k = 0; k < n; k += EVAL) look(k);
      if ((n - 1) % EVAL) look(n - 1);
      const sm = SM.subarray(0, n).fill(0);
      if (any) {
        // between two looked-at samples both on the other road, so is every sample (its offset interpolated)
        for (let k0 = 0; k0 < n - 1; k0 += EVAL) {
          const k1 = Math.min(n - 1, k0 + EVAL);
          if (!zone[k0] || !zone[k1]) continue;
          for (let k = k0 + 1; k < k1; k++) {
            const t = (k - k0) / (k1 - k0);
            zone[k] = 1; delta[k] = delta[k0] + (delta[k1] - delta[k0]) * t; share[k] = share[k0] + (share[k1] - share[k0]) * t;
          }
        }
      }
      // over a better-ranked carriageway's travel lanes: at grade with it, or clear of it (laneRuns)
      if (this.laneRuns(p, delta, zone, share, LANES, SMOOTH)) any = true;
      if (any) {
        // elsewhere: eased out from the nearest stretch on each side, or carried across a short gap between two
        const out = spread(delta, zone);
        // smoothed, so a switch between two roads followed is a bump, not a step
        triangle(out, sm, SMOOTH);
      }
      // level with every settled road it meets, at the junction (the change eased in from either side of it), whether
      // or not this road follows another itself (a ramp carrying on from a piece that was moved)
      // offsets are kept from the map's heights: a bridge bridgeSags() spanned is already off them
      const sag = this.mapYs!.get(p), base = sag ?? p.ys, pre = (i: number) => (sag ? p.ys[i] - sag[i] : 0);
      const fix = FIX.subarray(0, n).fill(0), at = AT1.subarray(0, n).fill(0);
      let moved = any || !!sag;
      for (const m of meets.get(p) ?? []) {
        // the roads here settled before this one (the others settle after it, and keep level with it then)
        let sum = 0, cnt = 0;
        for (const o of m.others) if (rank(o.q) < rank(p)) { sum += offsetAt(o.q, o.s); cnt++; }
        if (!cnt) continue;
        const k = clamp(Math.round(m.s / STEP), 0, n - 1), c = sum / cnt - sm[k] - pre(k);
        fix[k] = at[k] ? (fix[k] + c) / 2 : c; at[k] = 1;
        if (Math.abs(c) > 1e-3) moved = true;
      }
      if (!moved) continue;
      const corr = spread(fix, at);
      for (let i = 0; i < n; i++) sm[i] += corr[i];
      // No crest a car leaves the ground on, no dip and no grade the map doesn't have (limitProfile): where following
      // the other road and easing back to a junction's level would (a hump of 4 m on the CA-55 North where it ends in
      // the CA-91 East, a 12% drop on the CA-241 North into the 91 West), the road follows it less. Junctions hold.
      const want = WANT.subarray(0, n), w = WT.subarray(0, n);
      for (let i = 0; i < n; i++) { want[i] = p.ys[i] + sm[i]; w[i] = at[i] ? PIN : sag && Math.abs(pre(i)) > 1e-3 ? 1 : zone[i] ? share[i] : 0.02; }
      const lim = limitProfile(base, want, w, p.main);
      if (lim) for (let i = 0; i < n; i++) sm[i] = lim[i] - p.ys[i];
      p.lift(sm);
      // kept, from the map's heights
      const off = Float32Array.from(sm);
      if (sag) for (let i = 0; i < n; i++) off[i] += pre(i);
      settled.set(p, off);
    }
  }

  // Where a road's deck (out to the backs of its barriers, wallL - 0.6 to wallR + 0.6) reaches a better-ranked
  // carriageway's travel lanes (widened by SIDE_CLEAR), it may be at grade with that carriageway (Roads leaves its
  // surface out up to LEVEL over the other's, which takes its place) or clear it (CLEAR_TOP over it), nothing between:
  // a road between the two hung its surface, deck and barriers over those lanes 2.5 to 4.9 m up (ramp 800 along the I-5
  // North's left lanes, where its surface stopped in mid-air 2.3 m over them, and the connectors at the 5/55, 405/55,
  // 57/91 and 5/405 rising away from a freeway over its outer lanes). Each stretch over one carriageway's lanes is a
  // run (judged on the map's heights, before this road is levelled), held `pad` samples past either end (the smoothing
  // spreads a change over that many):
  // - alongside it (within 45 degrees), the same way, and at grade with it somewhere in the run (leaving or joining it,
  //   rising away from it or settling onto it while still over its lanes): it follows that carriageway over the whole
  //   run, at `weight`, and climbs once clear of its lanes. (However high it is in the middle: a hump there is that road
  //   going over something crossing the carriageway, which clears the carriageway, and so the road following it; ramp
  //   800's 9 m hump over the I-5 North's left lanes, under ramp 1203 and East 4th Street, 7 m over the freeway.)
  // - crossing it, the other way, or never down near it: it is held CLEAR_TOP plus 0.1 m over it (raised where it's
  //   lower, kept where it isn't), at 100 times `weight`, so following another road nearby (this pass's own, or a run
  //   of the first kind) can't bring it down onto those lanes: ramp 305, following the I-5 North's left lanes, crosses
  //   the I-5 South 7 m up on the map, and was brought down to 1.9 m over its lanes.
  // - crossing it at grade (a road joining it from the side): left as it is.
  // What the profile limits don't let it hold (a climb from a followed carriageway to clear the next one, or a main's
  // grade) is left to Roads, which cuts the road's deck back off those lanes. delta, zone and share are levelOverlaps'
  // offsets, held samples and weights; returns whether any was held.
  private laneRuns(p: Path, delta: Float32Array, zone: Uint8Array, share: Float32Array, weight: number, pad: number) {
    const n = p.n, DL = p.wallL - 0.6, DR = p.wallR + 0.6, ALONG = Math.cos(Math.PI / 4), PRQ = { s: 0, d: 0 }, GAP = 6;
    const cand = new Map<Path, number>();
    type Run = { q: Path; k0: number; k1: number; lo: number; hi: number; along: boolean; qs0: number; qs1: number };
    const open = new Map<Path, Run>(), runs: Run[] = [];
    for (let k = 0; k < n; k += 2) {
      const x = p.xs[k], z = p.zs[k];
      if (k % 24 === 0) {
        const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          const a = this.grid.get(cellKey(cx + i, cz + j));
          if (!a) continue;
          for (let m = 0; m < a.length; m += 2) { const q = this.paths[a[m]]; if (q !== p && q.lanesClear && rank(q) < rank(p) && !cand.has(q)) cand.set(q, a[m + 1] * STEP); }
        }
      }
      for (const [q, guess] of cand) {
        const pr = q.project(x, z, guess, PRQ);
        cand.set(q, pr.s);
        const r = open.get(q);
        if (Math.abs(pr.d) > 80 || pr.s < -60 || pr.s > q.len + 60) { cand.delete(q); if (r) { runs.push(r); open.delete(q); } continue; }
        let hit = false;
        if (pr.s >= 0 && pr.s <= q.len) {
          // the deck's cross-section, on that carriageway's offsets
          const c = Math.cos(p.hs[k] - q.heading(pr.s)), a = pr.d + Math.min(DL * c, DR * c), b = pr.d + Math.max(DL * c, DR * c);
          const dy = p.ys[k] - q.height(pr.s);
          // (however high it is over them: a hump in the middle of a run is that road going over something
          // crossing the carriageway, which clears the carriageway, and so the road following it; ramp 800's 9 m hump
          // over the I-5 North's left lanes under ramp 1203 and East 4th Street, 7 m over the freeway)
          hit = Math.min(b, q.edgeR + SIDE_CLEAR) - Math.max(a, q.edgeL - SIDE_CLEAR) > 0 && dy > -2.5;
          if (hit) {
            if (r && k - r.k1 <= GAP) { r.k1 = k; r.lo = Math.min(r.lo, dy); r.hi = Math.max(r.hi, dy); r.qs1 = pr.s; if (c < ALONG) r.along = false; }
            else { if (r) runs.push(r); open.set(q, { q, k0: k, k1: k, lo: dy, hi: dy, along: c >= ALONG, qs0: pr.s, qs1: pr.s }); }
          }
        }
        if (!hit && r && k - r.k1 > GAP) { runs.push(r); open.delete(q); }
      }
    }
    for (const r of open.values()) runs.push(r);
    let held = false;
    // following runs first, so a clearing one wins where the two meet
    const follows = (r: Run) => r.along && r.lo <= LEVEL;
    runs.sort((a, b) => Number(follows(b)) - Number(follows(a)));
    for (const r of runs) {
      const follow = follows(r);
      if (follow ? r.hi <= LEVEL : r.lo <= LEVEL || r.lo >= CLEAR_TOP + 3) continue;
      const q = r.q, k0 = Math.max(0, r.k0 - pad), k1 = Math.min(n - 1, r.k1 + pad);
      let g = r.qs0 - (r.k0 - k0) * STEP, lift = 0;
      for (let k = k0; k <= k1; k++) {
        const pr = q.project(p.xs[k], p.zs[k], g, PRQ);
        g = pr.s;
        const qy = q.height(clamp(pr.s, 0, q.len));
        if (follow) delta[k] = qy - p.ys[k];
        else {
          // (past the run's ends, the lift at its end)
          if (k >= r.k0 && k <= r.k1) lift = Math.max(0, qy + CLEAR_TOP + 0.1 - p.ys[k]);
          else if (k < r.k0) { const pq = q.project(p.xs[r.k0], p.zs[r.k0], r.qs0, PRQ); lift = Math.max(0, q.height(clamp(pq.s, 0, q.len)) + CLEAR_TOP + 0.1 - p.ys[r.k0]); }
          delta[k] = Math.max(zone[k] ? delta[k] : 0, lift);
        }
        zone[k] = 1; share[k] = follow ? weight : weight * 100;
      }
      held = true;
    }
    return held;
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
  // surface to `above` over it?
  covered(x: number, z: number, y: number, self: Path, margin: number, rankedAbove = false, above = LEVEL) {
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

  // the street bridge whose deck or parapets (1.6 m under its surface to 1.1 m over it) are over (x, z), within margin of
  // its sides, somewhere between heights y0 and y1, if any
  overpassAt(x: number, z: number, y0: number, y1: number, margin: number) {
    for (const o of this.overpasses) {
      if (o.y - 1.6 > y1 || o.y + 1.1 < y0) continue;
      const vx = o.bx - o.ax, vz = o.bz - o.az, t = clamp(((x - o.ax) * vx + (z - o.az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
      if (Math.hypot(x - (o.ax + vx * t), z - (o.az + vz * t)) <= o.w / 2 + margin) return o;
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
        // up to LEVEL over another road, as for its surface: 2.5 to 4 m over one, a barrier stays (with its back cut
        // short over that road, in Roads), or it left an open drop of 2.5 to 4 m (926 m of edges, 58 m of them on the
        // mains: the CA-241 North's left edge over the 91 West, the 73 and the 57 over their ramps)
        w[k] = this.covered(at.x, at.z, at.y, p, 0.6, false, LEVEL) ? 0 : 1;
      }
      // no barrier across the first few metres where a ramp starts at another road (set outright: these samples
      // may not have been worked out yet when the first look at this road was further along it)
      if (p.prev || p.inc.some((j) => j.s < 1)) for (let k = 0; k < Math.min(p.n, 3); k++) w[k] = 0;
    }
    return w[i] === 1;
  }

  // A wall across the end of a road that stops, over the part of its width that isn't on another road (a ramp cut off at
  // the edge of the map inside a freeway has none): the widest clear stretch of the end, [a, b] across it, if it's at
  // least a lane wide. (The whole width went by its centre: a ramp ending with an edge on another road's shoulder had its
  // crash cushion standing on that road. Then by any of three points: nine dead ends with only an edge on another road
  // lost theirs, leaving the rest of the end open.)
  endSpan(p: Path) {
    let e = this.ends.get(p.id);
    if (e === undefined) {
      e = null;
      if (!p.next) {
        let a = NaN, best = 0;
        const m = Math.ceil((p.paveR - p.paveL) / 0.5);
        for (let k = 0; k <= m + 1; k++) {
          const d = p.paveL + ((p.paveR - p.paveL) * k) / m, at = k <= m ? p.at(p.end - 0.5, d, AT) : null;
          const clear = !!at && !this.covered(at.x, at.z, at.y, p, 0.6, false, LEVEL);
          if (clear && isNaN(a)) a = d;
          if (!clear && !isNaN(a)) {
            const b = p.paveL + ((p.paveR - p.paveL) * (k - 1)) / m;
            if (b - a > best) { best = b - a; e = { a, b }; }
            a = NaN;
          }
        }
        if (best < LANE_W) e = null;
      }
      this.ends.set(p.id, e);
    }
    return e;
  }
  hasEndWall(p: Path) { return !!this.endSpan(p); }

  // barrier segments within r of (x, z), near height y, for the physics
  wallsNear(x: number, z: number, y: number, r: number, out: Wall[]) {
    out.length = 0;
    // a barrier's back is 0.95 m past the pavement
    const hits = this.near(x, z, r + 1.5, HITS3);
    for (const h of hits) {
      const p = h.path;
      // a road's barriers stop the cars on roads within LEVEL of it, the ones it can drive onto (surfaces()): a barrier
      // 2.5 to 4 m over another road's lanes is overhead there, not a wall in them
      if (Math.abs(p.height(clamp(h.s, 0, p.len)) - y) > LEVEL) continue;
      const i0 = clamp(Math.floor((h.s - r) / STEP), 0, p.n - 2), i1 = clamp(Math.ceil((h.s + r) / STEP), 0, p.end < p.len ? Math.floor(p.end / STEP) - 1 : p.n - 2);
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
      const span = !p.next && p.end - h.s < r + 5 ? this.endSpan(p) : null;
      if (span) {
        // across the clear part of the end (out to the barriers' faces where it reaches the pavement's edges)
        const e = p.end - 0.5, da = span.a <= p.paveL + 0.01 ? p.wallL : span.a, db = span.b >= p.paveR - 0.01 ? p.wallR : span.b;
        const a = p.at(e, da, AT), ax = a.x, az = a.z; const b = p.at(e, db, AT);
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

// mains first, then the Go To routes' exit ramps (their lanes held clear like a carriageway's, Path.lanesClear: another ramp
// merging with one follows it down, as a ramp does a freeway; ramp 895, lifted over ramp 797's lane, stood 0.1 to 0.3 m
// over ramp 959's lane where the two meet at grade, as the better-ranked by id), then the other ramps; among equals the
// lower id wins
export const rank = (p: Path) => (p.main ? 0 : p.lanesClear ? 5e5 : 1e6) + p.id;

// out = a triangle-weighted mean of a over ±r (weights r + 1 - |j|, the ones past either end left out): two running box
// sums of r + 1, so it costs the same at any r (the direct sum was a third of the levelling's time)
function triangle(a: Float32Array, out: Float32Array, r: number) {
  const n = a.length, w = r + 1, b = new Float64Array(n + w), c = new Float64Array(n + w);
  // b[i]: sum of a over [i - r, i] and c[i] the count in range; then the same box again, over [i, i + r]
  let sa = 0, sc = 0;
  for (let i = 0; i < n + r; i++) {
    if (i < n) { sa += a[i]; sc++; }
    if (i - w >= 0 && i - w < n) { sa -= a[i - w]; sc--; }
    b[i] = sa; c[i] = sc;
  }
  let ta = 0, tc = 0;
  for (let i = n + r - 1; i >= 0; i--) {
    ta += b[i]; tc += c[i];
    if (i + w <= n + r - 1) { ta -= b[i + w]; tc -= c[i + w]; }
    if (i < n) out[i] = ta / tc;
  }
}

const PR = { s: 0, d: 0 };
// does (s, d) on p lead back to (x, z)? (past an end, the point is that far beyond it)
const AT_NEAR = { x: 0, y: 0, z: 0, h: 0 };
function lands(p: Path, x: number, z: number, pr: { s: number; d: number }) {
  const sc = clamp(pr.s, 0, p.len), a = p.at(sc, pr.d, AT_NEAR);
  return Math.abs(Math.hypot(a.x - x, a.z - z) - Math.abs(pr.s - sc)) < 0.5;
}
const HITS: Hit[] = [], HITS2: Hit[] = [], HITS3: Hit[] = [], HITS4: Hit[] = [];
const AT = { x: 0, y: 0, z: 0, h: 0 }, AT_END = { x: 0, y: 0, z: 0, h: 0 }, HITS_END: Hit[] = [];
