/* ═══════════════════════════════════════════════════════════
   La Noche — deterministic, seekable composition.

   Every pixel is a pure function of the frame number:
   - type, curtain, bloom and scrims: one paused GSAP timeline built
     from timeline.json, seeked to frame / fps
   - camera: keyframes in timeline.json, eased with GSAP's ease curves
   - footage: pre-extracted loop frames (no <video> seeking)
   - embers and grain: seeded PRNG, evaluated at t
   The renderer calls window.film.seek(frame) and screenshots.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var FORMAT = params.get("format") === "9x16" ? "9x16" : "16x9";
  var RENDER = params.has("render");
  var root = document.documentElement;
  root.dataset.format = FORMAT;

  var T, FPS, FRAMES, tl, src, embers = [];
  var plate = document.getElementById("plate");
  var plateImg = document.getElementById("plate-img");
  var emberCanvas = document.getElementById("embers");
  var grainCanvas = document.getElementById("grain");
  var emberCtx, grainCtx, grainData;
  var currentSrc = -1;

  /* ─── helpers ─── */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function frac(v) { return v - Math.floor(v); }
  function pad(n) { return ("000" + n).slice(-4); }
  function nextPaint() {
    return new Promise(function (res) { requestAnimationFrame(function () { requestAnimationFrame(res); }); });
  }

  /* ─── camera ─── */

  function cameraAt(t) {
    var keys = T.camera[FORMAT];
    var v = keys[0].at;
    for (var i = 1; i < keys.length; i++) {
      var k = keys[i];
      if (k.cut) {
        if (t >= k.t) { v = k.cut; continue; }
        break;
      }
      if (t >= k.t) { v = k.at; continue; }
      var t0 = keys[i - 1].t;
      var p = gsap.parseEase(k.ease || "none")((t - t0) / (k.t - t0));
      v = [lerp(v[0], k.at[0], p), lerp(v[1], k.at[1], p), lerp(v[2], k.at[2], p)];
      break;
    }
    return v;
  }

  function placement(c) {
    var bw = plate.clientWidth, bh = plate.clientHeight;
    var sw = src.width * src.upscale, sh = src.height * src.upscale;
    var s = Math.max(bw / sw, bh / sh) * c[2];
    var tx = clamp(bw / 2 - c[0] * sw * s, bw - sw * s, 0);
    var ty = clamp(bh / 2 - c[1] * sh * s, bh - sh * s, 0);
    return { s: s, tx: tx, ty: ty };
  }

  // Footage motion blur: 180° shutter, so blur ≈ screen travel over half a frame.
  // A hard cut inside the shutter interval is not motion: no blur across it.
  function cutWithin(a, b) {
    return T.camera[FORMAT].some(function (k) { return k.cut && k.t > a && k.t <= b; });
  }
  var blurNode;
  function applyCamera(t) {
    var t0 = Math.max(0, t - 0.5 / FPS);
    var p = placement(cameraAt(t));
    var q = cutWithin(t0, t) ? p : placement(cameraAt(t0));
    plateImg.style.transform = "translate(" + p.tx.toFixed(3) + "px," + p.ty.toFixed(3) + "px) scale(" + p.s.toFixed(5) + ")";
    var bx = Math.abs(p.tx - q.tx) / 2.5, by = Math.abs(p.ty - q.ty) / 2.5;
    if (bx > 0.6 || by > 0.6) {
      blurNode.setAttribute("stdDeviation", bx.toFixed(2) + " " + by.toFixed(2));
      plate.style.filter = "url(#mblur)";
    } else {
      plate.style.filter = "none";
    }
    return p;
  }

  /* ─── footage: seamless loop frames, per-shot source offset ─── */

  function shotAt(t) {
    var shots = T.shots;
    for (var i = shots.length - 1; i >= 0; i--) if (t >= shots[i].start) return shots[i];
    return shots[0];
  }
  function srcIndex(frame) {
    var L = src.loopFrames;
    return (((frame + shotAt(frame / FPS).srcOffset) % L) + L) % L;
  }
  function setPlate(idx) {
    if (idx === currentSrc) return Promise.resolve();
    currentSrc = idx;
    plateImg.src = "../build/plate/" + pad(idx) + ".jpg";
    return plateImg.decode();
  }

  /* ─── embers (the site intro's model, seeded) ─── */

  function initEmbers() {
    var rnd = mulberry32(1234);
    var n = FORMAT === "9x16" ? 90 : 80;
    for (var i = 0; i < n; i++) {
      embers.push({
        x: rnd(), p: rnd(),
        r: 0.5 + rnd() * 1.6,
        v: 0.03 + rnd() * 0.09,       // screen heights per second
        a: 0.2 + rnd() * 0.6,
        tw: rnd() * Math.PI * 2,
        sw: 0.004 + rnd() * 0.01, sf: 0.4 + rnd() * 0.8
      });
    }
    emberCanvas.width = emberCanvas.clientWidth;
    emberCanvas.height = emberCanvas.clientHeight;
    emberCtx = emberCanvas.getContext("2d");
  }

  function drawEmbers(t) {
    var w = emberCanvas.width, h = emberCanvas.height, ctx = emberCtx;
    var unit = Math.min(w, h) / 1080;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      var y = 1.05 - frac(e.p + e.v * t) * 1.1;
      var x = e.x + e.sw * Math.sin(t * e.sf + e.tw);
      var flick = 0.55 + 0.45 * Math.sin(e.tw + 3 * t);
      var px = x * w, py = y * h, rad = e.r * 7 * unit;
      var g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, "rgba(255,184,96," + (e.a * flick).toFixed(3) + ")");
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ─── grain (half resolution, seeded per frame) ─── */

  function initGrain() {
    grainCanvas.width = Math.round(grainCanvas.clientWidth / 2);
    grainCanvas.height = Math.round(grainCanvas.clientHeight / 2);
    grainCtx = grainCanvas.getContext("2d");
    grainData = grainCtx.createImageData(grainCanvas.width, grainCanvas.height);
  }
  function drawGrain(frame) {
    var rnd = mulberry32(frame * 9973 + 17), d = grainData.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (rnd() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
    grainCtx.putImageData(grainData, 0, 0);
  }

  /* ─── timeline: events + transitions from timeline.json ─── */

  function splitLetters(el) {
    var text = el.textContent;
    el.textContent = "";
    el.setAttribute("aria-label", text);
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.textContent = text[i];
      el.appendChild(s);
    }
  }

  function build() {
    var k = FORMAT === "9x16" ? 1.1 : 1;      // motion distance scale per format
    var started = new Set();
    var last = new Map();                     // last value per element+prop for "to" events
    tl = gsap.timeline({ paused: true });

    function firstTouch(els) {
      var fresh = els.some(function (el) { return !started.has(el); });
      els.forEach(function (el) { started.add(el); });
      return fresh;
    }

    T.events.forEach(function (ev) {
      var els = gsap.utils.toArray(ev.el);
      if (!els.length) throw new Error("timeline event targets nothing: " + ev.el);
      var targets;
      switch (ev.anim) {
        case "rise":
          targets = els.reduce(function (a, el) {
            var w = el.querySelectorAll(".w");
            return a.concat(w.length ? Array.prototype.slice.call(w) : [el]);
          }, []);
          tl.fromTo(targets, { opacity: 0, y: 44 * k }, { opacity: 1, y: 0, duration: ev.dur, ease: "power3.out", stagger: 0.13, immediateRender: firstTouch(targets) }, ev.t);
          break;
        case "letters":
          targets = els.reduce(function (a, el) { return a.concat(Array.prototype.slice.call(el.querySelectorAll(".ch"))); }, []);
          tl.fromTo(targets, { opacity: 0, y: 64 * k }, { opacity: 1, y: 0, duration: ev.dur, ease: "power3.out", stagger: 0.05, immediateRender: firstTouch(targets) }, ev.t);
          break;
        case "fade":
          tl.fromTo(els, { opacity: 0, y: 14 * k }, { opacity: 1, y: 0, duration: ev.dur, ease: "power2.out", immediateRender: firstTouch(els) }, ev.t);
          break;
        case "ribbon":
          tl.fromTo(els, { opacity: 0, y: 18 * k }, { opacity: 1, y: 0, duration: ev.dur, ease: "power2.out", stagger: ev.stagger, immediateRender: firstTouch(els) }, ev.t);
          break;
        case "bloom":
          tl.fromTo(els, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: ev.dur, ease: "power3.out", immediateRender: firstTouch(els) }, ev.t);
          break;
        case "out":
          tl.fromTo(els, { opacity: 1, y: 0 }, { opacity: 0, y: -16 * k, duration: ev.dur, ease: "power2.in", immediateRender: false }, ev.t);
          firstTouch(els);
          break;
        case "to":
          els.forEach(function (el) {
            var from = {};
            Object.keys(ev.vars).forEach(function (prop) {
              var key = prop;
              if (!last.has(el)) last.set(el, {});
              var mem = last.get(el);
              from[prop] = key in mem ? mem[key] : parseFloat(getComputedStyle(el)[prop]);
              mem[key] = ev.vars[prop];
            });
            tl.fromTo(el, from, Object.assign({ duration: ev.dur, ease: ev.ease || "power1.inOut", immediateRender: false }, ev.vars), ev.t);
          });
          break;
        default:
          throw new Error("unknown anim " + ev.anim);
      }
    });

    var curtainSeen = false;
    T.transitions.forEach(function (tr) {
      if (tr.type === "curtain") {
        var cover = tr.hold ? tr.end : tr.cover;
        tl.fromTo("#curtain", { yPercent: 100 }, { yPercent: 0, duration: cover - tr.start, ease: tr.hold ? "power4.inOut" : "power4.in", immediateRender: !curtainSeen }, tr.start);
        curtainSeen = true;
        if (!tr.hold) tl.fromTo("#curtain", { yPercent: 0 }, { yPercent: -100, duration: tr.end - cover, ease: "power4.out", immediateRender: false }, cover);
      } else if (tr.type === "bloom") {
        tl.fromTo("#bloom", { opacity: 0 }, { opacity: 0.8, duration: tr.peak - tr.start, ease: "power2.in", immediateRender: false }, tr.start);
        tl.fromTo("#bloom", { opacity: 0.8 }, { opacity: 0, duration: tr.end - tr.peak, ease: "power2.out", immediateRender: false }, tr.peak);
      }
      // "pull" and "whip" are camera moves (timeline.json camera keys); here they only carry sfx.
    });
    if (!curtainSeen) gsap.set("#curtain", { yPercent: 100 });
    tl.seek(0);
  }

  /* ─── public API ─── */

  function seek(frame, opts) {
    frame = clamp(Math.round(frame), 0, FRAMES - 1);
    var t = frame / FPS;
    tl.seek(t, true);
    applyCamera(t);
    drawEmbers(t);
    drawGrain(frame);
    root.classList.toggle("hide-text", !!(opts && opts.hideText));
    return setPlate(srcIndex(frame)).then(nextPaint).then(function () { return frame; });
  }

  // Visible copy for QA: boxes, colors and sizes of fully-opaque text.
  function layout() {
    var sel = ".display .w, .es, .eyebrow, .body, .ribbon span, .word, .tag, .addr, .cta";
    var out = [];
    document.querySelectorAll(sel).forEach(function (el) {
      var op = 1, n = el;
      while (n && n !== document.documentElement) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
      if (op < 0.98) return;
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      var card = el.closest(".card");
      out.push({
        card: card ? card.id : null, cls: el.className, text: el.textContent.trim(),
        x: r.left, y: r.top, w: r.width, h: r.height,
        color: cs.color, fontSize: parseFloat(cs.fontSize)
      });
    });
    return out;
  }

  function addFilter() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = '<filter id="mblur" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0" edgeMode="duplicate"/></filter>';
    document.body.appendChild(svg);
    blurNode = svg.querySelector("feGaussianBlur");
  }

  var ready = fetch("timeline.json")
    .then(function (r) { return r.json(); })
    .then(function (json) {
      T = json; FPS = T.fps; FRAMES = Math.round(T.duration * FPS); src = T.source;
      var faces = ['600 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"',
        '300 40px "Jost"', '400 40px "Jost"', '500 40px "Jost"'];
      return Promise.all(faces.map(function (f) { return document.fonts.load(f, "Güeros"); }))
        .then(function () { return document.fonts.ready; });
    })
    .then(function () {
      var icon = document.querySelector(".mono img");
      return icon.complete ? null : new Promise(function (res) { icon.onload = res; icon.onerror = res; });
    })
    .then(function () {
      addFilter();
      document.querySelectorAll(".word").forEach(splitLetters);
      initEmbers();
      initGrain();
      build();
      return seek(0);
    })
    .then(function () {
      if (!RENDER) preview();
      return { fps: FPS, frames: FRAMES, format: FORMAT, width: T.formats[FORMAT].width, height: T.formats[FORMAT].height };
    });

  // QA helpers: timeline state without painting.
  // Opacity of the most visible animated piece (word / letter / element) — when the first glyphs land.
  function opacityAt(frame, sel) {
    tl.seek(frame / FPS, true);
    var best = 0;
    gsap.utils.toArray(sel).forEach(function (el) {
      var parts = el.querySelectorAll(".w, .ch");
      (parts.length ? Array.prototype.slice.call(parts) : [el]).forEach(function (p) {
        var op = 1, n = p;
        while (n && n !== document.documentElement) { op *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
        best = Math.max(best, op);
      });
    });
    return best;
  }
  function placementAt(frame) {
    var p = placement(cameraAt(frame / FPS));
    return [+p.tx.toFixed(2), +p.ty.toFixed(2), +p.s.toFixed(4), srcIndex(frame)];
  }

  window.film = { ready: ready, seek: seek, layout: layout, opacityAt: opacityAt, placementAt: placementAt };

  /* ─── preview transport: scrub, play, swap format ─── */

  function preview() {
    var bar = document.getElementById("transport");
    var scrub = document.getElementById("scrub"), clock = document.getElementById("clock");
    var playBtn = document.getElementById("play"), swap = document.getElementById("swap");
    var vp = document.getElementById("viewport");
    bar.hidden = false;
    scrub.max = FRAMES - 1;
    function fit() {
      var f = T.formats[FORMAT];
      var sc = Math.min(innerWidth / f.width, (innerHeight - bar.offsetHeight) / f.height);
      vp.style.transform = "scale(" + sc + ")";
    }
    fit(); addEventListener("resize", fit);
    var busy = false, playing = false, t0 = 0, f0 = 0;
    function show(f) {
      if (busy) return; busy = true;
      seek(f).then(function (fr) { scrub.value = fr; clock.textContent = (fr / FPS).toFixed(2) + " s · f" + fr; busy = false; });
    }
    var start = Number(params.get("t"));
    if (start) show(Math.round(start * FPS));
    scrub.addEventListener("input", function () { playing = false; playBtn.textContent = "Play"; show(+scrub.value); });
    playBtn.addEventListener("click", function () {
      playing = !playing; playBtn.textContent = playing ? "Pause" : "Play";
      t0 = performance.now(); f0 = +scrub.value >= FRAMES - 1 ? 0 : +scrub.value;
      (function loop() {
        if (!playing) return;
        var f = f0 + Math.floor((performance.now() - t0) / 1000 * FPS);
        if (f >= FRAMES) { playing = false; playBtn.textContent = "Play"; return; }
        show(f); requestAnimationFrame(loop);
      })();
    });
    swap.href = "?format=" + (FORMAT === "16x9" ? "9x16" : "16x9");
  }
})();
