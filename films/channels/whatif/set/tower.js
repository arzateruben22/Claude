// tower.js — a tall-building silhouette and a measuring cube (films/channels/whatif/set): the human-scale
// anchor for a volume. Built for No. 002 (everyone's bodies as one cube beside the world's tallest tower);
// reusable for any "how big would it be" sum. World units are metres; both stand on the desk at y = 0.
//
//   import { createTower, createCube } from "../set/tower.js";
//   const T = createTower({ tokens, height: 828 });   scene.add(T.group);   T.set({ x, z, opacity, grow: 0–1 })
//   const K = createCube({ tokens, side: 800 });      scene.add(K.group);   K.set({ x, z, opacity, grow: 0–1 })
//
// The tower is a generic stepped spire (stacked, narrowing setbacks and a needle), drawn in chalk plaster like
// the planet model: a reference shape, not a likeness of any one building. The cube is anchor blue (it is
// made of people), shaded by one lamp direction; `grow` raises it from the paper (a pour, never a flash).
// Display colours, output through the finish's inverse (./aces.js).
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const VS = `
varying vec3 vN;
void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `
precision highp float;
uniform vec3 uCol, uGround, uLight; uniform float uExposure, uLo, uOpacity;
varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  float lam = 0.5 + 0.5 * dot(normalize(vN), normalize(uLight));
  vec3 col = mix(uGround, uCol * mix(uLo, 1.0, lam), uOpacity);
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const mat = (tk, key, def, lo) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Vector3(...hexRgb(tk[key] || def)) }, uGround: { value: new THREE.Vector3(...hexRgb(tk.graphite || "#171A1E")) },
    uLight: { value: new THREE.Vector3(-0.5, 0.75, 0.45) }, uExposure: { value: 1 }, uLo: { value: lo }, uOpacity: { value: 1 } },
  vertexShader: VS, fragmentShader: FS,
});

export const createTower = (o = {}) => {
  const H = o.height ?? 828, tk = o.tokens || {}, m = mat(tk, "model", "#E6E2D8", 0.55);
  const inner = new THREE.Group();
  // setbacks: [fraction of height at the top of the tier, half-width in m]
  const tiers = [[0.08, 45], [0.22, 38], [0.38, 31], [0.52, 25], [0.64, 19], [0.74, 14], [0.8, 9]];
  let y0 = 0;
  for (const [f, w] of tiers) {
    const h = f * H - y0, b = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.82, w, h, 6, 1), m);
    b.position.y = y0 + h / 2; inner.add(b); y0 = f * H;
  }
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 6, H - y0, 8, 1), m);
  needle.position.y = y0 + (H - y0) / 2; inner.add(needle);
  const group = new THREE.Group(); group.add(inner);
  const set = (s = {}) => {
    group.position.set(s.x ?? 0, 0, s.z ?? 0);
    inner.scale.set(1, Math.max(1e-3, s.grow ?? 1), 1);
    m.uniforms.uOpacity.value = s.opacity ?? 1;
  };
  return { group, set, height: H };
};

export const createCube = (o = {}) => {
  const S = o.side ?? 800, tk = o.tokens || {}, m = mat(tk, "anchor", "#4DA3FF", 0.6);
  const box = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), m);
  box.geometry.translate(0, S / 2, 0);
  const group = new THREE.Group(); group.add(box);
  const set = (s = {}) => {
    group.position.set(s.x ?? 0, 0, s.z ?? 0);
    box.scale.set(1, Math.max(1e-3, s.grow ?? 1), 1);
    m.uniforms.uOpacity.value = s.opacity ?? 1;
  };
  return { group, set, side: S };
};
