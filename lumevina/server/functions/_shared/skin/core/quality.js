// GENERATED from js/skin/core/quality.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — on-device image checks (shared)
 *
 * Fast, advisory checks the capture screen runs on a downscaled frame before
 * anything is uploaded: is it sharp, is it exposed sensibly, is there a
 * strong colour cast. They prompt a retake; they never decide whether an
 * image is usable for measurement. The worker's checks (worker/
 * lumevina_skin/quality.py) are the authoritative ones, on the original.
 *
 * Input: { data: Uint8ClampedArray RGBA, width, height } (an ImageData).
 */

export const QUALITY_VERSION = "device-1";

/* Thresholds for a ~512 px wide frame. Sharpness is a low floor only: how
 * sharp skin looks depends mostly on how much texture it has (very smooth,
 * perfectly sharp skin scores ~25, a slightly blurred frame ~1), so the
 * capture screen also compares each frame with the sharpest it has seen in
 * the last moments (referenceSharpness) — the way autofocus assist works.
 * Tuned on synthetic sharp/blurred pairs and on all ten Monk Skin Tone scale colours in
 * tests/unit/quality.test.mjs: no skin tone, from the lightest to the
 * deepest, is flagged as badly exposed or tinted. Exposure is judged by
 * clipping, not by how light the skin is; colour by excess beyond the
 * natural range of skin, not by distance from one "typical" skin colour.
 * The worker re-checks every image. */
export const LIMITS = { sharpness: 5, relative: 0.5, clipDark: 0.08, clipBright: 0.06, meanLow: 0.05, meanHigh: 0.97, cast: 0.05 };

function luminance(img) {
  const { data, width, height } = img;
  const L = new Float32Array(width * height);
  for (let i = 0, p = 0; p < L.length; p++, i += 4) L[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return L;
}

/** Variance of the 4-neighbour Laplacian of luminance: low means blurred or out of focus. */
export function sharpness(img, L = luminance(img)) {
  const { width: w, height: h } = img;
  let n = 0, sum = 0, sum2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = L[i - w] + L[i + w] + L[i - 1] + L[i + 1] - 4 * L[i];
      sum += v; sum2 += v * v; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

/** Share of near-black and near-white pixels, and mean lightness 0–1. */
export function exposure(img, L = luminance(img)) {
  let dark = 0, bright = 0, total = 0;
  for (let i = 0; i < L.length; i++) { const v = L[i]; total += v; if (v < 10) dark++; else if (v > 250) bright++; }
  return { clip_dark: dark / L.length, clip_bright: bright / L.length, mean_l: total / L.length / 255 };
}

/**
 * Colour cast: how far the frame's average colour sits OUTSIDE the range
 * every skin tone falls in (0 inside it). Across the Monk scale, blue/green
 * runs about 0.68–0.96 and green against the red–blue average about
 * 0.88–1.04; a blue shade, an orange bulb or a green fluorescent tube pushes
 * past those. Red/green is not used: it varies too much with skin tone to
 * separate warmth of skin from warmth of light.
 */
export function colorCast(img) {
  const { data } = img;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  if (!g) return 0;
  const bg = b / g, gm = g / ((r + b) / 2 || 1);
  return Math.max(0, Math.abs(bg - 0.82) / 0.82 - 0.18, Math.abs(gm - 0.96) / 0.96 - 0.085);
}

/** All checks, with flags and a short message for each problem. */
export function assessFrame(img, limits = LIMITS, { referenceSharpness = null } = {}) {
  const L = luminance(img);
  const s = sharpness(img, L);
  const e = exposure(img, L);
  const cast = colorCast(img);
  const flags = [], tips = [];
  const floor = referenceSharpness ? Math.max(limits.sharpness, limits.relative * referenceSharpness) : limits.sharpness;
  if (s < floor) { flags.push("blur"); tips.push("Hold still and tap to focus"); }
  if (e.clip_dark > limits.clipDark || e.mean_l < limits.meanLow) { flags.push("underexposed"); tips.push("More light, please: face the light"); }
  if (e.clip_bright > limits.clipBright || e.mean_l > limits.meanHigh) { flags.push("overexposed"); tips.push("Too bright: step back from the light or turn off the flash"); }
  if (cast > limits.cast) { flags.push("color_cast"); tips.push("The light is tinted: use the studio light or daylight"); }
  return {
    version: QUALITY_VERSION, ok: flags.length === 0, flags, tips,
    metrics: { sharpness: Math.round(s * 10) / 10, clip_dark: round3(e.clip_dark), clip_bright: round3(e.clip_bright), mean_l: round3(e.mean_l), cast: round3(cast) },
  };
}
const round3 = (v) => Math.round(v * 1000) / 1000;
