// The three.js skeleton for a rig: one Bone per joint, in the rest pose, with identity rotations (so animation
// rotations are about the body's own axes in the rest pose).
import * as THREE from 'three';
import { Rig, BONES, PARENT } from './body';

export function makeSkeleton(rig: Rig) {
  const bones: THREE.Bone[] = BONES.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach((_, i) => {
    const p = PARENT[i], J = rig.joints[i];
    if (p < 0) bones[i].position.set(J[0], J[1], J[2]);
    else { const P = rig.joints[p]; bones[i].position.set(J[0] - P[0], J[1] - P[1], J[2] - P[2]); bones[p].add(bones[i]); }
  });
  const rest = bones.map((b) => b.position.clone());
  return { bones, root: bones[0], skeleton: new THREE.Skeleton(bones), rest };
}
