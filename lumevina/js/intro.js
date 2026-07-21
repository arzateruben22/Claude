/* Lumevina — intro / arrival overlay
   A brief serene greeting on open: the mark and a few words settle in,
   then the veil lifts to the hero. Warm-palette port of the 21st.dev
   "Digital Serenity" landing — kept short, dismissible on ANY
   interaction, and skipped entirely under reduced-motion so it's an
   atmosphere touch, never a barrier to booking. */

(function () {
  "use strict";

  var intro = document.getElementById("intro");
  if (!intro) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) {
    /* CSS already hides it; make sure nothing is locked */
    intro.classList.add("intro-done");
    return;
  }

  /* hold the page still while the veil is up — via a class, so main.js
     resetting inline body overflow on load can't unlock us early */
  document.body.classList.add("intro-lock");

  var done = false;
  var timers = [];

  /* word-by-word reveal, driven by each element's data-delay */
  intro.querySelectorAll("[data-delay]").forEach(function (el) {
    var delay = parseInt(el.getAttribute("data-delay"), 10) || 0;
    timers.push(setTimeout(function () { el.classList.add("intro-anim"); }, delay));
  });

  /* soft glow follows the cursor (desktop; harmless on touch) */
  var glow = document.getElementById("intro-glow");
  var onMove = function (e) {
    if (!glow) return;
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
    glow.style.opacity = "1";
  };
  document.addEventListener("mousemove", onMove);

  /* a gentle ripple where you tap — then we lift */
  var ripple = function (x, y) {
    var r = document.createElement("span");
    r.className = "intro-ripple";
    r.style.left = x + "px";
    r.style.top = y + "px";
    document.body.appendChild(r);
    setTimeout(function () { r.remove(); }, 900);
  };

  var dismiss = function (x, y) {
    if (done) return;
    done = true;
    if (x != null) ripple(x, y);
    timers.forEach(clearTimeout);
    document.removeEventListener("mousemove", onMove);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", onWheel, { passive: true });
    window.removeEventListener("touchmove", onWheel, { passive: true });
    intro.classList.add("intro-out");
    document.body.classList.remove("intro-lock");
    setTimeout(function () { intro.classList.add("intro-done"); }, 820);
  };

  var onKey = function () { dismiss(); };
  var onWheel = function () { dismiss(); };

  intro.addEventListener("click", function (e) { dismiss(e.clientX, e.clientY); });
  window.addEventListener("keydown", onKey);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchmove", onWheel, { passive: true });

  /* auto-lift if they just want to watch it breathe */
  timers.push(setTimeout(function () { dismiss(); }, 3200));
})();
