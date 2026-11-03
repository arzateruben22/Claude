import * as THREE from "three";
// Skin Sense No. 006, "Same list as cigarettes" (films/channels/skincare/ep06), rebuilt in the approved look (look
// test 2, 2 Nov; review round 1, 3 Nov): four hero shots, one subject filling the frame, one motivated move each,
// film-set light (key, fill, rim, volumetrics), dust bokeh, shallow depth of field. The picture is a pure function of t:
// window.seek(t) sets the shot, the camera, every object and the overlay from t alone, then makes exactly one
// renderer.render(). One skin tone: deep. Heavy geometry is built once.
//   list     the IARC Group 1 excerpt as a bevelled slate slab, engraved, cyan inlays in recessed grooves (x = 0)
//   bed      deep-tone skin under a canopy of UVA tubes (core, glass, reflector, acrylic), god rays and dust (x = 500)
//   uv       the same skin through the UV camera (the cyan scan line): the left half and its bank switch off, then the
//            right (x = 500)
//   section  a block of skin cut open, three-quarter view, its face a stained tissue photo; UVA dashes cross the marked
//            top layer into the dermis (x = 1000)
//   list2    the plate again: the sun's row lights, dated first; the end card over the plate, defocused
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { createStudio, skinMaterial, createShaft } from "../set/studio.js";
import { SECTION } from "../set/ref/textures.js";
import { hazeVolume, bokeh } from "../set/prod.js";
import { lookV3, skinV3 } from "../set/look3.js";
import { unifyHud, stackAsCard } from "../set/hudv2.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, CUT = FILM.cut, G = FILM.gauge, PL = FILM.plate;
const S1 = Math.min(W, H) / 1080;
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
const R = rng(6);
injectCss();
const DEEP = [0.095, 0.05, 0.03];   // bible: 006 is the deep tone, the only tone in the film (albedo low enough to read deep brown under the violet wash)
const XB = 500, XC = 1000;
const VIOLET = new THREE.Color("#9C7BFF");
const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.max(0, Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d)));
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const add = (p, x) => [p[0] + x, p[1], p[2]];

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) and haze cards ──
const disc = (soft) => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(soft, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); };
const dotTex = disc(0.4);
const particles = (n, box, size, color, op0 = 0.7) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: op0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); scene.add(p);
  return { p, set(t, op = 1) { p.visible = op > 0.002; if (!p.visible) return; m.opacity = op0 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.25 * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + 0.15 * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + 0.2 * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};
const haze = (w, h, pos, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false })); m.position.set(...pos); scene.add(m); return m; };
const glowTex = (() => { const c = document.createElement("canvas"); c.width = 8; c.height = 128; const k = c.getContext("2d"); const g = k.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 8, 128); return new THREE.CanvasTexture(c); })();

// ── 1: the list, a bevelled slate slab, engraved; an excerpt of IARC Group 1, typeset ──
const PW = 5.0, PH = 3.8, CW = 2048, CH = Math.round(CW * PH / PW);
const ROWS = [["Alcoholic beverages", ""], ["Asbestos", ""], ["Processed meat (eating)", "meat"], ["Solar radiation", "sun"], ["Tobacco smoking", ""], ["UV-emitting tanning devices", "beds"], ["X- and gamma-radiation", ""]];
const ROW_Y = (i) => 418 + i * 108, RANK_Y = [1238, 1336];
const RANK = ["ranks the strength of evidence,", "not the size of risk"];
const YEAR = { meat: PL.years.meat, sun: PL.years.sun, beds: PL.years.beds };
const plate = new THREE.Group(); scene.add(plate);
const slabShape = (() => { const s = new THREE.Shape(), w = PW / 2, h = PH / 2, r = 0.1; s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h); return s; })();
const slabMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.05, 0.035, 0.09), roughness: 0.32, metalness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.2 });
const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(slabShape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 4, curveSegments: 6 }), slabMat);
slab.position.z = -0.14; plate.add(slab);
const FRONT = 0.05 + 0.002;
const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.15, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(0.7, 0.6, 1.0) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.02, PH - 0.02), plateMat); face.position.z = FRONT; plate.add(face);
const overlay = (z) => { const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: new THREE.Color(1.9, 1.9, 1.9), toneMapped: true });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.02, PH - 0.02), m); o.position.z = FRONT + z; plate.add(o); return m; };
const LIT = { tobacco: overlay(0.002), beds: overlay(0.0022), meat: overlay(0.0024), sun: overlay(0.0026), rank: overlay(0.0028) };
plate.rotation.set(-0.07, 0.22, 0.012);   // 12–13° off the lens, so the push gives parallax
const hzL1 = haze(70, 40, [0, 0, -12], "#2C1660", 0.38), hzL2 = haze(70, 40, [0, 0, -5], "#3A2178", 0.12);
const farTubes = new THREE.Group(); scene.add(farTubes);   // a tube bank behind and below the slab, out of focus: its violet rim
const farCore = new THREE.MeshBasicMaterial({ color: VIOLET.clone().multiplyScalar(2.0) });
const farHouse = new THREE.MeshPhysicalMaterial({ color: 0x2a2342, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide });
for (let i = 0; i < 7; i++) { const x = -6 + i * 2.0, z = -16;   // a bed's tube bank seen end-on-ish below and behind the slab: the DOF makes each a soft glowing rod
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 30, 16), farCore); c.rotation.x = Math.PI / 2 - 0.35; c.position.set(x, -6.5, z); farTubes.add(c);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 30, 16, 1, true, Math.PI / 2, Math.PI), farHouse); h.rotation.x = Math.PI / 2 - 0.35; h.position.set(x, -6.0, z); farTubes.add(h); }
farTubes.rotation.z = 0.0;
const rimV = new THREE.DirectionalLight(0x9c7bff, 0); rimV.position.set(4, -3, -12); rimV.target.position.set(0, 0, 0); scene.add(rimV, rimV.target);   // the bank's violet rim from behind and below
const shaftL = createShaft({ from: [-10, 15, 4], to: [3, -5, -1], radius: 2.0, color: "#D7C8FF" }); scene.add(shaftL.group);
const dustL = particles(260, [[-7, -5, -3], [7, 6, 9]], 0.045, "#F3E9FF");
const dustNear = particles(36, [[-2.5, -2.2, 10.5], [2.5, 2.2, 14.5]], 0.07, "#E9DEFF", 0.55);   // foreground dust: bokeh in front of the slab

const drawPlate = () => {
  const c = document.createElement("canvas"); c.width = CW; c.height = CH; const k = c.getContext("2d");
  const bump = document.createElement("canvas"); bump.width = CW; bump.height = CH; const b = bump.getContext("2d");
  const g = k.createLinearGradient(0, 0, CW, CH); g.addColorStop(0, "#2B1E4A"); g.addColorStop(1, "#1A1232"); k.fillStyle = g; k.fillRect(0, 0, CW, CH);
  const RS = rng(4); for (let i = 0; i < 14000; i++) { k.fillStyle = `rgba(${RS() < 0.5 ? "255,255,255" : "0,0,0"},${(0.02 + 0.04 * RS()).toFixed(3)})`; k.fillRect(RS() * CW, RS() * CH, 1 + RS() * 3, 1 + RS() * 3); }   // the slate's tooth
  for (let i = 0; i < 260; i++) { k.strokeStyle = `rgba(255,255,255,${(0.015 + 0.02 * RS()).toFixed(3)})`; k.lineWidth = 1; const y = RS() * CH; k.beginPath(); k.moveTo(0, y); k.lineTo(CW, y + (RS() - 0.5) * 30); k.stroke(); }   // a brushed grain
  b.fillStyle = "#fff"; b.fillRect(0, 0, CW, CH);
  const ink = (draw) => { k.save(); k.fillStyle = "rgba(0,0,0,.6)"; k.translate(0, -4); draw(k); k.restore(); k.save(); k.fillStyle = "#C4B5E6"; draw(k); k.restore(); b.save(); b.fillStyle = "#000"; draw(b); b.restore(); };   // engraved: a shadow on the upper lip, the paint fill, a recess in the bump map
  const text = (s, x, y, font, align = "left") => ink((ctx) => { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(s, x, y); });
  const rule = (y, w = 4) => ink((ctx) => ctx.fillRect(110, y, CW - 220, w));
  const groove = (y) => { k.fillStyle = "#0B0716"; k.fillRect(104, y - 66, 14, 84); b.fillStyle = "#000"; b.fillRect(104, y - 66, 14, 84); };   // the inlay's empty groove
  text("IARC MONOGRAPHS", 120, 175, "700 76px 'Red Hat Mono'"); text("GROUP 1", CW - 120, 175, "700 96px 'Red Hat Mono'", "right");
  text("carcinogenic to humans · an excerpt", 120, 252, "500 50px 'Red Hat Mono'"); text("year listed", CW - 150, 252, "500 44px 'Red Hat Mono'", "right");
  rule(296);
  ROWS.forEach(([name, key], i) => { groove(ROW_Y(i)); text(name, 150, ROW_Y(i), "600 74px 'Red Hat Text'"); if (key && key !== "sun") text(String(YEAR[key]), CW - 150, ROW_Y(i), "500 66px 'Red Hat Mono'", "right"); });
  rule(1150);
  RANK.forEach((s, i) => { groove(RANK_Y[i]); text(s, 150, RANK_Y[i], "600 80px 'Red Hat Text'"); });
  const lit = (ys, labels, years = []) => {   // the inlay lit: the groove filled with light, the engraving glowing cyan
    const o = document.createElement("canvas"); o.width = CW; o.height = CH; const q = o.getContext("2d");
    ys.forEach((y, j) => {
      q.shadowColor = "rgba(95,242,232,.9)"; q.shadowBlur = 30; q.fillStyle = "#9FFFF7"; q.fillRect(104, y - 66, 14, 84);
      q.shadowBlur = 18; q.fillStyle = "#B8FFF9"; q.textBaseline = "alphabetic"; q.textAlign = "left"; q.font = labels.length > 1 ? "600 80px 'Red Hat Text'" : "600 74px 'Red Hat Text'"; q.fillText(labels[j], 150, y);
      if (years[j]) { q.font = "500 66px 'Red Hat Mono'"; q.textAlign = "right"; q.fillText(String(years[j]), CW - 150, y); }
    });
    const t = new THREE.CanvasTexture(o); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const row = (name) => ROWS.findIndex((r) => r[0] === name);
  const one = (name) => { const i = row(name), key = ROWS[i][1]; return lit([ROW_Y(i)], [name], [key ? YEAR[key] : ""]); };
  LIT.tobacco.map = one("Tobacco smoking"); LIT.beds.map = one("UV-emitting tanning devices"); LIT.meat.map = one("Processed meat (eating)"); LIT.sun.map = one("Solar radiation");
  LIT.rank.map = lit(RANK_Y, RANK);
  Object.values(LIT).forEach((m) => (m.needsUpdate = true));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const bt = new THREE.CanvasTexture(bump); bt.anisotropy = 8;
  plateMat.map = t; plateMat.bumpMap = bt; plateMat.bumpScale = 2.2; plateMat.needsUpdate = true;
};

// ── 2 + 3: the canopy: deep-tone skin under the tubes; two banks (Australia left, Brazil right) ──
const T = createTerrain({ seed: 31, spots: 0, segs: 400 });
T.group.position.x = XB; scene.add(T.group);
const skinM = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.06, hydration: 0.25, repeat: 14, seed: 6, micro: 0.45 });
// skin sheen, roughness and speculars come from the shared skinMaterial (the channel-wide production pass)
const UV = { uUV: { value: 0 }, uL: { value: 1 }, uR: { value: 1 }, uSeam: { value: XB }, uLilac: { value: new THREE.Color(0.22, 0.15, 0.42) }, uGlow: { value: new THREE.Color(0.11, 0.07, 0.26) } };
const uvShader = (sh) => {   // the UV camera: one material, a soft seam between the two banks' halves
  Object.assign(sh.uniforms, UV);
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWX;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWX = (modelMatrix * vec4(transformed, 1.0)).x;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWX;\nuniform float uUV, uL, uR, uSeam;\nuniform vec3 uLilac, uGlow;")
    .replace("#include <color_fragment>", `#include <color_fragment>
      float sideK = smoothstep(-0.3, 0.3, vWX - uSeam);
      float kk = mix(uL, uR, sideK);
      float lum = clamp(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) / 0.1, 0.35, 1.5);
      diffuseColor.rgb = mix(diffuseColor.rgb, uLilac * lum, uUV);`)
    .replace("#include <tonemapping_fragment>", "gl_FragColor.rgb *= mix(1.0, 0.2 + 0.8 * kk, uUV);\n#include <tonemapping_fragment>")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * kk * uUV;");
};
T.mesh.material = skinM;
let hairs = null;
T.group.traverse((o) => { if (o.isInstancedMesh) hairs = o; else if (o.isMesh && o !== T.mesh) o.visible = false; });
// hair thickness and material come from the shared terrain (the production pass); this episode only adds a slow drift
const hairBase = Array.from({ length: hairs.count }, (_, i) => { const m = new THREE.Matrix4(); hairs.getMatrixAt(i, m); return m; });
const hairPh = hairBase.map(() => R() * 6.28), hm = new THREE.Matrix4(), hr = new THREE.Matrix4();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0), hairFar = hairBase.map((m) => m.elements[14] < -16);   // far strands would silhouette on the fog as spikes: the near field only
const driftHairs = (t) => { hairBase.forEach((m, i) => { hr.makeRotationFromEuler(new THREE.Euler(0.05 * Math.sin(t * 0.5 + hairPh[i]), 0, 0.05 * Math.cos(t * 0.37 + hairPh[i]))); hm.multiplyMatrices(m, hr); hairs.setMatrixAt(i, hairFar[i] ? HIDE : hm); }); hairs.instanceMatrix.needsUpdate = true; };
const occlude = () => {   // ambient occlusion baked into the vertex colours: furrows, pores and hair roots sit in shadow
  const p = T.mesh.geometry.attributes.position, c = T.mesh.geometry.attributes.color;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.45 + 0.55 * THREE.MathUtils.smoothstep(y, -0.55, 0.15); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
  c.needsUpdate = true;
};
// the canopy: per tube an emissive core, a glass envelope, a reflector housing; an acrylic sheet under them all
const canopy = new THREE.Group(); canopy.position.x = XB; scene.add(canopy);
const coreMats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
const glassMats = [0, 1].map(() => { const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x000000, depthWrite: false, fog: false }); m.userData.envK = 3; return m; });
const housingMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3352, roughness: 0.22, metalness: 0.9, side: THREE.DoubleSide });
const TUBE_Y = 6.6, LEN = 46, TZ = -12;
const coreG = new THREE.CylinderGeometry(0.075, 0.075, LEN, 12), glassG = new THREE.CylinderGeometry(0.2, 0.2, LEN, 24), housingG = new THREE.CylinderGeometry(0.42, 0.42, LEN, 24, 1, true, Math.PI / 2, Math.PI);
for (let i = 0; i < 8; i++) {
  const x = -5.6 + i * 1.6, bank = x < 0 ? 0 : 1;
  const core = new THREE.Mesh(coreG, coreMats[bank]), glass = new THREE.Mesh(glassG, glassMats[bank]), hous = new THREE.Mesh(housingG, housingMat);
  [core, glass, hous].forEach((m) => { m.rotation.x = Math.PI / 2; m.position.set(x, TUBE_Y, TZ); canopy.add(m); });
  hous.position.y = TUBE_Y + 0.08;
}
const acrylic = new THREE.Mesh(new THREE.PlaneGeometry(14, LEN), new THREE.MeshPhysicalMaterial({ color: 0xe8e0ff, roughness: 0.12, transparent: true, opacity: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
acrylic.rotation.x = Math.PI / 2; acrylic.position.set(0, TUBE_Y - 0.45, TZ); acrylic.material.userData.envK = 3; canopy.add(acrylic);
const bankL = new THREE.DirectionalLight(0x9c7bff, 0), bankR = new THREE.DirectionalLight(0x9c7bff, 0);
bankL.position.set(XB - 14, 22, -4); bankL.target.position.set(XB + 2, 0, -4); bankR.position.set(XB + 14, 22, -4); bankR.target.position.set(XB - 2, 0, -4);
scene.add(bankL, bankL.target, bankR, bankR.target);
const coolFill = new THREE.HemisphereLight(0x8fa8ff, 0x140c24, 0);
const bounce = new THREE.DirectionalLight(0xffb487, 0); bounce.position.set(XB, 1.2, 30); bounce.target.position.set(XB, 0, -6); scene.add(bounce, bounce.target);   // a warm grazing bounce: the brown reads before the violet wash
scene.add(coolFill);
const beamMat = (op) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { uOp: { value: 0 }, uC: { value: VIOLET.clone() } },
  vertexShader: "varying vec2 vUv; varying vec3 vN, vV; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
  fragmentShader: "uniform float uOp; uniform vec3 uC; varying vec2 vUv; varying vec3 vN, vV; void main() { float f = pow(abs(dot(vN, vV)), 2.2); float a = uOp * f * pow(vUv.y, 0.8) * smoothstep(0.0, 0.25, vUv.y); gl_FragColor = vec4(uC * a, a); }" });
const rays = [[-4.0, -7], [-0.8, -3.5], [2.4, -9], [4.8, -5]].map(([x, z]) => {   // soft volumetric cones from the tubes onto the skin (read as beams from any angle, never as flat cards)
  const m = beamMat(), cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 2.4, TUBE_Y + 0.4, 40, 1, true), m);
  cone.position.set(XB + x, TUBE_Y / 2 - 0.2, z); scene.add(cone);
  return { group: cone, set({ op = 1 } = {}) { cone.visible = op > 0.002; m.uniforms.uOp.value = 0.22 * op; } };
});
const dustBed = particles(380, [[XB - 7, 0.3, -14], [XB + 7, 6.2, 9]], 0.055, "#F3E9FF");
const FOGB = new THREE.FogExp2(0x2c1660, 0.045), FOGU = new THREE.FogExp2(0x1a0d36, 0.018);   // the UV shot looks down from above the tubes: thinner fog

// ── 4: the cut face: a block of deep-tone skin seen three-quarters, its face the stained tissue photo ──
const C = new THREE.Group(); C.position.x = XC; scene.add(C);
const CROP = 120 / 672, U0 = 0.3, U1 = 0.7, BW = 16 * (U1 - U0), FH = 16 * (672 * (1 - CROP)) / 1024;   // a portrait block: the photo cropped through the UVs (no tiling, no stretch; its top rows of bare slide dropped)
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const faceG = new THREE.PlaneGeometry(BW, FH); { const uv = faceG.attributes.uv; for (let i = 0; i < uv.count; i++) { uv.setY(i, uv.getY(i) * (1 - CROP)); uv.setX(i, U0 + uv.getX(i) * (U1 - U0)); } }
const faceC = new THREE.Mesh(faceG, faceMat); faceC.position.set(0, -FH / 2, 0); C.add(faceC);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.55, 0.3, 0.42), roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0.9, 0.6, 0.8) });
const topMat = skinMaterial({ tone: DEEP.map((v) => v * 0.6), oil: 0.05, repeat: 3, seed: 9, micro: 0.7 }); topMat.sheen = 0.05; topMat.roughness = 0.7; topMat.clearcoat = 0.03; topMat.specularIntensity = 0.2;
const BD = 4.2, block = new THREE.Mesh(new THREE.BoxGeometry(BW, FH, BD), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]); block.position.set(0, -FH / 2, -BD / 2 - 0.005); C.add(block);
// the top surface in relief: the same microrelief as the canopy's skin (furrows, pores), deep tone, scaled onto the block's top
const TT = createTerrain({ size: 9, segs: 200, pore: 0.6, seed: 12, spots: 0, hair: false });
TT.mesh.material = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.06, hydration: 0.25, repeat: 6, seed: 9, micro: 0.6 });
TT.group.scale.set(BW / 9, 0.45, BD / 9); TT.group.position.set(0, 0.02, -BD / 2); C.add(TT.group);
// the top layer's lower edge, traced from the photo (px of the 1024 × 672 original), marked with a fine lilac line
const JPX = [[0, 300], [60, 335], [130, 330], [180, 280], [240, 295], [300, 295], [340, 240], [420, 225], [480, 215], [540, 225], [600, 195], [660, 220], [720, 210], [790, 175], [850, 215], [900, 185], [960, 215], [1024, 215]];
const jx = (px) => -BW / 2 + BW * (px / 1024 - U0) / (U1 - U0), jy = (py) => -(py - 120) / (672 - 120) * FH;
const JW = JPX.map(([x, y]) => [jx(x), jy(y)]).filter(([x], i, a) => (x >= -BW / 2 - 1e-6 && x <= BW / 2 + 1e-6) || (a[i + 1] && a[i + 1][0] > -BW / 2 && x < -BW / 2) || (a[i - 1] && a[i - 1][0] < BW / 2 && x > BW / 2))
  .map(([x, y]) => [Math.max(-BW / 2, Math.min(BW / 2, x)), y]);
const junctionY = (x) => { for (let i = 1; i < JW.length; i++) if (x <= JW[i][0]) { const [x0, y0] = JW[i - 1], [x1, y1] = JW[i], u = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * u; } return JW[JW.length - 1][1]; };
const jCurve = new THREE.CatmullRomCurve3(JW.map(([x, y]) => new THREE.Vector3(x, y, 0.03)));
const jMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#E4D8FF"), transparent: true, opacity: 0 });
C.add(new THREE.Mesh(new THREE.TubeGeometry(jCurve, 160, 0.03, 6, false), jMat));
const dashTex = (() => { const c = document.createElement("canvas"); c.width = 32; c.height = 128; const k = c.getContext("2d"); const g = k.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.7, "rgba(255,255,255,.85)"); g.addColorStop(1, "rgba(255,255,255,1)"); k.fillStyle = g; k.fillRect(6, 0, 20, 128);
  k.globalCompositeOperation = "destination-in"; const h = k.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, "rgba(0,0,0,0)"); h.addColorStop(0.5, "rgba(0,0,0,1)"); h.addColorStop(1, "rgba(0,0,0,0)"); k.fillStyle = h; k.fillRect(0, 0, 32, 128);
  return new THREE.CanvasTexture(c); })();
const ND = 11, dashMat = new THREE.MeshBasicMaterial({ map: dashTex, color: VIOLET.clone().multiplyScalar(1.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const dashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.24, 1.6), dashMat, ND); dashes.position.set(XC, 0, 0.14); scene.add(dashes);
const flashMat = new THREE.MeshBasicMaterial({ map: dotTex, color: new THREE.Color("#C9B4FF").multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const flashes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9), flashMat, ND); flashes.position.set(XC, 0, 0.15); scene.add(flashes);
const DASH = Array.from({ length: ND }, (_, i) => ({ x: -BW / 2 + 0.4 + (BW - 0.8) * (i + 0.5) / ND + (R() - 0.5) * 0.5, ph: R(), stop: i % 6 === 2 ? -0.9 - R() * 0.6 : -4.2 - R() * 3.2, sp: 2.6 + R() * 0.8 }));   // a few stop in the top layer; most cross into the dermis
const shaftC = createShaft({ from: [XC - 5, 14, 3], to: [XC + 1, -6, 0.5], radius: 2.0, color: "#C9B4FF" }); scene.add(shaftC.group);
const dustC = particles(300, [[XC - 8, -9, 0.5], [XC + 14, 7, 16]], 0.06, "#FFF2F8");
const dm = new THREE.Object3D();

// ── the overlay: one HUD system (the theme's plate fill, radius, mono and sans) ─────────
const hudRoot = document.getElementById("hud");
const look = lookV3({ canvas, hudRoot, fog: FOGB, terrain: T });   // the channel look (set/look3.js): hairs, fog, grade, grain
skinV3(skinM, { keyDir: [-0.85, 0.42, 0.35] });   // the canopy key is low and to the side (the tubes are overhead)
{ const v2 = skinM.onBeforeCompile; skinM.onBeforeCompile = (sh) => { v2(sh); uvShader(sh); }; skinM.customProgramCacheKey = () => "skinV2-ep06uv"; skinM.needsUpdate = true; }
const hazeL = hazeVolume(scene, { at: [0, 0, -7], size: [40, 28, 16], color: "#b9a6ff", n: 5, op: 0.07 });
const bokehL = bokeh(scene, { n: 60, box: [[-14, 14], [-8, 8], [-26, -14]], size: 0.5, color: "#c9b4ff", op: 0.35 });
const grain = look.grain;
const hud = createHud({ camera, shots: FILM.shots });
unifyHud(hudRoot);   // one HUD system (hudv2.js): one plate, one radius, a bar not a dot; mono sources, sans labels
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
const BADGE = {}; for (const b of FILM.badges) BADGE[b.id] = hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
const CTR = {};
for (const c of FILM.counters) {
  const el = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: () => 0, fmt: () => c.text, lit: () => true }); CTR[c.id] = el;
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
  if (c.small) el.querySelector(".v").style.fontSize = c.small;
  if (c.minW) el.style.minWidth = c.minW;
}
// each spine and the note that qualifies it as one card: the note is the card's header row, the spine its body
const cards = [stackAsCard(BADGE["b-units"], CTR["c-uva"]), stackAsCard(BADGE["b-pooled"], CTR["c-rr"])];
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";
const GL = [0.5, 0.385];
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.2, liftAt: GL });   // lifted over the lower dermis, on the right
const gEls = (() => { const svg = hudRoot.querySelector(".ol-gauge"), rects = [...svg.querySelectorAll("rect")], texts = [...svg.querySelectorAll("text")];
  const paperBar = rects.find((r) => r.getAttribute("fill") === "var(--slide-low)"); if (paperBar) paperBar.setAttribute("fill", "#F4F1EA");   // the paper bar in paper white
  return { svg, paperBar, card: rects[1], paperTxt: texts.find((e) => e.textContent === "paper"), paperVal: texts[texts.length - 1] }; })();
const leader = document.createElementNS("http://www.w3.org/2000/svg", "svg");
Object.assign(leader.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: 3 }); leader.setAttribute("viewBox", `0 0 ${W} ${H}`);
leader.innerHTML = `<g fill="none" stroke="#E4D8FF" stroke-width="${2 * S1}" stroke-dasharray="${6 * S1} ${5 * S1}"><path class="a"/><path class="b"/></g><g fill="#E4D8FF"><circle class="ca" r="${4 * S1}"/><circle class="cb" r="${4 * S1}"/></g>`;
hudRoot.appendChild(leader);
const pv = new THREE.Vector3(), toScreen = (p) => { pv.set(...p).project(camera); return [(pv.x + 1) / 2 * W, (1 - pv.y) / 2 * H]; };
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
const scan = document.createElement("div");   // the UV switch: a cyan line sweeping down the frame
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#5FF2E8", boxShadow: "0 0 18px 4px rgba(95,242,232,.55)", opacity: "0", zIndex: 2 });
hudRoot.appendChild(scan);
const tags = FILM.tags.map((g) => { const d = document.createElement("div"); d.textContent = g.text;
  Object.assign(d.style, { position: "absolute", top: `${0.5 * H}px`, [g.side]: `${0.11 * W}px`, fontFamily: "var(--font-mono)", fontSize: "2.9vmin", fontWeight: "500", letterSpacing: ".04em",
    color: "var(--text)", background: "var(--hud-plate)", padding: ".8vmin 1.8vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)", opacity: "0", visibility: "hidden", zIndex: 3 });
  hudRoot.appendChild(d); return { g, d }; });
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

window.SCENE_READY = (async () => {
  await Promise.all(["700 76px 'Red Hat Mono'", "500 50px 'Red Hat Mono'", "600 74px 'Red Hat Text'"].map((f) => document.fonts.load(f).catch(() => null)));
  drawPlate();
  const sec = await new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = SECTION; });
  sec.repeat.set(1, 1);   // the whole photo once; the crop lives in the face's UVs
  faceMat.map = sec; faceMat.needsUpdate = true;
  T.set({ tone: DEEP, furrows: 0.35 }); occlude(); TT.set({ tone: DEEP, furrows: 0.5 });
})();

// the camera: keys {t, pos, look} per shot, eased between
const OFF = { list: 0, list2: 0, bed: XB, uv: XB, section: XC };
const shotCam = (name, t) => {
  const K = FILM.cam[name].keys, x = OFF[name];
  let i = 0; while (i < K.length - 2 && t >= K[i + 1].t) i++;
  const a = K[i], b = K[Math.min(i + 1, K.length - 1)], u = E.inout2(seg(t, a.t, b.t));
  const pos = add(mix3(a.pos, b.pos, u), x), look = add(mix3(a.look, b.look, u), x);
  camera.position.set(...pos); camera.lookAt(...look); return { pos, look };
};
const flicker = (t, [t0, t1]) => {   // a bank going out: two stutters, then the glow decays
  if (t < t0) return 1; const u = seg(t, t0, t1);
  if (u < 0.3) { const f = Math.floor((t - t0) * 24); return [1, 0.25, 0.9, 0.15, 0.7, 0.2, 0.5, 0.1][f % 8]; }
  return 0.35 * Math.exp(-((u - 0.3) / 0.7) * 4.5);
};

window.seek = function (t) {
  const tr = Math.round(t * FILM.fps) / FILM.fps;
  if (stage(t).name !== stage(tr).name) t = tr;   // a motion-blur sample across a cut stays in its own shot
  const shot = stage(t).name, isList = shot === "list" || shot === "list2", isBed = shot === "bed" || shot === "uv";
  const cam = shotCam(shot, t);
  plate.visible = farTubes.visible = hzL1.visible = hzL2.visible = isList;
  T.group.visible = canopy.visible = isBed;
  C.visible = dashes.visible = flashes.visible = shot === "section";
  hazeL.group.visible = bokehL.points.visible = isList; hazeL.set({ t }); bokehL.set({ t });
  shaftL.set({ op: isList ? 0.8 : 0 }); dustL.set(t, isList ? 1 : 0); dustNear.set(t, isList ? 1 : 0);
  dustBed.set(t, isBed ? 1 : 0);
  shaftC.set({ op: shot === "section" ? 1 : 0 }); dustC.set(t, shot === "section" ? 1 : 0);
  scene.fog = shot === "bed" ? FOGB : shot === "uv" ? FOGU : null; housingMat.visible = shot !== "uv";
  bounce.intensity = 0; rimV.intensity = isList ? 2.4 : 0; bankL.intensity = bankR.intensity = 0; coolFill.intensity = 0;
  let endDefocus = E.inout2(seg(t, FILM.endCard - 0.8, FILM.endCard + 0.4));

  // ── the list: rows light on their words; one line wins (the previous ones drop to a third) ──
  if (isList) {
    const L = PL.lit;
    studio.aim([0, 0, 0], [-0.6, 0.75, 0.6], [0.5, -0.2, -0.85]); studio.set({ key: 1.8, rim: 0.6, fill: 0.16, env: 0.55, warm: 0.12 });
    if (shot === "list") {
      const rk = E.inout2(seg(t, FILM.cam.list.rack[0], FILM.cam.list.rack[1]));
      focusPt = mix3(mix3(cam.pos, [0, -0.3, 0], 0.62), [0, -0.3, 0.1], rk); fstop = 0.2;   // frame 0 already mostly sharp; the rack lands on "cigarettes"
      const ranked = fadeIn(t, PL.rank, 0.5);
      LIT.tobacco.opacity = fadeIn(t, L["Tobacco smoking"]) * (1 - 0.6 * ranked); LIT.beds.opacity = fadeIn(t, L["UV-emitting tanning devices"]) * (1 - 0.6 * ranked);
      LIT.meat.opacity = fadeIn(t, L["Processed meat"]) * (1 - 0.6 * ranked); LIT.sun.opacity = 0; LIT.rank.opacity = ranked;
    } else {
      focusPt = mix3([0, -0.3, 0.1], mix3(cam.pos, [0, 0, 0], 0.3), endDefocus); fstop = 0.2 + 0.25 * endDefocus;   // the end card: the plate falls out of focus
      const sun = fadeIn(t, PL.sun, 0.5), re = fadeIn(t, PL.relit, 0.4), rank = fadeIn(t, PL.rank2, 0.5);
      LIT.tobacco.opacity = LIT.beds.opacity = 0.4 + 0.6 * re; LIT.meat.opacity = 0.4 * (1 - 0.3 * re);
      LIT.sun.opacity = sun * (1 - 0.6 * re); LIT.rank.opacity = 0.35 + 0.65 * rank;
    }
  }

  // ── the canopy: the tubes come up violet, flare on "ten", swell on "sun", fall to a third; then the UV camera ──
  let kL = 0, kR = 0;
  if (isBed) {
    driftHairs(t);
    if (shot === "bed") {
      const on = fadeIn(t, FILM.bed.on[0], FILM.bed.on[1] - FILM.bed.on[0]), fl = win(t, FILM.bed.flare[0], FILM.bed.flare[1], 0.25), sw = win(t, FILM.bed.swell[0], FILM.bed.swell[1], 0.35), fall = E.inout2(seg(t, FILM.bed.fall[0], FILM.bed.fall[1]));
      kL = kR = on * (1 + 0.9 * fl + 0.5 * sw) * (1 - 0.45 * fall);
      UV.uUV.value = 0; UV.uL.value = UV.uR.value = 1;
      studio.aim([XB, 0, -2], [-0.85, 0.42, 0.35], [0.4, 0.5, -0.85]); studio.set({ key: 2.4, rim: 1.0, fill: 0.05, env: 0.15, warm: 0.8 }); bounce.intensity = 0.9;   // a low warm key: the terminator across the relief
      const rk = E.inout2(seg(t, FILM.cam.bed.rack[0], FILM.cam.bed.rack[1]));
      const pulse = win(t, CUE.half - 0.15, CUE.half + 0.55, 0.22);   // a rack pulse on "half"
      focusPt = mix3(mix3(mix3([XB, 1.2, -3], [XB, 5.8, -7], fl * 0.4), [XB + 0.8, 6.6, -10], rk), cam.pos, 0.35 * pulse); fstop = 0.22 + 0.14 * rk;
      if (t > CUE.pooled) { const n = Math.sin(t * 37.0) * Math.sin(t * 11.3 + 1.7); kL *= 1 - 0.06 * Math.max(0, n); kR *= 1 - 0.06 * Math.max(0, -n); }   // a faint tube flicker   // the rack onto the tubes: the skin falls away before the risk figures
      rays.forEach((r) => r.set({ op: Math.min(1.2, kL) }));
    } else {
      const uv = E.inout2(seg(t, FILM.uvd.scan[0] + 0.1, FILM.uvd.scan[1]));
      const sw = seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]); scan.style.top = `${(sw * H).toFixed(1)}px`;
      kL = flicker(t, FILM.uvd.australia); kR = flicker(t, FILM.uvd.brazil);
      UV.uUV.value = uv; UV.uL.value = kL; UV.uR.value = kR;
      studio.aim([XB, 0, 0], [-0.6, 0.6, 0.5], [0.5, 0.35, -0.85]); studio.set({ key: 1.6 * (1 - 0.7 * uv), rim: 1.2, fill: 0.05, env: 0.15, warm: 0.8 * (1 - uv) }); bounce.intensity = 0.9 * (1 - uv);
      coolFill.intensity = 0.9 * uv;   // after both banks: a cool fill keeps the shadows at ~10%, pores and furrows still read
      focusPt = mix3(add([0, 0, 2], XB), add([0, 0, -1.5], XB), E.inout2(seg(t, CUT.uv, CUT.section))); fstop = 0.22;
      rays.forEach((r) => r.set({ op: 0 }));
    }
    const bk = shot === "uv" ? 1.0 : 0.45; bankL.intensity = bk * kL + (shot === "uv" ? 0.12 : 0); bankR.intensity = bk * kR + (shot === "uv" ? 0.12 : 0);   // each bank rims across the seam; an afterglow stays
    coreMats[0].color.copy(VIOLET).multiplyScalar(0.06 + 1.6 * kL); coreMats[1].color.copy(VIOLET).multiplyScalar(0.06 + 1.6 * kR);
    glassMats[0].emissive.copy(VIOLET).multiplyScalar(0.12 * kL); glassMats[1].emissive.copy(VIOLET).multiplyScalar(0.12 * kR);
  } else rays.forEach((r) => r.set({ op: 0 }));
  scan.style.opacity = shot === "uv" && seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]) > 0 && seg(t, FILM.uvd.scan[0], FILM.uvd.scan[1]) < 1 ? "1" : "0";
  for (const { g, d } of tags) { const op = shot === "uv" ? win(t, g.t0, g.t1, 0.3) : 0; d.style.opacity = op.toFixed(3); d.style.visibility = op > 0.002 ? "visible" : "hidden"; }

  // ── the cut face: the long rays fall, cross the marked top layer and carry on into the dermis ──
  if (shot === "section") {
    studio.aim([XC, -3, 0], [-0.5, 0.8, 0.45], [0.7, 0.3, -0.7]); studio.set({ key: 1.5, rim: 2.2, fill: 0.3, env: 0.45, warm: 0 });
    focusPt = mix3([XC + 0.4, -2.0, 0], [XC + 0.2, -2.4, 0], E.inout2(seg(t, CUT.section, CUT.list2))); fstop = 0.1;
    const gain = fadeIn(t, FILM.rays.on[0], FILM.rays.on[1] - FILM.rays.on[0]);
    jMat.opacity = 0.75 * fadeIn(t, CUE.through - 0.3, 0.6);
    DASH.forEach((d, i) => {
      const travel = 5.5 - d.stop + 1.4, life = travel / d.sp, u = ((t - CUT.section) / life + d.ph) % 1, y = 5.5 - u * travel;
      const stopped = y < d.stop, yy = Math.max(y, d.stop), fade = stopped ? Math.max(0, 1 - (d.stop - y) / 1.4) : 1;
      dm.position.set(d.x, yy + 0.8, 0); dm.scale.set(1, Math.max(0.001, gain * fade), 1); dm.updateMatrix(); dashes.setMatrixAt(i, dm.matrix);
      const jy = junctionY(d.x), near = Math.exp(-(((yy - jy) / 0.35) ** 2)) * (d.stop < jy ? 1 : 0);   // a soft flash where a dash crosses into the dermis
      dm.position.set(d.x, jy, 0.01); dm.scale.setScalar(Math.max(0.001, gain * near)); dm.updateMatrix(); flashes.setMatrixAt(i, dm.matrix);
    });
    dashes.instanceMatrix.needsUpdate = true; flashes.instanceMatrix.needsUpdate = true;
  }

  // ── to scale: the top layer beside the paper ──
  const lift = shot === "section" ? Math.min(E.inout2(seg(t, G.rise[0], G.rise[1])), 1 - E.inout2(seg(t, G.back[0], G.back[1]))) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: G.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.7)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });

  { const sh = 36 * S1; if (lift > 0.001) { [gEls.paperBar, gEls.paperTxt, gEls.paperVal].forEach((e) => e && e.setAttribute("x", (parseFloat(e.getAttribute("x")) + sh).toFixed(1)));
      if (gEls.card) gEls.card.setAttribute("width", (parseFloat(gEls.card.getAttribute("width")) + sh).toFixed(1)); } }   // two clear columns: the paper's column set further right
  if (shot === "section" && lift > 0.001) {   // leader lines: the gauge's top-layer bar registered to the block's surface and to the traced boundary
    const xs = 0.9, top = toScreen([XC + xs, 0, 0.05]), jun = toScreen([XC + xs, junctionY(xs), 0.05]), gx = GL[0] * W + 80 * S1, gy0 = GL[1] * H, gy1 = gy0 + 0.18 * H;
    leader.querySelector(".a").setAttribute("d", `M${gx} ${gy0}L${top[0]} ${top[1]}`); leader.querySelector(".b").setAttribute("d", `M${gx} ${gy1}L${jun[0]} ${jun[1]}`);
    leader.querySelector(".ca").setAttribute("cx", top[0]); leader.querySelector(".ca").setAttribute("cy", top[1]); leader.querySelector(".cb").setAttribute("cx", jun[0]); leader.querySelector(".cb").setAttribute("cy", jun[1]);
    leader.style.opacity = (lift * fadeIn(t, G.sc - 0.2, 0.5)).toFixed(3);
  } else leader.style.opacity = "0";
  veil.style.opacity = (0.3 * endDefocus).toFixed(4);
  grain.set(t);
  hud.update(t);
  cards.forEach((c) => c());
  const scrim = hudRoot.querySelector(".hud-scrim");
  if (scrim) scrim.style.opacity = (0.45 * E.out3(seg(t, FILM.endCard, FILM.endCard + 0.6))).toFixed(4);   // the end card over the defocused plate, in the same light
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
