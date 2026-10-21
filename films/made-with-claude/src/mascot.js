/* ═══════════════════════════════════════════════════════════
   Clawd — procedural mascot + pose solver.
   pose(t) is a pure function of time built from timeline.json
   "mascot" moves: ballistic jumps/hops, a playhead-locked trot,
   squash & stretch, facing, blinks and happy eyes.
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const LEG_H = 0.2;
export const BODY = { w: 1.3, h: 0.92, d: 1.0 };

export function buildMascot() {
  const coral = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#d2603a"), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.36,
    sheen: 0.4, sheenColor: new THREE.Color("#ffb08a"), sheenRoughness: 0.6, envMapIntensity: 0.55
  });
  const ink = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#120a08"), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });

  const root = new THREE.Group();          // world position + yaw
  const squash = new THREE.Group();        // scale about the feet
  const tilt = new THREE.Group();          // pitch / roll lean
  root.add(squash); squash.add(tilt);

  const body = new THREE.Mesh(new RoundedBoxGeometry(BODY.w, BODY.h, BODY.d, 5, 0.17), coral);
  body.position.y = LEG_H + BODY.h / 2;
  tilt.add(body);

  const eyeGeo = new RoundedBoxGeometry(0.09, 0.25, 0.06, 3, 0.03);
  const eyes = [-0.27, 0.27].map((x) => {
    const e = new THREE.Mesh(eyeGeo, ink);
    e.position.set(x, LEG_H + BODY.h / 2 + 0.07, BODY.d / 2 - 0.012);
    tilt.add(e);
    return e;
  });
  // happy closed eyes: little upward-opening arcs (‿)
  const arcGeo = new THREE.TorusGeometry(0.085, 0.021, 10, 24, Math.PI);
  const happy = [-0.27, 0.27].map((x) => {
    const a = new THREE.Mesh(arcGeo, ink);
    a.rotation.z = Math.PI;                 // open side up
    a.position.set(x, LEG_H + BODY.h / 2 + 0.1, BODY.d / 2 + 0.005);
    a.scale.setScalar(0.0001);
    tilt.add(a);
    return a;
  });

  const armGeo = new RoundedBoxGeometry(0.17, 0.25, 0.36, 3, 0.06);
  const arms = [-1, 1].map((sx) => {
    const a = new THREE.Mesh(armGeo, coral);
    a.position.set(sx * (BODY.w / 2 + 0.06), LEG_H + BODY.h * 0.42, 0.02);
    tilt.add(a);
    return a;
  });

  const legGeo = new RoundedBoxGeometry(0.15, LEG_H + 0.08, 0.34, 3, 0.05);
  const legs = [-0.47, -0.16, 0.16, 0.47].map((x) => {
    const l = new THREE.Mesh(legGeo, coral);
    l.position.set(x, (LEG_H + 0.08) / 2 - 0.0, 0.0);
    tilt.add(l);
    return l;
  });

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, squash, tilt, body, eyes, happy, arms, legs, materials: { coral, ink } };
}

/* ─── path solver ─── */

const G = 1;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function angleLerp(a, b, p) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * p;
}
const smooth = (p) => p * p * (3 - 2 * p);

export function makePose(J, world, fmt) {
  const pu = (t) => J.ui.playhead.u0 + t * J.ui.playhead.pxPerSecond;
  const toWorld = (u, v) => world(u, v);
  const segs = [];
  let pos = null, yaw = 0;
  for (const m of J.mascot) {
    const s = { ...m };
    if (m.type === "sprite" || m.type === "extrude") {
      const sp = toWorld(m.at[0], m.at[1]);
      // the sprite stands up at its southern (feet) edge — see fx voxels
      pos = new THREE.Vector3(sp.x, 0, sp.z + 0.48 + 0.3);
      s.p0 = pos.clone(); s.p1 = pos.clone();
    } else if (m.type === "jump" || m.type === "hop") {
      const to = (fmt && m["to" + fmt]) || m.to;               // per-format landing spots (end-card layouts differ)
      const u = to[0] === "playhead" ? pu(m.t1) : to[0];
      const w = toWorld(u, to[1]);
      s.p0 = pos.clone(); s.p1 = new THREE.Vector3(w.x, 0, w.z);
      s.yaw0 = yaw; s.yaw1 = Math.atan2(s.p1.x - s.p0.x, s.p1.z - s.p0.z);
      if (m.face === "camera") s.yaw1 = m.endYaw ?? 0;      // lands facing the lens side (south)
      yaw = s.yaw1; pos = s.p1.clone();
    } else if (m.type === "trot") {
      const w0 = toWorld(pu(m.t0), m.v), w1 = toWorld(pu(m.t1), m.v);
      s.p0 = new THREE.Vector3(w0.x, 0, w0.z); s.p1 = new THREE.Vector3(w1.x, 0, w1.z);
      s.yaw0 = yaw; s.yaw1 = Math.PI / 2; yaw = s.yaw1; pos = s.p1.clone();
      s.wv = (u) => toWorld(u, m.v);
    } else {
      s.p0 = pos.clone(); s.p1 = pos.clone(); s.yaw0 = yaw;
    }
    s.prev = segs[segs.length - 1] || null;
    segs.push(s);
  }
  const firstJump = segs.find((x) => x.type === "jump");
  const bounces = segs.flatMap((x) => x.bounce || []);
  const takeoffs = segs.filter((s) => s.type === "jump" || s.type === "hop").map((s) => s.t0);
  const landings = segs.filter((s) => s.type === "jump" || s.type === "hop").map((s) => ({ t: s.t1, big: s.type === "jump" || !!s.stomp }));

  const T_END = J.duration;
  return function pose(t, camPos, viewerPos) {
    // sub-frames sample slightly outside [0, duration): clamp so they never fall through to the last segment
    t = Math.min(Math.max(t, 0), T_END - 1e-6);
    const seg = segs.find((s) => t >= s.t0 && t < s.t1) || segs[segs.length - 1];
    const out = { visible: true, pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, sy: 1, sxz: 1, eye: 1, happy: 0, legs: 0, arms: 0, vy: 0, mode: seg.type };
    if (seg.type === "sprite" || (seg.type === "extrude" && t < seg.t1 - 0.04)) {
      out.visible = false;
      out.pos.copy(seg.p0);
      return out;
    }
    if (seg.type === "extrude") {
      // emerges from the standing voxels: quick scale-in, squashed, ready to spring
      const p = clamp01((t - (seg.t1 - 0.04)) / 0.04);
      out.pos.copy(seg.p0);
      out.sy = 0.72 + 0.1 * p; out.sxz = 1.12;
      out.scale = 0.55 + 0.45 * p;
      out.yaw = 0;
      return out;
    }
    // start every move from the yaw the previous move actually ended on (no snaps at segment boundaries)
    const y0 = seg.prev && seg.prev.type !== "sprite" && seg.prev.type !== "extrude" ? pose(seg.t0 - 1e-4, camPos, viewerPos).yaw : seg.yaw0;
    if (seg.type === "jump" || seg.type === "hop") {
      const p = (t - seg.t0) / (seg.t1 - seg.t0);
      out.pos.lerpVectors(seg.p0, seg.p1, p);
      if (seg.stomp) {
        // a stomp hangs at the top, then slams down (vertical timing warped, travel stays linear)
        const pw = p < 0.6 ? 0.5 * Math.sin((Math.PI / 2) * (p / 0.6)) : 0.5 + 0.5 * ((p - 0.6) / 0.4) ** 2;
        const dpw = p < 0.6 ? 0.5 * Math.cos((Math.PI / 2) * (p / 0.6)) * (Math.PI / 2) / 0.6 : (p - 0.6) / 0.16;
        out.pos.y = 4 * seg.apex * pw * (1 - pw);
        out.vy = (4 * seg.apex * (1 - 2 * pw) * dpw) / (seg.t1 - seg.t0);
      } else {
        out.pos.y = 4 * seg.apex * p * (1 - p);
        out.vy = (4 * seg.apex * (1 - 2 * p)) / (seg.t1 - seg.t0);
      }
      // stretch with speed, but relax to 1 at lift-off and contact so the shutter never straddles a shape snap
      const st = Math.min(1, Math.abs(out.vy) / 14) * smooth(clamp01(p / 0.12)) * smooth(clamp01((1 - p) / 0.12));
      out.sy = 1 + 0.16 * st; out.sxz = 1 / Math.sqrt(out.sy);
      if (seg === firstJump && p < 0.1) out.sy = 0.82 + (out.sy - 0.82) * smooth(p / 0.1);   // spring out of the extrude squash
      out.yaw = angleLerp(y0, seg.yaw1, smooth(clamp01(p / 0.3)));
      if (seg.face === "camera" && camPos) {
        const toCam = Math.atan2(camPos.x - out.pos.x, camPos.z - out.pos.z);
        out.yaw = angleLerp(angleLerp(y0, toCam, smooth(clamp01(p / 0.3))), seg.yaw1, smooth(clamp01((p - 0.7) / 0.3)));
      }
      out.pitch = (seg.type === "jump" ? 0.32 : 0.12) * Math.sin(Math.PI * p) * (seg.face === "camera" ? -0.6 : 1);   // lean into the arc
      out.legs = Math.sin(Math.PI * p);
      if (seg.type === "hop" && camPos && !seg.stomp) {    // keep the face readable while hopping sideways
        const toCam = Math.atan2(camPos.x - out.pos.x, camPos.z - out.pos.z);
        out.yaw = angleLerp(out.yaw, toCam, 0.55 * smooth(clamp01(p / 0.3)));
      }
      if (seg.type === "jump" && seg.apex > 2.5) out.roll = 0.18 * Math.sin(2 * Math.PI * p);
    } else if (seg.type === "trot") {
      const tt = t - seg.t0, step = seg.step;
      const u = pu(t);
      const w = seg.wv(u);
      out.pos.set(w.x, 0, w.z);
      const ph = (tt / step) % 1;
      out.pos.y = seg.apex * Math.sin(Math.PI * ph);
      out.yaw = angleLerp(y0, seg.yaw1, smooth(clamp01(tt / 0.2)));
      out.legs = Math.sin(Math.PI * 2 * (tt / (step * 2)));
      out.pitch = 0.05;
      const contact = Math.min(ph, 1 - ph);
      out.sy = 1 - 0.09 * Math.exp(-contact * 18); out.sxz = 1 / Math.sqrt(out.sy);
      // face the camera a little while trotting so the eyes read
      if (camPos) {
        const toCam = Math.atan2(camPos.x - out.pos.x, camPos.z - out.pos.z);
        out.yaw = angleLerp(out.yaw, toCam, 0.45 * smooth(clamp01(tt / 0.2)));
      }
    } else {
      out.pos.copy(seg.p0);
      let target = seg.yaw0;
      if (seg.face === "camera" && camPos) target = Math.atan2(camPos.x - out.pos.x, camPos.z - out.pos.z);
      if (seg.face === "viewer" && viewerPos) target = Math.atan2(viewerPos.x - out.pos.x, viewerPos.z - out.pos.z);
      if (seg.face === "panel") target = Math.PI * 0.85;
      out.yaw = angleLerp(y0, target, smooth(clamp01((t - seg.t0) / 0.3)));
      if (seg.face === "camera" && camPos) {
        // a high lens (the 9:16 end card): lean back and look up so the face and the happy eyes read
        const elev = Math.atan2(camPos.y - out.pos.y, Math.hypot(camPos.x - out.pos.x, camPos.z - out.pos.z));
        out.pitch = -0.6 * clamp01((elev - 0.75) / 0.45) * smooth(clamp01((t - seg.t0) / 0.3));
      }
      if (seg.breathe) { const br = Math.sin((t - seg.t0) * Math.PI * 1.0); out.sy *= 1 + 0.018 * br; }
      if (seg.happy && t >= seg.happy) { const q = smooth(clamp01((t - seg.happy) / 0.18)); out.happy = q; out.eye = 1 - q; }
    }
    // keystrokes: a small squash and an arm flick on every key, whatever move it falls in
    for (const b of bounces) if (t >= b && t < b + 0.12) { const q = (t - b) / 0.12; out.sy *= 1 - 0.08 * Math.sin(Math.PI * q); out.arms = Math.max(out.arms, Math.sin(Math.PI * q)); }
    // the breakout pop: overshoot as the mascot leaves the screen
    if (seg === firstJump) {
      const q = (t - seg.t0) / 0.16;
      if (q < 1) out.scale = 1 + 0.16 * Math.sin(Math.PI * q) * (1 - q);
    }
    // anticipation crouch before take-offs: dips and returns to 1 at t0 (no snap into the stretch);
    // skipped when the take-off is also a landing (chained hops) — the landing squash carries it
    for (const t0 of takeoffs) {
      if (t0 === firstJump.t0 || landings.some((L) => Math.abs(L.t - t0) < 1e-6)) continue;   // the extrude squash is the breakout's crouch
      if (t >= t0 - 0.1 && t < t0) { const q = (t - (t0 - 0.1)) / 0.1; out.sy *= 1 - 0.2 * Math.sin(Math.PI * q); }
    }
    // landing squash: a 40 ms attack after contact, then a damped spring (no instant stretch→squash flip)
    for (const L of landings) {
      if (t >= L.t && t < L.t + 0.5) {
        const q = t - L.t, a = L.big ? 0.34 : 0.22;
        const env = Math.min(1, q / 0.04);
        out.sy *= 1 - a * env * Math.exp(-q * 9) * Math.cos(34 * Math.max(0, q - 0.04));
      }
    }
    out.sxz = 1 / Math.sqrt(out.sy);
    // blinks
    for (const b of J.blinks) if (t >= b && t < b + 0.14) out.eye = Math.min(out.eye, Math.abs(1 - 2 * ((t - b) / 0.14)));
    return out;
  };
}

export function applyPose(M, P) {
  M.root.visible = P.visible;
  if (!P.visible) return;
  M.root.position.copy(P.pos);
  M.root.rotation.set(0, P.yaw, 0);
  const sc = P.scale ?? 1;
  M.squash.scale.set(P.sxz * sc, P.sy * sc, P.sxz * sc);
  M.tilt.rotation.set(P.pitch, 0, P.roll);
  M.eyes.forEach((e) => { e.scale.y = Math.max(0.06, P.eye); e.visible = P.eye > 0.04; });
  M.happy.forEach((h) => h.scale.setScalar(Math.max(0.0001, P.happy)));
  M.legs.forEach((l, i) => { l.position.y = (LEG_H + 0.08) / 2 + 0.05 * P.legs * (i % 2 ? 1 : -1) * 0.6; });
  M.arms.forEach((a, i) => { a.position.y = LEG_H + BODY.h * 0.42 + 0.05 * P.arms; a.rotation.z = (i ? -1 : 1) * 0.25 * P.arms; });
}
