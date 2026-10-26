// cinema3d.js — the studio's film finish (kits/cinema), one file, three.js r160+ core only.
// Paste or inject it right after a scene module's three.js import (it needs THREE in scope and
// window.seek(t), the scene's own pure function of time, which ends in renderer.render(scene, camera)),
// and build that scene's renderer through cinemaRenderer() instead of new THREE.WebGLRenderer().
// kits/cinema/README.md has the full contract; films/skin-school-pilot shows an adoption.
//
// A frame becomes a short exposure instead of one sharp instant:
//   1. probe   the scene is sought at both ends of a 180° shutter; how far things move on screen
//              decides how many sub-frames the exposure needs (K)
//   2. accum   the scene is sought at K moments across the shutter, each drawn with a sub-pixel
//              jitter into a float target and averaged: real motion blur, and anti-aliasing for free
//   3. depth   the scene is sought at the frame's own moment once more (this also leaves any DOM
//              labels and captions where they belong) and its depth is drawn
//   4. post    a bokeh depth of field focused where the scene says (window.CINEMA_FOCUS), bloom on
//              whatever is brighter than white, then ACES and sRGB into the scene's canvas
// Everything is still a pure function of t: K, the jitter and the focus all come from it.
// window.cinemaFrame(t) does all four; the frame loop calls it instead of seek when it exists.
// Plain window.seek(t) still draws the scene unfinished (CINEMA.mode "direct"), for previews and audits.
const CINEMA = (window.CINEMA = {
  mode: "direct", fps: 30, shutter: 0.5, kMin: 2, kMax: 32, pxPerSample: 3.5,
  fstop: 0.45, bloom: 0.6, threshold: 0.85, maxCoc: 0.032, probe: new Map(), K: 1, s: 0, last: null
});
// three r160 assigns render() on each renderer instance (in its constructor), so a patch on
// WebGLRenderer.prototype.render never runs (a set-dressing patch written that way was found
// missing from every rendered clip). The finish therefore attaches to the instance:
// the frame engine rewrites `new THREE.WebGLRenderer(` to `cinemaRenderer(` in the scene source.
{
  const _render = function (scene, camera) { return this.__baseRender(scene, camera); };
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const pass = (r, mat, target) => { quad.material = mat; r.setRenderTarget(target); _render.call(r, quadScene, quadCam); };
  const shader = (fs, uniforms, extra) => new THREE.ShaderMaterial(Object.assign({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending }, extra || {}));
  let T = null;                                            // targets + materials, built on first use (size from the canvas)
  const build = (r) => {
    const size = r.getDrawingBufferSize(new THREE.Vector2()), W = size.x, H = size.y;
    const rt = (w, h, o) => new THREE.WebGLRenderTarget(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)), Object.assign({ type: THREE.HalfFloatType, depthBuffer: false }, o || {}));
    const near = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    T = { r, W, H,
      subMS: rt(W, H, { depthBuffer: true, samples: 4 }), sub: rt(W, H, { depthBuffer: true }),
      accum: rt(W, H), depth: rt(W, H, { type: THREE.UnsignedByteType, depthBuffer: true }),
      tile: rt(W / 16, H / 16, near), dil: rt(W / 16, H / 16, near), blur: rt(W / 2, H / 2), dof: rt(W, H),
      down: [2, 4, 8, 16, 32].map((d) => rt(W / d, H / d)), up: [2, 4, 8, 16].map((d) => rt(W / d, H / d)) };
    T.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, blending: THREE.NoBlending });
    T.add = shader("uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ vec4 c = texture2D(tex, vUv); gl_FragColor = vec4(min(c.rgb, vec3(16.0)), c.a) * w; }",
      { tex: { value: null }, w: { value: 1 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    const DEPTH = `#include <packing>
      uniform sampler2D tDepth; uniform float focusDist, cocScale, maxCoc, nearClip, farClip;
      float dist(vec2 uv){ float d = unpackRGBAToDepth(texture2D(tDepth, uv)); return -perspectiveDepthToViewZ(d, nearClip, farClip); }
      float coc(float z){ return clamp(cocScale * abs(1.0 - focusDist / z), 0.0, maxCoc); }`;
    const dofU = () => ({ tDepth: { value: null }, focusDist: { value: 10 }, cocScale: { value: 10 }, maxCoc: { value: 20 }, nearClip: { value: 0.1 }, farClip: { value: 200 } });
    // tile-max CoC at 1/16 size, dilated 3×3: each pixel gathers only as far as nearby blur reaches
    T.tileMat = shader(DEPTH + `uniform vec2 texel; varying vec2 vUv;
      void main(){ float m = 0.0; for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) m = max(m, coc(dist(vUv + (vec2(float(x), float(y)) - 2.0) * texel * 3.6))); gl_FragColor = vec4(m); }`,
      Object.assign(dofU(), { texel: { value: new THREE.Vector2(1 / W, 1 / H) } }));
    T.dilMat = shader(`uniform sampler2D tTile; uniform vec2 tt; varying vec2 vUv;
      void main(){ float m = 0.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) m = max(m, texture2D(tTile, vUv + vec2(float(x), float(y)) * tt).r); gl_FragColor = vec4(m); }`,
      { tTile: { value: null }, tt: { value: new THREE.Vector2(16 / W, 16 / H) } });
    // scatter-as-gather bokeh on a golden-angle spiral; premultiplied RGBA, so edges against the page stay clean
    T.blurMat = shader(DEPTH + `uniform sampler2D tColor; uniform sampler2D tTile; uniform vec2 texel; uniform float radScale; varying vec2 vUv;
      void main(){
        float z0 = dist(vUv), c0 = coc(z0);
        vec4 col = texture2D(tColor, vUv); float tot = 1.0, radius = radScale;
        float limit = min(maxCoc, texture2D(tTile, vUv).r + 1.0);
        for (int i = 0; i < 700; i++) {
          if (radius >= limit) break;
          float ang = float(i) * 2.39996323;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
          vec4 sc = texture2D(tColor, tc); float sz = dist(tc), sCoc = coc(sz);
          if (sz > z0) sCoc = clamp(sCoc, 0.0, c0 * 2.0);
          float m = smoothstep(radius - 0.5, radius + 0.5, sCoc);
          col += mix(col / tot, sc, m); tot += 1.0;
          radius += radScale / radius;
        }
        gl_FragColor = col / tot;
      }`, Object.assign(dofU(), { tColor: { value: null }, tTile: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, radScale: { value: 1.25 } }));
    T.compMat = shader(DEPTH + `uniform sampler2D tColor; uniform sampler2D tBlur; varying vec2 vUv;
      void main(){ vec4 s = texture2D(tColor, vUv), b = texture2D(tBlur, vUv);
        float w = smoothstep(0.7, 2.6, coc(dist(vUv)));
        gl_FragColor = mix(s, b, w); }`, Object.assign(dofU(), { tColor: { value: null }, tBlur: { value: null } }));
    // bloom: a soft-knee bright pass, then a dual-filter pyramid (down 5, up 4)
    T.brightMat = shader(`uniform sampler2D tex; uniform float threshold; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = max(c.r, max(c.g, c.b));
        float k = clamp(l - threshold + 0.25, 0.0, 0.5); k = k * k / 1.0; float w = max(k, l - threshold) / max(l, 1e-4);
        gl_FragColor = vec4(c * w, 1.0); }`, { tex: { value: null }, threshold: { value: 1 } });
    T.downMat = shader(`uniform sampler2D tex; uniform vec2 hp; varying vec2 vUv;
      void main(){ vec3 s = texture2D(tex, vUv).rgb * 4.0;
        s += texture2D(tex, vUv - hp).rgb + texture2D(tex, vUv + hp).rgb + texture2D(tex, vUv + vec2(hp.x, -hp.y)).rgb + texture2D(tex, vUv - vec2(hp.x, -hp.y)).rgb;
        gl_FragColor = vec4(s / 8.0, 1.0); }`, { tex: { value: null }, hp: { value: new THREE.Vector2() } });
    T.upMat = shader(`uniform sampler2D tex; uniform sampler2D base; uniform vec2 hp; varying vec2 vUv;
      void main(){ vec3 s = texture2D(tex, vUv + vec2(-hp.x * 2.0, 0.0)).rgb + texture2D(tex, vUv + vec2(hp.x * 2.0, 0.0)).rgb
          + texture2D(tex, vUv + vec2(0.0, hp.y * 2.0)).rgb + texture2D(tex, vUv + vec2(0.0, -hp.y * 2.0)).rgb;
        s += (texture2D(tex, vUv + hp).rgb + texture2D(tex, vUv - hp).rgb + texture2D(tex, vUv + vec2(hp.x, -hp.y)).rgb + texture2D(tex, vUv - vec2(hp.x, -hp.y)).rgb) * 2.0;
        gl_FragColor = vec4(s / 12.0 + texture2D(base, vUv).rgb, 1.0); }`, { tex: { value: null }, base: { value: null }, hp: { value: new THREE.Vector2() } });
    // finish: bloom added in linear light, ACES (the same curve three uses), sRGB; stays premultiplied for the page behind
    T.outMat = shader(`uniform sampler2D tColor; uniform sampler2D tBloom; uniform float bloom, exposure; varying vec2 vUv;
      vec3 cinRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 cinAces(vec3 c){
        const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c *= exposure / 0.6; c = OUT * cinRRT(IN * c); return clamp(c, 0.0, 1.0); }
      vec3 cinSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec4 c = texture2D(tColor, vUv); vec3 b = texture2D(tBloom, vUv).rgb * bloom;
        float a = clamp(c.a, 0.0, 1.0);
        vec3 lit = a > 0.02 ? cinAces(c.rgb / a + b / max(a, 0.35)) * a : cinAces(c.rgb + b);
        vec3 o = cinSrgb(lit);
        gl_FragColor = vec4(o, clamp(max(a, max(o.r, max(o.g, o.b))), 0.0, 1.0)); }`,
      { tColor: { value: null }, tBloom: { value: null }, bloom: { value: 0.6 }, exposure: { value: 1 } });
    return T;
  };
  const clear = (r, target) => {
    r.setRenderTarget(target);
    r.state.buffers.depth.setMask(true); r.state.buffers.color.setMask(true);
    r.setClearColor(0x000000, 0); r.clear(true, true, true);
  };
  const v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const probe = (scene, camera, out) => {                  // screen positions of what can move
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    const push = (key) => { v.project(camera); out.set(key, [(v.x + 1) * 0.5 * T.W, (1 - v.y) * 0.5 * T.H]); };
    scene.traverseVisible((o) => {
      if (!o.isMesh) return;
      if (o.isInstancedMesh) { const n = o.count, step = Math.max(1, Math.floor(n / 48)); for (let i = 0; i < n; i += step) { o.getMatrixAt(i, m4); v.setFromMatrixPosition(m4.premultiply(o.matrixWorld)); push(o.id + ":" + i); } }
      else { v.setFromMatrixPosition(o.matrixWorld); push(o.id); }
    });
    for (const [x, y] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9], [0, 0]]) {   // the camera itself: points at mid depth
      v.set(x, y, 0.5).unproject(camera); push("cam" + x + "," + y);
    }
  };
  const cinemaRender = function (scene, camera) {
    if (CINEMA.mode === "direct" || !scene.isScene || !camera.isPerspectiveCamera) return _render.call(this, scene, camera);
    if (!T) build(this);
    const r = this, autoClear = r.autoClear, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    if (CINEMA.mode === "probe") { probe(scene, camera, CINEMA.probe); return; }
    r.autoClear = false;
    if (CINEMA.mode === "accum") {
      const K = CINEMA.K, tgt = K <= 2 ? T.subMS : T.sub;
      if (K > 2) camera.setViewOffset(T.W, T.H, halton(CINEMA.s + 1, 2) - 0.5, halton(CINEMA.s + 1, 3) - 0.5, T.W, T.H);
      clear(r, tgt); _render.call(r, scene, camera);
      camera.clearViewOffset();
      T.add.uniforms.tex.value = tgt.texture; T.add.uniforms.w.value = 1 / K;
      pass(r, T.add, T.accum);
    } else if (CINEMA.mode === "depth") {
      // depth at the frame's moment, then the whole finish
      scene.overrideMaterial = T.depthMat;
      r.setRenderTarget(T.depth); r.setClearColor(0xffffff, 1); r.state.buffers.depth.setMask(true); r.clear(true, true, true);
      _render.call(r, scene, camera);
      scene.overrideMaterial = null;
      const F = (window.CINEMA_FOCUS && window.CINEMA_FOCUS(window.M ? window.M.t : 0)) || {};
      // no focus from the scene: where the camera looks (a camera that travels keeps its subject sharp), else the set's middle
      const fp = F.point ? (F.point.isVector3 ? F.point : v.set(F.point[0], F.point[1], F.point[2]))
        : typeof STUDIO === "undefined" ? v.set(0, 0, 0) : STUDIO.hasFocus ? STUDIO.focus : STUDIO.center;
      const focusDist = Math.max(0.5, camera.position.distanceTo(fp));
      const fstop = F.fstop == null ? CINEMA.fstop : F.fstop;
      const U = { focusDist, cocScale: fstop * (CINEMA.dofScale == null ? 1 : CINEMA.dofScale) * T.H * 0.034, maxCoc: T.H * CINEMA.maxCoc, nearClip: camera.near, farClip: camera.far };
      for (const mat of [T.tileMat, T.blurMat, T.compMat]) { for (const k in U) mat.uniforms[k].value = U[k]; mat.uniforms.tDepth.value = T.depth.texture; }
      pass(r, T.tileMat, T.tile);
      T.dilMat.uniforms.tTile.value = T.tile.texture; pass(r, T.dilMat, T.dil);
      T.blurMat.uniforms.tColor.value = T.accum.texture; T.blurMat.uniforms.tTile.value = T.dil.texture;
      pass(r, T.blurMat, T.blur);
      T.compMat.uniforms.tColor.value = T.accum.texture; T.compMat.uniforms.tBlur.value = T.blur.texture;
      pass(r, T.compMat, T.dof);
      T.brightMat.uniforms.tex.value = T.dof.texture; T.brightMat.uniforms.threshold.value = CINEMA.threshold;
      pass(r, T.brightMat, T.down[0]);
      for (let i = 1; i < T.down.length; i++) {
        T.downMat.uniforms.tex.value = T.down[i - 1].texture; T.downMat.uniforms.hp.value.set(0.5 / T.down[i - 1].width, 0.5 / T.down[i - 1].height);
        pass(r, T.downMat, T.down[i]);
      }
      let src = T.down[T.down.length - 1];
      for (let i = T.up.length - 1; i >= 0; i--) {
        T.upMat.uniforms.tex.value = src.texture; T.upMat.uniforms.base.value = T.down[i].texture; T.upMat.uniforms.hp.value.set(0.5 / src.width, 0.5 / src.height);
        pass(r, T.upMat, T.up[i]); src = T.up[i];
      }
      T.outMat.uniforms.tColor.value = T.dof.texture; T.outMat.uniforms.tBloom.value = T.up[0].texture;
      T.outMat.uniforms.bloom.value = F.bloom == null ? CINEMA.bloom : F.bloom; T.outMat.uniforms.exposure.value = r.toneMappingExposure || 1;
      pass(r, T.outMat, null);
      CINEMA.last = { K: CINEMA.K, focusDist: +focusDist.toFixed(2), fstop };
    }
    r.setRenderTarget(null); r.autoClear = autoClear; r.setClearColor(cc, ca);
  };
  const dist2 = (a, b) => { let m = 0; a.forEach((p, k) => { const q = b.get(k); if (q) m = Math.max(m, Math.hypot(p[0] - q[0], p[1] - q[1])); }); return m; };
  window.cinemaRenderer = function (opts) {
    const r = new THREE.WebGLRenderer(opts);
    r.__baseRender = r.render; r.render = cinemaRender;
    return r;
  };
  window.cinemaFrame = function (t) {
    const dur = (window.SCENE && window.SCENE.dur) || 1e9, sh = CINEMA.shutter / CINEMA.fps;
    const at = (x) => Math.min(Math.max(x, 0), dur - 1e-4);
    CINEMA.mode = "probe"; CINEMA.probe = new Map(); window.seek(at(t - sh / 2)); const a = CINEMA.probe;
    CINEMA.probe = new Map(); window.seek(at(t + sh / 2)); const b = CINEMA.probe;
    const px = dist2(a, b);
    CINEMA.K = Math.max(CINEMA.kMin, Math.min(CINEMA.kMax, Math.ceil(px / CINEMA.pxPerSample)));
    CINEMA.mode = "accum";
    clear(T.r, T.accum);
    for (let s = 0; s < CINEMA.K; s++) { CINEMA.s = s; window.seek(at(t + (CINEMA.K > 1 ? ((s + 0.5) / CINEMA.K - 0.5) * sh : 0))); }
    CINEMA.mode = "depth"; window.seek(at(t));
    CINEMA.mode = "direct";
    return Object.assign({ px: +px.toFixed(1) }, CINEMA.last);
  };
}
