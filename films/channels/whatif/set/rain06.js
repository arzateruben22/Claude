// rain06.js — rain and water for the graph-paper world (films/channels/whatif/set), built for No. 006 ("Every
// raindrop at once").
//
//   import { createRain, createWater, createCoins } from "../set/rain06.js";
//   const rain = createRain({ tokens, count: 6000, half: 12, top: 14 });   // streaks over a square 2·half wide
//   scene.add(rain.mesh);
//   rain.set({ fall: metres fallen so far (a pure function of t), len: streak length (m), density: 0–1, opacity })
//   const w = createWater({ tokens, r: 0.4, h: 0.0028, a: 0.28 (chalk mix), alpha: 0.45 (from above) });   // a disc of water on the paper
//   scene.add(w.mesh); w.set({ h, opacity, at: [x, z] })
//   const c = createCoins({ tokens, n: 2 });  scene.add(c.group);  c.set({ at: [x, z], opacity })
//
// The rain is one LineSegments mesh: each streak's place comes from a seeded hash and its height from `fall`
// modulo the column, all in the vertex shader, so the mesh never moves (the finish's probe reads the camera) and
// any frame is a pure function of t. Streaks are chalk, fading toward their tails, composed in display colours
// and output through the finish's inverse (./aces.js). Water is a translucent chalk cylinder with a brighter rim
// and top edge; coins are flat chalk-2 discs with a 1.52 mm edge (a US cent). None of it is blue: blue is the
// human-scale anchor (you), and the water is the calculation's subject, not the anchor.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const RVS = `
attribute vec3 seed; attribute float tip;
uniform float uFall, uLen, uHalf, uTop, uDensity;
varying float vA;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float x = (seed.x * 2.0 - 1.0) * uHalf, z = (seed.y * 2.0 - 1.0) * uHalf;
  float y = uTop - mod(seed.z * uTop + uFall, uTop);
  y += tip * uLen;
  vA = (1.0 - tip) * step(h(seed.z * 57.3 + seed.x * 13.1 + seed.y * 7.7), uDensity) * smoothstep(0.0, 0.6, y) * (1.0 - smoothstep(uTop * 0.8, uTop, y));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(x, y, z, 1.0);
}`;
const RFS = `
precision highp float;
uniform vec3 uCol; uniform float uOpacity, uExposure;
varying float vA;
${ACES_INV_GLSL}
void main() {
  if (vA * uOpacity < 0.004) discard;
  gl_FragColor = vec4(acesInv(srgbToLinear(uCol), uExposure), vA * uOpacity * 0.7);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const hash = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export const createRain = (o = {}) => {
  const tk = o.tokens || {}, n = o.count ?? 6000;
  const pos = new Float32Array(n * 6), seed = new Float32Array(n * 6), tip = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const s = [hash(i, 1), hash(i, 2), hash(i, 3)];
    for (let e = 0; e < 2; e++) { seed.set(s, (2 * i + e) * 3); tip[2 * i + e] = e; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("seed", new THREE.BufferAttribute(seed, 3));
  g.setAttribute("tip", new THREE.BufferAttribute(tip, 1));
  const u = { uFall: { value: 0 }, uLen: { value: 0.4 }, uHalf: { value: o.half ?? 12 }, uTop: { value: o.top ?? 14 }, uDensity: { value: 1 },
    uCol: { value: new THREE.Vector3(...hexRgb(tk.chalk || "#F4F2EC")) }, uOpacity: { value: 1 }, uExposure: { value: o.exposure ?? 1 } };
  const mesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: RVS, fragmentShader: RFS, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false; mesh.userData.noProbe = true;
  const set = (s = {}) => {
    if (s.fall !== undefined) u.uFall.value = s.fall;
    if (s.len !== undefined) u.uLen.value = s.len;
    if (s.density !== undefined) u.uDensity.value = s.density;
    if (s.half !== undefined) u.uHalf.value = s.half;
    if (s.top !== undefined) u.uTop.value = s.top;
    if (s.opacity !== undefined) { u.uOpacity.value = s.opacity; mesh.visible = s.opacity > 0.002; }
  };
  return { mesh, set, uniforms: u };
};

const WVS = `
varying vec3 vN, vP; varying float vY;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vY = position.y + 0.5; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WFS = `
precision highp float;
uniform vec3 uCol, uGround, uCam; uniform float uOpacity, uExposure, uA, uAlpha;
varying vec3 vN, vP; varying float vY;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN);
  float rim = pow(1.0 - abs(dot(n, normalize(uCam - vP))), 2.0);
  float top = step(0.98, n.y);
  vec3 col = mix(uGround, uCol, clamp(uA + 0.5 * rim + 0.25 * top, 0.0, 1.0));
  gl_FragColor = vec4(acesInv(srgbToLinear(col), uExposure), uOpacity * mix(uAlpha, 1.0, 0.6 * rim + 0.4 * (1.0 - top)));   // see-through from above, solid at the rim and sides
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createWater = (o = {}) => {
  const tk = o.tokens || {};
  const u = { uCol: { value: new THREE.Vector3(...hexRgb(tk.chalk || "#F4F2EC")) }, uGround: { value: new THREE.Vector3(...hexRgb(tk["graphite-hi"] || "#21242A")) },
    uCam: { value: new THREE.Vector3() }, uOpacity: { value: 1 }, uExposure: { value: o.exposure ?? 1 }, uA: { value: o.a ?? 0.28 }, uAlpha: { value: o.alpha ?? 0.45 } };
  const g = new THREE.CylinderGeometry(1, 1, 1, 96, 1);
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: WVS, fragmentShader: WFS, transparent: true, depthWrite: false }));
  mesh.renderOrder = 2;
  let r = o.r ?? 0.4, h = o.h ?? 0.003, at = [0, 0];
  const place = () => { mesh.scale.set(r, Math.max(1e-6, h), r); mesh.position.set(at[0], h / 2 + 0.0005, at[1]); };
  place();
  const set = (s = {}) => {
    if (s.r !== undefined) r = s.r;
    if (s.h !== undefined) h = s.h;
    if (s.at) at = s.at;
    if (s.cam) u.uCam.value.set(...s.cam);
    if (s.opacity !== undefined) { u.uOpacity.value = s.opacity; mesh.visible = s.opacity > 0.002; }
    place();
  };
  return { mesh, set };
};

export const createCoins = (o = {}) => {
  const tk = o.tokens || {}, n = o.n ?? 2, t = o.t ?? 0.00152, d = o.d ?? 0.01905;     // a US cent: 1.52 mm thick, 19.05 mm across
  const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(tk["chalk-2"] || "#A7AAB2")) }, uOpacity: { value: 1 }, uExposure: { value: 1 } },
    vertexShader: `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; uniform vec3 uCol; uniform float uOpacity, uExposure; varying vec3 vN;
${ACES_INV_GLSL}
void main() { float l = 0.62 + 0.38 * max(0.0, dot(normalize(vN), normalize(vec3(-0.4, 0.9, 0.5)))); gl_FragColor = vec4(acesInv(srgbToLinear(uCol * l), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`, transparent: true });
  const group = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, t * 0.96, 64), mat);
    c.position.y = t * (i + 0.5);
    c.position.x = (i % 2 ? 0.0012 : -0.0008);                     // a slightly uneven stack
    group.add(c);
  }
  const set = (s = {}) => {
    if (s.at) group.position.set(s.at[0], 0, s.at[1]);
    if (s.opacity !== undefined) { mat.uniforms.uOpacity.value = s.opacity; group.visible = s.opacity > 0.002; }
  };
  return { group, set, height: n * t };
};
