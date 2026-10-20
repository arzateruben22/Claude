// Lumevina — Supabase Edge Function: profile
//
// A signed-in client's skin profile and what the chat remembers about them
// (../_shared/profiles.ts). js/profile.js (My Lumevina) calls it with the
// client's own sign-in (Authorization: Bearer <their access token>); the
// email comes from that, never from the request.
//
// POST { action: "get" }                     → { profile, consent_at, updated_at, memories }
// POST { action: "save", profile, consent: true }  saves it (their yes is required)
// POST { action: "forget", id }              one thing the chat remembered
// POST { action: "forget_all" }              everything the chat remembered
// POST { action: "delete" }                  the profile and the memory, gone
//
// Deploy:  supabase functions deploy profile --no-verify-jwt

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { norm } from "../_shared/contacts.ts";
import { cleanProfile, getProfile, isEmpty, memories } from "../_shared/profiles.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const view = async () => {
    const p = await getProfile(db, email);
    const mem = await memories(db, email, 60);
    return {
      profile: p?.profile ?? null, consent_at: p?.consent_at ?? null, updated_at: p?.updated_at ?? null,
      memories: mem.map((m) => ({ id: m.id, kind: m.kind, fact: m.fact, source: m.source, at: m.created_at })),
    };
  };

  switch (body.action) {
    case "get":
      return json(await view());
    case "save": {
      if (body.consent !== true) return json({ reason: "consent" }, 400);
      const profile = cleanProfile(body.profile);
      if (isEmpty(profile)) return json({ reason: "empty" }, 400);
      const now = new Date().toISOString();
      const had = await getProfile(db, email);
      const { error } = await db.from("client_profiles").upsert({ email, profile, consent_at: had?.consent_at ?? now, updated_at: now });
      if (error) { console.error("profile", error); return json({ reason: "not_saved" }, 500); }
      return json(await view());
    }
    case "forget": {
      const id = String(body.id ?? "");
      if (!UUID.test(id)) return json({ reason: "id" }, 400);
      await db.from("client_memory").delete().eq("id", id).eq("email", email);
      return json(await view());
    }
    case "forget_all":
      await db.from("client_memory").delete().eq("email", email);
      return json(await view());
    case "delete":
      await db.from("client_memory").delete().eq("email", email);
      await db.from("client_profiles").delete().eq("email", email);
      return json(await view());
    default:
      return json({ error: "unknown action" }, 400);
  }
});
