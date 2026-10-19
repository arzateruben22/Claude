// Packs what Ask Lumevina may know into one bundle:
//   server/functions/_shared/knowledge.ts   imported by the ask edge function
//   knowledge/eval/bundle.json              the same, for the eval runner
//
//   node knowledge/scripts/build-bundle.mjs      (from lumevina/)
//
// Sources: knowledge/prompt.md, every knowledge *.md with answers in it, the
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
const faqBlock = html.slice(html.indexOf('<div class="faq-list">'), html.indexOf('faq-title--policies'));
const polBlock = html.slice(html.indexOf('<div class="policies-list"'), html.indexOf('<!-- Desktop: the accordion'));
const faq = details(faqBlock), policies = details(polBlock);
if (!faq.length || !policies.length) throw new Error("couldn't read the FAQ or policies from index.html");

// ── studio facts that aren't in the FAQ ──
globalThis.window.LumevinaHours = undefined;
const FACTS = [
  "# The studio",
  "Lumevina Aesthetics Spa, Woodland Hills, CA. Owner and esthetician: Evelyn Romero. Every treatment is with her.",
  "Booking: in the Book section of this website, where the calendar shows every opening up to a month ahead and a 50% deposit holds the time. New clients book \"New Clients Start Here\"; for breakouts, the Acne Program's \"New Client Consultation + Treatment\". Clients who already book with Evelyn on GlossGenius (https://lumevina.glossgenius.com/) can still use it for now; all booking is moving to the website. After-hours visits, outside her hours or on a closed day, are a $32 add-on that she confirms first (the client asks through the Contact form).",
  "Shop: her professional skincare is sold on the website, shipped ($8, free on orders over $75) or picked up free at a visit. Out-of-stock products can be requested on the site and she orders them in.",
  "Contact: the website's Contact form (replies within two days), email Lumevina.aesthetics@gmail.com, or Instagram @lumevina.",
  "Not offered: lashes, brows, nails, memberships, an online course or a rewards program (those are paused).",
  "",
  "# FAQ",
  ...faq.map((f) => `Q: ${f.q}\nA: ${f.a}`),
  "",
  "# Policies",
  ...policies.map((p) => `## ${p.q}\n${p.a}`)
].join("\n\n");

// ── her playbook: only sections with answers ──
const md = (p) => fs.existsSync(p) ? read(p) : "";
const answered = (t) => /answered: "?\d{4}/.test(t);
const body = (t) => t.replace(/^---[\s\S]*?---\s*/, "").replace(/\n## [^\n]+\n\n_\(not answered yet\)_\n?/g, "\n").trim();
const dir = (d) => fs.existsSync(path.join(K, d)) ? fs.readdirSync(path.join(K, d)).filter((f) => f.endsWith(".md")).sort().map((f) => md(path.join(K, d, f))) : [];
const pick = (list) => list.filter(answered).map(body);
const concerns = pick(dir("concerns")), treatments = pick(dir("treatments")), products = pick(dir("products"));
const routine = answered(md(path.join(K, "routine.md"))) ? body(md(path.join(K, "routine.md"))) : "";
const hardLines = answered(md(path.join(K, "hard-lines.md"))) ? body(md(path.join(K, "hard-lines.md"))) : "";
const voice = answered(md(path.join(K, "voice.md"))) ? body(md(path.join(K, "voice.md"))) : "";
const knowledge = [
  concerns.length ? "# Skin concerns, in Evelyn's words\n\n" + concerns.join("\n\n---\n\n") : "",
  treatments.length ? "# Aftercare, in Evelyn's words\n\n" + treatments.join("\n\n---\n\n") : "",
  routine ? "# Her routine and starting actives\n\n" + routine : "",
  products.length ? "# Her notes on products\n\n" + products.join("\n\n---\n\n") : ""
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
console.log(`bundle: prompt ${PROMPT.length} chars, facts ${FACTS.length} (${faq.length} FAQ, ${policies.length} policies), playbook ${knowledge.length} chars (${empty ? "empty" : `${concerns.length} concerns, ${treatments.length} treatments, ${products.length} product notes`}), shelf ${shelf.length}`);
