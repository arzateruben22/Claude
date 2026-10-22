// GENERATED from js/skin/core/consent.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — consent gates (shared)
 *
 * Four separate consents (server/migrations/0003_consents.sql). The newest
 * answer per kind is the one in force; a withdrawn yes is a no. What each
 * one unlocks is decided here and enforced in the functions; the pages use
 * the same rules only to explain, never to authorize.
 */

export const CONSENT_KINDS = ["clinical_photography", "treatment", "ai_processing", "marketing"];

export const CONSENT_LABELS = {
  clinical_photography: "Photos of my skin for my record",
  treatment: "Keeping my treatment records",
  ai_processing: "An AI assistant may read photos I send with a chat question",
  marketing: "Photos without my name in Lumevina's own posts",
};

/** { kind: { active, version, recorded_at, granted, withdrawn_at } } from consent rows (any order). */
export function consentState(rows) {
  const out = {};
  for (const k of CONSENT_KINDS) out[k] = { active: false, version: null, recorded_at: null, granted: null, withdrawn_at: null };
  const sorted = [...(rows ?? [])].sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)));
  const seen = new Set();
  for (const r of sorted) {
    if (!CONSENT_KINDS.includes(r.kind) || seen.has(r.kind)) continue;
    seen.add(r.kind);
    out[r.kind] = { active: !!r.granted && !r.withdrawn_at, version: r.version, recorded_at: r.recorded_at, granted: !!r.granted, withdrawn_at: r.withdrawn_at ?? null };
  }
  return out;
}

export const may = {
  /** Take or add photos to their record (client or practitioner). */
  capture: (s) => !!s?.clinical_photography?.active,
  /** Analyse their photos: the same consent; analysis runs in Lumevina's own worker, never an AI service. */
  analyze: (s) => !!s?.clinical_photography?.active,
  /** Write a treatment record. */
  recordTreatment: (s) => !!s?.treatment?.active,
  /** Send chat photos to the AI assistant to draft a reply. */
  sendPhotosToAI: (s) => !!s?.ai_processing?.active,
  /** Use photos in Lumevina's own marketing. */
  marketing: (s) => !!s?.marketing?.active,
};

/** Why an action is blocked, in a sentence, or "" when it isn't. */
export function blockedReason(action, s) {
  if (may[action]?.(s)) return "";
  switch (action) {
    case "capture": case "analyze":
      return "Photos can't be added until the client has agreed to photos of their skin for their record.";
    case "recordTreatment":
      return "A treatment record can't be saved until the client has agreed to treatment records being kept.";
    case "sendPhotosToAI":
      return "Without the client's yes, chat photos go to Evelyn only.";
    case "marketing":
      return "The client has not agreed to photos in Lumevina's posts.";
    default: return "Not allowed.";
  }
}
