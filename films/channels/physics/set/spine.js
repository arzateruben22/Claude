// spine.js — where the spine readout sits (films/channels/physics/set; WRITING.md "The picture" 2). The readout is the
// kit's hud.counter, pinned to the safe box's left edge at a fixed height, with its label wrapping at 30vmin; cards in
// the top-right slot stop at 38vmin. Together they fit the 75vmin safe width side by side, so a card never sits on
// the readout and the readout never leaves the safe box, whatever its label or value.
//
//   import { SPINE_CSS, pinSpine } from "../set/spine.js";
//   const spineOpts = { value, fmt, unit, label, t0, t1, at: [0.26, 0.19], minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
//   pinSpine(spineOpts, counterEl, hud, W, 0.19);   // then add SPINE_CSS to the scene's style
export const SPINE_CSS = "#hud .hud-counter { padding: .9vmin 2.2vmin 1.2vmin; border-radius: .8vmin; background: rgba(255, 253, 247, .95); } "
  + "#hud .hud-counter .lb { max-width: 30vmin; white-space: normal; text-align: center; text-wrap: balance; } .hud-badge.card { max-width: 38vmin; } ";

// hud.counter reads opts.at (its centre, as fractions) every frame: make it follow the plate's own width, measured
// after this frame's text is in, so the left edge stays on the safe line (a pure function of the frame's text)
export const pinSpine = (opts, el, hud, W, y) =>
  Object.defineProperty(opts, "at", { configurable: true, enumerable: true, get: () => [(hud.safe.l + el.offsetWidth / 2) / W, y] });
