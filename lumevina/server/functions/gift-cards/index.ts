// Lumevina — Supabase Edge Function: gift-cards
//
// The one way in to the gift certificate ledger (server/schema.sql →
// gift_cards, gift_redemptions, redeem_gift). js/giftcards.js calls it once
// the site is connected, so a certificate bought on one phone works on
// Evelyn's dashboard and anywhere else.
//
// POST { action: "check", code }
//   Anyone with the code: { code, kind, label, amount, balance, status }.
//   (The site's "Check a gift balance" and the dashboard's look-up.)
//
// POST { action: "redeem", code, bill_cents, note?, where? }   + x-studio-key
//   Evelyn, at the visit: spends the certificate against the bill.
//   A $100 certificate on a $50 visit covers $50 and keeps $50; on a $120
//   visit it covers its $100 and the client pays the $20 difference.
//   → { applied, pay, balance, status }   (dollars)
//
// POST { action: "list" }                                      + x-studio-key
//   Every certificate with its balance and uses, for the dashboard.
//
// POST { action: "issue", amount, recipient_name?, recipient_email?,
//        buyer_email?, message?, source? }                     + x-studio-key
//   A certificate sold in person (or by the shop's payment webhook, which
//   calls issueGift in ../_shared/gifts.ts directly). → { code, ... }
//
// Secrets:  supabase secrets set STUDIO_KEY=<a long random phrase only Evelyn's dashboard knows>
// Deploy:   supabase functions deploy gift-cards --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { issueGift, publicCard } from "../_shared/gifts.ts";

const CODE = /^LUM-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const REASONS = new Set(["not_found", "void", "empty", "nothing_due"]);

// the studio key, compared in constant time
const studioOk = (req: Request) => {
  const want = Deno.env.get("STUDIO_KEY") ?? "";
  const got = req.headers.get("x-studio-key") ?? "";
  if (want.length < 12 || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
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
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const code = String(body.code ?? "").trim().toUpperCase();

  switch (body.action) {
    case "check": {
      if (!CODE.test(code)) return json({ reason: "not_found" }, 404);
      const { data } = await db.from("gift_cards").select("*").eq("code", code).maybeSingle();
      if (!data) return json({ reason: "not_found" }, 404);
      return json(publicCard(data));
    }

    case "redeem": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      if (!CODE.test(code)) return json({ reason: "not_found" }, 404);
      const bill = Math.round(Number(body.bill_cents));
      if (!(bill > 0)) return json({ reason: "nothing_due" }, 400);
      const { data, error } = await db.rpc("redeem_gift", {
        p_code: code,
        p_bill_cents: bill,
        p_where: body.where === "online" ? "online" : "studio",
        p_note: body.note ? String(body.note).slice(0, 200) : null,
      });
      if (error) {
        const reason = REASONS.has(error.message) ? error.message : "failed";
        if (reason === "failed") console.error(error);
        return json({ reason }, reason === "not_found" ? 404 : 400);
      }
      const r = Array.isArray(data) ? data[0] : data;
      return json({
        code: r.code,
        applied: r.applied_cents / 100,
        pay: r.pay_cents / 100,
        balance: r.balance_cents / 100,
        status: r.status,
      });
    }

    case "list": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      const [{ data: cards }, { data: uses }] = await Promise.all([
        db.from("gift_cards").select("*").order("purchased_at", { ascending: false }),
        db.from("gift_redemptions").select("*").order("created_at"),
      ]);
      const byCode: Record<string, unknown[]> = {};
      for (const u of uses ?? []) {
        (byCode[u.code] ??= []).push({
          at: u.created_at, bill: u.bill_cents / 100, applied: u.applied_cents / 100,
          pay: u.pay_cents / 100, balanceAfter: u.balance_after_cents / 100, note: u.note ?? "", where: u.where_used,
        });
      }
      // deno-lint-ignore no-explicit-any
      return json({ cards: (cards ?? []).map((c: any) => ({ ...publicCard(c), ...privateFields(c), uses: byCode[c.code] ?? [] })) });
    }

    case "issue": {
      if (!studioOk(req)) return json({ reason: "studio_key" }, 401);
      const amount = Math.round(Number(body.amount));
      if (!(amount >= 1 && amount <= 5000)) return json({ reason: "amount" }, 400);
      const card = await issueGift(db, {
        amountCents: amount * 100,
        recipientName: body.recipient_name, recipientEmail: body.recipient_email,
        buyerEmail: body.buyer_email, message: body.message,
        source: body.source === "membership" ? "membership" : "studio",
      });
      return json({ ...publicCard(card), ...privateFields(card) });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
});

// what only the dashboard sees
// deno-lint-ignore no-explicit-any
function privateFields(c: any) {
  return {
    recipientName: c.recipient_name ?? "", recipientEmail: c.recipient_email ?? "",
    boughtBy: c.buyer_email ?? "", message: c.message ?? "", source: c.source,
    purchasedAt: c.purchased_at, lastUsedAt: c.last_used_at,
  };
}
