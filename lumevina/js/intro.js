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
  if (!location.hash) resetTop();   /* a link to #services and the like keeps its place */

  /* it plays every time the site opens (Ruben, Oct 19: "make it every
     time"); any tap, key or scroll lifts it early */
  var seen = document.documentElement.classList.contains("no-intro");
  try { sessionStorage.setItem("lumevina_intro_seen", "1"); } catch (e) { /* storage blocked */ }
  if (seen) {
    intro.classList.add("intro-done");
    if (!location.hash) { [0, 120, 350].forEach(function (t) { setTimeout(resetTop, t); }); }
    return;
  }

  /* Reduce Motion: the same greeting as a soft fade (styles.css), nothing moves */

  /* hold the page still while the veil is up — via a class, so main.js
     resetting inline body overflow on load can't unlock us early */
  document.body.classList.add("intro-lock");

  var done = false;
  var timers = [];

  /* keep snapping to top under the veil until well past any late
     scroll restoration */
  /* a link to a section (#book…) lands there instead of the top */
  var land = function () {
    var t = location.hash && document.getElementById(location.hash.slice(1));
    if (t) t.scrollIntoView({ block: "start" }); else resetTop();
  };
  if (!location.hash) {
    [60, 200, 500, 900].forEach(function (t) { timers.push(setTimeout(resetTop, t)); });
    window.addEventListener("load", resetTop);
  }

  /* the greeting starts once the logo is on screen (not while the page is
     still loading, or it would be over before anyone sees it): the mark
     settles in, the words follow one by one, then the veil lifts */
  var started = false;
  var begin = function () {
    if (started || done) return;
    started = true;
    intro.classList.add("intro-go");
    intro.querySelectorAll("[data-delay]").forEach(function (el) {
      var delay = parseInt(el.getAttribute("data-delay"), 10) || 0;
      timers.push(setTimeout(function () { el.classList.add("intro-anim"); }, delay));
    });
    /* auto-lift: it's a greeting, not a wait (the words land by ~1.3s) */
    timers.push(setTimeout(function () { dismiss(); }, 2600));
  };
  var mark = intro.querySelector(".intro-mark");
  if (!mark || (mark.complete && mark.naturalWidth)) setTimeout(begin, 60);
  else {
    mark.addEventListener("load", begin);
    mark.addEventListener("error", begin);
    timers.push(setTimeout(begin, 1500));   /* a slow logo never holds the page */
  }

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
    /* land on the hero (or the section the link named) now that we're unlocked */
    land();
    /* positions were measured while scroll was locked — recompute now
       that the page is scrollable, so the first scroll is accurate */
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    setTimeout(function () { intro.classList.add("intro-done"); }, 660);
  };

  var onKey = function () { dismiss(); };
  var onWheel = function () { dismiss(); };

  intro.addEventListener("click", function (e) { dismiss(e.clientX, e.clientY); });
  window.addEventListener("keydown", onKey);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchmove", onWheel, { passive: true });

})();
