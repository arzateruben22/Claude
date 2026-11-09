// The bar's new animation clips (PROJECT_OC_SPORTS_BAR.md, "Who changes src/onfoot/people/"): drink, eat, three dances
// (sway, two-step, arm pump), cheer, groan and clap, as an external pose layer over the people builder's rig. The
// builder isn't edited before E0. After person.update(dt), the layer finds the skeleton (the first SkinnedMesh in
// person.group), looks bones up by name (never by index, so new finger bones don't throw it off) and blends its own
// rotations onto them; anim.ts rewrites every bone on each update, so nothing accumulates. Every level of detail is
// bound to the one skeleton, so a clip plays the same at LOD 0, 1 and 2. `upper` makes a clip an upper-body overlay
// (spine, chest, arms and head only), so a seated person can cheer, clap, drink or eat without leaving the seat.
// Rotations are about each bone's rest-frame axes (+x the person's left, +y up, +z forward), as the builder's own
// clips and Lot 57's hold pose (lot57/npcs.ts) use them. At E0 these become AnimNames in people/anim.ts.
import * as THREE from 'three';
import type { Person } from '../../people';

export type ClipName = 'drink' | 'eat' | 'sway' | 'two-step' | 'arm-pump' | 'cheer' | 'groan' | 'clap' | 'wipe';
export const CLIPS: ClipName[] = ['drink', 'eat', 'sway', 'two-step', 'arm-pump', 'cheer', 'groan', 'clap'];
export const DANCES: ClipName[] = ['sway', 'two-step', 'arm-pump'];
/** how long each runs (seconds), or a loop */
export const CLIP_SECONDS: Record<ClipName, number | 'loop'> = { drink: 2.4, eat: 2.2, sway: 'loop', 'two-step': 'loop', 'arm-pump': 'loop', cheer: 1.8, groan: 1.6, clap: 2.2, wipe: 'loop' };
/** the staff's work pose (wiping down, pouring): not one of the plan's guest clips, the bar's own for its staff */
export const STAFF_CLIPS: ClipName[] = ['wipe'];

const DEG = Math.PI / 180;
const BONE_NAMES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'armL', 'armR', 'foreL', 'foreR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'] as const;
type BoneKey = typeof BONE_NAMES[number];
type Bones = Partial<Record<BoneKey, THREE.Bone>>;
interface Playing { name: ClipName; t: number; dur: number; upper: boolean; phase: number; tempo: number; jump: number; out: number }

const _q = new THREE.Quaternion(), _t = new THREE.Quaternion(), _ax = new THREE.Vector3();
/** scratch for arm() and fore(): each result is used (slerped onto its bone) before the next call */
const _arm = new THREE.Quaternion(), _fore = new THREE.Quaternion();
const qa = (x: number, y: number, z: number, ang: number, out = _q) => out.setFromAxisAngle(_ax.set(x, y, z).normalize(), ang);
const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

// The pose helpers, hoisted out of apply() so a frame makes no closures and no quaternions: apply() sets the person's
// bones, the clip's weight and the rig's arm angle here first.
let cB: Bones = {}, cK = 0, cA = 0;
/** blend a bone toward a rotation */
function set(bn: BoneKey, q: THREE.Quaternion, w = cK) { const b = cB[bn]; if (b) b.quaternion.slerp(q, w); }
/** turn a bone by an angle about an axis, scaled by the weight */
function mul(bn: BoneKey, x: number, y: number, z: number, ang: number, w = cK) { const b = cB[bn]; if (b && Math.abs(ang * w) > 1e-6) b.quaternion.multiply(qa(x, y, z, ang * w, _t)); }
/** the upper arm: out to the side by `side` degrees from hanging, forward by `fwd`, turned in by `turn` */
function arm(s: 1 | -1, side: number, fwd: number, turn: number) {
  const q = _arm.setFromAxisAngle(_ax.set(0, 0, 1), s * (cA - side * DEG));
  q.multiply(qa(1, 0, 0, -fwd * DEG, _t)).multiply(qa(0, 1, 0, s * turn * DEG, _t));
  return q;
}
/** the forearm bent by `flex` degrees */
const fore = (s: 1 | -1, flex: number) => qa(Math.cos(cA), -s * Math.sin(cA), 0, -flex * DEG, _fore);

export class ClipLayer {
  private bones = new WeakMap<Person, Bones>();
  private on = new Map<Person, Playing>();
  /** start a clip; `upper` keeps the legs and the root as the builder posed them (a seated person) */
  play(p: Person, name: ClipName, o: { upper?: boolean; seconds?: number; tempo?: number; phase?: number; jump?: number } = {}) {
    const d = CLIP_SECONDS[name];
    this.on.set(p, { name, t: 0, dur: o.seconds ?? (d === 'loop' ? Infinity : d), upper: !!o.upper, phase: o.phase ?? (p.options.seed % 17) * 0.37, tempo: o.tempo ?? 1 + ((p.options.seed % 7) - 3) * 0.02, jump: o.jump ?? 0, out: 0 });
  }
  /** stop a person's clip (it eases out over 0.3 s) */
  stop(p: Person) { const c = this.on.get(p); if (c && c.out === 0) c.out = 0.3; }
  playing(p: Person): ClipName | null { return this.on.get(p)?.name ?? null; }
  forget(p: Person) { this.on.delete(p); this.bones.delete(p); }
  private find(p: Person): Bones {
    let b = this.bones.get(p);
    if (b) return b;
    b = {};
    let sk: THREE.Skeleton | null = null;
    p.group.traverse((o) => { if (!sk && (o as THREE.SkinnedMesh).isSkinnedMesh) sk = (o as THREE.SkinnedMesh).skeleton; });
    for (const n of BONE_NAMES) {
      const bone = (sk as THREE.Skeleton | null)?.getBoneByName(n) ?? (p.group.getObjectByName(n) as THREE.Bone | undefined);
      if (bone) b[n] = bone;
    }
    this.bones.set(p, b);
    return b;
  }
  /** advance a person's clip by dt and blend it onto the bones; call right after person.update(dt). Returns the
   *  clip's weight (0 when nothing plays) */
  apply(p: Person, dt: number): number {
    const c = this.on.get(p); if (!c) return 0;
    c.t += dt;
    if (c.out > 0) { c.out -= dt; if (c.out <= 0) { this.on.delete(p); return 0; } }
    if (c.t >= c.dur) { this.on.delete(p); return 0; }
    const k = c.out > 0 ? smooth(c.out / 0.3) : smooth(c.t / 0.3) * (c.dur === Infinity ? 1 : smooth((c.dur - c.t) / 0.3));
    const B = this.find(p), a = p.rig.armAngle;
    cB = B; cK = k; cA = a;
    const T = c.t * c.tempo, ph = c.phase, beat = Math.PI * 2 * 2 * T + ph;      // 120 beats a minute
    const root = B.root;
    switch (c.name) {
      case 'drink': case 'eat': {
        // the right hand up to the mouth and down again (Lot 57's hold pose with the sip brought in)
        // (S2a's look: Lot 57's sip pose brought the hand to the chest, not the mouth, so the elbow comes further
        // forward, the arm turns in less and the elbow bends more)
        // up over 0.8 s, held, down over the last 0.7 s
        const lift = c.name === 'drink' ? 1 : 0.9, e = smooth(c.t / 0.8) * smooth((c.dur - c.t) / 0.7);
        set('armR', arm(1, 12 - 2 * e, 16 + 44 * e * lift, 16 - 6 * e));
        set('foreR', fore(1, 80 + 72 * e * lift));
        mul('head', 1, 0, 0, (c.name === 'drink' ? -12 : 6) * DEG * e);
        break;
      }
      case 'cheer': {
        // both arms up in a V and pumping, the chest open, the head up; a jump for the active
        const pump = 10 * Math.sin(Math.PI * 2 * 2.6 * c.t + ph);
        set('armR', arm(1, 150 + pump, 18, 0)); set('armL', arm(-1, 150 - pump, 18, 0));
        set('foreR', fore(1, 22)); set('foreL', fore(-1, 22));
        mul('chest', 1, 0, 0, -7 * DEG); mul('head', 1, 0, 0, -12 * DEG);
        if (!c.upper && root && c.jump > 0) root.position.y += c.jump * Math.max(0, Math.sin(Math.PI * 2 * 1.4 * c.t)) * k;
        break;
      }
      case 'groan': {
        // hands to the head, the head down, then sitting back
        const back = smooth((c.t - c.dur * 0.6) / (c.dur * 0.4));
        set('armR', arm(1, 34, 136 - 40 * back, 30)); set('armL', arm(-1, 34, 136 - 40 * back, 30));
        set('foreR', fore(1, 142)); set('foreL', fore(-1, 142));
        mul('head', 1, 0, 0, 14 * DEG * (1 - back)); mul('chest', 1, 0, 0, (8 - 14 * back) * DEG); mul('spine', 1, 0, 0, -4 * DEG * back);
        break;
      }
      case 'clap': {
        // arms forward at the chest, the hands meeting about 2.5 times a second
        const meet = 0.5 + 0.5 * Math.sin(Math.PI * 2 * 2.5 * c.t + ph);
        set('armR', arm(1, 12, 52, 30 + 12 * meet)); set('armL', arm(-1, 12, 52, 30 + 12 * meet));
        set('foreR', fore(1, 72)); set('foreL', fore(-1, 72));
        mul('head', 1, 0, 0, -4 * DEG);
        break;
      }
      case 'sway': {
        const sw = Math.sin(beat / 2), bob = Math.abs(Math.sin(beat / 2));
        mul('hips', 0, 0, 1, 7 * DEG * sw); mul('spine', 0, 0, 1, -4 * DEG * sw); mul('chest', 0, 0, 1, -3 * DEG * sw);
        set('armR', arm(1, 16, 30 + 6 * sw, 14)); set('armL', arm(-1, 16, 30 - 6 * sw, 14));
        set('foreR', fore(1, 72 + 8 * sw)); set('foreL', fore(-1, 72 - 8 * sw));
        mul('head', 0, 0, 1, 4 * DEG * sw); mul('head', 1, 0, 0, 4 * DEG * bob);
        if (!c.upper) { legs(B, a, 10 * bob, 10 * bob, k); if (root) { root.position.x += 0.035 * sw * k; root.position.y -= 0.025 * bob * k; } }
        break;
      }
      case 'two-step': {
        const st = Math.sin(beat / 2), lr = st > 0 ? 1 : 0;
        set('armR', arm(1, 14, 22 - 18 * st, 10)); set('armL', arm(-1, 14, 22 + 18 * st, 10));
        set('foreR', fore(1, 58)); set('foreL', fore(-1, 58));
        mul('chest', 0, 1, 0, 6 * DEG * st); mul('hips', 0, 1, 0, -4 * DEG * st);
        if (!c.upper) {
          legs(B, a, 22 * lr * Math.abs(st), 22 * (1 - lr) * Math.abs(st), k);
          mul('thighL', 0, 0, 1, -6 * DEG * Math.max(0, st)); mul('thighR', 0, 0, 1, 6 * DEG * Math.max(0, -st));
          if (root) { root.position.x += 0.11 * st * k; root.position.y -= 0.02 * Math.abs(Math.sin(beat)) * k; }
        }
        break;
      }
      case 'wipe': {
        // the right hand wiping small circles on the counter, the left resting on it
        const w = Math.PI * 2 * 0.9 * c.t + ph;
        set('armR', arm(1, 12 + 4 * Math.sin(w), 40 + 7 * Math.sin(w), 22 + 9 * Math.cos(w))); set('foreR', fore(1, 52 + 6 * Math.cos(w)));
        set('armL', arm(-1, 10, 32, 12)); set('foreL', fore(-1, 62));
        mul('chest', 1, 0, 0, 5 * DEG); mul('head', 1, 0, 0, 8 * DEG);
        break;
      }
      case 'arm-pump': {
        const pump = Math.sin(beat), bob = Math.abs(Math.sin(beat));
        set('armR', arm(1, 158 - 16 * pump, 20, 0)); set('foreR', fore(1, 30 + 22 * Math.max(0, pump)));
        set('armL', arm(-1, 16, 26, 16)); set('foreL', fore(-1, 84));
        mul('head', 1, 0, 0, 7 * DEG * bob); mul('chest', 1, 0, 0, -3 * DEG * bob);
        if (!c.upper) { legs(B, a, 12 * bob, 12 * bob, k); if (root) root.position.y -= 0.03 * bob * k; }
        break;
      }
    }
    return k;
  }
  /** for the check: the clip's weight on a person and how far it has turned the right upper arm and the chest from
   *  the builder's own pose (radians), measured by running the builder's update and then the layer */
  probe(p: Person, name: ClipName, at: number, upper = false) {
    const B = this.find(p);
    p.update(0.0001);
    const before = { armR: B.armR?.quaternion.clone(), chest: B.chest?.quaternion.clone(), hips: B.hips?.quaternion.clone() };
    this.play(p, name, { upper, seconds: CLIP_SECONDS[name] === 'loop' ? 10 : undefined });
    const c = this.on.get(p)!; c.t = Math.min(at, (c.dur === Infinity ? 10 : c.dur) - 0.31);
    const k = this.apply(p, 0);
    const ang = (x?: THREE.Quaternion, y?: THREE.Quaternion) => (x && y ? 2 * Math.acos(Math.min(1, Math.abs(x.dot(y)))) : 0);
    const out = { clip: name, weight: +k.toFixed(3), armR: +ang(before.armR, B.armR?.quaternion).toFixed(3), chest: +ang(before.chest, B.chest?.quaternion).toFixed(3), hips: +ang(before.hips, B.hips?.quaternion).toFixed(3), bones: Object.keys(B).length };
    this.on.delete(p);
    return out;
  }
}
/** bend both knees by the given degrees (thigh forward, shin back, foot level), blended by k */
function legs(B: Bones, a: number, kneeL: number, kneeR: number, k: number) {
  void a;
  const bend = (thigh?: THREE.Bone, shin?: THREE.Bone, foot?: THREE.Bone, d = 0) => {
    if (!thigh || !shin || !foot || d < 0.01) return;
    thigh.quaternion.multiply(qa(1, 0, 0, -d * 0.5 * DEG * k, _t)); shin.quaternion.multiply(qa(1, 0, 0, d * DEG * k, _t)); foot.quaternion.multiply(qa(1, 0, 0, -d * 0.5 * DEG * k, _t));
  };
  bend(B.thighL, B.shinL, B.footL, kneeL); bend(B.thighR, B.shinR, B.footR, kneeR);
}
