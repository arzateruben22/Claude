import * as THREE from "three";
// Skin Sense No. 006, "Same list as cigarettes" (films/channels/skincare/ep06), rebuilt in the approved look (look
// test 2, 2 Nov): four hero shots, one subject filling the frame, one slow move each, dust in light shafts, haze,
// shallow depth of field. The picture is a pure function of t: window.seek(t) sets the shot, the camera, every object
// and the overlay from t alone, then makes exactly one renderer.render(). One skin tone: deep.
//   list     the IARC Group 1 excerpt as an engraved slate plate in violet haze; its rows light in cyan (x = 0)
//   bed      deep-tone skin under a canopy of UVA tubes glowing violet, a shaft of dust (x = 500)
//   uv       the same skin through the UV camera (the cyan scan line): its two banks of tubes switch off (x = 500)
//   section  a block of skin cut open, its face a stained tissue photo; UVA dashes pass the top layer (x = 1000)
//   list2    the plate again: the sun's row lights, dated first
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { createStudio, skinMaterial, createShaft, createGrain } from "../set/studio.js";
import { SECTION } from "../set/ref/textures.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, CUT = FILM.cut, G = FILM.gauge, PL = FILM.plate;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, threshold: 0.9, bloom: 0.3, exposure: 1.0, maxCoc: 0.035 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 2000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
const R = rng(6);
injectCss();
const DEEP = [0.16, 0.085, 0.05];   // bible: 006 is the deep tone, the only tone in the film
const XB = 500, XC = 1000;

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) and haze cards ──
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const particles = (n, box, size, color, drift = 1) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); scene.add(p);
  return { p, set(t, op = 1) { p.visible = op > 0.002; if (!p.visible) return; m.opacity = 0.7 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.25 * drift * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + 0.08 * drift * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + 0.2 * drift * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};
const haze = (w, h, pos, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false })); m.position.set(...pos); scene.add(m); return m; };

// ── 1: the list, an engraved slate plate (typeset; an excerpt of IARC Group 1) ──
const PW = 5.0, PH = 3.5, CW = 2048, CH = Math.round(CW * PH / PW);
const ROWS = [["Alcoholic beverages", ""], ["Asbestos", ""], ["Processed meat (eating)", "meat"], ["Solar radiation", "sun"], ["Tobacco smoking", ""], ["UV-emitting tanning devices", "beds"], ["X- and gamma-radiation", ""]];
const ROW_Y = (i) => 430 + i * 118, RANK_Y = 1310;
const YEAR = { meat: PL.years.meat, sun: PL.years.sun, beds: PL.years.beds };
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.28, sheen: 0.25, sheenColor: new THREE.Color(0.7, 0.6, 1.0) });
const edgeMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.06, 0.035, 0.12), roughness: 0.35, clearcoat: 0.6 });
const plate = new THREE.Group(); scene.add(plate);
const slab = new THREE.Mesh(new THREE.BoxGeometry(PW, PH, 0.14), [edgeMat, edgeMat, edgeMat, edgeMat, plateMat, edgeMat]); plate.add(slab);
plate.rotation.set(-0.05, 0.12, 0.0);
const overlay = (z = 0.072) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(0.86, 0.86, 0.86) });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), m); o.position.z = z; plate.add(o); return m; };
const LIT = { tobacco: overlay(), beds: overlay(), meat: overlay(), sun: overlay(), rank: overlay(0.073) };
const hzL1 = haze(60, 40, [0, 0, -9], "#2C1660", 0.42), hzL2 = haze(60, 40, [0, 0, -4], "#3A2178", 0.16);
const farTubes = new THREE.Group(); scene.add(farTubes);   // the bed's light, far behind and out of focus
const glowTex = (() => { const c = document.createElement("canvas"); c.width = 8; c.height = 128; const k = c.getContext("2d"); const g = k.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); })();
const farMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color("#9C7BFF").multiplyScalar(0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 2.4), farMat); m.position.set(0, -3 + i * 3.4, -20); m.rotation.z = 0.06; farTubes.add(m); }
const shaftL = createShaft({ from: [-9, 14, 3], to: [3, -5, -1], radius: 2.2, color: "#C9B4FF" }); scene.add(shaftL.group);
const dustL = particles(300, [[-7, -5, -3], [7, 6, 12]], 0.05, "#F3E9FF");

const drawPlate = () => {
  const c = document.createElement("canvas"); c.width = CW; c.height = CH; const k = c.getContext("2d");
  const bump = document.createElement("canvas"); bump.width = CW; bump.height = CH; const b = bump.getContext("2d");
  const g = k.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, "#2E2050"); g.addColorStop(1, "#1E1438"); k.fillStyle = g; k.fillRect(0, 0, CW, CH);
  const RS = rng(4); for (let i = 0; i < 9000; i++) { k.fillStyle = `rgba(${RS() < 0.5 ? "255,255,255" : "0,0,0"},${(0.02 + 0.04 * RS()).toFixed(3)})`; k.fillRect(RS() * CW, RS() * CH, 2 + RS() * 3, 2 + RS() * 3); }   // the slate's tooth
  b.fillStyle = "#fff"; b.fillRect(0, 0, CW, CH);
  const ink = (draw) => { k.save(); k.fillStyle = "rgba(0,0,0,.55)"; k.translate(0, -3); draw(k, "fill"); k.restore(); k.save(); k.fillStyle = "#C4B5E6"; draw(k, "fill"); k.restore(); b.save(); b.fillStyle = "#000"; draw(b, "fill"); b.restore(); };   // engraved: a shadow on the upper lip, the paint fill, a recess in the bump map
  const text = (s, x, y, font, align = "left") => ink((ctx) => { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y); });
  const rule = (y, w = 4) => ink((ctx) => ctx.fillRect(110, y, CW - 220, w));
  k.strokeStyle = "rgba(196,181,230,.5)"; k.lineWidth = 5; k.strokeRect(46, 46, CW - 92, CH - 92);
  text("IARC MONOGRAPHS", 120, 185, "700 76px 'Red Hat Mono'"); text("GROUP 1", CW - 120, 185, "700 96px 'Red Hat Mono'", "right");
  text("carcinogenic to humans · an excerpt", 120, 262, "500 52px 'Red Hat Mono'");
  rule(310);
  ROWS.forEach(([name, key], i) => { text(name, 150, ROW_Y(i), "600 78px 'Red Hat Text'"); if (key) text(String(YEAR[key]), CW - 150, ROW_Y(i), "500 70px 'Red Hat Mono'", "right"); });
  rule(1200);
  text("ranks the strength of evidence, not the size of risk", 120, RANK_Y, "600 66px 'Red Hat Text'");
  const lit = (rowIdx, label) => {   // one row in cyan, with a soft bar behind it
    const o = document.createElement("canvas"); o.width = CW; o.height = CH; const q = o.getContext("2d");
    const y = rowIdx == null ? RANK_Y : ROW_Y(rowIdx), font = rowIdx == null ? "600 66px 'Red Hat Text'" : "600 78px 'Red Hat Text'";
    q.fillStyle = "rgba(95,242,232,.16)"; q.fillRect(100, y - 82, CW - 200, 112); q.fillStyle = "#5FF2E8"; q.fillRect(100, y - 82, 12, 112);
    q.shadowColor = "rgba(95,242,232,.8)"; q.shadowBlur = 24; q.fillStyle = "#B8FFF9"; q.font = font; q.textBaseline = "alphabetic";
    q.textAlign = "left"; q.fillText(label, rowIdx == null ? 120 : 150, y);
    if (rowIdx != null && ROWS[rowIdx][1]) { q.font = "500 70px 'Red Hat Mono'"; q.textAlign = "right"; q.fillText(String(YEAR[ROWS[rowIdx][1]]), CW - 150, y); }
    const t = new THREE.CanvasTexture(o); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const idx = (name) => ROWS.findIndex((r) => r[0] === name);
  LIT.tobacco.map = lit(idx("Tobacco smoking"), "Tobacco smoking"); LIT.beds.map = lit(idx("UV-emitting tanning devices"), "UV-emitting tanning devices");
  LIT.meat.map = lit(idx("Processed meat (eating)"), "Processed meat (eating)"); LIT.sun.map = lit(idx("Solar radiation"), "Solar radiation");
  LIT.rank.map = lit(null, "ranks the strength of evidence, not the size of risk");
  Object.values(LIT).forEach((m) => (m.needsUpdate = true));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const bt = new THREE.CanvasTexture(bump); bt.anisotropy = 8;
  plateMat.map = t; plateMat.bumpMap = bt; plateMat.bumpScale = 1.2; plateMat.needsUpdate = true;
};

// ── 2 + 3: the canopy: deep-tone skin under the tubes; two halves, one per bank (Australia left, Brazil right) ──
const mkHalf = (keepLeft) => {
  const T = createTerrain({ seed: 31, spots: 0, segs: 400 });
  const clip = [new THREE.Plane(new THREE.Vector3(keepLeft ? -1 : 1, 0, 0), keepLeft ? XB : -XB)];
  const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.08, hydration: 0.3, repeat: 14, seed: 6, micro: 0.35 });
  m.sheen = 0.05; m.sheenColor.setRGB(0.6, 0.45, 0.4); m.clippingPlanes = clip; T.mesh.material = m;
  T.group.traverse((o) => { if (o.isInstancedMesh) { o.geometry = o.geometry.clone().scale(0.45, 1, 0.45); } if (o.isInstancedMesh) o.material = new THREE.MeshPhysicalMaterial({ color: 0x0e0806, roughness: 0.4, clearcoat: 0.6, clippingPlanes: clip }); else if (o.isMesh && o !== T.mesh) o.visible = false; });
  T.group.position.x = XB; scene.add(T.group); return { T, m };
};
const HL = mkHalf(true), HR = mkHalf(false);
const tubeMats = [new THREE.MeshBasicMaterial({ color: 0x000000 }), new THREE.MeshBasicMaterial({ color: 0x000000 })];
const tubes = new THREE.Group(); tubes.position.x = XB; scene.add(tubes);
for (let i = 0; i < 8; i++) { const x = -5.6 + i * 1.6, m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 46, 16), tubeMats[x < 0 ? 0 : 1]); m.rotation.x = Math.PI / 2; m.position.set(x, 6.6, -12); tubes.add(m); }
const reflector = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 46), new THREE.MeshPhysicalMaterial({ color: 0x1a1030, roughness: 0.3, metalness: 0.6 })); reflector.position.set(0, 7.2, -12); tubes.add(reflector);
const bedLight = new THREE.DirectionalLight(0x9c7bff, 0); bedLight.position.set(XB, 30, -4); bedLight.target.position.set(XB, 0, -4); scene.add(bedLight, bedLight.target);
const shaftBed = createShaft({ from: [XB - 2, 6.4, -6], to: [XB + 1, -0.5, -1], radius: 2.6, color: "#B79BFF" }); scene.add(shaftBed.group);
const dustBed = particles(320, [[XB - 7, 0.3, -12], [XB + 7, 6.2, 9]], 0.06, "#F3E9FF");
const FOGB = new THREE.Fog(0x2c1660, 24, 62);

// ── 4: the cut face: a block of deep-tone skin, its face a stained tissue photo; UVA dashes ──
const C = new THREE.Group(); C.position.x = XC; scene.add(C);
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), faceMat); face.position.set(0, -5.25, 0); C.add(face);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.7, 0.42, 0.5), roughness: 0.55 });
const topMat = skinMaterial({ tone: DEEP.map((v) => v * 0.75), oil: 0.05, repeat: 3, seed: 9, micro: 0.6 }); topMat.sheen = 0.04;
const block = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 6), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]); block.position.set(0, -5.25, -3.01); C.add(block);
const dashTex = (() => { const c = document.createElement("canvas"); c.width = 16; c.height = 128; const k = c.getContext("2d"); const g = k.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.75, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,1)"); k.fillStyle = g; k.fillRect(4, 0, 8, 128); return new THREE.CanvasTexture(c); })();
const ND = 46, dashMat = new THREE.MeshBasicMaterial({ map: dashTex, color: new THREE.Color("#8B5CFF").multiplyScalar(1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.09, 1.1), dashMat, ND); dashes.position.set(XC, 0, 0.12); scene.add(dashes);
const DASH = Array.from({ length: ND }, () => ({ x: -7.5 + R() * 15, ph: R(), stop: R() < 0.12 ? -0.8 - R() * 0.9 : -3 - R() * 5.5, sp: 3.2 + R() * 1.4 }));   // a few stop in the top layer; most carry on into the dermis
const shaftC = createShaft({ from: [XC - 6, 14, 4], to: [XC + 1, -6, 1], radius: 2.6, color: "#C9B4FF" }); scene.add(shaftC.group);
const dustC = particles(300, [[XC - 9, -10, 0.5], [XC + 9, 6, 10]], 0.06, "#FFF2F8");
const dm = new THREE.Object3D();

// ── the overlay ──────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const grain = createGrain(hudRoot, { amount: 0.012 });
const hud = createHud({ camera, shots: FILM.shots });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.small) el.querySelector(".v").style.fontSize = c.small;
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.2, liftAt: [0.18, 0.33] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
const scan = document.createElement("div");   // the UV switch: a cyan line sweeping down the frame
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#5FF2E8", boxShadow: "0 0 18px 4px rgba(95,242,232,.55)", opacity: "0", zIndex: 2 });
hudRoot.appendChild(scan);
const tags = FILM.tags.map((g) => { const d = document.createElement("div"); d.textContent = g.text;
  Object.assign(d.style, { position: "absolute", top: `${0.5 * H}px`, [g.side]: `${0.11 * W}px`, fontFamily: "var(--font-mono)", fontSize: "2.9vmin", fontWeight: "500", letterSpacing: ".06em",
    color: "var(--text)", background: "var(--hud-plate)", padding: ".7vmin 1.6vmin", borderRadius: "1.2vmin", opacity: "0", visibility: "hidden", zIndex: 3 });
  hudRoot.appendChild(d); return { g, d }; });
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

window.SCENE_READY = (async () => {
  await Promise.all(["700 76px 'Red Hat Mono'", "500 52px 'Red Hat Mono'", "600 78px 'Red Hat Text'"].map((f) => document.fonts.load(f).catch(() => null)));
  drawPlate();
  const sec = await new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = SECTION; });
  sec.repeat.set(1, 1);   // the whole photo once: no tile seams
  faceMat.map = sec; faceMat.needsUpdate = true;
  HL.T.set({ tone: DEEP, furrows: 0.35 }); HR.T.set({ tone: DEEP, furrows: 0.35 });
})();

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.max(0, Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d)));
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const add = (p, x) => [p[0] + x, p[1], p[2]];
const OFF = { list: 0, list2: 0, bed: XB, uv: XB, section: XC };
const shotCam = (name, t) => {
  const c = FILM.cam[name], u = E.inout2(seg(t, c.t[0], c.t[1])), x = OFF[name];
  camera.position.set(...add(mix3(c.from, c.to, u), x)); camera.lookAt(...add(mix3(c.look0, c.look1, u), x));
};
const LILAC = [0.3, 0.21, 0.6], UVC = new THREE.Color("#9C7BFF");

window.seek = function (t) {
  const shot = stage(t).name, isList = shot === "list" || shot === "list2", isBed = shot === "bed" || shot === "uv";
  shotCam(shot, t);
  plate.visible = farTubes.visible = hzL1.visible = hzL2.visible = isList;
  HL.T.group.visible = HR.T.group.visible = tubes.visible = isBed;
  C.visible = dashes.visible = shot === "section";
  shaftL.set({ op: isList ? 0.9 : 0 }); dustL.set(t, isList ? 1 : 0);
  shaftBed.set({ op: shot === "bed" ? 0.7 : 0 }); dustBed.set(t, isBed ? 1 : 0);
  shaftC.set({ op: shot === "section" ? 1 : 0 }); dustC.set(t, shot === "section" ? 1 : 0);
  scene.fog = isBed ? FOGB : null;
  bedLight.intensity = 0;

  // ── the list: rows light on their words; one line wins (the previous ones drop to a third) ──
  if (isList) {
    const L = PL.lit;
    studio.aim([0, 0, 0], [-0.55, 0.7, 0.75], [0.6, 0.35, -0.8]); studio.set({ key: 1.5, rim: 2.4, fill: 0.35, env: 0.6, warm: 0.15 });
    if (shot === "list") {
      const rk = E.inout2(seg(t, FILM.cam.list.rack[0], FILM.cam.list.rack[1]));
      focusPt = mix3([0.4, -0.2, 9], [0, -0.3, 0.1], rk); fstop = 0.22;   // rack: the dust, then the plate
      const ranked = fadeIn(t, PL.rank, 0.5);
      LIT.tobacco.opacity = fadeIn(t, L["Tobacco smoking"]) * (1 - 0.6 * ranked); LIT.beds.opacity = fadeIn(t, L["UV-emitting tanning devices"]) * (1 - 0.6 * ranked);
      LIT.meat.opacity = fadeIn(t, L["Processed meat"]) * (1 - 0.6 * ranked); LIT.sun.opacity = 0; LIT.rank.opacity = ranked;
    } else {
      focusPt = [0, -0.3, 0.1]; fstop = 0.22;
      const sun = fadeIn(t, PL.sun, 0.5), rank = fadeIn(t, PL.rank2, 0.5);
      LIT.tobacco.opacity = LIT.beds.opacity = LIT.meat.opacity = 0.4 * (1 - 0.4 * sun);
      LIT.sun.opacity = sun * (1 - 0.6 * rank); LIT.rank.opacity = 0.35 + 0.65 * rank;
    }
  }

  // ── the canopy: the tubes come up violet, flare on "ten", fall back to a third; then the UV camera ──
  if (isBed) {
    let kL = 1, kR = 1, uv = 0;
    if (shot === "bed") {
      const on = fadeIn(t, FILM.bed.on[0], FILM.bed.on[1] - FILM.bed.on[0]), fl = win(t, FILM.bed.flare[0], FILM.bed.flare[1], 0.25), fall = E.inout2(seg(t, FILM.bed.fall[0], FILM.bed.fall[1]));
      kL = kR = on * (1 + 0.9 * fl) * (1 - 0.45 * fall);
      bedLight.intensity = 1.3 * kL;
      studio.aim([XB, 0, -2], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]); studio.set({ key: 2.0, rim: 1.8, fill: 0.2, env: 0.3, warm: 0.35 });
      const rk = E.inout2(seg(t, FILM.cam.bed.rack[0], FILM.cam.bed.rack[1]));
      focusPt = mix3([XB, 5.2, -6], [XB + 0.6, 0.2, -2], rk); fstop = 0.2;   // rack: the tubes, then the skin
      HL.m.emissive.setRGB(0, 0, 0); HR.m.emissive.setRGB(0, 0, 0); HL.m.color.setRGB(1, 1, 1); HR.m.color.setRGB(1, 1, 1);
      HL.T.set({ tone: DEEP, furrows: 0.35 }); HR.T.set({ tone: DEEP, furrows: 0.35 });
    } else {
      uv = E.inout2(seg(t, FILM.uvd.scan[0] + 0.1, FILM.uvd.scan[1]));
      const sw = seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]); scan.style.top = `${(sw * H).toFixed(1)}px`;
      kL = 1 - E.inout2(seg(t, FILM.uvd.australia[0], FILM.uvd.australia[1])); kR = 1 - E.inout2(seg(t, FILM.uvd.brazil[0], FILM.uvd.brazil[1]));
      const tone = mix3(DEEP, LILAC, uv);
      HL.T.set({ tone, furrows: 0.35 }); HR.T.set({ tone, furrows: 0.35 });
      [[HL, kL], [HR, kR]].forEach(([h, k]) => { const g = (1 - uv) + uv * (0.12 + 0.88 * k); h.m.color.setRGB(g, g, g); h.m.emissive.setRGB(0.03 * uv * k, 0.02 * uv * k, 0.08 * uv * k); });
      studio.aim([XB, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]); studio.set({ key: 1.4 * (1 - 0.6 * uv), rim: 2.0, fill: 0.3, env: 0.4, warm: 0.4 * (1 - uv) });
      focusPt = mix3(add([0, 0, 2], XB), add([0.2, 0, -1.5], XB), E.inout2(seg(t, CUT.uv, CUT.section))); fstop = 0.22;
    }
    tubeMats[0].color.copy(UVC).multiplyScalar(0.05 + 0.75 * kL); tubeMats[1].color.copy(UVC).multiplyScalar(0.05 + 0.75 * kR);
  }
  scan.style.opacity = shot === "uv" && seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]) > 0 && seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]) < 1 ? "1" : "0";
  for (const { g, d } of tags) { const op = shot === "uv" ? win(t, g.t0, g.t1, 0.3) : 0; d.style.opacity = op.toFixed(3); d.style.visibility = op > 0.002 ? "visible" : "hidden"; }

  // ── the cut face: the long rays fall, pass the top layer and carry on into the dermis ──
  if (shot === "section") {
    studio.aim([XC, -4, 0], [-0.45, 0.8, 0.55], [0.55, 0.35, -0.85]); studio.set({ key: 1.6, rim: 2.6, fill: 0.45, env: 0.5, warm: 0.2 });
    focusPt = mix3([XC - 0.6, -3.2, 0], [XC + 0.6, -3.8, 0], E.inout2(seg(t, CUT.section, CUT.list2))); fstop = 0.16;
    const gain = fadeIn(t, FILM.rays.on[0], FILM.rays.on[1] - FILM.rays.on[0]);
    DASH.forEach((d, i) => {
      const life = 6 / d.sp + 0.6, u = ((t - CUT.section) / life + d.ph) % 1, y = 5 - u * life * d.sp;
      const stopped = y < d.stop, yy = Math.max(y, d.stop), fade = stopped ? Math.max(0, 1 - (d.stop - y) / 1.2) : 1;
      dm.position.set(d.x, yy + 0.55, 0); dm.scale.set(1, Math.max(0.001, gain * fade), 1); dm.updateMatrix(); dashes.setMatrixAt(i, dm.matrix);
    });
    dashes.instanceMatrix.needsUpdate = true;
  }

  // ── to scale: the top layer beside the paper ──
  const lift = shot === "section" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: G.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  veil.style.opacity = (0.72 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard))).toFixed(4);
  grain.set(t);
  hud.update(t);
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
