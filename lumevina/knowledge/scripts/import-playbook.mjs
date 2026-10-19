// Turns Evelyn's saved playbook answers into the knowledge files, keeping her words.
//
//   node knowledge/scripts/read-screenshots.mjs <folder-of-json> <folder-of-images>   (first, if she added screenshots)
//   node knowledge/scripts/import-playbook.mjs <folder-of-json>                       (from lumevina/)
//
// The folder holds one JSON file per section, as the questionnaire's database
// stores them (ArtifactData "list" on collection "playbook", saved with out_dir):
//   client-questions.json, concerns.json, treatments.json, aftercare.json, visits.json,
//   routine.json, products.json, materials.json, hard-lines.json, voice.json
// each shaped { "id": "<section>", "data": { "answers": { "<item>.<field>": ... } } } or just the answers object.
// (interview.json, the Talk it through conversation, is a record only: the
// answers it gathered are already in the section files.)
//
// Every file gets today's date in "answered:". A question she skipped keeps
// "_(not answered yet)_" so the assistant knows to hand it to her. What her
// screenshots say (knowledge/screenshots/<id>.md) goes in under the card she
// added them to.

import fs from "node:fs";
import path from "node:path";
import * as S from "./playbook-spec.mjs";
import { K, ROOT, has, readSection, transcript } from "./playbook-data.mjs";

const dir = process.argv[2];
if (!dir) { console.error("usage: node knowledge/scripts/import-playbook.mjs <folder with the playbook JSON files>"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const section = (sid) => readSection(dir, sid) || {};
const render = (f, v, extra) => {
  if (!has(v) && !has(extra)) return "_(not answered yet)_";
  let out = "";
  if (has(v)) {
    if (f.kind === "list") out += v.filter((x) => x && x.trim()).map((x, i) => `${i + 1}. ${x.trim()}`).join("\n");
    else if (Array.isArray(v)) out += v.map((x) => `- ${x}`).join("\n");
    else out += String(v).trim();
  }
  if (has(extra)) out += (out ? "\n\n" : "") + String(extra).trim();
  return out;
};
let unread = 0;
const file = (rel, front, title, lead, fields, answers, itemId) => {
  let body = fields.map((f) => `## ${f.q}\n\n${render(f, answers[itemId + "." + f.key], answers[itemId + "." + f.key + ".text"])}\n`).join("\n");
  // her screenshots, as read by read-screenshots.mjs (the files stay in the questionnaire's asset store)
  const shots = Array.isArray(answers[itemId + ".shots"]) ? answers[itemId + ".shots"] : [];
  const kept = [];
  for (const n of shots) {
    const t = transcript(n.id);
    if (!t) { unread++; body += `\n<!-- screenshot ${n.id} ("${n.name || "Screenshot"}") not read yet: knowledge/scripts/read-screenshots.mjs -->\n`; }
    else if (t.keep) kept.push(t.text);
  }
  if (kept.length) body += `\n## From her screenshots\n\n` + kept.join("\n\n---\n\n") + "\n";
  const notes = answers[itemId + ".voice"];
  if (Array.isArray(notes) && notes.length) {
    // her recordings stay in the questionnaire's file store; fetch one with the Artifact tool (read, path = the asset id)
    body += `\n<!-- voice notes: ` + notes.map((n) => `${n.name || "Voice note"} (asset ${n.id}, ${String(n.at || "").slice(0, 10)})`).join("; ") + " -->\n";
  }
  const answered = fields.some((f) => has(answers[itemId + "." + f.key]) || has(answers[itemId + "." + f.key + ".text"])) || kept.length ? today : "";
  const fm = "---\n" + Object.entries({ ...front, answered }).map(([k, v]) => `${k}: ${v === "" ? '""' : v}`).join("\n") + "\n---\n";
  fs.mkdirSync(path.dirname(path.join(K, rel)), { recursive: true });
  fs.writeFileSync(path.join(K, rel), fm + `\n# ${title}\n\n${lead ? lead + "\n\n" : ""}` + body);
  return answered ? 1 : 0;
};
const LEAD = "Evelyn's own words, from her Skin Playbook. Empty sections mean she hasn't answered yet: the assistant hands those questions to her.";

let n = 0;
const cq = section("client-questions");
for (const g of S.CLIENT_QUESTION_GROUPS) n += file(`client-questions/${g.id}.md`, { id: g.id, kind: "client-questions", title: g.title, source: "playbook" },
  `Questions clients ask: ${g.title}`, "The exact questions clients text Evelyn, with her answers. " + LEAD.split(". ")[1],
  g.questions.map((x) => ({ key: x.key, kind: "text", q: x.q })), cq, g.id);
const concerns = section("concerns");
for (const c of S.CONCERNS) n += file(`concerns/${c.id}.md`, { id: c.id, kind: "concern", title: c.title, source: "playbook" }, c.title, LEAD, S.CONCERN_FIELDS, concerns, c.id);
const explained = section("treatments");
for (const t of S.TREATMENT_DETAILS) n += file(`treatments/explained/${t.id}.md`, { id: t.id, kind: "treatment-explained", title: t.title, source: "playbook" },
  `${t.title}: what to expect`, "", S.TREATMENT_DETAIL_FIELDS, explained, t.id);
const after = section("aftercare");
for (const t of S.TREATMENT_AFTERCARE) n += file(`treatments/${t.id}.md`, { id: t.id, kind: "treatment", title: t.title, source: "playbook" }, `${t.title}: aftercare`, "", S.AFTERCARE_FIELDS, after, t.id);
n += file("visits.md", { id: "visits", kind: "visits", title: "Visits and the studio", source: "playbook" }, "Visits and the studio", "", S.VISIT_FIELDS, section("visits"), "visits");
n += file("routine.md", { id: "routine", kind: "routine", title: "Her products, in order", source: "playbook" }, "Her products, in order", "", S.ROUTINE_FIELDS, section("routine"), "routine");
n += file("materials.md", { id: "materials", kind: "materials", title: "Her own materials", source: "playbook" }, "Her own materials",
  "Things Evelyn already had written (aftercare cards, product guides, posts, texts she sends a lot), from her screenshots.", S.MATERIALS_FIELDS, section("materials"), "materials");
n += file("hard-lines.md", { id: "hard-lines", kind: "hard-lines", title: "Hard lines", source: "playbook" }, "Hard lines",
  "What the assistant must never answer and always hands to Evelyn. The code's own rules (js/ask-rules.js) always apply on top of this list.", S.HARD_LINE_FIELDS, section("hard-lines"), "hard-lines");
n += file("voice.md", { id: "voice", kind: "voice", title: "Her voice", source: "playbook" }, "Her voice", "", S.VOICE_FIELDS, section("voice"), "voice");

// products: label facts from the catalog, her notes from the playbook
globalThis.window = {};
await import(path.join(ROOT, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const prods = section("products");
for (const p of CAT.products.filter((x) => !x.draft)) {
  const lead = `**Brand:** ${p.brand}  \n**Type:** ${p.cat}  \n**Size:** ${p.size || "(not on file)"}  \n**Price:** $${p.price}  \n` +
    (p.about ? `**On the label:** ${p.about}\n` : "") + (p.inv ? `**In her GlossGenius inventory as:** ${p.inv}\n` : "") +
    "\nLabel facts above come from the product's own packaging. Everything below is Evelyn's.";
  n += file(`products/${p.id}.md`, { id: p.id, kind: "product", title: p.name, brand: p.brand, category: p.cat, size: p.size || "", price: p.price, source: "label + playbook" }, p.name, lead, S.PRODUCT_FIELDS, prods, p.id);
}
console.log(`imported: ${n} files with answers (dated ${today}).` + (unread ? ` ${unread} screenshot${unread === 1 ? "" : "s"} not read yet: run read-screenshots.mjs first, then import again.` : "") + " Now run: node knowledge/scripts/build-bundle.mjs");
