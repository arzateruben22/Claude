// Builds Evelyn's Skin Playbook from playbook-spec.mjs:
//   knowledge/playbook/evelyn-playbook.html   the page she fills in (published as an artifact)
//   knowledge/PLAYBOOK-QUESTIONS.md            the same questions, readable
//
//   node knowledge/scripts/build-playbook.mjs      (from lumevina/)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";
import { DRAFTS } from "./playbook-drafts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

// her shelf, grouped by type, from the site's own catalog
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const live = CAT.products.filter((p) => !p.draft);
const byType = CAT.categories.map((c) => ({ cat: c, items: live.filter((p) => p.cat === c) })).filter((g) => g.items.length);
const label = (p) => p.name + (p.brand !== "Face Reality" ? " (" + p.brand + ")" : "");
// a product card's questions: "Same as" offers the other products of its own type
const productFields = (p, items) => S.PRODUCT_FIELDS.flatMap((f) => {
  if (f.key !== "like") return [f];
  const others = items.filter((x) => x.id !== p.id).map(label);
  return others.length ? [{ ...f, kind: "one", options: others, text: "Or type its name" }] : [];
});

// her course, module by module, as it reads now (docs/school/curriculum.js)
await import(path.join(root, "docs/school/curriculum.js"));
const SCHOOL = globalThis.window.SCHOOL;
const modules = SCHOOL.levels.flatMap((lv) => lv.modules.map((m) => ({
  id: "module-" + m.lessons[0].id.split("-")[0], title: m.name, sub: "Level " + lv.n + " · " + m.lessons.length + " lessons",
  fields: m.lessons.flatMap(S.SCHOOL_FIELDS)
})));

// ── the question list, as data the page renders ──
const spec = {
  sections: S.SECTIONS,
  clientQuestions: S.CLIENT_QUESTION_GROUPS.map((g) => ({ id: g.id, title: g.title,
    fields: g.questions.map((x) => ({ key: x.key, kind: "text", q: x.q, ph: "Your answer, as you'd text it", rows: 2 })) })),
  concerns: S.CONCERNS, concernFields: S.CONCERN_FIELDS,
  treatmentDetails: S.TREATMENT_DETAILS, treatmentDetailFields: S.TREATMENT_DETAIL_FIELDS,
  visitFields: S.VISIT_FIELDS, materialsFields: S.MATERIALS_FIELDS,
  aftercare: S.TREATMENT_AFTERCARE, aftercareFields: S.AFTERCARE_FIELDS,
  routineFields: S.ROUTINE_FIELDS,
  products: byType.map((g) => ({ cat: g.cat, items: g.items.map((p) => ({ id: p.id, name: label(p), size: p.size || "", fields: productFields(p, g.items) })) })),
  school: modules,
  hardLineFields: S.HARD_LINE_FIELDS,
  voiceFields: S.VOICE_FIELDS,
  treatments: S.TREATMENTS,
  shelf: byType.map((g) => ({ cat: g.cat, items: g.items.map(label) })),
  drafts: DRAFTS   // common answers she confirms or fixes (Quick confirm, and offered in Talk it through)
};

const html = String.raw`<title>Evelyn's Skin Playbook</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
  /* Layout: one column for her phone; a sticky bar holds the section tabs and progress; each
     concern, treatment and product is a card she opens one at a time. */
  :root {
    --ground: #F2EDE6; --card: #FFFFFF; --field: #FBF8F3; --edge: rgba(22, 20, 18, 0.14);
    --ink: #161412; --ink-soft: #5C564F; --accent: #161412; --on-accent: #FFFFFF;
    --wash: rgba(120, 104, 88, 0.1); --sage: #4E6A45; --danger: #A4432F;
    --font: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #1A1715; --card: #242019; --field: #2B261F; --edge: rgba(241, 232, 221, 0.14);
      --ink: #F1E8DD; --ink-soft: #BFB3A6; --accent: #F1E8DD; --on-accent: #1A1715;
      --wash: rgba(217, 164, 140, 0.12); --sage: #A4BE96; --danger: #EE9A86; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --ground: #1A1715; --card: #242019; --field: #2B261F; --edge: rgba(241, 232, 221, 0.14);
    --ink: #F1E8DD; --ink-soft: #BFB3A6; --accent: #F1E8DD; --on-accent: #1A1715;
    --wash: rgba(217, 164, 140, 0.12); --sage: #A4BE96; --danger: #EE9A86; color-scheme: dark;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--ground); color: var(--ink); font: 400 1rem/1.5 var(--font);
    padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
    padding-block: 0 4rem; -webkit-font-smoothing: antialiased;
  }
  body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--ground); }
  .wrap { max-width: 42rem; margin: 0 auto; }
  header { padding: 2rem 0 1rem; display: grid; gap: 0.5rem; }
  .eyebrow { margin: 0; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-soft); }
  h1 { margin: 0; font-size: clamp(2rem, 8vw, 2.8rem); font-weight: 700; line-height: 1.04; letter-spacing: -0.035em; text-wrap: balance; }
  h1 em { font-style: normal; font-weight: 400; color: #8C8379; }
  .lede { margin: 0; color: var(--ink-soft); max-width: 36rem; }

  .bar {
    position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--ground);
    padding: 0.6rem 0 0.5rem; border-bottom: 1px solid var(--edge); margin-bottom: 1rem;
  }
  .tabs { display: flex; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 0.45rem; }
  .tabs::-webkit-scrollbar { display: none; }
  @media (min-width: 720px) { .tabs { flex-wrap: wrap; overflow: visible; } }
  .tab {
    flex: none; display: inline-flex; align-items: center; gap: 0.4rem; min-height: 38px; padding: 0.4rem 0.8rem;
    border: 1px solid var(--edge); border-radius: 999px; background: var(--card); color: var(--ink);
    font: inherit; font-size: 0.84rem; font-weight: 500; cursor: pointer;
  }
  .tab[aria-current="true"] { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .tab-n { font-size: 0.7rem; font-weight: 400; opacity: 0.75; font-variant-numeric: tabular-nums; }
  .status { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-size: 0.8rem; color: var(--ink-soft); }
  .meter { flex: 1; height: 5px; border-radius: 999px; background: var(--wash); overflow: hidden; }
  .meter span { display: block; height: 100%; width: 0; background: var(--accent); transition: width 300ms ease; }
  .save { white-space: nowrap; font-weight: 500; }
  .save.is-ok { color: var(--sage); } .save.is-bad { color: var(--danger); }

  .section { display: none; }
  .section.is-on { display: block; }
  .section-head { display: grid; gap: 0.35rem; margin: 0.5rem 0 1rem; }
  .section-head h2 { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em; }
  .section-head p { margin: 0; color: var(--ink-soft); font-size: 0.95rem; }
  .group-k { margin: 1.4rem 0 0.6rem; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-soft); }

  details.item { background: var(--card); border: 1px solid var(--edge); border-radius: 16px; margin-bottom: 0.6rem; }
  details.item > summary {
    list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    padding: 0.95rem 1.05rem; font-weight: 600; font-size: 1rem;
  }
  details.item > summary::-webkit-details-marker { display: none; }
  details.item > summary .pill { flex: none; white-space: nowrap; font-size: 0.72rem; font-weight: 500; color: var(--ink-soft); padding: 0.2rem 0.55rem; border-radius: 999px; background: var(--wash); font-variant-numeric: tabular-nums; }
  details.item > summary .pill:empty { display: none; }
  details.item > summary .pill.is-done { background: rgba(78, 106, 69, 0.14); color: var(--sage); }
  details.item > summary .sub { display: block; font-size: 0.78rem; font-weight: 400; color: var(--ink-soft); }
  details.item[open] > summary { border-bottom: 1px solid var(--edge); }
  .body { padding: 0.9rem 1.05rem 1.1rem; display: grid; gap: 1.1rem; }
  .q { display: grid; gap: 0.5rem; }
  /* answered questions fold away (and fully answered cards, to the end of their tab): still there to check or change */
  .done-qs > summary, .done-items > summary {
    list-style: none; cursor: pointer; display: block; padding: 0.45rem 0; line-height: 1.4;
    font-size: 0.84rem; font-weight: 500; color: var(--sage);
  }
  .done-qs > summary svg, .done-items > summary svg { vertical-align: -2px; margin-right: 0.15rem; }
  .done-qs > summary::-webkit-details-marker, .done-items > summary::-webkit-details-marker { display: none; }
  .done-qs > summary .more, .done-items > summary .more { color: var(--ink-soft); font-weight: 400; }
  .done-qs[open] > summary .more, .done-items[open] > summary .more { display: none; }
  .done-qs { border-top: 1px dashed var(--edge); padding-top: 0.55rem; }
  .done-qs > .q { margin-top: 1.1rem; }
  .done-qs > .q:first-of-type { margin-top: 0.6rem; }
  .done-items { margin-top: 1.2rem; }
  .done-items[open] > summary { margin-bottom: 0.6rem; }
  .q-t { margin: 0; font-weight: 500; font-size: 0.98rem; }
  .q-h { margin: -0.3rem 0 0; font-size: 0.8rem; color: var(--ink-soft); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip-k { width: 100%; margin: 0.2rem 0 -0.15rem; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-soft); }
  .chip {
    font: inherit; font-size: 0.86rem; line-height: 1.2; color: var(--ink); padding: 0.5rem 0.8rem; min-height: 38px;
    border-radius: 999px; border: 1px solid var(--edge); background: var(--field); cursor: pointer;
  }
  .chip[aria-pressed="true"], .chip[aria-checked="true"] { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  textarea, input[type="text"] {
    font: inherit; font-size: 0.95rem; width: 100%; min-width: 0; color: var(--ink); background: var(--field);
    border: 1px solid var(--edge); border-radius: 12px; padding: 0.7rem 0.85rem;
  }
  textarea { min-height: 4.4rem; resize: vertical; }
  .list { display: grid; gap: 0.5rem; }
  .list label { display: grid; grid-template-columns: 1.4rem 1fr; gap: 0.5rem; align-items: start; font-size: 0.85rem; color: var(--ink-soft); padding-top: 0.6rem; }
  .chip:focus-visible, textarea:focus-visible, input:focus-visible, .tab:focus-visible, .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .hint { display: flex; align-items: center; gap: 0.45rem; margin: 0.2rem 0 0; font-size: 0.84rem; color: var(--ink-soft); }
  .hint svg { flex: none; }
  .media { display: grid; gap: 0.5rem; padding-top: 0.9rem; border-top: 1px dashed var(--edge); }
  .opt { font-size: 0.74rem; font-weight: 500; color: var(--ink-soft); margin-left: 0.4rem; }
  .btn.small { min-height: 40px; padding: 0.6rem 1rem; font-size: 0.88rem; width: max-content; display: inline-flex; align-items: center; gap: 0.45rem; }
  .notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  .notes li { display: grid; gap: 0.3rem; font-size: 0.82rem; color: var(--ink-soft); }
  .notes audio { width: 100%; max-width: 100%; }
  .media-status { margin: 0; font-size: 0.82rem; color: var(--ink-soft); min-height: 1.2em; }
  .shots { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(5.4rem, 1fr)); gap: 0.5rem; }
  .shots:empty { display: none; }
  .shots li { position: relative; aspect-ratio: 3 / 4; border-radius: 10px; overflow: hidden; border: 1px solid var(--edge); background: var(--field); }
  .shots a { display: block; width: 100%; height: 100%; color: var(--ink-soft); text-decoration: none; }
  .shots img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .shots .file { display: grid; place-content: center; gap: 0.2rem; height: 100%; padding: 0.4rem; text-align: center; font-size: 0.7rem; overflow-wrap: anywhere; }
  .shots .file b { font-size: 0.8rem; color: var(--ink); }
  .shot-x {
    position: absolute; top: 4px; right: 4px; min-width: 30px; height: 30px; padding: 0 0.45rem; border-radius: 999px;
    border: 0; background: rgba(22, 20, 18, 0.72); color: #fff; font: 500 0.78rem/1 var(--font); cursor: pointer;
  }
  .shot-x[data-armed] { background: var(--danger); }
  .shot-x:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .media.is-lead { padding-top: 0; border-top: 0; }
  .finish { margin-top: 2rem; padding-top: 1.2rem; border-top: 1px solid var(--edge); display: grid; gap: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .btn { font: 500 0.95rem/1 var(--font); padding: 0.85rem 1.3rem; min-height: 46px; border-radius: 999px; border: 1px solid var(--accent); cursor: pointer; background: var(--accent); color: var(--on-accent); }
  .btn-ghost { background: transparent; color: var(--ink); border-color: var(--edge); }
  .note { margin: 0; font-size: 0.86rem; color: var(--ink-soft); }
  .copybox { width: 100%; min-height: 12rem; font-size: 0.85rem; }
  /* Talk it through: Claude interviews her and fills in the answers */
  .tab-talk { border-color: var(--accent); font-weight: 600; }
  .tab-talk svg { flex: none; }
  .talk-intro { display: grid; gap: 0.8rem; padding: 1rem 1.05rem; background: var(--card); border: 1px solid var(--edge); border-radius: 16px; }
  .talk-intro p { margin: 0; font-size: 0.92rem; color: var(--ink-soft); }
  .talk-topics { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .talk-log { display: grid; gap: 0.7rem; margin: 1rem 0; }
  .msg { max-width: 88%; padding: 0.7rem 0.9rem; border-radius: 18px; font-size: 0.97rem; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  .msg.claude { justify-self: start; background: var(--card); border: 1px solid var(--edge); border-bottom-left-radius: 6px; }
  .msg.evelyn { justify-self: end; background: var(--accent); color: var(--on-accent); border-bottom-right-radius: 6px; }
  .msg.wait { color: var(--ink-soft); }
  .msg.wait span { display: inline-block; animation: talk-dot 1.2s infinite ease-in-out; }
  .msg.wait span:nth-child(2) { animation-delay: 0.15s; } .msg.wait span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes talk-dot { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
  .saved { justify-self: start; display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: -0.3rem; max-width: 92%; }
  .saved-k { font-size: 0.74rem; color: var(--sage); font-weight: 600; align-self: center; }
  .saved button { font: inherit; font-size: 0.74rem; padding: 0.25rem 0.6rem; border-radius: 999px; border: 1px solid rgba(78, 106, 69, 0.35); background: rgba(78, 106, 69, 0.08); color: var(--ink); cursor: pointer; max-width: 100%; text-align: left; }
  .talk-form { position: sticky; bottom: 0; z-index: 4; display: grid; gap: 0.4rem; padding: 0.6rem 0 calc(0.6rem + env(safe-area-inset-bottom, 0px)); background: var(--ground); border-top: 1px solid var(--edge); }
  .talk-bar { display: flex; gap: 0.45rem; align-items: flex-end; }
  .talk-bar textarea { flex: 1; min-height: 46px; max-height: 9rem; padding: 0.7rem 0.85rem; resize: none; border-radius: 22px; }
  .talk-bar .btn { flex: none; min-height: 46px; padding: 0.7rem 1.15rem; }
  .talk-mic { flex: none; width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--edge); background: var(--card); color: var(--ink); display: grid; place-items: center; cursor: pointer; }
  .talk-mic[hidden], .talk-in[hidden] { display: none; }
  .talk-in[hidden] + .talk-send { flex: 1; }
  .talk-mic[aria-pressed="true"] { background: var(--danger); border-color: var(--danger); color: #fff; }
  .talk-topics[hidden], .talk-topic-toggle[hidden] { display: none; }
  .talk-intro .talk-where { font-size: 0.86rem; color: var(--ink); }
  .talk-intro .talk-topic-toggle, .talk-intro .talk-quick-go { justify-self: start; }
  .talk-quick-go[hidden] { display: none; }
  .talk-opts { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; font-size: 0.82rem; color: var(--ink-soft); }
  .talk-opts label { display: inline-flex; gap: 0.4rem; align-items: center; cursor: pointer; }
  .linkish { font: inherit; font-size: 0.82rem; background: none; border: 0; padding: 0.3rem 0; color: var(--ink); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .talk-status { margin: 0; font-size: 0.82rem; color: var(--ink-soft); }
  .talk-status:empty { display: none; }
  .talk-opts { margin-top: 0.4rem; }
  .talk-status.is-bad { color: var(--danger); }
  .talk-where { margin: 0; font-size: 0.78rem; color: var(--ink-soft); }
  .talk-progress { height: 4px; border-radius: 999px; background: var(--wash); overflow: hidden; }
  .talk-progress[hidden] { display: none; }
  .talk-progress span { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--sage); transition: width 400ms ease; }
  @media (prefers-reduced-motion: reduce) { .talk-progress span { transition: none; } }
  @media (prefers-reduced-motion: reduce) { .msg.wait span { animation: none; } }
  @media (prefers-reduced-motion: reduce) { .meter span { transition: none; } }
  /* Quick confirm: one drafted answer at a time; yes, fix it, or skip */
  .tab-confirm { border-color: var(--sage); color: var(--sage); font-weight: 600; }
  .tab-confirm svg { flex: none; }
  .tab-confirm[aria-current="true"] { background: var(--sage); border-color: var(--sage); color: #fff; }
  .cf-top { display: grid; gap: 0.5rem; margin-bottom: 0.9rem; }
  .cf-where { margin: 0; font-size: 0.84rem; color: var(--ink-soft); }
  .cf-progress { height: 4px; border-radius: 999px; background: var(--wash); overflow: hidden; }
  .cf-progress span { display: block; height: 100%; width: 0; border-radius: inherit; background: var(--sage); transition: width 400ms ease; }
  .cf-card { background: var(--card); border: 1px solid var(--edge); border-radius: 16px; padding: 1rem 1.05rem 1.1rem; display: grid; gap: 0.7rem; }
  .cf-k { margin: 0; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
  .cf-q { margin: 0; font-weight: 600; font-size: 1.05rem; line-height: 1.35; text-wrap: balance; }
  .cf-pick { font-size: 0.84rem; color: var(--sage); font-weight: 500; }
  .cf-draft { margin: 0; padding: 0.8rem 0.95rem; border-left: 3px solid var(--sage); background: var(--field); border-radius: 0 12px 12px 0; font-size: 0.97rem; line-height: 1.5; white-space: pre-wrap; }
  .cf-note { margin: 0; font-size: 0.78rem; color: var(--ink-soft); }
  .cf-acts { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .cf-acts .linkish { margin-left: auto; }
  .cf-done { margin: 0; padding: 1rem 1.05rem; background: var(--card); border: 1px solid var(--edge); border-radius: 16px; color: var(--ink-soft); }
  /* Check spelling: her answer with the fix marked in place */
  .sp-diff { margin: 0; padding: 0.8rem 0.95rem; background: var(--field); border-radius: 12px; font-size: 0.97rem; line-height: 1.55; white-space: pre-wrap; }
  .sp-diff del { color: var(--danger); text-decoration: line-through; text-decoration-thickness: 1.5px; }
  .sp-diff ins { text-decoration: none; background: rgba(78, 106, 69, 0.18); color: var(--ink); border-radius: 4px; padding: 0 2px; font-weight: 600; }
  .sp-status { margin: 0; color: var(--ink-soft); font-size: 0.92rem; }
  .sp-all[hidden], .sp-run[hidden], .sp-card[hidden], .sp-edit[hidden], .sp-save[hidden], .sp-use[hidden], .sp-mine[hidden], .sp-diff[hidden] { display: none; }
  .cf-pick[hidden], .cf-draft[hidden], .cf-edit[hidden], .cf-save[hidden], .cf-yes[hidden], .cf-fix[hidden], .cf-card[hidden], .cf-done[hidden], .cf-note[hidden] { display: none; }
  @media (prefers-reduced-motion: reduce) { .cf-progress span { transition: none; } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Lumevina · the assistant learns from you</p>
    <h1>Evelyn's <em>Skin Playbook</em></h1>
    <p class="lede">Everything you'd tell a client, in your own words. The website's assistant answers only from
    what you write here, and hands you anything it can't find. Fill it in over a few sittings; it saves as you go.
    The fastest way: <strong>Quick confirm</strong> shows a common answer for each question, and you say yes or fix
    it. Or type, speak (the mic key on your keyboard), add screenshots of things you've already written, or open
    <strong>Talk it through</strong> and let Claude interview you. Nothing reaches the assistant until you've confirmed it.</p>
  </header>

  <div class="bar">
    <div class="tabs" role="tablist" aria-label="Sections" id="tabs"></div>
    <div class="status" role="status" aria-live="polite">
      <span class="meter" aria-hidden="true"><span id="meter"></span></span>
      <span id="count">0 answered</span>
      <span class="save" id="save">Not saved yet</span>
    </div>
  </div>

  <main id="sections"></main>

  <section class="finish" aria-labelledby="finish-title">
    <h2 id="finish-title" class="eyebrow" style="margin:0">Backup</h2>
    <div class="actions">
      <button class="btn btn-ghost" id="copy" type="button">Copy all my answers</button>
    </div>
    <p class="note" id="copy-note">Puts everything you've written in one message, in case a link ever stops saving.</p>
    <textarea class="copybox" id="copybox" readonly hidden aria-label="Your answers, ready to copy"></textarea>
  </section>
</div>

<script>
(function () {
  "use strict";
  var SPEC = ${JSON.stringify(spec)};
  var COLL = "playbook";
  var LOCAL = "lumevina_playbook_";
  var MODEL = "claude-fable-5-1";   /* for the interview and the spelling check; her plan decides, otherwise the quick tier answers */
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /* ── state: one document per section; keys are "item.field" ── */
  var state = {}; SPEC.sections.forEach(function (s) { state[s.id] = {}; });
  var readLocal = function (sid) { try { return JSON.parse(localStorage.getItem(LOCAL + sid)) || {}; } catch (e) { return {}; } };
  var writeLocal = function (sid) { try { localStorage.setItem(LOCAL + sid, JSON.stringify(state[sid])); } catch (e) { /* storage off */ } };
  /* what the database last confirmed, per section, kept on this phone too: an answer that differs from it hasn't
     reached the database yet, so it wins over what's online and is sent again the next time the page opens */
  var synced = {}, onlineHas = {};
  var readSynced = function (sid) { try { return JSON.parse(localStorage.getItem(LOCAL + sid + ".synced")); } catch (e) { return null; } };
  var writeSynced = function (sid) { try { localStorage.setItem(LOCAL + sid + ".synced", JSON.stringify(synced[sid] || {})); } catch (e) { /* storage off */ } };
  var same = function (x, y) { return JSON.stringify(x == null ? "" : x) === JSON.stringify(y == null ? "" : y); };
  var changedKeys = function (sid) {
    var a = state[sid] || {}, b = synced[sid] || {}, out = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (k) { if (!same(a[k], b[k])) out[k] = a[k] == null ? "" : a[k]; });
    return out;
  };
  var has = function (v) { return Array.isArray(v) ? v.some(function (x) { return x && String(x).trim(); }) : !!(v && String(v).trim()); };

  /* ── every field, flattened: { sid, key, item, field } ── */
  var FIELDS = [];
  var addFields = function (sid, itemId, fields) {
    fields.forEach(function (f) {
      FIELDS.push({ sid: sid, key: itemId + "." + f.key, item: itemId, field: f, text: itemId + "." + f.key + ".text" });
    });
  };
  SPEC.clientQuestions.forEach(function (g) { addFields("client-questions", g.id, g.fields); });
  SPEC.concerns.forEach(function (c) { addFields("concerns", c.id, SPEC.concernFields); });
  SPEC.treatmentDetails.forEach(function (t) { addFields("treatments", t.id, SPEC.treatmentDetailFields); });
  addFields("visits", "visits", SPEC.visitFields);
  addFields("materials", "materials", SPEC.materialsFields);
  SPEC.aftercare.forEach(function (t) { addFields("aftercare", t.id, SPEC.aftercareFields); });
  addFields("routine", "routine", SPEC.routineFields);
  SPEC.products.forEach(function (g) { g.items.forEach(function (p) { addFields("products", p.id, p.fields); }); });
  SPEC.school.forEach(function (m) { addFields("school", m.id, m.fields); });
  addFields("hard-lines", "hard-lines", SPEC.hardLineFields);
  addFields("voice", "voice", SPEC.voiceFields);
  var answeredKey = function (sid, key) { var a = state[sid]; return has(a[key]) || has(a[key + ".text"]); };
  var itemDone = function (sid, itemId) {
    var fs = FIELDS.filter(function (f) { return f.sid === sid && f.item === itemId; });
    return { done: fs.filter(function (f) { return answeredKey(sid, f.key); }).length, total: fs.length };
  };
  var sectionDone = function (sid) {
    var fs = FIELDS.filter(function (f) { return f.sid === sid; });
    return { done: fs.filter(function (f) { return answeredKey(sid, f.key); }).length, total: fs.length };
  };

  /* ── building the page ── */
  var MANY = { "client-questions": 1, concerns: 1, treatments: 1, aftercare: 1, school: 1 };
  var OPTIONAL = { products: 1, school: 1 };   // counted on their own tab, not in the progress bar
  var tabsEl = document.getElementById("tabs");
  var main = document.getElementById("sections");

  var chips = function (sid, key, options, single, label, groups) {
    var g = el("div", "chips");
    g.setAttribute("role", single ? "radiogroup" : "group");
    g.setAttribute("aria-label", label);
    var add = function (opt) {
      var b = el("button", "chip", opt);
      b.type = "button";
      b.setAttribute("role", single ? "radio" : "button");
      b.dataset.sid = sid; b.dataset.key = key; b.dataset.v = opt; b.dataset.single = single ? "1" : "";
      g.appendChild(b);
    };
    if (groups) groups.forEach(function (gr) { g.appendChild(el("span", "chip-k", gr.cat)); gr.items.forEach(add); });
    else options.forEach(add);
    return g;
  };
  var box = function (sid, key, placeholder, label, rows) {
    var t = el("textarea");
    t.rows = rows || 2;
    t.placeholder = placeholder || "";
    t.setAttribute("aria-label", label);
    t.dataset.sid = sid; t.dataset.key = key;
    return t;
  };
  var question = function (sid, itemId, f, i) {
    var q = el("div", "q");
    q.dataset.sid = sid; q.dataset.key = itemId + "." + f.key; q.dataset.i = String(i);
    var t = el("p", "q-t", f.q);
    q.appendChild(t);
    if (f.hint) q.appendChild(el("p", "q-h", f.hint));
    var key = itemId + "." + f.key;
    if (f.kind === "one") q.appendChild(chips(sid, key, f.options, true, f.q));
    if (f.kind === "multi") q.appendChild(chips(sid, key, f.options, false, f.q));
    if (f.kind === "products") q.appendChild(chips(sid, key, null, false, f.q, SPEC.shelf));
    if (f.kind === "treatments") q.appendChild(chips(sid, key, SPEC.treatments, false, f.q));
    if (f.kind === "list") {
      var l = el("div", "list");
      for (var i = 0; i < f.count; i++) {
        var lab = el("label");
        lab.appendChild(el("span", null, String(i + 1)));
        var t2 = box(sid, key, i < 5 ? "" : "optional", f.q + " " + (i + 1), 2);
        t2.dataset.n = String(i);
        lab.appendChild(t2);
        l.appendChild(lab);
      }
      q.appendChild(l);
    }
    if (f.kind === "text") q.appendChild(box(sid, key, f.ph || "", f.q, f.rows || 3));
    else if (f.kind !== "list") q.appendChild(box(sid, key + ".text", f.text || "In your words", (f.text || "More") + ": " + f.q, 2));
    return q;
  };
  var item = function (sid, it, fields, sub, shotsFirst) {
    var d = el("details", "item");
    d.dataset.sid = sid; d.dataset.item = it.id;
    var s = el("summary");
    var name = el("span");
    name.appendChild(document.createTextNode(it.title || it.name));
    if (sub) name.appendChild(el("span", "sub", sub));
    s.appendChild(name);
    s.appendChild(el("span", "pill", ""));
    d.appendChild(s);
    var b = el("div", "body");
    if (shotsFirst) b.appendChild(shotsRow(sid, it.id, true));
    fields.forEach(function (f, i) { b.appendChild(question(sid, it.id, f, i)); });
    var fold = el("details", "done-qs");
    fold.hidden = true;
    fold.appendChild(el("summary"));
    b.appendChild(fold);
    if (!shotsFirst) b.appendChild(shotsRow(sid, it.id));
    b.appendChild(voiceRow(sid, it.id));
    d.appendChild(b);
    return d;
  };

  /* ── voice memos and screenshots, kept with the answers. Voice memos are
     recorded in her phone's own recorder (the page can't open the microphone
     inside this viewer); screenshots come from her photo library. ── */
  var assets = null;
  var MIC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  var PIC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>';
  var mediaRow = function (sid, itemId, kind, title, hint, button, icon, accept, lead) {
    var v = el("div", "media" + (lead ? " is-lead" : ""));
    var t = el("p", "q-t");
    t.appendChild(document.createTextNode(title));
    if (!lead) t.appendChild(el("span", "opt", "optional"));
    v.appendChild(t);
    v.appendChild(el("p", "q-h", hint));
    var list = el("ul", kind === "shots" ? "shots" : "notes");
    list.dataset.sid = sid; list.dataset.item = itemId;
    var lab = el("label", "btn btn-ghost small");
    lab.innerHTML = icon;
    lab.appendChild(document.createTextNode(button));
    var inp = el("input");
    inp.type = "file"; inp.accept = accept; inp.hidden = true;
    if (kind === "shots") inp.multiple = true;
    inp.dataset.sid = sid; inp.dataset.item = itemId; inp.dataset.kind = kind;
    inp.setAttribute("aria-label", button);
    lab.appendChild(inp);
    if (kind === "shots") { v.appendChild(list); v.appendChild(lab); } else { v.appendChild(lab); v.appendChild(list); }
    v.appendChild(el("p", "media-status"));
    return v;
  };
  var voiceRow = function (sid, itemId) {
    return mediaRow(sid, itemId, "voice", "Voice note",
      "Record a voice memo on your phone and add it here. It stays with your answers, and later it can help a voice assistant sound like you.",
      "Add a recording", MIC, "audio/*,video/*");
  };
  var shotsRow = function (sid, itemId, lead) {
    return mediaRow(sid, itemId, "shots", lead ? "Add your screenshots" : "Screenshots",
      lead ? "Add as many as you like, a few at a time. Photos of printed cards work too."
        : "Already answered this somewhere? Screenshot the text, card or post and add it here; it doesn't matter which question it answers. The assistant reads them alongside what you type.",
      "Add screenshots", PIC, "image/*,application/pdf", lead);
  };

  /* what the store accepts: MP4 and WebM containers, so a phone voice memo
     (.m4a, an MP4 container) is stored as video/mp4 and plays back as audio */
  var mediaType = function (file) {
    var n = (file.name || "").toLowerCase(), t = (file.type || "").toLowerCase();
    if (/\.(m4a|mp4|aac|mov|m4v)$/.test(n) || /^(audio|video)\/(mp4|x-m4a|m4a|aac|quicktime|x-m4v)$/.test(t)) return "video/mp4";
    if (/\.(webm|weba)$/.test(n) || /webm/.test(t)) return "video/webm";
    return null;
  };
  var MAX = 20 * 1024 * 1024;
  var shotType = function (file) {
    var n = (file.name || "").toLowerCase(), t = (file.type || "").toLowerCase();
    if (t === "image/jpg") t = "image/jpeg";
    if (/^(image\/(png|jpeg|webp|gif)|application\/pdf)$/.test(t)) return t;
    if (/\.png$/.test(n)) return "image/png";
    if (/\.jpe?g$/.test(n)) return "image/jpeg";
    if (/\.webp$/.test(n)) return "image/webp";
    if (/\.pdf$/.test(n)) return "application/pdf";
    return null;
  };
  /* an iPhone photo the store can't take (HEIC), or one over the limit:
     redrawn as a JPEG, at most 2400px on its long side */
  var asJpeg = function (file) {
    var draw = function (src, w, h) {
      var k = Math.min(1, 2400 / Math.max(w, h)), c = document.createElement("canvas");
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(b) : no(new Error("encode")); }, "image/jpeg", 0.88); });
    };
    if (window.createImageBitmap) {
      return createImageBitmap(file).then(function (bm) { return draw(bm, bm.width, bm.height); });
    }
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); draw(img, img.naturalWidth, img.naturalHeight).then(ok, no); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error("decode")); };
      img.src = url;
    });
  };
  var shotFailure = function (code) {
    return code === "not_granted" ? "this link can't store screenshots from you"
      : code === "too_large" ? "it's over 20 MB"
      : code === "unsupported_type" ? "that kind of file can't be stored here (a screenshot or PDF works)"
      : code === "quota_or_state" ? "storage for this link is full"
      : "the upload didn't go through";
  };
  var addShot = function (file) {
    var type = shotType(file);
    var isImage = /^image\//i.test(file.type || "") || /\.(heic|heif|png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name || "");
    if (type && file.size <= MAX) return assets.upload(file, { type: type });
    if (!isImage) return Promise.reject({ code: type ? "too_large" : "unsupported_type" });
    return asJpeg(file).then(function (jpg) { return assets.upload(jpg, { type: "image/jpeg" }); },
      function () { return Promise.reject({ code: "unsupported_type" }); });
  };
  var addShots = function (sid, itemId, files, status) {
    if (!assets) { status.textContent = "This link can't store screenshots. Text them to Ruben instead; your typed answers still save."; return; }
    var added = 0, failed = [], i = 0;
    var next = function () {
      if (i >= files.length) {
        status.textContent = (added ? "Added " + (added === 1 ? "1 screenshot" : added + " screenshots") + "." : "")
          + (failed.length ? (added ? " " : "") + (failed.length === 1 ? "One" : failed.length) + " couldn't be added: " + failed[0] + ". Text " + (failed.length === 1 ? "it" : "them") + " to Ruben instead." : "");
        return;
      }
      var file = files[i++];
      status.textContent = files.length > 1 ? "Uploading " + i + " of " + files.length + "…" : "Uploading…";
      addShot(file).then(function (r) {
        var a = state[sid], k = itemId + ".shots", list = Array.isArray(a[k]) ? a[k].slice() : [];
        list.push({ id: r.id, name: file.name || "Screenshot", at: new Date().toISOString(), size: r.sizeBytes, type: r.contentType });
        a[k] = list;
        added++;
        schedule(sid, 0);
      }, function (err) { failed.push(shotFailure(err && err.code)); }).then(next);
    };
    next();
  };
  var addVoice = function (sid, itemId, file, status) {
    if (!assets) { status.textContent = "This link can't store recordings. Text the memo to Ruben instead; your typed answers still save."; return; }
    var type = mediaType(file);
    if (!type) { status.textContent = "That file type can't be stored here. A voice memo (.m4a) or a video works, or text it to Ruben."; return; }
    if (file.size > MAX) { status.textContent = "That one's over 20 MB. A shorter memo, or text it to Ruben."; return; }
    status.textContent = "Uploading…";
    assets.upload(file, { type: type }).then(function (r) {
      var a = state[sid], list = Array.isArray(a[itemId + ".voice"]) ? a[itemId + ".voice"].slice() : [];
      list.push({ id: r.id, name: file.name || "Voice note", at: new Date().toISOString(), size: r.sizeBytes, type: r.contentType });
      a[itemId + ".voice"] = list;
      status.textContent = "Added.";
      schedule(sid, 0);
    }, function (err) {
      var code = err && err.code;
      status.textContent = code === "not_granted" ? "This link can't store recordings from you. Text the memo to Ruben instead."
        : code === "too_large" ? "That one's too big. A shorter memo, or text it to Ruben."
        : "Couldn't upload that. Try again, or text the memo to Ruben.";
    });
  };
  main.addEventListener("change", function (e) {
    var inp = e.target;
    if (!inp.matches || !inp.matches("input[type=file]")) return;
    var files = Array.prototype.slice.call(inp.files || []);
    inp.value = "";
    if (!files.length) return;
    var status = inp.closest(".media").querySelector(".media-status");
    if (inp.dataset.kind === "shots") addShots(inp.dataset.sid, inp.dataset.item, files, status);
    else addVoice(inp.dataset.sid, inp.dataset.item, files[0], status);
  });
  /* removing a screenshot takes two taps; the file itself is deleted with it */
  main.addEventListener("click", function (e) {
    var x = e.target.closest(".shot-x");
    if (!x) return;
    e.preventDefault();
    if (!x.hasAttribute("data-armed")) {
      x.setAttribute("data-armed", ""); x.textContent = "Remove";
      setTimeout(function () { if (x.isConnected) { x.removeAttribute("data-armed"); x.textContent = "×"; } }, 4000);
      return;
    }
    var ul = x.closest("ul.shots"), sid = ul.dataset.sid, k = ul.dataset.item + ".shots", id = x.dataset.id;
    state[sid][k] = (state[sid][k] || []).filter(function (n) { return n.id !== id; });
    schedule(sid, 0);
    if (assets && assets.delete) assets.delete(id).catch(function () { /* already gone, or not ours to delete */ });
  });

  SPEC.sections.forEach(function (s, i) {
    var tab = el("button", "tab");
    tab.type = "button"; tab.setAttribute("role", "tab"); tab.dataset.sid = s.id;
    tab.appendChild(document.createTextNode(s.title));
    tab.appendChild(el("span", "tab-n", ""));
    tabsEl.appendChild(tab);

    var sec = el("section", "section");
    sec.id = "s-" + s.id;
    sec.setAttribute("aria-labelledby", "h-" + s.id);
    var head = el("div", "section-head");
    var h = el("h2", null, s.title); h.id = "h-" + s.id;
    head.appendChild(h);
    head.appendChild(el("p", null, s.intro));
    var hint = el("p", "hint");
    hint.innerHTML = MIC;
    hint.appendChild(document.createTextNode("Speak instead of typing: tap the mic key on your keyboard, in any box. Or add screenshots on any card."));
    head.appendChild(hint);
    sec.appendChild(head);

    if (s.id === "client-questions") SPEC.clientQuestions.forEach(function (g, gi) {
      var d = item("client-questions", g, g.fields);
      if (gi === 0) d.open = true;
      sec.appendChild(d);
    });
    if (s.id === "concerns") SPEC.concerns.forEach(function (c) { sec.appendChild(item("concerns", c, SPEC.concernFields)); });
    if (s.id === "treatments") SPEC.treatmentDetails.forEach(function (t) { sec.appendChild(item("treatments", t, SPEC.treatmentDetailFields)); });
    if (s.id === "visits") { var vi = item("visits", { id: "visits", title: "Before they walk in" }, SPEC.visitFields); vi.open = true; sec.appendChild(vi); }
    if (s.id === "materials") { var mt = item("materials", { id: "materials", title: "Screenshots and photos" }, SPEC.materialsFields, null, true); mt.open = true; sec.appendChild(mt); }
    if (s.id === "aftercare") SPEC.aftercare.forEach(function (t) { sec.appendChild(item("aftercare", t, SPEC.aftercareFields)); });
    if (s.id === "routine") { var r = item("routine", { id: "routine", title: "Routine and starting actives" }, SPEC.routineFields); r.open = true; sec.appendChild(r); }
    if (s.id === "products") SPEC.products.forEach(function (g) {
      sec.appendChild(el("p", "group-k", g.cat));
      g.items.forEach(function (p) { sec.appendChild(item("products", { id: p.id, title: p.name }, p.fields, p.size)); });
    });
    if (s.id === "school") SPEC.school.forEach(function (m) { sec.appendChild(item("school", m, m.fields, m.sub)); });
    if (MANY[s.id]) {
      sec.querySelectorAll("details.item").forEach(function (d, i) { d.dataset.i = String(i); });
      var doneBox = el("details", "done-items");
      doneBox.hidden = true;
      doneBox.appendChild(el("summary"));
      sec.appendChild(doneBox);
    }
    if (s.id === "hard-lines") { var hl = item("hard-lines", { id: "hard-lines", title: "Always to Evelyn" }, SPEC.hardLineFields); hl.open = true; sec.appendChild(hl); }
    if (s.id === "voice") { var v = item("voice", { id: "voice", title: "How you talk to clients" }, SPEC.voiceFields); v.open = true; sec.appendChild(v); }
    main.appendChild(sec);
  });

  /* ── what she has answered moves out of the way: each card's answered
     questions fold under "Answered already", and a card with every question
     answered folds to the end of its tab. Only on opening the page, a tab or
     a card, never while she types, and never the box she's in. ── */
  var CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  var busy = function (node) { return node.contains(document.activeElement) && document.activeElement !== document.body; };
  var byIndex = function (a, b) { return +a.dataset.i - +b.dataset.i; };
  var foldLabel = function (fold, n, what) {
    var sm = fold.querySelector("summary");
    sm.innerHTML = CHECK;
    sm.appendChild(document.createTextNode(" " + n + " " + what + " "));
    sm.appendChild(el("span", "more", "· tap to check or change"));
    fold.hidden = !n;
  };
  var tidyItem = function (d) {
    var body = d.querySelector(".body"), fold = body.querySelector(".done-qs"), n = 0;
    Array.prototype.slice.call(body.querySelectorAll(".q[data-key]")).sort(byIndex).forEach(function (q) {
      var done = answeredKey(q.dataset.sid, q.dataset.key);
      if (done) n++;
      if (busy(q)) return;
      if (done) fold.appendChild(q); else body.insertBefore(q, fold);
    });
    foldLabel(fold, n, n === 1 ? "question answered already" : "questions answered already");
    if (n === body.querySelectorAll(".q[data-key]").length && !busy(fold)) fold.open = false;
  };
  var tidy = function (sid) {
    SPEC.sections.forEach(function (s) {
      if (sid && s.id !== sid) return;
      var sec = document.getElementById("s-" + s.id);
      sec.querySelectorAll("details.item").forEach(tidyItem);
      var box = sec.querySelector(".done-items");
      if (!box) return;
      var n = 0;
      Array.prototype.slice.call(sec.querySelectorAll("details.item")).sort(byIndex).forEach(function (d) {
        var c = itemDone(s.id, d.dataset.item), done = c.total > 0 && c.done === c.total;
        if (done) n++;
        if (busy(d)) return;
        if (done) { d.open = false; box.appendChild(d); } else sec.insertBefore(d, box);
      });
      foldLabel(box, n, n === 1 ? "card answered" : "cards answered");
    });
  };

  /* ── showing answers ── */
  var paint = function () {
    main.querySelectorAll(".chip[data-sid]").forEach(function (b) {
      var v = state[b.dataset.sid][b.dataset.key];
      var on = b.dataset.single ? v === b.dataset.v : Array.isArray(v) && v.indexOf(b.dataset.v) !== -1;
      b.setAttribute(b.dataset.single ? "aria-checked" : "aria-pressed", String(!!on));
    });
    main.querySelectorAll("textarea[data-key]").forEach(function (t) {
      if (t === document.activeElement) return;
      var v = state[t.dataset.sid][t.dataset.key];
      t.value = (t.dataset.n != null ? (Array.isArray(v) ? v[+t.dataset.n] : "") : v) || "";
    });
    main.querySelectorAll("ul.notes").forEach(function (ul) {
      var list = state[ul.dataset.sid][ul.dataset.item + ".voice"] || [];
      var sig = list.map(function (n) { return n.id; }).join(",");
      if (ul.dataset.sig === sig) return;
      ul.dataset.sig = sig;
      ul.textContent = "";
      list.forEach(function (n) {
        var li = el("li");
        li.appendChild(el("span", "note-name", (n.name || "Voice note") + " · " + new Date(n.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })));
        var au = el("audio");
        au.controls = true; au.preload = "none"; au.src = "/_blob/" + n.id;
        li.appendChild(au);
        ul.appendChild(li);
      });
    });
    main.querySelectorAll("ul.shots").forEach(function (ul) {
      var list = state[ul.dataset.sid][ul.dataset.item + ".shots"] || [];
      var sig = list.map(function (n) { return n.id; }).join(",");
      if (ul.dataset.sig === sig) return;
      ul.dataset.sig = sig;
      ul.textContent = "";
      list.forEach(function (n) {
        var li = el("li"), a = el("a");
        a.href = "/_blob/" + n.id; a.target = "_blank"; a.rel = "noopener";
        a.setAttribute("aria-label", "Open " + (n.name || "screenshot"));
        if (/^image\//.test(n.type || "")) {
          var im = el("img");
          im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.src = "/_blob/" + n.id;
          im.onerror = function () { a.textContent = ""; var f = el("span", "file"); f.appendChild(el("b", null, "Can't show")); f.appendChild(document.createTextNode(n.name || "")); a.appendChild(f); };
          a.appendChild(im);
        } else {
          var f = el("span", "file");
          f.appendChild(el("b", null, "PDF"));
          f.appendChild(document.createTextNode(n.name || ""));
          a.appendChild(f);
        }
        li.appendChild(a);
        var x = el("button", "shot-x", "×");
        x.type = "button"; x.dataset.id = n.id;
        x.setAttribute("aria-label", "Remove " + (n.name || "screenshot"));
        li.appendChild(x);
        ul.appendChild(li);
      });
    });
    main.querySelectorAll("details.item").forEach(function (d) {
      var c = itemDone(d.dataset.sid, d.dataset.item), pill = d.querySelector(".pill");
      var vn = (state[d.dataset.sid][d.dataset.item + ".voice"] || []).length;
      var sn = (state[d.dataset.sid][d.dataset.item + ".shots"] || []).length;
      var bits = [];
      if (c.done) bits.push(c.done + " of " + c.total);
      if (sn) bits.push(sn + (sn === 1 ? " pic" : " pics"));
      if (vn) bits.push(vn + " voice");
      pill.textContent = bits.join(" · ");
      pill.classList.toggle("is-done", c.done === c.total && c.total > 0);
    });
    var all = 0;
    tabsEl.querySelectorAll(".tab").forEach(function (t) {
      if (t.dataset.sid === "talk") return;
      var c = sectionDone(t.dataset.sid);
      all += c.done;
      t.querySelector(".tab-n").textContent = OPTIONAL[t.dataset.sid] ? (c.done ? String(c.done) : "") : c.done + "/" + c.total;
    });
    var required = FIELDS.filter(function (f) { return !OPTIONAL[f.sid]; }).length;
    var reqDone = FIELDS.filter(function (f) { return !OPTIONAL[f.sid] && answeredKey(f.sid, f.key); }).length;
    document.getElementById("meter").style.width = (reqDone / required * 100) + "%";
    document.getElementById("count").textContent = all + " answered";
    if (typeof paintConfirm === "function") paintConfirm();
    if (typeof spPaint === "function") spPaint();
  };

  var current = null;
  var show = function (sid) {
    current = sid;
    if (sid !== "talk" && document.getElementById("s-" + sid)) tidy(sid);
    main.querySelectorAll(".section").forEach(function (s) { s.classList.toggle("is-on", s.id === "s-" + sid); });
    tabsEl.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-current", String(t.dataset.sid === sid)); });
    try { localStorage.setItem(LOCAL + "tab", sid); } catch (e) { /* storage off */ }
    window.scrollTo({ top: 0 });
  };
  tabsEl.addEventListener("click", function (e) { var t = e.target.closest(".tab"); if (t) show(t.dataset.sid); });
  main.addEventListener("toggle", function (e) { if (e.target.matches && e.target.matches("details.item") && e.target.open) tidyItem(e.target); }, true);

  /* ── saving. Every keystroke and tap is kept on this phone at once; the database gets what changed
     a moment after she pauses, when she leaves a box, and when she switches away from the page. Only
     the answers that changed are sent, merged into what's saved, so the page open on another phone or
     computer never wipes out what she wrote there. One write at a time per section. ── */
  var saveEl = document.getElementById("save");
  var setSave = function (text, cls) { saveEl.textContent = text; saveEl.className = "save" + (cls ? " " + cls : ""); };
  var db = null, canSave = null, timers = {}, writing = {}, again = {}, fails = {};
  var pending = function () { return Object.keys(timers).some(function (k) { return timers[k]; }) || Object.keys(writing).some(function (k) { return writing[k]; }); };
  var cantSave = function () {
    canSave = false;
    setSave("Can't save here", "is-bad");
    document.getElementById("copy-note").textContent = "This link can't save online. Your answers stay on this phone: use Copy all my answers and send them to Ruben.";
  };
  var flush = function (sid) {
    clearTimeout(timers[sid]); timers[sid] = null;
    if (!db || canSave === false) return;
    if (writing[sid]) { again[sid] = true; return; }
    var changes = changedKeys(sid);
    if (!Object.keys(changes).length) { if (!pending()) setSave("Saved", "is-ok"); return; }
    writing[sid] = true;
    setSave("Saving…");
    var at = new Date().toISOString(), ref = db.doc(COLL + "/" + sid);
    var whole = function () { var body = JSON.parse(JSON.stringify({ answers: state[sid], updatedAt: at })); return ref.set(body).then(function () { return body.answers; }); };
    var sent = JSON.parse(JSON.stringify(changes));
    var write = onlineHas[sid]
      ? ref.update({ answers: sent, updatedAt: at }).then(function () { return null; }, function (err) {
          if (err && err.code === "invalid_argument") return whole();   // the section's document isn't there yet
          throw err;
        })
      : whole();
    write.then(function (all) {
      onlineHas[sid] = true; fails[sid] = 0;
      if (all) synced[sid] = all;
      else { synced[sid] = synced[sid] || {}; Object.keys(sent).forEach(function (k) { synced[sid][k] = sent[k]; }); }
      writeSynced(sid);
    }, function (err) {
      if (err && err.code === "invalid_argument") cantSave();
      else { fails[sid] = (fails[sid] || 0) + 1; setSave(navigator.onLine === false ? "Saved on this phone · sends when you're back online" : "Not saved yet · trying again", "is-bad"); again[sid] = true; }
    }).then(function () {
      writing[sid] = false;
      if (again[sid]) { again[sid] = false; schedule(sid, Math.min(15000, 1500 * Math.max(1, fails[sid] || 0)), true); }
      else if (!pending() && canSave !== false && Object.keys(changedKeys(sid)).length === 0) setSave("Saved", "is-ok");
    });
  };
  var flushAll = function () { Object.keys(state).forEach(function (sid) { if (timers[sid] || Object.keys(changedKeys(sid)).length) flush(sid); }); };
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flushAll(); });
  window.addEventListener("pagehide", flushAll);
  window.addEventListener("online", flushAll);
  var schedule = function (sid, ms, retry) {
    writeLocal(sid);
    paint();
    if (!db) return;
    if (canSave !== false && !retry) setSave("Saving…");
    clearTimeout(timers[sid]);
    timers[sid] = setTimeout(function () { flush(sid); }, ms == null ? 900 : ms);
  };

  main.addEventListener("click", function (e) {
    var b = e.target.closest(".chip[data-sid]");
    if (!b) return;
    var a = state[b.dataset.sid], k = b.dataset.key, v = b.dataset.v;
    if (b.dataset.single) a[k] = a[k] === v ? "" : v;
    else {
      var arr = Array.isArray(a[k]) ? a[k].slice() : [];
      var i = arr.indexOf(v);
      if (i === -1) arr.push(v); else arr.splice(i, 1);
      a[k] = arr;
    }
    schedule(b.dataset.sid);
  });
  main.addEventListener("input", function (e) {
    var t = e.target;
    if (!t.dataset || !t.dataset.key) return;
    var a = state[t.dataset.sid];
    if (t.dataset.n != null) {
      var l = Array.isArray(a[t.dataset.key]) ? a[t.dataset.key].slice() : [];
      while (l.length <= +t.dataset.n) l.push("");
      l[+t.dataset.n] = t.value;
      a[t.dataset.key] = l;
    } else a[t.dataset.key] = t.value;
    schedule(t.dataset.sid);
  });
  /* leaving a box saves it right away */
  main.addEventListener("focusout", function (e) {
    var t = e.target;
    if (t && t.dataset && t.dataset.sid && timers[t.dataset.sid]) flush(t.dataset.sid);
  });

  /* ── one message with everything, as a backup ── */
  var asText = function () {
    var out = ["Evelyn's Skin Playbook"];
    SPEC.sections.forEach(function (s) {
      out.push("", "=== " + s.title.toUpperCase() + " ===");
      var items = {};
      FIELDS.filter(function (f) { return f.sid === s.id; }).forEach(function (f) { (items[f.item] = items[f.item] || []).push(f); });
      Object.keys(items).forEach(function (itemId) {
        var lines = [];
        items[itemId].forEach(function (f) {
          var a = state[s.id], v = a[f.key], extra = a[f.key + ".text"];
          if (!has(v) && !has(extra)) return;
          var val = Array.isArray(v) ? v.filter(Boolean).map(function (x, i) { return f.field.kind === "list" ? (i + 1) + ". " + x : x; }).join(f.field.kind === "list" ? "\n" : ", ") : (v || "");
          lines.push("- " + f.field.q + (val ? "\n  " + val.replace(/\n/g, "\n  ") : "") + (has(extra) ? "\n  " + String(extra).replace(/\n/g, "\n  ") : ""));
        });
        var vn = state[s.id][itemId + ".voice"];
        if (vn && vn.length) lines.push("- Voice notes: " + vn.map(function (n) { return n.name; }).join(", "));
        var sn = state[s.id][itemId + ".shots"];
        if (sn && sn.length) lines.push("- Screenshots (saved with the playbook): " + sn.map(function (n) { return n.name; }).join(", "));
        if (lines.length) out.push("", "## " + itemId, lines.join("\n"));
      });
    });
    return out.join("\n");
  };
  document.getElementById("copy").addEventListener("click", function () {
    var text = asText(), bx = document.getElementById("copybox"), note = document.getElementById("copy-note");
    var showBox = function () { bx.value = text; bx.hidden = false; bx.focus(); bx.select(); note.textContent = "Your answers are selected below. Copy them and send them to Ruben."; };
    try { navigator.clipboard.writeText(text).then(function () { note.textContent = "Copied. Paste it into a message to Ruben."; }, showBox); } catch (e) { showBox(); }
  });

  /* ── Talk it through: Claude interviews her, one question at a time, and
     what she says lands in the same answers as the tabs (so the assistant
     learns it the same way). The conversation is kept in playbook/interview.
     It runs on her own Claude (the page's "sample" capability); without it,
     the tab says so and the typed questions work as always. ── */
  var talk = { turns: [], skips: [], focus: "quick" };
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null, micOff = false;
  /* inside the Claude app (and any viewer that frames the page) the page may
     not use the microphone, so the in-page mic would only fail: the keyboard's
     own dictation is the way to talk there */
  try { if (window.self !== window.top) micOff = true; } catch (e) { micOff = true; }
  var sample = null, talking = false, ctl = null, talkReady = false;
  var TALK_ORDER = ["client-questions", "treatments", "aftercare", "concerns", "visits", "routine", "hard-lines", "voice"];
  /* the 10-minute version: the questions clients ask most, asked back to back
     (about 20 seconds each); everything else can wait for another day */
  var QUICK = [
    "client-questions/cq-before.stop_products", "client-questions/cq-before.breaking_out", "client-questions/cq-before.hair_length",
    "client-questions/cq-before.shave_before", "client-questions/cq-before.sun_before",
    "client-questions/cq-after.makeup_after", "client-questions/cq-after.workout_after", "client-questions/cq-after.wash_after",
    "client-questions/cq-after.breakout_after", "client-questions/cq-after.actives_after", "client-questions/cq-after.bumps_after_wax",
    "client-questions/cq-routine.own_products", "client-questions/cq-routine.buy_everything", "client-questions/cq-routine.sunscreen",
    "client-questions/cq-results.how_many_facials", "client-questions/cq-results.how_often_facial", "client-questions/cq-results.acne_how_long",
    "client-questions/cq-results.wax_how_often", "client-questions/cq-booking.which_facial",
    "aftercare/facials.normal", "aftercare/facials.not_normal",
    "routine/routine.order", "routine/routine.dont_mix", "visits/visits.first_visit",
    "hard-lines/hard-lines.always_evelyn", "hard-lines/hard-lines.never_say"
  ];
  var SECS_PER_Q = 20;
  var BY_ID = {};
  FIELDS.forEach(function (f) { BY_ID[f.sid + "/" + f.key] = f; });
  var sectionTitle = function (sid) { if (sid === "quick") return "the 10-minute version"; for (var i = 0; i < SPEC.sections.length; i++) if (SPEC.sections[i].id === sid) return SPEC.sections[i].title; return sid; };
  var itemEl = function (sid, item) { return main.querySelector('details.item[data-sid="' + sid + '"][data-item="' + item + '"]'); };
  var itemTitle = function (sid, item) { var d = itemEl(sid, item); return d ? d.querySelector("summary > span").firstChild.textContent : item; };
  var itemsOf = function (sid) {
    var seen = {}, out = [];
    FIELDS.forEach(function (f) { if (f.sid === sid && !seen[f.item]) { seen[f.item] = true; out.push(f.item); } });
    return out;
  };
  var skippedField = function (f) { return talk.skips.indexOf(f.sid + "/" + f.key) !== -1; };
  var quickOnly = function (f) { return talk.focus !== "quick" || QUICK.indexOf(f.sid + "/" + f.key) !== -1; };
  var openFields = function (sid, item) {
    return FIELDS.filter(function (f) { return f.sid === sid && f.item === item && !answeredKey(sid, f.key) && !skippedField(f) && quickOnly(f); });
  };
  var upcoming = function (n) {
    var out = [], seen = {};
    if (talk.focus === "quick") {
      QUICK.forEach(function (id) {
        var f = BY_ID[id];
        if (!f || out.length >= n || seen[f.sid + "|" + f.item] || !openFields(f.sid, f.item).length) return;
        seen[f.sid + "|" + f.item] = true;
        out.push({ sid: f.sid, item: f.item });
      });
      return out;
    }
    var order = talk.focus === "auto" ? TALK_ORDER : [talk.focus];
    order.forEach(function (sid) {
      itemsOf(sid).forEach(function (item) { if (out.length < n && openFields(sid, item).length) out.push({ sid: sid, item: item }); });
    });
    return out;
  };
  /* the 10-minute version's progress: answered or skipped, of all of them */
  var quickDone = function () {
    return QUICK.filter(function (id) { var f = BY_ID[id]; return !f || answeredKey(f.sid, f.key) || skippedField(f); }).length;
  };
  var describe = function (f) {
    var k = f.field.kind, s = "- " + f.sid + "/" + f.key + ": " + f.field.q;
    if (f.field.hint) s += " (" + f.field.hint + ")";
    if (f.field.options) s += " She may pick from: " + f.field.options.join("; ") + ".";
    if (k === "products") s += " She names products from her shelf, and how to use them.";
    if (k === "treatments") s += " She names treatments from her menu.";
    if (f.sid === "school" && /_ok$/.test(f.key)) s += " This is a lesson of her online course as it reads now (in brackets): tell her what it says in a sentence or two, and ask whether that's how she'd teach it. If she'd change something, save what she'd change, in her words.";
    if (f.sid === "products" && f.field.key === "stop") s += " Only the signs she names; never suggest any.";
    if (k === "list") s += " Real replies she has sent clients, names removed: save each one she shares as its own value.";
    var d = SPEC.drafts[f.sid + "/" + f.key];
    if (d) s += ' A common answer to offer her, from standard practice: "' + (typeof d === "string" ? d : [].concat(d.pick || []).join(", ") + (d.text ? ". " + d.text : "")).replace(/"/g, "\'") + '"';
    return s;
  };
  var RULES = [
    "You are interviewing Evelyn Romero, the licensed esthetician who owns Lumevina Aesthetics Spa, to fill in her Skin Playbook. Her answers become what her website's assistant tells clients, so they must be hers. She is on her phone, typing or dictating.",
    "",
    "How to talk:",
    "- Warm, brief, plain. One question at a time, with at most one short sentence before it.",
    "- Work through the questions listed below, in order, in your own natural words. If an answer is vague or incomplete for a client to act on (no timing, no product name, no amount or frequency, \"it depends\" without on what), ask one short follow-up, then move on.",
    "- When a question below comes with a common answer, offer it: say it to her in a sentence or two and ask whether that's what she tells clients, or what she'd change. If she says yes as it is, save the common answer as given; if she corrects it, save her version. When no common answer is given, never invent one, never suggest products, timings or claims, and never give skin or medical advice yourself; if she asks what she should say, ask what she tells clients now.",
    "- If she'd rather skip a question, or doesn't know, say that's fine and move on: put its id in \"skip\".",
    "- If she says she's done for now, thank her briefly, tell her everything is saved, ask nothing more, and set \"pause\" to true.",
    "",
    "Saving: whenever her message answers one of the listed questions, save it.",
    "- \"value\" is her answer in her own words, lightly cleaned: drop filler and false starts; keep her phrasing, product names and numbers; first person the way she spoke. Never add anything she didn't say. If she corrects herself, save the corrected version.",
    "- One entry per question answered; one message can answer several. A follow-up answer to the same question is saved again with just the new part.",
    "- Only use the ids listed below.",
    "",
    "Reply with only this JSON: {\"say\": \"your next message to her\", \"save\": [{\"field\": \"<id>\", \"value\": \"...\"}], \"skip\": [\"<id>\"], \"pause\": false}"
  ].join("\n");
  var context = function () {
    var next = upcoming(2);
    var quick = talk.focus === "quick";
    if (!next.length && quick) return "Where we are: the 10-minute version is done (the " + QUICK.length + " questions clients ask most). Thank her warmly in one or two sentences, " +
      "tell her the website's assistant can now answer those for her, and ask whether she'd like to keep going another time with the rest (\"Claude picks\" above the chat). Set pause to true.";
    if (!next.length) return "Where we are: every question in " + (talk.focus === "auto" ? "the main sections" : sectionTitle(talk.focus)) +
      " is answered or skipped. Thank her, and ask whether she'd like to pick another topic (the buttons above the chat) or stop for today. Set pause to true.";
    return (quick ? "This is the 10-minute version: " + QUICK.length + " questions, the ones clients ask most, back to back (" + quickDone() + " done). Keep it moving: " +
      "just the next question, with no preamble or recap; a few words of thanks at most; a follow-up only when an answer can't be used as it is; then straight on to the next." +
      (QUICK.length - quickDone() === 1 ? " This is the last one: once she has answered it, thank her warmly in one or two sentences, tell her the website's assistant can now answer the questions clients ask most, and ask nothing more. Set pause to true." : "") + "\n\n" : "") +
      next.map(function (at, i) {
      var open = openFields(at.sid, at.item);
      var done = FIELDS.filter(function (f) { return f.sid === at.sid && f.item === at.item && answeredKey(at.sid, f.key); });
      return (i === 0 ? "Where we are: " : "Then the next card: ") + sectionTitle(at.sid) + " > " + itemTitle(at.sid, at.item) + "\n" +
        "Questions still open on this card, in order:\n" + open.map(describe).join("\n") +
        (done.length ? "\nAlready answered on this card (don't ask again): " + done.map(function (f) { return f.field.q; }).join(" | ") : "");
    }).join("\n\n");
  };
  var buildInput = function (note) {
    var turns = [{ role: "user", content: RULES + "\n\n" + context() }];
    talk.turns.slice(-14).forEach(function (t) { turns.push({ role: t.who === "claude" ? "assistant" : "user", content: t.text }); });
    if (note) turns.push({ role: "user", content: note });
    else if (turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: "(Evelyn is ready for the next question.)" });
    return turns;
  };

  /* her answer into the playbook: a text box, a numbered slot, or a tap option when it matches one */
  var applySaves = function (saves) {
    var ids = [], touched = {};
    (Array.isArray(saves) ? saves : []).forEach(function (sv) {
      var f = BY_ID[String(sv && sv.field || "")], v = String(sv && sv.value || "").trim();
      if (!f || !v) return;
      var a = state[f.sid], kind = f.field.kind;
      if (kind === "list") {
        var l = Array.isArray(a[f.key]) ? a[f.key].slice() : [], slot = -1;
        for (var i = 0; i < l.length; i++) if (!has(l[i])) { slot = i; break; }
        if (slot === -1) { if (l.length >= f.field.count) return; slot = l.length; }
        l[slot] = v; a[f.key] = l;
      } else {
        var opt = (f.field.options || []).filter(function (o) { return o.toLowerCase() === v.toLowerCase(); })[0];
        if (opt && kind === "one") a[f.key] = opt;
        else if (opt && kind === "multi") { var m = Array.isArray(a[f.key]) ? a[f.key].slice() : []; if (m.indexOf(opt) === -1) m.push(opt); a[f.key] = m; }
        else {
          var k = kind === "text" ? f.key : f.key + ".text", old = String(a[k] || "").trim();
          if (old.indexOf(v) === -1) a[k] = old ? old + "\n" + v : v;
        }
      }
      ids.push(f.sid + "/" + f.key); touched[f.sid] = true;
    });
    Object.keys(touched).forEach(function (sid) { schedule(sid, 0); });
    return ids;
  };

  /* the conversation: kept on this phone and online, one write at a time */
  var talkWriting = false, talkAgain = false;
  var saveTalk = function () {
    if (talk.turns.length > 300) talk.turns = talk.turns.slice(-300);
    try { localStorage.setItem(LOCAL + "talk", JSON.stringify(talk)); } catch (e) { /* storage off */ }
    if (!db || canSave === false) return;
    if (talkWriting) { talkAgain = true; return; }
    talkWriting = true;
    db.doc(COLL + "/interview").set(JSON.parse(JSON.stringify({ turns: talk.turns, skips: talk.skips, focus: talk.focus, updatedAt: new Date().toISOString() })))
      .catch(function () { /* the answers themselves save separately */ })
      .then(function () { talkWriting = false; if (talkAgain) { talkAgain = false; saveTalk(); } });
  };

  /* ── the tab ── */
  var CHAT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>';
  var talkTab = el("button", "tab tab-talk");
  talkTab.type = "button"; talkTab.setAttribute("role", "tab"); talkTab.dataset.sid = "talk";
  talkTab.innerHTML = CHAT;
  talkTab.appendChild(document.createTextNode("Talk it through"));
  tabsEl.insertBefore(talkTab, tabsEl.firstChild);
  var talkSec = el("section", "section talk");
  talkSec.id = "s-talk";
  talkSec.setAttribute("aria-labelledby", "h-talk");
  talkSec.innerHTML =
    '<div class="section-head"><h2 id="h-talk">Talk it through</h2>' +
    "<p>Rather talk than fill in boxes? Start with the 10-minute version: Claude asks the questions clients ask most, one after another, asks a follow-up when it needs more, and saves your answers into the other tabs as you go. To talk instead of typing, tap into the answer box, then the mic on your keyboard (no mic? Settings, General, Keyboard, Enable Dictation).</p></div>" +
    '<div class="talk-intro"><p class="talk-where"></p>' +
      '<div class="talk-progress" role="progressbar" aria-label="The 10-minute version" aria-valuemin="0" aria-valuemax="' + QUICK.length + '" aria-valuenow="0" hidden><span></span></div>' +
      '<button class="linkish talk-quick-go" type="button" hidden></button>' +
      '<button class="linkish talk-topic-toggle" type="button" aria-expanded="false" hidden>Change topic</button>' +
      '<div class="talk-topics chips" role="group" aria-label="What should we talk about?"></div></div>' +
    '<div class="talk-log" aria-live="polite"></div>' +
    '<form class="talk-form" autocomplete="off">' +
      '<p class="talk-status" role="status"></p>' +
      '<div class="talk-bar"><button class="talk-mic" type="button" aria-pressed="false" aria-label="Speak your answer" hidden>' + MIC + "</button>" +
      '<textarea class="talk-in" rows="1" placeholder="Type, or tap the keyboard\'s mic to talk" aria-label="Your answer"></textarea>' +
      '<button class="btn talk-send" type="submit">Start talking</button></div>' +
    "</form>" +
    '<div class="talk-opts"><label><input type="checkbox" class="talk-aloud"> Read Claude\'s questions aloud</label>' +
      '<button class="linkish talk-skip" type="button">Skip this card</button><button class="linkish talk-reset" type="button">Start the conversation over</button></div>';
  main.insertBefore(talkSec, main.firstChild);
  var $t = function (sel) { return talkSec.querySelector(sel); };

  /* ── Quick confirm: a common answer for each question (SPEC.drafts, from
     standard practice and her menu). Yes saves it as her answer; Fix it saves
     her version; Not this one skips it. Decisions are kept in playbook/confirm.
     A draft is never shown for a question she has already answered. ── */
  var DRAFT_SECS = 12;
  var confirm = { skips: [], accepted: [] };
  var confirmTab = el("button", "tab tab-confirm");
  confirmTab.type = "button"; confirmTab.setAttribute("role", "tab"); confirmTab.dataset.sid = "confirm";
  confirmTab.innerHTML = CHECK;
  confirmTab.appendChild(document.createTextNode("Quick confirm"));
  confirmTab.appendChild(el("span", "tab-n", ""));
  tabsEl.insertBefore(confirmTab, tabsEl.firstChild);
  var cfSec = el("section", "section confirm");
  cfSec.id = "s-confirm";
  cfSec.setAttribute("aria-labelledby", "h-confirm");
  cfSec.innerHTML =
    '<div class="section-head"><h2 id="h-confirm">Quick confirm</h2>' +
    "<p>The fastest way through. A common answer is drafted for each question, from standard esthetics practice and your own menu. Tap <strong>Yes</strong> if it's what you tell clients, fix it if it isn't, or skip it. Only what you confirm reaches the assistant, as your answer, in your words. A few at a time is fine; it saves as you go.</p></div>" +
    '<div class="cf-top"><p class="cf-where"></p><div class="cf-progress" role="progressbar" aria-label="Quick confirm" aria-valuemin="0" aria-valuenow="0"><span></span></div></div>' +
    '<div class="cf-card" hidden><p class="cf-k"></p><p class="cf-q"></p><p class="cf-pick" hidden></p><blockquote class="cf-draft"></blockquote>' +
    '<textarea class="cf-edit" rows="5" aria-label="Your version" hidden></textarea>' +
    '<p class="cf-note" hidden>The tap choice stays as shown; change it in its tab any time.</p>' +
    '<div class="cf-acts"><button class="btn cf-yes" type="button">Yes, that\'s what I say</button><button class="btn btn-ghost cf-fix" type="button">Fix it</button>' +
    '<button class="btn cf-save" type="button" hidden>Save my version</button><button class="linkish cf-skip" type="button">Not this one</button></div></div>' +
    '<p class="cf-done" hidden></p>';
  main.insertBefore(cfSec, main.firstChild);
  var $c = function (sel) { return cfSec.querySelector(sel); };
  var DRAFT_KEYS = Object.keys(SPEC.drafts || {}).filter(function (k) { return BY_ID[k]; });
  var draftText = function (k) { var d = SPEC.drafts[k]; return typeof d === "string" ? d : (d.text || ""); };
  var draftPick = function (k) { var d = SPEC.drafts[k]; return typeof d === "string" ? null : (d.pick || null); };
  var draftOpen = function (k) { var f = BY_ID[k]; return !!f && !answeredKey(f.sid, f.key) && confirm.skips.indexOf(k) === -1; };
  var openDrafts = function () { return DRAFT_KEYS.filter(draftOpen); };
  var cfWriting = false, cfAgain = false;
  var saveConfirm = function () {
    try { localStorage.setItem(LOCAL + "confirm", JSON.stringify(confirm)); } catch (e) { /* storage off */ }
    if (!db || canSave === false) return;
    if (cfWriting) { cfAgain = true; return; }
    cfWriting = true;
    db.doc(COLL + "/confirm").set(JSON.parse(JSON.stringify({ skips: confirm.skips, accepted: confirm.accepted, updatedAt: new Date().toISOString() })))
      .catch(function () { /* the answers themselves save separately */ })
      .then(function () { cfWriting = false; if (cfAgain) { cfAgain = false; saveConfirm(); } });
  };
  /* her yes (or her version) becomes the answer in the same place the tabs write */
  var acceptDraft = function (k, text) {
    var f = BY_ID[k], a = state[f.sid], kind = f.field.kind, pick = draftPick(k);
    text = String(text || "").trim();
    if (kind === "text") { if (!text) return false; a[f.key] = text; }
    else {
      if (!pick && !text) return false;
      if (pick) a[f.key] = kind === "one" ? [].concat(pick)[0] : [].concat(pick);
      if (text) a[f.key + ".text"] = text;
    }
    if (confirm.accepted.indexOf(k) === -1) confirm.accepted.push(k);
    saveConfirm();
    schedule(f.sid, 0);
    return true;
  };
  var cfKey = null;
  var paintConfirm = function () {
    var open = openDrafts(), k = open[0] || null, card = $c(".cf-card"), done = $c(".cf-done");
    var total = DRAFT_KEYS.length, left = open.length, decided = total - left;
    confirmTab.querySelector(".tab-n").textContent = left ? String(left) : "";
    var mins = Math.max(1, Math.round(left * DRAFT_SECS / 60));
    $c(".cf-where").textContent = left ? decided + " of " + total + " decided · " + left + " to go, about " + mins + (mins === 1 ? " minute" : " minutes") + " in all"
      : "All " + total + " decided.";
    var bar = $c(".cf-progress");
    bar.setAttribute("aria-valuemax", String(total)); bar.setAttribute("aria-valuenow", String(decided));
    bar.querySelector("span").style.width = (total ? Math.round(decided / total * 100) : 0) + "%";
    done.hidden = !!k;
    done.textContent = k ? "" : "That's every drafted answer. Anything still open is in the other tabs, or in Talk it through.";
    card.hidden = !k;
    if (!k) { cfKey = null; return; }
    if (k === cfKey && card.contains(document.activeElement)) return;    /* she's fixing this one */
    cfKey = k;
    var f = BY_ID[k], pick = draftPick(k);
    $c(".cf-k").textContent = sectionTitle(f.sid) + " · " + itemTitle(f.sid, f.item);
    $c(".cf-q").textContent = f.field.q.replace(/^"|"$/g, "");
    $c(".cf-pick").textContent = pick ? "Tap choice: " + [].concat(pick).join(", ") : "";
    $c(".cf-pick").hidden = !pick;
    $c(".cf-note").hidden = true;
    $c(".cf-draft").textContent = draftText(k);
    $c(".cf-draft").hidden = false;
    var ed = $c(".cf-edit"); ed.value = draftText(k); ed.hidden = true;
    $c(".cf-save").hidden = true; $c(".cf-yes").hidden = false; $c(".cf-fix").hidden = false;
  };
  cfSec.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !cfKey) return;
    var k = cfKey;
    if (b.classList.contains("cf-yes")) { cfKey = null; acceptDraft(k, draftText(k)); paintConfirm(); }
    else if (b.classList.contains("cf-fix")) {
      $c(".cf-draft").hidden = true; $c(".cf-yes").hidden = true; b.hidden = true;
      var ed = $c(".cf-edit"); ed.hidden = false; $c(".cf-save").hidden = false; $c(".cf-note").hidden = !draftPick(k);
      ed.focus();
    }
    else if (b.classList.contains("cf-save")) { var v = $c(".cf-edit").value.trim(); if (!v) return; cfKey = null; acceptDraft(k, v); paintConfirm(); }
    else if (b.classList.contains("cf-skip")) { if (confirm.skips.indexOf(k) === -1) confirm.skips.push(k); saveConfirm(); cfKey = null; paintConfirm(); }
  });
  var union = function (a, b) { return a.concat((b || []).filter(function (x) { return a.indexOf(x) === -1; })); };
  var startConfirm = function () {
    try { var local = JSON.parse(localStorage.getItem(LOCAL + "confirm")); if (local) confirm = { skips: local.skips || [], accepted: local.accepted || [] }; } catch (e) { /* storage off */ }
    paintConfirm();
  };
  var loadConfirm = function () {
    if (!db) return;
    db.doc(COLL + "/confirm").get().then(function (d) {
      var v = d && d.exists ? d.data() : null;
      if (v) { confirm = { skips: union(confirm.skips, v.skips), accepted: union(confirm.accepted, v.accepted) }; try { localStorage.setItem(LOCAL + "confirm", JSON.stringify(confirm)); } catch (e) { /* storage off */ } }
      paintConfirm();
    }, function () { /* this phone's copy stands */ });
  };
  /* ── Check spelling. Claude reads her written answers and fixes spelling, capital letters, punctuation
     and the names of her own products, never her wording; a suggestion that changes more than that is
     dropped before she sees it. She sees each fix marked in place and taps Use the fix or Keep mine;
     only a fix she takes replaces her answer, in the same place the tabs write. What's been checked,
     and what she kept, is remembered (playbook/spelling), so nothing is suggested twice. ── */
  var spell = { checked: {}, kept: {} }, spQueue = [], spBusy = false, spCur = null;
  var spellTab = el("button", "tab tab-spell");
  spellTab.type = "button"; spellTab.setAttribute("role", "tab"); spellTab.dataset.sid = "spell";
  spellTab.innerHTML = CHECK;
  spellTab.appendChild(document.createTextNode("Check spelling"));
  spellTab.appendChild(el("span", "tab-n", ""));
  tabsEl.insertBefore(spellTab, talkTab.nextSibling);
  var spSec = el("section", "section spell");
  spSec.id = "s-spell";
  spSec.setAttribute("aria-labelledby", "h-spell");
  spSec.innerHTML =
    '<div class="section-head"><h2 id="h-spell">Check spelling</h2>' +
    "<p>Before your answers go into the product guide and the course, Claude fixes spelling, capital letters, punctuation and your product names. Your words stay yours: nothing is reworded. Tap <strong>Use the fix</strong>, or <strong>Keep mine</strong>.</p></div>" +
    '<div class="cf-top"><p class="sp-status"></p><button class="btn btn-ghost small sp-run" type="button">Check my answers</button></div>' +
    '<div class="cf-card sp-card" hidden><p class="cf-k sp-k"></p><p class="cf-q sp-q"></p><p class="sp-diff"></p>' +
    '<textarea class="cf-edit sp-edit" rows="5" aria-label="Your version" hidden></textarea>' +
    '<div class="cf-acts"><button class="btn sp-use" type="button">Use the fix</button><button class="btn btn-ghost sp-mine" type="button">Keep mine</button>' +
    '<button class="btn sp-save" type="button" hidden>Save my version</button><button class="linkish sp-fixit" type="button">Fix it myself</button></div></div>' +
    '<button class="linkish sp-all" type="button" hidden></button>';
  main.insertBefore(spSec, cfSec.nextSibling);
  var $s = function (sel) { return spSec.querySelector(sel); };
  var hash = function (t) { var h = 5381; t = String(t); for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return String(h >>> 0); };
  /* every written answer: text boxes, the boxes under tap questions, each of her pasted replies */
  var spEntries = function () {
    var out = [];
    FIELDS.forEach(function (f) {
      var a = state[f.sid] || {};
      var add = function (id, key, n, v) { if (typeof v === "string" && v.trim().length >= 3) out.push({ id: id, sid: f.sid, key: key, n: n, text: v, f: f }); };
      if (f.field.kind === "text") add(f.sid + "/" + f.key, f.key, null, a[f.key]);
      else if (f.field.kind === "list") (Array.isArray(a[f.key]) ? a[f.key] : []).forEach(function (v, i) { add(f.sid + "/" + f.key + "#" + i, f.key, i, v); });
      else add(f.sid + "/" + f.key + ".text", f.key + ".text", null, a[f.key + ".text"]);
    });
    return out;
  };
  var spCurrent = function (q) { var v = (state[q.sid] || {})[q.key]; return q.n == null ? v : (Array.isArray(v) ? v[q.n] : undefined); };
  var spUnchecked = function () { return spEntries().filter(function (e) { var h = hash(e.text); return spell.checked[e.id] !== h && spell.kept[e.id] !== h; }); };
  /* a fix may only correct letters, capitals and punctuation: the words, their order and their meaning stay */
  var words = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9%\s]/g, " ").split(/\s+/).filter(Boolean); };
  var lev = function (a, b) {
    if (a === b) return 0;
    var m = a.length, n = b.length, row = [], i, j;
    for (j = 0; j <= n; j++) row[j] = j;
    for (i = 1; i <= m; i++) { var prev = row[0]; row[0] = i; for (j = 1; j <= n; j++) { var t = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
    return row[n];
  };
  var safeFix = function (from, to) {
    if (typeof to !== "string" || !to.trim() || to === from) return false;
    var a = words(from), b = words(to);
    if (Math.abs(a.length - b.length) > Math.max(2, Math.round(a.length * 0.1))) return false;
    var x = a.join(" "), y = b.join(" ");
    return 1 - lev(x, y) / Math.max(x.length, y.length, 1) >= 0.85;
  };
  /* her answer with the fix marked in place: words taken out struck through, words put in highlighted */
  var diffHtml = function (from, to) {
    var A = from.match(/\s+|[^\s]+/g) || [], B = to.match(/\s+|[^\s]+/g) || [], m = A.length, n = B.length, L = [], i, j;
    for (i = 0; i <= m; i++) { L[i] = []; for (j = 0; j <= n; j++) L[i][j] = 0; }
    for (i = m - 1; i >= 0; i--) for (j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var out = "", e = function (t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
    i = 0; j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && A[i] === B[j]) { out += e(A[i]); i++; j++; }
      else if (i < m && (j >= n || L[i + 1][j] >= L[i][j + 1])) { out += /^\s+$/.test(A[i]) ? "" : "<del>" + e(A[i]) + "</del>"; i++; }   /* what she wrote, struck, then the fix */
      else { out += /^\s+$/.test(B[j]) ? e(B[j]) : "<ins>" + e(B[j]) + "</ins>"; j++; }
    }
    return out;
  };
  var spWriting = false, spAgain = false;
  var saveSpell = function () {
    try { localStorage.setItem(LOCAL + "spelling", JSON.stringify(spell)); } catch (e) { /* storage off */ }
    if (!db || canSave === false) return;
    if (spWriting) { spAgain = true; return; }
    spWriting = true;
    db.doc(COLL + "/spelling").set(JSON.parse(JSON.stringify({ checked: spell.checked, kept: spell.kept, updatedAt: new Date().toISOString() })))
      .catch(function () { /* this phone remembers; the answers themselves save separately */ })
      .then(function () { spWriting = false; if (spAgain) { spAgain = false; saveSpell(); } });
  };
  var SHELF = [].concat.apply([], SPEC.shelf.map(function (g) { return g.items; }));
  var spPaint = function () {
    spQueue = spQueue.filter(function (q) { return spCurrent(q) === q.from; });   /* she changed it since: the fix no longer applies */
    var q = spQueue[0] || null, card = $s(".sp-card"), left = spUnchecked().length;
    spellTab.querySelector(".tab-n").textContent = spQueue.length ? String(spQueue.length) : "";
    $s(".sp-status").textContent = spBusy ? "Checking your answers…"
      : spQueue.length ? spQueue.length + (spQueue.length === 1 ? " fix to look at" : " fixes to look at")
      : left ? left + (left === 1 ? " answer" : " answers") + " not checked yet."
      : spEntries().length ? "All your answers are checked." : "Nothing written yet. Once you've answered a few questions, come back here.";
    $s(".sp-run").hidden = spBusy || !left || spQueue.length > 0;
    var all = $s(".sp-all");
    all.hidden = spQueue.length < 3; all.textContent = "Use all " + spQueue.length + " fixes";
    card.hidden = !q;
    if (!q) { spCur = null; return; }
    if (q === spCur && card.contains(document.activeElement)) return;
    spCur = q;
    $s(".sp-k").textContent = sectionTitle(q.sid) + " · " + itemTitle(q.sid, q.f.item);
    $s(".sp-q").textContent = q.f.field.q.replace(/^"|"$/g, "");
    $s(".sp-diff").innerHTML = diffHtml(q.from, q.to); $s(".sp-diff").hidden = false;
    var ed = $s(".sp-edit"); ed.value = q.to; ed.hidden = true;
    $s(".sp-save").hidden = true; $s(".sp-use").hidden = false; $s(".sp-mine").hidden = false; $s(".sp-fixit").hidden = false;
  };
  var spDrop = function (q) { spQueue = spQueue.filter(function (x) { return x !== q; }); };
  var spApply = function (q, text) {
    var a = state[q.sid];
    if (q.n == null) a[q.key] = text;
    else { var l = Array.isArray(a[q.key]) ? a[q.key].slice() : []; l[q.n] = text; a[q.key] = l; }
    spell.checked[q.id] = hash(text);
    schedule(q.sid, 0);
  };
  var spRun = function () {
    if (spBusy) return;
    var todo = spUnchecked().slice(0, 25);
    if (!todo.length) { spPaint(); return; }
    var go = function (smp) {
      if (!smp) { $s(".sp-status").textContent = "Checking spelling needs Claude, which isn't available on this link for you."; return; }
      spBusy = true; spPaint();
      var input = [
        "You are proofreading answers that Evelyn Romero, a licensed esthetician, wrote about her own spa, treatments and skincare products. They will be shown to her clients.",
        "Fix ONLY: misspelled words, obvious typos, capital letters (sentence starts, \"I\", and the names of her products and brands exactly as written in this list: " + SHELF.join("; ") + "), punctuation and spacing.",
        "Never reword, never add or remove information, never change a number, an amount or a timing, never expand her abbreviations or shorthand, never change her tone. If you aren't sure a word is a mistake, leave it.",
        "Answers (JSON): " + JSON.stringify(todo.map(function (t) { return { id: t.id, text: t.text }; })),
        'Reply with JSON only: {"fixes": [{"id": "<id>", "text": "<the whole answer, corrected>"}]}, listing only the answers that needed a fix.'
      ].join("\n\n");
      smp.json(input, { model: MODEL, effort: "low", modelTier: "quick", cache: false }).then(function (r) {
        var fixes = (r && Array.isArray(r.fixes)) ? r.fixes : [];
        var byId = {}; fixes.forEach(function (x) { if (x && x.id) byId[x.id] = x.text; });
        todo.forEach(function (t) {
          if (spCurrent(t) !== t.text) return;
          var to = byId[t.id];
          if (safeFix(t.text, to)) spQueue.push({ id: t.id, sid: t.sid, key: t.key, n: t.n, f: t.f, from: t.text, to: String(to) });
          else spell.checked[t.id] = hash(t.text);
        });
        saveSpell();
      }, function (err) {
        $s(".sp-status").textContent = err && err.code === "rate_limited" ? "Claude is busy right now. Try again in a minute." : "Couldn't check right now. Try again in a minute.";
      }).then(function () { spBusy = false; spPaint(); if (!spQueue.length && spUnchecked().length) spRun(); });
    };
    if (sample) go(sample);
    else if (window.claude && window.claude.use) window.claude.use("sample").then(go);
    else go(null);
  };
  spSec.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("sp-run")) { spRun(); return; }
    if (b.classList.contains("sp-all")) { spQueue.slice().forEach(function (q) { spApply(q, q.to); }); spQueue = []; saveSpell(); spPaint(); return; }
    var q = spCur;
    if (!q) return;
    if (b.classList.contains("sp-use")) { spApply(q, q.to); spDrop(q); saveSpell(); spPaint(); }
    else if (b.classList.contains("sp-mine")) { spell.kept[q.id] = hash(q.from); spell.checked[q.id] = hash(q.from); spDrop(q); saveSpell(); spPaint(); }
    else if (b.classList.contains("sp-fixit")) {
      $s(".sp-diff").hidden = true; $s(".sp-use").hidden = true; $s(".sp-mine").hidden = true; b.hidden = true;
      var ed = $s(".sp-edit"); ed.hidden = false; $s(".sp-save").hidden = false; ed.focus();
    }
    else if (b.classList.contains("sp-save")) { var v = $s(".sp-edit").value.trim(); if (!v) return; spApply(q, v); spDrop(q); saveSpell(); spPaint(); }
  });
  tabsEl.addEventListener("click", function (e) { var t = e.target.closest(".tab"); if (t && t.dataset.sid === "spell" && !spQueue.length) spRun(); });
  var startSpell = function () {
    try { var local = JSON.parse(localStorage.getItem(LOCAL + "spelling")); if (local) spell = { checked: local.checked || {}, kept: local.kept || {} }; } catch (e) { /* storage off */ }
    spPaint();
  };
  var loadSpell = function () {
    if (!db) return;
    db.doc(COLL + "/spelling").get().then(function (d) {
      var v = d && d.exists ? d.data() : null;
      if (v) { ["checked", "kept"].forEach(function (k) { Object.keys(v[k] || {}).forEach(function (id) { if (!spell[k][id]) spell[k][id] = v[k][id]; }); }); }
      spPaint();
    }, function () { /* this phone's copy stands */ });
  };

  var logEl = $t(".talk-log"), inEl = $t(".talk-in"), sendEl = $t(".talk-send"), statusEl = $t(".talk-status"), micEl = $t(".talk-mic"), aloudEl = $t(".talk-aloud");
  var setTalkStatus = function (t, bad) { statusEl.textContent = t || ""; statusEl.className = "talk-status" + (bad ? " is-bad" : ""); };

  /* every section points here too */
  main.querySelectorAll(".section-head .hint").forEach(function (h) {
    var b = el("button", "linkish", "Or talk it through with Claude");
    b.type = "button";
    b.style.marginLeft = "0.25rem";
    b.addEventListener("click", function () { var sid = h.closest(".section").id.slice(2); if (TALK_ORDER.indexOf(sid) !== -1 || sid === "products" || sid === "school") talk.focus = sid; show("talk"); paintTalk(); });
    h.appendChild(b);
  });

  var topics = $t(".talk-topics");
  [["quick", "10-minute version"], ["auto", "Claude picks"]].concat(SPEC.sections.filter(function (s) { return s.id !== "materials"; }).map(function (s) { return [s.id, s.title]; })).forEach(function (t) {
    var b = el("button", "chip", t[1]);
    b.type = "button"; b.dataset.focus = t[0];
    topics.appendChild(b);
  });
  $t(".talk-quick-go").addEventListener("click", function () {
    if (talking) return;
    talk.focus = "quick";
    saveTalk();
    paintTalk();
    if (sample) ask("(Evelyn switched to the 10-minute version. Ask its first open question.)");
  });
  $t(".talk-topic-toggle").addEventListener("click", function () {
    var tg = $t(".talk-topic-toggle"), open = tg.getAttribute("aria-expanded") !== "true";
    tg.setAttribute("aria-expanded", String(open));
    paintTalk();
  });
  topics.addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b || talking) return;
    $t(".talk-topic-toggle").setAttribute("aria-expanded", "false");
    talk.focus = b.dataset.focus;
    saveTalk();
    paintTalk();
    if (talk.turns.length && sample) ask("(Evelyn chose a topic: " + (talk.focus === "auto" ? "whatever's next" : sectionTitle(talk.focus)) + ". Ask the first open question there.)");
  });

  var shortQ = function (id) { var f = BY_ID[id]; if (!f) return id; var q = f.field.q.replace(/^"|"$/g, ""); return (q.length > 46 ? q.slice(0, 44) + "…" : q); };
  var paintTalk = function () {
    topics.querySelectorAll(".chip").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.focus === talk.focus)); });
    var next = upcoming(1)[0], started = talk.turns.length > 0, quick = talk.focus === "quick";
    var qd = quickDone(), left = QUICK.length - qd, mins = Math.max(1, Math.round(left * SECS_PER_Q / 60));
    $t(".talk-where").textContent = !started
      ? (quick ? "The 10-minute version: the " + QUICK.length + " questions clients ask most, one after another" + (qd ? " (" + qd + " already done)" : "") + ". Or pick a topic below."
        : "What should we talk about? Claude can pick, starting where it helps most.")
      : next ? "Now: " + (quick ? itemTitle(next.sid, next.item) + " · " + qd + " of " + QUICK.length + " · about " + mins + (mins === 1 ? " minute" : " minutes") + " left"
        : sectionTitle(next.sid) + " · " + itemTitle(next.sid, next.item))
      : quick ? "The 10 minutes are done: the questions clients ask most are answered. Pick a topic to keep going another time." : "Everything here is answered or skipped. Change topic, or check your answers in the tabs.";
    var bar = $t(".talk-progress");
    bar.hidden = !quick;
    bar.querySelector("span").style.width = Math.round(qd / QUICK.length * 100) + "%";
    bar.setAttribute("aria-valuenow", String(qd));
    var tog = $t(".talk-topic-toggle");
    tog.hidden = !started;
    /* a conversation already going: the 10-minute version is one tap away */
    var qg = $t(".talk-quick-go");
    qg.hidden = !started || quick || !left;
    qg.textContent = "Switch to the 10-minute version (" + left + " to go)";
    topics.hidden = started && tog.getAttribute("aria-expanded") !== "true";
    logEl.textContent = "";
    talk.turns.forEach(function (t) {
      logEl.appendChild(el("div", "msg " + (t.who === "claude" ? "claude" : "evelyn"), t.text));
      if (t.saved && t.saved.length) {
        var row = el("div", "saved");
        row.appendChild(el("span", "saved-k", "Saved:"));
        t.saved.forEach(function (id) {
          var b = el("button", null, shortQ(id));
          b.type = "button"; b.dataset.goto = id;
          b.setAttribute("aria-label", "Open the saved answer: " + shortQ(id));
          row.appendChild(b);
        });
        logEl.appendChild(row);
      }
    });
    if (talking) { var w = el("div", "msg claude wait"); w.innerHTML = "<span>•</span><span>•</span><span>•</span>"; w.setAttribute("aria-label", "Claude is writing"); logEl.appendChild(w); }
    sendEl.textContent = talk.turns.length ? "Send" : quick ? "Start the 10 minutes" : "Start talking";
    sendEl.disabled = talking || !sample;
    inEl.hidden = !talk.turns.length;
    micEl.hidden = !talk.turns.length || !Rec || micOff;
    $t(".talk-skip").hidden = !talk.turns.length || !next;
    $t(".talk-reset").hidden = !talk.turns.length;
  };
  logEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-goto]");
    if (!b) return;
    var f = BY_ID[b.dataset.goto];
    if (!f) return;
    show(f.sid);
    var d = itemEl(f.sid, f.item);
    if (!d) return;
    var box = d.closest(".done-items");
    if (box) box.open = true;
    d.open = true;
    var q = d.querySelector('.q[data-key="' + f.key + '"]'), fold = q && q.closest(".done-qs");
    if (fold) fold.open = true;
    (q || d).scrollIntoView({ block: "start" });
  });

  var speak = function (text) {
    if (!aloudEl.checked || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch (e) { /* no voice here */ }
  };
  try { aloudEl.checked = localStorage.getItem(LOCAL + "aloud") === "1"; } catch (e) { /* storage off */ }
  aloudEl.addEventListener("change", function () {
    try { localStorage.setItem(LOCAL + "aloud", aloudEl.checked ? "1" : "0"); } catch (e) { /* storage off */ }
    if (!aloudEl.checked && window.speechSynthesis) speechSynthesis.cancel();
  });

  var FAIL = {
    rate_limited: "Claude needs a moment (too many messages, or your usage limit). Try again in a minute; nothing you said is lost.",
    session_expired: "Your Claude sign-in expired. Sign in again, then come back.",
    refused: "Claude couldn't continue with that one. Try saying it another way, or skip this card.",
    invalid_json: "That reply came back garbled. Tap Send to try again.",
    empty_completion: "No reply came back. Tap Send to try again.",
    upstream_error: "The connection dropped. Tap Send to try again; nothing you said is lost."
  };
  var OFF = { not_granted: 1, sampling_disabled: 1, not_declared: 1, capability_disabled: 1, capability_removed: 1 };
  var ask = function (note) {
    if (!sample || talking) return;
    talking = true;
    ctl = new AbortController();
    setTalkStatus("");
    paintTalk();
    logEl.lastChild.scrollIntoView({ block: "nearest" });
    sample.json(buildInput(note), { model: MODEL, effort: "low", modelTier: "quick", cache: false, signal: ctl.signal }).then(function (r) {
      var say = String(r && r.say || "").trim() || "Got it. Shall we keep going?";
      var saved = applySaves(r && r.save);
      (Array.isArray(r && r.skip) ? r.skip : []).forEach(function (id) { if (BY_ID[id] && talk.skips.indexOf(id) === -1) talk.skips.push(id); });
      talk.turns.push({ who: "claude", text: say, at: new Date().toISOString(), saved: saved });
      talking = false;
      saveTalk();
      paintTalk();
      speak(say);
      logEl.lastChild.scrollIntoView({ block: "nearest" });
      /* nonstop: the answer box is ready for the next one (unless Claude is wrapping up) */
      if (!(r && r.pause) && document.activeElement && talkSec.contains(document.activeElement)) inEl.focus();
    }, function (err) {
      talking = false;
      var code = err && err.code;
      if (OFF[code]) { sample = null; setTalkStatus("Claude isn't available on this link for you, so the typed questions in the other tabs are the way to go. Everything you said so far is saved.", true); }
      else if (code !== "cancelled") setTalkStatus(FAIL[code] || FAIL.upstream_error, true);
      paintTalk();
    });
  };
  $t(".talk-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (talking || !sample) return;
    var text = inEl.value.trim();
    if (!talk.turns.length) { ask("(Evelyn just opened Talk it through. Greet her in a few words and ask the first question.)"); return; }
    var last = talk.turns[talk.turns.length - 1];
    if (!text) { if (last && last.who === "evelyn") ask(); return; }    /* a reply that failed: ask again */
    talk.turns.push({ who: "evelyn", text: text, at: new Date().toISOString() });
    inEl.value = "";
    saveTalk();
    ask();
  });
  inEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); $t(".talk-form").requestSubmit(); }
  });
  $t(".talk-skip").addEventListener("click", function () {
    var at = upcoming(1)[0];
    if (!at || talking) return;
    openFields(at.sid, at.item).forEach(function (f) { talk.skips.push(f.sid + "/" + f.key); });
    saveTalk();
    paintTalk();
    ask("(Evelyn skipped the card \"" + itemTitle(at.sid, at.item) + "\". Move on to the next one.)");
  });
  var resetArmed = null;
  $t(".talk-reset").addEventListener("click", function () {
    var b = $t(".talk-reset");
    if (!resetArmed) { b.textContent = "Tap again to start over (your answers stay)"; resetArmed = setTimeout(function () { resetArmed = null; b.textContent = "Start the conversation over"; }, 4000); return; }
    clearTimeout(resetArmed); resetArmed = null; b.textContent = "Start the conversation over";
    if (ctl) ctl.abort();
    talking = false;
    talk = { turns: [], skips: [], focus: talk.focus };
    saveTalk();
    paintTalk();
  });

  /* speaking: the browser's own speech recognition, where this viewer allows the microphone */
  if (Rec) {
    micEl.addEventListener("click", function () {
      if (rec) { rec.stop(); return; }
      try { rec = new Rec(); } catch (e) { micOff = true; paintTalk(); return; }
      var before = inEl.value ? inEl.value.replace(/\s*$/, " ") : "";
      rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
      rec.onresult = function (ev) {
        var t = "";
        for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        inEl.value = before + t;
      };
      rec.onerror = function (ev) {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") {
          micOff = true; micEl.hidden = true;
          setTalkStatus("The microphone isn't available here. Tap the mic key on your keyboard to speak instead.");
        }
      };
      rec.onend = function () {
        rec = null;
        micEl.setAttribute("aria-pressed", "false"); micEl.setAttribute("aria-label", "Speak your answer");
        if (inEl.value.trim() && inEl.value.trim() !== before.trim()) $t(".talk-form").requestSubmit();
      };
      if (window.speechSynthesis) speechSynthesis.cancel();
      micEl.setAttribute("aria-pressed", "true"); micEl.setAttribute("aria-label", "Listening; tap to stop");
      setTalkStatus("Listening… tap the mic again when you're done.");
      try { rec.start(); } catch (e) { rec = null; micOff = true; paintTalk(); }
    });
  }

  var startTalk = function () {
    try { var local = JSON.parse(localStorage.getItem(LOCAL + "talk")); if (local && Array.isArray(local.turns)) talk = { turns: local.turns, skips: local.skips || [], focus: local.focus || (local.turns.length ? "auto" : "quick") }; } catch (e) { /* storage off */ }
    paintTalk();
    if (!window.claude || !window.claude.use) { setTalkStatus("Talking it through works inside the Claude app or claude.ai. The typed questions work everywhere."); return; }
    window.claude.use("sample").then(function (s) {
      sample = s;
      if (!s) setTalkStatus("Claude isn't available on this link for you, so the typed questions in the other tabs are the way to go.");
      paintTalk();
    });
  };
  var loadTalk = function () {
    if (!db) return;
    db.doc(COLL + "/interview").get().then(function (d) {
      var v = d && d.exists ? d.data() : null;
      if (v && Array.isArray(v.turns) && v.turns.length > talk.turns.length && !talking) {
        talk = { turns: v.turns, skips: Array.isArray(v.skips) ? v.skips : [], focus: v.focus || "auto" };
        try { localStorage.setItem(LOCAL + "talk", JSON.stringify(talk)); } catch (e) { /* storage off */ }
      }
      paintTalk();
    }, function () { /* this phone's copy stands */ });
  };

  /* treatments renamed since she answered: her saved picks follow the new name */
  var RENAMED = { "Acne Program (New Client Consultation + Treatment)": "Acne Bootcamp (New Client Consultation + Treatment)" };
  var migrate = function (sid) {
    var a = state[sid], changed = false;
    Object.keys(a).forEach(function (k) {
      if (!Array.isArray(a[k])) return;
      a[k] = a[k].map(function (v) { if (RENAMED[v]) { changed = true; return RENAMED[v]; } return v; });
    });
    return changed;
  };

  /* ── start: this phone's draft first, then what's saved online ── */
  var boot = function (data) {
    SPEC.sections.forEach(function (s) { state[s.id] = (data && data[s.id]) || readLocal(s.id); });
    var tab = null; try { tab = localStorage.getItem(LOCAL + "tab"); } catch (e) { /* storage off */ }
    paint();
    show(tab === "talk" || tab === "confirm" || tab === "spell" || SPEC.sections.some(function (s) { return s.id === tab; }) ? tab : "confirm");
    tidy();
    startConfirm();
    startSpell();
    startTalk();
    if (!window.claude || !window.claude.use) { setSave("Saved on this phone"); return; }
    Promise.all([window.claude.use("db"), window.claude.use("user"), window.claude.use("assets")]).then(function (r) {
      db = r[0];
      var user = r[1];
      assets = r[2];
      if (!db) { setSave("Saved on this phone"); document.getElementById("copy-note").textContent = "This link can't save online. Use Copy all my answers and send them to Ruben."; return; }
      if (user && user.can) Promise.resolve(user.can("data.write")).then(function (ok) { if (ok === false) { canSave = false; setSave("Can't save here", "is-bad"); } });
      db.collection(COLL).get().then(function (snap) {
        var saved = {};
        snap.docs.forEach(function (d) { if (d.exists) saved[d.id] = (d.data() || {}).answers || {}; });
        SPEC.sections.forEach(function (s) {
          var online = saved[s.id], local = state[s.id], merged = online ? JSON.parse(JSON.stringify(online)) : {};
          var last = readSynced(s.id);
          onlineHas[s.id] = !!online;
          synced[s.id] = online ? JSON.parse(JSON.stringify(online)) : {};
          if (last) {
            /* what she typed here that never reached the database wins; everything else comes from the database,
               so an answer she changed on another phone shows here too */
            Object.keys(local).concat(Object.keys(last)).forEach(function (k) { if (!same(local[k], last[k])) merged[k] = local[k] == null ? "" : local[k]; });
          } else {
            /* (a phone from before this was kept) an answer only this phone has comes back, unless the same words are saved under another question (it was moved there) */
            var saved2 = online ? Object.keys(online).map(function (k) { return JSON.stringify(online[k]); }) : [];
            Object.keys(local).forEach(function (k) {
              if (!has(merged[k]) && has(local[k]) && saved2.indexOf(JSON.stringify(local[k])) === -1) merged[k] = local[k];
            });
          }
          state[s.id] = merged;
          migrate(s.id);
          writeLocal(s.id); writeSynced(s.id);
          if (Object.keys(changedKeys(s.id)).length && (online || Object.keys(merged).some(function (k) { return has(merged[k]); }))) schedule(s.id, 0);
        });
        paint();
        tidy();
        loadConfirm();
        loadSpell();
        loadTalk();
        if (canSave !== false && !pending()) setSave("Saved", "is-ok");
      }, function () { setSave("Saved on this phone"); });
    });
  };
  var hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(function () { return state; });
  if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data);
})();
</script>
`;

fs.mkdirSync(path.join(root, "knowledge/playbook"), { recursive: true });
fs.writeFileSync(path.join(root, "knowledge/playbook/evelyn-playbook.html"), html);

// ── the questions as a document ──
const md = [];
md.push("# Evelyn's Skin Playbook: the questions", "",
  "The questionnaire Evelyn fills in over several sittings. Her answers become the knowledge the website's assistant answers from (see knowledge/README.md). Generated from knowledge/scripts/playbook-spec.mjs; edit that file, not this one.", "",
  "Nothing is pre-filled. Every tap option is one of her own product or treatment names, never a claim.", "",
  "**Talk it through** (the first tab): Claude asks these same questions one at a time, follows up when an answer is vague, and saves her words into the matching answers below. It runs on her own Claude account; the conversation is kept in `playbook/interview`.", "",
  "Every card also has **Add screenshots** (old texts, aftercare cards, product guides, Instagram posts; images or PDFs) and **Add a recording** (voice memos). `read-screenshots.mjs` transcribes the screenshots so the assistant can learn from them.", "");
const fieldLine = (f) => {
  let s = `- **${f.q}**`;
  if (f.hint) s += ` ${f.hint}`;
  if (f.kind === "one") s += ` Pick one: ${f.options.join(" · ")}.`;
  if (f.kind === "multi") s += ` Tap all that apply: ${f.options.join(" · ")}.`;
  if (f.kind === "products") s += " Tap products from her shelf (every live product in js/catalog.js, grouped by type), then how to use them.";
  if (f.kind === "treatments") s += ` Tap from her menu: ${S.TREATMENTS.join(" · ")}.`;
  if (f.kind === "list") s += ` ${f.count} boxes.`;
  if (f.text) s += ` Plus a box: "${f.text}".`;
  else if (f.kind !== "text" && f.kind !== "list") s += ' Plus a box: "In your words".';
  return s;
};
for (const s of S.SECTIONS) {
  md.push(`## ${s.title}`, "", s.intro, "");
  if (s.id === "client-questions") S.CLIENT_QUESTION_GROUPS.forEach((g) => {
    md.push(`### ${g.title}`, "");
    g.questions.forEach((x) => md.push(`- ${x.q}`));
    md.push("");
  });
  if (s.id === "concerns") {
    md.push("For each of: " + S.CONCERNS.map((c) => c.title).join("; ") + ".", "");
    S.CONCERN_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "treatments") {
    md.push("For each of: " + S.TREATMENT_DETAILS.map((t) => t.title).join("; ") + ".", "");
    S.TREATMENT_DETAIL_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "visits") S.VISIT_FIELDS.forEach((f) => md.push(fieldLine(f)));
  if (s.id === "materials") {
    md.push("Screenshots first, as many as she likes. Then:", "");
    S.MATERIALS_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "aftercare") {
    md.push("For each of: " + S.TREATMENT_AFTERCARE.map((t) => t.title).join("; ") + ".", "");
    S.AFTERCARE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "routine") S.ROUTINE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  if (s.id === "products") {
    md.push(`For each of the ${live.length} live products on her shelf (these make her take-home product guide, \`build-product-guide.mjs\`):`, "");
    S.PRODUCT_FIELDS.forEach((f) => md.push(fieldLine(f.key === "like" ? { ...f, kind: "one", options: ["the other products of the same type"] } : f)));
  }
  if (s.id === "school") {
    md.push(`One card per module (${modules.length}), and for each of its lessons (${modules.reduce((n, m) => n + m.fields.length / 2, 0)} in all), showing the lesson as it reads now:`, "");
    S.SCHOOL_FIELDS({ id: "<id>", t: "<title>", sum: "", learn: [], try: "" }).forEach((f) => md.push(fieldLine({ ...f, hint: f.key.endsWith("_ok") ? "Shows the lesson's summary, three key points and its try-this." : f.hint })));
  }
  if (s.id === "hard-lines") S.HARD_LINE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  if (s.id === "voice") S.VOICE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  md.push("");
}
md.push("## Where the answers go", "",
  "Each section saves to its own document (`playbook/<section>`) in the questionnaire's database as she types; screenshots and voice memos are stored with the questionnaire and listed in those documents. `knowledge/scripts/read-screenshots.mjs` downloads and transcribes the screenshots, `knowledge/scripts/import-playbook.mjs` turns an export of the documents into the knowledge files, one per concern, treatment and product, with the date and what her screenshots say. `build-bundle.mjs` then packs them, with the FAQ, policies and catalog, into what the server's assistant reads.", "");
fs.writeFileSync(path.join(root, "knowledge/PLAYBOOK-QUESTIONS.md"), md.join("\n"));
const clientQs = S.CLIENT_QUESTION_GROUPS.reduce((n, g) => n + g.questions.length, 0);
console.log("wrote knowledge/playbook/evelyn-playbook.html (" + Math.round(html.length / 1024) + " KB) and knowledge/PLAYBOOK-QUESTIONS.md; questions:",
  clientQs + S.CONCERNS.length * S.CONCERN_FIELDS.length + S.TREATMENT_DETAILS.length * S.TREATMENT_DETAIL_FIELDS.length
  + S.TREATMENT_AFTERCARE.length * S.AFTERCARE_FIELDS.length + S.VISIT_FIELDS.length + S.MATERIALS_FIELDS.length
  + S.ROUTINE_FIELDS.length + S.HARD_LINE_FIELDS.length + S.VOICE_FIELDS.length,
  "(" + clientQs + " client texts) +", spec.products.reduce((n, g) => n + g.items.reduce((m, p) => m + p.fields.length, 0), 0), "for the product guide +",
  modules.reduce((n, m) => n + m.fields.length, 0), "for Skin School");
