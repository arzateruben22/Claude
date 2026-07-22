// Lumevina — Supabase Edge Function: send-confirmation
//
// Sends appointment confirmations and 24-hour reminders — the piece
// the static site can't do on its own (a browser can't send email or
// text). Two ways in:
//
//  1) Immediately after a deposit succeeds, the stripe-webhook calls
//     this with { booking_id, kind: "confirmation" }.
//  2) A scheduled run (Supabase cron, every ~15 min) calls it with
//     { due: true } to send any 'reminder' rows in `notifications`
//     whose send_after has passed and sent_at is null.
//
// Email goes through Resend; SMS (optional) through Twilio. Both are
// swappable — only sendEmail/sendSMS below touch the provider.
//
// Deploy:  supabase functions deploy send-confirmation
// Secrets: supabase secrets set RESEND_API_KEY=... FROM_EMAIL=hello@lumevina.com
//          (optional) TWILIO_SID=... TWILIO_TOKEN=... TWILIO_FROM=+1...

import { createClient } from "npm:@supabase/supabase-js@2";
import { CATALOG } from "../_shared/catalog.ts";

const admin = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function fmtWhen(date: string, startMin: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setMinutes(startMin);
  return d.toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function serviceNames(ids: string[]): string {
  return ids.map((id) => CATALOG[id]?.name ?? id).join(" + ");
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return; // not configured yet — no-op
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("FROM_EMAIL") ?? "Lumevina <hello@lumevina.com>",
      to, subject, html,
    }),
  });
}

async function sendSMS(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_SID");
  const token = Deno.env.get("TWILIO_TOKEN");
  const from = Deno.env.get("TWILIO_FROM");
  if (!sid || !token || !from || !to) return; // optional
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
}

async function messageFor(sb: ReturnType<typeof admin>, bookingId: string, kind: string) {
  const { data: b } = await sb.from("bookings").select().eq("id", bookingId).single();
  if (!b) return null;
  const to = b.guest_email ??
    (b.client_id
      ? (await sb.from("clients").select("email").eq("id", b.client_id).single()).data?.email
      : null);
  if (!to) return null;

  const when = fmtWhen(b.date, b.start_min);
  const svc = serviceNames(b.services as string[]);
  const isReminder = kind === "reminder";
  const subject = isReminder
    ? `Reminder: your Lumevina visit is tomorrow`
    : `You're booked at Lumevina 🌹`;
  const html =
    `<div style="font-family:Georgia,serif;color:#443640">` +
    `<h2 style="color:#7d5468">${isReminder ? "See you tomorrow" : "Appointment confirmed"}</h2>` +
    `<p>${svc}</p><p><strong>${when}</strong></p>` +
    `<p>Lumevina Aesthetics Spa · Woodland Hills, CA</p>` +
    `<p style="color:#8a7a83;font-size:13px">A 50% deposit is on file; the balance is due at your visit. ` +
    `Please complete your pre-visit form beforehand. To reschedule, reply or contact us.</p></div>`;
  return { to, subject, html, sms: `Lumevina: ${svc} — ${when}. Woodland Hills, CA.` };
}

Deno.serve(async (req) => {
  const sb = admin();
  const body = await req.json().catch(() => ({}));

  // ── Mode A: send one confirmation now (called from the webhook) ──
  if (body.booking_id) {
    const msg = await messageFor(sb, body.booking_id, body.kind ?? "confirmation");
    if (msg) {
      await sendEmail(msg.to, msg.subject, msg.html);
      await sendSMS(body.phone ?? "", msg.sms);
      // queue the 24h reminder
      const { data: b } = await sb.from("bookings")
        .select("date, start_min").eq("id", body.booking_id).single();
      if (b) {
        const when = new Date(`${b.date}T00:00:00`);
        when.setMinutes(b.start_min - 24 * 60);
        await sb.from("notifications").insert({
          booking_id: body.booking_id, kind: "reminder", channel: "email",
          send_after: when.toISOString(),
        });
      }
    }
    return new Response("ok", { status: 200 });
  }

  // ── Mode B: scheduled — flush all due reminders ──
  if (body.due) {
    const { data: due } = await sb.from("notifications")
      .select("id, booking_id, kind").is("sent_at", null)
      .lte("send_after", new Date().toISOString()).limit(100);
    for (const n of due ?? []) {
      const msg = await messageFor(sb, n.booking_id, n.kind);
      if (msg) await sendEmail(msg.to, msg.subject, msg.html);
      await sb.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", n.id);
    }
    return new Response(JSON.stringify({ sent: (due ?? []).length }), { status: 200 });
  }

  return new Response("noop", { status: 200 });
});
