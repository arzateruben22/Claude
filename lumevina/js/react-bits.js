/* Lumevina — five effects from React Bits (reactbits.dev, by David Haz)
   Vanilla ports, so the site keeps its no-build stack and no React:

     BlurText    section headlines come into focus word by word as they
                 scroll in (h2[data-blur-text])
     ShinyText   a slow light across a line of text (.rb-shiny, CSS only;
                 see styles.css)
     GlareHover  a streak of light crosses a card when it first scrolls
                 into view, and again on hover ([data-glare])
     ClickSpark  a small burst of rose sparks wherever a button is tapped,
                 and a bigger one when an appointment is confirmed
     CountUp     numbers count into place: Glow Points, and the money
                 tiles on the owner dashboard

   The page reads the same without any of it. Reduced motion skips all
   five; nothing runs while it's off screen.

   React Bits is MIT + Commons Clause. Copyright (c) 2026 David Haz.
   Permission is hereby granted, free of charge, to any person obtaining
   a copy of this software and associated documentation files (the
   "Software"), to deal in the Software without restriction, including
   without limitation the rights to use, copy, modify, merge, publish,
   and distribute the Software as part of an application, website, or
   product, subject to the following conditions: the above copyright
   notice and this permission notice shall be included in all copies or
   substantial portions of the Software. You may use this Software,
   including for any commercial purpose, so long as you do not sell,
   sublicense, or redistribute the components themselves, whether alone,
   in a bundle, or as a ported version. THE SOFTWARE IS PROVIDED "AS IS",
   WITHOUT WARRANTY OF ANY KIND. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var still = function () { return reduce.matches; };
  var IO = window.IntersectionObserver;

  /* run fn once, the first time el is on screen */
  var onceVisible = function (el, fn, threshold) {
    if (!IO) { fn(); return; }
    var io = new IO(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      fn();
    }, { threshold: threshold || 0 });
    io.observe(el);
  };

  /* ── BlurText ──────────────────────────────────────────────────
     Each word goes blur(10px) and invisible, through blur(5px) at half
     opacity, to sharp, 0.35s a step, one word after another. Words are
     split in place, so <em> and the heading's own styles stay intact
     and screen readers still read one sentence. */
  var BLUR_STEPS = [
    { filter: "blur(10px)", opacity: 0, transform: "translateY(-0.4em)" },
    { filter: "blur(5px)", opacity: 0.5, transform: "translateY(0.05em)" },
    { filter: "blur(0px)", opacity: 1, transform: "none" }
  ];

  var splitWords = function (root) {
    var words = [];
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { walk(child); return; }
        if (child.nodeType !== 3 || !child.textContent.trim()) return;
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var w = document.createElement("span");
          w.className = "rb-w";
          w.textContent = part;
          frag.appendChild(w);
          words.push(w);
        });
        node.replaceChild(frag, child);
      });
    };
    walk(root);
    return words;
  };

  var blurText = function (el) {
    if (still() || !el.animate || el.hasAttribute("data-rb-done")) return;
    el.setAttribute("data-rb-done", "");
    var words = splitWords(el);
    var delay = parseInt(el.getAttribute("data-blur-text"), 10) || 110;
    el.classList.add("rb-blur-wait");
    onceVisible(el, function () {
      words.forEach(function (w, i) {
        /* fill "backwards" holds the first step during each word's delay;
           afterwards nothing lingers and the CSS is the resting state */
        w.animate(BLUR_STEPS, { duration: 700, delay: i * delay, easing: "ease-out", fill: "backwards" });
      });
      el.classList.remove("rb-blur-wait");
    }, 0.35);
  };

  /* ── GlareHover ────────────────────────────────────────────────
     The React Bits glare is a ::before; here it's an injected layer, so
     cards that already use ::before and ::after keep them. playOnce
     mode: it sweeps through and resets out of sight, never backwards. */
  var GLARE_MS = 700;

  var glare = function (el) {
    if (el.querySelector(":scope > .rb-glare")) return;
    var layer = document.createElement("span");
    layer.className = "rb-glare";
    layer.setAttribute("aria-hidden", "true");
    el.appendChild(layer);
    var busy = false;
    var play = function () {
      if (still() || busy) return;
      busy = true;
      layer.classList.add("is-on");
      setTimeout(function () {
        layer.classList.add("is-reset");
        layer.classList.remove("is-on");
        void layer.offsetWidth;            /* commit the jump back before re-enabling the transition */
        layer.classList.remove("is-reset");
        busy = false;
      }, GLARE_MS + 60);
    };
    onceVisible(el, function () { setTimeout(play, 250); }, 0.6);
    el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") play(); });
  };

  /* ── ClickSpark ────────────────────────────────────────────────
     One fixed canvas over the whole page (not one per button), drawn
     only while sparks are alive. Same geometry as React Bits: lines
     fly out from the tap and shorten as they go, easing out. Each line
     has a thin dark edge, so it still reads on the rose buttons. */
  var SPARK = { color: "#f2bfcf", size: 15, radius: 30, count: 8, duration: 460 };
  var canvas = null, ctx = null, sparks = [], raf = null, dpr = 1;

  var sizeCanvas = function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + "px";       /* the same box clientX / clientY are measured in */
    canvas.style.height = innerHeight + "px";
  };

  var draw = function (now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sparks = sparks.filter(function (s) {
      var t = (now - s.start) / s.duration;
      if (t >= 1) return false;
      if (t < 0) return true;
      var e = t * (2 - t);                       /* ease-out */
      var d = e * s.radius, len = s.size * (1 - e);
      var c = Math.cos(s.angle), n = Math.sin(s.angle);
      ctx.globalAlpha = 1 - t * 0.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(s.x + d * c, s.y + d * n);
      ctx.lineTo(s.x + (d + len) * c, s.y + (d + len) * n);
      ctx.strokeStyle = "rgba(24, 12, 18, 0.55)";
      ctx.lineWidth = s.width + 2.5;
      ctx.stroke();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.stroke();
      return true;
    });
    ctx.globalAlpha = 1;
    raf = sparks.length ? requestAnimationFrame(draw) : null;
  };

  var spark = function (x, y, o) {
    if (still()) return;
    o = o || {};
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      /* styled here, not in a stylesheet, so any page that loads this file gets it right */
      canvas.style.cssText = "position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000";
      document.body.appendChild(canvas);
      ctx = canvas.getContext("2d");
      sizeCanvas();
      window.addEventListener("resize", sizeCanvas);
    }
    var n = o.count || SPARK.count, now = performance.now();
    var turn = Math.random() * Math.PI;           /* so repeated taps don't look stamped */
    for (var i = 0; i < n; i++) {
      sparks.push({
        x: x, y: y, angle: turn + (2 * Math.PI * i) / n,
        start: now + (o.stagger ? (i % 2) * o.stagger : 0),
        size: o.size || SPARK.size, radius: o.radius || SPARK.radius,
        duration: o.duration || SPARK.duration, color: o.color || SPARK.color,
        width: o.width || 2
      });
    }
    if (!raf) raf = requestAnimationFrame(draw);
  };

  /* a bigger, two-ring burst from the middle of an element */
  var burst = function (el) {
    if (!el || still()) return;
    requestAnimationFrame(function () {
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      spark(x, y, { count: 12, radius: 64, size: 18, duration: 760, width: 2.2 });
      spark(x, y, { count: 12, radius: 38, size: 10, duration: 620, color: "#f6dbe3", stagger: 90 });
    });
  };

  var SPARK_ON = ".btn, .btn-mb, .nc-time, .nc-pick button, [data-spark]";
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest(SPARK_ON);
    if (!t || t.disabled) return;
    var x = e.clientX, y = e.clientY;
    if (!x && !y) {                               /* keyboard: from the middle of the button */
      var r = t.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    spark(x, y);
  }, true);

  /* ── CountUp ───────────────────────────────────────────────────
     Takes the first number in an element's text ("$1,240", "−$85",
     "62¢", "+110 Glow Points") and counts it in from where it was last
     time (0 the first time), keeping everything around it. React Bits
     drives a spring; this is the same critically damped curve with a
     fixed end, so a long tail never keeps a tile ticking. Starts when
     the number is on screen. */
  var last = new WeakMap(), lastByKey = {};
  var NUM = /\d[\d,]*(?:\.\d+)?/;

  var countUp = function (el, o) {
    if (!el || el.children.length) return;
    o = o || {};
    var text = el.textContent, m = text.match(NUM);
    if (!m) return;
    var to = parseFloat(m[0].replace(/,/g, ""));
    var from = o.key != null ? lastByKey[o.key] : last.get(el);
    if (from == null) from = o.from || 0;
    if (o.key != null) lastByKey[o.key] = to; else last.set(el, to);
    if (from === to || still() || document.hidden) return;

    var dot = m[0].indexOf(".");
    var fmt = new Intl.NumberFormat("en-US", {
      useGrouping: m[0].indexOf(",") !== -1 || (to >= 1000 && o.group !== false),
      minimumFractionDigits: dot === -1 ? 0 : m[0].length - dot - 1,
      maximumFractionDigits: dot === -1 ? 0 : m[0].length - dot - 1
    });
    var pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length);
    var shown = "";
    var show = function (v) { shown = el.textContent = pre + fmt.format(v) + post; };
    var dur = (o.duration || 1.1) * 1000, w = 7 / dur;

    show(from);
    onceVisible(el, function () {
      var t0 = performance.now() + (o.delay || 0) * 1000;
      var step = function (now) {
        if (el.textContent !== shown) return;   /* the page wrote a newer number: it wins */
        var t = Math.max(0, now - t0);
        if (t >= dur) { el.textContent = text; return; }
        var p = 1 - (1 + w * t) * Math.exp(-w * t);
        show(from + (to - from) * p);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  };

  /* ── Wire up what's already on the page ── */
  document.querySelectorAll("[data-blur-text]").forEach(blurText);
  document.querySelectorAll("[data-glare]").forEach(glare);

  window.LumevinaFX = { blurText: blurText, glare: glare, spark: spark, burst: burst, countUp: countUp };
})();
