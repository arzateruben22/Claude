/* Lumevina — card spotlight
   A soft rose light that follows the pointer across a card, the way
   Apple's product tiles catch the light. Any [data-spotlight] element
   picks it up (delegated, so JS-rendered shelf cards work too). The
   light itself is CSS (::before reading --sx / --sy); this only feeds
   it coordinates. Mouse and trackpad only: touch has no hover. */

(function () {
  "use strict";

  if (!window.matchMedia("(pointer: fine)").matches) return;

  var raf = null, pending = null;

  document.addEventListener("pointermove", function (e) {
    var card = e.target.closest && e.target.closest("[data-spotlight]");
    if (!card) return;
    pending = { card: card, x: e.clientX, y: e.clientY };
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      var r = pending.card.getBoundingClientRect();
      pending.card.style.setProperty("--sx", (pending.x - r.left) + "px");
      pending.card.style.setProperty("--sy", (pending.y - r.top) + "px");
    });
  }, { passive: true });
})();
