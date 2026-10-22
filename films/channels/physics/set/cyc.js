// cyc.js — B1 Stage, "the Bench" (films/channels/physics/set): Rest Frame's warm-paper cyclorama, ruled like
// a measuring board and lit like a high-speed photo studio, built in centimetres. Reused by every episode.
//
//   import { createCyc } from "../set/cyc.js";
//   const cyc = createCyc({ W, H, tokens: THEME.tokens });
//   scene.add(cyc.group);
//   cyc.update({ grid: 1, casters: [[x, y, z, r], ...] });    // in seek, before rendering
//
// What it is:
//   - a floor (a 12 m disc, ruled in world x and z every 5 cm, a stronger line every 10 cm) and a wall that
//     wraps around the back and the left of the stage as a cylinder (radius 260 cm about (40, 200), from
//     200° round to 315°, open on the right so a camera turned 70° from the front still sees in), joined
//     to the floor by a 45 cm cove, so the camera can turn 90° and still see paper behind the subject. The
//     back wall stands 60 cm behind the plane the props fall in (z = 0); the wall is ruled along its own
//     arc length, with no numbers: it is not in the subject's plane, so its lines don't measure heights
//     (the meter stick and the floor lines at z = 0 do).
//   - an unlit shader that composes the look in display colours (sRGB tokens: cyc, cyc-hi, shade, the rule
//     colour) and outputs the finish's ACES inverse (./aces.js), so the screen shows the tokens exactly:
//       · the light pool (cyc-hi) behind the subject, a soft 3D falloff around (26, 50, −60);
//       · a gentle cove shading where floor meets wall;
//       · soft blob shadows on the floor under up to 8 casters [x, y, z, r] (balls, the post, the stick);
//       · the `shade` falloff in screen space under the apps' own UI (bible §2: the bottom 480 px and the
//         right 140 px of 1080 × 1920): a soft vignette that starts at the caption line (y 1325) and at
//         x 864 and reaches `shade` at the frame's edge, so the apps' white icons stay readable (3.7:1 on shade);
//       · rulings anti-aliased by their own screen footprint, fading out where they would alias.
//   - `grid` (0–1) fades the ruling (the bible's grid(t)).
// Mesh origins sit at the world origin and never move, so the finish's motion probe reads the camera,
// not the set. Shader output in the plain (animatic) path goes through three's ACES + sRGB chunks, and in
// the finish path into the linear target the finish tone-maps, so both paths land on the same colours.
import * as THREE from "three";
import { ACES_INV_GLSL, hexRgb } from "./aces.js";

export const CYC = { cx: 40, cz: 200, R: 260, Rc: 45, Hw: 420, phi0: (-200 * Math.PI) / 180, phi1: (-45 * Math.PI) / 180 };

const VS = `
attribute vec2 rule;
varying vec3 vW; varying vec2 vRule;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vRule = rule;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS = `
precision highp float;
uniform vec3 uCyc, uHi, uShade, uRule;
uniform float uGrid, uFloor, uExposure;
uniform vec2 uRes;
uniform vec4 uCast[8];
uniform vec3 uPool; uniform vec3 uPoolS;
uniform vec3 uCyl;          // cx, cz, rho where the cove starts
uniform vec2 uSweep;        // phi0, phi1 of the wall
varying vec3 vW; varying vec2 vRule;
${ACES_INV_GLSL}
float lines(float coord, float step, float widthPx) {
  float fw = max(fwidth(coord), 1e-5);
  float d = abs(fract(coord / step - 0.5) - 0.5) * step;      // distance to the nearest line, in the coordinate's units
  float a = 1.0 - smoothstep(0.0, widthPx * fw, d);
  return a * clamp(1.6 - fw * 3.0 / step * 4.0, 0.0, 1.0);    // fades out before the lines get closer than ~3 px
}
void main() {
  // the floor is not drawn where the cove takes over (inside the wall's sweep)
  if (uFloor > 0.5) {
    vec2 q = vW.xz - uCyl.xy; float rho = length(q), phi = atan(q.y, q.x);
    float ph = phi > 0.5 ? phi - 6.2831853 : phi;
    if (rho > uCyl.z && ph >= uSweep.x && ph <= uSweep.y) discard;
  }
  vec3 P = (vW - uPool) / uPoolS;
  float pool = exp(-dot(P, P));
  vec3 col = mix(uCyc, uHi, pool);
  // the cove: a touch darker where floor turns into wall
  if (uFloor < 0.5) col *= 1.0 - 0.05 * exp(-pow((vW.y - 14.0) / 16.0, 2.0));
  // blob shadows on the floor
  if (uFloor > 0.5 || vW.y < 2.0) {
    float sh = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 c = uCast[i];
      if (c.w <= 0.0) continue;
      float h = max(0.0, c.y - c.w);
      vec2 o = vec2(c.x + 0.18 * h, c.z - 0.22 * h);
      float rad = c.w * (0.95 + h / 34.0);
      float d = length(vW.xz - o) / rad;
      sh = max(sh, (0.5 / (1.0 + h / 22.0)) * exp(-d * d * 1.6));
    }
    col = mix(col, uShade * 0.86, sh);
  }
  // rulings: the floor in world x and z, the wall along its own arc length (vRule)
  vec2 rc = uFloor > 0.5 ? vec2(vW.x, -vW.z) : vRule;
  float minor = max(lines(rc.x, 5.0, 1.1), lines(rc.y, 5.0, 1.1));
  float major = max(lines(rc.x, 10.0, 1.5), lines(rc.y, 10.0, 1.5));
  col = mix(col, uRule, uGrid * max(0.10 * minor, 0.19 * major));
  // the apps' UI zones: bottom 480 px and right 140 px of 1080 x 1920 fall off to shade
  vec2 f = gl_FragCoord.xy / uRes;                            // y from the bottom
  float zone = max(1.0 - smoothstep(0.0, 0.31, f.y), smoothstep(0.80, 1.0, f.x));   // a soft vignette: full shade only at the very edge
  col = mix(col, uShade, zone * zone * (3.0 - 2.0 * zone));
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const createCyc = (o = {}) => {
  const tk = o.tokens || {}, W = o.W ?? window.W, H = o.H ?? window.H;
  const hex = (k, d) => hexRgb(tk[k] || d);
  const uniforms = {
    uCyc: { value: new THREE.Vector3(...hex("cyc", "#E6E2D8")) },
    uHi: { value: new THREE.Vector3(...hex("cyc-hi", "#F1EEE7")) },
    uShade: { value: new THREE.Vector3(...hex("shade", "#8A857B")) },
    uRule: { value: new THREE.Vector3(...hex("ghost", "#6E6A62")) },
    uGrid: { value: 1 }, uFloor: { value: 0 }, uExposure: { value: o.exposure ?? 1 },
    uRes: { value: new THREE.Vector2(W, H) },
    uCast: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uPool: { value: new THREE.Vector3(...(o.pool || [26, 50, -60])) },
    uPoolS: { value: new THREE.Vector3(...(o.poolSize || [120, 72, 150])) },
    uCyl: { value: new THREE.Vector3(CYC.cx, CYC.cz, CYC.R - CYC.Rc) },
    uSweep: { value: new THREE.Vector2(CYC.phi0, CYC.phi1) },
  };
  const mat = (floor) => {
    const u = { ...uniforms, uFloor: { value: floor ? 1 : 0 } };
    return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: FS, extensions: { derivatives: true }, side: THREE.DoubleSide });
  };
  // the wall: (phi, profile) grid; profile = cove arc then the straight wall; `rule` = (arc length around, arc length up)
  const NP = 96, NC = 18, pos = [], rule = [], idx = [];
  const prof = [];
  for (let j = 0; j <= NC; j++) { const a = (j / NC) * Math.PI / 2; prof.push([CYC.R - CYC.Rc + CYC.Rc * Math.sin(a), CYC.Rc - CYC.Rc * Math.cos(a), CYC.Rc * a]); }
  prof.push([CYC.R, CYC.Hw, CYC.Rc * Math.PI / 2 + (CYC.Hw - CYC.Rc)]);
  for (let i = 0; i <= NP; i++) {
    const phi = CYC.phi0 + (CYC.phi1 - CYC.phi0) * (i / NP), c = Math.cos(phi), s = Math.sin(phi);
    for (const [rho, y, sl] of prof) { pos.push(CYC.cx + rho * c, y, CYC.cz + rho * s); rule.push((phi - CYC.phi0) * CYC.R, sl); }
  }
  const NJ = prof.length;
  for (let i = 0; i < NP; i++) for (let j = 0; j < NJ - 1; j++) {
    const a = i * NJ + j, b = (i + 1) * NJ + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  wg.setAttribute("rule", new THREE.Float32BufferAttribute(rule, 2));
  wg.setIndex(idx);
  const wall = new THREE.Mesh(wg, mat(false));
  const fg = new THREE.PlaneGeometry(1200, 1200, 1, 1); fg.rotateX(-Math.PI / 2); fg.translate(CYC.cx, 0, CYC.cz);
  fg.setAttribute("rule", new THREE.Float32BufferAttribute(new Array(8).fill(0), 2));
  const floor = new THREE.Mesh(fg, mat(true));
  for (const m of [wall, floor]) { m.frustumCulled = false; m.renderOrder = -10; }
  const group = new THREE.Group();
  group.add(floor, wall);

  const update = (s = {}) => {
    uniforms.uGrid.value = s.grid ?? 1;
    const cs = s.casters || [];
    for (let i = 0; i < 8; i++) { const c = cs[i]; uniforms.uCast.value[i].set(c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0, c ? c[3] : 0); }
  };
  return { group, wall, floor, uniforms, update };
};
