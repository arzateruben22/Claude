// Southern California, early afternoon: an atmospheric sky, a hard sun with soft shadows that follow the car,
// reflections from the sky (image-based lighting), haze toward the horizon, slow clouds and far mountains.

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as T from '../textures';
import { fbm2 } from '../util';

export const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 52), THREE.MathUtils.degToRad(215)).normalize();
export const HAZE = new THREE.Color(0xa9bfd6);

// the stock sky is calibrated for a much lower exposure than this scene; scale its output so it reads deep blue
function tameSky(sky: Sky, gain: number) {
  const m = sky.material as THREE.ShaderMaterial;
  m.uniforms.skyGain = { value: gain };
  m.fragmentShader = 'uniform float skyGain;\n' + m.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
  m.needsUpdate = true;
}

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly clouds: THREE.Mesh;
  readonly mountains: THREE.Mesh;
  private shadowSize = 0;
  private farPlane = 2000;

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.sky = new Sky();
    this.sky.scale.setScalar(1800);
    this.sky.renderOrder = -3;                                   // drawn first, writes no depth: everything else draws over it
    const u = this.sky.material.uniforms;
    u.turbidity.value = 1.3; u.rayleigh.value = 3.0; u.mieCoefficient.value = 0.0025; u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
    tameSky(this.sky, 0.36);
    scene.add(this.sky);

    // image-based lighting from the same sky, so paint, glass and carbon reflect it
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky(); envSky.scale.setScalar(900);
    envSky.material.uniforms.turbidity.value = 1.3;
    envSky.material.uniforms.rayleigh.value = 3.0; envSky.material.uniforms.mieCoefficient.value = 0.0025; envSky.material.uniforms.mieDirectionalG.value = 0.8;
    envSky.material.uniforms.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
    tameSky(envSky, 0.36);
    envScene.add(envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 32), new THREE.MeshBasicMaterial({ color: 0x8a8070 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2; envScene.add(ground);
    scene.environment = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();

    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.1);
    this.sun.position.copy(SUN_DIR).multiplyScalar(120);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd2ee, 0x7a6a55, 0.55);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(HAZE, 220, 2000);
    scene.background = HAZE.clone();

    // clouds: a slowly turning dome above everything
    const cg = new THREE.SphereGeometry(5200, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const ct = T.clouds(); ct.repeat.set(3, 1);
    this.clouds = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, opacity: 0.9 }));
    this.clouds.renderOrder = -2;
    scene.add(this.clouds);

    // distant mountains: a ring of hazy ridges that travels with you
    const n = 256, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, h = 180 + 520 * fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3, 5, 3) ** 1.6 * 2.2;
      const R = 4200;
      pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setIndex(idx);
    const col = new Float32Array((n + 1) * 2 * 3);
    for (let i = 0; i <= n; i++) { const base = [0.62, 0.66, 0.72], top = [0.7, 0.72, 0.76]; col.set(base, i * 6); col.set(top, i * 6 + 3); }
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mountains = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    this.mountains.renderOrder = -1;
    scene.add(this.mountains);
  }

  // far: the camera's far plane. The background layers are sized to sit inside it.
  setQuality(shadowSize: number, far: number) {
    this.sky.scale.setScalar(far * 0.9);
    this.clouds.scale.setScalar((far * 0.86) / 5200);
    this.mountains.scale.setScalar((far * 0.8) / 4200);
    this.farPlane = far;
    far *= 0.92;
    (this.scene.fog as THREE.Fog).far = far;
    (this.scene.fog as THREE.Fog).near = Math.min(260, far * 0.12);
    if (shadowSize === this.shadowSize) return;
    this.shadowSize = shadowSize;
    this.sun.castShadow = shadowSize > 0;
    if (shadowSize > 0) {
      const s = this.sun.shadow;
      s.mapSize.set(shadowSize, shadowSize);
      const half = shadowSize >= 4096 ? 34 : shadowSize >= 2048 ? 28 : 22;
      const cam = s.camera as THREE.OrthographicCamera;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 1; cam.far = 260;
      cam.updateProjectionMatrix();
      s.bias = -0.00025; s.normalBias = 0.035; s.radius = 3;
      if (s.map) { s.map.dispose(); (s as unknown as { map: THREE.WebGLRenderTarget | null }).map = null; }
    }
  }

  // keep the sun's shadow box centred on the car, snapped to whole texels so it doesn't shimmer
  follow(target: THREE.Vector3, camera: THREE.Camera, time: number) {
    const s = this.sun;
    if (s.castShadow) {
      const cam = s.shadow.camera as THREE.OrthographicCamera;
      const texel = (cam.right - cam.left) / s.shadow.mapSize.x;
      const snap = (v: number) => Math.round(v / texel) * texel;
      s.target.position.set(snap(target.x), target.y, snap(target.z));
      s.position.copy(s.target.position).addScaledVector(SUN_DIR, 120);
      s.target.updateMatrixWorld();
    }
    const cp = camera.position;
    this.sky.position.set(cp.x, 0, cp.z);
    this.clouds.position.set(cp.x, cp.y - this.farPlane * 0.08, cp.z);
    this.clouds.rotation.y = time * 0.002;
    this.mountains.position.set(cp.x, cp.y - this.farPlane * 0.01, cp.z);
  }
}
