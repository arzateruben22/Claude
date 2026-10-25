// comets.js — a thick shell of faint points around the Sun (films/channels/space/set): the Oort cloud, which
// is a theory (no object in its distant part has been seen), so scenes show it under a "theory" badge. New in
// episode 2. Radii are log-uniform between r0 and r1, so the inner edge reads as an edge and the cloud thins
// outward; points keep at least 1.6 px (at a 1080-px short side). One draw.
//
//   const oort = createComets({ n: 5000, r0: 1240, r1: 108000, seed: 7 });   // units: its group's (AU in ep02)
//   group.add(oort.group);   oort.set({ gain })
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { probes } from "cinema/sci/front.js";

const VS = /* glsl */ `
  attribute float size; attribute float lum;
  uniform float uS1, uOpacity, uGain; varying float vL;
  void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.6, size * uS1); vL = lum * uOpacity * uGain; }`;
const FS = /* glsl */ `
  uniform vec3 uCol; varying float vL;
  void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = exp(-r2 * 2.6); gl_FragColor = vec4(uCol * vL * a, a * vL); }`;

export const createComets = (o = {}) => {
  const n = o.n ?? 5000, r0 = o.r0 ?? 1, r1 = o.r1 ?? 100, R = rng(o.seed ?? 7), S1 = Math.min(window.W, window.H) / 1080;
  const P = new Float32Array(n * 3), S = new Float32Array(n), L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z), r = r0 * Math.pow(r1 / r0, R());
    P.set([s * Math.cos(a) * r, z * r, s * Math.sin(a) * r], i * 3);
    S[i] = 2.0 + 1.6 * R();
    L[i] = 0.5 + 0.5 * Math.pow(R(), 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(S, 1));
  geo.setAttribute("lum", new THREE.BufferAttribute(L, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uS1: { value: S1 }, uOpacity: { value: 1 }, uGain: { value: o.gain ?? 1 }, uCol: { value: new THREE.Vector3(...(o.color || [0.55, 0.62, 0.8])) } },
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  const place = probes(group, 2);
  place([[r0 * 1.2, 0, 0], [0, r0 * 1.2, 0]]);
  return { group, points, material: mat, set({ gain } = {}) { if (gain != null) mat.uniforms.uGain.value = gain; return this; } };
};
