// ladder05.js — the powers-of-ten dive and the planet (films/channels/whatif/set), built for No. 005
// ("Everybody jump"); any episode that needs to fall through many decades of size can reuse them.
//
//   import { createLadder, createPlanet } from "../set/ladder05.js";
//   const L = createLadder({ tokens, items: [{ kind: "ring" | "bar" | "fuzz", size: m, color: "anchor" | "chalk" | "marker" }, ...] });
//   scene.add(L.mesh);
//   L.set({ z: log10(the frame's width in metres), opacity: 0–1, grow: { index: 0–1 } })   // in seek
//   L.screen(i)  → [px, py, rpx]: where item i's right edge sits on screen (for a HUD label), and its radius in px
//
//   const P = createPlanet({ tokens, R: 6.371e6 });    // a sphere of radius R resting on the desk at the origin
//   scene.add(P.mesh);  P.set({ opacity, dot: radius of the marker dot at the top (m), dotOpacity, grid: graticule 0–1, cam })
//
// The ladder is a screen-aligned quad drawn over the 3D world (depth test off), so it cannot lose precision at
// any scale: every size is compared with 10^z in the fragment shader, decade by decade. It draws graph paper
// (a decade's ruling, fading in as the next decade's fades out, so the zoom is endless and never aliases),
// and each item, centred, when its size on screen is between a few pixels and a few frames: a ring (a hair's
// width, a cell), a fuzzy disc (an atom: its electron cloud), or a vertical I-bar (a length: the jump, the
// Earth's step). Colours are the theme's tokens, composed in display space and output through the finish's
// inverse (./aces.js), like the desk. The planet is the same idea in 3D: graphite with a chalk graticule and
// rim, so a pull-back past the paper's horizon finds the Earth under the crowd.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

const MAXI = 8;
const VS = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uZ, uOpacity, uExposure;
uniform vec3 uGround, uRule, uCol[${MAXI}];
uniform vec4 uItem[${MAXI}];          // x: kind (0 off, 1 ring, 2 bar, 3 fuzz), y: log10(size m), z: grow 0-1, w: unused
varying vec2 vUv;
${ACES_INV_GLSL}
float aa(float d, float px) { return 1.0 - smoothstep(0.0, px, d); }
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.x;           // in frame widths, centred
  float pxw = 1.0 / uRes.x;                                    // one pixel in frame widths
  vec3 col = uGround;
  // graph paper: the two decades whose spacing is between ~6 px and ~1/3 frame, cross-faded
  float d0 = floor(uZ) - 1.0;
  for (int k = 0; k < 3; k++) {
    float dec = d0 - float(k) + 1.0;
    float sp = pow(10.0, dec - uZ);                            // the ruling's spacing in frame widths
    float a = smoothstep(6.0 * pxw, 40.0 * pxw, sp) * (1.0 - smoothstep(0.25, 0.9, sp));
    vec2 q = abs(fract(p / sp + 0.5) - 0.5) * sp;
    float ln = max(aa(q.x, 1.2 * pxw), aa(q.y, 1.2 * pxw));
    col = mix(col, uRule, a * ln * 0.085);
  }
  float r = length(p);
  for (int i = 0; i < ${MAXI}; i++) {
    vec4 it = uItem[i];
    if (it.x < 0.5) continue;
    float s = pow(10.0, it.y - uZ) * it.z;                     // the item's size in frame widths (grow scales it)
    float vis = smoothstep(2.0 * pxw, 8.0 * pxw, s) * (1.0 - smoothstep(1.4, 3.0, s));
    if (vis <= 0.0) continue;
    vec3 c = uCol[i];
    if (it.x < 1.5) {                                          // a ring: its diameter is the size
      float w = max(2.4 * pxw, 0.012 * s);
      col = mix(col, c, vis * aa(abs(r - 0.5 * s), w));
    } else if (it.x < 2.5) {                                   // a vertical I-bar: its length is the size
      float w = 3.0 * pxw, cap = max(10.0 * pxw, 0.12 * s);
      float stem = aa(abs(p.x), w) * step(abs(p.y), 0.5 * s);
      float caps = aa(abs(abs(p.y) - 0.5 * s), w) * step(abs(p.x), cap);
      col = mix(col, c, vis * max(stem, caps));
    } else {                                                   // a fuzzy disc: an atom's cloud
      float g = exp(-pow(r / (0.5 * s), 2.0) * 2.2);
      col = mix(col, c, vis * 0.55 * g);
      col = mix(col, c, vis * aa(abs(r - 0.5 * s), 1.5 * pxw) * 0.6);
    }
  }
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createLadder = (o = {}) => {
  const tk = o.tokens || {}, W = o.W ?? window.W, H = o.H ?? window.H;
  const v3 = (k, d) => new THREE.Vector3(...hexRgb(tk[k] || k || d));
  const items = (o.items || []).slice(0, MAXI);
  const u = {
    uRes: { value: new THREE.Vector2(W, H) }, uZ: { value: 0 }, uOpacity: { value: 0 }, uExposure: { value: o.exposure ?? 1 },
    uGround: { value: v3("graphite", "#171A1E") }, uRule: { value: v3("chalk", "#F4F2EC") },
    uCol: { value: Array.from({ length: MAXI }, (_, i) => (items[i] ? v3(items[i].color, "#F4F2EC") : new THREE.Vector3())) },
    uItem: { value: Array.from({ length: MAXI }, (_, i) => new THREE.Vector4(items[i] ? { ring: 1, bar: 2, fuzz: 3 }[items[i].kind] : 0, items[i] ? Math.log10(items[i].size) : 0, 1, 0)) },
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false }));
  mesh.frustumCulled = false; mesh.renderOrder = 50; mesh.userData.noProbe = true;
  const set = (s = {}) => {
    if (s.z !== undefined) u.uZ.value = s.z;
    if (s.opacity !== undefined) { u.uOpacity.value = s.opacity; mesh.visible = s.opacity > 0.002; }
    if (s.grow) for (const [i, g] of Object.entries(s.grow)) u.uItem.value[i].z = g;
  };
  // item i on screen: its right edge (a ring or disc) or its top cap's right end (a bar), and its radius, in px
  const screen = (i) => {
    const it = items[i], s = Math.pow(10, Math.log10(it.size) - u.uZ.value) * u.uItem.value[i].z * W;
    return it.kind === "bar" ? [W / 2 + Math.max(10, 0.12 * s), H / 2 - s / 2, s / 2] : [W / 2 + s / 2, H / 2, s / 2];
  };
  return { mesh, set, screen, uniforms: u };
};

const PVS = `
varying vec3 vN, vP;
void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PFS = `
precision highp float;
uniform vec3 uGround, uRule, uDot, uCam; uniform float uOpacity, uExposure, uDotA, uDotR, uR, uGrid;
varying vec3 vN, vP;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN);
  float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.z, n.x);
  float st = radians(15.0);
  vec2 g = vec2(lat, lon) / st;
  vec2 fw = fwidth(g);
  vec2 q = abs(fract(g + 0.5) - 0.5) / max(fw, 1e-5);
  float grat = 1.0 - smoothstep(0.6, 1.6, min(q.x, q.y));
  float rim = pow(1.0 - abs(dot(n, normalize(uCam - vP))), 3.0);
  vec3 col = mix(uGround * 1.18, uRule, 0.10 * grat * uGrid + 0.35 * rim);
  float d = acos(clamp(n.y, -1.0, 1.0)) * uR;                    // distance from the top (north pole), m
  float dw = max(fwidth(d), 1.0);
  col = mix(col, uDot, uDotA * (1.0 - smoothstep(uDotR - dw, uDotR + dw, d)));
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createPlanet = (o = {}) => {
  const tk = o.tokens || {}, R = o.R ?? 6.371e6;
  const v3 = (k, d) => new THREE.Vector3(...hexRgb(tk[k] || d));
  const u = { uGround: { value: v3("graphite", "#171A1E") }, uRule: { value: v3("chalk", "#F4F2EC") }, uDot: { value: v3("marker", "#EB63FF") },
    uCam: { value: new THREE.Vector3() }, uOpacity: { value: 1 }, uExposure: { value: o.exposure ?? 1 }, uDotA: { value: 0 }, uDotR: { value: 1 }, uR: { value: R }, uGrid: { value: 1 } };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.ShaderMaterial({ uniforms: u, vertexShader: PVS, fragmentShader: PFS, transparent: true, extensions: { derivatives: true } }));
  mesh.position.set(0, -R, 0);                                    // resting on the desk at the origin: the crowd stands on its top
  mesh.renderOrder = -8;
  const set = (s = {}) => {
    if (s.opacity !== undefined) { u.uOpacity.value = s.opacity; mesh.visible = s.opacity > 0.002; }
    if (s.dot !== undefined) u.uDotR.value = s.dot;
    if (s.dotOpacity !== undefined) u.uDotA.value = s.dotOpacity;
    if (s.cam) u.uCam.value.set(...s.cam);
    if (s.grid !== undefined) u.uGrid.value = s.grid;                // the graticule (fade it out close up, where its meridians crowd into the pole)
  };
  return { mesh, set, R };
};
