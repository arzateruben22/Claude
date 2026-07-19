/* Lumevina — liquid metal hero background
   A WebGL "liquid rose-gold" shader (inspired by paper-design's
   LiquidMetal) rendered behind the hero. Vanilla port so the site
   keeps its no-build stack. If WebGL is unavailable the canvas is
   removed and the CSS glow fallback stays visible. */

(function () {
  "use strict";

  var canvas = document.querySelector(".hero-liquid");
  var hero = document.querySelector(".hero");
  if (!canvas || !hero) return;

  var gl = canvas.getContext("webgl", { antialias: false, alpha: false }) ||
           canvas.getContext("experimental-webgl", { antialias: false, alpha: false });
  if (!gl) { canvas.remove(); return; }

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  /* domain-warped fbm mapped to the spa palette: ivory highlights,
     rose / mauve body, a whisper of sand — pearlescent, not chrome */
  var FRAG = [
    "precision highp float;",
    "uniform vec2 u_res;",
    "uniform float u_time;",
    "uniform vec2 u_mouse;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
    "float noise(vec2 p){",
    "  vec2 i = floor(p), f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "float fbm(vec2 p){",
    "  float v = 0.0, a = 0.5;",
    "  for(int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(13.7, 7.1); a *= 0.5; }",
    "  return v;",
    "}",
    "void main(){",
    "  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);",
    "  float t = u_time * 0.06;",
    "  vec2 q = vec2(fbm(uv * 1.6 + u_mouse * 0.25 + t), fbm(uv * 1.6 - t * 0.7 - u_mouse * 0.2));",
    "  vec2 r = vec2(fbm(uv * 2.2 + q * 1.8 + vec2(1.7, 9.2) + t * 1.2),",
    "                fbm(uv * 2.2 + q * 1.8 + vec2(8.3, 2.8) - t));",
    "  float n = fbm(uv * 2.4 + r * 2.2);",
    "  float band = sin((n * 4.5 + r.x * 2.0) * 3.14159 + t * 3.0);",
    "  float spec = smoothstep(0.55, 0.95, band);",
    "  float shade = n * 0.6 + 0.4;",
    "  vec3 ivory = vec3(0.969, 0.945, 0.922);",
    "  vec3 rose  = vec3(0.788, 0.635, 0.706);",
    "  vec3 mauve = vec3(0.647, 0.475, 0.545);",
    "  vec3 sand  = vec3(0.851, 0.725, 0.639);",
    "  vec3 col = mix(mauve, rose, shade);",
    "  col = mix(col, sand, q.y * 0.45);",
    "  col = mix(col, ivory, spec * 0.9);",
    "  col = mix(col, ivory, 0.35);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  var compile = function (type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  };

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "u_res");
  var uTime = gl.getUniformLocation(prog, "u_time");
  var uMouse = gl.getUniformLocation(prog, "u_mouse");

  /* the weave leans gently toward the pointer (eased, never jumpy) */
  var mouseTarget = { x: 0, y: 0 };
  var mouseCurrent = { x: 0, y: 0 };
  window.addEventListener("pointermove", function (e) {
    mouseTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  /* render at half resolution — the shader is soft, and this keeps
     the loop cheap on laptops and phones */
  var SCALE = 0.5;
  var resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(hero.clientWidth * dpr * SCALE));
    var h = Math.max(1, Math.round(hero.clientHeight * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  hero.classList.add("has-liquid");

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var start = performance.now();
  var rafId = null;
  var inView = true;

  var frame = function () {
    mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * 0.04;
    mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * 0.04;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1000);
    gl.uniform2f(uMouse, mouseCurrent.x, mouseCurrent.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  var loop = function () {
    frame();
    rafId = requestAnimationFrame(loop);
  };

  var play = function () {
    if (rafId === null && !rm.matches && inView && !document.hidden) loop();
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  /* reduced motion: one still frame, no loop */
  frame();
  play();

  if (rm.addEventListener) {
    rm.addEventListener("change", function () {
      pause();
      frame();
      play();
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) play(); else pause();
    }, { threshold: 0 }).observe(hero);
  }
})();
