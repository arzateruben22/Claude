// Lumevina — what Ask Lumevina can look up for a client (functions/ask):
// where their shop order is, and what's left on a gift certificate.
//
// Orders: a signed-in client sees their own (matched on their sign-in
// email). Anyone else needs both the order number from their receipt
// (LUM- and 8 characters, orders.ref) and the email they ordered with.
// Neither answer includes an address or a gift certificate's code.
//
// Gift certificates: anyone with the code, the same as the website's
// "Check a gift balance" (functions/gift-cards).

// deno-lint-ignore-file no-explicit-any
import { publicCard } from "./gifts.ts";
import { money } from "./mail.ts";

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_NO = /^LUM-[0-9A-F]{8}$/;
const GIFT_CODE = /^LUM-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" }) : null;

export const trackingUrl = (t: string, carrier: string | null) =>
  carrier === "UPS" || /^1Z/i.test(t) ? `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`
    : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`;

/** "lum-3f9a1c2b", "#3F9A1C2B" or "3F9A1C2B" → "LUM-3F9A1C2B" */
export const orderNumber = (v: unknown) => {
  const t = String(v ?? "").trim().toUpperCase().replace(/^#/, "").replace(/\s+/g, "");
  return /^[0-9A-F]{8}$/.test(t) ? "LUM-" + t : t;
};

export type OrderLookup = {
  found: boolean;
  need?: string;
  orders?: Record<string, unknown>[];
  links?: { label: string; url: string }[];
};

export async function lookUpOrder(db: any, signedInEmail: string | null, input: { order_number?: string; email?: string }): Promise<OrderLookup> {
  const ref = orderNumber(input.order_number);
  let q = db.from("orders")
    .select("id, ref, status, items, gifts, delivery, total_cents, subtotal_cents, created_at, paid_at, stripe_payment_intent")
    .neq("status", "cancelled").order("created_at", { ascending: false }).limit(5);
  if (signedInEmail) {
    q = q.eq("email", signedInEmail.toLowerCase());
    if (ORDER_NO.test(ref)) q = q.eq("ref", ref);
  } else {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!ORDER_NO.test(ref) || !EMAIL.test(email)) {
      return { found: false, need: "Both the order number from the receipt email (it starts with LUM-) and the email the order was placed with." };
    }
    q = q.eq("ref", ref).eq("email", email);
  }
  const { data, error } = await q;
  if (error) throw error;
  // a checkout left unpaid for days isn't an order anyone is waiting on
  const rows = (data ?? []).filter((o: any) => o.status !== "pending" || Date.now() - Date.parse(o.created_at) < 3 * 864e5);
  if (!rows.length) {
    return { found: false, need: signedInEmail ? "No orders under this sign-in. They may have ordered with another email: ask for the order number and that email." : "No order matches that number and email together." };
  }

  const refs = rows.map((o: any) => o.stripe_payment_intent ?? o.id);
  const { data: ships } = await db.from("shipments").select("order_ref, status, ship_by, shipped_at, tracking, carrier").in("order_ref", refs);
  const shipOf = new Map<string, any>((ships ?? []).map((s: any) => [s.order_ref, s]));
  const links: { label: string; url: string }[] = [];

  const orders = rows.map((o: any) => {
    const s = shipOf.get(o.stripe_payment_intent ?? o.id);
    const items = (o.items ?? []).map((i: any) => `${i.qty} × ${i.name}`).join(", ");
    const gifts = (o.gifts ?? []).length;
    let where = "";
    if (o.status === "pending") where = "The payment hasn't finished yet (some bank payments take a few days). Nothing ships until it does.";
    else if (o.status === "refunded") where = "Refunded.";
    else if (o.delivery === "pickup") where = "Waiting for them at their next visit.";
    else if (o.delivery === "ship" && !s) where = "Paid. It's being packed and ships within two business days.";
    else if (s?.status === "to_ship") where = `Being packed. It ships by ${day(s.ship_by)}.`;
    else if (s?.status === "shipped" || s?.status === "delivered") {
      where = `${s.status === "delivered" ? "Delivered" : "Shipped"} ${day(s.shipped_at) ?? ""}${s.carrier ? " by " + s.carrier : ""}.`.replace(" .", ".");
      if (s.tracking) links.push({ label: rows.length > 1 ? `Track ${o.ref}` : "Track my package", url: trackingUrl(s.tracking, s.carrier) });
    } else if (s?.status === "returned") where = "Came back to Evelyn (returned to sender).";
    else if (gifts && !items) where = "Paid. The gift certificates are emailed to their recipients (on the date chosen, if there was one).";
    else where = "Paid.";
    return {
      number: o.ref,
      placed: day(o.created_at),
      items: items || null,
      gift_certificates: gifts || null,
      delivery: o.delivery === "ship" ? "shipping" : o.delivery === "pickup" ? "pickup at a visit" : "nothing to ship",
      total: money(o.total_cents ?? o.subtotal_cents),
      where,
      tracking: s?.tracking ? "a tracking link is shown under your answer" : null,
    };
  });
  return { found: true, orders, links: links.slice(0, 3) };
}

export async function giftBalance(db: any, code: unknown) {
  const c = String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!GIFT_CODE.test(c)) return { found: false, need: "The full code from the certificate email: LUM-, four characters, a dash, four more." };
  const { data } = await db.from("gift_cards").select("*").eq("code", c).maybeSingle();
  if (!data) return { found: false, need: "No certificate has that code. Ask them to check it against the email." };
  const p = publicCard(data);
  return {
    found: true,
    ending: c.slice(-4),
    what: p.label,
    kind: p.kind === "service" ? "covers one treatment, used all at once" : "a dollar amount that draws down",
    amount: money(data.amount_cents),
    left: money(data.balance_cents),
    status: p.status === "void" ? "cancelled" : p.status === "redeemed" || data.balance_cents <= 0 ? "fully used" : "active, never expires",
  };
}
