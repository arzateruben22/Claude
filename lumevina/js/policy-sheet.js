/* Lumevina — policies as tiles + bottom sheet (phones)
   On narrow screens the Before You Book accordion folds into a compact
   two-column grid: every policy visible at once as a tile. Tapping one
   slides up an iOS-style sheet with its full text, with previous / next
   to page through the rest. Drag the sheet down, tap outside, or press
   Escape to close it. The sheet copies each policy from its own
   <details>, so there's one source of text; wider screens keep the
   accordion (or the desktop shelf in js/policy-panels.js). */

(function () {
  "use strict";

  var list = document.querySelector(".policies-list");
  if (!list) return;
  var details = Array.prototype.slice.call(list.querySelectorAll(".policy"));
  if (!details.length) return;

  var phone = window.matchMedia("(max-width: 760px)");
  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var titleOf = function (d) {
    var s = d.querySelector("summary");
    var num = s.querySelector(".policy-num").textContent;
    return s.textContent.replace(num, "").replace(/\s+/g, " ").trim();
  };

  /* ── the sheet ── */
  var sheet = document.createElement("div");
  sheet.className = "policy-sheet";
  sheet.hidden = true;
  sheet.innerHTML =
    '<div class="policy-sheet-backdrop" data-close></div>' +
    '<div class="policy-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="policy-sheet-title" tabindex="-1">' +
      '<div class="policy-sheet-grab" aria-hidden="true"><span></span></div>' +
      '<div class="policy-sheet-head">' +
        '<p class="policy-sheet-num"></p>' +
        '<button class="policy-sheet-close" type="button" aria-label="Close" data-close>' +
          '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
        '</button>' +
      '</div>' +
      '<h3 class="policy-sheet-title" id="policy-sheet-title"></h3>' +
      '<div class="policy-sheet-body"></div>' +
      '<div class="policy-sheet-nav">' +
        '<button class="policy-sheet-step" type="button" data-step="-1"><span aria-hidden="true">←</span> <span class="ps-label"></span></button>' +
        '<button class="policy-sheet-step" type="button" data-step="1"><span class="ps-label"></span> <span aria-hidden="true">→</span></button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(sheet);

  var panel = sheet.querySelector(".policy-sheet-panel");
  var numEl = sheet.querySelector(".policy-sheet-num");
  var titleEl = sheet.querySelector(".policy-sheet-title");
  var bodyEl = sheet.querySelector(".policy-sheet-body");
  var prevBtn = sheet.querySelector('[data-step="-1"]');
  var nextBtn = sheet.querySelector('[data-step="1"]');

  var current = -1;
  var opener = null;

  var fill = function (i, dir) {
    current = i;
    var d = details[i];
    numEl.textContent = d.querySelector(".policy-num").textContent + " of " +
      String(details.length).padStart(2, "0");
    titleEl.textContent = titleOf(d);
    bodyEl.innerHTML = d.querySelector(".policy-body").innerHTML;
    var p = details[i - 1], n = details[i + 1];
    prevBtn.hidden = !p;
    nextBtn.hidden = !n;
    if (p) prevBtn.querySelector(".ps-label").textContent = titleOf(p);
    if (n) nextBtn.querySelector(".ps-label").textContent = titleOf(n);
    details.forEach(function (x, k) { x.classList.toggle("is-current", k === i); });
    if (dir && !calm) {
      panel.classList.remove("step-left", "step-right");
      void panel.offsetWidth;
      panel.classList.add(dir > 0 ? "step-right" : "step-left");
    }
  };

  var open = function (i) {
    opener = document.activeElement;
    fill(i);
    sheet.hidden = false;
    document.documentElement.classList.add("sheet-open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { sheet.classList.add("is-open"); });
    });
    panel.focus({ preventScroll: true });
  };

  var close = function () {
    if (sheet.hidden) return;
    sheet.classList.remove("is-open");
    panel.style.transform = "";
    document.documentElement.classList.remove("sheet-open");
    details.forEach(function (x) { x.classList.remove("is-current"); });
    var done = function () { sheet.hidden = true; };
    if (calm) done(); else setTimeout(done, 380);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  };

  /* ── tile mode on/off with the breakpoint ── */
  var apply = function () {
    var on = phone.matches;
    list.classList.toggle("is-tiles", on);
    if (on) details.forEach(function (d) { d.open = false; });
    else close();
  };
  apply();
  if (phone.addEventListener) phone.addEventListener("change", apply);
  else if (phone.addListener) phone.addListener(apply);

  details.forEach(function (d, i) {
    d.querySelector("summary").addEventListener("click", function (e) {
      if (!list.classList.contains("is-tiles")) return;
      e.preventDefault();
      open(i);
    });
  });

  sheet.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-close]")) { close(); return; }
    var step = t.closest("[data-step]");
    if (step) { fill(current + Number(step.getAttribute("data-step")), Number(step.getAttribute("data-step"))); return; }
    /* "Move an appointment" hands off to the booking modal */
    if (t.closest(".policy-resched-start")) close();
  });

  document.addEventListener("keydown", function (e) {
    if (sheet.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "Tab") {
      var f = Array.prototype.filter.call(
        panel.querySelectorAll("button, a[href]"), function (el) { return !el.hidden && el.offsetParent; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ── drag down to dismiss (from the grab bar / header) ── */
  var startY = null, dy = 0;
  var handle = function (e) { return e.target.closest(".policy-sheet-grab, .policy-sheet-head, .policy-sheet-title"); };
  panel.addEventListener("pointerdown", function (e) {
    if (!handle(e) || e.target.closest("button")) return;
    startY = e.clientY; dy = 0;
    panel.classList.add("is-dragging");
    panel.setPointerCapture(e.pointerId);
  });
  panel.addEventListener("pointermove", function (e) {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.transform = "translateY(" + dy + "px)";
  });
  var release = function () {
    if (startY === null) return;
    startY = null;
    panel.classList.remove("is-dragging");
    if (dy > 90) close(); else panel.style.transform = "";
  };
  panel.addEventListener("pointerup", release);
  panel.addEventListener("pointercancel", release);
})();
