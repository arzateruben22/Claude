// beacon.js — a light seen from far away (films/channels/space/set): a camera-facing glow of constant
// pixel size, for a star or a probe at any rung of the scale ladder (a star.js sphere would shrink to
// nothing in a light-year view, or fill the frame up close). New in episode 2.
//
//   const b = createBeacon({ color: [r, g, b] (linear; > 1 glows: the finish blooms it), px: 26, core: 0.18 });
//   group.add(b.mesh);
//   b.set({ center: [x, y, z] (its group's units), camera, px, intensity, opacity });   // after the camera and the ladder are placed
//
// The size is set each seek from the mesh's world distance to the camera and the parent's world scale, so a
// beacon inside a ladder rung keeps its pixels while the rung shrinks around it. The mesh is a real, drawn
// mesh at the beacon's position, so the finish's motion probe sees it move.
import * as THREE from "three";

const FS = /* glsl */ `
  uniform vec3 uCol; uniform float uI, uCore, uOpacity; varying vec2 vUv;
  void main(){
    vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
    float core = 1.0 - smoothstep(uCore * 0.6, uCore, r);
    float halo = exp(-r * r * 7.0) * 0.55 + pow(1.0 - r, 3.0) * 0.25;
    float a = clamp(core + halo, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(uCol * uI * (core * 1.0 + halo) * uOpacity, a);
  }`;
const _w = new THREE.Vector3(), _s = new THREE.Vector3();

export const createBeacon = (o = {}) => {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(...(o.color || [1, 1, 1])) }, uI: { value: o.intensity ?? 1 }, uCore: { value: o.core ?? 0.18 }, uOpacity: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  let px = o.px ?? 24;
  return {
    mesh, material: mat,
    set({ center, camera, px: p, intensity, opacity } = {}) {
      if (center) mesh.position.fromArray(center);
      if (p != null) px = p;
      if (intensity != null) mat.uniforms.uI.value = intensity;
      if (opacity != null) mat.uniforms.uOpacity.value = opacity;
      mesh.visible = mat.uniforms.uOpacity.value > 1e-4;
      if (camera) {
        mesh.quaternion.copy(camera.quaternion);
        if (mesh.parent) { mesh.parent.updateMatrixWorld(); mesh.parent.getWorldQuaternion(mesh.quaternion).invert().multiply(camera.quaternion); }
        mesh.updateMatrixWorld();
        mesh.getWorldPosition(_w);
        const d = _w.distanceTo(camera.position), H = window.H;
        const half = (px / 2) * (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / H;   // world units for px/2 pixels
        const ps = mesh.parent ? mesh.parent.getWorldScale(_s).x : 1;
        mesh.scale.setScalar(half / (ps || 1));
      }
      return this;
    },
  };
};
