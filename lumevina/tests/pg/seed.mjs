// Synthetic people and records for the tests. Never real clients.
import { signUp } from "./harness.mjs";

export async function seedStaff(db, email = "evelyn@lumevina.test", role = "admin", name = "Evelyn") {
  const uid = await signUp(db, email, name);
  await db.query("insert into staff (user_id, email, display_name, role) values ($1, $2, $3, $4)", [uid, email, name, role]);
  return uid;
}

/** A client with a full Skin Intelligence record: profile, consents, a session, captures, measurements, a treatment, routine, reports. */
export async function seedClient(db, email, name, staffUid) {
  const uid = await signUp(db, email, name);
  const q = async (sql, params) => (await db.query(sql, params)).rows[0];
  const profile = await q("insert into skin_profiles (email, client_id, name, goals, concerns) values ($1, $2, $3, 'Smoother texture', '{texture}') returning id", [email, uid, name]);
  const pid = profile.id;
  for (const kind of ["clinical_photography", "treatment"]) {
    await db.query("insert into consents (email, client_id, kind, version, granted, signature, source) values ($1, $2, $3, '1-draft', true, $4, 'client')", [email, uid, kind, name]);
  }
  const session = await q("insert into imaging_sessions (profile_id, visit_label, performed_by, notes_private) values ($1, 'ProCell #1', $2, 'private note about ' || $3) returning id", [pid, staffUid, name]);
  const capture = await q(`insert into captures (session_id, profile_id, region, source, original_path, mime, captured_by, captured_by_role)
                           values ($1, $2, 'left_cheek', 'camera', $3, 'image/jpeg', $4, 'practitioner') returning id`,
    [session.id, pid, `${pid}/${session.id}/c1/original.jpg`, staffUid]);
  const analysis = await q("insert into analyses (capture_id, profile_id, algorithm_version, engine, status) values ($1, $2, 'test-1', 'lumevina-worker', 'done') returning id", [capture.id, pid]);
  await db.query(`insert into measurements (analysis_id, capture_id, profile_id, name, value, unit, region, quality, calibration_status)
                  values ($1, $2, $3, 'redness_a_star', 12.5, 'a*', 'left_cheek', 'good', 'uncalibrated')`, [analysis.id, capture.id, pid]);
  const treatment = await q(`insert into treatment_records (profile_id, session_id, treated_at, performed_by, treatment_type, areas, needle_depth_mm, notes_private, client_summary)
                             values ($1, $2, now(), $3, 'microchanneling', '{left_cheek}', '{"left_cheek":0.5}', 'private treatment note', 'Microchanneling, full face') returning id`,
    [pid, session.id, staffUid]);
  await db.query("insert into routine_entries (profile_id, slot, product_name, source) values ($1, 'am', 'Gentle Gel Cleanser', 'client')", [pid]);
  await db.query("insert into routine_checkins (profile_id, on_date, am_done) values ($1, current_date, true)", [pid]);
  await db.query("insert into recovery_checkins (profile_id, treatment_id, day_after, redness) values ($1, $2, 1, 2)", [pid, treatment.id]);
  await db.query("insert into progress_reports (profile_id, title, content, status) values ($1, 'Approved report', '{}', 'approved')", [pid]);
  await db.query("insert into progress_reports (profile_id, title, content, status) values ($1, 'Draft report', '{}', 'draft')", [pid]);
  await db.query("insert into data_requests (email, profile_id, kind) values ($1, $2, 'export')", [email, pid]);
  return { uid, email, pid, sessionId: session.id, captureId: capture.id, analysisId: analysis.id, treatmentId: treatment.id };
}
