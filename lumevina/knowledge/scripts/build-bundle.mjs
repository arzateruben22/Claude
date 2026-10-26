// Packs what Ask Lumevina may know into one bundle:
//   server/functions/_shared/knowledge.ts   imported by the ask edge function
//   knowledge/eval/bundle.json              the same, for the eval runner
//   texting/knowledge.md                    the same, for Evelyn's texting assistant
//
//   node knowledge/scripts/build-bundle.mjs      (from lumevina/)
//
// Sources: knowledge/prompt.md, every knowledge *.md with answers in it (her
// screenshots' transcripts are already folded into those by import-playbook.mjs),
// knowledge/general/*.md (standard esthetics knowledge, not hers), the
// homepage's FAQ and policies (index.html), the catalog (js/catalog.js), the
// studio facts below, and the hand-off rules (js/ask-rules.js).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cards, skinGuide } from "./product-cards.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const K = path.join(root, "knowledge");
const read = (p) => fs.readFileSync(p, "utf8");

// ── the catalog and the rules, through the browser globals they set ──
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
await import(path.join(root, "js/ask-rules.js"));
await import(path.join(root, "js/ask-typos.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const RULES = globalThis.window.LumevinaAskRules;
const TYPOS = globalThis.window.LumevinaTypos.lists;   // shorthand and the words the chat knows, for the server's own typo fix
const re = (r) => ({ source: r.source, flags: r.flags });
const rules = {
  urgent: re(RULES.URGENT),
  kinds: RULES.KINDS.map((k) => ({ kind: k.kind, any: (k.any || []).map(re), both: k.both ? k.both.map(re) : undefined })),
  off: (RULES.OFF || []).map((k) => ({ kind: k.kind, any: (k.any || []).map(re) })),
  first: RULES.FIRST || [],
  photo: re(RULES.PHOTO),   // "what's wrong with my skin" from a photo: always hers (her hard lines)
  asksHer: re(RULES.ASKS_HER), symptom: re(RULES.SYMPTOM),   // when an AI hand-off stands (ask-rules handOffOk)
  ours: re(RULES.OURS)   // the studio's own words: a message with one of these is never "unrelated"
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

// ── her menu (js/services.js) ──
await import(path.join(root, "js/services.js"));
const SV = globalThis.window.LUMEVINA_SERVICES;
const NOT_OFFERED = "Not offered right now: couples facials, back facials, BioRePeel, leg waxing, full-face, nose, sideburn and hairline waxing.";
// every treatment with its price, time, deposit and her own description, so the
// assistant can say what a facial includes and which one fits, the way she would
const $ = (x) => `${x.from ? "from " : ""}$${x.price}${x.min ? `, ${x.min} min` : ""}`;
const treatment = (i) => [
  `### ${i.name}${i.note ? ` (${i.note})` : ""}`,
  (i.options ? i.options.map((o) => `${o.short || o.name}: ${$(o)}`).join(" · ") : $(i)) + ". " +
    (i.deposit ? `$${i.deposit} deposit when booked.` : "No deposit.") +
    (i.ask ? " Message Evelyn first; she confirms the time." : "") + (i.addon ? " Only alongside another service." : ""),
  i.about || i.desc
].join("\n");
const groups = SV.menu.flatMap((g) => g.subs ? g.subs.map((s) => ({ title: `${g.group}: ${s.group}`, items: s.items })) : [{ title: g.group, items: g.items }]);
const TREATMENTS = "# Her treatments, in her words\n\nFrom her GlossGenius page: prices, times, deposits and her own descriptions.\n\n" +
  groups.map((g) => `## ${g.title}\n\n` + g.items.map(treatment).join("\n\n")).join("\n\n") + "\n\n" + NOT_OFFERED;

// ── studio facts that aren't in the FAQ ──
// Two versions (js/site-config.js → version): v2 books on GlossGenius with
// membership and points held back; v3 books here, with both. The ask
// function picks one by what the website says it runs.
globalThis.window.LumevinaHours = undefined;
const DEPOSITS = "Some treatments take a deposit when booked, set per service: $50 for the New Client Consultation + Treatment (acne), $49 for the In-Person or Virtual Consultation, $30 for the Monthly and Bi-Weekly Acne Treatments, the Brazilian, Wax Wednesday, Bikini Line, Brazilian + Mini Vajacial, Full Arm and Full Back, and $20 for Half Arm, Half Back and Full Butt; facials, peels and ProCell have none.";
const WHAT_TO_BOOK = "New clients book \"New Clients Start Here\"; for breakouts, the Acne Bootcamp's \"New Client Consultation + Treatment\". The Virtual Consultation is Mondays only, by message first. After-hours visits, outside her hours or on a closed day, are an extra $50 that she confirms first (the client asks through the Contact form).";
const BOOKING = {
  v2: "Booking: for now, every booking goes through Evelyn's GlossGenius page (https://lumevina.glossgenius.com/); the Book buttons on this website open it. Booking directly on this website is coming soon (Evelyn is getting used to the site first). " + DEPOSITS + " " + WHAT_TO_BOOK,
  v3: "Booking: right here on the website, in the Book section: pick a treatment, a day and a time. " + DEPOSITS + " The deposit is paid by card on Stripe's secure page, and the card stays on file to hold the booking; a treatment with no deposit just needs a card on file. Glow members pay no deposits. The confirmation email has a link to move or cancel the appointment (also in My Lumevina, signed in with the same email), and a reminder comes before the visit, by text too if they ask for one. A full day has a waitlist: a cancellation emails the first person waiting. Appointments already booked on GlossGenius stand as they are; new ones are booked here. " + WHAT_TO_BOOK
};
/* membership and points, from what the website shows (js/membership.js, js/rewards.js) */
const MEMBERSHIP_V3 = "Glow Membership (the Membership section; join online, billed monthly). Glow, $185 a month: one facial a month, the Lumevina Custom Facial or the Monthly Acne Treatment (a $200 value); 10% off skincare from her shelf and free shipping; 15% off add-ons and anything else booked the same visit; no deposits; a home routine from Evelyn each season; and Ask Evelyn any time, with her own reply within 24 hours. Ageless, $235 a month: any of the facials up to the Ageless Grace Facial (a $240 value), everything in Glow, plus dermaplaning every other visit and 15% off skincare. Founding members (the first 25) pay $175 and $225 instead, kept for as long as they stay, and the first five also get a skincare kit; the Membership section shows how many founding spots are left. Unused facials bank, up to two, and with two waiting they aren't billed until they book one. A banked facial can be sent to a friend as a gift certificate. One month a year can be skipped at no charge. Three-month minimum, then cancel online any time from My Lumevina.";
const POINTS_V3 = "Glow Points (for everyone who books here, member or not; shown in My Lumevina): 1 point for every $1 paid on visits, products and gift certificates, on the website or at the studio, and double on a Wednesday or a Wax Wednesday. 100 points take $10 off, and points can cover up to half of a deposit. 100 points for the first booking on this website, whether they're new or have been seeing Evelyn for years. When a friend books their first visit with a client's code, the friend gets $15 off and the client gets 150 points. 50 more in their birthday month (they set it in My Lumevina). Non-members also get 25 when their next visit is within five weeks of the last.";
/* Skin School, only when the site switches it on (js/site-config.js → features: ["school"]); counts and prices from the curriculum itself */
const cfgText = fs.readFileSync(path.join(root, "js/site-config.js"), "utf8");
const FEATURES = ((/features:\s*\[([^\]]*)\]/.exec(cfgText) || [])[1] || "").split(",").map((x) => x.trim().replace(/['"]/g, "")).filter(Boolean);
const SCHOOL_ON = FEATURES.includes("school");
await import(path.join(root, "docs/school/curriculum.js"));
const SCH = globalThis.window.SCHOOL;
const lessonCount = SCH ? SCH.levels.reduce((n, l) => n + l.modules.reduce((a, m) => a + m.lessons.length, 0), 0) : 0;
const tierLine = SCH ? SCH.tiers.map((t) => `${t.name} $${t.price}`).join(", ") + (SCH.starter ? `, ${SCH.starter.name} alone $${SCH.starter.price}` : "") : "";
const SCHOOL = `Skin School: Evelyn's online course on this website (school.html), ${lessonCount} short lessons in three levels, from your first cleanser to acne, dark spots and aging. The first two lessons are free (school.html#learn-1-1); the tiers: ${tierLine}. The short "Skin science" clips on the home page come from it. Point to a lesson when a question is really a lesson.`;
const factsFor = (v) => [
  "# The studio",
  "Lumevina Aesthetics Spa, Woodland Hills, CA. Owner and esthetician: Evelyn Romero. Every treatment is with her.",
  BOOKING[v],
  "Her menu: every treatment, with prices, times and her own descriptions, is under \"Her treatments, in her words\" below. " + NOT_OFFERED,
  "Shop: her professional skincare is sold on the website, shipped ($8, free on orders over $75) or picked up free at a visit. Out-of-stock products can be requested on the site and she orders them in.",
  "Contact: the website's Contact form (replies within two days), email Lumevina.aesthetics@gmail.com, or Instagram @lumevina.",
  ...(v === "v3" ? [MEMBERSHIP_V3, POINTS_V3, ...(SCHOOL_ON ? [SCHOOL, "Not offered: lashes, brows or nails."] : ["Not offered: lashes, brows, nails, or an online course."])]
    : [...(SCHOOL_ON ? [SCHOOL] : []), "Not offered: lashes, brows, nails, memberships" + (SCHOOL_ON ? "" : ", an online course") + " or a rewards program (those are paused)."]),
  "",
  "# FAQ & Policies",
  ...policies.map((p) => `## ${p.q}\n${p.a}`),
  "",
  TREATMENTS
].join("\n\n");
const FACTS = factsFor("v2"), FACTS_V3 = factsFor("v3");
/* Evelyn's texting assistant follows the version the site runs now */
const SITE = (/version:\s*"(v[23])"/.exec(read(path.join(root, "js/site-config.js"))) || [, "v2"])[1];

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
// her routines by skin type, from her breakouts answers, each step matched to the products on her shelf (product-cards.mjs):
// what the chat answers "my face feels dry" or "what should I use, I'm oily" from, by name
const GUIDE = await skinGuide(root);
const nameOf = (id) => (GUIDE.products.find((p) => p.id === id) || { name: id }).name;
const stepsMd = (steps) => steps.map((alts) => alts.map(nameOf).join(" or ")).join(", then ");
const ROUTINES_MD = (GUIDE.routines.dry.morning.length || GUIDE.routines.oily.morning.length) ? [
  "# Her routines by skin type",
  "From her answers on breakouts, each step matched to a product on her shelf, in her order (thin to thick, SPF last)." + (GUIDE.tolerance ? " Which mandelic strength depends on the client's tolerance: start with the one Evelyn gives them." : ""),
  ...[["dry", "Dry or normal skin"], ["oily", "Oily or combination skin"]].map(([k, label]) =>
    `## ${label}\nMorning: ${stepsMd(GUIDE.routines[k].morning)}.\nNight: ${stepsMd(GUIDE.routines[k].night)}.`)
].join("\n\n") : "";
const knowledge = [
  clientQs.length ? "# Questions clients ask, answered in Evelyn's words\n\n" + clientQs.join("\n\n---\n\n") : "",
  explained.length ? "# Treatments explained, in Evelyn's words\n\n" + explained.join("\n\n---\n\n") : "",
  treatments.length ? "# Aftercare, in Evelyn's words\n\n" + treatments.join("\n\n---\n\n") : "",
  concerns.length ? "# Skin concerns, in Evelyn's words\n\n" + concerns.join("\n\n---\n\n") : "",
  visits ? "# Visits and the studio, in Evelyn's words\n\n" + visits : "",
  routine ? "# Her routine and starting actives\n\n" + routine : "",
  products.length ? "# Her notes on products\n\n" + products.join("\n\n---\n\n") : "",
  ROUTINES_MD,
  materials ? "# From her own materials\n\n" + materials : ""
].filter(Boolean).join("\n\n");
const empty = !knowledge;

// ── general esthetics knowledge (knowledge/general/*.md): not her words. It
// explains what things are and fills gaps; her playbook always wins. ──
const general = dir("general").map(body).filter(Boolean);
const GENERAL = general.length ? [
  "# General skincare and esthetics knowledge",
  "Not Evelyn's words: standard esthetics practice, written for the assistant. Use it to explain what something is, how a kind of treatment or ingredient generally works, and why a rule exists, and to fill a gap her playbook leaves, saying \"generally\" or \"usually\" when you do. Whenever her playbook, her treatments or the FAQ say something, that wins, even where this differs. Never use it to diagnose, to name a condition, to call something normal from a description, to change a client's routine, or to decide a contraindication for a client: those stay Evelyn's, and a doctor's.",
  general.join("\n\n---\n\n")
].join("\n\n") : "";

// ── the shelf ──
// each product with its card: her own answers for it and what she said once that applies to it (product-cards.mjs:
// her routines, pausing actives, what's normal, when to stop, how long a bottle lasts), so the assistant can say how
// and when to use the one a client owns; lastsMonths is her rule of thumb as a number, for "running low" on a client's file
const CARDS = await cards(root);
const shelf = CAT.products.filter((p) => !p.draft && p.kind !== "consult").map((p) => ({
  id: p.id, name: p.name, brand: p.brand, type: p.cat, size: p.size || "", price: p.price, stock: p.stock == null ? null : p.stock, about: p.about || "",
  card: CARDS[p.id]?.text || "", lastsMonths: CARDS[p.id]?.lastsMonths ?? null
}));

const PROMPT = read(path.join(K, "prompt.md")).trim();
const builtAt = new Date().toISOString().slice(0, 10);
const bundle = { builtAt, prompt: PROMPT, facts: FACTS, factsV3: FACTS_V3, knowledge, knowledgeEmpty: empty, general: GENERAL, hardLines, voice, shelf, rules };

// the website chat's skin guide (js/ask.js reads window.LumevinaSkin): her routines, her products as clients type them,
// each product's card and her own lines, for answering a skin question when there's no AI to ask
fs.writeFileSync(path.join(root, "js/ask-skin.js"), "/* GENERATED by knowledge/scripts/build-bundle.mjs from Evelyn's Skin Playbook (product-cards.mjs → skinGuide). Don't edit; rebuild. */\n" +
  "window.LumevinaSkin = " + JSON.stringify(GUIDE) + ";\n");

fs.mkdirSync(path.join(K, "eval"), { recursive: true });
fs.writeFileSync(path.join(K, "eval/bundle.json"), JSON.stringify(bundle, null, 1));

const lit = (s) => "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
const ts = `// GENERATED by knowledge/scripts/build-bundle.mjs on ${builtAt}. Don't edit: change the
// knowledge files, prompt.md, the FAQ, the catalog or js/ask-rules.js, then rebuild.

export const BUILT_AT = "${builtAt}";

/** The assistant's instructions (knowledge/prompt.md). */
export const PROMPT = ${lit(PROMPT)};

/** Studio facts, the FAQ and the policies, from the homepage: v2 (booking on GlossGenius). */
export const FACTS = ${lit(FACTS)};

/** The same for v3: booking here, Glow Membership and Glow Points. */
export const FACTS_V3 = ${lit(FACTS_V3)};

/** Evelyn's playbook: only the sections she has answered. Empty until she has. */
export const KNOWLEDGE = ${lit(knowledge)};
export const KNOWLEDGE_EMPTY = ${empty};

/** General esthetics knowledge (knowledge/general): explains and fills gaps; her words win. */
export const GENERAL = ${lit(GENERAL)};

/** Her hard lines and her voice, when written. */
export const HARD_LINES = ${lit(hardLines)};
export const VOICE = ${lit(voice)};

export type ShelfItem = { id: string; name: string; brand: string; type: string; size: string; price: number; stock: number | null; about: string; card: string; lastsMonths: number | null };
export const SHELF: ShelfItem[] = ${JSON.stringify(shelf, null, 1)};

/** The hand-off rules (js/ask-rules.js): plain code that runs before any AI. */
export type Rule = { source: string; flags: string };
export type RuleKind = { kind: string; any: Rule[]; both?: Rule[] };
export const RULES: { urgent: Rule; kinds: RuleKind[]; off: RuleKind[]; first: string[]; ours: Rule; photo: Rule; asksHer: Rule; symptom: Rule } = ${JSON.stringify(rules, null, 1)};

/** Texting shorthand and the chat's vocabulary (js/ask-typos.js), for _shared/typos.ts. */
export const TYPOS: { vocab: string[]; common: string[]; short: Record<string, string> } = ${JSON.stringify(TYPOS)};
`;
fs.writeFileSync(path.join(root, "server/functions/_shared/knowledge.ts"), ts);

// ── the same knowledge for Evelyn's texting assistant (texting/CLAUDE.md imports it) ──
const shelfMd = shelf.map((p) => `- ${p.name} (${p.brand}, ${p.type}${p.size ? ", " + p.size : ""}): $${p.price}${p.about ? ". " + p.about : ""}` + (p.card ? "\n" + p.card.split("\n").map((l) => "  " + l).join("\n") : "")).join("\n");
fs.mkdirSync(path.join(root, "texting"), { recursive: true });
fs.writeFileSync(path.join(root, "texting/knowledge.md"), [
  `<!-- GENERATED by knowledge/scripts/build-bundle.mjs on ${builtAt}. Don't edit: change the knowledge files, the FAQ or the catalog, then rebuild. -->`,
  "",
  "# What Evelyn's texting assistant knows",
  "",
  SITE === "v3" ? FACTS_V3 : FACTS,
  "",
  "# Evelyn's Skin Playbook",
  "",
  empty ? "_She hasn't filled her playbook in yet. Anything about skin concerns, aftercare, routines or how to use her products: draft a short holding reply and tell her it's hers to answer._" : knowledge,
  GENERAL ? "\n" + GENERAL : "",
  hardLines ? "\n# Her hard lines\n\n" + hardLines : "",
  voice ? "\n# Her voice\n\n" + voice : "",
  "",
  "# Her shelf (every product the website sells)",
  "",
  shelfMd,
  ""
].join("\n"));
console.log(`bundle: prompt ${PROMPT.length} chars, facts ${FACTS.length} (${policies.length} FAQ & policy items), general ${GENERAL.length} chars (${general.length} files), playbook ${knowledge.length} chars (${empty ? "empty" : `${clientQs.length} client-question groups, ${explained.length} treatments explained, ${treatments.length} aftercare, ${concerns.length} concerns, ${products.length} product notes${visits ? ", visits" : ""}${materials ? ", materials" : ""}`}), shelf ${shelf.length}`);
