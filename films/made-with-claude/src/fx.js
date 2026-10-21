/* ═══════════════════════════════════════════════════════════
   Effects — every one is a pure function of t (seeded PRNG):
   sprite voxels, glass shards + sparks, playhead, beams,
   keyframes + rings, the Glow streak, contact shadow.
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SPRITE, SPRITE_PX, rowY, TL } from "./ui.js";

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const easeInOut = (p) => { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
const backOut = (p) => { p = clamp01(p); const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

function emissive(color, intensity) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: true });
}

export function buildFX(J, world, scene) {
  const fx = {};
  const dummy = new THREE.Object3D();

  /* ── sprite voxels ── */
  const vox = [];
  SPRITE.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") vox.push({ i, j, eye: ch === "E" }); }));
  const s = SPRITE_PX / J.ui.unitsPerWorld;               // 0.12 world
  const spriteW = world(J.mascot[0].at[0], J.mascot[0].at[1]);
  const pivotZ = spriteW.z + (SPRITE.length / 2) * s;      // southern (feet) edge
  const voxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  const voxMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#d97757"), roughness: 0.5, emissive: new THREE.Color("#e3805f"), emissiveIntensity: 0 });
  const voxInk = new THREE.MeshStandardMaterial({ color: new THREE.Color("#140b08"), roughness: 0.3 });
  const vBody = new THREE.InstancedMesh(voxGeo, voxMat, vox.length);
  const vEye = new THREE.InstancedMesh(voxGeo, voxInk, vox.length);
  [vBody, vEye].forEach((m) => { m.castShadow = true; m.frustumCulled = false; scene.add(m); });
  const W = SPRITE[0].length, H = SPRITE.length;
  fx.voxels = (t) => {
    const ex = J.mascot.find((m) => m.type === "extrude");
    const on = t >= ex.t0 && t < ex.t1 - 0.02;
    vBody.visible = vEye.visible = on;
    if (!on) return;
    const pA = (t - ex.t0) / 0.3;                            // extrude 1.50–1.80
    const pB = easeInOut((t - (ex.t0 + 0.28)) / 0.15);       // stand up 1.78–1.93
    const flash = clamp01((t - (ex.t1 - 0.08)) / 0.05);      // glow hot, then collapse into the mascot
    voxMat.emissiveIntensity = 0.35 * (1 - clamp01(pA)) + 0.25 * clamp01(pA) + 3.0 * flash;
    const theta = (-Math.PI / 2) * (1 - pB);                 // lying → standing about the feet line
    let nb = 0, ne = 0;
    vox.forEach((v, k) => {
      const dist = Math.hypot(v.i - W / 2 + 0.5, v.j - H / 2 + 0.5) / 7;
      const grow = easeOut((pA - dist * 0.45) / 0.55);
      const depth = 0.02 + (v.eye ? 0.66 : 0.62) * grow;      // thickness (local z when standing)
      const lx = (v.i - W / 2 + 0.5) * s;
      const ly = (H - 1 - v.j + 0.5) * s;                    // bottom row at the feet line
      const lz = depth / 2;
      // rotate (ly, lz) by theta about x: lying flat → y-up points north (-z)
      const c = Math.cos(theta), sn = Math.sin(theta);
      const y = ly * c - lz * sn, z = ly * sn + lz * c;
      const shrink = 1 - 0.8 * clamp01((t - (ex.t1 - 0.04)) / 0.02);
      dummy.position.set(spriteW.x + lx, Math.max(y, 0) + 0.004, pivotZ + z);
      dummy.rotation.set(theta, 0, 0);
      dummy.scale.set(s * 0.98 * shrink, s * 0.98 * shrink, depth * shrink);
      // lying flat: depth is along world y; standing: along world z
      dummy.updateMatrix();
      if (v.eye) vEye.setMatrixAt(ne++, dummy.matrix); else vBody.setMatrixAt(nb++, dummy.matrix);
    });
    vBody.count = nb; vEye.count = ne;
    vBody.instanceMatrix.needsUpdate = true; vEye.instanceMatrix.needsUpdate = true;
  };

  /* ── shards + sparks ── */
  const SH = J.shards;
  const rnd = mulberry32(SH.seed);
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.6, -0.5, 0, -0.4, 0.55, 0, -0.3], 3));
  triGeo.computeVertexNormals();
  const shardMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#cfd9e6"), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.62, side: THREE.DoubleSide, envMapIntensity: 1.8, clearcoat: 1 });
  const shards = new THREE.InstancedMesh(triGeo, shardMat, SH.count);
  shards.frustumCulled = false; scene.add(shards);
  const center = new THREE.Vector3(spriteW.x, 0, spriteW.z);
  const sd = [];
  for (let i = 0; i < SH.count; i++) {
    const a = rnd() * Math.PI * 2, r = 0.15 + rnd() * 1.6;
    const p0 = new THREE.Vector3(center.x + Math.cos(a) * r * 1.4, 0.02, center.z + Math.sin(a) * r * 0.8);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const sp = 2.2 + rnd() * 4.5;
    sd.push({ p0, v: new THREE.Vector3(out.x * sp, 3.5 + rnd() * 6.5, out.z * sp + 1.6), w: new THREE.Vector3(rnd() * 14 - 7, rnd() * 14 - 7, rnd() * 14 - 7), size: 0.08 + Math.pow(rnd(), 1.6) * 0.42, delay: r * 0.02 });
  }
  const sparkGeo = new THREE.BoxGeometry(1, 1, 1);
  const sparkMat = emissive("#ffb488", 3.2);
  const SPN = 46;
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, SPN);
  sparks.frustumCulled = false; scene.add(sparks);
  const spd = [];
  for (let i = 0; i < SPN; i++) {
    const a = rnd() * Math.PI * 2, sp = 3 + rnd() * 7;
    spd.push({ v: new THREE.Vector3(Math.cos(a) * sp, 4 + rnd() * 8, Math.sin(a) * sp * 0.7 + 1.2), size: 0.025 + rnd() * 0.05, life: 0.5 + rnd() * 0.7 });
  }
  const g = 13;
  fx.shards = (t) => {
    const dt = t - SH.t;
    const on = dt >= 0 && dt < 2.2;
    shards.visible = sparks.visible = on;
    if (!on) return;
    sd.forEach((d, i) => {
      const tt = Math.max(0, dt - d.delay);
      dummy.position.set(d.p0.x + d.v.x * tt, d.p0.y + d.v.y * tt - 0.5 * g * tt * tt, d.p0.z + d.v.z * tt);
      dummy.rotation.set(d.w.x * tt, d.w.y * tt, d.w.z * tt);
      const fade = dummy.position.y < -0.6 ? 0 : 1;
      dummy.scale.setScalar(d.size * (tt > 0 ? 1 : 0.001) * fade);
      dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix);
    });
    shards.instanceMatrix.needsUpdate = true;
    shardMat.opacity = 0.62 * (1 - clamp01((dt - 1.4) / 0.8));
    spd.forEach((d, i) => {
      const tt = dt;
      const life = clamp01(1 - tt / d.life);
      dummy.position.set(center.x + d.v.x * tt, 0.3 + d.v.y * tt - 0.5 * g * tt * tt, center.z + d.v.z * tt);
      dummy.rotation.set(tt * 9, tt * 7, 0);
      dummy.scale.setScalar(d.size * life);
      dummy.updateMatrix(); sparks.setMatrixAt(i, dummy.matrix);
    });
    sparks.instanceMatrix.needsUpdate = true;
  };

  /* ── breakout: pop flash + shockwave ring on the screen ── */
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,236,220,1)"); gr.addColorStop(0.18, "rgba(255,190,150,0.55)"); gr.addColorStop(0.5, "rgba(240,120,80,0.12)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const popMat = new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(1.6, 1.4, 1.25), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
  const pop = new THREE.Sprite(popMat);
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb48c").multiplyScalar(2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  wave.rotation.x = -Math.PI / 2;
  scene.add(pop, wave);
  fx.breakout = (t, P) => {
    const ex = J.mascot.find((m) => m.type === "extrude");
    const d = t - (ex.t1 - 0.07);
    pop.visible = d >= 0 && d < 0.09;
    if (pop.visible) {
      pop.position.set(spriteW.x, 0.55, pivotZ + 0.3);
      pop.scale.setScalar(1.6 + 2.6 * easeOut(d / 0.09));
      popMat.opacity = 0.6 * Math.pow(1 - d / 0.09, 1.5);
    }
    const w = t - ex.t1;
    wave.visible = w >= 0 && w < 0.5;
    if (wave.visible) {
      wave.position.set(spriteW.x, 0.02, spriteW.z + 0.3);
      wave.scale.setScalar(0.4 + 5.5 * easeOut(w / 0.5));
      wave.material.opacity = 0.85 * Math.pow(1 - w / 0.5, 1.5);
    }
  };

  /* ── playhead (glowing, follows film time) ── */
  const ph = J.ui.playhead;
  const pz0 = world(0, 792).z, pz1 = world(0, 1150).z;
  const phLine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, pz1 - pz0), emissive("#d6ebff", 2.4));
  const phHandle = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.07, 0.26, 3, 0.03), emissive("#eaf4ff", 1.9));
  scene.add(phLine, phHandle);
  fx.playhead = (t) => {
    const u = ph.u0 + t * ph.pxPerSecond;
    const x = world(u, 0).x;
    phLine.position.set(x, 0.012, (pz0 + pz1) / 2);
    phHandle.position.set(x, 0.04, world(0, 800).z);
  };

  /* ── beams + keyframes + rings ── */
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1, 10, 1, true), emissive("#f2f8ff", 4.0));
  const beamGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#9fd0ff").multiplyScalar(1.2), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(beamCore, beamGlow);
  const keyGeo = new RoundedBoxGeometry(0.2, 0.11, 0.2, 3, 0.035);
  const keyMat = emissive("#f4faff", 2.6);
  const keys = J.keyframes.map((k) => {
    const m = new THREE.Mesh(keyGeo, keyMat);
    const u = ph.u0 + k.t * ph.pxPerSecond;
    const w = world(u, rowY(k.row));
    m.position.set(w.x, 0.07, w.z);
    m.rotation.y = Math.PI / 4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color("#cfe8ff").multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, 0.02, w.z);
    scene.add(m, ring);
    return { k, m, ring, target: new THREE.Vector3(w.x, 0.06, w.z) };
  });
  const tmpA = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  fx.beams = (t, mascotPose) => {
    let active = null;
    keys.forEach(({ k, m, ring, target }) => {
      const dt = t - k.t;
      m.visible = dt >= 0;
      if (dt >= 0) m.scale.setScalar(backOut(dt / 0.28));
      ring.material.opacity = dt >= 0 && dt < 0.4 ? 0.9 * (1 - dt / 0.4) : 0;
      const rs = 0.05 + 0.55 * easeOut(dt / 0.4);
      ring.scale.setScalar(rs);
      if (dt >= -0.08 && dt < 0.16) active = { dt, target };
    });
    beamCore.visible = beamGlow.visible = !!active && mascotPose.visible;
    if (!beamCore.visible) return;
    const P = mascotPose;
    // emitter: front of the body, a little below the eyes
    const src = new THREE.Vector3(Math.sin(P.yaw) * 0.52, P.pos.y + 0.55, Math.cos(P.yaw) * 0.52).add(new THREE.Vector3(P.pos.x, 0, P.pos.z));
    const grow = clamp01((active.dt + 0.08) / 0.07);
    const fade = 1 - clamp01((active.dt - 0.06) / 0.1);
    const end = tmpA.lerpVectors(src, active.target, grow);
    const len = src.distanceTo(end);
    [beamCore, beamGlow].forEach((b, i) => {
      b.position.lerpVectors(src, end, 0.5);
      b.quaternion.setFromUnitVectors(up, end.clone().sub(src).normalize());
      b.scale.set(fade * (i ? 1 : 1), Math.max(0.001, len), fade);
    });
  };

  /* ── Glow streak: Effects panel → viewer ── */
  const ST = J.streak;
  const a0 = world(ST.from[0], ST.from[1]), a1 = world(ST.to[0], ST.to[1]);
  const p0 = new THREE.Vector3(a0.x, 0.25, a0.z), p2 = new THREE.Vector3(a1.x, 0.1, a1.z);
  const p1 = p0.clone().lerp(p2, 0.5); p1.y = ST.arc;
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const TRAIL = 96, LAG = 0.0045;
  const orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd2b8").multiplyScalar(3.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), TRAIL);
  orbs.frustumCulled = false; scene.add(orbs);
  const impact = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff9d6e").multiplyScalar(1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  impact.rotation.x = -Math.PI / 2; impact.position.copy(p2).setY(0.03); scene.add(impact);
  fx.streak = (t) => {
    const p = (t - ST.t0) / (ST.t1 - ST.t0);
    orbs.visible = p > 0 && p < 1 + TRAIL * LAG;
    if (orbs.visible) {
      for (let i = 0; i < TRAIL; i++) {
        const pi = p - i * LAG;                              // where the head was i·LAG ago
        const q = easeInOut(clamp01(pi));
        const on = pi > 0 && pi < 1;
        dummy.position.copy(curve.getPoint(q));
        dummy.rotation.set(0, 0, 0);
        // orbs shrink as they reach the title, so the tail doesn't pile up into one hot blob at the eased end
        const land = 0.25 + 0.75 * clamp01((1 - pi) / 0.12) ** 2;
        dummy.scale.setScalar(on ? (0.085 * (1 - i / TRAIL) + 0.03) * land : 0.0001);
        dummy.updateMatrix(); orbs.setMatrixAt(i, dummy.matrix);
      }
      orbs.instanceMatrix.needsUpdate = true;
    }
    const d = t - ST.t1;
    impact.material.opacity = d >= 0 && d < 0.3 ? 0.16 * Math.pow(1 - d / 0.3, 2) : 0;
    impact.scale.setScalar(0.3 + 2.6 * easeOut(d / 0.3));
  };

  /* ── contact shadow ── */
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const c2 = cv.getContext("2d");
  const gr = c2.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,0.85)"); gr.addColorStop(0.5, "rgba(0,0,0,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2; scene.add(blob);
  fx.shadow = (P) => {
    blob.visible = P.visible;
    if (!P.visible) return;
    const h = P.pos.y;
    blob.position.set(P.pos.x, 0.008, P.pos.z);
    blob.scale.set(1.9 * (1 + h * 0.25), 1.5 * (1 + h * 0.25), 1);
    blob.material.opacity = 0.8 * Math.max(0, 1 - h / 2.6);
  };

  return fx;
}
