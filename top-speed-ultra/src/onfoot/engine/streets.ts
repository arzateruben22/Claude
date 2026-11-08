// The street world round a venue, from its own Anaheim slice (OpenStreetMap through Overture Maps, ODbL; building
// heights partly from USGS lidar), written for the bar on Lot 57's data.ts approach (PROJECT_OC_SPORTS_BAR.md, the
// module map's data.ts row). Lot 57's data.ts is never imported: it statically imports Lot 57's own slice.
//
// Two sets, both drawn in every state, so nothing in the street world can appear or vanish at a door:
//   near: every feature, on every layer, with any part in the glazed sectors within the near radius of the venue's
//         centre, in detail (markings, crosswalks, tilt-up bands and glazing, fence posts, every prop);
//   far:  the rest of the slice, 'simple' (untextured, in vertex colour, merged into 4 batches: opaque, lamp heads,
//         chain-link and wires) or 'full' (as the near set). Switching between them rebuilds the far batches.
// Motorways and bridges (ours; Lot 57's data.ts draws only its CA-57's bridge): carriageways 14 m one-way, links 8 m;
// every drivable piece lies on the ground except over its br spans, where it's a deck (top 7.6 m, a 1 m slab, on
// round piers every 28 m, the first 14 m in, 0.9 m in radius, a pier left out where its footprint meets a ribbon drawn
// beneath), between ground and deck it ramps at 5% along the drivable network (so every piece that meets at a
// connector has the same height there), and its tn spans aren't drawn. Bridge polygons are slabs under the decks.
import * as THREE from 'three';
import { Batch, Kit, P2, Emitter, offsetLine, along, polyLen, pointInPoly } from './geom';
import { Collider, poly, circ, seg as segC } from './collide';
import type { Frame } from './frame';

export interface StreetMats {
  roads: THREE.Material; walk: THREE.Material; markings: THREE.Material; tilt: THREE.Material; glass: THREE.Material;
  roofs: THREE.Material; plain: THREE.Material; steel: THREE.Material; lampHeads: THREE.Material; chain: THREE.Material;
  wires: THREE.LineBasicMaterial; rail: THREE.Material; landuse: THREE.Material; water: THREE.Material; walls: THREE.Material;
  far: THREE.Material; farGlow: THREE.Material;
}
export interface StreetOpts {
  frame: Frame;
  centre: P2; nearR: number;                  // frame metres
  dropSegs: number[]; keepHost: number;       // pieces our layout redraws; the venue's host building (drawn by the venue)
  far: 'simple' | 'full';
  /** colliders are made only for features within this many metres of the centre */
  colliderR: number;
}
type Slice = {
  dict: { seg: string[]; sub: string[]; name: string[]; bcls: string[]; lu: string[]; water: string[]; infra: string[] };
  seg: { c: number | string; s?: number; n?: number; p: number[]; ow?: number; k?: number[]; br?: number | number[][]; tn?: number | number[][] }[];
  bld: { p: number[]; hl?: number[][]; h?: number; mh?: number; c?: number }[];
  landuse: { c: number; p?: number[]; l?: number[] }[];
  water: { c: number; p?: number[]; l?: number[] }[];
  infra: { c: number; p?: number[]; l?: number[]; hl?: number[][] }[];
  infra_pts: number[];
};
export type Layer = 'streets' | 'buildings' | 'land use' | 'water' | 'infrastructure shapes' | 'infrastructure points';
export interface StreetSet { group: THREE.Group; meshes: THREE.Object3D[]; ids: Record<Layer, number[]>; mode: 'near' | 'simple' | 'full' }

export const TOP = 7.6, GRADE = 0.05, CLEAR = 5.5, RAMP = TOP / GRADE, PIER_R = 0.9, PIER_STEP = 28;
const DRIVE = new Set(['motorway', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'track']);
const LOWRISE_NOT = new Set(['stadium', 'house', 'apartments', 'hotel', 'residential', 'terrace', 'church', 'cathedral', 'hospital', 'university', 'roof', 'parking']);
const PT_SIMPLE = new Set(['power:power_pole', 'power:power_tower', 'transportation:street_lamp', 'transportation:traffic_signals']);

/** COPY of lot57/data.ts ROAD_W (L14), plus our motorway and link widths: E0 shares one table */
export function roadWidth(cls: string, sub: string, ow: boolean): number {
  if (cls === 'motorway') return sub === 'link' ? (ow ? 8 : 16) : ow ? 14 : 28;
  if (cls === 'primary') return ow ? 12 : 24;
  if (cls === 'secondary') return ow ? 11.5 : 30;
  if (cls === 'tertiary') return 14;
  if (cls === 'residential' || cls === 'unclassified' || cls === 'living_street') return 11;
  if (cls === 'service') return sub === 'parking_aisle' ? 7 : sub === 'driveway' ? 6 : sub === 'alley' ? 5 : 6;
  return 0;
}
const spans = (v: number | number[][] | undefined): [number, number][] => (Array.isArray(v) ? (v as [number, number][]) : v === 1 ? [[0, 1]] : []);
const decodeG = (p: number[]): P2[] => { const out: P2[] = []; let x = 0, z = 0; for (let i = 0; i < p.length; i += 2) { x += p[i]; z += p[i + 1]; out.push([x / 10, z / 10]); } return out; };
const hex = (r: number, g: number, b: number) => (Math.round(Math.min(1, r) * 255) << 16) | (Math.round(Math.min(1, g) * 255) << 8) | Math.round(Math.min(1, b) * 255);

// ------------------------------------------------------------------ the near set's region (frame metres)
/** does the segment a-b meet the disc (centre c, radius r) within the half-plane n.p >= k? */
function segInHalfDisc(a: P2, b: P2, n: P2, k: number, c: P2, r: number) {
  const fa = n[0] * a[0] + n[1] * a[1] - k, fb = n[0] * b[0] + n[1] * b[1] - k;
  if (fa < 0 && fb < 0) return false;
  let p = a, q = b;
  if (fa < 0 || fb < 0) { const t = fa / (fa - fb), m: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (fa < 0) p = m; else q = m; }
  const dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz;
  let t = l2 ? ((c[0] - p[0]) * dx + (c[1] - p[1]) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] + dx * t - c[0], p[1] + dz * t - c[1]) <= r;
}
export function makeRegion(centre: P2, r: number) {
  // the glazed sectors: beyond the front wall's line (-0.932 u + 0.362 v >= 0) or beyond the south wall's (v <= 0.012 u)
  const H: [P2, number][] = [[[-0.932, 0.362], 0], [[0.012, -1], 0]];
  const pt = (p: P2) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) <= r && H.some(([n, k]) => n[0] * p[0] + n[1] * p[1] >= k);
  const line = (pts: P2[], closed: boolean) => {
    for (let i = 0; i + 1 < pts.length; i++) if (H.some(([n, k]) => segInHalfDisc(pts[i], pts[i + 1], n, k, centre, r))) return true;
    if (closed && pts.length > 2 && H.some(([n, k]) => segInHalfDisc(pts[pts.length - 1], pts[0], n, k, centre, r))) return true;
    return pts.length === 1 && pt(pts[0]);
  };
  // a point of the region, for a polygon that contains all of it without an edge crossing it
  const inner: P2 = [centre[0], centre[1] - 18];
  const polygon = (ring: P2[]) => line(ring, true) || pointInPoly(inner[0], inner[1], ring);
  return { pt, line, polygon };
}

// ------------------------------------------------------------------ the drivable network's heights (the bridge rule)
interface Piece { id: number; pts: P2[]; cum: number[]; L: number; marks: { t: number; node: string }[]; br: [number, number][]; tn: [number, number][]; w: number; cls: string; sub: string; ow: boolean }
class Heap { a: [number, string][] = []; push(x: [number, string]) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } } pop() { const a = this.a, top = a[0], last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { let c = i * 2 + 1; if (c >= a.length) break; if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++; if (a[c][0] >= a[i][0]) break; [a[c], a[i]] = [a[i], a[c]]; i = c; } } return top; } get size() { return this.a.length; } }

export function buildNetwork(S: Slice, toLocal: (p: P2) => P2, drop: Set<number>) {
  const D = S.dict, pieces = new Map<number, Piece>(), net = new Map<string, [string, number][]>();
  const link = (a: string, b: string, w: number) => { if (!net.has(a)) net.set(a, []); if (!net.has(b)) net.set(b, []); net.get(a)!.push([b, w]); net.get(b)!.push([a, w]); };
  const sources: string[] = [];
  S.seg.forEach((s, i) => {
    const cls = typeof s.c === 'number' ? D.seg[s.c] : String(s.c);
    if (drop.has(i) || !DRIVE.has(cls)) return;
    const sub = s.s !== undefined ? D.sub[s.s] : '';
    const pts = decodeG(s.p).map(toLocal), cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    const L = cum[cum.length - 1], k = s.k ?? [], br = spans(s.br), tn = spans(s.tn);
    const marks: { t: number; node: string }[] = [];
    for (let j = 0; j < k.length; j += 2) marks.push({ t: cum[k[j]], node: 'c' + k[j + 1] });
    marks.push({ t: 0, node: `v${i}.0` }, { t: L, node: `v${i}.1` });
    br.forEach(([a, b], n) => { marks.push({ t: a * L, node: `s${i}.${n}` }, { t: b * L, node: `e${i}.${n}` }); sources.push(`s${i}.${n}`, `e${i}.${n}`); });
    marks.sort((p, q) => p.t - q.t);
    for (let j = 0; j + 1 < marks.length; j++) {
      const sa = marks[j].t, sb = marks[j + 1].t;
      const w = br.some(([a, b]) => a * L - 1e-6 <= sa && sb <= b * L + 1e-6) ? 0 : sb - sa;
      link(marks[j].node, marks[j + 1].node, w);
    }
    pieces.set(i, { id: i, pts, cum, L, marks, br, tn, w: roadWidth(cls, sub, s.ow === 1), cls, sub, ow: s.ow === 1 });
  });
  // the distance along the network from every node to the nearest br span (a multi-source Dijkstra)
  const dist = new Map<string, number>(), h = new Heap();
  for (const n of sources) { dist.set(n, 0); h.push([0, n]); }
  while (h.size) {
    const [d, n] = h.pop();
    if (d > (dist.get(n) ?? Infinity)) continue;
    for (const [m, w] of net.get(n) ?? []) { const nd = d + w; if (nd < (dist.get(m) ?? Infinity)) { dist.set(m, nd); h.push([nd, m]); } }
  }
  /** the drawn height t metres along piece i */
  const height = (i: number, t: number) => {
    const p = pieces.get(i); if (!p) return 0;
    if (p.br.some(([a, b]) => a * p.L <= t && t <= b * p.L)) return TOP;
    for (let j = 0; j + 1 < p.marks.length; j++) {
      const sa = p.marks[j].t, sb = p.marks[j + 1].t;
      if (sa - 1e-6 <= t && t <= sb + 1e-6) {
        const d = Math.min((dist.get(p.marks[j].node) ?? 1e18) + t - sa, (dist.get(p.marks[j + 1].node) ?? 1e18) + sb - t);
        return TOP * Math.max(0, 1 - d / RAMP);
      }
    }
    return 0;
  };
  const inTunnel = (p: Piece, t: number) => p.tn.some(([a, b]) => a * p.L <= t && t <= b * p.L);
  return { pieces, height, inTunnel, dist };
}
/** the point t metres along a polyline */
export function pointAt(pts: P2[], cum: number[], t: number): P2 {
  for (let k = 1; k < pts.length; k++) if (t <= cum[k] || k === pts.length - 1) { const l = cum[k] - cum[k - 1], f = l ? Math.min(1, Math.max(0, (t - cum[k - 1]) / l)) : 0; return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f]; }
  return pts[pts.length - 1];
}
/** the distance from a point to a polyline, and how far along it the nearest point is */
export function project(pts: P2[], cum: number[], x: number, z: number) {
  let best = Infinity, bt = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bt = cum[k - 1] + Math.sqrt(l2) * t; }
  }
  return { d: best, t: bt };
}

// ------------------------------------------------------------------ drawing helpers
/** a strip along a polyline with a height per point */
function ribbon3(b: Batch, pts: P2[], ys: number[], w: number, hexc: number) {
  if (pts.length < 2) return;
  const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
  for (let i = 0; i + 1 < pts.length; i++) b.quad([L[i][0], ys[i], L[i][1]], [R[i][0], ys[i], R[i][1]], [R[i + 1][0], ys[i + 1], R[i + 1][1]], [L[i + 1][0], ys[i + 1], L[i + 1][1]], hexc);
}
/** the two sides of a strip, from y - drop (or the ground) up to y */
function sides3(b: Batch, pts: P2[], ys: number[], w: number, drop: number | null, hexc: number) {
  const L = offsetLine(pts, w / 2), R = offsetLine(pts, -w / 2);
  for (let i = 0; i + 1 < pts.length; i++) {
    const y0a = drop === null ? 0 : ys[i] - drop, y0b = drop === null ? 0 : ys[i + 1] - drop;
    if (ys[i] < 0.05 && ys[i + 1] < 0.05) continue;
    b.quad([L[i + 1][0], y0b, L[i + 1][1]], [L[i][0], y0a, L[i][1]], [L[i][0], ys[i], L[i][1]], [L[i + 1][0], ys[i + 1], L[i + 1][1]], hexc, 0.85);
    b.quad([R[i][0], y0a, R[i][1]], [R[i + 1][0], y0b, R[i + 1][1]], [R[i + 1][0], ys[i + 1], R[i + 1][1]], [R[i][0], ys[i], R[i][1]], hexc, 0.85);
  }
}
function sliceLine(pts: P2[], a: number, b: number): P2[] {
  const out: P2[] = []; let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0);
    if (s + l >= a && s <= b && l > 0) {
      const ta = Math.max(0, (a - s) / l), tb = Math.min(1, (b - s) / l);
      if (!out.length) out.push([x0 + (x1 - x0) * ta, z0 + (z1 - z0) * ta]);
      out.push([x0 + (x1 - x0) * tb, z0 + (z1 - z0) * tb]);
    }
    s += l;
  }
  return out;
}
const WHITE = 0xf4f2ea, YELLOW = 0xe8b923;
function markLine(b: Batch, pts: P2[], ys: number[] | null, off: number, w: number, hexc: number, dash?: [number, number]) {
  const o = offsetLine(pts, off);
  const put = (p: P2[]) => { if (p.length < 2) return; b.ribbon(p, w, 0.035, hexc); };
  if (ys) { // on a raised piece: lay the line on the ribbon's own heights
    if (!dash) { ribbon3(b, o, ys.map((y) => y + 0.03), w, hexc); return; }
  }
  if (!dash) { put(o); return; }
  const total = polyLen(o);
  for (let t = 0; t < total; t += dash[0] + dash[1]) put(sliceLine(o, t, Math.min(total, t + dash[0])));
}

/**
 * Build the street world. Returns both sets' groups (the caller adds them to the scene), the colliders near the
 * venue, the network's heights and the checks' raw numbers.
 */
export function buildStreets(S: Slice, mats: StreetMats, o: StreetOpts) {
  const F = o.frame, D = S.dict;
  const toLocal = (g: P2): P2 => F.toLocal(g[0], g[1]);
  const toFrameL = (l: P2): P2 => F.toFrame(l[0], l[1]);
  const region = makeRegion(o.centre, o.nearR);
  const drop = new Set(o.dropSegs);
  const net = buildNetwork(S, toLocal, drop);
  const colliders: Collider[] = [];
  const cLocal = F.fromFrame(o.centre[0], o.centre[1]);
  const nearVenue = (pts: P2[]) => pts.some(([x, z]) => Math.hypot(x - cLocal[0], z - cLocal[1]) < o.colliderR);
  const emitters: Emitter[] = [];

  // which set each feature is in
  type Feat = { layer: Layer; i: number; pts: P2[]; near: boolean };
  const feats: Feat[] = [];
  const nearOf = (pts: P2[], closed: boolean) => { const f = pts.map(toFrameL); return closed ? region.polygon(f) : region.line(f, false); };
  S.seg.forEach((s, i) => { if (drop.has(i)) return; const pts = decodeG(s.p).map(toLocal); feats.push({ layer: 'streets', i, pts, near: nearOf(pts, false) }); });
  S.bld.forEach((b, i) => { if (i === o.keepHost) return; const pts = decodeG(b.p).map(toLocal); feats.push({ layer: 'buildings', i, pts, near: nearOf(pts, true) }); });
  S.landuse.forEach((a, i) => { const closed = !!a.p, pts = decodeG((a.p ?? a.l)!).map(toLocal); feats.push({ layer: 'land use', i, pts, near: nearOf(pts, closed) }); });
  (S.water ?? []).forEach((a, i) => { const closed = !!a.p, pts = decodeG((a.p ?? a.l)!).map(toLocal); feats.push({ layer: 'water', i, pts, near: nearOf(pts, closed) }); });
  S.infra.forEach((a, i) => { const closed = !!a.p, pts = decodeG((a.p ?? a.l)!).map(toLocal); feats.push({ layer: 'infrastructure shapes', i, pts, near: nearOf(pts, closed) }); });
  for (let j = 0; j < S.infra_pts.length; j += 3) { const p = toLocal([S.infra_pts[j + 1] / 10, S.infra_pts[j + 2] / 10]); feats.push({ layer: 'infrastructure points', i: j / 3, pts: [p], near: region.pt(toFrameL(p)) }); }

  // piers: every 28 m along a br span, the first 14 m in, left out where the footprint meets a ribbon drawn beneath
  const piers: { x: number; z: number; seg: number; near: boolean }[] = [], leftOut: { x: number; z: number; seg: number; under: number; near: boolean }[] = [];
  const pieceNear = new Map<number, boolean>(); for (const f of feats) if (f.layer === 'streets') pieceNear.set(f.i, f.near);
  const bbox = new Map<number, [number, number, number, number]>();
  for (const p of net.pieces.values()) if (p.w > 0) { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of p.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } bbox.set(p.id, [x0, z0, x1, z1]); }
  for (const p of net.pieces.values()) for (const [a, b] of p.br) {
    for (let t = a * p.L + PIER_STEP / 2; t <= b * p.L + 1e-6; t += PIER_STEP) {
      const [x, z] = pointAt(p.pts, p.cum, t);
      let under = -1;
      for (const [j, [x0, z0, x1, z1]] of bbox) {
        if (j === p.id) continue;
        const q = net.pieces.get(j)!, r = q.w / 2 + PIER_R;
        if (x < x0 - r || x > x1 + r || z < z0 - r || z > z1 + r) continue;
        const pr = project(q.pts, q.cum, x, z);
        if (pr.d >= r || net.inTunnel(q, pr.t)) continue;
        if (net.height(j, pr.t) <= TOP - CLEAR) { under = j; break; }
      }
      const near = pieceNear.get(p.id) ?? false;
      if (under >= 0) leftOut.push({ x, z, seg: p.id, under, near }); else piers.push({ x, z, seg: p.id, near });
    }
  }

  const drawnSegs = new Map<number, { w: number; area: number; near: boolean; ys: [number, number] }>();
  const build = (mode: 'near' | 'simple' | 'full', which: boolean): StreetSet => {
    const kit = new Kit();
    const pre = which ? 'near-' : 'far-';
    const simple = mode === 'simple';
    // in simple mode everything but the lamp heads, the chain-link and the wires goes into one vertex-coloured batch
    const get = (name: string, mat: THREE.Material, opts: { uv?: number; cast?: boolean; glow?: boolean; ao?: boolean } = {}) =>
      simple ? (name === 'lamp-heads' ? kit.get(pre + 'glow', mats.farGlow, { glow: false }) : name === 'chain' ? kit.get(pre + 'chain', mats.chain, { uv: 2, glow: false }) : kit.get(pre + 'simple', mats.far, { glow: false, cast: true, ao: opts.ao }))
        : kit.get(pre + name, mat, opts);
    const wires: number[] = [];
    const ids: Record<Layer, number[]> = { 'streets': [], 'buildings': [], 'land use': [], 'water': [], 'infrastructure shapes': [], 'infrastructure points': [] };
    const r = (k: number) => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
    for (const f of feats) {
      if (f.near !== which) continue;
      ids[f.layer].push(f.i);
      const pts = f.pts;
      if (f.layer === 'streets') {
        const s = S.seg[f.i], cls = typeof s.c === 'number' ? D.seg[s.c] : String(s.c), sub = s.s !== undefined ? D.sub[s.s] : '';
        if (cls === 'steps' || cls === 'unknown') continue;
        if (cls.startsWith('rail')) {
          const b = get('rail', mats.rail, { ao: false });
          if (simple) { b.ribbon(pts, 2.6, 0.04, 0x6b625a); continue; }
          b.ribbon(pts, 2.8, 0.04, 0x6b625a);
          b.ribbon(offsetLine(pts, 0.72), 0.08, 0.16, 0x8b8f93); b.ribbon(offsetLine(pts, -0.72), 0.08, 0.16, 0x8b8f93);
          continue;
        }
        if (DRIVE.has(cls)) {
          const p = net.pieces.get(f.i);
          if (!p || p.w <= 0) continue;
          drawPiece(p, get, mode, f.near);
          continue;
        }
        if (sub === 'crosswalk') {
          if (simple) continue;
          const b = get('markings', mats.markings, { ao: false });
          for (const q of along(pts, 1.2, 0.6)) { const nx = -q.dz, nz = q.dx; b.quad([q.x - q.dx * 0.3 + nx * 1.5, 0.036, q.z - q.dz * 0.3 + nz * 1.5], [q.x + q.dx * 0.3 + nx * 1.5, 0.036, q.z + q.dz * 0.3 + nz * 1.5], [q.x + q.dx * 0.3 - nx * 1.5, 0.036, q.z + q.dz * 0.3 - nz * 1.5], [q.x - q.dx * 0.3 - nx * 1.5, 0.036, q.z - q.dz * 0.3 - nz * 1.5], WHITE); }
          continue;
        }
        const walk = get('walk', mats.walk, { uv: 4 });
        if (sub === 'sidewalk' && !simple) { walk.slab(pts, 2.0, 0, 0.15, 0xffffff, 0xd9d4ca); continue; }
        walk.ribbon(pts, sub === 'sidewalk' ? 2.0 : 1.8, 0.03, simple ? 0xc9c4ba : 0xe8e4dc);
        continue;
      }
      if (f.layer === 'buildings') {
        const bd = S.bld[f.i], cls = bd.c !== undefined ? D.bcls[bd.c] : '', holes = (bd.hl ?? []).map((h) => decodeG(h).map(toLocal));
        const h = bd.h ?? (cls === 'stadium' ? 22 : cls === 'office' ? 14 : cls === 'apartments' ? 14 : cls === 'hotel' ? 24 : cls === 'roof' ? 4.5 : cls === 'parking' ? 4.5 : cls === 'house' ? 6 : 7.5);
        const mh = bd.mh ?? 0, tone = [0xe0dbd0, 0xd3ccbd, 0xc8c3b8, 0xd9d0bc, 0xbfc4c4, 0xcbbfa8, 0xe6e2da][Math.floor(r(f.i) * 7)];
        if (!collidersDone && nearVenue(pts) && cls !== 'roof') colliders.push(poly(pts, 'building', true));
        if (simple) {
          const b = get('simple', mats.far);
          b.walls(pts, mh, h, tone); for (const hole of holes) b.walls(hole, mh, h, tone, true);
          b.cap(pts, h, r(f.i + 1) < 0.5 ? 0x9b978f : 0xb8b6b0, holes);
          continue;
        }
        const roofB = get('roofs', mats.roofs, { uv: 8, glow: false });
        if (h <= 13 && !LOWRISE_NOT.has(cls)) {
          const tilt = get('buildings-tilt', mats.tilt, { uv: 7.5, cast: true, glow: false }), glass = get('buildings-glass', mats.glass, { uv: 4, glow: false });
          tilt.walls(pts, mh, h, tone); tilt.walls(pts, h - 0.55, h - 0.35, r(f.i + 2) < 0.5 ? 0x5d6b70 : 0x8a7f6c);
          for (const hole of holes) tilt.walls(hole, mh, h, tone, true);
          roofB.cap(pts, h, r(f.i + 3) < 0.5 ? 0x9b978f : 0xc2c0ba, holes); tilt.walls(pts, h, h + 0.5, tone);
          let area = 0; for (let k = 0; k < pts.length; k++) { const [x0, z0] = pts[k], [x1, z1] = pts[(k + 1) % pts.length]; area += x0 * z1 - x1 * z0; }
          for (let k = 0; k < pts.length; k++) {
            const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length], L = Math.hypot(bx - ax, bz - az);
            if (L < 8) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = (area > 0 ? uz : -uz) * 0.04, nz = (area > 0 ? -ux : ux) * 0.04;
            const P = (t: number, y: number) => [ax + ux * t + nx, y, az + uz * t + nz];
            const kind = r(f.i * 7 + k);
            for (let t = 2; t + 3.2 < L - 1.5; t += 4.2) {
              if (kind < 0.55) { const y1 = Math.min(h - 1.2, 3.1), g = 0.55 + r(t + k) * 0.25, c = hex(g * 0.2, g * 0.26, g * 0.3); glass.quad(P(t, 0.15), P(t + 3.2, 0.15), P(t + 3.2, y1), P(t, y1), c); glass.quad(P(t + 3.2, 0.15), P(t, 0.15), P(t, y1), P(t + 3.2, y1), c); }
              else if (kind < 0.8) { const y1 = Math.min(h - 1.0, 4.2); tilt.quad(P(t, 0), P(t + 3.6, 0), P(t + 3.6, y1), P(t, y1), 0x8d9093); }
            }
          }
          continue;
        }
        const wallsB = get('buildings', mats.plain, { uv: 7.2, cast: true, glow: false });
        if (cls === 'roof') { roofB.cap(pts, h, 0xb9b6ae); roofB.cap(pts, h - 0.35, 0x8d8a83, [], true); wallsB.walls(pts, h - 0.35, h, tone); continue; }
        wallsB.walls(pts, mh, h, tone); for (const hole of holes) wallsB.walls(hole, mh, h, tone, true);
        roofB.cap(pts, h, r(f.i + 4) < 0.5 ? 0x8a867f : 0xbdbcb6, holes); wallsB.walls(pts, h, h + 0.6, tone);
        continue;
      }
      if (f.layer === 'land use' || f.layer === 'water') {
        const a = f.layer === 'water' ? S.water[f.i] : S.landuse[f.i];
        if (!a.p || pts.length < 3) continue;
        const cls = f.layer === 'water' ? 'water' : D.lu[a.c];
        const green = ['grass', 'park', 'pitch', 'meadow', 'garden', 'dog_park', 'playground', 'recreation_ground', 'golf_course', 'cemetery', 'village_green'].includes(cls);
        const c = f.layer === 'water' ? 0x4f6f84 : green ? 0x7d8f58 : ['greenfield', 'construction', 'brownfield'].includes(cls) ? 0x9c8668 : 0xa6a092;
        const b = f.layer === 'water' ? get('water', mats.water, { ao: false, glow: false }) : get('landuse', mats.landuse, { uv: 8, ao: false });
        b.cap(pts, f.layer === 'water' ? 0.012 : 0.008, c);
        continue;
      }
      if (f.layer === 'infrastructure shapes') {
        const a = S.infra[f.i], cls = D.infra[a.c], closed = !!a.p;
        if (cls === 'power:power_line' || cls === 'power:minor_line' || cls === 'power:cable') {
          const y = cls === 'power:power_line' ? 10.5 : cls === 'power:minor_line' ? 8.6 : 7.4;
          for (let k = 1; k < pts.length; k++) wires.push(pts[k - 1][0], y, pts[k - 1][1], pts[k][0], y, pts[k][1]);
          continue;
        }
        if (cls === 'barrier:kerb') continue;
        const ring = closed ? [...pts, pts[0]] : pts;
        const fence = (h: number) => {
          const chain = get('chain', mats.chain, { uv: 2, glow: false });
          for (let k = 1; k < ring.length; k++) chain.quad([ring[k - 1][0], 0, ring[k - 1][1]], [ring[k][0], 0, ring[k][1]], [ring[k][0], h, ring[k][1]], [ring[k - 1][0], h, ring[k - 1][1]], 0xffffff);
          if (!simple) { const st = get('steel', mats.steel, { cast: true }); for (const q of along(ring, 3)) st.cyl(q.x, 0, q.z, 0.03, 0.03, h + 0.05, 5, 0x8c9096, false); }
          if (!collidersDone && nearVenue(ring)) for (let k = 1; k < ring.length; k++) colliders.push(segC(ring[k - 1][0], ring[k - 1][1], ring[k][0], ring[k][1], 0.08, 'fence', false));
        };
        if (cls === 'barrier:fence') { fence(1.9); continue; }
        if (cls === 'power:substation' && closed) { get('landuse', mats.landuse, { uv: 8, ao: false }).cap(pts, 0.01, 0x8f8a80); fence(2.4); continue; }
        if (cls === 'barrier:wall' || cls === 'barrier:retaining_wall') { get('walls', mats.walls, { cast: true }).slab(ring, 0.3, 0, 1.8, 0xb7ae9e); continue; }
        if (cls === 'bridge:bridge') {
          if (!closed) continue;
          const b = get('walk', mats.walk, { uv: 4 });
          // a slab under the decks: its top 5 cm under theirs, its underside 0.1 m under theirs
          b.cap(pts, TOP - 0.05, 0xb8b4ac); b.cap(pts, TOP - 1.1, 0x8f8b84, [], true); b.walls(pts, TOP - 1.1, TOP - 0.05, 0x9c978e);
          continue;
        }
        if (cls === 'transit:parking' && closed) { get('roads', mats.roads, { uv: 6, ao: false }).cap(pts, 0.02, simple ? 0x56585b : 0xffffff); continue; }
        if (closed && pts.length >= 3) get('landuse', mats.landuse, { uv: 8, ao: false }).cap(pts, 0.006, 0xa19b8d);
        continue;
      }
      // a point prop (ours, where the data says one stands)
      const cls = D.infra[S.infra_pts[f.i * 3]], [x, z] = pts[0];
      if (simple && !PT_SIMPLE.has(cls)) continue;
      const st = get('steel', mats.steel, { cast: true }), heads = get('lamp-heads', mats.lampHeads, { glow: false });
      if (cls === 'power:power_pole') { st.cyl(x, 0, z, 0.14, 0.11, 10.8, 8, 0x6d5a45, false); st.box(x, 10.2, z, 2.2, 0.12, 0.12, 0x5a4a39); if (!collidersDone && nearVenue(pts)) colliders.push(circ(x, z, 0.2, 'pole', true)); }
      else if (cls === 'power:power_tower') { st.cyl(x, 0, z, 1.6, 0.35, 32, 4, 0x8e9296, false); st.box(x, 30, z, 9, 0.4, 0.4, 0x8e9296); st.box(x, 26, z, 7, 0.4, 0.4, 0x8e9296); }
      else if (cls === 'transportation:street_lamp') { st.cyl(x, 0, z, 0.1, 0.08, 8.4, 7, 0x6d7177, false); heads.box(x, 8.5, z, 0.7, 0.16, 0.34, 0xffffff); emitters.push({ x, y: 8.3, z, i: 60, ch: 1, reach: 30, down: 1.6 }); if (!collidersDone && nearVenue(pts)) colliders.push(circ(x, z, 0.16, 'pole', false)); }
      else if (cls === 'transportation:traffic_signals') { st.cyl(x, 0, z, 0.12, 0.1, 6.2, 8, 0x5b5f63, false); st.box(x + 2.2, 6.0, z, 4.4, 0.14, 0.14, 0x5b5f63); heads.box(x + 3.8, 5.6, z, 0.35, 1.0, 0.3, 0x222222); heads.box(x + 1.8, 5.6, z, 0.35, 1.0, 0.3, 0x222222); }
      else if (cls === 'transportation:stop') { st.cyl(x, 0, z, 0.04, 0.04, 2.2, 5, 0x888888, false); heads.box(x, 2.3, z, 0.6, 0.6, 0.04, 0xb02020); }
      else if (cls === 'transit:bus_stop') { st.cyl(x, 0, z, 0.04, 0.04, 2.6, 5, 0x888888, false); st.box(x, 2.6, z, 0.5, 0.4, 0.05, 0x355c9a); }
      else if (cls === 'emergency:fire_hydrant') st.cyl(x, 0, z, 0.15, 0.13, 0.75, 6, 0xc8b030);
      else if (cls === 'pedestrian:bench') { st.box(x, 0.45, z, 1.6, 0.06, 0.45, 0x6d5a45); st.box(x, 0.22, z, 1.4, 0.44, 0.1, 0x3a3d40); st.box(x, 0.75, z - 0.2, 1.6, 0.4, 0.05, 0x6d5a45); }
      else if (cls === 'waste_management:waste_basket') st.cyl(x, 0, z, 0.25, 0.25, 0.95, 6, 0x3d4a3d);
      else if (cls === 'transit:bicycle_parking') st.box(x, 0.45, z, 1.5, 0.9, 0.06, 0x7a7e82);
      else if (cls === 'power:transformer') st.box(x, 1.0, z, 1.8, 2.0, 1.4, 0x6b7a6e);
      else if (cls === 'power:portal') { st.box(x, 7, z, 0.3, 14, 0.3, 0x8e9296); }
      else if (cls.startsWith('barrier:')) st.box(x, 0.5, z, 0.2, 1.0, 0.2, 0x8a8a84);
    }
    const group = new THREE.Group(); group.name = which ? 'streets-near' : 'streets-far';
    const meshes: THREE.Object3D[] = kit.finish(group, emitters, true);
    if (wires.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); g.computeBoundingSphere();
      const l = new THREE.LineSegments(g, mats.wires); l.name = pre + 'wires'; group.add(l); meshes.push(l);
    }
    return { group, meshes, ids, mode };
  };

  /** one drivable piece: its ribbon at the network's heights (less its tunnel spans), its decks' sides and piers,
   *  its ramps' embankments, and (near) its markings */
  const drawPiece = (p: Piece, get: (n: string, m: THREE.Material, o?: { uv?: number; cast?: boolean; glow?: boolean; ao?: boolean }) => Batch, mode: 'near' | 'simple' | 'full', near: boolean) => {
    // sample points: the vertices, the span ends, and every 8 m where a ramp changes the height
    const ts = new Set<number>(p.cum);
    for (const [a, b] of [...p.br, ...p.tn]) { ts.add(a * p.L); ts.add(b * p.L); }
    for (let t = 0; t < p.L; t += 8) if (net.height(p.id, t) > 0.01 || net.height(p.id, Math.min(p.L, t + 8)) > 0.01) ts.add(t);
    const T = [...ts].filter((t) => t >= 0 && t <= p.L).sort((a, b) => a - b);
    const road = get('roads', mats.roads, { uv: 6, ao: false, cast: true }), walk = get('walk', mats.walk, { uv: 4 });
    // runs outside the tunnel spans (a run breaks where the next interval lies in one)
    let run: { pts: P2[]; ys: number[]; ts: number[] } = { pts: [], ys: [], ts: [] };
    const runs: typeof run[] = [];
    for (let k = 0; k < T.length; k++) {
      const t = T[k];
      run.pts.push(pointAt(p.pts, p.cum, t)); run.ys.push(Math.max(0.02, net.height(p.id, t) + 0.02)); run.ts.push(t);
      if (k + 1 < T.length && net.inTunnel(p, (t + T[k + 1]) / 2)) { if (run.pts.length >= 2) runs.push(run); run = { pts: [], ys: [], ts: [] }; }
    }
    if (run.pts.length >= 2) runs.push(run);
    let area = 0;
    for (const R of runs) {
      ribbon3(road, R.pts, R.ys, p.w, mode === 'simple' ? 0x56585b : 0xffffff);
      for (let k = 1; k < R.pts.length; k++) area += p.w * Math.hypot(R.pts[k][0] - R.pts[k - 1][0], R.pts[k][1] - R.pts[k - 1][1]);
      // the deck's sides over its br spans (a 1 m slab), the embankment's sides on its ramps
      const onDeck = R.ts.map((t) => p.br.some(([a, b]) => a * p.L - 1e-6 <= t && t <= b * p.L + 1e-6));
      let i0 = 0;
      while (i0 < R.pts.length - 1) {
        let i1 = i0 + 1; while (i1 < R.pts.length - 1 && onDeck[i1] === onDeck[i0] && onDeck[i1 + 1] === onDeck[i0]) i1++;
        const P = R.pts.slice(i0, i1 + 1), Y = R.ys.slice(i0, i1 + 1);
        if (onDeck[i0] && onDeck[i1]) sides3(walk, P, Y, p.w, 1.0, 0xb3aea5); else if (Y.some((y) => y > 0.1)) sides3(walk, P, Y, p.w, null, 0xa8a297);
        i0 = i1;
      }
      // markings (near only), laid on the ribbon's own heights
      if (mode === 'near' && polyLen(R.pts) > 8) {
        const mk = get('markings', mats.markings, { ao: false });
        if (p.cls === 'motorway' || p.cls === 'primary' || p.cls === 'secondary') {
          if (p.ow || p.cls === 'motorway') { markLine(mk, R.pts, R.ys, p.w / 2 - 0.5, 0.12, YELLOW); markLine(mk, R.pts, R.ys, -(p.w / 2 - 0.5), 0.12, WHITE); if (R.ys.every((y) => y < 0.05)) markLine(mk, R.pts, null, 0, 0.12, WHITE, [3, 9]); }
          else { markLine(mk, R.pts, R.ys, 0.15, 0.11, YELLOW); markLine(mk, R.pts, R.ys, -0.15, 0.11, YELLOW); }
        } else if (p.cls === 'tertiary' || p.cls === 'residential' || p.cls === 'unclassified') { markLine(mk, R.pts, R.ys, 0.12, 0.1, YELLOW); markLine(mk, R.pts, R.ys, -0.12, 0.1, YELLOW); }
      }
    }
    // the piers (every mode: they hold the decks up)
    const st = get('steel', mats.steel, { cast: true });
    for (const q of piers) if (q.seg === p.id) st.cyl(q.x, 0, q.z, PIER_R, PIER_R, TOP - 1.0, 8, 0xa7a299);
    drawnSegs.set(p.id, { w: p.w, area, near, ys: [Math.min(...T.map((t) => net.height(p.id, t))), Math.max(...T.map((t) => net.height(p.id, t)))] });
  };

  let collidersDone = false;
  const near = build('near', true);
  let far = build(o.far, false);
  collidersDone = true;
  /** switching to or from Ultra rebuilds the far batches; the old set's geometries are released (its materials are the
   *  page's shared street materials, kept) */
  const rebuildFar = (mode: 'simple' | 'full') => {
    const old = far;
    far = build(mode, false);
    old.group.removeFromParent();
    old.group.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined; if (g) g.dispose(); });
    return far;
  };

  /** every connector has one drawn height: the largest spread between the pieces that meet there */
  const connectorSpread = () => {
    const at = new Map<string, number[]>();
    for (const p of net.pieces.values()) for (const m of p.marks) if (m.node.startsWith('c')) { if (!at.has(m.node)) at.set(m.node, []); at.get(m.node)!.push(net.height(p.id, m.t)); }
    let worst = 0, n = 0; for (const hs of at.values()) { if (hs.length < 2) continue; n++; worst = Math.max(worst, Math.max(...hs) - Math.min(...hs)); }
    return { connectors: n, worst: +worst.toFixed(4) };
  };
  /** crossings without a junction: how many, and any closer than CLEAR in height and not in a tunnel span */
  const crossings = () => {
    const list = [...net.pieces.values()];
    const conn = new Map(list.map((p) => [p.id, new Set(p.marks.filter((m) => m.node.startsWith('c')).map((m) => m.node))]));
    let n = 0, tunnels = 0; const tight: [number, number, number, number][] = [];
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = list[a], Bp = list[b];
      if ([...conn.get(A.id)!].some((c) => conn.get(Bp.id)!.has(c))) continue;
      for (let i = 1; i < A.pts.length; i++) for (let j = 1; j < Bp.pts.length; j++) {
        const [p0, p1] = [A.pts[i - 1], A.pts[i]], [q0, q1] = [Bp.pts[j - 1], Bp.pts[j]];
        const d = (p1[0] - p0[0]) * (q1[1] - q0[1]) - (p1[1] - p0[1]) * (q1[0] - q0[0]); if (Math.abs(d) < 1e-12) continue;
        const ta = ((q0[0] - p0[0]) * (q1[1] - q0[1]) - (q0[1] - p0[1]) * (q1[0] - q0[0])) / d, tb = ((q0[0] - p0[0]) * (p1[1] - p0[1]) - (q0[1] - p0[1]) * (p1[0] - p0[0])) / d;
        if (ta < 0 || ta > 1 || tb < 0 || tb > 1) continue;
        n++;
        const sa = A.cum[i - 1] + ta * (A.cum[i] - A.cum[i - 1]), sb = Bp.cum[j - 1] + tb * (Bp.cum[j] - Bp.cum[j - 1]);
        if (net.inTunnel(A, sa) || net.inTunnel(Bp, sb)) { tunnels++; continue; }
        const ha = net.height(A.id, sa), hb = net.height(Bp.id, sb);
        if (Math.abs(ha - hb) < CLEAR) tight.push([A.id, Bp.id, +ha.toFixed(1), +hb.toFixed(1)]);
      }
    }
    return { crossings: n, tunnels, tight };
  };
  return {
    near, get far() { return far; }, rebuildFar, colliders, net, piers, leftOut, drawnSegs, connectorSpread, crossings,
    counts: () => {
      const c = (set: StreetSet) => Object.fromEntries(Object.entries(set.ids).map(([k, v]) => [k, v.length]));
      return { near: c(near), far: c(far) };
    },
  };
}
export type Streets = ReturnType<typeof buildStreets>;

// ------------------------------------------------------------------ the I-5's light streams (ours)
/** head and tail lamps of cars moving along the given carriageway chains at their drawn height, 0.6 m over the
 *  ribbon: two instanced quad meshes, a quad per car's head or tail lights. `maxCars` sizes the meshes (Ultra's 400);
 *  each update takes the preset's car count and spreads it over the chains by their length, so every chain carries
 *  its share at every preset (S1 wrote all 400 and the page cut the count after, which left the first chain alone
 *  carrying lights at Low and HD) */
export function lightStreams(streets: Streets, chains: number[][], maxCars: number, headMat: THREE.Material, tailMat: THREE.Material) {
  const net = streets.net;
  const paths = chains.map((ids) => {
    const pts: P2[] = [], ys: number[] = [];
    for (const id of ids) {
      const p = net.pieces.get(id); if (!p) continue;
      for (let t = 0; t <= p.L; t += 6) { pts.push(pointAt(p.pts, p.cum, t)); ys.push(net.height(id, t) + 0.6); }
    }
    const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    return { pts, ys, cum, L: cum[cum.length - 1] };
  });
  const quad = new THREE.PlaneGeometry(1.7, 0.32);
  const head = new THREE.InstancedMesh(quad, headMat, maxCars), tail = new THREE.InstancedMesh(quad, tailMat, maxCars);
  head.name = 'near-streams-head'; tail.name = 'near-streams-tail';
  for (const m of [head, tail]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.count = 0; }
  const total = paths.reduce((a, p) => a + p.L, 0);
  /** how many cars the last update put on each chain */
  const perPath = paths.map(() => 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
  const update = (time: number, camera: THREE.Camera, on: boolean, cars: number) => {
    const count = Math.max(0, Math.min(maxCars, Math.floor(cars)));
    for (let j = 0; j < perPath.length; j++) perPath[j] = 0;
    head.count = tail.count = 0;
    if (!on || count === 0) return;
    let k = 0;
    for (let pi = 0; pi < paths.length; pi++) {
      const p = paths[pi];
      // this chain's share by length (the last chain takes what's left, so the shares sum to the count)
      const n = pi === paths.length - 1 ? count - k : Math.max(1, Math.round((count * p.L) / total));
      for (let c = 0; c < n && k < count; c++, k++) {
        const speed = 27 + ((c * 7919) % 9);
        const s = ((c * p.L) / n + time * speed) % p.L;
        let i = 1; while (i < p.cum.length - 1 && p.cum[i] < s) i++;
        const f = (s - p.cum[i - 1]) / Math.max(1e-6, p.cum[i] - p.cum[i - 1]);
        const x = p.pts[i - 1][0] + (p.pts[i][0] - p.pts[i - 1][0]) * f, z = p.pts[i - 1][1] + (p.pts[i][1] - p.pts[i - 1][1]) * f, y = p.ys[i - 1] + (p.ys[i] - p.ys[i - 1]) * f;
        const dx = p.pts[i][0] - p.pts[i - 1][0], dz = p.pts[i][1] - p.pts[i - 1][1], l = Math.hypot(dx, dz) || 1;
        // face the camera round y (a billboard along the road's side)
        e.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0); q.setFromEuler(e);
        pos.set(x + (dx / l) * 2.1, y, z + (dz / l) * 2.1); head.setMatrixAt(k, m4.compose(pos, q, one));
        pos.set(x - (dx / l) * 2.1, y, z - (dz / l) * 2.1); tail.setMatrixAt(k, m4.compose(pos, q, one));
        perPath[pi]++;
      }
    }
    head.count = tail.count = k;
    head.instanceMatrix.needsUpdate = true; tail.instanceMatrix.needsUpdate = true;
  };
  return { head, tail, update, paths, perPath, maxCars };
}
