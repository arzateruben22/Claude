// globe.js — a planet model cut in half (films/channels/whatif/set): the back hemisphere in chalk plaster
// with a pencil graticule, and a flat cut face toward the camera that shows the interior as concentric
// layers. A straight tunnel can run through the centre, and curves can be drawn on the face in marker or
// chalk (a profile along the tunnel). Episode 1 builds it; any planet-interior episode reuses it.
//
//   import { createGlobe, strip } from "../set/globe.js";
//   const G = createGlobe({ R: 6.371, layers: [r1, r2, ...] (radii, inner first, in the same units), tokens });
//   scene.add(G.group);
//   G.set({ light: [lx, ly, lz] (toward the lamp), hi: [h0, h1, ...] (0–1 per layer: lifts it toward chalk
//          and draws its boundary in marker), glow: 0–1 (the innermost two layers turn marker and bloom),
//          tunnel: 0–1 (the bore's strength) })
//   const S = strip(points, { width, color: [r,g,b] linear, dash, opacity }); G.face.add(S.mesh); S.set({ upto, opacity })
//
// Colours are display colours (tokens, plus greys between chalk and graphite for depth), output through the
// finish's inverse (./aces.js), so the screen shows them exactly; the plaster is shaded by one lamp
// direction in display space (a half-Lambert, never darker than the graphite it sits on). The face sits in
// the z = 0 plane of the group; the hemisphere is z ≤ 0. Nothing here moves its origin (the group is placed
// once), so the finish's probe reads the camera; the figure that falls is its own mesh.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const VS = `
varying vec3 vP; varying vec3 vN;
void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// the plaster shell: half-Lambert from the lamp, a pencil graticule every 15°, a soft rim
const FS_SHELL = `
precision highp float;
uniform vec3 uModel, uDark, uLine, uLight; uniform float uExposure, uR;
varying vec3 vP; varying vec3 vN;
${ACES_INV_GLSL}
float gl(float a, float stepDeg, float px) {
  float fw = max(fwidth(a), 1e-5), s = radians(stepDeg);
  float d = abs(fract(a / s - 0.5) - 0.5) * s;
  return 1.0 - smoothstep(0.0, px * fw, d);
}
void main() {
  vec3 n = normalize(vN), p = vP / uR;
  float lam = 0.5 + 0.5 * dot(n, normalize(uLight));
  vec3 col = mix(uDark, uModel, pow(lam, 1.3));
  float lat = asin(clamp(p.y, -1.0, 1.0)), lon = atan(p.z, p.x);
  float g = max(gl(lat, 15.0, 1.1), gl(lon, 15.0, 1.1) * smoothstep(0.98, 0.9, abs(p.y)));
  col = mix(col, uLine, 0.22 * g);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the cut face: layers by radius (greys from plaster to near-graphite), chalk boundaries, the tunnel
const FS_FACE = `
precision highp float;
#define NL 6
uniform vec3 uCol[NL]; uniform float uRad[NL]; uniform float uHi[NL];
uniform vec3 uChalk, uMarker, uBore; uniform float uExposure, uGlow, uTunnel, uTw, uR;
varying vec3 vP; varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  float r = length(vP.xy), fw = max(fwidth(r), 1e-5);
  vec3 col = uCol[NL - 1]; float hi = 0.0; int k = NL - 1;
  for (int i = NL - 1; i >= 0; i--) { if (r <= uRad[i]) { col = uCol[i]; hi = uHi[i]; k = i; } }
  col = mix(col, uChalk, 0.28 * hi);
  if (k <= 1) col = mix(col, uMarker, uGlow);                          // the core, lit at the payoff
  // layer boundaries: thin chalk lines, marker when that layer is lit
  for (int i = 0; i < NL - 1; i++) {
    float d = abs(r - uRad[i]) / fw;
    float a = 1.0 - smoothstep(0.6, 1.8, d);
    vec3 lc = mix(uChalk, uMarker, max(uHi[i], (i <= 1 ? uGlow : 0.0)));
    col = mix(col, lc, a * (0.35 + 0.55 * uHi[i]));
  }
  // the tunnel: a dark bore with chalk walls, pole to pole
  float tx = abs(vP.x), fx = max(fwidth(vP.x), 1e-5);
  float inBore = 1.0 - smoothstep(uTw - fx, uTw + fx, tx);
  float wall = (1.0 - smoothstep(0.5, 1.6, abs(tx - uTw) / fx)) * step(abs(vP.y), uR);
  col = mix(col, uBore, inBore * uTunnel);
  col = mix(col, uChalk, wall * 0.8 * uTunnel);
  // the rim of the cut: a chalk outline
  col = mix(col, uChalk, (1.0 - smoothstep(0.6, 1.8, abs(r - uR) / fw)) * 0.7);
  vec3 lin = acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure);
  if (k <= 1) lin *= 1.0 + 1.8 * uGlow;                                 // past the bloom threshold: the core glows
  gl_FragColor = vec4(lin, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const mixHex = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);

export const createGlobe = (o = {}) => {
  const tk = o.tokens || {}, R = o.R ?? 6.371;
  const rgb = (k, d) => hexRgb(tk[k] || d);
  const model = rgb("model", "#E6E2D8"), chalk = rgb("chalk", "#F4F2EC"), graphite = rgb("graphite", "#171A1E");
  // layers, inner first: inner core, outer core, lower mantle, upper mantle, crust (the last radius is R)
  const radii = (o.layers || [1.2215, 3.48, 5.701, 6.3466, R]).slice(0, 5);
  const shades = [0.80, 0.70, 0.52, 0.40, 0.08];                       // fraction of the way from plaster to graphite
  const cols = radii.map((_, i) => mixHex(model, graphite, shades[i]));
  while (radii.length < 6) { radii.push(R * 2); cols.push(cols[cols.length - 1]); }
  const v3 = (c) => new THREE.Vector3(...c);
  const exposure = { value: o.exposure ?? 1 };
  const shellU = { uModel: { value: v3(model) }, uDark: { value: v3(mixHex(model, graphite, 0.62)) }, uLine: { value: v3(graphite) },
    uLight: { value: new THREE.Vector3(-0.5, 0.7, 0.5) }, uExposure: exposure, uR: { value: R } };
  const faceU = { uCol: { value: cols.map(v3) }, uRad: { value: radii }, uHi: { value: new Array(6).fill(0) },
    uChalk: { value: v3(chalk) }, uMarker: { value: v3(rgb("marker", "#EB63FF")) }, uBore: { value: v3(mixHex(graphite, [0, 0, 0], 0.35)) },
    uExposure: exposure, uGlow: { value: 0 }, uTunnel: { value: 1 }, uTw: { value: o.tunnelHalfWidth ?? 0.16 }, uR: { value: R } };
  const shellG = new THREE.SphereGeometry(R, 128, 96, Math.PI, Math.PI);   // the back half (z ≤ 0)
  const shell = new THREE.Mesh(shellG, new THREE.ShaderMaterial({ uniforms: shellU, vertexShader: VS, fragmentShader: FS_SHELL, extensions: { derivatives: true } }));
  const faceG = new THREE.CircleGeometry(R, 256);
  const face = new THREE.Mesh(faceG, new THREE.ShaderMaterial({ uniforms: faceU, vertexShader: VS, fragmentShader: FS_FACE, extensions: { derivatives: true } }));
  const group = new THREE.Group();
  group.add(shell, face);
  const set = (s = {}) => {
    if (s.light) shellU.uLight.value.set(...s.light);
    if (s.hi) for (let i = 0; i < 6; i++) faceU.uHi.value[i] = s.hi[i] ?? 0;
    if (s.glow !== undefined) faceU.uGlow.value = s.glow;
    if (s.tunnel !== undefined) faceU.uTunnel.value = s.tunnel;
  };
  return { group, shell, face, R, radii: radii.slice(0, 5), set };
};

// A polyline drawn flat in its parent's xy plane (the cut face), `width` units wide, revealed along its
// length by `upto` (0–1), optionally dashed (dash = dash length in units). Unlit; colour is linear light (use
// look.js tok() / hdr()). It sits a hair in front of the face (z = 0.01) and ignores depth against it.
const FS_STRIP = `
precision highp float;
uniform vec3 uColor; uniform float uOpacity, uUpto, uDash, uLen;
varying float vS;
void main() {
  if (vS > uUpto * uLen) discard;
  if (uDash > 0.0 && fract(vS / (2.0 * uDash)) > 0.5) discard;
  gl_FragColor = vec4(uColor * uOpacity, uOpacity);
}`;
const VS_STRIP = `
attribute float s; varying float vS;
void main() { vS = s; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const strip = (pts, o = {}) => {
  const w = (o.width ?? 0.08) / 2, pos = [], S = [], idx = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0] - ty * w, pts[i][1] + tx * w, 0.012, pts[i][0] + ty * w, pts[i][1] - tx * w, 0.012);
    S.push(s, s);
    if (i > 0) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("s", new THREE.Float32BufferAttribute(S, 1));
  g.setIndex(idx);
  const u = { uColor: { value: new THREE.Vector3(...(o.color || [1, 1, 1])) }, uOpacity: { value: o.opacity ?? 1 }, uUpto: { value: 1 },
    uDash: { value: o.dash ?? 0 }, uLen: { value: s } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS_STRIP, fragmentShader: FS_STRIP, transparent: true, depthWrite: false,
    premultipliedAlpha: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.userData.noProbe = true;
  return { mesh, length: s, set: (q = {}) => { if (q.upto !== undefined) u.uUpto.value = q.upto; if (q.opacity !== undefined) u.uOpacity.value = q.opacity; if (q.color) u.uColor.value.set(...q.color); } };
};
