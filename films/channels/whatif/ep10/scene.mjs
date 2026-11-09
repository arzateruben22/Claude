import * as THREE from "three";
// Possibility Lab Season 2, Episode 4 (S2E04, folder ep10), "Every shuffle is new". The picture as a pure function of t for the film
// kit's page: window.seek(t) sets the shot, the camera, the world and the overlay from t alone, then renders once.
//
// The world: fifty-two playing cards face up on the graph paper, seen from above (instanced quads; one atlas of 52 faces drawn in code).
// A shuffle re-deals them into a new order (seeded permutations); picks glow (52, 51, 50 ...); the 68 digits of 52! type across the
// screen; the camera lifts to a crowd (instanced figures, each with a card flipping once a second); two bars compare every shuffle
// ever with all possible orders; the camera returns to your deck in the order of frame 0 (the loop). Timed by film.json (compile.py).
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createDesk } from "../set/desk.js";
import { createSpine } from "../set/spine.js";
import { titleFlap, endBox, workCard, injectCss } from "../set/motif.js";
import { createRig } from "../set/rig.js";
import { tok } from "../set/look.js";
import { unlit, ACES_INV_GLSL, hexRgb } from "../set/aces.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue;
const TK = (window.THEME && window.THEME.tokens) || {};
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const bg = tok("graphite");
renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 3000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.95, bloom: 0.12 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();

const CHALK = TK.chalk || "#F4F2EC", CHALK2 = TK["chalk-2"] || "#A7AAB2", ANCH = TK.anchor || "#4DA3FF", MARK = TK.marker || "#EB63FF", GRAPH = TK.graphite || "#171A1E";

// ── the set ─────────────────────────────────────────────────────────────────
const desk = createDesk({ tokens: TK, y: 0, unit: 1, far: 160 });
scene.add(desk.group);

// the cards: one atlas of 52 faces (13 ranks x 4 suits), drawn in code once the fonts are ready
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"], SUITS = ["♠", "♥", "♦", "♣"];
const cvs = document.createElement("canvas"); cvs.width = 13 * 128; cvs.height = 4 * 180;
const atlas = new THREE.CanvasTexture(cvs); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; atlas.minFilter = THREE.LinearMipmapLinearFilter;
const drawAtlas = () => { const g = cvs.getContext("2d"); g.clearRect(0, 0, cvs.width, cvs.height);
  const fam = getComputedStyle(document.body).getPropertyValue("--font-display") || "sans-serif";
  for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) { const x = r * 128, y = s * 180, red = s === 1 || s === 2;
    g.fillStyle = "#F1EEE6"; g.beginPath(); g.roundRect(x + 5, y + 5, 118, 170, 12); g.fill();
    g.strokeStyle = "#2a2d33"; g.lineWidth = 3; g.stroke();
    g.fillStyle = red ? "#E0457B" : "#20232A"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `800 ${RANKS[r] === "10" ? 44 : 54}px ${fam}`; g.fillText(RANKS[r], x + 34, y + 38);
    g.font = `700 34px ${fam}`; g.fillText(SUITS[s], x + 34, y + 78);
    g.font = `700 78px ${fam}`; g.fillText(SUITS[s], x + 66, y + 122); }
  atlas.needsUpdate = true; };
drawAtlas();
window.SCENE_READY = (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { drawAtlas(); });
const NC = 52, CW = 0.42, CH = 0.59;
const cardGeo = new THREE.PlaneGeometry(CW, CH); const cell = new Float32Array(NC * 2), glow = new Float32Array(NC);
for (let i = 0; i < NC; i++) { cell[i * 2] = i % 13; cell[i * 2 + 1] = Math.floor(i / 13); }
cardGeo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cell, 2));
const glowAttr = new THREE.InstancedBufferAttribute(glow, 1); cardGeo.setAttribute("aGlow", glowAttr);
const CVS = `attribute vec2 aCell; attribute float aGlow; varying vec2 vUv; varying vec2 vC; varying float vG;
void main() { vUv = uv; vC = aCell; vG = aGlow; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const CFS = `precision highp float; uniform sampler2D uMap; uniform vec3 uMark; uniform float uDim; varying vec2 vUv; varying vec2 vC; varying float vG;
${ACES_INV_GLSL}
void main() {
  vec2 uv = vec2((vC.x + vUv.x) / 13.0, 1.0 - (vC.y + 1.0 - vUv.y) / 4.0);
  vec4 t = texture2D(uMap, uv); if (t.a < 0.05) discard;
  vec3 col = t.rgb * 0.82; col = mix(col, uMark, 0.28 * vG); col *= (1.0 - 0.55 * uDim * (1.0 - vG)) ;
  gl_FragColor = vec4(acesInv(col, 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const cardMat = new THREE.ShaderMaterial({ uniforms: { uMap: { value: atlas }, uMark: { value: new THREE.Vector3(...hexRgb(MARK)) }, uDim: { value: 0 } }, vertexShader: CVS, fragmentShader: CFS, transparent: false, depthWrite: true });
const cards = new THREE.InstancedMesh(cardGeo, cardMat, NC); cards.frustumCulled = false; cards.userData.noProbe = true; cards.renderOrder = 5; scene.add(cards);

// seeded permutations: perm[slot] = the card in that slot
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const permOf = (k) => { const r = rng(CUE.seed * 7919 + k * 104729 + 3), a = Array.from({ length: NC }, (_, i) => i); for (let i = NC - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const PERMS = new Map(); const perm = (k) => { if (!PERMS.has(k)) PERMS.set(k, permOf(k)); return PERMS.get(k); };
const COLS = 9, slotXZ = (k) => { const c = k % COLS, r = Math.floor(k / COLS), off = r === 5 ? 1 : 0; return [(c + off - 4) * 0.5, (r - 2.5) * 0.68]; };
const posOf = (p, card) => slotXZ(p.indexOf(card));

// the crowd: a grid of people, each with a card flipping once a second (instanced)
const NCR = 1200;
const mk = (geo, hex, o = 1) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: unlit(hex), transparent: true, opacity: o, depthWrite: false }), NCR); m.frustumCulled = false; m.userData.noProbe = true; m.renderOrder = 4; scene.add(m); return m; };
const bodyG = new THREE.CapsuleGeometry(0.34, 0.9, 4, 10); bodyG.translate(0, 0.8, 0);
const headG = new THREE.SphereGeometry(0.28, 12, 9); headG.translate(0, 1.8, 0);
const flipG = new THREE.PlaneGeometry(0.7, 0.95); flipG.translate(0, 0.5, 0);
const crBody = mk(bodyG, "#767A84", 0.8), crHead = mk(headG, "#767A84", 0.8), crCard = mk(flipG, CHALK2, 0.9);
const Mx = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), S3 = new THREE.Vector3(), P3 = new THREE.Vector3(), EU = new THREE.Euler();
const crowdXY = []; { const r = rng(91); for (let i = 0; i < NCR; i++) { const c = i % 50, rr = Math.floor(i / 50); crowdXY.push([(c - 24.5) * 3.0 + (r() - 0.5) * 0.8, (rr - 11.5) * 3.0 + (r() - 0.5) * 0.8, r()]); } }
const you = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 10), new THREE.MeshBasicMaterial({ color: unlit(ANCH), depthWrite: false })); you.geometry.translate(0, 0.8, 0); you.visible = false; you.renderOrder = 6; scene.add(you);

// ── the camera ──────────────────────────────────────────────────────────────
const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tFlap = titleFlap(titleEl, { t0: FILM.title.t0 ?? 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, keys: c.keys, ease: "linear", fmt: (v) => (c.unit === "billion" ? v.toFixed(1) : String(Math.round(v))), minCh: 3, unit: c.unit, lit: (v) => v >= c.end - 0.05 });
}
const spine = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
const work = workCard(FILM.work, { safe: hud.safe, W, H, capTop: 0.61, y: 0.2 });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end, y: 0.14 });
const endT = endEl.querySelector(".t"), endFo = endEl.querySelector(".fo"); if (endT) endT.style.fontSize = "5.6vmin"; if (endFo) endFo.style.marginTop = "1.6vmin";
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.7vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "1.6vmin auto 0" });
const ebox = endBox(endEl, { t0: FILM.endCard, answer: FILM.endAnswer, S1: Math.min(W, H) / 1080 });
// the 68 digits of 52!, typed across the screen
const DIG = String(FILM.world.digits).replace(/\D/g, "");               // the 68 digits, set in a fixed block of 4 lines of 17 on their own plate
const digEl = document.createElement("div");
digEl.style.cssText = "position:absolute;left:50%;top:18.5%;transform:translateX(-50%);padding:2.6vmin 3.4vmin;border-radius:3vmin;background:rgba(14,17,21,.94);border:1.5px solid rgba(255,255,255,.14);opacity:0;pointer-events:none;z-index:4;font:700 4.9vmin/1.42 var(--font-mono);color:var(--hud-text);text-align:left;letter-spacing:.06em;white-space:pre";
document.body.appendChild(digEl);
// the dim layer under the overlay, and the two bars
const dimEl = document.createElement("div"); dimEl.style.cssText = "position:absolute;inset:0;background:#171A1E;opacity:0;pointer-events:none;z-index:2"; document.body.appendChild(dimEl);
const barsEl = document.createElement("div");
barsEl.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:3;font:600 3vmin/1.25 var(--font-text);color:var(--hud-text)";
barsEl.innerHTML = '<div style="position:absolute;left:14%;width:25%;top:9%;height:32%"><div style="position:absolute;bottom:0;width:100%;height:2px;background:' + ANCH + '"></div><div id="b1" style="position:absolute;bottom:3.6vmin;width:100%;text-align:center;font:700 3.4vmin/1.2 var(--font-mono);color:' + ANCH + '">≈ 3.6 × 10²⁷</div></div>' +
  '<div style="position:absolute;left:14%;width:25%;top:42.5%;text-align:center;line-height:1.2">every shuffle<br>ever made</div>' +
  '<div style="position:absolute;left:58%;width:28%;top:9%;height:32%;overflow:hidden"><div id="b2" style="position:absolute;bottom:0;width:100%;height:0%;background:linear-gradient(0deg,#EB63FF,#B249D4);border-radius:2px 2px 0 0"></div><div id="b2t" style="position:absolute;top:0;width:100%;text-align:center;font:700 3.4vmin/1.2 var(--font-mono);color:#fff;padding-top:1vmin;opacity:0">≈ 8 × 10⁶⁷ ↑</div></div>' +
  '<div style="position:absolute;left:58%;width:28%;top:42.5%;text-align:center;line-height:1.2">all the<br>possible orders</div>';
document.body.appendChild(barsEl);

// ── staging ─────────────────────────────────────────────────────────────────
const beat = (id) => FILM.beats.find((b) => b.id === id);
const SH = CUE.shuf;
const permAt = (t) => { // the two orders and the progress between them at time t
  let from = 0, to = 0, u = 1, kFrom = 0;
  for (const [ts, dur, k] of SH) { if (t >= ts) { from = kFrom; to = k; u = clamp01((t - ts) / dur); kFrom = u >= 1 ? k : kFrom; if (u >= 1) { from = k; } } else break; }
  return { from: perm(from), to: perm(to), u: E.inout2(u), k: to };
};

window.seek = function (t) {
  window.__t = t;
  const st = stage(t), shot = st.name;
  const pose = rig.place(camera, shot, t);
  const d = pose.dist, ld = Math.log10(d);
  camera.near = Math.max(0.05, d / 200); camera.far = Math.max(2000, d * 60); camera.updateProjectionMatrix();
  const gate = 1 - E.inout2(seg(t, FILM.endCard, FILM.endCard + 0.6));
  window.__d = d;

  desk.group.visible = true;
  desk.update({ grid: 1 - seg(ld, 1.9, 2.4), pool: [pose.target[0], pose.target[2]], casters: [], span: Math.max(800, d * 8) });
  desk.uniforms.uExposure.value = 1 + 4 * seg(ld, 2.0, 2.3);

  // the cards: positions from the permutations; lift while a card is in flight; glow on the picks and on the wave of choices
  const pa = permAt(t), cardsOn = t < CUE.crowd[0] + 1.5 || t > CUE.home - 0.2;
  const cardFade = 1 - seg(t, CUE.crowd[0], CUE.crowd[0] + 1.4) + seg(t, CUE.home - 0.05, CUE.home + 0.25);
  cards.visible = cardsOn && cardFade > 0.02; cardMat.uniforms.uDim.value = 1 - clamp01(cardFade);
  const pk = CUE.picks, wv = E.inout2(seg(t, CUE.multi[0], CUE.multi[1]));
  for (let c = 0; c < NC; c++) {
    const A_ = posOf(pa.from, c), B_ = posOf(pa.to, c);
    const same = pa.from === pa.to, u = same ? 1 : pa.u, ex = A_[0] + (B_[0] - A_[0]) * u, ez = A_[1] + (B_[1] - A_[1]) * u;
    const moving = !same && u > 0.001 && u < 0.999 && (A_[0] !== B_[0] || A_[1] !== B_[1]);
    const arc = moving ? Math.sin(Math.PI * u) * (0.7 + 0.5 * ((c * 37) % 7) / 7) : 0;
    const rot = moving ? Math.sin(Math.PI * u) * (((c * 53) % 11) - 5) * 0.07 : 0;
    let g = 0, lift = 0;
    for (let i = 0; i < 3; i++) { const idx = pa.to[pa.to === pa.from ? 0 : 0] !== undefined ? i : i; const pc = perm(1)[[3, 17, 41][i]]; const on = seg(t, pk[i], pk[i] + 0.25) * (1 - seg(t, CUE.multi[0], CUE.multi[0] + 0.4)); if (c === pc) { g = Math.max(g, on); lift = Math.max(lift, 0.5 * on); } }
    const wpos = (c * 29 % NC) / NC, wave = wv * (1 - clamp01(Math.abs(seg(t, CUE.multi[0], CUE.multi[1]) * 1.3 - wpos) * 5));
    g = Math.max(g, wave); lift = Math.max(lift, 0.3 * wave);
    glow[c] = g;
    EU.set(-Math.PI / 2, 0, rot); Q0.setFromEuler(EU); S3.set(1 + 0.25 * g, 1 + 0.25 * g, 1); P3.set(ex, 0.03 + arc + lift, ez);
    Mx.compose(P3, Q0, S3); cards.setMatrixAt(c, Mx);
  }
  cards.instanceMatrix.needsUpdate = true; glowAttr.needsUpdate = true;

  // the crowd (from the moment the camera lifts until it comes home)
  const crOn = (shot === "crowd" || shot === "bars") && t > CUE.crowd[0] + 0.4;
  const crO = shot === "crowd" ? seg(t, CUE.crowd[0] + 0.6, CUE.crowd[0] + 2.4) : 1 - seg(t, CUE.home - 0.3, CUE.home + 1.8);
  for (const m of [crBody, crHead, crCard]) { m.visible = crOn && crO > 0.01; m.material.opacity = (m === crCard ? 0.9 : 0.8) * crO; }
  const shufflesOn = seg(t, CUE.years[0], CUE.years[0] + 0.5);
  for (let i = 0; i < NCR; i++) { const [x, z, ph] = crowdXY[i], fl = shufflesOn * ((t * 1.0 + ph) % 1.0);
    S3.set(1, 1, 1); P3.set(x, 0, z); Q0.identity(); Mx.compose(P3, Q0, S3); crBody.setMatrixAt(i, Mx); crHead.setMatrixAt(i, Mx);
    const flipA = fl < 0.35 ? Math.sin((fl / 0.35) * Math.PI) * 1.2 : 0; EU.set(-0.9 - flipA * 1.2, 0, 0); Q1.setFromEuler(EU); P3.set(x + 0.0, 2.2 + flipA * 0.3, z); S3.set(0.9, 0.9, 0.9); Mx.compose(P3, Q1, S3); crCard.setMatrixAt(i, Mx); }
  crBody.instanceMatrix.needsUpdate = crHead.instanceMatrix.needsUpdate = crCard.instanceMatrix.needsUpdate = true;
  const youU = E.out3(seg(t, CUE.crowd[0] + 2.3, CUE.crowd[0] + 2.9));   // you step into the crowd once the camera has risen clear of the caption plate
  you.visible = crOn && crO > 0.01 && youU > 0.01; you.position.set(0.0, 0, 5.5); you.scale.setScalar(Math.max(0.01, 2.2 * youU));

  // the digits of 52!
  { const dg = CUE.digits, typed = E.inout2(seg(t, dg[0], dg[1])), fade = 1 - seg(t, dg[2], dg[2] + 0.5);
    let s = ""; for (let r = 0; r < 4; r++) { const line = DIG.slice(r * 17, r * 17 + 17), k = Math.max(0, Math.min(17, Math.round(typed * DIG.length) - r * 17)); s += (r ? "\n" : "") + line.slice(0, k) + '<span style="opacity:0">' + line.slice(k) + "</span>"; }
    digEl.innerHTML = s; digEl.style.opacity = String((seg(t, dg[0] - 0.05, dg[0] + 0.2) * fade * 0.97).toFixed(3));
    dimEl.style.opacity = String((0.72 * seg(t, dg[0] - 0.1, dg[0] + 0.4) * (1 - seg(t, dg[2], dg[2] + 0.6)) + 0.82 * seg(t, CUE.bars[0] - 0.2, CUE.bars[0] + 0.5) * (1 - seg(t, CUE.home - 0.6, CUE.home + 0.4)) + 0.9 * seg(t, FILM.endCard - 0.25, FILM.endCard + 0.3) * (1 - seg(t, beat("tease").t1 - 0.75, beat("tease").t1 - 0.05))).toFixed(3)); }
  // the bars
  { const b = CUE.bars, on = seg(t, b[0] - 0.1, b[0] + 0.5) * (t < CUE.work0 - 0.02 ? 1 : 0), grow = E.inout2(seg(t, CUE.bigbar[0], CUE.bigbar[1] + 1.2));
    barsEl.style.opacity = String(on.toFixed(3)); document.getElementById("b2").style.height = (100 * grow).toFixed(1) + "%"; document.getElementById("b2t").style.opacity = String(seg(t, CUE.bigbar[1], CUE.bigbar[1] + 0.6).toFixed(3)); }

  hud.update(t);
  const tail = E.inout2(seg(t, beat("tease").t1 - 1.35, beat("tease").t1 - 0.8));   // the card text is gone while the deck is still dimmed; then the dim lifts on the bare deck
  if (tail > 0) { endEl.style.opacity = String(Number(endEl.style.opacity || 1) * (1 - tail)); const sc = document.querySelector(".hud-scrim"); if (sc) sc.style.opacity = String(Number(sc.style.opacity || 0) * (1 - tail)); }
  tFlap.update(t);
  spine.update(t, gate);
  work.update(t, gate);
  ebox.update(t);
  void W;
  renderer.render(scene, camera);
};
