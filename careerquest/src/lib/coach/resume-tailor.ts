/**
 * Résumé ↔ job-description keyword analysis and fact-preserving rewrite suggestions. Pure.
 *
 * Rules that keep suggestions honest:
 * - A suggestion never introduces a skill, employer, number or achievement that is not already in
 *   the résumé. It can only (a) point at an existing line to move up, (b) swap a term for an
 *   *equivalent* term from the posting (LOTO → lockout/tagout), keeping the original in parentheses,
 *   or (c) list skills the résumé already contains.
 * - Every suggestion is checked by `usesOnlyResumeFacts` before it is returned.
 * - Requirements the résumé does not mention are reported as gaps for the user to judge ("add only
 *   if true"), never written into a draft.
 */

export type Keyword = {
  /** Canonical key (stemmed tokens joined by spaces). */
  term: string;
  /** How the posting writes it. */
  display: string;
  /** Mentions in the posting. */
  count: number;
  weight: number;
  /** From the trade-term dictionary (with equivalent variants). */
  dictionary: boolean;
};

export type SuggestionKind = "emphasize" | "wording" | "skills_line";

export type Suggestion = {
  kind: SuggestionKind;
  original: string | null;
  suggested: string;
  reason: string;
  terms: string[];
};

export type FitAnalysis = {
  keywords: Keyword[];
  matched: Keyword[];
  missing: Keyword[];
  /** Weighted share of the posting's keywords found in the résumé, or null without keywords. */
  score: number | null;
  suggestions: Suggestion[];
};

/** Groups of *equivalent* terms. Only terms in the same group may replace each other. */
const TERM_GROUPS: Array<{ display: string; variants: string[] }> = [
  { display: "lockout/tagout", variants: ["lockout tagout", "lock out tag out", "loto"] },
  { display: "OSHA 10", variants: ["osha 10", "osha 10 hour", "osha10"] },
  { display: "OSHA 30", variants: ["osha 30", "osha 30 hour", "osha30"] },
  { display: "NEC", variants: ["nec", "national electrical code"] },
  { display: "conduit bending", variants: ["conduit bending", "bending conduit", "bend conduit"] },
  { display: "conduit", variants: ["conduit"] },
  { display: "blueprints", variants: ["blueprints", "blueprint", "blueprint reading", "construction drawings"] },
  { display: "schematics", variants: ["schematics", "schematic", "wiring diagrams", "wiring diagram"] },
  { display: "multimeter", variants: ["multimeter", "digital multimeter", "dmm"] },
  { display: "power tools", variants: ["power tools"] },
  { display: "hand tools", variants: ["hand tools"] },
  { display: "wire pulling", variants: ["wire pulling", "pulling wire", "pull wire"] },
  { display: "Microsoft Excel", variants: ["microsoft excel", "ms excel", "excel"] },
  { display: "Microsoft Office", variants: ["microsoft office", "ms office", "office 365", "microsoft 365"] },
  { display: "Microsoft Project", variants: ["microsoft project", "ms project"] },
  { display: "Procore", variants: ["procore"] },
  { display: "Bluebeam", variants: ["bluebeam"] },
  { display: "AutoCAD", variants: ["autocad"] },
  { display: "Revit", variants: ["revit"] },
  { display: "Primavera P6", variants: ["primavera p6", "primavera", "p6"] },
  { display: "Smartsheet", variants: ["smartsheet"] },
  { display: "QuickBooks", variants: ["quickbooks"] },
  { display: "RFIs", variants: ["rfis", "rfi", "requests for information", "request for information"] },
  { display: "submittals", variants: ["submittals", "submittal"] },
  { display: "change orders", variants: ["change orders", "change order"] },
  { display: "scheduling", variants: ["scheduling"] },
  { display: "estimating", variants: ["estimating", "cost estimating"] },
  { display: "takeoffs", variants: ["takeoffs", "takeoff", "quantity takeoff", "material takeoff"] },
  { display: "preventive maintenance", variants: ["preventive maintenance", "preventative maintenance"] },
  { display: "HVAC", variants: ["hvac", "heating ventilation and air conditioning"] },
  { display: "PLC", variants: ["plc", "plcs", "programmable logic controller", "programmable logic controllers"] },
  { display: "motor controls", variants: ["motor controls", "motor control"] },
  { display: "troubleshooting", variants: ["troubleshooting", "troubleshoot", "troubleshooted"] },
  { display: "low voltage", variants: ["low voltage"] },
  { display: "fire alarm", variants: ["fire alarm", "fire alarms"] },
  { display: "solar", variants: ["solar", "photovoltaic"] },
  { display: "forklift", variants: ["forklift", "fork lift"] },
  { display: "scissor lift", variants: ["scissor lift"] },
  { display: "boom lift", variants: ["boom lift"] },
  { display: "CPR", variants: ["cpr"] },
  { display: "first aid", variants: ["first aid"] },
  { display: "customer service", variants: ["customer service", "client service"] },
  { display: "driver's license", variants: ["drivers license", "driver license"] },
  { display: "PPE", variants: ["ppe", "personal protective equipment"] },
  { display: "safety", variants: ["safety"] },
  { display: "CMMS", variants: ["cmms", "computerized maintenance management system"] },
  { display: "welding", variants: ["welding"] },
  { display: "plumbing", variants: ["plumbing"] },
  { display: "algebra", variants: ["algebra"] },
  { display: "bilingual", variants: ["bilingual"] },
  { display: "Spanish", variants: ["spanish"] },
  { display: "teamwork", variants: ["teamwork", "team player"] },
  { display: "documentation", variants: ["documentation"] },
];

const STOPWORDS = new Set(
  (
    "a an and are as at be been being but by can could did do does for from had has have he her his how i if in into is it its may might must " +
    "my no not of on or our out over shall she should so some such than that the their them then there these they this those to under up us " +
    "very was we were what when where which while who will with within would you your yours also any all both each more most other only own same " +
    "too etc per via about above after again against before below between during further here just now off once through until " +
    "experience experienced ability able work worked working job jobs position positions candidate candidates required requirement requirements " +
    "require prefer preferred including include includes must team skill skills year years company companies benefit benefits opportunity pay paid " +
    "salary apply applicant applicants applying please equal employer employment role roles responsibility responsibilities responsible duty duties " +
    "related perform performs performing knowledge strong excellent good great new day days time full part hour hours week weekly based " +
    "ensure provide provides support help using use used various well like make makes need needs needed looking seeking join offer offers " +
    "opportunities qualification qualifications qualified minimum plus location locations california ca usa inc llc corp status type " +
    "other others one two three first within across today ideal successful environment level levels area areas including following " +
    "description summary title essential function functions physical demand demands lift lifting pounds lbs reasonable accommodation " +
    "disability veteran race color religion sex gender national origin age protected law laws applicable eoe compensation range dental vision " +
    "medical 401k insurance pto paid holidays holiday schedule shift shifts monday friday overtime hourly annual annually rate rates"
  ).split(/\s+/),
);

/** Stopwords compared after stemming ("including" → "includ"). */
const STOP_STEMS = new Set([...STOPWORDS].map((w) => stem(w)));

/** Single-word variants that are also ordinary English words; only swapped when capitalized ("Excel"). */
const AMBIGUOUS_VARIANTS = new Set(["excel", "solar", "safety"]);

/** Lowercase, strip accents, split into tokens on anything that isn't a letter, digit, + or #. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "s")
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Light suffix stripping so "installs", "installed" and "installing" compare equal. */
export function stem(token: string): string {
  let t = token;
  if (t.length > 5 && t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  else if (t.length > 4 && /(sses|xes|ches|shes)$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t;
}

function stems(text: string): string[] {
  return tokenize(text).map(stem);
}

function containsSeq(haystack: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return 0;
  let n = 0;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    n++;
  }
  return n;
}

type Group = { display: string; variants: string[][]; key: string };
const GROUPS: Group[] = TERM_GROUPS.map((g) => {
  const variants = g.variants.map((v) => stems(v));
  return { display: g.display, variants, key: variants[0]!.join(" ") };
});

const DICTIONARY_TOKENS = new Set(GROUPS.flatMap((g) => g.variants.flat()));

/** Which variant (index) of a group occurs most often in the token stream, and how often in total. */
function groupHits(tokens: readonly string[], g: Group): { total: number; best: number } {
  let total = 0;
  let best = -1;
  let bestCount = 0;
  g.variants.forEach((v, i) => {
    const c = containsSeq(tokens, v);
    total += c;
    if (c > bestCount) {
      best = i;
      bestCount = c;
    }
  });
  return { total, best };
}

function surfaceForm(text: string, stemToken: string): string {
  for (const raw of text.match(/[A-Za-z][A-Za-z0-9+#]*/g) ?? []) if (stem(raw.toLowerCase()) === stemToken) return raw;
  return stemToken;
}

/** The posting's most important keywords: trade-dictionary terms first, then repeated words and pairs. */
export function extractKeywords(jobDescription: string, limit = 20): Keyword[] {
  const tokens = stems(jobDescription);
  const out: Keyword[] = [];
  const covered = new Set<string>();
  for (const g of GROUPS) {
    const { total } = groupHits(tokens, g);
    if (total === 0) continue;
    out.push({ term: g.key, display: g.display, count: total, weight: total * 2 + 3, dictionary: true });
    for (const v of g.variants) for (const t of v) covered.add(t);
  }
  const useful = (t: string) => t.length >= 4 && /^[a-z]/.test(t) && !STOP_STEMS.has(t) && !covered.has(t) && !DICTIONARY_TOKENS.has(t);
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    if (useful(a)) uni.set(a, (uni.get(a) ?? 0) + 1);
    const b = tokens[i + 1];
    if (b && useful(a) && useful(b)) bi.set(`${a} ${b}`, (bi.get(`${a} ${b}`) ?? 0) + 1);
  }
  const usedInBigram = new Set<string>();
  for (const [k, c] of [...bi.entries()].sort((x, y) => y[1] - x[1])) {
    if (c < 2) continue;
    const [a, b] = k.split(" ") as [string, string];
    out.push({ term: k, display: `${surfaceForm(jobDescription, a)} ${surfaceForm(jobDescription, b)}`.toLowerCase(), count: c, weight: c * 2, dictionary: false });
    usedInBigram.add(a);
    usedInBigram.add(b);
  }
  for (const [k, c] of uni) {
    if (c < 2 || usedInBigram.has(k)) continue;
    out.push({ term: k, display: surfaceForm(jobDescription, k).toLowerCase(), count: c, weight: c, dictionary: false });
  }
  return out.sort((a, b) => b.weight - a.weight || a.display.localeCompare(b.display)).slice(0, limit);
}

/** Is a keyword (or an equivalent variant) present in a token stream? */
function keywordIn(tokens: readonly string[], kw: Keyword): boolean {
  if (kw.dictionary) {
    const g = GROUPS.find((x) => x.key === kw.term);
    return g ? groupHits(tokens, g).total > 0 : false;
  }
  return containsSeq(tokens, kw.term.split(" ")) > 0;
}

/** Résumé lines that read like content (bullets or sentences), without bullet markers. */
export function resumeLines(resume: string): string[] {
  return resume
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•▪◦·‣]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.split(/\s+/).length >= 4 && l.length <= 300);
}

function variantRegex(variant: string[]): RegExp {
  // Match the raw words of a variant in original text: allow spaces, slashes or hyphens between words
  // and the suffix forms the stemmer strips.
  const parts = variant.map((t) => `${t.replace(/[+#]/g, "\\$&")}(?:'?s|es|ed|ing)?`);
  return new RegExp(`\\b${parts.join("[\\s/-]+")}\\b`, "i");
}

/**
 * True when every word and number in `suggested` already appears in the résumé, apart from the
 * posting's wording for terms the résumé expresses with an equivalent variant (`allowedTerms`).
 */
export function usesOnlyResumeFacts(suggested: string, resume: string, allowedTerms: readonly string[] = []): boolean {
  const resumeTokens = new Set(stems(resume));
  for (const term of allowedTerms) for (const t of stems(term)) resumeTokens.add(t);
  const structural = new Set(["skill", "skills"]);
  for (const t of stems(suggested)) {
    if (structural.has(t) || STOP_STEMS.has(t) || t.length < 2) continue;
    if (!resumeTokens.has(t)) return false;
  }
  const resumeNumbers = new Set(resume.match(/\d+(?:[.,]\d+)?/g) ?? []);
  for (const n of suggested.match(/\d+(?:[.,]\d+)?/g) ?? []) if (!resumeNumbers.has(n)) return false;
  return true;
}

export function analyzeFit(jobDescription: string, resume: string, opts: { limit?: number } = {}): FitAnalysis {
  const keywords = extractKeywords(jobDescription, opts.limit ?? 20);
  const resumeTokens = stems(resume);
  const matched = keywords.filter((k) => keywordIn(resumeTokens, k));
  const missing = keywords.filter((k) => !keywordIn(resumeTokens, k));
  const total = keywords.reduce((s, k) => s + k.weight, 0);
  const score = total > 0 ? matched.reduce((s, k) => s + k.weight, 0) / total : null;

  const suggestions: Suggestion[] = [];
  const jdTokens = stems(jobDescription);
  const lines = resumeLines(resume);
  const allowed: string[] = [];

  // (b) Equivalent wording: the résumé says LOTO, the posting says lockout/tagout.
  for (const kw of matched.filter((k) => k.dictionary)) {
    const g = GROUPS.find((x) => x.key === kw.term);
    if (!g || g.variants.length < 2) continue;
    const jdBest = groupHits(jdTokens, g).best;
    if (jdBest < 0) continue;
    const jdVariant = g.variants[jdBest]!;
    if (containsSeq(resumeTokens, jdVariant) > 0) continue; // résumé already uses the posting's wording
    const jdWording = surfaceFromText(jobDescription, jdVariant) ?? g.display;
    for (const line of lines) {
      const lineTokens = stems(line);
      const vIdx = g.variants.findIndex((v, i) => i !== jdBest && containsSeq(lineTokens, v) > 0);
      if (vIdx < 0) continue;
      const re = variantRegex(g.variants[vIdx]!);
      const m = line.match(re);
      if (!m) continue;
      if (/^[a-z]/.test(m[0]) && AMBIGUOUS_VARIANTS.has(m[0].toLowerCase())) continue;
      const suggested = line.replace(re, `${jdWording} (${m[0]})`);
      allowed.push(jdWording);
      suggestions.push({
        kind: "wording",
        original: line,
        suggested,
        reason: `The posting says "${jdWording}"; your résumé says "${m[0]}". Same skill, the posting's wording first.`,
        terms: [g.display],
      });
      break;
    }
  }

  // (a) Lines that already match the posting: lead with them.
  const scored = lines
    .map((line, i) => {
      const t = stems(line);
      const hits = keywords.filter((k) => keywordIn(t, k));
      return { line, i, hits, weight: hits.reduce((s, k) => s + k.weight, 0) };
    })
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i)
    .slice(0, 3);
  for (const s of scored) {
    suggestions.push({
      kind: "emphasize",
      original: s.line,
      suggested: s.line,
      reason: `Matches the posting's ${s.hits.length === 1 ? "term" : "terms"} ${s.hits.map((h) => `"${h.display}"`).join(", ")}. Move it near the top of its section.`,
      terms: s.hits.map((h) => h.display),
    });
  }

  // (c) A skills line built only from skills the résumé already has.
  const skillTerms = matched.filter((k) => k.dictionary).map((k) => k.display);
  if (skillTerms.length >= 2) {
    suggestions.push({
      kind: "skills_line",
      original: null,
      suggested: `Skills: ${skillTerms.slice(0, 10).join(", ")}`,
      reason: "Every item is already in your résumé and also in the posting; listing them together near the top makes them easy to spot.",
      terms: skillTerms.slice(0, 10),
    });
    for (const k of matched.filter((x) => x.dictionary)) allowed.push(k.display);
  }

  const safe = suggestions.filter((s) => usesOnlyResumeFacts(s.suggested, resume, allowed));
  return { keywords, matched, missing, score, suggestions: safe };
}

function surfaceFromText(text: string, variant: string[]): string | null {
  const m = text.match(variantRegex(variant));
  return m ? m[0] : null;
}

export type GapRow = { display: string; postings: number; inResume: boolean };

/** Requirements across several postings: how many postings mention each, and whether the résumé does. */
export function aggregateGaps(postings: readonly { jobDescription: string }[], resume: string | null, limit = 12): GapRow[] {
  const resumeTokens = resume ? stems(resume) : [];
  const rows = new Map<string, GapRow>();
  for (const p of postings) {
    const seen = new Set<string>();
    for (const k of extractKeywords(p.jobDescription, 25)) {
      if (seen.has(k.term)) continue;
      seen.add(k.term);
      const row = rows.get(k.term) ?? { display: k.display, postings: 0, inResume: resume ? keywordIn(resumeTokens, k) : false };
      row.postings++;
      rows.set(k.term, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.postings - a.postings || a.display.localeCompare(b.display)).slice(0, limit * 2);
}
