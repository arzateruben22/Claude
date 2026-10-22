/**
 * Field extraction for job-search email: employer, position title, requisition number, recruiter,
 * location, pay text and the application/posting link.
 *
 * Every extractor collects candidates from independent cues (labeled fields, phrase anchors, the
 * sender's display name, signature blocks, subject segments, job-card layouts), scores them and only
 * returns a value that some cue actually supports. When nothing supports a value it stays null — the
 * extractors never guess.
 */
import { extractRequisitionId, normalizeCompany, normalizeTitle, normalizeUrl } from "@/lib/applications/normalize";
import type { EmailLink } from "./html";
import { PLATFORM_NAMES } from "./platforms";

export type ExtractionInput = {
  subject: string;
  /** Main body: quoted replies removed, forwarded content unwrapped, URLs removed, soft-wrapped lines joined. */
  body: string;
  fromName: string | null;
  fromAddress: string | null;
  replyTo: string | null;
  toAddress: string | null;
  links: EmailLink[];
};

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------

/** Head nouns of job titles (singular, lower-case). Used to validate weakly-anchored title candidates. */
const ROLE_NOUNS = new Set(
  (
    "electrician apprentice apprenticeship helper technician tech engineer coordinator manager estimator pipefitter " +
    "fitter mechanic trainee installer operator specialist assistant wireman laborer labourer foreman forewoman " +
    "supervisor inspector welder plumber carpenter painter machinist driver clerk associate analyst developer " +
    "designer representative rep administrator agent officer lead director worker journeyman journeyworker nurse " +
    "teacher accountant consultant architect scientist programmer superintendent dispatcher scheduler planner buyer " +
    "cashier attendant mover handler loader assembler fabricator millwright lineman lineworker groundman " +
    "groundworker controller instructor advisor coach receptionist secretary bookkeeper estimator surveyor " +
    "drafter draftsman steamfitter sprinklerfitter ironworker boilermaker glazier roofer mason bricklayer " +
    "custodian janitor porter cook chef server barista bartender host housekeeper guard " +
    "officer firefighter paramedic emt therapist pharmacist physician dentist hygienist intern internship " +
    "coordinator generalist recruiter sourcer"
  ).split(/\s+/),
);

/** Words that make a capitalized run a department/team/generic label rather than an organization. */
const ORG_GENERIC = new Set(
  (
    "team talent acquisition recruiting recruitment hiring human resources hr careers career department people " +
    "operations candidate candidates home portal office manager job jobs position application applications status " +
    "update updates notification notifications support help center no reply noreply mail email services staff " +
    "inbox dear hi hello thanks thank you your our my the we"
  ).split(/\s+/),
);

const STOP_TOKENS = new Set(
  (
    "I We Our Your You My He She They It This That These Those Thank Thanks Please If When Once Dear Hi Hello Hey " +
    "Sincerely Best Regards Cheers Apply View See Click Learn Unsubscribe Here There Good Great Congratulations " +
    "Note Tip Questions Need Visit Contact Call Reply Today Tomorrow Yesterday Monday Tuesday Wednesday Thursday " +
    "Friday Saturday Sunday January February March April June July August September October November December " +
    "Re Fwd Fw Subject From To Date Sent Cc Applicant Applicants Candidate Candidates Status Location Position " +
    "Interviewers Interviewer Deadline Format When Where Join Meeting Passcode Dial Pay Shift Details Summary " +
    "Track Check Go Start Complete Finish Keep Explore Find Search Manage Edit Update Remove Download Add"
  ).split(/\s+/),
);

const ORG_CONNECTORS = new Set(["of", "and", "&", "the", "de", "du", "la", "y", "for"]);
const ABBREVIATION = /^(co|inc|corp|ltd|llc|l\.l\.c|bros|mfg|intl|assn|plc|p\.c|n\.a|jr|sr|st)\.$/i;
const INITIALS = /^([A-Z]\.){1,3}$/;

/** Department/team suffixes stripped from the end of an organization name. */
const DEPT_SUFFIX =
  /\s+(talent acquisition|talent team|talent|recruiting team|recruiting|recruitment team|recruitment|careers? team|careers?|career site|hiring team|human resources( department| team)?|hr( team| department)?|people operations|people team|team|jobs)$/i;

// ---------------------------------------------------------------------------------------------
// Tokenizing helpers
// ---------------------------------------------------------------------------------------------

type Token = { text: string; start: number; end: number };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/\S+/g)) out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length });
  return out;
}

function isCapToken(tok: string): boolean {
  return /^(?:\p{Lu}[\p{L}\p{N}_&'’./+-]*|\d+\p{L}[\p{L}\p{N}_-]*)$/u.test(tok) && /\p{L}/u.test(tok);
}

function singular(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ss")) return w;
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

function hasRoleNoun(title: string): boolean {
  const words = title.split(/[\s/]+/).filter(Boolean);
  const last = words[words.length - 1];
  return !!last && ROLE_NOUNS.has(singular(last));
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Join hard-wrapped lines (long line without terminal punctuation followed by a continuation). */
export function softUnwrap(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (
      prev !== undefined &&
      prev.length >= 55 &&
      line.trim() &&
      !/[.:!?;]$/.test(prev) &&
      /^[a-z(0-9$&]|^[A-Z][a-z]/.test(line.trim()) &&
      !/^[-*•]\s/.test(line.trim())
    ) {
      out[out.length - 1] = `${prev} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Person names
// ---------------------------------------------------------------------------------------------

const PERSON_BLOCKERS =
  /\b(plumbing|roofing|trucking|painting|printing|marketing|landscaping|contracting|cleaning|heating|cooling|welding|drilling|mining|shipping|packaging|catering|lighting|flooring|fencing|paving|housing|nursing|banking|publishing|recycling|machining|framing|glazing|excavating|grading|hauling|towing|moving|storage|hvac|electric|aerospace|components?|storage|cold|logistics|manufacturing|industries|industrial|construction|contractors?|contracting|plumbing|heating|air|power|energy|solar|utilities|realty|properties|property|management|health|healthcare|hospital|medical|clinic|bank|financial|insurance|foods?|markets?|transport|transportation|trucking|engineering|design|consulting|labs?|laboratories|studios?|media|networks?|communications|telecom|software|tech|technology|digital|global|international|national|american|coast|coastal|western|eastern|northern|southern|southland|valley|metro|works|supply|supplies|equipment|machinery|tools|materials|steel|metals?|elevators?|building|homes|development|developers|associates|capital|ventures|enterprises|brands|retail|stores?|motors|automotive|rail|airlines|aviation|marine|port|harbor|cabling|wireless|security|services|academy|institute|trade|careers?|hr|team|talent|recruiting|recruitment|careers?|hr|human|resources|services|electric|electrical|mechanical|builders|partners|inc|llc|ltd|corp|company|co|group|holdings|solutions|systems|technologies|agency|administration|city|county|state|department|office|committee|college|university|school|center|jatc|union|staffing|hiring|people|operations|support|notifications?|alerts?|jobs|indeed|linkedin|workday|ziprecruiter|glassdoor|usajobs|greenhouse|lever|icims|adp|hirevue|smartrecruiters|calendly|applicant|candidate|manager|recruiter|coordinator|generalist|partner|lead|director|specialist)\b/i;

/**
 * "Dana Whitfield", "Tom Agbaje", "Mary J. O'Neil": two capitalized name tokens (optionally with a
 * middle initial) and no organization vocabulary. Three-word names are accepted only with `loose`
 * (used where surrounding context — a signature title line — already implies a person), because
 * "Sunrise Aerospace Components" has the same shape as "Mary Ann Smith".
 */
export function isPersonName(s: string | null | undefined, loose = false): boolean {
  if (!s) return false;
  const v = collapse(s);
  if (v.length < 4 || v.length > 60) return false;
  if (PERSON_BLOCKERS.test(v)) return false;
  // Business-noun endings ("Fabrication", "Logistics", "Industries", "Management", "Software").
  if (/(tion|sion|ics|ies|ment|ware|works)\b/i.test(v)) return false;
  const parts = v.split(" ");
  const nameTokens = parts.filter((p) => !/^[A-Z]\.$/.test(p));
  if (nameTokens.length < 2 || nameTokens.length > (loose ? 3 : 2)) return false;
  return parts.every((p, i) => {
    if (i > 0 && i < parts.length - 1 && /^[A-Z]\.$/.test(p)) return true;
    return /^[A-Z][a-zà-ÿ]+(?:['’-][A-Z]?[a-zà-ÿ]+)*$/.test(p) || /^(?:Mc|Mac|O['’])[A-Z][a-z]+$/.test(p);
  });
}

/** Tokens of the recipient's mailbox ("ruben.test@…" → ruben, test): the user's own name is never a recruiter. */
function recipientTokens(toAddress: string | null): Set<string> {
  const local = toAddress?.split("@")[0] ?? "";
  return new Set(local.toLowerCase().split(/[^a-z]+/).filter((t) => t.length >= 2));
}

function isRecipient(name: string, recipient: Set<string>): boolean {
  if (!recipient.size) return false;
  const parts = name.toLowerCase().split(/\s+/);
  return parts.every((p) => recipient.has(p.replace(/[^a-z]/g, "")));
}

// ---------------------------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------------------------

type OrgRead = { name: string; next: string | null };

/**
 * Read a capitalized organization name starting at `pos`. Stops at sentence punctuation, lower-case
 * words, separators ("·", "-", "|") and parentheses; keeps a trailing legal abbreviation ("Co.").
 */
function readOrgForward(text: string, pos: number, allowLeadingThe = true): OrgRead | null {
  const tokens = tokenize(text.slice(pos, pos + 200));
  const parts: string[] = [];
  let i = 0;
  if (allowLeadingThe && tokens[0] && /^the$/i.test(tokens[0].text)) i = 1;
  let next: string | null = null;
  for (; i < tokens.length && parts.length < 9; i++) {
    let tok = tokens[i]!.text;
    if (parts.length === 0) tok = tok.replace(/^["'“‘]+/, "");
    if (tok.startsWith("(")) {
      next = tok;
      break;
    }
    let stop = false;
    const trail = /[,;:!?)"”’]+$/.exec(tok);
    if (trail) {
      tok = tok.slice(0, -trail[0].length);
      stop = true;
    }
    if (/['’]s$/.test(tok)) {
      tok = tok.slice(0, -2);
      stop = true;
    }
    if (!tok) break;
    const lower = tok.toLowerCase();
    if (parts.length > 0 && ORG_CONNECTORS.has(lower) && !stop) {
      parts.push(lower === "&" ? "&" : tok);
      continue;
    }
    if (!isCapToken(tok) || STOP_TOKENS.has(tok.replace(/\.$/, ""))) {
      next = tok;
      break;
    }
    if (tok.endsWith(".")) {
      parts.push(ABBREVIATION.test(tok) || INITIALS.test(tok) ? tok : tok.slice(0, -1));
      next = tokens[i + 1]?.text ?? null;
      break;
    }
    parts.push(tok);
    if (stop) {
      next = tokens[i + 1]?.text ?? null;
      break;
    }
  }
  while (parts.length && ORG_CONNECTORS.has(parts[parts.length - 1]!.toLowerCase())) parts.pop();
  if (!parts.length) return null;
  return { name: parts.join(" "), next: next ? next.toLowerCase().replace(/[^a-z]/g, "") : null };
}

/** Strip department suffixes and validate that what remains names an organization. */
function cleanOrg(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let name = collapse(raw.replace(/["“”]/g, "")).replace(/^the\s+/i, "");
  for (let guard = 0; guard < 4; guard++) {
    const next = name.replace(DEPT_SUFFIX, "");
    if (next === name) break;
    name = next;
  }
  name = name.replace(/[\s,;:–—-]+$/, "").trim();
  if (name.length < 2 || name.length > 80) return null;
  if (PLATFORM_NAMES.test(name)) return null;
  if (/@|https?:|www\./i.test(name)) return null;
  const words = name.toLowerCase().split(/\s+/);
  if (words.every((w) => ORG_GENERIC.has(w.replace(/[^a-z]/g, "")) || ORG_CONNECTORS.has(w))) return null;
  // A job title is not an employer ("Electrician Trainee").
  if (hasRoleNoun(name) && !/\b(services|company|co\.?|inc\.?|llc|group|corp|partners|builders|electric|works)\b/i.test(name)) {
    return null;
  }
  return name;
}

/** The organization in a sender display name ("Harbor Line Elevator Co. Talent", "Kelly Ruiz | TradeForce Staffing"). */
export function orgFromDisplayName(display: string | null | undefined): string | null {
  if (!display) return null;
  let n = collapse(display.replace(/["“”]/g, ""));
  const via = /^(.*?)\s+(?:via|powered by)\s+.+$/i.exec(n);
  if (via) n = via[1]!;
  const parts = n.split(/\s+[|·–—-]\s+|\s*\|\s*/);
  if (parts.length > 1) {
    n = isPersonName(parts[0]) ? parts.slice(1).join(" ") : parts[0]!;
  } else if (isPersonName(n)) {
    return null;
  }
  return cleanOrg(n);
}

/** The person in a sender display name ("Priya Natarajan via LinkedIn", "Kelly Ruiz | TradeForce Staffing"). */
export function personFromDisplayName(display: string | null | undefined): string | null {
  if (!display) return null;
  let n = collapse(display.replace(/["“”]/g, ""));
  const via = /^(.*?)\s+via\s+.+$/i.exec(n);
  if (via) n = via[1]!;
  n = n.split(/\s+[|·–—]\s+|\s*\|\s*|\s+-\s+|,\s+/)[0]!.trim();
  // "Whitfield, Dana" is rare in From headers; only accept natural order.
  return isPersonName(n) ? n : null;
}

type Candidate = { value: string; weight: number; source: string };

function noisyOr(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - Math.min(Math.max(w, 0), 0.99)), 1);
}

/** Group candidates by a normalized key; return the best-supported spelling. */
function pickBest(
  candidates: Candidate[],
  keyOf: (v: string) => string,
  preferSpelling: (a: string, b: string) => number,
): { value: string; score: number; sources: string[] } | null {
  type Group = { weights: number[]; spellings: Map<string, number>; sources: Set<string> };
  const groups = new Map<string, Group>();
  for (const c of candidates) {
    const key = keyOf(c.value);
    if (!key) continue;
    const g: Group = groups.get(key) ?? { weights: [], spellings: new Map<string, number>(), sources: new Set<string>() };
    g.weights.push(c.weight);
    g.spellings.set(c.value, (g.spellings.get(c.value) ?? 0) + c.weight);
    g.sources.add(c.source);
    groups.set(key, g);
  }
  let best: { value: string; score: number; sources: string[] } | null = null;
  for (const g of groups.values()) {
    const score = noisyOr(g.weights);
    const spelling = [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || preferSpelling(a[0], b[0]))[0]![0];
    if (!best || score > best.score + 1e-9) best = { value: spelling, score, sources: [...g.sources] };
  }
  return best;
}

const preferAbbrevThenLength = (a: string, b: string) => {
  const ad = /\.$/.test(a) ? 1 : 0;
  const bd = /\.$/.test(b) ? 1 : 0;
  return bd - ad || b.length - a.length;
};

const ORG_FORWARD_ANCHORS: Array<[RegExp, number, string]> = [
  [/\b(?:applying|applied|application|apply|candidacy|resume|résumé)\s+(?:to|at|with)\s+/gi, 0.85, "anchor:applied-to"],
  [/\b(?:sent|submitted|forwarded|delivered)\s+to\s+/gi, 0.75, "anchor:sent-to"],
  [
    /\b(?:interest in|employment (?:with|at)|career with|careers? at|opportunit(?:y|ies) (?:with|at)|working (?:at|for|with)|join(?:ing)?|welcome to|on behalf of|team at|staff at|here with|here at|recruit(?:er|ing|ment)(?: team| lead| partner)? (?:at|for|with)|(?:position|role|opening|job|vacancy|offer|day|start) (?:at|with))\s+/gi,
    0.75,
    "anchor:org-phrase",
  ],
  [/\b(?:Lead|Manager|Recruiter|Partner|Specialist|Coordinator|Generalist|Director|Sourcer|Advisor)\s+(?:at|@)\s+/g, 0.6, "anchor:title-at"],
];
const TITLE_NOUN_NEXT = /^(position|positions|role|roles|opening|openings|job|jobs|program|programs|apprenticeship|vacancy|vacancies|posting|team)$/;

const ORG_BEFORE_VERB =
  /((?:\p{Lu}[\p{L}\p{N}_&'’.-]*\s+(?:(?:of|and|&|the)\s+)?){0,6}\p{Lu}[\p{L}\p{N}_&'’-]*)\s+(?:has received|have received|has invited|invited you|will review|will be reviewing|is looking for|are looking for|would like to|wants to|is hiring|has reviewed|is reviewing|has decided|has selected)\b/gu;

const DEPT_LINE =
  /^(?:the\s+)?(.+?)\s+(?:talent acquisition|talent team|talent|recruiting team|recruiting|recruitment team|recruitment|hiring team|human resources(?: department| team)?|hr(?: team| department)?|people operations|people team|careers? team|careers)\s*$/i;
const ROLE_TITLE_WORDS =
  /\b(recruiter|recruiting|talent|hr|human resources|people|staffing|hiring|manager|generalist|coordinator|partner|specialist|director|lead|officer|assistant|representative|advisor|consultant|supervisor|administrator|sourcer|president|owner|founder|foreman|superintendent|team)\b/i;
const LABELED_ORG = /^\s*[-•*]?\s*(?:company|employer|organization|organisation|agency|hiring (?:company|organization)|business|company name)\s*:\s*(.+)$/i;

/** Everything that names the organization the email is about, with weights. */
function employerCandidates(input: ExtractionInput): Candidate[] {
  const out: Candidate[] = [];
  const push = (raw: string | null | undefined, weight: number, source: string) => {
    const v = cleanOrg(raw);
    if (v) out.push({ value: v, weight, source });
  };
  const flat = collapse(input.body);
  const texts: Array<[string, number]> = [
    [input.subject, 1],
    [flat, 1],
  ];

  // Labeled fields.
  for (const line of input.body.split("\n")) {
    const m = LABELED_ORG.exec(line);
    if (m) push(readOrgForward(m[1]!, 0)?.name ?? m[1]!.replace(/[.;,]+$/, ""), 1, "labeled");
  }

  // Phrase anchors that precede the organization.
  for (const [text, factor] of texts) {
    for (const [re, weight, source] of ORG_FORWARD_ANCHORS) {
      for (const m of text.matchAll(re)) {
        const read = readOrgForward(text, m.index! + m[0].length);
        if (!read || (read.next && TITLE_NOUN_NEXT.test(read.next))) continue;
        push(read.name, weight * factor, source);
      }
    }
    // Generic "at <Org>" (no leading "the": "at the Long Beach branch" names a place).
    for (const m of text.matchAll(/\bat\s+/g)) {
      const read = readOrgForward(text, m.index! + m[0].length, false);
      if (!read || (read.next && TITLE_NOUN_NEXT.test(read.next))) continue;
      if (read.next && /^(branch|office|yard|site|location|campus|facility|center|plant|store|shop|warehouse)$/.test(read.next)) continue;
      push(read.name, 0.45 * factor, "anchor:at");
    }
    // "<Org> has received / will review / invited you …"
    for (const m of text.matchAll(ORG_BEFORE_VERB)) {
      const words = m[1]!.split(/\s+/);
      while (words.length && STOP_TOKENS.has(words[0]!.replace(/[.,]$/, ""))) words.shift();
      if (words.length) push(words.join(" "), 0.75 * factor, "anchor:org-verb");
    }
  }

  // Signature and department lines.
  const lines = input.body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const dept = DEPT_LINE.exec(line);
    if (dept && line.length <= 90) {
      const read = readOrgForward(dept[1]!, 0);
      if (read && collapse(read.name).length >= collapse(dept[1]!).replace(/^the\s+/i, "").length - 1) {
        push(read.name, 0.8, "signature:department");
      }
    }
    // "Office Manager | Acme Electric", "Recruiter, Sunbelt HVAC Services"
    const titled = /^([A-Z][A-Za-z&/.]*(?:\s+[A-Za-z&/.]+){0,4})\s*[|,]\s*(.+)$/.exec(line);
    if (titled && ROLE_TITLE_WORDS.test(titled[1]!) && line.length <= 90) {
      const read = readOrgForward(titled[2]!, 0);
      if (read) push(read.name, 0.8, "signature:title-company");
    }
    // "Talent Acquisition Partner" / "Human Resources" line followed by the organization line.
    if (
      i + 1 < lines.length &&
      line.length <= 50 &&
      /^(?:[A-Z][A-Za-z&/.-]*\s*){1,5}$/.test(line) &&
      ROLE_TITLE_WORDS.test(line) &&
      !isPersonName(line)
    ) {
      const nextLine = lines[i + 1]!;
      const read = readOrgForward(nextLine, 0);
      if (read && (read.name.length >= nextLine.length - 2 || /^\s*[|·,–—-]/.test(nextLine.slice(read.name.length)))) {
        push(read.name, 0.75, "signature:org-line");
      }
    }
  }

  // Sender display name.
  push(orgFromDisplayName(input.fromName), 0.7, "display-name");
  return out;
}

export function extractEmployer(input: ExtractionInput): string | null {
  return pickBest(employerCandidates(input), (v) => normalizeCompany(v), preferAbbrevThenLength)?.value ?? null;
}

// ---------------------------------------------------------------------------------------------
// Position titles
// ---------------------------------------------------------------------------------------------

const TITLE_NOUNS = /^(position|positions|role|roles|opening|openings|job|jobs|vacancy|vacancies|posting|postings|opportunity|opportunities)$/i;
const TITLE_NOUNS_WEAK = /^(application|applications|assessment|interview|candidacy)$/i;
const TITLE_LABEL =
  /^\s*[-•*]?\s*(?:job title|position title|position|job|role|title|job name|vacancy|opening|requisition title|job posting)\s*:\s*(.+)$/i;
const DETERMINERS = /^(the|our|your|this|that|an?|its|their)$/i;

/** Normalize a title as the corpus labels it: no parentheticals/locations; "X Apprenticeship Program" → "X Apprentice". */
export function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = collapse(raw)
    .replace(/\([^)]*\)?/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+[-–—|·]\s+.*$/, "")
    .replace(/\s+in\s+[A-Z][\w.' -]*,\s*[A-Z]{2}\b.*$/, "")
    .replace(/[\s,;:.!?*]+$/, "")
    .replace(/^[\s,;:.!?*"'“]+/, "");
  t = collapse(t).replace(/^(the|our|your|this|an?)\s+/i, "");
  t = t.replace(/\s+(position|role|opening|job|vacancy)s?$/i, "");
  t = t.replace(/\bApprenticeship(\s+Program)?$/i, "Apprentice");
  t = collapse(t);
  if (t.length < 2 || t.length > 80) return null;
  const words = t.split(" ");
  if (words.length > 8) return null;
  if (!/^[\p{Lu}0-9]/u.test(t)) return null;
  if (/^(application|applications|job|jobs|position|positions|role|opportunity|interview|status|update|your|our|new)$/i.test(t)) return null;
  return t;
}

function backwardTitleRun(tokens: Token[], nounIndex: number): string | null {
  const parts: string[] = [];
  for (let j = nounIndex - 1; j >= 0 && parts.length < 8; j--) {
    const tok = tokens[j]!.text;
    if (/[,.;:!?)("”“]$/.test(tok) || /^[("“]/.test(tok)) break;
    if (isCapToken(tok) || /^(I{1,3}|IV|V|\d{1,2})$/.test(tok) || /^[A-Z]+\/[A-Z]+$/.test(tok)) {
      parts.unshift(tok);
      continue;
    }
    if (["and", "&", "/", "of", "-"].includes(tok) && parts.length) {
      parts.unshift(tok);
      continue;
    }
    break;
  }
  while (parts.length && (["and", "&", "/", "of", "-"].includes(parts[0]!) || DETERMINERS.test(parts[0]!) || STOP_TOKENS.has(parts[0]!))) {
    parts.shift();
  }
  return parts.length ? parts.join(" ") : null;
}

function forwardTitleRun(text: string, pos: number): string | null {
  const tokens = tokenize(text.slice(pos, pos + 160));
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length && DETERMINERS.test(tokens[i]!.text)) i++;
  for (; i < tokens.length && parts.length < 8; i++) {
    let tok = tokens[i]!.text;
    if (/^[([]/.test(tok)) break;
    let stop = false;
    const trail = /[,;:!?)"”.]+$/.exec(tok);
    if (trail) {
      tok = tok.slice(0, -trail[0].length);
      stop = true;
    }
    if (!tok) break;
    if (isCapToken(tok) || /^(I{1,3}|IV)$/.test(tok) || /^[A-Z]+\/[A-Z]+$/.test(tok)) {
      if (STOP_TOKENS.has(tok) && parts.length === 0) break;
      parts.push(tok);
    } else if (["and", "&", "/", "of", "-"].includes(tok) && parts.length && !stop) {
      parts.push(tok);
      continue;
    } else {
      break;
    }
    if (stop) break;
  }
  while (parts.length && ["and", "&", "/", "of", "-"].includes(parts[parts.length - 1]!)) parts.pop();
  return parts.length ? parts.join(" ") : null;
}

/** "Pipefitter and Mechanical Helper positions" → "Pipefitter". */
function firstOfList(run: string): string {
  return run.split(/\s+(?:and|&|\/)\s+|\s*,\s*/)[0]!.trim();
}

const TITLE_FORWARD_ANCHORS: Array<[RegExp, number, boolean]> = [
  // [pattern, weight, requiresRoleNoun]
  [/\b(?:application|applying|applied|candidacy|offer|interview|considered)\s+(?:for|as)\s+(?:the\s+(?:position\s+of\s+)?)?/gi, 0.75, false],
  [/\b(?:position|role|job title|post)\s+of\s+/gi, 0.75, false],
  [/\b(?:apply|invited you to apply)\s+for:?\s+/gi, 0.6, true],
  [/\b(?:start|join(?:ing)?\s+(?:us|the team)|hired|work(?:ing)?)\s+as\s+(?:an?\s+)?/gi, 0.6, true],
];

function titleCandidates(input: ExtractionInput, employer: string | null): Candidate[] {
  const out: Candidate[] = [];
  const push = (raw: string | null, weight: number, source: string, requireRole = false) => {
    let v = cleanTitle(raw);
    if (!v) return;
    if (employer) {
      const at = new RegExp(`\\s+(?:at|with|@)\\s+${employer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      v = cleanTitle(v.replace(at, ""));
      if (!v || normalizeCompany(v) === normalizeCompany(employer)) return;
    }
    if (requireRole && !hasRoleNoun(v)) return;
    out.push({ value: v, weight: hasRoleNoun(v) ? Math.min(weight + 0.05, 0.99) : weight, source });
  };

  const body = input.body;
  const flat = collapse(body);

  // 1. Labeled fields ("Job Title: …", "Position: …").
  for (const line of body.split("\n")) {
    const m = TITLE_LABEL.exec(line);
    if (m) push(m[1]!, 1, "labeled");
  }

  // 2. "<Title> position/role/opening" (backward run) in subject and body.
  for (const [text, factor, src] of [
    [input.subject, 0.9, "subject"],
    [flat, 1, "body"],
  ] as const) {
    const tokens = tokenize(text);
    tokens.forEach((t, k) => {
      const word = t.text.replace(/[^A-Za-z]/g, "");
      if (TITLE_NOUNS.test(word)) {
        const run = backwardTitleRun(tokens, k);
        if (run) push(/s$/i.test(word) ? firstOfList(run) : run, 0.8 * factor, `${src}:noun-phrase`);
      } else if (TITLE_NOUNS_WEAK.test(word)) {
        const run = backwardTitleRun(tokens, k);
        if (run) push(run, 0.6 * factor, `${src}:weak-noun-phrase`, true);
      }
    });
    // 3. Forward anchors ("application for X", "position of X", "start as a X").
    for (const [re, weight, requireRole] of TITLE_FORWARD_ANCHORS) {
      for (const m of text.matchAll(re)) {
        push(forwardTitleRun(text, m.index! + m[0].length), weight * factor, `${src}:forward`, requireRole);
      }
    }
  }

  // 4. Subject segments ("Update on your application - Apprentice Electrician").
  const subject = input.subject.replace(/^((re|fwd?|fw)\s*:\s*)+/i, "");
  const segments: string[] = [];
  for (const seg of subject.split(/\s+[-–—|]\s+|:\s+/)) {
    for (const paren of seg.matchAll(/\(([^)]+)\)/g)) segments.push(paren[1]!);
    segments.push(seg.replace(/\([^)]*\)/g, " "));
  }
  for (const seg of segments) {
    const s = collapse(seg);
    if (!s || /\d{3,}/.test(s)) continue;
    const words = s.split(" ");
    if (words.length > 7) continue;
    const titled = words.every((w) => isCapToken(w) || ["and", "&", "/", "of", "at", "-"].includes(w));
    if (titled) push(s, 0.55, "subject:segment", true);
  }

  // 5. Job-card layout: a title line directly above a line that starts with the employer.
  if (employer) {
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const emp = employer.toLowerCase();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!.toLowerCase();
      if (!line.startsWith(emp)) continue;
      const rest = line.slice(emp.length);
      if (rest && !/^\s*[·•|,–—-]/.test(rest)) continue;
      const prev = lines[i - 1]!;
      const words = prev.split(" ");
      if (words.length > 7 || /[.:!?]$/.test(prev) || prev.toLowerCase().includes(emp)) continue;
      const capShare = words.filter((w) => isCapToken(w) || /^(and|&|of|\/|-)$/.test(w)).length / words.length;
      if (capShare >= 0.75) push(prev, 0.75, "card");
    }
  }
  return out;
}

export function extractTitle(input: ExtractionInput, employer: string | null): string | null {
  const candidates = titleCandidates(input, employer);
  if (!candidates.length) return null;
  // Merge abbreviated variants into the fuller one ("Industrial Maintenance Tech" → "…Technician").
  const keys = [...new Set(candidates.map((c) => normalizeTitle(c.value)))];
  const canonical = (v: string) => {
    const k = normalizeTitle(v);
    const longer = keys.filter((o) => o !== k && o.startsWith(k) && o.length > k.length);
    return longer.length ? longer.sort((a, b) => b.length - a.length)[0]! : k;
  };
  return pickBest(candidates, canonical, (a, b) => b.length - a.length)?.value ?? null;
}

// ---------------------------------------------------------------------------------------------
// Requisition numbers
// ---------------------------------------------------------------------------------------------

const REQ_VALUE = "([A-Z0-9][A-Z0-9-]{2,30})";
const LABELED_REQ: RegExp[] = [
  new RegExp(`\\b(?:requisition|req)\\b\\.?\\s*(?:id|number|no\\.?|#|code)?\\s*[:#]?\\s*${REQ_VALUE}`, "gi"),
  new RegExp(`\\bjob\\s*(?:id|number|no\\.?|#|code|reference|ref\\.?|requisition)\\s*[:#]?\\s*${REQ_VALUE}`, "gi"),
  new RegExp(`\\b(?:position|posting|vacancy|announcement|opening|job posting)\\s*(?:id|number|no\\.?|#|code)\\s*[:#]?\\s*${REQ_VALUE}`, "gi"),
  new RegExp(`\\b(?:reference|ref)\\s*(?:id|number|no\\.?|#|code)\\s*[:#]?\\s*${REQ_VALUE}`, "gi"),
];
const PAREN_ID =
  /\(\s*(?:(?:job\s*(?:id|#|no\.?)|req(?:uisition)?\.?(?:\s*(?:id|#|no\.?))?|ref(?:erence)?\.?(?:\s*(?:id|#|no\.?))?)(?:\s*[:#]\s*|\s+))?([A-Z0-9]+(?:-[A-Z0-9]+){0,5})\s*\)/gi;
const ID_SHAPE = /^(?=.*\d)(?:[A-Z]{1,5}-?\d[\d-]*[A-Z]{0,2}|\d{5,}|\d{2,4}-[A-Z0-9][A-Z0-9-]*)$/i;
/** Identifiers that are explicitly NOT requisitions (applicant numbers, application ids, meeting ids …). */
const NOT_REQ_LABELS =
  /\b(applicant|application|candidate|confirmation|meeting|order|case|ticket|offer|license|lic|employee|member|badge|account|passcode|tracking|zip|phone|fax|suite|ste|unit|apt)\b\.?\s*(?:id|number|no\.?|#|code)?\s*(?:is\s+)?[:#]?\s*[A-Z0-9][A-Z0-9 -]{2,}/gi;

function validReq(v: string | undefined): string | null {
  if (!v) return null;
  const id = v.replace(/[.,;:)-]+$/, "").toUpperCase();
  if (!/\d/.test(id) || id.length < 3) return null;
  if (/^(19|20)\d{2}$/.test(id)) return null; // a bare year
  return id;
}

export function extractRequisition(input: ExtractionInput): string | null {
  const texts = [input.subject, input.body];
  for (const text of texts) {
    for (const re of LABELED_REQ) {
      for (const m of text.matchAll(re)) {
        const id = validReq(m[1]);
        if (id) return id;
      }
    }
  }
  for (const text of texts) {
    for (const m of text.matchAll(PAREN_ID)) {
      const id = validReq(m[1]);
      if (id && ID_SHAPE.test(id) && !/^\d{3,4}$/.test(id)) return id;
    }
  }
  // Generic patterns from the tracker's normalizer, over text with non-requisition ids masked.
  const masked = `${input.subject}\n${input.body}`.replace(NOT_REQ_LABELS, " ");
  return validReq(extractRequisitionId(masked) ?? undefined);
}

// ---------------------------------------------------------------------------------------------
// Recruiter
// ---------------------------------------------------------------------------------------------

const RECRUITER_ROLE =
  /\b(recruit\w*|talent|hr|human resources|people (operations|partner|team)|staffing|hiring (manager|coordinator|team)|office manager|coordinator|generalist|sourcer|personnel|careers)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function extractRecruiter(
  input: ExtractionInput,
  opts: { senderIsPlatform: boolean },
): { name: string | null; email: string | null } {
  const recipient = recipientTokens(input.toAddress);
  const ok = (n: string | null | undefined, loose = false): n is string =>
    !!n && isPersonName(n, loose) && !isRecipient(n, recipient);
  const personal = (addr: string | null) =>
    addr && !/(^|[-_.])(no-?reply|do-?not-?reply|donotreply|notifications?|alerts?)([-_.@]|$)/i.test(addr) ? addr : null;
  const senderEmail = opts.senderIsPlatform ? null : personal(input.fromAddress);
  const replyToEmail = personal(input.replyTo);

  // 1. The sender is a person.
  const fromPerson = personFromDisplayName(input.fromName);
  if (ok(fromPerson)) return { name: fromPerson, email: senderEmail };

  const lines = input.body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const emailNear = (i: number) => {
    for (let j = i; j < Math.min(lines.length, i + 5); j++) {
      const m = EMAIL_RE.exec(lines[j]!);
      if (m) return m[0].toLowerCase();
    }
    return null;
  };

  // 2. "Dana Whitfield (Talent Acquisition Partner)"
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i]!.matchAll(/([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){1,3})\s*\(([^)]{3,60})\)/g)) {
      if (ok(m[1], true) && RECRUITER_ROLE.test(m[2]!)) return { name: m[1]!, email: emailNear(i) ?? replyToEmail };
    }
  }
  // 3. Signature: a name line followed by a recruiting/HR title line.
  for (let i = 0; i + 1 < lines.length; i++) {
    if (ok(lines[i], true) && lines[i + 1]!.length <= 80 && RECRUITER_ROLE.test(lines[i + 1]!)) {
      return { name: lines[i]!, email: emailNear(i + 1) ?? replyToEmail };
    }
  }
  // 4. "My name is …" / "This is … from/with"
  const flat = collapse(input.body);
  const intro = /\b(?:my name is|this is)\s+([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){1,2})/.exec(flat);
  if (intro && ok(intro[1])) return { name: intro[1]!, email: senderEmail ?? replyToEmail };
  return { name: null, email: null };
}

// ---------------------------------------------------------------------------------------------
// Location, pay, application link
// ---------------------------------------------------------------------------------------------

const CITY_STATE = /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3},\s*[A-Z]{2}(?:\s+\d{5})?$/;

export function extractLocation(input: ExtractionInput, employer: string | null, title: string | null): string | null {
  const lines = input.body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = /^(?:job\s+)?location\s*:\s*(.+)$/i.exec(line);
    if (m) {
      const v = collapse(m[1]!).replace(/[.;]+$/, "");
      if (v.length <= 80 && !/^\d/.test(v) && (/,\s*[A-Z]{2}\b/.test(v) || /\bremote\b/i.test(v))) return v;
    }
  }
  // Job card: "<Title>" / "<Employer> · City, ST" (or the city on the following line).
  if (employer && title) {
    const emp = employer.toLowerCase();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.toLowerCase().startsWith(emp) || lines[i - 1]!.toLowerCase() !== title.toLowerCase()) continue;
      const rest = line.slice(emp.length).replace(/^\s*[·•|,–—-]\s*/, "");
      const first = (rest ? rest.split(/\s*[·•|]\s*|\s+-\s+/)[0] : lines[i + 1])?.trim() ?? "";
      if (CITY_STATE.test(first)) return first;
    }
  }
  const flat = collapse(input.body);
  const paren = /\b(?:position|role|opening|job)\s*\(([A-Z][A-Za-z.' -]+,\s*[A-Z]{2})\)/.exec(flat);
  if (paren) return paren[1]!;
  const inCity = /\b(?:position|role|opening|job)\b[^.]{0,40}?\bin\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3},\s*[A-Z]{2})\b/.exec(flat);
  return inCity ? inCity[1]! : null;
}

const MONEY =
  /\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*[kK])?(?:\s*(?:-|–|to)\s*\$?\s?\d[\d,]*(?:\.\d{2})?(?:\s*[kK])?)?(?:\s*(?:\/|per|an?)\s*(?:hour|hr|year|yr|annum|week|wk|month|mo)\b)?/gi;
const PAY_WORDS = /\b(pay|salary|wage|wages|rate|compensation|hourly|base|earn|range)\b/i;

/**
 * Pay text: a money amount on a pay line ("Pay rate: $28.50 per hour"), or on the job card of the
 * application's employer. Amounts elsewhere (recommended jobs, allowances, fees) are ignored.
 */
export function extractSalary(input: ExtractionInput, employer: string | null): string | null {
  const lines = input.body.split("\n").map((l) => l.trim());
  const emp = employer?.toLowerCase() ?? null;
  let fallback: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const m of line.matchAll(MONEY)) {
      const v = collapse(m[0]);
      const hasUnit = /(hour|hr|year|yr|annum|week|wk|month|mo)\b/i.test(v);
      const isRange = /\d\s*(-|–|to)\s*\$?\s?\d/.test(v);
      if (PAY_WORDS.test(line) && (hasUnit || isRange)) return v;
      if (PAY_WORDS.test(line) && !fallback) fallback = v;
      // Card layout: the line naming the employer, or one of the two lines after it.
      const nearEmployer =
        !!emp && [i, i - 1, i - 2].some((j) => j >= 0 && (lines[j] ?? "").toLowerCase().startsWith(emp));
      if (hasUnit && nearEmployer && !fallback) fallback = v;
    }
  }
  return fallback;
}

const LINK_TEXT_GOOD =
  /\b(view|track|check|see|review|open)\b.{0,25}\b(application|applications|status|job|posting|listing)\b|\bcandidate (home|portal)\b|\bmy (jobs|applications)\b|\bapplication status\b|\bfinish (your )?application\b|\bcontinue (your )?application\b|\bview (the )?(job|posting|role)\b/i;
const LINK_TEXT_BAD =
  /\b(unsubscribe|privacy|terms|help|support|preferences|manage alerts?|logo|calendar|download|app store|google play|profile|message|reply|decline|remove|assessment|interview|join)\b/i;
const POSTING_URL =
  /indeed\.com\/.*[?&]jk=|indeed\.com\/viewjob|linkedin\.com\/(comm\/)?jobs\/view\/\d+|greenhouse\.io\/[^/]+\/jobs\/\d+|[?&]gh_jid=\d+|jobs\.lever\.co\/[^/]+\/[0-9a-f-]{36}|myworkdayjobs\.com\/.*\/job\/|icims\.com\/jobs\/\d+|smartrecruiters\.com\/[^/]+\/\d+|ziprecruiter\.com\/.*[?&]jid=|glassdoor\.[^/]+\/.*(jobListingId|jl)=/i;

export function isPostingUrl(url: string | null | undefined): boolean {
  return !!url && POSTING_URL.test(url);
}

export function extractApplicationUrl(links: EmailLink[]): string | null {
  let best: { url: string; score: number } | null = null;
  for (const link of links) {
    const text = link.text ?? "";
    if (!LINK_TEXT_GOOD.test(text) || LINK_TEXT_BAD.test(text)) continue;
    const score = 3 + (isPostingUrl(link.url) ? 1 : 0);
    if (!best || score > best.score) best = { url: link.url, score };
  }
  if (!best) return null;
  return normalizeUrl(best.url) ?? null;
}
