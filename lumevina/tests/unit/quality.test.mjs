// The on-device capture checks, on synthetic frames with known faults.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessFrame, sharpness, LIMITS } from "../../js/skin/core/quality.js";

// a deterministic pseudo-random generator, so the frames are the same every run
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* A skin-toned frame with fine texture and a few pore-sized dark dots. */
function skinFrame(w = 512, h = 384, { r = 205, g = 160, b = 135, noise = 9, seed = 7 } = {}) {
  const rand = rng(seed);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const n = (rand() - 0.5) * 2 * noise;
    data[p * 4] = r + n; data[p * 4 + 1] = g + n * 0.9; data[p * 4 + 2] = b + n * 0.8; data[p * 4 + 3] = 255;
  }
  for (let k = 0; k < 120; k++) {
    const cx = Math.floor(rand() * w), cy = Math.floor(rand() * h);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w || y >= h || dx * dx + dy * dy > 4) continue;
      const i = (y * w + x) * 4; data[i] -= 35; data[i + 1] -= 30; data[i + 2] -= 25;
    }
  }
  return { data, width: w, height: h };
}

function boxBlur(img, radius) {
  const { width: w, height: h } = img;
  let src = img.data;
  for (let pass = 0; pass < 3; pass++) {
    const out = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let d = -radius; d <= radius; d++) { const xx = Math.min(w - 1, Math.max(0, x + d)); s += src[(y * w + xx) * 4 + c]; n++; }
      out[(y * w + x) * 4 + c] = s / n;
    }
    const out2 = new Uint8ClampedArray(src.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let d = -radius; d <= radius; d++) { const yy = Math.min(h - 1, Math.max(0, y + d)); s += out[(yy * w + x) * 4 + c]; n++; }
      out2[(y * w + x) * 4 + c] = s / n;
    }
    src = out2;
  }
  return { data: src, width: w, height: h };
}

const scale = (img, f, add = [0, 0, 0]) => {
  const data = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < data.length; i += 4) { data[i] = img.data[i] * f + add[0]; data[i + 1] = img.data[i + 1] * f + add[1]; data[i + 2] = img.data[i + 2] * f + add[2]; data[i + 3] = 255; }
  return { data, width: img.width, height: img.height };
};

test("a sharp, evenly lit skin frame passes", () => {
  const r = assessFrame(skinFrame());
  assert.deepEqual(r.flags, [], JSON.stringify(r.metrics));
});

test("blur drops sharpness well below the limit, and is flagged", () => {
  const sharp = sharpness(skinFrame()), soft = sharpness(boxBlur(skinFrame(), 2));
  assert.ok(sharp > LIMITS.sharpness * 4, `sharp ${sharp}`);
  assert.ok(soft < LIMITS.sharpness, `blurred ${soft}`);
  assert.ok(assessFrame(boxBlur(skinFrame(), 2)).flags.includes("blur"));
});

test("very smooth but sharp skin is not called blurred; a frame half as sharp as the recent best is", () => {
  assert.ok(!assessFrame(skinFrame(512, 384, { noise: 2 })).flags.includes("blur"));
  const best = sharpness(skinFrame());
  assert.ok(assessFrame(boxBlur(skinFrame(), 1), LIMITS, { referenceSharpness: best }).flags.includes("blur"));
  assert.ok(!assessFrame(skinFrame(512, 384, { seed: 9 }), LIMITS, { referenceSharpness: best }).flags.includes("blur"));
});

test("dark and blown-out frames are flagged", () => {
  assert.ok(assessFrame(scale(skinFrame(), 0.04)).flags.includes("underexposed"));
  assert.ok(assessFrame(scale(skinFrame(), 1.6, [40, 40, 40])).flags.includes("overexposed"));
});

// The Monk Skin Tone scale's ten reference colours (Google, CC BY 4.0), lightest to deepest.
const MONK = [[246, 237, 228], [243, 231, 219], [247, 234, 208], [234, 218, 186], [215, 189, 150],
  [160, 126, 86], [130, 92, 67], [96, 65, 52], [58, 49, 42], [41, 36, 32]];

test("no skin tone on the Monk scale is flagged as badly exposed or tinted", () => {
  MONK.forEach(([r, g, b], i) => {
    const res = assessFrame(skinFrame(512, 384, { r, g, b, noise: 6, seed: 11 + i }));
    const wrong = res.flags.filter((f) => f !== "blur");
    assert.deepEqual(wrong, [], `Monk ${i + 1} (${r},${g},${b}) flagged ${wrong} ${JSON.stringify(res.metrics)}`);
  });
});

test("blue shade, an orange bulb and green fluorescent light are flagged as casts", () => {
  const base = skinFrame(512, 384, { r: 215, g: 189, b: 150, noise: 6 });
  assert.ok(assessFrame(scale(base, 1, [0, -30, 60])).flags.includes("color_cast"), "blue");
  const warm = { data: base.data.map((v, i) => (i % 4 === 0 ? v * 1.1 : i % 4 === 1 ? v * 0.95 : i % 4 === 2 ? v * 0.6 : 255)), width: base.width, height: base.height };
  assert.ok(assessFrame(warm).flags.includes("color_cast"), "orange");
  assert.ok(assessFrame(scale(base, 1, [0, 30, 0])).flags.includes("color_cast"), "green");
});
