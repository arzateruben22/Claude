// studio.js — Outer Layer's look-development library (films/channels/skincare/set), the studio-grade finish both
// builders use (coordinator's look-dev brief, 2 Nov). Pure functions of their parameters; no clock.
//
//   const S = createStudio(renderer, scene, { key, rim, fill, env })    the three-point rig + a procedural softbox
//     environment (PMREM) for reflections. S.set({ key, rim, fill, env, warm }) scales the lights per shot.
//   skinMaterial({ tone, oil, hydration, micro, seed })   real-looking skin: MeshPhysicalMaterial with a subsurface
//     tint (attenuation through a little transmission), sheen for peach fuzz, clearcoat for oil and water, and a
//     procedural micro-normal map (pores and fine lines). Works for every tone: the tone sets base and scatter colour.
//   cellMaterial({ tint, glow })  + nucleus(material)       soft, translucent cells with a glowing nucleus
//   strandMaterial({ tint })      glossy, translucent strands (collagen, nerve fibre, muscle)
//   fluidMaterial({ tint })       a liquid that refracts (sunscreen, plasma, sweat)
//   createShaft({ from, to, radius, color })   a volumetric light shaft (additive, soft-edged, under the bloom knee)
//   createGrain(root, { amount })              film grain over the frame (deterministic in t): g.set(t)
//   colourScript                               per-episode grade notes (exposure, warmth) used by the scenes
// Identity kept: violet and cyan for the UV instrument; no rose, gold, black glass or product looks.
import * as THREE from "three";
import { rng } from "cinema/film/runtime.js";

// ── the procedural textures ─────────────────────────────────────────────────
const canvasTex = (size, draw, srgb = false) => {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
};
// a height field (pores as small pits, fine lines as two crossing families of soft grooves) turned into a normal map
const microNormal = (seed = 1, size = 512, pores = 220, lines = 26) => {
  const R = rng(seed), h = new Float32Array(size * size);
  for (let n = 0; n < pores; n++) {
    const px = R() * size, py = R() * size, r = 2 + R() * 3.5;
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
      const d2 = (x * x + y * y) / (r * r); if (d2 > 4) continue;
      const i = ((Math.floor(py + y) + size) % size) * size + ((Math.floor(px + x) + size) % size); h[i] -= 0.9 * Math.exp(-d2 * 1.6);
    }
  }
  for (let fam = 0; fam < 2; fam++) for (let n = 0; n < lines; n++) {
    const a = (fam ? 0.62 : -0.55) + (R() - 0.5) * 0.2, off = R() * size, depth = 0.25 + R() * 0.3;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = ((x * sa - y * ca + off) % (size / 6) + size / 6) % (size / 6) - size / 12;
      if (Math.abs(d) < 2.2) h[y * size + x] -= depth * Math.exp(-d * d / 1.6) * 0.12;
    }
  }
  for (let i = 0; i < h.length; i++) h[i] += (R() - 0.5) * 0.05;   // a fine tooth
  return canvasTex(size, (k) => {
    const img = k.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (xx, yy) => h[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
      img.data[i] = 128 + (-dx / l) * 127; img.data[i + 1] = 128 + (dy / l) * 127; img.data[i + 2] = 128 + (1 / l) * 127; img.data[i + 3] = 255;
    }
    k.putImageData(img, 0, 0);
  });
};
const cache = {};

// ── the rig ─────────────────────────────────────────────────────────────────
export const createStudio = (renderer, scene, { key = 2.6, rim = 3.2, fill = 0.55, env = 0.9, keyDir = [-0.6, 0.9, 0.7], rimDir = [0.55, 0.35, -0.9] } = {}) => {
  // a procedural HDR: a dark violet studio with two large softboxes and a cool strip (reflections, sheen, clearcoat)
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x0d0820);
  const box = (w, h, color, k, pos, look = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); envScene.add(m); };
  box(6, 4, 0xfff1e4, 6, [-6, 7, 6]);        // the key softbox, warm white, large
  box(2, 8, 0xd9ecff, 4, [7, 3, -7]);        // the rim strip, cool
  box(10, 2, 0x6b4fd8, 1.2, [0, -6, 4]);     // the violet floor bounce
  box(3, 3, 0x5ff2e8, 0.8, [8, -2, 6]);      // a faint cyan kicker (the instrument's colour)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = envTex;
  const kL = new THREE.DirectionalLight(0xfff0e2, key), rL = new THREE.DirectionalLight(0xe4efff, rim), fL = new THREE.HemisphereLight(0xb8a8ff, 0x2a1a40, fill);
  const place = (L, d, k = 40) => L.position.set(d[0] * k, d[1] * k, d[2] * k);
  place(kL, keyDir); place(rL, rimDir);
  scene.add(kL, rL, fL, kL.target, rL.target);
  const S = {
    key: kL, rim: rL, fill: fL, env: envTex,
    // aim the rig at a point (lights are directional: their target sets the direction)
    aim(p, kd = keyDir, rd = rimDir, k = 40) { kL.target.position.set(...p); rL.target.position.set(...p); kL.position.set(p[0] + kd[0] * k, p[1] + kd[1] * k, p[2] + kd[2] * k); rL.position.set(p[0] + rd[0] * k, p[1] + rd[1] * k, p[2] + rd[2] * k); },
    set({ key: a = key, rim: b = rim, fill: c = fill, env: e = env, warm = 0 } = {}) {
      kL.intensity = a; rL.intensity = b; fL.intensity = c; scene.environmentIntensity = e;   // r160: per-material envMapIntensity; set below
      kL.color.setRGB(1, 0.94 - 0.06 * warm, 0.88 - 0.16 * warm);
      scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial && o.material.userData.env !== false) o.material.envMapIntensity = e * (o.material.userData.envK ?? 1); });
    },
  };
  S.set({});
  return S;
};

// ── materials ───────────────────────────────────────────────────────────────
// tone: [r, g, b] linear base (from section.js toneColor or the episode); scatter follows the tone (deeper tones scatter
// a deeper red-brown), so no tone is "the" skin
export const skinMaterial = ({ tone = [0.62, 0.42, 0.3], oil = 0.25, hydration = 0.3, micro = 1, seed = 3, repeat = 6, vertexColors = false } = {}) => {
  const key = `n${seed}`; cache[key] = cache[key] || microNormal(seed);
  const nm = cache[key].clone(); nm.needsUpdate = true; nm.repeat.set(repeat, repeat);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(...tone), vertexColors, roughness: 0.48 - 0.18 * hydration, metalness: 0,
    sheen: 0.18, sheenRoughness: 0.6, sheenColor: new THREE.Color(1, 0.86, 0.78),
    clearcoat: 0.12 + 0.5 * oil, clearcoatRoughness: 0.35 - 0.2 * hydration,
    // no transmission on skin: a transmissive material costs a second scene pass per motion-blur sample (≈ 2× the frame);
    // the subsurface look comes from the warm sheen, a soft specular and the scene's warm fill instead
    attenuationColor: new THREE.Color(Math.min(1, tone[0] * 1.6 + 0.25), tone[1] * 0.75, tone[2] * 0.6), attenuationDistance: 0.8,
    normalMap: nm, normalScale: new THREE.Vector2(0.55 * micro, 0.55 * micro),
    specularIntensity: 0.4, specularColor: new THREE.Color(1, 0.97, 0.95),
  });
  m.userData.envK = 0.8;
  return m;
};
export const cellMaterial = ({ tint = [0.8, 0.86, 1.0], opacity = 0.88 } = {}) => {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...tint), roughness: 0.18, metalness: 0, transmission: 0.72, thickness: 0.8, ior: 1.37,
    attenuationColor: new THREE.Color(...tint), attenuationDistance: 1.5, clearcoat: 0.6, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color(...tint), transparent: true, opacity });
  m.userData.envK = 1.2; return m;
};
// a glowing nucleus inside a cell (emissive, so the bloom lifts it through the translucent body)
export const nucleusMaterial = ({ color = "#C3A6FF", k = 1.4 } = {}) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(color).multiplyScalar(k), roughness: 0.5 });
export const strandMaterial = ({ tint = [0.95, 0.86, 0.78], gloss = 0.8 } = {}) => {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...tint), roughness: 0.32 - 0.2 * gloss, metalness: 0, transmission: 0.35, thickness: 1.0, ior: 1.42,
    attenuationColor: new THREE.Color(...tint), attenuationDistance: 2.0, clearcoat: gloss, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: new THREE.Color(1, 0.95, 0.9) });
  m.userData.envK = 1.1; return m;
};
export const fluidMaterial = ({ tint = [0.97, 0.97, 1.0], k = 1 } = {}) => {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...tint), roughness: 0.05, metalness: 0, transmission: 0.95 * k, thickness: 0.6, ior: 1.33, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.9 });
  m.userData.envK = 1.4; return m;
};

// ── volumetric light ────────────────────────────────────────────────────────
const shaftTex = () => canvasTex(128, (k, s) => {
  const g = k.createLinearGradient(0, 0, s, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
  k.fillStyle = g; k.fillRect(0, 0, s, s);
  const v = k.createLinearGradient(0, 0, 0, s); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.25, "rgba(0,0,0,1)"); v.addColorStop(1, "rgba(0,0,0,0.35)");
  k.globalCompositeOperation = "destination-in"; k.fillStyle = v; k.fillRect(0, 0, s, s);
});
export const createShaft = ({ from = [0, 10, 0], to = [0, 0, 0], radius = 1.5, color = "#C3A6FF", n = 3 } = {}) => {
  cache.shaft = cache.shaft || shaftTex();
  const g = new THREE.Group(), a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b);
  const mats = [];
  for (let i = 0; i < n; i++) {   // a few crossed cards make a soft volume from any angle
    const mat = new THREE.MeshBasicMaterial({ map: cache.shaft, color: new THREE.Color(color), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2 * (1 + i * 0.35), len), mat);
    m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
    m.rotateY((i / n) * Math.PI); g.add(m); mats.push(mat);
  }
  return { group: g, set({ op = 1 } = {}) { g.visible = op > 0.002; mats.forEach((m, i) => (m.opacity = (0.16 / (1 + i * 0.6)) * op)); } };
};

// ── finish: film grain over the frame (a DOM layer, deterministic in t) ─────
export const createGrain = (root, { amount = 0.06, size = 256 } = {}) => {
  const c = document.createElement("canvas"); c.width = c.height = size;
  Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "overlay", opacity: String(amount * 8), zIndex: 0, imageRendering: "pixelated" });
  root.appendChild(c);
  const k = c.getContext("2d"), img = k.createImageData(size, size);
  return {
    set(t) {
      const R = rng(1 + Math.floor(t * 30));
      for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (R() - 0.5) * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      k.putImageData(img, 0, 0);
    },
  };
};

// ── the colour script: each episode's grade (exposure and key warmth by act); the scenes read it ──
export const colourScript = {
  "001": { open: { exposure: 1.05, warm: 0.2 }, inside: { exposure: 1.0, warm: 0.45 }, payoff: { exposure: 1.1, warm: 0.0 } },
  "002": { open: { exposure: 1.08, warm: 0.6 }, inside: { exposure: 1.0, warm: 0.7 }, payoff: { exposure: 1.08, warm: 0.5 } },
  "003": { open: { exposure: 1.05, warm: 0.4 }, inside: { exposure: 1.0, warm: 0.2 }, payoff: { exposure: 1.06, warm: 0.0 } },
  "004": { open: { exposure: 1.05, warm: 0.3 }, inside: { exposure: 0.98, warm: 0.1 }, payoff: { exposure: 1.06, warm: 0.2 } },
  "005": { open: { exposure: 1.1, warm: 0.5 }, inside: { exposure: 1.02, warm: 0.3 }, payoff: { exposure: 1.06, warm: 0.0 } },
  "006": { open: { exposure: 1.05, warm: 0.4 }, inside: { exposure: 1.0, warm: 0.3 }, payoff: { exposure: 1.06, warm: 0.0 } },
};
