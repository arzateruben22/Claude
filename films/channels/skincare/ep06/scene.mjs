import * as THREE from "three";
// Outer Layer No. 006, "Same list as cigarettes" (films/channels/skincare/ep06), in the reboot's look (bible §2: the
// UV camera + macro flight). The picture as a pure function of t: window.seek(t) sets the shot, the camera, every
// object and the overlay from t alone, then makes exactly one renderer.render().
//
// Places: the skin under a bed (a macro flight over the terrain at golden hour, deep tone, a canopy of UVA tubes
// that light for the change; ../set/terrain.js), the same skin through the 365 nm camera (../set/uvcam.js: the bed's
// light goes out country by country), and a cut-face section where the long rays pass the top layer
// (../set/section.js, ../set/rays.js). The IARC list is a typeset plate. One tone (deep).
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { createUVSkin, createViewfinder, TONES } from "../set/uvcam.js";
import { createSection, createVessels } from "../set/section.js";
import { createRays } from "../set/rays.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, P = FILM.plates;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 2500);
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 8, threshold: 0.9, bloom: 0.32, exposure: 1.05 });
let focus = { point: [0, 0, 0], fstop: 0 };
window.CINEMA_FOCUS = () => focus;
injectCss();

scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2418, 0.6));
const sun = new THREE.DirectionalLight(0xffb870, 4.0); sun.position.set(30, 6, -30); scene.add(sun);
const key = new THREE.DirectionalLight(0xfff0e0, 1.0); key.position.set(-10, 14, 20); scene.add(key);
const secKey = new THREE.DirectionalLight(0xfff6ec, 1.6); secKey.position.set(BIO.sx - 120, 220, 160); secKey.target.position.set(BIO.sx, 0, 0); scene.add(secKey, secKey.target);
const FOG = new THREE.Fog(0x2c1660, 16, 52);   // the distance sinks into the ground colour

const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };
const DEEP = hexLin(TONES[2][0]).map((v) => v * 1.25);   // bible §1: 006 is the deep tone (lifted a little for the low sun)
const T = createTerrain({ size: 80, segs: 320, seed: 31, spots: 0 });
T.set({ tone: DEEP, furrows: 0.25, spot: 0, sheen: 0 });
scene.add(T.group);
// the bed's canopy: a row of UVA tubes above the skin (a model), lit for the change
const tubeMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: true });
const tubes = new THREE.Group();
for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 70, 16), tubeMat); m.rotation.x = Math.PI / 2; m.position.set(-16 + i * 4, 7.5, -4); tubes.add(m); }
scene.add(tubes);
const bedLight = new THREE.DirectionalLight(0x9c7bff, 0); bedLight.position.set(0, 20, 0); scene.add(bedLight);
const UVS = createUVSkin({ seed: 9.0 });
UVS.mesh.position.set(BIO.ux, 0, 0); UVS.mesh.rotation.x = -0.18; scene.add(UVS.mesh);
const SEC = createSection({ width: 180, depth: 60, rows: BIO.rows, sc: BIO.sc_um, gran: BIO.gran_um, spin: BIO.spin_um, basal: BIO.basal_um, seed: 61, x: BIO.sx, mortarFloor: 0 });
scene.add(SEC.group);
const VES = createVessels({ x: [-80, 80], ys: [-150, -170], z: 22, r: 2.6, ox: BIO.sx }); scene.add(VES.group);
const UVC = hexLin("#9C7BFF").map((v) => v * 1.3), HIT = hexLin("#C3A6FF").map((v) => v * 1.5);
const RAYS = createRays({ n: 70, x: [-80, 80], z: [6, 26], top: 120, seed: 66, width: 0.9, len: 14, depthIn: 70 });
RAYS.group.position.x = 0; scene.add(RAYS.group);
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
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.2, liftAt: [0.2, 0.2] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
{ const st = document.createElement("style"); st.textContent = ".ol-vf .rec,.ol-vf .hl,.ol-vf .hr{background:var(--hud-plate);padding:.5vmin 1.2vmin;border-radius:1vmin}"; document.head.appendChild(st); }   // the viewfinder's words on chips: ≥ 4.5:1 over the glowing skin
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.2, w: 0.8, h: 0.34 });
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "2.4vmin",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
// the list: IARC Group 1 (a short excerpt, typeset), two lines lit
const ROWS = ["Alcoholic beverages", "Asbestos", "Benzene", "Processed meat", "Solar radiation", "Tobacco smoking", "UV-emitting tanning devices", "X- and gamma-radiation"];
const LIT = { "Tobacco smoking": "lit2", "UV-emitting tanning devices": "lit" };
const listHtml = `<div style="font:700 3.2vmin/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase">IARC Group 1</div>
  <div style="font:500 2.5vmin/1.3 var(--font-mono);color:var(--text-2);margin:.8vmin 0 1.6vmin">carcinogenic to humans · excerpt</div>
  ${ROWS.map((r) => `<div class="row" data-k="${LIT[r] || ""}" style="font:600 3.2vmin/1.55 var(--font-body, inherit);color:var(--text-2);padding:0 1.2vmin;border-radius:1vmin">${r}</div>`).join("")}
  <div class="rank" style="font:600 3vmin/1.35 var(--font-body, inherit);margin-top:1.8vmin;color:var(--water);opacity:0">ranks how sure the evidence is,<br>not how big the harm</div>`;
const list = plate(listHtml, { left: "50%", top: `${0.17 * H}px`, transform: "translateX(-50%)", width: "70vmin", padding: "2.8vmin 3.4vmin" });
const list2 = plate(listHtml, { left: "50%", top: `${0.17 * H}px`, transform: "translateX(-50%)", width: "70vmin", padding: "2.8vmin 3.4vmin" });
const R = P.rr;
const rr = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.6vmin">first use before 35 · melanoma risk</div>
  <div style="display:grid;grid-template-columns:1fr auto;gap:1vmin 3vmin;font:600 3.2vmin/1.3 var(--font-body, inherit)">
  <span>pooled studies, 2007</span><b style="font:500 3.4vmin var(--font-mono);color:var(--water)">×${R.rr[1].toFixed(2)}</b>
  <span>pooled studies, 2012 (corrected)</span><b style="font:500 3.4vmin var(--font-mono);color:var(--water)">×${R.rr[0].toFixed(2)}</b></div>
  <div style="font:500 2.4vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:1.4vmin">relative risk · IARC 2007; Boniol et al., 2012</div>`,
  { left: "50%", top: `${0.53 * H}px`, transform: "translateX(-50%)", width: "80vmin", padding: "2.4vmin 3vmin" });
const BN = P.bans;
const bans = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.4vmin">commercial tanning beds banned</div>
  ${BN.bans.map(([c, y], i) => `<div class="bn" style="display:flex;justify-content:space-between;font:600 3.4vmin/1.5 var(--font-body, inherit);opacity:0"><span>${c}</span><b style="font:500 3.4vmin var(--font-mono);color:var(--water)">${y}</b></div>`).join("")}`,
  { left: "50%", top: `${0.565 * H}px`, transform: "translateX(-50%)", width: "64vmin", padding: "2.4vmin 3vmin" });
const bn = [...bans.querySelectorAll(".bn")];
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));
const litList = (el, t, L, final) => {
  for (const r of el.querySelectorAll(".row")) {
    const k = r.dataset.k, on = final ? 1 : k ? fadeIn(t, L[k], 0.4) : 0;
    r.style.color = on > 0.5 ? "var(--text)" : "var(--text-2)";
    r.style.background = `rgba(95, 242, 232, ${(0.16 * on).toFixed(3)})`; r.style.boxShadow = on > 0.01 ? `inset .5vmin 0 0 var(--water)` : "none";
  }
  el.querySelector(".rank").style.opacity = fadeIn(t, L.rank, 0.5).toFixed(3);
};

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  const P0 = rig.place(camera, shot, t);
  const fly = ["list", "bed", "list2"].includes(shot), isU = shot === "uv", isS = shot === "section";
  T.group.visible = fly; tubes.visible = shot === "bed"; UVS.mesh.visible = isU; SEC.group.visible = isS; VES.group.visible = isS; RAYS.group.visible = isS;
  scene.fog = fly ? FOG : null;
  focus = fly ? { point: P0.target, fstop: 0.5 } : { point: P0.target, fstop: 0 };

  // ── the bed: the tubes light violet, the skin under them takes the light ──
  const on = shot === "bed" ? u01(t, FILM.bed.on) : 0, gl = shot === "bed" ? u01(t, FILM.bed.glow) : 0;
  tubeMat.color.setRGB(...UVC.map((v) => v * (0.15 + 1.6 * on + 0.8 * gl)));
  bedLight.intensity = 3.5 * on + 2.5 * gl;
  sun.intensity = 4.0 * (1 - 0.6 * on); key.intensity = 1.0 * (1 - 0.4 * on);
  A.tube = [0, 7.5, 4];

  // ── the UV camera: under the bed's light the skin glows; the light goes out country by country ──
  if (isU) {
    const k = 1 - 0.35 * u01(t, FILM.uvd.brazil) - 0.5 * u01(t, FILM.uvd.off);
    UVS.set({ damage: 0.45, glow: 0.35 + 0.95 * k, opacity: fadeIn(t, SH.uv, 0.25) });
  }
  vf.set({ op: isU ? win(t, P.viewfinder.t0, P.viewfinder.t1, 0.25) : 0, left: "", right: "", blink: 0.6 + 0.4 * (Math.floor(t * 1.5) % 2) });
  show(bans, isU ? win(t, BN.t0, BN.t1) : 0);
  bn[0].style.opacity = fadeIn(t, BN.brazil - 0.2, 0.4).toFixed(3); bn[1].style.opacity = fadeIn(t, BN.australia - 0.2, 0.4).toFixed(3);

  // ── the section: the long rays pass the top layer into the dermis ──
  if (isS) {
    SEC.set({ tone: 0.9, dimDead: 0, dimLiving: 0.1, mortar: 0, glowDead: 0 });
    VES.set({ k: 1, opacity: 1 });
    RAYS.group.position.x = BIO.sx;
    RAYS.set(t, { filmTop: 0, filmBottom: -BIO.epi_um, pass: 0.75, gain: fadeIn(t, FILM.rays.on[0], 0.6), color: UVC, hitColor: HIT, rate: 0.5, depth: 70 });
  }
  A.epi = [BIO.sx - 60, -50, 30]; A.derm = [BIO.sx + 40, -BIO.epi_um - 40, 30];

  // ── plates ──
  show(list, shot === "list" ? win(t, P.list.t0, P.list.t1) : 0); litList(list, t, P.list, false);
  show(list2, shot === "list2" ? win(t, P.list2.t0, P.list2.t1) : 0); litList(list2, t, P.list2, true);
  show(rr, shot === "bed" ? win(t, R.t0, R.t1) : 0);

  // ── to scale: the top layer beside the paper ──
  const lift = isS ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: BIO.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  let step = 0;
  for (const s of FILM.shots.slice(1)) step = Math.max(step, 1 - Math.min(1, Math.abs(t - s.at) / 0.1));
  const end = 0.75 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard));
  veil.style.opacity = Math.max(0.55 * step, end).toFixed(4);

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
