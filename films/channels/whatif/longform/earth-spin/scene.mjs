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
globe.renderOrder = 3; globe.frustumCulled = false; globe.userData.noProbe = true; globe.visible = false; scene.add(globe);
const dotMesh = (hex, order = 8, n = 1) => { const m = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14), basic(hex, 1, false), n); m.frustumCulled = false; m.renderOrder = order; m.userData.noProbe = true; m.visible = false; scene.add(m); return m; };
const markers = dotMesh(ANCH, 9, 3);                          // you at the equator, 45 N, the pole
const arrows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), basic(AMB, 1, false), 3); arrows.frustumCulled = false; arrows.renderOrder = 9; arrows.userData.noProbe = true; arrows.visible = false; scene.add(arrows);
const NS = 3, NSP = 130, storms = dotMesh(CHALK, 7, NS * NSP);
const ND = 520, debris = dotMesh(AMB, 7, ND);
const planetG = new THREE.Group(); scene.add(planetG);
const eqGlow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 160), basic(AMB, 0.0, false)); eqGlow.rotation.x = Math.PI / 2; eqGlow.renderOrder = 8; eqGlow.userData.noProbe = true; eqGlow.visible = false; scene.add(eqGlow);
const water = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), new THREE.MeshBasicMaterial({ color: 0x3b8cff, transparent: true, opacity: 0.38, depthWrite: false })); water.renderOrder = 4; water.userData.noProbe = true; water.visible = false;
planetG.add(globe, water, markers, arrows, storms, debris, eqGlow);
planetG.rotation.z = -Math.PI / 2;                              // the pole axis is horizontal: the figure on the top is ON the equator

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
if (FILM.thumb) { roEl.style.display = "none"; scrim.style.display = "none"; }   // cover mode (film.json "thumb": true): the picture only, no readout
const roT = roEl.querySelector("#roT"), roV = roEl.querySelector("#roV"), roL2 = roEl.querySelector("#roL2");
const WWINS = WD.weightWins || [], inWeight = (t) => WWINS.some(([a, b]) => t >= a && t < b);
const fmtT = (T) => T >= 10 ? Math.round(T) + " h" : T >= 1.995 ? T.toFixed(1) + " h" : Math.floor(T + 1e-6) + " h " + String(Math.round((T - Math.floor(T + 1e-6)) * 60)).padStart(2, "0") + " min";

// ── staging ─────────────────────────────────────────────────────────────────
const UPV = new THREE.Vector3(0, 1, 0);
window.seek = function (t) {
  window.__t = t;
  const fxw0 = (k) => { const w = (FILM.fx || {})[k]; return w ? E.inout2(seg(t, w[0], w[0] + 1.5)) * (1 - E.inout2(seg(t, w[1] - 1.5, w[1]))) : 0; };
  const st = stage(t), shot = st.name;
  const T = Th(t), ph = phase(t), gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  const spinU = clamp01(Math.log(WD.t0H / T) / Math.log(WD.t0H / WD.tOrbH));                     // 0 today, 1 at the float
  const pov = shot === "eye" || shot === "shoulder" || shot === "lift" || shot === "end";
  const sunDir = new THREE.Vector3(0, Math.sin(ph), -Math.cos(ph)), day0 = clamp01((sunDir.y + 0.12) / 0.4);
  // photosensitivity: when one day takes only a second or two of film, shrink the day/night swing so the light only pulses gently
  const cycP = WD.cycleS * T / WD.t0H, amp = Math.max(0.08, Math.min(1, (cycP - 0.8) / 5.2)), day = 0.5 + (day0 - 0.5) * amp;

  // the planet staging: a big Earth, you standing on its equator (the top), the sky circling round the pole axis (the figure's own frame: the Sun and the stars go round, the planet stays)
  const gl = shot === "globe", sp = shot !== "tower", beatId = (FILM.beats.find((b) => t >= b.t0 && t < b.t1) || {}).id;
  const fixedL = new THREE.Vector3(-0.45, 0.35, 0.8).normalize(), lightV = fixedL.clone().lerp(sunDir, amp).normalize();     // the light swings less and less as the days get short (photosensitivity)
  sky.visible = stars.visible = sunDisk.visible = sunHalo.visible = sp;
  skyU.uSun.value.copy(sunDir); skyU.uDay.value = 0; skyU.uGlow.value = 0.25 + 0.75 * amp; const gs = 0.3 + 0.7 * amp; stars.rotation.x = 0.04 * ph; starM.opacity = 0.9;
  sunDisk.position.copy(sunDir).multiplyScalar(1200); sunDisk.scale.setScalar(52 * gs); sunDisk.lookAt(camera.position);
  sunHalo.position.copy(sunDir).multiplyScalar(1190); sunHalo.scale.setScalar(170 * gs); sunHalo.lookAt(camera.position);
  desk.group.visible = false; dustF.visible = false; sunDisk.material.depthTest = true; sunHalo.material.depthTest = true;   // the planet hides the Sun when it is behind it
  gU.uLight.value.copy(lightV); gU.uExposure.value = 0.9 + 0.35 * day;

  // you and the camera
  const liftU = shot === "lift" ? E.inout2(seg(t, CUE.float[0] + 4, CUE.float[1] - 2)) : 0, rise = 7 * liftU;
  const sw = 0.05 * Math.sin(t * 0.37), sh = 0.035 * Math.sin(t * 0.23);
  let pcx = 0, pcy = 0, figS = gl ? 0.6 : 1;
  if (PORT) {
    // the base pose of the shot, then the part's camera moves (film.json "cams": [{t0, mode}]) blend in, each over 1.6 s
    let cur = !gl ? { pcy: -1.25, c: [sw, 0.3 + sh, 6.3], l: [0, -0.3, 0], fov: 34, fs: 1 } : { pcy: -0.6, c: [sw, 0.3 + sh, beatId === "break" ? 9.4 : 7.0], l: [0, 0.05, 0], fov: 34, fs: 0.6 };
    const POSE = {
      base: null,
      ground: { pcy: -0.6, c: [1.0 + sw, 0.52 + sh, 2.5], l: [-0.25, 0.8, -3], fov: 42, fs: 1 },        // down at the ground beside the figure, the sky racing above
      wide: { pcy: -0.35, c: [1.5 + 3 * sw, 0.9 + sh, 8.2], l: [0, -0.1, 0], fov: 34, fs: 0.8 },          // the whole planet with the light line
      push: { pcy: -0.6, c: [0.25 + sw, 0.62 + sh, 2.9], l: [0, 0.62, 0], fov: 30, fs: 1 },             // in close on the figure
    };
    const lm = (a, b, u) => a + (b - a) * u, base0 = cur;
    for (const c of (FILM.cams || [])) if (t >= c.t0) { const P = POSE[c.mode] || base0, u = E.inout2(seg(t, c.t0, c.t0 + 1.6));
      cur = { pcy: lm(cur.pcy, P.pcy, u), c: cur.c.map((v, i) => lm(v, P.c[i], u)), l: cur.l.map((v, i) => lm(v, P.l[i], u)), fov: lm(cur.fov, P.fov, u), fs: lm(cur.fs, P.fs, u) }; }
    pcy = cur.pcy; figS = cur.fs; camera.fov = cur.fov; camera.position.set(...cur.c); camera.lookAt(...cur.l);
  } else if (!gl) {
    pcx = 0.9; pcy = -1.48; camera.fov = 32; camera.position.set(0.9 + sw, -0.1 + sh, 3.2); camera.lookAt(0.9, -0.3, 0);
  } else { camera.fov = 30; camera.position.set(-1.6, 0.9 + 0.2 * Math.sin(t * 0.1), beatId === "break" ? 6.2 : 5.4); camera.lookAt(-1.4, 0.1, 0); }
  planetG.position.set(pcx, pcy, 0);
  window.__focus = shot === "tower" ? [0, 20, 0] : [pcx, pcy + 1, 0];
  const ysc = (PORT ? figS : gl ? 0.6 : 1) * (PORT ? 0.26 : 0.15), bulge = 0.07 * fxw0("ocean");
  you.group.visible = sp && shot !== "end";
  if (you.group.visible) {
    you.set({ at: [0, 0, 0], arms: 0.06 + 0.5 * liftU + 0.03 * Math.sin(t * 1.3), tilt: 0 });
    you.group.scale.set(ysc, ysc * (1 + 0.012 * Math.sin(t * 1.7)), ysc); you.group.position.set(pcx, pcy + 1.0 + bulge + (0.85 + rise) * ysc, 0); you.group.rotation.set(0, Math.PI, 0.02 * Math.sin(t * 0.9));
  }

  // the wind: streaks blowing at you (the air is left behind by the spinning ground)
  const wu = Math.max(fxw0("wind"), shot === "eye" ? E.inout2(seg(t, CUE.wind[0] + 7, CUE.wind[0] + 11)) * (1 - E.inout2(seg(t, CUE.wind[1] - 3, CUE.wind[1]))) : 0);
  wind.visible = wu > 0.01; wind.material.opacity = 0.32 * wu;
  if (wind.visible) for (let i = 0; i < NW; i++) { const sp2 = 5 + 4 * rnd(i, 3), x = pcx + 6 - (((rnd(i, 4) * 12 + t * sp2) % 12)), len = 0.3 + 0.7 * rnd(i, 5);
    P3.set(x, pcy + 1.0 + 0.05 + rnd(i, 2) * 1.3, (rnd(i, 1) - 0.5) * 1.4); S3.set(len, 0.006 + 0.004 * rnd(i, 6), 0.006); Mx.compose(P3, Q0, S3); wind.setMatrixAt(i, Mx); }
  if (wind.visible) wind.instanceMatrix.needsUpdate = true;

  // the globe (planet shots): flattening, drying poles, storms, markers, debris
  globe.visible = sp;
  const f = 0.02 + 0.28 * Math.pow(spinU, 1.4), gph = ph * 0.5;
  globe.scale.set(1, 1 - f, 1); const ow = fxw0("ocean"); water.visible = ow > 0.01; water.scale.set(1 + 0.07 * ow, (1 - f) * 1.003, 1 + 0.07 * ow); gU.uSpin.value = gl ? gph : 0.03 * t; gU.uDry.value = dryAt(t);
  if (gl) {
    const pulling = beatId === "break" ? E.inout2(seg(t, CUE.break[0] + 1.5, CUE.break[1] - 2)) : 0;
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

  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  // the end: the scene dims under the end card, the text goes, the dim lifts
  dimEl.style.opacity = String((0.86 * seg(t, FILM.endCard - 0.25, FILM.endCard + 0.3) * (1 - seg(t, FILM.dur - 0.75, FILM.dur - 0.05))).toFixed(3));
  roEl.style.opacity = String((1 - seg(t, FILM.endCard - 0.3, FILM.endCard)).toFixed(3)); scrim.style.opacity = roEl.style.opacity;
  roT.textContent = fmtT(T); roV.textContent = Math.round(2 * Math.PI * R_EQ / (T * 3600) * 3.6 * 1000 / 1000 * 1000 / 1000).toLocaleString("en-US") + " km/h";
  if (inWeight(t)) { const w = Math.max(0, weightFrac(T)) * 100; roL2.textContent = "YOUR WEIGHT, VS A STILL EARTH"; roV.textContent = (w < 99.95 ? w.toFixed(w >= 99 ? 2 : 1) : "100") + " %"; }
  else roL2.textContent = "YOUR SPEED AT THE EQUATOR";
  hud.update(t);
  endEl.style.transform = "scale(" + (1 + 0.03 * seg(t, FILM.endCard, FILM.dur)).toFixed(4) + ")";
  const tail = E.inout2(seg(t, FILM.dur - 1.35, FILM.dur - 0.8));
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  void gate; void UPV; void MARK; void S3;
  renderer.render(scene, camera);
};
