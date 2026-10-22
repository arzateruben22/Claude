/**
 * Application checklist for a saved apprenticeship program. Pure.
 *
 * Generated from the program's eligibility list and process steps plus the standard documents most
 * electrical apprenticeships ask for (diploma/GED, algebra transcript, photo ID, résumé, and a DMV
 * printout only when the program lists one). Items the research marked "not stated" or
 * "unverified" become "Ask the program: …" so the checklist never implies a requirement is known.
 *
 * Item ids are a stable hash of the source text, so re-generating after the seed changes keeps the
 * user's ticks on unchanged items.
 */

export type ChecklistSource = "eligibility" | "process" | "document";

export type ChecklistItem = {
  id: string;
  label: string;
  source: ChecklistSource;
  /** True when the requirement could not be verified and must be confirmed with the program. */
  confirm: boolean;
  done: boolean;
  /** ISO timestamp of when it was ticked. */
  doneAt: string | null;
};

const MAX_ITEMS = 60;
const MAX_LABEL = 400;

/** 32-bit FNV-1a, hex. Stable across server and client. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

const UNCERTAIN = /\b(unverified|not stated|not found|not explicitly|not retrieved|not confirmed)\b/i;

function itemFrom(source: ChecklistSource, text: string): Omit<ChecklistItem, "done" | "doneAt"> {
  const clean = normalize(text);
  const confirm = UNCERTAIN.test(clean);
  const label = confirm ? `Ask the program: ${clean}` : clean;
  return { id: `${source[0]}-${fnv1a(`${source}:${clean.toLowerCase()}`)}`, label: label.slice(0, MAX_LABEL), source, confirm };
}

export const STANDARD_DOCUMENTS: readonly { key: string; label: string; onlyWhen?: RegExp }[] = [
  { key: "diploma", label: "Copy of your high school diploma, GED or college degree (official transcripts if the program asks)" },
  { key: "algebra", label: "Transcript showing algebra completed with a C or better" },
  { key: "photo-id", label: "Valid government-issued photo ID" },
  { key: "dmv", label: "DMV printout of your driving record (K4 / H6)", onlyWhen: /\b(dmv|k4|h6)\b|driving record printout/i },
  { key: "resume", label: "Up-to-date résumé" },
];

export function buildProgramChecklist(program: { eligibility: readonly string[]; processSteps: readonly string[] }): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const seen = new Set<string>();
  const push = (item: Omit<ChecklistItem, "done" | "doneAt">) => {
    if (seen.has(item.id) || out.length >= MAX_ITEMS) return;
    seen.add(item.id);
    out.push({ ...item, done: false, doneAt: null });
  };
  for (const e of program.eligibility) if (normalize(e)) push(itemFrom("eligibility", e));
  for (const s of program.processSteps) if (normalize(s)) push(itemFrom("process", s));
  const allText = [...program.eligibility, ...program.processSteps].join(" \n ");
  for (const doc of STANDARD_DOCUMENTS) {
    if (doc.onlyWhen && !doc.onlyWhen.test(allText)) continue;
    push({ id: `d-${doc.key}`, label: doc.label, source: "document", confirm: false });
  }
  return out;
}

/** Read a stored checklist JSON value defensively (unknown shapes are dropped). */
export function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  for (const v of raw) {
    if (typeof v !== "object" || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.label !== "string") continue;
    const source = o.source === "eligibility" || o.source === "process" || o.source === "document" ? o.source : "document";
    out.push({
      id: o.id.slice(0, 64),
      label: o.label.slice(0, MAX_LABEL),
      source,
      confirm: o.confirm === true,
      done: o.done === true,
      doneAt: typeof o.doneAt === "string" ? o.doneAt : null,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** Regenerated items with the user's existing ticks carried over by id. */
export function mergeChecklist(saved: readonly ChecklistItem[], generated: readonly ChecklistItem[]): ChecklistItem[] {
  const byId = new Map(saved.map((i) => [i.id, i]));
  return generated.map((g) => {
    const prev = byId.get(g.id);
    return prev ? { ...g, done: prev.done, doneAt: prev.doneAt } : g;
  });
}

export function setChecklistItem(items: readonly ChecklistItem[], id: string, done: boolean, now: Date): { items: ChecklistItem[]; found: boolean } {
  let found = false;
  const next = items.map((i) => {
    if (i.id !== id) return i;
    found = true;
    return { ...i, done, doneAt: done ? now.toISOString() : null };
  });
  return { items: next, found };
}

export function checklistProgress(items: readonly ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

export const CHECKLIST_SOURCE_LABELS: Record<ChecklistSource, string> = {
  eligibility: "Eligibility",
  process: "Application steps",
  document: "Documents to have ready",
};
