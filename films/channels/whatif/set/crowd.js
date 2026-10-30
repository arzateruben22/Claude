// crowd.js — a crowd seen from above (films/channels/whatif/set): everyone standing on the graph-paper desk,
// one dot per person at a given density, filling a square that grows from one person to all of us. Built for
// No. 002 ("Everyone, one place"); any "how many people / how much room" episode reuses it.
//
//   import { createCrowd } from "../set/crowd.js";
//   const C = createCrowd({ tokens, density: 2 });            // people per m^2; world units are metres
//   scene.add(C.group);
//   C.set({ side: L (m, the square's side), density: d (people per m^2: the pitch is 1/sqrt(d)),
//           opacity: 0–1, hatch: 0–1 (chalk warning hatching over the square: "too tight") })
//
// One flat quad on the desk (y = 0.02), its size set from `side` each frame, with a fragment shader that
// draws a dot per person on a square lattice of pitch 1/sqrt(density), jittered by a hash so the crowd never
// reads as a grid. Dots are anchor blue (bible §1: blue is the human-scale anchor; here, the people). When the
// pitch falls under about 3 px on screen the dots are replaced by their average coverage (fwidth), so a crowd
// 64 km across reads as an even blue tint and never shimmers. The square's edge is a thin chalk line. Display
// colours, output through the finish's inverse (./aces.js). The mesh's origin never moves (the probe reads the
// camera); only its scale does, and that is a uniform-free matrix change the probe ignores (kFloor covers it).
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const VS = `
varying vec2 vP;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = `
precision highp float;
uniform vec3 uDot, uGround, uEdge; uniform float uPitch, uHalf, uOpacity, uHatch, uExposure, uDotR;
varying vec2 vP;
${ACES_INV_GLSL}
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 a = abs(vP);
  if (max(a.x, a.y) > uHalf) discard;
  vec2 q = vP / uPitch, cell = floor(q), f = fract(q) - 0.5;
  vec2 j = vec2(h21(cell), h21(cell + 17.0)) - 0.5;
  float d = length(f - 0.28 * j);
  float fw = max(fwidth(q.x), 1e-5);                              // lattice cells per pixel
  float dotA = 1.0 - smoothstep(uDotR - fw, uDotR + fw, d);
  float mean = 3.14159 * uDotR * uDotR;                           // a dot's average coverage of its cell
  float far = smoothstep(0.18, 0.4, fw);                          // under ~3 px a cell: use the average
  float cov = mix(dotA, mean, far);
  vec3 col = mix(uGround, uDot, cov);
  float e = (uHalf - max(a.x, a.y)) / max(fwidth(vP.x), 1e-5);   // px from the square's edge
  col = mix(col, uEdge, (1.0 - smoothstep(0.8, 2.2, e)) * 0.85);
  float hs = step(0.5, fract((vP.x + vP.y) / (uHalf * 0.08)));    // diagonal hatching, coarse at any scale
  col = mix(col, uEdge, uHatch * hs * 0.35);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  gl_FragColor.rgb = mix(acesInv(srgbToLinear(uGround), uExposure), gl_FragColor.rgb, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createCrowd = (o = {}) => {
  const tk = o.tokens || {};
  const v3 = (k, d) => new THREE.Vector3(...hexRgb(tk[k] || d));
  const u = {
    uDot: { value: v3("anchor", "#4DA3FF") }, uGround: { value: v3("graphite", "#171A1E") }, uEdge: { value: v3("chalk", "#F4F2EC") },
    uPitch: { value: 1 / Math.sqrt(o.density ?? 2) }, uHalf: { value: 0.5 }, uOpacity: { value: 1 }, uHatch: { value: 0 },
    uExposure: { value: o.exposure ?? 1 }, uDotR: { value: o.dotR ?? 0.24 },
  };
  const g = new THREE.PlaneGeometry(2, 2, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, extensions: { derivatives: true } }));
  mesh.frustumCulled = false; mesh.renderOrder = -5;
  const group = new THREE.Group();
  group.position.y = o.y ?? 0.02;
  group.add(mesh);
  const set = (s = {}) => {
    if (s.side !== undefined) { u.uHalf.value = s.side / 2; mesh.scale.set(s.side / 2, 1, s.side / 2); }
    if (s.density !== undefined) u.uPitch.value = 1 / Math.sqrt(s.density);
    if (s.opacity !== undefined) u.uOpacity.value = s.opacity;
    if (s.hatch !== undefined) u.uHatch.value = s.hatch;
  };
  return { group, mesh, set, uniforms: u };
};
