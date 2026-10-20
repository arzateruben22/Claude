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
//
// Deploy:  supabase functions deploy studio --no-verify-jwt
// Secrets: STUDIO_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, OWNER_EMAIL

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { notifyOwner, pushAll } from "../_shared/notify.ts";
import { studioOk } from "../_shared/studio.ts";

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
    default:
      return json({ error: "unknown action" }, 400);
  }
});
