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
  /** (fifth pass, Look.cleanLod) where two extras are both the surface (a tee's hem under an open overshirt's), the outer one
   *  is the look: unset, the first one listed is, as before */
  outerWins = false;
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
    if (this.outerWins) {
      let best = -1, bv = 0.004;
      for (const e of this.extras) {
        let v = e.d(x, y, z);
        if (e.region) v = Math.max(v, e.region(x, y, z));
        if (v < 0.004 && (best < 0 || v < bv + 0.003)) { best = e.id; bv = Math.min(bv, v); }   // (listed inner to outer: a later one within 3 mm of the outermost wins)
      }
      if (best >= 0) return best;
      return this.thick(x, y, z)[1];
    }
    for (const e of this.extras) {
      let v = e.d(x, y, z);
      if (e.region) v = Math.max(v, e.region(x, y, z));
      if (v < 0.004) return e.id;
    }
    return this.thick(x, y, z)[1];
  }
}

/** a field with only the primitives big enough to matter at mesh step h (fingers, nostrils... go) */
export function reduced(f: Field, h: number, noCarve = false) {
  const big = new Set<number>();
  for (const b of f.bounds()) if (b.r > 0.35 * h) big.add(b.i);
  return f.subset((i) => big.has(i) && (!f.carve[i] || (h < 0.015 && !noCarve)));   // (noCarve, fifth pass: a coarse face without the mouth's and the nostrils' pits, which a 1 cm mesh draws as an open mouth)
}

const lin = (hex: number) => new THREE.Color(hex);

/** vertex colours and roughness for a coarse mesh; looks[id] for coverings and extras, skin otherwise */
export function paint(lf: LodField, looks: Look2[], pos: Float32Array, hf: HeadFrame, look: Look, male: boolean, far = false, inward: Float32Array | null = null) {
  const nv = pos.length / 3, col = new Float32Array(nv * 3), lod = new Float32Array(nv * 2), comp = new Int16Array(nv);
  const skin = lin(look.skin), lip = look.lipstick !== null ? lin(look.lipstick) : skin.clone().multiply(new THREE.Color(0.86, 0.6, 0.6));
  const brow = lin(look.hairColor).multiplyScalar(0.8), iris = lin(look.iris), beard = lin(look.hairColor);
  const ex = hf.eye.x;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let ci = lf.which(x, y, z);
    // (fifth pass, `inward`: the mesh's normals at the far level) a 6 cm mesh cuts corners, so a vertex on a shoulder can sit
    // just outside the tee that covers it and paint as skin: a vertex that reads as skin takes the garment found a little
    // way in along its normal, if there is one (the neck, the hands and the legs find none)
    if (inward && ci < 0) for (const dIn of [0.012, 0.026]) { const w = lf.which(x - inward[v * 3] * dIn, y - inward[v * 3 + 1] * dIn, z - inward[v * 3 + 2] * dIn); if (w >= 0 && looks[w].kind === 'cloth') { ci = w; break; } }
    const C: Look2 = ci >= 0 ? looks[ci] : { kind: 'skin', color: look.skin, rough: 0.55 };
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
        // (repair 2026-11-16: at the far level with Look.cleanLod the lips, eyes and brows are person.ts coarseFace's triangles; painted on a 6 cm mesh a lip's vertex was a pink wedge across the cheek)
        if (!(far && inward)) c.lerp(lip, smooth(0.15, 0.6, m.lip));
        if (male) c.lerp(beard.clone().multiplyScalar(0.5), clamp(m.beard) * (look.facialHair === 'none' ? 0.15 * (look.beardShadow ?? 1) : look.facialHair === 'stubble' ? 0.4 : look.facialHair === 'lightStubble' ? 0.2 : 0.85));   // (2026-11-16: a day's growth is a shadow at a distance too; it was painted as a full beard)
        c.lerp(lin(look.hairColor).multiplyScalar(0.6), smooth(0.2, 0.8, m.scalp));
        // (fifth pass, Look.cleanLod) features a coarse mesh can hold: the eye and its lashes as one soft dark shape with the
        // brow over it, the mouth as a soft band in the lips' colour, each wider than a cell, so a face a few metres away has
        // eyes, brows and a mouth where they are instead of smears that come and go with the vertices
        if (far && !inward) {
          const axf = Math.abs(l[0]), fz = smooth(0.0, 0.012, l[2]);
          const eye = Math.exp(-(((axf - ex) / 0.0125) ** 2) - (((l[1] - 0.001) / 0.0062) ** 2)) * fz;
          c.lerp(iris.clone().multiplyScalar(0.28), Math.min(0.9, 1.25 * eye));
          const uf = (axf - 0.011) / 0.043, byf = 0.019 + (male ? -0.0015 : 0.001) + (male ? 0.0018 : 0.0042) * Math.sin(Math.PI * Math.min(1, Math.max(0, uf) / 0.72) * 0.5);
          const bf = uf > -0.1 && uf < 1.1 ? Math.exp(-(((l[1] - byf) / (male ? 0.0052 : 0.004)) ** 2)) * fz * (1 - 0.5 * clamp(uf)) : 0;
          c.lerp(brow, Math.min(0.85, bf * (0.75 + 0.2 * (look.browThick ?? 1))));
          const mth = Math.exp(-((l[0] / (0.023 * hf.face.mouthW)) ** 2) - (((l[1] - hf.mouth.y) / 0.0075) ** 2)) * smooth(0.004, 0.014, l[2]);
          c.lerp(lip, Math.min(0.85, 1.1 * mth));
          col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
          lod[v * 2] = rough; lod[v * 2 + 1] = sk;
          continue;
        }
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

/** (fifth pass, 2026-11-16; Look.cleanLod) a coarse mesh cut along the lines where one look meets another (a jacket's
 *  opening over the shirt, a collar on the neck, a cuff on the hand, the hairline), so each line is a clean edge where it
 *  really runs instead of a ragged blend from one coarse vertex to the next. A triangle whose corners have two looks is cut
 *  where the look changes along its two mixed edges (found by bisection); each side keeps its own corner's colour. At
 *  most `room` triangles are added, the highest boundaries first (the collar and the face before the trouser hems). */
export function splitLooks(lf: LodField, a: { pos: Float32Array; nrm: Float32Array; idx: Uint32Array; col: Float32Array; lod: Float32Array; si: Uint16Array; sw: Float32Array; comp: Int16Array }, room: number, last = -9) {
  const nt = a.idx.length / 3, cand: number[] = [];
  const differ = (u: number, v: number) => Math.abs(a.col[u * 3] - a.col[v * 3]) + Math.abs(a.col[u * 3 + 1] - a.col[v * 3 + 1]) + Math.abs(a.col[u * 3 + 2] - a.col[v * 3 + 2]) > 0.05;
  for (let t = 0; t < nt; t++) {
    const i = a.idx[t * 3], j = a.idx[t * 3 + 1], k = a.idx[t * 3 + 2], ci = a.comp[i], cj = a.comp[j], ck = a.comp[k];
    if (ci === cj && cj === ck) continue;
    if (ci !== cj && cj !== ck && ci !== ck) continue;   // three looks at one triangle: left as it is
    const lone = ci === cj ? k : ci === ck ? j : i, other = lone === i ? j : i;
    if (differ(lone, other)) cand.push(t);
  }
  // (the clothes' lines first, from the collar down; then the look `last`, the hair's edge, which a coarse hairline hides best)
  const isLast = (t: number) => (a.comp[a.idx[t * 3]] === last || a.comp[a.idx[t * 3 + 1]] === last || a.comp[a.idx[t * 3 + 2]] === last ? 1 : 0);
  cand.sort((p, q) => isLast(p) - isLast(q) || (a.pos[a.idx[q * 3] * 3 + 1] - a.pos[a.idx[p * 3] * 3 + 1]));
  const take = cand.slice(0, Math.max(0, Math.floor(room / 2)));
  if (!take.length) return a;
  const pos = Array.from(a.pos), nrm = Array.from(a.nrm), col = Array.from(a.col), lod = Array.from(a.lod), si = Array.from(a.si), sw = Array.from(a.sw), comp = Array.from(a.comp), idx = Array.from(a.idx);
  const cuts = new Map<string, [number, number]>();
  // the cut point on an edge from u (one look) to v (another), as two new vertices: [the one on u's side, the one on v's]
  const cut = (u: number, v: number): [number, number] => {
    const key = u < v ? u + ':' + v : v + ':' + u, hit = cuts.get(key);
    if (hit) return u < v ? hit : [hit[1], hit[0]];
    const lo = Math.min(u, v), hi = Math.max(u, v), cl = comp[lo];
    let t0 = 0, t1 = 1;
    for (let it = 0; it < 6; it++) {
      const t = (t0 + t1) / 2, w = lf.which(pos[lo * 3] + (pos[hi * 3] - pos[lo * 3]) * t, pos[lo * 3 + 1] + (pos[hi * 3 + 1] - pos[lo * 3 + 1]) * t, pos[lo * 3 + 2] + (pos[hi * 3 + 2] - pos[lo * 3 + 2]) * t);
      if (w === cl) t0 = t; else t1 = t;
    }
    const t = clamp((t0 + t1) / 2, 0.08, 0.92), out: number[] = [];
    for (const side of [lo, hi]) {
      const n = pos.length / 3;
      for (let c = 0; c < 3; c++) { pos.push(pos[lo * 3 + c] + (pos[hi * 3 + c] - pos[lo * 3 + c]) * t); nrm.push(nrm[lo * 3 + c] + (nrm[hi * 3 + c] - nrm[lo * 3 + c]) * t); col.push(col[side * 3 + c]); }
      lod.push(lod[side * 2], lod[side * 2 + 1]);
      // the bones of both ends, the four strongest
      const m = new Map<number, number>();
      for (let c = 0; c < 4; c++) { m.set(si[lo * 4 + c], (m.get(si[lo * 4 + c]) ?? 0) + sw[lo * 4 + c] * (1 - t)); m.set(si[hi * 4 + c], (m.get(si[hi * 4 + c]) ?? 0) + sw[hi * 4 + c] * t); }
      const top = [...m.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4), sum = top.reduce((s, e) => s + e[1], 0) || 1;
      for (let c = 0; c < 4; c++) { si.push(top[c] ? top[c][0] : 0); sw.push(top[c] ? top[c][1] / sum : 0); }
      comp.push(comp[side]);
      out.push(n);
    }
    cuts.set(key, [out[0], out[1]]);
    return u < v ? [out[0], out[1]] : [out[1], out[0]];
  };
  for (const t of take) {
    const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]], c = v.map((i) => comp[i]);
    const L = c[0] === c[1] ? 2 : c[0] === c[2] ? 1 : 0, A = v[L], B = v[(L + 1) % 3], C = v[(L + 2) % 3];   // A alone; B, C the pair (winding A, B, C)
    const [ab_a, ab_b] = cut(A, B), [ac_a, ac_c] = cut(A, C);
    idx[t * 3] = A; idx[t * 3 + 1] = ab_a; idx[t * 3 + 2] = ac_a;
    idx.push(ab_b, B, C, ab_b, C, ac_c);
  }
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), idx: Uint32Array.from(idx), col: Float32Array.from(col), lod: Float32Array.from(lod), si: Uint16Array.from(si), sw: Float32Array.from(sw), comp: Int16Array.from(comp) };
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
