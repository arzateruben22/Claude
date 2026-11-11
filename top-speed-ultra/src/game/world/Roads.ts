// Streams the real freeways in 160 m chunks: every carriageway and ramp within the draw distance, nearest first.
// Where two roads overlap (a ramp leaving, a freeway ending in another) the better-ranked one is drawn and the
// other leaves a hole, so nothing flickers. Barriers run wherever a road's edge isn't opening onto another road.
// Elevated sections get a deck underside and columns down to the ground. Street overpasses come from the data.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Path, STEP, LANE_W, ORIGIN } from './Path';
import { Network, Overpass, Sign, Hit, DIR_WORD, ROUTE_LABEL, rank, onTop, GIVE_WAY, LEVEL, CLEAR, CLEAR_TOP, DECK_MIN, SIDE_CLEAR } from './Network';
import * as P from '../road/props';
import * as T from '../textures';
import { fbm2, rng, clamp } from '../util';
import type { QualityPreset } from '../settings';

export const CHUNK = 160;
const DASH = 3.66, GAP = 10.97, PERIOD = DASH + GAP;
const TOLL = new Set(['SR-73', 'SR-133', 'SR-241', 'SR-261']);

interface Desc { key: number; path: Path | null; k: number; over: Overpass | null; x: number; z: number; r: number }
interface Built { desc: Desc; group: THREE.Group; ox: number; oz: number }
interface Row { x: number; y: number; z: number; h: number; s: number; ax: number; az: number }

const DCELL = 400;
const dKey = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512);

export class Roads {
  readonly group = new THREE.Group();
  private descs: Desc[] = [];
  private dgrid = new Map<number, Desc[]>();
  private built = new Map<number, Built>();
  private m: Record<string, THREE.Material>;
  private signsBy = new Map<number, Sign[]>();

  constructor(private net: Network, private q: QualityPreset) {
    const a = T.asphalt(), sh = T.shoulder(), c = T.concrete(), pc = T.pcc(), bw = T.blockWall();
    const off = (m: THREE.MeshStandardMaterial, f: number) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f; return m; };
    this.m = {
      asphalt: off(new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap, roughnessMap: a.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xb9b7b2 }), -1),
      shoulder: off(new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normalMap, roughness: 0.95, color: 0xa8a49c }), -1),
      pcc: off(new THREE.MeshStandardMaterial({ map: pc.map, normalMap: pc.normalMap, roughnessMap: pc.roughnessMap, normalScale: new THREE.Vector2(0.5, 0.5), color: 0xd8d4cc }), -1),
      concrete: new THREE.MeshStandardMaterial({ map: c.map, normalMap: c.normalMap, roughness: 0.9, color: 0xe0dcd3, side: THREE.DoubleSide }),
      wall: new THREE.MeshStandardMaterial({ map: bw.map, normalMap: bw.normalMap, roughness: 0.95, color: 0xf0e8da, side: THREE.DoubleSide }),
      under: new THREE.MeshStandardMaterial({ map: c.map, roughness: 0.95, color: 0x9d988f, side: THREE.DoubleSide }),
      paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
      cushion: new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.6 }),
    };
    this.group.name = 'roads';
    for (const p of net.paths) {
      // (to its end: where a road that just stops was cut back off another's lanes, Network.trimEnds)
      const n = Math.max(1, Math.ceil(p.end / CHUNK));
      for (let k = 0; k < n; k++) {
        const sm = Math.min(p.end, (k + 0.5) * CHUNK), at = p.at(sm, 0);
        const a = p.at(k * CHUNK, 0), b = p.at(Math.min(p.end, (k + 1) * CHUNK), 0);
        const r = Math.max(Math.hypot(a.x - at.x, a.z - at.z), Math.hypot(b.x - at.x, b.z - at.z)) + 30;
        this.addDesc({ key: p.id * 4096 + k, path: p, k, over: null, x: at.x, z: at.z, r });
      }
    }
    for (const o of net.overpasses) {
      const x = (o.ax + o.bx) / 2, z = (o.az + o.bz) / 2;
      this.addDesc({ key: 1e9 + o.id, path: null, k: 0, over: o, x, z, r: Math.hypot(o.bx - o.ax, o.bz - o.az) / 2 + 160 });
    }
    for (const s of net.signs) { let a = this.signsBy.get(s.path.id); if (!a) this.signsBy.set(s.path.id, (a = [])); a.push(s); }
  }

  private addDesc(d: Desc) {
    this.descs.push(d);
    const c0 = Math.floor((d.x - d.r) / DCELL), c1 = Math.floor((d.x + d.r) / DCELL), r0 = Math.floor((d.z - d.r) / DCELL), r1 = Math.floor((d.z + d.r) / DCELL);
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) { let a = this.dgrid.get(dKey(cx, cz)); if (!a) this.dgrid.set(dKey(cx, cz), (a = [])); a.push(d); }
  }

  get count() { return this.built.size; }

  // rain darkens the asphalt and makes it glossy (it picks up the sky and the lights)
  setWet(w: number) {
    const a = this.m.asphalt as THREE.MeshStandardMaterial, sh = this.m.shoulder as THREE.MeshStandardMaterial, pc = this.m.pcc as THREE.MeshStandardMaterial;
    a.roughness = 1 - 0.62 * w; a.color.setHex(0xb9b7b2).multiplyScalar(1 - 0.32 * w); a.envMapIntensity = 1 + 1.2 * w;
    sh.roughness = 0.95 - 0.5 * w; sh.color.setHex(0xa8a49c).multiplyScalar(1 - 0.3 * w);
    pc.roughness = 1 - 0.55 * w; pc.color.setHex(0xd8d4cc).multiplyScalar(1 - 0.3 * w); pc.envMapIntensity = 1 + 1.0 * w;
  }

  // build what's within the draw distance (nearest and in front first), drop what's well beyond it
  update(x: number, z: number, hx: number, hz: number, budget = 1) {
    const R = this.q.drawDistance;
    for (const [k, b] of this.built) {
      const d = b.desc;
      if (Math.hypot(d.x - x, d.z - z) - d.r > R + 250) { this.drop(b); this.built.delete(k); }
    }
    const want: [number, Desc][] = [];
    const c0 = Math.floor((x - R) / DCELL), c1 = Math.floor((x + R) / DCELL), r0 = Math.floor((z - R) / DCELL), r1 = Math.floor((z + R) / DCELL);
    const seen = new Set<number>();
    for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) {
      const a = this.dgrid.get(dKey(cx, cz));
      if (!a) continue;
      for (const d of a) {
        if (seen.has(d.key) || this.built.has(d.key)) continue;
        seen.add(d.key);
        const dx = d.x - x, dz = d.z - z, dist = Math.hypot(dx, dz) - d.r;
        if (dist > R) continue;
        // in front of you counts as closer
        const ahead = (dx * hx + dz * hz) / Math.max(1, Math.hypot(dx, dz));
        want.push([Math.max(0, dist) * (1.4 - ahead * 0.6), d]);
      }
    }
    want.sort((a, b) => a[0] - b[0]);
    let n = 0;
    for (const [, d] of want) {
      if (n >= budget) break;
      this.built.set(d.key, d.path ? this.buildChunk(d) : this.buildOverpass(d));
      n++;
    }
    return n;
  }
  pending(x: number, z: number) {
    const R = this.q.drawDistance; let n = 0;
    for (const d of this.descs) if (!this.built.has(d.key) && Math.hypot(d.x - x, d.z - z) - d.r <= R) n++;
    return n;
  }

  rebase() { for (const b of this.built.values()) b.group.position.set(b.ox - ORIGIN.x, 0, b.oz - ORIGIN.z); }
  clear() { for (const b of this.built.values()) this.drop(b); this.built.clear(); }

  // May a side of a cut road surface (from `top` down to `foot`) stand at world (x, z)? Not in a carriageway's drawn
  // travel lanes (other than `self`'s), widened by SIDE_CLEAR, anywhere from 0.05 m to CLEAR over them: the overhead
  // clearance the lanes check holds every other road to. Returns `foot`, or NaN where it can't. (It raised the foot to
  // just over the check's old 2 m instead: the side closing ramp 800's cut over the I-5 North hung 2.01 to 2.31 m over
  // the left lane, a concrete beam at windscreen height.) cutSides builds its sides by this, and the suite's cut-edge check
  // exempts an open edge by this same rule.
  sideFoot(x: number, z: number, top: number, foot: number, self?: Path) {
    for (const h of this.net.near(x, z, 1, SIDE_HITS)) {
      const m = h.path;
      if (!m.lanesClear || m === self || h.s < 0 || h.s > m.len || h.d < m.edgeL - SIDE_CLEAR || h.d > m.edgeR + SIDE_CLEAR) continue;
      const my = m.height(h.s);
      if (top < my + 0.05 || foot >= my + CLEAR) continue;
      const a = m.at(h.s, h.d, SIDE_AT);
      if (this.net.covered(a.x, a.z, a.y, m, -0.25, true, LEVEL)) continue;      // that lane isn't drawn here
      return NaN;
    }
    return foot;
  }
  // and only where it closes a gap down to another road's pavement: its foot on that pavement (to 0.3 m past its edge),
  // and not as a free wall at the outer edge of that road's shoulder (its last 0.6 m) under a road on the ground there
  // (top under 4.5 m above the bare earth, Terrain's own test for a bridge), over 0.6 m tall. There the road it closes is
  // over the other road's pavement only by a sliver, and the terrain shaped up to it beyond that pavement's edge closes
  // the gap: ramp 961 comes down a grass slope at grade into the CA-241 North, and the side closing its cut over the
  // 241's left shoulder (30,880 m) stood 1 to 2.5 m tall on the shoulder's edge in front of the slope, where the shoulder
  // had been open. (Asking for the bare earth well under every foot instead left 325 small gaps open where roads at grade
  // meet in a cutting, the earth over both.) Used by cutSides and by the suite's cut-edge check.
  // (slack: how much stricter to be, for the suite's exemption of an open edge, as a side's piece is judged at its ends)
  sideGround(x: number, z: number, foot: number, top: number, self?: Path, slack = 0) {
    const q = this.net.pavedAt(x, z, foot - 0.1, foot + 0.1, self ?? null, 0.3);
    if (!q) return false;
    if (top - foot <= 0.6 - slack) return true;
    const h = this.net.near(x, z, 1, SIDE_HITS).find((k) => k.path === q);
    if (!h || (h.d > q.paveL + 0.6 + slack && h.d < q.paveR - 0.6 - slack)) return true;
    return top - this.net.ground(x, z) > 4.5 + slack;
  }

  private drop(b: Built) {
    this.group.remove(b.group);
    b.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) (mesh as unknown as THREE.InstancedMesh).dispose();
      else if (mesh.geometry && mesh.userData.own) mesh.geometry.dispose();
      if (mesh.userData.ownMat) (mesh.material as THREE.Material).dispose();
    });
  }

  // ------------------------------------------------------------------------------------------- a chunk of road
  private buildChunk(desc: Desc): Built {
    const p = desc.path!, net = this.net;
    const s0 = desc.k * CHUNK, s1 = Math.min(p.end, s0 + CHUNK);
    const o = p.at(s0, 0), ox = o.x, oz = o.z;
    const group = new THREE.Group();
    group.position.set(ox - ORIGIN.x, 0, oz - ORIGIN.z);
    const rows: Row[] = [];
    for (let s = s0; ; s += STEP) {
      const ss = Math.min(s, s1), pt = p.sample(ss);
      rows.push({ x: pt.x - ox, y: pt.y, z: pt.z - oz, h: pt.h, s: ss, ax: pt.x, az: pt.z });
      if (ss >= s1) break;
    }
    const own = (mesh: THREE.Mesh | THREE.LineSegments, shadow = true) => { mesh.userData.own = true; mesh.receiveShadow = shadow; group.add(mesh); return mesh; };
    // is any other road within 40 m of this chunk, and a better-ranked one (that can take this one's place)? If not, the
    // tests against other roads are skipped (a freeway among its own ramps never gives way to them)
    let crowded = false, outranked = false;
    // (and the carriageways and Go To ramps among them, lanesClear: where each falls near the chunk, a guess along it per
    // stretch, for clearUnder)
    CLEAR_Q.length = 0; CLEAR_S.length = 0;
    for (let i = 0; i < rows.length; i += 8) for (const h of net.near(rows[i].ax, rows[i].az, 40, ROW_HITS)) {
      if (h.path === p) continue;
      crowded = true;
      if (rank(h.path) < rank(p)) outranked = true;
      if (!h.path.lanesClear) continue;
      let k = 0; while (k < CLEAR_Q.length && (CLEAR_Q[k] !== h.path || Math.abs(CLEAR_S[k] - h.s) > 60)) k++;
      if (k === CLEAR_Q.length) { CLEAR_Q.push(h.path); CLEAR_S.push(h.s); }
    }
    // Could a carriageway's (or a Go To ramp's) pavement be under row i's deck or barriers, from 0.05 m to CLEAR plus a
    // deck's depth below the row (where they'd be thinned to clear it)? A first look from the row's centre, so the deck's
    // depth and the barriers' backs (headroom) are only looked at closely where one may be: every point of the deck is
    // within W of the centre, so falls on that road within W of where the centre does (half as far again along it, on the
    // inside of a curve), its height there between that stretch's lowest and highest sample.
    const W = Math.max(p.wallR, -p.wallL) + 0.6, WS = W * 1.5 + 2, clearRow = new Int8Array(rows.length).fill(-1), rowIdx = new Map(rows.map((r, i) => [r, i]));
    const clearUnder = (i: number) => {
      if (clearRow[i] >= 0) return clearRow[i] === 1;
      const row = rows[i];
      let r = 0;
      for (let k = 0; k < CLEAR_Q.length && !r; k++) {
        const q = CLEAR_Q[k], pc = q.project(row.ax, row.az, CLEAR_S[k], PRS);
        const reachQ = Math.max(-Math.min(q.edgeL - SIDE_CLEAR - 1.5, q.paveL - 1), Math.max(q.edgeR + SIDE_CLEAR + 1.5, q.paveR + 1));
        if (Math.abs(pc.d) > reachQ + W + 2 || pc.s < -WS || pc.s > q.len + WS) continue;
        let lo = Infinity, hi = -Infinity;
        for (let j = clamp(Math.floor((pc.s - WS) / STEP), 0, q.n - 1), j1 = clamp(Math.ceil((pc.s + WS) / STEP) + 1, 0, q.n - 1); j <= j1; j++) { lo = Math.min(lo, q.ys[j]); hi = Math.max(hi, q.ys[j]); }
        if (row.y - lo > 0.05 && row.y - hi < CLEAR + 1.52) r = 1;
      }
      clearRow[i] = r;
      return r === 1;
    };
    // the same test for the surfaces, many points a row: one search a row for the better-ranked roads across it, then
    // each point projected onto those few (from where the row's centre falls on them)
    // Each row's roads are kept in flat lists shared by every chunk (ROW_P, ROW_S; row i's from rowFrom[i] to rowTo[i]),
    // so a search allocates nothing (chunks are built while driving)
    ROW_P.length = 0; ROW_S.length = 0;
    const rowFrom = new Int32Array(rows.length).fill(-1), rowTo = new Int32Array(rows.length), PRS = { s: 0, d: 0 }, AT = { x: 0, y: 0, z: 0, h: 0 };
    // the height of the better-ranked road this one is on at (s, d) on row i (from 2.5 m under it to `above` over it; the
    // first found, or the highest), or NaN where there's none
    const BEST: { q: Path | null; s: number } = { q: null, s: 0 };
    const rowRoads = (i: number) => {
      if (rowFrom[i] >= 0) return;
      rowFrom[i] = ROW_P.length;
      for (const h of net.near(rows[i].ax, rows[i].az, Math.max(p.wallR, -p.wallL) + 1.5, ROW_HITS)) if (h.path !== p && rank(h.path) < rank(p)) { ROW_P.push(h.path); ROW_S.push(h.s); }
      rowTo[i] = ROW_P.length;
    };
    const onRoadY = (i: number, s: number, d: number, y: number, margin: number, above = LEVEL, highest = false) => {
      if (!outranked) return NaN;
      rowRoads(i);
      if (rowFrom[i] === rowTo[i]) return NaN;
      const a = p.at(s, d, AT);
      let best = NaN;
      BEST.q = null;
      for (let k = rowFrom[i]; k < rowTo[i]; k++) {
        const q = ROW_P[k], pr = q.project(a.x, a.z, ROW_S[k], PRS);
        if (pr.s < 0 || pr.s > q.len || pr.d < q.paveL - margin || pr.d > q.paveR + margin) continue;
        const qy = q.height(pr.s);
        if (!onTop(y, qy, above)) continue;
        if (!highest) return qy;
        if (!(qy <= best)) { best = qy; BEST.q = q; BEST.s = pr.s; }
      }
      // (the highest: where that's a road over this one, a road above takes this one's place, and nothing is open under it)
      return best > y + 0.1 ? NaN : best;
    };
    const coveredOnRow = (i: number, s: number, d: number, y: number, margin: number) => !isNaN(onRoadY(i, s, d, y, margin));
    // how far under (s, d) at height y a barrier's back may hang: down to CLEAR over any carriageway's pavement there
    // (widened by 0.5 m), less 2 cm; Infinity where there's none
    const headroom = (s: number, d: number, y: number) => {
      const a = p.at(s, d, AT);
      let best = Infinity;
      for (const h of net.near(a.x, a.z, 0.5, HEAD_HITS)) {
        const q = h.path;
        if (q === p || !q.lanesClear || h.s < 0 || h.s > q.len || h.d < q.paveL - 0.5 || h.d > q.paveR + 0.5) continue;
        const g = y - q.height(h.s);
        if (g > 0.05) best = Math.min(best, g - CLEAR - 0.02);
      }
      return best;
    };
    // Is (s, d) on row i, at height y, over a better-ranked carriageway's travel lanes (widened by margin) by 0.05 m to
    // CLEAR_TOP? There this road's surface goes, and its deck, barriers and paint with it: the levelling holds a road
    // over a carriageway's lanes at grade with it or clear of it (Network.laneRuns), and this is where it couldn't (a
    // climb from one carriageway to clear the next, a main's grade). Up to LEVEL the carriageway takes its place; above,
    // it is cut back off those lanes, the edge closed by a side down to their shoulder (cutSides).
    const bandOnRow = (i: number, s: number, d: number, y: number, margin: number) => {
      if (!outranked) return false;
      rowRoads(i);
      const a = p.at(s, d, AT);
      for (let k = rowFrom[i]; k < rowTo[i]; k++) {
        const q = ROW_P[k];
        if (!q.lanesClear) continue;
        const pr = q.project(a.x, a.z, ROW_S[k], PRS);
        if (pr.s < 0 || pr.s > q.len || pr.d < q.edgeL - margin || pr.d > q.edgeR + margin) continue;
        const g = y - q.height(pr.s);
        if (g > 0.05 && g < CLEAR_TOP) return true;
      }
      return false;
    };
    // coveredOnRow(i, s, d, y, margin) || bandOnRow(i, s, d, y, bandMargin), with one projection a road (cells() asks it
    // at every corner and column of a cut surface)
    const coverOrBand = (i: number, s: number, d: number, y: number, margin: number, bandMargin: number) => {
      if (!outranked) return false;
      rowRoads(i);
      if (rowFrom[i] === rowTo[i]) return false;
      const a = p.at(s, d, AT);
      for (let k = rowFrom[i]; k < rowTo[i]; k++) {
        const q = ROW_P[k], pr = q.project(a.x, a.z, ROW_S[k], PRS);
        if (pr.s < 0 || pr.s > q.len) continue;
        const qy = q.height(pr.s);
        if (pr.d >= q.paveL - margin && pr.d <= q.paveR + margin && onTop(y, qy, LEVEL)) return true;
        if (q.lanesClear && pr.d >= q.edgeL - bandMargin && pr.d <= q.edgeR + bandMargin && y - qy > 0.05 && y - qy < CLEAR_TOP) return true;
      }
      return false;
    };
    // A surface across the road (points [d, lift] with the texture's u at each), less what a better-ranked road covers. A
    // quad covered at both sides, at both ends, goes; one covered nowhere stays; one the other road's edge runs through is
    // cut into strips about 0.6 m wide that go or stay on their own. (Quads went or stayed by their centre alone: a lane
    // 3.7 m across, more than half covered, left the rest of its width open to the ground, a trench of dirt along the
    // junction, and one less than half covered stayed, lying over the other road.) rowOk(i) can leave out the rows from
    // i to i + 1 as well. A deck's soffit (hangs) also goes over any road from GIVE_WAY under this one's surface up to it,
    // where it would hang into that road's lanes: anywhere from 0.3 m under, and level with it too along this road's edges
    // and past them. (It stayed over a road 0.3 to 2.5 m under it well inside this road's pavement, where that road's lanes
    // are left out but its cars still drive: where the CA-55 North climbs into the CA-91 East, 1.2 to 3.2 m under it, the
    // 91's soffit hung across the 55's left lanes from 0.2 m up, a slab of concrete at bumper and windscreen height.)
    const overRoad = (s: number, d: number, y: number, margin: number) => {
      if (!crowded) return false;
      const a = p.at(s, d);
      return !!net.pavedAt(a.x, a.z, y - GIVE_WAY, y - 0.3, p, margin) || ((d < p.paveL + 0.6 || d > p.paveR - 0.6) && !!net.pavedAt(a.x, a.z, y - 0.3, y + 0.3, p, margin));
    };
    // which of a surface's cells stay: the profile's quads, each cut into columns about 0.6 m wide, a row apart along the
    // road (keep: 1 stays, 0 goes, 2 isn't drawn: rowOk), and each quad's state (0 stays, 1 goes, 2 is cut)
    const cells = (prof: [number, number][], rowOk: (i: number) => boolean, hangs: boolean, under?: (s: number, d: number) => boolean) => {
      const nq = prof.length - 1, memo = new Map<number, boolean>();
      // (the band widened where the cover test is narrowed: a cell stays unless all of it is covered, and goes if any of
      // it is over those lanes)
      const gone = (i: number, s: number, d: number, margin: number) => coverOrBand(i, s, d, rows[i].y, margin, SIDE_CLEAR - Math.min(0, margin)) || (hangs && overRoad(s, d, rows[i].y, margin));
      const at = (i: number, q: number, k: number) => {
        const key = (i * 64 + q) * 2 + k;
        let c = memo.get(key);
        if (c === undefined) {
          const [d0, d1] = [prof[q][0], prof[q + 1][0]], inset = Math.min(0.3, (d1 - d0) / 2);
          c = gone(i, rows[i].s, k ? d1 - inset : d0 + inset, -0.25);
          memo.set(key, c);
        }
        return c;
      };
      const fine: [number, number][] = [], of: number[] = [];
      for (let q = 0; q < nq; q++) {
        const m = Math.max(1, Math.round((prof[q + 1][0] - prof[q][0]) / 0.6));
        for (let k = 0; k < m; k++) {
          const t = k / m;
          fine.push([prof[q][0] + (prof[q + 1][0] - prof[q][0]) * t, prof[q][1] + (prof[q + 1][1] - prof[q][1]) * t]); of.push(q);
        }
      }
      fine.push(prof[nq]);
      const R = rows.length - 1, nf = fine.length - 1, state = new Uint8Array(R * nq), keep = new Uint8Array(R * nf);
      for (let i = 0; i < R; i++) {
        const ok = rowOk(i);
        for (let q = 0; q < nq; q++) {
          let n = 0;
          if (ok) for (const r of [i, i + 1]) for (const k of [0, 1]) if (at(r, q, k)) n++;
          state[i * nq + q] = n === 0 ? 0 : n === 4 ? 1 : 2;
        }
        for (let j = 0; j < nf; j++) {
          const st = state[i * nq + of[j]];
          if (!ok) { keep[i * nf + j] = 2; continue; }
          if (st !== 2) { keep[i * nf + j] = st === 0 ? 1 : 0; continue; }
          const half = (fine[j + 1][0] - fine[j][0]) / 2;
          keep[i * nf + j] = gone(i, (rows[i].s + rows[i + 1].s) / 2, fine[j][0] + half, -(half + 0.05)) ? 0 : 1;
        }
      }
      // A cut quad the other road's edge crosses once, at both rows and the same way round, is cut along that edge
      // (found to 2 cm at each row, straight between): what stays is one piece with a straight side, not columns 0.6 m
      // wide a row long (a staircase of them along the edge). A deck's soffit keeps its columns, and only those under
      // what stays of the surface (`under`): they lay 1.5 m down, a few centimetres over the road there, as grey steps
      // past the surface's edge. side[]: 1 where the left part goes, -1 the right, 0 not
      // cut this way; edge[]: where it crosses, at row i and at row i + 1.
      const side = new Int8Array(R * nq), edge = new Float32Array(R * nq * 2), N = 8, g = new Uint8Array(N + 1);
      // where the other road's edge crosses quad q at row r: [-1 | 1 (which part goes), d] or null (not once, or nowhere)
      const cross = (r: number, q: number): [number, number] | null => {
        const d0 = prof[q][0], d1 = prof[q + 1][0], test = (d: number) => gone(r, rows[r].s, d, -0.25);
        let n = 0;
        for (let k = 0; k <= N; k++) { g[k] = test(d0 + ((d1 - d0) * k) / N) ? 1 : 0; if (k && g[k] !== g[k - 1]) n++; }
        if (n === 0) return [g[0] ? 2 : 0, 0];
        if (n > 1) return null;
        let k = 0; while (g[k + 1] === g[k]) k++;
        let a = d0 + ((d1 - d0) * k) / N, b = d0 + ((d1 - d0) * (k + 1)) / N;
        for (let it = 0; it < 6; it++) { const m = (a + b) / 2; if ((test(m) ? 1 : 0) === g[0]) a = m; else b = m; }
        return [g[0] ? 1 : -1, (a + b) / 2];
      };
      // only under what stays of the surface above (a deck's soffit): a cell goes unless that is over all of it
      if (under) for (let i = 0; i < R; i++) for (let j = 0; j < nf; j++) {
        if (keep[i * nf + j] !== 1) continue;
        const e = 0.01, sa = rows[i].s + e, sb = rows[i + 1].s - e, da = fine[j][0] + e, db = fine[j + 1][0] - e;
        if (under(sa, da) && under(sa, db) && under(sb, da) && under(sb, db)) continue;
        keep[i * nf + j] = 0; state[i * nq + of[j]] = 2;
      }
      for (let i = 0; i < R && !hangs; i++) for (let q = 0; q < nq; q++) {
        if (state[i * nq + q] !== 2) continue;
        const A = cross(i, q), B = cross(i + 1, q);
        // only where the edge crosses the quad at both rows, the same way round: where it crosses at one row only, it
        // leaves the quad somewhere between, and a straight side to the quad's corner at the other row (what this did)
        // kept a sliver of surface over the road that took its place (ramp 961, 0.7 m over the CA-241 North's lanes);
        // those quads keep their columns
        if (!A || !B || Math.abs(A[0]) !== 1 || B[0] !== A[0]) continue;
        const o = A[0];
        side[i * nq + q] = o; edge[(i * nq + q) * 2] = A[1]; edge[(i * nq + q) * 2 + 1] = B[1];
        const mid = (edge[(i * nq + q) * 2] + edge[(i * nq + q) * 2 + 1]) / 2;
        for (let j = 0; j < nf; j++) if (of[j] === q) { const c = (fine[j][0] + fine[j + 1][0]) / 2; keep[i * nf + j] = (o === 1 ? c > mid : c < mid) ? 1 : 0; }
      }
      return { nq, nf, fine, of, state, keep, side, edge };
    };
    type Cells = ReturnType<typeof cells>;
    // quads qa to qb of a cells() result, as cells() gives them for that part of its profile alone (a quad's cells are
    // its own): the lanes and the shoulders take theirs from the pavement's, cut once
    const part = (c: Cells, qa: number, qb: number): Cells => {
      const R = rows.length - 1, nq = qb - qa;
      let ja = 0; while (c.of[ja] < qa) ja++;
      let jb = ja; while (jb < c.nf && c.of[jb] < qb) jb++;
      const nf = jb - ja, state = new Uint8Array(R * nq), side = new Int8Array(R * nq), edge = new Float32Array(R * nq * 2), keep = new Uint8Array(R * nf);
      for (let i = 0; i < R; i++) {
        state.set(c.state.subarray(i * c.nq + qa, i * c.nq + qb), i * nq);
        side.set(c.side.subarray(i * c.nq + qa, i * c.nq + qb), i * nq);
        edge.set(c.edge.subarray((i * c.nq + qa) * 2, (i * c.nq + qb) * 2), i * nq * 2);
        keep.set(c.keep.subarray(i * c.nf + ja, i * c.nf + jb), i * nf);
      }
      return { nq, nf, fine: c.fine.slice(ja, jb + 1), of: c.of.slice(ja, jb).map((q) => q - qa), state, keep, side, edge };
    };
    const surface = (prof: [number, number][], u: number[], v: (row: Row) => number, rowOk = (_i: number) => true, hangs = false, under?: (s: number, d: number) => boolean, lift?: (i: number, dy: number) => number, pre?: Cells) => {
      const { nq, nf, fine, of, state, keep, side, edge } = pre ?? cells(prof, rowOk, hangs, under);
      const whole = this.strip(rows, prof, (row, j) => [u[j], v(row)], (i, q) => rowOk(i) && state[i * nq + q] === 0, lift);
      // the cut quads, as one strip of narrow columns (the others left out of it)
      const fu: number[] = [];
      for (let j = 0; j <= nf; j++) {
        const q = j < nf ? of[j] : nq - 1, d0 = prof[q][0], d1 = prof[q + 1][0];
        fu.push(j < nf ? u[q] + (u[q + 1] - u[q]) * (d1 > d0 ? (fine[j][0] - d0) / (d1 - d0) : 0) : u[nq]);
      }
      const cut = this.strip(rows, fine, (row, j) => [fu[j], v(row)], (i, j) => state[i * nq + of[j]] === 2 && !side[i * nq + of[j]] && keep[i * nf + j] === 1, lift);
      // the quads cut along the other road's edge: the part that stays, its corners at that edge and the quad's far side
      const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
      for (let i = 0; i < rows.length - 1; i++) for (let q = 0; q < nq; q++) {
        const o = side[i * nq + q];
        if (!o) continue;
        const base = pos.length / 3;
        for (const r of [0, 1]) {
          const row = rows[i + r], c = Math.cos(row.h), sn = Math.sin(row.h), e = edge[(i * nq + q) * 2 + r];
          for (const d of o === 1 ? [e, prof[q + 1][0]] : [prof[q][0], e]) {
            const t = prof[q + 1][0] > prof[q][0] ? (d - prof[q][0]) / (prof[q + 1][0] - prof[q][0]) : 0;
            const dy = prof[q][1] + (prof[q + 1][1] - prof[q][1]) * t;
            pos.push(row.x - c * d, row.y + (lift ? lift(i + r, dy) : dy), row.z + sn * d);
            uvs.push(u[q] + (u[q + 1] - u[q]) * t, v(row));
          }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
      let edged: THREE.BufferGeometry | null = null;
      if (idx.length) {
        edged = new THREE.BufferGeometry();
        edged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        edged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        edged.setIndex(idx); edged.computeVertexNormals();
      }
      const parts = [whole, cut, edged].filter(Boolean) as THREE.BufferGeometry[];
      return parts.length ? (parts.length > 1 ? mergeGeometries(parts)! : parts[0]) : null;
    };
    // The cut's sides. Where the surface is left out over a better-ranked road lower than it (by up to LEVEL), what stays
    // of it stood over that road with its edge open: from a seat or a chase camera the eye ran in under it, to the ground
    // under its deck (the CA-241 North 0.1 to 2.3 m over the CA-91 West where the 91's pavement reaches its lanes: dry
    // grass under it showed through as a yellow saw-tooth in the lanes, and the deck's soffit lay as grey steps beside the
    // car). Every edge between a cell that stays and one that goes, across the pavement and its shoulders as one, gets a
    // side down to the road under the cell that went.
    const cutSides = (all: ReturnType<typeof cells>, prof: [number, number][]) => {
      const { nq, nf, fine, of, state, keep, side: cutAlong, edge } = all;
      const pos: number[] = [], uv: number[] = [];
      const R = rows.length - 1;
      const lift = (q: number, d: number) => { const [d0, l0] = prof[q], [d1, l1] = prof[q + 1]; return d1 > d0 ? l0 + ((l1 - l0) * (d - d0)) / (d1 - d0) : l0; };
      // is quad q's surface at offset d, t of the way along row segment i?
      const keptIn = (i: number, q: number, d: number, t: number) => {
        const st = state[i * nq + q];
        if (st !== 2) return st === 0;
        const o = cutAlong[i * nq + q];
        if (o) { const e = edge[(i * nq + q) * 2] + (edge[(i * nq + q) * 2 + 1] - edge[(i * nq + q) * 2]) * t; return o === 1 ? d > e : d < e; }
        let j = 0; while (j < nf - 1 && (of[j] !== q || fine[j + 1][0] <= d)) j++;
        return keep[i * nf + j] === 1;
      };
      // the road under the part that went (the highest), at row r and offset d (a little into that part), or NaN
      const below = (r: number, s: number, d: number) => onRoadY(r, s, d, rows[r].y, 0.3, LEVEL + 1, true);
      // A side from a (top ta, foot ya) to b, in pieces no longer than SIDE_PIECE. A piece goes where either end of it
      // can't stand (sideFoot: in a carriageway's drawn travel lanes under clearance, where a wall is worse than the gap;
      // the I-5 North under ramp 800, a cut side 1.9 m up in its lanes, then a beam 2.01 m up when its foot was raised
      // over them) or doesn't close a gap down to another road's pavement (sideGround: a free wall on the ground, ramp
      // 961's on the CA-241 North's shoulder). These are the rules the suite's cut-edge check exempts an open edge by.
      // (the last point asked is kept: a piece's far end is the next piece's near end, asked again with the same foot)
      const last = [NaN, NaN, NaN, NaN], lastOk = [false];
      const stands = (x: number, z: number, t: number, y: number) => {
        if (x === last[0] && z === last[1] && t === last[2] && y === last[3]) return lastOk[0];
        last[0] = x; last[1] = z; last[2] = t; last[3] = y;
        return (lastOk[0] = !isNaN(this.sideFoot(x + ox, z + oz, t, y, p)) && this.sideGround(x + ox, z + oz, y, t, p));
      };
      // (foot(f): the road under the side f of the way along it, NaN where there's none; a piece with none under one end
      // takes the other's, and one with none under either goes)
      const quad = (ax: number, az: number, ta: number, bx: number, bz: number, tb: number, foot: (f: number) => number) => {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / SIDE_PIECE));
        let pr = foot(0);
        for (let k = 0; k < n; k++) {
          const f0 = k / n, f1 = (k + 1) / n;
          const x0 = ax + (bx - ax) * f0, z0 = az + (bz - az) * f0, t0 = ta + (tb - ta) * f0;
          const x1 = ax + (bx - ax) * f1, z1 = az + (bz - az) * f1, t1 = ta + (tb - ta) * f1;
          const nr = foot(f1), ra = isNaN(pr) ? nr : pr, rb = isNaN(nr) ? pr : nr;
          pr = nr;
          if (isNaN(ra)) continue;
          const ya = Math.min(ra, t0), yb = Math.min(rb, t1);
          if (t0 - ya < 0.005 && t1 - yb < 0.005) continue;
          if (!stands(x0, z0, t0, ya) || !stands(x1, z1, t1, yb)) continue;
          const y0 = ya, y1 = yb;
          const u0 = (len * f0) / 2, u1 = (len * f1) / 2;
          pos.push(x0, t0, z0, x1, t1, z1, x0, y0, z0, x1, t1, z1, x1, y1, z1, x0, y0, z0);
          uv.push(u0, t0 / 2, u1, t1 / 2, u0, y0 / 2, u1, t1 / 2, u1, y1 / 2, u0, y0 / 2);
        }
      };
      // along the road, from row ra at da to row rb at db, into is toward the part that went
      const along = (ra: number, da: number, la: number, rb: number, db: number, lb: number, into: number) => {
        const A = rows[ra], B = rows[rb], ta = A.y + la, tb = B.y + lb;
        let ya = below(ra, A.s, da + into), yb = below(rb, B.s, db + into);
        if (isNaN(ya) && isNaN(yb)) return;
        if (isNaN(ya)) ya = yb; if (isNaN(yb)) yb = ya;
        ya = Math.min(ya, ta); yb = Math.min(yb, tb);
        if (ta - ya < 0.005 && tb - yb < 0.005) return;
        quad(A.x - Math.cos(A.h) * da, A.z + Math.sin(A.h) * da, ta, B.x - Math.cos(B.h) * db, B.z + Math.sin(B.h) * db, tb, (f) => ya + (yb - ya) * f);
      };
      for (let i = 0; i < R; i++) {
        // a quad cut along the other road's edge: one side, along that edge
        for (let q = 0; q < nq; q++) {
          const o = cutAlong[i * nq + q];
          if (!o) continue;
          const ea = edge[(i * nq + q) * 2], eb = edge[(i * nq + q) * 2 + 1];
          along(i, ea, lift(q, ea), i + 1, eb, lift(q, eb), -0.3 * o);
        }
        // between columns (and quads) side by side, where one stays and the other goes (the middle of a quad cut
        // along an edge has none)
        for (let j = 0; j + 1 < nf; j++) {
          const qa = of[j], qb = of[j + 1], d = fine[j + 1][0];
          if (qa === qb && cutAlong[i * nq + qa]) continue;
          const ka = keptIn(i, qa, d - 1e-3, 0.5), kb = keptIn(i, qb, d + 1e-3, 0.5);
          if (ka !== kb) along(i, d, fine[j + 1][1], i + 1, d, fine[j + 1][1], ka ? 0.3 : -0.3);
        }
      }
      // across the road at each row between two segments, where the surface stays on one side of it and not the other
      const cuts: number[] = [];
      for (let r = 1; r < R; r++) {
        const A = rows[r], c = Math.cos(A.h), sn = Math.sin(A.h);
        for (let q = 0; q < nq; q++) {
          if (state[(r - 1) * nq + q] === state[r * nq + q] && state[r * nq + q] !== 2) continue;
          cuts.length = 0;
          for (let j = 0; j <= nf; j++) if ((j < nf && of[j] === q) || (j > 0 && of[j - 1] === q)) cuts.push(fine[j][0]);
          for (const i of [r - 1, r]) if (cutAlong[i * nq + q]) cuts.push(edge[(i * nq + q) * 2 + (i === r ? 0 : 1)]);
          cuts.sort((x, y) => x - y);
          for (let k = 0; k + 1 < cuts.length; k++) {
            const d0 = cuts[k], d1 = cuts[k + 1];
            if (d1 - d0 < 1e-3) continue;
            const m = (d0 + d1) / 2, ka = keptIn(r - 1, q, m, 1), kb = keptIn(r, q, m, 0);
            if (ka === kb) continue;
            const ta = A.y + lift(q, d0), tb = A.y + lift(q, d1);
            // (the road under it found at each piece's ends, not once at the column's middle: a road over the part that
            // went, along part of the column only, left the rest open; ramp 800 at 828 m under the CA-55 South's ramp)
            const sb = ka ? Math.min(A.s + 0.3, rows[r + 1].s) : Math.max(A.s - 0.3, rows[r - 1].s);
            quad(A.x - c * d0, A.z + sn * d0, ta, A.x - c * d1, A.z + sn * d1, tb, (f) => below(r, sb, d0 + (d1 - d0) * f));
          }
        }
      }
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.computeVertexNormals();
      return g;
    };

    // -------------------------------------------------------------- surfaces: lanes and shoulders
    const lanesProf: number[] = []; for (let i = 0; i <= p.lanes; i++) lanesProf.push(p.edgeL + LANE_W * i);
    const vOff = (s0 / LANE_W) % 1000;
    const vRow = (row: Row, scale: number) => vOff * (LANE_W / scale) + (row.s - s0) / scale;
    // the interstates and state routes are concrete slabs; the toll roads and every ramp are asphalt
    const pcc = p.main && !TOLL.has(p.route ?? '');
    // the pavement and its shoulders as one, cut once (the lanes and the shoulders take their parts of it, and the cut's
    // sides close its edges)
    const across: [number, number][] = [[p.paveL - 0.4, -0.05], [p.paveL, 0], ...lanesProf.map((d) => [d, 0] as [number, number]), [p.paveR, 0], [p.paveR + 0.4, -0.05]];
    const all = outranked ? cells(across, () => true, false) : null, nl = p.lanes;
    const lanes = surface(lanesProf.map((d) => [d, 0]), lanesProf.map((_d, j) => j), (row) => vRow(row, pcc ? T.SLAB : LANE_W), undefined, false, undefined, undefined, all ? part(all, 2, 2 + nl) : undefined);
    if (lanes) own(new THREE.Mesh(lanes, pcc ? this.m.pcc : this.m.asphalt));
    const shL = surface([[p.paveL - 0.4, -0.05], [p.paveL, 0], [p.edgeL, 0]], [0, 0.9, 1.8], (row) => vRow(row, 3), undefined, false, undefined, undefined, all ? part(all, 0, 2) : undefined);
    const shR = surface([[lanesProf[nl], 0], [p.paveR, 0], [p.paveR + 0.4, -0.05]], [0, 1.1, 2.2], (row) => vRow(row, 3), undefined, false, undefined, undefined, all ? part(all, 2 + nl, 4 + nl) : undefined);
    const sh = [shL, shR].filter(Boolean) as THREE.BufferGeometry[];
    if (sh.length) own(new THREE.Mesh(mergeGeometries(sh)!, this.m.shoulder));
    // (only where something was cut)
    const sides = all && all.state.some((v) => v !== 0) ? cutSides(all, across) : null;
    if (sides) { const mesh = own(new THREE.Mesh(sides, this.m.under)); mesh.userData.cutSide = true; }
    // is this road's surface at (s, d), or did the cut leave it out?
    const kept = (s: number, d: number) => {
      if (!all) return true;
      const { nq, nf, fine, state, keep, side, edge } = all, R = rows.length - 1;
      if (d < across[0][0] || d > across[nq][0]) return true;
      let i = Math.min(R - 1, Math.max(0, Math.floor((s - s0) / STEP)));
      while (i > 0 && rows[i].s > s) i--;
      while (i < R - 1 && rows[i + 1].s < s) i++;
      let q = 0; while (q < nq - 1 && across[q + 1][0] <= d) q++;
      const st = state[i * nq + q];
      if (st !== 2) return st === 0;
      const o = side[i * nq + q];
      if (o) {
        const t = (s - rows[i].s) / (rows[i + 1].s - rows[i].s || 1), e = edge[(i * nq + q) * 2] + (edge[(i * nq + q) * 2 + 1] - edge[(i * nq + q) * 2]) * t;
        return o === 1 ? d > e : d < e;
      }
      let j = 0; while (j < nf - 1 && fine[j + 1][0] <= d) j++;
      return keep[i * nf + j] === 1;
    };

    // -------------------------------------------------------------- paint
    // only on what the cut left of the surface (it went or stayed by its own test, at its middle: lines lay over the
    // other road where the surface under them had gone)
    const paint = this.markings(p, s0, s1, ox, oz, kept);
    if (paint) own(new THREE.Mesh(paint, this.m.paint), true);

    // -------------------------------------------------------------- barriers: Jersey, or a block sound wall in town
    const i0 = Math.round(s0 / STEP);
    for (const side of ['L', 'R'] as const) {
      const runs: Row[][] = [];
      let cur: Row[] | null = null;
      // (not where it stands over a better-ranked carriageway's lanes under clearance: cut back with the surface there)
      const wd = side === 'L' ? p.wallL - 0.3 : p.wallR + 0.3;
      rows.forEach((row, ri) => {
        const idx = Math.min(p.n - 1, i0 + ri);
        if (net.hasWall(p, idx, side) && !bandOnRow(Math.min(ri, rows.length - 2), row.s, wd, row.y, 0.35)) { if (!cur) runs.push((cur = [])); cur.push(row); } else cur = null;
      });
      for (const run of runs) {
        if (run.length < 2) continue;
        const sound = side === 'R' && p.main && this.urban(run[0].ax, run[0].az) && soundWall(run[0].ax, run[0].az);
        const w = side === 'L' ? p.wallL : p.wallR, sg = side === 'L' ? -1 : 1;
        // a sound wall gives way to a Jersey barrier wherever another road passes over it lower than its top: it stood up
        // through that road's deck (the 91 West's wall through the 241 North coming down to join it)
        const under = (row: Row) => { if (!crowded) return false; const a = p.at(row.s, w + 0.3 * sg); return !!net.pavedAt(a.x, a.z, row.y + 0.9, row.y + 5.5, p, 0.3); };
        // and its back, 1.4 m down, is cut to 0.35 m where it's over another road less than CLEAR plus that below: it hung
        // into the lanes of a road 2.5 to 4 m under this one's edge (left with no barrier at all, that edge was an open
        // drop), and under clearance over one 4.5 to 5.9 m under it
        // (looked at every 4th row, 8 m, and cut short between two looks if either is over a road)
        const overAt = (row: Row) => { const a = p.at(row.s, w + 0.6 * sg); return !!net.pavedAt(a.x, a.z, row.y - CLEAR - 1.4, row.y - 0.3, p, 0.3); };
        const over = new Uint8Array(run.length), last = run.length - 1;
        if (crowded) {
          const look = new Uint8Array(run.length);
          for (let i = 0; i <= last; i += 4) look[i] = overAt(run[i]) ? 1 : 0;
          if (last % 4) look[last] = overAt(run[last]) ? 1 : 0;
          for (let i = 0; i <= last; i++) { const a = i - (i % 4), b = Math.min(last, a + 4); over[i] = i === a ? look[a] : look[a] | look[b]; }
        }
        // pieces of the run: 0 a Jersey, 1 a sound wall, 2 a Jersey with its back cut short
        const kind = (ri: number) => (over[ri] ? 2 : sound && !under(run[ri]) ? 1 : 0);
        const pieces: [Row[], number][] = [];
        let cur: Row[] = [], k = kind(0);
        for (let ri = 0; ri < run.length; ri++) {
          const row = run[ri], t = kind(ri);
          if (t !== k && cur.length) { pieces.push([cur, k]); cur = [cur[cur.length - 1]]; k = t; }
          cur.push(row);
        }
        pieces.push([cur, k]);
        for (const [rowsOf, kd] of pieces) {
          if (rowsOf.length < 2) continue;
          const tall = kd === 1, back = kd === 2 ? -0.35 : -1.4;
          const prof: [number, number][] = tall
            ? [[w, 0], [w, 4.6], [w + 0.3 * sg, 4.7], [w + 0.6 * sg, 4.6], [w + 0.6 * sg, back]]
            : [[w, 0], [w + 0.05 * sg, 0.08], [w + 0.2 * sg, 0.33], [w + 0.35 * sg, 0.82], [w + 0.53 * sg, 0.82], [w + 0.6 * sg, back]];
          const pr = side === 'L' ? prof.slice().reverse() : prof;
          // its back no lower than clearance over a carriageway's travel lanes (CLEAR): a Jersey's back cut to 0.35 m
          // hung to 4.45 m over the CA-91 East's lanes from the CA-91 West's edge 4.8 m over them
          const bd = rowsOf.map((row) => (crowded && clearUnder(rowIdx.get(row)!) ? Math.min(-back, Math.max(DECK_EDGE, headroom(row.s, w + 0.6 * sg, row.y))) : -back));
          const g = this.strip(rowsOf, pr, (row, _j, acc) => [acc / (tall ? 4 : 2), (row.s - s0) / (tall ? 4 : 2)], undefined, (i, dy) => (dy === back ? -bd[i] : dy));
          if (g) { const mesh = own(new THREE.Mesh(g, tall ? this.m.wall : this.m.concrete)); mesh.castShadow = true; }
        }
      }
    }

    // -------------------------------------------------------------- bridges: deck underside and columns
    const lifted = rows.map((r) => r.y - net.ground(r.ax, r.az));
    if (lifted.some((v) => v > 2.5)) {
      // the deck's sides and soffit, between rows that are both lifted (one strip across a dip joined the rows either
      // side of it), and only under this road's own surface. The soffit is cut like the lanes: where a better-ranked road
      // takes this one's place, it goes with the surface above it (a ramp climbing along the top of the I-5 North had its
      // surface left out over the freeway's lanes but kept its soffit, a slab of concrete lying a few centimetres over
      // them). A side goes where the edge above it has gone, and where it stands on another road (a ramp leaving or
      // joining at the same height): it came up through that road's lanes as a kerb of concrete a few centimetres high.
      // Both go over a road less than GIVE_WAY below (a freeway ending in another passing under its edge), where they'd
      // hang into its lanes. Over a carriageway's travel lanes the deck is thinned (to DECK_MIN) so its underside clears
      // them by CLEAR: 1.5 m deep, a flyover 4.5 to 6 m over a freeway hung its soffit 3 to 4.5 m over the lanes (the
      // connectors at the 405/55 and the 5/405, the I-405 North over the I-5 South). Each row takes the thinnest any
      // carriageway under it (or under the rows either side, as the soffit runs straight between rows) needs.
      const deckRow = (i: number) => lifted[i] > 2.0 && lifted[i + 1] > 2.0;
      const want = new Float32Array(rows.length).fill(1.5), depth = new Float32Array(rows.length);
      if (crowded) rows.forEach((row, i) => {
        // (only the rows a drawn deck uses, where a carriageway may be under: a row's corner is drawn where it's lifted
        // over 2 m, and takes the thinnest of the rows either side)
        if (!(lifted[i] > 2.0 || (i > 0 && lifted[i - 1] > 2.0) || (i + 1 < rows.length && lifted[i + 1] > 2.0)) || !clearUnder(i)) return;
        for (const h of net.near(row.ax, row.az, Math.max(p.wallR, -p.wallL) + 1.5, DECK_HITS)) {
          const q = h.path;
          if (q === p || !q.lanesClear) continue;
          // (every 0.5 m across, and 1.5 m past those lanes and 1 m past its shoulders: the soffit runs straight between
          // rows, and a deck crossing a carriageway at an angle reaches its lanes between two rows' looks; the CA-22
          // West's over the I-5 South hung 4.46 m over its right lane, and the bridges just north of it 3.5 to 4.5 m
          // over its right shoulder)
          for (let d = p.wallL - 0.6; d <= p.wallR + 0.61; d += 0.5) {
            const a = p.at(row.s, Math.min(d, p.wallR + 0.6), AT), pr = q.project(a.x, a.z, h.s, PRS);
            if (pr.s < 0 || pr.s > q.len || pr.d < Math.min(q.edgeL - SIDE_CLEAR - 1.5, q.paveL - 1) || pr.d > Math.max(q.edgeR + SIDE_CLEAR + 1.5, q.paveR + 1)) continue;
            const g = row.y - q.height(pr.s);
            // (to DECK_MIN, or thinner where the surface is under CLEAR_TOP over them: a row next to where the surface
            // is cut back off them, its quad to the row before running down to 4.3 m over the lanes, hung a deck 0.4 m
            // deep to 4.28 m over them; ramp 800 over the I-5 North's left lane)
            if (g > 0.05) want[i] = Math.min(want[i], Math.max(g >= CLEAR_TOP ? DECK_MIN : DECK_EDGE, g - CLEAR - 0.02));
          }
        }
      });
      for (let i = 0; i < rows.length; i++) depth[i] = Math.min(want[i], want[Math.max(0, i - 1)], want[Math.min(rows.length - 1, i + 1)]);
      const deep = (i: number, dy: number) => (dy <= -1.49 ? -depth[i] : dy);
      const prof: [number, number][] = [[p.wallR + 0.6, -0.05], [p.wallR + 0.6, -1.5], [p.wallL - 0.6, -1.5], [p.wallL - 0.6, -0.05]];
      const side = (i: number, j: number) => {
        if (j === 1 || !deckRow(i)) return false;
        const s = (rows[i].s + rows[i + 1].s) / 2;
        if (coveredOnRow(i, s, j === 0 ? p.paveR : p.paveL, rows[i].y, 0)) return false;
        // (and with the surface, where it's cut back off a carriageway's lanes)
        if (bandOnRow(i, s, j === 0 ? p.wallR + 0.6 : p.wallL - 0.6, rows[i].y, SIDE_CLEAR + 0.3)) return false;
        if (!crowded) return true;
        const a = p.at(s, j === 0 ? p.wallR + 0.6 : p.wallL - 0.6);
        return !net.pavedAt(a.x, a.z, a.y - GIVE_WAY, a.y + 0.3, p, 0.3);
      };
      const deckAcross = [p.wallL - 0.6, p.paveL, ...lanesProf, p.paveR, p.wallR + 0.6];
      const deck = [this.strip(rows, prof, (row, j) => [j * 2, (row.s - s0) / 4], side, deep),
        surface(deckAcross.map((d) => [d, -1.5]), deckAcross.map((d) => (d - deckAcross[0]) / 8), (row) => (row.s - s0) / 4, deckRow, true, all ? kept : undefined, deep)].filter(Boolean) as THREE.BufferGeometry[];
      if (deck.length) { const mesh = own(new THREE.Mesh(deck.length > 1 ? mergeGeometries(deck)! : deck[0], this.m.under)); mesh.castShadow = true; }
      const cols: THREE.BufferGeometry[] = [];
      const spacing = 32;
      for (let s = Math.ceil(s0 / spacing) * spacing; s < s1; s += spacing) {
        const pt = p.sample(s), gnd = net.ground(pt.x, pt.z), hgt = pt.y - 1.5 - gnd;
        if (hgt < 3) continue;
        const ds = p.main ? [p.edgeL + 2, p.edgeR - 2] : [0];
        for (const d of ds) {
          const a = p.at(s, d);
          // don't stand a column in another road: any road anywhere under this deck (it only looked for one at ground level,
          // so one under the deck but above the ground got a column through its lanes, and one in a cut below the 60 m
          // ground grid got a column stub hanging into its lanes)
          if (net.pavedAt(a.x, a.z, -1e4, pt.y - 1.5, p, 1.5)) continue;
          const c = new THREE.CylinderGeometry(p.main ? 0.85 : 0.75, p.main ? 0.95 : 0.85, hgt + 2, 12);
          c.translate(a.x - ox, gnd - 2 + (hgt + 2) / 2, a.z - oz); cols.push(c);
          const cap = new THREE.BoxGeometry(p.main ? 3.2 : 2.4, 1.0, 1.6); cap.rotateY(pt.h); cap.translate(a.x - ox, pt.y - 2.0, a.z - oz); cols.push(cap);
        }
      }
      if (cols.length) { const mesh = own(new THREE.Mesh(mergeGeometries(cols)!, P.mats.concrete())); mesh.castShadow = true; }
    }

    // -------------------------------------------------------------- light standards on the outside, every 66 m
    if (p.main) {
      const poles: THREE.Matrix4[] = [];
      for (let s = Math.ceil(s0 / 66) * 66; s < s1; s += 66) {
        const idx = Math.min(p.n - 1, Math.round(s / STEP));
        if (!net.hasWall(p, idx, 'R')) continue;
        const a = p.at(s, p.wallR + 0.9);
        // not on another road (a ramp alongside, below or rising past): the pole would stand in its lanes
        if (net.pavedAt(a.x, a.z, a.y - 2.5, a.y + 12.5, p, 0.4)) continue;
        poles.push(new THREE.Matrix4().compose(new THREE.Vector3(a.x - ox, a.y + 0.6, a.z - oz), new THREE.Quaternion().setFromAxisAngle(UP, a.h), ONE3));
      }
      if (poles.length) {
        const im = new THREE.InstancedMesh(P.lightPoleSingle(), P.mats.metal(), poles.length);
        poles.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.computeBoundingSphere(); group.add(im);
        const hd = new THREE.InstancedMesh(P.lampHeadSingle(), P.mats.lampHead(), poles.length);
        poles.forEach((m, i) => hd.setMatrixAt(i, m)); hd.computeBoundingSphere(); group.add(hd);
      }
    }

    // -------------------------------------------------------------- guide signs ahead of each exit
    for (const sg of this.signsBy.get(p.id) ?? []) {
      for (const [ahead, sub] of [[800, '1/2 MILE'], [260, sg.side === 'R' ? 'EXIT ONLY' : 'LEFT EXIT']] as const) {
        const s = sg.s - ahead;
        if (s < s0 || s >= s1 || s < 30) continue;
        const at = this.gantrySpot(p, s, sg.s);
        if (at) this.gantry(group, p, at.s, at.left, at.right, ox, oz, sg, sub);
      }
    }

    // -------------------------------------------------------------- a crash cushion where a road just stops
    const span = s1 >= p.end - 0.1 ? net.endSpan(p) : null;
    if (span) {
      // across the part of the end that isn't on another road
      const e = p.at(p.end - 1.5, (span.a + span.b) / 2);
      const g = new THREE.BoxGeometry(span.b - span.a + 0.8, 1.1, 3); g.rotateY(e.h); g.translate(e.x - ox, e.y + 0.55, e.z - oz);
      own(new THREE.Mesh(g, this.m.cushion)).castShadow = true;
    }
    // and where it was cut back off another road's lanes (Network.trimEnds), up in the air, a wall across its end from a
    // parapet's height (0.9 m) down to the ground, the deck's width: its end closed, not a slab stopping in mid-air (unless
    // another road's pavement is under it, where a wall would stand in that road)
    if (p.end < p.len - 0.01 && s1 >= p.end - 0.1) {
      const e = p.at(p.end, 0), w = p.wallR - p.wallL + 1.2, mid = (p.wallL + p.wallR) / 2;
      let foot = Infinity, blocked = false;
      for (const d of [p.wallL - 0.6, mid, p.wallR + 0.6]) {
        const a = p.at(p.end + 0.3, d), gy = net.ground(a.x, a.z);
        foot = Math.min(foot, gy - 0.3);
        if (net.pavedAt(a.x, a.z, gy - 1, a.y - 0.5, p, 0.3)) blocked = true;
      }
      if (!blocked && e.y - foot > 0.6) {
        const top = e.y + 0.9, c = p.at(p.end + 0.3, mid);
        const g = new THREE.BoxGeometry(w, top - foot, 0.6); g.rotateY(e.h); g.translate(c.x - ox, (top + foot) / 2, c.z - oz);
        const mesh = own(new THREE.Mesh(g, this.m.under)); mesh.castShadow = true; mesh.userData.endWall = true;
      }
    }

    this.group.add(group);
    return { desc, group, ox, oz };
  }

  // a run of quads across the road, rows along it; keep(i, j) can drop a quad, and lift(i, dy) move a point's height off
  // the row's (row i, the profile's dy) where the profile's dy isn't the same on every row
  private strip(rows: Row[], profile: [number, number][], uv: (row: Row, j: number, acc: number) => [number, number], keep?: (i: number, j: number) => boolean, lift?: (i: number, dy: number) => number) {
    const cols = profile.length;
    if (rows.length < 2 || cols < 2) return null;
    const pos = new Float32Array(rows.length * cols * 3), uvs = new Float32Array(rows.length * cols * 2), idx: number[] = [];
    rows.forEach((row, i) => {
      const c = Math.cos(row.h), sn = Math.sin(row.h);
      let acc = 0;
      for (let j = 0; j < cols; j++) {
        const [d, dy] = profile[j];
        if (j > 0) acc += Math.hypot(d - profile[j - 1][0], dy - profile[j - 1][1]);
        const o = (i * cols + j) * 3;
        pos[o] = row.x - c * d; pos[o + 1] = row.y + (lift ? lift(i, dy) : dy); pos[o + 2] = row.z + sn * d;
        const [u, v] = uv(row, j, acc); uvs[(i * cols + j) * 2] = u; uvs[(i * cols + j) * 2 + 1] = v;
      }
    });
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < cols - 1; j++) {
      if (keep && !keep(i, j)) continue;
      const a = i * cols + j, b = a + 1, c2 = a + cols, d2 = c2 + 1;
      idx.push(a, b, c2, b, d2, c2);
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  // dashed lane lines, a yellow line on the left edge, a white one on the right, raised reflectors in the gaps
  private markings(p: Path, s0: number, s1: number, ox: number, oz: number, kept: (s: number, d: number) => boolean) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const white = [0.93, 0.93, 0.9], yellow = [0.95, 0.74, 0.12];
    const quad = (sa: number, sb: number, d: number, w: number, c: number[], lift = 0.015) => {
      const a = p.at(sa, d), ax = a.x, ay = a.y, az = a.z, ah = a.h;
      const e = Math.min(0.01, (sb - sa) / 4);
      if (!(kept(sa + e, d - w / 2) && kept(sa + e, d + w / 2) && kept(sb - e, d - w / 2) && kept(sb - e, d + w / 2))) return;
      const b = p.at(sb, d);
      const base = pos.length / 3;
      for (const [x, y, z, h] of [[ax, ay, az, ah], [b.x, b.y, b.z, b.h]]) for (const e of [-w / 2, w / 2]) {
        pos.push(x - Math.cos(h) * e - ox, y + lift, z + Math.sin(h) * e - oz); col.push(c[0], c[1], c[2]);
      }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    };
    for (let s = s0; s < s1 - 1e-6; s += STEP) {
      const e = Math.min(s + STEP, s1);
      quad(s, e, p.edgeL - 0.12, 0.12, yellow);
      quad(s, e, p.edgeR + 0.1, 0.15, white);
    }
    for (let L = 1; L < p.lanes; L++) {
      const d = p.edgeL + LANE_W * L;
      for (let st = Math.floor(s0 / PERIOD) * PERIOD; st < s1; st += PERIOD) {
        // California lane lines: four raised Botts' dots where other states paint a dash
        for (let k = 0; k < 4; k++) {
          const cx = st + 0.45 + k * 0.92;
          if (cx >= s0 && cx < s1) quad(cx - 0.06, cx + 0.06, d, 0.11, white, 0.02);
        }
        const m = st + DASH + GAP / 2;
        if (m >= s0 && m < s1) quad(m - 0.05, m + 0.05, d, 0.1, [1.2, 1.2, 1.1], 0.03);
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  // Where a sign bridge for the exit at `exit` stands, from s or as near it as there's room (10 m steps, up to 120 m
  // either way, earlier first, never within 60 m of the exit): s and its posts' offsets, or null. Each post stands just
  // outside its barrier, unless that's on another road (the ramp alongside, the other carriageway across a narrow
  // median): then it moves out past that road, up to 40 m, and the truss spans it, as a real sign bridge does (it stood
  // in the ramp's lanes). And no road may pass through the truss or the panels, from 2.5 m up to the top of the signs
  // (the CA-73 crossing 7 m over the 5 and the 405 went straight through two of them), nor a road's deck hanging into
  // them, nor a street bridge's. Twelve of the 827 had no room where they were and were left out, and 16 more stood
  // with their panels through a street bridge's deck (Main Street over the I-5, Anaheim Boulevard over the 91, ...); each
  // of the 28 moves 10 to 70 m to the nearest spot with room.
  gantrySpot(p: Path, s: number, exit: number) {
    const net = this.net, H = GANTRY_H;
    for (let k = 0; k <= 24; k++) {
      const t = s + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 10;
      if (t < 30 || t > exit - 60 || t > p.len - 10) continue;
      const clearAt = (d: number) => { const a = p.at(t, d); return !net.pavedAt(a.x, a.z, a.y - 2.5, a.y + H + 1.2, p, 0.3); };
      let left = p.wallL - 0.6, right = p.wallR + 0.6;
      while (!clearAt(left) && left > p.wallL - 40) left -= 0.5;
      while (!clearAt(right) && right < p.wallR + 40) right += 0.5;
      if (!clearAt(left) || !clearAt(right)) continue;
      // (a road's surface up to 1.5 m over the top of the panels, its deck hanging that far under it; a street bridge's
      // deck too: moved out of a road's way, two of them went into one)
      let through = false;
      for (let d = left; d <= right && !through; d += 1) {
        const a = p.at(t, d);
        // (from a road whose lanes would be under clearance below its truss: the I-5 South's over the I-5 North, 2.4 m
        // higher, 4.3 m up)
        if (net.pavedAt(a.x, a.z, a.y + Math.min(2.5, GANTRY_H - CLEAR - 0.2), a.y + GANTRY_TOP + 1.8, p, 0.5) || net.overpassAt(a.x, a.z, a.y + 2.5, a.y + GANTRY_TOP + 0.3, 1)) through = true;
      }
      if (!through) return { s: t, left, right };
    }
    return null;
  }

  // an overhead sign bridge (posts at left and right): the exit's panel over the lanes on its side, the freeway's own
  // over the others
  private gantry(group: THREE.Group, p: Path, s: number, left: number, right: number, ox: number, oz: number, sg: Sign, sub: string) {
    const parts: THREE.BufferGeometry[] = [];
    const H = GANTRY_H;
    for (const x of [left, right]) { const post = new THREE.BoxGeometry(0.45, H + 1.2, 0.45); post.translate(x, (H + 1.2) / 2, 0); parts.push(post); }
    for (const y of [H, H + 1.1]) { const chord = new THREE.BoxGeometry(right - left, 0.18, 0.18); chord.translate((left + right) / 2, y, 0); parts.push(chord); }
    for (let x = left + 0.6; x < right; x += 1.2) { const web = new THREE.BoxGeometry(0.08, 1.3, 0.08); web.rotateZ(((x * 10) | 0) % 2 ? 0.7 : -0.7); web.translate(x, H + 0.55, 0); parts.push(web); }
    const pt = p.sample(s);
    const m = new THREE.Matrix4().makeRotationY(pt.h + Math.PI);
    m.setPosition(pt.x - ox, pt.y, pt.z - oz);
    const mesh = new THREE.Mesh(mergeGeometries(parts)!, P.mats.metal()); mesh.applyMatrix4(m); mesh.castShadow = true; mesh.userData.own = true; group.add(mesh);
    const holder = new THREE.Group(); holder.applyMatrix4(m); group.add(holder);
    const { route, name } = signText(sg.text);
    const exitPanel = { tex: T.sign({ route, name, sub }), d: sg.side === 'R' ? p.laneCenter(p.lanes - 1) - 0.4 : p.laneCenter(0) + 0.4 };
    const panels = [exitPanel];
    if (p.main && p.lanes >= 3) {
      const through = { tex: T.sign({ route: `${ROUTE_LABEL[p.route!]} ${DIR_WORD[p.dir!].toUpperCase()}`, name: p.name ?? '', sub: '' }), d: sg.side === 'R' ? p.laneCenter(0) + 1.2 : p.laneCenter(p.lanes - 1) - 1.2 };
      panels.push(through);
    }
    for (const pn of panels) {
      // in this frame +x is the road's right, +z faces the oncoming driver
      const x = pn.d;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.8), new THREE.MeshStandardMaterial({ map: pn.tex, roughness: 0.45, emissive: 0x0b2a18 }));
      face.position.set(x, H + 0.55, 0.32); face.castShadow = true; face.userData.own = true; face.userData.ownMat = true;
      const back = new THREE.Mesh(new THREE.BoxGeometry(7.7, 3.9, 0.12), P.mats.signFace());
      back.position.set(x, H + 0.55, 0.22); back.castShadow = true; back.userData.own = true;
      holder.add(back, face);
    }
  }

  // ------------------------------------------------------------------------------------------- a street bridge
  private buildOverpass(desc: Desc): Built {
    const o = desc.over!, net = this.net;
    const ox = (o.ax + o.bx) / 2, oz = (o.az + o.bz) / 2;
    const group = new THREE.Group(); group.position.set(ox - ORIGIN.x, 0, oz - ORIGIN.z);
    const L = Math.hypot(o.bx - o.ax, o.bz - o.az), h = Math.atan2(o.bx - o.ax, o.bz - o.az);
    const parts: THREE.BufferGeometry[] = [];
    const deck = new THREE.BoxGeometry(o.w, 1.6, L); deck.translate(0, o.y - 0.8, 0); parts.push(deck);
    for (const x of [-o.w / 2 + 0.25, o.w / 2 - 0.25]) { const pr = new THREE.BoxGeometry(0.5, 1.1, L); pr.translate(x, o.y + 0.55, 0); parts.push(pr); }
    // columns where they don't land on a road: each column's own spot, any road under the deck (it tested the bridge's
    // centre line with a search that missed wide freeways' outer lanes, and stood columns in them)
    for (let t = -L / 2 + 6; t <= L / 2 - 6; t += 9) {
      const wx = ox + Math.sin(h) * t, wz = oz + Math.cos(h) * t, gnd = net.ground(wx, wz);
      const xs = [-o.w / 2 + 2.5, o.w / 2 - 2.5].filter((x) => !net.pavedAt(wx + x * Math.cos(h), wz - x * Math.sin(h), -1e4, o.y - 1.6, null, 2));
      if (xs.length < 2) continue;
      for (const x of xs) { const c = new THREE.CylinderGeometry(0.7, 0.8, o.y - gnd, 12); c.translate(x, gnd + (o.y - gnd) / 2 - 1.6, t); parts.push(c); }
      t += 14;
    }
    const geo = mergeGeometries(parts)!; geo.rotateY(h);
    const mesh = new THREE.Mesh(geo, P.mats.concrete()); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.own = true; group.add(mesh);
    // the street on top, and its approaches down to the ground either side
    const rows: Row[] = [];
    const ext = 150;
    for (let t = -L / 2 - ext; t <= L / 2 + ext + 0.01; t += 6) {
      const wx = ox + Math.sin(h) * t, wz = oz + Math.cos(h) * t;
      const out = Math.max(0, Math.abs(t) - L / 2) / ext;
      const gnd = net.ground(wx, wz);
      const y = out <= 0 ? o.y : o.y + (gnd + 0.15 - o.y) * (out * out * (3 - 2 * out));
      rows.push({ x: wx - ox, y, z: wz - oz, h, s: t + L / 2 + ext, ax: wx, az: wz });
    }
    // off the bridge, the approaches are left out wherever they'd pass over another road with less than 5 m to spare (or
    // cross it at grade): they came down onto the freeway beside the one bridged (Bolsa Chica Road onto the 22, Gene
    // Autry Way onto the 5) as slabs of street hanging over its lanes
    const prof: [number, number][] = [[-o.w / 2 - 3, -2.5], [-o.w / 2, 0], [o.w / 2, 0], [o.w / 2 + 3, -2.5]];
    // On the bridge itself only the street: its sloped edges hung 2.5 m down beside the deck, 4.1 to 4.5 m over the lanes
    // under it (Via California and Florence Avenue over the I-5, Laguna Canyon Road over the 405), under clearance.
    const clearOf = (i: number, j: number) => {
      const t = (rows[i].s + rows[i + 1].s) / 2 - L / 2 - ext;
      if (Math.abs(t) <= L / 2) return j === 1;
      // the quad's centre and its corners (the street's one is as wide as the street)
      for (const [u, w] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
        const a = rows[i], b = rows[i + 1], d = prof[j][0] + (prof[j + 1][0] - prof[j][0]) * w;
        const y = a.y + (b.y - a.y) * u + prof[j][1] + (prof[j + 1][1] - prof[j][1]) * w;
        const x = a.ax + (b.ax - a.ax) * u - Math.cos(h) * d, z = a.az + (b.az - a.az) * u + Math.sin(h) * d;
        if (net.pavedAt(x, z, y - 5, y + 1, null, 1)) return false;
      }
      return true;
    };
    const top = this.strip(rows, prof, (row, j) => [j * 2, row.s / 4], clearOf);
    if (top) { const m2 = new THREE.Mesh(top, this.m.asphalt); m2.receiveShadow = true; m2.userData.own = true; group.add(m2); }
    this.group.add(group);
    return { desc, group, ox, oz };
  }

  private urban(x: number, z: number) {
    const g = this.net.ground(x, z);
    return g < 160;
  }
}

// turn OSM destination labels into a sign: a route line ("55 NORTH") and a place ("Riverside")
export function signText(text: string[]) {
  let route = '', name = '';
  for (const t of text) {
    const m = /^(I|CA|US)\s+(\d+)\s*(North|South|East|West)?/i.exec(t);
    if (m && !route) route = `${m[2]} ${(m[3] ?? '').toUpperCase()}`.trim();
    else if (!name) name = t.replace(/\bRoad\b/g, 'Rd').replace(/\bStreet\b/g, 'St').replace(/\bAvenue\b/g, 'Ave').replace(/\bBoulevard\b/g, 'Blvd').replace(/\bParkway\b/g, 'Pkwy').replace(/\bDrive\b/g, 'Dr');
  }
  if (!name) name = route ? '' : text[0] ?? '';
  return { route: route || undefined, name };
}

const soundWall = (x: number, z: number) => fbm2(x * 0.0021, z * 0.0021, 2, 13) > 0.45;
// a sign bridge's truss is GANTRY_H up; its panels' tops are GANTRY_TOP up
const GANTRY_H = 6.9, GANTRY_TOP = GANTRY_H + 0.55 + 1.95;
// scratch for a chunk's overlap tests (one chunk is built at a time)
const ROW_HITS: Hit[] = [], ROW_P: Path[] = [], ROW_S: number[] = [], DECK_HITS: Hit[] = [], CLEAR_Q: Path[] = [], CLEAR_S: number[] = [];
// a cut side's pieces (m) (how far from a carriageway's travel lanes one must stay is Network's SIDE_CLEAR)
export const SIDE_PIECE = 0.3;
const SIDE_HITS: Hit[] = [], SIDE_AT = { x: 0, y: 0, z: 0, h: 0 };
// the thinnest a deck or a barrier's back gets where the surface is under clearance over a carriageway's lanes (m)
const DECK_EDGE = 0.06, HEAD_HITS: Hit[] = [];
const UP = new THREE.Vector3(0, 1, 0), ONE3 = new THREE.Vector3(1, 1, 1);
void rng; void clamp;
