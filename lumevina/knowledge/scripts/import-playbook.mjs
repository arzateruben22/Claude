// Turns Evelyn's saved playbook answers into the knowledge files, keeping her words.
//
//   node knowledge/scripts/import-playbook.mjs <folder-of-json>     (from lumevina/)
//
// The folder holds one JSON file per section, as the questionnaire's database
// stores them (ArtifactData "list" on collection "playbook", saved with out_dir):
//   playbook/concerns.json, aftercare.json, routine.json, products.json, hard-lines.json, voice.json
// each shaped { "id": "<section>", "data": { "answers": { "<item>.<field>": ... } } } or just the answers object.
//
// Every file gets today's date in "answered:". A question she skipped keeps
// "_(not answered yet)_" so the assistant knows to hand it to her.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const K = path.join(root, "knowledge");
const dir = process.argv[2];
if (!dir) { console.error("usage: node knowledge/scripts/import-playbook.mjs <folder with the playbook JSON files>"); process.exit(1); }

const today = new Date().toISOString().slice(0, 10);
const readSection = (sid) => {
  const f = path.join(dir, sid + ".json");
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return (j.data && j.data.answers) || j.answers || j;
};
const has = (v) => Array.isArray(v) ? v.some((x) => x && String(x).trim()) : !!(v && String(v).trim());
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
const file = (rel, front, title, lead, fields, answers, itemId) => {
  let body = fields.map((f) => `## ${f.q}\n\n${render(f, answers[itemId + "." + f.key], answers[itemId + "." + f.key + ".text"])}\n`).join("\n");
  const notes = answers[itemId + ".voice"];
  if (Array.isArray(notes) && notes.length) {
    // her recordings stay in the questionnaire's file store; fetch one with the Artifact tool (read, path = the asset id)
    body += `\n## Voice notes\n\n` + notes.map((n) => `- ${n.name || "Voice note"} (asset ${n.id}, ${String(n.at || "").slice(0, 10)})`).join("\n") + "\n";
  }
  const answered = fields.some((f) => has(answers[itemId + "." + f.key]) || has(answers[itemId + "." + f.key + ".text"])) ? today : "";
  const fm = "---\n" + Object.entries({ ...front, answered }).map(([k, v]) => `${k}: ${v === "" ? '""' : v}`).join("\n") + "\n---\n";
  fs.mkdirSync(path.dirname(path.join(K, rel)), { recursive: true });
  fs.writeFileSync(path.join(K, rel), fm + `\n# ${title}\n\n${lead}\n\n` + body);
  return answered ? 1 : 0;
};

let n = 0;
const concerns = readSection("concerns") || {};
for (const c of S.CONCERNS) n += file(`concerns/${c.id}.md`, { id: c.id, kind: "concern", title: c.title, source: "playbook" }, c.title,
  "Evelyn's own words, from her Skin Playbook. Empty sections mean she hasn't answered yet: the assistant hands those questions to her.", S.CONCERN_FIELDS, concerns, c.id);
const after = readSection("aftercare") || {};
for (const t of S.TREATMENT_AFTERCARE) n += file(`treatments/${t.id}.md`, { id: t.id, kind: "treatment", title: t.title, source: "playbook" }, `${t.title}: aftercare`, "", S.AFTERCARE_FIELDS, after, t.id);
const routine = readSection("routine") || {};
n += file("routine.md", { id: "routine", kind: "routine", title: "Her products, in order", source: "playbook" }, "Her products, in order", "", S.ROUTINE_FIELDS, routine, "routine");
const hard = readSection("hard-lines") || {};
n += file("hard-lines.md", { id: "hard-lines", kind: "hard-lines", title: "Hard lines", source: "playbook" }, "Hard lines",
  "What the assistant must never answer and always hands to Evelyn. The code's own rules (js/ask-rules.js) always apply on top of this list.", S.HARD_LINE_FIELDS, hard, "hard-lines");
const voice = readSection("voice") || {};
n += file("voice.md", { id: "voice", kind: "voice", title: "Her voice", source: "playbook" }, "Her voice", "", S.VOICE_FIELDS, voice, "voice");

// products: label facts from the catalog, her notes from the playbook
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const prods = readSection("products") || {};
for (const p of CAT.products.filter((x) => !x.draft)) {
  const lead = `**Brand:** ${p.brand}  \n**Type:** ${p.cat}  \n**Size:** ${p.size || "(not on file)"}  \n**Price:** $${p.price}  \n` +
    (p.about ? `**On the label:** ${p.about}\n` : "") + (p.inv ? `**In her GlossGenius inventory as:** ${p.inv}\n` : "") +
    "\nLabel facts above come from the product's own packaging. Everything below is Evelyn's.";
  n += file(`products/${p.id}.md`, { id: p.id, kind: "product", title: p.name, brand: p.brand, category: p.cat, size: p.size || "", price: p.price, source: "label + playbook" }, p.name, lead, S.PRODUCT_FIELDS, prods, p.id);
}
console.log(`imported: ${n} files with answers (dated ${today}). Now run: node knowledge/scripts/build-bundle.mjs`);
