/* Lumevina — service sector explorer
   Six big sector cards front the full menu; tapping one unfolds
   its subsector panel below (Waxing opens into its three
   sub-groups). One panel open at a time; tapping the active
   sector closes it. */

(function () {
  "use strict";

  var btns = document.querySelectorAll(".sector-btn");
  var panels = document.querySelectorAll(".sector-panel");
  if (!btns.length || !panels.length) return;

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");

  btns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.dataset.sector;
      var wasOpen = btn.classList.contains("active");

      btns.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-expanded", "false");
      });
      panels.forEach(function (p) { p.hidden = true; });

      if (wasOpen) return;

      btn.classList.add("active");
      btn.setAttribute("aria-expanded", "true");
      var panel = document.querySelector(
        '.sector-panel[data-sector="' + target + '"]');
      if (!panel) return;
      panel.hidden = false;
      panel.scrollIntoView({
        behavior: rm.matches ? "auto" : "smooth",
        block: "nearest"
      });
    });
  });
})();
