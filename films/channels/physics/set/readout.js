// readout.js — Rest Frame's scale readout, "ruler ticks on the grid" (films/channels/physics/set; theme.json
// motif.scale_readout): a number printed under the floor line at a point of the subject's plane, with a
// tick up to that point, like the numbering under a ruler. For landing distances ("40 cm") and other
// marks on the floor, where a label pill would cover the very spot it names.
//
//   import { createReadouts } from "../set/readout.js";
//   const RD = createReadouts({ project: hud.project });
//   RD.add("d40", { at: [40, 0, 0], text: "40 cm", t0, t1 });
//   window.seek = (t) => { ...; hud.update(t); RD.update(t, gate); ... };   // gate: 1 → 0 as the end card arrives
//
// Pure in t. Plex Mono (the channel's number face) at the badge size, ink on a light plate. Kept in the
// HUD root, so the renderer's text audit checks it like any HUD text.
import { presence, apply } from "cinema/film/runtime.js";

const CSS = `
.rf-read { position: absolute; left: 0; top: 0; z-index: 3; display: flex; flex-direction: column; align-items: center; pointer-events: none; }
.rf-read .tk { display: block; width: .42vmin; height: 2.4vmin; background: var(--ink, #15171C); }
.rf-read .tx { margin-top: .3vmin; padding: .35vmin 1.1vmin; border-radius: var(--hud-badge-radius, .5vmin); white-space: nowrap;
  font: 600 var(--hud-badge-size, 2.963vmin)/1.1 var(--font-mono); font-variant-numeric: tabular-nums; color: var(--ink, #15171C);
  background: var(--hud-badge-bg, rgba(255, 253, 247, .9)); }
`;

export const createReadouts = (o = {}) => {
  const root = o.root || document.getElementById("hud"), project = o.project, R = [];
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  const add = (id, d) => {
    const el = document.createElement("div"); el.className = "rf-read"; el.id = "rf-" + id;
    el.innerHTML = '<i class="tk"></i><span class="tx"></span>';
    el.querySelector(".tx").textContent = d.text;
    root.appendChild(el);
    R.push({ id, el, d });
    return el;
  };
  const update = (t, gate = 1) => {
    for (const { el, d } of R) {
      const p = project(typeof d.at === "function" ? d.at(t) : d.at), w = el.offsetWidth;
      el.style.left = (p.x - w / 2).toFixed(2) + "px"; el.style.top = p.y.toFixed(2) + "px";
      const pr = presence(t, d.t0 > 0 ? d.t0 : null, d.t1 ?? null, { d: 0.35, dy: 0.01, out: 0.3 });
      apply(el, { ...pr, o: pr.o * gate });
    }
  };
  const cues = () => R.map(({ id, el, d }) => ({ t: d.t0, kind: "label", tag: id, el: el.id }));
  return { add, update, cues, items: R };
};
