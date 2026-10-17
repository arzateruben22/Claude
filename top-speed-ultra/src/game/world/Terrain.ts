// The ground: real elevation (USGS, via AWS Terrain Tiles) in 480 m tiles streamed around the car, eased into
// embankments and cuts beside the freeways and kept clear under bridges. On top, Orange County scenery placed
// clear of the roads: stucco tract houses (four plans, tile, composite or shake roofs) and glass or precast office
// blocks on the flats, palms and street trees, chaparral and oaks on the hills. Plus the Pacific, where the land
// goes below sea level.

import * as THREE from 'three';
import { Network } from './Network';
import { STEP, ORIGIN } from './Path';
import * as P from '../road/props';
import * as T from '../textures';
import { fbm2, rng, smoothstep, clamp, lerp } from '../util';
import type { QualityPreset } from '../settings';

export const TILE = 480;
interface Tile { key: number; tx: number; tz: number; lod: number; group: THREE.Group }
const tKey = (tx: number, tz: number) => (tx + 512) * 1024 + (tz + 512);

export class Terrain {
  readonly group = new THREE.Group();
  private tiles = new Map<number, Tile>();
  private mat: THREE.MeshStandardMaterial;
  private sea: THREE.Mesh;

  constructor(private net: Network, private q: QualityPreset) {
    const g = T.ground();
    this.mat = new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 1 });
    this.group.name = 'terrain';
    const seaMat = new THREE.MeshStandardMaterial({ color: 0x24506a, roughness: 0.18, metalness: 0.1, envMapIntensity: 0.9 });
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), seaMat);
    this.sea.rotateX(-Math.PI / 2); this.sea.position.y = -0.4; this.sea.receiveShadow = true;
    this.group.add(this.sea);
  }

  get count() { return this.tiles.size; }

  update(x: number, z: number, budget = 1) {
    const R = this.q.drawDistance + 300;
    const t0x = Math.floor((x - R) / TILE), t1x = Math.floor((x + R) / TILE), t0z = Math.floor((z - R) / TILE), t1z = Math.floor((z + R) / TILE);
    for (const [k, t] of this.tiles) {
      const cx = (t.tx + 0.5) * TILE, cz = (t.tz + 0.5) * TILE, d = Math.hypot(cx - x, cz - z) - TILE * 0.71;
      if (d > R + 300) { this.drop(t); this.tiles.delete(k); }
    }
    const want: [number, number, number, number][] = [];
    for (let tx = t0x; tx <= t1x; tx++) for (let tz = t0z; tz <= t1z; tz++) {
      const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE, d = Math.max(0, Math.hypot(cx - x, cz - z) - TILE * 0.71);
      if (d > R) continue;
      const lod = d < 520 ? 0 : 1;
      const have = this.tiles.get(tKey(tx, tz));
      if (have && have.lod <= lod) continue;
      want.push([d, tx, tz, lod]);
    }
    want.sort((a, b) => a[0] - b[0]);
    let n = 0;
    for (const [, tx, tz, lod] of want) {
      if (n >= budget) break;
      const old = this.tiles.get(tKey(tx, tz));
      if (old) this.drop(old);
      this.tiles.set(tKey(tx, tz), this.build(tx, tz, lod));
      n++;
    }
    this.sea.position.x = Math.round((x - ORIGIN.x) / 100) * 100; this.sea.position.z = Math.round((z - ORIGIN.z) / 100) * 100;
    return n;
  }
  rebase(x: number, z: number) {
    for (const t of this.tiles.values()) t.group.position.set(t.tx * TILE - ORIGIN.x, 0, t.tz * TILE - ORIGIN.z);
    this.sea.position.x = Math.round((x - ORIGIN.x) / 100) * 100; this.sea.position.z = Math.round((z - ORIGIN.z) / 100) * 100;
  }
  clear() { for (const t of this.tiles.values()) this.drop(t); this.tiles.clear(); }

  private drop(t: Tile) {
    this.group.remove(t.group);
    t.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as unknown as THREE.InstancedMesh).isInstancedMesh) (m as unknown as THREE.InstancedMesh).dispose();
      else if (m.geometry && m.userData.own) m.geometry.dispose();
    });
  }

  // how built-up a spot is: 1 on the flat basin, 0 in the hills
  urban(x: number, z: number) {
    const g = this.net.ground(x, z);
    const e = 30, sl = Math.abs(this.net.ground(x + e, z) - this.net.ground(x - e, z)) / (2 * e) + Math.abs(this.net.ground(x, z + e) - this.net.ground(x, z - e)) / (2 * e);
    return (1 - smoothstep(110, 260, g)) * (1 - smoothstep(0.06, 0.2, sl)) * (g > 1.5 ? 1 : 0);
  }

  private build(tx: number, tz: number, lod: number): Tile {
    const net = this.net, sp = lod === 0 ? 12 : 40, n = TILE / sp + 1;
    const x0 = tx * TILE, z0 = tz * TILE;
    const group = new THREE.Group(); group.position.set(x0 - ORIGIN.x, 0, z0 - ORIGIN.z);
    // ground, before the roads
    const H = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + i * sp, z = z0 + j * sp;
      const g = net.ground(x, z);
      H[j * n + i] = g + (g > 2 ? (fbm2(x * 0.012, z * 0.012, 3, 5) - 0.5) * 2.4 : 0);
    }
    // the roads' influence: for every vertex, the strongest pull toward a road surface
    const best = new Float32Array(n * n).fill(1e9), target = new Float32Array(n * n), cap = new Float32Array(n * n).fill(1e9);
    const R = 60;
    const seen = new Set<number>();
    for (const hit of net.near(x0 + TILE / 2, z0 + TILE / 2, TILE * 0.72 + R)) {
      const p = hit.path;
      if (seen.has(p.id)) continue; seen.add(p.id);
      if (p.maxX < x0 - R || p.minX > x0 + TILE + R || p.maxZ < z0 - R || p.minZ > z0 + TILE + R) continue;
      for (let k = 0; k < p.n; k += 2) {
        const px = p.xs[k], pz = p.zs[k];
        if (px < x0 - R || px > x0 + TILE + R || pz < z0 - R || pz > z0 + TILE + R) continue;
        const h = p.hs[k], tX = Math.sin(h), tZ = Math.cos(h), rX = -Math.cos(h), rZ = Math.sin(h), yr = p.ys[k];
        const gnd = net.ground(px, pz), bridge = yr - gnd > 4.5;
        const i0 = Math.max(0, Math.floor((px - R - x0) / sp)), i1 = Math.min(n - 1, Math.ceil((px + R - x0) / sp));
        const j0 = Math.max(0, Math.floor((pz - R - z0) / sp)), j1 = Math.min(n - 1, Math.ceil((pz + R - z0) / sp));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const vx = x0 + i * sp - px, vz = z0 + j * sp - pz;
          const along = vx * tX + vz * tZ;
          if (Math.abs(along) > STEP * 2 + sp * 0.5) continue;
          const d = vx * rX + vz * rZ;
          const e = d >= 0 ? d - p.paveR : p.paveL - d;       // metres beyond the paved edge (negative: under it)
          const v = j * n + i;
          if (bridge) { if (e < 3) cap[v] = Math.min(cap[v], yr - 3.5); continue; }
          if (e < best[v]) { best[v] = e; target[v] = yr - 0.35; }
        }
      }
    }
    for (let v = 0; v < n * n; v++) {
      if (best[v] < 1e8) {
        const dy = Math.abs(H[v] - target[v]);
        const w = 1 - smoothstep(0.8, 2 + Math.min(40, dy * 1.8 + 6), best[v]);
        H[v] = lerp(H[v], target[v], w);
        // coarse tiles can't follow a cut's edge, so near any road they stay below it outright
        if (best[v] < (lod ? sp * 0.8 : 1.2)) H[v] = Math.min(H[v], target[v]);
      }
      if (cap[v] < 1e8) H[v] = Math.min(H[v], cap[v]);
    }
    // mesh with colours: dry grass, green where it's watered, chaparral on the slopes, sand by the sea
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), uv = new Float32Array(n * n * 2);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * n + i, x = x0 + i * sp, z = z0 + j * sp, y = H[v];
      pos[v * 3] = i * sp; pos[v * 3 + 1] = y; pos[v * 3 + 2] = j * sp;
      uv[v * 2] = x / 9; uv[v * 2 + 1] = z / 9;
      const u = this.urban(x, z), nn = fbm2(x * 0.004, z * 0.004, 3, 21), fine = 0.86 + 0.24 * fbm2(x * 0.05, z * 0.05, 2, 22);
      const sx = i > 0 && i < n - 1 ? (H[v + 1] - H[v - 1]) / (2 * sp) : 0, sz = j > 0 && j < n - 1 ? (H[v + n] - H[v - n]) / (2 * sp) : 0;
      const slope = Math.hypot(sx, sz);
      const chap = smoothstep(0.12, 0.35, slope) * (1 - u) + smoothstep(0.5, 0.75, nn) * 0.4;
      const lawn = u * smoothstep(0.42, 0.62, nn) * (best[v] > 6 ? 1 : 0);
      let r = 0.93, g = 0.85, b = 0.64;                                       // dry grass
      r = lerp(r, 0.55, chap); g = lerp(g, 0.6, chap); b = lerp(b, 0.4, chap); // chaparral
      r = lerp(r, 0.5, lawn); g = lerp(g, 0.72, lawn); b = lerp(b, 0.38, lawn); // irrigated
      if (y < 3) { const s2 = 1 - smoothstep(0.5, 3, y); r = lerp(r, 1.05, s2); g = lerp(g, 0.96, s2); b = lerp(b, 0.8, s2); }
      col[v * 3] = r * fine; col[v * 3 + 1] = g * fine; col[v * 3 + 2] = b * fine;
    }
    const idx: number[] = [];
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mat); mesh.receiveShadow = true; mesh.userData.own = true;
    group.add(mesh);
    if (lod === 0) this.scenery(group, tx, tz, (x, z) => {
      const fi = clamp((x - x0) / sp, 0, n - 1.001), fj = clamp((z - z0) / sp, 0, n - 1.001), i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
      return lerp(lerp(H[j * n + i], H[j * n + i + 1], a), lerp(H[(j + 1) * n + i], H[(j + 1) * n + i + 1], a), b);
    });
    this.group.add(group);
    return { key: tKey(tx, tz), tx, tz, lod, group };
  }

  // houses, offices, palms, trees, shrubs: clear of every road
  private scenery(group: THREE.Group, tx: number, tz: number, heightAt: (x: number, z: number) => number) {
    const net = this.net, x0 = tx * TILE, z0 = tz * TILE, dens = this.q.props;
    const r = rng(tx * 7919 + tz * 104729 + 17), r2 = rng(tx * 31 + tz * 17 + 5);   // r2: the palms' lean, crown size and yaw
    const r3 = rng(tx * 6971 + tz * 3571 + 101);                                         // r3: each building's plan and look
    const plans = dens < 0.6 ? 2 : 4;                    // Low (the phone tier) folds the gabled plans into the hipped ones: fewer draw calls
    const clear = (x: number, z: number, m: number) => {
      for (const h of net.near(x, z, m + 2)) if (h.d > h.path.paveL - m && h.d < h.path.paveR + m && h.s > -m && h.s < h.path.len + m) return false;
      return true;
    };
    const mat = (x: number, z: number, yaw: number, s: number, sy = s) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x - x0, heightAt(x, z) - 0.15, z - z0), new THREE.Quaternion().setFromAxisAngle(UPV, yaw), new THREE.Vector3(s, sy, s));
    const houses: THREE.Matrix4[][] = [[], [], [], []], houseCol: THREE.Color[][] = [[], [], [], []];
    const offices: THREE.Matrix4[][] = [[], [], []], officeCol: THREE.Color[][] = [[], [], []];
    const palmT: THREE.Matrix4[] = [], palmC: THREE.Matrix4[] = [], trees: THREE.Matrix4[] = [], shrubs: THREE.Matrix4[] = [];
    // a jittered grid; what grows where depends on how urban the spot is
    const cell = 26 / Math.sqrt(Math.max(0.2, dens));
    for (let gz = z0 + cell / 2; gz < z0 + TILE; gz += cell) for (let gx = x0 + cell / 2; gx < x0 + TILE; gx += cell) {
      const x = gx + (r() - 0.5) * cell * 0.7, z = gz + (r() - 0.5) * cell * 0.7;
      const g = net.ground(x, z);
      if (g < 1.5) continue;
      const u = this.urban(x, z), pick = r();
      // the street grid's orientation drifts slowly across town
      const yaw = Math.round(fbm2(x * 0.0006, z * 0.0006, 2, 3) * 8) * (Math.PI / 16) + (r() < 0.5 ? 0 : Math.PI / 2);
      if (u > 0.45 && pick < 0.62 * u) {
        if (!clear(x, z, 16)) continue;
        if (fbm2(x * 0.0015, z * 0.0015, 2, 9) > 0.62 && r() < 0.5) {
          const k = r() < 0.75 ? 0 : r() < 0.8 ? 1 : 2;
          if (!clear(x, z, 30)) continue;
          offices[k].push(mat(x, z, yaw, 1)); officeCol[k].push(officeLook(k, r3));
        } else {
          // the old house's five draws, in their old order, so everything placed after it stays where it was
          const a = r(), b = r(); r(); r(); r();
          const v = pickPlan(r3()) % plans;
          houses[v].push(mat(x, z, yaw + (r3() < 0.5 ? 0 : Math.PI), 0.9 + a * 0.16, 0.96 + b * 0.08));
          houseCol[v].push(houseLook(v, r3));
        }
      } else if (pick < 0.62 * u + 0.16) {
        if (!clear(x, z, 4)) continue;
        if (u > 0.3 && r() < 0.45) {
          // a slight lean (up to 3.5 degrees, in a random direction), the crown on the leaning trunk's top
          const h = 12 + r() * 13, cs = 1 + r2() * 0.25, m = mat(x, z, r() * 6, 1).multiply(new THREE.Matrix4().makeRotationZ((r2() - 0.5) * 0.12));
          palmT.push(m.clone().multiply(new THREE.Matrix4().makeScale(1, h, 1)));
          palmC.push(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h, 0)).multiply(new THREE.Matrix4().makeRotationY(r2() * 6)).multiply(new THREE.Matrix4().makeScale(cs, cs, cs)));
        } else { const s = 0.7 + r() * 0.9; trees.push(mat(x, z, r() * 6, s, s * (0.9 + r() * 0.3))); }
      } else if (pick < 0.62 * u + 0.4 && clear(x, z, 2)) {
        const s = 0.8 + r() * 1.4; shrubs.push(mat(x, z, r() * 6, s));
      }
    }
    const inst = (geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], ms: THREE.Matrix4[], cast = true, colors?: THREE.Color[]) => {
      if (!ms.length) return;
      const im = new THREE.InstancedMesh(geo, m, ms.length);
      ms.forEach((mm, i) => { im.setMatrixAt(i, mm); if (colors) im.setColorAt(i, colors[i]); });
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere();
      group.add(im);
    };
    // one draw call per plan and per office type: the look is in the instance colour (see P.buildingMat)
    const detail = this.q.props >= 1, types = P.buildings();
    houses.forEach((ms, v) => inst(house(v, detail), P.buildingMat('house', detail), ms, true, houseCol[v]));
    offices.forEach((ms, t) => inst(types[t], P.buildingMat('office', detail), ms, true, officeCol[t]));
    inst(P.palmTrunk(), P.mats.bark(), palmT); inst(P.palmCrown(this.q.props < 1 ? 0 : 1), P.mats.frond(), palmC);
    inst(P.treeCanopy(this.q.props < 1 ? 1 : 3), P.mats.foliage(), trees); inst(P.treeTrunk(), P.mats.trunk(), trees);
    inst(P.shrub(), P.mats.foliage(), shrubs, false);
  }
}

// ------------------------------------------------------------------------------------------------ houses
// Four tract-house plans, each one instanced geometry over the stucco atlas (T.STUCCO), front toward +z:
//  0  a single-storey ranch on an L, the garage wing forward, hipped roofs
//  1  a two-storey house with a single-storey garage wing, hipped roofs
//  2  a single-storey ranch with a front-facing gabled garage, gabled roofs
//  3  a two-storey gabled house with the garage in its front
// (on Low, plans 2 and 3 are built as 0 and 1, so a tile costs two draw calls for its houses, not four)
// Walls are storey-high quads mapped onto the atlas's strips (the front strip's garage, entry and windows placed as
// pieces); roofs are planes whose roofing runs from the eave up the slope; soffits close the eaves on High.
const S = T.STUCCO, PPM = 1024 / S.wallM, RPM = S.roofH / S.slopeM, G = (S.win[1] - S.win[0]) / PPM, U = (S.up[1] - S.up[0]) / PPM;   // storeys 2.9, 2.7 m
type Piece = [keyof typeof STRIPS, number, number];                     // strip, metres along it, length
const STRIPS = { win: S.win, up: S.up, front: S.front, plain: S.plain } as const;
const piece = (name: 'garage' | 'entry' | 'picture' | 'small' | 'blank'): Piece => ['front', S[name][0], S[name][1] - S[name][0]];
const pad = (len: number, u0 = 0): Piece => ['plain', u0, len];
// a run of wall pieces from (ax, az) along the unit direction (dx, dz), y0 up one storey
function run(s: P.Shell, ax: number, az: number, dx: number, dz: number, y0: number, pieces: Piece[]) {
  let x = ax, z = az;
  for (const [strip, u0, len] of pieces) {
    const [top, bottom] = STRIPS[strip], h = (bottom - top) / PPM;
    s.wall(x, z, x + dx * len, z + dz * len, y0, h, top, bottom, u0, S.wallM, P.WALL);
    x += dx * len; z += dz * len;
  }
}
// a whole storey of plain window walls round a footprint, skipping the sides listed (front, right, back, left)
function storey(s: P.Shell, x0: number, z0: number, x1: number, z1: number, y0: number, strip: 'win' | 'up', u: [number, number, number, number], skip: number[] = []) {
  const sides: [number, number, number, number][] = [[x0, z1, x1, z1], [x1, z1, x1, z0], [x1, z0, x0, z0], [x0, z0, x0, z1]];
  sides.forEach(([ax, az, bx, bz], i) => { if (!skip.includes(i)) { const [top, bottom] = STRIPS[strip]; s.wall(ax, az, bx, bz, y0, (bottom - top) / PPM, top, bottom, u[i], S.wallM, P.WALL); } });
}
// the roofing's atlas coordinate: m metres along the eave, sl metres up the slope from it
const RU = (m: number, sl: number): [number, number] => [m / S.roofM, S.roof0 + S.roofH - sl * RPM];
// soffits under an overhang o round [x0, x1] x [z0, z1] at height y (faces down)
function soffits(s: P.Shell, x0: number, z0: number, x1: number, z1: number, y: number, o: number, sides = [0, 1, 2, 3]) {
  const X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, v0 = S.plain[0] + 60, v1 = v0 + o * PPM;
  const q = (ax: number, az: number, bx: number, bz: number) => s.quad([ax, y, az], [bx, y, az], [bx, y, bz], [ax, y, bz], [ax / S.wallM, v0], [bx / S.wallM, v0], [bx / S.wallM, v1], [ax / S.wallM, v1], P.SOFFIT);
  if (sides.includes(0)) q(X0, z1, X1, Z1);
  if (sides.includes(2)) q(X0, Z0, X1, z0);
  if (sides.includes(1)) q(x1, z0, X1, z1);
  if (sides.includes(3)) q(X0, z0, x0, z1);
}
// a hipped roof over [x0, x1] x [z0, z1], eaves at y with an overhang o, pitch p (rise over run)
function hip(s: P.Shell, x0: number, z0: number, x1: number, z1: number, y: number, p: number, o: number, detail: boolean) {
  const X0 = x0 - o, X1 = x1 + o, Z0 = z0 - o, Z1 = z1 + o, W = X1 - X0, D = Z1 - Z0;
  const run = Math.min(W, D) / 2, R = y + run * p, sl = run * Math.hypot(1, p), RF = P.ROOFING;
  if (W >= D) {
    const zc = (Z0 + Z1) / 2, ra = X0 + run, rb = X1 - run;
    s.quad([X0, y, Z1], [X1, y, Z1], [rb, R, zc], [ra, R, zc], RU(0, 0), RU(W, 0), RU(W - run, sl), RU(run, sl), RF);
    s.quad([X1, y, Z0], [X0, y, Z0], [ra, R, zc], [rb, R, zc], RU(0, 0), RU(W, 0), RU(W - run, sl), RU(run, sl), RF);
    s.tri([X1, y, Z1], [X1, y, Z0], [rb, R, zc], RU(0, 0), RU(D, 0), RU(D / 2, sl), RF);
    s.tri([X0, y, Z0], [X0, y, Z1], [ra, R, zc], RU(0, 0), RU(D, 0), RU(D / 2, sl), RF);
  } else {
    const xc = (X0 + X1) / 2, ra = Z0 + run, rb = Z1 - run;
    s.quad([X1, y, Z1], [X1, y, Z0], [xc, R, ra], [xc, R, rb], RU(0, 0), RU(D, 0), RU(D - run, sl), RU(run, sl), RF);
    s.quad([X0, y, Z0], [X0, y, Z1], [xc, R, rb], [xc, R, ra], RU(0, 0), RU(D, 0), RU(D - run, sl), RU(run, sl), RF);
    s.tri([X0, y, Z1], [X1, y, Z1], [xc, R, rb], RU(0, 0), RU(W, 0), RU(W / 2, sl), RF);
    s.tri([X1, y, Z0], [X0, y, Z0], [xc, R, ra], RU(0, 0), RU(W, 0), RU(W / 2, sl), RF);
  }
  if (detail) soffits(s, x0, z0, x1, z1, y, o);
}
// a gabled roof over [x0, x1] x [z0, z1], its ridge along x (or along z), eaves at y, pitch p, overhang o at the
// eaves and the rakes; the gable ends are stucco walls closing up to the roof's underside
function gable(s: P.Shell, x0: number, z0: number, x1: number, z1: number, y: number, p: number, o: number, alongX: boolean, detail: boolean) {
  // built with its ridge along x; along z it is turned a quarter: local (x, z) -> world (z, -x)
  const [a0, b0, a1, b1] = alongX ? [x0, z0, x1, z1] : [-z1, x0, -z0, x1];
  const V = (x: number, yy: number, z: number): [number, number, number] => (alongX ? [x, yy, z] : [z, yy, -x]);
  const X0 = a0 - o, X1 = a1 + o, Z0 = b0 - o, Z1 = b1 + o, W = X1 - X0, D = Z1 - Z0, zc = (Z0 + Z1) / 2;
  const run = D / 2, R = y + run * p, sl = run * Math.hypot(1, p), RF = P.ROOFING;
  s.quad(V(X0, y, Z1), V(X1, y, Z1), V(X1, R, zc), V(X0, R, zc), RU(0, 0), RU(W, 0), RU(W, sl), RU(0, sl), RF);
  s.quad(V(X1, y, Z0), V(X0, y, Z0), V(X0, R, zc), V(X1, R, zc), RU(0, 0), RU(W, 0), RU(W, sl), RU(0, sl), RF);
  // the gable walls, in the wall planes at a0 and a1: pentagons up to the roof's underside
  const yo = y + o * p, base = S.plain[1] - 32, d = b1 - b0, GU = (m: number, h: number): [number, number] => [m / S.wallM, base - h * PPM];
  for (const [xa, flip] of [[a1, false], [a0, true]] as [number, boolean][]) {
    const za = flip ? b0 : b1, zb = flip ? b1 : b0;                     // walk the wall outside-left to right
    const A = V(xa, y, za), B = V(xa, y, zb), Bt = V(xa, yo, zb), Ap = V(xa, R, zc), At = V(xa, yo, za);
    s.tri(A, B, Ap, GU(0, 0), GU(d, 0), GU(d / 2, R - y), P.WALL);
    s.tri(B, Bt, Ap, GU(d, 0), GU(d, yo - y), GU(d / 2, R - y), P.WALL);
    s.tri(At, A, Ap, GU(0, yo - y), GU(0, 0), GU(d / 2, R - y), P.WALL);
  }
  if (!detail) return;
  // the rakes' undersides (the roof planes past the gable walls, facing down) and the eaves' soffits
  for (const [xa, xb] of [[a1, X1], [X0, a0]]) {
    s.quad(V(xb, y, Z1), V(xa, y, Z1), V(xa, R, zc), V(xb, R, zc), [0, S.plain[0] + 60], [o / S.wallM, S.plain[0] + 60], [o / S.wallM, S.plain[0] + 100], [0, S.plain[0] + 100], P.SOFFIT);
    s.quad(V(xa, y, Z0), V(xb, y, Z0), V(xb, R, zc), V(xa, R, zc), [0, S.plain[0] + 60], [o / S.wallM, S.plain[0] + 60], [o / S.wallM, S.plain[0] + 100], [0, S.plain[0] + 100], P.SOFFIT);
  }
  const q = (ax: number, az: number, bx: number, bz: number) => s.quad(V(ax, y, az), V(bx, y, az), V(bx, y, bz), V(ax, y, bz), [ax / S.wallM, S.plain[0] + 60], [bx / S.wallM, S.plain[0] + 60], [bx / S.wallM, S.plain[0] + 60 + o * PPM], [ax / S.wallM, S.plain[0] + 60 + o * PPM], P.SOFFIT);
  q(X0, b1, X1, Z1); q(X0, Z0, X1, b0);
}
const memo = new Map<string, THREE.BufferGeometry>();
function house(plan: number, detail: boolean) {
  const key = `${plan}-${detail ? 1 : 0}`, have = memo.get(key);
  if (have) return have;
  const s = new P.Shell(), F = piece;
  if (plan === 0) {
    // the L: the house 16 x 9, the garage wing 6.6 x 8 coming 2.5 m forward on the right
    run(s, -8, 4.5, 1, 0, 0, [pad(0.4), F('small'), F('picture'), F('entry')]);
    run(s, 2, 4.5, 0, 1, 0, [pad(2.5, 3)]);
    run(s, 2, 7, 1, 0, 0, [pad(0.5, 6), F('garage'), pad(0.5, 9)]);
    run(s, 8.6, 7, 0, -1, 0, [['win', 0, 8]]);
    run(s, 8.6, -1, -1, 0, 0, [pad(0.6, 1)]);
    run(s, 8, -1, 0, -1, 0, [['win', 8.8, 3.5]]);
    run(s, 8, -4.5, -1, 0, 0, [['win', 0, 16]]);
    run(s, -8, -4.5, 0, 1, 0, [['win', 4.5, 9]]);
    hip(s, -8, -4.5, 8, 4.5, G, 0.4, 0.5, detail);
    hip(s, 2, -1, 8.6, 7, G, 0.4, 0.5, detail);
  } else if (plan === 1) {
    // two storeys 11 x 10 on the left, the single-storey garage wing 6.5 x 9 on the right, a metre forward
    run(s, -8.5, 5, 1, 0, 0, [F('small'), F('picture'), F('entry'), pad(1.4, 2)]);
    run(s, 2.5, 5, 0, 1, 0, [pad(1, 4)]);
    run(s, 2.5, 6, 1, 0, 0, [pad(0.45, 6), F('garage'), pad(0.45, 9)]);
    run(s, 9, 6, 0, -1, 0, [pad(9, 0)]);
    run(s, 9, -3, -1, 0, 0, [['win', 0, 6.5]]);
    run(s, 2.5, -3, 0, -1, 0, [['win', 11.3, 2]]);
    run(s, 2.5, -5, -1, 0, 0, [['win', 3, 11]]);
    run(s, -8.5, -5, 0, 1, 0, [['win', 7, 10]]);
    storey(s, -8.5, -5, 2.5, 5, G, 'up', [0, 11, 3, 6]);
    hip(s, -8.5, -5, 2.5, 5, G + U, 0.4, 0.5, detail);
    hip(s, 2.5, -3, 9, 6, G, 0.4, 0.5, detail);
  } else if (plan === 2) {
    // the house 14 x 9 under a ridge along x, the garage 6.5 x 8 on the left with its gable to the street
    run(s, -2, 4.5, 1, 0, 0, [F('entry'), F('picture'), F('small'), pad(0.4, 5)]);
    run(s, -2, 8, 0, -1, 0, [pad(3.5, 2)]);
    run(s, -8.5, 8, 1, 0, 0, [pad(0.45, 6), F('garage'), pad(0.45, 9)]);
    run(s, -8.5, 0, 0, 1, 0, [['win', 1, 8]]);
    run(s, -6, 0, -1, 0, 0, [pad(2.5, 12)]);
    run(s, -6, -4.5, 0, 1, 0, [['win', 9, 4.5]]);
    run(s, 8, -4.5, -1, 0, 0, [['win', 0, 14]]);
    run(s, 8, 4.5, 0, -1, 0, [['win', 4, 9]]);
    gable(s, -6, -4.5, 8, 4.5, G, 0.33, 0.45, true, detail);
    gable(s, -8.5, 0, -2, 8, G, 0.33, 0.45, false, detail);
  } else {
    // two storeys 15.2 x 10 under a ridge along x, the garage in the front's left
    run(s, -7.6, 5, 1, 0, 0, [F('garage'), F('entry'), F('picture'), F('small')]);
    storey(s, -7.6, -5, 7.6, 5, 0, 'win', [0, 4, 0, 10], [0, 3]);
    run(s, -7.6, -5, 0, 1, 0, [pad(10, 3)]);
    storey(s, -7.6, -5, 7.6, 5, G, 'up', [0, 2, 5, 8]);
    gable(s, -7.6, -5, 7.6, 5, G + U, 0.38, 0.45, true, detail);
  }
  const g = s.geometry(`house-${plan}`);
  memo.set(key, g);
  return g;
}
const pickPlan = (u: number) => (u < 0.3 ? 0 : u < 0.6 ? 1 : u < 0.8 ? 2 : 3);
// OC stucco: warm whites, cream, sand, greige, taupe, soft terracotta, peach, light grey, pale yellow (sRGB, weight)
const STUCCO_TINTS: [number, number][] = [[0xefe9dd, 3], [0xeadfc6, 3], [0xdcc9a7, 3], [0xcdc4b4, 2], [0xbdb09b, 1.5], [0xd9a98b, 1.5], [0xe6c3a6, 1.5], [0xd5d3cd, 1.5], [0xe9dcae, 1]];
// the roofing by plan: [Spanish tile, grey composite, brown shake] odds
const ROOF_ODDS = [[0.45, 0.4, 0.15], [0.75, 0.25, 0], [0.15, 0.55, 0.3], [0.4, 0.6, 0]];
const weighted = <V>(list: [V, number][], u: number) => { const sum = list.reduce((a, [, w]) => a + w, 0); let t = u * sum; for (const [v, w] of list) { if ((t -= w) < 0) return v; } return list[list.length - 1][0]; };
function houseLook(plan: number, rr: () => number) {
  const c = new THREE.Color(weighted(STUCCO_TINTS, rr())), j = 0.97 + rr() * 0.06;
  c.multiplyScalar(j);
  const o = ROOF_ODDS[plan], u = rr(), roof = u < o[0] ? 0 : u < o[0] + o[1] ? 1 : 2;
  return P.packLook(c, roof, Math.floor(rr() * 4));
}
// glass: blue, green, silver, bronze, clear (sRGB); the style: curtain wall, tower glass or precast
const GLASS: [number, number][] = [[0xc4d8ee, 3], [0xc8e6d8, 2], [0xe6eaee, 2], [0xe8d6bc, 1.5], [0xffffff, 1]];
const STYLE_ODDS = [[0.3, 0.2, 0.5], [0.5, 0.25, 0.25], [0.45, 0.55, 0]];
function officeLook(type: number, rr: () => number) {
  const c = new THREE.Color(weighted(GLASS, rr())), o = STYLE_ODDS[type], u = rr();
  return P.packLook(c, u < o[0] ? 0 : u < o[0] + o[1] ? 1 : 2, 0);
}
const UPV = new THREE.Vector3(0, 1, 0);
