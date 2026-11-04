// prod.js — the production pass for Skin Sense (films/channels/skincare/set): the pieces that keep a frame from
// reading as a default render. New in the rebuild (3 Nov); nothing older imports it, so earlier films are unchanged.
//
//   backdropCss(canvas, { top, bottom })           the graded volume as the page behind the transparent canvas (use this;
//                                                  the 3D dome below confuses the depth-of-field pass)
//   backdrop(scene, { top, bottom, at, r })        a graded dome instead of a flat clear colour: deep violet falling to
//                                                  near-black, so every set sits in a lit volume, not a void
//   hazeVolume(scene, { at, size, color, n, op })  stacked soft planes (a volume of haze the key light reads through)
//   richen(group, { seed, jitter, hue, micro })    repeated instances made individual (scale, tilt, tone); materials
//                                                  given a micro normal and env response, in place (scenes recolour them)
//   grade(root, { vignette, warm, cool })          one grade for the whole film: a soft vignette and a split tone,
//                                                  drawn over the picture, under the type
//   bokeh(scene, { n, box, size, color })          out-of-focus specks far behind the subject (the lens reads them)
import * as THREE from "three";
import { skinMaterial } from "./studio.js";

const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

export const backdropCss = (canvas, { top = "#3b2479", bottom = "#06030c" } = {}) => {   // the same grade as a page background behind the (transparent) canvas: no depth, no DOF artefacts
  canvas.style.background = `radial-gradient(ellipse 120% 80% at 50% 18%, ${top} 0%, rgba(0,0,0,0) 70%), linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
  return { set({ on = true } = {}) { canvas.style.background = on ? canvas.style.background : "none"; } };
};

export const backdrop = (scene, { top = "#3a2378", bottom = "#07040d", at = [0, 0, 0], r = 40000 } = {}) => {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color(top) }, uBot: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop, uBot; varying vec3 vP;
      void main() { float k = smoothstep(-0.55, 0.75, vP.y); vec3 c = mix(uBot, uTop, k * k); c += 0.025 * (1.0 - abs(vP.x)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), m);
  mesh.position.set(...at); mesh.renderOrder = -10; mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, set({ at: p } = {}) { if (p) mesh.position.set(...p); } };
};

const hazeTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d"), R = rng(11);
    x.fillStyle = "#000"; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { const px = R() * S, py = R() * S, pr = 20 + R() * 70, g = x.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, `rgba(255,255,255,${0.05 + R() * 0.08})`); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, S, S); }
    const e = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5); e.addColorStop(0, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out"; x.fillStyle = e; x.fillRect(0, 0, S, S);
    t = new THREE.CanvasTexture(cv); return t;
  };
})();

export const hazeVolume = (scene, { at = [0, 0, 0], size = [1000, 600, 600], color = "#b9a6ff", n = 6, op = 0.12 } = {}) => {
  const g = new THREE.Group(); g.position.set(...at);
  const mats = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ map: hazeTex(), color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), m);
    p.position.z = -size[2] / 2 + (i + 0.5) * size[2] / n; p.position.x = (i % 2 ? 1 : -1) * size[0] * 0.06; p.rotation.z = i * 0.7;
    g.add(p); mats.push(m);
  }
  scene.add(g);
  return { group: g, set({ op: o = op, t = 0, at: p } = {}) { if (p) g.position.set(...p); g.children.forEach((c, i) => { c.rotation.z = i * 0.7 + 0.02 * t * (i % 2 ? 1 : -1); }); mats.forEach((m) => { m.opacity = o; }); } };
};

export const richen = (group, { seed = 5, jitter = 0.12, hue = 0.06, micro = 0.5, sheen = 0.3, clearcoat = 0.2, tilt = 0.12, skip = null } = {}) => {
  const R = rng(seed * 7919 + 1), dummy = new THREE.Object3D(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const nm = skinMaterial({ micro, seed: seed + 3, repeat: 3 }).normalMap;
  // in place: the scene's own code keeps recolouring these materials every frame, so they stay the same objects
  const seen = new Set();
  const phys = (m) => {
    if (!m || !m.isMeshStandardMaterial || seen.has(m)) return m;
    seen.add(m); m.normalMap = nm; m.normalScale = new THREE.Vector2(0.35, 0.35); m.envMapIntensity = Math.max(m.envMapIntensity ?? 1, 0.6);
    if (m.isMeshPhysicalMaterial) { m.sheen = Math.max(m.sheen, sheen); m.clearcoat = Math.max(m.clearcoat, clearcoat); }
    m.needsUpdate = true; return m;
  };
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) o.material = o.material.map(phys); else o.material = phys(o.material);
    if (o.isInstancedMesh) {
      const M = new THREE.Matrix4(), c = new THREE.Color(), base = o.material.color ? o.material.color.clone() : new THREE.Color(1, 1, 1);
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M); M.decompose(dummy.position, q, dummy.scale);
        const s = 1 + (R() - 0.5) * 2 * jitter; dummy.scale.multiplyScalar(s);
        const tk = skip && skip(o) ? 0 : tilt; e.setFromQuaternion(q); e.x += (R() - 0.5) * tk; e.z += (R() - 0.5) * tk; dummy.quaternion.setFromEuler(e);
        dummy.updateMatrix(); o.setMatrixAt(i, dummy.matrix);
        const v = 1 + (R() - 0.5) * 2 * hue; c.setRGB(v * (1 + (R() - 0.5) * hue), v, v * (1 + (R() - 0.5) * hue)); o.setColorAt(i, c);
      }
      o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true;
      void base;
    }
  });
};

export const grade = (root, { vignette = 0.55, warm = "rgba(255,170,120,0.06)", cool = "rgba(40,20,90,0.22)" } = {}) => {
  const d = document.createElement("div");
  Object.assign(d.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: 0,
    background: `radial-gradient(ellipse 85% 75% at 50% 46%, rgba(0,0,0,0) 55%, rgba(6,3,14,${vignette}) 100%), linear-gradient(180deg, ${warm} 0%, rgba(0,0,0,0) 45%, ${cool} 100%)` });
  root.insertBefore(d, root.firstChild);
  return { el: d, set({ op = 1 } = {}) { d.style.opacity = String(op); } };
};

export const bokeh = (scene, { n = 140, box = [[-1, 1], [-1, 1], [-1, 1]], size = 40, color = "#d8ccff", seed = 3, op = 0.5 } = {}) => {
  const R = rng(seed), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[3 * i + k] = box[k][0] + R() * (box[k][1] - box[k][0]);
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)"); g.addColorStop(0.6, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), color: new THREE.Color(color), size, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts);
  return { points: pts, set({ op: o = op, t = 0 } = {}) { m.opacity = o; pts.rotation.y = 0.004 * t; } };
};

// ── look v2: the channel-level production pass (3 Nov). One call per episode; everything opt-in, so films that don't
// call it are unchanged.
//   lookV2({ canvas, hudRoot, fog, terrain, skin })  → { grade, backdrop }
//     skin:    a skinMaterial (studio.js), upgraded in place: less clay, less plastic. A softer, broader specular, a
//              little clearcoat, roughness that varies across the surface, and a warm translucent edge (light that
//              went in coming back out at grazing angles) in place of the flat sheen
//     terrain: a createTerrain (terrain.js): hairs become tapered, glossy, individually tinted strands (not sticks)
//     scene:   its fog is retinted to the backdrop's deep violet and thickened, so the horizon melts into the volume
//     canvas / hudRoot: the graded backdrop behind the canvas, one grade over the picture (vignette, split tone,
//              deeper blacks)
export const upgradeSkin = (m, { edge = [1.0, 0.45, 0.35], edgeK = 0.35 } = {}) => {
  if (!m || m.userData.v2) return m;
  m.userData.v2 = true;
  m.clearcoat = Math.min(m.clearcoat, 0.12); m.clearcoatRoughness = 0.45; m.specularIntensity = 0.28; m.sheen = 0.45; m.sheenRoughness = 0.7;
  m.sheenColor = new THREE.Color(1.0, 0.72, 0.62); m.roughness = Math.max(m.roughness, 0.5);
  // roughness that varies (oilier on the crests, drier in the furrows): a soft noise map
  const S = 128, cv = document.createElement("canvas"); cv.width = cv.height = S; const x = cv.getContext("2d"), R = rng(77), img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 150 + 70 * (R() - 0.5) + 35 * Math.sin(i % S / 9) * Math.cos(Math.floor(i / S) / 11); img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = Math.max(0, Math.min(255, v)); img.data[4 * i + 3] = 255; }
  x.putImageData(img, 0, 0); const rt = new THREE.CanvasTexture(cv); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(5, 5); m.roughnessMap = rt;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: new THREE.Color(...edge) }; sh.uniforms.uEdgeK = { value: edgeK };
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uEdge; uniform float uEdgeK;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  { float fr = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.2); totalEmissiveRadiance += uEdge * uEdgeK * fr * diffuseColor.rgb; }");
  };
  m.customProgramCacheKey = () => "skinV2";
  m.needsUpdate = true;
  return m;
};

export const upgradeHairs = (terrain, { color = [0.32, 0.2, 0.13] } = {}) => {
  let hairs = null; terrain.group.traverse((o) => { if (o.isInstancedMesh && !hairs) hairs = o; });
  if (!hairs || hairs.userData.v2) return hairs;
  hairs.userData.v2 = true;
  // a tapered strand with a slight bend, 8 sides: reads as hair under the lens, not as a stick
  const g = new THREE.CylinderGeometry(0.012, 0.05, 1, 8, 6, false).translate(0, 0.5, 0), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.06 * y * y); }
  g.computeVertexNormals(); hairs.geometry.dispose(); hairs.geometry = g;
  hairs.material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(...color), roughness: 0.32, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0.9, 0.75, 0.6), clearcoat: 0.3, clearcoatRoughness: 0.25 });
  const R = rng(91), c = new THREE.Color();
  for (let i = 0; i < hairs.count; i++) { const v = 0.7 + 0.6 * R(); c.setRGB(v, v * (0.92 + 0.1 * R()), v * (0.85 + 0.12 * R())); hairs.setColorAt(i, c); }
  if (hairs.instanceColor) hairs.instanceColor.needsUpdate = true;
  return hairs;
};

export const lookV2 = ({ canvas, hudRoot, scene, fog = scene && scene.fog, terrain, skin, fogColor = 0x1a0d36, top = "#3b2479", bottom = "#06030c", vignette = 0.5 } = {}) => {
  if (skin) upgradeSkin(skin);
  if (terrain) upgradeHairs(terrain);
  if (fog) { fog.color.set(fogColor); if (fog.isFog) { fog.near *= 0.8; fog.far *= 0.85; } }   // pass the episode's fog (scenes park it while sets without fog are up)
  const bd = canvas ? backdropCss(canvas, { top, bottom }) : null;
  if (canvas) canvas.style.filter = "contrast(1.06) saturate(1.03)";   // deeper blacks under the grain; one grade
  const gr = hudRoot ? grade(hudRoot, { vignette }) : null;
  return { grade: gr, backdrop: bd };
};
