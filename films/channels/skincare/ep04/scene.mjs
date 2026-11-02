import * as THREE from "three";
// Outer Layer No. 004, "The deadliest dose" (films/channels/skincare/ep04), in the reboot's look (bible §2: the UV
// camera + macro flight). The picture as a pure function of t for the film kit's page (kits/cinema/film):
// window.seek(t) sets the shot, the camera, every object and the overlay from t alone, then makes exactly one
// renderer.render().
//
// Places: the brow (a macro flight over the skin's terrain at golden hour, one frown crease: ../set/terrain.js), the
// junction under it (a cut face in the same warm light: nerve ending, messenger, muscle, toxin, new endings:
// ../set/junction04.js), and the same brow through the 365 nm camera (../set/uvcam.js) for the reveal. One tone
// (light) for the whole film. Everything timed comes from film.json, which compile.py hangs on the voice.
import { stage, seg, E } from "cinema/film/runtime.js";
import { createHud, project } from "cinema/sci/hud.js";
import { createRig } from "../set/rig.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { createUVSkin, createViewfinder, TONES } from "../set/uvcam.js";
import { createJunction } from "../set/junction04.js";

const FILM = window.FILM, W = window.W, H = window.H, BIO = FILM.bio, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, J = FILM.j, P = FILM.plates;
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

// ── light: the golden hour (a low warm sun behind and right for the rim, a cool sky fill, a soft key) ──
scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x3a2418, 0.6));
const sun = new THREE.DirectionalLight(0xffb870, 4.0); sun.position.set(30, 6, -30); scene.add(sun);
const key = new THREE.DirectionalLight(0xfff0e0, 1.0); key.position.set(-10, 14, 20); scene.add(key);
const FOG = new THREE.Fog(0x2c1660, 16, 52);   // the distance sinks into the ground colour (no band at the terrain's edge)   // the distance sinks toward the violet ground, so the title reads

// ── the set ──
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hexLin = (h) => { const x = h.replace("#", ""); return [0, 2, 4].map((i) => s2l(parseInt(x.slice(i, i + 2), 16) / 255)); };
const LIGHT = hexLin(TONES[0][0]).map((v) => v * 0.86);          // bible §1: 004 is drawn in the light tone
const T = createTerrain({ size: 80, segs: 320, seed: 11, spots: 0 });
T.set({ tone: LIGHT, furrows: 0.25, spot: 0, sheen: 0 });
// the frown crease: one deep furrow running away from the camera along x = 0 (a fixed shape, made once)
{
  const pos = T.mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), ax = Math.abs(x); pos.setY(i, pos.getY(i) - 2.2 * Math.exp(-(x * x) / (2 * 0.8 * 0.8)) + 1.6 * Math.exp(-((ax - 4.5) ** 2) / (2 * 2.6 * 2.6))); }   // two brow mounds, the crease between
  pos.needsUpdate = true; T.mesh.geometry.computeVertexNormals();
}
// eyebrows: dark hairs along the two brow mounds, leaning out from the crease (so the hook reads as a frown)
{
  const n = 2600, hg = new THREE.CylinderGeometry(0.02, 0.05, 1, 5, 1).translate(0, 0.5, 0);
  const brows = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ color: 0x4a2e1e, roughness: 0.5 }), n);
  const d = new THREE.Object3D(); let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, x = side * (2.6 + r() * 4.2), z = -34 + r() * 56;
    const ax = Math.abs(x), y = -2.2 * Math.exp(-(x * x) / 1.28) + 1.6 * Math.exp(-((ax - 4.5) ** 2) / 13.5) + 0.1;
    d.position.set(x, y - 0.05, z); d.rotation.set(-0.25 + r() * 0.2, 0, -side * (1.05 + r() * 0.25)); d.scale.set(1, 1.3 + r() * 0.9, 1); d.updateMatrix(); brows.setMatrixAt(i, d.matrix);
  }
  T.group.add(brows);
}
scene.add(T.group);
const JN = createJunction({ x: BIO.jx, tone: LIGHT });
scene.add(JN.group);
const UVS = createUVSkin({ seed: 4.0 });
UVS.mesh.position.set(BIO.ux, 0, 0); UVS.mesh.rotation.x = -0.18; scene.add(UVS.mesh);
// the same brow in UV: the crease down the middle and the two mounds, pressed into the photograph's dome
{
  const pos = UVS.mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), ax = Math.abs(x); pos.setZ(i, pos.getZ(i) - 0.32 * Math.exp(-(x * x) / (2 * 0.12 * 0.12)) + 0.22 * Math.exp(-((ax - 1.1) ** 2) / (2 * 0.6 * 0.6))); }
  pos.needsUpdate = true; UVS.mesh.geometry.computeVertexNormals();
}
// the frown dose's five points (a glabella pattern) on the UV brow: cyan, the brightest things in the reveal
const SITE_UV = [[0.5, 0.48], [0.4, 0.52], [0.6, 0.52], [0.31, 0.57], [0.69, 0.57]];   // a glabella pattern, low enough to clear the spine readout
const siteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...hexLin("#5FF2E8")).multiplyScalar(1.5), transparent: true, opacity: 0, depthTest: false, toneMapped: true });
const sites = SITE_UV.map(([u, v]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), siteMat); const p = UVS.at(u, v); m.position.set(p[0], p[1], p[2] + 0.05); m.renderOrder = 6; UVS.mesh.add(m); return m; });

const rig = createRig(FILM.cam);

// ── the overlay ─────────────────────────────────────────────────────────────
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
endEl.style.transform = "translateY(-22vmin)";                              // the card sits above the tease's caption plate
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.25, liftAt: [0.18, 0.33] });   // under the spine readout, clear of it
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
{ const st = document.createElement("style"); st.textContent = ".ol-vf .rec,.ol-vf .hl,.ol-vf .hr{background:var(--hud-plate);padding:.5vmin 1.2vmin;border-radius:1vmin}.ol-vf .rec{top:auto!important;bottom:1.6vmin!important}";   /* REC at the bottom: the spine readout owns the top right */ document.head.appendChild(st); }   // the viewfinder's words on chips: ≥ 4.5:1 over the glowing skin
const vfH = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.24, w: 0.8, h: 0.34 });   // the hook's, larger: the brow fills it
const vf = createViewfinder({ root: hudRoot, W, H, x: 0.1, y: 0.255, w: 0.8, h: 0.19 });
// plates: violet cards in the theme's tokens (text on them ≥ 4.5:1)
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "2.4vmin",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
const K = P.kerner;
const kerner = plate(`<div style="font:700 4.2vmin/1.1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase">${K.name}</div>
  <div style="font:500 3vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:.8vmin">${K.role}</div>
  <div style="font:600 3.9vmin/1.3 var(--font-body, inherit);margin-top:2.2vmin">${K.line1.replace("“sausage poison”", "<span class=\"sp\">“sausage poison”</span>")}</div>
  <div class="k2" style="font:600 3.9vmin/1.3 var(--font-body, inherit);margin-top:1.2vmin;color:var(--water)">${K.line2}</div>`,
  { left: "50%", top: `${0.27 * H}px`, transform: "translateX(-50%)", width: "72vmin", padding: "3.4vmin 4vmin", textAlign: "left" });
const k2 = kerner.querySelector(".k2"), sp = kerner.querySelector(".sp");
const D = P.dose, frac = D.frown_u / D.lethal_u;
const dose = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1vmin">units of toxin</div>
  <div style="font:500 2.7vmin/1.35 var(--font-mono);color:var(--text-2);margin-bottom:1.8vmin">estimate, 70 kg adult · units differ by product<br>side effects can occur far below this</div>
  <div class="r1" style="display:grid;grid-template-columns:27vmin 1fr;align-items:center;gap:2vmin;font:600 3.1vmin/1.2 var(--font-body, inherit)"><span>one frown</span><span style="display:flex;align-items:center;gap:1.4vmin"><i class="b1" style="display:block;height:3.2vmin;width:0;background:var(--water);border-radius:.4vmin"></i><b style="font:500 3.1vmin var(--font-mono);color:var(--water)">${D.frown_u}</b></span></div>
  <div class="r2" style="display:grid;grid-template-columns:27vmin 1fr;align-items:center;gap:2vmin;margin-top:1.8vmin;font:600 3.1vmin/1.2 var(--font-body, inherit)"><span>estimated lethal</span><span style="display:flex;align-items:center;gap:1.4vmin"><i class="b2" style="display:block;height:3.2vmin;width:0;background:var(--uv);border-radius:.4vmin"></i><b style="font:500 3.1vmin var(--font-mono);white-space:nowrap">≈ 3,000</b></span></div>
  `,
  { left: "50%", top: `${0.45 * H}px`, transform: "translateX(-50%)", width: "84vmin", padding: "2.4vmin 3vmin" });
const b1 = dose.querySelector(".b1"), b2 = dose.querySelector(".b2"), r1 = dose.querySelector(".r1"), r2 = dose.querySelector(".r2");
const BAR = 34;   // vmin: the lethal amount's full bar; the frown's is the same scale (a sliver)
// a veil in the ground's colour: a three-frame step at the hard scale jumps, and the fade before the end card
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d));
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at]));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  const P0 = rig.place(camera, shot, t);
  const fly = ["brow", "rise", "close"].includes(shot), isJ = ["below", "below2", "gauge"].includes(shot), isU = shot === "uv" || shot === "uvhook";
  T.group.visible = fly; JN.group.visible = isJ; UVS.mesh.visible = isU;
  scene.fog = fly ? FOG : null;
  T.group.scale.y = shot === "brow" ? 0.55 + 0.45 * E.inout2(seg(t, SH.brow, SH.brow + 1.0)) : shot === "close" ? 0.55 + 0.45 * E.inout2(seg(t, SH.close, SH.close + 1.0)) : 1;   // the frown sets (on "frown"; and again as the message returns)
  focus = fly ? { point: P0.target, fstop: 0.3 } : { point: P0.target, fstop: 0 };

  // ── the junction: the message crosses and the muscle pulls; the toxin cuts; the message stays; new endings ──
  if (isJ) {
    JN.set({
      pull: shot === "below" ? u01(t, J.pull) : u01(t, J.sprout),   // the new endings work the muscle again: the crease returns   // after the cut the muscle stays slack; the new endings bring the crease back
      puff: shot === "below" && t < J.cut[0] ? seg(t, J.puff[0], J.puff[1]) : shot === "gauge" ? seg(t, J.relight[0], J.relight[1]) : 0,   // the original ending sends its message again (c13)
      open: shot === "below" ? u01(t, J.open) : shot === "below2" ? 1 : 0,   // below2: still open, so the held vesicles show
      toxin: shot === "below" ? u01(t, J.toxin) : 1,
      cut: shot === "below" ? u01(t, J.cut) : 1,
      sprout: shot === "gauge" ? u01(t, J.sprout) : 0,
      bump: shot === "below" ? Math.abs(Math.sin(Math.PI * 2 * seg(t, J.bump[0], J.bump[1]))) * (t < J.bump[1] ? 1 : 0) : shot === "below2" ? Math.abs(Math.sin(Math.PI * 3 * seg(t, J.bump2[0], J.bump2[1]))) * (t < J.bump2[1] ? 1 : 0) : 0,   // the vesicles press at the membrane and fall back: ready, never released
      dim: shot === "gauge" ? 0.5 * (1 - u01(t, J.sprout)) : 0,
    });
  }
  if (isU) { const p = new THREE.Vector3(...UVS.at(0.5, 0.62)); UVS.mesh.updateMatrixWorld(); A.uvbrow = UVS.mesh.localToWorld(p).toArray(); }
  A.bulb = JN.at.bulb(); A.gap = JN.at.gap(); A.crease = JN.at.crease(); A.snap = JN.at.snap(); A.tox = JN.at.tox(); A.sprout = JN.at.sprout();

  // ── the reveal: the brow in UV; the five points of a frown dose light; the daylight strip, then the dose plate ──
  if (isU) {
    UVS.set({ damage: 0.25, glow: 1, opacity: shot === "uv" ? fadeIn(t, SH.uv, 0.12) : 1 });
    siteMat.opacity = (shot === "uvhook" ? 0.6 + 0.4 * fadeIn(t, 0.2, 0.6) : fadeIn(t, P.viewfinder.sites, 0.5)) * (0.85 + 0.15 * Math.sin(t * 3));   // the hook: the points already flaring
  }
  const vw = shot === "uvhook" ? P.vfhook : P.viewfinder;
  vfH.set({ op: shot === "uvhook" ? 1 - fadeIn(t, vw.t1 - 0.2, 0.2) : 0, left: "model, not a photo", right: "", blink: 0.6 + 0.4 * (Math.floor(t * 1.5) % 2) });
  vf.set({ op: shot === "uv" ? win(t, vw.t0, vw.t1, 0.25) : 0, left: "", right: "", blink: 0.6 + 0.4 * (Math.floor(t * 1.5) % 2) });
  const dOp = isU ? win(t, D.t0, D.t1) : 0;
  show(dose, dOp);
  b1.style.width = `${Math.max(0.35, BAR * frac * fadeIn(t, D.frown, 0.4)).toFixed(3)}vmin`;   // a sliver (drawn ≥ 0.35 vmin so it shows at all)
  b2.style.width = `${(BAR * E.out3(seg(t, D.kill - 0.1, D.kill + 1.2))).toFixed(3)}vmin`;
  r1.style.opacity = fadeIn(t, D.frown - 0.2, 0.3).toFixed(3); r2.style.opacity = fadeIn(t, D.kill - 0.2, 0.3).toFixed(3);

  // ── Kerner ──
  show(kerner, shot === "rise" || shot === "below2" ? win(t, K.t0, K.t1, 0.4) : 0);
  k2.style.opacity = fadeIn(t, K.guessed, 0.5).toFixed(3);
  if (sp) sp.style.color = t >= K.sausages ? "var(--water)" : "inherit";   // the turn word lights its words

  // ── the gauge: lifted only (the junction is schematic, so no attached ruler): the gap a hairline beside the paper ──
  const lift = shot === "gauge" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: BIO.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  // ── the veil: three frames of the ground on each scale jump; the scene fades toward the ground before the end card ──
  let step = 0;
  for (const c of [SH.brow, SH.below, SH.rise, SH.below2, SH.uv, SH.gauge]) step = Math.max(step, 1 - Math.min(1, Math.abs(t - c) / 0.1));
  const end = 0.6 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard));   // the hook's brow stays readable behind the card (the loop)
  veil.style.opacity = Math.max(0.55 * step, end).toFixed(4);

  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
