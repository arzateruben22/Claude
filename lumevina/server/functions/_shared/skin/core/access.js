// GENERATED from js/skin/core/access.js by scripts/build-skin-core.mjs. Edit the original, then run it.
/* Lumevina Skin Intelligence — who may open what (shared)
 *
 * The decisions the functions make after they have verified who is asking
 * (functions/_shared/staff.ts, _shared/skin.ts). Kept here, pure, so they
 * are tested once and read the same everywhere. Pages use them only to
 * decide what to show; the functions enforce them.
 */

export const ROLES = ["client", "practitioner", "admin"];

/** A staff member may open a client's record: admins always; practitioners per the clinic's assignment mode. */
export function staffMayOpen(staff, profileId, { assignmentMode = "all", assignedProfileIds = [] } = {}) {
  if (!staff || !staff.active) return false;
  if (staff.role === "admin") return true;
  if (staff.role !== "practitioner") return false;
  return assignmentMode === "all" || assignedProfileIds.includes(profileId);
}

/** Actions only an admin may take. */
export const ADMIN_ACTIONS = new Set([
  "staff_list", "staff_set", "assign", "unassign", "settings_set", "device_set", "validation_set",
  "audit", "data_requests", "data_request_complete", "retention_preview", "analytics",
]);

/** Actions that need multifactor sign-in for staff (all of them, at aal2). */
export const requiresMfa = (role) => role === "practitioner" || role === "admin";

/** What a client may see of a treatment record: the line written for them, and the plain facts. */
export function treatmentForClient(t) {
  if (!t || t.status === "draft") return null;
  return {
    id: t.id, treated_at: t.treated_at, treatment_type: t.treatment_type, areas: t.areas ?? [],
    summary: t.client_summary ?? null, follow_up_on: t.follow_up_on ?? null,
    recovery_guidance: t.recovery_guidance ?? null, series: t.series ?? null, status: t.status,
  };
}

/** What a client may see of a session: never the practitioner's notes. */
export function sessionForClient(s) {
  return { id: s.id, started_at: s.started_at, visit_label: s.visit_label, service_id: s.service_id, status: s.status, booking_id: s.booking_id ?? null };
}

/** What a client may see of a measurement: values the practitioner has not rejected, without her review note. */
export function measurementForClient(m) {
  if (!m || m.review_status === "rejected") return null;
  const { review_note, reviewed_by, ...rest } = m;
  return rest;
}
