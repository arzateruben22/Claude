// YourBusiness — Supabase Edge Function: create-deposit-intent
//
// The server half of the STRIPE INTEGRATION POINT documented in
// js/payments.js. The client POSTs a draft booking; this function
// re-computes the price server-side (never trust the browser's math),
// inserts the booking as 'pending' (the exclusion constraint rejects
// double-books atomically), creates a Stripe PaymentIntent for the
// 50% deposit, and returns its client_secret for confirmation with
// Apple Pay / card via Stripe's SDK.
//
// Deploy:  supabase functions deploy create-deposit-intent
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//
// Request body:
// {
//   date: "2026-08-04", start_min: 600, services: ["brazilian-wax"],
//   client_id?: uuid, guest_name?: string, guest_email?: string,
//   points_redeemed?: number, flash?: boolean
// }

import { createClient } from "npm:@supabase/supabase-js@2";

// Single source of truth for prices/durations on the server.
// Generated from the site's catalog — keep in sync with index.html.
import { CATALOG } from "../_shared/catalog.ts";

const FLASH_OFF = 0.10;
const POINT_VALUE_CENTS = 10; // 100 points = $10.00

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json();
  const services: string[] = body.services ?? [];
  if (!services.length) {
    return new Response(JSON.stringify({ error: "no services" }), { status: 400 });
  }

  // Recompute totals from the server-side catalog.
  let totalCents = 0;
  let durMin = 0;
  for (const id of services) {
    const s = CATALOG[id];
    if (!s) {
      return new Response(JSON.stringify({ error: `unknown service ${id}` }), { status: 400 });
    }
    totalCents += s.price_cents;
    durMin += s.dur_min;
  }

  // Flash discount only if this day's flash slot matches the request.
  let flash = false;
  if (body.flash) {
    const { data: fs } = await supabase.from("flash_slots")
      .select("start_min, claimed_by").eq("date", body.date).maybeSingle();
    flash = !!fs && fs.start_min === body.start_min && !fs.claimed_by;
    if (flash) totalCents = Math.round(totalCents * (1 - FLASH_OFF));
  }

  const depositCents = Math.round(totalCents / 2);

  // Points may cover up to half the deposit — verified against the ledger.
  let redeemed = Math.max(0, Math.floor(body.points_redeemed ?? 0));
  if (redeemed > 0 && body.client_id) {
    const { data: bal } = await supabase.from("reward_balances")
      .select("points").eq("client_id", body.client_id).maybeSingle();
    const maxByBalance = Math.floor((bal?.points ?? 0) / 100) * 100;
    const maxByDeposit = Math.floor(depositCents / 2 / POINT_VALUE_CENTS / 100) * 100;
    redeemed = Math.min(redeemed, maxByBalance, maxByDeposit);
  } else {
    redeemed = 0;
  }
  const chargeCents = depositCents - redeemed * POINT_VALUE_CENTS;

  // Insert as pending — the no_overlap constraint is the availability check.
  const { data: booking, error } = await supabase.from("bookings").insert({
    client_id: body.client_id ?? null,
    guest_name: body.guest_name ?? null,
    guest_email: body.guest_email ?? null,
    date: body.date,
    start_min: body.start_min,
    dur_min: durMin,
    services,
    total_cents: totalCents,
    deposit_cents: depositCents,
    points_redeemed: redeemed,
    flash,
    source: body.source === "app" || body.source === "admin" ? body.source : "web",
  }).select().single();

  if (error) {
    const taken = error.message.includes("no_overlap");
    return new Response(
      JSON.stringify({ error: taken ? "slot_taken" : error.message }),
      { status: taken ? 409 : 500 },
    );
  }

  // Create the PaymentIntent (Stripe REST API — no SDK needed in Deno).
  const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: String(chargeCents),
      currency: "usd",
      "automatic_payment_methods[enabled]": "true", // enables Apple Pay
      description: `50% deposit — ${services.join(" + ")} (${body.date})`,
      "metadata[booking_id]": booking.id,
    }),
  });

  if (!stripeRes.ok) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    return new Response(JSON.stringify({ error: "stripe_error" }), { status: 502 });
  }

  const intent = await stripeRes.json();
  await supabase.from("bookings")
    .update({ stripe_payment_intent: intent.id })
    .eq("id", booking.id);

  return new Response(JSON.stringify({
    booking_id: booking.id,
    client_secret: intent.client_secret,
    charge_cents: chargeCents,
    deposit_cents: depositCents,
    total_cents: totalCents,
  }), { headers: { "Content-Type": "application/json" } });
});
