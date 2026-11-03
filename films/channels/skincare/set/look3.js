// look3.js — Skin Sense look v3 (films/channels/skincare/set; new 3 Nov): the second pass on the shared skin, hairs and
// grain, after the reviewers' notes on v2. Opt-in; a separate file so nothing that imports prod.js changes.
//
//   lookV3({ canvas, hudRoot, fog, terrain, skin, grain, groom, groomDir })
//     = lookV2 + skinV3 + hairsV3 + finer grain + a real black point
//   skinV3(material, { scatter, keyDir })   a warm terminator (light wrapping round the form and scattering red just
//                                           past the edge of the key, no transmission) and broken, oily micro-speculars
//                                           (low-roughness flecks in a dry matte field) instead of one uniform sheen
//   hairsV3(terrain, { groom, dir, root, tip })   tapered strands, dark at the root, pale and translucent at the tip
//                                           (backlight glows through it); groom "lateral" lays them along dir (brows)
//   grainV3(root, { amount })               fine grain that sits in the midtones (soft-light), not a flat overlay
import * as THREE from "three";
import { lookV2, upgradeSkin } from "./prod.js";

const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

export const skinV3 = (m, { scatter = [0.85, 0.22, 0.12], scatterK = 0.55, keyDir = [-0.45, 0.6, 0.65] } = {}) => {
  if (!m || m.userData.v3) return m;
  upgradeSkin(m); m.userData.v3 = true;
  // oily flecks: a speckled roughness field (most of the surface dry and matte, small flecks glossy)
  const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d"), R = rng(123);
  x.fillStyle = "rgb(190,190,190)"; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) { const px = R() * S, py = R() * S, r = 0.6 + R() * 2.2, g = x.createRadialGradient(px, py, 0, px, py, r * 2); g.addColorStop(0, "rgba(40,40,40,0.95)"); g.addColorStop(1, "rgba(190,190,190,0)"); x.fillStyle = g; x.fillRect(px - r * 2, py - r * 2, r * 4, r * 4); }
  const rt = new THREE.CanvasTexture(cv); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(9, 9);
  m.roughnessMap = rt; m.roughness = 0.75; m.sheen = 0.25; m.specularIntensity = 0.45; m.clearcoat = 0.05;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r);
    sh.uniforms.uScat = { value: new THREE.Color(...scatter) }; sh.uniforms.uScatK = { value: scatterK }; sh.uniforms.uKey = { value: new THREE.Vector3(...keyDir).normalize() };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uScat; uniform float uScatK; uniform vec3 uKey;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  { vec3 Lv = normalize((viewMatrix * vec4(uKey, 0.0)).xyz); float nl = dot(normalize(vNormal), Lv);
    float term = smoothstep(-0.35, 0.05, nl) * (1.0 - smoothstep(0.05, 0.55, nl));   // the band just past the key's edge
    totalEmissiveRadiance += uScat * uScatK * term * diffuseColor.rgb; }`);
  };
  m.customProgramCacheKey = () => "skinV3";
  m.needsUpdate = true;
  return m;
};

export const hairsV3 = (terrain, { groom = "upright", dir = [1, 0, 0], root = [0.16, 0.09, 0.06], tip = [0.92, 0.78, 0.6], seed = 91 } = {}) => {
  let hairs = null; terrain.group.traverse((o) => { if (o.isInstancedMesh && !hairs) hairs = o; });
  if (!hairs || hairs.userData.v3) return hairs;
  hairs.userData.v3 = true;
  // a long taper, a slight bend, and a colour ramp: dark root to pale tip
  const g = new THREE.CylinderGeometry(0.004, 0.055, 1, 8, 10, false).translate(0, 0.5, 0), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.07 * y * y); const k = Math.pow(y, 1.6); col.push(root[0] + (tip[0] - root[0]) * k, root[1] + (tip[1] - root[1]) * k, root[2] + (tip[2] - root[2]) * k); }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  hairs.geometry.dispose(); hairs.geometry = g;
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.3, sheen: 0.7, sheenRoughness: 0.3, sheenColor: new THREE.Color(1, 0.85, 0.65), clearcoat: 0.35, clearcoatRoughness: 0.2 });
  // the tip glows when backlit (light through a thin keratin strand): view-aligned rim on the paler end
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vH;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvH = position.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vH;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  { float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.0); totalEmissiveRadiance += vec3(1.0, 0.72, 0.45) * 0.55 * rim * smoothstep(0.45, 1.0, vH); }");
  };
  mat.customProgramCacheKey = () => "hairV3";
  hairs.material = mat;
  const R = rng(seed), c = new THREE.Color(), M = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const lay = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
  for (let i = 0; i < hairs.count; i++) {
    const v = 0.75 + 0.5 * R(); c.setRGB(v, v * (0.94 + 0.08 * R()), v * (0.88 + 0.1 * R())); hairs.setColorAt(i, c);
    if (groom === "lateral") {   // brows: laid along dir, lifted a little, fanned
      hairs.getMatrixAt(i, M); M.decompose(pos, q, s);
      const fan = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * 0.25, (R() - 0.5) * 0.5, 0.18 + R() * 0.15));
      q.copy(lay).multiply(fan); s.y *= 0.8; M.compose(pos, q, s); hairs.setMatrixAt(i, M);
    }
  }
  if (hairs.instanceColor) hairs.instanceColor.needsUpdate = true; hairs.instanceMatrix.needsUpdate = true;
  return hairs;
};

export const grainV3 = (root, { amount = 0.015, size = 512 } = {}) => {
  const c = document.createElement("canvas"); c.width = c.height = size;
  Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "soft-light", opacity: String(amount * 6), zIndex: 0 });
  root.insertBefore(c, root.firstChild);
  const k = c.getContext("2d"), img = k.createImageData(size, size);
  return { set(t) { const R = rng(1 + Math.floor(t * 30)); for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (R() + R() - 1) * 110; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } k.putImageData(img, 0, 0); } };
};

export const lookV3 = ({ canvas, hudRoot, fog, terrain, skin, groom = "upright", groomDir = [1, 0, 0], grain = 0.015, ...rest } = {}) => {
  const look = lookV2({ canvas, hudRoot, fog, ...rest });   // backdrop, fog, grade (skin and hairs done here instead)
  if (skin) skinV3(skin);
  if (terrain) hairsV3(terrain, { groom, dir: groomDir });
  if (canvas) canvas.style.filter = "contrast(1.1) brightness(0.97) saturate(1.04)";   // a real black point under the grade
  const gr = hudRoot && grain > 0 ? grainV3(hudRoot, { amount: grain }) : null;
  return { ...look, grain: gr };
};
