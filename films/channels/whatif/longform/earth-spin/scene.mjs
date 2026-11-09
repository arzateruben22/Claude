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
import { titleFlap, injectCss } from "../../set/motif.js";
import { tok } from "../../set/look.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../../set/aces.js";
import { earthSurface } from "../../../space/set/planet.js";

const FILM = window.FILM, W = window.W, H = window.H, WD = FILM.world, CUE = FILM.cue;
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
const SKYF = `precision highp float; uniform vec3 uSun; uniform float uDay; varying vec3 vD;
${ACES_INV_GLSL}
void main() {
  vec3 d = normalize(vD); float el = d.y, sd = max(dot(d, uSun), 0.0);
  vec3 nightT = vec3(0.012, 0.018, 0.045), nightH = vec3(0.045, 0.055, 0.10), dayT = vec3(0.16, 0.36, 0.78), dayH = vec3(0.62, 0.74, 0.90);
  float k = pow(clamp(el, 0.0, 1.0), 0.55);
  vec3 col = mix(mix(nightH, nightT, k), mix(dayH, dayT, k), uDay);
  float low = 1.0 - smoothstep(0.0, 0.5, abs(uSun.y));
  col += vec3(1.0, 0.52, 0.22) * pow(sd, 6.0) * 0.55 * low + vec3(1.0, 0.8, 0.55) * pow(sd, 40.0) * (0.35 + 0.6 * uDay);
  if (el < 0.0) col = mix(col, vec3(0.02, 0.025, 0.04) + 0.10 * uDay, smoothstep(0.0, -0.15, el));
  gl_FragColor = vec4(acesInv(srgbToLinear(clamp(col, 0.0, 1.0)), 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const skyU = { uSun: { value: new THREE.Vector3(0, 0, -1) }, uDay: { value: 0 } };
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
const NW = 420, wind = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(CHALK, 0.5, false), NW); wind.frustumCulled = false; wind.renderOrder = 6; wind.userData.noProbe = true; wind.visible = false; scene.add(wind);
const NF = 320, dustF = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8), basic(CHALK2, 0.5, false), NF); dustF.frustumCulled = false; dustF.renderOrder = 5; dustF.userData.noProbe = true; scene.add(dustF);
{ for (let i = 0; i < NF; i++) { const r = 0.012 + rnd(i, 5) * rnd(i, 6) * 0.04; S3.set(r, r, 1); P3.set((rnd(i, 7) - 0.5) * 24, 0.2 + rnd(i, 8) * 7, -3 - rnd(i, 9) * 40); Mx.compose(P3, Q0, S3); dustF.setMatrixAt(i, Mx); } dustF.instanceMatrix.needsUpdate = true; }

// ── the globe ───────────────────────────────────────────────────────────────
const GVS = `varying vec3 vN; void main() { vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GFS = `precision highp float; uniform vec3 uCol, uDark, uLight; uniform float uExposure, uSpin, uDry; uniform sampler2D uMap; varying vec3 vN;
${ACES_INV_GLSL}
void main() {
  vec3 n = normalize(vN); float lam = 0.5 + 0.5 * dot(n, normalize(uLight)); vec3 col = mix(uDark, uCol, lam);
  float lon = atan(n.x, n.z) + uSpin, lat = asin(clamp(n.y, -1.0, 1.0));
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
globe.renderOrder = 3; globe.frustumCulled = false; globe.userData.noProbe = true; globe.visible = false; scene.add(globe);
const dotMesh = (hex, order = 8, n = 1) => { const m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), basic(hex, 1, false), n); m.frustumCulled = false; m.renderOrder = order; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const markers = dotMesh(ANCH, 9, 3);                          // you at the equator, 45 N, the pole
const arrows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(AMB, 1, false), 3); arrows.frustumCulled = false; arrows.renderOrder = 9; arrows.userData.noProbe = true; arrows.visible = false; scene.add(arrows);
const NS = 3, NSP = 130, storms = dotMesh(CHALK, 7, NS * NSP);
const ND = 520, debris = dotMesh(AMB, 7, ND);
const eqGlow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 160), basic(AMB, 0.0, false)); eqGlow.rotation.x = Math.PI / 2; eqGlow.renderOrder = 8; eqGlow.userData.noProbe = true; eqGlow.visible = false; scene.add(eqGlow);

// ── the tower: all the spin energy, then and now ────────────────────────────
const TW = 6, TH = 58, tower = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(ANCH, 0.85, false)); tower.renderOrder = 5; tower.userData.noProbe = true; tower.visible = false; scene.add(tower);
const slice = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), basic(AMB, 1, false)); slice.renderOrder = 6; slice.userData.noProbe = true; slice.visible = false; scene.add(slice);
const towerE = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(TW, TH, TW)), new THREE.LineBasicMaterial({ color: new THREE.Color(CHALK), transparent: true, opacity: 0.8, depthTest: false })); towerE.renderOrder = 7; towerE.userData.noProbe = true; towerE.visible = false; scene.add(towerE);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const beat = (id) => FILM.beats.find((b) => b.id === id);
hud.badge("b-weight", { text: (t) => { const w = Math.max(0, weightFrac(Th(t))); return "you weigh " + (100 * w < 99.95 ? (100 * w).toFixed(100 * w < 10 ? 1 : 1) : "100") + " % of normal"; }, t0: beat("today").t0 + 19, t1: beat("break").t0 - 0.2, slot: "tl" });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.3 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "7vmin"; if (endFo) endFo.style.marginTop = "2vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "70vmin", margin: "2vmin auto 0" });
const dimEl = document.createElement("div"); dimEl.style.cssText = "position:absolute;inset:0;background:#171A1E;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dimEl);
// the one big live number: the length of a day, and your speed under it
const roEl = document.createElement("div");
roEl.style.cssText = "position:absolute;left:5vw;top:21vh;z-index:5;pointer-events:none;color:var(--hud-text);text-shadow:0 .2vmin 1.2vmin rgba(0,0,0,.55)";
roEl.innerHTML = '<div style="font:700 2.1vh/1 var(--font-text);letter-spacing:.16em;color:var(--hud-text-2)">LENGTH OF A DAY</div><div id="roT" style="font:800 15vh/1.02 var(--font-display);letter-spacing:-.02em;font-variation-settings:\'wdth\' 85;margin-top:.8vh"></div>' +
  '<div style="margin-top:2.4vh;font:700 2.1vh/1 var(--font-text);letter-spacing:.16em;color:var(--hud-text-2)">YOUR SPEED AT THE EQUATOR</div><div id="roV" style="font:700 5.4vh/1.1 var(--font-mono);color:' + AMB + ';margin-top:.8vh;font-variant-numeric:tabular-nums"></div>';
document.body.appendChild(roEl);
const roT = roEl.querySelector("#roT"), roV = roEl.querySelector("#roV");
const fmtT = (T) => T >= 10 ? Math.round(T) + " h" : T >= 1.995 ? T.toFixed(1) + " h" : Math.floor(T + 1e-6) + " h " + String(Math.round((T - Math.floor(T + 1e-6)) * 60)).padStart(2, "0") + " min";

// ── staging ─────────────────────────────────────────────────────────────────
const UPV = new THREE.Vector3(0, 1, 0);
window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const T = Th(t), ph = phase(t), gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const spinU = clamp01(Math.log(WD.t0H / T) / Math.log(WD.t0H / WD.tOrbH));                     // 0 today, 1 at the float
  const pov = shot === "eye" || shot === "shoulder" || shot === "lift" || shot === "end";
  const sunDir = new THREE.Vector3(0, Math.sin(ph), -Math.cos(ph)), day = clamp01((sunDir.y + 0.12) / 0.4);

  // the sky, stars, sun and the ground
  sky.visible = pov; stars.visible = pov; sunDisk.visible = pov; sunHalo.visible = pov;
  skyU.uSun.value.copy(sunDir); skyU.uDay.value = day; stars.rotation.x = ph; starM.opacity = 0.9 * (1 - day);
  sunDisk.position.copy(sunDir).multiplyScalar(1200); sunDisk.scale.setScalar(52); sunDisk.lookAt(camera.position);
  sunHalo.position.copy(sunDir).multiplyScalar(1190); sunHalo.scale.setScalar(260); sunHalo.lookAt(camera.position);
  sunDisk.visible = pov && sunDir.y > -0.05; sunHalo.visible = sunDisk.visible;
  desk.group.visible = pov;
  desk.update({ grid: 1, pool: [0, -2], casters: [], span: 3000 }); desk.uniforms.uExposure.value = 0.45 + 0.85 * day;
  dustF.visible = pov;

  // you and the camera
  const liftU = shot === "lift" ? E.inout2(seg(t, CUE.float[0] + 4, CUE.float[1] - 2)) : 0, rise = 7 * liftU;
  const shake = 0.0016 * spinU * Math.sin(t * 31) + 0.0008 * spinU * Math.sin(t * 17.3);
  if (shot === "eye") {
    const yaw = 0.05 * Math.sin(t * 0.21), pit = 0.19 + 0.03 * Math.sin(t * 0.17);
    camera.fov = 56; camera.position.set(0, 1.7, 0.2); camera.rotation.set(pit + shake, yaw, 0, "YXZ");
  } else if (pov) {
    const a = 0.12 * Math.sin(t * 0.15);
    camera.fov = 44; camera.position.set(1.1 + 0.4 * Math.sin(t * 0.13), 2.15 + 0.5 * liftU + rise * 0.9, 3.6 + 0.3 * rise);
    camera.lookAt(-0.35 + a, 1.5 + rise * 0.85, -6); camera.rotation.z += shake;
  }
  window.__focus = shot === "eye" ? [0, 1.7, -12] : shot === "globe" ? [-1.4, 0.1, 0] : shot === "tower" ? [0, 20, 0] : [0, 1.4 + rise * 0.6, 0];
  you.group.visible = shot === "shoulder" || shot === "lift" || shot === "end";
  if (you.group.visible) { you.set({ at: [0, 0.85 + rise, 0], arms: 0.06 + 0.5 * liftU, tilt: 0 }); you.group.rotation.y = Math.PI; }

  // the wind: streaks blowing at you (the air is left behind by the spinning ground)
  const wu = shot === "eye" ? E.inout2(seg(t, CUE.wind[0] + 7, CUE.wind[0] + 11)) * (1 - E.inout2(seg(t, CUE.wind[1] - 3, CUE.wind[1]))) : 0;
  wind.visible = wu > 0.01; wind.material.opacity = 0.55 * wu;
  if (wind.visible) for (let i = 0; i < NW; i++) { const sp = 55 + 40 * rnd(i, 3), z = -70 + (((rnd(i, 4) * 70 + t * sp) % 70)), len = 3 + 6 * rnd(i, 5);
    P3.set((rnd(i, 1) - 0.5) * 18, 0.25 + rnd(i, 2) * 6, z); S3.set(0.02 + 0.02 * rnd(i, 6), 0.02, len); Mx.compose(P3, Q0, S3); wind.setMatrixAt(i, Mx); }
  if (wind.visible) wind.instanceMatrix.needsUpdate = true;

  // the globe (planet shots): flattening, drying poles, storms, markers, debris
  const gl = shot === "globe", beatId = (FILM.beats.find((b) => t >= b.t0 && t < b.t1) || {}).id;
  globe.visible = gl;
  const f = 0.02 + 0.28 * Math.pow(spinU, 1.4), gph = ph * 0.5;
  globe.scale.set(1, 1 - f, 1); gU.uSpin.value = gph; gU.uDry.value = dryAt(t);
  if (gl) {
    const pulling = beatId === "break" ? E.inout2(seg(t, CUE.break[0] + 1.5, CUE.break[1] - 2)) : 0;
    camera.fov = 30; const cam = beatId === "break" ? 6.2 : 5.4;
    camera.position.set(-1.6 + 0.0, 0.9 + 0.2 * Math.sin(t * 0.1), cam); camera.lookAt(-1.4, 0.1, 0);
    // markers and arrows (poles beat)
    const mo = beatId === "poles" ? E.inout2(seg(t, CUE.poles[0] + 5, CUE.poles[0] + 7)) * (1 - E.inout2(seg(t, CUE.poles[1] - 2, CUE.poles[1] - 0.5))) : 0;
    markers.visible = (beatId === "poles" || beatId === "premise") && (mo > 0.01 || beatId === "premise"); arrows.visible = mo > 0.01;
    const lon0 = 0.0, lats = [0, Math.PI / 4, Math.PI / 2 - 0.001];
    lats.forEach((lat, i) => { const a = lon0 - gph, cl = Math.cos(lat), x = cl * Math.sin(a), y = Math.sin(lat) * (1 - f), z = cl * Math.cos(a);
      P3.set(x * 1.006, y * 1.006, z * 1.006); S3.set(0.035, 0.035, 1); Q0.identity(); Mx.compose(P3, Q0, S3); markers.setMatrixAt(i, Mx);
      const len = 0.62 * Math.cos(lat) * mo, tx = Math.cos(a), tz = -Math.sin(a); const dir = new THREE.Vector3(tx, 0, tz);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
      P3.set(x * 1.01 + tx * len / 2, y * 1.01, z * 1.01 + tz * len / 2); S3.set(Math.max(0.0001, len), 0.012, 0.012); Mx.compose(P3, q, S3); arrows.setMatrixAt(i, Mx); });
    markers.instanceMatrix.needsUpdate = true; arrows.instanceMatrix.needsUpdate = true;
    // storms (weather beat): swirls whose arms wind in step with the spin
    const so = beatId === "weather" ? E.inout2(seg(t, CUE.weather[0] + 3, CUE.weather[0] + 6)) * (1 - E.inout2(seg(t, CUE.weather[1] - 3, CUE.weather[1]))) : 0;
    storms.visible = so > 0.01;
    if (storms.visible) { const CEN = [[0.45, 0.55], [-0.35, 0.35], [0.25, -0.5]];
      for (let s = 0; s < NS; s++) { const la = CEN[s][0] * 0.0 + (s === 0 ? 0.42 : s === 1 ? -0.38 : 0.12), lo = CEN[s][1], a0 = lo - gph + 0.0;
        for (let k = 0; k < NSP; k++) { const rr = 0.04 + 0.2 * Math.pow(k / NSP, 0.8), th = k * 2.399 + (t * (0.9 + 2.4 * spinU)) * (1.2 - 0.6 * (k / NSP)) + rr * 8 / (0.5 + spinU * 1.2);
          const lat2 = la + rr * Math.sin(th) * 0.9, lon2 = a0 + rr * Math.cos(th) * 1.1 / Math.max(0.4, Math.cos(la)); const cl = Math.cos(lat2);
          P3.set(cl * Math.sin(lon2) * 1.008, Math.sin(lat2) * (1 - f) * 1.008, cl * Math.cos(lon2) * 1.008); S3.set(0.0065 * so, 0.0065 * so, 1); Mx.compose(P3, Q0, S3); storms.setMatrixAt(s * NSP + k, Mx); } }
      storms.instanceMatrix.needsUpdate = true; }
    // debris (break beat): rock leaves the equator
    debris.visible = pulling > 0.01 || beatId === "break";
    if (debris.visible) { for (let i = 0; i < ND; i++) { const a = rnd(i, 1) * 6.2831853 + gph * 2, ud = clamp01(pulling * 1.2 - rnd(i, 2) * 0.5), r = 1.02 + (0.15 + 2.2 * rnd(i, 3)) * Math.pow(ud, 1.4);
        P3.set(r * Math.cos(a), (rnd(i, 4) - 0.5) * 0.06 * (1 + 8 * ud), r * Math.sin(a)); const sc = 0.007 + 0.012 * rnd(i, 5); S3.set(sc * ud, sc * ud, 1); Mx.compose(P3, Q0, S3); debris.setMatrixAt(i, Mx); }
      debris.instanceMatrix.needsUpdate = true; }
    eqGlow.visible = beatId === "break"; eqGlow.material.opacity = 0.85 * E.inout2(seg(t, CUE.break[0] + 0.5, CUE.break[0] + 3)); eqGlow.scale.set(1.01 + 0.4 * pulling, 1.01 + 0.4 * pulling, 1);
  } else { markers.visible = arrows.visible = storms.visible = debris.visible = eqGlow.visible = false; }

  // the tower (cost beat)
  const tw = shot === "tower";
  tower.visible = towerE.visible = slice.visible = tw;
  if (tw) { const g = E.inout2(seg(t, CUE.cost[0] + 6, CUE.cost[0] + 17)), h = Math.max(0.01, TH * g);
    camera.fov = 30; camera.position.set(0, TH * 0.44, 150 - 6 * seg(t, CUE.cost[0], CUE.cost[1])); camera.lookAt(0, TH * 0.44, 0);
    tower.scale.set(TW * 0.96, h, TW * 0.96); tower.position.set(4.5, h / 2, 0); towerE.position.set(4.5, TH / 2, 0); slice.scale.set(TW * 0.96, Math.max(0.3, TH / 290), TW * 0.96); slice.position.set(-4.5, Math.max(0.3, TH / 290) / 2, 0); }

  // the end: the scene dims under the end card, the text goes, the dim lifts
  dimEl.style.opacity = String((0.86 * seg(t, FILM.endCard - 0.25, FILM.endCard + 0.3) * (1 - seg(t, FILM.dur - 0.75, FILM.dur - 0.05))).toFixed(3));
  roEl.style.opacity = String((1 - seg(t, FILM.endCard - 0.3, FILM.endCard)).toFixed(3));
  roT.textContent = fmtT(T); roV.textContent = Math.round(2 * Math.PI * R_EQ / (T * 3600) * 3.6 * 1000 / 1000 * 1000 / 1000).toLocaleString("en-US") + " km/h";
  hud.update(t);
  endEl.style.transform = "scale(" + (1 + 0.03 * seg(t, FILM.endCard, FILM.dur)).toFixed(4) + ")";
  const tail = E.inout2(seg(t, FILM.dur - 1.35, FILM.dur - 0.8));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  void gate; void UPV; void MARK; void S3;
  renderer.render(scene, camera);
};
