// YourBusiness — Supabase Edge Function: calendar-feed
//
// Serves the owner's appointments as a live iCalendar (.ics) feed the
// owner subscribes to once in Google or Apple Calendar — new bookings
// then appear automatically, no re-import. This is the reliable,
// low-maintenance path to "calendar sync" (vs. full two-way Google
// Calendar OAuth, which is a heavier future option).
//
// Deploy:  supabase functions deploy calendar-feed --no-verify-jwt
// Secrets: supabase secrets set CALENDAR_TOKEN=<long-random-string>
// Subscribe URL (keep private — it exposes the schedule):
//   webcal://<project>.functions.supabase.co/calendar-feed?t=<CALENDAR_TOKEN>
//
// The token in the query string is the only guard, so make it long and
// don't share the URL. Apple/Google refresh it periodically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { CATALOG } from "../_shared/catalog.ts";

const pad = (n: number) => (n < 10 ? "0" : "") + n;

function stamp(date: string, mins: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setMinutes(mins);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
    `${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("t") !== Deno.env.get("CALENDAR_TOKEN")) {
    return new Response("forbidden", { status: 403 });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // upcoming + recent held/completed bookings
  const since = new Date(); since.setDate(since.getDate() - 60);
  const { data: rows } = await sb.from("bookings")
    .select("id, date, start_min, dur_min, services, guest_name, client_id")
    .in("status", ["held", "completed"])
    .gte("date", since.toISOString().slice(0, 10));

  const lines: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//YourBusiness//Owner//EN",
    "X-WR-CALNAME:YourBusiness Appointments", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const b of rows ?? []) {
    const svc = (b.services as string[]).map((id) => CATALOG[id]?.name ?? id).join(" + ");
    const who = b.guest_name ? `${b.guest_name} — ` : "";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@lumevina`,
      `DTSTART:${stamp(b.date, b.start_min)}`,
      `DTEND:${stamp(b.date, b.start_min + b.dur_min)}`,
      `SUMMARY:${who}${svc}`,
      "LOCATION:Your Business",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
});
