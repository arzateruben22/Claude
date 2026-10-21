// Skin School visuals: one labeled diagram per key lesson, drawn in code
// (HTML, CSS and inline SVG) in the course's own dark style, so nothing in
// them is invented anatomy or a borrowed photo. The lesson player shows each
// one above the lesson's notes.
//
//   node docs/school/visuals/build-visuals.mjs        (from lumevina/; playwright from PLAYWRIGHT_DIR or the project)
//   → img/school/<lesson id>.jpg (1600×900) and docs/school/visuals.js (the list of ids)
//
// Change a diagram below, run it again, then python3 docs/school/build.py.
// Every number here is in the lesson or the general layer; Evelyn reviews
// them with the lessons.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const out = path.join(root, "img/school"), tmp = path.join(here, ".tmp");
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
const font = "file://" + path.join(root, "docs/blueprint/inter-var.woff2");

const ROSE = "#f4c9d6", ROSE2 = "#eab9c8", GOLD = "#e3b48f", GREEN = "#32d74b", RED = "#ff7a6b", T2 = "#a1a1a6", T3 = "#6e6e73";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const base = (title, kicker, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "InterV"; src: url("${font}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1600px; height: 900px; overflow: hidden; background: #000; color: #f5f5f7; font-family: "InterV", -apple-system, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
.v { position: relative; width: 1600px; height: 900px; padding: 72px 88px; display: grid; grid-template-rows: auto 1fr; gap: 36px; background: radial-gradient(1200px 700px at 80% 0%, #1b1316 0%, #000 60%); }
.k { font-size: 24px; font-weight: 600; color: ${ROSE}; letter-spacing: .02em; }
h1 { font-size: 56px; font-weight: 700; letter-spacing: -.035em; line-height: 1.04; margin-top: 10px; max-width: 1200px; }
.body { position: relative; }
.grad { background: linear-gradient(95deg, #f7d3de 0%, #eab9c8 45%, #e2b08c 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.card { background: #111113; border: 1px solid rgba(255,255,255,.1); border-radius: 24px; padding: 28px 32px; }
.lbl { font-size: 20px; color: ${T2}; line-height: 1.4; }
.big { font-size: 40px; font-weight: 700; letter-spacing: -.03em; }
.row { display: grid; gap: 24px; }
.foot { position: absolute; right: 88px; bottom: 44px; font-size: 20px; color: ${T3}; }
svg text { font-family: "InterV", system-ui, sans-serif; }
</style></head><body><div class="v"><div><p class="k">${esc(kicker)}</p><h1>${title}</h1></div><div class="body">${body}</div><p class="foot">Lumevina Skin School · Evelyn Romero</p></div></body></html>`;

const pill = (t, c = ROSE2) => `<span style="display:inline-block;padding:10px 18px;border-radius:999px;border:1.5px solid ${c};color:${c};font-size:22px;font-weight:600;margin:0 10px 10px 0">${esc(t)}</span>`;
const steps = (list, color = ROSE2) => `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">` +
  list.map((s, i) => `<div style="display:flex;align-items:center;gap:14px"><div class="card" style="padding:18px 24px;min-width:150px;text-align:center"><div style="font-size:16px;color:${T3};font-weight:600">${i + 1}</div><div style="font-size:24px;font-weight:650;margin-top:4px">${esc(s)}</div></div>${i < list.length - 1 ? `<span style="color:${color};font-size:30px">→</span>` : ""}</div>`).join("") + `</div>`;

const V = {
  "1-1": base(`Your skin, <span class="grad">in three layers.</span>`, "How skin works", `
    <svg viewBox="0 0 1424 480" width="1424" height="480">
      <defs><linearGradient id="e" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f7d3de"/><stop offset="1" stop-color="#eab9c8"/></linearGradient></defs>
      <rect x="0" y="40" width="900" height="110" rx="18" fill="url(#e)"/>
      <rect x="0" y="160" width="900" height="190" rx="18" fill="#3a2a2f"/>
      <rect x="0" y="360" width="900" height="110" rx="18" fill="#201a1c"/>
      <g fill="#111" font-size="26" font-weight="700"><text x="28" y="104">Epidermis · the surface you treat at home</text></g>
      <g fill="#f5f5f7" font-size="26" font-weight="700"><text x="28" y="230">Dermis · collagen, elastin, oil glands, blood supply</text></g>
      <g fill="${T2}" font-size="22"><text x="28" y="268">Where firmness lives. Reached by professional treatments, not creams.</text></g>
      <g fill="${T2}" font-size="26" font-weight="700"><text x="28" y="422">Fat and support beneath</text></g>
      <g font-size="24" fill="${T2}">
        <text x="960" y="80" fill="${ROSE}" font-weight="700" font-size="26">New cells rise to the surface</text>
        <text x="960" y="120">about 4 weeks in your twenties,</text>
        <text x="960" y="150">slower with age</text>
        <text x="960" y="200" fill="${ROSE}" font-weight="700" font-size="26">So judge a routine at</text>
        <text x="960" y="260" font-size="48" font-weight="700" fill="#f5f5f7">8 to 12 weeks</text>
        <text x="960" y="298">not 8 to 12 days</text>
        <text x="960" y="360" fill="${ROSE}" font-weight="700" font-size="26">Deeper skin tones</text>
        <text x="960" y="400">mark more easily after irritation:</text>
        <text x="960" y="430">gentler acids, no picking, daily SPF</text>
      </g>
    </svg>`),
  "1-2": base(`Type is oil. Condition is <span class="grad">right now.</span>`, "Find your real skin type", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="k" style="font-size:22px">Type · how much oil you make</div><div style="margin-top:18px">${pill("Oily")}${pill("Dry")}${pill("Combination")}${pill("Normal")}</div><p class="lbl" style="margin-top:14px">Mostly genetic. Changes slowly, with age and hormones.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">Condition · what's happening now</div><div style="margin-top:18px">${pill("Dehydrated", GOLD)}${pill("Sensitized", GOLD)}${pill("Congested", GOLD)}${pill("Breaking out", GOLD)}${pill("Dark marks", GOLD)}</div><p class="lbl" style="margin-top:14px">Comes and goes with products, weather, stress and habits.</p></div>
    </div>
    <div class="card" style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:32px">
      <div><div class="big">Dry</div><p class="lbl">Makes little oil. Rough or flaky most of the time. Wants richer creams.</p></div>
      <div><div class="big">Dehydrated</div><p class="lbl">Short on water, not oil. Tight after cleansing, dull, can be oily at the same time. Wants humectants under a moisturizer, and fewer acids.</p></div>
    </div>`),
  "1-3": base(`The barrier: <span class="grad">bricks and mortar.</span>`, "Why less is more", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="k" style="font-size:22px;color:${GREEN}">Intact</div>
        <svg viewBox="0 0 600 200" width="600" height="200" style="margin-top:12px">${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${c * 118 + (r % 2 ? 59 : 0)}" y="${r * 48}" width="110" height="40" rx="8" fill="#3a2a2f" stroke="#eab9c8" stroke-width="3"/>`).join("")).join("")}</svg>
        <p class="lbl" style="margin-top:12px">Cells held by lipids: ceramides, cholesterol, fatty acids. Water stays in, irritants stay out.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${RED}">Worn down</div>
        <svg viewBox="0 0 600 200" width="600" height="200" style="margin-top:12px">${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${c * 118 + (r % 2 ? 59 : 0) + ((r + c) % 3 === 0 ? 10 : 0)}" y="${r * 48}" width="${(r + c) % 3 === 0 ? 90 : 110}" height="40" rx="8" fill="#2a1d1d" stroke="${(r + c) % 2 ? "#ff7a6b" : "#6e3a3a"}" stroke-width="3" stroke-dasharray="${(r + c) % 2 ? "10 6" : "0"}"/>`).join("")).join("")}</svg>
        <p class="lbl" style="margin-top:12px">Too many actives, hot water, scrubbing, wind, sunburn. Products sting, skin flakes, breaks out more.</p></div>
    </div>
    <div class="card" style="margin-top:24px"><span class="k" style="font-size:22px">The repair</span><p class="lbl" style="margin-top:8px;font-size:24px;color:#f5f5f7">Gentle cleanser · moisturizer with barrier lipids · SPF · actives paused two weeks, then back one at a time.</p></div>`),
  "2-3": base(`Sunscreen: <span class="grad">enough, every day.</span>`, "The anti-aging step", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div class="big">SPF 30+</div><p class="lbl">Broad spectrum. Mineral (zinc, titanium) for sensitive, acne-prone or freshly treated skin.</p></div>
      <div class="card"><div class="big">¼ teaspoon</div><p class="lbl">For the face alone. Most people use a third of that. Makeup with SPF is a top-up, not the base.</p></div>
      <div class="card"><div class="big">Every 2 hours</div><p class="lbl">Outside. After any peel, dermaplaning or active, skin burns more easily for days to weeks.</p></div>
    </div>
    <div class="card" style="margin-top:24px"><p class="lbl" style="font-size:24px;color:#f5f5f7">UV is the main cause of early lines, uneven tone and dark spots, and it undoes pigment work. It's the one product every esthetician agrees on.</p></div>`),
  "4-1": base(`Exfoliants, <span class="grad">gentlest to strongest.</span>`, "AHAs, BHAs and enzymes", `
    ${steps(["Enzymes", "Mandelic", "Lactic", "Glycolic"])}
    <div class="row" style="grid-template-columns:1fr 1fr;margin-top:24px">
      <div class="card"><div class="k" style="font-size:22px">Alpha hydroxy acids</div><p class="lbl" style="margin-top:8px">Loosen dead cells on the surface: texture, tone, dullness. Mandelic is the largest molecule, the gentlest, a common choice for sensitive skin, deeper tones and acne.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">Salicylic (BHA)</div><p class="lbl" style="margin-top:8px">Oil-soluble, so it gets into pores: blackheads, congestion, oily skin. Usually 0.5 to 2% at home.</p></div>
    </div>
    <p class="lbl" style="margin-top:20px;font-size:22px">Too much exfoliation looks like: shine with tightness, redness, stinging, flaking, more breakouts. A few nights a week, not every night.</p>`),
  "5-2": base(`Retinoids: <span class="grad">low and slow.</span>`, "An eight-week ramp", `
    <div class="row" style="grid-template-columns:repeat(8,1fr);gap:14px">
      ${[2, 2, 3, 3, 4, 4, 5, 6].map((n, i) => `<div class="card" style="padding:18px 14px;text-align:center"><div style="font-size:16px;color:${T3};font-weight:600">WEEK ${i + 1}</div><div style="font-size:40px;font-weight:700;margin:6px 0 4px">${n}</div><div style="font-size:16px;color:${T2}">nights</div><div style="display:flex;gap:4px;justify-content:center;margin-top:10px">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<span style="width:12px;height:12px;border-radius:50%;background:${d < n ? ROSE2 : "#2a2a2d"}"></span>`).join("")}</div></div>`).join("")}
    </div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr;margin-top:24px">
      <div class="card"><div class="k" style="font-size:22px">A pea</div><p class="lbl">For the whole face, on dry skin, moisturizer over it if it stings.</p></div>
      <div class="card"><div class="k" style="font-size:22px">Never with an acid</div><p class="lbl">Alternate nights. Expect some dryness in the first weeks; a new sting means slow down.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${RED}">Pause before</div><p class="lbl">Waxing, peels, dermaplaning, microchanneling: 3 to 7 days. Not in pregnancy without a doctor.</p></div>
    </div>`),
  "6-1": base(`The order of things, <span class="grad">morning and night.</span>`, "Thin to thick, SPF last", `
    <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">Morning</div><div style="margin-top:14px">${steps(["Cleanse", "Toner", "Serum", "Eye", "Moisturizer", "SPF"], GOLD)}</div></div>
    <div class="card" style="margin-top:20px"><div class="k" style="font-size:22px">Night</div><div style="margin-top:14px">${steps(["Cleanse (×2)", "Toner", "Treatment", "Serum", "Eye", "Moisturizer"])}</div><p class="lbl" style="margin-top:12px">The treatment step is your acid, retinoid or acne active. A spot treatment goes on last, on the spot only. Evelyn's own order for you comes after a visit.</p></div>`),
  "6-2": base(`Not on the <span class="grad">same night.</span>`, "What generally isn't combined", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      ${[["A retinoid + an acid", "Alternate nights instead."], ["Two exfoliants", "Two acids, an acid and a scrub, an acid and an exfoliating cleanser every day: pick one."], ["Benzoyl peroxide + retinol", "They can cancel each other and irritate. Morning and night, or alternate."], ["Pure vitamin C + an acid or retinoid in one step", "Vitamin C in the morning, actives at night."], ["Any active on freshly treated skin", "After a peel, dermaplaning, microchanneling or a wax: wait the days the aftercare says."], ["Niacinamide + vitamin C", "Fine together. That caution is outdated."]]
        .map(([a, b], i) => `<div class="card" style="border-color:${i === 5 ? "rgba(50,215,75,.5)" : "rgba(255,122,107,.35)"}"><div style="font-size:26px;font-weight:650;color:${i === 5 ? GREEN : RED}">${i === 5 ? "✓" : "✕"} ${esc(a)}</div><p class="lbl" style="margin-top:6px">${esc(b)}</p></div>`).join("")}
    </div>`),
  "6-3": base(`Purging <span class="grad">vs. a breakout.</span>`, "One means keep going, the other means stop", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card" style="border-color:rgba(50,215,75,.5)"><div class="big" style="color:${GREEN}">Purging</div>
        <ul class="lbl" style="margin-top:12px;padding-left:22px;line-height:1.6"><li>Starts 2 to 6 weeks after a new active or program</li><li>Where you usually break out</li><li>Small whiteheads or bumps that clear quickly</li><li>Settles within about 6 weeks</li><li>Keep going; ease the frequency if it's harsh</li></ul></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div class="big" style="color:${RED}">A reaction</div>
        <ul class="lbl" style="margin-top:12px;padding-left:22px;line-height:1.6"><li>New places</li><li>Itching, redness, stinging</li><li>Lasts longer and keeps going</li><li>Stop the product</li><li>Message Evelyn, with a photo in daylight</li></ul></div>
    </div>`),
  "8-3": base(`Acne clears on a <span class="grad">calendar, not a weekend.</span>`, "Give it 90 days", `
    <svg viewBox="0 0 1424 300" width="1424" height="300">
      <rect x="0" y="130" width="1424" height="14" rx="7" fill="#2a2a2d"/>
      <rect x="0" y="130" width="720" height="14" rx="7" fill="url(#g)"/>
      <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f7d3de"/><stop offset="1" stop-color="#e2b08c"/></linearGradient></defs>
      ${[[0, "Week 0", "Consult, treat, start the routine"], [400, "Weeks 2 to 6", "Purging is common; don't stop"], [720, "Day 90", "Real results start to show"], [1080, "3 to 6 months", "Mostly clear, with consistency"]].map(([x, a, b]) => `<circle cx="${x + 12}" cy="137" r="16" fill="#000" stroke="#eab9c8" stroke-width="4"/><text x="${x}" y="90" fill="#f5f5f7" font-size="28" font-weight="700">${a}</text><text x="${x}" y="200" fill="${T2}" font-size="22">${b}</text>`).join("")}
    </svg>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr;margin-top:10px">
      <div class="card"><div class="k" style="font-size:22px">A visit every 2 to 4 weeks</div><p class="lbl">Exfoliation, extractions, calming steps, LED.</p></div>
      <div class="card"><div class="k" style="font-size:22px">Home care decides it</div><p class="lbl">Consistency beats intensity. Pillowcases, phone, hair products, hands off.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${RED}">A doctor too, when</div><p class="lbl">Cystic, scarring, painful, hormonal, or unmoved after months.</p></div>
    </div>`),
  "12-2": base(`After a treatment: <span class="grad">the first 24 hours, the first week.</span>`, "Aftercare, in general", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="big">24 hours</div>
        <ul class="lbl" style="margin-top:12px;padding-left:22px;line-height:1.6"><li>No makeup the rest of the day; no touching or picking</li><li>No heat or sweat: gym, sauna, hot yoga, hot showers, pools</li><li>Gentle cleanse tonight or tomorrow; moisturizer; SPF in the morning</li><li>No sun or tanning</li></ul></div>
      <div class="card"><div class="big">The first week</div>
        <ul class="lbl" style="margin-top:12px;padding-left:22px;line-height:1.6"><li>No acids, retinoids, scrubs: 2 to 3 days after a facial, 5 to 7 after a peel, dermaplaning or microchanneling</li><li>Let flaking fall by itself</li><li>Fresh pillowcase, clean phone</li><li>No waxing, threading or new products</li></ul></div>
    </div>
    <p class="lbl" style="margin-top:18px;font-size:22px">Why: exfoliated or extracted skin has a thinner barrier and open follicles for a day or two. Heat, sweat, friction, bacteria and strong actives in that window are what turn a good treatment into redness, bumps or dark marks.</p>`),
  "12-3": base(`What's normal, <span class="grad">what isn't.</span>`, "When to message Evelyn, and when it's a doctor", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card" style="border-color:rgba(50,215,75,.5)"><div class="k" style="font-size:22px;color:${GREEN}">Normal</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.55"><li>Pink for a few hours</li><li>Tight or dry for a day or two</li><li>Light flaking on days 2 to 5</li><li>A few small bumps after extractions</li><li>Mild tenderness</li></ul></div>
      <div class="card" style="border-color:rgba(227,180,143,.6)"><div class="k" style="font-size:22px;color:${GOLD}">Message Evelyn</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.55"><li>Redness that spreads after day one</li><li>Burning that doesn't settle</li><li>Bumps turning into pus-filled spots</li><li>Anything that worries you, with a photo in daylight</li></ul></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div class="k" style="font-size:22px;color:${RED}">A doctor, today</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.55"><li>Swelling around the eyes or lips, hives, blistering</li><li>Pus, heat, red streaks, fever</li><li>A cold sore starting</li><li>Trouble breathing or a swelling throat: 911</li></ul></div>
    </div>`),
  "13-1": base(`Before a wax: <span class="grad">a grain of rice.</span>`, "Hair length, shaving, timing", `
    <div class="row" style="grid-template-columns:1.2fr 1fr">
      <div class="card"><svg viewBox="0 0 700 150" width="700" height="150">
        <rect x="20" y="70" width="640" height="10" fill="#2a2a2d" rx="5"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="${20 + i * 160}" y="40" width="4" height="40" fill="${T2}"/><text x="${20 + i * 160}" y="125" fill="${T2}" font-size="20" text-anchor="middle">${i === 0 ? "0" : `${i}/4"`}</text>`).join("")}
        <rect x="20" y="60" width="160" height="30" rx="6" fill="rgba(244,201,214,.25)" stroke="#eab9c8" stroke-width="3"/>
        <text x="100" y="30" fill="#f5f5f7" font-size="26" font-weight="700" text-anchor="middle">¼ inch</text>
      </svg><p class="lbl" style="margin-top:8px">About 2 to 3 weeks after shaving, 4 to 6 after a wax. Too short and the wax can't grip; very long can be trimmed, not shorter.</p></div>
      <div class="card"><ul class="lbl" style="padding-left:22px;line-height:1.6"><li><b style="color:#f5f5f7">No shaving between waxes</b>: it resets the growth and makes the next one patchier</li><li>Exfoliate gently 2 or 3 days before, not the day of</li><li>Clean, dry skin; no lotion, oil or deodorant; loose cotton</li><li>No sunburn, no fresh tan, no retinoids or acids on the area that week</li><li>On Accutane, or finished in the last 6 to 12 months: a doctor and Evelyn decide</li></ul></div>
    </div>`),
  "11-3": base(`Always a doctor, <span class="grad">not a facial.</span>`, "Red flags", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      ${[["Spreading or worsening", "Redness that spreads, blisters, weeps or hives after a product or treatment"], ["Signs of infection", "Increasing pain, heat, pus, red streaks, fever"], ["A changing mole", "New, asymmetrical, irregular border, more than one color, larger than a pencil eraser, bleeding or itching"], ["Severe acne", "Cystic, scarring, painful, or unmoved after months of consistent care"], ["A named condition", "Eczema, psoriasis, rosacea, dermatitis, cold sores, shingles, autoimmune"], ["Anything medical", "Prescriptions, medications, supplements, pregnancy, breastfeeding"]]
        .map(([a, b]) => `<div class="card" style="border-color:rgba(255,122,107,.35)"><div style="font-size:24px;font-weight:650;color:${RED}">${esc(a)}</div><p class="lbl" style="margin-top:6px">${esc(b)}</p></div>`).join("")}
    </div>
    <p class="lbl" style="margin-top:18px;font-size:22px">Trouble breathing, or swelling of the lips, tongue or throat: 911. An esthetician works on the surface; a referral is the right answer, not a treatment.</p>`),
  "3-2": base(`Three steps, <span class="grad">morning and night.</span>`, "Build your first routine", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="k" style="font-size:22px">Morning</div><div style="margin-top:14px">${steps(["Cleanse (or just rinse, if you're dry)", "Moisturize", "Sunscreen"])}</div></div>
      <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">Night</div><div style="margin-top:14px">${steps(["Cleanse", "Treat (once your skin is calm)", "Moisturize"], GOLD)}</div></div>
    </div>
    <div class="row" style="grid-template-columns:1fr 1fr;margin-top:24px">
      <div class="card"><div style="font-size:24px;font-weight:650">One new product at a time</div><p class="lbl" style="margin-top:6px">Wait two weeks before adding another, so you know what's working and what isn't.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Patch test anything new</div><p class="lbl" style="margin-top:6px">Twice a day on a small spot along the jaw or inner arm, for 7 to 10 days.</p></div>
    </div>`),
  "10-2": base(`The short list, <span class="grad">every day.</span>`, "An anti-aging routine that works", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div class="k" style="font-size:22px">Morning</div><div style="margin-top:14px">${steps(["Vitamin C", "Moisturizer", "Sunscreen"])}</div></div>
      <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">Night</div><div style="margin-top:14px">${steps(["Retinoid, built up slowly", "Peptides", "A rich moisturizer"], GOLD)}</div></div>
    </div>
    <div class="row" style="grid-template-columns:1fr 1fr;margin-top:24px">
      <div class="card"><div style="font-size:24px;font-weight:650">Neck, chest and hands too</div><p class="lbl" style="margin-top:6px">They show age early. The same products, carried down and out.</p></div>
      <div class="card" style="border-color:rgba(244,201,214,.5)"><div style="font-size:24px;font-weight:650;color:${ROSE}">Consistency beats strength</div><p class="lbl" style="margin-top:6px">A gentle retinoid every night beats a strong one once a week.</p></div>
    </div>`),
  "7-3": base(`Your routine changes <span class="grad">with the weather.</span>`, "Skin through the seasons", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      ${[["Hot summers", GOLD, ["Lighter gel moisturizer", "Sunscreen reapplied more often", "Blotting papers, not more powder"]], ["Santa Ana winds, dry winters", ROSE, ["Richer moisturizer", "Fewer acid nights", "A humidifier by the bed"]], ["Travel and flights", T2, ["Skip new actives", "Pack your barrier basics", "Sunscreen in the window seat"]]]
        .map(([h, c, items]) => `<div class="card"><div style="font-size:26px;font-weight:650;color:${c}">${esc(h)}</div><ul class="lbl" style="margin-top:12px;padding-left:22px;line-height:1.6">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
    </div>
    <p class="lbl" style="margin-top:22px;font-size:22px">A skin check with Evelyn at every change of season: the Valley has more weather than people think.</p>`),
  "5-3": base(`The quiet ones that <span class="grad">make everything else work.</span>`, "The supporting cast", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      ${[["Niacinamide, 2 to 5%", "Calms redness, balances oil, strengthens the barrier. Works with almost everything."], ["Hyaluronic acid", "Holds water. On damp skin, sealed with moisturizer."], ["Azelaic acid", "Calms redness and fades marks; gentle enough for sensitive skin."], ["Benzoyl peroxide", "Kills acne bacteria. Bleaches towels and pillowcases: use white ones."]]
        .map(([a, b]) => `<div class="card"><div style="font-size:26px;font-weight:650">${esc(a)}</div><p class="lbl" style="margin-top:8px">${esc(b)}</p></div>`).join("")}
    </div>`),
  "9-2": base(`Brighteners with evidence, <span class="grad">two at a time.</span>`, "Brighteners that work", `
    <div style="margin-bottom:18px">${pill("vitamin C")}${pill("niacinamide")}${pill("azelaic acid")}${pill("tranexamic acid")}${pill("a retinoid: faster turnover", GOLD)}</div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div style="font-size:24px;font-weight:650">Two together</div><p class="lbl" style="margin-top:6px">They fade spots in different ways, so a pair often works better than one: vitamin C by day, azelaic acid or a retinoid at night.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Hydroquinone</div><p class="lbl" style="margin-top:6px">Prescription-only in the US since 2020. A conversation for your doctor, not the shelf.</p></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div style="font-size:24px;font-weight:650;color:${RED}">Nothing works without sunscreen</div><p class="lbl" style="margin-top:6px">One unprotected afternoon can undo a month of fading.</p></div>
    </div>`),
  "11-2": base(`Pause some, keep some, <span class="grad">and ask your doctor.</span>`, "Pregnancy and breastfeeding", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div class="k" style="font-size:22px;color:${RED}">Pause</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.6"><li>Retinoids of every kind, including retinol</li><li>High-strength salicylic peels</li></ul></div>
      <div class="card" style="border-color:rgba(50,215,75,.45)"><div class="k" style="font-size:22px;color:${GREEN}">Commonly considered fine</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.6"><li>Azelaic acid, vitamin C, niacinamide</li><li>Gentle lactic acid</li><li>Mineral sunscreen (tinted, for melasma)</li></ul></div>
    </div>
    <p class="lbl" style="margin-top:22px;font-size:22px">Melasma often shows up in pregnancy; tinted mineral sunscreen is your best friend. Tell your esthetician every time: some treatments change. The one rule: ask your doctor.</p>`),
  "4-3": base(`Kind or harsh: <span class="grad">it's the tool and the pressure.</span>`, "Scrubs, brushes and dermaplaning", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div style="font-size:24px;font-weight:650;color:${RED}">Skip</div><p class="lbl" style="margin-top:6px">Scrubs with jagged bits, crushed shells or pits: tiny tears in the skin.</p></div>
      <div class="card" style="border-color:rgba(50,215,75,.45)"><div style="font-size:24px;font-weight:650;color:${GREEN}">Kind</div><p class="lbl" style="margin-top:6px">A soft washcloth, or a gentle enzyme mask: a physical polish without the damage.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Dermaplaning</div><p class="lbl" style="margin-top:6px">Dead skin and peach fuzz off; done professionally it's smooth and safe, and makeup goes on flawlessly.</p></div>
    </div>
    <div class="card" style="margin-top:24px"><div style="font-size:24px;font-weight:650">At home, if you do</div><p class="lbl" style="margin-top:6px">Clean, dry skin, a fresh blade, light strokes, once a month at most, and never over active breakouts.</p></div>`),
  "7-1": base(`Twenty minutes, <span class="grad">once a week.</span>`, "The Sunday ritual", `
    <div style="margin-bottom:22px">${steps(["Double cleanse", "Warm towel, one minute", "Exfoliate (not on an acid night)", "Mask for your skin", "Serum, with massage", "Moisturize"])}</div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div style="font-size:24px;font-weight:650">The mask</div><p class="lbl" style="margin-top:6px">Clay for oily skin, cream or gel for dry.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">The steam</div><p class="lbl" style="margin-top:6px">Skip it if you have redness or rosacea.</p></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div style="font-size:24px;font-weight:650;color:${RED}">No extractions at home</div><p class="lbl" style="margin-top:6px">That's what the treatment room is for.</p></div>
    </div>`),
  "7-2": base(`Slip, direction, <span class="grad">light pressure.</span>`, "Facial massage and gua sha", `
    <div class="row" style="grid-template-columns:1.1fr 1fr">
      <div class="card"><svg viewBox="0 0 640 420" width="640" height="420">
        <ellipse cx="320" cy="190" rx="150" ry="180" fill="#2a1f22" stroke="rgba(255,255,255,.12)"/>
        <g fill="none" stroke="${ROSE2}" stroke-width="5" stroke-linecap="round">
          <path d="M320 150 C 360 150, 400 160, 440 190"/><path d="M320 150 C 280 150, 240 160, 200 190"/>
          <path d="M320 230 C 360 230, 400 250, 430 280"/><path d="M320 230 C 280 230, 240 250, 210 280"/>
          <path d="M320 290 C 348 306, 366 330, 374 362"/><path d="M320 290 C 292 306, 274 330, 266 362"/>
        </g>
        <g fill="${ROSE2}"><polygon points="440,190 426,176 422,196"/><polygon points="200,190 214,176 218,196"/><polygon points="430,280 416,268 414,288"/><polygon points="210,280 224,268 226,288"/><polygon points="374,362 360,352 366,370"/><polygon points="266,362 280,352 274,370"/></g>
        <text x="320" y="60" fill="${T2}" font-size="22" text-anchor="middle">from the center, outward</text>
        <text x="320" y="410" fill="${T2}" font-size="22" text-anchor="middle">then down the neck, toward the lymph nodes</text>
      </svg></div>
      <div style="display:grid;gap:20px;align-content:start">
        <div class="card"><div style="font-size:24px;font-weight:650">Always slip</div><p class="lbl" style="margin-top:6px">A face oil or a rich serum. Never drag dry skin.</p></div>
        <div class="card"><div style="font-size:24px;font-weight:650">Light pressure</div><p class="lbl" style="margin-top:6px">It should feel good, never hurt, and never leave marks.</p></div>
        <div class="card" style="border-color:rgba(255,122,107,.5)"><div style="font-size:24px;font-weight:650;color:${RED}">Skip over</div><p class="lbl" style="margin-top:6px">Active breakouts, broken skin, and the days right after a peel.</p></div>
      </div>
    </div>`),
  "8-1": base(`Four things, <span class="grad">at once.</span>`, "How acne really forms", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr 1fr">
      ${[["1", "Too much oil"], ["2", "Dead cells clogging the pore"], ["3", "Acne bacteria"], ["4", "Inflammation"]].map(([n, t]) => `<div class="card" style="text-align:center"><div style="font-size:40px;font-weight:700;color:${ROSE}">${n}</div><div style="font-size:24px;font-weight:650;margin-top:6px">${esc(t)}</div></div>`).join("")}
    </div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr;margin-top:24px">
      <div class="card"><div style="font-size:24px;font-weight:650">Clogged</div><p class="lbl" style="margin-top:6px">Blackheads and whiteheads: a pore that's blocked.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Inflamed</div><p class="lbl" style="margin-top:6px">Red bumps and pus-filled pimples: a blocked pore the body is fighting.</p></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div style="font-size:24px;font-weight:650;color:${RED}">Deep, painful</div><p class="lbl" style="margin-top:6px">Cysts and nodules can scar: a dermatologist, not just a facial.</p></div>
    </div>
    <p class="lbl" style="margin-top:20px;font-size:22px">Acne starts forming weeks before you see it. That's why results take two to three months.</p>`),
  "10-3": base(`Who does what, <span class="grad">in California.</span>`, "Professional treatments, explained", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card" style="border-color:rgba(244,201,214,.5)"><div class="k" style="font-size:22px">With an esthetician: the surface</div><div style="margin-top:12px">${pill("facials")}${pill("light peels")}${pill("dermaplaning")}${pill("LED")}${pill("extractions")}</div><p class="lbl" style="margin-top:10px">Evelyn's room.</p></div>
      <div class="card" style="border-color:rgba(227,180,143,.6)"><div class="k" style="font-size:22px;color:${GOLD}">With a nurse or doctor: medical</div><div style="margin-top:12px">${pill("microneedling", GOLD)}${pill("lasers", GOLD)}${pill("Botox", GOLD)}${pill("fillers", GOLD)}</div><p class="lbl" style="margin-top:10px">Ask anyone offering injectables who their supervising physician is; look for a licensed nurse, PA or doctor.</p></div>
    </div>
    <p class="lbl" style="margin-top:22px;font-size:22px">Most of what makes a treatment work comes before and after: prep, aftercare and sunscreen.</p>`),
  "12-1": base(`A few days of prep <span class="grad">make the difference.</span>`, "Before your facial, peel or wax", `
    <div class="row" style="grid-template-columns:1fr 1fr">
      <div class="card"><div style="font-size:24px;font-weight:650">Pause, three to five days before</div><p class="lbl" style="margin-top:6px">Retinol and acids, before a facial, peel, dermaplaning or wax. A prescription retinoid: about a week, and tell Evelyn.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">No sunburn, no fresh tan</div><p class="lbl" style="margin-top:6px">No treatment on burned or freshly tanned skin, and plan a trip for at least two or three days after.</p></div>
      <div class="card" style="border-color:rgba(50,215,75,.45)"><div style="font-size:24px;font-weight:650;color:${GREEN}">Breaking out? Come in</div><p class="lbl" style="margin-top:6px">A reason to come, not to cancel. Open, raw or infected skin is the one thing that waits.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Tell her every time</div><p class="lbl" style="margin-top:6px">Medications, pregnancy, a recent procedure, a named condition. The pre-visit form is where it goes.</p></div>
    </div>`),
  "13-2": base(`Two days of care, <span class="grad">then keep it smooth.</span>`, "After a wax", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div class="k" style="font-size:22px">The first 24 to 48 hours</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.6"><li>No heat or sweat, no sun</li><li>No tight clothes, nothing scented</li><li>Brazilian: loose cotton, no sex for a day</li></ul></div>
      <div class="card"><div class="k" style="font-size:22px;color:${GOLD}">From day two or three</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.6"><li>Exfoliate gently, two or three times a week</li><li>Keep it moisturized</li><li>Don't dig at an ingrown</li></ul></div>
      <div class="card" style="border-color:rgba(255,122,107,.5)"><div class="k" style="font-size:22px;color:${RED}">Normal, and not</div><ul class="lbl" style="margin-top:10px;padding-left:22px;line-height:1.6"><li>Small red bumps for a few hours to a day: normal</li><li>Spreading pus-filled bumps, lifted skin or a burn: message Evelyn</li></ul></div>
    </div>
    <p class="lbl" style="margin-top:22px;font-size:22px">Every four to six weeks (brows, lip and underarms three to four). Regular waxing thins the hair; shaving in between undoes it.</p>`),
  "14-1": base(`Which one to book, <span class="grad">first time and after.</span>`, "What happens at a visit", `
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card" style="border-color:rgba(244,201,214,.5)"><div class="k" style="font-size:22px">New, no acne concern</div><div style="font-size:24px;font-weight:650;margin-top:8px">New Clients Start Here</div><p class="lbl" style="margin-top:6px">A consultation, a review of your routine, and a customized facial: double cleanse, enzyme exfoliation, extractions, mask, massage, LED, cryo globes.</p></div>
      <div class="card" style="border-color:rgba(227,180,143,.6)"><div class="k" style="font-size:22px;color:${GOLD}">New, with acne</div><div style="font-size:24px;font-weight:650;margin-top:8px">Acne Bootcamp consultation + treatment</div><p class="lbl" style="margin-top:6px">Then monthly treatments, or every two weeks for severe acne.</p></div>
      <div class="card"><div class="k" style="font-size:22px;color:${T2}">Returning</div><div style="font-size:24px;font-weight:650;margin-top:8px">Lumevina Custom Facial</div><p class="lbl" style="margin-top:6px">Or the Monthly Acne Treatment when acne is the work.</p></div>
    </div>
    <p class="lbl" style="margin-top:22px;font-size:22px">Come with a clean face if you can, hair you don't mind getting damp, and your product list or photos of it. The address comes with the confirmation; parking is free.</p>`),
  "14-2": base(`A routine from her shelf, <span class="grad">in four moves.</span>`, "Her shelf: how the products fit together", `
    <div style="margin-bottom:22px">${steps(["Cleanser", "Moisturizer", "SPF", "One treatment product, for the main concern"])}</div>
    <div class="row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="card"><div style="font-size:24px;font-weight:650">Mandelic, lowest first</div><p class="lbl" style="margin-top:6px">A few nights a week; moving up a strength is her call, after a few weeks without stinging.</p></div>
      <div class="card"><div style="font-size:24px;font-weight:650">Texture by skin</div><p class="lbl" style="margin-top:6px">Gels for oily and combination skin, creams for dry; a hydrating toner adds water under either.</p></div>
      <div class="card" style="border-color:rgba(244,201,214,.5)"><div style="font-size:24px;font-weight:650;color:${ROSE}">Her picks come after a visit</div><p class="lbl" style="margin-top:6px">The chat on the website can tell you what's in stock and put it in your bag for pickup.</p></div>
    </div>`)
};

const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ids = [];
for (const [id, html] of Object.entries(V)) {
  const file = path.join(tmp, `${id}.html`);
  fs.writeFileSync(file, html);
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  // anything that runs past the frame or its own box is a clipped line in the JPEG: say so
  const over = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.width >= 1500) continue; // the frame itself
      const txt = (el.textContent || "").trim().slice(0, 50);
      if (r.right > 1600 - 60 || r.bottom > 900 - 20) bad.push("past the frame: " + txt);
      else if (el instanceof SVGTextElement) { const sv = el.ownerSVGElement.getBoundingClientRect(); if (r.right > sv.right + 1) bad.push("past the svg: " + txt); }
      else if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== "visible") bad.push("overflows its box: " + txt);
    }
    // two labels on top of each other
    const leaves = [...document.querySelectorAll("body *")].filter((el) => (el instanceof SVGTextElement || [...el.childNodes].every((n) => n.nodeType === 3)) && (el.textContent || "").trim());
    for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].getBoundingClientRect(), b = leaves[j].getBoundingClientRect();
      const hit = a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
      if (hit) bad.push("overlap: " + leaves[i].textContent.trim().slice(0, 30) + " / " + leaves[j].textContent.trim().slice(0, 30));
    }
    return bad;
  });
  if (over.length) console.warn(`  ${id}: ${over.join(" | ")}`);
  await page.screenshot({ path: path.join(out, `${id}.jpg`), type: "jpeg", quality: 90 });
  await page.close();
  ids.push(id);
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(here, "..", "visuals.js"), `/* GENERATED by docs/school/visuals/build-visuals.mjs: the lessons with a diagram in img/school/. Don't edit; rebuild. */\nwindow.SCHOOL_VISUALS = ${JSON.stringify(ids)};\n`);
console.log(`visuals: ${ids.length} diagrams → img/school/, docs/school/visuals.js`);
