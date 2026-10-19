// Reading Evelyn's saved playbook, shared by import-playbook.mjs and read-screenshots.mjs.
//
// A playbook export is a folder with one JSON file per section (<section>.json),
// as the questionnaire's database stores them: { "id": "<section>", "data":
// { "answers": { "<item>.<field>": ... } } }, or just the answers object.
// Screenshots sit in the answers as "<item>.shots": [{ id, name, at, size, type }],
// voice memos as "<item>.voice". The files themselves stay in the questionnaire's
// asset store under those ids.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as S from "./playbook-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "../..");
export const K = path.join(ROOT, "knowledge");
export const SHOTS_DIR = path.join(K, "screenshots");

export const has = (v) => Array.isArray(v) ? v.some((x) => x && String(x).trim()) : !!(v && String(v).trim());

export const readSection = (dir, sid) => {
  const f = path.join(dir, sid + ".json");
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return (j.data && j.data.answers) || j.answers || j;
};

/** Every card's title, by section and item id, for context. */
export const itemTitle = (sid, itemId) => {
  const find = (list) => (list.find((x) => x.id === itemId) || {}).title;
  return ({
    "client-questions": () => find(S.CLIENT_QUESTION_GROUPS),
    concerns: () => find(S.CONCERNS),
    treatments: () => find(S.TREATMENT_DETAILS),
    aftercare: () => find(S.TREATMENT_AFTERCARE),
    visits: () => "Visits and the studio",
    routine: () => "Routine and starting actives",
    materials: () => "Her own materials",
    "hard-lines": () => "Hard lines",
    voice: () => "How she talks to clients"
  }[sid] || (() => itemId))() || itemId;
};

/** Every screenshot in an export: [{ sid, item, id, name, type, at }]. */
export const allShots = (dir) => {
  const out = [];
  for (const s of S.SECTIONS) {
    const a = readSection(dir, s.id);
    if (!a) continue;
    for (const [k, v] of Object.entries(a)) {
      if (!k.endsWith(".shots") || !Array.isArray(v)) continue;
      const item = k.slice(0, -".shots".length);
      for (const n of v) if (n && n.id) out.push({ sid: s.id, item, id: n.id, name: n.name || "Screenshot", type: n.type || "", at: n.at || "" });
    }
  }
  return out;
};

/** What a screenshot says, once read: { keep, text } or null. */
export const transcript = (id) => {
  const f = path.join(SHOTS_DIR, id + ".md");
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, "utf8");
  const keep = !/^keep: no$/m.test(t);
  return { keep, text: t.replace(/^---[\s\S]*?---\s*/, "").trim() };
};
