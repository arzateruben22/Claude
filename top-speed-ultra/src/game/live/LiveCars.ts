// The other drivers' cars: one instanced coupe per peer, drawn from the poses the live client holds. They are
// ghosts: no collision, no sound, no scoring. Paint comes from each driver's own car colour. Each carries its
// driver's name on a plate above the roof, readable to about 350 m and gone by 500 m.

import * as THREE from 'three';
import { ORIGIN } from '../world/Path';
import type { CarClass } from '../traffic/carModels';
import * as M from '../../preview/car-mats';
import type { LiveClient, Pose } from '../../live/client';

const X_AXIS = new THREE.Vector3(1, 0, 0);

export class LiveCars {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh; private glass: THREE.InstancedMesh; private trim: THREE.InstancedMesh | null; private wheels: THREE.InstancedMesh;
  private head: THREE.InstancedMesh; private tail: THREE.InstancedMesh;       // the lamps, as the traffic's: tails brighten on the brake
  private m4 = new THREE.Matrix4(); private w4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private wq = new THREE.Quaternion();
  private e = new THREE.Euler(); private p3 = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private ws = new THREE.Vector3(); private wv = new THREE.Vector3();
  private color = new THREE.Color();
  private pose: Pose = { x: 0, y: 0, z: 0, h: 0, v: 0, b: false };
  private spins = new Map<number, number>();
  private born = new Map<number, number>();      // when each ghost appeared, for its 0.6 s grow-in
  private sc = new THREE.Vector3();
  private plates = new Map<number, { sprite: THREE.Sprite; name: string }>();
  private eye = new THREE.Vector3();
  count = 0;                                  // peers drawn in the last frame (for tests)

  constructor(private cls: CarClass, wheel: THREE.BufferGeometry, readonly capacity = 64) {
    const bodyM = M.paint(0xffffff, 'phone', [], { key: 'live', flake: 0.2 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0c1016, metalness: 0.85, roughness: 0.06, envMapIntensity: 1.4 });
    const trimM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
    const wheelM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number) => {
      const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(im); return im;
    };
    this.body = mk(cls.body, bodyM, capacity); this.body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.glass = mk(cls.glass, glassM, capacity);
    this.trim = cls.trim ? mk(cls.trim, trimM, capacity) : null;
    this.wheels = mk(wheel, wheelM, capacity * cls.wheels.length);
    const lightM = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.head = mk(cls.head, lightM, capacity); this.head.castShadow = false;
    this.tail = mk(cls.tail, lightM, capacity); this.tail.castShadow = false;
    this.tail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.group.name = 'live';
  }

  // camera: where the viewer is, for the plates' fade (in the scene's frame)
  render(client: LiveClient | null, now: number, dt: number, camera?: THREE.Camera) {
    let i = 0;
    if (camera) camera.getWorldPosition(this.eye);
    const seen = new Set<number>();
    if (client) {
      for (const p of client.peers.values()) {
        if (i >= this.capacity) break;
        const pose = client.poseOf(p, now, this.pose);
        if (!pose) continue;
        this.e.set(0, pose.h + Math.PI, 0);
        this.q.setFromEuler(this.e);
        this.p3.set(pose.x - ORIGIN.x, pose.y, pose.z - ORIGIN.z);
        // a ghost that just appeared (a driver joining or jumping next to you) grows in rather than popping
        if (!this.born.has(p.id)) this.born.set(p.id, now);
        const g = Math.min(1, (now - this.born.get(p.id)!) / 600), e = g * g * (3 - 2 * g);
        this.m4.compose(this.p3, this.q, e >= 1 ? this.one : this.sc.set(e, e, e));
        this.body.setMatrixAt(i, this.m4); this.glass.setMatrixAt(i, this.m4); this.trim?.setMatrixAt(i, this.m4);
        this.head.setMatrixAt(i, this.m4); this.tail.setMatrixAt(i, this.m4);
        const brake = pose.b ? 3.2 : 1;
        this.tail.instanceColor!.setXYZ(i, brake, brake, brake);
        this.body.setColorAt(i, this.color.setHex(p.paint));
        const spin = (this.spins.get(p.id) ?? 0) + (pose.v / this.cls.wheelR) * dt;
        this.spins.set(p.id, spin % (Math.PI * 2));
        this.cls.wheels.forEach(([x, y, z], w) => {
          this.wq.setFromAxisAngle(X_AXIS, -spin);
          this.w4.compose(this.wv.set(x, y, z), this.wq, this.ws.set(1, this.cls.wheelR, this.cls.wheelR));
          this.wheels.setMatrixAt(i * this.cls.wheels.length + w, this.w4.premultiply(this.m4));
        });
        this.plate(p.id, p.name, this.p3, camera ? this.p3.distanceTo(this.eye) : 0);
        seen.add(p.id);
        i++;
      }
      for (const id of this.spins.keys()) if (!client.peers.has(id)) this.spins.delete(id);
      for (const id of this.born.keys()) if (!seen.has(id)) this.born.delete(id);
    }
    for (const [id, pl] of this.plates) {
      if (seen.has(id)) continue;
      if (client?.peers.has(id)) { pl.sprite.visible = false; continue; }     // out of range for now
      this.group.remove(pl.sprite); pl.sprite.material.map?.dispose(); pl.sprite.material.dispose(); this.plates.delete(id);
    }
    this.count = i;
    this.body.count = this.glass.count = this.head.count = this.tail.count = i; if (this.trim) this.trim.count = i;
    this.wheels.count = i * this.cls.wheels.length;
    for (const im of [this.body, this.glass, this.trim, this.wheels, this.head, this.tail]) if (im) im.instanceMatrix.needsUpdate = true;
    if (this.tail.instanceColor) this.tail.instanceColor.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }

  // a name plate: a sprite with the name on a dark pill, made once per driver
  private plate(id: number, name: string, at: THREE.Vector3, dist: number) {
    let pl = this.plates.get(id);
    if (!pl || pl.name !== name) {
      if (pl) { this.group.remove(pl.sprite); pl.sprite.material.map?.dispose(); pl.sprite.material.dispose(); }
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const g = cv.getContext('2d')!;
      const label = name || 'Driver';
      g.font = '600 34px "Chakra Petch", Arial, sans-serif';
      const w = Math.min(244, g.measureText(label).width + 36);
      g.fillStyle = 'rgba(10, 10, 14, 0.72)'; g.beginPath(); g.roundRect((256 - w) / 2, 8, w, 48, 24); g.fill();
      // the dot in the live colour (the theme's --good: the live chip, the corner map and the World Map use it too)
      g.fillStyle = (typeof document !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--good').trim()) || '#6ff7de';
      g.beginPath(); g.arc((256 - w) / 2 + 20, 32, 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f1ea'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 128 + 8, 33, 200);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      sprite.scale.set(3.2, 0.8, 1); sprite.renderOrder = 10;
      this.group.add(sprite);
      pl = { sprite, name }; this.plates.set(id, pl);
    }
    pl.sprite.position.set(at.x, at.y + 2.15, at.z);
    // a plate grows a little with distance so it stays readable, and fades out from 350 to 500 m
    const k = Math.max(1, dist / 60);
    pl.sprite.scale.set(3.2 * Math.min(k, 3), 0.8 * Math.min(k, 3), 1);
    const a = dist <= 350 ? 1 : Math.max(0, 1 - (dist - 350) / 150);
    pl.sprite.material.opacity = a;
    pl.sprite.visible = a > 0.01;
  }
  get plateCount() { let n = 0; for (const p of this.plates.values()) if (p.sprite.visible) n++; return n; }
}
