// The sky over Orange County: an atmospheric sky with the sun where it really is (from this device's clock, or a
// chosen time), sunlight and skylight that follow it, haze and fog by the weather, clouds, rain, stars and the moon
// at night, soft sun shadows that follow the car, and reflections from the sky (image-based lighting).
// Weather is chosen in Settings or changes on its own ("Changing"). Nothing here is fetched: no live weather data.

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import * as T from '../textures';
import { fbm2, clamp, lerp, smoothstep } from '../util';

export type TimeOfDay = 'live' | 'sunrise' | 'day' | 'sunset' | 'night';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'fog' | 'mist' | 'changing';
type Sky5 = Exclude<Weather, 'changing'>;

export const HAZE = new THREE.Color(0xa9bfd6);
const LAT = 33.72, LON = -117.83;

// where the sun is for a moment and place: altitude and azimuth (from north, clockwise), radians
export function sunPosition(date: Date, lat = LAT, lon = LON) {
  const rad = Math.PI / 180, d = date.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const ha = (gmst * 15 + lon) * rad - ra, la = lat * rad;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { alt, az };
}
// x east, y up, z south
const dirFrom = (alt: number, az: number, out = new THREE.Vector3()) => out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();

const PRESETS: Record<Exclude<TimeOfDay, 'live'>, { alt: number; az: number }> = {
  sunrise: { alt: 4, az: 100 }, day: { alt: 55, az: 195 }, sunset: { alt: 3, az: 258 }, night: { alt: -28, az: 330 },
};
const WX: Record<Sky5, { turb: number; sun: number; sky: number; cloud: number; cloudDark: number; fogNear: number; fogFar: number; haze: number; wet: number; grip: number }> = {
  clear:  { turb: 1.3, sun: 1,    sky: 1,    cloud: 0.55, cloudDark: 0,    fogNear: 220, fogFar: 1,    haze: 0xa9bfd6, wet: 0, grip: 1 },
  cloudy: { turb: 5,   sun: 0.42, sky: 0.72, cloud: 1,    cloudDark: 0.35, fogNear: 180, fogFar: 0.9,  haze: 0x9ea6b0, wet: 0, grip: 1 },
  rain:   { turb: 9,   sun: 0.2,  sky: 0.5,  cloud: 1,    cloudDark: 0.65, fogNear: 50,  fogFar: 0.55, haze: 0x7f8891, wet: 1, grip: 0.8 },
  fog:    { turb: 10,  sun: 0.3,  sky: 0.62, cloud: 0.7,  cloudDark: 0.3,  fogNear: 12,  fogFar: 0.14, haze: 0xb2b7bc, wet: 0.35, grip: 0.95 },
  mist:   { turb: 4,   sun: 0.65, sky: 0.85, cloud: 0.8,  cloudDark: 0.15, fogNear: 50,  fogFar: 0.42, haze: 0xbfc8d2, wet: 0.1, grip: 0.98 },
};

interface State { alt: number; az: number; turb: number; sun: number; sky: number; cloud: number; cloudDark: number; fogNear: number; fogFar: number; haze: THREE.Color; wet: number; grip: number }

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly clouds: THREE.Mesh;
  readonly mountains: THREE.Mesh;
  readonly stars: THREE.Points;
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  private rain: THREE.LineSegments | null = null;
  private drops = new Float32Array(0);
  private shadowSize = 0;
  private farPlane = 2000;
  private renderer: THREE.WebGLRenderer;
  private envSky: Sky;
  private envScene = new THREE.Scene();
  private envT = 0;
  private envDirty = true;
  private envTex: THREE.Texture | null = null;
  time: TimeOfDay = 'day';
  weather: Weather = 'clear';
  private cur: State; private tgt: State;
  private liveT = 0;

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.sky = new Sky();
    this.sky.scale.setScalar(1800);
    this.sky.renderOrder = -3;
    tameSky(this.sky, 0.36);
    scene.add(this.sky);
    this.envSky = new Sky(); this.envSky.scale.setScalar(900); tameSky(this.envSky, 0.36);
    this.envScene.add(this.envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 32), new THREE.MeshBasicMaterial({ color: 0x8a8070 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2; this.envScene.add(ground);

    this.sun = new THREE.DirectionalLight(0xfff1dc, 3.1);
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd2ee, 0x7a6a55, 0.55);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(HAZE.clone(), 220, 2000);
    scene.background = HAZE.clone();

    const cg = new THREE.SphereGeometry(5200, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const ct = T.clouds(); ct.repeat.set(3, 1);
    this.clouds = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, side: THREE.BackSide, opacity: 0.9, color: 0xffffff }));
    this.clouds.renderOrder = -2;
    scene.add(this.clouds);

    // distant mountains: a ring of hazy ridges that travels with you (the real ones nearby come from the terrain)
    const n = 256, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, h = 180 + 520 * fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3, 5, 3) ** 1.6 * 2.2;
      const R = 4200;
      pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setIndex(idx);
    this.mountains = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0xa3abb6, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    this.mountains.renderOrder = -1;
    scene.add(this.mountains);

    // stars, for the night
    const sp: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const u = Math.random(), v = Math.random() * 0.95, th = u * Math.PI * 2, ph = Math.acos(1 - v);
      sp.push(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.renderOrder = -2.5;
    scene.add(this.stars);

    this.cur = this.targetFor(new Date());
    this.tgt = { ...this.cur, haze: this.cur.haze.clone() };
    this.apply();
  }

  // how much rain is on the road (0..1), and the grip that leaves
  get wet() { return this.cur.wet; }
  get grip() { return this.cur.grip; }
  get daylight() { return smoothstep(-0.1, 0.14, this.cur.alt); }
  get visibility() { return this.cur.fogFar; }

  set(time: TimeOfDay, weather: Weather, instant = false) {
    this.time = time; this.weather = weather;
    this.tgt = this.targetFor(new Date());
    if (instant) { this.cur = { ...this.tgt, haze: this.tgt.haze.clone() }; this.apply(); }
    this.envDirty = true;
  }

  // the weather that's in force now ("Changing" moves through a cycle on the clock, about 4 minutes a step)
  private currentWeather(now: Date): Sky5 {
    if (this.weather !== 'changing') return this.weather;
    const cycle: Sky5[] = ['clear', 'cloudy', 'rain', 'cloudy', 'clear', 'mist', 'clear', 'fog', 'mist'];
    return cycle[Math.floor(now.getTime() / 240000) % cycle.length];
  }

  private targetFor(now: Date): State {
    const w = WX[this.currentWeather(now)];
    let alt: number, az: number;
    if (this.time === 'live') { const p = sunPosition(now); alt = p.alt; az = p.az; }
    else { const p = PRESETS[this.time]; alt = (p.alt * Math.PI) / 180; az = (p.az * Math.PI) / 180; }
    // the haze: blue by day, gold at the ends of the day, deep blue at night, greyed by the weather
    const day = smoothstep(-0.1, 0.14, alt), golden = smoothstep(0.35, 0.02, alt) * day;
    const haze = new THREE.Color(w.haze);
    haze.lerp(new THREE.Color(az < Math.PI ? 0xe2b896 : 0xe0a07c), golden * 0.55 * (w.sun > 0.5 ? 1 : 0.4));
    haze.lerp(new THREE.Color(0x0b111c), 1 - day);
    return { alt, az, turb: w.turb, sun: w.sun, sky: w.sky, cloud: w.cloud, cloudDark: w.cloudDark, fogNear: w.fogNear, fogFar: w.fogFar, haze, wet: w.wet, grip: w.grip };
  }

  // ease toward the target conditions; call every frame
  update(dt: number, now = new Date()) {
    this.liveT -= dt;
    if (this.liveT <= 0) { this.liveT = 20; this.tgt = this.targetFor(now); }
    const k = 1 - Math.exp(-dt / 2.5), c = this.cur, t = this.tgt;
    let moved = 0;
    for (const key of ['alt', 'turb', 'sun', 'sky', 'cloud', 'cloudDark', 'fogNear', 'fogFar', 'wet', 'grip'] as const) {
      const d = t[key] - c[key]; c[key] += d * k; moved += Math.abs(d);
    }
    let daz = t.az - c.az; daz = Math.atan2(Math.sin(daz), Math.cos(daz)); c.az += daz * k; moved += Math.abs(daz);
    c.haze.lerp(t.haze, k);
    if (moved > 1e-4) { this.apply(); if (moved > 0.02) this.envDirty = true; }
    this.envT -= dt;
    if (this.envDirty && this.envT <= 0) { this.envT = 4; this.envDirty = false; this.rebuildEnv(); }
  }

  private apply() {
    const c = this.cur, day = this.daylight;
    dirFrom(c.alt, c.az, this.sunDir);
    const u = this.sky.material.uniforms;
    for (const uu of [u, this.envSky.material.uniforms]) {
      uu.turbidity.value = c.turb; uu.rayleigh.value = lerp(1.2, 3.0, smoothstep(0, 0.5, c.alt));
      uu.mieCoefficient.value = lerp(0.0025, 0.009, 1 - smoothstep(0.02, 0.4, c.alt)); uu.mieDirectionalG.value = 0.8;
      uu.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    }
    const gain = 0.36 * (0.03 + 0.97 * day) * c.sky;
    (this.sky.material as THREE.ShaderMaterial).uniforms.skyGain.value = gain;
    (this.envSky.material as THREE.ShaderMaterial).uniforms.skyGain.value = gain;
    // sunlight by day (warm when it's low), moonlight by night
    const low = 1 - smoothstep(0.05, 0.6, c.alt);
    if (day > 0.02) {
      this.sun.color.setRGB(1, lerp(0.95, 0.66, low), lerp(0.86, 0.42, low));
      this.sun.intensity = 3.1 * c.sun * smoothstep(-0.02, 0.12, c.alt);
    }
    const moon = 1 - day;
    if (moon > 0.5) { this.sun.color.setRGB(0.55, 0.66, 1); this.sun.intensity = 0.32 * c.sun + 0.08; dirFrom(0.7, 2.8, this.sunDir); }
    this.hemi.color.setRGB(lerp(0.12, 0.74, day), lerp(0.16, 0.82, day), lerp(0.28, 0.93, day));
    this.hemi.groundColor.setRGB(lerp(0.03, 0.48, day), lerp(0.03, 0.42, day), lerp(0.04, 0.33, day));
    this.hemi.intensity = lerp(0.25, 0.55, day) * lerp(1.15, 1, c.sun);
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(c.haze); (this.scene.background as THREE.Color).copy(c.haze);
    fog.near = Math.min(c.fogNear, this.farPlane * 0.12);
    fog.far = Math.max(fog.near + 60, this.farPlane * 0.92 * c.fogFar);
    const cm = this.clouds.material as THREE.MeshBasicMaterial;
    cm.opacity = c.cloud * lerp(0.25, 1, day);
    cm.color.setRGB(1, 1, 1).multiplyScalar(lerp(0.15, 1 - c.cloudDark * 0.6, day));
    (this.mountains.material as THREE.MeshBasicMaterial).color.copy(c.haze).lerp(new THREE.Color(0x5d6470), 0.25 * day);
    this.mountains.visible = c.fogFar > 0.3;
    (this.stars.material as THREE.PointsMaterial).opacity = clamp((1 - day) * 1.3 - 0.2, 0, 1) * (c.sun > 0.5 ? 1 : 0.25);
    this.renderer.toneMappingExposure = lerp(1.25, 0.92, day);
  }

  private rebuildEnv() {
    const pm = new THREE.PMREMGenerator(this.renderer);
    const tex = pm.fromScene(this.envScene, 0.02).texture;
    pm.dispose();
    this.scene.environment = tex;
    this.envTex?.dispose();
    this.envTex = tex;
  }

  // far: the camera's far plane. The background layers are sized to sit inside it.
  setQuality(shadowSize: number, far: number) {
    this.sky.scale.setScalar(far * 0.9);
    this.clouds.scale.setScalar((far * 0.86) / 5200);
    this.mountains.scale.setScalar((far * 0.8) / 4200);
    this.stars.scale.setScalar(far * 0.85);
    this.farPlane = far;
    this.apply();
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

  // keep the sun's shadow box centred on the car (snapped to whole texels), the sky layers round the camera,
  // and the rain falling around you
  follow(target: THREE.Vector3, camera: THREE.Camera, time: number, dt = 0, carVel?: THREE.Vector3) {
    const s = this.sun;
    const cam = s.shadow.camera as THREE.OrthographicCamera;
    const texel = (cam.right - cam.left) / Math.max(1, s.shadow.mapSize.x);
    const snap = (v: number) => Math.round(v / texel) * texel;
    s.target.position.set(snap(target.x), target.y, snap(target.z));
    s.position.copy(s.target.position).addScaledVector(this.sunDir, 120);
    s.target.updateMatrixWorld();
    const cp = camera.position;
    this.sky.position.set(cp.x, 0, cp.z);
    this.clouds.position.set(cp.x, cp.y - this.farPlane * 0.08, cp.z);
    this.clouds.rotation.y = time * 0.002;
    this.mountains.position.set(cp.x, cp.y - this.farPlane * 0.01, cp.z);
    this.stars.position.copy(cp);
    this.updateRain(dt, cp, carVel);
  }

  // streaks of rain in a box round the camera; they lean back as you drive into them
  private updateRain(dt: number, cp: THREE.Vector3, v?: THREE.Vector3) {
    const amount = this.cur.wet * (this.currentWeather(new Date()) === 'rain' ? 1 : 0);
    if (amount < 0.05) { if (this.rain) this.rain.visible = false; return; }
    const N = 1800, B = 34, H = 22;
    if (!this.rain) {
      this.drops = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { this.drops[i * 3] = (Math.random() - 0.5) * 2 * B; this.drops[i * 3 + 1] = Math.random() * H - 6; this.drops[i * 3 + 2] = (Math.random() - 0.5) * 2 * B; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
      this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc8d2dc, transparent: true, opacity: 0.38, depthWrite: false }));
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
    }
    this.rain.visible = true;
    const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array, d = this.drops;
    const vx = v ? v.x : 0, vz = v ? v.z : 0, fall = 9.5, n = Math.floor(N * amount);
    for (let i = 0; i < N; i++) {
      d[i * 3 + 1] -= fall * dt; d[i * 3] -= vx * dt; d[i * 3 + 2] -= vz * dt;
      if (d[i * 3 + 1] < -6 || Math.abs(d[i * 3]) > B || Math.abs(d[i * 3 + 2]) > B) {
        d[i * 3] = (Math.random() - 0.5) * 2 * B; d[i * 3 + 1] = H - 6 + Math.random() * 4; d[i * 3 + 2] = (Math.random() - 0.5) * 2 * B;
      }
      const x = cp.x + d[i * 3], y = cp.y + d[i * 3 + 1], z = cp.z + d[i * 3 + 2], o = i * 6;
      if (i >= n) { a[o] = a[o + 3] = x; a[o + 1] = a[o + 4] = y - 1000; a[o + 2] = a[o + 5] = z; continue; }
      a[o] = x; a[o + 1] = y; a[o + 2] = z;
      a[o + 3] = x + vx * 0.03; a[o + 4] = y + fall * 0.045; a[o + 5] = z + vz * 0.03;
    }
    pos.needsUpdate = true;
  }
}

// the stock sky is calibrated for a much lower exposure than this scene; scale its output
function tameSky(sky: Sky, gain: number) {
  const m = sky.material as THREE.ShaderMaterial;
  m.uniforms.skyGain = { value: gain };
  m.fragmentShader = 'uniform float skyGain;\n' + m.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
  m.needsUpdate = true;
}
