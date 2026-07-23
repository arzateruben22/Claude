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

  /* every refresh returns to the top. Tell the browser not to restore
     the old scroll position, and force the top instantly (the page's
     scroll-behavior:smooth would otherwise animate it). Some browsers
     (notably mobile) restore late, after our script — so we snap to
     top a few times while the veil covers the page, then again at the
     lift, which reliably beats the restore. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var resetTop = function () {
    var html = document.documentElement;
    var prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    html.style.scrollBehavior = prev;
  };
  resetTop();

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) {
    /* CSS already hides it; make sure nothing is locked, and still
       land at the top on refresh (catch late restores too) */
    intro.classList.add("intro-done");
    [0, 120, 350].forEach(function (t) { setTimeout(resetTop, t); });
    window.addEventListener("load", resetTop);
    return;
  }

  /* hold the page still while the veil is up — via a class, so main.js
     resetting inline body overflow on load can't unlock us early */
  document.body.classList.add("intro-lock");

  var done = false;
  var timers = [];

  /* keep snapping to top under the veil until well past any late
     scroll restoration */
  [60, 200, 500, 900].forEach(function (t) { timers.push(setTimeout(resetTop, t)); });
  window.addEventListener("load", resetTop);

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
    /* land on the hero now that we're unlocked */
    resetTop();
    /* positions were measured while scroll was locked — recompute now
       that the page is scrollable, so the first scroll is accurate */
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
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
