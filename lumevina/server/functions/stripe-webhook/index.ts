// Lumevina — Supabase Edge Function: stripe-webhook
//
// Stripe tells the site what happened on its pages. Every page the site
// opens is a Checkout Session whose metadata says what it was for:
//
//   booking     (functions/book) the deposit is paid or the card saved:
//               the booking is confirmed (../_shared/bookings.ts →
//               confirmBooking). An abandoned page frees the time.
//   card        (studio-book → card_link) a client Evelyn booked added
//               their card: it goes on the booking and their contact.
//   visit       (studio-book → checkout by pay link) the client paid the
//               visit on their phone: it's checked out (../_shared/visits.ts).
//   membership  (functions/membership → join) the subscription started: the
//               membership is made (../_shared/membership.ts).
//   (none)      a shop order (functions/create-checkout, ../_shared/orders.ts).
//
// And for memberships: invoice.paid adds the month's facial (two waiting
// holds billing); customer.subscription.updated / .deleted mirror a
// cancellation, its date, or a new billing card.
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// Then point a Stripe webhook at this function's URL with the events
// checkout.session.completed, checkout.session.async_payment_succeeded,
// checkout.session.async_payment_failed, checkout.session.expired,
// invoice.paid, customer.subscription.updated and customer.subscription.deleted.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { cancelOrder, fulfillOrder } from "../_shared/orders.ts";
import { confirmBooking } from "../_shared/bookings.ts";
import { completeVisit } from "../_shared/visits.ts";
import { creditInvoice, ensureMembership, syncSubscription, PLANS } from "../_shared/membership.ts";
import { notifyOwner } from "../_shared/notify.ts";
import { cardLabel, stripe } from "../_shared/stripe.ts";

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

/** The card a finished Checkout Session left on file, and what it charged. */
async function cardFrom(s: any) {
  const customer = typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;
  let pm: string | null = null, pi: string | null = null;
  if (s.mode === "payment") {
    pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
    if (pi) pm = (await stripe(`payment_intents/${pi}`)).data?.payment_method ?? null;
  } else if (s.mode === "setup") {
    const si = typeof s.setup_intent === "string" ? s.setup_intent : s.setup_intent?.id ?? null;
    if (si) pm = (await stripe(`setup_intents/${si}`)).data?.payment_method ?? null;
  }
  return { customer, payment_method: pm, card_label: (await cardLabel(pm)) || null, payment_intent: pi, paid_cents: s.mode === "payment" ? Number(s.amount_total ?? 0) : 0 };
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const ok = await verifyStripeSignature(
    payload, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
  );
  if (!ok) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(payload);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const o = event.data?.object ?? {};
  const done = (msg = "ok") => new Response(msg, { status: 200 });

  // ── memberships: billing ──
  if (event.type === "invoice.paid") {
    const m = await creditInvoice(db, o);
    return done(m ? "credited" : "ignored");
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await syncSubscription(db, o, event.type === "customer.subscription.deleted");
    return done();
  }
  if (!String(event.type).startsWith("checkout.session.")) return done("ignored");

  const kind = o.metadata?.kind ?? "";
  const finished = (event.type === "checkout.session.completed" && (o.payment_status === "paid" || o.payment_status === "no_payment_required" || o.mode === "setup")) ||
    event.type === "checkout.session.async_payment_succeeded";
  const failed = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed";

  // ── a booking's deposit or card ──
  if (kind === "booking") {
    const id = o.metadata?.booking_id;
    if (!id) return done("ignored");
    if (failed) {
      await db.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
      return done();
    }
    if (!finished) return done("ignored");
    const card = await cardFrom(o);
    const r = await confirmBooking(db, id, card);
    if (!r.ok && card.paid_cents > 0 && card.payment_intent) {
      // paid after the time was given up (they left Stripe's page open past its half hour): refund it
      const { data: b } = await db.from("bookings").select("status, stripe_payment_intent").eq("id", id).maybeSingle();
      if (b?.status === "cancelled") {
        await stripe("refunds", { payment_intent: card.payment_intent, metadata: { booking_id: id } }, { idempotency: `refund-late-${id}` });
        await notifyOwner(db, { kind: "booking", title: "A deposit was refunded", body: "A client paid after their held time had been released, so the deposit went back to them automatically.", url: "dashboard.html#appointments" }).catch(() => {});
      }
    }
    return done(r.ok ? "confirmed" : "already");
  }

  // ── a client Evelyn booked added their card ──
  if (kind === "card") {
    if (!finished) return done("ignored");
    const id = o.metadata?.booking_id;
    const card = await cardFrom(o);
    if (id && card.payment_method) {
      const { data: b } = await db.from("bookings").update({ stripe_customer: card.customer, payment_method: card.payment_method, card_label: card.card_label })
        .eq("id", id).select("guest_email, guest_name").maybeSingle();
      if (b?.guest_email) await db.from("contacts").update({ stripe_customer: card.customer, payment_method: card.payment_method, card_label: card.card_label }).eq("email", String(b.guest_email).toLowerCase());
      await notifyOwner(db, { kind: "booking", title: `Card added: ${b?.guest_name ?? "a client"}`, body: card.card_label ?? "", url: "dashboard.html#appointments" }).catch(() => {});
    }
    return done();
  }

  // ── a visit paid by link, on the client's phone ──
  if (kind === "visit") {
    if (!finished) return done("ignored");
    const id = o.metadata?.booking_id;
    const { data: b } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
    if (b && b.status !== "completed") {
      const card = await cardFrom(o);
      await completeVisit(db, b, b.checkout?.pending ?? {}, { method: "link", charge_id: card.payment_intent, charged_cents: card.paid_cents });
    }
    return done();
  }

  // ── a new membership ──
  if (kind === "membership") {
    if (!finished || !o.subscription) return done("ignored");
    const m = await ensureMembership(db, typeof o.subscription === "string" ? o.subscription : o.subscription.id);
    if (m) {
      await notifyOwner(db, { kind: "member", email: true, url: "dashboard.html#members",
        title: `New member: ${m.name || m.email}`,
        body: `${PLANS[m.plan]?.name} at $${m.price_cents / 100} a month${m.founding ? " (founding rate)" : ""}.${m.five_no ? ` Founding Five #${m.five_no}: set their welcome kit aside.` : ""}` }).catch(() => {});
    }
    return done();
  }

  // ── shop orders (Stripe Checkout) ──
  if (finished) return done(await fulfillOrder(db, o));
  if (failed) await cancelOrder(db, o);
  return done();
});
