// hudv2.js — Skin Sense look v2: the HUD as one design system (films/channels/skincare/set; new 3 Nov). Opt-in: an
// episode calls unifyHud(hudRoot) once; films that don't are unchanged (every rule is scoped to #hud.ol-v2).
//
//   unifyHud(hudRoot, { radius })   labels, corner badges, counters and captions share one plate: one corner radius,
//                                   one fill, one shadow, a left bar in the element's colour (no dots, no pill outlines).
//                                   Type pairing: sources and badges in mono, labels and captions in sans.
//   stackAsCard(header, body)       a header element (a counter or a spine) drawn as the top row of the plate under it:
//                                   one card at one width. Returns update(), to call every frame after hud.update(t)
//                                   (both elements move and fade with their own timings; the card follows the body).
export const unifyHud = (hudRoot, { radius = "1.4vmin" } = {}) => {
  if (!document.getElementById("ol-v2-css")) {
    const s = document.createElement("style"); s.id = "ol-v2-css";
    s.textContent = `
#hud.ol-v2 { --ol-r: ${radius}; --hud-cap-radius: var(--ol-r); --hud-note-radius: var(--ol-r); --hud-label-radius: var(--ol-r); }
#hud.ol-v2 .hud-label { border: 0; border-left: .7vmin solid var(--c, var(--hud-accent)); background: var(--hud-plate); box-shadow: var(--hud-shadow);
  font-family: var(--font-text); padding: 1.1vmin 2.2vmin 1.1vmin 1.8vmin; }
#hud.ol-v2 .hud-label .mk, #hud.ol-v2 .hud-label .g { display: none; }
#hud.ol-v2 .hud-badge, #hud.ol-v2 .hud-badge.tag { background: var(--hud-plate); box-shadow: var(--hud-shadow); font-family: var(--font-mono); }
#hud.ol-v2 .hud-badge .bar { width: .7vmin; border-radius: .2vmin; }
#hud.ol-v2 .hud-counter { border-radius: var(--ol-r); }
#hud.ol-v2 .ol-card-top { border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; box-shadow: none !important; }
#hud.ol-v2 .ol-card-body { border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; }`;
    document.head.appendChild(s);
  }
  hudRoot.classList.add("ol-v2");
};

export const stackAsCard = (header, body) => {
  header.classList.add("ol-card-top"); body.classList.add("ol-card-body");
  return () => {
    const hb = header.getBoundingClientRect(), bb = body.getBoundingClientRect(), root = body.offsetParent || document.body, rb = root.getBoundingClientRect();
    if (!bb.width) return;
    Object.assign(header.style, { left: `${bb.left - rb.left}px`, top: `${bb.top - rb.top - hb.height}px`, width: `${bb.width}px`, boxSizing: "border-box", transform: "none" });
  };
};
