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
