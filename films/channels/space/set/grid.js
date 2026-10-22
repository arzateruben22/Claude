// grid.js — B6, the gravity grid (films/channels/space/set): a sheet sunk into wells by masses, drawn
// as procedural lilac lines, always shown under an "analogy" badge (it is the rubber-sheet picture, not
// spacetime). Each mass is felt late: a point of the sheet at distance r from a mass sinks by the mass it
// had at τ − r/c (front.js's retarded time, in GLSL), so a change in a mass ripples out at light speed.
//
//   const grid = createGrid({ size: 64, segments: 160, spacing: 2.5, color: "lilac" (a token, or linear [r,g,b]), depth: 9, soft: 2.2, c });
//   group.add(grid.mesh);
//   grid.set({ tau, masses: [{ at: [0, 0], m: 1, off: 0 /* τ when it vanished, or null */ }], opacity });
//   grid.depthAt(x, z, tau)   the sheet's height there (JS, the same formula; for placing a body in its well)
import * as THREE from "three";
import { tok } from "./look.js";
import { GLSL as FRONT_GLSL } from "cinema/sci/front.js";

const MAXM = 4;
const VS = /* glsl */ `
  ${FRONT_GLSL}
  uniform float uTau, uC, uDepth, uSoft, uFront;
  uniform vec4 uMass[${MAXM}];          // x, z, m, τ_off (1e9: never)
  varying vec2 vXZ; varying float vH;
  float sheet(vec2 p){
    float h = 0.0;
    for (int i = 0; i < ${MAXM}; i++) {
      vec4 M = uMass[i];
      if (M.z <= 0.0) continue;
      float r = length(p - M.xy);
      float felt = 1.0 - retardedStep(uTau, r, uC, M.w, uFront);   // 1 until the news of its vanishing arrives
      h -= uDepth * M.z * felt * uSoft / sqrt(r * r + uSoft * uSoft);
    }
    return h;
  }
  void main(){
    vec3 p = position;
    vXZ = p.xz;
    p.y = sheet(p.xz);
    vH = p.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;
const FS = /* glsl */ `
  uniform vec3 uCol; uniform float uOpacity, uSpacing, uHalf, uLineW;
  varying vec2 vXZ; varying float vH;
  void main(){
    vec2 g = vXZ / uSpacing;
    vec2 w = fwidth(g) * uLineW;
    vec2 l = 1.0 - smoothstep(vec2(0.0), w, abs(fract(g - 0.5) - 0.5));
    float line = max(l.x, l.y);
    float edge = 1.0 - smoothstep(uHalf * 0.72, uHalf, max(abs(vXZ.x), abs(vXZ.y)));
    float deep = 1.0 + clamp(-vH * 0.06, 0.0, 0.8);
    float a = (line * 0.85 + 0.05) * edge * uOpacity;
    gl_FragColor = vec4(uCol * a * deep, a);
  }`;

export const createGrid = (o = {}) => {
  const size = o.size ?? 64, seg = o.segments ?? 160;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), size);
  const mass = Array.from({ length: MAXM }, () => new THREE.Vector4(0, 0, 0, 1e9));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTau: { value: 0 }, uC: { value: o.c ?? 1 }, uDepth: { value: o.depth ?? 8 }, uSoft: { value: o.soft ?? 2 }, uFront: { value: o.front ?? 0 },
      uMass: { value: mass }, uCol: { value: new THREE.Vector3(...(Array.isArray(o.color) ? o.color : tok(o.color || "lilac"))) }, uOpacity: { value: o.opacity ?? 1 },
      uSpacing: { value: o.spacing ?? 2 }, uHalf: { value: size / 2 }, uLineW: { value: o.lineWidth ?? 1.4 },
    },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noProbe = true;
  const U = mat.uniforms;
  const step = (x, w) => (w <= 0 ? (x >= 0 ? 1 : 0) : x <= 0 ? 0 : x >= w ? 1 : ((u) => u * u * (3 - 2 * u))(x / w));
  const depthAt = (x, z, tau = U.uTau.value) => {
    let h = 0;
    for (const M of mass) {
      if (M.z <= 0) continue;
      const r = Math.hypot(x - M.x, z - M.y), felt = 1 - step(tau - r / U.uC.value - M.w, U.uFront.value);
      h -= U.uDepth.value * M.z * felt * U.uSoft.value / Math.sqrt(r * r + U.uSoft.value ** 2);
    }
    return h;
  };
  return {
    mesh, depthAt,
    set({ tau, masses, opacity } = {}) {
      if (tau != null) U.uTau.value = tau;
      if (opacity != null) { U.uOpacity.value = opacity; mesh.visible = opacity > 1e-4; }
      if (masses) mass.forEach((M, i) => { const s = masses[i]; if (s) M.set(s.at[0], s.at[1], s.m ?? 1, s.off == null ? 1e9 : s.off); else M.set(0, 0, 0, 1e9); });
    },
  };
};
