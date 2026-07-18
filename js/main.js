/* Taqueria Los Güeros — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. */

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

  /* ── Catering form → prefilled email ── */
  /* TODO: swap the address below for the taqueria's real inbox, or wire
     the form to a service like Formspree for direct submissions. */
  var CATERING_EMAIL = "hola@losguerosanaheim.com";
  var form = document.querySelector(".catering-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector(".form-status");
    if (!form.reportValidity()) return;
    var v = function (name) { return (form.elements[name].value || "").trim(); };
    var subject = "Catering request — " + v("name") + (v("date") ? " (" + v("date") + ")" : "");
    var body = [
      "Name: " + v("name"),
      "Phone: " + v("phone"),
      "Event date: " + v("date"),
      "Guests: " + v("guests"),
      "",
      v("notes")
    ].join("\n");
    window.location.href = "mailto:" + CATERING_EMAIL +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
    status.textContent = "Opening your email app… If nothing happens, write to " + CATERING_EMAIL + ".";
  });

  /* ── Hero video: pause for reduced motion or data saver ── */
  var video = document.querySelector(".hero-video");
  if (video) {
    var rmQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var applyMotionPref = function () {
      if (rmQuery.matches || (navigator.connection && navigator.connection.saveData)) {
        video.pause();
      } else {
        video.play().catch(function () {});
      }
    };
    applyMotionPref();
    if (rmQuery.addEventListener) rmQuery.addEventListener("change", applyMotionPref);
  }

  /* ── Motion (GSAP + ScrollTrigger) ── */
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);

  var mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", function () {
    /* Hero entrance */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".hero-media", { opacity: 0, duration: 1.8, ease: "power2.out" }, 0)
      .from(".hero-glow", { opacity: 0, scale: 0.85, duration: 1.6, ease: "power2.out" }, 0)
      .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.7 }, 0.25)
      .from(".hero-title .line-inner", { yPercent: 115, duration: 1.0, stagger: 0.14 }, 0.35)
      .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, 0.85)
      .from(".hero-actions .btn", { opacity: 0, y: 14, duration: 0.6, stagger: 0.1 }, 1.0)
      .from(".hero-scroll", { opacity: 0, duration: 0.8 }, 1.3)
      .from(".nav", { opacity: 0, y: -12, duration: 0.7 }, 0.5);

    /* Glow drifts up slightly as you leave the hero */
    gsap.to(".hero-glow", {
      yPercent: -14,
      opacity: 0.5,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });

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

    /* Menu rows drift in with a stagger, group by group */
    gsap.utils.toArray(".carta-group").forEach(function (group) {
      gsap.from(group.querySelectorAll(".carta-row"), {
        opacity: 0,
        y: 16,
        duration: 0.55,
        ease: "power2.out",
        stagger: 0.06,
        scrollTrigger: { trigger: group, start: "top 78%" }
      });
    });

    return function () {};
  });
})();
