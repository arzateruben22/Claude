// Where things are on a face and body, as soft masks in the head's frame: lips, the mouth's interior, warm areas,
// blush, beard and stubble, the eye area, wrinkles (forehead, crow's feet, neck rings), freckles, and the scalp under
// each hairstyle.
import { V3, clamp, smooth } from './math';
import { HeadFrame } from './head';
import { HairStyle, Look } from './params';

const g3 = (x: number, y: number, z: number, c: V3, r: number) => Math.exp(-((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2) / (r * r));

/** the scalp under a hairstyle: 1 where hair grows (head-local) */
export function scalpCover(style: HairStyle, l: V3, age: number, male: boolean) {
  if (style === 'bald') return 0;
  const [x, y, z] = l, ax = Math.abs(x);
  const phi = Math.abs(Math.atan2(x, z + 0.06));   // 0 front .. pi back, about the skull's centre
  const K: [number, number][] = [[0, 0.064], [0.55, 0.06], [0.95, 0.047], [1.25, 0.012], [1.55, -0.004], [1.85, -0.01], [2.3, -0.05], [3.15, -0.078]];
  let yH = K[K.length - 1][1];
  for (let i = 0; i < K.length - 1; i++) if (phi <= K[i + 1][0]) { const t = (phi - K[i][0]) / (K[i + 1][0] - K[i][0]); yH = K[i][1] + (K[i + 1][1] - K[i][1]) * t; break; }
  if (!male) yH -= 0.003 * smooth(0.4, 0.9, phi);
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

export function faceMasks(l: V3, hf: HeadFrame, look: Look): FaceMask {
  const [x, y, z] = l, ax = Math.abs(x), F = hf.face, mY = hf.mouth.y, mw = 0.026 * F.mouthW;
  const ex = hf.eye.x;
  // lips: the vermilion above and below the slit, plus their wet inner faces
  const xr = clamp(1 - (x / mw) ** 2);
  const hU = 0.0072 * F.lipUpper * Math.pow(xr, 0.55), hL = 0.0088 * F.lipLower * Math.pow(xr, 0.6);
  const front = smooth(0.006, 0.012, z);
  const inU = y >= mY ? smooth(hU + 0.0008, hU - 0.0008, y - mY) : 0;
  const inL = y < mY ? smooth(hL + 0.0008, hL - 0.0008, mY - y) : 0;
  const lip = clamp((inU + inL) * front * smooth(mw + 0.001, mw - 0.002, ax));
  const inMouth = (x / 0.0225) ** 2 + ((y - mY + 0.001) / 0.0125) ** 2 + (z / 0.0185) ** 2 < 1.15;
  const mouth = inMouth ? smooth(0.0175, 0.0115, z) : 0;
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
  // beard and stubble
  const fh = look.facialHair;
  let beard = 0;
  if (hf.male) {
    const yLine = -0.035 - 0.02 * clamp((0.05 - ax) / 0.025);
    const lower = smooth(yLine + 0.004, yLine - 0.004, y) * (z > -0.078 ? 1 : smooth(-0.088, -0.078, z)) * smooth(0.074, 0.068, ax);
    const must = ax < 0.03 && y > mY + 0.003 && y < -0.046 && z > 0.008 ? smooth(0.03, 0.022, ax) * smooth(mY + 0.003, mY + 0.006, y) * smooth(-0.046, -0.049, y) : 0;
    const neck = y < -0.1 ? smooth(-0.155, -0.12, y) * (z > -0.065 ? 1 : 0) : 1;
    const side = ax > 0.052 && y > -0.045 && y < 0.002 && z > -0.075 && z < -0.042 ? smooth(0.002, -0.006, y) : 0;
    const full = clamp(Math.max(lower * neck, must, side)) * (1 - lip) * (1 - mouth);
    // (a goatee covers the chin and stops just under it: it used to run on down the throat)
    beard = fh === 'goatee' ? clamp(Math.max(must, lower * smooth(0.028, 0.018, ax) * (y < -0.085 ? smooth(-0.124, -0.11, y) : smooth(mY - 0.002, mY - 0.006, y)))) * (1 - lip)
      : fh === 'moustache' ? must * (1 - lip) + full * 0.25
      : full;
  }
  const eyeA = Math.exp(-2 * (((ax - ex) / 0.02) ** 2 + ((y - 0.003) / 0.014) ** 2)) * smooth(-0.002, 0.008, z);
  // where the horizontal furrows go with age: the forehead, fading out before the temples (real lines stop at the end of
  // the brow), and a few rings round the front of the throat. The crow's feet, nasolabial folds, marionette and
  // glabellar lines and under-eye bags are per pixel in skin.ts.
  const wrink = clamp(smooth(0.028, 0.04, y) * smooth(0.078, 0.058, y) * smooth(0.0, 0.012, z) * smooth(0.064, 0.046, ax)
    + 0.35 * neck * smooth(-0.2, -0.175, y) * smooth(-0.075, -0.035, z));
  const freck = clamp(1.2 * g3(ax, y, z, [0.03, -0.022, 0.014], 0.02) + g3(x, y, z, [0, -0.02, 0.026], 0.012));
  return { red, lip, thin, blush, beard, eyeA, mouth, scalp: scalpCover(look.hair, l, 35 + 40 * hf.old, hf.male), wrink, freck };
}
