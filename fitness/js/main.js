/* SchFLR — nav, mobile menu, GSAP motion */

(function () {
  "use strict";

  /* ── Mobile menu ─────────────────────────────────────────── */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("mobile-menu");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        menu.hidden = true;
      }
    });
  }

  /* ── Footer year ─────────────────────────────────────────── */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Plans: tap to select, pay-in-full / split toggle ────── */
  /* Ported from a React pricing component: animated selection
     ring, sliding toggle thumb, and rolling price numbers. */
  (function () {
    var grid = document.querySelector(".plans-grid");
    var toggle = document.querySelector(".pay-toggle");
    if (!grid || !toggle) return;

    var plans = [].slice.call(grid.querySelectorAll(".plan"));
    var bar = document.querySelector(".plan-bar");
    var barName = bar && bar.querySelector(".plan-bar-name");
    var barAmount = bar && bar.querySelector(".plan-bar-amount");
    var barPer = bar && bar.querySelector(".plan-bar-per");
    var barCta = bar && bar.querySelector(".plan-bar-cta");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var mode = "full";
    var selected = grid.querySelector(".plan-featured") || plans[0];

    function fmt(n) {
      return "$" + Number(n).toLocaleString("en-US");
    }

    function roll(el, text) {
      if (!el || el.textContent === text) return;
      if (reduce) { el.textContent = text; return; }
      el.classList.remove("roll-in");
      el.classList.add("roll-out");
      window.setTimeout(function () {
        el.textContent = text;
        el.classList.remove("roll-out");
        el.classList.add("roll-in");
      }, 130);
    }

    function apply() {
      grid.classList.toggle("split", mode === "split");
      plans.forEach(function (p) {
        roll(p.querySelector(".plan-amount"), fmt(p.dataset[mode]));
        p.querySelector(".plan-per").textContent =
          mode === "split" ? "today" : "/ month";
        var on = p === selected;
        p.classList.toggle("is-selected", on);
        p.setAttribute("aria-checked", String(on));
      });
      if (bar) {
        barName.textContent = selected.dataset.name;
        roll(barAmount, fmt(selected.dataset[mode]));
        barPer.textContent = mode === "split" ? "today" : "/ month";
        barCta.textContent = "Book " + selected.dataset.name;
      }
    }

    plans.forEach(function (p) {
      p.addEventListener("click", function () {
        selected = p;
        apply();
      });
      p.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selected = p;
          apply();
        }
      });
    });

    toggle.addEventListener("click", function (e) {
      var btn = e.target.closest(".pt-btn");
      if (!btn) return;
      mode = btn.dataset.mode;
      toggle.classList.toggle("split", mode === "split");
      [].forEach.call(toggle.querySelectorAll(".pt-btn"), function (b) {
        var on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      apply();
    });

    apply();
  })();

  /* ── Reactive glow waves ─────────────────────────────────── */
  /* Orange/gold light trails across the hero that ease toward the
     cursor. Ported from a canvas wave hero into plain JS. */
  (function () {
    var hero = document.querySelector(".hero");
    var canvas = document.querySelector(".hero-waves");
    if (!hero || !canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var mouse = { x: 0, y: 0 };
    var target = { x: 0, y: 0 };
    var time = 0;
    var rafId = null;
    var visible = true;

    var waves = [
      { offset: 0,             amp: 26, freq: 0.0032, rgb: "249,115,22",  alpha: 0.5 },
      { offset: Math.PI / 2,   amp: 36, freq: 0.0023, rgb: "249,115,22",  alpha: 0.26 },
      { offset: Math.PI,       amp: 20, freq: 0.0041, rgb: "201,162,39",  alpha: 0.3 },
      { offset: Math.PI * 1.5, amp: 30, freq: 0.0019, rgb: "236,234,228", alpha: 0.12 }
    ];

    function resize() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mouse.x = target.x = W / 2;
      mouse.y = target.y = H * 0.78;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var base = H * 0.78;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        ctx.beginPath();
        for (var x = 0; x <= W; x += 4) {
          var dx = x - mouse.x;
          var dy = base - mouse.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var influence = Math.max(0, 1 - dist / 320);
          var mouseEffect = influence * 46 *
            Math.sin(time * 0.001 + x * 0.01 + w.offset);
          var y = base +
            Math.sin(x * w.freq + time * 0.002 + w.offset) * w.amp +
            Math.sin(x * w.freq * 0.4 + time * 0.003) * w.amp * 0.45 +
            mouseEffect;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(" + w.rgb + "," + w.alpha + ")";
        ctx.shadowBlur = 26;
        ctx.shadowColor = "rgba(" + w.rgb + ",0.9)";
        ctx.stroke();
      }
    }

    function frame() {
      time += 16;
      mouse.x += (target.x - mouse.x) * 0.1;
      mouse.y += (target.y - mouse.y) * 0.1;
      draw();
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (rafId === null && visible && !reduce) {
        rafId = window.requestAnimationFrame(frame);
      }
    }
    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      target.x = e.clientX - r.left;
      target.y = e.clientY - r.top;
    });
    window.addEventListener("mouseout", function () {
      target.x = W / 2;
      target.y = H * 0.78;
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }).observe(hero);
    }

    if (reduce) {
      draw(); // one calm, static frame
    } else {
      start();
    }
  })();

  /* ── Motion ──────────────────────────────────────────────── */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined") return;

  document.documentElement.classList.add("js-motion");
  gsap.registerPlugin(ScrollTrigger);

  /* Page-load sequence: headline rises, copy fades, then the
     month calendars fill in — session squares landing last. */
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  intro
    .fromTo(".hero-title .line-inner",
      { yPercent: 110, opacity: 1 },
      { yPercent: 0, duration: 0.9, stagger: 0.12 }, 0.1)
    .fromTo("[data-load]",
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 }, 0.5)
    .fromTo(".month-grid span:not(.on)",
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.004 }, 0.6)
    .fromTo(".month-grid span.on",
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 0.3, stagger: 0.05, ease: "back.out(2)" }, 1.0);

  /* Scroll reveals */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.fromTo(el,
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
  });
})();
