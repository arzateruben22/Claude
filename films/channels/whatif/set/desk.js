// desk.js — the graph-paper desk (films/channels/whatif/set): Back of the Envelope's ground, the one
// continuous world every episode stands on. Reused by every episode.
//
//   import { createDesk } from "../set/desk.js";
//   const desk = createDesk({ tokens: THEME.tokens, y: -7.6, unit: 1 });
//   scene.add(desk.group);
//   desk.update({ grid: 1, casters: [[x, y, z, r], ...], pool: [x, z] });   // in seek, before rendering
//
// An unlit floor composed in display colours and output through the finish's inverse (./aces.js), so the
// screen shows the tokens exactly:
//   - graphite paper, warmed toward graphite-hi in a soft pool under the desk lamp (pool centre in x, z);
//   - graph ruling in chalk: a minor line every `unit`, a major every 5 units, anti-aliased by their own
//     screen footprint and faded out where they would alias or crowd (and with distance, so the far paper
//     melts into the graphite behind it: the page's clear colour is graphite too);
//   - soft blob shadows under up to 6 casters [x, y, z, r] (the model, a car), the lamp a little to the left;
//   - a backdrop dome in graphite, so no pixel is the raw clear colour;
//   - a gentle shade under the apps' own UI (the bottom 26% and the right 18% of the frame), as Rest Frame's
//     cyc does, so the platform icons over it stay readable.
// The mesh never moves (its origin sits at the world origin), so the finish's motion probe reads the camera.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const VS = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = `
precision highp float;
uniform vec3 uGround, uHi, uRule;
uniform float uGrid, uUnit, uExposure, uFar;
uniform vec2 uRes, uPool;
uniform vec4 uCast[6];
varying vec3 vW;
${ACES_INV_GLSL}
float lines(float coord, float step, float widthPx) {
  float fw = max(fwidth(coord), 1e-5);
  float d = abs(fract(coord / step - 0.5) - 0.5) * step;
  float a = 1.0 - smoothstep(0.0, widthPx * fw, d);
  return a * clamp(1.6 - fw * 3.0 / step * 4.0, 0.0, 1.0);
}
void main() {
  vec2 q = vW.xz - uPool;
  float pool = exp(-dot(q, q) / 260.0);
  vec3 col = mix(uGround, uHi, 0.85 * pool);
  float sh = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 c = uCast[i];
    if (c.w <= 0.0) continue;
    float h = max(0.0, c.y - vW.y - c.w);
    vec2 o = vec2(c.x + 0.10 * h, c.z - 0.06 * h);
    float rad = c.w * (0.9 + h / 18.0);
    float d = length(vW.xz - o) / rad;
    sh = max(sh, (0.55 / (1.0 + h / 9.0)) * exp(-d * d * 1.8));
  }
  col *= 1.0 - sh;
  float dist = length(vW.xz - uPool);
  float fade = 1.0 - smoothstep(uFar * 0.45, uFar, dist);
  float minor = max(lines(vW.x, uUnit, 1.0), lines(vW.z, uUnit, 1.0));
  float major = max(lines(vW.x, 5.0 * uUnit, 1.4), lines(vW.z, 5.0 * uUnit, 1.4));
  col = mix(col, uRule, uGrid * fade * max(0.045 * minor, 0.085 * major));
  col = mix(uGround, col, 0.35 + 0.65 * fade);
  vec2 f = gl_FragCoord.xy / uRes;
  float zone = max(1.0 - smoothstep(0.0, 0.26, f.y), smoothstep(0.82, 1.0, f.x));
  col = mix(col, uGround * 0.92, zone * zone * (3.0 - 2.0 * zone));
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createDesk = (o = {}) => {
  const tk = o.tokens || {}, W = o.W ?? window.W, H = o.H ?? window.H;
  const hex = (k, d) => new THREE.Vector3(...hexRgb(tk[k] || d));
  const uniforms = {
    uGround: { value: hex("graphite", "#171A1E") }, uHi: { value: hex("graphite-hi", "#21242A") }, uRule: { value: hex("chalk", "#F4F2EC") },
    uGrid: { value: 1 }, uUnit: { value: o.unit ?? 1 }, uExposure: { value: o.exposure ?? 1 }, uFar: { value: o.far ?? 70 },
    uRes: { value: new THREE.Vector2(W, H) }, uPool: { value: new THREE.Vector2(0, 0) },
    uCast: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
  const g = new THREE.PlaneGeometry(800, 800, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: FS, extensions: { derivatives: true } });
  const floor = new THREE.Mesh(g, mat);
  floor.frustumCulled = false; floor.renderOrder = -10;
  // the backdrop: a dome far behind everything in plain graphite (the floor fades into it), so nothing in
  // the frame is the raw clear colour (which neither the plain path nor the finish grades the same way)
  const domeU = { uGround: uniforms.uGround, uExposure: uniforms.uExposure };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({ uniforms: domeU, side: THREE.BackSide, depthWrite: false,
    vertexShader: VS, fragmentShader: `
precision highp float;
uniform vec3 uGround; uniform float uExposure;
varying vec3 vW;
${ACES_INV_GLSL}
void main() {
  vec3 col = uGround;
  gl_FragColor = vec4(acesInv(srgbToLinear(col), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` }));
  dome.frustumCulled = false; dome.renderOrder = -20; dome.userData.noProbe = true;
  const group = new THREE.Group();
  group.position.y = o.y ?? 0;
  group.add(dome, floor);
  const update = (s = {}) => {
    uniforms.uGrid.value = s.grid ?? 1;
    if (s.pool) uniforms.uPool.value.set(s.pool[0], s.pool[1]);
    const cs = s.casters || [];
    for (let i = 0; i < 6; i++) { const c = cs[i]; uniforms.uCast.value[i].set(c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? c[3] : 0); }
  };
  return { group, floor, uniforms, update };
};
