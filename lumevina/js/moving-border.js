/* Lumevina — moving border buttons
   Vanilla port of Aceternity's MovingBorder: a soft glow travels
   the perimeter of a button, traced along a hidden SVG rect with
   getPointAtLength (the same technique the React version uses via
   framer-motion). Markup:

     <a class="btn-mb">
       <span class="btn-mb-border"><svg><rect/></svg><span class="btn-mb-glow"></span></span>
       <span class="btn btn-solid btn-mb-inner">Label</span>
     </a>

   Reduced motion hides the glow. Buttons inside hidden containers
   (the checkout modal) report zero path length until shown; the
   loop just skips them until then. */

(function () {
  "use strict";

  var buttons = document.querySelectorAll(".btn-mb");
  if (!buttons.length) return;

  var DURATION = 3200;

  var items = [];
  buttons.forEach(function (btn) {
    var rect = btn.querySelector(".btn-mb-border rect");
    var glow = btn.querySelector(".btn-mb-glow");
    if (rect && glow) items.push({ btn: btn, rect: rect, glow: glow, seen: false, length: 0 });
  });
  if (!items.length) return;

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var touch = window.matchMedia("(pointer: coarse)");
  var rafId = null, skip = 0;

  /* a button off screen costs nothing: the loop runs only while at least one is in view
     (it used to run for every button, all the time, even scrolled far away) */
  var anySeen = function () { return items.some(function (it) { return it.seen; }); };

  var tick = function (time) {
    rafId = null;
    if (!anySeen()) return;
    if (touch.matches && (skip ^= 1)) { rafId = requestAnimationFrame(tick); return; }   /* 30 fps is plenty on a phone */
    items.forEach(function (item) {
      if (!item.seen) return;
      if (!item.length) {
        try { item.length = item.rect.getTotalLength(); } catch (err) { return; }
      }
      if (!item.length) return;
      var progress = (time % DURATION) / DURATION * item.length;
      var pt = item.rect.getPointAtLength(progress);
      item.glow.style.transform =
        "translate(" + pt.x + "px," + pt.y + "px) translate(-50%,-50%)";
    });
    rafId = requestAnimationFrame(tick);
  };

  var play = function () {
    if (rafId === null && !rm.matches && !document.hidden && anySeen()) {
      rafId = requestAnimationFrame(tick);
    }
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var it = items.filter(function (x) { return x.btn === e.target; })[0];
        if (it) { it.seen = e.isIntersecting; if (e.isIntersecting) it.length = 0; }   /* measure again: it may have been hidden or resized */
      });
      if (anySeen()) play(); else pause();
    }, { rootMargin: "60px 0px" });
    items.forEach(function (it) { io.observe(it.btn); });
  } else {
    items.forEach(function (it) { it.seen = true; });
    play();
  }

  if (rm.addEventListener) {
    rm.addEventListener("change", function () { pause(); play(); });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });
})();
