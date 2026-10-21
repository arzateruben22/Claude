// Lumevina — Supabase Edge Function: studio
//
// What Evelyn's dashboard (Lumevina Studio, on her phone) asks the server
// for. Everything but "vapid" takes her studio key (x-studio-key).
//
// POST { action: "vapid" }                         → { key }  the public key her phone subscribes with
// POST { action: "push_subscribe", subscription, label? }     this phone gets notifications
// POST { action: "push_unsubscribe", endpoint }
// POST { action: "push_test" }                     → { sent }  a test notification to every phone
// POST { action: "alerts", limit? }                → { alerts }  the feed (orders, questions, low stock)
// POST { action: "orders", limit? }                → { orders }  paid orders, newest first
// POST { action: "shelf_set", id, stock?, price?, hidden? }   a recount, a new price, on/off the site
// POST { action: "sell", id, qty }                 → { stock }  an in-person sale takes stock off
// POST { action: "shelf_add", id, name, brand?, category?, price, stock? }   a product she brings in
// POST { action: "questions", limit? }             → { questions }  Client questions: every one waiting, and the
//                                                    last 30 days answered, each photo as an hour-long link
// POST { action: "answer", id, reply }             her reply, emailed to the client (reply-to: her), and the
//                                                    question marked answered; reply "" = handled another way
// v3, her clients and her hours:
// POST { action: "contacts", q? }                  → { contacts }  her client list (search by name, email, phone)
// POST { action: "contact_note", email, notes }    her private notes on a client
// POST { action: "import_clients", rows }          → { added, updated, skipped }  the GlossGenius client export
//                                                    (dashboard → Clients → Import parses the CSV)
// POST { action: "invite", dry? }                  → { count } or { sent }: "book with me on the website now",
//                                                    to imported clients who haven't booked here or been invited
// POST { action: "hours_get" } / { action: "hours_set", value }   her hours (site_settings → js/hours.js)
// POST { action: "extra_mondays_set", every: 0 | 1 | 2 }  extra Mondays (site_settings → js/extra-days.js)
// POST { action: "members" }                       → { members }  every membership with its facials and billing
// POST { action: "client_profile", email }         → { profile, updated_at, memories }  what a client told us, and the chat
// POST { action: "lessons" }                       → { lessons }  suggested and approved answers (Teach the chat)
// POST { action: "lesson_save", id, question?, answer?, status? }   edit, approve ("approved") or dismiss ("dismissed")
// POST { action: "lesson_add", question, answer }  one of her own, approved
// "answer" also suggests a general answer from her reply (teach: false to skip): ../_shared/learn.ts
//
// Deploy:  supabase functions deploy studio --no-verify-jwt
// Secrets: STUDIO_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, OWNER_EMAIL (+ RESEND_API_KEY for replies)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyOwner, pushAll } from "../_shared/notify.ts";
import { priorities } from "../_shared/priorities.ts";
import { studioOk } from "../_shared/studio.ts";
import { BUCKET } from "../_shared/photos.ts";
import { esc, page, sendEmail } from "../_shared/mail.ts";
import { EMAIL, norm, unsubscribeUrl } from "../_shared/contacts.ts";
import { cleanHours, cleanMondays } from "../_shared/hours.ts";
import { FIRST_BOOKING_BONUS } from "../_shared/points.ts";
import { PLANS } from "../_shared/membership.ts";
import { getProfile, memories } from "../_shared/profiles.ts";
import { suggestLesson } from "../_shared/learn.ts";
import { site } from "../_shared/bookings.ts";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "May 14", "05/14/1990", "1990-05-14" → 4 (May), or null */
const monthOf = (v: unknown) => {
  const t = String(v ?? "").trim().toLowerCase();
  const named = MONTHS.findIndex((m) => t.startsWith(m) || t.includes(" " + m));
  if (named !== -1) return named;
  const iso = /^\d{4}-(\d{1,2})-\d{1,2}/.exec(t), us = /^(\d{1,2})\/\d{1,2}/.exec(t);
  const n = Number(iso?.[1] ?? us?.[1]);
  return n >= 1 && n <= 12 ? n - 1 : null;
};
const dayOf = (v: unknown) => {
  const t = String(v ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
  if (us) return `${us[3].length === 2 ? "20" + us[3] : us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-studio-key",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  if (body.action === "vapid") return json({ key: Deno.env.get("VAPID_PUBLIC_KEY") ?? "" });
  if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 200);

  switch (body.action) {
    case "push_subscribe": {
      const sub = body.subscription;
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) return json({ reason: "subscription" }, 400);
      await db.from("studio_push").upsert({ endpoint: sub.endpoint, subscription: sub, label: String(body.label ?? "").slice(0, 60) || null });
      return json({ ok: true });
    }
    case "push_unsubscribe": {
      await db.from("studio_push").delete().eq("endpoint", String(body.endpoint ?? ""));
      return json({ ok: true });
    }
    case "push_test": {
      const sent = await pushAll(db, { title: "Lumevina Studio", body: "Notifications are on for this phone. ✨", url: "dashboard.html" });
      return json({ sent });
    }
    case "priorities": {                          // the Today card: what needs her, ranked (_shared/priorities.ts)
      return json({ items: await priorities(db) });
    }
    case "alerts": {
      const { data } = await db.from("studio_alerts").select("*").order("created_at", { ascending: false }).limit(limit);
      return json({ alerts: data ?? [] });
    }
    case "orders": {
      const { data } = await db.from("orders").select("*").eq("status", "paid").order("paid_at", { ascending: false }).limit(limit);
      return json({ orders: data ?? [] });
    }
    case "shelf_set": {
      const id = String(body.id ?? "");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.stock !== undefined) patch.stock = body.stock === null || body.stock === "" ? null : Math.max(0, Math.round(Number(body.stock)));
      if (body.price !== undefined) {
        const cents = Math.round(Number(body.price) * 100);
        if (!(cents >= 0 && cents < 1e6)) return json({ reason: "price" }, 400);
        patch.price_cents = cents;
      }
      if (body.hidden !== undefined) patch.hidden = !!body.hidden;
      const { data, error } = await db.from("products").update(patch).eq("id", id).select("id, stock, price_cents, hidden").maybeSingle();
      if (error || !data) return json({ reason: "not_found" }, 404);
      return json(data);
    }
    case "shelf_add": {
      const id = String(body.id ?? "").slice(0, 80), name = String(body.name ?? "").trim().slice(0, 120);
      const cents = Math.round(Number(body.price) * 100);
      if (!/^[a-z0-9-]+$/.test(id) || !name || !(cents >= 0)) return json({ reason: "product" }, 400);
      const { data, error } = await db.from("products").insert({
        id, name, brand: body.brand ? String(body.brand).slice(0, 60) : null, category: body.category ? String(body.category).slice(0, 60) : null,
        price_cents: cents, stock: body.stock == null || body.stock === "" ? null : Math.max(0, Math.round(Number(body.stock))),
      }).select("id, stock, price_cents, hidden").single();
      if (error) return json({ reason: error.code === "23505" ? "exists" : "failed" }, 400);
      return json(data);
    }
    case "sell": {
      const qty = Math.round(Number(body.qty) || 1);
      const { data, error } = await db.rpc("take_stock", { p_items: [{ id: String(body.id ?? ""), qty }] });
      if (error || !data?.length) return json({ reason: "not_found" }, 404);
      const row = data[0];
      if (row.low) await notifyOwner(db, { kind: "low_stock", title: `Low stock: ${row.name}`, body: row.stock === 0 ? "Sold out on the website now." : `${row.stock} left.`, url: "dashboard.html#inventory" });
      return json({ id: row.id, stock: row.stock });
    }
    case "questions": {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data } = await db.from("questions").select("*").or(`status.eq.waiting,answered_at.gte."${since}"`)
        .order("created_at", { ascending: false }).limit(limit);
      const rows = data ?? [];
      const paths = rows.flatMap((q: any) => q.photos ?? []);
      const links = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await db.storage.from(BUCKET).createSignedUrls(paths, 3600);
        for (const s of signed ?? []) if (s.signedUrl && s.path) links.set(s.path, s.signedUrl);
      }
      return json({ questions: rows.map((q: any) => ({ ...q, photo_urls: (q.photos ?? []).map((p: string) => links.get(p)).filter(Boolean) })) });
    }
    case "answer": {
      const reply = String(body.reply ?? "").trim().slice(0, 4000);
      const { data: q } = await db.from("questions").update({ status: "answered", reply: reply || null, answered_at: new Date().toISOString() })
        .eq("id", String(body.id ?? "")).eq("status", "waiting").select("*").maybeSingle();
      if (!q) return json({ reason: "not_found" }, 404);
      let emailed = false;
      if (reply) {
        const first = String(q.name ?? "").split(" ")[0];
        emailed = await sendEmail(q.email, "Evelyn replied to your question", page(first ? `Hi ${first},` : "Hi,",
          reply.split(/\n{2,}/).map((para) => `<p style="font-size:15px;line-height:1.55">${esc(para).replace(/\n/g, "<br>")}</p>`).join("") +
          `<p style="margin-top:20px;font-size:13px;color:#7D5A44">You asked: “${esc(q.text)}”<br>Reply to this email to write back to Evelyn.</p>`),
          Deno.env.get("OWNER_EMAIL") ?? undefined);
      }
      /* a general answer for the chat, from her reply, for her to approve */
      const lesson = reply && body.teach !== false ? await suggestLesson(db, q, reply) : null;
      return json({ ok: true, emailed, lesson });
    }
    case "contacts": {
      const q = String(body.q ?? "").trim().toLowerCase().replace(/[%,()]/g, "");
      let query = db.from("contacts").select("*").order("last_visit", { ascending: false, nullsFirst: false }).limit(Math.min(limit * 10, 500));
      if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data } = await query;
      return json({ contacts: (data ?? []).map((c: any) => ({ ...c, stripe_customer: undefined, payment_method: undefined })) });
    }
    case "contact_note": {
      const email = norm(body.email);
      if (!EMAIL.test(email)) return json({ reason: "email" }, 400);
      await db.from("contacts").update({ notes: String(body.notes ?? "").slice(0, 4000) || null }).eq("email", email);
      return json({ ok: true });
    }
    case "import_clients": {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
      let added = 0, updated = 0, skipped = 0;
      const now = new Date().toISOString();
      for (const r of rows) {
        const email = norm(r?.email);
        if (!EMAIL.test(email)) { skipped++; continue; }
        const row: Record<string, unknown> = {
          name: String(r.name ?? "").trim().slice(0, 120) || null, phone: String(r.phone ?? "").trim().slice(0, 40) || null,
          birthday: String(r.birthday ?? "").trim().slice(0, 40) || null, birth_month: monthOf(r.birthday),
          notes: String(r.notes ?? "").trim().slice(0, 2000) || null, last_visit: dayOf(r.last_visit),
          visits: Math.max(0, Math.round(Number(r.visits) || 0)), sms_ok: !!r.sms_ok, imported_at: now,
        };
        const { data: had } = await db.from("contacts").select("*").eq("email", email).maybeSingle();
        if (!had) {
          const { error } = await db.from("contacts").insert({ email, source: "glossgenius", ...row });
          if (error) skipped++; else added++;
          continue;
        }
        const patch: Record<string, unknown> = { imported_at: now };
        for (const k of ["name", "phone", "birthday", "birth_month", "notes"]) if (row[k] != null && had[k] == null) patch[k] = row[k];
        if (row.last_visit && (!had.last_visit || String(row.last_visit) > had.last_visit)) patch.last_visit = row.last_visit;
        if (Number(row.visits) > (had.visits ?? 0)) patch.visits = row.visits;
        await db.from("contacts").update(patch).eq("email", email);
        updated++;
      }
      return json({ added, updated, skipped });
    }
    case "invite": {
      const { data: list } = await db.from("contacts").select("email, name").eq("source", "glossgenius")
        .eq("email_ok", true).is("invited_at", null).is("first_booked_at", null).limit(body.dry ? 2000 : Math.min(Number(body.limit) || 50, 200));
      if (body.dry) return json({ count: (list ?? []).length });
      let sent = 0;
      for (const c of list ?? []) {
        const first = String(c.name ?? "").split(" ")[0];
        const ok = await sendEmail(c.email, "Book with Evelyn on her new website", page(`Hi${first ? " " + esc(first) : ""},`,
          `<p style="font-size:15px;line-height:1.55">I've moved my booking to my own website. It takes about a minute: pick your treatment, a day and a time, and your card stays on file for next time. Reminders come by email (and text, if you'd like), and you can move or cancel from the link in them.</p>` +
          `<p style="font-size:15px;line-height:1.55">Your first booking there comes with <strong>${FIRST_BOOKING_BONUS} Glow Points</strong> ($10 off a future visit), and every visit after earns more.</p>` +
          `<p style="margin:22px 0 8px"><a href="${esc(site())}/#book" style="background:#161412;color:#F5F1EA;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">Book my next visit</a></p>` +
          `<p style="font-size:14px;line-height:1.5">Already booked on GlossGenius? That appointment stands, nothing to do.</p>` +
          `<p style="font-size:15px">— Evelyn</p>` +
          `<p style="font-size:12px;color:#7D5A44;margin-top:24px"><a href="${esc(await unsubscribeUrl(c.email))}" style="color:#7D5A44">Stop these emails</a></p>`),
          Deno.env.get("OWNER_EMAIL") ?? undefined);
        if (ok) { sent++; await db.from("contacts").update({ invited_at: new Date().toISOString() }).eq("email", c.email); }
      }
      return json({ sent });
    }
    case "hours_get": {
      const { data } = await db.from("site_settings").select("value").eq("key", "hours").maybeSingle();
      return json({ value: data?.value ? cleanHours(data.value) : null });
    }
    case "hours_set": {
      const value = cleanHours(body.value);
      await db.from("site_settings").upsert({ key: "hours", value, updated_at: new Date().toISOString() });
      return json({ value });
    }
    case "extra_mondays_set": {
      const every = cleanMondays({ every: body.every });
      await db.from("site_settings").upsert({ key: "extra_mondays", value: { every }, updated_at: new Date().toISOString() });
      return json({ every });
    }
    case "client_profile": {
      const email = norm(body.email);
      if (!EMAIL.test(email)) return json({ reason: "email" }, 400);
      const p = await getProfile(db, email);
      const mem = await memories(db, email, 60);
      return json({ profile: p?.profile ?? null, updated_at: p?.updated_at ?? null,
        memories: mem.map((m) => ({ id: m.id, kind: m.kind, fact: m.fact, at: m.created_at })) });
    }
    case "lessons": {
      const { data } = await db.from("learned_answers").select("id, question, answer, kind, status, created_at, decided_at")
        .in("status", ["suggested", "approved"]).order("created_at", { ascending: false }).limit(200);
      return json({ lessons: data ?? [] });
    }
    case "lesson_save": {
      const id = String(body.id ?? "");
      const patch: Record<string, unknown> = {};
      if (typeof body.question === "string" && body.question.trim()) patch.question = body.question.trim().slice(0, 300);
      if (typeof body.answer === "string" && body.answer.trim()) patch.answer = body.answer.trim().slice(0, 1500);
      if (["approved", "dismissed", "suggested"].includes(body.status)) { patch.status = body.status; patch.decided_at = new Date().toISOString(); }
      if (!Object.keys(patch).length) return json({ reason: "nothing" }, 400);
      const { data } = await db.from("learned_answers").update(patch).eq("id", id).select("id, question, answer, kind, status, created_at, decided_at").maybeSingle();
      return data ? json({ lesson: data }) : json({ reason: "not_found" }, 404);
    }
    case "lesson_add": {
      const question = String(body.question ?? "").trim().slice(0, 300), answer = String(body.answer ?? "").trim().slice(0, 1500);
      if (!question || !answer) return json({ reason: "empty" }, 400);
      const { data } = await db.from("learned_answers").insert({ question, answer, kind: "evelyn", status: "approved", decided_at: new Date().toISOString() })
        .select("id, question, answer, kind, status, created_at, decided_at").single();
      return json({ lesson: data });
    }
    case "members": {
      const { data } = await db.from("memberships").select("*").order("created_at", { ascending: false }).limit(200);
      return json({ members: (data ?? []).map((m: any) => ({
        email: m.email, name: m.name, plan: PLANS[m.plan]?.name ?? m.plan, price_cents: m.price_cents, status: m.status, credits: m.credits,
        next_bill_at: m.next_bill_at, on_hold: m.on_hold, paused_bill_at: m.paused_bill_at, cancel_at: m.cancel_at, founding: m.founding,
        five_no: m.five_no, five_kit: m.five_kit, started_at: m.started_at, card: m.card_label,
      })) });
    }
    case "five_kit": {
      await db.from("memberships").update({ five_kit: "given" }).eq("email", norm(body.email)).not("five_no", "is", null);
      return json({ ok: true });
    }
    default:
      return json({ error: "unknown action" }, 400);
  }
});
