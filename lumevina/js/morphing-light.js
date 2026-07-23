/* Lumevina — morphing light behind the Ritual section
   Vanilla port of the MorphingLight Three.js shader: concentric
   rings of light breathing outward from center, recolored from
   hot pink / cyan to the spa's rose / plum / sand. Same care as
   the hero shader: half-res, pauses off-screen, still frame under
   reduced motion, silently absent without WebGL. */

(function () {
  "use strict";

  var canvas = document.querySelector(".ritual-light");
  var section = document.querySelector(".section-ritual");
  if (!canvas || !section) return;

  var gl = canvas.getContext("webgl", { antialias: false, alpha: false }) ||
           canvas.getContext("experimental-webgl", { antialias: false, alpha: false });
  if (!gl) { canvas.remove(); return; }

  var VERT = [
    "attribute vec2 a_pos;",
    "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2 u_res;",
    "uniform float u_time;",
    "void main(){",
    "  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / u_res.y;",
    "  float c = length(uv);",
    "  float a = u_time * 0.55;",
    /* two ring frequencies, as in the original (c*4, c*8) */
    "  float rings  = 0.5 + 0.5 * sin(c * 4.0 * 3.14159 - a * 2.0);",
    "  float rings2 = 0.5 + 0.5 * sin(c * 8.0 * 3.14159 - a * 2.6);",
    "  float lum = 0.6 * rings + 0.4 * rings2;",
    /* bright at center, dissolving at the edges */
    "  lum *= smoothstep(1.05, 0.05, c);",
    /* hue drifts vertically over time (original: pink→cyan; here rose→plum) */
    "  float hueMix = clamp(0.5 + (uv.y - 0.35 * sin(u_time * 0.3)) * 0.9, 0.0, 1.0);",
    "  vec3 linen = vec3(0.984, 0.988, 0.992);",
    "  vec3 rose  = vec3(0.725, 0.761, 0.796);",
    "  vec3 plum  = vec3(0.247, 0.278, 0.314);",
    "  vec3 sand  = vec3(0.812, 0.831, 0.827);",
    "  vec3 glow = mix(rose, plum, hueMix);",
    "  glow = mix(glow, sand, clamp(uv.x * 0.6 + 0.2, 0.0, 1.0) * 0.35);",
    /* a warm white core, like the original's vec3(5.) hot center */
    "  glow = mix(glow, vec3(1.0, 0.98, 0.95), smoothstep(0.35, 0.0, c) * 0.7);",
    "  vec3 col = mix(linen, glow, lum * 0.55);",
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

  var SCALE = 0.5;
  var resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(section.clientWidth * dpr * SCALE));
    var h = Math.max(1, Math.round(section.clientHeight * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  section.classList.add("has-light");

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var start = performance.now();
  var rafId = null;
  var inView = true;

  var frame = function () {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1000);
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
    }, { threshold: 0 }).observe(section);
  }
})();
