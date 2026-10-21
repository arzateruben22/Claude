// Lumevina — Supabase Edge Function: client-reminders (v3)
//
// What goes out to clients without anyone pressing a button. Run every
// hour by Supabase cron with the studio key (server/README.md → v3). Each
// message goes once (sent_messages), and the ones that aren't about an
// appointment skip anyone who unsubscribed (contacts.email_ok).
//
//   reminder       email, 3 days before: the details, the pre-visit form if
//                  it's missing, prep notes, and the link to move or cancel
//                  while that's still free (48 hours ahead)
//   text_reminder  a text the day before, to clients who said yes to texts
//   review         the day after a visit: a short thank-you and Evelyn's
//                  Google review link (REVIEW_URL), at most once in 90 days
//   rebook         4 weeks after a visit, with nothing booked since: "time
//                  for your next facial" (members are skipped: theirs is monthly)
//   restock        about two months after a shop order: "running low?"
//                  with a link that puts the same products back in the bag
//   owner_nudge    to Evelyn, not a client: "Still waiting: Maya" once a
//                  question passes its promised reply time, once per question
//
// POST {} + x-studio-key → { reminder, text_reminder, review, rebook, restock }
// Deploy:  supabase functions deploy client-reminders --no-verify-jwt
// Secrets: REVIEW_URL (her Google review link; without it, no review emails)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { studioOk } from "../_shared/studio.ts";
import { pushAll } from "../_shared/notify.ts";
import { esc, page, sendEmail } from "../_shared/mail.ts";
import { sendSMS } from "../_shared/sms.ts";
import { norm, unsubscribeUrl } from "../_shared/contacts.ts";
import { fmtWhen, hoursUntil, manageUrl, names, sendBookingMessage, site } from "../_shared/bookings.ts";
import { memberFor } from "../_shared/membership.ts";

const REBOOK_DAYS = 28;
const RESTOCK_DAYS = 56;
const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);
const btn = (href: string, label: string) =>
  `<p style="margin:22px 0 8px"><a href="${esc(href)}" style="background:#161412;color:#F5F1EA;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

Deno.serve(async (req) => {
  if (!studioOk(req)) return new Response(JSON.stringify({ reason: "studio_key" }), { status: 401 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const sent: Record<string, number> = { reminder: 0, text_reminder: 0, review: 0, rebook: 0, restock: 0, owner_nudge: 0 };

  /** claims a message (kind + ref) before sending it; false when it already went */
  const claim = async (kind: string, ref: string, email: string) => {
    const { error } = await db.from("sent_messages").insert({ kind, ref, email });
    return !error;
  };
  const optedIn = async (email: string) => {
    const { data } = await db.from("contacts").select("email_ok").eq("email", norm(email)).maybeSingle();
    return data?.email_ok !== false;
  };
  const footer = async (email: string) =>
    `<p style="font-size:12px;color:#7D5A44;margin-top:24px"><a href="${esc(await unsubscribeUrl(email))}" style="color:#7D5A44">Stop these emails</a></p>`;

  // ── appointment reminders ──
  const { data: soon } = await db.from("bookings").select("*").eq("status", "held").gte("date", day(-1)).lte("date", day(4));
  for (const b of soon ?? []) {
    const h = hoursUntil(b.date, b.start_min);
    if (h > 2 && h <= 72 && await claim("reminder", b.id, b.guest_email)) {
      if (await sendBookingMessage(db, b, "reminder")) sent.reminder++;
    }
    if (b.sms_ok && b.phone && h > 2 && h <= 26 && await claim("text_reminder", b.id, b.guest_email)) {
      if (await sendSMS(b.phone, `Lumevina: see you ${fmtWhen(b.date, b.start_min).replace(/^\w+, /, "")} for ${names(b.services)}. Wait in your car and text when you arrive. Need to change it? ${manageUrl(b)}`)) sent.text_reminder++;
    }
  }

  // ── review requests, the day after ──
  const review = Deno.env.get("REVIEW_URL");
  if (review) {
    const { data: done } = await db.from("bookings").select("id, guest_email, guest_name, completed_at")
      .eq("status", "completed").gte("completed_at", new Date(Date.now() - 7 * 864e5).toISOString()).lte("completed_at", new Date(Date.now() - 20 * 36e5).toISOString());
    for (const b of done ?? []) {
      const email = norm(b.guest_email);
      if (!(await optedIn(email))) continue;
      const { count } = await db.from("sent_messages").select("id", { count: "exact", head: true }).eq("kind", "review").eq("email", email)
        .gte("sent_at", new Date(Date.now() - 90 * 864e5).toISOString());
      if (count || !(await claim("review", b.id, email))) continue;
      const first = String(b.guest_name ?? "").split(" ")[0];
      if (await sendEmail(email, "How was your visit?", page(`Thank you${first ? ", " + esc(first) : ""}.`,
        `<p style="font-size:15px;line-height:1.55">It was lovely to see you. If you have a minute, a few words on Google help other people find the studio, and they mean a lot to me.</p>` +
        btn(review, "Leave a review") + `<p style="font-size:15px">— Evelyn</p>` + await footer(email)), Deno.env.get("OWNER_EMAIL") ?? undefined)) sent.review++;
    }
  }

  // ── time for the next facial ──
  const { data: due } = await db.from("contacts").select("email, name, last_visit, email_ok").eq("email_ok", true)
    .gte("last_visit", day(-REBOOK_DAYS - 3)).lte("last_visit", day(-REBOOK_DAYS));
  for (const c of due ?? []) {
    const { count: ahead } = await db.from("bookings").select("id", { count: "exact", head: true }).eq("guest_email", c.email).in("status", ["held", "pending"]).gte("date", day(0));
    if (ahead) continue;
    const m = await memberFor(db, c.email);
    if (m && m.status !== "cancelled") continue;
    if (!(await claim("rebook", `${c.email}:${c.last_visit}`, c.email))) continue;
    const first = String(c.name ?? "").split(" ")[0];
    if (await sendEmail(c.email, "Time for your next facial?", page(`Hi${first ? " " + esc(first) : ""},`,
      `<p style="font-size:15px;line-height:1.55">It's been about four weeks since your last visit, which is when skin starts asking for the next one. Book within the next week and you earn 25 extra Glow Points for keeping the rhythm.</p>` +
      btn(`${site()}/#book`, "See open times") + `<p style="font-size:15px">— Evelyn</p>` + await footer(c.email)), Deno.env.get("OWNER_EMAIL") ?? undefined)) sent.rebook++;
  }

  // ── running low? ──
  const { data: orders } = await db.from("orders").select("id, email, name, items, paid_at").eq("status", "paid")
    .gte("paid_at", new Date(Date.now() - (RESTOCK_DAYS + 7) * 864e5).toISOString()).lte("paid_at", new Date(Date.now() - RESTOCK_DAYS * 864e5).toISOString());
  for (const o of orders ?? []) {
    const items = (o.items ?? []) as { id: string; name: string; qty: number }[];
    if (!items.length || !(await optedIn(o.email)) || !(await claim("restock", o.id, o.email))) continue;
    const first = String(o.name ?? "").split(" ")[0];
    const link = `${site()}/?reorder=${encodeURIComponent(items.map((i) => i.id).join(","))}#shop`;
    if (await sendEmail(o.email, "Running low?", page(`Hi${first ? " " + esc(first) : ""},`,
      `<p style="font-size:15px;line-height:1.55">It's been about two months since your order, so you may be close to the bottom of:</p>` +
      `<ul style="font-size:15px;line-height:1.6">${items.map((i) => `<li>${esc(i.name)}</li>`).join("")}</ul>` +
      btn(link, "Put them back in my bag") + `<p style="font-size:14px;line-height:1.5">Shipping is free over $75, or pick up free at your next visit.</p>` + await footer(o.email)))) sent.restock++;
  }

  // ── Evelyn: a client question past its promised reply time (24 h members, 48 h others), nudged once ──
  const { data: overdue } = await db.from("questions").select("id, name, member").eq("status", "waiting").is("owner_nudged_at", null).lte("due_at", new Date().toISOString());
  for (const q of overdue ?? []) {
    await pushAll(db, { title: `Still waiting: ${q.name}`, body: q.member ? "A member was promised a reply within 24 hours. A reply is drafted for you." : "They were promised a reply within 2 days. A reply is drafted for you.",
      url: "dashboard.html#client-questions", tag: "question-overdue" }).catch((e: unknown) => console.error("push", e));
    await db.from("questions").update({ owner_nudged_at: new Date().toISOString() }).eq("id", q.id);
    sent.owner_nudge++;
  }

  return new Response(JSON.stringify(sent), { headers: { "Content-Type": "application/json" } });
});
