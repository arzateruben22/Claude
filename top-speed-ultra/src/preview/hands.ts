// The driver's hands and arms for the realism preview: both hands gripping the rim at ten and two (spec.ts GRIP),
// forearms and sleeves up to the shoulders, in the car's frame.
//
//   buildDriverArms(o: HandsOptions): DriverArms
//     o.look          DriverLook from src/game/drivers.ts lookFor(id, presentation, skin): skin tone, sleeve colour
//                     (null: sleeves rolled to the elbow), gloves (leather colour), watch ('gold'|'steel'|'smart'),
//                     ring, bracelet, scale (0.9 = the female presentation)
//     o.presentation  'm' | 'f' (default: from look.scale; < 0.95 is 'f')
//     o.nails         polish colour (hex), or null for natural nails. Default: natural for 'm', a deep red for 'f'
//     o.quality       'phone' (3 mm skin mesh, lighter shader) | 'high' (2.25 mm, full skin detail). Default 'high'
//     o.watchTime     [h, m, s] shown on the watch (default 10:09:36)
//   returns { group, setWheelAngle(rad), setPose(pose), setTone(hex), dispose(), stats, grip }
//     group           a THREE.Group in the car's frame (x right, y up, -z forward, metres); add it to the car
//     setWheelAngle   the wheel's rotation (the cockpit's wheelSpin.rotation.z); the hands turn with the rim and the
//                     arms follow (two-bone reach, shoulders, elbows down and out). Reads right to about ±1 rad.
//     setTone         change the skin tone (hex) without rebuilding
//     stats           { buildMs, tris, calls, meshMs, accMs } (calls: draw calls in the colour pass, without shadows;
//                     meshMs: the cached-per-presentation skin mesh, accMs: sleeves, watch, ring, bangle)
//     grip            { right, left }: the middle of each grip (knuckles to fingertips), car frame, wheel straight
//
// Each hand is one smooth surface meshed once from an anatomical distance field (hands-sdf.ts, hands-mesh.ts): four
// fingers curled round the rim's far side with their tips and nails coming back round its inner edge, a short bent
// thumb over the inner front edge with its nail to the driver, a knuckle ridge and an arched back of the hand. The
// mesh is cached per presentation and quality, the sleeves/watch/ring/bangle geometry per look (hands-acc.ts), so a
// second call costs only the materials and the per-arm buffers.
import * as THREE from 'three';
import type { DriverLook, Presentation } from '../game/drivers';
import { GRIP, WHEEL_AT, WHEEL_TILT } from './spec';
import { V3, gToW, dirGToW, wToCar, reach } from './hands-sdf';
import { buildArmGeometry, ArmGeometry } from './hands-geo';
import { skinMaterial, nailMaterial, Quality } from './hands-skin';
import { buildNails, NailGeometry } from './hands-nails';
import { buildAccessories } from './hands-acc';

export interface HandsOptions {
  look: DriverLook;
  presentation?: Presentation;
  nails?: number | null;
  quality?: Quality;
  watchTime?: [number, number, number];
}
/** off-wheel poses for the abilities: the right hand resting on the knee, the left wrist raised to check the watch,
 *  the left hand up at the window waving. 'wheel' puts both hands back. */
export type HandPose = 'wheel' | 'knee' | 'watch' | 'wave';
export interface DriverArms {
  group: THREE.Group;
  setWheelAngle(rad: number): void;
  /** blend a hand off the wheel (0.3 s) and back; immediate skips the blend (test pages) */
  setPose(pose: HandPose, immediate?: boolean): void;
  setTone(hex: number): void;
  dispose(): void;
  stats: { buildMs: number; tris: number; calls: number; meshMs: number; accMs: number };
  /** the middle of each grip (between the knuckles and the fingertips), car frame, wheel straight */
  grip: { right: THREE.Vector3; left: THREE.Vector3 };
}

const CT = Math.cos(WHEEL_TILT), ST = Math.sin(WHEEL_TILT);
const dirWToCar = (w: V3): V3 => [w[0], w[1] * CT - w[2] * ST, w[1] * ST + w[2] * CT];

// both arms' buffers in the car's frame, from the right arm's mesh in the grip frame
interface Built { arm: ArmGeometry; nails: NailGeometry; pos: Float32Array; nrm: Float32Array; idx: Uint32Array; nv: number }
const built = new Map<string, Built>();
function both(pres: Presentation, q: Quality): Built {
  const key = `${pres}:${q}`;
  const hit = built.get(key);
  if (hit) return hit;
  const arm = buildArmGeometry(pres, q === 'high' ? 2.25 : 3);
  const nails = buildNails(arm.anatomy, pres === 'f', q);
  const m = arm.mesh, nv = m.stats.verts;
  const pos = new Float32Array(nv * 6), nrm = new Float32Array(nv * 6);
  for (let side = 0; side < 2; side++) {
    for (let v = 0; v < nv; v++) {
      const w = gToW([m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]), n = dirGToW([m.nrm[v * 3], m.nrm[v * 3 + 1], m.nrm[v * 3 + 2]]);
      if (side === 1) { w[0] = -w[0]; n[0] = -n[0]; }
      const c = wToCar(w), cn = dirWToCar(n), o = (side * nv + v) * 3;
      pos[o] = c[0]; pos[o + 1] = c[1]; pos[o + 2] = c[2]; nrm[o] = cn[0]; nrm[o + 1] = cn[1]; nrm[o + 2] = cn[2];
    }
  }
  // G is a mirror of the wheel's frame: the right arm's triangles flip once, the left's twice
  const t = m.idx, idx = new Uint32Array(t.length * 2);
  for (let i = 0; i < t.length; i += 3) {
    idx[i] = t[i]; idx[i + 1] = t[i + 2]; idx[i + 2] = t[i + 1];
    idx[t.length + i] = t[i] + nv; idx[t.length + i + 1] = t[i + 1] + nv; idx[t.length + i + 2] = t[i + 2] + nv;
  }
  const b = { arm, nails, pos, nrm, idx, nv };
  built.set(key, b);
  return b;
}

// G-frame points/directions of the right arm to the car's frame for either side
export function toCar(p: V3, side: number): V3 { const w = gToW(p); if (side) w[0] = -w[0]; return wToCar(w); }
export function dirToCar(d: V3, side: number): V3 { const w = dirGToW(d); if (side) w[0] = -w[0]; return dirWToCar(w); }

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function buildDriverArms(o: HandsOptions): DriverArms {
  const t0 = performance.now();
  const look = o.look, q: Quality = o.quality ?? 'high';
  const pres: Presentation = o.presentation ?? (look.scale < 0.95 ? 'f' : 'm');
  const female = pres === 'f';
  const paint = o.nails === undefined ? (female ? 0x7c1426 : null) : o.nails;
  const B = both(pres, q), A = B.arm.anatomy, nv = B.nv;
  const tMesh = performance.now() - t0;
  const group = new THREE.Group();
  group.name = 'driver-arms';

  // ---- bones: per side the upper arm, the forearm and the hand (which rides on the wheel)
  const L1 = A.upper / 1000, L2 = A.fore / 1000;
  const sides = [0, 1].map((side) => {
    const sh = side ? GRIP.left.shoulder : GRIP.right.shoulder;
    const shoulder0: V3 = [sh.x, sh.y, sh.z];
    const pole: V3 = side ? [-0.45, -1, -0.15] : [0.45, -1, -0.15];
    const wristW = gToW(A.wrist); if (side) wristW[0] = -wristW[0];
    const wristW_m = new THREE.Vector3(wristW[0] / 1000, wristW[1] / 1000, wristW[2] / 1000);
    const upper = new THREE.Bone(), fore = new THREE.Bone(), hand = new THREE.Bone();
    upper.name = `upper${side}`; fore.name = `fore${side}`; hand.name = `hand${side}`;
    group.add(upper, fore, hand);
    const foreUp = new THREE.Vector3(...dirToCar(A.foreUp, side));
    return { side, shoulder0, pole, wristW_m, upper, fore, hand, foreUp, bindFore: new THREE.Quaternion(), bindForeDir: new THREE.Vector3(), bindUpper: new THREE.Quaternion(), bindUpperDir: new THREE.Vector3() };
  });
  const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), WHEEL_TILT);
  const basis = (dir: THREE.Vector3, up: THREE.Vector3) => {
    const y = dir.clone().normalize(), x = up.clone().sub(y.clone().multiplyScalar(up.dot(y))).normalize(), z = new THREE.Vector3().crossVectors(x, y);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };
  const tmpQ = new THREE.Quaternion(), wq = new THREE.Quaternion(), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  // ---- off-wheel poses: a target for the hand bone (car frame) per side, blended in and out over 0.3 s. The bone
  // maps the bind-pose hand (on the rim, wheel straight) by pos + quat * qTilt⁻¹ * (v - WHEEL_AT). A pose says where
  // the wrist goes and which way the hand points (wrist to middle knuckle) and its back faces; the bone's quat is the
  // rotation taking the bind hand's measured axes onto those, times qTilt, and its position puts the wrist there
  const qTiltInv = qTilt.clone().invert(), waveQ = new THREE.Quaternion();
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
  const basisOf = (a: THREE.Vector3, b: THREE.Vector3) => { const x = a.clone().normalize(), z = new THREE.Vector3().crossVectors(x, b).normalize(), y = new THREE.Vector3().crossVectors(z, x); return new THREE.Matrix4().makeBasis(x, y, z); };
  const wristC = [0, 1].map((side) => new THREE.Vector3(...toCar(A.wrist, side)));
  const lenC = [0, 1].map((side) => new THREE.Vector3(...toCar(A.mcp[2], side)).sub(wristC[side]).normalize());
  const backC = [0, 1].map((side) => new THREE.Vector3(...dirToCar([-A.palm.N[0], -A.palm.N[1], -A.palm.N[2]], side)).normalize());
  const poseFor = (side: number, wrist: THREE.Vector3, len: THREE.Vector3, back: THREE.Vector3, wave: boolean) => {
    const quat = new THREE.Quaternion().setFromRotationMatrix(basisOf(len, back).multiply(basisOf(lenC[side], backC[side]).invert()));
    const pos = wrist.clone().sub(wristC[side].clone().sub(WHEEL_AT).applyQuaternion(quat));
    return { side, pos, quat: quat.multiply(qTilt), wave, axis: len.clone() };
  };
  const POSES: Record<Exclude<HandPose, 'wheel'>, ReturnType<typeof poseFor>> = {
    knee: poseFor(0, new THREE.Vector3(-0.12, 0.9, -0.42), V(0.1, -0.5, -0.86), V(0.05, 0.86, -0.5), false),       // right hand down on the console, palm down
    watch: poseFor(1, new THREE.Vector3(-0.49, 1.0, -0.33), V(0.8, 0.35, -0.49), V(0.25, 0.34, 0.9), false),       // left wrist up, its back to the eyes
    wave: poseFor(1, new THREE.Vector3(-0.58, 1.02, -0.4), V(-0.1, 0.95, -0.3), V(0.85, 0.2, 0.5), true),          // left hand up at the window, palm out
  };
  const off = sides.map(() => ({ t: 0, goal: 0, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), wave: false, axis: new THREE.Vector3(0, 1, 0) }));
  let lastT = performance.now();
  const pose = (angle: number, bind: boolean) => {
    const now = performance.now(), dt = bind ? 0 : Math.min(0.1, (now - lastT) / 1000); lastT = now;
    wq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle).premultiply(qTilt);
    for (const s of sides) {
      const o = off[s.side];
      o.t += Math.max(-dt / 0.3, Math.min(dt / 0.3, o.goal - o.t));
      const k = o.t * o.t * (3 - 2 * o.t);
      s.hand.position.copy(WHEEL_AT).lerp(o.pos, k); s.hand.quaternion.copy(wq).slerp(o.quat, k);
      if (o.wave && k > 0) s.hand.quaternion.premultiply(waveQ.setFromAxisAngle(o.axis, Math.sin(now * 0.0138) * 0.35 * k));
      const dq = s.hand.quaternion.clone().multiply(qTiltInv);     // the hand's rotation from its bind orientation
      const wrist = s.wristW_m.clone().applyQuaternion(s.hand.quaternion).add(s.hand.position);
      const r = reach(s.shoulder0, [wrist.x, wrist.y, wrist.z], L1, L2, s.pole);
      const S = new THREE.Vector3(...r.shoulder), E = new THREE.Vector3(...r.elbow);
      const fdir = vA.copy(wrist).sub(E).normalize(), udir = vB.copy(E).sub(S).normalize();
      if (bind) {
        s.bindFore.copy(basis(fdir, s.foreUp)); s.bindForeDir.copy(fdir);
        s.bindUpper.copy(basis(udir, s.foreUp)); s.bindUpperDir.copy(udir);
      }
      // the forearm takes half the hand's roll about it, so the wrist doesn't wring
      const swing = tmpQ.setFromUnitVectors(s.bindForeDir, fdir);
      const tw = 2 * Math.atan2(dq.x * fdir.x + dq.y * fdir.y + dq.z * fdir.z, dq.w);
      const twist = new THREE.Quaternion().setFromAxisAngle(fdir, tw * 0.5);
      s.fore.position.copy(E); s.fore.quaternion.copy(twist).multiply(swing).multiply(s.bindFore);
      s.upper.position.copy(S); s.upper.quaternion.setFromUnitVectors(s.bindUpperDir, udir).multiply(s.bindUpper);
    }
  };
  pose(0, true);
  group.updateMatrixWorld(true);
  const bones = sides.flatMap((s) => [s.upper, s.fore, s.hand]);
  const skeleton = new THREE.Skeleton(bones);
  const bindIdentity = new THREE.Matrix4();

  // ---- the skin: both arms in one mesh
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(B.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(B.nrm, 3));
  const dup = (a: Float32Array, n: number) => { const o2 = new Float32Array(a.length * 2); o2.set(a); o2.set(a, a.length); return new THREE.BufferAttribute(o2, n); };
  const hand = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) hand[i] = B.arm.mesh.pos[i] / 1000;
  g.setAttribute('aHand', dup(hand, 3));
  g.setAttribute('aSkin', dup(B.arm.skin, 4));
  g.setAttribute('aJoint', dup(B.arm.joint, 4));
  g.setAttribute('aArm', dup(B.arm.arm, 2));
  const si = new Uint16Array(nv * 8), sw = new Float32Array(nv * 8);
  for (let side = 0; side < 2; side++) for (let v = 0; v < nv; v++) {
    const along = B.arm.arm[v * 2];
    const wh = 1 - smooth(-16, 26, along), wu = smooth(A.fore - 30, A.fore + 35, along), wf = Math.max(0, 1 - wh - wu);
    const o2 = (side * nv + v) * 4, b0 = side * 3;
    si[o2] = b0 + 2; si[o2 + 1] = b0 + 1; si[o2 + 2] = b0; si[o2 + 3] = b0;
    sw[o2] = wh; sw[o2 + 1] = wf; sw[o2 + 2] = wu; sw[o2 + 3] = 0;
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  // under a sleeve the forearm isn't seen: leave those triangles out
  const tA0 = performance.now();
  const acc = buildAccessories({ anatomy: A, look, female, quality: q, watchTime: o.watchTime ?? [10, 9, 36], toCar, dirToCar });
  const tAcc = performance.now() - tA0;
  const covered = acc.sleeveFrom;   // skin farther up the arm than this (mm from the wrist) is under the sleeve
  const keep: number[] = [];
  const along = B.arm.arm;
  for (let i = 0; i < B.idx.length; i += 3) {
    const a = B.idx[i] % nv, b = B.idx[i + 1] % nv, c = B.idx[i + 2] % nv;
    if (Math.min(along[a * 2], along[b * 2], along[c * 2]) > covered) continue;
    keep.push(B.idx[i], B.idx[i + 1], B.idx[i + 2]);
  }
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(keep), 1));

  const N = A.palm.N, holeN: number[] = [];
  for (let i = 0; i < 5; i++) holeN.push(N[0], N[1], N[2]);
  const skinMat = skinMaterial({ tone: look.skin, glove: look.gloves, quality: q, female, veins: A.veins, holes: A.holes, holeNormals: holeN });
  const skin = new THREE.SkinnedMesh(g, skinMat);
  skin.name = 'skin';
  const meshes: THREE.SkinnedMesh[] = [skin];

  // ---- nails (not under gloves)
  let nailMat: ReturnType<typeof nailMaterial> | null = null;
  if (look.gloves === null) {
    const nl = B.nails, n = nl.pos.length / 3;
    const p = new Float32Array(n * 6), nn = new Float32Array(n * 6), at = new Float32Array(n * 8), ni = new Uint16Array(n * 8), nw = new Float32Array(n * 8);
    for (let side = 0; side < 2; side++) for (let v = 0; v < n; v++) {
      const c = toCar([nl.pos[v * 3], nl.pos[v * 3 + 1], nl.pos[v * 3 + 2]], side), d = dirToCar([nl.nrm[v * 3], nl.nrm[v * 3 + 1], nl.nrm[v * 3 + 2]], side);
      const o3 = (side * n + v) * 3, o4 = (side * n + v) * 4;
      p.set(c, o3); nn.set(d, o3); at.set(nl.nail.slice(v * 4, v * 4 + 4), o4);
      ni[o4] = side * 3 + 2; nw[o4] = 1;
    }
    const ix: number[] = [];
    for (let side = 0; side < 2; side++) for (let i = 0; i < nl.idx.length; i += 3) {
      const a = nl.idx[i] + side * n, b = nl.idx[i + 1] + side * n, c = nl.idx[i + 2] + side * n;
      if (side === 0) ix.push(a, c, b); else ix.push(a, b, c);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(p, 3));
    ng.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    ng.setAttribute('aNail', new THREE.BufferAttribute(at, 4));
    ng.setAttribute('skinIndex', new THREE.BufferAttribute(ni, 4));
    ng.setAttribute('skinWeight', new THREE.BufferAttribute(nw, 4));
    ng.setIndex(ix);
    nailMat = nailMaterial({ tone: look.skin, paint, quality: q });
    const nm = new THREE.SkinnedMesh(ng, nailMat);
    nm.name = 'nails';
    meshes.push(nm);
  }
  for (const a of acc.meshes) meshes.push(a);
  for (const m of meshes) {
    m.bind(skeleton, bindIdentity);
    m.frustumCulled = false;
    m.castShadow = m.name !== 'crystal' && m.name !== 'dial';
    m.receiveShadow = true;
    group.add(m);
  }
  let tris = 0;
  for (const m of meshes) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  const gripG: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) gripG[i] = (A.mcp[1][i] + A.digits[1].joints[3][i]) / 2;
  const buildMs = performance.now() - t0;
  return {
    group,
    setWheelAngle(rad: number) { pose(rad, false); },
    setPose(p: HandPose, immediate = false) {
      for (const o of off) o.goal = 0;
      if (p !== 'wheel') { const P = POSES[p], o = off[P.side]; o.pos.copy(P.pos); o.quat.copy(P.quat); o.wave = P.wave; o.axis.copy(P.axis); o.goal = 1; }
      if (immediate) for (const o of off) o.t = o.goal;
    },
    setTone(hex: number) { skinMat.setTone(hex); nailMat?.setTone(hex); },
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mm of mats) { for (const v of Object.values(mm)) if (v instanceof THREE.Texture) v.dispose(); mm.dispose(); }
      }
      skeleton.dispose();
      group.removeFromParent();
    },
    stats: { buildMs, tris, calls: meshes.length, meshMs: tMesh, accMs: tAcc },
    grip: { right: new THREE.Vector3(...toCar(gripG, 0)), left: new THREE.Vector3(...toCar(gripG, 1)) },
  };
}
