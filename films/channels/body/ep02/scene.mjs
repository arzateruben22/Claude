// Meanwhile, Inside No. 02, "A billion passengers": the picture, a pure function of t.
//
// The channel's set (films/channels/body/set) plus this episode's staging. Everything timed comes from
// film.json (compile.py hangs it on the spoken words); the look comes from theme.json.
//
// Five slides, each its own place and scale, joined by the membrane iris (only one is visible at a time):
//   cell   (µm)          the hero red cell cut open along its axis; its cut face packed with hemoglobin, drawn
//                        hugely oversized (badged); one O₂ boarding on frame 0; the seated O₂ sparkle on "billion"
//   hb     (1 = 0.5 nm)  one hemoglobin (set/hemoglobin.js); four O₂ board, each sooner than the last; each
//                        unit warms as its O₂ boards and the whole molecule flushes crimson on "bright"
//   skin   (1 = 50 µm)   a block of skin cut open over a vein; from above, the vein reads bluish; in the section,
//                        blue light scatters back near the surface, red light sinks to the vein and is swallowed,
//                        red beside the vein comes back out (an illustration, badged)
//   lung   (µm)          an air sac with a capillary across its face, shown 12× slower; dark cells arrive, flush
//                        crimson over the air sac (0.25 s of lung time) and leave bright; O₂ crosses into the hero
//   nerve  (µm)          a myelinated fibre (set/neuron.js): the signal jumps from gap to gap (the tease)
import * as THREE from "three";
import { stage, shotAt, seg, E, hash, rng, presence, keyed } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { clock } from "cinema/sci/clock.js";
import { path, instance } from "cinema/sci/path.js";
import { swarm } from "cinema/sci/swarm.js";
import { cutaway } from "cinema/sci/cutaway.js";
import { placeCamera, focusAt } from "cinema/keys.js";
import { look } from "../set/look.js";
import { R as RC, rbcGeometry, rbcRadial, cellMaterial, foldFor, halfThick } from "../set/rbc.js";
import { lining, vessel } from "../set/vessel.js";
import { beatAmp, pulseLine, iris, locator, MOTIF_CSS } from "../set/motif.js";
import { probe } from "../set/probe.js";
import { hemoglobin, hbGeometry, o2Geometry } from "../set/hemoglobin.js";
import { fibre } from "../set/neuron.js";

const FILM = window.FILM, W = window.W, H = window.H, THEME = window.THEME || { tokens: {} };
const S1 = Math.min(W, H) / 1080;
const SHOTS = FILM.shots;
const shotOf = (t) => shotAt(t, SHOTS).name;
const SHOT = Object.fromEntries(SHOTS.map((s, i) => [s.name, { at: s.at, end: SHOTS[i + 1] ? SHOTS[i + 1].at : FILM.dur }]));

// ── renderer, camera, look ───────────────────────────────────────────────────────────────────────
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, W / H, 0.5, 4000);
const L = look(THREE, { tokens: THEME.tokens, scene: FILM.look, W, H, backdropRadius: 2500 });
scene.add(L.lights, L.backdrop);
scene.fog = L.fog;
if (window.CINEMA) Object.assign(window.CINEMA, { threshold: 1.25, bloom: 0.45, maxCoc: 0.024 });
const css = document.createElement("style"); css.textContent = MOTIF_CSS + `
#hud-quarter .v { color: var(--pulse); }
#hud-quarter, #hud-tally { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-quarter .lb, #hud-tally .lb { color: var(--text); }
#hud-tally .v { font-size: 9.6vmin; }
.hud-end .mi-pulse { margin: 0 0 3vmin; }
.hud-title .mi-pulse { margin-top: 2.2vmin; }
.mi-fact { margin-top: 3.2vmin; max-width: 70vmin; font: 500 3vmin/1.35 var(--font-text); color: var(--text-2); }
#hud-seats .v, #hud-aboard .v, #hud-venous .v, #hud-full .v, #hud-quarter .v { color: var(--pulse); }
#hud-seats, #hud-aboard, #hud-venous, #hud-full { background: var(--hud-plate); padding: 1.6vmin 3.2vmin 1.4vmin; border-radius: var(--hud-cap-radius, 3vmin); }
#hud-seats .lb, #hud-aboard .lb, #hud-venous .lb, #hud-full .lb { color: var(--text); }
#hud-seats .v { font-size: 8.4vmin; }
`; document.head.appendChild(css);
const lin = (h) => L.lin(h);
const SLIDE = (sh) => (sh === "loop" ? "cell" : sh);   // the loop shot is frame 0's composition again
const G = { cell: new THREE.Group(), hb: new THREE.Group(), skin: new THREE.Group(), lung: new THREE.Group(), nerve: new THREE.Group() };
for (const g of Object.values(G)) scene.add(g);
const clk = clock(FILM.clock, { words: { slow: "{n}× slower" } });

// ════ the cell ════════════════════════════════════════════════════════════════════════════════════
// the hero, cut open along its axis (its biconcave section faces the lens), a little tilted toward us
const heroMat = cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: FILM.look["rbc-deep"], instanced: false, fresnel: 0.26 });
const capMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#B23A52"), emissive: lin("#8E2A3F"), emissiveIntensity: 0.1, roughness: 0.6, side: THREE.DoubleSide }), { fresnel: 0.05, key: "cap" });
{
  const prev = capMat.onBeforeCompile, mem = lin("#F6A3B0");
  capMat.onBeforeCompile = (sh, r) => {
    prev(sh, r); sh.uniforms.uMem = { value: mem };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float capEdge; varying float vEdge;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvEdge = capEdge;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uMem; varying float vEdge;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uMem, smoothstep(0.935, 0.975, vEdge));");
  };
}
const HC = cutaway({ radial: rbcRadial, segments: [112, 84], capSegments: 200, material: heroMat, capMaterial: capMat });
HC.group.rotation.set(-0.32, 0.18, 0);
G.cell.add(HC.group);
HC.set({ cut: { n: [0, 0, 1], d: 0 } });
G.cell.updateMatrixWorld(true); HC.update();
// the hemoglobin crowd on the cut face (oversized: 0.34 µm across, against a real 5.5 nm), in the cut's plane
const HBR = 0.17, hbMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#E06A7E"), vertexColors: true, roughness: 0.5, emissive: lin("#E5334F"), emissiveIntensity: 0.08 }), { fresnel: 0.25, key: "hbcrowd" });
const CROWD = [];
{
  const r = rng(29);
  for (let tries = 0; tries < 20000 && CROWD.length < 150; tries++) {
    const x = (2 * r() - 1) * RC * 0.93, h = halfThick(Math.abs(x)) * 0.86, y = (2 * r() - 1) * h;
    if (Math.abs(y) > h - HBR * 0.5) continue;
    if (CROWD.some((c) => Math.hypot(c.p[0] - x, c.p[1] - y) < HBR * 1.85)) continue;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6.28, r() * 6.28, r() * 6.28));
    CROWD.push({ p: [x, y, 0.07 + 0.05 * r()], q, tone: 0.8 + 0.25 * r() });
  }
}
const crowd = new THREE.InstancedMesh(hbGeometry(THREE, { detail: 1 }), hbMat, CROWD.length);
const mS = new THREE.Matrix4(), vS = new THREE.Vector3(), qS = new THREE.Quaternion();
CROWD.forEach((c, i) => { mS.compose(vS.set(...c.p), c.q, new THREE.Vector3(1, 1, 1).multiplyScalar(HBR / 5.5)); crowd.setMatrixAt(i, mS); crowd.setColorAt(i, new THREE.Color(c.tone, c.tone, c.tone)); });
HC.group.add(crowd);
// the seated O₂ ("passengers"): four on each hemoglobin, at its seats, shown from "billion"
const SEATS = [[2.3, 1.55, 0], [-2.3, 1.55, 0], [0, -1.55, 2.3], [0, -1.55, -2.3]].map((c) => { const l = Math.hypot(...c); return c.map((x) => (x / l) * 5.4); });
const o2Mat = L.patch(new THREE.MeshStandardMaterial({ color: lin(THEME.tokens.o2 || "#FFFFFF"), emissive: lin("#FFFFFF"), emissiveIntensity: 0.4, roughness: 0.35 }), { fresnel: 0.1, key: "o2" });
const pax = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), o2Mat, CROWD.length * 4);
pax.instanceMatrix.setUsage(THREE.DynamicDrawUsage); pax.frustumCulled = false;
HC.group.add(pax);
const paxAt = (i, k) => { const s = vS.set(...SEATS[k]).applyQuaternion(CROWD[i].q).multiplyScalar(HBR / 5.5); return [CROWD[i].p[0] + s.x, CROWD[i].p[1] + s.y, CROWD[i].p[2] + s.z]; };
// the hemoglobin the label names: in from the right edge, near the middle
const HBLIT = (() => { let b = 0, bd = Infinity; CROWD.forEach((c, i) => { const d = Math.hypot(c.p[0] - RC * 0.38, c.p[1] - 0.15); if (d < bd) { bd = d; b = i; } }); return b; })();
// the hook's boarding O₂: from just outside the cut face toward a free seat on a hemoglobin near the right rim
const HOOKHB = (() => { let b = 0, bd = Infinity; CROWD.forEach((c, i) => { const d = Math.hypot(c.p[0] - RC * 0.72, c.p[1] - 0.25); if (d < bd) { bd = d; b = i; } }); return b; })();
const hookO2 = new THREE.Mesh(o2Geometry(THREE, { r: 1 }), o2Mat); HC.group.add(hookO2);
const hookSeat = paxAt(HOOKHB, 0), hookFrom = [hookSeat[0] + 1.35, hookSeat[1] + 1.05, hookSeat[2] + 0.9];
const hookP = (t) => { const u = E.out3(keyed(FILM.cell.o2, t, (x) => x)); return hookFrom.map((x, i) => x + (hookSeat[i] - x) * u); };
const writeCell = (t) => {
  const sp = FILM.cell.sparkle, on = seg(t, sp[0] - 0.05, sp[0] + 0.45), glow = on * (1 - 0.6 * seg(t, sp[1], sp[1] + 0.8));
  let k = 0;
  for (let i = 0; i < CROWD.length; i++) for (let s = 0; s < 4; s++) {
    const d = hash(i * 4 + s + 300), sc = HBR * 0.2 * E.out3(seg(on, d * 0.5, d * 0.5 + 0.5)) * (i === HOOKHB && s === 0 ? 0 : 1);
    instance(pax, k++, paxAt(i, s), null, sc);
  }
  pax.instanceMatrix.needsUpdate = true;
  o2Mat.emissiveIntensity = 0.4 + 1.2 * glow * (0.75 + 0.25 * Math.sin(t * 11));
  const lit = seg(t, FILM.cell.hbLit, FILM.cell.hbLit + 0.4) * (1 - seg(t, SHOT.hb.at - 0.4, SHOT.hb.at));
  const c = CROWD[HBLIT].tone * (1 + 0.55 * lit); crowd.setColorAt(HBLIT, new THREE.Color(c, c * (1 + 0.1 * lit), c * (1 + 0.1 * lit))); crowd.instanceColor.needsUpdate = true;
  const p = hookP(t); hookO2.position.set(...p); hookO2.scale.setScalar(HBR * 0.2);
  hookO2.quaternion.setFromEuler(new THREE.Euler(0.4, 0.9 + 0.3 * t, 0.2));
};
const cellWorld = (p) => HC.group.localToWorld(new THREE.Vector3(...p)).toArray();

// ════ one hemoglobin ═════════════════════════════════════════════════════════════════════════════
const HB = hemoglobin(THREE, L, { seed: 4, garnet: "#5A1828", crimson: FILM.look.rbc });
G.hb.add(HB.group);
HB.group.rotation.set(0.25, -0.5, 0.05);
const boarders = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(o2Geometry(THREE, { r: 0.6 }), o2Mat); G.hb.add(m); return m; });
// where each O₂ waits (out along its seat's normal, spread so all four are in frame) and its ease to the seat
const WAIT = [[13, 10, 5], [-13, 9, 3], [10, -12, 7], [-11, -11, 6]];
const FREE = swarm({ n: 10, seed: 41, home: (i, r) => { const a = 6.283 * r(), z = 2 * r() - 1, q = Math.sqrt(1 - z * z), rr = 12 + 6 * r(); return [q * Math.cos(a) * rr, z * rr * 0.9, Math.min(10, q * Math.sin(a) * rr)]; }, waves: [{ amp: 1.4, omega: 0.7 }, { amp: 0.5, omega: 1.9 }] });
const freeMesh = FREE.mesh(o2Geometry(THREE, { r: 0.6 }), o2Mat); G.hb.add(freeMesh);
const vB = new THREE.Vector3();
const boarderP = (i, t) => {
  const b = FILM.hb.board[i], d = FILM.hb.approach[i], seat = HB.seat(i);
  const w = WAIT[i].map((x, k) => x + 0.9 * Math.sin(0.8 * t + i * 1.7 + k));
  const u = E.inout3(seg(t, b - d, b));
  return w.map((x, k) => x + (seat[k] - x) * u);
};
const writeHb = (t) => {
  const F = FILM.hb, B4 = F.board;
  const flush = E.inout2(seg(t, F.flush[0], F.flush[1]));
  const load = B4.map((b) => Math.max(0.22 * E.out3(seg(t, b - 0.05, b + 0.45)), flush));
  HB.set({ load, shift: E.inout3(seg(t, F.shift[0], F.shift[1])) });
  const show = E.out3(seg(t, F.free, F.free + 0.6));
  boarders.forEach((m, i) => {
    const p = boarderP(i, t), arrived = seg(t, B4[i] - 0.25, B4[i]);
    m.position.set(...p); m.scale.setScalar(show);
    const n = HB.irons[i].getWorldPosition(new THREE.Vector3()).sub(HB.group.getWorldPosition(new THREE.Vector3())).normalize();
    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 * t + i, 0.5 * t + 2 * i, 0.3 * i));
    const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), n);
    m.quaternion.copy(qa).slerp(qb, arrived);
  });
  FREE.write(freeMesh, t, { scale: (i) => show * (0.8 + 0.2 * hash(i)) * (1 - E.in3(seg(t, F.flush[1] + 2.5, F.flush[1] + 4))), spin: 0.6 });
  const g = FILM.hb.glint, gl = seg(t, g[0] - 0.05, g[0] + 0.3) * (1 - seg(t, g[1], g[1] + 0.8));
  HB.irons.forEach((m) => { m.material.emissiveIntensity = 0.6 + 2.4 * gl; });
};

// ════ skin over a vein (1 unit = 50 µm) ═════════════════════════════════════════════════════════════
const SK = { w: 160, d: 90, z: 40, veinY: -24, veinR: 8 };
{
  // the top surface: skin tone, with the vein's bluish band above it and a fine mottle (a canvas texture)
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  const cx = cv.getContext("2d"), img = cx.createImageData(512, 256), r = rng(7);
  const skin = [228, 190, 170], blue = [118, 140, 190];
  const mott = Array.from({ length: 64 }, () => [r() * 512, r() * 256, 6 + 18 * r(), r() - 0.5]);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const wx = (x / 512 - 0.5) * SK.w, band = Math.exp(-(wx * wx) / (2 * 5.5 * 5.5)) * 0.8;
    let m = 0; for (const [a, b, s, v] of mott) m += v * Math.exp(-((x - a) ** 2 + (y - b) ** 2) / (2 * s * s));
    const i = (y * 512 + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, skin[k] + (blue[k] - skin[k]) * band + 14 * m));
    img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 1;
  const top = new THREE.Mesh(new THREE.PlaneGeometry(SK.w, SK.z * 2), L.patch(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), { fresnel: 0.15, key: "skintop" }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.01; G.skin.add(top);
  const layer = (y0, y1, col, emi = 0.06) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(SK.w, y1 - y0, SK.z * 2), L.patch(new THREE.MeshStandardMaterial({ color: lin(col), emissive: lin(col), emissiveIntensity: emi, roughness: 0.8 }), { fresnel: 0.2, key: "skin" + col }));
    m.position.set(0, (y0 + y1) / 2, 0); G.skin.add(m); return m;
  };
  layer(-2.2, 0, "#F0CDBE", 0.1);            // epidermis
  layer(-SK.d, -2.2, "#D99A8C");             // dermis and below
  // the vein: its wall and its dark blood, through the block; its end shows in the cut face
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(SK.veinR + 1.1, SK.veinR + 1.1, SK.z * 2 + 0.2, 64), L.patch(new THREE.MeshStandardMaterial({ color: lin(FILM.look.vessel || "#E9B3A8"), roughness: 0.6 }), { fresnel: 0.2, key: "veinwall" }));
  wall.rotation.x = Math.PI / 2; wall.position.set(0, SK.veinY, 0.05); G.skin.add(wall);
  const blood = new THREE.Mesh(new THREE.CylinderGeometry(SK.veinR, SK.veinR, SK.z * 2 + 0.4, 64), L.patch(new THREE.MeshStandardMaterial({ color: lin("#5E1626"), emissive: lin("#7A2234"), emissiveIntensity: 0.18, roughness: 0.4 }), { fresnel: 0.1, key: "venous" }));
  blood.rotation.x = Math.PI / 2; blood.position.set(0, SK.veinY, 0.1); G.skin.add(blood);
}
// the rays, in the plane just in front of the cut face: polylines drawn on, with a soft head
const rayMat = (hex) => L.patch(new THREE.MeshStandardMaterial({ color: lin(hex), emissive: lin(hex), emissiveIntensity: 1.1, roughness: 0.4, transparent: true }), { fresnel: 0, key: "ray" + hex });
const ZR = SK.z + 0.8;
const ray = (pts, hex, r = 0.7) => {
  const cp = new THREE.CurvePath(); for (let i = 1; i < pts.length; i++) cp.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1][0], pts[i - 1][1], ZR), new THREE.Vector3(pts[i][0], pts[i][1], ZR)));
  const N = 240, RS = 10, geo = new THREE.TubeGeometry(cp, N, r, RS, false), mat = rayMat(hex), mesh = new THREE.Mesh(geo, mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.1, r * 4.5, 18), mat); G.skin.add(mesh, head);
  const set = (u, fade = 1) => {
    geo.setDrawRange(0, Math.round(u * N) * RS * 6);
    mesh.visible = u > 0.002 && fade > 0.01; head.visible = mesh.visible && u < 0.999;
    const a = cp.getPointAt(Math.min(0.999, u)), b = cp.getPointAt(Math.min(1, u + 0.001));
    head.position.copy(a); head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    mat.opacity = fade; mat.emissiveIntensity = 1.1 * fade;
  };
  return { set, at: (u) => cp.getPointAt(Math.min(1, Math.max(0, u))).toArray() };
};
const RAYS = {
  blue: [ray([[-15, 22], [-15, -3.5], [-12.5, -1.5], [-11, -4.2], [-8, 22]], "#7FB0FF"), ray([[-21, 22], [-20.5, -2.8], [-19, -4.6], [-17, 22]], "#7FB0FF")],
  red: ray([[-1, 22], [-1, SK.veinY + SK.veinR + 0.6]], "#FF5A6E"),
  back: ray([[12, 22], [12, -27], [14, -30.5], [16.5, -25], [17.5, 22]], "#FF5A6E"),
};
const writeSkin = (t) => {
  const S = FILM.skin;
  const ub = E.inout2(seg(t, S.blue[0], S.blue[1])); RAYS.blue.forEach((r, i) => r.set(E.inout2(seg(t, S.blue[0] + 0.25 * i, S.blue[1] + 0.25 * i))));
  const ur = E.in2(seg(t, S.red[0], S.red[1])); RAYS.red.set(ur, 1 - 0.85 * E.out3(seg(t, S.swallow, S.swallow + 0.7)));
  RAYS.back.set(E.inout2(seg(t, S.back[0], S.back[1])));
  return ub;
};

// ════ the lung: an air sac and its capillary (µm), shown 12× slower ════════════════════════════════
const sacMat = L.patch(new THREE.MeshStandardMaterial({ color: lin("#D9A9A3"), emissive: lin("#F0C9B8"), emissiveIntensity: 0.05, roughness: 0.8 }), { fresnel: 0.5, fresnelPower: 2.0, key: "sac" });
const SACS = [];
{
  const r = rng(13);
  const add = (c, R, sq = 0.42) => { const C = cutaway({ radius: R, noise: { amp: 0.07, freq: 1.5, seed: 3 + SACS.length }, segments: [72, 48], material: sacMat }); C.group.position.set(...c); C.group.scale.set(1, 1, sq); G.lung.add(C.group); SACS.push({ c, R, g: C.group }); };
  add([0, 0, -24], 58);                                   // the hero's air sac, its face just behind the capillary
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.283 + 0.4, d = 118 + 14 * r(); add([Math.cos(a) * d, Math.sin(a) * d * 1.15, -40 - 30 * r()], 46 + 14 * r(), 0.5); }
}
const PL = path([[-150, -120, 0], [-80, -66, 0], [-40, -30, 0], [0, -4, 0], [40, 22, 0], [80, 60, 0], [150, 120, 0]], { up: [0, 0, 1] });
const capR = 4.0, CAPV = vessel(THREE, L, PL, { radius: capR, wall: 0.5, tex: lining(THREE, { seed: 5 }), radial: 22, step: 2.5 });
G.lung.add(CAPV.group);
const sF0 = PL.nearest([-40, -30, 0]), sF1 = sF0 + 60;      // the contact: the seats fill over 0.25 s at 240 µm/s
const V = 240, GAPS = 14;                                   // µm/s of lung time; µm between cells
const NC = Math.ceil(PL.length / GAPS);
const lungGeo = rbcGeometry(THREE, { around: 22, along: 18 });
const aFold = new THREE.InstancedBufferAttribute(new Float32Array(NC * 2), 2); aFold.setUsage(THREE.DynamicDrawUsage); lungGeo.setAttribute("aFold", aFold);
const lungCells = new THREE.InstancedMesh(lungGeo, cellMaterial(THREE, L, { rbc: FILM.look.rbc, deep: FILM.look["rbc-deep"] }), NC);
lungCells.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lungCells.frustumCulled = false; G.lung.add(lungCells);
for (let i = 0; i < NC; i++) lungCells.setColorAt(i, new THREE.Color(1, 1, 1));   // the colour attribute exists before the first compile
const FK = foldFor(capR).k;
const tauF0 = clk.tau(FILM.lung.flush[0]);
const s0 = sF0 - V * tauF0;                               // the hero (slot 0) stands at sF0 when the seats start filling
const heroLS = (tau) => s0 + V * tau;
const cellS = (i, tau) => { const s = heroLS(tau) - i * GAPS; return ((s % PL.length) + PL.length) % PL.length; };
const oxyAt = (s) => E.inout2(seg(s, sF0, sF1));
const DEOXY = new THREE.Color(0.24, 0.42, 0.55), cTmp = new THREE.Color();
const qL = new THREE.Quaternion(), vY = new THREE.Vector3(0, 1, 0), vT = new THREE.Vector3();
const LCELL = new Array(NC);
const writeLung = (t) => {
  const tau = clk.tau(t);
  for (let i = 0; i < NC; i++) {
    const s = cellS(i, tau), p = PL.at(s), tg = PL.tangent(s), edge = Math.min(1, s / 10, (PL.length - s) / 10);
    qL.setFromUnitVectors(vY, vT.set(...tg));
    instance(lungCells, i, p, qL, Math.max(0, edge)); aFold.setXY(i, FK, 1);
    lungCells.setColorAt(i, cTmp.copy(DEOXY).lerp(new THREE.Color(1, 1, 1), oxyAt(s)));
    LCELL[i] = { p, wrap: edge < 1 };
  }
  lungCells.instanceMatrix.needsUpdate = true; lungCells.instanceColor.needsUpdate = true; aFold.needsUpdate = true;
};
// O₂ from the air sac into the hero while its seats fill (oversized, badged)
const LO2 = swarm({ n: 60, seed: 17, home: (i, r) => [(r() - 0.5) * 40, (r() - 0.5) * 30, -8 - 6 * r()], waves: [{ amp: 0.8, omega: 1.3 }] });
const lungO2 = LO2.mesh(new THREE.IcosahedronGeometry(1, 1), o2Mat); G.lung.add(lungO2);
const writeLungO2 = (t) => {
  const [a, b] = FILM.lung.o2, hp = PL.at(heroLS(clk.tau(t)));
  for (let i = 0; i < LO2.n; i++) {
    const d0 = a + (b - a - 1.0) * hash(i + 50), u = E.inout2(seg(t, d0, d0 + 1.0)), h = LO2.at(i, t);
    const home = [hp[0] + h[0] * 0.6, hp[1] + h[1] * 0.6, h[2]], p = home.map((x, k) => x + (hp[k] - x) * u);
    instance(lungO2, i, p, null, 0.55 * seg(t, d0 - 0.4, d0) * (1 - seg(u, 0.85, 1)));
  }
  lungO2.instanceMatrix.needsUpdate = true;
};

// ════ the nerve (the tease) ══════════════════════════════════════════════════════════════════════
const NF = fibre(THREE, L, { length: 420, axonR: 1.2, myelin: { r: 3.6, internode: 40, node: 2.5 } });
NF.group.position.set(0, 0, 0); G.nerve.add(NF.group);
const NERVE_NODES = NF.nodes;
const nerveHop = (FILM.nerve.jump - FILM.nerve.t0) / 3;
const nerveK0 = (() => { let k = 0; for (let i = 0; i < NERVE_NODES.length; i++) if (NERVE_NODES[i] <= 140) k = i; return Math.max(0, k - 3); })();
const nerveFront = (t) => { if (t < FILM.nerve.t0) return -1; const k = nerveK0 + Math.floor((t - FILM.nerve.t0) / nerveHop + 1e-6); return NERVE_NODES[Math.min(NERVE_NODES.length - 1, k)]; };
// a few neighbouring fibres, dark, for depth
for (const [y, z, a] of [[-14, -22, 0.08], [12, -34, -0.05], [-26, -48, 0.12]]) { const F = fibre(THREE, L, { length: 420, axonR: 0.9, myelin: { r: 2.8, internode: 36, node: 2 } }); F.group.position.set(-10, y, z); F.group.rotation.z = a; G.nerve.add(F.group); }

// ════ the overlay ════════════════════════════════════════════════════════════════════════════════
const hud = createHud({ camera });
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tPulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(70 * S1), at: 0.3 });
titleEl.appendChild(tPulse.el);
const lungP = (s) => PL.at(s);
const ANCH = {
  o2hook: (t) => cellWorld(hookP(t)),
  hblit: () => cellWorld(CROWD[HBLIT].p),
  iron0: () => HB.ironWorld(0),
  o2first: (t) => boarderP(0, t),
  veintop: () => [0, 0.5, 6],
  vein: () => [SK.veinR + 1.2, SK.veinY + 3, SK.z],
  redray: (t) => RAYS.red.at(0.55),
  blueray: (t) => RAYS.blue[0].at(0.62),
  sac: () => [36, -26, 0.42 * 58 - 24 + 1],
  incoming: (t) => lungP(Math.max(10, sF0 - 30)),
  outgoing: (t) => lungP(Math.min(PL.length - 10, sF1 + 25)),
  node: (t) => NF.at(NERVE_NODES[nerveK0 + 3], 1.5),
};
for (const lb of FILM.labels) hud.label(lb.id, { text: lb.text, glyph: lb.glyph, mark: lb.mark, color: lb.color, at: (t) => ANCH[lb.at](t), t0: lb.t0, t1: lb.t1, shot: lb.shot, side: lb.side });
hud.badge("warp", { from: clk, slot: "tl" });
// rule 8: the speed column top left, the standing cheats top right (at most two notes per corner)
for (const b of FILM.badges) hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot || "tr" });
const Q = FILM.quarter;
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
for (const sp of FILM.spine) {
  const value = sp.steps ? (t) => sp.steps.filter((b) => t >= b).length : sp.keys ? null : () => sp.value;
  hud.counter(sp.id, { ...(sp.keys ? { keys: sp.keys, ease: "lin" } : { value }), fmt: commas, unit: sp.unit, label: sp.label, t0: sp.t0, t1: sp.t1, at: [0.5, 0.235], minCh: 2 });
}
hud.counter("quarter", { keys: Q.keys, fmt: (v) => v.toFixed(2), unit: Q.unit, label: Q.label, t0: Q.t0, t1: Q.t1, at: [0.5, 0.235], minCh: 4, ease: "lin" });
const tallyEl = hud.counter("tally", { value: (t) => FILM.tally.rate * t, fmt: (v) => String(Math.round(v)), unit: FILM.tally.unit, label: FILM.tally.label, t0: FILM.tally.t0, t1: FILM.tally.t1, at: [0.458, 0.29], minCh: 3 });
const yPulse = pulseLine({ width: Math.round(560 * S1), height: Math.round(58 * S1), at: 0.5 });
tallyEl.appendChild(yPulse.el);
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
{ const fact = document.createElement("div"); fact.className = "mi-fact"; fact.textContent = FILM.end.fact; endEl.appendChild(fact); }
const ePulse = pulseLine({ width: Math.round(810 * S1), height: Math.round(64 * S1), at: 0.25 });
endEl.insertBefore(ePulse.el, endEl.firstChild);
const IR = iris(document.querySelector(".stage"), { events: FILM.iris });
const LOC = locator(document.getElementById("hud"), { x: 92 * S1, y: 430 * S1, h: 232 * S1, region: [0.42, 0.26] });
const LOCARM = locator(document.getElementById("hud"), { x: 92 * S1, y: 430 * S1, h: 232 * S1, region: [0.83, 0.5] });   // the skin: a forearm
const ARM_T = [SHOT.skin.at + 0.4, FILM.skin.section[0]];
const lubs = (t0, t1) => { const out = []; for (let k = Math.ceil(t0 / 0.8); k * 0.8 <= t1; k++) out.push(+(k * 0.8).toFixed(4)); return out; };
const LOC_T = [FILM.labels.find((l) => l.id === "sac").t0 - 0.3, FILM.labels.find((l) => l.id === "sac").t1];
const LOC_BEATS = lubs(LOC_T[0], LOC_T[1]);

// ── focus ───────────────────────────────────────────────────────────────────────────────────────
const TARGETS = {
  cap: () => cellWorld([0.6, 0, 0.1]), hblit: () => cellWorld(CROWD[HBLIT].p),
  hb: () => HB.centre(), seat0: (t) => HB.seat(0),
  surface: () => [0, 0, 0], vein: () => [0, SK.veinY, SK.z],
  sac: () => [0, 0, -4], hero: (t) => PL.at(heroLS(clk.tau(t))),
  front: (t) => NF.at(Math.max(0, nerveFront(t))),
};
window.CINEMA_FOCUS = (t) => focusAt(FILM.foc[shotOf(t)] || FILM.foc.cell, t, { targets: TARGETS });

// ── the probe: per slide, in its own units ─────────────────────────────────────────────────────
const PR = { cell: probe(THREE, { W, H, near: 3, ndc: 1.15 }), hb: probe(THREE, { W, H, near: 6, ndc: 1.15 }), skin: probe(THREE, { W, H, near: 20, ndc: 1.15 }),
  lung: probe(THREE, { W, H, near: 12, ndc: 1.15 }), nerve: probe(THREE, { W, H, near: 15, ndc: 1.15 }) };
const STATIC = { cell: [], hb: [], skin: [], lung: [], nerve: [] };
for (let i = 0; i < CROWD.length; i += 3) STATIC.cell.push(() => cellWorld(CROWD[i].p));
for (let k = 0; k < 4; k++) STATIC.hb.push(() => HB.ironWorld(k));
for (const p of [[-30, 20, -30], [30, -20, 30], [0, 0, 0], [20, 15, -20], [-20, -15, 20]]) STATIC.hb.push(() => HB.group.localToWorld(new THREE.Vector3(...p).multiplyScalar(0.2)).toArray());
for (let x = -60; x <= 60; x += 20) for (let y = -50; y <= 0; y += 10) STATIC.skin.push(() => [x, y, SK.z]);
for (let x = -60; x <= 60; x += 20) STATIC.skin.push(() => [x, 0, 0]);
for (let s = 0; s <= PL.length; s += 15) { const p = PL.at(s); STATIC.lung.push(() => [p[0], p[1], p[2] - capR]); }
for (const S of SACS) STATIC.lung.push(() => [S.c[0], S.c[1], S.c[2] + S.R * 0.42]);
for (let x = 0; x <= 420; x += 12) STATIC.nerve.push(() => [x, 0, 0]);
const probeAll = (t, sh) => {
  const P = PR[sh]; P.begin(camera);
  STATIC[sh].forEach((f, i) => P.add(`s${i}`, f()));
  if (sh === "cell") P.add("o2", cellWorld(hookP(t)));
  if (sh === "hb") { for (let i = 0; i < 4; i++) P.add(`b${i}`, boarderP(i, t)); for (let i = 0; i < FREE.n; i++) P.add(`f${i}`, FREE.at(i, t)); }
  if (sh === "lung") { for (let i = 0; i < NC; i++) if (!LCELL[i].wrap) P.add(`c${i}`, LCELL[i].p); for (let i = 0; i < LO2.n; i += 2) P.add(`o${i}`, LO2.at(i, t)); }
};

let TIER_KMAX = null;
// ── seek ────────────────────────────────────────────────────────────────────────────────────────
window.seek = function (t) {
  stage(t);
  const shot = shotOf(t), sh = SLIDE(shot), C = window.CINEMA;
  for (const [k, g] of Object.entries(G)) g.visible = k === sh;
  const heroP = PL.at(heroLS(clk.tau(t)));
  placeCamera(camera, FILM.cam[shot], t, { track: () => heroP, handheld: 0 });
  camera.near = sh === "cell" ? 0.2 : 0.5; camera.far = 4000; camera.updateProjectionMatrix();
  if (sh === "cell") writeCell(shot === "loop" ? 0 : t);
  if (sh === "hb") writeHb(t);
  if (sh === "skin") writeSkin(t);
  if (sh === "lung") { writeLung(t); writeLungO2(t); }
  if (sh === "nerve") NF.set({ front: nerveFront(t), mode: "jump", tail: 55 });
  const F = window.CINEMA_FOCUS(t), fd = Math.hypot(F.point[0] - camera.position.x, F.point[1] - camera.position.y, F.point[2] - camera.position.z);
  L.place(camera, F.point);
  scene.fog.density = 0.25 / Math.max(4, fd);
  hud.update(t);
  tPulse.update(beatAmp(t, [FILM.title.sig, FILM.title.sig + 0.4], { rest: 0.5 }));
  yPulse.update(beatAmp(t, FILM.segBeats));
  ePulse.update(beatAmp(t, [FILM.endCard, FILM.endCard + 0.4], { flat: FILM.endCard + 1.2, rest: 0.6 }));
  LOC.update(t, sh === "lung" ? presence(t, LOC_T[0], LOC_T[1], { d: 0.45, out: 0.35 }).o : 0, beatAmp(t, LOC_BEATS));
  LOCARM.update(t, sh === "skin" ? presence(t, ARM_T[0], ARM_T[1], { d: 0.45, out: 0.35 }).o : 0, beatAmp(t, lubs(ARM_T[0], ARM_T[1])));
  IR.update(t);
  if (C && C.mode === "probe") {
    if (TIER_KMAX == null) TIER_KMAX = C.kMax;
    C.kMax = Math.min(TIER_KMAX, 12);
    probeAll(t, sh);
    scene.visible = false; renderer.render(scene, camera); scene.visible = true;
    return;
  }
  renderer.render(scene, camera);
};
window.SCENE_READY = Promise.resolve();
