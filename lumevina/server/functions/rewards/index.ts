// Lumevina — Supabase Edge Function: rewards (v3)
//
// A signed-in client's Glow Points (the rewards_ledger, keyed by email, so
// points earned as a guest are already there when they sign in). Points
// are written where the money is: confirmBooking (the deposit and the
// first-booking 100), the visit's checkout (studio-book), shop orders
// (_shared/orders.ts). js/rewards.js shows what this returns.
//
// POST { action: "status" }        → { points, history, ref_code, share_link, birth_month, first_booked }
// POST { action: "birthday", month } (0–11) once a year's bonus: 50 points on a booking that month
//
// Deploy: supabase functions deploy rewards --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { getContact, norm, refCodeFor, upsertContact } from "../_shared/contacts.ts";
import { balance } from "../_shared/points.ts";
import { site } from "../_shared/bookings.ts";

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) return json({ reason: "sign_in" }, 401);
  const { data } = await db.auth.getUser(jwt);
  const email = data.user?.email ? norm(data.user.email) : "";
  if (!email) return json({ reason: "sign_in" }, 401);

  if (body.action === "birthday") {
    const month = Number(body.month);
    if (!(Number.isInteger(month) && month >= 0 && month <= 11)) return json({ reason: "month" }, 400);
    await upsertContact(db, { email, name: String(data.user?.user_metadata?.name ?? "") || undefined });
    await db.from("contacts").update({ birth_month: month }).eq("email", email);
    return json({ ok: true, birth_month: month });
  }

  if (body.action === "status") {
    const code = await refCodeFor(db, email);
    const c = await getContact(db, email);
    const { data: rows } = await db.from("rewards_ledger").select("delta, label, created_at").eq("email", email)
      .order("created_at", { ascending: false }).limit(20);
    return json({
      points: await balance(db, email),
      history: (rows ?? []).map((r: any) => ({ ts: Date.parse(r.created_at), label: r.label, delta: r.delta })),
      ref_code: code, share_link: code ? `${site()}/?ref=${code}` : "",
      birth_month: c?.birth_month ?? null, first_booked: !!c?.first_booked_at,
    });
  }
  return json({ error: "unknown action" }, 400);
});
