// Lumevina — Supabase Edge Function: stripe-webhook
//
// Stripe calls this when a deposit payment succeeds (or fails).
// On success the booking flips from 'pending' to 'held' and the Glow
// Rewards ledger is written server-side: redemption debit, earn credit
// with the same multipliers as js/rewards.js (double Wax Wednesday,
// +25 rebooking streak within 5 weeks, +50 birthday month once/year).
//
// Referral credit (150 ✦ to the referrer) is granted when the owner
// marks the referred client's first booking 'completed' after the
// visit — see grant_referral_credit at the bottom, called from a
// database trigger on that status change.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Then point a Stripe webhook (payment_intent.succeeded,
// payment_intent.payment_failed) at this function's URL.

import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  // Reject stale events (5-minute tolerance) to prevent replay.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time compare.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

const STREAK_DAYS = 35;
const STREAK_BONUS = 25;
const BIRTHDAY_BONUS = 50;

Deno.serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const ok = await verifyStripeSignature(
    payload, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
  );
  if (!ok) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(payload);
  const intent = event.data?.object;
  const bookingId = intent?.metadata?.booking_id;
  if (!bookingId) return new Response("ignored", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (event.type === "payment_intent.payment_failed") {
    await supabase.from("bookings")
      .update({ status: "cancelled" }).eq("id", bookingId).eq("status", "pending");
    return new Response("ok", { status: 200 });
  }

  if (event.type !== "payment_intent.succeeded") {
    return new Response("ignored", { status: 200 });
  }

  const { data: booking } = await supabase.from("bookings")
    .select().eq("id", bookingId).single();
  if (!booking || booking.status !== "pending") {
    return new Response("ok", { status: 200 }); // idempotent
  }

  await supabase.from("bookings").update({
    status: "held",
    paid_cents: intent.amount,
  }).eq("id", bookingId);

  // Fire the confirmation email/SMS and queue the 24h reminder.
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-confirmation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ booking_id: bookingId, kind: "confirmation" }),
  }).catch(() => {}); // never block the webhook on notifications

  // Claim the flash slot so it can't be reused.
  if (booking.flash) {
    await supabase.from("flash_slots")
      .update({ claimed_by: bookingId }).eq("date", booking.date);
  }

  // Rewards only accrue to signed-in clients (guests are invited to
  // create an account to claim them — points can be backfilled by email).
  if (!booking.client_id) return new Response("ok", { status: 200 });

  const { data: client } = await supabase.from("clients")
    .select().eq("id", booking.client_id).single();
  if (!client) return new Response("ok", { status: 200 });

  // Redemption debit first.
  if (booking.points_redeemed > 0) {
    await supabase.from("rewards_ledger").insert({
      client_id: client.id,
      delta: -booking.points_redeemed,
      label: "Redeemed on deposit",
      booking_id: bookingId,
    });
  }

  // Earn on the amount actually charged, with the site's multipliers.
  const base = Math.round(intent.amount / 100);
  const day = new Date(`${booking.date}T00:00:00`);
  const doubled = day.getDay() === 3 ||
    (booking.services as string[]).includes("wax-wednesday");
  const streak = !!client.last_visit &&
    (day.getTime() - new Date(client.last_visit).getTime()) <=
      STREAK_DAYS * 24 * 60 * 60 * 1000;
  const birthday = client.birth_month === day.getMonth() &&
    client.birthday_claimed_year !== day.getFullYear();

  const points = base * (doubled ? 2 : 1) +
    (streak ? STREAK_BONUS : 0) + (birthday ? BIRTHDAY_BONUS : 0);

  await supabase.from("rewards_ledger").insert({
    client_id: client.id,
    delta: points,
    label: `Deposit — ${(booking.services as string[]).join(" + ")}`,
    booking_id: bookingId,
  });

  await supabase.from("clients").update({
    last_visit: booking.date,
    ...(birthday ? { birthday_claimed_year: day.getFullYear() } : {}),
  }).eq("id", client.id);

  return new Response("ok", { status: 200 });
});

/* ── Referral credit (database side) ─────────────────────────────────
   Run once in the SQL editor; fires when a first booking completes:

   create or replace function grant_referral_credit() returns trigger
   language plpgsql security definer as $$
   declare referrer clients;
   begin
     if new.status = 'completed' and old.status <> 'completed'
        and new.client_id is not null then
       select c.* into referrer from clients c
         join clients ref on ref.referred_by = c.ref_code
         where ref.id = new.client_id and ref.referral_credited = false;
       if found then
         insert into rewards_ledger (client_id, delta, label, booking_id)
           values (referrer.id, 150, 'Referral — friend completed first visit', new.id);
         update clients set referral_credited = true where id = new.client_id;
       end if;
     end if;
     return new;
   end $$;

   create trigger referral_credit after update on bookings
     for each row execute function grant_referral_credit();
*/
