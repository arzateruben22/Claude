/* Settlements — closing each appointment's invoice after the visit.
 * The deposit is collected online; the balance is settled in person (cash or
 * card) or written off as a no-show (deposit kept, optional fee).
 *
 * Keyed by a stable booking id (use your order id, or date|start|email).
 */

export function createSettlements({ store, key = "settlements", noShowFee = 0 } = {}) {
  const load = () => (store ? store.get(key, {}) : {});
  const save = (o) => { if (store) store.set(key, o); };

  return {
    get(bookingKey) { return load()[bookingKey] || { status: "open" }; },

    /* Balance paid in person. method = "cash" | "card". */
    settlePaid(bookingKey, method, amount) {
      const all = load();
      all[bookingKey] = { status: "paid", method, amount: Number(amount) || 0, at: new Date().toISOString() };
      save(all); return all[bookingKey];
    },

    /* No-show: deposit kept, balance written off; optionally charge a fee. */
    settleNoShow(bookingKey, chargeFee = false) {
      const all = load();
      all[bookingKey] = { status: "no-show", fee: chargeFee ? noShowFee : 0, at: new Date().toISOString() };
      save(all); return all[bookingKey];
    },

    reopen(bookingKey) { const all = load(); delete all[bookingKey]; save(all); },

    /* Roll up a list of visits [{ key, total, online }] against settlements. */
    summary(visits) {
      const all = load();
      let cash = 0, card = 0, awaiting = 0, noShowKept = 0, fees = 0;
      visits.forEach((v) => {
        const s = all[v.key];
        const balance = Math.max(0, Number(v.total || 0) - Number(v.online || 0));
        if (!s || s.status === "open") { awaiting += balance; return; }
        if (s.status === "no-show") { noShowKept += Number(v.online || 0); fees += Number(s.fee || 0); return; }
        if (s.method === "cash") cash += balance; else if (s.method === "card") card += balance;
      });
      return { inPersonCash: cash, inPersonCard: card, awaiting, noShowDepositsKept: noShowKept, noShowFees: fees };
    }
  };
}
