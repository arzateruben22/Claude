// The player's car: the garage cars from the realism preview (src/preview: four of our own designs with clearcoat
// paint, a real dashboard and tachometer per car, and the driver's anatomical hands on the wheel), on a sprung body
// that pitches under acceleration and braking, rolls in corners and buzzes with the engine, with wheels that spin
// and steer, headlight beams, tail lights that brighten on the brakes, and the game's camera anchors. The OC Hypercar
// also blinks its turn signals (lane changes, and hard steering at low speed) and lights its reversing lamps; its
// driver sits lower and further in (car-shape seatOffset), so its eye and hands move with the seat.
//
// configure() builds or rebuilds only what changed: the car and its cockpit (car id, quality or mirrors), the paint,
// the hands (driver look, presentation, nails). Quality 'phone' is the lighter build, 'high' the full desktop look.
// Mirrors 'live' renders the scene into the rear-view and the driver's door mirror (one extra low-resolution render a
// frame, the two alternating; only from the driver's seat), 'env' shows the sky's environment map in them. The
// rear-view renders the world without this car (body, cabin, hands, wheels): through the bulkhead window a
// mid-engine car's rear-view shows its own engine cover and wing, so it is drawn as a rear camera, the road and the
// traffic behind filling the glass. The door mirror keeps the car's flank in view.

import * as THREE from 'three';
import { buildCar, SWITCHED_LAMPS } from '../../preview/car';
import { buildCockpit, Cockpit } from '../../preview/cockpit';
import { buildDriverArms, DriverArms, HandPose } from '../../preview/hands';
import { addWheel } from '../../preview/car-wheel';
import { Kit } from '../../preview/car-kit';
import { bodyFor } from '../../preview/car-body';
import type { CarBody } from '../../preview/car-body';
import { CarId, shapeFor, rearR, seatOffset } from '../../preview/car-shape';
import { EYE } from '../../preview/spec';
const HYPER_EYE = new THREE.Vector3(0.07, -0.13, -0.02);
import { CarPhysics, SPEC } from './Physics';
import { ORIGIN } from '../world/Path';
import type { Path } from '../world/Path';
import { beamPool, BEAM_POOL } from '../textures';
import type { DriverLook, Presentation } from '../drivers';
import { clamp, damp, lerp } from '../util';

export type CarQuality = 'phone' | 'high';
export type MirrorMode = 'live' | 'env';
export interface CarConfig { car: CarId; paint: number; quality: CarQuality; mirrors: MirrorMode; look: DriverLook; presentation: Presentation; nails: number | null }
export interface CockpitState { delta: number; rpm: number; gear: number; auto: boolean; limiter: boolean; speed: number; throttle: number; brake: number }

// the exterior's parts that only make sense from outside: the tinted glass and the dark cabin silhouette behind it
const OUTSIDE_ONLY = ['glass', 'frit', 'interior', 'seatSil'];
// the beam pool strip: rows along its length (the road's profile is sampled at each), its height above the road,
// and the light it adds at full (linear, before the tone map: the night road sits near 0.003, a lit lane near 0.2)
const POOL_ROWS = 14, POOL_LIFT = 0.025, POOL_LEVEL = 0.18;
// turn signals: 90 flashes a minute (1.5 Hz, lit for half of each), on while the car crosses toward the next lane
// (sideways along the road faster than SIG_RATE m/s for SIG_ARM s, above SIG_MIN m/s) and SIG_HOLD s after; and
// while steering hard (the front wheels past SIG_LOCK rad) below SIG_SLOW m/s, as for a turn
const SIG_HZ = 1.5, SIG_RATE = 0.6, SIG_ARM = 0.2, SIG_HOLD = 1.0, SIG_MIN = 6, SIG_LOCK = 0.12, SIG_SLOW = 12;

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
  readonly beams: THREE.SpotLight[] = [];     // two headlamp beams, off by day: they light the traffic and the walls
  private armsAt = new THREE.Vector3();       // where the driver's arms sit (the seat's offset from the shared frame)
  readonly pool: THREE.Mesh;                  // the painted low-beam pool on the road ahead, laid on the road's profile
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
  // the switched lamps (the hypercar's): its turn signals and reversing lamps, shown only while lit
  private lamps: { L: THREE.Object3D | null; R: THREE.Object3D | null; rev: THREE.Object3D | null } = { L: null, R: null, rev: null };
  // the signals, stepped with the physics (snapshot): the simulation's clock, the lateral rate along the road, how
  // long it has pointed one way, which side is signalling (-1 left, 1 right) and until when, the flash phase's start
  private sig = { t: 0, d: 0, s: 0, rate: 0, arm: 0, armSide: 0, side: 0, until: 0, t0: 0 };
  private lit = { signal: 0, blink: false, reverse: false, brake: false };
  private lastJoint = 0;
  // previous and current physics poses, for interpolation
  private prev = { x: 0, y: 0, z: 0, psi: 0 };
  private cur = { x: 0, y: 0, z: 0, psi: 0 };

  constructor() {
    this.root.rotation.order = 'YXZ';
    // A narrow, soft cone aimed a touch above level: the road under the bumper sits outside it, so the beams reach
    // the traffic and the walls ahead without flooding the first metres of road (a spot's 1/d² × grazing incidence
    // would paint a blown-out blob there). The pool the beams leave on the road is the painted strip below.
    for (const s of [-1, 1]) {
      const b = new THREE.SpotLight(0xfff4e6, 0, 170, 0.2, 0.88, 1.2);
      b.position.set(s * 0.62, 0.55, -2.2); b.target.position.set(s * 0.62, 0.9, -70);
      b.castShadow = false; b.visible = false;
      this.root.add(b, b.target); this.beams.push(b);
    }
    {
      const { w, near, far } = BEAM_POOL, n = POOL_ROWS, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx: number[] = [];
      for (let i = 0; i < n; i++) {
        const k = near + ((far - near) * i) / (n - 1), v = i / (n - 1);
        pos.set([-w / 2, 0, -k, w / 2, 0, -k], i * 6); uv.set([0, v, 1, v], i * 4);
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
      const m = new THREE.MeshBasicMaterial({ map: beamPool(), color: new THREE.Color(POOL_LEVEL, POOL_LEVEL, POOL_LEVEL), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      this.pool = new THREE.Mesh(g, m); this.pool.frustumCulled = false; this.pool.visible = false; this.pool.renderOrder = -1;
      this.root.add(this.pool);
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
    const carChanged = !o || o.car !== c.car || o.quality !== c.quality || o.mirrors !== c.mirrors;
    const paintChanged = !carChanged && o!.paint !== c.paint;
    const handsChanged = carChanged || o!.presentation !== c.presentation || o!.nails !== c.nails || JSON.stringify(o!.look) !== JSON.stringify(c.look);
    this.cfg = c;
    const t0 = performance.now();
    if (carChanged) this.buildCarAndCockpit(c);
    else if (paintChanged) this.setPaint(c.paint);
    if (handsChanged) this.buildHands(c);
    this.setMirrorExclusions();
    this.stats.buildMs = Math.round(performance.now() - t0);
  }

  // the rear-view renders the world without this car; the door mirror sees the flank, so it hides nothing
  private setMirrorExclusions() {
    const rv = this.interior?.mirrors.find((m) => m.name === 'rear-view-mirror');
    if (!rv) return;
    const own: (THREE.Object3D | null | undefined)[] = [this.exterior, this.interior!.group, this.arms?.group, ...this.wheels.map((w) => w.steer)];
    rv.hide = own.filter((o): o is THREE.Object3D => !!o);
  }

  private buildCarAndCockpit(c: CarConfig) {
    if (this.exterior) disposeGeometry(this.exterior);
    if (this.interior) { for (const m of this.interior.mirrors) m.dispose(); disposeGeometry(this.interior.group); }
    for (const w of this.wheels) disposeGeometry(w.steer);
    this.wheels = [];
    let t = performance.now();
    // the hypercar's roof (1.07 m over the shared eye point) is lower than the shared driver's frame: until the full seat
    // drop lands (PROJECT_OC_HYPERCAR.md, M3), its driver sits lower and a little further in, the way the sheet's occupants do
    this.eye.position.copy(EYE);
    if (c.car === 'oc-hyper') this.eye.position.add(HYPER_EYE);
    const ext = buildCar({ car: c.car, paint: c.paint, quality: c.quality, cabin: 'full', wheels: false });
    this.stats.carMs = Math.round(performance.now() - t);
    this.exterior = ext; this.body.add(ext);
    this.mats = ext.userData.materials as Record<string, THREE.Material>;
    this.outsideParts = OUTSIDE_ONLY.map((k) => ext.getObjectByName(k)).filter((x): x is THREE.Object3D => !!x);
    t = performance.now();
    const ck = buildCockpit({ car: c.car, paint: c.paint, quality: c.quality, mirrors: c.mirrors, body: false });
    this.stats.cockpitMs = Math.round(performance.now() - t);
    this.interior = ck; this.body.add(ck.group);
    ck.wheel.rotation.z = this.wheelAngle;
    // wheels: the preview builds them rigid into the body; here each gets its own groups so it spins, and the
    // fronts steer. The calipers stay on the hub (the non-spinning kit); the tyre, rim and disc turn.
    const B = bodyFor(c.car), P = shapeFor(c.car), A = B.AXLE;
    this.buildSunOccluder(B, ck);
    // the driver's eye (the hypercar's sits lower and further in), and the headlamp beams from this car's lamps
    this.eye.position.copy(B.eye); this.hood.position.set(0, P.hoodY ?? 1.0, -1.45);
    this.beams.forEach((b, i) => { const s = i ? 1 : -1; b.position.set(s * B.beamAt.x, B.beamAt.y, B.beamAt.z); b.target.position.set(s * B.beamAt.x, 0.9, -70); });
    this.lamps = { L: ext.getObjectByName('sigL') ?? null, R: ext.getObjectByName('sigR') ?? null, rev: ext.getObjectByName('reverse') ?? null };
    for (const k of SWITCHED_LAMPS) { const m = ext.getObjectByName(k); if (m) m.visible = false; }
    this.armsAt.set(...seatOffset(P));
    if (this.arms) this.arms.group.position.copy(this.armsAt);
    for (const [z, track, front] of [[A.zF, A.trackF, true], [A.zR, A.trackR, false]] as [number, number, boolean][]) {
      const r = front ? A.r : rearR(P), k = r / 0.345, scale = new THREE.Matrix4().makeScale(1, k, k);
      for (const out of [1, -1] as const) {
        const hub = new Kit(), spinKit = new Kit();
        addWheel(hub, { q: c.quality, front, style: P.wheel, w: front ? A.wF : A.wR, sidewall: P.sidewall }, scale, out, spinKit);
        const steer = new THREE.Group(), spin = new THREE.Group();
        hub.build(this.mats, steer, { shadow: () => false });
        spinKit.build(this.mats, spin, { shadow: (key) => key === 'tyre' || key === 'rimPaint' });
        steer.position.set(out * track, r, z); steer.add(spin);
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
    this.arms.group.position.copy(this.armsAt);
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
  // from outside the car the tinted glass and the cabin silhouette show; from the seat they would be in the way.
  // The live mirrors only render from the seat: from outside they are a few pixels behind the glass.
  setOutsideView(v: boolean) {
    for (const o of this.outsideParts) o.visible = v;
    if (this.interior) for (const m of this.interior.mirrors) m.active = !v;
  }

  // The cabin as the sun's lens flare sees it: a box with the glass as openings (the windscreen under its header
  // lip, the side windows, the rear screen, the Vela's glass roof) and the rear-view mirror hanging in it. The real
  // body is 180k triangles, far too many to raycast every few frames, and this is what matters from the seat.
  private occ = { ray: new THREE.Ray(), inv: new THREE.Matrix4(), box: new THREE.Box3(), openings: [] as THREE.Vector3[][], mirror: [] as THREE.Vector3[], p: new THREE.Vector3() };
  private buildSunOccluder(B: CarBody, ck: Cockpit) {
    const o = this.occ, v = () => new THREE.Vector3();
    const quad = (f: (s: number, t: number) => THREE.Vector3) => [f(-1, 0), f(1, 0), f(1, 1), f(-1, 1)];
    o.openings = [
      quad((s, t) => B.wsPoint(s, t * 0.95, 0, v())),
      quad((s, t) => B.sgPoint((s + 1) / 2, t, 1, v())), quad((s, t) => B.sgPoint((s + 1) / 2, t, -1, v())),
      quad((s, t) => B.rgPoint(s, t, v())),
    ];
    if (B.RF) o.openings.push(quad((s, t) => B.rfPoint(s, t, v())));
    const rv = ck.rearView;
    if (rv) {
      const x = v().set(0, 1, 0).cross(rv.normal).normalize(), y = rv.normal.clone().cross(x);
      o.mirror = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => rv.at.clone().addScaledVector(x, (a * rv.w) / 2).addScaledVector(y, (b * rv.h) / 2));
    } else o.mirror = [];
    o.box.min.set(-1.05, 0.65, B.wsPoint(0, 0, 0, v()).z - 0.05); o.box.max.set(1.05, 1.75, B.rgPoint(0, 1, v()).z + 0.1);
  }
  // whether the car hides what lies far along dir (world space) from origin: from inside the cabin the ray must
  // leave through an opening and miss the mirror; from outside, the cabin is solid
  sunBlocked(origin: THREE.Vector3, dir: THREE.Vector3): boolean {
    const o = this.occ, r = o.ray;
    if (!o.openings.length) return false;
    o.inv.copy(this.body.matrixWorld).invert();
    r.origin.copy(origin).applyMatrix4(o.inv); r.direction.copy(dir).transformDirection(o.inv);
    const hits = (q: THREE.Vector3[]) => !!(r.intersectTriangle(q[0], q[1], q[2], false, o.p) || r.intersectTriangle(q[0], q[2], q[3], false, o.p));
    if (!o.box.containsPoint(r.origin)) return r.intersectsBox(o.box);
    if (o.mirror.length && hits(o.mirror)) return true;
    for (const q of o.openings) if (hits(q)) return false;
    return true;
  }

  // on: the beams' level (0 by day, 1 at night); dark: how dark it is, so the painted pool keeps a lower level when
  // the lamps come on for rain or fog by day
  setHeadlights(on: number, dark = 1) {
    for (const b of this.beams) { b.visible = on > 0.02; b.intensity = on * 70; }
    this.pool.visible = on > 0.02; (this.pool.material as THREE.MeshBasicMaterial).opacity = on * lerp(0.35, 1, clamp(dark, 0, 1));
    const lamp = this.mats.lamp as THREE.MeshPhysicalMaterial | undefined;
    if (lamp) lamp.emissiveIntensity = 2.4 + on * 3;
  }

  snapshot(p: CarPhysics, dt = 1 / 120) {
    this.prev.x = this.cur.x; this.prev.y = this.cur.y; this.prev.z = this.cur.z; this.prev.psi = this.cur.psi; this.cur.x = p.x; this.cur.y = p.y; this.cur.z = p.z; this.cur.psi = p.psi;
    this.stepSignals(p, dt);
  }
  teleport(p: CarPhysics) { this.snapshot(p); this.snapshot(p); Object.assign(this.sig, { d: p.d, s: p.s, rate: 0, arm: 0, armSide: 0, side: 0, until: 0 }); }

  // The turn signals, with the physics: the car's sideways speed along the road (from its offset d; a jump of
  // more than a metre in one step is a change of road, not a move) smoothed over about 0.15 s. Crossing toward the
  // next lane lights the side it moves to; full lock at low speed lights the side it turns to.
  private stepSignals(p: CarPhysics, dt: number) {
    const g = this.sig;
    g.t += dt;
    const dd = p.d - g.d, jump = Math.abs(dd) > 1 || Math.abs(p.s - g.s) > 5;
    g.d = p.d; g.s = p.s;
    if (!jump && dt > 0) g.rate += (dd / dt - g.rate) * Math.min(1, dt / 0.15);
    const v = Math.abs(p.vx);
    let want = 0, hold = 0;
    const side = Math.sign(g.rate);
    if (v > SIG_MIN && Math.abs(g.rate) > SIG_RATE) {
      if (g.armSide !== side) { g.armSide = side; g.arm = 0; }
      g.arm += dt;
      if (g.arm >= SIG_ARM) { want = side; hold = SIG_HOLD; }
    } else { g.arm = 0; g.armSide = 0; }
    if (!want && v < SIG_SLOW && v > 0.5 && Math.abs(p.delta) > SIG_LOCK) { want = p.delta > 0 ? -1 : 1; hold = 0.4; }   // delta + is left
    if (want) {
      if (g.side !== want || g.t > g.until) g.t0 = g.t;            // a new signal starts lit
      g.side = want; g.until = g.t + hold;
    } else if (g.t > g.until) g.side = 0;
  }
  // what the lamps show this frame (for the tests): the signalling side, whether it is lit now, reversing, braking
  get lightState() { return { ...this.lit }; }

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

  // place everything for this frame; alpha blends the last two physics steps. With the road's path the beam pool is
  // laid on the road's profile ahead (crests and sags), without it the pool lies flat on the car's grade.
  update(dt: number, alpha: number, p: CarPhysics, braking: boolean, now: number, path?: Path) {
    const x = lerp(this.prev.x, this.cur.x, alpha), z = lerp(this.prev.z, this.cur.z, alpha), y = lerp(this.prev.y, this.cur.y, alpha);
    let dpsi = this.cur.psi - this.prev.psi; dpsi = Math.atan2(Math.sin(dpsi), Math.cos(dpsi));
    const psi = this.prev.psi + dpsi * alpha;
    this.root.position.set(x - ORIGIN.x, y, z - ORIGIN.z);
    this.root.rotation.y = psi + Math.PI;
    this.root.rotation.x = Math.atan(p.slope) * Math.cos(psi - p.psi);
    if (this.pool.visible) this.layPool(p.s, y, path);
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
    // the hypercar's switched lamps: the signals flash from the moment they start; reverse while backing up
    const g = this.sig, L = this.lit;
    L.signal = g.side; L.blink = g.side !== 0 && ((g.t - g.t0) * SIG_HZ) % 1 < 0.5; L.reverse = p.gear < 0 || p.vx < -0.3; L.brake = braking;
    if (this.lamps.L) this.lamps.L.visible = L.blink && g.side < 0;
    if (this.lamps.R) this.lamps.R.visible = L.blink && g.side > 0;
    if (this.lamps.rev) this.lamps.rev.visible = L.reverse;
    void now;
  }

  // the pool's rows follow the road's height ahead of the car, expressed in the root's frame (which carries the
  // car's pitch on the grade), a few centimetres above the surface so it never fights the road for depth
  private layPool(s: number, y: number, path?: Path) {
    const attr = this.pool.geometry.attributes.position as THREE.BufferAttribute, a = attr.array as Float32Array;
    const th = this.root.rotation.x, c = Math.cos(th), sn = Math.sin(th), { near, far } = BEAM_POOL;
    for (let i = 0; i < POOL_ROWS; i++) {
      const k = near + ((far - near) * i) / (POOL_ROWS - 1);
      let ly = POOL_LIFT, lz = -k;
      if (path) { const dy = path.height(s + k) - y; ly = dy * c - k * sn + POOL_LIFT; lz = -(dy * sn + k * c); }
      a[i * 6 + 1] = ly; a[i * 6 + 2] = lz; a[i * 6 + 4] = ly; a[i * 6 + 5] = lz;
    }
    attr.needsUpdate = true;
  }
}
