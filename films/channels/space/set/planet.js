// planet.js — B2, a planet (films/channels/space/set): a sphere with a baked surface, a terminator, a
// Fresnel rim and an optional teal meridian pin that shows spin. Lit by one key light, its star, whose
// direction and strength the scene passes each seek (so a star that has vanished can keep lighting a
// planet until the news arrives: front.js seen()/retarded()), plus a 4% night fill so the dark side keeps
// its shape, and a faint diagram rim so a planet in the dark still reads.
//
//   const earth = createPlanet({ radius: 0.42, surface: earthSurface(), tilt: 23.44 });
//   group.add(earth.group);
//   earth.set({ center, sunDir: [x, y, z] (world, toward the star), sun: 0..1, spin: radians, camera });
//
// earthSurface(o) bakes an equirectangular map on a canvas (deterministic: hash noise and a coarse
// hand-drawn coastline of the real continents, lon/lat in degrees; good at diagram sizes and on a phone
// close-up, not a map). Keep the canvas size modest; it is baked once per page.
import * as THREE from "three";
import { tok } from "./look.js";

const VS = /* glsl */ `
  varying vec3 vNw; varying vec3 vVw; varying vec2 vUv;
  void main(){
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vNw = normalize(mat3(modelMatrix) * normal);
    vVw = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FS = /* glsl */ `
  uniform sampler2D uMap; uniform vec3 uSunDir; uniform float uSun, uFill, uRimDay, uRimNight, uPin;
  uniform vec3 uRimCol, uNightRim, uFillCol, uPinCol; uniform float uPinLon;
  varying vec3 vNw; varying vec3 vVw; varying vec2 vUv;
  void main(){
    vec3 n = normalize(vNw), v = normalize(vVw), l = normalize(uSunDir);
    vec3 alb = texture2D(uMap, vUv).rgb;
    float ndl = dot(n, l);
    float day = smoothstep(-0.06, 0.18, ndl) * max(ndl, 0.0) * 1.25 + smoothstep(-0.12, 0.06, ndl) * 0.04;
    float fr = pow(1.0 - max(dot(n, v), 0.0), 2.6);
    vec3 c = alb * (day * uSun + uFill) * 1.0 + uFillCol * uFill;
    c += uRimCol * fr * uRimDay * uSun * smoothstep(-0.25, 0.35, ndl);
    c += uNightRim * fr * uRimNight;
    if (uPin > 0.0) {                         // the meridian pin: a thin line at one longitude
      float d = abs(fract(vUv.x - uPinLon + 0.5) - 0.5);
      float w = fwidth(vUv.x) * 1.5;
      c = mix(c, uPinCol, (1.0 - smoothstep(w, w * 2.0, d)) * uPin);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

export const createPlanet = (o = {}) => {
  const group = new THREE.Group(), spin = new THREE.Group();
  group.add(spin);
  const tex = o.surface ? new THREE.CanvasTexture(o.surface) : null;
  // anisotropy 1: SwiftShader's anisotropic filtering carries state between draws, so a frame's last bit can
  // depend on which frames were sought before it (measured on Rest Frame's felt; see physics/set/props.js)
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 1; tex.needsUpdate = true; }
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSun: { value: 1 }, uFill: { value: o.fill ?? 0.035 },
      uRimDay: { value: o.rimDay ?? 0.55 }, uRimNight: { value: o.rimNight ?? 0.1 },
      uRimCol: { value: new THREE.Vector3(...tok("ice")).multiplyScalar(o.rimScale ?? 0.4) }, uNightRim: { value: new THREE.Vector3(...tok("text-2")) },
      uFillCol: { value: new THREE.Vector3(0.05, 0.06, 0.12) }, uPin: { value: o.pin ?? 0 }, uPinCol: { value: new THREE.Vector3(...tok("teal")) }, uPinLon: { value: 0 },
    },
    vertexShader: VS, fragmentShader: FS,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, o.segments ?? 96, Math.round((o.segments ?? 96) * 0.6)), mat);
  body.scale.setScalar(o.radius ?? 1);
  spin.add(body);
  spin.rotation.z = THREE.MathUtils.degToRad(o.tilt ?? 0);
  return {
    group, body, material: mat,
    set({ center, sunDir, sun, spin: a, pin, rimNight } = {}) {
      if (center) group.position.fromArray(center);
      if (sunDir) mat.uniforms.uSunDir.value.fromArray(sunDir);
      if (sun != null) mat.uniforms.uSun.value = sun;
      if (a != null) body.rotation.y = a;
      if (pin != null) mat.uniforms.uPin.value = pin;
      if (rimNight != null) mat.uniforms.uRimNight.value = rimNight;
    },
  };
};

// ── Earth's surface, baked ──────────────────────────────────────────────────
// Coarse coastlines (lon, lat in degrees), drawn from memory of a world map at about 2–5° detail: enough to
// read as Earth at phone size. Lakes and inland seas that matter at that size are cut back out.
const LAND = [
  // North America
  [[-168, 66], [-162, 70], [-156, 71], [-140, 70], [-128, 70], [-115, 68], [-95, 72], [-82, 73], [-78, 64], [-90, 60], [-94, 57], [-82, 52], [-78, 56], [-73, 62], [-65, 60], [-60, 55], [-56, 52], [-60, 47], [-66, 44], [-70, 42], [-74, 40], [-76, 35], [-81, 31], [-80, 26], [-82, 26], [-84, 30], [-89, 30], [-94, 29], [-97, 26], [-97, 22], [-95, 19], [-91, 19], [-88, 21], [-87, 16], [-83, 15], [-83, 10], [-79, 9], [-78, 7], [-81, 8], [-86, 12], [-92, 14], [-96, 16], [-105, 20], [-106, 23], [-110, 24], [-112, 29], [-114, 31], [-115, 30], [-117, 33], [-121, 35], [-124, 40], [-124, 46], [-124, 49], [-128, 51], [-133, 56], [-138, 59], [-146, 61], [-152, 59], [-158, 57], [-164, 55], [-158, 58], [-162, 60], [-165, 62], [-163, 64]],
  // Greenland
  [[-73, 78], [-60, 82], [-40, 83], [-22, 81], [-18, 76], [-21, 70], [-28, 68], [-40, 65], [-43, 60], [-50, 63], [-54, 67], [-57, 72], [-66, 76]],
  // South America
  [[-80, 9], [-77, 8], [-72, 12], [-63, 11], [-60, 8], [-52, 5], [-50, 0], [-44, -2], [-35, -6], [-35, -9], [-39, -14], [-39, -18], [-41, -22], [-48, -26], [-49, -29], [-53, -34], [-58, -35], [-57, -38], [-62, -39], [-65, -42], [-65, -47], [-68, -50], [-69, -53], [-72, -54], [-74, -52], [-75, -47], [-73, -42], [-73, -37], [-71, -30], [-70, -18], [-76, -14], [-80, -7], [-81, -4], [-80, 1], [-78, 4], [-77, 7]],
  // Eurasia (with Arabia, India and Southeast Asia)
  [[-9, 37], [-9, 43], [-2, 43.5], [-1, 46], [-4, 48], [2, 51], [5, 53], [8, 54], [9, 57], [11, 58], [5, 59], [5, 62], [10, 64], [14, 67], [19, 70], [25, 71], [30, 70], [35, 69], [41, 67], [44, 68], [54, 69], [60, 70], [68, 73], [73, 72], [80, 73], [87, 75], [98, 76], [105, 78], [112, 76], [120, 73], [130, 71], [140, 72], [150, 71], [160, 70], [170, 70], [180, 68], [180, 65], [178, 62], [172, 60], [163, 58], [162, 55], [157, 51], [156, 57], [160, 62], [155, 59], [143, 59], [137, 55], [141, 52], [140, 48], [135, 43], [129, 41], [129, 35], [127, 38], [126, 35], [121, 40], [122, 37], [119, 35], [121, 32], [122, 30], [120, 26], [116, 23], [110, 21], [108, 22], [106, 20], [106, 17], [109, 12], [105, 9], [103, 10], [100, 13], [100, 8], [103, 2], [101, 3], [98, 8], [98, 16], [94, 17], [92, 22], [88, 22], [86, 20], [80, 15], [80, 10], [77, 8], [73, 17], [72, 21], [68, 24], [62, 25], [57, 26], [56, 27], [51, 29], [48, 30], [50, 26], [52, 24], [56, 24], [59, 22], [58, 19], [52, 16], [45, 13], [43, 15], [39, 21], [35, 28], [34, 28], [32, 31], [35, 34], [36, 36], [30, 36], [27, 37], [26, 40], [29, 41], [28, 42], [23, 40], [24, 38], [22, 37], [20, 40], [19, 42], [14, 45], [12, 45], [16, 41], [18, 40], [16, 38], [15, 40], [11, 42], [8, 44], [3, 43], [0, 39], [-2, 37], [-6, 36]],
  // Africa
  [[-17, 21], [-16, 28], [-10, 30], [-9, 33], [-6, 36], [0, 36], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [37, 22], [39, 17], [43, 12], [51, 12], [51, 10], [47, 5], [42, -1], [40, -5], [40, -10], [40, -16], [35, -20], [35, -24], [33, -26], [32, -29], [27, -34], [20, -35], [18, -32], [15, -27], [12, -18], [13, -12], [9, -1], [9, 4], [5, 6], [-2, 5], [-8, 4], [-13, 8], [-17, 12], [-17, 15]],
  [[44, -25], [47, -25], [50, -16], [49, -12], [44, -17]],                                                     // Madagascar
  [[114, -22], [114, -26], [115, -34], [118, -35], [124, -33], [131, -31], [135, -35], [138, -35], [140, -38], [146, -39], [150, -37], [153, -32], [153, -25], [150, -22], [146, -19], [145, -15], [142, -11], [141, -17], [136, -12], [132, -11], [130, -13], [126, -14], [122, -17]],   // Australia
  [[95, 5], [98, 4], [104, -2], [106, -6], [102, -4]],                                                         // Sumatra
  [[109, 1], [110, -3], [116, -4], [119, 1], [117, 7], [113, 3]],                                              // Borneo
  [[105, -6], [114, -7], [114, -9], [106, -7.5]],                                                              // Java
  [[131, -1], [141, -3], [150, -10], [142, -9], [138, -8]],                                                    // New Guinea
  [[130, 31], [132, 34], [136, 35], [140, 36], [142, 40], [141, 45], [144, 43], [141, 38], [140, 35], [135, 33]],   // Japan
  [[120, 18], [122, 18], [126, 7], [122, 7]],                                                                  // Philippines
  [[-5, 50], [1, 51], [1, 53], [-2, 56], [-3, 58.5], [-6, 58], [-5, 55], [-3, 54], [-5, 52]],                  // Great Britain
  [[-10, 52], [-6, 52], [-6, 55], [-8, 55]],                                                                   // Ireland
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66.5]],                                                              // Iceland
  [[172, -35], [175, -37], [178, -38], [174, -42], [171, -44], [167, -46], [170, -45], [172, -40]],            // New Zealand
  [[-85, 22], [-74, 20], [-77, 20], [-84, 23]],                                                                // Cuba
  [[-180, -72], [-120, -73], [-60, -64], [-57, -63], [-60, -70], [-30, -76], [0, -70], [40, -69], [80, -67], [120, -66], [160, -70], [180, -72], [180, -90], [-180, -90]],   // Antarctica
];
const WATER = [
  [[28, 41], [30, 46], [35, 45], [38, 47], [41, 42], [36, 41]],                    // Black Sea
  [[47, 37], [47, 44], [51, 47], [54, 45], [53, 37]],                              // Caspian
  [[-95, 59], [-87, 64], [-80, 63], [-78, 57], [-80, 51], [-90, 56]],              // Hudson Bay
  [[10, 54], [14, 55], [18, 57], [21, 60], [25, 60], [30, 60], [24, 65], [22, 65], [17, 62], [18, 59], [16, 56], [12, 54]],   // Baltic
];

const h2 = (x, y, s) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, s, wrap) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const X = (i) => ((i % wrap) + wrap) % wrap;
  const a = h2(X(xi), yi, s), b = h2(X(xi + 1), yi, s), c = h2(X(xi), yi + 1, s), d = h2(X(xi + 1), yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y, s, wrap, oct = 4) => { let f = 0, a = 0.5, k = 1; for (let i = 0; i < oct; i++) { f += a * vnoise(x * k, y * k, s + i * 17, wrap * k); a *= 0.5; k *= 2; } return f; };

export const earthSurface = (o = {}) => {
  const W = o.width ?? 1024, H = W / 2;
  const mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  const m = mask.getContext("2d");
  const xy = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  m.fillStyle = "#000"; m.fillRect(0, 0, W, H);
  m.filter = `blur(${(W / 1024) * 2.2}px)`;
  const poly = (pts, col) => { m.fillStyle = col; m.beginPath(); pts.forEach((p, i) => { const [x, y] = xy(p); i ? m.lineTo(x, y) : m.moveTo(x, y); }); m.closePath(); m.fill(); };
  LAND.forEach((p) => poly(p, "#fff"));
  WATER.forEach((p) => poly(p, "#000"));
  const md = m.getImageData(0, 0, W, H).data;
  const out = document.createElement("canvas"); out.width = W; out.height = H;
  const g = out.getContext("2d"), img = g.createImageData(W, H), d = img.data;
  const S = 16 / W;                      // noise cells: 16 across the map, wrapping in longitude
  const ocean = [[12, 34, 74], [22, 56, 104]], land = [[64, 92, 70], [104, 112, 90], [138, 134, 112]], ice = [236, 242, 248];
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) * 180 / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, n = fbm(x * S, y * S, 3, 16), n2 = fbm(x * S * 2.3, y * S * 2.3, 9, 37);
      const L = md[i] / 255 + (n - 0.5) * 0.42;
      let c;
      if (L > 0.5) {
        const dry = Math.max(0, Math.min(1, (n2 - 0.45) * 2.4 + (Math.abs(Math.abs(lat) - 24) < 10 ? 0.45 : 0) - (Math.abs(lat) > 50 ? 0.4 : 0)));
        const a = land[0], b = land[1], e = land[2];
        c = dry < 0.5 ? a.map((v, k) => v + (b[k] - v) * dry * 2) : b.map((v, k) => v + (e[k] - v) * (dry - 0.5) * 2);
        if (Math.abs(lat) > 68 || (lat > 59 && x / W > 0.28 && x / W < 0.45 && lon(x, W) < -15 && lon(x, W) > -75)) c = ice;
      } else {
        const deep = Math.max(0, Math.min(1, (0.5 - L) * 3));
        c = ocean[1].map((v, k) => v + (ocean[0][k] - v) * deep);
        if (Math.abs(lat) > 76) c = c.map((v, k) => v + (ice[k] - v) * Math.min(1, (Math.abs(lat) - 76) / 6));
      }
      // clouds: soft wisps, more at mid latitudes and in the tropics' band
      const cl = fbm(x * S * 1.6 + 7, y * S * 3.2, 21, Math.round(16 * 1.6), 5);
      const belt = 0.55 + 0.45 * Math.cos((lat / 90) * Math.PI * 3);
      const ca = Math.max(0, Math.min(1, (cl - 0.52 + 0.08 * belt) * 3.2)) * 0.85;
      d[i] = c[0] + (246 - c[0]) * ca; d[i + 1] = c[1] + (249 - c[1]) * ca; d[i + 2] = c[2] + (252 - c[2]) * ca; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
};
const lon = (x, W) => (x / W) * 360 - 180;
