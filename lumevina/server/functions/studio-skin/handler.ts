// Lumevina — Skin Intelligence for staff (functions/studio-skin)
//
// Only people with an active `staff` row, signed in with multifactor. The
// shared STUDIO_KEY is not accepted. A practitioner opens the clients the
// clinic's assignment mode allows (every client at a solo studio); an admin
// also manages staff, devices, validation, settings, the audit log and data
// requests. Every opening of a client's record, every image link and every
// change is written to audit_log.
//
//   POST { action, ... } with Authorization: Bearer <a staff access token, aal2>
//   Practitioner: whoami · clients · client · enroll · profile_save · contraindication_add · consent_record
//     session_open · session_update · capture_begin · capture_commit · quality_review · image_urls
//     analyze · compare · measurement_review · change_review · site_save
//     treatment_save · treatment_sign · treatment_amend · routine_propose
//     report_draft · report · report_approve · report_withdraw · needs
//   Admin: staff_list · staff_set · assign · unassign · settings_set · devices · device_set
//     validation_set · audit · data_requests · data_request_complete · analytics

// deno-lint-ignore-file no-explicit-any
import { audit, body, HttpError, limit, must, nowIso, serve, setting, signedUrls, staffOf, today, urlSeconds, BUCKET, type Deps, type Staff } from "../_shared/skin.ts";
import { beginCapture, commitCapture, consentsFor, currentTexts, enqueue, loadRecord, pathsFor } from "../_shared/skin-data.ts";
import { ADMIN_ACTIONS, staffMayOpen } from "../_shared/skin/core/access.js";
import { may, blockedReason } from "../_shared/skin/core/consent.js";
import { classifyChange, changeMessage } from "../_shared/skin/core/change.js";
import { buildReport } from "../_shared/skin/core/report.js";
import { checkWording } from "../_shared/skin/core/wording.js";
import { isRegion } from "../_shared/skin/core/regions.js";
import {
  cleanConsentAnswer, cleanContraindication, cleanDevice, cleanMeasurementReview, cleanRoutineEntry, cleanSession,
  cleanSkinProfile, cleanStaff, cleanTreatment, cleanValidation, isEmail, isUuid, normEmail,
} from "../_shared/skin/core/validate.js";

export function handle(req: Request, deps: Deps) {
  return serve(req, deps, async () => {
    const me = await staffOf(req, deps);
    const b = await body(req);
    const action = String(b.action ?? "");
    const db = deps.db;
    const log = (name: string, extra: Record<string, unknown> = {}) =>
      audit(deps, req, { actor_user_id: me.id, actor_role: me.role, action: `studio.${name}`, ...extra });

    if (ADMIN_ACTIONS.has(action) && me.role !== "admin") {
      await log(action, { outcome: "denied", detail: { reason: "admin_only" } });
      throw new HttpError(403, "admin_only");
    }
    await limit(deps, `studio:${me.id}`, 240, 120);

    /** The profile, if this staff member may open it; audited either way. */
    const open = async (profileId: unknown, why = "open") => {
      if (!isUuid(profileId)) throw new HttpError(400, "invalid");
      const p = must(await db.from("skin_profiles").select("*").eq("id", profileId).maybeSingle());
      if (!p || p.status === "deleted") throw new HttpError(404, "no_profile");
      const mode = await setting(deps, "assignment_mode", "all");
      const assigned = mode === "assigned" ? must(await db.from("client_assignments").select("profile_id").eq("staff_user_id", me.id)).map((r: any) => r.profile_id) : [];
      if (!staffMayOpen({ role: me.role, active: true }, p.id, { assignmentMode: mode, assignedProfileIds: assigned })) {
        await log(why, { profile_id: p.id, outcome: "denied", detail: { reason: "not_assigned" } });
        throw new HttpError(403, "not_assigned");
      }
      return p;
    };
    const capture = async (id: unknown) => {
      if (!isUuid(id)) throw new HttpError(400, "invalid");
      const c = must(await db.from("captures").select("*").eq("id", id).maybeSingle());
      if (!c) throw new HttpError(404, "no_capture");
      return { capture: c, profile: await open(c.profile_id, "capture") };
    };

    switch (action) {
      case "whoami":
        return { staff: { id: me.id, email: me.email, name: me.name, role: me.role }, settings: { assignment_mode: await setting(deps, "assignment_mode", "all") } };

      /* ── clients ── */
      case "clients": {
        const q = String(b.q ?? "").trim().toLowerCase().slice(0, 80);
        const mode = await setting(deps, "assignment_mode", "all");
        let profiles = must(await db.from("skin_profiles").select("id, email, name, concerns, status, enrolled_at, updated_at").neq("status", "deleted").order("updated_at", { ascending: false }).limit(500));
        if (me.role !== "admin" && mode === "assigned") {
          const mine = new Set(must(await db.from("client_assignments").select("profile_id").eq("staff_user_id", me.id)).map((r: any) => r.profile_id));
          profiles = profiles.filter((p: any) => mine.has(p.id));
        }
        if (q) profiles = profiles.filter((p: any) => p.email.includes(q) || String(p.name ?? "").toLowerCase().includes(q));
        const ids = profiles.map((p: any) => p.id);
        const sessions = ids.length ? must(await db.from("imaging_sessions").select("profile_id, started_at").in("profile_id", ids).order("started_at", { ascending: false })) : [];
        const last = new Map<string, string>();
        for (const s of sessions) if (!last.has(s.profile_id)) last.set(s.profile_id, s.started_at);
        let contacts: any[] = [];
        if (q.length >= 2) {
          const all = must(await db.from("contacts").select("email, name").limit(2000));
          const have = new Set(profiles.map((p: any) => p.email));
          contacts = all.filter((c: any) => !have.has(c.email) && (c.email.includes(q) || String(c.name ?? "").toLowerCase().includes(q))).slice(0, 20);
        }
        await log("clients.list", { detail: { q: q ? "yes" : "no", n: profiles.length } });
        return { clients: profiles.map((p: any) => ({ ...p, last_session: last.get(p.id) ?? null })), not_enrolled: contacts };
      }

      case "client": {
        const p = await open(b.profile_id);
        const [r, { state, rows: consentRows }, intake, bookings, routine, recovery, reports, sites] = await Promise.all([
          loadRecord(deps, p.id), consentsFor(deps, p.email),
          db.from("intake_forms").select("answers, signed_at, updated_at").eq("email", p.email).maybeSingle().then((x: any) => x.data ?? null),
          db.from("bookings").select("id, date, start_min, dur_min, services, status").eq("guest_email", p.email).order("date", { ascending: false }).limit(30).then((x: any) => must(x)),
          db.from("routine_entries").select("*").eq("profile_id", p.id).order("slot").order("position").then((x: any) => must(x)),
          db.from("recovery_checkins").select("*").eq("profile_id", p.id).order("created_at", { ascending: false }).limit(30).then((x: any) => must(x)),
          db.from("progress_reports").select("id, title, status, period_from, period_to, created_at, approved_at, withdrawn_at").eq("profile_id", p.id).order("created_at", { ascending: false }).then((x: any) => must(x)),
          db.from("imaging_sites").select("*").eq("profile_id", p.id).eq("active", true).then((x: any) => must(x)),
        ]);
        await log("client.open", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: p, consents: state, consent_history: consentRows, intake, bookings, routine, recovery, reports, sites, ...r };
      }

      case "enroll": {
        const email = normEmail(b.email);
        if (!isEmail(email)) throw new HttpError(400, "invalid", { errors: { email: "A valid email." } });
        const existing = must(await db.from("skin_profiles").select("*").eq("email", email).maybeSingle());
        if (existing && existing.status !== "deleted") return { profile: existing, existed: true };
        if (existing) throw new HttpError(409, "deleted_profile");
        const { data: c } = await db.from("clients").select("id, name").eq("email", email).maybeSingle();
        const { data: contact } = await db.from("contacts").select("name").eq("email", email).maybeSingle();
        const name = String(b.name ?? "").trim().slice(0, 120) || c?.name || contact?.name || null;
        const p = must(await db.from("skin_profiles").insert({ email, client_id: c?.id ?? null, name, enrolled_by: me.id }).select("*").single());
        await log("enroll", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: p };
      }

      case "profile_save": {
        const p = await open(b.profile_id, "profile.save");
        const clean = cleanSkinProfile(b.profile);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const saved = must(await db.from("skin_profiles").update({ ...clean.value, updated_at: nowIso(deps) }).eq("id", p.id).select("*").single());
        await log("profile.save", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: saved };
      }

      case "contraindication_add": {
        const p = await open(b.profile_id, "contraindication");
        const clean = cleanContraindication(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const list = [...(p.contraindications ?? []), { note: clean.value.note, at: nowIso(deps), by: me.name }].slice(-50);
        const saved = must(await db.from("skin_profiles").update({ contraindications: list, updated_at: nowIso(deps) }).eq("id", p.id).select("*").single());
        await log("contraindication.add", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: saved };
      }

      case "consent_record": {
        const p = await open(b.profile_id, "consent.record");
        const clean = cleanConsentAnswer(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const texts = await currentTexts(deps);
        if (texts[clean.value.kind]?.version !== clean.value.version) throw new HttpError(409, "text_changed", { current: texts[clean.value.kind] ?? null });
        const row = must(await db.from("consents").insert({
          email: p.email, client_id: p.client_id, kind: clean.value.kind, version: clean.value.version, granted: clean.value.granted,
          signature: clean.value.signature, source: "studio", recorded_by: me.id,
        }).select("id").single());
        await log("consent.record", { profile_id: p.id, record_table: "consents", record_id: row.id, detail: { kind: clean.value.kind, granted: clean.value.granted } });
        return { consents: (await consentsFor(deps, p.email)).state };
      }

      /* ── imaging ── */
      case "session_open": {
        const p = await open(b.profile_id, "session.open");
        const { state } = await consentsFor(deps, p.email);
        if (!may.capture(state)) throw new HttpError(403, "consent_required", { kind: "clinical_photography", message: blockedReason("capture", state) });
        const clean = cleanSession(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        if (clean.value.booking_id) {
          const bk = must(await db.from("bookings").select("id, guest_email, services").eq("id", clean.value.booking_id).maybeSingle());
          if (!bk || normEmail(bk.guest_email) !== p.email) throw new HttpError(400, "booking_not_this_client");
          if (!clean.value.service_id && Array.isArray(bk.services)) clean.value.service_id = String(bk.services[0] ?? "") || null;
        }
        const s = must(await db.from("imaging_sessions").insert({ ...clean.value, profile_id: p.id, performed_by: me.id, status: "open", started_at: nowIso(deps) }).select("*").single());
        await log("session.open", { profile_id: p.id, record_table: "imaging_sessions", record_id: s.id });
        return { session: s };
      }

      case "session_update": {
        if (!isUuid(b.session_id)) throw new HttpError(400, "invalid");
        const s = must(await db.from("imaging_sessions").select("*").eq("id", b.session_id).maybeSingle());
        if (!s) throw new HttpError(404, "no_session");
        const p = await open(s.profile_id, "session.update");
        const patch: any = {};
        if (typeof b.notes_private === "string") patch.notes_private = b.notes_private.trim().slice(0, 2000) || null;
        if (typeof b.visit_label === "string") patch.visit_label = b.visit_label.trim().slice(0, 80) || null;
        if (b.status === "submitted") { patch.status = "submitted"; patch.submitted_at = nowIso(deps); }
        if (b.status === "reviewed") { patch.status = "reviewed"; patch.reviewed_at = nowIso(deps); patch.reviewed_by = me.id; }
        if (b.status === "void") patch.status = "void";
        const saved = must(await db.from("imaging_sessions").update(patch).eq("id", s.id).select("*").single());
        await log("session.update", { profile_id: p.id, record_table: "imaging_sessions", record_id: s.id, detail: { status: patch.status ?? null } });
        return { session: saved };
      }

      case "capture_begin": {
        if (!isUuid(b.session_id)) throw new HttpError(400, "invalid");
        const s = must(await db.from("imaging_sessions").select("id, profile_id, status").eq("id", b.session_id).maybeSingle());
        if (!s) throw new HttpError(404, "no_session");
        if (s.status === "void") throw new HttpError(409, "session_void");
        const p = await open(s.profile_id, "capture.begin");
        await limit(deps, `studio:capture:${me.id}`, 120, 20);
        const out = await beginCapture(deps, { profile: p, sessionId: s.id, input: b, actor: { id: me.id, role: me.role } });
        await log("capture.begin", { profile_id: p.id, record_table: "captures", record_id: out.capture.id, detail: { region: out.capture.region } });
        return { capture_id: out.capture.id, upload: out.upload };
      }

      case "capture_commit": {
        const { capture: c, profile: p } = await capture(b.capture_id);
        const out = await commitCapture(deps, c);
        await log("capture.commit", { profile_id: p.id, record_table: "captures", record_id: c.id });
        if (deps.notify && b.notify !== false) { /* the worker tells her when quality is in; nothing here */ }
        return out;
      }

      case "quality_review": {
        const { capture: c, profile: p } = await capture(b.capture_id);
        const decision = ["accept", "retake", "exclude"].includes(b.decision) ? b.decision : null;
        if (!decision) throw new HttpError(400, "invalid");
        const q = must(await db.from("quality_checks").select("id").eq("capture_id", c.id).order("created_at", { ascending: false }).limit(1));
        if (q.length) must(await db.from("quality_checks").update({ review_decision: decision, reviewed_by: me.id, reviewed_at: nowIso(deps), ...(decision === "accept" ? { comparable: true, passed: true } : {}) }).eq("id", q[0].id));
        if (decision === "exclude") must(await db.from("captures").update({ status: "excluded", excluded_reason: String(b.reason ?? "Excluded at review").slice(0, 300) }).eq("id", c.id));
        await log("quality.review", { profile_id: p.id, record_table: "captures", record_id: c.id, detail: { decision } });
        return { capture_id: c.id, decision };
      }

      case "image_urls": {
        const p = await open(b.profile_id, "capture.view");
        const ids = (Array.isArray(b.capture_ids) ? b.capture_ids : []).filter(isUuid).slice(0, 60);
        const kind = ["view", "thumb", "original", "diffmap", "aligned"].includes(b.kind) ? b.kind : "view";
        const r = await loadRecord(deps, p.id);
        const paths = (kind === "diffmap" || kind === "aligned") && isUuid(b.reference_id)
          ? Object.fromEntries(ids.map((id: string) => [id, r.derived.find((d: any) => d.capture_id === id && d.kind === kind && d.reference_capture_id === b.reference_id)?.path ?? null]))
          : pathsFor(r, ids, kind, true);
        const seconds = await urlSeconds(deps);
        const signed = await signedUrls(deps, Object.values(paths).filter(Boolean) as string[], seconds);
        const urls = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, path ? signed.get(path as string) ?? null : null]));
        const shown = Object.keys(urls).filter((id) => urls[id]);
        if (shown.length) await log("capture.view", { profile_id: p.id, record_table: "captures", detail: { ids: shown, kind } });
        return { urls, expires_in: seconds };
      }

      case "analyze": {
        const { capture: c, profile: p } = await capture(b.capture_id);
        const { state } = await consentsFor(deps, p.email);
        if (!may.analyze(state)) throw new HttpError(403, "consent_required", { kind: "clinical_photography" });
        if (c.status === "pending_upload") throw new HttpError(409, "not_uploaded");
        // a scar outline, in original-image pixels: up to 200 points
        const roi = Array.isArray(b.scar_roi) ? b.scar_roi.slice(0, 200).map((pt: any) => [Number(pt?.[0]), Number(pt?.[1])]).filter((pt: number[]) => pt.every((v) => Number.isFinite(v) && v >= 0 && v < 100000)) : [];
        await enqueue(deps, c.id, "measure", null, roi.length >= 3 ? { scar_roi: roi } : null);
        await log("analyze", { profile_id: p.id, record_table: "captures", record_id: c.id });
        return { queued: true };
      }

      case "compare": {
        const a = await capture(b.from_capture_id), z = await capture(b.to_capture_id);
        if (a.profile.id !== z.profile.id) throw new HttpError(400, "different_clients");
        if (a.capture.region !== z.capture.region) throw new HttpError(400, "different_regions");
        await enqueue(deps, z.capture.id, "register", a.capture.id);
        const r = await loadRecord(deps, a.profile.id);
        const changes = await detectChanges(deps, r, a.capture, z.capture);
        await log("compare", { profile_id: a.profile.id, record_table: "captures", record_id: z.capture.id, detail: { from: a.capture.id, n: changes.length } });
        return { queued_registration: true, changes };
      }

      case "measurement_review": {
        const clean = cleanMeasurementReview(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const m = must(await db.from("measurements").select("id, profile_id").eq("id", clean.value.id).maybeSingle());
        if (!m) throw new HttpError(404, "no_measurement");
        const p = await open(m.profile_id, "measurement.review");
        const row = must(await db.from("measurements").update({ review_status: clean.value.review_status, review_note: clean.value.review_note, reviewed_by: me.id, reviewed_at: nowIso(deps) }).eq("id", m.id).select("*").single());
        await log("measurement.review", { profile_id: p.id, record_table: "measurements", record_id: m.id, detail: { status: clean.value.review_status } });
        return { measurement: row };
      }

      case "change_review": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const c = must(await db.from("change_detections").select("*").eq("id", b.id).maybeSingle());
        if (!c) throw new HttpError(404, "no_change");
        const p = await open(c.profile_id, "change.review");
        const status = ["confirmed", "dismissed", "unreviewed"].includes(b.review_status) ? b.review_status : c.review_status;
        const share = status === "confirmed" && !!b.shared_with_client && !["invalid_comparison"].includes(c.verdict);
        const row = must(await db.from("change_detections").update({ review_status: status, shared_with_client: share, reviewed_by: me.id, reviewed_at: nowIso(deps) }).eq("id", c.id).select("*").single());
        await log("change.review", { profile_id: p.id, record_table: "change_detections", record_id: c.id, detail: { status, share } });
        return { change: row };
      }

      case "site_save": {
        const p = await open(b.profile_id, "site.save");
        const name = String(b.name ?? "").trim().slice(0, 80);
        if (!name || !isRegion(b.region)) throw new HttpError(400, "invalid", { errors: { name: name ? "" : "Name the spot.", region: isRegion(b.region) ? "" : "Choose the area." } });
        const row = must(await db.from("imaging_sites").insert({ profile_id: p.id, name, region: b.region, description: String(b.description ?? "").trim().slice(0, 300) || null, created_by: me.id }).select("*").single());
        await log("site.save", { profile_id: p.id, record_table: "imaging_sites", record_id: row.id });
        return { site: row };
      }

      /* ── treatment records ── */
      case "treatment_save": {
        const p = await open(b.profile_id, "treatment.save");
        const { state } = await consentsFor(deps, p.email);
        if (!may.recordTreatment(state)) throw new HttpError(403, "consent_required", { kind: "treatment", message: blockedReason("recordTreatment", state) });
        const clean = cleanTreatment(b.treatment);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const v = clean.value;
        if (v.session_id) { const s = must(await db.from("imaging_sessions").select("profile_id").eq("id", v.session_id).maybeSingle()); if (!s || s.profile_id !== p.id) throw new HttpError(400, "invalid"); }
        if (v.booking_id) { const bk = must(await db.from("bookings").select("guest_email").eq("id", v.booking_id).maybeSingle()); if (!bk || normEmail(bk.guest_email) !== p.email) throw new HttpError(400, "booking_not_this_client"); }
        let row;
        if (isUuid(b.treatment?.id)) {
          row = must(await db.from("treatment_records").update(v).eq("id", b.treatment.id).eq("profile_id", p.id).eq("status", "draft").select("*").maybeSingle());
          if (!row) throw new HttpError(409, "not_a_draft");
        } else {
          row = must(await db.from("treatment_records").insert({ ...v, profile_id: p.id, performed_by: me.id, status: "draft" }).select("*").single());
        }
        await log("treatment.save", { profile_id: p.id, record_table: "treatment_records", record_id: row.id });
        return { treatment: row, wording: checkWording(row.client_summary) };
      }

      case "treatment_sign": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const t = must(await db.from("treatment_records").select("*").eq("id", b.id).maybeSingle());
        if (!t) throw new HttpError(404, "no_treatment");
        const p = await open(t.profile_id, "treatment.sign");
        if (t.status !== "draft") throw new HttpError(409, "not_a_draft");
        const problems = checkWording(t.client_summary);
        if (problems.length && !b.accept_wording) throw new HttpError(422, "wording", { problems });
        const row = must(await db.from("treatment_records").update({ status: "signed", signed_at: nowIso(deps) }).eq("id", t.id).select("*").single());
        await log("treatment.sign", { profile_id: p.id, record_table: "treatment_records", record_id: t.id });
        return { treatment: row };
      }

      case "treatment_amend": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const old = must(await db.from("treatment_records").select("*").eq("id", b.id).maybeSingle());
        if (!old) throw new HttpError(404, "no_treatment");
        const p = await open(old.profile_id, "treatment.amend");
        if (old.status !== "signed") throw new HttpError(409, "not_signed");
        const clean = cleanTreatment({ ...old, ...b.treatment });
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const row = must(await db.from("treatment_records").insert({ ...clean.value, profile_id: p.id, performed_by: me.id, amended_from: old.id, status: "signed", signed_at: nowIso(deps) }).select("*").single());
        must(await db.from("treatment_records").update({ status: "amended" }).eq("id", old.id));
        await log("treatment.amend", { profile_id: p.id, record_table: "treatment_records", record_id: row.id, detail: { amends: old.id } });
        return { treatment: row };
      }

      case "routine_propose": {
        const p = await open(b.profile_id, "routine.propose");
        const clean = cleanRoutineEntry(b.entry);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const row = must(await db.from("routine_entries").insert({ ...clean.value, profile_id: p.id, source: "practitioner", status: "proposed", proposed_by: me.id }).select("*").single());
        await log("routine.propose", { profile_id: p.id, record_table: "routine_entries", record_id: row.id });
        return { entry: row };
      }

      /* ── reports ── */
      case "report_draft": {
        const p = await open(b.profile_id, "report.draft");
        const r = await loadRecord(deps, p.id);
        const sessionIds = (Array.isArray(b.session_ids) ? b.session_ids : r.sessions.map((s: any) => s.id)).filter((id: string) => r.sessions.some((s: any) => s.id === id));
        const capIds = new Set(r.captures.filter((c: any) => sessionIds.includes(c.session_id)).map((c: any) => c.id));
        const images = (Array.isArray(b.image_capture_ids) ? b.image_capture_ids : []).filter((id: string) => capIds.has(id)).map((id: string) => {
          const c = r.captures.find((x: any) => x.id === id); const s = r.sessions.find((x: any) => x.id === c.session_id);
          return { capture_id: id, region: c.region, date: c.captured_at, label: s?.visit_label ?? null };
        });
        const capDate = new Map(r.captures.map((c: any) => [c.id, c.captured_at]));
        const routine = must(await db.from("routine_entries").select("slot, product_name, how, status").eq("profile_id", p.id).eq("status", "active"));
        const built = buildReport({
          profile: p,
          period: { from: b.period_from ?? null, to: b.period_to ?? today(deps) },
          visits: r.sessions.filter((s: any) => sessionIds.includes(s.id)).map((s: any, i: number) => ({ id: s.id, date: s.started_at, label: s.visit_label ?? `Visit ${i + 1}` })),
          images,
          measurements: r.measurements.filter((m: any) => capIds.has(m.capture_id)).map((m: any) => ({ ...m, date: capDate.get(m.capture_id) })),
          changes: r.changes.filter((c: any) => capIds.has(c.to_capture_id)),
          treatments: r.treatments.filter((t: any) => t.status === "signed" && (!t.session_id || sessionIds.includes(t.session_id))),
          routine,
          summary: b.summary,
        });
        const title = String(b.title ?? "").trim().slice(0, 120) || "Your skin progress";
        const row = must(await db.from("progress_reports").insert({ profile_id: p.id, title, period_from: b.period_from ?? null, period_to: b.period_to ?? today(deps),
          session_ids: sessionIds, content: built.content, status: "draft", created_by: me.id }).select("*").single());
        await log("report.draft", { profile_id: p.id, record_table: "progress_reports", record_id: row.id });
        return { report: row, problems: built.ok ? [] : built.problems };
      }

      case "report": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const rep = must(await db.from("progress_reports").select("*").eq("id", b.id).maybeSingle());
        if (!rep) throw new HttpError(404, "no_report");
        const p = await open(rep.profile_id, "report.preview");
        const r = await loadRecord(deps, p.id);
        const ids = (rep.content?.images ?? []).map((i: any) => i.capture_id).filter(isUuid);
        const paths = pathsFor(r, ids, "view", true);
        const seconds = await urlSeconds(deps);
        const signed = await signedUrls(deps, Object.values(paths).filter(Boolean) as string[], seconds);
        await log("report.preview", { profile_id: p.id, record_table: "progress_reports", record_id: rep.id });
        return { report: rep, urls: Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, path ? signed.get(path as string) ?? null : null])), expires_in: seconds };
      }

      case "report_approve": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const rep = must(await db.from("progress_reports").select("*").eq("id", b.id).maybeSingle());
        if (!rep) throw new HttpError(404, "no_report");
        const p = await open(rep.profile_id, "report.approve");
        if (rep.status !== "draft") throw new HttpError(409, "not_a_draft");
        const problems = checkWording(rep.content?.summary);
        if (problems.length) throw new HttpError(422, "wording", { problems });
        const row = must(await db.from("progress_reports").update({ status: "approved", approved_by: me.id, approved_at: nowIso(deps) }).eq("id", rep.id).select("*").single());
        await log("report.approve", { profile_id: p.id, record_table: "progress_reports", record_id: rep.id });
        return { report: row };
      }

      case "report_withdraw": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const rep = must(await db.from("progress_reports").select("id, profile_id, status").eq("id", b.id).maybeSingle());
        if (!rep) throw new HttpError(404, "no_report");
        const p = await open(rep.profile_id, "report.withdraw");
        if (rep.status === "draft") { must(await db.from("progress_reports").delete().eq("id", rep.id)); }
        else must(await db.from("progress_reports").update({ status: "withdrawn", withdrawn_at: nowIso(deps) }).eq("id", rep.id));
        await log("report.withdraw", { profile_id: p.id, record_table: "progress_reports", record_id: rep.id });
        return { ok: true };
      }

      /* ── what needs her ── */
      case "needs": {
        const [sessions, unreviewed, changes, recovery, requests] = await Promise.all([
          db.from("imaging_sessions").select("id, profile_id, visit_label, started_at, status").eq("status", "submitted").order("started_at").limit(50),
          db.from("measurements").select("profile_id").eq("review_status", "unreviewed").limit(2000),
          db.from("change_detections").select("id, profile_id, name, region, verdict, created_at").eq("review_status", "unreviewed").in("verdict", ["improvement", "deterioration"]).limit(100),
          db.from("recovery_checkins").select("id, profile_id, day_after, created_at").eq("flagged", true).order("created_at", { ascending: false }).limit(50),
          db.from("data_requests").select("id, kind, requested_at").eq("status", "open").limit(50),
        ]).then((rs) => rs.map((x) => must(x)));
        const profiles = new Set([...sessions, ...unreviewed, ...changes, ...recovery].map((x: any) => x.profile_id));
        const names = profiles.size ? must(await db.from("skin_profiles").select("id, name, email").in("id", [...profiles])) : [];
        const counts: Record<string, number> = {};
        for (const m of unreviewed) counts[m.profile_id] = (counts[m.profile_id] ?? 0) + 1;
        await log("needs");
        return { sessions, measurements_to_review: counts, changes, recovery, data_requests: me.role === "admin" ? requests : [], names };
      }

      /* ── admin ── */
      case "staff_list":
        return { staff: must(await db.from("staff").select("user_id, email, display_name, role, active, created_at").order("created_at")) };

      case "staff_set": {
        const clean = cleanStaff(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const { data: uid } = await db.rpc("user_id_for_email", { p_email: clean.value.email });
        if (!uid) throw new HttpError(404, "no_account", { message: "Ask them to sign in once at the studio page with this email, then add them." });
        if (uid === me.id && (clean.value.role !== "admin" || !clean.value.active)) throw new HttpError(409, "keep_one_admin", { message: "You can't remove your own admin access." });
        const row = must(await db.from("staff").upsert({ user_id: uid, ...clean.value, created_by: me.id, updated_at: nowIso(deps) }, { onConflict: "user_id" }).select("*").single());
        await log("staff.set", { record_table: "staff", record_id: uid, detail: { role: clean.value.role, active: clean.value.active } });
        return { staff: row };
      }

      case "assign": case "unassign": {
        const p = await open(b.profile_id, action);
        if (!isUuid(b.staff_user_id)) throw new HttpError(400, "invalid");
        if (action === "assign") must(await db.from("client_assignments").upsert({ profile_id: p.id, staff_user_id: b.staff_user_id, created_by: me.id }, { onConflict: "profile_id,staff_user_id" }));
        else must(await db.from("client_assignments").delete().eq("profile_id", p.id).eq("staff_user_id", b.staff_user_id));
        await log(action, { profile_id: p.id, record_table: "client_assignments", record_id: b.staff_user_id });
        return { ok: true };
      }

      case "settings_set": {
        const key = String(b.key ?? "");
        let value: any;
        if (key === "assignment_mode") value = b.value === "assigned" ? "assigned" : "all";
        else if (key === "signed_url_seconds") value = Math.max(60, Math.min(900, Math.round(Number(b.value) || 300)));
        else if (key === "retention") value = {
          treatment_records_years: Math.max(1, Math.min(30, Math.round(Number(b.value?.treatment_records_years) || 7))),
          images_after_deletion_request_days: Math.max(0, Math.min(90, Math.round(Number(b.value?.images_after_deletion_request_days) || 30))),
          audit_log_years: Math.max(1, Math.min(30, Math.round(Number(b.value?.audit_log_years) || 7))),
        };
        else throw new HttpError(400, "unknown_setting");
        must(await db.from("skin_settings").upsert({ key, value, updated_at: nowIso(deps), updated_by: me.id }, { onConflict: "key" }));
        await log("settings.set", { record_table: "skin_settings", record_id: key });
        return { key, value };
      }

      case "devices":
        return { devices: must(await db.from("imaging_devices").select("*").order("created_at")), validation: must(await db.from("measurement_validation").select("*")) };

      case "device_set": {
        const clean = cleanDevice(b.device);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const v: any = { ...clean.value, updated_at: nowIso(deps) };
        if (v.calibration) v.calibration = { ...v.calibration, calibrated_by: me.name, calibrated_at: v.calibration.calibrated_at ?? nowIso(deps) };
        const row = isUuid(b.device?.id)
          ? must(await db.from("imaging_devices").update(v).eq("id", b.device.id).select("*").single())
          : must(await db.from("imaging_devices").insert(v).select("*").single());
        await log("device.set", { record_table: "imaging_devices", record_id: row.id });
        return { device: row };
      }

      case "validation_set": {
        const clean = cleanValidation(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const row = must(await db.from("measurement_validation").upsert({ ...clean.value, validated_by: me.id, validated_at: nowIso(deps) }, { onConflict: "name,region,device_kind" }).select("*").single());
        await log("validation.set", { record_table: "measurement_validation", record_id: `${row.name}/${row.region}/${row.device_kind}`, detail: { status: row.status } });
        return { validation: row };
      }

      case "audit": {
        let q = db.from("audit_log").select("id, at, actor_user_id, actor_role, action, profile_id, record_table, record_id, outcome, detail").order("at", { ascending: false }).limit(Math.min(500, Number(b.limit) || 200));
        if (isUuid(b.profile_id)) q = q.eq("profile_id", b.profile_id);
        if (isUuid(b.actor_user_id)) q = q.eq("actor_user_id", b.actor_user_id);
        if (typeof b.action_prefix === "string" && /^[a-z._]{1,40}$/.test(b.action_prefix)) q = q.like("action", `${b.action_prefix}%`);
        const rows = must(await q);
        await log("audit.read", { detail: { n: rows.length } });
        return { entries: rows };
      }

      case "data_requests":
        return { requests: must(await db.from("data_requests").select("*").order("requested_at", { ascending: false }).limit(200)) };

      case "data_request_complete": {
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const r = must(await db.from("data_requests").select("*").eq("id", b.id).maybeSingle());
        if (!r || r.status !== "open") throw new HttpError(404, "no_request");
        const status = b.status === "declined" ? "declined" : "done";
        let resolution = String(b.resolution ?? "").trim().slice(0, 1000) || null;
        let removed = 0;
        if (status === "done" && r.kind === "delete" && r.profile_id) {
          const keep = b.keep_treatments !== false;
          const paths = must(await db.rpc("purge_skin_profile", { p_profile: r.profile_id, p_keep_treatments: keep })).map((x: any) => x.path ?? x);
          for (let i = 0; i < paths.length; i += 100) {
            const { error } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
            if (error) console.error("remove", error); else removed += Math.min(100, paths.length - i);
          }
          resolution = resolution ?? `Images, measurements, routine, check-ins and reports deleted.${keep ? " Signed treatment records kept as the law requires." : ""} Consents and the audit log kept.`;
        }
        const row = must(await db.from("data_requests").update({ status, resolution, completed_at: nowIso(deps), completed_by: me.id }).eq("id", r.id).select("*").single());
        await log("data_request.complete", { profile_id: r.profile_id, record_table: "data_requests", record_id: r.id, detail: { kind: r.kind, status, files_removed: removed } });
        return { request: row, files_removed: removed };
      }

      case "analytics": {
        const since = String(b.since ?? "").match(/^\d{4}-\d{2}-\d{2}$/) ? b.since : new Date(Date.parse(today(deps)) - 180 * 86400000).toISOString().slice(0, 10);
        const [profiles, sessions, captures, quality, measurements, treatments, reports, recovery] = await Promise.all([
          db.from("skin_profiles").select("id, status, enrolled_at"),
          db.from("imaging_sessions").select("id, profile_id, started_at, status, performed_by").gte("started_at", since),
          db.from("captures").select("id, status, source, captured_at").gte("captured_at", since),
          db.from("quality_checks").select("capture_id, passed, comparable, flags, created_at").gte("created_at", since),
          db.from("measurements").select("review_status").gte("created_at", since),
          db.from("treatment_records").select("profile_id, treated_at, follow_up_on, series, status").gte("treated_at", since),
          db.from("progress_reports").select("status, approved_at").gte("created_at", since),
          db.from("recovery_checkins").select("flagged").gte("created_at", since),
        ]).then((rs) => rs.map((x) => must(x)));
        await log("analytics.read");
        return analytics({ profiles, sessions, captures, quality, measurements, treatments, reports, recovery, since, today: today(deps) });
      }

      default:
        throw new HttpError(400, "unknown_action");
    }
  });
}

/** Change detections between two captures for every measurement both have; written once per pair and version. */
async function detectChanges(deps: Deps, r: any, from: any, to: any) {
  const q = new Map(r.quality.map((x: any) => [x.capture_id, x]));
  const dev = (cap: any) => r.devices.find((d: any) => d.id === r.sessions.find((s: any) => s.id === cap.session_id)?.device_id)?.kind ?? null;
  const latest = (capId: string) => {
    const m = new Map<string, any>();
    for (const x of r.measurements) if (x.capture_id === capId && (!m.has(x.name) || String(x.created_at) > String(m.get(x.name).created_at))) m.set(x.name, x);
    return m;
  };
  const A = latest(from.id), Z = latest(to.id);
  const out: any[] = [];
  for (const [name, ma] of A) {
    const mz = Z.get(name);
    if (!mz) continue;
    const side = (m: any, cap: any) => ({
      name, region: m.region, value: m.value == null ? NaN : Number(m.value), quality: m.quality,
      comparable: (q.get(cap.id) as any)?.comparable ?? false, calibration_status: m.calibration_status,
      device_kind: dev(cap), um_per_px: cap.um_per_px, algorithm_version: m.algorithm_version, review_status: m.review_status,
    });
    const a = side(ma, from), z = side(mz, to);
    const val = r.validation.find((v: any) => v.name === name && (v.region === ma.region || v.region === "any") && (v.device_kind === a.device_kind || v.device_kind === "any") && v.status === "validated") ?? null;
    const res = classifyChange(a, z, val);
    const row = {
      profile_id: from.profile_id, name, region: ma.region, from_capture_id: from.id, to_capture_id: to.id,
      from_value: Number.isFinite(a.value) ? a.value : null, to_value: Number.isFinite(z.value) ? z.value : null,
      delta: res.delta, threshold: res.threshold, verdict: res.verdict, reasons: res.reasons, algorithm_version: res.version,
    };
    const existing = r.changes.find((c: any) => c.from_capture_id === from.id && c.to_capture_id === to.id && c.name === name && c.algorithm_version === res.version);
    const saved = existing ?? must(await deps.db.from("change_detections").insert(row).select("*").single());
    out.push({ ...saved, text: changeMessage(name, ma.region, res, "practitioner") });
  }
  return out;
}

/** Clinic numbers: operational counts only, nothing identifying, nothing clinical about a person. */
export function analytics(d: any) {
  const active = d.profiles.filter((p: any) => p.status === "active").length;
  const qc = d.quality;
  const failed = qc.filter((q: any) => !q.passed).length;
  const flags: Record<string, number> = {};
  for (const q of qc) for (const f of q.flags ?? []) flags[f] = (flags[f] ?? 0) + 1;
  const due = d.treatments.filter((t: any) => t.follow_up_on && t.follow_up_on <= d.today);
  const followed = due.filter((t: any) => d.sessions.some((s: any) => s.profile_id === t.profile_id && String(s.started_at).slice(0, 10) >= t.follow_up_on)).length;
  const series = d.treatments.filter((t: any) => t.series?.of).reduce((acc: any, t: any) => {
    const k = t.profile_id; acc[k] = Math.max(acc[k] ?? 0, t.series.session_no / t.series.of); return acc;
  }, {});
  const seriesVals = Object.values(series) as number[];
  const byMonth: Record<string, number> = {};
  for (const s of d.sessions) { const m = String(s.started_at).slice(0, 7); byMonth[m] = (byMonth[m] ?? 0) + 1; }
  const repeat = Object.values(d.sessions.reduce((acc: any, s: any) => { acc[s.profile_id] = (acc[s.profile_id] ?? 0) + 1; return acc; }, {})) as number[];
  return {
    since: d.since,
    enrolled_clients: active,
    imaging_sessions: d.sessions.length,
    sessions_by_month: byMonth,
    clients_with_repeat_imaging: repeat.filter((n) => n >= 2).length,
    captures: d.captures.length,
    client_added_captures: d.captures.filter((c: any) => c.source === "upload" || c.source === "camera").length,
    quality_checked: qc.length,
    quality_failure_rate: qc.length ? Math.round((failed / qc.length) * 1000) / 10 : null,
    quality_flags: flags,
    measurements_awaiting_review: d.measurements.filter((m: any) => m.review_status === "unreviewed").length,
    follow_ups_due: due.length,
    follow_ups_completed: followed,
    follow_up_completion_rate: due.length ? Math.round((followed / due.length) * 1000) / 10 : null,
    series_in_progress: seriesVals.filter((v) => v < 1).length,
    series_completed: seriesVals.filter((v) => v >= 1).length,
    reports_approved: d.reports.filter((r: any) => r.status === "approved").length,
    recovery_flags: d.recovery.filter((r: any) => r.flagged).length,
    note: "Operational counts only. Measurement trends are shown per client, never pooled, until measurements are validated.",
  };
}
