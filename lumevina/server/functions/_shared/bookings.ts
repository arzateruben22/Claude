// Lumevina — appointments on the server (v3): pricing a visit, confirming it
// once the card is on file, cancelling and moving it under her policy, the
// waitlist, and the emails and texts that go with each step. Used by
// functions/book (clients), functions/studio-book (Evelyn), stripe-webhook
// and client-reminders.
//
// Her policy, as the website states it:
//   - Cancel or move at least 48 hours ahead with the link in the email: the
//     deposit carries to a new date in the same month.
//   - Later than that, the deposit is kept and Evelyn may charge the $43
//     late-cancellation fee to the card on file (dashboard → Appointments).
//   - Saturdays can't be moved, and cancelling one keeps the deposit.
//   - Every booking holds a card on file (members: the one their
//     membership bills); nothing is charged to it unless she checks out the
//     visit with it, or charges a late-cancel or no-show fee.

// deno-lint-ignore-file no-explicit-any
import { CATALOG } from "./catalog.ts";
import { addBooking, removeBooking } from "./google.ts";
import { esc, money, page, sendEmail } from "./mail.ts";
import { notifyOwner } from "./notify.ts";
import { sendSMS } from "./sms.ts";
import { getContact, norm, upsertContact } from "./contacts.ts";
import { addPoints, earn } from "./points.ts";
import { BANK_CAP, EXTRAS_OFF, covers, isLive, memberFor, PLANS } from "./membership.ts";
import { stripe } from "./stripe.ts";

export const TZ = "America/Los_Angeles";
export const LATE_FEE_CENTS = 4300;
/** Her policy: a no-show is charged 50% of the service; a deposit already kept counts toward it. */
export const noShowFeeCents = (b: { services: string[]; paid_cents?: number | null }) =>
  Math.max(0, Math.round((b.services ?? []).reduce((a, id) => a + (CATALOG[id]?.price_cents ?? 0), 0) * 0.5) - (b.paid_cents ?? 0));
export const CANCEL_HOURS = 48;
const FLASH_OFF = 0.10;
const REFERRAL_OFF_CENTS = 1500;

export const site = () => (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
export const manageUrl = (b: { manage_token: string }) => `${site()}/?manage=${b.manage_token}`;
export const names = (ids: string[]) => ids.map((id) => CATALOG[id]?.name ?? id).join(" + ");

// ── time, in the studio's own zone ──
const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const zoneMinutes = (d: Date) => {
  const p = Object.fromEntries(parts.formatToParts(d).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) / 6e4;
};
/** The moment a local date and minutes-after-midnight happen. */
export function laInstant(date: string, min: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, min);
  const off = zoneMinutes(new Date(guess)) - guess / 6e4;            // minutes the zone is ahead of UTC (negative here)
  const t = new Date(guess - off * 6e4);
  const off2 = zoneMinutes(t) - t.getTime() / 6e4;                   // across a daylight-saving change
  return off2 === off ? t : new Date(guess - off2 * 6e4);
}
export const hoursUntil = (date: string, min: number) => (laInstant(date, min).getTime() - Date.now()) / 36e5;
export const isSaturday = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6; };
export const fmtTime = (min: number) => `${(Math.floor(min / 60) % 12) || 12}:${String(min % 60).padStart(2, "0")} ${min >= 720 ? "PM" : "AM"}`;
export const fmtWhen = (date: string, min: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  return `${day} at ${fmtTime(min)}`;
};
const monthEnd = (date: string) => { const [y, m] = date.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

// ── pricing ──
export type Priced = {
  ok: true; services: string[]; dur_min: number; list_cents: number; total_cents: number; deposit_cents: number;
  flash: boolean; referral: string | null; member: any | null; covered: string | null; covered_cents: number; extras_off_cents: number;
} | { ok: false; reason: string };

/**
 * What a visit costs, from the server's own menu. A member's facial (signed
 * in) is covered by their membership, with 15% off the rest of the visit and
 * no deposit. A flash opening is 10% off; a friend's code $15 off a first visit.
 */
export async function priceVisit(db: any, o: { services: string[]; date: string; start: number; email: string; signedIn: boolean; flash?: boolean; refCode?: string; useMember?: boolean }): Promise<Priced> {
  const services = o.services.filter((id, i) => o.services.indexOf(id) === i).slice(0, 6);
  if (!services.length) return { ok: false, reason: "services" };
  let list = 0, dur = 0, deposit = 0;
  for (const id of services) {
    const s = CATALOG[id];
    if (!s || !s.offered) return { ok: false, reason: "services" };
    list += s.price_cents; dur += s.dur_min; deposit += s.deposit_cents;
  }
  dur = Math.max(30, Math.ceil(dur / 30) * 30);

  // a member's facial: only when they're signed in, so nobody spends someone else's
  const m = o.signedIn && o.useMember !== false ? await memberFor(db, o.email) : null;
  const coveredId = m && m.credits > 0 ? services.find((id) => covers(m, id)) ?? null : null;
  const covered = coveredId ? CATALOG[coveredId].price_cents : 0;
  let total = list - covered;

  let flash = false;
  if (o.flash) {
    const { data: fs } = await db.from("flash_slots").select("start_min, claimed_by").eq("date", o.date).maybeSingle();
    flash = !!fs && fs.start_min === o.start && !fs.claimed_by;
    if (flash) total -= Math.round(total * FLASH_OFF);
  }
  const extras = coveredId ? Math.round(total * EXTRAS_OFF) : 0;
  total -= extras;

  let referral: string | null = null;
  const code = String(o.refCode ?? "").trim().toUpperCase();
  if (/^GLOW-[A-Z0-9]{4}$/.test(code)) {
    const { data: owner } = await db.from("contacts").select("email").eq("ref_code", code).maybeSingle();
    const { count } = await db.from("bookings").select("id", { count: "exact", head: true })
      .eq("guest_email", norm(o.email)).in("status", ["held", "completed", "no_show"]);
    if (owner && owner.email !== norm(o.email) && !count) { referral = code; total -= Math.min(REFERRAL_OFF_CENTS, total); }
  }
  total = Math.max(0, total);
  const memberNow = isLive(m) && o.signedIn;
  return {
    ok: true, services, dur_min: dur, list_cents: list, total_cents: total,
    deposit_cents: memberNow ? 0 : Math.min(deposit, total),
    flash, referral, member: m, covered: coveredId, covered_cents: covered, extras_off_cents: extras,
  };
}

// ── confirming ──
/**
 * The card is on file (or a member's facial needs none): the booking is
 * held. Uses the membership facial, spends any points and gift, earns points
 * on the deposit (and the first-booking 100), writes it into her calendar,
 * sends the confirmation and tells Evelyn. Safe to run twice.
 */
export async function confirmBooking(db: any, bookingId: string, pay: { customer?: string | null; payment_method?: string | null; card_label?: string | null; paid_cents?: number; payment_intent?: string | null } = {}, opts: { firstBooking?: boolean; quiet?: boolean } = {}) {
  const { data: claimed } = await db.from("bookings").update({
    status: "held",
    stripe_customer: pay.customer ?? null, payment_method: pay.payment_method ?? null, card_label: pay.card_label || null,
    paid_cents: pay.paid_cents ?? 0, stripe_payment_intent: pay.payment_intent ?? null,
  }).eq("id", bookingId).eq("status", "pending").select("*");
  const b = claimed?.[0];
  if (!b) return { ok: false as const, reason: "already" };
  const email = norm(b.guest_email);

  // keep the card for next time
  const c = await upsertContact(db, { email, name: b.guest_name, phone: b.phone, sms_ok: b.sms_ok });
  const patch: Record<string, unknown> = {};
  if (pay.customer && pay.payment_method) Object.assign(patch, { stripe_customer: pay.customer, payment_method: pay.payment_method, card_label: pay.card_label || null });
  if (b.referral_code && c && !c.referred_by) patch.referred_by = b.referral_code;
  // a deposit carried over from a cancelled booking is used up
  if (b.credit_applied_cents > 0 && c) {
    const left = Math.max(0, (c.deposit_credit_cents ?? 0) - b.credit_applied_cents);
    Object.assign(patch, { deposit_credit_cents: left, deposit_credit_until: left ? c.deposit_credit_until : null });
  }
  if (Object.keys(patch).length) await db.from("contacts").update(patch).eq("email", email);

  // the membership facial
  if (b.membership_id) {
    const { data: m } = await db.from("memberships").select("*").eq("id", b.membership_id).maybeSingle();
    if (m && m.credits > 0) {
      await db.from("memberships").update({ credits: m.credits - 1 }).eq("id", m.id);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "used", booking_id: b.id });
      if (m.on_hold && m.credits - 1 < BANK_CAP) await resumeBilling(db, m);
    }
  }
  // a gift certificate applied when booking
  if (b.gift_code && b.gift_applied_cents > 0) {
    const { error } = await db.rpc("redeem_gift", { p_code: b.gift_code, p_bill_cents: b.gift_applied_cents, p_where: "online", p_note: `Booking ${b.id}`, p_booking: b.id });
    if (error) console.error("gift", error);
  }
  // points: what they spent, then what the deposit earns
  if (b.points_redeemed > 0) await addPoints(db, email, -b.points_redeemed, "Used on a deposit", { booking_id: b.id });
  const got = await earn(db, email, b.paid_cents ?? 0, {
    label: `Booking · ${names(b.services)}`, date: b.date, services: b.services, member: !!b.membership_id, firstBooking: opts.firstBooking !== false, booking_id: b.id,
  });
  await db.from("bookings").update({ points_earned: got.points, prev_last_visit: c?.last_visit ?? null, first_bonus: got.first }).eq("id", b.id);
  if (b.flash) await db.from("flash_slots").update({ claimed_by: b.id }).eq("date", b.date);
  await db.from("waitlist").update({ status: "booked" }).eq("email", email).eq("date", b.date).in("status", ["waiting", "offered"]);

  // her calendar (GlossGenius reads it), never blocking the rest
  try {
    const eventId = await addBooking({ id: b.id, date: b.date, start_min: b.start_min, dur_min: b.dur_min,
      title: `${names(b.services)} · ${b.guest_name || email}`, note: [b.phone, b.note].filter(Boolean).join("\n") });
    if (eventId) await db.from("bookings").update({ google_event_id: eventId }).eq("id", b.id);
  } catch (e) { console.error("google", String(e)); }

  const full = { ...b, points_earned: got.points };
  await sendBookingMessage(db, full, "confirmed", { points: got });
  if (!opts.quiet) await notifyOwner(db, {
    kind: "booking", url: "dashboard.html#appointments",
    title: `New booking: ${b.guest_name || email}`,
    body: `${names(b.services)}, ${fmtWhen(b.date, b.start_min)}.` + (b.membership_id ? " Membership facial." : b.paid_cents ? ` Deposit ${money(b.paid_cents)}.` : "") + (b.note ? `\n“${b.note}”` : ""),
  }).catch((e) => console.error("notify", e));
  return { ok: true as const, booking: full, points: got };
}

/** Billing picks up again once a member with two facials waiting books one. */
export async function resumeBilling(db: any, m: any) {
  if (m.stripe_subscription_id) await stripe(`subscriptions/${m.stripe_subscription_id}`, { pause_collection: "" });
  await db.from("memberships").update({ on_hold: false }).eq("id", m.id);
}

// ── cancelling ──
/**
 * Cancels a booking. In time (48 hours or more, not a Saturday): the deposit
 * carries to a new date that month, a membership facial comes back. Late:
 * the deposit is kept and Evelyn decides on the fee. Evelyn cancelling
 * refunds the deposit. Frees the time, hands back the points it earned (the
 * database trigger), and offers the day to the waitlist.
 */
export async function cancelBooking(db: any, b: any, by: "client" | "evelyn", o: { refund?: boolean } = {}) {
  if (!["pending", "held"].includes(b.status)) return { ok: false as const, reason: "status" };
  const late = by === "client" && (hoursUntil(b.date, b.start_min) < CANCEL_HOURS || isSaturday(b.date));
  const kind = by === "evelyn" ? "evelyn" : late ? "late" : "in_time";
  const { data: done } = await db.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_kind: b.status === "pending" ? null : kind })
    .eq("id", b.id).in("status", ["pending", "held"]).select("*");
  if (!done?.length) return { ok: false as const, reason: "status" };
  if (b.status === "pending") return { ok: true as const, kind: null };   // an unfinished checkout: nothing else happened yet

  const email = norm(b.guest_email);
  // the database hands back the points it earned; the first-booking 100 can be earned again
  if (b.first_bonus) await db.from("contacts").update({ first_booked_at: null }).eq("email", email);
  // the membership facial comes back unless it's a late cancellation
  if (b.membership_id && kind !== "late") {
    const { data: m } = await db.from("memberships").select("*").eq("id", b.membership_id).maybeSingle();
    if (m) {
      await db.from("memberships").update({ credits: m.credits + 1 }).eq("id", m.id);
      await db.from("membership_ledger").insert({ membership_id: m.id, kind: "returned", booking_id: b.id });
    }
  }
  // the deposit: carried over (in time), refunded (Evelyn cancelled, if she chooses), or kept (late)
  let refunded = false;
  if (kind === "in_time" && b.paid_cents > 0) {
    const c = await getContact(db, email);
    await db.from("contacts").update({ deposit_credit_cents: (c?.deposit_credit_cents ?? 0) + b.paid_cents, deposit_credit_until: monthEnd(b.date) }).eq("email", email);
  }
  if (kind === "evelyn" && o.refund !== false && b.paid_cents > 0 && b.stripe_payment_intent) {
    refunded = (await stripe("refunds", { payment_intent: b.stripe_payment_intent, metadata: { booking_id: b.id } }, { idempotency: `refund-${b.id}` })).ok;
  }
  if (b.google_event_id) await removeBooking(b.google_event_id).catch((e) => console.error("google", String(e)));
  await sendBookingMessage(db, b, "cancelled", { kind, refunded });
  if (by === "client") {
    await notifyOwner(db, { kind: "cancel", url: "dashboard.html#appointments",
      title: `${late ? "Late cancellation" : "Cancelled"}: ${b.guest_name || email}`,
      body: `${names(b.services)}, ${fmtWhen(b.date, b.start_min)}.` + (late ? (b.payment_method ? " You can charge the $43 late fee from Appointments." : " No card on file for a fee.") : "") }).catch(() => {});
  }
  await offerWaitlist(db, b.date, b);
  return { ok: true as const, kind, refunded };
}

/** A time opened up: everyone waiting on that day hears about it (first to book gets it). */
export async function offerWaitlist(db: any, date: string, freed?: { start_min: number }) {
  if (hoursUntil(date, freed?.start_min ?? 720) < 2) return 0;
  const { data: list } = await db.from("waitlist").select("*").eq("date", date).eq("status", "waiting").limit(25);
  let sent = 0;
  for (const w of list ?? []) {
    const when = freed ? fmtWhen(date, freed.start_min) : fmtWhen(date, 720).replace(/ at .*/, "");
    const link = `${site()}/?book=${encodeURIComponent((w.services ?? [])[0] ?? "")}&day=${date}#book`;
    const ok = await sendEmail(w.email, "A time just opened at Lumevina", page(`A time opened, ${esc(String(w.name).split(" ")[0])}`,
      `<p style="font-size:15px;line-height:1.55">Someone cancelled, and ${esc(when)} is open now. The first to book it gets it.</p>` +
      `<p style="margin:20px 0"><a href="${esc(link)}" style="background:#161412;color:#F5F1EA;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">See the time and book</a></p>`));
    if (w.sms_ok && w.phone) await sendSMS(w.phone, `Lumevina: a time opened on ${when}. First to book gets it: ${link}`);
    if (ok) sent++;
    await db.from("waitlist").update({ status: "offered", offered_at: new Date().toISOString() }).eq("id", w.id);
  }
  return sent;
}

// ── the messages ──
const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#7D5A44;font-size:13px;width:38%">${esc(k)}</td><td style="padding:6px 0;font-size:15px">${v}</td></tr>`;
const button = (href: string, label: string) =>
  `<p style="margin:22px 0 8px"><a href="${esc(href)}" style="background:#161412;color:#F5F1EA;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${esc(label)}</a></p>`;

export async function sendBookingMessage(db: any, b: any, kind: "confirmed" | "reminder" | "cancelled" | "moved" | "card", extra: any = {}) {
  const email = norm(b.guest_email);
  if (!email) return false;
  const first = String(b.guest_name ?? "").split(" ")[0];
  const when = fmtWhen(b.date, b.start_min);
  const svc = names(b.services);
  const address = Deno.env.get("STUDIO_ADDRESS") ?? "";
  const { data: form } = await db.from("intake_forms").select("email").eq("email", email).maybeSingle();
  const details = `<table style="width:100%;border-collapse:collapse;margin:8px 0 4px">` +
    row("When", esc(when)) + row("Treatment", esc(svc)) +
    row("Where", esc(address || "Lumevina Aesthetics Spa, Woodland Hills") + (address ? "" : "<br><span style=\"font-size:13px;color:#7D5A44\">The address is in your booking text from Evelyn.</span>")) +
    (b.membership_id ? row("Paid", "Your membership facial") : b.paid_cents ? row("Deposit paid", esc(money(b.paid_cents)) + " (it goes toward your total)") : "") +
    (b.card_label ? row("Card on file", esc(b.card_label) + "<br><span style=\"font-size:13px;color:#7D5A44\">Nothing is charged to it unless you choose to pay with it, or for a late cancellation or no-show.</span>") : "") +
    `</table>`;
  const manage = button(manageUrl(b), "Cancel or move it");
  const policy = `<p style="font-size:13px;line-height:1.5;color:#7D5A44">Change or cancel at least 48 hours ahead and your deposit moves with you to a new date that month. Later than that, the deposit is kept and a $43 fee may apply; a missed appointment is charged 50% of the service. Saturdays can't be moved. There's a 10-minute grace period if you're running late.</p>`;
  const arrive = `<p style="font-size:14px;line-height:1.5">Free parking in the lot. When you arrive, wait in your car and text Evelyn before coming up.</p>`;
  const formLine = form ? "" : `<p style="font-size:14px;line-height:1.5">Please fill in your pre-visit form before you come: <a href="${esc(site())}/?intake=1" style="color:#161412">open it here</a> (two minutes).</p>`;
  let subject = "", title = "", body = "", sms = "";
  if (kind === "confirmed") {
    const pts = extra.points?.points ? `<p style="font-size:14px;color:#7D5A44">✦ ${extra.points.points} Glow Points earned${extra.points.first ? ", including 100 for your first booking here" : ""}. The rest of your visit earns more when you check out.</p>` : "";
    subject = `You're booked: ${svc}`;
    title = `You're booked${first ? ", " + first : ""}.`;
    body = details + pts + formLine + arrive + manage + policy;
    sms = `Lumevina: you're booked for ${svc}, ${when}. Change it up to 48h before: ${manageUrl(b)} Reply STOP to stop texts.`;
  } else if (kind === "reminder") {
    subject = `See you ${when.replace(/,.*? at /, " at ")}`;
    title = `See you soon${first ? ", " + first : ""}.`;
    body = details + formLine + `<p style="font-size:14px;line-height:1.5">Before a facial: no retinol for 5 to 7 days, no exfoliating acids for 2 to 3 days, and no waxing or shaving your face for 2 days.</p>` + arrive + manage + policy;
    sms = `Lumevina reminder: ${svc} ${when}. Need to change it? ${manageUrl(b)}`;
  } else if (kind === "cancelled") {
    subject = "Your Lumevina appointment is cancelled";
    title = "Your appointment is cancelled.";
    const deposit = !b.paid_cents ? "" : extra.kind === "in_time" ? `Your ${money(b.paid_cents)} deposit carries over to a new date this month: it comes off automatically when you book with this email.`
      : extra.kind === "late" ? `It was within 48 hours (or a Saturday), so the ${money(b.paid_cents)} deposit is kept, as the policy says.`
      : extra.refunded ? `Evelyn cancelled this one, so your ${money(b.paid_cents)} deposit is refunded to your card (it shows in a few days).` : "";
    body = `<p style="font-size:15px;line-height:1.55">${esc(svc)}, ${esc(when)}.</p>` + (deposit ? `<p style="font-size:15px;line-height:1.55">${deposit}</p>` : "") +
      (b.membership_id && extra.kind !== "late" ? `<p style="font-size:15px;line-height:1.55">Your membership facial is back on your account.</p>` : "") +
      button(`${site()}/#book`, "Book another time");
    sms = `Lumevina: your ${when} appointment is cancelled.`;
  } else if (kind === "moved") {
    subject = `Moved: ${svc}, ${when}`;
    title = "Your appointment moved.";
    body = `<p style="font-size:15px;line-height:1.55">It's now ${esc(when)}.${extra.from ? ` (It was ${esc(extra.from)}.)` : ""}</p>` + details + manage + policy;
    sms = `Lumevina: your appointment moved to ${when}.`;
  } else {
    subject = "One step to hold your Lumevina appointment";
    title = `Almost done${first ? ", " + first : ""}.`;
    body = `<p style="font-size:15px;line-height:1.55">Evelyn booked ${esc(svc)} for you, ${esc(when)}. Every appointment holds a card on file; nothing is charged to it now.</p>` +
      button(extra.url, "Add my card") + details + policy;
  }
  const ok = await sendEmail(email, subject, page(title, body), Deno.env.get("OWNER_EMAIL") ?? undefined);
  if (sms && b.sms_ok && b.phone && kind !== "reminder") await sendSMS(b.phone, sms);
  return ok;
}

/** The plan's facial covered by a member's booking, and their retail rate, for checkout. */
export const planOf = (m: any) => (m ? PLANS[m.plan] ?? null : null);
