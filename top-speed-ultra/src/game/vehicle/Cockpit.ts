// The interior, modelled from the reference photo: a flat-bottomed carbon and leather wheel with red stitching,
// a yellow centre badge (our own mark), red start button, drive-mode switch, column paddles and shift lights;
// a binnacle with a round tach between two screens; a round silver vent; black leather over a tan leather fascia;
// tan door panels and seats, a console with a can in the cupholder, and the driver: legs in black shorts with
// white sneakers, and arms that follow the wheel. Car frame: -z forward, +x right, +y up, metres.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from '../textures';
import { Instruments, rpmAngle, Readout } from './Instruments';
import { clamp, damp } from '../util';
import { SPEC } from './Physics';

export const EYE = new THREE.Vector3(-0.37, 1.16, 0.1);
const WHEEL_AT = new THREE.Vector3(-0.37, 0.8, -0.42);
const WHEEL_TILT = -0.38;               // the wheel's face leans back toward the driver
const R = 0.178;                        // rim radius

// --------------------------------------------------------------------------------------------- geometry helpers
// sweep an elliptical section along a path; a/b give the radial and axial half-thickness at each point
function sweep(path: THREE.Vector3[], normals: THREE.Vector3[], binormals: THREE.Vector3[], a: (i: number) => number, b: (i: number) => number,
  segs = 14, uvAlong = 0.05, swapUV = false) {
  const n = path.length, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) len += path[i].distanceTo(path[i - 1]);
    for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2, ca = Math.cos(th) * a(i), sb = Math.sin(th) * b(i);
      const p = path[i], N = normals[i], B = binormals[i];
      pos.push(p.x + N.x * ca + B.x * sb, p.y + N.y * ca + B.y * sb, p.z + N.z * ca + B.z * sb);
      if (swapUV) uv.push(len / uvAlong, j / segs); else uv.push(j / segs, len / uvAlong);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
    const q = i * (segs + 1) + j, r = q + segs + 1;
    idx.push(q, r, q + 1, q + 1, r, r + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// a closed 2D profile in the car's (z, y) plane, extruded across x
function acrossX(profile: [number, number][], x0: number, x1: number, bevel = 0.006) {
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0 - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 12 });
  g.rotateY(-Math.PI / 2);
  g.translate(x1 - bevel, 0, 0);
  return g;
}
function capsule(a: THREE.Vector3, b: THREE.Vector3, r: number, rb = r) {
  const len = a.distanceTo(b);
  const g = rb === r ? new THREE.CapsuleGeometry(r, len, 6, 16) : new THREE.CylinderGeometry(rb, r, len, 16);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// the rim's centreline in the wheel's own plane: round, flattened at the bottom, a touch flatter on top
function rimAt(a: number) {
  let x = Math.cos(a) * R, y = Math.sin(a) * R;
  const fb = -R * 0.74, ft = R * 0.93;
  if (y < fb) { y = fb + (y - fb) * 0.16; x *= 1.04; }
  if (y > ft) y = ft + (y - ft) * 0.45;
  return new THREE.Vector3(x, y, 0);
}
const ang = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const gripBulge = (a: number) => Math.exp(-(ang(a, 0) ** 2) / 0.22) + Math.exp(-(ang(a, Math.PI) ** 2) / 0.22);
const rimA = (a: number) => 0.0185 + 0.006 * gripBulge(a);
const rimB = (a: number) => 0.0235 + 0.006 * gripBulge(a);
function rimFrames(a0: number, a1: number, n: number) {
  const path: THREE.Vector3[] = [], N: THREE.Vector3[] = [], B: THREE.Vector3[] = [], as: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    const p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
    const out = p.clone().sub(t.clone().multiplyScalar(p.dot(t))).normalize();
    path.push(p);
    N.push(out); B.push(new THREE.Vector3(0, 0, 1)); as.push(a);
  }
  return { path, N, B, as };
}

// --------------------------------------------------------------------------------------------- materials
function materials() {
  const lea = T.leather(), carb = T.carbon();
  const leatherMap = lea.map.clone(), leatherN = lea.normalMap.clone();
  leatherMap.repeat.set(18, 18); leatherN.repeat.set(18, 18); leatherMap.needsUpdate = leatherN.needsUpdate = true;
  const carbMap = carb.map.clone(), carbN = carb.normalMap.clone();
  carbMap.repeat.set(1, 1); carbN.repeat.set(1, 1); carbMap.needsUpdate = carbN.needsUpdate = true;
  const stitchTex = T.stitch();
  return {
    black: new THREE.MeshStandardMaterial({ color: 0x121214, map: leatherMap, normalMap: leatherN, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.78, envMapIntensity: 0.55 }),
    tan: new THREE.MeshStandardMaterial({ color: 0xc8843f, map: leatherMap, normalMap: leatherN, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.62, envMapIntensity: 0.6 }),
    carbon: new THREE.MeshPhysicalMaterial({ map: carbMap, normalMap: carbN, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.38, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 1, roughness: 0.26 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 1, roughness: 0.1 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.5 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 1 }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xa80d10, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.85 }),
    redBtn: new THREE.MeshStandardMaterial({ color: 0xc8141b, roughness: 0.35 }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xcf9773, roughness: 0.6, sheen: 0.15, sheenColor: new THREE.Color(0xff9f80), sheenRoughness: 0.7, envMapIntensity: 0.6 }),
    handSkin: new THREE.MeshPhysicalMaterial({ color: 0xcf9773, roughness: 0.6, sheen: 0.15, sheenColor: new THREE.Color(0xff9f80), sheenRoughness: 0.7, envMapIntensity: 0.6, side: THREE.DoubleSide }),
    shorts: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.95 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x1d2a3d, roughness: 0.9 }),
    sock: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0xedeeeb, roughness: 0.75 }),
    sole: new THREE.MeshStandardMaterial({ color: 0xc9c9c4, roughness: 0.85 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.9 }),
    stitch: new THREE.MeshStandardMaterial({ color: 0xffffff, map: stitchTex, alphaTest: 0.4, roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 2.2, depthWrite: false }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 1, roughness: 0.04 }),
    tint: new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.3, metalness: 0.4 }),
  };
}
export type CockpitMaterials = ReturnType<typeof materials>;

export class Cockpit {
  readonly group = new THREE.Group();
  readonly instruments = new Instruments();
  readonly m = materials();
  readonly driverBody = new THREE.Group();      // head and torso: only shown from outside the car
  private wheelMount = new THREE.Group();
  private wheelSpin = new THREE.Group();
  private needle!: THREE.Mesh;
  private leds: THREE.MeshStandardMaterial[] = [];
  private paddles: THREE.Mesh[] = [];
  private paddleT = [0, 0];
  private hands: { anchor: THREE.Object3D; wrist: THREE.Object3D; shoulder: THREE.Vector3; pole: THREE.Vector3; fore: THREE.Mesh; upper: THREE.Mesh; elbow: THREE.Mesh }[] = [];
  private rightFoot = new THREE.Group();
  private manettino!: THREE.Mesh;
  private faceMats: THREE.MeshBasicMaterial[] = [];
  private wheelAngle = 0;
  private footBrake = 0;

  constructor() {
    this.group.name = 'cockpit';
    this.buildWheel();
    this.buildCluster();
    this.buildDash();
    this.buildCabin();
    this.buildDriver();
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  }

  // --------------------------------------------------------------------------------------- the steering wheel
  private buildWheel() {
    const m = this.m;
    this.wheelMount.position.copy(WHEEL_AT);
    this.wheelMount.rotation.x = WHEEL_TILT;
    this.group.add(this.wheelMount);
    this.wheelMount.add(this.wheelSpin);
    const spin = this.wheelSpin;
    const zone = (a0: number, a1: number, mat: THREE.Material, n: number) => {
      const f = rimFrames(a0, a1, n);
      const g = sweep(f.path, f.N, f.B, (i) => rimA(f.as[i]), (i) => rimB(f.as[i]), 18, 0.05);
      spin.add(new THREE.Mesh(g, mat));
      return f;
    };
    // carbon across the top and the flat bottom, leather where your hands go
    zone(0.62, 2.52, m.carbon, 40);
    zone(3.98, 5.44, m.carbon, 34);
    const leatherR = zone(-0.84, 0.62, m.black, 36);
    const leatherL = zone(2.52, 3.98, m.black, 36);
    // red stitching down both sides of each leather section
    for (const f of [leatherR, leatherL]) for (const th of [Math.PI / 2 - 0.85, Math.PI / 2 + 0.85]) {
      const path = f.path.map((p, i) => p.clone().addScaledVector(f.N[i], Math.cos(th) * rimA(f.as[i]) * 1.03).addScaledVector(f.B[i], Math.sin(th) * rimB(f.as[i]) * 1.03));
      spin.add(new THREE.Mesh(sweep(path, f.N, f.B, () => 0.0011, () => 0.0011, 5, 0.024, true), m.stitch));
    }
    // seams where carbon meets leather
    for (const a of [0.62, 2.52, 3.98, -0.84]) {
      const p = rimAt(a), t = rimAt(a + 0.002).sub(rimAt(a - 0.002)).normalize();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rimB(a) * 0.98, 0.0022, 6, 20), m.alu);
      ring.position.copy(p); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
      ring.scale.set(rimA(a) / rimB(a), 1, 1);
      spin.add(ring);
    }
    // hub and spokes
    const hubShape = new THREE.Shape();
    const hw = 0.1, hh = 0.064, cr = 0.032;
    hubShape.moveTo(-hw + cr, -hh); hubShape.lineTo(hw - cr, -hh); hubShape.quadraticCurveTo(hw, -hh, hw, -hh + cr);
    hubShape.lineTo(hw, hh - cr); hubShape.quadraticCurveTo(hw, hh, hw - cr, hh); hubShape.lineTo(-hw + cr, hh);
    hubShape.quadraticCurveTo(-hw, hh, -hw, hh - cr); hubShape.lineTo(-hw, -hh + cr); hubShape.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
    const hub = new THREE.ExtrudeGeometry(hubShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.008, bevelSegments: 4, curveSegments: 10 });
    hub.translate(0, -0.012, -0.03);
    spin.add(new THREE.Mesh(hub, m.black));
    for (const s of [-1, 1]) {
      const sp = new RoundedBoxGeometry(0.07, 0.05, 0.022, 3, 0.008); sp.translate(s * 0.128, -0.004, -0.004);
      spin.add(new THREE.Mesh(sp, m.carbon));
    }
    const bottom = new RoundedBoxGeometry(0.062, 0.06, 0.02, 3, 0.008); bottom.translate(0, -0.1, -0.006);
    spin.add(new THREE.Mesh(bottom, m.carbon));
    const smile = new RoundedBoxGeometry(0.15, 0.012, 0.012, 2, 0.005); smile.translate(0, 0.05, 0.004);
    spin.add(new THREE.Mesh(smile, m.carbon));
    // the yellow badge: our own make's mark, an R
    const badgeTex = T.label('badge', 256, 256, (g, w, h) => {
      g.fillStyle = '#f5c518'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#111'; g.font = 'italic 800 150px "Saira Semi Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('R', w / 2 + 4, h / 2 + 8);
    });
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.025, 40), new THREE.MeshPhysicalMaterial({ map: badgeTex, roughness: 0.25, clearcoat: 1, emissive: 0xffffff, emissiveMap: badgeTex, emissiveIntensity: 0.35 }));
    badge.position.set(0, -0.004, 0.0275);
    spin.add(badge);
    const badgeRing = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.0018, 8, 48), m.chrome); badgeRing.position.copy(badge.position);
    spin.add(badgeRing);
    // ENGINE START STOP, lower left
    const startTex = T.label('start', 128, 128, (g, w, h) => {
      g.fillStyle = '#c8141b'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = '700 22px "Saira Semi Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ENGINE', w / 2, h / 2 - 24); g.fillText('START', w / 2, h / 2); g.fillText('STOP', w / 2, h / 2 + 24);
    });
    const startGeo = new THREE.CylinderGeometry(0.0135, 0.0145, 0.009, 32); startGeo.rotateX(Math.PI / 2);
    const start = new THREE.Mesh(startGeo, [m.redBtn, new THREE.MeshStandardMaterial({ map: startTex, roughness: 0.35 }), m.redBtn]);
    start.position.set(-0.062, -0.052, 0.024);
    spin.add(start);
    // the drive-mode switch, lower right: a black ring with a red lever
    const manBase = new THREE.CylinderGeometry(0.017, 0.018, 0.008, 32); manBase.rotateX(Math.PI / 2);
    const man = new THREE.Mesh(manBase, m.plastic); man.position.set(0.062, -0.05, 0.022); spin.add(man);
    this.manettino = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.007, 0.007, 2, 0.002), m.redBtn);
    this.manettino.position.set(0.062, -0.05, 0.029); this.manettino.rotation.z = 0.5;
    spin.add(this.manettino);
    const manLabel = T.label('manettino', 256, 128, (g, w) => {
      g.clearRect(0, 0, w, 128); g.fillStyle = '#e8e8e4'; g.font = '700 22px "Saira Semi Condensed", Arial, sans-serif'; g.textAlign = 'center';
      ['WET', 'SPORT', 'RACE', 'CT OFF', 'ESC OFF'].forEach((t, i) => g.fillText(t, 30 + i * 48, 40 + Math.abs(i - 2) * 16));
    });
    const ml = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), new THREE.MeshBasicMaterial({ map: manLabel, transparent: true }));
    ml.position.set(0.062, -0.022, 0.0262); spin.add(ml);
    // small buttons on the spokes: indicators, lights, wipers; road, voice
    const icon = (key: string, draw: (g: CanvasRenderingContext2D) => void) => T.label('icon' + key, 64, 64, (g) => {
      g.fillStyle = '#121315'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#e8e8e4'; g.fillStyle = '#e8e8e4'; g.lineWidth = 5; draw(g);
    });
    const icons = [
      icon('l', (g) => { g.beginPath(); g.moveTo(16, 32); g.lineTo(40, 14); g.lineTo(40, 50); g.closePath(); g.fill(); }),
      icon('lights', (g) => { g.beginPath(); g.arc(36, 32, 12, -1.6, 1.6); g.stroke(); for (const y of [22, 32, 42]) { g.beginPath(); g.moveTo(10, y); g.lineTo(22, y); g.stroke(); } }),
      icon('wiper', (g) => { g.beginPath(); g.arc(32, 46, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(32, 46); g.lineTo(46, 22); g.stroke(); }),
      icon('r', (g) => { g.beginPath(); g.moveTo(48, 32); g.lineTo(24, 14); g.lineTo(24, 50); g.closePath(); g.fill(); }),
      icon('road', (g) => { g.beginPath(); g.moveTo(8, 40); for (let x = 8; x <= 56; x += 8) g.lineTo(x, 40 + (x % 16 ? -8 : 0)); g.stroke(); }),
      icon('voice', (g) => { g.beginPath(); g.arc(32, 26, 9, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(32, 30, 16, 0.3, Math.PI - 0.3); g.stroke(); }),
    ];
    const btnGeo = new THREE.CylinderGeometry(0.0068, 0.0072, 0.005, 24); btnGeo.rotateX(Math.PI / 2);
    const spots: [number, number][] = [[-0.118, 0.008], [-0.14, -0.012], [-0.112, -0.016], [0.118, 0.008], [0.14, -0.012], [0.112, -0.016]];
    spots.forEach(([x, y], i) => {
      const b = new THREE.Mesh(btnGeo, [m.plastic, new THREE.MeshStandardMaterial({ map: icons[i], roughness: 0.4 }), m.plastic]);
      b.position.set(x, y, 0.009); spin.add(b);
    });
    // shift lights along the top of the rim: green, red, blue
    for (let i = 0; i < 10; i++) {
      const a = 2.02 - (i / 9) * 0.92;
      const p = rimAt(a), out = p.clone().normalize();
      const col = i < 4 ? 0x2bff5a : i < 7 ? 0xff2020 : 0x2a6bff;
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: col, emissiveIntensity: 0, roughness: 0.3 });
      const led = new THREE.Mesh(new RoundedBoxGeometry(0.009, 0.004, 0.003, 1, 0.001), mat);
      led.position.copy(p).addScaledVector(out, -0.004); led.position.z = rimB(a) + 0.0008;
      led.rotation.z = a - Math.PI / 2;
      spin.add(led); this.leds.push(mat);
    }
    // the column and its paddles: they stay put while the wheel turns
    const col = new THREE.CylinderGeometry(0.032, 0.045, 0.3, 20); col.rotateX(Math.PI / 2); col.translate(0, 0, -0.18);
    this.wheelMount.add(new THREE.Mesh(col, m.plastic));
    const shroud = new RoundedBoxGeometry(0.12, 0.08, 0.16, 3, 0.02); shroud.translate(0, -0.005, -0.12);
    this.wheelMount.add(new THREE.Mesh(shroud, m.black));
    for (const s of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.022); shape.lineTo(0.1, -0.03); shape.quadraticCurveTo(0.13, 0, 0.1, 0.034); shape.lineTo(0, 0.022); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 });
      g.translate(0.05, 0, 0);
      if (s < 0) g.rotateY(Math.PI);                 // the left paddle is the right one turned around
      const p = new THREE.Mesh(g, m.carbon);
      p.position.set(0, 0.03, -0.045); p.rotation.z = s * 0.12;
      this.wheelMount.add(p); this.paddles.push(p);
    }
  }

  // --------------------------------------------------------------------------------------- the binnacle
  private buildCluster() {
    const m = this.m, cl = new THREE.Group();
    cl.position.set(-0.37, 0.872, -0.62);
    cl.rotation.x = -0.28;
    this.group.add(cl);
    const back = new RoundedBoxGeometry(0.47, 0.18, 0.03, 4, 0.012); back.translate(0, 0, -0.02);
    cl.add(new THREE.Mesh(back, m.plastic));
    const face = new THREE.MeshBasicMaterial({ map: this.instruments.face, toneMapped: false, color: 0xdddddd });
    this.faceMats.push(face);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.074, 72), face); dial.position.z = 0.0;
    cl.add(dial);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.0765, 0.005, 12, 72), m.chrome); bezel.position.z = 0.002; cl.add(bezel);
    const bezel2 = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.006, 10, 72), m.carbon); bezel2.position.z = -0.002; cl.add(bezel2);
    const ng = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.0022, -0.012), new THREE.Vector2(0.0022, -0.012), new THREE.Vector2(0.0008, 0.066), new THREE.Vector2(-0.0008, 0.066)]));
    this.needle = new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ color: 0xff4a1a, toneMapped: false }));
    this.needle.position.z = 0.004; cl.add(this.needle);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.006, 24).rotateX(Math.PI / 2), m.plastic); cap.position.z = 0.006; cl.add(cap);
    const gear = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.0225), new THREE.MeshBasicMaterial({ map: this.instruments.gear.tex, toneMapped: false }));
    gear.position.set(0.024, -0.04, 0.003); cl.add(gear);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.077, 48), m.glass); glass.position.z = 0.011; cl.add(glass);
    for (const s of [-1, 1]) {
      const mat = new THREE.MeshBasicMaterial({ map: s < 0 ? this.instruments.left.tex : this.instruments.right.tex, toneMapped: false, color: 0xd8d8d8 });
      this.faceMats.push(mat);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.135, 0.079), mat);
      scr.position.set(s * 0.148, -0.004, -0.004); scr.rotation.y = -s * 0.2;
      cl.add(scr);
      const frame = new RoundedBoxGeometry(0.143, 0.087, 0.006, 2, 0.003); frame.translate(s * 0.148, -0.004, -0.008);
      const fm = new THREE.Mesh(frame, m.plastic); fm.rotation.y = 0; cl.add(fm);
    }
    // the cowl over it all: black leather with stitching along the lip
    const hood = acrossX([[-0.16, 0.06], [-0.08, 0.115], [0.02, 0.125], [0.085, 0.108], [0.11, 0.085], [0.098, 0.082], [0.07, 0.1], [0.0, 0.11], [-0.09, 0.098], [-0.16, 0.045]], -0.27, 0.27, 0.01);
    const hm = new THREE.Mesh(hood, m.black); hm.position.set(0, -0.045, -0.06); cl.add(hm);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.5, 6).rotateZ(Math.PI / 2), m.stitch);
    lip.position.set(0, 0.064, 0.044); cl.add(lip);
  }

  // --------------------------------------------------------------------------------------- dashboard
  private buildDash() {
    const m = this.m, g = this.group;
    // black upper dash, low enough to see the road over
    const top = acrossX([[-1.18, 0.83], [-1.0, 0.855], [-0.82, 0.86], [-0.7, 0.852], [-0.655, 0.836], [-0.638, 0.81], [-0.636, 0.782], [-0.8, 0.77], [-1.18, 0.78]], -0.99, 0.99);
    g.add(new THREE.Mesh(top, m.black));
    const trim = new RoundedBoxGeometry(1.94, 0.014, 0.022, 2, 0.005); trim.translate(0, 0.778, -0.632);
    g.add(new THREE.Mesh(trim, m.carbon));
    // the tan leather fascia below it
    const fascia = acrossX([[-0.636, 0.772], [-0.628, 0.73], [-0.6, 0.66], [-0.585, 0.6], [-0.61, 0.55], [-0.86, 0.54], [-0.86, 0.772]], -0.99, 0.99);
    g.add(new THREE.Mesh(fascia, m.tan));
    const under = acrossX([[-0.61, 0.55], [-0.66, 0.5], [-0.9, 0.32], [-1.05, 0.3], [-1.05, 0.55]], -0.99, 0.99);
    g.add(new THREE.Mesh(under, m.black));
    const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 1.9, 6).rotateZ(Math.PI / 2), m.stitch);
    seam.position.set(0, 0.765, -0.634); g.add(seam);
    const seam2 = seam.clone(); seam2.position.set(0, 0.842, -0.66); g.add(seam2);
    // round silver vents: one beside the cluster (the one in the photo), one far left, one far right
    for (const [x, y, z, s] of [[0.03, 0.705, -0.608, 1.0], [-0.86, 0.71, -0.615, 0.8], [0.86, 0.71, -0.615, 0.8]] as [number, number, number, number][]) {
      const v = new THREE.Group(); v.position.set(x, y, z); v.rotation.x = -0.12; v.scale.setScalar(s);
      v.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 16, 64), m.chrome));
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.004, 10, 48), m.alu); ring2.position.z = -0.006; v.add(ring2);
      const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.05, 40, 1, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.8, side: THREE.DoubleSide }));
      throat.position.z = -0.025; v.add(throat);
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.041, 32), m.plastic); bottom.position.z = -0.045; v.add(bottom);
      for (let i = -2; i <= 2; i++) { const vane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.0025, 0.022), m.alu); vane.position.set(0, i * 0.014, -0.014); vane.scale.x = Math.sqrt(1 - (i * 0.014 / 0.042) ** 2); vane.rotation.x = 0.25; v.add(vane); }
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.012, 16).rotateX(Math.PI / 2), m.chrome); knob.position.z = 0.0; v.add(knob);
      g.add(v);
    }
    // a strip of buttons under the centre vent
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.014, 0.01, 2, 0.003), m.plastic);
      b.position.set(-0.02 + i * 0.036, 0.63, -0.598); b.rotation.x = -0.3; g.add(b);
      const ring = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.0015, 0.011), m.alu); ring.position.copy(b.position); ring.position.y -= 0.0075; g.add(ring);
    }
  }

  // --------------------------------------------------------------------------------------- doors, seats, console, glass
  private buildCabin() {
    const m = this.m, g = this.group;
    for (const s of [-1, 1]) {
      const panel = new RoundedBoxGeometry(0.06, 0.48, 1.3, 3, 0.02); panel.translate(s * 0.95, 0.62, -0.3);
      g.add(new THREE.Mesh(panel, m.tan));
      const capG = new RoundedBoxGeometry(0.14, 0.05, 1.38, 3, 0.02); capG.translate(s * 1.0, 0.875, -0.3);
      g.add(new THREE.Mesh(capG, m.paint));
      const strip = new RoundedBoxGeometry(0.012, 0.03, 1.1, 2, 0.004); strip.translate(s * 0.918, 0.76, -0.3);
      g.add(new THREE.Mesh(strip, m.carbon));
      const handle = new RoundedBoxGeometry(0.02, 0.025, 0.14, 2, 0.008); handle.translate(s * 0.912, 0.7, -0.62);
      g.add(new THREE.Mesh(handle, m.chrome));
      const pocket = new RoundedBoxGeometry(0.03, 0.1, 0.5, 2, 0.01); pocket.translate(s * 0.915, 0.45, -0.35);
      g.add(new THREE.Mesh(pocket, m.black));
      // seats: tan, with bolsters
      const sx = s * 0.37;
      const cush = new RoundedBoxGeometry(0.44, 0.1, 0.56, 4, 0.04); cush.translate(sx, 0.3, 0.1); g.add(new THREE.Mesh(cush, m.tan));
      for (const b of [-1, 1]) { const bol = new RoundedBoxGeometry(0.08, 0.11, 0.52, 4, 0.035); bol.translate(sx + b * 0.21, 0.37, 0.1); g.add(new THREE.Mesh(bol, m.tan)); }
      const backG = new RoundedBoxGeometry(0.5, 0.78, 0.13, 4, 0.05); backG.rotateX(-0.22); backG.translate(sx, 0.74, 0.47); g.add(new THREE.Mesh(backG, m.tan));
      const head = new RoundedBoxGeometry(0.3, 0.2, 0.1, 4, 0.04); head.rotateX(-0.22); head.translate(sx, 1.22, 0.58); g.add(new THREE.Mesh(head, m.tan));
      // side mirrors on the doors
      const housing = new RoundedBoxGeometry(0.17, 0.1, 0.09, 3, 0.03); housing.translate(s * 1.1, 0.98, -0.82);
      g.add(new THREE.Mesh(housing, m.paint));
      const glassM = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), m.mirror); glassM.position.set(s * 1.1, 0.98, -0.774); glassM.rotation.y = -s * 0.25; g.add(glassM);
      const arm = new RoundedBoxGeometry(0.1, 0.025, 0.03, 2, 0.01); arm.translate(s * 1.03, 0.93, -0.84); g.add(new THREE.Mesh(arm, m.plastic));
    }
    // console: tan sides, carbon top, an aluminium bridge with the R / AUTO / LC buttons, a can in the cupholder
    const con = new RoundedBoxGeometry(0.25, 0.32, 1.0, 4, 0.03); con.translate(0, 0.26, -0.18); g.add(new THREE.Mesh(con, m.tan));
    const conTop = new RoundedBoxGeometry(0.22, 0.012, 0.92, 2, 0.005); conTop.translate(0, 0.423, -0.18); g.add(new THREE.Mesh(conTop, m.carbon));
    const bridge = new RoundedBoxGeometry(0.085, 0.045, 0.34, 4, 0.02); bridge.translate(0.0, 0.46, -0.42); g.add(new THREE.Mesh(bridge, m.alu));
    const lab = (t: string) => T.label('br' + t, 64, 64, (c) => { c.fillStyle = '#121315'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#e8e8e4'; c.font = '700 22px "Saira Semi Condensed", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 32, 33); });
    ['R', 'AUTO', 'LC'].forEach((t, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.015, 0.008, 24), [m.chrome, new THREE.MeshStandardMaterial({ map: lab(t), roughness: 0.4 }), m.chrome]);
      b.position.set(0, 0.486, -0.52 + i * 0.075); g.add(b);
    });
    const holder = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 10, 32).rotateX(Math.PI / 2), m.plastic); holder.position.set(0.06, 0.43, 0.13); g.add(holder);
    const canTex = T.label('can', 256, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#f4b81f'); gr.addColorStop(0.5, '#ffd94a'); gr.addColorStop(1, '#f19a2a');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#e8467c'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(30 + i * 44, 70 + (i % 2) * 40, 16, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#1d3c8f'; c.font = 'italic 800 46px "Saira Semi Condensed", Arial'; c.textAlign = 'center'; c.fillText('SOL', w / 2, 170);
      c.font = '700 22px "Saira Semi Condensed", Arial'; c.fillText('SPARKLING CITRUS', w / 2, 205);
    });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.122, 32, 1, false), [new THREE.MeshStandardMaterial({ map: canTex, metalness: 0.6, roughness: 0.3 }), m.alu, m.alu]);
    can.position.set(0.06, 0.49, 0.13); can.rotation.y = 2.2; g.add(can);
    // floor, footwell and pedals
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7), m.carpet); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.08, -0.35); g.add(floor);
    const toe = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.4), m.carpet); toe.position.set(0, 0.22, -1.08); toe.rotation.x = -0.75; g.add(toe);
    const pedal = (x: number, y: number, z: number, w: number, h: number) => {
      const p = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.008, 2, 0.003), m.alu); p.position.set(x, y, z); p.rotation.x = -0.75; g.add(p);
      for (let i = 0; i < 3; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.004, 0.003), m.plastic); rib.position.set(x, y - h * 0.25 + i * h * 0.25, z + 0.006); rib.rotation.x = -0.75; g.add(rib); }
    };
    pedal(-0.31, 0.21, -0.86, 0.09, 0.07); pedal(-0.19, 0.19, -0.9, 0.055, 0.13); pedal(-0.53, 0.17, -0.88, 0.07, 0.12);
    // windscreen: frame, glass and the mirror
    // a tall, raked screen: its header sits up out of the driver's view, as in an open-top car
    for (const s of [-1, 1]) g.add(new THREE.Mesh(capsule(v3(s * 0.94, 0.85, -1.17), v3(s * 0.78, 1.52, -0.48), 0.018), m.plastic));
    g.add(new THREE.Mesh(capsule(v3(-0.78, 1.52, -0.48), v3(0.78, 1.52, -0.48), 0.013), m.plastic));
    const ws = new THREE.BufferGeometry();
    const wsP = [-0.92, 0.85, -1.16, 0.92, 0.85, -1.16, 0.77, 1.51, -0.49, -0.77, 1.51, -0.49];
    ws.setAttribute('position', new THREE.Float32BufferAttribute(wsP, 3)); ws.setIndex([0, 1, 2, 0, 2, 3]); ws.computeVertexNormals();
    const wsm = new THREE.Mesh(ws, m.glass); wsm.castShadow = false; wsm.renderOrder = 2; g.add(wsm);
    const rv = new RoundedBoxGeometry(0.2, 0.06, 0.025, 3, 0.012); rv.translate(0.02, 1.44, -0.53); g.add(new THREE.Mesh(rv, m.plastic));
    const rvg = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.047), m.mirror); rvg.position.set(0.02, 1.44, -0.516); rvg.rotation.y = 0.12; g.add(rvg);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05), m.plastic); stem.position.set(0.02, 1.49, -0.5); g.add(stem);
  }

  // --------------------------------------------------------------------------------------- the driver
  private buildDriver() {
    const m = this.m, g = this.group;
    // legs: thighs in black shorts, bare shins, black socks, white sneakers
    const legs = (hip: THREE.Vector3, knee: THREE.Vector3, ankle: THREE.Vector3) => {
      g.add(new THREE.Mesh(capsule(hip, knee, 0.066), m.skin));
      g.add(new THREE.Mesh(capsule(knee, ankle, 0.05), m.skin));
      const mid = hip.clone().lerp(knee, 0.58);
      g.add(new THREE.Mesh(capsule(hip, mid, 0.079), m.shorts));
      const sockTop = ankle.clone().lerp(knee, 0.16);
      g.add(new THREE.Mesh(capsule(ankle, sockTop, 0.043), m.sock));
    };
    const lh = v3(-0.48, 0.4, 0.2), lk = v3(-0.5, 0.505, -0.3), la = v3(-0.53, 0.21, -0.74);
    const rh = v3(-0.26, 0.4, 0.2), rk = v3(-0.235, 0.505, -0.3), ra = v3(-0.215, 0.215, -0.74);
    legs(lh, lk, la); legs(rh, rk, ra);
    const shoe = () => {
      const s = new THREE.Group();
      const upper = new RoundedBoxGeometry(0.1, 0.075, 0.27, 4, 0.03); upper.translate(0, -0.03, -0.08);
      s.add(new THREE.Mesh(upper, m.shoe));
      const sole = new RoundedBoxGeometry(0.108, 0.026, 0.285, 3, 0.01); sole.translate(0, -0.075, -0.08);
      s.add(new THREE.Mesh(sole, m.sole));
      const tongue = new RoundedBoxGeometry(0.06, 0.03, 0.09, 2, 0.01); tongue.translate(0, 0.008, -0.04);
      s.add(new THREE.Mesh(tongue, m.shoe));
      return s;
    };
    const left = shoe(); left.position.copy(la); left.rotation.x = -0.25; g.add(left);
    this.rightFoot.position.copy(ra); this.rightFoot.add(shoe()); g.add(this.rightFoot);
    // hands on the wheel at ten and two; arms solved to reach them
    // a hand gripping the rim. Anchor frame: x along the rim (clockwise), y out from the hub, z toward the driver.
    // From the seat you see the back of the hand and the knuckles; the fingers wrap behind the rim and the thumb
    // curls round the inside.
    const handGeo = (mirror: boolean) => {
      const parts: THREE.BufferGeometry[] = [];
      const ra = 0.025, rb = 0.03;
      const around = (x: number, phi: number, off: number) => v3(x, Math.cos(phi) * (ra + off), Math.sin(phi) * (rb + off));
      const bone = (p: THREE.Vector3, q: THREE.Vector3, r: number) => { parts.push(capsule(p, q, r)); };
      // the back of the hand sits over the front of the rim, slanting from its outer edge toward you
      const fist = new THREE.SphereGeometry(1, 28, 18); fist.scale(0.043, 0.024, 0.033); fist.rotateX(-0.55); fist.translate(-0.003, ra * 0.5 + 0.012, rb * 0.62 + 0.016);
      parts.push(fist);
      const xs = [0.028, 0.0095, -0.0095, -0.027], rs = [0.0102, 0.0106, 0.0101, 0.009];
      xs.forEach((x, i) => {
        const r = rs[i], k = around(x, 0.42, r * 1.25);
        const knuckle = new THREE.SphereGeometry(r * 1.15, 14, 10); knuckle.translate(k.x, k.y, k.z); parts.push(knuckle);
        const m1 = around(x, -0.55, r * 1.02), m2 = around(x, -1.55, r * 0.95), tip = around(x, -2.3, r * 0.88);
        bone(k, m1, r); bone(m1, m2, r * 0.9); bone(m2, tip, r * 0.82);         // wrapped round the back of the rim
      });
      // the thumb lies along the rim's inner face, pointing round toward twelve o'clock
      const t0 = around(0.024, 1.55, 0.013), t1 = around(0.047, 1.85, 0.0115), t2 = around(0.066, 2.0, 0.0098);
      bone(t0, t1, 0.0112); bone(t1, t2, 0.0098);
      const wrist = v3(-0.005, ra * 0.5 + 0.03, rb + 0.058);
      const wg = capsule(v3(-0.004, ra * 0.5 + 0.016, rb + 0.022), wrist, 0.027); parts.push(wg);
      const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => { p.deleteAttribute('uv'); return p; }))!;
      if (mirror) geo.scale(-1, 1, 1);
      geo.computeVertexNormals();
      return { geo, wrist };
    };
    const arm = (deg: number, mirror: boolean, shoulder: THREE.Vector3, pole: THREE.Vector3) => {
      const a = (deg * Math.PI) / 180, p = rimAt(a);
      const anchor = new THREE.Object3D();
      anchor.position.copy(p);
      anchor.rotation.z = a - Math.PI / 2;            // local x along the rim, y outward, z toward the driver
      this.wheelSpin.add(anchor);
      const hg = handGeo(mirror);
      const hand = new THREE.Mesh(hg.geo, this.m.handSkin);
      anchor.add(hand);
      const wrist = new THREE.Object3D(); wrist.position.copy(hg.wrist); if (mirror) wrist.position.x *= -1; anchor.add(wrist);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.043, 1, 14), m.skin);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.052, 1, 14), m.shirt);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 10), m.skin);
      g.add(fore, upper, elbow);
      this.hands.push({ anchor, wrist, shoulder, pole, fore, upper, elbow });
    };
    arm(148, false, v3(-0.6, 0.88, 0.24), v3(-0.45, -1, -0.15));
    arm(32, true, v3(-0.14, 0.88, 0.24), v3(0.45, -1, -0.15));
    // torso and head, for the chase camera
    const d = this.driverBody;
    d.add(new THREE.Mesh(capsule(v3(-0.37, 0.48, 0.42), v3(-0.37, 0.88, 0.34), 0.17), m.shirt));
    d.add(new THREE.Mesh(capsule(v3(-0.37, 0.95, 0.3), v3(-0.37, 1.04, 0.27), 0.05), m.skin));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), m.skin); head.position.set(-0.37, 1.13, 0.24); head.scale.set(0.92, 1.06, 1); d.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), m.hair); hair.position.set(-0.37, 1.15, 0.255); d.add(hair);
    const shades = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.035, 0.03, 2, 0.01), m.tint); shades.position.set(-0.37, 1.14, 0.145); d.add(shades);
    g.add(d);
  }

  setDriverVisible(v: boolean) { this.driverBody.visible = v; }

  // --------------------------------------------------------------------------------------- per frame
  update(dt: number, s: { delta: number; rpm: number; gear: number; auto: boolean; limiter: boolean; speed: number; throttle: number; brake: number; distance: number; mode: string; time: string }, now: number) {
    // the wheel: steering ratio, clamped so the hands stay on it
    const target = clamp(s.delta * SPEC.steerRatio, -2.2, 2.2);
    this.wheelAngle = damp(this.wheelAngle, target, 30, dt);
    this.wheelSpin.rotation.z = this.wheelAngle;
    // tach needle and shift lights
    this.needle.rotation.z = rpmAngle(s.rpm) - Math.PI / 2;
    const flash = s.limiter && Math.floor(now * 12) % 2 === 0;
    this.leds.forEach((mat, i) => {
      const on = s.rpm > 6200 + i * 190;
      mat.emissiveIntensity = flash ? 4 : on ? 3.2 : 0.05;
    });
    // paddles flick when you shift
    this.paddles.forEach((p, i) => { this.paddleT[i] = Math.max(0, this.paddleT[i] - dt * 6); p.position.z = -0.045 - this.paddleT[i] * 0.012; });
    // right foot: on the throttle, or across to the brake
    this.footBrake = damp(this.footBrake, s.brake > s.throttle && s.brake > 0.05 ? 1 : 0, 14, dt);
    this.rightFoot.position.x = -0.215 - this.footBrake * 0.1;
    this.rightFoot.position.y = 0.215 + this.footBrake * 0.02;
    this.rightFoot.rotation.x = -0.32 - (this.footBrake > 0.5 ? s.brake : s.throttle) * 0.22;
    this.instruments.update(dt, { speed: s.speed, rpm: s.rpm, gear: s.gear, auto: s.auto, limiter: s.limiter, distance: s.distance, throttle: s.throttle, mode: s.mode, time: s.time } as Readout);
    this.solveArms();
  }

  flickPaddle(dir: 1 | -1) { this.paddleT[dir > 0 ? 1 : 0] = 1; }

  // two-bone IK from the shoulder to the wrist on the wheel
  private tmpA = new THREE.Vector3(); private tmpB = new THREE.Vector3();
  private solveArms() {
    this.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const L1 = 0.32, L2 = 0.31;
    for (const h of this.hands) {
      const wrist = h.wrist.getWorldPosition(this.tmpA).applyMatrix4(inv);
      const S = h.shoulder;
      const toW = this.tmpB.copy(wrist).sub(S);
      const d = Math.min(toW.length(), L1 + L2 - 0.001);
      const dir = toW.normalize();
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const pole = h.pole.clone().sub(dir.clone().multiplyScalar(h.pole.dot(dir))).normalize();
      const elbow = S.clone().addScaledVector(dir, a).addScaledVector(pole, hh);
      const wristPt = S.clone().addScaledVector(dir, d);
      place(h.fore, elbow, wristPt); place(h.upper, S, elbow);
      h.elbow.position.copy(elbow);
    }
  }

  setScreensBright(k: number) { for (const f of this.faceMats) f.color.setScalar(0.75 + 0.25 * k); }
}

function place(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = b.clone().sub(a), len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, len, 1);
}
