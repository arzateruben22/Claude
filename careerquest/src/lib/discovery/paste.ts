/**
 * "Paste a job URL or posting text" and mobile share parsing (pure, client-safe, no network).
 *
 * Reads only what is in the pasted text: the first http(s) link (normalized, platform detected),
 * labelled lines ("Company: …", "Location: …", "Pay: …"), common share/page-title shapes
 * ("Check out this job at Acme: Electrician", "Electrician - Acme Electric - Anaheim, CA | Indeed"),
 * a "City, CA" location, the first pay figure and eligibility keywords. Company and title that the
 * platform puts in the URL path are used only when the text has none. Nothing is fetched.
 */
import type { ApplicationSource } from "@/generated/prisma/enums";
import { detectPlatform, normalizeUrl } from "@/lib/applications/normalize";
import { hintsFromUrl } from "@/lib/imports/urls";
import { detectEligibility, type EligibilityFlags, type EligibilityHit } from "./eligibility";

export const MAX_PASTE_CHARS = 20_000;

export type LeadDraft = {
  url: string | null;
  normalizedUrl: string | null;
  platform: ApplicationSource;
  title: string | null;
  company: string | null;
  location: string | null;
  salaryText: string | null;
  flags: EligibilityFlags;
  hits: EligibilityHit[];
  /** Where title/company came from: the text itself, the URL path, or nowhere. */
  detailsFrom: "text" | "url" | "none";
};

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/i;
const TRAILING_PUNCT = /[)\].,;:!?'"»”’]+$/;
const BOARD_SUFFIX = /\s*[-–—|·:]\s*(?:indeed(?:\.com)?|linkedin|glassdoor|ziprecruiter|governmentjobs(?:\.com)?|usajobs|workday|greenhouse|lever|smartrecruiters|icims|careers?|jobs?)\b.*$/i;
const PAY_RE =
  /\$\s?\d[\d,]*(?:\.\d{1,2})?\s*[kK]?(?:\s*(?:-|–|—|to)\s*\$?\s?\d[\d,]*(?:\.\d{1,2})?\s*[kK]?)?(?:\s*(?:\/\s*|per\s+|an?\s+)(?:hour|hr|year|yr|annum|annually|month))?(?:\s+(?:hourly|annually|yearly))?/i;
const CITY_STATE_RE = /\b([A-Z][A-Za-zñÑ.'-]+(?:\s+[A-Z][A-Za-zñÑ.'-]+){0,3}),\s*(CA|California)\b/;

const LABELS: ReadonlyArray<[keyof Pick<LeadDraft, "title" | "company" | "location" | "salaryText">, RegExp]> = [
  ["title", /^(?:job\s+title|title|position|role|job)\s*[:–—-]\s*(.+)$/i],
  ["company", /^(?:company|employer|organization|organisation|hiring\s+company|contractor)\s*[:–—-]\s*(.+)$/i],
  ["location", /^(?:location|job\s+location|work\s+location|city)\s*[:–—-]\s*(.+)$/i],
  ["salaryText", /^(?:pay|salary|compensation|wage|wages|rate|pay\s+rate|pay\s+range|salary\s+range|hourly\s+rate)\s*[:–—-]\s*(.+)$/i],
];

function clean(value: string | null | undefined, max = 200): string | null {
  if (!value) return null;
  const t = value.replace(/\s+/g, " ").trim().replace(/^[-–—|·:]+|[-–—|·:]+$/g, "").trim();
  return t ? t.slice(0, max) : null;
}

/** First http(s) link in the text, without trailing punctuation; `www.` gets https://. */
export function firstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = URL_RE.exec(text);
  if (!m) return null;
  let raw = m[0].replace(TRAILING_PUNCT, "");
  if (/^www\./i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return raw.slice(0, 2048);
  } catch {
    return null;
  }
}

/** Title / company / location from a one-line share text or page title. */
function fromHeadline(line: string, platform: ApplicationSource): Pick<LeadDraft, "title" | "company" | "location"> | null {
  const linkedIn = /check out this job at\s+(.+?)\s*[:–—-]\s*(.+)$/i.exec(line);
  if (linkedIn) return { company: clean(linkedIn[1]), title: clean(linkedIn[2]), location: null };
  // LinkedIn page title: "Acme Electric hiring Apprentice Electrician in Anaheim, CA | LinkedIn"
  const hiring =
    platform === "LINKEDIN" || /\|\s*linkedin\b/i.test(line) ? /^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+(.+?))?(?:\s*\|\s*linkedin.*)?$/i.exec(line) : null;
  if (hiring) return { company: clean(hiring[1]), title: clean(hiring[2]), location: clean(hiring[3]) };
  // Greenhouse page title: "Job Application for Wireman at Acme Electric"
  const greenhouse = /^job application for\s+(.+?)\s+at\s+(.+)$/i.exec(line);
  if (greenhouse) return { title: clean(greenhouse[1]), company: clean(greenhouse[2]), location: null };
  const stripped = line.replace(BOARD_SUFFIX, "").trim();
  const parts = stripped.split(/\s+[-–—|·]\s+/).map((p) => p.trim()).filter(Boolean);
  // Lever page titles put the company first: "Acme Electric - Wireman".
  if (platform === "LEVER" && parts.length === 2) return { company: clean(parts[0]), title: clean(parts[1]), location: null };
  if (parts.length >= 2 && parts.length <= 4 && looksLikeTitle(parts[0]!) && looksLikeCompany(parts[1]!)) {
    const [title, company, ...rest] = parts;
    const location = rest.find((p) => CITY_STATE_RE.test(p) || /\b(remote|hybrid)\b/i.test(p)) ?? null;
    return { title: clean(title), company: clean(company), location: clean(location) };
  }
  const at = /^(.{3,160}?)\s+(?:at|@)\s+(.{2,160})$/i.exec(stripped);
  if (at && looksLikeTitle(at[1]!) && looksLikeCompany(at[2]!)) return { title: clean(at[1]), company: clean(at[2]), location: null };
  return null;
}

const JOB_WORD =
  /\b(?:electricians?|apprentices?|helpers?|technicians?|tech|mechanics?|engineers?|managers?|coordinators?|estimators?|operators?|installers?|foreman|foremen|wire(?:man|men)|plumbers?|(?:pipe|steam)\s?fitters?|workers?|assistants?|specialists?|supervisors?|inspectors?|journeyman|laborers?|superintendents?|millwrights?|trainees?|leads?|hvac)\b/i;

/** A headline segment that reads like a job title: Title Case words or a job word, at most 12 words. */
function looksLikeTitle(s: string): boolean {
  const words = s.trim().split(/\s+/);
  if (!words.length || words.length > 12) return false;
  return JOB_WORD.test(s) || words.every((w) => /^[A-Z0-9(&/]/.test(w) || /^(?:of|and|for|the|in|to|a|an|ii|iii|i)$/i.test(w));
}

/** A segment that reads like an employer name: starts with a capital or digit, at most 10 words. */
function looksLikeCompany(s: string): boolean {
  const words = s.trim().split(/\s+/);
  return words.length > 0 && words.length <= 10 && /^[A-Z0-9]/.test(s.trim());
}

export function parseLeadPaste(input: string | null | undefined): LeadDraft {
  const text = (input ?? "").slice(0, MAX_PASTE_CHARS);
  const url = firstUrl(text);
  const normalizedUrl = url ? normalizeUrl(url) : null;
  const platform = url ? detectPlatform(url) : "OTHER";
  const { flags, hits } = detectEligibility(text);
  const draft: LeadDraft = {
    url,
    normalizedUrl,
    platform,
    title: null,
    company: null,
    location: null,
    salaryText: null,
    flags,
    hits,
    detailsFrom: "none",
  };

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(URL_RE, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 200)) {
    for (const [field, re] of LABELS) {
      if (draft[field]) continue;
      const m = re.exec(line);
      if (m) draft[field] = clean(m[1], field === "salaryText" ? 120 : 200);
    }
  }
  if ((!draft.title || !draft.company) && lines[0] && lines[0].length <= 240) {
    const head = fromHeadline(lines[0], platform);
    if (head) {
      draft.title ??= head.title;
      draft.company ??= head.company;
      draft.location ??= head.location;
    }
  }
  if (!draft.title && lines[0] && lines[0].length <= 120 && looksLikeTitle(lines[0]) && !LABELS.some(([, re]) => re.test(lines[0]!))) {
    draft.title = clean(lines[0]);
  }
  if (draft.title || draft.company) draft.detailsFrom = "text";

  if (url && (!draft.title || !draft.company)) {
    const hints = hintsFromUrl(url);
    if (!draft.title && hints.title) {
      draft.title = clean(hints.title);
      draft.detailsFrom = draft.detailsFrom === "text" ? "text" : "url";
    }
    if (!draft.company && hints.company) {
      draft.company = clean(hints.company);
      draft.detailsFrom = draft.detailsFrom === "text" ? "text" : "url";
    }
  }

  if (!draft.location) {
    const m = CITY_STATE_RE.exec(text.replace(URL_RE, " "));
    if (m) draft.location = clean(`${m[1]}, ${m[2] === "California" ? "CA" : m[2]}`, 160);
  }
  if (!draft.salaryText) {
    const m = PAY_RE.exec(text);
    if (m) draft.salaryText = clean(m[0], 120);
  }
  return draft;
}

/**
 * Web Share Target payload (GET ?title=&text=&url=). Android often puts the link in `text` and the
 * page title in `title`; iOS Shortcuts and the paste box send whatever was copied.
 */
export function parseSharePayload(payload: { title?: string | null; text?: string | null; url?: string | null }): LeadDraft {
  const title = (payload.title ?? "").slice(0, 1000);
  const text = (payload.text ?? "").slice(0, MAX_PASTE_CHARS);
  const explicit = firstUrl(payload.url ?? "");
  const combined = [title, text].filter((s) => s.trim()).join("\n");
  const draft = parseLeadPaste(explicit ? `${explicit}\n${combined}` : combined);
  return draft;
}
