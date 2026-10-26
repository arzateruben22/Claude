/* Lumevina Skin School — the opening picture.
 *
 * A rendered loop of living skin (docs/school/motion/scenes3d.mjs → "hero", written to
 * img/school/video/hero.mp4, .webm and .jpg by render.mjs), in the same look as the lesson
 * clips: a cross-section cut through skin, told in the course's three levels over 24 s:
 *   Level 1  Know your skin   the cells swell and rise; the sun leaves two dark spots
 *   Level 2  Actives          drops of vitamin C, a retinoid and niacinamide land and sink in
 *   Level 3  Treat            the spots fade, the dermis brightens as collagen builds, the skin glows
 * This script keeps the caption under the clip in step with it, plays it only while it's on
 * screen, and leaves the poster frame standing for reduced motion or a browser that won't play. */
(function () {
  "use strict";
  var v = document.getElementById("skin");
  if (!v || v.tagName !== "VIDEO") return;
  var wrap = v.parentNode;
  var phaseEl = document.getElementById("skin-phase");
  var descEl = document.getElementById("skin-desc");
  var PH = [
    { t: 0, name: "Level 1 · Know your skin", desc: "New cells rise to the surface about every four weeks." },
    { t: 8, name: "Level 2 · Actives", desc: "The right active, in the right order, on the right night." },
    { t: 16, name: "Level 3 · Treat", desc: "Spots fade, collagen builds, and the glow comes through." }
  ];
  var cur = -1;
  var show = function (k) {
    if (k === cur) return;
    cur = k;
    wrap.setAttribute("data-phase", String(k));
    if (phaseEl) phaseEl.textContent = PH[k].name;
    if (descEl) descEl.textContent = PH[k].desc;
  };
  v.addEventListener("timeupdate", function () {
    var t = v.currentTime;
    show(t >= PH[2].t ? 2 : t >= PH[1].t ? 1 : 0);
  });
  v.addEventListener("error", function () { wrap.classList.add("no-clip"); }, true);
  show(0);
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) { v.removeAttribute("autoplay"); v.pause(); show(2); return; }
  /* play only while it's on screen */
  var play = function () { var p = v.play(); if (p && p.catch) p.catch(function () { /* the poster stands */ }); };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) play(); else v.pause(); });
    }, { threshold: 0.15 }).observe(v);
  } else play();
})();
