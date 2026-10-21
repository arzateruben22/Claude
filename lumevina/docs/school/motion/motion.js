/* Lumevina Skin School motion runtime (inlined into every scene page by render.mjs).
 *
 * The contract: a scene defines window.SCENE = { dur, poster, shots: [{ at, name, cap }] }
 * and window.seek(t). seek sets EVERYTHING on screen from t alone: no timers,
 * no CSS transitions, no requestAnimationFrame, no Date, no Math.random. The
 * renderer calls seek(i / fps) for every frame, so the same scene renders the
 * same bytes every time, on any machine.
 *
 * M.stage(t) runs the shot list: which <section class="shot"> is on screen,
 * the slide between shots, and the caption bar. The scene's seek then animates
 * the inside of the current shot from its local time. */
window.M = (function () {
  var clamp = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var seg = function (t, a, b) { return clamp((t - a) / (b - a)); };
  var E = {
    lin: function (x) { return x; },
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    in: function (x) { return x * x * x; },
    inout: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    back: function (x) { var c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    bounce: function (x) { var n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
  };
  var tw = function (t, a, b, from, to, e) { return from + (to - from) * (e || E.out)(seg(t, a, b)); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var set = function (el, p) {
    if (!el) return;
    var x = p.x || 0, y = p.y || 0, s = p.s == null ? 1 : p.s, r = p.r || 0;
    el.style.transform = "translate(" + x + "px, " + y + "px) rotate(" + r + "deg) scale(" + s + ")";
    if (p.o != null) el.style.opacity = p.o;
  };
  // an element arriving at local time t0: slides from dy/dx, fades over the first part, optional scale-up with a little overshoot
  var enter = function (el, lt, t0, o) {
    o = o || {};
    var d = o.d || 0.6, dy = o.y == null ? 28 : o.y, dx = o.x || 0, p = seg(lt, t0, t0 + d), q = E.out(p);
    set(el, { x: dx * (1 - q), y: dy * (1 - q), o: Math.min(1, p * 2.5), s: o.s ? tw(lt, t0, t0 + d, o.s, 1, E.back) : 1 });
    return p;
  };
  var leave = function (el, lt, t0, o) {
    o = o || {};
    var d = o.d || 0.5, p = seg(lt, t0, t0 + d), q = E.in(p);
    set(el, { x: (o.x || 0) * q, y: (o.y == null ? 40 : o.y) * q, o: 1 - p });
    return p;
  };
  var type = function (el, text, lt, t0, cps) {
    if (!el) return 0;
    var n = Math.max(0, Math.floor((lt - t0) * (cps || 30)));
    el.textContent = text.slice(0, n);
    return n >= text.length ? 1 : n / text.length;
  };
  var count = function (el, lt, a, b, from, to, fmt) { if (el) el.textContent = (fmt || Math.round)(tw(lt, a, b, from, to, E.out)); };
  var lerpColor = function (a, b, p) { return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * p) + "," + Math.round(a[1] + (b[1] - a[1]) * p) + "," + Math.round(a[2] + (b[2] - a[2]) * p) + ")"; };

  var SHOTS = [], shotEls = [], capWrap = null, capEl = null;
  var init = function () { SHOTS = (window.SCENE && window.SCENE.shots) || []; shotEls = $$(".shot"); capEl = $("#cap"); capWrap = capEl && capEl.parentElement; };
  var stage = function (t) {
    if (!shotEls.length) init();
    var i = 0, k;
    for (k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].at) i = k;
    var at = SHOTS[i] ? SHOTS[i].at : 0, lt = t - at;
    shotEls.forEach(function (el, k) {
      if (k === i) { var p = E.out(seg(lt, 0, 0.5)); el.style.visibility = "visible"; set(el, { y: 24 * (1 - p), o: Math.min(1, p * 2) }); }
      else if (k === i - 1 && lt < 0.35) { var q = E.in(seg(lt, 0, 0.35)); el.style.visibility = "visible"; set(el, { y: -16 * q, o: 1 - q }); }
      else { el.style.visibility = "hidden"; set(el, { o: 0 }); }
    });
    if (capEl) {
      capEl.textContent = (SHOTS[i] && SHOTS[i].cap) || "";
      var c = E.out(seg(lt, 0.1, 0.5));
      set(capWrap, { y: 12 * (1 - c), o: c });
    }
    return { i: i, lt: lt, at: at };
  };
  return { clamp: clamp, seg: seg, E: E, tw: tw, $: $, $$: $$, set: set, enter: enter, leave: leave, type: type, count: count, lerpColor: lerpColor, stage: stage };
})();
