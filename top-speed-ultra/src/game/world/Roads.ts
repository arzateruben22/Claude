// Streams the real freeways in 160 m chunks: every carriageway and ramp within the draw distance, nearest first.
// Where two roads overlap (a ramp leaving, a freeway ending in another) the better-ranked one is drawn and the
// other leaves a hole, so nothing flickers. Barriers run wherever a road's edge isn't opening onto another road.
// Elevated sections get a deck underside and columns down to the ground. Street overpasses come from the data.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Path, STEP, LANE_W, ORIGIN } from './Path';
import { Network, Overpass, Sign, DIR_WORD, ROUTE_LABEL } from './Network';
import * as P from '../road/props';
import * as T from '../textures';
import { fbm2, rng, clamp } from '../util';
import type { QualityPreset } from '../settings';

export const CHUNK = 160;
const DASH = 3.66, GAP = 10.97, PERIOD = DASH + GAP;

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
    const a = T.asphalt(), sh = T.shoulder(), c = T.concrete();
    const off = (m: THREE.MeshStandardMaterial, f: number) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f; return m; };
    this.m = {
      asphalt: off(new THREE.MeshStandardMaterial({ map: a.map, normalMap: a.normalMap, roughnessMap: a.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xb9b7b2 }), -1),
      shoulder: off(new THREE.MeshStandardMaterial({ map: sh.map, normalMap: sh.normalMap, roughness: 0.95, color: 0xa8a49c }), -1),
      concrete: new THREE.MeshStandardMaterial({ map: c.map, normalMap: c.normalMap, roughness: 0.9, color: 0xe0dcd3, side: THREE.DoubleSide }),
      wall: new THREE.MeshStandardMaterial({ map: c.map, normalMap: c.normalMap, roughness: 0.95, color: 0xc9b9a0, side: THREE.DoubleSide }),
      under: new THREE.MeshStandardMaterial({ map: c.map, roughness: 0.95, color: 0x9d988f, side: THREE.DoubleSide }),
      paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
      cushion: new THREE.MeshStandardMaterial({ color: 0xf2c21b, roughness: 0.6 }),
    };
    this.group.name = 'roads';
    for (const p of net.paths) {
      const n = Math.max(1, Math.ceil(p.len / CHUNK));
      for (let k = 0; k < n; k++) {
        const sm = Math.min(p.len, (k + 0.5) * CHUNK), at = p.at(sm, 0);
        const a = p.at(k * CHUNK, 0), b = p.at(Math.min(p.len, (k + 1) * CHUNK), 0);
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
    const s0 = desc.k * CHUNK, s1 = Math.min(p.len, s0 + CHUNK);
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
    // is anything else close enough to overlap? If not, skip every overlap test.
    const crowded = rows.some((r, i) => i % 8 === 0 && net.near(r.ax, r.az, 40).some((h) => h.path !== p));
    const covered = (s: number, d: number, y: number) => {
      if (!crowded) return false;
      const a = p.at(s, d);
      return net.covered(a.x, a.z, y, p, -0.25, true);
    };

    // -------------------------------------------------------------- surfaces: lanes and shoulders
    const lanesProf: number[] = []; for (let i = 0; i <= p.lanes; i++) lanesProf.push(p.edgeL + LANE_W * i);
    const vOff = (s0 / LANE_W) % 1000;
    const vRow = (row: Row, scale: number) => vOff * (LANE_W / scale) + (row.s - s0) / scale;
    const lanes = this.strip(rows, lanesProf.map((d) => [d, 0]), (row, j) => [j, vRow(row, LANE_W)], (i, j) => !covered((rows[i].s + rows[i + 1].s) / 2, (lanesProf[j] + lanesProf[j + 1]) / 2, rows[i].y));
    if (lanes) own(new THREE.Mesh(lanes, this.m.asphalt));
    const shL = this.strip(rows, [[p.paveL - 0.4, -0.05], [p.paveL, 0], [p.edgeL, 0]], (row, j) => [j * 0.9, vRow(row, 3)], (i) => !covered((rows[i].s + rows[i + 1].s) / 2, (p.paveL + p.edgeL) / 2, rows[i].y));
    const shR = this.strip(rows, [[p.edgeR, 0], [p.paveR, 0], [p.paveR + 0.4, -0.05]], (row, j) => [j * 1.1, vRow(row, 3)], (i) => !covered((rows[i].s + rows[i + 1].s) / 2, (p.paveR + p.edgeR) / 2, rows[i].y));
    const sh = [shL, shR].filter(Boolean) as THREE.BufferGeometry[];
    if (sh.length) own(new THREE.Mesh(mergeGeometries(sh)!, this.m.shoulder));

    // -------------------------------------------------------------- paint
    const paint = this.markings(p, s0, s1, ox, oz, covered);
    if (paint) own(new THREE.Mesh(paint, this.m.paint), true);

    // -------------------------------------------------------------- barriers: Jersey, or a block sound wall in town
    const i0 = Math.round(s0 / STEP);
    for (const side of ['L', 'R'] as const) {
      const runs: Row[][] = [];
      let cur: Row[] | null = null;
      rows.forEach((row, ri) => {
        const idx = Math.min(p.n - 1, i0 + ri);
        if (net.hasWall(p, idx, side)) { if (!cur) runs.push((cur = [])); cur.push(row); } else cur = null;
      });
      for (const run of runs) {
        if (run.length < 2) continue;
        const sound = side === 'R' && p.main && this.urban(run[0].ax, run[0].az) && soundWall(run[0].ax, run[0].az);
        const w = side === 'L' ? p.wallL : p.wallR, sg = side === 'L' ? -1 : 1;
        const prof: [number, number][] = sound
          ? [[w, 0], [w, 4.6], [w + 0.3 * sg, 4.7], [w + 0.6 * sg, 4.6], [w + 0.6 * sg, -1.4]]
          : [[w, 0], [w + 0.05 * sg, 0.08], [w + 0.2 * sg, 0.33], [w + 0.35 * sg, 0.82], [w + 0.53 * sg, 0.82], [w + 0.6 * sg, -1.4]];
        const pr = side === 'L' ? prof.slice().reverse() : prof;
        const g = this.strip(run, pr, (row, _j, acc) => [acc / (sound ? 4 : 2), (row.s - s0) / (sound ? 4 : 2)]);
        if (g) { const mesh = own(new THREE.Mesh(g, sound ? this.m.wall : this.m.concrete)); mesh.castShadow = true; }
      }
    }

    // -------------------------------------------------------------- bridges: deck underside and columns
    const lifted = rows.map((r) => r.y - net.ground(r.ax, r.az));
    if (lifted.some((v) => v > 2.5)) {
      const deckRows = rows.filter((_r, i) => lifted[i] > 2.0);
      if (deckRows.length >= 2) {
        const g = this.strip(deckRows, [[p.wallR + 0.6, -0.05], [p.wallR + 0.6, -1.5], [p.wallL - 0.6, -1.5], [p.wallL - 0.6, -0.05]], (row, j) => [j * 2, (row.s - s0) / 4]);
        if (g) { const mesh = own(new THREE.Mesh(g, this.m.under)); mesh.castShadow = true; }
      }
      const cols: THREE.BufferGeometry[] = [];
      const spacing = 32;
      for (let s = Math.ceil(s0 / spacing) * spacing; s < s1; s += spacing) {
        const pt = p.sample(s), gnd = net.ground(pt.x, pt.z), hgt = pt.y - 1.5 - gnd;
        if (hgt < 3) continue;
        const ds = p.main ? [p.edgeL + 2, p.edgeR - 2] : [0];
        for (const d of ds) {
          const a = p.at(s, d);
          // don't stand a column in the middle of another road
          if (net.covered(a.x, a.z, gnd, p, 0.5)) continue;
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
        this.gantry(group, p, s, ox, oz, sg, sub);
      }
    }

    // -------------------------------------------------------------- a crash cushion where a road just stops
    if (!p.next && s1 >= p.len - 0.1) {
      const e = p.at(p.len - 1.5, 0);
      const g = new THREE.BoxGeometry(p.paveR - p.paveL + 0.8, 1.1, 3); g.rotateY(e.h); g.translate(e.x - ox, e.y + 0.55, e.z - oz);
      own(new THREE.Mesh(g, this.m.cushion)).castShadow = true;
    }

    this.group.add(group);
    return { desc, group, ox, oz };
  }

  // a run of quads across the road, rows along it; keep(i, j) can drop a quad
  private strip(rows: Row[], profile: [number, number][], uv: (row: Row, j: number, acc: number) => [number, number], keep?: (i: number, j: number) => boolean) {
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
        pos[o] = row.x - c * d; pos[o + 1] = row.y + dy; pos[o + 2] = row.z + sn * d;
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
  private markings(p: Path, s0: number, s1: number, ox: number, oz: number, covered: (s: number, d: number, y: number) => boolean) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const white = [0.93, 0.93, 0.9], yellow = [0.95, 0.74, 0.12];
    const quad = (sa: number, sb: number, d: number, w: number, c: number[], lift = 0.015) => {
      const a = p.at(sa, d), ax = a.x, ay = a.y, az = a.z, ah = a.h;
      if (covered((sa + sb) / 2, d, ay)) return;
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
        const a = Math.max(st, s0), b = Math.min(st + DASH, s1);
        if (b > a) quad(a, b, d, 0.12, white);
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

  // an overhead sign bridge: the exit's panel over the lanes on its side, the freeway's own over the others
  private gantry(group: THREE.Group, p: Path, s: number, ox: number, oz: number, sg: Sign, sub: string) {
    const parts: THREE.BufferGeometry[] = [];
    const left = p.wallL - 0.6, right = p.wallR + 0.6, H = 6.9;
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
    // columns where they don't land on a road
    for (let t = -L / 2 + 6; t <= L / 2 - 6; t += 9) {
      const wx = ox + Math.sin(h) * t, wz = oz + Math.cos(h) * t, gnd = net.ground(wx, wz);
      if (net.near(wx, wz, 2).some((hh) => hh.d > hh.path.paveL - 1.2 && hh.d < hh.path.paveR + 1.2)) continue;
      for (const x of [-o.w / 2 + 2.5, o.w / 2 - 2.5]) { const c = new THREE.CylinderGeometry(0.7, 0.8, o.y - gnd, 12); c.translate(x, gnd + (o.y - gnd) / 2 - 1.6, t); parts.push(c); }
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
    const top = this.strip(rows, [[-o.w / 2 - 3, -2.5], [-o.w / 2, 0], [o.w / 2, 0], [o.w / 2 + 3, -2.5]], (row, j) => [j * 2, row.s / 4]);
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
const UP = new THREE.Vector3(0, 1, 0), ONE3 = new THREE.Vector3(1, 1, 1);
void rng; void clamp;
