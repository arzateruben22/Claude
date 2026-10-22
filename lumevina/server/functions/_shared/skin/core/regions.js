// GENERATED from js/skin/core/regions.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — facial regions and head pose (shared)
 *
 * Used by the capture screens (positioning guides, on-device checks), the
 * edge functions (validating region names) and, through
 * scripts/build-skin-core.mjs → worker/lumevina_skin/regions.json, the
 * analysis worker, so a "left cheek" is the same patch of skin everywhere.
 *
 * Left and right are the client's own (anatomical), not the viewer's: in an
 * unmirrored photo of someone facing the camera, their right cheek is on the
 * left of the image.
 *
 * Landmark sets are MediaPipe Face Landmarker indices (478-point mesh). Each
 * region is the convex hull of its set, which keeps it robust to small
 * landmark jitter. Checked against MediaPipe's canonical face model
 * (canonical_face_model.obj): forehead centroid sits between the brows
 * (y 2.7) and landmark 10 (y 8.3); the cheeks are mirror images at x ±4.1
 * below the eyes; the RIGHT_CHEEK set lies on the side of landmark 33, the
 * client's right eye.
 */

export const REGIONS = [
  { id: "front", label: "Front of face", kind: "view", guide: "face", yaw: [-8, 8] },
  { id: "left_profile", label: "Left profile", kind: "view", guide: "profile", yaw: [-90, -45] },
  { id: "right_profile", label: "Right profile", kind: "view", guide: "profile", yaw: [45, 90] },
  { id: "forehead", label: "Forehead", kind: "area", guide: "face", yaw: [-12, 12] },
  { id: "left_cheek", label: "Left cheek", kind: "area", guide: "face", yaw: [-35, 5] },
  { id: "right_cheek", label: "Right cheek", kind: "area", guide: "face", yaw: [-5, 35] },
  { id: "nose", label: "Nose", kind: "area", guide: "face", yaw: [-12, 12] },
  { id: "chin", label: "Chin", kind: "area", guide: "face", yaw: [-12, 12] },
  { id: "custom", label: "A chosen spot", kind: "site", guide: "macro", yaw: null },
];

export const REGION_IDS = REGIONS.map((r) => r.id);
export const AREA_IDS = REGIONS.filter((r) => r.kind === "area").map((r) => r.id);
export const regionLabel = (id) => (REGIONS.find((r) => r.id === id) || { label: id }).label;
export const isRegion = (id) => REGION_IDS.includes(id);

/* The standard visit: what the guided capture walks through, in order. */
export const STANDARD_SET = ["front", "left_profile", "right_profile", "forehead", "left_cheek", "right_cheek", "nose", "chin"];

export const LANDMARKS = {
  forehead: [54, 103, 67, 109, 10, 338, 297, 332, 284, 300, 293, 334, 296, 336, 107, 66, 105, 63, 70],
  nose: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 98, 97, 326, 327, 64, 294, 48, 278, 115, 344, 220, 440, 45, 275],
  chin: [152, 148, 176, 377, 400, 175, 199, 200, 18, 83, 313, 201, 421],
  right_cheek: [116, 117, 118, 100, 126, 142, 203, 206, 216, 207, 187, 123, 50, 101, 36, 205, 147, 213],
  left_cheek: [345, 346, 347, 329, 355, 371, 423, 426, 436, 427, 411, 352, 280, 330, 266, 425, 376, 433],
};
/* Reference points used for framing and scale. */
export const KEYPOINTS = { rightEyeOuter: 33, leftEyeOuter: 263, noseTip: 1, top: 10, chin: 152, rightEdge: 234, leftEdge: 454 };

/** Convex hull (monotone chain) of [{x, y}], counter-clockwise, no repeated end point. */
export function convexHull(points) {
  const pts = points.map((p) => ({ x: p.x, y: p.y })).sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

/** The polygon for a region, in the landmarks' coordinates (normalized 0–1 from MediaPipe, or pixels). */
export function regionPolygon(landmarks, region) {
  const set = LANDMARKS[region];
  if (!set || !landmarks || landmarks.length < 468) return null;
  return convexHull(set.map((i) => landmarks[i]));
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

export function boundingBox(poly) {
  const xs = poly.map((p) => p.x), ys = poly.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

const deg = (v) => (v * 180) / Math.PI;
const round1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Head pose in degrees from the landmarks themselves, so the direction never
 * depends on a camera's axis convention or on whether the preview is mirrored.
 *   yaw    positive when the client's RIGHT cheek turns towards the camera
 *          (the nose tip moves towards their left face edge, landmark 454)
 *   roll   tilt of the line between the outer eye corners
 *   pitch  rough: where the nose tip sits between the eye line and the chin
 *          (0 when level; positive when the chin is lifted)
 * Exact pitch and roll can also come from MediaPipe's transformation matrix;
 * this estimate is all the capture guide needs.
 */
export function poseFromLandmarks(lm) {
  if (!lm || lm.length < 468) return null;
  const P = (i) => lm[i];
  const r = P(KEYPOINTS.rightEdge), l = P(KEYPOINTS.leftEdge), nose = P(KEYPOINTS.noseTip);
  const ax = l.x - r.x, ay = l.y - r.y, len2 = ax * ax + ay * ay;
  if (!len2) return null;
  const mx = (l.x + r.x) / 2, my = (l.y + r.y) / 2;
  // nose offset from the face's centre line, in half face-widths; for the
  // canonical face (nose tip 7.48 forward, edges 2.44 back, 7.66 out) this is
  // 1.295 × tan(yaw) under orthographic projection
  const t = ((nose.x - mx) * ax + (nose.y - my) * ay) / (len2 / 2);
  const yaw = deg(Math.atan(t / 1.295));
  const re = P(KEYPOINTS.rightEyeOuter), le = P(KEYPOINTS.leftEyeOuter);
  let roll = deg(Math.atan2(le.y - re.y, le.x - re.x));
  if (roll > 90) roll -= 180; else if (roll < -90) roll += 180;   // mirrored images flip the eye line
  const eyeY = (re.y + le.y) / 2, chin = P(KEYPOINTS.chin);
  const span = chin.y - eyeY;
  // a level face has the nose tip about 31% of the way from the eye line to the chin (canonical model)
  const pitch = span ? clamp((0.314 - (nose.y - eyeY) / span) * 150, -60, 60) : 0;
  return { yaw: round1(yaw), pitch: round1(pitch), roll: round1(roll) };
}

/** The face's bounding box from its landmarks, in the same units (normalized landmarks → 0–1). */
export function faceBox(lm) {
  if (!lm || lm.length < 468) return null;
  return boundingBox([KEYPOINTS.top, KEYPOINTS.chin, KEYPOINTS.rightEdge, KEYPOINTS.leftEdge].map((i) => lm[i]));
}

/**
 * Advice for lining up a region, from the pose and how much of the frame the
 * face fills (faceBox normalized 0–1). Returns { ok, hints[] }.
 */
export function framingAdvice(region, pose, box, { minFill = 0.35, maxFill = 0.85 } = {}) {
  const def = REGIONS.find((r) => r.id === region);
  const hints = [];
  if (!def || def.guide === "macro") return { ok: true, hints };
  if (!pose || !box) return { ok: false, hints: ["Bring your face into the frame"] };
  const [lo, hi] = def.yaw || [-90, 90];
  const outside = pose.yaw < lo || pose.yaw > hi;
  if (outside) {
    if (region === "left_cheek" || region === "left_profile") hints.push(pose.yaw > hi ? `Turn so your left ${region === "left_cheek" ? "cheek" : "side"} faces the camera` : "Turn back a little towards the camera");
    else if (region === "right_cheek" || region === "right_profile") hints.push(pose.yaw < lo ? `Turn so your right ${region === "right_cheek" ? "cheek" : "side"} faces the camera` : "Turn back a little towards the camera");
    else hints.push("Face the camera straight on");
  }
  if (Math.abs(pose.pitch) > 15) hints.push(pose.pitch > 0 ? "Lower your chin a little" : "Lift your chin a little");
  if (Math.abs(pose.roll) > 8) hints.push("Keep your head level");
  if (def.guide === "face") {
    if (box.h < minFill) hints.push("Come a little closer");
    if (box.h > maxFill) hints.push("Move back a little");
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    if (Math.abs(cx - 0.5) > 0.12 || Math.abs(cy - 0.5) > 0.15) hints.push("Centre your face in the frame");
  }
  return { ok: hints.length === 0, hints };
}
