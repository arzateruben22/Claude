// spine.js — the running sum (films/channels/whatif/set; bible §2): Back of the Envelope's spine readout. A
// bar under the subject, just above the captions, that writes the episode's calculation term by term in
// the mono face. Each state replaces the last; the terms new in it are lit marker for a beat and settle to
// chalk; assumptions carry a green ∵; the answer can be boxed (the channel's motif: a marker rectangle
// drawn round it over 0.5 s). Its small label says what the number means now. Reused by every episode.
//
//   import { createSpine } from "../set/spine.js";
//   const sp = createSpine({ states: FILM.spine, t1: FILM.spineOut, y: 0.565, safe: hud.safe, W, H });
//   window.seek = (t) => { ...; sp.update(t, gate); ... };       // gate: 1 → 0 as the end card arrives
//   sp.cues()                                                       // term.write and answer.box, for the cue sheet
//
// states: [{ t, label, terms: [[kind, text], ...], box }] with kind "in" (an input), "op" (an operator or a
// word), "assume" (an assumption: green, ∵), "ans" (the answer). Pure in t: the DOM is rebuilt whenever
// the state changes, and every style is set from t alone. Kept in the HUD root, so the renderer's text audit
// checks it like any HUD text.
import { seg, E, presence, apply } from "cinema/film/runtime.js";

const CSS = `
.bv-spine { position: absolute; left: 0; top: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; pointer-events: none; }
.bv-spine .lb { font: 600 2.8vmin/1.2 var(--font-text); color: var(--text-2); margin-bottom: .6vmin; letter-spacing: .01em; padding: .4vmin 1.4vmin; border-radius: .6vmin; background: rgba(37, 40, 46, .95); }
.bv-spine .bar { position: relative; display: flex; align-items: baseline; gap: 1.5vmin; padding: 1.2vmin 2.4vmin; border-radius: .9vmin;
  background: rgba(37, 40, 46, .95); box-shadow: var(--hud-shadow); white-space: nowrap;
  font: 600 3.9vmin/1.15 var(--font-mono); font-variant-numeric: tabular-nums lining-nums; font-variant-ligatures: none; font-feature-settings: "calt" 0, "liga" 0; }
.bv-spine .tm { color: var(--chalk); }
.bv-spine .tm.op { color: var(--text-2); font-family: var(--font-text); font-weight: 600; }
.bv-spine .tm.assume { color: var(--assume); }
.bv-spine .tm.assume::before { content: "∵ "; }
.bv-spine .tm.ans { color: var(--chalk); font-weight: 750; }
.bv-spine .tm.lit { color: var(--marker); }
.bv-spine svg.box { position: absolute; overflow: visible; pointer-events: none; }
.bv-spine svg.box rect { fill: none; stroke: var(--marker); stroke-width: .55vmin; stroke-linejoin: round; stroke-linecap: round; }
`;

export const createSpine = (o) => {
  const root = o.root || document.getElementById("hud"), W = o.W ?? window.W, H = o.H ?? window.H, S1 = Math.min(W, H) / 1080;
  const states = (o.states || []).slice().sort((a, b) => a.t - b.t), t1 = o.t1 ?? Infinity, y = o.y ?? 0.565;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement("div"); el.className = "bv-spine"; el.id = "bv-spine";
  el.innerHTML = '<div class="lb"></div><div class="bar"></div>';
  root.appendChild(el);
  const lb = el.querySelector(".lb"), bar = el.querySelector(".bar");
  const NS = "http://www.w3.org/2000/svg";
  let shown = -2, box = null;
  const build = (i) => {
    const s = states[i], prev = states[i - 1];
    lb.textContent = s.label || "";
    bar.innerHTML = "";
    const old = new Set((prev ? prev.terms : []).map((x) => x.join("|")));
    s.terms.forEach((x, j) => {
      const span = document.createElement("span");
      span.className = "tm " + x[0];
      span.textContent = x[1];
      span.dataset.fresh = old.has(x.join("|")) && !(s.box && x[0] === "ans" && !(prev && prev.box)) ? "0" : "1";
      span.dataset.ans = x[0] === "ans" ? "1" : "0";
      bar.appendChild(span);
    });
    box = null;
    if (s.box) {
      const ans = [...bar.children].filter((c) => c.dataset.ans === "1").pop();
      if (ans) {
        const svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "box");
        const r = document.createElementNS(NS, "rect");
        svg.appendChild(r); bar.appendChild(svg);
        box = { svg, r, ans };
      }
    }
    shown = i;
  };
  const update = (t, gate = 1) => {
    let i = -1;
    for (let k = 0; k < states.length; k++) if (t >= states[k].t) i = k;
    if (i < 0 || t >= t1 + 0.5) { el.style.visibility = "hidden"; el.style.opacity = "0"; return; }
    if (i !== shown) build(i);
    const s = states[i];
    // the bar fades in with the first state and out at t1
    const pr = presence(t, states[0].t > 0 ? states[0].t : null, t1, { d: 0.35, dy: 0.01, out: 0.35 });
    // light the fresh terms: marker for 1.1 s, then settle to chalk (the answer stays lit while boxed)
    const lit = t - s.t < 1.1;
    for (const c of bar.children) {
      if (!c.classList.contains("tm")) continue;
      const on = (c.dataset.fresh === "1" && lit) || (s.box && c.dataset.ans === "1");
      c.classList.toggle("lit", on);
      c.style.opacity = c.dataset.fresh === "1" ? String(E.out3(seg(t, s.t, s.t + 0.25))) : "1";
    }
    // place: centred, clamped inside the safe box
    const w = el.offsetWidth, h = el.offsetHeight, SF = o.safe || { l: 0, r: W, t: 0, b: H };
    const x = Math.min(SF.r - w / 2, Math.max(SF.l + w / 2, W / 2)), yy = y * H;
    el.style.left = (x - w / 2).toFixed(2) + "px"; el.style.top = (yy - h / 2).toFixed(2) + "px";
    apply(el, { ...pr, o: pr.o * gate });
    if (box) {
      // the box: a marker rectangle drawn round the answer over 0.5 s from the state's time (stroke-dashoffset)
      const a = box.ans, pad = 1.1 * S1 * 10;
      const bx = a.offsetLeft - pad, by = a.offsetTop - pad * 0.7, bw = a.offsetWidth + 2 * pad, bh = a.offsetHeight + 1.4 * pad;
      Object.assign(box.svg.style, { left: bx + "px", top: by + "px", width: bw + "px", height: bh + "px" });
      box.svg.setAttribute("viewBox", `0 0 ${bw} ${bh}`);
      box.r.setAttribute("x", "1"); box.r.setAttribute("y", "1"); box.r.setAttribute("width", String(bw - 2)); box.r.setAttribute("height", String(bh - 2));
      box.r.setAttribute("rx", String(4 * S1));
      const per = 2 * (bw + bh), u = (states[shown - 1] && states[shown - 1].box) ? 1 : E.inout2(seg(t, s.t, s.t + 0.5));
      box.r.setAttribute("stroke-dasharray", `${per} ${per}`);
      box.r.setAttribute("stroke-dashoffset", String(per * (1 - u)));
    }
  };
  const cues = () => states.map((s, i) => ({ t: s.t, kind: s.box && !(states[i - 1] && states[i - 1].box) ? "answer.box" : "term.write", tag: `spine-${i}` }));
  return { el, update, cues };
};
