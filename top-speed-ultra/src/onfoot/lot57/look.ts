// How Lot 57 is drawn at each of the three graphics presets (the owner, 2026-10-21: "let's just stick with 3"):
//   Low    the retro look (lot57/retro.ts): full resolution and crisp, cel-shaded, saturated simplified colour, a
//          limited palette with a fine ordered dither, dark outlines, hard one-step sun shadows, a banded sky; no
//          bloom, no ambient occlusion, no reflections. The phone default, inside the plan's phone budgets.
//   HD     the realistic look: soft sun shadows (2048), multisampling, bloom on the lights after dark, a few real
//          lights near you, the surfaces' relief (normal maps), a gentle grade and vignette.
//   Ultra  as close as the browser gets: ambient occlusion (GTAO, strong in the yard's contact areas), bloom,
//          multisampling, 4096 sun shadows, 16x anisotropic filtering, eight real lights near you and four of the
//          string lights' spots casting pools of light and shadows of their own after dark, reflections in the Shed's
//          glass (lot57/glass.ts), the stronger relief, and a stronger, warmer rim and fill on the people.
// On every preset: the mountains with form, the retro look's clouds, and golden hour's warm sky (lot57/sky.ts), the
// umbrellas' undersides lit (mats.ts CANOPY).
// The page (main.ts) keeps its presets' other settings (people, parked cars, pixel ratio); this owns the frame.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Toon, RetroPass } from './retro';
import { TICKS, RIM_GAIN, CANOPY, GLOW } from './mats';
import { setAnisotropy } from './surfaces';
import { SkyDress } from './sky';
import { ShedMirror } from './glass';

export type Quality = 'low' | 'hd' | 'ultra';
/** what casts the sun's shadow on Low (the batches by name; see lowCasters) */
const LOW_CASTERS = /^(shed-walls|shed-roof|shed-awnings|venue-wood|phone-wood|venue-canvas|venue-paint|frontage-brick|palm-trunks|palm-crowns|lot-steel|lamp-poles)$/;
interface Pipe { retro: boolean; msaa: number; bloom: boolean; ao: boolean; grade: boolean; aniso: number; spots: number; spotMap: number; mirror: boolean; rim: number; fill: number }
const PIPE: Record<Quality, Pipe> = {
  low: { retro: true, msaa: 0, bloom: false, ao: false, grade: false, aniso: 2, spots: 0, spotMap: 0, mirror: false, rim: 1, fill: 1 },
  hd: { retro: false, msaa: 4, bloom: true, ao: false, grade: true, aniso: 8, spots: 0, spotMap: 0, mirror: false, rim: 1.1, fill: 1.05 },
  ultra: { retro: false, msaa: 4, bloom: true, ao: true, grade: true, aniso: 16, spots: 4, spotMap: 1024, mirror: true, rim: 2.1, fill: 1.7 },
};
/** the golden hour's light: the sun a deeper amber, the sky's light warmer (render time only; Environment keeps its own) */
const SUN_GOLD = new THREE.Color(1.0, 0.8, 0.56), HEMI_GOLD = new THREE.Color(1.08, 0.94, 0.8);

// a photographer's finish in display space: a soft vignette, a touch of contrast, warm highlights and cool shadows
// (stronger after dark, when the string lights and the blue hour do most of the work)
const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uVig: { value: 0.22 }, uSplit: { value: 0.04 }, uAspect: { value: 1 }, uGold: { value: 0 }, uPunch: { value: 0 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float uVig, uSplit, uAspect, uGold, uPunch; varying vec2 vUv;
void main() {
  vec4 c = texture2D( tDiffuse, vUv );
  float l = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  // golden hour: the low sun's warmth through the whole frame, strongest in the light (teal kept in the shadows)
  c.rgb *= mix( vec3( 1.0 ), mix( vec3( 1.02, 0.97, 0.9 ), vec3( 1.12, 0.98, 0.78 ), smoothstep( 0.2, 0.8, l ) ), uGold );
  c.rgb += uSplit * ( vec3( 1.0, 0.55, 0.1 ) * smoothstep( 0.45, 1.0, l ) - vec3( 0.25, 0.1, -0.35 ) * ( 1.0 - smoothstep( 0.0, 0.45, l ) ) );
  c.rgb = mix( c.rgb, c.rgb * c.rgb * ( 3.0 - 2.0 * c.rgb ), 0.18 + 0.14 * uPunch );
  // Ultra: a little more colour in the mid-tones (greys stay grey)
  { float lm = dot( c.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ); c.rgb = mix( vec3( lm ), c.rgb, 1.0 + 0.1 * uPunch ); }
  vec2 p = ( vUv - 0.5 ) * vec2( uAspect, 1.0 );
  c.rgb *= 1.0 - uVig * smoothstep( 0.35, 1.1, length( p ) * 1.25 );
  gl_FragColor = c;
}`,
};

export class Look {
  quality: Quality = 'hd';
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  private gtao: GTAOPass | null = null;
  private grade: ShaderPass | null = null;
  private retro: RetroPass | null = null;
  readonly toon: Toon;
  private night = 0;
  /** the low sun's warmth (0 none .. 1 the sun within a few degrees of the horizon), measured each frame */
  gold = 0;
  private _sd = new THREE.Vector3();
  private open = false;
  private frame = 0;
  /** the string lights' spans (and other warm sources) the Ultra spots are hung from: local x, y, z */
  spotSources: { x: number; y: number; z: number }[] = [];
  private spots: THREE.SpotLight[] = [];
  private spotAt: number[] = [];
  private spotX = Infinity; private spotZ = Infinity;
  private _order: number[] = []; private _dist: number[] = [];
  private _fw = new THREE.Vector3(); private _ahead = new THREE.Vector3();
  /** the pass names in order (set here, not read from the classes' names, which the build minifies) */
  private passNames: string[] = ['scene'];
  private sky: SkyDress | null = null;
  private mirror: ShedMirror | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private poolMat: THREE.MeshBasicMaterial | null | undefined;
  private _sun = new THREE.Color(); private _hemi = new THREE.Color(); private _gold = new THREE.Color();
  /** the sun's height in degrees (the moon's after dark), from the last frame */
  sunAlt = 0;
  /** noAO: what ambient occlusion must not see (the sky's far layers: the ring of mountains at the far plane went
   *  black under GTAO, whose depth there has no precision left). env: the game's Environment, whose sky layers the
   *  page re-dresses (lot57/sky.ts) */
  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, private sun: THREE.DirectionalLight, private flare: THREE.Object3D, private noAO: THREE.Object3D[] = [], env?: ConstructorParameters<typeof SkyDress>[0]) {
    this.toon = new Toon(renderer);
    if (env) { this.sky = new SkyDress(env); this.hemi = env.hemi; }
  }

  /** in the game (embed.ts): release the frame's passes and their targets when the venue is taken off, and give every
   *  mesh back the material it wore before Low's toon look, so the release that follows disposes those (the game's car
   *  paint among them, shared with the game: left on, the venue's renderer stayed on its dispose listeners) */
  dispose() {
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.gtao = null; this.grade = null;
    this.retro?.dispose(); this.retro = null;
    this.toon.dispose();
  }

  /** build the frame for a preset; pr is the pixel ratio the page chose */
  apply(qq: Quality, pr: number) {
    const P = PIPE[qq], r = this.renderer;
    this.quality = qq;
    this.composer?.dispose(); this.composer = null; this.bloom = null; this.gtao = null; this.grade = null;
    this.retro?.dispose(); this.retro = null;
    RIM_GAIN.value.set(P.rim, P.fill);
    // the sun's shadows: hard one-step texels on Low (the retro look), soft on HD and Ultra
    const type = P.retro ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (r.shadowMap.type !== type) { r.shadowMap.type = type; this.dirtyMaterials(); }
    this.sun.shadow.bias = P.retro ? -0.0006 : -0.00025;
    // Low's sun shadows cover 32 m round you (the game's Low box is 44 m): crisper hard edges, and fewer casters drawn
    // into the map. (The page's Environment sets the box for each map size; this narrows it after, on Low only.)
    if (P.retro) {
      const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
      sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.updateProjectionMatrix();
    }
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    if (P.retro) {
      this.retro = new RetroPass(r);
      this.retro.setSize(size.x, size.y);
      this.toon.style(this.scene);
      this.lowCasters(true);
      this.passNames = ['scene', 'retro (tone map, ink, sky bands, palette, dither)'];
    } else {
      this.toon.unstyle();
      this.lowCasters(false);
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: P.msaa });
      const c = new EffectComposer(r, rt);
      const names: string[] = [];
      c.addPass(new RenderPass(this.scene, this.camera)); names.push('scene (render)');
      if (P.ao) {
        const g = new GTAOPass(this.scene, this.camera, size.x, size.y);
        // strong in the yard's contact areas: under the tables and benches, round the planters' and the Shed's feet,
        // between the chairs, under the canopies (nearly two metres' reach, weighted to what's close, the occluders
        // taken as thick, no fall-off with distance along a sample's path, the result raised to 2.2: three's
        // defaults left only the table legs dark in this yard)
        g.blendIntensity = 1;
        g.updateGtaoMaterial({ radius: 2.0, distanceExponent: 1.3, thickness: 6, scale: 2.2, distanceFallOff: 0, samples: 16 });
        const hide = g.overrideVisibility.bind(g), far = this.noAO, mir = () => this.mirror?.mesh;
        g.overrideVisibility = () => { hide(); for (const o of far) o.visible = false; const m = mir(); if (m) m.visible = false; };
        g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
        this.gtao = g; c.addPass(g); names.push('ambient occlusion (GTAO)');
      }
      if (P.bloom) {
        this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88);
        // Ultra: what goes into the glow is capped, keeping its hue (a bulb's emissive is many times white, and blurred through the
        // bloom's short separable kernels its saturated edge took the kernels' square shape: square haloes round
        // the near bulbs)
        if (P.ao) {
          const hp = this.bloom.materialHighPassFilter;
          hp.fragmentShader = hp.fragmentShader.replace('gl_FragColor = mix( outputColor, texel, alpha );', 'vec4 hc = mix( outputColor, texel, alpha ); gl_FragColor = hc * min( 1.0, 1.4 / max( max( hc.r, max( hc.g, hc.b ) ), 1e-4 ) );');
          hp.needsUpdate = true;
        }
        c.addPass(this.bloom); names.push('bloom (UnrealBloom)');
      }
      c.addPass(new OutputPass()); names.push('output (tone map, sRGB)');
      if (P.grade) { this.grade = new ShaderPass(GradeShader); this.grade.uniforms.uPunch.value = P.ao ? 1 : 0; c.addPass(this.grade); names.push('grade (vignette, split tone, golden hour)'); }
      if (P.msaa) names[0] += `, MSAA ${P.msaa}x`;
      this.passNames = names;
      c.setPixelRatio(pr); c.setSize(innerWidth, innerHeight);
      this.composer = c;
    }
    // the bulbs' glow sprites: smaller and harder in the retro look (the palette steps them into rings)
    this.scene.traverse((o) => {
      const pt = o as THREE.Points; if (!pt.isPoints || pt.name !== 'bulb-glow') return;
      const pm = pt.material as THREE.PointsMaterial; pm.userData.size ??= pm.size; pm.size = pm.userData.size * (P.retro ? 0.5 : 1);
    });
    // sharper surfaces at a glancing angle: 16x anisotropic filtering on Ultra (where the GPU has it)
    setAnisotropy(this.scene, Math.min(P.aniso, r.capabilities.getMaxAnisotropy()));
    this.setSpots(P);
    // Ultra: the Shed's glass reflects the yard (made the first time it's wanted)
    if (P.mirror && !this.mirror) { this.mirror = new ShedMirror(); this.scene.add(this.mirror.mesh); }
    if (this.mirror) this.mirror.mesh.visible = P.mirror;
    this.tune();
  }

  /** a test view of what the ambient occlusion sees (Ultra): its denoised occlusion in place of the frame */
  aoView(on: boolean | 'raw', tune?: Record<string, number>) {
    if (!this.gtao) return null;
    this.gtao.output = on === 'raw' ? GTAOPass.OUTPUT.AO : on ? GTAOPass.OUTPUT.Denoise : GTAOPass.OUTPUT.Default;
    if (tune) this.gtao.updateGtaoMaterial(tune);
    const u = (this.gtao as unknown as { gtaoMaterial: THREE.ShaderMaterial }).gtaoMaterial.uniforms;
    return { radius: u.radius.value, scale: u.scale.value, thickness: u.thickness.value, distanceExponent: u.distanceExponent.value, distanceFallOff: u.distanceFallOff?.value };
  }

  /** the window changed size */
  resize(pr: number) {
    this.composer?.setPixelRatio(pr); this.composer?.setSize(innerWidth, innerHeight);
    if (this.retro) { const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.retro.setSize(s.x, s.y); }
  }

  /** the clock changed: how much of the light is the lamps' (0 day .. 1 night), and whether Lot 57 is open */
  setNight(night: number, open: boolean) { this.night = night; this.open = open; this.tune(); }

  private tune() {
    const k = this.night;
    // bloom is for the lights after dark: by day a sunlit white wall is over the night threshold and would smear
    if (this.bloom) {
      const ultra = this.quality === 'ultra';
      this.bloom.threshold = THREE.MathUtils.lerp(4.5, ultra ? 0.72 : 0.88, k);
      // (Ultra: a little stronger than HD, on its capped input; 0.8 turned the lit pylon into a white blob)
      this.bloom.strength = THREE.MathUtils.lerp(0.12, ultra ? 0.5 : 0.34, k);
      this.bloom.radius = ultra ? 0.5 : 0.55;
    }
    if (this.grade) { this.grade.uniforms.uVig.value = 0.16 + 0.14 * k; this.grade.uniforms.uSplit.value = 0.025 + 0.035 * k; }
    if (this.gtao) this.gtao.blendIntensity = 1 - 0.2 * k;
  }

  /** draw the frame: the retro pass, or the composer (the people's light and the flickers first) */
  render() {
    const t = performance.now() / 1000;
    for (let i = 0; i < TICKS.length; i++) TICKS[i](t);
    this.frame++;
    if (this.grade) this.grade.uniforms.uAspect.value = innerWidth / Math.max(1, innerHeight);
    // the sun's height (the sun's light points from its position to its target; the moon's is bluer than it is red)
    const sd = this._sd.copy(this.sun.position).sub(this.sun.target.position).normalize();
    this.sunAlt = +(Math.asin(THREE.MathUtils.clamp(sd.y, -1, 1)) * 180 / Math.PI).toFixed(2);
    const day = this.sun.color.r > this.sun.color.b && this.sun.intensity > 0.3;
    this.gold = day ? THREE.MathUtils.smoothstep(0.42 - sd.y, 0, 0.32) : 0;
    if (this.grade) this.grade.uniforms.uGold.value = this.gold;
    this.placeSpots();
    // golden hour's light for this frame only (Environment's own colours are put back after the frame): the low sun
    // a deeper amber and the sky's light warmer, as the warmed sky shows
    const g = this.gold, hemi = this.hemi;
    this._sun.copy(this.sun.color); if (hemi) this._hemi.copy(hemi.color);
    if (g > 0) {
      this.sun.color.multiply(this._gold.setRGB(1, 1, 1).lerp(SUN_GOLD, g));
      if (hemi) hemi.color.multiply(this._gold.setRGB(1, 1, 1).lerp(HEMI_GOLD, g));
    }
    this.sky?.update(!!this.retro, this.night, g);
    // Ultra after dark: the real spots make the pools under the strings, so the strings' baked light on the yard is
    // turned down (to 60%) for the frame and the painted pools under the strings and heaters up, for the contrast
    // between a pool and the dark between them that the real lights give
    const ultraNight = this.spots.length > 0 && this.open && this.night > 0.3;
    const ga0r = GLOW.a.value.r, ga0g = GLOW.a.value.g, ga0b = GLOW.a.value.b;
    this.poolMat ??= ((this.scene.getObjectByName('venue-pools') as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined) ?? null;
    const po0 = this.poolMat?.opacity ?? 0;
    this.mirror?.update(this.scene, this.frame);
    // under the umbrellas: the sun through the canvas and off the paving (by day), the strings' warm fill (after dark)
    {
      const si = this.sun.intensity * (day ? 1 : 0), ga = GLOW.a.value;
      CANOPY.value.copy(this.sun.color).multiplyScalar(si * 0.085);
      if (hemi) CANOPY.value.r += hemi.groundColor.r * hemi.intensity * 0.35, CANOPY.value.g += hemi.groundColor.g * hemi.intensity * 0.35, CANOPY.value.b += hemi.groundColor.b * hemi.intensity * 0.35;
      CANOPY.value.r += ga.r * 0.7; CANOPY.value.g += ga.g * 0.7; CANOPY.value.b += ga.b * 0.7;
    }
    if (ultraNight) { GLOW.a.value.multiplyScalar(0.6); if (this.poolMat) this.poolMat.opacity = Math.min(1, po0 * 2.2); }
    if (this.retro) {
      this.toon.sync();
      this.retro.gold = this.gold;
      this.retro.render(this.scene, this.camera);
      this.flare.visible = false;           // a camera's lens artefact: not in the retro look
      // what that frame drew without the look (a person's body or a held cup arriving, a parked car rebuilt) gets it
      // from the next frame: found in the renderer's own list of what it drew, not by walking the scene
      this.toon.catchUp(this.renderer.renderLists.get(this.scene, 0), this.lowCaster);
    } else if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.sun.color.copy(this._sun); if (hemi) hemi.color.copy(this._hemi);
    if (ultraNight) { GLOW.a.value.setRGB(ga0r, ga0g, ga0b); if (this.poolMat) this.poolMat.opacity = po0; }
  }

  // ---------------------------------------------------------------- Ultra's shadow-casting spots
  private setSpots(P: Pipe) {
    while (this.spots.length > P.spots) { const s = this.spots.pop()!; this.scene.remove(s, s.target); s.dispose(); }
    while (this.spots.length < P.spots) {
      const s = new THREE.SpotLight(0xffb062, 0, 14, Math.PI * 0.24, 0.85, 2);
      s.castShadow = true; s.shadow.mapSize.set(P.spotMap, P.spotMap); s.shadow.bias = -0.0005; s.shadow.normalBias = 0.03;
      s.shadow.camera.near = 0.5; s.shadow.camera.far = 12; s.shadow.autoUpdate = false;
      s.name = 'ultra-spot'; this.scene.add(s, s.target); this.spots.push(s);
    }
    this.spotX = Infinity; this.dirtyMaterials();
  }
  /** hang the spots from the spans nearest a point seven metres ahead of you (so their pools fall where you look;
   *  re-chosen when that point has moved two metres); on only after dark while Lot 57 is open, and their shadow maps
   *  drawn only then: one map a frame in turn (the yard is still and the people move slowly, and each map draws every
   *  caster in its cone again), and at once for a spot that moved */
  private placeSpots() {
    const S = this.spots, n = S.length;
    if (!n) return;
    const on = this.open && this.night > 0.3;
    for (let i = 0; i < n; i++) S[i].shadow.needsUpdate = on && this.frame % n === i;
    if (!on) { for (let i = 0; i < n; i++) S[i].intensity = 0; return; }
    const f = this.camera.getWorldDirection(this._fw), fl = Math.hypot(f.x, f.z) || 1;
    const cp = this._ahead.set(this.camera.position.x + (f.x / fl) * 7, 0, this.camera.position.z + (f.z / fl) * 7);
    if (Math.hypot(cp.x - this.spotX, cp.z - this.spotZ) > 2) {
      this.spotX = cp.x; this.spotZ = cp.z;
      // the n nearest spans (a partial insertion sort into two kept arrays: no allocation)
      const src = this.spotSources, O = this._order, D = this._dist;
      O.length = 0; D.length = 0;
      for (let k = 0; k < src.length; k++) {
        const d = Math.hypot(src[k].x - cp.x, src[k].z - cp.z);
        let j = O.length;
        if (j === n) { if (d >= D[n - 1]) continue; j = n - 1; } else { O.push(0); D.push(0); }
        while (j > 0 && D[j - 1] > d) { O[j] = O[j - 1]; D[j] = D[j - 1]; j--; }
        O[j] = k; D[j] = d;
      }
      for (let i = 0; i < n; i++) {
        const k = i < O.length ? O[i] : -1;
        // a spot that moves to a new span draws its shadow map this frame, so its shadows don't lag
        if (this.spotAt[i] !== k) { this.spotAt[i] = k; S[i].shadow.needsUpdate = true; }
      }
    }
    for (let i = 0; i < n; i++) {
      const s = S[i], p = this.spotSources[this.spotAt[i]];
      if (!p) { s.intensity = 0; continue; }
      if (s.position.x !== p.x || s.position.z !== p.z) {
        s.position.set(p.x, p.y, p.z); s.target.position.set(p.x, 0, p.z); s.target.updateMatrixWorld();
      }
      s.intensity = 85 * this.night;
    }
  }

  /**
   * Low's sun shadows come from the big, simple shapes only (the Shed, the hoods, the tables' tops and umbrellas,
   * the trucks and painted props, the palms, the lamp poles), not from the parked cars, your car, the trees' leaves
   * or the thin steel (trestles, heaters, kegs, rails): hard shadows that read, inside the phone's triangle budget.
   * The people's own (blobs on Low) are the crowd's to decide, your driver's the page's. Off again on HD and Ultra.
   */
  private lowCasters(on: boolean) {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      // (leaving Low: each mesh's own earlier value back, as it was when Low turned it off)
      if (!on) { if (m.userData.lowNoCast !== undefined) { m.castShadow = !!m.userData.lowNoCast; delete m.userData.lowNoCast; } return; }
      this.lowCaster(m);
    });
  }
  /** Low's rule for one mesh: off unless it's one of the big shapes (its earlier value kept in userData.lowNoCast) */
  private lowCaster = (m: THREE.Mesh) => {
    if (!m.castShadow || /^lod/.test(m.name) || LOW_CASTERS.test(m.name)) return;
    m.userData.lowNoCast = m.castShadow; m.castShadow = false;
  };

  /** what casts the sun's shadow now (visible meshes), biggest first; and the shadow passes' cost in this frame,
   *  measured (the frame drawn with the shadow maps and again without them) */
  casters(n = 30) {
    const r = this.renderer;
    const draw = (shadows: boolean) => { const en = r.shadowMap.enabled; r.shadowMap.enabled = shadows; r.info.reset(); r.shadowMap.needsUpdate = true; this.render(); r.shadowMap.enabled = en; return { calls: r.info.render.calls, tris: r.info.render.triangles }; };
    const withS = draw(true), without = draw(false);
    const out: { name: string; tris: number }[] = [];
    const shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh || !m.castShadow || !m.geometry || !shown(m)) return;
      const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3, k = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
      out.push({ name: m.name || m.parent?.name || m.type, tris: Math.round(t * k) });
    });
    out.sort((a, b) => b.tris - a.tris);
    return { total: out.reduce((s, c) => s + c.tris, 0), meshes: out.length, shadowPass: { calls: withS.calls - without.calls, tris: withS.tris - without.tris }, frame: withS, top: out.slice(0, n) };
  }

  /** shadow-map type or light count changed: every material's program must be rebuilt */
  private dirtyMaterials() {
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material; if (!m) return; for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
  }

  stats() {
    const r = this.renderer, P = PIPE[this.quality];
    return {
      style: P.retro ? 'retro' : 'realistic',
      passes: [...this.passNames],
      sunAlt: this.sunAlt, gold: +this.gold.toFixed(3), mirror: !!this.mirror?.mesh.visible,
      rimGain: [RIM_GAIN.value.x, RIM_GAIN.value.y],
      msaa: P.msaa, shadowMap: { size: this.sun.shadow.mapSize.x, type: r.shadowMap.type === THREE.BasicShadowMap ? 'hard (basic)' : 'soft (PCF soft)' },
      anisotropy: Math.min(P.aniso, r.capabilities.getMaxAnisotropy()),
      shadowSpots: this.spots.length, spotsLit: this.spots.filter((s) => s.intensity > 0).length,
      toon: { ...this.toon.counts },
      bloom: this.bloom ? { strength: +this.bloom.strength.toFixed(3), threshold: +this.bloom.threshold.toFixed(3) } : null,
      ao: !!this.gtao,
    };
  }

  /**
   * the canvas-painted textures the visible scene uses now (the plan's budget: 12 at 512 px on Low, 16 at 1024 on
   * High), counted on the materials of what's shown, uniforms included; and the triangles of named groups (`tris`)
   */
  textures() {
    const seen = new Map<THREE.Texture, string>(), shown = (o: THREE.Object3D | null): boolean => !o || (o.visible && shown(o.parent));
    const add = (v: unknown, where: string) => { const t = v as THREE.Texture; if (t && t.isTexture && !(t as THREE.DataTexture).isDataTexture && !(t as unknown as { isRenderTargetTexture?: boolean }).isRenderTargetTexture && !seen.has(t)) seen.set(t, where); };
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.material || !shown(m)) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        for (const k of Object.keys(mat)) add((mat as unknown as Record<string, unknown>)[k], `${m.name || m.parent?.name || m.type}.${k}`);
        const u = (mat as THREE.ShaderMaterial).uniforms; if (u) for (const k of Object.keys(u)) add(u[k]?.value, `${m.name || m.parent?.name || m.type}.${k}`);
      }
    });
    const list = [...seen].map(([t, where]) => { const im = t.image as { width?: number; height?: number } | undefined; return { where, w: im?.width ?? 0, h: im?.height ?? 0, canvas: typeof HTMLCanvasElement !== 'undefined' && t.image instanceof HTMLCanvasElement }; });
    const canvas = list.filter((t) => t.canvas);
    return { all: list.length, canvas: canvas.length, over512: canvas.filter((t) => Math.max(t.w, t.h) > 512).length, sizes: canvas.map((t) => `${t.where}:${t.w}x${t.h}`) };
  }
  tris(name: string) {
    const o = this.scene.getObjectByName(name); if (!o) return null;
    let t = 0, calls = 0;
    const parts: [string, number][] = [];
    o.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh || !m.visible) return; const g = m.geometry, k = (g.index ? g.index.count : g.attributes.position.count) / 3 * ((m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1); t += k; calls++; parts.push([m.name || (m.material as THREE.Material).name || m.type, Math.round(k)]); });
    parts.sort((a, b) => b[1] - a[1]);
    return { tris: Math.round(t), meshes: calls, top: parts.slice(0, 12) };
  }

  /** the time to draw n frames start to finish (each waited for with a pixel read): software rendering here, so a
   *  measure of the preset's relative cost, not of a phone's frame rate */
  timeFrames(n = 5) {
    const gl = this.renderer.getContext(), px = new Uint8Array(4), out: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      this.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      out.push(+(performance.now() - t0).toFixed(1));
    }
    out.sort((a, b) => a - b);
    return { median: out[Math.floor(n / 2)], min: out[0], max: out[n - 1], all: out };
  }
}
