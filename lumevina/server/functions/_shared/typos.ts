// Texting shorthand and typos, read as the words the client meant, before the
// hand-off rules run (the website does the same in js/ask-typos.js; the word
// lists come from there through knowledge/scripts/build-bundle.mjs, so both
// sides read "pregnent", "brazillian" and "b4 my appt" the same way).
// Claude itself reads the client's message as typed.

import { TYPOS } from "./knowledge.ts";

const KNOWN = new Set([...TYPOS.vocab, ...TYPOS.common]);
const SHORT: Record<string, string> = TYPOS.short;
const SYMBOLS: [RegExp, string][] = [[/\bw\/o\b/g, " without "], [/\bw\/(?=\s|$)/g, " with "], [/\bb\/c\b/g, " because "], [/&/g, " and "], [/\+/g, " plus "]];

// edit distance, counting a swapped pair of letters as one edit
const dist = (a: string, b: string) => {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
};

// the closest known word, if there's exactly one close enough
const closest = (w: string): string | null => {
  if (w.length < 4 || KNOWN.has(w)) return null;
  const max = w.length >= 7 ? 2 : 1;
  let best: string | null = null, bestD = max + 1, tie = false;
  for (const v of TYPOS.vocab) {
    if (Math.abs(v.length - w.length) > max) continue;
    const dd = dist(w, v);
    if (dd > 1 && v[0] !== w[0]) continue;
    if (dd < bestD) { best = v; bestD = dd; tie = false; }
    else if (dd === bestD && v !== best) tie = true;
  }
  return best && !tie ? best : null;
};

/** Lower-cased, shorthand expanded, misspelled topic words corrected. */
export const fixTypos = (text: string) => {
  let t = String(text ?? "").toLowerCase();
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);
  return t.replace(/[a-z0-9']+/g, (w) => {
    const bare = w.replace(/'/g, "");
    if (Object.prototype.hasOwnProperty.call(SHORT, w)) return SHORT[w];
    if (w.includes("'")) return w;
    if (Object.prototype.hasOwnProperty.call(SHORT, bare)) return SHORT[bare];
    const squeezed = w.replace(/([a-z])\1{2,}/g, "$1$1");
    if (squeezed !== w) {
      const single = squeezed.replace(/(.)\1/g, "$1");
      if (KNOWN.has(squeezed)) return squeezed;
      if (KNOWN.has(single)) return single;
    }
    return /^[a-z]+$/.test(w) ? (closest(w) ?? w) : w;
  }).replace(/\s{2,}/g, " ").trim();
};
