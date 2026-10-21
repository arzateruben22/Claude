// The studio set every solid scene shares (render.mjs puts this right after each scene module's
// three.js import, and turns its `new THREE.BoxGeometry(` into `new SoftBox(`). After the
// reference clip: a toy photographed in a studio. Small blocks with rounded edges, a warm key
// from the side with soft real shadows, a pink fill, a warm rim from behind, a glossy warm floor
// with a pool of light that falls off into the dark, a lens that focuses on the subject and lets
// the background go soft, a little glow on the highlights, a vignette and a warm grade.
// Everything stays a pure function of time: the drift reads M.t, which M.stage(t) sets.

// a box with rounded edges, kept as light as a plain box: 24 shared corners (each face's own
// four, with the face's normal), the six faces, twelve bevel strips between neighbouring faces
// and eight corner triangles. The strips interpolate between the two faces' normals, so the
// bevel shades round and catches the key light along every edge.
function SoftBox(w = 1, h = 1, d = 1) {
  const r = Math.min(w, h, d) * 0.2, H = [w / 2, h / 2, d / 2], I = H.map((v) => v - r);
  const pos = [], nor = [], idx = [], key = {};
  const vert = (a, s, signs) => {        // face on axis a with sign s; signs = the corner's signs on all three axes
    const k = a + "" + s + signs.join("");
    if (key[k] !== undefined) return key[k];
    const p = [0, 1, 2].map((ax) => ax === a ? s * H[ax] : signs[ax] * I[ax]), n = [0, 0, 0]; n[a] = s;
    key[k] = pos.length / 3; pos.push(...p); nor.push(...n); return key[k];
  };
  const tri = (i0, i1, i2) => {           // wound outward: the box is convex and centered
    const P = (i) => pos.slice(i * 3, i * 3 + 3);
    const [a, b, c] = [P(i0), P(i1), P(i2)], u = b.map((v, k) => v - a[k]), v = c.map((x, k) => x - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = a.map((x, k) => x + b[k] + c[k]);
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) idx.push(i0, i2, i1); else idx.push(i0, i1, i2);
  };
  const quad = (q) => { tri(q[0], q[1], q[2]); tri(q[0], q[2], q[3]); };
  const S = [-1, 1];
  for (let a = 0; a < 3; a++) for (const s of S) {       // the faces
    const [b, c] = [0, 1, 2].filter((x) => x !== a), at = (sb, sc) => { const g = [0, 0, 0]; g[a] = s; g[b] = sb; g[c] = sc; return vert(a, s, g); };
    quad([at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)]);
  }
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) for (const sa of S) for (const sb of S) {   // the bevel strips
    const c = 3 - a - b, g = (sc) => { const x = [0, 0, 0]; x[a] = sa; x[b] = sb; x[c] = sc; return x; };
    quad([vert(a, sa, g(-1)), vert(a, sa, g(1)), vert(b, sb, g(1)), vert(b, sb, g(-1))]);
  }
  for (const sx of S) for (const sy of S) for (const sz of S) {   // the corners
    const g = [sx, sy, sz]; tri(vert(0, sx, g), vert(1, sy, g), vert(2, sz, g));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  geo.setIndex(idx); geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

// dress the set once, on the first render: the floor, the lights, the room, the lens
const STUDIO = { dressed: false, busy: false, center: new THREE.Vector3(), radius: 10, dist: 30, height: 10, side: 1, key: null, keyOff: new THREE.Vector3(), focus: new THREE.Vector3(), hasFocus: false, post: null };
// the knobs (window.STUDIO_OPTS overrides them, for tuning from a harness; the clips use the defaults)
const OPT = Object.assign({ shadow: "vsm", samples: 4, dof: 1, glow: 0.35, vignette: 0.4, maxR: 6.5, drift: 1, ao: 1.0, debug: 0 }, window.STUDIO_OPTS || {});

// the camera: the lens focuses where it looks, and it never quite stops. Every lookAt a camera
// makes records the focus point, then moves the camera a little around the scene's own placement
// (a slow push in over the clip, a small sway) and looks again, so the labels a scene projects
// right after see the same camera the frame is drawn with.
{
  const _lookAt = THREE.Object3D.prototype.lookAt;
  const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
  THREE.Object3D.prototype.lookAt = function (x, y, z) {
    if (!this.isCamera) return _lookAt.call(this, x, y, z);
    if (x && x.isVector3) STUDIO.focus.copy(x); else STUDIO.focus.set(x, y, z);
    STUDIO.hasFocus = true;
    _lookAt.call(this, STUDIO.focus);
    if (OPT.drift && !window.CINEMA_FOCUS) {   // a directed scene keys its own camera
      const t = (window.M && window.M.t) || 0, dur = (window.SCENE && window.SCENE.dur) || 20, d = this.position.distanceTo(STUDIO.focus);
      this.updateMatrix(); this.matrix.extractBasis(ax, ay, az);
      this.position.addScaledVector(ax, Math.sin(t * 0.37) * d * 0.016)
        .addScaledVector(ay, Math.sin(t * 0.29 + 1.3) * d * 0.009)
        .addScaledVector(az, -Math.min(1, t / dur) * d * 0.035);
      _lookAt.call(this, STUDIO.focus);
    }
    this.updateMatrixWorld(true);
    return this;
  };
}

// her floor: warm brown with a gloss that catches the rim light behind the subject, a pool of light under the set, and
// an edge that fades out into the page instead of ending at a horizon line
function floorMaterial(fade) {
  const m = new THREE.MeshStandardMaterial({ color: 0x4a3128, roughness: 0.45, metalness: 0.0, transparent: true });
  m.fog = false;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uC = { value: new THREE.Vector2(STUDIO.center.x, STUDIO.center.z) };
    sh.uniforms.uR = { value: Math.max(12, STUDIO.radius * 1.6) };
    sh.uniforms.uNear = { value: fade.near }; sh.uniforms.uFar = { value: fade.far };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying float vVd;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvVd = -mvPosition.z;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;\nvarying float vVd;\nuniform vec2 uC;\nuniform float uR, uNear, uFar;")
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.rgb *= mix(1.3, 0.4, smoothstep(0.0, uR, distance(vWp.xz, uC)));\ngl_FragColor.a *= 1.0 - smoothstep(uNear, uFar, vVd);");
  };
  return m;
}

function dressSet(renderer, scene, camera) {
  STUDIO.dressed = true;
  const box = new THREE.Box3(), part = new THREE.Box3();
  const isFloor = (o) => o.isMesh && o.geometry && o.geometry.type === "PlaneGeometry" && Math.abs(o.rotation.x + Math.PI / 2) < 1e-3 && (o.geometry.parameters.width || 0) >= 100;
  let floorY = null; const floors = [];
  scene.traverse((o) => {
    if (isFloor(o)) { floorY = o.position.y; floors.push(o); return; }
    if (o.isMesh && o.visible) { part.setFromObject(o); if (!part.isEmpty() && isFinite(part.min.x)) box.union(part); }
  });
  if (box.isEmpty()) box.set(new THREE.Vector3(-8, 0, -5), new THREE.Vector3(8, 12, 5));
  box.getCenter(STUDIO.center);
  const size = box.getSize(new THREE.Vector3());
  STUDIO.radius = Math.max(4, Math.min(40, Math.hypot(size.x, size.z) / 2));
  STUDIO.height = Math.max(2, Math.min(30, size.y));
  STUDIO.dist = Math.max(6, camera.position.distanceTo(STUDIO.center));
  // where the floor fades out: from just behind the set, so the floor is a lit table under the
  // subject and the room's glow shows behind it, never a horizon line
  const fade = { near: STUDIO.dist * 1.3, far: STUDIO.dist * 3.2 };
  if (scene.fog) { fade.near = scene.fog.far * 0.5; fade.far = scene.fog.far * 1.3; }   // the floor goes after the fogged set does
  if (scene.fog) scene.fog.color = new THREE.Color(0x0b0807);
  if (floorY === null) {
    // a scene without a floor gets one, just under its lowest block
    const f = new THREE.Mesh(new THREE.PlaneGeometry(400, 400)); f.rotation.x = -Math.PI / 2; f.position.y = box.min.y - 0.02; scene.add(f); floors.push(f);
  }
  // the floor reaches well past the fade, so its edge never shows as a horizon
  floors.forEach((f) => { f.material = floorMaterial(fade); f.receiveShadow = true; f.scale.setScalar(Math.max(1, (fade.far * 2 + STUDIO.dist) / ((f.geometry.parameters.width || 200) / 2))); });
  // the lights: the scene's key (the one that casts) moves lower and to the side, warm, like a
  // lamp beside the table; its fill goes low on the other side; a warm rim comes from behind
  const c = STUDIO.center, d = STUDIO.dist;
  let key = null; const fills = [];
  scene.traverse((o) => { if (o.isDirectionalLight) { if (o.castShadow && !key) key = o; else fills.push(o); } else if (o.isHemisphereLight) o.intensity *= 0.75; });
  const side = key ? (Math.sign(key.position.x - c.x) || 1) : 1;
  STUDIO.side = side;
  if (key) {
    const half = Math.max(12, Math.min(24, STUDIO.radius * 1.3 + STUDIO.height * 0.5));
    STUDIO.keyOff.set(side * 0.85, 0.62, 0.5).normalize().multiplyScalar(half * 2.2);
    key.color.set(0xffd6ae); key.intensity = Math.max(2.0, key.intensity) * 1.3;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 0.5; sc.far = half * 5; sc.updateProjectionMatrix();
    key.shadow.radius = 5; key.shadow.blurSamples = 8; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.03;
    if (!key.target.parent) scene.add(key.target);
    STUDIO.key = key;
  }
  fills.forEach((f) => { f.position.set(c.x - side * d * 0.9, c.y + d * 0.2, c.z + d * 0.55); f.intensity = 0.4; f.color.lerp(new THREE.Color(0xd6c4f0), 0.3); });
  renderer.shadowMap.type = OPT.shadow === "vsm" ? THREE.VSMShadowMap : THREE.PCFSoftShadowMap;
  const rim = new THREE.DirectionalLight(0xffc9a0, 0.9);
  rim.position.set(c.x - side * d * 0.4, c.y + d * 0.55, c.z - d * 0.9);
  rim.target.position.copy(c); scene.add(rim); scene.add(rim.target);
}

// the lens and the print: the scene renders into a texture with depth; a half-size copy is
// blurred by how far each pixel sits from the focus plane (a gather with a disc of taps, each
// weighted by its own blur so a sharp subject never bleeds into the soft background); the
// bright parts of the soft copy make a quarter-size glow; the last pass mixes sharp and soft by
// the pixel's blur, adds the glow, tone maps (ACES, as before), grades warm and vignettes.
// Color stays premultiplied the whole way, so the floor's fade and the empty backdrop composite
// over the page exactly as they did.
const TAPS = (() => { const t = []; [[8, 0.5], [16, 1.0]].forEach(([n, r], k) => { for (let j = 0; j < n; j++) { const a = (Math.PI * 2 * j) / n + k * 0.39; t.push(`vec2(${(Math.cos(a) * r).toFixed(4)}, ${(Math.sin(a) * r).toFixed(4)})`); } }); return t; })();
const VS = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const COC = `
#include <packing>
uniform sampler2D tDepth; uniform float uNear, uFar, uFocus, uRange, uBack, uFront;
float cocAt(vec2 uv) {
  float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar);
  float x = z - uFocus;
  float c = x > 0.0 ? (x - uRange) / uBack : (-x - uRange) / uFront;
  return clamp(c, 0.0, 1.0);
}`;
// ambient occlusion from the depth alone, at half size: a view-space normal from the nearest
// depth neighbours, ten taps in a disc around the pixel (the disc turns by a hash of the pixel,
// never by time), each tap occluding by how far it rises above the tangent plane
const FS_AO = `
#include <packing>
varying vec2 vUv; uniform sampler2D tDepth; uniform float uNear, uFar, uRadius, uStrength, uFocus; uniform vec2 uTexel, uTexel2, uProj;
vec3 posAt(vec2 uv) { float z = -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); return vec3((uv * 2.0 - 1.0) * uProj * z, -z); }
void main() {
  vec2 uv0 = vUv + 0.5 * uTexel;   // a half-size pixel sits on a boundary between depth texels: step onto a centre
  vec3 p = posAt(uv0);
  if (-p.z > uFar * 0.9) { gl_FragColor = vec4(1.0); return; }
  vec3 pr = posAt(uv0 + vec2(uTexel.x, 0.0)), pl = posAt(uv0 - vec2(uTexel.x, 0.0)), pu = posAt(uv0 + vec2(0.0, uTexel.y)), pd = posAt(uv0 - vec2(0.0, uTexel.y));
  vec3 dx = length(pr - p) < length(p - pl) ? pr - p : p - pl, dy = length(pu - p) < length(p - pd) ? pu - p : p - pd;
  vec3 n = normalize(cross(dx, dy));
  vec2 px = floor(vUv / uTexel2); float h = fract(0.5 + px.x * 0.7548776662 + px.y * 0.5698402909);   // the R2 sequence: a quasi-random turn per pixel, no rows
  float ao = 0.0;
  for (int i = 0; i < 10; i++) {
    float a = 6.2832 * (float(i) + h) / 10.0, r = uRadius * (0.25 + 0.75 * fract(h * 7.31 + float(i) * 0.618));
    vec3 q = posAt(uv0 + vec2(cos(a), sin(a)) * (r / -p.z) / uProj * 0.5);
    vec3 v = q - p; float d = max(length(v), 1e-4);
    ao += max(0.0, dot(n, v) / d - 0.22) * (1.0 - smoothstep(0.0, uRadius * 1.8, d));
  }
  float reach = 1.0 - smoothstep(uFocus * 1.15, uFocus * 2.0, -p.z);   // the occlusion matters around the subject; farther back the lens has gone soft anyway
  gl_FragColor = vec4(vec3(clamp(1.0 - ao / 10.0 * uStrength * 2.2 * reach, 0.0, 1.0)), 1.0);
}`;
const AO_READ = `
uniform sampler2D tAO; uniform vec2 uTexel2;
float aoAt(vec2 uv) { vec2 o = uTexel2 * 0.75; return 0.25 * (texture2D(tAO, uv + o).x + texture2D(tAO, uv - o).x + texture2D(tAO, uv + vec2(o.x, -o.y)).x + texture2D(tAO, uv - vec2(o.x, -o.y)).x); }`;
const FS_DOWN = `${AO_READ}
varying vec2 vUv; uniform sampler2D tScene;
void main() { vec4 c = texture2D(tScene, vUv); gl_FragColor = vec4(c.rgb * aoAt(vUv), c.a); }`;
const FS_BLUR = `${COC}
varying vec2 vUv; uniform sampler2D tHalf; uniform vec2 uTexel2; uniform float uMaxR;
const vec2 TAPS[24] = vec2[24](${TAPS.join(", ")});
void main() {
  float c0 = cocAt(vUv), r0 = c0 * uMaxR;
  vec4 acc = texture2D(tHalf, vUv); float wsum = 1.0;
  if (r0 > 0.25) {
    for (int i = 0; i < 24; i++) {
      vec2 o = TAPS[i] * r0, uv = vUv + o * uTexel2;
      float w = clamp(1.0 + cocAt(uv) * uMaxR + 0.5 - length(o), 0.0, 1.0);
      acc += texture2D(tHalf, uv) * w; wsum += w;
    }
  }
  gl_FragColor = acc / wsum;
}`;
const FS_GLOW = `
varying vec2 vUv; uniform sampler2D tBlur; uniform vec2 uTexel4; uniform float uThr;
const vec2 TAPS[24] = vec2[24](${TAPS.join(", ")});
void main() {
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 24; i++) {
    vec4 s = texture2D(tBlur, vUv + TAPS[i] * 7.0 * uTexel4);
    float a = max(s.a, 1e-4); float l = dot(s.rgb / a, vec3(0.3, 0.5, 0.2));
    float k = max(l - uThr, 0.0) / max(l, 1e-4);
    acc += s * k;
  }
  gl_FragColor = acc / 24.0;
}`;
const FS_FINAL = `${COC}${AO_READ}
varying vec2 vUv; uniform sampler2D tScene, tBlur, tGlow; uniform float uGlow, uExposure, uVig, uDebug; uniform vec2 uAspect;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 IN = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 OUT = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  return clamp(OUT * RRTAndODTFit(IN * (c / 0.6)), 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  if (uDebug > 0.5) { gl_FragColor = uDebug < 1.5 ? vec4(vec3(aoAt(vUv)), 1.0) : vec4(vec3(cocAt(vUv)), 1.0); return; }
  vec4 s = texture2D(tScene, vUv), b = texture2D(tBlur, vUv);
  s.rgb *= aoAt(vUv);
  vec4 col = mix(s, b, smoothstep(0.06, 0.45, cocAt(vUv)));
  vec4 g = texture2D(tGlow, vUv) * uGlow;
  col.rgb += g.rgb; col.a = clamp(col.a + g.a * (1.0 - col.a), 0.0, 1.0);
  float v = uVig * smoothstep(0.5, 1.35, length((vUv - 0.5) * uAspect * 2.0));
  col.rgb *= 1.0 - v; col.a = col.a + v * (1.0 - col.a);
  vec3 c = aces(col.rgb / max(col.a, 1e-4) * uExposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.08) + vec3(0.022, 0.013, 0.009) * (1.0 - l);
  gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)) * col.a, col.a);
}`;
function makePost(renderer) {
  const W = renderer.domElement.width, H = renderer.domElement.height, w2 = Math.ceil(W / 2), h2 = Math.ceil(H / 2), w4 = Math.ceil(W / 4), h4 = Math.ceil(H / 4);
  const hdr = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
  const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const opts = { type, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false };
  const depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
  const rtScene = new THREE.WebGLRenderTarget(W, H, { ...opts, depthBuffer: true, depthTexture, samples: OPT.samples });
  const rtHalf = new THREE.WebGLRenderTarget(w2, h2, opts), rtBlur = new THREE.WebGLRenderTarget(w2, h2, opts), rtGlow = new THREE.WebGLRenderTarget(w4, h4, opts);
  const rtAO = new THREE.WebGLRenderTarget(w2, h2, { ...opts, type: THREE.UnsignedByteType });
  const u = { tDepth: { value: depthTexture }, uNear: { value: 0.1 }, uFar: { value: 200 }, uFocus: { value: 30 }, uRange: { value: 4 }, uBack: { value: 20 }, uFront: { value: 10 }, tAO: { value: rtAO.texture }, uTexel2: { value: new THREE.Vector2(1 / w2, 1 / h2) }, uProj: { value: new THREE.Vector2(1, 1) } };
  const mat = (fs, extra) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: { ...u, ...extra }, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false });
  const ao = mat(FS_AO, { uTexel: { value: new THREE.Vector2(1 / W, 1 / H) }, uRadius: { value: 0.9 }, uStrength: { value: OPT.ao } });
  const copy = mat(FS_DOWN, { tScene: { value: rtScene.texture } });
  const blur = mat(FS_BLUR, { tHalf: { value: rtHalf.texture }, uMaxR: { value: OPT.maxR * Math.min(W, H) / 720 } });
  const glow = mat(FS_GLOW, { tBlur: { value: rtBlur.texture }, uTexel4: { value: new THREE.Vector2(1 / w4, 1 / h4) }, uThr: { value: hdr ? 0.85 : 0.7 } });
  const final = mat(FS_FINAL, { tScene: { value: rtScene.texture }, tBlur: { value: OPT.dof ? rtBlur.texture : rtScene.texture }, tGlow: { value: rtGlow.texture }, uGlow: { value: OPT.glow }, uExposure: { value: renderer.toneMappingExposure || 1 }, uVig: { value: OPT.vignette }, uDebug: { value: OPT.debug || 0 }, uAspect: { value: new THREE.Vector2(W >= H ? W / H : 1, W >= H ? 1 : H / W) } });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copy);
  mesh.frustumCulled = false; quad.add(mesh);
  return { rtScene, rtHalf, rtBlur, rtGlow, rtAO, u, ao, copy, blur, glow, final, cam, quad, mesh };
}

// a label a scene pins to a point of the set can land past the frame's edge once the camera has
// moved; before the frame is drawn, every pinned label is nudged back inside the frame
const keepLabelsIn = (W, H) => {
  const m = 6;
  for (const el of document.querySelectorAll(".lab3")) {
    if (!el.style.left) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    let dx = 0, dy = 0;
    if (r.left < m) dx = m - r.left; else if (r.right > W - m) dx = W - m - r.right;
    if (r.top < m) dy = m - r.top; else if (r.bottom > H - m) dy = H - m - r.bottom;
    if (dx) el.style.left = (parseFloat(el.style.left) + dx) + "px";
    if (dy) el.style.top = (parseFloat(el.style.top) + dy) + "px";
  }
};

// every render: the camera's slow push in and small sway, the key riding along with the focus
// point (so the shadow map stays sharp where the eye is), then the lens and the print.
// three.js gives each renderer its own render() in the constructor (not on the prototype), so
// the hook is an accessor on the prototype: the constructor's assignment lands in the setter,
// which keeps the original, and the getter hands back the studio's version.
{
  const pass = (renderer, orig, P, material, target) => { P.mesh.material = material; renderer.setRenderTarget(target); orig.call(renderer, P.quad, P.cam); };
  const studioRender = function (renderer, orig, scene, camera) {
    if (STUDIO.busy || !scene.isScene || !camera.isPerspectiveCamera || renderer.getRenderTarget() !== null) return orig.call(renderer, scene, camera);
    STUDIO.busy = true;
    try {
      if (!STUDIO.dressed) dressSet(renderer, scene, camera);
      // a directed scene racks focus itself (window.CINEMA_FOCUS(t): a point and an f-stop); otherwise the lens focuses where the camera looks
      const cf = window.CINEMA_FOCUS ? window.CINEMA_FOCUS((window.M && window.M.t) || 0) : null;
      const focus = cf ? cf.point : STUDIO.hasFocus ? STUDIO.focus : STUDIO.center;
      if (STUDIO.key) { STUDIO.key.position.copy(focus).add(STUDIO.keyOff); STUDIO.key.target.position.copy(focus); STUDIO.key.target.updateMatrixWorld(); }
      const P = STUDIO.post || (STUDIO.post = makePost(renderer));
      keepLabelsIn(renderer.domElement.width, renderer.domElement.height);
      const fd = camera.position.distanceTo(focus);
      P.u.uNear.value = camera.near; P.u.uFar.value = camera.far; P.u.uFocus.value = fd; P.u.uRange.value = fd * 0.16 * (cf ? cf.fstop / 0.45 : 1); P.u.uBack.value = fd * 0.6; P.u.uFront.value = fd * 0.3;
      P.u.uProj.value.set(1 / camera.projectionMatrix.elements[0], 1 / camera.projectionMatrix.elements[5]);
      P.ao.uniforms.uRadius.value = Math.max(0.5, Math.min(1.2, STUDIO.radius * 0.09));
      renderer.setRenderTarget(P.rtScene);
      orig.call(renderer, scene, camera);
      pass(renderer, orig, P, P.ao, P.rtAO);
      pass(renderer, orig, P, P.copy, P.rtHalf);
      if (OPT.dof) pass(renderer, orig, P, P.blur, P.rtBlur);
      if (OPT.glow) pass(renderer, orig, P, P.glow, P.rtGlow);
      pass(renderer, orig, P, P.final, null);
    } finally { STUDIO.busy = false; }
  };
  Object.defineProperty(THREE.WebGLRenderer.prototype, "render", {
    configurable: true,
    set(fn) { Object.defineProperty(this, "__render", { value: fn, configurable: true, writable: true }); },
    get() { const self = this, orig = this.__render; if (!orig) return undefined; return this.__studioRender || (this.__studioRender = function (scene, camera) { return studioRender(self, orig, scene, camera); }); }
  });
}
