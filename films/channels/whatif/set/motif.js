// motif.js — Back of the Envelope's overlay motifs (films/channels/whatif/set), added to kits/cinema/sci/hud.js's
// shells: the envelope flap that folds down beside BACK OF THE ENVELOPE on the title card (closing on the
// sonic signature), the boxed answer on the end card (the channel's motif: a marker rectangle drawn round
// the episode's number), the show-your-work card (the recurring segment), and the counters' styles. Pure
// functions of t, like the HUD. Colours are the theme's tokens (CSS variables), never literals.
//
//   const tf = titleFlap(hud.title({...}), { t0: 0, sig });          tf.update(t)
//   const eb = endBox(hud.end({...}), { t0, answer: "≈ 38 min", S1 });  eb.update(t)
//   const wk = workCard(FILM.work, { safe: hud.safe, W, H });        wk.update(t, gate)
import { seg, E, presence, apply } from "cinema/film/runtime.js";

const CSS = `
.hud-series { display: flex; align-items: center; gap: 1.6vmin; color: var(--chalk); }
.bv-flap { flex: none; width: 5.6vmin; height: 4vmin; overflow: visible; }
.bv-flap path, .bv-flap rect { fill: none; stroke: var(--marker); stroke-width: 3.2; stroke-linejoin: round; stroke-linecap: round; }
.bv-band { position: absolute; left: 0; width: 100%; z-index: 2; pointer-events: none; opacity: 0;
  background: linear-gradient(180deg, rgba(23, 26, 30, 0) 0%, rgba(23, 26, 30, .8) 24%, rgba(23, 26, 30, .8) 76%, rgba(23, 26, 30, 0) 100%); }
.hud-end { text-align: center; margin-top: -9vmin; }
.hud-end .fo { margin-top: 3vmin; }
.bv-ans { display: inline-block; position: relative; margin-bottom: 3vmin; padding: 1.6vmin 3.4vmin;
  font: 700 11vmin/1 var(--font-display); font-variation-settings: "wdth" 80, "opsz" 96; color: var(--chalk); letter-spacing: -.02em; }
.bv-ans svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; }
.bv-ans rect { fill: none; stroke: var(--marker); stroke-linejoin: round; stroke-linecap: round; }
.bv-work { position: absolute; left: 0; top: 0; z-index: 4; box-sizing: border-box; padding: 2.4vmin 3vmin 2.6vmin; border-radius: 1.2vmin;
  background: rgba(37, 40, 46, .96); box-shadow: var(--hud-shadow); pointer-events: none; }
.bv-work .hd { font: 700 3.3vmin/1.1 var(--font-display); font-variation-settings: "wdth" 90, "opsz" 24; color: var(--marker); letter-spacing: .01em; margin-bottom: 1.8vmin; }
.bv-work .rw { display: flex; justify-content: space-between; align-items: baseline; gap: 3vmin; padding: .8vmin 0; border-top: .25vmin solid rgba(167, 170, 178, .25); }
.bv-work .rw .k { font: 600 3.3vmin/1.2 var(--font-text); color: var(--text-2); }
.bv-work .rw .v { font: 700 3.9vmin/1.1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--chalk); white-space: nowrap; }
.bv-work .rw.on .v { color: var(--marker); }
.bv-work .as { display: flex; flex-wrap: wrap; gap: 1vmin 1.4vmin; margin-top: 1.8vmin; }
.bv-work .as span { font: 600 2.6vmin/1.2 var(--font-mono); color: var(--assume); border: .25vmin solid var(--assume); border-radius: .5vmin; padding: .5vmin 1vmin; }
.bv-work .as span::before { content: "∵ "; }
.hud-counter { padding: 1vmin 2.2vmin 1.3vmin; border-radius: .9vmin; background: rgba(37, 40, 46, .95); box-shadow: var(--hud-shadow); }
.hud-counter .v { font-size: 6.4vmin; text-shadow: none; }
.hud-counter .lb { text-shadow: none; }
.hud-counter .u { font-family: var(--font-mono); font-size: 3.2vmin; color: var(--text-2); text-shadow: none; }
.hud-counter.lit .v { color: var(--marker); }
`;
let injected = false;
export const injectCss = () => {
  if (injected || document.getElementById("bv-css")) return;
  const st = document.createElement("style");
  st.id = "bv-css"; st.textContent = CSS;
  document.head.appendChild(st);                     // after hud.js's and the theme's own CSS
  injected = true;
};

const NS = "http://www.w3.org/2000/svg";

// the title card's envelope: a rectangle whose flap (a V) folds down from open (pointing up) to closed,
// landing exactly on the signature (sig); the card gets a soft graphite band behind it, full width
export const titleFlap = (el, { t0 = 0, sig } = {}) => {
  injectCss();
  const band = document.createElement("div");
  band.className = "bv-band";
  el.parentNode.insertBefore(band, el);
  const series = el.querySelector(".hud-series");
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "bv-flap"); svg.setAttribute("viewBox", "0 -16 56 56"); svg.setAttribute("aria-hidden", "true");
  const body = document.createElementNS(NS, "rect");
  body.setAttribute("x", "2"); body.setAttribute("y", "8"); body.setAttribute("width", "52"); body.setAttribute("height", "30"); body.setAttribute("rx", "3");
  const flap = document.createElementNS(NS, "path");
  svg.appendChild(body); svg.appendChild(flap);
  if (series) series.insertBefore(svg, series.firstChild); else el.insertBefore(svg, el.firstChild);
  return {
    update(t) {
      const u = E.inout2(seg(t, Math.max(t0, sig - 0.6), sig));      // the flap's tip: from y −14 (open) to y 26 (closed)
      const tip = -14 + 40 * u;
      flap.setAttribute("d", `M2 8 L28 ${tip.toFixed(2)} L54 8`);
      const pad = 0.035 * Math.min(window.W, window.H);
      band.style.top = (el.offsetTop - pad).toFixed(2) + "px";
      band.style.height = (el.offsetHeight + 2 * pad).toFixed(2) + "px";
      band.style.opacity = el.style.opacity || "0";
    },
  };
};

// the end card's boxed answer: the episode's number, large, above "Next envelope: …", boxed in marker over d s
export const endBox = (el, { t0, answer, d = 0.6, S1 = 1 } = {}) => {
  injectCss();
  const wrap = document.createElement("div");
  wrap.className = "bv-ans";
  wrap.textContent = answer;
  const svg = document.createElementNS(NS, "svg"), r = document.createElementNS(NS, "rect");
  svg.appendChild(r); wrap.appendChild(svg);
  el.insertBefore(wrap, el.firstChild);
  return {
    update(t) {
      const w = wrap.offsetWidth, h = wrap.offsetHeight, sw = 5 * S1;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      r.setAttribute("x", String(sw)); r.setAttribute("y", String(sw)); r.setAttribute("width", String(Math.max(0, w - 2 * sw))); r.setAttribute("height", String(Math.max(0, h - 2 * sw)));
      r.setAttribute("rx", String(6 * S1)); r.setAttribute("stroke-width", String(sw));
      const per = 2 * (w + h), u = E.inout2(seg(t, t0 + 0.15, t0 + 0.15 + d));
      r.setAttribute("stroke-dasharray", `${per} ${per}`);
      r.setAttribute("stroke-dashoffset", String(per * (1 - u)));
    },
  };
};

// show your work: the whole sum, one row per spoken line (each lit marker as it's said), and the
// assumptions in green below. Centred in the safe box, above the captions; in and out over 0.35 s.
export const workCard = (W0, o = {}) => {
  injectCss();
  const root = o.root || document.getElementById("hud"), W = o.W ?? window.W, H = o.H ?? window.H;
  const el = document.createElement("div");
  el.className = "bv-work"; el.id = "bv-work";
  const rows = W0.rows.map((r) => `<div class="rw"><span class="k"></span><span class="v"></span></div>`).join("");
  el.innerHTML = `<div class="hd"></div>${rows}<div class="as">${W0.assume.map(() => "<span></span>").join("")}</div>`;
  el.querySelector(".hd").textContent = W0.title;
  const R = [...el.querySelectorAll(".rw")];
  R.forEach((rw, i) => { rw.querySelector(".k").textContent = W0.rows[i].k; rw.querySelector(".v").textContent = W0.rows[i].v; });
  [...el.querySelectorAll(".as span")].forEach((s, i) => { s.textContent = W0.assume[i]; });
  root.appendChild(el);
  return {
    el,
    update(t, gate = 1) {
      const SF = o.safe || { l: 0.0833 * W, r: 0.8333 * W, t: 0.13 * H, b: 0.74 * H };
      const w = Math.min(SF.r - SF.l, 0.74 * W);
      el.style.width = w + "px";
      const h = el.offsetHeight, x = (SF.l + SF.r) / 2 - w / 2, y = Math.min((o.capTop ?? 0.61) * H - h - 0.03 * H, (o.y ?? 0.3) * H);
      el.style.left = x.toFixed(2) + "px"; el.style.top = y.toFixed(2) + "px";
      const pr = presence(t, W0.t0, W0.t1, { d: 0.35, dy: 0.012, out: 0.35 });
      apply(el, { ...pr, o: pr.o * gate });
      R.forEach((rw, i) => {
        const r = W0.rows[i];
        rw.style.opacity = String(E.out3(seg(t, r.t, r.t + 0.3)));
        rw.classList.toggle("on", r.lit && t >= r.t && t < r.t + 1.6);
      });
    },
    cues: () => W0.rows.map((r, i) => ({ t: r.t, kind: "term.write", tag: `work-${i}` })),
  };
};

// a counter's text formats (hud.counter fmt)
export const fmtKms = (v) => (v / 1000).toFixed(1);
