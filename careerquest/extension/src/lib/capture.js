/**
 * Capture payload construction and the auto/prompt decision (pure).
 *
 * The payload builder is an allow-list: only the documented fields ever make it
 * into the request body, regardless of what a detector returns.
 */

import { CAPTURE_KIND, CONFIDENCE, LIMITS, PLATFORMS } from "./constants.js";

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

/**
 * Builds the body for POST /api/extension/captures.
 * @param {Detection} detection
 * @param {{ kind: keyof typeof CAPTURE_KIND, confidence?: number, applicationId?: string, capturedAt?: string }} opts
 */
export function buildCapturePayload(detection, opts) {
  if (!CAPTURE_KIND[opts.kind]) throw new Error(`Unknown capture kind: ${opts.kind}`);
  const url = cleanString(detection.url, LIMITS.url);
  if (!url) throw new Error("A capture needs a URL.");
  const platform = PLATFORMS.includes(detection.platform) ? detection.platform : "OTHER";
  const detectedBy = Array.isArray(detection.detectedBy) ? detection.detectedBy.filter((s) => typeof s === "string").slice(0, 20) : [];
  const includeConfirmation = opts.kind === CAPTURE_KIND.CONFIRMATION_PAGE || opts.kind === CAPTURE_KIND.MANUAL_CONFIRMATION;
  const confirmationText = includeConfirmation ? cleanString(detection.confirmationText, LIMITS.confirmationText) : undefined;

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

/**
 * Fills missing job details on a confirmation/apply detection from the last job
 * page seen in the same tab (confirmation pages rarely repeat the title).
 * @param {Detection} detection
 * @param {Detection | null | undefined} lastJob
 */
export function mergeWithLastJob(detection, lastJob) {
  if (!lastJob) return detection;
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

/** Stable key used to avoid sending the same automatic capture twice. */
export function captureDedupeKey(payload) {
  const conf = payload.evidence?.confirmationText ? payload.evidence.confirmationText.slice(0, 80) : "";
  return `${payload.kind}|${payload.url}|${conf}`;
}
