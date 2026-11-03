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

export const richen = (group, { seed = 5, jitter = 0.12, hue = 0.06, micro = 0.5, sheen = 0.3, clearcoat = 0.2 } = {}) => {
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
        e.setFromQuaternion(q); e.x += (R() - 0.5) * 0.12; e.z += (R() - 0.5) * 0.12; dummy.quaternion.setFromEuler(e);
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
