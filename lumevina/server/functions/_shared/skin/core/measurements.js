// GENERATED from js/skin/core/measurements.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — what is measured, and what is not (shared)
 *
 * Every measurement the worker produces is named here, with the words the
 * client and the practitioner see, its unit (calibrated and uncalibrated),
 * which direction counts as "looking better", and what it actually is.
 * Everything starts experimental: a measurement becomes trustworthy for a
 * region and kind of device only when the repeatability protocol
 * (skin-intelligence/VALIDATION.md) has produced a threshold for it.
 *
 * These describe how skin LOOKS in a photograph under the capture
 * conditions. None of them measures a biological property; the list of what
 * photographs cannot measure is NOT_MEASURED below, and the UI shows it.
 */

export const ALGORITHM_FAMILY = "lumevina-skin";

export const MEASUREMENTS = {
  pore_density: {
    label: "Visible pore-like features", short: "Pores",
    unit: { calibrated: "per cm²", uncalibrated: "per 10k px" }, better: "lower", decimals: 1,
    what: "How many small, round, darker-than-surrounding spots of pore size the image shows in the region.",
    method: "Difference-of-Gaussian blob detection on the lightness channel, size range set by calibration.",
  },
  pore_size_median: {
    label: "Apparent pore size (median)", short: "Pore size",
    unit: { calibrated: "µm", uncalibrated: "px" }, better: "lower", decimals: 0, needsCalibration: false,
    what: "The middle value of the detected pore-like features' diameters.",
    method: "Blob scale × √2, converted with the image's micrometres per pixel when calibrated.",
  },
  pore_visibility: {
    label: "Pore visibility", short: "Pore contrast",
    unit: { calibrated: "ΔL*", uncalibrated: "ΔL*" }, better: "lower", decimals: 2,
    what: "How much darker the pore-like features look than the skin right around them.",
    method: "Mean lightness difference (CIE L*) between each feature and a ring around it.",
  },
  texture_roughness: {
    label: "Visible texture", short: "Texture",
    unit: { calibrated: "L* SD", uncalibrated: "L* SD" }, better: "lower", decimals: 2,
    what: "How much the lightness varies over short distances once shading is removed: bumps, grain, unevenness of surface.",
    method: "Standard deviation of the high-pass filtered L* channel at a fixed physical scale.",
  },
  texture_uniformity: {
    label: "Texture uniformity", short: "Uniformity",
    unit: { calibrated: "0–1", uncalibrated: "0–1" }, better: "higher", decimals: 3,
    what: "How alike neighbouring patches of skin look (1 is perfectly even).",
    method: "Grey-level co-occurrence homogeneity of the high-pass L* channel.",
  },
  tone_evenness: {
    label: "Tone unevenness", short: "Tone",
    unit: { calibrated: "L* IQR", uncalibrated: "L* IQR" }, better: "lower", decimals: 2,
    what: "The spread between lighter and darker skin across the region.",
    method: "Interquartile range of smoothed L* within the region.",
  },
  pigment_spot_area: {
    label: "Dark-spot appearance", short: "Dark spots",
    unit: { calibrated: "% of region", uncalibrated: "% of region" }, better: "lower", decimals: 2,
    what: "The share of the region covered by spots noticeably darker and browner than the surrounding skin.",
    method: "Adaptive threshold on L* and b* relative to the local median, small specks removed.",
  },
  pigment_contrast: {
    label: "Pigmentation contrast", short: "Spot contrast",
    unit: { calibrated: "ΔE", uncalibrated: "ΔE" }, better: "lower", decimals: 2,
    what: "How different the darker spots look from the skin around them.",
    method: "CIEDE2000 colour difference between spot pixels and the surrounding skin.",
  },
  redness_a_star: {
    label: "Visible redness", short: "Redness",
    unit: { calibrated: "a*", uncalibrated: "a*" }, better: "lower", decimals: 2,
    what: "How red the region looks on average (the red–green axis of colour).",
    method: "Mean CIE a* after white balance from the grey reference when one is in the frame.",
  },
  redness_area: {
    label: "Redness spread", short: "Red areas",
    unit: { calibrated: "% of region", uncalibrated: "% of region" }, better: "lower", decimals: 2,
    what: "The share of the region noticeably redder than the client's own typical skin there.",
    method: "Pixels whose a* exceeds the region median by a fixed margin.",
  },
  fine_line_density: {
    label: "Visible fine lines", short: "Fine lines",
    unit: { calibrated: "mm per cm²", uncalibrated: "px per 10k px" }, better: "lower", decimals: 2,
    what: "The total length of thin, line-like creases the image shows, per area.",
    method: "Multi-scale ridge filter (Frangi) on L*, thresholded and skeletonized.",
  },
  scar_contrast: {
    label: "Scar colour contrast", short: "Scar colour",
    unit: { calibrated: "ΔE", uncalibrated: "ΔE" }, better: "lower", decimals: 2,
    what: "How different the marked scar looks in colour from the skin around it.",
    method: "CIEDE2000 between the practitioner-drawn scar area and a ring of surrounding skin.",
  },
  scar_texture_ratio: {
    label: "Texture around the scar", short: "Scar texture",
    unit: { calibrated: "ratio", uncalibrated: "ratio" }, better: "lower", decimals: 2,
    what: "How much rougher the scar area looks than the skin around it (1 is the same).",
    method: "Ratio of high-pass L* standard deviation inside the scar outline to the surrounding ring.",
  },
  scar_area: {
    label: "Visible scar area", short: "Scar area",
    unit: { calibrated: "mm²", uncalibrated: "px" }, better: "lower", decimals: 1, needsCalibration: true,
    what: "The area of the scar as outlined on the image.",
    method: "Polygon area of the practitioner's outline, converted with calibration.",
  },
};

export const MEASUREMENT_NAMES = Object.keys(MEASUREMENTS);

export const GROUPS = [
  { id: "pores", label: "Pores", names: ["pore_density", "pore_size_median", "pore_visibility"] },
  { id: "texture", label: "Texture", names: ["texture_roughness", "texture_uniformity"] },
  { id: "tone", label: "Tone and pigmentation", names: ["tone_evenness", "pigment_spot_area", "pigment_contrast"] },
  { id: "redness", label: "Redness", names: ["redness_a_star", "redness_area"] },
  { id: "lines", label: "Fine lines", names: ["fine_line_density"] },
  { id: "scars", label: "Scars", names: ["scar_contrast", "scar_texture_ratio", "scar_area"] },
];

/** What photographs cannot measure, and what would be needed instead. Shown in the UI. */
export const NOT_MEASURED = [
  { what: "Scar depth, volume and 3D surface shape", needs: "a calibrated depth or 3D imaging device, validated" },
  { what: "Scar translucency or opacity as a tissue property", needs: "a validated optical measurement method" },
  { what: "Collagen density", needs: "clinical imaging such as ultrasound or biopsy" },
  { what: "Skin hydration", needs: "a corneometer or similar instrument" },
  { what: "Elasticity or firmness", needs: "a cutometer or similar instrument" },
  { what: "Dermal thickness", needs: "high-frequency ultrasound" },
  { what: "Cellular regeneration or microscopic healing", needs: "laboratory methods" },
  { what: "Biological skin age", needs: "no validated photographic method exists" },
  { what: "Any skin condition or disease", needs: "a doctor; this is never diagnosed here" },
];

export const unitFor = (name, calibrated) => {
  const m = MEASUREMENTS[name];
  return m ? (calibrated ? m.unit.calibrated : m.unit.uncalibrated) : "";
};
export const isCalibrated = (status) => status === "device_calibrated" || status === "reference_in_frame";
export const labelFor = (name) => MEASUREMENTS[name]?.label ?? name;

/** A value for display, or the honest alternative. */
export function formatValue(m) {
  if (!m || m.value == null || !Number.isFinite(Number(m.value))) return "Insufficient data";
  const def = MEASUREMENTS[m.name];
  const d = def ? def.decimals : 2;
  return `${Number(m.value).toFixed(d)} ${m.unit ?? unitFor(m.name, isCalibrated(m.calibration_status))}`.trim();
}

/** Whether a measurement should be shown as a number at all. */
export function displayable(m) {
  if (!m || m.value == null || !Number.isFinite(Number(m.value))) return { ok: false, why: "Insufficient data" };
  if (m.quality === "poor") return { ok: false, why: "Image quality too low to measure" };
  if (m.review_status === "rejected") return { ok: false, why: "Not confirmed by your practitioner" };
  const def = MEASUREMENTS[m.name];
  if (def?.needsCalibration && !isCalibrated(m.calibration_status)) return { ok: false, why: "Needs a calibrated image" };
  return { ok: true, why: "" };
}
