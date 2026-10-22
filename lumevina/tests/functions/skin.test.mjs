// functions/skin and functions/studio-skin, end to end: the real handlers,
// a real Postgres with the schema and every migration, Supabase Auth and
// Storage stood in for. Synthetic people only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, signUp } from "../pg/harness.mjs";
import { makeClient, issueToken, post } from "./adapter.mjs";
import { handle as skin } from "../../server/functions/skin/handler.ts";
import { handle as studio } from "../../server/functions/studio-skin/handler.ts";

const ENV = { SUPABASE_ANON_KEY: "anon-key", AUDIT_SALT: "salt", SITE_URL: "https://lumevina.test" };
let pg, api, deps, tokens, notes;
const T = {};
const U = {};

const call = async (fn, token, body, headers) => {
  const res = await (fn === "skin" ? skin : studio)(post(`https://fn.test/${fn}`, token, body, headers), deps);
  return { status: res.status, body: await res.json() };
};
const ok = async (fn, token, body) => {
  const r = await call(fn, token, body);
  assert.equal(r.status, 200, `${fn} ${body.action}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};
const upload = (path, bytes = 2048) => api.storage.set(`skin-images/${path.replace(/^https:\/\/storage\.test\/upload\/skin-images\//, "").replace(/\?.*$/, "")}`, { bytes: new Uint8Array(bytes), mimetype: "image/jpeg" });
const auditCount = async (action) => Number((await pg.query("select count(*) n from audit_log where action = $1", [action])).rows[0].n);
const sign = (name) => name;

before(async () => {
  pg = await freshDb();
  tokens = new Map();
  notes = [];
  api = makeClient(pg, { tokens });
  deps = { db: api.client, env: (k) => ENV[k], notify: async (_db, a) => { notes.push(a); }, now: () => new Date("2026-10-22T17:00:00Z") };
  for (const [k, email, name] of [["evelyn", "evelyn@lumevina.test", "Evelyn"], ["pat", "pat@lumevina.test", "Pat"], ["ana", "ana@example.test", "Ana Diaz"], ["bea", "bea@example.test", "Bea Lin"]]) {
    U[k] = await signUp(pg, email, name);
    T[k] = issueToken(tokens, { sub: U[k], email });
    T[k + "2"] = issueToken(tokens, { sub: U[k], email, aal: "aal2" });
  }
  await pg.query("insert into staff (user_id, email, display_name, role) values ($1, 'evelyn@lumevina.test', 'Evelyn', 'admin'), ($2, 'pat@lumevina.test', 'Pat', 'practitioner')", [U.evelyn, U.pat]);
});
after(async () => { await pg?.close(); });

test("skin: no token, the anon key, or a bad token are all turned away", async () => {
  assert.equal((await call("skin", null, { action: "me" })).status, 401);
  assert.equal((await call("skin", "anon-key", { action: "me" })).status, 401);
  assert.equal((await call("skin", "not.a.token", { action: "me" })).status, 401);
});

test("skin: a client enrolls, signs consents, and can't capture before the photography consent", async () => {
  const me = await ok("skin", T.ana, { action: "me" });
  assert.equal(me.profile, null);
  assert.equal(me.texts.clinical_photography.version, "1-draft");
  const { profile } = await ok("skin", T.ana, { action: "enroll" });
  assert.equal(profile.email, "ana@example.test");
  assert.equal(profile.enrolled_by, undefined);

  const blocked = await call("skin", T.ana, { action: "capture_begin", region: "left_cheek", mime: "image/jpeg", bytes: 2048 });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.reason, "consent_required");

  assert.equal((await call("skin", T.ana, { action: "consent", kind: "clinical_photography", granted: true, version: "0-old", signature: "Ana Diaz" })).body.reason, "text_changed");
  assert.equal((await call("skin", T.ana, { action: "consent", kind: "clinical_photography", granted: true, version: "1-draft", signature: "" })).status, 400);
  const c = await ok("skin", T.ana, { action: "consent", kind: "clinical_photography", granted: true, version: "1-draft", signature: sign("Ana Diaz") });
  assert.equal(c.consents.clinical_photography.active, true);
  assert.equal(c.consents.treatment.active, false);
});

test("skin: a client's own photo goes in privately and is queued for the worker", async () => {
  const begin = await ok("skin", T.ana, { action: "capture_begin", region: "left_cheek", mime: "image/jpeg", bytes: 2048, source: "camera", capture_meta: { guide: "oval" } });
  assert.match(begin.upload.url, /^https:\/\/storage\.test\/upload\/skin-images\//);
  assert.equal((await call("skin", T.ana, { action: "capture_commit", capture_id: begin.capture_id })).body.reason, "not_uploaded");
  upload(begin.upload.url);
  const done = await ok("skin", T.ana, { action: "capture_commit", capture_id: begin.capture_id });
  assert.equal(done.status, "uploaded");
  const jobs = await pg.query("select kind from analysis_jobs where capture_id = $1", [begin.capture_id]);
  assert.deepEqual(jobs.rows.map((r) => r.kind), ["ingest"]);
  const cap = (await pg.query("select captured_by_role, bytes, original_path from captures where id = $1", [begin.capture_id])).rows[0];
  assert.equal(cap.captured_by_role, "client");
  assert.equal(Number(cap.bytes), 2048);
  U.anaSelfCapture = begin.capture_id;
});

test("staff: a client token, a password-only staff sign-in, and the studio key are all refused", async () => {
  const asClient = await call("studio", T.ana, { action: "whoami" });
  assert.equal(asClient.status, 403); assert.equal(asClient.body.reason, "not_staff");
  assert.ok(await auditCount("studio.denied") >= 1);
  const noMfa = await call("studio", T.evelyn, { action: "whoami" });
  assert.equal(noMfa.status, 403); assert.equal(noMfa.body.reason, "mfa_required");
  assert.equal((await call("studio", null, { action: "whoami" }, { "x-studio-key": "the-long-shared-studio-phrase" })).status, 401);
  assert.equal((await call("studio", T.ana, { action: "whoami" }, { "x-studio-key": "the-long-shared-studio-phrase" })).status, 403);
  const me = await ok("studio", T.evelyn2, { action: "whoami" });
  assert.equal(me.staff.role, "admin");
});

test("staff: Evelyn enrolls Bea, records consent at the visit, and photographs her", async () => {
  const { profile } = await ok("studio", T.evelyn2, { action: "enroll", email: "BEA@example.test" });
  U.beaProfile = profile.id;
  assert.equal(profile.email, "bea@example.test");
  assert.equal((await call("studio", T.evelyn2, { action: "session_open", profile_id: profile.id })).body.reason, "consent_required");
  await ok("studio", T.evelyn2, { action: "consent_record", profile_id: profile.id, kind: "clinical_photography", granted: true, version: "1-draft", signature: "Bea Lin" });
  const rec = (await pg.query("select source, recorded_by from consents where email = 'bea@example.test'")).rows[0];
  assert.deepEqual(rec, { source: "studio", recorded_by: U.evelyn });

  // a booking that belongs to someone else can't be attached
  const other = (await pg.query(`insert into bookings (guest_email, date, start_min, dur_min, services, total_cents, deposit_cents)
    values ('ana@example.test', '2026-10-22', 600, 90, '["procell-microchanneling"]', 35000, 0) returning id`)).rows[0].id;
  assert.equal((await call("studio", T.evelyn2, { action: "session_open", profile_id: profile.id, booking_id: other })).body.reason, "booking_not_this_client");
  const mine = (await pg.query(`insert into bookings (guest_email, date, start_min, dur_min, services, total_cents, deposit_cents)
    values ('bea@example.test', '2026-10-22', 780, 90, '["procell-microchanneling"]', 35000, 0) returning id`)).rows[0].id;
  const { session } = await ok("studio", T.evelyn2, { action: "session_open", profile_id: profile.id, booking_id: mine, notes_private: "Bea's private note" });
  assert.equal(session.service_id, "procell-microchanneling");
  U.beaSession = session.id;

  U.beaCaps = [];
  for (const region of ["left_cheek", "left_cheek"]) {
    const b = await ok("studio", T.evelyn2, { action: "capture_begin", session_id: session.id, region, mime: "image/jpeg", bytes: 4096, source: "camera" });
    upload(b.upload.url, 4096);
    await ok("studio", T.evelyn2, { action: "capture_commit", capture_id: b.capture_id });
    U.beaCaps.push(b.capture_id);
  }
});

test("isolation: one client never sees, links to, or changes another client's record", async () => {
  await ok("skin", T.bea, { action: "consent", kind: "clinical_photography", granted: true, version: "1-draft", signature: "Bea Lin" });
  const beaTl = await ok("skin", T.bea, { action: "timeline" });
  assert.ok(beaTl.captures.every((c) => c.id !== U.anaSelfCapture));
  assert.equal(beaTl.sessions[0].notes_private, undefined, "the practitioner's notes never reach the client");
  const anaTl = await ok("skin", T.ana, { action: "timeline" });
  assert.ok(anaTl.captures.every((c) => !U.beaCaps.includes(c.id)));

  const urls = await ok("skin", T.ana, { action: "image_urls", capture_ids: U.beaCaps });
  assert.deepEqual(urls.urls, {}, "Ana asked for Bea's photos and got no links");
  assert.equal((await call("skin", T.bea, { action: "capture_commit", capture_id: U.anaSelfCapture })).status, 404);
  const anaEntry = (await ok("skin", T.ana, { action: "routine_save", entry: { slot: "am", product_name: "Gentle Gel Cleanser", category: "cleanser" } })).entry;
  assert.equal((await call("skin", T.bea, { action: "routine_stop", id: anaEntry.id })).status, 404);
  assert.equal((await call("skin", T.bea, { action: "routine_save", entry: { id: anaEntry.id, slot: "pm", product_name: "x" } })).status, 404);
});

test("images: links are short-lived, staff can see originals, and every look is audited", async () => {
  const before = await auditCount("studio.capture.view");
  const r = await ok("studio", T.evelyn2, { action: "image_urls", profile_id: U.beaProfile, capture_ids: U.beaCaps, kind: "original" });
  assert.equal(Object.values(r.urls).filter(Boolean).length, 2);
  assert.equal(r.expires_in, 300);
  assert.equal(api.calls.signedUrls.at(-1).seconds, 300);
  assert.equal(await auditCount("studio.capture.view"), before + 1);
  const mine = await ok("skin", T.bea, { action: "image_urls", capture_ids: U.beaCaps, kind: "view" });
  assert.equal(Object.values(mine.urls).filter(Boolean).length, 2, "her own photos (JPEGs) show before the worker has made viewing copies");
  assert.ok(await auditCount("client.capture.view") >= 1);
  assert.equal((await call("skin", T.bea, { action: "image_urls", capture_ids: U.beaCaps, kind: "original" })).body.urls[U.beaCaps[0]], mine.urls[U.beaCaps[0]], "clients never get a separate 'original' kind");
});

test("assignments: a practitioner opens only assigned clients when the clinic says so; admin actions stay admin", async () => {
  await ok("studio", T.pat2, { action: "client", profile_id: U.beaProfile });   // solo mode: every client
  await ok("studio", T.evelyn2, { action: "settings_set", key: "assignment_mode", value: "assigned" });
  const denied = await call("studio", T.pat2, { action: "client", profile_id: U.beaProfile });
  assert.equal(denied.status, 403); assert.equal(denied.body.reason, "not_assigned");
  assert.equal((await ok("studio", T.pat2, { action: "clients" })).clients.length, 0);
  await ok("studio", T.evelyn2, { action: "assign", profile_id: U.beaProfile, staff_user_id: U.pat });
  await ok("studio", T.pat2, { action: "client", profile_id: U.beaProfile });
  assert.equal((await call("studio", T.pat2, { action: "staff_list" })).body.reason, "admin_only");
  assert.equal((await call("studio", T.pat2, { action: "audit" })).body.reason, "admin_only");
  await ok("studio", T.evelyn2, { action: "settings_set", key: "assignment_mode", value: "all" });
});

test("treatment records: consent first, private settings, a summary for the client, signed and amended", async () => {
  const t = { treatment_type: "microchanneling", treated_at: "2026-10-22T20:00:00Z", areas: ["forehead", "left_cheek"],
    needle_depth_mm: { forehead: 0.25, left_cheek: 0.5 }, notes_private: "private treatment note", session_id: U.beaSession,
    client_summary: "ProCell microchanneling, forehead and left cheek", series: { package: "procell-package", session_no: 1, of: 4 } };
  assert.equal((await call("studio", T.evelyn2, { action: "treatment_save", profile_id: U.beaProfile, treatment: t })).body.kind, "treatment");
  await ok("studio", T.evelyn2, { action: "consent_record", profile_id: U.beaProfile, kind: "treatment", granted: true, version: "1-draft", signature: "Bea Lin" });
  const saved = await ok("studio", T.evelyn2, { action: "treatment_save", profile_id: U.beaProfile, treatment: t });
  assert.deepEqual(saved.wording, []);
  assert.equal((await call("studio", T.evelyn2, { action: "treatment_save", profile_id: U.beaProfile, treatment: { ...t, needle_depth_mm: { forehead: 25 } } })).status, 400);
  const tl1 = await ok("skin", T.bea, { action: "timeline" });
  assert.equal(tl1.treatments.length, 0, "a draft isn't shown to the client");
  await ok("studio", T.evelyn2, { action: "treatment_sign", id: saved.treatment.id });
  const tl = await ok("skin", T.bea, { action: "timeline" });
  assert.equal(tl.treatments.length, 1);
  assert.equal(tl.treatments[0].summary, t.client_summary);
  assert.equal(JSON.stringify(tl).includes("private treatment note"), false);
  assert.equal(JSON.stringify(tl).includes("needle_depth"), false);
  const am = await ok("studio", T.evelyn2, { action: "treatment_amend", id: saved.treatment.id, treatment: { reactions: "Mild redness, settled in the studio" } });
  assert.equal(am.treatment.amended_from, saved.treatment.id);
  assert.equal((await pg.query("select status from treatment_records where id = $1", [saved.treatment.id])).rows[0].status, "amended");
  U.beaTreatment = am.treatment.id;
});

async function workerMeasures(captureId, profileId, values, version = "lumevina-skin-0.1.0") {
  const a = (await pg.query("insert into analyses (capture_id, profile_id, algorithm_version, engine, status) values ($1, $2, $3, 'lumevina-worker', 'done') returning id", [captureId, profileId, version])).rows[0].id;
  await pg.query("insert into quality_checks (capture_id, algorithm_version, metrics, passed, comparable) values ($1, 'q-1', '{}', true, true)", [captureId]);
  for (const [name, value] of Object.entries(values)) {
    await pg.query(`insert into measurements (analysis_id, capture_id, profile_id, name, value, unit, region, quality, calibration_status)
      values ($1, $2, $3, $4, $5, 'u', 'left_cheek', 'good', 'uncalibrated')`, [a, captureId, profileId, name, value]);
  }
}

test("change detection: only what the validated threshold allows, reviewed before the client sees it", async () => {
  const [c1, c2] = U.beaCaps;
  await workerMeasures(c1, U.beaProfile, { texture_roughness: 3.0, redness_a_star: 14.0, pore_density: 10 });
  await workerMeasures(c2, U.beaProfile, { texture_roughness: 4.5, redness_a_star: 13.8, pore_density: 6 });
  await ok("studio", T.evelyn2, { action: "validation_set", name: "texture_roughness", region: "left_cheek", device_kind: "any", status: "validated", repeatability_coefficient: 0.6 });
  await ok("studio", T.evelyn2, { action: "validation_set", name: "redness_a_star", region: "any", device_kind: "any", status: "validated", repeatability_coefficient: 1.0 });
  const { changes } = await ok("studio", T.evelyn2, { action: "compare", from_capture_id: c1, to_capture_id: c2 });
  const by = Object.fromEntries(changes.map((c) => [c.name, c]));
  assert.equal(by.texture_roughness.verdict, "deterioration");
  assert.match(by.texture_roughness.text, /appears rougher.*Practitioner review recommended/s);
  assert.equal(by.redness_a_star.verdict, "no_meaningful_change");
  assert.equal(by.pore_density.verdict, "uncertain", "not validated yet, however big the difference");
  assert.equal((await pg.query("select count(*)::int n from analysis_jobs where kind = 'register' and capture_id = $1", [c2])).rows[0].n, 1);

  let evo = await ok("skin", T.bea, { action: "evolution" });
  assert.equal(evo.changes.length, 0, "nothing reaches the client until Evelyn confirms and shares it");
  await ok("studio", T.evelyn2, { action: "change_review", id: by.texture_roughness.id, review_status: "confirmed", shared_with_client: true });
  evo = await ok("skin", T.bea, { action: "evolution" });
  assert.equal(evo.changes.length, 1);
  assert.doesNotMatch(evo.changes[0].text, /Practitioner review/);
  assert.match(evo.changes[0].text, /Lighting, hydration/);

  const m = (await pg.query("select id from measurements where capture_id = $1 and name = 'pore_density'", [c2])).rows[0].id;
  await ok("studio", T.evelyn2, { action: "measurement_review", id: m, review_status: "rejected", review_note: "glare on the cheek" });
  evo = await ok("skin", T.bea, { action: "evolution" });
  assert.ok(!evo.measurements.some((x) => x.id === m), "a rejected measurement is never shown to the client");
  assert.ok(evo.measurements.every((x) => x.review_note === undefined));
  // comparing again doesn't duplicate
  await ok("studio", T.evelyn2, { action: "compare", from_capture_id: c1, to_capture_id: c2 });
  assert.equal((await pg.query("select count(*)::int n from change_detections where to_capture_id = $1", [c2])).rows[0].n, 3);
});

test("reports: wording is checked, approval freezes it, the client reads it with fresh image links", async () => {
  const [c1, c2] = U.beaCaps;
  const m = (await pg.query("select id from measurements where capture_id = $1 and name = 'redness_a_star'", [c2])).rows[0].id;
  await ok("studio", T.evelyn2, { action: "measurement_review", id: m, review_status: "verified" });
  const bad = await ok("studio", T.evelyn2, { action: "report_draft", profile_id: U.beaProfile, image_capture_ids: [c1, c2], summary: "Your texture is 40% smoother!" });
  assert.equal(bad.problems[0].id, "percent");
  assert.equal((await call("studio", T.evelyn2, { action: "report_approve", id: bad.report.id })).status, 422);
  await ok("studio", T.evelyn2, { action: "report_withdraw", id: bad.report.id });
  const good = await ok("studio", T.evelyn2, { action: "report_draft", profile_id: U.beaProfile, image_capture_ids: [c1, c2], summary: "Your first ProCell session went smoothly." });
  assert.deepEqual(good.problems, []);
  assert.equal((await ok("skin", T.bea, { action: "reports" })).reports.length, 0);
  const preview = await ok("studio", T.evelyn2, { action: "report", id: good.report.id });
  assert.equal(preview.report.status, "draft");
  assert.equal(Object.values(preview.urls).filter(Boolean).length, 2);
  await ok("studio", T.evelyn2, { action: "report_approve", id: good.report.id });
  const list = await ok("skin", T.bea, { action: "reports" });
  assert.equal(list.reports.length, 1);
  const rep = await ok("skin", T.bea, { action: "report", id: good.report.id });
  assert.equal(rep.report.content.measurements.length, 1);
  assert.equal(Object.values(rep.urls).filter(Boolean).length, 2);
  assert.doesNotMatch(JSON.stringify(rep), /private|needle_depth|glare/);
  assert.equal((await call("skin", T.ana, { action: "report", id: good.report.id })).status, 404);
});

test("routine: purchased products are offered, never assumed; Evelyn's suggestion waits for the client", async () => {
  await pg.query(`insert into orders (status, email, items, subtotal_cents, paid_at) values ('paid', 'bea@example.test', '[{"id":"fr-daily-spf-30","name":"Daily SPF 30","qty":1,"price_cents":3800}]', 3800, now())`);
  let r = await ok("skin", T.bea, { action: "routine" });
  assert.deepEqual(r.purchased.map((p) => p.product_id), ["fr-daily-spf-30"]);
  assert.equal(r.entries.length, 0);
  await ok("skin", T.bea, { action: "routine_save", entry: { slot: "am", product_id: "fr-daily-spf-30", product_name: "Daily SPF 30", category: "sunscreen", from_order: true } });
  r = await ok("skin", T.bea, { action: "routine" });
  assert.equal(r.purchased.length, 0);
  assert.equal(r.entries[0].source, "order");
  const { entry } = await ok("studio", T.evelyn2, { action: "routine_propose", profile_id: U.beaProfile, entry: { slot: "pm", product_name: "Barrier Gel Cream", category: "moisturizer" } });
  assert.equal(entry.status, "proposed");
  await ok("skin", T.bea, { action: "routine_accept", id: entry.id });
  await ok("skin", T.bea, { action: "checkin", on_date: "2026-10-22", am_done: true, pm_done: false, irritation: "none" });
  await ok("skin", T.bea, { action: "checkin", on_date: "2026-10-22", am_done: true, pm_done: true, irritation: "mild" });
  assert.equal((await pg.query("select count(*)::int n from routine_checkins")).rows[0].n, 1, "one check-in a day, updated");
});

test("recovery: a flagged check-in tells Evelyn where to look, without the client's name or skin details", async () => {
  notes.length = 0;
  await ok("skin", T.bea, { action: "recovery_checkin", treatment_id: U.beaTreatment, day_after: 1, redness: 2, comfort: 1, flagged: true, note: "warm and tight" });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].kind, "skin");
  assert.doesNotMatch(JSON.stringify(notes[0]), /Bea|warm|tight|redness/i);
  assert.equal((await call("skin", T.ana, { action: "recovery_checkin", treatment_id: U.beaTreatment, day_after: 1 })).status, 404);
  const needs = await ok("studio", T.evelyn2, { action: "needs" });
  assert.equal(needs.recovery.length, 1);
});

test("appointments and orders: the client's own, read-only", async () => {
  const a = await ok("skin", T.bea, { action: "appointments" });
  assert.equal(a.upcoming.length + a.history.length, 1);
  const o = await ok("skin", T.bea, { action: "orders" });
  assert.equal(o.orders.length, 1);
  assert.equal((await ok("skin", T.ana, { action: "orders" })).orders.length, 0);
});

test("rate limits: a burst of the same call is slowed down", async () => {
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await call("skin", T.ana, { action: "enroll" })).status);
  assert.ok(statuses.includes(429), String(statuses));
});

test("export: everything of theirs, nothing of anyone else's, no practitioner notes", async () => {
  const x = await ok("skin", T.bea, { action: "export" });
  assert.equal(x.email, "bea@example.test");
  assert.ok(x.consents.length >= 2 && x.captures.length === 2 && x.routine.length === 2 && x.reports.length === 1);
  assert.doesNotMatch(JSON.stringify(x), /ana@example|private|needle_depth|glare/);
});

test("deletion: the client asks, an admin completes it, images and derived data go, the required records stay", async () => {
  notes.length = 0;
  const req = await ok("skin", T.bea, { action: "delete_request", note: "Please delete my photos" });
  assert.equal((await pg.query("select status from skin_profiles where id = $1", [U.beaProfile])).rows[0].status, "deletion_requested");
  assert.doesNotMatch(JSON.stringify(notes), /Bea/);
  assert.equal((await call("studio", T.pat2, { action: "data_request_complete", id: req.request_id })).body.reason, "admin_only");
  const objects = [...api.storage.keys()].filter((k) => k.includes(U.beaProfile)).length;
  assert.equal(objects, 2);
  const done = await ok("studio", T.evelyn2, { action: "data_request_complete", id: req.request_id });
  assert.equal(done.files_removed, 2);
  assert.equal([...api.storage.keys()].filter((k) => k.includes(U.beaProfile)).length, 0);
  const left = async (t) => (await pg.query(`select count(*)::int n from ${t} where profile_id = $1`, [U.beaProfile])).rows[0].n;
  for (const t of ["captures", "measurements", "imaging_sessions", "routine_entries", "progress_reports", "change_detections"]) assert.equal(await left(t), 0, t);
  assert.equal(await left("treatment_records"), 2, "signed treatment records are kept");
  assert.ok((await pg.query("select count(*)::int n from consents where email = 'bea@example.test'")).rows[0].n >= 3, "consents are kept");
  const p = (await pg.query("select status, name, goals from skin_profiles where id = $1", [U.beaProfile])).rows[0];
  assert.deepEqual(p, { status: "deleted", name: null, goals: null });
  assert.equal((await call("skin", T.bea, { action: "timeline" })).body.reason, "not_enrolled");
});

test("audit: every sensitive action left a row naming who and what, and admins can read it", async () => {
  const { entries } = await ok("studio", T.evelyn2, { action: "audit", limit: 500 });
  const actions = new Set(entries.map((e) => e.action));
  for (const a of ["client.enroll", "client.consent", "client.capture.begin", "studio.client.open", "studio.capture.view", "studio.treatment.sign",
    "studio.report.approve", "client.report.view", "studio.data_request.complete", "studio.denied"]) assert.ok(actions.has(a), `no audit row for ${a}`);
  assert.ok(entries.every((e) => !JSON.stringify(e.detail ?? {}).match(/private|warm and tight/)), "audit rows never hold notes");
});

test("analytics: operational counts only, nothing that names a client", async () => {
  const a = await ok("studio", T.evelyn2, { action: "analytics", since: "2026-01-01" });
  assert.ok(a.imaging_sessions >= 1 && a.captures >= 1, JSON.stringify(a));
  assert.ok("quality_failure_rate" in a && "follow_up_completion_rate" in a);
  assert.doesNotMatch(JSON.stringify(a), /@|Ana|Bea/);
});
