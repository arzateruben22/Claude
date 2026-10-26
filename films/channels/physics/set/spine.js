// spine.js — where the spine readout sits (films/channels/physics/set; WRITING.md "The picture" 2 and 8). The readout is
// the kit's hud.counter on a paper plate, its label wrapping at 34vmin. By the channel's layout (rule 8) the top-left
// corner holds the speed column, the top-right the standing cheats (at most two notes each), and the readout sits
// between and below them, centred by default; a shot whose subject is there parks it in that shot's empty region.
//
//   import { SPINE_CSS, placeSpine } from "../set/spine.js";
//   const spineOpts = { value, fmt, unit, label, t0, t1, minCh: 4 }, counterEl = hud.counter("spine", spineOpts);
//   placeSpine(spineOpts, counterEl, hud, W, H, FILM.spineAt);   // [[t, [fx, fy]], ...] centre fractions, a step at each t
//   // (or a single [fx, fy]; default [0.5, 0.245]); the plate is clamped inside the safe box whatever its width
//   pinSpine(spineOpts, counterEl, hud, W, y)                     // the earlier layout: left edge on the safe line
export const SPINE_CSS = "#hud .hud-counter { padding: .9vmin 2.2vmin 1.2vmin; border-radius: .8vmin; background: rgba(255, 253, 247, .95); } "
  + "#hud .hud-counter .lb { max-width: 34vmin; white-space: normal; text-align: center; text-wrap: balance; } .hud-badge.card { max-width: 46vmin; } ";

export const SPINE_AT = [0.5, 0.245];

// hud.counter reads opts.at every frame (a function of t is allowed): step through the keys, then clamp the plate,
// measured after this frame's text is in, inside the safe box (a pure function of t and the frame's text)
export const placeSpine = (opts, el, hud, W, H, keys = SPINE_AT) => {
  const K = Array.isArray(keys) && Array.isArray(keys[0]) ? keys : [[-Infinity, keys]];
  opts.at = (t) => {
    const [fx, fy] = (K.filter(([k]) => t >= k).pop() || K[0])[1];
    const w = el.offsetWidth, h = el.offsetHeight, S = hud.safe;
    const x = Math.min(S.r - w / 2, Math.max(S.l + w / 2, fx * W)), y = Math.min(S.b - h / 2, Math.max(S.t + h / 2, fy * H));
    return [x / W, y / H];
  };
  return opts;
};

export const pinSpine = (opts, el, hud, W, y) =>
  Object.defineProperty(opts, "at", { configurable: true, enumerable: true, writable: true, value: (t) => [(hud.safe.l + el.offsetWidth / 2) / W, y] });
