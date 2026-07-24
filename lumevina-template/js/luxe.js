/* Lumevina — luxe interactions
   Scroll-reveal (fade + rise, staggered), nav-shrink on scroll, and a
   floating Book button that appears past the hero. Vanilla, and fully
   reduced-motion safe (reveals show instantly, no float animation). */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ── nav shrink ── */
  var nav = document.querySelector(".nav");
  if (nav) {
    var onNav = function () { nav.classList.toggle("scrolled", window.scrollY > 28); };
    onNav();
    window.addEventListener("scroll", onNav, { passive: true });
  }

  /* ── scroll reveal ── */
  var SELECTORS = [
    "#treatments .cat-head", ".cat-grid .cat", ".actives",
    "#about .founder", "#about .best",
    "#ritual .center > *", ".steps .step", ".gift",
    "#rewards .center > *", ".perks .perk",
    "#reviews .center > *", ".testi-grid .testi",
    "#faq .faq", "#visit .visit", ".news"
  ];
  var els = [];
  SELECTORS.forEach(function (sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      if (els.indexOf(el) === -1) els.push(el);
    });
  });
  els.forEach(function (el) { el.classList.add("reveal"); });

  if (reduce.matches || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    /* stagger siblings that reveal together (grids) */
    els.forEach(function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) {
        return c.classList && c.classList.contains("reveal");
      });
      if (sibs.length > 1) {
        var i = sibs.indexOf(el);
        el.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
      }
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── floating Book button ── */
  var hero = document.querySelector(".hero2");
  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "fab-book";
  fab.setAttribute("data-drawer", "");
  fab.setAttribute("aria-label", "Book an appointment");
  fab.innerHTML = "<span>Book</span>";
  document.body.appendChild(fab);
  var showFab = function () {
    var trigger = hero ? hero.offsetHeight - 140 : 420;
    fab.classList.toggle("is-on", window.scrollY > trigger);
  };
  showFab();
  window.addEventListener("scroll", showFab, { passive: true });
})();
