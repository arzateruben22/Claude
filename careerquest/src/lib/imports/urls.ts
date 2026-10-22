/**
 * Job-URL list parsing. Pure (client-safe); no network access — nothing is fetched from the links.
 *
 * One URL per line, optionally followed by " | Company | Job title". Without those, a company and title
 * are read from the URL itself only where the platform puts them in the path (LinkedIn, Workday,
 * SmartRecruiters, iCIMS, ZipRecruiter, Greenhouse/Lever board names); such values are marked as
 * inferred from the URL.
 */
import type { ApplicationSource } from "@/generated/prisma/enums";
import { detectPlatform, normalizeUrl } from "@/lib/applications/normalize";

export const MAX_URL_LINES = 200;
const MAX_LINE_CHARS = 2500;

export type UrlHints = { company: string | null; title: string | null };

export type UrlLine = {
  /** 1-based line number in the pasted text. */
  line: number;
  url: string | null;
  normalizedUrl: string | null;
  platform: ApplicationSource | null;
  company: string | null;
  title: string | null;
  /** Where company/title came from. */
  detailsFrom: "user" | "url" | "none";
  error: string | null;
};

function words(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    // keep raw
  }
  s = s.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  // Title-case all-lowercase slugs; keep existing capitalization otherwise.
  return s === s.toLowerCase() ? s.replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s;
}

/** Company/title hints encoded in well-known posting URL paths. Never guesses for other sites. */
export function hintsFromUrl(raw: string): UrlHints {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { company: null, title: null };
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const none = { company: null, title: null };

  if (/(^|\.)linkedin\.com$/.test(host)) {
    // /jobs/view/apprentice-electrician-at-acme-electric-1234567890
    const slug = parts[0] === "jobs" && parts[1] === "view" ? parts[2] : undefined;
    const m = slug ? /^(.+)-at-(.+)-\d{6,}$/.exec(slug) : null;
    return m ? { title: words(m[1]!), company: words(m[2]!) } : none;
  }
  if (/\.myworkdayjobs\.com$/.test(host)) {
    // {tenant}.wd5.myworkdayjobs.com/{site}/job/{location}/{Title-Words}_{REQ}
    const tenant = host.split(".")[0] ?? "";
    const jobIdx = parts.indexOf("job");
    const titleSlug = jobIdx >= 0 ? parts[parts.length - 1] : undefined;
    const title = titleSlug ? words(titleSlug.replace(/_[A-Za-z0-9-]+$/, "")) : "";
    return { company: tenant && tenant !== "www" ? words(tenant) : null, title: title || null };
  }
  if (host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com") {
    // /{Company}/{id}-{title-slug}
    const company = parts[0] ? words(parts[0]) : null;
    const m = parts[1] ? /^\d+-(.+)$/.exec(parts[1]) : null;
    return { company, title: m ? words(m[1]!) : null };
  }
  if (/\.icims\.com$/.test(host)) {
    // careers-{company}.icims.com/jobs/{id}/{title-slug}/job
    const sub = host.split(".")[0] ?? "";
    const company = sub.replace(/^(careers|jobs|external|uscareers|careers2)-/, "");
    const jobsIdx = parts.indexOf("jobs");
    const titleSlug = jobsIdx >= 0 ? parts[jobsIdx + 2] : undefined;
    return {
      company: company && company !== sub ? words(company) : null,
      title: titleSlug && titleSlug !== "job" ? words(titleSlug) : null,
    };
  }
  if (/(^|\.)ziprecruiter\.com$/.test(host)) {
    // /c/{Company}/Job/{Title}/-in-{City},{ST}
    if (parts[0] === "c" && parts[2]?.toLowerCase() === "job" && parts[1] && parts[3]) {
      return { company: words(parts[1]), title: words(parts[3]) };
    }
    return none;
  }
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    // boards.greenhouse.io/{board}/jobs/{id}: the board token names the employer (approximately).
    const board = parts[0] && parts[0] !== "embed" ? parts[0] : u.searchParams.get("for");
    return { company: board ? words(board) : null, title: null };
  }
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    return { company: parts[0] ? words(parts[0]) : null, title: null };
  }
  return none;
}

/** Parse pasted text into URL lines (blank lines and lines starting with # are skipped). */
export function parseUrlLines(text: string): { lines: UrlLine[]; tooMany: boolean } {
  const out: UrlLine[] = [];
  const seen = new Map<string, number>();
  const raw = text.replace(/\r\n?/g, "\n").split("\n");
  let tooMany = false;
  for (let i = 0; i < raw.length; i++) {
    const lineText = raw[i]!.trim();
    if (!lineText || lineText.startsWith("#")) continue;
    if (out.length >= MAX_URL_LINES) {
      tooMany = true;
      break;
    }
    const base: UrlLine = {
      line: i + 1,
      url: null,
      normalizedUrl: null,
      platform: null,
      company: null,
      title: null,
      detailsFrom: "none",
      error: null,
    };
    if (lineText.length > MAX_LINE_CHARS) {
      out.push({ ...base, error: "Line is too long." });
      continue;
    }
    const [urlPart = "", companyPart, titlePart] = lineText.split(/\s*\|\s*|\t/).map((s) => s.trim());
    const candidate = /^www\./i.test(urlPart) ? `https://${urlPart}` : urlPart;
    let parsed: URL | null = null;
    try {
      parsed = new URL(candidate);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      out.push({ ...base, error: "Not a web address (it must start with https:// or http://)." });
      continue;
    }
    const normalizedUrl = normalizeUrl(candidate);
    if (!normalizedUrl) {
      out.push({ ...base, error: "Not a valid web address." });
      continue;
    }
    const dup = seen.get(normalizedUrl);
    if (dup !== undefined) {
      out.push({ ...base, url: candidate, normalizedUrl, error: `Same posting as line ${dup}.` });
      continue;
    }
    seen.set(normalizedUrl, i + 1);
    const userCompany = companyPart ? companyPart.slice(0, 200) : null;
    const userTitle = titlePart ? titlePart.slice(0, 200) : null;
    const hints = userCompany && userTitle ? { company: null, title: null } : hintsFromUrl(candidate);
    const company = userCompany ?? hints.company;
    const title = userTitle ?? hints.title;
    out.push({
      ...base,
      url: candidate,
      normalizedUrl,
      platform: detectPlatform(candidate),
      company,
      title,
      detailsFrom: userCompany || userTitle ? "user" : company || title ? "url" : "none",
    });
  }
  return { lines: out, tooMany };
}
