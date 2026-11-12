// Where things are on a face and body, as soft masks in the head's frame: lips, the mouth's interior, warm areas,
// blush, beard and stubble, the eye area, wrinkles (forehead, crow's feet, neck rings), freckles, and the scalp under
// each hairstyle.
import { V3, clamp, smooth } from './math';
import { HeadFrame } from './head';
import { HairStyle, Look } from './params';

const g3 = (x: number, y: number, z: number, c: V3, r: number) => Math.exp(-((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2) / (r * r));

/** the scalp's natural hairline (head-local y) at an angle round the skull's centre (0 front .. pi back), before any
 *  recession */
const HAIRLINE: [number, number][] = [[0, 0.064], [0.55, 0.06], [0.95, 0.047], [1.25, 0.012], [1.55, -0.004], [1.85, -0.01], [2.3, -0.05], [3.15, -0.078]];
function hairlineY(phi: number, male: boolean) {
  const K = HAIRLINE;
  let yH = K[K.length - 1][1];
  for (let i = 0; i < K.length - 1; i++) if (phi <= K[i + 1][0]) { const t = (phi - K[i][0]) / (K[i + 1][0] - K[i][0]); yH = K[i][1] + (K[i + 1][1] - K[i][1]) * t; break; }
  if (!male) yH -= 0.003 * smooth(0.4, 0.9, phi);
  return yH;
}

/** the scalp under a hairstyle: 1 where hair grows (head-local) */
export function scalpCover(style: HairStyle, l: V3, age: number, male: boolean) {
  if (style === 'bald') return 0;
  const [x, y, z] = l, ax = Math.abs(x);
  const phi = Math.abs(Math.atan2(x, z + 0.06));   // 0 front .. pi back, about the skull's centre
  let yH = hairlineY(phi, male);
  const rec = style === 'receding' ? 1 : male ? clamp((age - 35) / 40) * 0.4 : 0;
  yH += rec * (0.022 * smooth(1.2, 0.0, phi) + 0.012 * Math.exp(-(((phi - 0.75) / 0.3) ** 2)));
  let c = smooth(yH - 0.003, yH + 0.004, y);
  // the ears are not hair
  // the ears are not hair: their own outline, out from the side of the skull
  const earE = Math.exp(-(((y + 0.014) / 0.034) ** 2) - (((z + 0.083) / 0.026) ** 2));
  c *= 1 - smooth(0.3, 0.55, earE) * smooth(0.062, 0.07, ax);
  // a thinning crown on a receding style
  if (style === 'receding') c *= 1 - 0.85 * smooth(0.07, 0.1, y) * smooth(-0.11, -0.04, z);
  return c;
}

export interface FaceMask { red: number; lip: number; thin: number; blush: number; beard: number; eyeA: number; mouth: number; scalp: number; wrink: number; freck: number }

/** lips: the vermilion above and below the slit, plus their wet inner faces (faceMasks().lip) */
function lipAt(x: number, y: number, z: number, hf: HeadFrame) {
  const ax = Math.abs(x), F = hf.face, mY = hf.mouth.y, mw = 0.026 * F.mouthW;
  const xr = clamp(1 - (x / mw) ** 2);
  const hU = 0.0072 * F.lipUpper * Math.pow(xr, 0.55), hL = 0.0088 * F.lipLower * Math.pow(xr, 0.6);
  const front = smooth(0.006, 0.012, z);
  const inU = y >= mY ? smooth(hU + 0.0008, hU - 0.0008, y - mY) : 0;
  const inL = y < mY ? smooth(hL + 0.0008, hL - 0.0008, mY - y) : 0;
  return clamp((inU + inL) * front * smooth(mw + 0.001, mw - 0.002, ax));
}

/** the mouth's interior (faceMasks().mouth), fading out over the last few mm before each corner: the interior's dark
 *  red no longer pools in the corners */
function mouthAt(x: number, y: number, z: number, hf: HeadFrame) {
  const ax = Math.abs(x), F = hf.face, mY = hf.mouth.y;
  const inMouth = (x / 0.0225) ** 2 + ((y - mY + 0.001) / 0.0125) ** 2 + (z / 0.0185) ** 2 < 1.15;
  return inMouth ? smooth(0.0175, 0.0115, z) * smooth(0.0235 * F.mouthW, 0.019 * F.mouthW, ax) : 0;
}

/** beard and stubble where facial hair grows on a man (faceMasks().beard), given the lip and mouth masks there.
 *  Every edge is a ramp a few mm wide, in the head's frame (head-local metres):
 *  - the cheek line drops from the sideburn to the corner of the moustache, rising toward the ear instead of running
 *    level along the side of the face;
 *  - the sideburn runs from the cheek line up to the scalp's hairline in front of the ear, its back edge just ahead of
 *    the ear's front (which moves with the ear's size), so no hair grows on the ear;
 *  - behind, the beard stops in front of the lobe and then along the back of the jaw;
 *  - the neckline runs from under the jaw's angle forward and down to the throat, one curve with no step.
 *  (It was a set of hard boxes: the sideburn a box over the front of the ear with a vertical back edge, the side of the
 *  face cut level, and a step under the jaw where the neck's cut met the face's. With a dense beard over a full base,
 *  every edge of them showed from 45 degrees round.) */
function beardAt(x: number, y: number, z: number, hf: HeadFrame, look: Look, lip: number, mouth: number) {
  if (!hf.male) return 0;
  const ax = Math.abs(x), mY = hf.mouth.y, fh = look.facialHair;
  // the cheek line: low beside the mouth, climbing across the side of the face to the sideburn
  const yLine = -0.035 - 0.02 * clamp((0.05 - ax) / 0.025) + 0.008 * smooth(-0.004, -0.04, z);
  // the ear's front edge (the tragus side of its disc, head.ts): the sideburn stops just ahead of it, the beard below
  // it in front of the lobe, then along the back of the jaw
  const zEar = -0.0625 + 0.0185 * (hf.face.earSize - 1);
  const zBack = zEar + 0.0005 - 0.0075 * smooth(-0.045, -0.062, y);   // (below the lobe it may reach 7.5 mm further back)
  const back = smooth(zBack, zBack + 0.005, z);
  // the neckline: under the jaw's angle at the back, falling forward to the throat
  const yNeck = -0.091 - 0.032 * smooth(-0.074, -0.026, z);
  const neck = smooth(yNeck - 0.007, yNeck + 0.003, y);
  const lower = smooth(yLine + 0.004, yLine - 0.004, y) * back * neck;
  const must = ax < 0.03 && y > mY + 0.003 && y < -0.046 && z > 0.008 ? smooth(0.03, 0.022, ax) * smooth(mY + 0.003, mY + 0.006, y) * smooth(-0.046, -0.049, y) : 0;
  // the sideburn: from the cheek line up into the scalp's hairline (a bald head's ends at the top of the ear), its
  // front edge 2 cm ahead of the ear at the top and widening into the cheek at the bottom (worked out only where it
  // can add to the rest: it is 0 at |x| < 0.05 and ahead of z -0.028, and nothing exceeds a full 1)
  let side = 0;
  if (lower < 1 && ax > 0.05 && z < -0.028 && back * neck > 0) {
    const yHair = look.hair === 'bald' ? 0.004 : hairlineY(Math.abs(Math.atan2(x, z + 0.06)), true);
    const zFront = -0.044 + 0.008 * smooth(-0.004, -0.028, y);
    side = smooth(0.05, 0.058, ax) * smooth(yHair + 0.003, yHair - 0.003, y) * smooth(zFront + 0.008, zFront, z) * back * neck;
  }
  const full = clamp(Math.max(lower, must, side)) * (1 - lip) * (1 - mouth);
  // (a goatee covers the chin and stops just under it: it used to run on down the throat)
  return fh === 'goatee' ? clamp(Math.max(must, lower * smooth(0.028, 0.018, ax) * (y < -0.085 ? smooth(-0.124, -0.11, y) : smooth(mY - 0.002, mY - 0.006, y)))) * (1 - lip)
    : fh === 'moustache' ? must * (1 - lip) + full * 0.25
    : full;
}

/** what face.ts' facial hair asks of a point: faceMasks()' beard, lip and mouth, the same numbers for a fraction of the
 *  work (none of the warmth, eye, wrinkle, freckle or scalp masks) */
export function beardMask(l: V3, hf: HeadFrame, look: Look) {
  const [x, y, z] = l;
  const lip = lipAt(x, y, z, hf), mouth = mouthAt(x, y, z, hf);
  return { beard: beardAt(x, y, z, hf, look, lip, mouth), lip, mouth };
}

/** faceMasks().lip alone */
export function lipMask(l: V3, hf: HeadFrame) { return lipAt(l[0], l[1], l[2], hf); }

export function faceMasks(l: V3, hf: HeadFrame, look: Look): FaceMask {
  const [x, y, z] = l, ax = Math.abs(x);
  const ex = hf.eye.x;
  const lip = lipAt(x, y, z, hf), mouth = mouthAt(x, y, z, hf);
  // warmth: cheeks, nose, ears, chin, lids
  const cheeks = g3(ax, y, z, [0.04, -0.03, 0.012], 0.018);
  const nose = g3(x, y, z, hf.nose.tip, 0.009) + 0.5 * g3(ax, y, z, [0.012, hf.nose.tip[1] - 0.006, 0.022], 0.007);
  // the ear itself: outside the side of the skull, within the ear's outline (no hard box)
  const ear = smooth(0.066, 0.076, ax) * Math.exp(-(((y + 0.016) / 0.03) ** 2) - (((z + 0.081) / 0.024) ** 2));
  const lids = g3(ax, y, z, [ex, 0.004, 0.011], 0.009);
  const neck = smooth(-0.105, -0.13, y);   // the throat and the sides of the neck below the jaw
  // (the neck carries a little warmth, continuous with the body's floor in skin.ts, so the jaw is not a mask edge)
  const red = clamp(0.55 * cheeks + 0.75 * nose + 0.7 * ear + 0.35 * lip + 0.25 * g3(x, y, z, [0, -0.098, 0.02], 0.012) + 0.3 * lids + 0.12 * neck);
  const thin = clamp(ear + 0.3 * nose);
  const blush = g3(ax, y, z, [0.042, -0.028, 0.014], 0.016);
  const beard = beardAt(x, y, z, hf, look, lip, mouth);
  const eyeA = Math.exp(-2 * (((ax - ex) / 0.02) ** 2 + ((y - 0.003) / 0.014) ** 2)) * smooth(-0.002, 0.008, z);
  // where the horizontal furrows go with age: the forehead, fading out before the temples (real lines stop at the end of
  // the brow), and a few rings round the front of the throat. The crow's feet, nasolabial folds, marionette and
  // glabellar lines and under-eye bags are per pixel in skin.ts.
  const wrink = clamp(smooth(0.028, 0.04, y) * smooth(0.078, 0.058, y) * smooth(0.0, 0.012, z) * smooth(0.064, 0.046, ax)
    + 0.35 * neck * smooth(-0.2, -0.175, y) * smooth(-0.075, -0.035, z));
  const freck = clamp(1.2 * g3(ax, y, z, [0.03, -0.022, 0.014], 0.02) + g3(x, y, z, [0, -0.02, 0.026], 0.012));
  return { red, lip, thin, blush, beard, eyeA, mouth, scalp: scalpCover(look.hair, l, 35 + 40 * hf.old, hf.male), wrink, freck };
}
