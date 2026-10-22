// motif.js — Light Minute's overlay motifs (films/channels/space/set), added to kits/cinema/sci/hud.js's
// shells: the light-time ring that closes on the sonic signature beside LIGHT MINUTE on the title card,
// the same ring, large, around "Next: ..." on the end card, the readout's style, and the light clock's
// m:ss. Pure functions of t, like the HUD. Colours are the theme's tokens (CSS variables), never literals.
//
//   const tr = titleRing(hud.title({...}), { t0: 0, sig });   tr.update(t)
//   const er = endRing(hud.end({...}), { t0, d: 0.8 });          er.update(t)
//   fmtClock(τ) → "8:20" (whole seconds, floored: the clock never shows a second it hasn't reached)
import { seg, E } from "cinema/film/runtime.js";

const CSS = `
.hud-series { display: flex; align-items: center; gap: 1.6vmin; }
.lm-tring { flex: none; width: 4.4vmin; height: 4.4vmin; overflow: visible; }
.lm-tring circle, .lm-ering circle { fill: none; stroke: var(--teal); stroke-linecap: round; }
.hud-end { text-align: center; }
.hud-end .fo { margin-top: 5vmin; }
.lm-ering { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.lm-band { position: absolute; left: 0; width: 100%; z-index: 2; pointer-events: none; opacity: 0;
  background: linear-gradient(180deg, rgba(8, 10, 28, 0) 0%, rgba(8, 10, 28, .74) 26%, rgba(8, 10, 28, .74) 74%, rgba(8, 10, 28, 0) 100%); }
.hud-counter.lm-read .lb { font-family: var(--font-display); text-transform: uppercase; letter-spacing: .08em; font-size: 2.3vmin; color: var(--teal); }
.hud-counter.lm-read .v { font-size: 7.2vmin; }
.hud-counter.lm-clock .lb { font-size: 2.6vmin; }
`;
let injected = false;
export const injectCss = () => {
  if (injected || document.getElementById("lm-css")) return;
  const st = document.createElement("style");
  st.id = "lm-css"; st.textContent = CSS;
  document.head.appendChild(st);                     // after hud.js's and the theme's own CSS
  injected = true;
};

export const fmtClock = (tau) => {
  const s = Math.max(0, Math.floor(tau + 1e-6));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};

const NS = "http://www.w3.org/2000/svg";
const svgRing = (cls, r, w) => {
  const svg = document.createElementNS(NS, "svg"), c = document.createElementNS(NS, "circle");
  svg.setAttribute("class", cls); svg.setAttribute("aria-hidden", "true");
  c.setAttribute("r", String(r)); c.setAttribute("stroke-width", String(w));
  svg.appendChild(c);
  return { svg, c };
};

// the title card's ring: drawn round from the top, closing exactly on the signature (sig). The card also gets
// its band (the bible's "band at y 250–470 over the payoff image"): a soft void scrim the full width of the
// frame behind the title, so whatever the payoff image puts there (a bright light front) never fights the type
export const titleRing = (el, { t0 = 0, sig, from = 0.14 } = {}) => {
  injectCss();
  const band = document.createElement("div");
  band.className = "lm-band";
  el.parentNode.insertBefore(band, el);
  const series = el.querySelector(".hud-series");
  const { svg, c } = svgRing("lm-tring", 18, 4.2);
  svg.setAttribute("viewBox", "-22 -22 44 44");
  c.setAttribute("transform", "rotate(-90)");
  const L = 2 * Math.PI * 18;
  c.setAttribute("stroke-dasharray", `${L.toFixed(3)} ${L.toFixed(3)}`);
  if (series) series.insertBefore(svg, series.firstChild); else el.insertBefore(svg, el.firstChild);
  return {
    update(t) {
      const p = from + (1 - from) * E.inout2(seg(t, t0, sig));
      c.setAttribute("stroke-dashoffset", (L * (1 - p)).toFixed(3));
      const pad = 0.035 * Math.min(window.W, window.H);
      band.style.top = (el.offsetTop - pad).toFixed(2) + "px";
      band.style.height = (el.offsetHeight + 2 * pad).toFixed(2) + "px";
      band.style.opacity = el.style.opacity || "0";      // the band comes and goes with the card (hud.js sets its opacity)
    },
  };
};

// the end card's ring: the same ring, large, around the card's title, drawn closed over d seconds from t0
export const endRing = (el, { t0, d = 0.8, safe, S1 = 1 } = {}) => {
  injectCss();
  const { svg, c } = svgRing("lm-ering", 100, 4.5 * S1);
  el.appendChild(svg);
  const title = el.querySelector(".t");
  return {
    update(t) {
      const w = el.offsetWidth, tw = title ? title.offsetWidth : w, th = title ? title.offsetHeight : 0;
      const cx = w / 2, cy = (title ? title.offsetTop : 0) + th / 2 + 6 * S1;
      let r = Math.max(tw * 0.5, th * 0.5) + 70 * S1;
      if (safe) r = Math.min(r, (safe.r - safe.l) / 2 - 8 * S1);
      const L = 2 * Math.PI * r, p = E.inout3(seg(t, t0, t0 + d));
      svg.setAttribute("width", String(Math.ceil(2 * r + 20))); svg.setAttribute("height", String(Math.ceil(2 * r + 20)));
      svg.style.left = (cx - r - 10).toFixed(2) + "px"; svg.style.top = (cy - r - 10).toFixed(2) + "px";
      svg.setAttribute("viewBox", `${(-r - 10).toFixed(2)} ${(-r - 10).toFixed(2)} ${(2 * r + 20).toFixed(2)} ${(2 * r + 20).toFixed(2)}`);
      c.setAttribute("r", r.toFixed(2));
      c.setAttribute("transform", "rotate(-90)");
      c.setAttribute("stroke-dasharray", `${L.toFixed(2)} ${L.toFixed(2)}`);
      c.setAttribute("stroke-dashoffset", (L * (1 - p)).toFixed(2));
    },
  };
};
