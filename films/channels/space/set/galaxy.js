// galaxy.js — B9, the Milky Way as points (films/channels/space/set), and a generic star cloud for
// the rungs between the Sun and the galaxy. One draw each.
//
// createGalaxy({ n: 40000, radius: 50, seed }) — units are the rung's (the ladder's galaxy rung: 1 unit =
//   1,000 light-years). Two major and two minor log-spiral arms, a bar and bulge, a thin disc; rigid
//   rotation only (G.set({ angle })), so the arms never wind up. The Sun ("You are here") sits at SUN_LY
//   from the centre: the channel's one galactic-centre figure, about 27,000 light-years (claims c12;
//   DECISIONS.md), on the inner edge of a minor arm as the Orion Spur is drawn in most illustrations.
//   Colours: ice-white arms, a pale lemon-white bulge; no warm hues. Points are 1.6–3 px at 1080 short side.
//   G.sunAt(angle) → [x, y, z] in rung units, for labels and the ladder's focus.
// createCloud({ n, radius, seed, flat }) — a round cloud of stars (the solar neighbourhood rung).
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";
import { probes } from "cinema/sci/front.js";

export const SUN_LY = 27000;          // light-years from the galactic centre (the channel's one figure)

const VS = /* glsl */ `
  attribute float size; attribute vec3 col;
  uniform float uS1, uOpacity, uGain; varying vec3 vCol;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(1.6, size * uS1);
    vCol = col * uOpacity * uGain;
  }`;
const FS = /* glsl */ `
  varying vec3 vCol;
  void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = exp(-r2 * 2.6); gl_FragColor = vec4(vCol * a, a); }`;

const pointsMat = (S1) => new THREE.ShaderMaterial({
  uniforms: { uS1: { value: S1 }, uOpacity: { value: 1 }, uGain: { value: 1 } }, vertexShader: VS, fragmentShader: FS,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});

export const createGalaxy = (o = {}) => {
  const n = o.n ?? 40000, Rg = o.radius ?? 50, R = rng(o.seed ?? 27), S1 = Math.min(window.W, window.H) / 1080;
  const P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 3);
  const g = () => (R() + R() + R() + R() - 2) / 2;                     // a cheap gaussian, σ ≈ 0.58
  const arm = [0.98, 0.93, 0.86], blu = [0.82, 0.88, 1.0], bul = [1.0, 0.97, 0.86];
  const pitch = Math.tan((12.5 * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const u = R();
    let x, z, y, c, s, b;
    if (u < 0.2) {                                                      // bulge and bar
      const r = Math.abs(g()) * 5.5, a = R() * Math.PI * 2, bar = 1 + 1.6 * Math.exp(-r / 3);
      x = Math.cos(a) * r * bar; z = Math.sin(a) * r * 0.55; y = g() * 1.6 * Math.exp(-r / 6);
      const rot = 0.45; [x, z] = [x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot)];
      c = bul; b = 0.42 + 0.5 * R(); s = 1.6 + 1.2 * Math.pow(R(), 3);
    } else if (u < 0.86) {                                              // the arms: log spirals r = r0·e^(θ·pitch)
      const k = Math.floor(R() * 4), major = k < 2, r = 4 + Math.pow(R(), 0.9) * (Rg - 4);
      const th = Math.log(r / 4) / pitch + k * Math.PI / 2 + (major ? 0 : 0.35);
      const spread = (major ? 1.8 : 1.3) + r * 0.05;
      x = Math.cos(th) * r + g() * spread; z = Math.sin(th) * r + g() * spread; y = g() * 0.5;
      const young = R() < 0.25;
      c = young ? blu : arm; b = (young ? 0.55 : 0.3) * (major ? 1 : 0.8) * (0.6 + 0.6 * R()); s = 1.6 + 1.4 * Math.pow(R(), 4);
    } else {                                                            // the disc between the arms
      const r = Math.sqrt(R()) * Rg, a = R() * Math.PI * 2;
      x = Math.cos(a) * r; z = Math.sin(a) * r; y = g() * 0.7;
      c = arm; b = 0.16 + 0.12 * R(); s = 1.6;
    }
    P.set([x, y, z], i * 3); S[i] = s; C.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(S, 1));
  geo.setAttribute("col", new THREE.BufferAttribute(C, 3));
  const mat = pointsMat(S1);
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group(), spin = new THREE.Group();
  spin.add(points); group.add(spin);
  // probes on the disc (points are invisible to the motion-blur probe): the centre, the Sun, two far rim points
  const place = probes(spin, 3);
  const sunR = SUN_LY / 1000, sunA = o.sunAngle ?? Math.PI * 0.92;
  place([[sunR * Math.cos(sunA), 0, sunR * Math.sin(sunA)], [Rg * 0.8, 0, 0], [0, 0, -Rg * 0.8]]);
  return {
    group, points, material: mat,
    sunAt: () => new THREE.Vector3(sunR * Math.cos(sunA), 0, sunR * Math.sin(sunA)).applyQuaternion(spin.quaternion).toArray(),
    centerAt: () => [0, 0, 0],
    set({ angle = 0, gain = 1 } = {}) { spin.rotation.y = -angle; mat.uniforms.uGain.value = gain; },
  };
};

export const createCloud = (o = {}) => {
  const n = o.n ?? 1500, Rc = o.radius ?? 50, R = rng(o.seed ?? 5), S1 = Math.min(window.W, window.H) / 1080;
  const P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z), r = Rc * Math.cbrt(R());
    P.set([s * Math.cos(a) * r, z * r * (o.flat ?? 1), s * Math.sin(a) * r], i * 3);
    const m = Math.pow(R(), 4), w = R(), b = 0.25 + 0.9 * m;
    S[i] = 1.8 + 2.2 * m;
    C.set(w < 0.5 ? [0.84 * b, 0.9 * b, 1.0 * b] : [1.0 * b, 0.98 * b, 0.9 * b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(S, 1));
  geo.setAttribute("col", new THREE.BufferAttribute(C, 3));
  const mat = pointsMat(S1), points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  const place = probes(group, 2);
  place([[Rc * 0.7, 0, 0], [0, 0, Rc * 0.7]]);
  return { group, points, material: mat };
};
