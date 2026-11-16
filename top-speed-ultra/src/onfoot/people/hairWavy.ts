// The swept-back wavy side part (hero test, 2026-11-16; HairStyle 'sweptWavy', nothing else uses this file).
// A classic executive cut: a side part, the top 6 to 8 cm long, combed back and across with soft S-waves and volume at the
// front, the sides and back tapered shorter (not shaved), tidy over the ears and at the nape.
//
// It is layered hair:
//   1. a sculpted base volume (hair.ts HairSdf.thick -> wavyThick): the shell over the scalp with the front lifted, the
//      parting a shallow groove, wave ridges across the strands and shallow grooves between locks;
//   2. a strand shader on it (wavyCapMaterial): every pixel finds its own strand from ONE strand field (strandAt), so the
//      streaks, the locks' tones, the lighter crests and the anisotropic highlight all follow the same waves, and the
//      hairline is cut on those strands and fades into the scalp's colour (no notch, no dark rim);
//   3. feathered strand cards over it (growWavyCards): locks that follow the same field, lifting off the volume on the
//      waves' crests, fine ones up from the front hairline, short tidy ones on the sides and at the nape.
//
// The strand field: the head as a globe whose poles are the ears. Combed straight back, a strand is a circle of latitude
// (over the top it runs front to back, on the side it arcs round the ear, behind it runs down to the nape). The side part
// shears the latitudes away from the parting (the long side across and back, the short side down and back), and the waves
// swing the strands sideways along their length. The same few lines are written twice, in TypeScript (the volume, the
// cards) and in GLSL (the shader); keep them in step.
import * as THREE from 'three';
import type { HairBuild, HairSdf } from './hair';
import { Look, Quality } from './params';
import { V3, clamp, smooth, norm, cross, dot, rng, lerp } from './math';
import { hairlineDepth } from './masks';
import { NOISE } from './skin';
import { hairLights } from './cards';

export interface Wavy {
  part: number;       // the parting's latitude (radians from the head's middle toward the person's left ear)
  k1: number;         // the long side's sweep across the head, radians of latitude per radian travelled back
  k2: number;         // the short side's sweep down its own side
  kappa: number;      // the waves along a strand: 2 pi / their length (1/m)
  amp: number;        // how far a wave swings a strand sideways on top (m)
  ridge: number;      // the waves' height in the volume on top (m)
  lockW: number;      // a lock's width (m)
  groove: number;     // the groove between locks on top (m)
  top: number; side: number; back: number;   // the shell's thickness (m)
  quiff: number;      // extra height at the front of the top (m)
  forelock: number;   // a loose wave off the front of the long side: how far the hair comes down onto the forehead there (m)
}
export const WAVY: Wavy = { part: 0.34, k1: 0.55, k2: 0.34, kappa: 2 * Math.PI / 0.052, amp: 0.0042, ridge: 0.0026, lockW: 0.0125, groove: 0.0021, top: 0.023, side: 0.0105, back: 0.0125, quiff: 0.012, forelock: 0.009 };

// the ear axis (head-local y, z), the globe's radius for lengths (m), the front hairline's angle
const AXY = -0.005, AXZ = -0.065, RS = 0.105, TH0 = 0.85;

/** the strand field at a head-local point. out: [s, w0, wv, phase, topW, big, tp, lam]
 *  s: metres along the strand from the front hairline; w0: which strand (metres across, before the waves); wv: the same
 *  with the waves; phase: the wave's phase; topW: 0 on the sides .. 1 on top; big: 1 on the long side of the parting */
export function strandAt(W: Wavy, x: number, y: number, z: number, out: Float64Array, layer = -1) {
  const dy = y - AXY, dz = z - AXZ, R = Math.hypot(x, dy, dz) || 1e-6;
  const lam = Math.asin(clamp(x / R, -1, 1)), th = Math.atan2(-dz, dy), tp = th + TH0;
  const g = 1.25 * Math.tanh(Math.max(tp, 0) / 1.25);
  const eP = lerp(0.02, 0.5, smooth(0.9, 1.9, tp));
  const big = smooth(-eP, eP, W.part - lam);
  const kk = lerp(-W.k2 * smooth(1.0, 0.45, lam), W.k1 * smooth(-1.05, -0.35, lam), big);
  const s = RS * tp * Math.max(Math.cos(lam), 0.4);
  let w0 = RS * (lam + kk * g);
  // two layers: the long top lies over the shorter hair of the back of the head and ends there in uneven locks; under
  // its ends the back's own hair runs straight down (layer: -1 the layer at this point, 0 the top's field, 1 the back's)
  const endT = 2.0 + 0.1 * Math.sin(w0 * 190 + 0.9) + 0.08 * Math.sin(w0 * 71 + 2.3) + 0.025 * Math.sin(w0 * 520);
  const lay = layer >= 0 ? layer : tp > endT ? 1 : 0;
  if (lay === 1) w0 = RS * lam + 0.37;
  const topW = smooth(0.03, 0.075, y) * (lay === 1 ? 0.35 : 1);
  // the waves: their length and their swing vary from lock to lock (no corrugated regularity)
  const ph = W.kappa * s * (1 + 0.13 * Math.sin(w0 * 57 + 2.0)) + 1.7 * Math.sin(w0 * 38 + 0.6) + 21 * w0;
  const amp = W.amp * (0.3 + 0.7 * topW) * (0.7 + 0.3 * Math.sin(w0 * 83 + s * 9.0));
  out[0] = s; out[1] = w0; out[2] = w0 + amp * Math.sin(ph); out[3] = ph; out[4] = topW; out[5] = big; out[6] = tp; out[7] = lam; out[8] = lay; out[9] = endT;
}
const ST = new Float64Array(10), ST2 = new Float64Array(10);

/** the same in GLSL: sets sC, w0, wv, ph, topW, big, tp, lam from the head-local point hl */
const STRAND_GLSL = (W: Wavy) => /* glsl */ `
vec3 d3 = hl - vec3(0.0, ${AXY.toFixed(4)}, ${AXZ.toFixed(4)});
float lam = asin(clamp(d3.x / max(length(d3), 1e-6), -1.0, 1.0)), th = atan(-d3.z, d3.y), tp = th + ${TH0.toFixed(3)};
float egq = exp(-2.0 * max(tp, 0.0) / 1.25), gq = 1.25 * (1.0 - egq) / (1.0 + egq);
float eP = mix(0.02, 0.5, smoothstep(0.9, 1.9, tp));
float big = smoothstep(-eP, eP, ${W.part.toFixed(4)} - lam);
float kk = mix(-${W.k2.toFixed(4)} * (1.0 - smoothstep(0.45, 1.0, lam)), ${W.k1.toFixed(4)} * smoothstep(-1.05, -0.35, lam), big);
float sC = ${RS.toFixed(4)} * tp * max(cos(lam), 0.4), w0 = ${RS.toFixed(4)} * (lam + kk * gq);
float endT = 2.0 + 0.1 * sin(w0 * 190.0 + 0.9) + 0.08 * sin(w0 * 71.0 + 2.3) + 0.025 * sin(w0 * 520.0);
float lay = step(endT, tp);
w0 = mix(w0, ${RS.toFixed(4)} * lam + 0.37, lay);
float topW = smoothstep(0.03, 0.075, hl.y) * (1.0 - 0.65 * lay);
float ph = ${W.kappa.toFixed(3)} * sC * (1.0 + 0.13 * sin(w0 * 57.0 + 2.0)) + 1.7 * sin(w0 * 38.0 + 0.6) + 21.0 * w0;
float wv = w0 + ${W.amp.toFixed(5)} * (0.3 + 0.7 * topW) * (0.7 + 0.3 * sin(w0 * 83.0 + sC * 9.0)) * sin(ph);
`;

/** a lock's profile across its width at a strand coordinate: 0 in the groove between two locks .. 1 on the lock's middle */
const lockProf = (W: Wavy, wv: number) => { const lc = wv / W.lockW + 0.35 * Math.sin(wv * 95 + 1.1); return Math.sin(Math.PI * (lc - Math.floor(lc))); };

/** the hairline lowered a little at the front, and slightly uneven (head-local point -> the point the scalp is read at) */
export function wavyLine(l: V3, W: Wavy = WAVY): V3 {
  const a = Math.atan2(l[0], l[2] + 0.06);
  // (a loose wave off the front of the long side: the hair comes down onto the forehead in one soft lobe there)
  const lobe = W.forelock * Math.exp(-(((l[0] + 0.027) / 0.015) ** 2)) * (0.8 + 0.2 * Math.sin(l[0] * 400 + 1.0));
  return [l[0], l[1] + (0.0045 + 0.002 * Math.sin(a * 19 + 1.3 * Math.sin(a * 7 + 0.4)) + lobe) * smooth(-0.1, -0.03, l[2]), l[2]];
}

/** the shell's thickness at a head-local point (m), tapered to nothing at the hairline */
export function wavyThick(sdf: HairSdf, l: V3) {
  const W = sdf.sp.wavy!, [x, y, z] = l;
  strandAt(W, x, y, z, ST);
  const ph = ST[3], topW = ST[4], big = ST[5], tp = ST[6], lam = ST[7];
  const back = smooth(-0.04, -0.1, z), top = smooth(0.005, 0.075, y);
  let t = lerp(lerp(W.side, W.back, back), W.top, top);
  // the top thins a little past the crown, down the back of the head
  t *= 1 - 0.25 * top * smooth(-0.1, -0.15, z);
  // the front stands up and over, most on the long side just past the parting
  const front = smooth(-0.09, -0.005, z) * smooth(0.045, 0.085, y);
  t += W.quiff * front * (0.4 + 0.6 * big);
  // the short side lies flatter
  t *= 1 - 0.24 * (1 - big) * topW;
  // the parting: a shallow groove from the front hairline to the crown
  t *= 1 - 0.5 * Math.exp(-(((lam - W.part) / 0.045) ** 2)) * smooth(1.9, 1.05, tp) * smooth(-0.1, 0.12, tp) * topW;
  // the waves across the strands, and the grooves between locks (both fade down the sides: short hair lies tidy)
  const aR = 0.2 + 0.8 * topW;
  t += W.ridge * aR * Math.sin(ph + 1.2);
  t -= W.groove * aR * (1 - smooth(0.0, 0.55, lockProf(W, ST[2])));
  // the top layer's ends lie on the back's hair: a small step down under them
  t += 0.0012 * smooth(ST[9] + 0.05, ST[9] - 0.05, tp) * smooth(-0.02, -0.07, z);
  t = Math.max(t, 0.002);
  // tapered into the hairline: over 3.4 cm at the sides and the nape (short there, no ledge), over 1.3 cm at the front, where
  // the hair stands up off the forehead
  const d = hairlineDepth(sdf.style, wavyLine(l), 35 + 40 * sdf.hf.old, sdf.hf.male);
  const tap = lerp(0.034, 0.013, smooth(-0.06, -0.01, z) * smooth(0.03, 0.055, y));
  return t * (0.03 + 0.97 * Math.pow(smooth(0.0, tap, d), 0.85));
}

/** the strand's direction at a head-local point (head-local, unit): along the level line of the strand field */
export function wavyFlow(W: Wavy, l: V3): V3 {
  const [x, y, z] = l, dy = y - AXY, dz = z - AXZ, R = Math.hypot(x, dy, dz) || 1e-6, rr = Math.hypot(dy, dz) || 1e-6;
  // along a latitude toward the back, and across the latitudes toward the person's left ear
  const eT: V3 = [0, dz / rr, -dy / rr];
  const eL: V3 = norm([rr / R, -(x / R) * (dy / rr), -(x / R) * (dz / rr)]);
  const h = 0.0012;
  strandAt(W, x, y, z, ST2); const w = ST2[2], lay = ST2[8];
  strandAt(W, x + eT[0] * h, y + eT[1] * h, z + eT[2] * h, ST2, lay); const dT = (ST2[2] - w) / h;
  strandAt(W, x + eL[0] * h, y + eL[1] * h, z + eL[2] * h, ST2, lay); let dL = (ST2[2] - w) / h;
  // (in the parting's fan the field turns over: the strands still run back)
  if (Math.abs(dL) < 0.25) dL = dL < 0 ? -0.25 : 0.25;
  const sg = dL > 0 ? 1 : -1;
  const sl = clamp(-dT / dL * sg, -0.9, 0.9) * sg;   // the sideways slope, limited (a wave never turns a strand round)
  return norm([eT[0] + eL[0] * sl, eT[1] + eL[1] * sl, eT[2] + eL[2] * sl]);
}

/** the cap's material: the strand field per pixel */
export function wavyCapMaterial(look: Look, quality: Quality, W: Wavy, headO: V3, headS: V3) {
  const hi = quality === 'high';
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, alphaTest: 0.3, envMapIntensity: 0.3 });
  const u = {
    uCol: { value: new THREE.Color(look.hairColor) }, uTipCol: { value: new THREE.Color(look.hairTips ?? look.hairColor) }, uTip: { value: look.hairTips != null ? 1 : 0 },
    uGrey: { value: look.grey }, uGreyCol: { value: new THREE.Color(0xc4c0b8) },
    uScalp: { value: new THREE.Color(look.skin).lerp(new THREE.Color(look.hairColor), 0.5) },
    uHeadO: { value: new THREE.Vector3(...headO) }, uHeadS: { value: new THREE.Vector3(...headS) },
  };
  m.customProgramCacheKey = () => 'haircap-wavy-' + quality;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute vec3 aFlow; attribute float aAo; attribute float aEdge;\nvarying vec3 vRest; varying vec3 vFlowV; varying float vAo; varying float vEdge;')
      .replace('#include <skinnormal_vertex>', `#include <skinnormal_vertex>
vec3 flowO = aFlow;
#ifdef USE_SKINNING
flowO = ( skinMatrix * vec4( aFlow, 0.0 ) ).xyz;
#endif
vFlowV = normalize( normalMatrix * flowO ); vRest = aRest; vAo = fract(aAo * 0.5) * 2.0; vEdge = aEdge;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRest; varying vec3 vFlowV; varying float vAo; varying float vEdge;
uniform vec3 uCol; uniform vec3 uTipCol; uniform float uTip; uniform float uGrey; uniform vec3 uGreyCol; uniform vec3 uScalp; uniform vec3 uHeadO; uniform vec3 uHeadS;
float gFull = 1.0, gWv = 0.0, gN1 = 0.5, gN2 = 0.5, gCrest = 0.5, gLock = 1.0, gH = 0.0;
${NOISE}`)
      .replace('#include <lights_physical_pars_fragment>', hairLights(0.85))
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 hl = (vRest - uHeadO) / uHeadS;   // head-local metres
${STRAND_GLSL(W)}
gWv = wv;
// the strands: fine ones a third of a millimetre across (their mean where they are finer than a pixel), bundles about a
// millimetre across, and a tone per lock, all drawn out along the strand
float fw = fwidth(wv);
float n2 = mix(vnoise(vec3(wv * 1100.0, sC * 9.0, 7.0)), 0.5, smoothstep(0.6, 1.6, fw * 1100.0));
${hi ? 'float n1 = mix(vnoise(vec3(wv * 3400.0, sC * 20.0, 1.3)), 0.5, smoothstep(0.45, 1.1, fw * 3400.0));' : 'float n1 = n2;'}
float lc = wv / ${W.lockW.toFixed(5)} + 0.35 * sin(wv * 95.0 + 1.1), lf = fract(lc);
float prof = sin(3.14159265 * lf);
prof = mix(prof, 0.7, smoothstep(0.25, 0.8, fw / ${W.lockW.toFixed(5)}));
float lockT = hh13(vec3(floor(lc), 3.0, 7.0));
float n3 = vnoise(vec3(wv * 260.0, sC * 5.0, 3.0));
float crest = 0.5 + 0.5 * sin(ph + 1.2);
float sK = 0.62 + 0.38 * topW;   // (the short hair of the sides and the back is finer in tone: no comb's teeth)
float strand = 0.86 + (0.24 * (n1 - 0.5) + 0.34 * (n2 - 0.5) + 0.2 * (lockT - 0.5) + 0.22 * (n3 - 0.5)) * sK;
// the lighter ends where the light catches: on the waves' crests, on the locks' middles, most toward the top layer's ends
float tipA = uTip * clamp((0.04 + 0.34 * crest * (0.3 + 0.7 * topW)) * smoothstep(0.15, 0.8, prof) * (0.3 + 0.7 * n3) + 0.3 * smoothstep(0.05, 0.16, sC) * smoothstep(0.35, 0.75, n2) * topW * (1.0 - lay), 0.0, 1.0);
vec3 c = mix(uCol, uTipCol, tipA) * strand;
float gn = vnoise(vec3(wv * 2600.0, sC * 14.0, 17.0));
float gSel = mix(smoothstep(1.0 - uGrey - 0.12, 1.0 - uGrey + 0.12, gn), uGrey, smoothstep(0.35, 1.2, fw * 2600.0));
c = mix(c, uGreyCol * (0.75 + 0.3 * n2), gSel * step(0.001, uGrey));
// shade in the grooves between locks and in the waves' troughs; the baked occlusion under the mass
float grooveS = mix(1.0, 0.5 + 0.5 * smoothstep(0.0, 0.5, prof), 0.4 + 0.6 * topW);
c *= grooveS * (0.8 + 0.2 * crest) * (0.5 + 0.5 * vAo);
// the shade the top layer's ends throw on the back's hair under them
c *= 1.0 - 0.16 * lay * exp(-(tp - endT) / 0.1);
gN1 = n1; gN2 = n2; gCrest = crest; gLock = prof;
gH = 0.3 * (n2 - 0.5) + 0.12 * (n1 - 0.5) + 0.25 * smoothstep(0.0, 0.5, prof);   // relief, mm
// the hairline: cut once on the strands themselves, where the hair has already faded into the colour of the scalp under
// thin hair (the fade is in the colour: no dark pixel sits at the hairline)
diffuseColor.a = vEdge * 1.7 - 0.25 + 0.5 * (vnoise(vec3(wv * 2600.0, sC * 16.0, 2.0)) - 0.5) + 0.3 * (vnoise(vec3(wv * 700.0, sC * 8.0, 9.0)) - 0.5);
gFull = smoothstep(0.3, 1.0, diffuseColor.a);
diffuseColor.rgb = mix(uScalp * (0.9 + 0.2 * n2), c, gFull);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${hi ? 'normal = bumpNormal(-vViewPosition, normal, gH * 0.001 * gFull * smoothstep(1.6, 0.5, fwidth(gWv) * 1100.0), faceDirection);' : ''}`)
      .replace('#include <lights_fragment_begin>', `{
  // the strand's direction on the surface: along the line the strand coordinate keeps its value on (so the highlight
  // follows the waves); the combed direction where that is not resolved
  vec3 dpx = dFdx( -vViewPosition ), dpy = dFdy( -vViewPosition );
  vec3 td = dpx * dFdy( gWv ) - dpy * dFdx( gWv );
  td -= normal * dot( td, normal );
  vec3 tf = normalize( vFlowV - normal * dot( vFlowV, normal ) + 1e-5 );
  float tl = length( td );
  gHairT = tl > 1e-9 && fwidth( gWv ) < 0.004 ? normalize( td / tl * sign( dot( td, tf ) + 1e-6 ) + tf * 0.35 ) : tf;
  gHairSpec = mix( vec3(1.0, 0.95, 0.9), diffuseColor.rgb * 3.0, 0.5 ) * ( 0.3 + 1.5 * gN1 * gN2 ) * ( 0.55 + 0.45 * gLock ) * gFull * 1.25;
  gHairShift = 0.12 * ( gN2 - 0.5 );
}
#include <lights_fragment_begin>`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
float aoF = mix(1.0, vAo, gFull); reflectedLight.indirectDiffuse *= aoF; reflectedLight.indirectSpecular *= aoF * 0.6;`);
  };
  return m;
}

/** the strand cards: locks over the top that follow the waves and lift off the volume on their crests, fine ones up from
 *  the front hairline, short ones on the sides and at the nape, and a loose lock or two falling toward the forehead */
export function growWavyCards(hb: HairBuild, roots: V3[], quality: Quality, seed: number, edgeRoots: V3[]) {
  const sdf = hb.sdf, hf = sdf.hf, r = rng(seed * 131 + 11), hi = quality === 'high';
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], skin: number[][] = [], flowA: number[] = [], nrm: number[] = [];
  const ev = (p: V3) => sdf.eval(p[0], p[1], p[2], null, 0);
  const grad = (p: V3): V3 => { const e = 0.0008, f0 = ev(p); return norm([ev([p[0] + e, p[1], p[2]]) - f0, ev([p[0], p[1] + e, p[2]]) - f0, ev([p[0], p[1], p[2] + e]) - f0]); };
  const skinD = (q: V3) => sdf.H.eval(q[0], q[1], q[2], null, 0);
  /** a ribbon along `pts`, `w` wide at its root, narrowing to its tip; rolled a little about its own length */
  const ribbon = (pts: { p: V3; s: V3; n: V3 }[], w: number, roll: number, uHalf = 0.27) => {
    const m = pts.length;
    if (m < 3) return;
    const base = pos.length / 3, u0 = r.next(), cr = Math.cos(roll), sr = Math.sin(roll);
    for (let k = 0; k < m; k++) {
      const t = k / (m - 1), q = pts[k], ww = w * 0.5 * (0.7 + 0.3 * Math.sin(Math.min(1, t * 2.2) * 1.5708)) * (1 - 0.5 * t * t);
      const sx = q.s[0] * cr + q.n[0] * sr, sy = q.s[1] * cr + q.n[1] * sr, sz = q.s[2] * cr + q.n[2] * sr;
      const fl: V3 = norm(k < m - 1 ? [pts[k + 1].p[0] - q.p[0], pts[k + 1].p[1] - q.p[1], pts[k + 1].p[2] - q.p[2]] : [q.p[0] - pts[k - 1].p[0], q.p[1] - pts[k - 1].p[1], q.p[2] - pts[k - 1].p[2]]);
      for (const sgn of [-1, 1]) {
        pos.push(q.p[0] + sx * ww * sgn, q.p[1] + sy * ww * sgn, q.p[2] + sz * ww * sgn);
        uv.push(0.5 + 0.06 * (u0 - 0.5) + sgn * uHalf, 0.02 + 0.96 * t);
        skin.push(hb.headW(q.p)); flowA.push(fl[0], fl[1], fl[2]);
        // (lit as the volume it lies on, leaning a little to its own side: a lock, not a flat chip)
        const nx = q.n[0] * cr - q.s[0] * sr + sx * 0.3 * sgn, ny = q.n[1] * cr - q.s[1] * sr + sy * 0.3 * sgn, nz = q.n[2] * cr - q.s[2] * sr + sz * 0.3 * sgn, nl = Math.hypot(nx, ny, nz) || 1;
        nrm.push(nx / nl, ny / nl, nz / nl);
      }
    }
    for (let k = 0; k < m - 1; k++) { const a = base + k * 2; idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }   // (wound so the ribbon's face looks out of the head, as its normals do)
  };
  /** follow the strand field over the volume from p0, at a height above its surface that `lift` gives along the length */
  const trace = (p0: V3, maxLen: number, step: number, lift: (t: number) => number, overMax: number) => {
    const pts: { p: V3; s: V3; n: V3 }[] = [];
    let p = p0.slice() as V3, len = 0, over = 0;
    { const f = ev(p) - lift(0), g = grad(p); p = [p[0] - g[0] * f, p[1] - g[1] * f, p[2] - g[2] * f]; }
    for (let k = 0; k < 60 && len < maxLen; k++) {
      const nn = grad(p);
      let d = hb.flow(p);
      d = norm([d[0] - nn[0] * dot(d, nn), d[1] - nn[1] * dot(d, nn), d[2] - nn[2] * dot(d, nn)]);
      pts.push({ p: p.slice() as V3, s: norm(cross(nn, d)), n: nn });
      if (sdf.keep(p[0], p[1], p[2]) > 0.003 && k > 0) { if (over >= overMax) break; over += step; }
      p = [p[0] + d[0] * step, p[1] + d[1] * step, p[2] + d[2] * step];
      len += step;
      const want = lift(Math.min(1, len / maxLen));
      for (let it = 0; it < 2; it++) { const f = ev(p) - want, g = grad(p); p = [p[0] - g[0] * f, p[1] - g[1] * f, p[2] - g[2] * f]; }
      // never into the skin (past the hairline the volume has thinned to nothing)
      const dS = skinD(p);
      if (dS < 0.002) { const e = 0.001, g: V3 = norm([skinD([p[0] + e, p[1], p[2]]) - dS, skinD([p[0], p[1] + e, p[2]]) - dS, skinD([p[0], p[1], p[2] + e]) - dS]); p = [p[0] + g[0] * (0.002 - dS), p[1] + g[1] * (0.002 - dS), p[2] + g[2] * (0.002 - dS)]; }
    }
    return pts;
  };
  const topRoots: V3[] = [], lowRoots: V3[] = [];
  for (const q of roots) (hf.toLocal(q)[1] > 0.045 ? topRoots : lowRoots).push(q);
  const frontRoots = edgeRoots.filter((q) => { const l = hf.toLocal(q); return l[2] > -0.035 && l[1] > 0.04; });
  const pick = (a: V3[]) => a[Math.floor(r.next() * a.length)];
  // ---- the top: locks 5 to 8 cm long that follow the waves, arching off the volume
  if (topRoots.length) for (let c = 0, n = hi ? 230 : 110; c < n; c++) {
    const hgt = 0.001 + 0.004 * r.next() * r.next(), L = 0.045 + 0.035 * r.next();
    const pts = trace(pick(topRoots), L, hi ? 0.0055 : 0.008, (t) => -0.0035 + 0.0027 * smooth(0, 0.16, t) + hgt * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.001 * t, 0.006);
    ribbon(pts, 0.006 + 0.005 * r.next(), (r.next() - 0.5) * 0.3);
  }
  // ---- the sides and the back: short, close, tidy
  if (lowRoots.length) for (let c = 0, n = hi ? 120 : 64; c < n; c++) {
    const L = 0.02 + 0.02 * r.next(), hgt = 0.0006 + 0.0012 * r.next();
    const pts = trace(pick(lowRoots), L, 0.006, (t) => -0.003 + 0.0024 * smooth(0, 0.2, t) + hgt * Math.sin(Math.PI * t) + 0.0006 * t, 0.003);
    ribbon(pts, 0.0035 + 0.0025 * r.next(), (r.next() - 0.5) * 0.2);
  }
  // ---- up from the front hairline, over the lifted front: they feather the hairline and the front's outline
  if (frontRoots.length) for (let c = 0, n = hi ? 90 : 44; c < n; c++) {
    const L = 0.032 + 0.03 * r.next(), hgt = 0.002 + 0.004 * r.next();
    const pts = trace(pick(frontRoots), L, hi ? 0.005 : 0.007, (t) => 0.0004 + hgt * Math.sin(Math.PI * Math.min(1, t * 1.2)) + 0.001 * t, 0);
    ribbon(pts, 0.0022 + 0.002 * r.next(), (r.next() - 0.5) * 0.3);   // (fine wisps: a dense lock this narrow is a few hairs)
  }
  return { pos: new Float32Array(pos), uv: new Float32Array(uv), idx, skin, flow: new Float32Array(flowA), nrm: new Float32Array(nrm) };
}
