/* Lumevina — entropy visual in The Spa section
   Vanilla port of the Entropy canvas component: a lattice of
   particles, ordered on the left and chaotic on the right, chaos
   bleeding into order where they meet. Recolored from white-on-
   black to plum-on-porcelain. The metaphor is the brand story:
   skin in chaos, brought to order.

   Same runtime rules as the shaders: pauses off-screen and on
   hidden tabs, still frame under prefers-reduced-motion. */

(function () {
  "use strict";

  var panel = document.querySelector(".entropy-panel");
  var canvas = document.querySelector(".entropy-canvas");
  if (!panel || !canvas) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* plum, as rgb so alpha can ride along */
  var COLOR = "125, 84, 104";

  var size = 0;
  var particles = [];
  var GRID = 25;

  var makeParticle = function (x, y, order) {
    return {
      x: x, y: y,
      originalX: x, originalY: y,
      size: 1.6,
      order: order,
      velocity: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
      influence: 0,
      neighbors: []
    };
  };

  var init = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = Math.max(240, Math.min(panel.clientWidth, 420));
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    particles = [];
    var spacing = size / GRID;
    for (var i = 0; i < GRID; i++) {
      for (var j = 0; j < GRID; j++) {
        var x = spacing * i + spacing / 2;
        var y = spacing * j + spacing / 2;
        particles.push(makeParticle(x, y, x < size / 2));
      }
    }
  };

  var updateNeighbors = function () {
    particles.forEach(function (p) {
      p.neighbors = particles.filter(function (other) {
        if (other === p) return false;
        return Math.hypot(p.x - other.x, p.y - other.y) < 100;
      });
    });
  };

  var updateParticle = function (p) {
    if (p.order) {
      var dx = p.originalX - p.x;
      var dy = p.originalY - p.y;
      var chaosX = 0, chaosY = 0;
      p.neighbors.forEach(function (n) {
        if (!n.order) {
          var distance = Math.hypot(p.x - n.x, p.y - n.y);
          var strength = Math.max(0, 1 - distance / 100);
          chaosX += n.velocity.x * strength;
          chaosY += n.velocity.y * strength;
          p.influence = Math.max(p.influence, strength);
        }
      });
      p.x += dx * 0.05 * (1 - p.influence) + chaosX * p.influence;
      p.y += dy * 0.05 * (1 - p.influence) + chaosY * p.influence;
      p.influence *= 0.99;
    } else {
      p.velocity.x += (Math.random() - 0.5) * 0.5;
      p.velocity.y += (Math.random() - 0.5) * 0.5;
      p.velocity.x *= 0.95;
      p.velocity.y *= 0.95;
      p.x += p.velocity.x;
      p.y += p.velocity.y;
      if (p.x < size / 2 || p.x > size) p.velocity.x *= -1;
      if (p.y < 0 || p.y > size) p.velocity.y *= -1;
      p.x = Math.max(size / 2, Math.min(size, p.x));
      p.y = Math.max(0, Math.min(size, p.y));
    }
  };

  var time = 0;

  var drawFrame = function () {
    ctx.clearRect(0, 0, size, size);

    if (time % 30 === 0) updateNeighbors();

    particles.forEach(function (p) {
      updateParticle(p);

      var alpha = p.order ? 0.75 - p.influence * 0.45 : 0.75;
      ctx.fillStyle = "rgba(" + COLOR + "," + alpha + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      p.neighbors.forEach(function (n) {
        var distance = Math.hypot(p.x - n.x, p.y - n.y);
        if (distance < 50) {
          ctx.strokeStyle = "rgba(" + COLOR + "," + (0.16 * (1 - distance / 50)) + ")";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
        }
      });
    });

    /* the meridian between order and chaos */
    ctx.strokeStyle = "rgba(" + COLOR + ",0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    time++;
  };

  init();

  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var rafId = null;
  var inView = true;

  var loop = function () {
    drawFrame();
    rafId = requestAnimationFrame(loop);
  };

  var play = function () {
    if (rafId === null && !rm.matches && inView && !document.hidden) loop();
  };

  var pause = function () {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  };

  /* reduced motion: settle a few steps so the still frame has shape */
  var still = function () {
    for (var i = 0; i < 8; i++) drawFrame();
  };
  still();
  play();

  if (rm.addEventListener) {
    rm.addEventListener("change", function () { pause(); still(); play(); });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) play(); else pause();
    }, { threshold: 0 }).observe(panel);
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      init();
      if (rafId === null) still();
    }, 200);
  }, { passive: true });
})();
