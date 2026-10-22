// sky.js — B1, Light Minute's sky (films/channels/space/set). Reusable by every episode.
//
// An opaque sky sphere (the void gradient of the theme, top to bottom of the frame, a ±½-step dither so
// the indigo never bands, and a faint baked Milky Way band) plus up to 6,000 stars as soft round points
// of at least 2 px, coloured by temperature from blue-white to pale lemon (never orange or red: the
// channel has no warm hues). Both sit at infinity: the shader places them around the camera, so only
// the camera's turn moves them, never its travel.
//
// Why opaque and at a finite depth: on a transparent canvas the finish's depth of field reads empty
// pixels as the far plane and draws a dark rim around every silhouette (kits/cinema/film/README.md).
//
// The motion-blur probe in cinema3d.js sees only mesh origins, so it is blind to stars (points) and to
// the sky turning with the camera. sky.update() therefore also places a few invisible probe meshes at
// fixed directions in front of the camera (front.js probes()). Their directions come from the camera at
// the frame's own moment (rounded to the frame), so across one shutter they stay put in the world and
// the camera's turn moves them on screen exactly as it moves the stars.
//
//   const sky = createSky({ stars: 6000, seed: 11, band: { normal: [0.3, 0.9, 0.2], width: 0.16, gain: 1 } });
//   scene.add(sky.group);
//   sky.update(camera, { frameCam, starGain: 1, bandGain: 1 });   // frameCam: { quaternion } of the camera at the frame's moment
import * as THREE from "three";
import { tok } from "./look.js";
import { probes } from "cinema/sci/front.js";
import { rng } from "cinema/film/runtime.js";

const SKY_R = 1500, STAR_R = 1400;

const SKY_VS = /* glsl */ `
  varying vec3 vDir;
  uniform float uR;
  void main(){
    vDir = normalize(position);
    vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * uR, 1.0);
    gl_Position = p;
  }`;
const SKY_FS = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop, uBot; uniform vec2 uRes; uniform float uSplit;
  uniform vec3 uBandN; uniform float uBandW, uBandGain; uniform vec3 uBandCol;
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  void main(){
    float y = 1.0 - gl_FragCoord.y / uRes.y;                       // 0 at the top of the frame
    vec3 c = mix(uTop, uBot, smoothstep(0.0, uSplit, y));
    if (uBandGain > 0.0) {
      vec3 d = normalize(vDir);
      float b = dot(d, uBandN), band = exp(-b * b / (uBandW * uBandW));
      float n = vn(d * 6.0) * 0.55 + vn(d * 13.0) * 0.3 + vn(d * 29.0) * 0.15;
      float lane = smoothstep(0.35, 0.75, vn(d * 9.0 + 3.1));
      c += uBandCol * band * (0.35 + 0.9 * n) * (1.0 - 0.55 * lane * band) * uBandGain;
    }
    float dz = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    c *= 1.0 + dz * 0.045;                                            // about ±½ an 8-bit step at these levels
    gl_FragColor = vec4(c, 1.0);
  }`;
const STAR_VS = /* glsl */ `
  attribute float size; attribute vec3 col;
  uniform float uR, uS1, uGain; varying vec3 vCol;
  void main(){
    vec3 d = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + d * uR, 1.0);
    gl_PointSize = max(2.0, size * uS1);
    vCol = col * uGain;
  }`;
const STAR_FS = /* glsl */ `
  varying vec3 vCol;
  void main(){
    vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q);
    if (r2 > 1.0) discard;
    float a = exp(-r2 * 3.2);
    gl_FragColor = vec4(vCol * a, a);
  }`;

export const createSky = (o = {}) => {
  const W = window.W, H = window.H, S1 = Math.min(W, H) / 1080, R = rng(o.seed ?? 11);
  const group = new THREE.Group();
  group.name = "sky";
  const band = o.band || { normal: [0.32, 0.9, 0.29], width: 0.16, gain: 1 };
  const bn = new THREE.Vector3(...band.normal).normalize();
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uR: { value: SKY_R }, uTop: { value: new THREE.Vector3(...tok("void-top")) }, uBot: { value: new THREE.Vector3(...tok("void")) },
      uRes: { value: new THREE.Vector2(W, H) }, uSplit: { value: 0.58 },
      uBandN: { value: bn }, uBandW: { value: band.width }, uBandGain: { value: band.gain ?? 1 },
      uBandCol: { value: new THREE.Vector3(...tok("text-2")).multiplyScalar(0.11) },
    },
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sphere.renderOrder = -10; sphere.frustumCulled = false;
  group.add(sphere);   // the shader ignores the mesh transform; update() parks the origin in front of the lens (a probe)

  // stars: denser along the band; sizes 2–4.5 px, a few bright enough to bloom
  const n = o.stars ?? 6000, P = new Float32Array(n * 3), S = new Float32Array(n), C = new Float32Array(n * 3);
  const warm = new THREE.Vector3(1.0, 0.96, 0.84), cool = new THREE.Vector3(0.78, 0.86, 1.0), wh = new THREE.Vector3(1, 1, 1);
  const e1 = new THREE.Vector3(1, 0, 0).cross(bn).normalize(), e2 = bn.clone().cross(e1).normalize();
  for (let i = 0; i < n; i++) {
    let d;
    if (R() < 0.45) {        // in the band: around the great circle, a gaussian off it
      const a = R() * Math.PI * 2, off = (R() + R() + R() - 1.5) * band.width * 0.9;
      d = e1.clone().multiplyScalar(Math.cos(a)).add(e2.clone().multiplyScalar(Math.sin(a))).add(bn.clone().multiplyScalar(off)).normalize();
    } else {
      const z = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      d = new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a));
    }
    P.set([d.x, d.y, d.z], i * 3);
    const m = Math.pow(R(), 5.5);                    // most faint, a few bright
    S[i] = 2.0 + 2.6 * m + (R() < 0.004 ? 1.4 : 0);
    const temp = R(), col = temp < 0.45 ? cool.clone().lerp(wh, temp / 0.45) : wh.clone().lerp(warm, (temp - 0.45) / 0.55);
    const b = 0.1 + 0.55 * m + (S[i] > 4 ? 0.9 : 0);
    C.set([col.x * b, col.y * b, col.z * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("size", new THREE.BufferAttribute(S, 1));
  g.setAttribute("col", new THREE.BufferAttribute(C, 3));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uR: { value: STAR_R }, uS1: { value: S1 }, uGain: { value: 1 } }, vertexShader: STAR_VS, fragmentShader: STAR_FS,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(g, starMat);
  stars.renderOrder = -9; stars.frustumCulled = false;
  group.add(stars);

  const place = probes(group, 2);
  const q = new THREE.Quaternion(), v = new THREE.Vector3();
  const DIRS = [[0, 0, -1], [0.35, 0.5, -1], [-0.35, -0.5, -1]].map((d) => new THREE.Vector3(...d).normalize());
  return {
    group, sphere, stars,
    update(camera, { frameCam, starGain = 1, bandGain = 1 } = {}) {
      starMat.uniforms.uGain.value = starGain;
      stars.visible = starGain > 1e-3;
      skyMat.uniforms.uBandGain.value = (band.gain ?? 1) * bandGain;
      q.copy(frameCam ? frameCam.quaternion : camera.quaternion);
      const at = DIRS.map((d) => { v.copy(d).applyQuaternion(q).multiplyScalar(60).add(camera.position); return [v.x, v.y, v.z]; });
      sphere.position.fromArray(at[0]);   // a mesh origin must never sit at or behind the lens (the probe would read nonsense)
      place(at.slice(1));
    },
  };
};
