/* Lumevina Skin Intelligence — personalized change detection (shared)
 *
 * Compares one measurement between two visits of the same client, same
 * region, and decides only what the numbers allow:
 *   invalid_comparison    the two images can't be compared (region, device,
 *                         calibration, algorithm, failed quality)
 *   uncertain             comparable, but there is no validated repeatability
 *                         threshold yet, or an image is only marginal quality
 *   no_meaningful_change  the difference is within what the measurement moves
 *                         when nothing about the skin has changed
 *   improvement / deterioration
 *                         the difference exceeds the validated threshold, in
 *                         the direction the catalog calls better or worse
 * It never says why. Deterioration is flagged for the practitioner's review,
 * never shown to the client until she confirms and chooses to share it.
 */

import { MEASUREMENTS, labelFor, isCalibrated } from "./measurements.js";
import { regionLabel } from "./regions.js";
import { CONFOUNDERS } from "./wording.js";

export const CHANGE_VERSION = "change-1";
export const VERDICTS = ["improvement", "deterioration", "no_meaningful_change", "uncertain", "invalid_comparison"];

/**
 * @param {object} a  earlier: { value, quality, comparable, calibration_status, device_kind, um_per_px, algorithm_version, region, name, review_status }
 * @param {object} b  later, same shape
 * @param {object|null} validation  { status, repeatability_coefficient } for this name, region and device kind
 */
export function classifyChange(a, b, validation) {
  const reasons = [];
  const def = MEASUREMENTS[a?.name];
  if (!def || !b || a.name !== b.name) return out("invalid_comparison", ["different_measurements"]);
  if (a.region !== b.region) reasons.push("different_regions");
  if (a.comparable === false || b.comparable === false) reasons.push("failed_quality_check");
  if (a.review_status === "rejected" || b.review_status === "rejected") reasons.push("rejected_by_practitioner");
  if ((a.device_kind ?? null) !== (b.device_kind ?? null)) reasons.push("different_devices");
  if (isCalibrated(a.calibration_status) !== isCalibrated(b.calibration_status)) reasons.push("calibration_differs");
  else if (isCalibrated(a.calibration_status) && a.um_per_px && b.um_per_px
           && Math.abs(a.um_per_px - b.um_per_px) / Math.max(a.um_per_px, b.um_per_px) > 0.1) reasons.push("scale_differs");
  if (a.algorithm_version !== b.algorithm_version) reasons.push("different_algorithm_versions");
  if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) reasons.push("missing_value");
  if (reasons.length) return out("invalid_comparison", reasons);

  const delta = b.value - a.value;
  const threshold = validation && validation.status === "validated" && Number.isFinite(validation.repeatability_coefficient)
    ? validation.repeatability_coefficient : null;
  if (threshold == null) return out("uncertain", ["not_validated"], delta, null);
  if (a.quality === "poor" || b.quality === "poor") return out("invalid_comparison", ["poor_quality"], delta, threshold);
  if (a.quality === "marginal" || b.quality === "marginal") return out("uncertain", ["marginal_quality"], delta, threshold);
  if (Math.abs(delta) <= threshold) return out("no_meaningful_change", ["within_repeatability"], delta, threshold);
  const better = def.better === "lower" ? delta < 0 : delta > 0;
  return out(better ? "improvement" : "deterioration", ["exceeds_repeatability"], delta, threshold);

  function out(verdict, why, d = null, t = null) {
    return { verdict, reasons: why, delta: d, threshold: t, version: CHANGE_VERSION };
  }
}

const REASON_TEXT = {
  different_measurements: "they are different measurements",
  different_regions: "the images show different areas",
  failed_quality_check: "one of the images did not pass the quality check",
  rejected_by_practitioner: "the practitioner did not confirm one of the measurements",
  different_devices: "the images were taken with different kinds of camera",
  calibration_differs: "only one of the images is calibrated",
  scale_differs: "the images were taken at different magnifications",
  different_algorithm_versions: "they were measured by different versions of the analysis",
  missing_value: "one of the measurements has no value",
  not_validated: "this measurement has not yet been validated for repeatability, so small differences can't be told apart from photo-to-photo variation",
  marginal_quality: "one of the images is only of marginal quality",
  poor_quality: "one of the images is of poor quality",
  within_repeatability: "the difference is within what this measurement varies between photos of unchanged skin",
  exceeds_repeatability: "the difference exceeds the established repeatability threshold for this measurement",
};
export const reasonText = (r) => REASON_TEXT[r] ?? r;

/* How a change in each measurement reads, better then worse, as a full predicate. */
const DIRECTION_WORDS = {
  pore_density: ["shows fewer visible pore-like features", "shows more visible pore-like features"],
  pore_size_median: ["shows smaller-looking pores", "shows larger-looking pores"],
  pore_visibility: ["shows less prominent pores", "shows more prominent pores"],
  texture_roughness: ["appears smoother", "appears rougher"],
  texture_uniformity: ["appears more even in texture", "appears less even in texture"],
  tone_evenness: ["appears more even in tone", "appears less even in tone"],
  pigment_spot_area: ["shows less dark-spot area", "shows more dark-spot area"],
  pigment_contrast: ["shows less contrast in its darker spots", "shows more contrast in its darker spots"],
  redness_a_star: ["appears less red", "appears redder"],
  redness_area: ["shows less widespread redness", "shows more widespread redness"],
  fine_line_density: ["shows fewer visible fine lines", "shows more visible fine lines"],
  scar_contrast: ["appears closer in colour to the surrounding skin", "appears more different in colour from the surrounding skin"],
  scar_texture_ratio: ["appears closer in texture to the surrounding skin", "appears more different in texture from the surrounding skin"],
  scar_area: ["shows a smaller visible scar area", "shows a larger visible scar area"],
};

/**
 * One plain paragraph about a classified change. audience: 'practitioner'
 * (every verdict, with the recommendation to review) or 'client' (only what
 * the practitioner confirmed and shared).
 */
export function changeMessage(name, region, result, audience = "practitioner") {
  const area = regionLabel(region).toLowerCase();
  const label = labelFor(name).toLowerCase();
  const [good, bad] = DIRECTION_WORDS[name] ?? ["appears different", "appears different"];
  switch (result.verdict) {
    case "improvement":
      return `The ${area} ${good} than at the earlier visit. This change exceeds the established repeatability threshold for ${label}.` +
        (audience === "practitioner" ? " Review before sharing." : "");
    case "deterioration":
      return `The ${area} ${bad} than at the earlier visit. This change exceeds the established repeatability threshold for ${label}.` +
        (audience === "practitioner" ? ` Practitioner review recommended. ${CONFOUNDERS}` : ` ${CONFOUNDERS}`);
    case "no_meaningful_change":
      return `No meaningful change in ${label} on the ${area}: ${reasonText("within_repeatability")}.`;
    case "uncertain":
      return `The change in ${label} on the ${area} is uncertain: ${result.reasons.map(reasonText).join("; ")}.`;
    default:
      return `These two images can't be compared for ${label}: ${result.reasons.map(reasonText).join("; ")}.`;
  }
}
