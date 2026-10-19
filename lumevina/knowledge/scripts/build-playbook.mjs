// Builds Evelyn's Skin Playbook from playbook-spec.mjs:
//   knowledge/playbook/evelyn-playbook.html   the page she fills in (published as an artifact)
//   knowledge/PLAYBOOK-QUESTIONS.md            the same questions, readable
//
//   node knowledge/scripts/build-playbook.mjs      (from lumevina/)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

// her shelf, grouped by type, from the site's own catalog
globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const live = CAT.products.filter((p) => !p.draft);
const byType = CAT.categories.map((c) => ({ cat: c, items: live.filter((p) => p.cat === c) })).filter((g) => g.items.length);
const label = (p) => p.name + (p.brand !== "Face Reality" ? " (" + p.brand + ")" : "");

// ── the question list, as data the page renders ──
const spec = {
  sections: S.SECTIONS,
  concerns: S.CONCERNS, concernFields: S.CONCERN_FIELDS,
  aftercare: S.TREATMENT_AFTERCARE, aftercareFields: S.AFTERCARE_FIELDS,
  routineFields: S.ROUTINE_FIELDS,
  products: byType.map((g) => ({ cat: g.cat, items: g.items.map((p) => ({ id: p.id, name: label(p), size: p.size || "" })) })),
  productFields: S.PRODUCT_FIELDS,
  hardLineFields: S.HARD_LINE_FIELDS,
  voiceFields: S.VOICE_FIELDS,
  treatments: S.TREATMENTS,
  shelf: byType.map((g) => ({ cat: g.cat, items: g.items.map(label) }))
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
  details.item > summary .pill { flex: none; font-size: 0.72rem; font-weight: 500; color: var(--ink-soft); padding: 0.2rem 0.55rem; border-radius: 999px; background: var(--wash); font-variant-numeric: tabular-nums; }
  details.item > summary .pill.is-done { background: rgba(78, 106, 69, 0.14); color: var(--sage); }
  details.item > summary .sub { display: block; font-size: 0.78rem; font-weight: 400; color: var(--ink-soft); }
  details.item[open] > summary { border-bottom: 1px solid var(--edge); }
  .body { padding: 0.9rem 1.05rem 1.1rem; display: grid; gap: 1.1rem; }
  .q { display: grid; gap: 0.5rem; }
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

  .finish { margin-top: 2rem; padding-top: 1.2rem; border-top: 1px solid var(--edge); display: grid; gap: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .btn { font: 500 0.95rem/1 var(--font); padding: 0.85rem 1.3rem; min-height: 46px; border-radius: 999px; border: 1px solid var(--accent); cursor: pointer; background: var(--accent); color: var(--on-accent); }
  .btn-ghost { background: transparent; color: var(--ink); border-color: var(--edge); }
  .note { margin: 0; font-size: 0.86rem; color: var(--ink-soft); }
  .copybox { width: 100%; min-height: 12rem; font-size: 0.85rem; }
  @media (prefers-reduced-motion: reduce) { .meter span { transition: none; } }
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Lumevina · the assistant learns from you</p>
    <h1>Evelyn's <em>Skin Playbook</em></h1>
    <p class="lede">Everything you'd tell a client, in your own words. The website's assistant answers only from
    what you write here, and hands you anything it can't find. Fill it in over a few sittings; it saves as you go,
    and nothing is pre-filled.</p>
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
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /* ── state: one document per section; keys are "item.field" ── */
  var state = {}; SPEC.sections.forEach(function (s) { state[s.id] = {}; });
  var readLocal = function (sid) { try { return JSON.parse(localStorage.getItem(LOCAL + sid)) || {}; } catch (e) { return {}; } };
  var writeLocal = function (sid) { try { localStorage.setItem(LOCAL + sid, JSON.stringify(state[sid])); } catch (e) { /* storage off */ } };
  var has = function (v) { return Array.isArray(v) ? v.some(function (x) { return x && String(x).trim(); }) : !!(v && String(v).trim()); };

  /* ── every field, flattened: { sid, key, item, field } ── */
  var FIELDS = [];
  var addFields = function (sid, itemId, fields) {
    fields.forEach(function (f) {
      FIELDS.push({ sid: sid, key: itemId + "." + f.key, item: itemId, field: f, text: itemId + "." + f.key + ".text" });
    });
  };
  SPEC.concerns.forEach(function (c) { addFields("concerns", c.id, SPEC.concernFields); });
  SPEC.aftercare.forEach(function (t) { addFields("aftercare", t.id, SPEC.aftercareFields); });
  addFields("routine", "routine", SPEC.routineFields);
  SPEC.products.forEach(function (g) { g.items.forEach(function (p) { addFields("products", p.id, SPEC.productFields); }); });
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
  var question = function (sid, itemId, f) {
    var q = el("div", "q");
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
    if (f.kind === "text") q.appendChild(box(sid, key, "", f.q, 3));
    else if (f.kind !== "list") q.appendChild(box(sid, key + ".text", f.text || "In your words", (f.text || "More") + ": " + f.q, 2));
    return q;
  };
  var item = function (sid, it, fields, sub) {
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
    fields.forEach(function (f) { b.appendChild(question(sid, it.id, f)); });
    d.appendChild(b);
    return d;
  };

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
    sec.appendChild(head);

    if (s.id === "concerns") SPEC.concerns.forEach(function (c) { sec.appendChild(item("concerns", c, SPEC.concernFields)); });
    if (s.id === "aftercare") SPEC.aftercare.forEach(function (t) { sec.appendChild(item("aftercare", t, SPEC.aftercareFields)); });
    if (s.id === "routine") { var r = item("routine", { id: "routine", title: "Routine and starting actives" }, SPEC.routineFields); r.open = true; sec.appendChild(r); }
    if (s.id === "products") SPEC.products.forEach(function (g) {
      sec.appendChild(el("p", "group-k", g.cat));
      g.items.forEach(function (p) { sec.appendChild(item("products", { id: p.id, title: p.name }, SPEC.productFields, p.size)); });
    });
    if (s.id === "hard-lines") { var hl = item("hard-lines", { id: "hard-lines", title: "Always to Evelyn" }, SPEC.hardLineFields); hl.open = true; sec.appendChild(hl); }
    if (s.id === "voice") { var v = item("voice", { id: "voice", title: "How you talk to clients" }, SPEC.voiceFields); v.open = true; sec.appendChild(v); }
    main.appendChild(sec);
  });

  /* ── showing answers ── */
  var paint = function () {
    main.querySelectorAll(".chip").forEach(function (b) {
      var v = state[b.dataset.sid][b.dataset.key];
      var on = b.dataset.single ? v === b.dataset.v : Array.isArray(v) && v.indexOf(b.dataset.v) !== -1;
      b.setAttribute(b.dataset.single ? "aria-checked" : "aria-pressed", String(!!on));
    });
    main.querySelectorAll("textarea").forEach(function (t) {
      if (t === document.activeElement) return;
      var v = state[t.dataset.sid][t.dataset.key];
      t.value = (t.dataset.n != null ? (Array.isArray(v) ? v[+t.dataset.n] : "") : v) || "";
    });
    main.querySelectorAll("details.item").forEach(function (d) {
      var c = itemDone(d.dataset.sid, d.dataset.item), pill = d.querySelector(".pill");
      pill.textContent = c.done ? c.done + " of " + c.total : "";
      pill.classList.toggle("is-done", c.done === c.total && c.total > 0);
    });
    var all = 0;
    tabsEl.querySelectorAll(".tab").forEach(function (t) {
      var c = sectionDone(t.dataset.sid);
      all += c.done;
      t.querySelector(".tab-n").textContent = t.dataset.sid === "products" ? (c.done ? String(c.done) : "") : c.done + "/" + c.total;
    });
    var required = FIELDS.filter(function (f) { return f.sid !== "products"; }).length;
    var reqDone = FIELDS.filter(function (f) { return f.sid !== "products" && answeredKey(f.sid, f.key); }).length;
    document.getElementById("meter").style.width = (reqDone / required * 100) + "%";
    document.getElementById("count").textContent = all + " answered";
  };

  var current = null;
  var show = function (sid) {
    current = sid;
    main.querySelectorAll(".section").forEach(function (s) { s.classList.toggle("is-on", s.id === "s-" + sid); });
    tabsEl.querySelectorAll(".tab").forEach(function (t) { t.setAttribute("aria-current", String(t.dataset.sid === sid)); });
    try { localStorage.setItem(LOCAL + "tab", sid); } catch (e) { /* storage off */ }
    window.scrollTo({ top: 0 });
  };
  tabsEl.addEventListener("click", function (e) { var t = e.target.closest(".tab"); if (t) show(t.dataset.sid); });

  /* ── saving: one write at a time per section, after she pauses ── */
  var saveEl = document.getElementById("save");
  var setSave = function (text, cls) { saveEl.textContent = text; saveEl.className = "save" + (cls ? " " + cls : ""); };
  var db = null, canSave = null, timers = {}, writing = {}, again = {};
  var flush = function (sid) {
    timers[sid] = null;
    if (!db || canSave === false) return;
    if (writing[sid]) { again[sid] = true; return; }
    writing[sid] = true;
    setSave("Saving…");
    var body = JSON.parse(JSON.stringify({ answers: state[sid], updatedAt: new Date().toISOString() }));
    db.doc(COLL + "/" + sid).set(body).then(function () {
      setSave("Saved", "is-ok");
    }, function (err) {
      if (err && err.code === "invalid_argument") {
        canSave = false;
        setSave("Can't save here", "is-bad");
        document.getElementById("copy-note").textContent = "This link can't save online. Your answers stay on this phone: use Copy all my answers and send them to Ruben.";
      } else { setSave("Not saved yet · trying again", "is-bad"); again[sid] = true; }
    }).then(function () {
      writing[sid] = false;
      if (again[sid]) { again[sid] = false; schedule(sid, 1500); }
    });
  };
  var schedule = function (sid, ms) {
    writeLocal(sid);
    paint();
    if (!db) return;
    if (canSave !== false) setSave("Saving…");
    clearTimeout(timers[sid]);
    timers[sid] = setTimeout(function () { flush(sid); }, ms == null ? 900 : ms);
  };

  main.addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
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

  /* ── start: this phone's draft first, then what's saved online ── */
  var boot = function (data) {
    SPEC.sections.forEach(function (s) { state[s.id] = (data && data[s.id]) || readLocal(s.id); });
    var tab = null; try { tab = localStorage.getItem(LOCAL + "tab"); } catch (e) { /* storage off */ }
    show(SPEC.sections.some(function (s) { return s.id === tab; }) ? tab : SPEC.sections[0].id);
    paint();
    if (!window.claude || !window.claude.use) { setSave("Saved on this phone"); return; }
    Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function (r) {
      db = r[0];
      var user = r[1];
      if (!db) { setSave("Saved on this phone"); document.getElementById("copy-note").textContent = "This link can't save online. Use Copy all my answers and send them to Ruben."; return; }
      if (user && user.can) Promise.resolve(user.can("data.write")).then(function (ok) { if (ok === false) { canSave = false; setSave("Can't save here", "is-bad"); } });
      db.collection(COLL).get().then(function (snap) {
        var saved = {};
        snap.docs.forEach(function (d) { if (d.exists) saved[d.id] = (d.data() || {}).answers || {}; });
        SPEC.sections.forEach(function (s) {
          var online = saved[s.id], local = state[s.id], merged = online ? JSON.parse(JSON.stringify(online)) : {};
          var extra = false;
          Object.keys(local).forEach(function (k) { if (!has(merged[k]) && has(local[k])) { merged[k] = local[k]; extra = true; } });
          state[s.id] = merged;
          writeLocal(s.id);
          if (extra && online) schedule(s.id, 0);
          else if (!online && Object.keys(local).some(function (k) { return has(local[k]); })) schedule(s.id, 0);
        });
        paint();
        if (canSave !== false && !Object.keys(timers).some(function (k) { return timers[k]; })) setSave("Saved", "is-ok");
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
  "Nothing is pre-filled. Every tap option is one of her own product or treatment names, never a claim.", "");
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
  if (s.id === "concerns") {
    md.push("For each of: " + S.CONCERNS.map((c) => c.title).join("; ") + ".", "");
    S.CONCERN_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "aftercare") {
    md.push("For each of: " + S.TREATMENT_AFTERCARE.map((t) => t.title).join("; ") + ".", "");
    S.AFTERCARE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "routine") S.ROUTINE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  if (s.id === "products") {
    md.push(`For each of the ${live.length} live products on her shelf, optional:`, "");
    S.PRODUCT_FIELDS.forEach((f) => md.push(fieldLine(f)));
  }
  if (s.id === "hard-lines") S.HARD_LINE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  if (s.id === "voice") S.VOICE_FIELDS.forEach((f) => md.push(fieldLine(f)));
  md.push("");
}
md.push("## Where the answers go", "",
  "Each section saves to its own document (`playbook/<section>`) in the questionnaire's database as she types. `knowledge/scripts/import-playbook.mjs` turns an export of those documents into the knowledge files, one per concern, treatment and product, with the date. `build-bundle.mjs` then packs them, with the FAQ, policies and catalog, into what the server's assistant reads.", "");
fs.writeFileSync(path.join(root, "knowledge/PLAYBOOK-QUESTIONS.md"), md.join("\n"));
console.log("wrote knowledge/playbook/evelyn-playbook.html (" + Math.round(html.length / 1024) + " KB) and knowledge/PLAYBOOK-QUESTIONS.md; fields:",
  S.CONCERNS.length * S.CONCERN_FIELDS.length + S.TREATMENT_AFTERCARE.length * S.AFTERCARE_FIELDS.length + S.ROUTINE_FIELDS.length + S.HARD_LINE_FIELDS.length + S.VOICE_FIELDS.length, "required +", live.length * S.PRODUCT_FIELDS.length, "optional product notes");
