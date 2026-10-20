// Lumevina — Glow Points on the server (the rewards_ledger, keyed by email).
// The same rules as js/rewards.js:
//   1 point per $1 paid (deposits, shop orders, gift certificates, and the
//   rest of the visit when Evelyn checks it out), double on a Wednesday or a
//   Wax Wednesday booking, +25 when a non-member's next visit is within 5
//   weeks of the last, +50 once a year in their birthday month, +100 for a
//   first booking on this website, 150 to a friend whose code brought them.
//   100 points take $10 off; points cover up to half of a deposit.

// deno-lint-ignore-file no-explicit-any
import { getContact, norm, upsertContact } from "./contacts.ts";

export const BLOCK_POINTS = 100, BLOCK_CENTS = 1000;
export const STREAK_DAYS = 35, STREAK_BONUS = 25, BIRTHDAY_BONUS = 50, FIRST_BOOKING_BONUS = 100, REFERRAL_BONUS = 150;

export async function balance(db: any, email: string) {
  const { data } = await db.from("reward_balances").select("points").eq("email", norm(email)).maybeSingle();
  return Number(data?.points ?? 0);
}

export async function addPoints(db: any, email: string, delta: number, label: string, ref: { booking_id?: string; order_id?: string } = {}) {
  if (!delta) return;
  const { error } = await db.from("rewards_ledger").insert({ email: norm(email), delta, label, booking_id: ref.booking_id ?? null, order_id: ref.order_id ?? null });
  if (error) console.error("points", error);
}

const weekday = (date: string) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const daysBetween = (a: string, b: string) => (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5;

/**
 * Points for a payment, written to the ledger. For a booking pass the visit
 * date and services (doubles, the rebooking and birthday bonuses), and
 * firstBooking for the 100 points (once per client). Returns what it earned.
 */
export async function earn(db: any, email: string, cents: number, o: {
  label: string; date?: string; services?: string[]; member?: boolean; firstBooking?: boolean; booking_id?: string; order_id?: string;
}) {
  const c = (await getContact(db, email)) ?? (await upsertContact(db, { email }));
  const base = Math.max(0, Math.round(cents / 100));
  const doubled = !!o.date && (weekday(o.date) === 3 || (o.services ?? []).includes("wax-wednesday"));
  const streak = !!o.date && !o.member && !!c?.last_visit && daysBetween(c.last_visit, o.date) > 0 && daysBetween(c.last_visit, o.date) <= STREAK_DAYS;
  const month = o.date ? Number(o.date.slice(5, 7)) - 1 : -1, year = o.date ? Number(o.date.slice(0, 4)) : 0;
  const birthday = !!o.date && c?.birth_month === month && c?.birthday_claimed_year !== year;
  const first = !!o.firstBooking && !c?.first_booked_at;
  const points = base * (doubled ? 2 : 1) + (streak ? STREAK_BONUS : 0) + (birthday ? BIRTHDAY_BONUS : 0) + (first ? FIRST_BOOKING_BONUS : 0);
  const notes: string[] = [];
  if (doubled) notes.push("double points on a Wednesday");
  if (streak) notes.push(`+${STREAK_BONUS} for rebooking within 5 weeks`);
  if (birthday) notes.push(`+${BIRTHDAY_BONUS} in your birthday month`);
  if (first) notes.push(`+${FIRST_BOOKING_BONUS} for your first booking here`);
  await addPoints(db, email, points, o.label, { booking_id: o.booking_id, order_id: o.order_id });
  const patch: Record<string, unknown> = {};
  if (birthday) patch.birthday_claimed_year = year;
  if (first) patch.first_booked_at = new Date().toISOString();
  if (Object.keys(patch).length) await db.from("contacts").update(patch).eq("email", norm(email));
  return { points, notes, first, birthday, streak };
}
