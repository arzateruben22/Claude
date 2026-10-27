// anchor.js — the human-scale anchors in ballpoint blue (films/channels/whatif/set; bible §1: blue means
// "you, your street, your kitchen" and nothing else). Simple, readable silhouettes, shaded flat-ish in
// display colours and output through the finish's inverse (./aces.js). Reused by every episode.
//
//   import { createFigure, createCar } from "../set/anchor.js";
//   const you = createFigure({ tokens, height: 0.6 });   scene.add(you.group);
//   you.set({ at: [x, y, z], tilt: radians, arms: 0–1 (0 down, 1 up: falling) })
//   const car = createCar({ tokens, length: 0.55 });     scene.add(car.group);
//   car.set({ at: [x, y, z], heading: radians })
//
// A figure is a capsule body and a round head; the arms are two small capsules that rise as it falls. The
// car is a rounded box with a cabin and four dark wheels. Both are lit by one direction in display space
// (a half-Lambert between anchor blue at 72% and 100%), so they read as solid without a shadow pass.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const VS = `
varying vec3 vN;
void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `
precision highp float;
uniform vec3 uCol, uLight; uniform float uExposure, uLo;
varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  float lam = 0.5 + 0.5 * dot(normalize(vN), normalize(uLight));
  vec3 col = uCol * mix(uLo, 1.0, lam);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const material = (hex, lo = 0.72, exposure = 1) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(hex)) }, uLight: { value: new THREE.Vector3(-0.4, 0.8, 0.6) }, uExposure: { value: exposure }, uLo: { value: lo } },
  vertexShader: VS, fragmentShader: FS,
});

export const createFigure = (o = {}) => {
  const h = o.height ?? 0.6, tk = o.tokens || {};
  const mat = material(tk.anchor || "#4DA3FF");
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.16, h * 0.42, 6, 16), mat);
  body.position.y = h * 0.37;
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.13, 20, 14), mat);
  head.position.y = h * 0.86;
  const arm = () => { const a = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.055, h * 0.3, 4, 10), mat); a.geometry.translate(0, -h * 0.17, 0); return a; };
  const armL = arm(), armR = arm();
  armL.position.set(-h * 0.19, h * 0.62, 0); armR.position.set(h * 0.19, h * 0.62, 0);
  const inner = new THREE.Group(); inner.add(body, head, armL, armR);
  inner.position.y = -h / 2;                                  // the group's origin is the figure's centre
  const group = new THREE.Group(); group.add(inner);
  const set = (s = {}) => {
    if (s.at) group.position.set(...s.at);
    group.rotation.z = s.tilt ?? 0;
    const up = s.arms ?? 0;                                   // 0: arms down; 1: arms up (falling)
    armL.rotation.z = -(0.25 + 2.5 * up); armR.rotation.z = 0.25 + 2.5 * up;
  };
  set({});
  return { group, set, height: h };
};

export const createCar = (o = {}) => {
  const L = o.length ?? 0.55, tk = o.tokens || {};
  const mat = material(tk.anchor || "#4DA3FF");
  const dark = material(tk.graphite || "#171A1E", 0.9);
  const box = (w, hh, d) => new THREE.BoxGeometry(w, hh, d, 1, 1, 1);
  const base = new THREE.Mesh(box(L, L * 0.26, L * 0.46), mat); base.position.y = L * 0.22;
  const cab = new THREE.Mesh(box(L * 0.52, L * 0.22, L * 0.42), mat); cab.position.set(-L * 0.04, L * 0.45, 0);
  const wheels = [[-0.3, 0.24], [0.3, 0.24], [-0.3, -0.24], [0.3, -0.24]].map(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.12, L * 0.12, L * 0.08, 16), dark);
    w.rotation.x = Math.PI / 2; w.position.set(x * L, L * 0.12, z * L); return w;
  });
  const group = new THREE.Group(); group.add(base, cab, ...wheels);
  const set = (s = {}) => { if (s.at) group.position.set(...s.at); group.rotation.y = s.heading ?? 0; };
  return { group, set, length: L };
};
