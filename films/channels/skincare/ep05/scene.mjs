import * as THREE from "three";
// Outer Layer No. 005, "The sunscreen experiment" (films/channels/skincare/ep05), in the reboot's look (bible §2: the
// UV camera + macro flight). The picture as a pure function of t: window.seek(t) sets the shot, the camera, every
// object and the overlay from t alone, then makes exactly one renderer.render().
//
// Places: the hand (a macro flight over the skin's terrain at golden hour, a seam down the middle: two neighbours'
// skin as two halves of one model; ../set/terrain.js), the town (the trial's households, split by chance: a model, not
// a map; ../set/town05.js) and the hand through the 365 nm camera, split (../set/uvcam.js). One tone (medium).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { createUVSkin, createViewfinder, TONES } from "../set/uvcam.js";
import { createTown } from "../set/town05.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, P = FILM.plates, HD = FILM.hands, TW = FILM.town;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 2000);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.9, bloom: 0.3, exposure: 1.05 });
let focus = { point: [0, 0, 0], fstop: 0 };
window.CINEMA_FOCUS = () => focus;
injectCss();

scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2418, 0.6));
const sun = new THREE.DirectionalLight(0xffb870, 4.0); sun.position.set(30, 6, -30); scene.add(sun);
const key = new THREE.DirectionalLight(0xfff0e0, 1.0); key.position.set(-10, 14, 20); scene.add(key);
const FOG = new THREE.Fog(0x2c1660, 16, 52), FOG_TOWN = new THREE.Fog(0x2c1660, 260, 520);   // the distance sinks into the ground colour

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };
const MED = hexLin(TONES[1][0]).map((v) => v * 0.95), CAST = [0.5, 0.52, 0.56];   // bible §1: 005 is the medium tone; the cast is grey silicone
const T = createTerrain({ size: 80, segs: 320, seed: 23, spots: 60, half: "right" });
scene.add(T.group);
const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color(...hexLin("#5FF2E8")), transparent: true, opacity: 0.7 }));
seam.position.y = 0.42; T.group.add(seam);
const TOWN = createTown({ x: BIO.tx, n: 120, seed: 5 });
scene.add(TOWN.group);
const UVS = createUVSkin({ seed: 7.0 });
UVS.mesh.position.set(BIO.ux, 0, 0); UVS.mesh.rotation.x = -0.18; scene.add(UVS.mesh);
const rig = createRig(FILM.cam);

// ── the overlay ──
const hudRoot = document.getElementById("hud");
const hud = createHud({ camera, shots: FILM.shots });
const KIND = { cell: { color: "text", glyph: "●", mark: "none" }, water: { color: "water", glyph: "◇", mark: "none" }, uv: { color: "uv", glyph: "◆", mark: "none" } };
const A = {};
const at = (k) => () => A[k] || [0, 0, 0];
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: at(L.anchor), t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.25, liftAt: [0.18, 0.33] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.285, w: 0.8, h: 0.265 });
{ const st = document.createElement("style"); st.textContent = ".ol-vf .rec,.ol-vf .hl,.ol-vf .hr{background:var(--hud-plate);padding:.5vmin 1.2vmin;border-radius:1vmin}"; document.head.appendChild(st); }   // the viewfinder's words on chips: ≥ 4.5:1 over the glowing skin
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "2.4vmin",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
const O = P.odds, M = P.mel;
const odds = plate(`<div style="font:600 3.4vmin/1.3 var(--font-body, inherit)">${O.text}</div><div style="font:500 2.9vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:1vmin">${O.sub}</div>`,
  { left: "50%", top: `${0.44 * H}px`, transform: "translateX(-50%)", width: "78vmin", padding: "2.2vmin 3vmin" });
const dots = (n, c) => Array.from({ length: n }, () => `<i style="display:inline-block;width:2.6vmin;height:2.6vmin;border-radius:50%;margin:.35vmin;background:${c};opacity:0"></i>`).join("");
const mel = plate(`<div class="scc" style="font:600 3.1vmin/1.3 var(--font-body, inherit);opacity:0">squamous cell cancers, during the trial: <span style="color:var(--water)">lower</span><div style="font:500 2.6vmin/1.3 var(--font-mono);color:var(--text-2)">counted by tumours</div></div>
  <div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin:2vmin 0 1.2vmin">melanomas, ten years on</div>
  <div class="rows" style="display:grid;grid-template-columns:24vmin 1fr;align-items:center;gap:1.4vmin;font:600 3vmin/1.2 var(--font-body, inherit)"><span>daily</span><span class="d1">${dots(M.n[0], "var(--water)")}</span>
  <span>as they pleased</span><span class="d2">${dots(M.n[1], "var(--uv)")}</span></div>
  <div class="sub" style="font:500 2.8vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:1.6vmin;opacity:0">${M.n[0]} vs ${M.n[1]} · ${M.sub}</div>`,
  { left: "50%", top: `${0.32 * H}px`, transform: "translateX(-50%)", width: "72vmin", padding: "2.4vmin 3vmin" });
const rows = mel.querySelector(".rows"), mhead = rows.previousElementSibling, scc = mel.querySelector(".scc"), msub = mel.querySelector(".sub"), d1 = [...mel.querySelectorAll(".d1 i")], d2 = [...mel.querySelectorAll(".d2 i")];
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));
const daily = TOWN.houses.filter((h) => h.daily).sort((a, b) => Math.hypot(a.x + 20, a.z) - Math.hypot(b.x + 20, b.z))[0];
const dis = TOWN.houses.filter((h) => !h.daily).sort((a, b) => Math.hypot(a.x - 20, a.z - 10) - Math.hypot(b.x - 20, b.z - 10))[0];
const uvWorld = (u, v) => { const p = new THREE.Vector3(...UVS.at(u, v)); UVS.mesh.updateMatrixWorld(); return UVS.mesh.localToWorld(p).toArray(); };

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  const P0 = rig.place(camera, shot, t);
  const isHand = ["hand", "cast", "gauge", "hand2", "close"].includes(shot), isTown = shot === "town" || shot === "town2", isU = shot === "uv1" || shot === "uv2";
  T.group.visible = isHand; TOWN.group.visible = isTown; UVS.mesh.visible = isU;
  scene.fog = isHand ? FOG : isTown ? FOG_TOWN : null;
  focus = isHand ? { point: P0.target, fstop: 0.5 } : { point: P0.target, fstop: 0 };

  // ── the hand: the same to the eye; as a cast, the "as they pleased" half's lines deepen over the 4.5 years; under
  // the test dose, a satin film on the daily half ──
  if (isHand) {
    if (shot === "cast") T.set({ tone: CAST, furrows: 0.2 + 0.9 * u01(t, HD.age), spot: 0, sheen: 0 });
    else if (shot === "gauge") T.set({ tone: MED, furrows: 0.2, spot: 0, sheen: u01(t, HD.film) });
    else T.set({ tone: MED, furrows: 0.2, spot: 0, sheen: 0 });
    seam.material.opacity = shot === "hand" || shot === "hand2" || shot === "close" ? 0.5 : 0.75;
  }
  A.halfL = [-7, 0.4, 9]; A.halfR = [7, 0.4, 9]; A.castL = [-6, 0.4, 3];

  // ── the town: chance splits the households; the daily group lights ──
  if (isTown) TOWN.set({ split: shot === "town" ? u01(t, TW.split) : 1, glow: shot === "town" ? fadeIn(t, TW.glow, 0.6) : 0.4 });
  A.daily = [BIO.tx + daily.x, daily.h + 5, daily.z]; A.dis = [BIO.tx + dis.x, dis.h + 5, dis.z];

  // ── the UV camera: the damage the eye misses, more on the "as they pleased" half ──
  if (isU) {
    const d = shot === "uv1" ? u01(t, HD.dmg) : 1;   // a faint difference from the first frame, blooming on "camera"
    UVS.set({ damage: 0.18 + 0.07 * d, damageR: 0.35 + 0.55 * d, split: 1, glow: 1, opacity: fadeIn(t, SH[shot], 0.12) });
  }
  A.uvR = uvWorld(0.74, 0.45);
  const vw = shot === "uv1" ? P.viewfinder1 : P.viewfinder2;
  vf.set({ op: isU ? win(t, vw.t0, vw.t1, 0.25) : 0, left: "less damage", right: "more damage", blink: 0.6 + 0.4 * (Math.floor(t * 1.5) % 2) });

  // ── plates ──
  show(odds, shot === "cast" ? win(t, O.t0, O.t1) : 0);
  show(mel, shot === "town2" ? win(t, M.t0, M.t1) : 0);
  scc.style.opacity = fadeIn(t, M.scc - 0.2, 0.4).toFixed(3);
  d1.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d1.length) * (M.half - M.mel), 0.15).toFixed(3); });
  d2.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d2.length) * (M.half - M.mel), 0.15).toFixed(3); });
  msub.style.opacity = fadeIn(t, M.small - 0.2, 0.4).toFixed(3);
  rows.style.opacity = mhead.style.opacity = fadeIn(t, M.mel - 0.3, 0.3).toFixed(3);   // the rows arrive with "melanoma", never empty on screen

  // ── to scale: the test dose's film beside the paper ──
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: BIO.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  let step = 0;
  for (const s of FILM.shots.slice(1, -1)) step = Math.max(step, 1 - Math.min(1, Math.abs(t - s.at) / 0.1));
  const end = 0.75 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard));
  veil.style.opacity = Math.max(0.55 * step, end).toFixed(4);

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
