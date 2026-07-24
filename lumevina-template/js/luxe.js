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

  /* ── hero headline word-by-word reveal ── */
  var title = document.querySelector(".hero2-title");
  if (title) {
    var split = function (node) {
      var frag = document.createDocumentFragment();
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach(function (tok) {
            if (tok === "") return;
            if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); return; }
            var w = document.createElement("span"); w.className = "hw";
            var inner = document.createElement("span"); inner.className = "hw-in"; inner.textContent = tok;
            w.appendChild(inner); frag.appendChild(w);
          });
        } else if (child.tagName === "BR") {
          frag.appendChild(document.createElement("br"));
        } else if (child.tagName === "EM") {
          var em = document.createElement("em"); em.appendChild(split(child)); frag.appendChild(em);
        } else {
          frag.appendChild(child.cloneNode(true));
        }
      });
      return frag;
    };
    var f = split(title); title.textContent = ""; title.appendChild(f);
    Array.prototype.forEach.call(title.querySelectorAll(".hw-in"), function (w, i) {
      w.style.transitionDelay = (i * 90) + "ms";
    });
    var revealTitle = function () { title.classList.add("is-in"); };
    var intro = document.getElementById("intro");
    if (reduce.matches || !intro) { revealTitle(); }
    else if (intro.classList.contains("intro-done")) { revealTitle(); }
    else {
      var mo = new MutationObserver(function () {
        if (intro.classList.contains("intro-out") || intro.classList.contains("intro-done")) {
          mo.disconnect(); setTimeout(revealTitle, 240);
        }
      });
      mo.observe(intro, { attributes: true, attributeFilter: ["class"] });
      setTimeout(function () { if (!title.classList.contains("is-in")) revealTitle(); }, 5000);
    }
  }

  /* ── subtle parallax on the image boxes ── */
  if (!reduce.matches) {
    var pxEls = Array.prototype.slice.call(document.querySelectorAll(".founder-photo,.best-media,.actives-mid"));
    if (pxEls.length) {
      var pxRun = function () {
        var vh = window.innerHeight;
        pxEls.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -60 || r.top > vh + 60) return;
          var prog = (r.top + r.height / 2 - vh / 2) / vh;
          el.style.backgroundPosition = "center calc(50% + " + (-prog * 26).toFixed(1) + "px)";
        });
      };
      var ticking = false;
      var onPx = function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { pxRun(); ticking = false; }); } };
      pxRun();
      window.addEventListener("scroll", onPx, { passive: true });
      window.addEventListener("resize", onPx, { passive: true });
    }
  }
})();
