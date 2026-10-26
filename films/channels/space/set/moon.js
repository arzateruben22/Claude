// moon.js — the Moon's surface, baked (films/channels/space/set). New in episode 4. An illustration, not a map:
// grey highlands, darker maria placed roughly where the near side's are (Imbrium, Serenitatis, Tranquillitatis,
// Fecunditatis, Nubium, Procellarum), and a speckle of craters. Neutral greys only. For createPlanet({ surface }).
// The highland and crater noise is sampled on the unit sphere (26 Oct), so nothing pinches at the poles.
//
//   const moon = createPlanet({ radius, surface: moonSurface({ width: 512, seed: 9 }) });
const h2 = (x, y, s) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, s, wrap) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const X = (i) => ((i % wrap) + wrap) % wrap;
  const a = h2(X(xi), yi, s), b = h2(X(xi + 1), yi, s), c = h2(X(xi), yi + 1, s), d = h2(X(xi + 1), yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s, wrap, oct = 5) => { let f = 0, a = 0.5, k = 1; for (let i = 0; i < oct; i++) { f += a * vnoise(x * k, y * k, s + i * 17, wrap * k); a *= 0.5; k *= 2; } return f; };
// 3D value noise on the unit sphere (no pinch at the poles, no seam): for the highland texture and the craters
const h3 = (x, y, z, s) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1440662683) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise3 = (x, y, z, s) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = (q) => q * q * (3 - 2 * q), u = f(x - xi), v = f(y - yi), w = f(z - zi);
  const L = (a, b, k) => a + (b - a) * k, c = (i, j, k) => h3(xi + i, yi + j, zi + k, s);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
};
const fbm3 = (x, y, z, s, oct = 5) => { let f = 0, a = 0.5, k = 1; for (let i = 0; i < oct; i++) { f += a * vnoise3(x * k, y * k, z * k, s + i * 17); a *= 0.5; k *= 2; } return f; };
// maria: [longitude, latitude, radius] in degrees (near side centred on longitude 0)
const MARIA = [[-16, 33, 15], [17, 28, 9], [31, 9, 10], [51, -5, 8], [-17, -20, 9], [-50, 12, 20], [-38, 30, 9], [60, 16, 6]];

export const moonSurface = (o = {}) => {
  const W = o.width ?? 512, H = W / 2, seed = o.seed ?? 9;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * 360 - 180;
      let mare = 0;
      for (const [mx, my, mr] of MARIA) {
        const dl = ((lon - mx + 540) % 360) - 180, dd = Math.hypot(dl * Math.cos((lat * Math.PI) / 180), lat - my);
        mare = Math.max(mare, 1 - Math.min(1, Math.max(0, (dd - mr * 0.75) / (mr * 0.5))));
      }
      const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180, px = Math.cos(la) * Math.cos(lo), py = Math.sin(la), pz = Math.cos(la) * Math.sin(lo);
      mare *= 0.75 + 0.5 * fbm3(px * 4 + 7, py * 4 + 7, pz * 4 + 7, seed + 3);
      const n = fbm3(px * 8 + 7, py * 8 + 7, pz * 8 + 7, seed), cr = Math.pow(vnoise3(px * 30 + 7, py * 30 + 7, pz * 30 + 7, seed + 9), 6);
      let k = 0.72 + 0.18 * (n - 0.5) - 0.32 * Math.min(1, mare) + 0.25 * cr;
      k = Math.min(1, Math.max(0, k));
      const i = (y * W + x) * 4, v = Math.round(255 * (0.18 + 0.62 * k));
      d[i] = v; d[i + 1] = v; d[i + 2] = Math.round(v * 1.01); d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
};
