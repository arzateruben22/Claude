// The player's car: the garage cars from the realism preview (src/preview: four of our own designs with clearcoat
// paint, a real dashboard and tachometer per car, and the driver's anatomical hands on the wheel), on a sprung body
// that pitches under acceleration and braking, rolls in corners and buzzes with the engine, with wheels that spin
// and steer, headlight beams, tail lights that brighten on the brakes, and the game's camera anchors.
//
// configure() builds or rebuilds only what changed: the car and its cockpit (car id or quality), the paint, the hands
// (driver look, presentation, nails). Quality 'phone' is the lighter build, 'high' the full desktop look.

import * as THREE from 'three';
import { buildCar } from '../../preview/car';
import { buildCockpit, Cockpit } from '../../preview/cockpit';
import { buildDriverArms, DriverArms, HandPose } from '../../preview/hands';
import { addWheel } from '../../preview/car-wheel';
import { Kit } from '../../preview/car-kit';
import { bodyFor } from '../../preview/car-body';
import { CarId, shapeFor } from '../../preview/car-shape';
import { EYE } from '../../preview/spec';
import { CarPhysics, SPEC } from './Physics';
import { ORIGIN } from '../world/Path';
import type { DriverLook, Presentation } from '../drivers';
import { clamp, damp, lerp } from '../util';

export type CarQuality = 'phone' | 'high';
export interface CarConfig { car: CarId; paint: number; quality: CarQuality; look: DriverLook; presentation: Presentation; nails: number | null }
export interface CockpitState { delta: number; rpm: number; gear: number; auto: boolean; limiter: boolean; speed: number; throttle: number; brake: number }

// the exterior's parts that only make sense from outside: the tinted glass and the dark cabin silhouette behind it
const OUTSIDE_ONLY = ['glass', 'frit', 'interior', 'seatSil'];

function disposeGeometry(o: THREE.Object3D) {
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });   // materials are shared caches
  o.parent?.remove(o);
}

export class PlayerCar {
  readonly root = new THREE.Group();          // position, heading, the road's grade
  readonly body = new THREE.Group();          // sprung: pitch, roll, heave, vibration
  readonly eye = new THREE.Object3D();
  readonly hood = new THREE.Object3D();
  readonly rear = new THREE.Object3D();
  readonly beams: THREE.SpotLight[] = [];     // two headlamp beams, off by day
  stats = { buildMs: 0, carMs: 0, cockpitMs: 0, handsMs: 0 };

  private cfg: CarConfig | null = null;
  private exterior: THREE.Group | null = null;
  private interior: Cockpit | null = null;
  private arms: DriverArms | null = null;
  private mats: Record<string, THREE.Material> = {};
  private outsideParts: THREE.Object3D[] = [];
  private wheels: { steer: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private wheelAngle = 0;
  private sus = { p: 0, pv: 0, r: 0, rv: 0, h: 0, hv: 0 };
  private lastJoint = 0;
  // previous and current physics poses, for interpolation
  private prev = { x: 0, y: 0, z: 0, psi: 0 };
  private cur = { x: 0, y: 0, z: 0, psi: 0 };

  constructor() {
    this.root.rotation.order = 'YXZ';
    for (const s of [-1, 1]) {
      const b = new THREE.SpotLight(0xfff4e6, 0, 170, 0.42, 0.55, 1.6);
      b.position.set(s * 0.62, 0.55, -2.2); b.target.position.set(s * 0.9, -0.2, -40);
      b.castShadow = false; b.visible = false;
      this.root.add(b, b.target); this.beams.push(b);
    }
    this.root.add(this.body);
    this.eye.position.copy(EYE); this.body.add(this.eye);
    this.hood.position.set(0, 1.0, -1.45); this.body.add(this.hood);
    this.rear.position.set(0, 1.15, 2.6); this.rear.rotation.y = Math.PI; this.root.add(this.rear);
  }

  get config() { return this.cfg; }

  // build what changed
  configure(c: CarConfig) {
    const o = this.cfg;
    const carChanged = !o || o.car !== c.car || o.quality !== c.quality;
    const paintChanged = !carChanged && o!.paint !== c.paint;
    const handsChanged = carChanged || o!.presentation !== c.presentation || o!.nails !== c.nails || JSON.stringify(o!.look) !== JSON.stringify(c.look);
    this.cfg = c;
    const t0 = performance.now();
    if (carChanged) this.buildCarAndCockpit(c);
    else if (paintChanged) this.setPaint(c.paint);
    if (handsChanged) this.buildHands(c);
    this.stats.buildMs = Math.round(performance.now() - t0);
  }

  private buildCarAndCockpit(c: CarConfig) {
    if (this.exterior) disposeGeometry(this.exterior);
    if (this.interior) disposeGeometry(this.interior.group);
    for (const w of this.wheels) disposeGeometry(w.steer);
    this.wheels = [];
    let t = performance.now();
    const ext = buildCar({ car: c.car, paint: c.paint, quality: c.quality, cabin: 'full', wheels: false });
    this.stats.carMs = Math.round(performance.now() - t);
    this.exterior = ext; this.body.add(ext);
    this.mats = ext.userData.materials as Record<string, THREE.Material>;
    this.outsideParts = OUTSIDE_ONLY.map((k) => ext.getObjectByName(k)).filter((x): x is THREE.Object3D => !!x);
    t = performance.now();
    const ck = buildCockpit({ car: c.car, paint: c.paint, quality: c.quality, mirrors: 'env', body: false });
    this.stats.cockpitMs = Math.round(performance.now() - t);
    this.interior = ck; this.body.add(ck.group);
    ck.wheel.rotation.z = this.wheelAngle;
    // wheels: the preview builds them rigid into the body; here each gets its own groups so it spins, and the
    // fronts steer. The calipers stay on the hub (the non-spinning kit); the tyre, rim and disc turn.
    const B = bodyFor(c.car), P = shapeFor(c.car), A = B.AXLE, k = A.r / 0.345;
    const scale = new THREE.Matrix4().makeScale(1, k, k);
    for (const [z, track, front] of [[A.zF, A.trackF, true], [A.zR, A.trackR, false]] as [number, number, boolean][]) {
      for (const out of [1, -1] as const) {
        const hub = new Kit(), spinKit = new Kit();
        addWheel(hub, { q: c.quality, front, style: P.wheel, w: front ? A.wF : A.wR }, scale, out, spinKit);
        const steer = new THREE.Group(), spin = new THREE.Group();
        hub.build(this.mats, steer, { shadow: () => false });
        spinKit.build(this.mats, spin, { shadow: (key) => key === 'tyre' || key === 'rimPaint' });
        steer.position.set(out * track, A.r, z); steer.add(spin);
        this.root.add(steer);
        this.wheels.push({ steer, spin, front });
      }
    }
  }

  private buildHands(c: CarConfig) {
    if (this.arms) { this.arms.dispose(); this.arms.group.parent?.remove(this.arms.group); }
    const t = performance.now();
    this.arms = buildDriverArms({ look: c.look, presentation: c.presentation, nails: c.nails, quality: c.quality });
    this.stats.handsMs = Math.round(performance.now() - t);
    this.body.add(this.arms.group);
    this.arms.setWheelAngle(this.wheelAngle);
  }

  private setPaint(hex: number) {
    const m = this.mats.paint as THREE.MeshPhysicalMaterial | undefined;
    if (m) m.color.setHex(hex);
  }

  // the driver's look (sleeves, gloves, watch, ring, bracelet, skin) without rebuilding the car
  setLook(look: DriverLook) { if (this.cfg) this.configure({ ...this.cfg, look }); }
  // the ability's hand animation: the left hand waves (Clear Path), the left wrist comes up for a watch check (Focus
  // Time), the right hand rests on the console (Locked In); null puts both hands back on the rim. Blended in 0.3 s.
  setPose(pose: HandPose | null) { this.arms?.setPose(pose ?? 'wheel'); }
  flickPaddle(_dir: 1 | -1) { /* the preview's paddles are fixed */ }
  // from outside the car the tinted glass and the cabin silhouette show; from the seat they would be in the way
  setOutsideView(v: boolean) { for (const o of this.outsideParts) o.visible = v; }

  setHeadlights(on: number) {
    for (const b of this.beams) { b.visible = on > 0.02; b.intensity = on * 260; }
    const lamp = this.mats.lamp as THREE.MeshPhysicalMaterial | undefined;
    if (lamp) lamp.emissiveIntensity = 2.4 + on * 3;
  }

  snapshot(p: CarPhysics) { this.prev.x = this.cur.x; this.prev.y = this.cur.y; this.prev.z = this.cur.z; this.prev.psi = this.cur.psi; this.cur.x = p.x; this.cur.y = p.y; this.cur.z = p.z; this.cur.psi = p.psi; }
  teleport(p: CarPhysics) { this.snapshot(p); this.snapshot(p); }

  // the steering wheel, the hands on it, and the tachometer
  updateCockpit(dt: number, s: CockpitState) {
    const target = clamp(s.delta * SPEC.steerRatio, -2.2, 2.2);       // steering ratio, clamped so the hands stay on the rim
    this.wheelAngle = damp(this.wheelAngle, target, 30, dt);
    if (this.interior) {
      this.interior.wheel.rotation.z = this.wheelAngle;
      this.interior.setInstruments?.({ rpm: s.rpm });
      this.interior.update?.(dt);
    }
    this.arms?.setWheelAngle(this.wheelAngle);
  }

  // place everything for this frame; alpha blends the last two physics steps
  update(dt: number, alpha: number, p: CarPhysics, braking: boolean, now: number) {
    const x = lerp(this.prev.x, this.cur.x, alpha), z = lerp(this.prev.z, this.cur.z, alpha), y = lerp(this.prev.y, this.cur.y, alpha);
    let dpsi = this.cur.psi - this.prev.psi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
    const psi = this.prev.psi + dpsi * alpha;
    this.root.position.set(x - ORIGIN.x, y, z - ORIGIN.z);
    this.root.rotation.y = psi + Math.PI;
    this.root.rotation.x = Math.atan(p.slope) * Math.cos(psi - p.psi);
    // suspension: springs toward the load transfer, plus expansion joints every 15 m and a little engine buzz
    const s = this.sus, v = Math.abs(p.vx);
    // springs, stepped at 120 Hz whatever the frame rate (a big frame step would make them blow up)
    const n = Math.min(24, Math.max(1, Math.ceil(dt * 120))), h = dt / n;
    const pt = clamp(p.ax * 0.0042, -0.05, 0.045), rt = clamp(-p.ay * 0.0034, -0.045, 0.045);
    for (let i = 0; i < n; i++) {
      s.pv += (95 * (pt - s.p) - 13 * s.pv) * h; s.p += s.pv * h;
      s.rv += (110 * (rt - s.r) - 14 * s.rv) * h; s.r += s.rv * h;
      s.hv += (260 * (0 - s.h) - 18 * s.hv) * h; s.h += s.hv * h;
    }
    s.p = clamp(s.p, -0.08, 0.08); s.r = clamp(s.r, -0.07, 0.07); s.h = clamp(s.h, -0.06, 0.06);
    const joint = Math.floor(p.s / 15);
    if (joint !== this.lastJoint) { this.lastJoint = joint; if (v > 3) { s.hv -= 0.02 + v * 0.0009; s.pv += 0.03 + v * 0.0006; } }
    const buzz = (p.rpm / 8000) * 0.00035 + v * 0.000012;
    this.body.position.set((Math.random() - 0.5) * buzz, s.h + (Math.random() - 0.5) * buzz * 2, 0);
    this.body.rotation.set(s.p + (Math.random() - 0.5) * buzz * 0.6, 0, s.r);
    for (const w of this.wheels) {
      w.spin.rotation.x = -(w.front ? p.wheelRot : p.wheelRotR);
      if (w.front) w.steer.rotation.y = p.delta;
    }
    const tail = this.mats.tail as THREE.MeshPhysicalMaterial | undefined;
    if (tail) tail.emissiveIntensity = braking ? 5 : 1.6;
    void now;
  }
}
