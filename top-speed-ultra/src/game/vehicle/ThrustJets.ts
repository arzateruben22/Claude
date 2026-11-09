// Cold Thrust's jets: white condensation with an ice-blue tint, streaming back from the two nozzles in the hypercar's
// diffuser. A fixed pool of camera-facing sprites (about 24 a nozzle on the desktop build, 12 on the phone build), all
// in one instanced draw call, each stretched along the jet and fading over 0.4 s. Positions are kept in world
// coordinates (so the plume stays where the gas went as the car drives on, and survives the origin's rebase) and
// written relative to ORIGIN every frame. No allocation per frame.
//
// One blend for two looks: premultiplied "over" for the white plume (scattering, lit by the sky: bright by day, dim
// at night) plus an additive ice-blue core near the nozzle (the car's LEDs lighting the gas), which is what reads at
// night.
//
// Near the car the gas is a short cone on each nozzle (jetCone(), parented to the car's nozzle markers so it follows
// the body), with scrolling noise: the sprites trail away behind the car at its speed, so in the chase view it is the
// cones that show the jet. Both cones share one geometry and one material, hidden (no draw) unless gas is flowing.

import * as THREE from 'three';
import { ORIGIN } from '../world/Path';

const LIFE = 0.4;          // s
const JET = 34;            // m/s: the gas leaves the nozzle this fast, relative to the car
const DRAG = 7;            // 1/s: the gas slows to the still air

const VERT = /* glsl */`
attribute vec3 aPos;
attribute vec3 aDir;
attribute vec3 aP;          // age 0..1, size (m), stretch (m)
varying vec2 vUv;
varying float vAge;
void main() {
  vUv = uv; vAge = aP.x;
  vec4 mv = viewMatrix * vec4(aPos, 1.0);
  vec3 dv = (viewMatrix * vec4(aDir, 0.0)).xyz;
  vec2 d2 = length(dv.xy) > 1e-4 ? normalize(dv.xy) : vec2(0.0, 1.0);
  vec2 n2 = vec2(-d2.y, d2.x);
  float along = aP.y + aP.z * length(dv.xy);
  mv.xy += n2 * position.x * aP.y + d2 * position.y * along;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform float uLight;
uniform float uGlow;
varying vec2 vUv;
varying float vAge;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float soft = smoothstep(1.0, 0.15, r);
  float fade = pow(1.0 - vAge, 1.6);
  float a = soft * fade * 0.7;
  vec3 tint = mix(vec3(0.80, 0.91, 1.0), vec3(1.0), smoothstep(0.0, 0.7, vAge));
  vec3 glow = vec3(0.42, 0.74, 1.0) * pow(1.0 - vAge, 3.0) * soft * uGlow;
  gl_FragColor = vec4(tint * uLight * a + glow, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;


// ------------------------------------------------------------------------------------------- the nozzle cones
// in the nozzle's own frame the jet runs along +z (the body's rear); 1.8 m long, from the nozzle's 3.5 cm to 30 cm
const CONE_LEN = 1.8;
const CONE_VERT = /* glsl */`
uniform float uFlow;
varying float vAlong;
varying vec2 vUv;
varying float vFace;
void main() {
  vUv = uv; vAlong = position.z / ${CONE_LEN.toFixed(2)};
  vec3 p = position;
  p.z *= 0.35 + 0.65 * uFlow;                // the jet lengthens as the valve opens
  p.xy *= 0.6 + 0.4 * uFlow;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFace = abs(dot(n, normalize(-mv.xyz)));   // seen face-on (the cone's middle) the gas is thicker than at its rim
  gl_Position = projectionMatrix * mv;
}`;
const CONE_FRAG = /* glsl */`
uniform float uFlow;
uniform float uTime;
uniform float uLight;
uniform float uGlow;
varying float vAlong;
varying vec2 vUv;
varying float vFace;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float a = vAlong;
  // turbulence scrolling down the jet, wrapped round the cone (uv.x runs 0..1 round it)
  float n = noise(vec2(vUv.x * 9.0, a * 5.0 - uTime * 14.0)) * 0.6 + noise(vec2(vUv.x * 17.0 + 3.1, a * 11.0 - uTime * 23.0)) * 0.4;
  float body = smoothstep(0.0, 0.06, a) * pow(1.0 - a, 1.4);
  // soft at the rim (seen edge-on), dense through the middle: a plume, not a shell
  float alpha = clamp(uFlow * body * smoothstep(0.05, 0.75, vFace) * (0.55 + 0.75 * n) * 0.8, 0.0, 1.0);
  vec3 tint = mix(vec3(0.78, 0.9, 1.0), vec3(1.0), smoothstep(0.1, 0.8, a));
  vec3 glow = vec3(0.42, 0.74, 1.0) * pow(1.0 - a, 3.0) * uFlow * uGlow * (0.6 + 0.4 * n);
  gl_FragColor = vec4(tint * uLight * alpha + glow, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
let coneGeo: THREE.BufferGeometry | null = null, coneMat: THREE.ShaderMaterial | null = null;
function coneMaterial() {
  coneMat ??= new THREE.ShaderMaterial({
    vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
    uniforms: { uFlow: { value: 0 }, uTime: { value: 0 }, uLight: { value: 1 }, uGlow: { value: 0.2 } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false, visible: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  return coneMat;
}
// one nozzle's cone, to parent to its marker on the car's body (the material is shared and driven by ThrustJets)
export function jetCone(): THREE.Mesh {
  if (!coneGeo) {
    // narrow at the nozzle (y = 0 before the turn), wide at the tail; open-ended, 12 sides, 6 rings
    coneGeo = new THREE.CylinderGeometry(0.3, 0.035, CONE_LEN, 12, 6, true);
    coneGeo.translate(0, CONE_LEN / 2, 0).rotateX(Math.PI / 2);
  }
  const m = new THREE.Mesh(coneGeo, coneMaterial());
  m.name = 'thrust-cone'; m.renderOrder = 5; m.frustumCulled = false;
  return m;
}

export class ThrustJets {
  readonly mesh: THREE.Mesh;
  private n: number;               // particles in use (both nozzles): the build's share of the pool
  private max: number;             // the pool, allocated once
  private pos: Float32Array; private dir: Float32Array; private par: Float32Array;
  private aPos: THREE.InstancedBufferAttribute; private aDir: THREE.InstancedBufferAttribute; private aPar: THREE.InstancedBufferAttribute;
  // per particle, CPU side: world position, velocity, age (s), alive, which nozzle
  private wx: Float32Array; private wy: Float32Array; private wz: Float32Array;
  private vx: Float32Array; private vy: Float32Array; private vz: Float32Array;
  private age: Float32Array;
  private next = 0;
  private acc = 0;
  private puffT = 0;
  private mat: THREE.ShaderMaterial;
  live = 0;                 // particles alive (for tests)

  constructor(perNozzle = 24, maxPerNozzle = 24) {
    this.max = maxPerNozzle * 2;
    this.n = Math.min(this.max, perNozzle * 2);
    const n = this.max;
    this.pos = new Float32Array(n * 3); this.dir = new Float32Array(n * 3); this.par = new Float32Array(n * 3);
    this.wx = new Float32Array(n); this.wy = new Float32Array(n); this.wz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.age = new Float32Array(n).fill(LIFE);
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    this.aPos = new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aDir = new THREE.InstancedBufferAttribute(this.dir, 3).setUsage(THREE.DynamicDrawUsage);
    this.aPar = new THREE.InstancedBufferAttribute(this.par, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', this.aPos); g.setAttribute('aDir', this.aDir); g.setAttribute('aP', this.aPar);
    g.instanceCount = this.n;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: { uLight: { value: 1 }, uGlow: { value: 0.2 } },
      transparent: true, depthWrite: false, depthTest: true, fog: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.name = 'thrust-jets';
    this.mesh.visible = false;
  }

  // how many particles a nozzle gets (the phone build fewer); allocates nothing
  setPerNozzle(k: number) {
    const n = Math.max(2, Math.min(this.max, Math.round(k) * 2));
    if (n === this.n) return;
    this.n = n; (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n; this.next = 0; this.clear();
  }
  get pool() { return this.n; }

  // a short burst from both nozzles, angled down (the hop's take-off)
  puff(seconds = 0.35) { this.puffT = seconds; }

  // dt: frame time; thrust 0..1; nozzles: the two nozzle positions in render coordinates (null when the car has none);
  // fx, fz: the car's forward direction; cvx, cvz: its world velocity (m/s); daylight 0..1
  update(dt: number, thrust: number, nozzles: THREE.Vector3[] | null, fx: number, fz: number, cvx: number, cvz: number, daylight: number) {
    const n = this.n, half = n / 2;
    if (this.puffT > 0) this.puffT = Math.max(0, this.puffT - dt);
    const emit = nozzles && nozzles.length === 2 ? Math.max(thrust, this.puffT > 0 ? 1 : 0) : 0;
    // emission: enough to keep each nozzle's pool full at full thrust (pool / life per second, per nozzle)
    if (emit > 0.02 && dt > 0) {
      this.acc += dt * (half / LIFE) * 2 * emit;
      const down = this.puffT > 0 ? 0.45 : 0.04;
      while (this.acc >= 1) {
        this.acc -= 1;
        const i = this.next; this.next = (this.next + 1) % n;
        const nz = nozzles![i & 1];
        const jit = (Math.random() - 0.5) * 0.12, jitY = (Math.random() - 0.5) * 0.08;
        const sp = JET * (0.75 + 0.5 * Math.random()) * (0.6 + 0.4 * emit);
        this.wx[i] = nz.x + ORIGIN.x; this.wy[i] = nz.y; this.wz[i] = nz.z + ORIGIN.z;
        this.vx[i] = cvx - fx * sp + fz * jit * sp; this.vz[i] = cvz - fz * sp - fx * jit * sp;
        this.vy[i] = (jitY - down) * sp;
        // spread the newest particles along the step so a fast car leaves a continuous plume
        const back = Math.random() * dt;
        this.wx[i] += (this.vx[i] - cvx) * back * 0.3; this.wz[i] += (this.vz[i] - cvz) * back * 0.3;
        this.age[i] = Math.random() * dt;
      }
    } else this.acc = 0;
    let live = 0;
    const kd = Math.exp(-DRAG * dt);
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      if (this.age[i] >= LIFE) { this.par[o] = 1; this.par[o + 1] = 0; this.par[o + 2] = 0; continue; }
      this.age[i] += dt;
      this.vx[i] *= kd; this.vz[i] *= kd; this.vy[i] = this.vy[i] * kd + 0.6 * dt;   // slows in the air, rises a little as it warms
      this.wx[i] += this.vx[i] * dt; this.wy[i] += this.vy[i] * dt; this.wz[i] += this.vz[i] * dt;
      const t = Math.min(1, this.age[i] / LIFE);
      this.pos[o] = this.wx[i] - ORIGIN.x; this.pos[o + 1] = this.wy[i]; this.pos[o + 2] = this.wz[i] - ORIGIN.z;
      this.dir[o] = -fx; this.dir[o + 1] = 0; this.dir[o + 2] = -fz;
      this.par[o] = t; this.par[o + 1] = 0.16 + 0.95 * t; this.par[o + 2] = 0.25 + 0.9 * (1 - t);
      live++;
    }
    this.live = live;
    this.mesh.visible = live > 0;
    if (live > 0) { this.aPos.needsUpdate = true; this.aDir.needsUpdate = true; this.aPar.needsUpdate = true; }
    else this.aPar.needsUpdate = true;
    this.mat.uniforms.uLight.value = 0.12 + 0.88 * daylight;
    this.mat.uniforms.uGlow.value = 0.12 + 0.5 * (1 - daylight);
    // the cones: the flow follows the valve (and the hop's puff), and they draw only while gas flows
    const cm = coneMaterial(), flow = nozzles ? emit : 0;
    this.time += dt;
    cm.uniforms.uFlow.value = flow; cm.uniforms.uTime.value = this.time % 1000;
    cm.uniforms.uLight.value = 0.12 + 0.88 * daylight; cm.uniforms.uGlow.value = 0.15 + 0.55 * (1 - daylight);
    cm.visible = flow > 0.02;
  }
  private time = 0;

  clear() { this.age.fill(LIFE); this.acc = 0; this.puffT = 0; this.live = 0; this.mesh.visible = false; coneMaterial().visible = false; coneMaterial().uniforms.uFlow.value = 0; }
}
