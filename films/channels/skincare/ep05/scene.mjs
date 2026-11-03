import * as THREE from "three";
// Skin Sense No. 005, "The sunscreen experiment" (films/channels/skincare/ep05), in the approved look (look test 2,
// 2 Nov; s1v2/BUILD-LOOK2.md). The picture as a pure function of t: window.seek(t) sets the shot, the camera, every
// object and the overlay from t alone, then makes exactly one renderer.render(). Everything timed comes from
// film.json, which compile.py hangs on the voice. One tone (medium) for the whole film.
//
// Three hero places, far apart in one scene:
//   x = 0      the sunscreen macro (as looktest2): one patch of skin, two halves of the same relief clipped at the
//              seam: the left under a thin film of sunscreen, the right bare. The UV switch (a cyan scan line, DOM)
//              turns the screened half dark (it absorbs) and the bare half lilac, its hidden freckles dark (an
//              illustration, not trial data). Also the to-scale shot (the film, grazing) and the loop.
//   x = 500    the silicone cast of the skin's lines: grey, no hairs, raking light; the right half's lines deepen.
//   x = 1000   the dermis block, its cut face the stained micrograph (set/ref), dust in a shaft.
// The model hands (../set/hands05.js) and the town (../set/town05.js) are retired from this episode.
import { stage, seg, E, rng } from "cinema/film/runtime.js";
import { createHud } from "cinema/sci/hud.js";
import { titleBars, endBars, createGauge, injectCss } from "../set/motif.js";
import { createTerrain } from "../set/terrain.js";
import { toneColor } from "../set/section.js";
import { createStudio, skinMaterial, createShaft, createGrain } from "../set/studio.js";
import { lookV2, upgradeSkin, upgradeHairs, hazeVolume, bokeh } from "../set/prod.js";
import { unifyHud, stackAsCard } from "../set/hudv2.js";
import { lookV3, skinV3, hairsV3 } from "../set/look3.js";
import { SECTION } from "../set/ref/textures.js";

const FILM = window.FILM, W = window.W, H = window.H, CUE = FILM.cue, FPS = FILM.fps || 30, G = FILM.gauge, P = FILM.plates;
const MV = FILM.move, UVW = FILM.uv, MC = FILM.macro, RK = FILM.rack;
const S1 = Math.min(W, H) / 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
if (window.CINEMA) Object.assign(window.CINEMA, { kMax: 3, shutter: 0.8, threshold: 0.9, bloom: 0.3, exposure: 1.0, maxCoc: 0.045 });   // a longer shutter: the camera moves read
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 20000);
const studio = createStudio(renderer, scene, {});
let focusPt = [0, 0, 0], fstop = 0;
window.CINEMA_FOCUS = () => ({ point: focusPt, fstop });
injectCss();
const R = rng(11);
const tone = toneColor("living", 0.5);   // bible §1: 005 is the medium tone (the ramp's middle)
const load = (uri, srgb = true) => new Promise((res) => { const img = new Image(); img.onload = () => { const t = new THREE.Texture(img); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; res(t); }; img.src = uri; });

// ── atmosphere: floating particles (soft discs; the depth of field turns them to bokeh) ──
const dotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const k = c.getContext("2d"); const g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const particles = (n, box, size, color) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(g, m); scene.add(p);
  return { p, set(t, op = 1) { p.visible = op > 0.002; if (!p.visible) return; m.opacity = 0.7 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.25 * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + 0.12 * (t % 40) + 0.2 * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + 0.2 * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};

// ── organic textures: soft irregular blobs painted into a canvas over a region of the macro, read as alpha by
// meshes that share the terrain's own geometry (so every film, patch, gap and freckle lies on the relief) ──
const REG = { x0: -16, z0: -24, size: 32 }, CS = 1024;
const regionTex = (cv) => { const t = new THREE.CanvasTexture(cv); const k = 80 / REG.size; t.repeat.set(k, k); t.offset.set(-((REG.x0 + 40) / 80) * k, 1 - ((40 - REG.z0) / 80) * k); return t; };
const toPx = (x, z) => [((x - REG.x0) / REG.size) * CS, ((z - REG.z0) / REG.size) * CS];
const newCanvas = () => { const c = document.createElement("canvas"); c.width = c.height = CS; const k = c.getContext("2d"); k.fillStyle = "#000"; k.fillRect(0, 0, CS, CS); return [c, k]; };
const blob = (k, x, z, r, seed, { a = 1, soft = 0.22, sq = 0.8 } = {}) => {   // an irregular soft-edged shape (harmonics on the radius), r in world units
  const Rb = rng(seed), [px, py] = toPx(x, z), rp = (r / REG.size) * CS, ph = [Rb() * 6.28, Rb() * 6.28, Rb() * 6.28], am = [0.16 + 0.1 * Rb(), 0.1 + 0.08 * Rb(), 0.05 * Rb()];
  k.save(); k.filter = `blur(${(rp * soft).toFixed(1)}px)`; k.globalAlpha = a; k.fillStyle = "#fff"; k.beginPath();
  for (let i = 0; i <= 64; i++) { const th = (i / 64) * 6.2832, rr = rp * (1 + am[0] * Math.sin(2 * th + ph[0]) + am[1] * Math.sin(3 * th + ph[1]) + am[2] * Math.sin(7 * th + ph[2])); const X = px + rr * Math.cos(th), Y = py + sq * rr * Math.sin(th); i ? k.lineTo(X, Y) : k.moveTo(X, Y); }
  k.closePath(); k.fill(); k.restore();
};
const noiseTex = (seed, n = 256, rep = 6) => {   // a broken-up roughness map: the highlight on a film breaks into streaks and pools
  const c = document.createElement("canvas"); c.width = c.height = n; const k = c.getContext("2d"), Rn = rng(seed); k.fillStyle = "#8c8c8c"; k.fillRect(0, 0, n, n);
  for (let i = 0; i < 260; i++) { const x = Rn() * n, y = Rn() * n, r = 4 + Rn() * 22, v = Math.floor(70 + Rn() * 140), g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${v},${v},${v},.55)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); k.fillStyle = g; k.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
};

// ── the UV wipe: the reveal follows the scan line exactly. While the line sweeps, every macro material shows its UV
// state above the line (gl_FragCoord) and its daylight state below it ──
const WU = { uScan: { value: 0 }, uOn: { value: 0 }, uRes: { value: H } };
const wipe = (m, mode, { uv = [0, 0, 0], day = [1, 1, 1], em = [0, 0, 0] } = {}) => {
  const U = { ...WU, uUVCol: { value: new THREE.Vector3(...uv) }, uDay: { value: new THREE.Vector3(...day) }, uEm: { value: new THREE.Vector3(...em) } };
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey() : "";
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(m, sh, r);
    Object.assign(sh.uniforms, U);
    const body = mode === "ratio" ? "diffuseColor.rgb = mix(diffuseColor.rgb, uUVCol * diffuseColor.rgb / max(uDay, vec3(0.001)), wipeA);"
      : mode === "col" ? "diffuseColor.rgb = mix(diffuseColor.rgb, uUVCol, wipeA);" : "if (uOn > 0.5) diffuseColor.a *= wipeA;";
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uScan, uOn, uRes; uniform vec3 uUVCol, uDay, uEm;")
      .replace("#include <color_fragment>", `#include <color_fragment>\n  float wipeA = uOn > 0.5 ? step(1.0 - uScan, gl_FragCoord.y / uRes) : 0.0;\n  ${body}`);
    if (mode !== "alpha") sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += uEm * wipeA;");
  };
  m.customProgramCacheKey = () => `${prevKey}|wipe-${mode}`; m.needsUpdate = true;
  return U;
};

// ── A: the sunscreen macro (x = 0) ──────────────────────────────────────────
// the relief's finer life (episode-local, on top of set/terrain.js): every time the terrain rebuilds its heights, the
// creases are rounded (one smoothing pass) and a second, finer family of furrows, small rounded bumps and deeper,
// bowl-shaped pores are added; the detail field is computed once
const detail = (T, seed) => {
  const geo = T.mesh.geometry, pos = geo.attributes.position, n = Math.round(Math.sqrt(pos.count)), N = n - 1, step = 80 / N;
  const h2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return v - Math.floor(v); };
  const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (h2(i, j) * (1 - u) + h2(i + 1, j) * u) * (1 - v) + (h2(i, j + 1) * (1 - u) + h2(i + 1, j + 1) * u) * v; };
  const D = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const w = 0.5 * vn(x * 0.7, z * 0.7);
    const f1 = Math.abs(Math.sin((x * 0.83 + z * 0.31) * 2.1 + 2.0 * w)), f2 = Math.abs(Math.sin((x * 0.27 - z * 0.92) * 1.9 + 2.2 * w));
    const fine = Math.pow(1 - Math.min(f1, f2), 3);   // a finer crossing family, rounded in profile
    D[i] = -0.07 * fine + 0.07 * (vn(x * 1.3, z * 1.3) - 0.5) + 0.03 * (vn(x * 3.1 + 7, z * 3.1) - 0.5);
    for (const [px, pz] of T.pores) { const r2 = (x - px) ** 2 + (z - pz) ** 2; if (r2 < 0.5) D[i] -= 0.22 * Math.max(0, 1 - r2 / 0.5) ** 2; }   // a deeper, rounded bowl
  }
  const Y = new Float32Array(pos.count), orig = T.set.bind(T);
  T.set = (o) => {
    const v0 = pos.version; orig(o); if (pos.version === v0) return;
    for (let i = 0; i < pos.count; i++) Y[i] = pos.getY(i);
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const i = iz * n + ix, a = Math.max(0, ix - 1), b = Math.min(N, ix + 1), c = Math.max(0, iz - 1), d = Math.min(N, iz + 1);
      const sm = (Y[iz * n + a] + Y[iz * n + b] + Y[c * n + ix] + Y[d * n + ix] + 2 * Y[i]) / 6;   // a rounded crease, not a knife edge
      pos.setY(i, sm + D[i]);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
  };
  return T;
};
const mkHalf = (keepLeft) => {
  const T = detail(createTerrain({ seed: 21, spots: 90, half: "right", segs: 400 }), 3);
  const clip = [new THREE.Plane(new THREE.Vector3(keepLeft ? -1 : 1, 0, 0), 0)];
  const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: keepLeft ? 0.7 : 0.05, hydration: keepLeft ? 0.8 : 0.25, repeat: 14, seed: 6, micro: 0.35 });
  m.roughness = keepLeft ? 0.3 : 0.6; m.clippingPlanes = clip; T.mesh.material = m;
  T.group.traverse((o) => { if (o.isInstancedMesh) o.material = new THREE.MeshPhysicalMaterial({ color: 0x3a2618, roughness: 0.35, clearcoat: 0.6, clippingPlanes: clip }); if (o.isMesh && o !== T.mesh && !o.isInstancedMesh) o.visible = false; });
  T.set({ tone, furrows: 0.35, spot: 0.1 });   // the relief exists from here on (the films, freckles and the seam read it)
  scene.add(T.group); return { T, m, clip };
};
const HL = mkHalf(true), HR = mkHalf(false);
// sebum: a tiny glossy bead in about a third of the pores, catching the key
const sebum = (H2, keepLeft) => {
  const P = H2.T.pores.filter(([x]) => (keepLeft ? x < 0 : x > 0) && Math.abs(x) < 20), Rs = rng(keepLeft ? 61 : 62), pick = P.filter(() => Rs() < 0.35);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xfff1e0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.85, clippingPlanes: H2.clip });
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), mat, pick.length), dm = new THREE.Object3D(), gp = H2.T.mesh.geometry.attributes.position, n = 401;
  pick.forEach(([x, z], i) => { const ix = Math.round((x + 40) / 0.2), iz = Math.round((z + 40) / 0.2), y = gp.getY(iz * n + ix); const r = 0.05 + 0.05 * Rs(); dm.position.set(x, y + r * 0.2, z); dm.scale.set(r, r * 0.45, r); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
  H2.T.group.add(im); return { im, mat };
};
const SEB = [sebum(HL, true), sebum(HR, false)];
const onHalf = (H2, mat, order) => { mat.clippingPlanes = H2.clip; const m = new THREE.Mesh(H2.T.mesh.geometry, mat); m.renderOrder = order; H2.T.group.add(m); return m; };
const layer = (o) => Object.assign(new THREE.MeshPhysicalMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o }));

// the grid of the relief: heights by (ix, iz), for the seam's meniscus and for freckles that lie in the furrows
const SEG = 400, STEP = 80 / SEG, gpos = HL.T.mesh.geometry.attributes.position;
const gy = (ix, iz) => gpos.getY(Math.max(0, Math.min(SEG, iz)) * (SEG + 1) + Math.max(0, Math.min(SEG, ix)));
const crease = (ix, iz) => (gy(ix - 2, iz) + gy(ix + 2, iz) + gy(ix, iz - 2) + gy(ix, iz + 2)) / 4 - gy(ix, iz);
const ixOf = (x) => Math.round((x + 40) / STEP), izOf = (z) => Math.round((z + 40) / STEP);

// the seam: the film's edge, a thin meniscus that catches the rim light
const menPts = []; for (let iz = 0; iz <= SEG; iz += 2) menPts.push(new THREE.Vector3(-0.02, gy(ixOf(0), iz) + 0.018, -40 + iz * STEP));
const menMat = new THREE.MeshPhysicalMaterial({ color: 0xfff6ee, transparent: true, opacity: 0.5, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
menMat.userData.envK = 1.6;
const meniscus = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(menPts), 800, 0.016, 6), menMat); HL.T.group.add(meniscus);

// the morning layer, made visible for the to-scale shot: one continuous satin film on the relief of the screened half
const filmMat = layer({ color: 0xf2efff, opacity: 0, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.38, specularIntensity: 0.2, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.9, 0.88, 1) });   // one broad satin sheen, its highlight rolled off
filmMat.userData.envK = 0.35;
const filmMesh = onHalf(HL, filmMat, 2);

// "whenever they pleased, or not at all" (and the loop's sunscreen mornings on the bare half): thin satin films with
// organic edges and a broken highlight, painted into one alpha canvas
const PATCH = Array.from({ length: 9 }, (_, i) => ({ x: 0.9 + R() * 1.6, z: -10 + i * 1.6 + R() * 0.8, r: 0.55 + R() * 0.5, seed: 40 + i, ph: ((i * 4) % 9) / 9 }));   // near the seam: the portrait frame is narrow
const [patchCv, patchK] = newCanvas(), patchTex = regionTex(patchCv);
let patchKey = "";
const paintPatches = (ops) => {
  const key = ops.map((o) => Math.round(o * 20)).join(","); if (key === patchKey) return; patchKey = key;
  patchK.fillStyle = "#000"; patchK.fillRect(0, 0, CS, CS);
  PATCH.forEach((p, i) => { if (ops[i] > 0.01) { blob(patchK, p.x, p.z, p.r, p.seed, { a: ops[i] }); blob(patchK, p.x + 0.35 * p.r, p.z - 0.25 * p.r, p.r * 0.55, p.seed + 100, { a: ops[i] * 0.6 }); } });
  patchTex.needsUpdate = true;
};
const coatMat = layer({ color: new THREE.Color(...tone.map((v) => v * 1.06)), alphaMap: patchTex, opacity: 0, roughness: 0.3, roughnessMap: noiseTex(9, 256, 12), clearcoat: 1, clearcoatRoughness: 0.12 });
coatMat.userData.envK = 1.2;
const coat = onHalf(HR, coatMat, 3);
// the loop: mornings missed on the screened half: bare, matte gaps in the film
const GAPS = [[-1.1, 0.6, 0.6], [-1.4, -3.2, 0.75], [-0.9, -6.6, 0.55], [-1.6, -9.8, 0.7]];
const [gapCv, gapK] = newCanvas(); GAPS.forEach(([x, z, r], i) => blob(gapK, x, z, r, 70 + i));
const gapMat = layer({ color: new THREE.Color(...tone), alphaMap: regionTex(gapCv), opacity: 0, roughness: 0.85, clearcoat: 0, sheen: 0.3, sheenColor: new THREE.Color(1, 0.75, 0.62) });
const gapMesh = onHalf(HL, gapMat, 3);

// the damage the eye misses (an illustration, not data): freckles with soft, varied edges, lying along the furrows,
// clustered; many on the bare half, few on the screened half (most in its gaps)
const freckles = (k, xr, zr, n, seed, near = null) => {
  const Rf = rng(seed); let placed = 0, tries = 0;
  const centres = Array.from({ length: Math.max(3, Math.round(n / 9)) }, () => near ? near[Math.floor(Rf() * near.length)] : [xr[0] + Rf() * (xr[1] - xr[0]), zr[0] + Rf() * (zr[1] - zr[0]), 2.6]);
  while (placed < n && tries++ < n * 400) {
    const c = centres[Math.floor(Rf() * centres.length)], a = Rf() * 6.28, d = Math.sqrt(Rf()) * c[2];
    const x = c[0] + d * Math.cos(a), z = c[1] + d * Math.sin(a);
    if (x < xr[0] || x > xr[1] || z < zr[0] || z > zr[1]) continue;
    if (crease(ixOf(x), izOf(z)) < 0.006 || gy(ixOf(x), izOf(z)) < -0.35) continue;   // in a furrow, not down a pore
    const r = 0.06 + Rf() * Rf() * 0.3, [px, py] = toPx(x, z), rp = (r / REG.size) * CS;
    for (let j = 0; j < 3; j++) {   // three offset soft dots: an irregular stain, not a stamped ellipse
      const ox = (Rf() - 0.5) * rp, oy = (Rf() - 0.5) * rp, rr = rp * (0.6 + 0.5 * Rf()), g = k.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
      const al = 0.55 + 0.45 * Rf(); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(0.55, `rgba(255,255,255,${al * 0.6})`); g.addColorStop(1, "rgba(255,255,255,0)");
      k.fillStyle = g; k.fillRect(px + ox - rr, py + oy - rr, 2 * rr, 2 * rr);
    }
    placed++;
  }
};
const [dmgRCv, dmgRK] = newCanvas(); freckles(dmgRK, [0.25, 15.5], [-23, 7.5], 520, 3);
const [dmgLCv, dmgLK] = newCanvas(); freckles(dmgLK, [-15.5, -0.25], [-23, 7.5], 70, 4, GAPS.map(([x, z, r]) => [x, z, r * 0.9]).concat([[-8, -3, 3]]));
const dmgMat = new THREE.MeshBasicMaterial({ color: 0x1e0c4a, alphaMap: regionTex(dmgRCv), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const dmgLMat = dmgMat.clone(); dmgLMat.alphaMap = regionTex(dmgLCv);
const dmg = onHalf(HR, dmgMat, 2), dmgL = onHalf(HL, dmgLMat, 4);

// light: a soft shaft far behind the seam, with dust you can see inside it
const SHA = [[-7, 20, -12], [0.8, -0.5, -1.5]];   // in front of the far skin, crossing the seam's middle distance
const shaftA = createShaft({ from: SHA[0], to: SHA[1], radius: 1.8, color: "#E6D6FF" }); scene.add(shaftA.group);
shaftA.group.traverse((o) => { if (o.material) o.material.fog = false; });
const dustA = particles(200, [[-14, 0.3, -12], [14, 9, 8]], 0.08, "#F3E9FF");
const dustShaft = (() => {   // motes inside the shaft's volume, brighter than the room's dust
  const n = 220, pos = new Float32Array(n * 3), base = [], a = new THREE.Vector3(...SHA[0]), b = new THREE.Vector3(...SHA[1]);
  for (let i = 0; i < n; i++) { const u = 0.2 + 0.75 * R(), p = a.clone().lerp(b, u), r = 1.3 * Math.sqrt(R()), th = R() * 6.28; base.push([p.x + r * Math.cos(th), p.y, p.z + r * Math.sin(th), R() * 6.28]); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size: 0.07, color: 0xfff1e6, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const p = new THREE.Points(g, m); scene.add(p);
  return { set(t, op) { p.visible = op > 0.002; m.opacity = 0.9 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + 0.3 * Math.sin(t * 0.25 + ph); pos[3 * i + 1] = y + 0.35 * Math.sin(t * 0.18 + ph * 2); pos[3 * i + 2] = z + 0.3 * Math.cos(t * 0.22 + ph); }); g.attributes.position.needsUpdate = true; } };
})();
const dustNear = particles(70, [[-3, 3.5, 9], [3.5, 8, 17]], 0.045, "#FFF4EA");   // near the lens: the hook racks from these to the seam
const FOGA = new THREE.Fog(0x2c1660, 22, 60);

// ── K: the silicone cast of the skin's lines (x = 500) ───────────────────────
const XK = 500;
const K = detail(createTerrain({ seed: 21, spots: 0, hair: false, segs: 360 }), 5);
K.group.position.x = XK; scene.add(K.group);
{ const m = skinMaterial({ tone: [1, 1, 1], vertexColors: true, oil: 0.05, hydration: 0.1, micro: 1.3, repeat: 11, seed: 4 });   // the fine crosshatch of skin lines (two crossing families), caught by the raking light
  K.mesh.material = m; }
const bounce = new THREE.DirectionalLight(0xd8d4e6, 0); bounce.position.set(XK + 30, 6, 20); bounce.target.position.set(XK, 0, 0); scene.add(bounce, bounce.target);   // the cast's bounce card
K.group.traverse((o) => { if (o.isMesh && o !== K.mesh) o.visible = false; });
const CASTC = [0.5, 0.52, 0.56];   // grey silicone
const shaftK = createShaft({ from: [XK - 14, 12, -6], to: [XK + 2, -1, 1], radius: 3.0, color: "#D9E4FF" }); scene.add(shaftK.group);
const dustK = particles(220, [[XK - 12, 0.3, -10], [XK + 12, 8, 8]], 0.08, "#EEF2FF");
const FOGK = new THREE.Fog(0x1b1430, 26, 70);

// ── B: the dermis block, its cut face the stained micrograph (x = 1000) ─────
const XB = 1000, Bk = new THREE.Group(); Bk.position.x = XB; scene.add(Bk);
const faceMat = new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.2, sheenColor: new THREE.Color(1, 0.85, 0.9) });
const face = new THREE.Mesh(new THREE.PlaneGeometry(16, 10.5), faceMat); face.position.set(0, -5.25, 0); Bk.add(face);
const sideMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.78, 0.5, 0.55), roughness: 0.55 });
const blockSide = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 6), [sideMat, sideMat, skinMaterial({ tone: tone.map((v) => v * 1.1), oil: 0.1, repeat: 3, seed: 9, micro: 0.5 }), sideMat, sideMat, sideMat]);
blockSide.position.set(0, -5.25, -3.01); Bk.add(blockSide);
// a cover glass over the cut face: a thin slab that catches a glint as the camera moves
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, metalness: 0, depthWrite: false, specularIntensity: 1 });
glassMat.userData.envK = 2.2;
const glass = new THREE.Mesh(new THREE.BoxGeometry(15.2, 9.8, 0.08), glassMat); glass.position.set(0.2, -5.4, 0.12); Bk.add(glass);
// the glint: a soft streak of light across the cover glass that slides as the camera moves
const glintTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 16; const k = c.getContext("2d"), g = k.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 256, 16); return new THREE.CanvasTexture(c); })();
const glint = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 14), new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
glint.rotation.z = -0.5; glint.position.set(0, -5.4, 0.18); Bk.add(glint);
// the blocks sit in a lit volume (prod.js): haze the key reads through, far bokeh behind
const hzB = hazeVolume(scene, { at: [XB, -4, -10], size: [60, 40, 14], color: "#c9b6ff", n: 5, op: 0.05 });
const bkB = bokeh(scene, { n: 120, box: [[XB - 40, XB + 40], [-30, 20], [-60, -25]], size: 1.6, color: "#d9ccff", op: 0.3 });
const hzK = hazeVolume(scene, { at: [XK, 3, -30], size: [90, 30, 20], color: "#b9c4ff", n: 4, op: 0.04 });
const shaftB = createShaft({ from: [-6, 18, -4], to: [1, -6, 1], radius: 2.8, color: "#C9B4FF" }); shaftB.group.position.x = XB; scene.add(shaftB.group);
const dustB = particles(320, [[XB - 9, -11, 0.5], [XB + 9, 6, 9]], 0.07, "#FFF2F8");

window.SCENE_READY = Promise.all([load(SECTION)]).then(([sec]) => { sec.repeat.set(1, 0.84); faceMat.map = sec; faceMat.needsUpdate = true; });   // the section's cornified top row (a fishnet at this scale) is cropped; the block's own skin is its top

// ── the overlay ─────────────────────────────────────────────────────────────
const hudRoot = document.getElementById("hud");
const prodLook = lookV3({ canvas, hudRoot, fog: FOGA, terrain: HL.T, skin: HL.m, grain: 0.007 });   // the channel look v3 (look3.js): skin, hairs, fog, backdrop, grade, grain
skinV3(HR.m); hairsV3(HR.T);
for (const H2 of [HL, HR]) H2.T.group.traverse((o) => { if (o.isInstancedMesh) { o.material.clippingPlanes = H2.clip; o.material.needsUpdate = true; } });   // each half keeps only its own hairs
upgradeSkin(K.mesh.material, { edge: [0.82, 0.85, 0.95], edgeK: 0.22 });   // silicone: soft sheen, a slight translucent edge, no transmission
Object.assign(K.mesh.material, { roughness: 0.55, sheen: 0.35, specularIntensity: 0.35 }); K.mesh.material.sheenColor.setRGB(0.86, 0.9, 1.0);
FOGK.color.set(0x1a0d36);
// the horizon melts: the macro's fog matched to the backdrop where the skin meets it, and close enough that the
// relief's far edge is gone before the frame's top
FOGA.color.set(0x24124c); FOGA.near = 12; FOGA.far = 40;
// the screened half differs in sheen, not colour: a glossier clearcoat
Object.assign(HL.m, { clearcoat: 0.85, clearcoatRoughness: 0.1, roughness: 0.38 });
// the UV wipe on every macro material
wipe(gapMat, "col", { uv: [0.71, 0.55, 1.15], em: [0.05, 0.03, 0.14] });
const wHL = wipe(HL.m, "ratio", { uv: [0.12, 0.08, 0.26], day: tone }), wHR = wipe(HR.m, "ratio", { uv: [0.62, 0.48, 1.0], day: tone, em: [0.03, 0.02, 0.09] });
wipe(coatMat, "col", { uv: [0.07, 0.05, 0.16] });
wipe(dmgMat, "alpha"); wipe(dmgLMat, "alpha");
const grain = prodLook.grain;   // look3: fine soft-light grain with a real black point
const hud = createHud({ camera, shots: FILM.shots });
unifyHud(hudRoot);   // one HUD system (hudv2.js): one plate, one radius, a bar not a dot; mono sources, sans labels
const labelAt = { L: [-2.2, 0.4, -1], R: [2.2, 0.4, -1] };   // a point on each half, set per shot in seek()
const KIND = { water: { color: "water", glyph: "◇" }, uv: { color: "uv", glyph: "◆" } };
hud.captions(FILM.captions);
const titleEl = hud.title(FILM.title);
const tBars = titleBars(titleEl, { t0: 0, sig: FILM.title.sig });
for (const b of FILM.badges) {
  const el = b.segs   // a run: one badge whose text rolls over at the scan line (touching segments)
    ? hud.badge(b.id, { kind: "tag", slot: b.slot, from: { badges: b.segs.map(([text, t0], i) => ({ text, t0, t1: i + 1 < b.segs.length ? b.segs[i + 1][1] : b.t1 })) } })
    : hud.badge(b.id, { text: b.text, t0: b.t0, t1: b.t1, slot: b.slot });
  if (b.slot[0] === "b") el.style.marginTop = `${(-14 * S1).toFixed(1)}px`;   // a bottom badge keeps ≥ 24 px (1080 units) above the caption
}
const CTR = {};
for (const c of FILM.counters) {
  const roll = c.roll, el = CTR[c.id] = hud.counter(c.id, { label: c.label, t0: c.t0, t1: c.t1, at: c.at, value: (t) => (roll ? roll[0] + (roll[1] - roll[0]) * E.inout2(seg(t, roll[2], roll[3])) : 0), fmt: (v) => (roll ? `${Math.round(v)}` : c.text), lit: () => true });
  Object.assign(el.style, { background: "var(--hud-plate)", padding: "1.1vmin 2.6vmin 1.3vmin", borderRadius: "var(--hud-cap-radius, 2.4vmin)", boxShadow: "var(--hud-shadow)" });
}
for (const L of FILM.labels) {
  const k = KIND[L.kind];
  const anchor = L.at ? { at: () => labelAt[L.at] } : { screen: () => [L.screen[0] * W, L.screen[1] * H] };
  hud.label(L.id, { text: L.text, glyph: k.glyph, mark: L.at ? "dot" : "none", color: k.color, ...anchor, t0: L.t0, t1: L.t1, side: L.side, v: L.at ? "above" : "middle", fixed: true });
}
const endEl = hud.end({ t0: FILM.endCard, ...FILM.end });
const foot = endEl.querySelector(".nx");
if (foot) Object.assign(foot.style, { fontSize: "2.9vmin", color: "var(--text-2)", fontWeight: "500", maxWidth: "68vmin", margin: "2.6vmin auto 0" });
const eBars = endBars(endEl, { t0: FILM.endCard, d: 0.8 });
endEl.style.transform = "translateY(-22vmin)";
const gauge = createGauge({ root: hudRoot, W, H, S1, safe: hud.safe, liftK: 1.5, liftAt: [0.18, 0.3] });
for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "dead layer") el.textContent = G.bar;
for (const el of document.querySelectorAll(".ol-gauge rect")) if (el.getAttribute("fill") === "var(--slide-low)") el.setAttribute("fill", "#F3EEE4");   // the paper bar reads as paper
// the UV switch: a cyan line sweeping down the frame (looktest2)
const scan = document.createElement("div");
Object.assign(scan.style, { position: "absolute", left: 0, right: 0, height: `${0.004 * H}px`, background: "#E8FFFD", boxShadow: "0 0 10px 3px rgba(95,242,232,.95), 0 0 40px 14px rgba(95,242,232,.45), 0 -60px 90px 10px rgba(95,242,232,.12)", opacity: "0", zIndex: 2, pointerEvents: "none" });
hudRoot.appendChild(scan);
const plate = (html, css) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  Object.assign(el.style, { position: "absolute", zIndex: "4", pointerEvents: "none", background: "var(--hud-plate)", boxShadow: "var(--hud-shadow)", borderRadius: "var(--ol-r, 1.4vmin)",
    color: "var(--text)", opacity: "0", visibility: "hidden", ...css });
  hudRoot.appendChild(el); return el;
};
const show = (el, op) => { el.style.opacity = op.toFixed(3); el.style.visibility = op > 0.002 ? "visible" : "hidden"; };
const O = P.odds, M = P.mel;
const odds = plate(`<div style="font:600 4.6vmin/1.25 var(--font-body, inherit)">${O.text}</div><div style="font:500 2.9vmin/1.3 var(--font-mono);color:var(--text-2);margin-top:1vmin">${O.sub}</div>`,
  { left: "45.8%", top: `${0.36 * H}px`, transform: "translateX(-50%)", width: "64vmin", padding: "2.2vmin 3vmin" });
const dots = (n, c) => Array.from({ length: n }, () => `<i style="display:inline-block;width:1.3vmin;height:1.3vmin;border-radius:50%;margin:.15vmin;background:${c};opacity:0"></i>`).join("");
const mel = plate(`<div style="font:500 2.6vmin/1 var(--font-mono);color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin:0 0 1.4vmin">melanomas, ten years on</div>
  <div style="display:grid;grid-template-columns:21vmin 1fr;white-space:nowrap;align-items:center;gap:1.4vmin;font:600 3vmin/1.2 var(--font-body, inherit)"><span>daily</span><span class="d1">${dots(M.n[0], "var(--water)")}</span>
  <span>as they pleased</span><span class="d2">${dots(M.n[1], "var(--uv)")}</span></div>
  <div class="sub" style="opacity:0"><div style="font:650 5vmin/1.2 var(--font-body, inherit);color:var(--text);margin-top:1.8vmin">${M.note}</div>
  <div style="font:500 2.7vmin/1.35 var(--font-mono);color:var(--text-2);margin-top:0.8vmin">${M.sub}</div></div>`,
  { left: "45.8%", top: `${0.3 * H}px`, transform: "translateX(-50%)", width: "64vmin", padding: "2.4vmin 3vmin" });
const cards = [stackAsCard(CTR["c-age"], odds), stackAsCard(CTR["c-follow"], mel)];   // the spines as the plates' header rows
const melRows = mel.children[1], melHead = mel.children[0];
const msub = mel.querySelector(".sub"), d1 = [...mel.querySelectorAll(".d1 i")], d2 = [...mel.querySelectorAll(".d2 i")];
const veil = document.createElement("div");
Object.assign(veil.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none", opacity: "0", background: "var(--slide)" });
hudRoot.prepend(veil);

const fadeIn = (t, t0, d = 0.4) => E.out3(seg(t, t0, t0 + d));
const win = (t, t0, t1, d = 0.35) => Math.max(0, Math.min(fadeIn(t, t0, d), 1 - fadeIn(t, t1 - d, d)));
const u01 = (t, [a, b]) => E.inout2(seg(t, a, b));
const look = (pos, tgt) => { camera.position.set(...pos); camera.lookAt(...tgt); };
const mix3 = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const mixT = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const UVBARE = [0.62, 0.48, 1.0], UVSCREEN = [0.12, 0.08, 0.26], WARM = [0.8, 0.2, 0.15];
const MACRO = ["hook", "seam", "pleased", "uv", "film", "loop"];
const glide = (t, [a, b]) => { const x = seg(t, a, b); return 0.55 * x + 0.45 * E.inout2(x); };   // a move that keeps moving through the holds

window.seek = function (t) {
  const tr = Math.round(t * FPS) / FPS;
  if (stage(t).name !== stage(tr).name) t = tr;
  const shot = stage(t).name, mv = MV[shot], u = glide(t, mv);
  const isA = MACRO.includes(shot), isK = shot === "cast", isB = shot === "micro";
  HL.T.group.visible = HR.T.group.visible = isA; K.group.visible = isK; Bk.visible = isB;
  const day = isA && !(shot === "uv" && t > UVW.uv[0]) && !(shot === "loop" && t > UVW.loop[0]);
  const shaftOn = ["hook", "seam", "loop"].includes(shot);
  shaftA.set({ op: isA ? (shaftOn ? (day ? 1.0 : 0.45) : 0.35) : 0 }); shaftK.set({ op: isK ? 0.6 : 0 }); shaftB.set({ op: isB ? 0.8 : 0 });
  dustA.set(t, isA && shot !== "film" ? 0.6 : 0); dustShaft.set(t, isA ? (shaftOn ? 1 : 0.4) * (shot === "film" ? 0 : 1) : 0); SEB.forEach((b) => (b.im.visible = isA && shot !== "film")); dustNear.set(t, shot === "hook" || shot === "loop" ? 1 : 0); dustK.set(t, isK ? 0.7 : 0); dustB.set(t, isB ? 1 : 0);
  hzB.group.visible = bkB.points.visible = isB; hzK.group.visible = isK; hzB.set({ t }); hzK.set({ t }); bkB.set({ t });
  scene.fog = isA ? FOGA : isK ? FOGK : null;
  bounce.intensity = isK ? 0.55 : 0;

  // ── the macro: daylight, or the UV view; while the scan sweeps, the view changes exactly at the line ──
  let sw = -1;
  if (shot === "uv" || shot === "loop") sw = seg(t, ...UVW[shot]);
  const sweeping = sw > 0 && sw < 1, uv = sw >= 1 ? 1 : 0;
  WU.uOn.value = sweeping ? 1 : 0; WU.uScan.value = Math.max(0, sw);
  scan.style.top = `${(Math.max(0, sw) * H).toFixed(1)}px`; scan.style.opacity = sweeping ? "1" : "0";
  if (isA) {
    const flush = shot === "uv" ? 1.0 * u01(t, MC.flush) * (1 - uv) : 0;
    const base = mixT(tone, WARM, 0.55 * flush);
    const spotUV = uv * u01(t, [UVW[shot] ? UVW[shot][1] : 0, (UVW[shot] ? UVW[shot][1] : 0) + 0.6]);   // the bare half's spots develop after the line has passed
    HR.T.set({ tone: uv ? UVBARE : base, furrows: 0.35, spot: 0.1 + 0.9 * spotUV });
    HL.T.set({ tone: uv ? UVSCREEN : tone, furrows: 0.35, spot: 0.1 * (1 - uv) });
    wHR.uDay.value.set(...base);
    HR.m.emissive.setRGB(0.03 * uv, 0.02 * uv, 0.09 * uv); HL.m.emissive.setRGB(0, 0, 0);
    const dk = shot === "uv" ? u01(t, MC.dmg) : shot === "loop" ? u01(t, [UVW.loop[0] + 0.3, UVW.loop[1] + 0.3]) : 0;
    dmgMat.opacity = 0.85 * dk * (sweeping || uv ? 1 : 0); dmg.visible = dmgMat.opacity > 0.01;
    dmgLMat.opacity = shot === "loop" ? dmgMat.opacity : 0; dmgL.visible = dmgLMat.opacity > 0.01;
    filmMat.opacity = shot === "film" ? 0.42 * u01(t, MC.film) : 0; filmMesh.visible = filmMat.opacity > 0.005;
    HL.m.clearcoat = shot === "film" ? 0.1 : 0.85; HL.m.normalScale.setScalar(shot === "film" ? 0.05 : 0.19);   // under the film: no glitter from the micro relief   // under the film the highlights roll off instead of clipping
    menMat.opacity = uv ? 0.1 : 0.22;
    const mixed = shot === "loop" ? u01(t, MC.mixed) : 0;   // "Both groups missed mornings": gaps in the film, sunscreen on the bare half
    gapMat.opacity = mixed; gapMesh.visible = mixed > 0.005;
    gapMat.color.setRGB(...(uv ? UVBARE.map((v) => v * 1.15) : tone.map((v) => v * 0.82)));   // bare, matte and a shade deeper by day; glowing under UV gapMat.emissive.setRGB(0.05 * uv, 0.03 * uv, 0.14 * uv);
    const ops = PATCH.map((p) => { const [a, b] = MC.patches, s0 = a + p.ph * (b - a) * 0.8; return shot === "pleased" ? win(t, s0, s0 + 1.6 + 0.8 * ((p.ph * 7) % 1), 0.4) : mixed; });
    paintPatches(ops); coatMat.opacity = ops.some((o) => o > 0.01) ? 1 : 0; coat.visible = coatMat.opacity > 0;
    coatMat.color.setRGB(...(uv ? [0.07, 0.05, 0.16] : tone.map((v) => v + (0.95 - v) * 0.45)));   // a pale satin sheet by day; dark (it absorbs) under UV
    const lt = sweeping ? sw : uv;
    const keyK = shot === "pleased" ? 1.0 : shot === "film" ? 0.6 : 1.4;
    studio.set({ key: keyK * (1 - 0.6 * lt), rim: shot === "film" ? 0.7 : 2.2, fill: 0.3, env: shot === "film" ? 0.18 : 0.4, warm: 0.5 * (1 - lt) + 0.3 * flush });
  } else { dmg.visible = dmgL.visible = filmMesh.visible = coat.visible = gapMesh.visible = false; WU.uOn.value = 0; }

  if (shot === "hook" || shot === "loop") {   // the hook (and its loop): one push you can see, over the seam
    const uu = shot === "loop" ? 0.1 + 0.6 * u : u;
    look(mix3([0.6, 9.4, 20], [0.15, 2.8, 6.6], uu), mix3([0, 0, 2.5], [0.3, -0.2, 0], uu));
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    const rk = shot === "hook" ? u01(t, RK.hook) : 1;   // frame 0: the near dust sharp, the skin still reading; on "aged", the rack to the seam
    const near = camera.position.toArray().map((v, i) => v + [0.1, -1.4, -5.5][i]);
    focusPt = mix3(near, mix3([0, 0, 2], [0.3, 0, -0.5], uu), rk); fstop = 0.08 + 0.2 * rk;
    labelAt.L = [-2.4, 0.4, -1.0]; labelAt.R = [2.4, 0.4, -1.0];
  } else if (shot === "seam") {   // a long crane down and along the seam, into the light
    look(mix3([-5.5, 9.5, 17], [1.8, 3.6, 8.5], u), mix3([-0.5, 0, 0], [0.3, -0.2, -1], u));
    labelAt.L = [-2.6, 0.4, -2]; labelAt.R = [2.6, 0.4, -2];
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([0, 0, 2], [0.3, 0, 0], u); fstop = 0.28;
  } else if (shot === "pleased") {   // close over the bare half, the seam at the left third
    look(mix3([1.6, 4.2, 9.4], [1.2, 3.2, 6.4], u), mix3([0.6, 0, 0.5], [0.7, -0.1, -1], u));
    labelAt.L = [-1.3, 0.4, -1.5]; labelAt.R = [2.6, 0.4, -1.5];
    studio.aim([2, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([1.4, 0.2, 2.0], [1.2, 0.2, 0], u); fstop = 0.26;
  } else if (shot === "uv") {   // one slow push over the seam; the switch on "But"
    look(mix3([0.6, 6.2, 16], [0.2, 3.4, 7.5], u), mix3([0, 0, 1], [0.4, -0.2, -0.5], u));
    studio.aim([0, 0, 0], [-0.5, 0.75, 0.6], [0.5, 0.3, -0.85]);
    focusPt = mix3([0, 0, 2], [0.4, 0, -0.5], u); fstop = 0.28;
  } else if (shot === "film") {   // low over the screened half: the film reads as one satin layer, its highlights rolled off
    look(mix3([-6.0, 4.2, 9.5], [-4.4, 3.0, 6.4], u), mix3([-1.6, -0.2, 0.5], [-1.2, -0.2, -0.5], u));
    studio.aim([-2, 0, -2], [-0.6, 0.7, 0.4], [0.5, 0.3, -0.85]);
    focusPt = mix3([-3.4, 0.3, 1.4], [-2.6, 0.3, -0.2], u); fstop = 0.16;
  }

  // ── the cast: grey silicone, one hard raking key and a bounce; the right half's lines deepen over the shot ──
  if (isK) {
    const age = u01(t, MC.age), fq = Math.round((0.5 + 1.0 * age) * 40) / 40;   // quantized: the relief rebuilds only when it visibly changes
    K.set({ tone: CASTC, furrows: fq, spot: 0, sheen: 0 });
    look(mix3([XK - 0.6, 9.0, 7.0], [XK + 0.4, 6.4, 4.6], u), mix3([XK - 0.3, 0, -0.8], [XK + 0.3, -0.2, -1.6], u));   // high enough that both families of lines read as diamonds
    studio.aim([XK, 0, 0], [0.04, 0.09, 1.0], [0.6, 0.35, -0.75]);   // the key rakes from the front, at 45° to both families of lines: diamonds, not grain studio.set({ key: 1.7, rim: 0.4, fill: 0.08, env: 0.12, warm: 0.0 });
    focusPt = mix3([XK - 0.2, 0, 0.2], [XK + 0.3, 0, -1.0], u); fstop = 0.08;
  }

  // ── the micrograph: a slow push and drift across the cut face (parallax on the block's edge, a glint on the glass) ──
  if (isB) {
    look(mix3([XB - 13, 2.6, 15], [XB + 2.4, -2.0, 8.8], u), mix3([XB - 3.5, -4.0, 0], [XB + 2.4, -4.6, 0], u));   // from an oblique view of the block's edge and top round to the face   // the naevus nest (lower left of the section) stays off centre
    studio.aim([XB, -4, 0], [-0.45, 0.8, 0.55], [0.55, 0.35, -0.85]); studio.set({ key: 1.6, rim: 2.6, fill: 0.45, env: 0.5, warm: 0.2 });
    glint.position.x = -9 + 16 * u; glint.material.opacity = 0.16 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
    const rk = u01(t, RK.micro);   // rack on "Melanoma": the dust in front, then the cut face
    focusPt = mix3([XB - 0.6, -2.2, 7.5], [XB + 1.8, -4.4, 0], rk); fstop = 0.1;
  }

  // ── plates ──
  show(odds, shot === "cast" ? win(t, O.t0, O.t1) : 0);
  show(mel, shot === "micro" ? win(t, M.t0, M.t1) : 0);
  d1.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d1.length) * (M.half - M.mel), 0.15).toFixed(3); });
  d2.forEach((e, i) => { e.style.opacity = fadeIn(t, M.mel + (i / d2.length) * (M.half - M.mel), 0.15).toFixed(3); });
  msub.style.opacity = fadeIn(t, M.small - 0.2, 0.4).toFixed(3);
  msub.style.display = t >= M.small - 0.2 ? "" : "none"; melRows.style.display = melHead.style.display = t >= M.mel - 0.3 ? "" : "none";   // the plate grows as its rows arrive

  // ── to scale: the test dose's film beside the paper ──
  const lift = shot === "film" ? Math.min(u01(t, G.rise), 1 - u01(t, G.back)) : 0;
  gauge.update(t, { top: 0.2 * H, bottom: 0.5 * H, um: 100, op: lift, lift: 1, sc: G.sc_um, paperUm: G.paper_um, scText: G.sc_text,
    fillSc: E.out3(seg(t, G.sc - 0.1, G.sc + 0.9)), fillPaper: E.out3(seg(t, G.paper - 0.1, G.paper + 1.1)) });
  for (const el of document.querySelectorAll(".ol-gauge text")) if (el.textContent === "paper" || el.textContent === G.bar) el.setAttribute("opacity", lift.toFixed(3));

  veil.style.opacity = (0.75 * E.inout2(seg(t, FILM.endCard - 0.6, FILM.endCard))).toFixed(4);
  grain.set(t);
  hud.update(t);
  cards.forEach((c) => c());
  if (window.DBG) { gapMat.color.setRGB(0, 1, 0); gapMat.emissive.setRGB(0, 1, 0); gapMat.opacity = 1; gapMesh.visible = true; dmgMat.opacity = 1; dmg.visible = true; dmgMat.color.setRGB(1, 0, 0); }
  tBars.update(t);
  eBars.update(t);
  renderer.render(scene, camera);
};
