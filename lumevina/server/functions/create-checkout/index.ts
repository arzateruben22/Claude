// Lumevina — Supabase Edge Function: create-checkout
//
// The shop's real checkout. The website sends what's in the cart; this
// checks every price and count against the products table (never trusting
// the browser), saves a pending order, and opens a Stripe Checkout page:
// card, Apple Pay and Google Pay, and pay-over-time (Klarna, Afterpay,
// Affirm) when they're switched on in Stripe. Sales tax is added by Stripe
// Tax when STRIPE_TAX=on. The Stripe webhook finishes the order (stock,
// gift codes, emails, Evelyn's alert).
//
// POST { items: [{ id, qty }], gifts: [{ amount, recipientName?, recipientEmail?,
//        message?, sendDate?, toBuyer? }], delivery: "ship" | "pickup",
//        email, name?, returnUrl }
// → { url }   (the Stripe page)   or { reason } with a 4xx
//
// Glow members (v3), signed in (Authorization: Bearer <their token>), get
// their plan's skincare discount (10% Glow, 15% Ageless) and free shipping,
// as js/cart.js shows them.
//
// Deploy:  supabase functions deploy create-checkout
// Secrets: STRIPE_SECRET_KEY, SITE_URL (her website's address, for the
//          return links), STRIPE_TAX=on once Stripe Tax is set up

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { isLive, memberFor, PLANS } from "../_shared/membership.ts";
import { approvedFor, mayBuy } from "../_shared/consults.ts";

const SHIP_CENTS = 800, FREE_OVER_CENTS = 7500;           // same rule as js/cart.js
const GIFT_MIN = 25, GIFT_MAX = 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_GOODS = "txcd_99999999", TAX_NONE = "txcd_00000000", TAX_SHIPPING = "txcd_92010001", TAX_SERVICES = "txcd_20030000";   // services: the online consult

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const body = await req.json().catch(() => ({}));
  const email = clip(body.email, 200).toLowerCase();
  if (!EMAIL.test(email)) return json({ reason: "email" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // a signed-in member buying for themselves: their plan's shelf discount, free shipping
  let rate = 0;
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (jwt && jwt !== Deno.env.get("SUPABASE_ANON_KEY")) {
    const { data } = await db.auth.getUser(jwt);
    const signedIn = String(data.user?.email ?? "").toLowerCase();
    const m = signedIn === email ? await memberFor(db, email) : null;
    if (isLive(m)) rate = PLANS[m.plan]?.retail ?? 0;
  }

  // ── what's in the cart, priced by the server ──
  const want = new Map<string, number>();
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 50) : []) {
    const id = clip(it?.id, 80), qty = Math.round(Number(it?.qty));
    if (id && qty > 0 && qty <= 20) want.set(id, (want.get(id) ?? 0) + qty);
  }
  const items: { id: string; name: string; qty: number; price_cents: number }[] = [];
  const services = new Set<string>();
  if (want.size) {
    const { data: rows } = await db.from("products").select("id, name, price_cents, stock, hidden, kind, consult").in("id", [...want.keys()]);
    const gated = (rows ?? []).filter((r: any) => r.consult && want.has(r.id));
    const approval = gated.length ? await approvedFor(db, email) : null;
    for (const [id, qty] of want) {
      const p = (rows ?? []).find((r: any) => r.id === id);
      if (!p || p.hidden) return json({ reason: "unavailable", id }, 409);
      if (p.stock != null && qty > p.stock) return json({ reason: "stock", id, left: p.stock, name: p.name }, 409);
      // an active Evelyn checks first: only with her yes for this email (the shop asks before it gets here)
      if (p.consult && approval && !mayBuy(approval, id)) return json({ reason: "consult_needed", id, name: p.name }, 409);
      if (p.kind === "consult") services.add(id);
      items.push({ id, name: p.name, qty: p.kind === "consult" ? 1 : qty, price_cents: p.kind === "consult" || !rate ? p.price_cents : Math.round(p.price_cents * (1 - rate)) });
    }
  }
  const physical = items.filter((i) => !services.has(i.id));
  const gifts: any[] = [];
  for (const g of Array.isArray(body.gifts) ? body.gifts.slice(0, 10) : []) {
    const amount = Math.round(Number(g?.amount));
    if (!(amount >= GIFT_MIN && amount <= GIFT_MAX)) return json({ reason: "gift_amount" }, 400);
    const toBuyer = !!g?.toBuyer;
    const recipientEmail = clip(g?.recipientEmail, 200).toLowerCase();
    if (!toBuyer && !EMAIL.test(recipientEmail)) return json({ reason: "gift_email" }, 400);
    gifts.push({
      amount_cents: amount * 100, to_buyer: toBuyer,
      recipient_name: toBuyer ? null : clip(g?.recipientName, 120) || null,
      recipient_email: toBuyer ? null : recipientEmail,
      message: clip(g?.message, 500) || null,
      send_date: /^\d{4}-\d{2}-\d{2}$/.test(String(g?.sendDate)) ? g.sendDate : null,
    });
  }
  if (!items.length && !gifts.length) return json({ reason: "empty" }, 400);

  const retailCents = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const physicalCents = physical.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const delivery = !physical.length ? "none" : body.delivery === "pickup" ? "pickup" : "ship";
  const shippingCents = delivery === "ship" && !rate && physicalCents < FREE_OVER_CENTS ? SHIP_CENTS : 0;
  const subtotal = retailCents + gifts.reduce((s, g) => s + g.amount_cents, 0);

  // ── the pending order ──
  const { data: order, error } = await db.from("orders").insert({
    email, name: clip(body.name, 120) || null, items, gifts, delivery,
    subtotal_cents: subtotal, shipping_cents: shippingCents,
  }).select("id").single();
  if (error || !order) { console.error(error); return json({ reason: "failed" }, 500); }

  // ── the Stripe page ──
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const back = /^https:\/\//.test(String(body.returnUrl ?? "")) && (!site || String(body.returnUrl).startsWith(site))
    ? String(body.returnUrl).split(/[?#]/)[0] : site + "/";
  const tax = Deno.env.get("STRIPE_TAX") === "on";
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("customer_email", email);
  f.set("success_url", back + "?order=done&session={CHECKOUT_SESSION_ID}");
  f.set("cancel_url", back + "?order=cancelled#shop");
  f.set("metadata[order_id]", order.id);
  f.set("payment_intent_data[metadata][order_id]", order.id);
  f.set("payment_intent_data[description]", "Lumevina order");
  let n = 0;
  const line = (name: string, cents: number, qty: number, code: string) => {
    f.set(`line_items[${n}][quantity]`, String(qty));
    f.set(`line_items[${n}][price_data][currency]`, "usd");
    f.set(`line_items[${n}][price_data][unit_amount]`, String(cents));
    f.set(`line_items[${n}][price_data][product_data][name]`, name);
    f.set(`line_items[${n}][price_data][product_data][tax_code]`, code);
    if (tax) f.set(`line_items[${n}][price_data][tax_behavior]`, "exclusive");
    n++;
  };
  items.forEach((i) => services.has(i.id) ? line(i.name, i.price_cents, i.qty, TAX_SERVICES) : line(i.name + (rate ? ` (member ${Math.round(rate * 100)}% off)` : ""), i.price_cents, i.qty, TAX_GOODS));
  gifts.forEach((g) => line(`Lumevina e-gift certificate · $${g.amount_cents / 100}` + (g.recipient_name ? ` for ${g.recipient_name}` : ""), g.amount_cents, 1, TAX_NONE));
  if (delivery === "ship") {
    f.set("shipping_address_collection[allowed_countries][0]", "US");
    f.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
    f.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shippingCents));
    f.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
    f.set("shipping_options[0][shipping_rate_data][display_name]", shippingCents ? "Shipping (USPS)" : rate ? "Free shipping (members)" : "Free shipping (orders over $75)");
    if (tax) {
      f.set("shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive");
      f.set("shipping_options[0][shipping_rate_data][tax_code]", TAX_SHIPPING);
    }
  }
  if (tax) {
    f.set("automatic_tax[enabled]", "true");
    if (delivery !== "ship") f.set("billing_address_collection", "required");   // tax needs an address
  }
  if (delivery === "pickup") f.set("custom_text[submit][message]", "Pick up at your next visit to the studio in Woodland Hills.");

  f.set("allow_promotion_codes", "true");       // WELCOME10 and the like, set up in Stripe (marketing/welcome-offer.md); never in an ad
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: f,
  });
  const session = await res.json().catch(() => ({}));
  if (!res.ok || !session.url) {
    console.error("stripe", session?.error ?? res.status);
    await db.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return json({ reason: "payment_unavailable" }, 502);
  }
  await db.from("orders").update({ stripe_session: session.id }).eq("id", order.id);
  return json({ url: session.url });
});
