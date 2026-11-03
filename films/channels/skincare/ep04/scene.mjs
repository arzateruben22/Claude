import * as THREE from "three";
// Skin Sense No. 004, "The deadliest dose" (films/channels/skincare/ep04), in the approved look (look test 2, 2 Nov):
// four hero shots, one subject filling the frame and one slow move each; studio light (../set/studio.js), real
// reference maps (../set/ref), particles, dust in a shaft, haze between depth layers, shallow depth of field.
//   brow  the frown as a skin macro: ../set/brow04.js restyled with skinMaterial (light tone, bible §1); the hook,
//         the crease setting, Kerner's slack brow, the close (the loop)
//   nmj   the neuromuscular junction at cell scale (../set/nmj04.js): the nerve ending, its cyan messenger, the
//         fibre's pull; the toxin slipping in and the docking protein cut; the cleft under the gauge; spare endings
//   cut   the stained micrograph cut face below the skin (public domain), on "never touches the skin"
//   dose  the brow; the UV scan sweeps down on "twenty" (the signature switch); the dose plate, 20 against ≈ 3,000
// The picture is a pure function of t: window.seek(t) sets everything from t and film.json, then renders once.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, createShaft, createGrain } from "../set/studio.js";
import { createBrow } from "../set/brow04.js";
import { createNMJ } from "../set/nmj04.js";
import { SECTION, DERMIS } from "../set/ref/textures.js";
import { lookV2, richen } from "../set/prod.js";
import { unifyHud } from "../set/hudv2.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, J = FILM.j, BW = FILM.brow, P = FILM.plates;
const S1 = Math.min(W, H) / 1080;
const SH = Object.fromEntries(FILM.shots.map((s) => [s.name, s.at])), NX = FILM.next;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.9, bloom: 0.3, exposure: 1.0, maxCoc: 0.035 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 2000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
injectCss();
const R = rng(4);
const XJ = 500, XC = 1000;                                      // the places: the brow at x = 0, the junction, the cut face
const load = (uri, srgb = true) => new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = uri; });

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) and haze cards ──
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const particles = (n, box, size, color, k = 0.7) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: k, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
  return { set(t, op = 1, drift = 1) { p.visible = op > 0.002; if (!p.visible) return; m.opacity = k * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + drift * 0.25 * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + drift * 0.3 * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + drift * 0.2 * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};
const haze = (w, h, pos, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false })); m.position.set(...pos); scene.add(m); return m; };
const glowSprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(color), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); s.scale.set(size, size, 1); s.renderOrder = 9; scene.add(s); return s; };

// ── the brow: a frontal skin macro in studio light (light tone) ──
const TONE = toneColor("living", 0.12).map((v, i) => v * [1.0, 0.92, 0.86][i]);   // light, a touch warmer under the studio key
const BR = createBrow({ x: 0, tone: TONE, segs: [560, 480], hairN: 1500, hairW: 0.014 });
const browSkin = skinMaterial({ tone: TONE, oil: 0.3, hydration: 0.45, micro: 0.9, seed: 4, repeat: 5 });
// a gentle mottle (light skin's uneven redness and its paler patches), a colour map made once
browSkin.map = (() => { const c = document.createElement("canvas"); c.width = c.height = 512; const k = c.getContext("2d"); k.fillStyle = "#fff"; k.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { const x = R() * 512, y = R() * 512, r = 6 + R() * 40, g = k.createRadialGradient(x, y, 0, x, y, r), red = R() > 0.45;
    g.addColorStop(0, red ? "rgba(236,170,160,.22)" : "rgba(255,246,236,.25)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; })();
const browBase = browSkin.color.clone();
BR.group.children[0].material = browSkin;
const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2f1e, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
BR.group.children[1].material = hairMat;
BR.group.scale.z = 1.7;   // the relief deepened for the macro (the ridges, the lines and the hairs together)
scene.add(BR.group);
const shaftBrow = createShaft({ from: [-12, 18, 10], to: [3, -4, 2], radius: 2.4, color: "#FFE6D2" }); scene.add(shaftBrow.group);
const dustBrow = particles(220, [[-7, -5, 2.5], [7, 6, 14]], 0.035, "#FFF1F8", 0.55);
const doseGlow = glowSprite("#5FF2E8", 1.5); doseGlow.position.set(0, 0.75, 0.9);      // the dose under UV: one faint cyan glow (an illustration)
const UVSKIN = new THREE.Color(0.4, 0.3, 0.78), UVHAIR = new THREE.Color(0.06, 0.03, 0.14), HAIR = hairMat.color.clone();

// ── the junction at cell scale ──
const N = createNMJ({ x: XJ });
richen(N.group, { seed: 4, jitter: 0.1, hue: 0.05, micro: 0.5 });   // no two parts identical; a micro normal on the membrane and the fibre
scene.add(N.group);
const hzJ1 = haze(260, 160, [XJ, 0, -46], "#2C1660", 0.55), hzJ2 = haze(200, 120, [XJ, 0, -22], "#3A2178", 0.22);
const shaftJ = createShaft({ from: [XJ - 16, 26, -6], to: [XJ + 3, -3, 1], radius: 4, color: "#B79BFF" }); scene.add(shaftJ.group);
const dustJ = particles(380, [[XJ - 16, -6, -8], [XJ + 16, 14, 16]], 0.1, "#E9DEFF");

// ── the cut face: the stained micrograph under the skin's surface (as look test 2's dermis) ──
const C = new THREE.Group(); C.position.x = XC; scene.add(C);
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), faceMat); face.position.set(0, -5.25, 0); C.add(face);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.78, 0.5, 0.55), roughness: 0.55 });
const block = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 6), [sideMat, sideMat, skinMaterial({ tone: TONE.map((v) => v * 1.05), oil: 0.1, repeat: 3, seed: 9, micro: 0.5 }), sideMat, sideMat, sideMat]);
block.position.set(0, -5.25, -3.01); C.add(block);
const backC = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ color: 0x9a86c8, transparent: true, opacity: 0.35 })); backC.position.set(XC, -6, -14); scene.add(backC);
const shaftC = createShaft({ from: [XC - 6, 18, -4], to: [XC + 1, -6, 1], radius: 2.8, color: "#C9B4FF" }); scene.add(shaftC.group);
const dustC = particles(300, [[XC - 9, -11, 0.5], [XC + 9, 6, 9]], 0.07, "#FFF2F8");

window.SCENE_READY = Promise.all([load(SECTION), load(DERMIS)]).then(([sec, der]) => {
  sec.repeat.set(1, 1); sec.wrapS = sec.wrapT = THREE.ClampToEdgeWrapping; faceMat.map = sec; faceMat.needsUpdate = true;   // one copy, no tile seams
  backC.material.map = der; backC.material.needsUpdate = true;
});

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const hud = createHud({ camera, shots: FILM.shots });
unifyHud(hudRoot);   // one HUD system: one plate, one radius, a bar not a dot; mono sources, sans labels
const KIND = { cell: { color: "text", glyph: "●", mark: "none" }, water: { color: "water", glyph: "◇", mark: "none" }, uv: { color: "uv", glyph: "◆", mark: "none" } };
const A = {};
hud.captions(FILM.captions, { fade: 0.05 });
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: k.mark, color: k.color, at: () => A[L.anchor] || [0, 0, 0], t0: L.t0, t1: L.t1, shot: L.shot, side: L.side, v: L.v, fixed: L.fixed });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";                              // the card sits above the tease's caption plate
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.25, liftAt: [0.47, 0.3] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
const look2 = lookV2({ canvas, hudRoot, skin: browSkin });   // the channel look (stage 1): the brow's skin upgraded, the graded backdrop, one grade
const grain = createGrain(hudRoot, { amount: 0.007 });
// the UV switch: a cyan line sweeping down the frame (DOM), as in look test 2
const scan = document.createElement("div");
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#5FF2E8", boxShadow: "0 0 18px 4px rgba(95,242,232,.55)", opacity: "0", zIndex: 2, pointerEvents: "none" });
hudRoot.appendChild(scan);
// plates: violet cards in the theme's tokens (text on them ≥ 4.5:1)
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "var(--ol-r, 2.4vmin)",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
const K = P.kerner;
const kerner = plate(`<div style="font:700 4.2vmin/1.1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase">${K.name}</div>
  <div style="font:500 3vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:.8vmin">${K.role}</div>
  <div style="font:600 3.9vmin/1.3 var(--font-body, inherit);margin-top:2.2vmin">${K.line1.replace("“sausage poison”", "<span class=\"sp\">“sausage poison”</span>")}</div>
  <div class="k2" style="font:600 3.9vmin/1.3 var(--font-body, inherit);margin-top:1.2vmin;color:var(--water)">${K.line2}</div>`,
  { left: "50%", top: `${0.25 * H}px`, transform: "translateX(-50%)", width: "72vmin", padding: "3.4vmin 4vmin", textAlign: "left" });
const k2 = kerner.querySelector(".k2"), sp = kerner.querySelector(".sp");
const D = P.dose, frac = D.frown_u / D.lethal_u;
const dose = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1vmin">units of toxin</div>
  <div style="font:500 2.7vmin/1.35 var(--font-mono);color:var(--text-2);margin-bottom:1.8vmin">estimate, 70 kg adult · units differ by product<br>side effects can occur far below this</div>
  <div class="r1" style="display:grid;grid-template-columns:27vmin 1fr;align-items:center;gap:2vmin;font:600 3.1vmin/1.2 var(--font-body, inherit)"><span>one frown</span><span style="display:flex;align-items:center;gap:1.4vmin"><i class="b1" style="display:block;height:3.2vmin;width:0;background:var(--water);border-radius:.4vmin"></i><b style="font:500 3.1vmin var(--font-mono);color:var(--water);white-space:nowrap">${D.frown_u} units</b></span></div>
  <div class="r2" style="display:grid;grid-template-columns:27vmin 1fr;align-items:center;gap:2vmin;margin-top:1.8vmin;font:600 3.1vmin/1.2 var(--font-body, inherit)"><span>estimated lethal (70 kg)</span><span style="display:flex;align-items:center;gap:1.4vmin"><i class="b2" style="display:block;height:3.2vmin;width:0;background:var(--uv);border-radius:.4vmin"></i><b style="font:500 3.1vmin var(--font-mono);white-space:nowrap">≈ ${D.lethal_u.toLocaleString("en-US")}</b></span></div>`,
  { left: "50%", top: `${0.42 * H}px`, transform: "translateX(-50%)", width: "84vmin", padding: "2.4vmin 3vmin" });
const b1 = dose.querySelector(".b1"), b2 = dose.querySelector(".b2"), r1 = dose.querySelector(".r1"), r2 = dose.querySelector(".r2");
const BAR = 30;   // vmin: the lethal amount's full bar; the frown's is on the same scale (a sliver)
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); };
const span = (t, shot) => E.inout2(seg(t, SH[shot], NX[shot]));     // one slow move across the whole shot
const jx = (p) => [XJ + p[0], p[1], p[2]];
const uvNow = (t, shot) => (shot === "dose" ? u01(t, [FILM.scan.sweep[0] + 0.1, FILM.scan.sweep[1]]) : 0);

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name;
  const isB = ["brow", "brow2", "kerner", "dose", "close"].includes(shot), isJ = ["nmj", "nmj2", "nmj3", "gap", "regrow"].includes(shot), isC = shot === "cut";
  BR.group.visible = isB; N.group.visible = isJ; C.visible = isC; backC.visible = isC; hzJ1.visible = hzJ2.visible = isJ;
  shaftBrow.set({ op: isB ? 0.35 * (1 - uvNow(t, shot)) : 0 }); shaftJ.set({ op: isJ ? 0.8 : 0 }); shaftC.set({ op: isC ? 1 : 0 });
  dustBrow.set(t, isB ? 1 : 0); dustJ.set(t, isJ ? 1 : 0); dustC.set(t, isC ? 1 : 0);
  let uv = 0;

  // ── the brow ──
  if (isB) {
    const u = span(t, shot);
    let frown = 1, pos, tgt, fp;
    if (shot === "brow") { frown = 0.15 + 0.85 * u01(t, BW.frown); pos = mix3([5.6, -3.6, 17], [1.9, -1.0, 6.6], u); tgt = mix3([0, 1.0, 0], [0, 0.7, 0], u); }   // one slow push, low and from the right, into the "11"
    else if (shot === "brow2") { frown = 0.3 + 0.7 * u01(t, BW.fold); pos = mix3([2.4, -0.9, 6.0], [1.6, -0.4, 4.9], u); tgt = [0, 0.75, 0]; }   // the crease setting, close
    else if (shot === "kerner") { frown = 1 - 0.9 * u01(t, BW.slack); pos = mix3([0, -1.2, 15], [0, -2.0, 23], u); tgt = mix3([0, 0.2, 0], [0, 0.9, 0], u); }   // a slow pull back under the plate; the frown goes slack on "paralysis"
    else if (shot === "dose") { frown = 0.9; pos = mix3([1.2, -2.6, 21], [0.6, -2.2, 16], u); tgt = mix3([0, -1.9, 0], [0, -1.3, 0], u); uv = uvNow(t, shot); }   // the glabella high in the frame, the plate under it
    else { frown = 0.15 + 0.85 * u01(t, BW.close); pos = mix3([5.6, -3.6, 17], [6.0, -3.8, 18.5], u); tgt = [0, 1.0, 0]; }   // the close: frame 0's composition (the loop)
    BR.set({ frown });
    look(pos, tgt);
    studio.aim([0, 0.7, 0], [-0.85, 0.42, 0.42], [0.9, 0.15, 0.3]); studio.set({ key: 2.8 * (1 - 0.5 * uv), rim: 1.6, fill: 0.22, env: 0.35, warm: 0.6 * (1 - uv) });   // a raking key from the left: the lines read as grooves
    browSkin.color.copy(browBase).lerp(UVSKIN, uv); browSkin.emissive.setRGB(0.03 * uv, 0.02 * uv, 0.1 * uv); hairMat.color.copy(HAIR).lerp(UVHAIR, uv);
    browSkin.sheenColor.setRGB(1 - 0.3 * uv, 0.72 - 0.06 * uv, 0.62 + 0.36 * uv);   // from lookV2's warm edge sheen toward UV lilac
    doseGlow.material.opacity = 0.75 * uv * (0.85 + 0.15 * Math.sin(t * 3));
    focusPt = [0, 0.75, 0]; fstop = shot === "brow2" ? 0.26 : 0.2;
  } else doseGlow.material.opacity = 0;
  const sw = seg(t, FILM.scan.sweep[0], FILM.scan.sweep[1]); scan.style.top = `${(sw * H).toFixed(1)}px`; scan.style.opacity = shot === "dose" && sw > 0 && sw < 1 ? "1" : "0";

  // ── the junction ──
  if (isJ) {
    const u = span(t, shot);
    let st = { t, pull: 0, puff: 0, toxin: 1, cut: 1, bump: 0, sprout: 0, prune: 0, dim: 0 };
    let pos, tgt, rack = null;
    if (shot === "nmj") {
      st = { ...st, toxin: 0, cut: 0, puff: seg(t, J.puff[0], J.puff[1]), pull: u01(t, J.pull) };
      pos = mix3([-15, 13, 42], [-4, 6.5, 25], u); tgt = mix3([-4, 3, 0], [1, 1.5, 0], u);   // in along the nerve to its ending
      focusPt = jx([1, 1.5, 0]); fstop = 0.2;
    } else if (shot === "nmj2") {
      st = { ...st, toxin: u01(t, J.toxin), cut: u01(t, J.cut), bump: Math.abs(Math.sin(Math.PI * 2 * seg(t, J.bump[0], J.bump[1]))) * (t < J.bump[1] ? 1 : 0) };
      pos = mix3([-4, 5.5, 17], [1.6, 3.0, 12], u); tgt = mix3([0, 1.9, 0], [1.2, 1.1, 0], u);   // a slow push down into the ending, to the docking proteins
      rack = mix3([-2, 4, 2], [1.2, 0.6, 0.3], u01(t, [J.toxin[0], J.cut[0] + 0.3])); focusPt = jx(rack); fstop = 0.26;
    } else if (shot === "nmj3") {
      st = { ...st, bump: Math.abs(Math.sin(Math.PI * 3 * seg(t, J.bump2[0], J.bump2[1]))) * (t < J.bump2[1] ? 1 : 0) };
      pos = mix3([7, 4.6, 21], [4, 4, 17.5], u); tgt = [1, 1.4, 0];                         // the silenced ending, a slow drift
      focusPt = jx([1, 1.2, 0.3]); fstop = 0.22;
    } else if (shot === "gap") {
      st = { ...st, dim: 0.4 };
      pos = mix3([-1, 1.6, 17], [0.8, 1.0, 12], u); tgt = mix3([1, 0.9, 0], [1.2, 0.5, 0], u);   // low, into the cleft under the lifted gauge
      focusPt = jx([1.2, 0.3, 1]); fstop = 0.22;
    } else {
      const prune = u01(t, J.prune);
      st = { ...st, sprout: u01(t, J.sprout), prune, cut: 1 - prune, toxin: 1 - prune, puff: seg(t, J.puff2[0], J.puff2[1]) };
      pos = mix3([3, 15, 40], [2, 11, 33], u); tgt = mix3([1, 2.0, 0], [1, 2.2, 0], u);   // the ending under the readout, clear of the captions      // the ending and its spare endings along the fibre
      focusPt = jx([1, 0.8, 0]); fstop = 0.18;
    }
    N.set(st);
    look(jx(pos), jx(tgt));
    studio.aim(jx([1, 1, 0]), [-0.5, 0.8, 0.55], [0.6, 0.4, -0.8]); studio.set({ key: 1.3, rim: 3.0, fill: 0.4, env: 0.7, warm: 0.0 });
    A.bulb = N.at.bulb(); A.gap = N.at.gap(); A.snap = N.at.snap();
  }

  // ── the cut face ──
  if (isC) {
    const u = span(t, "cut");
    look(mix3([XC - 2, 0.2, 15], [XC + 0.6, -4.2, 10.5], u), mix3([XC - 1, -2.4, 0], [XC + 0.8, -6.4, 0], u));   // a slow push down past the skin's layers
    studio.aim([XC, -4, 0], [-0.45, 0.8, 0.55], [0.55, 0.35, -0.85]); studio.set({ key: 1.6, rim: 2.6, fill: 0.45, env: 0.5, warm: 0.2 });
    focusPt = mix3([XC - 1, -2.4, 0], [XC + 0.8, -6.2, 0], u); fstop = 0.1;
  }

  // ── plates ──
  show(kerner, shot === "kerner" || shot === "nmj3" ? win(t, K.t0, K.t1, 0.4) : 0);
  k2.style.opacity = fadeIn(t, K.guessed, 0.5).toFixed(3);
  if (sp) sp.style.color = t >= K.sausages ? "var(--water)" : "inherit";
  show(dose, shot === "dose" ? win(t, D.t0, D.t1) : 0);
  b1.style.width = `${Math.max(0.35, BAR * frac * fadeIn(t, D.frown, 0.4)).toFixed(3)}vmin`;   // a sliver (drawn ≥ 0.35 vmin so it shows at all)
  b2.style.width = `${(BAR * E.out3(seg(t, D.kill - 0.1, D.kill + 1.2))).toFixed(3)}vmin`;
  r1.style.opacity = fadeIn(t, D.frown - 0.2, 0.3).toFixed(3); r2.style.opacity = fadeIn(t, D.kill - 0.2, 0.3).toFixed(3);

  // ── the gauge, lifted: the gap a hairline beside the paper ──
  const lift = shot === "gap" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: G.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  // ── the veil: three frames of the ground on each scale jump; the scene sinks back under the end card ──
  let step = 0;
  for (const c of [SH.nmj, SH.cut, SH.nmj2, SH.gap]) step = Math.max(step, 1 - Math.min(1, Math.abs(t - c) / 0.1));
  const end = 0.6 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard));
  veil.style.opacity = Math.max(0.55 * step, end).toFixed(4);

  grain.set(t);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
