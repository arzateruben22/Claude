/* Lumevina — policies as a cursor-interactive 3D shelf
   Vanilla port of the StackedPanels component, fused with the
   Before You Book accordion: on desktop (fine pointer, wide
   viewport, motion allowed) the accordion folds into a tilted row
   of panels — one per policy — that ripple toward the cursor with
   a gaussian wave; clicking a panel shows that policy's full text
   in the detail card below. Panels are real buttons, built from
   the accordion's own content, so nothing is duplicated. On touch,
   narrow screens, or reduced motion the accordion remains. */

(function () {
  "use strict";

  var section = document.querySelector(".section-policies");
  var stage = document.querySelector(".policies-stage");
  var scene = stage && stage.querySelector(".policies-scene");
  var detailCard = document.querySelector(".policy-detail");
  if (!section || !stage || !scene || !detailCard) return;

  var details = Array.prototype.slice.call(
    document.querySelectorAll(".policies-list .policy"));
  if (details.length < 2) return;

  var detailTitle = detailCard.querySelector(".policy-detail-title");
  var detailBody = detailCard.querySelector(".policy-detail-body");

  var N = details.length;
  /* spread across X so every panel stays clickable, with a slight
     Z recession for depth (the original stacked purely in Z, but
     those panels were decorative — ours are buttons) */
  var X_SPREAD = 122;
  var Z_SPREAD = 22;
  var SIGMA = 1.6;
  var BASE_RY = -16;
  var BASE_RX = 8;

  var panels = [];
  var selected = -1;

  details.forEach(function (d, i) {
    var num = d.querySelector(".policy-num").textContent;
    var summary = d.querySelector("summary");
    var title = summary.textContent.replace(num, "").trim();

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "policy-panel panel-tint-" + ((i % 8) + 1);
    btn.setAttribute("aria-label", "Show policy: " + title);

    var numEl = document.createElement("span");
    numEl.className = "panel-num";
    numEl.textContent = num;
    var titleEl = document.createElement("span");
    titleEl.className = "panel-title";
    titleEl.textContent = title;
    btn.appendChild(numEl);
    btn.appendChild(titleEl);

    var t = i / (N - 1);
    var w = 178 + t * 16;
    var h = 220 + t * 44;
    btn.style.width = w + "px";
    btn.style.height = h + "px";
    btn.style.marginLeft = (-w / 2) + "px";
    btn.style.marginTop = (-h / 2) + "px";
    btn.style.opacity = String(0.55 + t * 0.45);

    btn.addEventListener("click", function () { select(i); });
    scene.appendChild(btn);

    panels.push({
      el: btn,
      x: (i - (N - 1) / 2) * X_SPREAD,
      z: (i - (N - 1)) * Z_SPREAD,
      y: 0, targetY: 0,
      s: 1, targetS: 1
    });
  });

  var select = function (i) {
    selected = i;
    panels.forEach(function (p, j) {
      p.el.classList.toggle("selected", j === i);
    });
    var d = details[i];
    detailTitle.textContent =
      d.querySelector(".policy-num").textContent + " · " +
      d.querySelector("summary").textContent
        .replace(d.querySelector(".policy-num").textContent, "").trim();
    detailBody.innerHTML = d.querySelector(".policy-body").innerHTML;
    detailCard.classList.remove("show");
    void detailCard.offsetWidth; /* restart entrance animation */
    detailCard.classList.add("show");
  };

  /* scene tilt + gaussian wave, smoothed each frame */
  var ry = BASE_RY, targetRY = BASE_RY;
  var rx = BASE_RX, targetRX = BASE_RX;

  stage.addEventListener("mousemove", function (e) {
    var rect = stage.getBoundingClientRect();
    var cx = (e.clientX - rect.left) / rect.width;
    var cy = (e.clientY - rect.top) / rect.height;
    targetRY = BASE_RY + (cx - 0.5) * 10;
    targetRX = BASE_RX + (cy - 0.5) * -7;
    var cursorPos = cx * (N - 1);
    panels.forEach(function (p, i) {
      var dist = Math.abs(i - cursorPos);
      var influence = Math.exp(-(dist * dist) / (2 * SIGMA * SIGMA));
      p.targetY = -influence * 60;
      p.targetS = 0.45 + influence * 0.55;
    });
  });

  stage.addEventListener("mouseleave", function () {
    targetRY = BASE_RY;
    targetRX = BASE_RX;
    panels.forEach(function (p) { p.targetY = 0; p.targetS = 1; });
  });

  var rafId = null;
  var inView = true;

  var frame = function () {
    ry += (targetRY - ry) * 0.1;
    rx += (targetRX - rx) * 0.1;
    scene.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
    panels.forEach(function (p) {
      p.y += (p.targetY - p.y) * 0.14;
      p.s += (p.targetS - p.s) * 0.14;
      p.el.style.transform =
        "translateX(" + p.x + "px) translateZ(" + p.z + "px) translateY(" + p.y + "px) scaleY(" + p.s + ")";
    });
    rafId = requestAnimationFrame(frame);
  };

  var active = false;

  var play = function () {
    if (rafId === null && active && inView && !document.hidden) {
      rafId = requestAnimationFrame(frame);
    }
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  /* shelf only where it works: wide viewport, real cursor, motion ok */
  var mqShelf = window.matchMedia(
    "(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

  var apply = function () {
    active = mqShelf.matches;
    section.classList.toggle("has-shelf", active);
    if (active) {
      if (selected === -1) select(0);
      /* draw once so the shelf isn't blank before the first pointer move */
      panels.forEach(function (p) {
        p.el.style.transform =
          "translateX(" + p.x + "px) translateZ(" + p.z + "px) translateY(" + p.y + "px) scaleY(" + p.s + ")";
      });
      scene.style.transform = "rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
      play();
    } else {
      pause();
    }
  };

  apply();
  if (mqShelf.addEventListener) mqShelf.addEventListener("change", apply);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) play(); else pause();
    }, { threshold: 0 }).observe(stage);
  }
})();
