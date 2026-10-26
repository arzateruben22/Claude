// Written forms for written copy. The narration is written for the voice ("In twenty seventeen, we caught…"); a caption
// or a description reads better with the forms a reader expects: years, percentages and large numbers in digits.
// Deliberately conservative: only what can be read one way changes. Small counts ("one", "twenty swings"), fractions
// ("a third", "half", "three tenths"), a bare "a thousand" / "a million", ordinals, dates, times and anything joined by a
// hyphen ("two-thousand-year-old") stay in words. Pure and deterministic. Used on the narration only: never on titles
// (their *starred* words included), sources or hashtags.

const map = (o: Record<string, number>) => new Map(Object.entries(o));
const UNIT = map({ zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 });
const TENS = map({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 });
const SCALE = map({ thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 });
const DIGIT = map({ zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 });
const DECADE = map({ twenties: 20, thirties: 30, forties: 40, fifties: 50, sixties: 60, seventies: 70, eighties: 80, nineties: 90 });
/** The first half of a spoken year: thirteen…nineteen (1300s–1900s) and twenty (2000s). Ten to twelve are left out: "at
 *  eleven fifteen" is a time. */
const CENTURY = map({ thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 });
/** A spoken year is turned into digits only after one of these words ("In twenty seventeen", "since nineteen ninety"). */
const YEAR_CONTEXT = new Set(["in", "since", "from", "during", "circa", "year", "until", "till", "before", "after", "by", "around",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]);
/** Words that make a "year" a count instead ("in twenty fifteen minutes" is not 2015). "and" too, unless another year
 *  follows it ("during nineteen eighteen and nineteen nineteen"). */
const NOT_AFTER_YEAR = /^(years?|days?|weeks?|months?|hours?|minutes?|seconds?|times|percent|per|hundred|thousand|million|billion|trillion|and)$/;
/** A spoken pair ("nineteen twelve") followed by a word is a year only before one of these, or a name ("In nineteen
 *  sixty-nine Apollo…"); before any other word it may be a count ("in nineteen twelve patients") and stays in words. */
const YEAR_FOLLOW = new Set(["the", "a", "an", "when", "while", "where", "we", "it", "its", "they", "he", "she", "i", "you", "this", "that", "these", "those",
  "there", "his", "her", "their", "our", "as", "at", "on", "in", "into", "to", "for", "with", "by", "from", "after", "before", "during", "until", "but", "or",
  "so", "then", "alone", "too", "also", "already", "still", "only"]);
const ORDINAL = /(^|-)(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|[a-z]+teenth|[a-z]+tieth|hundredth|thousandth|millionth|billionth|trillionth)$/;

type Tok = { w: string; start: number; end: number };

/** 0–99 from one word: "seven", "seventeen", "seventy", "seventy-one". */
function small(w: string): number | null {
  const u = UNIT.get(w) ?? TENS.get(w);
  if (u !== undefined) return u;
  const m = /^([a-z]+)-([a-z]+)$/.exec(w), t = m ? TENS.get(m[1]) : undefined, o = m ? UNIT.get(m[2]) : undefined;
  return t !== undefined && o !== undefined && o >= 1 && o <= 9 ? t + o : null;
}

const fmt = (n: number) => (n >= 1000 ? n.toLocaleString("en-US") : String(n));

export function writtenForms(text: string): string {
  const toks: Tok[] = [...text.matchAll(/[A-Za-z]+(?:-[A-Za-z]+)*/g)].map((m) => ({ w: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length }));
  /** the next word when only a single space separates it from token k */
  const next = (k: number) => (k + 1 < toks.length && text.slice(toks[k].end, toks[k + 1].start) === " " ? toks[k + 1].w : "");
  const joined = (k: number) => next(k - 1) !== "";
  const prev = (k: number) => (k > 0 && joined(k) ? toks[k - 1].w : "");
  const sentenceStart = (k: number) => /(^|[.!?:]\s+)$/.test(text.slice(0, toks[k].start));
  /** nothing after token k but punctuation (or the end of the text) */
  const stops = (k: number) => /^([,.;:!?…)]|\s*$)/.test(text.slice(toks[k].end));
  /** token k starts with a capital and doesn't open a sentence: a name */
  const name = (k: number) => k < toks.length && /^[A-Z]/.test(text[toks[k].start]) && !sentenceStart(k);

  // "In twenty seventeen" → 2017, "in nineteen sixty-nine" → 1969, "in nineteen oh five" → 1905, "in sixteen hundred," → 1600,
  // "in two thousand and eight," → 2008. Returns the index after the year's last token. `chained`: the year right after
  // "and" in "nineteen eighteen and nineteen nineteen", which takes the first one's year word.
  const year = (i: number, chained = false): { end: number; out: string } | null => {
    const ctx = chained || YEAR_CONTEXT.has(prev(i));
    const c = CENTURY.get(toks[i].w);
    let y: number | null = null, end = i + 1, strict = false, pair = false;
    if (c !== undefined && next(i)) {
      const w1 = next(i), n1 = small(w1);
      if (w1 === "hundred" && c < 20) {
        y = 0; end = i + 2; strict = true;
        if (next(i + 1) === "and" && (small(next(i + 2)) ?? 0) >= 1) { y = small(next(i + 2))!; end = i + 4; }
      } else if ((w1 === "oh" || w1 === "o") && (UNIT.get(next(i + 1)) ?? 0) >= 1 && UNIT.get(next(i + 1))! <= 9) {
        y = UNIT.get(next(i + 1))!; end = i + 3;
      } else if (n1 !== null && n1 >= 10) {
        y = n1; end = i + 2; pair = true;
        const o = UNIT.get(next(i + 1));
        if (TENS.has(w1) && o !== undefined && o >= 1 && o <= 9) { y += o; end = i + 3; }   // "nineteen sixty nine"
      }
      if (y === null) return null;
      const after = next(end - 1);
      const andYear = after === "and" && next(end) !== "" && year(end + 1, true) !== null;
      if (!andYear && (NOT_AFTER_YEAR.test(after) || ORDINAL.test(after))) return null;
      if (!ctx && !(sentenceStart(i) && /^[,:]/.test(text.slice(toks[end - 1].end)))) return null;
      if (strict && !stops(end - 1)) return null;
      if (pair && after && !andYear && !YEAR_FOLLOW.has(after) && !name(end)) return null;   // "in nineteen twelve patients"
      return { end, out: String(c! * 100 + y) };
    }
    if (toks[i].w === "two" && next(i) === "thousand" && ctx) {   // 2000–2099, only when nothing but punctuation follows
      y = 0; end = i + 2;
      if (next(i + 1) === "and" && (small(next(i + 2)) ?? 0) >= 1) { y = small(next(i + 2))!; end = i + 4; }
      else if ((small(next(i + 1)) ?? 0) >= 1) { y = small(next(i + 1))!; end = i + 3; }
      const o = UNIT.get(next(end - 1));
      if (TENS.has(toks[end - 1].w) && y >= 20 && o !== undefined && o >= 1 && o <= 9) { y += o; end += 1; }
      return stops(end - 1) ? { end, out: String(2000 + y) } : null;
    }
    return null;
  };

  // "the eighteen-forties" / "the nineteen sixties" → the 1840s / the 1960s
  const decade = (i: number): { end: number; out: string } | null => {
    if (!["the", "early", "late", "mid"].includes(prev(i))) return null;
    const m = /^([a-z]+)-([a-z]+)$/.exec(toks[i].w);
    const [c, d, end] = m ? [CENTURY.get(m[1]), DECADE.get(m[2]), i + 1] : [CENTURY.get(toks[i].w), DECADE.get(next(i)), i + 2];
    return c !== undefined && d !== undefined ? { end, out: `${c * 100 + d}s` } : null;
  };

  // A cardinal: "a hundred and thirty million", "twenty-seven thousand", "sixteen hundred seventy", "one point three million".
  const cardinal = (i: number) => {
    let total = 0, group = 0, groupText = "", lastScale = Infinity, hundred = false, kind = "start", end = i, big = false, aStart = false;
    let topScale = 0, topWord = "", afterTop = false, decimal = false;
    for (let j = i; j < toks.length; j++) {
      if (j > i && !joined(j)) break;
      const w = toks[j].w, n = small(w), sc = SCALE.get(w);
      if (w === "a" && kind === "start") {
        if (next(j) !== "hundred" && !SCALE.has(next(j))) break;
        group = 1; kind = "a"; aStart = true; continue;
      }
      if (n !== null) {
        if (kind === "tens" && UNIT.has(w) && n >= 1 && n <= 9) { group += n; kind = "small"; end = j + 1; continue; }   // "forty two"
        if (!["start", "and", "scale", "hundred"].includes(kind) || ((kind === "hundred" || kind === "and") && group % 100 !== 0)) break;
        group += n; kind = TENS.has(w) ? "tens" : "small"; end = j + 1;
        if (topScale) afterTop = true;
        continue;
      }
      if (w === "hundred" && kind === "start" && next(j) === "and" && small(next(j + 1)) !== null) {   // "every hundred and seventeen days"
        group = 100; hundred = true; big = true; kind = "hundred"; end = j + 1; continue;
      }
      if (w === "hundred") {
        if (!["small", "tens", "a"].includes(kind) || hundred || group < 1 || group > 99) break;
        group *= 100; hundred = true; big = true; kind = "hundred"; end = j + 1; continue;
      }
      if (w === "point" && ["start", "small", "tens"].includes(kind) && !hundred && total === 0) {
        // decimals only before million/billion/trillion or "percent": "one point three million", "point five percent"
        let k = j + 1, digits = "";
        while (k < toks.length && joined(k) && DIGIT.has(toks[k].w)) digits += DIGIT.get(toks[k++].w);
        const after = k < toks.length && joined(k) ? toks[k].w : "";
        if (!digits || !(["million", "billion", "trillion", "percent"].includes(after) || (after === "per" && next(k) === "cent"))) break;
        groupText = `${group}.${digits}`; group = Number(groupText); decimal = true; kind = "point"; end = k; j = k - 1; continue;
      }
      if (sc !== undefined) {
        if (!["small", "tens", "a", "hundred", "point"].includes(kind) || group <= 0 || sc >= lastScale) break;
        if (decimal && sc < 1e6) break;
        if (!topScale) { topScale = sc; topWord = w; groupText = groupText || String(group); }
        total += group * sc; group = 0; lastScale = sc; hundred = false; big = true; kind = "scale"; end = j + 1; continue;
      }
      if (w === "and" && (kind === "hundred" || kind === "scale") && small(next(j)) !== null) { kind = "and"; continue; }
      break;
    }
    if (end === i) return null;
    const value = total + group;
    const nw = end < toks.length && joined(end) ? toks[end].w : "";
    const percent = nw === "percent" ? 1 : nw === "per" && next(end) === "cent" ? 2 : 0;
    let out: string;
    if (topScale >= 1e6 && !afterTop && group === 0) out = `${decimal ? groupText : fmt(Number(groupText))} ${topWord}`;   // "130 million", "1.3 million"
    else if (decimal && !percent) return { end, out: null };
    else out = decimal ? String(value) : fmt(value);
    const bare = aStart && end === i + 2;   // "a thousand", "a million": words read better
    const ordinalNext = ORDINAL.test(nw) || (nw === "and" && ORDINAL.test(next(end)));
    if (percent) return { end: end + percent, out: `${out}%` };
    return { end, out: big && !bare && !ordinalNext ? out : null };
  };

  const edits: { start: number; end: number; out: string }[] = [];
  let yearEnd = -1;   // the token after the last year written ("and" in "nineteen eighteen and nineteen nineteen")
  for (let i = 0; i < toks.length;) {
    const y = year(i, i === yearEnd + 1 && toks[yearEnd]?.w === "and" && joined(i));
    const r = decade(i) ?? y;
    if (r) { edits.push({ start: toks[i].start, end: toks[r.end - 1].end, out: r.out }); if (r === y) yearEnd = r.end; i = r.end; continue; }
    const c = cardinal(i);
    if (c?.out) edits.push({ start: toks[i].start, end: toks[c.end - 1].end, out: c.out });
    i = c ? c.end : i + 1;
  }
  let out = text;
  for (const e of edits.reverse()) out = out.slice(0, e.start) + e.out + out.slice(e.end);
  return out.replace(/(\d)\s?(?:percent|per cent)\b/gi, "$1%");   // "50 percent" → "50%"
}
