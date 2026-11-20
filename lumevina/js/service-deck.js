/* The featured treatments, dealt as you scroll (css: "The featured treatments").
   After the "Project Deck" component by Aakash Mehra (21st.dev), redone in plain
   JS: a sticky stage, one spring-smoothed progress value that drives every card.
   The next card rises from below leaning toward you and out of focus, and flattens
   and sharpens as it lands; the cards beneath lean back, sink and dim.
   Without JS, or with reduced motion, the CSS leaves a plain list of the cards. */
(function () {
  "use strict";
  var deck = document.getElementById("svc-deck");
  if (!deck) return;
  var cards = [].slice.call(deck.querySelectorAll(".svc-card"));
  var dims = cards.map(function (c) { return c.querySelector(".svc-dim"); });
  var n = cards.length;
  if (n < 2) return;

  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var on = false, raf = 0, last = 0, near = true;
  var target = 0, x = 0, v = 0;               // the spring: x follows target
  var K = 380, C = 48, M = 0.35;              // stiffness, damping, mass: close, and never overshoots
  var ENTER = 0.72;                           // share of each card's screen spent arriving; the rest it rests

  var clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var arrived = function (j, p) {
    if (j <= 0) return 1;
    return easeOut(clamp01((p * Math.max(1, n - 1) - (j - 1)) / ENTER));
  };
  var above = function (i, p) {
    var s = 0;
    for (var j = i + 1; j < n; j++) s += arrived(j, p);
    return Math.min(3, s);
  };

  var navBottom = function () {
    var b = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-bottom"));
    return b > 0 ? b : 74;
  };
  /* 0 where the stage first sticks under the header, 1 where it lets go */
  var progress = function () {
    var stage = deck.firstElementChild;
    var r = deck.getBoundingClientRect();
    var span = r.height - stage.offsetHeight;
    return span > 0 ? clamp01((navBottom() - r.top) / span) : 0;
  };

  var paint = function (p) {
    for (var i = 0; i < n; i++) {
      var a = arrived(i, p), up = above(i, p);
      var y = (1 - a) * 108 - up * 5;                       // svh; covered cards lift so their edges show
      var rx = -(1 - a) * 30 + up * 5;                      // deg
      var sc = 0.9 + 0.1 * a - up * 0.05;
      var bl = Math.pow(1 - a, 2) * 12 + up * 1.1;          // px
      cards[i].style.transform = "translate3d(0," + y.toFixed(3) + "svh,0) scale(" + sc.toFixed(4) + ") rotateX(" + rx.toFixed(3) + "deg)";
      cards[i].style.filter = bl > 0.05 ? "blur(" + bl.toFixed(2) + "px)" : "none";
      cards[i].style.zIndex = String(i + 1);
      if (dims[i]) dims[i].style.opacity = (up * 0.15).toFixed(3);
      /* a card below the fold is out of the way of the cards above it */
      cards[i].style.pointerEvents = a < 0.5 ? "none" : "";
    }
  };

  var step = function (t) {
    raf = 0;
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    target = progress();
    // semi-implicit Euler in small slices keeps the stiff spring stable
    var slices = Math.max(1, Math.ceil(dt / 0.004)), h = dt / slices;
    for (var k = 0; k < slices; k++) {
      v += (-K * (x - target) - C * v) / M * h;
      x += v * h;
    }
    paint(x);
    if (Math.abs(x - target) > 0.00015 || Math.abs(v) > 0.002) raf = requestAnimationFrame(step);
    else { x = target; v = 0; paint(x); }
  };
  var kick = function () { if (on && near && !raf) { last = performance.now(); raf = requestAnimationFrame(step); } };

  var enable = function () {
    if (on) return;
    on = true;
    deck.classList.add("is-deck");
    target = x = progress(); v = 0;
    paint(x);
  };
  var disable = function () {
    if (!on) return;
    on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    deck.classList.remove("is-deck");
    cards.forEach(function (c, i) {
      c.style.transform = c.style.filter = c.style.zIndex = c.style.pointerEvents = "";
      if (dims[i]) dims[i].style.opacity = "";
    });
  };
  var sync = function () { if (mq.matches) disable(); else { enable(); kick(); } };

  window.addEventListener("scroll", kick, { passive: true });
  window.addEventListener("resize", function () { if (on) { target = x = progress(); paint(x); } }, { passive: true });
  if (mq.addEventListener) mq.addEventListener("change", sync);
  else if (mq.addListener) mq.addListener(sync);

  /* only run the spring while the deck is on screen */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { near = es[0].isIntersecting; if (near) { target = progress(); kick(); } }, { rootMargin: "100px 0px" }).observe(deck);
  }

  /* a keyboard user tabbing to a card that hasn't landed yet: scroll the deck to it */
  deck.addEventListener("focusin", function (e) {
    if (!on) return;
    var c = e.target.closest && e.target.closest(".svc-card");
    var i = cards.indexOf(c);
    if (i < 0 || arrived(i, target) > 0.98) return;
    var stage = deck.firstElementChild;
    var span = deck.getBoundingClientRect().height - stage.offsetHeight;
    var top = deck.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, top - navBottom() + span * Math.min(1, (i - 1 + ENTER) / Math.max(1, n - 1)));
  });

  sync();
})();
