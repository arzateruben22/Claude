// The body: a skeleton in a relaxed A-pose and the soft tissue round it as one distance field, from continuous
// parameters (height, head ratio, fat and where it sits, muscle, shoulder and hip width, waist, legs, softness, age).
// Frame: metres, y up, the person faces +z, x is the person's LEFT, origin on the ground between the feet.
// The rest pose has the arms 42 degrees out and the legs a little apart so limbs never fuse; animation brings them in.
import { Field } from './field';
import { V3, add, clamp, lerp, lerp3, madd, mul, norm, rot, sub, DEG, mirror, cross } from './math';
import { BodyShape, FaceShape } from './params';
import { HeadFrame, buildHead } from './head';

export const BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head',
  'clavL', 'armL', 'foreL', 'handL', 'fingL', 'thumbL',
  'clavR', 'armR', 'foreR', 'handR', 'fingR', 'thumbR',
  'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR',
] as const;
export type BoneName = typeof BONES[number];
export const B: Record<BoneName, number> = Object.fromEntries(BONES.map((n, i) => [n, i])) as Record<BoneName, number>;
export const PARENT: number[] = [
  -1, 0, 1, 2, 3, 4,
  3, 6, 7, 8, 9, 9,
  3, 12, 13, 14, 15, 15,
  1, 18, 19, 20, 1, 22, 23, 24,
];

/** blend groups (field.ts): 0 core; limbs; fingers; ears */
export const G = { core: 0, armL: 1, armR: 2, legL: 3, legR: 4, earL: 5, earR: 6, fingL0: 7, fingR0: 12 } as const;

export interface Rig {
  H: number; s: number; ws: number;
  joints: V3[];                 // rest-pose bone heads, body frame
  field: Field;
  head: HeadFrame;
  sigma: Float64Array;          // per bone skin-weight falloff (m)
  armAngle: number;             // rest A-pose angle from vertical (rad)
  legAngle: number;             // rest leg spread from vertical (rad)
  neckSeam: number;             // y of the head mesh / body mesh seam
  wrist: { p: V3; n: V3 }[];    // the hand-mesh seams (n points toward the hand), L then R
  heel: number;                 // heel height the feet are posed for (m)
  pitch: number;                // the feet's pitch for that heel (rad, about x at the ankle)
  dims: {
    hipY: number; kneeY: number; ankleY: number; crotchY: number; waistY: number; chestY: number; shoulderY: number; navelY: number;
    hipHalf: number; waistHalf: number; chestHalf: number; shoulderX: number; thighR: number; seatZ: number; bellyZ: number; chestZ: number;
    upperArm: number; foreArm: number; thigh: number; shin: number; foot: number; handLen: number;
  };
  fat: { T: number; belly: number; hip: number; thigh: number; arm: number; chest: number; neck: number };
  /** limb geometry of the LEFT side in the rest pose (mirror x for the right) */
  limb: { dU: V3; dFore: V3; sh: V3; el: V3; wr: V3; dL: V3; hip: V3; knee: V3; ankle: V3; toe: V3; neckR: number; neckBase: V3; neckTop: V3; footLen: number };
  /** body point -> the left foot's own frame (origin at the ankle, unpitched); mirror x first for the right foot */
  footLocal(p: V3): V3;
  male: boolean;
}

/** subcutaneous fat thickness (m) from the 0..1 fat parameter */
const fatT = (f: number) => 0.002 + 0.068 * Math.pow(clamp(f), 1.8);   // 0.055 left fat=1 reading only "heavy"

export function buildRig(b: BodyShape, face: FaceShape, heel = 0): Rig {
  const m = b.sex === 'm';
  const H = b.height, s = H / 1.75, ws = 0.35 + 0.65 * s;
  const T = fatT(b.fat), mu = clamp(b.muscle), soft = clamp(b.soft), ap = clamp(b.apple, -1, 1);
  const fat = {
    T,
    // the belly saturates (a soft limit) while the rest keeps filling out: a very heavy body is heavy all over,
    // not a ball on thin legs
    belly: 0.1 * (1 - Math.exp(-T * (m ? 1.3 : 1.0) * (1 + 0.7 * ap) / 0.1)) + 0.05 * b.belly * s,
    waist: T * (m ? 1.1 : 0.85) * (1 + 0.4 * ap),
    hip: T * (m ? 0.9 : 1.35) * (1 - 0.5 * ap),
    thigh: T * ((m ? 0.8 : 1.25) + 5 * T) * (1 - 0.4 * ap),
    arm: T * ((m ? 0.75 : 0.95) + 3 * T),
    chest: T * 0.9,
    calf: T * 0.5,
    neck: T * (0.5 + 4 * T),
  };
  const f = new Field();
  // the blend tree
  const kArm = 0.03 * ws + fat.arm * 0.4, kLeg = 0.035 * ws + fat.thigh * 0.5;
  f.addGroup(0, kArm); f.addGroup(0, kArm); f.addGroup(0, kLeg); f.addGroup(0, kLeg);   // 1..4
  f.addGroup(0, 0.0045 * s); f.addGroup(0, 0.0045 * s);                                  // 5, 6 ears
  for (let i = 0; i < 5; i++) f.addGroup(G.armL, 0.006 * s);                             // 7..11
  for (let i = 0; i < 5; i++) f.addGroup(G.armR, 0.006 * s);                             // 12..16

  // ---- proportions
  const headH = H / b.heads, hs = headH / 0.227;
  const legK = 1 + 0.02 * b.legs;
  const hipY = 0.53 * H * legK, kneeY = 0.285 * H * legK, ankleY = 0.045 * H;
  const crotchY = hipY - 0.055 * s;
  const chestY = 0.72 * H, shoulderY = 0.815 * H, navelY = 0.6 * H;
  const waistY = m ? 0.615 * H : 0.625 * H;
  const shoulderX = (m ? 0.168 : 0.149) * ws * (1 + 0.09 * b.shoulders + 0.04 * mu) + fat.chest * 0.25;
  const hipJX = (m ? 0.083 : 0.088) * ws * (1 + 0.07 * b.hips);
  const hipHalf = (m ? 0.148 : 0.163) * ws * (1 + 0.08 * b.hips) + 0.55 * fat.hip;
  const waistHalf = (m ? 0.127 : 0.11) * ws * (1 + 0.1 * b.waist) * (m ? 1 : 1 - 0.04 * Math.max(0, -b.waist)) + 0.75 * fat.waist + 0.012 * mu * (m ? 1 : 0.5);
  const chestHalf = (m ? 0.137 : 0.121) * ws * (1 + 0.05 * b.shoulders) + 0.35 * fat.chest + 0.018 * mu;
  const upperArm = 0.186 * H, foreArm = 0.146 * H, handLen = 0.108 * H;
  const neckTopY = H - 0.17 * hs, neckBaseY = 0.812 * H;

  // posture (stoop, forward head) is applied by the animation, not baked in
  const J: V3[] = new Array(BONES.length);
  J[B.root] = [0, 0, 0];
  J[B.hips] = [0, hipY + 0.02 * s, -0.005];
  J[B.spine] = [0, 0.615 * H, -0.012 * s];
  J[B.chest] = [0, 0.70 * H, -0.02 * s];
  J[B.neck] = [0, neckBaseY, -0.035 * s];
  J[B.head] = [0, neckTopY, -0.03 * s];
  // arms (left built, right mirrored)
  const armA = 42 * DEG;
  const dU: V3 = [Math.sin(armA), -Math.cos(armA), 0];
  const dFore = norm(add(dU, [0, 0, 0.12]));   // elbows a touch bent, forearm forward
  const shL: V3 = [shoulderX, shoulderY, -0.025 * s];
  const elL = madd(shL, dU, upperArm), wrL = madd(elL, dFore, foreArm);
  J[B.clavL] = [0.022 * s, shoulderY - 0.012 * s, 0.0];
  J[B.armL] = shL; J[B.foreL] = elL; J[B.handL] = wrL;
  // hand frame: along, thumb side (forward), palm normal (toward the body)
  const hA = dFore, hT = norm(sub([0, 0, 1], mul(hA, hA[2]))), hN = norm(cross(hA, hT));
  const hs2 = handLen / 0.189;
  J[B.fingL] = madd(wrL, hA, 0.094 * hs2);
  J[B.thumbL] = madd(madd(madd(wrL, hA, 0.022 * hs2), hT, 0.02 * hs2), hN, 0.008 * hs2);
  for (const [l, r] of [[B.clavL, B.clavR], [B.armL, B.armR], [B.foreL, B.foreR], [B.handL, B.handR], [B.fingL, B.fingR], [B.thumbL, B.thumbR]]) J[r] = mirror(J[l]);
  // legs: spread so the thighs never touch in the rest pose
  const thighR0 = (m ? 0.083 : 0.087) * ws + 0.85 * fat.thigh + 0.012 * mu;
  const gapAt = crotchY - 0.04 * s;
  // at height gapAt the thigh centre is at hipJX + (hipY - gapAt) tan(a); need that - radius >= 1.4 cm
  const need = thighR0 * 0.92 + 0.014 - hipJX;
  const legA = clamp(Math.atan2(Math.max(need, 0), hipY - gapAt), 5 * DEG, 24 * DEG);
  const dL: V3 = [Math.sin(legA), -Math.cos(legA), 0];
  const thigh = hipY - kneeY, shin = kneeY - ankleY;
  const hpL: V3 = [hipJX, hipY, 0], knL = madd(hpL, dL, thigh), anL = madd(knL, dL, shin);
  const footLen = 0.152 * H;
  J[B.thighL] = hpL; J[B.shinL] = knL; J[B.footL] = anL;
  // heels lift the heel and pitch the foot about the ball
  const pitch = heel > 0 ? Math.asin(clamp(heel / (footLen * 0.72), 0, 0.8)) : 0;
  const footP = (p: V3): V3 => { const q = sub(p, anL); return add(anL, rot(q, [1, 0, 0], pitch)); };
  J[B.toeL] = footP(add(anL, [0, -0.058 * s, 0.13 * s]));
  for (const [l, r] of [[B.thighL, B.thighR], [B.shinL, B.shinR], [B.footL, B.footR], [B.toeL, B.toeR]]) J[r] = mirror(J[l]);

  const C = G.core;
  // ---------------------------------------------------------------- torso (core)
  // pelvis and seat
  f.ea([0, 0.537 * H, -0.012 * s], hipHalf, 0.088 * s + 0.25 * fat.hip, 0.095 * s + 0.45 * fat.hip, C, 0.05 * s, B.hips);
  for (const sg of [1, -1]) {
    f.ea([sg * 0.056 * ws, 0.508 * H - 0.3 * fat.hip, -0.066 * s - 0.55 * fat.hip], 0.07 * ws + 0.45 * fat.hip + 0.01 * mu, 0.078 * s + 0.35 * fat.hip, 0.058 * s + 0.6 * fat.hip + 0.012 * mu, C, 0.04 * s, B.hips);
    // the outer hip, saddlebags on a pear
    f.ea([sg * (hipHalf * 0.82 + 0.15 * fat.thigh), 0.49 * H, 0.0], 0.05 * ws + 0.7 * fat.thigh * (1 - 0.3 * ap), 0.075 * s, 0.07 * s + 0.4 * fat.thigh, C, 0.045 * s, sg > 0 ? B.thighL : B.thighR);
  }
  // abdomen, waist, belly
  f.ea([0, 0.585 * H, 0.012 * s], 0.122 * ws + 0.6 * fat.belly, 0.075 * s, 0.085 * s + 0.35 * fat.belly, C, 0.05 * s, B.hips);
  f.ea([0, waistY, -0.006 * s], waistHalf, 0.07 * s, 0.092 * s + 0.4 * fat.waist, C, 0.05 * s, B.spine);
  const sag = soft * 0.025 * s + fat.belly * 0.15;
  if (fat.belly > 0.004 || b.belly > 0) {
    // a belly is wide (it spans the waist) and grows out of the abdomen from under the ribs to over the hips: three
    // overlapping masses, blended over long radii; a firm beer belly sits higher and rounder, a soft one lower
    const P = fat.belly, firm = clamp(b.belly);
    // (not a ball: wide across the waist, its front flatter, sloping gently out from under the chest, fullest at and
    // below the navel and hanging a little over the belt line)
    f.ea([0, navelY - 0.02 * s - sag * (1 - 0.4 * firm), 0.004 * s + 0.28 * P], waistHalf * 0.95 + 0.58 * P * (1 - 0.45 * firm), 0.12 * s + 0.4 * P, 0.065 * s + 0.5 * P, C, 0.06 * s + 0.32 * P, B.spine);
    f.ea([0, navelY + 0.085 * s, 0.12 * P], waistHalf * 0.85 + 0.3 * P * (1 - 0.45 * firm), 0.07 * s + 0.18 * P, 0.06 * s + 0.3 * P * (0.6 + 0.4 * firm), C, 0.06 * s + 0.3 * P, B.spine);
    f.ea([0, navelY - 0.085 * s - sag * 1.2, 0.005 * s + 0.27 * P], waistHalf * 0.85 + 0.4 * P, 0.055 * s + 0.22 * P, 0.06 * s + 0.42 * P * (1 - 0.25 * firm), C, 0.045 * s + 0.2 * P, B.hips);
  }
  if (fat.waist > 0.008) for (const sg of [1, -1]) {
    f.ea([sg * (waistHalf * 0.8 + 0.2 * fat.waist), 0.595 * H - sag * 0.5, -0.025 * s], 0.035 * s + 0.6 * fat.waist, 0.055 * s + 0.4 * fat.waist, 0.06 * s + 0.4 * fat.waist, C, 0.05 * s, B.spine);
  }
  // ribcage, chest, back
  f.ea([0, 0.712 * H, -0.014 * s], chestHalf, 0.125 * s, 0.1 * s + 0.35 * fat.chest + 0.008 * mu, C, 0.05 * s, B.chest);
  f.ea([0, 0.785 * H, -0.03 * s], shoulderX * 0.86, 0.046 * s, 0.072 * s + 0.2 * fat.chest, C, 0.045 * s, B.chest);
  f.ea([0, 0.725 * H, -0.072 * s - 0.3 * fat.chest], 0.105 * ws + 0.3 * fat.chest, 0.115 * s, 0.04 * s + 0.25 * fat.chest, C, 0.04 * s, B.chest);
  for (const sg of [1, -1]) {
    // lats (a V on muscular backs) and the shoulder blades
    f.ea([sg * (chestHalf * 0.78), 0.695 * H, -0.045 * s], 0.035 * ws + 0.03 * mu + 0.25 * fat.chest, 0.1 * s, 0.06 * s, C, 0.04 * s, B.chest);
    f.ea([sg * 0.075 * ws, 0.75 * H, -0.085 * s - 0.25 * fat.chest], 0.055 * ws, 0.075 * s, 0.03 * s, C, 0.035 * s, B.chest);
    // trapezius slope from the neck to the shoulder
    f.rc([sg * 0.032 * ws, 0.832 * H, -0.045 * s], [sg * (shoulderX - 0.03 * ws), 0.81 * H, -0.035 * s], 0.032 * s + 0.014 * mu + 0.3 * fat.chest, 0.026 * s + 0.01 * mu, C, 0.03 * s, B.chest);
    // collarbones: visible on lean bodies, buried as fat rises
    f.rc([sg * 0.018 * ws, 0.808 * H, 0.025 * s], [sg * (shoulderX - 0.012), 0.818 * H, -0.004 * s], 0.0075 * s + 0.6 * fat.chest, 0.0085 * s + 0.4 * fat.chest, C, 0.012 * s, sg > 0 ? B.clavL : B.clavR);
    if (m || b.bust < 0.15) {
      // pectorals
      f.ea([sg * 0.062 * ws, 0.738 * H, 0.068 * s + 0.2 * fat.chest], 0.068 * ws + 0.012 * mu, 0.052 * s + 0.01 * mu + 0.25 * fat.chest, 0.026 * s + 0.024 * mu + 0.5 * fat.chest, C, 0.035 * s, B.chest);
    } else {
      // the bust (always clothed)
      // a natural shape: set a little apart and turned slightly out, the upper slope blending into the chest, the
      // fullness low
      const br = (0.044 + 0.026 * b.bust) * ws + 0.45 * fat.chest;
      const drop = (0.012 * soft + 0.014 * clamp((b.age - 35) / 35)) * s + 0.2 * fat.chest;
      f.ell([sg * 0.088 * ws, 0.71 * H - drop, 0.062 * s + 0.15 * fat.chest], [Math.cos(12 * DEG), 0, sg * Math.sin(12 * DEG)], [0, 1, 0.25], br * 1.05, br * 0.9, br * 0.74, C, 0.055 * s, B.chest);
    }
  }
  // neck
  const neckR = (m ? 0.058 : 0.05) * ws + 0.5 * fat.neck + 0.008 * mu;
  f.cone([0, neckBaseY - 0.02 * s, -0.02 * s], [0, neckTopY + 0.005 * s, -0.048 * s], neckR * 1.04, neckR * 0.94, [0, 0, 1], 0.9, 1, C, 0.035 * s, B.neck);
  if (m) {
    // the larynx, just proud of the throat
    const yL = H - 0.262 * hs, t = (yL - (neckBaseY - 0.02 * s)) / (neckTopY + 0.025 * s - neckBaseY), zc = -0.02 * s + (-0.028 * s) * t;
    f.ea([0, yL, zc + neckR * 0.86], 0.0085 * s, 0.011 * s, 0.006 * s, C, 0.01 * s, B.neck);
  }

  // ---------------------------------------------------------------- arms (left; right mirrored at the end)
  const buildArm = (sg: number) => {
    const X = (p: V3): V3 => (sg > 0 ? p : mirror(p));
    const gA = sg > 0 ? G.armL : G.armR;
    const bA = sg > 0 ? B.armL : B.armR, bF = sg > 0 ? B.foreL : B.foreR, bH = sg > 0 ? B.handL : B.handR;
    const bFi = sg > 0 ? B.fingL : B.fingR, bTh = sg > 0 ? B.thumbL : B.thumbR;
    const fwd: V3 = [0, 0, 1];
    // deltoid
    // (set low on the arm and short along it: its top meets the trapezius slope instead of rising over it as a ball)
    const dOut: V3 = [-dU[1], dU[0], 0];
    f.ell(X(madd(madd(shL, dU, 0.05 * s), dOut, 0.004 * ws)), X(dU), fwd, 0.06 * s, 0.041 * ws + 0.02 * mu + 0.3 * fat.arm, 0.044 * ws + 0.02 * mu + 0.3 * fat.arm, gA, 0.026 * s, bA);
    // upper arm, biceps, triceps, the soft underside on heavier arms
    f.cone(X(madd(shL, dU, 0.045 * s)), X(elL), 0.044 * ws + 0.012 * mu + 0.7 * fat.arm, 0.034 * ws + 0.006 * mu + 0.35 * fat.arm, fwd, 1, 0.92, gA, 0.025 * s, bA);
    f.ell(X(add(lerp3(shL, elL, 0.58), [0, 0, 0.016 * s])), X(dU), fwd, 0.085 * s, 0.022 * ws + 0.016 * mu + 0.25 * fat.arm, 0.026 * ws + 0.01 * mu, gA, 0.02 * s, bA);
    f.ell(X(add(lerp3(shL, elL, 0.42), [0, 0, -0.018 * s])), X(dU), fwd, 0.09 * s, 0.024 * ws + 0.01 * mu + 0.6 * fat.arm * (0.6 + 0.4 * soft), 0.027 * ws + 0.006 * mu + 0.3 * fat.arm, gA, 0.02 * s, bA);
    // elbow, forearm (wide at the muscles, flat at the wrist)
    f.ell(X(add(elL, [0, 0, -0.022 * s])), X(dFore), fwd, 0.022 * s, 0.014 * s, 0.018 * s, gA, 0.015 * s, bF);
    f.cone(X(madd(elL, dFore, 0.01 * s)), X(madd(wrL, dFore, -0.012 * s)), 0.038 * ws + 0.008 * mu + 0.35 * fat.arm, 0.0245 * ws + 0.04 * fat.arm, hT, 0.72, 1.0, gA, 0.02 * s, bF, 1.25);
    f.ell(X(madd(add(elL, [0, 0, 0.006 * s]), dFore, 0.06 * s)), X(dFore), hT, 0.075 * s, 0.022 * ws + 0.008 * mu + 0.25 * fat.arm, 0.03 * ws + 0.006 * mu + 0.2 * fat.arm, gA, 0.02 * s, bF);
    // ---- the hand, relaxed: fingers gently curled, palm toward the thigh
    const hw = hs2 * (m ? 1 : 0.92) * (1 + 0.15 * fat.arm / 0.03);
    const W = (a: number, t: number, n: number): V3 => madd(madd(madd(wrL, hA, a * hs2), hT, t * hw), hN, n * hw);
    f.ell(X(W(0.05, 0.0, 0.002)), X(hA), X(hN), 0.047 * hs2, 0.0135 * hw, 0.041 * hw, gA, 0.01 * s, bH);       // palm
    f.ell(X(W(0.012, 0.0, 0.0)), X(hA), X(hN), 0.022 * hs2, 0.0145 * hw, 0.03 * hw, gA, 0.012 * s, bH);       // wrist/carpus
    f.ell(X(W(0.035, 0.022, 0.009)), X(hA), X(hN), 0.026 * hs2, 0.012 * hw, 0.016 * hw, gA, 0.01 * s, bH);    // thenar pad
    f.ell(X(W(0.045, -0.026, 0.006)), X(hA), X(hN), 0.03 * hs2, 0.01 * hw, 0.012 * hw, gA, 0.008 * s, bH);    // hypothenar
    const FING = [
      { t: 0.023, back: 0.0, len: [0.044, 0.025, 0.021], r: 0.0093 },
      { t: 0.0075, back: -0.003, len: [0.049, 0.029, 0.023], r: 0.0096 },
      { t: -0.0085, back: 0.0, len: [0.046, 0.028, 0.022], r: 0.009 },
      { t: -0.0235, back: 0.009, len: [0.036, 0.021, 0.019], r: 0.0079 },
    ];
    FING.forEach((fg, i) => {
      const g = (sg > 0 ? G.fingL0 : G.fingR0) + 1 + i;
      let p = W(0.092 - fg.back, fg.t, 0.001), d = norm(add(hA, mul(hT, fg.t * 1.4)));
      const curl = [14, 22, 12];
      for (let k = 0; k < 3; k++) {
        d = norm(rot(d, norm(cross(hN, d)), -curl[k] * DEG));
        const L = fg.len[k] * hs2, q = madd(p, d, L);
        const r1 = fg.r * hw * (1 - k * 0.1), r2 = fg.r * hw * (1 - (k + 1) * 0.1) * (k === 2 ? 0.92 : 1);
        f.cone(X(p), X(k === 2 ? madd(q, d, -r2 * 0.6) : q), r1, r2, X(hN), 0.88, 1, g, 0.004 * s, bFi);
        p = q;
      }
    });
    // thumb
    {
      const g = sg > 0 ? G.fingL0 : G.fingR0;
      let p = W(0.02, 0.02, 0.008);
      let d = norm(add(add(mul(hA, 0.62), mul(hT, 0.62)), mul(hN, 0.42)));
      const L = [0.046, 0.032, 0.029], R = [0.0125, 0.0105, 0.0095];
      for (let k = 0; k < 3; k++) {
        const q = madd(p, d, L[k] * hs2);
        f.cone(X(p), X(k === 2 ? madd(q, d, -0.005) : q), R[k] * hw, (R[k + 1] ?? 0.0088) * hw, X(hN), 0.88, 1, g, 0.005 * s, k === 0 ? bH : bTh);
        p = q;
        d = norm(rot(d, norm(cross(hN, d)), -10 * DEG));
      }
    }
  };
  buildArm(1); buildArm(-1);

  // ---------------------------------------------------------------- legs
  const buildLeg = (sg: number) => {
    const X = (p: V3): V3 => (sg > 0 ? p : mirror(p));
    const gL = sg > 0 ? G.legL : G.legR;
    const bT = sg > 0 ? B.thighL : B.thighR, bS = sg > 0 ? B.shinL : B.shinR, bFt = sg > 0 ? B.footL : B.footR, bTo = sg > 0 ? B.toeL : B.toeR;
    const fwd: V3 = [0, 0, 1];
    const top = madd(hpL, dL, -0.03 * s);
    // thigh: round at the top, narrowing to the knee; quads in front, hamstrings behind, the inner thigh
    f.cone(X(top), X(madd(knL, dL, -0.02 * s)), thighR0, 0.05 * ws + 0.25 * fat.thigh + 0.006 * mu, fwd, 1, 0.94, gL, 0.035 * s, bT);
    f.ell(X(add(lerp3(hpL, knL, 0.45), [0, 0, 0.026 * s])), X(dL), fwd, 0.17 * s, 0.035 * ws + 0.018 * mu + 0.2 * fat.thigh, 0.045 * ws + 0.01 * mu, gL, 0.03 * s, bT);
    f.ell(X(add(lerp3(hpL, knL, 0.4), [0, 0, -0.03 * s])), X(dL), fwd, 0.16 * s, 0.035 * ws + 0.012 * mu + 0.3 * fat.thigh, 0.045 * ws, gL, 0.03 * s, bT);
    f.ell(X(add(lerp3(hpL, knL, 0.3), [-0.03 * ws - 0.2 * fat.thigh, 0, 0])), X(dL), fwd, 0.12 * s, 0.035 * ws + 0.35 * fat.thigh, 0.03 * ws + 0.4 * fat.thigh, gL, 0.03 * s, bT);
    // knee
    f.ell(X(add(knL, [0, 0.005 * s, 0.035 * s])), X(dL), fwd, 0.026 * s, 0.014 * s, 0.024 * s, gL, 0.014 * s, bS);
    if (fat.thigh > 0.012) f.ell(X(add(knL, [-0.022 * ws, 0.035 * s, 0.005])), X(dL), fwd, 0.04 * s, 0.02 * s + 0.4 * fat.thigh, 0.025 * s + 0.3 * fat.thigh, gL, 0.02 * s, bT);
    // shin and calf
    f.cone(X(madd(knL, dL, 0.02 * s)), X(madd(anL, dL, -0.02 * s)), 0.042 * ws + 0.25 * fat.calf, 0.024 * ws + 0.15 * fat.calf, fwd, 1, 0.9, gL, 0.025 * s, bS);
    f.ell(X(add(lerp3(knL, anL, 0.3), [0.004, 0, -0.026 * s])), X(dL), fwd, 0.11 * s, 0.033 * ws + 0.012 * mu + 0.6 * fat.calf, 0.032 * ws + 0.008 * mu + 0.3 * fat.calf, gL, 0.025 * s, bS);
    // ankle bones
    f.ea(X(add(anL, [0.012 * s, 0.002, 0])), 0.01 * s, 0.012 * s, 0.012 * s, gL, 0.012 * s, bS);
    f.ea(X(add(anL, [-0.014 * s, 0.006, 0])), 0.01 * s, 0.012 * s, 0.012 * s, gL, 0.012 * s, bS);
    // the foot, pitched for heels about the ankle
    const F = (p: V3) => X(footP(add(anL, mul(p, s))));
    const fa = (p: V3) => X(norm(rot(p, [1, 0, 0], pitch)));
    f.ell(F([0, -0.047, -0.036]), fa([0, 0, 1]), [0, 1, 0], 0.042, 0.031 * s, 0.031 * s, gL, 0.02 * s, bFt);    // heel
    f.cone(F([0, -0.03, -0.02]), F([0.004, -0.058, 0.115]), 0.03 * s, 0.024 * s, fa([0, 1, 0]), 0.78, 1.2, gL, 0.02 * s, bFt, 1.55);
    f.ell(F([0.002, -0.064, 0.17]), fa([0, 0, 1]), fa([0, 1, 0]), 0.045 * s, 0.0145 * s, 0.043 * s, gL, 0.015 * s, bTo);  // toes
  };
  buildLeg(1); buildLeg(-1);

  // ---------------------------------------------------------------- the head and face
  const head = buildHead(f, face, b, { hs, neckTopY, H, s });

  const sigma = new Float64Array(BONES.length).fill(0.024 * s);
  for (const n of ['handL', 'handR', 'thumbL', 'thumbR']) sigma[B[n as BoneName]] = 0.01 * s;
  for (const n of ['fingL', 'fingR']) sigma[B[n as BoneName]] = 0.007 * s;
  for (const n of ['footL', 'footR', 'toeL', 'toeR']) sigma[B[n as BoneName]] = 0.014 * s;
  sigma[B.head] = 0.02 * s; sigma[B.neck] = 0.02 * s;
  for (const n of ['armL', 'armR', 'clavL', 'clavR']) sigma[B[n as BoneName]] = 0.034 * s;
  for (const n of ['thighL', 'thighR', 'hips', 'spine']) sigma[B[n as BoneName]] = 0.03 * s + T * 0.6;

  const wristN = norm(dFore);
  const wristP = madd(wrL, dFore, -0.012 * s);
  f.finalize();
  return {
    H, s, ws, joints: J, field: f, head, sigma, armAngle: armA, legAngle: legA, heel, pitch,
    neckSeam: head.toBody([0, -0.16, 0])[1],
    wrist: [{ p: wristP, n: wristN }, { p: mirror(wristP), n: mirror(wristN) }],
    dims: {
      hipY, kneeY, ankleY, crotchY, waistY, chestY, shoulderY, navelY, hipHalf, waistHalf, chestHalf, shoulderX, thighR: thighR0,
      seatZ: -0.066 * s - 0.55 * fat.hip - (0.058 * s + 0.6 * fat.hip), bellyZ: 0.035 * s + 1.8 * fat.belly + 0.05 * s, chestZ: 0.1 * s + 0.35 * fat.chest,
      upperArm, foreArm, thigh, shin, foot: footLen, handLen,
    },
    fat: { T, belly: fat.belly, hip: fat.hip, thigh: fat.thigh, arm: fat.arm, chest: fat.chest, neck: fat.neck },
    limb: { dU, dFore, sh: shL, el: elL, wr: wrL, dL, hip: hpL, knee: knL, ankle: anL, toe: J[B.toeL], neckR, neckBase: [0, neckBaseY - 0.02 * s, -0.02 * s], neckTop: [0, neckTopY + 0.005 * s, -0.048 * s], footLen },
    footLocal: (p: V3): V3 => rot(sub(p, anL), [1, 0, 0], -pitch),
    male: m,
  };
}

export const lerpN = lerp;
