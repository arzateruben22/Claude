// What's drawn inside, outside and overhead, and what casts (PROJECT_OC_SPORTS_BAR.md, "Inside, outside and overhead"
// and "Shadows in three.js 0.160.1"; the module map's visibility.ts row). S1 writes the cars and streets rules and the
// shadow mechanics; S3a adds the people.
//   The state:  inside (first or third person, the camera inside the unit and under the ceiling), outside (first or
//               third person anywhere else; the patio counts as outside) or overhead. It changes on the frame the
//               camera crosses a door's line.
//   By state:   parked.near and your car or its stand-in, from def.budgets (never Lot 57's own counts), and Ultra's
//               pool spots updating (inside and overhead) or frozen (outside). The street sets and the trees don't
//               change with the state: both sets and all ten trees are drawn in every state.
//   Casting:    the same casters in the sun's map in every state (the venue's casting batches, both street sets, the
//               trees, the parked cars and your car as drawn, your avatar's LOD 1 body), set after applyQuality, every
//               caster carrying userData.maps (1 the sun, 2 and 4 the two pool spots) and one shared pair of
//               onBeforeShadow / onAfterShadow hooks that make it an empty call in a map it isn't a member of.
//   Hidden casters: a body that casts but isn't seen keeps visible, castShadow and layer 0, and a pair of
//               onBeforeRender / onAfterRender hooks sets its draw count to 0 in every colour pass (an empty call).
import * as THREE from 'three';
import type { ParkedCars } from '../../engine/lot';
import type { VisState, VenueDef } from '../../engine/venue-def';
import type { Frame } from '../../engine/frame';
import type { Quality } from '../../engine/mats';
import type { BarView } from './views';

/** make a mesh a hidden caster (drawn into the shadow maps, an empty call in every colour pass), or undo it */
export function setHiddenCaster(m: THREE.Mesh, on: boolean) {
  if (!!m.userData.hiddenCaster === on) return;
  m.userData.hiddenCaster = on;
  if (on) {
    m.onBeforeRender = (_r, _s, _c, g) => { m.userData.savedCount = g.drawRange.count; g.drawRange.count = 0; };
    m.onAfterRender = (_r, _s, _c, g) => { g.drawRange.count = m.userData.savedCount; };
  } else { m.onBeforeRender = THREE.Object3D.prototype.onBeforeRender; m.onAfterRender = THREE.Object3D.prototype.onAfterRender; }
}

export class Visibility {
  state: VisState = 'outside';
  yours: 'detailed' | 'standin' = 'detailed';
  /** the shadow cameras by bit: 1 the sun, 2 and 4 the pool spots */
  private bits = new Map<THREE.Camera, number>();
  private savedCount = new WeakMap<THREE.BufferGeometry, number>();
  // three.js 0.160.1 calls these as (renderer, object, camera, shadowCamera, geometry, depthMaterial, group)
  // (WebGLShadowMap.js renderObject; the shipped type declarations list one argument fewer), so they're typed here
  // by what the runtime passes and cast where they're set
  private readonly beforeFn = (_r: unknown, o: THREE.Object3D, _c: unknown, sc: THREE.Camera, g: THREE.BufferGeometry) => {
    const bit = this.bits.get(sc) ?? 1;
    if (((o.userData.maps ?? 1) & bit) === 0) { this.savedCount.set(g, g.drawRange.count); g.drawRange.count = 0; }
  };
  private readonly afterFn = (_r: unknown, _o: unknown, _c: unknown, _sc: unknown, g: THREE.BufferGeometry) => {
    const n = this.savedCount.get(g); if (n !== undefined) { g.drawRange.count = n; this.savedCount.delete(g); }
  };
  readonly before = this.beforeFn as unknown as THREE.Object3D['onBeforeShadow'];
  readonly after = this.afterFn as unknown as THREE.Object3D['onAfterShadow'];
  constructor(private o: {
    def: VenueDef; frame: Frame;
    parked: () => ParkedCars;
    yourCar: () => THREE.Object3D; standin: THREE.Mesh;
    roots: () => THREE.Object3D[];                  // everything that may cast: the world, the streets, the trees, the cars
    pool: { meshes: THREE.Mesh[]; light: THREE.SpotLight | null }[];
    sun: THREE.DirectionalLight;
  }) {}
  /** the state from the camera and the view */
  stateFor(cam: THREE.Camera, view: BarView): VisState {
    if (view === 'overhead') return 'overhead';
    const [u, v] = this.o.frame.toFrame(cam.position.x, cam.position.z);
    return this.o.def.indoor(u, v) && cam.position.y < (this.o.def.ceilingM ?? 3.6) ? 'inside' : 'outside';
  }
  /** once a frame, after the camera moves: returns true when the state changed */
  update(cam: THREE.Camera, view: BarView, q: Quality, near: { x: number; z: number }, force = false) {
    const s = this.stateFor(cam, view);
    if (s === this.state && !force) return false;
    this.state = s;
    const b = this.o.def.budgets[q].cars[s];
    const parked = this.o.parked();
    parked.near = b.near; parked.update(near.x, near.z, true);
    this.yours = b.yours;
    this.o.yourCar().visible = b.yours === 'detailed'; this.o.standin.visible = b.yours === 'standin';
    // Ultra's pool spots: updating inside and overhead, frozen outside (the room is seen only through glass). A spot
    // frozen before its map was ever drawn (an Ultra page that opens outside, or a switch to Ultra made outside) is
    // drawn once on the next frame, so the glass never shows a map that was never rendered
    for (const p of this.o.pool) {
      if (!p.light) continue;
      const sh = p.light.shadow;
      sh.autoUpdate = s !== 'outside';
      if (!sh.autoUpdate && sh.map === null) sh.needsUpdate = true;
    }
    return true;
  }
  /** after applyQuality (and whenever a caster's level changes): who casts, into which maps */
  applyCasting(q: Quality, extra: { mesh: THREE.Mesh; maps: number }[] = []) {
    const sun = q !== 'low';
    this.bits.clear(); this.bits.set(this.o.sun.shadow.camera, 1);
    this.o.pool.forEach((p, i) => { if (p.light) this.bits.set(p.light.shadow.camera, 2 << i); });
    const poolBits = new Map<THREE.Object3D, number>();
    this.o.pool.forEach((p, i) => { for (const m of p.meshes) poolBits.set(m, 1 | (2 << i)); });
    for (const r of this.o.roots()) r.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.userData.cast === undefined) m.userData.cast = m.castShadow;
      m.castShadow = sun && !!m.userData.cast;
      m.userData.maps = poolBits.get(m) ?? 1;
      if (m.castShadow && m.onBeforeShadow !== this.before) { m.onBeforeShadow = this.before; m.onAfterShadow = this.after; }
    });
    for (const e of extra) { e.mesh.castShadow = sun; e.mesh.userData.maps = e.maps; e.mesh.onBeforeShadow = this.before; e.mesh.onAfterShadow = this.after; }
  }
  /** each map's members, for vis(): a mesh by its name, but your car, its stand-in and your avatar by their group
   *  (one entry each, whatever meshes they're built of) */
  members(roots: THREE.Object3D[]) {
    const out: Record<string, string[]> = { sun: [], 'pool-1': [], 'pool-2': [] };
    const whole = new Set(['your-car', 'your-car-standin', 'avatar']);
    for (const r of roots) r.traverse((obj) => {
      const m = obj as THREE.Mesh; if (!m.isMesh || !m.castShadow) return;
      let hidden = false, grp = '';
      for (let p: THREE.Object3D | null = m; p; p = p.parent) { if (!p.visible) hidden = true; if (!grp && whole.has(p.userData.group)) grp = p.userData.group; }
      if (hidden) return;
      const bits = m.userData.maps ?? 1, n = grp || m.name || m.parent?.name || m.type;
      for (const [bit, k] of [[1, 'sun'], [2, 'pool-1'], [4, 'pool-2']] as [number, string][]) if (bits & bit && !(grp && out[k].includes(n))) out[k].push(n);
    });
    return out;
  }
}
