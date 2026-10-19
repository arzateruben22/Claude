// Lumevina — Supabase Edge Function: client-plans
//
// The skin plan Evelyn writes for each client (dashboard → Clients → Skin
// plan), stored in client_plans (server/schema.sql) and shared by
// js/skin-plans.js. The client reads theirs in My Lumevina; Ask Lumevina
// answers their routine questions from it (functions/ask).
//
// POST { action: "mine" }                       with the client's Supabase session
//   → { plan, updatedAt } or { plan: null }
//
// POST { action: "list" }                                     + x-studio-key
//   → { plans: [{ email, name, plan, updatedAt }] }
//
// POST { action: "save", email, name?, plan }                 + x-studio-key
//   Writes the whole plan (see ../_shared/plans.ts for its shape).
//   → { email, plan, updatedAt }
//
// POST { action: "remove", email }                            + x-studio-key
//
// Deploy:  supabase functions deploy client-plans --no-verify-jwt
// Secrets: STUDIO_KEY (the same one the gift certificates use)

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { cleanPlan } from "../_shared/plans.ts";
import { studioOk } from "../_shared/studio.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const email = String(body.email ?? "").trim().toLowerCase();

  switch (body.action) {
    case "mine": {
      const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
      if (!jwt || jwt === Deno.env.get("SUPABASE_ANON_KEY")) return json({ reason: "signed_out" }, 401);
      const { data: u } = await db.auth.getUser(jwt);
      if (!u.user?.email) return json({ reason: "signed_out" }, 401);
      const { data } = await db.from("client_plans").select("plan, updated_at").eq("email", u.user.email.toLowerCase()).maybeSingle();
      return json(data ? { plan: cleanPlan(data.plan), updatedAt: data.updated_at } : { plan: null });
    }

    case "list": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      const { data } = await db.from("client_plans").select("*").order("updated_at", { ascending: false });
      return json({ plans: (data ?? []).map((r: any) => ({ email: r.email, name: r.name ?? "", plan: cleanPlan(r.plan), updatedAt: r.updated_at })) });
    }

    case "save": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      if (!EMAIL.test(email)) return json({ reason: "email" }, 400);
      const plan = cleanPlan(body.plan);
      const { data: c } = await db.from("clients").select("id").eq("email", email).maybeSingle();
      const row = { email, client_id: c?.id ?? null, name: body.name ? String(body.name).slice(0, 120) : null, plan, updated_at: new Date().toISOString() };
      const { error } = await db.from("client_plans").upsert(row);
      if (error) { console.error(error); return json({ reason: "failed" }, 500); }
      return json({ email, plan, updatedAt: row.updated_at });
    }

    case "remove": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      await db.from("client_plans").delete().eq("email", email);
      return json({ email, removed: true });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
});
