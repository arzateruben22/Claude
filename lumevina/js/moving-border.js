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
    if (rect && glow) items.push({ rect: rect, glow: glow });
  });
  if (!items.length) return;

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var rafId = null;

  var tick = function (time) {
    items.forEach(function (item) {
      var length = 0;
      try { length = item.rect.getTotalLength(); } catch (err) { return; }
      if (!length) return;
      var progress = (time % DURATION) / DURATION * length;
      var pt = item.rect.getPointAtLength(progress);
      item.glow.style.transform =
        "translate(" + pt.x + "px," + pt.y + "px) translate(-50%,-50%)";
    });
    rafId = requestAnimationFrame(tick);
  };

  var play = function () {
    if (rafId === null && !rm.matches && !document.hidden) {
      rafId = requestAnimationFrame(tick);
    }
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  play();

  if (rm.addEventListener) {
    rm.addEventListener("change", function () { pause(); play(); });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });
})();
