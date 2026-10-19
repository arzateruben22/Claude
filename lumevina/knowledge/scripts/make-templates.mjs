// Writes the empty knowledge files Evelyn's playbook answers fill:
//   knowledge/client-questions/<id>.md   one per group of questions clients text her
//   knowledge/concerns/<id>.md           one per skin concern
//   knowledge/treatments/explained/<id>.md  one per treatment: what to expect
//   knowledge/treatments/<id>.md         one per treatment's aftercare
//   knowledge/products/<id>.md           one per live product (label facts filled, her notes empty)
//   knowledge/visits.md, routine.md, materials.md, hard-lines.md, voice.md
//
// Safe to run again: a file that already has answers in it is left alone.
//   node knowledge/scripts/make-templates.mjs      (from lumevina/)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const K = path.join(root, "knowledge");

globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;

const front = (o) => "---\n" + Object.entries(o).map(([k, v]) => `${k}: ${v === "" ? '""' : v}`).join("\n") + "\n---\n";
const section = (f) => `## ${f.q}\n\n_(not answered yet)_\n`;
const hasAnswers = (file) => fs.existsSync(file) && !/answered: ""/.test(fs.readFileSync(file, "utf8"));
const write = (file, text) => {
  if (hasAnswers(file)) { console.log("kept   ", path.relative(root, file)); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

for (const g of S.CLIENT_QUESTION_GROUPS) {
  write(path.join(K, "client-questions", g.id + ".md"),
    front({ id: g.id, kind: "client-questions", title: g.title, source: "playbook", answered: "" }) +
    `\n# Questions clients ask: ${g.title}\n\nThe exact questions clients text Evelyn, with her answers. Empty sections mean she hasn't answered yet: the assistant hands those questions to her.\n\n` +
    g.questions.map(section).join("\n"));
}
for (const t of S.TREATMENT_DETAILS) {
  write(path.join(K, "treatments", "explained", t.id + ".md"),
    front({ id: t.id, kind: "treatment-explained", title: t.title, source: "playbook", answered: "" }) +
    `\n# ${t.title}: what to expect\n\n` + S.TREATMENT_DETAIL_FIELDS.map(section).join("\n"));
}
for (const c of S.CONCERNS) {
  write(path.join(K, "concerns", c.id + ".md"),
    front({ id: c.id, kind: "concern", title: c.title, source: "playbook", answered: "" }) +
    `\n# ${c.title}\n\nEvelyn's own words, from her Skin Playbook. Empty sections mean she hasn't answered yet: the assistant hands those questions to her.\n\n` +
    S.CONCERN_FIELDS.map(section).join("\n"));
}
for (const t of S.TREATMENT_AFTERCARE) {
  write(path.join(K, "treatments", t.id + ".md"),
    front({ id: t.id, kind: "treatment", title: t.title, source: "playbook", answered: "" }) +
    `\n# ${t.title}: aftercare\n\n` + S.AFTERCARE_FIELDS.map(section).join("\n"));
}
for (const p of CAT.products.filter((x) => !x.draft)) {
  write(path.join(K, "products", p.id + ".md"),
    front({ id: p.id, kind: "product", title: p.name, brand: p.brand, category: p.cat, size: p.size || "", price: p.price, source: "label + playbook", answered: "" }) +
    `\n# ${p.name}\n\n**Brand:** ${p.brand}  \n**Type:** ${p.cat}  \n**Size:** ${p.size || "(not on file)"}  \n**Price:** $${p.price}  \n` +
    (p.about ? `**On the label:** ${p.about}\n` : "") +
    (p.inv ? `**In her GlossGenius inventory as:** ${p.inv}\n` : "") +
    `\nLabel facts above come from the product's own packaging. Everything below is Evelyn's.\n\n` +
    S.PRODUCT_FIELDS.map(section).join("\n"));
}
write(path.join(K, "visits.md"), front({ id: "visits", kind: "visits", title: "Visits and the studio", source: "playbook", answered: "" }) +
  "\n# Visits and the studio\n\n" + S.VISIT_FIELDS.map(section).join("\n"));
write(path.join(K, "materials.md"), front({ id: "materials", kind: "materials", title: "Her own materials", source: "playbook", answered: "" }) +
  "\n# Her own materials\n\nThings Evelyn already had written (aftercare cards, product guides, posts, texts she sends a lot), from her screenshots.\n\n" +
  S.MATERIALS_FIELDS.map(section).join("\n"));
write(path.join(K, "routine.md"), front({ id: "routine", kind: "routine", title: "Her products, in order", source: "playbook", answered: "" }) +
  "\n# Her products, in order\n\n" + S.ROUTINE_FIELDS.map(section).join("\n"));
write(path.join(K, "hard-lines.md"), front({ id: "hard-lines", kind: "hard-lines", title: "Hard lines", source: "playbook", answered: "" }) +
  "\n# Hard lines\n\nWhat the assistant must never answer and always hands to Evelyn. The code's own rules (js/ask-rules.js) always apply on top of this list.\n\n" +
  S.HARD_LINE_FIELDS.map(section).join("\n"));
write(path.join(K, "voice.md"), front({ id: "voice", kind: "voice", title: "Her voice", source: "playbook", answered: "" }) +
  "\n# Her voice\n\n" + S.VOICE_FIELDS.map(section).join("\n"));
console.log("templates ready");
