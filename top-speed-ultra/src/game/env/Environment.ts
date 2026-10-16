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

// sunset: the sun 5.5° up at azimuth 292° (a late-June sunset over OC). The procedural mountain ring's crest is
// 3° to 12° high round the compass and 5.1° there, its lowest in the western half (6.9° at the old 258°, where a 3°
// sun never showed), so the whole disc and its lens flare clear the ridge while daylight stays 0.91, under day's 1
const PRESETS: Record<Exclude<TimeOfDay, 'live'>, { alt: number; az: number }> = {
  sunrise: { alt: 4, az: 100 }, day: { alt: 55, az: 195 }, sunset: { alt: 5.5, az: 292 }, night: { alt: -28, az: 330 },
};
// the simulated temperature (tempF): the hour each preset stands for, and what each weather takes off
const TEMP_HOUR: Record<Exclude<TimeOfDay, 'live'>, number> = { sunrise: 6.5, day: 12.5, sunset: 19.5, night: 23 };
const TEMP_WX: Record<Sky5, number> = { clear: 0, cloudy: -3, rain: -8, fog: -6, mist: -4 };
const WX: Record<Sky5,{ turb: number; sun: number; sky: number; cloud: number; cloudDark: number; fogNear: number; fogFar: number; haze: number; wet: number; grip: number }> = {
  clear:  { turb: 1.3, sun: 1,    sky: 1,    cloud: 0.55, cloudDark: 0,    fogNear: 220, fogFar: 1,    haze: 0xa9bfd6, wet: 0, grip: 1 },
  cloudy: { turb: 5,   sun: 0.42, sky: 0.72, cloud: 1,    cloudDark: 0.5,  fogNear: 180, fogFar: 0.9,  haze: 0x9ea6b0, wet: 0, grip: 1 },
  rain:   { turb: 9,   sun: 0.2,  sky: 0.5,  cloud: 1,    cloudDark: 0.65, fogNear: 50,  fogFar: 0.55, haze: 0x7f8891, wet: 1, grip: 0.8 },
  fog:    { turb: 10,  sun: 0.3,  sky: 0.62, cloud: 0.7,  cloudDark: 0.3,  fogNear: 12,  fogFar: 0.14, haze: 0xb2b7bc, wet: 0.35, grip: 0.95 },
  mist:   { turb: 4,   sun: 0.65, sky: 0.85, cloud: 0.8,  cloudDark: 0.15, fogNear: 50,  fogFar: 0.42, haze: 0xbfc8d2, wet: 0.1, grip: 0.98 },
};

// the light under an overcast sky: a near-neutral, slightly cool sky light, a grey ground bounce, a cool sun. Red sits
// a touch above green in each: the asphalt and concrete maps lean green and went cyan under a plain cool light.
const OVERCAST_SKY = new THREE.Color(0.88, 0.86, 0.93), OVERCAST_GROUND = new THREE.Color(0.44, 0.42, 0.45), OVERCAST_SUN = new THREE.Color(0.93, 0.93, 1);

interface State { alt: number; az: number; turb: number; sun: number; sky: number; cloud: number; cloudDark: number; fogNear: number; fogFar: number; haze: THREE.Color; wet: number; grip: number }

export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly clouds: THREE.Mesh;
  readonly mountains: THREE.Mesh;
  readonly stars: THREE.Points;
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  // the sun's lens flare, drawn in screen space over the finished frame (see updateFlare)
  readonly flare = new THREE.Group();
  private flareScene = new THREE.Scene();
  private flareCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  private flareEls: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: THREE.Color; d: number; size: number; gain: number }[] = [];
  private flareRay = new THREE.Raycaster();
  private flareRoots: THREE.Object3D[] = [];
  private flarePropRoots: THREE.Object3D[] = [];
  private flareBlocker: ((origin: THREE.Vector3, dir: THREE.Vector3) => boolean) | null = null;
  private flareHits: THREE.Intersection[] = [];
  private flareTick = 0;
  private flareClear = 1;          // the last raycast: 1 nothing between the camera and the sun, 0 something
  private flareOpen = 1;           // the same, blended over 0.3 s
  private flareClock = 0;
  private ridge = new Float32Array(0);
  readonly flareStats = { k: 0, ndc: [0, 0], open: 1, ridge: 1, rayMs: 0, hit: '' };
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
  private overcastK = 0;

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

    // the sun's lens flare: a warm glow at the sun and a few ghosts down the lens axis. Each is a plane in a
    // screen-space scene (x in units of the screen's height, so they stay round and the same size in portrait and
    // on any pixel ratio) that renderFlare() draws over the finished frame. three's Lensflare is not used: it
    // reads the framebuffer back for its occlusion test, which fails on the multisampled target High and Ultra
    // render into (it drew a black square there). Occlusion is a raycast toward the sun instead (updateFlare).
    const glow = T.flareGlow(), ghost = T.flareGhost(), pg = new THREE.PlaneGeometry(1, 1);
    // texture, height as a share of the screen's, where on the axis (0 the sun, 0.5 the centre, 1 opposite), tint, gain
    const els: [THREE.Texture, number, number, number, number][] = [[glow, 0.26, 0, 0xfff0d8, 1.7], [ghost, 0.05, 0.42, 0xffd6a0, 0.9], [ghost, 0.095, 0.6, 0xc4dcff, 0.6], [ghost, 0.035, 0.78, 0xffe4bc, 0.9], [ghost, 0.15, 1.02, 0xcad4ff, 0.45]];
    for (const [t, size, d, col, gain] of els) {
      const mat = new THREE.MeshBasicMaterial({ map: t, color: col, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false });
      const mesh = new THREE.Mesh(pg, mat); mesh.frustumCulled = false; mesh.scale.setScalar(size * 2);
      this.flare.add(mesh); this.flareEls.push({ mesh, mat, base: new THREE.Color(col), d, size, gain });
    }
    this.flare.visible = false;
    this.flareScene.add(this.flare);
    this.flareRay.far = 400;

    // distant mountains: a ring of hazy ridges that travels with you (the real ones nearby come from the terrain)
    const n = 256, pos: number[] = [], idx: number[] = [];
    this.ridge = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, h = 180 + 520 * fbm2(Math.cos(a) * 3 + 10, Math.sin(a) * 3, 5, 3) ** 1.6 * 2.2;
      const R = 4200;
      this.ridge[i] = h;
      pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.setIndex(idx);
    // it writes depth, so the clouds (drawn later, being transparent) stop showing through the ridges; the stars
    // are drawn just before it (see below) and it paints over them
    this.mountains = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0xa3abb6, fog: false, side: THREE.DoubleSide, depthWrite: true }));
    this.mountains.renderOrder = -1;
    scene.add(this.mountains);

    // stars, for the night: 1400 points over the upper sky (even on the sphere down to 3°, thinned under 10°,
    // where haze dims them and the ridge hides most). Each has its own brightness (a power law: a handful
    // bright, most faint, dimmer near the horizon), tint (blue-white to warm) and size, and the shader draws it
    // round. The brightest is 0.78, under the bloom pass's threshold (0.92), so none blooms into a cross.
    // They're additive and sit in the opaque pass right after the sky dome, so the mountain ring (drawn next)
    // paints over them whatever the depth buffer's precision; they write no depth, so the scene draws over them.
    const sp: number[] = [], sc: number[] = [], ss: number[] = [];
    while (ss.length < 1400) {
      const th = Math.random() * Math.PI * 2, y = 1 - Math.random() * 0.95;
      if (y < 0.17 && Math.random() > y / 0.17) continue;
      const r = Math.sqrt(1 - y * y), warm = Math.random();
      const b = 0.78 * (0.03 + 0.97 * Math.random() ** 5) * lerp(0.35, 1, smoothstep(0.05, 0.35, y));
      sp.push(r * Math.cos(th), y, r * Math.sin(th));
      sc.push(b * lerp(0.78, 1, warm), b * lerp(0.86, 0.92, warm), b * lerp(1, 0.74, warm));
      ss.push(1 + 1.6 * (b / 0.78) ** 2);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aColor', new THREE.Float32BufferAttribute(sc, 3));
    sg.setAttribute('aSize', new THREE.Float32BufferAttribute(ss, 1));
    const sm = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uPR: { value: 1 } },
      vertexShader: 'attribute float aSize; attribute vec3 aColor; uniform float uPR; varying vec3 vColor;\n'
        + 'void main() { vColor = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPR; }',
      fragmentShader: 'uniform float uOpacity; varying vec3 vColor;\n'
        + 'void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float a = max(0.0, 1.0 - dot(p, p)); gl_FragColor = vec4(vColor, a * a * uOpacity);\n'
        + '#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.stars = new THREE.Points(sg, sm);
    this.stars.renderOrder = -2.5;
    this.stars.frustumCulled = false;
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
  // the grade under cloud, for the output pass on High and Ultra: a little less saturation (1 = untouched)
  get saturation() { return 1 - 0.15 * this.overcastK; }

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

  // the air temperature on the HUD's clock chip, °F (U1). Simulated, and the chip says so: Orange County's mild coast
  // by the hour (58° at 3 am up to 74° at 3 pm; "Live" uses this device's clock, the presets their own hour) less a few
  // degrees for the weather in force. A clear day reads 72°. Nothing live is fed in.
  tempF(now = new Date()): number {
    const hour = this.time === 'live' ? now.getHours() + now.getMinutes() / 60 : TEMP_HOUR[this.time];
    return Math.round(66 + 8 * Math.cos(((hour - 15) / 24) * Math.PI * 2) + TEMP_WX[this.currentWeather(now)]);
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
    // overcast: how much of the sun the weather hides (clear 0, mist 0.44, cloudy 0.73, fog 0.88, rain 1). Under
    // cloud the sky does the lighting: the direct sun falls away much faster than the weather's sun factor (cloudy
    // keeps 7% of it: a faint grounding shadow under the cars rather than hard shadows; PCFSoft shadows ignore
    // shadow.radius, so this blend is what softens them), it turns neutral-cool, and the hemisphere light rises,
    // brighter, cooler and nearer neutral. By day only; night keeps its moonlight and the old small lift under cloud.
    const overcast = clamp((1 - c.sun) / 0.8, 0, 1) * day, direct = c.sun ** 3;
    this.overcastK = overcast;
    const gain = 0.36 * (0.03 + 0.97 * day) * c.sky;
    // the visible sky goes grey rather than white under cloud (the reference's overcast is a mid grey with a bright
    // horizon), so the deck's undersides can stay a light grey and still read against it
    (this.sky.material as THREE.ShaderMaterial).uniforms.skyGain.value = gain * (1 - 0.18 * overcast);
    // the sky that lights the scene (the environment map) is bright and even under cloud, so it isn't dimmed with
    // the visible sky: the cabin's dark plastics and the paint are lit mostly by its reflection and would go black
    (this.envSky.material as THREE.ShaderMaterial).uniforms.skyGain.value = gain * (1 + 0.6 * overcast);
    // sunlight by day (warm when it's low), moonlight by night
    const low = 1 - smoothstep(0.05, 0.6, c.alt);
    if (day > 0.02) {
      this.sun.color.setRGB(1, lerp(0.95, 0.66, low), lerp(0.86, 0.42, low)).lerp(OVERCAST_SUN, overcast);
      this.sun.intensity = 3.1 * lerp(c.sun, direct, day) * smoothstep(-0.02, 0.12, c.alt);
    }
    const moon = 1 - day;
    if (moon > 0.5) { this.sun.color.setRGB(0.55, 0.66, 1); this.sun.intensity = 0.32 * c.sun + 0.08; dirFrom(0.7, 2.8, this.sunDir); }
    this.hemi.color.setRGB(lerp(0.12, 0.74, day), lerp(0.16, 0.82, day), lerp(0.28, 0.93, day)).lerp(OVERCAST_SKY, overcast);
    this.hemi.groundColor.setRGB(lerp(0.03, 0.48, day), lerp(0.03, 0.42, day), lerp(0.04, 0.33, day)).lerp(OVERCAST_GROUND, overcast);
    this.hemi.intensity = lerp(0.25, 0.55, day) * (1 + (1 - c.sun) * lerp(0.15, 1.6 * c.sky, day));
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(c.haze); (this.scene.background as THREE.Color).copy(c.haze);
    fog.near = Math.min(c.fogNear, this.farPlane * 0.12);
    fog.far = Math.max(fog.near + 60, this.farPlane * 0.92 * c.fogFar);
    // the cloud deck: under cloud its undersides go a mid grey against the bright haze and the dome flattens, so the
    // deck comes down toward the horizon as a real one does (clear keeps its high, fading fair-weather cloud). The
    // rim fades out through the texture's own edge and the world draws over the dome, so nothing shows at the join.
    const cm = this.clouds.material as THREE.MeshBasicMaterial;
    cm.opacity = c.cloud * lerp(0.25, 1, day);
    cm.color.setRGB(1, 1, 1).multiplyScalar(lerp(0.15, 1 - c.cloudDark * lerp(0.6, 0.9, overcast), day));
    this.clouds.scale.y = this.clouds.scale.x * lerp(1, 0.4, overcast);
    (this.mountains.material as THREE.MeshBasicMaterial).color.copy(c.haze).lerp(new THREE.Color(0x5d6470), 0.25 * day);
    this.mountains.visible = c.fogFar > 0.3;
    // the stars come out once the sun is 1° under the horizon and are all there by 9° (civil twilight ends at
    // 6°); cloud and haze take them away. Hidden outright by day, so they cost no draw call
    const sm = this.stars.material as THREE.ShaderMaterial;
    sm.uniforms.uOpacity.value = smoothstep(-0.02, -0.16, c.alt) * smoothstep(0.3, 0.8, c.sun);
    this.stars.visible = sm.uniforms.uOpacity.value > 0.002;
    // exposure set for the outside: under cloud the camera opens up a little, as a real one would, so the sky
    // reads bright and the road mid-grey while the cockpit stays the darker thing in frame
    this.renderer.toneMappingExposure = lerp(1.25, 0.92, day) * (1 + 0.2 * overcast * c.sky);
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
    (this.stars.material as THREE.ShaderMaterial).uniforms.uPR.value = this.renderer.getPixelRatio();
    this.updateFlare(camera);
    this.updateRain(dt, cp, carVel);
  }

  // what can hide the sun from the camera: whole groups (the roads with their walls and bridges, the traffic),
  // groups whose instanced props count but whose ground doesn't (the terrain: its buildings and trees block the
  // sun, its big tile meshes are too costly to test and too flat to matter), and a test of our own for the
  // player's car (PlayerCar.sunBlocked: its cabin and glass, since its real body is too heavy to raycast)
  setFlareOccluders(roots: THREE.Object3D[], propRoots: THREE.Object3D[] = [], blocker: ((origin: THREE.Vector3, dir: THREE.Vector3) => boolean) | null = null) {
    this.flareRoots = roots; this.flarePropRoots = propRoots; this.flareBlocker = blocker;
  }

  // how high the mountain ring's crest is at a sun azimuth (radians, from north clockwise), as seen from the camera
  ridgeAltitude(az: number) {
    const n = this.ridge.length - 1;
    if (n < 1) return -1;
    let a = Math.atan2(-Math.cos(az), Math.sin(az)); if (a < 0) a += Math.PI * 2;      // the ring's own parameter
    const f = (a / (Math.PI * 2)) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
    const h = this.ridge[i] * (1 - t) + this.ridge[i + 1] * t;
    // the ring is scaled by far * 0.8 / 4200 and sits far * 0.01 below the camera
    return Math.atan2(h - 0.01 * 4200 / 0.8, 4200);
  }

  // the flare for this frame: the sun's place on screen from the camera's own orientation (the camera sits at the
  // scene's root), its strength from daylight, the sun's height and the weather, and whether anything hides it:
  // the mountain ring by its crest height, nearer things by a raycast toward the sun every third frame (blended
  // over 0.3 s). Nothing of this touches the main render.
  private tmpV = new THREE.Vector3(); private tmpQ = new THREE.Quaternion();
  private updateFlare(camera: THREE.Camera) {
    const st = this.flareStats, c = this.cur;
    const now = performance.now(), fdt = this.flareClock ? Math.min(0.1, (now - this.flareClock) / 1000) : 0;
    this.flareClock = now;
    const k = this.daylight * smoothstep(0.01, 0.1, c.alt) * clamp((c.sun - 0.25) / 0.75, 0, 1) * 0.85;
    st.k = k;
    if (k <= 0.02) { this.flare.visible = false; return; }
    const pc = camera as THREE.PerspectiveCamera;
    const v = this.tmpV.copy(this.sunDir).applyQuaternion(this.tmpQ.copy(camera.quaternion).invert());
    if (v.z > -1e-3) { this.flare.visible = false; return; }          // the sun is behind the camera
    const tan = Math.tan((pc.fov * Math.PI) / 360), aspect = pc.aspect || 1;
    const nx = v.x / -v.z / (tan * aspect), ny = v.y / -v.z / tan;
    st.ndc[0] = nx; st.ndc[1] = ny;
    // the flare fades as the sun leaves the frame (the ghosts linger a little past the edge, as on a real lens)
    const edge = 1 - smoothstep(1.0, 1.35, Math.max(Math.abs(nx), Math.abs(ny)));
    // the crest of the distant ridges: the sun's disc is about half a degree across
    const ridge = this.mountains.visible ? smoothstep(this.ridgeAltitude(c.az) - 0.005, this.ridgeAltitude(c.az) + 0.005, c.alt) : 1;
    st.ridge = ridge;
    if (edge > 0 && ridge > 0) {
      if (this.flareTick++ % 3 === 0) this.castFlareRay(camera);
      const step = fdt / 0.3;
      this.flareOpen += clamp(this.flareClear - this.flareOpen, -step, step);
    }
    st.open = this.flareOpen;
    const vis = k * edge * ridge * this.flareOpen;
    this.flare.visible = vis > 0.01;
    if (!this.flare.visible) return;
    if (this.flareCam.right !== aspect) { this.flareCam.left = -aspect; this.flareCam.right = aspect; this.flareCam.updateProjectionMatrix(); }
    for (const f of this.flareEls) {
      const s = 1 - 2 * f.d;
      f.mesh.position.set(nx * s * aspect, ny * s, 0);
      f.mat.color.copy(f.base).multiplyScalar(vis * f.gain);
    }
  }

  // one ray from the camera toward the sun, through what's near (400 m): the first solid, visible thing on it
  // hides the sun. Glass and other see-through materials don't count; neither do hidden parts (the exterior's
  // tinted glass is hidden from the seat) or skinned meshes (the driver can't block their own view, and skinned
  // raycasts are dear).
  private castFlareRay(camera: THREE.Camera) {
    const t0 = performance.now(), ray = this.flareRay, hits = this.flareHits;
    hits.length = 0;
    if (this.flareBlocker?.(camera.position, this.sunDir)) { this.flareClear = 0; this.flareStats.hit = 'car'; this.flareStats.rayMs = performance.now() - t0; return; }
    ray.set(camera.position, this.sunDir);
    const test = (o: THREE.Object3D, propsOnly: boolean) => {
      const m = o as THREE.Mesh, im = o as THREE.InstancedMesh;
      if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (propsOnly && !im.isInstancedMesh)) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();       // Mesh.raycast culls by it when it exists
      if (im.isInstancedMesh && (im.boundingSphere === null || im.instanceMatrix.usage === THREE.DynamicDrawUsage)) im.computeBoundingSphere();
      m.raycast(ray, hits);
    };
    for (const r of this.flareRoots) r.traverse((o) => test(o, false));
    for (const r of this.flarePropRoots) r.traverse((o) => test(o, true));
    hits.sort((a, b) => a.distance - b.distance);
    let hit = '';
    for (const h of hits) {
      const o = h.object as THREE.Mesh, mats = o.material, mat = Array.isArray(mats) ? mats[h.face?.materialIndex ?? 0] : mats;
      if (mat.transparent && mat.opacity < 0.5) continue;
      let shown = true;
      for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) { shown = false; break; }
      if (!shown) continue;
      hit = `${o.name || o.type} ${h.distance.toFixed(1)}m`;
      break;
    }
    this.flareClear = hit ? 0 : 1;
    this.flareStats.hit = hit; this.flareStats.rayMs = performance.now() - t0;
  }

  // draw the flare over the finished frame (after the composer or the plain render; before the corner window)
  renderFlare() {
    if (!this.flare.visible) return;
    const r = this.renderer, ac = r.autoClear;
    r.autoClear = false;
    r.render(this.flareScene, this.flareCam);
    r.autoClear = ac;
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
