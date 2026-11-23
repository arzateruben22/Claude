/* The featured treatments, dealt as you scroll (css: "The featured treatments").
   After the "Project Deck" component by Aakash Mehra (21st.dev), redone in plain
   JS: a sticky stage, one progress value that drives every card. The next card
   rises from below leaning toward you and out of focus, and flattens and sharpens
   as it lands; the cards beneath lean back, sink and dim.
   Without JS, or with reduced motion, the CSS leaves a plain list of the cards.

   Kept cheap on purpose, so it holds 60 fps on a phone:
   - the page is measured once (and again when it changes size or a scroll starts),
     never per frame: a frame reads scrollY and writes transforms, nothing else;
   - only what changed is written, in steps too small to see;
   - blur only while a card is arriving (none on the cards at rest), a lighter blur
     on touch screens, and no extra spring there: the finger's own momentum is smooth;
   - the shadow is a plain box-shadow (css), not a filter, and the dim is its own layer. */
(function () {
  "use strict";
  var deck = document.getElementById("svc-deck");
  if (!deck) return;
  var cards = [].slice.call(deck.querySelectorAll(".svc-card"));
  var dims = cards.map(function (c) { return c.querySelector(".svc-dim"); });
  var n = cards.length;
  if (n < 2) return;

  var root = document.documentElement;
  var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var touch = window.matchMedia("(pointer: coarse)");
  var on = false, raf = 0, last = 0, near = true;
  var m = { top: 0, span: 0, nav: 74 };       /* where the deck is, measured: document offset, scroll span, header bottom */
  var x = 0, v = 0, target = 0;               /* the spring: x follows target (desktop mouse and trackpad only) */
  var K = 700, C = 52, M = 0.35;              /* close and never overshoots */
  var ENTER = 0.72;                           /* share of each card's screen spent arriving; the rest it rests */
  var BLUR = 12;                              /* px, the arriving card at its blurriest; less on a touch screen */
  var seen = [];                              /* what each card was last given, so a frame writes only what changed */

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
  var round = function (v, step) { return Math.round(v / step) * step; };

  var measure = function () {
    var nb = parseFloat(getComputedStyle(root).getPropertyValue("--nav-bottom"));
    m.nav = nb > 0 ? nb : 74;
    var r = deck.getBoundingClientRect();
    m.top = r.top + window.pageYOffset;
    m.span = r.height - deck.firstElementChild.offsetHeight;
  };
  /* 0 where the stage first sticks under the header, 1 where it lets go */
  var progress = function () {
    return m.span > 0 ? clamp01((window.pageYOffset - (m.top - m.nav)) / m.span) : 0;
  };

  var paint = function (p) {
    var blurMax = touch.matches ? 6 : BLUR;
    for (var i = 0; i < n; i++) {
      var a = arrived(i, p), up = above(i, p);
      var y = round((1 - a) * 108 - up * 5, 0.05);                 /* svh; covered cards lift so their edges show */
      var rx = round(-(1 - a) * 30 + up * 5, 0.05);                /* deg */
      var sc = round(0.9 + 0.1 * a - up * 0.05, 0.0005);
      var bl = round(Math.pow(1 - a, 2) * blurMax, 0.5);           /* px, only while arriving */
      var dm = round(up * 0.15, 0.005);
      var live = a >= 0.5;
      var s = seen[i];
      if (!s) s = seen[i] = {};
      var tf = "translate3d(0," + y + "svh,0) scale(" + sc + ") rotateX(" + rx + "deg)";
      if (s.tf !== tf) { cards[i].style.transform = tf; s.tf = tf; }
      var fl = bl > 0 ? "blur(" + bl + "px)" : "none";
      if (s.fl !== fl) { cards[i].style.filter = fl; s.fl = fl; }
      if (dims[i] && s.dm !== dm) { dims[i].style.opacity = dm; s.dm = dm; }
      /* a card below the fold is out of the way of the cards above it */
      if (s.live !== live) { cards[i].style.pointerEvents = live ? "" : "none"; s.live = live; }
    }
  };

  var step = function (t) {
    raf = 0;
    target = progress();
    if (touch.matches) {                      /* a finger's momentum is already smooth: follow it exactly */
      x = target; v = 0; paint(x);
      return;
    }
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    var slices = Math.max(1, Math.ceil(dt / 0.004)), h = dt / slices;   /* small slices keep the stiff spring stable */
    for (var k = 0; k < slices; k++) {
      v += (-K * (x - target) - C * v) / M * h;
      x += v * h;
    }
    paint(x);
    if (Math.abs(x - target) > 0.00015 || Math.abs(v) > 0.002) raf = requestAnimationFrame(step);
    else { x = target; v = 0; paint(x); }
  };
  var kick = function () {
    if (!on || !near || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(step);
  };
  /* the first scroll after a rest: measure again (the page above may have changed), then follow */
  var lastScroll = 0;
  var wake = function () {
    var now = performance.now();
    if (on && near && now - lastScroll > 200) measure();   /* once per burst of scrolling, not per frame */
    lastScroll = now;
    kick();
  };

  var enable = function () {
    if (on) return;
    on = true;
    deck.classList.add("is-deck");
    cards.forEach(function (c, i) { c.style.zIndex = String(i + 1); });
    measure();
    target = x = progress(); v = 0;
    seen = [];
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
    seen = [];
  };
  var sync = function () { if (mq.matches) disable(); else { enable(); kick(); } };

  window.addEventListener("scroll", wake, { passive: true });
  var remeasure = function () { if (on) { measure(); target = x = progress(); seen = []; paint(x); } };
  var pending = 0;
  var later = function () { if (pending) return; pending = requestAnimationFrame(function () { pending = 0; remeasure(); }); };
  window.addEventListener("resize", later, { passive: true });
  window.addEventListener("orientationchange", later, { passive: true });
  window.addEventListener("load", later);
  /* anything above the deck changing height (an image or a font arriving, a panel opening) moves it */
  if ("ResizeObserver" in window) new ResizeObserver(later).observe(document.body);
  if (mq.addEventListener) mq.addEventListener("change", sync);
  else if (mq.addListener) mq.addListener(sync);

  /* only run while the deck is on screen */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { near = es[0].isIntersecting; if (near) wake(); }, { rootMargin: "100px 0px" }).observe(deck);
  }

  /* a keyboard user tabbing to a card that hasn't landed yet: scroll the deck to it */
  deck.addEventListener("focusin", function (e) {
    if (!on) return;
    var c = e.target.closest && e.target.closest(".svc-card");
    var i = cards.indexOf(c);
    if (i < 0 || arrived(i, target) > 0.98) return;
    measure();
    window.scrollTo(0, m.top - m.nav + m.span * Math.min(1, (i - 1 + ENTER) / Math.max(1, n - 1)));
  });

  sync();
})();
