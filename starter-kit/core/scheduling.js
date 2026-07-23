/* Scheduling — availability, slot generation, deposits, and overlap checks.
 * Pure math + a bookings store. No calendar UI; feed the results to any design.
 *
 * Times are "minutes from midnight" (e.g. 8:00 = 480). A booking is
 * { date:"YYYY-MM-DD", start, dur, ...anything }. Availability = every slot
 * that fits the requested duration inside working hours, off lunch, not
 * overlapping an existing booking, and (for today) still in the future.
 */

const DEFAULTS = {
  openMin: 8 * 60,          // 8:00 AM
  closeMin: 18 * 60,        // 6:00 PM
  slotMin: 30,              // grid granularity
  lunch: [12 * 60, 12 * 60 + 30], // [start,end] blocked, or null
  workingDays: [2, 3, 4, 5, 6, 0], // JS getDay(): Tue–Sun (Mon closed). [] = all
  depositPct: 0.5,          // 50% deposit
  cancelWindowMs: 48 * 60 * 60 * 1000
};

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;

export function createScheduling({ store, key = "bookings", config = {} } = {}) {
  const cfg = { ...DEFAULTS, ...config };
  const load = () => (store ? store.get(key, []) : []);
  const save = (list) => { if (store) store.set(key, list); };

  const isWorkingDay = (d) => cfg.workingDays.length === 0 || cfg.workingDays.includes(d.getDay());

  function bookingsOn(dateStr) { return load().filter((b) => b.date === dateStr); }

  function inLunch(start, end) {
    if (!cfg.lunch) return false;
    return overlaps(start, end, cfg.lunch[0], cfg.lunch[1]);
  }

  /* All valid start times for a service of `dur` minutes on `dateStr`. */
  function availableSlots(dateStr, dur) {
    const d = new Date(dateStr + "T00:00:00");
    if (!isWorkingDay(d)) return [];
    const existing = bookingsOn(dateStr);
    const now = new Date();
    const isToday = dateKey(now) === dateStr;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slots = [];
    for (let t = cfg.openMin; t + dur <= cfg.closeMin; t += cfg.slotMin) {
      const end = t + dur;
      if (inLunch(t, end)) continue;
      if (isToday && t <= nowMin) continue;
      const clash = existing.some((b) => overlaps(t, end, b.start, b.start + b.dur));
      if (!clash) slots.push(t);
    }
    return slots;
  }

  /* Next N working days (Date objects) from `from`. */
  function upcomingDays(count = 12, from = new Date()) {
    const out = [];
    for (let i = 0; out.length < count && i < count * 4; i++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      if (isWorkingDay(d)) out.push(d);
    }
    return out;
  }

  const deposit = (total) => Math.round(total * cfg.depositPct * 100) / 100;

  function canBook(dateStr, start, dur) {
    return availableSlots(dateStr, dur).includes(start);
  }

  function add(booking) {
    if (!canBook(booking.date, booking.start, booking.dur)) return { ok: false, reason: "unavailable" };
    const list = load();
    const rec = { ...booking, createdAt: new Date().toISOString() };
    list.push(rec); save(list);
    return { ok: true, booking: rec };
  }

  /* Move an existing booking (by index) to a new slot; deposit carries over. */
  function reschedule(index, dateStr, start, dur) {
    const list = load();
    const b = list[index];
    if (!b) return { ok: false, reason: "not_found" };
    // temporarily ignore this booking when checking availability
    const others = list.filter((_, i) => i !== index);
    const clash = others.some((o) => o.date === dateStr && overlaps(start, start + dur, o.start, o.start + dur));
    if (clash) return { ok: false, reason: "unavailable" };
    b.date = dateStr; b.start = start; if (dur) b.dur = dur;
    save(list);
    return { ok: true, booking: b };
  }

  function withinCancelWindow(booking) {
    const start = new Date(booking.date + "T00:00:00"); start.setMinutes(booking.start);
    return start.getTime() - Date.now() <= cfg.cancelWindowMs;
  }

  return {
    config: cfg,
    dateKey, availableSlots, upcomingDays, deposit, canBook, add, reschedule,
    withinCancelWindow,
    all: load,
    save,
    remove(index) { const list = load(); list.splice(index, 1); save(list); }
  };
}
