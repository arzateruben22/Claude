// goose3d.js — Skin Sense S2 E1 ("Why goosebumps happen") as a real three.js scene in the owner's art: ivory ground,
// peach and rose tissue, amber hair, gold nerve, soft studio light. One continuous world the camera flies through:
//   a field of fine hairs on a skin surface (lying, then standing) · a block of skin cut open at its front edge (the
//   section) with a follicle, an arrector muscle and a nerve that really move · the stem cells at the bulge (mice).
// The owner's paintings are used as the hero shots (a layered painting, parallaxed in 3-D, dissolving into its 3-D twin)
// and as the colour source. create() returns { seek(t), anchor(name, t) }: the engine (ss3.mjs) keeps the overlay.
// Units: 1 = 1 mm of an illustrated section (simplified, badged). Everything is a pure function of t.
import * as THREE from "three";

const D2R = Math.PI / 180, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a)), sm = (x) => x * x * (3 - 2 * x), eo = (x) => 1 - Math.pow(1 - x, 3), eio = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k, mix3 = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const IVORY = 0xf7efe3;

export async function create({ W, H, u, AW, BH, BTOP, artbox, R, EP, loadImage }) {
  const T = EP.three || {};
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(AW, BH, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const cv = renderer.domElement; cv.style.cssText = `position:absolute;left:0;top:0;width:${AW}px;height:${BH}px`; artbox.appendChild(cv);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(IVORY); scene.fog = new THREE.Fog(IVORY, 70, 170);
  const camera = new THREE.PerspectiveCamera(30, AW / BH, 0.1, 200);

  // ── light: an ivory studio (soft environment, warm key, cool-white rim) ──────────────────────────────
  { const es = new THREE.Scene(); es.background = new THREE.Color(0xf3e9db);
    const box = (w, h, c, k, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); es.add(m); };
    box(8, 5, 0xfff4e6, 5, [-7, 8, 7]); box(3, 9, 0xeef4ff, 3, [9, 3, -6]); box(14, 3, 0xf6d8c4, 1.6, [0, -7, 3]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; scene.environmentIntensity = 0.4; }
  const key = new THREE.DirectionalLight(0xffeedd, 2.1); key.position.set(-9, 14, 12); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 }); key.shadow.bias = -0.0006; key.shadow.radius = 5; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xfff6ea, 1.5); rim.position.set(8, 5, -14); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0xe9b9a2, 0.55));

  // ── procedural tissue textures in the painting's colours ──────────────────────────────────────────────
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const tex = (c, rep = [1, 1]) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t; };
  const fibres = (g, w, h, n, cols, len, wd, vertical = 0.0) => { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, L = len * (0.4 + rnd()), a = (rnd() - 0.5) * 0.9 + (vertical ? Math.PI / 2 : 0), c = cols[(rnd() * cols.length) | 0];
    g.strokeStyle = c; g.lineWidth = wd * (0.5 + rnd()); g.globalAlpha = 0.14 + rnd() * 0.22; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + Math.cos(a) * L * 0.3, y + Math.sin(a) * L * 0.3 + (rnd() - 0.5) * 40, x + Math.cos(a) * L * 0.7, y + Math.sin(a) * L * 0.7 + (rnd() - 0.5) * 40, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); } g.globalAlpha = 1; };
  // the cut face: rose-peach dermis, a lighter epidermis band on top, butter-yellow fat below (Y from 0 at the top to 1 at the bottom)
  const faceC = mkCanvas(1024, 512), fg = faceC.getContext("2d");
  { const gr = fg.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#f7e1d0"); gr.addColorStop(0.045, "#f4d3c0"); gr.addColorStop(0.07, "#e0907f"); gr.addColorStop(0.4, "#e5857a"); gr.addColorStop(0.72, "#ea9e8a"); gr.addColorStop(0.76, "#f1c27c"); gr.addColorStop(1, "#ecc562");
    fg.fillStyle = gr; fg.fillRect(0, 0, 1024, 512);
    fg.save(); fg.beginPath(); fg.rect(0, 36, 1024, 340); fg.clip(); fibres(fg, 1024, 512, 520, ["#fbd9c8", "#d9705f", "#f6bfa9", "#c9604f"], 240, 2.4); fibres(fg, 1024, 512, 90, ["#fde8dc"], 120, 5); fg.restore();
    fg.fillStyle = "rgba(255,246,236,.3)"; fg.fillRect(0, 0, 1024, 20);
    fg.save(); fg.beginPath(); fg.rect(0, 392, 1024, 120); fg.clip();   // the fat: loose cells
    for (let i = 0; i < 260; i++) { const x = rnd() * 1024, y = 384 + rnd() * 128, r = 12 + rnd() * 16; fg.strokeStyle = "rgba(226,160,60,.55)"; fg.fillStyle = `rgba(250,${215 + rnd() * 25 | 0},${120 + rnd() * 50 | 0},.5)`; fg.lineWidth = 2; fg.beginPath(); fg.ellipse(x, y, r, r * 0.85, 0, 0, 7); fg.fill(); fg.stroke(); } fg.restore(); }
  const topC = mkCanvas(512, 512), tg = topC.getContext("2d");   // the skin surface: warm peach, fine lines and pores
  { tg.fillStyle = "#cf8567"; tg.fillRect(0, 0, 512, 512); for (let i = 0; i < 70; i++) { tg.fillStyle = `rgba(${200 + rnd() * 40 | 0},${130 + rnd() * 40 | 0},${100 + rnd() * 30 | 0},.07)`; tg.beginPath(); tg.arc(rnd() * 512, rnd() * 512, 20 + rnd() * 50, 0, 7); tg.fill(); }
    tg.lineWidth = 1.2; for (let i = 0; i < 420; i++) { tg.strokeStyle = `rgba(150,80,60,${0.05 + rnd() * 0.08})`; const x = rnd() * 512, y = rnd() * 512, a = (rnd() < 0.5 ? 0.6 : -0.6) + (rnd() - 0.5) * 0.3, L = 20 + rnd() * 50; tg.beginPath(); tg.moveTo(x, y); tg.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); tg.stroke(); }
    for (let i = 0; i < 380; i++) { tg.fillStyle = "rgba(140,70,52,.28)"; tg.beginPath(); tg.arc(rnd() * 512, rnd() * 512, 1 + rnd() * 1.4, 0, 7); tg.fill(); } }
  const bumpC = mkCanvas(256, 256), bg2 = bumpC.getContext("2d"); { bg2.fillStyle = "#808080"; bg2.fillRect(0, 0, 256, 256); for (let i = 0; i < 700; i++) { const v = 90 + rnd() * 90 | 0; bg2.fillStyle = `rgb(${v},${v},${v})`; bg2.beginPath(); bg2.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 0, 7); bg2.fill(); } }
  const faceTex = tex(faceC, [4, 1]), topTex = tex(topC, [10, 10]), bumpTex = tex(bumpC, [14, 14]);
  const skinMat = new THREE.MeshPhysicalMaterial({ map: topTex, bumpMap: bumpTex, bumpScale: 0.7, roughness: 0.7, sheen: 0.0, sheenColor: new THREE.Color(1, 0.8, 0.7), sheenRoughness: 0.6 });
  const faceMat = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.3, sheenColor: new THREE.Color(1, 0.8, 0.75) });
  const sideMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.7, color: 0xe8d0c4 });

  // ── the block: surface (displaced), cut face (follows the surface at its top edge), sides ────────────
  const BW = 44, BD = 34, DEPTH = 5.2, NX = 220, NZ = 150;
  const surf = new THREE.PlaneGeometry(BW, BD, NX, NZ); surf.rotateX(-Math.PI / 2); surf.translate(0, 0, -BD / 2);
  const surfMesh = new THREE.Mesh(surf, skinMat); surfMesh.receiveShadow = true; scene.add(surfMesh);
  const sp = surf.attributes.position, sx0 = new Float32Array(sp.count), sz0 = new Float32Array(sp.count);
  for (let i = 0; i < sp.count; i++) { sx0[i] = sp.getX(i); sz0[i] = sp.getZ(i); }
  const face = new THREE.PlaneGeometry(BW, DEPTH, NX, 12); face.translate(0, -DEPTH / 2, 0); const fp = face.attributes.position, fy0 = new Float32Array(fp.count), fx0 = new Float32Array(fp.count);
  for (let i = 0; i < fp.count; i++) { fy0[i] = fp.getY(i); fx0[i] = fp.getX(i); }
  const faceMesh = new THREE.Mesh(face, faceMat); faceMesh.receiveShadow = true; scene.add(faceMesh);
  for (const sgn of [-1, 1]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(BD, DEPTH), sideMat); s.position.set(sgn * BW / 2, -DEPTH / 2, -BD / 2); s.rotation.y = sgn * Math.PI / 2; scene.add(s); }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), sideMat); under.rotation.x = Math.PI / 2; under.position.set(0, -DEPTH, -BD / 2); scene.add(under);

  // ── the follicle (a real one, in the cut face), its hair, the muscle and the nerve ────────────────────
  const BULB = [-1.5, -3.55], LF = 3.2, F0 = 40 * D2R, F1 = 13 * D2R;                       // follicle: from the bulb up to the surface; leaning, then upright
  const folDir = (p) => { const a = lerp(F0, F1, p); return [Math.sin(a), Math.cos(a)]; };
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.4, ...o });
  const M = { sheath: mat({ color: 0xf3d3bc, roughness: 0.6, transparent: true, opacity: 0.3, depthWrite: false }), line: new THREE.MeshBasicMaterial({ color: 0xc98f70, side: THREE.BackSide, toneMapped: false, transparent: true, opacity: 0.0 }), mline: new THREE.MeshBasicMaterial({ color: 0xa8404c, side: THREE.BackSide, toneMapped: false }), hair: mat({ color: 0xb4793a, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: new THREE.Color(1, 0.8, 0.5) }),
    bulb: mat({ color: 0xb9792f, roughness: 0.32, clearcoat: 0.7 }), muscle: mat({ color: 0xe5606e, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    nerve: mat({ color: 0xf0c35b, roughness: 0.28, emissive: 0xc88a1a, emissiveIntensity: 0.12, clearcoat: 0.6 }) };
  // a lathe-free tube we rewrite each frame (planar curves; z is the binormal)
  const makeTube = (nS, nR, mt, shadow = true) => { const g = new THREE.BufferGeometry(), pos = new Float32Array((nS + 1) * (nR + 1) * 3), nor = new Float32Array(pos.length), uv = new Float32Array((nS + 1) * (nR + 1) * 2), idx = [];
    for (let i = 0; i <= nS; i++) for (let j = 0; j <= nR; j++) { uv[(i * (nR + 1) + j) * 2] = j / nR; uv[(i * (nR + 1) + j) * 2 + 1] = i / nS; }
    for (let i = 0; i < nS; i++) for (let j = 0; j < nR; j++) { const a = i * (nR + 1) + j, b = a + nR + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mt); m.castShadow = shadow; m.frustumCulled = false; scene.add(m);
    return { mesh: m, set(pts, rad, zc = 0) { const n = pts.length; for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const nx = -ty, ny = tx;
      for (let j = 0; j <= nR; j++) { const th = (j / nR) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), k = (i * (nR + 1) + j) * 3; pos[k] = pts[i][0] + nx * c * rad[i]; pos[k + 1] = pts[i][1] + ny * c * rad[i]; pos[k + 2] = (pts[i][2] ?? zc) + s * rad[i]; nor[k] = nx * c; nor[k + 1] = ny * c; nor[k + 2] = s; } }
      g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true; } }; };
  const sheathT = makeTube(10, 14, M.sheath, false), sheathL = makeTube(10, 14, M.line, false), muscleL = makeTube(24, 16, M.mline, false), hairT = makeTube(26, 8, M.hair), hairInT = makeTube(10, 8, M.hair, false), muscleT = makeTube(24, 16, M.muscle, false);
  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), M.bulb); scene.add(bulbMesh);
  // the nerve: a gold branching fibre (static curves), signals travel along it
  const NV = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const ANCH = [-2.55, -0.62];                                                                // the muscle's upper end, under the surface on the downhill side
  const nerveMain = NV([[5.6, -4.6, 0.18], [5.0, -4.2, 0.26], [4.5, -3.7, 0.22], [3.8, -3.5, 0.3], [3.2, -3.0, 0.2], [2.5, -2.9, 0.3], [1.8, -2.5, 0.26], [1.0, -2.35, 0.2], [0.2, -1.9, 0.26], [-0.5, -1.8, 0.2], [-1.2, -1.35, 0.2], [-2.0, -1.2, 0.18]]);
  const nerveB1 = NV([[4.5, -3.9, 0.22], [4.1, -2.7, 0.1], [3.5, -1.6, 0.0], [3.0, -0.8, -0.1]]);
  const nerveB2 = NV([[1.8, -2.7, 0.26], [2.4, -1.9, 0.3], [2.9, -1.3, 0.2]]);
  const nerveB3 = NV([[-1.2, -1.5, 0.2], [-1.5, -2.2, 0.16], [-1.55, -2.7, 0.12]]);   // the branch to the bulge (stem cells, mice)
  const nerveEnd = NV([[-2.0, -1.2, 0.18], [-2.35, -1.0, 0.16], [-2.7, -0.95, 0.12]]);
  const nerveCurves = [nerveMain, nerveB1, nerveB2, nerveB3, nerveEnd, NV([[-2.0, -1.2, 0.18], [-2.2, -1.5, 0.2], [-2.9, -1.6, 0.1]])];
  const nerveGroup = new THREE.Group(); scene.add(nerveGroup);
  nerveCurves.forEach((c, i) => { const m = new THREE.Mesh(new THREE.TubeGeometry(c, 60, i === 0 ? 0.05 : 0.036, 8, false), M.nerve); m.castShadow = true; nerveGroup.add(m); });
  const glowTex = (() => { const c = mkCanvas(64, 64), g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,190,1)"); gr.addColorStop(0.25, "rgba(255,214,120,.7)"); gr.addColorStop(1, "rgba(255,200,90,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mkGlow = (n, col) => Array.from({ length: n }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); scene.add(s); return s; });
  const sig = mkGlow(14, 0xffd77a), cold = mkGlow(1, 0xffffff);
  // stem cells at the bulge (mice): pearl spheres that wake (glow gold-white)
  const stemM = new THREE.MeshPhysicalMaterial({ color: 0xfbe8cf, roughness: 0.3, clearcoat: 0.8, emissive: 0xffc860, emissiveIntensity: 0, transmission: 0 });
  const stems = Array.from({ length: 18 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1 + hash(i) * 0.05, 18, 12), stemM); m.userData = { s: 0.42 + hash(i + 5) * 0.2, side: hash(i + 9) < 0.5 ? -1 : 1, r: 0.2 + hash(i + 3) * 0.2, z: 0.12 + hash(i + 7) * 0.3, k: i < 8 ? 0 : (i - 8) / 10 }; scene.add(m); return m; });
  const stemGlow = mkGlow(1, 0xffe0a0)[0];
  const newHair = makeTube(8, 8, M.hair, false);

  // ── the field of hairs on the surface: instanced, standing with `raise`, each with a bump ─────────────
  const NH = 96, HAIRS = Array.from({ length: NH }, (_, i) => { let x, z, n = 0; do { x = (hash(i * 3.1 + n * 17.3) - 0.5) * (BW - 6); z = -2.2 - hash(i * 5.7 + 2 + n * 11.9) * (BD - 6); n++; } while (Math.abs(x - 0.4) < 2.4 && z > -6 && n < 20); return { x, z, az: (hash(i * 9.3) - 0.5) * 0.9, len: 2.6 + hash(i * 1.7) * 1.6, ph: hash(i * 2.9) }; });
  const hg = (() => { const pts = [], n = 6; const rad = 0.06; const g = new THREE.CylinderGeometry(0.018, rad, 1, 6, n, true); g.translate(0, 0.5, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.28 * y * y); } g.computeVertexNormals(); return g; })();
  const hairInst = new THREE.InstancedMesh(hg, M.hair.clone(), NH); hairInst.castShadow = true; hairInst.frustumCulled = false; scene.add(hairInst);
  const dummy = new THREE.Object3D();
  const WAVE = { t0: 3.2, dur: 2.6 };                                                          // the hook: a wave of goosebumps rolls across the arm
  const raiseAt = (x, t, main) => Math.min(1, Math.max(globalRaise(t), clamp((t - WAVE.t0 - (x + 22) / 44 * WAVE.dur) / 1.2) * (1 - seg(t, 5.0, 5.6) * 0.0)) * calm(t));
  const globalRaise = (t) => Math.max(eo(seg(t, 6.6, 10.0)) * 0.9, 0);
  const calm = (t) => 1 - eo(seg(t, 56.0, 61.0));

  // ── paintings as hero shots: the owner's picture, drawn over the 3-D view (DOM image, slow push) and dissolved to/from its 3-D twin ──
  const PL = (T.paintings || []).map((p) => { const el = new Image(); el.src = p.src; el.style.cssText = `position:absolute;left:0;top:0;width:${AW}px;max-width:none;transform-origin:50% 50%;opacity:0;pointer-events:none`; artbox.appendChild(el); return { ...p, el }; });
  await Promise.all(PL.map((p) => new Promise((res) => { if (p.el.complete) res(); else { p.el.onload = res; p.el.onerror = res; } })));
  const paintSet = (t) => { for (const p of PL) { const t0 = R(p.t0), t1 = R(p.t1), op = Math.min(sm(seg(t, t0, t0 + (p.fin ?? 0.5))), 1 - sm(seg(t, t1 - (p.fout ?? 0.8), t1))) * (t >= t0 && t <= t1 ? 1 : 0), el = p.el, h = AW * el.naturalHeight / el.naturalWidth, f = p.focus || [0.5, 0.6], life = seg(t, t0, t1), sc = (p.s0 || 1) + ((p.s1 || 1.08) - (p.s0 || 1)) * life;
    el.style.height = h + "px"; el.style.transformOrigin = `${f[0] * AW}px ${f[1] * h}px`; el.style.transform = `translate(${-(f[0] * AW - AW / 2) + (p.dx || 0) * life * AW * 0.04}px,${-(f[1] * h - BH / 2)}px) scale(${sc})`; el.style.opacity = op.toFixed(3); } };

  // ── the set functions ────────────────────────────────────────────────────────────────────────────────
  const MAIN = { x: 0.4 };                                                                     // where the section's follicle meets the surface
  const bumpH = (x, z, pull, hairBumps) => { let h = 0;
    const ex = x - (BULB[0] + LF * Math.sin(lerp(F0, F1, pull))), ez = z; h += 0.42 * pull * Math.exp(-(ex * ex / 1.9 + ez * ez / 1.7));
    const mx = x - ANCH[0] - 0.2; h -= 0.17 * pull * Math.exp(-(mx * mx / 0.8 + ez * ez / 1.1));
    if (hairBumps > 0) for (const hh of HAIRS) { const dx = x - hh.x, dz = z - hh.z; if (dx * dx + dz * dz < 3.4) h += 0.3 * hairBumps * hh.raise * Math.exp(-(dx * dx + dz * dz) / 0.7); }
    return h; };
  let lastKey = "";
  const setWorld = (t) => {
    const pull = eio(seg(t, 29.7, 32.4)) * (1 - calm(t)) + (t < 56 ? 0 : 0);                    // the section's muscle: shortens on the fire
    const pullHold = t < 56 ? pull : pull * (1 - eo(seg(t, 56.0, 60.5)));
    const P = Math.max(pullHold, 0);
    // field hairs
    for (let i = 0; i < NH; i++) { const hh = HAIRS[i]; hh.raise = raiseAt(hh.x, t) * (0.55 + 0.45 * hash(i * 4.4)); }
    // surface displacement
    const hb = clamp(globalRaise(t) + seg(t, WAVE.t0, WAVE.t0 + 3), 0, 1) * calm(t);
    for (let i = 0; i < sp.count; i++) sp.setY(i, bumpH(sx0[i], sz0[i], P, hb * 0.9));
    sp.needsUpdate = true; surf.computeVertexNormals();
    // the face's top edge follows the surface at z = 0; the rows below blend to flat
    for (let i = 0; i < fp.count; i++) { const k = clamp(1 + fy0[i] / 0.9); fp.setY(i, fy0[i] + bumpH(fx0[i], 0, P, 0) * k); } fp.needsUpdate = true; face.computeVertexNormals();
    // follicle
    const d = folDir(P), top = [BULB[0] + d[0] * LF, BULB[1] + d[1] * LF], h0 = bumpH(top[0], 0, P, 0);
    const fp3 = []; const fr = []; for (let i = 0; i <= 10; i++) { const s = i / 10; fp3.push([BULB[0] + d[0] * LF * s, BULB[1] + d[1] * LF * s + (i === 10 ? h0 : 0), 0.02]); fr.push(0.34 - 0.06 * s); } sheathT.set(fp3, fr); sheathL.set(fp3, fr.map((v) => v + 0.045));
    const hin = fp3.map((p, i) => [p[0], p[1], 0.02]); hairInT.set(hin, hin.map((_, i) => 0.2 - 0.06 * (i / 10))); bulbMesh.position.set(BULB[0], BULB[1], 0.02);
    // the hair outside: leaves the follicle's line, arches toward the downhill side; stands with P
    const lean = lerp(58, 7, P) * D2R, Ls = 4.3, hp = [], hr = [];
    for (let i = 0; i <= 26; i++) { const s = i / 26, a = lerp(F0, F1, P) + lean * Math.pow(s, 1.3) * (1 - 0); const pp = hp.length ? hp[hp.length - 1] : [top[0], top[1] + h0]; hp.push(i === 0 ? [top[0], top[1] + h0, 0.02] : [pp[0] + Math.sin(a) * Ls / 26, pp[1] + Math.cos(a) * Ls / 26, 0.02]); hr.push(lerp(0.14, 0.025, Math.pow(s, 0.8))); }
    hairT.set(hp, hr);
    // the muscle: from the follicle's bulge to its anchor, shortening and thickening
    const bj = BULB[0] + d[0] * LF * 0.52, bk = BULB[1] + d[1] * LF * 0.52, ax = ANCH[0], ay = ANCH[1] + bumpH(ax, 0, P, 0) * 0.9;
    const shorten = 1 - 0.3 * P, mp = [], mr = []; for (let i = 0; i <= 24; i++) { const s = i / 24, ex = lerp(bj, ax, 1 - (1 - s) * 0 ), ey = lerp(bk, ay, s); const bow = Math.sin(Math.PI * s) * (0.18 + 0.32 * P); const dx0 = ax - bj, dy0 = ay - bk, L0 = Math.hypot(dx0, dy0), nx = -dy0 / L0, ny = dx0 / L0;
      const sx2 = lerp(bj, ax, s), sy2 = lerp(bk, ay, s); const cx = lerp(bj, sx2, 1) , cy = lerp(bk, sy2, 1); mp.push([cx + nx * bow, cy + ny * bow, 0.1 + 0.05 * Math.sin(Math.PI * s)]); mr.push((0.06 + 0.26 * Math.sin(Math.PI * Math.pow(s, 0.85))) * (1 + 0.45 * P)); }
    // shorten: pull the anchor end down toward the bulge by P
    for (let i = 0; i < mp.length; i++) { const s = i / 24; mp[i][0] = lerp(bj, mp[i][0], lerp(1, shorten, s)); mp[i][1] = lerp(bk, mp[i][1], lerp(1, shorten, s)); }
    muscleT.set(mp, mr); muscleL.set(mp, mr.map((v) => v + 0.04));
    // signals along the nerve: a travelling bead (fire) plus faint idle pulses; the arrival pulses the muscle
    const idle = (t > 15 && t < 29) ? 1 : 0;
    const fireT = [7.9, 9.4, 10.6, 11.7, 12.9, 16.0, 17.7, 19.4, 21.1, 22.8, 24.5, 26.2, 27.5, 28.9, 29.6, 30.2, 33.0, 35.2, 37.0, 38.7, 40.4, 42.1, 44.2, 45.9, 47.9, 49.6, 51.6, 53.3, 55.6, 57.3, 59.0, 60.7];
    sig.forEach((s) => (s.material.opacity = 0)); let si = 0;
    const place = (cv, u2, br, size = 0.5) => { if (si >= sig.length) return; const p = cv.getPoint(clamp(u2)); const s = sig[si++]; s.position.set(p.x, p.y, p.z + 0.12); s.scale.setScalar(size * 0.8); s.material.opacity = br * 0.85; };
    for (const ft of fireT) { const k = (t - ft) / 1.7; if (k < 0 || k > 1.25) continue; const br = Math.sin(clamp(k) * Math.PI) ** 0.6; const onMain = k < 1; place(nerveMain, 1 - k, br, 0.55); place(nerveMain, 1 - k + 0.06, br * 0.5, 0.35); place(nerveMain, 1 - k + 0.12, br * 0.25, 0.25);
      if (k > 0.85) place(nerveEnd, (k - 0.85) / 0.4, br, 0.5); }
    // the mice: the nerve's branch to the bulge, the stem cells waking
    const wake = eo(seg(t, 47.4, 50.6)) * (1 - eo(seg(t, 56, 59)));
    stemM.emissiveIntensity = 1.6 * wake; stems.forEach((m) => { const U = m.userData, p = [BULB[0] + d[0] * LF * U.s, BULB[1] + d[1] * LF * U.s]; m.position.set(p[0] + U.side * (0.28 + U.r * 0.4) * d[1], p[1] - U.side * (0.28 + U.r * 0.4) * d[0], U.z); const k = clamp(wake * 1.4 - U.k); m.visible = U.k === 0 ? t > 44.5 : k > 0.02; m.scale.setScalar(U.k === 0 ? 1 + 0.25 * wake : 0.3 + 0.7 * k); });
    { const p = new THREE.Vector3(BULB[0] + d[0] * LF * 0.52, BULB[1] + d[1] * LF * 0.52, 0.4); stemGlow.position.copy(p); stemGlow.scale.setScalar(1.3 * wake + 0.01); stemGlow.material.opacity = 0.3 * wake; }
    const grow = eo(seg(t, 50.2, 53.5)) * (1 - eo(seg(t, 56, 59))); newHair.mesh.visible = grow > 0.02; if (grow > 0.02) { const pts = [], rr = []; for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push([BULB[0] + d[0] * (LF * 0.15 + LF * 0.6 * grow * s), BULB[1] + d[1] * (LF * 0.15 + LF * 0.6 * grow * s) , 0.1]); rr.push(0.07 - 0.04 * s); } newHair.set(pts, rr); }
    // the field's hairs
    for (let i = 0; i < NH; i++) { const hh = HAIRS[i], r = hh.raise, tilt = lerp(78, 9, r) * D2R + Math.sin(t * 1.3 + hh.ph * 6) * 0.025 * (1 + r), y = bumpH(hh.x, hh.z, 0, hb * 0.9); dummy.position.set(hh.x, y, hh.z); dummy.rotation.set(0, 0, 0); dummy.rotateY(-Math.PI / 2 + hh.az); dummy.rotateX(0); dummy.rotation.order = "YXZ"; dummy.rotation.set(0, 0, 0);
      dummy.quaternion.setFromEuler(new THREE.Euler(0, 0, -tilt)); const qa = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hh.az); dummy.quaternion.premultiply(qa); dummy.scale.set(1, hh.len, 1); dummy.updateMatrix(); hairInst.setMatrixAt(i, dummy.matrix); }
    hairInst.instanceMatrix.needsUpdate = true;
    // cold: a pale breath drifting over the skin (5.2 – 9)
    cold.forEach((c) => (c.material.opacity = 0)); // (wisps drawn below as sprites)
  };

  // cold wisps: soft pale streaks drifting across the field
  const wisps = Array.from({ length: 22 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe6f2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, fog: false })); s.userData = { k: i, y: 0.3 + hash(i * 2.1) * 2.2, z: -1 - hash(i * 7.7) * 14, sp: 0.8 + hash(i * 3.3), x0: (hash(i * 5.5) - 0.5) * 40 }; scene.add(s); return s; });
  const setCold = (t) => { const a = eo(seg(t, 5.0, 6.2)) * (1 - eo(seg(t, 12.6, 14.0))); wisps.forEach((s) => { const U = s.userData; s.position.set(((U.x0 + t * 2.6 * U.sp + 22) % 44) - 22, U.y + Math.sin(t + U.k) * 0.15, U.z); s.scale.set(3.4, 0.5, 1); s.material.opacity = 0.34 * a; }); };

  // ── the camera: one continuous flight, keyed ──────────────────────────────────────────────────────────
  const CAM = (T.camera || []).map((k) => ({ ...k, t: R(k.t) }));
  const catmull = (p0, p1, p2, p3, k) => 0.5 * ((2 * p1) + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k * k + (-p0 + 3 * p1 - 3 * p2 + p3) * k * k * k);
  const camAt = (t) => { let i = 0; while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++; const a = CAM[i], b = CAM[i + 1], k = sm(seg(t, a.t, b.t)), p0 = CAM[Math.max(0, i - 1)], p3 = CAM[Math.min(CAM.length - 1, i + 2)];
    const f = (key) => a[key].map((_, c) => (a.cut && b.cut ? lerp(a[key][c], b[key][c], k) : catmull(p0[key][c], a[key][c], b[key][c], p3[key][c], k)));
    return { pos: f("pos"), look: f("look"), fov: lerp(a.fov, b.fov, k), roll: lerp(a.roll || 0, b.roll || 0, k) }; };

  // ── anchors (screen px, absolute stage coordinates) ──────────────────────────────────────────────────
  const V = new THREE.Vector3();
  const ANC = {
    bump: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF + 0.1, 0.35, 0.3]; },
    follicle: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF * 0.78, BULB[1] + d[1] * LF * 0.78, 0.3]; },
    muscle: () => [(ANCH0()[0] + ANC.bulgeP()[0]) / 2, (ANCH0()[1] + ANC.bulgeP()[1]) / 2, 0.45],
    bulgeP: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF * 0.52, BULB[1] + d[1] * LF * 0.52, 0.3]; },
    nerve: () => { const p = nerveMain.getPoint(0.42); return [p.x, p.y, p.z + 0.1]; },
    hairTip: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF + 0.5, BULB[1] + d[1] * LF + 2.2, 0.3]; },
    stem: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF * 0.55 + 0.35, BULB[1] + d[1] * LF * 0.55, 0.4]; },
    newHair: () => { const d = folDir(Pnow); return [BULB[0] + d[0] * LF * 0.62, BULB[1] + d[1] * LF * 0.62, 0.3]; },
  };
  const ANCH0 = () => [ANCH[0], ANCH[1] + 0.0, 0.2];
  let Pnow = 0;

  return {
    renderer,
    seek(t) {
      Pnow = (eio(seg(t, 29.7, 32.4))) * (t < 56 ? 1 : 1 - eo(seg(t, 56.0, 60.5)));
      const c = camAt(t); camera.position.set(...c.pos); camera.fov = c.fov; camera.up.set(Math.sin(c.roll * D2R), Math.cos(c.roll * D2R), 0); camera.lookAt(...c.look); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      setWorld(t); setCold(t); paintSet(t); key.target.position.set(0, -1, -4); key.target.updateMatrixWorld();
      renderer.render(scene, camera);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); V.set(p[0], p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
