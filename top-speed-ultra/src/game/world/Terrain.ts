// The ground: real elevation (USGS, via AWS Terrain Tiles) in 480 m tiles streamed around the car, eased into
// embankments and cuts beside the freeways and kept clear under bridges. On top, Orange County scenery placed
// clear of the roads: stucco houses with tile roofs and office blocks on the flats, palms and street trees,
// chaparral and oaks on the hills. Plus the Pacific, where the land goes below sea level.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
    const r = rng(tx * 7919 + tz * 104729 + 17);
    const clear = (x: number, z: number, m: number) => {
      for (const h of net.near(x, z, m + 2)) if (h.d > h.path.paveL - m && h.d < h.path.paveR + m && h.s > -m && h.s < h.path.len + m) return false;
      return true;
    };
    const mat = (x: number, z: number, yaw: number, s: number, sy = s) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x - x0, heightAt(x, z) - 0.15, z - z0), new THREE.Quaternion().setFromAxisAngle(UPV, yaw), new THREE.Vector3(s, sy, s));
    const houses: THREE.Matrix4[] = [], houseCol: THREE.Color[] = [], offices: THREE.Matrix4[][] = [[], [], []];
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
          offices[k].push(mat(x, z, yaw, 1));
        } else {
          houses.push(mat(x, z, yaw, 0.9 + r() * 0.3, 0.9 + r() * 0.5));
          houseCol.push(new THREE.Color().setHSL(0.09 + r() * 0.04, 0.25 + r() * 0.2, 0.78 + r() * 0.12));
        }
      } else if (pick < 0.62 * u + 0.16) {
        if (!clear(x, z, 4)) continue;
        if (u > 0.3 && r() < 0.45) {
          const h = 12 + r() * 13, m = mat(x, z, r() * 6, 1);
          palmT.push(m.clone().multiply(new THREE.Matrix4().makeScale(1, h, 1)));
          palmC.push(m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h, 0)).multiply(new THREE.Matrix4().makeScale(1.1, 1.1, 1.1)));
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
    inst(house(), houseMat(), houses, true, houseCol);
    const types = P.buildings(), bm = [P.mats.facade(0), P.mats.facade(1), P.mats.facade(2)], roof = P.mats.roof();
    offices.forEach((ms, t) => inst(types[t], [bm[t], bm[t], roof, roof, bm[t], bm[t]], ms));
    inst(P.palmTrunk(), P.mats.bark(), palmT); inst(P.palmCrown(), P.mats.frond(), palmC);
    inst(P.treeCanopy(this.q.props < 1 ? 1 : 3), P.mats.foliage(), trees); inst(P.treeTrunk(), P.mats.trunk(), trees);
    inst(P.shrub(), P.mats.foliage(), shrubs, false);
  }
}

// a one- or two-storey stucco house with a hipped tile roof, as one geometry with vertex colours
const memo: { house?: THREE.BufferGeometry; mat?: THREE.MeshStandardMaterial } = {};
function house() {
  if (memo.house) return memo.house;
  const w = 15, d = 11, h = 5.2;
  const body = new THREE.BoxGeometry(w, h, d); body.translate(0, h / 2, 0);
  const roof = new THREE.ConeGeometry(Math.hypot(w, d) / 2 * 1.02, 2.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414); roof.translate(0, h + 1.3, 0);
  const paint = (g: THREE.BufferGeometry, c: [number, number, number]) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.toNonIndexed(); };
  const b2 = body.index ? paint(body, [1, 1, 1]) : body;
  const r2 = roof.index ? paint(roof, [0.78, 0.42, 0.3]) : paint(roof, [0.78, 0.42, 0.3]);
  b2.deleteAttribute('uv'); r2.deleteAttribute('uv');
  memo.house = mergeGeometries([b2, r2])!;
  memo.house.computeVertexNormals();
  return memo.house;
}
function houseMat() { return memo.mat ?? (memo.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); }
const UPV = new THREE.Vector3(0, 1, 0);
