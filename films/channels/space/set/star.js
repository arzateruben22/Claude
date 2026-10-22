// star.js — B3, a star (films/channels/space/set): emissive, limb-darkened, granulated, with a corona.
// The Sun renders white, bright enough that the finish blooms it (threshold 0.9). Granulation drifts
// with scene time τ; nothing flickers. Vanishing is a one-frame pop: set({ on: false }), never a flash
// (photosensitivity: the bible's ramps are for brightening, a disappearance is a single step down).
//
//   const sun = createStar({ radius: 1.4, intensity: 2.4, corona: 2.6 });
//   group.add(sun.group);
//   sun.set({ tau, on: tau < 0, center: [0, 0, 0] });
import * as THREE from "three";

const VS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FS = /* glsl */ `
  uniform vec3 uCol; uniform float uI, uTau, uLimb, uGran;
  varying vec3 vN; varying vec3 vV; varying vec3 vP;
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  void main(){
    float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float limb = 1.0 - uLimb * (1.0 - pow(mu, 0.6));
    vec3 d = normalize(vP);
    float g = vn(d * 22.0 + vec3(0.0, uTau * 0.0004, 0.0)) * 0.6 + vn(d * 47.0 - vec3(uTau * 0.0003)) * 0.4;
    float gran = 1.0 - uGran * (g - 0.5);
    gl_FragColor = vec4(uCol * uI * limb * gran, 1.0);
  }`;
const CORONA_FS = /* glsl */ `
  uniform vec3 uCol; uniform float uI; varying vec2 vUv;
  void main(){ vec2 q = vUv * 2.0 - 1.0; float r = length(q); if (r > 1.0) discard;
    float a = pow(max(0.0, 1.0 - r), 2.4) * uI; gl_FragColor = vec4(uCol * a, a); }`;

export const createStar = (o = {}) => {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(...(o.color || [1, 0.985, 0.96])) }, uI: { value: o.intensity ?? 2.4 }, uTau: { value: 0 },
      uLimb: { value: o.limb ?? 0.42 }, uGran: { value: o.granulation ?? 0.12 } },
    vertexShader: VS, fragmentShader: FS,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), mat);
  body.scale.setScalar(o.radius ?? 1);
  group.add(body);
  // the corona: a camera-facing disc (a quad turned to the camera each frame), additive, drawn behind the body
  const cMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Vector3(0.82, 0.9, 1.0) }, uI: { value: o.coronaI ?? 0.55 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: CORONA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cMat);
  corona.scale.setScalar((o.radius ?? 1) * (o.corona ?? 2.6));
  corona.userData.noProbe = true;
  group.add(corona);
  return {
    group, body, corona,
    set({ tau = 0, on = true, center, camera, intensity } = {}) {
      group.visible = !!on;
      if (center) group.position.fromArray(center);
      mat.uniforms.uTau.value = tau;
      if (intensity != null) mat.uniforms.uI.value = intensity;
      if (camera) corona.quaternion.copy(camera.quaternion);
    },
  };
};
