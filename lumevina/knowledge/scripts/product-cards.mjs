// Lumevina — what Evelyn said once, put on every product it applies to: her routines by skin
// type (each step matched to the products on her shelf), when to pause actives before a treatment
// and bring them back after, how the mandelic serums and the acne med are started, what's normal
// at first, when to stop, and how long a bottle lasts. Read from her Skin Playbook answers in
// knowledge/ (client-questions, concerns, routine.md, products/<id>.md) and js/catalog.js.
//
// Two readers: the take-home product guide (build-product-guide.mjs, a page per few products) and
// the chat's knowledge (build-bundle.mjs → each shelf product's card, so the assistant can say how
// and when to use the one a client owns). Her own card for a product always wins over what was
// derived; nothing here is written by anyone but her or the label.
//
//   import { derived, cards } from "./product-cards.mjs"
//   const D = await derived(root, { final })   everything the guide lays out
//   const C = await cards(root)                { [id]: { text, lastsMonths } } for the chat

import fs from "node:fs";
import path from "node:path";
import * as S from "./playbook-spec.mjs";

const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
export const sentence = (t, re) => (String(t || "").match(/[^.!?]+(?:[.!?]|$)/g) || []).find((x) => re.test(x))?.trim() || "";
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// a knowledge file's answers, by field key: only what she answered, without the import's notes to the assistant
export const answers = (md, fields) => {
  const byQ = Object.fromEntries(fields.map((f) => [f.q, f.key]));
  const out = {};
  let key = null, buf = [];
  const flush = () => {
    if (!key) return;
    const body = buf.join("\n").replace(/_\((Same as|How to read)[^)]*\)_/g, "").trim();
    if (body && !/_\(not answered yet\)_/.test(body)) out[key] = body;
  };
  for (const line of md.replace(/^---[\s\S]*?---\s*/, "").split("\n")) {
    const m = /^## (.+)$/.exec(line);
    if (m) { flush(); key = byQ[m[1].trim()] || (m[1].trim() === "From her screenshots" ? "label" : null); buf = []; }
    else if (key) buf.push(line);
  }
  flush();
  return out;
};

export async function derived(root, { final = false } = {}) {
  const K = path.join(root, "knowledge");
  if (!globalThis.window) globalThis.window = {};
  if (!globalThis.window.LUMEVINA_CATALOG) await import(path.join(root, "js/catalog.js"));
  const CAT = globalThis.window.LUMEVINA_CATALOG;

  const live = CAT.products.filter((p) => !p.draft && CAT.categories.includes(p.cat));
  const products = live.map((p) => ({ p, a: answers(read(path.join(K, "products", p.id + ".md")), S.PRODUCT_FIELDS) }));
  const filled = products.filter((x) => Object.keys(x.a).some((k) => k !== "label" && k !== "like") || x.a.label);
  const routine = answers(read(path.join(K, "routine.md")), S.ROUTINE_FIELDS);
  const draft = !final && filled.length < products.length;

  // her general answers: the client questions, and the breakouts concern (where she wrote her routines by skin type)
  const cq = (id) => answers(read(path.join(K, "client-questions", id + ".md")), S.CLIENT_QUESTION_GROUPS.find((g) => g.id === id).questions.map((x) => ({ key: x.key, q: x.q })));
  const before = cq("cq-before"), after = cq("cq-after"), daily = cq("cq-routine");
  // "Yes please." answers the client's question; on a product page the instruction stands on its own
  if (before.stop_products) before.stop_products = before.stop_products.replace(/^yes,? please[.!]?\s*/i, "");
  const acne = answers(read(path.join(K, "concerns/breakouts-and-acne.md")), S.CONCERN_FIELDS);
  const purge = answers(read(path.join(K, "concerns/purging-vs-breakout.md")), S.CONCERN_FIELDS);
  const hard = read(path.join(K, "hard-lines.md"));
  const visits = answers(read(path.join(K, "visits.md")), S.VISIT_FIELDS || []);
  const sentence = (t, re) => (String(t || "").match(/[^.!?]+(?:[.!?]|$)/g) || []).find((x) => re.test(x))?.trim() || "";
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  // her actives, as she lists them when she says what to pause: retinoids and acids (glycolic, lactic, salicylic, mandelic)
  const isActive = (p) => /retin|glycolic|lactic|salicylic|mandelic/i.test(p.name + " " + (p.about || ""));
  const isAcneMed = (p) => /advanced acne med/i.test(p.name);
  // the mandelic serums: her routines and "what not to mix" put them in the morning, her "starting" answer says nights
  const mandelicClash = !routine.mandelic_when && /mandelic[^.]*\bmorning\b/i.test(routine.dont_mix || "") && /\bnights?\b/i.test(routine.mandelic || "");
  const CLASH = "Morning or night? Your routines and \"what not to mix\" put the mandelic serums in the morning; your answer on starting them says a few nights a week.";

  // her routines by skin type, written as sentences in her breakouts answers: each step matched to the products on her shelf
  const ALIAS = [
    [/barrier (balance )?cream(y)? cleanser/i, ["fr-barrier-cream-cleanser"]],
    [/ultra gentle( gel)? cleanser/i, ["fr-ultra-gentle-cleanser", "fr-gentle-gel-cleanser"]],
    [/hydra ?remedy/i, ["fr-hydraremedy-gel-serum"]],
    [/hydra ?balance/i, ["fr-hydrabalance-gel"]],
    [/soothing radiance/i, ["fr-soothing-radiance-toner"]],
    [/moisture balance/i, ["fr-moisture-balance-toner", "fr-moisture-balance-toner-14"]],
    [/cran[- ]?peptide/i, ["fr-cran-peptide-cream"]],
    [/barrier (care )?gel cream/i, ["fr-barrier-gel-cream"]],
    [/eye gel/i, ["fr-antioxidant-eye-gel"]],
    [/brilliant/i, ["fr-brilliant-defense-50"]],
    // "mineral SPF": the mineral sunscreens in her morning picks
    [/mineral spf/i, ["fr-powdermineral-spf-50", "mx-spf-50-mineral-spf"]]
  ];
  const byId = Object.fromEntries(live.map((p) => [p.id, p]));
  const pct = (p) => +((/^([\d.]+)%/.exec(p.name) || [])[1]);
  const strengths = (lo, hi, kind) => live.filter((p) => kind.test(p.name) && pct(p) >= lo && pct(p) <= hi).sort((a, b) => pct(a) - pct(b)).map((p) => p.id);
  const stepIds = (alt) => {
    let m = /(\d+(?:\.\d+)?)%?\s*-\s*(\d+(?:\.\d+)?)%/.exec(alt);
    if (m) return strengths(+m[1], +m[2], /mandelic serum/i);
    m = /(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*acne med/i.exec(alt);
    if (m) return strengths(Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2]), /advanced acne med/i);
    return ALIAS.filter(([re]) => re.test(alt)).flatMap(([, ids]) => ids).filter((id) => byId[id]);
  };
  // her order of steps: thin to thick, and at night the treatment product right after toner
  const ORDER = { Morning: ["Cleansers", "Toners & mists", "Serums", "Eye care", "Moisturizers", "Sun care"], Night: ["Cleansers", "Toners & mists", "Acne & spot care", "Serums", "Eye care", "Moisturizers", "Sun care"] };
  const parseRoutine = (when, text) => {
    if (!text) return [];
    const steps = [];
    for (const part of text.replace(/\([^)]*\)/g, "").split(/,|\band\b(?! for)/i)) {
      // "barrier gel cream or mineral SPF or brilliant": alternatives of one kind are one step, of different kinds separate steps
      const ids = part.split(/\bor\b/i).flatMap(stepIds);
      for (const c of [...new Set(ids.map((id) => byId[id].cat))]) steps.push(ids.filter((id) => byId[id].cat === c));
    }
    return steps.filter((s) => s.length).sort((a, b) => ORDER[when].indexOf(byId[a[0]].cat) - ORDER[when].indexOf(byId[b[0]].cat));
  };
  const grab = (t, re) => (re.exec(t || "") || [])[1] || "";
  const ROUTINES = [
    { when: "Morning", skin: "Dry or normal skin", text: grab(acne.morning, /dry\/normal skin[^,]*?look(?:s)? like ([^\n]+?)\s*(?:\n|$)/i) },
    { when: "Morning", skin: "Oily or combination skin", text: grab(acne.morning, /oily\/combo[^,]*?look(?:s)? like ([^\n]+?)\s*(?:\n|$)/i) },
    { when: "Night", skin: "Dry or normal skin", text: grab(acne.mistakes, /for dry skin types? (.+?)(?: and if clients|\.|$)/i) },
    { when: "Night", skin: "Oily or combination skin", text: grab(acne.mistakes, /oily\/combo skin types? it usually looks like (.+?) and for dry/i) }
  ].map((r) => ({ ...r, steps: parseRoutine(r.when, r.text) })).filter((r) => r.steps.length);
  const alternate = sentence(String(acne.mistakes || "").replace(/ and if clients/i, ". If clients"), /alternate/i).replace(/([^.!?])$/, "$1.");
  const tolerance = /tolerance/i.test(acne.morning || "");
  const inRoutines = (id) => ROUTINES.filter((r) => r.steps.some((s) => s.includes(id))).map((r) => `${r.when}, ${r.skin.toLowerCase()}`);

  // how long a bottle lasts, her rule of thumb by size: "a 1 oz serum, 2 to 3 months; ..."
  const LASTS = [...String(daily.how_long_lasts || "").matchAll(/a (\d+(?:\.\d+)?) oz (serum|moisturizer|cleanser|sunscreen)([^,;]*), ([^;.]+)/gi)]
    .map((m) => ({ oz: +m[1], cat: { serum: "Serums", moisturizer: "Moisturizers", cleanser: "Cleansers", sunscreen: "Sun care" }[m[2].toLowerCase()], what: `a ${m[1]} oz ${m[2]}${m[3]}`, long: m[4].trim() }));
  const lastsFor = (p) => {
    const oz = +((/^([\d.]+) (?:fl )?oz/.exec(p.size || "") || [])[1]);
    const r = LASTS.find((x) => x.cat === p.cat && x.oz === oz);
    return r ? `${cap(r.long)}: Evelyn's rule of thumb for ${r.what}.` : "";
  };

  // what she said once, on each product it applies to; her own card always wins
  const derive = (p) => {
    const d = {};
    const where = inRoutines(p.id);
    if (where.length) d.routines = where.map((x) => "- " + x).join("\n");
    if (isActive(p)) {
      if (before.stop_products) d.pause = before.stop_products;
      if (after.actives_after) d.back = after.actives_after;
      if (routine.stop_signs) d.stop = routine.stop_signs;
    }
    if (/mandelic serum/i.test(p.name)) {
      if (routine.mandelic_when) d.when = routine.mandelic_when;
      if (routine.mandelic && !(mandelicClash && final)) d.how = routine.mandelic;
      if (mandelicClash && !final) d.confirm = CLASH;
      if (tolerance && where.length) d.who = "Which strength depends on your tolerance: start with the one Evelyn gives you.";
    }
    if (/retinal|retinol/i.test(p.name)) {
      if (routine.retinal_vs_retinol) d.how = routine.retinal_vs_retinol;
      if (alternate) d.pairs = cap(alternate);
    }
    if (isAcneMed(p)) {
      const n = sentence(after.breakout_after, /acne program/i);
      if (n) d.normal = n;
      const stop = [routine.stop_signs, purge.escalate].filter(Boolean).join("\n\n");
      if (stop) d.stop = stop;
      if (alternate) d.pairs = cap(alternate);
    }
    const l = lastsFor(p);
    if (l) d.lasts = l;
    return d;
  };
  for (const x of products) { x.mine = { ...x.a }; x.a = { ...derive(x.p), ...x.a }; }

  return { CAT, live, products, filled, routine, draft, before, after, daily, acne, purge, hard, visits, mandelicClash, CLASH, ROUTINES, alternate, tolerance, LASTS, lastsFor, derive, isActive, isAcneMed, pct, byId, inRoutines, strengths };
}

// ── the chat's card per product: her answers and what was derived, as plain lines ──
// "confirm" (the draft's note to Evelyn) and "like" (same as another product) stay off; the label's facts are kept short.
export const CARD_ROWS = [
  ["who", "Who it's for"], ["routines", "In Evelyn's routines"], ["when", "When"], ["how", "How to use it"], ["normal", "What's normal at first"],
  ["stop", "Stop and message Evelyn if"], ["pause", "Before a treatment"], ["back", "After a treatment"], ["sun", "Sun"],
  ["pregnancy", "Pregnant or breastfeeding"], ["pairs", "Pairs with, and not with"], ["tip", "Evelyn's tip"], ["lasts", "Lasts about"], ["label", "From the label"]
];
const oneLine = (t) => String(t).trim().replace(/^-\s*/, "").replace(/\n\s*-\s*/g, "; ").replace(/\s*\n+\s*/g, " ").trim();
/** "2 to 3 months" → 2, "6 weeks" → 1.4: the earlier end, when a bottle may start running low. */
export const monthsOf = (lasts) => {
  const m = /(\d+(?:\.\d+)?)\s*(?:(?:to|-|–)\s*\d+(?:\.\d+)?\s*)?(month|week)/i.exec(String(lasts || ""));
  if (!m) return null;
  const n = +m[1];
  return Math.round((m[2].toLowerCase().startsWith("week") ? n / 4.3 : n) * 10) / 10;
};
export async function cards(root) {
  const D = await derived(root, { final: true });   // final: a line her answers disagree on stays out, as in the finished guide
  const out = {};
  for (const { p, a } of D.products) {
    const rows = CARD_ROWS.filter(([k]) => a[k]).map(([k, t]) => `${t}: ${k === "label" ? oneLine(a[k]).slice(0, 300) : oneLine(a[k])}`);
    out[p.id] = { text: rows.join("\n"), lastsMonths: monthsOf(a.lasts) };
  }
  return out;
}

// ── the chat's skin guide (js/ask-skin.js, written by build-bundle.mjs) ──
// What the website chat answers a skin question from when it has no AI to ask: her routines by skin type
// with each step matched to her shelf, a way to find her products in what a client types, and her own
// lines on dryness, breakouts, purging, dark spots, ingrowns, actives and sun, copied from her answers.
// Nothing is written here: a line she hasn't answered is simply missing, and the chat leaves it out.
const STOP = new Set(["the", "and", "with", "for", "fl", "oz", "ml", "g", "travel", "size", "serum", "cream", "cleanser", "toner", "gel", "spf", "mask", "mist", "lotion", "balm", "treatment", "face", "skin", "daily", "advanced"]);
const paras = (t) => String(t || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const lead = (t) => { const p = paras(t); return p.length > 1 && p[0].length < 40 ? p.slice(1).join(" ") : p.join(" "); };   // drop a tapped option ("3 to 6 months") before her words
const line = (t, re) => (String(t || "").split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim()).find((l) => re.test(l)) || "");
export async function skinGuide(root) {
  const D = await derived(root, { final: true });
  const steps = (when, skin) => (D.ROUTINES.find((r) => r.when === when && r.skin === skin) || { steps: [] }).steps;
  const routines = {
    dry: { morning: steps("Morning", "Dry or normal skin"), night: steps("Night", "Dry or normal skin") },
    oily: { morning: steps("Morning", "Oily or combination skin"), night: steps("Night", "Oily or combination skin") }
  };
  // her products as a client types them: the distinctive words of each name ("cran peptide", "8% mandelic"), plus the
  // shorthand from her own routines (ALIAS in the guide's layer, e.g. "barrier cream cleanser")
  const products = D.live.map((p) => ({ id: p.id, name: p.name, cat: p.cat, consult: !!p.consult,
    words: p.name.toLowerCase().replace(/[()]/g, " ").replace(/-/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) || /^\d+(\.\d+)?%$/.test(w)) }));
  const C = await cards(root);
  const her = {
    avoid: D.acne.avoid ? lead(D.acne.avoid).replace(/\s*\(list examples[^)]*\)/i, "") : "",
    barrier: line(D.acne.habits, /^Dryness, burning/i),
    irritation: line(D.acne.habits, /^If irritation develops/i),
    exfoliation: line(D.acne.habits, /^More exfoliation/i),
    water: line(D.acne.habits, /^Drinking water/i),
    picking: line(D.acne.habits, /^Never pick/i),
    acneFirst: D.acne.first_questions ? lead(D.acne.first_questions) : "",
    acneTimeline: D.acne.timeline ? lead(D.acne.timeline) : "",
    acneEscalate: D.acne.escalate ? lead(D.acne.escalate) : "",
    purge: D.purge.timeline ? lead(D.purge.timeline) : "",
    purgeEscalate: D.purge.escalate ? lead(D.purge.escalate) : "",
    breakoutAfter: D.after.breakout_after ? lead(D.after.breakout_after) : "",
    sun: D.routine.sun ? lead(D.routine.sun) : "",
    sunscreen: D.daily.sunscreen ? lead(D.daily.sunscreen) : "",
    mandelic: D.routine.mandelic ? lead(D.routine.mandelic) : "",
    retinal: D.routine.retinal_vs_retinol ? lead(D.routine.retinal_vs_retinol) : "",
    dontMix: D.routine.dont_mix ? lead(D.routine.dont_mix) : "",
    order: D.routine.order ? lead(D.routine.order) : "",
    stopSigns: D.routine.stop_signs ? lead(D.routine.stop_signs) : "",
    ownProducts: D.daily.own_products ? lead(D.daily.own_products) : "",
    alternate: D.alternate || ""
  };
  const conc = (id) => { const f = path.join(root, "knowledge/concerns", id + ".md"); return fs.existsSync(f) ? answers(fs.readFileSync(f, "utf8"), S.CONCERN_FIELDS) : {}; };
  const spots = conc("dark-spots"), ingrown = conc("ingrown-hairs");
  Object.assign(her, {
    spotsHabits: spots.habits ? lead(spots.habits) : "", spotsAvoid: spots.avoid ? lead(spots.avoid) : "", spotsEscalate: spots.escalate ? lead(spots.escalate) : "",
    ingrownHabits: ingrown.habits ? lead(ingrown.habits) : "", ingrownAvoid: ingrown.avoid ? lead(ingrown.avoid) : "", ingrownEscalate: ingrown.escalate ? lead(ingrown.escalate) : ""
  });
  for (const k of Object.keys(her)) her[k] = her[k].replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  return { routines, products, cards: Object.fromEntries(Object.entries(C).filter(([, c]) => c.text).map(([id, c]) => [id, c.text])), her, tolerance: !!D.tolerance };
}
