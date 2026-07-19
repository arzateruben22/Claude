/* SchFLR — nav, mobile menu, GSAP motion */

(function () {
  "use strict";

  /* ── Mobile menu ─────────────────────────────────────────── */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("mobile-menu");

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      menu.hidden = open;
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
        menu.hidden = true;
      }
    });
  }

  /* ── Footer year ─────────────────────────────────────────── */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ── Motion ──────────────────────────────────────────────── */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined") return;

  document.documentElement.classList.add("js-motion");
  gsap.registerPlugin(ScrollTrigger);

  /* Page-load sequence: headline rises, copy fades, then the
     month calendars fill in — session squares landing last. */
  var intro = gsap.timeline({ defaults: { ease: "power3.out" } });

  intro
    .fromTo(".hero-title .line-inner",
      { yPercent: 110, opacity: 1 },
      { yPercent: 0, duration: 0.9, stagger: 0.12 }, 0.1)
    .fromTo("[data-load]",
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 }, 0.5)
    .fromTo(".month-grid span:not(.on)",
      { opacity: 0 },
      { opacity: 1, duration: 0.35, stagger: 0.004 }, 0.6)
    .fromTo(".month-grid span.on",
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1, duration: 0.3, stagger: 0.05, ease: "back.out(2)" }, 1.0);

  /* Scroll reveals */
  gsap.utils.toArray("[data-reveal]").forEach(function (el) {
    gsap.fromTo(el,
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%" }
      });
  });
})();
