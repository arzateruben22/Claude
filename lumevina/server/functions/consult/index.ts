// Lumevina — Supabase Edge Function: consult
//
// The gate on the actives, from the website's side (js/consult.js).
//
// POST { action: "request", email, name?, note?, products: [ids], answers? }
//      → { ok, id, products }   a client asks Evelyn to unlock an active; she
//        gets a notification, they get a "got it" email
// POST { action: "status", email }
//      → { approved: "all" | [ids], waiting: [ids], done: bool }
//        what this email may buy without asking (the website turns "Needs a
//        quick consult" back into "Add to cart" for those)
//
// A signed-in client's token wins over the email in the body.
// Deploy:  supabase functions deploy consult --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { approvedFor, norm, requestConsult } from "../_shared/consults.ts";
import { EMAIL } from "../_shared/contacts.ts";

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // the signed-in client's email, when there is one
  let email = norm(body.email);
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt).catch(() => ({ data: { user: null } }));
    if (data?.user?.email) email = norm(data.user.email);
  }
  if (!EMAIL.test(email)) return json({ reason: "email" }, 400);

  if (body.action === "request") {
    const ids = Array.isArray(body.products) ? body.products.map(String) : [];
    const { data: rows } = ids.length ? await db.from("products").select("id, name, brand, consult").in("id", ids) : { data: [] };
    const names = new Map<string, string>((rows ?? []).map((p: any) => [p.id, `${p.brand ? p.brand + " " : ""}${p.name}`]));
    const wanted = (rows ?? []).filter((p: any) => p.consult).map((p: any) => p.id);
    if (ids.length && !wanted.length) return json({ reason: "no_consult_needed" }, 400);
    try {
      const r = await requestConsult(db, { ...body, email, products: wanted }, names);
      return json({ ok: true, ...r });
    } catch (e) { console.error(e); return json({ reason: "failed" }, 500); }
  }
  if (body.action === "status") {
    const a = await approvedFor(db, email);
    const { data: waiting } = await db.from("consults").select("products, kind").eq("email", email).in("status", ["waiting", "paid"]);
    const w = new Set<string>();
    for (const r of waiting ?? []) for (const id of r.products ?? []) w.add(id);
    return json({ approved: a.all ? "all" : [...a.ids], waiting: [...w], done: a.all, booked: (waiting ?? []).some((r: any) => r.kind === "online") });
  }
  return json({ reason: "action" }, 400);
});
