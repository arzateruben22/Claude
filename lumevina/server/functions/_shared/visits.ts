// Lumevina — checking out a visit at the studio (functions/studio-book →
// checkout, and stripe-webhook when the client pays by link on their phone).
//
// What's due: the services done (Evelyn can change them at the visit),
// less a membership facial, members' 15% off the rest, a flash opening's
// 10%, a friend's $15, her own discount, the deposit already paid and any
// gift certificate or Glow Points; plus products from her shelf (members
// get their plan's shelf discount), plus the tip. Paid by the card on file,
// cash, or a link the client pays on their phone. Then: the visit is
// completed, products come off the shelf, points are earned on what was
// paid (not the tip), a friend's referral pays out, and the receipt goes out.

// deno-lint-ignore-file no-explicit-any
import { CATALOG } from "./catalog.ts";
import { esc, money, page, sendEmail } from "./mail.ts";
import { getContact, norm } from "./contacts.ts";
import { addPoints, balance, BLOCK_CENTS, BLOCK_POINTS, earn, REFERRAL_BONUS } from "./points.ts";
import { EXTRAS_OFF, covers, memberFor, PLANS } from "./membership.ts";
import { fmtWhen, names } from "./bookings.ts";

const FLASH_OFF = 0.10, REFERRAL_OFF_CENTS = 1500;

export type VisitInput = {
  services?: string[]; products?: { id: string; qty: number }[]; tip_cents?: number; discount_cents?: number;
  gift_code?: string; points?: number;
};

export async function quoteVisit(db: any, b: any, input: VisitInput) {
  const email = norm(b.guest_email);
  const services = (input.services?.length ? input.services : b.services).map(String).filter((id: string) => CATALOG[id]).slice(0, 8);
  const lines: { label: string; cents: number }[] = [];
  let servicesCents = 0;
  for (const id of services) { lines.push({ label: CATALOG[id].name, cents: CATALOG[id].price_cents }); servicesCents += CATALOG[id].price_cents; }

  // a membership facial (its credit was used when it was booked)
  let m: any = null;
  if (b.membership_id) {
    const { data } = await db.from("memberships").select("*").eq("id", b.membership_id).maybeSingle();
    m = data;
  }
  const coveredId = m ? services.find((id: string) => covers(m, id)) : null;
  let svc = servicesCents;
  if (coveredId) { lines.push({ label: `Membership facial (${PLANS[m.plan].name})`, cents: -CATALOG[coveredId].price_cents }); svc -= CATALOG[coveredId].price_cents; }
  if (b.flash && svc > 0) { const off = Math.round(svc * FLASH_OFF); lines.push({ label: "Flash opening, 10% off", cents: -off }); svc -= off; }
  if (coveredId && svc > 0) { const off = Math.round(svc * EXTRAS_OFF); lines.push({ label: "Member 15% off the rest of the visit", cents: -off }); svc -= off; }
  if (b.referral_code && svc > 0) { const off = Math.min(REFERRAL_OFF_CENTS, svc); lines.push({ label: `A friend's code (${b.referral_code})`, cents: -off }); svc -= off; }

  // products from her shelf, members at their plan's discount
  const live = await memberFor(db, email);
  const rate = live && live.status !== "cancelled" ? PLANS[live.plan]?.retail ?? 0 : 0;
  const products: { id: string; name: string; qty: number; price_cents: number }[] = [];
  let shelf = 0;
  const wanted = (input.products ?? []).filter((p) => p && p.id && Number(p.qty) > 0).slice(0, 12);
  if (wanted.length) {
    const { data: rows } = await db.from("products").select("id, name, brand, price_cents").in("id", wanted.map((p) => String(p.id)));
    for (const p of wanted) {
      const r = (rows ?? []).find((x: any) => x.id === p.id);
      if (!r) continue;
      const qty = Math.min(20, Math.round(Number(p.qty)));
      products.push({ id: r.id, name: `${r.brand ? r.brand + " " : ""}${r.name}`, qty, price_cents: r.price_cents });
      lines.push({ label: `${r.name} × ${qty}`, cents: r.price_cents * qty });
      shelf += r.price_cents * qty;
    }
    if (rate && shelf) { const off = Math.round(shelf * rate); lines.push({ label: `Member ${Math.round(rate * 100)}% off skincare`, cents: -off }); shelf -= off; }
  }

  let due = Math.max(0, svc) + shelf;
  const discount = Math.min(due, Math.max(0, Math.round(Number(input.discount_cents) || 0)));
  if (discount) { lines.push({ label: "Discount", cents: -discount }); due -= discount; }
  const deposit = Math.min(due, b.deposit_cents ?? 0);
  if (deposit) { lines.push({ label: "Deposit, paid when booking", cents: -deposit }); due -= deposit; }

  // a gift certificate: the one used when booking, or one shown at the visit
  let gift: { code: string; cents: number; kind: string } | null = null;
  const code = String(input.gift_code || (b.gift_code && !b.gift_applied_cents ? b.gift_code : "") || "").trim().toUpperCase();
  if (code && due > 0) {
    const { data: g } = await db.from("gift_cards").select("*").eq("code", code).maybeSingle();
    if (g && g.status === "active" && g.balance_cents > 0) {
      const cents = g.kind === "service"
        ? (services.includes(g.service_id) ? Math.min(due, CATALOG[g.service_id]?.price_cents ?? 0) : 0)
        : Math.min(due, g.balance_cents);
      if (cents) { gift = { code, cents, kind: g.kind }; lines.push({ label: `Gift certificate ${code.slice(-4)}`, cents: -cents }); due -= cents; }
    }
  }

  // Glow Points, in blocks of 100 ($10)
  let points = 0;
  if (Number(input.points) > 0 && due > 0) {
    const blocks = Math.min(Math.floor(Number(input.points) / BLOCK_POINTS), Math.floor((await balance(db, email)) / BLOCK_POINTS), Math.floor(due / BLOCK_CENTS));
    points = Math.max(0, blocks) * BLOCK_POINTS;
    if (points) { lines.push({ label: `Glow Points (${points})`, cents: -(points / BLOCK_POINTS) * BLOCK_CENTS }); due -= (points / BLOCK_POINTS) * BLOCK_CENTS; }
  }
  const tip = Math.max(0, Math.min(100000, Math.round(Number(input.tip_cents) || 0)));
  return { services, products, lines, due_cents: due, tip_cents: tip, charge_cents: due + tip, gift, points, member_covered: coveredId ?? null,
    points_balance: await balance(db, email) };
}

/** Records a paid visit and does everything that follows from it. */
export async function completeVisit(db: any, b: any, input: VisitInput, pay: { method: "card" | "cash" | "other" | "link"; charge_id?: string | null; charged_cents?: number }) {
  const q = await quoteVisit(db, b, input);
  const email = norm(b.guest_email);
  const { data: claimed } = await db.from("bookings").update({
    status: "completed", completed_at: new Date().toISOString(), services: q.services,
    balance_paid_cents: q.due_cents, tip_cents: q.tip_cents,
    checkout: { lines: q.lines, products: q.products, method: pay.method, charge_id: pay.charge_id ?? null, gift: q.gift, points: q.points, charged_cents: pay.charged_cents ?? q.charge_cents },
  }).eq("id", b.id).in("status", ["held", "no_show"]).select("*");
  if (!claimed?.length) return { ok: false as const, reason: "status" };

  if (q.products.length) {
    const { error } = await db.rpc("take_stock", { p_items: q.products.map((p) => ({ id: p.id, qty: p.qty })) });
    if (error) console.error("take_stock", error);
  }
  if (q.gift) {
    const { error } = await db.rpc("redeem_gift", { p_code: q.gift.code, p_bill_cents: q.gift.cents, p_where: "studio", p_note: `Visit ${b.id}`, p_booking: b.id });
    if (error) console.error("gift", error);
  }
  if (q.points) await addPoints(db, email, -q.points, "Used at the visit", { booking_id: b.id });
  const got = await earn(db, email, q.due_cents, { label: `Visit · ${names(q.services)}`, booking_id: b.id });

  // their record, and a friend's referral on their first completed visit
  const c = await getContact(db, email);
  if (c) {
    const patch: Record<string, unknown> = { visits: (c.visits ?? 0) + 1 };
    if (!c.last_visit || b.date > c.last_visit) patch.last_visit = b.date;
    if (c.referred_by && !c.referral_credited) {
      const { data: friend } = await db.from("contacts").select("email").eq("ref_code", c.referred_by).maybeSingle();
      if (friend) await addPoints(db, friend.email, REFERRAL_BONUS, `${b.guest_name || "A friend"}'s first visit (your code)`, { booking_id: b.id });
      patch.referral_credited = true;
    }
    await db.from("contacts").update(patch).eq("email", email);
  }

  // the receipt
  const rows = q.lines.map((l) => `<tr><td style="padding:5px 0;border-bottom:1px solid #D7C9B8">${esc(l.label)}</td><td style="padding:5px 0;border-bottom:1px solid #D7C9B8;text-align:right">${l.cents < 0 ? "−" : ""}${money(Math.abs(l.cents))}</td></tr>`).join("");
  const tipRow = q.tip_cents ? `<tr><td style="padding:5px 0">Tip</td><td style="padding:5px 0;text-align:right">${money(q.tip_cents)}</td></tr>` : "";
  const paidWith = pay.method === "card" ? `Charged to ${esc(b.card_label ?? "your card on file")}` : pay.method === "link" ? "Paid on your phone" : pay.method === "cash" ? "Paid in cash" : "Paid at the studio";
  await sendEmail(email, "Your Lumevina receipt", page(`Thank you${b.guest_name ? ", " + String(b.guest_name).split(" ")[0] : ""}.`,
    `<p style="font-size:14px;color:#7D5A44">${esc(fmtWhen(b.date, b.start_min))}</p>` +
    `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}${tipRow}<tr><td style="padding:10px 0;font-weight:700">Total</td><td style="padding:10px 0;font-weight:700;text-align:right">${money(q.charge_cents)}</td></tr></table>` +
    `<p style="font-size:14px">${paidWith}.${got.points ? ` ✦ ${got.points} Glow Points earned.` : ""}</p>`), Deno.env.get("OWNER_EMAIL") ?? undefined);
  return { ok: true as const, quote: q, points: got.points };
}
