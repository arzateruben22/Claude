// What the database itself refuses: changing an original image, rewriting a
// measurement, editing a signed treatment record or an approved report,
// un-withdrawing a consent, touching the audit log. Plus the queue and the
// rate limiter the functions rely on.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, rejects } from "../pg/harness.mjs";
import { seedStaff, seedClient } from "../pg/seed.mjs";

let db, staff, A;
before(async () => {
  db = await freshDb();
  staff = await seedStaff(db);
  A = await seedClient(db, "ana@example.test", "Ana", staff);
});
after(async () => { await db?.close(); });

test("an original capture's path cannot change and it cannot be deleted", async () => {
  assert.match(await rejects(db.query("update captures set original_path = 'x' where id = $1", [A.captureId])), /cannot change/);
  assert.match(await rejects(db.query("delete from captures where id = $1", [A.captureId])), /kept/);
});

test("the original's hash and size are written once", async () => {
  await db.query("update captures set original_sha256 = 'abc', bytes = 1000, width = 10, height = 10, status = 'uploaded' where id = $1", [A.captureId]);
  assert.match(await rejects(db.query("update captures set original_sha256 = 'def' where id = $1", [A.captureId])), /set once/);
  assert.match(await rejects(db.query("update captures set bytes = 2 where id = $1", [A.captureId])), /set once/);
  await db.query("update captures set status = 'processed', calibration_status = 'device_calibrated', um_per_px = 12.5 where id = $1", [A.captureId]);
});

test("a measurement's value cannot change; its review can", async () => {
  const { rows } = await db.query("select id from measurements where capture_id = $1", [A.captureId]);
  const id = rows[0].id;
  assert.match(await rejects(db.query("update measurements set value = 1 where id = $1", [id])), /cannot change/);
  await db.query("update measurements set review_status = 'verified', reviewed_by = $2, reviewed_at = now() where id = $1", [id, staff]);
  assert.match(await rejects(db.query("delete from measurements where id = $1", [id])), /kept/);
});

test("a signed treatment record is fixed; corrections are amendments", async () => {
  await db.query("update treatment_records set reactions = 'mild redness' where id = $1", [A.treatmentId]);   // draft: editable
  await db.query("update treatment_records set status = 'signed', signed_at = now() where id = $1", [A.treatmentId]);
  assert.match(await rejects(db.query("update treatment_records set needle_depth_mm = '{\"left_cheek\":1.0}' where id = $1", [A.treatmentId])), /cannot change/);
  assert.match(await rejects(db.query("delete from treatment_records where id = $1", [A.treatmentId])), /kept/);
  const { rows } = await db.query(`insert into treatment_records (profile_id, treated_at, performed_by, treatment_type, amended_from, status, signed_at)
    select profile_id, treated_at, performed_by, treatment_type, id, 'signed', now() from treatment_records where id = $1 returning id`, [A.treatmentId]);
  await db.query("update treatment_records set status = 'amended' where id = $1", [A.treatmentId]);
  assert.match(await rejects(db.query("update treatment_records set status = 'signed' where id = $1", [A.treatmentId])), /cannot change/);
  assert.ok(rows[0].id);
});

test("a draft treatment record can be thrown away", async () => {
  const { rows } = await db.query("insert into treatment_records (profile_id, treated_at, performed_by, treatment_type) values ($1, now(), $2, 'facial') returning id", [A.pid, staff]);
  await db.query("delete from treatment_records where id = $1", [rows[0].id]);
});

test("an approved report cannot be rewritten, only withdrawn", async () => {
  const { rows } = await db.query("select id from progress_reports where profile_id = $1 and status = 'approved'", [A.pid]);
  assert.match(await rejects(db.query("update progress_reports set content = '{\"x\":1}' where id = $1", [rows[0].id])), /cannot change/);
  await db.query("update progress_reports set status = 'withdrawn', withdrawn_at = now() where id = $1", [rows[0].id]);
});

test("a consent can be withdrawn once and is otherwise fixed", async () => {
  const { rows } = await db.query("select id from consents where email = $1 and kind = 'clinical_photography'", [A.email]);
  const id = rows[0].id;
  assert.match(await rejects(db.query("update consents set granted = false where id = $1", [id])), /only be withdrawn/);
  await db.query("update consents set withdrawn_at = now() where id = $1", [id]);
  assert.match(await rejects(db.query("update consents set withdrawn_at = now() + interval '1 day' where id = $1", [id])), /only be withdrawn/);
  assert.match(await rejects(db.query("delete from consents where id = $1", [id])), /kept/);
  const cur = await db.query("select active from current_consents where email = $1 and kind = 'clinical_photography'", [A.email]);
  assert.equal(cur.rows[0].active, false);
});

test("the newest answer is the one in force", async () => {
  await db.query("insert into consents (email, kind, version, granted, source) values ($1, 'marketing', '1-draft', true, 'client')", [A.email]);
  await db.query("insert into consents (email, kind, version, granted, source, recorded_at) values ($1, 'marketing', '1-draft', false, 'client', now() + interval '1 second')", [A.email]);
  const cur = await db.query("select granted, active from current_consents where email = $1 and kind = 'marketing'", [A.email]);
  assert.deepEqual(cur.rows[0], { granted: false, active: false });
});

test("a consent must name a published text", async () => {
  assert.match(await rejects(db.query("insert into consents (email, kind, version, granted, source) values ($1, 'marketing', '9', true, 'client')", [A.email])), /foreign key/);
});

test("the audit log is append-only, except inside a retention run", async () => {
  await db.query("insert into audit_log (actor_user_id, actor_role, action, profile_id) values ($1, 'admin', 'capture.view', $2)", [staff, A.pid]);
  assert.match(await rejects(db.query("update audit_log set action = 'x'")), /append-only/);
  assert.match(await rejects(db.query("delete from audit_log")), /append-only/);
  await db.transaction(async (tx) => {
    await tx.query("select set_config('lumevina.purge', 'on', true)");
    await tx.query("delete from audit_log where at < now() - interval '7 years'");
  });
});

test("take_token allows the bucket's capacity, then refuses", async () => {
  const take = async () => (await db.query("select take_token('test:key', 2, 0.0001) ok")).rows[0].ok;
  assert.deepEqual([await take(), await take(), await take()], [true, true, false]);
});

test("two workers never claim the same analysis job", async () => {
  await db.query("insert into analysis_jobs (capture_id, kind) values ($1, 'ingest'), ($1, 'quality')", [A.captureId]);
  const one = (await db.query("select * from claim_analysis_job('w1')")).rows[0];
  const two = (await db.query("select * from claim_analysis_job('w2')")).rows[0];
  assert.notEqual(one.id, two.id);
  assert.equal((await db.query("select * from claim_analysis_job('w3')")).rows.length, 0);
});

test("the same job cannot be queued twice while it is waiting", async () => {
  await db.query("insert into analysis_jobs (capture_id, kind) values ($1, 'measure')", [A.captureId]);
  assert.match(await rejects(db.query("insert into analysis_jobs (capture_id, kind) values ($1, 'measure')", [A.captureId])), /duplicate/);
});

test("the private bucket exists with a size limit and image types only", async () => {
  const { rows } = await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'skin-images'");
  assert.equal(rows[0].public, false);
  assert.equal(Number(rows[0].file_size_limit), 25 * 1024 * 1024);
  assert.ok(rows[0].allowed_mime_types.every((m) => m.startsWith("image/")));
});
