/**
 * Capture payload construction and the auto/prompt decision (pure).
 *
 * The payload builder is an allow-list: only the documented fields ever make it
 * into the request body, regardless of what a detector returns.
 */

import { CAPTURE_KIND, CONFIDENCE, LIMITS, MEMORY, PLATFORMS } from "./constants.js";

/**
 * @typedef {object} Detection
 * @property {"JOB_PAGE"|"APPLY_STARTED"|"CONFIRMATION_PAGE"|null} kind
 * @property {string} platform
 * @property {string} url
 * @property {string} pageTitle
 * @property {string} [company]
 * @property {string} [title]
 * @property {string} [location]
 * @property {string} [salaryText]
 * @property {string} [requisitionId]
 * @property {number} confidence
 * @property {string[]} detectedBy
 * @property {string} [confirmationText]
 * @property {number} [seenAt]   when a JOB_PAGE was stored as the tab's last job
 */

/** @param {unknown} v @param {number} max */
function cleanString(v, max) {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

/** @param {unknown} n */
function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, Math.round(x * 100) / 100));
}

const EMAIL_RE = /[^\s@<>()[\]"',;:]+@[^\s<>()[\]"',;:]*/g;
const PHONE_CANDIDATE_RE = /(?<![\w-])\+?[\d(][\d\s().-]{7,}\d(?![\w-])/g;

/**
 * Masks e-mail addresses (also partial ones) and phone numbers (10–15 digits).
 * Same rule as the content script; applied again here so nothing unmasked can
 * reach the server even from an older content script.
 * @param {string | undefined} text
 */
export function maskPii(text) {
  if (typeof text !== "string" || !text) return text;
  return text.replace(EMAIL_RE, "[email]").replace(PHONE_CANDIDATE_RE, (m) => {
    const digits = m.replace(/\D/g, "").length;
    return digits >= 10 && digits <= 15 ? "[phone]" : m;
  });
}

/** Random identifier for one capture, reused by every retry of it. */
export function newCaptureId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Builds the body for POST /api/extension/captures.
 * @param {Detection} detection
 * @param {{ kind: keyof typeof CAPTURE_KIND, confidence?: number, applicationId?: string, capturedAt?: string, captureId?: string }} opts
 */
export function buildCapturePayload(detection, opts) {
  if (!CAPTURE_KIND[opts.kind]) throw new Error(`Unknown capture kind: ${opts.kind}`);
  const url = cleanString(detection.url, LIMITS.url);
  if (!url) throw new Error("A capture needs a URL.");
  const platform = PLATFORMS.includes(detection.platform) ? detection.platform : "OTHER";
  const detectedBy = Array.isArray(detection.detectedBy) ? detection.detectedBy.filter((s) => typeof s === "string").slice(0, 20) : [];
  const includeConfirmation = opts.kind === CAPTURE_KIND.CONFIRMATION_PAGE || opts.kind === CAPTURE_KIND.MANUAL_CONFIRMATION;
  const confirmationText = includeConfirmation ? cleanString(maskPii(detection.confirmationText), LIMITS.confirmationText) : undefined;

  /** @type {Record<string, unknown>} */
  const payload = {
    kind: opts.kind,
    url,
    platform,
    company: cleanString(detection.company, LIMITS.company),
    title: cleanString(detection.title, LIMITS.title),
    location: cleanString(detection.location, LIMITS.location),
    salaryText: cleanString(detection.salaryText, LIMITS.salaryText),
    requisitionId: cleanString(detection.requisitionId, LIMITS.requisitionId),
    confidence: clamp01(opts.confidence ?? detection.confidence),
    evidence: {
      pageTitle: cleanString(detection.pageTitle, LIMITS.pageTitle) ?? "",
      detectedBy,
      ...(confirmationText ? { confirmationText } : {}),
      capturedAt: opts.capturedAt ?? new Date().toISOString(),
      // Idempotency key: retries of this capture carry the same id so the
      // server can ignore duplicate deliveries.
      captureId: cleanString(opts.captureId, 64) ?? newCaptureId(),
    },
  };
  if (opts.applicationId) payload.applicationId = String(opts.applicationId).slice(0, 64);
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  return payload;
}

/**
 * What the background should do with a fresh detection.
 * @param {Detection | null | undefined} detection
 * @returns {"auto_confirm" | "prompt" | "apply_started" | "job_page" | "none"}
 */
export function decideAction(detection) {
  if (!detection || !detection.kind) return "none";
  const c = Number(detection.confidence) || 0;
  if (detection.kind === "CONFIRMATION_PAGE") {
    if (c >= CONFIDENCE.AUTO_CONFIRM) return "auto_confirm";
    if (c >= CONFIDENCE.PROMPT_MIN) return "prompt";
    return "none";
  }
  if (detection.kind === "APPLY_STARTED") return "apply_started";
  if (detection.kind === "JOB_PAGE") return "job_page";
  return "none";
}

/* ----------------------------- same job? -------------------------------- */

/** Query parameters that carry a job id on the supported boards. */
const JOB_ID_PARAMS = new Set(["jk", "vjk", "jobid", "jid", "reqid", "requisitionid", "currentjobid", "gh_jid", "jobpostingid", "postingid"]);

/**
 * Job identifiers visible in a URL: 4+ digit runs and requisition-shaped
 * tokens in the path, and the values of known job-id query parameters.
 * @param {string | undefined} url
 * @returns {Set<string>}
 */
export function urlJobIds(url) {
  const ids = new Set();
  let u;
  try {
    u = new URL(String(url || ""));
  } catch {
    return ids;
  }
  for (const m of u.pathname.matchAll(/\d{4,}/g)) ids.add(m[0]);
  // requisition-shaped path tokens such as Workday's "…_R-20417" or "JR-123"
  for (const m of u.pathname.matchAll(/(?<![a-z0-9])[a-z]{1,4}-\d{3,}(?![a-z0-9])/gi)) ids.add(m[0].toLowerCase());
  for (const [k, v] of u.searchParams) if (JOB_ID_PARAMS.has(k.toLowerCase()) && v) ids.add(v.toLowerCase());
  return ids;
}

/** @param {unknown} s */
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Both present and neither contains the other. */
function conflicts(a, b) {
  const x = norm(a);
  const y = norm(b);
  return !!(x && y && !x.includes(y) && !y.includes(x));
}

/** @param {string | undefined} url */
function hostOf(url) {
  try {
    return new URL(String(url || "")).hostname;
  } catch {
    return "";
  }
}

/** Same host and one path is a prefix of the other (at least two segments deep). */
function sharesPathPrefix(a, b) {
  try {
    const ua = new URL(String(a || ""));
    const ub = new URL(String(b || ""));
    if (ua.hostname !== ub.hostname) return false;
    const pa = ua.pathname.replace(/\/+$/, "");
    const pb = ub.pathname.replace(/\/+$/, "");
    const [short, long] = pa.length <= pb.length ? [pa, pb] : [pb, pa];
    return short.split("/").filter(Boolean).length >= 2 && (long === short || long.startsWith(`${short}/`));
  } catch {
    return false;
  }
}

/**
 * Do two detections describe the same job posting?
 * true: an identifier agrees (requisition id, a job id in both URLs, or one
 * URL nested under the other); false: something contradicts (different
 * platform, requisition id, title, company or URL job ids); null: unknown.
 * @param {Partial<Detection> & { jobPageUrl?: string } | null | undefined} a
 * @param {Partial<Detection> & { jobPageUrl?: string } | null | undefined} b
 * @returns {boolean | null}
 */
export function isSameJob(a, b) {
  if (!a || !b) return null;
  if (a.platform && b.platform && a.platform !== b.platform) return false;
  const ra = norm(a.requisitionId);
  const rb = norm(b.requisitionId);
  if (ra && rb) return ra === rb;
  if (conflicts(a.title, b.title) || conflicts(a.company, b.company)) return false;
  const ia = urlJobIds(a.url);
  const ib = urlJobIds(b.url);
  if (ia.size && ib.size) return [...ia].some((x) => ib.has(x));
  if (sharesPathPrefix(a.url, b.url)) return true;
  if (a.jobPageUrl && b.url && a.jobPageUrl === b.url) return true;
  if (b.jobPageUrl && a.url && b.jobPageUrl === a.url) return true;
  return null;
}

/**
 * Fills missing job details on a confirmation/apply detection from the last job
 * page seen in the same tab (confirmation pages rarely repeat the title) — but
 * only when that job page is recent, on the same site, and nothing indicates
 * it was a different job.
 * @param {Detection} detection
 * @param {Detection | null | undefined} lastJob
 * @param {{ now?: number, ttlMs?: number }} [opts]
 */
export function mergeWithLastJob(detection, lastJob, opts = {}) {
  if (!lastJob) return detection;
  const now = opts.now ?? Date.now();
  const ttl = opts.ttlMs ?? MEMORY.LAST_JOB_TTL_MS;
  if (typeof lastJob.seenAt === "number" && now - lastJob.seenAt > ttl) return detection;
  if (isSameJob(detection, lastJob) === false) return detection;
  // Company sites share one platform value: require the same host there.
  const generic = !detection.platform || detection.platform === "COMPANY_SITE" || detection.platform === "OTHER";
  if (generic && hostOf(detection.url) !== hostOf(lastJob.url)) return detection;
  const merged = { ...detection };
  let filled = false;
  for (const key of ["company", "title", "location", "salaryText", "requisitionId"]) {
    if (!merged[key] && lastJob[key]) {
      merged[key] = lastJob[key];
      filled = true;
    }
  }
  if (!filled) return detection;
  merged.detectedBy = [...(Array.isArray(merged.detectedBy) ? merged.detectedBy : []), "prefilled-from-job-page"];
  if (lastJob.url) merged.jobPageUrl = lastJob.url;
  return merged;
}

/* ----------------------------- remembered keys -------------------------- */

/** Stable key used to avoid sending the same automatic capture twice. */
export function captureDedupeKey(payload) {
  const conf = payload.evidence?.confirmationText ? payload.evidence.confirmationText.slice(0, 80) : "";
  return `${payload.kind}|${payload.url}|${conf}`;
}

/**
 * Key of the prompt a detection raises: same page + same matched phrase =
 * same prompt, so an answered prompt is not asked again when the page merely
 * re-renders (title counters, late DOM updates) or reloads.
 * @param {Partial<Detection> | null | undefined} detection
 */
export function promptKey(detection) {
  const by = Array.isArray(detection?.detectedBy) ? detection.detectedBy : [];
  const phrase = by.find((s) => typeof s === "string" && /^(weak-)?phrase:/.test(s)) || "";
  return `${detection?.kind || ""}|${detection?.url || ""}|${phrase.toLowerCase()}`;
}

/**
 * Drops expired entries and keeps at most `max` (newest) of a key → timestamp
 * (or { at }) map.
 * @param {Record<string, number | { at: number }>} map
 * @param {number} now
 * @param {number} ttlMs
 * @param {number} [max]
 */
export function pruneKeys(map, now, ttlMs, max = MEMORY.MAX_KEYS) {
  const at = (v) => (typeof v === "number" ? v : Number(v && v.at) || 0);
  const entries = Object.entries(map || {})
    .filter(([, v]) => now - at(v) < ttlMs)
    .sort((x, y) => at(y[1]) - at(x[1]))
    .slice(0, max);
  return Object.fromEntries(entries);
}
