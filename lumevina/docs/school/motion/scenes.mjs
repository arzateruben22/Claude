// Lumevina Skin School motion studio: the scenes.
//
// Each scene is a shot list plus a page: markup, CSS, an optional setup() that
// builds repeated elements once, and seek(t, st, M, C), which sets everything
// on screen from time alone (st.i is the current shot, st.lt the seconds into
// it; M is the runtime in motion.js; C the palette). Sizes are in vmin so a
// scene renders the same at 16:9 (1280×720) and 9:16 (720×1280); portrait
// gets its own layout rules where it needs them.
//
// Every line and number here comes from the lesson, the general esthetics
// layer or Evelyn's own Skin Playbook answers ("Evelyn says"). Nothing fades
// in for its own sake: a layer stacks, a cell rises, a wall wears and seals, a
// calendar fills, pairs collide, a timeline reaches day 90.

export const PALETTE = { rose: "#f4c9d6", rose2: "#eab9c8", gold: "#e3b48f", green: "#32d74b", red: "#ff7a6b", blue: "#8fd3ff", t2: "#a1a1a6", t3: "#6e6e73" };

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#32d74b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CROSS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#ff7a6b" stroke-width="3" stroke-linecap="round"/></svg>`;
const CLOUD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.3 4.5 4.5 0 0 0 7 18z" fill="#8e8e93"/></svg>`;
const SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="#e3b48f"/><g stroke="#e3b48f" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g></svg>`;
const MOON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="#c9c9ce"/></svg>`;
const FACE = `<svg viewBox="0 0 100 124" aria-hidden="true"><ellipse cx="50" cy="62" rx="42" ry="56" fill="#1e1719" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/><path d="M30 48q8-5 16 0M54 48q8-5 16 0M50 56v18q-6 6 0 7M38 92q12 8 24 0" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5" stroke-linecap="round"/></svg>`;

export const SCENES = {

  /* ───────── 1-1 Your skin, in three layers ───────── */
  "1-1": {
    id: "1-1", kicker: "How skin works", title: `Your skin, <span class="grad">in three layers.</span>`, dur: 22, poster: 6.4,
    shots: [
      { at: 0, name: "layers", cap: "Home products work on the top layer. Professional treatments reach deeper." },
      { at: 7, name: "turnover", cap: "A new cell takes about four weeks to reach the surface. Slower with age." },
      { at: 14, name: "judge", cap: "So judge a routine at 8 to 12 weeks, not 8 to 12 days." }
    ],
    css: `
.layers { display: flex; flex-direction: column; gap: 1.4vmin; height: 100%; justify-content: center; max-width: 120vmin; }
.layer { position: relative; border-radius: 2.4vmin; padding: 2.4vmin 3.2vmin; opacity: 0; }
.layer b { display: block; font-size: 3.2vmin; font-weight: 700; }
.layer span { display: block; font-size: 2.4vmin; margin-top: .4vmin; opacity: .8; }
.epi { background: linear-gradient(#f7d3de, #eab9c8); color: #111; }
.der { background: #3a2a2f; padding-bottom: 3.4vmin; }
.fat { background: #201a1c; color: #a1a1a6; }
.tag { position: absolute; right: 2.6vmin; top: 50%; margin-top: -2.1vmin; font-style: normal; font-size: 2.2vmin; font-weight: 600; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(0,0,0,.4); color: #fff; opacity: 0; white-space: nowrap; }
.epi .tag { background: rgba(0,0,0,.14); color: #111; }
@media (orientation: landscape) { .layer { padding-right: 48vmin; } }
.rise { display: flex; align-items: center; gap: 7vmin; height: 100%; }
.column { position: relative; width: 22vmin; height: 52vmin; border-radius: 3vmin; background: #2a1f23; overflow: hidden; flex: 0 0 auto; }
.surface { position: absolute; left: 0; right: 0; top: 0; height: 14%; background: linear-gradient(#f7d3de, #eab9c8); color: #111; font-size: 2.1vmin; font-weight: 600; display: grid; place-items: center; }
.base { position: absolute; left: 0; right: 0; bottom: 0; height: 12%; background: #1a1416; color: #a1a1a6; font-size: 2vmin; display: grid; place-items: center; }
.cell { position: absolute; left: 50%; margin-left: -2.4vmin; bottom: 12%; width: 4.8vmin; height: 4.8vmin; border-radius: 50%; background: #f4c9d6; box-shadow: 0 0 3vmin rgba(244,201,214,.6); }
.ring { position: relative; width: 30vmin; height: 30vmin; flex: 0 0 auto; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.rt { fill: none; stroke: #2a2a2d; stroke-width: 8; }
.rp { fill: none; stroke: #eab9c8; stroke-width: 8; stroke-linecap: round; stroke-dasharray: 326.7; stroke-dashoffset: 326.7; }
.rn { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.rn b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; display: block; line-height: 1; }
.rn span { font-size: 2.4vmin; color: #a1a1a6; }
.note { font-size: 2.8vmin; color: #a1a1a6; max-width: 40vmin; line-height: 1.4; opacity: 0; }
.judge { display: flex; flex-direction: column; justify-content: center; gap: 3vmin; height: 100%; max-width: 120vmin; }
.lead { font-size: 4vmin; font-weight: 600; min-height: 5vmin; }
.bar { position: relative; height: 5vmin; border-radius: 999px; background: #2a2a2d; margin-bottom: 6vmin; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f7d3de, #e2b08c); }
.band { position: absolute; left: 66.7%; width: 33.3%; top: -1.2vmin; bottom: -1.2vmin; border-radius: 2vmin; border: 2px solid #f4c9d6; display: grid; place-items: center; opacity: 0; }
.band span { background: #000; padding: .4vmin 1.4vmin; border-radius: 999px; font-size: 2.4vmin; font-weight: 600; color: #f4c9d6; }
.ticks { position: absolute; left: 0; right: 0; top: 6.4vmin; display: flex; justify-content: space-between; font-size: 2.1vmin; color: #6e6e73; }
.no { font-size: 3.4vmin; color: #ff7a6b; text-decoration: line-through; text-decoration-thickness: .4vmin; opacity: 0; }
@media (orientation: portrait) {
  .tag { position: static; display: inline-block; margin-top: 1.2vmin; }
  .rise { flex-direction: column; justify-content: center; gap: 5vmin; } .column { height: 40vmin; width: 26vmin; } .note { max-width: 100%; text-align: center; }
}`,
    html: `
<section class="shot"><div class="layers">
  <div class="layer epi" id="l-epi"><b>Epidermis</b><span>the surface you treat at home</span><em class="tag" id="tag-home">home care works here</em></div>
  <div class="layer der" id="l-der"><b>Dermis</b><span>collagen, elastin, oil glands, blood supply</span><em class="tag" id="tag-pro">professional treatments reach here</em></div>
  <div class="layer fat" id="l-fat"><b>Fat and support</b><span>beneath it all</span></div>
</div></section>
<section class="shot"><div class="rise">
  <div class="column"><div class="surface">surface</div><div class="cell" id="cell"></div><div class="base">base layer</div></div>
  <div class="ring"><svg viewBox="0 0 120 120"><circle class="rt" cx="60" cy="60" r="52"/><circle class="rp" id="ring" cx="60" cy="60" r="52"/></svg><div class="rn"><b id="days">0</b><span>days</span></div></div>
  <p class="note" id="note1">About four weeks in your twenties. Slower with age.</p>
</div></section>
<section class="shot"><div class="judge">
  <p class="lead" id="lead"></p>
  <div class="bar"><div class="fill" id="fill"></div><div class="band" id="band"><span>8 to 12 weeks</span></div><div class="ticks" id="ticks"></div></div>
  <p class="no" id="no">not 8 to 12 days</p>
</div></section>`,
    setup: (M) => { M.$("#ticks").innerHTML = Array.from({ length: 13 }, (_, w) => `<span>${w === 12 ? "12 wk" : w}</span>`).join(""); },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, enter, seg, E, type } = M;
      if (i === 0) {
        enter($("#l-fat"), lt, 0.2, { y: 60, d: 0.8 }); enter($("#l-der"), lt, 0.9, { y: 60, d: 0.8 }); enter($("#l-epi"), lt, 1.6, { y: 60, d: 0.8 });
        enter($("#tag-home"), lt, 3.4, { y: 0, s: 0.6, d: 0.5 }); enter($("#tag-pro"), lt, 5.0, { y: 0, s: 0.6, d: 0.5 });
      } else if (i === 1) {
        const p = E.inout(seg(lt, 0.4, 5.4)), flat = seg(lt, 4.6, 5.4);
        $("#cell").style.bottom = (12 + 74 * p) + "%";
        $("#cell").style.transform = `scale(${1 + 0.25 * flat}, ${1 - 0.55 * flat})`;
        $("#ring").style.strokeDashoffset = 326.7 * (1 - p);
        $("#days").textContent = Math.round(28 * p);
        enter($("#note1"), lt, 5.5, { y: 14 });
      } else {
        type($("#lead"), "So judge a routine at", lt, 0.2, 26);
        $("#fill").style.width = (100 * E.inout(seg(lt, 0.8, 5.2))) + "%";
        enter($("#band"), lt, 3.9, { y: 0, s: 0.92, d: 0.5 });
        enter($("#no"), lt, 5.6, { y: 10 });
      }
    }
  },

  /* ───────── 1-3 The barrier: bricks and mortar ───────── */
  "1-3": {
    id: "1-3", kicker: "Why less is more", title: `The barrier: <span class="grad">bricks and mortar.</span>`, dur: 24, poster: 5.4,
    shots: [
      { at: 0, name: "wall", cap: "Skin cells are the bricks. Your skin's own oils are the mortar." },
      { at: 6, name: "wear", cap: "Too many actives, hot water, scrubbing: the mortar wears. Water leaks out, irritants get in." },
      { at: 13, name: "seal", cap: "Fewer actives, a gentle cleanser, ceramides, SPF. The wall seals again in days to weeks." }
    ],
    css: `
.wallwrap { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 3vmin; }
.wall { position: relative; display: grid; grid-template-columns: repeat(8, 1fr); gap: 1.2vmin; padding: 1.2vmin; border-radius: 2.4vmin; background: #eab9c8; max-width: 120vmin; }
.brick { height: 7.2vmin; border-radius: 1vmin; background: #2a1f23; opacity: 0; }
.drop { position: absolute; width: 2.2vmin; height: 2.2vmin; border-radius: 50% 50% 50% 0; background: #8fd3ff; opacity: 0; }
.arrow { position: absolute; width: 0; height: 0; border-left: 1.3vmin solid transparent; border-right: 1.3vmin solid transparent; border-top: 2.6vmin solid #ff7a6b; opacity: 0; }
.legend { display: flex; gap: 2vmin; flex-wrap: wrap; align-items: center; }
.legend .chip { opacity: 0; }
.steps { display: flex; gap: 2vmin; flex-wrap: wrap; }
.step { opacity: 0; }
.step .card { display: flex; align-items: center; gap: 1.6vmin; padding: 1.8vmin 2.4vmin; }
.step i { width: 3.2vmin; height: 3.2vmin; border-radius: 50%; background: #f4c9d6; display: inline-block; }
.step b { font-size: 2.6vmin; white-space: nowrap; }
@media (orientation: portrait) { .wall { grid-template-columns: repeat(6, 1fr); } .brick { height: 7.6vmin; } }`,
    html: `
<section class="shot"><div class="wallwrap"><div class="wall" id="wall0"></div><div class="legend"><span class="chip" id="lg1">bricks: skin cells</span><span class="chip" id="lg2" style="border-color:#f7d3de;color:#f7d3de">mortar: your skin's oils</span></div></div></section>
<section class="shot"><div class="wallwrap"><div class="wall" id="wall1"></div><div class="legend"><span class="chip" id="lg3" style="border-color:#8fd3ff;color:#8fd3ff">water leaks out</span><span class="chip" id="lg4" style="border-color:#ff7a6b;color:#ff7a6b">irritants get in</span></div></div></section>
<section class="shot"><div class="wallwrap"><div class="wall" id="wall2"></div><div class="steps"><div class="step" id="st1"><div class="card"><i></i><b>Gentle cleanser</b></div></div><div class="step" id="st2"><div class="card"><i></i><b>Ceramide moisturizer</b></div></div><div class="step" id="st3"><div class="card"><i></i><b>SPF</b></div></div></div></div></section>`,
    setup: (M) => {
      for (const id of ["wall0", "wall1", "wall2"]) {
        const w = M.$("#" + id);
        w.innerHTML = Array.from({ length: 48 }, () => `<div class="brick"></div>`).join("");
        if (id !== "wall0") w.insertAdjacentHTML("beforeend", Array.from({ length: 6 }, () => `<i class="drop"></i><i class="arrow"></i>`).join(""));
      }
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, tw, seg, E, set, lerpColor } = M;
      const vm = Math.min(window.innerWidth, window.innerHeight) / 100, ROSE = [234, 185, 200], DULL = [118, 70, 82], GAPS = [5, 11, 18, 26, 33, 41];
      const bricks = (w) => $$(".brick", w);
      const at = (w, el, idx, dy) => { const b = bricks(w)[idx]; el.style.left = (b.offsetLeft + b.offsetWidth / 2 - el.offsetWidth / 2) + "px"; el.style.top = (b.offsetTop + dy) + "px"; };
      if (i === 0) {
        const w = $("#wall0");
        bricks(w).forEach((b, k) => enter(b, lt, 0.1 + (k % 8) * 0.07 + Math.floor(k / 8) * 0.32, { y: -30, d: 0.45 }));
        enter($("#lg1"), lt, 3.6, { y: 10 }); enter($("#lg2"), lt, 4.4, { y: 10 });
      } else if (i === 1) {
        const w = $("#wall1"), bs = bricks(w);
        bs.forEach((b) => set(b, { o: 1 }));
        w.style.background = lerpColor(ROSE, DULL, E.out(seg(lt, 0.3, 3.5)));
        GAPS.forEach((g, k) => set(bs[g], { s: 1 - 0.22 * E.out(seg(lt, 0.4 + k * 0.35, 1.2 + k * 0.35)), o: 1 }));
        $$(".drop", w).forEach((d, k) => { const ph = Math.max(0, lt - 1.6 - k * 0.3), cyc = (ph * 0.55 + k * 0.17) % 1; at(w, d, GAPS[k], 0); set(d, { y: -cyc * 18 * vm - 3 * vm, o: ph > 0 ? Math.sin(cyc * Math.PI) : 0, r: -45 }); });
        $$(".arrow", w).forEach((a, k) => { const ph = Math.max(0, lt - 2.2 - k * 0.3), cyc = (ph * 0.5 + k * 0.23) % 1; at(w, a, GAPS[k], -7 * vm); set(a, { y: cyc * 9 * vm, o: ph > 0 ? Math.sin(cyc * Math.PI) : 0 }); });
        enter($("#lg3"), lt, 2.4, { y: 10 }); enter($("#lg4"), lt, 3.2, { y: 10 });
      } else {
        const w = $("#wall2"), bs = bricks(w), T = [0.3, 2.6, 4.9];
        bs.forEach((b) => set(b, { o: 1 }));
        $$(".drop, .arrow", w).forEach((x) => set(x, { o: 0 }));
        GAPS.forEach((g, k) => { const t0 = T[Math.floor(k / 2)] + 0.4 + (k % 2) * 0.25; set(bs[g], { s: tw(lt, t0, t0 + 0.9, 0.78, 1, E.back), o: 1 }); });
        w.style.background = lerpColor(DULL, ROSE, E.out(seg(lt, 0.6, 7.2)));
        w.style.boxShadow = `0 0 ${tw(lt, 7.4, 9.2, 0, 7)}vmin rgba(247,211,222,${tw(lt, 7.4, 9.2, 0, 0.55)})`;
        ["#st1", "#st2", "#st3"].forEach((id, k) => enter($(id), lt, T[k], { y: 16 }));
      }
    }
  },

  /* ───────── 2-3 Sunscreen: enough, every day ───────── */
  "2-3": {
    id: "2-3", kicker: "The anti-aging step", title: `Sunscreen: <span class="grad">enough, every day.</span>`, dur: 22, poster: 6.2,
    shots: [
      { at: 0, name: "amount", cap: "Two finger lengths for your face and neck, every morning. Most people use a third of that." },
      { at: 7, name: "reapply", cap: "Outside, reapply every two hours. A window doesn't stop UVA." },
      { at: 14, name: "daily", cap: "Every day, clouds included. It's the one anti-aging step with the evidence behind it." }
    ],
    css: `
.fingers { display: flex; align-items: center; gap: 7vmin; height: 100%; }
.hand { display: flex; gap: 2.4vmin; align-items: flex-end; flex: 0 0 auto; }
.finger { position: relative; width: 9vmin; height: 44vmin; border-radius: 4.5vmin 4.5vmin 2vmin 2vmin; background: #2a1f23; border: 2px solid rgba(255,255,255,.12); overflow: hidden; }
.finger.short { height: 38vmin; }
.cream { position: absolute; left: 2.2vmin; right: 2.2vmin; bottom: 1.6vmin; height: 0; border-radius: 999px; background: linear-gradient(#fff6ee, #f1dccb); box-shadow: 0 0 2vmin rgba(255,240,225,.5); }
.ftxt { display: flex; flex-direction: column; gap: 1.2vmin; max-width: 60vmin; }
.ftxt .big, .ftxt .lbl { opacity: 0; } .ftxt .lbl { font-size: 2.8vmin; }
.clockwrap { display: flex; align-items: center; gap: 7vmin; height: 100%; }
.clock { position: relative; width: 36vmin; height: 36vmin; border-radius: 50%; background: #111113; border: 2px solid rgba(255,255,255,.12); flex: 0 0 auto; }
.hh { position: absolute; left: 50%; top: 50%; width: 1.2vmin; height: 14vmin; margin-left: -.6vmin; margin-top: -14vmin; border-radius: 999px; background: #f4c9d6; transform-origin: 50% 100%; }
.dot { position: absolute; left: 50%; top: 50%; width: 2.4vmin; height: 2.4vmin; margin: -1.2vmin 0 0 -1.2vmin; border-radius: 50%; background: #f4c9d6; }
.mark { position: absolute; left: 50%; top: 1.8vmin; width: .6vmin; height: 2.4vmin; margin-left: -.3vmin; background: #4a4a4e; transform-origin: 50% 16.2vmin; border-radius: 999px; }
.sunnote { display: flex; flex-direction: column; gap: 2vmin; max-width: 62vmin; }
.sunnote .chip { opacity: 0; align-self: flex-start; background: #e2b08c; border-color: #e2b08c; color: #111; }
.sunnote .lbl { opacity: 0; font-size: 2.8vmin; }
.week { display: flex; flex-direction: column; justify-content: center; gap: 3vmin; height: 100%; }
.days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1.6vmin; max-width: 110vmin; }
.day { position: relative; aspect-ratio: 1; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.1); display: grid; place-items: end start; padding: 1.4vmin; opacity: 0; font-size: 2.2vmin; color: #a1a1a6; }
.day .ok { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; } .day .ok svg { width: 50%; height: 50%; }
.day .cloud { position: absolute; top: 1vmin; right: 1.2vmin; width: 3.4vmin; height: 3.4vmin; }
.week .lbl { opacity: 0; font-size: 2.8vmin; }
@media (orientation: portrait) {
  .fingers { flex-direction: column; align-items: flex-start; justify-content: center; gap: 4vmin; } .finger { height: 32vmin; } .finger.short { height: 27vmin; } .ftxt { max-width: 100%; }
  .clockwrap { flex-direction: column; align-items: flex-start; justify-content: center; gap: 4vmin; } .clock { width: 30vmin; height: 30vmin; } .mark { transform-origin: 50% 13.2vmin; } .hh { height: 11vmin; margin-top: -11vmin; }
  .days { gap: 1vmin; } .day { font-size: 1.8vmin; padding: .8vmin; }
}`,
    html: `
<section class="shot"><div class="fingers"><div class="hand"><div class="finger"><div class="cream" id="c1"></div></div><div class="finger short"><div class="cream" id="c2"></div></div></div>
  <div class="ftxt"><p class="big" id="f-big">Two finger lengths.</p><p class="lbl" id="f-lbl">A line of sunscreen down two fingers covers the face and neck. Less than that is less than the SPF on the label.</p></div></div></section>
<section class="shot"><div class="clockwrap"><div class="clock" id="clock"><div class="hh" id="hh"></div><div class="dot"></div></div>
  <div class="sunnote"><span class="chip" id="re">Reapply</span><p class="lbl" id="re-lbl">Every two hours outdoors, sooner after sweat or water. Indoors by a window, UVA still comes through.</p></div></div></section>
<section class="shot"><div class="week"><div class="days" id="days">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, k) => `<div class="day"><span>${d}</span>${k === 2 || k === 5 ? `<span class="cloud">${CLOUD}</span>` : ""}<span class="ok">${CHECK}</span></div>`).join("")}</div><p class="lbl" id="d-lbl">Cloudy days too: most UV gets through cloud.</p></div></section>`,
    setup: (M) => {
      M.$("#clock").insertAdjacentHTML("beforeend", Array.from({ length: 12 }, (_, k) => `<div class="mark" style="transform: rotate(${k * 30}deg)"></div>`).join(""));
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, tw, seg, E, set } = M;
      if (i === 0) {
        $("#c1").style.height = (86 * E.inout(seg(lt, 0.4, 2.6))) + "%";
        $("#c2").style.height = (84 * E.inout(seg(lt, 2.0, 4.2))) + "%";
        enter($("#f-big"), lt, 4.4, { y: 14 }); enter($("#f-lbl"), lt, 5.0, { y: 14 });
      } else if (i === 1) {
        set($("#hh"), { r: tw(lt, 0.3, 4.3, 0, 60, E.inout) });
        enter($("#re"), lt, 4.4, { y: 0, s: 0.5, d: 0.5 }); enter($("#re-lbl"), lt, 5.2, { y: 14 });
      } else {
        $$(".day").forEach((d, k) => { enter(d, lt, 0.2 + k * 0.22, { y: 20 }); enter($(".ok", d), lt, 1.8 + k * 0.42, { y: 0, s: 0.3, d: 0.45 }); });
        enter($("#d-lbl"), lt, 5.4, { y: 12 });
      }
    }
  },

  /* ───────── 5-2 Retinoids: low and slow ───────── */
  "5-2": {
    id: "5-2", kicker: "An eight-week ramp", title: `Retinoids: <span class="grad">low and slow.</span>`, dur: 24, poster: 15,
    shots: [
      { at: 0, name: "pea", cap: "A pea-sized amount for the whole face. More only means more irritation." },
      { at: 4, name: "ramp", cap: "Two nights a week, then three, then more as your skin allows. Eight weeks to build up." },
      { at: 18, name: "buffer", cap: "Buffer with moisturizer. A new sting or flaking means slow down, not push through." }
    ],
    css: `
.pea { display: flex; align-items: center; gap: 6vmin; height: 100%; }
.peadot { width: 5vmin; height: 5vmin; border-radius: 50%; background: #f4c9d6; box-shadow: 0 0 4vmin rgba(244,201,214,.5); opacity: 0; flex: 0 0 auto; }
.peat { max-width: 76vmin; } .peat .big, .peat .lbl { opacity: 0; } .peat .lbl { font-size: 2.8vmin; margin-top: 1vmin; }
.cal { display: flex; align-items: center; gap: 7vmin; height: 100%; }
.weeks { display: grid; grid-template-columns: 9vmin repeat(7, 5.4vmin); gap: 1vmin 1.2vmin; align-items: center; }
.wl { font-size: 2vmin; color: #6e6e73; font-weight: 600; }
.night { width: 5.4vmin; height: 5.4vmin; border-radius: 1.2vmin; background: #1a1618; border: 1px solid rgba(255,255,255,.08); position: relative; }
.night i { position: absolute; inset: 24%; border-radius: 50%; background: #f4c9d6; opacity: 0; }
.counter { display: flex; flex-direction: column; gap: .6vmin; }
.counter b { font-size: 9vmin; font-weight: 700; letter-spacing: -.03em; line-height: 1; } .counter span { font-size: 2.8vmin; color: #a1a1a6; }
.buffer { display: flex; flex-direction: column; justify-content: center; gap: 1.2vmin; height: 100%; max-width: 90vmin; }
.layerb { border-radius: 1.8vmin; padding: 2.2vmin 2.6vmin; font-size: 2.8vmin; font-weight: 600; opacity: 0; }
.moist { background: #2a2326; } .ret { background: linear-gradient(90deg, #f7d3de, #e2b08c); color: #111; padding: 1.4vmin 2.6vmin; }
.buffer .lbl { opacity: 0; margin-top: 2vmin; font-size: 2.8vmin; }
@media (orientation: portrait) { .pea { flex-direction: column; align-items: flex-start; justify-content: center; } .cal { flex-direction: column; justify-content: center; align-items: flex-start; gap: 4vmin; } .weeks { grid-template-columns: 9vmin repeat(7, 6vmin); } .night { width: 6vmin; height: 6vmin; } }`,
    html: `
<section class="shot"><div class="pea"><div class="peadot" id="pea"></div><div class="peat"><p class="big" id="p-big">A pea for the whole face.</p><p class="lbl" id="p-lbl">Dot it on the forehead, cheeks and chin, then spread. Skip the corners of the nose and mouth at first.</p></div></div></section>
<section class="shot"><div class="cal"><div class="weeks" id="weeks"></div><div class="counter"><b id="nn">2</b><span id="nl">nights a week · week 1</span></div></div></section>
<section class="shot"><div class="buffer"><div class="layerb moist" id="b1">Moisturizer</div><div class="layerb ret" id="b2">Retinoid, a pea</div><div class="layerb moist" id="b3">Moisturizer</div><p class="lbl" id="b-lbl">The sandwich slows how fast it goes in. Same result, less sting.</p></div></section>`,
    setup: (M) => {
      M.$("#weeks").innerHTML = Array.from({ length: 8 }, (_, w) => `<span class="wl">Week ${w + 1}</span>` + Array.from({ length: 7 }, () => `<div class="night"><i></i></div>`).join("")).join("");
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter } = M;
      const WEEKS = [2, 2, 3, 3, 4, 4, 5, 6], NIGHTS = { 2: [1, 4], 3: [0, 3, 5], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 4, 5, 6] };
      if (i === 0) {
        enter($("#pea"), lt, 0.3, { y: 0, s: 0.2, d: 0.6 }); enter($("#p-big"), lt, 0.9, { y: 14 }); enter($("#p-lbl"), lt, 1.6, { y: 14 });
      } else if (i === 1) {
        const dots = $$(".night i");
        WEEKS.forEach((n, w) => { const t0 = 0.6 + w * 1.45; NIGHTS[n].forEach((j, q) => enter(dots[w * 7 + j], lt, t0 + q * 0.14, { y: 0, s: 0.3, d: 0.35 })); });
        const w = Math.max(0, Math.min(7, Math.floor((lt - 0.6) / 1.45)));
        $("#nn").textContent = WEEKS[w]; $("#nl").textContent = "nights a week · week " + (w + 1);
      } else {
        enter($("#b1"), lt, 0.3, { y: -30 }); enter($("#b2"), lt, 0.9, { y: -30 }); enter($("#b3"), lt, 1.5, { y: -30 }); enter($("#b-lbl"), lt, 3.0, { y: 12 });
      }
    }
  },

  /* ───────── 6-1 The order of things ───────── */
  "6-1": {
    id: "6-1", kicker: "Thin to thick, SPF last", title: `The order of things, <span class="grad">morning and night.</span>`, dur: 22, poster: 8,
    shots: [
      { at: 0, name: "morning", cap: "Morning: thin to thick. Cleanser, toner, vitamin C, moisturizer, then sunscreen, last, always." },
      { at: 10, name: "night", cap: "Night: cleanse, treat, moisturize. The active goes on clean, dry skin. No SPF at night." }
    ],
    css: `
.row6 { position: relative; display: flex; align-items: flex-end; gap: 2vmin; height: 100%; padding-bottom: 5vmin; }
.tile { position: relative; flex: 1; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); display: flex; flex-direction: column; justify-content: flex-end; padding: 1.8vmin; opacity: 0; min-width: 0; }
.tile b { font-size: 2.7vmin; font-weight: 650; line-height: 1.15; } .tile span { font-size: 2.1vmin; color: #8e8e93; margin-top: .6vmin; }
.tile .n { position: absolute; top: 1.4vmin; left: 1.8vmin; font-size: 2vmin; color: #f4c9d6; font-weight: 700; }
.badge { position: absolute; top: -2.2vmin; right: -1vmin; padding: .8vmin 1.6vmin; border-radius: 999px; background: #e2b08c; color: #111; font-size: 2vmin; font-weight: 700; opacity: 0; white-space: nowrap; }
.tag6 { position: absolute; left: 1.8vmin; right: 1.8vmin; top: 5vmin; font-size: 2.2vmin; color: #f4c9d6; opacity: 0; line-height: 1.25; }
.arrowline { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; font-size: 2.2vmin; color: #a1a1a6; opacity: 0; }
.ghost { flex: 0 0 18%; }
@media (orientation: portrait) { .row6 { flex-direction: column; align-items: stretch; padding-bottom: 0; } .tile { flex: 1; justify-content: center; padding-left: 7vmin; } .tile .n { top: 50%; margin-top: -1.3vmin; } .tag6 { position: static; margin-top: .6vmin; } .arrowline { display: none; } .ghost { flex: 0 0 12%; } }`,
    html: `
<section class="shot"><div class="row6" id="am">
  <div class="tile"><span class="n">1</span><b>Cleanser</b><span>water-light</span></div>
  <div class="tile"><span class="n">2</span><b>Toner</b><span>if you use one</span></div>
  <div class="tile"><span class="n">3</span><b>Vitamin C</b><span>serum</span><em class="tag6" id="t-c">antioxidant: on clean skin, under everything</em></div>
  <div class="tile"><span class="n">4</span><b>Moisturizer</b><span>cream</span><em class="tag6" id="t-m">seals the water in</em></div>
  <div class="tile"><span class="n">5</span><b>Sunscreen</b><span>SPF 30 or more</span><em class="badge" id="bd-spf">last, always</em></div>
  <div class="arrowline" id="arrow"><span>thin</span><span>→ thick</span></div>
</div></section>
<section class="shot"><div class="row6" id="pm">
  <div class="tile"><span class="n">1</span><b>Cleanser</b><span>twice if you wore makeup or SPF</span><em class="tag6" id="t-dc">double cleanse: oil or balm first, then your cleanser</em></div>
  <div class="tile"><span class="n">2</span><b>Retinoid or acid</b><span>not both tonight</span><em class="tag6" id="t-act">on clean, dry skin · 2 to 3 nights a week to start</em><em class="badge" id="bd-act">one active a night</em></div>
  <div class="tile"><span class="n">3</span><b>Moisturizer</b><span>every night</span><em class="tag6" id="t-pm">buffer around the active if it stings</em></div>
  <div class="tile ghost" id="ghost"><b>Sunscreen</b><span>not at night</span></div>
</div></section>`,
    setup: (M) => {
      const portrait = window.innerHeight > window.innerWidth;
      M.$$("#am .tile").forEach((t, k) => { if (portrait) t.style.width = (48 + 13 * k) + "%"; else t.style.height = (42 + 12 * k) + "%"; });
      M.$$("#pm .tile").forEach((t, k) => { if (portrait) t.style.width = (56 + 16 * k) + "%"; else t.style.height = (54 + 16 * k) + "%"; });
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, tw, seg, E, set } = M;
      const portrait = window.innerHeight > window.innerWidth, PERM = [2, 0, 4, 1, 3];
      if (i === 0) {
        const tiles = $$("#am .tile"), step = portrait ? tiles[0].offsetHeight + 2 * 7.2 : tiles[0].offsetWidth + 2 * 7.2;
        tiles.forEach((tile, k) => {
          const off = (PERM[k] - k) * step, p = E.inout(seg(lt, 0.5 + k * 0.08, 1.9 + k * 0.08)), o = Math.min(1, seg(lt, 0.1, 0.5) * 1.5);
          set(tile, portrait ? { y: off * (1 - p), o } : { x: off * (1 - p), o });
        });
        enter($("#arrow"), lt, 2.6, { y: 8 });
        enter($("#bd-spf"), lt, 3.6, { y: 0, s: 0.5, d: 0.5 });
        enter($("#t-c"), lt, 4.8, { y: 8 }); enter($("#t-m"), lt, 5.6, { y: 8 });
        $$("#am .n").forEach((n, k) => set(n, { s: 1 + 0.6 * Math.sin(seg(lt, 6.8 + k * 0.45, 7.6 + k * 0.45) * Math.PI), o: 1 }));
      } else {
        $$("#pm .tile:not(.ghost)").forEach((tile, k) => enter(tile, lt, 0.2 + k * 0.25, { y: 30 }));
        const g = $("#ghost"), gp = E.in(seg(lt, 0.4, 1.2));
        set(g, portrait ? { x: 40 * 7.2 * gp, o: 0.7 * (1 - gp) } : { y: 40 * 7.2 * gp, o: 0.7 * (1 - gp) });
        enter($("#t-dc"), lt, 2.4, { y: 8 }); enter($("#t-act"), lt, 3.4, { y: 8 }); enter($("#t-pm"), lt, 4.2, { y: 8 });
        enter($("#bd-act"), lt, 5.4, { y: 0, s: 0.5, d: 0.5 });
      }
    }
  },

  /* ───────── 6-2 Not on the same night ───────── */
  "6-2": {
    id: "6-2", kicker: "What generally isn't combined", title: `Not on the <span class="grad">same night.</span>`, dur: 24, poster: 2.6,
    shots: [
      { at: 0, name: "retinoid-acid", cap: "A retinoid and an acid: alternate nights instead." },
      { at: 4, name: "two-exfoliants", cap: "Two exfoliants, two acids, an acid plus a scrub: pick one." },
      { at: 8, name: "bp-retinol", cap: "Benzoyl peroxide and retinol can cancel each other and irritate. Morning and night." },
      { at: 12, name: "vitc-acid", cap: "Pure vitamin C and an acid or retinoid in one step: vitamin C in the morning, actives at night." },
      { at: 16, name: "niacinamide-vitc", cap: "Niacinamide and vitamin C are fine together. That caution is outdated." },
      { at: 20, name: "fresh-skin", cap: "Any active on freshly treated skin: wait the days the aftercare says." }
    ],
    css: `
.pairwrap { display: flex; flex-direction: column; justify-content: center; gap: 2.4vmin; height: 100%; }
.pairrow { position: relative; display: flex; justify-content: center; align-items: center; gap: 3vmin; height: 18vmin; }
.pa, .pb { min-width: 30vmin; text-align: center; font-size: 3vmin; font-weight: 700; padding: 3vmin 3.2vmin; opacity: 0; }
.mark { position: absolute; left: 50%; top: 50%; width: 8vmin; height: 8vmin; margin: -4vmin 0 0 -4vmin; opacity: 0; border-radius: 50%; background: #000; padding: 1.2vmin; }
.mark svg { width: 100%; height: 100%; }
.mark.up { top: 0; margin-top: -3vmin; }
.slots { display: flex; justify-content: center; gap: 3vmin; }
.slot { width: 30vmin; min-height: 9vmin; border-radius: 2.4vmin; border: 2px dashed rgba(255,255,255,.22); display: flex; align-items: center; justify-content: center; gap: 1.4vmin; font-size: 2.6vmin; color: #a1a1a6; opacity: 0; padding: 1vmin; }
.slot svg { width: 3.6vmin; height: 3.6vmin; }
.pick { position: absolute; left: 50%; top: 100%; margin: -1vmin 0 0 -16vmin; width: 32vmin; justify-content: center; opacity: 0; }
.wait { display: flex; justify-content: center; gap: 1.4vmin; }
.wd { width: 10vmin; height: 10vmin; border-radius: 1.8vmin; background: #111113; border: 1px solid rgba(255,255,255,.1); display: grid; place-items: center; font-size: 2.2vmin; color: #6e6e73; opacity: 0; }
@media (orientation: portrait) { .pa, .pb { min-width: 26vmin; font-size: 2.7vmin; padding: 2.6vmin 2vmin; } .slot { width: 26vmin; } .wd { width: 8.6vmin; height: 8.6vmin; } }`,
    html: `
<section class="shot" data-mode="alt"><div class="pairwrap"><div class="pairrow"><div class="pa card">Retinoid</div><div class="mark">${CROSS}</div><div class="pb card">Acid (AHA / BHA)</div></div><div class="slots"><div class="slot">Monday night</div><div class="slot">Tuesday night</div></div></div></section>
<section class="shot" data-mode="one"><div class="pairwrap"><div class="pairrow"><div class="pa card">Glycolic acid</div><div class="mark">${CROSS}</div><div class="pb card">Scrub</div><div class="pick chip">pick one</div></div></div></section>
<section class="shot" data-mode="ampm"><div class="pairwrap"><div class="pairrow"><div class="pa card">Benzoyl peroxide</div><div class="mark">${CROSS}</div><div class="pb card">Retinol</div></div><div class="slots"><div class="slot">${SUN} morning</div><div class="slot">${MOON} night</div></div></div></section>
<section class="shot" data-mode="ampm"><div class="pairwrap"><div class="pairrow"><div class="pa card">Vitamin C</div><div class="mark">${CROSS}</div><div class="pb card">Acid or retinoid</div></div><div class="slots"><div class="slot">${SUN} morning</div><div class="slot">${MOON} night</div></div></div></section>
<section class="shot" data-mode="ok"><div class="pairwrap"><div class="pairrow"><div class="pa card">Niacinamide</div><div class="mark up">${CHECK}</div><div class="pb card">Vitamin C</div></div></div></section>
<section class="shot" data-mode="wait"><div class="pairwrap"><div class="pairrow"><div class="pa card">Any active</div><div class="mark">${CROSS}</div><div class="pb card">Freshly treated skin</div></div><div class="wait"><div class="wd">day 1</div><div class="wd">day 2</div><div class="wd">day 3</div><div class="wd">day 4</div><div class="wd">day 5</div></div></div></section>`,
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, tw, seg, E, set } = M;
      const sec = $$(".shot")[i], mode = sec.dataset.mode, vm = Math.min(window.innerWidth, window.innerHeight) / 100;
      const a = $(".pa", sec), b = $(".pb", sec), mk = $(".mark", sec);
      const inP = E.in(seg(lt, 0.1, 0.8)), bump = Math.sin(seg(lt, 0.8, 1.2) * Math.PI * 3) * 1.4 * vm * (1 - seg(lt, 0.8, 1.2));
      let ax = -50 * vm * (1 - inP) - bump, bx = 50 * vm * (1 - inP) + bump, bo = Math.min(1, inP * 3), bs = 1;
      if (mode === "ok") { const n = E.out(seg(lt, 1.0, 1.6)); ax += 1.2 * vm * n; bx -= 1.2 * vm * n; set(mk, { s: tw(lt, 1.0, 1.4, 0.3, 1, E.back), o: Math.min(1, seg(lt, 1.0, 1.2) * 2) }); }
      else { set(mk, { s: tw(lt, 0.8, 1.1, 0.3, 1, E.back), o: Math.min(1, seg(lt, 0.8, 0.95) * 2) * (mode === "one" ? 1 - seg(lt, 1.7, 2.0) : 1) }); }
      if (mode === "one") { const d = seg(lt, 1.9, 2.4); bo = Math.min(bo, 1 - 0.72 * d); bs = 1 - 0.1 * d; enter($(".pick", sec), lt, 2.0, { y: 0, s: 0.5, d: 0.5 }); }
      set(a, { x: ax, o: Math.min(1, inP * 3) }); set(b, { x: bx, o: bo, s: bs });
      if (mode === "alt" || mode === "ampm") $$(".slot", sec).forEach((s, k) => enter(s, lt, 1.8 + k * 0.2, { y: 12 }));
      if (mode === "wait") $$(".wd", sec).forEach((d, k) => enter(d, lt, 1.8 + k * 0.18, { y: 10 }));
    }
  },

  /* ───────── 6-3 Purging vs. a breakout ───────── */
  "6-3": {
    id: "6-3", kicker: "One means keep going, the other means stop", title: `Purging <span class="grad">vs. a breakout.</span>`, dur: 20, poster: 7.5,
    shots: [
      { at: 0, name: "faces", cap: "Purging: your usual spots, two to six weeks after a new active, then gone. A breakout: new places, itchy or stinging, and it keeps going." },
      { at: 9, name: "verdict", cap: "Purging means keep going. A reaction means stop the product." },
      { at: 13.5, name: "ask", cap: "Not sure which? A photo in daylight, no filter, and Evelyn can tell you." }
    ],
    css: `
.faces { display: grid; grid-template-columns: 1fr 1fr; gap: 4vmin; height: 100%; align-items: center; }
.panel { display: flex; flex-direction: column; gap: 1.4vmin; align-items: center; }
.panel h3 { font-size: 3vmin; font-weight: 700; opacity: 0; }
.face { position: relative; width: 32vmin; height: 40vmin; opacity: 0; }
.face svg { width: 100%; height: 100%; }
.spot { position: absolute; width: 2.4vmin; height: 2.4vmin; margin: -1.2vmin 0 0 -1.2vmin; border-radius: 50%; background: #f4c9d6; opacity: 0; }
.breakout .spot { background: #ff7a6b; }
.panel .lbl { opacity: 0; text-align: center; font-size: 2.4vmin; max-width: 44vmin; }
.verdict { display: grid; grid-template-columns: 1fr 1fr; gap: 4vmin; height: 100%; align-content: center; }
.verdict .card { text-align: center; opacity: 0; padding: 4vmin 3vmin; }
.verdict b { display: block; font-size: 4vmin; } .verdict p { margin-top: 1vmin; color: #a1a1a6; font-size: 2.5vmin; min-height: 7vmin; }
.vbar { position: relative; height: 1.4vmin; border-radius: 999px; background: #2a2a2d; margin-top: 2.4vmin; } .vbar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: #32d74b; } .vbar span { position: absolute; right: 0; top: 2vmin; font-size: 2vmin; color: #6e6e73; }
.msg { display: flex; flex-direction: column; justify-content: center; gap: 2vmin; height: 100%; }
.bubble { align-self: flex-start; background: #1e1a1c; border-radius: 3vmin 3vmin 3vmin .6vmin; padding: 2.4vmin 3vmin; font-size: 3vmin; max-width: 84vmin; opacity: 0; }
.bubble.me { align-self: flex-end; background: #f4c9d6; color: #111; border-radius: 3vmin 3vmin .6vmin 3vmin; }
.photo { align-self: flex-end; width: 16vmin; height: 11vmin; border-radius: 1.6vmin; background: linear-gradient(135deg, #e7c3b0, #c99a86); opacity: 0; }
@media (orientation: portrait) { .faces { grid-template-columns: 1fr 1fr; gap: 2vmin; } .face { width: 24vmin; height: 30vmin; } .panel h3 { font-size: 2.6vmin; } .verdict { grid-template-columns: 1fr; } }`,
    html: `
<section class="shot"><div class="faces">
  <div class="panel purging"><h3>Purging</h3><div class="face">${FACE}</div><p class="lbl">same spots as always · fades by week six</p></div>
  <div class="panel breakout"><h3>A breakout</h3><div class="face">${FACE}</div><p class="lbl">new places · itchy, stinging · keeps going</p></div>
</div></section>
<section class="shot"><div class="verdict"><div class="card"><b style="color:#32d74b">Keep going</b><p>Purging passes. Don't add anything new while it does.</p><div class="vbar"><i id="vfill"></i><span id="vwk">week 2</span></div></div><div class="card"><b style="color:#ff7a6b">Stop the product</b><p id="vstop"></p></div></div></section>
<section class="shot"><div class="msg"><div class="bubble me" id="m1">Is this purging or a breakout?</div><div class="photo" id="m2"></div><div class="bubble" id="m3">Photo in daylight, no filter. Evelyn tells you which, and what to do next.</div></div></section>`,
    setup: (M) => {
      const P = [[50, 30], [44, 42], [56, 42], [50, 56], [50, 84], [41, 84]], B = [[26, 60], [76, 62], [32, 80], [70, 82], [22, 46]];
      M.$(".purging .face").insertAdjacentHTML("beforeend", P.map(([x, y]) => `<i class="spot" style="left:${x}%;top:${y}%"></i>`).join(""));
      M.$(".breakout .face").insertAdjacentHTML("beforeend", B.map(([x, y]) => `<i class="spot" style="left:${x}%;top:${y}%"></i>`).join(""));
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set, type } = M;
      if (i === 0) {
        enter($(".purging h3"), lt, 0.2, { y: 10 }); enter($(".breakout h3"), lt, 0.4, { y: 10 });
        enter($(".purging .face"), lt, 0.5, { y: 20 }); enter($(".breakout .face"), lt, 0.7, { y: 20 });
        $$(".purging .spot").forEach((s, k) => { const p = enter(s, lt, 1.2 + k * 0.25, { y: 0, s: 0.3, d: 0.4 }); if (p >= 1) set(s, { o: 1 - E.inout(seg(lt, 5 + k * 0.3, 8.5)) }); });
        $$(".breakout .spot").forEach((s, k) => { const p = enter(s, lt, 1.6 + k * 0.5, { y: 0, s: 0.3, d: 0.4 }); if (p >= 1) set(s, { s: 1 + 0.9 * E.out(seg(lt, 3 + k * 0.5, 8.5)), o: 1 }); });
        enter($(".purging .lbl"), lt, 6.0, { y: 10 }); enter($(".breakout .lbl"), lt, 6.4, { y: 10 });
      } else if (i === 1) {
        $$(".verdict .card").forEach((c, k) => enter(c, lt, 0.3 + k * 0.5, { y: 24 }));
        const vp = E.inout(seg(lt, 1.4, 3.8)); $("#vfill").style.width = (100 * vp) + "%"; $("#vwk").textContent = "week " + Math.round(2 + 4 * vp);
        type($("#vstop"), "A reaction gets worse the longer you push.", lt, 1.6, 34);
      } else {
        enter($("#m1"), lt, 0.3, { y: 16 }); enter($("#m2"), lt, 1.3, { y: 16 }); enter($("#m3"), lt, 2.6, { y: 16 });
      }
    }
  },

  /* ───────── 8-3 Acne clears on a calendar ───────── */
  "8-3": {
    id: "8-3", kicker: "Give it 90 days", title: `Acne clears on a <span class="grad">calendar, not a weekend.</span>`, dur: 22, poster: 15.5,
    shots: [
      { at: 0, name: "evelyn-says", cap: "In her own words, from her Skin Playbook." },
      { at: 5, name: "timeline", cap: "Purging is common in weeks two to six. Real results start around day 90. Mostly clear by three to six months, with consistency." },
      { at: 16.5, name: "three", cap: "A visit every two to four weeks, home care that decides it, and a doctor too when it's cystic or scarring." }
    ],
    css: `
.quote { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 2vmin; max-width: 120vmin; }
.k2 { font-size: 2.6vmin; color: #e3b48f; font-weight: 600; opacity: 0; }
.quote p { font-size: 4.6vmin; font-weight: 600; line-height: 1.25; letter-spacing: -.02em; min-height: 14vmin; }
.who { font-size: 2.4vmin; color: #6e6e73; opacity: 0; }
.tl { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 2vmin; }
.track { position: relative; height: 1.6vmin; border-radius: 999px; background: #2a2a2d; margin: 10vmin 3vmin 11vmin; }
.fillb { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f7d3de, #e2b08c); }
.mk { position: absolute; top: 50%; width: 3.6vmin; height: 3.6vmin; margin: -1.8vmin 0 0 -1.8vmin; border-radius: 50%; background: #000; border: .5vmin solid #4a4a4e; }
.lab { position: absolute; left: 50%; transform: translateX(-50%); text-align: center; white-space: nowrap; }
.mk.up .lab { bottom: 4.4vmin; } .mk.dn .lab { top: 4.4vmin; }
.mk.first .lab { left: -1.8vmin; transform: none; text-align: left; } .mk.last .lab { left: auto; right: -1.8vmin; transform: none; text-align: right; }
.lab b { display: block; font-size: 2.7vmin; color: #6e6e73; } .lab span { display: block; font-size: 2.1vmin; color: #6e6e73; margin-top: .3vmin; }
.mk.lit { border-color: #eab9c8; } .mk.lit .lab b { color: #f5f5f7; } .mk.lit .lab span { color: #a1a1a6; }
.daycount { display: flex; align-items: baseline; gap: 1.4vmin; } .daycount b { font-size: 7vmin; font-weight: 700; letter-spacing: -.03em; } .daycount span { font-size: 2.8vmin; color: #a1a1a6; }
.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4vmin; height: 100%; align-content: center; }
.three .card { opacity: 0; } .three b { font-size: 2.9vmin; display: block; } .three p { margin-top: .8vmin; color: #a1a1a6; font-size: 2.4vmin; line-height: 1.4; }
@media (orientation: portrait) { .three { grid-template-columns: 1fr; } .lab b { font-size: 2.3vmin; } .lab span { font-size: 1.9vmin; } .quote p { font-size: 4.2vmin; } }`,
    html: `
<section class="shot"><div class="quote"><p class="k2" id="es">Evelyn says</p><p id="q"></p><p class="who" id="who">Evelyn Romero, from her Skin Playbook</p></div></section>
<section class="shot"><div class="tl"><div class="daycount"><b id="dc">0</b><span>days in</span></div><div class="track"><div class="fillb" id="fillb"></div>
  <div class="mk up first" style="left:0%"><div class="lab"><b>Week 0</b><span>consultation, start the routine</span></div></div>
  <div class="mk dn" style="left:24%"><div class="lab"><b>Weeks 2 to 6</b><span>purging is common</span></div></div>
  <div class="mk up" style="left:56%"><div class="lab"><b>Day 90</b><span>real results start</span></div></div>
  <div class="mk dn last" style="left:94%"><div class="lab"><b>3 to 6 months</b><span>mostly clear</span></div></div>
</div></div></section>
<section class="shot"><div class="three"><div class="card"><b>A visit every 2 to 4 weeks</b><p>Exfoliation, extractions, calming steps, LED.</p></div><div class="card"><b>Home care decides it</b><p>Consistency beats intensity. Pillowcases, phone, hair products, hands off.</p></div><div class="card"><b style="color:#ff7a6b">A doctor too, when</b><p>Cystic, scarring, painful, hormonal, or unmoved after months.</p></div></div></section>`,
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set, type } = M;
      if (i === 0) {
        enter($("#es"), lt, 0.2, { y: 8 });
        const done = type($("#q"), "I tell everyone: give it 90 days to start seeing real results. It varies with severity, consistency and home care.", lt, 0.6, 36);
        enter($("#who"), lt, done >= 1 ? 3.9 : 99, { y: 8 });
      } else if (i === 1) {
        const p = E.inout(seg(lt, 0.4, 10.4)), pct = 100 * p;
        $("#fillb").style.width = pct + "%"; $("#dc").textContent = Math.round(180 * p);
        $$(".mk").forEach((m) => { const pos = parseFloat(m.style.left), lit = pct >= pos - 0.01, q = seg(pct, pos, pos + 6); m.classList.toggle("lit", lit); set(m, { s: 1 + 0.35 * Math.sin(q * Math.PI), o: 1 }); });
      } else {
        $$(".three .card").forEach((c, k) => enter(c, lt, 0.3 + k * 0.5, { y: 24 }));
      }
    }
  },

  /* ───────── 3-1 How to read a label: the front is marketing, the back is the truth ───────── */
  "3-1": {
    id: "3-1", kicker: "How to read a label", title: `The front is marketing. <span class="grad">The back is the truth.</span>`, dur: 21, poster: 12,
    shots: [
      { at: 0, name: "front", cap: "\"Clean\", \"natural\", \"hypoallergenic\", \"dermatologist tested\": none of these has a legal definition for cosmetics. Turn the bottle around." },
      { at: 7, name: "order", cap: "Ingredients are listed from most to least, down to 1%. The first five are most of the formula. After the 1% line, any order." },
      { at: 14, name: "star", cap: "If the star ingredient comes after the fragrance, there's very little of it. \"Fragrance\" can hide dozens of ingredients; sensitive skin often does better without." }
    ],
    css: `
.lab { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 4vmin; z-index: 1; }
.bottle { position: relative; width: 48vmin; height: 68vmin; border-radius: 4vmin; background: #16161a; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 3vmin 8vmin rgba(0,0,0,.5); overflow: hidden; }
.bottle .cap { position: absolute; left: 50%; top: -2.6vmin; width: 14vmin; height: 5vmin; margin-left: -7vmin; border-radius: 1.2vmin; background: #2a2a2e; }
.front, .back { position: absolute; inset: 0; padding: 7vmin 4vmin 4vmin; display: flex; flex-direction: column; }
.front { align-items: center; text-align: center; justify-content: center; gap: 1.6vmin; }
.front .name { font-size: 5.6vmin; font-weight: 750; letter-spacing: -.02em; line-height: 1; }
.front .sub { font-size: 2.4vmin; color: #a1a1a6; }
.claims { display: flex; flex-wrap: wrap; justify-content: center; gap: 1vmin; margin-top: 2vmin; }
.claims span { position: relative; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(244,201,214,.14); border: 1px solid rgba(244,201,214,.4); color: #f4c9d6; font-size: 2.5vmin; font-weight: 600; }
.claims span i { position: absolute; left: 1.2vmin; right: 1.2vmin; top: 50%; height: .35vmin; background: #ff7a6b; transform: scaleX(0); transform-origin: left; }
.nolaw { margin-top: 2.4vmin; font-size: 2.3vmin; color: #ff7a6b; font-weight: 600; opacity: 0; }
.back { opacity: 0; }
.back .h { font-size: 2.1vmin; letter-spacing: .12em; text-transform: uppercase; color: #a1a1a6; margin-bottom: 1.4vmin; }
.ing { list-style: none; margin: 0; padding: 0; display: grid; gap: .5vmin; counter-reset: ing; }
.ing li { position: relative; display: flex; align-items: center; gap: 1.2vmin; font-size: 2.7vmin; line-height: 1.2; padding: .6vmin 1vmin; border-radius: 1vmin; background: transparent; }
.ing li::before { counter-increment: ing; content: counter(ing); width: 3vmin; font-size: 1.9vmin; color: #6e6e73; font-variant-numeric: tabular-nums; }
.ing li.five { background: rgba(244,201,214,.12); }
.ing li.frag { background: rgba(255,122,107,.16); }
.ing li.star { background: rgba(226,176,140,.18); }
.ing li .pct { margin-left: auto; font-size: 1.9vmin; color: #a1a1a6; }
.oneline { position: relative; margin: .6vmin 0; height: .3vmin; background: repeating-linear-gradient(90deg, #a1a1a6 0 1.4vmin, transparent 1.4vmin 2.6vmin); opacity: 0; }
.oneline b { position: absolute; right: 0; top: -2.6vmin; font-size: 1.9vmin; color: #a1a1a6; font-weight: 600; }
.side { width: 46vmin; display: grid; gap: 2vmin; align-content: center; }
.pill { padding: 1.8vmin 2.4vmin; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); font-size: 2.9vmin; line-height: 1.3; opacity: 0; }
.pill b { color: #f4c9d6; } .pill.warn b { color: #ff7a6b; } .pill.good b { color: #e2b08c; }
@media (orientation: portrait) { .lab { flex-direction: column; gap: 2.5vmin; } .bottle { width: 64vmin; height: 72vmin; } .side { width: 64vmin; } }`,
    html: `
<div class="lab" id="lab">
  <div class="bottle" id="bottle"><div class="cap"></div>
    <div class="front" id="front"><div class="name">Glow Serum</div><div class="sub">with niacinamide</div>
      <div class="claims"><span>clean<i></i></span><span>natural<i></i></span><span>hypoallergenic<i></i></span><span>dermatologist tested<i></i></span></div>
      <div class="nolaw" id="nolaw">no legal definition</div></div>
    <div class="back" id="back"><div class="h">Ingredients</div>
      <ul class="ing" id="ing">
        <li>Water (Aqua)</li><li>Glycerin</li><li>Caprylic/Capric Triglyceride</li><li>Cetearyl Alcohol</li><li>Butylene Glycol</li>
        <li>Dimethicone</li><li>Phenoxyethanol<span class="pct" id="pct1">about 1%</span></li>
        <li id="frag">Fragrance (Parfum)</li><li id="star">Niacinamide</li><li>Tocopherol</li><li>Citric Acid</li>
      </ul></div>
  </div>
  <div class="side">
    <div class="pill" id="p-five"><b>The first five</b> are most of what's in the bottle.</div>
    <div class="pill" id="p-one"><b>After the 1% line</b>, anything can be in any order.</div>
    <div class="pill warn" id="p-frag"><b>Fragrance</b> is usually under 1%, and can hide dozens of ingredients.</div>
    <div class="pill good" id="p-star"><b>Niacinamide, after it:</b> very little. The name on the front, a trace on the back.</div>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, tw, seg, E, set } = M;
      set($("#lab"), { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      const flipAt = 4.6;                                           // the bottle turns around at the end of shot 0
      const flip = i === 0 ? E.inout(seg(lt, flipAt, flipAt + 1.4)) : 1;
      const sx = Math.abs(Math.cos(flip * Math.PI));
      $("#bottle").style.transform = "scaleX(" + Math.max(0.04, sx) + ")";
      const showBack = flip >= 0.5;
      $("#front").style.opacity = showBack ? 0 : 1; $("#back").style.opacity = showBack ? 1 : 0;
      if (i === 0) {
        $$(".claims span").forEach((c, k) => { enter(c, lt, 0.4 + k * 0.25, { y: 8 }); c.querySelector("i").style.transform = "scaleX(" + E.out(seg(lt, 2.0 + k * 0.18, 2.6 + k * 0.18)) + ")"; });
        enter($("#nolaw"), lt, 3.0, { y: 6 });
      }
      // the list: the first five light up one by one, the 1% line, the rows after it shuffle, then the fragrance and the star
      const rows = $$("#ing li");
      const rowH = rows[1].offsetTop - rows[0].offsetTop;
      rows.forEach((r, k) => {
        r.classList.toggle("five", k < 5 && (i > 1 || (i === 1 && lt > 0.5 + k * 0.3)));
        r.classList.toggle("frag", r.id === "frag" && i === 2 && lt > 0.6);
        r.classList.toggle("star", r.id === "star" && i === 2 && lt > 2.2);
        r.style.opacity = i === 0 ? (showBack ? 1 : 0) : 1;
        let dy = 0;
        if (i === 1 && k >= 7) { const p = E.inout(seg(lt, 4.6, 5.8)), q = E.inout(seg(lt, 5.9, 6.9)); dy = k === 7 ? 3 * rowH * (p - q) : -rowH * (p - q); }   // any order: the last four trade places, then settle
        set(r, { y: dy });
      });
      $("#pct1").style.opacity = i >= 1 ? seg(i === 1 ? lt : 9, 2.4, 3.0) : 0;
      $$(".pill").forEach((p) => { if (!(i === 1 && (p.id === "p-five" || p.id === "p-one")) && !(i === 2 && (p.id === "p-frag" || p.id === "p-star"))) set(p, { o: 0, y: 10 }); });
      if (i === 1) { enter($("#p-five"), lt, 1.4, { y: 10 }); enter($("#p-one"), lt, 3.4, { y: 10 }); }
      if (i === 2) { enter($("#p-frag"), lt, 0.8, { y: 10 }); enter($("#p-star"), lt, 2.6, { y: 10 }); }
    }
  },

  /* ───────── 9-1 Three kinds of dark spots: which one is yours ───────── */
  "9-1": {
    id: "9-1", kicker: "Three kinds of dark spots", title: `Three kinds of dark spots. <span class="grad">They look alike, they aren't.</span>`, dur: 22, poster: 11,
    shots: [
      { at: 0, name: "sun", cap: "Sun spots: years of UV, scattered where the light lands most, the cheeks, the forehead, the backs of the hands." },
      { at: 6, name: "marks", cap: "Post-inflammatory marks: the brown left behind where a pimple or an irritation was. More common, and slower to fade, in deeper skin tones." },
      { at: 12, name: "melasma", cap: "Melasma: patchy and symmetrical, both cheeks, the upper lip. Set off by sun, heat, visible light and hormones. Different plan, same sunscreen." },
      { at: 18, name: "red", cap: "Red marks after acne are something else: blood vessels, not pigment. Those fade on their own." }
    ],
    css: `
.faces { position: absolute; inset: 0; padding-top: 8vmin; display: flex; align-items: flex-start; justify-content: center; gap: 5vmin; }
.face { position: relative; width: 34vmin; height: 44vmin; border-radius: 17vmin 17vmin 14vmin 14vmin / 19vmin 19vmin 15vmin 15vmin; background: #d9b5a0; border: 1px solid rgba(255,255,255,.12); opacity: .35; transition: none; }
.face.on { opacity: 1; }
.face .t { position: absolute; left: 50%; bottom: -5.6vmin; transform: translateX(-50%); white-space: nowrap; font-size: 2.6vmin; font-weight: 650; color: #8e8e93; }
.face.on .t { color: #fff; }
.face i { position: absolute; border-radius: 50%; background: #6b3f2e; opacity: 0; }
.face .lip { position: absolute; left: 50%; bottom: 8vmin; width: 10vmin; height: 1.6vmin; margin-left: -5vmin; border-radius: 1vmin; background: #b9786b; }
.face .nose { position: absolute; left: 50%; top: 15vmin; width: 4vmin; height: 10vmin; margin-left: -2vmin; border-radius: 2vmin; background: rgba(0,0,0,.08); }
.face.red i { background: #d7585a; }
.tag9 { position: absolute; left: 0; right: 0; top: 0; display: flex; gap: 1vmin; justify-content: center; flex-wrap: wrap; }
.tag9 span { padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 2.4vmin; font-weight: 600; color: #d9d9de; opacity: 0; }
.tag9 span.hot { background: rgba(255,122,107,.18); border-color: rgba(255,122,107,.5); color: #ff9a8b; }
@media (orientation: portrait) { .faces { gap: 3vmin; padding-top: 16vmin; } .face { width: 29vmin; height: 38vmin; } .face .t { bottom: -5vmin; font-size: 2.3vmin; } .face .lip { bottom: 7vmin; width: 8vmin; margin-left: -4vmin; } .face .nose { top: 12vmin; width: 3.2vmin; height: 8vmin; margin-left: -1.6vmin; } }`,
    html: `
<div class="faces" id="faces">
  <div class="face" id="f-sun"><div class="nose"></div><div class="lip"></div><span class="t">sun spots</span></div>
  <div class="face" id="f-pih"><div class="nose"></div><div class="lip"></div><span class="t">post-breakout marks</span></div>
  <div class="face" id="f-mel"><div class="nose"></div><div class="lip"></div><span class="t">melasma</span></div>
</div>
<div class="tag9" id="tags"><span id="g-uv">years of UV</span><span id="g-where">cheeks · forehead · hands</span><span id="g-pimple">where a pimple was</span><span id="g-tone">deeper tones: slower to fade</span><span id="g-sym">symmetrical patches</span><span class="hot" id="g-trig">sun · heat · visible light · hormones</span><span id="g-red">red, not brown: blood vessels</span></div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {
      const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
      const dot = (face, x, y, s) => { const i = document.createElement("i"); i.style.left = x + "%"; i.style.top = y + "%"; i.style.width = s + "vmin"; i.style.height = s + "vmin"; face.appendChild(i); return i; };
      // sun: small, scattered high on the face (cheeks and forehead), as if the light landed there
      const sun = M.$("#f-sun"); for (let k = 0; k < 22; k++) dot(sun, 12 + hash(k + 10) * 72, 10 + hash(k + 11) * 50, 0.7 + hash(k + 12) * 0.9);
      // post-inflammatory: a few larger marks where breakouts sit, the jaw and the cheeks
      const pih = M.$("#f-pih"); [[22, 55], [70, 58], [40, 72], [62, 74], [30, 40], [74, 42], [50, 84]].forEach(([x, y], k) => dot(pih, x, y, 1.9 + hash(k + 30) * 0.8));
      // melasma: two mirrored patches on the cheeks and one on the upper lip
      const mel = M.$("#f-mel");
      const patch = (x, y, w, h) => { const i = document.createElement("i"); i.style.left = x + "%"; i.style.top = y + "%"; i.style.width = w + "%"; i.style.height = h + "%"; i.style.borderRadius = "50%"; i.style.filter = "blur(.5vmin)"; mel.appendChild(i); return i; };
      patch(10, 44, 30, 18); patch(60, 44, 30, 18); patch(34, 74, 32, 7);
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      set($("#faces"), { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      const faces = [$("#f-sun"), $("#f-pih"), $("#f-mel")];
      faces.forEach((f, k) => { f.classList.toggle("on", i === k || (i === 3 && k === 1)); f.classList.toggle("red", i === 3 && k === 1); });
      // the spots come in as their face is named; in the last shot the breakout face's marks turn red (vessels, not pigment)
      faces.forEach((f, k) => {
        const dots = f.querySelectorAll("i");
        const active = i === k || (i === 3 && k === 1);
        dots.forEach((d, n) => { const p = active ? E.out(seg(i === 3 ? 9 : lt, 0.6 + n * 0.12, 1.4 + n * 0.12)) : (i > k ? 1 : 0); d.style.opacity = (k === 2 ? 0.85 : 1) * (i === 3 && k !== 1 ? 0.35 : 1) * (active && i !== 3 ? p : (i > k || i === 3 ? 1 : 0)); d.style.transform = "scale(" + (active && i !== 3 ? 0.6 + 0.4 * p : 1) + ")"; });
      });
      // the chips
      const show = (id, from, at) => { const el = $("#" + id); if (i === from) enter(el, lt, at, { y: 10 }); else set(el, { o: 0, y: 10 }); };
      show("g-uv", 0, 1.6); show("g-where", 0, 3.0);
      show("g-pimple", 1, 1.6); show("g-tone", 1, 3.2);
      show("g-sym", 2, 1.6); show("g-trig", 2, 3.2);
      show("g-red", 3, 0.8);
    }
  },

  /* ───────── 10-2 An anti-aging routine that works: the short list, and why gentle every night wins ───────── */
  "10-2": {
    id: "10-2", kicker: "An anti-aging routine that works", title: `The short list, <span class="grad">every day.</span>`, dur: 22, poster: 15,
    shots: [
      { at: 0, name: "am", cap: "Morning: vitamin C, moisturizer, sunscreen. Three things, every day, and the sunscreen does most of the work." },
      { at: 6, name: "pm", cap: "Night: a retinoid built up slowly, peptides, a rich moisturizer. Neck, chest and hands too: they show age early." },
      { at: 12, name: "race", cap: "Consistency beats strength. A gentle retinoid every night covers more ground in two months than a strong one once a week, with none of the peeling." }
    ],
    css: `
.r10 { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 2.4vmin; }
.row10 { display: flex; gap: 1.6vmin; align-items: stretch; }
.tile10 { flex: 1; min-height: 23vmin; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 2.8vmin; opacity: 0; display: flex; flex-direction: column; justify-content: flex-end; }
.tile10 .n { font-size: 2.2vmin; color: #f4c9d6; font-weight: 700; } .tile10 b { display: block; font-size: 3.8vmin; font-weight: 650; margin-top: .4vmin; line-height: 1.1; letter-spacing: -.01em; } .tile10 span { display: block; font-size: 2.4vmin; color: #8e8e93; margin-top: .8vmin; }
.pm .tile10 .n { color: #e2b08c; }
.badge10 { position: absolute; top: -1.6vmin; right: 1.4vmin; padding: .7vmin 1.4vmin; border-radius: 999px; background: #e2b08c; color: #1a1210; font-size: 1.9vmin; font-weight: 700; white-space: nowrap; opacity: 0; }
.tile10 { position: relative; }
.lane { display: grid; grid-template-columns: 30vmin 1fr; align-items: center; gap: 2vmin; opacity: 0; }
.lane .who { font-size: 2.6vmin; font-weight: 650; line-height: 1.2; } .lane .who i { display: block; font-style: normal; font-size: 2.1vmin; color: #8e8e93; font-weight: 500; }
.lane .bar { position: relative; height: 6vmin; border-radius: 999px; background: rgba(255,255,255,.07); overflow: hidden; }
.lane .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f4c9d6, #e2b08c); }
.lane.strong .fill { background: #6e6e73; }
.lane .tick { position: absolute; top: 50%; width: 1vmin; height: 1vmin; margin: -.5vmin 0 0 -.5vmin; border-radius: 50%; background: #fff; opacity: 0; }
.lane .flare { position: absolute; right: 2vmin; top: 50%; transform: translateY(-50%); font-size: 2.1vmin; color: #ff7a6b; font-weight: 600; opacity: 0; }
.weeks { display: flex; justify-content: space-between; font-size: 2vmin; color: #6e6e73; padding: 0 0 0 32vmin; opacity: 0; }
.verdict { align-self: flex-start; padding: 1.2vmin 2vmin; border-radius: 999px; background: #f4c9d6; color: #1a1210; font-size: 2.4vmin; font-weight: 700; opacity: 0; }
@media (orientation: portrait) { .row10 { flex-direction: column; } .tile10 { min-height: 12vmin; padding: 2.2vmin 2.6vmin; } .lane { grid-template-columns: 1fr; gap: 1vmin; } .weeks { padding-left: 0; } }`,
    html: `
<div class="r10">
  <div class="row10 am" id="am"><div class="tile10"><span class="n">1</span><b>Vitamin C</b><span>on clean skin</span></div><div class="tile10"><span class="n">2</span><b>Moisturizer</b><span>then the neck and chest</span></div><div class="tile10"><span class="n">3</span><b>Sunscreen</b><span>SPF 30 or more, last</span><em class="badge10" id="b-spf">does most of the work</em></div></div>
  <div class="row10 pm" id="pm"><div class="tile10"><span class="n">1</span><b>Retinoid</b><span>built up slowly</span><em class="badge10" id="b-slow">two nights a week to start</em></div><div class="tile10"><span class="n">2</span><b>Peptides</b><span>serum</span></div><div class="tile10"><span class="n">3</span><b>Rich moisturizer</b><span>hands too</span><em class="badge10" id="b-neck">neck · chest · hands</em></div></div>
  <div class="lane gentle" id="lane-g"><div class="who">Gentle, every night<i>a low strength, seven nights a week</i></div><div class="bar"><div class="fill" id="fill-g"></div></div></div>
  <div class="lane strong" id="lane-s"><div class="who">Strong, once a week<i>peels for three days, then nothing</i></div><div class="bar"><div class="fill" id="fill-s"></div><span class="flare" id="flare">peeling</span></div></div>
  <div class="weeks" id="weeks"><span>week 1</span><span>week 2</span><span>week 3</span><span>week 4</span><span>week 5</span><span>week 6</span><span>week 7</span><span>week 8</span></div>
  <div class="verdict" id="verdict">Gentle and nightly: more nights on the skin, no peeling</div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // shot 0: the morning tiles; shot 1: the night tiles join; shot 2: the tiles make room for the race
      const amOn = i === 0 ? 1 : i === 1 ? 1 : 1 - E.inout(seg(lt, 0, 0.6));
      const pulse = (k, t0) => 1 + 0.04 * Math.sin(Math.PI * seg(lt, t0, t0 + 0.9));
      $$("#am .tile10").forEach((tl, k) => { if (i === 0) { enter(tl, lt, 0.3 + k * 0.35, { y: 20 }); if (lt > 1.6) set(tl, { o: 1, s: k === 2 ? pulse(k, 3.0) : pulse(k, 4.6 + k * 0.3) }); } else set(tl, { o: amOn, y: -10 * (1 - amOn) }); });
      $$("#pm .tile10").forEach((tl, k) => { if (i === 1) { enter(tl, lt, 0.3 + k * 0.35, { y: 20 }); if (lt > 1.6) set(tl, { o: 1, s: k === 0 ? pulse(k, 2.6) : pulse(k, 4.2 + k * 0.4) }); } else set(tl, { o: i === 2 ? amOn : 0, y: i === 2 ? -10 * (1 - amOn) : 20 }); });
      if (i === 0) enter($("#b-spf"), lt, 3.2, { y: 0, s: 0.6, d: 0.5 }); else set($("#b-spf"), { o: 0 });
      if (i === 1) { enter($("#b-slow"), lt, 2.8, { y: 0, s: 0.6, d: 0.5 }); enter($("#b-neck"), lt, 4.4, { y: 0, s: 0.6, d: 0.5 }); } else { set($("#b-slow"), { o: 0 }); set($("#b-neck"), { o: 0 }); }
      $("#am").style.display = i === 2 && lt > 0.7 ? "none" : "flex"; $("#pm").style.display = i === 0 || (i === 2 && lt > 0.7) ? "none" : "flex";   // the night row joins in shot 1
      [$("#lane-g"), $("#lane-s"), $("#weeks"), $("#verdict")].forEach((el) => { el.style.display = i === 2 ? "" : "none"; });   // hidden ones take no room
      if (i === 2) {
        enter($("#lane-g"), lt, 0.8, { y: 12 }); enter($("#lane-s"), lt, 1.1, { y: 12 }); enter($("#weeks"), lt, 1.3, { y: 6 });
        const p = E.lin(seg(lt, 1.6, 7.6));                             // eight weeks pass
        $("#fill-g").style.width = (100 * p) + "%";                       // seven nights a week, steady
        const wk = p * 8, done = Math.floor(wk), frac = wk - done;        // once a week: a jump, then peeling, then nothing until the next one
        $("#fill-s").style.width = (100 * (done * 0.045 + Math.min(1, frac * 4) * 0.045) ) + "%";
        $("#flare").style.opacity = frac > 0.05 && frac < 0.45 && p > 0 && p < 1 ? 1 : 0;
        enter($("#verdict"), lt, 8.0, { y: 8 });
      } else { [$("#lane-g"), $("#lane-s"), $("#weeks"), $("#verdict")].forEach((el) => set(el, { o: 0, y: 12 })); }
    }
  },

  /* ───────── 12-1 Before your facial, peel or wax: the week of prep ───────── */
  "12-1": {
    id: "12-1", kicker: "Before your facial, peel or wax", title: `The week before <span class="grad">decides the result.</span>`, dur: 22, poster: 9,
    shots: [
      { at: 0, name: "pause", cap: "Retinol and acids off three to five days before a facial, peel, dermaplaning or wax. A prescription retinoid: about a week, and tell Evelyn." },
      { at: 7, name: "skin", cap: "No treatment on sunburned or freshly tanned skin, no waxing or shaving the face for two days, and no trip planned for two or three days after." },
      { at: 14, name: "come", cap: "Breaking out is a reason to come in, not to cancel. Open, raw or infected skin is the one thing that waits. Tell her about medications, pregnancy or a recent procedure, every time." }
    ],
    css: `
.cal { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.days { display: grid; grid-template-columns: repeat(9, 1fr); gap: 1vmin; }
.day { position: relative; border-radius: 1.6vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 1.6vmin 1vmin 1.4vmin; text-align: center; opacity: 0; min-height: 15vmin; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: .8vmin; }
.day .d { font-size: 2.1vmin; color: #8e8e93; font-weight: 600; } .day .n { font-size: 3.6vmin; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.day.visit { background: #f4c9d6; border-color: #f4c9d6; } .day.visit .d, .day.visit .n { color: #1a1210; }
.day .mark { width: 2.2vmin; height: 2.2vmin; border-radius: 50%; margin-top: .4vmin; opacity: 0; }
.legend { display: flex; flex-wrap: wrap; gap: 1vmin 1.6vmin; }
.legend span { display: inline-flex; align-items: center; gap: 1vmin; padding: 1vmin 1.8vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 2.3vmin; font-weight: 600; color: #d9d9de; opacity: 0; }
.legend i { width: 1.8vmin; height: 1.8vmin; border-radius: 50%; }
.note12 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6vmin; }
.card12 { border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.2vmin 2.4vmin; opacity: 0; }
.card12 b { display: block; font-size: 2.9vmin; font-weight: 650; line-height: 1.15; } .card12 span { display: block; font-size: 2.2vmin; color: #a1a1a6; margin-top: .8vmin; line-height: 1.35; }
.card12.go b { color: #32d74b; } .card12.wait b { color: #ff7a6b; }
@media (orientation: portrait) { .cal { gap: 2vmin; } .days { grid-template-columns: repeat(3, 1fr); } .day { min-height: 9.5vmin; padding: 1vmin .6vmin .8vmin; gap: .4vmin; } .day .n { font-size: 3vmin; } .day .mark { width: 1.6vmin; height: 1.6vmin; margin-top: .2vmin; } .legend span { font-size: 2vmin; padding: .7vmin 1.3vmin; } .note12 { grid-template-columns: 1fr; } .card12 { padding: 1.6vmin 2vmin; } .card12 b { font-size: 2.6vmin; } .card12 span { font-size: 2vmin; } }`,
    html: `
<div class="cal">
  <div class="days" id="days">
    ${[-7, -6, -5, -4, -3, -2, -1, 0, 2].map((d) => `<div class="day${d === 0 ? " visit" : ""}" data-d="${d}"><span class="d">${d === 0 ? "visit" : d > 0 ? "day +" + d : "day " + d}</span><span class="n">${d === 0 ? "✦" : Math.abs(d)}</span><i class="mark m-rx" style="background:#e2b08c"></i><i class="mark m-act" style="background:#f4c9d6"></i><i class="mark m-sun" style="background:#ffd27a"></i><i class="mark m-wax" style="background:#8fd3ff"></i><i class="mark m-trip" style="background:#6e6e73"></i></div>`).join("")}
  </div>
  <div class="legend" id="legend"><span id="lg-rx"><i style="background:#e2b08c"></i>prescription retinoid off</span><span id="lg-act"><i style="background:#f4c9d6"></i>retinol and acids off</span><span id="lg-sun"><i style="background:#ffd27a"></i>no sunburn or fresh tan</span><span id="lg-wax"><i style="background:#8fd3ff"></i>no waxing or shaving the face</span><span id="lg-trip"><i style="background:#6e6e73"></i>no trip right after</span><span id="lg-tell"><i style="background:#f4c9d6"></i>on a prescription? tell Evelyn</span></div>
  <div class="note12"><div class="card12 go" id="c-go"><b>Breaking out? Come in.</b><span>It's a reason to come, not to cancel.</span></div><div class="card12 wait" id="c-wait"><b>Open, raw or infected skin waits.</b><span>The one thing that does. Tell her about medications, pregnancy or a recent procedure, every time: the pre-visit form is where it goes.</span></div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      const days = $$(".day");
      days.forEach((d, k) => enter(d, lt + (i > 0 ? 9 : 0), 0.3 + k * 0.12, { y: 14 }));
      const on = (sel, from, pred, at) => { $$(sel).forEach((m) => { const d = +m.parentElement.dataset.d; const show = pred(d); set(m, { o: show ? (i > from ? 1 : i === from ? E.out(seg(lt, at, at + 0.5)) : 0) : 0, s: show && i === from ? 0.6 + 0.4 * E.out(seg(lt, at, at + 0.5)) : 1 }); }); };
      on(".m-rx", 0, (d) => d >= -7 && d < 0, 1.6);
      on(".m-act", 0, (d) => d >= -5 && d < 0, 2.8);
      on(".m-sun", 1, (d) => d >= -3 && d <= 0, 1.0);
      on(".m-wax", 1, (d) => d >= -2 && d < 0, 2.4);
      on(".m-trip", 1, (d) => d === 2, 3.8);
      const lg = (id, from, at) => { const el = $("#" + id); if (i > from) set(el, { o: 1 }); else if (i === from) enter(el, lt, at, { y: 8 }); else set(el, { o: 0, y: 8 }); };
      lg("lg-rx", 0, 1.8); lg("lg-act", 0, 3.0); lg("lg-sun", 1, 1.2); lg("lg-wax", 1, 2.6); lg("lg-trip", 1, 4.0);
      const tell = $("#lg-tell"); if (i === 0) enter(tell, lt, 4.6, { y: 8 }); else set(tell, { o: 0, y: 8 });
      const visit = $(".day.visit"); if (lt > 1.6) set(visit, { o: 1, s: 1 + 0.05 * Math.sin(Math.PI * seg(lt, i === 0 ? 5.6 : i === 1 ? 5.4 : 4.6, (i === 0 ? 5.6 : i === 1 ? 5.4 : 4.6) + 0.9)) });   // the visit tile breathes once a shot
      if (i === 2) { enter($("#c-go"), lt, 0.6, { y: 12 }); enter($("#c-wait"), lt, 2.2, { y: 12 }); } else { set($("#c-go"), { o: 0, y: 12 }); set($("#c-wait"), { o: 0, y: 12 }); }
      $(".note12").style.display = i === 2 ? "" : "none";
      $("#legend").style.display = i === 2 && lt > 0.4 ? "none" : "";   // the cards take the legend's place, so the whole thing fits a phone
    }
  },

  /* ───────── 13-1 Before a wax: a grain of rice ───────── */
  "1-2": {
    id: "1-2", kicker: "Find your real skin type", title: `Oil is your type. <span class="grad">The rest is condition.</span>`, dur: 21, poster: 4,
    shots: [
      { at: 0, name: "types", cap: "Four types: dry makes little oil, oily a lot, combination is an oily T-zone with drier cheeks, and normal sits in between." },
      { at: 7, name: "test", cap: "The bare-face test: cleanse, put nothing on, wait an hour, then look. Shine everywhere is oily; T-zone only is combination; tight and flaky is dry." },
      { at: 14, name: "conditions", cap: "Conditions come and go on top of your type: dehydrated, sensitive, acne-prone, sun-damaged. Oily skin can still be dehydrated. Check again every few months." }
    ],
    css: `
.st { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2.4vmin; }
.row4 { display: flex; justify-content: center; gap: 5vmin; }
.fc { position: relative; width: 21vmin; opacity: 0; }
.face2 { position: relative; width: 21vmin; height: 26vmin; border-radius: 10.5vmin 10.5vmin 9vmin 9vmin / 12vmin 12vmin 10vmin 10vmin; background: #d9b5a0; border: 1px solid rgba(255,255,255,.12); overflow: hidden; }
.face2 .nose { position: absolute; left: 50%; top: 8.5vmin; width: 2.8vmin; height: 6.5vmin; margin-left: -1.4vmin; border-radius: 1.6vmin; background: rgba(0,0,0,.08); }
.face2 .lip { position: absolute; left: 50%; bottom: 4.6vmin; width: 6.5vmin; height: 1.1vmin; margin-left: -3.25vmin; border-radius: 1vmin; background: #b9786b; }
.face2 .shine { position: absolute; inset: 0; background: radial-gradient(60% 55% at 50% 42%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%); opacity: 0; }
.face2 .tz { position: absolute; left: 50%; top: 3vmin; width: 12vmin; height: 4vmin; margin-left: -6vmin; border-radius: 3vmin; background: rgba(255,255,255,.45); filter: blur(.8vmin); opacity: 0; }
.face2 .tz2 { position: absolute; left: 50%; top: 6vmin; width: 4.6vmin; height: 13vmin; margin-left: -2.3vmin; border-radius: 3vmin; background: rgba(255,255,255,.4); filter: blur(.8vmin); opacity: 0; }
.face2 .fl { position: absolute; width: 1.1vmin; height: 1.1vmin; border-radius: 30%; background: #f1dccf; opacity: 0; }
.face2 .tight { position: absolute; inset: 0; box-shadow: inset 0 0 0 1.2vmin rgba(255,255,255,.14); border-radius: inherit; opacity: 0; }
.fc .nm { display: block; text-align: center; margin-top: 1.2vmin; font-size: 2.7vmin; font-weight: 700; }
.fc .sub { display: block; text-align: center; margin-top: .3vmin; font-size: 2.1vmin; color: #a1a1a6; line-height: 1.3; min-height: 5.6vmin; }
.fc.dim { opacity: .35 !important; }
.fc .sub.hit { color: #e2b08c; font-weight: 650; } .fc .sub.hot { color: #9ad6ff; font-weight: 650; }
.panel { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 1.6vmin 3vmin; width: 100%; min-height: 13vmin; }
.steps { display: flex; gap: 1.6vmin; align-items: center; }
.step { padding: 1.3vmin 2.2vmin; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); font-size: 2.5vmin; font-weight: 600; color: #d9d9de; white-space: nowrap; opacity: 0; }
.step.on { background: rgba(234,185,200,.16); border-color: rgba(234,185,200,.6); color: #f4c9d6; }
.clock { position: relative; width: 14vmin; height: 14vmin; border-radius: 50%; border: .5vmin solid rgba(255,255,255,.18); background: #111113; opacity: 0; flex: none; }
.clock i { position: absolute; left: 50%; top: 50%; width: .6vmin; height: 5.4vmin; margin-left: -.3vmin; margin-top: -5.4vmin; border-radius: 1vmin; background: #f4c9d6; transform-origin: 50% 100%; }
.clock b { position: absolute; left: 50%; top: 50%; width: 1.4vmin; height: 1.4vmin; margin: -.7vmin 0 0 -.7vmin; border-radius: 50%; background: #e2b08c; }
.clock em { position: absolute; left: 50%; bottom: -3.4vmin; transform: translateX(-50%); font-style: normal; font-size: 2.1vmin; color: #a1a1a6; white-space: nowrap; }
.conds { display: flex; flex-wrap: wrap; justify-content: center; gap: 1.6vmin; }
.cond { padding: 1.3vmin 2.4vmin; border-radius: 999px; border: 1.5px solid #8e8e93; color: #d9d9de; font-size: 2.6vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.cond.hot { border-color: #6ec6ff; color: #9ad6ff; }
.again { flex-basis: 100%; font-size: 2.4vmin; color: #a1a1a6; text-align: center; opacity: 0; }
@media (orientation: portrait) { .st { gap: 4vmin; } .row4 { flex-wrap: wrap; gap: 4vmin 8vmin; width: 100%; } .fc { width: 30vmin; } .face2 { width: 30vmin; height: 37vmin; border-radius: 15vmin 15vmin 13vmin 13vmin / 17vmin 17vmin 14vmin 14vmin; } .face2 .nose { top: 12vmin; width: 3.6vmin; height: 9vmin; margin-left: -1.8vmin; } .face2 .lip { bottom: 6.5vmin; width: 9vmin; margin-left: -4.5vmin; height: 1.5vmin; } .face2 .tz { top: 4.5vmin; width: 17vmin; margin-left: -8.5vmin; height: 5.6vmin; } .face2 .tz2 { top: 8.5vmin; width: 6.5vmin; margin-left: -3.25vmin; height: 18vmin; } .face2 .fl { width: 1.5vmin; height: 1.5vmin; } .fc .nm { font-size: 3.3vmin; } .fc .sub { min-height: 4vmin; font-size: 2.5vmin; } .panel { gap: 2.4vmin 3vmin; min-height: 0; } .steps { flex-wrap: wrap; justify-content: center; gap: 1.4vmin; max-width: 62vmin; } .step { font-size: 2.6vmin; } .clock { width: 14vmin; height: 14vmin; margin-bottom: 3vmin; } .cond { font-size: 2.7vmin; } .again { font-size: 2.7vmin; } }`,
    html: `
<div class="st">
  <div class="row4" id="row4">
    <div class="fc" id="fc-dry"><div class="face2"><div class="nose"></div><div class="lip"></div><div class="tight" id="tight"></div></div><b class="nm">Dry</b><span class="sub" id="sb-dry">little oil</span></div>
    <div class="fc" id="fc-oily"><div class="face2"><div class="nose"></div><div class="lip"></div><div class="shine" id="sh-oily"></div></div><b class="nm">Oily</b><span class="sub" id="sb-oily">a lot of oil</span></div>
    <div class="fc" id="fc-combo"><div class="face2"><div class="nose"></div><div class="lip"></div><div class="tz" id="tz1"></div><div class="tz2" id="tz2"></div></div><b class="nm">Combination</b><span class="sub" id="sb-combo">oily T-zone, drier cheeks</span></div>
    <div class="fc" id="fc-norm"><div class="face2"><div class="nose"></div><div class="lip"></div></div><b class="nm">Normal</b><span class="sub" id="sb-norm">balanced</span></div>
  </div>
  <div class="panel" id="panel">
    <div class="steps" id="steps"><span class="step" id="s1">cleanse</span><span class="step" id="s2">nothing on</span><span class="step" id="s3">wait an hour</span><span class="step" id="s4">look in daylight</span></div>
    <div class="clock" id="clock"><i id="hand"></i><b></b><em id="mins">0 min</em></div>
    <div class="conds" id="conds"><span class="cond" id="c1">dehydrated</span><span class="cond" id="c2">sensitive</span><span class="cond" id="c3">acne-prone</span><span class="cond" id="c4">sun-damaged</span></div>
    <p class="again" id="again">Seasons, hormones and age shift it: check again every few months.</p>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {
      const hash = (i) => { let x = (i + 1) * 2654435761 % 4294967296; x = ((x >>> 13) ^ x) * 1274126177 % 4294967296; return ((((x >>> 16) ^ x) / 4294967296) % 1 + 1) % 1; };
      // dry: a scatter of pale flakes on the cheeks
      const dry = M.$("#fc-dry .face2");
      for (let k = 0; k < 16; k++) { const i = document.createElement("i"); i.className = "fl"; i.style.left = (14 + hash(k + 40) * 70) + "%"; i.style.top = (38 + hash(k + 41) * 44) + "%"; i.style.transform = "rotate(" + Math.round(hash(k + 42) * 90) + "deg)"; dry.appendChild(i); }
    },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set, tw } = M;
      const fcs = [$("#fc-dry"), $("#fc-oily"), $("#fc-combo"), $("#fc-norm")];
      // shot 0: the four faces arrive left to right, then each shows its oil
      if (i === 0) fcs.forEach((f, k) => enter(f, lt, 0.2 + k * 0.35, { y: 16 })); else fcs.forEach((f) => set(f, { o: 1 }));
      const show = (k) => i > 0 ? 1 : E.out(seg(lt, 2.0 + k * 0.5, 3.0 + k * 0.5));
      $$("#fc-dry .fl").forEach((d, n) => { d.style.opacity = 0.9 * show(0) * (n % 2 ? 1 : 0.8); });
      $("#tight").style.opacity = 0.9 * show(0);
      const breath = i === 0 ? 1 - 0.12 * (0.5 + 0.5 * Math.sin((lt - 3.5) * 2.4)) * seg(lt, 3.5, 4.5) : 1;
      $("#sh-oily").style.opacity = show(1) * breath;
      $("#tz1").style.opacity = show(2) * breath; $("#tz2").style.opacity = show(2) * breath;
      // shot 1: the test; the steps light one by one, the clock sweeps one hour, the readouts land on each face
      const steps = [$("#s1"), $("#s2"), $("#s3"), $("#s4")], clock = $("#clock");
      $("#steps").style.display = i === 1 ? "" : "none"; clock.style.display = i === 1 ? "" : "none";
      if (i === 1) {
        steps.forEach((s, k) => { enter(s, lt, 0.3 + k * 0.5, { y: 8 }); s.classList.toggle("on", lt >= 0.6 + k * 0.5 && (k < 3 || lt >= 4.6)); });
        enter(clock, lt, 1.2, { y: 8, s: 0.8 });
        const m = 60 * E.inout(seg(lt, 1.6, 4.4));
        $("#hand").style.transform = "rotate(" + (m * 6) + "deg)"; $("#mins").textContent = Math.round(m) + " min";
      }
      const subs = { dry: ["little oil", "tight, flaky: dry", 6.0], oily: ["a lot of oil", "shine all over: oily", 4.8], combo: ["oily T-zone, drier cheeks", "T-zone shine: combination", 5.4], norm: ["balanced", "neither: normal", 6.5] };
      Object.keys(subs).forEach((k) => { const el = $("#sb-" + k), [base, read, at] = subs[k]; const on = i > 1 || (i === 1 && lt >= at); el.textContent = on ? read : base; el.classList.toggle("hit", on); if (i === 1 && lt >= at) enter(el, lt, at, { y: 4, d: 0.4 }); else set(el, { o: 1 }); });
      // shot 2: the conditions float in over the types; the oily face carries "dehydrated" too
      $("#conds").style.display = i === 2 ? "" : "none";
      const conds = [$("#c1"), $("#c2"), $("#c3"), $("#c4")];
      if (i === 2) {
        conds.forEach((c, k) => enter(c, lt, 0.4 + k * 0.45, { y: 10 }));
        const hot = lt >= 2.8; conds[0].classList.toggle("hot", hot);
        const so = $("#sb-oily"); if (hot) { so.textContent = "oily + dehydrated"; so.classList.add("hot"); enter(so, lt, 2.8, { y: 4, d: 0.4 }); }
        fcs.forEach((f, k) => f.classList.toggle("dim", lt >= 2.8 && k !== 1));
        $("#again").style.display = ""; enter($("#again"), lt, 4.4, { y: 8 });
      } else { $("#again").style.display = "none"; $("#sb-oily").classList.remove("hot"); fcs.forEach((f) => f.classList.remove("dim")); conds.forEach((c) => c.classList.remove("hot")); set($("#again"), { o: 0 }); }
    }
  },
  "12-2": {
    id: "12-2", kicker: "After your facial, peel or wax", title: `The first day, <span class="grad">then the first week.</span>`, dur: 21, poster: 10,
    shots: [
      { at: 0, name: "day one", cap: "The first day: no makeup, no touching, no heat or sweat, no sun. A gentle cleanse that night or the next morning, moisturizer, SPF." },
      { at: 7, name: "actives", cap: "No actives for two or three days after a facial; five to seven after a peel, dermaplaning or microchanneling, or until the skin feels normal." },
      { at: 14, name: "week", cap: "Let flaking fall by itself; pulled skin leaves marks. Change the pillowcase, clean the phone, and skip waxing, threading and new products for a week." }
    ],
    css: `
.aft { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.d1 { display: flex; align-items: stretch; gap: 4vmin; }
.d1 .big1 { flex: none; width: 34vmin; border-radius: 2.4vmin; background: #f4c9d6; color: #1a1210; padding: 2.4vmin; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; opacity: 0; }
.d1 .big1 b { font-size: 9.5vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; } .d1 .big1 span { font-size: 2.7vmin; font-weight: 600; margin-top: 1.2vmin; }
.d1 .rows { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.d1 .lab { font-size: 2.6vmin; font-weight: 650; color: #8e8e93; letter-spacing: .04em; text-transform: uppercase; margin-bottom: .8vmin; opacity: 0; }
.d1 .chips { display: flex; flex-wrap: wrap; gap: 1.6vmin; }
.d1 .ch { position: relative; padding: 1.5vmin 2.8vmin; border-radius: 999px; background: #111113; border: 1.5px solid rgba(255,255,255,.14); font-size: 3.2vmin; font-weight: 600; color: #f5f5f7; white-space: nowrap; opacity: 0; }
.d1 .ch.no { border-color: rgba(255,122,107,.6); } .d1 .ch.no i { position: absolute; left: 1.6vmin; right: 1.6vmin; top: 50%; height: .35vmin; background: #ff7a6b; transform-origin: 0 50%; transform: scaleX(0); border-radius: 1vmin; }
.d1 .ch.yes { border-color: rgba(50,215,75,.6); color: #7fe39a; }
.days2 { display: grid; grid-template-columns: repeat(8, 1fr); gap: 1vmin; }
.day2 { position: relative; border-radius: 1.6vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 1.8vmin 1vmin 1.6vmin; text-align: center; opacity: 0; min-height: 21vmin; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: .8vmin; }
.day2 .d { font-size: 2.5vmin; color: #8e8e93; font-weight: 600; } .day2 .n { font-size: 4.6vmin; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
.day2.visit { background: #f4c9d6; border-color: #f4c9d6; } .day2.visit .d, .day2.visit .n { color: #1a1210; }
.day2 .mark { width: 2.8vmin; height: 2.8vmin; border-radius: 50%; margin-top: .4vmin; opacity: 0; }
.legend2 { display: flex; flex-wrap: wrap; gap: 1vmin 1.6vmin; }
.legend2 span { display: inline-flex; align-items: center; gap: 1vmin; padding: 1.2vmin 2.2vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 2.8vmin; font-weight: 600; color: #d9d9de; opacity: 0; }
.legend2 i { width: 2.2vmin; height: 2.2vmin; border-radius: 50%; }
.legend2 span.warn { border-color: rgba(255,122,107,.6); color: #ff9a8b; }
@media (orientation: portrait) { .aft { gap: 2.4vmin; } .d1 { flex-direction: column; gap: 2.4vmin; } .d1 .big1 { width: 100%; flex-direction: row; gap: 2.4vmin; padding: 2.2vmin; } .d1 .big1 b { font-size: 7vmin; } .d1 .big1 span { margin-top: 0; text-align: left; } .d1 .ch { font-size: 2.9vmin; } .days2 { grid-template-columns: repeat(4, 1fr); } .day2 { min-height: 14vmin; padding: 1.2vmin .6vmin 1vmin; gap: .5vmin; } .day2 .d { font-size: 2.2vmin; } .day2 .n { font-size: 3.6vmin; } .day2 .mark { width: 2vmin; height: 2vmin; margin-top: .2vmin; } .legend2 span { font-size: 2.5vmin; padding: .9vmin 1.6vmin; } }`,
    html: `
<div class="aft">
  <div class="d1" id="d1">
    <div class="big1" id="big1"><b>24h</b><span>the first day: a thinner barrier, open follicles</span></div>
    <div class="rows">
      <div><p class="lab" id="lab-no">Keep off it</p><div class="chips"><span class="ch no" id="n1">makeup<i></i></span><span class="ch no" id="n2">touching<i></i></span><span class="ch no" id="n3">heat and sweat: gym, sauna, hot yoga, pools<i></i></span><span class="ch no" id="n4">sun<i></i></span></div></div>
      <div><p class="lab" id="lab-yes">That night or the next morning</p><div class="chips"><span class="ch yes" id="y1">a gentle cleanse</span><span class="ch yes" id="y2">moisturizer</span><span class="ch yes" id="y3">SPF</span></div></div>
    </div>
  </div>
  <div class="days2" id="days2">
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((d) => `<div class="day2${d === 0 ? " visit" : ""}" data-d="${d}"><span class="d">${d === 0 ? "visit" : "day +" + d}</span><span class="n">${d === 0 ? "✦" : d}</span><i class="mark m-fac" style="background:#f4c9d6"></i><i class="mark m-peel" style="background:#e2b08c"></i><i class="mark m-flake" style="background:#f1dccf"></i><i class="mark m-new" style="background:#8fd3ff"></i></div>`).join("")}
  </div>
  <div class="legend2" id="legend2"><span id="lg-fac"><i style="background:#f4c9d6"></i>after a facial: actives off 2 to 3 days</span><span id="lg-peel"><i style="background:#e2b08c"></i>peel, dermaplaning, microchanneling: 5 to 7</span><span id="lg-feel">or until the skin feels normal</span><span id="lg-flake"><i style="background:#f1dccf"></i>flaking, days 2 to 5: let it fall</span><span class="warn" id="lg-pull">pulled skin leaves marks</span><span id="lg-new"><i style="background:#8fd3ff"></i>no waxing, threading or new products all week</span><span id="lg-house">new pillowcase, clean phone</span></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // shot 0: the first-day panel; the four "no" chips enter and get struck through, then the three "yes" chips
      $("#d1").style.display = i === 0 ? "" : "none";
      if (i === 0) {
        enter($("#big1"), lt, 0.2, { y: 14, s: 0.9 });
        enter($("#lab-no"), lt, 0.6, { y: 6 });
        ["n1", "n2", "n3", "n4"].forEach((id, k) => { const el = $("#" + id); enter(el, lt, 0.9 + k * 0.45, { y: 10 }); el.querySelector("i").style.transform = "scaleX(" + E.out(seg(lt, 1.4 + k * 0.45, 1.8 + k * 0.45)) + ")"; });
        enter($("#lab-yes"), lt, 3.4, { y: 6 });
        ["y1", "y2", "y3"].forEach((id, k) => enter($("#" + id), lt, 3.7 + k * 0.45, { y: 10 }));
        set($("#big1"), { o: 1, s: 1 + 0.04 * Math.sin(Math.PI * seg(lt, 5.6, 6.5)) });
      }
      // shots 1 and 2: the week strip with its marks
      const strip = i >= 1; $("#days2").style.display = strip ? "" : "none"; $("#legend2").style.display = strip ? "" : "none";
      if (strip) {
        const slt = i === 1 ? lt : lt + 9;
        $$(".day2").forEach((d, k) => enter(d, slt, 0.2 + k * 0.1, { y: 14 }));
        const on = (sel, from, pred, at) => { $$(sel).forEach((m) => { const d = +m.parentElement.dataset.d; const show = pred(d); set(m, { o: show ? (i > from ? 1 : i === from ? E.out(seg(lt, at, at + 0.5)) : 0) : 0, s: show && i === from ? 0.6 + 0.4 * E.out(seg(lt, at, at + 0.5)) : 1 }); }); };
        on(".m-fac", 1, (d) => d >= 1 && d <= 3, 1.4);
        on(".m-peel", 1, (d) => d >= 1 && d <= 7, 2.8);
        on(".m-flake", 2, (d) => d >= 2 && d <= 5, 0.8);
        on(".m-new", 2, (d) => d >= 1 && d <= 7, 2.6);
        const lg = (id, from, at, hideAfter) => { const el = $("#" + id); if (hideAfter && i > from) { set(el, { o: 0 }); el.style.display = "none"; return; } el.style.display = ""; if (i > from) set(el, { o: 1 }); else if (i === from) enter(el, lt, at, { y: 8 }); else { set(el, { o: 0, y: 8 }); el.style.display = "none"; } };
        lg("lg-fac", 1, 1.6, true); lg("lg-peel", 1, 3.0, true); lg("lg-feel", 1, 4.4, true);
        lg("lg-flake", 2, 1.0); lg("lg-pull", 2, 2.0); lg("lg-new", 2, 2.8); lg("lg-house", 2, 4.0);
        const visit = $(".day2.visit"); if (slt > 1) set(visit, { o: 1, s: 1 + 0.05 * Math.sin(Math.PI * seg(lt, i === 1 ? 5.6 : 5.2, (i === 1 ? 5.6 : 5.2) + 0.9)) });
      }
    }
  },
  "7-2": {
    id: "7-2", kicker: "Facial massage and gua sha", title: `Slip, direction, <span class="grad">and a light hand.</span>`, dur: 20, poster: 9,
    shots: [
      { at: 0, name: "slip", cap: "Always use slip: a face oil or a rich serum. Never drag dry skin." },
      { at: 6, name: "direction", cap: "Go from the center outward, then downward along the neck, toward the lymph nodes." },
      { at: 13, name: "pressure", cap: "Light pressure. It should feel good, never hurt, and never leave marks. Skip over active breakouts, broken skin, or right after a peel." }
    ],
    css: `
.ms { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8vmin; }
.ms svg { width: 50vmin; height: 62vmin; flex: none; overflow: visible; }
.ms .side { display: flex; flex-direction: column; gap: 2.2vmin; width: 66vmin; }
.ms .pill { display: inline-flex; align-self: flex-start; align-items: center; gap: 1.2vmin; padding: 1.8vmin 3vmin; border-radius: 999px; background: #111113; border: 1.5px solid rgba(255,255,255,.14); font-size: 3.4vmin; font-weight: 600; color: #f5f5f7; opacity: 0; }
.ms .pill.rose { border-color: rgba(244,201,214,.6); color: #f4c9d6; } .ms .pill.no { border-color: rgba(255,122,107,.6); color: #ff9a8b; } .ms .pill.ok { border-color: rgba(50,215,75,.6); color: #7fe39a; }
.ms .meter { border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.8vmin 3.2vmin; opacity: 0; }
.ms .meter b { display: block; font-size: 2.7vmin; color: #8e8e93; font-weight: 650; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 1.2vmin; }
.ms .bar { position: relative; height: 3vmin; border-radius: 999px; background: linear-gradient(90deg, #32d74b 0%, #32d74b 38%, #ffd27a 60%, #ff7a6b 100%); opacity: .9; }
.ms .bar i { position: absolute; top: -1.2vmin; width: 5.4vmin; height: 5.4vmin; margin-left: -2.7vmin; border-radius: 50%; background: #fff; border: .5vmin solid #111113; box-shadow: 0 .4vmin 1.2vmin rgba(0,0,0,.5); }
.ms .bar em { position: absolute; top: 4.4vmin; font-style: normal; font-size: 2.6vmin; color: #a1a1a6; white-space: nowrap; } .ms .bar em.r { right: 0; } .ms .bar em.l { left: 0; }
.ms .meter .sp { height: 6.5vmin; }
@media (orientation: portrait) { .ms { flex-direction: column; gap: 4vmin; } .ms svg { width: 60vmin; height: 74vmin; } .ms .side { width: 100%; align-items: center; gap: 2vmin; } .ms .pill { align-self: center; font-size: 3vmin; padding: 1.5vmin 2.6vmin; } .ms .meter { width: 100%; } }`,
    html: `
<div class="ms">
  <svg viewBox="0 0 100 124" fill="none">
    <defs><radialGradient id="sheen" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#fff" stop-opacity=".7"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#f4c9d6"/></marker></defs>
    <path d="M38 86 L36 104 Q50 110 64 104 L62 86 Z" fill="#cfa58f"/>
    <path d="M20 112 Q50 100 80 112" stroke="#8e8e93" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="50" cy="48" rx="31" ry="40" fill="#d9b5a0" stroke="rgba(255,255,255,.14)" stroke-width=".6"/>
    <rect x="47" y="38" width="6" height="18" rx="3" fill="rgba(0,0,0,.08)"/>
    <rect x="42" y="68" width="16" height="3" rx="1.5" fill="#b9786b"/>
    <ellipse id="sheen" cx="50" cy="48" rx="31" ry="40" fill="url(#sheen)" opacity="0"/>
    <g id="drop" opacity="0"><path d="M63 14 q-7 10 -7 15 a7 7 0 0 0 14 0 q0 -5 -7 -15z" fill="#e2b08c"/><ellipse cx="60.5" cy="27" rx="1.6" ry="2.4" fill="#fff" opacity=".6"/></g>
    <g id="arrows" stroke="#f4c9d6" stroke-width="2.4" stroke-linecap="round" fill="none" marker-end="url(#ah)">
      <path class="ar" d="M50 18 Q62 16 74 26"/><path class="ar" d="M50 18 Q38 16 26 26"/>
      <path class="ar" d="M50 50 Q64 46 76 54"/><path class="ar" d="M50 50 Q36 46 24 54"/>
      <path class="ar" d="M50 76 Q66 74 76 64"/><path class="ar" d="M50 76 Q34 74 24 64"/>
      <path class="ar dn" d="M70 86 Q68 98 72 110"/><path class="ar dn" d="M30 86 Q32 98 28 110"/>
    </g>
    <g id="nodes" fill="#8fd3ff" opacity="0"><circle cx="72" cy="111" r="3"/><circle cx="28" cy="111" r="3"/><circle cx="50" cy="109" r="2.2"/></g>
    <g id="skip" opacity="0"><circle cx="36" cy="60" r="3.6" fill="#d7585a"/><circle cx="62" cy="38" r="3" fill="#d7585a"/><circle cx="44" cy="30" r="2.6" fill="#d7585a"/><circle cx="36" cy="60" r="7.5" stroke="#ff7a6b" stroke-width="1.4" stroke-dasharray="2.5 2"/><circle cx="62" cy="38" r="6.5" stroke="#ff7a6b" stroke-width="1.4" stroke-dasharray="2.5 2"/><circle cx="44" cy="30" r="5.8" stroke="#ff7a6b" stroke-width="1.4" stroke-dasharray="2.5 2"/></g>
  </svg>
  <div class="side">
    <span class="pill rose" id="p-slip">a face oil or a rich serum</span>
    <span class="pill no" id="p-dry">never on dry skin</span>
    <span class="pill rose" id="p-out">center → outward</span>
    <span class="pill rose" id="p-down">down the neck, toward the lymph nodes</span>
    <div class="meter" id="meter"><b>Pressure</b><div class="bar"><i id="knob"></i><em class="l">feels good</em><em class="r">hurts, leaves marks</em></div><div class="sp"></div></div>
    <span class="pill no" id="p-skip">skip breakouts, broken skin, a fresh peel</span>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => { M.$$(".ar").forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.dataset.l = L; }); },
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set, tw } = M;
      const svg = $(".ms svg"); set(svg, { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      // shot 0: a drop falls onto the cheek and spreads into a sheen
      const drop = $("#drop"), sheen = $("#sheen");
      if (i === 0) {
        const fall = E.in(seg(lt, 0.6, 1.7)); drop.setAttribute("opacity", lt >= 0.6 && lt < 1.75 ? 1 : 0); drop.setAttribute("transform", "translate(0 " + (-22 + 22 * fall) + ")");
        const spread = E.out(seg(lt, 1.7, 3.6)); sheen.setAttribute("opacity", spread); sheen.setAttribute("transform", "translate(" + (63 - 63 * spread) + " " + (30 - 30 * spread) + ") scale(" + (0.15 + 0.85 * spread) + ")"); sheen.setAttribute("transform-origin", "0 0");
      } else { drop.setAttribute("opacity", 0); sheen.setAttribute("opacity", 1); sheen.removeAttribute("transform"); }
      const pill = (id, from, at) => { const el = $("#" + id); el.style.display = (i === from) ? "" : "none"; if (i === from) enter(el, lt, at, { y: 8 }); };
      pill("p-slip", 0, 1.8); pill("p-dry", 0, 3.6);
      // shot 1: the strokes draw from the center outward, then down the neck
      $$(".ar").forEach((p, k) => { const L = +p.dataset.l; const dn = p.classList.contains("dn"); const at = dn ? 3.2 + (k - 6) * 0.3 : 0.6 + Math.floor(k / 2) * 0.7; const q = i > 1 ? 1 : i === 1 ? E.out(seg(lt, at, at + 0.9)) : 0; p.style.strokeDashoffset = L * (1 - q); p.style.opacity = q <= 0 ? 0 : i === 2 ? 0.45 : 1; });
      $("#nodes").setAttribute("opacity", i > 1 ? 0.8 : i === 1 ? E.out(seg(lt, 4.2, 4.8)) : 0);
      pill("p-out", 1, 1.4); pill("p-down", 1, 3.6);
      // shot 2: the pressure knob settles at light; the skip zones light red
      const meter = $("#meter"); meter.style.display = i === 2 ? "" : "none";
      if (i === 2) { enter(meter, lt, 0.4, { y: 10 }); const k = 0.12 + 0.6 * Math.sin(Math.PI * seg(lt, 1.0, 2.6)) * (1 - seg(lt, 2.6, 3.2)) + 0.1 * seg(lt, 2.6, 3.2); $("#knob").style.left = (100 * Math.min(0.95, Math.max(0.05, k))) + "%"; }
      $("#skip").setAttribute("opacity", i === 2 ? E.out(seg(lt, 3.4, 4.0)) : 0);
      pill("p-skip", 2, 3.6);
    }
  },
  "13-2": {
    id: "13-2", kicker: "After a wax: bumps, ingrowns, how often", title: `Two days of calm, <span class="grad">then keep it clear.</span>`, dur: 21, poster: 10,
    shots: [
      { at: 0, name: "48 hours", cap: "For 24 to 48 hours: no heat or sweat, no sun, no tight clothes, nothing scented. After a Brazilian, loose cotton and no sex for a day." },
      { at: 7, name: "normal", cap: "Small red bumps for a few hours to a day are normal. Pus-filled bumps that spread, lifted skin or a burn are not: message Evelyn." },
      { at: 14, name: "rhythm", cap: "From day two or three, exfoliate the area gently two or three times a week and keep it moisturized. Don't dig at an ingrown. Every four to six weeks; shaving in between undoes it." }
    ],
    css: `
.aw { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.aw .d1 { display: flex; align-items: stretch; gap: 4vmin; }
.aw .big1 { flex: none; width: 34vmin; border-radius: 2.4vmin; background: #f4c9d6; color: #1a1210; padding: 2.4vmin; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; opacity: 0; }
.aw .big1 b { font-size: 9.5vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; } .aw .big1 span { font-size: 2.7vmin; font-weight: 600; margin-top: 1.2vmin; }
.aw .rows { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.aw .lab { font-size: 2.6vmin; font-weight: 650; color: #8e8e93; letter-spacing: .04em; text-transform: uppercase; margin-bottom: .8vmin; opacity: 0; }
.aw .chips { display: flex; flex-wrap: wrap; gap: 1.6vmin; }
.aw .ch { position: relative; padding: 1.5vmin 2.8vmin; border-radius: 999px; background: #111113; border: 1.5px solid rgba(255,255,255,.14); font-size: 3.2vmin; font-weight: 600; color: #f5f5f7; white-space: nowrap; opacity: 0; }
.aw .ch.no { border-color: rgba(255,122,107,.6); } .aw .ch.no i { position: absolute; left: 1.6vmin; right: 1.6vmin; top: 50%; height: .35vmin; background: #ff7a6b; transform-origin: 0 50%; transform: scaleX(0); border-radius: 1vmin; }
.aw .ch.yes { border-color: rgba(50,215,75,.6); color: #7fe39a; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4vmin; }
.vs { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 3.2vmin; display: flex; gap: 3vmin; align-items: center; opacity: 0; }
.vs .patch { position: relative; flex: none; width: 20vmin; height: 20vmin; border-radius: 2vmin; background: #d9b5a0; overflow: hidden; }
.vs .patch i { position: absolute; border-radius: 50%; background: #d7585a; width: 2.6vmin; height: 2.6vmin; margin: -1.3vmin 0 0 -1.3vmin; }
.vs .patch i.pus { background: #f3e2a8; box-shadow: 0 0 0 .6vmin #d7585a; }
.vs .patch .lift { position: absolute; left: 20%; top: 55%; width: 60%; height: 20%; border-radius: 1vmin; background: #c48a7a; opacity: 0; }
.vs b { display: block; font-size: 3.6vmin; font-weight: 700; line-height: 1.12; } .vs span { display: block; font-size: 2.7vmin; color: #a1a1a6; margin-top: .8vmin; line-height: 1.35; }
.vs.ok b { color: #32d74b; } .vs.bad b { color: #ff7a6b; }
.rh { display: flex; align-items: center; gap: 3vmin; }
.wk7 { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 1vmin; }
.wd { border-radius: 1.6vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 1.6vmin .8vmin 1.4vmin; text-align: center; opacity: 0; display: flex; flex-direction: column; align-items: center; gap: .8vmin; min-height: 18vmin; }
.wd .d { font-size: 2.4vmin; color: #8e8e93; font-weight: 600; } .wd .n { font-size: 4.2vmin; font-weight: 700; line-height: 1; }
.wd .mark { width: 2.8vmin; height: 2.8vmin; border-radius: 50%; opacity: 0; }
.dial { flex: none; width: 28vmin; height: 28vmin; border-radius: 50%; position: relative; background: conic-gradient(#f4c9d6 0 var(--p, 0%), rgba(255,255,255,.08) var(--p, 0%) 100%); opacity: 0; }
.dial::after { content: ""; position: absolute; inset: 3vmin; border-radius: 50%; background: #0d0d0f; }
.dial b { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 3.8vmin; font-weight: 700; line-height: 1.05; z-index: 1; } .dial b small { display: block; font-size: 2.3vmin; color: #a1a1a6; font-weight: 600; margin-top: .6vmin; max-width: 18vmin; }
.lg13 { display: flex; flex-wrap: wrap; gap: 1vmin 1.6vmin; }
.lg13 span { display: inline-flex; align-items: center; gap: 1vmin; padding: 1.2vmin 2.2vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 2.8vmin; font-weight: 600; color: #d9d9de; opacity: 0; }
.lg13 i { width: 2.2vmin; height: 2.2vmin; border-radius: 50%; } .lg13 span.warn { border-color: rgba(255,122,107,.6); color: #ff9a8b; }
@media (orientation: portrait) { .aw { gap: 2.4vmin; } .aw .d1 { flex-direction: column; gap: 2.4vmin; } .aw .big1 { width: 100%; flex-direction: row; gap: 2.4vmin; padding: 2.2vmin; } .aw .big1 b { font-size: 7vmin; } .aw .big1 span { margin-top: 0; text-align: left; } .aw .ch { font-size: 2.9vmin; } .two { grid-template-columns: 1fr; } .vs { padding: 2.4vmin; gap: 2.4vmin; } .vs .patch { width: 16vmin; height: 16vmin; } .vs b { font-size: 3.2vmin; } .vs span { font-size: 2.5vmin; } .rh { flex-direction: column; gap: 2.4vmin; } .wk7 { width: 100%; } .wd { min-height: 13vmin; padding: 1.2vmin .4vmin 1vmin; gap: .5vmin; } .wd .d { font-size: 2vmin; } .wd .n { font-size: 3.4vmin; } .wd .mark { width: 2.2vmin; height: 2.2vmin; } .dial { width: 24vmin; height: 24vmin; } .lg13 span { font-size: 2.5vmin; padding: .9vmin 1.6vmin; } }`,
    html: `
<div class="aw">
  <div class="d1" id="w-d1">
    <div class="big1" id="w-big"><b>48h</b><span>the first two days: heat and friction off</span></div>
    <div class="rows">
      <div><p class="lab" id="w-labno">Keep off it</p><div class="chips"><span class="ch no" id="w1">heat and sweat<i></i></span><span class="ch no" id="w2">sun<i></i></span><span class="ch no" id="w3">tight clothes<i></i></span><span class="ch no" id="w4">anything scented<i></i></span></div></div>
      <div><p class="lab" id="w-labbr">After a Brazilian</p><div class="chips"><span class="ch yes" id="w5">loose cotton</span><span class="ch yes" id="w6">no sex for a day</span></div></div>
    </div>
  </div>
  <div class="two" id="w-two">
    <div class="vs ok" id="v-ok"><div class="patch" id="pt-ok"><i style="left:30%;top:35%"></i><i style="left:62%;top:28%"></i><i style="left:48%;top:66%"></i><i style="left:76%;top:70%"></i></div><div><b>Normal</b><span>Small red bumps for a few hours to a day. They settle on their own.</span></div></div>
    <div class="vs bad" id="v-bad"><div class="patch" id="pt-bad"><i style="left:30%;top:35%"></i><i style="left:62%;top:28%"></i><i style="left:48%;top:66%"></i><i style="left:76%;top:70%"></i><div class="lift"></div></div><div><b>Message Evelyn</b><span>Pus-filled bumps that spread, lifted skin or a burn. Send a photo in daylight.</span></div></div>
  </div>
  <div class="rh" id="w-rh">
    <div class="wk7" id="wk7">${[1, 2, 3, 4, 5, 6, 7].map((d) => `<div class="wd" data-d="${d}"><span class="d">day</span><span class="n">${d}</span><i class="mark m-ex" style="background:#f4c9d6"></i><i class="mark m-mo" style="background:#8fd3ff"></i></div>`).join("")}</div>
    <div class="dial" id="dial"><b><span id="dial-n">4 to 6</span><small>weeks between waxes</small></b></div>
  </div>
  <div class="lg13" id="lg13"><span id="l-ex"><i style="background:#f4c9d6"></i>exfoliate gently, 2 or 3 times a week</span><span id="l-mo"><i style="background:#8fd3ff"></i>moisturized every day</span><span class="warn" id="l-dig">don't dig at an ingrown</span><span id="l-brow">brows, lip and underarms: 3 to 4</span><span class="warn" id="l-shave">shaving in between undoes it</span></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      $("#w-d1").style.display = i === 0 ? "" : "none";
      if (i === 0) {
        enter($("#w-big"), lt, 0.2, { y: 14, s: 0.9 }); enter($("#w-labno"), lt, 0.6, { y: 6 });
        ["w1", "w2", "w3", "w4"].forEach((id, k) => { const el = $("#" + id); enter(el, lt, 0.9 + k * 0.45, { y: 10 }); el.querySelector("i").style.transform = "scaleX(" + E.out(seg(lt, 1.4 + k * 0.45, 1.8 + k * 0.45)) + ")"; });
        enter($("#w-labbr"), lt, 3.4, { y: 6 }); ["w5", "w6"].forEach((id, k) => enter($("#" + id), lt, 3.7 + k * 0.5, { y: 10 }));
        set($("#w-big"), { o: 1, s: 1 + 0.04 * Math.sin(Math.PI * seg(lt, 5.4, 6.3)) });
      }
      // shot 1: two patches; the normal bumps fade over the day, the other ones turn to pus and spread, the skin lifts
      $("#w-two").style.display = i === 1 ? "" : "none";
      if (i === 1) {
        enter($("#v-ok"), lt, 0.3, { y: 12 }); enter($("#v-bad"), lt, 1.2, { y: 12 });
        const fade = E.out(seg(lt, 2.0, 5.0)); $$("#pt-ok i").forEach((d) => { d.style.opacity = 1 - 0.85 * fade; d.style.transform = "scale(" + (1 - 0.4 * fade) + ")"; });
        const grow = E.out(seg(lt, 2.6, 5.4)); $$("#pt-bad i").forEach((d, n) => { d.classList.toggle("pus", grow > 0.3); d.style.transform = "scale(" + (1 + 0.9 * grow) + ")"; });
        $(".lift").style.opacity = E.out(seg(lt, 4.6, 5.4));
      }
      // shot 2: the week with its marks, the dial filling to the next wax
      const rh = i === 2; $("#w-rh").style.display = rh ? "" : "none"; $("#lg13").style.display = rh ? "" : "none";
      if (rh) {
        $$(".wd").forEach((d, k) => enter(d, lt, 0.2 + k * 0.1, { y: 14 }));
        $$(".m-ex").forEach((m) => { const d = +m.parentElement.dataset.d; const on = d === 3 || d === 5 || d === 7; set(m, { o: on ? E.out(seg(lt, 1.2 + d * 0.1, 1.7 + d * 0.1)) : 0 }); });
        $$(".m-mo").forEach((m) => { const d = +m.parentElement.dataset.d; set(m, { o: d >= 2 ? E.out(seg(lt, 2.4 + d * 0.08, 2.9 + d * 0.08)) : 0 }); });
        const dial = $("#dial"); enter(dial, lt, 3.4, { y: 8, s: 0.85 }); dial.style.setProperty("--p", (100 * E.out(seg(lt, 3.8, 5.6))) + "%");
        const lg = (id, at) => enter($("#" + id), lt, at, { y: 8 });
        lg("l-ex", 1.4); lg("l-mo", 2.6); lg("l-dig", 3.2); lg("l-brow", 4.2); lg("l-shave", 5.2);
      }
    }
  },
  "4-1": {
    id: "4-1", kicker: "AHAs, BHAs and PHAs", title: `Three acid families, <span class="grad">three different jobs.</span>`, dur: 22, poster: 10,
    shots: [
      { at: 0, name: "aha", cap: "AHAs (glycolic, lactic, mandelic) work on the surface for glow and even tone. Glycolic is the strongest; mandelic and lactic are gentler." },
      { at: 7, name: "bha", cap: "BHA (salicylic acid) dissolves in oil, so it gets inside the pore. It's the one for blackheads and oily skin." },
      { at: 14, name: "pha", cap: "PHAs (gluconolactone) are the gentlest and suit sensitive skin." },
      { at: 18.5, name: "sun", cap: "Acids make skin more sensitive to the sun. Sunscreen every morning, no exceptions." }
    ],
    css: `
.ac { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5vmin; }
.skin { position: relative; flex: none; width: 86vmin; height: 40vmin; border-radius: 2.4vmin; overflow: hidden; background: linear-gradient(#d9b5a0 0, #d9b5a0 58%, #c98f7a 58%, #b9786b 100%); border: 1px solid rgba(255,255,255,.12); }
.skin .pl { position: absolute; top: 1vmin; width: 5.2vmin; height: 3.4vmin; border-radius: .7vmin; background: #f3dccd; border: 1px solid rgba(0,0,0,.18); box-shadow: 0 .3vmin .6vmin rgba(0,0,0,.12); }
.skin .pore { position: absolute; left: 44%; top: 0; width: 8vmin; height: 26vmin; background: #3a2520; border-radius: 0 0 3.5vmin 3.5vmin; overflow: hidden; }
.skin .oil { position: absolute; left: 1vmin; right: 1vmin; top: 1.2vmin; bottom: 1.4vmin; border-radius: 2.5vmin; background: #e2b08c; }
.skin .plug { position: absolute; left: 1.4vmin; right: 1.4vmin; top: .6vmin; height: 3vmin; border-radius: 1.5vmin; background: #2a1a14; }
.skin .hair { position: absolute; left: 50%; top: -1vmin; width: 1vmin; height: 28vmin; margin-left: -.45vmin; background: #2a1a14; border-radius: 1vmin; }
.skin .drop { position: absolute; width: 7vmin; height: 9.5vmin; opacity: 0; }
.skin .drop::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 7vmin; border-radius: 50%; background: var(--c, #f4c9d6); }
.skin .drop::after { content: ""; position: absolute; left: 50%; top: 0; width: 0; height: 0; margin-left: -3.5vmin; border-left: 3.5vmin solid transparent; border-right: 3.5vmin solid transparent; border-bottom: 4vmin solid var(--c, #f4c9d6); }
.skin .tint { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: radial-gradient(60% 40% at 50% 30%, rgba(143,211,255,.7), rgba(143,211,255,0) 70%); opacity: 0; }
.skin .glow { position: absolute; left: 0; right: 0; top: 0; height: 12vmin; background: linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,0)); opacity: 0; }
.skin .soft { position: absolute; inset: 0; background: radial-gradient(60% 50% at 50% 20%, rgba(244,201,214,.55), rgba(244,201,214,0) 70%); opacity: 0; }
.skin .lbl { position: absolute; left: 2.4vmin; bottom: 1.8vmin; font-size: 2.6vmin; color: rgba(26,18,16,.75); font-weight: 650; letter-spacing: .04em; text-transform: uppercase; }
.fam { display: flex; flex-direction: column; gap: 2vmin; width: 74vmin; }
.fcard { border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.2vmin 2.6vmin; opacity: .35; }
.fcard.on { opacity: 1; border-color: var(--c, #f4c9d6); }
.fcard b { display: flex; align-items: center; gap: 1.4vmin; font-size: 3.8vmin; font-weight: 700; letter-spacing: -.02em; } .fcard b i { width: 2.4vmin; height: 2.4vmin; border-radius: 50%; background: var(--c, #f4c9d6); }
.fcard span { display: block; font-size: 2.7vmin; color: #a1a1a6; margin-top: .6vmin; line-height: 1.35; }
.fcard.on span { color: #f5f5f7; }
.sunrow { display: flex; align-items: center; gap: 2.4vmin; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,210,122,.5); padding: 2vmin 2.6vmin; opacity: 0; }
.sunrow .sun { flex: none; width: 7vmin; height: 7vmin; border-radius: 50%; background: radial-gradient(circle, #ffe9a8, #ffd27a 60%, rgba(255,210,122,0) 62%); box-shadow: 0 0 3vmin rgba(255,210,122,.5); }
.sunrow b { display: block; font-size: 3.4vmin; font-weight: 700; } .sunrow span { display: block; font-size: 2.7vmin; color: #a1a1a6; margin-top: .4vmin; }
@media (orientation: portrait) { .ac { flex-direction: column; gap: 3vmin; } .skin { width: 100%; height: 42vmin; } .fam { width: 100%; } .fcard { padding: 2vmin 2.4vmin; } .fcard b { font-size: 3.2vmin; } .fcard span { font-size: 2.4vmin; } }`,
    html: `
<div class="ac">
  <div class="skin" id="skin">
    ${Array.from({ length: 15 }, (_, k) => `<i class="pl" style="left:calc(1vmin + ${k} * 5.7vmin)"></i>`).join("")}
    <div class="pore"><div class="oil" id="oil"></div><div class="plug" id="plug"></div><div class="tint" id="tint"></div></div><div class="hair"></div>
    <div class="glow" id="glow"></div><div class="soft" id="soft"></div>
    <div class="drop" id="d-aha" style="--c:#f4c9d6; left: 12vmin"></div><div class="drop" id="d-bha" style="--c:#8fd3ff; left: calc(44% + 1vmin)"></div><div class="drop" id="d-pha" style="--c:#c9b6ff; left: 58vmin"></div>
    <span class="lbl" id="skl">the surface, and a pore</span>
  </div>
  <div class="fam">
    <div class="fcard" id="c-aha" style="--c:#f4c9d6"><b><i></i>AHAs</b><span>glycolic (the strongest), lactic, mandelic (gentler) · on the surface: glow and even tone</span></div>
    <div class="fcard" id="c-bha" style="--c:#8fd3ff"><b><i></i>BHA</b><span>salicylic acid · dissolves in oil, so it gets inside the pore · blackheads and oily skin</span></div>
    <div class="fcard" id="c-pha" style="--c:#c9b6ff"><b><i></i>PHAs</b><span>gluconolactone · the gentlest · sensitive skin</span></div>
    <div class="sunrow" id="sunrow"><div class="sun"></div><div><b>Sunscreen every morning</b><span>Acids make skin more sensitive to the sun.</span></div></div>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      set($("#skin"), { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      const fall = (id, at, toY) => { const d = $("#" + id); const p = E.in(seg(lt, at, at + 0.7)); const on = lt >= at && lt < at + 0.75; set(d, { o: on ? 1 : 0, y: -16 + (toY + 16) * p }); return lt >= at + 0.7; };
      // shot 0: the AHA drop lands; the loose plates lift off the surface and a glow is left
      const plates = $$(".pl");
      const ahaDone = i === 0 ? fall("d-aha", 0.8, 0) : (set($("#d-aha"), { o: 0 }), i > 0);
      plates.forEach((pl, k) => { const p = i > 0 ? 1 : i === 0 && lt >= 1.5 ? E.out(seg(lt, 1.5 + (k % 5) * 0.25, 2.6 + (k % 5) * 0.25)) : 0; const lifts = k % 3 !== 1; set(pl, { o: lifts ? 1 - p : 1, y: lifts ? -22 * p : 0, r: lifts ? 30 * p * (k % 2 ? 1 : -1) : 0, s: lifts ? 1 + 0.3 * p : 1 }); });
      const breath = 0.5 + 0.5 * Math.sin(lt * 2.2);
      $("#glow").style.opacity = i > 0 ? 0.5 : E.out(seg(lt, 2.6, 4.0)) * (0.75 + 0.25 * breath);
      // shot 1: the BHA drop sinks down the pore and the oil plug clears
      if (i === 1) { const d = $("#d-bha"); const p = seg(lt, 0.8, 2.6); set(d, { o: lt >= 0.8 && lt < 2.7 ? 1 : 0, y: -16 + 30 * E.in(seg(lt, 0.8, 1.5)) + 60 * seg(lt, 1.5, 2.6), s: 1 - 0.3 * seg(lt, 1.5, 2.6) }); const clear = E.out(seg(lt, 2.4, 4.4)); $("#oil").style.opacity = 1 - clear; $("#plug").style.opacity = 1 - clear; $("#oil").style.transform = "scaleY(" + (1 - 0.6 * clear) + ")"; $("#oil").style.transformOrigin = "50% 100%"; $("#tint").style.opacity = clear * (0.55 + 0.45 * breath); }
      else { set($("#d-bha"), { o: 0 }); const c = i > 1 ? 0 : 1; $("#oil").style.opacity = c; $("#plug").style.opacity = c; $("#oil").style.transform = i > 1 ? "scaleY(.4)" : ""; $("#tint").style.opacity = i > 1 ? 0.5 : 0; }
      // shot 2: the PHA drop spreads into a soft tint, nothing lifts
      if (i === 2) { fall("d-pha", 0.8, 0); $("#soft").style.opacity = E.out(seg(lt, 1.5, 3.2)) * (0.8 + 0.2 * breath); } else { set($("#d-pha"), { o: 0 }); $("#soft").style.opacity = i > 2 ? 1 : 0; }
      // the cards light with their shot; the sun row takes the last one
      [["c-aha", 0], ["c-bha", 1], ["c-pha", 2]].forEach(([id, k]) => { const el = $("#" + id); el.classList.toggle("on", i === k || (i === 3)); if (i === k) enter(el, lt, 0.3, { y: 8, d: 0.5 }); else set(el, { o: i === 3 ? 0.9 : i > k ? 0.55 : 0.3 }); });
      const sun = $("#sunrow"); sun.style.display = i === 3 ? "" : "none"; if (i === 3) enter(sun, lt, 0.3, { y: 10 });
      $("#skl").textContent = i === 0 ? "the surface: loose cells lift" : i === 1 ? "inside the pore: the oil clears" : i === 2 ? "the surface, gently" : "every morning: sunscreen on top";
    }
  },
  "12-3": {
    id: "12-3", kicker: "After a treatment: what's normal, what isn't", title: `Pink and tight is the treatment working. <span class="grad">Spreading and hot is not.</span>`, dur: 22, poster: 9,
    shots: [
      { at: 0, name: "normal", cap: "Normal: pink for a few hours, tightness for a day or two, light flaking on days two to five, a few small bumps after extractions." },
      { at: 7, name: "message", cap: "Message Evelyn: redness that spreads or worsens after the first day, burning that doesn't settle, bumps turning into pus-filled spots. Send a photo in daylight." },
      { at: 13, name: "doctor", cap: "A doctor, today: swelling around the eyes or lips, hives, blistering, pus with heat or fever, a cold sore starting." },
      { at: 19, name: "911", cap: "Trouble breathing or a swelling throat is 911, not a text." }
    ],
    css: `
.lad { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 2.2vmin; }
.rung { position: relative; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.2vmin 3vmin 2.2vmin 4.2vmin; opacity: 0; overflow: hidden; }
.rung::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1.4vmin; background: var(--c); }
.rung .h { display: flex; align-items: center; gap: 1.8vmin; font-size: 4vmin; font-weight: 700; letter-spacing: -.02em; color: var(--c); }
.rung .h small { font-size: 2.6vmin; font-weight: 600; color: #8e8e93; letter-spacing: 0; }
.rung .items { display: flex; flex-wrap: wrap; gap: 1.4vmin; margin-top: 1.8vmin; }
.rung .it { padding: 1.3vmin 2.4vmin; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); font-size: 3vmin; font-weight: 600; color: #f5f5f7; white-space: nowrap; opacity: 0; }
.rung .it.act { background: color-mix(in srgb, var(--c) 18%, transparent); border-color: var(--c); }
.rung.off .items { display: none; } .rung.off { padding-top: 1.6vmin; padding-bottom: 1.6vmin; } .rung.off .h { font-size: 3vmin; }
.rung.hot { border-color: var(--c); box-shadow: 0 0 0 .3vmin color-mix(in srgb, var(--c) 35%, transparent); }
@media (orientation: portrait) { .lad { gap: 2.4vmin; } .rung .h { font-size: 3.8vmin; } .rung .it { font-size: 2.8vmin; } }`,
    html: `
<div class="lad">
  <div class="rung" id="r0" style="--c:#32d74b"><div class="h">Normal <small>the treatment working</small></div><div class="items"><span class="it">pink for a few hours</span><span class="it">tightness for a day or two</span><span class="it">light flaking, days 2 to 5</span><span class="it">a few small bumps after extractions</span></div></div>
  <div class="rung" id="r1" style="--c:#ffd27a"><div class="h">Message Evelyn <small>a photo in daylight</small></div><div class="items"><span class="it">redness that spreads or worsens after day one</span><span class="it">burning that doesn't settle</span><span class="it">bumps turning into pus-filled spots</span><span class="it act">send a photo in daylight</span></div></div>
  <div class="rung" id="r2" style="--c:#ff7a6b"><div class="h">A doctor, today</div><div class="items"><span class="it">swelling around the eyes or lips</span><span class="it">hives</span><span class="it">blistering</span><span class="it">pus with heat or fever</span><span class="it">a cold sore starting</span></div></div>
  <div class="rung" id="r3" style="--c:#ff3b30"><div class="h">911 <small>not a text</small></div><div class="items"><span class="it">trouble breathing</span><span class="it">a swelling throat</span></div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      const rungs = [$("#r0"), $("#r1"), $("#r2"), $("#r3")];
      rungs.forEach((r, k) => {
        const open = k === i;
        r.classList.toggle("off", !open); r.classList.toggle("hot", open && lt > 0.3);
        const b = 0.5 + 0.5 * Math.sin(lt * 2.4); r.style.boxShadow = open && lt > 0.3 ? "0 0 " + (1 + 3 * b) + "vmin " + (0.2 + 0.5 * b) + "vmin color-mix(in srgb, var(--c) 45%, transparent)" : "none";
        // the first shot brings the ladder in rung by rung; later shots keep every rung and open the next one
        if (i === 0) enter(r, lt, 0.2 + k * 0.25, { y: 12 }); else set(r, { o: k > i ? 0.55 : 1 });
        const items = r.querySelectorAll(".it");
        items.forEach((it, n) => { if (open) enter(it, lt, (i === 0 ? 1.4 : 0.5) + n * 0.45, { y: 8, d: 0.5 }); else set(it, { o: 0 }); });
      });
    }
  },
  "3-2": {
    id: "3-2", kicker: "Build your first routine", title: `Three steps, twice a day. <span class="grad">Add the rest one at a time.</span>`, dur: 22, poster: 5,
    shots: [
      { at: 0, name: "routine", cap: "Morning: cleanse (or just rinse, if you're dry), moisturize, sunscreen. Night: cleanse, treat (only once your skin is calm), moisturize." },
      { at: 8, name: "one at a time", cap: "Add one new product at a time and wait two weeks before adding another, so you know what's working and what isn't." },
      { at: 15.5, name: "patch", cap: "Patch test anything new: twice a day on a small spot along the jaw or inner arm, for seven to ten days." }
    ],
    css: `
.fr { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.ampm { display: grid; grid-template-columns: 1fr 1fr; gap: 3vmin; }
.half { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 3.2vmin; opacity: 0; }
.half .t { display: flex; align-items: center; gap: 1.4vmin; font-size: 2.9vmin; font-weight: 650; color: #8e8e93; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 1.6vmin; }
.half .t i { width: 2.4vmin; height: 2.4vmin; border-radius: 50%; } .half.am .t i { background: #ffd27a; box-shadow: 0 0 1.6vmin rgba(255,210,122,.6); } .half.pm .t i { background: #c9b6ff; box-shadow: 0 0 1.6vmin rgba(201,182,255,.5); }
.steps3 { display: flex; flex-direction: column; gap: 1.4vmin; }
.s3 { display: flex; align-items: center; gap: 2vmin; padding: 1.8vmin 2.4vmin; border-radius: 1.6vmin; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); opacity: 0; }
.s3 b { flex: none; width: 5.2vmin; height: 5.2vmin; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.9vmin; font-weight: 700; background: #f4c9d6; color: #1a1210; }
.s3 span { font-size: 3.8vmin; font-weight: 650; } .s3 small { font-size: 2.6vmin; color: #a1a1a6; margin-left: auto; white-space: nowrap; }
.s3.later { border-style: dashed; } .s3.later b { background: rgba(255,255,255,.14); color: #d9d9de; }
.wk2 { display: grid; grid-template-columns: repeat(14, 1fr); gap: .8vmin; }
.dd { position: relative; border-radius: 1.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); min-height: 15vmin; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 1vmin .4vmin .8vmin; gap: .6vmin; opacity: 0; }
.dd .n { font-size: 3.4vmin; font-weight: 700; } .dd .m { width: 3vmin; height: 3vmin; border-radius: 50%; opacity: 0; }
.dd.add { background: #f4c9d6; border-color: #f4c9d6; } .dd.add .n { color: #1a1210; }
.lg32 { display: flex; flex-wrap: wrap; gap: 1.2vmin 1.8vmin; }
.lg32 span { display: inline-flex; align-items: center; gap: 1.2vmin; padding: 1.3vmin 2.4vmin; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16); font-size: 3vmin; font-weight: 600; color: #d9d9de; opacity: 0; }
.lg32 i { width: 2vmin; height: 2vmin; border-radius: 50%; } .lg32 span.rose { border-color: rgba(244,201,214,.6); color: #f4c9d6; }
.patch { display: flex; align-items: center; gap: 4vmin; }
.jaw { position: relative; flex: none; width: 40vmin; height: 40vmin; border-radius: 20vmin 20vmin 16vmin 16vmin / 23vmin 23vmin 17vmin 17vmin; background: #d9b5a0; border: 1px solid rgba(255,255,255,.12); opacity: 0; }
.jaw .sq { position: absolute; left: 18%; top: 64%; width: 9vmin; height: 9vmin; border-radius: 1.4vmin; border: .5vmin dashed #1a1210; background: rgba(255,255,255,.4); opacity: 0; }
.jaw .lip { position: absolute; left: 50%; bottom: 9vmin; width: 12vmin; height: 1.8vmin; margin-left: -6vmin; border-radius: 1vmin; background: #b9786b; }
.jaw .nose { position: absolute; left: 50%; top: 13vmin; width: 4.6vmin; height: 12vmin; margin-left: -2.3vmin; border-radius: 1.8vmin; background: rgba(0,0,0,.08); }
.pt { flex: 1; display: flex; flex-direction: column; gap: 1.6vmin; }
.pt .cnt { font-size: 12vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; opacity: 0; } .pt .cnt small { font-size: 3.4vmin; font-weight: 600; color: #a1a1a6; letter-spacing: 0; margin-left: 1.2vmin; }
.pt .rule { display: inline-flex; align-self: flex-start; padding: 1.5vmin 2.8vmin; border-radius: 999px; background: #111113; border: 1.5px solid rgba(255,255,255,.14); font-size: 3.2vmin; font-weight: 600; opacity: 0; }
.pt .rule.ok { border-color: rgba(50,215,75,.6); color: #7fe39a; } .pt .rule.no { border-color: rgba(255,122,107,.6); color: #ff9a8b; }
@media (orientation: portrait) { .ampm { grid-template-columns: 1fr; gap: 2.4vmin; } .s3 span { font-size: 3.2vmin; } .s3 small { font-size: 2.3vmin; } .wk2 { grid-template-columns: repeat(7, 1fr); } .dd { min-height: 12vmin; } .lg32 span { font-size: 2.7vmin; } .patch { flex-direction: column; gap: 3vmin; } .jaw { width: 40vmin; height: 40vmin; } .pt { align-items: center; } .pt .cnt { font-size: 10vmin; } .pt .rule { align-self: center; font-size: 2.8vmin; } }`,
    html: `
<div class="fr">
  <div class="ampm" id="ampm">
    <div class="half am" id="am"><div class="t"><i></i>Morning</div><div class="steps3"><div class="s3" id="a1"><b>1</b><span>Cleanse</span><small>or just rinse, if you're dry</small></div><div class="s3" id="a2"><b>2</b><span>Moisturize</span></div><div class="s3" id="a3"><b>3</b><span>Sunscreen</span><small>every morning</small></div></div></div>
    <div class="half pm" id="pm"><div class="t"><i></i>Night</div><div class="steps3"><div class="s3" id="p1"><b>1</b><span>Cleanse</span></div><div class="s3 later" id="p2"><b>2</b><span>Treat</span><small>only once your skin is calm</small></div><div class="s3" id="p3"><b>3</b><span>Moisturize</span></div></div></div>
  </div>
  <div class="wk2" id="wk2">${Array.from({ length: 14 }, (_, k) => `<div class="dd" data-d="${k + 1}"><span class="n">${k + 1}</span><i class="m" style="background:#f4c9d6"></i></div>`).join("")}</div>
  <div class="lg32" id="lg32"><span class="rose" id="g-one"><i style="background:#f4c9d6"></i>day 1: one new product</span><span id="g-wait">then two weeks, nothing else new</span><span class="rose" id="g-next">day 15: the next one</span></div>
  <div class="patch" id="patch"><div class="jaw" id="jaw"><div class="nose"></div><div class="lip"></div><div class="sq" id="sq"></div></div><div class="pt"><div class="cnt" id="cnt">0<small>of 7 to 10 days</small></div><span class="rule ok" id="r-ok">twice a day, a small spot on the jaw or inner arm</span><span class="rule no" id="r-no">burning, itching or a rash: it's not for you</span></div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // shot 0: morning and night, three steps each
      $("#ampm").style.display = i === 0 ? "" : "none";
      if (i === 0) {
        enter($("#am"), lt, 0.2, { y: 12 }); enter($("#pm"), lt, 2.8, { y: 12 });
        ["a1", "a2", "a3"].forEach((id, k) => enter($("#" + id), lt, 0.8 + k * 0.55, { y: 8, x: -10 }));
        ["p1", "p2", "p3"].forEach((id, k) => enter($("#" + id), lt, 3.4 + k * 0.55, { y: 8, x: -10 }));
        const b = 0.5 + 0.5 * Math.sin(lt * 2.4); set($("#a3 b"), { s: lt > 2.2 ? 1 + 0.08 * b : 1 });
      }
      // shot 1: fourteen days; day 1 lights as the new product, the wait runs, day 15 is the next
      const two = i === 1; $("#wk2").style.display = two ? "" : "none"; $("#lg32").style.display = two ? "" : "none";
      if (two) {
        $$(".dd").forEach((d, k) => { enter(d, lt, 0.2 + k * 0.07, { y: 10 }); const on = lt >= 1.6 + k * 0.28; d.querySelector(".m").style.opacity = on ? 1 : 0; d.classList.toggle("add", k === 0 && lt >= 1.2); });
        enter($("#g-one"), lt, 1.2, { y: 8 }); enter($("#g-wait"), lt, 2.4, { y: 8 }); enter($("#g-next"), lt, 5.8, { y: 8 });
      }
      // shot 2: the patch square on the jaw, the day counter runs to 10
      $("#patch").style.display = i === 2 ? "" : "none";
      if (i === 2) {
        enter($("#jaw"), lt, 0.2, { y: 12, s: 0.9 }); enter($("#sq"), lt, 0.9, { y: 0, s: 0.6, d: 0.5 });
        const b = 0.5 + 0.5 * Math.sin(lt * 3.2); $("#sq").style.opacity = lt > 1.4 ? 0.7 + 0.3 * b : $("#sq").style.opacity;
        const n = Math.round(10 * E.out(seg(lt, 1.2, 4.6))); $("#cnt").firstChild.textContent = n; enter($("#cnt"), lt, 1.0, { y: 8 });
        enter($("#r-ok"), lt, 2.0, { y: 8 }); enter($("#r-no"), lt, 4.2, { y: 8 });
      }
    }
  },
  "8-1": {
    id: "8-1", kicker: "How acne really forms", title: `Four things going wrong <span class="grad">at once.</span>`, dur: 22, poster: 6,
    shots: [
      { at: 0, name: "four", cap: "The four causes: too much oil, dead cells clogging the pore, acne bacteria, and inflammation. Treat all four and it calms down." },
      { at: 8, name: "kinds", cap: "Blackheads and whiteheads are clogged pores. Red bumps and pus-filled pimples are inflamed ones. Deep, painful cysts and nodules can scar: those need a dermatologist." },
      { at: 15.5, name: "weeks", cap: "Acne starts forming weeks before you see it, which is why results take two to three months." }
    ],
    css: `
.ac8 { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.four { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.4vmin; }
.cause { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.4vmin 2.4vmin 2.2vmin; opacity: 0; }
.cause .ring { position: relative; width: 16vmin; height: 16vmin; margin: 0 auto 1.6vmin; border-radius: 50%; background: conic-gradient(var(--c) 0 var(--p, 0%), rgba(255,255,255,.08) var(--p, 0%) 100%); }
.cause .ring::after { content: ""; position: absolute; inset: 2.2vmin; border-radius: 50%; background: #111113; }
.cause .ring b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 4.4vmin; font-weight: 700; z-index: 1; }
.cause .nm { display: block; text-align: center; font-size: 3vmin; font-weight: 700; } .cause .sub { display: block; text-align: center; font-size: 2.3vmin; color: #a1a1a6; margin-top: .5vmin; line-height: 1.3; }
.calm { display: inline-flex; align-self: center; padding: 1.4vmin 2.8vmin; border-radius: 999px; border: 1.5px solid rgba(50,215,75,.6); color: #7fe39a; font-size: 3vmin; font-weight: 650; opacity: 0; }
.kinds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.4vmin; }
.kind { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.4vmin 2.6vmin; opacity: 0; }
.kind .sk { position: relative; height: 14vmin; border-radius: 1.6vmin; background: #d9b5a0; overflow: hidden; margin-bottom: 1.6vmin; }
.kind .sk i { position: absolute; border-radius: 50%; }
.kind b { display: block; font-size: 3vmin; font-weight: 700; } .kind span { display: block; font-size: 2.3vmin; color: #a1a1a6; margin-top: .5vmin; line-height: 1.3; }
.kind.derm { border-color: rgba(255,122,107,.6); } .kind.derm b { color: #ff9a8b; }
.wk8 { display: flex; align-items: center; gap: 4vmin; }
.res8 { flex: none; font-size: 11vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; opacity: 0; } .res8 small { display: block; font-size: 2.8vmin; font-weight: 600; color: #a1a1a6; letter-spacing: 0; margin-top: 1vmin; }
.tl8 { flex: 1; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.6vmin 3vmin 2.2vmin; display: flex; flex-direction: column; gap: 2.4vmin; opacity: 0; }
.tags8 { display: flex; flex-wrap: wrap; gap: 1.2vmin; }
.tl8 .tag8 { padding: 1vmin 2vmin; border-radius: 999px; background: #1a1a1d; border: 1.5px solid #f4c9d6; color: #f4c9d6; font-size: 2.6vmin; font-weight: 650; white-space: nowrap; opacity: 0; }
.tl8 .tag8.amber { border-color: #e2b08c; color: #e2b08c; }
.line8 { position: relative; height: 9vmin; margin: 0 6vmin; }
.line8 .line { position: absolute; left: 0; right: 0; top: 2vmin; height: .7vmin; background: #2a2a2d; border-radius: 1vmin; }
.line8 .fill { position: absolute; left: 0; top: 2vmin; height: .7vmin; width: 0; background: linear-gradient(90deg, #f4c9d6, #e2b08c); border-radius: 1vmin; }
.line8 .pt { position: absolute; top: 2.35vmin; width: 3vmin; height: 3vmin; margin: -1.5vmin 0 0 -1.5vmin; border-radius: 50%; background: #2a2a2d; border: .5vmin solid #111113; }
.line8 .pt.on { background: #e2b08c; }
.line8 .lb { position: absolute; top: 5.4vmin; font-size: 2.5vmin; color: #a1a1a6; white-space: nowrap; transform: translateX(-50%); font-weight: 600; }
@media (orientation: portrait) { .four { grid-template-columns: 1fr 1fr; } .cause .ring { width: 14vmin; height: 14vmin; } .kinds { grid-template-columns: 1fr; gap: 1.6vmin; } .kind { display: flex; align-items: center; gap: 2.4vmin; padding: 1.8vmin 2.2vmin; } .kind .sk { flex: none; width: 16vmin; height: 12vmin; margin: 0; } .wk8 { flex-direction: column; gap: 3vmin; } .res8 { font-size: 10vmin; text-align: center; } .tl8 { width: 100%; } .line8 { margin: 0 5vmin; } .line8 .lb { font-size: 2.1vmin; } .tl8 .tag8 { font-size: 2.4vmin; } }`,
    html: `
<div class="ac8">
  <div class="four" id="four">
    <div class="cause" id="c1" style="--c:#e2b08c"><div class="ring"><b>1</b></div><b class="nm">Too much oil</b><span class="sub">the pore fills</span></div>
    <div class="cause" id="c2" style="--c:#f1dccf"><div class="ring"><b>2</b></div><b class="nm">Dead cells</b><span class="sub">clog the opening</span></div>
    <div class="cause" id="c3" style="--c:#c9b6ff"><div class="ring"><b>3</b></div><b class="nm">Acne bacteria</b><span class="sub">feed on the mix</span></div>
    <div class="cause" id="c4" style="--c:#ff7a6b"><div class="ring"><b>4</b></div><b class="nm">Inflammation</b><span class="sub">the wall swells</span></div>
  </div>
  <span class="calm" id="calm">treat all four and it calms down</span>
  <div class="kinds" id="kinds">
    <div class="kind" id="k1"><div class="sk"><i style="left:22%;top:38%;width:3vmin;height:3vmin;background:#3a2520"></i><i style="left:58%;top:48%;width:3vmin;height:3vmin;background:#f3e6dc;box-shadow:inset 0 0 0 .4vmin #e5cdbd"></i></div><b>Clogged pores</b><span>blackheads (open) and whiteheads (closed)</span></div>
    <div class="kind" id="k2"><div class="sk"><i style="left:24%;top:30%;width:5vmin;height:5vmin;background:#d7585a"></i><i style="left:56%;top:44%;width:5vmin;height:5vmin;background:#d7585a"></i><i style="left:57.6%;top:47%;width:2.6vmin;height:2.6vmin;background:#f3e2a8"></i></div><b>Inflamed pores</b><span>red bumps and pus-filled pimples</span></div>
    <div class="kind derm" id="k3"><div class="sk"><i style="left:30%;top:22%;width:9vmin;height:9vmin;background:#b23a3f;box-shadow:0 0 0 1.4vmin rgba(215,88,90,.45)"></i></div><b>Cysts and nodules</b><span>deep and painful; they can scar: a dermatologist, not just a facial</span></div>
  </div>
  <div class="wk8" id="wk8"><div class="res8" id="res8">2 to 3<small>months to results</small></div>
  <div class="tl8" id="tl8"><div class="tags8"><span class="tag8" id="t-form">forming under the skin for weeks</span><span class="tag8 amber" id="t-see">what you see today started weeks ago</span><span class="tag8" id="t-res">results: two to three months</span></div>
    <div class="line8"><div class="line"></div><div class="fill" id="fill"></div>${[0, 0.25, 0.5, 0.75, 1].map((p, k) => `<i class="pt" id="pt${k}" style="left:${100 * p}%"></i><span class="lb" style="left:${100 * p}%">${["today", "week 3", "week 6", "week 9", "week 12"][k]}</span>`).join("")}</div>
  </div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // shot 0: four rings fill one after another, then the calm line
      $("#four").style.display = i === 0 ? "" : "none"; $("#calm").style.display = i === 0 ? "" : "none";
      if (i === 0) {
        ["c1", "c2", "c3", "c4"].forEach((id, k) => { const el = $("#" + id); enter(el, lt, 0.2 + k * 0.5, { y: 12 }); el.querySelector(".ring").style.setProperty("--p", (100 * E.out(seg(lt, 0.8 + k * 0.5, 2.0 + k * 0.5))) + "%"); });
        enter($("#calm"), lt, 4.2, { y: 8 });
        const b = 0.5 + 0.5 * Math.sin(lt * 2.6); set($("#c4 .ring"), { s: lt > 3.6 ? 1 + 0.05 * b : 1 });
      }
      // shot 1: the three kinds
      $("#kinds").style.display = i === 1 ? "" : "none";
      if (i === 1) { ["k1", "k2", "k3"].forEach((id, k) => enter($("#" + id), lt, 0.3 + k * 0.9, { y: 12 })); const b = 0.5 + 0.5 * Math.sin(lt * 2.6); set($("#k3 .sk i"), { s: lt > 2.6 ? 1 + 0.06 * b : 1 }); }
      // shot 2: the timeline fills from today to week 12
      $("#wk8").style.display = i === 2 ? "" : "none";
      if (i === 2) {
        enter($("#tl8"), lt, 0.2, { y: 10 }); enter($("#res8"), lt, 3.8, { y: 10, s: 0.8 });
        const p = E.out(seg(lt, 0.8, 4.4)); $("#fill").style.width = (100 * p) + "%";
        [0, 0.25, 0.5, 0.75, 1].forEach((q, k) => $("#pt" + k).classList.toggle("on", p >= q - 0.001));
        enter($("#t-form"), lt, 1.0, { y: 6 }); enter($("#t-see"), lt, 2.4, { y: 6 }); enter($("#t-res"), lt, 4.0, { y: 6 });
      }
    }
  },
  "5-3": {
    id: "5-3", kicker: "The supporting cast", title: `The quiet ingredients <span class="grad">that make the rest work.</span>`, dur: 24, poster: 3,
    shots: [
      { at: 0, name: "niacinamide", cap: "Niacinamide (2 to 5%) calms redness, balances oil and strengthens the barrier. It works well with almost everything." },
      { at: 6, name: "ha", cap: "Hyaluronic acid holds water. Apply it to damp skin and seal it with moisturizer." },
      { at: 12, name: "azelaic", cap: "Azelaic acid calms redness and fades marks, and it's gentle enough for sensitive skin." },
      { at: 18, name: "bpo", cap: "Benzoyl peroxide kills acne bacteria. It bleaches towels and pillowcases, so use white ones." }
    ],
    css: `
.sc { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5vmin; }
.sc .stage5 { position: relative; flex: none; width: 60vmin; height: 44vmin; border-radius: 3vmin; background: #d9b5a0; border: 1px solid rgba(255,255,255,.12); overflow: hidden; opacity: 0; }
.sc .red { position: absolute; border-radius: 50%; background: #d7585a; filter: blur(.8vmin); opacity: 0; }
.sc .oil { position: absolute; border-radius: 50%; background: rgba(255,255,255,.55); opacity: 0; }
.sc .wall { position: absolute; left: 0; right: 0; bottom: 0; height: 6vmin; display: flex; gap: .6vmin; padding: 0 .6vmin; }
.sc .wall i { flex: 1; border-radius: .8vmin .8vmin 0 0; background: #c98f7a; transform-origin: 50% 100%; opacity: 0; }
.sc .wdrop { position: absolute; width: 4.4vmin; height: 4.4vmin; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #8fd3ff; opacity: 0; }
.sc .film { position: absolute; left: 0; right: 0; top: 0; height: 0; background: linear-gradient(rgba(143,211,255,.45), rgba(143,211,255,0)); }
.sc .seal { position: absolute; left: 0; right: 0; top: 0; height: 5vmin; background: linear-gradient(rgba(255,255,255,.7), rgba(255,255,255,0)); opacity: 0; }
.sc .mark { position: absolute; border-radius: 50%; background: #6b3f2e; opacity: 0; }
.sc .bug { position: absolute; width: 2.4vmin; height: 1.4vmin; border-radius: 50%; background: #7c5cff; opacity: 0; }
.sc .towel { position: absolute; left: 50%; top: 50%; width: 30vmin; height: 20vmin; margin: -10vmin 0 0 -15vmin; border-radius: 2vmin; background: #b07aa6; opacity: 0; }
.sc .towel::after { content: ""; position: absolute; inset: 2vmin; border-radius: 1.4vmin; border: .4vmin dashed rgba(255,255,255,.5); }
.sc .towel b { position: absolute; left: 50%; bottom: -5vmin; transform: translateX(-50%); font-size: 2.6vmin; font-weight: 650; color: #1a1210; white-space: nowrap; }
.sc .side5 { display: flex; flex-direction: column; gap: 1.8vmin; width: 70vmin; }
.sc .ing { border-radius: 2.2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2vmin 2.6vmin; opacity: .3; }
.sc .ing.on { opacity: 1; border-color: var(--c); }
.sc .ing b { display: flex; align-items: center; gap: 1.4vmin; font-size: 3.4vmin; font-weight: 700; } .sc .ing b i { width: 2.2vmin; height: 2.2vmin; border-radius: 50%; background: var(--c); }
.sc .ing span { display: block; font-size: 2.5vmin; color: #a1a1a6; margin-top: .5vmin; line-height: 1.35; } .sc .ing.on span { color: #f5f5f7; }
@media (orientation: portrait) { .sc { flex-direction: column; gap: 3vmin; } .sc .stage5 { width: 100%; height: 40vmin; } .sc .side5 { width: 100%; gap: 1.4vmin; } .sc .ing { padding: 1.6vmin 2.2vmin; } .sc .ing b { font-size: 3.1vmin; } .sc .ing span { font-size: 2.4vmin; } }`,
    html: `
<div class="sc">
  <div class="stage5" id="stage5">
    <div class="red" id="rd1" style="left:14%;top:22%;width:14vmin;height:14vmin"></div><div class="red" id="rd2" style="left:58%;top:40%;width:12vmin;height:12vmin"></div>
    <div class="oil" id="ol1" style="left:30%;top:20%;width:7vmin;height:7vmin"></div><div class="oil" id="ol2" style="left:62%;top:14%;width:9vmin;height:9vmin"></div>
    <div class="wall" id="wall">${Array.from({ length: 10 }, () => "<i></i>").join("")}</div>
    <div class="film" id="film"></div><div class="seal" id="seal"></div>
    ${[[18, 30], [40, 20], [62, 36], [30, 58], [68, 60], [50, 46]].map(([x, y], k) => `<div class="wdrop" id="wd${k}" style="left:${x}%;top:${y}%"></div>`).join("")}
    ${[[22, 50, 5], [46, 34, 4], [66, 56, 5.5], [36, 72, 3.6]].map(([x, y, s], k) => `<div class="mark" id="mk${k}" style="left:${x}%;top:${y}%;width:${s}vmin;height:${s}vmin"></div>`).join("")}
    ${[[20, 26], [44, 18], [60, 34], [30, 54], [70, 58], [48, 70], [78, 20]].map(([x, y], k) => `<div class="bug" id="bg${k}" style="left:${x}%;top:${y}%;transform:rotate(${(k * 37) % 90}deg)"></div>`).join("")}
    <div class="towel" id="towel"><b id="towel-b">a colored towel</b></div>
  </div>
  <div class="side5">
    <div class="ing" id="i-nia" style="--c:#7fe39a"><b><i></i>Niacinamide, 2 to 5%</b><span>calms redness, balances oil, strengthens the barrier · plays well with almost everything</span></div>
    <div class="ing" id="i-ha" style="--c:#8fd3ff"><b><i></i>Hyaluronic acid</b><span>holds water · on damp skin, then sealed with moisturizer</span></div>
    <div class="ing" id="i-az" style="--c:#e2b08c"><b><i></i>Azelaic acid</b><span>calms redness and fades marks · gentle enough for sensitive skin</span></div>
    <div class="ing" id="i-bpo" style="--c:#c9b6ff"><b><i></i>Benzoyl peroxide</b><span>kills acne bacteria · bleaches towels and pillowcases: use white ones</span></div>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      set($("#stage5"), { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      const b = 0.5 + 0.5 * Math.sin(lt * 2.4);
      // shot 0: redness fades, oil beads shrink, the barrier wall stands up
      const nia = i === 0; const calm = nia ? E.out(seg(lt, 1.2, 4.0)) : 0;
      [$("#rd1"), $("#rd2")].forEach((r) => { r.style.opacity = nia ? (lt < 0.4 ? E.out(seg(lt, 0, 0.4)) * 0.8 : 0.8 * (1 - calm)) : 0; });
      [$("#ol1"), $("#ol2")].forEach((o, k) => { o.style.opacity = nia ? 0.9 * (1 - calm) : 0; set(o, { s: 1 - 0.5 * calm + (nia ? 0.04 * b : 0) }); });
      $$("#wall i").forEach((w, k) => { const p = nia ? E.back(seg(lt, 2.4 + k * 0.12, 3.2 + k * 0.12)) : 0; set(w, { o: nia ? Math.min(1, p * 2) : 0, s: 1 }); w.style.transform = "scaleY(" + Math.max(0.01, p) + ")"; });
      // shot 1: water drops land on damp skin, a film forms, then the moisturizer seals it
      const ha = i === 1;
      $$(".wdrop").forEach((d, k) => { const p = ha ? E.out(seg(lt, 0.6 + k * 0.3, 1.2 + k * 0.3)) : 0; set(d, { o: ha ? Math.min(1, p * 2) * (1 - 0.4 * seg(lt, 3.6, 4.4)) : 0, y: -10 * (1 - p), r: -45, s: 0.6 + 0.4 * p + (ha ? 0.05 * b : 0) }); });
      $("#film").style.height = ha ? (100 * E.out(seg(lt, 2.0, 3.6))) + "%" : "0";
      $("#seal").style.opacity = ha ? E.out(seg(lt, 3.8, 4.8)) : 0;
      // shot 2: dark marks fade as the azelaic acid works
      const az = i === 2; const fade = az ? E.out(seg(lt, 1.4, 4.6)) : 0;
      $$(".mark").forEach((m) => { m.style.opacity = az ? (lt < 0.5 ? E.out(seg(lt, 0, 0.5)) * 0.85 : 0.85 * (1 - 0.9 * fade)) : 0; set(m, { s: 1 - 0.3 * fade }); });
      if (az) [$("#rd1")].forEach((r) => { r.style.opacity = 0.6 * (1 - fade) * E.out(seg(lt, 0, 0.5)); });
      // shot 3: the bacteria vanish one by one; the towel goes from colored to bleached
      const bp = i === 3;
      $$(".bug").forEach((g, k) => { const gone = bp ? E.in(seg(lt, 1.2 + k * 0.3, 1.7 + k * 0.3)) : 1; g.style.opacity = bp ? E.out(seg(lt, 0, 0.5)) * (1 - gone) : 0; });
      const tw = $("#towel"); if (bp) { enter(tw, lt, 3.4, { y: 10, s: 0.8 }); const bl = E.out(seg(lt, 4.2, 5.4)); tw.style.background = M.lerpColor([176, 122, 166], [245, 240, 236], bl); $("#towel-b").textContent = bl > 0.5 ? "bleached: so use white ones" : "a colored towel"; } else set(tw, { o: 0 });
      // the cards light with their shot
      [["i-nia", 0], ["i-ha", 1], ["i-az", 2], ["i-bpo", 3]].forEach(([id, k]) => { const el = $("#" + id); el.classList.toggle("on", i === k); if (i === k) enter(el, lt, 0.3, { y: 8, d: 0.5 }); else set(el, { o: i > k ? 0.55 : 0.3 }); });
    }
  },
  "9-2": {
    id: "9-2", kicker: "Brighteners that work", title: `Two brighteners beat one. <span class="grad">Sunscreen beats both.</span>`, dur: 23, poster: 5,
    shots: [
      { at: 0, name: "four", cap: "Vitamin C, niacinamide, azelaic acid and tranexamic acid all fade spots in different ways. Two together often work better than one." },
      { at: 7, name: "retinoids", cap: "Retinoids speed up turnover, so pigment leaves faster." },
      { at: 12, name: "rx", cap: "Hydroquinone is prescription-only in the US since 2020, so it's a conversation for your doctor." },
      { at: 16.5, name: "sun", cap: "Nothing works without sunscreen. One unprotected afternoon can undo a month of fading." }
    ],
    css: `
.br { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.four9 { display: flex; flex-wrap: wrap; gap: 1.6vmin; justify-content: center; }
.b9 { display: inline-flex; align-items: center; gap: 1.2vmin; padding: 1.4vmin 2.6vmin; border-radius: 999px; background: #111113; border: 1.5px solid var(--c); color: #f5f5f7; font-size: 3vmin; font-weight: 650; white-space: nowrap; opacity: 0; } .b9 i { width: 2.2vmin; height: 2.2vmin; border-radius: 50%; background: var(--c); }
.race { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4vmin; }
.lane { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.2vmin 2.6vmin; display: flex; align-items: center; gap: 2.6vmin; opacity: 0; }
.lane .pt9 { position: relative; flex: none; width: 18vmin; height: 18vmin; border-radius: 2vmin; background: #d9b5a0; overflow: hidden; }
.lane .pt9 i { position: absolute; left: 50%; top: 50%; width: 9vmin; height: 9vmin; margin: -4.5vmin 0 0 -4.5vmin; border-radius: 50%; background: #6b3f2e; filter: blur(.4vmin); }
.lane b { display: block; font-size: 3.2vmin; font-weight: 700; } .lane span { display: block; font-size: 2.5vmin; color: #a1a1a6; margin-top: .6vmin; }
.lane .bar9 { position: relative; height: 1.6vmin; border-radius: 999px; background: rgba(255,255,255,.08); margin-top: 1.4vmin; overflow: hidden; } .lane .bar9 i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f4c9d6, #e2b08c); }
.lane.two { border-color: rgba(244,201,214,.6); }
.belt { position: relative; height: 24vmin; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); overflow: hidden; opacity: 0; }
.belt .skin9 { position: absolute; left: 0; right: 0; bottom: 0; height: 14vmin; background: linear-gradient(#d9b5a0, #c98f7a); }
.belt .cell { position: absolute; bottom: 6vmin; width: 7vmin; height: 5vmin; border-radius: 1vmin; background: #f3dccd; border: 1px solid rgba(0,0,0,.15); }
.belt .cell.pig { background: #8a5a46; }
.belt .lbl9 { position: absolute; left: 2.4vmin; top: 2vmin; font-size: 2.6vmin; font-weight: 650; color: #f4c9d6; letter-spacing: .04em; text-transform: uppercase; }
.belt .spd { position: absolute; right: 2.4vmin; top: 2vmin; font-size: 2.6vmin; font-weight: 650; color: #a1a1a6; }
.rx { display: flex; align-items: center; gap: 3vmin; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 3.2vmin; opacity: 0; }
.rx .pad { flex: none; width: 16vmin; height: 20vmin; border-radius: 1.6vmin; background: #f5f0ec; color: #1a1210; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1vmin; }
.rx .pad b { font-size: 6vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; } .rx .pad span { font-size: 2vmin; font-weight: 650; text-align: center; line-height: 1.2; }
.rx h3 { font-size: 3.6vmin; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; } .rx p { font-size: 2.6vmin; color: #a1a1a6; margin-top: 1vmin; line-height: 1.35; }
.month { position: relative; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 3.2vmin 3.4vmin; opacity: 0; }
.month .row { display: flex; align-items: center; gap: 2.6vmin; }
.month .pt9 { position: relative; flex: none; width: 16vmin; height: 16vmin; border-radius: 2vmin; background: #d9b5a0; overflow: hidden; } .month .pt9 i { position: absolute; left: 50%; top: 50%; width: 8vmin; height: 8vmin; margin: -4vmin 0 0 -4vmin; border-radius: 50%; background: #6b3f2e; filter: blur(.4vmin); }
.month .track { flex: 1; } .month .track b { display: block; font-size: 3vmin; font-weight: 700; margin-bottom: 1.2vmin; }
.month .bar9 { position: relative; height: 2.2vmin; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; } .month .bar9 i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f4c9d6, #e2b08c); }
.month .days { display: flex; justify-content: space-between; margin-top: .8vmin; font-size: 2.2vmin; color: #8e8e93; font-weight: 600; }
.month .sun9 { position: absolute; right: 3vmin; top: -3vmin; width: 9vmin; height: 9vmin; border-radius: 50%; background: radial-gradient(circle, #ffe9a8, #ffd27a 60%, rgba(255,210,122,0) 62%); box-shadow: 0 0 4vmin rgba(255,210,122,.6); opacity: 0; }
.month .undo { position: absolute; left: 50%; bottom: -2.6vmin; transform: translateX(-50%); padding: 1vmin 2.2vmin; border-radius: 999px; background: #1a1a1d; border: 1.5px solid #ff7a6b; color: #ff9a8b; font-size: 2.6vmin; font-weight: 650; white-space: nowrap; opacity: 0; }
@media (orientation: portrait) { .b9 { font-size: 2.7vmin; } .race { grid-template-columns: 1fr; } .lane .pt9 { width: 15vmin; height: 15vmin; } .belt { height: 26vmin; } .rx { flex-direction: column; text-align: center; } .rx h3 { font-size: 3.3vmin; } .month .pt9 { width: 14vmin; height: 14vmin; } .month .undo { font-size: 2.3vmin; } }`,
    html: `
<div class="br">
  <div class="four9" id="four9"><span class="b9" style="--c:#e2b08c" id="b-c"><i></i>vitamin C</span><span class="b9" style="--c:#7fe39a" id="b-n"><i></i>niacinamide</span><span class="b9" style="--c:#f4c9d6" id="b-a"><i></i>azelaic acid</span><span class="b9" style="--c:#8fd3ff" id="b-t"><i></i>tranexamic acid</span></div>
  <div class="race" id="race">
    <div class="lane" id="l1"><div class="pt9"><i id="sp1"></i></div><div style="flex:1"><b>One brightener</b><span>fades, slowly</span><div class="bar9"><i id="br1"></i></div></div></div>
    <div class="lane two" id="l2"><div class="pt9"><i id="sp2"></i></div><div style="flex:1"><b>Two together</b><span>different routes, faster</span><div class="bar9"><i id="br2"></i></div></div></div>
  </div>
  <div class="belt" id="belt"><span class="lbl9">turnover</span><span class="spd" id="spd">normal speed</span><div class="skin9"></div>${Array.from({ length: 12 }, (_, k) => `<div class="cell${k % 4 === 1 ? " pig" : ""}" id="cl${k}"></div>`).join("")}</div>
  <div class="rx" id="rx"><div class="pad"><b>Rx</b><span>hydroquinone<br>US, since 2020</span></div><div><h3>Prescription only</h3><p>So it's a conversation for your doctor, not a bottle off a shelf.</p></div></div>
  <div class="month" id="month"><div class="sun9" id="sun9"></div><div class="row"><div class="pt9"><i id="sp3"></i></div><div class="track"><b id="mb">A month of fading</b><div class="bar9"><i id="br3"></i></div><div class="days"><span>day 1</span><span>day 30</span></div></div></div><span class="undo" id="undo">one unprotected afternoon</span></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      const b = 0.5 + 0.5 * Math.sin(lt * 2.4);
      // shot 0: four chips, then the race: one brightener against two
      $("#four9").style.display = i === 0 ? "" : "none"; $("#race").style.display = i === 0 ? "" : "none";
      if (i === 0) {
        ["b-c", "b-n", "b-a", "b-t"].forEach((id, k) => enter($("#" + id), lt, 0.2 + k * 0.35, { y: 8 }));
        enter($("#l1"), lt, 1.8, { y: 12 }); enter($("#l2"), lt, 2.2, { y: 12 });
        const p1 = E.out(seg(lt, 2.6, 6.6)) * 0.45, p2 = E.out(seg(lt, 2.8, 6.0));
        $("#br1").style.width = (100 * p1) + "%"; $("#br2").style.width = (100 * p2) + "%";
        $("#sp1").style.opacity = 1 - 0.5 * p1; $("#sp2").style.opacity = 1 - 0.92 * p2;
      }
      // shot 1: the belt; cells slide off faster, the pigmented ones with them
      $("#belt").style.display = i === 1 ? "" : "none";
      if (i === 1) {
        enter($("#belt"), lt, 0.2, { y: 10 });
        const fast = seg(lt, 1.6, 2.6); const speed = 6 + 18 * fast; const off = (lt * speed) % 9;
        $$(".cell").forEach((c, k) => { const x = (k * 9 - off + 9) % 108 - 9; c.style.left = x + "vmin"; c.style.opacity = x < -2 || x > 100 ? 0 : 1; });
        $("#spd").textContent = fast < 0.5 ? "normal speed" : "with a retinoid: faster"; $("#spd").style.color = fast < 0.5 ? "#a1a1a6" : "#f4c9d6";
      }
      // shot 2: the prescription pad
      $("#rx").style.display = i === 2 ? "" : "none"; if (i === 2) { enter($("#rx"), lt, 0.2, { y: 10 }); set($("#rx .pad"), { s: 1 + 0.03 * b, r: -3 }); }
      // shot 3: a month of fading, then one unprotected afternoon undoes it
      $("#month").style.display = i === 3 ? "" : "none";
      if (i === 3) {
        enter($("#month"), lt, 0.2, { y: 10 });
        const fade = E.out(seg(lt, 0.8, 3.4)); const undo = E.in(seg(lt, 4.2, 5.2));
        const p = fade * (1 - undo); $("#br3").style.width = (100 * p) + "%"; $("#sp3").style.opacity = 1 - 0.85 * p;
        enter($("#sun9"), lt, 3.8, { y: 6, s: 0.6 }); enter($("#undo"), lt, 4.4, { y: 6 });
        $("#mb").textContent = undo > 0.5 ? "Back to day one" : "A month of fading";
      }
    }
  },
  "11-2": {
    id: "11-2", kicker: "Pregnancy and breastfeeding", title: `What to pause, what's commonly fine, <span class="grad">and the one rule.</span>`, dur: 21, poster: 8,
    shots: [
      { at: 0, name: "pause", cap: "Pause retinoids of every kind, including retinol, and skip high-strength salicylic peels." },
      { at: 6, name: "fine", cap: "Commonly considered fine: azelaic acid, vitamin C, niacinamide, gentle lactic acid and mineral sunscreen." },
      { at: 12, name: "melasma", cap: "Melasma often shows up in pregnancy. Tinted mineral sunscreen is your best friend." },
      { at: 16.5, name: "tell", cap: "Tell your esthetician every time; some treatments change when you're pregnant. And the one rule: ask your doctor." }
    ],
    css: `
.pg { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 3vmin; }
.col { border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.6vmin 2.8vmin; opacity: 0; }
.col .t { display: flex; align-items: center; gap: 1.4vmin; font-size: 3.2vmin; font-weight: 700; margin-bottom: 1.8vmin; } .col.no .t { color: #ff9a8b; } .col.ok .t { color: #7fe39a; }
.col .t i { width: 3.2vmin; height: 3.2vmin; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2.2vmin; font-weight: 800; color: #1a1210; } .col.no .t i { background: #ff7a6b; } .col.ok .t i { background: #32d74b; }
.col .list { display: flex; flex-wrap: wrap; gap: 1.2vmin; }
.col .li { position: relative; padding: 1.3vmin 2.2vmin; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); font-size: 2.8vmin; font-weight: 600; white-space: nowrap; opacity: 0; }
.col.no .li i { position: absolute; left: 1.4vmin; right: 1.4vmin; top: 50%; height: .35vmin; background: #ff7a6b; border-radius: 1vmin; transform-origin: 0 50%; transform: scaleX(0); }
.col.dim { opacity: .4 !important; }
.mel { display: flex; align-items: center; gap: 4vmin; }
.mel .face11 { position: relative; flex: none; width: 34vmin; height: 42vmin; border-radius: 17vmin 17vmin 14vmin 14vmin / 19vmin 19vmin 15vmin 15vmin; background: #d9b5a0; border: 1px solid rgba(255,255,255,.12); opacity: 0; overflow: hidden; }
.mel .face11 .nose { position: absolute; left: 50%; top: 15vmin; width: 4vmin; height: 10vmin; margin-left: -2vmin; border-radius: 2vmin; background: rgba(0,0,0,.08); }
.mel .face11 .lip { position: absolute; left: 50%; bottom: 8vmin; width: 10vmin; height: 1.6vmin; margin-left: -5vmin; border-radius: 1vmin; background: #b9786b; }
.mel .face11 i { position: absolute; border-radius: 50%; background: #6b3f2e; filter: blur(.6vmin); opacity: 0; }
.mel .face11 .tint { position: absolute; inset: 0; background: linear-gradient(rgba(226,176,140,.0), rgba(226,176,140,.0)); opacity: 0; }
.mel .face11 .tint.on { background: linear-gradient(rgba(240,200,170,.55), rgba(240,200,170,.55)); }
.mel .side11 { display: flex; flex-direction: column; gap: 1.8vmin; }
.mel .pill11 { display: inline-flex; align-self: flex-start; padding: 1.4vmin 2.6vmin; border-radius: 999px; background: #111113; border: 1.5px solid rgba(255,255,255,.14); font-size: 3vmin; font-weight: 650; opacity: 0; }
.mel .pill11.rose { border-color: rgba(244,201,214,.6); color: #f4c9d6; } .mel .pill11.amber { border-color: rgba(255,210,122,.6); color: #ffd27a; }
.rule11 { display: flex; align-items: center; gap: 3vmin; }
.rule11 .card11 { flex: 1; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 3vmin 3.2vmin; opacity: 0; }
.rule11 .card11 b { display: block; font-size: 3.6vmin; font-weight: 700; letter-spacing: -.02em; } .rule11 .card11 span { display: block; font-size: 2.6vmin; color: #a1a1a6; margin-top: .8vmin; line-height: 1.35; }
.rule11 .card11.doc { border-color: #f4c9d6; background: #f4c9d6; } .rule11 .card11.doc b, .rule11 .card11.doc span { color: #1a1210; }
@media (orientation: portrait) { .cols { grid-template-columns: 1fr; } .col .li { font-size: 2.6vmin; } .mel { flex-direction: column; gap: 3vmin; } .mel .face11 { width: 36vmin; height: 44vmin; } .mel .side11 { align-items: center; } .mel .pill11 { align-self: center; font-size: 2.7vmin; } .rule11 { flex-direction: column; } .rule11 .card11 { width: 100%; } }`,
    html: `
<div class="pg">
  <div class="cols" id="cols">
    <div class="col no" id="c-no"><div class="t"><i>–</i>Pause</div><div class="list"><span class="li" id="n1">retinoids, every kind<i></i></span><span class="li" id="n2">retinol too<i></i></span><span class="li" id="n3">high-strength salicylic peels<i></i></span></div></div>
    <div class="col ok" id="c-ok"><div class="t"><i>✓</i>Commonly considered fine</div><div class="list"><span class="li" id="o1">azelaic acid</span><span class="li" id="o2">vitamin C</span><span class="li" id="o3">niacinamide</span><span class="li" id="o4">gentle lactic acid</span><span class="li" id="o5">mineral sunscreen</span></div></div>
  </div>
  <div class="mel" id="mel"><div class="face11" id="face11"><div class="nose"></div><div class="lip"></div><i style="left:12%;top:40%;width:32%;height:20%"></i><i style="left:58%;top:40%;width:32%;height:20%"></i><i style="left:34%;top:70%;width:32%;height:8%"></i><div class="tint" id="tint11"></div></div><div class="side11"><span class="pill11 rose" id="m1">melasma often shows up in pregnancy</span><span class="pill11 amber" id="m2">tinted mineral sunscreen, every morning</span></div></div>
  <div class="rule11" id="rule11"><div class="card11" id="r-tell"><b>Tell your esthetician, every time</b><span>Some treatments change when you're pregnant or breastfeeding.</span></div><div class="card11 doc" id="r-doc"><b>The one rule: ask your doctor</b><span>Anything on this list is a conversation with them first.</span></div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      const b = 0.5 + 0.5 * Math.sin(lt * 2.4);
      // shots 0 and 1: the two columns; pause first with its strikes, then the fine list
      const cols = i <= 1; $("#cols").style.display = cols ? "" : "none";
      if (cols) {
        const slt = i === 0 ? lt : lt + 6;
        enter($("#c-no"), slt, 0.2, { y: 12 }); $("#c-no").classList.toggle("dim", i === 1 && lt > 0.3);
        ["n1", "n2", "n3"].forEach((id, k) => { const el = $("#" + id); enter(el, slt, 0.8 + k * 0.5, { y: 8 }); el.querySelector("i").style.transform = "scaleX(" + E.out(seg(slt, 1.3 + k * 0.5, 1.7 + k * 0.5)) + ")"; });
        if (i === 1) { enter($("#c-ok"), lt, 0.2, { y: 12 }); ["o1", "o2", "o3", "o4", "o5"].forEach((id, k) => enter($("#" + id), lt, 0.8 + k * 0.4, { y: 8 })); } else { set($("#c-ok"), { o: 0.25 }); ["o1", "o2", "o3", "o4", "o5"].forEach((id) => set($("#" + id), { o: 0 })); }
        set($("#c-no"), { o: i === 1 && lt > 0.3 ? 0.4 : Math.min(1, seg(slt, 0.2, 0.8) * 1.5), s: i === 0 && lt > 3 ? 1 + 0.01 * b : 1 });
      }
      // shot 2: the melasma patches rise on the face, then the tinted sunscreen veils them
      $("#mel").style.display = i === 2 ? "" : "none";
      if (i === 2) {
        enter($("#face11"), lt, 0.2, { y: 12, s: 0.9 });
        $$("#face11 i").forEach((m, k) => { m.style.opacity = 0.85 * E.out(seg(lt, 0.8 + k * 0.3, 1.6 + k * 0.3)); });
        const veil = E.out(seg(lt, 2.8, 3.8)); const tint = $("#tint11"); tint.classList.toggle("on", veil > 0); tint.style.opacity = veil * (0.9 + 0.1 * b);
        enter($("#m1"), lt, 1.0, { y: 8 }); enter($("#m2"), lt, 2.8, { y: 8 });
      }
      // shot 3: tell her, and the one rule
      $("#rule11").style.display = i === 3 ? "" : "none";
      if (i === 3) { enter($("#r-tell"), lt, 0.2, { y: 12 }); enter($("#r-doc"), lt, 1.6, { y: 12, s: 0.9 }); set($("#r-doc"), { o: Math.min(1, seg(lt, 1.6, 2.2) * 2.5), s: lt > 2.2 ? 1 + 0.015 * b : 0.9 + 0.1 * E.out(seg(lt, 1.6, 2.2)) }); }
    }
  },
  "7-1": {
    id: "7-1", kicker: "The Sunday ritual", title: `Twenty minutes, <span class="grad">once a week.</span>`, dur: 22, poster: 9,
    shots: [
      { at: 0, name: "cleanse", cap: "Double cleanse, then steam gently with a warm towel for one minute. Skip the steam if you have redness or rosacea." },
      { at: 6.5, name: "mask", cap: "Exfoliate (only if it isn't already an acid night), then a mask for your skin: clay for oily, cream or gel for dry." },
      { at: 13, name: "massage", cap: "Massage while the serum goes on, then moisturize." },
      { at: 17.5, name: "no", cap: "No extractions at home. That's what the treatment room is for." }
    ],
    css: `
.sr { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 5vmin; }
.clock20 { position: relative; flex: none; width: 36vmin; height: 36vmin; border-radius: 50%; background: conic-gradient(#f4c9d6 0 var(--p, 0%), rgba(255,255,255,.08) var(--p, 0%) 100%); opacity: 0; }
.clock20::after { content: ""; position: absolute; inset: 3.2vmin; border-radius: 50%; background: #0d0d0f; }
.clock20 b { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1; font-size: 9vmin; font-weight: 700; letter-spacing: -.04em; line-height: 1; } .clock20 b small { font-size: 2.6vmin; font-weight: 600; color: #a1a1a6; letter-spacing: 0; margin-top: .8vmin; }
.steps7 { display: flex; flex-direction: column; gap: 1.4vmin; width: 84vmin; }
.st7 { display: flex; align-items: center; gap: 2vmin; padding: 1.6vmin 2.4vmin; border-radius: 1.8vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); opacity: 0; }
.st7 .min { flex: none; width: 9vmin; font-size: 2.4vmin; font-weight: 700; color: #f4c9d6; letter-spacing: .02em; }
.st7 .nm { font-size: 3.2vmin; font-weight: 650; } .st7 .nt { font-size: 2.3vmin; color: #a1a1a6; margin-left: auto; white-space: nowrap; }
.st7.on { border-color: #f4c9d6; } .st7.done { opacity: .55 !important; }
.st7.skip .nt { color: #ff9a8b; }
.st7.no { border-color: rgba(255,122,107,.7); background: rgba(255,122,107,.08); } .st7.no .min { color: #ff7a6b; } .st7.no .nm { color: #ff9a8b; }
.st7 .nm s { text-decoration-color: #ff7a6b; text-decoration-thickness: .4vmin; }
.pick { display: flex; gap: 1.2vmin; margin-left: 1.6vmin; } .pick span { padding: .7vmin 1.6vmin; border-radius: 999px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); font-size: 2.2vmin; font-weight: 600; color: #d9d9de; white-space: nowrap; }
@media (orientation: portrait) { .sr { flex-direction: column; gap: 3vmin; } .clock20 { width: 30vmin; height: 30vmin; } .clock20 b { font-size: 7.5vmin; } .steps7 { width: 100%; } .st7 { padding: 1.4vmin 2vmin; gap: 1.4vmin; flex-wrap: wrap; } .st7 .min { width: 7vmin; font-size: 2.1vmin; } .st7 .nm { font-size: 2.8vmin; } .st7 .nt { font-size: 2.1vmin; } .pick { margin-left: 0; width: 100%; } }`,
    html: `
<div class="sr">
  <div class="clock20" id="clock20"><b><span id="mins20">0</span><small>of 20 minutes</small></b></div>
  <div class="steps7">
    <div class="st7" id="s1"><span class="min">0–4</span><span class="nm">Double cleanse</span><span class="nt">balm or oil, then foam</span></div>
    <div class="st7 skip" id="s2"><span class="min">4–5</span><span class="nm">Warm-towel steam</span><span class="nt">one minute · skip it with redness or rosacea</span></div>
    <div class="st7" id="s3"><span class="min">5–8</span><span class="nm">Exfoliate</span><span class="nt">only if it isn't an acid night</span></div>
    <div class="st7" id="s4"><span class="min">8–15</span><span class="nm">Mask</span><span class="pick" id="pick"><span>clay · oily</span><span>cream or gel · dry</span></span></div>
    <div class="st7" id="s5"><span class="min">15–19</span><span class="nm">Massage with the serum</span><span class="nt">slip, center outward, light</span></div>
    <div class="st7" id="s6"><span class="min">19–20</span><span class="nm">Moisturize</span><span class="nt">done</span></div>
    <div class="st7 no" id="s7"><span class="min">never</span><span class="nm"><s>Extractions</s> at home</span><span class="nt">that's what the treatment room is for</span></div>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // the clock fills shot by shot: 0-5 min, 5-15, 15-20, then holds
      const target = i === 0 ? 5 * E.out(seg(lt, 0.8, 5.5)) : i === 1 ? 5 + 10 * E.out(seg(lt, 0.6, 5.5)) : i === 2 ? 15 + 5 * E.out(seg(lt, 0.6, 3.6)) : 20;
      const clock = $("#clock20"); set(clock, { o: Math.min(1, seg(t, 0, 0.6) * 1.5), s: 0.9 + 0.1 * E.out(seg(t, 0, 0.6)) }); clock.style.setProperty("--p", (100 * target / 20) + "%"); $("#mins20").textContent = Math.round(target);
      // the steps belong to shots: 1-2 in shot 0, 3-4 in shot 1, 5-6 in shot 2, 7 in shot 3
      const own = { s1: 0, s2: 0, s3: 1, s4: 1, s5: 2, s6: 2, s7: 3 }, at = { s1: 0.3, s2: 2.6, s3: 0.3, s4: 2.4, s5: 0.3, s6: 2.0, s7: 0.4 };
      Object.keys(own).forEach((id) => {
        const el = $("#" + id), k = own[id];
        if (k === i) { enter(el, lt, at[id], { y: 10, x: -12 }); el.classList.toggle("on", lt >= at[id]); el.classList.remove("done"); }
        else if (k < i) { set(el, { o: 1 }); el.classList.remove("on"); el.classList.add("done"); }
        else { set(el, { o: 0 }); el.classList.remove("on", "done"); }
      });
      // the last step is the only one on the screen's attention in the final shot: it pulses
      if (i === 3) { const b = 0.5 + 0.5 * Math.sin(lt * 2.6); set($("#s7"), { o: Math.min(1, seg(lt, 0.4, 1.0) * 2.5), x: -12 * (1 - E.out(seg(lt, 0.4, 1.0))), s: lt > 1 ? 1 + 0.012 * b : 1 }); }
    }
  },
  "7-3": {
    id: "7-3", kicker: "Skin through the seasons", title: `The Valley has more weather <span class="grad">than people think.</span>`, dur: 22, poster: 3,
    shots: [
      { at: 0, name: "summer", cap: "Hot summers: a lighter gel moisturizer, sunscreen reapplied more often, and blotting papers instead of more powder." },
      { at: 6, name: "winter", cap: "Santa Ana winds and dry winters: a richer moisturizer, fewer acid nights, and a humidifier by the bed." },
      { at: 12, name: "travel", cap: "Travel and flights: skip new actives, and pack your barrier basics." },
      { at: 17, name: "check", cap: "Plan a skin check with Evelyn at every change of season." }
    ],
    css: `
.se { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 3vmin; }
.ring { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2vmin; }
.season { position: relative; border-radius: 2.4vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.4vmin 2.4vmin 2.2vmin; opacity: .35; overflow: hidden; }
.season.on { opacity: 1; border-color: var(--c); }
.season .ico { position: relative; width: 12vmin; height: 12vmin; margin: 0 auto 1.6vmin; border-radius: 50%; }
.season.sum .ico { background: radial-gradient(circle, #ffe9a8, #ffd27a 55%, rgba(255,210,122,0) 58%); box-shadow: 0 0 3vmin rgba(255,210,122,.5); }
.season.win .ico { background: radial-gradient(circle, #e8f1ff, #8fd3ff 55%, rgba(143,211,255,0) 58%); }
.season.win .ico i { position: absolute; left: -4vmin; top: 50%; width: 20vmin; height: .5vmin; margin-top: -.25vmin; border-radius: 1vmin; background: rgba(255,255,255,.55); transform-origin: 0 50%; }
.season.tra .ico { background: #1a1a1d; border: .4vmin solid #c9b6ff; } .season.tra .ico i { position: absolute; left: 50%; top: 50%; width: 7vmin; height: 2.2vmin; margin: -1.1vmin 0 0 -3.5vmin; border-radius: 1.1vmin 2vmin 2vmin 1.1vmin; background: #c9b6ff; }
.season.chk .ico { background: #f4c9d6; } .season.chk .ico b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 5vmin; color: #1a1210; }
.season .nm { display: block; text-align: center; font-size: 3.2vmin; font-weight: 700; }
.season .tips { display: flex; flex-direction: column; gap: .8vmin; margin-top: 1.4vmin; }
.season .tip { padding: 1vmin 1.6vmin; border-radius: 1.2vmin; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); font-size: 2.4vmin; font-weight: 600; line-height: 1.25; opacity: 0; }
.season.on .tip.swap { border-color: var(--c); }
@media (orientation: portrait) { .ring { grid-template-columns: 1fr 1fr; } .season .ico { width: 10vmin; height: 10vmin; } .season .nm { font-size: 2.9vmin; } .season .tip { font-size: 2.2vmin; } }`,
    html: `
<div class="se">
  <div class="ring" id="ring">
    <div class="season sum" id="q0" style="--c:#ffd27a"><div class="ico"></div><b class="nm">Hot summer</b><div class="tips"><span class="tip swap">lighter gel moisturizer</span><span class="tip">sunscreen reapplied more often</span><span class="tip">blotting papers, not more powder</span></div></div>
    <div class="season win" id="q1" style="--c:#8fd3ff"><div class="ico"><i></i><i style="top:35%"></i><i style="top:65%"></i></div><b class="nm">Santa Anas and dry winter</b><div class="tips"><span class="tip swap">richer moisturizer</span><span class="tip">fewer acid nights</span><span class="tip">a humidifier by the bed</span></div></div>
    <div class="season tra" id="q2" style="--c:#c9b6ff"><div class="ico"><i></i></div><b class="nm">Travel and flights</b><div class="tips"><span class="tip">skip new actives</span><span class="tip swap">pack the barrier basics</span></div></div>
    <div class="season chk" id="q3" style="--c:#f4c9d6"><div class="ico"><b>✦</b></div><b class="nm">Every change of season</b><div class="tips"><span class="tip swap">a skin check with Evelyn</span><span class="tip">the routine shifts with the weather</span></div></div>
  </div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      const b = 0.5 + 0.5 * Math.sin(lt * 2.4);
      [0, 1, 2, 3].forEach((k) => {
        const q = $("#q" + k); const on = k === i;
        q.classList.toggle("on", on);
        if (i === 0) enter(q, lt, 0.2 + k * 0.3, { y: 12 }); else set(q, { o: on ? 1 : k < i ? 0.55 : 0.35, s: on && lt > 0.6 ? 1 + 0.01 * b : 1 });
        q.querySelectorAll(".tip").forEach((tp, n) => { if (on) enter(tp, lt, (i === 0 ? 1.6 : 0.6) + n * 0.6, { y: 8 }); else set(tp, { o: k < i ? 0.8 : 0 }); });
      });
      // the sun pulses, the wind blows, the plane flies, the check mark breathes
      set($("#q0 .ico"), { s: i === 0 ? 1 + 0.08 * b : 1 });
      $$("#q1 .ico i").forEach((w, n) => { const p = i === 1 ? ((lt * 0.9 + n * 0.33) % 1) : 0.5; w.style.transform = "translateX(" + (-6 + 14 * p) + "vmin) scaleX(" + (0.4 + 0.6 * Math.sin(Math.PI * p)) + ")"; w.style.opacity = i === 1 ? Math.sin(Math.PI * p) : 0.35; });
      set($("#q2 .ico i"), { x: i === 2 ? -10 + 20 * ((lt * 0.35) % 1) : 0, y: i === 2 ? -3 * Math.sin(((lt * 0.35) % 1) * Math.PI) : 0 });
      set($("#q3 .ico"), { s: i === 3 ? 1 + 0.08 * b : 1, r: i === 3 ? 10 * b : 0 });
    }
  },
  "13-1": {
    id: "13-1", kicker: "Before a wax: length, shaving, timing", title: `A quarter inch: <span class="grad">a grain of rice.</span>`, dur: 20, poster: 4,
    shots: [
      { at: 0, name: "length", cap: "The wax needs something to grip: about a quarter inch of hair, a grain of rice. Too short and it can't; very long can be trimmed, never shorter." },
      { at: 7, name: "timing", cap: "That's about two to three weeks after shaving, four to six after a wax. Book from there; brows, lip and underarms every three to four." },
      { at: 14, name: "shave", cap: "No shaving between waxes: it resets the growth and makes the next one patchier. Exfoliate gently in the days before, nothing scented that morning." }
    ],
    css: `
.wx { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 4vmin; }
.ruler { position: relative; height: 24vmin; border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); overflow: hidden; }
.ruler .line { position: absolute; left: 6vmin; right: 6vmin; top: 12.8vmin; height: .6vmin; background: #2a2a2d; border-radius: 1vmin; }
.ruler .tk { position: absolute; top: 9.6vmin; width: .4vmin; height: 3.8vmin; background: #6e6e73; }
.ruler .tl { position: absolute; top: 14.6vmin; font-size: 2.7vmin; color: #8e8e93; transform: translateX(-50%); }
.ruler .hair { position: absolute; left: 6vmin; top: 5.4vmin; height: 5vmin; width: 0; border-radius: 1vmin; background: linear-gradient(90deg, #f4c9d6, #e2b08c); }
.ruler .rice { position: absolute; top: 1.6vmin; padding: .7vmin 1.6vmin; border-radius: 999px; background: #e2b08c; color: #1a1210; font-size: 2.5vmin; font-weight: 700; white-space: nowrap; transform: translateX(-50%); opacity: 0; }
.ruler .zone { position: absolute; top: 4.4vmin; height: 7vmin; border-radius: 1vmin; border: .3vmin solid #eab9c8; background: rgba(244,201,214,.18); opacity: 0; }
.ruler .zl { position: absolute; top: 18.8vmin; left: calc(6vmin + 1.32 * 22%); font-size: 2.7vmin; font-weight: 650; color: #f4c9d6; white-space: nowrap; opacity: 0; }
.ruler .hint { position: absolute; font-size: 2.3vmin; color: #8e8e93; white-space: nowrap; opacity: 0; } .ruler .hint.lo { left: 6vmin; top: 18.9vmin; } .ruler .hint.hi { right: 6vmin; top: 18.9vmin; }
.tl3 { display: grid; grid-template-columns: 1fr 1fr; gap: 2vmin; }
.wk { border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.8vmin 3vmin; opacity: 0; }
.wk b { display: block; font-size: 4.6vmin; font-weight: 700; letter-spacing: -.02em; line-height: 1.05; } .wk span { display: block; font-size: 2.7vmin; color: #a1a1a6; margin-top: 1vmin; line-height: 1.35; }
.wk .bar { position: relative; height: 1.8vmin; border-radius: 999px; background: rgba(255,255,255,.07); margin-top: 1.4vmin; overflow: hidden; } .wk .bar i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #f4c9d6, #e2b08c); }
.rules { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2vmin; }
.rule { border-radius: 2vmin; background: #111113; border: 1px solid rgba(255,255,255,.12); padding: 2.6vmin 2.8vmin; opacity: 0; }
.rule b { display: block; font-size: 3.4vmin; font-weight: 650; line-height: 1.15; } .rule span { display: block; font-size: 2.6vmin; color: #a1a1a6; margin-top: .7vmin; line-height: 1.35; }
.rule.no b { color: #ff7a6b; } .rule.yes b { color: #32d74b; }
@media (orientation: portrait) { .rules { grid-template-columns: 1fr; } .tl3 { grid-template-columns: 1fr; } .ruler .hint { display: none; } .ruler .zl { font-size: 2.3vmin; left: calc(6vmin + 1.05 * 22%); transform: translateX(-50%); } }`,
    html: `
<div class="wx">
  <div class="ruler" id="ruler"><div class="line"></div>
    ${[0, 1, 2, 3, 4].map((k) => `<i class="tk" style="left:calc(6vmin + ${k} * 22%)"></i><span class="tl" style="left:calc(6vmin + ${k} * 22%)">${k === 0 ? "0" : k + '/4\u2033'}</span>`).join("")}
    <div class="hair" id="hair"></div><span class="rice" id="rice">a grain of rice</span>
    <div class="zone" id="zone" style="left:calc(6vmin + 0.8 * 22%);width:calc(0.5 * 22%)"></div><span class="zl" id="zl">about ¼ inch: the wax can grip</span><span class="hint lo" id="h-lo">shorter than that: the wax slides off</span><span class="hint hi" id="h-hi">longer: trim it, never shave it down</span>
  </div>
  <div class="tl3" id="tl3"><div class="wk" id="wk-shave"><b>2 to 3 weeks</b><span>after shaving, the hair is long enough</span><div class="bar"><i id="bar-shave"></i></div></div><div class="wk" id="wk-wax"><b>4 to 6 weeks</b><span>after a wax: the rhythm that thins the hair over time (brows, lip and underarms: 3 to 4)</span><div class="bar"><i id="bar-wax"></i></div></div></div>
  <div class="rules" id="rules"><div class="rule no" id="r-shave"><b>No shaving between</b><span>It resets the growth and makes the next wax patchier.</span></div><div class="rule yes" id="r-exf"><b>Exfoliate gently</b><span>In the two or three days before, so the hair comes out clean.</span></div><div class="rule" id="r-day"><b>That morning</b><span>Clean skin, nothing scented, no tanning; loose clothes to leave in.</span></div></div>
</div>
<section class="shot"></section><section class="shot"></section><section class="shot"></section>`,
    setup: (M) => {},
    seek: (t, st, M) => {
      const { lt, i } = st, { $, $$, enter, seg, E, set } = M;
      // shot 0: the ruler; the hair grows to a quarter inch, the rice badge rides its tip, the zone lights
      set($("#ruler"), { o: Math.min(1, seg(t, 0, 0.6) * 1.5), y: 10 * (1 - E.out(seg(t, 0, 0.6))) });
      const grow = i === 0 ? E.out(seg(lt, 0.8, 3.6)) : 1;
      const hairW = 22 * 1.0 * grow;                                       // one tick = a quarter inch
      $("#hair").style.width = "calc(" + hairW + "% )";
      const rice = $("#rice"); rice.style.left = "calc(6vmin + " + hairW + "%)";
      if (i === 0) enter(rice, lt, 2.4, { y: 6 }); else set(rice, { o: 1 });
      if (i === 0) { enter($("#zone"), lt, 3.8, { y: 0, s: 0.8, d: 0.5 }); enter($("#zl"), lt, 4.2, { y: 6 }); enter($("#h-lo"), lt, 5.0, { y: 4 }); enter($("#h-hi"), lt, 5.6, { y: 4 }); } else { set($("#zone"), { o: 1 }); set($("#zl"), { o: 1 }); set($("#h-lo"), { o: 1 }); set($("#h-hi"), { o: 1 }); }
      // shot 1: the timing cards and their bars fill
      $("#tl3").style.display = i === 1 ? "" : "none";
      if (i === 1) { enter($("#wk-shave"), lt, 0.4, { y: 12 }); enter($("#wk-wax"), lt, 1.0, { y: 12 }); $("#bar-shave").style.width = (100 * E.out(seg(lt, 1.2, 3.6))) + "%"; $("#bar-wax").style.width = (100 * E.out(seg(lt, 1.8, 5.0))) + "%"; }
      // shot 2: the three rules
      $("#rules").style.display = i === 2 ? "" : "none";
      if (i === 2) { enter($("#r-shave"), lt, 0.4, { y: 12 }); enter($("#r-exf"), lt, 1.6, { y: 12 }); enter($("#r-day"), lt, 2.8, { y: 12 }); }
      // the ruler shrinks a little once the cards take the stage
      set($("#ruler"), { o: 1, s: i === 0 ? 1 : 0.92, y: i === 0 ? 0 : -4 });
    }
  }
};
