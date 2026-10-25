// Skin School, bulked from what's known: Evelyn's own playbook answers, the
// general esthetics layer (knowledge/general/*.md) and her shelf, mapped onto
// each lesson of the course (docs/school/curriculum.js).
//
//   node knowledge/scripts/build-course-notes.mjs      (from lumevina/)
//   → docs/school/notes.js   window.SCHOOL_NOTES = { "<lesson id>": { evelyn, general, shelf } }
//
// The course player shows them under each lesson: "Evelyn says" (her words,
// only where she has answered), "The general picture" (standard practice,
// hedged), and "On Evelyn's shelf" (products with their label line). Run it
// again after importing new answers (knowledge/README.md), then
// python3 docs/school/build.py. Nothing here is a claim she hasn't made or a
// label doesn't; the general layer never names a product.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const K = path.join(root, "knowledge");
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";

// ── which sources feed which lesson. general: "<file>#<heading>"; evelyn:
// "<knowledge path>#<field key>" or "#*" for every answered field; shelf: categories ──
const MAP = {
  "1-1": { general: ["skin-basics#Turnover and why results take weeks", "skin-basics#Skin tone and sensitivity to injury", "skin-basics#Oil, pores and what can't change"] },
  "1-2": { general: ["skin-basics#Skin type vs. skin condition", "skin-basics#Dry vs. dehydrated", "skin-basics#Oil, pores and what can't change"] },
  "1-3": { general: ["skin-basics#The barrier", "skin-basics#Dry vs. dehydrated", "routine#Starting with less", "ingredients#Hydrators and moisturizers"], shelf: ["Moisturizers"] },
  "2-1": { general: ["ingredients#Cleansers"], shelf: ["Cleansers"], evelyn: ["client-questions/cq-after#wash_after"] },
  "2-2": { general: ["ingredients#Hydrators and moisturizers"], shelf: ["Moisturizers"] },
  "2-3": { general: ["ingredients#Sunscreen", "skin-basics#Sun"], shelf: ["Sun care"], evelyn: ["client-questions/cq-routine#sunscreen", "routine#sun"] },
  "3-1": { general: ["ingredients#Fragrance and essential oils", "ingredients#Brighteners"] },
  "3-2": { general: ["routine#Starting with less", "routine#Using other brands alongside", "routine#How much to use"], evelyn: ["client-questions/cq-routine#buy_everything", "client-questions/cq-routine#own_products", "routine#order"] },
  "3-3": { general: ["routine#Missing days", "routine#Traveling", "routine#How long things last (rough)"], evelyn: ["client-questions/cq-routine#missed_days", "client-questions/cq-routine#travel", "client-questions/cq-routine#how_long_lasts", "client-questions/cq-results#between_visits"] },
  "4-1": { general: ["ingredients#Exfoliants"], shelf: ["Serums"], evelyn: ["routine#mandelic"] },
  "4-2": { general: ["routine#Introducing something new"] },
  "4-3": { general: ["treatments#Dermaplaning", "aftercare#After dermaplaning"], evelyn: ["treatments/explained/explain-dermaplaning#*", "treatments/dermaplaning#*"] },
  "5-1": { general: ["ingredients#Brighteners"] },
  "5-2": { general: ["ingredients#Retinoids"], evelyn: ["routine#retinal_vs_retinol"] },
  "5-3": { general: ["ingredients#Acne actives"] },
  "6-1": { general: ["routine#The order of steps"], evelyn: ["routine#order"] },
  "6-2": { general: ["routine#What generally isn't combined"], evelyn: ["routine#dont_mix"] },
  "6-3": { general: ["concerns#Purging vs. a breakout", "routine#Introducing something new"], evelyn: ["concerns/purging-vs-breakout#*", "client-questions/cq-after#breakout_after"] },
  "7-3": { general: ["routine#Traveling", "skin-basics#Sun", "concerns#Dryness and dehydration"] },
  "8-1": { general: ["concerns#Breakouts and acne", "skin-basics#Hormones", "concerns#Blackheads and congestion"], evelyn: ["concerns/breakouts-and-acne#first_questions", "concerns/breakouts-and-acne#escalate"] },
  "8-2": { general: ["ingredients#Acne actives"], shelf: ["Acne & spot care"], evelyn: ["concerns/breakouts-and-acne#morning", "concerns/breakouts-and-acne#night", "concerns/breakouts-and-acne#avoid", "routine#acne_med"] },
  "8-3": { general: ["concerns#Hormonal breakouts", "concerns#Back and body breakouts", "ingredients#Supplements"], evelyn: ["concerns/breakouts-and-acne#timeline", "concerns/breakouts-and-acne#mistakes", "concerns/breakouts-and-acne#habits", "client-questions/cq-results#acne_how_long"] },
  "9-1": { general: ["concerns#Dark spots and post-acne marks", "ingredients#Brighteners", "skin-basics#Skin tone and sensitivity to injury"], evelyn: ["concerns/dark-spots#*"] },
  "9-2": { general: ["ingredients#Brighteners"] },
  "9-3": { general: ["concerns#Melasma and sun spots", "skin-basics#Sun", "ingredients#Sunscreen"], evelyn: ["concerns/melasma#*"] },
  "10-1": { general: ["concerns#Fine lines and firmness", "skin-basics#Sun", "treatments#Microchanneling and microneedling (collagen induction)"] },
  "10-2": { general: ["ingredients#Retinoids", "ingredients#Hydrators and moisturizers"] },
  "10-3": { general: ["treatments#A professional facial", "treatments#Chemical peels", "treatments#Microchanneling and microneedling (collagen induction)", "treatments#LED light"],
    evelyn: ["treatments/explained/explain-ageless-grace#*", "treatments/explained/explain-procell#*", "treatments/explained/explain-refresh-peel#*", "treatments/explained/explain-corrective-peel#*"] },
  "11-1": { general: ["concerns#Redness and sensitivity", "ingredients#Fragrance and essential oils", "red-flags-and-scope#Allergies and sensitivities"], evelyn: ["concerns/redness-sensitivity#*"] },
  "11-2": { general: ["red-flags-and-scope#Standard contraindications (why a treatment waits)"] },
  "11-3": { general: ["red-flags-and-scope#Always a doctor", "red-flags-and-scope#What an esthetician does, and doesn't"], evelyn: ["hard-lines#always_evelyn", "hard-lines#never_say"] },
  "12-1": { general: ["red-flags-and-scope#Standard contraindications (why a treatment waits)"], evelyn: ["client-questions/cq-before#stop_products", "client-questions/cq-before#sun_before", "client-questions/cq-before#breaking_out", "client-questions/cq-before#period"] },
  "12-2": { general: ["aftercare#After any facial, peel, dermaplaning or microchanneling", "aftercare#After a peel in particular", "aftercare#After microchanneling"],
    evelyn: ["treatments/facials#*", "treatments/light-peel#*", "treatments/medium-peel#*", "treatments/procell#*", "client-questions/cq-after#makeup_after", "client-questions/cq-after#workout_after", "client-questions/cq-after#actives_after", "client-questions/cq-after#peeling_after"] },
  "12-3": { general: ["aftercare#Why the rules exist", "red-flags-and-scope#Always a doctor"], evelyn: ["treatments/facials#normal", "treatments/facials#not_normal", "treatments/medium-peel#normal", "treatments/medium-peel#not_normal"] },
  "13-1": { general: ["waxing#Before", "waxing#First Brazilian tips"], evelyn: ["client-questions/cq-before#hair_length", "client-questions/cq-before#shave_before", "client-questions/cq-before#first_wax", "treatments/explained/explain-brazilian#*"] },
  "13-2": { general: ["waxing#After (24 to 48 hours)", "waxing#After that: preventing ingrown hairs", "waxing#What's normal", "waxing#What isn't", "waxing#How often, and does it get better"],
    evelyn: ["client-questions/cq-after#bumps_after_wax", "client-questions/cq-results#wax_how_often", "client-questions/cq-results#wax_pain", "treatments/waxing#*", "treatments/brazilian#*", "concerns/ingrown-hairs#*"] },
  "14-1": { general: ["treatments#Consultations", "treatments#Acne programs", "treatments#A professional facial", "red-flags-and-scope#Standard contraindications (why a treatment waits)"], evelyn: ["visits#first_visit", "visits#wear_bring", "visits#makeup_arrive", "client-questions/cq-booking#which_facial", "concerns/breakouts-and-acne#facial", "treatments/explained/explain-new-client#*"] },
  "14-2": { general: ["routine#The order of steps"], shelf: ["Cleansers", "Toners & mists", "Serums", "Moisturizers", "Sun care"], evelyn: ["concerns/breakouts-and-acne#morning", "routine#order", "client-questions/cq-routine#buy_everything"] },
};

// ── her question headings, by file kind and field key ──
const Q = {};
const set = (kind, item, fields) => { Q[kind + "/" + item] = Object.fromEntries(fields.map((f) => [f.key, f.q])); };
S.CLIENT_QUESTION_GROUPS.forEach((g) => set("client-questions", g.id, g.questions));
S.CONCERNS.forEach((c) => set("concerns", c.id, S.CONCERN_FIELDS));
S.TREATMENT_DETAILS.forEach((t) => set("treatments/explained", t.id, S.TREATMENT_DETAIL_FIELDS));
S.TREATMENT_AFTERCARE.forEach((t) => set("treatments", t.id, S.AFTERCARE_FIELDS));
set("", "visits", S.VISIT_FIELDS); set("", "routine", S.ROUTINE_FIELDS); set("", "hard-lines", S.HARD_LINE_FIELDS); set("", "voice", S.VOICE_FIELDS);
// her Skin School card for each module (knowledge/school/module-<n>.md): her tip per lesson, and what she'd change
globalThis.window = globalThis.window || {};
await import(path.join(root, "docs/school/curriculum.js"));
const LESSONS = globalThis.window.SCHOOL.levels.flatMap((lv) => lv.modules.flatMap((m) => m.lessons.map((ls) => ({ ls, module: "module-" + m.lessons[0].id.split("-")[0] }))));
globalThis.window.SCHOOL.levels.forEach((lv) => lv.modules.forEach((m) => set("school", "module-" + m.lessons[0].id.split("-")[0], m.lessons.flatMap(S.SCHOOL_FIELDS))));

const clean = (t) => t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/_\(How to read this:[^)]*\)_/g, "").replace(/\s+/g, " ").trim();
const sections = (md) => {
  const out = {};
  let h = null, buf = [];
  const flush = () => { if (h) out[h] = buf.join("\n").trim(); };
  for (const line of md.replace(/^---[\s\S]*?---\s*/, "").split("\n")) {
    const m = /^## (.+)$/.exec(line);
    if (m) { flush(); h = m[1].trim(); buf = []; } else if (h) buf.push(line);
  }
  flush();
  return out;
};
const points = (body, max) => {
  const out = [];
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.every((l) => /^[-*] /.test(l))) lines.forEach((l) => out.push(clean(l.replace(/^[-*] /, ""))));
    else out.push(clean(lines.join(" ")));
  }
  return out.filter((p) => p.length > 20).slice(0, max);
};

// her answer to one question, as one or two short notes in her words
const herNotes = (kind, item, key) => {
  const file = path.join(K, (kind ? kind + "/" : "") + item + ".md");
  const md = read(file);
  if (!md || !/answered: "?\d{4}/.test(md)) return [];
  const secs = sections(md);
  const qs = Q[(kind ? kind + "/" : "") + item] || {};
  const keys = key === "*" ? Object.keys(qs) : [key];
  const out = [];
  for (const k of keys) {
    const q = qs[k], body = q ? secs[q] : null;
    if (!body || /_\(not answered yet\)_/.test(body)) continue;
    const label = String(q).replace(/^"|"$/g, "").replace(/\?$/, "");
    const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !/^_\(How to read/.test(p));
    const list = paras.filter((p) => /^(- |\d+\. )/.test(p)).flatMap((p) => p.split("\n").map((l) => clean(l.replace(/^(- |\d+\. )/, ""))));
    const text = paras.filter((p) => !/^(- |\d+\. )/.test(p)).map(clean).join(" ");
    const picks = list.length > 8 ? `${list.slice(0, 8).join(", ")} and ${list.length - 8} more` : list.join(", ");
    if (text) out.push(kind === "school" ? text : `${label}: ${text}`);   // her tip for a lesson needs no label
    if (list.length) out.push(text ? `Her picks: ${picks}.` : `${label}: ${picks}.`);
  }
  return out;
};

// her shelf, by category
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const shelfFor = (cats) => CAT.products.filter((p) => !p.draft && !p.hidden && cats.includes(p.cat)).slice(0, 6)
  .map((p) => ({ id: p.id, name: p.name, brand: p.brand, price: p.price, about: p.about || "" }));

const GENERAL = Object.fromEntries(fs.readdirSync(path.join(K, "general")).filter((f) => f.endsWith(".md")).map((f) => [f.replace(/\.md$/, ""), sections(read(path.join(K, "general", f)))]));
const notes = {};
let withHer = 0, missing = [];
for (const [id, m] of Object.entries(MAP)) {
  const general = [];
  for (const ref of m.general || []) {
    const [file, heading] = ref.split("#");
    const body = GENERAL[file]?.[heading];
    if (!body) { missing.push(ref); continue; }
    general.push(...points(body, 5));
  }
  const evelyn = [];
  for (const ref of m.evelyn || []) {
    const [p, key] = ref.split("#");
    const parts = p.split("/"), item = parts.pop(), kind = parts.join("/");
    evelyn.push(...herNotes(kind, item, key));
  }
  const n = { evelyn: evelyn.slice(0, 6), general: general.slice(0, 8), shelf: m.shelf ? shelfFor(m.shelf) : [] };
  if (n.evelyn.length) withHer++;
  notes[id] = n;
}
// her own tip for each lesson goes first; a lesson she wants changed is listed for whoever edits the course
const changes = [];
for (const { ls, module } of LESSONS) {
  const tip = herNotes("school", module, ls.id + "_tip");
  const n = notes[ls.id] || (notes[ls.id] = { evelyn: [], general: [], shelf: [] });
  if (tip.length) { if (!n.evelyn.length) withHer++; n.evelyn = [...tip, ...n.evelyn].slice(0, 6); }
  const verdict = herNotes("school", module, ls.id + "_ok").join(" ");
  if (/Change something/.test(verdict)) changes.push(`  ${ls.id} ${ls.t}: ${verdict.replace(/^Change something\s*/, "") || "(no details yet)"}`);
}
if (changes.length) console.warn(`Evelyn wants ${changes.length} lesson${changes.length === 1 ? "" : "s"} changed (edit docs/school/curriculum.js, then rebuild):\n` + changes.join("\n"));
if (missing.length) console.warn("sections not found:", missing.join(", "));
const built = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(root, "docs/school/notes.js"),
  `/* GENERATED by knowledge/scripts/build-course-notes.mjs on ${built}: Evelyn's answers, the general layer and her shelf, per lesson. Don't edit; rebuild. */\n` +
  `window.SCHOOL_NOTES = ${JSON.stringify(notes)};\nwindow.SCHOOL_NOTES_BUILT = "${built}";\n`);
console.log(`course notes: ${Object.keys(notes).length} lessons, ${withHer} with Evelyn's own words, ${Object.values(notes).reduce((a, n) => a + n.general.length, 0)} general points → docs/school/notes.js`);
