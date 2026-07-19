/* Lumevina — dithered service visuals
   Vanilla port of designali-in's DitheringShader (WebGL2, Bayer /
   random dithering over animated shapes). Each .product-visual with
   a data-shape attribute gets its own canvas; shape and colors come
   from data-shape / data-front / data-back. One shared rAF loop
   drives every card; cards pause off-screen, reduced motion gets a
   still frame, and without WebGL2 the CSS gradient + orb remain. */

(function () {
  "use strict";

  var visuals = document.querySelectorAll(".product-visual[data-shape]");
  if (!visuals.length) return;

  var SHAPES = { simplex: 1, warp: 2, dots: 3, wave: 4, ripple: 5, swirl: 6, sphere: 7 };
  var TYPES = { random: 1, "2x2": 2, "4x4": 3, "8x8": 4 };

  var VERT = [
    "#version 300 es",
    "precision mediump float;",
    "layout(location = 0) in vec4 a_position;",
    "void main(){ gl_Position = a_position; }"
  ].join("\n");

  var FRAG = [
    "#version 300 es",
    "precision mediump float;",
    "uniform float u_time;",
    "uniform vec2 u_resolution;",
    "uniform vec4 u_colorBack;",
    "uniform vec4 u_colorFront;",
    "uniform float u_shape;",
    "uniform float u_type;",
    "uniform float u_pxSize;",
    "out vec4 fragColor;",
    "#define TWO_PI 6.28318530718",
    "vec3 permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }",
    "float snoise(vec2 v){",
    "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
    "  vec2 i = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod(i, 289.0);",
    "  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));",
    "  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);",
    "  m = m * m; m = m * m;",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);",
    "  vec3 g;",
    "  g.x = a0.x * x0.x + h.x * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",
    "float hash11(float p){ p = fract(p * 0.3183099) + 0.1; p *= p + 19.19; return fract(p * p); }",
    "float hash21(vec2 p){ p = fract(p * vec2(0.3183099, 0.3678794)) + 0.1; p += dot(p, p + 19.19); return fract(p.x * p.y); }",
    "float getSimplexNoise(vec2 uv, float t){",
    "  float n = .5 * snoise(uv - vec2(0., .3 * t));",
    "  n += .5 * snoise(2. * uv + vec2(0., .32 * t));",
    "  return n;",
    "}",
    "const int bayer8x8[64] = int[64](",
    "   0, 32,  8, 40,  2, 34, 10, 42,",
    "  48, 16, 56, 24, 50, 18, 58, 26,",
    "  12, 44,  4, 36, 14, 46,  6, 38,",
    "  60, 28, 52, 20, 62, 30, 54, 22,",
    "   3, 35, 11, 43,  1, 33,  9, 41,",
    "  51, 19, 59, 27, 49, 17, 57, 25,",
    "  15, 47,  7, 39, 13, 45,  5, 37,",
    "  63, 31, 55, 23, 61, 29, 53, 21);",
    "float getBayerValue(vec2 uv){",
    "  ivec2 pos = ivec2(mod(uv, 8.0));",
    "  return float(bayer8x8[pos.y * 8 + pos.x]) / 64.0;",
    "}",
    "void main(){",
    "  float t = .5 * u_time;",
    "  vec2 uv = gl_FragCoord.xy / u_resolution.xy;",
    "  uv -= .5;",
    "  vec2 pxSizeUv = gl_FragCoord.xy;",
    "  pxSizeUv -= .5 * u_resolution;",
    "  pxSizeUv /= u_pxSize;",
    "  vec2 pixelizedUv = floor(pxSizeUv) * u_pxSize / u_resolution.xy;",
    "  vec2 shape_uv = pixelizedUv;",
    "  vec2 dithering_uv = pxSizeUv;",
    "  vec2 ditheringNoise_uv = uv * u_resolution;",
    "  float shape = 0.;",
    "  if (u_shape < 1.5) {",
    "    shape_uv *= 1.4;",
    "    shape = 0.5 + 0.5 * getSimplexNoise(shape_uv, t);",
    "    shape = smoothstep(0.3, 0.9, shape);",
    "  } else if (u_shape < 2.5) {",
    "    shape_uv *= 2.2;",
    "    for (float i = 1.0; i < 6.0; i++) {",
    "      shape_uv.x += 0.6 / i * cos(i * 2.5 * shape_uv.y + t);",
    "      shape_uv.y += 0.6 / i * cos(i * 1.5 * shape_uv.x + t);",
    "    }",
    "    shape = .15 / abs(sin(t - shape_uv.y - shape_uv.x));",
    "    shape = smoothstep(0.02, 1., shape);",
    "  } else if (u_shape < 3.5) {",
    "    shape_uv *= 24.;",
    "    float stripeIdx = floor(2. * shape_uv.x / TWO_PI);",
    "    float rand = hash11(stripeIdx * 10.);",
    "    rand = sign(rand - .5) * pow(.1 + abs(rand), .4);",
    "    shape = sin(shape_uv.x) * cos(shape_uv.y - 5. * rand * t);",
    "    shape = pow(abs(shape), 6.);",
    "  } else if (u_shape < 4.5) {",
    "    shape_uv *= 4.;",
    "    float wave = cos(.5 * shape_uv.x - 2. * t) * sin(1.5 * shape_uv.x + t) * (.75 + .25 * cos(3. * t));",
    "    shape = 1. - smoothstep(-1., 1., shape_uv.y + wave);",
    "  } else if (u_shape < 5.5) {",
    "    float dist = length(shape_uv);",
    "    float waves = sin(pow(3. * dist, 1.7) * 7. - 3. * t) * .5 + .5;",
    "    shape = waves;",
    "  } else if (u_shape < 6.5) {",
    "    vec2 s_uv = 1.6 * shape_uv;",
    "    float l = length(s_uv);",
    "    float angle = 6. * atan(s_uv.y, s_uv.x) + 4. * t;",
    "    float twist = 1.2;",
    "    float offset = pow(l, -twist) + angle / TWO_PI;",
    "    float mid = smoothstep(0., 1., pow(l, twist));",
    "    shape = mix(0., fract(offset), mid);",
    "  } else {",
    "    vec2 s_uv = 2.4 * shape_uv;",
    "    float d = 1. - pow(length(s_uv), 2.);",
    "    vec3 pos = vec3(s_uv, sqrt(max(d, 0.)));",
    "    vec3 lightPos = normalize(vec3(cos(1.5 * t), .8, sin(1.25 * t)));",
    "    shape = .5 + .5 * dot(lightPos, pos);",
    "    shape *= step(0., d);",
    "  }",
    "  int type = int(floor(u_type));",
    "  float dithering = 0.0;",
    "  if (type == 1) { dithering = step(hash21(ditheringNoise_uv), shape); }",
    "  else { dithering = getBayerValue(dithering_uv); }",
    "  dithering -= .5;",
    "  float res = step(.5, shape + dithering);",
    "  vec3 color = mix(u_colorBack.rgb, u_colorFront.rgb, res);",
    "  fragColor = vec4(color, 1.0);",
    "}"
  ].join("\n");

  var hexToRgba = function (hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return [0, 0, 0, 1];
    return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1];
  };

  var compile = function (gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  };

  var cards = [];

  visuals.forEach(function (visual, i) {
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    var gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) return;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    visual.appendChild(canvas);
    visual.classList.add("has-dither");

    cards.push({
      visual: visual,
      canvas: canvas,
      gl: gl,
      u: {
        time: gl.getUniformLocation(prog, "u_time"),
        res: gl.getUniformLocation(prog, "u_resolution"),
        back: gl.getUniformLocation(prog, "u_colorBack"),
        front: gl.getUniformLocation(prog, "u_colorFront"),
        shape: gl.getUniformLocation(prog, "u_shape"),
        type: gl.getUniformLocation(prog, "u_type"),
        px: gl.getUniformLocation(prog, "u_pxSize")
      },
      shape: SHAPES[visual.dataset.shape] || SHAPES.simplex,
      type: TYPES[visual.dataset.dither || "8x8"] || TYPES["8x8"],
      front: hexToRgba(visual.dataset.front),
      back: hexToRgba(visual.dataset.back),
      /* stagger the clocks so the grid doesn't pulse in unison */
      offset: i * 7.3,
      inView: true
    });
  });

  if (!cards.length) return;

  var PX = 3;
  var resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cards.forEach(function (c) {
      var w = Math.max(1, Math.round(c.visual.clientWidth * dpr));
      var h = Math.max(1, Math.round(c.visual.clientHeight * dpr));
      if (c.canvas.width !== w || c.canvas.height !== h) {
        c.canvas.width = w;
        c.canvas.height = h;
        c.gl.viewport(0, 0, w, h);
      }
    });
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  var draw = function (c, time) {
    var gl = c.gl;
    gl.uniform1f(c.u.time, (time + c.offset) * 0.4);
    gl.uniform2f(c.u.res, c.canvas.width, c.canvas.height);
    gl.uniform4fv(c.u.back, c.back);
    gl.uniform4fv(c.u.front, c.front);
    gl.uniform1f(c.u.shape, c.shape);
    gl.uniform1f(c.u.type, c.type);
    gl.uniform1f(c.u.px, PX * Math.min(window.devicePixelRatio || 1, 1.5));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var start = performance.now();
  var rafId = null;

  var loop = function () {
    var t = (performance.now() - start) / 1000;
    cards.forEach(function (c) { if (c.inView) draw(c, t); });
    rafId = requestAnimationFrame(loop);
  };

  var play = function () {
    if (rafId === null && !rm.matches && !document.hidden) loop();
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  /* reduced motion: one still frame per card */
  cards.forEach(function (c) { draw(c, 0); });
  play();

  if (rm.addEventListener) {
    rm.addEventListener("change", function () {
      pause();
      cards.forEach(function (c) { draw(c, 0); });
      play();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        cards.forEach(function (c) {
          if (c.visual === entry.target) c.inView = entry.isIntersecting;
        });
      });
    }, { threshold: 0 });
    cards.forEach(function (c) { io.observe(c.visual); });
  }
})();
