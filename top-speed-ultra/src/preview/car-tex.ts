// Procedural textures for the car, inside and out. Every map is generated here at load: no image files.
// Tiling surface maps are DataTextures built from typed arrays (fast); labels, dials and screens are canvases.
// Everything is cached by key, so the cockpit, the car and the traffic share one copy.
//
// Conventions: albedo maps are sRGB, everything else linear. Normal maps are tangent space (OpenGL, +y up).
// Roughness maps put roughness in G (three reads G). Anisotropy maps: RG direction (2x-1), B strength.
import * as THREE from 'three';

const cache = new Map<string, unknown>();
export function once<V>(key: string, make: () => V): V {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as V;
}

// ------------------------------------------------------------------------------------------------ noise
function hash(x: number, y: number, s: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;
// tileable value noise: period px, py in noise units
export function vnoise(x: number, y: number, px: number, py: number, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = mod(xi, px), x1 = mod(xi + 1, px), y0 = mod(yi, py), y1 = mod(yi + 1, py);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, px: number, py: number, oct: number, s = 1) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, px * f, py * f, s + i * 13); norm += amp; amp *= 0.5; f *= 2; }
  return sum / norm;
}
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// linear 0..1 to an sRGB byte
const SRGB = new Uint8Array(4096);
for (let i = 0; i < 4096; i++) { const v = i / 4095; SRGB[i] = Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
const toSrgb = (v: number) => SRGB[clamp(Math.round(v * 4095), 0, 4095)];

// ------------------------------------------------------------------------------------------------ texture plumbing
function dataTex(data: Uint8Array, w: number, h: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
export function canvasTex(c: HTMLCanvasElement, srgb = true, wrap = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
// tangent-space normals from a wrapping height field
function normals(h: Float32Array, w: number, hh: number, strength: number) {
  const d = new Uint8Array(w * hh * 4);
  for (let y = 0; y < hh; y++) {
    const yu = ((y - 1 + hh) % hh) * w, yd = ((y + 1) % hh) * w, yr = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      let nx = (h[yr + xl] - h[yr + xr]) * strength, ny = (h[yd + x] - h[yu + x]) * strength;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1); nx *= l; ny *= l;
      const i = (yr + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  return dataTex(d, w, hh, false);
}
// a grey (or tinted) albedo and a roughness map from per-pixel callbacks
function maps(n: number, fn: (x: number, y: number, o: { a: number; r: number; g: number; b: number; rough: number; h: number }) => void, strength: number, wantAlbedo = true, wantRough = true) {
  const alb = new Uint8Array(n * n * 4), rough = new Uint8Array(n * n * 4), height = new Float32Array(n * n);
  const o = { a: 0, r: -1, g: 0, b: 0, rough: 0.5, h: 0 };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    o.r = -1; fn(x, y, o);
    const i = (y * n + x) * 4;
    if (o.r < 0) { const v = toSrgb(o.a); alb[i] = alb[i + 1] = alb[i + 2] = v; } else { alb[i] = toSrgb(o.r); alb[i + 1] = toSrgb(o.g); alb[i + 2] = toSrgb(o.b); }
    alb[i + 3] = 255;
    rough[i] = rough[i + 2] = 0; rough[i + 1] = clamp(o.rough, 0, 1) * 255; rough[i + 3] = 255;
    height[y * n + x] = o.h;
  }
  return {
    map: wantAlbedo ? dataTex(alb, n, n, true) : undefined,
    roughnessMap: wantRough ? dataTex(rough, n, n, false) : undefined,
    normalMap: normals(height, n, n, strength),
  };
}
export interface SurfaceMaps { map?: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture; anisotropyMap?: THREE.Texture }

// ------------------------------------------------------------------------------------------------ carbon fibre
// 2x2 twill: each tow floats over two and under two, shifted one per row, so the weave runs in diagonals. Tows are
// rounded in section and crimp down where they dive under; filaments run along each tow. One tile = 16 tows
// (about 64 mm at 4 mm tows). The anisotropy map turns the sheen 90 degrees between warp and weft, which is what
// makes real carbon flicker as you move.
export function carbonMaps(n = 512): SurfaceMaps {
  return once('carbon' + n, () => {
    const T = n / 16;
    const aniso = new Uint8Array(n * n * 4);
    const m = maps(n, (x, y, o) => {
      const i = Math.floor(x / T), j = Math.floor(y / T), fx = x / T - i, fy = y / T - j;
      const k = mod(i - j, 4), horiz = k < 2;
      const across = horiz ? fy : fx;
      const along = horiz ? (k + fx) / 2 : (3 - k + fy) / 2;
      const round = Math.sqrt(Math.max(0, Math.sin(Math.PI * across)));
      const crimp = Math.pow(Math.max(0, Math.sin(Math.PI * along)), 0.45);
      const fib = horiz ? vnoise(x * 0.06, y * 2.2, n * 0.06, n * 2.2, 3) : vnoise(x * 2.2, y * 0.06, n * 2.2, n * 0.06, 3);
      const tone = vnoise(x * 0.02, y * 0.02, n * 0.02, n * 0.02, 5);
      o.a = 0.022 + 0.022 * round * crimp + 0.012 * fib + (horiz ? 0.004 : 0) + 0.006 * tone;
      o.rough = 0.32 + 0.16 * (1 - round) + 0.06 * fib;
      o.h = round * (0.55 + 0.45 * crimp) + fib * 0.05;
      const a = (y * n + x) * 4;
      aniso[a] = horiz ? 255 : 128; aniso[a + 1] = horiz ? 128 : 255; aniso[a + 2] = (0.25 + 0.75 * round * crimp) * 255; aniso[a + 3] = 255;
    }, 2.4);
    return { ...m, anisotropyMap: dataTex(aniso, n, n, false) };
  });
}

// ------------------------------------------------------------------------------------------------ leather
// Nappa: a fine, soft grain (a jittered cell pattern, creased at the cell edges) with faint wrinkles; optionally
// perforated in a staggered grid (about 3 mm pitch at the default 0.1 m tile). Albedo is near white so the material
// colour tints it.
export function leatherMaps(n = 512, perforated = false): SurfaceMaps {
  return once('leather' + n + perforated, () => {
    const cells = Math.round(n / 5.5), r = rng(61), pts = new Float32Array(cells * cells * 2);
    for (let i = 0; i < cells * cells; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
    const P = n / 32, hole = P * 0.17;
    return maps(n, (x, y, o) => {
      const u = (x / n) * cells, v = (y / n) * cells, ci = Math.floor(u), cj = Math.floor(v);
      let f1 = 9, f2 = 9;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ii = mod(ci + a, cells), jj = mod(cj + b, cells), q = (jj * cells + ii) * 2;
        const dx = ci + a + pts[q] - u, dy = cj + b + pts[q + 1] - v, d = dx * dx + dy * dy;
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
      const edge = clamp((Math.sqrt(f2) - Math.sqrt(f1)) * 2.2, 0, 1);
      const wr = fbm(x / n * 6, y / n * 6, 6, 6, 3, 7);
      const crease = Math.pow(Math.abs(fbm(x / n * 3, y / n * 9, 3, 9, 2, 9) - 0.5) * 2, 0.4);
      o.a = 0.86 + 0.06 * edge + 0.05 * (wr - 0.5) - 0.04 * (1 - crease);
      o.rough = 0.38 + 0.22 * (1 - edge) + 0.08 * (wr - 0.5);
      o.h = Math.sqrt(edge) * 0.7 + wr * 0.4 + crease * 0.15;
      if (perforated) {
        const j = Math.floor(y / P), ox = (j & 1) * P * 0.5;
        const hx = mod(x - ox, P) - P * 0.5, hy = mod(y, P) - P * 0.5, d = Math.sqrt(hx * hx + hy * hy);
        const holeM = 1 - sstep(hole - 0.8, hole + 0.6, d);
        const rim = Math.exp(-((d - hole - 0.8) ** 2) / 1.2);
        o.a = o.a * (1 - 0.88 * holeM); o.rough = o.rough + 0.4 * holeM; o.h = o.h - 1.6 * holeM + 0.15 * rim;
      }
    }, 1.2);
  });
}

// ------------------------------------------------------------------------------------------------ Alcantara
// microfibre suede: very fine fuzz with nap patches that turn lighter or darker as the pile lies
export function alcantaraMaps(n = 512): SurfaceMaps {
  return once('alcantara' + n, () => maps(n, (x, y, o) => {
    const fuzz = vnoise(x * 0.9, y * 0.9, n * 0.9, n * 0.9, 21) * 0.6 + vnoise(x * 0.35, y * 0.35, n * 0.35, n * 0.35, 22) * 0.4;
    const nap = fbm(x / n * 4, y / n * 4, 4, 4, 3, 23);
    o.a = 0.82 + 0.16 * (nap - 0.5) + 0.07 * (fuzz - 0.5);
    o.rough = 0.92 + 0.08 * fuzz;
    o.h = fuzz * 0.6 + nap * 0.2;
  }, 0.9));
}

// ------------------------------------------------------------------------------------------------ brushed metal
// streaks along u (x). Used with anisotropy along u for the sheen. Height is mostly across the streaks.
export function brushedMaps(n = 512): SurfaceMaps {
  return once('brushed' + n, () => maps(n, (x, y, o) => {
    const s1 = vnoise(x * 0.004, y * 1.7, n * 0.004, n * 1.7, 31), s2 = vnoise(x * 0.012, y * 0.45, n * 0.012, n * 0.45, 32);
    const s3 = vnoise(x * 0.002, y * 6.0, n * 0.002, n * 6, 33);
    const blot = fbm(x / n * 3, y / n * 3, 3, 3, 3, 34);
    o.a = 0.9 + 0.06 * (s2 - 0.5) + 0.05 * (blot - 0.5);
    o.rough = 0.2 + 0.1 * s1 + 0.08 * s3 + 0.05 * blot;
    o.h = s1 * 0.5 + s2 * 0.3 + s3 * 0.2;
  }, 1.0));
}

// soft-touch plastic grain
export function plasticMaps(n = 256): SurfaceMaps {
  return once('plastic' + n, () => maps(n, (x, y, o) => {
    const g = vnoise(x * 0.7, y * 0.7, n * 0.7, n * 0.7, 41) * 0.7 + vnoise(x * 0.23, y * 0.23, n * 0.23, n * 0.23, 42) * 0.3;
    const smear = fbm(x / n * 3, y / n * 3, 3, 3, 3, 43);
    o.a = 0.85 + 0.1 * (smear - 0.5) + 0.05 * (g - 0.5);
    o.rough = 0.62 + 0.14 * g - 0.12 * (smear - 0.5);
    o.h = g;
  }, 1.4));
}

// textured black plastic for wheel-well liners, lower trim (a coarse stipple)
export function stippleMaps(n = 256): SurfaceMaps {
  return once('stipple' + n, () => maps(n, (x, y, o) => {
    const g = vnoise(x * 0.35, y * 0.35, n * 0.35, n * 0.35, 51), d = fbm(x / n * 4, y / n * 4, 4, 4, 3, 52);
    o.a = 0.8 + 0.25 * (d - 0.5); o.rough = 0.8 + 0.15 * g; o.h = g;
  }, 2.6));
}

// carpet: dense pile
export function carpetMaps(n = 256): SurfaceMaps {
  return once('carpet' + n, () => maps(n, (x, y, o) => {
    const g = vnoise(x * 1.1, y * 1.1, n * 1.1, n * 1.1, 61), d = fbm(x / n * 5, y / n * 5, 5, 5, 3, 62);
    o.a = 0.75 + 0.3 * (g - 0.5) + 0.2 * (d - 0.5); o.rough = 1; o.h = g;
  }, 2.0));
}

// ------------------------------------------------------------------------------------------------ paint finishes
// orange peel for clear coats: very soft, low amplitude
export function peelNormal(n = 256): THREE.Texture {
  return once('peel' + n, () => {
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = fbm(x / n * 24, y / n * 24, 24, 24, 2, 71);
    return normals(h, n, n, 0.35);
  });
}

// ------------------------------------------------------------------------------------------------ tyres
// u around the tyre, v across its section (0 outer bead .. 1 inner bead). treadV is where the tread sits in v.
// Shoulder slots cross the tread edges; the sidewall has fine mould rings and a satin finish, and road dust settles
// on the lower sidewall and in the grooves. No lettering.
export function tyreMaps(n: number, treadV: [number, number], slots = 72): SurfaceMaps {
  return once('tyre' + n + treadV.join(), () => {
    const w = n, h = n / 4, alb = new Uint8Array(w * h * 4), rough = new Uint8Array(w * h * 4), height = new Float32Array(w * h);
    const [t0, t1] = treadV, tw = t1 - t0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = (y + 0.5) / h;
      let a = 0.032, r = 0.82, hh = 0;
      const dust = fbm(u * 40, v * 3, 40, 3, 3, 81);
      if (v > t0 && v < t1) {
        const q = (v - t0) / tw;                                       // 0..1 across the tread
        const sh = Math.min(q, 1 - q);                                 // distance to the nearer shoulder
        const slotU = mod(u * slots + (q < 0.5 ? 0 : 0.5), 1);
        const slot = sh < 0.2 ? (1 - sstep(0.06, 0.1, Math.abs(slotU - 0.5))) * (1 - sstep(0.13, 0.2, sh)) : 0;
        const sipe = sh > 0.2 && sh < 0.4 ? (1 - sstep(0.02, 0.035, Math.abs(mod(u * slots * 2 + q * 3, 1) - 0.5))) * 0.6 : 0;
        hh = -slot - sipe * 0.5 + (vnoise(x * 0.5, y * 0.5, w * 0.5, h * 0.5, 82) - 0.5) * 0.1;
        a = 0.042 + 0.02 * dust - 0.012 * slot;                          // scrubbed rubber reads a touch lighter
        r = 0.86 - 0.08 * (1 - sh * 2) + 0.1 * slot;
      } else {
        const side = v < t0 ? v / t0 : (1 - v) / (1 - t1);             // 0 at the bead, 1 at the shoulder
        const ring = Math.sin(side * 160) * 0.08 + (Math.abs(side - 0.18) < 0.02 ? 0.6 : 0);
        hh = ring + vnoise(x * 0.3, y * 0.6, w * 0.3, h * 0.6, 83) * 0.05;
        a = 0.03 + 0.03 * dust * sstep(0.5, 0.1, side) + 0.01 * dust;
        r = 0.68 + 0.12 * dust;
      }
      const i = (y * w + x) * 4;
      const al = toSrgb(a); alb[i] = toSrgb(a * 1.04); alb[i + 1] = al; alb[i + 2] = toSrgb(a * 0.94); alb[i + 3] = 255;
      rough[i] = rough[i + 2] = 0; rough[i + 1] = clamp(r, 0, 1) * 255; rough[i + 3] = 255;
      height[y * w + x] = hh;
    }
    const map = dataTex(alb, w, h, true), roughnessMap = dataTex(rough, w, h, false);
    map.wrapT = roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
    const normalMap = normals(height, w, h, 3);
    normalMap.wrapT = THREE.ClampToEdgeWrapping;
    return { map, roughnessMap, normalMap };
  });
}

// ------------------------------------------------------------------------------------------------ brake disc
// carbon-ceramic: u around, v from inner to outer radius of the friction ring. A grey matrix with dark fibre
// flecks, pad scoring in rings, and cross-drilled holes in curved rows.
export function discMaps(n = 512, holes = 24): SurfaceMaps {
  return once('disc' + n, () => {
    const w = n, h = n / 4;
    const alb = new Uint8Array(w * h * 4), rough = new Uint8Array(w * h * 4), height = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const fleck = vnoise(x * 0.5, y * 0.9, w * 0.5, h * 0.9, 91), blot = fbm(u * 30, v * 4, 30, 4, 3, 92);
      const score = vnoise(x * 0.004, y * 3.5, w * 0.004, h * 3.5, 93);
      let a = 0.075 + 0.05 * blot - (fleck > 0.72 ? 0.04 : 0) + 0.015 * score, r = 0.55 + 0.15 * score + 0.1 * fleck, hh = score * 0.3 + fleck * 0.2;
      // three rows of holes, each row shifted along the curve
      for (let row = 0; row < 3; row++) {
        const rv = 0.25 + row * 0.25, ru = mod(u * holes + row / 3 + (v - rv) * 1.2, 1) - 0.5;
        const dx = ru * (w / holes), dy = (v - rv) * h, d = Math.sqrt(dx * dx + dy * dy);
        const hr = h * 0.055;
        if (d < hr + 1.5) { const m = 1 - sstep(hr - 0.8, hr + 0.8, d); a = a * (1 - m) + 0.006 * m; r = r * (1 - m) + m; hh -= m * 1.5; }
      }
      const i = (y * w + x) * 4, s = toSrgb(a);
      alb[i] = s; alb[i + 1] = s; alb[i + 2] = toSrgb(a * 1.05); alb[i + 3] = 255;
      rough[i] = rough[i + 2] = 0; rough[i + 1] = clamp(r, 0, 1) * 255; rough[i + 3] = 255;
      height[y * w + x] = hh;
    }
    const map = dataTex(alb, w, h, true), roughnessMap = dataTex(rough, w, h, false), normalMap = normals(height, w, h, 1.6);
    for (const t of [map, roughnessMap, normalMap]) t.wrapT = THREE.ClampToEdgeWrapping;
    return { map, roughnessMap, normalMap };
  });
}

// ------------------------------------------------------------------------------------------------ grille mesh
// a honeycomb: alpha cut-out holes, bars rounded in the normal map
export function honeycombMaps(n = 256, cellsAcross = 8): SurfaceMaps & { alphaMap: THREE.Texture } {
  return once('honey' + n + cellsAcross, () => {
    const al = new Uint8Array(n * n * 4), height = new Float32Array(n * n);
    const s = n / cellsAcross;              // cell pitch in px (x); hex rows are sqrt(3)/2 * s apart
    const rowH = s * Math.sqrt(3) / 2, rows = Math.round(n / rowH), ry = n / rows;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      // nearest hex centre (two candidate rows)
      let best = 1e9;
      const j0 = Math.floor(y / ry);
      for (let dj = -1; dj <= 1; dj++) {
        const j = j0 + dj, cy = (j + 0.5) * ry, off = (mod(j, 2)) * s * 0.5;
        const i0 = Math.round((x - off) / s - 0.5);
        for (let di = -1; di <= 1; di++) {
          const cx = (i0 + di + 0.5) * s + off, dx = x - cx, dy = y - cy;
          // hex distance (pointy-top)
          const ax = Math.abs(dx), ay = Math.abs(dy) * (s / ry) * Math.sqrt(3) / 2;
          const hd = Math.max(ax, ax * 0.5 + ay * 0.866);
          if (hd < best) best = hd;
        }
      }
      const edge = s * 0.5 - best;                    // px to the cell wall
      const bar = 1 - sstep(s * 0.06, s * 0.12, edge);
      const i = (y * n + x) * 4;
      al[i] = al[i + 1] = al[i + 2] = bar * 255; al[i + 3] = 255;
      height[y * n + x] = bar * (0.5 + 0.5 * Math.cos(Math.min(1, edge / (s * 0.12)) * Math.PI * 0.5));
    }
    const alphaMap = dataTex(al, n, n, false);
    return { alphaMap, normalMap: normals(height, n, n, 4) };
  });
}

// ------------------------------------------------------------------------------------------------ stitching
// thread on a transparent strip: one stitch per 1/8 of u, a twisted lighter centre and a hole either end
export function stitchTex(): THREE.Texture {
  return once('stitch', () => {
    const [c, g] = canvas(256, 32);
    g.clearRect(0, 0, 256, 32);
    for (let i = 0; i < 8; i++) {
      const x0 = i * 32 + 5, x1 = i * 32 + 27;
      const gr = g.createLinearGradient(0, 6, 0, 26); gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x0 + 4, 7); g.lineTo(x1 - 4, 7); g.quadraticCurveTo(x1, 16, x1 - 4, 25); g.lineTo(x0 + 4, 25); g.quadraticCurveTo(x0, 16, x0 + 4, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2;
      for (let k = x0 + 3; k < x1 - 2; k += 4) { g.beginPath(); g.moveTo(k, 8); g.lineTo(k + 4, 24); g.stroke(); }
    }
    const t = canvasTex(c, true, true); t.wrapT = THREE.ClampToEdgeWrapping; return t;
  });
}

// ------------------------------------------------------------------------------------------------ glass dust
// the inside of a windscreen in October: a light film of dust and haze, specks, a smear or two, and the two wiper
// sweeps cleaner than the rest on the outside, with a line of grime where each sweep ends. u across (0..1 = wM
// metres), v from the base (0) up to the header (1 = hM metres). Pivots are given in metres from the base's left end.
export function windscreenDust(w: number, h: number, wM: number, hM: number, pivots: [number, number][], arm: number): THREE.Texture {
  return once('dust' + w, () => {
    const [c, g] = canvas(w, h), img = g.createImageData(w, h), d = img.data, r = rng(101);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const vy = (h - 1 - y) / h * hM, vx = x / w * wM;
      let a = 0.1 + 0.16 * fbm(x / w * 5, y / h * 4, 5, 4, 4, 102);
      // the wiper sweeps (outside): cleaner inside the arc, a grime line at its edge
      let inSweep = 0, edge = 0;
      for (const [cx, cy] of pivots) {
        const dd = Math.hypot(vx - cx, vy - cy);
        if (vy > cy) { inSweep = Math.max(inSweep, 1 - sstep(arm - 0.03, arm + 0.01, dd)); edge = Math.max(edge, Math.exp(-(((dd - arm - 0.012) / 0.01) ** 2))); }
      }
      a = a * (1 - 0.55 * inSweep) + 0.22 * edge * (0.5 + fbm(x / w * 30, y / h * 20, 30, 20, 2, 103));
      // haze builds toward the base, where the defrost air doesn't reach and the dash outgasses
      a += 0.12 * sstep(0.35, 0, vy / hM);
      a *= 0.75 + 0.5 * fbm(x / w * 12, y / h * 9, 12, 9, 3, 104);
      const i = (y * w + x) * 4;
      d[i] = 236; d[i + 1] = 228; d[i + 2] = 214; d[i + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(img, 0, 0);
    // specks and a couple of finger smears
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(250,244,230,${0.2 + r() * 0.5})`; const s = 0.6 + r() * 1.6; g.fillRect(r() * w, r() * h, s, s); }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {
      const x0 = w * (0.15 + r() * 0.7), y0 = h * (0.55 + r() * 0.35);
      g.strokeStyle = 'rgba(240,235,225,0.10)'; g.lineWidth = 10 + r() * 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + 30, y0 + 10, x0 + 50 + r() * 40, y0 + 30); g.stroke();
    }
    const t = canvasTex(c, true); return t;
  });
}

// ------------------------------------------------------------------------------------------------ contact shadow
// the soft dark patch under a car: a blurred rounded footprint plus darker pads under the tyres. Footprint in metres.
export function contactShadow(len: number, wid: number, wheels: [number, number][]): THREE.Texture {
  return once('cshadow' + len + wid, () => {
    const W = 256, H = 512, [c, g] = canvas(W, H), sx = W / (wid + 1.2), sz = H / (len + 1.2);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const cx = W / 2, cz = H / 2;
    const blob = (blur: number, a: number, w: number, l: number, r: number) => {
      g.filter = `blur(${blur}px)`; g.fillStyle = `rgba(255,255,255,${a})`;
      const x = cx - (w / 2) * sx, y = cz - (l / 2) * sz;
      g.beginPath(); g.roundRect(x, y, w * sx, l * sz, r * sx); g.fill();
    };
    blob(18, 0.45, wid + 0.1, len + 0.15, 0.4);
    blob(8, 0.55, wid - 0.15, len - 0.3, 0.3);
    for (const [x, z] of wheels) { g.filter = 'blur(5px)'; g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(cx + x * sx, cz + z * sz, 0.16 * sx, 0.3 * sz, 0, 0, Math.PI * 2); g.fill(); }
    g.filter = 'none';
    return canvasTex(c, false);
  });
}

// ------------------------------------------------------------------------------------------------ the R badge
// our make's mark: a yellow enamel disc with a black italic R, in a thin bright ring
export function badgeTex(n = 256, brand: 'rossini' | 'vela' = 'rossini'): THREE.Texture {
  if (brand === 'vela') return once('badgeV' + n, () => {
    // Vela: a deep blue-black enamel disc, a satin silver ring and a V drawn as two sails
    const [c, g] = canvas(n, n), h = n / 2;
    const gr = g.createRadialGradient(h * 0.75, h * 0.7, 0, h, h, h);
    gr.addColorStop(0, '#22324a'); gr.addColorStop(1, '#0a0f18');
    g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c9ced6'; g.lineWidth = n * 0.05; g.beginPath(); g.arc(h, h, h * 0.88, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e6e9ee';
    g.beginPath(); g.moveTo(h - n * 0.27, h - n * 0.2); g.lineTo(h - n * 0.04, h + n * 0.27); g.lineTo(h - n * 0.01, h + n * 0.08); g.lineTo(h - n * 0.15, h - n * 0.2); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(h + n * 0.27, h - n * 0.2); g.lineTo(h + n * 0.04, h + n * 0.27); g.lineTo(h + n * 0.01, h + n * 0.08); g.lineTo(h + n * 0.15, h - n * 0.2); g.closePath(); g.fill();
    return canvasTex(c, true);
  });
  return once('badge' + n, () => {
    const [c, g] = canvas(n, n), h = n / 2;
    const gr = g.createRadialGradient(h * 0.8, h * 0.7, 0, h, h, h);
    gr.addColorStop(0, '#ffd84a'); gr.addColorStop(1, '#e0a810');
    g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#141414'; g.lineWidth = n * 0.035; g.beginPath(); g.arc(h, h, h * 0.86, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#121212'; g.font = `italic 800 ${n * 0.6}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('R', h + n * 0.02, h + n * 0.04);
    return canvasTex(c, true);
  });
}

// a wordmark decal: spaced capitals on transparent (chrome letters are tinted by the material)
export function wordmarkTex(text: string, w = 1024, h = 128, colour = '#ffffff'): THREE.Texture {
  return once('word' + text + w + colour, () => {
    const [c, g] = canvas(w, h);
    g.clearRect(0, 0, w, h);
    g.fillStyle = colour; g.font = `600 ${h * 0.62}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const letters = text.split(''), sp = w / (letters.length + 1);
    letters.forEach((ch, i) => g.fillText(ch, sp * (i + 1), h * 0.54));
    return canvasTex(c, true);
  });
}
