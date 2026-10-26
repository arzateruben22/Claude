// The chat's eval, offline: 60 client messages (knowledge/eval/questions.json). Each one either goes to
// Evelyn (the hand-off rules in js/ask-rules.js, which run before any AI, on the website and the server
// alike), is waved off as not the chat's lane (flirting, abuse, "ignore your instructions", homework:
// one light line, no AI, no Evelyn), or is answered from her words, so what it "must" say has to be in
// what the assistant is given (knowledge/eval/bundle.json). Writes knowledge/eval/results.md.
//
//   node knowledge/eval/run-eval.mjs     (from lumevina/, after build-bundle.mjs)
//
// It checks routing and coverage, not wording: how Claude phrases an answer is for the preview chat.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
globalThis.window = {};
await import(path.join(root, "js/ask-rules.js"));
const R = globalThis.window.LumevinaAskRules;
const B = JSON.parse(fs.readFileSync(path.join(here, "bundle.json"), "utf8"));
const Q = JSON.parse(fs.readFileSync(path.join(here, "questions.json"), "utf8"));
const flat = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");
const given = flat([B.prompt, B.facts, B.knowledge, B.general, B.hardLines].join("\n"));

const rows = Q.map(({ q, handoff = null, offtopic = null, must = [] }) => {
  const low = q.toLowerCase();
  const off = R.offTopic(low, low) || null;
  const got = off ? null : R.kind(q, q) || null;
  const missing = got || off ? [] : must.filter((m) => !given.includes(flat(m)));
  const ok = got === handoff && off === offtopic && !missing.length;
  return { q, handoff, offtopic, got, off, missing, ok };
});
const who = (handoff, off) => off ? "waved off (" + off + ")" : handoff ? "Evelyn (" + handoff + ")" : "the chat";
const bad = rows.filter((r) => !r.ok);
const cell = (s) => String(s).replace(/\|/g, "\\|");
const md = `# Chat eval\n\nRun ${new Date().toISOString().slice(0, 10)}: ${rows.length - bad.length} of ${rows.length} as expected.\n\n` +
  "| Question | Goes to | Expected | Her words in the knowledge |\n|---|---|---|---|\n" +
  rows.map((r) => `| ${cell(r.q)} | ${who(r.got, r.off)} | ${who(r.handoff, r.offtopic)} | ${r.got || r.off ? "" : r.missing.length ? "missing: " + cell(r.missing.join("; ")) : "yes"} |${r.ok ? "" : " ✗"}`).join("\n") + "\n";
fs.writeFileSync(path.join(here, "results.md"), md);
for (const r of bad) console.log("✗", JSON.stringify(r.q), "→", who(r.got, r.off), r.got !== r.handoff || r.off !== r.offtopic ? "(expected " + who(r.handoff, r.offtopic) + ")" : "", r.missing.length ? "missing: " + r.missing.join("; ") : "");
console.log(`eval: ${rows.length - bad.length} of ${rows.length} as expected → knowledge/eval/results.md`);
process.exitCode = bad.length ? 1 : 0;
