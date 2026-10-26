// Evelyn's take-home product guide: every product on her shelf, how and when to
// use it, what's normal, and when to stop, in her words (knowledge/products/*.md,
// from the "Your product guide" cards of her Skin Playbook) with the label's own
// facts. A printed page per few products, in the studio's look.
//
//   node knowledge/scripts/build-product-guide.mjs [--final]     (from lumevina/)
//   → docs/product-guide/index.html   the guide as a page (prints to Letter)
//   → docs/Lumevina-Product-Guide.pdf the same, as a PDF (needs Playwright: PLAYWRIGHT_DIR, CHROMIUM as for render.mjs)
//
// Until she has answered every product it's a draft: the cover says so and a product
// she hasn't filled in shows as waiting. --final leaves those out. Nothing here is
// written by anyone but her or the label: an empty answer stays off the page.
//
// What she said once for a kind of product (pausing actives before a treatment, how
// long a bottle lasts, her routines by skin type) goes on each product it applies to,
// in her words, until that product's own card says otherwise. Where two of her answers
// disagree, the draft asks her to confirm and the final guide leaves the line out.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const K = path.join(root, "knowledge");
const final = process.argv.includes("--final");
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;

// a knowledge file's answers, by field key: only what she answered, without the import's notes to the assistant
const answers = (md, fields) => {
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
// her answer as HTML: a tapped list becomes a list, her own words stay as written
const html = (body) => body.split(/\n\s*\n/).map((p) => {
  const lines = p.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length && lines.every((l) => /^(- |\d+\. )/.test(l))) return "<ul>" + lines.map((l) => `<li>${esc(l.replace(/^(- |\d+\. )/, ""))}</li>`).join("") + "</ul>";
  return `<p>${esc(lines.join(" "))}</p>`;
}).join("");

// what goes on each product, in the order a client needs it
const SHOW = [
  ["who", "Who it's for"], ["routines", "In Evelyn's routines"], ["when", "When"], ["how", "How to use it"], ["normal", "What's normal at first"],
  ["stop", "Stop and message Evelyn if"], ["confirm", "Evelyn to confirm"], ["pause", "Before a treatment"], ["back", "After a treatment"], ["sun", "Sun"],
  ["pregnancy", "Pregnant or breastfeeding"], ["pairs", "Pairs with, and not with"], ["tip", "Evelyn's tip"], ["lasts", "Lasts about"], ["label", "From the label"]
];
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
const today = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
// small copies of the product photos for print (the site's are large): docs/product-guide/img/<id>.jpg, via ffmpeg
const out = path.join(root, "docs/product-guide");
fs.mkdirSync(path.join(out, "img"), { recursive: true });
const img = (p) => {
  if (!p.photo) return "";
  const src = path.join(root, p.photo), dst = path.join(out, "img", p.id + ".jpg");
  if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(src).mtimeMs) {
    const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=360:-2", "-q:v", "4", dst]);
    if (r.status !== 0) return "../../" + p.photo;
  }
  return "img/" + p.id + ".jpg";
};

const card = ({ p, a }) => {
  const has = Object.keys(a).length > 0;
  const rows = SHOW.filter(([k]) => a[k]).map(([k, t]) => `<div class="row${k === "stop" ? " is-stop" : ""}${k === "tip" ? " is-tip" : ""}${k === "confirm" ? " is-confirm" : ""}"><h4>${t}</h4>${html(a[k])}</div>`).join("");
  return `<article class="prod${has ? "" : " is-empty"}">
  <div class="ph">${img(p) ? `<img src="${esc(img(p))}" alt="">` : ""}</div>
  <div class="tx">
    <p class="br">${esc(p.brand)}${p.size ? " · " + esc(p.size) : ""}</p>
    <h3>${esc(p.name)}</h3>
    ${p.about ? `<p class="lbl">${esc(p.about)}</p>` : ""}
    ${has ? `<div class="rows">${rows}</div>` : `<p class="wait">Evelyn is adding how to use this one.</p>`}
  </div>
</article>`;
};
const groups = CAT.categories.map((c) => ({ c, items: products.filter((x) => x.p.cat === c && (!final || Object.keys(x.a).length)) })).filter((g) => g.items.length);

// the basics, before the products: her routine answers, then what she says to every client about products
const BASICS = [["order", "Your routine, in order"], ["stop_signs", "When to stop a product and message Evelyn"], ["dont_mix", "What not to mix"], ["sun", "Sunscreen"],
  ["mandelic", "Starting a mandelic serum"], ["acne_med", "Starting the Advanced Acne Med"], ["retinal_vs_retinol", "Retinal or retinol"]];
const basics = BASICS.filter(([k]) => routine[k] && !(k === "mandelic" && mandelicClash && final)).map(([k, t]) => [k, t, routine[k]]);
const MORE = [
  ["sunscreen", "Choosing and applying sunscreen", daily.sunscreen],
  ["pause", "Before a treatment", before.stop_products], ["back", "After a treatment", after.actives_after],
  ["run_out", "Running low, or skipped a few days", [daily.run_out, daily.missed_days].filter(Boolean).join("\n\n")],
  ["own", "Using your own products too", daily.own_products]
].filter((x) => x[2]);
const actives = live.filter(isActive).sort((a, b) => (a.name.replace(/^[\d.]+% /, "") + String(pct(a)).padStart(4, "0")).localeCompare(b.name.replace(/^[\d.]+% /, "") + String(pct(b)).padStart(4, "0")));
// what always comes to her, as she ticked it: the ones that change what's safe to use
const askFirst = (/## The assistant must never answer these[^\n]*\n([\s\S]*?)\n## /.exec(hard) || [])[1]?.split("\n").map((l) => l.replace(/^- /, "").trim())
  .filter((l) => /pregnan|accutane|prescription|eczema|reaction/i.test(l)) || [];
const waiting = BASICS.filter(([k]) => !routine[k]).map(([, t]) => t.toLowerCase());
const phone = (/(\d{3})[-. ]?(\d{3})[-. ]?(\d{4})/.exec(visits.reply_time || "") || []).slice(1).join("-");
const reply = sentence(visits.reply_time, /answer within/i).replace(/^I answer/, "She answers");
const box = (k, t, body, cls = "") => `<div class="basic${cls}"><h4>${t}</h4>${html(body)}</div>`;
const routineTable = ROUTINES.length ? `<div class="basic is-wide"><h4>Evelyn's usual routines</h4>
  <div class="rt">${["Morning", "Night"].map((w) => ROUTINES.filter((r) => r.when === w).map((r) => `<div><p class="rt-h">${w} · ${esc(r.skin)}</p><ol>${r.steps.map((st) =>
    `<li>${[...new Set(st.map((id) => byId[id].name.replace(/ \((travel size|[\d.]+ fl oz)\)$/, "")))].map(esc).join(" or ")}</li>`).join("")}</ol></div>`).join("")).join("")}</div>
  <p class="src">${tolerance ? "The mandelic strength depends on your tolerance. " : ""}${alternate ? esc(cap(alternate)) + " " : ""}Routines vary from client to client: yours is the one Evelyn builds for you.</p></div>` : "";

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lumevina Product Guide</title>
<style>
@font-face { font-family: "Inter"; src: url("../../fonts/inter-var.woff2") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Cormorant Garamond"; src: url("../../fonts/cormorant-garamond-latin-500-normal.woff2") format("woff2"); font-weight: 500; }
@font-face { font-family: "Cormorant Garamond"; src: url("../../fonts/cormorant-garamond-latin-600-normal.woff2") format("woff2"); font-weight: 600; }
@font-face { font-family: "Cormorant Garamond"; src: url("../../fonts/cormorant-garamond-latin-500-italic.woff2") format("woff2"); font-weight: 500; font-style: italic; }
/* the studio's colors on white paper: linen panels, cocoa and espresso, ink */
:root { --linen: #F5F1EA; --porcelain: #FFFFFF; --blush: #EDE5DA; --khaki: #D7C9B8; --cocoa: #7D5A44; --espresso: #4A342A; --ink: #161412; --muted: #6B5D52;
  --serif: "Cormorant Garamond", Georgia, serif; --sans: "Inter", -apple-system, system-ui, sans-serif; }
@page { size: Letter; margin: 0.55in 0.6in 0.6in; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #FFFFFF; color: var(--ink); font-family: var(--sans); font-size: 9.6pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.wrap { max-width: 7.3in; margin: 0 auto; padding: 0.3in 0 0.6in; }
@media print { .wrap { padding: 0; max-width: none; } }
h1, h2, h3 { font-family: var(--serif); font-weight: 600; letter-spacing: -0.01em; text-wrap: balance; margin: 0; }
.k { font-size: 7.4pt; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--cocoa); margin: 0; }
/* cover */
.cover { height: 11in; background: var(--linen); padding: 0.85in 0.75in 0.7in; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
.cover img.logo { width: 2.3in; display: block; }
.cover h1 { font-size: 44pt; line-height: 1.02; margin-top: 0.25in; max-width: 6in; }
.cover h1 em { font-style: italic; color: var(--cocoa); font-weight: 500; }
.cover .lead { font-size: 11.5pt; color: var(--espresso); max-width: 4.8in; margin: 0.22in 0 0; }
.cover .foot { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.3in; border-top: 1px solid var(--khaki); padding-top: 0.14in; color: var(--muted); font-size: 8.4pt; }
.draft { display: inline-block; margin-top: 0.25in; padding: 0.06in 0.14in; border-radius: 999px; background: var(--blush); color: var(--espresso); font-size: 8.4pt; font-weight: 600; }
/* how to use this guide, and her basics */
.intro { break-after: page; }
.intro h2 { font-size: 26pt; margin: 0.06in 0 0.16in; }
.basics { display: grid; grid-template-columns: 1fr 1fr; gap: 0.14in; }
.basic { background: var(--linen); border-radius: 10px; padding: 0.15in 0.17in; break-inside: avoid; }
.basic.is-stop { grid-column: 1 / -1; background: var(--espresso); color: #FFFFFF; }
.basic.is-wide { grid-column: 1 / -1; }
.basic.is-confirm, .row.is-confirm { background: #FFFFFF; border: 1.5px dashed var(--cocoa); }
.row.is-confirm { grid-column: 1 / -1; border-radius: 7px; padding: 0.07in 0.1in; }
.src { color: var(--muted); font-size: 8.2pt; margin: 0.04in 0 0 !important; }
.rt { display: grid; grid-template-columns: 1fr 1fr; gap: 0.1in 0.22in; margin-top: 0.04in; }
.rt-h { font-weight: 650; color: var(--espresso); margin: 0 0 0.03in !important; }
.rt ol { margin: 0; padding-left: 1.3em; } .rt li { margin: 0 0 0.01in; }
.basic.is-stop h4, .basic.is-stop .k { color: #EDE5DA; }
.basic h4, .row h4 { font-family: var(--sans); font-size: 7.4pt; font-weight: 650; letter-spacing: 0.12em; text-transform: uppercase; color: var(--cocoa); margin: 0 0 0.05in; }
.basic p, .row p { margin: 0 0 0.05in; } .basic ul, .row ul { margin: 0 0 0.05in; padding-left: 1.1em; }
.how { color: var(--espresso); max-width: 5.6in; margin: 0 0 0.22in; font-size: 10pt; }
.pending { border: 1px dashed var(--khaki); border-radius: 10px; padding: 0.16in 0.18in; color: var(--muted); margin-top: 0.14in; }
.pending b { color: var(--espresso); }
/* products */
.cat { break-before: page; margin: 0 0 0.12in; padding-bottom: 0.08in; border-bottom: 1px solid var(--khaki); display: flex; align-items: baseline; justify-content: space-between; }
.cat h2 { font-size: 22pt; }
.cat span { color: var(--muted); font-size: 8.4pt; }
.prod { display: grid; grid-template-columns: 1.05in 1fr; gap: 0.2in; padding: 0.16in 0; border-bottom: 1px solid rgba(74, 52, 42, 0.12); break-inside: avoid; }
.prod:last-child { border-bottom: 0; }
.ph { width: 1.05in; height: 1.32in; border-radius: 8px; background: var(--linen); display: grid; place-items: center; overflow: hidden; }
.ph img { width: 100%; height: 100%; object-fit: contain; }
.br { font-size: 7.6pt; color: var(--muted); margin: 0; letter-spacing: 0.02em; }
.prod h3 { font-size: 15.5pt; line-height: 1.12; margin: 0.02in 0 0.03in; }
.lbl { margin: 0 0 0.08in; color: var(--espresso); font-style: italic; font-family: var(--serif); font-size: 11pt; }
.rows { display: grid; grid-template-columns: 1fr 1fr; gap: 0.07in 0.2in; }
.row.is-stop { grid-column: 1 / -1; background: var(--blush); border-radius: 7px; padding: 0.07in 0.1in; }
.row.is-tip { grid-column: 1 / -1; }
.row.is-tip p { font-family: var(--serif); font-size: 11.5pt; font-style: italic; color: var(--espresso); }
.wait { margin: 0.02in 0 0; color: var(--muted); font-size: 8.6pt; }
.prod.is-empty .ph { opacity: 0.75; }
/* back */
.back { break-before: page; min-height: 9.2in; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 0.12in; }
.back h2 { font-size: 30pt; max-width: 5in; }
.back p { color: var(--espresso); font-size: 11pt; margin: 0; max-width: 4.6in; }
.back .c { margin-top: 0.12in; font-weight: 600; color: var(--ink); }
</style></head>
<body><div class="wrap">

<section class="cover">
  <div>
    <img class="logo" src="../../img/logo-full.svg" alt="Lumevina Aesthetics Spa">
    <h1>Your products, <em>and how to use them.</em></h1>
    <p class="lead">Every product on Evelyn's shelf: when to use it, how, what's normal when you start, and when to stop and message her. Keep it by your sink.</p>
    ${draft ? `<span class="draft">Draft · ${filled.length} of ${products.length} products filled in by Evelyn</span>` : ""}
  </div>
  <div class="foot"><span>Evelyn Romero · Licensed esthetician<br>Lumevina Aesthetics Spa · Woodland Hills</span><span>${esc(today)}</span></div>
</section>

<section class="intro">
  <p class="k">Before you start</p>
  <h2>A few things first</h2>
  <p class="how">Each product has its own page: when to use it, how, what's normal, and the signs that mean stop and message Evelyn. Your routine is the one Evelyn built for you; if something here and her advice to you differ, follow her.</p>
  ${basics.length
    ? `<div class="basics">
      ${basics.filter(([k]) => k === "order").map(([k, t, b]) => box(k, t, b, " is-wide")).join("")}
      ${routineTable}
      ${basics.filter(([k]) => k === "stop_signs").map(([k, t, b]) => box(k, t, b, " is-stop")).join("")}
      ${actives.length ? `<div class="basic"><h4>Your actives on Evelyn's shelf</h4><ul>${actives.map((p) => `<li>${esc(p.name)}</li>`).join("")}</ul><p class="src">Retinoids and acids: the ones to pause before a treatment, and to stop if your skin flares up. Not sure about something else you use? Message Evelyn.</p></div>` : ""}
      ${askFirst.length ? `<div class="basic"><h4>Ask Evelyn before you start anything if</h4><p>You have, or are on:</p><ul>${askFirst.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
      ${basics.filter(([k]) => k !== "order" && k !== "stop_signs").map(([k, t, b]) => box(k, t, b) + (k === "mandelic" && mandelicClash && !final ? `<div class="basic is-confirm"><h4>Evelyn to confirm</h4><p>${esc(CLASH)}</p></div>` : "")).join("")}
      ${MORE.map(([k, t, b]) => box(k, t, b)).join("")}
    </div>
    ${draft && waiting.length ? `<div class="pending"><b>Still to come from Evelyn:</b> ${esc(waiting.join(", "))}, and her notes on each product.</div>` : ""}`
    : `<div class="pending"><b>Coming from Evelyn:</b> your routine in order, when to stop a product and message her, what not to mix, sunscreen, and how to start the stronger products. She answers these once in her Skin Playbook ("Your products, in order").</div>`}
</section>

${groups.map((g) => `<section><div class="cat"><h2>${esc(g.c)}</h2><span>${g.items.length} product${g.items.length === 1 ? "" : "s"}</span></div>${g.items.map(card).join("")}</section>`).join("\n")}

<section class="back">
  <p class="k">Questions?</p>
  <h2>Something doesn't feel right, or you're not sure?</h2>
  <p>Message Evelyn before you change anything${phone ? ", through the website's contact form or her business line" : ""}. ${reply ? esc(reply) + " " : ""}Bring this guide and your products to your next visit and she'll update your routine.</p>
  <p class="c">${phone ? esc(phone) + " · " : ""}Lumevina.aesthetics@gmail.com · @lumevina on Instagram</p>
</section>

</div></body></html>
`;

fs.writeFileSync(path.join(out, "index.html"), page);
console.log(`product guide: ${filled.length} of ${products.length} products filled in, ${basics.length} of ${BASICS.length} basics${draft ? " (draft)" : ""} → docs/product-guide/index.html`);

// the PDF, when Playwright is at hand
try {
  const { chromium } = createRequire(path.join(process.env.PLAYWRIGHT_DIR || root, "x.js"))("playwright");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--allow-file-access-from-files"] });
  const pg = await browser.newPage();
  await pg.goto("file://" + path.join(out, "index.html"), { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({ path: path.join(root, "docs/Lumevina-Product-Guide.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log("→ docs/Lumevina-Product-Guide.pdf");
} catch (e) { console.log("no PDF (Playwright not found: set PLAYWRIGHT_DIR and CHROMIUM):", String(e.message || e).split("\n")[0]); }
