// Lumevina — Glow Membership on the server: the plans (the same as
// js/membership.js) and the member a booking belongs to.

// deno-lint-ignore-file no-explicit-any
import { norm, upsertContact } from "./contacts.ts";
import { cardLabel, stripe as stripeApi } from "./stripe.ts";

export const PLANS: Record<string, { name: string; price_cents: number; founding_cents: number; value_cents: number; retail: number; covers: string[]; facial: string; primary: string }> = {
  glow: { name: "Glow", price_cents: 18500, founding_cents: 17500, value_cents: 20000, retail: 0.10,
    covers: ["lumevina-custom-facial", "monthly-acne-treatment"], facial: "Lumevina Custom Facial", primary: "lumevina-custom-facial" },
  ageless: { name: "Ageless", price_cents: 23500, founding_cents: 22500, value_cents: 24000, retail: 0.15,
    covers: ["ageless-grace-facial", "monthly-acne-treatment", "lumevina-custom-facial"], facial: "Ageless Grace Facial", primary: "ageless-grace-facial" },
};
export const FOUNDING_CAP = 25, FIVE_CAP = 5, BANK_CAP = 2, MIN_MONTHS = 3, BANK_AFTER_CANCEL_DAYS = 60;
export const EXTRAS_OFF = 0.15;   // add-ons and anything else booked with a membership facial

/** Their membership, if it's live (or ended less than 60 days ago with facials still banked). */
export async function memberFor(db: any, email: string) {
  const { data } = await db.from("memberships").select("*").eq("email", norm(email)).order("created_at", { ascending: false }).limit(1);
  const m = data?.[0];
  if (!m) return null;
  if (m.status !== "cancelled") return m;
  const until = Date.parse(m.cancel_at ?? m.created_at) + BANK_AFTER_CANCEL_DAYS * 864e5;
  return m.credits > 0 && Date.now() < until ? m : null;
}
export const isLive = (m: any) => !!m && (m.status === "active" || m.status === "cancelling");
export const covers = (m: any, serviceId: string) => !!m && !!PLANS[m.plan]?.covers.includes(serviceId);

export async function foundingLeft(db: any) {
  const { count } = await db.from("memberships").select("id", { count: "exact", head: true }).eq("founding", true).neq("status", "cancelled");
  return Math.max(0, FOUNDING_CAP - (count ?? 0));
}

// ── Stripe Billing: one subscription per member (functions/membership, stripe-webhook) ──

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString(); };

/**
 * The membership row for a Stripe subscription, made the first time either
 * Stripe event about it arrives (checkout finished, or the first invoice
 * paid: they can come in either order). The subscription's metadata says
 * whose it is and which plan.
 */
export async function ensureMembership(db: any, subscriptionId: string) {
  const { data: had } = await db.from("memberships").select("*").eq("stripe_subscription_id", subscriptionId).maybeSingle();
  if (had) return had;
  const r = await stripeApi(`subscriptions/${subscriptionId}`);
  if (!r.ok) return null;
  const sub = r.data, meta = sub.metadata ?? {};
  const plan = PLANS[meta.plan] ? meta.plan : null;
  const email = norm(meta.email);
  if (!plan || !email) { console.error("membership metadata", subscriptionId); return null; }
  const { count: fives } = await db.from("memberships").select("id", { count: "exact", head: true }).not("five_no", "is", null);
  const five = (fives ?? 0) < FIVE_CAP ? (fives ?? 0) + 1 : null;
  const pm = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id ?? null;
  const started = new Date((sub.start_date ?? Date.now() / 1000) * 1000);
  const row = {
    email, name: meta.name || null, plan, price_cents: Number(sub.items?.data?.[0]?.price?.unit_amount ?? PLANS[plan].price_cents),
    status: "active", credits: 0, started_at: started.toISOString(), min_ends_at: addMonths(started, MIN_MONTHS),
    next_bill_at: iso(sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end) ?? addMonths(started, 1),
    founding: meta.founding === "1", five_no: five, five_kit: five ? "ready" : null, five_addon: five ? "ready" : null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
    stripe_subscription_id: subscriptionId, payment_method: pm, card_label: (await cardLabel(pm)) || null,
  };
  const { data, error } = await db.from("memberships").insert(row).select("*").single();
  if (error) {   // the other event got there first
    const { data: again } = await db.from("memberships").select("*").eq("stripe_subscription_id", subscriptionId).maybeSingle();
    return again ?? null;
  }
  await db.from("membership_ledger").insert({ membership_id: data.id, kind: "joined", amount_cents: row.price_cents });
  // their card holds their bookings too
  await upsertContact(db, { email, name: row.name ?? undefined });
  if (pm) await db.from("contacts").update({ stripe_customer: row.stripe_customer_id, payment_method: pm, card_label: row.card_label }).eq("email", email);
  return data;
}

/**
 * A paid invoice adds that month's facial. With two waiting, billing holds:
 * the subscription's next invoices are voided until one is booked.
 */
export async function creditInvoice(db: any, invoice: any) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription
    : invoice.subscription?.id ?? invoice.parent?.subscription_details?.subscription ?? null;
  if (!subId || !(invoice.amount_paid > 0)) return null;
  const m = await ensureMembership(db, subId);
  if (!m) return null;
  const { error } = await db.from("membership_ledger").insert({ membership_id: m.id, kind: "billed", amount_cents: invoice.amount_paid, invoice_id: invoice.id });
  if (error) return m;                                    // this invoice was already counted
  const credits = m.credits + 1;
  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const patch: Record<string, unknown> = { credits, next_bill_at: iso(periodEnd) ?? m.next_bill_at, paused_bill_at: null };
  if (credits >= BANK_CAP && !m.on_hold) {
    patch.on_hold = true;
    await stripeApi(`subscriptions/${subId}`, { pause_collection: { behavior: "void" } });
    await db.from("membership_ledger").insert({ membership_id: m.id, kind: "held" });
  }
  await db.from("memberships").update(patch).eq("id", m.id);
  return { ...m, ...patch };
}

/** Stripe changed the subscription (cancelled at a date, ended, card updated): mirror it. */
export async function syncSubscription(db: any, sub: any, ended = false) {
  const { data: m } = await db.from("memberships").select("*").eq("stripe_subscription_id", sub.id).maybeSingle();
  if (!m) return null;
  const pm = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id ?? null;
  const patch: Record<string, unknown> = {};
  if (ended || sub.status === "canceled") Object.assign(patch, { status: "cancelled", cancel_at: m.cancel_at ?? new Date().toISOString() });
  else if (sub.cancel_at) Object.assign(patch, { status: "cancelling", cancel_at: iso(sub.cancel_at) });
  else if (m.status === "cancelling") Object.assign(patch, { status: "active", cancel_at: null });
  if (pm && pm !== m.payment_method) Object.assign(patch, { payment_method: pm, card_label: (await cardLabel(pm)) || m.card_label });
  if (Object.keys(patch).length) {
    await db.from("memberships").update(patch).eq("id", m.id);
    if (patch.status === "cancelled") await db.from("membership_ledger").insert({ membership_id: m.id, kind: "cancelled" });
  }
  return { ...m, ...patch };
}
