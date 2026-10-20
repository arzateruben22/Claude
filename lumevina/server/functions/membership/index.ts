// Lumevina — Supabase Edge Function: membership (v3)
//
// Glow Membership, for real: a Stripe Billing subscription per member.
// js/membership.js calls it once the site is connected.
//
// POST { action: "plans" }                            → { founding_left, prices: { glow, ageless } } (cents, today's)
// POST { action: "join", plan, name, email, agreed: true, returnUrl }
//   → { url }: Stripe's page for the first month. The webhook then makes the
//     membership (../_shared/membership.ts → ensureMembership) and each paid
//     invoice adds that month's facial. The founding rate (the first 25) is
//     locked into the subscription's price for as long as it continues.
// With the client's sign-in (Authorization: Bearer <their token>):
// POST { action: "status" }                           → { member, ledger }
// POST { action: "pause" }     skip the next month (once a year; not while billing is on hold)
// POST { action: "unpause" }
// POST { action: "cancel" }    ends after the 3-month minimum or the month paid for, whichever is later
// POST { action: "keep" }      changes their mind before it ends
// POST { action: "card", returnUrl } → { url }  Stripe's page to change the billing card
// POST { action: "gift", name, email }  a banked facial, as a gift certificate for a friend
//
// Deploy:  supabase functions deploy membership --no-verify-jwt
// Secrets: STRIPE_SECRET_KEY, SITE_URL

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { EMAIL, norm } from "../_shared/contacts.ts";
import { BANK_AFTER_CANCEL_DAYS, foundingLeft, FOUNDING_CAP, memberFor, MIN_MONTHS, PLANS } from "../_shared/membership.ts";
import { customerFor, stripe } from "../_shared/stripe.ts";
import { issueGift } from "../_shared/gifts.ts";
import { emailGift } from "../_shared/orders.ts";
import { notifyOwner } from "../_shared/notify.ts";
import { site } from "../_shared/bookings.ts";

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const unix = (iso: string) => Math.floor(Date.parse(iso) / 1000);

/** What My Lumevina shows (never card numbers, only the label). */
const view = (m: any) => m && ({
  plan: m.plan, name: PLANS[m.plan]?.name, price_cents: m.price_cents, status: m.status, credits: m.credits,
  started_at: m.started_at, min_ends_at: m.min_ends_at, next_bill_at: m.next_bill_at, paused_bill_at: m.paused_bill_at,
  on_hold: m.on_hold, last_pause_at: m.last_pause_at, cancel_at: m.cancel_at, founding: m.founding,
  five_no: m.five_no, five_kit: m.five_kit, five_addon: m.five_addon, card: m.card_label,
  use_by: m.status === "cancelled" && m.cancel_at ? new Date(Date.parse(m.cancel_at) + BANK_AFTER_CANCEL_DAYS * 864e5).toISOString() : null,
});

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let signedIn: string | null = null;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt);
    if (data.user?.email) signedIn = norm(data.user.email);
  }
  const back = (u: unknown, hash: string) => {
    const ok = /^https:\/\//.test(String(u ?? "")) && (!site() || String(u).startsWith(site()));
    return (ok ? String(u).split(/[?#]/)[0] : site() + "/") + hash;
  };

  if (body.action === "plans") {
    const left = await foundingLeft(db);
    const price = (id: string) => (left > 0 ? PLANS[id].founding_cents : PLANS[id].price_cents);
    return json({ founding_left: left, founding_cap: FOUNDING_CAP, prices: { glow: price("glow"), ageless: price("ageless") } });
  }

  if (body.action === "join") {
    const plan = PLANS[String(body.plan)] ? String(body.plan) : null;
    const email = signedIn ?? norm(body.email), name = clip(body.name, 120);
    if (!plan) return json({ reason: "plan" }, 400);
    if (!EMAIL.test(email) || !name) return json({ reason: "email" }, 400);
    if (body.agreed !== true) return json({ reason: "terms" }, 400);
    const had = await memberFor(db, email);
    if (had && had.status !== "cancelled") return json({ reason: "already" }, 409);
    const left = await foundingLeft(db);
    const cents = left > 0 ? PLANS[plan].founding_cents : PLANS[plan].price_cents;
    const { data: c } = await db.from("contacts").select("stripe_customer").eq("email", email).maybeSingle();
    const customer = await customerFor(email, name, c?.stripe_customer);
    const meta = { kind: "membership", plan, email, name, founding: left > 0 ? "1" : "0" };
    const s = await stripe("checkout/sessions", {
      mode: "subscription", customer: customer ?? undefined, customer_email: customer ? undefined : email,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: cents, recurring: { interval: "month" },
        product_data: { name: `${PLANS[plan].name} Membership`, description: `${PLANS[plan].facial} every month. ${MIN_MONTHS}-month minimum, then cancel online any time.` } } }],
      subscription_data: { metadata: meta, description: `${PLANS[plan].name} Membership${left > 0 ? " (founding rate, locked while it continues)" : ""}` },
      metadata: meta, payment_method_collection: "always",
      success_url: back(body.returnUrl, `?joined=${plan}`), cancel_url: back(body.returnUrl, "?joined=cancelled#membership"),
      custom_text: { submit: { message: `Billed monthly until you cancel. ${MIN_MONTHS}-month minimum; cancel online any time after. Unused facials bank up to two, and with two waiting you're not billed.` } },
    });
    if (!s.ok || !s.data?.url) return json({ reason: "payment_unavailable" }, 502);
    return json({ url: s.data.url });
  }

  // everything else is their own membership
  if (!signedIn) return json({ reason: "sign_in" }, 401);
  const m = await memberFor(db, signedIn);
  const ledger = async () => {
    if (!m) return [];
    const { data } = await db.from("membership_ledger").select("kind, amount_cents, created_at").eq("membership_id", m.id).order("created_at", { ascending: false }).limit(12);
    return data ?? [];
  };
  const fresh = async () => view((await memberFor(db, signedIn!)) ?? m);

  switch (body.action) {
    case "status":
      return json({ member: view(m), ledger: await ledger() });

    case "pause": {
      if (!m || m.status !== "active" || m.on_hold || m.paused_bill_at) return json({ reason: "cannot" }, 409);
      if (m.last_pause_at && Date.now() - Date.parse(m.last_pause_at) < 365 * 864e5) return json({ reason: "once_a_year" }, 409);
      const resumes = unix(m.next_bill_at) + 3 * 86400;    // the next invoice is voided, billing resumes after it
      const r = await stripe(`subscriptions/${m.stripe_subscription_id}`, { pause_collection: { behavior: "void", resumes_at: resumes } });
      if (!r.ok) return json({ reason: "stripe" }, 502);
      await db.from("memberships").update({ paused_bill_at: m.next_bill_at, last_pause_at: new Date().toISOString() }).eq("id", m.id);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "paused" });
      return json({ member: await fresh() });
    }
    case "unpause": {
      if (!m || !m.paused_bill_at) return json({ reason: "cannot" }, 409);
      const r = await stripe(`subscriptions/${m.stripe_subscription_id}`, { pause_collection: "" });
      if (!r.ok) return json({ reason: "stripe" }, 502);
      await db.from("memberships").update({ paused_bill_at: null, last_pause_at: null }).eq("id", m.id);
      return json({ member: await fresh() });
    }
    case "cancel": {
      if (!m || m.status !== "active") return json({ reason: "cannot" }, 409);
      const end = Date.parse(m.min_ends_at) > Date.parse(m.next_bill_at) ? m.min_ends_at : m.next_bill_at;
      const r = await stripe(`subscriptions/${m.stripe_subscription_id}`, { cancel_at: unix(end), pause_collection: "" });
      if (!r.ok) return json({ reason: "stripe" }, 502);
      await db.from("memberships").update({ status: "cancelling", cancel_at: end, paused_bill_at: null }).eq("id", m.id);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "cancel-requested" });
      await notifyOwner(db, { kind: "member", url: "dashboard.html#members", title: `Membership ending: ${m.name || signedIn}`, body: `${PLANS[m.plan].name}, last day ${new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.` }).catch(() => {});
      return json({ member: await fresh() });
    }
    case "keep": {
      if (!m || m.status !== "cancelling") return json({ reason: "cannot" }, 409);
      const r = await stripe(`subscriptions/${m.stripe_subscription_id}`, { cancel_at: "" });
      if (!r.ok) return json({ reason: "stripe" }, 502);
      await db.from("memberships").update({ status: "active", cancel_at: null }).eq("id", m.id);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "kept" });
      return json({ member: await fresh() });
    }
    case "card": {
      if (!m?.stripe_customer_id) return json({ reason: "cannot" }, 409);
      const r = await stripe("billing_portal/sessions", { customer: m.stripe_customer_id, return_url: back(body.returnUrl, "#account") });
      return r.ok ? json({ url: r.data.url }) : json({ reason: "stripe" }, 502);
    }
    case "gift": {
      if (!m || m.credits < 1) return json({ reason: "no_facials" }, 409);
      const to = norm(body.email), toName = clip(body.name, 120);
      if (!EMAIL.test(to) || !toName) return json({ reason: "email" }, 400);
      const plan = PLANS[m.plan];
      const { data: took } = await db.from("memberships").update({ credits: m.credits - 1 }).eq("id", m.id).eq("credits", m.credits).select("id");
      if (!took?.length) return json({ reason: "try_again" }, 409);
      const card = await issueGift(db, {
        amountCents: plan.value_cents, recipientName: toName, recipientEmail: to, buyerEmail: signedIn,
        message: `A ${plan.facial}, from ${m.name || "a Lumevina member"}'s membership.`, source: "membership",
        kind: "service", serviceId: plan.primary, label: plan.facial,
      });
      await emailGift(card, m.name || "A Lumevina member");
      await db.from("gift_cards").update({ delivered_at: new Date().toISOString() }).eq("code", card.code);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "gifted", gift_code: card.code });
      return json({ member: await fresh(), sent_to: toName });
    }
    default:
      return json({ error: "unknown action" }, 400);
  }
});
