// Tests for the booking policy on the website's own booking (Nov 17):
//   - a booking can be moved online once
//   - cancelling inside 48 hours (or a Saturday visit) charges the $43 late fee to the card on file, by itself
//   - a card that can't be charged never undoes the cancellation; Evelyn can refund a fee; AUTO_LATE_FEE=off hands it back
//
// It runs the real server code (functions/_shared/bookings.ts and the book and studio-book handlers) under
// Node, with a fake database, a fake Stripe and a fake email service. Nothing real is touched.
//
//   node --import ./server/scripts/test-policy/register.mjs server/scripts/test-booking-policy.mjs   (from lumevina/)

import assert from "node:assert/strict";
import { makeDb, makeNet } from "./test-policy/mock.mjs";

const STUDIO = "test-studio-key-0123456789";   // only a stand-in: the tests never see a real key
const env = { RESEND_API_KEY: "re_test", OWNER_EMAIL: "evelyn@example.com", SITE_URL: "https://example.com", STRIPE_SECRET_KEY: "sk_test_x", STUDIO_KEY: STUDIO };
const handlers = [];
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => handlers.push(fn) };
const net = makeNet();
const quiet = console.error; console.error = () => {};     // the code logs Stripe declines; the tests check them directly

const B = await import("../functions/_shared/bookings.ts");
await import("../functions/book/index.ts");
await import("../functions/studio-book/index.ts");
const [bookHandler, studioHandler] = handlers;

let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.log("  ✗", name, "\n     ", String(e.message ?? e).split("\n").slice(0, 6).join("\n      ")); }
};

// ── dates, in the studio's own zone ──
const LA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const at = (ms) => { const p = Object.fromEntries(LA.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, start_min: Math.floor((+p.hour * 60 + +p.minute) / 30) * 30 }; };
const H = 3600e3;
const weekday = (date) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const dayWhere = (from, to, ok) => { for (let d = from; d <= to; d++) { const s = at(Date.now() + d * 24 * H).date; if (ok(weekday(s))) return s; } throw new Error("no such day"); };
const slots = {
  late: () => at(Date.now() + 20 * H),                                              // tomorrow-ish: inside 48 hours
  past: () => at(Date.now() - 3 * H),
  inTime: () => ({ date: dayWhere(5, 12, (w) => w === 3), start_min: 780 }),         // a Wednesday, 5+ days out
  saturday: () => ({ date: dayWhere(4, 14, (w) => w === 6), start_min: 600 }),       // a Saturday, 4+ days out
  moveTo: () => ({ date: dayWhere(9, 20, (w) => w === 4), start_min: 840 }),         // a Thursday afternoon, 9+ days out
};

let seq = 0;
const booking = (slot, over = {}) => ({
  id: `b${++seq}`, manage_token: String(++seq).padStart(32, "a").replace(/[^0-9a-f]/g, "a"), status: "held",
  guest_email: "client@example.com", guest_name: "Sofia Ramirez", services: ["lumevina-custom-facial"], dur_min: 60,
  paid_cents: 0, deposit_cents: 0, total_cents: 20000, stripe_customer: "cus_1", payment_method: "pm_1", card_label: "Visa •••• 4242",
  membership_id: null, phone: null, sms_ok: false, reschedule_count: 0, google_event_id: null, first_bonus: false, ...slot, ...over,
});
const fresh = (b) => { const db = makeDb({ bookings: [b] }); globalThis.__db = db; net.stripe.length = 0; net.emails.length = 0; net.keys.clear(); net.mode = "ok"; delete env.AUTO_LATE_FEE; return db; };
const row = (db, id) => db.tables.bookings.find((r) => r.id === id);
const call = async (handler, body) => { const r = await handler(new Request("https://x.test/f", { method: "POST", headers: { "x-studio-key": STUDIO }, body: JSON.stringify(body) })); return { status: r.status, j: await r.json() }; };
const alerts = (db) => (db.tables.studio_alerts ?? []).map((a) => `${a.title} | ${a.body}`);

console.log("\nThe move limit");
await test("a booking 5+ days out can be moved; the same booking after one move can't", async () => {
  const b = booking(slots.inTime());
  assert.equal(B.moveBlock(b), null);
  assert.equal(B.moveBlock({ ...b, reschedule_count: 1 }), "limit");
  assert.equal(B.movesLeft(b), 1);
  assert.equal(B.movesLeft({ ...b, reschedule_count: 1 }), 0);
  assert.equal(B.movesLeft({ ...b, reschedule_count: 3 }), 0);
});
await test("the other rules still come first: Saturday, inside 48 hours, not held", async () => {
  assert.equal(B.moveBlock(booking(slots.saturday())), "saturday");
  assert.equal(B.moveBlock(booking(slots.late())), "late");
  assert.equal(B.moveBlock(booking(slots.inTime(), { status: "cancelled" })), "status");
  assert.equal(B.moveBlock(booking(slots.saturday(), { reschedule_count: 1 })), "saturday");
});
await test("the first move goes through and is counted; the second is refused", async () => {
  const b = booking(slots.inTime()); const db = fresh(b); const to = slots.moveTo();
  const first = await call(bookHandler, { action: "reschedule", token: b.manage_token, date: to.date, start_min: to.start_min });
  assert.equal(first.status, 200, JSON.stringify(first.j));
  assert.equal(first.j.booking.moves_left, 0);
  assert.equal(row(db, b.id).reschedule_count, 1);
  assert.equal(row(db, b.id).date, to.date);
  const again = await call(bookHandler, { action: "reschedule", token: b.manage_token, date: slots.inTime().date, start_min: 900 });
  assert.equal(again.status, 409);
  assert.equal(again.j.reason, "limit");
  assert.equal(row(db, b.id).date, to.date, "the second move must not have happened");
  assert.equal(row(db, b.id).reschedule_count, 1);
});
await test("the confirmation after the move says it was the one move", async () => {
  const b = booking(slots.inTime()); fresh(b); const to = slots.moveTo();
  await call(bookHandler, { action: "reschedule", token: b.manage_token, date: to.date, start_min: to.start_min });
  const mail = net.emails.find((e) => e.subject.startsWith("Moved:"));
  assert.ok(mail, "a 'Moved' email went out");
  assert.match(mail.text, /one online move/);
});
await test("two taps at the same moment: one move, one refusal", async () => {
  const b = booking(slots.inTime()); const db = fresh(b); const to = slots.moveTo();
  const [x, y] = await Promise.all([
    call(bookHandler, { action: "reschedule", token: b.manage_token, date: to.date, start_min: to.start_min }),
    call(bookHandler, { action: "reschedule", token: b.manage_token, date: to.date, start_min: 900 }),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409], JSON.stringify([x.j, y.j]));
  assert.equal(row(db, b.id).reschedule_count, 1);
});
await test("a Saturday booking and a booking inside 48 hours are refused with their own reason", async () => {
  const s = booking(slots.saturday()); fresh(s);
  assert.equal((await call(bookHandler, { action: "reschedule", token: s.manage_token, ...slots.moveTo() })).j.reason, "saturday");
  const l = booking(slots.late()); fresh(l);
  assert.equal((await call(bookHandler, { action: "reschedule", token: l.manage_token, ...slots.moveTo() })).j.reason, "late");
});
await test("what the booking page is told: moves left, the late fee", async () => {
  const b = booking(slots.inTime()); fresh(b);
  const v = (await call(bookHandler, { action: "get", token: b.manage_token })).j.booking;
  assert.equal(v.moves_left, 1); assert.equal(v.late_fee_cents, 4300); assert.equal(v.free_change, true);
});

console.log("\nThe late fee");
await test("cancelling inside 48 hours charges $43 to the card on file, by itself", async () => {
  const b = booking(slots.late(), { paid_cents: 5000 }); const db = fresh(b);
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.kind, "late");
  assert.deepEqual(r.j.fee, { ok: true, cents: 4300, card: "Visa •••• 4242" });
  assert.equal(net.stripe.length, 1);
  assert.equal(net.stripe[0].amount, 4300); assert.equal(net.stripe[0].off_session, "true");
  assert.equal(net.stripe[0].customer, "cus_1"); assert.equal(net.stripe[0].pm, "pm_1");
  const saved = row(db, b.id);
  assert.equal(saved.status, "cancelled"); assert.equal(saved.cancel_kind, "late");
  assert.equal(saved.fee_cents, 4300); assert.equal(saved.fee_kind, "late_cancel"); assert.equal(saved.fee_charge, "pi_1");
});
await test("the client's email says the fee was charged; Evelyn's alert says it was automatic", async () => {
  const b = booking(slots.late(), { paid_cents: 5000 }); const db = fresh(b);
  await call(bookHandler, { action: "cancel", token: b.manage_token });
  const mail = net.emails.find((e) => e.subject.includes("is cancelled"));
  assert.match(mail.text, /\$43 late-cancellation fee was charged to Visa •••• 4242/);
  assert.match(mail.text, /\$50 deposit is kept/);
  assert.match(alerts(db).join("\n"), /Late cancellation: Sofia Ramirez \|.*\$43 late fee was charged to Visa •••• 4242 automatically/);
});
await test("a Saturday visit cancelled days ahead is charged too", async () => {
  const b = booking(slots.saturday()); const db = fresh(b);
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.j.kind, "late"); assert.equal(r.j.fee.ok, true);
  assert.equal(row(db, b.id).fee_cents, 4300);
});
await test("cancelling 48+ hours ahead (not a Saturday) is free: no charge, no fee", async () => {
  const b = booking(slots.inTime(), { paid_cents: 5000 }); const db = fresh(b);
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.j.kind, "in_time"); assert.equal(r.j.fee, null);
  assert.equal(net.stripe.length, 0, "nothing was charged");
  assert.equal(row(db, b.id).fee_cents, undefined);
});
await test("no card on file: it still cancels, nothing is charged, Evelyn is told to follow up", async () => {
  const b = booking(slots.late(), { stripe_customer: null, payment_method: null, card_label: null }); const db = fresh(b);
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.status, 200); assert.equal(r.j.booking.status, "cancelled");
  assert.deepEqual(r.j.fee, { ok: false, reason: "no_card" });
  assert.equal(net.stripe.length, 0);
  assert.match(alerts(db).join("\n"), /couldn't be charged \(no card on file\)/);
  assert.match(net.emails.find((e) => e.subject.includes("is cancelled")).text, /couldn't charge it to your card on file, so Evelyn will be in touch/);
});
await test("a declined card: it still cancels, the booking records no fee, Evelyn is told", async () => {
  const b = booking(slots.late()); const db = fresh(b); net.mode = "decline";
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.status, 200); assert.equal(r.j.booking.status, "cancelled");
  assert.deepEqual(r.j.fee, { ok: false, reason: "insufficient_funds" });
  assert.equal(row(db, b.id).fee_cents, undefined);
  assert.match(alerts(db).join("\n"), /couldn't be charged \(insufficient_funds\): send a pay link/);
});
await test("AUTO_LATE_FEE=off hands the fee back to Evelyn's button", async () => {
  const b = booking(slots.late()); const db = fresh(b); env.AUTO_LATE_FEE = "off";
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.j.kind, "late"); assert.equal(r.j.fee, null);
  assert.equal(net.stripe.length, 0);
  assert.match(alerts(db).join("\n"), /You can charge the \$43 late fee from Appointments/);
  delete env.AUTO_LATE_FEE;
});
await test("Evelyn cancelling inside 48 hours never charges a fee", async () => {
  const b = booking(slots.late(), { paid_cents: 0 }); const db = fresh(b);
  const r = await B.cancelBooking(db, b, "evelyn", { refund: false });
  assert.equal(r.ok, true); assert.equal(r.kind, "evelyn"); assert.equal(r.fee, null);
  assert.equal(net.stripe.length, 0);
});
await test("once the appointment time has passed it can't be cancelled online (that's a no-show)", async () => {
  const b = booking(slots.past()); const db = fresh(b);
  const r = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(r.status, 409); assert.equal(r.j.reason, "past");
  assert.equal(row(db, b.id).status, "held"); assert.equal(net.stripe.length, 0);
});
await test("a booking already cancelled isn't cancelled or charged again", async () => {
  const b = booking(slots.late()); const db = fresh(b);
  await call(bookHandler, { action: "cancel", token: b.manage_token });
  const second = await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(second.status, 409); assert.equal(second.j.reason, "status");
  assert.equal(net.stripe.filter((s) => s.kind === "charge").length, 1);
});
await test("a repeat of the same automatic charge is the same Stripe payment (no double charge)", async () => {
  const b = booking(slots.late()); const db = fresh(b);
  const one = await B.chargeFee(db, b, "late_cancel", 4300, "auto");
  const two = await B.chargeFee(db, { ...b, fee_cents: null }, "late_cancel", 4300, "auto");   // a stale copy of the row
  assert.equal(one.ok && two.ok, true); assert.equal(one.charge, two.charge);
  assert.equal(net.stripe.filter((s) => s.kind === "charge").length, 1);
});
await test("a member's late cancellation: the fee goes to the card their membership bills; the facial is not handed back", async () => {
  const b = booking(slots.late(), { stripe_customer: null, payment_method: null, card_label: null, membership_id: "m1" });
  const db = makeDb({ bookings: [b], memberships: [{ id: "m1", credits: 0, email: "client@example.com", status: "active", plan: "glow", stripe_customer_id: "cus_m", payment_method: "pm_m", card_label: "Amex •••• 1005" }] });
  globalThis.__db = db; net.stripe.length = 0; net.emails.length = 0; net.keys.clear(); net.mode = "ok";
  const r = await B.cancelBooking(db, b, "client");
  assert.equal(r.kind, "late");
  assert.equal(r.fee.ok, true, JSON.stringify(r.fee));
  assert.equal(net.stripe[0].customer, "cus_m"); assert.equal(net.stripe[0].pm, "pm_m");
  assert.equal(r.fee.card, "Amex •••• 1005");
  assert.equal(db.tables.memberships[0].credits, 0, "a late cancellation doesn't give the facial back");
});
await test("a member's cancellation 48+ hours ahead hands the facial back and charges nothing", async () => {
  const b = booking(slots.inTime(), { membership_id: "m1" });
  const db = makeDb({ bookings: [b], memberships: [{ id: "m1", credits: 0, email: "client@example.com", status: "active", plan: "glow" }], membership_ledger: [] });
  globalThis.__db = db; net.stripe.length = 0; net.keys.clear();
  const r = await B.cancelBooking(db, b, "client");
  assert.equal(r.kind, "in_time"); assert.equal(r.fee, null);
  assert.equal(db.tables.memberships[0].credits, 1); assert.equal(net.stripe.length, 0);
});

console.log("\nEvelyn's side");
await test("she can still charge a no-show fee, and a late fee when automatic charging is off", async () => {
  const b = booking(slots.late(), { status: "cancelled", cancel_kind: "late" }); const db = fresh(b); env.AUTO_LATE_FEE = "off";
  const r = await call(studioHandler, { action: "fee", id: b.id, kind: "late_cancel" });
  assert.equal(r.status, 200, JSON.stringify(r.j)); assert.equal(r.j.cents, 4300);
  assert.equal(row(db, b.id).fee_cents, 4300); assert.ok(row(db, b.id).fee_charge);
  const dup = await call(studioHandler, { action: "fee", id: b.id, kind: "late_cancel" });
  assert.equal(dup.status, 409); assert.equal(dup.j.reason, "already");
  delete env.AUTO_LATE_FEE;
});
await test("she can refund an automatic fee: the money goes back, the booking is marked, it can't be charged again", async () => {
  const b = booking(slots.late()); const db = fresh(b);
  await call(bookHandler, { action: "cancel", token: b.manage_token });
  assert.equal(row(db, b.id).fee_cents, 4300);
  net.emails.length = 0;
  const w = await call(studioHandler, { action: "waive_fee", id: b.id });
  assert.equal(w.status, 200, JSON.stringify(w.j));
  assert.deepEqual(net.stripe.filter((s) => s.kind === "refund").map((s) => s.payment_intent), [row(db, b.id).fee_charge], "the refund is for the payment that was charged");
  assert.ok(row(db, b.id).fee_waived_at);
  assert.match(net.emails[0].text, /refunded the \$43 late-cancellation fee/);
  assert.equal((await call(studioHandler, { action: "waive_fee", id: b.id })).j.reason, "already", "no second refund");
  const again = await call(studioHandler, { action: "fee", id: b.id, kind: "late_cancel" });
  assert.equal(again.j.reason, "already", "a refunded fee is never charged again");
  assert.equal(net.stripe.filter((s) => s.kind === "charge").length, 1);
});
await test("refunding a booking that has no fee does nothing", async () => {
  const b = booking(slots.inTime()); fresh(b);
  const w = await call(studioHandler, { action: "waive_fee", id: b.id });
  assert.equal(w.status, 409); assert.equal(w.j.reason, "no_fee");
  assert.equal(net.stripe.length, 0);
});

console.error = quiet;
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
