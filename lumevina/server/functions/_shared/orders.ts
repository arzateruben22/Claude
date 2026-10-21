// Lumevina — finishing a shop order once Stripe says it's paid (called from
// stripe-webhook). In one pass: mark it paid with the real totals, take the
// stock off, issue and email any gift certificates, put a shipped order on
// the Shipping list, email the receipt, and tell Evelyn (order + low stock).
// Safe to run twice: only the first delivery of an event claims the order.

// deno-lint-ignore-file no-explicit-any
import { issueGift } from "./gifts.ts";
import { consultPaid, isConsultItem } from "./consults.ts";
import { esc, money, page, sendEmail } from "./mail.ts";
import { notifyOwner } from "./notify.ts";
import { earn } from "./points.ts";
import { upsertContact } from "./contacts.ts";

const site = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");

const addressOf = (s: any) => {
  const d = s.collected_information?.shipping_details ?? s.shipping_details ?? null;
  const a = d?.address;
  if (!a) return null;
  return { name: d.name ?? "", street: a.line1 ?? "", apt: a.line2 ?? "", city: a.city ?? "", state: a.state ?? "", zip: a.postal_code ?? "" };
};

// two business days from now, for the Shipping list
const shipBy = () => {
  const d = new Date();
  for (let added = 0; added < 2;) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString();
};

const today = () => new Date().toISOString().slice(0, 10);

/** The certificate email: to the recipient, or to the buyer when it's theirs to hand over. */
export async function emailGift(card: { code: string; amount_cents: number; recipient_name: string | null; recipient_email: string | null; buyer_email: string | null; message: string | null; deliver_to_buyer: boolean; kind?: string; label?: string | null }, fromName: string) {
  const to = card.deliver_to_buyer ? card.buyer_email : card.recipient_email;
  if (!to) return false;
  const hi = card.recipient_name ? `Hi ${esc(card.recipient_name)},` : "Hi,";
  const body =
    `<p style="font-size:15px;line-height:1.5">${hi}</p>` +
    `<p style="font-size:15px;line-height:1.5">${card.deliver_to_buyer ? "Here's the gift certificate you bought, ready to give." : `${esc(fromName || "Someone")} sent you a gift of glow.`}</p>` +
    (card.message ? `<p style="font-size:15px;line-height:1.5;padding:12px 14px;background:#fff;border-left:2px solid #B2967D;border-radius:0 8px 8px 0">${esc(card.message)}</p>` : "") +
    // the certificate itself: the same beach sand as the one on the website
    `<div style="margin:18px 0 16px;padding:18px 20px;background:#E8D5AE;border:1px solid #D9BE90;border-radius:16px">` +
    `<p style="margin:0 0 6px;font-size:13px;color:#4A342A">Certificate</p>` +
    `<p style="margin:0;font-size:24px;font-weight:700;letter-spacing:.06em">${esc(card.code)}</p>` +
    `<p style="margin:4px 0 0;font-size:15px">${card.kind === "service" ? `One ${esc(card.label ?? "treatment")}, on the house` : `${money(card.amount_cents)} toward any treatment`}, and it never expires.</p>` +
    `</div>` +
    `<p style="font-size:14px;line-height:1.5;color:#4A342A">Book with Evelyn${site() ? ` at <a href="${esc(site())}#services" style="color:#161412">${esc(site().replace(/^https?:\/\//, ""))}</a>` : ""}, and show this code at your visit. Anything left stays on it for next time; if the visit costs more, you pay only the difference.</p>`;
  return sendEmail(to, card.deliver_to_buyer ? "Your Lumevina gift certificate" : "A gift for you from Lumevina", page("A gift of glow", body));
}

export async function fulfillOrder(db: any, session: any): Promise<string> {
  const id = session.metadata?.order_id;
  if (!id) return "no order";
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return "unknown order";
  if (order.status !== "pending") return "already handled";

  const address = order.delivery === "ship" ? addressOf(session) : null;
  const name = address?.name || session.customer_details?.name || order.name || "";
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const shipping = session.total_details?.amount_shipping ?? order.shipping_cents;
  const tax = session.total_details?.amount_tax ?? 0;
  const total = session.amount_total ?? order.subtotal_cents + shipping;

  // claim it: only one delivery of the event gets past this
  const { data: claimed } = await db.from("orders").update({
    status: "paid", paid_at: new Date().toISOString(), total_cents: total, tax_cents: tax, shipping_cents: shipping,
    address, name: name || null, stripe_payment_intent: pi,
  }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return "already handled";

  // the shelf
  let low: any[] = [];
  if (order.items.length) {
    const { data, error } = await db.rpc("take_stock", { p_items: order.items.map((i: any) => ({ id: i.id, qty: i.qty })) });
    if (error) console.error("take_stock", error);
    low = (data ?? []).filter((r: any) => r.low);
  }

  // gift certificates: issued now, emailed now or on their send date (studio-digest sends the dated ones)
  const codes: string[] = [];
  for (const g of order.gifts) {
    try {
      const card = await issueGift(db, {
        amountCents: g.amount_cents, recipientName: g.recipient_name, recipientEmail: g.recipient_email,
        buyerEmail: order.email, message: g.message, deliverToBuyer: g.to_buyer, sendDate: g.send_date, source: "sale", paymentIntent: pi ?? undefined,
      });
      codes.push(card.code);
      if (!card.send_date || card.send_date <= today()) {
        if (await emailGift(card, name)) await db.from("gift_cards").update({ delivered_at: new Date().toISOString() }).eq("code", card.code);
      }
    } catch (e) { console.error("gift", e); }
  }
  if (codes.length) await db.from("orders").update({ gift_codes: codes }).eq("id", id);

  // the online Skin Consult: its row, the client's "what happens next", Evelyn's phone
  const consult = order.items.some((i: any) => isConsultItem(i.id));
  if (consult) await consultPaid(db, order, name).catch((e: unknown) => console.error("consult", e));

  // shipping list (dashboard → Shipping)
  if (order.delivery === "ship" && address) {
    const count = order.items.reduce((s: number, i: any) => s + i.qty, 0);
    const { error } = await db.from("shipments").insert({
      order_ref: pi ?? id, source: "shop", client_id: order.client_id, name: name || order.email, email: order.email,
      street: address.street, apt: address.apt || null, city: address.city, state: address.state, zip: address.zip,
      items: order.items.map((i: any) => ({ id: i.id, name: i.name, qty: i.qty })),
      package: count > 3 ? "small" : "mailer", weight_oz: Math.max(4, count * 6),
      charged_cents: shipping, est_cents: 900, ship_by: shipBy(),
    });
    if (error) console.error("shipment", error);
  }

  // the receipt
  const lines = [
    ...order.items.map((i: any) => [`${i.name} × ${i.qty}`, money(i.price_cents * i.qty)]),
    ...order.gifts.map((g: any, k: number) => [`Gift certificate${g.recipient_name ? " for " + g.recipient_name : ""}${codes[k] && g.to_buyer ? " · " + codes[k] : ""}`, money(g.amount_cents)]),
    ...(order.delivery === "ship" ? [["Shipping", shipping ? money(shipping) : "Free"]] : []),
    ...(order.delivery === "pickup" ? [["Pickup at your visit", "Free"]] : []),
    ...(tax ? [["Sales tax", money(tax)]] : []),
  ];
  const table = `<table style="width:100%;border-collapse:collapse;font-size:15px">` +
    lines.map(([a, b]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #D7C9B8">${esc(a)}</td><td style="padding:6px 0;border-bottom:1px solid #D7C9B8;text-align:right">${esc(b)}</td></tr>`).join("") +
    `<tr><td style="padding:10px 0;font-weight:700">Total</td><td style="padding:10px 0;font-weight:700;text-align:right">${money(total)}</td></tr></table>`;
  const next = order.delivery === "ship" ? "It ships within two business days, and the tracking number comes by email."
    : order.delivery === "pickup" ? "It will be waiting for you at your next visit."
    : consult ? "Evelyn messages you within two business days to set your 15-minute call; the details are in the next email."
    : order.gifts.some((g: any) => !g.to_buyer) ? "Each certificate is emailed to its recipient (on the date you chose, if you picked one)." : "";
  const track = order.items.length ? ` Ask Lumevina on the website${site() ? ` (<a href="${esc(site())}" style="color:#161412">${esc(site().replace(/^https?:\/\//, ""))}</a>)` : ""} can tell you where it is any time with this number and your email.` : "";
  // the shelf products, back in the bag in one tap next time (js/cart.js reads ?reorder=; Buy again in My Lumevina does the same signed in)
  const shelfIds = order.items.map((i: any) => i.id).filter((id: string) => !isConsultItem(id));
  const again = shelfIds.length && site() ? `<p style="font-size:14px;line-height:1.5;margin-top:14px;color:#4A342A">Running low later? <a href="${esc(site())}/?reorder=${encodeURIComponent(shelfIds.join(","))}#shop" style="color:#161412">Put these back in your bag</a> in one tap, or sign in and open Buy again under My Lumevina.</p>` : "";
  await sendEmail(order.email, `Your Lumevina order ${order.ref}`, page(`Thank you${name ? ", " + name.split(" ")[0] : ""}!`,
    `<p style="margin:0 0 12px;font-size:13px;color:#7D5A44">Order number <strong style="color:#161412;letter-spacing:.04em">${esc(order.ref)}</strong></p>` + table +
    (next || track ? `<p style="font-size:15px;line-height:1.5;margin-top:16px">${esc(next)}${track}</p>` : "") + again));

  // Glow Points on the products and gift certificates (not shipping or tax), and her client list
  await upsertContact(db, { email: order.email, name: name || undefined });
  const earned = order.subtotal_cents > 0
    ? await earn(db, order.email, order.subtotal_cents, { label: "Shop order", order_id: order.id }).catch((e) => { console.error("points", e); return null; })
    : null;
  if (earned?.points) console.log(JSON.stringify({ order: order.id, points: earned.points }));

  // Evelyn
  const what = [...order.items.map((i: any) => `${i.qty} × ${i.name}`), ...order.gifts.map((g: any) => `gift certificate ${money(g.amount_cents)}`)].join(", ");
  await notifyOwner(db, {
    kind: order.gifts.length && !order.items.length ? "gift" : "order",
    title: `New order ${order.ref}: ${money(total)}`,
    body: `${name || order.email}: ${what}. ${order.delivery === "ship" ? "Ship by " + new Date(shipBy()).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + "." : order.delivery === "pickup" ? "Pickup at their visit." : ""}`,
    url: "dashboard.html#shipping", email: true,
  });
  for (const l of low) {
    await notifyOwner(db, { kind: "low_stock", title: `Low stock: ${l.name}`, body: l.stock === 0 ? "Sold out on the website now." : `${l.stock} left.`, url: "dashboard.html#inventory" });
  }
  return "paid";
}

export async function cancelOrder(db: any, session: any) {
  const id = session.metadata?.order_id;
  if (id) await db.from("orders").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
}
