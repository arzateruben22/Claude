// scan.js — Body Backstage's "live scan" look (films/channels/body/set; the season 1 reboot look test, 3 Nov).
// The body filmed like a premium medical-visualisation title: photoreal wet tissue under a film-set light rig,
// volumetric haze and light shafts, a real lens (the finish's depth of field and motion blur), and an instrument
// that switches modes on the beat: a phosphor scan line sweeps the frame, and below it the same tissue is seen in
// "scan view" (glass-dark bodies, glowing edges, blood running hot). Pure functions of their parameters; no clock.
//
//   import { createRig, tissue, scanPatch, backdrop, shaft, motes, grain } from "../set/scan.js";
//   const rig = createRig(renderer, scene);              rig.aim(target, keyDir, rimDir); rig.set({ key, rim, fill, env })
//   const m = tissue({ color, wet, sheen, glow });       MeshPhysicalMaterial: wet clearcoat, sheen, a fresnel
//                                                        "subsurface" glow at grazing angles, micro-normal detail
//   scanPatch(m, { edge, core, k })                      below the scan line (SCAN.y, px from the bottom) the
//                                                        material reads in scan view: core → edge by fresnel
//   SCAN.y = px; SCAN.k = 0..1                            one shared uniform set for every patched material
//   backdrop(scene, { top, mid, low })                   an opaque gradient sphere at finite depth (the finish's DOF
//                                                        rim fix, kits/cinema/film/README.md)
//   shaft({ from, to, radius, color })                   a soft additive light shaft (three nested cones)
//   motes(scene, n, box, size, color, R)                 floating particles; DOF turns them into bokeh. m.set(t, op)
//   grain(root, amount)                                  deterministic film grain over the frame. g.set(t)
//
// Identity: abyss teal-black ground (the surgical green taken darker and filmic), warm photoreal tissue, blood red,
// and the channel's chartreuse as the instrument (scan line, reticles, readouts). Not Skin Sense's violet and cyan,
// not Lumevina's black/rose/gold.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

export const SCAN = { y: { value: -1 }, k: { value: 0 } };

const canvasTex = (size, draw) => {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

// a cellular height field (a membrane's cobbles and creases) → normal map
const cellNormal = (seed = 1, size = 512, cells = 70, strength = 2.4) => {
  const R = rng(seed), pts = []; for (let i = 0; i < cells; i++) pts.push([R() * size, R() * size]);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const dx = x - px - ox * size, dy = y - py - oy * size, d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    h[y * size + x] = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 14) + (R() - 0.5) * 0.04;
  }
  return canvasTex(size, (k) => {
    const img = k.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (xx, yy) => h[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      img.data[i] = 128 + (-dx / l) * 127; img.data[i + 1] = 128 + (dy / l) * 127; img.data[i + 2] = 128 + (1 / l) * 127; img.data[i + 3] = 255;
    }
    k.putImageData(img, 0, 0);
  });
};
const normals = {};

// ── the rig: an HDR studio for reflections + key, rim and fill ─────────────────────────────────────────────────
export const createRig = (renderer, scene, { keyDir = [-0.55, 0.85, 0.6], rimDir = [0.6, 0.3, -0.85] } = {}) => {
  const env = new THREE.Scene(); env.background = new THREE.Color(0x020807);
  const box = (w, h, color, k, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
  box(7, 4, 0xfff0e2, 5, [-6, 7, 6]);       // warm key softbox
  box(1.5, 9, 0xe8fff4, 4, [7, 2, -7]);     // cool rim strip
  box(10, 2, 0x0f3a33, 1.5, [0, -6, 3]);    // the teal bounce from below
  box(2, 2, 0xd6f25f, 0.6, [8, -1, 5]);     // a faint chartreuse kicker (the instrument)
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture;
  const kL = new THREE.DirectionalLight(0xfff0e2, 2.4), rL = new THREE.DirectionalLight(0xdff8ee, 3), fL = new THREE.HemisphereLight(0x9fd8c8, 0x08100f, 0.35);
  scene.add(kL, rL, fL, kL.target, rL.target);
  const R = {
    aim(p, kd = keyDir, rd = rimDir, d = 60) { kL.target.position.set(...p); rL.target.position.set(...p); kL.position.set(p[0] + kd[0] * d, p[1] + kd[1] * d, p[2] + kd[2] * d); rL.position.set(p[0] + rd[0] * d, p[1] + rd[1] * d, p[2] + rd[2] * d); },
    set({ key = 2.4, rim = 3, fill = 0.35, env: e = 0.6 } = {}) {
      kL.intensity = key; rL.intensity = rim; fL.intensity = fill;
      scene.traverse((o) => { const m = o.material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = e * (m.userData.envK ?? 1); });
    },
  };
  R.aim([0, 0, 0]); return R;
};

// ── materials ────────────────────────────────────────────────────────────────────────────────────────────────
// tissue: wet, living surface. The "subsurface" read comes from a warm fresnel glow at grazing angles (light that
// has travelled through the thin edge) plus sheen; no transmission (it costs a second pass per motion-blur sample).
export const tissue = ({ color = "#E7938A", wet = 0.8, sheen = 0.5, glow = "#FF6A5A", glowK = 0.55, seed = 3, repeat = 3, micro = 1, rough = 0.42 } = {}) => {
  const key = `c${seed}`; normals[key] = normals[key] || cellNormal(seed);
  const nm = normals[key].clone(); nm.needsUpdate = true; nm.repeat.set(repeat, repeat);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), roughness: rough, metalness: 0,
    clearcoat: wet, clearcoatRoughness: 0.08 + 0.2 * (1 - wet),
    sheen, sheenRoughness: 0.45, sheenColor: new THREE.Color(glow),
    normalMap: nm, normalScale: new THREE.Vector2(0.6 * micro, 0.6 * micro),
    specularIntensity: 0.55,
  });
  m.userData.glow = { color: new THREE.Color(glow), k: glowK };
  m.userData.envK = 1;
  return m;
};

// the fresnel glow and the scan view, in one onBeforeCompile (colours in display space, after the tone map)
export const scanPatch = (m, { edge = "#CFFBE6", core = "#04181A", k = 1, hot = 0, contour = 0 } = {}) => {
  const g = m.userData.glow || { color: new THREE.Color(0, 0, 0), k: 0 };
  const U = { uGlow: { value: g.color.clone().convertSRGBToLinear() }, uGlowK: { value: g.k }, uEdge: { value: new THREE.Color(edge) }, uCore: { value: new THREE.Color(core) }, uScanK: { value: k }, uHot: { value: hot }, uContour: { value: contour } };
  m.userData.scan = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uScanY: SCAN.y, uScanOn: SCAN.k });
    sh.fragmentShader = "uniform vec3 uGlow, uEdge, uCore; uniform float uGlowK, uScanK, uScanY, uScanOn, uHot, uContour;\n" + sh.fragmentShader
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { float fr0 = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.2); totalEmissiveRadiance += uGlow * uGlowK * fr0; }`)
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        { float fr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 1.7);
          float below = (1.0 - smoothstep(uScanY - 1.5, uScanY + 1.5, gl_FragCoord.y)) * uScanOn * uScanK;
          vec3 sv = mix(uCore, uEdge, fr) + uEdge * 0.9 * pow(fr, 7.0);
          sv = mix(sv, uEdge * (0.55 + 0.6 * fr), uHot);
          if (uContour > 0.0) { float z = -vViewPosition.z * uContour, w = fwidth(z); float ln = 1.0 - smoothstep(0.0, 1.5 * w, abs(fract(z) - 0.5) - 0.5 + 1.5 * w); sv += uEdge * 0.55 * ln; }   // iso-depth slices
          gl_FragColor.rgb = mix(gl_FragColor.rgb, sv, below); }`);
  };
  m.customProgramCacheKey = () => "scan" + (m.userData.scanKey || "");
  return m;
};

// ── the backdrop: a gradient sphere, opaque, at finite depth ─────────────────────────────────────────────────────
export const backdrop = (scene, { top = "#0B2A2B", mid = "#061416", low = "#020707", r = 4000 } = {}) => {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(top) }, uMid: { value: new THREE.Color(mid) }, uLow: { value: new THREE.Color(low) }, uRes: { value: new THREE.Vector2(1080, 1920) } },
    vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop, uMid, uLow; uniform vec2 uRes;
      void main(){ vec2 p = gl_FragCoord.xy / uRes; float d = distance(p * vec2(1.0, 1.6), vec2(0.5, 1.15));
        vec3 c = mix(uTop, uMid, smoothstep(0.1, 0.8, d)); c = mix(c, uLow, smoothstep(0.8, 1.6, d)); gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), m); s.renderOrder = -10; s.frustumCulled = false; scene.add(s);
  // anchored at the shot's centre, never at the camera (a mesh at the camera projects to NaN in the finish's probe)
  return { mesh: s, at(p, W, H) { s.position.set(...p); m.uniforms.uRes.value.set(W, H); } };
};

// ── light ────────────────────────────────────────────────────────────────────────────────────────────────────
// a soft shaft: three crossed planes along the axis, each feathered across and along (never a hard silhouette)
const shaftTex = canvasTex(256, (k, s) => { const img = k.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
  const u = x / (s - 1), v = y / (s - 1), across = Math.exp(-Math.pow((u - 0.5) / 0.2, 2)), along = Math.sin(Math.PI * Math.min(1, v * 1.25)) * (1 - 0.5 * v), a = across * Math.max(0, along);
  const i = (y * s + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a); } k.putImageData(img, 0, 0); });
export const shaft = ({ from = [0, 10, 0], to = [0, 0, 0], radius = 2, color = "#FFF1DE", k = 0.14 } = {}) => {
  const g = new THREE.Group(), a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b), mats = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), map: shaftTex, transparent: true, opacity: k, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2.4, len), m); p.rotation.y = (i * Math.PI) / 3; mats.push(m); g.add(p);
  }
  g.position.copy(a).add(b).multiplyScalar(0.5); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
  return { group: g, set(op = 1) { g.visible = op > 0.002; mats.forEach((m) => (m.opacity = k * op)); } };
};

const dotTex = canvasTex(64, (k) => { const g = k.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)"); k.fillStyle = g; k.fillRect(0, 0, 64, 64); });
export const motes = (scene, n, box, size, color, R, op0 = 0.7) => {
  const pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([box[0][0] + R() * (box[1][0] - box[0][0]), box[0][1] + R() * (box[1][1] - box[0][1]), box[0][2] + R() * (box[1][2] - box[0][2]), R() * 6.28]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: dotTex, size, color: new THREE.Color(color), transparent: true, opacity: op0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p);
  const amp = Math.max(box[1][0] - box[0][0], box[1][1] - box[0][1]) * 0.02;
  return { points: p, set(t, op = 1) { p.visible = op > 0.002; m.opacity = op0 * op; base.forEach(([x, y, z, ph], i) => { pos[3 * i] = x + amp * Math.sin(t * 0.3 + ph); pos[3 * i + 1] = y + amp * 0.6 * t + amp * Math.sin(t * 0.21 + ph * 2); pos[3 * i + 2] = z + amp * Math.cos(t * 0.27 + ph); }); g.attributes.position.needsUpdate = true; } };
};

export const grain = (root, amount = 0.02, size = 256) => {
  const c = document.createElement("canvas"); c.width = c.height = size;
  Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "overlay", opacity: String(amount * 8), zIndex: 0 });
  root.appendChild(c);
  const k = c.getContext("2d"), img = k.createImageData(size, size);
  return { set(t) { const R = rng(1 + Math.floor(t * 30)); for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (R() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } k.putImageData(img, 0, 0); } };
};

// noise for lumpy geometry
const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
export const vnoise = (x, y, z) => { const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t; return L(L(L(h3(i, j, k), h3(i + 1, j, k), u), L(h3(i, j + 1, k), h3(i + 1, j + 1, k), u), v), L(L(h3(i, j, k + 1), h3(i + 1, j, k + 1), u), L(h3(i, j + 1, k + 1), h3(i + 1, j + 1, k + 1), u), v), w); };
export const lumpy = (geo, amt = 0.08, f = 2.2, seed = 0) => {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize(), r = v.length();
    const d = amt * (vnoise(n.x * f + seed, n.y * f, n.z * f) - 0.5) + amt * 0.35 * (vnoise(n.x * f * 3.1 + seed, n.y * f * 3.1, n.z * f * 3.1) - 0.5);
    v.addScaledVector(n, d * r); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
};
