import * as THREE from "three";
// One More Orbit, Season 2 · Episode 2 (folder ep08), "Dark sky". The picture as a pure function of t.
//
// One 3-D world, you at the origin in an endless field of stars (not to scale, badged). A lane of stars running away from you ramps to white
// where they pile up (frame 0); the camera drives through the field ("no edge or start"); a ray runs from you to a star in 36 directions;
// a forest of trunks is the comparison; three shells (near, middle, far) show fainter stars are more numerous and the sky whitens; a horizon
// sphere (light-travel time) grows round you, the stars beyond it have not arrived, photons crawl in, and the sky falls dark. Readout: a ring
// for 8 minutes and a big one for billions of years. The last frame is frame 0's pose (a replay loops).
// Set: ../set (motif). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring, segment } from "cinema/sci/front.js";
import { createBeacon } from "../set/beacon.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, FP = FILM.forest, CAMK = FILM.camk;
const S1 = Math.min(W, H) / 1080, sx = W / 1080, sy = H / 1920;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x080a1c, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x080a1c, 8, 80);
const camera = new THREE.PerspectiveCamera(56, W / H, 0.05, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const pos = (c) => c.map((v) => Math.max(0, v));
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const V = (a) => new THREE.Vector3(...a);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] }, XY = { e1: [1, 0, 0], e2: [0, 1, 0] }, YZ = { e1: [0, 0, 1], e2: [0, 1, 0] };

// ── the star field: uniform in a sphere round you; size and brightness fall with distance from you; shells colour it; a horizon dims the rest ──
const RF = 170, NSTAR = 7000, rs = mul(3), sP = new Float32Array(NSTAR * 3), sR = new Float32Array(NSTAR);
for (let i = 0; i < NSTAR; i++) {
  const r = Math.max(6, RF * Math.cbrt(rs())), th = Math.acos(2 * rs() - 1), ph = rs() * 6.2832;
  sP.set([r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)], i * 3); sR[i] = rs();
}
const sG = new THREE.BufferGeometry();
sG.setAttribute("position", new THREE.BufferAttribute(sP, 3)); sG.setAttribute("rnd", new THREE.BufferAttribute(sR, 1));
const starMat = new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 6 * S1 }, uH: { value: 1e4 }, uSh: { value: 0 }, uGain: { value: 1 } },
  vertexShader: `attribute float rnd; uniform float uPx, uH, uSh, uGain; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float r = length(position), d = length(mv.xyz);
      float size = clamp(30.0 / d, 0.9, 6.0) * (0.7 + rnd); gl_PointSize = uPx * size * (0.75 + 1.5 * (1.0 - smoothstep(0.0, 90.0, r)));
      float b = (0.25 + 0.75 * rnd) / (1.0 + pow(r / 38.0, 1.3)); float lit = 1.0 - 0.985 * smoothstep(uH - 4.0, uH + 4.0, r);
      vec3 c = vec3(0.93, 0.94, 1.0); if (uSh > 0.5) c = r < 36.0 ? vec3(0.95, 0.93, 0.65) : (r < 86.0 ? vec3(0.56, 0.82, 1.0) : vec3(0.73, 0.65, 1.0));
      vC = c; vA = b * lit * uGain * (1.0 + 2.5 * uSh * (1.0 - smoothstep(0.0, 60.0, r))) * 3.0; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.15, 1.0, r2)) * min(vA, 1.4); gl_FragColor = vec4(vC * a * 1.5, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const field = new THREE.Points(sG, starMat); field.frustumCulled = false; scene.add(field);
// the lane: stars strung along one line of sight; they pile up toward the far end and ramp to white
const NL = 9000, lr = mul(8), lP = new Float32Array(NL * 3), lR = new Float32Array(NL);
for (let i = 0; i < NL; i++) { const z = 5 + 165 * Math.pow(lr(), 0.55), sp = 0.035 * z; lP.set([(lr() + lr() + lr() - 1.5) * sp, 0.3 + (lr() + lr() + lr() - 1.5) * sp * 0.7, z], i * 3); lR[i] = lr(); }
const lG = new THREE.BufferGeometry(); lG.setAttribute("position", new THREE.BufferAttribute(lP, 3)); lG.setAttribute("rnd", new THREE.BufferAttribute(lR, 1));
const laneMat = new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 6.5 * S1 }, uGain: { value: 1 } },
  vertexShader: `attribute float rnd; uniform float uPx, uGain; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (0.8 + rnd); vA = uGain * (0.4 + 0.8 * smoothstep(20.0, 150.0, position.z)); }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * a * 2.4, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const lane = new THREE.Points(lG, laneMat); lane.frustumCulled = false; scene.add(lane);
// rays from you to 36 stars (the nearest to 36 directions)
const rr = mul(17), RAYS = [];
for (let k = 0; k < 36; k++) {
  const th = Math.acos(2 * rr() - 1), ph = rr() * 6.2832, d = V([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]);
  let best = -1, bs = 9; for (let i = 0; i < NSTAR; i += 1) { const r = Math.hypot(sP[i * 3], sP[i * 3 + 1], sP[i * 3 + 2]); if (r < 30 || r > 120) continue; const c = (sP[i * 3] * d.x + sP[i * 3 + 1] * d.y + sP[i * 3 + 2] * d.z) / r; const sc = 1 - c; if (sc < bs) { bs = sc; best = i; } }
  RAYS.push({ end: [sP[best * 3], sP[best * 3 + 1], sP[best * 3 + 2]], dly: k * 0.045 });
}
const rayMesh = RAYS.map(() => segment({ color: pos(line("teal", 0.9)), width: 2.4, opacity: 0 }));
const rayEnd = RAYS.map(() => createBeacon({ color: pos(hdr("lemon", 1.4)), px: 14, core: 0.5 }));
rayMesh.forEach((r) => scene.add(r.mesh)); rayEnd.forEach((b) => scene.add(b.mesh));
// the forest (far off to the side): trunks, and rays that each stop at a trunk
const NT = 150, tr = mul(29), trunks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 18, 0.22), new THREE.MeshBasicMaterial({ color: 0xa9b0d9, transparent: true, opacity: 0.55, fog: true }), NT), TP = [];
{ const m = new THREE.Matrix4(); for (let i = 0; i < NT; i++) { const x = (tr() - 0.5) * 60, z = -6 + tr() * 70, s = 0.6 + tr() * 1.4; TP.push([x, z]); m.compose(new THREE.Vector3(FP[0] + x, 7, FP[2] + z), new THREE.Quaternion(), new THREE.Vector3(s, 1, s)); trunks.setMatrixAt(i, m); } }
trunks.frustumCulled = false; scene.add(trunks);
const FRAYS = Array.from({ length: 9 }, (_, k) => { const ang = -0.6 + k * 0.15, cand = TP.map((p, i) => [i, Math.abs(Math.atan2(p[0] + 2, p[1] + 3) - ang)]).sort((a, b) => a[1] - b[1])[0][0]; return { to: [FP[0] + TP[cand][0], 1.8, FP[2] + TP[cand][1] - 0.5], dly: k * 0.12 }; });
const fRayMesh = FRAYS.map(() => segment({ color: pos(line("teal", 0.95)), width: 3, opacity: 0 })); fRayMesh.forEach((r) => scene.add(r.mesh));
// three shells (near, middle, far) and the horizon sphere: each three great circles
const mkSphere = (col, w) => [XZ, XY, YZ].map(() => ring({ color: col, width: w, opacity: 0 }));
const SH = [[30, mkSphere(pos(line("lemon", 0.9)), 3)], [70, mkSphere(pos(line("ice", 0.9)), 3)], [130, mkSphere(pos(line("lilac", 0.9)), 3)]];
const hzSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x2fd0b5, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending })); scene.add(hzSphere);
const HZ = mkSphere(pos(line("teal", 0.95)), 4.5);
for (const [, rs3] of SH) rs3.forEach((r) => scene.add(r.mesh)); HZ.forEach((r) => scene.add(r.mesh));
const setSphere = (set, r, op) => set.forEach((rg, i) => rg.arc({ center: [0, 0, 0], r: Math.max(0.01, r), ...[XZ, XY, YZ][i] }).set({ opacity: op }));
// photons crawling in from beyond the horizon, and a flow of light arriving from inside it
const NPH = 200, pr = mul(37), PH = Array.from({ length: NPH }, (_, i) => { const th = Math.acos(2 * pr() - 1), ph = pr() * 6.2832; return { d: [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)], r0: i < 130 ? 104 + pr() * 60 : 14 + pr() * 80, v: i < 130 ? 3.5 + pr() * 3.5 : 7 + pr() * 6, ph: pr() }; });
const phP = new Float32Array(NPH * 3), phA = new Float32Array(NPH), phG = new THREE.BufferGeometry();
phG.setAttribute("position", new THREE.BufferAttribute(phP, 3)); phG.setAttribute("alpha", new THREE.BufferAttribute(phA, 1));
const phMat = new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 7 * S1 } },
  vertexShader: `attribute float alpha; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * clamp(40.0 / length(mv.xyz), 0.8, 5.0); vA = alpha; }`,
  fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0 || vA < 0.01) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(vec3(0.18, 0.78, 0.68) * a * 1.1, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const photons = new THREE.Points(phG, phMat); photons.frustumCulled = false; scene.add(photons);
const LITS = Array.from({ length: 16 }, (_, k) => ({ b: createBeacon({ color: pos(hdr(k % 2 ? "ice" : "lemon", 1.1)), px: 18, core: 0.6 }), ring: ring({ color: pos(line(k % 2 ? "ice" : "lemon", 0.95)), width: 3, opacity: 0 }), c: [0, 0, 0], t0: 0 }));
const lr2 = mul(53);
LITS.forEach((l) => { scene.add(l.b.mesh); scene.add(l.ring.mesh); });
const you = createBeacon({ color: pos(hdr("teal", 1.3)), px: 26, core: 0.5 }); scene.add(you.mesh);
const ringSun = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 }), ringFar = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 });
scene.add(ringSun.mesh, ringFar.mesh);

// ── the 2-D layer: the glow wash, dips, nothing else ─────────────────────────────────────────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
function overlay2d(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const wash = 0.97 * E.inout3(seg(t, CUE.cancel, CUE.glow)) * (1 - E.inout3(seg(t, CUE.surface + 0.1, CUE.surface + 1.9)));           // the whole sky should glow (a slow ramp), warm star-surface white
  if (wash > 0.002) { const g = ctx.createRadialGradient(W / 2, 0.38 * H, 20 * sx, W / 2, 0.38 * H, 900 * sx); g.addColorStop(0, rgba([255, 255, 250], wash)); g.addColorStop(1, rgba([255, 250, 234], wash * 0.96)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const lk0 = E.out3(seg(t, FILM.loop0, FILM.loop0 + 0.45)), w0 = Math.max(1 - E.inout3(seg(t, 1.0, 3.0)), lk0) * (t < CUE.spokes0 || lk0 > 0 ? 1 : 0);        // frame 0: the lane's far end ramps to white (and again at the loop)
  if (w0 > 0.002) { const gy = 0.43 * H, g = ctx.createRadialGradient(W / 2, gy, 10 * sx, W / 2, gy, 380 * sx); g.addColorStop(0, rgba([255, 255, 250], 0.95 * w0)); g.addColorStop(0.16, rgba([255, 250, 236], 0.55 * w0)); g.addColorStop(0.5, rgba([255, 244, 220], 0.12 * w0)); g.addColorStop(1, rgba([255, 240, 210], 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const kc = fadeIn(t, CUE.surface + 0.7, 0.6) * (1 - fadeIn(t, CUE.age0 - 0.7, 0.5));             // "the key here is time": a clock ring over the darkening sky
  if (kc > 0.01) { const cx = W / 2, cy = 0.36 * H, R = 250 * sx; ctx.lineWidth = 6 * S1; ctx.strokeStyle = rgba([79, 227, 198], 0.9 * kc); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * 0.5236; ctx.lineWidth = 4 * S1; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * R * 0.86, cy - Math.cos(a) * R * 0.86); ctx.lineTo(cx + Math.sin(a) * R * 0.97, cy - Math.cos(a) * R * 0.97); ctx.stroke(); }
    const h = (t - CUE.surface) * 2.4; ctx.lineWidth = 9 * S1; ctx.lineCap = "round"; ctx.strokeStyle = rgba([238, 240, 255], kc); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(h) * R * 0.72, cy - Math.cos(h) * R * 0.72); ctx.stroke(); ctx.lineCap = "butt"; }
  const [d0, d1, d2] = CUE.dip;
  const dip = Math.max(E.inout3(seg(t, d0 - 0.1, d0 + 0.2)) * (1 - E.inout3(seg(t, d0 + 0.2, d0 + 0.45))), E.inout3(seg(t, d1 - 0.05, d1 + 0.2)) * (1 - E.inout3(seg(t, d1 + 0.2, d1 + 0.45))), E.inout3(seg(t, d2 - 0.1, d2 + 0.15)) * (1 - E.inout3(seg(t, d2 + 0.15, d2 + 0.4))));
  if (dip > 0.001) { ctx.fillStyle = rgba([8, 10, 28], dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { you: [0, 0, 0], near: [26, 0, 15], mid: [-36, 0, 60], far: [100, 0, -83], hz: [60, 0, -40] };
const KIND = { star: { color: "lemon", glyph: "✦", mark: "none" }, body: { color: "ice", glyph: "●", mark: "none" }, light: { color: "teal", glyph: "◯", mark: "none" }, grav: { color: "lilac", glyph: "", mark: "dashed" } };
const cap0 = FILM.captions[0], capShift = FILM.loop0 - 0.05 - cap0.t0;
const capLoop = { t0: FILM.loop0 - 0.05, t1: FILM.dur + 5, lines: cap0.lines.map((ln) => ln.map(([w, tw]) => [w, tw + capShift])) };
hud.captions([...FILM.captions, capLoop]);
const titleEl = hud.title(FILM.title);
{ const se = titleEl.querySelector(".hud-series"), m = /Episode (\d+)/.exec(FILM.title.series || ""); if (se && m) { se.innerHTML = 'ONE MORE ORBIT · SEASON <b style="color:var(--teal,#4fe3c6)">2</b> · EPISODE <b style="color:var(--teal,#4fe3c6)">' + m[1] + "</b>"; Object.assign(se.style, { color: "var(--text-2)", whiteSpace: "nowrap", fontSize: "2.1vmin", letterSpacing: ".1em" }); } }
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const CEL = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  CEL[c.id] = el; el.classList.add(c.read ? "lm-read" : "lm-clock");
  if (c.id === "c-hook" || c.id === "c-cancel" || c.id === "c-age" || c.id === "c-dark") Object.assign(el.style, { background: "rgba(8,10,28,.82)", borderRadius: "2vmin", padding: "1.2vmin 2.4vmin" });
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.4vmin" : "5.4vmin";
  else if (v && c.text.length > 8 && !c.read) v.style.fontSize = "7.5vmin";
}
for (const L of FILM.labels) { const k = KIND[L.kind]; hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed }); }
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.4vmin";
const fo2 = endEl.querySelector(".fo");
if (fo2) fo2.style.marginTop = "1.8vmin";
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const scrimEl = document.querySelector(".hud-scrim");
let LOOPEL = null;
function makeLoop() { hud.update(1.5); tRing.update(1.5); LOOPEL = [titleEl, CEL["c-hook"]].filter(Boolean).map((el) => { const c = el.cloneNode(true); c.removeAttribute("id"); c.style.opacity = "0"; c.style.visibility = "hidden"; el.parentNode.appendChild(c); return c; }); }

// ── the camera: own keyframes (position, look-at, field of view), eased ──────────────────────────────
const lerp = (a, b, u) => a + (b - a) * u;
function camAt(t) {
  let i = CAMK.findIndex((k) => k.t > t); if (i < 0) i = CAMK.length - 1; if (i < 1) i = 1;
  const a = CAMK[i - 1], b = CAMK[i], u = b.t === a.t ? 1 : E.inout3(clamp01((t - a.t) / (b.t - a.t)));
  return { p: a.p.map((v, k) => lerp(v, b.p[k], u)), l: a.l.map((v, k) => lerp(v, b.l[k], u)), fov: lerp(a.fov, b.fov, u) };
}
const HF = 95;

window.seek = function (t) {
  if (!LOOPEL) makeLoop();
  const dipT = CUE.dip[2] + 0.15, tt = t >= dipT ? 0 : t;
  const cm = camAt(tt); camera.position.fromArray(cm.p); camera.fov = cm.fov; camera.updateProjectionMatrix(); camera.lookAt(...cm.l); camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const inForest = tt >= CUE.dip[0] + 0.1 && tt < CUE.dip[1] + 0.1;
  field.visible = !inForest; lane.visible = !inForest; trunks.visible = inForest;
  // the horizon: the universe's age (as light-travel time) grows round you; stars beyond it have not arrived
  const hg = E.inout3(seg(tt, CUE.time + 0.4, CUE.age1 + 0.6)), hr = 8 + (HF - 8) * hg, hon = tt >= CUE.time + 0.3;
  starMat.uniforms.uH.value = hon ? hr : 1e4;
  starMat.uniforms.uSh.value = tt >= CUE.fainter - 0.3 && tt < CUE.cancel + 1.5 ? 1 : 0;
  const dark = 1 - 0.55 * E.inout3(seg(tt, CUE.begin, CUE.begin + 2.0));
  starMat.uniforms.uGain.value = (tt >= CUE.begin ? dark : 1);
  laneMat.uniforms.uGain.value = (tt < CUE.n + 1.2 ? 1 : 0.35 * fadeIn(tt, CUE.n + 1.2, 0)) * (tt < CUE.spokes0 ? 1 : 1 - E.out3(seg(tt, CUE.spokes0, CUE.spokes0 + 1.0)) * 0.7);
  // rays: one from you to each of 36 stars; ends are beacons
  RAYS.forEach((r, k) => {
    const g = E.out3(seg(tt, CUE.spokes0 + 0.2 + r.dly, CUE.spokes0 + 1.4 + r.dly)), fade = 1 - fadeIn(tt, CUE.dip[0] - 0.4, 0.4);
    rayMesh[k].seg([0, 0, 0], r.end.map((v) => v * g)).set({ opacity: g > 0.002 ? 0.8 * fade : 0 });
    rayEnd[k].set({ center: r.end, camera, opacity: g > 0.95 ? fade : 0 });
  });
  FRAYS.forEach((r, k) => { const g = E.out3(seg(tt, CUE.dip[0] + 0.5 + r.dly, CUE.dip[0] + 1.6 + r.dly)), o = [FP[0] - 1, 1.8, FP[2] - 3]; fRayMesh[k].seg(o, o.map((v, i) => v + (r.to[i] - v) * g)).set({ opacity: inForest && g > 0.002 ? 0.9 : 0 }); });
  // the shells: each lights in turn on the narration
  const sOn = [fadeIn(tt, CUE.fainter, 0.5), fadeIn(tt, CUE.fainter + 1.5, 0.5), fadeIn(tt, CUE.more, 0.5)], sOff = 1 - fadeIn(tt, CUE.glow - 0.2, 0.5);
  SH.forEach(([rad, rs3], k) => setSphere(rs3, rad, 0.75 * sOn[k] * sOff));
  hzSphere.scale.setScalar(Math.max(0.01, hr)); hzSphere.material.opacity = hon && tt < CUE.begin + 2.5 ? 0.09 * fadeIn(tt, CUE.time + 0.3, 0.6) * (1 - fadeIn(tt, CUE.begin + 0.5, 1.5)) : 0;
  setSphere(HZ, hr, hon && tt < CUE.begin + 2.5 ? 0.95 * fadeIn(tt, CUE.time + 0.3, 0.6) * (1 - fadeIn(tt, CUE.begin + 0.5, 1.5)) : 0);
  S.near = [0, 31, 0]; S.mid = [0, 71, 0]; S.far = [0, -131, 0]; S.hz = [hr * Math.cos(0.55), 0, -hr * Math.sin(0.55)];
  // photons: crawl in from beyond the horizon (never arriving) and a flow of arriving light inside it
  PH.forEach((p, k) => {
    const on = tt >= CUE.way - 3.0 && tt < CUE.begin + 1.0;
    let r, a = 0;
    if (k < 130) { r = p.r0 - p.v * Math.max(0, tt - (CUE.way - 3.0)); a = on && r > hr + 6 ? 0.9 * fadeIn(tt, CUE.way - 3.0, 0.8) * (1 - fadeIn(tt, CUE.begin, 1.0)) : 0; }
    else { const cyc = ((tt * 0.16 + p.ph) % 1); r = Math.max(4, hr * 0.95 * (1 - cyc)); a = on && hon && tt < CUE.way + 4 ? 0.95 * Math.min(1, cyc * 6) * (r > 6 ? 1 : 0.2) * fadeIn(tt, CUE.age0, 0.5) : 0; }
    phP.set([p.d[0] * r, p.d[1] * r, p.d[2] * r], k * 3); phA[k] = a;
  });
  phG.attributes.position.needsUpdate = true; phG.attributes.alpha.needsUpdate = true;
  you.set({ center: [0, 0, 0], camera, opacity: Math.min(1, cm.p[2] < -20 || Math.abs(cm.p[1]) > 15 ? 1 : 0.0) * (tt >= CUE.spokes0 + 0.2 ? 1 : 0) });
  // the readout: light crosses 8 minutes (small) then billions of years (to the horizon), not to scale
  const u1 = E.out3(seg(tt, CUE.sun, CUE.sun + 1.6)), u2 = E.out3(seg(tt, CUE.farthest, CUE.farthest + 2.6));
  ringSun.arc({ center: [0, 0, 0], r: Math.max(0.01, 5 * u1), ...XZ }).set({ opacity: u1 > 0.002 && tt < CUE.farthest + 0.2 ? 0.95 * (1 - 0.5 * u1) : 0 });
  ringFar.arc({ center: [0, 0, 0], r: Math.max(0.01, HF * u2), ...XZ }).set({ opacity: u2 > 0.002 ? 0.95 * (1 - 0.6 * u2) : 0 });
  LITS.forEach((l, k) => {
    const t0 = k < 6 ? CUE.age1 + 0.3 + k * 1.25 : CUE.begin + 1.1 + (k - 6) * 1.05, tEnd = k < 6 ? CUE.begin + 0.8 : CUE.rd + 0.8;
    if (l.t0 !== t0) { l.t0 = t0; const cmK = camAt(t0 + 0.5), inside = Math.hypot(...cmK.p) < 20; const rnd = () => lr2() - 0.5;
      if (inside) { const d = [cmK.l[0] - cmK.p[0], cmK.l[1] - cmK.p[1], cmK.l[2] - cmK.p[2]], n = Math.hypot(...d), r = 34 + 40 * lr2(); l.c = [cmK.p[0] + d[0] / n * r + rnd() * 26, cmK.p[1] + d[1] / n * r + rnd() * 22, cmK.p[2] + d[2] / n * r + rnd() * 10]; }
      else { const th = Math.acos(2 * lr2() - 1), ph = lr2() * 6.2832, r = 20 + 55 * lr2(); l.c = [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)]; } }
    const on = tt >= t0 && tt < tEnd, age = tt - t0, pulse = on ? 0.55 + 0.45 * Math.exp(-age * 2.2) : 0;
    l.b.set({ center: l.c, camera, opacity: on ? Math.min(1, age * 5) * (1 - fadeIn(tt, tEnd - 0.6, 0.6)) * (0.8 + 0.2 * pulse) : 0 });
    l.ring.arc({ center: l.c, r: Math.max(0.01, 1 + 9 * Math.min(1, age / 0.9)), e1: right.toArray(), e2: up.toArray() }).set({ opacity: on && age < 0.9 ? 0.9 * (1 - age / 0.9) : 0 });
  });
  overlay2d(t);
  hud.update(t); tRing.update(t); eRing.update(t);
  const lk = fadeIn(t, FILM.loop0, 0.45);
  endEl.style.opacity = String(1 - lk);
  if (scrimEl) scrimEl.style.opacity = String(parseFloat(scrimEl.style.opacity || "0") * (1 - lk));
  for (const c of LOOPEL) { c.style.visibility = lk > 0.01 ? "visible" : "hidden"; c.style.opacity = String(lk); }
  renderer.render(scene, camera);
};
