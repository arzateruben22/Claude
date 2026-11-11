// night.mjs — Skin Sense Season 3 look test overlay: the night ground, a full-frame three.js picture (set/night3d.js) and the captions only
// (small ivory serif, one short line at a time). No series line, no title, no labels, no end card.
export async function run({ stage, FILM, W, H, EP }) {
  const u = W / 1080, px = (v) => `${(v * u).toFixed(2)}px`;
  const css = document.createElement("style");
  css.textContent = `.night{position:absolute;inset:0;background:#0B1513;overflow:hidden}.night .artbox{position:absolute;left:0;top:0;width:${px(1080)};height:${px(1920)};overflow:hidden}
.night::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 45%,rgba(11,21,19,0) 60%,rgba(11,21,19,.5) 100%);pointer-events:none}.night .cap{position:absolute;left:0;right:0;top:${px(1330)};text-align:center;z-index:3}.night .cap span{display:inline-block;padding:${px(16)} ${px(34)};border-radius:${px(34)};background:rgba(11,21,19,.74);border:${px(1.5)} solid rgba(244,237,227,.14);font:400 ${px(46)}/${px(58)} "Newsreader",serif;color:#F4EDE3;letter-spacing:.01em;box-shadow:0 ${px(8)} ${px(30)} rgba(0,0,0,.35)};right:${px(70)};top:${px(1290)};text-align:center;font:400 ${px(54)}/${px(64)} "Newsreader",serif;color:#F4EDE3;text-shadow:0 ${px(2)} ${px(16)} rgba(5,12,10,.85),0 0 ${px(34)} rgba(5,12,10,.7);letter-spacing:.01em}`;
  document.head.appendChild(css);
  const root = document.createElement("div"); root.className = "night"; root.innerHTML = `<div class="artbox" id="artbox"></div><div class="cap" id="cap"></div>`;
  const stageEl = document.getElementById("stage"); stageEl.insertBefore(root, stageEl.firstChild);
  if (EP.cover && EP.cover.grad) { const gr = document.createElement("div"); gr.style.cssText = `position:absolute;left:0;right:0;top:0;height:100%;z-index:3;background:linear-gradient(to bottom,rgba(11,21,19,${EP.cover.grad}) 0%,rgba(11,21,19,0) 45%);pointer-events:none`; root.appendChild(gr); }
  if (EP.cover && EP.cover.text) { const cv = document.createElement("div"); cv.style.cssText = `position:absolute;left:${px(70)};right:${px(70)};top:${px(EP.cover.top || 300)};text-align:center;z-index:4;font:400 ${px(EP.cover.size || 120)}/${px((EP.cover.size || 120) * 1.05)} "Newsreader",serif;color:#F4EDE3;text-shadow:0 ${px(2)} ${px(18)} rgba(5,12,10,.8)`; cv.textContent = EP.cover.text; root.appendChild(cv); }
  let hookEl = null, hookGr = null;                                                       // v2: a hook of at most 5 words in the top third over a soft dark gradient (counts as one of the two text blocks)
  if (EP.hook && EP.hook.text) { hookGr = document.createElement("div"); hookGr.style.cssText = `position:absolute;left:0;right:0;top:0;height:100%;z-index:3;background:linear-gradient(to bottom,rgba(11,21,19,${EP.hook.grad || 0.7}) 0%,rgba(11,21,19,0) 42%);pointer-events:none;opacity:0`; root.appendChild(hookGr);
    hookEl = document.createElement("div"); const hs = EP.hook.size || 92; hookEl.style.cssText = `position:absolute;left:${px(70)};right:${px(70)};top:${px(EP.hook.top || 300)};text-align:center;z-index:4;font:400 ${px(hs)}/${px(hs * 1.08)} "Newsreader",serif;color:#F4EDE3;text-shadow:0 ${px(3)} ${px(26)} rgba(11,21,19,.85);opacity:0;pointer-events:none`; hookEl.textContent = EP.hook.text; root.appendChild(hookEl); }
  const artbox = root.querySelector("#artbox"), capEl = root.querySelector("#cap"), AW = 1080 * u, BH = 1920 * u, BTOP = 0, LN = FILM.lines || {}, R = (s) => { if (typeof s === "number") return s; const m = /^(start|end):(vo\d+c?)([+-][\d.]+)?$/.exec(s); if (!m) throw new Error("bad time spec " + s); return LN[m[2]][m[1] === "start" ? 0 : 1] + Number(m[3] || 0); };
  const mod = await import(EP.three.module), T3 = await mod.create({ W, H, u, AW, BH, BTOP, artbox, R, EP });
  const eo = (x) => 1 - Math.pow(1 - x, 3), seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  window.seek = function (t) {
    stage(t); T3.seek(t);
    let on = null, op = 0; for (const [a, z, tx] of EP.caps) { const o = eo(seg(t, a, a + 0.3)) * (1 - eo(seg(t, z - 0.3, z))); if (o > op) { op = o; on = tx; } }
    if (hookEl) { const h = EP.hook, ho = eo(seg(t, h.t0, h.t0 + 0.4)) * (1 - eo(seg(t, h.t1 - 0.5, h.t1))); hookEl.style.opacity = ho.toFixed(3); hookGr.style.opacity = ho.toFixed(3); }
    capEl.innerHTML = on ? `<span>${on}</span>` : ""; capEl.style.opacity = op.toFixed(3);
  };
}
