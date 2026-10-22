/**
 * Greenhouse and Lever public postings adapters (Experimental: job details only).
 *
 * Both platforms publish unauthenticated job-board APIs for *postings*. Neither exposes a candidate's
 * applications, so these adapters implement getJobDetails only. API URLs are built exclusively from
 * validated path segments on fixed hosts (no user-controlled host ever reaches fetch). The build
 * environment cannot reach either API, so the adapters are tested with simulated responses and every
 * result carries `liveVerified: false`.
 */
import { z } from "zod";
import { decodeEntities, htmlToText } from "@/lib/email/html";
import { getProvider } from "../registry";
import { getPublicJson } from "./http";
import { IntegrationHttpError, NotSupportedError, type FetchLike, type IntegrationAdapter, type JobDetails } from "./types";

const DESCRIPTION_MAX = 20_000;
const BOARD_TOKEN = /^[A-Za-z0-9_-]{1,100}$/;
const NUMERIC_ID = /^\d{1,20}$/;
const LEVER_SITE = /^[A-Za-z0-9._-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cap(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > DESCRIPTION_MAX ? `${t.slice(0, DESCRIPTION_MAX)}…` : t;
}

function parseUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Greenhouse
// ---------------------------------------------------------------------------

export type GreenhouseRef = { board: string; jobId: string };

/**
 * boards.greenhouse.io/{board}/jobs/{id}, job-boards.greenhouse.io/{board}/jobs/{id},
 * boards.greenhouse.io/embed/job_app?for={board}&token={id}. Company-site URLs with only ?gh_jid=
 * do not name the board, so they cannot be looked up.
 */
export function parseGreenhouseUrl(raw: string): GreenhouseRef | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (!/(^|\.)greenhouse\.io$/.test(host)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed") {
    const board = u.searchParams.get("for");
    const jobId = u.searchParams.get("token") ?? u.searchParams.get("gh_jid");
    return board && jobId && BOARD_TOKEN.test(board) && NUMERIC_ID.test(jobId) ? { board: board.toLowerCase(), jobId } : null;
  }
  const i = parts.indexOf("jobs");
  if (i === 1 && parts[0] && parts[2] && BOARD_TOKEN.test(parts[0]) && NUMERIC_ID.test(parts[2])) {
    return { board: parts[0].toLowerCase(), jobId: parts[2] };
  }
  const ghjid = u.searchParams.get("gh_jid");
  if (parts[0] && ghjid && BOARD_TOKEN.test(parts[0]) && NUMERIC_ID.test(ghjid)) return { board: parts[0].toLowerCase(), jobId: ghjid };
  return null;
}

export function greenhouseApiUrl(ref: GreenhouseRef): string {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(ref.board)}/jobs/${encodeURIComponent(ref.jobId)}`;
}

const greenhouseJobSchema = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string().min(1),
  updated_at: z.string().nullish(),
  requisition_id: z.string().nullish(),
  company_name: z.string().nullish(),
  location: z.object({ name: z.string().nullish() }).nullish(),
  absolute_url: z.string().nullish(),
  content: z.string().nullish(),
  departments: z.array(z.object({ name: z.string().nullish() })).nullish(),
});

export async function fetchGreenhouseJob(fetchFn: FetchLike, url: string): Promise<JobDetails> {
  const ref = parseGreenhouseUrl(url);
  if (!ref) {
    throw new NotSupportedError("GREENHOUSE", "getJobDetails", "This is not a Greenhouse job-board URL that names its board and job id.");
  }
  const apiUrl = greenhouseApiUrl(ref);
  const job = await getPublicJson(fetchFn, apiUrl, greenhouseJobSchema);
  // Greenhouse returns `content` as entity-escaped HTML.
  const description = job.content ? htmlToText(decodeEntities(job.content)) : null;
  const updatedAt = job.updated_at ? new Date(job.updated_at) : null;
  return {
    provider: "GREENHOUSE",
    sourceUrl: url,
    apiUrl,
    externalId: String(job.id),
    title: job.title.trim(),
    company: job.company_name?.trim() || null,
    location: job.location?.name?.trim() || null,
    department: job.departments?.find((d) => d.name)?.name?.trim() ?? null,
    employmentType: null,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    descriptionText: cap(description),
    applyUrl: job.absolute_url && parseUrl(job.absolute_url) ? job.absolute_url : null,
    liveVerified: false,
  };
}

// ---------------------------------------------------------------------------
// Lever
// ---------------------------------------------------------------------------

export type LeverRef = { site: string; postingId: string; region: "global" | "eu" };

/** jobs.lever.co/{site}/{uuid}[/apply] and jobs.eu.lever.co/{site}/{uuid}. */
export function parseLeverUrl(raw: string): LeverRef | null {
  const u = parseUrl(raw);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const region = host === "jobs.lever.co" ? "global" : host === "jobs.eu.lever.co" ? "eu" : null;
  if (!region) return null;
  const [site, id] = u.pathname.split("/").filter(Boolean);
  if (!site || !id || !LEVER_SITE.test(site) || !UUID.test(id)) return null;
  return { site: site.toLowerCase(), postingId: id.toLowerCase(), region };
}

export function leverApiUrl(ref: LeverRef): string {
  const host = ref.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  return `https://${host}/v0/postings/${encodeURIComponent(ref.site)}/${encodeURIComponent(ref.postingId)}`;
}

const leverPostingSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  categories: z
    .object({
      location: z.string().nullish(),
      team: z.string().nullish(),
      department: z.string().nullish(),
      commitment: z.string().nullish(),
    })
    .nullish(),
  description: z.string().nullish(),
  descriptionPlain: z.string().nullish(),
  hostedUrl: z.string().nullish(),
  applyUrl: z.string().nullish(),
  createdAt: z.number().nullish(),
});

export async function fetchLeverPosting(fetchFn: FetchLike, url: string): Promise<JobDetails> {
  const ref = parseLeverUrl(url);
  if (!ref) throw new NotSupportedError("LEVER", "getJobDetails", "This is not a Lever posting URL (jobs.lever.co/{company}/{id}).");
  const apiUrl = leverApiUrl(ref);
  const p = await getPublicJson(fetchFn, apiUrl, leverPostingSchema);
  if (p.id.toLowerCase() !== ref.postingId) throw new IntegrationHttpError("Lever returned a different posting than requested.", 200);
  const description = p.descriptionPlain ?? (p.description ? htmlToText(p.description) : null);
  const created = typeof p.createdAt === "number" ? new Date(p.createdAt) : null;
  const apply = p.applyUrl ?? p.hostedUrl ?? null;
  return {
    provider: "LEVER",
    sourceUrl: url,
    apiUrl,
    externalId: p.id,
    title: p.text.trim(),
    // Lever's postings API does not return the employer's display name; the site slug is not one.
    company: null,
    location: p.categories?.location?.trim() || null,
    department: p.categories?.department?.trim() || p.categories?.team?.trim() || null,
    employmentType: p.categories?.commitment?.trim() || null,
    updatedAt: created && !Number.isNaN(created.getTime()) ? created : null,
    descriptionText: cap(description),
    applyUrl: apply && parseUrl(apply) ? apply : null,
    liveVerified: false,
  };
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

export function createGreenhouseAdapter(fetchFn: FetchLike): IntegrationAdapter {
  return {
    provider: "GREENHOUSE",
    capabilities: getProvider("GREENHOUSE")!.capabilities,
    getJobDetails: (url: string) => fetchGreenhouseJob(fetchFn, url),
  };
}

export function createLeverAdapter(fetchFn: FetchLike): IntegrationAdapter {
  return {
    provider: "LEVER",
    capabilities: getProvider("LEVER")!.capabilities,
    getJobDetails: (url: string) => fetchLeverPosting(fetchFn, url),
  };
}
