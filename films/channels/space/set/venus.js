// venus.js — Venus's cloud deck, baked (films/channels/space/set). New in episode 3. An illustration, not a map:
// soft latitude bands and the sideways "Y" swirls the ultraviolet pictures show, in pale cream-greys (the
// channel has no warm hues, so it is not the yellow of the photographs). For createPlanet({ surface }).
//
//   const tex = venusSurface({ width: 1024, seed: 3 });   // an equirectangular canvas, width × width/2
//   const venus = createPlanet({ radius, surface: tex, tilt: 177.4 - 180, pin: 1 });
const h2 = (x, y, s) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, s, wrap) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const X = (i) => ((i % wrap) + wrap) % wrap;
  const a = h2(X(xi), yi, s), b = h2(X(xi + 1), yi, s), c = h2(X(xi), yi + 1, s), d = h2(X(xi + 1), yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s, wrap, oct = 5) => { let f = 0, a = 0.5, k = 1; for (let i = 0; i < oct; i++) { f += a * vnoise(x * k, y * k, s + i * 17, wrap * k); a *= 0.5; k *= 2; } return f; };

export const venusSurface = (o = {}) => {
  const W = o.width ?? 1024, H = W / 2, seed = o.seed ?? 3;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  const hi = [0.90, 0.89, 0.84], lo = [0.62, 0.63, 0.62];
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI, sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // the "Y": bands bent into a sideways chevron by latitude, sheared by a slow drift
      const chev = Math.abs(sl) * 0.18;
      const band = Math.sin((sl * 7.0 + fbm(u * 8 + chev * 6, y / H * 4, seed, 8) * 2.2) * Math.PI);
      const n = fbm(u * 16 - chev * 10, y / H * 8, seed + 5, 16);
      let k = 0.55 + 0.22 * band + 0.35 * (n - 0.5);
      k = Math.min(1, Math.max(0, k)) * (1 - 0.18 * Math.pow(Math.abs(sl), 4));   // darker polar collars
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(255 * (lo[c] + (hi[c] - lo[c]) * k));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
};
