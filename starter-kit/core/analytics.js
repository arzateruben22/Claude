/* Analytics — pure functions that turn raw records into dashboard metrics.
 * No DOM, no charts: each returns plain numbers/arrays you render however you
 * like. Feed them bookings, clients, gift cards, and retail sales.
 *
 * Shapes:
 *   booking = { date, start, dur, services:[id], total, paid, deposit, source, name, email }
 *   client  = { name, email, visits:[booking], spent }
 *   sale    = { id, name, price, qty, at, channel }
 */

const num = (n) => Number(n || 0);
const monthOf = (dateStr) => (dateStr || "").slice(0, 7);

/* Group flat bookings into client records keyed by email (or name). */
export function buildClients(bookings = []) {
  const byKey = {};
  bookings.forEach((b) => {
    const k = (b.email || b.name || "").toLowerCase(); if (!k) return;
    const c = byKey[k] || (byKey[k] = { name: b.name || b.email, email: b.email || "", visits: [], spent: 0 });
    c.visits.push(b); c.spent += num(b.paid || b.deposit); if (b.name) c.name = b.name;
  });
  return Object.values(byKey);
}

/* New vs returning (2+ visits) retention cohort. */
export function retention(clients = []) {
  const total = clients.length;
  const returned = clients.filter((c) => (c.visits || []).length >= 2).length;
  return { total, returned, firstTime: total - returned, rate: total ? Math.round(returned / total * 100) : 0 };
}

/* Ranked most-booked services: [{ id, count }]. */
export function mostBooked(bookings = [], limit = 6) {
  const counts = {};
  bookings.forEach((b) => (b.services || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
  return Object.entries(counts).map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count).slice(0, limit);
}

/* App vs web (or any `source`) split. */
export function sourceSplit(bookings = []) {
  const s = {};
  bookings.forEach((b) => { const k = b.source || "web"; s[k] = (s[k] || 0) + 1; });
  return s;
}

/* Income bookkeeping rows + totals (processing fee configurable). */
export function bookkeeping(bookings = [], { pct = 0.029, flat = 0.30 } = {}) {
  const rows = bookings.map((b) => {
    const collected = num(b.paid || b.deposit);
    const total = num(b.total || (b.deposit ? b.deposit * 2 : 0) || collected * 2);
    const fee = collected > 0 ? +(collected * pct + flat).toFixed(2) : 0;
    return { date: b.date, total, collected, fee, net: +(collected - fee).toFixed(2), balance: +(total - collected).toFixed(2) };
  });
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return { rows, totals: { booked: sum("total"), collected: sum("collected"), fees: sum("fee"), net: sum("net") } };
}

/* Gift-certificate liability + rollup. */
export function giftLiability(cards = []) {
  const sold = cards.reduce((a, c) => a + num(c.amount), 0);
  const outstanding = cards.reduce((a, c) => a + num(c.balance), 0);
  return { sold, outstanding, redeemed: sold - outstanding, active: cards.filter((c) => num(c.balance) > 0).length };
}

/* Retail sales: revenue, units, % online, and top sellers. */
export function retailSales(sales = [], month = null) {
  const rows = month ? sales.filter((s) => monthOf(s.at) === month) : sales;
  const byProduct = {}; let units = 0, revenue = 0, online = 0;
  rows.forEach((s) => {
    const q = num(s.qty), rev = num(s.price) * q;
    units += q; revenue += rev; if (s.channel === "online") online += q;
    const p = byProduct[s.id] || (byProduct[s.id] = { id: s.id, name: s.name, units: 0, rev: 0 });
    p.units += q; p.rev += rev;
  });
  const top = Object.values(byProduct).sort((a, b) => b.units - a.units);
  return { revenue, units, online, pctOnline: units ? Math.round(online / units * 100) : 0, products: top.length, top };
}

/* Goal progress: actual vs target with a clamped percentage. */
export function goalProgress(actual, target) {
  const pct = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
  return { actual, target, pct, met: target > 0 && actual >= target };
}
