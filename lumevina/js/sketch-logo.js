/* Lumevina — her logo, drawn in pencil (Nov 16)
 *
 * The front page shows Evelyn's own logo (img/logo-full.svg: the lines traced
 * from her drawing, the words as shapes) as a pencil sketch: warm graphite
 * with a paper grain, a second, lighter sketch line just off the first, and,
 * when the page opens, the lines drawing themselves in (the circle, then her
 * profile and the roses), with the words shaded in last. It stays still with
 * reduced motion. If the file can't be read, the plain logo (the <img> inside
 * .hero-sketch) stays as it is.
 */
(function () {
  "use strict";
  var box = document.querySelector(".hero-sketch");
  var img = box && box.querySelector("img");
  if (!img || !window.fetch || !window.DOMParser) return;
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";
  var GRAPHITE = "#2E2621";   /* deep, warm graphite: a soft 4B pencil */

  /* the pencil: a grain that lets the paper show through the line, and a
     slight wobble, as a hand never draws a perfect curve; the loose pass
     wobbles more, like the lighter first lines of a sketch */
  var FILTERS =
    '<filter id="sk-pencil" x="-3%" y="-3%" width="106%" height="108%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="1" seed="4" result="grain"/>' +
      '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.55" result="paper"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="2" seed="9" result="hand"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="hand" scale="4" xChannelSelector="R" yChannelSelector="G" result="drawn"/>' +
      '<feComposite in="drawn" in2="paper" operator="in" result="line"/>' +
      /* the shadow: the line pressed into the paper, a little below and soft */
      '<feGaussianBlur in="line" stdDeviation="7" result="soft"/>' +
      '<feOffset in="soft" dx="0" dy="9" result="low"/>' +
      '<feColorMatrix in="low" type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.32 0" result="shadow"/>' +
      '<feMerge><feMergeNode in="shadow"/><feMergeNode in="line"/></feMerge>' +
    '</filter>' +
    '<filter id="sk-loose" x="-4%" y="-4%" width="108%" height="108%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="1" seed="2" result="grain"/>' +
      '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.6" result="paper"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed="21" result="hand"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="hand" scale="10" xChannelSelector="G" yChannelSelector="R" result="drawn"/>' +
      '<feComposite in="drawn" in2="paper" operator="in"/>' +
    '</filter>';

  /* the order the lines are drawn in: the circle first, then her profile,
     the roses and the small marks (indexes into the logo's ten lines) */
  var ORDER = [0, 5, 6, 3, 4, 2, 7, 1, 8, 9];

  fetch(img.currentSrc || img.src).then(function (r) { return r.text(); }).then(function (text) {
    var doc = new DOMParser().parseFromString(text, "image/svg+xml");
    var src = doc.querySelector("svg");
    var lines = src && src.querySelector("g");
    if (!lines) return;
    var svg = document.importNode(src, true);
    var t = svg.querySelector("title");
    if (t) t.parentNode.removeChild(t);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", "sketch-svg");
    var defs = document.createElementNS(NS, "defs");
    defs.innerHTML = FILTERS;
    svg.insertBefore(defs, svg.firstChild);

    var main = svg.querySelector("g");
    main.setAttribute("stroke", GRAPHITE);
    /* a slightly heavier hand than the traced lines, so the circle holds on a phone */
    Array.prototype.forEach.call(main.querySelectorAll("path"), function (p) {
      p.setAttribute("stroke-width", (parseFloat(p.getAttribute("stroke-width")) || 6) * 1.55);
    });
    main.setAttribute("filter", "url(#sk-pencil)");
    /* the lighter sketch line, a hair off the first */
    var loose = main.cloneNode(true);
    loose.setAttribute("filter", "url(#sk-loose)");
    loose.setAttribute("opacity", "0.24");
    loose.setAttribute("transform", "translate(5 3)");
    svg.insertBefore(loose, main);
    /* the words: graphite, shaded in last */
    var words = Array.prototype.slice.call(svg.children).filter(function (el) { return el.tagName.toLowerCase() === "path"; });
    var wordsG = document.createElementNS(NS, "g");
    wordsG.setAttribute("filter", "url(#sk-pencil)");
    wordsG.setAttribute("class", "sketch-words");
    words.forEach(function (p) {
      p.setAttribute("fill", GRAPHITE);
      if (p.getAttribute("stroke")) p.setAttribute("stroke", GRAPHITE);
      wordsG.appendChild(p);
    });
    svg.appendChild(wordsG);

    box.replaceChild(svg, img);
    box.classList.add("is-drawn");
    if (still) return;

    /* draw the lines in: each from nothing to whole, in ORDER, the loose
       pass a beat behind; then the words */
    var paths = function (g) { return Array.prototype.slice.call(g.querySelectorAll("path")); };
    var at = 0.15;
    var plan = function (list, lag, alpha) {
      ORDER.forEach(function (i, n) {
        var p = list[i];
        if (!p) return;
        var len = p.getTotalLength();
        var dur = Math.min(2.2, Math.max(0.5, len / 2600));
        var delay = (n === 0 ? at : at + 0.55 + (n - 1) * 0.2) + lag;
        p.style.strokeDasharray = len + " " + len;
        p.style.strokeDashoffset = len;
        p.style.opacity = alpha;
        p.dataset.dur = dur;
        p.dataset.delay = delay;
      });
    };
    var mainPaths = paths(main), loosePaths = paths(loose);
    plan(mainPaths, 0, 1);
    plan(loosePaths, 0.18, 1);
    wordsG.style.opacity = 0;
    /* start on the next frame, once the starting state is painted */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        mainPaths.concat(loosePaths).forEach(function (p) {
          if (!p.dataset.dur) return;
          p.style.transition = "stroke-dashoffset " + p.dataset.dur + "s cubic-bezier(.45,.05,.25,1) " + p.dataset.delay + "s";
          p.style.strokeDashoffset = 0;
        });
        wordsG.style.transition = "opacity 1.4s ease " + (at + 2.1) + "s";
        wordsG.style.opacity = 1;
      });
    });
  }).catch(function () { /* the plain logo stays */ });
})();
