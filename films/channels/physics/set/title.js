// title.js — Rest Frame's title-card and end-card motif, "the drop" (films/channels/physics/set; theme.json
// motif.title_card): the title falls onto a ruler line and bounces twice on the sonic signature (knocks at
// the signature's 0, +12 and +20 frames; each flight 2/3 of the last, a ball with restitution 0.67 coming
// to rest), Archivo's width axis squashing the letters on each contact, and three faint copies stamped
// on the way down trailing above it (the strobe ladder, in type).
//
//   import { dropTitle } from "../set/title.js";
//   const el = hud.title({ series, title, t1, sig });       // hud.js's shell
//   const drop = dropTitle(el, { sig, fps: 30 });            // restyles the shell; returns update(t)
//   window.seek = (t) => { ...; hud.update(t); drop(t); ... };
//
// Pure in t: the fall, the bounces and the squash are closed-form; the copies are fixed stamps that show
// once the falling title has passed them. The copies and the ruler line live inside the hud element, so
// the HUD's own placement, fade and the renderer's audit treat them as one part.
import { seg, E } from "cinema/film/runtime.js";

const CSS = `
.rf-drop { position: relative; }
.rf-drop .rf-stage { position: relative; }
.rf-drop .rf-copy { position: absolute; left: 0; top: 0; right: 0; margin: 0; pointer-events: none; color: var(--ink-2, #4B505B); }
.rf-drop .rf-copy em { color: inherit; }
.rf-drop .rf-ruler { position: relative; height: 1.6vmin; margin-top: .9vmin; border-top: .42vmin solid var(--ink, #15171C);
  background: repeating-linear-gradient(90deg, var(--ink, #15171C) 0 .28vmin, transparent .28vmin 3.7vmin) top left / 100% 1.1vmin no-repeat; }
.rf-drop .hud-series { display: inline-block; margin-top: 1.1vmin; }
.rf-drop .hud-h, .rf-drop .t { will-change: transform; }
`;

let cssDone = false;
const addCss = () => {
  if (cssDone) return;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); cssDone = true;
};

// el: the hud title (or end-card) element; o: { sig (first contact, film s), fps, fall: px the title falls,
// lead: seconds of fall before the first contact, bounce: [px, px] of the two bounces, copies: 3, wdth: [125, 108],
// head: the selector of the line that drops (".hud-h" for the title, ".t" for the end card) }
export const dropTitle = (el, o = {}) => {
  addCss();
  const fps = o.fps ?? 30, sig = o.sig ?? 0.3, S1 = Math.min(window.W, window.H) / 1080;
  const fall = (o.fall ?? 104) * S1, lead = o.lead ?? 0.42, [b1, b2] = (o.bounce || [30, 12]).map((x) => x * S1);
  const t1 = sig + 12 / fps, t2 = sig + 20 / fps, ta = sig - lead;
  const [w0, w1] = o.wdth || [125, 106];
  const head = el.querySelector(o.head || ".hud-h");
  el.classList.add("rf-drop");
  // restructure: [copies + the dropping line] then the ruler, then whatever followed (series, next, follow)
  const stage = document.createElement("div"); stage.className = "rf-stage";
  head.parentNode.insertBefore(stage, head);
  const series = el.querySelector(".hud-series");
  const nCopies = o.copies ?? 3, copies = [], copyT = [];
  for (let k = 0; k < nCopies; k++) {
    const c = head.cloneNode(true); c.classList.add("rf-copy"); c.removeAttribute("id"); c.setAttribute("aria-hidden", "true");
    stage.appendChild(c); copies.push(c);
    copyT.push(sig - (nCopies - k) * (lead / (nCopies + 0.6)));          // stamped on the way down, before the first contact
  }
  stage.appendChild(head);
  const ruler = document.createElement("div"); ruler.className = "rf-ruler";
  stage.after(ruler);
  if (series) ruler.after(series);                                     // the series line sits under the ruler

  const height = (t) => {                                              // px above the ruler line
    if (t < sig) { const u = Math.max(0, (t - ta) / lead); return fall * (1 - u * u); }   // free fall from rest at ta
    if (t < t1) { const u = (t - sig) / (t1 - sig); return 4 * b1 * u * (1 - u); }
    if (t < t2) { const u = (t - t1) / (t2 - t1); return 4 * b2 * u * (1 - u); }
    return 0;
  };
  const squash = (t) => { let s = 0; for (const c of [sig, t1, t2]) s = Math.max(s, Math.exp(-Math.pow((t - c) / 0.05, 2)) * (c === sig ? 1 : c === t1 ? 0.6 : 0.3)); return s; };
  const update = (t) => {
    const h = height(t), sq = squash(t);
    head.style.transform = `translateY(${(-h).toFixed(2)}px)`;
    head.style.fontVariationSettings = `"wdth" ${(w0 - (w0 - w1) * sq).toFixed(2)}`;
    copies.forEach((c, k) => {
      const tk = copyT[k], hk = height(tk), on = t >= tk ? E.out3(seg(t, tk, tk + 0.08)) : 0;
      c.style.transform = `translateY(${(-hk).toFixed(2)}px)`;
      c.style.opacity = (on * (0.10 + 0.07 * k) * (1 - 0.6 * seg(t, t2 + 0.6, t2 + 2.2))).toFixed(4);
    });
  };
  update(0);
  return update;
};
