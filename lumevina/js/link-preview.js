/* Lumevina — link preview
   A vanilla port of the 21st.dev/Aceternity LinkPreview hover card.
   The original fetches live screenshots from microlink.io and is
   React/Framer-Motion; we keep the *feeling* — a preview that springs
   up and follows the cursor — but self-hosted (no external requests,
   no third-party screenshots) and desktop-only, so on touch the tagged
   links behave exactly as before. Attaches to any [data-lp-title]. */

(function () {
  "use strict";

  var links = document.querySelectorAll("[data-lp-title]");
  if (!links.length) return;

  /* hover previews only make sense with a fine pointer + motion on */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!fine.matches || reduce.matches) return;

  /* one reusable floating card */
  var card = document.createElement("div");
  card.className = "lp-card";
  card.setAttribute("aria-hidden", "true");
  card.innerHTML =
    '<span class="lp-accent"></span>' +
    '<svg class="lp-motif" width="46" height="46" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3c2.5 3 4 5.2 4 7.5a4 4 0 0 1-8 0C8 8.2 9.5 6 12 3Z"/></svg>' +
    '<span class="lp-title"></span>' +
    '<span class="lp-desc"></span>' +
    '<span class="lp-foot">Opens in a new tab ↗</span>';
  document.body.appendChild(card);
  var titleEl = card.querySelector(".lp-title");
  var descEl = card.querySelector(".lp-desc");

  /* subtle horizontal cursor-follow, eased toward the target (the
     spring in the original) */
  var centerX = 0, targetX = 0, curX = 0, raf = null;

  var place = function () { card.style.left = (centerX + curX) + "px"; };

  var tick = function () {
    curX += (targetX - curX) * 0.15;
    place();
    if (Math.abs(targetX - curX) > 0.3) {
      raf = requestAnimationFrame(tick);
    } else {
      curX = targetX; place(); raf = null;
    }
  };

  links.forEach(function (link) {
    link.addEventListener("mouseenter", function () {
      titleEl.textContent = link.dataset.lpTitle;
      descEl.textContent = link.dataset.lpDesc;
      card.className = "lp-card lp-tint-" + (link.dataset.lpTint || "1");
      var r = link.getBoundingClientRect();
      /* keep the card on-screen even near the edges */
      centerX = Math.min(Math.max(r.left + r.width / 2, 130),
        window.innerWidth - 130);
      card.style.top = r.top + "px";
      curX = targetX = 0;
      place();
      requestAnimationFrame(function () { card.classList.add("show"); });
    });

    link.addEventListener("mousemove", function (e) {
      var r = link.getBoundingClientRect();
      targetX = (e.clientX - (r.left + r.width / 2)) / 2; /* halved = subtle */
      if (!raf) raf = requestAnimationFrame(tick);
    });

    link.addEventListener("mouseleave", function () {
      card.classList.remove("show");
    });
  });
})();
