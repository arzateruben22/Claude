/* ═══════════════════════════════════════════════════════════
   Made with Claude — Breakout · engine

   window.film.seek(frame) renders exactly one frame, as a pure
   function of the frame number:
     camera / mascot / fx / UI ← timeline.json evaluated at t
     motion blur  = K sub-frames across a 180° shutter, accumulated
     depth of field = single-pass scatter-as-gather bokeh (half res)
     bloom → ACES tone map → grade (vignette, seeded grain, fringe)
   ═══════════════════════════════════════════════════════════ */
import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPanels, uiState, PANELS, COMP } from "./ui.js";
import { buildMascot, makePose, applyPose, LEG_H, BODY } from "./mascot.js";
import { buildFX } from "./fx.js";

const params = new URLSearchParams(location.search);
const FORMAT = params.get("format") === "9x16" ? "9x16" : "16x9";
const RENDER = params.has("render");
const QUALITY = params.get("q") || (RENDER ? "final" : "preview");   // preview | final
const SCALE = Number(params.get("scale") || 1);                       // render-size multiplier for drafts
const PROFILE = params.has("profile");

const J = await (await fetch("timeline.json")).json();
const FPS = J.fps, FRAMES = Math.round(J.duration * FPS);
const { width: FW, height: FH } = J.formats[FORMAT];
const W = Math.round(FW * SCALE), H = Math.round(FH * SCALE);
const UPW = J.ui.unitsPerWorld;
const world = (u, v) => ({ x: (u - J.ui.width / 2) / UPW, z: (v - J.ui.height / 2) / UPW });

/* ─── fonts (canvas UI) ─── */
const FONTS = [["Inter", 400], ["Inter", 500], ["Inter", 600], ["Inter", 700], ["Montserrat", 600], ["Montserrat", 700], ["Montserrat", 800]];
await Promise.all(FONTS.map(async ([fam, w]) => {
  const f = new FontFace(fam, `url(../vendor/fonts/${fam.toLowerCase()}-latin-${w}-normal.woff2)`, { weight: String(w) });
  document.fonts.add(await f.load());
}));
const fi = new FontFace("Inter", "url(../vendor/fonts/inter-latin-500-normal.woff2)", { weight: "500", style: "italic" });
document.fonts.add(await fi.load());

/* ─── renderer ─── */
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.getElementById("stage").appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 220);

/* ─── set: backdrop, desk, slab ─── */
const backdrop = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  vertexShader: "varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,1.0)).xyz); gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }",
  fragmentShader: `varying vec3 vDir;
    vec3 backdropCol(vec3 d){
      float g = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.22, -1.0)))), 2.6);
      float wide = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.05, -1.0)))), 1.2);
      return vec3(0.010, 0.0062, 0.0042) + vec3(0.30, 0.12, 0.035) * g + vec3(0.06, 0.026, 0.01) * wide; }
    void main(){ gl_FragColor = vec4(backdropCol(normalize(vDir)), 1.0); }`
}));
backdrop.renderOrder = -10;
scene.add(backdrop);

// desk: the warm light pool and the slab's contact shadow are static, so they are baked (unlit)
const SLAB_PRE = { w: J.ui.width / UPW + 0.5, d: J.ui.height / UPW + 0.5 };
const deskTex = (() => {
  const S = 2048, span = 120, cv = document.createElement("canvas"); cv.width = cv.height = S;
  const c = cv.getContext("2d"), k = S / span, cx = S / 2, cz = S / 2 + 3 * k;
  c.fillStyle = "#060403"; c.fillRect(0, 0, S, S);
  const g = c.createRadialGradient(cx, cz - 6 * k, 0, cx, cz - 6 * k, 34 * k);
  g.addColorStop(0, "#6b3a1f"); g.addColorStop(0.35, "#3a1f11"); g.addColorStop(0.7, "#160d08"); g.addColorStop(1, "#060403");
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.filter = `blur(${0.9 * k}px)`;
  c.fillStyle = "rgba(0,0,0,0.85)";
  c.beginPath(); c.roundRect(cx - (SLAB_PRE.w / 2 + 0.25) * k, S / 2 - (SLAB_PRE.d / 2 + 0.1) * k, (SLAB_PRE.w + 0.5) * k, (SLAB_PRE.d + 0.5) * k, 0.5 * k); c.fill();
  c.filter = "none";
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
})();
const desk = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: deskTex }));
desk.rotation.x = -Math.PI / 2; desk.position.y = -0.34;
scene.add(desk);

const SLAB = { w: J.ui.width / UPW + 0.5, d: J.ui.height / UPW + 0.5, h: 0.32 };
const slab = new THREE.Mesh(new RoundedBoxGeometry(SLAB.w, SLAB.h, SLAB.d, 4, 0.14), new THREE.MeshStandardMaterial({
  color: new THREE.Color("#1a1a1e"), roughness: 0.3, metalness: 0.45, envMapIntensity: 1.1
}));
slab.position.y = -SLAB.h / 2 - 0.0005;
slab.castShadow = false; slab.receiveShadow = false;
scene.add(slab);

/* ─── UI panels on the slab ─── */
const ui = createPanels(J);
const panelMeshes = {};
for (const [id, p] of Object.entries(ui.panels)) {
  const P = p.P;
  const tex = new THREE.CanvasTexture(p.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(id === "viewer" ? 1.4 : 1.3) });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(P.w / UPW, P.h / UPW), mat);
  m.rotation.x = -Math.PI / 2;
  const c = world(P.x + P.w / 2, P.y + P.h / 2);
  m.position.set(c.x, P.overlay ? 0.0045 : 0.003, c.z);
  m.receiveShadow = false;
  m.renderOrder = -5;                 // drawn first: the slab's top face is then rejected by depth
  scene.add(m);
  panelMeshes[id] = { mesh: m, tex };
}
// glossy screen: fresnel reflection of the warm backdrop (no hotspots), additive
const BACKDROP_GLSL = `vec3 backdropCol(vec3 d){
  float g = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.22, -1.0)))), 2.6);
  float wide = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.05, -1.0)))), 1.2);
  return vec3(0.010, 0.0062, 0.0042) + vec3(0.30, 0.12, 0.035) * g + vec3(0.06, 0.026, 0.01) * wide; }`;
const sheen = new THREE.Mesh(new THREE.PlaneGeometry(J.ui.width / UPW, J.ui.height / UPW), new THREE.ShaderMaterial({
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }",
  fragmentShader: BACKDROP_GLSL + `
    varying vec3 vW;
    void main(){
      vec3 v = normalize(vW - cameraPosition);
      vec3 r = reflect(v, vec3(0.0, 1.0, 0.0));
      float cosT = clamp(-v.y, 0.0, 1.0);
      float fres = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
      gl_FragColor = vec4(backdropCol(r) * fres * 2.2, 1.0);
    }`
}));
sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.006; sheen.renderOrder = 3;
scene.add(sheen);
// shadow catcher: a 6×6 patch that follows the mascot (soft shadow maps are costly over the whole slab)
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.005; shadowCatcher.receiveShadow = true; shadowCatcher.renderOrder = 2;
scene.add(shadowCatcher);

/* ─── lights ─── */
const key = new THREE.SpotLight(new THREE.Color("#ffe6cf"), 760, 0, 0.55, 0.85, 2);
key.position.set(-9, 17, 13); key.target.position.set(0, 0, -1);
key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
key.shadow.camera.near = 8; key.shadow.camera.far = 50;
scene.add(key, key.target);
const rim = new THREE.SpotLight(new THREE.Color("#ff8a3d"), 3200, 0, 0.7, 1, 2);
rim.position.set(3, 10, -26); rim.target.position.set(0, 0, -2);
scene.add(rim, rim.target);
scene.add(new THREE.HemisphereLight(new THREE.Color("#6a4a36"), new THREE.Color("#0a0605"), 0.3));

/* ─── mascot + fx ─── */
const M = buildMascot();
scene.add(M.root);
// glossy-screen reflection: a mirrored clone drawn right after the panels, clipped to the slab
renderer.localClippingEnabled = true;
const slabClip = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), J.ui.width / UPW / 2), new THREE.Plane(new THREE.Vector3(-1, 0, 0), J.ui.width / UPW / 2),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), J.ui.height / UPW / 2), new THREE.Plane(new THREE.Vector3(0, 0, -1), J.ui.height / UPW / 2)
];
shadowCatcher.material.clippingPlanes = slabClip;
const reflMats = new Map();
const R = M.root.clone(true);
R.traverse((o) => {
  if (!o.isMesh) return;
  if (!reflMats.has(o.material)) {
    const m = o.material.clone();
    Object.assign(m, { transparent: true, opacity: 0.2, depthTest: false, depthWrite: false, clippingPlanes: slabClip, side: THREE.DoubleSide });
    reflMats.set(o.material, m);
  }
  o.material = reflMats.get(o.material);
  o.renderOrder = -4; o.castShadow = false; o.receiveShadow = false;
});
const reflRoot = new THREE.Group(); reflRoot.scale.y = -1; reflRoot.add(R);
scene.add(reflRoot);
function syncReflection() {
  reflRoot.visible = M.root.visible;
  if (!M.root.visible) return;
  // copy the live pose onto the mirrored clone (same hierarchy order)
  const src = [], dst = [];
  M.root.traverse((o) => src.push(o)); R.traverse((o) => dst.push(o));
  src.forEach((o, i) => { dst[i].position.copy(o.position); dst[i].quaternion.copy(o.quaternion); dst[i].scale.copy(o.scale); dst[i].visible = o.visible; });
  // fade with height: the reflection belongs to the surface
  const h = M.root.position.y;
  reflMats.forEach((m) => (m.opacity = 0.2 * Math.max(0, 1 - h / 3)));
}
const pose = makePose(J, world);
const fx = buildFX(J, world, scene);
const viewerPos = (() => { const w = world(COMP.x + COMP.w / 2, COMP.y + COMP.h / 2 - 18); return new THREE.Vector3(w.x, 0, w.z); })();

/* ─── camera keys ─── */
const E = {
  "none": (p) => p,
  "sine.inOut": (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  "sine.out": (p) => Math.sin((p * Math.PI) / 2),
  "sine.in": (p) => 1 - Math.cos((p * Math.PI) / 2),
  "power2.inOut": (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  "power3.inOut": (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  "power4.inOut": (p) => (p < 0.5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
  "power2.out": (p) => 1 - (1 - p) * (1 - p),
  "power3.out": (p) => 1 - Math.pow(1 - p, 3)
};
const CK = J.camera[FORMAT];
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
// smoothed ground track of the mascot (camera keys with "rel" are offsets from it)
function groundTrack(t) {
  const g = new THREE.Vector3();
  for (let i = -4; i <= 4; i++) { const P = pose(t + i * 0.035, null, null); g.x += P.pos.x; g.z += P.pos.z; }
  return g.multiplyScalar(1 / 9).setY(0);
}
function keyAbs(k, t) {
  let pos = v3(k.pos), look = v3(k.look);
  if (k.rel) { const g = groundTrack(t); pos.add(g); look.add(g); }
  if (k.aim) {                                   // tilt toward the mascot's body (keeps jumps in frame)
    const P = pose(t, null, null);
    if (P.visible) look.lerp(P.pos.clone().add(new THREE.Vector3(0, 0.55, 0)), k.aim);
  }
  return { pos, look };
}
function camAt(t) {
  let i = CK.findIndex((k) => k.t > t);
  if (i === -1) i = CK.length - 1;
  if (i === 0) i = 1;
  const a = CK[i - 1], b = CK[i];
  const p = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  const e = (E[b.ease || "power2.inOut"] || E["power2.inOut"])(p);
  const A = keyAbs(a, t), B = keyAbs(b, t);
  return {
    pos: A.pos.lerp(B.pos, e), look: A.look.lerp(B.look, e),
    fov: a.fov + (b.fov - a.fov) * e, fstop: a.fstop + (b.fstop - a.fstop) * e, a, b, e
  };
}
function focusPoint(kind, look, P) {
  if (kind === "mascot" && P.visible) return P.pos.clone().add(new THREE.Vector3(0, (LEG_H + BODY.h / 2) * (P.sy || 1), 0));
  if (kind === "viewer") return viewerPos.clone();
  return look.clone();
}

/* ─── scene state at time ts (pure) ─── */
let lastPose = null;
function apply(ts, jitter) {
  const C = camAt(ts);
  camera.position.copy(C.pos);
  camera.fov = C.fov;
  camera.lookAt(C.look);
  camera.updateProjectionMatrix();
  if (jitter) camera.setViewOffset(W, H, jitter[0], jitter[1], W, H); else camera.clearViewOffset();
  const P = pose(ts, C.pos, viewerPos);
  applyPose(M, P);
  syncReflection();
  shadowCatcher.position.set(P.pos.x + 1.0, 0.005, P.pos.z - 1.0);    // shadows fall toward +x/−z (key light)
  shadowCatcher.visible = P.visible;
  fx.voxels(ts); fx.breakout(ts, P); fx.shards(ts); fx.playhead(ts); fx.beams(ts, P); fx.streak(ts); fx.shadow(P);
  lastPose = P;
  return { C, P };
}

/* ─── post: accumulation (motion blur) → DOF → bloom → output → grade ─── */
const QUAD_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

class AccumPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.subMS = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.subJ = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, w: { value: 1 } },
      vertexShader: QUAD_VS,
      fragmentShader: "uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv) * w; }",
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false
    }));
    this.t = 0; this.K = 1;
  }
  render(r, writeBuffer, readBuffer) {
    const K = this.K, shutter = 0.5 / FPS;
    this.sub = K <= 2 ? this.subMS : this.subJ;          // jittered sub-frames anti-alias on their own
    clearTarget(r, readBuffer, 0x000000, 0);
    for (let s = 0; s < K; s++) {
      const ts = Math.min(Math.max(this.t + (K > 1 ? ((s + 0.5) / K - 0.5) * shutter : 0), 0), J.duration - 1e-4);
      const jit = K > 1 ? [halton(s + 1, 2) - 0.5, halton(s + 1, 3) - 0.5] : null;
      apply(ts, jit);
      clearTarget(r, this.sub, 0x000000, 1);
      r.render(scene, camera);
      this.quad.material.uniforms.tex.value = this.sub.texture;
      this.quad.material.uniforms.w.value = 1 / K;
      r.setRenderTarget(readBuffer); this.quad.render(r);
    }
    apply(this.t, null);   // centre state for depth / focus
  }
}
// three's clear() does not re-enable depth writes; a preceding depthWrite:false draw
// would leave stale depth behind (frames would then depend on earlier frames).
function clearTarget(r, rt, color, alpha) {
  r.setRenderTarget(rt);
  r.setClearColor(color, alpha);
  r.state.buffers.depth.setMask(true);
  r.state.buffers.color.setMask(true);
  r.clear(true, true, true);
}
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

class DOFPass extends Pass {
  constructor() {
    super();
    this.depthRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType });
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, blending: THREE.NoBlending });
    this.blurRT = new THREE.WebGLRenderTarget(Math.ceil(W / 2), Math.ceil(H / 2), { type: THREE.HalfFloatType });
    this.blur = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, tTile: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, focusDist: { value: 5 }, cocScale: { value: 10 }, maxCoc: { value: 30 }, radScale: { value: 1.4 }, nearClip: { value: 0.05 }, farClip: { value: 220 } },
      vertexShader: QUAD_VS,
      fragmentShader: `#include <packing>
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tTile; uniform vec2 texel;
        uniform float focusDist, cocScale, maxCoc, radScale, nearClip, farClip;
        varying vec2 vUv;
        float dist(vec2 uv){ float d = unpackRGBAToDepth(texture2D(tDepth, uv)); return -perspectiveDepthToViewZ(d, nearClip, farClip); }
        float coc(float z){ return clamp(cocScale * abs(1.0 - focusDist / z), 0.0, maxCoc); }
        void main(){
          float z0 = dist(vUv); float c0 = coc(z0);
          vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0; float cOut = c0;
          float radius = radScale;
          float limit = min(maxCoc, texture2D(tTile, vUv).r + 1.0);
          for (int i = 0; i < 900; i++) {
            if (radius >= limit) break;
            float ang = float(i) * 2.39996323;
            vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
            vec3 sc = texture2D(tColor, tc).rgb;
            float sz = dist(tc); float sCoc = coc(sz);
            if (sz > z0) sCoc = clamp(sCoc, 0.0, c0 * 2.0);
            float m = smoothstep(radius - 0.5, radius + 0.5, sCoc);
            col += mix(col / tot, sc, m); tot += 1.0;
            if (sz < z0) cOut = max(cOut, sCoc * m);
            radius += radScale / radius;
          }
          gl_FragColor = vec4(col / tot, cOut);
        }`
    }));
    // tile-max CoC (1/16 res) + 3×3 dilation: each pixel gathers only as far as nearby blur reaches
    const TW = Math.ceil(W / 16), TH = Math.ceil(H / 16);
    this.tileRT = new THREE.WebGLRenderTarget(TW, TH, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.dilRT = new THREE.WebGLRenderTarget(TW, TH, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.tile = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, focusDist: { value: 5 }, cocScale: { value: 10 }, maxCoc: { value: 30 }, nearClip: { value: 0.05 }, farClip: { value: 220 } },
      vertexShader: QUAD_VS,
      fragmentShader: `#include <packing>
        uniform sampler2D tDepth; uniform vec2 texel; uniform float focusDist, cocScale, maxCoc, nearClip, farClip; varying vec2 vUv;
        float coc(vec2 uv){ float d = unpackRGBAToDepth(texture2D(tDepth, uv)); float z = -perspectiveDepthToViewZ(d, nearClip, farClip); return clamp(cocScale * abs(1.0 - focusDist / z), 0.0, maxCoc); }
        void main(){ float m = 0.0;
          for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) m = max(m, coc(vUv + (vec2(float(x), float(y)) - 2.0) * texel * 3.6));
          gl_FragColor = vec4(m); }`
    }));
    this.dil = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tTile: { value: null }, tt: { value: new THREE.Vector2(1 / TW, 1 / TH) } },
      vertexShader: QUAD_VS,
      fragmentShader: `uniform sampler2D tTile; uniform vec2 tt; varying vec2 vUv;
        void main(){ float m = 0.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) m = max(m, texture2D(tTile, vUv + vec2(float(x), float(y)) * tt).r); gl_FragColor = vec4(m); }`
    }));
    this.comp = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tBlur: { value: null } },
      vertexShader: QUAD_VS,
      fragmentShader: `uniform sampler2D tColor; uniform sampler2D tBlur; varying vec2 vUv;
        void main(){ vec4 b = texture2D(tBlur, vUv); vec3 s = texture2D(tColor, vUv).rgb;
          float w = smoothstep(0.7, 2.6, b.a); gl_FragColor = vec4(mix(s, b.rgb, w), 1.0); }`
    }));
    this.noDepth = [];
    this.enabled = true;
  }
  render(r, writeBuffer, readBuffer) {
    const hidden = this.noDepth.filter((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    scene.overrideMaterial = this.depthMat;
    clearTarget(r, this.depthRT, 0xffffff, 1);
    r.render(scene, camera);
    scene.overrideMaterial = null;
    hidden.forEach((o) => (o.visible = true));
    const u = this.blur.material.uniforms;
    u.tColor.value = readBuffer.texture; u.tDepth.value = this.depthRT.texture;
    u.nearClip.value = camera.near; u.farClip.value = camera.far;
    const tu = this.tile.material.uniforms;
    for (const k of ["focusDist", "cocScale", "maxCoc"]) tu[k].value = u[k].value;
    tu.tDepth.value = this.depthRT.texture; tu.nearClip.value = camera.near; tu.farClip.value = camera.far;
    r.setRenderTarget(this.tileRT); this.tile.render(r);
    this.dil.material.uniforms.tTile.value = this.tileRT.texture;
    r.setRenderTarget(this.dilRT); this.dil.render(r);
    u.tTile.value = this.dilRT.texture;
    r.setRenderTarget(this.blurRT); this.blur.render(r);
    this.comp.material.uniforms.tColor.value = readBuffer.texture;
    this.comp.material.uniforms.tBlur.value = this.blurRT.texture;
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.comp.render(r);
  }
}

/* explicit pipeline: dedicated targets, no ping-pong buffers */
const rtAccum = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
const rtDOF = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
const rtOut = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
const accum = new AccumPass();
const dof = new DOFPass();
dof.noDepth.push(backdrop, sheen, shadowCatcher, reflRoot);
scene.traverse((o) => { if (o.material && (o.material.blending === THREE.AdditiveBlending || o.material.transparent)) dof.noDepth.push(o); });
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.5, 1.0);
const output = new OutputPass();
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(W, H) }, seed: { value: 0 }, vignette: { value: 0.42 }, grain: { value: 0.028 }, fringe: { value: 1.6 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 res; uniform float seed, vignette, grain, fringe; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031 + seed); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 d = vUv - 0.5; float asp = res.x / res.y;
      vec2 dn = d * vec2(asp, 1.0); float r2 = dot(dn, dn);
      vec2 off = d * fringe * r2 / res * 2.0;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float v = smoothstep(1.05, 0.28, length(d * 1.35));
      col *= mix(1.0 - vignette, 1.0, v);
      col += (hash(vUv * res) - 0.5) * grain;
      gl_FragColor = vec4(col, 1.0);
    }`
});
grade.renderToScreen = true;
const gl = renderer.getContext();
const px1 = new Uint8Array(4);
// SwiftShader's finish() does not block; a 1-pixel readback of the default framebuffer does.
function sync() { renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1); }
function timed(ms, key, fn) { const t0 = performance.now(); fn(); if (PROFILE) sync(); ms[key] = Math.round(performance.now() - t0); }
function renderPipeline(ms) {
  timed(ms, "accum", () => accum.render(renderer, null, rtAccum));   // linear HDR, motion-blurred
  timed(ms, "dof", () => dof.render(renderer, rtDOF, rtAccum));       // → rtDOF
  timed(ms, "bloom", () => bloom.render(renderer, null, rtDOF));      // adds bloom into rtDOF
  timed(ms, "out", () => { output.render(renderer, rtOut, rtDOF); grade.render(renderer, null, rtOut); });
}

/* ─── motion-adaptive sample count ─── */
const probe = new THREE.Vector3();
function screenOf(pt, ts) {
  const C = camAt(ts);
  const cam = new THREE.PerspectiveCamera(C.fov, W / H, 0.05, 220);
  cam.position.copy(C.pos); cam.lookAt(C.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  probe.copy(pt).project(cam);
  return new THREE.Vector2((probe.x * 0.5 + 0.5) * W, (probe.y * -0.5 + 0.5) * H);
}
const STATIC_PTS = [[-11, 0, -6], [11, 0, -6], [-11, 0, 6], [11, 0, 6], [0, 0, 0], [-0.7, 0, -2.5], [9.5, 0, -1], [7, 0, 2]].map((a) => new THREE.Vector3(...a));
function samplesFor(t) {
  const sh = 0.5 / FPS, a = t - sh / 2, b = t + sh / 2;
  let maxPx = 0;
  const C = camAt(t);
  for (const p of STATIC_PTS) {
    const s0 = screenOf(p, a), s1 = screenOf(p, b);
    // only count points that are on screen at the centre time
    const sc = screenOf(p, t);
    if (sc.x < -W * 0.2 || sc.x > W * 1.2 || sc.y < -H * 0.2 || sc.y > H * 1.2) continue;
    maxPx = Math.max(maxPx, s0.distanceTo(s1));
  }
  const pa = pose(a, camAt(a).pos, viewerPos), pb = pose(b, camAt(b).pos, viewerPos);
  if (pa.visible && pb.visible) maxPx = Math.max(maxPx, screenOf(pa.pos, a).distanceTo(screenOf(pb.pos, b)));
  const minK = QUALITY === "final" ? 3 : 1, maxK = QUALITY === "final" ? 16 : 6;
  return { K: Math.max(minK, Math.min(maxK, Math.ceil(maxPx / 3))), px: maxPx, C };
}

/* ─── public API ─── */
function seek(frame) {
  frame = Math.max(0, Math.min(FRAMES - 1, Math.round(frame)));
  const t = frame / FPS;
  const ms = {};
  let changed;
  timed(ms, "ui", () => { const st = uiState(t, J); changed = ui.update(st); });
  changed.forEach((id) => (panelMeshes[id].tex.needsUpdate = true));
  const S = samplesFor(t);
  accum.t = t; accum.K = S.K;
  // focus + aperture at the centre time
  const C = S.C;
  const Pc = pose(t, C.pos, viewerPos);
  const fa = focusPoint(C.a.focus, C.look, Pc), fb = focusPoint(C.b.focus, C.look, Pc);
  const fd = C.pos.distanceTo(fa) * (1 - C.e) + C.pos.distanceTo(fb) * C.e;
  const u = dof.blur.material.uniforms;
  u.focusDist.value = fd;
  u.cocScale.value = C.fstop * H * 0.034;
  u.maxCoc.value = Math.min(H * 0.04, 46 * SCALE);
  u.radScale.value = QUALITY === "final" ? 1.25 : 2.2;
  grade.uniforms.seed.value = (frame * 0.618034) % 1;
  renderPipeline(ms);
  return { frame, K: S.K, motionPx: +S.px.toFixed(1), focus: +fd.toFixed(2), stages: ms, uploads: changed };
}

function info() { return { fps: FPS, frames: FRAMES, format: FORMAT, width: W, height: H }; }
function mascotAt(frame) { const t = frame / FPS; const C = camAt(t); const P = pose(t, C.pos, viewerPos); return { visible: P.visible, pos: P.pos.toArray().map((v) => +v.toFixed(3)), cam: C.pos.toArray().map((v) => +v.toFixed(3)) }; }
function framing(frame) {
  const t = frame / FPS, C = camAt(t), P = pose(t, C.pos, viewerPos);
  if (!P.visible) return { frame, visible: false };
  const c = P.pos.clone().add(new THREE.Vector3(0, 0.56 * P.sy, 0));
  const pts = [[-0.75, 0, -0.5], [0.75, 0, -0.5], [-0.75, 0, 0.5], [0.75, 0, 0.5], [-0.75, 1.15, -0.5], [0.75, 1.15, -0.5], [-0.75, 1.15, 0.5], [0.75, 1.15, 0.5]]
    .map((o) => screenOf(P.pos.clone().add(new THREE.Vector3(...o)), t));
  const xs = pts.map((p) => p.x / W), ys = pts.map((p) => p.y / H), sc = screenOf(c, t);
  return { frame, visible: true, cx: +(sc.x / W).toFixed(3), cy: +(sc.y / H).toFixed(3), x0: +Math.min(...xs).toFixed(3), x1: +Math.max(...xs).toFixed(3), y0: +Math.min(...ys).toFixed(3), y1: +Math.max(...ys).toFixed(3), dist: +C.pos.distanceTo(c).toFixed(2) };
}
// QA probe: camera, mascot and copy geometry for one frame (no rendering)
function cocAt(t, C, P, pt) {
  const fa = focusPoint(C.a.focus, C.look, P), fb = focusPoint(C.b.focus, C.look, P);
  const fd = C.pos.distanceTo(fa) * (1 - C.e) + C.pos.distanceTo(fb) * C.e;
  const z = C.pos.distanceTo(pt);
  return Math.min(C.fstop * H * 0.034 * Math.abs(1 - fd / z), Math.min(H * 0.04, 46 * SCALE));
}
const W2 = (u, v, y = 0.01) => { const w = world(u, v); return new THREE.Vector3(w.x, y, w.z); };
const COPY = {
  title: [W2(752, 404), W2(1508, 404), W2(1130, 362), W2(1130, 446)],      // MADE WITH CLAUDE extents (UI px)
  opus: [W2(1030, 526), W2(1230, 526), W2(1130, 512), W2(1130, 540)],
  glow: [W2(1762, 450), W2(1812, 450), W2(1787, 440), W2(1787, 460)],       // the typed search text
  glowRow: [W2(1782, 564), W2(1840, 564), W2(1810, 556), W2(1810, 572)]
};
function probeFrame(frame) {
  const t = frame / FPS, C = camAt(t), P = pose(t, C.pos, viewerPos);
  const out = { frame, cam: C.pos.toArray().map((v) => +v.toFixed(4)), look: C.look.toArray().map((v) => +v.toFixed(4)), fov: +C.fov.toFixed(3),
    mascot: P.visible ? P.pos.toArray().map((v) => +v.toFixed(4)) : null, copy: {} };
  for (const [k, pts] of Object.entries(COPY)) {
    const sc = pts.map((p) => screenOf(p, t));
    const cx = (sc[0].x + sc[1].x) / 2, cy = (sc[2].y + sc[3].y) / 2;
    const vis = sc.every((q) => q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H);
    out.copy[k] = { x0: +Math.min(sc[0].x, sc[1].x).toFixed(1), x1: +Math.max(sc[0].x, sc[1].x).toFixed(1), h: +Math.abs(sc[3].y - sc[2].y).toFixed(1),
      y0: +Math.min(sc[2].y, sc[3].y).toFixed(1), y1: +Math.max(sc[2].y, sc[3].y).toFixed(1), inFrame: vis, coc: +cocAt(t, C, P, pts[0].clone().lerp(pts[1], 0.5)).toFixed(2) };
  }
  out.framing = framing(frame);
  const S = samplesFor(t);
  out.K = S.K; out.motionPx = +S.px.toFixed(1);
  return out;
}
function project(frame, xyz) { const t = frame / FPS; return screenOf(new THREE.Vector3(...xyz), t).toArray(); }

window.film = { ready: Promise.resolve(info()), seek, info, mascotAt, project, framing, probeFrame };
window.__dbg = { renderer, sheen, shadowCatcher, slab, desk, key, rim, panelMeshes, M, scene, accum, dof, bloom, output, grade, rtAccum, rtDOF, rtOut };
document.documentElement.dataset.ready = "1";

if (!RENDER) {
  const bar = document.getElementById("transport");
  bar.hidden = false;
  const scrub = document.getElementById("scrub"), clock = document.getElementById("clock");
  scrub.max = FRAMES - 1;
  const show = (f) => { const r = seek(f); clock.textContent = `${(f / FPS).toFixed(2)} s · f${f} · K${r.K}`; };
  scrub.addEventListener("input", () => show(+scrub.value));
  const t0 = Number(params.get("t") || 0);
  scrub.value = Math.round(t0 * FPS); show(+scrub.value);
  document.getElementById("swap").href = `?format=${FORMAT === "16x9" ? "9x16" : "16x9"}`;
  const fit = () => { const sc = Math.min(innerWidth / W, (innerHeight - 48) / H); renderer.domElement.style.width = W * sc + "px"; renderer.domElement.style.height = H * sc + "px"; };
  fit(); addEventListener("resize", fit);
}
