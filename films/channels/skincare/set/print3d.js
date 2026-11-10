// print3d.js — Skin Sense S2 E6 ("Fingerprints form before you're born") as a 3-D scene in the owner's art (shared base: w3d.js).
// Sets, hard-cut between, every one always moving:
//   P  a fingertip pad whose ridges GROW: three starting places, waves spreading outward, meeting to make the pattern (a phase field redrawn each frame)
//   S  a section of the pad's base: the boundary between the layers ripples into bands as two signals (a teal "push" and a rose "pull") trade places
//   R  ripples spreading on sand (the metaphor): rings from three places crossing on a plain surface, then the same rings frozen as ridges
//   V  three pads (a loop, a whorl, an arch) turning side by side: endless variety
// Units ≈ 1 mm of an illustrated pad. Pure function of t. create() returns { seek, anchor } for ss3.mjs.
import { world, THREE, clamp, seg, sm, eo, eio, lerp, hash } from "./w3d.js";

export async function create(args) {
  const W3 = await world(args), { renderer, scene, camera, mkCanvas, rnd, tex, fibres, makeTube, NV, mkGlow, glowTex, key, T, AW, BH, BTOP } = W3;
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.5, ...o });
  const groups = { P: new THREE.Group(), S: new THREE.Group(), R: new THREE.Group(), V: new THREE.Group() }, CX = { P: 0, S: 40, R: 80, V: 120 };
  for (const k in groups) { groups[k].position.x = CX[k]; scene.add(groups[k]); }
  const SKH = T.skinHex || "#7a4326", SKR = [1, 3, 5].map((i) => parseInt(SKH.slice(i, i + 2), 16));
  const back = (g, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshBasicMaterial({ color: 0xf5ece0 })); m.position.z = z; g.add(m); };

  // ── a pad: an ellipsoid-like slab whose ridges are a phase field, drawn to a canvas texture (colour + bump) ───────
  const RES = 256;
  const makePad = (kind) => {
    const col = mkCanvas(RES, RES), bump = mkCanvas(RES, RES), cg = col.getContext("2d"), bg = bump.getContext("2d"), ci = cg.createImageData(RES, RES), bi = bg.createImageData(RES, RES);
    const ct = tex(col, [1, 1]), bt = tex(bump, [1, 1]); ct.wrapS = ct.wrapT = bt.wrapS = bt.wrapT = THREE.ClampToEdgeWrapping;
    const m = mat({ map: ct, bumpMap: bt, bumpScale: 7, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0.9, 0.55, 0.35), clearcoat: 0.12, clearcoatRoughness: 0.45, color: new THREE.Color(1, 1, 1) });
    // phase field for a pattern kind: whorl (concentric ellipses), loop (a hairpin), arch (gentle arcs)
    const phase = (x, y) => { if (kind === "whorl") return Math.hypot(x * 1.0, y * 1.25); if (kind === "loop") return Math.hypot(x * 0.9, Math.max(y + 0.2, 0) * 1.35); return Math.abs(y + 0.35 * (1 - x * x * 1.4)) * 1.2 + 0.0; };
    const N = 120, geo = new THREE.PlaneGeometry(2, 2, N, N), pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { let u = pa.getX(i), v = pa.getY(i); const r = Math.hypot(u, v), rc = Math.min(r, 1), k = r > 1 ? 1 / r : 1; pa.setXYZ(i, u * k * 3.0, 0.95 * Math.pow(Math.max(0, 1 - rc * rc), 0.6), v * k * 3.8); } geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
    const srcs = [[-0.45, -0.3, 0.0], [0.5, 0.2, 0.9], [-0.1, 0.7, 1.8]];                                  // where the waves start, and when (s after the pattern begins)
    const draw = (prog, tt) => {   // prog 0…1: how far the waves have spread; tt for a faint shimmer
      for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const x = (i / RES - 0.5) * 2, y = (j / RES - 0.5) * 2, k = (j * RES + i) * 4;
        const rr = x * x + y * y, edge = clamp((1 - rr) * 3.2);
        let reveal = 0; for (const [sx, sy, d0] of srcs) { const dd = Math.hypot(x - sx, y - sy), front = prog * 3.1 - d0 * 0.5; reveal = Math.max(reveal, clamp((front - dd) * 1.8 + 0.3)); }
        const ph = phase(x, y) * 26 * (0.9 + 0.1 * Math.sin(x * 3 + y * 2)), ridge = 0.5 + 0.5 * Math.cos(ph), v = ridge * reveal * edge;
        const base = 0.82 + 0.18 * (1 - reveal * edge * 0.5);
        ci.data[k] = SKR[0] * (base - 0.3 * v); ci.data[k + 1] = SKR[1] * (base - 0.32 * v); ci.data[k + 2] = SKR[2] * (base - 0.34 * v); ci.data[k + 3] = 255;
        const b = 128 + 120 * v; bi.data[k] = bi.data[k + 1] = bi.data[k + 2] = b; bi.data[k + 3] = 255; }
      cg.putImageData(ci, 0, 0); bg.putImageData(bi, 0, 0); ct.needsUpdate = bt.needsUpdate = true; };
    return { mesh, draw, m };
  };
  const SENS = mkGlow;

  // ── set P ───────────────────────────────────────────────────────────────────────────────────────────────────────
  back(groups.P, -10);
  const padP = makePad("whorl"); padP.mesh.rotation.x = -0.9; groups.P.add(padP.mesh);
  const seedGlow = mkGlow(3, 0xffd9a0); seedGlow.forEach((s) => groups.P.add(s));
  // ── set S: the section with a rippling boundary ────────────────────────────────────────────────────────────────────
  back(groups.S, -9);
  const SW = 16, face = new THREE.PlaneGeometry(SW, 3.5, 160, 8); face.translate(0, -1.75, 0); const fp = face.attributes.position, fx0 = new Float32Array(fp.count), fy0 = new Float32Array(fp.count); for (let i = 0; i < fp.count; i++) { fx0[i] = fp.getX(i); fy0[i] = fp.getY(i); }
  const secC = mkCanvas(512, 256), sg = secC.getContext("2d"); { const gr = sg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#e7b39a"); gr.addColorStop(1, "#f0b8a6"); sg.fillStyle = gr; sg.fillRect(0, 0, 512, 256); fibres(sg, 512, 256, 300, ["#fde4d8", "#e69a8c"], 160, 2); }
  const secM = mat({ map: tex(secC, [1, 1]), roughness: 0.55, clearcoat: 0.2 }); secM.map.wrapS = secM.map.wrapT = THREE.ClampToEdgeWrapping;
  const sec = new THREE.Mesh(face, secM); groups.S.add(sec);
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(SW, 2.5, 160, 4), mat({ color: new THREE.Color(SKH), roughness: 0.6 })); upper.geometry.translate(0, 1.25, 0); groups.S.add(upper);
  const up = upper.geometry.attributes.position, ux0 = new Float32Array(up.count), uy0 = new Float32Array(up.count); for (let i = 0; i < up.count; i++) { ux0[i] = up.getX(i); uy0[i] = up.getY(i); }
  const pushB = Array.from({ length: 18 }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat({ color: 0x6fe0d0, emissive: 0x2fb8a8, emissiveIntensity: 0.6 })); groups.S.add(s); return s; });
  const pullB = Array.from({ length: 18 }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), mat({ color: 0xf08090, emissive: 0xc04058, emissiveIntensity: 0.5 })); groups.S.add(s); return s; });
  // ── set R: ripples on a plain surface ───────────────────────────────────────────────────────────────────────────────
  back(groups.R, -9);
  const sandM = mat({ color: new THREE.Color(SKH), roughness: 0.7, clearcoat: 0.05 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(16, 12, 180, 140), sandM); sand.rotation.x = -1.1; sand.receiveShadow = true; groups.R.add(sand);
  const sp = sand.geometry.attributes.position, sx = new Float32Array(sp.count), sy = new Float32Array(sp.count); for (let i = 0; i < sp.count; i++) { sx[i] = sp.getX(i); sy[i] = sp.getY(i); }
  const RS = [[-3.2, -1.2, 0], [3, 0.8, 0.9], [-0.3, 2.6, 1.8]];
  // ── set V: three pads ─────────────────────────────────────────────────────────────────────────────────────────────
  back(groups.V, -9);
  const padsV = ["loop", "whorl", "arch"].map((k, i) => { const p = makePad(k); p.mesh.position.set((i - 1) * 7.2, 0, 0); p.mesh.rotation.x = -0.85; p.mesh.scale.multiplyScalar(0.95); groups.V.add(p.mesh); return p; });

  const prog = (t) => (t < 26 ? sm(seg(t, 5.6, 16.5)) : sm(seg(t, 27.4, 38.8)));
  const setP = (t) => { const pr = t < 20 ? sm(seg(t, 5.4, 13.8)) : t < 55 ? 1 : 1; const g = t < 27 ? pr : 1; padP.draw(g, t); padP.mesh.rotation.z = Math.sin(t * 0.35) * 0.2; padP.mesh.rotation.y = Math.sin(t * 0.27) * 0.25;
    seedGlow.forEach((s, i) => { s.position.set(-1.35 + i * 1.2, 1.4 - i * 0.5, 2.4); s.scale.setScalar(0.9 + 0.3 * Math.sin(t * 3 + i)); s.material.opacity = 0.6 * (1 - sm(seg(t, 14, 17))) * sm(seg(t, 4.4, 5.6)); }); };
  const setS = (t) => { const wave = sm(seg(t, 17.2, 24.8)); const f = (x) => 0.6 * wave * Math.sin(x * 1.9 + 0.8);
    for (let i = 0; i < fp.count; i++) fp.setY(i, fy0[i] + f(fx0[i]) * clamp(1 + fy0[i] / 1.8)); fp.needsUpdate = true; face.computeVertexNormals();
    for (let i = 0; i < up.count; i++) up.setY(i, uy0[i] + f(ux0[i]) * clamp(1 - uy0[i] / 2.5)); up.needsUpdate = true; upper.geometry.computeVertexNormals();
    pushB.forEach((s, i) => { const x = -7.5 + (i / 18) * 15 + 0.25 * Math.sin(t * 1.3 + i), y = 0.45 + f(x) + 0.14 * Math.sin(t * 3 + i * 1.7); s.position.set(x, y, 0.6); s.scale.setScalar(0.7 + 0.5 * Math.max(0, Math.sin(x * 1.9 + 0.8 - t * 0.8))); s.material.emissiveIntensity = 0.3 + 0.7 * wave; });
    pullB.forEach((s, i) => { const x = -7.5 + (i / 18) * 15 + 0.55 * Math.cos(t * 1.1 + i), y = -0.25 + f(x) + 0.14 * Math.cos(t * 3 + i * 1.7); s.position.set(x, y, 0.45); s.scale.setScalar(0.7 + 0.5 * Math.max(0, -Math.sin(x * 1.9 + 0.8 - t * 0.8))); s.material.emissiveIntensity = 0.25 + 0.6 * wave; }); };
  const setR = (t) => { const frozen = sm(seg(t, 37.5, 40)) * 0, pr = clamp((t - 33.4) / 6);
    for (let i = 0; i < sp.count; i++) { const x = sx[i], y = sy[i]; let h = 0; for (const [cx, cy, d0] of RS) { const d = Math.hypot(x - cx, y - cy), front = (t - 33.4 - d0 * 0.7) * 2.6, env = clamp(1 - Math.abs(d - front) / 5.5) * (d < front ? 1 : 0); h += 0.14 * Math.sin(d * 5.2 - (t - 33.4) * 5.5) * env; } sp.setZ(i, h); }
    sp.needsUpdate = true; sand.geometry.computeVertexNormals(); };
  const setV = (t) => { padsV.forEach((p, i) => { p.draw(1, t); p.mesh.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.25; p.mesh.rotation.y = Math.sin(t * 0.4 + i) * 0.4; p.mesh.position.y = 0.2 * Math.sin(t * 0.7 + i); }); };

  const V = new THREE.Vector3();
  const ANC = { seed: () => [CX.P - 1.3, 1.3, 2.4], wave: () => [CX.S + 0.5, 0.5, 0.6] };
  let curSc = "P";
  return {
    renderer,
    seek(t) {
      const c = T.coverCam ? { ...T.coverCam, roll: 0, sc: T.coverCam.sc || "P" } : W3.camAt(t); curSc = c.sc || "P"; for (const k in groups) groups[k].visible = k === curSc;
      W3.camPose(t, c);
      if (T.coverP) padP.draw(1, 0); else if (curSc === "P") setP(t); else if (curSc === "S") setS(t); else if (curSc === "R") setR(t); else setV(t);
      const cx = CX[curSc]; key.target.position.set(cx, 0, 0); key.position.set(cx - 9, 11, 11); key.target.updateMatrixWorld(); W3.paintSet(t);
      W3.render(c);
    },
    anchor(name, t) { const f = ANC[name]; if (!f) return null; const p = f(); V.set(p[0], p[1], p[2]).project(camera); if (V.z > 1) return null; return [AW / 2 * (V.x + 1), BTOP + BH / 2 * (1 - V.y)]; },
  };
}
