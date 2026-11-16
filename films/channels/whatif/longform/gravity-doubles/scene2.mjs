import * as THREE from "three";
// Possibility Lab long form, "What If Earth Spun Faster and Couldn't Stop?" (16:9). The picture as a pure function of t for the film kit's page:
// window.seek(t) sets the shot, the camera, the world and the overlay from t alone, then renders once.
//
// You stand on the equator under a sky whose pace is tied to ONE big live number, the length of a day (24 h falling to 1 h 24 min, never resetting), with your
// speed under it. Shots (compile.py picks one per beat): eye (your eye line), shoulder (over your shoulder), lift (you rise as the weight goes), globe (the planet:
// oblate, seas leaving the poles, storms, markers, debris) and tower (the energy bar). Hard cuts between them. Everything timed comes from film.json.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../../set/desk.js";
import { createFigure } from "../../set/anchor.js";
import { createRobot, makeEnv, POSES as ROBOT_POSES } from "../../set/robot.js";
import { titleFlap, injectCss } from "../../set/motif.js";
import { tok } from "../../set/look.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../../set/aces.js";
import { earthSurface } from "../../../space/set/planet.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
const V2 = !!FILM.v2;       // the v2 look: the high-tech Earth, the visor robot in the scene (film.json "v2": true)
const PORT = H > W;                                                        // vertical clips use the same scene, framed natively for 9:16
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 10, threshold: 0.95, bloom: 0.2 });
window.__focus = [0, 1.5, 0];
window.CINEMA_FOCUS = () => ({ point: window.__focus, fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF", AMB = "#E8A356";
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const basic = (hex, o = 1, depth = true) => new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthTest: depth, depthWrite: false });
const Mx = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3();

// ── the day length and the sky's phase, from the keys ───────────────────────
const KEYS = WD.keys, GM = WD.gm, R_EQ = WD.rEq * 1000;
const Th = (t) => { if (t <= KEYS[0][0]) return KEYS[0][1];
  for (let i = 0; i < KEYS.length - 1; i++) { const [a, ta] = KEYS[i], [b, tb] = KEYS[i + 1]; if (t <= b) return b - a < 1e-9 ? tb : Math.exp(Math.log(ta) + (Math.log(tb) - Math.log(ta)) * E.inout2(clamp01((t - a) / (b - a)))); }
  return KEYS[KEYS.length - 1][1]; };
const N_PH = Math.ceil(FILM.dur * 30) + 2, PH = new Float64Array(N_PH);
for (let i = 1; i < N_PH; i++) { const t = (i - 0.5) / 30; PH[i] = PH[i - 1] + (2 * Math.PI / WD.cycleS) * (WD.t0H / Th(t)) / 30; }
const phase = (t) => { const x = Math.max(0, t) * 30, i = Math.min(N_PH - 2, Math.floor(x)); return PH[i] + (PH[i + 1] - PH[i]) * (x - i); };
const dryAt = (t) => { const K = WD.dry; if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) { const u = (t - K[i][0]) / Math.max(1e-6, K[i + 1][0] - K[i][0]); return K[i][1] + (K[i + 1][1] - K[i][1]) * E.inout2(clamp01(u)); } return K[K.length - 1][1]; };
const weightFrac = (T) => 1 - Math.pow(WD.tOrbH / T, 2);

// ── the sky ─────────────────────────────────────────────────────────────────
const SKYV = `varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKYF = `precision highp float; uniform vec3 uSun; uniform float uDay; uniform float uGlow; varying vec3 vD;
${ACES_INV_GLSL}
void main() {
  vec3 d = normalize(vD); float el = d.y, sd = max(dot(d, uSun), 0.0);
  vec3 nightT = vec3(0.012, 0.018, 0.045), nightH = vec3(0.045, 0.055, 0.10), dayT = vec3(0.16, 0.36, 0.78), dayH = vec3(0.62, 0.74, 0.90);
  float k = pow(clamp(el, 0.0, 1.0), 0.55);
  vec3 col = mix(mix(nightH, nightT, k), mix(dayH, dayT, k), uDay);
  float low = 1.0 - smoothstep(0.0, 0.5, abs(uSun.y));
  col += (vec3(1.0, 0.52, 0.22) * pow(sd, 6.0) * 0.55 * low + vec3(1.0, 0.8, 0.55) * pow(sd, 40.0) * (0.35 + 0.6 * uDay)) * uGlow;
  if (el < 0.0) col = mix(col, vec3(0.02, 0.025, 0.04) + 0.10 * uDay, smoothstep(0.0, -0.15, el));
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const skyU = { uSun: { value: new THREE.Vector3(0, 0, -1) }, uDay: { value: 0 }, uGlow: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 24), new THREE.ShaderMaterial({ uniforms: skyU, vertexShader: SKYV, fragmentShader: SKYF, side: THREE.BackSide, depthWrite: false }));
sky.renderOrder = -10; sky.frustumCulled = false; sky.userData.noProbe = true; scene.add(sky);
const starG = new THREE.BufferGeometry(); { const n = 1800, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const z = 2 * rnd(i, 1) - 1, a = 6.2831853 * rnd(i, 2), r = Math.sqrt(1 - z * z); p[i * 3] = 1400 * r * Math.cos(a); p[i * 3 + 1] = 1400 * z; p[i * 3 + 2] = 1400 * r * Math.sin(a); }
  starG.setAttribute("position", new THREE.BufferAttribute(p, 3)); }
const starM = new THREE.PointsMaterial({ color: new THREE.Color(unlit(CHALK)), size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false });
const stars = new THREE.Points(starG, starM); stars.renderOrder = -9; stars.frustumCulled = false; stars.userData.noProbe = true; scene.add(stars);
const sunDisk = new THREE.Mesh(new THREE.CircleGeometry(1, 40), basic("#FFE7B0", 1, false)); sunDisk.renderOrder = -8; sunDisk.frustumCulled = false; sunDisk.userData.noProbe = true; scene.add(sunDisk);
const sunHalo = new THREE.Mesh(new THREE.CircleGeometry(1, 40), basic("#FFC47A", 0.22, false)); sunHalo.renderOrder = -8; sunHalo.frustumCulled = false; sunHalo.userData.noProbe = true; scene.add(sunHalo);

// ── the ground, you, the wind ───────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);
const you = createFigure({ tokens: TK, height: 1.7 });
scene.add(you.group);
const trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
  vertexShader: "varying vec2 q; void main(){ q = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; uniform float uK; void main(){ float x = abs(q.x - 0.5) * 2.0; float g = pow(1.0 - x * x, 2.0) * pow(q.y, 2.6); vec3 c = mix(vec3(0.35, 0.6, 1.0), vec3(0.92, 0.4, 1.0), 1.0 - q.y); gl_FragColor = vec4(c * g * 0.9 * uK, 1.0); }" })); trail.renderOrder = 9; trail.visible = false; trail.userData.noProbe = true; scene.add(trail);   // the soft trail under the robot during liftoff
const contact = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, vertexShader: "varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; void main(){ float d = length(q); float g = exp(-d*d*5.0); gl_FragColor = vec4(vec3(0.55, 0.45, 1.0) * g * 1.8, 1.0); }" })); contact.rotation.x = -Math.PI / 2; contact.renderOrder = 9; contact.visible = false; contact.userData.noProbe = true; scene.add(contact);   // a soft glow where the robot's feet meet the surface
let bot = null;
if (V2) { bot = createRobot({ height: 1.7 }); scene.add(bot.group); scene.environment = makeEnv(renderer);
  const kL = new THREE.DirectionalLight(0xffffff, 2.0), rL = new THREE.DirectionalLight(0x5aa0ff, 2.2), hL = new THREE.HemisphereLight(0xbcd0ff, 0x20242c, 0.6); scene.add(kL, rL, hL); window.__botLights = { kL, rL, hL }; }
const mixPose = (a, b, u) => { if (typeof a === "number" && typeof b === "number") return a + (b - a) * u; if (a && b && typeof a === "object") { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = k === "expr" ? (u < 0.5 ? a[k] : b[k]) : mixPose(a[k] ?? (typeof b[k] === "number" ? 0 : undefined), b[k] ?? (typeof a[k] === "number" ? 0 : undefined), u); return o; } return u < 0.5 ? a : b; };
const NW = 420, wind = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(CHALK, 0.5, false), NW); wind.frustumCulled = false; wind.renderOrder = 6; wind.userData.noProbe = true; wind.visible = false; scene.add(wind);
const NF = 320, dustF = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.5, false), NF); dustF.frustumCulled = false; dustF.renderOrder = 5; dustF.userData.noProbe = true; scene.add(dustF);
{ for (let i = 0; i < NF; i++) { const r = 0.012 + rnd(i, 5) * rnd(i, 6) * 0.04; S3.set(r, r, 1); P3.set((rnd(i, 7) - 0.5) * 24, 0.2 + rnd(i, 8) * 7, -3 - rnd(i, 9) * 40); Mx.compose(P3, Q0, S3); dustF.setMatrixAt(i, Mx); } dustF.instanceMatrix.needsUpdate = true; }

// ── the globe ───────────────────────────────────────────────────────────────
const GVS = `varying vec3 vN, vO; void main() { vO = normalize(normal); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GFS = `precision highp float; uniform vec3 uCol, uDark, uLight; uniform float uExposure, uSpin, uDry; uniform sampler2D uMap; varying vec3 vN, vO;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight)); vec3 col = mix(uDark, uCol, lam);
  vec3 o = normalize(vO); float lon = atan(o.x, o.z) + uSpin, lat = asin(clamp(o.y, -1.0, 1.0));
  vec3 tx = texture2D(uMap, vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5)).rgb;
  float water = step(tx.r + 0.04, tx.b);
  float dry = step(uDry * 0.0174533, abs(lat)) * water;
  tx = mix(tx, vec3(0.50, 0.42, 0.30), dry);
  col = mix(col, tx * (0.3 + 0.9 * lam) * 1.1, 0.78);
  float rim = pow(1.0 - clamp(dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.0); col += vec3(0.25, 0.4, 0.8) * rim * 0.35;
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const earthTex = new THREE.CanvasTexture(earthSurface({ width: 1024 })); earthTex.wrapS = THREE.RepeatWrapping; earthTex.anisotropy = 4;
const gU = { uCol: { value: new THREE.Vector3(...hexRgb(CHALK2)) }, uDark: { value: new THREE.Vector3(...hexRgb(CHALK2).map((v) => v * 0.28)) }, uLight: { value: new THREE.Vector3(-0.55, 0.45, 0.8) }, uExposure: { value: 1 }, uSpin: { value: 0 }, uDry: { value: 90 }, uMap: { value: earthTex } };
const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), new THREE.ShaderMaterial({ uniforms: gU, vertexShader: GVS, fragmentShader: GFS }));

// the high-tech Earth (v2): a glossy, glowing deep-blue ocean with flowing currents, grey relief land, a faint graticule, a glowing magenta equator with ticks and two ring arcs, a cyan rim and an atmosphere shell
const GVS2 = `varying vec3 vN, vO, vW; void main() { vO = normalize(normal); vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GFS2 = `precision highp float; uniform vec3 uLight; uniform float uExposure, uSpin, uDry, uT, uGlow; uniform sampler2D uMap, uMask; varying vec3 vN, vO, vW;
${ACES_INV_GLSL}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec3 n = normalize(vN), L = normalize(uLight), V = normalize(cameraPosition - vW); float lam = clamp(0.5 + 0.5 * dot(n, L), 0.0, 1.0);
  vec3 o = normalize(vO); float lon = atan(o.x, o.z) + uSpin, lat = asin(clamp(o.y, -1.0, 1.0));
  vec2 muv = vec2(fract(lon / 6.2831853 + 0.5), lat / 3.1415927 + 0.5); float Lm = texture2D(uMask, muv).r;
  float Lb = 0.25 * (texture2D(uMask, muv + vec2(0.0024, 0.0)).r + texture2D(uMask, muv - vec2(0.0024, 0.0)).r + texture2D(uMask, muv + vec2(0.0, 0.0024)).r + texture2D(uMask, muv - vec2(0.0, 0.0024)).r);
  float water = 1.0 - smoothstep(0.35, 0.65, Lm); float dry = step(uDry * 0.0174533, abs(lat)) * water; water *= (1.0 - dry);
  vec2 uv = vec2(lon * 2.6, lat * 4.2); float f1 = vn(uv * 1.7 + vec2(uT * 0.04, 0.0)), f2 = vn(uv * 3.9 - vec2(uT * 0.06, uT * 0.02));
  float streak = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(lat * 26.0 + f1 * 7.0 + f2 * 3.0 + uT * 0.25));
  vec3 ocean = mix(vec3(0.01, 0.04, 0.2), vec3(0.02, 0.26, 0.78), 0.2 + 0.65 * streak * (0.4 + 0.6 * lam));
  float dl = 0.0157; float latc = (floor(lat / dl) + 0.5) * dl; float lstep = dl / max(0.22, cos(latc)); float lonc = (floor(lon / lstep) + 0.5) * lstep;
  float Lc = texture2D(uMask, vec2(fract(lonc / 6.2831853 + 0.5), latc / 3.1415927 + 0.5)).r;
  float dd = length(vec2((lon - lonc) * cos(lat), lat - latc)); float dot_ = (1.0 - smoothstep(dl * 0.22, dl * 0.4, dd)) * smoothstep(0.4, 0.7, Lc);
  float coast = smoothstep(0.08, 0.45, Lb) * (1.0 - smoothstep(0.55, 0.92, Lb));
  vec3 land = vec3(0.045, 0.07, 0.13) * (0.7 + 0.6 * lam) + vec3(0.35, 0.85, 1.0) * dot_ * (0.55 + 0.6 * lam) + vec3(0.3, 0.9, 1.0) * coast * 0.9;
  vec3 seabed = vec3(0.12, 0.1, 0.08) * (0.4 + 0.6 * lam);
  vec3 col = mix(land, ocean * (0.5 + 0.6 * lam) + vec3(0.0, 0.03, 0.14), water); col = mix(col, seabed, dry);
  // glossy: a sharp highlight on water
  vec3 Hh = normalize(L + V); float spec = pow(max(dot(n, Hh), 0.0), 90.0) * (0.25 + 0.75 * water) * 1.1; col += vec3(0.7, 0.85, 1.0) * spec * 0.8;
  // graticule every 15 degrees (faint cyan), fading toward the poles
  float gl = 1.0 - smoothstep(0.0, 0.006, abs(fract(lat / 0.2618 + 0.5) - 0.5) * 0.2618); float gm = 1.0 - smoothstep(0.0, 0.006 / max(0.15, cos(lat)), abs(fract(lon / 0.2618 + 0.5) - 0.5) * 0.2618);
  col += vec3(0.25, 0.75, 1.0) * (gl + gm) * 0.16 * uGlow;
  // the glowing equator (magenta), tick marks every 5 degrees, and two partial ring arcs
  float eq = exp(-abs(lat) * 300.0) * 1.3 + exp(-abs(lat) * 60.0) * 0.1; float tick = smoothstep(0.88, 0.97, abs(fract(lon / 0.0873 + 0.5) * 2.0 - 1.0)) * exp(-abs(lat) * 55.0) * 0.5;
  float arcs = (exp(-abs(abs(lat) - 0.62) * 420.0) * (0.35 + 0.65 * smoothstep(-0.2, 0.7, sin(lon * 3.0 + uT * 0.35)))) * 0.45;
  col += vec3(1.0, 0.25, 0.85) * (eq + tick + arcs) * uGlow;
  // cyan rim and an ocean glow on the night side
  float fr = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0); col += vec3(0.18, 0.5, 1.0) * fr * 1.5 * uGlow + vec3(0.0, 0.04, 0.2) * water * (1.0 - lam) * 0.9;
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), uExposure), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
gU.uT = { value: 0 }; gU.uGlow = { value: 1 };
import landURL from "../../set/earth-land.js";
const landTex = await new Promise((res) => { const im = new Image(); im.onload = () => { const t = new THREE.Texture(im); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; res(t); }; im.src = landURL; });
gU.uMask = { value: landTex };
const AVS = `varying vec3 vNv; void main() { vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const AFS = `precision highp float; varying vec3 vNv; ${ACES_INV_GLSL} void main() { float i = pow(clamp(0.74 - dot(vNv, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 3.2); vec3 c = vec3(0.2, 0.55, 1.0) * i * 2.2; gl_FragColor = vec4(acesInv(srgbToLinear(clamp(c, 0.0, 1.0)), 1.0), 1.0); #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
let atmos = null;globe.renderOrder = 3; globe.frustumCulled = false; globe.userData.noProbe = true; globe.visible = false; scene.add(globe);
const dotMesh = (hex, order = 8, n = 1) => { const m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), basic(hex, 1, false), n); m.frustumCulled = false; m.renderOrder = order; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const markers = dotMesh(ANCH, 9, 3);                          // you at the equator, 45 N, the pole
const arrows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(AMB, 1, false), 3); arrows.frustumCulled = false; arrows.renderOrder = 9; arrows.userData.noProbe = true; arrows.visible = false; scene.add(arrows);
const NS = 3, NSP = 130, storms = dotMesh(CHALK, 7, NS * NSP);
const ND = 520, debris = dotMesh(AMB, 7, ND);
const planetG = new THREE.Group(); scene.add(planetG);
const eqGlow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 160), basic(AMB, 0.0, false)); eqGlow.rotation.x = Math.PI / 2; eqGlow.renderOrder = 8; eqGlow.userData.noProbe = true; eqGlow.visible = false; scene.add(eqGlow);
const water = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), new THREE.MeshBasicMaterial({ color: 0x3b8cff, transparent: true, opacity: 0.38, depthWrite: false })); water.renderOrder = 4; water.userData.noProbe = true; water.visible = false;
planetG.add(globe, water, markers, arrows, storms, debris, eqGlow);
if (V2) { globe.material = new THREE.ShaderMaterial({ uniforms: gU, vertexShader: GVS2, fragmentShader: GFS2 });
  atmos = new THREE.Mesh(new THREE.SphereGeometry(1.075, 64, 48), new THREE.ShaderMaterial({ vertexShader: AVS, fragmentShader: AFS, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmos.renderOrder = 2; atmos.frustumCulled = false; atmos.userData.noProbe = true; planetG.add(atmos); }
planetG.rotation.order = V2 ? "YXZ" : "XYZ"; planetG.rotation.z = -Math.PI / 2; if (V2) planetG.rotation.y = 0.95;      // v2: tipped about 24 degrees toward the camera so the equator arcs across the face of the globe                              // the pole axis is horizontal: the figure on the top is ON the equator

// ── the tower: all the spin energy, then and now ────────────────────────────
const TW = 6, TH = 58, tower = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(ANCH, 0.85, false)); tower.renderOrder = 5; tower.userData.noProbe = true; tower.visible = false; scene.add(tower);
const slice = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(AMB, 1, false)); slice.renderOrder = 6; slice.userData.noProbe = true; slice.visible = false; scene.add(slice);
const towerE = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TW, TH, TW)), new THREE.LineBasicMaterial({ color: new THREE.Color(CHALK), transparent: true, opacity: 0.8, depthTest: false })); towerE.renderOrder = 7; towerE.userData.noProbe = true; towerE.visible = false; scene.add(towerE);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
document.documentElement.style.setProperty("--hud-plate", "rgba(8, 9, 11, .88)");           // every caption keeps a dark plate, even over the Sun
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const beat = (id) => FILM.beats.find((b) => b.id === id);
// (the weight now shows in the readout's second line during the weight beats)
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: PORT ? 0.34 : 0.3 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "7vmin"; if (endFo) endFo.style.marginTop = "2vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "70vmin", margin: "2vmin auto 0" });
const dimEl = document.createElement("div"); dimEl.style.cssText = "position:absolute;inset:0;background:#171A1E;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dimEl);
// the one big live number: the length of a day, and your speed under it
const roEl = document.createElement("div");
roEl.style.cssText = "position:absolute;left:" + (PORT ? "6vw" : "5vw") + ";top:" + (PORT ? "8vh" : "21vh") + ";z-index:5;pointer-events:none;color:var(--hud-text);text-shadow:0 .2vmin 1.2vmin rgba(0,0,0,.55)";
roEl.innerHTML = '<div style="font:700 2.1vh/1 var(--font-text);letter-spacing:.16em;color:var(--hud-text-2)">LENGTH OF A DAY</div><div id="roT" style="font:800 ' + (PORT ? 'min(9vh,17vw)' : '15vh') + '/1.02 var(--font-display);letter-spacing:-.02em;font-variation-settings:\'wdth\' 85;margin-top:.8vh"></div>' +
  '<div style="margin-top:' + (PORT ? '1.4vh' : '2.4vh') + ';font:700 2.1vh/1 var(--font-text);letter-spacing:.16em;color:var(--hud-text-2)"><span id="roL2">YOUR SPEED AT THE EQUATOR</span></div><div id="roV" style="font:700 ' + (PORT ? 'min(3.6vh,7vw)' : '5.4vh') + '/1.1 var(--font-mono);color:' + AMB + ';margin-top:.8vh;font-variant-numeric:tabular-nums"></div>';
// soft dark scrim behind the readout so the white numbers hold 4.5:1 on a bright daytime sky
const scrim = document.createElement("div");
scrim.style.cssText = "position:absolute;left:0;top:0;width:" + (PORT ? "100vw" : "64vw") + ";height:" + (PORT ? "46vh" : "70vh") + ";z-index:4;pointer-events:none;background:radial-gradient(ellipse farthest-side at 28% 36%, rgba(6,9,16,.66) 0%, rgba(6,9,16,.5) 45%, rgba(6,9,16,0) 100%)";
document.body.appendChild(scrim); document.body.appendChild(roEl);
if (FILM.thumb) { roEl.style.display = "none"; scrim.style.display = "none"; }
if (FILM.v2 && FILM.hud3) roEl.style.display = "none";   // cover mode (film.json "thumb": true): the picture only, no readout
// the hook: a few big words in the top third for the first seconds (film.json "hook": {text, t0, t1}); no card, no logo
const hookEl = document.createElement("div"); hookEl.style.cssText = "position:absolute;left:6vw;right:6vw;top:" + (FILM.v2 ? "9vh" : PORT ? "30vh" : "8vh") + ";z-index:6;pointer-events:none;color:#fff;font:800 " + (PORT ? (FILM.hud3 ? "7.4vh" : "5.6vh") : "9vh") + "/1.04 var(--font-display);letter-spacing:-.01em;font-variation-settings:'wdth' 85;text-shadow:0 .3vmin 1.6vmin rgba(0,0,0,.85),0 0 .5vmin rgba(0,0,0,.9);opacity:0";

// ═════════════ Gravity Doubles, Part 1: the picture (a pure function of t) ═════════════
// Reuses the earth-spin v2 look: the high-tech Earth, the visor robot on top of it, the v3 HUD style. New here: an HOUR clock, a GRAVITY dial, a WEIGHT bar that overflows
// in magenta, a glossy ball whose bounce is integrated from real physics (same launch speed every hour), dashed peak lines, a x2 ring, a step block with a ghost rider,
// a tree whose branches sag with g, the payoff race to x1,048,576 (the globe shrinks to a pinpoint) and the first buckle of the cliffhanger.
import { makeCup, makePedestal, makeStair, makeSkeleton, makeTower, makeCity, makeOcean, makeMountain } from "./glimpses.js";
const GR = FILM.grav, BALL = GR.ball, GLM = GR.glims || [];
const V3 = true;
const PHYS = { g0: 8 * BALL.h0 / (BALL.T0 * BALL.T0), v0: 4 * BALL.h0 / BALL.T0 };            // peak h0 = v0^2 / 2 g0 ; one bounce lasts T0 = 2 v0 / g0 (hour 0)
// hour(t): keyed hours, eased between keys; the payoff race is its own exponential-ish ramp
const HK = GR.hours;                                                                              // [[t, hour], ...]
const hourAt = (t) => { if (t <= HK[0][0]) return HK[0][1];
  for (let i = 0; i < HK.length - 1; i++) { const [a, ha] = HK[i], [b, hb] = HK[i + 1]; if (t <= b) return b - a < 1e-9 ? hb : ha + (hb - ha) * (HK[i + 1][2] === "lin" ? clamp01((t - a) / (b - a)) : HK[i + 1][2] === "in" ? Math.pow(clamp01((t - a) / (b - a)), 2.2) : E.inout2(clamp01((t - a) / (b - a)))); }
  return HK[HK.length - 1][1]; };
const gAt = (t) => Math.pow(2, Math.min(hourAt(t), 3));                                          // physical gravity multiple (the payoff hours are display only)
// the dial's integer hour and when it last changed (for the thud)
const NT = Math.ceil(FILM.dur * 120) + 2, DIAL = new Int16Array(NT), LASTCH = new Float32Array(NT);
{ let last = 0, lt = -99; for (let i = 0; i < NT; i++) { const h = hourAt(i / 120), d = Math.floor(h + 0.02); if (d !== last) { last = d; lt = i / 120; } DIAL[i] = d; LASTCH[i] = lt; } }
const dialAt = (t) => DIAL[Math.min(NT - 1, Math.max(0, Math.round(t * 120)))], lastChange = (t) => LASTCH[Math.min(NT - 1, Math.max(0, Math.round(t * 120)))];
// the ball: integrate y'' = -g0 G(t), bounce back up with the same launch speed v0 every time (e = 1)
const BS = 480, BN = Math.ceil(FILM.dur * BS) + 2, BY = new Float32Array(BN);
{ let y = 0, v = PHYS.v0; for (let i = 0; i < BN; i++) { BY[i] = y; const t = i / BS, g = PHYS.g0 * gAt(t), dt = 1 / BS; v -= g * dt; y += v * dt; if (y <= 0) { y = -y * 0; v = PHYS.v0; } } }
const ballY = (t) => { const x = Math.max(0, t) * BS, i = Math.min(BN - 2, Math.floor(x)); return BY[i] + (BY[i + 1] - BY[i]) * (x - i); };
window.__ball = { y: ballY, g: gAt, PHYS };                                                       // for the physics check in QA

const MAG = "#EB63FF";
// ── the ball, its shadow glow, the dashed peak lines ──
const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: MAG, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, emissive: new THREE.Color("#7a1f90"), emissiveIntensity: 0.35, envMapIntensity: 1.2 }));
ball.userData.noProbe = true; scene.add(ball);
const ballGlow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
  vertexShader: "varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; uniform float uK; void main(){ float d = length(q); float g = exp(-d*d*6.0); gl_FragColor = vec4(vec3(0.9, 0.35, 1.0) * g * uK, 1.0); }" }));
ballGlow.rotation.x = -Math.PI / 2; ballGlow.renderOrder = 9; ballGlow.userData.noProbe = true; scene.add(ballGlow);
const dashMat = (hex) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, uniforms: { uC: { value: new THREE.Color(hex) }, uK: { value: 0 }, uL: { value: 1 } },
  vertexShader: "varying vec2 q; void main(){ q = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; uniform vec3 uC; uniform float uK, uL; void main(){ float d = step(0.5, fract(q.x * uL * 26.0)); float e = smoothstep(0.0, 0.08, q.y) * (1.0 - smoothstep(0.92, 1.0, q.y)); float rev = step(q.x, uK); gl_FragColor = vec4(uC * 1.6, d * e * rev * 0.95); }" });
const dash = [mkDash("#F4F2EC"), mkDash(MAG)];
function mkDash(hex) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.011), dashMat(hex)); m.renderOrder = 8; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; }
const tick = [0, 1].map((i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(unlit(i ? MAG : "#F4F2EC")), transparent: true, depthTest: false })); m.renderOrder = 9; m.visible = false; m.userData.noProbe = true; scene.add(m); return m; });
// ── the x2 ring (a billboard ring pulsing out of the globe) ──
const ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
  vertexShader: "varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; uniform float uK; void main(){ float d = length(q); float g = exp(-pow((d - 0.94) * 22.0, 2.0)); gl_FragColor = vec4(vec3(1.0, 0.38, 1.0) * g * uK * 1.7, 1.0); }" });
const ringM = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMat); ringM.renderOrder = 7; ringM.userData.noProbe = true; ringM.visible = false; scene.add(ringM);
const pinGlow = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
  vertexShader: "varying vec2 q; void main(){ q = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "varying vec2 q; uniform float uK; void main(){ float d = length(q); float halo = exp(-d * d * 7.0) * smoothstep(0.035, 0.1, d) + exp(-pow((d - 0.2) * 14.0, 2.0)) * 0.6; gl_FragColor = vec4(vec3(1.0, 0.5, 1.0) * halo * uK * 1.8, 1.0); }" }));
pinGlow.renderOrder = 8; pinGlow.userData.noProbe = true; pinGlow.visible = false; scene.add(pinGlow);
// ── the step block and the ghost rider ──
const stepMat = new THREE.MeshPhysicalMaterial({ color: "#26407a", roughness: 0.35, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.9 });
const stepBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34), stepMat); stepBox.userData.noProbe = true; stepBox.visible = false; scene.add(stepBox);
const stepEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.36, 0.1, 0.34)), new THREE.LineBasicMaterial({ color: new THREE.Color(unlit("#6fe0ff")), transparent: true, opacity: 0.9 })); stepEdge.visible = false; stepEdge.userData.noProbe = true; scene.add(stepEdge);
const ghost = createRobot({ height: 1.7 }); ghost.group.visible = false; scene.add(ghost.group);
ghost.group.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { m.transparent = true; m.opacity = 0.34; m.depthWrite = false; if (m.emissive) { m.emissive = new THREE.Color("#2a6cff"); m.emissiveIntensity = 0.5; } else if (m.color) m.color = new THREE.Color("#9fc2ff"); } o.renderOrder = 4; } });
// ── the tree: a glossy trunk, branches that sag with g, round crowns ──
const tree = new THREE.Group(); scene.add(tree); tree.visible = false;
const trunkM = new THREE.MeshPhysicalMaterial({ color: "#5b4636", roughness: 0.4, clearcoat: 0.5, envMapIntensity: 0.8 }), leafM = new THREE.MeshPhysicalMaterial({ color: "#3fd6a0", roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1, emissive: new THREE.Color("#0b5d4a"), emissiveIntensity: 0.5, envMapIntensity: 1.0 });
const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.62, 20), trunkM); trunk.position.y = 0.31; tree.add(trunk);
const crown = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 20), leafM); crown.position.y = 0.66; tree.add(crown);
const branches = [{ y: 0.42, s: -1, len: 0.3, up: 0.5 }, { y: 0.34, s: 1, len: 0.34, up: 0.42 }, { y: 0.5, s: 1, len: 0.24, up: 0.62 }, { y: 0.5, s: -1, len: 0.22, up: 0.55 }].map((b) => {
  const piv = new THREE.Group(); piv.position.set(0, b.y, 0); tree.add(piv);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, b.len, 12), trunkM); arm.rotation.z = -Math.PI / 2; arm.position.x = b.s * b.len / 2; piv.add(arm);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.058, 24, 16), leafM); tip.position.x = b.s * b.len; piv.add(tip);
  const gh = new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(unlit(MAG)), transparent: true, opacity: 0.0, wireframe: true, depthTest: false })); gh.position.x = b.s * b.len; piv.add(gh); gh.renderOrder = 9;
  return { ...b, piv, gh }; });
// ── v2 props: the cup on its pedestal, a 3-step stair, the skeleton beside it, the glimpse set pieces far from the globe, a small city ──
const FAR = { skel: [100, 0, 0], tower: [100, 0, -60], ocean: [100, 0, -120], mount: [100, 0, -180] };
const cup = makeCup(), ped = makePedestal(); scene.add(cup.group, ped.group); cup.group.visible = ped.group.visible = false;
const SPC = GR.step || { x0: 0.12, tread: 0.12, rise: 0.055 };
const stair = makeStair(3, SPC.tread, SPC.rise, 0.3, 0.07); scene.add(stair.group); stair.group.visible = false;
const skelB = makeSkeleton(); scene.add(skelB.group); skelB.group.visible = false;
const skelG = makeSkeleton(); skelG.group.position.set(...FAR.skel); scene.add(skelG.group); skelG.group.visible = false;
const towerG = makeTower(10); towerG.group.position.set(...FAR.tower); scene.add(towerG.group); towerG.group.visible = false;
const oceanG = makeOcean(); oceanG.group.position.set(...FAR.ocean); scene.add(oceanG.group); oceanG.group.visible = false;
const mountG = makeMountain(); mountG.group.position.set(...FAR.mount); scene.add(mountG.group); mountG.group.visible = false;
const city = makeCity(11); scene.add(city.group); city.group.visible = false;
const CITYX = [0.3, 0.42, 0.53, 0.63, -0.3, -0.42, -0.53, -0.63, 0.73, -0.73, 0.2];
const handDummy = new THREE.Object3D(); handDummy.position.set(0, -0.3, 0.04); if (bot) bot.parts.armL.el.add(handDummy);
const GLK = { skel: { scale: 0.58, cy: 0.49, dist: 3.1 }, tower: { scale: 0.62, cy: 0.39, dist: 3.1 }, ocean: { scale: 0.43, cy: -0.085, dist: 3.1 }, mount: { scale: 0.85, cy: 0.38, dist: 3.1 } };
// ── the dark dip for the pinpoint (a black overlay; no white flash) and the HUD ──
const dipEl = document.createElement("div"); dipEl.style.cssText = "position:absolute;inset:0;background:#02030a;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dipEl);
roEl.style.display = "none"; scrim.style.display = "none";
const h3 = document.createElement("div"); h3.style.cssText = "position:absolute;left:6vw;right:6vw;top:7vh;z-index:5;pointer-events:none;color:var(--hud-text);text-shadow:0 .2vmin 1.2vmin rgba(0,0,0,.6);opacity:0";
const ROBO = '<svg width="4.4vh" height="4.4vh" viewBox="0 0 40 40"><ellipse cx="20" cy="20" rx="17" ry="15" fill="#f4f5f7"/><ellipse cx="20" cy="21" rx="12" ry="9" fill="#05070a"/><ellipse cx="16" cy="20" rx="1.6" ry="2.4" fill="#fff"/><ellipse cx="24" cy="20" rx="1.6" ry="2.4" fill="#fff"/></svg>';
h3.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:flex-end"><div style="display:flex;align-items:baseline;gap:2.4vw"><div style="font:700 2.1vh/1 var(--font-text);letter-spacing:.2em;color:var(--hud-text-2)">GRAVITY</div>' +
  '<div id="gd" style="font:800 11vh/1 var(--font-display);letter-spacing:-.02em;font-variation-settings:\'wdth\' 85;transform-origin:0 70%">×1</div></div>' +
  '<div style="text-align:right"><div style="font:700 2vh/1 var(--font-text);letter-spacing:.2em;color:var(--hud-text-2)">HOUR</div><div id="gc" style="font:700 4.8vh/1 var(--font-mono);margin-top:.7vh;color:#fff">00:00</div></div></div>' +
  '<div id="gw" style="margin-top:2.4vh;display:flex;align-items:center;gap:2.2vw;opacity:1">' + ROBO + '<div style="font:700 2vh/1 var(--font-text);letter-spacing:.18em;color:var(--hud-text-2)">WEIGHT</div><div id="gwv" style="font:800 4.2vh/1 var(--font-display);margin-left:.6vw;min-width:17vw">100%</div>' +
  '<div style="flex:1;position:relative;height:1.3vh"><div style="position:absolute;left:0;top:0;bottom:0;width:50%;border-radius:1vh;background:rgba(255,255,255,.18)"><div id="gwb" style="height:100%;width:100%;border-radius:1vh;background:#8fd0ff"></div></div>' +
  '<div style="position:absolute;left:50%;top:-.5vh;bottom:-.5vh;width:.25vh;background:rgba(255,255,255,.7)"></div>' +
  '<div id="gwo" style="position:absolute;left:50%;top:0;bottom:0;width:0%;border-radius:0 1vh 1vh 0;background:linear-gradient(90deg,#c35cff,#EB63FF);box-shadow:0 0 1.8vh rgba(235,99,255,.9)"></div></div></div>';
document.body.appendChild(h3);
const chipEl = document.createElement("div"); chipEl.style.cssText = "position:absolute;left:50%;top:28vh;transform:translateX(-50%);z-index:6;pointer-events:none;white-space:normal;width:max-content;max-width:78vw;text-align:center;padding:1.3vh 3.4vw;border-radius:5vh;background:rgba(8,9,11,.82);border:.35vh solid #EB63FF;box-shadow:0 0 3vh rgba(235,99,255,.45);color:#fff;font:800 4.6vh/1.1 var(--font-display);font-variation-settings:'wdth' 85;opacity:0";
document.body.appendChild(chipEl);
if (FILM.hook) { hookEl.innerHTML = FILM.hook.text.replace("/", "<br>"); document.body.appendChild(hookEl); }
const badgeEl = document.createElement("div"); badgeEl.style.cssText = "position:absolute;left:50%;bottom:5.5vh;transform:translateX(-50%);z-index:6;pointer-events:none;font:600 2.2vh/1 var(--font-text);letter-spacing:.14em;color:#9ff0c8;background:rgba(8,9,11,.72);padding:1vh 2.6vw;border-radius:3vh;border-left:.5vh solid #EB63FF;opacity:0;white-space:nowrap"; badgeEl.textContent = "Thought experiment"; document.body.appendChild(badgeEl);
const gd = h3.querySelector("#gd"), gc = h3.querySelector("#gc"), gwv = h3.querySelector("#gwv"), gwb = h3.querySelector("#gwb"), gwo = h3.querySelector("#gwo"), gw = h3.querySelector("#gw");

// ── the robot poses of this part (the shared POSES plus knees, step and buckle) ──
const POSES2 = { ...ROBOT_POSES,
  crouch: { armL: { z: 0.3, e: 0.5 }, armR: { z: 0.3, e: 0.5 }, legL: { x: -0.55, k: 1.1 }, legR: { x: -0.55, k: 1.1 }, head: { x: -0.02 }, lean: 0.04, rise: -0.15, expr: "squint" },
  stepUp: { armL: { z: 0.5, x: 0.5, e: 0.5 }, armR: { z: 0.5, x: -0.5, e: 0.5 }, legL: { x: -0.9, k: 1.2 }, legR: { x: -0.15, k: 0.3 }, lean: 0.1, head: { x: 0.0 }, rise: -0.04, expr: "squint" },
  trudge: { armL: { z: 0.3, x: 0.3, e: 0.6 }, armR: { z: 0.3, x: -0.2, e: 0.6 }, legL: { x: -0.4, k: 0.8 }, legR: { x: -0.4, k: 0.8 }, lean: 0.16, head: { x: 0.04 }, rise: -0.1, expr: "squint" },
  buckle: { armL: { z: 0.9, e: 0.4 }, armR: { z: 0.9, e: 0.4 }, legL: { x: -0.8, k: 1.5 }, legR: { x: -0.7, k: 1.4 }, lean: 0.12, head: { x: 0.05 }, rise: -0.28, expr: "wide" },
  toss: { armL: { z: 0.4, x: 0.1 }, armR: { z: 1.0, x: -0.4, e: 0.3 }, head: { x: -0.2, y: -0.25 }, expr: "happy" },
  rideGhost: { armL: { z: 1.0, x: -1.1, e: 0.3 }, armR: { z: 1.0, x: -1.1, e: 0.3 }, lean: 0.25, head: { x: 0.1 }, expr: "neutral" },
};
const REACH = { z: 1.0, x: -0.12, e: 0.3 };
let HAND = { x: -0.3, y: 0.3 }; if (bot) { bot.group.position.set(0, 0, 0); bot.group.scale.setScalar(0.26); bot.set({ ...POSES2.stand, armL: REACH }); bot.group.updateMatrixWorld(true); const hp = new THREE.Vector3(); handDummy.getWorldPosition(hp); HAND = { x: hp.x, y: hp.y }; }
const kf = (K, t, key) => { let i = 0; while (i + 1 < K.length && t >= K[i + 1].t) i++; const A = K[i], B = K[Math.min(i + 1, K.length - 1)], u = A === B ? 0 : E.inout2(clamp01((t - A.t) / Math.max(0.01, B.t - A.t))); return { A, B, u }; };
const keyed1 = (K, t) => { const { A, B, u } = kf(K, t); return [A.x + (B.x - A.x) * u, A.y + (B.y - A.y) * u]; };
const fmtClock = (h) => { const m = Math.floor(h * 60 + 1e-6); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };

window.seek = function (t) {
  window.__t = t;
  const h = hourAt(t), G = gAt(t), dIdx = dialAt(t), thud = Math.exp(-(t - lastChange(t)) * 7) * (t - lastChange(t) < 0.6 ? 1 : 0);
  const RC = GR.race || { t0: 1e9, t1: 1e9 }, race = seg(t, RC.t0, RC.t1), inRace = t >= RC.t0 && t < RC.t1;
  const PINS = GR.pins || [[1e9, 1e9]], PIN = { t0: PINS[0][0], t1: PINS[0][1] };                                                    // the pinpoint teaser
  const pinU = Math.max(...PINS.map(([a, b]) => E.inout2(seg(t, a, a + (b - a) * 0.45)) * (1 - E.inout2(seg(t, b - 0.12, b)))));
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6)), beatId = (FILM.beats.find((b) => t >= b.t0 && t < b.t1) || {}).id;
  sky.visible = stars.visible = true; sunDisk.visible = sunHalo.visible = false; desk.group.visible = false; dustF.visible = false; wind.visible = false;
  skyU.uSun.value.set(0, 0.2, -1).normalize(); skyU.uDay.value = 0; skyU.uGlow.value = 0; stars.rotation.x = 0.01 * t; starM.opacity = 0.9;
  gU.uLight.value.set(-0.45, 0.35, 0.8).normalize(); gU.uExposure.value = 0.95;
  gU.uT.value = t * 0.7; gU.uSpin.value = 0.03 * t; gU.uDry.value = 90; gU.uGlow.value = 0.6 + 2.6 * pinU + 1.2 * Math.max(0, race - 0.2) * (inRace ? 1 : 0);
  // camera: the base pose then the part's cams (film.json "cams": [{t0, mode}]), each blended over 1.2 s
  const sw = 0.03 * Math.sin(t * 0.37), sh = 0.02 * Math.sin(t * 0.23), shake = thud * 0.012 * Math.sin(t * 90);
  const POSE = {
    grav: { pcy: -0.78, c: [0.1 + sw, 0.62 + sh, 3.0], l: [0.1, 0.55, 0], fov: 34, fs: 1.0 },
    grav2: { pcy: -0.78, c: [0.06 + sw, 0.56 + sh, 2.7], l: [0.05, 0.5, 0], fov: 34, fs: 1.0 },
    wide: { pcy: -0.62, c: [0.0 + sw, 0.0 + sh, 7.6], l: [0, -0.2, 0], fov: 34, fs: 0.85 },
    city: { pcy: -0.72, c: [0.0 + sw, 0.5 + sh, 4.5], l: [0, 0.25, 0], fov: 34, fs: 0.9 },
    step2: { pcy: -0.78, c: [0.12 + sw, 0.6 + sh, 3.15], l: [0.1, 0.52, 0], fov: 34, fs: 1.0 },
    step: { pcy: -0.78, c: [0.3 + sw, 0.58 + sh, 2.9], l: [0.28, 0.5, 0], fov: 34, fs: 1.0 },
    tree: { pcy: -0.78, c: [-0.18 + sw, 0.6 + sh, 3.0], l: [-0.2, 0.55, 0], fov: 34, fs: 1.0 },
    hero: { pcy: -0.74, c: [0.02 + sw, 0.62 + sh, 2.5], l: [0.0, 0.5, 0], fov: 34, fs: 1.0 },
  };
  let cur = { ...POSE.grav }; cur = { pcy: cur.pcy, c: cur.c.slice(), l: cur.l.slice(), fov: cur.fov, fs: cur.fs };
  const lm = (a, b, u) => a + (b - a) * u;
  for (const c of FILM.cams) if (t >= c.t0) { const P = POSE[c.mode], u = E.inout2(seg(t, c.t0, c.t0 + (c.dur || 1.2)));
    cur = { pcy: lm(cur.pcy, P.pcy, u), c: cur.c.map((v, i) => lm(v, P.c[i], u)), l: cur.l.map((v, i) => lm(v, P.l[i], u)), fov: lm(cur.fov, P.fov, u), fs: lm(cur.fs, P.fs, u) }; }
  const pcx = 0, pcy = cur.pcy, figS = cur.fs, ysc = figS * 0.26;
  camera.fov = cur.fov; camera.position.set(cur.c[0] + shake, cur.c[1], cur.c[2]); camera.lookAt(cur.l[0], cur.l[1], cur.l[2]);
  // a glimpse (about 1 s of the season ahead) takes over the camera, framed to leave the HUD and the label clear
  const gl = GLM.find((q) => t >= q.t0 && t < q.t1), gk = gl ? GLK[gl.kind] : null;
  if (gl) { const PF = FAR[gl.kind], span = 2 * gk.dist * Math.tan(17 * Math.PI / 180), lookY = PF[1] + gk.cy * 1.0 + 0.16 * span, dr = 0.12 * Math.sin(t * 1.3 + gl.t0);
    camera.fov = 34; camera.position.set(PF[0] + dr, lookY + 0.2, PF[2] + gk.dist); camera.lookAt(PF[0], lookY, PF[2]); }
  // the planet: shrinks to a pinpoint in the payoff teaser (and snaps back at PIN.t1)
  const pScale = 1 - 0.985 * pinU;
  planetG.position.set(pcx, pcy, 0); planetG.scale.setScalar(pScale); globe.visible = !gl; planetG.visible = !gl; globe.scale.set(1, 1, 1); if (atmos) { atmos.visible = true; atmos.scale.set(1, 1, 1); }
  markers.visible = arrows.visible = storms.visible = debris.visible = eqGlow.visible = water.visible = false; tower.visible = towerE.visible = slice.visible = false; you.group.visible = false; trail.visible = false;
  const groundY = (x) => pcy + Math.sqrt(Math.max(0, 1 - x * x)) * pScale;                      // the top of the globe at horizontal offset x

  pinGlow.visible = pinU > 0.02; if (pinGlow.visible) { pinGlow.position.set(pcx, pcy, 0.6); pinGlow.quaternion.copy(camera.quaternion); pinGlow.scale.setScalar(0.35 + 0.75 * pinU); pinGlow.material.uniforms.uK.value = pinU; }
  // the robot
  const robotOn = pScale > 0.5;
  const lerp1 = (a, b, u) => a + (b - a) * u;
  const stX = (i) => SPC.x0 + SPC.tread * (i - 0.5), stBase = groundY(SPC.x0 + 0.05) , stTop = (i) => stBase + SPC.rise * i;
  const rpK = (k) => k.s > 0 ? [stX(k.s), stTop(k.s) - groundY(stX(k.s))] : [k.x || 0, k.y || 0];
  const rp = (() => { const K = GR.rpos, { A, B, u } = kf(K, t, "rp"), a = rpK(A), b = rpK(B), hop = A.s !== B.s ? 0.04 * Math.sin(Math.PI * u) : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + hop]; })();
  if (bot) { bot.group.visible = robotOn; if (robotOn) {
      const { A, B, u } = kf(FILM.robot, t); const mk = (k) => ({ ...(typeof k.pose === "string" ? POSES2[k.pose] : (k.pose || {})), expr: k.expr || (typeof k.pose === "string" ? (POSES2[k.pose] || {}).expr : null) });
      const P = mixPose(mk(A), mk(B), u); P.head = { ...(P.head || {}), y: ((P.head && P.head.y) || 0) + 0.03 * Math.sin(t * 0.8) };
      const bk = GR.buckle ? E.inout2(seg(t, GR.buckle.t0, GR.buckle.t1)) : 0; if (bk > 0) { P.tilt = (P.tilt || 0) + 0.11 * bk * Math.sin((t - GR.buckle.t0) * 6); P.lean = (P.lean || 0) + 0.06 * bk * Math.sin((t - GR.buckle.t0) * 4.3); P.rise = (P.rise || 0) - 0.06 * bk * (0.5 + 0.5 * Math.sin((t - GR.buckle.t0) * 5)); }
      // the cup: the screen-left hand lifts it from the pedestal, then the arm dips with its weight (a premonition in line 1, for real at x2)
      const CU = GR.cup, cupOn = CU && t < CU.hide + 0.4 && pScale > 0.9;
      if (CU) { const lift = E.inout2(seg(t, CU.t0 - 0.3, CU.t0 + 0.5)), bump = E.inout2(seg(t, CU.p0, CU.p1)) * (1 - E.inout2(seg(t, CU.p2, CU.p3))), load = G + 0.85 * bump, rel = 1 - E.inout2(seg(t, CU.hide - 0.2, CU.hide + 0.3));
        if (rel > 0.01) P.armL = { z: lerp1(0.16, REACH.z - 0.3 * (load - 1), lift), x: REACH.x * lift, e: lerp1(0, REACH.e + 0.5 * (load - 1), lift) }; }
      bot.set(P); bot.group.scale.setScalar(ysc);
      const bx = pcx + rp[0], by = groundY(rp[0]) - 0.012 * ysc / 0.26 + rp[1] - (P.rise ? P.rise * 0 : 0);
      bot.group.position.set(bx, by, 0); bot.group.updateMatrixWorld(true);
      if (CU) { const k = ysc / 0.26, px = pcx + HAND.x * k, py0 = groundY(HAND.x * k), cupTopY = groundY(0) - 0.012 + HAND.y * k - 0.05; ped.group.visible = cupOn; cup.group.visible = cupOn;
        if (cupOn) { const hw = new THREE.Vector3(); handDummy.getWorldPosition(hw); const take = E.inout2(seg(t, CU.t0 + 0.25, CU.t1)), vs = 1 - E.inout2(seg(t, CU.hide - 0.2, CU.hide + 0.3));
          ped.group.position.set(px, py0, 0); ped.group.scale.set(1, Math.max(0.2, (cupTopY - py0) / ped.top), 1);
          cup.group.position.set(lerp1(px, hw.x, take), lerp1(cupTopY, hw.y - 0.02, take), lerp1(0, hw.z, take)); cup.group.scale.setScalar(Math.max(0.01, vs) * (ysc / 0.26)); cup.group.rotation.z = -0.08 * take * Math.sin(t * 3); ped.group.scale.x = ped.group.scale.z = Math.max(0.01, vs); } }
      contact.visible = true; contact.position.set(bx, groundY(rp[0]) + rp[1] + 0.003, 0); contact.scale.setScalar(0.3 * ysc / 0.26 + 0.04);
      const { kL, rL } = window.__botLights; kL.position.set(-0.45, 0.35, 0.8).normalize().multiplyScalar(8).add(new THREE.Vector3(2, 3, 5)); kL.intensity = 2.0; rL.position.set(-4, 2, -5);
      // the ghost rider (line 5)
      const gu = GR.ghost ? E.inout2(seg(t, GR.ghost.t0, GR.ghost.t0 + 0.5)) * (1 - E.inout2(seg(t, GR.ghost.t1 - 0.5, GR.ghost.t1))) : 0; ghost.group.visible = gu > 0.01;
      if (ghost.group.visible) { ghost.set({ ...POSES2.rideGhost, expr: "squint", rise: 0 }); ghost.group.scale.setScalar(ysc * 1.02); ghost.group.position.set(bx, by + 0.12 * (ysc / 0.26), -0.1);
        ghost.group.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.opacity = 0.34 * gu; } }); }
    } else ghost.group.visible = false; }
    // the stair (line 5) and the skeleton beside it
  { const SA = GR.stairVis, su = SA ? E.inout2(seg(t, SA.t0, SA.t0 + 0.5)) * (1 - E.inout2(seg(t, SA.t1 - 0.5, SA.t1))) : 0; stair.group.visible = su > 0.01 && pScale > 0.9 && !gl;
    if (stair.group.visible) { stair.group.position.set(pcx + SPC.x0, stBase - 0.0, 0.02); stair.group.scale.set(1, su, 1); }
    const SB = GR.skelB, sb = SB ? E.inout2(seg(t, SB.t0, SB.t0 + 0.5)) * (1 - E.inout2(seg(t, SB.t1 - 0.5, SB.t1))) : 0; skelB.group.visible = sb > 0.01 && pScale > 0.9 && !gl;
    if (skelB.group.visible) { skelB.group.position.set(pcx + SB.x, groundY(SB.x) - 0.005, 0); skelB.group.scale.setScalar(ysc); skelB.update(lerp1(SB.l0, SB.l1, E.inout2(seg(t, SB.tl0, SB.tl1))), sb); } }
  // the ball
  const bu = Math.max(0, ...(BALL.wins || [[0, 1e9]]).map(([a, b]) => E.inout2(seg(t, a, a + 0.35)) * (1 - E.inout2(seg(t, b - 0.35, b))))), bshow = bu > 0.01 && pScale > 0.9;
  ball.visible = ballGlow.visible = bshow;
  if (bshow) { const by0 = ballY(t), bx = pcx + BALL.x, gy = groundY(BALL.x), rr = BALL.r * ysc / 0.26; ball.scale.setScalar(rr * (0.9 + 0.1 * bu)); ball.position.set(bx, gy + rr + by0 * (ysc / 0.26), 0.05);
    ballGlow.position.set(bx, gy + 0.004, 0.05); ballGlow.scale.setScalar(0.16 * ysc / 0.26); ballGlow.material.uniforms.uK.value = 0.9 * Math.exp(-by0 * 14) * bu; }
  // the dashed peak lines: hour 0 (white) stays as the reference, hour 1 (magenta) is the new one at half the height
  (BALL.marks || []).forEach((mk, i) => { const m = dash[i], k = seg(t, mk.t0, mk.t0 + 0.5), off = (mk.t1 !== undefined) ? 1 - seg(t, mk.t1, mk.t1 + 0.4) : 1; m.visible = k > 0 && off > 0 && pScale > 0.9;
    if (m.visible) { const peak = PHYS.v0 * PHYS.v0 / (2 * PHYS.g0 * Math.pow(2, mk.hour)) * (ysc / 0.26), rr = BALL.r * ysc / 0.26, gy = groundY(BALL.x), yy = gy + rr + peak, x0 = pcx - 0.42, x1 = pcx + BALL.x + 0.16, len = x1 - x0;
      m.scale.set(len, 1, 1); m.position.set((x0 + x1) / 2, yy, 0.06); m.material.uniforms.uK.value = k; m.material.uniforms.uL.value = len; tick[i].visible = k > 0.95 && off > 0; tick[i].scale.setScalar(0.014); tick[i].position.set(x1, yy, 0.06); } else tick[i].visible = false; });
  // the x2 ring
  { let rk = 0, rr = 1; for (const p of (GR.rings || [])) { const u = (t - p) / 1.5; if (u > 0 && u < 1) { rk = Math.max(rk, Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.2)); rr = 1.0 + 0.95 * u; } }
    ringM.visible = rk > 0.01 && pScale > 0.9; if (ringM.visible) { ringM.position.set(pcx, pcy, 0.4); ringM.scale.setScalar(rr); ringM.quaternion.copy(camera.quaternion); ringMat.uniforms.uK.value = rk; } }
  // the tree: sag proportional to g
  const TR = GR.tree; if (TR) { const tu = E.inout2(seg(t, TR.t0, TR.t0 + 0.5)) * (1 - E.inout2(seg(t, TR.t1 - 0.5, TR.t1))); tree.visible = tu > 0.01 && pScale > 0.9;
    if (tree.visible) { tree.position.set(pcx + TR.x, groundY(TR.x) - 0.01, -0.05); tree.scale.setScalar((tu * 0.98 + 0.02) * 0.72);
      const sagU = E.inout2(seg(t, TR.sag0, TR.sag1)), sag = TR.k * sagU;                        // the tree starts relaxed (g = 1) and sags to g = 2 over TR.sag0..sag1
      for (const b of branches) { const th = b.s * (b.up - sag); b.piv.rotation.z = th;
        const wx = b.s * b.len * Math.cos(b.up), wy = b.len * Math.sin(b.up), ct = Math.cos(th), st = Math.sin(th);        // where the tip was (unsagged), in this pivot's turned frame
        b.gh.position.set(ct * wx + st * wy, -st * wx + ct * wy, 0); b.gh.visible = true; b.gh.material.opacity = 0.55 * Math.min(1, sagU * 3) * tu; } } }
  // glimpses: one set piece at a time, far from the globe; the main scene's own props hide
  skelG.group.visible = !!gl && gl.kind === "skel"; towerG.group.visible = !!gl && gl.kind === "tower"; oceanG.group.visible = !!gl && gl.kind === "ocean"; mountG.group.visible = !!gl && gl.kind === "mount";
  if (gl) { const u = E.inout2(seg(t, gl.t0 + 0.12, gl.t1 - 0.1)), ld = gl.load ? lerp1(gl.load[0], gl.load[1], u) : 1, sc = gk.scale;
    if (gl.kind === "skel") { skelG.group.scale.setScalar(sc); skelG.update(ld, 1); }
    if (gl.kind === "tower") { towerG.group.scale.setScalar(sc); towerG.update(ld, gl.bow ? lerp1(gl.bow[0], gl.bow[1], u) : 0, t, 1); }
    if (gl.kind === "ocean") { oceanG.group.scale.setScalar(sc); oceanG.update(Math.exp(lerp1(Math.log(gl.load[0]), Math.log(gl.load[1]), u)), t); }
    if (gl.kind === "mount") { const c0 = gl.t0 + 0.1; mountG.group.scale.setScalar(sc); mountG.group.rotation.y = -0.25; mountG.update(seg(t, c0, c0 + 0.35), t, t - (c0 + 0.4)); }
    bot.group.visible = false; ghost.group.visible = false; contact.visible = false; ball.visible = ballGlow.visible = false; ringM.visible = false; pinGlow.visible = false; tree.visible = false; cup.group.visible = ped.group.visible = false; stair.group.visible = skelB.group.visible = false; city.group.visible = false; }
  { const CT = GR.city, cu = CT ? E.inout2(seg(t, CT.t0, CT.t0 + 0.9)) * (1 - E.inout2(seg(t, CT.t1 - 0.2, CT.t1))) : 0; city.group.visible = cu > 0.01 && pScale > 0.9 && !gl;
    if (city.group.visible) city.items.forEach((it, i) => { const x = CITYX[i], g = it.grp, k = E.inout2(clamp01(cu * 1.6 - (i % 5) * 0.14)); g.position.set(pcx + x, groundY(x) - 0.004, 0.02 * (i % 3)); g.rotation.z = -Math.asin(Math.max(-0.95, Math.min(0.95, x / Math.max(0.01, pScale)))); g.scale.set(1.5, Math.max(0.001, k) * 1.5, 1.5); }); }
  // the HUD
  const dipP = Math.max(0, ...(GR.dips || []).map((d) => 1 - Math.abs(t - d) / 0.12)); const hookA = FILM.hook ? E.inout2(seg(t, FILM.hook.t0, FILM.hook.t0 + 0.25)) * (1 - E.inout2(seg(t, FILM.hook.t1 - 0.3, FILM.hook.t1))) : 0, vis = (1 - seg(t, FILM.endCard - 0.3, FILM.endCard)) * (1 - hookA);
  h3.style.opacity = String(vis.toFixed(3));
  const N = Math.pow(2, dIdx), txt = "×" + N.toLocaleString("en-US"); if (gd.textContent !== txt) gd.textContent = txt;
  const fsz = txt.length <= 3 ? 11 : txt.length <= 5 ? 9.4 : txt.length <= 7 ? 7.4 : txt.length <= 9 ? 6.0 : 4.6; gd.style.fontSize = fsz + "vh"; gd.style.letterSpacing = txt.length > 7 ? ".012em" : "-.02em"; gd.style.transform = "scale(" + (1 + 0.32 * thud).toFixed(3) + ")";
  gd.style.color = inRace ? MAG : "#fff"; gd.style.textShadow = inRace ? "0 0 2.4vh rgba(235,99,255,.8)" : "";
  gc.textContent = fmtClock(Math.min(h, 24)); gc.style.color = inRace ? MAG : "#fff";
  const wpc = 100 * G, wopa = 1 - E.inout2(seg(t, RC.t0 - 0.1, RC.t0 + 0.3)) * (inRace || t < RC.t1 ? 1 : 0) + E.inout2(seg(t, RC.t1, RC.t1 + 0.3)) * 0;
  gw.style.opacity = String((t >= RC.t0 - 0.1 && t < PIN.t1) ? 0 : 1); gwv.textContent = Math.round(wpc) + "%"; gwb.style.width = Math.min(100, wpc) + "%"; gwo.style.width = (50 * clamp01((wpc - 100) / 100)).toFixed(1) + "%"; gwv.style.color = wpc > 101 ? MAG : "#fff"; void wopa;
  { let co = 0, ct = ""; for (const c of FILM.chips) if (t >= c.t0 && t < c.t1) { co = E.inout2(seg(t, c.t0, c.t0 + 0.22)) * (1 - E.inout2(seg(t, c.t1 - 0.28, c.t1))); ct = c.text; }
    chipEl.style.opacity = String(co.toFixed(3)); if (ct) chipEl.textContent = ct; let bt = h3.children[0].getBoundingClientRect().bottom; if (Number(gw.style.opacity) > 0.05) bt = Math.max(bt, gw.getBoundingClientRect().bottom); chipEl.style.top = (bt + 0.014 * window.innerHeight) + "px"; }
  if (FILM.hook) hookEl.style.opacity = String(hookA.toFixed(3));
  // the end: dim under the end card; the dark dip of the pinpoint
  dimEl.style.opacity = String((0.86 * seg(t, FILM.endCard - 0.25, FILM.endCard + 0.3) * (1 - seg(t, FILM.dur - 0.75, FILM.dur - 0.05))).toFixed(3));
  dipEl.style.opacity = String(Math.max(0.42 * pinU, 0.92 * dipP).toFixed(3)); badgeEl.style.opacity = String((E.inout2(seg(t, 0.3, 0.7)) * (1 - E.inout2(seg(t, 4.5, 5.0))) * vis).toFixed(3));
  roEl.style.opacity = "0"; scrim.style.opacity = "0";
  hud.update(t); endEl.style.transform = "scale(" + (1 + 0.03 * seg(t, FILM.endCard, FILM.dur)).toFixed(4) + ")";
  const tail = E.inout2(seg(t, FILM.dur - 1.35, FILM.dur - 0.8)); if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t); void gate; void beatId; void h;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  renderer.render(scene, camera);
};
