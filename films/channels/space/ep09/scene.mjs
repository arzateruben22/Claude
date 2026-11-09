import * as THREE from "three";
// One More Orbit, Season 2 · Episode 3 (folder ep09), "Your gold". The picture as a pure function of t.
//
// One 3-D world (not to scale, badged): two neutron stars in orbit, a jeweller's ring at (22, -4, 14), and a camera that moves between them.
// Hook: the stars in a tight orbit and gold beads streaming toward the ring (the payoff, as a teaser). Normal: a flat 2-D explainer (periodic
// table, a nucleus soaking up neutrons) between two dips to black. Change and why: the stars spiral together (lilac ripples) and merge on
// "A crash throws out hot matter"; the ejecta cool from white to pale gold; beads of gold leave the cloud. Whoa: the camera follows them to the
// ring and the ring takes them. Readout: the ripples (lilac) leave first, the light (teal) hours later. The last frame is frame 0's pose.
// Gold is drawn pale lemon (the channel has no gold). Set: ../set (sky, star, beacon, rig, look, motif). Kit: hud, front.
import { stage, seg, E, clamp01 } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { ring } from "cinema/sci/front.js";
import { createSky } from "../set/sky.js";
import { createStar } from "../set/star.js";
import { createBeacon } from "../set/beacon.js";
import { createRig } from "../set/rig.js";
import { hdr, line } from "../set/look.js";
import { titleRing, endRing, injectCss } from "../set/motif.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, RING = FILM.ring;
const S1 = Math.min(W, H) / 1080, sx = W / 1080, sy = H / 1920;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 4000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 12, threshold: 0.9, bloom: 0.55 });
window.CINEMA_FOCUS = () => ({ point: [0, 0, 0], fstop: 0 });
injectCss();
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const pos = (c) => c.map((v) => Math.max(0, v));
const mul = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const V = (a) => new THREE.Vector3(...a);

// ── the 3-D set ─────────────────────────────────────────────────────────────
const sky = createSky({ stars: 6000, seed: 91 });
scene.add(sky.group);
const NSC = hdr("ice", 1.15);
const starA = createStar({ radius: 0.75, intensity: 1.5, corona: 2.0, coronaI: 0.28, limb: 0.5, granulation: 0.14, color: NSC });
const starB = createStar({ radius: 0.75, intensity: 1.5, corona: 2.0, coronaI: 0.28, limb: 0.5, granulation: 0.14, color: NSC });
scene.add(starA.group, starB.group);
const flash = createBeacon({ color: [1.4, 1.4, 1.5], px: 260, core: 0.3 });
scene.add(flash.mesh);
const XZ = { e1: [1, 0, 0], e2: [0, 0, -1] };
const ripples = Array.from({ length: 5 }, () => ring({ color: pos(line("lilac", 0.9)), width: 3, opacity: 0 }));
const ringGW = ring({ color: pos(line("lilac", 0.95)), width: 5, opacity: 0 });
const ringLi = ring({ color: pos(line("teal", 0.95)), width: 5, opacity: 0 });
for (const r of [...ripples, ringGW, ringLi]) scene.add(r.mesh);
// the ejecta: hot matter thrown out at the merger; it cools from white to pale gold and fades
const NE = 760, er = mul(11), eD = new Float32Array(NE * 3), eS = new Float32Array(NE), eR = new Float32Array(NE);
for (let i = 0; i < NE; i++) {
  const polar = er() < 0.38, a = er() * 6.2832, c = polar ? 0.8 + er() * 0.2 : (er() - 0.5) * 0.5;
  const s = Math.sqrt(Math.max(0, 1 - c * c)) ; const sg = er() < 0.5 ? -1 : 1;
  eD.set([s * Math.cos(a), (polar ? sg * c : c), s * Math.sin(a)], i * 3); eS[i] = 0.4 + er() * 1.9; eR[i] = er();
}
const eG = new THREE.BufferGeometry();
eG.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NE * 3), 3)); eG.setAttribute("dir", new THREE.BufferAttribute(eD, 3));
eG.setAttribute("spd", new THREE.BufferAttribute(eS, 1)); eG.setAttribute("rnd", new THREE.BufferAttribute(eR, 1));
const ejMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uPx: { value: 8 * S1 }, uOp: { value: 1 } },
  vertexShader: `attribute vec3 dir; attribute float spd, rnd; uniform float uT, uPx; varying float vAge, vR;
    void main(){ float d = spd * 2.0 * (1.0 - exp(-uT * 0.5)); vec4 mv = modelViewMatrix * vec4(dir * d, 1.0); gl_Position = projectionMatrix * mv;
      gl_PointSize = uPx * (0.55 + rnd) * (1.0 + 1.8 * exp(-uT * 0.9)); vAge = uT; vR = rnd; }`,
  fragmentShader: `uniform float uOp; varying float vAge, vR; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
      vec3 hot = vec3(0.86, 0.94, 1.0), cool = vec3(0.93, 0.9, 0.52); vec3 c = mix(hot, cool, smoothstep(0.0, 6.0, vAge));
      float a = (1.0 - smoothstep(0.2, 1.0, r2)) * uOp * smoothstep(0.0, 0.18, vAge) * (1.0 - smoothstep(9.0, 18.0, vAge));
      gl_FragColor = vec4(c * a * 1.5, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const ejecta = new THREE.Points(eG, ejMat); ejecta.frustumCulled = false; scene.add(ejecta);
// gold beads: pale-lemon points that leave the cloud and fly (on arcs) to the ring
const NB = 28, bR = mul(23), bPos = new Float32Array(NB * 3), bA = new Float32Array(NB), bS = new Float32Array(NB);
const BEAD = Array.from({ length: NB }, (_, k) => ({ k, off: [bR() - 0.5, bR() - 0.5, bR() - 0.5], up: 2 + bR() * 3, side: (bR() - 0.5) * 5, lag: k * 0.18 }));
const bG = new THREE.BufferGeometry();
bG.setAttribute("position", new THREE.BufferAttribute(bPos, 3)); bG.setAttribute("alpha", new THREE.BufferAttribute(bA, 1)); bG.setAttribute("size", new THREE.BufferAttribute(bS, 1));
const beadMat = new THREE.ShaderMaterial({
  uniforms: { uPx: { value: S1 }, uCol: { value: V(pos(hdr("lemon", 1.5))) } },
  vertexShader: `attribute float alpha, size; uniform float uPx; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPx; vA = alpha; }`,
  fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0 || vA < 0.01) discard; float a = (1.0 - smoothstep(0.1, 1.0, r2)) * vA; gl_FragColor = vec4(uCol * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const beads = new THREE.Points(bG, beadMat); beads.frustumCulled = false; scene.add(beads);
// the jeweller's ring: a gold band (a torus) shaded as polished metal, in pale lemon
const ringMat = new THREE.ShaderMaterial({
  uniforms: { uCol: { value: V(pos(hdr("lemon", 0.5))) }, uGlint: { value: 0 }, uT: { value: 0 } },
  vertexShader: `varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uGlint, uT; varying vec3 vN, vV, vP;
    void main(){ vec3 n = normalize(vN), v = normalize(vV), L = normalize(vec3(0.45, 0.75, 0.55)); float f = pow(1.0 - abs(dot(n, v)), 1.5);
      float band = 0.5 + 0.5 * sin(vP.x * 7.0 + vP.y * 5.0 + vP.z * 3.0 + uT * 0.5); float spec = pow(max(dot(reflect(-L, n), v), 0.0), 26.0);
      vec3 col = uCol * (0.2 + 0.7 * f + 0.3 * band) + vec3(1.0, 0.97, 0.88) * spec * (0.35 + 0.8 * uGlint) + uCol * uGlint * 0.35 * f;
      gl_FragColor = vec4(col, 1.0); }`,
});
const jewel = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.32, 28, 112), ringMat);
jewel.position.fromArray(RING); jewel.rotation.set(1.05, 0.4, 0.2);
scene.add(jewel);
const rig = createRig(FILM.cam);

// ── the 2-D layer (the explainer, the Manhattan comparison, the dips; a pure function of t) ───────────────────
const tc = document.createElement("canvas");
tc.width = W; tc.height = H;
Object.assign(tc.style, { position: "absolute", left: 0, top: 0, width: `${W}px`, height: `${H}px`, zIndex: 1, pointerEvents: "none" });
document.getElementById("hud").appendChild(tc);
const ctx = tc.getContext("2d");
const TEAL = [79, 227, 198], LEMON = [242, 237, 166], ICE = [143, 208, 255], LILAC = [185, 166, 255], TXT = [238, 240, 255], TXT2 = [169, 176, 217], VOID = [8, 10, 28];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x * sx, y * sy, r * sx, 0, 6.2832); };
const lw = (w) => { ctx.lineWidth = w * S1; };
const pulse = (t) => { let z = 0; for (const tp of CUE.pulses) { const x = t - tp; if (x > 0 && x < 2.2) z += 0.035 * (x < 0.25 ? Math.sin((x / 0.25) * 1.5708) : Math.exp(-(x - 0.25) / 0.55)); } return z; };
// a periodic table (simplified): 18 columns, 7 rows; iron and gold lit
const ROWS = [[0, 17], [0, 1, 12, 13, 14, 15, 16, 17], [0, 1, 12, 13, 14, 15, 16, 17], Array.from({ length: 18 }, (_, i) => i), Array.from({ length: 18 }, (_, i) => i), Array.from({ length: 18 }, (_, i) => i), Array.from({ length: 18 }, (_, i) => i)];
const TX0 = 180, TY0 = 340, CW = 40, CH = 35, FE = [3, 7], AU = [5, 10];
const cellXY = (r, c) => [TX0 + c * CW + CW / 2, TY0 + r * CH + CH / 2];
const heavier = (r, c) => r > FE[0] || (r === FE[0] && c > FE[1]);
const NR = mul(5);
const NEUT = Array.from({ length: 160 }, () => ({ a: NR() * 6.2832, u: NR(), v: 0.35 + NR() * 0.5 }));
function label(txt, x, y, col, a, size = 30) { ctx.font = `700 ${Math.round(size * S1)}px Lexend, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = rgba(col, a); ctx.fillText(txt, x * sx, y * sy); }
function explainer(t, k) {
  if (k <= 0.01) return;
  ctx.fillStyle = rgba(VOID, 0.985 * k); ctx.fillRect(0, 0, W, H);
  const hK = fadeIn(t, CUE.heavier - 0.2, 0.7);
  for (let r = 0; r < ROWS.length; r++) for (const c of ROWS[r]) {
    const [x, y] = cellXY(r, c), isFe = r === FE[0] && c === FE[1], isAu = r === AU[0] && c === AU[1];
    ctx.beginPath(); ctx.roundRect(x * sx - (CW / 2 - 2) * sx, y * sy - (CH / 2 - 2) * sy, (CW - 4) * sx, (CH - 4) * sy, 5 * S1);
    ctx.fillStyle = rgba(isAu ? LEMON : isFe ? LILAC : TXT2, (isAu || isFe ? 0.95 : heavier(r, c) ? 0.12 + 0.2 * hK : 0.14) * k); ctx.fill();
  }
  label("Fe  iron", cellXY(FE[0], FE[1])[0], cellXY(FE[0], FE[1])[1] - 40, LILAC, k, 26);
  label("Au  gold", cellXY(AU[0], AU[1])[0] + 20, cellXY(AU[0], AU[1])[1] + 40, LEMON, k, 26);
  if (hK > 0.01) { const [x0, y0] = cellXY(...FE), [x1, y1] = cellXY(...AU); ctx.strokeStyle = rgba(LEMON, 0.9 * hK * k); lw(3.5); ctx.beginPath(); ctx.moveTo(x0 * sx, y0 * sy); ctx.lineTo((x0 + (x1 - x0) * hK) * sx, (y0 + (y1 - y0) * hK) * sy); ctx.stroke(); }
  // a nucleus soaking up neutrons (slowly at first, then a flood)
  const cx = 540, cy = 880, base = 54, soak = seg(t, CUE.soak - 0.3, CUE.fast), flood = seg(t, CUE.fast, CUE.n + (CUE.c - CUE.n));
  const nuc = base * (1 + 0.45 * E.inout3(soak) + 0.35 * flood);
  ctx.fillStyle = rgba(LEMON, 0.16 * k); circ(cx, cy, nuc + 16); ctx.fill();
  const NN = 26; for (let i = 0; i < NN; i++) { const a = i * 2.399, d = Math.sqrt((i + 0.5) / NN) * nuc * 0.92; circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 9); ctx.fillStyle = rgba(i % 2 ? LEMON : ICE, 0.95 * k); ctx.fill(); }
  const rate = (t < CUE.fast ? 0.7 : 5.0); const gate = fadeIn(t, CUE.soak - 0.3, 0.4);
  for (const n of NEUT) {
    const ph = ((t - CUE.soak) * n.v * rate * 0.35 + n.u) % 1; if (t < CUE.soak - 0.3 || ph < 0 || (t < CUE.fast && n.u > 0.12)) continue;
    const d = 470 * (1 - ph), a = n.a;
    circ(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.78, 6.5 + 2 * ph); ctx.fillStyle = rgba(TEAL, 0.95 * gate * k * Math.min(1, ph * 5)); ctx.fill();
  }
}
function manhattan(t, k) {                                                     // a neutron star's width = Manhattan Island's length (an illustration)
  if (k <= 0.01) return;
  ctx.fillStyle = rgba(VOID, 0.78 * k); ctx.beginPath(); ctx.roundRect(90 * sx, 330 * sy, 810 * sx, 230 * sy, 18 * S1); ctx.fill();
  ctx.strokeStyle = rgba(TXT2, 0.45 * k); lw(2); ctx.beginPath(); ctx.roundRect(90 * sx, 330 * sy, 810 * sx, 230 * sy, 18 * S1); ctx.stroke();
  const cx1 = 270, cx2 = 700, cy = 445, L = 190, g = fadeIn(t, CUE.city, 0.6);
  circ(cx1, cy, L / 2 * g); ctx.fillStyle = rgba(ICE, 0.35 * k); ctx.fill(); ctx.strokeStyle = rgba(ICE, k); lw(3); ctx.stroke();
  label("neutron star", cx1, cy + 118, ICE, k, 26);
  // Manhattan: a long slim island, tilted (stylised), the same length as the star is wide
  ctx.save(); ctx.translate(cx2 * sx, cy * sy); ctx.rotate(-0.5);
  ctx.beginPath(); const w = 34 * sx, l = L * sx * g; ctx.moveTo(-l / 2, 0); ctx.lineTo(-l * 0.32, -w * 0.5); ctx.lineTo(l * 0.28, -w * 0.62); ctx.lineTo(l / 2, -w * 0.2); ctx.lineTo(l * 0.4, w * 0.5); ctx.lineTo(-l * 0.1, w * 0.62); ctx.lineTo(-l * 0.42, w * 0.3); ctx.closePath();
  ctx.fillStyle = rgba(TXT, 0.4 * k); ctx.fill(); ctx.strokeStyle = rgba(TXT, k); lw(3); ctx.stroke(); ctx.restore();
  label("Manhattan Island", cx2, cy + 118, TXT, k, 26);
  ctx.strokeStyle = rgba(TEAL, 0.9 * k * g); lw(3); ctx.beginPath(); ctx.moveTo((cx1 - L / 2) * sx, (cy - 82) * sy); ctx.lineTo((cx1 + L / 2) * sx, (cy - 82) * sy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo((cx2 - L / 2) * sx, (cy - 82) * sy); ctx.lineTo((cx2 + L / 2) * sx, (cy - 82) * sy); ctx.stroke();
}
function overlay2d(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  const z = 1 + pulse(t), fcy = 0.4 * H;
  ctx.setTransform(z, 0, 0, z, (W / 2) * (1 - z), fcy * (1 - z));
  const [d0, d1, d2] = CUE.dip;
  const kTab = E.inout3(seg(t, d0 - 0.1, d0 + 0.15)) * (1 - E.inout3(seg(t, d1, d1 + 0.2)));
  explainer(t, kTab);
  manhattan(t, fadeIn(t, CUE.city - 0.4, 0.5) * (1 - fadeIn(t, CUE.tm - 0.5, 0.4)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dip = E.inout3(seg(t, d2 - 0.1, d2 + 0.15)) * (1 - E.inout3(seg(t, d2 + 0.15, d2 + 0.4)));        // the loop back to frame 0
  if (dip > 0.001) { ctx.fillStyle = rgba(VOID, dip); ctx.fillRect(0, 0, W, H); }
}

// ── the overlay ─────────────────────────────────────────────────────────────
const hud = createHud({ camera, shots: FILM.shots });
const S = { starA: [0, 0, 0], starB: [0, 0, 0], bead: [0, 0, 0], ring: RING };
const KIND = { body: { color: "ice", glyph: "●", mark: "none" }, star: { color: "lemon", glyph: "✦", mark: "none" } };
const cap0 = FILM.captions[0], capShift = FILM.loop0 - 0.05 - cap0.t0;
const capLoop = { t0: FILM.loop0 - 0.05, t1: FILM.dur + 5, lines: cap0.lines.map((ln) => ln.map(([w, tw]) => [w, tw + capShift])) };
hud.captions([...FILM.captions, capLoop]);
const titleEl = hud.title(FILM.title);
const tRing = titleRing(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const CEL = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, lit: () => true, value: () => 0, fmt: () => c.text });
  CEL[c.id] = el; el.classList.add(c.read ? "lm-read" : "lm-clock");
  const lb = el.querySelector(".lb");
  if (lb) lb.style.textShadow = "0 0 1.2vmin rgba(8,10,28,.95), 0 0 2.6vmin rgba(8,10,28,.85)";
  const v = el.querySelector(".v");
  if (v && c.text.length > 12) v.style.fontSize = c.read ? "4.2vmin" : "5.2vmin";
  else if (v && c.text.length > 8 && !c.read) v.style.fontSize = "7.5vmin";
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => S[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, side: L.side, v: L.v, fixed: L.fixed });
}
for (const p of FILM.pills || []) hud.scale(p.id, { text: p.text, bar: null, t0: p.t0, t1: p.t1, at: p.at });
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "3.1vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "66vmin", margin: "2.5vmin auto 0", textWrap: "balance" });
const endT = endEl.querySelector(".t");
if (endT) endT.style.fontSize = "6.2vmin";
const fo2 = endEl.querySelector(".fo");
if (fo2) fo2.style.marginTop = "1.8vmin";
const eRing = endRing(endEl, { t0: FILM.endCard, d: 0.9, safe: hud.safe, S1 });
const scrimEl = document.querySelector(".hud-scrim");
let LOOPEL = null;
function makeLoop() {                                                            // frame 0's title and '?' counter, cloned as they look at 1.5 s, for the loop back
  hud.update(1.5); tRing.update(1.5);
  LOOPEL = [titleEl, CEL["c-hook"]].filter(Boolean).map((el) => { const c = el.cloneNode(true); c.removeAttribute("id"); c.style.opacity = "0"; c.style.visibility = "hidden"; el.parentNode.appendChild(c); return c; });
}

// ── the orbit, the merger, the beads ─────────────────────────────────────────────────────────────
const TILT = new THREE.Vector3(0.2, 1, 0.1).normalize(), E1 = new THREE.Vector3(1, 0, 0), E2 = new THREE.Vector3().crossVectors(TILT, E1).normalize();
function orbit(t) {                                                              // {r, th}: tight in the hook, spiralling in from the change to the merger
  if (t < CUE.spiral0) return { r: 1.5, th: 2.1 * t };
  const u = clamp01((t - CUE.spiral0) / (CUE.tm - CUE.spiral0));
  return { r: Math.max(0.8, 6.0 * Math.pow(1 - u, 0.55)), th: 2.1 * CUE.spiral0 + 30 * (1 - Math.pow(1 - u, 0.4)) };
}
const bez = (p0, p1, p2, u) => p0.clone().multiplyScalar((1 - u) * (1 - u)).addScaledVector(p1, 2 * (1 - u) * u).addScaledVector(p2, u * u);
const RINGV = V(RING);

window.seek = function (t) {
  if (!LOOPEL) makeLoop();
  const dipT = CUE.dip[2] + 0.15, tt = t >= dipT ? 0 : t;                          // after the loop dip the world is frame 0's
  const st = stage(tt), shot = st.name, tr = Math.round(tt * FPS) / FPS;
  rig.place(camera, shot, tt);
  const o = orbit(tt), merged = tt >= CUE.tm;
  const pA = E1.clone().multiplyScalar(Math.cos(o.th) * o.r).addScaledVector(E2, Math.sin(o.th) * o.r), pB = pA.clone().multiplyScalar(-1);
  starA.set({ tau: tt * 200, on: !merged, center: pA.toArray(), camera }); starB.set({ tau: tt * 200, on: !merged, center: pB.toArray(), camera });
  S.starA = pA.toArray(); S.starB = pB.toArray();
  // the flash at the merger (ramps of at least 0.5 s)
  const f = E.out3(seg(tt, CUE.tm - 0.15, CUE.tm + 0.55)) * (1 - E.in3(seg(tt, CUE.tm + 0.6, CUE.tm + 2.0)));
  flash.set({ center: [0, 0, 0], camera, opacity: f * 0.6 });
  // ripples: gravitational waves leave the orbit while the stars spiral (lilac), one wavefront every 1.4 s
  for (let i = 0; i < ripples.length; i++) {
    const age = tt >= CUE.spiral0 - 0.5 && tt < CUE.tm + 3 ? (((tt - CUE.spiral0) * 0.7 + i / ripples.length) % 1) : -1;
    ripples[i].arc({ center: [0, 0, 0], r: 0.8 + 15 * Math.max(age, 0), ...XZ }).set({ opacity: age >= 0 ? 0.7 * (1 - age) * Math.min(1, age * 6) * (tt < CUE.tm ? 1 : 1 - E.out3(seg(tt, CUE.tm + 0.5, CUE.tm + 3))) : 0 });
  }
  // the readout: the ripples (lilac) leave first, the light (teal) hours later (not to scale)
  const rg = (tt - CUE.rip) * 2.6, rl = (tt - CUE.vis) * 2.6;
  ringGW.arc({ center: [0, 0, 0], r: Math.max(0.01, rg), ...XZ }).set({ opacity: tt >= CUE.rip && rg < 30 ? 0.95 * (1 - rg / 40) : 0 });
  ringLi.arc({ center: [0, 0, 0], r: Math.max(0.01, rl), ...XZ }).set({ opacity: tt >= CUE.vis && rl < 30 ? 0.95 * (1 - rl / 40) : 0 });
  // the ejecta: cooling hot matter
  ejMat.uniforms.uT.value = Math.max(0, tt - CUE.tm); ejecta.visible = tt >= CUE.tm;
  // the beads: looping teaser in the hook; real flights after the merger (arrivals while the camera goes to the ring)
  let arrived = 0;
  BEAD.forEach((b, k) => {
    let u = -1;
    if (tt < CUE.spiral0) u = (tt * 0.2 + k / NB) % 1;
    else if (tt >= CUE.tm) u = clamp01((tt - CUE.tm - 0.8 - b.lag) / 9);
    const live = u >= 0 && u < 1;
    if (u >= 1) arrived++;
    const p0 = new THREE.Vector3(b.off[0] * 1.6, b.off[1] * 1.6, b.off[2] * 1.6), p2 = RINGV.clone(), p1 = p0.clone().lerp(p2, 0.5).add(new THREE.Vector3(b.side * 0.6, b.up, b.side * 0.3));
    const p = bez(p0, p1, p2, Math.max(u, 0));
    bPos.set(p.toArray(), k * 3);
    bA[k] = live ? Math.min(1, u * 8) * (1 - E.in3(clamp01((u - 0.94) / 0.06))) : 0;
    bS[k] = 11 + 7 * Math.sin(k * 1.7 + tt * 3) ** 2 + 26 * E.in3(clamp01((u - 0.9) / 0.1));
    if (k === 6) S.bead = live ? p.toArray() : S.bead;
  });
  bG.attributes.position.needsUpdate = true; bG.attributes.alpha.needsUpdate = true; bG.attributes.size.needsUpdate = true;
  // the ring takes them: it glints as beads arrive; it turns slowly
  ringMat.uniforms.uGlint.value = Math.min(1, arrived / NB * 1.1 + 0.15 * (tt < CUE.spiral0 ? 1 : 0)); ringMat.uniforms.uT.value = tt;
  jewel.rotation.y = 0.4 + 0.12 * tt; jewel.rotation.z = 0.2 + 0.05 * tt;
  sky.update(camera, { frameCam: rig.frameCamera(camera, shot, tr), starGain: 0.8, bandGain: 0.7 });
  overlay2d(t);
  hud.update(t); tRing.update(t); eRing.update(t);
  const lk = fadeIn(t, FILM.loop0, 0.45);
  endEl.style.opacity = String(1 - lk);
  if (scrimEl) scrimEl.style.opacity = String(parseFloat(scrimEl.style.opacity || "0") * (1 - lk));
  for (const c of LOOPEL) { c.style.visibility = lk > 0.01 ? "visible" : "hidden"; c.style.opacity = String(lk); }
  renderer.render(scene, camera);
};
