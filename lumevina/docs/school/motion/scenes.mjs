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
@media (orientation: portrait) { .days { grid-template-columns: repeat(3, 1fr); } .day { min-height: 13vmin; } .note12 { grid-template-columns: 1fr; } }`,
    html: `
<div class="cal">
  <div class="days" id="days">
    ${[-7, -6, -5, -4, -3, -2, -1, 0, 2].map((d) => `<div class="day${d === 0 ? " visit" : ""}" data-d="${d}"><span class="d">${d === 0 ? "visit" : d > 0 ? "day +" + d : "day " + d}</span><span class="n">${d === 0 ? "✦" : Math.abs(d)}</span><i class="mark m-rx" style="background:#e2b08c"></i><i class="mark m-act" style="background:#f4c9d6"></i><i class="mark m-sun" style="background:#ffd27a"></i><i class="mark m-wax" style="background:#8fd3ff"></i><i class="mark m-trip" style="background:#6e6e73"></i></div>`).join("")}
  </div>
  <div class="legend" id="legend"><span id="lg-rx"><i style="background:#e2b08c"></i>prescription retinoid off</span><span id="lg-act"><i style="background:#f4c9d6"></i>retinol and acids off</span><span id="lg-sun"><i style="background:#ffd27a"></i>no sunburn or fresh tan</span><span id="lg-wax"><i style="background:#8fd3ff"></i>no waxing or shaving the face</span><span id="lg-trip"><i style="background:#6e6e73"></i>no trip right after</span></div>
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
      if (i === 2) { enter($("#c-go"), lt, 0.6, { y: 12 }); enter($("#c-wait"), lt, 2.2, { y: 12 }); } else { set($("#c-go"), { o: 0, y: 12 }); set($("#c-wait"), { o: 0, y: 12 }); }
      $(".note12").style.display = i === 2 ? "" : "none";
    }
  }
};
