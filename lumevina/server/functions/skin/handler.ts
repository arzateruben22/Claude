// Lumevina — Skin Intelligence for the signed-in client (functions/skin)
//
// Every action acts on the caller's own record, found from their verified
// token; no action takes a client id or an email from the body. Clients see
// their photos, the measurements their practitioner has not rejected, the
// changes she confirmed and chose to share, the summary line of each signed
// treatment, their routine, check-ins, reports and consents. Never the
// practitioner's notes, review notes or treatment settings.
//
//   POST { action, ... } with Authorization: Bearer <their access token>
//   me · enroll · profile_save · consent · consent_withdraw
//   timeline · image_urls · evolution · capture_begin · capture_commit
//   routine · routine_save · routine_stop · routine_accept · checkin · recovery_checkin
//   reports · report · appointments · orders · export · delete_request

// deno-lint-ignore-file no-explicit-any
import { audit, body, clientOf, HttpError, limit, must, nowIso, serve, signedUrls, today, urlSeconds, type Deps } from "../_shared/skin.ts";
import { beginCapture, clientSessionToday, commitCapture, consentsFor, currentTexts, loadRecord, pathsFor, profileForPerson } from "../_shared/skin-data.ts";
import { cleanCheckin, cleanConsentAnswer, cleanRecoveryCheckin, cleanRoutineEntry, cleanSkinProfile, isUuid } from "../_shared/skin/core/validate.js";
import { measurementForClient, sessionForClient, treatmentForClient } from "../_shared/skin/core/access.js";
import { changeMessage } from "../_shared/skin/core/change.js";

export function handle(req: Request, deps: Deps) {
  return serve(req, deps, async () => {
    const person = await clientOf(req, deps);
    const b = await body(req);
    const action = String(b.action ?? "");
    const db = deps.db;
    const act = (name: string, extra: Record<string, unknown> = {}) =>
      audit(deps, req, { actor_user_id: person.id, actor_role: "client", action: `client.${name}`, ...extra });

    const profile = await profileForPerson(deps, person);
    const mine = () => { if (!profile) throw new HttpError(404, "not_enrolled"); return profile; };

    switch (action) {
      case "me": {
        const { state } = await consentsFor(deps, person.email);
        return { email: person.email, profile: profile ? publicProfile(profile) : null, consents: state, texts: await currentTexts(deps) };
      }

      case "enroll": {
        await limit(deps, `skin:enroll:${person.id}`, 5, 1);
        if (profile) return { profile: publicProfile(profile) };
        const { data: c } = await db.from("clients").select("id, name").eq("id", person.id).maybeSingle();
        const p = must(await db.from("skin_profiles").insert({ email: person.email, client_id: c ? person.id : null, name: c?.name ?? null }).select("*").single());
        await act("enroll", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: publicProfile(p) };
      }

      case "profile_save": {
        const p = mine();
        const clean = cleanSkinProfile(b.profile);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const patch: any = { ...clean.value, updated_at: nowIso(deps) };
        if (clean.value.privacy) patch.privacy = { ...(p.privacy ?? {}), ...clean.value.privacy };
        const saved = must(await db.from("skin_profiles").update(patch).eq("id", p.id).select("*").single());
        await act("profile.save", { profile_id: p.id, record_table: "skin_profiles", record_id: p.id });
        return { profile: publicProfile(saved) };
      }

      case "consent": {
        await limit(deps, `skin:consent:${person.id}`, 20, 2);
        const clean = cleanConsentAnswer(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const texts = await currentTexts(deps);
        if (texts[clean.value.kind]?.version !== clean.value.version) throw new HttpError(409, "text_changed", { current: texts[clean.value.kind] ?? null });
        const { data: c } = await db.from("clients").select("id").eq("id", person.id).maybeSingle();
        const row = must(await db.from("consents").insert({
          email: person.email, client_id: c ? person.id : null, kind: clean.value.kind, version: clean.value.version,
          granted: clean.value.granted, signature: clean.value.signature, source: "client",
          user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200) || null,
        }).select("id").single());
        await act("consent", { profile_id: profile?.id ?? null, record_table: "consents", record_id: row.id, detail: { kind: clean.value.kind, granted: clean.value.granted, version: clean.value.version } });
        return { consents: (await consentsFor(deps, person.email)).state };
      }

      case "consent_withdraw": {
        const kind = String(b.kind ?? "");
        const { rows } = await consentsFor(deps, person.email);
        const live = rows.find((r: any) => r.kind === kind);
        if (live && live.granted && !live.withdrawn_at) {
          must(await db.from("consents").update({ withdrawn_at: nowIso(deps) }).eq("id", live.id).is("withdrawn_at", null));
          await act("consent.withdraw", { profile_id: profile?.id ?? null, record_table: "consents", record_id: live.id, detail: { kind } });
        }
        return { consents: (await consentsFor(deps, person.email)).state };
      }

      case "timeline": {
        const p = mine();
        const r = await loadRecord(deps, p.id);
        return clientRecord(r);
      }

      case "image_urls": {
        const p = mine();
        const ids = (Array.isArray(b.capture_ids) ? b.capture_ids : []).filter(isUuid).slice(0, 60);
        const kind = ["view", "thumb", "diffmap"].includes(b.kind) ? b.kind : "view";
        await limit(deps, `skin:urls:${person.id}`, 60, 30);
        const r = await loadRecord(deps, p.id);
        const paths = kind === "diffmap" && isUuid(b.reference_id)
          ? Object.fromEntries(ids.map((id: string) => [id, r.derived.find((d: any) => d.capture_id === id && d.kind === "diffmap" && d.reference_capture_id === b.reference_id)?.path ?? null]))
          : pathsFor(r, ids, kind, false);
        const seconds = await urlSeconds(deps);
        const signed = await signedUrls(deps, Object.values(paths).filter(Boolean) as string[], seconds);
        const urls: Record<string, string | null> = {};
        for (const [id, path] of Object.entries(paths)) urls[id] = path ? signed.get(path) ?? null : null;
        const shown = Object.keys(urls).filter((id) => urls[id]);
        if (shown.length) await act("capture.view", { profile_id: p.id, record_table: "captures", detail: { ids: shown, kind } });
        return { urls, expires_in: seconds };
      }

      case "evolution": {
        const p = mine();
        const r = await loadRecord(deps, p.id);
        return {
          ...clientRecord(r),
          measurements: r.measurements.map(measurementForClient).filter(Boolean),
          validation: r.validation.map((v: any) => ({ name: v.name, region: v.region, device_kind: v.device_kind, status: v.status, repeatability_coefficient: v.status === "validated" ? v.repeatability_coefficient : null })),
          changes: r.changes.filter((c: any) => c.shared_with_client && c.review_status === "confirmed")
            .map((c: any) => ({ id: c.id, name: c.name, region: c.region, verdict: c.verdict, from_capture_id: c.from_capture_id, to_capture_id: c.to_capture_id, created_at: c.created_at, text: changeMessage(c.name, c.region, c, "client") })),
        };
      }

      case "capture_begin": {
        const p = mine();
        await limit(deps, `skin:capture:${person.id}`, 30, 0.5);
        const sessionId = await clientSessionToday(deps, p.id);
        const out = await beginCapture(deps, { profile: p, sessionId, input: { ...b, source: b.source === "camera" ? "camera" : "upload" }, actor: { id: person.id, role: "client" } });
        await act("capture.begin", { profile_id: p.id, record_table: "captures", record_id: out.capture.id, detail: { region: out.capture.region } });
        return { session_id: sessionId, capture_id: out.capture.id, upload: out.upload };
      }

      case "capture_commit": {
        const p = mine();
        if (!isUuid(b.capture_id)) throw new HttpError(400, "invalid");
        const cap = must(await db.from("captures").select("id, profile_id, original_path, status, captured_by").eq("id", b.capture_id).maybeSingle());
        if (!cap || cap.profile_id !== p.id || cap.captured_by !== person.id) throw new HttpError(404, "no_capture");
        const out = await commitCapture(deps, cap);
        await act("capture.commit", { profile_id: p.id, record_table: "captures", record_id: cap.id });
        return out;
      }

      case "routine": {
        const p = mine();
        const since = new Date(Date.parse(today(deps) + "T00:00:00Z") - 60 * 86400000).toISOString().slice(0, 10);
        const [entries, checkins, recovery] = await Promise.all([
          db.from("routine_entries").select("*").eq("profile_id", p.id).order("slot").order("position"),
          db.from("routine_checkins").select("*").eq("profile_id", p.id).gte("on_date", since).order("on_date", { ascending: false }),
          db.from("recovery_checkins").select("*").eq("profile_id", p.id).order("created_at", { ascending: false }).limit(30),
        ]).then((rs) => rs.map((x) => must(x)));
        return { entries, checkins, recovery, purchased: await purchasedProducts(deps, person.email, entries) };
      }

      case "routine_save": {
        const p = mine();
        await limit(deps, `skin:routine:${person.id}`, 60, 10);
        const clean = cleanRoutineEntry(b.entry);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        if (b.entry?.id) {
          if (!isUuid(b.entry.id)) throw new HttpError(400, "invalid");
          const row = must(await db.from("routine_entries").update({ ...clean.value, updated_at: nowIso(deps) }).eq("id", b.entry.id).eq("profile_id", p.id).select("*").maybeSingle());
          if (!row) throw new HttpError(404, "no_entry");
          return { entry: row };
        }
        const source = b.entry?.from_order ? "order" : "client";
        const row = must(await db.from("routine_entries").insert({ ...clean.value, profile_id: p.id, source, status: "active", started_on: clean.value.started_on ?? today(deps) }).select("*").single());
        await act("routine.add", { profile_id: p.id, record_table: "routine_entries", record_id: row.id });
        return { entry: row };
      }

      case "routine_stop": {
        const p = mine();
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const row = must(await db.from("routine_entries").update({ status: "stopped", stopped_on: today(deps), updated_at: nowIso(deps) }).eq("id", b.id).eq("profile_id", p.id).select("*").maybeSingle());
        if (!row) throw new HttpError(404, "no_entry");
        return { entry: row };
      }

      case "routine_accept": {
        const p = mine();
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const row = must(await db.from("routine_entries").update({ status: b.accept === false ? "stopped" : "active", started_on: today(deps), updated_at: nowIso(deps) })
          .eq("id", b.id).eq("profile_id", p.id).eq("status", "proposed").select("*").maybeSingle());
        if (!row) throw new HttpError(404, "no_entry");
        return { entry: row };
      }

      case "checkin": {
        const p = mine();
        await limit(deps, `skin:checkin:${person.id}`, 30, 5);
        const clean = cleanCheckin(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        const row = must(await db.from("routine_checkins").upsert({ ...clean.value, profile_id: p.id }, { onConflict: "profile_id,on_date" }).select("*").single());
        return { checkin: row };
      }

      case "recovery_checkin": {
        const p = mine();
        await limit(deps, `skin:recovery:${person.id}`, 20, 2);
        const clean = cleanRecoveryCheckin(b);
        if (!clean.ok) throw new HttpError(400, "invalid", { errors: clean.errors });
        if (clean.value.treatment_id) {
          const t = must(await db.from("treatment_records").select("id, profile_id").eq("id", clean.value.treatment_id).maybeSingle());
          if (!t || t.profile_id !== p.id) throw new HttpError(404, "no_treatment");
        }
        const row = must(await db.from("recovery_checkins").insert({ ...clean.value, profile_id: p.id }).select("*").single());
        await act("recovery.checkin", { profile_id: p.id, record_table: "recovery_checkins", record_id: row.id, detail: { flagged: row.flagged } });
        if (row.flagged && deps.notify) {
          await deps.notify(db, { kind: "skin", title: "A client asked you to look at their recovery", body: "Open Skin Intelligence → Needs you.", url: "studio-skin.html#needs" }).catch((e: unknown) => console.error("notify", e));
        }
        return { checkin: row };
      }

      case "reports": {
        const p = mine();
        const rows = must(await db.from("progress_reports").select("id, title, period_from, period_to, approved_at").eq("profile_id", p.id).eq("status", "approved").order("approved_at", { ascending: false }));
        return { reports: rows };
      }

      case "report": {
        const p = mine();
        if (!isUuid(b.id)) throw new HttpError(400, "invalid");
        const rep = must(await db.from("progress_reports").select("id, profile_id, title, period_from, period_to, content, approved_at, status").eq("id", b.id).maybeSingle());
        if (!rep || rep.profile_id !== p.id || rep.status !== "approved") throw new HttpError(404, "no_report");
        const ids = (rep.content?.images ?? []).map((i: any) => i.capture_id).filter(isUuid);
        const r = await loadRecord(deps, p.id);
        const paths = pathsFor(r, ids, "view", false);
        const seconds = await urlSeconds(deps);
        const signed = await signedUrls(deps, Object.values(paths).filter(Boolean) as string[], seconds);
        const urls = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, path ? signed.get(path) ?? null : null]));
        await act("report.view", { profile_id: p.id, record_table: "progress_reports", record_id: rep.id });
        const { profile_id: _p, ...out } = rep;
        return { report: out, urls, expires_in: seconds };
      }

      case "appointments": {
        const rows = must(await db.from("bookings").select("id, date, start_min, dur_min, services, status, completed_at")
          .eq("guest_email", person.email).order("date", { ascending: false }).limit(50));
        const day = today(deps);
        return {
          upcoming: rows.filter((r: any) => r.date >= day && ["pending", "held"].includes(r.status)).reverse(),
          history: rows.filter((r: any) => r.date < day || ["completed", "cancelled", "no_show"].includes(r.status)),
        };
      }

      case "orders": {
        const orders = must(await db.from("orders").select("id, ref, status, items, delivery, total_cents, paid_at, created_at")
          .eq("email", person.email).in("status", ["paid", "refunded"]).order("created_at", { ascending: false }).limit(50));
        const refs = orders.map((o: any) => o.id);
        const ships = refs.length ? must(await db.from("shipments").select("order_ref, status, carrier, tracking, shipped_at").eq("email", person.email)) : [];
        return { orders: orders.map((o: any) => ({ ...o, shipment: ships.find((s: any) => s.order_ref === o.id || s.order_ref === o.ref) ?? null })) };
      }

      case "export": {
        await limit(deps, `skin:export:${person.id}`, 3, 0.05);
        const p = profile;
        const { rows: consents } = await consentsFor(deps, person.email);
        const out: any = { exported_at: nowIso(deps), email: person.email, consents, profile: p ? publicProfile(p) : null };
        if (p) {
          const r = await loadRecord(deps, p.id);
          const rec = clientRecord(r);
          const [entries, checkins, recovery, reports] = await Promise.all([
            db.from("routine_entries").select("*").eq("profile_id", p.id),
            db.from("routine_checkins").select("*").eq("profile_id", p.id),
            db.from("recovery_checkins").select("*").eq("profile_id", p.id),
            db.from("progress_reports").select("id, title, period_from, period_to, content, approved_at").eq("profile_id", p.id).eq("status", "approved"),
          ]).then((rs) => rs.map((x) => must(x)));
          Object.assign(out, rec, { measurements: r.measurements.map(measurementForClient).filter(Boolean), routine: entries, checkins, recovery, reports,
            note: "Each photo can be downloaded from My Skin; ask Lumevina for the original files." });
        }
        await act("export", { profile_id: p?.id ?? null });
        return out;
      }

      case "delete_request": {
        await limit(deps, `skin:delete:${person.id}`, 3, 0.05);
        const note = String(b.note ?? "").trim().slice(0, 1000) || null;
        const open = must(await db.from("data_requests").select("id").eq("email", person.email).eq("kind", "delete").eq("status", "open").maybeSingle());
        if (open) return { request_id: open.id, status: "open" };
        const row = must(await db.from("data_requests").insert({ email: person.email, profile_id: profile?.id ?? null, kind: "delete", note }).select("id").single());
        if (profile) must(await db.from("skin_profiles").update({ status: "deletion_requested", updated_at: nowIso(deps) }).eq("id", profile.id));
        await act("delete.request", { profile_id: profile?.id ?? null, record_table: "data_requests", record_id: row.id });
        if (deps.notify) await deps.notify(db, { kind: "skin", title: "A client asked for their data to be deleted", body: "Open Skin Intelligence → Privacy.", url: "studio-skin.html#privacy" }).catch(() => {});
        return { request_id: row.id, status: "open" };
      }

      default:
        throw new HttpError(400, "unknown_action");
    }
  });
}

/** The parts of a profile a client sees of their own (all of it but who enrolled them). */
function publicProfile(p: any) {
  const { enrolled_by: _e, client_id: _c, ...rest } = p;
  return rest;
}

/** Sessions, captures (metadata), quality summaries and treatment summaries, as the client may see them. */
function clientRecord(r: any) {
  const q = new Map(r.quality.map((x: any) => [x.capture_id, x]));
  const kinds = (id: string) => [...new Set(r.derived.filter((d: any) => d.capture_id === id).map((d: any) => d.kind))];
  return {
    sessions: r.sessions.filter((s: any) => s.status !== "void").map(sessionForClient),
    captures: r.captures.filter((c: any) => c.status !== "pending_upload").map((c: any) => {
      const qc: any = q.get(c.id);
      return { id: c.id, session_id: c.session_id, region: c.region, site_id: c.site_id, source: c.source, captured_at: c.captured_at, status: c.status,
        calibration_status: c.calibration_status, captured_by_role: c.captured_by_role, derived: kinds(c.id),
        quality: qc ? { passed: qc.passed, comparable: qc.comparable, flags: qc.flags } : null,
        device_kind: (r.devices.find((d: any) => d.id === r.sessions.find((s: any) => s.id === c.session_id)?.device_id) ?? {}).kind ?? null };
    }),
    treatments: r.treatments.map(treatmentForClient).filter(Boolean),
  };
}

/** Products they bought (shop orders and at visits) that aren't in their routine yet: suggestions only. */
async function purchasedProducts(deps: Deps, email: string, entries: any[]) {
  const [orders, visits] = await Promise.all([
    deps.db.from("orders").select("items, paid_at").eq("email", email).eq("status", "paid").order("paid_at", { ascending: false }).limit(40),
    deps.db.from("bookings").select("checkout, completed_at").eq("guest_email", email).eq("status", "completed").order("completed_at", { ascending: false }).limit(40),
  ]).then((rs) => rs.map((x) => must(x)));
  const have = new Set(entries.filter((e: any) => e.status !== "stopped").map((e: any) => e.product_id).filter(Boolean));
  const seen = new Map<string, any>();
  for (const o of orders) for (const i of o.items ?? []) if (i?.id && !seen.has(i.id)) seen.set(i.id, { product_id: i.id, product_name: i.name, bought_at: o.paid_at, where: "shop" });
  for (const v of visits) for (const i of v.checkout?.products ?? []) if (i?.id && !seen.has(i.id)) seen.set(i.id, { product_id: i.id, product_name: i.name, bought_at: v.completed_at, where: "studio" });
  return [...seen.values()].filter((p) => !have.has(p.product_id) && p.product_id !== "svc-online-consult");
}
