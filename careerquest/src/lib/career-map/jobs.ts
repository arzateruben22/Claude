/**
 * Matching tracked applications to Career Map stops by job title. Phrases match at the start of a
 * word, case-insensitively ("electric" matches "Electrician" and "Electrical"), against
 * "<position title> <job category>". Pure.
 */
import type { JobMatchSpec } from "./types";

/** Words that mark an entry-level posting (apprentice, helper, …). */
export const ENTRY_LEVEL_TERMS = [
  "apprentice",
  "trainee",
  "helper",
  "pre-apprentice",
  "preapprentice",
  "pre apprentice",
  "assistant",
  "junior",
  "entry level",
  "entry-level",
  "intern",
] as const;

const cache = new Map<string, RegExp>();

function phraseRegex(phrase: string): RegExp {
  const key = phrase.toLowerCase();
  let re = cache.get(key);
  if (!re) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]*");
    re = new RegExp(`(?:^|[^a-z0-9])${escaped}`, "i");
    cache.set(key, re);
  }
  return re;
}

const anyPhrase = (text: string, phrases: readonly string[]) => phrases.some((p) => phraseRegex(p).test(text));

export function jobText(title: string, category?: string | null): string {
  return `${title} ${category ?? ""}`.toLowerCase();
}

export function matchesJob(text: string, spec: JobMatchSpec | null): boolean {
  if (!spec || !spec.include.length) return false;
  const t = text.toLowerCase();
  if (!anyPhrase(t, spec.include)) return false;
  if (spec.require?.length && !anyPhrase(t, spec.require)) return false;
  if (spec.exclude?.length && anyPhrase(t, spec.exclude)) return false;
  return true;
}
