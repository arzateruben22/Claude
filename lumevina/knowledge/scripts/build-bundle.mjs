// Packs what Ask Lumevina may know into one bundle:
//   server/functions/_shared/knowledge.ts   imported by the ask edge function
//   knowledge/eval/bundle.json              the same, for the eval runner
//   texting/knowledge.md                    the same, for Evelyn's texting assistant
//
//   node knowledge/scripts/build-bundle.mjs      (from lumevina/)
//
// Sources: knowledge/prompt.md, every knowledge *.md with answers in it (her
// screenshots' transcripts are already folded into those by import-playbook.mjs), the
// homepage's FAQ and policies (index.html), the catalog (js/catalog.js), the
// studio facts below, and the hand-off rules (js/ask-rules.js).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const K = path.join(root, "knowledge");
const read = (p) => fs.readFileSync(p, "utf8");

// ── the catalog and the rules, through the browser globals they set ──
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
await import(path.join(root, "js/ask-rules.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const RULES = globalThis.window.LumevinaAskRules;
const re = (r) => ({ source: r.source, flags: r.flags });
const rules = {
  urgent: re(RULES.URGENT),
  kinds: RULES.KINDS.map((k) => ({ kind: k.kind, any: (k.any || []).map(re), both: k.both ? k.both.map(re) : undefined }))
};

// ── FAQ and policies, as plain text, from the homepage ──
const html = read(path.join(root, "index.html"));
const text = (h) => h
  .replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<span class="policy-num">[^<]*<\/span>/g, "")
  .replace(/<li>/g, "\n- ").replace(/<\/?(p|ul|li|div|br)[^>]*>/g, "\n").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&rsquo;|&#8217;/g, "’").replace(/&lsquo;/g, "‘").replace(/&rdquo;/g, "”").replace(/&ldquo;/g, "“")
  .replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…").replace(/&rarr;/g, "→").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
  .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const details = (block) => [...block.matchAll(/<details class="policy"[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="policy-body">([\s\S]*?)<\/div>\s*<\/details>/g)]
  .map((m) => ({ q: text(m[1]), a: text(m[2]) }));
// the FAQ and the policies are one list on the page (<div class="fp-list"> … <!-- /fp-list -->)
const fpBlock = html.slice(html.indexOf('<div class="fp-list"'), html.indexOf('<!-- /fp-list -->'));
const policies = details(fpBlock);
if (!policies.length) throw new Error("couldn't read the FAQ & Policies list from index.html");

// ── her menu (js/services.js), as one line for the assistant ──
await import(path.join(root, "js/services.js"));
const SV = globalThis.window.LUMEVINA_SERVICES;
const MENU_LINE = SV.all.map((x) => `${x.name} ${x.from ? "from " : ""}$${x.price}${x.min ? ` (${x.min} min)` : ""}`).join("; ") +
  ". Not offered right now: couples facials, back facials, BioRePeel, leg waxing, full-face, nose, sideburn and hairline waxing.";

// ── studio facts that aren't in the FAQ ──
globalThis.window.LumevinaHours = undefined;
const FACTS = [
  "# The studio",
  "Lumevina Aesthetics Spa, Woodland Hills, CA. Owner and esthetician: Evelyn Romero. Every treatment is with her.",
  "Booking: for now, every booking goes through Evelyn's GlossGenius page (https://lumevina.glossgenius.com/); the Book buttons on this website open it. Booking directly on this website is coming soon (Evelyn is getting used to the site first). Some treatments take a deposit when booked, set per service: $50 for the New Client Consultation + Treatment (acne), $49 for the In-Person or Virtual Consultation, $30 for the Monthly and Bi-Weekly Acne Treatments, the Brazilian, Wax Wednesday, Bikini Line, Brazilian + Mini Vajacial, Full Arm and Full Back, and $20 for Half Arm, Half Back and Full Butt; facials, peels and ProCell have none. New clients book \"New Clients Start Here\"; for breakouts, the Acne Bootcamp's \"New Client Consultation + Treatment\". The Virtual Consultation is Mondays only, by message first. After-hours visits, outside her hours or on a closed day, are an extra $50 that she confirms first (the client asks through the Contact form).",
  "Her menu, with prices (from her GlossGenius page): " + MENU_LINE,
  "Shop: her professional skincare is sold on the website, shipped ($8, free on orders over $75) or picked up free at a visit. Out-of-stock products can be requested on the site and she orders them in.",
  "Contact: the website's Contact form (replies within two days), email Lumevina.aesthetics@gmail.com, or Instagram @lumevina.",
  "Not offered: lashes, brows, nails, memberships, an online course or a rewards program (those are paused).",
  "",
  "# FAQ & Policies",
  ...policies.map((p) => `## ${p.q}\n${p.a}`)
].join("\n\n");

// ── her playbook: only sections with answers ──
const md = (p) => fs.existsSync(p) ? read(p) : "";
const answered = (t) => /answered: "?\d{4}/.test(t);
const body = (t) => t.replace(/^---[\s\S]*?---\s*/, "").replace(/<!--[\s\S]*?-->\n?/g, "")
  .replace(/\n## [^\n]+\n\n_\(not answered yet\)_\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
const dir = (d) => fs.existsSync(path.join(K, d)) ? fs.readdirSync(path.join(K, d)).filter((f) => f.endsWith(".md")).sort().map((f) => md(path.join(K, d, f))) : [];
const pick = (list) => list.filter(answered).map(body);
const concerns = pick(dir("concerns")), treatments = pick(dir("treatments")), products = pick(dir("products"));
const clientQs = pick(dir("client-questions")), explained = pick(dir("treatments/explained"));
const one = (f) => answered(md(path.join(K, f))) ? body(md(path.join(K, f))) : "";
const visits = one("visits.md"), materials = one("materials.md");
const routine = answered(md(path.join(K, "routine.md"))) ? body(md(path.join(K, "routine.md"))) : "";
const hardLines = answered(md(path.join(K, "hard-lines.md"))) ? body(md(path.join(K, "hard-lines.md"))) : "";
const voice = answered(md(path.join(K, "voice.md"))) ? body(md(path.join(K, "voice.md"))) : "";
const knowledge = [
  clientQs.length ? "# Questions clients ask, answered in Evelyn's words\n\n" + clientQs.join("\n\n---\n\n") : "",
  explained.length ? "# Treatments explained, in Evelyn's words\n\n" + explained.join("\n\n---\n\n") : "",
  treatments.length ? "# Aftercare, in Evelyn's words\n\n" + treatments.join("\n\n---\n\n") : "",
  concerns.length ? "# Skin concerns, in Evelyn's words\n\n" + concerns.join("\n\n---\n\n") : "",
  visits ? "# Visits and the studio, in Evelyn's words\n\n" + visits : "",
  routine ? "# Her routine and starting actives\n\n" + routine : "",
  products.length ? "# Her notes on products\n\n" + products.join("\n\n---\n\n") : "",
  materials ? "# From her own materials\n\n" + materials : ""
].filter(Boolean).join("\n\n");
const empty = !knowledge;

// ── the shelf ──
const shelf = CAT.products.filter((p) => !p.draft).map((p) => ({
  id: p.id, name: p.name, brand: p.brand, type: p.cat, size: p.size || "", price: p.price, stock: p.stock == null ? null : p.stock, about: p.about || ""
}));

const PROMPT = read(path.join(K, "prompt.md")).trim();
const builtAt = new Date().toISOString().slice(0, 10);
const bundle = { builtAt, prompt: PROMPT, facts: FACTS, knowledge, knowledgeEmpty: empty, hardLines, voice, shelf, rules };

fs.mkdirSync(path.join(K, "eval"), { recursive: true });
fs.writeFileSync(path.join(K, "eval/bundle.json"), JSON.stringify(bundle, null, 1));

const lit = (s) => "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
const ts = `// GENERATED by knowledge/scripts/build-bundle.mjs on ${builtAt}. Don't edit: change the
// knowledge files, prompt.md, the FAQ, the catalog or js/ask-rules.js, then rebuild.

export const BUILT_AT = "${builtAt}";

/** The assistant's instructions (knowledge/prompt.md). */
export const PROMPT = ${lit(PROMPT)};

/** Studio facts, the FAQ and the policies, from the homepage. */
export const FACTS = ${lit(FACTS)};

/** Evelyn's playbook: only the sections she has answered. Empty until she has. */
export const KNOWLEDGE = ${lit(knowledge)};
export const KNOWLEDGE_EMPTY = ${empty};

/** Her hard lines and her voice, when written. */
export const HARD_LINES = ${lit(hardLines)};
export const VOICE = ${lit(voice)};

export type ShelfItem = { id: string; name: string; brand: string; type: string; size: string; price: number; stock: number | null; about: string };
export const SHELF: ShelfItem[] = ${JSON.stringify(shelf, null, 1)};

/** The hand-off rules (js/ask-rules.js): plain code that runs before any AI. */
export type Rule = { source: string; flags: string };
export type RuleKind = { kind: string; any: Rule[]; both?: Rule[] };
export const RULES: { urgent: Rule; kinds: RuleKind[] } = ${JSON.stringify(rules, null, 1)};
`;
fs.writeFileSync(path.join(root, "server/functions/_shared/knowledge.ts"), ts);

// ── the same knowledge for Evelyn's texting assistant (texting/CLAUDE.md imports it) ──
const shelfMd = shelf.map((p) => `- ${p.name} (${p.brand}, ${p.type}${p.size ? ", " + p.size : ""}): $${p.price}${p.about ? ". " + p.about : ""}`).join("\n");
fs.mkdirSync(path.join(root, "texting"), { recursive: true });
fs.writeFileSync(path.join(root, "texting/knowledge.md"), [
  `<!-- GENERATED by knowledge/scripts/build-bundle.mjs on ${builtAt}. Don't edit: change the knowledge files, the FAQ or the catalog, then rebuild. -->`,
  "",
  "# What Evelyn's texting assistant knows",
  "",
  FACTS,
  "",
  "# Evelyn's Skin Playbook",
  "",
  empty ? "_She hasn't filled her playbook in yet. Anything about skin concerns, aftercare, routines or how to use her products: draft a short holding reply and tell her it's hers to answer._" : knowledge,
  hardLines ? "\n# Her hard lines\n\n" + hardLines : "",
  voice ? "\n# Her voice\n\n" + voice : "",
  "",
  "# Her shelf (every product the website sells)",
  "",
  shelfMd,
  ""
].join("\n"));
console.log(`bundle: prompt ${PROMPT.length} chars, facts ${FACTS.length} (${policies.length} FAQ & policy items), playbook ${knowledge.length} chars (${empty ? "empty" : `${clientQs.length} client-question groups, ${explained.length} treatments explained, ${treatments.length} aftercare, ${concerns.length} concerns, ${products.length} product notes${visits ? ", visits" : ""}${materials ? ", materials" : ""}`}), shelf ${shelf.length}`);
