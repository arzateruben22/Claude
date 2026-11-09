// The OC Hypercar's LED wake-up (Founder Edition, PROJECT_OC_HYPERCAR.md section 7): its lights come on in a sweep,
// front to back. The ice-blue strips along the splitter light from the centre out, the headlamp blades from the inner
// end to the outer, the sills front to back, then the diffuser and the wing plates, and last the red tail bar from the
// centre out. Each lit point comes on with a short flash as the front passes it, then holds.
//
// One uniform drives every material that takes part (WAKE, shared): its value is the sweep's progress, 0 dark and 1.1
// all lit (anything over that is steady, so the materials are as they always were). Each material gets a phase per
// point from its position in the car's frame, so nothing is added to the geometry and it costs one multiply-add a
// pixel on a few small meshes. Whoever renders a hypercar sets WAKE.value just before (the player's car in
// PlayerCar.update, the garage's reveal stage round its own render).
import * as THREE from 'three';
import { patch } from './car-kit';

export const WAKE = { value: 9 };
export const WAKE_SECONDS = 1.2;               // the whole sweep, first light to the red bar's ends
export const WAKE_DONE = 1.1;                  // the progress at which every point is steady
// progress for a time into the sweep (seconds; below 0 the lights are still off)
export const wakeAt = (t: number) => (t >= WAKE_SECONDS ? 9 : Math.max(0, t / WAKE_SECONDS) * WAKE_DONE);

// A point's phase (0..1): when the sweep reaches it. zn runs 0 at the nose to 1 at the tail, xn 0 on the centreline to
// 1 at the car's sides. 'ice': the LED strips and the headlamp blades; 'bar': the red bar, after everything else.
const PHASE = { ice: [0, 0.6, 0.3], bar: [0.82, 0, 0.18] } as const;
const done = new WeakSet<THREE.Material>();
export function wakeable(m: THREE.Material, kind: keyof typeof PHASE, ZF: number, ZR: number) {
  if (done.has(m)) return m;
  done.add(m);
  const [k0, kz, kx] = PHASE[kind], f = (v: number) => v.toFixed(4);
  return patch(m, 'wake-' + kind, (sh) => {
    sh.uniforms.uWake = WAKE;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWakeP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWakeP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWake;\nvarying vec3 vWakeP;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uWake < ${f(WAKE_DONE + 0.5)}) {
          float ph = ${f(k0)} + ${f(kz)} * clamp((vWakeP.z - (${f(ZF)})) / ${f(ZR - ZF)}, 0.0, 1.0) + ${f(kx)} * clamp(abs(vWakeP.x) / 1.05, 0.0, 1.0);
          float d = uWake - ph;
          float e = (d - 0.035) / 0.035, flash = exp(-e * e);
          totalEmissiveRadiance *= smoothstep(0.0, 0.07, d) + 1.6 * flash;
        }`);
  });
}
