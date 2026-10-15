// Procedural animation: idle (breathing, weight shift), talking gestures (hands, nods, tilts), a walk cycle,
// sitting at a table, laughing, turning to face someone, and head/eye aim. Each person gets their own timing so no
// two people move in step. Rotations are local, about axes in each bone's rest frame (the rest pose has identity
// rotations, so those axes are the body's own: +x the person's left, +y up, +z forward).
import * as THREE from 'three';
import { Rig, B, BONES } from './body';
import { BodyShape } from './params';
import { DEG, clamp, rng } from './math';

export type AnimName = 'idle' | 'talk' | 'walk' | 'sit' | 'laugh' | 'turn';

interface Pose { q: THREE.Quaternion[]; root: THREE.Vector3 }
const newPose = (): Pose => ({ q: BONES.map(() => new THREE.Quaternion()), root: new THREE.Vector3() });
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();

export class Animator {
  anim: AnimName = 'idle';
  private prev: AnimName = 'idle';
  private blend = 1;
  t = 0;
  private walkPhase = 0;
  speed = 1.25;             // walking speed (m/s): the caller moves the person; this sets the cadence
  seatHeight = 0.46;
  talkAmount = 0;           // 0..1, set by the face while a line is spoken (drives gesture energy)
  private seed: ReturnType<typeof rng>;
  private ph: number[];
  private cur = newPose(); private a = newPose(); private b = newPose();
  // aim
  lookTarget: THREE.Vector3 | null = null;
  private yaw = 0; private pitch = 0;
  armFlexL: THREE.Vector3; armFlexR: THREE.Vector3; legFlexL: THREE.Vector3; legFlexR: THREE.Vector3;

  constructor(private rig: Rig, private body: BodyShape, seed: number) {
    this.seed = rng(seed * 31 + 7);
    this.ph = Array.from({ length: 12 }, () => this.seed.next() * Math.PI * 2);
    const a = rig.armAngle, l = rig.legAngle;
    this.armFlexL = new THREE.Vector3(Math.cos(a), Math.sin(a), 0); this.armFlexR = new THREE.Vector3(Math.cos(a), -Math.sin(a), 0);
    this.legFlexL = new THREE.Vector3(Math.cos(l), Math.sin(l), 0); this.legFlexR = new THREE.Vector3(Math.cos(l), -Math.sin(l), 0);
  }

  play(n: AnimName) {
    if (n === this.anim) return;
    this.prev = this.anim; this.anim = n; this.blend = 0;
  }

  /** advance and write the pose into the bones; returns the head's aim (yaw, pitch) for the eyes */
  update(dt: number, bones: THREE.Bone[], rest: THREE.Vector3[], headWorld: (out: THREE.Vector3) => THREE.Vector3, group: THREE.Object3D) {
    this.t += dt;
    if (this.anim === 'walk' || this.prev === 'walk') this.walkPhase += dt * this.cadence() * Math.PI * 2;
    this.blend = Math.min(1, this.blend + dt / 0.35);
    const w = this.blend * this.blend * (3 - 2 * this.blend);
    this.pose(this.anim, this.a);
    if (w < 1) {
      this.pose(this.prev, this.b);
      for (let i = 0; i < BONES.length; i++) this.cur.q[i].copy(this.b.q[i]).slerp(this.a.q[i], w);
      this.cur.root.copy(this.b.root).lerp(this.a.root, w);
    } else {
      for (let i = 0; i < BONES.length; i++) this.cur.q[i].copy(this.a.q[i]);
      this.cur.root.copy(this.a.root);
    }
    // aim the head and neck at the target
    let ty = 0, tp = 0;
    if (this.lookTarget) {
      const hp = headWorld(new THREE.Vector3());
      const d = this.lookTarget.clone().sub(hp);
      const inv = new THREE.Quaternion(); group.getWorldQuaternion(inv).invert();
      d.applyQuaternion(inv);
      ty = clamp(Math.atan2(d.x, d.z), -75 * DEG, 75 * DEG);
      tp = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -35 * DEG, 30 * DEG);
    }
    const k = 1 - Math.exp(-dt * 6);
    this.yaw += (ty - this.yaw) * k; this.pitch += (tp - this.pitch) * k;
    this.rotPost(B.neck, [0, 1, 0], this.yaw * 0.35); this.rotPost(B.head, [0, 1, 0], this.yaw * 0.6);
    this.rotPost(B.neck, [1, 0, 0], -this.pitch * 0.3); this.rotPost(B.head, [1, 0, 0], -this.pitch * 0.6);
    for (let i = 0; i < BONES.length; i++) bones[i].quaternion.copy(this.cur.q[i]);
    bones[0].position.copy(rest[0]).add(this.cur.root);
    return { yaw: ty - this.yaw * 0.95, pitch: tp - this.pitch * 0.9 };
  }

  private cadence() { return clamp(0.78 + 0.12 * this.speed, 0.7, 1.2) * (1 - 0.12 * this.body.posture) * (1 - 0.08 * Math.max(0, this.body.fat - 0.6)); }

  private rotPost(i: number, ax: [number, number, number], ang: number) {
    if (Math.abs(ang) < 1e-5) return;
    _ax.set(ax[0], ax[1], ax[2]).normalize(); _q.setFromAxisAngle(_ax, ang); this.cur.q[i].multiply(_q);
  }

  private pose(n: AnimName, P: Pose) {
    for (const q of P.q) q.identity();
    P.root.set(0, 0, 0);
    const R = (i: number, ax: THREE.Vector3 | [number, number, number], ang: number) => {
      if (Math.abs(ang) < 1e-6) return;
      if (Array.isArray(ax)) _ax.set(ax[0], ax[1], ax[2]); else _ax.copy(ax);
      _ax.normalize(); _q.setFromAxisAngle(_ax, ang); P.q[i].multiply(_q);
    };
    const bd = this.body, rig = this.rig, t = this.t, ph = this.ph;
    const heavy = clamp((bd.fat - 0.55) / 0.45), post = bd.posture, soft = bd.soft;
    // ---- the base stance: arms down (heavier arms rest a little out), legs in, posture
    const armOut = (7 + 11 * heavy + 3 * clamp(bd.muscle - 0.6) * 2) * DEG;   // a heavy body holds its arms clear of the belly
    const legIn = Math.max(0, rig.legAngle - (2.5 + 4 * heavy) * DEG);
    // the shoulder girdle takes a share of lowering the arms from the rest pose, so the shoulder line follows
    const lower = rig.armAngle - armOut;
    R(B.clavL, [0, 0, 1], -lower * 0.2); R(B.clavR, [0, 0, 1], lower * 0.2);
    R(B.armL, [0, 0, 1], -lower * 0.8); R(B.armR, [0, 0, 1], lower * 0.8);
    R(B.armL, [1, 0, 0], -4 * DEG); R(B.armR, [1, 0, 0], -4 * DEG);
    R(B.foreL, this.armFlexL, -(12 + 6 * soft) * DEG); R(B.foreR, this.armFlexR, -(12 + 6 * soft) * DEG);
    R(B.handL, [0, 1, 0], 8 * DEG); R(B.handR, [0, 1, 0], -8 * DEG);
    R(B.thighL, [0, 0, 1], -legIn); R(B.thighR, [0, 0, 1], legIn);
    R(B.footL, [0, 0, 1], legIn); R(B.footR, [0, 0, 1], -legIn);
    R(B.footL, [0, 1, 0], 7 * DEG); R(B.footR, [0, 1, 0], -7 * DEG);
    R(B.spine, [1, 0, 0], (3 * post) * DEG); R(B.chest, [1, 0, 0], (9 * post + 3 * soft) * DEG);
    R(B.neck, [1, 0, 0], (14 * post + 3 * soft) * DEG); R(B.head, [1, 0, 0], -(16 * post + 2 * soft) * DEG);
    R(B.clavL, [0, 1, 0], -(3 + 6 * soft) * DEG); R(B.clavR, [0, 1, 0], (3 + 6 * soft) * DEG);
    P.root.y = rig.heel * 0.92 - rig.dims.thigh * 0.004;
    // ---- breathing (always)
    const br = Math.sin(t * Math.PI * 2 / (3.8 + ph[0] * 0.15) + ph[1]);
    R(B.chest, [1, 0, 0], -0.9 * DEG * br); R(B.clavL, [0, 0, 1], 0.5 * DEG * br); R(B.clavR, [0, 0, 1], -0.5 * DEG * br);

    if (n === 'idle' || n === 'talk' || n === 'turn' || n === 'laugh') {
      // weight shift: slow, with the free knee softening
      const ws = Math.sin(t * Math.PI * 2 / (7 + ph[2]) + ph[3]);
      P.root.x += 0.012 * ws;
      R(B.hips, [0, 0, 1], -2.2 * DEG * ws); R(B.spine, [0, 0, 1], 1.4 * DEG * ws); R(B.chest, [0, 0, 1], 0.8 * DEG * ws);
      const kL = Math.max(0, ws) * 7 * DEG, kR = Math.max(0, -ws) * 7 * DEG;
      R(B.thighL, this.legFlexL, -kL * 0.5); R(B.shinL, this.legFlexL, kL); R(B.footL, this.legFlexL, -kL * 0.5);
      R(B.thighR, this.legFlexR, -kR * 0.5); R(B.shinR, this.legFlexR, kR); R(B.footR, this.legFlexR, -kR * 0.5);
      R(B.thighL, [0, 0, 1], 1.5 * DEG * ws); R(B.thighR, [0, 0, 1], 1.5 * DEG * ws);
      R(B.head, [0, 1, 0], 3 * DEG * Math.sin(t * 0.37 + ph[4])); R(B.head, [0, 0, 1], 2 * DEG * Math.sin(t * 0.23 + ph[5]));
    }
    if (n === 'talk' || n === 'laugh') {
      const e = 0.45 + 0.55 * this.talkAmount;
      // gestures: each hand lifts, opens and turns in its own rhythm
      const g1 = 0.5 + 0.5 * Math.sin(t * 1.7 + ph[6]), g2 = 0.5 + 0.5 * Math.sin(t * 1.3 + ph[7] + 1.3);
      const beat = Math.sin(t * 6.3 + ph[8]) * this.talkAmount;
      const gl = n === 'laugh' ? 0.3 : e;
      R(B.armL, [1, 0, 0], -(10 + 14 * g1) * DEG * gl); R(B.armR, [1, 0, 0], -(8 + 16 * g2) * DEG * gl);
      R(B.armL, [0, 0, 1], 4 * DEG * g1 * gl); R(B.armR, [0, 0, 1], -4 * DEG * g2 * gl);
      R(B.foreL, this.armFlexL, -(30 + 45 * g1 + 6 * beat) * DEG * gl); R(B.foreR, this.armFlexR, -(25 + 50 * g2 - 6 * beat) * DEG * gl);
      R(B.foreL, [0, 1, 0], -(20 + 30 * g1) * DEG * gl); R(B.foreR, [0, 1, 0], (20 + 30 * g2) * DEG * gl);
      R(B.handL, [0, 0, 1], 10 * DEG * Math.sin(t * 2.1 + ph[9]) * gl); R(B.handR, [0, 0, 1], -10 * DEG * Math.sin(t * 2.4 + ph[10]) * gl);
      R(B.fingL, this.armFlexL, (8 - 10 * g1) * DEG); R(B.fingR, this.armFlexR, (8 - 10 * g2) * DEG);
      // nods and tilts on the beat of the speech
      R(B.head, [1, 0, 0], (2.5 * beat + 2 * Math.sin(t * 0.9 + ph[11])) * DEG);
      R(B.head, [0, 0, 1], 4 * DEG * Math.sin(t * 0.61 + ph[2]) * e);
    }
    if (n === 'laugh') {
      const bounce = Math.abs(Math.sin(t * 9)) * (0.6 + 0.4 * Math.sin(t * 1.3));
      R(B.chest, [1, 0, 0], (2 + 2.5 * bounce) * DEG); R(B.spine, [1, 0, 0], 2 * DEG);
      R(B.head, [1, 0, 0], -(10 - 3 * bounce) * DEG);
      R(B.clavL, [0, 0, 1], 2.5 * DEG * bounce); R(B.clavR, [0, 0, 1], -2.5 * DEG * bounce);
      // one hand comes up toward the chest
      R(B.armR, [1, 0, 0], -22 * DEG); R(B.armR, [0, 0, 1], 12 * DEG); R(B.foreR, this.armFlexR, -70 * DEG); R(B.foreR, [0, 1, 0], 50 * DEG);
    }
    if (n === 'turn') {
      // little steps while the body comes round (the caller turns the root)
      const st = Math.sin(t * 7);
      R(B.thighL, this.legFlexL, -Math.max(0, st) * 12 * DEG); R(B.shinL, this.legFlexL, Math.max(0, st) * 20 * DEG);
      R(B.thighR, this.legFlexR, -Math.max(0, -st) * 12 * DEG); R(B.shinR, this.legFlexR, Math.max(0, -st) * 20 * DEG);
    }
    if (n === 'walk') {
      const p = this.walkPhase, spd = clamp(this.speed / 1.3, 0.3, 1.5);
      const amp = (21 - 6 * post) * spd * DEG;
      const sL = Math.sin(p), sR = Math.sin(p + Math.PI);
      const knee = (x: number) => (6 + 52 * Math.pow(Math.max(0, Math.sin(x - 1.15)), 1.6) + 8 * Math.max(0, Math.sin(x + 1.9))) * DEG * (0.75 + 0.25 * spd);
      const ank = (x: number) => (8 * Math.sin(x - 0.3) - 6 * Math.max(0, Math.sin(x - 2.1))) * DEG;
      R(B.thighL, this.legFlexL, -amp * sL - 4 * DEG); R(B.thighR, this.legFlexR, -amp * sR - 4 * DEG);
      R(B.shinL, this.legFlexL, knee(p)); R(B.shinR, this.legFlexR, knee(p + Math.PI));
      R(B.footL, this.legFlexL, ank(p)); R(B.footR, this.legFlexR, ank(p + Math.PI));
      // pelvis: rotation, drop on the swing side, bob, side sway (wider for heavier bodies)
      R(B.hips, [0, 1, 0], 5 * DEG * sL * spd); R(B.hips, [0, 0, 1], 3 * DEG * Math.cos(p) * (1 + heavy));
      R(B.chest, [0, 1, 0], -6 * DEG * sL * spd); R(B.spine, [1, 0, 0], 3 * DEG * spd);
      P.root.y += 0.022 * spd * (Math.cos(2 * p) * 0.5 - 0.5) * (1 - 0.4 * heavy);
      P.root.x += 0.012 * Math.sin(p) * (1 + 1.5 * heavy);
      // arms swing opposite the legs
      R(B.armL, [1, 0, 0], amp * 0.75 * sL * (1 - 0.4 * post)); R(B.armR, [1, 0, 0], amp * 0.75 * sR * (1 - 0.4 * post));
      R(B.foreL, this.armFlexL, -(14 + 10 * Math.max(0, -sL)) * DEG); R(B.foreR, this.armFlexR, -(14 + 10 * Math.max(0, -sR)) * DEG);
      R(B.head, [0, 1, 0], 2 * DEG * sL);
    }
    if (n === 'sit') {
      const hipY = this.seatHeight + 0.085 * rig.s;
      P.root.y = hipY - (rig.joints[B.hips][1] - 0.02 * rig.s) + rig.heel * 0.2;
      P.root.x = 0;
      R(B.thighL, this.legFlexL, -88 * DEG); R(B.thighR, this.legFlexR, -88 * DEG);
      R(B.thighL, [0, 1, 0], -6 * DEG * (1 + heavy)); R(B.thighR, [0, 1, 0], 6 * DEG * (1 + heavy));
      R(B.shinL, this.legFlexL, 86 * DEG); R(B.shinR, this.legFlexR, 86 * DEG);
      R(B.spine, [1, 0, 0], 4 * DEG); R(B.chest, [1, 0, 0], 6 * DEG);
      // forearms on the table
      R(B.armL, [1, 0, 0], -26 * DEG); R(B.armR, [1, 0, 0], -26 * DEG);
      R(B.foreL, this.armFlexL, -72 * DEG); R(B.foreR, this.armFlexR, -72 * DEG);
      R(B.foreL, [0, 1, 0], -30 * DEG); R(B.foreR, [0, 1, 0], 30 * DEG);
      const ws = Math.sin(t * 0.5 + ph[3]);
      R(B.head, [0, 1, 0], 6 * DEG * ws); R(B.chest, [0, 1, 0], 3 * DEG * ws);
    }
  }
}
