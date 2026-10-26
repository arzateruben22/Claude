// Lumevina — a sale at the studio (functions/studio → sale). Evelyn picks a client (or types a
// name and email for someone new), adds what they're taking home from the shelf and any
// treatment done without a booking, a discount, a tip, and how they paid: their card on file,
// cash, a pay link they open on their phone, or something else. It becomes an order like a
// web order (orders, source "studio"), so the same finish runs: stock comes off, the receipt
// goes out, Glow Points land, the products show under Buy again, and Evelyn's books see it.
//
//   recordSale(db, input) → { ok: true, order, points } | { ok: true, url } (a pay link) | { ok: false, reason }

// deno-lint-ignore-file no-explicit-any
import { CATALOG } from "./catalog.ts";
import { EMAIL, getContact, norm, upsertContact } from "./contacts.ts";
import { fulfillOrder } from "./orders.ts";
import { chargeOnFile, stripe } from "./stripe.ts";

export type SaleInput = {
  email?: string; name?: string; phone?: string;
  items?: { id: string; qty: number }[]; services?: string[];
  discount_cents?: number; tip_cents?: number;
  method?: "card" | "cash" | "link" | "other";
  returnUrl?: string;
};

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const site = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

export async function recordSale(db: any, input: SaleInput) {
  const email = norm(input.email ?? "");
  if (!EMAIL.test(email)) return { ok: false as const, reason: "email" };
  const name = clip(input.name, 120);
  const method = ["card", "cash", "link", "other"].includes(String(input.method)) ? input.method! : "other";

  // what they're taking: priced from the products table, never from the dashboard
  const want = new Map<string, number>();
  for (const it of Array.isArray(input.items) ? input.items.slice(0, 50) : []) {
    const id = clip(it?.id, 80), qty = Math.round(Number(it?.qty));
    if (id && qty > 0 && qty <= 20) want.set(id, (want.get(id) ?? 0) + qty);
  }
  const items: { id: string; name: string; qty: number; price_cents: number; kind?: string }[] = [];
  if (want.size) {
    const { data: rows } = await db.from("products").select("id, name, price_cents, stock").in("id", [...want.keys()]);
    for (const [id, qty] of want) {
      const p = (rows ?? []).find((r: any) => r.id === id);
      if (!p) return { ok: false as const, reason: "unavailable", id };
      if (p.stock != null && qty > p.stock) return { ok: false as const, reason: "stock", id, left: p.stock, name: p.name };
      items.push({ id, name: p.name, qty, price_cents: p.price_cents });
    }
  }
  // a treatment done on the spot, at the menu price
  for (const id of (Array.isArray(input.services) ? input.services : []).map(String).slice(0, 8)) {
    const s = CATALOG[id];
    if (s) items.push({ id, name: s.name, qty: 1, price_cents: s.price_cents, kind: "service" });
  }
  if (!items.length) return { ok: false as const, reason: "empty" };

  const gross = items.reduce((s, i) => s + i.price_cents * i.qty, 0);
  const discount = Math.min(gross, Math.max(0, Math.round(Number(input.discount_cents) || 0)));
  const tip = Math.max(0, Math.round(Number(input.tip_cents) || 0));
  if (discount) items.push({ id: "discount", name: "Discount", qty: 1, price_cents: -discount, kind: "adjust" });
  if (tip) items.push({ id: "tip", name: "Tip", qty: 1, price_cents: tip, kind: "adjust" });
  const subtotal = gross - discount;
  const total = subtotal + tip;

  const contact = await upsertContact(db, { email, name: name || undefined, phone: clip(input.phone, 40) || undefined, source: "studio" }).catch(() => null) ?? await getContact(db, email);
  const { data: order, error } = await db.from("orders").insert({
    email, name: name || contact?.name || null, items, gifts: [], delivery: "none", source: "studio",
    subtotal_cents: subtotal, shipping_cents: 0, total_cents: total,
  }).select("*").single();
  if (error || !order) { console.error("sale", error); return { ok: false as const, reason: "failed" }; }

  // a pay link: Stripe's page on their phone; the webhook finishes the order when they pay
  if (method === "link") {
    const back = site() || String(input.returnUrl ?? "").split(/[?#]/)[0];
    const s = await stripe("checkout/sessions", {
      mode: "payment", customer_email: email,
      success_url: `${back}/?paid=studio`, cancel_url: `${back}/?paid=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
      metadata: { order_id: order.id }, payment_intent_data: { metadata: { order_id: order.id }, description: "Lumevina, at the studio" },
      line_items: items.filter((i) => i.price_cents > 0).map((i) => ({ quantity: i.qty, price_data: { currency: "usd", unit_amount: i.price_cents, product_data: { name: i.name } } })),
      ...(discount ? { discounts: [] } : {}),
    });
    if (!s.ok || !s.data?.url) {
      await db.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return { ok: false as const, reason: "payment_unavailable" };
    }
    await db.from("orders").update({ stripe_session: s.data.id }).eq("id", order.id);
    return { ok: true as const, url: String(s.data.url), order };
  }

  // their card on file, charged now
  let pi: string | null = null;
  if (method === "card") {
    if (!contact?.stripe_customer || !contact?.payment_method) return { ok: false as const, reason: "no_card" };
    if (total > 0) {
      const r = await chargeOnFile({ customer: contact.stripe_customer, paymentMethod: contact.payment_method, cents: total,
        description: `Lumevina, at the studio: ${items.filter((i) => !i.kind).map((i) => i.name).join(", ") || "visit"}`, metadata: { kind: "sale", order_id: order.id }, key: `sale-${order.id}` });
      if (!r.ok) { await db.from("orders").update({ status: "cancelled" }).eq("id", order.id); return { ok: false as const, reason: r.reason }; }
      pi = r.id;
    }
  }
  // cash or other: paid, as of now
  const done = await fulfillOrder(db, { metadata: { order_id: order.id }, amount_total: total, payment_intent: pi, customer_details: { name: name || contact?.name || "" }, total_details: { amount_shipping: 0, amount_tax: 0 }, paid_how: method });
  const { data: fresh } = await db.from("orders").select("*").eq("id", order.id).maybeSingle();
  return { ok: true as const, order: fresh ?? order, result: done };
}
