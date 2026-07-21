/* Lumevina Aesthetics Spa — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. Cart logic lives in cart.js. */

(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ── Nav ── */
  var nav = document.querySelector(".nav");
  var onScroll = function () {
    nav.classList.toggle("scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Brand → glide back to the top. The #top target is the fixed nav,
     which some browsers treat as always in view and won't scroll to,
     so drive it explicitly (honoring reduced-motion). */
  var brand = document.querySelector(".nav-brand");
  if (brand) {
    brand.addEventListener("click", function (e) {
      e.preventDefault();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var setMenu = function (open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    document.body.style.overflow = open ? "hidden" : "";
  };
  setMenu(false);
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  mobileMenu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mobileMenu.hidden) setMenu(false);
  });

  /* ── Newsletter form → client-side thanks ── */
  /* TODO: wire to your email service (Mailchimp / Buttondown / Formspree). */
  var form = document.querySelector(".newsletter-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector(".form-status");
    if (!form.reportValidity()) return;
    status.textContent = "You're on the list — spa notes arrive monthly ✨";
    form.reset();
  });

  /* ── Motion (GSAP + ScrollTrigger) ── */
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  /* Split the headline into per-letter spans (Woven Light-style
     reveal). The h1 keeps an aria-label so the split is invisible
     to screen readers. */
  var splitChars = function (root) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split("").forEach(function (ch) {
            var s = document.createElement("span");
            s.className = "char";
            s.textContent = ch === " " ? " " : ch;
            frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    document.querySelectorAll(root).forEach(walk);
  };

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    splitChars(".hero-title .line-inner");

    /* Hero entrance */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".hero-liquid", { opacity: 0, duration: 1.8, ease: "power2.out" }, 0)
      .from(".hero-glow", { opacity: 0, scale: 0.85, duration: 1.6, ease: "power2.out", stagger: 0.2 }, 0)
      .from(".hero-logo", { opacity: 0, y: 14, scale: 0.96, duration: 1.0, ease: "power2.out" }, 0.2)
      .from(".hero-title .char", { yPercent: 115, opacity: 0, duration: 0.8, stagger: 0.022 }, 0.35)
      .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, 0.95)
      .from(".hero-actions > *", { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, 1.1)
      .from(".hero-features", { opacity: 0, y: 24, duration: 0.9 }, 1.25)
      .from(".hero-wordmark", { opacity: 0, y: 40, duration: 1.2, ease: "power2.out" }, 1.0)
      .from(".hero-scroll", { opacity: 0, duration: 0.8 }, 1.4)
      .from(".nav", { opacity: 0, y: -12, duration: 0.7 }, 0.5);

    /* Wordmark drifts as you leave the hero */
    gsap.to(".hero-wordmark", {
      yPercent: 22,
      opacity: 0.3,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

    /* Service sectors rise in one by one as you scroll to them.
       No scale/overshoot: mid-stagger the row must stay aligned, and
       clearProps guarantees the resting grid is pure CSS layout. */
    if (document.querySelector(".sector-grid")) {
      gsap.from(".sector-btn", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.06,
        clearProps: "transform,opacity",
        scrollTrigger: { trigger: ".sector-grid", start: "top 82%" }
      });
    }

    /* Section reveals */
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 28,
        duration: 0.9,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 82%" }
      });
    });

    return function () {};
  });
})();
