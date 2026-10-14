// The face's moving parts. Expressions are displacement fields in the head's own frame: one field per morph target,
// applied to every mesh of the head (skin, lids, lashes, brows, teeth) so they move together. Eyelids are lofted
// meshes (crisp margins that blink); eyeballs are their own meshes (sclera, an iris with radial fibres and a pupil,
// a wet cornea that only reflects, giving catchlights); lashes and brows are strand cards; teeth and the tongue come
// from a small distance field. FaceController turns expressions, spoken lines (visemes) and blinks into weights.
import * as THREE from 'three';
import { V3, clamp, smooth, lerp, norm, add, mul, sub, cross, rng } from './math';
import { HeadFrame } from './head';
import { Field } from './field';
import { meshField } from './mesher';
import { Quality, Look } from './params';
import { NOISE } from './skin';
import { cardMaterial, lashTexture, browTexture } from './cards';

export const MORPHS = ['jawOpen', 'mouthClose', 'smileL', 'smileR', 'wide', 'pucker', 'press', 'tuck', 'browUp', 'browDownL', 'browDownR', 'blinkL', 'blinkR', 'squintL', 'squintR'] as const;
export type MorphName = typeof MORPHS[number];
export const MI: Record<MorphName, number> = Object.fromEntries(MORPHS.map((n, i) => [n, i])) as Record<MorphName, number>;
const NM = MORPHS.length;

const g3 = (p: V3, c: V3, r: number) => { const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; return Math.exp(-(dx * dx + dy * dy + dz * dz) / (r * r)); };

/** how much of the lower face follows the jaw (1 = all of it) */
export function jawMask(p: V3, hf: HeadFrame) {
  const [x, y, z] = p, ax = Math.abs(x), mY = hf.mouth.y;
  const line = mY + 0.0005 + 0.4 * Math.max(0, ax - 0.022) + 0.6 * Math.max(0, -z - 0.03);
  const w = smooth(-0.6, 0.6, (line - y) / 0.004);
  return y > -0.105 ? w : w * smooth(-0.168, -0.105, y);
}

/** one morph's displacement at a head-local point (metres, head-local); jawW overrides the jaw mask */
export function fieldDelta(e: number, p: V3, hf: HeadFrame, jawW?: number): V3 {
  const [x, y, z] = p, ax = Math.abs(x), mY = hf.mouth.y, mw = hf.mouth.w;
  const lipZone = Math.exp(-Math.pow(x / 0.031, 4)) * smooth(-0.002, 0.012, z);
  switch (MORPHS[e]) {
    case 'jawOpen': {
      const w = jawW ?? jawMask(p, hf);
      if (w <= 0) return [0, 0, 0];
      const ang = 0.24 * w, hy = hf.jaw.hinge[1], hz = hf.jaw.hinge[2], dy = y - hy, dz = z - hz, c = Math.cos(ang), s = Math.sin(ang);
      return [0, dy * c - dz * s - dy, dy * s + dz * c - dz];
    }
    case 'mouthClose': {
      const cw = 0.0258 * (mw / 0.025);
      const gx = 2 * hf.mouth.gap * Math.sqrt(Math.max(0, 1 - (x / cw) ** 2)) + 0.0004;
      const up = y > mY ? smooth(mY + 0.012, mY + 0.0015, y) : 0, lo = y < mY ? smooth(mY - 0.014, mY - 0.0015, y) : 0;
      const zm = smooth(-0.012, 0.004, z);
      return [0, (-up * gx * 0.5 + lo * gx * 0.5) * zm * Math.exp(-Math.pow(x / 0.032, 4)), 0];
    }
    case 'smileL': case 'smileR': {
      const sg = MORPHS[e] === 'smileL' ? 1 : -1;
      const sideW = smooth(-0.012, 0.006, sg * x);
      const corner: V3 = [sg * mw, mY, 0.014];
      const wc = Math.exp(-((x - corner[0]) ** 2 + (y - corner[1]) ** 2) / 0.0135 ** 2 - ((z - corner[2]) / 0.02) ** 2);
      const st = Math.exp(-(((y - mY) / 0.008) ** 2)) * lipZone * clamp((sg * x) / mw, 0, 1.1);
      const ch = g3(p, [sg * 0.036, -0.031, 0.012], 0.017), nl = g3(p, [sg * 0.031, -0.056, 0.016], 0.01), ue = g3(p, [sg * hf.eye.x, -0.013, 0.011], 0.007);
      return [
        (sg * 0.0042 * wc + sg * 0.003 * st + sg * 0.0008 * ch + sg * 0.0008 * nl) * sideW,
        (0.0042 * wc + 0.0014 * st + 0.0032 * ch + 0.0012 * nl + 0.0012 * ue) * sideW,
        (-0.0025 * wc + 0.0022 * ch + 0.0025 * nl + 0.0005 * ue) * sideW,
      ];
    }
    case 'wide': {
      const w = lipZone * Math.exp(-(((y - mY) / 0.01) ** 2)) * clamp(ax / mw, 0, 1.2);
      const v = y > mY ? 0.0006 : -0.0008;
      return [Math.sign(x) * 0.0055 * w, v * lipZone * Math.exp(-(((y - mY) / 0.008) ** 2)), -0.0015 * w];
    }
    case 'pucker': {
      const lz = lipZone * Math.exp(-(((y - mY) / 0.011) ** 2)) * Math.exp(-((x / 0.032) ** 2));
      return [-x * 0.38 * lz, (mY - y) * 0.15 * lz, 0.0065 * lz * (1 - 0.3 * clamp(ax / mw))];
    }
    case 'press': {
      const lz = lipZone * Math.exp(-(((y - mY) / 0.009) ** 2));
      return [0, (mY - y) * 0.2 * lz, -0.0012 * lz];
    }
    case 'tuck': {
      const lo = y < mY ? smooth(mY - 0.013, mY - 0.002, y) * lipZone : 0;
      const up = y > mY ? Math.exp(-(((y - mY) / 0.008) ** 2)) * lipZone : 0;
      return [0, 0.0035 * lo + 0.0008 * up, -0.0045 * lo];
    }
    case 'browUp': {
      const wb = Math.exp(-(((y - 0.02) / 0.014) ** 2)) * smooth(0.075, 0.03, ax) * smooth(-0.02, 0.005, z);
      const fh = smooth(0.0, 0.03, y) * smooth(0.09, 0.05, y) * smooth(-0.02, 0.005, z) * 0.35;
      return [0, 0.0042 * wb + 0.002 * fh, -0.0004 * wb];
    }
    case 'browDownL': case 'browDownR': {
      const sg = MORPHS[e] === 'browDownL' ? 1 : -1;
      const wb = Math.exp(-(((y - 0.019) / 0.012) ** 2)) * smooth(0.07, 0.03, sg * x) * smooth(-0.004, 0.006, sg * x) * smooth(-0.02, 0.005, z);
      return [-sg * 0.0016 * wb * smooth(0.045, 0.01, ax), -0.0034 * wb, 0.0008 * wb];
    }
    case 'blinkL': case 'blinkR': {
      const sg = MORPHS[e] === 'blinkL' ? 1 : -1;
      return [0, -0.0012 * g3(p, [sg * hf.eye.x, 0.011, 0.012], 0.006), 0];
    }
    case 'squintL': case 'squintR': {
      const sg = MORPHS[e] === 'squintL' ? 1 : -1;
      const ue = g3(p, [sg * hf.eye.x, -0.012, 0.012], 0.008), oc = g3(p, [sg * (hf.eye.x + 0.017), 0, 0.0], 0.008);
      return [0, 0.0016 * ue + 0.0005 * oc, 0.0006 * ue];
    }
  }
  return [0, 0, 0];
}

/** morph deltas (body frame) for body-frame positions; extra(v, e) adds parametric deltas (head-local) */
export function morphDeltas(pos: Float32Array, hf: HeadFrame, o: { jawW?: (v: number) => number | undefined; extra?: (v: number, e: number) => V3 | null; only?: number[] } = {}) {
  const nv = pos.length / 3, out: Float32Array[] = [];
  for (let e = 0; e < NM; e++) {
    const d = new Float32Array(nv * 3);
    if (!o.only || o.only.includes(e)) for (let v = 0; v < nv; v++) {
      const l = hf.toLocal([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]);
      let q = fieldDelta(e, l, hf, o.jawW ? o.jawW(v) : undefined);
      const x = o.extra ? o.extra(v, e) : null;
      if (x) q = add(q, x);
      d[v * 3] = q[0] * hf.sx; d[v * 3 + 1] = q[1] * hf.sy; d[v * 3 + 2] = q[2] * hf.sz;
    }
    out.push(d);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ eyelids
export interface LidState { blink: number; squint: number }
const UP_ROWS: [number, number][] = [[0.003, 0.01212], [0.0004, 0.01222], [0, 0.0128], [0.00025, 0.01335], [0.0012, 0.0134], [0.0025, 0.0134], [0.004, 0.01338], [0.0058, 0.01332], [0.0078, 0.0131], [0.0095, 0.0127]];
const LO_ROWS: [number, number][] = [[0.0025, 0.01212], [0.0003, 0.01222], [0, 0.0128], [0.0002, 0.0133], [0.0012, 0.01335], [0.0028, 0.0133], [0.0048, 0.0131], [0.0065, 0.0127]];
const LID_COLS = 26;
const bump = (u: number, peak: number, pw: number) => { const w = u < peak ? 0.5 * u / peak : 0.5 + 0.5 * (u - peak) / (1 - peak); return Math.pow(Math.max(0, Math.sin(Math.PI * clamp(w))), pw); };

/** the lids' margins (eye-local, metres, unscaled): x, upper y, lower y */
function margins(u: number, hf: HeadFrame, st: LidState) {
  const F = hf.face, tilt = 0.0012 * F.eyeTilt;
  const x = lerp(-0.0137, 0.015, u);
  const yc = lerp(-0.0009, 0.0004 + tilt, u);
  const bu = bump(u, 0.43, 0.75), bl = bump(u, 0.56, 0.85);
  const yU0 = yc + (0.0059 - 0.0008 * F.hooded) * bu;
  const yL = yc - 0.0045 * bl + bl * (0.0008 * st.blink + 0.0022 * st.squint);
  const yUopen = yU0 - 0.0016 * st.squint * bu;
  const yU = lerp(yUopen, yL + 0.0003 * bl, st.blink);
  return { x, yU, yL, yU0, yL0: yc - 0.0045 * bl };
}
const zOn = (x: number, y: number, r: number) => {
  const zs = Math.sqrt(Math.max(r * r - 0.6 * x * x - y * y, 1e-9));
  const zc = 0.0056 + Math.sqrt(Math.max(0, 0.0078 ** 2 - x * x - y * y)) + 0.0005 + (r - 0.0123);
  return Math.max(zs, zc);
};

/** the lid lofts of one eye in head-local metres */
function lidPoints(hf: HeadFrame, side: number, upper: boolean, st: LidState): V3[] {
  const rows = upper ? UP_ROWS : LO_ROWS, es = hf.face.eyeSize, out: V3[] = [];
  const rest = { blink: 0, squint: 0 };
  for (let ri = 0; ri < rows.length; ri++) {
    const [dy, r] = rows[ri];
    const tRow = smooth(0.001, 0.0078, dy);
    for (let c = 0; c < LID_COLS; c++) {
      const u = c / (LID_COLS - 1);
      const m = margins(u, hf, st), m0 = margins(u, hf, rest);
      const yM = upper ? m.yU : m.yL, yM0 = upper ? m0.yU : m0.yL;
      const sgn = upper ? 1 : -1;
      const yNow = yM + sgn * dy, yRest = yM0 + sgn * dy;
      const y = lerp(yNow, yRest, tRow);
      const xs = m.x * (1 + 0.06 * tRow);
      const z = zOn(xs, y, r);
      out.push([side * (hf.eye.x + es * xs), es * y, es * z]);
    }
  }
  return out;
}

export interface LidData { pos: V3[]; idx: number[]; rows: number; ao: number[]; liner: number[]; deltas: (V3[] | null)[] }

export function buildLids(hf: HeadFrame): LidData {
  const pos: V3[] = [], idx: number[] = [], ao: number[] = [], liner: number[] = [];
  const deltas: (V3[] | null)[] = MORPHS.map(() => null);
  const base = { blink: 0, squint: 0 };
  for (const side of [1, -1]) for (const upper of [true, false]) {
    const rows = upper ? UP_ROWS : LO_ROWS, off = pos.length;
    const P = lidPoints(hf, side, upper, base);
    pos.push(...P);
    rows.forEach(([dy], ri) => { for (let c = 0; c < LID_COLS; c++) { ao.push(ri < 2 ? 0.35 : ri < 4 ? 0.7 : 0.95); liner.push(ri >= 2 && ri <= 4 ? 1 : ri === 5 ? 0.5 : 0); void dy; } });
    // morphs: blink and squint of this eye are parametric
    const bName = side > 0 ? 'blinkL' : 'blinkR', sName = side > 0 ? 'squintL' : 'squintR';
    for (const [name, st] of [[bName, { blink: 1, squint: 0 }], [sName, { blink: 0, squint: 1 }]] as const) {
      const Q = lidPoints(hf, side, upper, st), e = MI[name as MorphName];
      if (!deltas[e]) deltas[e] = [];
      const D = deltas[e]!;
      while (D.length < off) D.push([0, 0, 0]);
      for (let i = 0; i < Q.length; i++) D[off + i] = sub(Q[i], P[i]);
    }
    // outward-facing triangles: test one on the visible lid against the direction out of the eye
    const t0 = off + 4 * LID_COLS + (LID_COLS >> 1), pa = P[t0 - off], pb = P[t0 - off + 1], pd = P[t0 - off + LID_COLS];
    const nrm = cross(sub(pd, pa), sub(pb, pa)), out = sub(pa, [side * hf.eye.x, 0, 0]);
    const flip = nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] < 0;
    for (let ri = 0; ri < rows.length - 1; ri++) for (let c = 0; c < LID_COLS - 1; c++) {
      const a = off + ri * LID_COLS + c, b = a + 1, d = a + LID_COLS, e2 = d + 1;
      if (flip) idx.push(a, b, e2, a, e2, d); else idx.push(a, d, e2, a, e2, b);
    }
  }
  for (let e = 0; e < NM; e++) if (deltas[e]) while (deltas[e]!.length < pos.length) deltas[e]!.push([0, 0, 0]);
  return { pos, idx, rows: 0, ao, liner, deltas };
}

// ------------------------------------------------------------------------------------------------ lashes and brows
/** a card strip: rows of points (u along, v across), uv per vertex */
function stripGeometry(rows: V3[][], uv: (i: number, j: number) => [number, number]) {
  const nu = rows[0].length, nvR = rows.length;
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let j = 0; j < nvR; j++) for (let i = 0; i < nu; i++) { pos.push(...rows[j][i]); uvs.push(...uv(i, j)); }
  for (let j = 0; j < nvR - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1; idx.push(a, b, d, a, d, c); }
  return { pos, uvs, idx };
}

/** lash rows (head-local) for one lid at a state */
function lashRows(hf: HeadFrame, side: number, upper: boolean, st: LidState, layer: number): V3[][] {
  const es = hf.face.eyeSize, n = 20, rows: V3[][] = [[], [], []];
  const u0 = upper ? 0.06 : 0.25, u1 = upper ? 0.98 : 0.95;
  const lenMax = (upper ? 0.0062 : 0.0027) * (1 + 0.18 * (hf.male ? 0 : 1)) * (1 - 0.15 * layer);
  for (let i = 0; i < n; i++) {
    const u = lerp(u0, u1, i / (n - 1));
    const m = margins(u, hf, st);
    const y = upper ? m.yU + 0.00025 : m.yL - 0.0002;
    const r = 0.0133;
    const z = zOn(m.x, y, r);
    const root: V3 = [m.x, y, z];
    const radial = norm([m.x * 0.6, y, z]);
    const upv: V3 = upper ? [0, 1, 0] : [0, -1, 0];
    const lat: V3 = [1, 0, 0];
    const L = lenMax * (0.45 + 0.55 * bump(u, upper ? 0.62 : 0.6, 0.7));
    const d0 = norm(add(add(mul(radial, 0.8), mul(upv, 0.2)), mul(lat, upper ? 0.15 * (u - 0.4) : 0.1 * (u - 0.5))));
    const d1 = norm(add(add(mul(radial, 0.35), mul(upv, 0.9)), mul(lat, upper ? 0.35 * (u - 0.35) : 0.15 * (u - 0.5))));
    const mid = add(root, mul(d0, L * 0.55)), tip = add(mid, mul(d1, L * 0.5));
    const wob = layer * 0.0003;
    for (const [k, p] of [root, mid, tip].entries()) {
      const q: V3 = [p[0] + wob, p[1], p[2] - layer * 0.0002];
      rows[k].push([side * (hf.eye.x + es * q[0]), es * q[1], es * q[2]]);
    }
  }
  return rows;
}

export function buildLashes(hf: HeadFrame, quality: Quality) {
  const layers = quality === 'high' ? 2 : 1;
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  const deltas: number[][] = MORPHS.map(() => []);
  for (const side of [1, -1]) for (const upper of [true, false]) for (let layer = 0; layer < (upper ? layers : 1); layer++) {
    const base = lashRows(hf, side, upper, { blink: 0, squint: 0 }, layer);
    const s = stripGeometry(base, (i, j) => [i / 19 * (upper ? 1.6 : 0.9) + layer * 0.37, j / 2]);
    const off = pos.length / 3;
    pos.push(...s.pos); uvs.push(...s.uvs); idx.push(...s.idx.map((v) => v + off));
    for (let e = 0; e < NM; e++) {
      const name = MORPHS[e];
      const isB = name === (side > 0 ? 'blinkL' : 'blinkR'), isS = name === (side > 0 ? 'squintL' : 'squintR');
      if (isB || isS) {
        const q = lashRows(hf, side, upper, { blink: isB ? 1 : 0, squint: isS ? 1 : 0 }, layer);
        for (let j = 0; j < 3; j++) for (let i = 0; i < base[j].length; i++) deltas[e].push(...sub(q[j][i], base[j][i]));
      } else for (let k = 0; k < s.pos.length; k++) deltas[e].push(0);
    }
  }
  return { pos, uvs, idx, deltas, mat: cardMaterial(0x0c0a09, lashTexture(), quality, { kk: false, alphaTest: 0.35 }) };
}

/** brows on the skin: points projected onto the head's surface */
export function buildBrows(hf: HeadFrame, field: Field, look: Look, quality: Quality) {
  const m = hf.male, F = hf.face;
  const thick = m ? 1 : 0.68, arch = m ? 0.0018 : 0.0042, low = m ? -0.0015 : 0.001;
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  const n = 16;
  const project = (pl: V3, off: number): V3 => {
    let p = hf.toBody(pl);
    for (let it = 0; it < 4; it++) {
      const e = 0.0005, f0 = field.eval(p[0], p[1], p[2], null, 0);
      const gx = (field.eval(p[0] + e, p[1], p[2], null, 0) - f0) / e, gy = (field.eval(p[0], p[1] + e, p[2], null, 0) - f0) / e, gz = (field.eval(p[0], p[1], p[2] + e, null, 0) - f0) / e;
      const gl = Math.hypot(gx, gy, gz) || 1;
      p = [p[0] - (gx / gl) * (f0 - off), p[1] - (gy / gl) * (f0 - off), p[2] - (gz / gl) * (f0 - off)];
    }
    return hf.toLocal(p);
  };
  for (const side of [1, -1]) {
    const rows: V3[][] = [[], [], []];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = lerp(0.011, 0.054, u) * (0.97 + 0.03 * F.eyeSpacing);
      const yMid = 0.0175 + low + arch * Math.sin(Math.PI * Math.min(1, u / 0.72) * 0.5) * (u < 0.72 ? 1 : 1) - (u > 0.72 ? (u - 0.72) * 0.012 : 0);
      const hw = (u < 0.15 ? 0.0042 + 0.004 * (u / 0.15) : 0.0082 * (1 - 0.62 * (u - 0.15) / 0.85)) * thick;
      for (let j = 0; j < 3; j++) {
        const y = yMid + (j - 1) * hw * 0.55;
        rows[j].push(project([side * x, y, 0.03], 0.0005 + (j === 1 ? 0.0002 : 0)));
      }
    }
    const s = stripGeometry(rows, (i, j) => [i / (n - 1), j / 2]);
    const off = pos.length / 3;
    pos.push(...s.pos); uvs.push(...s.uvs); idx.push(...s.idx.map((v) => v + off));
  }
  const brow = look.grey > 0.7 ? 0x8a847c : new THREE.Color(look.hairColor).multiplyScalar(0.7).getHex();
  const mat = cardMaterial(brow, browTexture(), quality, { kk: false, alphaTest: 0.02, grey: Math.min(0.7, look.grey * 0.6) });
  mat.transparent = true; mat.depthWrite = false; mat.alphaToCoverage = false;
  return { pos, uvs, idx, mat };
}

// ------------------------------------------------------------------------------------------------ teeth and tongue
export function buildTeeth(hf: HeadFrame, quality: Quality) {
  const f = new Field();
  const mY = hf.mouth.y;
  const zF = 0.0168, s = 0.95;
  // upper (group 0 bone 0) and lower (group 0, bone 1: follows the jaw)
  const T = [[0.0043, 0.0098, 0.0034], [0.0034, 0.0088, 0.0031], [0.0039, 0.0098, 0.0039], [0.0036, 0.0082, 0.0042], [0.0034, 0.0076, 0.0043]];
  const arch = (x: number) => zF - 27 * x * x;
  for (const lower of [false, true]) {
    let x = 0;
    for (const side of [1, -1]) {
      x = 0;
      T.forEach(([hw, hh, ht], i) => {
        const w = (lower ? [0.0028, 0.0031, 0.0034, 0.0035, 0.0035][i] : hw) * s;
        const cx = x + w;
        x = cx + w * 1.02;
        const zc = arch(cx) - (lower ? 0.0024 : 0) - ht;
        const yEdge = lower ? mY + 0.0007 : mY - 0.0007;
        const cy = lower ? yEdge - hh * 0.5 : yEdge + hh * 0.5;
        const dx = 27 * 2 * cx;
        const ax = norm([1, 0, -dx]);
        f.ell([side * cx, cy, zc], [side * ax[0], 0, ax[2]], [0, 1, 0], w * 0.98, hh * 0.5 * s, ht * s, 0, 0.0006, lower ? 1 : 0);
      });
    }
    // the gum line
    for (const side of [1, -1]) {
      const yG = lower ? mY - 0.0085 : mY + 0.0085;
      f.cone([0, yG, arch(0) - 0.0028], [side * 0.019, yG, arch(0.019) - 0.0035], 0.003, 0.003, [0, 1, 0], 1, 1, 0, 0.002, lower ? 1 : 0);
    }
  }
  // tongue
  f.ea([0, mY - 0.0078, zF - 0.02], 0.0155, 0.0048, 0.017, 0, 0.003, 1);
  f.finalize();
  // mesh in head-local, then place
  const h = quality === 'high' ? 0.0015 : 0.002;
  const box = { o: [-0.03, mY - 0.02, zF - 0.048] as V3, ax: [1, 0, 0] as V3, ay: [0, 1, 0] as V3, az: [0, 0, 1] as V3, nx: Math.ceil(0.06 / h), ny: Math.ceil(0.04 / h), nz: Math.ceil(0.056 / h) };
  const mesh = meshField(f, box, h);
  const nv = mesh.pos.length / 3, col = new Float32Array(nv * 3), lowerW = new Float32Array(nv);
  const bd = new Float64Array(2);
  for (let v = 0; v < nv; v++) {
    const x = mesh.pos[v * 3], y = mesh.pos[v * 3 + 1], z = mesh.pos[v * 3 + 2];
    // which jaw: nearest bone
    let du = 1e9, dl = 1e9;
    for (let i = 0; i < f.n; i++) { const d = f.prim(i, x, y, z); if (f.bone[i] === 1) dl = Math.min(dl, d); else du = Math.min(du, d); }
    void bd;
    lowerW[v] = dl < du ? 1 : 0;
    const gum = lowerW[v] ? clamp((mY - 0.0063 - y) / 0.0016) : clamp((y - mY - 0.0063) / 0.0016);
    const tongue = Math.abs(z - (zF - 0.022)) < 0.024 && y < mY - 0.002 && z < zF - 0.004 && x * x / 0.019 ** 2 + ((y - mY + 0.0075) / 0.0062) ** 2 + ((z - zF + 0.022) / 0.022) ** 2 < 1.25 ? 1 : 0;
    const depth = smooth(zF - 0.03, zF - 0.002, z);
    let c: V3 = [0.86, 0.83, 0.76];
    c = [lerp(c[0], 0.72, gum), lerp(c[1], 0.36, gum), lerp(c[2], 0.38, gum)];
    if (tongue) c = [0.62, 0.3, 0.3];
    const sh = 0.25 + 0.75 * depth;
    col[v * 3] = c[0] * sh; col[v * 3 + 1] = c[1] * sh; col[v * 3 + 2] = c[2] * sh;
  }
  // body frame
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const b = hf.toBody([mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]]);
    P[v * 3] = b[0]; P[v * 3 + 1] = b[1]; P[v * 3 + 2] = b[2];
    const n = norm([mesh.nrm[v * 3] / hf.sx, mesh.nrm[v * 3 + 1] / hf.sy, mesh.nrm[v * 3 + 2] / hf.sz]);
    N[v * 3] = n[0]; N[v * 3 + 1] = n[1]; N[v * 3 + 2] = n[2];
  }
  const deltas = morphDeltas(P, hf, { jawW: (v) => lowerW[v], only: [MI.jawOpen] });
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.6 });
  return { pos: P, nrm: N, idx: mesh.idx, col, deltas, mat };
}

// ------------------------------------------------------------------------------------------------ eyeballs
export interface EyeParts { sockets: THREE.Object3D[]; balls: THREE.Object3D[]; meshes: THREE.Mesh[]; mats: THREE.Material[] }

let eyeGeoCache: { ball: THREE.BufferGeometry; cornea: THREE.BufferGeometry } | null = null;
function eyeGeometry() {
  if (eyeGeoCache) return eyeGeoCache;
  const r = 0.012, lim = 31 * Math.PI / 180, pts: THREE.Vector2[] = [];
  // the profile from the pupil out over the iris, then the sclera to the back (lathe axis = y, turned to +z below)
  const zi = r * Math.cos(lim) - 0.0006;
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(Math.max(1e-5, t * r * Math.sin(lim)), zi + 0.0002 * (1 - t) - 0.0001 * t * t)); }
  for (let i = 1; i <= 16; i++) { const a = lim + (Math.PI - lim) * (i / 16); pts.push(new THREE.Vector2(Math.max(1e-5, r * Math.sin(a)), r * Math.cos(a))); }
  const ball = new THREE.LatheGeometry(pts.reverse(), 30);   // bottom to top, so the faces point out
  ball.rotateX(Math.PI / 2);
  const cornea = new THREE.SphereGeometry(0.0078, 30, 7, 0, Math.PI * 2, 0, 52.6 * Math.PI / 180);
  cornea.rotateX(Math.PI / 2); cornea.translate(0, 0, 0.0056);
  eyeGeoCache = { ball, cornea };
  return eyeGeoCache;
}

export function eyeMaterial(iris: number, quality: Quality) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0, envMapIntensity: 0.5 });
  const u = { uIris: { value: new THREE.Color(iris) }, uPupil: { value: 2.1 } };
  m.customProgramCacheKey = () => 'eye-' + quality;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; uniform vec3 uIris; uniform float uPupil;\n${NOISE}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
vec3 o = vObj * 1000.0;           // mm, +z out of the pupil
float rho = length(o.xy), ang = atan(o.y, o.x);
float irisR = 5.9;
vec3 c;
float rough = 0.3;
if (o.z > 9.3 && rho < irisR + 0.25) {
  // iris: radial fibres, a collarette, crypts, a dark limbal ring, the pupil
  float fib = vnoise(vec3(ang * 38.0, rho * 1.3, 1.0)) * 0.6 + vnoise(vec3(ang * 90.0, rho * 3.0, 5.0)) * 0.4;
  vec3 base = pow(uIris, vec3(1.05));
  vec3 inner = mix(base, base * vec3(1.35, 1.1, 0.7) + vec3(0.05, 0.03, 0.0), 0.55);
  c = mix(inner, base, smoothstep(2.4, 3.6, rho));
  c *= 0.62 + 0.75 * fib;
  float coll = smoothstep(0.45, 0.0, abs(rho - 3.0 - 0.12 * sin(ang * 11.0) - 0.08 * sin(ang * 23.0)));
  c = mix(c, c * 1.18 + 0.015, coll * 0.3);
  vec2 cr = cells(vec3(ang * 6.0, rho * 1.2, 2.0)).xy;
  c *= 1.0 - 0.35 * smoothstep(0.3, 0.1, cr.x) * smoothstep(3.2, 4.5, rho);
  c *= mix(1.0, 0.25, smoothstep(irisR - 0.9, irisR, rho));
  c = mix(c, vec3(0.012), smoothstep(uPupil + 0.12, uPupil - 0.08, rho));
  rough = 0.5;
} else {
  // sclera: off-white, warmer and veined toward the corners, shaded where the lids hang over it
  float side = smoothstep(4.0, 11.0, abs(o.x));
  c = vec3(0.66, 0.64, 0.63) * (0.94 + 0.06 * vnoise(o * 0.8));
  float vein = smoothstep(0.92, 1.0, 1.0 - abs(vnoise(o * vec3(0.6, 1.4, 0.6)) - 0.5) * 2.0) * side;
  c = mix(c, vec3(0.75, 0.32, 0.3), vein * 0.5 + side * 0.12);
  c *= mix(1.0, 0.5, smoothstep(9.0, 2.0, o.z));
  c *= mix(1.0, 0.5, smoothstep(1.5, 9.0, o.y)) * mix(1.0, 0.8, smoothstep(-3.0, -9.0, o.y));
}
diffuseColor.rgb = c;
`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;');
  };
  return m;
}

export function buildEyes(hf: HeadFrame, look: Look, quality: Quality, headJoint: V3): EyeParts {
  const g = eyeGeometry();
  const mat = eyeMaterial(look.iris, quality);
  const cornea = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, specularIntensity: 0.9, ior: 1.376, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.3 });
  const sockets: THREE.Object3D[] = [], balls: THREE.Object3D[] = [], meshes: THREE.Mesh[] = [];
  const es = hf.face.eyeSize;
  for (const side of [1, -1]) {
    const c = hf.toBody([side * hf.eye.x, 0, 0]);
    const sock = new THREE.Object3D();
    sock.position.set(c[0] - headJoint[0], c[1] - headJoint[1], c[2] - headJoint[2]);
    sock.scale.set(hf.sx * es, hf.sy * es, hf.sz * es);
    const ball = new THREE.Object3D();
    sock.add(ball);
    const m1 = new THREE.Mesh(g.ball, mat), m2 = new THREE.Mesh(g.cornea, cornea);
    m2.renderOrder = 2;
    ball.add(m1, m2);
    sockets.push(sock); balls.push(ball); meshes.push(m1, m2);
  }
  return { sockets, balls, meshes, mats: [mat, cornea] };
}

// ------------------------------------------------------------------------------------------------ the controller
export type Expression = 'neutral' | 'smile' | 'laugh' | 'playful' | 'talking' | 'listen' | 'surprised';
const EXPR: Record<Expression, Partial<Record<MorphName, number>>> = {
  neutral: { mouthClose: 1 },
  listen: { mouthClose: 1, smileL: 0.18, smileR: 0.18, browUp: 0.15 },
  smile: { mouthClose: 1, smileL: 0.78, smileR: 0.78, squintL: 0.28, squintR: 0.28, browUp: 0.08 },
  laugh: { jawOpen: 0.42, smileL: 1, smileR: 1, squintL: 0.62, squintR: 0.62, browUp: 0.2, wide: 0.25 },
  playful: { mouthClose: 1, blinkL: 1, squintL: 0.55, smileL: 0.85, smileR: 0.32, browDownL: 0.4, browUp: 0.2 },
  talking: { mouthClose: 0.6, smileL: 0.15, smileR: 0.15 },
  surprised: { jawOpen: 0.3, browUp: 1, mouthClose: 0.2 },
};
type Vis = 'AA' | 'EE' | 'OO' | 'MM' | 'FF' | 'CC' | '__';
const VIS: Record<Vis, Partial<Record<MorphName, number>>> = {
  AA: { jawOpen: 0.42, mouthClose: 0 },
  EE: { jawOpen: 0.12, wide: 0.9, mouthClose: 0.35 },
  OO: { jawOpen: 0.18, pucker: 1, mouthClose: 0.25 },
  MM: { mouthClose: 1, press: 0.8 },
  FF: { jawOpen: 0.05, tuck: 1, mouthClose: 0.4 },
  CC: { jawOpen: 0.16, mouthClose: 0.45, wide: 0.25 },
  __: { mouthClose: 1 },
};
const MOUTH = [MI.jawOpen, MI.mouthClose, MI.wide, MI.pucker, MI.press, MI.tuck];
function visemeOf(ch: string): Vis {
  const c = ch.toLowerCase();
  if ('ah'.includes(c)) return 'AA';
  if ('eiy'.includes(c)) return 'EE';
  if ('ouwq'.includes(c)) return 'OO';
  if ('mbp'.includes(c)) return 'MM';
  if ('fv'.includes(c)) return 'FF';
  if (/[a-z0-9]/.test(c)) return 'CC';
  return '__';
}

export class FaceController {
  cur = new Float32Array(NM);
  private tgt = new Float32Array(NM);
  private expr: Expression = 'neutral';
  private exprW = 1;
  private line: Vis[] = [];
  private lineT = 0; private lineDur = 0;
  private blinkT: number; private blinkPhase = -1;
  private r: ReturnType<typeof rng>;
  speaking = 0;
  gaze = new THREE.Vector2();       // eye yaw, pitch (rad) relative to the head
  private sacc = new THREE.Vector2(); private saccT = 0;
  constructor(seed: number) { this.r = rng(seed * 13 + 5); this.blinkT = 1 + this.r.next() * 3; this.cur[MI.mouthClose] = 1; }
  setExpression(name: string, w = 1) {
    if (name in EXPR) { this.expr = name as Expression; this.exprW = clamp(w); }
  }
  say(text: string, seconds: number) {
    this.line = Array.from(text).map(visemeOf);
    this.lineT = 0; this.lineDur = Math.max(0.3, seconds);
  }
  update(dt: number, aim: { yaw: number; pitch: number } | null) {
    const T = this.tgt;
    T.fill(0);
    const ex = EXPR[this.expr];
    T[MI.mouthClose] = 1 - this.exprW;
    for (const [k, v] of Object.entries(ex)) T[MI[k as MorphName]] += (v as number) * this.exprW;
    // speech: visemes along the line, with coarticulation (each blends into the next)
    this.speaking = 0;
    if (this.line.length && this.lineT < this.lineDur) {
      this.lineT += dt;
      const f = (this.lineT / this.lineDur) * this.line.length, i = Math.min(this.line.length - 1, Math.floor(f)), fr = f - i;
      const a = VIS[this.line[i]], b = VIS[this.line[Math.min(this.line.length - 1, i + 1)]];
      for (const m of MOUTH) T[m] = 0;
      const smile = Math.min(T[MI.smileL], T[MI.smileR]);
      for (const m of MOUTH) { const n = MORPHS[m]; T[m] = lerp(a[n] ?? 0, b[n] ?? 0, smooth(0.3, 1, fr)); }
      T[MI.wide] = Math.max(T[MI.wide], smile * 0.3);
      this.speaking = this.line[i] === '__' ? 0.3 : 1;
      if (this.lineT >= this.lineDur) this.line = [];
    }
    // blinks
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0) { this.blinkPhase = 0; this.blinkT = 1.8 + this.r.next() * 4.2; }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      const b = this.blinkPhase < 0.4 ? this.blinkPhase / 0.4 : Math.max(0, 1 - (this.blinkPhase - 0.4) / 0.6);
      T[MI.blinkL] = Math.max(T[MI.blinkL], b); T[MI.blinkR] = Math.max(T[MI.blinkR], b);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    const k = 1 - Math.exp(-dt * 22), kb = 1 - Math.exp(-dt * 60);
    for (let i = 0; i < NM; i++) this.cur[i] += (T[i] - this.cur[i]) * (i === MI.blinkL || i === MI.blinkR ? kb : k);
    // gaze with small saccades
    this.saccT -= dt;
    if (this.saccT <= 0) { this.saccT = 0.4 + this.r.next() * 1.8; this.sacc.set((this.r.next() - 0.5) * 0.06, (this.r.next() - 0.5) * 0.04); }
    const gy = clamp((aim?.yaw ?? 0) + this.sacc.x, -0.45, 0.45), gp = clamp((aim?.pitch ?? 0) + this.sacc.y, -0.3, 0.25);
    const kg = 1 - Math.exp(-dt * 30);
    this.gaze.x += (gy - this.gaze.x) * kg; this.gaze.y += (gp - this.gaze.y) * kg;
  }
}

