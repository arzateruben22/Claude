/* Lumevina Aesthetics Spa — interactions & motion
   All entrance states are set from JS so the page is fully
   readable with JavaScript disabled. Cart logic lives in cart.js. */

(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  /* ── Nav ── */
  var nav = document.querySelector(".nav");
  /* --nav-bottom: where the header really ends, so anything that sticks
     under it (the shop's type bar) sits flush against it on every phone,
     inside an app's viewer too, where the notch inset doesn't apply */
  var navBottom = -1;
  var measureNav = function () {
    var b = Math.round(nav.getBoundingClientRect().bottom);
    if (b !== navBottom && b > 0) { navBottom = b; document.documentElement.style.setProperty("--nav-bottom", b + "px"); }
  };
  var onScroll = function () {
    nav.classList.toggle("scrolled", window.scrollY > 24);
    measureNav();
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measureNav);
  nav.addEventListener("transitionend", measureNav);

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

  /* the menu drops down from the header under the two-line button; the page
     stays where it is behind a light scrim. Tap outside, a link, or Escape. */
  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var scrim = document.querySelector(".mm-scrim");
  var setMenu = function (open) {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    mobileMenu.hidden = !open;
    if (scrim) scrim.hidden = !open;
    document.documentElement.classList.toggle("menu-open", open);
    if (open) measureNav();
  };
  setMenu(false);
  /* a finger lifting on the button opens the menu straight away; the click
     that follows is skipped. Some phone viewers (an app's in-page browser)
     can lose the click after a tap, and then the menu never opened. Mouse
     and keyboard keep using the click. */
  var touchedAt = 0;
  var flip = function () { setMenu(toggle.getAttribute("aria-expanded") !== "true"); };
  toggle.addEventListener("pointerup", function (e) {
    if (e.pointerType === "mouse") return;
    touchedAt = Date.now();
    flip();
  });
  /* an older in-app browser without pointer events: the touch itself opens it */
  toggle.addEventListener("touchend", function (e) {
    if (Date.now() - touchedAt < 700) return;
    touchedAt = Date.now();
    e.preventDefault();
    flip();
  }, { passive: false });
  toggle.addEventListener("click", function () {
    if (Date.now() - touchedAt < 700) return;
    flip();
  });
  mobileMenu.addEventListener("click", function (e) {
    if (e.target.closest("a, button")) setMenu(false);
  });
  if (scrim) scrim.addEventListener("click", function () { setMenu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mobileMenu.hidden) { setMenu(false); toggle.focus(); }
  });
  /* the menu belongs to small screens: close it if the window grows past them */
  window.addEventListener("resize", function () {
    if (!mobileMenu.hidden && getComputedStyle(toggle).display === "none") setMenu(false);
  }, { passive: true });

  /* ── Newsletter form → client-side thanks (held back in v2: the
     Contact form took its place and has its own script, js/contact.js) ── */
  /* TODO: wire to your email service (Mailchimp / Buttondown / Formspree). */
  var form = document.querySelector(".newsletter-form:not(.contact-form)");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = form.querySelector(".form-status");
    if (!form.reportValidity()) return;
    status.textContent = "You're on the list — spa notes arrive monthly ✨";
    form.reset();
  });

  /* ── Motion (GSAP + ScrollTrigger) ── */
  if (typeof gsap === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  /* Pinch-zooming on a phone fires resize events. Left alone, ScrollTrigger
     re-measures every scroll animation on each one, and the page jumps as if
     it reloaded. Re-measure only when the page's own width really changes
     (rotating the phone, resizing a window), never for a zoom or the
     address bar sliding away. */
  ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: "visibilitychange,DOMContentLoaded,load" });
  var layoutW = document.documentElement.clientWidth, refreshT = 0;
  window.addEventListener("resize", function () {
    var w = document.documentElement.clientWidth;
    if (w === layoutW) return;
    layoutW = w;
    clearTimeout(refreshT);
    refreshT = setTimeout(function () { ScrollTrigger.refresh(); }, 200);
  }, { passive: true });

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

    /* Hero entrance: plays as soon as the page opens */
    var intro = gsap.timeline({ defaults: { ease: "power3.out" }, paused: true });
    intro.timeScale(1.25);  /* the whole entrance plays a touch brisker */
    intro
      .from(".hero-liquid", { opacity: 0, duration: 1.8, ease: "power2.out" }, 0)
      .from(".hero-mark-art", { opacity: 0, scale: 0.94, duration: 2.4, ease: "power2.out" }, 0.05)
      .from(".hero-glow", { opacity: 0, scale: 0.85, duration: 1.6, ease: "power2.out", stagger: 0.2 }, 0)
      .from(".hero-title .char", { yPercent: 115, opacity: 0, duration: 0.8, stagger: 0.022 }, 0.2)
      .from(".hero-sub", { opacity: 0, y: 18, duration: 0.8 }, 0.6)
      .from(".hero-actions", { opacity: 0, y: 14, duration: 0.7 }, 0.7)
      /* what's on the shelf arrives early: it's the point of the page */
      .from(".hero-shelf", { opacity: 0, y: 22, duration: 0.8 }, 0.8)
      .from(".hero .hero-cred", { opacity: 0, duration: 0.6 }, 1.0)
      .from(".hero-wordmark", { opacity: 0, y: 40, duration: 1.2, ease: "power2.out" }, 1.0)
      .from(".nav", { opacity: 0, y: -12, duration: 0.7 }, 0.4);
    intro.play(0);

    /* her logo's symbol rises gently and fades as you leave the hero */
    gsap.fromTo(".hero-mark-drift",
      { opacity: 1, yPercent: 0 },
      {
        yPercent: -8,
        opacity: 0.15,
        ease: "none",
        immediateRender: false,
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true }
      });

    /* Wordmark drifts down and fades as you leave the hero. Written as
       an explicit fromTo with immediateRender:false so the scrub reads
       the true resting opacity (0.3) as its start — the earlier version
       captured a stale ~0 during the entrance and flickered on the
       first scroll. invalidateOnRefresh recomputes cleanly after the
       font loads. */
    gsap.fromTo(".hero-wordmark",
      { opacity: 0.3 },
      {
        yPercent: 22,
        opacity: 0,
        ease: "none",
        immediateRender: false,
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true
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

    /* The giant wordmark is Cormorant Garamond; its size — and so the
       scrub's start/end — isn't final until the webfont loads. Recompute
       once fonts are ready so the first scroll isn't measured off a
       fallback face (the cause of first-scroll jank). */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

    return function () {};
  });
})();
