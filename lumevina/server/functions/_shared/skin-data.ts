// Lumevina — Skin Intelligence records: reading a client's record, starting
// and finishing an upload, queueing the worker. Shared by functions/skin (the
// client) and functions/studio-skin (staff); both have already decided who is
// asking and whether they may, before calling anything here.

// deno-lint-ignore-file no-explicit-any
import { BUCKET, HttpError, must, nowIso, signedUpload, storedObject, today, type Deps } from "./skin.ts";
import { consentState, may, blockedReason } from "./skin/core/consent.js";
import { cleanCaptureBegin, extFor, MAX_BYTES } from "./skin/core/validate.js";

const SESSION_COLS = "id, profile_id, booking_id, visit_label, service_id, performed_by, device_id, lighting, notes_private, status, started_at, submitted_at, reviewed_at";
const CAPTURE_COLS = "id, session_id, profile_id, region, site_id, source, original_path, original_sha256, mime, bytes, width, height, exif, capture_meta, um_per_px, calibration_status, status, excluded_reason, captured_at, captured_by_role";

/** The signed-in person's own profile, linking it to their account the first time. */
export async function profileForPerson(deps: Deps, person: { id: string; email: string }) {
  const { db } = deps;
  const byId = must(await db.from("skin_profiles").select("*").eq("client_id", person.id).neq("status", "deleted").maybeSingle());
  if (byId) return byId;
  const byEmail = must(await db.from("skin_profiles").select("*").eq("email", person.email).neq("status", "deleted").maybeSingle());
  if (byEmail && !byEmail.client_id) {
    const { data: c } = await db.from("clients").select("id").eq("id", person.id).maybeSingle();
    if (c) { await db.from("skin_profiles").update({ client_id: person.id }).eq("id", byEmail.id); byEmail.client_id = person.id; }
  }
  return byEmail;
}

export async function consentsFor(deps: Deps, email: string) {
  const rows = must(await deps.db.from("consents").select("id, kind, version, granted, recorded_at, withdrawn_at, source").eq("email", email).order("recorded_at", { ascending: false }));
  return { rows, state: consentState(rows) };
}

export async function currentTexts(deps: Deps) {
  const rows = must(await deps.db.from("consent_texts").select("kind, version, title, body, body_sha256, published_at, retired_at").is("retired_at", null).order("published_at", { ascending: false }));
  const out: Record<string, any> = {};
  for (const r of rows) if (!out[r.kind]) out[r.kind] = r;
  return out;
}

/** Everything about one profile's imaging, for the evolution views. Treatments and notes are filtered by the caller. */
export async function loadRecord(deps: Deps, profileId: string) {
  const { db } = deps;
  const [sessions, captures, treatments, devices, changes, validation] = await Promise.all([
    db.from("imaging_sessions").select(SESSION_COLS).eq("profile_id", profileId).order("started_at", { ascending: true }),
    db.from("captures").select(CAPTURE_COLS).eq("profile_id", profileId).order("captured_at", { ascending: true }),
    db.from("treatment_records").select("*").eq("profile_id", profileId).order("treated_at", { ascending: true }),
    db.from("imaging_devices").select("id, name, kind, model, calibration, lighting, active"),
    db.from("change_detections").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
    db.from("measurement_validation").select("*"),
  ]).then((rs) => rs.map((r) => must(r)));
  const ids = captures.map((c: any) => c.id);
  const [quality, measurementRows, derived, analyses] = ids.length
    ? await Promise.all([
        db.from("quality_checks").select("*").in("capture_id", ids).order("created_at", { ascending: false }),
        db.from("measurements").select("*").eq("profile_id", profileId).order("created_at", { ascending: true }),
        db.from("derived_images").select("id, capture_id, kind, path, reference_capture_id, algorithm_version, width, height, created_at").in("capture_id", ids),
        db.from("analyses").select("id, algorithm_version").eq("profile_id", profileId),
      ]).then((rs) => rs.map((r) => must(r)))
    : [[], [], [], []];
  const version = new Map(analyses.map((a: any) => [a.id, a.algorithm_version]));
  const measurements = measurementRows.map((m: any) => ({ ...m, algorithm_version: version.get(m.analysis_id) ?? null }));
  const latestQ = new Map<string, any>();
  for (const q of quality) if (!latestQ.has(q.capture_id)) latestQ.set(q.capture_id, q);
  return { sessions, captures, quality: [...latestQ.values()], measurements, derived, treatments, devices, changes, validation };
}

export async function enqueue(deps: Deps, captureId: string, kind: string, referenceId: string | null = null, params: Record<string, unknown> | null = null) {
  const { error } = await deps.db.from("analysis_jobs").insert({ capture_id: captureId, kind, reference_capture_id: referenceId, params });
  if (error && !/duplicate|unique/i.test(String(error.message ?? error.code))) { console.error("enqueue", error); throw new HttpError(500, "failed"); }
}

/**
 * Creates the capture row and a signed upload URL for its original. The
 * caller has checked who may add to this profile; this checks consent.
 */
export async function beginCapture(deps: Deps, a: {
  profile: any; sessionId: string; input: any; actor: { id: string | null; role: "client" | "practitioner" | "admin" };
}) {
  const clean = cleanCaptureBegin(a.input);
  if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
  const { state } = await consentsFor(deps, a.profile.email);
  if (!may.capture(state)) throw new HttpError(403, "consent_required", { kind: "clinical_photography", message: blockedReason("capture", state) });
  if (a.profile.status !== "active") throw new HttpError(409, "profile_inactive");
  const v = clean.value;
  if (v.site_id) {
    const site = must(await deps.db.from("imaging_sites").select("id, profile_id, region").eq("id", v.site_id).maybeSingle());
    if (!site || site.profile_id !== a.profile.id) throw new HttpError(404, "no_site");
  }
  const id = crypto.randomUUID();
  const path = `${a.profile.id}/${a.sessionId}/${id}/original.${extFor(v.mime)}`;
  const cap = must(await deps.db.from("captures").insert({
    id, session_id: a.sessionId, profile_id: a.profile.id, region: v.region, site_id: v.site_id, source: v.source,
    original_path: path, mime: v.mime, capture_meta: v.capture_meta, captured_by: a.actor.id, captured_by_role: a.actor.role,
    status: "pending_upload",
  }).select("id, region, status, original_path").single());
  const upload = await signedUpload(deps, path);
  return { capture: cap, upload: { url: upload.url, token: upload.token, max_bytes: MAX_BYTES, content_type: v.mime } };
}

/** After the browser has PUT the file: check it arrived, record its size, queue ingest and quality. */
export async function commitCapture(deps: Deps, cap: any) {
  if (cap.status !== "pending_upload") return { capture_id: cap.id, status: cap.status };
  const obj = await storedObject(deps, cap.original_path);
  if (!obj || !obj.size) throw new HttpError(409, "not_uploaded");
  if (obj.size > MAX_BYTES) throw new HttpError(413, "too_large");
  must(await deps.db.from("captures").update({ status: "uploaded", bytes: obj.size }).eq("id", cap.id).eq("status", "pending_upload"));
  await enqueue(deps, cap.id, "ingest");
  return { capture_id: cap.id, status: "uploaded" };
}

/** The client's own "my photos" session for today, opened when they first add one. */
export async function clientSessionToday(deps: Deps, profileId: string) {
  const day = today(deps);
  const open = must(await deps.db.from("imaging_sessions").select("id, started_at").eq("profile_id", profileId).is("performed_by", null)
    .eq("status", "open").gte("started_at", `${day}T00:00:00Z`).order("started_at", { ascending: false }).limit(1));
  if (open.length) return open[0].id;
  const s = must(await deps.db.from("imaging_sessions").insert({ profile_id: profileId, visit_label: "Your photos", status: "open", started_at: nowIso(deps) }).select("id").single());
  return s.id;
}

/** Signed links for captures, by kind: 'view' and 'thumb' come from the worker's copies; 'original' only for staff. */
export function pathsFor(record: { captures: any[]; derived: any[] }, ids: string[], kind: string, allowOriginal: boolean) {
  const out: Record<string, string | null> = {};
  for (const id of ids) {
    const c = record.captures.find((x: any) => x.id === id);
    if (!c) continue;
    if (kind === "original") { out[id] = allowOriginal ? c.original_path : null; continue; }
    const d = record.derived.filter((x: any) => x.capture_id === id && x.kind === kind).sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    out[id] = d ? d.path : (kind === "view" && ["image/jpeg", "image/png", "image/webp"].includes(c.mime) && c.status !== "pending_upload" ? c.original_path : null);
  }
  return out;
}

export const BUCKET_NAME = BUCKET;
