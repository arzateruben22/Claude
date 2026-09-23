/* Lumevina — swipe reels
   On phones, any [data-reel] row becomes a horizontal swipe reel (the
   layout itself is CSS). This adds the story-style progress bar under
   it: one labelled segment per card (from data-reel-name) that fills as
   you swipe. Tapping a segment jumps to its card. The card in view is
   marked .is-active so the rest can step back. Desktop keeps its grid:
   the bar is hidden there, and nothing here runs until the row can
   actually scroll. A reel marked data-reel-tabs gets an iOS-style
   segmented control above it instead, whose highlight glides with the
   swipe. */

(function () {
  "use strict";

  var reels = document.querySelectorAll("[data-reel]");
  if (!reels.length) return;

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  Array.prototype.forEach.call(reels, function (reel) {
    var cards = Array.prototype.filter.call(reel.children, function (c) {
      return c.hasAttribute("data-reel-name");
    });
    if (cards.length < 2) return;

    var tabs = reel.hasAttribute("data-reel-tabs");
    var bar = document.createElement("div");
    bar.className = "reel-bar" + (tabs ? " reel-bar--tabs" : "");
    bar.style.setProperty("--n", cards.length);
    if (tabs) {
      var thumb = document.createElement("span");
      thumb.className = "reel-thumb";
      thumb.setAttribute("aria-hidden", "true");
      bar.appendChild(thumb);
    }
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", reel.getAttribute("data-reel-label") || "Cards");

    var fills = cards.map(function (card, i) {
      var seg = document.createElement("button");
      seg.type = "button";
      seg.className = "reel-seg";
      seg.setAttribute("aria-label", "Show " + card.getAttribute("data-reel-name"));
      seg.innerHTML = (tabs ? '' : '<span class="reel-track"><span class="reel-fill"></span></span>') +
        '<span class="reel-name"></span>';
      seg.querySelector(".reel-name").textContent = card.getAttribute("data-reel-name");
      seg.addEventListener("click", function () {
        var pad = parseFloat(getComputedStyle(reel).scrollPaddingLeft) || 0;
        var x = card.getBoundingClientRect().left - reel.getBoundingClientRect().left + reel.scrollLeft;
        reel.scrollTo({ left: x - pad, behavior: calm ? "auto" : "smooth" });
      });
      bar.appendChild(seg);
      return seg;
    });
    reel.parentNode.insertBefore(bar, tabs ? reel : reel.nextSibling);

    var raf = null;
    var update = function () {
      raf = null;
      var max = reel.scrollWidth - reel.clientWidth;
      if (max <= 1) {                       /* desktop grid: nothing to track */
        cards.forEach(function (c) { c.classList.remove("is-active", "is-dim"); });
        return;
      }
      /* 0 … n-1 as you swipe from the first card to the last, measured
         against where each card actually snaps (the last few can't reach
         the left edge, so they snap at the end of the row) */
      var pad = parseFloat(getComputedStyle(reel).scrollPaddingLeft) || 0;
      /* offsetLeft ignores the dimmed cards' scale (the reel is their
         positioned parent), so the stops don't wobble as cards shrink */
      var stops = cards.map(function (c) {
        return Math.max(0, Math.min(max, c.offsetLeft - pad));
      });
      var x = reel.scrollLeft, pos = 0;
      for (var k = 1; k < stops.length; k++) {
        if (x >= stops[k]) { pos = k; continue; }
        var span = stops[k] - stops[k - 1];
        pos = k - 1 + (span > 0 ? (x - stops[k - 1]) / span : 0);
        break;
      }
      var active = Math.round(pos);
      bar.style.setProperty("--pos", pos.toFixed(3));
      fills.forEach(function (seg, i) {
        var f = Math.max(0, Math.min(1, pos - i + 1));
        seg.style.setProperty("--fill", f.toFixed(3));
        seg.classList.toggle("is-current", i === active);
        seg.setAttribute("aria-current", i === active ? "true" : "false");
      });
      cards.forEach(function (c, i) {
        c.classList.toggle("is-active", i === active);
        c.classList.toggle("is-dim", i !== active);
      });
    };
    var queue = function () { if (!raf) raf = requestAnimationFrame(update); };

    reel.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  });
})();
