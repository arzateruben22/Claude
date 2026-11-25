// A model of a page's GPU memory, from its WebGL calls (2026-11-24, the iPhone crash on a mid-drive switch to Ultra).
// No browser reports what WebGL holds on the GPU, so this counts what the page asks for: every texture level
// (texImage2D/3D, texStorage2D/3D, and a whole mip chain at generateMipmap), every renderbuffer (times its samples),
// every buffer (bufferData), less what is deleted; plus the drawing buffer at the canvas's size (colour and depth,
// times 4 samples and a resolve when the context is antialiased, and the compositor's copy). Sizes are the formats'
// own bytes a texel (RGB8 counts 4, as GPUs pad it). It is a model, not the driver's number: drivers round sizes up,
// keep a pipeline cache and their own staging copies, and iOS also counts the canvases the textures were painted from.
// Install with `context.addInitScript(gpuMemInit)`; read with `window.__gpuMem.snap()` (MB), `.resetPeak()`.
export function gpuMemInit() {
  if (window.__gpuMem) return;
  const P = (window.WebGL2RenderingContext || {}).prototype, P1 = (window.WebGLRenderingContext || {}).prototype;
  if (!P) return;
  const SIZED = { 0x8058: 4, 0x8c43: 4, 0x881a: 8, 0x8814: 16, 0x8051: 4, 0x8c41: 4, 0x8229: 1, 0x822b: 2, 0x822d: 2, 0x822f: 4, 0x822e: 4, 0x8230: 8,
    0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x88f0: 4, 0x8cad: 8, 0x881b: 8, 0x8815: 16, 0x8c3a: 4, 0x8059: 4, 0x8056: 2, 0x8d62: 2, 0x8057: 2, 0x84f9: 4, 0x8d48: 1, 0x8232: 1, 0x8236: 4, 0x8234: 2 };
  const TYPE = { 0x1401: 1, 0x140b: 2, 0x8d61: 2, 0x1406: 4, 0x1405: 4, 0x1403: 2, 0x84fa: 4 };
  const CH = { 0x1908: 4, 0x1907: 4, 0x1902: 1, 0x84f9: 1, 0x1909: 1, 0x1906: 1, 0x190a: 2, 0x1903: 1, 0x8227: 2 };
  const bpp = (internal, format, type) => {
    if (SIZED[internal]) return SIZED[internal];
    if (internal === 0x1902 || internal === 0x84f9) return 4;              // DEPTH_COMPONENT / DEPTH_STENCIL, unsized
    return (CH[internal] ?? CH[format] ?? 4) * (TYPE[type] ?? 1);
  };
  const st = { tex: new Map(), rb: new Map(), buf: new Map(), peak: 0, peakAt: '', events: 0, lost: 0 };
  const ctxs = new Set();
  const per = new WeakMap();                                               // a context's bindings
  const b = (gl) => { let s = per.get(gl); if (!s) { s = { unit: 0, tex: {}, rb: null, buf: {} }; per.set(gl, s); ctxs.add(gl); } return s; };
  const dimsOf = (src) => src ? [src.videoWidth || src.naturalWidth || src.width || 0, src.videoHeight || src.naturalHeight || src.height || 0] : [0, 0];
  const fbBytes = () => {
    let t = 0;
    for (const gl of ctxs) {
      if (gl.isContextLost && gl.isContextLost()) continue;
      const c = gl.canvas, a = gl.getContextAttributes ? gl.getContextAttributes() : null;
      if (!c || !a) continue;
      const px = c.width * c.height;
      t += px * (a.antialias ? 4 * 8 + 4 : 8) + px * 4;                    // (MSAA colour+depth and a resolve) or colour+depth, plus the compositor's copy
    }
    return t;
  };
  const sum = (m) => { let t = 0; for (const v of m.values()) t += v.bytes; return t; };
  const total = () => sum(st.tex) + sum(st.rb) + sum(st.buf) + fbBytes();
  const note = (why) => { st.events++; const t = total(); if (t > st.peak) { st.peak = t; st.peakAt = why; } };
  const texRec = (gl, target) => {
    const s = b(gl), key = (target >= 0x8515 && target <= 0x851a) ? 0x8513 : target;
    const t = s.tex[s.unit + ':' + key];
    if (!t) return null;
    let r = st.tex.get(t);
    if (!r) { r = { levels: {}, bytes: 0, w: 0, h: 0, fmt: 0, mips: false }; st.tex.set(t, r); }
    return r;
  };
  const recompute = (r) => { let x = 0; for (const k in r.levels) x += r.levels[k]; r.bytes = r.mips ? x : x; };
  const wrap = (name, after, protos = [P, P1]) => {
    for (const pr of protos) {
      if (!pr || !pr[name]) continue;
      const orig = pr[name];
      pr[name] = function (...a) { const out = orig.apply(this, a); try { after(this, a, out); } catch { /* the model never breaks the page */ } return out; };
    }
  };
  wrap('activeTexture', (gl, [u]) => { b(gl).unit = u - 0x84c0; });
  wrap('bindTexture', (gl, [target, t]) => { b(gl).tex[b(gl).unit + ':' + target] = t; });
  wrap('deleteTexture', (gl, [t]) => { st.tex.delete(t); });
  wrap('texImage2D', (gl, a) => {
    const [target, level, internal] = a;
    let w, h, format, type;
    if (a.length >= 8 && typeof a[3] === 'number' && typeof a[4] === 'number' && typeof a[6] === 'number' && typeof a[7] === 'number' && a.length !== 6) { w = a[3]; h = a[4]; format = a[6]; type = a[7]; }
    else { format = a[3]; type = a[4]; [w, h] = dimsOf(a[5]); }
    const r = texRec(gl, target); if (!r) return;
    const face = (target >= 0x8515 && target <= 0x851a) ? target - 0x8515 : 0;
    r.levels[level + ':' + face] = w * h * bpp(internal, format, type);
    if (level === 0) { r.w = w; r.h = h; r.fmt = internal; r.faces = Math.max(r.faces || 1, face + 1); if (r.mips) r.levels['m:' + face] = r.levels[level + ':' + face] / 3; }
    recompute(r); note('texImage2D ' + w + 'x' + h);
  });
  wrap('texStorage2D', (gl, [target, levels, internal, w, h]) => {
    const r = texRec(gl, target); if (!r) return;
    const faces = target === 0x8513 ? 6 : 1; let x = 0;
    for (let l = 0; l < levels; l++) x += Math.max(1, w >> l) * Math.max(1, h >> l) * bpp(internal);
    r.levels = { s: x * faces }; r.w = w; r.h = h; r.fmt = internal; r.storage = true; r.faces = faces; recompute(r); note('texStorage2D ' + w + 'x' + h);
  });
  wrap('texImage3D', (gl, a) => {
    const [target, level, internal, w, h, d, , format, type] = a;
    const r = texRec(gl, target); if (!r) return;
    r.levels[level + ':3d'] = w * h * d * bpp(internal, format, type); if (level === 0) { r.w = w; r.h = h * d; r.fmt = internal; } recompute(r); note('texImage3D');
  });
  wrap('texStorage3D', (gl, [target, levels, internal, w, h, d]) => {
    const r = texRec(gl, target); if (!r) return;
    let x = 0; for (let l = 0; l < levels; l++) x += Math.max(1, w >> l) * Math.max(1, h >> l) * d * bpp(internal);
    r.levels = { s: x }; r.w = w; r.h = h * d; r.fmt = internal; r.storage = true; recompute(r); note('texStorage3D');
  });
  wrap('generateMipmap', (gl, [target]) => {
    const r = texRec(gl, target); if (!r || r.storage || r.mips) return;
    r.mips = true; for (const k of Object.keys(r.levels)) if (k.startsWith('0:')) r.levels['m:' + k.slice(2)] = r.levels[k] / 3;
    recompute(r); note('generateMipmap');
  });
  wrap('bindRenderbuffer', (gl, [, rb]) => { b(gl).rb = rb; });
  wrap('deleteRenderbuffer', (gl, [rb]) => { st.rb.delete(rb); });
  wrap('renderbufferStorage', (gl, [, internal, w, h]) => { const rb = b(gl).rb; if (rb) { st.rb.set(rb, { bytes: w * h * bpp(internal), w, h, fmt: internal, samples: 0 }); note('renderbuffer ' + w + 'x' + h); } });
  wrap('renderbufferStorageMultisample', (gl, [, samples, internal, w, h]) => { const rb = b(gl).rb; if (rb) { st.rb.set(rb, { bytes: w * h * bpp(internal) * Math.max(1, samples), w, h, fmt: internal, samples }); note('renderbuffer MS ' + w + 'x' + h); } });
  wrap('bindBuffer', (gl, [target, buf]) => { b(gl).buf[target] = buf; });
  wrap('deleteBuffer', (gl, [buf]) => { st.buf.delete(buf); });
  wrap('bufferData', (gl, a) => {
    const [target, src, , off, len] = a, buf = b(gl).buf[target]; if (!buf) return;
    const n = typeof src === 'number' ? src : len ? len * (src.BYTES_PER_ELEMENT || 1) : src ? src.byteLength - (off ? off * (src.BYTES_PER_ELEMENT || 1) : 0) : 0;
    st.buf.set(buf, { bytes: n }); note('bufferData');
  });
  // a lost context frees everything it held
  addEventListener('webglcontextlost', () => { st.lost++; st.tex.clear(); st.rb.clear(); st.buf.clear(); }, true);
  const MB = (x) => Math.round((x / 1048576) * 10) / 10;
  window.__gpuMem = {
    snap(top = 0) {
      const tex = sum(st.tex), rb = sum(st.rb), buf = sum(st.buf), fb = fbBytes();
      const out = { tex: MB(tex), rb: MB(rb), buf: MB(buf), fb: MB(fb), total: MB(tex + rb + buf + fb), peak: MB(Math.max(st.peak, tex + rb + buf + fb)), peakAt: st.peakAt, nTex: st.tex.size, nRb: st.rb.size, nBuf: st.buf.size, lost: st.lost };
      if (top) {
        const g = new Map();
        for (const r of st.tex.values()) { const k = `tex ${r.w}x${r.h} ${r.fmt.toString(16)}${r.faces > 1 ? ' x' + r.faces : ''}${r.mips || r.storage ? ' mips' : ''}`; const e = g.get(k) || { n: 0, bytes: 0 }; e.n++; e.bytes += r.bytes; g.set(k, e); }
        for (const r of st.rb.values()) { const k = `rb ${r.w}x${r.h} ${r.fmt.toString(16)}${r.samples ? ' ' + r.samples + 'x' : ''}`; const e = g.get(k) || { n: 0, bytes: 0 }; e.n++; e.bytes += r.bytes; g.set(k, e); }
        out.top = [...g.entries()].sort((x, y) => y[1].bytes - x[1].bytes).slice(0, top).map(([k, e]) => `${k} ×${e.n} = ${MB(e.bytes)} MB`);
      }
      return out;
    },
    resetPeak() { st.peak = total(); st.peakAt = 'reset'; },
  };
}
