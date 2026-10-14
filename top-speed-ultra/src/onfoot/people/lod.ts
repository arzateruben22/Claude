// Coarse levels of detail: the whole person (skin, clothes, shoes, hair) as ONE closed surface, the union of the
// body and every garment and the hair clipped to their regions, meshed coarsely and painted with vertex colours
// (skin with lips, brows, eyes, blush and beard shadow; cloth with its accent and wear; hair). One draw call.
//   LOD 1 (patio, ~3-12 m): body 28 mm, head and hair 9 mm (phone 34 / 11). LOD 2 (far): everything 60 mm.
import * as THREE from 'three';
import { Field, Sdf, smin } from './field';
import { Region } from './garments';
import { V3, clamp, smooth, lerp } from './math';
import { HeadFrame } from './head';
import { Look } from './params';
import { faceMasks } from './masks';
import { sssLights } from './skin';

/** a covering: a thickness added to the body inside a region (a garment's ease, the hair over the scalp) */
export interface Cover { t: number | ((x: number, y: number, z: number) => number); keep: Region; noArms: boolean; id: number }
/** an extra volume unioned on, clipped by a region (a skirt's drape, soles and heels, a hair curtain, a bun) */
export interface Extra { d: Region; region: Region | null; id: number }
export interface Look2 { kind: 'skin' | 'cloth' | 'hair'; color: number; accent?: Region | null; accentColor?: number; wear?: ((p: V3) => number) | null; rough: number }

/** the person as one field: the body evaluated once, minus a thickness map, unioned with the extras */
export class LodField implements Sdf {
  n: number; maxK: number; tMax: number;
  constructor(public body: Field, public covers: Cover[], public extras: Extra[], public armZone: (x: number, y: number, z: number) => boolean) {
    this.n = body.n + 1;
    this.tMax = 0.04;
    this.maxK = Math.max(body.maxK, 0.02);
  }
  thick(x: number, y: number, z: number): [number, number] {
    let t = 0, id = -1, arm = -1;
    for (const c of this.covers) {
      const k = c.keep(x, y, z);
      if (k >= 0) continue;
      if (c.noArms) { if (arm < 0) arm = this.armZone(x, y, z) ? 1 : 0; if (arm) continue; }
      const tt = (typeof c.t === 'number' ? c.t : c.t(x, y, z)) * smooth(0, 0.004, -k);
      if (tt > t) { t = tt; id = c.id; }
    }
    return [t, id];
  }
  prim(i: number, x: number, y: number, z: number) {
    if (i < this.body.n) return this.body.prim(i, x, y, z) - this.tMax;
    let d = 1e9;
    for (const e of this.extras) d = Math.min(d, e.d(x, y, z));
    return d;
  }
  eval(x: number, y: number, z: number, act: Int32Array | null, nAct: number) {
    let n = nAct;
    if (act && n && act[n - 1] >= this.body.n) n--;
    let d = (act && n === 0 ? 1e9 : this.body.eval(x, y, z, act, n));
    if (d < 0.06) d -= this.thick(x, y, z)[0];
    for (const e of this.extras) {
      let v = e.d(x, y, z);
      if (v > d + 0.02) continue;
      if (e.region) v = Math.max(v, e.region(x, y, z));
      d = smin(d, v, 0.006);
    }
    return d;
  }
  /** which look a surface point has: an extra that is the surface there, else the thickest covering, else skin (-1) */
  which(x: number, y: number, z: number) {
    for (const e of this.extras) {
      let v = e.d(x, y, z);
      if (e.region) v = Math.max(v, e.region(x, y, z));
      if (v < 0.004) return e.id;
    }
    return this.thick(x, y, z)[1];
  }
}

/** a field with only the primitives big enough to matter at mesh step h (fingers, nostrils... go) */
export function reduced(f: Field, h: number) {
  const big = new Set<number>();
  for (const b of f.bounds()) if (b.r > 0.35 * h) big.add(b.i);
  return f.subset((i) => big.has(i) && (!f.carve[i] || h < 0.015));
}

const lin = (hex: number) => new THREE.Color(hex);

/** vertex colours and roughness for a coarse mesh; looks[id] for coverings and extras, skin otherwise */
export function paint(lf: LodField, looks: Look2[], pos: Float32Array, hf: HeadFrame, look: Look, male: boolean) {
  const nv = pos.length / 3, col = new Float32Array(nv * 3), lod = new Float32Array(nv * 2), comp = new Int16Array(nv);
  const skin = lin(look.skin), lip = look.lipstick !== null ? lin(look.lipstick) : skin.clone().multiply(new THREE.Color(0.86, 0.6, 0.6));
  const brow = lin(look.hairColor).multiplyScalar(0.8), iris = lin(look.iris), beard = lin(look.hairColor);
  const ex = hf.eye.x;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const ci = lf.which(x, y, z), C: Look2 = ci >= 0 ? looks[ci] : { kind: 'skin', color: look.skin, rough: 0.55 };
    comp[v] = ci;
    let c = lin(C.color), rough = C.rough, sk = 0;
    if (C.kind === 'cloth') {
      if (C.accent && C.accent(x, y, z) > 0.5) c = lin(C.accentColor ?? 0xf2f2f0);
      if (C.wear) c.lerp(c.clone().multiplyScalar(1.6), C.wear([x, y, z]) * 0.5);
    } else if (C.kind === 'hair') {
      c.multiplyScalar(0.85);
    } else {
      sk = 1;
      c = skin.clone();
      const l = hf.toLocal([x, y, z]);
      if (l[1] > -0.2 && Math.abs(l[0]) < 0.11) {
        const m = faceMasks(l, hf, look);
        c.multiply(new THREE.Color(1, 1 - 0.12 * m.red, 1 - 0.14 * m.red));
        c.lerp(lip, smooth(0.15, 0.6, m.lip));
        if (male) c.lerp(beard.clone().multiplyScalar(0.5), clamp(m.beard) * (look.facialHair === 'none' ? 0.15 : look.facialHair === 'stubble' ? 0.4 : 0.85));
        c.lerp(lin(look.hairColor).multiplyScalar(0.6), smooth(0.2, 0.8, m.scalp));
        // eyes: the opening reads as white with a dark iris; brows a band above
        const ax = Math.abs(l[0]), dx = ax - ex;
        const open = smooth(1.15, 0.85, Math.hypot(dx / 0.0135, (l[1] - 0.0004) / 0.0052)) * smooth(0.002, 0.008, l[2]);
        if (open > 0) { const ir = smooth(0.0075, 0.005, Math.abs(dx)); c.lerp(new THREE.Color(0.55, 0.52, 0.5).lerp(iris.clone().multiplyScalar(0.5), ir), open); }
        const u = (ax - 0.011) / 0.043, by = 0.0175 + (male ? -0.0015 : 0.001) + (male ? 0.0018 : 0.0042) * Math.sin(Math.PI * Math.min(1, u / 0.72) * 0.5);
        const bw = (male ? 0.0045 : 0.003) * (u < 0.15 ? 0.7 : 1 - 0.5 * clamp(u));
        const bm = u > -0.05 && u < 1.05 ? smooth(bw + 0.0015, bw * 0.4, Math.abs(l[1] - by)) * smooth(0.0, 0.01, l[2]) : 0;
        c.lerp(brow, bm * 0.85);
        rough = lerp(rough, 0.35, smooth(0.15, 0.6, m.lip));
      }
    }
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
    lod[v * 2] = rough; lod[v * 2 + 1] = sk;
  }
  return { col, lod, comp };
}

export function lodMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
  m.customProgramCacheKey = () => 'person-lod';
  m.onBeforeCompile = (sh) => {
    sh.defines = { ...(sh.defines ?? {}), SKIN_SSS: 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLod; varying vec2 vLod;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLod = aLod;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLod;')
      .replace('#include <lights_physical_pars_fragment>', sssLights())
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vLod.x; gWrap = vLod.y; gSss = vec3(1.0, 0.4, 0.28);');
  };
  return m;
}
