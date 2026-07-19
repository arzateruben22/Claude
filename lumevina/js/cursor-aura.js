/* Lumevina — cursor aura
   The cursor interaction from the LivingNebula component: a soft
   rose glow trails the pointer (eased, slightly behind) and swells
   over anything clickable. Desktop-only (pointer: fine) and skipped
   entirely under prefers-reduced-motion; the shader-side warp that
   completes the effect lives in js/liquid-metal.js. */

(function () {
  "use strict";

  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var aura = document.createElement("div");
  aura.className = "cursor-aura";
  aura.setAttribute("aria-hidden", "true");
  var dot = document.createElement("span");
  dot.className = "cursor-aura-dot";
  aura.appendChild(dot);
  document.body.appendChild(aura);

  var targetX = -100, targetY = -100;
  var x = -100, y = -100;
  var shown = false;
  var rafId = null;

  document.addEventListener("pointermove", function (e) {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!shown) {
      x = targetX;
      y = targetY;
      aura.classList.add("visible");
      shown = true;
    }
    var el = e.target;
    var interactive = !!(el && el.closest &&
      el.closest("a, button, [role='button'], input, textarea, label"));
    aura.classList.toggle("is-active", interactive);
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", function () {
    aura.classList.remove("visible");
    shown = false;
  });

  var loop = function () {
    x += (targetX - x) * 0.18;
    y += (targetY - y) * 0.18;
    aura.style.transform =
      "translate3d(" + x + "px," + y + "px,0) translate(-50%,-50%)";
    rafId = requestAnimationFrame(loop);
  };

  var play = function () {
    if (rafId === null && !document.hidden) rafId = requestAnimationFrame(loop);
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  play();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });
})();
