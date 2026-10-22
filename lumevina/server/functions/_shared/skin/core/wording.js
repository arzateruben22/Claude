// GENERATED from js/skin/core/wording.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — the wording guard (shared)
 *
 * Lumevina is an esthetician's studio. Nothing it shows may diagnose,
 * promise results, claim to measure a biological property from a
 * photograph, invent a percentage improvement or a 0–100 score, or say why
 * skin changed. Every built-in label and message is checked against these
 * rules in the tests; text a practitioner writes for a client (a report
 * summary, a treatment summary) is checked when she saves it, and she sees
 * what to reword. The rules are deliberately broad: a false alarm costs a
 * rewording, a miss costs trust.
 */

export const RULES = [
  { id: "diagnosis", re: /\b(diagnos\w*|you have (acne|rosacea|melasma|eczema|psoriasis|dermatitis)|condition is|disease)\b/i,
    why: "Names or diagnoses a condition. An esthetician describes how skin looks; a doctor diagnoses." },
  { id: "biology", re: /\b(collagen (density|level|production|increase|boost)|hydration (level|increase)|more hydrated|elasticity|firmness (increase|improve)|dermal thickness|cell(ular)? (turnover|regeneration)|skin age|biological age|years younger)\b/i,
    why: "Claims a biological measurement photographs cannot make." },
  { id: "healing", re: /\b(fully )?healed\b|\btissue (repair|healing)\b|\bmicroscopic(ally)? heal/i,
    why: "Claims tissue healing, which photographs cannot show." },
  { id: "percent", re: /\b\d{1,3}(\.\d+)?\s?%\s*(better|improve\w*|smoother|clearer|less|fewer|reduction|reduced|younger|brighter)\b|\b(improve\w*|reduc\w*|smoother|clearer)\s+(by\s+)?\d{1,3}(\.\d+)?\s?%/i,
    why: "States a percentage improvement. Show the measured values and whether the change exceeds the repeatability threshold instead." },
  { id: "score", re: /\b(skin|glow|health|clarity|texture|overall)\s+score\b|\b\d{1,3}\s?\/\s?100\b|\bscore(d)? (of )?\d{1,3}\b/i,
    why: "Uses a 0–100 or invented score." },
  { id: "promise", re: /\b(guarantee\w*|will (remove|erase|cure|eliminate|fix)|permanent(ly)? (remove|results)|cure[sd]?)\b/i,
    why: "Promises a result." },
  { id: "cause", re: /\b(because (you|of your)|due to (your|not)|caused by|thanks to (the|your)|(didn'?t|did not|not) (use|follow|stick)\w*.{0,30}routine)\b/i,
    why: "Gives a cause for a change. Lighting, hydration, inflammation, recovery, medications and the environment all change how skin looks; the measurements cannot say why." },
  { id: "certainty", re: /\b(proves?|proven|definitely|certainly|100% (accurate|sure))\b/i,
    why: "Claims certainty the measurements do not have." },
];

/** Every rule the text breaks, as [{ id, why, match }]. Empty when it reads fine. */
export function checkWording(text) {
  const t = String(text ?? "");
  const out = [];
  for (const r of RULES) {
    const m = t.match(r.re);
    if (m) out.push({ id: r.id, why: r.why, match: m[0] });
  }
  return out;
}

export const isSafeWording = (text) => checkWording(text).length === 0;

/** The line every comparison carries. */
export const CONFOUNDERS = "Lighting, hydration, inflammation, recovery from a treatment, medications and the environment can all change how skin looks in a photo.";
export const SCOPE_NOTE = "These measurements describe how your skin looks in photographs taken the same way each visit. They are not a medical assessment.";
