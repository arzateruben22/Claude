#!/usr/bin/env node
// CareerQuest Electrician Academy content validator.
//
// Plain Node (>= 18), no dependencies. Run from anywhere:
//   node scripts/validate-academy.mjs            # report + exit code
//   node scripts/validate-academy.mjs --verbose  # also print solved workshop values
//
// Checks data/academy/{lessons,workshop,exam} and data/seed/* against the content
// format documented in data/academy/INDEX.md, solves every workshop circuit
// numerically, cross-checks California certification facts against
// data/research/electrician_research.json, and lints for known-wrong fact phrasings.
// Exits 1 when any error is found, 0 otherwise (warnings do not fail the run).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const LESSON_DIR = join(DATA, "academy", "lessons");
const WORKSHOP_DIR = join(DATA, "academy", "workshop");
const EXAM_FILE = join(DATA, "academy", "exam", "question_bank.json");
const SEED_DIR = join(DATA, "seed");
const RESEARCH_FILE = join(DATA, "research", "electrician_research.json");
const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");

// ---------------------------------------------------------------------------
// Rules (the content contract)
// ---------------------------------------------------------------------------
const TRACKS = ["FUNDAMENTALS", "SAFETY", "INSTALLATION", "SYSTEMS", "CODE", "EXAM_PREP"];
const SECTION_TYPES = ["text", "formula", "diagram", "example", "callout", "table"];
const CALLOUT_TONES = ["safety", "tip", "warning", "simulation"];
const TOLERANCE_TYPES = ["absolute", "relative"];
const SECTIONS_MIN = 5;
const SECTIONS_MAX = 16;
const PRACTICE_MIN = 4;
const PRACTICE_MAX = 8;
const QUIZ_MIN = 6;
const QUIZ_MAX = 60;
const CHOICES_MIN = 3;
const CHOICES_MAX = 5;
const SVG_MAX_BYTES = 8 * 1024;
const EXAM_MIN_QUESTIONS = 100;
const RECRUITMENT_STATUSES = ["OPEN", "CLOSED", "UNVERIFIED"];
const CERT_CODES = ["GENERAL", "RESIDENTIAL", "FIRE_LIFE_SAFETY", "VOICE_DATA_VIDEO", "NON_RESIDENTIAL_LIGHTING"];
// Research file uses shorter codes for two classifications.
const RESEARCH_CODE_ALIASES = { VOICE_DATA_VIDEO: "VDV", NON_RESIDENTIAL_LIGHTING: "NON_RES_LIGHTING" };
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESISTOR_ID = /^[A-Za-z][A-Za-z0-9]*$/;
const QUANTITY = /^(R_total|I_total|P_total|[VIP]_([A-Za-z][A-Za-z0-9]*))$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Allowed optional metadata that is not part of the core item contract.
const ITEM_OPTIONAL_EXTRAS = new Set(["area"]);

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const errors = [];
const warnings = [];
const rel = (p) => relative(ROOT, p);
function err(file, path, msg) {
  errors.push({ file: rel(file), path, msg });
}
function warn(file, path, msg) {
  warnings.push({ file: rel(file), path, msg });
}

// ---------------------------------------------------------------------------
// Primitive checks
// ---------------------------------------------------------------------------
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);

function reqStr(file, obj, key, path) {
  if (!isStr(obj?.[key])) err(file, `${path}.${key}`, "must be a non-empty string");
}
function optStr(file, obj, key, path) {
  if (obj?.[key] !== undefined && !isStr(obj[key])) err(file, `${path}.${key}`, "must be a non-empty string when present");
}
function strArray(file, value, path, { min = 0 } = {}) {
  if (!Array.isArray(value)) {
    err(file, path, "must be an array of strings");
    return false;
  }
  if (value.length < min) err(file, path, `must contain at least ${min} item(s) (has ${value.length})`);
  value.forEach((v, i) => {
    if (!isStr(v)) err(file, `${path}[${i}]`, "must be a non-empty string");
  });
  return true;
}
function checkUrl(file, value, path, { nullable = false } = {}) {
  if (value === null && nullable) return;
  if (!isStr(value)) {
    err(file, path, nullable ? "must be a URL string or null" : "must be a URL string");
    return;
  }
  let u;
  try {
    u = new URL(value);
  } catch {
    err(file, path, `is not a valid URL: ${value}`);
    return;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") err(file, path, `URL must be http(s): ${value}`);
  else if (u.protocol === "http:") warn(file, path, `URL is not https: ${value}`);
}
const TODAY = new Date().toISOString().slice(0, 10);
function checkDate(file, value, path) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    err(file, path, `must be a YYYY-MM-DD date string (got ${JSON.stringify(value)})`);
    return;
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) err(file, path, `is not a real calendar date: ${value}`);
  else if (value > TODAY) err(file, path, `verification date ${value} is in the future`);
}
function unknownKeys(file, obj, allowed, path, extras = new Set()) {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k) && !extras.has(k)) warn(file, `${path}.${k}`, "unknown field (not part of the content contract)");
  }
}
function loadJson(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    err(file, "$", `cannot read file: ${e.message}`);
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    err(file, "$", `invalid JSON: ${e.message}`);
    return undefined;
  }
}
function jsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}

// ---------------------------------------------------------------------------
// Global id registry (lesson items, workshop tasks, exam questions)
// ---------------------------------------------------------------------------
const globalIds = new Map();
function registerId(file, id, path) {
  if (!isStr(id)) {
    err(file, `${path}.id`, "must be a non-empty string");
    return;
  }
  const prev = globalIds.get(id);
  if (prev) err(file, `${path}.id`, `duplicate id "${id}" (first used in ${prev})`);
  else globalIds.set(id, `${rel(file)} ${path}`);
}

// ---------------------------------------------------------------------------
// SVG safety
// ---------------------------------------------------------------------------
function checkSvg(file, svg, path) {
  if (!isStr(svg)) {
    err(file, path, "must be a non-empty SVG string");
    return;
  }
  const bytes = Buffer.byteLength(svg, "utf8");
  if (bytes > SVG_MAX_BYTES) err(file, path, `SVG is ${bytes} bytes; limit is ${SVG_MAX_BYTES} (8 KB)`);
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) err(file, path, "SVG must start with an <svg> element");
  if (!/<\/svg>\s*$/i.test(trimmed)) err(file, path, "SVG must end with </svg>");
  const root = trimmed.match(/^<svg\b[^>]*>/i)?.[0] ?? "";
  if (!/\sviewBox\s*=\s*["'][^"']+["']/.test(root)) err(file, path, "root <svg> element must have a viewBox attribute");
  if (/<script\b/i.test(svg)) err(file, path, "SVG must not contain <script>");
  if (/<foreignObject\b/i.test(svg)) err(file, path, "SVG must not contain <foreignObject>");
  const handler = svg.match(/\son[a-z]+\s*=/i);
  if (handler) err(file, path, `SVG must not contain event handler attributes (found "${handler[0].trim()}")`);
  if (/javascript:/i.test(svg)) err(file, path, "SVG must not contain javascript: URLs");
  for (const m of svg.matchAll(/\s(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    if (!m[1].startsWith("#")) err(file, path, `SVG must not reference external resources (href="${m[1]}")`);
  }
  for (const m of svg.matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
    if (!m[1].startsWith("#")) err(file, path, `SVG must not reference external resources (url(${m[1]}))`);
  }
  if (/@import/i.test(svg)) err(file, path, "SVG must not contain CSS @import");
}

// ---------------------------------------------------------------------------
// Items (practice / quiz questions)
// ---------------------------------------------------------------------------
function checkChoices(file, obj, path, keyName = "choices") {
  const choices = obj[keyName];
  if (!Array.isArray(choices)) {
    err(file, `${path}.${keyName}`, "must be an array");
    return;
  }
  if (choices.length < CHOICES_MIN || choices.length > CHOICES_MAX)
    err(file, `${path}.${keyName}`, `must have ${CHOICES_MIN}-${CHOICES_MAX} choices (has ${choices.length})`);
  const seen = new Set();
  choices.forEach((c, i) => {
    if (!isStr(c)) err(file, `${path}.${keyName}[${i}]`, "must be a non-empty string");
    else {
      const norm = c.trim().toLowerCase();
      if (seen.has(norm)) err(file, `${path}.${keyName}[${i}]`, `duplicate choice "${c}"`);
      seen.add(norm);
    }
  });
  if (!isInt(obj.correctIndex) || obj.correctIndex < 0 || obj.correctIndex >= choices.length)
    err(file, `${path}.correctIndex`, `must be an integer index into choices (0-${choices.length - 1}); got ${JSON.stringify(obj.correctIndex)}`);
}

function checkTolerance(file, obj, path, expected) {
  if (!isNum(obj.tolerance) || obj.tolerance < 0) {
    err(file, `${path}.tolerance`, "must be a finite number >= 0");
    return;
  }
  if (obj.toleranceType !== undefined && !TOLERANCE_TYPES.includes(obj.toleranceType))
    err(file, `${path}.toleranceType`, `must be one of ${TOLERANCE_TYPES.join("|")}`);
  const type = obj.toleranceType ?? "absolute";
  if (!isNum(expected)) return;
  if (type === "relative") {
    if (expected === 0) err(file, `${path}.toleranceType`, "relative tolerance on an expected value of 0 accepts only an exact 0; use toleranceType \"absolute\"");
    if (obj.tolerance > 0.1) err(file, `${path}.tolerance`, `relative tolerance ${obj.tolerance} (> 10%) would accept wrong answers`);
    if (obj.tolerance === 0) warn(file, `${path}.tolerance`, "relative tolerance of 0 requires an exact floating-point match");
  } else {
    if (expected !== 0 && obj.tolerance > Math.abs(expected) * 0.1)
      err(file, `${path}.tolerance`, `absolute tolerance ${obj.tolerance} is more than 10% of the answer ${expected}; it would accept wrong answers`);
    if (obj.tolerance === 0 && !isInt(expected)) warn(file, `${path}.tolerance`, "absolute tolerance of 0 on a non-integer answer requires an exact floating-point match");
  }
}

function checkItem(file, item, path, lessonKey) {
  if (!isObj(item)) {
    err(file, path, "must be an object");
    return;
  }
  registerId(file, item.id, path);
  if (isStr(item.id) && lessonKey && !item.id.startsWith(`${lessonKey}-`))
    err(file, `${path}.id`, `item id "${item.id}" must be prefixed with the lesson key "${lessonKey}-"`);
  reqStr(file, item, "prompt", path);
  reqStr(file, item, "explanation", path);
  if (item.area !== undefined && !isStr(item.area)) err(file, `${path}.area`, "must be a non-empty string when present");
  if (item.type === "numeric") {
    unknownKeys(file, item, ["id", "type", "prompt", "answer", "unit", "tolerance", "toleranceType", "explanation"], path, ITEM_OPTIONAL_EXTRAS);
    if (!isNum(item.answer)) err(file, `${path}.answer`, "must be a finite number");
    optStr(file, item, "unit", path);
    checkTolerance(file, item, path, item.answer);
  } else if (item.type === "multiple_choice") {
    unknownKeys(file, item, ["id", "type", "prompt", "choices", "correctIndex", "explanation"], path, ITEM_OPTIONAL_EXTRAS);
    checkChoices(file, item, path);
  } else {
    err(file, `${path}.type`, `must be "numeric" or "multiple_choice" (got ${JSON.stringify(item.type)})`);
  }
}

// ---------------------------------------------------------------------------
// Lesson sections
// ---------------------------------------------------------------------------
function checkSection(file, s, path) {
  if (!isObj(s)) {
    err(file, path, "must be an object");
    return;
  }
  if (!SECTION_TYPES.includes(s.type)) {
    err(file, `${path}.type`, `must be one of ${SECTION_TYPES.join("|")} (got ${JSON.stringify(s.type)})`);
    return;
  }
  switch (s.type) {
    case "text":
      unknownKeys(file, s, ["type", "heading", "markdown"], path);
      optStr(file, s, "heading", path);
      reqStr(file, s, "markdown", path);
      if (isStr(s.markdown) && /<script\b|<iframe\b|\son[a-z]+\s*=/i.test(s.markdown)) err(file, `${path}.markdown`, "markdown must not contain raw script/iframe/event-handler HTML");
      break;
    case "formula":
      unknownKeys(file, s, ["type", "name", "expression", "variables", "explanation"], path);
      reqStr(file, s, "name", path);
      reqStr(file, s, "expression", path);
      reqStr(file, s, "explanation", path);
      if (!Array.isArray(s.variables) || s.variables.length === 0) err(file, `${path}.variables`, "must be a non-empty array");
      else
        s.variables.forEach((v, i) => {
          const vp = `${path}.variables[${i}]`;
          if (!isObj(v)) return err(file, vp, "must be an object");
          unknownKeys(file, v, ["symbol", "meaning", "unit"], vp);
          reqStr(file, v, "symbol", vp);
          reqStr(file, v, "meaning", vp);
          if (typeof v.unit !== "string") err(file, `${vp}.unit`, "must be a string (use \"none\" or \"dimensionless\" for unitless quantities)");
          else if (!v.unit.trim()) err(file, `${vp}.unit`, "must not be empty (use \"none\" or \"dimensionless\" for unitless quantities)");
        });
      break;
    case "diagram":
      unknownKeys(file, s, ["type", "title", "svg", "caption"], path);
      reqStr(file, s, "title", path);
      reqStr(file, s, "caption", path);
      checkSvg(file, s.svg, `${path}.svg`);
      break;
    case "example":
      unknownKeys(file, s, ["type", "problem", "solutionSteps", "answer"], path);
      reqStr(file, s, "problem", path);
      strArray(file, s.solutionSteps, `${path}.solutionSteps`, { min: 1 });
      reqStr(file, s, "answer", path);
      break;
    case "callout":
      unknownKeys(file, s, ["type", "tone", "text"], path);
      if (!CALLOUT_TONES.includes(s.tone)) err(file, `${path}.tone`, `must be one of ${CALLOUT_TONES.join("|")} (got ${JSON.stringify(s.tone)})`);
      reqStr(file, s, "text", path);
      break;
    case "table":
      unknownKeys(file, s, ["type", "caption", "columns", "rows"], path);
      reqStr(file, s, "caption", path);
      if (strArray(file, s.columns, `${path}.columns`, { min: 1 })) {
        if (!Array.isArray(s.rows) || s.rows.length === 0) err(file, `${path}.rows`, "must be a non-empty array of rows");
        else
          s.rows.forEach((row, i) => {
            if (!Array.isArray(row)) return err(file, `${path}.rows[${i}]`, "must be an array of strings");
            if (row.length !== s.columns.length) err(file, `${path}.rows[${i}]`, `has ${row.length} cells but there are ${s.columns.length} columns`);
            row.forEach((c, j) => {
              if (typeof c !== "string") err(file, `${path}.rows[${i}][${j}]`, "must be a string");
            });
          });
      }
      break;
  }
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
const lessons = new Map(); // key -> { file, data }
function checkLesson(file, L) {
  const p = "$";
  if (!isObj(L)) return err(file, p, "lesson must be a JSON object");
  unknownKeys(file, L, ["key", "track", "order", "title", "summary", "estimatedMinutes", "prerequisites", "objectives", "sections", "practice", "quiz", "sources", "disclaimer"], p);
  if (!isStr(L.key) || !KEBAB.test(L.key)) err(file, `${p}.key`, `must be a kebab-case string (got ${JSON.stringify(L.key)})`);
  else {
    if (basename(file, ".json") !== L.key) err(file, `${p}.key`, `key "${L.key}" must match the file name "${basename(file)}"`);
    if (lessons.has(L.key)) err(file, `${p}.key`, `duplicate lesson key "${L.key}" (also in ${rel(lessons.get(L.key).file)})`);
    else lessons.set(L.key, { file, data: L });
  }
  if (!TRACKS.includes(L.track)) err(file, `${p}.track`, `must be one of ${TRACKS.join("|")} (got ${JSON.stringify(L.track)})`);
  if (!isInt(L.order) || L.order < 1) err(file, `${p}.order`, "must be a positive integer");
  reqStr(file, L, "title", p);
  reqStr(file, L, "summary", p);
  if (!isNum(L.estimatedMinutes) || L.estimatedMinutes <= 0) err(file, `${p}.estimatedMinutes`, "must be a positive number");
  if (Array.isArray(L.prerequisites)) {
    L.prerequisites.forEach((k, i) => {
      if (!isStr(k)) err(file, `${p}.prerequisites[${i}]`, "must be a lesson key string");
    });
    if (new Set(L.prerequisites).size !== L.prerequisites.length) err(file, `${p}.prerequisites`, "contains duplicates");
  } else err(file, `${p}.prerequisites`, "must be an array of lesson keys");
  strArray(file, L.objectives, `${p}.objectives`, { min: 1 });

  if (!Array.isArray(L.sections)) err(file, `${p}.sections`, "must be an array");
  else {
    if (L.sections.length < SECTIONS_MIN || L.sections.length > SECTIONS_MAX)
      err(file, `${p}.sections`, `must have ${SECTIONS_MIN}-${SECTIONS_MAX} sections (has ${L.sections.length})`);
    L.sections.forEach((s, i) => checkSection(file, s, `${p}.sections[${i}]`));
  }

  if (!Array.isArray(L.practice)) err(file, `${p}.practice`, "must be an array");
  else {
    if (L.practice.length < PRACTICE_MIN || L.practice.length > PRACTICE_MAX)
      err(file, `${p}.practice`, `must have ${PRACTICE_MIN}-${PRACTICE_MAX} items (has ${L.practice.length})`);
    L.practice.forEach((it, i) => checkItem(file, it, `${p}.practice[${i}]`, L.key));
  }

  if (!isObj(L.quiz)) err(file, `${p}.quiz`, "must be an object");
  else {
    const q = L.quiz;
    unknownKeys(file, q, ["key", "passingScore", "questions"], `${p}.quiz`);
    if (!isStr(q.key) || !KEBAB.test(q.key)) err(file, `${p}.quiz.key`, "must be a kebab-case string");
    else if (quizKeys.has(q.key)) err(file, `${p}.quiz.key`, `duplicate quiz key "${q.key}" (also in ${quizKeys.get(q.key)})`);
    else quizKeys.set(q.key, rel(file));
    if (!isNum(q.passingScore) || q.passingScore <= 0 || q.passingScore > 100) err(file, `${p}.quiz.passingScore`, "must be a number in (0, 100] (percent)");
    if (!Array.isArray(q.questions)) err(file, `${p}.quiz.questions`, "must be an array");
    else {
      if (q.questions.length < QUIZ_MIN || q.questions.length > QUIZ_MAX)
        err(file, `${p}.quiz.questions`, `must have ${QUIZ_MIN}-${QUIZ_MAX} questions (has ${q.questions.length})`);
      q.questions.forEach((it, i) => checkItem(file, it, `${p}.quiz.questions[${i}]`, L.key));
    }
  }

  if (!Array.isArray(L.sources) || L.sources.length === 0) err(file, `${p}.sources`, "must be a non-empty array of {title, url}");
  else
    L.sources.forEach((s, i) => {
      const sp = `${p}.sources[${i}]`;
      if (!isObj(s)) return err(file, sp, "must be an object");
      unknownKeys(file, s, ["title", "url"], sp);
      reqStr(file, s, "title", sp);
      checkUrl(file, s.url, `${sp}.url`);
    });
  reqStr(file, L, "disclaimer", p);
}
const quizKeys = new Map();

function checkLessonGraph() {
  const orderByTrack = new Map();
  for (const [key, { file, data }] of lessons) {
    (data.prerequisites ?? []).forEach((k, i) => {
      if (!isStr(k)) return;
      if (k === key) err(file, `$.prerequisites[${i}]`, "a lesson cannot be its own prerequisite");
      else if (!lessons.has(k)) err(file, `$.prerequisites[${i}]`, `unknown lesson key "${k}"`);
    });
    if (TRACKS.includes(data.track) && isInt(data.order)) {
      const slot = `${data.track}#${data.order}`;
      if (orderByTrack.has(slot)) err(file, "$.order", `order ${data.order} is already used in track ${data.track} by "${orderByTrack.get(slot)}"`);
      else orderByTrack.set(slot, key);
    }
  }
  // Cycle detection.
  const state = new Map(); // 0 unvisited, 1 visiting, 2 done
  const visit = (k, stack) => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) {
      const cyc = stack.slice(stack.indexOf(k)).concat(k).join(" -> ");
      err(lessons.get(k).file, "$.prerequisites", `prerequisite cycle: ${cyc}`);
      return;
    }
    state.set(k, 1);
    for (const n of lessons.get(k).data.prerequisites ?? []) if (lessons.has(n)) visit(n, [...stack, k]);
    state.set(k, 2);
  };
  for (const k of lessons.keys()) visit(k, []);
}

// ---------------------------------------------------------------------------
// Workshop circuits
// ---------------------------------------------------------------------------
function checkNetwork(file, node, path, resistors) {
  if (!isObj(node)) return err(file, path, "must be an object");
  if (node.type === "resistor") {
    unknownKeys(file, node, ["type", "id", "ohms"], path);
    if (!isStr(node.id) || !RESISTOR_ID.test(node.id)) err(file, `${path}.id`, `resistor id must match ${RESISTOR_ID} (got ${JSON.stringify(node.id)})`);
    else if (["total"].includes(node.id)) err(file, `${path}.id`, `"${node.id}" is reserved`);
    else if (resistors.has(node.id)) err(file, `${path}.id`, `duplicate resistor id "${node.id}"`);
    else resistors.set(node.id, node);
    if (!isNum(node.ohms) || node.ohms <= 0) err(file, `${path}.ohms`, "must be a finite number > 0");
  } else if (node.type === "series" || node.type === "parallel") {
    unknownKeys(file, node, ["type", "items"], path);
    if (!Array.isArray(node.items) || node.items.length === 0) err(file, `${path}.items`, "must be a non-empty array");
    else {
      if (node.items.length < 2) warn(file, `${path}.items`, `a ${node.type} group with one item is redundant`);
      node.items.forEach((n, i) => checkNetwork(file, n, `${path}.items[${i}]`, resistors));
    }
  } else err(file, `${path}.type`, `must be "series", "parallel" or "resistor" (got ${JSON.stringify(node.type)})`);
}

// Effective resistance with faults applied (open = Infinity, short = 0).
function effR(node, faults) {
  if (node.type === "resistor") {
    const f = faults.get(node.id);
    if (f === "open") return Infinity;
    if (f === "short") return 0;
    return node.ohms;
  }
  const rs = node.items.map((n) => effR(n, faults));
  if (node.type === "series") return rs.reduce((a, b) => a + b, 0);
  if (rs.some((r) => r === 0)) return 0;
  const g = rs.reduce((a, r) => a + (r === Infinity ? 0 : 1 / r), 0);
  return g === 0 ? Infinity : 1 / g;
}

// Distribute voltage v across and current i through `node`; record per-resistor values.
function distribute(node, v, i, faults, out) {
  if (node.type === "resistor") {
    out.set(node.id, { V: v, I: i, P: v * i });
    return;
  }
  const rs = node.items.map((n) => effR(n, faults));
  if (node.type === "series") {
    const total = rs.reduce((a, b) => a + b, 0);
    if (Number.isFinite(total)) {
      node.items.forEach((n, k) => distribute(n, i * rs[k], i, faults, out));
    } else {
      const opens = rs.filter((r) => r === Infinity).length;
      node.items.forEach((n, k) => {
        const vk = rs[k] === Infinity ? (opens === 1 ? v : NaN) : 0;
        distribute(n, vk, 0, faults, out);
      });
    }
  } else {
    const shorts = rs.filter((r) => r === 0).length;
    if (shorts === 0) {
      node.items.forEach((n, k) => distribute(n, v, rs[k] === Infinity ? 0 : v / rs[k], faults, out));
    } else {
      node.items.forEach((n, k) => {
        const ik = rs[k] === 0 ? (shorts === 1 ? i : NaN) : 0;
        distribute(n, 0, ik, faults, out);
      });
    }
  }
}

export function solveCircuit(circuit) {
  const faults = new Map((circuit.faults ?? []).map((f) => [f.id, f.fault]));
  const V = circuit.sourceVolts;
  const R = effR(circuit.network, faults);
  const I = R === 0 ? Infinity : R === Infinity ? 0 : V / R;
  const values = new Map([
    ["R_total", R],
    ["I_total", I],
    ["P_total", V * I],
  ]);
  const per = new Map();
  if (Number.isFinite(I)) distribute(circuit.network, V, I, faults, per);
  else {
    // Dead short across the source: every element quantity is undefined.
    const ids = [];
    const walk = (n) => (n.type === "resistor" ? ids.push(n.id) : n.items.forEach(walk));
    walk(circuit.network);
    ids.forEach((id) => per.set(id, { V: NaN, I: NaN, P: NaN }));
  }
  for (const [id, q] of per) {
    values.set(`V_${id}`, q.V);
    values.set(`I_${id}`, q.I);
    values.set(`P_${id}`, q.P);
  }
  return values;
}

const workshops = new Map();
const solvedReport = [];
function checkWorkshop(file, W) {
  const p = "$";
  if (!isObj(W)) return err(file, p, "workshop must be a JSON object");
  unknownKeys(file, W, ["key", "title", "description", "difficulty", "estimatedMinutes", "relatedLessons", "circuit", "tasks", "hints", "learningGoals", "disclaimer"], p);
  if (!isStr(W.key) || !KEBAB.test(W.key)) err(file, `${p}.key`, "must be a kebab-case string");
  else {
    if (basename(file, ".json") !== W.key) err(file, `${p}.key`, `key "${W.key}" must match the file name "${basename(file)}"`);
    if (workshops.has(W.key)) err(file, `${p}.key`, `duplicate workshop key "${W.key}"`);
    else workshops.set(W.key, { file, data: W });
  }
  reqStr(file, W, "title", p);
  reqStr(file, W, "description", p);
  if (!isInt(W.difficulty) || W.difficulty < 1 || W.difficulty > 5) err(file, `${p}.difficulty`, "must be an integer 1-5");
  if (!isNum(W.estimatedMinutes) || W.estimatedMinutes <= 0) err(file, `${p}.estimatedMinutes`, "must be a positive number");
  if (!Array.isArray(W.relatedLessons)) err(file, `${p}.relatedLessons`, "must be an array of lesson keys");
  strArray(file, W.hints, `${p}.hints`, { min: 1 });
  strArray(file, W.learningGoals, `${p}.learningGoals`, { min: 1 });
  reqStr(file, W, "disclaimer", p);

  // Circuit
  const resistors = new Map();
  let circuitOk = false;
  if (!isObj(W.circuit)) err(file, `${p}.circuit`, "must be an object");
  else {
    const c = W.circuit;
    unknownKeys(file, c, ["sourceVolts", "network", "faults"], `${p}.circuit`);
    if (!isNum(c.sourceVolts) || c.sourceVolts <= 0) err(file, `${p}.circuit.sourceVolts`, "must be a finite number > 0");
    const before = errors.length;
    checkNetwork(file, c.network, `${p}.circuit.network`, resistors);
    if (c.faults !== undefined) {
      if (!Array.isArray(c.faults)) err(file, `${p}.circuit.faults`, "must be an array when present");
      else {
        const seen = new Set();
        c.faults.forEach((f, i) => {
          const fp = `${p}.circuit.faults[${i}]`;
          if (!isObj(f)) return err(file, fp, "must be an object");
          unknownKeys(file, f, ["id", "fault"], fp);
          if (!resistors.has(f.id)) err(file, `${fp}.id`, `fault references unknown resistor "${f.id}"`);
          if (seen.has(f.id)) err(file, `${fp}.id`, `resistor "${f.id}" has more than one fault`);
          seen.add(f.id);
          if (f.fault !== "open" && f.fault !== "short") err(file, `${fp}.fault`, `must be "open" or "short" (got ${JSON.stringify(f.fault)})`);
        });
      }
    }
    circuitOk = errors.length === before && isNum(c.sourceVolts) && c.sourceVolts > 0;
  }
  const solved = circuitOk ? solveCircuit(W.circuit) : null;

  // Tasks
  if (!Array.isArray(W.tasks) || W.tasks.length === 0) err(file, `${p}.tasks`, "must be a non-empty array");
  else
    W.tasks.forEach((t, i) => {
      const tp = `${p}.tasks[${i}]`;
      if (!isObj(t)) return err(file, tp, "must be an object");
      registerId(file, t.id, tp);
      reqStr(file, t, "question", tp);
      if (t.type === "multiple_choice") {
        unknownKeys(file, t, ["id", "type", "question", "choices", "correctIndex", "explanation"], tp);
        checkChoices(file, t, tp);
        optStr(file, t, "explanation", tp);
      } else if (t.type === undefined) {
        unknownKeys(file, t, ["id", "question", "quantity", "tolerance", "toleranceType"], tp);
        const m = typeof t.quantity === "string" ? t.quantity.match(QUANTITY) : null;
        if (!m) return err(file, `${tp}.quantity`, `must be R_total|I_total|P_total|V_<id>|I_<id>|P_<id> (got ${JSON.stringify(t.quantity)})`);
        if (m[2] && !resistors.has(m[2])) return err(file, `${tp}.quantity`, `references unknown resistor "${m[2]}"`);
        const value = solved?.get(t.quantity);
        if (solved && !Number.isFinite(value)) err(file, `${tp}.quantity`, `${t.quantity} is not finite for this circuit (solver gives ${value}); the task has no numeric answer`);
        checkTolerance(file, t, tp, value);
        if (solved) solvedReport.push(`${W.key}/${t.id}: ${t.quantity} = ${fmt(value)}`);
      } else err(file, `${tp}.type`, `numeric tasks omit "type"; multiple-choice tasks use "multiple_choice" (got ${JSON.stringify(t.type)})`);
    });
}
const fmt = (v) => (Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : String(v));

function checkWorkshopLinks() {
  for (const [, { file, data }] of workshops) {
    (data.relatedLessons ?? []).forEach((k, i) => {
      if (!lessons.has(k)) err(file, `$.relatedLessons[${i}]`, `unknown lesson key "${k}"`);
    });
  }
}

// ---------------------------------------------------------------------------
// Exam bank
// ---------------------------------------------------------------------------
const examStats = { total: 0, byArea: {}, byDifficulty: {} };
function checkExam(file, E) {
  const p = "$";
  if (!isObj(E)) return err(file, p, "question bank must be a JSON object");
  unknownKeys(file, E, ["disclaimer", "areas", "questions"], p);
  reqStr(file, E, "disclaimer", p);
  let areaKeys = null;
  if (E.areas !== undefined) {
    if (!Array.isArray(E.areas)) err(file, `${p}.areas`, "must be an array when present");
    else {
      areaKeys = new Set();
      let weight = 0;
      E.areas.forEach((a, i) => {
        const ap = `${p}.areas[${i}]`;
        if (!isObj(a)) return err(file, ap, "must be an object");
        unknownKeys(file, a, ["key", "label", "weight"], ap);
        reqStr(file, a, "key", ap);
        reqStr(file, a, "label", ap);
        if (!isNum(a.weight) || a.weight <= 0 || a.weight > 1) err(file, `${ap}.weight`, "must be a number in (0, 1]");
        else weight += a.weight;
        if (isStr(a.key)) {
          if (areaKeys.has(a.key)) err(file, `${ap}.key`, `duplicate area "${a.key}"`);
          areaKeys.add(a.key);
        }
      });
      if (Math.abs(weight - 1) > 0.001) err(file, `${p}.areas`, `area weights must sum to 1 (sum is ${weight.toFixed(3)})`);
    }
  }
  if (!Array.isArray(E.questions)) return err(file, `${p}.questions`, "must be an array");
  if (E.questions.length < EXAM_MIN_QUESTIONS) err(file, `${p}.questions`, `must contain at least ${EXAM_MIN_QUESTIONS} questions (has ${E.questions.length})`);
  const prompts = new Map();
  E.questions.forEach((q, i) => {
    const qp = `${p}.questions[${i}]`;
    if (!isObj(q)) return err(file, qp, "must be an object");
    unknownKeys(file, q, ["id", "area", "difficulty", "prompt", "choices", "correctIndex", "explanation", "necReference"], qp);
    registerId(file, q.id, qp);
    reqStr(file, q, "area", qp);
    if (areaKeys && isStr(q.area) && !areaKeys.has(q.area)) err(file, `${qp}.area`, `unknown area "${q.area}" (not in $.areas)`);
    if (!isInt(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) err(file, `${qp}.difficulty`, "must be an integer 1-3");
    reqStr(file, q, "prompt", qp);
    checkChoices(file, q, qp);
    reqStr(file, q, "explanation", qp);
    if (!(q.necReference === null || isStr(q.necReference))) err(file, `${qp}.necReference`, "must be a string or null");
    if (isStr(q.prompt)) {
      const norm = q.prompt.trim().toLowerCase();
      if (prompts.has(norm)) err(file, `${qp}.prompt`, `duplicate prompt (same as ${prompts.get(norm)})`);
      else prompts.set(norm, q.id);
    }
    examStats.total++;
    examStats.byArea[q.area] = (examStats.byArea[q.area] ?? 0) + 1;
    examStats.byDifficulty[q.difficulty] = (examStats.byDifficulty[q.difficulty] ?? 0) + 1;
  });
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const PROGRAM_FIELDS = ["slug", "name", "sponsor", "region", "isUnion", "website", "applyUrl", "eligibility", "processSteps", "durationYears", "classroomHours", "startingWage", "startingWageVerified", "fees", "contact", "recruitmentStatus", "recruitmentNote", "sourceUrls", "verifiedOn"];
function nullableStr(file, obj, key, path) {
  if (!(obj[key] === null || isStr(obj[key]))) err(file, `${path}.${key}`, "must be a non-empty string or null");
}
function checkPrograms(file, P) {
  if (!Array.isArray(P)) return err(file, "$", "must be an array of apprenticeship programs");
  if (P.length === 0) err(file, "$", "must contain at least one program");
  const slugs = new Set();
  P.forEach((a, i) => {
    const p = `$[${i}]`;
    if (!isObj(a)) return err(file, p, "must be an object");
    unknownKeys(file, a, PROGRAM_FIELDS, p);
    for (const k of PROGRAM_FIELDS) if (!(k in a)) err(file, `${p}.${k}`, "is required (use null or [] when unknown)");
    if (!isStr(a.slug) || !KEBAB.test(a.slug)) err(file, `${p}.slug`, "must be a kebab-case string");
    else if (slugs.has(a.slug)) err(file, `${p}.slug`, `duplicate slug "${a.slug}"`);
    else slugs.add(a.slug);
    for (const k of ["name", "sponsor", "region", "recruitmentNote"]) reqStr(file, a, k, p);
    if (typeof a.isUnion !== "boolean") err(file, `${p}.isUnion`, "must be a boolean");
    checkUrl(file, a.website, `${p}.website`, { nullable: true });
    checkUrl(file, a.applyUrl, `${p}.applyUrl`, { nullable: true });
    strArray(file, a.eligibility, `${p}.eligibility`);
    strArray(file, a.processSteps, `${p}.processSteps`);
    if (!(a.durationYears === null || (isNum(a.durationYears) && a.durationYears > 0))) err(file, `${p}.durationYears`, "must be a positive number or null");
    for (const k of ["classroomHours", "startingWage", "fees"]) nullableStr(file, a, k, p);
    if (typeof a.startingWageVerified !== "boolean") err(file, `${p}.startingWageVerified`, "must be a boolean");
    else if (a.startingWageVerified && a.startingWage === null) err(file, `${p}.startingWageVerified`, "cannot be true when startingWage is null");
    if (!isObj(a.contact)) err(file, `${p}.contact`, "must be an object");
    else {
      unknownKeys(file, a.contact, ["phone", "address", "email"], `${p}.contact`);
      for (const k of ["phone", "address", "email"]) optStr(file, a.contact, k, `${p}.contact`);
      if (isStr(a.contact.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.contact.email)) err(file, `${p}.contact.email`, "is not an email address");
    }
    if (!RECRUITMENT_STATUSES.includes(a.recruitmentStatus)) err(file, `${p}.recruitmentStatus`, `must be one of ${RECRUITMENT_STATUSES.join("|")}`);
    if (!Array.isArray(a.sourceUrls) || a.sourceUrls.length === 0) err(file, `${p}.sourceUrls`, "must be a non-empty array of URLs");
    else a.sourceUrls.forEach((u, j) => checkUrl(file, u, `${p}.sourceUrls[${j}]`));
    checkDate(file, a.verifiedOn, `${p}.verifiedOn`);
  });
}

function checkRequirements(file, R, research) {
  if (!Array.isArray(R)) return err(file, "$", "must be an array of certification requirements");
  const codes = new Set();
  const researchHours = new Map((research?.certification?.classifications ?? []).map((c) => [c.code, c.hoursRequired]));
  R.forEach((r, i) => {
    const p = `$[${i}]`;
    if (!isObj(r)) return err(file, p, "must be an object");
    unknownKeys(file, r, ["code", "name", "hoursRequired", "notes", "sourceUrl", "verifiedOn"], p);
    if (!CERT_CODES.includes(r.code)) err(file, `${p}.code`, `must be one of ${CERT_CODES.join("|")} (got ${JSON.stringify(r.code)})`);
    else if (codes.has(r.code)) err(file, `${p}.code`, `duplicate code "${r.code}"`);
    else codes.add(r.code);
    reqStr(file, r, "name", p);
    reqStr(file, r, "notes", p);
    if (!isInt(r.hoursRequired) || r.hoursRequired <= 0) err(file, `${p}.hoursRequired`, "must be a positive integer");
    checkUrl(file, r.sourceUrl, `${p}.sourceUrl`);
    checkDate(file, r.verifiedOn, `${p}.verifiedOn`);
    const expected = researchHours.get(RESEARCH_CODE_ALIASES[r.code] ?? r.code);
    if (research && expected === undefined) warn(file, `${p}.code`, `no research classification found for ${r.code}`);
    else if (research && expected !== r.hoursRequired) err(file, `${p}.hoursRequired`, `${r.hoursRequired} does not match the research value ${expected} (8 CCR 291.1)`);
  });
  for (const c of CERT_CODES) if (!codes.has(c)) err(file, "$", `missing certification code ${c}`);
}

function checkFacts(file, F, research) {
  if (!isObj(F)) return err(file, "$", "must be an object");
  const required = ["verifiedOn", "programName", "administeredBy", "mainUrl", "trainee", "fees", "exam", "renewal", "law", "contractorLicense", "wages", "unverifiedItems"];
  for (const k of required) if (!(k in F)) err(file, `$.${k}`, "is required");
  checkDate(file, F.verifiedOn, "$.verifiedOn");
  checkUrl(file, F.mainUrl, "$.mainUrl");
  for (const k of ["trainee", "fees", "exam", "renewal", "law", "contractorLicense", "wages"]) {
    if (k in F && !isObj(F[k])) err(file, `$.${k}`, "must be an object");
  }
  // Every verifiedOn anywhere must be a valid, non-future date; every *Url/sourceUrls must be a URL.
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!isObj(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const kp = `${path}.${k}`;
      if (k === "verifiedOn") checkDate(file, x, kp);
      else if (k === "sourceUrls") (Array.isArray(x) ? x : [x]).forEach((u, i) => checkUrl(file, u, `${kp}[${i}]`));
      else if (/Url$/.test(k) && typeof x === "string") checkUrl(file, x, kp);
      else walk(x, kp);
    }
  };
  walk(F, "$");
  if (isObj(F.fees)) {
    const numericFees = ["applicationFee", "examFee", "reExamFee", "renewalFee", "lapsedExpiredRenewalFee", "replacementCardFee", "traineeRegistrationFee", "traineeRenewalFee"];
    for (const k of numericFees) {
      if (!isNum(F.fees[k]) || F.fees[k] < 0) err(file, `$.fees.${k}`, "must be a number >= 0");
      const r = research?.certification?.fees?.[k];
      if (research && isNum(r) && F.fees[k] !== r) err(file, `$.fees.${k}`, `${F.fees[k]} does not match the research value ${r} (8 CCR 292.0 / DIR fee page)`);
    }
    if (F.fees.combinedInitialCost !== undefined && F.fees.combinedInitialCost !== F.fees.applicationFee + F.fees.examFee)
      err(file, "$.fees.combinedInitialCost", "must equal applicationFee + examFee");
  }
  if (isObj(F.exam)) {
    const r = research?.certification?.exam?.providerChangeEffective;
    if (r && F.exam.providerChangeEffective !== r) err(file, "$.exam.providerChangeEffective", `must be ${r} (research)`);
    if (F.exam.questions !== undefined && !isInt(F.exam.questions)) err(file, "$.exam.questions", "must be an integer");
  }
  if (isObj(F.renewal) && F.renewal.fee !== undefined && research?.certification?.renewal?.fee !== undefined && F.renewal.fee !== research.certification.renewal.fee)
    err(file, "$.renewal.fee", `must be ${research.certification.renewal.fee} (research)`);
  if (!Array.isArray(F.unverifiedItems)) err(file, "$.unverifiedItems", "must be an array of strings");
}

// ---------------------------------------------------------------------------
// Fact lint: known-wrong or out-of-date phrasings (applies to every string)
// ---------------------------------------------------------------------------
const FACT_RULES = [
  {
    id: "fee-175",
    test: (s) => /\$\s?175\b/.test(s) && !(/\$\s?75\b/.test(s) && /\$\s?100\b/.test(s)),
    msg: "mentions $175 without breaking it down; state fees as \"$75 application + $100 exam\" (8 CCR 292.0)",
  },
  {
    id: "fee-application-wrong",
    test: (s) => /\$\s?(?!75\b)\d+(?:\.\d\d)?\s+(?:non-refundable\s+)?application fee/i.test(s) && /certif|DIR|DLSE|electrician/i.test(s) && !/C-10|CSLB|contractor/i.test(s),
    msg: "DIR electrician certification application fee is $75 (8 CCR 292.0)",
  },
  {
    id: "psi-only",
    test: (s) => /\bPSI\b/.test(s) && !/CPS\s?HR|Pearson\s?VUE/i.test(s),
    msg: "mentions PSI without noting that exams on/after June 1, 2026 are scheduled through CPS HR Consulting and delivered by Pearson VUE",
  },
  {
    id: "labor-code-3099",
    test: (s) => /\b3099(?:\.\d)?\b/.test(s) && !/\b108(?:\.\d)?\b/.test(s),
    msg: "cites Labor Code 3099 without the current section numbers (renumbered to Labor Code 108-108.5 by AB 1087, 2002)",
  },
  {
    id: "residential-4500",
    test: (s) => /4,?500\s*(?:hours|hrs|OJT)/i.test(s) && /residential/i.test(s) && !/4,?800/.test(s),
    msg: "Residential Electrician requires 4,800 hours per DIR (8 CCR 291.1)",
  },
  {
    id: "passing-70-percent",
    test: (s) => /70\s?%|70 percent/i.test(s) && /(pass|cut)/i.test(s) && /(certification|DIR|state) exam/i.test(s) && !/scaled/i.test(s),
    msg: "the DIR exam cut score is a scaled score of 70, not 70% correct",
  },
  {
    id: "ce-hours",
    test: (s) => /(\d+)\s*(?:hours?|hrs?)\s+of\s+(?:continuing|further electrical)\s+education/i.test(s) && !/\b32\s*(?:hours?|hrs?)/i.test(s),
    msg: "certification renewal requires 32 hours of continuing education (8 CCR 291.5)",
  },
];
// URLs and SVG markup are not prose; wrong multiple-choice distractors are wrong on purpose,
// so only the correct choice of a question is linted.
const LINT_SKIP_KEYS = /^(svg|url|.*Url|sourceUrls|.*Urls)$/;
function lintStrings(file, value, path) {
  if (typeof value === "string") {
    for (const r of FACT_RULES) if (r.test(value)) err(file, path, `[fact:${r.id}] ${r.msg}`);
    return;
  }
  if (Array.isArray(value)) return value.forEach((v, i) => lintStrings(file, v, `${path}[${i}]`));
  if (!isObj(value)) return;
  for (const [k, v] of Object.entries(value)) {
    if (LINT_SKIP_KEYS.test(k)) continue;
    if (k === "choices" && Array.isArray(v) && isInt(value.correctIndex)) {
      if (v[value.correctIndex] !== undefined) lintStrings(file, v[value.correctIndex], `${path}.choices[${value.correctIndex}]`);
      continue;
    }
    lintStrings(file, v, `${path}.${k}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const research = existsSync(RESEARCH_FILE) ? loadJson(RESEARCH_FILE) : undefined;
if (!research) warn(RESEARCH_FILE, "$", "research file missing or unreadable; fact cross-checks skipped");

const lessonFiles = jsonFiles(LESSON_DIR);
if (lessonFiles.length === 0) err(LESSON_DIR, "$", "no lesson files found");
const lessonDocs = [];
for (const f of lessonFiles) {
  const L = loadJson(f);
  if (L === undefined) continue;
  checkLesson(f, L);
  lintStrings(f, L, "$");
  lessonDocs.push(L);
}
checkLessonGraph();

const workshopFiles = jsonFiles(WORKSHOP_DIR);
if (workshopFiles.length === 0) err(WORKSHOP_DIR, "$", "no workshop files found");
for (const f of workshopFiles) {
  const W = loadJson(f);
  if (W === undefined) continue;
  checkWorkshop(f, W);
  lintStrings(f, W, "$");
}
checkWorkshopLinks();

const exam = existsSync(EXAM_FILE) ? loadJson(EXAM_FILE) : (err(EXAM_FILE, "$", "question bank file is missing"), undefined);
if (exam !== undefined) {
  checkExam(EXAM_FILE, exam);
  lintStrings(EXAM_FILE, exam, "$");
}

const seedChecks = [
  ["apprenticeship_programs.json", (f, d) => checkPrograms(f, d)],
  ["certification_requirements.json", (f, d) => checkRequirements(f, d, research)],
  ["certification_facts.json", (f, d) => checkFacts(f, d, research)],
];
const seedCounts = {};
for (const [name, fn] of seedChecks) {
  const f = join(SEED_DIR, name);
  if (!existsSync(f)) {
    err(f, "$", "seed file is missing");
    continue;
  }
  const d = loadJson(f);
  if (d === undefined) continue;
  fn(f, d);
  lintStrings(f, d, "$");
  seedCounts[name] = Array.isArray(d) ? `${d.length} records` : "object";
}
for (const f of jsonFiles(SEED_DIR)) {
  if (!seedChecks.some(([n]) => join(SEED_DIR, n) === f)) {
    const d = loadJson(f);
    if (d !== undefined) lintStrings(f, d, "$");
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const byTrack = {};
let sectionCount = 0;
let practiceCount = 0;
let quizCount = 0;
let minutes = 0;
for (const L of lessonDocs) {
  byTrack[L.track] = (byTrack[L.track] ?? 0) + 1;
  sectionCount += Array.isArray(L.sections) ? L.sections.length : 0;
  practiceCount += Array.isArray(L.practice) ? L.practice.length : 0;
  quizCount += Array.isArray(L.quiz?.questions) ? L.quiz.questions.length : 0;
  minutes += isNum(L.estimatedMinutes) ? L.estimatedMinutes : 0;
}
let taskCount = 0;
for (const { data } of workshops.values()) taskCount += Array.isArray(data.tasks) ? data.tasks.length : 0;

const line = "-".repeat(72);
console.log(line);
console.log("CareerQuest Academy content validation");
console.log(line);
console.log(`Lessons:   ${lessonDocs.length} files, ${sectionCount} sections, ${practiceCount} practice items, ${quizCount} quiz questions, ${minutes} min total`);
console.log(`           by track: ${TRACKS.map((t) => `${t} ${byTrack[t] ?? 0}`).join(", ")}`);
console.log(`Workshop:  ${workshops.size} exercises, ${taskCount} tasks (every circuit solved numerically)`);
console.log(`Exam bank: ${examStats.total} questions; by area: ${Object.entries(examStats.byArea).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`           by difficulty: ${Object.entries(examStats.byDifficulty).sort().map(([k, v]) => `${k}: ${v}`).join(", ")}`);
console.log(`Seed:      ${Object.entries(seedCounts).map(([k, v]) => `${k} (${v})`).join(", ")}`);
console.log(`Ids:       ${globalIds.size} globally unique item/task/question ids`);
if (VERBOSE && solvedReport.length) {
  console.log(line);
  console.log("Solved workshop quantities:");
  for (const s of solvedReport) console.log(`  ${s}`);
}
const print = (label, list) => {
  if (!list.length) return;
  console.log(line);
  console.log(`${label} (${list.length}):`);
  const byFile = new Map();
  for (const e of list) byFile.set(e.file, [...(byFile.get(e.file) ?? []), e]);
  for (const [file, es] of byFile) {
    console.log(`  ${file}`);
    for (const e of es) console.log(`    ${e.path}: ${e.msg}`);
  }
};
print("WARNINGS", warnings);
print("ERRORS", errors);
console.log(line);
if (errors.length) {
  console.log(`FAIL: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`PASS: 0 errors, ${warnings.length} warning(s)`);
