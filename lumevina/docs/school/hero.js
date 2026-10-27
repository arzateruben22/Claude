/* Lumevina Skin School — the opening picture.
 *
 * A rendered loop of the skin block (docs/school/motion/scenes3d.mjs → "hero", written to
 * img/school/video/hero.mp4, .webm and .jpg by render.mjs), in the same look as the lesson
 * clips: a cross-section cut through skin, told in the course's three levels over 24 s:
 *   Level 1  Know your skin   the cells swell and rise; the sun leaves two dark spots
 *   Level 2  Actives          drops of vitamin C, a retinoid and niacinamide land and sink in
 *   Level 3  Treat            the spots fade, the dermis brightens as collagen builds, the skin glows
 * This script keeps the level under the clip and the subtitles on it in step with it (the clip has
 * no sound: the subtitles are its words), gives it a pause button and a subtitles switch, plays it
 * only while it's on screen, and leaves the poster frame standing for reduced motion. */
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
  /* the subtitles, timed to the picture (docs/school/motion/scenes3d.mjs → "hero") */
  var SUBS = [
    { t: 0, s: "New cells rise to the surface about every four weeks." },
    { t: 4, s: "The sun reaches the skin and leaves two dark spots behind." },
    { t: 8, s: "Drops of vitamin C, a retinoid and niacinamide land on the skin." },
    { t: 12, s: "They sink in: the right active, in the right order, on the right night." },
    { t: 16, s: "The spots fade and collagen builds." },
    { t: 20, s: "And the glow comes through." }
  ];
  var subEl = document.getElementById("skin-sub"), ccBtn = document.getElementById("skin-cc"), ppBtn = document.getElementById("skin-pp");
  var subNow = -1;
  var showSub = function (t) {
    var k = 0;
    for (var i = 0; i < SUBS.length; i++) if (t >= SUBS[i].t) k = i;
    if (k !== subNow && subEl) { subNow = k; subEl.textContent = SUBS[k].s; }
  };
  var cc = true;
  try { cc = localStorage.getItem("lumevina_school_cc") !== "off"; } catch (e) { /* storage blocked */ }
  var setCc = function (on) {
    cc = on;
    wrap.setAttribute("data-cc", on ? "on" : "off");
    if (ccBtn) { ccBtn.setAttribute("aria-pressed", on ? "true" : "false"); ccBtn.setAttribute("aria-label", on ? "Hide subtitles" : "Show subtitles"); }
    try { localStorage.setItem("lumevina_school_cc", on ? "on" : "off"); } catch (e) { /* storage blocked */ }
  };
  setCc(cc);
  if (ccBtn) ccBtn.addEventListener("click", function () { setCc(!cc); });
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
    showSub(t);
  });
  v.addEventListener("error", function () { wrap.classList.add("no-clip"); }, true);
  show(0); showSub(0);
  /* pause and play: a pause from the viewer stays until they press play again */
  var held = false;
  var paint = function () {
    var paused = v.paused;
    wrap.classList.toggle("is-paused", paused);
    if (ppBtn) ppBtn.setAttribute("aria-label", paused ? "Play the animation" : "Pause the animation");
  };
  v.addEventListener("play", paint); v.addEventListener("pause", paint);
  var play = function () { var p = v.play(); if (p && p.catch) p.catch(function () { paint(); /* the poster stands */ }); };
  if (ppBtn) ppBtn.addEventListener("click", function () {
    if (v.paused) { held = false; play(); } else { held = true; v.pause(); }
  });
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) { held = true; v.removeAttribute("autoplay"); v.pause(); show(2); showSub(16); paint(); return; }
  /* play only while it's on screen, unless the viewer paused it */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { if (!held) play(); } else v.pause(); });
    }, { threshold: 0.15 }).observe(v);
  } else play();
  paint();
})();
