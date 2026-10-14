// The head and face as primitives in the body's field: the skull (cranium, forehead, occiput, temples), brow ridge,
// orbital rims, cheekbones and zygomatic arches, the maxilla and soft cheeks, the mandible (body, angle, ramus) and
// chin, the nose (bridge, tip, alae, columella, nostrils), lips (with Cupid's bow and the philtral columns), a mouth
// slit and cavity (so the jaw can open), eye sockets (the eyeballs and lids are their own meshes), and ears (helix,
// concha, lobe). Built in a head-local frame (metres, origin midway between the eye centres, +z out of the face,
// x the person's left) and placed with a per-axis scale.
import { Field } from './field';
import { V3, clamp, norm } from './math';
import { BodyShape, FaceShape } from './params';

export interface HeadFrame {
  o: V3; sx: number; sy: number; sz: number;
  toBody(p: V3): V3;
  toLocal(p: V3): V3;
  /** landmarks, head-local */
  eye: { x: number; r: number; y: number; z: number };
  mouth: { y: number; z: number; w: number; gap: number; upY: number; loY: number };
  jaw: { hinge: V3 };
  nose: { tip: V3 };
  chinY: number;
  old: number; fat: number; male: boolean;
  face: FaceShape;
}

export function buildHead(f: Field, F: FaceShape, b: BodyShape, o: { hs: number; neckTopY: number; H: number; s: number }): HeadFrame {
  const m = b.sex === 'm';
  const old = clamp((b.age - 35) / 40), fat = clamp(b.fat);
  const hs = o.hs, sx = hs * F.width, sy = hs * F.length, sz = hs;
  const org: V3 = [0, o.neckTopY + 0.055 * sy, -0.03 * o.s + 0.064 * sz];
  const T = (p: V3): V3 => [org[0] + p[0] * sx, org[1] + p[1] * sy, org[2] + p[2] * sz];
  const Ta = (a: V3): V3 => norm([a[0] * sx, a[1] * sy, a[2] * sz]);
  const sm = (sx + sy + sz) / 3;
  const C = 0, HB = 5;  // core group, head bone
  // axis-aligned ellipsoid / rotated ellipsoid / cone / carve, all in head-local metres
  const E = (c: V3, rx: number, ry: number, rz: number, k: number, g = C) => f.ea(T(c), rx * sx, ry * sy, rz * sz, g, k * sm, HB);
  const ER = (c: V3, ax: V3, up: V3, rx: number, ry: number, rz: number, k: number, g = C, carve = 0) => f.ell(T(c), Ta(ax), Ta(up), rx * sm, ry * sm, rz * sm, g, k * sm, HB, carve);
  const K = (a: V3, b2: V3, r1: number, r2: number, k: number, up: V3 = [0, 0, 1], su = 1, sl = 1, g = C) => f.cone(T(a), T(b2), r1 * sm, r2 * sm, Ta(up), su, sl, g, k * sm, HB);
  const X = (c: V3, rx: number, ry: number, rz: number, k: number) => f.ea(T(c), rx * sx, ry * sy, rz * sz, C, k * sm, HB, 1);
  const XR = (c: V3, ax: V3, up: V3, rx: number, ry: number, rz: number, k: number) => f.ell(T(c), Ta(ax), Ta(up), rx * sm, ry * sm, rz * sm, C, k * sm, HB, 1);

  const fh = F.forehead, br = F.brow, cb = F.cheekbones, ch = F.cheeks * (1 + (fat - 0.4) * 0.35);
  const jw = F.jaw, cw = F.chin, cl = F.chinLen;
  const ex = 0.0315 * F.eyeSpacing, er = 0.0119;
  // ---- cranium
  E([0, 0.033, -0.07], 0.074, 0.083, 0.095, 0.02);
  E([0, 0.042, -0.02 - 0.006 * (fh - 1)], 0.058, 0.058, 0.043, 0.025);
  E([0, 0.002, -0.118], 0.058, 0.06, 0.052, 0.03);
  for (const sg of [1, -1]) E([sg * 0.051, 0.016, -0.046], 0.02, 0.04, 0.045, 0.022);
  // ---- brow ridge and orbital rims
  const brz = 0.0195 + 0.003 * (br - 1);
  for (const sg of [1, -1]) {
    K([0, 0.0185, brz], [sg * 0.042, 0.0175 + 0.002 * (m ? 0 : 1), brz - 0.01], 0.0085 + 0.0015 * (br - 1), 0.0075, 0.012, [0, 1, 0], 0.75, 1);
    K([sg * 0.042, 0.0175, brz - 0.01], [sg * 0.053, -0.004, -0.006], 0.0075, 0.0068, 0.01);
  }
  // ---- cheekbones, arches, under-eye
  for (const sg of [1, -1]) {
    E([sg * 0.044, -0.022 - 0.003 * old, -0.008 + 0.003 * (cb - 1)], 0.02 * cb, 0.016, 0.016 * cb, 0.022);
    K([sg * 0.05, -0.02, -0.012], [sg * 0.062, -0.017, -0.05], 0.009 * cb, 0.008, 0.018);
    E([sg * 0.029, -0.019, 0.0], 0.018, 0.011, 0.012, 0.012);
  }
  // ---- midface, cheeks, jaw, chin
  E([0, -0.054, -0.009], 0.03, 0.029, 0.028, 0.02);
  for (const sg of [1, -1]) {
    E([sg * 0.034, -0.044 - 0.004 * old, -0.008], 0.022 * ch, 0.024, 0.021 * ch, 0.025);
    // the mandible: body from the chin to the angle, then the ramus up to the ear
    K([sg * 0.012 * cw, -0.101 * cl, 0.004], [sg * 0.044 * jw, -0.083, -0.058], 0.0105, 0.011 + 0.002 * (jw - 1), 0.016);
    K([sg * 0.044 * jw, -0.083, -0.058], [sg * 0.051, -0.036, -0.072], 0.011, 0.009, 0.016);
    // jowls with age and weight
    if (old + fat > 0.7) E([sg * 0.032, -0.088 - 0.004 * old, 0.0], 0.016, 0.014 + 0.008 * fat, 0.016 + 0.006 * fat, 0.02);
  }
  E([0, -0.07, -0.036], 0.036 * jw, 0.028, 0.04, 0.022);
  E([0, -0.097 * cl, 0.011], 0.0168 * cw, 0.0152 * cl, 0.0138, 0.011);
  E([0, -0.083, 0.011], 0.019, 0.0095, 0.0105, 0.01);
  E([0, -0.101 * cl - 0.006 * fat, -0.036], 0.026, 0.009 + 0.016 * fat * fat, 0.028, 0.02);
  // ---- nose
  const nl = F.noseLen, nw = F.noseW, nb = F.noseBridge, nt = F.noseTip;
  const tip: V3 = [0, -0.0375 * nl, 0.0345 + 0.004 * (nl - 1)];
  K([0, 0.002, 0.0152], [0, tip[1] + 0.009, tip[2] - 0.003], 0.0048 * (0.8 + 0.2 * nb), 0.0064 * nw, 0.008, [0, 0, 1], 0.7 + 0.12 * nb, 1.62);
  for (const sg of [1, -1]) K([sg * 0.007, 0.0, 0.011], [sg * 0.0115 * nw, tip[1] + 0.003, 0.02], 0.006, 0.0068, 0.008);
  E(tip, 0.0095 * nt * nw, 0.0075 * nt, 0.008 * nt, 0.006);
  for (const sg of [1, -1]) E([sg * 0.0128 * nw, tip[1] - 0.0055, 0.0225 + 0.002 * (nl - 1)], 0.0068 * nw, 0.0062, 0.0085, 0.004);
  K([0, tip[1] - 0.003, tip[2] - 0.003], [0, -0.0485 * nl, 0.0255], 0.0034, 0.003, 0.004);
  E([0, -0.0445 * nl, 0.0195], 0.012 * nw, 0.006, 0.008, 0.006);
  for (const sg of [1, -1]) XR([sg * 0.0063 * nw, tip[1] - 0.0097, 0.0278], [0, 0.3, 1], [0, 1, -0.3], 0.005, 0.0021, 0.0032 * nw, 0.0015);
  // ---- lips: upper (with the Cupid's bow), lower; philtral columns; the slit and the cavity behind
  const mw = F.mouthW, lu = F.lipUpper, ll = F.lipLower;
  const mY = -0.0675 - 0.002 * (nl - 1);
  E([0, mY + 0.0065 + 0.0005 * lu, 0.0252 + 0.0012 * lu], 0.0125 * mw, 0.0052 * lu, 0.0062 * (0.9 + 0.1 * lu), 0.004);
  for (const sg of [1, -1]) {
    ER([sg * 0.013 * mw, mY + 0.0046, 0.0195], [1, 0, -0.62 * sg], [0, 1, 0], 0.0102 * mw, 0.0042 * lu, 0.0052, 0.004);
    E([sg * 0.0042, mY + 0.0105 * lu, 0.0262], 0.0042, 0.0028, 0.003, 0.003);   // Cupid's bow peaks
    K([sg * 0.0042, -0.0495 * nl, 0.0258], [sg * 0.005, mY + 0.0105, 0.0268], 0.0021, 0.0023, 0.003);
    ER([sg * 0.012 * mw, mY - 0.0045, 0.0178], [1, 0, -0.65 * sg], [0, 1, 0], 0.0092 * mw, 0.0045 * ll, 0.0052, 0.004);
    X([sg * 0.0265 * mw, mY, 0.0165], 0.002, 0.0026, 0.0022, 0.0025);   // the corners tuck in
  }
  E([0, mY - 0.0064 - 0.0006 * ll, 0.0222 + 0.0012 * ll], 0.0132 * mw, 0.0057 * ll, 0.0062, 0.004);
  const gap = 0.0027;
  X([0, mY, 0.02], 0.0258 * mw, gap, 0.0125, 0.0015);
  X([0, mY - 0.001, 0.0005], 0.0225 * mw, 0.012, 0.0185, 0.003);
  // ---- eye sockets (eyeballs and lids are their own meshes)
  // the globe under the lids, and the opening (a little larger than the lid margins, which are their own meshes)
  const es = F.eyeSize;
  for (const sg of [1, -1]) E([sg * ex, 0, 0], 0.0177 * es, 0.0137 * es, 0.0137 * es, 0.005);
  for (const sg of [1, -1]) X([sg * (ex + 0.0006 * es), 0.0012 * es, 0.0125 * es], 0.0172 * es, 0.0064 * es, 0.009 * es, 0.0028);
  // ---- ears: a flattened disc with the helix rim, the concha and scapha hollows, and the lobe
  const esz = F.earSize, eo = F.earOut;
  for (const sg of [1, -1]) {
    const g = sg > 0 ? 5 : 6;
    const n: V3 = norm([sg, 0, -0.45 + 0.3 * eo]);        // the ear's outward normal
    const up: V3 = norm([0, 1, -0.22]);
    const c: V3 = [sg * (0.0745 + 0.004 * eo), -0.014, -0.081];
    ER(c, n, up, 0.0058, 0.031 * esz, 0.0185 * esz, 0.002, g);
    ER([c[0] - sg * 0.002, c[1] - 0.028 * esz, c[2] + 0.004], n, up, 0.0052, 0.0085 * esz, 0.0075 * esz, 0.003, g);   // lobe
    ER([c[0] - sg * 0.005, c[1] + 0.004, c[2] + 0.006], n, up, 0.006, 0.014 * esz, 0.009 * esz, 0.004, g);          // tragus side
    XR([c[0] + sg * 0.0055, c[1] - 0.006 * esz, c[2] + 0.003], n, up, 0.0052, 0.0105 * esz, 0.0078 * esz, 0.0018);   // concha
    XR([c[0] + sg * 0.0055, c[1] + 0.014 * esz, c[2] - 0.003], n, up, 0.0035, 0.0085 * esz, 0.0055 * esz, 0.0012);   // scapha
  }
  // the neck under the skull, the muscles from behind the ear to the collarbone notch
  for (const sg of [1, -1]) K([sg * 0.05, -0.05, -0.084], [sg * 0.013, -0.215, -0.025], 0.011 + 0.003 * fat, 0.009, 0.02);

  return {
    o: org, sx, sy, sz, toBody: T,
    toLocal: (p: V3): V3 => [(p[0] - org[0]) / sx, (p[1] - org[1]) / sy, (p[2] - org[2]) / sz],
    eye: { x: ex, r: er, y: 0, z: 0 },
    mouth: { y: mY, z: 0.026, w: 0.025 * mw, gap, upY: mY + 0.006, loY: mY - 0.0075 },
    jaw: { hinge: [0, -0.03, -0.066] },
    nose: { tip },
    chinY: -0.1 * cl,
    old, fat, male: m, face: F,
  };
}
