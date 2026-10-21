// The other drivers' cars: one instanced coupe per peer, drawn from the poses the live client holds. They are
// ghosts: no collision, no sound, no scoring. Paint comes from each driver's own car colour.

import * as THREE from 'three';
import { ORIGIN } from '../world/Path';
import type { CarClass } from '../traffic/carModels';
import * as M from '../../preview/car-mats';
import type { LiveClient, Pose } from '../../live/client';

const X_AXIS = new THREE.Vector3(1, 0, 0);

export class LiveCars {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh; private glass: THREE.InstancedMesh; private trim: THREE.InstancedMesh | null; private wheels: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4(); private w4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private wq = new THREE.Quaternion();
  private e = new THREE.Euler(); private p3 = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private ws = new THREE.Vector3(); private wv = new THREE.Vector3();
  private color = new THREE.Color();
  private pose: Pose = { x: 0, y: 0, z: 0, h: 0, v: 0, b: false };
  private spins = new Map<number, number>();
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
    this.group.name = 'live';
  }

  render(client: LiveClient | null, now: number, dt: number) {
    let i = 0;
    if (client) {
      for (const p of client.peers.values()) {
        if (i >= this.capacity) break;
        const pose = client.poseOf(p, now, this.pose);
        if (!pose) continue;
        this.e.set(0, pose.h + Math.PI, 0);
        this.q.setFromEuler(this.e);
        this.p3.set(pose.x - ORIGIN.x, pose.y, pose.z - ORIGIN.z);
        this.m4.compose(this.p3, this.q, this.one);
        this.body.setMatrixAt(i, this.m4); this.glass.setMatrixAt(i, this.m4); this.trim?.setMatrixAt(i, this.m4);
        this.body.setColorAt(i, this.color.setHex(p.paint));
        const spin = (this.spins.get(p.id) ?? 0) + (pose.v / this.cls.wheelR) * dt;
        this.spins.set(p.id, spin % (Math.PI * 2));
        this.cls.wheels.forEach(([x, y, z], w) => {
          this.wq.setFromAxisAngle(X_AXIS, -spin);
          this.w4.compose(this.wv.set(x, y, z), this.wq, this.ws.set(1, this.cls.wheelR, this.cls.wheelR));
          this.wheels.setMatrixAt(i * this.cls.wheels.length + w, this.w4.premultiply(this.m4));
        });
        i++;
      }
      for (const id of this.spins.keys()) if (!client.peers.has(id)) this.spins.delete(id);
    }
    this.count = i;
    this.body.count = this.glass.count = i; if (this.trim) this.trim.count = i;
    this.wheels.count = i * this.cls.wheels.length;
    for (const im of [this.body, this.glass, this.trim, this.wheels]) if (im) im.instanceMatrix.needsUpdate = true;
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
  }
}
