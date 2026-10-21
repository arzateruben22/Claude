// Lumevina — Evelyn's business priorities, ranked (Lumevina Studio)
//
// One ranking, read by the dashboard's Today card (functions/studio →
// priorities), the morning push and email (studio-digest), and the hourly
// "still waiting" nudge (client-reminders). PRIORITIES.md is the same list
// in plain words.
//
//   1  right now     a client is waiting on her, or money is at risk: urgent
//                    or medical questions, questions past the promised reply
//                    time, a failed membership payment, an order overdue to
//                    ship, today's clients without a pre-visit form
//   2  today         today's appointments, orders to ship by today, pickups
//                    set aside, questions due today, sold-out products
//   3  this week     running low, members cancelling, the waitlist this week,
//                    suggested chat answers to approve, regulars overdue to rebook
//   4  housekeeping  the shelf count
//
// Each item links to the card on the dashboard that handles it.

// deno-lint-ignore-file no-explicit-any
export type Priority = { tier: 1 | 2 | 3 | 4; kind: string; title: string; body: string; url: string; n: number };

const MEDICAL = new Set(["urgent", "reaction", "medication", "pregnancy", "condition"]);
const DAY = 864e5;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const first = (s: unknown) => String(s ?? "").trim().split(/\s+/)[0] || "a client";
const names = (rows: any[], key = "name", max = 3) => {
  const list = rows.map((r) => first(r[key]));
  return list.length <= max ? list.join(", ") : list.slice(0, max).join(", ") + ` and ${list.length - max} more`;
};
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const clock = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
};
const rows = (q: any): Promise<any[]> => Promise.resolve(q).then((r: any) => r?.data ?? []);

export async function priorities(db: any, now = Date.now()): Promise<Priority[]> {
  const today = dayOf(now), nowIso = new Date(now).toISOString();
  const endOfToday = today + "T23:59:59.999Z";
  const [questions, bookingsToday, intakes, shipments, pickups, products, members, lessons, waitlist, regulars, ahead] = await Promise.all([
    rows(db.from("questions").select("name, kind, due_at, member").eq("status", "waiting")),
    rows(db.from("bookings").select("guest_name, guest_email, start_min").eq("date", today).in("status", ["pending", "held"])),
    rows(db.from("intake_forms").select("email")),
    rows(db.from("shipments").select("name, ship_by").eq("status", "to_ship")),
    rows(db.from("orders").select("name, email, paid_at").eq("status", "paid").eq("delivery", "pickup").gte("paid_at", new Date(now - 7 * DAY).toISOString())),
    rows(db.from("products").select("name, stock, low_at, updated_at").eq("hidden", false).not("stock", "is", null)),
    rows(db.from("memberships").select("name, email, plan, status, billing_failed_at").in("status", ["active", "cancelling"])),
    rows(db.from("learned_answers").select("id").eq("status", "suggested")),
    rows(db.from("waitlist").select("name, date").eq("status", "waiting").gte("date", today).lte("date", dayOf(now + 7 * DAY))),
    rows(db.from("contacts").select("name, email, last_visit, visits").gte("visits", 2).gte("last_visit", dayOf(now - 120 * DAY)).lte("last_visit", dayOf(now - 35 * DAY))),
    rows(db.from("bookings").select("guest_email").gte("date", today).in("status", ["pending", "held"])),
  ]);
  const out: Priority[] = [];
  const add = (tier: 1 | 2 | 3 | 4, kind: string, n: number, title: string, body: string, url: string) => { if (n > 0) out.push({ tier, kind, n, title, body, url }); };
  const Q = "dashboard.html#client-questions";

  // ── 1 right now ──
  const medical = questions.filter((q) => MEDICAL.has(q.kind));
  add(1, "question_medical", medical.length,
    medical.length === 1 ? `${first(medical[0].name)}'s question needs you` : `${medical.length} medical questions need you`,
    "A reaction, medication, pregnancy or a condition: the chat never answers these, and a client may be worried right now.", Q);
  const overdue = questions.filter((q) => !MEDICAL.has(q.kind) && String(q.due_at) < nowIso);
  add(1, "question_overdue", overdue.length, `Past the promised reply time: ${names(overdue)}`,
    "Members hear back within 24 hours, everyone else within 2 days. A short reply now keeps the promise.", Q);
  const failed = members.filter((m) => m.billing_failed_at);
  add(1, "billing_failed", failed.length, `Payment failed: ${names(failed)}`,
    "Their membership card didn't go through. Stripe tries again on its own; a quick message about updating the card in My Lumevina keeps the membership going.", "dashboard.html#members");
  const lateShip = shipments.filter((s) => String(s.ship_by) < today);
  add(1, "ship_overdue", lateShip.length, `Overdue to ship: ${names(lateShip)}`,
    "Promised within two business days of the order. Pack it, buy the label, mark it shipped.", "dashboard.html#shipping");
  const signed = new Set(intakes.map((i) => String(i.email ?? "").toLowerCase()));
  const noForm = bookingsToday.filter((b) => b.guest_email && !signed.has(String(b.guest_email).toLowerCase()));
  add(1, "intake_missing", noForm.length, `Pre-visit form missing today: ${names(noForm, "guest_name")}`,
    "Send them the form link, or take it on the tablet when they arrive, before the treatment starts.", "dashboard.html#appointments");

  // ── 2 today ──
  const sortedToday = [...bookingsToday].sort((a, b) => a.start_min - b.start_min);
  add(2, "appointments_today", sortedToday.length, `${plural(sortedToday.length, "appointment")} today`,
    sortedToday.length ? `First at ${clock(sortedToday[0].start_min)}: ${sortedToday.map((b) => first(b.guest_name)).join(", ")}.` : "", "dashboard.html#appointments");
  const dueShip = shipments.filter((s) => String(s.ship_by) >= today && String(s.ship_by) <= endOfToday);
  add(2, "ship_today", dueShip.length, `${plural(dueShip.length, "order")} to ship by today: ${names(dueShip)}`,
    "Pack, label, mark shipped; the tracking email goes out by itself.", "dashboard.html#shipping");
  add(2, "pickups", pickups.length, `${plural(pickups.length, "pickup")} set aside: ${names(pickups)}`,
    "Paid on the website for pickup at a visit. Have the bag ready with their name on it.", "dashboard.html#shipping");
  const dueToday = questions.filter((q) => !MEDICAL.has(q.kind) && String(q.due_at) >= nowIso && String(q.due_at) <= endOfToday);
  add(2, "question_today", dueToday.length, `${plural(dueToday.length, "question")} to answer today: ${names(dueToday)}`,
    "A reply is drafted for each; check it, make it yours, send.", Q);
  const soldOut = products.filter((p) => Number(p.stock) === 0);
  add(2, "sold_out", soldOut.length, `Sold out: ${soldOut.map((p) => p.name).slice(0, 3).join(", ")}${soldOut.length > 3 ? ` and ${soldOut.length - 3} more` : ""}`,
    "Clients can request these from the shop. Restock, or hide them until you can.", "dashboard.html#inventory");

  // ── 3 this week ──
  const low = products.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= Number(p.low_at ?? 3));
  add(3, "low_stock", low.length, `Running low: ${low.slice(0, 3).map((p) => `${p.name} (${p.stock} left)`).join(", ")}${low.length > 3 ? ` and ${low.length - 3} more` : ""}`,
    "Reorder this week so they don't sell out between visits.", "dashboard.html#inventory");
  const leaving = members.filter((m) => m.status === "cancelling");
  add(3, "members_leaving", leaving.length, `Members leaving: ${names(leaving)}`,
    "A personal message before their last facial keeps more members than any discount.", "dashboard.html#members");
  add(3, "waitlist", waitlist.length, `${plural(waitlist.length, "person", "people")} on the waitlist this week`,
    "When a day opens up, the first in line is emailed by itself; a text from you fills it faster.", "dashboard.html#appointments");
  add(3, "lessons", lessons.length, `${plural(lessons.length, "answer")} to approve for the chat`,
    "Your replies, made general. Approve them and the chat answers that question for everyone.", "dashboard.html#teach");
  const booked = new Set(ahead.map((b) => String(b.guest_email ?? "").toLowerCase()));
  const overdueRebook = regulars.filter((c) => !booked.has(String(c.email).toLowerCase()));
  add(3, "rebook", overdueRebook.length, `${plural(overdueRebook.length, "regular")} haven't rebooked in 5+ weeks: ${names(overdueRebook)}`,
    "The rebook email already went out; a personal text is what brings them back.", "dashboard.html#clients");

  // ── 4 housekeeping ──
  const updated = products.map((p) => String(p.updated_at ?? "")).filter(Boolean).sort().pop();
  const daysSince = updated ? Math.floor((now - Date.parse(updated)) / DAY) : null;
  add(4, "shelf_count", daysSince != null && daysSince >= 30 ? 1 : 0, `Shelf count: last updated ${daysSince} days ago`,
    "A quick count keeps the website's in-stock marks honest.", "dashboard.html#inventory");

  return out.sort((a, b) => a.tier - b.tier);
}

/** The morning push: the first three titles from "right now" and "today". */
export const pushBody = (items: Priority[]) => {
  const top = items.filter((i) => i.tier <= 2).slice(0, 3).map((i) => i.title);
  return top.join(" · ");
};

export const TIER_NAMES: Record<number, string> = { 1: "Right now", 2: "Today", 3: "This week", 4: "Housekeeping" };
