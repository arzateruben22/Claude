// Lumevina — Supabase Edge Function: availability
//
// What the website's calendar asks before it shows a time: every stretch
// of each day that's already taken, from both calendars at once —
//   • bookings made on the website (the bookings table), and
//   • her Google Calendar, which carries every GlossGenius appointment and
//     anything personal she blocks (../_shared/google.ts).
// Times only, never names, so it's public like day_availability().
//
// Request:  GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   (up to 45 days)
// Response: { busy: { "2026-10-21": [[720, 780], …] }, google: true|false }
//           minutes after midnight, studio time (Los Angeles)
//
// Deploy:  supabase functions deploy availability --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { busyBetween, googleOn, type Busy } from "../_shared/google.ts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "", to = url.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || Date.parse(to) - Date.parse(from) > 45 * 864e5) {
    return json({ error: "from and to are dates, at most 45 days apart" }, 400);
  }

  const busy: Busy = {};
  const add = (day: string, a: number, z: number) => (busy[day] ??= []).push([a, z]);

  // 1) website bookings
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await db.from("bookings").select("date, start_min, dur_min")
    .gte("date", from).lte("date", to).in("status", ["pending", "held", "completed"]);
  for (const r of rows ?? []) add(r.date, r.start_min, r.start_min + r.dur_min);

  // 2) her Google Calendar: GlossGenius appointments and personal blocks
  let google = googleOn();
  if (google) {
    try {
      const g = await busyBetween(from, to);
      for (const [day, list] of Object.entries(g)) for (const [a, z] of list) add(day, a, z);
    } catch (err) {
      // Google unreachable: say so, and the website still won't double-book its
      // own times; create-deposit-intent checks Google again before charging
      console.error(String(err));
      google = false;
    }
  }
  for (const day of Object.keys(busy)) busy[day].sort((a, b) => a[0] - b[0]);
  return json({ busy, google }, 200, { "Cache-Control": "public, max-age=30" });
});
